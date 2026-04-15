# ThreadSeeker - Trending Content Feature

## Overview
The trending content feature displays up-to-date, curated projects, models, and discussions from across GitHub, Hugging Face, and Reddit on the homepage before users perform a search.

---

## 🎯 Feature Details

### **What It Does**
- Automatically fetches trending content when the homepage loads
- Displays 6 results from each platform (GitHub, Hugging Face, Reddit)
- Shows real-time popular and active projects
- Disappears when user performs a search
- Reappears when user returns to idle state

### **Content Sources**

#### **GitHub Trending**
- Query: `"trending {current_year} stars:>100"`
- Focuses on: Recently starred projects with significant popularity
- Filters: Active projects from current year

#### **Hugging Face Trending**
- Query: `"trending {current_year} most downloaded"`
- Focuses on: Popular AI models and spaces
- Filters: Most downloaded content from current year

#### **Reddit Trending**
- Query: `"programming {current_year} trending hot"`
- Focuses on: Active programming discussions
- Filters: Hot topics from programming communities

---

## 🏗️ Technical Implementation

### **Backend (`/backend/main.py`)**

New endpoint added:
```python
@app.get("/trending", response_model=SearchResults)
async def get_trending():
    """
    Get trending content across GitHub, HuggingFace, and Reddit.
    Returns curated, up-to-date projects and discussions.
    """
```

**Key Features:**
- Uses parallel search execution
- Optimized queries for each platform
- Returns top 6 results per platform
- Includes performance metrics
- Graceful error handling

### **Frontend (`/frontend/src/`)**

#### **API Client (`lib/api.ts`)**
New function:
```typescript
export async function getTrendingContent(): Promise<SearchResults>
```

#### **Main Page (`app/page.tsx`)**
- Fetches trending on component mount
- Shows loading state while fetching
- Displays trending section with special header
- Conditionally renders based on `isIdle` state
- Uses same `ResultsGrid` component for consistency

---

## 🎨 UI/UX Design

### **Trending Section Header**
- **Icon**: Trending Up icon with gradient background
- **Title**: "Trending Now" in bold
- **Subtitle**: "Popular projects and discussions from the community"
- **Styling**: Matches overall design system

### **Layout**
```
┌─────────────────────────────────────┐
│ Search Input                        │
├─────────────────────────────────────┤
│ Recent Searches (if any)            │
├─────────────────────────────────────┤
│ 📈 Trending Now                     │
│ Popular projects and discussions... │
│                                     │
│ ┌─ GitHub Repositories (6) ───┐   │
│ │ [Collapsible Section]        │   │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ AI Models & Spaces (6) ─────┐   │
│ │ [Collapsible Section]        │   │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Community Discussions (6) ──┐   │
│ │ [Collapsible Section]        │   │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### **States**

**Loading State:**
- Animated pulse icon
- "Loading trending content..." text
- Skeleton cards

**Loaded State:**
- Full trending section with all results
- Collapsible sections for each platform
- Smooth fade-in animation

**Hidden State:**
- Disappears immediately when search is performed
- Shows again when returning to idle (no search results)

---

## 🔄 User Flow

1. **User visits homepage**
   - Trending content starts loading automatically
   - Skeleton cards show loading state

2. **Content loads**
   - 18 total items displayed (6 per platform)
   - Each section can be expanded/collapsed
   - Smooth animation on appearance

3. **User performs search**
   - Trending section disappears
   - Search results replace trending content

4. **User clears/finishes with search**
   - Returns to idle state
   - Trending content reappears
   - Previously loaded content is cached

---

## ⚡ Performance Considerations

### **Optimization Strategies**
1. **Parallel Fetching**: All 3 platforms searched simultaneously
2. **Result Limiting**: Only top 6 per platform (vs 8 in regular search)
3. **Client-Side Caching**: Trending content cached in component state
4. **No AI Synthesis**: Skips expensive AI synthesis for trending
5. **Lazy Loading**: Only fetches when homepage is visited

### **Load Times**
- **Average**: 3-5 seconds for all platforms
- **Best Case**: 2 seconds (fast network)
- **Worst Case**: 10 seconds (slow network/rate limits)

### **Error Handling**
- Graceful degradation if API fails
- Console logging for debugging
- Silent failure (doesn't block UI)
- User can still search normally

---

## 📊 Benefits

### **For Users**
✅ **Discover Without Searching**: See what's popular immediately  
✅ **Stay Current**: Always shows up-to-date content  
✅ **Inspiration**: Get ideas from trending projects  
✅ **Quick Access**: One click to explore popular items  
✅ **No Commitment**: Doesn't interfere with search flow

### **For Engagement**
✅ **Reduces Bounce Rate**: Gives users something to explore  
✅ **Increases Time on Site**: More content to browse  
✅ **Encourages Exploration**: Users may click trending items  
✅ **Social Proof**: Shows what others are interested in

---

## 🔮 Future Enhancements

### **Potential Improvements**
1. **Personalization**: Tailor trending based on user history
2. **Refresh Button**: Allow users to manually refresh trending
3. **Time Filters**: "Trending Today", "This Week", "This Month"
4. **Category Filters**: Filter by language, topic, or type
5. **Bookmarking**: Save trending items for later
6. **Trending Analytics**: Track which items are most clicked
7. **Auto-Refresh**: Periodically update trending in background
8. **Customization**: Let users choose which platforms to show

### **Advanced Features**
- **Trending Score**: Show "hotness" indicator per item
- **Time Stamps**: "Trending for 2 hours"
- **Change Indicators**: "↑ 50% increase in stars"
- **Related Trending**: "Users also viewed..."
- **Trending History**: "What was trending last week"

---

## 🎯 Success Metrics

### **Measurable Outcomes**
- **Click-Through Rate**: % of users who click trending items
- **Dwell Time**: Time spent viewing trending content
- **Bounce Rate**: Reduction in immediate exits
- **Search Engagement**: Does trending inspire searches?
- **Return Visits**: Do users come back to check trending?

### **Quality Indicators**
- **Content Freshness**: How recent are trending items?
- **Relevance**: Are items truly trending/popular?
- **Diversity**: Good mix across platforms?
- **Error Rate**: How often does fetching fail?

---

## 🚀 Deployment Notes

### **Configuration**
- No additional environment variables needed
- Uses existing search infrastructure
- No database storage required
- Works with or without Groq API key

### **Monitoring**
- Check `/trending` endpoint health
- Monitor response times
- Track error rates
- Validate content quality

---

**Last Updated:** December 26, 2024  
**Version:** 2.2 - Trending Content Feature

