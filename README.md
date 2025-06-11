# Arduino-Audio-Responsive-Feedback-Tshirt

This project uses a browser-based Teachable Machine sound recognition model to detect specific audio events and communicate them to an Arduino-powered T-Shirt via the Web Serial API. The T-Shirt reacts using an LED and vibration motor to convey alerts through color and haptic feedback.

## 📁 Project Structure

```bash
.
├── dashboard.html      # Frontend dashboard UI
├── script.js           # JS logic for sound detection + Arduino communication
├── styles.css          # Responsive and animated UI styling
└── Project_Final.ino   # Arduino sketch for LED & vibration motor feedback
```

## 🛠️ Features
- 🧠 AI Audio Classification via Teachable Machine

- 🔗 Real-time Serial Communication (Web Serial API)

- 💡 RGB LED & Vibration Feedback for each detected event

- 🖥️ Interactive Dashboard UI with live debug info and confidence scores

- 🎛️ Manual Testing Buttons to simulate alerts

## 🎧 Supported Sounds & Reactions
| Sound             | LED Color    | Vibration Pattern  |
| ----------------- | ------------ | ------------------ |
| Doorbell          | Green        | 2 quick pulses     |
| Crying Baby       | Blue         | 4 short pulses     |
| Emergency Vehicle | Red          | Constant vibration |
| Alarm             | Yellow       | 3 long pulses      |


## 🚀 How to Run
### 1. Prerequisites
- Google Chrome / Edge (Web Serial API required)

- Arduino Uno

- Connected:

  - RGB LED on pin 6

  - Vibration Motors on pin 3

  - Button (for acknowledgment) on pin 7

- Microphone access enabled

### 2. Upload Arduino Code
Upload the contents of `Final_Project.ino` to your Arduino board via the Arduino IDE.

### 3. Launch Dashboard
Start a simple HTTP server:

```bash
python -m http.server
```

Open `http://localhost:8000/dashboard.html` in the browser of choice.

### 4. Connect Devices
Click "Connect Arduino" on the dashboard to establish a serial connection.

Click "Start Recognition" to activate audio detection.

## 🧪 Testing
Use the buttons on the UI dashboard to simulate detection commands manually:

- Test Doorbell

- Test Crying Baby

- Test Emergency

- Test Alarm

These commands are sent directly to the Arduino for validation and debugging.
