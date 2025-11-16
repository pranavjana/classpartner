// Renderer process script for window controls and interactions

let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Transcription state
let isRecording = false;
let audioService = null;
let transcriptLines = [];
let currentSessionId = null; // NEW: Track current session
let totalSegmentCount = 0;   // NEW: Total segments in database
let transcriptDisplayEl = null;
let shouldAutoScroll = true;

const lostState = {
  sessionId: null,
  startedAt: null,
  classId: null,
  recordId: null,
  markers: [],
  queue: [],
  processing: false,
  lastTriggerAt: 0,
  classes: null,
};

const LOST_LIMITS = {
  windowMs: 8 * 60 * 1000,
  maxWindowMs: 12 * 60 * 1000,
  minElapsedMs: 90 * 1000,
  minGapMs: 60 * 1000,
  includePrereq: 2,
  maxSegments: 450,
  maxExcerptChars: 6000,
  contextSnippetLimit: 4,
};

let lostButtonEl = null;
let lostTimelineEl = null;
let lostRecapListEl = null;
let lostStatusEl = null;

const appearanceState = {
  theme: 'system',
  accentHex: '#6366f1',
  transparency: 0,
};

function normalizeHex(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return null;
  const expanded = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  return `#${expanded.slice(0, 6)}`.toLowerCase();
}

function linearize(channel) {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function getReadableText(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
}

function applyAccentColor(accent) {
  if (typeof document === 'undefined') return;
  const normalized = normalizeHex(accent) || appearanceState.accentHex;
  const foreground = getReadableText(normalized);
  const root = document.documentElement;
  const accentVars = {
    '--primary': normalized,
    '--primary-foreground': foreground,
    '--accent': normalized,
    '--accent-foreground': foreground,
    '--sidebar-accent': normalized,
    '--sidebar-accent-foreground': foreground,
    '--sidebar-primary': normalized,
    '--sidebar-primary-foreground': foreground,
  };
  Object.entries(accentVars).forEach(([key, value]) => root.style.setProperty(key, value));
  appearanceState.accentHex = normalized;
}

function applyTransparencySetting(value) {
  if (typeof document === 'undefined') return;
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  const normalized = 1 - percent / 100;
  const clamp = (min, max, val) => Math.min(max, Math.max(min, val));
  const surface = clamp(0.14, 0.96 - 0.82 * (percent / 100), 0.96);
  const muted = clamp(0.08, surface - 0.05, 0.9);
  const background = clamp(0.04, surface - 0.12, 0.86);
  const hover = clamp(0.02, 0.02 + 0.06 * normalized, 0.08);
  const hoverStrong = clamp(0.03, 0.04 + 0.08 * normalized, 0.12);
  const root = document.documentElement;
  root.style.setProperty('--cp-surface-opacity', surface.toFixed(3));
  root.style.setProperty('--cp-surface-muted-opacity', muted.toFixed(3));
  root.style.setProperty('--cp-background-opacity', background.toFixed(3));
  root.style.setProperty('--cp-hover-opacity', hover.toFixed(3));
  root.style.setProperty('--cp-hover-strong-opacity', hoverStrong.toFixed(3));
  appearanceState.transparency = percent;
}

function applyThemeSetting(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    root.classList.toggle('dark', prefersDark);
    root.dataset.theme = prefersDark ? 'brand-dark' : 'brand';
  } else {
    const isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    root.dataset.theme = isDark ? 'brand-dark' : 'brand';
  }
  appearanceState.theme = theme;
}

async function initializeAppearance() {
  if (typeof window === 'undefined') return;
  try {
    const settings = await window.electronAPI?.getSettings?.();
    const general = settings?.generalSettings;
    if (general) {
      if (typeof general.theme === 'string') {
        applyThemeSetting(general.theme);
      }
      if (typeof general.accentHex === 'string') {
        applyAccentColor(general.accentHex);
      }
      if (typeof general.transparency === 'number') {
        applyTransparencySetting(general.transparency);
      }
    }
  } catch (error) {
    console.warn('[Overlay] Failed to apply appearance settings:', error);
  }

  window.electronAPI?.onSettingsUpdated?.((snapshot) => {
    const general = snapshot?.generalSettings;
    if (!general) return;
    if (typeof general.theme === 'string' && general.theme !== appearanceState.theme) {
      applyThemeSetting(general.theme);
    }
    if (
      typeof general.accentHex === 'string' &&
      normalizeHex(general.accentHex) !== appearanceState.accentHex
    ) {
      applyAccentColor(general.accentHex);
    }
    if (
      typeof general.transparency === 'number' &&
      general.transparency !== appearanceState.transparency
    ) {
      applyTransparencySetting(general.transparency);
    }
  });
}

// Wait for DOM to be loaded
document.addEventListener('DOMContentLoaded', () => {
  void initializeAppearance();
  initializeWindowControls();
  initializeContextMenu();
  initializeDragFunctionality();
  initializeTranscription();
  initializeMicGain();
  updateAlwaysOnTopStatus();
  initializeAIProcessing();
  setupTranscriptScrollTracking();
  initializeLostRecapUI();
  initializeTranscriptControls();
  initializeLostPanelToggle();
  initializePanelToggles();
  initializeResponsiveLayout();
  setupQnABox();

  window.ai?.onLog?.((m) => console.log('[ai log]', m));
  window.ai?.onError?.((e) => console.warn('[ai error]', e));
  window.ai?.onUpdate?.((p) => console.log('[ai update]', p));
});

