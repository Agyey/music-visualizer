#!/bin/bash
# Quick GitHub deployment - requires GitHub CLI (gh)
cd "/Users/agyeyarya/Development/Music Visualizer"
gh repo create music-visualizer --public --source=. --remote=origin --push 2>&1
