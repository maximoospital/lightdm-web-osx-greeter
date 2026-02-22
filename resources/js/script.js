var selected_user = null;
var hide_users_mode = false;
var _initialized = false;

// Connecting to webkit2-greeter
var _signals_connected = false;
function connect_signals() {
  if (_signals_connected) return;
  _signals_connected = true;

  if (
    lightdm.show_prompt &&
    typeof lightdm.show_prompt.connect === "function"
  ) {
    lightdm.show_prompt.connect(function (text, type) {
      show_prompt(text, type);
    });
  }
  if (
    lightdm.show_message &&
    typeof lightdm.show_message.connect === "function"
  ) {
    lightdm.show_message.connect(function (text, type) {
      show_message(text, type);
    });
  }
  if (
    lightdm.authentication_complete &&
    typeof lightdm.authentication_complete.connect === "function"
  ) {
    lightdm.authentication_complete.connect(function () {
      authentication_complete();
    });
  }
  if (
    lightdm.autologin_timer_expired &&
    typeof lightdm.autologin_timer_expired.connect === "function"
  ) {
    lightdm.autologin_timer_expired.connect(function () {
      autologin_timer_expired();
    });
  }
}

// GreeterReady fires on nody and web greeter, but for webkit2 we poll until it is available
window.addEventListener("GreeterReady", function () {
  window._greeter_ready = true;
  if (window._dom_ready) {
    connect_signals();
    initialize();
  }
});

window.addEventListener("load", function () {
  window._dom_ready = true;

  // Wait for lightdm to be available
  var _poll_attempts = 0;
  var _poll_max = 200; // 200 * 50ms = 10 seconds
  function wait_for_lightdm() {
    if (typeof lightdm !== "undefined") {
      window._greeter_ready = true;
      connect_signals();
      initialize();
    } else if (++_poll_attempts < _poll_max) {
      setTimeout(wait_for_lightdm, 50);
    } else {
      console.error("lightdm object not available after 10s");
    }
  }

  if (window._greeter_ready) {
    connect_signals();
    initialize();
  } else {
    wait_for_lightdm();
  }
});

///////////////////////////////////////////////
// CALLBACK API. Called by the webkit greeter
///////////////////////////////////////////////

// called when the greeter asks to show a login prompt
// type: 0 = Question (visible text), 1 = Secret (password)
function show_prompt(text, type) {
  var password_container = document.querySelector("#password_container");
  var password_entry = document.querySelector("#password_entry");

  // Switch input visibility based on prompt type
  // webkit2-greeter passes strings ("password"/"text"), nody-greeter passes ints (0/1)
  var isSecret = type === 1 || type === "password";
  password_entry.type = isSecret ? "password" : "text";

  if (hide_users_mode) {
    // Swap: hide username field, reveal password field
    document.querySelector("#username_field_container").classList.add("hidden");
    document.querySelector("#username_entry").disabled = true;
    password_entry.classList.remove("hidden");
  } else {
    if (!isVisiblePass(password_container)) {
      var users = document.querySelectorAll(".user");
      var user_node = document.getElementById(selected_user);
      if (user_node && user_node.parentElement) {
        var rect = user_node.getClientRects()[0];
        var parentRect = user_node.parentElement.getClientRects()[0];
        var center = parentRect.width / 2;
        var left = center - rect.width / 2 - rect.left;
        if (left < 5 && left > -5) left = 0;
        for (var i = 0; i < users.length; i++) {
          var node = users[i];
          setVisible(node, node.id === selected_user);
          node.style.left = left + "px";
        }
      }
      setVisiblePass(password_container, true);
    }
  }

  password_entry.placeholder = text.replace(":", "");
  password_entry.value = "";
  // Delay focus to ensure WebKitGTK has rendered the now-visible container
  setTimeout(function () {
    password_entry.focus();
  }, 50);
}

// called when the greeter shows a message
// type: 0 = Info, 1 = Error (LightDMMessageType)
function show_message(text, type) {
  var message = document.querySelector("#message_content");
  message.textContent = text;
  if (text) {
    document.querySelector("#message").classList.remove("hidden");
  } else {
    document.querySelector("#message").classList.add("hidden");
  }
  message.classList.remove("error");
  if (type === 1 || type === "error") {
    message.classList.add("error");
  }
}

// called when the greeter shows an error
function show_error(text) {
  show_message(text, 1);
}

