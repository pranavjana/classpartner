# Building Classroom Assistant for Windows

## Prerequisites

1. Install **Node.js** (version 20 or higher): https://nodejs.org/
2. Install **Git**: https://git-scm.com/download/win

## Build Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/classpartner.git
   cd classpartner
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd apps/dashboard
   npm install
   cd ../..
   ```

3. **Build the Windows installer:**
   ```bash
   npm run desktop:make
   ```

4. **Find your installer:**
   - Location: `out/make/squirrel.windows/x64/`
   - File: `Classroom Assistant Setup.exe`
   - Double-click to install!

## Troubleshooting

### "npm: command not found"
- Node.js is not installed. Download from https://nodejs.org/

### Build fails with "Python not found"
- Install Python: https://www.python.org/downloads/
- Or install Windows Build Tools: `npm install --global windows-build-tools`

### "better-sqlite3" errors
- Install Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/
- Select "Desktop development with C++"

## Quick Start (After Installation)

1. The app will appear in your Start Menu as "Classroom Assistant"
2. Launch it
3. Grant microphone permissions when prompted
4. Start transcribing!
