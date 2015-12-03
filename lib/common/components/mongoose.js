'use strict';

var mongoose = require('mongoose');
var async = require('async');
var _ = require('lodash');


function mongooseCommonFactory(config, log, mongoose) {
  var db = mongoose.createConnection(config.mongoose.common);
  db.on('error', function (err) {
    log.error('mongooseCommon connection error:', err.message);
  });
  db.once('open', function callback() {
    log.info('mongooseCommon connected to DB.');
  });
  return db;
}

function mongooseSessionsFactory(config, log, mongoose) {
  var db = mongoose.createConnection(config.mongoose.sessions);
  db.on('error', function (err) {
    log.error('mongooseSessions connection error:', err.message);
  });
  db.once('open', function callback() {
    log.info('mongooseSessions connected to DB.');
  });
  return db;
}

//PLUGINS

function mongooseTimestampsPluginFactory() {
  return function (schema, options) {
    schema.add({ updated: Number, created: Number });
    schema.pre('save', function (next) {
      var timestamp = Date.now();
      this.created = this.created || timestamp;
      this.updated = timestamp;
      next();
    });
    if (options && options.index) {
      schema.path('created').index(options.index);
      schema.path('updated').index(options.index);
    }
  };
}

function mongooseObservePluginFactory(events, log) {

  return function (schema, options) {
    if (!options || !options.eventPrefix) {
      throw new Error('mongooseObservePlugin error. option eventPrefix undefined.');
    }

    var triggerEvent  = schema.__triggerEvent = function(event, doc) {
      event = options.eventPrefix + '.' + event;
      log.trace('Trigger event %s  [%s]', event, JSON.stringify(doc.toJSON()));
      events.emit(event, doc);
    };

    schema.pre('save', function (next) {
      this.wasNew = this.isNew;
      next();
    });

    schema.post('save', function (doc) {
      triggerEvent(doc.wasNew ? 'create' : 'update', doc);
    });

    schema.post('remove', function(doc) {
      triggerEvent('remove', doc);
    });
  };
}

function mongooseSoftDeletePluginFactory() {

  return function(schema) {
    schema.add({deleted: Boolean});
    schema.add({deletedAt: Date});

    schema.pre('save', function (next) {
      if (!this.deleted) {
        this.deleted = false;
      }

      if (!this.deletedAt) {
        this.deletedAt = null;
      }

      next();
    });

    schema.methods.softDelete = function (callback) {
      var self = this;
      this.deleted = true;
      this.deletedAt = new Date();
      this.save(function(err) {
        if(!err && typeof schema.__triggerEvent === 'function') {
          schema.__triggerEvent('softDelete', self);
        }
        callback.apply(this, arguments);
      });
    };

    schema.methods.restore = function (callback) {
      var self = this;
      this.deleted = false;
      this.deletedAt = null;
      this.save(function(err) {
        if(!err && typeof schema.__triggerEvent === 'function') {
          schema.__triggerEvent('restore', self);
        }
        callback.apply(this, arguments);
      });
    };
  };
}

function mongooseSlugPluginFactory(utils, log) {

  /*
   options.baseNameFieldForGenerator - this field use for base name for utils.alias.generate
   options.getBaseName - function that return base name for utils.alias.generate
   options.fieldName - field name at document for storage alias
   */

  return function (schema, options) {
    options || (options = {});
    if(!options.fieldName) {
      options.fieldName = 'alias';
    }

    var addOptions = {};
    addOptions[options.fieldName] = String;

    schema.add(addOptions);

    schema.pre('save', function (next) {

      var Model = this.constructor; // this has no method 'find'
      var baseName, failed = false, self = this;

      //generate unique alias (slug)

      async.whilst(
        function(){ return !self[options.fieldName]; },
        function(cb) {
          if(!baseName) {
            if(typeof options.getBaseName === 'function') {
              baseName =  options.getBaseName.call(self, options);
            } if(typeof options.getBaseName === 'string' && self[options.getBaseName] === 'function') {
              baseName =  self[options.getBaseName].call(self, options);
            }  else if(options.baseNameFieldForGenerator) {
              baseName = self[options.baseNameFieldForGenerator];
            }
            if(!baseName || !baseName.length) {
              failed = true;
            }
          }
          var alias = utils.alias.generate(baseName || '', failed);
          var criteria = {};
          criteria[options.fieldName] = alias;
          Model.findOne(criteria).select('_id').exec(function(err, doc) {
            if(err) {
              log.error('mongooseSlugPluginFactory failed. err=' + JSON.stringify(err) );
              return cb(err);
            }
            if(doc) {
              failed = true;
              return cb(null);
            }
            self[options.fieldName] = alias;
            cb(null);
          });
        },
        next);
    });
  }
}

