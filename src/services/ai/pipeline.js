// src/services/ai/pipeline.js
const { EventEmitter } = require('events');
const { Worker } = require('node:worker_threads');
const path = require('node:path');

class AIPipeline extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.worker = new Worker(path.join(__dirname, 'aiWorker.js'), {
      workerData: {

        summaryWindowMs: opts.summaryWindowMs ?? 60_000,   // rolling window
        minSummarizeEveryMs: opts.minSummarizeEveryMs ?? 12_000, // throttle summaries
      }
    });

    this.worker.on('online', () => {
    console.log('[AI WORKER] online');
    });
    this.worker.on('error', (err) => {
    console.error('[AI WORKER] error:', err);
    this.emit('error', err);
    });
    this.worker.on('exit', (code) => {
    console.error('[AI WORKER] exit with code', code);
    if (code !== 0) this.emit('error', new Error(`AI worker exited ${code}`));
    });


    this.worker.on('message', (msg) => {
      if (msg?.type === 'ai:update') this.emit('update', msg.payload);
      if (msg?.type === 'ai:log') this.emit('log', msg.payload);
      if (msg?.type === 'ai:error') this.emit('error', msg.payload);
    });
  }

  enqueueSegment(seg) {
    // seg: { id, text, startMs, endMs }
    this.worker.postMessage({ type: 'segment', payload: seg });
  }

  flush() {
    this.worker.postMessage({ type: 'flush' });
  }

  setProviderConfig(cfg) {
    // cfg: { provider: 'openai'|'ollama'|..., apiKey, model, baseUrl? }
    this.worker.postMessage({ type: 'provider:set', payload: cfg });
  }

  dispose() {
    this.worker.terminate();
  }

  query(query, opts = {}) {
    return new Promise((resolve, reject) => {
        const id = 'q_' + Math.random().toString(36).slice(2);
        const onMsg = (msg) => {
        if (msg?.type === 'ai:query:result' && msg?.payload?.id === id) {
            this.worker.off('message', onMsg);
            resolve(msg.payload);
        }
        };
        this.worker.on('message', onMsg);
        this.worker.postMessage({ type: 'query', payload: { id, query, opts } });
        setTimeout(() => { this.worker.off('message', onMsg); reject(new Error('Query timeout')); }, 15000);
    });
    }

}

module.exports = { AIPipeline };
