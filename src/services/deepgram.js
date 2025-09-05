const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const { performance } = require('node:perf_hooks');
const EventEmitter = require('events');

class DeepgramService extends EventEmitter {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.connection = null;
    this.deepgramClient = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1s initial backoff
    this.connectionTimeout = null;

    // Performance monitoring
    this.latencyMeasurements = [];
    this.maxLatencyMeasurements = 10;
    this.lastSentTime = 0;
    this.connectionQuality = 'good'; // 'good' | 'fair' | 'poor'

    if (apiKey) {
      this.deepgramClient = createClient(apiKey);
    }
  }

  async connect() {
    try {
      if (!this.deepgramClient) {
        throw new Error('Deepgram client not initialized - API key required');
      }

      // Clear existing connection
      if (this.connection) {
        this.disconnect();
      }

      this.emit('status', 'connecting');
      console.log('Connecting to Deepgram...');

      // Live connection (speed-optimized)
      this.connection = this.deepgramClient.listen.live({
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        interim_results: true,
        endpointing: 150,        // faster endpointing
        vad_events: true,        // VAD on/off speech
        channels: 1,
        sample_rate: 16000,
        encoding: 'linear16',
        // perf opts
        numerals: false,
        profanity_filter: false,
        redact: false,
      });

      this.setupEventListeners();

      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Connection timeout')), 10000);

        this.once('connected', () => { clearTimeout(t); resolve(); });
        this.once('error', (err)   => { clearTimeout(t); reject(err); });
      });

    } catch (error) {
      console.error('Failed to connect to Deepgram:', error);
      this.emit('error', error);
      throw error;
    }
  }

  setupEventListeners() {
    if (!this.connection) return;

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      console.log('Deepgram connection opened');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('status', 'connected');
      this.emit('connected');
    });

    // Voice activity (useful for UI hinting)
    this.connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
      this.emit('vad', { speaking: true, ts: Date.now() });
    });
    this.connection.on(LiveTranscriptionEvents.SpeechEnded, () => {
      this.emit('vad', { speaking: false, ts: Date.now() });
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      try {
        const alt = data?.channel?.alternatives?.[0];
        if (!alt) return;

        // Latency measurement: from last audio send to transcript receipt
        if (this.lastSentTime > 0) {
          const latency = performance.now() - this.lastSentTime;
          this.updateConnectionQuality(latency);
        }

        // Derive start/end from word timings if present
        // Deepgram uses seconds; convert to ms
        let startMs = null, endMs = null;
        if (Array.isArray(alt.words) && alt.words.length > 0) {
          const first = alt.words[0];
          const last  = alt.words[alt.words.length - 1];
          if (typeof first.start === 'number') startMs = Math.round(first.start * 1000);
          if (typeof last.end === 'number')    endMs   = Math.round(last.end * 1000);
        }

        const payload = {
          text: alt.transcript || '',
          confidence: typeof alt.confidence === 'number' ? alt.confidence : null,
          is_final: Boolean(data?.is_final),
          timestamp: Date.now(),
          startMs,
          endMs,
          connectionQuality: this.connectionQuality,
        };

        // Log small line for debug
        if (payload.is_final) {
          console.log('[DG final]', payload.text, 'q=', payload.connectionQuality);
        } else {
          // Uncomment if you want to see interim spam:
          // console.log('[DG interim]', payload.text);
        }

        // Always emit (interim clears UI)
        this.emit('transcription', payload);
      } catch (e) {
        console.error('Transcript handling error:', e);
        this.emit('error', e);
      }
    });

    this.connection.on(LiveTranscriptionEvents.Metadata, (data) => {
      // Model, billing, etc.
      this.emit('metadata', data);
    });

    this.connection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('Deepgram error:', error);
      this.emit('error', error);
      this.handleConnectionError();
    });

    this.connection.on(LiveTranscriptionEvents.Close, (event) => {
      console.log('Deepgram connection closed:', event);
      this.isConnected = false;
      this.emit('status', 'disconnected');
      this.emit('disconnected', event);

      // Attempt reconnection if not normal close
      if (this.reconnectAttempts < this.maxReconnectAttempts && event?.code !== 1000) {
        this.scheduleReconnect();
      }
    });
  }

  sendAudio(audioData) {
    if (this.connection && this.isConnected) {
      try {
        this.lastSentTime = performance.now();
        this.connection.send(audioData);
        return true;
      } catch (error) {
        console.error('Failed to send audio data:', error);
        this.emit('error', error);
        return false;
      }
    }
    return false;
  }

  disconnect() {
    if (this.connection) {
      console.log('Disconnecting from Deepgram...');
      this.isConnected = false;
      try {
        this.connection.finish();
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
      this.connection = null;
      this.emit('status', 'disconnected');
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  handleConnectionError() {
    this.isConnected = false;
    this.emit('status', 'error');

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.emit('max_reconnects_reached');
    }
  }

  scheduleReconnect() {
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts); // exponential backoff
    this.reconnectAttempts++;

    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    this.emit('status', 'reconnecting');

    this.connectionTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        this.handleConnectionError();
      }
    }, delay);
  }

  isConnectedToDeepgram() {
    return this.isConnected;
  }

  getConnectionStatus() {
    if (this.isConnected) return 'connected';
    if (this.reconnectAttempts > 0 && this.connectionTimeout) return 'reconnecting';
    if (this.connection) return 'connecting';
    return 'disconnected';
  }

  updateConnectionQuality(latency) {
    this.latencyMeasurements.push(latency);
    if (this.latencyMeasurements.length > this.maxLatencyMeasurements) {
      this.latencyMeasurements.shift();
    }
    const avgLatency =
      this.latencyMeasurements.reduce((sum, v) => sum + v, 0) / this.latencyMeasurements.length;

    const prev = this.connectionQuality;
    if (avgLatency < 200) this.connectionQuality = 'good';
    else if (avgLatency < 500) this.connectionQuality = 'fair';
    else this.connectionQuality = 'poor';

    if (prev !== this.connectionQuality) {
      this.emit('quality-change', {
        quality: this.connectionQuality,
        latency: avgLatency,
        measurements: this.latencyMeasurements.length,
      });
    }
  }

  getConnectionQuality() {
    const averageLatency =
      this.latencyMeasurements.length > 0
        ? this.latencyMeasurements.reduce((s, v) => s + v, 0) / this.latencyMeasurements.length
        : 0;

    return {
      quality: this.connectionQuality,
      averageLatency,
      measurements: this.latencyMeasurements.length,
    };
  }

  destroy() {
    this.disconnect();
    this.removeAllListeners();
  }
}

module.exports = DeepgramService;
