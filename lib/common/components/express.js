/**
 * Autor Eugene Demchenko <demchenkoev@gmail.com>
 * Created on 14.11.15.
 * License BSD
 */


'use strict';

function ExpressApplicationFactory(config, log, events, express, passportService, mongooseSessions, contextExpressMiddleware, responseMiddleware, corsMiddleware) {

  class ExpressApplication {

    constructor(options) {
      this.options = options || {};
      this.app = express();
      this._initApplication();
    }

    _initSessions () {

      var expressSession = require('express-session');
      var MongoStore = require('connect-mongo')(expressSession);
      var session = expressSession({
        name: config.cookie.sessionCookieName || 'sid',
        cookie: { path: '/', httpOnly: true, secure: false, maxAge: null, domain: config.cookie.sessionDomain },
        secret: config.cookie.secret,
        store: new MongoStore({
          //@see https://github.com/kcbanner/connect-mongo
          mongooseConnection: mongooseSessions,
          collection: 'express_sessions',
          autoReconnect: true
        }),
        resave: true,
        saveUninitialized: true
      });
      this.app.use(session);

      return this;
    }

    initControllers(cb) {
      cb(this.app, express);

      return this;
    }

    _initApplication() {
      var methodOverride = require('method-override');

      this.app.set('trust proxy', true);
      /*this.app.set('views', config.paths.lib + '/views');
      this.app.set('view options', { layout: 'layout.ejs' });
      this.app.set('json spaces', config.api.jsonSpaces || 0);
      this.app.engine('html', require('ejs').renderFile);
      this.app.use('/v2.0', express.static(__dirname + '/../public'));*/

      this.app.use(methodOverride('method'));
      this.app.use(methodOverride('X-HTTP-Method-Override'));
      this.app.use(corsMiddleware());
      this.app.use(function (req, res, next) {
        log.info(req.method + ' ' + req.originalUrl);
        next();
      });

      this._initSessions();


      this.app.use(responseMiddleware());
      this.app.use(passportService.passport.initialize());
      this.app.use(passportService.passport.session());
      this.app.use(passportService.bearer());
      this.app.use(contextExpressMiddleware({ baseUri: '/v1' }));
      /*this.app.use(languageMiddleware());
      this.app.use(corsMiddleware());*/

      return this;
    }

    run () {
      //bind http server to ip:port
      this.server = this.app.listen( this.options.port || 3000, '0.0.0.0', () => {
        var host = this.server.address().address;
        var port = this.server.address().port;
        log.info('goldix.net API listening at http://%s:%s', host, port);
        events.emit('APPLICATION.ready', { //upper case for difference with entity names
          app: this.app,
          server: this.server
        });
      });

      return this;
    }

  }

  return ExpressApplication;
}




module.exports = {
  express: ['value', require('express')],
  bodyParser: ['value', require('body-parser')],

  ExpressApplication: ['factory', ExpressApplicationFactory]
};
