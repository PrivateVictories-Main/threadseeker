# ThreadSeeker frontend — design system

A contributor-facing reference for the visual vocabulary used across the
app. Read this before adding new components, restyling existing ones, or
extending tokens. The system is small on purpose — the rules below let
new code drop into the existing rhythm without one-off CSS.

---

## Where things live

| Layer | File | Purpose |
| --- | --- | --- |
| Design tokens | `src/styles/tokens.css` | Surfaces, accents, text inks, radii, shadows, blur, intent-hue base |
| Global styles | `src/app/globals.css` | Glass surfaces, pills, buttons, card layout, focus, print, reduced-motion |
| Motion presets | `src/lib/motion.ts` | Spring tunings + variants (cards, sheets, modes, bookmark) |
| Motion provider | `src/components/motion/MotionProvider.tsx` | `<MotionConfig reducedMotion="user">` |
| Tailwind config | `tailwind.config.ts` | Custom screens (incl. `xs: 400px`), shadcn-derived color tokens |

The CSS layers are unidirectional: `tokens.css` → `globals.css` → component utility classes. Component files do not redefine token values.

---

## Design tokens (`--ts-*`)

All custom properties live on `:root`. They are the only colors, radii,
and shadows you should reference from new code — Tailwind utility colors
exist for shadcn primitives but new ThreadSeeker surfaces use the tokens.

### Surfaces

```css
--ts-surface          rgba(255, 255, 255, 0.78)   /* default glass body  */
--ts-surface-strong   rgba(255, 255, 255, 0.92)   /* opaque glass / sheets */
--ts-surface-sticky   rgba(255, 255, 255, 0.82)   /* sticky header        */
--ts-border           rgba(99, 102, 241, 0.22)    /* primary glass border */
--ts-border-soft      rgba(99, 102, 241, 0.14)    /* sticky / ghost edges */
```

### Accent (indigo–violet, no magenta)

```css
--ts-accent           #6366f1                      /* indigo-500           */
--ts-accent-strong    #4f46e5                      /* indigo-600 (text)    */
--ts-accent-soft      rgba(99,102,241,0.15)        /* focus halo, fills    */
--ts-accent-gradient  linear-gradient(135deg,#6366f1,#8b5cf6)
```

### Text inks

```css
--ts-text          #0f172a   /* slate-900, body                          */
--ts-text-muted    #334155   /* slate-700, secondary                     */
--ts-text-subtle   #64748b   /* slate-500, captions / metadata           */
--ts-text-faint    #94a3b8   /* slate-400, decorative micro-labels       */
```

The faint tier is *decorative-only* — uppercase tracked labels like
"TRY" and "RECENT" — and may sit below WCAG AA contrast against the
glass surface. Body copy must use `--ts-text` or `--ts-text-muted`.

### Radii

```css
--ts-radius-sm    8px    /* buttons, small chrome           */
--ts-radius-md    12px   /* mid-weight panels, dropdowns    */
--ts-radius-lg    18px   /* cards, sheets, modals           */
--ts-radius-full  999px  /* pills, search bar, CTAs         */
```

### Shadows (layered)

```css
--ts-shadow-sm        /* button rest, source pill            */
--ts-shadow-rest      /* card rest, glass-* surfaces         */
--ts-shadow-hover     /* card hover, modal                   */
--ts-shadow-sticky    /* (driven by scroll, see globals.css) */
```

Always use the layered tokens — never a single flat `0 4px 12px rgba(...)`. The system reads as floating because each shadow has a near-surface contact + a wider spread.

### Blur

```css
--ts-blur          20px   /* default glass                  */
--ts-blur-strong   28px   /* sticky header                  */
```

### Intent hue (CSS @property)

```css
--ts-intent-hue    220   /* default = indigo                */
```

A registered `<number>` custom property that drives the body gradient and the depth-radial overlay. Set on `<html>` from `page.tsx` based on the user's query intent — see [Intent-hue system](#intent-hue-system) below.

---

## Rhythm scale

Spacing follows a **4 / 8 / 12 / 16 / 24 / 32 / 48** ladder. Tailwind units map directly: `1=4px`, `2=8px`, `3=12px`, `4=16px`, `6=24px`, `8=32px`, `12=48px`.

| Use | Value |
| --- | --- |
| Inline gaps inside a pill / chip | 4 / 6 |
| Inter-element gap inside a card section | 8 / 12 |
| Card internal padding | 24 (top/sides) + 20 (bottom) |
| Section padding | 24 |
| Section vertical separation | 32 / 48 |
| Page top padding (hero) | 64 / 96 / 112 (sm/lg) |

Avoid 5/7/9/10/11/13/14/15. They exist in Tailwind but breaking the 4-step ladder is how the rhythm gets noisy.

---

## Glass surfaces

Three tiers, in order of opacity:

