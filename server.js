_RESTstop = function() {
  this._routes = [];
  this._config = {
    use_auth: false,
    api_path: '/api',
    onLoggedIn: function(){},
    onLoggedOut: function(){}
  };
  this._started = false;
};

// simply match this path to this function
_RESTstop.prototype.add = function(path, options, endpoint)  {
  var self = this;

  if(path[0] != "/") path = "/" + path;

  // Start serving on first add() call
  if(!this._started){
    this._start();
  }

  if (_.isObject(path) && ! _.isRegExp(path)) {
    _.each(path, function(endpoint, p) {
      self.add(p, endpoint);
    });
  } else {
    if (! endpoint) {
      // no options were supplied so 2nd parameter is the endpoint
      endpoint = options;
      options = null;
    }
    if (! _.isFunction(endpoint)) {
      endpoint = _.bind(_.identity, null, endpoint);
    }
    self._routes.push([new RESTstop.Route(self._config.api_path + path, options), endpoint]);
  }
};

_RESTstop.prototype.match = function(request, response) {
  for (var i = 0; i < this._routes.length; i++) {
    var params = {}, route = this._routes[i];

    if (route[0].match(request.url, request.method, params)) {
      context = {request: request, response: response, params: params};

      var args = [];
      for (var key in context.params)
        args.push(context.params[key]);

      if(request.method == "POST" || request.method == "PUT") {
        _.extend(context.params, request.body);
      }
      if(request.method == "GET" || _.size(request.query)) {
        _.extend(context.params, request.query);
      }

      if(this._config.use_auth) {
        context.user = false;

        var userId = context.params.userId;
        var loginToken = context.params.loginToken;

        if(request.headers['x-login-token']) {
          loginToken = request.headers['x-login-token'];
        }
        if(request.headers['x-user-id']) {
          userId = request.headers['x-user-id'];
        }

        // Get the user object
        if(userId && loginToken) {
          context.user = Meteor.users.findOne({
            _id: userId, 
            "services.resume.loginTokens.token": loginToken
          });
        }

        // Return an error if no user and login required
        if(route[0].options.require_login && !context.user) {
          return [403, {success: false, message: "You must be logged in to do this."}];
        }
      }

      try {
        return route[1].apply(context, args);
      } catch (e) {
        return [e.error || 404, {success: false, message: e.reason || e.message}];
      }
    }
  }
  return false;
};

_RESTstop.prototype.configure = function(config){
  if(this._started){
    throw new Error("RESTstop.configure() has to be called before first call to RESTstop.add()");
  }

  _.extend(this._config, config);

  if(this._config.api_path[0] != "/") {
    this._config.api_path = "/"  +this._config.api_path;
  }
};

_RESTstop.prototype._start = function(){
  var self = this;

  if(this._started){
    throw new Error("RESTstop has already been started");
  }

  this._started = true;

  // hook up the serving
  RoutePolicy.declare('/' + this._config.api_path + '/', 'network');

  var self = this,
      connect = Npm.require("connect");

  WebApp.connectHandlers.use(connect.query());
  WebApp.connectHandlers.use(connect.bodyParser());
  WebApp.connectHandlers.use(function(req, res, next) {
    if (req.url.slice(0, self._config.api_path.length) !== self._config.api_path) {
      return next();
    }

    // need to wrap in a fiber in case they do something async
    // (e.g. in the database)
    if(typeof(Fiber)=="undefined") Fiber = Npm.require('fibers');

    Fiber(function() {
      res.statusCode = 200; // 200 response, by default
      var output = RESTstop.match(req, res);

      if (output === false) {
        output = [404, {success: false, message:'API method not found'}];
      }
      
      // parse out the various type of response we can have

      // array can be
      // [content], [status, content], [status, headers, content]
      if (_.isArray(output)) {
        // copy the array so we aren't actually modifying it!
        output = output.slice(0);

        if (output.length === 3) {
          var headers = output.splice(1, 1)[0];
          _.each(headers, function(value, key) {
            res.setHeader(key, value);
          });
        }

        if (output.length === 2) {
          res.statusCode = output.shift();
        }

        output = output[0];
      }

      if (_.isNumber(output)) {
        res.statusCode = output;
        output = '';
      }

      if(_.isObject(output)) {
        output = JSON.stringify(output, null, "  ");
        res.setHeader("Content-Type", "text/json");
      }

      return res.end(output);
    }).run();
  });

  if(this._config.use_auth) {
    RESTstop.initAuth();
  }
};