// called when authentication is complete
function authentication_complete() {
  if (lightdm.is_authenticated) {
    var session = get_selected_session();
    console.log("Starting session:", session);
    if (!session) {
      show_message("No session available", 1);
      return;
    }
    try {
      var startFn = lightdm.start_session || lightdm.start_session_sync;
      if (startFn) {
        startFn.call(lightdm, session);
      } else if (typeof lightdm.login === "function") {
        lightdm.login(lightdm.authentication_user, session);
      } else {
        show_message("No start_session method available", 1);
      }
    } catch (e) {
      console.error("start_session failed:", e);
      show_message("Failed to start session: " + session, 1);
    }
  } else {
    show_message("Authentication Failed", 1);
    var pw = document.querySelector("#password_entry");
    if (pw) {
      pw.disabled = false;
      pw.placeholder = "Password";
    }
    if (hide_users_mode) {
      reset_to_username_entry();
    } else {
      start_authentication(selected_user);
    }
  }
}

// called by nody-greeter when the autologin timer expires
function autologin_timer_expired() {
  if (lightdm.autologin_guest) {
    lightdm.authenticate_as_guest();
  } else if (lightdm.autologin_user) {
    lightdm.authenticate(lightdm.autologin_user);
  }
}

// legacy alias used by lightdm-webkit2-greeter
function timed_login(user) {
  autologin_timer_expired();
}

//////////////////////////////
// Implementation
//////////////////////////////

function select_user_session(username) {
  // Pre-select the user's last session in the radio buttons
  var users_list = lightdm.users
    ? Array.prototype.slice.call(lightdm.users)
    : [];
  for (var i = 0; i < users_list.length; i++) {
    var u = users_list[i];
    if ((u.username || u.name) === username && u.session) {
      var radio = document.querySelector(
        "#session_" + u.session + " input[name='session']",
      );
      if (radio) radio.checked = true;
      break;
    }
  }
}

function start_authentication(username) {
  if (typeof lightdm.cancel_autologin === "function") {
    lightdm.cancel_autologin();
  }
  selected_user = username;
  select_user_session(username);
  lightdm.authenticate(username);
}

function provide_secret() {
  var entry = document.querySelector("#password_entry");
  if (!entry || !entry.value) {
    show_message("Please enter a password", 1);
    return;
  }
  // Show feedback in-place instead of the message area to avoid layout shift
  var secret = entry.value;
  entry.value = "";
  entry.placeholder = "Logging in\u2026";
  entry.disabled = true;
  try {
    lightdm.respond(secret);
  } catch (e) {
    console.error("lightdm.respond failed:", e);
    show_message("Login error: " + e, 1);
    entry.placeholder = "Password";
    entry.disabled = false;
    entry.focus();
  }
}

// handles both username and password form submissions
function handle_form_submit() {
  if (hide_users_mode && selected_user === null) {
    submit_username();
  } else {
    provide_secret();
  }
}

function submit_username() {
  var username_entry = document.querySelector("#username_entry");
  var username = username_entry.value.trim();
  if (username) {
    start_authentication(username);
  } else {
    username_entry.focus();
  }
}

function reset_to_username_entry() {
  selected_user = null;
  var username_entry = document.querySelector("#username_entry");
  username_entry.disabled = false;
  username_entry.value = "";
  document
    .querySelector("#username_field_container")
    .classList.remove("hidden");
  var password_entry = document.querySelector("#password_entry");
  password_entry.classList.add("hidden");
  password_entry.value = "";
  username_entry.focus();
}

function get_selected_session() {
  var checked = document.querySelector("input[name='session']:checked");
  if (checked) return checked.value;
  var def = lightdm.default_session;
  return typeof def === "string" ? def : (def && def.key) || "";
}

function initialize_sessions() {
  var template = document.querySelector("#session_template");
  if (!template) return;
  var container = template.parentElement;
  if (container) {
    container.removeChild(template);
  }

  var defaultKey =
    typeof lightdm.default_session === "string"
      ? lightdm.default_session
      : lightdm.default_session && lightdm.default_session.key;

  // Merge local and remote sessions — use Array.prototype.slice.call()
  // to convert WebKitGTK bridge objects to real arrays
  var all_sessions = lightdm.sessions
    ? Array.prototype.slice.call(lightdm.sessions)
    : [];
  if (lightdm.remote_sessions && lightdm.remote_sessions.length) {
    all_sessions = all_sessions.concat(
      Array.prototype.slice.call(lightdm.remote_sessions),
    );
  }

  console.log("Available sessions:", all_sessions.length);

  var has_checked = false;
  for (var i = 0; i < all_sessions.length; i++) {
    var session = all_sessions[i];
    var s = template.cloneNode(true);
    s.id = "session_" + session.key;

    var label = s.querySelector(".session_label");
    var radio = s.querySelector("input");
    label.textContent = session.name;
    radio.value = session.key;

    if (session.key === defaultKey) {
      radio.checked = true;
      has_checked = true;
    }
    if (container) {
      container.appendChild(s);
    }
  }

  // If no session matched the default, check the first one
  if (!has_checked && container) {
    var first_radio = container.querySelector("input[name='session']");
    if (first_radio) {
      first_radio.checked = true;
    }
  }

  if (container && all_sessions.length > 1) {
    container.classList.remove("hidden");
  }
}