```html
<div class="glass">         <!-- default body card / panel -->
<div class="glass-strong">  <!-- sheets, dropdowns, modals -->
<header class="glass-sticky"><!-- top sticky bar          -->
```

Each tier sets its own `backdrop-filter`, border, and rest shadow. Don't combine `glass` with `bg-white/...` — they fight. New surfaces pick one.

A `@supports not (backdrop-filter: blur(1px))` fallback collapses all three to opaque `rgba(255,255,255,0.96)` so older Firefox / print engines still render solidly.

---

## Pills, buttons, chips

Three vocabularies, distinct shapes:

### `.pill` — metadata pill (rounded-full, 5px 12px)

For non-interactive metadata: license, language, popularity, maintenance state. Indigo-soft tint; per-source variants in `.pill-popularity`, `.pill-language`, `.pill-license`, `.pill-maint-*`.

### `.btn` family — affordances (h-36, rounded-sm)

```html
<button class="btn btn-primary"> <!-- gradient fill, indigo-violet  -->
<button class="btn btn-ghost">   <!-- transparent, soft border       -->
<button class="btn">             <!-- default white, indigo-strong   -->
```

Hover affordances are gated by `@media (hover: hover)` — touch devices don't inherit the lift, which would otherwise stick after a tap. Never remove that gate.

### `.filter-pill` — toggleable (data-active="true|false")

Used in `SourceFilter` and the toolbar's source chip row. The active state is the gradient fill; inactive is glass-soft. Drive via `data-active` attribute, not a CSS modifier class — framer-motion animates the background color when toggled.

### `.topic-chip` — small interactive tag (rounded-full)

For repository topics in `UnifiedProjectCard`. The interactive variant (`.topic-chip-interactive`) is a `<button>` that triggers a re-search.

---

## Typography scale

| Use | px | Tailwind / class |
| --- | --- | --- |
| Hero caption (mono) | 11 | `.ts-hero-caption` |
| Hero h1 | 44 / 52 / 64 / 72 | `.ts-hero-headline` |
| Hero subtitle | 15 / 16 | `text-[15px] sm:text-[16px]` |
| Stat strip value | 18 | `.ts-stat-value` |
| Stat strip label (mono) | 10 | `.ts-stat-label` |
| Card title | 19 | `.ts-title` |
| Card description | 14 | `.ts-desc` |
| Card metric value | 15 | `.ts-metric-value` |
| Body | 13 | `text-[13px]` / `btn` font-size |
| UI chrome | 12.5 | `text-[12.5px]` |
| Secondary chrome | 12 | `text-[12px]` |
| Caption / micro-label | 11 / 11.5 | `text-[11px]` / `text-[11.5px]` |
| Mono micro-label | 10 / 10.5 / 11 | `font-mono uppercase tracking-[0.12–0.16em]` |

### Sans vs. mono — when to reach for which

ThreadSeeker has two type registers; pick the right one or the page
loses its dev-tool-grade aesthetic.

- **Sans (`Inter`)** — content. Project titles, descriptions, taglines,
  button labels, recent search history. Anything the user is reading
  for meaning rather than for system context.
- **Mono (`ui-monospace, SF Mono, Menlo`)** — system. Section headers
  (`// TRENDING`), stat strip labels, sticky-header readouts (`45 results
  · 142ms`), source badges (`[GITHUB]`), popularity badges (`HOT`),
  metric grid labels (`STARS`, `FORKS`), version chips (`v1.4.2`),
  toolbar Sources / Sort labels, footer metadata. Anything the user
  is reading as a system / technical signal.

Numbers use `tabular-nums` whenever they participate in a column
alignment (counts, durations, popularity) or change frequently (live
readouts). Numbers in mono micro-text inherit it from the mono font;
numbers inside sans content explicitly opt in.

Letter-spacing convention:

- Headlines (display weight) → `tracking-tight` (-0.025em) or `letter-spacing: -0.03em` for the hero
- Card title / subtitle → `letter-spacing: -0.01em` to `-0.015em`
- Uppercase mono micro-labels → `tracking-[0.10em]` to `tracking-[0.16em]`
- Uppercase sans micro-labels (rare — mono is preferred) → `tracking-[0.12em]` to `tracking-[0.14em]`
- Body / chrome → default

### Section header vocabulary

Every "this is the start of a section" header on the page renders via
`.ts-section-header` so they share one typographic anchor:

```html
<h2 class="ts-section-header">// Trending <strong>this week</strong></h2>
```

The visible `//` is part of the printed text (not a pseudo-element)
so screen readers receive the full label. The `<strong>` carries the
indigo accent — used for the actual content noun (count, label,
section subject).

---

## Spring presets (`src/lib/motion.ts`)

