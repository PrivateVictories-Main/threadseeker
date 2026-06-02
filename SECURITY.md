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
- **CORS proxy (`/api/proxy`, `/api/gh`).** The most security-relevant component.
  Both are **allowlisted** (proxy: a fixed host set; gh: `api.github.com` only),
  which is the primary defense against SSRF. They fetch with `redirect:"manual"`
  and refuse any 3xx — the allowlist only validates the first hop, so following a
  redirect would let an allowlisted open-redirect pivot to an arbitrary host (and,
  on `/api/gh`, leak the `GITHUB_TOKEN` to GitHub's cross-host 302s). `/api/proxy`
  also forces a non-HTML response Content-Type so it can't reflect attacker HTML
  under our origin. **Any change that broadens the allowlist, relaxes URL
  validation, or re-enables redirect-following must be reviewed with that in mind.**
- **Output handling.** Upstream-provided text (descriptions, titles, READMEs) is
  rendered as React text (escaped by default) and any HTML is stripped/sanitized in
  the adapters. Every dynamic `href` (author-controlled package homepages, post
  URLs) passes through `safeHref()` (http/https/mailto only) so a `javascript:`/
  `data:` URL can't become a clickable XSS. A site-wide CSP (`script-src 'self'`,
  `object-src 'none'`, `base-uri 'self'`) is the defense-in-depth backstop. Be
  careful when introducing `dangerouslySetInnerHTML`.
- **Static-export advisory scope.** The site ships as a static export with no Next
  server, so the high-severity Next.js advisories (SSR DoS, image-optimizer,
  middleware request-smuggling, RSC cache poisoning) **do not apply** — they all
  require a running Next runtime. Track `npm audit`, but don't let that noise mask
  a build-time-relevant finding.
- **Optional AI endpoints (`/api/optimize-queries`, `/api/synthesize`).** Only
  active when `GROQ_API_KEY` is set. Untrusted upstream result text is stripped of
  control chars/newlines and clamped, wrapped in a **per-request random nonce
  delimiter** the data can't forge, and the system prompt instructs the model to
  never follow instructions embedded in that data
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
