# Contributing to ThreadSeeker

First off, thank you for considering contributing to ThreadSeeker! 🎉

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Community](#community)

---

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Standards

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members

---

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Describe the behavior you observed and what you expected**
- **Include screenshots if applicable**
- **Include your environment details** (OS, Node.js version, Python version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a step-by-step description** of the suggested enhancement
- **Provide specific examples** to demonstrate the steps
- **Describe the current behavior** and explain the improved behavior
- **Explain why this enhancement would be useful**

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:
- `good first issue` - Issues suitable for newcomers
- `help wanted` - Issues that need attention

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code lints
5. Issue that pull request!

---

## Development Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- Git

### Setup Instructions

1. **Fork and Clone**
```bash
git clone https://github.com/YOUR_USERNAME/RedditSearchEngine.git
cd RedditSearchEngine
```

2. **Backend Setup**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
echo "GROQ_API_KEY=your_key" > .env
```

3. **Frontend Setup**
```bash
cd ../frontend
npm install
```

4. **Run Development Servers**
```bash
# Terminal 1 - Backend
cd backend && source venv/bin/activate
python -m uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend && npm run dev
```

---

## Pull Request Process

1. **Update Documentation**: Update README.md with details of changes if applicable
2. **Follow Style Guidelines**: Ensure your code follows our style guidelines
3. **Write Good Commit Messages**: Use conventional commits format
4. **Test Your Changes**: Make sure everything works as expected
5. **Update Changelog**: Add your changes to CHANGELOG.md if applicable
6. **Get Reviews**: Wait for at least one maintainer to review your PR
7. **Address Feedback**: Make requested changes promptly

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(autocomplete): add fuzzy spell-checking with Levenshtein distance

Implemented advanced spell-checking algorithm that catches typos
not in the dictionary using edit distance calculation.

Closes #123
```

```
fix(frontend): resolve trending content not loading instantly

Updated cache checking to run synchronously on mount for instant display.

Fixes #456
```

---

## Style Guidelines

### JavaScript/TypeScript

- Use **ESLint** and **Prettier** (configs provided)
- Use **TypeScript** for type safety
- Prefer **functional components** with hooks
- Use **meaningful variable names**
- Add **JSDoc comments** for complex functions

**Example:**
```typescript
/**
 * Calculates edit distance between two strings using Levenshtein algorithm
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Edit distance between the strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  // Implementation...
}
```

### Python

- Follow **PEP 8** style guide
- Use **type hints** for function parameters and returns
- Add **docstrings** for all functions and classes
- Keep functions **small and focused**
- Use **meaningful variable names**

**Example:**
```python
def rank_github_results(results: list[GitHubResult], query: str) -> list[GitHubResult]:
    """
    Rank GitHub results by relevance to the search query.
    
    Args:
        results: List of GitHub search results
        query: Original search query
        
    Returns:
        Sorted list of results by relevance score
    """
    # Implementation...
```

### CSS/Styling

- Use **Tailwind CSS** utility classes
- Follow **mobile-first** approach
- Use **CSS variables** for theming
- Keep custom CSS **minimal**

---

## Testing

### Frontend Testing
```bash
cd frontend
npm test
```

### Backend Testing
```bash
cd backend
pytest
```

### Manual Testing Checklist
- [ ] Search works across all platforms
- [ ] Autocomplete suggestions appear correctly
- [ ] Voice input works (with permission)
- [ ] Trending content loads instantly
- [ ] Spell-checking catches typos
- [ ] Results display correctly
- [ ] Responsive design works on mobile
- [ ] Dark mode displays properly

---

## Documentation

- Update README.md for user-facing changes
- Update relevant docs in `/docs` folder
- Add inline comments for complex logic
- Update API documentation if backend changes
- Add examples for new features

---

## Community

### Where to Ask Questions
- **GitHub Discussions**: For general questions and ideas
- **GitHub Issues**: For bugs and feature requests
- **Pull Requests**: For code reviews and implementation discussions

### Recognition

Contributors will be recognized in:
- README.md Contributors section
- CHANGELOG.md for their contributions
- Release notes when applicable

---

## Additional Notes

### Issue and Pull Request Labels

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Documentation improvements
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention needed
- `question`: Further information requested
- `wontfix`: This will not be worked on
- `duplicate`: This issue/PR already exists

---

## Thank You! 🎉

Your contributions to open source make projects like ThreadSeeker possible. We appreciate your time and effort!

**Happy Coding!** 💻✨
