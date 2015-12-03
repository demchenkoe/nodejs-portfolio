'use strict';

var _ = require('lodash');

function controllerFactory() {

  class Controller {

    getRouter(app, express) {
      var router = express.Router();
      Controller.routers.push(router);
      return router;
    }

    static addRouteParamHandler(paramName, fn) {
      Controller.paramHandlers[paramName] = fn;
    }

    static applyRouteParamHandlers() {
      _.each(Controller.routers, function (router) {
        _.each(Controller.paramHandlers, function (fn, name) {
          (router.params[name] = router.params[name] || []).unshift(fn);
        });
      });
    }
  }

  Controller.prototype._initHooks = [];
  Controller.prototype.fields = {};

  Controller.routers = [];
  Controller.paramHandlers = {};

  return Controller;
}


module.exports = {
  Controller: ['factory', controllerFactory]
};