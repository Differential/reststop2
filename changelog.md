---
layout: default
username: BeDifferential
repo: reststop2
version: 0.5.3
desc: Add the ability to do RESTful APIs with Meteor 0.6.5.

---
# Changelog

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