function initializeWindowControls() {
  // Close button
  const closeBtn = document.getElementById('close-btn');
  closeBtn?.addEventListener('click', async () => {
    await window.electronAPI.closeWindow();
  });

  // Minimize button
  const minimizeBtn = document.getElementById('minimize-btn');
  minimizeBtn?.addEventListener('click', async () => {
    await window.electronAPI.minimizeWindow();
  });

  // Maximize / restore button
  const maximizeBtn = document.getElementById('maximize-btn');
  if (maximizeBtn) {
    const syncMaximizeState = (isMaximized) => {
      maximizeBtn.dataset.state = isMaximized ? 'maximized' : 'restored';
    };

    maximizeBtn.addEventListener('click', async () => {
      const isMaximized = await window.electronAPI.toggleMaximizeWindow();
      syncMaximizeState(isMaximized);
    });

    window.electronAPI.isWindowMaximized().then(syncMaximizeState).catch(() => {});
    window.electronAPI.onWindowStateChange((state) => syncMaximizeState(Boolean(state)));
  }

  // Record button
  const recordBtn = document.getElementById('record-btn');
  recordBtn?.addEventListener('click', async () => {
    if (!isRecording) await startRecording();
    else await stopRecording();
  });
  if (recordBtn) {
    recordBtn.setAttribute('aria-pressed', isRecording ? 'true' : 'false');
  }

  // Settings button (placeholder for future)
  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn?.addEventListener('click', () => {
    showNotification('Settings will be available in a future update');
  });

  // NEW: Download button
  const downloadBtn = document.getElementById('download-btn');
  if (downloadBtn) {
    downloadBtn.classList.toggle('disabled', !currentSessionId);
    downloadBtn.disabled = !currentSessionId;
    downloadBtn.addEventListener('click', async () => {
      await downloadTranscript();
    });
  }
}

function initializeContextMenu() {
  const overlayRoot = document.querySelector('.overlay-root');
  if (!overlayRoot) return;

  overlayRoot.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY);
  });

  document.addEventListener('click', () => hideContextMenu());

  const toggleAlwaysOnTop = document.getElementById('toggle-always-on-top');
  toggleAlwaysOnTop?.addEventListener('click', async (event) => {
    event.stopPropagation();
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

function setupTranscriptScrollTracking() {
  transcriptDisplayEl = document.getElementById('transcript-display');
  if (!transcriptDisplayEl) return;
  shouldAutoScroll = true;
  transcriptDisplayEl.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = transcriptDisplayEl;
    shouldAutoScroll = scrollTop + clientHeight >= scrollHeight - 32;
  });
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

  const key = typeof e.key === 'string' ? e.key.toLowerCase() : '';
  
  // Lost moment trigger (Cmd/Ctrl + L)
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && key === 'l') {
    const target = e.target;
    const tag = target?.tagName?.toLowerCase();
    const isEditable =
      target?.isContentEditable ||
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select';
    if (isEditable) return;
    e.preventDefault();
    triggerLostMoment('hotkey');
  }
  
  // Panel toggle shortcuts
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
    const target = e.target;
    const tag = target?.tagName?.toLowerCase();
    const isEditable =
      target?.isContentEditable ||
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select';
    if (isEditable) return;
    
    if (key === '1') {
      e.preventDefault();
      togglePanelById('transcript-panel');
    } else if (key === '2') {
      e.preventDefault();
      togglePanelById('ai-panel');
    } else if (key === '3') {
      e.preventDefault();
      togglePanelById('lost-panel');
    } else if (key === '4') {
      e.preventDefault();
      toggleQAPanel();
    }
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

    // NEW: Store session ID
    currentSessionId = result.sessionId;
    onSessionStarted(result.sessionId);
    await syncLostSessionState();
    console.log('[RENDERER] Session started:', currentSessionId);

    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) {
      downloadBtn.classList.remove('disabled');
      downloadBtn.disabled = false;
    }

    // Start audio recording
    const audioStarted = await audioService.startRecording();
    if (!audioStarted) {
      showError('Failed to start audio recording');
      await window.electronAPI.stopTranscription();
      return;
    }

    isRecording = true;
    totalSegmentCount = 0;
    updateRecordingUI(true);
    updateSegmentCounter(0);
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
    const result = await window.electronAPI.stopTranscription();
    updateConnectionStatus('disconnected');

    // NEW: Log session end
    if (result.success && result.sessionId) {
      console.log('[RENDERER] Session ended:', result.sessionId, result.stats);
      showNotification(`Session saved: ${result.stats?.segmentCount || 0} segments`);
    }
    await syncLostSessionState();

    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn && currentSessionId) {
      downloadBtn.classList.remove('disabled');
      downloadBtn.disabled = false;
    }

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

  if (transcriptDisplayEl && shouldAutoScroll) {
    transcriptDisplayEl.scrollTop = transcriptDisplayEl.scrollHeight;
  }
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

  // NEW: Increment total segment count
  totalSegmentCount++;
  updateSegmentCounter(totalSegmentCount);

  // Keep all segments - no removal for full history
  finalTextEl.appendChild(span);
}

