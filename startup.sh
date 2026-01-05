#!/bin/bash
# Run Gunicorn from repository root. Previous versions expected a `backend/` folder.
gunicorn app:app --bind=0.0.0.0:8000 --timeout 300
