# 📖 GitSeeker Usage Guide

## 🚀 Getting Started

### Step 1: Start the App

```bash
cd gitseeker
npm run dev
```

Open http://localhost:3000

### Step 2: Configure AI Provider

Click **"AI Settings"** button in the top-right navbar.

#### Option A: Use WebLLM (Free & Private)
1. Select **"WebLLM (Free)"**
2. Choose a model:
   - **Llama 3.1 8B** (Recommended) - Best balance
   - **Llama 3.2 3B** (Faster) - Lighter, faster
   - **Phi 3.5 Mini** (Lightweight) - Smallest
   - **Qwen 2.5 7B** (Multilingual) - Best for non-English
3. Click **"Save & Apply"**
4. Click the **status pill** in navbar to start download
5. Wait for "🟢 AI Ready" (~5-10 min first time)

#### Option B: Use OpenAI
1. Select **"OpenAI"**
2. Enter your API key from [platform.openai.com](https://platform.openai.com)
3. Choose model (GPT-4 Turbo recommended)
4. Click **"Save & Apply"**
5. Status shows "🟢 OpenAI Ready"

#### Option C: Use Anthropic Claude
1. Select **"Anthropic"**
2. Enter your API key from [console.anthropic.com](https://console.anthropic.com)
3. Choose model (Claude 3.5 Sonnet recommended)
4. Click **"Save & Apply"**
5. Status shows "🟢 Anthropic Ready"

#### Option D: Use OpenRouter (100+ Models)
1. Select **"OpenRouter"**
2. Enter your API key from [openrouter.ai/keys](https://openrouter.ai/keys)
3. Choose from 100+ models (automatically updated!)
4. Click **"Save & Apply"**
5. Status shows "🟢 OpenRouter Ready"

---

## 🔍 Searching for Projects

### Step 1: Select Sources

Toggle the source buttons below the search bar:
- **🐙 GitHub** - Code repositories
- **🤗 Hugging Face** - AI models & datasets
- **🦊 GitLab** - Open source projects
- **📦 npm** - JavaScript packages
- **🐍 PyPI** - Python packages

**Tip**: Enable all sources for comprehensive results!

### Step 2: Enter Your Query

Type what you're looking for:
- "machine learning models"
- "react ui components"
- "python data analysis"
- "rust cli tools"
- "nextjs templates"

**Or** click a suggestion pill for quick searches.

### Step 3: Review Results

Results are ranked by:
- **Relevance** to your query
- **Popularity** (stars, downloads)
- **Recency** (recently updated)

Each card shows:
- Project name & author
- Description
- Source badge (GitHub, HF, etc.)
- Stats (stars, downloads, language)
- Topics/tags
- Last updated time

---

## 🤖 AI Analysis

### Analyzing a Project

1. **Ensure AI is Ready**
   - Check status pill shows "🟢 Ready"
   - If not, configure in AI Settings

2. **Click "⚡ Analyze with AI"**
   - Button on any project card
   - Disabled if AI not ready

3. **Watch AI Work**
   - "Fetching documentation..." appears
   - AI streams response token-by-token
   - Blinking cursor shows it's thinking

4. **Read Insights**
   - What the project does
   - Key features
   - Who should use it
   - Technical requirements

5. **Stop if Needed**
   - Click "Stop" button to abort
   - Close with "X" button

### What AI Analyzes

The AI reads the project's:
- README documentation
- Description
- Topics/tags
- Language/framework
- Source platform

Then provides:
- **Purpose**: What problem it solves
- **Features**: Key capabilities
- **Use Cases**: When to use it
- **Requirements**: What you need

---

## 💡 Pro Tips

### Search Tips

1. **Be Specific**
   - ❌ "ai"
   - ✅ "ai image generation models"

2. **Use Multiple Keywords**
   - ❌ "react"
   - ✅ "react typescript ui components"

3. **Try Different Phrasings**
   - "machine learning" vs "ML" vs "neural networks"

4. **Enable Multiple Sources**
   - Find packages AND models AND repos

### AI Provider Tips

1. **WebLLM (Free)**
   - ✅ Best for: Privacy, unlimited use
   - ✅ Download once, use forever
   - ❌ Initial 5-10 min download
   - ❌ Requires WebGPU browser

2. **OpenAI (Paid)**
   - ✅ Best for: Speed, quality
   - ✅ No download needed
   - ✅ GPT-4 is most accurate
   - ❌ Costs per request
   - ❌ Requires API key

3. **Anthropic (Paid)**
   - ✅ Best for: Long context, reasoning
   - ✅ Claude 3.5 is excellent
   - ❌ Costs per request
   - ❌ Requires API key

4. **OpenRouter (Paid)**
   - ✅ Best for: Model variety
   - ✅ Access 100+ models
   - ✅ Competitive pricing
   - ❌ Requires API key

### Performance Tips

1. **First Time Setup**
   - WebLLM: Download during lunch break
   - API: Instant, just add key

2. **Faster Searches**
   - Disable unused sources
   - Use specific keywords

3. **Better AI Results**
   - Use GPT-4 or Claude 3.5 for best quality
   - Use Llama 3.1 8B for good free results
   - Use smaller models for speed

---

## 🎨 UI Features

### Animations

- **Hover Effects**: Cards lift and glow
- **Button Shine**: Gradient sweep on hover
- **Smooth Transitions**: Everything animates
- **Staggered Loading**: Results appear in sequence

### Keyboard Shortcuts

- **Enter**: Submit search
- **Esc**: Close modals
- **Tab**: Navigate elements

### Dark Mode

- Always-on dark theme
- Optimized for long sessions
- Easy on the eyes

---

## 🐛 Troubleshooting

### "WebGPU Unsupported"

**Problem**: Browser doesn't support WebGPU

**Solutions**:
1. Update to Chrome 113+, Edge 113+, or Safari 17+
2. Use API provider instead (OpenAI, Claude, OpenRouter)

### "AI Not Ready"

**Problem**: AI provider not configured

**Solutions**:
1. Click "AI Settings"
2. Choose provider and configure
3. For WebLLM, click status pill to download

### "Invalid API Key"

**Problem**: API key is wrong or expired

**Solutions**:
1. Check key is copied correctly
2. Verify account has credits
3. Generate new key from provider

### "Rate Limit Exceeded"

**Problem**: Too many requests to GitHub

**Solutions**:
1. Wait 60 seconds
2. Reduce number of searches
3. Authenticate with GitHub (future feature)

### "No Results Found"

**Problem**: Search returned nothing

**Solutions**:
1. Try different keywords
2. Enable more sources
3. Check spelling
4. Broaden search terms

### Model Download Stuck

**Problem**: WebLLM download not progressing

**Solutions**:
1. Check internet connection
2. Ensure 5GB+ free space
3. Clear browser cache
4. Try different browser

---

## 📊 Understanding Results

### Result Cards

**Top Section**:
- Avatar: Project/author icon
- Name: Project name (hover for gradient)
- Author: Username/organization
- Source Badge: Where it's from

**Middle Section**:
- Description: What it does
- Topics: Tags and categories
- Stats: Stars, downloads, language
- Updated: How recently active

**Bottom Section**:
- Analyze Button: Get AI insights
- External Link: Visit project

### Source Badges

- **🐙 GitHub**: Code repository
- **🤗 Hugging Face**: AI model/dataset
- **🦊 GitLab**: Open source project
- **📦 npm**: JavaScript package
- **🐍 PyPI**: Python package

### Stats Explained

- **Stars** ⭐: GitHub/GitLab popularity
- **Downloads** ⬇️: npm/PyPI/HF usage
- **Language** 🔵: Primary programming language
- **Updated** 🕐: Last activity (e.g., "2 days ago")

---

## 🎯 Example Workflows

### Finding an AI Model

1. Enable **Hugging Face** source
2. Search: "text to image stable diffusion"
3. Review model cards
4. Click "Analyze with AI" on interesting ones
5. Read AI insights about use cases
6. Click external link to visit model page

### Finding a React Library

1. Enable **GitHub** and **npm** sources
2. Search: "react typescript component library"
3. Sort by stars (automatic)
4. Analyze top results
5. Compare features via AI insights
6. Choose best fit for your project

### Discovering Python Tools

1. Enable **GitHub** and **PyPI** sources
2. Search: "python data visualization"
3. Review descriptions and stats
4. Use AI to understand differences
5. Check last updated dates
6. Pick actively maintained tool

---

## 🔐 Privacy & Security

### What's Stored Locally

- AI provider choice
- Selected model
- API keys (encrypted)
- Search history (optional)

### What's Sent to Servers

**WebLLM**: Nothing! 100% local.

**API Providers**: 
- Your search query
- Project documentation
- Your API key (to provider only)

**Source APIs**:
- Your search terms
- (Standard API usage)

### Clearing Data

1. **Clear API Keys**: AI Settings → Clear API Key
2. **Clear Cache**: Browser settings → Clear site data
3. **Clear History**: Browser settings → Clear browsing data

---

## 🎓 Best Practices

### For Best Results

1. **Use Specific Queries**: "react table component" not "table"
2. **Enable Multiple Sources**: Find more options
3. **Read AI Insights**: Understand before choosing
4. **Check Last Updated**: Prefer active projects
5. **Compare Similar**: Analyze multiple options

### For Privacy

1. **Use WebLLM**: 100% local, no data sent
2. **Disable Analytics**: Already disabled by default
3. **Use Private Browsing**: Extra privacy layer

### For Performance

1. **Cache WebLLM**: Download once, use forever
2. **Use Faster Models**: Llama 3.2 3B or Phi 3.5
3. **Disable Unused Sources**: Faster searches

---

## 🆘 Getting Help

### Resources

- **README.md**: Installation & setup
- **FEATURES.md**: Complete feature list
- **GitHub Issues**: Report bugs
- **Discussions**: Ask questions

### Common Questions

**Q: Is it really free?**
A: Yes! WebLLM is 100% free, unlimited.

**Q: Do I need an API key?**
A: Only for OpenAI/Anthropic/OpenRouter. WebLLM needs none.

**Q: How accurate is the AI?**
A: GPT-4/Claude 3.5 > Llama 3.1 8B > smaller models

**Q: Can I use offline?**
A: WebLLM works offline after initial download!

**Q: Is my data private?**
A: With WebLLM, yes! 100% local processing.

---

**Enjoy discovering amazing projects with GitSeeker! 🚀**


