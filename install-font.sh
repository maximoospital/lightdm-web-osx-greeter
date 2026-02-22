#!/bin/bash

# Install LucidaGrande font for lightdm-web-osx-greeter
# Compatible with Arch Linux and other systemd-based distros

set -e

FONT_FILE="$(dirname "$0")/resources/font/LuGra.ttf"
FONT_NAME="LucidaGrande"

# Check if font file exists
if [ ! -f "$FONT_FILE" ]; then
    echo "Error: Font file not found at $FONT_FILE"
    exit 1
fi

echo "Installing $FONT_NAME font..."

# Determine system font directory
# Prefer /usr/share/fonts/truetype for user-installed fonts
FONT_DIR="/usr/share/fonts/truetype/custom"

# Create directory if it doesn't exist
if [ ! -d "$FONT_DIR" ]; then
    echo "Creating font directory: $FONT_DIR"
    sudo mkdir -p "$FONT_DIR"
fi

# Copy font to system directory
echo "Copying font to $FONT_DIR..."
sudo cp "$FONT_FILE" "$FONT_DIR/"

# Make sure permissions are correct
sudo chmod 644 "$FONT_DIR/$(basename "$FONT_FILE")"

# Rebuild font cache (works on Arch and most other distros)
if command -v fc-cache &> /dev/null; then
    echo "Rebuilding font cache..."
    sudo fc-cache -f -v
fi

echo "Font installation completed successfully!"
echo "The $FONT_NAME font is now available system-wide."

XSESSION_DIR="/usr/share/xsessions"
BASH_DESKTOP="$XSESSION_DIR/bash.desktop"
TERM_SCRIPT="/usr/local/bin/greeter-terminal"
XRESOURCES_DEST="/etc/X11/greeter-xterm.Xresources"

# Install xterm Xresources config
echo "Installing xterm config to $XRESOURCES_DEST..."
sudo cp "$(dirname "$0")/resources/xterm.Xresources" "$XRESOURCES_DEST"
sudo chmod 644 "$XRESOURCES_DEST"

# Create a launcher script using xterm (standard X11 terminal)
echo "Creating terminal launcher at $TERM_SCRIPT..."
sudo tee "$TERM_SCRIPT" > /dev/null <<SCRIPT
#!/bin/bash
xrdb -merge "$XRESOURCES_DEST"
exec xterm -maximized -e /usr/bin/bash --login
SCRIPT
sudo chmod 755 "$TERM_SCRIPT"

if [ ! -f "$BASH_DESKTOP" ]; then
    echo ""
    echo "Creating bash xsession entry..."
    sudo mkdir -p "$XSESSION_DIR"
    sudo tee "$BASH_DESKTOP" > /dev/null <<EOF
[Desktop Entry]
Name=Terminal
Comment=Log in to terminal
Exec=$TERM_SCRIPT
Type=Application
EOF
    sudo chmod 644 "$BASH_DESKTOP"
    echo "Bash xsession created at $BASH_DESKTOP"
else
    echo "Bash xsession already exists at $BASH_DESKTOP — updating Exec line..."
    sudo sed -i "s|^Exec=.*|Exec=$TERM_SCRIPT|" "$BASH_DESKTOP"
    echo "Updated $BASH_DESKTOP"
fi
