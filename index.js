/**
 * Autor Eugene Demchenko <demchenkoev@gmail.com>
 * Created on 25.10.14.
 * License BSD
 */

'use strict';

var config = require('config')
  , Builder = require('./../lib/builder').Builder;


function run(config, log, ExpressApplication, Controller,
             AuthenticateController, ProjectController,
             VoipDomainController, VoipGatewayController, VoipUserController,
             VoipConfigController, SyslogCollectionController,
             SyslogWorkerManager, SyslogRowController,
             WebhookController, I18nController,
             DnsServer, DnsDomainController
) {

  log.info('NODE_ENV [%s] version: %s, pid: %s, node args: %s',
    process.env.NODE_ENV,
    require('../package.json').version,
    process.pid,
    process.execArgv.join(' ') || 'none'
  );
  log.info('ENV [%s]', JSON.stringify(process.env));
  log.info(JSON.stringify(config));

  process.on('uncaughtException', function (err) {
    log.error('[api] Error[%s, %s].', err.message || err, err.stack);
  });

  var expressApp = new ExpressApplication({
    port: config.API_PORT
  });

  expressApp
    .initControllers( (app, express) => {
      app.use('/v1', (new AuthenticateController()).getRouter(app, express) );
      app.use('/v1', (new ProjectController()).getRouter(app, express) );

      //VoIP

      app.use('/v1', (new VoipDomainController()).getRouter(app, express) );
      app.use('/v1', (new VoipGatewayController()).getRouter(app, express) );
      app.use('/v1', (new VoipUserController()).getRouter(app, express) );
      app.use('/v1', (new VoipConfigController()).getRouter(app, express) );

      //Syslog

      app.use('/v1', (new SyslogCollectionController()).getRouter(app, express) );
      app.use('/v1', (new SyslogRowController()).getRouter(app, express) );

      //DNS

      app.use('/v1', (new DnsDomainController()).getRouter(app, express) );

      //
      app.use('/v1', (new I18nController()).getRouter(app, express) );
      app.use('/v1', (new WebhookController()).getRouter(app, express) );

      //bind global preloaders to routes
      Controller.applyRouteParamHandlers();

    })
    .run();

    //run SysLog server
    (new SyslogWorkerManager()).run();

    //run DNS server
    (new DnsServer()).run();
}

(new Builder(config))
  .findModuleAndLoad('common')
  .findModuleAndLoad('dns')
  .findModuleAndLoad('voip')
  .findModuleAndLoad('i18n')
  .findModuleAndLoad('syslog')
  .findModuleAndLoad('**/*.js', { cwd: __dirname })
  .invoke(run);