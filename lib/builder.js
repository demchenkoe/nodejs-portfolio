/**
 * Autor Eugene Demchenko <demchenkoev@gmail.com>
 * Created on 31.03.15.
 * License BSD
 */

'use strict';

var glob = require('glob');
var di = require('di');
var _ = require('lodash');


class Builder {

  constructor(config, options) {


    this.definitions = {};

    this.aliasesForFindPatterns = {
      common: { patterns: 'common/**/*.js' },
      dns: { patterns: 'dns/**/*.js' },
      voip: { patterns: 'voip/**/*.js' },
      syslog: { patterns: 'syslog/**/*.js' },
      i18n: { patterns: 'i18n/**/*.js' }
    };

    this.config = config;
    this.definitions.config = ['value', config];

    this.options = Object.assign({
      glob: {
        cwd: __dirname,
        realpath: true
      }
    }, options);
  }

  /**
   * return true if module disabled
   * @param mod
   * @returns {boolean}
   * @private
   */

  _isDisabled (mod) {
    switch (typeof mod._isDisabled) {
      case 'function':
        return !!mod._isDisabled();
        break;
      case 'undefined':
        return false;
        break;
      default:
        return !!mod._isDisabled;
    }
  }

  /**
   * load module
   * @param filename
   */

  loadModule(filename) {
    var mod = require(filename);

    if (this._isDisabled(mod)) {
      return;
    }
    _.each(mod, (v, k) => {
      if (typeof k !== 'string' || k.substr(0, 1) === '_') {
        return;
      }

      if (this.definitions.hasOwnProperty(k)) {
        console.warn(k + ' already defined. Definition at ' + filename + ' will be ignored.');
        return;
      }
      if (Array.isArray(v) && typeof v[0] === 'string' && ['type', 'factory', 'value'].indexOf(v[0] !== -1)) {
        //add new definition
        this.definitions[k] = v;
      }
    });
    return this;
  }

  /**
   * find and load modules
   * @param pattern
   * @param options
   */


  findModuleAndLoad (patterns, options) {
    if(typeof patterns === 'string' && this.aliasesForFindPatterns.hasOwnProperty(patterns) ) {
      let alias =  this.aliasesForFindPatterns[patterns];
      patterns = alias.patterns
      options = alias.options || options;
    }
    if( !Array.isArray(patterns) ) {
      patterns = [patterns];
    }

    options = Object.assign({}, this.options.glob, options);

    patterns.forEach((_pattern) => {
      glob.sync(_pattern,  options).forEach(this.loadModule, this);
    } );
    return this;
  }

  /**
   * create injector
   * @param redefine
   * @returns {*}
   */

  createInjector (redefine) {
    return new di.Injector([Object.assign({}, this.definitions, redefine)]);
  }

  invoke (run, injector, redefine) {
    if(!injector) {
      injector = this.createInjector(redefine);
    }
    injector.invoke(run);
  }

}

module.exports.Builder = Builder;