```ts
springSoft   = { stiffness: 190, damping: 24, mass: 0.9 }   // Apple-adjacent, default
springSnappy = { stiffness: 360, damping: 28 }              // chrome reacting to user
springBouncy = { stiffness: 320, damping: 18 }              // playful one-shots
```

When to reach for which:

| Use | Spring |
| --- | --- |
| Card enter / mode crossfade / sheet open | `springSoft` |
| Filter pill background flip | `springSnappy` |
| Bookmark heart tap | `springBouncy` |
| Layout-shift on result update | `springSoft` |

A motion that feels too floaty wants `springSnappy`; one that feels too clinical wants `springSoft`. `springBouncy` is reserved for delight one-shots — using it on a frequent UI flip reads as nervous.

### Variants

Pre-built variants live alongside the springs:

- `cardVariants` — hidden / visible / exit (scale 0.94) / hover (y -4) / tap (scale 0.98)
- `bookmarkVariants` — rest / tapped (scale 1 → 1.4 → 1)
- `sheetVariants` — hidden / visible / exit
- `modeVariants` — heroEnter / heroShow / heroExit / resultsEnter / resultsShow / resultsExit
- `gridContainer` — staggered child reveal

Always extend an existing variant rather than authoring an inline `animate={{}}` for transitions used in more than one place — the variants are the rhythm.

---

## Reduced-motion contract

Two layers, agreeing:

1. **CSS** — `globals.css` has a `@media (prefers-reduced-motion: reduce)` block that kills hand-rolled `@keyframes` (hero shimmer, skeleton shimmer) and long transitions on cards / pills / buttons.
2. **Framer-motion** — `<MotionProvider>` wraps the app with `<MotionConfig reducedMotion="user">`. Every framer-driven motion auto-collapses when the OS preference is set; layout/exit animations still play because they carry meaning.

When you author a new framer animation, you don't need to branch on `useReducedMotion` for decorative effects — the provider handles it. Branch only when:

