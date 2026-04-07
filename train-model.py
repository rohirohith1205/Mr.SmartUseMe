from ultralytics import YOLO

# Load base pretrained YOLO model
model = YOLO("yolov8n.pt")

# Train on your garbage dataset
model.train(
    data="garbage-dataset/GARBAGE CLASSIFICATION/data.yaml",
    epochs=50,
    imgsz=640,
    batch=8,
    device=0,  
    workers=0,
)

if __name__ == "__main__":
    train()