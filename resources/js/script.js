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
function show_prompt(text, type) {
  var password_container = document.querySelector("#password_container");
  var password_entry = document.querySelector("#password_entry");

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

// called when the greeter asks to show a message
function show_message(text, type) {
  var message = document.querySelector("#message_content");
  message.innerHTML = text;
  if (text) {
    document.querySelector("#message").classList.remove("hidden");
  } else {
    document.querySelector("#message").classList.add("hidden");
  }
  message.classList.remove("error");
}

// called when the greeter asks to show an error
function show_error(text) {
  show_message(text);
  document.querySelector("#message_content").classList.add("error");
}

// called when authentication is complete
function authentication_complete() {
  if (lightdm.is_authenticated) {
    lightdm.start_session(get_selected_session());
  } else {
    show_error("Authentication Failed");
    if (hide_users_mode) {
      reset_to_username_entry();
    } else {
      start_authentication(selected_user);
    }
  }
}

// called when the greeter wants us to perform a timed login
function timed_login(user) {
  lightdm.start_session(lightdm.default_session);
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
  show_message("Logging in...");
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

  for (var i = 0; i < lightdm.sessions.length; i++) {
    var session = lightdm.sessions[i];
    var s = template.cloneNode(true);
    s.id = "session_" + session.key;

    var label = s.querySelector(".session_label");
    var radio = s.querySelector("input");
    label.innerHTML = session.name;
    radio.value = session.key;

    if (session.key === defaultKey) {
      radio.checked = true;
    }
    container.appendChild(s);
  }

  if (lightdm.sessions.length > 1) {
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
  show_message("");
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
  var date = new Date();
  var hh = date.getHours();
  var mm = date.getMinutes();
  var suffix = hh >= 12 ? "PM" : "AM";
  hh = hh % 12;
  if (hh === 0) hh = 12;
  if (mm < 10) mm = "0" + mm;
  time.innerHTML = hh + ":" + mm + " " + suffix;
}

//////////////////////////////////
// Initialization
//////////////////////////////////

function initialize() {
  show_message("");

  if (lightdm.lock_hint) {
    document.body.classList.add("lock-screen");
  }

  hide_users_mode = lightdm.hide_users;

  if (hide_users_mode) {
    document.querySelector("#username_field_container").classList.remove("hidden");
    document.querySelector("#password_entry").classList.add("hidden");
    setVisiblePass(document.querySelector("#password_container"), true);
    document.querySelector("#username_entry").focus();
  } else {
    initialize_users();
  }

  initialize_sessions();
  initialize_actions();
  initialize_timer();
}

function on_image_error(e) {
  e.currentTarget.src = "resources/img/avatar.svg";
}

function initialize_users() {
  var template = document.querySelector("#user_template");
  var parent = template.parentElement;
  parent.removeChild(template);

  for (var i = 0; i < lightdm.users.length; i++) {
    var user = lightdm.users[i];
    var userNode = template.cloneNode(true);

    var image = userNode.querySelector(".user_image");
    var name = userNode.querySelector(".user_name");
    name.innerHTML = user.display_name;

    if (user.image) {
      image.src = user.image;
      image.onerror = on_image_error;
    } else {
      image.src = "resources/img/avatar.svg";
    }

    userNode.id = user.name;
    userNode.onclick = user_clicked;
    parent.appendChild(userNode);
  }

  if (lightdm.has_guest_account) {
    var guestNode = template.cloneNode(true);
    var guestImage = guestNode.querySelector(".user_image");
    var guestName = guestNode.querySelector(".user_name");
    guestImage.src = "resources/img/avatar.svg";
    guestName.innerHTML = "Guest";
    guestNode.id = "__guest__";
    guestNode.onclick = function(event) {
      show_message("Logging in as guest...");
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
  setInterval(update_time, 1000);
}
