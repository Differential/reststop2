---
layout: default
username: BeDifferential
repo: reststop2
version: 0.5.3
desc: Add the ability to do RESTful APIs with Meteor 0.6.5.

---

**NOTE**: Based on the excellent
[`reststop`](https://github.com/gkoberger/meteor-reststop) package by Gregory
Koberger, updated for Meteor 0.6.5.

WHAT IT DOES
------------

RESTstop makes it easy to create RESTful APIs built on top of Meteor, for use 
with legacy systems (or if you're just too lazy to get DDP+SRP working).

It is heavily based on [Meteor Router](https://github.com/tmeasday/meteor-router)'s, 
with API-specific modifications:

  * It doesn't come with all the front-end routing.
  * It makes sure it's run higher in the stack so that your routes aren't ignored.
  * You can authenticate users via the API, and access `this.user`.

INSTALLATION
------------

    cd your-meteor-project
    mrt add reststop2

WRITING AN API
--------------

Here's some simple API methods:

{% highlight javascript %}
    if (Meteor.isServer) {
      RESTstop.configure({use_auth: true});

      RESTstop.add('get_user', function() {
        if(!this.user) {
          return {'is_loggedin': false};
        }
        return {
          'is_loggedin': true, 
          'username': this.user.username
        };
      });

      RESTstop.add('get_num/:num?', function() {
        if(!this.params.num) {
          return [403, {success: false, message: 'You need a num as a parameter!'}];
        }
        return this.params.num;
      });

      RESTstop.add('posts', {require_login: true}, function() {
        var posts = [];
        Posts.find({owner_id: this.user._id}).forEach(function(post) {

          // Modify the post here...

          posts.push(post);
        });
        return posts
      });
    }
{% endhighlight %}

**Configure Options**

The following `configure` options are available:

  * `use_auth` (default: false): *If true, a /login and /logout method are added. You can also access `this.user`, which will be `false` if not logged in.*
  * `api_path` (default: "api"): *The base path for your API. So if you use "api" and add a route called "get_user", the URL will look like "http://yoursite.com/api/get_user/"*
  * `bodyParser`: *Options for bodyParser; see [node-formidable](https://github.com/felixge/node-formidable)*

**Options For `add()`**

For `RESTstop.add`, the following options (second parameter) are available:

  * `require_login` (default: false): *If true, the method will return a 403 if the user is not logged in.*
  * `method` (default: undefined): *A string ("POST") or array (["POST", "GET"]) of allowed HTTP methods.*

**URL Structure**

The `path` is the first parameter of `RESTstop.add`. You can pass it a string or regex.

If you pass it `test/path`, the full path will be `http://yoursite.com/api/test/path`.

If you want to pass in parameters, use a `:`. So, `post/:id` will match things like `api/post/123`. You'll be able to access the value using `this.params.id`.

If you want to make a parameter optional, use `?`. So, `post/:id?` will match both `api/post` and `api/post/123`.

If someone accesses an undefined route, by default a 404 and `{success: false, message: "API method not found"}`. You can overide this by using `*` as your route, which acts as a
catch-all.

**What Each Method Gets Access To**

  * `this.user` - The user object. It's only available if `use_auth` is `true`. If not logged in, it will be `false`.
  * `this.params` - A collection of all parameters. This includes parameters extracted from the URL, parameters from the query string and POST'd data.,
  * `this.request` - The [Connect](https://github.com/senchalabs/connect) request object
  * `this.response` - The [Connect](https://github.com/senchalabs/connect) response object

**Returning Results**

You can return a string:

{% highlight javascript %}
    return "That's current!";
{% endhighlight %}

Or, a JSON object:

{% highlight javascript %}
    return {json: 'object'};
{% endhighlight %}

Or, include an error code by using an array with the error code as the first element:

{% highlight javascript %}
    return [404, {success: false, message: "There's nothing here!"}];
{% endhighlight %}

Or, include an error code AND headers (first and second elements, respectively):

{% highlight javascript %}
    return [404, {"Content-Type": "text/plain"},  {success: false, message: "There's nothing here!"}];
{% endhighlight %}

Or, skip using a function at all:

{% highlight javascript %}
    RESTstop.add('/404', [404, "There's nothing here!"]);
{% endhighlight %}

**Using Authentication:**

When you log in, you'll get a userId and loginToken back. You must save these
and include them with every request. See below for examples.

**Accessing Server Methods**

You can access server methods using `RESTstop.apply(this, 'method_name', [..args..])`:

{% highlight javascript %}
    result = RESTstop.apply(this, 'method_name', [arg1, arg2]);
{% endhighlight %}

Or using `call`:

{% highlight javascript %}
    result = RESTstop.call(this, 'method_name', arg1, arg2);
{% endhighlight %}

You can also get published data in a similar manner:

{% highlight javascript %}
    result = RESTstop.getPublished(this, 'method_name', [arg1, arg2]);
    result.fetch() // You'll need to manually fetch the results
{% endhighlight %}

If you have `use_auth` on and the user is authenticated (see above), you'll be able to access `this.userId` and `Meteor.user()` as normal. 

(Note: This all *seems* to be working, however it's the hackiest part of this whole package -- be very cautious and test well.)

USING THE API YOU CREATED
-------------------------

The following uses the above code.

Any results specified by RESTstop (mostly errors) will include a JSON object with a boolean named `success` and a string called `message`.

**Basic Usage**

We can call our `get_num` the following way. Note the `/api/` in the URL (defined with the `api_path` option above).

    curl --data "num=5" http://localhost:3000/api/get_num/

Or (using the optional `:id` from the URL):

    curl http://localhost:3000/api/get_num/5

**Authenticating**

If you have `use_auth` set to `true`, you now have a `/login` method that returns
a `userId` and `loginToken`. You must save these, and include them in subsequent requests.

(Note: Make sure you're using HTTPS, otherwise this is insecure. In an ideal world,
this should only be done with DDP and SRP.. but alas, this is an RESTful API.)

    curl --data "password=testpassword&user=test" http://localhost:3000/api/login/

The response will look something like this, which you must save (for subsequent requests):

    {success: true, loginToken: "f2KpRW7KeN9aPmjSZ", userId: fbdpsNf4oHiX79vMJ}

**Usage With Logged-in Users**

Since this is a RESTful API (and it's meant to be used by non-browsers), you must include the `loginToken` and `userId` with each request.

    curl --data "userId=fbdpsNf4oHiX79vMJ&loginToken=f2KpRW7KeN9aPmjSZ" http://localhost:3000/api/posts/

Or, pass it as a header. This is probably a bit cleaner:

    curl -H "X-Login-Token: f2KpRW7KeN9aPmjSZ" -H "X-User-Id: fbdpsNf4oHiX79vMJ" http://localhost:3000/api/posts/

THANKS TO
---------
Thanks to the following awesome projects, which I borrowed/stole ideas and code from:

  * [gkoberger/meteor-reststop](https://github.com/gkoberger/meteor-reststop)
  * [tmeasday/meteor-router](https://github.com/tmeasday/meteor-router)
  * [crazytoad/meteor-collectionapi](https://github.com/crazytoad/meteor-collectionapi)

