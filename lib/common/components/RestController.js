'use strict';

var _ = require('lodash');

function restControllerFactory(Controller, bodyParser, passportService, validator) {

    class RestController extends Controller {

        getModel(req) {
            return this.model;
        }

        /*
        Controller build path and use it as router.delete(path + '/:' + pathId, function(){} )
        Please use unique pathId for each entity. Best practice pathId = <entityName> + 'Id'
         */

        _getTextSearchCriteria (req, q, criteria, action) {
            /*
                Redefine this method.
                As example:
                    criteria.title = new RegExp(utils.quoteRegexp(q), 'ig');
             */

        }

        _getCriteria (req, action) {
            var criteria = {};
            var blackList = ['sort','limit','skip', 'offset', 'q', 'fields'];
            for(var k in req.query) {
                if(req.query.hasOwnProperty(k) && blackList.indexOf(k) === -1) {
                    criteria[k] = req.query[k];
                }
            }
            if(typeof req.query.q === 'string' && req.query.q.length) {
                this._getTextSearchCriteria(req, req.query.q, criteria, action);
            }
            return criteria;
        }

        _getSortOptions (req, action) {
            var defaultSortDirection = 1;
            var result = {};
            var sort = req.query.sort;

            if(!sort) {
                return {  _id: defaultSortDirection  };
            }
            var parts = sort.split(',');
            for (var i = 0; i < parts.length; i++) {
                var str = parts[i].trim();
                var direction = defaultSortDirection;
                if(str.substr(0,1) === '-') {
                    direction = -1;
                    result[str.substr(1)] = direction;
                } else {
                    result[str] = direction;
                }
            }
            return result;
        }

        _getLimit (req) {
            return req.query.limit*1 || 10;
        }

        _getOffset (req) {
            return req.query.offset*1 || req.query.skip*1 || 0;
        }

        _publishItem (req, doc) {
            if(typeof doc.publish === 'function') {
                return doc.publish(req.context);
            }
            return doc.toJSON();
        }

        _getDataFromRequest (req, action, cb) {
            var data = _.extend({}, req.body, req.params);

            //protect for id change

            if(!this.customIdEnabled || action !== 'create') {
                if(typeof data[this.modelIdFieldName] !== 'undefined') {

                    delete data[this.modelIdFieldName];
                }
            }

            cb(null, data);
        }

        _getDataValidatorRules (req, action, cb) {
            cb(null, {});
        }

        _getValidatedData (req, action, cb) {
            var self = this;
            this._getDataValidatorRules(req, action, function(err, rules) {
                if(err) {
                    return cb(err);
                }
                self._getDataFromRequest(req, action, function(err ,data) {
                    if(err) {
                        return cb(err);
                    }
                    var errors = validator.validateByRules(rules, data);
                    if (errors) {
                        err = {hash: 'VALIDATION_FAILED', errors: errors};
                        return cb(err);
                    }
                    cb(null, data);
                });
            });
        }

        _checkAccess (req, action, doc, cb) {
            cb(null, { permit: true });
        }

        _setAccess (req, action, doc, cb) {
            cb(null);
        }

        _afterCreate (req, doc, cb) {
            cb(null);
        }

        _afterUpdate (req, doc, cb) {
            cb(null);
        }

        _afterDelete (req, doc, cb) {
            cb(null);
        }

        /*
            preload document for handle next update/get/delete operation
         */

        _preload (req, res, next, id) {
            var criteria = {};
            var self = this;

            //already preloaded by global preloaders ??

            req._doc = _.find(req.preloaded, function(model) {
                return model.get(self.modelIdFieldName) === req.params[self.pathId];
            });
            if(req._doc) {
                return next();
            }

            //preload

            criteria[this.modelIdFieldName] = id;
            var model = this.getModel(req);
            model.findOne(criteria, function(err, doc) {
                if(!err && !doc) {
                    err = 'NOT_FOUND';
                }
                if(err) {
                    return res.context.error(err);
                }
                req._doc = doc;
                next();
            });
        }

        list (req, res) {
            var self = this;
            var offset = self._getOffset(req);
            var limit = self._getLimit(req);
            var criteria = self._getCriteria(req, 'list');
            var sort = self._getSortOptions(req, 'list');
            var model = self.getModel(req);
            console.log('model', typeof self.model, self.model);
            model
                .count(criteria)
                .exec(function(err, total) {
                    if(err) {
                        return res.context.error(err);
                    }
                    model
                        .find(criteria)
                        .sort(sort)
                        .limit(limit)
                        .skip(offset)
                        .exec(function(err, docs) {
                            if(err) {
                                return res.context.error(err);
                            }
                            var result = [];
                            for (var i = 0; i < docs.length; i++) {
                                var doc = self._publishItem(req, docs[i]);
                                if(typeof self._wrapDocument === 'function') {
                                    doc = self._wrapDocument(doc);
                                }
                                result.push( doc );
                            }
                            res.context.success(result, {  pagination: {
                                total: total,
                                limit: limit,
                                offset: offset
                            }});
                        });
                });
        }

        getItem (req, res) {
            var self = this;
            var doc = self._publishItem(req, req._doc);
            if(typeof self._wrapDocument === 'function') {
                doc = self._wrapDocument(doc);
            }
            res.context.success(doc);
        }

        _getLocation (req, res, doc, cb) {
            var id = doc.get(this.modelIdFieldName);
            var path = this.path.replace(/\:(\w+)/gm, function(str, p1){
                return doc.get(p1);
            });
            var location = req.context.uri( path + '/' + id );
            cb(null, location);
        }

        create (req, res) {
            var self = this;
            this._checkAccess(req, 'create', null, function(err, permission) {
                if(!err && (!permission || !permission.permit)) {
                    err = 'FORBIDDEN';
                }
                if(err) {
                    return res.context.error(err);
                }
                self._getValidatedData(req, 'create', function(err, data) {
                    if (err) {
                        return res.context.error(err);
                    }
                    var model = self.getModel(req);
                    req._doc = new model(data);
                    req._doc.save(function (err) {
                        if (err) {
                            return res.context.error(err);
                        }
                        self._setAccess(req, 'create', req._doc, function(err) {
                            if (err) {
                                return res.context.error(err);
                            }

                            var id = req._doc.get(self.modelIdFieldName);
                            self._getLocation(req, res, req._doc, function(err, location) {
                                if (err) {
                                    return res.context.error(err);
                                }

                                var result = {};
                                result[self.modelIdFieldName] = id;

                                self._afterCreate(req, req._doc, function(err) {
                                    if (err) {
                                        return res.context.error(err);
                                    }

                                    res.context.success(result, 201, { $headers: { location: location }});
                                });
                            });
                        });
                    });
                });
            });
        }

        update (req, res) {

            var self = this;
            this._checkAccess(req, 'update', req._doc, function(err, permission) {
                if(!err && (!permission || !permission.permit)) {
                    err = 'FORBIDDEN';
                }
                if(err) {
                    return res.context.error(err);
                }
                self._getValidatedData(req, 'update', function(err, data) {
                    if (err) {
                        return res.context.error(err);
                    }
                    _.each(data, function (v, k) {
                        req._doc.set(k, v);
                    });
                    req._doc.save(function (err) {
                        if (err) {
                            return res.context.error(err);
                        }

                        self._afterUpdate(req, req._doc, function(err) {
                            if (err) {
                                return res.context.error(err);
                            }

                            res.context.success();
                        });
                    });
                });
            });
        }

        delete (req, res) {
            var self = this;
            this._checkAccess(req, 'delete', req._doc, function(err, permission) {
                if(!err && (!permission || !permission.permit)) {
                    err = 'FORBIDDEN';
                }
                if(err) {
                    return res.context.error(err);
                }
                if(typeof req._doc.softDelete === 'function') {

                    req._doc.softDelete(function(err) {
                        if(err) {
                            return res.context.error(err);
                        }

                        self._afterDelete(req, req._doc, function(err) {
                            if (err) {
                                return res.context.error(err);
                            }

                            res.context.success();
                        });
                    });
                } else {

                    //use hard delete bacause soft delete not supported

                    req._doc.remove(function(err) {
                        if(err) {
                            return res.context.error(err);
                        }

                        self._afterDelete(req, req._doc, function(err) {
                            if (err) {
                                return res.context.error(err);
                            }

                            res.context.success();
                        });
                    });
                }
            });
        }

        _before (req, res, next) {
            //bind after handler
            var self = this;
            var success = req.context.success;
            var error = req.context.error;

            req.context.success = function() {
                self.after('success', arguments, function() {
                    success.apply(req.context, arguments);
                });
            };

            req.context.error = function() {
                self.after('error', arguments, function() {
                    error.apply(req.context, arguments);
                });
            };

            //run before handler

            self.before.call(self, req, res, next);
        }


        before (req, res, next) {
            next();
        }

        after (status, args, next) {
            next.apply(null, args);
        }

        _wrapDocument (doc) {
            if(!this.wrap) {
                return doc;
            }
            var obj = {};
            obj[this.wrap] = doc;
            return obj;
        }

        getRouter (app, express) {
            var self = this;

            /*if(!self.model) {
                throw new Error('SimpleCRUDController model not defined.');
            } */

            var router = Controller.prototype.getRouter.apply(self, arguments);

            var parseBody = this._parseBody = [
                bodyParser.json({ limit: self.maxBodySize, extended: true }),
                bodyParser.urlencoded({ limit: self.maxBodySize, extended: true })
            ];

            var ensureAuth = self.adminOnlyAccess ? passportService.ensureAdmin : passportService.ensureAuthenticated;
            var pathWithId = self.path + '/:' + self.pathId;

            router.param(self.pathId, _.bind(self._preload, self));

            router.get(self.path, _.bind(self.list, self));
            router.get(pathWithId, _.bind(self.getItem, self));
            router.post(self.path, ensureAuth, parseBody, _.bind(self.create, self));
            router.put(pathWithId, ensureAuth, parseBody, _.bind(self.update, self));
            router.patch(pathWithId, ensureAuth, parseBody, _.bind(self.update, self));
            router.delete(pathWithId, ensureAuth, parseBody, _.bind(self.delete, self));

            return router;
        }
    };

    RestController.prototype.path = '/';
    RestController.prototype.pathId = 'id';
    RestController.prototype.customIdEnabled = false; //set true, if client can setup own id for entity

    RestController.prototype.maxBodySize = 64*1024;    //Default 64kb for input body
    RestController.prototype.model = null;             //Mongoose model for entity
    RestController.prototype.modelIdFieldName = '_id'; //Field name for general id.
    RestController.prototype.adminOnlyAccess = false;  //If true; request must be authorized by user with role admin.
    RestController.prototype.customIdEnable = false;   //if model permit setup custom id; value must be 'true'.

    RestController.prototype.wrap = null;              //for support evolution simpleController to complexFetch output in the future.
                                                       // Document will be wrap form <doc> to { <wrap> = <doc> }

    return RestController;
}

module.exports = {
    RestController: ['factory', restControllerFactory]
};