function show_users() {
  var users = document.querySelectorAll(".user");
  for (var i = 0; i < users.length; i++) {
    users[i].classList.remove("hidden");
    users[i].style.left = "0";
  }
  setVisiblePass(document.querySelector("#password_container"), false);
  selected_user = null;
}

function user_clicked(event) {
  if (selected_user !== null) {
    selected_user = null;
    if (lightdm.in_authentication) {
      lightdm.cancel_authentication();
    }
    show_users();
  } else {
    selected_user = event.currentTarget.id;
    start_authentication(event.currentTarget.id);
  }
  show_message("", 0);
  event.stopPropagation();
  return false;
}

function setVisible(element, visible) {
  if (visible) {
    element.classList.remove("hidden");
  } else {
    element.classList.add("hidden");
  }
}

function setVisiblePass(element, visible) {
  if (visible) {
    element.classList.remove("passhidden");
  } else {
    element.classList.add("passhidden");
  }
}

function isVisible(element) {
  return !element.classList.contains("hidden");
}

function isVisiblePass(element) {
  return !element.classList.contains("passhidden");
}

function update_time() {
  var date = new Date();
  var hh = date.getHours();
  var mm = date.getMinutes();
  var suffix = hh >= 12 ? "PM" : "AM";
  hh = hh % 12;
  if (hh === 0) hh = 12;
  if (mm < 10) mm = "0" + mm;
  document.getElementById("time_hours").textContent = hh;
  document.getElementById("time_minutes").textContent = mm;
  document.getElementById("time_suffix").textContent = suffix;
}

//////////////////////////////////
// Initialization
//////////////////////////////////

function initialize() {
  // Prevent double initialization from both GreeterReady and polling
  if (_initialized) return;

  // Ensure lightdm object exists
  if (typeof lightdm === "undefined") {
    console.error("lightdm object not available");
    return;
  }

  _initialized = true;
  console.log("lightdm-web-osx-greeter: initializing");

  show_message("", 0);

  // Display hostname
  var headertext = document.querySelector(".headertext");
  if (headertext && lightdm.hostname) {
    headertext.textContent = lightdm.hostname;
  }

  if (lightdm.lock_hint) {
    document.body.classList.add("lock-screen");
  }

  // hide_users_hint is the nody-greeter property; hide_users is the legacy name
  hide_users_mode =
    lightdm.hide_users_hint !== undefined
      ? lightdm.hide_users_hint
      : lightdm.hide_users || false;

  if (hide_users_mode) {
    document
      .querySelector("#username_field_container")
      .classList.remove("hidden");
    document.querySelector("#password_entry").classList.add("hidden");
    setVisiblePass(document.querySelector("#password_container"), true);
    document.querySelector("#username_entry").focus();
  } else {
    try {
      initialize_users();
    } catch (e) {
      console.error("initialize_users failed:", e);
    }

    // show_manual_login_hint: add an "Other…" entry alongside the user list
    if (lightdm.show_manual_login_hint) {
      try {
        initialize_manual_login_option();
      } catch (e) {
        console.error("initialize_manual_login_option failed:", e);
      }
    }
  }

  try {
    initialize_keyboard();
  } catch (e) {
    console.error("initialize_keyboard failed:", e);
  }
  try {
    initialize_sessions();
  } catch (e) {
    console.error("initialize_sessions failed:", e);
  }
  try {
    initialize_actions();
  } catch (e) {
    console.error("initialize_actions failed:", e);
  }
  try {
    initialize_timer();
  } catch (e) {
    console.error("initialize_timer failed:", e);
  }
  try {
    initialize_branding();
  } catch (e) {
    console.error("initialize_branding failed:", e);
  }
  try {
    initialize_screensaver();
  } catch (e) {
    console.error("initialize_screensaver failed:", e);
  }
  try {
    initialize_battery();
  } catch (e) {
    console.error("initialize_battery failed:", e);
  }
  try {
    initialize_multi_monitor();
  } catch (e) {
    console.error("initialize_multi_monitor failed:", e);
  }

  // Reveal the UI now that everything is ready
  document.body.classList.remove("loading");
  document.body.classList.add("loaded");
}

