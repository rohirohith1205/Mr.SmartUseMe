// detection.js — YOLOv8 object detection for MR.SmartUSEME
// Backend: yolo_api.py (Flask) running at localhost:5000

const API_URL = "http://localhost:8080/api/detect";
const CONFIDENCE_THRESHOLD = 0.35;

// ── Waste Type Mapping — matches best.pt model classes exactly ──
// Classes: Aluminium foil, Bottle cap, Bottle, Broken glass, Can,
// Carton, Cigarette, Cup, Lid, Other litter, Other plastic, Paper,
// Plastic bag - wrapper, Plastic container, Pop tab, Straw,
// Styrofoam piece, Unlabeled litter
window.WASTE_TYPES = {
    // Recyclable metals
    'Aluminium foil': { type: 'Recyclable', action: 'Metal Recycling', color: '#00ff9d' },
    'Bottle cap': { type: 'Recyclable', action: 'Metal Recycling', color: '#00ff9d' },
    'Can': { type: 'Recyclable', action: 'Metal Recycling', color: '#00ff9d' },
    'Pop tab': { type: 'Recyclable', action: 'Metal Recycling', color: '#00ff9d' },
    // Hazardous glass
    'Broken glass': { type: 'Hazardous', action: 'Glass Waste Bin', color: '#ef4444' },
    // Recyclable plastics & containers
    'Bottle': { type: 'Recyclable', action: 'Plastic Recycling', color: '#00ff9d' },
    'Cup': { type: 'Recyclable', action: 'Plastic Recycling', color: '#00ff9d' },
    'Lid': { type: 'Recyclable', action: 'Plastic Recycling', color: '#00ff9d' },
    'Other plastic': { type: 'Recyclable', action: 'Plastic Recycling', color: '#00ff9d' },
    'Plastic container': { type: 'Recyclable', action: 'Plastic Recycling', color: '#00ff9d' },
    // General trash (non-recyclable plastics)
    'Plastic bag - wrapper': { type: 'Trash', action: 'General Waste', color: '#6b7280' },
    'Straw': { type: 'Trash', action: 'General Waste', color: '#6b7280' },
    'Styrofoam piece': { type: 'Trash', action: 'General Waste', color: '#6b7280' },
    // Paper & cardboard
    'Carton': { type: 'Recyclable', action: 'Paper Recycling', color: '#00ff9d' },
    'Paper': { type: 'Recyclable', action: 'Paper Recycling', color: '#00ff9d' },
    // Hazardous / unclassified
    'Cigarette': { type: 'Hazardous', action: 'Hazardous Waste', color: '#f59e0b' },
    'Other litter': { type: 'Trash', action: 'General Waste', color: '#6b7280' },
    'Unlabeled litter': { type: 'Trash', action: 'General Waste', color: '#6b7280' },
};

// ── DOM Elements ──────────────────────────────────────────────
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

// ── State ─────────────────────────────────────────────────────
let lastDispatchedClass = null;
let isDetecting = false;
let backendOK = false;
let consecutiveErrors = 0;
let fpsInterval = null;
let frameCount = 0;
let lastFpsTime = performance.now();

// ── Initialization ────────────────────────────────────────────
async function init() {
    updateStatus('Initializing...');
    detItemName.innerText = 'Starting camera...';

    // 1. Start camera
    try {
        await setupCamera();
    } catch (e) {
        detItemName.innerText = 'Camera Error';
        detItemType.innerText = 'Check browser permissions';
        updateStatus('Camera Failed');
        console.error('[Detection] Camera setup failed:', e);
        return;
    }

    // 2. Check backend health
    updateStatus('Checking AI backend...');
    detItemName.innerText = 'Connecting to AI...';

    const available = await checkBackend();
    if (!available) {
        detItemName.innerText = 'Backend Offline';
        detItemType.innerText = 'Run: python yolo_api.py';
        updateStatus('Backend Error');
        showBackendOfflineError();
        // Keep retrying in the background
        waitForBackend();
        return;
    }

    // 3. Start detection loop
    backendOK = true;
    updateStatus('Model Ready');
    detItemName.innerText = 'Scanning...';
    detItemType.innerText = 'YOLOv8 Active';
    startFpsCounter();
    detectFrame();
}

// ── Backend Health Check ──────────────────────────────────────
async function checkBackend() {
    try {
        const res = await fetch("http://localhost:8080/api/health", {
            method: "GET",
            signal: AbortSignal.timeout(3000)
        });
        return res.ok;
    } catch {
        return false;
    }
}

// ── Wait for backend to come online (poll every 3s) ───────────
function waitForBackend() {
    console.log('[Detection] Waiting for backend...');
    const interval = setInterval(async () => {
        const ok = await checkBackend();
        if (ok) {
            clearInterval(interval);
            backendOK = true;
            consecutiveErrors = 0;
            detItemName.innerText = 'Scanning...';
            detItemType.innerText = 'YOLOv8 Active';
            updateStatus('Model Ready');
            // Clear any offline warning banners
            const banner = document.getElementById('backend-offline-banner');
            if (banner) banner.remove();
            startFpsCounter();
            detectFrame();
        }
    }, 3000);
}

