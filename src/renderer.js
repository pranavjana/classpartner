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
  initializeMicGain();
  updateAlwaysOnTopStatus();
  initializeAIProcessing();
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
  // Using native Electron dragging via CSS -webkit-app-region: drag
  // No custom JavaScript dragging needed
  console.log('[DRAG] Using native Electron window dragging');
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

        console.log('Microphone access granted, starting audio processing...');

        // For now, let's use the proven ScriptProcessor approach with optimizations
        return this.startRecordingFallback();
        
      } catch (error) {
        console.error('Failed to get microphone access:', error);
        return false;
      }
    },
    
    async startRecordingFallback() {
      console.log('Using ScriptProcessor fallback');
      try {
        // Use Web Audio API with ScriptProcessor fallback
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });
        
        this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = window.micGain || 1.0;
        this.processor = this.audioContext.createScriptProcessor(1024, 1, 1); // Reduced buffer size
        
        this.processor.onaudioprocess = (event) => {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Optimized conversion
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const sample = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = sample < 0 ? (sample * 32768) | 0 : (sample * 32767) | 0;
          }
          
          if (window.electronAPI) {
            console.log(`Fallback: sending ${pcmData.length} samples`);
            window.electronAPI.sendAudioData(Array.from(new Uint8Array(pcmData.buffer)));
          }
        };
        
        this.source.connect(this.gainNode);
        this.gainNode.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
        
        this.isRecording = true;
        return true;
      } catch (error) {
        console.error('Fallback recording failed:', error);
        return false;
      }
    },

    stopRecording() {
      if (this.processor) {
        // Clean up AudioWorklet port listeners
        if (this.processor.port) {
          this.processor.port.onmessage = null;
        }
        this.processor.disconnect();
        this.processor = null;
      }
      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
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

  // Listen for connection quality changes
  window.electronAPI.onConnectionQualityChange((qualityData) => {
    updateConnectionQuality(qualityData);
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
    const result = await window.transcription.start();

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
    // Only clear interim text and add to final if we have actual content
    if (data.text.trim()) {
      interimTextEl.textContent = '';
      addTranscriptLine(data.text, data.confidence);
    }
    // Don't clear interim text for empty final results - this preserves ongoing interim text
  } else {
    // Show interim text (real-time transcription)
    interimTextEl.textContent = data.text;
  }

  // Auto-scroll to bottom
  const transcriptDisplay = document.getElementById('transcript-display');
  transcriptDisplay.scrollTop = transcriptDisplay.scrollHeight;
}

function addTranscriptLine(text, confidence) {
  const finalTextEl = document.getElementById('final-text');
  
  // Remove placeholder if it exists
  const placeholder = document.getElementById('placeholder-text');
  if (placeholder) {
    placeholder.remove();
  }
  
  // Create span for this text segment instead of div (inline element)
  const span = document.createElement('span');
  span.className = 'transcript-segment';
  
  // Add confidence class
  if (confidence >= 0.8) {
    span.classList.add('high-confidence');
  } else if (confidence >= 0.6) {
    span.classList.add('medium-confidence');
  } else {
    span.classList.add('low-confidence');
  }
  
  // Mark as recent
  span.classList.add('recent');
  setTimeout(() => span.classList.remove('recent'), 3000);
  
  span.textContent = text + ' '; // Add space after each segment
  
  // Add to transcript
  transcriptLines.push({
    text: text,
    confidence: confidence,
    timestamp: Date.now(),
    element: span
  });

  // Remove old segments if we exceed the limit
  if (transcriptLines.length > maxTranscriptLines) {
    const oldSegment = transcriptLines.shift();
    if (oldSegment.element && oldSegment.element.parentNode) {
      oldSegment.element.remove();
    }
  }

  finalTextEl.appendChild(span);
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
    // Reset audio level when stopping
    updateAudioLevel(0);
  }
}