function get_default_avatar() {
  return "resources/img/avatar.png";
}

function on_image_error(e) {
  e.currentTarget.src = get_default_avatar();
}

function initialize_users() {
  var template = document.querySelector("#user_template");
  if (!template) return;
  var parent = template.parentElement;
  if (!parent) return;

  // Remove template from DOM so it doesn't show
  parent.removeChild(template);

  // Ensure users list exists — use length check instead of Array.isArray()
  // because WebKitGTK bridge objects may not pass Array.isArray()
  if (!lightdm.users || !lightdm.users.length) {
    console.error("lightdm.users is empty or unavailable");
    return;
  }

  // Convert bridge object to a real array for safe iteration
  var users_list = Array.prototype.slice.call(lightdm.users);
  var defaultAvatar = get_default_avatar();

  for (var i = 0; i < users_list.length; i++) {
    var user = users_list[i];
    var userNode = template.cloneNode(true);

    var image = userNode.querySelector(".user_image");
    var name = userNode.querySelector(".user_name");
    name.textContent = user.display_name;

    if (user.image) {
      image.src = user.image;
      image.onerror = on_image_error;
    } else {
      image.src = defaultAvatar;
    }

    // nody-greeter uses user.username; lightdm-webkit2-greeter uses user.name
    var username = user.username || user.name;
    userNode.id = username;
    userNode.onclick = user_clicked;
    userNode.onkeydown = function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        user_clicked(e);
      }
    };
    parent.appendChild(userNode);
  }

  if (lightdm.has_guest_account) {
    var guestNode = template.cloneNode(true);
    guestNode.querySelector(".user_image").src = defaultAvatar;
    guestNode.querySelector(".user_name").textContent = "Guest";
    guestNode.id = "__guest__";
    guestNode.onclick = function (event) {
      show_message("Logging in as guest\u2026", 0);
      lightdm.authenticate_as_guest();
      event.stopPropagation();
      return false;
    };
    parent.appendChild(guestNode);
  }

  show_users();
  setTimeout(function () {
    var users = document.querySelectorAll(".user");
    for (var i = 0; i < users.length; i++) {
      users[i].classList.add("smooth");
    }
  }, 50);

  // Pre-select the hinted user or guest after the DOM settles
  var userHint = lightdm.select_user_hint;
  var guestHint = lightdm.select_guest_hint;
  if (userHint) {
    setTimeout(function () {
      var node = document.getElementById(userHint);
      if (node) node.click();
    }, 100);
  } else if (guestHint && lightdm.has_guest_account) {
    setTimeout(function () {
      var node = document.getElementById("__guest__");
      if (node) node.click();
    }, 100);
  }
}

// Appends an "Other…" card that switches to manual username entry
function initialize_manual_login_option() {
  var center = document.querySelector(".center");
  if (!center) return;
  var existingUser = center.querySelector(".user");
  if (!existingUser) return;

  var otherNode = existingUser.cloneNode(true);
  otherNode.id = "__manual__";
  var img = otherNode.querySelector(".user_image");
  img.src = get_default_avatar();
  img.onerror = null;
  otherNode.querySelector(".user_name").textContent = "Other\u2026";
  otherNode.onclick = function (event) {
    hide_users_mode = true;
    show_message("", 0);
    // Hide all user cards
    var users = document.querySelectorAll(".user");
    for (var i = 0; i < users.length; i++) {
      setVisible(users[i], false);
    }
    // Show manual username entry
    document
      .querySelector("#username_field_container")
      .classList.remove("hidden");
    document.querySelector("#password_entry").classList.add("hidden");
    setVisiblePass(document.querySelector("#password_container"), true);
    document.querySelector("#username_entry").focus();
    event.stopPropagation();
    return false;
  };
  center.appendChild(otherNode);
}

