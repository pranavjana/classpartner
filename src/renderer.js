// Renderer process script for window controls and interactions

let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Transcription state
let isRecording = false;
let audioService = null;
let transcriptLines = [];
let maxTranscriptLines = 50;

// Wait for DOM to be loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeWindowControls();
  initializeContextMenu();
  initializeDragFunctionality();
  initializeTranscription();
  updateAlwaysOnTopStatus();
});

function initializeWindowControls() {
  // Close button
  const closeBtn = document.getElementById('close-btn');
  closeBtn.addEventListener('click', async () => {
    await window.electronAPI.closeWindow();
  });

  // Minimize button
  const minimizeBtn = document.getElementById('minimize-btn');
  minimizeBtn.addEventListener('click', async () => {
    await window.electronAPI.minimizeWindow();
  });

  // Record button
  const recordBtn = document.getElementById('record-btn');
  recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      await stopRecording();
    }
  });

  // Settings button (placeholder for future)
  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn.addEventListener('click', () => {
    showNotification('Settings will be available in a future update');
  });
}

function initializeContextMenu() {
  const contextMenu = document.getElementById('context-menu');
  const overlayContainer = document.querySelector('.overlay-container');
  
  // Show context menu on right-click
  overlayContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY);
  });

  // Hide context menu on click outside
  document.addEventListener('click', () => {
    hideContextMenu();
  });

  // Handle always-on-top toggle
  const toggleAlwaysOnTop = document.getElementById('toggle-always-on-top');
  toggleAlwaysOnTop.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isOnTop = await window.electronAPI.toggleAlwaysOnTop();
    updateAlwaysOnTopStatus(isOnTop);
    hideContextMenu();
  });
}

function initializeDragFunctionality() {
  const headerBar = document.getElementById('header-bar');
  const overlayContainer = document.querySelector('.overlay-container');

  // Mouse down on header starts drag
  headerBar.addEventListener('mousedown', (e) => {
    // Don't start drag if clicking on buttons
    if (e.target.closest('.control-btn')) return;
    
    isDragging = true;
    dragOffset.x = e.clientX;
    dragOffset.y = e.clientY;
    overlayContainer.classList.add('dragging');
    
    // Prevent text selection during drag
    e.preventDefault();
  });

  // Handle drag movement
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragOffset.x;
    const deltaY = e.clientY - dragOffset.y;
    
    // Move window via IPC (this will be handled in main process)
    window.electronAPI.moveWindow(deltaX, deltaY);
    
    dragOffset.x = e.clientX;
    dragOffset.y = e.clientY;
  });

  // End drag on mouse up
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      overlayContainer.classList.remove('dragging');
    }
  });
}

function showContextMenu(x, y) {
  const contextMenu = document.getElementById('context-menu');
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.style.display = 'block';
}

function hideContextMenu() {
  const contextMenu = document.getElementById('context-menu');
  contextMenu.style.display = 'none';
}

async function updateAlwaysOnTopStatus(isOnTop) {
  if (isOnTop === undefined) {
    // Query current status
    isOnTop = await window.electronAPI.isAlwaysOnTop();
  }
  
  const checkMark = document.getElementById('always-on-top-check');
  checkMark.style.display = isOnTop ? 'inline' : 'none';
}

