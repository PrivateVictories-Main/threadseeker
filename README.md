# 🔍 ThreadSeeker - The Autonomous Research Engine

<div align="center">

![ThreadSeeker](https://img.shields.io/badge/ThreadSeeker-v1.0-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.127-009688?style=for-the-badge&logo=fastapi)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Python](https://img.shields.io/badge/Python-3.14-3776AB?style=for-the-badge&logo=python)

**Find code, models, and community validation for your project ideas — all in one place.**

[Features](#-features) • [Demo](#-demo) • [Installation](#-installation) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## 🌟 Overview

ThreadSeeker is an intelligent search engine that helps developers discover the perfect tools and resources for their projects by searching across **GitHub**, **Hugging Face**, and **Reddit** simultaneously. With AI-powered query optimization and intelligent ranking, you'll find exactly what you need in seconds.

### ✨ What Makes ThreadSeeker Special?

- 🤖 **AI-Powered Search**: Uses Groq's LLM to generate optimized queries for each platform
- ⚡ **Instant Results**: Parallel search across multiple platforms with sub-second response times
- 🎯 **Smart Autocomplete**: 100+ intelligent suggestions with fuzzy spell-checking
- 🔥 **Real-Time Trending**: See what's hot in the dev community right now
- 🎨 **Premium UI**: Beautiful, modern interface inspired by Gemini and Perplexity
- 💬 **Voice Input**: Search using your voice with built-in speech recognition
- 📊 **Intelligent Ranking**: Results sorted by relevance, stars, and community engagement
- 🎭 **In-App Previews**: View project details without leaving the app

---

## 🚀 Features

### 🔍 Multi-Platform Search
Search across three major platforms simultaneously:
- **GitHub**: Find repositories, libraries, and frameworks
- **Hugging Face**: Discover AI models and datasets
- **Reddit**: Get community discussions and real-world insights

### 🧠 Intelligent Autocomplete
- **100+ curated suggestions** across 10 categories (Web, AI/ML, Mobile, Backend, DevOps, Games, Data, Blockchain, IoT)
- **Advanced fuzzy spell-checking** with Levenshtein distance algorithm
- **150+ spell corrections** for common typos
- **Search history integration** for personalized suggestions
- **Context-aware matching** with multi-factor scoring

### 🎯 Smart Features
- **AI Query Optimization**: Automatically generates the best search queries for each platform
- **Intelligent Ranking**: Results sorted by relevance, popularity, and freshness
- **Community Warnings**: Flags NSFW or quarantined Reddit content
- **Instant Caching**: Lightning-fast repeat searches with smart caching
- **Offline Support**: Works with cached data when offline

### 🎨 Premium UI/UX
- **Glassmorphism Design**: Modern frosted-glass aesthetics
- **Smooth Animations**: Powered by Framer Motion
- **Dark Mode**: Easy on the eyes, perfect for coding sessions
- **Responsive Layout**: Works beautifully on all screen sizes
- **Voice Input**: Search hands-free with Web Speech API
- **Keyboard Navigation**: Full keyboard support for power users

---

## 📦 Installation

### Prerequisites
- **Node.js** 18+ and npm/yarn
- **Python** 3.10+
- **Groq API Key** (get it free at console.groq.com)

### Quick Start

#### 1. Clone the repository
```bash
git clone https://github.com/PrivateVictories-Main/RedditSearchEngine.git
cd RedditSearchEngine
```

#### 2. Set up the Backend
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "GROQ_API_KEY=your_api_key_here" > .env

# Start the server
python -m uvicorn main:app --reload --port 8000
```

#### 3. Set up the Frontend
```bash
cd ../frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

#### 4. Open your browser
Navigate to http://localhost:3000

---

## 🔧 Configuration

### Backend Configuration
Create `backend/.env`:
```env
GROQ_API_KEY=your_groq_api_key_here
```

### Frontend Configuration
The frontend automatically connects to `http://localhost:8000`. To change this, set:
```env
NEXT_PUBLIC_API_URL=your_backend_url
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Autocomplete │  │  Voice Input │  │  Results UI  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/REST
┌────────────────────────▼────────────────────────────────┐
│                   Backend (FastAPI)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  AI Logic    │  │Search Engine │  │   Ranking    │ │
│  │  (Groq LLM)  │  │  (Parallel)  │  │  Algorithm   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐     ┌──────────┐    ┌────────┐
    │ GitHub │     │ Hugging  │    │ Reddit │
    │  API   │     │Face API  │    │  API   │
    └────────┘     └──────────┘    └────────┘
```

### Tech Stack

**Frontend:**
- Next.js 15 (React 19)
- TypeScript
- Tailwind CSS
- Framer Motion
- shadcn/ui components

**Backend:**
- FastAPI (Python)
- Groq (Llama 3.3 70B)
- DuckDuckGo Search
- Pydantic for validation

---

## 📚 Documentation

Comprehensive documentation is available in the repository:

- **ENHANCED-AUTOCOMPLETE-AND-INSTANT-LOAD.md** - Complete feature overview
- **INSTANT-LOAD-OPTIMIZATIONS.md** - Performance optimizations
- **AUTOCOMPLETE-FEATURE.md** - Autocomplete system details
- **VOICE-INPUT-FEATURE.md** - Voice search implementation
- **DETAILED-VIEW-FEATURE.md** - In-app preview modal
- **TRENDING-FEATURE.md** - Trending content system

---

## 🎯 Usage Examples

### Basic Search
```
Type: "react authentication"
→ AI generates optimized queries
→ Searches GitHub, Hugging Face, Reddit
→ Returns ranked results in <2s
```

### Voice Search
```
Click microphone icon
→ Say: "machine learning image classifier"
→ Automatic speech-to-text
→ Instant search results
```

### Autocomplete
```
Type: "flutter"
→ See 6 relevant suggestions instantly
→ Navigate with ↑↓ keys, select with Enter
```

---

## 🚀 Performance

### Speed Metrics
- **First Load**: <800ms (with cache: <100ms)
- **Search Results**: ~2s average
- **Autocomplete**: <50ms response time
- **Trending Content**: Instant (cached)

### Optimization Features
- Triple-cache system (memory + localStorage + background refresh)
- Parallel API requests
- Smart query debouncing
- Lazy loading components
- Optimized animations

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Ways to Contribute
1. 🐛 Report bugs via Issues
2. 💡 Suggest features or improvements
3. 📝 Improve documentation
4. 🔧 Submit pull requests

### Development Setup
```bash
# Fork the repo
git clone https://github.com/YOUR_USERNAME/RedditSearchEngine.git
cd RedditSearchEngine

# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes and commit
git commit -m "Add amazing feature"

# Push to your fork
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## 📝 License

This project is licensed under the **MIT License** - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- **Groq** - For lightning-fast LLM inference
- **DuckDuckGo** - For privacy-respecting search
- **shadcn/ui** - For beautiful UI components
- **Framer Motion** - For smooth animations
- The open-source community for inspiration

---

## 🔗 Links

- **Repository**: https://github.com/PrivateVictories-Main/RedditSearchEngine
- **Issues**: https://github.com/PrivateVictories-Main/RedditSearchEngine/issues
- **Groq API**: https://console.groq.com

---

<div align="center">

**Made with ❤️ by the ThreadSeeker Team**

⭐ Star this repo if you find it helpful!

</div>
