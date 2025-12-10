import os
from flask import Flask, request, jsonify
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from PIL import Image
import io

app = Flask(__name__)

# Load model and labels
model_path = "models/road_conditions_alexnet_3875.h5"
labels_path = "models/road_labels.npy"

model = load_model(model_path)
class_names = np.load(labels_path)

# Set image size to match training
SIZE = 128  # or 256 if that was used

def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = img.resize((SIZE, SIZE))
    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)  # batch dimension
    return img_array

@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    img_array = preprocess_image(file.read())

    # Predict
    preds = model.predict(img_array)
    class_idx = int(np.argmax(preds, axis=1)[0])
    confidence = float(np.max(preds))
    result = {
        "predicted_class": class_names[class_idx],
        "confidence": confidence
    }
    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
