# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅        |

## Reporting a Vulnerability

**Please do _not_ report security vulnerabilities through public GitHub issues.**

Instead, use **GitHub Security Advisories** (repository → **Security** tab →
**Report a vulnerability**). Include:

- Type of vulnerability (e.g. XSS, SSRF, prototype pollution)
- Affected file(s) and location (branch/commit)
- Step-by-step reproduction and impact
- A proof of concept and/or suggested fix, if you have one

**What to expect:** acknowledgment within ~48 hours, progress updates, and a fix for
serious issues as quickly as we can. We'll credit you in the advisory unless you'd
rather stay anonymous.

## Threat model

ThreadSeeker is a **static site plus a few Cloudflare Pages Functions** — there is no
application server, no database, and no user accounts. That shapes what is and isn't
a concern:

- **No secrets in the client.** The browser only calls public, keyless APIs and our
  own same-origin `/api/*` functions. No API keys are shipped to the client or
  required to run the app.
- **No personal data.** Bookmarks, history, and preferences are stored in the
  visitor's own `localStorage`/`sessionStorage` and never leave their browser.
  Nothing is tracked or sent to us.
- **CORS proxy (`/api/proxy`).** This is the most security-relevant component. It is
  an **allowlisted** proxy — it will only fetch from a fixed set of known upstream
  hosts (Docker Hub, Flathub, Lobsters, Stack Exchange, Papers with Code, WordPress,
  etc.), which is the primary defense against SSRF / open-proxy abuse. **Any change
  that broadens the allowlist or relaxes URL validation in `functions/api/proxy.ts`
  must be reviewed with that in mind.**
- **Output handling.** Upstream-provided text (descriptions, titles, READMEs) is
  rendered as React text (escaped by default) and any HTML is stripped/sanitized in
  the adapters. Be careful when introducing `dangerouslySetInnerHTML`.
- **Optional AI endpoints (`/api/optimize-queries`, `/api/synthesize`).** Only
  active when `GROQ_API_KEY` is set. Untrusted upstream result text is stripped of
  control chars/newlines and clamped before entering the prompt, and the system
  prompt instructs the model to never follow instructions embedded in that data
  (prompt-injection mitigation). Requests are same-origin guarded and degraded
  results are never edge-cached. **For production, also add a Cloudflare
  rate-limiting rule** on these two paths (e.g. N requests/min per IP) — a
  stateless Pages Function can't enforce a true per-IP limit, so the dashboard
  rule is the real control against free-tier quota-drain.

## Good practices for contributors

- Never commit secrets. `.env*` is git-ignored; use `.env.example` for templates.
- Keep adapters defensive: validate/normalize upstream data, never trust shapes.
- Run `npm audit` and keep dependencies current; CI fails on type/lint regressions.
- When adding a source, prefer a direct keyless API or the allowlisted proxy — never
  introduce an unbounded fetch of arbitrary user-supplied URLs.

## Compliance

ThreadSeeker collects no personal data and aims to follow the OWASP Top 10 and
standard web-security practices.

---

Thank you for helping keep ThreadSeeker and its users safe. 🔒
