#!/bin/sh
# Simple startup script for Azure App Service (Linux)
# Uses gunicorn to run the Flask app defined in backend.app

PORT=${PORT:-8000}
exec gunicorn backend.app:app --bind 0.0.0.0:${PORT} --workers 4
