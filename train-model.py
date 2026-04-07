from ultralytics import YOLO


def train():
    model = YOLO("yolov8n.pt")

    model.train(
        data="garbage-dataset/GARBAGE CLASSIFICATION/data.yaml",
        epochs=50,
        imgsz=640,
        batch=8,
        device=0,
        workers=0
    )


if __name__ == "__main__":
    train()