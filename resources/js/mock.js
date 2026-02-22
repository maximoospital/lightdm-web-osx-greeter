// mock lightdm for local browser testing
// Simulates the nody-greeter / web-greeter JavaScript API

// --- Signal helper ---
function MockSignal() {
  this._callbacks = [];
}
MockSignal.prototype.connect = function (cb) {
  this._callbacks.push(cb);
};
MockSignal.prototype.emit = function () {
  var args = arguments;
  this._callbacks.forEach(function (cb) {
    cb.apply(null, args);
  });
};

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
  lightdm.remote_sessions = [];
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

  // Greeter behaviour flags (nody-greeter names; legacy aliases kept below)
  lightdm.hide_users_hint = false; // set true to test manual username entry
  lightdm.hide_users = false; // legacy alias
  lightdm.lock_hint = false; // set true to test lock-screen mode
  lightdm.has_guest_account = false; // set true to test guest login
  lightdm.show_manual_login_hint = false; // set true to show "Other…" option
  lightdm.show_remote_login_hint = false;
  lightdm.select_user_hint = null; // set to a username string to pre-select
  lightdm.select_guest_hint = false;

  // Autologin
  lightdm.autologin_guest = false;
  lightdm.autologin_user = null;
  lightdm.autologin_timeout = 0;
  lightdm.timed_login_delay = 0; // set > 0 to simulate timed login (ms)

  // Battery
  lightdm.can_access_battery = false;
  lightdm.battery_data = null;
  lightdm.battery_update = new MockSignal();

  // Brightness
  lightdm.can_access_brightness = false;
  lightdm.brightness = 100;

  // Signals
  lightdm.idle = new MockSignal();
  lightdm.reset = new MockSignal();
  lightdm.authentication_complete = new MockSignal();
  lightdm.show_message = new MockSignal();
  lightdm.show_prompt = new MockSignal();
  lightdm.autologin_timer_expired = new MockSignal();

  // Users (nody-greeter uses user.username; user.name kept for compat)
  lightdm.users = [
    {
      username: "mospital",
      name: "maximo",
      real_name: "mospital",
      display_name: "Maximo Ospital",
      image: "resources/img/test.png",
      language: "en_US",
      layout: null,
      layouts: [],
      session: "xfce",
      logged_in: false,
      home_directory: "/home/mospital",
      background: "",
    },
    {
      username: "brucew",
      name: "brucew",
      real_name: "Batman",
      display_name: "Bruce Wayne",
      image: "/home/brokenImage.gif",
      language: "en_US",
      layout: null,
      layouts: [],
      session: "xfce",
      logged_in: false,
      home_directory: "/home/brucew",
      background: "",
    },
    {
      username: "peterp",
      name: "peterp",
      real_name: "Spiderman",
      display_name: "Peter Parker",
      image: "",
      language: "en_US",
      layout: null,
      layouts: [],
      session: "xfce",
      logged_in: true,
      home_directory: "/home/peterp",
      background: "",
    },
  ];
  lightdm.num_users = lightdm.users.length;

  // --- Methods ---

  lightdm.authenticate = function (username) {
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
    show_prompt("Password: ", 1);
  };

  lightdm.authenticate_as_guest = function () {
    _lightdm_mock_check_argument_length(arguments, 0);
    lightdm.is_authenticated = true;
    lightdm.authentication_user = "__guest__";
    authentication_complete();
  };

  lightdm.respond = function (secret) {
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

  lightdm.cancel_authentication = function () {
    _lightdm_mock_check_argument_length(arguments, 0);
    lightdm._username = null;
    lightdm.in_authentication = false;
  };

  lightdm.cancel_autologin = function () {
    _lightdm_mock_check_argument_length(arguments, 0);
    lightdm._timed_login_cancelled = true;
  };

  lightdm.start_session = function (session) {
    _lightdm_mock_check_argument_length(arguments, 1);
    if (!lightdm.is_authenticated) {
      throw "The system is not authenticated";
    }
    alert("Logged in! Session: " + session);
    document.location.reload(true);
  };

  lightdm.set_language = function (language_code) {
    _lightdm_mock_check_argument_length(arguments, 1);
    lightdm.language =
      lightdm.languages.find(function (l) {
        return l.code === language_code;
      }) || lightdm.default_language;
  };

  lightdm.suspend = function () {
    alert("System Suspended. Bye Bye");
    document.location.reload(true);
  };

  lightdm.hibernate = function () {
    alert("System Hibernated. Bye Bye");
    document.location.reload(true);
  };

  lightdm.restart = function () {
    alert("System restarting. Bye Bye");
    document.location.reload(true);
  };

  lightdm.shutdown = function () {
    alert("System shutting down. Bye Bye");
    document.location.reload(true);
  };

  lightdm.brightness_set = function (value) {
    lightdm.brightness = Math.max(0, Math.min(100, value));
  };

  lightdm.brightness_increase = function () {
    lightdm.brightness_set(lightdm.brightness + 10);
  };

  lightdm.brightness_decrease = function () {
    lightdm.brightness_set(lightdm.brightness - 10);
  };

  // Simulate timed login
  if (lightdm.timed_login_delay > 0) {
    setTimeout(function () {
      if (!lightdm._timed_login_cancelled) autologin_timer_expired();
    }, lightdm.timed_login_delay);
  }

  // Simulate idle after 30s of inactivity (for local testing)
  var _idle_timer = null;
  var _idle_timeout = 30000;
  function _reset_idle() {
    clearTimeout(_idle_timer);
    if (document.body && document.body.classList.contains("idle")) {
      lightdm.reset.emit();
    }
    _idle_timer = setTimeout(function () {
      lightdm.idle.emit();
    }, _idle_timeout);
  }
  document.addEventListener("mousemove", _reset_idle);
  document.addEventListener("keydown", _reset_idle);
  _reset_idle();
}

