# lightdm-web-osx-greeter

Simple modification of the theme i forked to upgrade it to newer versions, and make it more acurrate.
Based on ZoomTen/lightdm-webkit-theme-macos, with a few tweaks to make it more Mac-like and compatible with newer greeters.

Didn't really feel like writing a readme ngl

Here's a screen btw
![screenshot](https://i.imgur.com/lrHt1it.png)

# Installation

1. Git clone this theme to `/usr/share/lightdm-web-greeter/themes`

2. Install the LucidaGrande font by running the install script (requires sudo):
```bash
sudo ./install-font.sh
```

3. Set this theme as the default in `/etc/lightdm/lightdm-web-greeter.conf`

That's it!
