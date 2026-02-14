#!/bin/sh

# POSIX-compliant reconstruction script for model_example.gguf
# Total parts: 63
# Original file hash: 2f82233630c349ccf6b8daccf48f9a7865713d9f08a2eadfa456cebe9b97c7f5

echo "🔧 Starting reconstruction of model_example.gguf from 63 parts..."
echo "----------------------------------------"

# Check if all parts exist
MISSING_FILES=0
i=1
while [ $i -le 63 ]; do
    # Format with leading zeros (3 digits)
    if [ $i -lt 10 ]; then
        PART_FILE="model_example.part.00$i.gguf"
    elif [ $i -lt 100 ]; then
        PART_FILE="model_example.part.0$i.gguf"
    else
        PART_FILE="model_example.part.$i.gguf"
    fi
    
    if [ ! -f "$PART_FILE" ]; then
        echo "❌ Missing part: $PART_FILE"
        MISSING_FILES=1
    fi
    i=$((i + 1))
done

if [ $MISSING_FILES -eq 1 ]; then
    echo "❌ Error: Some parts are missing. Please ensure all part files are in the current directory."
    exit 1
fi

echo "✅ All parts found"

# Reconstruct the file
echo "🔄 Reconstructing file..."
# Ensure output file is empty
> model_example.gguf

i=1
while [ $i -le 63 ]; do
    # Format with leading zeros (3 digits)
    if [ $i -lt 10 ]; then
        PART_FILE="model_example.part.00$i.gguf"
    elif [ $i -lt 100 ]; then
        PART_FILE="model_example.part.0$i.gguf"
    else
        PART_FILE="model_example.part.$i.gguf"
    fi
    
    echo "   Adding part $i/63: $PART_FILE"
    cat "$PART_FILE" >> model_example.gguf
    i=$((i + 1))
done

echo "✅ Reconstruction complete!"

# Verify the reconstructed file
echo "🔍 Verifying file integrity..."

# Calculate hash of reconstructed file - POSIX compatible approach
if command -v sha256sum > /dev/null 2>&1; then
    RECONSTRUCTED_HASH=$(sha256sum model_example.gguf | cut -d' ' -f1)
elif command -v shasum > /dev/null 2>&1; then
    RECONSTRUCTED_HASH=$(shasum -a 256 model_example.gguf | cut -d' ' -f1)
else
    echo "⚠️  Warning: Cannot verify file hash (sha256sum/shasum not found)"
    RECONSTRUCTED_HASH="unknown"
fi

EXPECTED_HASH="2f82233630c349ccf6b8daccf48f9a7865713d9f08a2eadfa456cebe9b97c7f5"

if [ "$RECONSTRUCTED_HASH" = "$EXPECTED_HASH" ]; then
    echo "✅ Hash verification successful! File is intact."
else
    echo "⚠️  Warning: Hash mismatch! The reconstructed file may be corrupted."
    echo "   Expected: $EXPECTED_HASH"
    echo "   Got:      $RECONSTRUCTED_HASH"
fi

# Display file info - POSIX compatible approach
if [ -f "model_example.gguf" ]; then
    # Try different stat commands for different systems
    if command -v stat > /dev/null 2>&1; then
        # Linux style
        FILESIZE=$(stat -c%s "model_example.gguf" 2>/dev/null || stat -f%z "model_example.gguf" 2>/dev/null)
    else
        # Fallback to ls
        FILESIZE=$(ls -l "model_example.gguf" | awk '{print $5}')
    fi
    echo "📊 File size: $FILESIZE bytes"
else
    echo "📊 File size: unknown (file not found)"
fi
echo "📁 Output file: model_example.gguf"

echo "----------------------------------------"
echo "✨ Done!"