'use strict';

var uuid = require('node-uuid');
var crypto = require('crypto');
var faker = require('faker'); //@see https://github.com/Marak/faker.js
faker.locale = 'ru';

function sortObjectKeysRecursive(obj) {
    if (typeof obj !== 'object') {
        return obj;
    }

    var keys = [], temp = {}, res = {};
    for (var key in obj) {
        if (!obj.hasOwnProperty(key)) {
            continue;
        }
        keys.push(key);
        if (Array.isArray(obj[key])) {
            temp[key] = [];
            obj[key].forEach(function (elem, i) {
                temp[key][i] = sortObjectKeysRecursive(elem);
            });
        } else {
            temp[key] = sortObjectKeysRecursive(obj[key]);
        }
    }

    keys.sort();

    for (var i in keys) {
        res[keys[i]] = temp[keys[i]];
    }
    return res;
}

module.exports = {
    faker: ['value', faker],
    utils: ['value', {
        uid: require('uid2'),
        uuid: {
            generate: uuid.v4,
            regExp: /[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/i
        },
        url: {
            regExp: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i
        },
        quoteRegexp: function (string) {
            return string.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
        },
        sortObjectKeysRecursive: sortObjectKeysRecursive,

        objectChecksum: function (obj, str) {
            return crypto
                .createHash('sha1')
                .update((str ? str + '::' : '') + JSON.stringify(sortObjectKeysRecursive(obj)))
                .digest('hex');
        },


        getProperty: function (propertyName, object, defaultValue) {
            var parts = propertyName.split('.'),
                length = parts.length,
                i,
                property = object || this;

            for (i = 0; i < length; i++) {
                if (!property.hasOwnProperty(parts[i])) {
                    return defaultValue;
                }
                property = property[parts[i]];
            }

            return property;
        },

        deleteProperty: function deleteProperty(propertyName, object) {
            var parts = propertyName.split('.'),
                length = parts.length,
                needDelete = parts[length - 1],
                i,
                property = object || this;

            for (i = 0; i < length - 1; i++) {
                property = property[parts[i]];
                if (!property) return;
            }

            if (property.hasOwnProperty(needDelete)) {
                delete property[needDelete];
            }

            return property;
        },

        alias: {
            generate: function (str, failed) {
                var alias = str.toLowerCase()
                    .replace(/[\.,-\/#!$%\^&\*;:{}=\-_`'~()\?\u2019\+@\]\["\\><\|]/g, ' ')
                    .replace(/^\s*/g, '')
                    .replace(/\s*$/g, '')
                    .replace(/\s+/g, '-');
                if (failed) {
                    alias += '-' + Math.round(Math.random() * 10000);
                }
                return alias;
            }
        },

        mongo: {
            searchRegExp: function (text) {
                text = text.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
                return new RegExp('^' + text, 'i');
            }
        },

        random: {
            float: function (min, max) {
                return Math.random() * (max - min) + min;
            },
            int: function (min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            },
            string: function(len, possible)    {
                var text = '';
                if(!possible) {
                    possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                }

                for( var i=0; i < (len || 5); i++ ) {
                    text += possible.charAt(Math.floor(Math.random() * possible.length));
                }
                return text;
            }
        },

        timestamp: function (strOrNumberValue) {
            if (typeof strOrNumberValue === 'string' && strOrNumberValue.match(/^\d+$/)) {
                strOrNumberValue = parseInt(strOrNumberValue);
            }
            return new Date(strOrNumberValue).getTime() || 0;
        },

        /*
            return handlerFunc for 'some string with {optionName1} and other {optionName2}'.replace(Regexp, handlerFunc)
        */

        replacer: function (options) {
            return function (str, p1, offset, s) {
                return options.hasOwnProperty(p1) ? options[[p1]] : p1;
            };
        }

    }]
};