function showNotification(message) {
  // Create a temporary notification
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 11px;
    z-index: 1001;
    animation: fadeInOut 2s ease-in-out;
  `;

  // Add fade animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0%, 100% { opacity: 0; }
      20%, 80% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    document.body.removeChild(notification);
    document.head.removeChild(style);
  }, 2000);
}

// Handle keyboard shortcuts (additional to global shortcut)
document.addEventListener('keydown', (e) => {
  // Escape key hides context menu
  if (e.key === 'Escape') {
    hideContextMenu();
  }
});

// Initialize transcription functionality
function initializeTranscription() {
  // Import and initialize AudioService
  try {
    if (typeof window !== 'undefined' && window.AudioService) {
      audioService = new window.AudioService();
    } else {
      // Create a simple audio service for the browser context
      audioService = createBrowserAudioService();
    }
    setupTranscriptionEventListeners();
  } catch (error) {
    console.error('Failed to initialize audio service:', error);
    showError('Failed to initialize audio system');
  }
}

function createBrowserAudioService() {
  return {
    async requestMicrophonePermission() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (error) {
        return false;
      }
    },

    async startRecording() {
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        // Use Web Audio API to get raw PCM data for Deepgram
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });
        
        this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        this.processor.onaudioprocess = (event) => {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Convert Float32Array to Int16Array for Deepgram
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const sample = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          }
          
          // Send PCM data to main process
          if (window.electronAPI) {
            console.log('Sending PCM audio chunk, size:', pcmData.length);
            window.electronAPI.sendAudioData(Array.from(new Uint8Array(pcmData.buffer)));
          }
        };
        
        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        
        this.isRecording = true;
        return true;
      } catch (error) {
        console.error('Failed to start recording:', error);
        return false;
      }
    },

    stopRecording() {
      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }
      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
        this.audioContext = null;
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      this.isRecording = false;
      return true;
    },

    isCurrentlyRecording() {
      return this.isRecording || false;
    }
  };
}

function setupTranscriptionEventListeners() {
  if (!window.electronAPI) return;

  // Listen for transcription data
  window.electronAPI.onTranscriptionData((data) => {
    console.log('Received transcription data in renderer:', data);
    handleTranscriptionData(data);
  });

  // Listen for transcription status changes
  window.electronAPI.onTranscriptionStatus((status) => {
    updateConnectionStatus(status);
  });

  // Listen for transcription errors
  window.electronAPI.onTranscriptionError((error) => {
    showError(error.message);
  });

  // Listen for connection events
  window.electronAPI.onTranscriptionConnected(() => {
    updateConnectionStatus('connected');
  });

  window.electronAPI.onTranscriptionDisconnected(() => {
    updateConnectionStatus('disconnected');
  });
}

async function startRecording() {
  try {
    // Check microphone permission
    const hasPermission = await audioService.requestMicrophonePermission();
    if (!hasPermission) {
      showError('Microphone permission denied. Please enable microphone access.');
      return;
    }

    // Start Deepgram transcription
    updateConnectionStatus('connecting');
    const result = await window.electronAPI.startTranscription();
    
    if (!result.success) {
      showError(result.error || 'Failed to start transcription');
      return;
    }

    // Start audio recording
    const audioStarted = await audioService.startRecording();
    if (!audioStarted) {
      showError('Failed to start audio recording');
      await window.electronAPI.stopTranscription();
      return;
    }

    isRecording = true;
    updateRecordingUI(true);
    hideError();
    hidePlaceholderText();

  } catch (error) {
    console.error('Failed to start recording:', error);
    showError(`Failed to start recording: ${error.message}`);
    updateRecordingUI(false);
  }
}

async function stopRecording() {
  try {
    isRecording = false;
    updateRecordingUI(false);

    // Stop audio recording
    if (audioService) {
      audioService.stopRecording();
    }

    // Stop Deepgram transcription
    await window.electronAPI.stopTranscription();
    updateConnectionStatus('disconnected');

  } catch (error) {
    console.error('Failed to stop recording:', error);
    showError(`Failed to stop recording: ${error.message}`);
  }
}

function handleTranscriptionData(data) {
  const interimTextEl = document.getElementById('interim-text');
  const finalTextEl = document.getElementById('final-text');

  if (data.is_final) {
    // Clear interim text
    interimTextEl.textContent = '';
    
    // Add to final transcript
    if (data.text.trim()) {
      addTranscriptLine(data.text, data.confidence);
    }
  } else {
    // Show interim text
    interimTextEl.textContent = data.text;
  }

  // Auto-scroll to bottom
  const transcriptDisplay = document.getElementById('transcript-display');
  transcriptDisplay.scrollTop = transcriptDisplay.scrollHeight;
}

function addTranscriptLine(text, confidence) {
  const finalTextEl = document.getElementById('final-text');
  
  // Create new transcript line
  const line = document.createElement('div');
  line.className = 'transcript-line';
  
  // Add confidence class
  if (confidence >= 0.8) {
    line.classList.add('high-confidence');
  } else if (confidence >= 0.6) {
    line.classList.add('medium-confidence');
  } else {
    line.classList.add('low-confidence');
  }
  
  // Mark as recent
  line.classList.add('recent');
  setTimeout(() => line.classList.remove('recent'), 3000);
  
  line.textContent = text;
  
  // Add to transcript
  transcriptLines.push({
    text: text,
    confidence: confidence,
    timestamp: Date.now(),
    element: line
  });

  // Remove old lines if we exceed the limit
  if (transcriptLines.length > maxTranscriptLines) {
    const oldLine = transcriptLines.shift();
    if (oldLine.element && oldLine.element.parentNode) {
      oldLine.element.remove();
    }
  }

  finalTextEl.appendChild(line);
}

function updateRecordingUI(recording) {
  const recordBtn = document.getElementById('record-btn');
  const recordText = document.getElementById('record-text');
  const recordingIndicator = document.getElementById('recording-indicator');
  const audioLevelContainer = document.getElementById('audio-level-container');

  if (recording) {
    recordBtn.classList.add('recording');
    recordBtn.title = 'Stop Recording';
    recordText.textContent = 'Stop';
    recordingIndicator.classList.remove('hidden');
    audioLevelContainer.classList.remove('hidden');
  } else {
    recordBtn.classList.remove('recording');
    recordBtn.title = 'Start Recording';
    recordText.textContent = 'Start';
    recordingIndicator.classList.add('hidden');
    audioLevelContainer.classList.add('hidden');
  }
}

function updateConnectionStatus(status) {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  // Remove all status classes
  statusDot.classList.remove('connected', 'connecting', 'error');

  switch (status) {
    case 'connected':
      statusDot.classList.add('connected');
      statusText.textContent = 'Connected';
      break;
    case 'connecting':
    case 'reconnecting':
      statusDot.classList.add('connecting');
      statusText.textContent = 'Connecting...';
      break;
    case 'error':
      statusDot.classList.add('error');
      statusText.textContent = 'Error';
      break;
    case 'disconnected':
    default:
      statusText.textContent = 'Disconnected';
      break;
  }
}

function showError(message) {
  const finalTextEl = document.getElementById('final-text');
  
  // Remove existing error messages
  const existingErrors = finalTextEl.querySelectorAll('.error-message');
  existingErrors.forEach(error => error.remove());

  // Create error message element
  const errorEl = document.createElement('div');
  errorEl.className = 'error-message';
  errorEl.innerHTML = `
    <div class="error-title">Error</div>
    <div class="error-details">${message}</div>
  `;

  finalTextEl.appendChild(errorEl);

  // Auto-remove error after 5 seconds
  setTimeout(() => {
    if (errorEl.parentNode) {
      errorEl.remove();
    }
  }, 5000);
}

function hideError() {
  const finalTextEl = document.getElementById('final-text');
  const existingErrors = finalTextEl.querySelectorAll('.error-message');
  existingErrors.forEach(error => error.remove());
}

function hidePlaceholderText() {
  const placeholderEl = document.getElementById('placeholder-text');
  if (placeholderEl) {
    placeholderEl.style.display = 'none';
  }
}

function showPlaceholderText() {
  const placeholderEl = document.getElementById('placeholder-text');
  if (placeholderEl && transcriptLines.length === 0) {
    placeholderEl.style.display = 'block';
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (isRecording) {
    stopRecording();
  }
  if (window.electronAPI) {
    window.electronAPI.removeTranscriptionListeners();
  }
});

// Prevent default drag behavior on images and other elements
document.addEventListener('dragstart', (e) => {
  e.preventDefault();
});

// Add some debugging for development
if (process.env.NODE_ENV === 'development') {
  console.log('Classroom Assistant Overlay initialized');
  
  // Add development shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      console.log('Development mode active');
    }
  });
}