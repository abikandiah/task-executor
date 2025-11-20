#!/bin/bash

IMAGE_NAME="task-executor"

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Stage 0: Version Extraction ---
# Use '|| true' to let Bash continue even if 'git describe' exits with an error (e.g., no tags).
PROJECT_VERSION=$(git describe --tags --abbrev=0 2>/dev/null || true)

# Check if the Git command returned an empty string.
if [ -z "$PROJECT_VERSION" ]; then
    echo "No Git tag found. Falling back to package.json version."
    
    # Extract version from package.json
    PROJECT_VERSION=$(grep '"version":' package.json | sed -E 's/.*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/')
    
    # Final check: if version is still empty, something is wrong.
    if [ -z "$PROJECT_VERSION" ]; then
        echo "❌ FATAL: Could not determine project version from package.json. Please check the file."
        exit 1
    fi
fi

IMAGE_TAG="$PROJECT_VERSION"

echo "=========================================="
echo "🚀 Starting Local CI Pipeline (Version: $IMAGE_TAG)"
echo "=========================================="
echo ""

# --- Stage 1: Testing ---
# echo "--- Stage 1: Running Unit Tests (npm test) ---"

# if npm test; then
#     echo "Tests Passed Successfully."
# else
#     echo "❌ Tests Failed. Aborting Build Stage."
#     exit 1
# fi
# echo ""

# --- Stage 2: Build UI ---
echo "--- Stage 2: Building UI (npm run build) ---"
if npm run build:sync-ui; then
	echo "UI Built Successfully."
	rsync -av --delete dist/ ../task-executor/src/ui-build/
	echo "UI Build Copied Into Server."
else
	echo "❌ UI Build Failed. Aborting Build Stage."
	exit 1
fi
echo ""

# --- Stage 3: Build Server ---
echo "--- Stage 3: Building Server (npm run build) ---"
if npm run build; then
	echo "Server Built Successfully."
else
	echo "❌ Server Build Failed. Aborting Build Stage."
	exit 1
fi
echo ""

# --- Stage 4: Docker Build ---
echo "--- Stage 2: Building Docker Image ($IMAGE_NAME:$IMAGE_TAG) ---"

# NOTE: Prefix with 'sudo' if you haven't added your user to the 'docker' group (best practice)
if sudo docker build -t "$IMAGE_NAME:$IMAGE_TAG" .; then
    echo "✅ Docker Image Built Successfully: $IMAGE_NAME:$IMAGE_TAG"
else
    echo "❌ Docker Build Failed. Review Dockerfile and logs."
    exit 1
fi
echo ""


echo "=========================================="
echo "Pipeline COMPLETE."
echo "To run the container: docker run -d -p 8080:3000 $IMAGE_NAME:$IMAGE_TAG"
echo "=========================================="
echo ""
