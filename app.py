import streamlit as st
import cv2
import mediapipe as mp
import numpy as np
import math
from datetime import datetime

st.set_page_config(page_title="NetRakshak AI", page_icon="🚗", layout="wide")

st.markdown("""
<style>
.stApp {background: #0b1220; color: #edf2f7;}
[data-testid="stHeader"] {background: rgba(0,0,0,0);}
.metric-card {background:#162338;border:1px solid #2c405c;border-radius:14px;padding:18px;}
.small-muted {color:#9fb0c7;font-size:0.9rem;}
</style>
""", unsafe_allow_html=True)

st.title("🚗 NetRakshak AI")
st.caption("Affordable Multimodal Driver Monitoring & Preventive Alert System")
st.info("Prototype notice: This educational demo is not a certified breathalyser or a vehicle safety device. Do not use it to decide whether someone is safe to drive.")

LEFT, RIGHT = st.columns([1.15, 0.85], gap="large")
with RIGHT:
    st.subheader("Sensor input")
    alcohol = st.slider("Alcohol sensor level (simulated MQ-3 reading)", 0, 1000, 100, 10)
    st.caption("Replace this slider with calibrated MQ-3 hardware readings for the hardware version.")
    st.subheader("Detection settings")
    eye_threshold = st.slider("Eye-closure threshold (EAR)", 0.10, 0.35, 0.21, 0.01)
    yawn_threshold = st.slider("Yawn threshold (MAR)", 0.20, 0.80, 0.55, 0.01)
    st.caption("Thresholds are demonstration defaults and require calibration across users and conditions.")

# MediaPipe Face Mesh landmark indices (standard 468-point mesh)
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]
MOUTH = [13, 14, 78, 308]


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def ear(points, ids):
    p = [points[i] for i in ids]
    return (dist(p[1], p[5]) + dist(p[2], p[4])) / (2.0 * dist(p[0], p[3]) + 1e-6)


def analyze(image, alcohol_value, eye_limit, mouth_limit):
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mesh = mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1,
                                            refine_landmarks=True, min_detection_confidence=0.5)
    result = mesh.process(rgb)
    mesh.close()
    annotated = image.copy()
    findings = []
    ear_value = None
    mar_value = None
    distraction = False
    if result.multi_face_landmarks:
        h, w = image.shape[:2]
        lm = result.multi_face_landmarks[0].landmark
        pts = [(int(p.x*w), int(p.y*h)) for p in lm]
        ear_value = (ear(pts, LEFT_EYE) + ear(pts, RIGHT_EYE)) / 2
        mar_value = dist(pts[13], pts[14]) / (dist(pts[78], pts[308]) + 1e-6)
        # Approximate horizontal head orientation from nose position relative to eye corners.
        eye_mid = ((pts[33][0] + pts[263][0]) / 2)
        face_width = max(1, abs(pts[263][0] - pts[33][0]))
        nose_offset = (pts[1][0] - eye_mid) / face_width
        distraction = abs(nose_offset) > 0.18
        for idx in LEFT_EYE + RIGHT_EYE + MOUTH + [1]:
            cv2.circle(annotated, pts[idx], 2, (80, 220, 150), -1)
        cv2.putText(annotated, f"EAR: {ear_value:.2f}  MAR: {mar_value:.2f}", (18, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (80, 220, 150), 2)
        if ear_value < eye_limit:
            findings.append("Low eye aspect ratio — possible eye closure")
        if mar_value > mouth_limit:
            findings.append("High mouth aspect ratio — possible yawn")
        if distraction:
            findings.append("Head orientation suggests possible distraction")
    else:
        findings.append("No face detected — improve lighting and face the camera")

    # Transparent demonstration score; alcohol slider is a simulated sensor value.
    eye_points = 30 if ear_value is not None and ear_value < eye_limit else 0
    yawn_points = 20 if mar_value is not None and mar_value > mouth_limit else 0
    head_points = 20 if distraction else 0
    alcohol_points = 30 if alcohol_value >= 400 else (15 if alcohol_value >= 250 else 0)
    score = min(100, eye_points + yawn_points + head_points + alcohol_points)
    level = "HIGH" if score >= 50 else ("MEDIUM" if score >= 20 else "LOW")
    return annotated, score, level, findings, ear_value, mar_value

with LEFT:
    st.subheader("Driver camera")
    captured = st.camera_input("Capture a driver image")
    uploaded = st.file_uploader("Or upload an image", type=["jpg", "jpeg", "png"])
    source = captured if captured is not None else uploaded
    if source is not None:
        file_bytes = np.asarray(bytearray(source.getvalue()), dtype=np.uint8)
        frame = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if frame is None:
            st.error("Could not read this image. Please try another one.")
        else:
            with st.spinner("Analysing face landmarks..."):
                output, score, level, findings, ear_v, mar_v = analyze(frame, alcohol, eye_threshold, yawn_threshold)
            st.image(cv2.cvtColor(output, cv2.COLOR_BGR2RGB), caption="Analysed image", use_container_width=True)
            c1, c2, c3 = st.columns(3)
            c1.metric("Driver Risk Index", f"{score}/100")
            c2.metric("Risk level", level)
            c3.metric("Alcohol input", f"{alcohol}/1000")
            if level == "HIGH":
                st.error("HIGH RISK — Stop the demonstration and do not drive. Arrange a safe alternative.")
                st.toast("High-risk condition detected", icon="🚨")
            elif level == "MEDIUM":
                st.warning("MEDIUM RISK — Possible fatigue or distraction cues detected.")
            else:
                st.success("LOW RISK — No configured risk cues detected in this image.")
            st.markdown("**Detection findings**")
            for item in findings:
                st.write("• " + item)
            if ear_v is not None:
                st.write(f"EAR: `{ear_v:.3f}`  |  MAR: `{mar_v:.3f}`")
            st.caption("Single-image analysis cannot establish sustained drowsiness, actual intoxication, or driving fitness. Temporal video analysis and calibrated hardware are future integration steps.")
    else:
        st.markdown("""
        <div class="metric-card">
        <h3>Ready to monitor</h3>
        <p class="small-muted">Allow camera access or upload a clear, front-facing driver image. The prototype will estimate eye closure, mouth opening and approximate head orientation.</p>
        </div>
        """, unsafe_allow_html=True)

st.divider()
st.subheader("How the prototype works")
cols = st.columns(6)
steps = ["1. Camera input", "2. Face landmarks", "3. EAR / MAR", "4. Head pose cue", "5. Risk fusion", "6. Alert"]
for col, step in zip(cols, steps):
    col.markdown(f"<div class='metric-card' style='text-align:center'>{step}</div>", unsafe_allow_html=True)
st.caption("NetRakshak AI • ABES Engineering College • Mini Project 2026–27")
