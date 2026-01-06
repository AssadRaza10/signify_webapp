#!/bin/bash
# Robust startup: find the directory that contains app.py (if any), cd into it,
# ensure it's on PYTHONPATH, then run gunicorn. This avoids "No module named 'app'"
# when the repo is deployed into a nested folder by the deployment pipeline.

set -e

ROOT_DIR="$(pwd)"
APP_DIR=""

if [ -f "$ROOT_DIR/app.py" ]; then
	APP_DIR="$ROOT_DIR"
else
	# search up to depth 3 for app.py
	APP_DIR="$(find "$ROOT_DIR" -maxdepth 3 -type f -name app.py -printf '%h\n' | head -n 1)"
fi

if [ -z "$APP_DIR" ]; then
	echo "ERROR: could not find app.py in repository root or subfolders"
	echo "Listing files for diagnosis:"
	ls -la "$ROOT_DIR"
	exit 1
fi

echo "Starting app from: $APP_DIR"
cd "$APP_DIR"
export PYTHONPATH="$APP_DIR:$PYTHONPATH"

# Execute gunicorn (replace module:app if your entrypoint differs)
exec gunicorn app:app --bind=0.0.0.0:8000 --timeout 300