_RESTstop.prototype.call = function (context, name, args) { 
  var args = Array.prototype.slice.call(arguments, 2);
  return this._apply(context, name, args, 'method_handlers');
};

_RESTstop.prototype.apply = function (context, name, args) { 
  return this._apply(context, name, args, 'method_handlers');
};

_RESTstop.prototype.getPublished = function (context, name, args) { 
  return this._apply(context, name, args, 'publish_handlers');
};

MethodInvocation = function (options) {
  var self = this;

  // true if we're running not the actual method, but a stub (that is,
  // if we're on a client (which may be a browser, or in the future a
  // server connecting to another server) and presently running a
  // simulation of a server-side method for latency compensation
  // purposes). not currently true except in a client such as a browser,
  // since there's usually no point in running stubs unless you have a
  // zero-latency connection to the user.
  this.isSimulation = options.isSimulation;

  // call this function to allow other method invocations (from the
  // same client) to continue running without waiting for this one to
  // complete.
  this._unblock = options.unblock || function () {};
  this._calledUnblock = false;

  // current user id
  this.userId = options.userId;

  // sets current user id in all appropriate server contexts and
  // reruns subscriptions
  this._setUserId = options.setUserId || function () {};

  // used for associating the connection with a login token so that the
  // connection can be closed if the token is no longer valid
  this._setLoginToken = options._setLoginToken || function () {};

  // Scratch data scoped to this connection (livedata_connection on the
  // client, livedata_session on the server). This is only used
  // internally, but we should have real and documented API for this
  // sort of thing someday.
  this._sessionData = options.sessionData;
};

_.extend(MethodInvocation.prototype, {
  unblock: function () {
    var self = this;
    self._calledUnblock = true;
    self._unblock();
  },
  setUserId: function(userId) {
    var self = this;
    if (self._calledUnblock)
      throw new Error("Can't call setUserId in a method after calling unblock");
    self.userId = userId;
    self._setUserId(userId);
  },
  _setLoginToken: function (token) {
    this._setLoginToken(token);
    this._sessionData.loginToken = token;
  },
  _getLoginToken: function (token) {
    return this._sessionData.loginToken;
  }
});

_RESTstop.prototype._apply = function (context, name, args, handler_name) { 
  var self = Meteor.default_server;

  // Run the handler
  var handler = self[handler_name][name];
  var exception;
  if (!handler) {
    exception = new Meteor.Error(404, "Method not found");
  } else {

    var userId = context.user ? context.user._id : null;
    var setUserId = function() {
      throw new Error("Can't call setUserId on a server initiated method call");
    };

    var invocation = new MethodInvocation({
      isSimulation: false,
      userId: userId,
      setUserId: setUserId,
      sessionData: self.sessionData
    });

    try {
      var result = DDP._CurrentInvocation.withValue(invocation, function () {
        return maybeAuditArgumentChecks(
          handler, invocation, args, "internal call to '" + name + "'");
      });
    } catch (e) {
      exception = e;
    }
  }

  if (exception)
    throw exception;
  return result;
};

var maybeAuditArgumentChecks = function (f, context, args, description) {
  args = args || [];
  if (Package['audit-argument-checks']) {
    return Match._failIfArgumentsAreNotAllChecked(
      f, context, args, description);
  }
  return f.apply(context, args);
};

// Make the router available
RESTstop = new _RESTstop();
