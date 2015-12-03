'use strict';

function authenticateControllerFactory(config, Controller, oauth2Server, passportService, bodyParser, log) {

    var loginURI = config.auth.loginPageUrl;

    var ensureLoggedIn = (function(options) {
        if (typeof options === 'string') {
            options = { redirectTo: options };
        }
        options = options || {};

        var redirectTo = options.redirectTo || '/login';
        var setReturnTo = (options.setReturnTo === undefined) ? true : options.setReturnTo;

        return function(req, res, next) {
            log.debug('_ensureLoggedIn sessionID=%s', req.sessionID);
            log.debug('_ensureLoggedIn session=%s', JSON.stringify(req.session) );
            if (!req.isAuthenticated || !req.isAuthenticated()) {
                if (setReturnTo && req.session) {
                    req.session.returnTo = req.originalUrl || req.url;
                }

                switch(req.query.provider) {
                    case 'facebook':
                        redirectTo =  '/v1/auth/login/facebook';
                        break;
                    case 'google':
                        redirectTo =  '/v1/auth/login/google';
                        break;
                    case 'linkedin':
                        redirectTo =  '/v1/auth/login/linkedin';
                        break;
                    case 'edmodo':
                        redirectTo =  '/v1/auth/login/edmodo';
                        break;
                    case 'windowslive':
                        redirectTo =  '/v1/auth/login/windowslive';
                        break;
                }

                log.debug('_ensureLoggedIn redirectTo=%s returnTo=%s', redirectTo, req.session ? req.session.returnTo: null);

                return res.redirect(redirectTo);
            }
            next();
        };
    })({ redirectTo: loginURI });

    var parseBody = [
        bodyParser.json({ limit: 1024*10, extended: true }),
        bodyParser.urlencoded({ limit: 1024*10, extended: true })
    ];

    class OAuth2Controller extends Controller {

        getRouter (app, express) {
            var router = super.getRouter(app, express);

            router.use(function(req, res, next) {
                var redirect = res.redirect;
                res.redirect = function() {
                    log.debug('REDIRECT TO %s', JSON.stringify(arguments) );
                    redirect.apply(this, arguments);
                };
                next();
            });

            //Limit incoming 1024 bytes for all authenticate requests.
            //It's improvement for DDOS attacks by unauthorized users.

            router.use(parseBody);


            //-- OAuth2 server handlers --

            //confirm dialog for user about access allow/disallow

            router.get('/oauth2', ensureLoggedIn, oauth2Server.authorization, oauth2Server.alreadyHaveDecision, function(req, res) {
                res.render(
                    config.paths.libV2$0 + '/views/dialog.ejs',
                    { transactionID: req.oauth2.transactionID, user: req.user, client: req.oauth2.client }
                );
            });
            router.post('/oauth2/dialog/authorize/decision', ensureLoggedIn, oauth2Server.decision);

            /*
             get bearer token from server side

             request:

             POST /oauth2/token
             {
                 "grant_type":"password",
                 "client_id": "mashape.com",
                 "client_secret": "123456",
                 "username": "user@example.com",
                 "password": "956"
             }

             response:
             {
                 access_token: "J5gJ980JKvN6af9+xyHqhQiyDsimkMHcRMHIt3E4r6o="
                 refresh_token: "SviUmmHez2S+cwmWBpamst2vbMe6KEByzoMW8ai48NI="
                 expires_in: 3600
                 token_type: "Bearer"
             }
            */

            router.post('/oauth2/token', oauth2Server.token);

            router.post('/auth/logout', function(req, res) {
                req.session.destroy(function(){
                    res.success({});
                });//logout();

            });

            //-- Local authenticate services. --

            router.post('/auth/login/local', bodyParser.json({ limit: 10*1024 }), function (req, res, next) {  //is ajax method, for best login page usability
                passportService.passport.authenticate('local', function(err, user, info) {
                    if(err) {
                        return res.error(err);
                    }
                    if(!user) {
                        return res.error('');
                    }
                    req.logIn(user, function(err) {
                        if(err) { return res.error(err); }
                        req.context.setUser(req.user);
                        var _user = req.user.publish(req.context);
                        res.success({user: _user, returnTo: req.session.returnTo});
                    });
                })(req, res, next);
            });

            //-- External authenticate services --

            var options  = {
                successReturnToOrRedirect: '/',
                successRedirect: '/', //it's will be replace to req.session.returnTo
                failureRedirect: loginURI,
                failureFlash: true
            };

            var facebook = passportService.facebook(options);
            router.get('/auth/login/facebook', facebook);
            router.get('/auth/login/facebook/callback', facebook);

            var google = passportService.google(options);
            router.get('/auth/login/google', google);
            router.get('/auth/login/google/callback', google);

            var linkedin = passportService.linkedin(options);
            router.get('/auth/login/linkedin', linkedin);
            router.get('/auth/login/linkedin/callback', linkedin);

            var edmodo = passportService.edmodo(options);
            router.get('/auth/login/edmodo', edmodo);
            router.get('/auth/login/edmodo/callback', edmodo);

            var windowslive = passportService.windowslive(options);
            router.get('/auth/login/windowslive', windowslive);
            router.get('/auth/login/windowslive/callback', windowslive);

            return router;
        }
    }

    OAuth2Controller.parseBody = parseBody;

    return OAuth2Controller;
}

module.exports = {
    AuthenticateController: ['factory', authenticateControllerFactory]
};

