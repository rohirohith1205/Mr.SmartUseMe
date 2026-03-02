**MR.SmartUSEME**
AI-Powered Smart Waste Classification System

MR.SmartUSEME is a real-time smart waste classification system powered by a custom-trained YOLOv8 object detection model. The system continuously processes live webcam input and detects waste items, classifying them into predefined waste categories.

**Features**
Continuous live webcam feed
Real-time object detection using YOLOv8
Bounding box visualization with confidence score
Waste type classification (Recyclable, Organic, E-Waste, Trash)
CPU-friendly real-time inference
Desktop-based prototype implementation

**Model Details**
Model: YOLOv8 (Ultralytics)
Dataset: TACO (Trash Annotations in Context)
Trained Model: best.pt
Inference Engine: Ultralytics + OpenCV

**Technology Stack**
Python
OpenCV
Ultralytics YOLOv8
Flask (for backend API mode)
JavaScript (for browser-based frontend, if applicable)

**Installation and Setup**
1. Install dependencies
pip install -r requirements.txt

3. Start backend (if using API mode)
python app.py

5. Start frontend
Using Node:
npx live-server
Or using Python:
python -m http.server

**Objective**

The objective of this project is to develop an intelligent automated waste classification system that supports smart recycling initiatives and promotes environmental sustainability using computer vision and deep learning.

**Current Version**
Continuous real-time detection
Live bounding box overlay
Confidence scoring
Future upgrades may include a human feedback loop and model fine-tuning pipeline.
