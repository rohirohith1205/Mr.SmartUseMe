from ultralytics import YOLO

# Load base pretrained YOLO model
model = YOLO("yolov8n.pt")

# Train on your garbage dataset
model.train(
    data="garbage-dataset/data.yaml",
    epochs=50,
    imgsz=640,
    batch=8
)