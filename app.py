import os
import base64
import threading
import uuid
import time
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import numpy as np
from tensorflow import keras
from gtts import gTTS
import joblib
import traceback
import csv
import functools

# ================= CONFIG =================
ROOT = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(ROOT, "model")

MODEL_PATH = os.path.join(MODEL_DIR, "model.h5")
LABEL_ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoder.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")

AUDIO_FOLDER = os.path.join(ROOT, "frontend", "static", "audio")
os.makedirs(AUDIO_FOLDER, exist_ok=True)

# ================= FLASK APP =================
app = Flask(
    __name__,
    template_folder="frontend",
    static_folder="frontend/static"
)
CORS(app)

# ================= LOAD MODEL =================
model = None
label_encoder = None
scaler = None

try:
    model = keras.models.load_model(MODEL_PATH)
    label_encoder = joblib.load(LABEL_ENCODER_PATH)
    scaler = joblib.load(SCALER_PATH)
    print("✅ Model, encoder, scaler loaded")
except Exception as e:
    print("⚠️ Model loading failed:", e)

# ================= LOAD URDU DICTIONARY =================
urdu_dict = []
try:
    with open(os.path.join(ROOT, "urdu_words.csv"), encoding="utf-8") as f:
        reader = csv.reader(f)
        urdu_dict = [row[0] for row in reader if row]
except Exception:
    pass

# ================= STATE MANAGEMENT =================
state_lock = threading.Lock()
states = {}

def get_state(sid):
    with state_lock:
        if sid not in states:
            states[sid] = {
                "current_word": "",
                "urdu_sentence": [],
                "last_seen": datetime.utcnow()
            }
        return
