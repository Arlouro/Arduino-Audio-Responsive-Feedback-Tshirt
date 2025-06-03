#include <Adafruit_NeoPixel.h>

#define LED_PIN 6
#define BUTTON_PIN 7
#define VIBRATION_MOTOR_PIN 3

#define NUMPIXELS 1
#define MAX_ALERTS 5
#define BLINK_INTERVAL 500
#define DEBOUNCE_DELAY 300

Adafruit_NeoPixel pixels(NUMPIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);

int alertQueue[MAX_ALERTS][4];
int queueStart = 0;
int queueEnd = 0;

bool alertActive = false;
bool ledState = false;

unsigned long lastBlinkTime = 0;
unsigned long lastButtonPress = 0;

int vibrationStep = 0;
unsigned long lastVibTime = 0;
bool vibrationOn = false;

// ========== SETUP ==========
void setup() {
  Serial.begin(9600);
  pixels.begin();
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(VIBRATION_MOTOR_PIN, OUTPUT);
}

// ========== MAIN LOOP ==========
void loop() {
  receiveSerialCommand();
  handleAlertBlink();
  checkForButtonPress();
}

// ========== SERIAL INPUT ==========
void receiveSerialCommand() {
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    int r = 0, g = 0, b = 0, pattern = 0;

    if (input == "Doorbell") {
      r = 0;   g = 255; b = 0;   pattern = 0;
    } else if (input == "Crying Baby") {
      r = 0;   g = 0;   b = 255; pattern = 2;
    } else if (input == "Emergency Vehicle") {
      r = 255; g = 0;   b = 0;   pattern = 3;
    } else if (input == "Alarm") {
      r = 255; g = 200; b = 0;   pattern = 1;
    } else {
      return;
    }

    enqueueAlert(r, g, b, pattern);
  }
}

// ========== QUEUE MANAGEMENT ==========
bool isColorInQueue(int r, int g, int b) {
  for (int i = queueStart; i != queueEnd; i = (i + 1) % MAX_ALERTS) {
    if (alertQueue[i][0] == r && alertQueue[i][1] == g && alertQueue[i][2] == b) {
      return true;
    }
  }
  return false;
}

void enqueueAlert(int r, int g, int b, int pattern) {
  if (isColorInQueue(r, g, b)) return;

  int nextIndex = (queueEnd + 1) % MAX_ALERTS;
  if (nextIndex != queueStart) {
    alertQueue[queueEnd][0] = r;
    alertQueue[queueEnd][1] = g;
    alertQueue[queueEnd][2] = b;
    alertQueue[queueEnd][3] = pattern;
    queueEnd = nextIndex;

    if (!alertActive) {
      alertActive = true;
      ledState = true;
      lastBlinkTime = millis();
      vibrationStep = 0;
      lastVibTime = millis();
      vibrationOn = false;
    }
  }
}

void dequeueAlert() {
  if (queueStart != queueEnd) {
    queueStart = (queueStart + 1) % MAX_ALERTS;
  }

  if (queueStart == queueEnd) {
    alertActive = false;
    setLED(0, 0, 0);
    digitalWrite(VIBRATION_MOTOR_PIN, LOW);
  } else {
    ledState = true;
    lastBlinkTime = millis();
    vibrationStep = 0;
    lastVibTime = millis();
    vibrationOn = false;
  }
}

// ========== BLINKING + VIBRATION ==========
void handleAlertBlink() {
  if (!alertActive) return;

  unsigned long currentTime = millis();
  int r = alertQueue[queueStart][0];
  int g = alertQueue[queueStart][1];
  int b = alertQueue[queueStart][2];
  int pattern = alertQueue[queueStart][3];

  if (currentTime - lastBlinkTime >= BLINK_INTERVAL) {
    lastBlinkTime = currentTime;
    ledState = !ledState;

    if (ledState) {
      setLED(r, g, b);
      vibrationStep = 0;
      vibrationOn = false;
      lastVibTime = currentTime;
    } else {
      bool hasNext = ((queueEnd + MAX_ALERTS) - queueStart) % MAX_ALERTS > 1;
      setLED(hasNext ? 255 : 0, hasNext ? 255 : 0, hasNext ? 255 : 0);
      digitalWrite(VIBRATION_MOTOR_PIN, LOW);
    }
  }

  handleVibration(pattern, currentTime);
}

void handleVibration(int pattern, unsigned long currentTime) {
  switch (pattern) {
    case 0: // 2 quick pulses
      if (vibrationStep < 4 && currentTime - lastVibTime >= 100) {
        vibrationOn = !vibrationOn;
        digitalWrite(VIBRATION_MOTOR_PIN, vibrationOn ? HIGH : LOW);
        lastVibTime = currentTime;
        vibrationStep++;
      }
      break;
    case 1: // 3 long pulses
      if (vibrationStep < 6 && currentTime - lastVibTime >= (vibrationStep % 2 == 0 ? 400 : 200)) {
        vibrationOn = !vibrationOn;
        digitalWrite(VIBRATION_MOTOR_PIN, vibrationOn ? HIGH : LOW);
        lastVibTime = currentTime;
        vibrationStep++;
      }
      break;
    case 2: // 4 short pulses
      if (vibrationStep < 8 && currentTime - lastVibTime >= 150) {
        vibrationOn = !vibrationOn;
        digitalWrite(VIBRATION_MOTOR_PIN, vibrationOn ? HIGH : LOW);
        lastVibTime = currentTime;
        vibrationStep++;
      }
      break;
    case 3: // Steady with blinking LED effect
      if (vibrationStep == 0) {
        digitalWrite(VIBRATION_MOTOR_PIN, HIGH);
        vibrationStep++;
      }
      break;
  }
}

// ========== BUTTON ==========
void checkForButtonPress() {
  unsigned long currentTime = millis();
  if (alertActive && digitalRead(BUTTON_PIN) == LOW) {
    if (currentTime - lastButtonPress > DEBOUNCE_DELAY) {
      lastButtonPress = currentTime;
      dequeueAlert();
    }
  }
}

// ========== LED ==========
void setLED(int r, int g, int b) {
  pixels.setPixelColor(0, pixels.Color(r, g, b));
  pixels.show();
}
