#!/bin/bash

# Music Visualizer - GitHub Deployment Script
# This script helps deploy the repository to GitHub

set -e

REPO_NAME="music-visualizer"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Music Visualizer - GitHub Deployment"
echo "========================================"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not initialized!"
    exit 1
fi

# Check if remote already exists
if git remote get-url origin &>/dev/null; then
    echo "⚠️  Remote 'origin' already exists:"
    git remote get-url origin
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your GitHub username: " GITHUB_USER
        git remote set-url origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
    else
        echo "Using existing remote..."
    fi
else
    # Get GitHub username
    read -p "Enter your GitHub username: " GITHUB_USER
    
    if [ -z "$GITHUB_USER" ]; then
        echo "❌ GitHub username is required!"
        exit 1
    fi
    
    # Add remote
    echo "📡 Adding remote origin..."
    git remote add origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
fi

# Ensure we're on main branch
echo "🌿 Ensuring main branch..."
git branch -M main 2>/dev/null || true

# Check if repo exists on GitHub (optional - will fail gracefully if it doesn't)
echo ""
echo "📦 Ready to push to GitHub!"
echo ""
echo "⚠️  IMPORTANT: Make sure you've created the repository on GitHub first!"
echo "   Go to: https://github.com/new"
echo "   Repository name: ${REPO_NAME}"
echo "   Don't initialize with README/gitignore"
echo ""
read -p "Have you created the repository on GitHub? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Pushing to GitHub..."
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Successfully deployed to GitHub!"
        echo "📍 Repository: https://github.com/${GITHUB_USER}/${REPO_NAME}"
    else
        echo ""
        echo "❌ Push failed. Common issues:"
        echo "   1. Repository doesn't exist on GitHub"
        echo "   2. Authentication required (use GitHub CLI or SSH keys)"
        echo "   3. Network issues"
        echo ""
        echo "💡 Tip: You may need to authenticate first:"
        echo "   - Install GitHub CLI: brew install gh"
        echo "   - Or set up SSH keys: https://docs.github.com/en/authentication"
    fi
else
    echo ""
    echo "📋 Manual steps:"
    echo "   1. Create repo at: https://github.com/new"
    echo "   2. Name: ${REPO_NAME}"
    echo "   3. Then run: git push -u origin main"
fi

