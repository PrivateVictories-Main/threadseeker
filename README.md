# ThreadSeeker 🔍

**The Autonomous Research Engine** - Find code, models, and community validation for your project ideas.

ThreadSeeker simultaneously searches **GitHub** (for code), **Hugging Face** (for models), and **Reddit** (for community validation) to find the best existing resources for your project ideas.

## ✨ Features

### 🔍 Search & Discovery
- **Zero-Cost Search**: Uses DuckDuckGo for free, unlimited queries (no API keys required for search)
- **🎯 Deep Semantic Matching**: Advanced AI that understands your intent, not just keywords:
  - Analyzes multi-word phrases and context
  - Matches technical terms and frameworks
  - Scores based on comprehensive content analysis (descriptions, READMEs, comments)
- **Maximum Recency**: Prioritizes the freshest content with aggressive time-based scoring
- **Parallel Execution**: All searches run simultaneously for maximum speed

### 🤖 AI-Powered Intelligence
- **Smart Query Generation**: Uses Groq Llama 3-8b to optimize searches for each platform
- **Intelligent Synthesis**: Groq Llama 3-70b provides actionable insights from all results
- **Custom API Keys**: Bring your own Groq key for faster, unlimited AI processing
- **Smart Fallbacks**: Works without AI, using intelligent keyword-based optimization

### 📊 Advanced Analysis
- **GitHub "Zombie Check"**: Detects if projects are active, maintained, stale, or abandoned
- **Reddit "Community Consensus"**: Identifies negative sentiment with warning badges
- **Relevance Scoring**: Multi-factor algorithm considering popularity, recency, and quality

### 🎨 Modern, Organized UI
- **Clean, Minimal Design**: ChatGPT/Gemini-inspired interface
- **Collapsible Sections**: Organize results by platform with expand/collapse
- **Single-Page Experience**: Preview all content in-app via modals (no new tabs)
- **Smart Card Layouts**: Scannable, consistent information hierarchy
- **Smooth Animations**: Framer Motion for buttery transitions
- **Search History**: Quick access to recent searches with local storage

## 🛠️ Tech Stack

### Backend
- **FastAPI** - High-performance async Python API
- **DuckDuckGo Search** - Free, unlimited search queries
- **httpx** - Async HTTP client for parallel requests
- **Groq SDK** - Lightning-fast LLM inference
- **BeautifulSoup** - HTML parsing for metadata extraction

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Professional component library
- **Framer Motion** - Smooth animations and transitions

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- (Optional) Groq API key for AI features

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment (optional - for AI features)
echo "GROQ_API_KEY=your_key_here" > .env

# Start the server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to use the application.

## 🔧 Configuration

### Environment Variables

#### Backend (`.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | No | Groq API key for AI query optimization and synthesis. Get one free at [console.groq.com](https://console.groq.com) |

#### Frontend (`.env.local`)
| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL |

## 📡 API Endpoints

### `POST /search`
Search across all platforms.

**Request:**
```json
{
  "query": "A real-time voice changer using low GPU"
}
```

**Response:**
```json
{
  "github": [...],
  "huggingface": [...],
  "reddit": [...],
  "generated_queries": {...},
  "synthesis": "AI-generated verdict...",
  "search_duration_ms": 2345,
  "errors": []
}
```

### `GET /health`
Health check endpoint.

### `GET /test-search`
Test endpoint to verify search functionality.

## 🎨 UI Features

- **Liquid Animation**: Search input morphs from center to header on submit
- **Skeleton Loading**: Shimmering cards during search
- **Typewriter Effect**: AI verdict appears character by character
- **Copy Commands**: One-click git clone copying
- **Community Warnings**: Visual alerts for negative Reddit sentiment
- **Project Status Badges**: Active/Maintained/Stale/Abandoned indicators

## 🔒 How It Works (No Paid APIs!)

1. **Search**: Uses `duckduckgo-search` library with `site:` operators
2. **GitHub**: Fetches README via `raw.githubusercontent.com`
3. **Reddit**: Uses the `.json` URL hack (append `.json` to any Reddit URL)
4. **User-Agent Rotation**: Prevents rate limiting with rotating headers

## 📝 License

MIT License - feel free to use and modify!

---

Built with ❤️ and ☕