function initialize_keyboard() {
  var capsWarning = document.getElementById("caps_lock_warning");
  var passwordEntry = document.getElementById("password_entry");

  // Caps Lock detection
  function checkCapsLock(e) {
    if (!capsWarning) return;
    var capsOn = e.getModifierState && e.getModifierState("CapsLock");
    if (capsOn) {
      capsWarning.classList.remove("hidden");
    } else {
      capsWarning.classList.add("hidden");
    }
  }
  if (passwordEntry) {
    passwordEntry.addEventListener("keydown", checkCapsLock);
    passwordEntry.addEventListener("keyup", checkCapsLock);
  }

  // Enter key fallback — if the password field doesn't have focus,
  // the form won't submit on Enter. Catch it at the document level.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && selected_user !== null) {
      var pw = document.getElementById("password_entry");
      if (
        pw &&
        !pw.disabled &&
        isVisiblePass(document.getElementById("password_container"))
      ) {
        e.preventDefault();
        handle_form_submit();
      }
    }
  });

  // Escape key to cancel authentication and return to user list
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (selected_user !== null) {
        if (lightdm.in_authentication) {
          lightdm.cancel_authentication();
        }
        show_users();
        show_message("", 0);
        if (capsWarning) capsWarning.classList.add("hidden");
      } else if (hide_users_mode && selected_user === null) {
        // If in manual login mode via "Other…", go back to user list
        var users = document.querySelectorAll(".user");
        if (users.length > 0) {
          hide_users_mode = false;
          show_users();
          show_message("", 0);
        }
      }
    }
  });
}

function initialize_actions() {
  if (!lightdm.can_suspend) {
    document.querySelector("#action_suspend").classList.add("hidden");
  }
  if (!lightdm.can_restart) {
    document.querySelector("#action_restart").classList.add("hidden");
  }
  if (!lightdm.can_shutdown) {
    document.querySelector("#action_shutdown").classList.add("hidden");
  }
}

function initialize_timer() {
  update_time();
  setInterval(update_time, 15000);
}

function initialize_branding() {
  if (typeof greeter_config === "undefined") return;
  var branding = greeter_config.branding;
  if (!branding) return;

  // Custom logo: replace the apple-logo mask source
  if (branding.logo) {
    var logo = document.querySelector(".apple-logo");
    logo.style.webkitMaskImage = "url('" + branding.logo + "')";
    logo.style.maskImage = "url('" + branding.logo + "')";
  }

  // Random wallpaper from the configured background images directory
  if (branding.background_images_dir && typeof theme_utils !== "undefined") {
    theme_utils.dirlist(
      branding.background_images_dir,
      true,
      function (images) {
        if (images && images.length) {
          var img = images[Math.floor(Math.random() * images.length)];
          document.body.style.backgroundImage = "url('" + img + "')";
          document.body.style.backgroundSize = "cover";
          document.body.style.backgroundPosition = "center";
          document.body.classList.add("has-background");
        }
      },
    );
  }
}

function initialize_screensaver() {
  // nody-greeter fires the idle signal after greeter_config.greeter.screensaver_timeout seconds
  if (lightdm.idle && typeof lightdm.idle.connect === "function") {
    lightdm.idle.connect(function () {
      document.body.classList.add("idle");
    });
  }
  if (lightdm.reset && typeof lightdm.reset.connect === "function") {
    lightdm.reset.connect(function () {
      document.body.classList.remove("idle");
    });
  }
}

function initialize_battery() {
  if (typeof greeter_config === "undefined") return;
  if (!greeter_config.features || !greeter_config.features.battery) return;
  if (!lightdm.can_access_battery) return;

  update_battery();
  if (
    lightdm.battery_update &&
    typeof lightdm.battery_update.connect === "function"
  ) {
    lightdm.battery_update.connect(update_battery);
  }
}

function update_battery() {
  var indicator = document.querySelector("#battery_indicator");
  if (!indicator) return;
  var battery = lightdm.battery_data;
  if (!battery) return;

  indicator.classList.remove("hidden");
  var level = Math.max(0, Math.min(100, battery.level));
  indicator.querySelector(".battery-level").style.width = level + "%";
  indicator.querySelector(".battery-text").textContent =
    Math.round(level) + "%";

  if (battery.ac_status) {
    indicator.classList.add("charging");
  } else {
    indicator.classList.remove("charging");
  }
}

function initialize_multi_monitor() {
  // On multi-monitor setups, only show the login UI on the primary window
  if (typeof greeter_comm === "undefined") return;
  if (typeof greeter_comm.whenReady !== "function") return;
  greeter_comm.whenReady().then(function (metadata) {
    // Only hide if we're explicitly a secondary monitor
    if (metadata && metadata.is_primary === false) {
      document.querySelector(".login_content").classList.add("hidden");
      document.querySelector(".footer").classList.add("hidden");
      document.querySelector("#message").classList.add("hidden");
    }
  });
}
