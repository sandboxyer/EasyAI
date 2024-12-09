#!/bin/bash

# Configuration
REPO_DIR=$(pwd)
FOLDER_NAME=$(basename "$REPO_DIR")
INSTALL_DIR="/usr/local/etc/$FOLDER_NAME" # Installation folder named after the current directory
BIN_DIR="/usr/local/bin"
DEB_DIR="$REPO_DIR/core/upack" # Directory containing .deb files

# Commands to create symbolic links
declare -A COMMANDS=(
  ["core/Flash/WebGPTFlash.js"]="webgpt"
  ["core/Flash/GenerateFlash.js"]="generate"
  ["core/Flash/ChatFlash.js"]="chat"
  ["core/MenuCLI/MenuCLI.js"]="ai"
)

# Function to install .deb packages
install_debs() {
  if [[ -d "$DEB_DIR" ]]; then
    local deb_files=("$DEB_DIR"/*.deb)
    if [[ ${#deb_files[@]} -gt 0 ]]; then
      echo "Installing .deb packages from $DEB_DIR..."
      sudo dpkg -i "$DEB_DIR"/*.deb
      echo ".deb installation completed."
    else
      echo "No .deb files found in $DEB_DIR. Skipping .deb installation."
    fi
  else
    echo "The .deb directory ($DEB_DIR) does not exist. Skipping .deb installation."
  fi
}

# Function to copy files
copy_files() {
  local src_dir="$1"
  local dest_dir="$2"

  if [[ -f "$src_dir/.gitignore" ]]; then
    mapfile -t ignore_patterns < "$src_dir/.gitignore"
  else
    ignore_patterns=()
  fi

  for file in "$src_dir"/*; do
    relative_path="${file#$src_dir/}"
    if [[ ! " ${ignore_patterns[*]} " =~ " $relative_path " ]]; then
      if [[ -d "$file" ]]; then
        mkdir -p "$dest_dir/$relative_path"
        copy_files "$file" "$dest_dir/$relative_path"
      else
        cp "$file" "$dest_dir/$relative_path"
      fi
    fi
  done
}

# Function to remove symbolic links
remove_links() {
  for dest in "${COMMANDS[@]}"; do
    dest_path="$BIN_DIR/$dest"
    if [[ -L "$dest_path" ]]; then
      echo "Removing symbolic link: $dest_path"
      rm "$dest_path"
    else
      echo "Symbolic link not found: $dest_path"
    fi
  done
}

# Install .deb packages
install_debs

# Check if the installation directory already exists
if [[ -d "$INSTALL_DIR" ]]; then
  echo "The folder '$FOLDER_NAME' already exists. Choose an option:"
  echo "1. Update (replace existing files)"
  echo "2. Remove (delete the existing folder and symbolic links)"
  echo "3. Exit (cancel setup)"

  read -p "Enter your choice (1/2/3): " choice
  case "$choice" in
    1)
      echo "Updating the existing installation..."
      remove_links
      rm -rf "$INSTALL_DIR"
      ;;
    2)
      echo "Removing the existing folder and symbolic links..."
      remove_links
      rm -rf "$INSTALL_DIR"
      echo "Folder and symbolic links removed. Setup cancelled."
      exit 0
      ;;
    3)
      echo "Setup cancelled."
      exit 0
      ;;
    *)
      echo "Invalid choice. Setup cancelled."
      exit 1
      ;;
  esac
fi

# Proceed with global installation
echo "Creating installation directory..."
mkdir -p "$INSTALL_DIR"

echo "Copying files..."
copy_files "$REPO_DIR" "$INSTALL_DIR"

for src in "${!COMMANDS[@]}"; do
  src_path="$INSTALL_DIR/$src"
  dest_path="$BIN_DIR/${COMMANDS[$src]}"

  echo "Creating symbolic link for ${COMMANDS[$src]}..."
  [[ -L "$dest_path" ]] && rm "$dest_path"
  ln -s "$src_path" "$dest_path"

  echo "Making $src executable..."
  chmod 755 "$src_path"
done

echo "Setup complete. You can now use the commands globally."
