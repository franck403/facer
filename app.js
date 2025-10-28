// Global variables
let showCamera = false;
let modelsLoaded = false;
const video = document.getElementById('video');
const overlayCanvas = document.getElementById('overlay-canvas');
const overlayCtx = overlayCanvas.getContext('2d');
const loadingElement = document.getElementById('loading');

// Load the models
async function loadModels() {
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri('models');
    await faceapi.nets.ageGenderNet.loadFromUri('models');
    modelsLoaded = true;
    loadingElement.textContent = "Models loaded! Click 'Detect Ages' to start.";
    console.log('Models loaded');
  } catch (err) {
    loadingElement.textContent =
      'Failed to load models. Check console for details.';
    console.error('Error loading models:', err);
  }
}

// Start the camera
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    loadingElement.textContent = 'Error accessing camera. Check permissions.';
    console.error('Error accessing camera:', err);
  }
}

// Toggle camera visibility
function toggleCamera() {
  showCamera = !showCamera;
  video.style.display = showCamera ? 'block' : 'none';
  document.getElementById('toggle-camera').textContent = showCamera
    ? 'Hide Camera'
    : 'Show Camera';
}

// Draw face detections and ages on the overlay canvas
async function detectAndDraw() {
  if (!modelsLoaded) {
    loadingElement.textContent = 'Models not loaded yet. Please wait.';
    return;
  }
  const detections = await faceapi
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
    .withAgeAndGender();
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (detections.length === 0) {
    document.getElementById('results').innerHTML = '<p>No faces detected.</p>';
    return;
  }
  let oldestAge = -1;
  let oldestFace = null;
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  detections.forEach((detection) => {
    const box = detection.detection.box;
    const age = Math.round(detection.age);
    overlayCtx.strokeStyle = 'red';
    overlayCtx.lineWidth = 2;
    overlayCtx.strokeRect(box.x, box.y, box.width, box.height);
    overlayCtx.fillStyle = 'red';
    overlayCtx.font = '16px Arial';
    overlayCtx.fillText(`Age: ${age}`, box.x, box.y > 10 ? box.y - 5 : 10);
    if (age > oldestAge) {
      oldestAge = age;
      oldestFace = detection;
    }
    resultsDiv.innerHTML += `<p>Detected face: Age ${age}</p>`;
  });
  resultsDiv.innerHTML += `<p>The oldest face is ${oldestAge} years old.</p>`;
}

// Initialize everything
async function init() {
  await startCamera();
  await loadModels();
  document
    .getElementById('toggle-camera')
    .addEventListener('click', toggleCamera);
  document.getElementById('capture').addEventListener('click', detectAndDraw);
}

// Call init after the page is fully loaded
window.onload = init;
