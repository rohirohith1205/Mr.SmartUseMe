const API_URL = "http://localhost:5000/predict";
const CONFIDENCE_THRESHOLD = 0.35;

window.WASTE_TYPES = {
    'Aluminium foil': { type: 'Recyclable', action: 'Metal Recycling', color: '#00ff9d' },
    'Bottle cap': { type: 'Recyclable', action: 'Metal Recycling', color: '#00ff9d' },
    'Can': { type: 'Recyclable', action: 'Metal Recycling', color: '#00ff9d' },
    'Pop tab': { type: 'Recyclable', action: 'Metal Recycling', color: '#00ff9d' },
    'Broken glass': { type: 'Hazardous', action: 'Glass Waste Bin', color: '#ef4444' },
    'Bottle': { type: 'Recyclable', action: 'Plastic Recycling', color: '#00ff9d' },
    'Cup': { type: 'Recyclable', action: 'Plastic Recycling', color: '#00ff9d' },
    'Lid': { type: 'Recyclable', action: 'Plastic Recycling', color: '#00ff9d' },
    'Other plastic': { type: 'Recyclable', action: 'Plastic Recycling', color: '#00ff9d' },
    'Plastic container': { type: 'Recyclable', action: 'Plastic Recycling', color: '#00ff9d' },
    'Plastic bag - wrapper': { type: 'Trash', action: 'General Waste', color: '#6b7280' },
    'Straw': { type: 'Trash', action: 'General Waste', color: '#6b7280' },
    'Styrofoam piece': { type: 'Trash', action: 'General Waste', color: '#6b7280' },
    'Carton': { type: 'Recyclable', action: 'Paper Recycling', color: '#00ff9d' },
    'Paper': { type: 'Recyclable', action: 'Paper Recycling', color: '#00ff9d' },
    'Cigarette': { type: 'Hazardous', action: 'Hazardous Waste', color: '#f59e0b' },
    'Other litter': { type: 'Trash', action: 'General Waste', color: '#6b7280' },
    'Unlabeled litter': { type: 'Trash', action: 'General Waste', color: '#6b7280' },
};

const video = document.getElementById('live-video');
const detectionBox = document.getElementById('detection-box');
const detectionLabel = document.getElementById('detection-label');
const detItemName = document.getElementById('det-item-name');
const detItemType = document.getElementById('det-item-type');
const detConfBar = document.getElementById('det-conf-bar');
const detConfText = document.getElementById('det-conf-text');
const detStatus = document.getElementById('det-status');
const detAction = document.getElementById('det-action');
const statSpeed = document.getElementById('stat-speed');

let lastDispatchedClass = null;
let backendOK = false;
let fpsInterval = null;
let frameCount = 0;
let lastFpsTime = performance.now();
let streamRef = null;
let isCameraRunning = false;

async function setupCamera() {
    streamRef = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
    });

    video.srcObject = streamRef;
    isCameraRunning = true;

    await video.play();
}

async function checkBackend() {
    try {
        const res = await fetch("http://localhost:5000/");
        return res.ok;
    } catch {
        return false;
    }
}

async function startDetection() {
    if (isCameraRunning) return;

    try {
        await setupCamera();

        const available = await checkBackend();
        if (!available) {
            detItemName.innerText = "Backend Offline";
            return;
        }

        backendOK = true;
        updateStatus("Scanning...");
        detectFrame();
        startFpsCounter();

    } catch (err) {
        console.error(err);
        detItemName.innerText = "Camera Failed";
    }
}

function stopCamera() {
    if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop());
        streamRef = null;
    }

    video.srcObject = null;
    isCameraRunning = false;
    backendOK = false;

    if (fpsInterval) clearInterval(fpsInterval);

    detectionBox.classList.add("hidden");
    updateStatus("Stopped");
    detItemName.innerText = "Camera Stopped";
}

function startFpsCounter() {
    fpsInterval = setInterval(() => {
        const now = performance.now();
        const fps = Math.round(frameCount / ((now - lastFpsTime) / 1000));
        statSpeed.innerText = `${fps} FPS`;
        frameCount = 0;
        lastFpsTime = now;
    }, 1000);
}

async function detectFrame() {
    if (!backendOK || !isCameraRunning) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
        try {
            const formData = new FormData();
            formData.append("frame", blob, "frame.jpg");

            const res = await fetch(API_URL, {
                method: "POST",
                body: formData
            });

            const detections = await res.json();
            frameCount++;

            if (detections.length > 0) {
                const best = detections[0];
                renderPrediction(best.bbox, best.confidence, best.class);
            }

        } catch (err) {
            console.error(err);
        }

        requestAnimationFrame(detectFrame);
    }, "image/jpeg");
}

function renderPrediction(bbox, score, className) {
    const [x, y, w, h] = bbox;

    detectionBox.style.left = `${x}px`;
    detectionBox.style.top = `${y}px`;
    detectionBox.style.width = `${w}px`;
    detectionBox.style.height = `${h}px`;
    detectionBox.classList.remove("hidden");

    const percent = Math.round(score * 100);
    detectionLabel.innerText = `${className} • ${percent}%`;

    const info = window.WASTE_TYPES[className];
    detItemName.innerText = className;
    detItemType.innerText = info?.type || "Unknown";
    detConfText.innerText = `${percent}%`;
    detConfBar.style.width = `${percent}%`;
    detAction.innerText = info?.action || "Analyze";
}

function updateStatus(text) {
    detStatus.innerText = text;
}

window.startDetection = startDetection;
window.stopCamera = stopCamera;

updateStatus("Idle");
detItemName.innerText = "Click Start Detection";
detItemType.innerText = "Waiting";