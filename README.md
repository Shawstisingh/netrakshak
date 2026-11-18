# NetRakshak AI

**Affordable Multimodal Driver Monitoring & Preventive Alert System**  
ABES Engineering College · CSE-AIML · Mini Project 2026–27

## Prototype features
- Face landmark detection using MediaPipe Face Mesh.
- Eye Aspect Ratio (EAR) as a single-image eye-closure cue.
- Mouth Aspect Ratio (MAR) as a possible-yawn cue.
- Approximate horizontal head-orientation cue.
- Transparent demonstration Driver Risk Index (0–100) and Low/Medium/High status.
- Simulated MQ-3 alcohol sensor slider.
- Camera capture or image upload, with visual dashboard alerts.

## Important limitations
This is an educational prototype, not a certified driver-monitoring or breathalyser system. A single image cannot measure sustained eye closure/PERCLOS or reliably diagnose fatigue. The alcohol slider is simulated and does not measure alcohol concentration. Head orientation is approximate. Do not use the output to decide whether someone is safe to drive. The system does not control steering, braking, ignition, or any vehicle function.

## Run locally (Windows)
1. Install Python 3.11 (64-bit).
2. Open PowerShell in this project folder.
3. Create and activate a virtual environment:

   ```powershell
   py -3.11 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
4. Install dependencies:

   ```powershell
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```
5. Start the app:

   ```powershell
   streamlit run app.py
   ```
6. Open the local URL shown in the terminal (usually http://localhost:8501). Allow camera access, or upload an image.

If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal and activate again.

## Deploy free with Streamlit Community Cloud
1. Create a GitHub repository named `netrakshak-ai`.
2. Upload `app.py`, `requirements.txt`, `runtime.txt`, `.gitignore`, and this README to the repository root.
3. Sign in at https://share.streamlit.io/ using GitHub and authorize access.
4. Choose **Create app**, select your repository, branch `main`, and main file `app.py`.
5. Click **Deploy**. Wait for dependency installation; Streamlit will provide a public URL.
6. Open the public URL over HTTPS and test camera permissions. If camera capture is unavailable in a browser/device, use image upload.

## Git commands (optional)
Run these from this folder after creating an empty GitHub repository:

```bash
git init
git add .
git commit -m "Build NetRakshak AI driver monitoring prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/netrakshak-ai.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username. Do not paste passwords or personal access tokens into source files.

## Risk score used in this demo
- Eye cue: 30 points when EAR is below the selected threshold.
- Yawn cue: 20 points when MAR is above the selected threshold.
- Head-orientation cue: 20 points when approximate nose offset crosses the threshold.
- Simulated alcohol input: 15 points at 250–399, 30 points at 400 or above.
- LOW: 0–19, MEDIUM: 20–49, HIGH: 50–100.

These are prototype heuristics, not clinically or legally validated thresholds. Calibrate and evaluate with consented, representative data before any research claims.

## Next hardware milestone
For a physical prototype, connect a properly conditioned MQ-3 module to a microcontroller/ADC and send calibrated readings to the application. Raspberry Pi GPIO is not a direct analog input; use a suitable ADC and follow the sensor/module datasheet. Do not treat MQ-3 output as a legal blood-alcohol measurement.
