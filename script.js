let recognizer = null;
let classLabels = [];
let isRecording = false;
let port = null;
let writer = null;
let lastSentCommand = '';
let lastSentTime = 0;

let probabilityThreshold = 0.75;
let overlapFactor = 0.50;
let arduinoThreshold = 0.6;

const soundColors = {
    "Alarm": "#ff4757",
    "Background Noise": "#666666",
    "Crying Baby": "#ffa502", 
    "Doorbell": "#3742fa",
    "Emergency Vehicle": "#ff3838"
};

document.getElementById('probabilityThreshold').addEventListener('input', (e) => {
    probabilityThreshold = parseFloat(e.target.value);
    document.getElementById('probabilityValue').textContent = probabilityThreshold.toFixed(2);
    addToSerialOutput(`📊 Probability threshold updated: ${probabilityThreshold}`);
});

document.getElementById('overlapFactor').addEventListener('input', (e) => {
    overlapFactor = parseFloat(e.target.value);
    document.getElementById('overlapValue').textContent = overlapFactor.toFixed(2);
    addToSerialOutput(`🔄 Overlap factor updated: ${overlapFactor}`);
});

document.getElementById('arduinoThreshold').addEventListener('input', (e) => {
    arduinoThreshold = parseFloat(e.target.value);
    document.getElementById('thresholdValue').textContent = arduinoThreshold.toFixed(2);
    addToSerialOutput(`🎯 Arduino threshold updated: ${arduinoThreshold}`);
});

async function createModel() {
    try {
        updateStatus('Loading Teachable Machine model...', 'processing');
        
        const URL = "http://localhost:8000/model/";
        
        const checkpointURL = URL + "model.json"; 
        const metadataURL = URL + "metadata.json";
        
        const recognizer = speechCommands.create(
            "BROWSER_FFT", 
            undefined, 
            checkpointURL,
            metadataURL
        );
        
        await recognizer.ensureModelLoaded();
        
        addToSerialOutput('✅ Teachable Machine model loaded successfully');
        addToSerialOutput(`📋 Model URL: ${URL}`);
        
        return recognizer;
    } catch (error) {
        console.error('Error loading Teachable Machine model:', error);
        updateStatus('Failed to load Teachable Machine model', 'error');
        addToSerialOutput('❌ Failed to load model: ' + error.message);
        return null;
    }
}

async function connectToArduino() {
    if ('serial' in navigator) {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            
            writer = port.writable.getWriter();
            
            document.getElementById('arduinoStatus').textContent = 'Connected';
            document.getElementById('arduinoStatus').className = 'arduino-status connected';
            
            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
            const reader = textDecoder.readable.getReader();
            
            readLoop(reader);
            
            addToSerialOutput('✅ Arduino connection established');
        } catch (error) {
            console.error('Arduino connection error:', error);
            addToSerialOutput('❌ Arduino connection failed: ' + error.message);
        }
    } else {
        alert('Web Serial API not supported. Use Chrome/Edge browser.');
    }
}

async function readLoop(reader) {
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value.trim()) {
                addToSerialOutput('Arduino: ' + value.trim());
            }
        }
    } catch (error) {
        console.error('Serial read error:', error);
        addToSerialOutput('❌ Serial read error: ' + error.message);
    }
}

async function sendToArduino(command) {
    if (!writer) {
        addToSerialOutput('❌ Arduino not connected - cannot send: ' + command);
        return false;
    }

    const now = Date.now();
    if (command === lastSentCommand && (now - lastSentTime) < 3000) {
        console.log('Skipping duplicate command:', command);
        return false;
    }

    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(command + '\n');
        
        await writer.write(data);
        addToSerialOutput('📤 Sent to Arduino: ' + command);
        
        lastSentCommand = command;
        lastSentTime = now;
        
        return true;
    } catch (error) {
        console.error('Error sending to Arduino:', error);
        addToSerialOutput('❌ Send error: ' + error.message);
        return false;
    }
}

function testArduinoCommand(command) {
    addToSerialOutput('🧪 Testing command: ' + command);
    sendToArduino(command);
}

function addToSerialOutput(text) {
    const output = document.getElementById('serialOutput');
    const timestamp = new Date().toLocaleTimeString();
    output.innerHTML += `${timestamp}: ${text}<br>`;
    output.scrollTop = output.scrollHeight;
}

async function init() {
    try {
        addToSerialOutput('🚀 Initializing Teachable Machine model...');
        
        recognizer = await createModel();
        if (!recognizer) {
            addToSerialOutput('❌ Failed to initialize model');
            return;
        }
        
        classLabels = recognizer.wordLabels();
        addToSerialOutput(`🏷️ Class labels loaded: ${classLabels.join(', ')}`);
        
        updateConfidenceBars(new Array(classLabels.length).fill(0));
        
        addToSerialOutput('✅ Model initialization complete');
        updateStatus('Model ready - click Start Recognition', 'processing');
        
    } catch (error) {
        console.error('Initialization error:', error);
        addToSerialOutput('❌ Initialization failed: ' + error.message);
        updateStatus('Initialization failed', 'error');
    }
}

