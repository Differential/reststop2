_RESTstop = function() {
  this._routes = [];
  this._config = {
    use_auth: false,
    api_path: 'api',
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
    var params = [], route = this._routes[i];

    if (route[0].match(request.url, request.method, params)) {
      context = {request: request, response: response, params: params};

      var args = [];
      for (var key in context.params)
        args.push(context.params[key]);

      if(request.method == "POST") {
        context.parms = _.extend(context.params, request.body);
      }
      if(request.method == "GET") {
        context.parms = _.extend(context.params, request.query);
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

  this._config = _.extend(this._config, config);

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

  WebApp.connectHandlers.use(function(req, res, next) {
    connect.query();
    connect.bodyParser();
    return next();
  });

  WebApp.connectHandlers.use(function(req, res, next) {
    if (req.url.slice(0, self._config.api_path.length) !== self._config.api_path) {
      return next();
    }

    // need to wrap in a fiber in case they do something async
    // (e.g. in the database)
    if(typeof(Fiber)=="undefined") Fiber = Npm.require('fibers');

    Fiber(function() {
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
        output = JSON.stringify(output);
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

    var invocation = new Meteor._MethodInvocation({
      isSimulation: false,
      userId: context.user._id, setUserId: setUserId,
      sessionData: self.sessionData
    });

    try {
      var result = Meteor._CurrentInvocation.withValue(invocation, function () {
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
  if (Meteor._LivedataServer._auditArgumentChecks) {
    return Match._failIfArgumentsAreNotAllChecked(
    f, context, args, description);
  }
  return f.apply(context, args);
};

// Make the router available
RESTstop = new _RESTstop();
