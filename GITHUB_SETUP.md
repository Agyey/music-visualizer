# Quick GitHub Setup

## Step 1: Create Repository on GitHub
1. Go to: https://github.com/new
2. Repository name: `music-visualizer`
3. Description: "Advanced music visualizer with real-time audio analysis"
4. Choose Public or Private
5. **DO NOT** check "Initialize with README"
6. Click "Create repository"

## Step 2: Run These Commands

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username:

```bash
cd "/Users/agyeyarya/Development/Music Visualizer"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/music-visualizer.git
git branch -M main
git push -u origin main
```

## Alternative: Use the Interactive Script

```bash
cd "/Users/agyeyarya/Development/Music Visualizer"
./deploy-to-github.sh
```

This script will guide you through the process interactively.
