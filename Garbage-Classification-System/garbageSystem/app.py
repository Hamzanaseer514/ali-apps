import os
from pathlib import Path

import numpy as np
from flask import Flask, jsonify, request
from PIL import Image
from tensorflow.keras.models import load_model

# Reduce TensorFlow's verbose logging; adjust or remove if detailed logs are needed.
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

OUTPUT_CLASSES = [
    "battery",
    "biological",
    "brown-glass",
    "cardboard",
    "clothes",
    "green-glass",
    "metal",
    "paper",
    "plastic",
    "shoes",
    "trash",
    "white-glass",
]

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "predictWaste12.h5"

app = Flask(__name__)
model = load_model(MODEL_PATH)


def preprocess_image(file_stream):
    """Load, resize, and scale an uploaded image to match the model's expectations."""
    img = Image.open(file_stream).convert("RGB")
    img = img.resize((224, 224))
    array = np.asarray(img, dtype=np.float32) / 255.0
    array = np.expand_dims(array, axis=0)
    return array


@app.route("/", methods=["GET"])
def index():
    return {"Project is Running": "OK"}, 200

@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok"}


@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "Missing file under field 'image'"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    try:
        batch = preprocess_image(file.stream)
        preds = model.predict(batch)
        idx = int(np.argmax(preds, axis=1)[0])
        confidence = float(np.max(preds))
        response = {
            "label": OUTPUT_CLASSES[idx],
            "confidence": round(confidence, 4),
            "confidence_percent": round(confidence * 100, 2),
        }
        return jsonify(response)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)