/**
 * Этот плагин позволяет сохранять объекты в кэш рамках одного запроса к API.
 * Что позволяет избежать повторных обращений к базе.
 *
 * Данный подход не обязывает грузить объект перед обращением к сервису,
 * но в случае если контроллер его загрузил, нужно этим воспользоваться.
 *
 * Работает только при поиске по идентификатору. По умолчанию ищет по полю _id,
 * но его можно переопределить через  options.idFieldName
 */

function mongooseCachePluginFactory() {

  return function (schema, options) {

    options = _.extend({
      idFieldName: '_id',
      cacheKeyPrefix: null,
      getCacheKey: function(id) {
        return (options.cacheKeyPrefix ? options.cacheKeyPrefix + '.' : '') + id;
      }
    }, options);

    function findOne(cache, Model, id, cb) {
      var doc;
      if(cache && (doc = cache.get( options.getCacheKey(id)) ) ) {
        process.nextTick(function(){
          cb(null, doc);
        });
      } else {
        var query = {};
        query[options.idFieldName] = id;
        Model.findOne(query, cb);
      }
    }

    function find(cache, Model, ids, cb) {
      var query = {}, idsForRequest = [], result = [];

      if(cache) {
        for (var i = 0; i < id.length; i++) {
          var doc = cache.get( options.getCacheKey(id[i]) );
          if(doc) {
            result.push(doc);
          } else {
            idsForRequest.push(id[i]);
          }
        }
      } else {
        idsForRequest = ids;
      }

      if(!idsForRequest.length) {
        process.nextTick(function(){
          cb(null, result);
        });
        return;
      }
      query[options.idFieldName] = { $in: idsForRequest };
      Model.find(query, function(err, docs) {
        if(!err && docs.length) {
          result = _.union(result, docs);
        }
        cb(err, result);
      });
    }

    schema.statics.findByIdWithContextCache = function(context, idOrIds, cb) {
      var cache = context && context.cache ? context.cache : null;

      if(Array.isArray(idOrIds)) {
        find(cache, this, idOrIds, cb);
      } else {
        findOne(cache, this, idOrIds, cb);
      }
    }

    schema.methods.saveToContextCache = function(context) {
      var cache = context && context.cache ? context.cache : null;
      var id = this.get(options.idFieldName);
      if(cache && id) {
        cache.set( options.getCacheKey(id), this );
      }
    }

    schema.methods.removeFromContextCache = function(context) {
      var cache = context && context.cache ? context.cache : null;
      var id = this.get(options.idFieldName);
      if(cache && id) {
        cache.delete( options.getCacheKey(id));
      }
    }
  };
}

/*

 Mongoose plugins review.

 Need include ?

 mongoose-setter
 mongoose-merge-plugin
 mongoose-faucet
 mongoose-validator or parry-mongoose + parry + validator.js
 mongoose-elasticsearch
 mongoose-big-decimal
 mongoose-migration
 mongoose-slug-unique - for generation alias field
 mongoose-fs - for storage big objects with GridFs

 Develop own plugins based on ?

 mongoose-findorcreate
 mongoose-delete
 mongoose-observer
 mongoose-immutable
 mongoose-query-paginate

 */


module.exports = {
  mongoose: ['value', mongoose],
  mongooseCommon: ['factory', mongooseCommonFactory],
  mongooseSessions: ['factory', mongooseSessionsFactory],

  //plugins

  mongooseTimestampsPlugin: ['factory', mongooseTimestampsPluginFactory],
  mongooseObservePlugin: ['factory', mongooseObservePluginFactory],
  mongooseSoftDeletePlugin: ['factory', mongooseSoftDeletePluginFactory],
  mongooseSlugPluginFactory: ['factory', mongooseSlugPluginFactory],
  mongooseCachePlugin: ['factory', mongooseCachePluginFactory]
};