async function startRecognition() {
    if (!recognizer) {
        addToSerialOutput('⚠️ Model not loaded, initializing first...');
        await init();
        if (!recognizer) return;
    }
    
    try {
        updateStatus('🎧 Listening with Teachable Machine model...', 'listening');
        
        recognizer.listen(result => {
            const scores = result.scores; 
            
            const maxIndex = scores.indexOf(Math.max(...scores));
            const confidence = scores[maxIndex];
            const predictedLabel = classLabels[maxIndex];
            
            updateConfidenceBars(scores);
            
            if (confidence > 0.2) { 
                document.getElementById('result').innerHTML = 
                    `<span style="color: ${soundColors[predictedLabel] || '#FFF'}">${predictedLabel}</span>`;
                document.getElementById('confidence').textContent = 
                    `Confidence: ${(confidence * 100).toFixed(1)}%`;
                
                document.getElementById('debugInfo').innerHTML = `
                    Teachable Machine Results:<br>
                    Top prediction: ${predictedLabel} (${(confidence * 100).toFixed(1)}%)<br>
                    Threshold: ${probabilityThreshold}, Overlap: ${overlapFactor}<br>
                    ${result.spectrogram ? 'Spectrogram: Available' : 'Spectrogram: Not available'}
                `;
                
                if (confidence > arduinoThreshold && predictedLabel !== "Background Noise") {
                    console.log(`🎯 High confidence detection: ${predictedLabel} (${(confidence*100).toFixed(1)}%)`);
                    const sent = sendToArduino(predictedLabel);
                    if (sent) {
                        addToSerialOutput(`🎵 Sound detected and sent: ${predictedLabel} (${(confidence*100).toFixed(1)}%)`);
                    }
                } else if (predictedLabel !== "Background Noise") {
                    console.log(`🔍 Detection below Arduino threshold: ${predictedLabel} (${(confidence*100).toFixed(1)}%)`);
                }
            } else {
                document.getElementById('result').textContent = 'Listening...';
                document.getElementById('confidence').textContent = 
                    `Max confidence: ${(confidence * 100).toFixed(1)}%`;
            }
            
        }, {
            includeSpectrogram: true, 
            probabilityThreshold: probabilityThreshold,
            invokeCallbackOnNoiseAndUnknown: true,
            overlapFactor: overlapFactor
        });
        
        isRecording = true;
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        
        addToSerialOutput('🎧 Teachable Machine recognition started');
        addToSerialOutput(`Settings: ProbThreshold=${probabilityThreshold}, Overlap=${overlapFactor}, ArduinoThreshold=${arduinoThreshold}`);
        
    } catch (error) {
        console.error('Recognition start error:', error);
        updateStatus('Failed to start recognition', 'error');
        addToSerialOutput('❌ Recognition error: ' + error.message);
    }
}

function stopRecognition() {
    if (recognizer && isRecording) {
        recognizer.stopListening();
        addToSerialOutput('⏹️ Teachable Machine recognition stopped');
    }
    
    isRecording = false;
    updateStatus('Recognition stopped', 'error');
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
}

function updateStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.querySelector('.status-text').textContent = message;
    statusEl.className = `status-panel status ${type}`;
}

function updateConfidenceBars(scores) {
    const barsContainer = document.getElementById('confidenceBars');
    if (!barsContainer || !classLabels.length) return;
    
    barsContainer.innerHTML = '';
    
    for (let i = 0; i < classLabels.length; i++) {
        const confidence = scores[i] || 0;
        const percentage = (confidence * 100).toFixed(1);
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'confidence-item';
        
        itemDiv.innerHTML = `
            <span class="confidence-label">${classLabels[i]}</span>
            <div class="confidence-bar-container">
                <div class="confidence-bar-fill" style="width: ${percentage}%"></div>
            </div>
            <span class="confidence-value">${percentage}%</span>
        `;
        
        barsContainer.appendChild(itemDiv);
    }
}

async function testModel() {
    if (!recognizer) {
        addToSerialOutput('❌ Model not loaded - run Start Recognition first');
        return;
    }
    
    addToSerialOutput('🧪 Testing Teachable Machine model...');
    
    try {
        addToSerialOutput('✅ Model is loaded and ready');
        addToSerialOutput(`📋 Available classes: ${classLabels.join(', ')}`);
        
        const dummyScores = classLabels.map(() => Math.random() * 0.3);
        updateConfidenceBars(dummyScores);
        
    } catch (error) {
        addToSerialOutput('❌ Model test failed: ' + error.message);
        console.error('Model test error:', error);
    }
}

window.addEventListener('beforeunload', async () => {
    if (writer) {
        try {
            writer.releaseLock();
        } catch (e) {}
    }
    if (port) {
        try {
            await port.close();
        } catch (e) {}
    }
});

window.addEventListener('load', () => {
    init();
    
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            addToSerialOutput('✅ Microphone access granted');
            stream.getTracks().forEach(track => track.stop());
        })
        .catch(err => {
            addToSerialOutput('❌ Microphone access denied: ' + err.message);
        });
});