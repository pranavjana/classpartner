# Classroom Assistant

A real-time transcription overlay built with **Electron** and the **Deepgram API**. It provides live speech-to-text in a floating, always-on-top window for classrooms and meetings.

## Features

- **Real-time transcription** using Deepgram’s Nova-2 model
- **Always-on-top overlay** that stays visible during presentations
- **Live interim & final results** as you speak
- **Low-latency audio processing** (AudioWorklet, optimized buffers)
- **Resizable window** with drag-to-resize
- **Connection quality monitoring** with latency feedback
- **Global shortcut** to show/hide (Ctrl/⌘ + Shift + T)
- **Clean, minimal UI** (transparency + blur)
- **Background AI processing (new)**
  - Rolling **summaries**, **keywords**, and **action items** while you talk
  - Super-fast **Q&A** over the last few minutes using **local embeddings** (Xenova, no quotas)
  - **Hybrid LLM routing:** OpenAI (primary) → OpenRouter (backup) with **sticky cooldown** on rate limits

## Prerequisites

- **Node.js** v16+
- **npm** or **yarn**
- **Deepgram API key**
- (Optional) **OpenAI** key and/or **OpenRouter** key for AI summaries/Q&A

## Setup

### 1) Clone

```bash
git clone [repository-url]
cd classpartner


### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit `.env` and add your keys:
```
# Which AI stack to use (default: OpenAI primary + OpenRouter backup)
AI_PROVIDER=hybrid-openai

# Deepgram
DEEPGRAM_API_KEY=dg_your_deepgram_key

# OpenAI (primary summaries/Q&A)
OPENAI_API_KEY=sk_your_openai_key

# OpenRouter (backup summaries/Q&A)
OPENROUTER_API_KEY=sk-or_your_openrouter_key
OPENROUTER_BASE=https://openrouter.ai/api/v1
OPENROUTER_MODEL=meta/llama-3.1-8b-instruct
OPENROUTER_REFERER=http://localhost
OPENROUTER_TITLE=Classroom Assistant

# Optional AI cadence tuning (defaults shown)
AI_MIN_SUMMARIZE_EVERY_MS=12000
AI_SUMMARY_WINDOW_MS=60000

```

**Getting a Deepgram API Key:**
- Sign up at [deepgram.com](https://deepgram.com/)
- Navigate to your dashboard
- Create a new API key
- Copy the key to your `.env` file

### 4. Run the Application

**Development mode:**
```bash
npm run start
```

**Build for production:**
```bash
npm run make
```

## Usage

### Starting Transcription

1. Launch the application
2. Click the **"Start"** button or use **Ctrl+Shift+T** to toggle visibility
3. Allow microphone access when prompted
4. Begin speaking - you'll see:
   - **Gray italic text**: Live interim results as you speak
   - **White text blocks**: Final transcription results

### Window Controls

- **Drag**: Click and drag the header bar to move the window
- **Resize**: Drag the bottom or right edges to resize the window
- **Always on Top**: Toggle via the settings button
- **Global Toggle**: Press **Ctrl+Shift+T** to show/hide the window

### Connection Status

The status indicator shows:
- **Connected**: Good connection quality
- **Fair**: Moderate latency (200-500ms)
- **Poor**: High latency (>500ms)

### AI Processing (new)

- Final transcript chunks are streamed to a worker thread which:

- Maintains a rolling context window

- Generates summaries, keywords, action items on a cadence

- Indexes text with local embeddings (Xenova), enabling quick Q&A

- Rate-limit handling: If OpenAI returns 429/5xx, the pipeline auto-switches to OpenRouter for 5 minutes, then retries later.

### DevTools Quick test

```
// 1) See AI logs/updates
window.ai.onLog(m => console.log('[ai log]', m));
window.ai.onError(e => console.log('[ai error]', e));
window.ai.onUpdate(p => console.log('[ai update]', p));

// 2) Seed a couple of "final" lines without talking:
window.bus.sendFinal({ id:'s1', text:'Gradient descent updates parameters to minimize loss.', startMs: Date.now()-4000, endMs: Date.now()-2000 });
window.bus.sendFinal({ id:'s2', text:'L2 regularization reduces overfitting by penalizing large weights.', startMs: Date.now()-2000, endMs: Date.now() });

