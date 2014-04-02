---
layout: default
username: Differential
repo: reststop2
version: 0.5.8
desc: Add the ability to do RESTful APIs with Meteor 0.6.5 and up.

---
# Changelog

### v0.5.8

* Fix bug where `bodyParser` options not passed in to `connect`.

### v0.5.7

* Add `pretty_json` config option
* Fix issue with catch-all route ([#14](https://github.com/BeDifferential/reststop2/issues/14))

### v0.5.6

* Fix issue [#9](https://github.com/BeDifferential/reststop2/pull/9)

### v0.5.4

* Add `onLoggedIn` and `onLoggedOut` callbacks to configuration options.

### v0.5.3

* Fix bug where `configure` was required, even if it was empty (#4).
* Fix bug where server method invocation (`RESTstop.call`) did not work (#5).
* Move package documentation to http://github.differential.io/reststop2

### v0.5.2

* Make `params` default data type an object instead of an array (#2)
* Implement `logout` route

### v0.5.0

* Read request body for PUT requests.
* Always read query string for any request, if there is one.

### v0.4.3

* Fix bug where auth did not work.
* Update README installation instructions.

### v0.4.2

* Remove external dependency on `npm` and npm's `connect`.
* Update README to reflect new scoping.
