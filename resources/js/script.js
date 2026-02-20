var selected_user = null;
var hide_users_mode = false;

// GreeterReady fires on nody-greeter/web-greeter when the lightdm object is
// fully available. Falls back to window load for lightdm-webkit2-greeter and
// local mock testing.
window.addEventListener("GreeterReady", initialize);
window.addEventListener("load", function() {
  if (typeof lightdm === "undefined") initialize();
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
  password_entry.type = (type === 0) ? "text" : "password";

  if (hide_users_mode) {
    // Swap: hide username field, reveal password field
    document.querySelector("#username_field_container").classList.add("hidden");
    document.querySelector("#username_entry").disabled = true;
    password_entry.classList.remove("hidden");
  } else {
    if (!isVisiblePass(password_container)) {
      var users = document.querySelectorAll(".user");
      var user_node = document.querySelector("#" + selected_user);
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
      setVisiblePass(password_container, true);
    }
  }

  password_entry.placeholder = text.replace(":", "");
  password_entry.value = "";
  password_entry.focus();
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
  if (type === 1) {
    message.classList.add("error");
  }
}

// called when the greeter shows an error (legacy signal; nody-greeter uses show_message type=1)
function show_error(text) {
  show_message(text, 1);
}

// called when authentication is complete
function authentication_complete() {
  if (lightdm.is_authenticated) {
    lightdm.start_session(get_selected_session());
  } else {
    show_message("Authentication Failed", 1);
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

function start_authentication(username) {
  lightdm.cancel_autologin();
  selected_user = username;
  lightdm.authenticate(username);
}

function provide_secret() {
  show_message("Logging in\u2026", 0);
  var entry = document.querySelector("#password_entry");
  lightdm.respond(entry.value);
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
  document.querySelector("#username_field_container").classList.remove("hidden");
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
  var container = template.parentElement;
  container.removeChild(template);

  var defaultKey = typeof lightdm.default_session === "string"
    ? lightdm.default_session
    : (lightdm.default_session && lightdm.default_session.key);

  // Merge local and remote sessions
  var all_sessions = (lightdm.sessions || []).slice();
  if (lightdm.remote_sessions && lightdm.remote_sessions.length) {
    all_sessions = all_sessions.concat(lightdm.remote_sessions);
  }

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
    }
    container.appendChild(s);
  }

  if (all_sessions.length > 1) {
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
    lightdm.cancel_authentication();
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
  var time = document.querySelector("#current_time");
  // Use greeter's localized time if available (respects greeter_config.greeter.time_language)
  if (typeof theme_utils !== "undefined" && theme_utils.get_current_localized_time) {
    time.textContent = theme_utils.get_current_localized_time();
  } else {
    var date = new Date();
    var hh = date.getHours();
    var mm = date.getMinutes();
    var suffix = hh >= 12 ? "PM" : "AM";
    hh = hh % 12;
    if (hh === 0) hh = 12;
    if (mm < 10) mm = "0" + mm;
    time.textContent = hh + ":" + mm + " " + suffix;
  }
}

//////////////////////////////////
// Initialization
//////////////////////////////////

function initialize() {
  show_message("", 0);

  if (lightdm.lock_hint) {
    document.body.classList.add("lock-screen");
  }

  // hide_users_hint is the nody-greeter property; hide_users is the legacy name
  hide_users_mode = lightdm.hide_users_hint !== undefined
    ? lightdm.hide_users_hint
    : (lightdm.hide_users || false);

  if (hide_users_mode) {
    document.querySelector("#username_field_container").classList.remove("hidden");
    document.querySelector("#password_entry").classList.add("hidden");
    setVisiblePass(document.querySelector("#password_container"), true);
    document.querySelector("#username_entry").focus();
  } else {
    initialize_users();

    // show_manual_login_hint: add an "Other…" entry alongside the user list
    if (lightdm.show_manual_login_hint) {
      initialize_manual_login_option();
    }
  }

  initialize_sessions();
  initialize_actions();
  initialize_timer();
  initialize_branding();
  initialize_screensaver();
  initialize_battery();
  initialize_multi_monitor();
}

function get_default_avatar() {
  if (typeof greeter_config !== "undefined" &&
      greeter_config.branding && greeter_config.branding.user_image) {
    return greeter_config.branding.user_image;
  }
  return "resources/img/avatar.svg";
}

function on_image_error(e) {
  e.currentTarget.src = get_default_avatar();
}

function initialize_users() {
  var template = document.querySelector("#user_template");
  var parent = template.parentElement;
  parent.removeChild(template);

  var defaultAvatar = get_default_avatar();

  for (var i = 0; i < lightdm.users.length; i++) {
    var user = lightdm.users[i];
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
    parent.appendChild(userNode);
  }

  if (lightdm.has_guest_account) {
    var guestNode = template.cloneNode(true);
    guestNode.querySelector(".user_image").src = defaultAvatar;
    guestNode.querySelector(".user_name").textContent = "Guest";
    guestNode.id = "__guest__";
    guestNode.onclick = function(event) {
      show_message("Logging in as guest\u2026", 0);
      lightdm.authenticate_as_guest();
      event.stopPropagation();
      return false;
    };
    parent.appendChild(guestNode);
  }

  show_users();
  setTimeout(function() {
    var users = document.querySelectorAll(".user");
    for (var i = 0; i < users.length; i++) {
      users[i].classList.add("smooth");
    }
  }, 50);

  // Pre-select the hinted user or guest after the DOM settles
  var userHint = lightdm.select_user_hint;
  var guestHint = lightdm.select_guest_hint;
  if (userHint) {
    setTimeout(function() {
      var node = document.querySelector("#" + userHint);
      if (node) node.click();
    }, 100);
  } else if (guestHint && lightdm.has_guest_account) {
    setTimeout(function() {
      var node = document.querySelector("#__guest__");
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
  otherNode.onclick = function(event) {
    hide_users_mode = true;
    show_message("", 0);
    // Hide all user cards
    var users = document.querySelectorAll(".user");
    for (var i = 0; i < users.length; i++) {
      setVisible(users[i], false);
    }
    // Show manual username entry
    document.querySelector("#username_field_container").classList.remove("hidden");
    document.querySelector("#password_entry").classList.add("hidden");
    setVisiblePass(document.querySelector("#password_container"), true);
    document.querySelector("#username_entry").focus();
    event.stopPropagation();
    return false;
  };
  center.appendChild(otherNode);
}

function initialize_actions() {
  if (!lightdm.can_suspend) {
    document.querySelector("#action_suspend").classList.add("hidden");
  }
  if (!lightdm.can_hibernate) {
    document.querySelector("#action_hibernate").classList.add("hidden");
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
  setInterval(update_time, 1000);
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
    theme_utils.dirlist(branding.background_images_dir, true, function(images) {
      if (images && images.length) {
        var img = images[Math.floor(Math.random() * images.length)];
        document.body.style.backgroundImage = "url('" + img + "')";
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";
        document.body.classList.add("has-background");
      }
    });
  }
}

function initialize_screensaver() {
  // nody-greeter fires the idle signal after greeter_config.greeter.screensaver_timeout seconds
  if (lightdm.idle && typeof lightdm.idle.connect === "function") {
    lightdm.idle.connect(function() {
      document.body.classList.add("idle");
    });
  }
  if (lightdm.reset && typeof lightdm.reset.connect === "function") {
    lightdm.reset.connect(function() {
      document.body.classList.remove("idle");
    });
  }
}

function initialize_battery() {
  if (typeof greeter_config === "undefined") return;
  if (!greeter_config.features || !greeter_config.features.battery) return;
  if (!lightdm.can_access_battery) return;

  update_battery();
  if (lightdm.battery_update && typeof lightdm.battery_update.connect === "function") {
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
  indicator.querySelector(".battery-text").textContent = Math.round(level) + "%";

  if (battery.ac_status) {
    indicator.classList.add("charging");
  } else {
    indicator.classList.remove("charging");
  }
}

function initialize_multi_monitor() {
  // On multi-monitor setups, only show the login UI on the primary window
  if (typeof greeter_comm === "undefined") return;
  greeter_comm.whenReady().then(function(metadata) {
    if (!metadata.is_primary) {
      document.querySelector(".login_content").classList.add("hidden");
      document.querySelector(".footer").classList.add("hidden");
      document.querySelector("#message").classList.add("hidden");
    }
  });
}
