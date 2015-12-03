'use strict';

var _ = require('lodash');


//base class for all context classes

function contextClassFactory(Cache, config, log, utils) {

    class Context {

        constructor (data) {
            //Class.prototype.initialize.call(this);
            this.id = this._generateId();

            //Memory cache, for DB requests optmization
            this.cache = new Cache();

            Object.assign(this, data);
        }

        _generateId () {
            return utils.uid(16);
        }
        /**
         * Basicaly functional. Return success result to request initiator
         * @param obj
         * @param options
         */
        success  (obj, options) {
        }

        /**
         * Basicaly functional. Return info about error to request initiator
         * @param obj
         * @param options
         */

        error  (err, options) {
        }

        /**
         * Return uri with baseUri prefix
         * @param uri
         * @returns {String}
         */

        uri  (uri) {
            if (uri.indexOf('://') !== -1) {
                return uri;
            }
            return (this.baseUri || '') + uri;
        }

        /**
         * If url without http: or https: then insert it
         * @param url
         * @returns {String}
         */

        completeUrl (url) {
            if(typeof url !== 'string') {
                return null;
            }
            if(url.indexOf('//') === 0) {
                return this.preferProtocol + ':' + url;
            }
            return url;
        }

        /**
         * Return true if user is global administrator (administrator for all platforms)
         * @returns {boolean}
         */

        isAdmin () {
            return this.user && this.user.hasRole && this.user.hasRole('admin');
        }

        /**
         * Setup context user
         * @param user
         */

        setUser (user) {
            this.user = user;
            this.ownerGuid = user.userId; //@deprecated
            this.ownerId = user.userId;
            this.ownerType = 'User';
        }
    }

    /**
     *  Name for logger and debug
     */
    Context.prototype.name = 'Unknown';

    /**
     * oAuth2 client info
     */

    Context.prototype.client = null;
    Context.prototype.clientId = null;
    Context.prototype.scope = null;

    /**
     * User what create request
     */

    Context.prototype.user = null;

    /**
     * Info about owner for create new objects.
     * Usually contains ID of context.user
     */

    Context.prototype.ownerId = null;
    Context.prototype.ownerType = null;

    /**
     * Some options for request handlers
     */

    Context.prototype.preferProtocol = 'https';
    Context.prototype.lang = 'en-US';
    Context.prototype.currency = 'USD';

    /**
     * Logger for requests with current context
     */

    Context.prototype.log = log;

    return Context;
}

//context  for requests with ExpressJS

function expressContextClassFactory(Context, config, log, utils) {
    class ExpressContext extends Context {
        constructor (data) {
            super(...arguments);
        }

        setClient (authInfo) {
            this.clientId = authInfo.clientId;
            this.scope = authInfo.scope;
        }
    };

    ExpressContext.prototype.name = 'RestAPI';

    return ExpressContext;
}

function consoleContextClassFactory(Context, config, log, utils) {

    class ConsoleContext extends Context {
        constructor (data) {
            super.apply(this, arguments);
            Object.assign(this, data);
        }

        success (obj) {
            log.info(obj);
        }

        error (err) {
            log.error(err);
        }
    }

    ConsoleContext.prototype.name = 'Console';

    return ConsoleContext;
}

function contextExpressMiddlewareFactory(Context, ExpressContext) {

    return function (options) {
        options || (options = {});
        return function (req, res, next) {
            if (req.url.indexOf('/oauth2') !== -1) {
                return next();
            }

            var contextData = {
                success: res.success,
                error: res.error,
                baseUri: options.baseUri
            };

            var context = req.context = res.context = new ExpressContext(contextData);

            if(req.authInfo) {
                context.setClient(req.authInfo);
            }

            if(req.user) {
                context.setUser(req.user);
            }

            next();
        };
    }
}


module.exports = {
    Context: ['factory', contextClassFactory],
    ExpressContext: ['factory', expressContextClassFactory],
    ConsoleContext: ['factory', consoleContextClassFactory],
    contextExpressMiddleware: ['factory', contextExpressMiddlewareFactory]
};