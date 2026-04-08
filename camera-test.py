from ultralytics import YOLO
import cv2

model = YOLO("best.pt")

# use DroidCam virtual webcam
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("❌ Could not open DroidCam camera")
    exit()

while True:
    ret, frame = cap.read()
    if not ret:
        print("❌ No frame")
        break

    results = model(frame, conf=0.4)
    annotated = results[0].plot()

    cv2.imshow("Live Garbage Detection", annotated)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()