- The default reduced-motion fallback (instant snap) leaves no signal for an action the user just took (see `UnifiedProjectCard`'s bookmark pulse — branches to a static "hold-then-fade" so the affordance survives reduced-motion).
- Layout animations need a different fallback shape.

Hand-rolled CSS animations? Add them to the reduced-motion block in `globals.css`. The two layers must agree.

---

## Intent-hue system

`page.tsx` parses the search query into an intent and sets `--ts-intent-hue` on the document element:

| Intent | Hue | Feel |
| --- | --- | --- |
| `project_search` | 220 | indigo (default) |
| `how_to` | 150 | teal / sage |
| `recommendation` | 200 | sky |
| `comparison` | 240 | blue-violet |
| `troubleshooting` | 350 | rose (warm-but-red, not pink) |
| `model_search` | 40 | warm amber |
| `general` | 220 | indigo (fallback) |

The hue ramp is 800ms via `cubic-bezier(0.32, 0.72, 0, 1)` (the app's standard ease-out). It's set only on **search submit**, not per-keystroke, so back-to-back queries don't queue a chain — CSS interrupts the in-flight transition cleanly.

When extending the intent set: stay inside the indigo–violet–rose–amber–teal palette. Avoid magenta (260–300) and yellow-green (60–110) — they fight the surface gradient.

---

## Accessibility patterns

### Focus-visible

`globals.css` ships a global `:focus-visible` rule — 2px indigo outline + 2px offset + 6px radius. Never override it without a clear reason. Keyboard-only mode strips the outline via `:focus:not(:focus-visible)`.

The hero SearchBar adds an outer 24px blurred indigo halo on top of the inner ring as a delight layer; the inner ring stays for accessibility floor.

### Aria-hidden on decorative icons

If a lucide icon sits next to text that already names the affordance, the icon is `aria-hidden`. Iter-13 swept this across the codebase. New icons follow the rule: any decorative or text-redundant icon gets `aria-hidden`, full stop.

### Aria-label on icon-only controls

Bookmark heart, source-filter chips, close buttons, etc. — every icon-only control carries an `aria-label`. The label names the action, not the glyph: "Remove bookmark", not "Heart".

### Tap targets (44×44 minimum)

Apple HIG / WCAG 2.5.5 floor. Patterns we use:

- **Visible-size override**: outer `<button>` keeps the small visual font, claws out a 44×44 hit area via negative margin + generous padding, and an inner `<span>` carries the visible style. See `SourceFilter`'s All/None toggle.
- **Conditional sizing**: `w-11 h-11 sm:w-9 sm:h-9` — touch widths get the 44px target, desktop reads at 36px. See `ShortcutHelpButton`, `SavedSection`'s remove button, `SearchBar`'s clear-X.

Below the 44×44 floor only when:
- The control is one of multiple in a row (action row buttons at h-36 — adjacent siblings provide enough generous-tap area).
- A label directly above/below acts as a pointer alias.

### Live regions

The page renders a visually-hidden `role="status" aria-live="polite" aria-atomic="true"` region that announces search progress + result counts to screen readers. Match-feature parity with the visible toolbar count.

### Skip-to-main-content

`<a href="#main-content" class="sr-only focus:not-sr-only ...">` — keyboard-only first-tab affordance.

---

## Card structure (`.ts-card`)

The `UnifiedProjectCard` shape is the system's most-repeated pattern. Stable layout:

```
[ source badge ] ......................... [ bookmark heart ]
[ avatar ]  [ name + version chip / by owner ]
            description (2-line clamp, italic placeholder if absent)
            updated relative-time
            [ topic chip ] [ topic chip ] [ topic chip ]
            [ popularity ][ language ][ license ][ maintenance ]
            [ Open / View paper / etc → ] [ ⎘ Copy ]
```

- `min-height: 340px` (or 260px for `ts-card-sparse` — community threads with no description / no topics)
- `auto-rows-fr` on the grid stretches every card to the tallest sibling, so rows always align even with mixed content
- Hover lift gated on `(hover: hover)`; transform: `translateY(-4px)` + shadow → hover

The 24px / 24px / 20px padding (top / sides / bottom) is intentional asymmetry — the action row reads slightly closer to the bottom edge than the header does to the top.

---

## Source vocabulary

Each of the 28 sources has:

- A category (Repos, Packages, Threads, Papers, Apps, Models)
- A lucide icon
- A name + tagline (≤60 chars, verbless)
- A pill color (`.ts-source-{key}` in `globals.css`)
- An open-action label (`openLabelForSource()` in `card/helpers.ts`)
- A popularity glyph vocabulary (`popularityForProject()` in `card/helpers.ts`)

Adding a new source means touching four files: `lib/sources/types.ts` (SourceType), `lib/sources/registry.ts` (config), `globals.css` (`.ts-source-{key}`), `card/helpers.ts` (vocabulary). Don't skip any — the system relies on each lookup hitting.

---

## Responsive breakpoints

Tailwind screens (declared in `tailwind.config.ts`):

| Name | px | Inflection |
| --- | --- | --- |
| (default) | 0 | iPhone SE / 320px floor |
| `xs` | 400 | iPhone 12 mini / standard phone |
| `sm` | 640 | small tablet portrait |
| `md` | 768 | iPad portrait |
| `lg` | 1024 | iPad landscape / small laptop |
| `xl` | 1280 | desktop |
| `2xl` | 1536 | large desktop |

Card grid: 1 col → 2 col at `sm` → 3 col at `lg`. Outer page padding: `px-4 sm:px-6`. Hero h1: `text-[40px] xs:text-[44px] sm:text-6xl lg:text-7xl`.

When adding a responsive class: prefer `sm:` / `lg:` for layout shifts, `xs:` only when tightening at the iPhone-SE band specifically. Don't introduce a new breakpoint to handle a single component — restructure first.

---

## Print stylesheet

`@media print` in `globals.css` strips the gradient/glass/blur down to white-paper. Cards become single-column with hard `break-inside: avoid`; pills lose tinted backgrounds; the gradient hero accent collapses to solid indigo.

When adding a new surface, ask: does this need to print? If yes, ensure the print block in `globals.css` either picks it up via existing selectors (`.glass`, `.pill`, `.ts-card`) or add an explicit override. Don't author a print-irrelevant motion / animation that the print engine has to skip.

---

## What NOT to do

- Don't inline `box-shadow: 0 4px 12px rgba(0,0,0,0.1)` — use a `--ts-shadow-*` token.
- Don't add a hover lift outside `@media (hover: hover)` — sticks on touch.
- Don't override `:focus-visible` without preserving an indigo ring of equal contrast.
- Don't introduce magenta / pink / yellow-green — palette stays indigo–violet–rose–amber–teal.
- Don't bypass `MotionProvider` with raw CSS animations that ignore reduced-motion.
- Don't add a Tailwind utility color (`bg-blue-500`) for a new ThreadSeeker surface — use a `--ts-*` token.
- Don't ship a tap target below 44×44 unless the surrounding context provides equivalent affordance.
- Don't add a 5px or 7px gap — use the 4/8/12/16/24/32/48 ladder.

---

## Adding a new component

1. Pick the right surface tier (`glass`, `glass-strong`, or none).
2. Pull spacing from the rhythm scale.
3. Use existing pill / button / chip vocabulary if the affordance fits.
4. Wrap motion in an existing variant from `motion.ts` — extend rather than author one-off.
5. Add `aria-label` for icon-only controls; `aria-hidden` for decorative icons.
6. Verify tap targets at touch widths (44×44 floor).
7. Walk the layout at 320 / 768 / 1024 / 1440 — no horizontal scroll, no awkward wrap.
8. If the component prints meaningfully, verify the `@media print` block covers it.
