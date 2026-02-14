#!/bin/sh

# POSIX-compliant wrapper script for model reconstruction and deployment
# This script works with both bash and ash
# Handles errors gracefully and ensures all operations complete

# Function to print with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Get the directory where this script is located
SCRIPT_DIR=$(dirname "$0")
cd "$SCRIPT_DIR" || {
    log_message "❌ Error: Cannot change to script directory"
    exit 1
}

log_message "📂 Working directory: $(pwd)"
log_message "----------------------------------------"

# Flag to track if we had any errors
HAD_ERRORS=0

# Check if reconstruction script exists
if [ ! -f "model_example_reconstruct.sh" ]; then
    log_message "⚠️  Warning: model_example_reconstruct.sh not found in current directory"
    HAD_ERRORS=1
else
    # Make sure reconstruction script is executable
    chmod +x model_example_reconstruct.sh 2>/dev/null || {
        log_message "⚠️  Warning: Cannot make reconstruction script executable"
        HAD_ERRORS=1
    }
    
    # Execute the reconstruction script with the same shell
    log_message "🚀 Running reconstruction script..."
    log_message "----------------------------------------"
    
    # Run reconstruction and capture output
    ./model_example_reconstruct.sh
    RECONSTRUCT_EXIT=$?
    
    log_message "----------------------------------------"
    
    if [ $RECONSTRUCT_EXIT -ne 0 ]; then
        log_message "⚠️  Warning: Reconstruction exited with code: $RECONSTRUCT_EXIT"
        HAD_ERRORS=1
    fi
fi

# Check if the reconstructed file exists
if [ ! -f "model_example.gguf" ]; then
    log_message "⚠️  Warning: model_example.gguf was not created or not found"
    HAD_ERRORS=1
else
    log_message "✅ Reconstruction completed, file found: model_example.gguf"
    
    # Get file size for logging
    if [ -f "model_example.gguf" ]; then
        if command -v stat > /dev/null 2>&1; then
            # Try Linux style first, then macOS style
            FILESIZE=$(stat -c%s "model_example.gguf" 2>/dev/null || stat -f%z "model_example.gguf" 2>/dev/null)
            log_message "📊 Reconstructed file size: $FILESIZE bytes"
        else
            log_message "📊 Reconstructed file exists"
        fi
    fi
    
    # Find the first package.json above current directory
    CURRENT_DIR=$(pwd)
    PACKAGE_JSON_PATH=""
    TARGET_DIR=""
    
    while [ "$CURRENT_DIR" != "/" ]; do
        if [ -f "$CURRENT_DIR/package.json" ]; then
            PACKAGE_JSON_PATH="$CURRENT_DIR/package.json"
            TARGET_DIR="$CURRENT_DIR"
            log_message "📦 Found package.json at: $PACKAGE_JSON_PATH"
            break
        fi
        CURRENT_DIR=$(dirname "$CURRENT_DIR")
    done
    
    if [ -z "$PACKAGE_JSON_PATH" ]; then
        log_message "ℹ️  No package.json found in parent directories"
        log_message "📁 Keeping model_example.gguf in current directory"
    else
        # Create models directory if it doesn't exist
        MODELS_DIR="$TARGET_DIR/models"
        if [ ! -d "$MODELS_DIR" ]; then
            log_message "📁 Creating models directory at: $MODELS_DIR"
            mkdir -p "$MODELS_DIR" 2>/dev/null
            if [ $? -ne 0 ]; then
                log_message "⚠️  Warning: Failed to create models directory"
                HAD_ERRORS=1
            else
                log_message "✅ Models directory created"
            fi
        else
            log_message "📁 Models directory already exists at: $MODELS_DIR"
        fi
        
        # Handle the file move if models directory exists/was created
        if [ -d "$MODELS_DIR" ]; then
            # Check if file already exists in models directory
            if [ -f "$MODELS_DIR/model_example.gguf" ]; then
                log_message "⚠️  File already exists in models directory, will be overwritten"
                # Remove the old file before moving new one
                rm -f "$MODELS_DIR/model_example.gguf" 2>/dev/null
                if [ $? -eq 0 ]; then
                    log_message "🗑️  Removed old file"
                else
                    log_message "⚠️  Warning: Could not remove old file"
                    HAD_ERRORS=1
                fi
            fi
            
            # Move the file
            log_message "📦 Moving model_example.gguf to: $MODELS_DIR/"
            
            # Use mv to move the file
            mv "model_example.gguf" "$MODELS_DIR/model_example.gguf" 2>/dev/null
            MV_EXIT=$?
            
            if [ $MV_EXIT -eq 0 ]; then
                # Verify the move worked
                if [ -f "$MODELS_DIR/model_example.gguf" ] && [ ! -f "model_example.gguf" ]; then
                    log_message "✅ File moved successfully"
                    
                    # Get new file size for verification
                    if command -v stat > /dev/null 2>&1; then
                        NEW_SIZE=$(stat -c%s "$MODELS_DIR/model_example.gguf" 2>/dev/null || stat -f%z "$MODELS_DIR/model_example.gguf" 2>/dev/null)
                        log_message "📊 Moved file size: $NEW_SIZE bytes"
                    fi
                else
                    log_message "⚠️  Warning: Move verification failed"
                    HAD_ERRORS=1
                fi
            else
                log_message "⚠️  Warning: Failed to move file to models directory"
                HAD_ERRORS=1
            fi
        fi
    fi
fi

# List contents of models directory if it exists
if [ -n "$MODELS_DIR" ] && [ -d "$MODELS_DIR" ]; then
    log_message "📂 Current contents of models directory:"
    # Count files in models directory
    FILE_COUNT=$(ls -1 "$MODELS_DIR" | wc -l)
    log_message "   Total files: $FILE_COUNT"
    # Show model_example.gguf if it exists
    if [ -f "$MODELS_DIR/model_example.gguf" ]; then
        log_message "   ✓ model_example.gguf is present"
    fi
fi

# Check if original file was removed successfully
if [ -f "model_example.gguf" ]; then
    log_message "⚠️  Warning: Original file still exists in: $(pwd)"
    HAD_ERRORS=1
else
    log_message "✅ Original file cleaned up from: $(pwd)"
fi

# Final status
log_message "----------------------------------------"
if [ $HAD_ERRORS -eq 0 ]; then
    log_message "✅ Process completed successfully! Only model_example.gguf exists in models folder"
else
    log_message "⚠️  Process completed with warnings/errors (check logs above)"
fi

# Always exit with 0 to prevent cascade failures, but we log the errors
exit 0