// Immediate visual feedback for audio levels (0ms latency)
function updateAudioLevel(level) {
  const audioLevelFill = document.getElementById('audio-level-fill');
  const audioLevelText = document.getElementById('audio-level-text');
  
  if (audioLevelFill && audioLevelText) {
    // Smooth level updates with CSS transitions
    audioLevelFill.style.width = `${level}%`;
    audioLevelText.textContent = `${level}%`;
    
    // Visual feedback: change colors based on level
    if (level > 70) {
      audioLevelFill.style.background = 'linear-gradient(90deg, rgba(34, 197, 94, 0.8) 0%, rgba(251, 191, 36, 0.8) 60%, rgba(239, 68, 68, 0.8) 100%)';
    } else if (level > 30) {
      audioLevelFill.style.background = 'linear-gradient(90deg, rgba(34, 197, 94, 0.8) 0%, rgba(251, 191, 36, 0.8) 100%)';
    } else {
      audioLevelFill.style.background = 'rgba(34, 197, 94, 0.8)';
    }
    
    // Add a subtle pulse effect when speaking
    const recordIcon = document.getElementById('record-icon');
    if (recordIcon && level > 10) {
      recordIcon.style.transform = `scale(${1 + (level / 1000)})`;
    } else if (recordIcon) {
      recordIcon.style.transform = 'scale(1)';
    }
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

// Update connection quality based on latency measurements
function updateConnectionQuality(qualityData) {
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  
  if (statusText && qualityData) {
    const latencyText = qualityData.latency ? ` (${Math.round(qualityData.latency)}ms)` : '';
    
    // Update status text with quality info
    switch (qualityData.quality) {
      case 'good':
        statusText.textContent = `Connected${latencyText}`;
        statusDot.classList.remove('connecting', 'error');
        statusDot.classList.add('connected');
        break;
      case 'fair':
        statusText.textContent = `Connected${latencyText}`;
        statusDot.classList.remove('error');
        statusDot.classList.add('connecting'); // Yellow for fair quality
        break;
      case 'poor':
        statusText.textContent = `Slow${latencyText}`;
        statusDot.classList.remove('connected', 'connecting');
        statusDot.classList.add('error'); // Red for poor quality
        break;
    }
    
    console.log(`Connection quality: ${qualityData.quality}, avg latency: ${Math.round(qualityData.latency)}ms`);
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
console.log('Classroom Assistant Overlay initialized');

// Add development shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    console.log('Development mode active');
  }
});

// Setup resize handles for frameless window
function setupResizeHandles() {
  const resizeBottom = document.getElementById('resize-bottom');
  const resizeRight = document.getElementById('resize-right');
  const resizeBottomRight = document.getElementById('resize-bottom-right');

  let isResizing = false;
  let startX, startY, startWidth, startHeight;

  function startResize(e, direction) {
    isResizing = true;
    startX = e.screenX;
    startY = e.screenY;
    
    // Get current window size from Electron instead of DOM
    window.electronAPI.getWindowBounds().then(bounds => {
      startWidth = bounds.width;
      startHeight = bounds.height;
    });
    
    document.addEventListener('mousemove', (e) => resizeMove(e, direction));
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
  }

  function resizeMove(e, direction) {
    if (!isResizing || startWidth === undefined) return;

    const deltaX = e.screenX - startX;
    const deltaY = e.screenY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;

    if (direction.includes('right')) {
      newWidth = Math.max(300, startWidth + deltaX);
    }
    if (direction.includes('bottom')) {
      newHeight = Math.max(150, startHeight + deltaY);
    }

    // Update Electron window size
    window.electronAPI.resizeWindow(newWidth, newHeight);
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', resizeMove);
    document.removeEventListener('mouseup', stopResize);
  }

  // Add event listeners
  if (resizeBottom) {
    resizeBottom.addEventListener('mousedown', (e) => startResize(e, 'bottom'));
  }
  if (resizeRight) {
    resizeRight.addEventListener('mousedown', (e) => startResize(e, 'right'));
  }
  if (resizeBottomRight) {
    resizeBottomRight.addEventListener('mousedown', (e) => startResize(e, 'bottom-right'));
  }
}

window.ai?.onUpdate?.((payload) => {
  // payload: { summary, actions, keywords, ts }
  const summaryEl = document.querySelector('#ai-summary');
  const actionsEl  = document.querySelector('#ai-actions');
  const tagsEl     = document.querySelector('#ai-keywords');

  if (summaryEl) summaryEl.textContent = payload.summary || '—';
  if (actionsEl) {
    actionsEl.innerHTML = (payload.actions || [])
      .map(a => `<li>${a.title}${a.owner ? ` — ${a.owner}` : ''}${a.due ? ` (due ${a.due})` : ''}</li>`)
      .join('');
  }
  if (tagsEl) {
    tagsEl.innerHTML = (payload.keywords || []).map(k => `<span class="tag">${k}</span>`).join('');
  }
});


// Initialize resize handles
setupResizeHandles();

// AI Processing Functions
function initializeAIProcessing() {
  const aiStatusDot = document.getElementById('ai-status-dot');
  const aiStatusText = document.getElementById('ai-status-text');
  const debugLog = document.getElementById('debug-log');

  // Debug logging function
  function addDebugEntry(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `debug-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    debugLog.appendChild(entry);
    debugLog.scrollTop = debugLog.scrollHeight;
    
    // Keep only last 50 entries
    while (debugLog.children.length > 50) {
      debugLog.removeChild(debugLog.firstChild);
    }
  }

  // Update AI status
  function updateAIStatus(status, message) {
    aiStatusDot.className = `ai-status-dot ${status}`;
    aiStatusText.textContent = message;
  }

  // AI availability check
  if (window.ai && window.ai.availability) {
    window.ai.availability().then(result => {
      addDebugEntry(`AI configured: ${result.configured}, provider: ${result.provider}`, 'info');
      if (result.configured) {
        updateAIStatus('active', 'Ready');
        addDebugEntry('AI pipeline ready', 'success');
      } else {
        updateAIStatus('error', 'Not configured');
        addDebugEntry('AI not configured - check API keys', 'error');
      }
    }).catch(err => {
      addDebugEntry(`AI availability check failed: ${err.message}`, 'error');
      updateAIStatus('error', 'Error');
    });
  } else {
    addDebugEntry('AI API not available', 'error');
    updateAIStatus('error', 'Unavailable');
  }

  // AI event listeners
  if (window.ai) {
    // AI Update events (summaries, actions, keywords)
    window.ai.onUpdate((payload) => {
      addDebugEntry('AI update received', 'success');
      updateAIStatus('active', 'Processing complete');
      
      // Update summary
      const summaryEl = document.getElementById('ai-summary');
      if (payload.summary && summaryEl) {
        summaryEl.textContent = payload.summary;
        summaryEl.classList.remove('placeholder');
      }

      // Update actions
      const actionsEl = document.getElementById('ai-actions');
      if (payload.actions && actionsEl) {
        actionsEl.innerHTML = '';
        if (payload.actions.length > 0) {
          payload.actions.forEach(action => {
            const li = document.createElement('li');
            li.textContent = action.title;
            if (action.owner) li.textContent += ` — ${action.owner}`;
            if (action.due) li.textContent += ` (due ${action.due})`;
            actionsEl.appendChild(li);
          });
        } else {
          const li = document.createElement('li');
          li.className = 'placeholder';
          li.textContent = 'No action items detected';
          actionsEl.appendChild(li);
        }
      }

      // Update keywords
      const keywordsEl = document.getElementById('ai-keywords');
      if (payload.keywords && keywordsEl) {
        keywordsEl.innerHTML = '';
        if (payload.keywords.length > 0) {
          payload.keywords.forEach(keyword => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = keyword;
            keywordsEl.appendChild(span);
          });
        } else {
          const span = document.createElement('span');
          span.className = 'tag placeholder';
          span.textContent = 'No keywords yet';
          keywordsEl.appendChild(span);
        }
      }

      addDebugEntry(`Summary: ${payload.summary?.substring(0, 50)}...`, 'info');
      addDebugEntry(`Actions: ${payload.actions?.length || 0}, Keywords: ${payload.keywords?.length || 0}`, 'info');
    });

    // AI Log events (debug information)
    window.ai.onLog((logData) => {
      addDebugEntry(logData.message || JSON.stringify(logData), 'info');
      
      if (logData.message?.includes('LLM primary=gemini')) {
        updateAIStatus('active', 'Gemini active');
      }
    });

    // AI Error events
    window.ai.onError((errorData) => {
      const errorMsg = errorData.message || JSON.stringify(errorData);
      addDebugEntry(`Error: ${errorMsg}`, 'error');
      updateAIStatus('error', 'Processing error');
      
      // Show error in summary if it's a critical error
      if (errorMsg.includes('API') || errorMsg.includes('key')) {
        const summaryEl = document.getElementById('ai-summary');
        if (summaryEl) {
          summaryEl.textContent = `API Error: ${errorMsg.substring(0, 100)}...`;
          summaryEl.style.color = 'rgba(239, 68, 68, 0.8)';
        }
      }
    });

    // Run initial self-test
    setTimeout(async () => {
      try {
        addDebugEntry('Running AI self-test...', 'info');
        updateAIStatus('processing', 'Testing...');
        
        const result = await window.ai.selftest();
        
        if (result.success) {
          addDebugEntry('Self-test passed!', 'success');
          updateAIStatus('active', 'Self-test passed');
        } else {
          addDebugEntry(`Self-test failed: ${result.error}`, 'error');
          updateAIStatus('error', 'Self-test failed');
        }
      } catch (err) {
        addDebugEntry(`Self-test error: ${err.message}`, 'error');
        updateAIStatus('error', 'Test error');
      }
    }, 2000);
  }

  // Listen for transcription events to update AI status
  if (window.transcription) {
    let lastTranscriptTime = 0;
    
    window.transcription.onData((data) => {
      if (data.is_final && data.text?.trim()) {
        lastTranscriptTime = Date.now();
        updateAIStatus('processing', 'Analyzing...');
        addDebugEntry(`Processing: "${data.text.substring(0, 30)}..."`, 'info');
        
        // Reset status after 15 seconds if no AI update
        setTimeout(() => {
          if (Date.now() - lastTranscriptTime > 14000) {
            const currentStatus = aiStatusDot.className;
            if (currentStatus.includes('processing')) {
              updateAIStatus('active', 'Waiting...');
            }
          }
        }, 15000);
      }
    });
  }
}

// Initialize mic gain slider
function initializeMicGain() {
  const gainSlider = document.getElementById('mic-gain-slider');
  const gainValue = document.getElementById('gain-value');
  
  if (!gainSlider || !gainValue) return;
  
  // Initialize global mic gain
  window.micGain = parseFloat(gainSlider.value) || 1.0;
  
  // Update display
  function updateGainDisplay() {
    const gain = parseFloat(gainSlider.value);
    gainValue.textContent = `${gain.toFixed(1)}x`;
    window.micGain = gain;
    
    // Update gain node if recording
    if (audioService && audioService.gainNode) {
      audioService.gainNode.gain.value = gain;
      console.log('[MIC GAIN] Updated to:', gain);
    }
  }
  
  // Slider event listener
  gainSlider.addEventListener('input', updateGainDisplay);
  
  // Initial display update
  updateGainDisplay();
  
  console.log('[MIC GAIN] Initialized with gain:', window.micGain);
}