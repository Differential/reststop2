Npm.depends({
  "connect": "2.9.0"
});

Package.describe({
  summary: "Add the ability to do RESTful APIs with Meteor 0.6.5."
});

Package.on_use(function (api) {
  api.use('check', 'server');
  api.use('routepolicy', 'server');
  api.use('webapp', 'server');
  api.use('srp', 'server');
  api.use('underscore', 'server');
  api.use(['audit-argument-checks'], 'server', {weak: true});
  api.add_files("server.js", "server");
  api.add_files("routing.js", "server");
  api.add_files("auth.js", "server");
  api.export("RESTstop", "server");
});
