/**
 * Autor Eugene Demchenko <demchenkoev@gmail.com>
 * Created on 31.03.15.
 * License BSD
 */

var Mongoose = require('mongoose')
  , uuid = require('node-uuid').v4
  , _ = require('lodash')
  , crypto = require('crypto')

module.exports.UserModel = ['factory', function(mongooseCommon, mongooseTimestampsPlugin) {

  var User = new Mongoose.Schema({
    _id: { type: String, required: true },
    firstName: { type: String},
    lastName: { type: String},
    fullName: { type: String, required: true },
    email: { type: String},
    password: { type: String}
  });

  User.methods.encryptPassword = function(password) {
    return crypto.createHash('md5').update(password).digest('base64');
  };

  User.virtual('newPassword')
    .set(function(password) {
      this._plainPassword = password;
      this.password = this.encryptPassword(password);
    })
    .get(function() { return this._plainPassword; });

  User.virtual('userId')
    .set(function(id) {
      this._id = id;
    })
    .get(function() { return this._id.toString(); });


  User.methods.checkPassword = function(password) {
    return this.encryptPassword(password) === this.password;
  };

  User.methods.publish = function(context) {
    var user = context.user ? context.user : context;
    var object = this.toJSON();

    //delete fields for any roles
    delete object._id;
    delete object.id;
    delete object.provider;
    delete object.password;

    return object;
  };

  User.pre('validate', function(next) {
    if(this.isNew && !this.uuid) this.uuid = uuid();
    next();
  });

  User.plugin(mongooseTimestampsPlugin, { index: true });
  return mongooseCommon.model('user', User);
}]