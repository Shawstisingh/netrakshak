// In-browser port of app.py: MediaPipe Face Landmarker runs locally via WebAssembly.
import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// MediaPipe Face Mesh landmark indices (standard 468-point mesh)
const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
const MOUTH = [13, 14, 78, 308];

const $ = (id) => document.getElementById(id);
const video = $("video"), canvas = $("canvas"), ctx = canvas.getContext("2d");
const sliders = { alcohol: $("alcohol"), eye: $("eye"), yawn: $("yawn") };
let stream = null, lastImage = null, landmarkerPromise = null;

function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const files = await FilesetResolver.forVisionTasks(WASM);
      return FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL },
        runningMode: "IMAGE",
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
      });
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function ear(pts, ids) {
  const p = ids.map((i) => pts[i]);
  return (dist(p[1], p[5]) + dist(p[2], p[4])) / (2.0 * dist(p[0], p[3]) + 1e-6);
}

function analyze(source, alcohol, eyeLimit, mouthLimit, landmarker) {
  const w = source.width, h = source.height;
  canvas.width = w; canvas.height = h;
  ctx.drawImage(source, 0, 0, w, h);
  const result = landmarker.detect(canvas);
  const findings = [];
  let earValue = null, marValue = null, distraction = false;

  if (result.faceLandmarks && result.faceLandmarks.length) {
    const pts = result.faceLandmarks[0].map((p) => [Math.round(p.x * w), Math.round(p.y * h)]);
    earValue = (ear(pts, LEFT_EYE) + ear(pts, RIGHT_EYE)) / 2;
    marValue = dist(pts[13], pts[14]) / (dist(pts[78], pts[308]) + 1e-6);
    // Approximate horizontal head orientation from nose position relative to eye corners.
    const eyeMid = (pts[33][0] + pts[263][0]) / 2;
    const faceWidth = Math.max(1, Math.abs(pts[263][0] - pts[33][0]));
    distraction = Math.abs((pts[1][0] - eyeMid) / faceWidth) > 0.18;

    const scale = Math.max(1, Math.round(w / 640));
    ctx.fillStyle = "rgb(150,220,80)";
    for (const idx of [...LEFT_EYE, ...RIGHT_EYE, ...MOUTH, 1]) {
      ctx.beginPath(); ctx.arc(pts[idx][0], pts[idx][1], 2 * scale, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = `bold ${20 * scale}px system-ui, sans-serif`;
    ctx.fillText(`EAR: ${earValue.toFixed(2)}  MAR: ${marValue.toFixed(2)}`, 18 * scale, 32 * scale);

    if (earValue < eyeLimit) findings.push("Low eye aspect ratio — possible eye closure");
    if (marValue > mouthLimit) findings.push("High mouth aspect ratio — possible yawn");
    if (distraction) findings.push("Head orientation suggests possible distraction");
  } else {
    findings.push("No face detected — improve lighting and face the camera");
  }

  // Transparent demonstration score; alcohol slider is a simulated sensor value.
  const eyePoints = earValue !== null && earValue < eyeLimit ? 30 : 0;
  const yawnPoints = marValue !== null && marValue > mouthLimit ? 20 : 0;
  const headPoints = distraction ? 20 : 0;
  const alcoholPoints = alcohol >= 400 ? 30 : alcohol >= 250 ? 15 : 0;
  const score = Math.min(100, eyePoints + yawnPoints + headPoints + alcoholPoints);
  const level = score >= 50 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";
  return { score, level, findings, earValue, marValue };
}

const ALERTS = {
  HIGH: "HIGH RISK — Stop the demonstration and do not drive. Arrange a safe alternative.",
  MEDIUM: "MEDIUM RISK — Possible fatigue or distraction cues detected.",
  LOW: "LOW RISK — No configured risk cues detected in this image.",
};

let toastTimer;
async function run(showToast = true) {
  if (!lastImage) return;
  $("status").textContent = "Analysing face landmarks...";
  let landmarker;
  try {
    landmarker = await getLandmarker();
  } catch (err) {
    console.error(err);
    $("status").textContent = "Could not load the face-landmark model. Check your connection and try again.";
    return;
  }
  const alcohol = Number(sliders.alcohol.value);
  const r = analyze(lastImage, alcohol, Number(sliders.eye.value), Number(sliders.yawn.value), landmarker);
  $("status").textContent = "";
  $("ready").hidden = true;
  $("results").hidden = false;
  $("mScore").textContent = `${r.score}/100`;
  $("mLevel").textContent = r.level;
  $("mAlcohol").textContent = `${alcohol}/1000`;
  const alert = $("alert");
  alert.className = `notice ${r.level.toLowerCase()}`;
  alert.textContent = ALERTS[r.level];
  $("findings").replaceChildren(...r.findings.map((f) => Object.assign(document.createElement("li"), { textContent: f })));
  $("ratios").innerHTML = r.earValue !== null
    ? `EAR: <code>${r.earValue.toFixed(3)}</code> &nbsp;|&nbsp; MAR: <code>${r.marValue.toFixed(3)}</code>` : "";
  if (r.level === "HIGH" && showToast) {
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4000);
  }
}

// Sliders: update labels and re-run analysis live (like Streamlit reruns).
for (const [key, el] of Object.entries(sliders)) {
  const out = $(`${key}Out`);
  el.addEventListener("input", () => {
    out.textContent = key === "alcohol" ? el.value : Number(el.value).toFixed(2);
    run(false);
  });
}

$("upload").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => { lastImage = img; run(); URL.revokeObjectURL(img.src); };
  img.onerror = () => { $("status").textContent = "Could not read this image. Please try another one."; };
  img.src = URL.createObjectURL(file);
});

$("startCam").addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    video.srcObject = stream;
    video.hidden = false;
    await video.play();
    $("capture").disabled = false; $("stopCam").disabled = false; $("startCam").disabled = true;
    $("status").textContent = "";
    getLandmarker().catch(() => {}); // warm up the model while the user frames the shot
  } catch (err) {
    $("status").textContent = "Camera unavailable or permission denied. You can upload an image instead.";
  }
});

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null; video.hidden = true;
  $("capture").disabled = true; $("stopCam").disabled = true; $("startCam").disabled = false;
}
$("stopCam").addEventListener("click", stopCamera);

$("capture").addEventListener("click", () => {
  const snap = document.createElement("canvas");
  snap.width = video.videoWidth; snap.height = video.videoHeight;
  snap.getContext("2d").drawImage(video, 0, 0);
  lastImage = snap;
  stopCamera();
  run();
});
