"""
yolo_api.py — YOLOv8 Flask backend for MR.SmartUSEME
Serves predictions from best.pt over HTTP for the browser UI.

Run with:
    python yolo_api.py
"""

from ultralytics import YOLO
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import os
import sys

# ── Load model ──────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "best.pt")

if not os.path.exists(MODEL_PATH):
    print(f"[ERROR] Model not found at: {MODEL_PATH}")
    sys.exit(1)

print(f"[INFO] Loading YOLO model from {MODEL_PATH} ...")
model = YOLO(MODEL_PATH)
print(f"[INFO] Model loaded. Classes: {list(model.names.values())}")

# ── Flask app ────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)   # Allow requests from the browser (localhost HTML file)

CONFIDENCE_THRESHOLD = 0.4
MAX_DETECTIONS = 10

# ── Health check ─────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": "best.pt",
        "classes": list(model.names.values()),
        "confidence_threshold": CONFIDENCE_THRESHOLD
    })

# ── Prediction endpoint ──────────────────────────────────────────
@app.route("/predict", methods=["POST"])
def predict():
    # Validate request
    if "frame" not in request.files:
        return jsonify({"error": "No frame provided"}), 400

    try:
        file_bytes = request.files["frame"].read()
        npimg = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

        if img is None:
            return jsonify({"error": "Could not decode image"}), 400

    except Exception as e:
        return jsonify({"error": f"Image decoding failed: {str(e)}"}), 400

    # Run inference
    try:
        results = model(img, conf=CONFIDENCE_THRESHOLD, verbose=False)
    except Exception as e:
        return jsonify({"error": f"Inference failed: {str(e)}"}), 500

    # Parse detections — sorted by confidence (highest first)
    detections = []
    boxes = results[0].boxes

    if boxes is not None and len(boxes) > 0:
        # Sort by confidence descending
        confs = boxes.conf.tolist()
        sorted_indices = sorted(range(len(confs)), key=lambda i: confs[i], reverse=True)

        for idx in sorted_indices[:MAX_DETECTIONS]:
            cls   = int(boxes.cls[idx])
            label = model.names[cls]
            conf  = float(boxes.conf[idx])
            x1, y1, x2, y2 = boxes.xyxy[idx].tolist()

            detections.append({
                "class":      label,
                "confidence": round(conf, 4),
                "bbox":       [round(x1), round(y1), round(x2 - x1), round(y2 - y1)]
            })

    return jsonify(detections)

# ── Entry point ──────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n[INFO] MR.SmartUSEME API running at http://localhost:{port}")
    print(f"[INFO] Health check: http://localhost:{port}/")
    print(f"[INFO] Open index.html in your browser to start detection.\n")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)