// 3) Ask a question (vector-retrieval + single LLM pass)
await window.ai.ask("What did they say about overfitting?", { k: 6 });
```

## Project Structure

```
classpartner/
├── src/
│   ├── index.js                  # Main Electron process (loads .env, sets up IPC, AI pipeline)
│   ├── preload.js                # Secure IPC bridge
│   ├── renderer.js               # Frontend logic (UI + devtools helpers)
│   ├── index.html                # UI layout
│   ├── index.css                 # Styling
│   └── services/
│       ├── deepGram.js           # Deepgram WebSocket service (case-sensitive)
|.      ├── audio.js
│       └── ai/
│           ├── pipeline.js       # Main-process wrapper for the AI worker
│           ├── aiWorker.js       # Worker: summaries/keywords/actions + retrieval
│           └── providers/
│               └── providerFactory.js  # OpenAI/OpenRouter + Xenova providers
├── audio-processor.js            # AudioWorklet processor (Float32 -> Int16, low-latency)
├── package.json
├── forge.config.js
└── .env.example

```

## Development

### Available Scripts

- `npm run start` - Start in development mode with hot reload
- `npm run make` - Build distributable packages
- `npm run publish` - Build and publish (requires setup)

### Key Technologies

- **Electron**: Cross-platform desktop app framework
- **Deepgram SDK**: Real-time speech recognition API
- **Web Audio API**: Low-latency audio capture and processing
- **AudioWorklet**: High-performance audio processing
- **WebSocket**: Real-time communication with Deepgram
- **Xenova Transformers**: For local embeddings (no quotas)

### Performance Optimizations

- **Reduced buffer sizes**: 1024 samples (64ms) for low latency
- **Optimized endpointing**: 150ms response time
- **Efficient PCM conversion**: Float32 to Int16 processing
- **Connection quality monitoring**: Adaptive performance tracking

## Troubleshooting

### Audio Issues

- **No transcription appearing**: Check microphone permissions
- **Poor audio quality**: Adjust microphone settings or move closer
- **Choppy audio**: Close other audio applications

### Connection Issues

- **"Deepgram API key not found"**: Verify `.env` file configuration
- **Connection timeouts**: Check internet connectivity
- **High latency**: Consider upgrading internet connection

### Development Issues

- **Hot reload not working**: Restart with `npm run start`
- **Build failures**: Delete `node_modules` and run `npm install`
- **Audio permissions**: Grant microphone access in system settings

## AI / Keys Troubleshooting

### 401 (No auth credentials)

- Ensure `.env` has `OPENAI_API_KEY` (no quotes)
- App must be restarted after edits
- Keys are passed from main to worker; names must match `openaiApiKey` / `openrouterApiKey`

### 429 (Rate limited)

- Expected under free tiers; the pipeline automatically uses backup for 5 minutes
- Increase `AI_MIN_SUMMARIZE_EVERY_MS` to reduce request rate

### No ai:update

Open DevTools → run:

```
await window.ai.availability()
window.ai.onLog(m => console.log('[ai log]', m));
```

Confirm you see `LLM primary=...; embeddings=Xenova` and that both keys show `true` in config logs


## Configuration

### Audio Settings

The application uses optimized audio settings:
- **Sample Rate**: 16kHz
- **Channels**: Mono (1)
- **Buffer Size**: 1024 samples
- **Encoding**: Linear16 PCM

### Deepgram Configuration

Located in `src/services/deepgram.js`:
- **Model**: Nova-2 (latest, most accurate)
- **Language**: English
- **Smart Format**: Enabled
- **Interim Results**: Enabled
- **Endpointing**: 150ms

## AI Providers

### Default: `AI_PROVIDER=hybrid-openai`

- OpenAI primary, OpenRouter backup (sticky cooldown on 429/5xx)
- Local embeddings: Xenova all-MiniLM-L6-v2 (no API/quotas)

You can add other providers (Groq/DeepInfra/Fireworks/Ollama) by extending `providers/providerFactory.js` and switching `AI_PROVIDER`.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with descriptive messages: `git commit -m "Add feature description"`
5. Push to your fork: `git push origin feature-name`
6. Create a pull request

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Search existing GitHub issues
3. Create a new issue with:
   - Operating system and version
   - Node.js version
   - Error messages or logs
   - Steps to reproduce

---

**Built for better classroom and meeting experiences**

