# Proxy Server for API Key Protection

The proxy server runs on `http://127.0.0.1:3500` and protects your API keys by keeping them server-side.

## Available Endpoints

### Health Check
```bash
GET http://127.0.0.1:3500/api/health
```

### OpenAI Chat Completions
```bash
POST http://127.0.0.1:3500/api/openai/chat/completions
Content-Type: application/json

{
  "model": "gpt-4o-mini",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ]
}
```

### OpenRouter Chat Completions
```bash
POST http://127.0.0.1:3500/api/openrouter/chat/completions
Content-Type: application/json

{
  "model": "meta-llama/llama-3.1-8b-instruct",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ]
}
```

### Google Gemini
```bash
POST http://127.0.0.1:3500/api/gemini/generate
Content-Type: application/json

{
  "model": "gemini-2.5-flash",
  "contents": [
    {"role": "user", "parts": [{"text": "Hello!"}]}
  ]
}
```

### Deepgram Key (for WebSocket)
```bash
GET http://127.0.0.1:3500/api/deepgram/key
```

## Usage from React/Dashboard

```javascript
// Example: Call OpenAI through proxy
const response = await fetch('http://127.0.0.1:3500/api/openai/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Summarize this text...' }],
    temperature: 0.7
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

## Security Features

- **Rate Limiting**: 100 requests per minute per IP
- **Local Only**: Binds to 127.0.0.1 (not accessible externally)
- **CORS**: Only allows requests from localhost:3001
- **Logging**: All requests are logged with timing information
- **Key Validation**: Returns clear errors if keys aren't configured

## Configuration

Keys are loaded from `.env` file:
```
DEEPGRAM_API_KEY=your_key
OPENAI_API_KEY=your_key
GOOGLE_GENERATIVE_AI_API_KEY=your_key
OPENROUTER_API_KEY=your_key
```
