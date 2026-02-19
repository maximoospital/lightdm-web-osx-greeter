// mock lightdm for local browser testing
// Simulates the lightdm-webkit2-greeter JavaScript API
if (typeof lightdm === "undefined") {
  lightdm = {};

  // System info
  lightdm.hostname = "test-host";

  // Languages
  lightdm.languages = [
    { code: "en_US", name: "English (US)", territory: "USA" },
    { code: "en_UK", name: "English (UK)", territory: "UK" },
  ];
  lightdm.default_language = lightdm.languages[0];
  lightdm.language = lightdm.languages[0];

  // Keyboard layouts
  lightdm.layouts = [
    { name: "us", short_description: "us", description: "English (US)" },
  ];
  lightdm.default_layout = lightdm.layouts[0];
  lightdm.layout = lightdm.layouts[0];

  // Sessions
  lightdm.sessions = [
    { key: "xfce", name: "Xfce Session", comment: "" },
    { key: "openbox", name: "Openbox", comment: "" },
  ];
  lightdm.default_session = lightdm.sessions[0].key; // string key in new API

  // Authentication state
  lightdm.authentication_user = null;
  lightdm.in_authentication = false;
  lightdm.is_authenticated = false;
  lightdm._username = null;

  // Power management capabilities
  lightdm.can_suspend = true;
  lightdm.can_hibernate = true;
  lightdm.can_restart = true;
  lightdm.can_shutdown = true;

  // Greeter behaviour flags
  lightdm.hide_users = false;    // set true to test manual username entry
  lightdm.lock_hint = false;     // set true to test lock-screen mode
  lightdm.has_guest_account = false; // set true to test guest login

  // Autologin
  lightdm.autologin_user = null;
  lightdm.autologin_timeout = 0;
  lightdm.timed_login_delay = 0; // set > 0 to simulate timed login
  lightdm.timed_login_user = lightdm.timed_login_delay > 0 ? lightdm.sessions[0] : null;

  // Users
  lightdm.users = [
    {
      name: "clarkk",
      real_name: "Superman",
      display_name: "Clark Kent",
      image: "/resources/img/test.png",
      language: "en_US",
      layout: null,
      session: "xfce",
      logged_in: false,
    },
    {
      name: "brucew",
      real_name: "Batman",
      display_name: "Bruce Wayne",
      image: "/home/brokenImage.gif",
      language: "en_US",
      layout: null,
      session: "xfce",
      logged_in: false,
    },
    {
      name: "peterp",
      real_name: "Spiderman",
      display_name: "Peter Parker",
      image: "",
      language: "en_US",
      layout: null,
      session: "xfce",
      logged_in: true,
    },
  ];
  lightdm.num_users = lightdm.users.length;

  // --- Methods (new lightdm-webkit2-greeter API) ---

  lightdm.authenticate = function(username) {
    _lightdm_mock_check_argument_length(arguments, 1);
    if (lightdm._username) {
      throw "Already authenticating!";
    }
    var user = _lightdm_mock_get_user(username);
    if (!user) {
      show_error(username + " is an invalid user");
      return;
    }
    lightdm._username = username;
    lightdm.in_authentication = true;
    show_prompt("Password: ");
  };

  lightdm.authenticate_as_guest = function() {
    _lightdm_mock_check_argument_length(arguments, 0);
    lightdm.is_authenticated = true;
    lightdm.authentication_user = "__guest__";
    authentication_complete();
  };

  lightdm.respond = function(secret) {
    if (!lightdm._username) {
      throw "must call authenticate first";
    }
    _lightdm_mock_check_argument_length(arguments, 1);
    // Mock: password must equal username to authenticate
    if (secret === lightdm._username) {
      lightdm.is_authenticated = true;
      lightdm.authentication_user = lightdm._username;
    } else {
      lightdm.is_authenticated = false;
      lightdm.authentication_user = null;
    }
    lightdm._username = null;
    lightdm.in_authentication = false;
    authentication_complete();
  };

  lightdm.cancel_authentication = function() {
    _lightdm_mock_check_argument_length(arguments, 0);
    lightdm._username = null;
    lightdm.in_authentication = false;
  };

  lightdm.cancel_autologin = function() {
    _lightdm_mock_check_argument_length(arguments, 0);
    lightdm._timed_login_cancelled = true;
  };

  lightdm.start_session = function(session) {
    _lightdm_mock_check_argument_length(arguments, 1);
    if (!lightdm.is_authenticated) {
      throw "The system is not authenticated";
    }
    alert("Logged in! Session: " + session);
    document.location.reload(true);
  };

  lightdm.set_language = function(language_code) {
    _lightdm_mock_check_argument_length(arguments, 1);
    lightdm.language = lightdm.languages.find(function(l) {
      return l.code === language_code;
    }) || lightdm.default_language;
  };

  lightdm.suspend = function() {
    alert("System Suspended. Bye Bye");
    document.location.reload(true);
  };

  lightdm.hibernate = function() {
    alert("System Hibernated. Bye Bye");
    document.location.reload(true);
  };

  lightdm.restart = function() {
    alert("System restarting. Bye Bye");
    document.location.reload(true);
  };

  lightdm.shutdown = function() {
    alert("System shutting down. Bye Bye");
    document.location.reload(true);
  };

  if (lightdm.timed_login_delay > 0) {
    setTimeout(function() {
      if (!lightdm._timed_login_cancelled) timed_login();
    }, lightdm.timed_login_delay);
  }
}

// --- greeter_config mock ---
if (typeof greeter_config === "undefined") {
  greeter_config = {
    branding: {
      logo: "",
      user_image: ""
    },
    greeter: {
      debug_mode: false,
      detect_theme_errors: true,
      screensaver_timeout: 300,
      secure_mode: false,
      time_format: "LT",
      time_language: "",
      webkit_theme: ""
    }
  };
}

// --- theme_utils mock ---
if (typeof theme_utils === "undefined") {
  theme_utils = {
    bind_this: function(context) {
      var excluded = ["constructor", "bind_this"];
      Object.getOwnPropertyNames(Object.getPrototypeOf(context)).forEach(function(key) {
        if (!excluded.includes(key) && typeof context[key] === "function") {
          context[key] = context[key].bind(context);
        }
      });
      return context;
    },
    dirlist: function(path, only_images, callback) {
      callback([]);
    },
    esc_html: function(text) {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },
    get_current_localized_time: function() {
      return new Date().toLocaleTimeString();
    }
  };
}

// --- helpers ---

function _lightdm_mock_check_argument_length(args, length) {
  if (args.length !== length) {
    throw "incorrect number of arguments in function call";
  }
}

function _lightdm_mock_get_user(username) {
  for (var i = 0; i < lightdm.users.length; i++) {
    if (lightdm.users[i].name === username) {
      return lightdm.users[i];
    }
  }
  return null;
}
