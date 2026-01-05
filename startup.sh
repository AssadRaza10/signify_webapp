#!/bin/bash
cd backend
gunicorn app:app --bind=0.0.0.0:8000 --timeout 300