// --- greeter_config mock (only when not provided by the real greeter) ---
if (typeof greeter_config === "undefined") {
  greeter_config = {
    branding: {
      background_images_dir: "",
      logo: "",
      user_image: "",
    },
    greeter: {
      debug_mode: false,
      detect_theme_errors: true,
      screensaver_timeout: 300,
      secure_mode: false,
      time_language: "",
      theme: "",
    },
    features: {
      battery: false,
      backlight: {
        enabled: false,
        value: 100,
        steps: 10,
      },
    },
    layouts: [],
  };
}

// --- theme_utils mock (only when not provided by the real greeter) ---
if (typeof theme_utils === "undefined") {
  theme_utils = {
    bind_this: function (context) {
      var excluded = ["constructor", "bind_this"];
      Object.getOwnPropertyNames(Object.getPrototypeOf(context)).forEach(
        function (key) {
          if (!excluded.includes(key) && typeof context[key] === "function") {
            context[key] = context[key].bind(context);
          }
        },
      );
      return context;
    },
    dirlist: function (path, only_images, callback) {
      callback([]);
    },
    dirlist_sync: function (path, only_images) {
      return [];
    },
    esc_html: function (text) {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },
    get_current_localized_date: function () {
      return new Date().toLocaleDateString();
    },
    get_current_localized_time: function () {
      return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  };
}

// --- greeter_comm mock (only when not provided by the real greeter) ---
if (typeof greeter_comm === "undefined") {
  greeter_comm = {
    window_metadata: {
      id: 0,
      is_primary: true,
      position: { x: 0, y: 0 },
      size: { width: window.screen.width, height: window.screen.height },
      overallBoundary: {
        minX: 0,
        minY: 0,
        maxX: window.screen.width,
        maxY: window.screen.height,
      },
    },
    whenReady: function () {
      return Promise.resolve(this.window_metadata);
    },
    broadcast: function (data) {},
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
    var u = lightdm.users[i];
    if ((u.username || u.name) === username) return u;
  }
  return null;
}
