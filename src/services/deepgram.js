const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
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
    this.reconnectDelay = 1000; // 1 second initial delay
    this.connectionTimeout = null;
    
    if (apiKey) {
      this.deepgramClient = createClient(apiKey);
    }
  }

  async connect() {
    try {
      if (!this.deepgramClient) {
        throw new Error('Deepgram client not initialized - API key required');
      }

      // Clear any existing connection
      if (this.connection) {
        this.disconnect();
      }

      this.emit('status', 'connecting');
      console.log('Connecting to Deepgram...');

      // Create live connection with optimal settings
      this.connection = this.deepgramClient.listen.live({
        model: 'nova-2',
        language: 'en',
        smart_format: true,
        interim_results: true,
        endpointing: 300, // 300ms pause detection
        channels: 1,
        sample_rate: 16000,
        encoding: 'linear16'
      });

      // Set up event listeners
      this.setupEventListeners();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000); // 10 second timeout

        this.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
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

    this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      if (data && data.channel && data.channel.alternatives && data.channel.alternatives.length > 0) {
        const transcript = data.channel.alternatives[0];
        
        console.log('Transcript received:', transcript.transcript, 'confidence:', transcript.confidence, 'is_final:', data.is_final);
        
        // Emit even empty transcripts for interim results (they clear the interim text)
        this.emit('transcription', {
          text: transcript.transcript,
          confidence: transcript.confidence,
          is_final: data.is_final,
          timestamp: Date.now()
        });
      }
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
      
      // Attempt reconnection if not intentionally closed
      if (this.reconnectAttempts < this.maxReconnectAttempts && event.code !== 1000) {
        this.scheduleReconnect();
      }
    });

    this.connection.on(LiveTranscriptionEvents.Metadata, (data) => {
      console.log('Deepgram metadata:', data);
      this.emit('metadata', data);
    });
  }

  sendAudio(audioData) {
    if (this.connection && this.isConnected) {
      try {
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

    // Clear any pending reconnection
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
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts); // Exponential backoff
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
    if (this.reconnectAttempts > 0) return 'reconnecting';
    if (this.connection) return 'connecting';
    return 'disconnected';
  }

  // Cleanup method
  destroy() {
    this.disconnect();
    this.removeAllListeners();
  }
}

module.exports = DeepgramService;