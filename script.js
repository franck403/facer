const video = document.getElementById("video");
const canvas = document.getElementById("overlay-canvas");
const ctx = canvas.getContext("2d");
const resultsDiv = document.getElementById("results");
const toggleBtn = document.getElementById("toggle-camera");
const pipBtn = document.getElementById("enable-pip");
const logOut = document.getElementById("log-output");

let showCamera = true;
let popupWindow = null;
let popupOpened = false;
let age30Start = null;

const AGE_THRESHOLD = 28;
const REQUIRED_DURATION = 100;
const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/";

let prevFrame = null;
const PIXEL_THRESHOLD = 0.1;

function log(msg) {
    const time = new Date().toLocaleTimeString();
    logOut.textContent += `[${time}] ${msg}\n`;
    logOut.scrollTop = logOut.scrollHeight;
}

async function loadModels() {
    resultsDiv.textContent = "Loading models…";
    log("Loading models");
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
    ]);
    resultsDiv.textContent = "Models loaded.";
    log("Models loaded");
    startCamera();
}

async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
    log("Camera started");
    video.addEventListener("loadedmetadata", () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        detectLoopRAF();
    });
}

toggleBtn.addEventListener("click", () => {
    showCamera = !showCamera;
    video.style.opacity = showCamera ? "1" : "0";
    toggleBtn.textContent = showCamera ? "Hide Camera" : "Show Camera";
    log(showCamera ? "Camera shown" : "Camera hidden");
});

pipBtn.addEventListener("click", async () => {
    try {
        const canvasStream = canvas.captureStream(30);
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
            pipBtn.textContent = "Enable PiP";
            log("Exited PiP");
        } else {
            const track = canvasStream.getVideoTracks()[0];
            const pipVideo = document.createElement("video");
            pipVideo.srcObject = new MediaStream([track]);
            pipVideo.muted = true;
            await pipVideo.play();
            await pipVideo.requestPictureInPicture();
            pipBtn.textContent = "PiP Enabled";
            log("Entered PiP");
        }
    } catch (err) {
        log("PiP error");
        console.error("PiP failed:", err);
    }
});

function openStudyoPopup() {
    const width = screen.availWidth;
    const height = screen.availHeight;
    popupWindow = window.open(
        "https://studyo.app/",
        "FullscreenPopup",
        `width=${width},height=${height},left=0,top=0,menubar=no,toolbar=no,location=no,status=no,resizable=no,scrollbars=no`
    );
    if (!popupWindow) {
        alert("Popup blocked. Allow popups.");
        popupOpened = false;
        log("Popup blocked");
        return;
    }
    log("Popup opened");
}

function frameChanged(curr) {
    if (!prevFrame) {
        prevFrame = curr;
        log("Initial frame buffer set");
        return true;
    }

    const a = prevFrame.data;
    const b = curr.data;

    const stride = 16; // check 1 out of 8 pixels
    let changed = 0;
    let checked = 0;

    // total pixels = data.length / 4. sampling reduces iterations massively
    for (let i = 0; i < a.length; i += 4 * stride) {
        checked++;
        const dr = Math.abs(a[i] - b[i]);
        const dg = Math.abs(a[i+1] - b[i+1]);
        const db = Math.abs(a[i+2] - b[i+2]);

        if (dr > 3 || dg > 3 || db > 3) {
            changed++;
        }
    }

    prevFrame = curr;
    const ratio = changed / checked;

    if (ratio < PIXEL_THRESHOLD) {
        log("Frame skipped (low delta)");
        return false;
    }
    return true;
}


async function detectLoopRAF() {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (!frameChanged(frame)) {
        requestAnimationFrame(detectLoopRAF);
        return;
    }

    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });
    const detections = await faceapi
        .detectAllFaces(video, opts)
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const resized = faceapi.resizeResults(detections, { width: canvas.width, height: canvas.height });

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let over = false;
    let high = 0;

    resized.forEach(d => {
        const age = Math.round(d.age);
        const box = d.detection.box;

        faceapi.draw.drawDetections(canvas, [d]);
        faceapi.draw.drawFaceLandmarks(canvas, [d]);

        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(box.x, box.y - 20, box.width, 20);
        ctx.fillStyle = "#0f0";
        ctx.font = "14px sans-serif";
        ctx.fillText(`Age: ${age}`, box.x + 4, box.y - 6);

        if (age > high) high = age;
        if (age > AGE_THRESHOLD) over = true;
    });

    document.title = high;

    const now = Date.now();
    if (over) {
        if (!age30Start) age30Start = now;
        else if (now - age30Start >= REQUIRED_DURATION && !popupOpened) {
            popupOpened = true;
            log(`Age threshold reached: ${high}`);
            openStudyoPopup();
        }
    } else {
        age30Start = null;
    }

    if (popupWindow && popupWindow.closed) {
        popupWindow = null;
        popupOpened = false;
        log("Popup closed");
    }

    requestAnimationFrame(detectLoopRAF);
}

loadModels();