function updateRecordingUI(recording) {
  const recordBtn = document.getElementById('record-btn');
  const recordText = document.getElementById('record-text');
  const recordingIndicator = document.getElementById('recording-indicator');
  const audioLevelContainer = document.getElementById('audio-level-container');

  if (!recordBtn || !recordText || !recordingIndicator || !audioLevelContainer) return;

  if (recording) {
    recordBtn.classList.add('recording');
    recordBtn.title = 'Stop Recording';
    recordText.textContent = 'Stop';
    recordingIndicator.classList.remove('hidden');
    audioLevelContainer.classList.remove('hidden');
    recordBtn.setAttribute('aria-pressed', 'true');
  } else {
    recordBtn.classList.remove('recording');
    recordBtn.title = 'Start Recording';
    recordText.textContent = 'Start';
    recordingIndicator.classList.add('hidden');
    audioLevelContainer.classList.add('hidden');
    recordBtn.setAttribute('aria-pressed', 'false');
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
  const statusContainer = document.getElementById('connection-status');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  if (!statusContainer || !statusDot || !statusText) return;

  statusContainer.classList.remove('connected', 'warning');
  statusDot.className = 'status-dot';

  switch (status) {
    case 'connected':
      statusContainer.classList.add('connected');
      statusText.textContent = 'Connected';
      break;
    case 'connecting':
    case 'reconnecting':
      statusText.textContent = 'Connecting...';
      break;
    case 'error':
      statusContainer.classList.remove('connected', 'warning');
      statusText.textContent = 'Connection error';
      break;
    case 'disconnected':
    default:
      statusText.textContent = 'Disconnected';
      break;
  }
}

// Update connection quality based on latency measurements
function updateConnectionQuality(qualityData) {
  const statusContainer = document.getElementById('connection-status');
  const statusText = document.getElementById('status-text');

  if (!statusContainer || !statusText || !qualityData) return;

  const latencyText = qualityData.latency ? ` (${Math.round(qualityData.latency)}ms)` : '';
  statusContainer.classList.remove('connected', 'warning');

  switch (qualityData.quality) {
    case 'good':
      statusContainer.classList.add('connected');
      statusText.textContent = `Connected${latencyText}`;
      break;
    case 'fair':
      statusContainer.classList.add('connected');
      statusText.textContent = `Stable${latencyText}`;
      break;
    case 'poor':
      statusContainer.classList.add('warning');
      statusText.textContent = `Slow${latencyText}`;
      break;
    default:
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

  if (summaryEl) {
    const summary = typeof payload.summary === 'string' && payload.summary.trim().length
      ? payload.summary
      : 'Waiting for conversation...';
    summaryEl.textContent = summary;
    summaryEl.classList.toggle('placeholder', summary === 'Waiting for conversation...');
  }
  if (actionsEl) {
    actionsEl.innerHTML = (payload.actions || [])
      .map((action) => {
        const title = action.title || action;
        const owner = action.owner ? ` — ${action.owner}` : '';
        const due = action.due ? ` (due ${action.due})` : '';
        return `<li>${title}${owner}${due}</li>`;
      })
      .join('');
    if (!payload.actions || payload.actions.length === 0) {
      actionsEl.innerHTML = '<li class="placeholder">No action items detected</li>';
    }
  }
  if (tagsEl) {
    if (payload.keywords && payload.keywords.length) {
      tagsEl.innerHTML = payload.keywords.map((keyword) => `<span class="keyword-chip">${keyword}</span>`).join('');
    } else {
      tagsEl.innerHTML = '<span class="keyword-chip placeholder">No keywords yet</span>';
    }
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
    if (!debugLog) return;
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
            span.className = 'keyword-chip';
            span.textContent = keyword;
            keywordsEl.appendChild(span);
          });
        } else {
          const span = document.createElement('span');
          span.className = 'keyword-chip placeholder';
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

function esc(s) { return String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function renderQAResult(container, res) {
  if (!res || !res.success) {
    container.innerHTML = `<div class="qa-muted">Error: ${esc(res?.error || 'Unknown error')}</div>`;
    return;
  }
  const { mode, answer, snippets } = res;
  const header = (mode === 'qa' && answer)
    ? `<div class="qa-answer">${esc(answer)}</div>`
    : `<div class="qa-muted">Showing relevant snippets while the model cools down.</div>`;

  // snippets is newline-separated lines from the worker; we’ll also request raw ranges next
  const items = (snippets || '').split('\n').filter(Boolean).map((line, i) => {
    return `<li class="qa-snippet" data-i="${i}">${esc(line)}</li>`;
  }).join('');

  container.innerHTML = `${header}<ul class="qa-list">${items}</ul>`;

  // Optional: if you later include raw time ranges, wire click to jump
  container.querySelectorAll('.qa-snippet').forEach((li) => {
    li.addEventListener('click', () => {
      // If you extend worker to return raw times, pass them here. For now this emits a generic event.
      window.bus?.jumpTo?.({ startMs: null, endMs: null }); 
    });
  });
}

function setupQnABox() {
  const input = document.getElementById('qa-input');
  const btn   = document.getElementById('qa-btn');
  const out   = document.getElementById('qa-results');
  if (!input || !btn || !out) return;

  let busy = false;
  async function ask(mode) {
    if (busy) return;
    const q = (input.value || '').trim();
    if (!q) return;
    busy = true;
    out.innerHTML = `<div class="qa-muted">Asking...</div>`;
    
    try {
      const res = await window.api.invoke('ai:query', { query: q, opts: { k: 6, mode } });
      renderQAResult(out, res);
    } catch (e) {
      renderQAResult(out, { success: false, error: String(e?.message ?? e) });
    } finally {
      busy = false;
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // Cmd/Ctrl+Enter forces snippets-only (useful if throttled)
      const forceSnippets = e.metaKey || e.ctrlKey;
      ask(forceSnippets ? 'snippets' : undefined);
    }
  });
  btn.addEventListener('click', () => ask(undefined));
}

/* -------------------------------------------------------
 * Lost recap feature
 * ----------------------------------------------------- */
async function initializeLostRecapUI() {
  lostButtonEl = document.getElementById('lost-btn');
  lostTimelineEl = document.getElementById('lost-timeline');
  lostRecapListEl = document.getElementById('lost-recap-list');
  lostStatusEl = document.getElementById('lost-status-pill');

  if (lostButtonEl) {
    lostButtonEl.addEventListener('click', () => {
      triggerLostMoment('button');
      // Auto-expand lost panel when triggered
      const lostPanel = document.getElementById('lost-panel');
      if (lostPanel && !lostPanel.classList.contains('expanded')) {
        lostPanel.classList.add('expanded');
        lostPanel.classList.add('visible');
        lostPanel.style.display = 'block';
      }
    });
    const shortcutLabel = lostButtonEl.querySelector('.lost-trigger-shortcut');
    if (shortcutLabel) {
      const isMac = navigator.userAgent.includes('Mac');
      shortcutLabel.textContent = isMac ? '⌘L' : 'Ctrl+L';
    }
  }
  updateLostButtonState(Boolean(currentSessionId));
  updateLostStatus();
  renderLostTimeline();
  renderLostRecapCards();
  void loadClassesOnce();
  await syncLostSessionState();
}

function updateLostButtonState(enabled) {
  if (!lostButtonEl) return;
  lostButtonEl.disabled = !enabled;
  lostButtonEl.setAttribute('aria-disabled', String(!enabled));
}

async function syncLostSessionState() {
  if (!window.transcriptStorage?.getCurrentSession) return;
  try {
    const snapshot = await window.transcriptStorage.getCurrentSession();
    if (!snapshot || !snapshot.sessionId) {
      lostState.sessionId = null;
      lostState.classId = null;
      lostState.recordId = null;
      updateLostButtonState(false);
      return;
    }
    lostState.sessionId = snapshot.sessionId;
    if (snapshot.classId !== undefined) lostState.classId = snapshot.classId;
    if (snapshot.recordId !== undefined) lostState.recordId = snapshot.recordId;
    if (snapshot.startedAt) lostState.startedAt = snapshot.startedAt;
    updateLostButtonState(true);
  } catch (error) {
    console.warn('[LostRecap] Failed to sync session', error);
  }
}

function onSessionStarted(sessionId) {
  if (lostState.sessionId && lostState.sessionId !== sessionId) {
    lostState.markers = [];
    lostState.queue = [];
    lostState.processing = false;
    lostState.lastTriggerAt = 0;
    renderLostTimeline();
    renderLostRecapCards();
  }
  lostState.sessionId = sessionId;
  lostState.startedAt = Date.now();
  lostState.classId = null;
  lostState.recordId = null;
  updateLostButtonState(Boolean(sessionId));
}

async function ensureLostSessionSnapshot() {
  if (!window.transcriptStorage?.getCurrentSession) return;
  try {
    const snapshot = await window.transcriptStorage.getCurrentSession();
    if (!snapshot) return;
    if (snapshot.sessionId) lostState.sessionId = snapshot.sessionId;
    if (snapshot.classId !== undefined) lostState.classId = snapshot.classId;
    if (snapshot.recordId !== undefined) lostState.recordId = snapshot.recordId;
    if (snapshot.startedAt) lostState.startedAt = snapshot.startedAt;
  } catch (error) {
    console.warn('[LostRecap] Failed to refresh session snapshot', error);
  }
}

async function triggerLostMoment(source = 'button') {
  await ensureLostSessionSnapshot();
  const sessionId = lostState.sessionId || currentSessionId;
  if (!sessionId) {
    showNotification('Start recording to drop a lost marker.');
    return;
  }

  const now = Date.now();
  if (lostState.lastTriggerAt && now - lostState.lastTriggerAt < LOST_LIMITS.minGapMs) {
    const wait = Math.ceil((LOST_LIMITS.minGapMs - (now - lostState.lastTriggerAt)) / 1000);
    showNotification(`Hang on ${wait}s before the next marker.`);
    return;
  }

  const elapsed = lostState.startedAt ? now - lostState.startedAt : null;
  if (!elapsed || elapsed < LOST_LIMITS.minElapsedMs) {
    showNotification('Need a little more context before I can recap (≈90s).');
    return;
  }

  const marker = {
    id: `lost_${now}`,
    sessionId,
    classId: lostState.classId || null,
    recordId: lostState.recordId || null,
    markerMs: elapsed,
    absoluteMs: lostState.startedAt ? lostState.startedAt + elapsed : now,
    flaggedAt: now,
    status: 'queued',
    cutoffMs: lostState.startedAt ? lostState.startedAt + elapsed : now,
    structured: null,
    summary: null,
    error: null,
    excerpt: null,
  };

  lostState.lastTriggerAt = now;
  lostState.markers.push(marker);
  renderLostTimeline();
  renderLostRecapCards();
  enqueueLostRecap(marker.id);

  if (lostState.processing || lostState.queue.length > 1) {
    showNotification('Recap queued. Finishing prior request first.');
  } else {
    showNotification('Marker saved — generating recap…');
  }
}

function enqueueLostRecap(markerId) {
  lostState.queue.push(markerId);
  updateLostStatus();
  void processLostQueue();
}

async function processLostQueue() {
  if (lostState.processing) return;
  const nextId = lostState.queue.shift();
  if (!nextId) {
    lostState.processing = false;
    updateLostStatus();
    return;
  }
  const marker = lostState.markers.find((m) => m.id === nextId);
  if (!marker) {
    void processLostQueue();
    return;
  }

  lostState.processing = true;
  marker.status = 'pending';
  marker.error = null;
  updateLostStatus();
  renderLostTimeline();
  renderLostRecapCards();

  try {
    await runLostRecap(marker);
    marker.status = 'ready';
  } catch (error) {
    const message = error?.message || 'Failed to generate recap';
    marker.status = 'error';
    marker.error = message;
    console.warn('[LostRecap] Generation failed:', message);
  } finally {
    renderLostTimeline();
    renderLostRecapCards();
    lostState.processing = false;
    updateLostStatus();
    if (lostState.queue.length) {
      void processLostQueue();
    }
  }
}

async function runLostRecap(marker) {
  const transcriptWindow = await fetchTranscriptWindow(marker);
  const segments = transcriptWindow.segments || [];
  if (!segments.length) {
    throw new Error('Not enough transcript yet — try again in a moment.');
  }
  marker.excerpt = formatTranscriptExcerpt(segments, transcriptWindow.session?.startTime);
  const windowMinutes = Math.max(
    1,
    Math.round(
      Math.min(LOST_LIMITS.windowMs, transcriptWindow.rangeMs ?? LOST_LIMITS.windowMs) / 60000
    )
  );

  const contextInfo = await fetchCourseContext(marker.classId);
  const prompts = buildLostPrompts(marker, marker.excerpt, contextInfo, windowMinutes);
  if (!window.ai?.lostRecap) {
    throw new Error('AI bridge unavailable');
  }

  const aiResult = await window.ai.lostRecap({
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    temperature: 0.22,
    responseFormat: { type: 'json_object' },
  });

  if (!aiResult) throw new Error('AI did not respond');
  if (aiResult.success === false) {
    throw new Error(aiResult.error || 'AI request failed');
  }

  const raw = aiResult.result || aiResult.payload?.result || '';
  const structured = parseLostRecapResponse(raw);
  marker.structured = structured;
  marker.summary = structured?.summary || structured?.bullets || null;

  await persistLostRecap(marker, structured, raw, marker.excerpt);
}

async function fetchTranscriptWindow(marker) {
  if (!window.transcriptStorage?.getSegmentWindow) {
    return { segments: [], session: null, rangeMs: LOST_LIMITS.windowMs };
  }
  const response = await window.transcriptStorage.getSegmentWindow({
    sessionId: marker.sessionId,
    cutoffMs: marker.cutoffMs,
    windowMs: LOST_LIMITS.windowMs,
    includePrereq: LOST_LIMITS.includePrereq,
    limit: LOST_LIMITS.maxSegments,
  });
  if (!response?.success) {
    throw new Error(response?.error || 'Failed to read transcript window');
  }
  const segments = Array.isArray(response.segments) ? response.segments : [];
  const startMs = segments[0]?.absoluteMs ?? segments[0]?.startMs ?? marker.cutoffMs;
  const endMs =
    segments[segments.length - 1]?.absoluteMs ??
    segments[segments.length - 1]?.endMs ??
    marker.cutoffMs;
  const rangeMs = Math.max(0, endMs - startMs);
  return {
    segments,
    session: response.session || null,
    rangeMs,
  };
}

function formatTranscriptExcerpt(segments, sessionStart) {
  const lines = segments
    .map((seg) => {
      const ts = formatRelativeTimestamp(
        seg.absoluteMs ?? seg.startMs ?? seg.timestamp ?? Date.now(),
        sessionStart
      );
      return `[${ts}] ${seg.text}`.trim();
    })
    .filter(Boolean);
  let excerpt = lines.join('\n');
  if (excerpt.length > LOST_LIMITS.maxExcerptChars) {
    excerpt = excerpt.slice(excerpt.length - LOST_LIMITS.maxExcerptChars);
    const firstBreak = excerpt.indexOf('\n');
    if (firstBreak > 0) {
      excerpt = excerpt.slice(firstBreak + 1);
    }
  }
  return excerpt;
}

function formatRelativeTimestamp(ms, sessionStart) {
  const base = typeof sessionStart === 'number' ? sessionStart : 0;
  const relative = Math.max(0, Math.round(ms - base));
  const totalSeconds = Math.floor(relative / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function fetchCourseContext(classId) {
  const context = {
    globalGuidelines: '',
    classGuidelines: '',
    classSnippets: [],
    globalSnippets: [],
  };

  try {
    const modelContext = await window.modelContext?.get?.();
    const settings = modelContext?.settings;
    if (settings) {
      context.globalGuidelines = settings.globalGuidelines || '';
      if (classId && settings.classContexts && settings.classContexts[classId]) {
        context.classGuidelines = settings.classContexts[classId];
      }
    }
  } catch (error) {
    console.warn('[LostRecap] Failed to load model context', error);
  }

  if (classId) {
    try {
      const primer = await window.api?.invoke?.('class-context:primer', {
        classId,
        limit: LOST_LIMITS.contextSnippetLimit,
      });
      if (primer?.success && Array.isArray(primer.segments)) {
        context.classSnippets = primer.segments.map((seg) => seg.text).filter(Boolean);
      }
    } catch (error) {
      console.warn('[LostRecap] Failed to load class snippets', error);
    }
  }

  try {
    const globalPrimer = await window.api?.invoke?.('class-context:primer', {
      classId: '__global__',
      limit: Math.min(2, LOST_LIMITS.contextSnippetLimit),
    });
    if (globalPrimer?.success && Array.isArray(globalPrimer.segments)) {
      context.globalSnippets = globalPrimer.segments.map((seg) => seg.text).filter(Boolean);
    }
  } catch {
    /* ignore */
  }

  return context;
}

async function loadClassesOnce() {
  if (lostState.classes) return lostState.classes;
  if (!window.transcriptStorage?.listClasses) {
    lostState.classes = {};
    return {};
  }
  try {
    const response = await window.transcriptStorage.listClasses();
    const list = response?.classes || response?.result || [];
    const map = {};
    if (Array.isArray(list)) {
      list.forEach((cls) => {
        if (cls?.id) map[cls.id] = cls;
      });
    }
    lostState.classes = map;
    return map;
  } catch (error) {
    console.warn('[LostRecap] Failed to load classes', error);
    lostState.classes = {};
    return {};
  }
}

function buildLostPrompts(marker, excerpt, contextInfo, windowMinutes) {
  const classes = lostState.classes || {};
  const classInfo = marker.classId ? classes[marker.classId] : null;
  const courseLabel = classInfo?.code || classInfo?.name || 'Live class';
  const topicGuess = classInfo?.name || 'Current lecture';
  const flaggedAt = formatClock(marker.markerMs);

  const snippetBlock = (contextInfo.classSnippets || []).slice(0, LOST_LIMITS.contextSnippetLimit);
  const globalSnippetBlock = (contextInfo.globalSnippets || []).slice(0, 2);

  const systemPrompt =
    'You are a patient tutor. Explain concepts clearly in short steps, define jargon, ' +
    'and match an 8th–10th grade reading level unless technical precision is essential. ' +
    'Never include content that occurs after the flagged timestamp.';

  const userPrompt = [
    `Context: Course "${courseLabel}", Topic "${topicGuess}".`,
    `Student flagged confusion at ${flaggedAt}. Summarize the last ${windowMinutes} minute(s) up to this time only; never reference future content.`,
    '',
    'Transcript excerpt (chronological):',
    excerpt,
    '',
    'Course guidelines:',
    contextInfo.globalGuidelines || 'None provided.',
    contextInfo.classGuidelines ? `\nClass-specific guidance:\n${contextInfo.classGuidelines}` : '',
    '',
    'Class reference snippets:',
    snippetBlock.length ? snippetBlock.map((text, idx) => `${idx + 1}. ${text}`).join('\n') : 'None.',
    '',
    'Global reference snippets:',
    globalSnippetBlock.length
      ? globalSnippetBlock.map((text, idx) => `${idx + 1}. ${text}`).join('\n')
      : 'None.',
    '',
    'Deliverables (respond ONLY in JSON matching this schema):',
    `{
  "summary": ["Plain-language recap bullet (3-6 total)"],
  "prerequisites": ["Concepts to review, reference earlier timestamps if possible"],
  "steps": ["Step-by-step explanation of the idea"],
  "workedExample": {
    "title": "Short title",
    "steps": ["step 1", "step 2"],
    "answer": "final answer or takeaway"
  },
  "selfCheck": [
    { "question": "short question", "answer": "short folded answer" }
  ]
}`,
    '',
    'If math/code is involved, use LaTeX or monospace formatting inline. ' +
      'Keep answers concise and grounded strictly in the provided excerpt.',
  ].join('\n');

  return { systemPrompt, userPrompt };
}

function parseLostRecapResponse(text) {
  if (!text) return null;
  const cleaned = stripJsonPayload(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
    } catch {
      /* ignore */
    }
  }

  const fallbackSummary = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
  return { summary: fallbackSummary };
}

function stripJsonPayload(text) {
  return text.replace(/```(?:json)?/gi, '```').replace(/```/g, '').trim();
}

async function persistLostRecap(marker, structured, rawText, excerpt) {
  // No longer persist lost recaps as separate transcription records
  // The recap is displayed in the overlay panel only
  marker.savedRecordId = `lostrecap_${marker.sessionId}_${Math.round(marker.markerMs)}`;
}

function renderLostTimeline() {
  if (!lostTimelineEl) return;
  lostTimelineEl.innerHTML = '';

  if (!lostState.markers.length) {
    const empty = document.createElement('div');
    empty.className = 'lost-timeline-empty';
    empty.textContent = 'Lost markers will appear here.';
    lostTimelineEl.appendChild(empty);
    return;
  }

  lostState.markers
    .slice()
    .sort((a, b) => a.markerMs - b.markerMs)
    .forEach((marker) => {
      const chip = createLostChip(marker);
      lostTimelineEl.appendChild(chip);
    });
}

function createLostChip(marker) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = `lost-chip ${marker.status || ''}`.trim();
  chip.dataset.id = marker.id;
  chip.innerHTML = `<span class="lost-chip-dot"></span>${formatClock(marker.markerMs)}`;
  chip.addEventListener('click', () => focusLostCard(marker.id));
  return chip;
}

function focusLostCard(markerId) {
  const marker = lostState.markers.find((m) => m.id === markerId);
  if (!marker) return;
  marker.dismissed = false;
  renderLostRecapCards();
  requestAnimationFrame(() => {
    const card = lostRecapListEl?.querySelector(`[data-marker="${markerId}"]`);
    if (card?.scrollIntoView) {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function renderLostRecapCards() {
  if (!lostRecapListEl) return;
  lostRecapListEl.innerHTML = '';

  const visibleMarkers = lostState.markers.filter((marker) => !marker.dismissed);
  if (!visibleMarkers.length) {
    const empty = document.createElement('div');
    empty.className = 'lost-empty-state';
    empty.textContent = 'Tap “I’m lost” when the lecture drifts — we’ll build a recap without stopping.';
    lostRecapListEl.appendChild(empty);
    
    // Hide lost panel when empty
    const lostPanel = document.getElementById('lost-panel');
    if (lostPanel && lostPanel.classList.contains('expanded')) {
      lostPanel.classList.remove('expanded');
      lostPanel.classList.remove('visible');
      lostPanel.style.display = 'none';
    }
    return;
  }

  // Show lost panel when there are markers
  const lostPanel = document.getElementById('lost-panel');
  if (lostPanel && !lostPanel.classList.contains('expanded')) {
    lostPanel.classList.add('expanded');
    lostPanel.classList.add('visible');
    lostPanel.style.display = 'block';
  }

  visibleMarkers
    .slice()
    .sort((a, b) => a.markerMs - b.markerMs)
    .forEach((marker) => {
      lostRecapListEl.appendChild(createLostCard(marker));
    });
}

function createLostCard(marker) {
  const card = document.createElement('div');
  card.className = `lost-recap-card ${marker.status || ''}`.trim();
  card.dataset.marker = marker.id;

  const header = document.createElement('div');
  header.className = 'lost-recap-header';

  const time = document.createElement('div');
  time.className = 'lost-recap-time';
  time.textContent = formatClock(marker.markerMs);

  const statusLabel = document.createElement('div');
  statusLabel.className = 'lost-recap-status';
  if (marker.status === 'pending') statusLabel.textContent = 'Generating recap…';
  else if (marker.status === 'error') {
    statusLabel.textContent = marker.error || 'Something went wrong';
    statusLabel.classList.add('error');
  } else {
    statusLabel.textContent = 'Ready';
  }

  header.appendChild(time);
  header.appendChild(statusLabel);
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'lost-recap-body';

  if (marker.status === 'pending') {
    body.innerHTML = '<div>Gathering context and drafting a recap…</div>';
  } else if (marker.status === 'error') {
    body.innerHTML = `<div>${marker.error || 'Unable to generate recap.'}</div>`;
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'lost-action-btn';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => {
      marker.status = 'queued';
      marker.error = null;
      enqueueLostRecap(marker.id);
      renderLostRecapCards();
    });
    body.appendChild(retryBtn);
  } else if (marker.structured) {
    const summaryList = buildList(marker.structured.summary || marker.structured.bullets);
    if (summaryList) {
      const section = document.createElement('div');
      section.innerHTML = `<div class="lost-section-title">Recap</div>`;
      section.appendChild(summaryList);
      body.appendChild(section);
    }

    const prereqList = buildList(marker.structured.prerequisites);
    if (prereqList) {
      const section = document.createElement('div');
      section.innerHTML = `<div class="lost-section-title">Prerequisites</div>`;
      section.appendChild(prereqList);
      body.appendChild(section);
    }

    const stepsList = buildList(marker.structured.steps);
    if (stepsList) {
      const section = document.createElement('div');
      section.innerHTML = `<div class="lost-section-title">Step-by-step</div>`;
      section.appendChild(stepsList);
      body.appendChild(section);
    }

    if (marker.structured.workedExample) {
      const example = marker.structured.workedExample;
      const steps = buildList(example.steps);
      const section = document.createElement('div');
      section.innerHTML = `<div class="lost-section-title">Worked example${
        example.title ? ` — ${example.title}` : ''
      }</div>`;
      if (steps) section.appendChild(steps);
      if (example.answer) {
        const answerEl = document.createElement('div');
        answerEl.textContent = `➤ ${example.answer}`;
        section.appendChild(answerEl);
      }
      body.appendChild(section);
    }

    if (Array.isArray(marker.structured.selfCheck) && marker.structured.selfCheck.length) {
      const section = document.createElement('div');
      section.innerHTML = `<div class="lost-section-title">Self-check</div>`;
      marker.structured.selfCheck.forEach((item, idx) => {
        if (!item?.question) return;
        const details = document.createElement('details');
        details.className = 'lost-selfcheck';
        const summary = document.createElement('summary');
        summary.textContent = `${idx + 1}. ${item.question}`;
        const answer = document.createElement('p');
        answer.textContent = item.answer || 'Answer';
        details.appendChild(summary);
        details.appendChild(answer);
        section.appendChild(details);
      });
      body.appendChild(section);
    }
  } else {
    body.innerHTML = '<div class="lost-section-title">Recap saved.</div>';
  }

  card.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'lost-recap-actions';

  const jumpBtn = document.createElement('button');
  jumpBtn.type = 'button';
  jumpBtn.className = 'lost-action-btn primary';
  jumpBtn.textContent = `Jump to ${formatClock(marker.markerMs)}`;
  jumpBtn.addEventListener('click', () => jumpToMarker(marker));
  actions.appendChild(jumpBtn);

  const followBtn = document.createElement('button');
  followBtn.type = 'button';
  followBtn.className = 'lost-action-btn';
  followBtn.textContent = 'Ask follow-up';
  followBtn.addEventListener('click', () => prefillFollowUp(marker));
  actions.appendChild(followBtn);

  const pinBtn = document.createElement('button');
  pinBtn.type = 'button';
  pinBtn.className = 'lost-action-btn';
  pinBtn.textContent = marker.savedRecordId ? 'Pinned to notes' : 'Pin to notes';
  pinBtn.disabled = Boolean(marker.savedRecordId || marker.status !== 'ready');
  pinBtn.addEventListener('click', async () => {
    if (marker.savedRecordId || marker.status !== 'ready') return;
    await persistLostRecap(marker, marker.structured, '', marker.excerpt);
    pinBtn.textContent = 'Pinned to notes';
    pinBtn.disabled = true;
  });
  actions.appendChild(pinBtn);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'lost-action-btn danger';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => {
    marker.dismissed = true;
    renderLostRecapCards();
  });
  actions.appendChild(closeBtn);

  card.appendChild(actions);
  return card;
}

function buildList(items) {
  if (!Array.isArray(items) || !items.length) return null;
  const list = document.createElement('ul');
  list.className = 'lost-list';
  items.forEach((item) => {
    if (!item) return;
    const li = document.createElement('li');
    li.textContent = typeof item === 'string' ? item : JSON.stringify(item);
    list.appendChild(li);
  });
  return list;
}

function updateLostStatus() {
  if (!lostStatusEl) return;
  if (lostState.processing) {
    lostStatusEl.textContent = 'Generating…';
    lostStatusEl.classList.add('busy');
  } else if (lostState.queue.length) {
    lostStatusEl.textContent = 'Queued';
    lostStatusEl.classList.add('busy');
  } else {
    lostStatusEl.textContent = 'Ready';
    lostStatusEl.classList.remove('busy');
  }
}

function jumpToMarker(marker) {
  if (!marker) return;
  window.bus?.jumpTo?.({ startMs: marker.markerMs, sessionId: marker.sessionId });
  showNotification('Jumped to the marked moment');
}

function prefillFollowUp(marker) {
  const input = document.getElementById('qa-input');
  if (!input) return;
  const summary = Array.isArray(marker?.structured?.summary)
    ? marker.structured.summary.join(' ')
    : '';
  input.value = summary
    ? `Can you clarify this part: ${summary.slice(0, 100)}?`
    : 'I have a follow-up question about the recap.';
  input.focus();
}

function formatClock(ms) {
  return formatRelativeTimestamp(ms, 0);
}

// NEW: Segment counter update
function updateSegmentCounter(count) {
  const counterEl = document.getElementById('segment-counter');
  const textEl = document.getElementById('segment-count-text');

  if (counterEl && textEl) {
    const total = count;

    if (total > 0) {
      counterEl.classList.remove('hidden');
      textEl.textContent = `${total} segment${total !== 1 ? 's' : ''}`;
    } else {
      counterEl.classList.add('hidden');
    }
  }
}

// Initialize transcript controls
function initializeTranscriptControls() {
  const scrollToBottomBtn = document.getElementById('scroll-to-bottom');
  const clearTranscriptBtn = document.getElementById('clear-transcript');
  
  if (scrollToBottomBtn) {
    scrollToBottomBtn.addEventListener('click', () => {
      if (transcriptDisplayEl) {
        transcriptDisplayEl.scrollTop = transcriptDisplayEl.scrollHeight;
        shouldAutoScroll = true;
      }
    });
  }
  
  if (clearTranscriptBtn) {
    clearTranscriptBtn.addEventListener('click', () => {
      if (confirm('Clear all transcript content?')) {
        clearTranscript();
      }
    });
  }
}

// Clear transcript function
function clearTranscript() {
  const finalTextEl = document.getElementById('final-text');
  const interimTextEl = document.getElementById('interim-text');
  
  if (finalTextEl) {
    finalTextEl.innerHTML = '<div class="placeholder-text" id="placeholder-text">Ready for transcription.<br /><small>Press the record button or use Ctrl + Shift + T to toggle the overlay.</small></div>';
  }
  
  if (interimTextEl) {
    interimTextEl.textContent = '';
  }
  
  // Reset transcript data
  transcriptLines = [];
  totalSegmentCount = 0;
  updateSegmentCounter(0);
  
  // Show placeholder
  showPlaceholderText();
}

// Initialize lost panel toggle
function initializeLostPanelToggle() {
  const lostPanelToggle = document.getElementById('lost-panel-toggle');
  const lostPanel = document.getElementById('lost-panel');
  
  if (lostPanelToggle && lostPanel) {
    lostPanelToggle.addEventListener('click', () => {
      const isExpanded = lostPanel.classList.contains('expanded');
      if (isExpanded) {
        lostPanel.classList.remove('expanded');
        lostPanel.classList.remove('visible');
        lostPanel.style.display = 'none';
      } else {
        lostPanel.classList.add('expanded');
        lostPanel.classList.add('visible');
        lostPanel.style.display = 'block';
      }
    });
  }
}

// Initialize panel toggles for collapsible panels
function initializePanelToggles() {
  const panels = document.querySelectorAll('.panel.collapsible');
  
  panels.forEach(panel => {
    const header = panel.querySelector('.panel-header');
    const toggle = panel.querySelector('.panel-toggle');
    
    if (header && toggle) {
      // Toggle on header click
      header.addEventListener('click', (e) => {
        if (e.target === toggle) return; // Don't toggle if clicking the toggle button
        togglePanel(panel);
      });
      
      // Toggle on toggle button click
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel(panel);
      });
    }
  });
}

// Toggle panel collapsed/expanded state
function togglePanel(panel) {
  const isCollapsed = panel.classList.contains('collapsed');
  
  if (isCollapsed) {
    panel.classList.remove('collapsed');
    panel.classList.add('expanded');
  } else {
    panel.classList.remove('expanded');
    panel.classList.add('collapsed');
  }
  
  // Update layout after toggle
  updateLayout();
}

// Initialize responsive layout system
function initializeResponsiveLayout() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  
  // Check initial screen size
  updateLayout();
  
  // Listen for window resize
  window.addEventListener('resize', debounce(updateLayout, 250));
}

// Update layout based on screen size
function updateLayout() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;
  
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Determine layout based on available space
  if (width < 900 || height < 600) {
    // Single column layout for small screens
    mainContent.className = 'overlay-main-content single-column';
  } else {
    // Two column layout for larger screens
    mainContent.className = 'overlay-main-content two-column';
  }
  
  // Ensure panels are properly sized
  const panels = document.querySelectorAll('.panel');
  panels.forEach(panel => {
    if (panel.classList.contains('expanded')) {
      panel.style.flex = '1';
    } else if (panel.classList.contains('collapsed')) {
      panel.style.flex = 'none';
    }
  });
}

// Toggle panel by ID
function togglePanelById(panelId) {
  const panel = document.getElementById(panelId);
  if (panel) {
    if (panel.classList.contains('collapsible')) {
      togglePanel(panel);
    } else if (panelId === 'lost-panel') {
      const isExpanded = panel.classList.contains('expanded');
      if (isExpanded) {
        panel.classList.remove('expanded');
        panel.classList.remove('visible');
        panel.style.display = 'none';
      } else {
        panel.classList.add('expanded');
        panel.classList.add('visible');
        panel.style.display = 'block';
      }
    }
  }
}

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// NEW: Download transcript function
async function downloadTranscript() {
  if (!currentSessionId) {
    showNotification('No session to download');
    return;
  }

  try {
    // Create a simple download menu
    const format = await promptFormatSelection();
    if (!format) return;

    const result = await window.transcriptStorage.exportTranscript(currentSessionId, format);

    if (!result.success) {
      showError(`Failed to export: ${result.error}`);
      return;
    }

    // Create a blob and download it
    let blob;
    if (result.isBinary) {
      // Handle binary data (DOCX) - convert array back to Uint8Array
      const uint8Array = new Uint8Array(result.content);
      blob = new Blob([uint8Array], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
    } else {
      // Handle text data (TXT, MD, JSON)
      const mimeType = format === 'json' ? 'application/json' : 'text/plain';
      blob = new Blob([result.content], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);

    showNotification(`Downloaded: ${result.filename}`);
  } catch (error) {
    console.error('Download failed:', error);
    showError(`Download failed: ${error.message}`);
  }
}

// Helper to prompt for format selection
function promptFormatSelection() {
  return new Promise((resolve) => {
    // Create a simple modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(20, 20, 20, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 20px;
      z-index: 10000;
      min-width: 250px;
    `;

    modal.innerHTML = `
      <h3 style="margin: 0 0 15px 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Download Format</h3>
      <button class="format-btn" data-format="docx" style="display: block; width: 100%; margin: 8px 0; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
        Word Document (.docx)
      </button>
      <button class="format-btn" data-format="txt" style="display: block; width: 100%; margin: 8px 0; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
        Plain Text (.txt)
      </button>
      <button class="format-btn" data-format="md" style="display: block; width: 100%; margin: 8px 0; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
        Markdown (.md)
      </button>
      <button class="format-btn" data-format="json" style="display: block; width: 100%; margin: 8px 0; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
        JSON (.json)
      </button>
      <button class="format-btn" data-format="cancel" style="display: block; width: 100%; margin: 15px 0 0 0; padding: 10px; background: rgba(255, 0, 0, 0.2); border: 1px solid rgba(255, 0, 0, 0.3); color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
        Cancel
      </button>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255, 255, 255, 0.2)';
      });
      btn.addEventListener('mouseleave', () => {
        const format = btn.dataset.format;
        btn.style.background = format === 'cancel'
          ? 'rgba(255, 0, 0, 0.2)'
          : 'rgba(255, 255, 255, 0.1)';
      });
      btn.addEventListener('click', () => {
        const format = btn.dataset.format;
        document.body.removeChild(modal);
        resolve(format === 'cancel' ? null : format);
      });
    });
  });
}