// ── Show offline warning in UI ────────────────────────────────
function showBackendOfflineError() {
    const existing = document.getElementById('backend-offline-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'backend-offline-banner';
    banner.style.cssText = `
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: #1f2937; border: 1px solid #ef4444; color: #f87171;
        padding: 12px 24px; border-radius: 12px; font-size: 14px;
        display: flex; align-items: center; gap: 10px; z-index: 9999;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    `;
    banner.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="color:#ef4444"></i>
        <span><b>AI Backend Offline.</b> Run <code style="background:#374151;padding:2px 6px;border-radius:4px;">python yolo_api.py</code> then refresh.</span>
    `;
    document.body.appendChild(banner);
}

// ── Camera Setup ──────────────────────────────────────────────
async function setupCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
        audio: false
    });

    video.srcObject = stream;

    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            video.play().catch(err => console.warn('[Detection] Video play error:', err));
            const camInfo = document.getElementById('cam-info');
            if (camInfo) {
                camInfo.innerText = `Resolution: ${video.videoWidth}×${video.videoHeight} • Camera ID: CAM-01`;
            }
            resolve();
        };
    });
}

// ── FPS Counter ───────────────────────────────────────────────
function startFpsCounter() {
    if (fpsInterval) clearInterval(fpsInterval);
    fpsInterval = setInterval(() => {
        const now = performance.now();
        const elapsed = (now - lastFpsTime) / 1000;
        const fps = Math.round(frameCount / elapsed);
        if (statSpeed) statSpeed.innerText = `${fps} FPS`;
        frameCount = 0;
        lastFpsTime = now;
    }, 1000);
}

// ── Detection Loop ────────────────────────────────────────────
async function detectFrame() {
    if (!backendOK) return;

    if (video.readyState < 2) {
        requestAnimationFrame(detectFrame);
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
        const t0 = performance.now();

        try {
            const formData = new FormData();
            formData.append('file', blob, 'frame.jpg');

            const res = await fetch(API_URL, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(5000)   // 5 s timeout per frame
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const detections = await res.json();
            consecutiveErrors = 0;
            frameCount++;

            if (detections.length > 0) {
                const best = detections[0];
                if (best.confidence >= CONFIDENCE_THRESHOLD) {
                    renderPrediction(best.bbox, best.confidence, best.class);
                } else {
                    hideOverlay();
                }
            } else {
                hideOverlay();
            }

        } catch (err) {
            consecutiveErrors++;
            console.warn(`[Detection] Frame error (${consecutiveErrors}):`, err.message);

            // After 5 consecutive failures assume backend went offline
            if (consecutiveErrors >= 5) {
                backendOK = false;
                if (fpsInterval) { clearInterval(fpsInterval); fpsInterval = null; }
                updateStatus('Backend Lost');
                detItemName.innerText = 'Connection lost';
                detItemType.innerText = 'Retrying...';
                showBackendOfflineError();
                waitForBackend();
                return;
            }
        }

        requestAnimationFrame(detectFrame);

    }, 'image/jpeg', 0.8);   // 80% JPEG quality — good balance speed/accuracy
}

// ── Render Detection ──────────────────────────────────────────
function renderPrediction(bbox, score, className) {
    const [x, y, w, h] = bbox;

    const scaleX = video.clientWidth / video.videoWidth;
    const scaleY = video.clientHeight / video.videoHeight;

    detectionBox.style.left = `${x * scaleX}px`;
    detectionBox.style.top = `${y * scaleY}px`;
    detectionBox.style.width = `${w * scaleX}px`;
    detectionBox.style.height = `${h * scaleY}px`;
    detectionBox.classList.remove('hidden');

    const percent = Math.round(score * 100);
    detectionLabel.innerText = `${className} • ${percent}%`;

    const info = window.WASTE_TYPES[className] || { type: 'Unclassified', action: 'Analyze', color: '#9ca3af' };

    detItemName.innerText = className.charAt(0).toUpperCase() + className.slice(1);
    detItemType.innerText = info.type;
    detConfText.innerText = `${percent}%`;
    detConfBar.style.width = `${percent}%`;
    detConfBar.style.backgroundColor = info.color;
    detAction.innerText = info.action;
    updateStatus('Detected');

    // Only dispatch event once per new class (avoids flooding history)
    if (className !== lastDispatchedClass) {
        lastDispatchedClass = className;
       window.dispatchEvent(new CustomEvent("wasteDetected", {
    detail: {
        className: className,
        type: info.type,
        percent: score,
        action: info.action
    }
    }));
    }
}

// ── Helpers ───────────────────────────────────────────────────
function hideOverlay() {
    detectionBox.classList.add('hidden');
    updateStatus('Scanning...');
    if (detItemName.innerText !== 'Scanning...' &&
        detItemName.innerText !== 'Backend Offline' &&
        detItemName.innerText !== 'Connection lost') {
        detItemName.innerText = 'Scanning...';
        detItemType.innerText = 'YOLOv8 Active';
    }
    lastDispatchedClass = null;
}

function updateStatus(text) {
    if (detStatus) detStatus.innerText = text;
}

// ── Start ─────────────────────────────────────────────────────
init();