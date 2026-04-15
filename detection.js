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

let backendOK = false;
let fpsInterval = null;
let frameCount = 0;
let lastFpsTime = performance.now();
let streamRef = null;
let isCameraRunning = false;

// ── Object Tracking (Deduplication) ───────────────────
let trackedObjects = []; // [{ className, bboxCenter, lastSeen, id, countedAsNew }]
const TRACKING_TIMEOUT = 2000; // ms - forget item if not seen for 2 sec
const MATCH_THRESHOLD = 60; // px - distance threshold for same object

function generateObjectId(className, bboxCenter) {
    return `${className}_${Math.round(bboxCenter.x / 20)}_${Math.round(bboxCenter.y / 20)}`;
}

function getBboxCenter(bbox) {
    const [x, y, w, h] = bbox;
    return { x: x + w / 2, y: y + h / 2 };
}

function distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function findMatchingTrackedObject(className, bboxCenter) {
    // Check if this detection matches any recently tracked object of same class
    for (let obj of trackedObjects) {
        if (obj.className === className) {
            const dist = distance(obj.bboxCenter, bboxCenter);
            if (dist < MATCH_THRESHOLD) {
                return obj;
            }
        }
    }
    return null;
}

function cleanupOldTracks() {
    const now = Date.now();
    trackedObjects = trackedObjects.filter(obj => {
        return (now - obj.lastSeen) < TRACKING_TIMEOUT;
    });
}

function trackDetection(className, bbox) {
    const bboxCenter = getBboxCenter(bbox);
    const objectId = generateObjectId(className, bboxCenter);
    
    // Check if this is a known object
    let existing = findMatchingTrackedObject(className, bboxCenter);
    
    if (existing) {
        // Update existing track
        existing.lastSeen = Date.now();
        existing.bboxCenter = bboxCenter;
        return existing; // Return the tracked object
    } else {
        // New object detected
        const newTrack = {
            className,
            bboxCenter,
            id: objectId,
            lastSeen: Date.now(),
            countedAsNew: false // Will be set to true when we dispatch event
        };
        trackedObjects.push(newTrack);
        return newTrack; // Return the new tracked object
    }
}

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
            detItemType.innerText = "Start Flask server";
            return;
        }

        backendOK = true;
        updateStatus("Scanning...");
        detItemName.innerText = "Scanning...";
        detItemType.innerText = "YOLO Active";
        startFpsCounter();
        detectFrame();
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
    
    // Clear tracked objects
    trackedObjects = [];

    if (fpsInterval) {
        clearInterval(fpsInterval);
        fpsInterval = null;
    }

    detectionBox.classList.add("hidden");
    updateStatus("Stopped");
    detItemName.innerText = "Camera Stopped";
    detItemType.innerText = "Waiting";
}

function startFpsCounter() {
    if (fpsInterval) clearInterval(fpsInterval);

    fpsInterval = setInterval(() => {
        const now = performance.now();
        const elapsed = (now - lastFpsTime) / 1000;
        const fps = elapsed > 0 ? Math.round(frameCount / elapsed) : 0;
        statSpeed.innerText = `${fps} FPS`;
        frameCount = 0;
        lastFpsTime = now;
    }, 1000);
}

async function detectFrame() {
    if (!backendOK || !isCameraRunning) return;
    if (video.readyState < 2) {
        requestAnimationFrame(detectFrame);
        return;
    }

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
            
            // Cleanup old tracks periodically
            cleanupOldTracks();

            if (detections.length > 0) {
                const best = detections[0];
                if (best.confidence >= CONFIDENCE_THRESHOLD) {
                    // Track this detection and get the tracked object
                    const trackedObj = trackDetection(best.class, best.bbox);
                    const isNewDetection = !trackedObj.countedAsNew;
                    renderPrediction(best.bbox, best.confidence, best.class, isNewDetection, trackedObj);
                }
            }
        } catch (err) {
            console.error(err);
        }

        requestAnimationFrame(detectFrame);
    }, "image/jpeg", 0.8);
}

function renderPrediction(bbox, score, className, isNewDetection, trackedObj) {
    const [x, y, w, h] = bbox;

    const scaleX = video.clientWidth / video.videoWidth;
    const scaleY = video.clientHeight / video.videoHeight;

    detectionBox.style.left = `${x * scaleX}px`;
    detectionBox.style.top = `${y * scaleY}px`;
    detectionBox.style.width = `${w * scaleX}px`;
    detectionBox.style.height = `${h * scaleY}px`;
    detectionBox.classList.remove("hidden");

    const percent = Math.round(score * 100);
    detectionLabel.innerText = `${className} • ${percent}%`;

    const info = window.WASTE_TYPES[className] || {
        type: "Unknown",
        action: "Analyze",
        color: "#9ca3af"
    };

    detItemName.innerText = className;
    detItemType.innerText = info.type;
    detConfText.innerText = `${percent}%`;
    detConfBar.style.width = `${percent}%`;
    detConfBar.style.backgroundColor = info.color;
    detAction.innerText = info.action;
    updateStatus("Detected");

    // ONLY count new detections - avoid double-counting same object across frames
    if (isNewDetection && trackedObj) {
        trackedObj.countedAsNew = true; // Mark as counted
        
        window.dispatchEvent(new CustomEvent("wasteDetected", {
            detail: {
                className: className,
                type: info.type,
                percent: percent,
                action: info.action,
                timestamp: Date.now()
            }
        }));
    }
}

function updateStatus(text) {
    if (detStatus) detStatus.innerText = text;
}

window.startDetection = startDetection;
window.stopCamera = stopCamera;

updateStatus("Idle");
detItemName.innerText = "Click Start Detection";
detItemType.innerText = "Waiting";
