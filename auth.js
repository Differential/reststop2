var userQueryValidator = Match.Where(function (user) {
  check(user, {
    id: Match.Optional(String),
    username: Match.Optional(String),
    email: Match.Optional(String)
  });
  if (_.keys(user).length !== 1)
    throw new Match.Error("User property must have exactly one field");
  return true;
});

var selectorFromUserQuery = function (user) {
  if (user.id)
    return {_id: user.id};
  else if (user.username)
    return {username: user.username};
  else if (user.email)
    return {"emails.address": user.email};
  throw new Error("shouldn't happen (validation missed something)");
};

var loginWithPassword = function (options) {
  if (!options.password || !options.user)
    return undefined; // don't handle

  check(options, {user: userQueryValidator, password: String});

  var selector = selectorFromUserQuery(options.user);
  var user = Meteor.users.findOne(selector);
  if (!user)
    throw new Meteor.Error(403, "User not found");

  if (!user.services || !user.services.password ||
  !user.services.password.srp)
  throw new Meteor.Error(403, "User has no password set");

  // Just check the verifier output when the same identity and salt
  // are passed. Don't bother with a full exchange.
  var verifier = user.services.password.srp;
  var newVerifier = SRP.generateVerifier(options.password, {
    identity: verifier.identity, salt: verifier.salt});

    if (verifier.verifier !== newVerifier.verifier)
      throw new Meteor.Error(403, "Incorrect password");

    var stampedLoginToken = Accounts._generateStampedLoginToken();
    Meteor.users.update(
    user._id, {$push: {'services.resume.loginTokens': stampedLoginToken}});

    return {loginToken: stampedLoginToken.token, userId: user._id};
};

_RESTstop.prototype.initAuth = function() {
  RESTstop.add('login', {'method': 'POST'}, function() {
    var user = {};
    if(this.params.user.indexOf('@') == -1) {
      user.username = this.params.user;
    } else {
      user.email = this.params.user;
    }

    try {
      var login = loginWithPassword({
        'user': user,
        'password': this.params.password
      });
    } catch(e) {
      return [e.error, {success: false, message: e.reason}];
    }

    RESTstop._config.onLoggedIn();

    login.success = true;
    return login;
  });

  RESTstop.add('logout', {'method': 'GET', require_login: true}, function() {
    var loginToken = this.params.loginToken;
    if(this.request.headers['x-login-token']) {
      loginToken = this.request.headers['x-login-token'];
    }

    // Log the user out
    Meteor.users.update(
    this.user._id, {$pull: {'services.resume.loginTokens': {token: loginToken}}});
    
    RESTstop._config.onLoggedOut();
    
    return {success: true, message: "You've been logged out!"};
  });
};
