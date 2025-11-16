const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

class ProxyServer {
  constructor(config = {}) {
    this.app = express();
    this.port = config.port || 3500;
    this.server = null;

    // Store API keys securely in memory
    this.keys = {
      deepgram: config.deepgramKey || process.env.DEEPGRAM_API_KEY,
      openai: config.openaiKey || process.env.OPENAI_API_KEY,
      gemini: config.geminiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      openrouter: config.openrouterKey || process.env.OPENROUTER_API_KEY,
    };

    // Configuration
    this.config = {
      openrouterModel: config.openrouterModel || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct',
      geminiModel: config.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    };

    this._setupMiddleware();
    this._setupRoutes();
  }

  _setupMiddleware() {
    // Enable CORS for local requests
    this.app.use(cors({
      origin: ['http://localhost:3001', 'http://127.0.0.1:3001'],
      credentials: true
    }));

    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[Proxy] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });

    // Rate limiting - 100 requests per minute per IP
    const limiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100,
      message: { error: 'Too many requests, please try again later' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);
  }

  _setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        keys: {
          deepgram: !!this.keys.deepgram,
          openai: !!this.keys.openai,
          gemini: !!this.keys.gemini,
          openrouter: !!this.keys.openrouter
        }
      });
    });

    // OpenAI proxy
    this.app.post('/api/openai/chat/completions', async (req, res) => {
      try {
        if (!this.keys.openai) {
          return res.status(500).json({ error: 'OpenAI API key not configured' });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.keys.openai}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(req.body)
        });

        const data = await response.json();
        res.status(response.status).json(data);
      } catch (error) {
        console.error('[Proxy] OpenAI error:', error);
        res.status(500).json({ error: 'Failed to proxy OpenAI request', details: error.message });
      }
    });

    // OpenRouter proxy
    this.app.post('/api/openrouter/chat/completions', async (req, res) => {
      try {
        if (!this.keys.openrouter) {
          return res.status(500).json({ error: 'OpenRouter API key not configured' });
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.keys.openrouter}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://classpartner.app',
            'X-Title': 'ClassPartner'
          },
          body: JSON.stringify(req.body)
        });

        const data = await response.json();
        res.status(response.status).json(data);
      } catch (error) {
        console.error('[Proxy] OpenRouter error:', error);
        res.status(500).json({ error: 'Failed to proxy OpenRouter request', details: error.message });
      }
    });

    // Gemini proxy - using REST API directly
    this.app.post('/api/gemini/generate', async (req, res) => {
      try {
        if (!this.keys.gemini) {
          return res.status(500).json({ error: 'Gemini API key not configured' });
        }

        const { model = this.config.geminiModel, contents, generationConfig } = req.body;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.keys.gemini}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents,
              generationConfig: generationConfig || {
                temperature: 0.2,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192
              }
            })
          }
        );

        const data = await response.json();
        res.status(response.status).json(data);
      } catch (error) {
        console.error('[Proxy] Gemini error:', error);
        res.status(500).json({ error: 'Failed to proxy Gemini request', details: error.message });
      }
    });

    // Deepgram - return connection info (WebSocket handled separately)
    this.app.get('/api/deepgram/key', (req, res) => {
      if (!this.keys.deepgram) {
        return res.status(500).json({ error: 'Deepgram API key not configured' });
      }
      // Return the key for WebSocket connection (secured by being localhost only)
      res.json({ key: this.keys.deepgram });
    });

    // Generic error handler
    this.app.use((err, req, res, next) => {
      console.error('[Proxy] Unhandled error:', err);
      res.status(500).json({ error: 'Internal proxy server error' });
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, '127.0.0.1', () => {
          console.log(`[Proxy] Server running on http://127.0.0.1:${this.port}`);
          resolve(this.port);
        });

        this.server.on('error', (err) => {
          console.error('[Proxy] Server error:', err);
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[Proxy] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getPort() {
    return this.port;
  }

  // Utility method to check if keys are configured
  hasKey(provider) {
    return !!this.keys[provider];
  }
}

module.exports = ProxyServer;
