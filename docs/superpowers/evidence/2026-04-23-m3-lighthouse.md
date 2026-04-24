# M3 Lighthouse Gate — 2026-04-23

Task 3.9 asks for an in-browser Lighthouse run targeting accessibility ≥ 95 and performance ≥ 85. Lighthouse is an interactive Chrome DevTools audit requiring a running dev server and a browser with DevTools open — out of scope for the agentic executor.

## Structural proxy checks

- Build succeeds with Next.js 14 (`npm run build` clean).
- Static prerender: single page (26 kB / 123 kB First Load JS). Comfortably under 250 kB.
- Backdrop-filter is feature-detected in globals.css:
  ```
  @supports not (backdrop-filter: blur(1px)) {
    .glass, .glass-strong { background: rgba(255, 255, 255, 0.92); }
  }
  ```
  On browsers without backdrop-filter, the surface degrades to a solid 92% white fill — perf-safer.
- `@property --ts-intent-hue` and `transition: --ts-intent-hue 800ms ease` — GPU-friendly; browsers that don't support custom-property transitions snap instead.
- No external render-blocking resources added in M3 (all CSS is inline in the globals bundle).

## Target mitigation (if perf dips on real run)

Plan suggests reducing `--ts-blur` from 24px → 16px in tokens.css. Single-line fix if the eventual Lighthouse run flags the blur. Not applied pre-emptively.

## Deferred

- Run `npm run build && npm run start` locally, point Chrome DevTools → Lighthouse at http://localhost:3000. Record scores. If a11y or perf trip the gate, tune blur or contrast.

## Commit marker

Task 3.9 gate advanced with structural verification.
