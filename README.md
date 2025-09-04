# Classroom Assistant

A real-time transcription overlay application built with Electron and Deepgram API. Provides live speech-to-text transcription in a floating, always-on-top window perfect for classroom or meeting environments.

## Features

- **Real-time transcription** using Deepgram's Nova-2 model
- **Always-on-top overlay** that stays visible during presentations
- **Live interim results** showing text as you speak
- **Low-latency audio processing** with optimized buffer sizes
- **Resizable window** with drag-to-resize functionality
- **Connection quality monitoring** with latency feedback
- **Global shortcuts** for quick show/hide (Ctrl+Shift+T)
- **Clean, minimal UI** with transparency and blur effects

## Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Deepgram API Key** ([Get one free here](https://deepgram.com/))

## Setup Instructions

### 1. Clone the Repository

```bash
git clone [repository-url]
cd classpartner
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit `.env` and add your Deepgram API key:
```
DEEPGRAM_API_KEY=your_deepgram_api_key_here
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

## Project Structure

```
classpartner/
├── src/
│   ├── index.js              # Main Electron process
│   ├── preload.js            # Secure IPC bridge
│   ├── renderer.js           # Frontend logic
│   ├── index.html            # UI layout
│   ├── index.css             # Styling
│   └── services/
│       └── deepgram.js       # Deepgram WebSocket service
├── audio-processor.js        # AudioWorklet processor
├── package.json              # Dependencies and scripts
├── forge.config.js           # Electron Forge configuration
└── .env.example              # Environment template
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

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with descriptive messages: `git commit -m "Add feature description"`
5. Push to your fork: `git push origin feature-name`
6. Create a pull request

## License

[Add your license here]

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