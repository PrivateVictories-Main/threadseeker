# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of ThreadSeeker seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via:

1. **GitHub Security Advisories** (preferred)
   - Go to the Security tab in the repository
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Direct Contact**
   - Create a private issue on GitHub
   - Include [SECURITY] in the title
   - Provide detailed information about the vulnerability

### What to Include

When reporting a vulnerability, please include:

- **Type of vulnerability** (e.g., XSS, SQL injection, CSRF)
- **Full paths** of source file(s) related to the vulnerability
- **Location** of the affected source code (tag/branch/commit)
- **Step-by-step instructions** to reproduce the issue
- **Proof of concept or exploit code** (if possible)
- **Impact** of the vulnerability
- **Suggested fix** (if you have one)

### What to Expect

- **Acknowledgment**: We'll acknowledge receipt within 48 hours
- **Updates**: We'll keep you informed about the progress
- **Timeline**: We aim to fix critical vulnerabilities within 7 days
- **Credit**: We'll credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

### For Users

1. **API Keys**: Never commit API keys to version control
   - Use `.env` files (already in `.gitignore`)
   - Rotate keys regularly
   - Use environment-specific keys

2. **Dependencies**: Keep dependencies up to date
   ```bash
   # Frontend
   npm audit
   npm audit fix
   
   # Backend
   pip-audit
   pip install --upgrade -r requirements.txt
   ```

3. **HTTPS**: Always use HTTPS in production
   - Never send API keys over HTTP
   - Use secure cookies for sessions

4. **Input Validation**: The app validates input, but be cautious with:
   - User-generated content
   - URL parameters
   - File uploads (if added in the future)

### For Developers

1. **Code Reviews**: All PRs require review before merging

2. **Dependency Scanning**: We use automated tools to scan for vulnerabilities

3. **Secrets Scanning**: Never commit sensitive data
   - Use `.env.example` for templates
   - Keep actual `.env` files in `.gitignore`

4. **Authentication**: If adding auth features:
   - Use proven libraries (e.g., NextAuth.js, FastAPI-Users)
   - Implement rate limiting
   - Use CSRF protection
   - Hash passwords with bcrypt/argon2

5. **API Security**:
   - Implement rate limiting for public endpoints
   - Validate all inputs
   - Sanitize outputs
   - Use CORS appropriately

## Known Security Considerations

### Current Implementation

1. **API Keys**: Groq API keys are required and should be kept secret
   - Store in `.env` files (never commit)
   - Use environment variables in production
   - Rotate regularly

2. **Rate Limiting**: Currently no rate limiting on backend
   - Consider implementing for production use
   - Protect against DoS attacks

3. **Input Validation**: Basic validation in place
   - Search queries are sanitized
   - User input is escaped in UI

4. **CORS**: Currently allows all origins for development
   - Configure properly for production
   - Restrict to your frontend domain

5. **No Authentication**: Currently no user authentication
   - Anyone can use the search API
   - Consider adding for production deployments

## Security Updates

We'll announce security updates through:

- GitHub Security Advisories
- Release notes in CHANGELOG.md
- README.md for critical issues

## Compliance

ThreadSeeker aims to comply with:

- OWASP Top 10 security risks
- GDPR (no personal data collected currently)
- Standard web security practices

## Contact

For security concerns, please use GitHub's security features or create a private issue.

---

**Thank you for helping keep ThreadSeeker and its users safe!** 🔒
