# Overnight Polish Log — 2026-04-24 → 2026-04-25

User went to sleep asking for continuous overnight polish. Agents should iterate on ThreadSeeker UI — cleaner, more professional, smoother, Apple-adjacent glass aesthetic.

**Do NOT push to origin. Local commits only.**

## Ground rules each iteration

- Make focused, reviewable commits — prefix `Polish:`.
- Before starting: read this log, pick a focus area not yet done (or revisit one with a specific new angle).
- After finishing: append a new entry noting the focus, commits, and insights for the next agent.
- `npm run build && npm run test` must stay green.
- Typography / spacing / shadow tokens are already unified — extend them, don't fork.

## Design north star

Apple-adjacent calm. Liquid Glass on lavender/indigo/sky gradient. Indigo-violet as the single accent. Motion that's purposeful and soft. Generous whitespace. One visual rhythm: 4/8/12/16/24/32/48.

## Iteration history

### Iteration 0 — baseline (before overnight loop)

Already shipped: palette fix, card redesign, search-as-you-type, dark-class purge, toaster, motion refinement, typography scale, hero/results modes with transition, sticky glass header, SearchBar size variants, refined toolbar, skeleton shimmer, empty state, focus-visible sweep.

### Iteration 1 — 2026-04-24 — critical audit + scrollbar/motion + hero/landing rhythm

**Commits:**
- 653f9eb — Polish: thin light-theme scrollbar + prefers-reduced-motion guard
- 40ed90c — Polish: landing rhythm + topic-chip hover + tokenized bookmark
- f6520a3 — Polish: hero vertical rhythm + wider results + sticky/modal refinement

**Wins:**
- Scrollbar is now 8px indigo-18% with padding-box capsule styling — recedes into gradient like Safari, no longer reads dark-theme.
- Hand-rolled CSS animations (shimmer, pulseRing, heroShimmer, intent-hue body transition, card/pill transitions) now honor `prefers-reduced-motion`. Framer-motion already had its own provider coverage.
- `section-container` snapped to 24px padding + 16px margin (was 20/24 + 18, off-scale). `SavedSection` mt-6 → mt-8 so Saved + Trending breathe at the same interval.
- Topic chips gain hover + active-scale interaction; previously dead. Bookmark heart tokenized to `--ts-text-faint` (was hardcoded `#cbd5e1`) and picks up a rose-tinted hover background for better affordance.
- Hero vertical rhythm reworked: headline drops to 44px on mobile (was 5xl = 48, slightly overflowing narrow phones), pt-20/28 → pt-16/24/28, gaps onto 12/8/12 Apple-spacious intervals, Try pill row matches Recent pills (py-1.5 + no margin-shift on arrow reveal, so hovering no longer jiggers width).
- Max-width normalized to 1280px across results container, sticky header, and footer (was 6xl = 1152 / 5xl = 1024). Removes the big 2xl viewport gutters while leaving the hero at the narrower 4xl editorial width. Card grid gets `lg:gap-6` for bigger-screen breathing.
- Sticky header responsive: search can collapse fully on narrow phones (min-w-0, max-w only >=sm); Clear gets a proper tap target.
- ShortcutHelpModal upgraded from dev-drawer to real dialog: `role="dialog"`, `aria-modal`, labelled title with a 12px tagline, divider, kbd keys with min-width + fixed height so single/multi-char keys align visually.
- TrendingSection row radius `rounded-md` → `rounded-xl` to match system's 12/18px radius vocabulary; stars use tabular-nums.

**Still rough (hand off to next iteration):**
- SearchBar's `onFocus` pulse class is added imperatively via `classList.add`/`setTimeout`; could migrate to motion-style state so it honors reduced-motion through the framer provider rather than the new CSS `@media` guard.
- ResultsToolbar export buttons (MD/JSON) show "Copied" via a generic `<Check />` with no success tint on the button itself — subtle but not delightful. Next pass: briefly flash the button background emerald-50.
- Topic chips aren't clickable yet (they're static `<span>`s). If we had a "narrow by topic" behavior, turning them into filter triggers would add real utility; deferred because it requires wiring into the query state.
- Card min-height 340px can feel tall when description + topics are both empty; dynamic min-height based on content presence would trim whitespace without breaking grid alignment.
- DirectJumps section is still rectangular-heavy; could collapse to a single inline "Jump to X on: [npm] [PyPI]…" row on narrow viewports instead of the current wrap-grid.
- Footer content left-aligns on wrap to mobile but the two clusters break awkwardly at medium widths — would benefit from an explicit breakpoint stack.
- Source filter sheet (`SourceFilter.tsx`) not audited this iteration; likely has similar rhythm issues and the 16px padding may be tight for 28 source pills.
- Empty state's action-button row is generous on desktop but wraps to 5 rows on mobile — worth considering a stacked "primary action" + collapsed "more options" on phone widths.

### Iteration 2 — 2026-04-24 — hand-off list + motion/source/responsive polish

**Commits:**
- e77ceca — Polish: SearchBar focus pulse → framer-motion radial glow
- bd45846 — Polish: toolbar export success flash (emerald tint)
- d1895ee — Polish: SourceFilter grouped by category + Reset ghost
- c01e5dd — Polish: card sparse state — 260px min-height + hidden empty desc
- ae56d07 — Polish: footer md-stack + DirectJumps inline mobile row
- 8c07703 — Polish: empty state — mobile primary CTA + config-driven rebuild
- c5636c8 — Polish: topic chips become refine-search buttons
- a4ebbd9 — Polish: ShortcutHelpModal — dl semantics + "or" separators

**Wins:**
- **SearchBar pulse** migrated off imperative `classList.add('pulse')`/`setTimeout` onto a remounted `<motion.span>` overlay keyed by focus count. Framer's reduced-motion provider now owns the guard; dropped the hand-rolled `@keyframes pulseRing` + CSS media-query entry. Pulse is a soft radial indigo gradient + 2px ring that fades and scales outward over ~0.7s — reads confident rather than insistent.
- **ResultsToolbar export buttons** (MD / JSON / Share) now briefly flash emerald-50 with a 35%-emerald border for ~0.9s on successful copy (was just an icon swap). `motion.button` drives the `backgroundColor` + `borderColor` animation so reduced-motion is inherited. Off-state border matches `--ts-border-soft` so the button doesn't lose its edge between flashes.
- **SourceFilter sheet** audited and rewritten. 28 source pills are now grouped into five human categories (Repos / Packages / AI & ML / Community / Scholarly) — the sheet reads like a table of contents instead of a wall of chips. Padding 16 → 24px to match section rhythm, max-width 520 → 640 for the denser Packages row, and a subtle "Reset" ghost button top-right that fades in whenever selection diverges from all-sources.
- **Card sparse state** — cards with neither description nor topics render in a ~260px shell instead of reserving 340px. Description `<p>` no longer renders at all when empty (dropping its reserved 2-line min-height). Row alignment stays correct because the grid is `auto-rows-fr`, so sibling cards still align to the tallest row member — rows of all-sparse cards just no longer waste vertical air.
- **Footer** — `flex-wrap` replaced with `flex-col → md:flex-row` stack, so the brand blurb and GitHub/shortcuts cluster no longer break awkwardly at medium widths. `md:flex-shrink-0` keeps the right cluster from eating the blurb when there's room.
- **DirectJumps** narrow viewport — phones now get a single inline "Jump to `<pkg>` · [npm] [PyPI]…" strip with smaller pills and no `ArrowUpRight` chrome. sm+ viewports keep the existing sectioned card. Saves ~50px of vertical space on phones.
- **Empty state** mobile — rewritten as a config-driven Action[] map. Mobile now shows a single full-width gradient primary CTA (highest-priority suggestion: drop filters > broaden sources > drop term > search GitHub) plus a compact secondary pill row below. Desktop (sm+) keeps the wrap row. Eliminates the "5 stacked rows on phone" regression without losing any affordances.
- **Topic chips** are now live refine-search buttons (wired via new `onTopicClick` prop on `UnifiedProjectCard`). Clicking a topic fires `handleSearch(topic)`. Existing hover + active-scale styling from iteration 1 applies to both variants; added a button-specific font/line-height reset so the UA small-sans default doesn't bleed in.
- **ShortcutHelpModal** — swapped sibling-flex rows for a proper `<dl>` with a `grid-cols-[1fr_auto]` so every command label and kbd cluster line up to the same baseline regardless of label length. Multi-key bindings (j/↓, k/↑) now show a subtle "or" between kbds instead of butting them together; kbd min-width 24 → 26px and height 22 → 24px so single-glyph keys match the "Esc" row symmetrically; row gap 3 → 2.5 for tighter rhythm.

**Still rough (hand off to iteration 3):**
- The `ShortcutHelpModal` is still a dev-style fixed overlay — if ThreadSeeker ever adds a persistent "press ? for help" hover affordance, that entry point would be more discoverable than the silent keyboard shortcut.
- SourceFilter category list is hardcoded; if the adapter layer grows (e.g. a video/media group, or a datasets group), the CATEGORIES array in `SourceFilter.tsx` has to be manually updated. Worth moving the category tag onto the `SOURCE_CONFIGS` registry so new sources only declare their category once.
- `TrendingSection` was not audited this iteration — rows got the radius fix in iteration 1 but type weight / spacing inside the row deserve a look (especially the star counts vs project name hierarchy).
- `SavedSection` same story — visible on landing but hasn't had a focused polish pass since iteration 0.
- Card header micro-polish (source badge + bookmark row) was parked. The row reads a bit bare after moving relative-age down to its own caption. Could add a small subline with `★ 12.3k · MIT` or similar so the top third of the card isn't dead space on compact cards.
- `CardPills` component not yet touched — four-pill language/license/maintenance row could use the same "sparse-aware" trim as the card itself (don't render maintenance if no updatedAt).
- Empty state primary CTA uses a bespoke gradient class instead of extending the `.btn-primary` / `.sb-submit` tokens — worth unifying on a `--ts-cta-gradient` or elevating the gradient into the primary button utility so we don't have three definitions of the same indigo→violet sweep.
- DirectJumps mobile strip puts the pill icons as plain spans — some icons (📦, 🐳) read small at 11px. A subtle monochrome fallback icon could be cleaner than the registry's emoji.

### Iteration 3 — 2026-04-24 — TrendingSection / SavedSection / sparse pills / discoverability

**Commits:**
- e7eb59a — Polish: TrendingSection — tabbed lang nav + denser rows with owner avatars
- f8331d2 — Polish: SavedSection — library-shelf grid + clear-all affordance
- 15bbe62 — Polish: CardPills sparse-aware — skip empty pills + drop 'Unknown' license
- 1bb16ae — Polish: unify empty-state CTA on .btn-primary + bump DirectJumps mobile icons
- ba0336c — Polish: move source categories onto registry (single-location declaration)
- 4eb733e — Polish: floating ShortcutHelpButton for keyboard-nav discoverability
- 5d65166 — Polish: avatar fallback initials + long-form relative time

**Wins:**
- **TrendingSection** converted from a pill-chip language row + stacked name/description cells to a proper segmented tab interface + single-line dense rows. Language tabs drop their chip background and gain an animated indigo underline bar under the active label (tabs now read as nav, not a button cluster) — plus `role=tablist` / `role=tab` / `aria-selected` for correct semantics. Repo rows collapse from 58px to 42px: owner GitHub avatar (20px, derived from the fullname segment, no extra API call) + repo name + inline description + right-aligned amber-tinted star + arrow. Skeleton height updated to match so there's no jump on data-in.
- **SavedSection** rewritten from a centered flex-wrap of rose-tinted pill chips (capped at 6) into a library-shelf grid (2/3/4 columns responsive, up to 8 tiles). Each tile is a dense glass card with a rounded icon badge, project name + owner subline stacked, and a per-tile remove button that fades in on hover. Header gained a right-aligned ghost "Clear all" button — hidden until noticed but always available. `+N more saved` subline when items exceed the shelf cap.
- **CardPills sparse-aware** — the four-pill row previously always rendered all four with "—" placeholders for missing fields. Now each pill only renders with real data: popularity/language drop if null, license drops if null or bucketed "Unknown", maintenance drops if state is "unknown" (no timestamp). When every pill would be empty the whole row collapses and the auto-mt flex pushes the action row up naturally. Test suite grew +2 tests (38 passing) — dropped the "renders fallback dashes" assertion and added collapsed-row / single-pill / license-Unknown-drop checks.
- **Empty-state CTA unification** — the mobile primary CTA was a bespoke `bg-gradient-to-br from-indigo-500 to-violet-500` class with its own hover colors and shadow. Now extends the canonical `.btn btn-primary` utility (which already wires `--ts-accent-gradient` + tokenized shadow), overriding only `w-full rounded-full h-11 text-[13px]` for phone-CTA shape. Single definition of the primary button look now lives in tokens.
- **DirectJumps mobile icons** bumped from 11px to 14px with `leading-none`. Emoji (📦 🐍 🐳 💎 🐘) read as icons on phone instead of specks.
- **Source categories on the registry** — the hardcoded `CATEGORIES` array in `SourceFilter.tsx` (which had to be kept in sync with `SOURCE_CONFIGS` every time a source was added) is gone. Each entry in `SOURCE_CONFIGS` now declares its own `category: SourceCategory` field; `groupSourcesByCategory()` in registry.ts builds the grouped view dynamically, sorted by `CATEGORY_META.order`. SourceFilter memoizes the grouping. Adding a new source is now a single-location change.
- **Floating ShortcutHelpButton** — the `?` keyboard shortcut was only advertised in a small footer line, invisible to mouse-only users and easy to miss. Added a 36px glass ghost help button docked bottom-right (z-30) that opens the same modal. Wired via a shared `threadseeker:open-shortcut-help` CustomEvent (exported as `SHORTCUT_HELP_EVENT`) so any future call site can open the modal without prop-threading. Hover shifts slate → indigo + adds shadow lift; focus-visible ring keeps it keyboard-navigable.
- **Avatar fallback initials** — plain colored-circle fallback was identity-less when `project.author.avatar` was absent. Renders the first letter of the project name (uppercase) in white on top of the accent gradient, matching the GitHub/Gravatar default-avatar convention. New `.ts-avatar-fallback` class inherits avatar sizing + loses the indigo border in favor of the gradient fill.
- **`formatRelativeTime` normalized to long-form units** — previously days+ said "3 days ago" but minutes/hours used abbreviated "3m ago" / "2h ago". Now every bucket uses spelled-out units ("3 minutes ago", "2 hours ago") so voice doesn't flip halfway through the scale.

**Still rough (hand off to iteration 4):**
- **Card header micro-polish (target 3) skipped this iteration.** Tried reasoning through adding a `★ 12.3k · MIT` subline next to the SourceBadge — but since CardPills now renders popularity/language/license prominently below, duplicating them in the header would add visual weight without real gain. Header reads cleanly as SourceBadge + bookmark. Future iterations: consider whether the header could host a _different_ piece of information entirely (e.g. source-specific secondary metadata: `v2.4.1` for npm/pypi, commit-count for arXiv, etc.).
- **TrendingSection avatar URL**: derives from GitHub from the fullname split, so trending works only for github sources — which is fine today since the section is github-specific, but if the widget ever expands to gitlab/codeberg trending, the avatar prefix needs a source-aware branch. Currently hardcoded to `avatars.githubusercontent.com`.
- **SavedSection overflow UX**: `+N more saved` is a passive subline. If heavy bookmarkers accumulate 50+, they can't reach them from the landing page — would need a "view all" expansion or a separate /saved route. Deferred because solving it properly means a real route + sort controls, and the shelf is already clearly labelled "top 8".
- **ShortcutHelpButton**: always-on, even when there are no results to navigate. Could be conditionally hidden in `mode: "hero"` so the landing reads even cleaner, but that hides the affordance for exactly the users who'd benefit most (first-timers). Left visible.
- **CardPills `--` removal** also affects an edge case: a card that _only_ has a popularity pill now renders a single centered pill, which can look orphaned in the row. The `flex: 1 1 auto` on `.ts-pills .pill` still stretches it to the full row width, but the visual rhythm of 4 equal pills is gone on sparse sources. Consider a minimum of 2 pills (always show language-"—" if one other pill is rendering) — but that re-introduces the "—" weakness we just removed. Trade-off, leaving as-is.
- **Card avatar fallback** uses the accent gradient for every initial, so a row of 9 cards all without avatars will show 9 identical-looking gradient circles. Could hash the project id to a hue variation for more visual identity, but that risks clashing with the indigo-accent-only design north star. Punt.
- **ResultsToolbar width on wrap** was not inspected this iteration — hand this to iteration 4.
- **Scroll snap / smooth-scroll on results grid** not inspected; worth considering whether `scroll-behavior: smooth` on the grid container would cascade into the `j`/`k` keyboard nav scroll.
- **`formatRelativeTime`** now uses long-form units but produces very long strings for some cards ("11 months ago" etc.). On narrow cards the `.ts-caption` line can wrap or overflow. Iter 4: add `overflow: hidden; text-overflow: ellipsis` to `.ts-caption` or consider cutting back to short units ONLY when constrained.

### Iteration 4 — 2026-04-24 — interaction-layer polish + drain iter 3 hand-off

**Commits:**
- 317ca5a — Polish: card header version chip for package registries
- ba40ad0 — Polish: TrendingSection avatar — graceful 404 fallback to initial
- 0aabad3 — Polish: ShortcutHelpButton hides on hero, fades in on results
- eab647d — Polish: ResultsToolbar wrap groups + caption ellipsis
- 1b23659 — Polish: scroll-margin-top on cards for j/k keyboard nav
- 823b37c — Polish: avatar fallback hue variation across indigo→sky family
- cf6af08 — Polish: CardPills single-pill row left-aligns instead of stretching
- 872ec5c — Polish: hero "Recent" search chips — staggered fade-in

**Wins:**
- **Card header version chip** — `UnifiedProject.version` (already populated by npm/pypi/crates/rubygems/packagist/nuget/maven/jsr/conda adapters; homebrew + dockerhub upstreams don't expose it but the chip auto-skips when absent) now renders as a small monospace pill (`v1.2.3`) next to the project name. Indigo-soft, tabular-nums, max-width 110px so long pre-release strings ellipsize. Title row split into a `.ts-title-main-row` flex container so the name truncates while the version chip stays pinned. Repos + huggingface skipped — their version semantics are too varied (tags/branches/shas) to project as a single label.
- **TrendingSection avatar fallback** — `avatars.githubusercontent.com/{owner}` 404s on deleted-account ghost owners. Added an `onError` that hides the broken `<img>` and reveals a sibling glyph placeholder (initial-letter on indigo-soft). Code comment now explicitly documents the github-only assumption + where to branch when trending grows beyond GitHub.
- **ShortcutHelpButton** — was always-on, even on the hero where there are no cards to navigate. Now driven by a `visible` prop that the page passes from `mode === "results"`. Wrapped in `AnimatePresence` so the button fades up + scales 0.92→1 when entering results mode, fades back down + scales out when returning to hero. Keyboard `?` itself stays globally registered so power users on the landing page still get the shortcut.
- **ResultsToolbar wrap groups** — toolbar children were all in a single `flex-wrap` row with `ml-auto` between Sources and the rest, which broke awkwardly mid-button at narrow widths. Split into two semantic flex-wrap groups: `[Sources + Sort]` left, `[MD/JSON/Share]` right. Each group has `min-w-0` + `truncate` on inner labels so a narrow viewport breaks between groups (clean) instead of mid-button or stacking every control on its own line. Vertical gap (`gap-y-2`) added so wrapped lines breathe. Removed the now-redundant Sort block + the `sm:block` divider (sort moved to the left group).
- **`.ts-caption` ellipsis** — long-form relative-time strings ("11 months ago") wrapped on narrow cards, pushing the card geometry around. Added `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%` so the caption truncates instead.
- **scroll-margin-top for keyboard nav** — `j`/`k` calls `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`, but the sticky header (`py-3` + 44px compact search = ~68px) was occluding the focused card. Added `scroll-margin-top: 80px` on `.ts-card` AND `[data-result-card]` (the wrapper that owns the focus ring) so both selectors hit. Smooth scroll behavior was already in place; this is the missing headroom piece.
- **Avatar fallback hue variation** — a row of avatarless cards rendered nine identical accent-gradient circles. Added `avatarFallbackHue(id)` in helpers.ts: deterministic FNV-1a-style hash → one of 8 indigo/violet/sky-adjacent hues (210, 220, 230, 240, 250, 260, 270, 280). Same id → same hue (covered by 4 new tests). Wired through `--ts-fallback-hue` CSS custom property so the class layer stays declarative; defaults to 240 (mid-indigo) when the variable is absent. Stays inside the indigo north star — every choice still reads as "brand-coloured", just slightly cooler or warmer.
- **CardPills single-pill row** — flagged in iter 3. `.ts-pills .pill { flex: 1 1 auto }` stretches a lone pill (e.g. only-popularity card) to row width, looking visually unbalanced vs. dense rows. Added `.ts-pills .pill:only-child { flex: 0 0 auto; justify-content: flex-start }` so a lone pill reads as a small left-aligned metadata tag rather than a stretched bar. Pure CSS — no JSX changes.
- **Recent searches stagger** — the hero's "Recent" cluster popped in instantly when the first query landed. Now: container fades up + 4px slide over 320ms, chips fan in with a 40ms stagger so the row materializes left→right. Inherits framer-motion's prefers-reduced-motion guard.

**Test count:** 38 → 42 (helpers.test.ts adds 4 tests for `avatarFallbackHue`).

**Still rough (hand off to iteration 5):**
- **Version chip on dockerhub/homebrew** is wired but the underlying adapters never set `project.version`, so the chip never shows for those sources today. If we want parity, the dockerhub adapter could pull the latest tag (separate API call, costly) and homebrew could surface `current_version` from the formula API. Currently a no-op for those two — chip is harmless but doesn't add value. Decision: defer until users ask for it.
- **TrendingSection** still hardcodes `api.github.com`. If the section ever expands (gitlab trending, codeberg trending), the avatar source-branch hint is now in code, but the API call itself + the language tabs would need a redesign — left for a real "expand trending" iteration.
- **Card header version chip wrap** — at very narrow card widths (~280px), the version chip + a long project name compete for space. The name truncates first (good), but if both are short the row looks bare. Could centre-align the row, but that fights the title's left-anchor — leaving as-is.
- **`focusedIdx` reset on filter change** — currently resets focus on every query/sort/source/selectedSources change (page.tsx:215-217). Good for correctness, but means a user who j-navs to row 5, opens the source filter dropdown, and changes nothing still loses their position when the dependency array fires. Worth gating on real filter changes vs. menu open/close, but isn't visible breakage.
- **ResultsToolbar truncation tooltips** — "Sources · GitHub" can truncate now that we added `min-w-0 + truncate`. We don't add a `title` attribute on the truncated label, so screen-reader users won't get the full text. Iter 5: add `title={...}` when active source label is set.
- **Hero hero-shimmer** is still hand-rolled CSS (`@keyframes heroShimmer`) — fine, but the body-transition + heroShimmer pair is the only remaining vanilla-CSS animation; could be consolidated under the framer-motion provider for a single reduced-motion source of truth.
- **CardSkeleton** wasn't audited this iteration. The shimmer card geometry should match the new sparse-card 260px min-height when the search hits a sparse-source-only filter — currently always 340px. Minor.
- **Empty-state mobile CTA wrap** — the mobile primary CTA is unified on `.btn-primary` (good) but the secondary pill row below can wrap to 2 lines on very narrow phones. Iter 5: consider reducing to 2 secondary pills max (drop the third) or stacking them.
- **DirectJumps icon size on phone** — bumped to 14px in iter 3. On wider phones (430px+) they read fine, but at 320px iPhone SE width the registry name + icon + arrow can squeeze. Audit pending.
- **`useReducedMotion` hook** exists (`hooks/useReducedMotion.ts`) but appears unused in the components touched this iteration. Might be a refactor target if a component needs to differentiate motion vs. reduced-motion behavior beyond what framer's `MotionConfig` provides.
- **Saved + Trending vertical rhythm on landing** — both sections sit at `mt-8` per iter 1, but the new `Recent` row uses `mt-12`. Three-section vertical pacing should probably be 8/8/8 or 12/8/8 — currently it's history-12, saved-8, trending-8 which feels slightly off-rhythm. Trivial polish, deferred.

### Iteration 5 — 2026-04-24 — drain iter-4 handoff + atmospheric depth layer

**Commits:**
- a27adb5 — Polish: gated focusedIdx reset + ResultsToolbar a11y titles
- 00d892b — Polish: landing section rhythm — unify Recent/Saved/Trending at mt-12
- 3962b9f — Polish: CardSkeleton sparse variant matches 260px sparse-card shell
- 3e375be — Polish: empty-state + DirectJumps tighten for iPhone-SE 320px width
- e5c374a — Polish: global MotionConfig provider — single reduced-motion source
- bd5673f — Polish: atmospheric mesh-gradient depth layer over flat linear bg
- 7e31343 — Polish: card title row pins version chip flush right

**Wins:**
- **`focusedIdx` gated reset** (handoff item 2) — was resetting on every `[query, sortMode, activeSourceFilter, selectedSources]` change, throwing away keyboard position even when the focused card was still on screen. Now identity-based: tracks the focused project's id via `focusedIdRef`, looks it up in the live grid each effect-firing. If the project still exists, focus follows it (potentially to a new index when sort reorders); if it's gone, focus resets. Required adding `data-result-id` on the card wrapper. Net: opening the source filter dropdown without changing the selection no longer drops focus.
- **ResultsToolbar a11y titles** (handoff item 3) — Sources + Sort buttons now ship context-aware `title` + `aria-label` that reflect the current state, not generic captions. "Sources · GitHub (click to change)" / "Sort order. Currently sorted by Most stars." Screen readers + hover tooltips both pick this up; the previous generic "Filter by source" label was misleading once a filter was active.
- **Landing rhythm unified at mt-12** (handoff item 9) — Recent (mt-12), Saved (mt-8), Trending (mt-8) → all three now mt-12. Each represents a distinct content type (history / bookmarks / discovery) so each gets the larger 12-unit "new section" break instead of mixing 12/8/8.
- **CardSkeleton sparse variant** (handoff item 5) — added optional `sparse` prop on CardSkeleton that renders the 260px geometry (no description shimmer lines, two pills). Wired in page.tsx via `skeletonsShouldBeSparse` flag that fires when every selected source is in the SPARSE_SOURCES set (hackernews / reddit / lobsters / stackoverflow / devto). The grid no longer pops from 340px → 260px when narrow community-source-only searches return.
- **Empty-state mobile pill row + DirectJumps iPhone-SE** (handoff items 6 + 7) — empty-state secondaries are capped at 2 visible on `<sm` (rest hidden until sm+) and pill horizontal padding drops `px-3.5 → px-3` on mobile, so 320px iPhone SE no longer wraps the row to two lines. The gradient primary CTA above already covers the highest-priority recovery so power users don't lose paths. DirectJumps mobile inline row: prefix cluster ("Jump to <pkg>") wraps onto its own row at narrow widths via `basis-full → basis-auto sm+`, freeing a full row for the registry pills below; pills shrunk to 11.5px / px-2 (was 12px / px-2.5); horizontal gap tightened 2 → 1.5; pkg name truncates if it overflows the prefix row.
- **Global MotionConfig provider** (handoff item 4 — partial) — added a top-level `<MotionConfig reducedMotion="user">` wrapper in the root layout (via a small client-only `MotionProvider`). Now every framer-motion component in the tree automatically honors the OS prefers-reduced-motion: reduce setting without each call site needing its own `useReducedMotion` branch. Per-component `useReducedMotion` usages stay in place because they sometimes render *different content* under reduced motion, not just skip animation. The `heroShimmer` consolidation itself was deferred — text-clip background-position animation doesn't translate to framer cleanly and the existing `@media (prefers-reduced-motion: reduce)` guard already covers it correctly, so single-source-of-truth for the OS pref ends up being the media query itself + framer's matching MotionConfig honoring it.
- **Atmospheric mesh-gradient depth layer (visual-depth pick: A)** — replaced the flat 135deg lavender→indigo→sky linear gradient with a body + body::before pair: linear gradient stays for the base wash, the new pseudo-layer floats two soft radial spots (indigo top-left, violet bottom-right, both ≤22% color-stop opacity) anchored to the viewport via `position: fixed` + vw/vh sizing. Reads as ambient atmospheric light rather than competing shapes — if you can clearly see the spots, it's too strong. Inherits `--ts-intent-hue` so it shifts with the search-intent hue language already in place; 800ms transition matches body's. `body > * { position: relative; z-index: 1 }` keeps every existing layer above the depth layer; `pointer-events: none + z-index: 0` keeps the layer non-interactive. Picked over option B (FLIP — already firing via `layoutId`), C (scroll reveal — would compete with the existing `AnimatedGrid` stagger), and D (search-bar bloom — already well-served by the focus pulse from iter 2).
- **Card title row pins chip flush right** (handoff item 1) — the 8px gap between a short name and a short version chip read sparse. Promoted `.ts-title-main-row` from inline-flex (shrink-to-content) to flex with `width: 100%`, gave `.ts-title-main` `flex: 1 1 auto`. Now name consumes the row, chip pins to the right edge, long names still truncate first via overflow + ellipsis.

**Test count:** 42 (unchanged — no new test surface area; all 42 existing tests still green).

**Still rough (hand off to iteration 6):**
- **CardSkeleton sparse trigger is conservative** — only fires when *every* selected source is in SPARSE_SOURCES. A mixed search (community + github) with mostly-sparse community results still gets the 340px skeleton. Could weight the trigger by the fraction of sparse sources but the current binary all-or-nothing is at least predictable; iter 6 could explore a "≥80% sparse" rule.
- **DirectJumps emoji icons on iPhone SE** still rely on the OS emoji renderer at 14px; fine on iOS but Android rendering is hit-or-miss for some glyphs (🐳, 💎). Iter 6 could swap to monochrome lucide icons (`Package`, `Container`, etc.) so registry pills look uniform across platforms — currently the emoji set is part of the brand voice but it's a real cross-OS rendering hazard.
- **MotionProvider doesn't gate the hand-rolled CSS keyframes** (heroShimmer, skeleton shimmer). Those are still gated only by `@media (prefers-reduced-motion: reduce)` in globals.css. That's fine in practice — both layers honor the same OS pref — but if someone wants programmatic motion control (e.g. a "reduce motion" toggle independent of OS), the CSS layer wouldn't pick it up. Iter 6+: consider feeding `--ts-reduce-motion: 1` from a JS state into both layers if a user-facing toggle ever ships.
- **Atmospheric depth layer + dark text contrast** — verified in current palette but if `--ts-intent-hue` ever maps to a value that lands the radial spots near sage/teal (intent: how_to → 150), the depth-layer color shifts cooler. Tested visually in current iteration but bears watching as new intents are added.
- **Empty-state mobile cap of 2 secondaries** is hardcoded. If the action set grows past 4 the third+ get hidden on phone and the user has to reach for the gradient primary CTA — currently fine because the action set tops out at 4, but worth a comment if it grows.
- **`focusedIdx` gated reset** — the new identity-based lookup calls `querySelectorAll` inside an effect each time deps change. Cheap (≤9 elements typically) but if the grid ever paginates to 100+ rows, worth memoizing the id→index map. Deferred.
- **`useReducedMotion` per-component usage is now redundant with MotionProvider** for the auto-skip case. The existing usages in AnimatedCard / AnimatedGrid / Shimmer / CountUp still serve the "render different content under reduced motion" use case (not just skip animation), so removing them would lose that branch. Cleanup deferred until a use case that actually wants the auto-skip behavior alone.
- **TrendingSection language tabs + skeleton geometry** still untouched since iter 3 — could benefit from inline owner-org icons next to repos to match the new SavedSection-tile pattern. Punt.
- **SourceFilter category sheet doesn't show subtotals** — each category header is just the name, no count. Adding `(N selected)` per category would help users see at a glance which categories they've enabled. Iter 6 candidate.
- **DirectJumps prefix-row wrap** — the new `basis-full sm:basis-auto` on the prefix cluster works but creates a slight cadence shift from "all in one row" (sm+) to "prefix on row 1, pills on row 2" (mobile). Smooth but worth checking that the visual handoff between breakpoints doesn't feel jarring at the actual sm breakpoint (640px).
- **Visual-depth depth layer over `glass` surfaces** — the depth layer sits behind the body content, so cards with `backdrop-filter: blur` are sampling the depth-layer blobs through their own blur. In practice this enriches the glass; in pathological cases (a card directly over the brightest part of the radial spot) the glass can read warmer than expected. No regression observed but flag for retest if surface tokens change.

### Iteration 6 — 2026-04-24 — perf + icon consistency + drain iter-5 hand-off

**Commits:**
- 37672c7 — Polish: SourceFilter — per-category N/M subtotals
- 51d16c2 — Polish: focusedIdx — memoized id→index map replaces DOM walk
- 8948215 — Polish: weighted sparse-skeleton trigger via registry sparse flag
- 53b31a7 — Polish: DirectJumps breakpoint cadence — inline at <md to match app rhythm
- 9b5989f — Polish: drop redundant useReducedMotion in animation-only components
- dd53e59 — Polish: lucide source icons on filter / saved / toolbar pills

**Wins:**
- **SourceFilter category subtotals** (handoff item) — each category header now reads `Repos 2/4` / `Packages 7/13` etc. with the active count tinted indigo (when at full), faded when zero, plain slate otherwise. Tabular nums so multi-row category lists don't drift. Same chip layout below — nothing else changed in the sheet.
- **`focusedIdx` perf** — replaced the per-effect `querySelectorAll('[data-result-card]')` (DOM walk on every dep change) with a `useMemo`-backed `Map<id, index>` keyed off `view`. O(n) once per view change, O(1) lookup when the focused card moves under sort/filter changes. Removed the `data-result-id` DOM attribute scan entirely; we now read `view[focusedIdx]?.id` directly. Net: scales fine if the grid ever paginates to 100+ cards.
- **Weighted sparse-skeleton trigger** — was binary "every selected source must be sparse → use sparse skeleton". Now: registry-driven (`sparse: true` per source), and the picker uses `sparseFraction(selectedSources) >= 0.6`. New helpers `isSparseSource()` + `sparseFraction()` exported from the registry barrel; 7 new tests in `registry.test.ts` cover empty/all/none/mixed cases (49 tests now, up from 42). Net: a search across `github + npm + reddit + lobsters + hackernews` (3/5 sparse) now correctly picks the 260px sparse skeleton; mixed `github + reddit` (1/2 = 0.5) still gets the 340px tall geometry.
- **DirectJumps breakpoint cadence** — bumped the inline mobile variant from `<sm` (≤640px) to `<md` (≤768px). On small tablets the card grid is still 1–2 cols so the sectioned-card variant claimed two rows of vertical space without earning them; the inline single-line "Jump to <pkg> · [npm] [PyPI] …" extends through that range. Aligns with the SearchBar header / SavedSection / TrendingSection cadence which all switch at md or use grid `sm:grid-cols-2 md:grid-cols-3`.
- **`useReducedMotion` cleanup** (handoff) — `AnimatedCard` and `AnimatedGrid` were branching on the per-component hook to choose between `cardVariants/gridContainer` and `{}`. Both paths are now redundant: the global `<MotionConfig reducedMotion="user">` from iter 5 auto-reduces transition portions of variants when the OS pref is set, so the per-component check was dead. Hook usage stays in `Shimmer` (renders the static class) and `CountUp` (sets `motionValue` directly without `animate()`), where it actually drives different content/imperative behavior.
- **Lucide source icons** (handoff items 2 + 6) — partial migration as flagged by the quality bar. Added a `lucideIcon: LucideIcon` field to `SourceDisplayConfig` for all 28 sources (mapping is intentionally meaningful: `Github`, `Gitlab`, `Smile` for HF, `Container` for Docker, `Coffee` for Homebrew/Maven, `Gem` for RubyGems, `TreePine` for Codeberg, `MessageCircle` for hn/reddit/lobsters, `BookOpen` for arxiv, `GraduationCap` for stackoverflow, `Hash` for nuget, etc.). Migrated the three highest-visibility surfaces: `SourceFilter` chips (the disclosure sheet), `SavedSection` tile badges (now monochrome indigo on indigo-soft instead of mixed emoji), `ResultsToolbar` source-filter chips (the live source counts above the grid). Emoji `icon` field stays in place for: `page.tsx` pending-source loading ticker (decorative animate-pulse), markdown export headings (renders fine cross-platform), DirectJumps registry mappings (separate const, would need its own pass), and the "see all on" / "more from" deep-link rows. Net: the most user-visible filter UI now reads as system iconography rather than mixed emoji.

**Skipped this iteration:**
- **Depth-layer + glass interaction retest** (handoff item 4) — without screenshots at hue 150 / 350 / 40 / etc., retuning the radial-blob saturation or alpha would be speculative. The iter-5 author tested visually + the blob colors get blurred through 78% white glass + 20px backdrop-filter, so the pathological-glass-warmer-than-expected case is theoretical. Flagged for iter 7 as a "view-and-tune" task rather than a code change.
- **TrendingSection org icons** (handoff item 6) — re-reading the section: it already uses real `<img>` avatars + initial-text fallback (iter 3+4 work), and language tabs are text-only. No emoji to migrate inside `TrendingSection.tsx`. Kept the existing avatar-then-initial pattern.

**Test count:** 42 → 49 (registry.test.ts adds 7 tests covering `isSparseSource` and `sparseFraction` over empty / all-sparse / no-sparse / mixed selections, plus a smoke test on `getSourceConfig`).

**Still rough (hand off to iteration 7):**
- **Lucide migration — phase 2.** Outstanding emoji surfaces: `page.tsx` pending-source loading ticker (lines ~681 — currently shows `cfg.icon` mid-ellipsis as `🐙 🐍 …`; would be cleaner as small lucide icons but the pulse-rhythm needs revisit), the `See all on X` and `More from` deep-link pills (lines ~776, ~812 — would migrate cleanly with `cfg.lucideIcon`), `DirectJumps` REGISTRIES const (a separate per-registry `icon` literal that doesn't read the registry — needs its own mapping). Markdown export should stay emoji.
- **Depth-layer hue-extreme retest** — visually verify the `body::before` mesh against `--ts-intent-hue` values: 40 (model_search amber), 150 (how_to teal/sage), 350 (troubleshooting rose). The blob at `hue + 30` may push saturation above intended atmospheric levels. If so, drop blob-1 saturation 80→65% / blob-2 75→60% in `globals.css` and retest.
- **Sparse-fraction threshold could be config-tuned.** 0.6 is sensible but a future telemetry pass might prefer 0.5 or 0.7. Worth marking as a constant if/when feedback comes in.
- **`useReducedMotion` is still used by `Shimmer` and `CountUp`.** Both are legitimate uses (different content / imperative animate). Could potentially be migrated to framer's `useReducedMotion` from `framer-motion` itself (which respects `MotionConfig`) instead of our DIY hook — would unify on a single source-of-truth and the DIY hook could be removed.
- **Lucide markdown export fallback** — if the lucide icon eventually displaces the emoji entirely (`icon` field deprecated), markdown export needs a different prefix story. For now both fields live side-by-side with `icon` being the markdown-export-friendly representation.
- **Empty-state mobile cap** — still hardcoded at 2 visible secondaries on phone. No change requested but worth keeping flagged.
- **Card header version chip** still skips for dockerhub/homebrew (adapters don't surface version). No change.
- **`focusedIdx` memo edge case** — the new memoized lookup runs on every `view` identity change, but `applyOperators` returns a new array each render even when content is identical. The map cost is O(n) regardless, so this is fine, but if the result count climbs into the thousands, memoizing `view` upstream (via `useMemo` over `[sortedView, parsedQuery]`) would chop the rebuild cost.
- **SourceFilter subtotal at 0/N** — when a category has every chip de-selected, the `0/4` reads correctly but the visual feedback on the chips themselves (since they share the same data-active state) is the only signal. Could fade the entire category section at 0 selected, but that risks discoverability for first-time users still scanning the sheet.

### Iteration 7 — 2026-04-24 — drain iter-6 handoff (lucide phase 2 + framer unification + perf + homebrew)

**Commits:**
- 39c54cf — Polish: lucide migration phase 2 — page.tsx pending ticker + see-all pills
- b82c688 — Polish: DirectJumps lucide migration — npm/PyPI/crates/Docker/Gem/Packagist
- 1043688 — Polish: framer useReducedMotion unification — drop DIY hook
- 00ebe36 — Polish: memoize sortedView + view upstream of focusedIdx map
- 7c7194c — Polish: SourceFilter — zero-state category fade (60% opacity)
- fb919fc — Polish: homebrew version chip — surface formula/cask version on adapter
- ca3f879 — Polish: hero Try-pill row — arrow slide-in matches Recent rhythm
- f243200 — Polish: card caption ISO-date tooltip on hover (native title)
- a3d1987 — Polish: footer — emphasized brand + lucide Github icon + bullet rhythm

**Wins:**
- **Lucide phase 2 — page.tsx** — the three remaining emoji surfaces in the page itself now render lucide icons. Pending-source loading ticker (`Searching N sources` row) iterates `cfg.lucideIcon` at 14px in the existing `animate-pulse` rhythm — `gap-1` widened to `gap-1.5` so the icons breathe at vector size. "See all on X" pill (single-source escape hatch when filter is active) and "More from" deep-link pills (top-4 source breakdown when no filter) both moved off `cfg.icon` onto the lucide component. Pattern: tiny IIFE wrapping each `getSourceConfig(...)` call so we capture `Icon` once per pill rather than re-deriving inside JSX.
- **Lucide phase 2 — DirectJumps** — REGISTRIES const had its own per-row emoji literal (📦 🐍 🐳 💎 🐘) that didn't pull from the registry. Now uses `LucideIcon` directly: npm + Packagist → `Package`, PyPI + crates.io → `Box`, Docker Hub → `Container`, RubyGems → `Gem`. Mirrors the source-registry mapping in `lib/sources/registry.ts` so a "Jump to npm" pill in DirectJumps reads identical to the npm chip in SourceFilter. Mobile inline strip keeps 12px icons, desktop sectioned card uses 14px.
- **Framer useReducedMotion unification** — `Shimmer` and `CountUp` were on the DIY `@/hooks/useReducedMotion` (matchMedia-based, separate from framer's MotionConfig). Switched both to `framer-motion`'s `useReducedMotion`. Framer's variant returns `boolean | null` (null = still resolving) which cleanly coerces to "not reduced" by default — same behavior as before for both components. After grep-verifying nothing else touches the DIY hook, deleted both `hooks/useReducedMotion.ts` and `useReducedMotion.test.ts` plus the now-empty `src/hooks/` directory. Test count drops 49 → 47 (lost the two hook tests; framer's hook is library-tested upstream). Now there's a single source of truth for reduced-motion across the app: the global `<MotionConfig reducedMotion="user">` from iter 5.
- **`view` memoization upstream** (handoff item 6) — `applyOperators(sortedView, parsedQuery)` and `applyResultsView(...)` previously returned fresh arrays every render. Both wrapped in `useMemo` keyed on real input deps. `parsedQuery` itself was already memoized (`useMemo` over `query`), so the chain is now stable: `query → parsedQuery (memo) → sortedView (memo) → view (memo)`. Net: the focusedIdx `viewIdToIndex` map only rebuilds when sources/sort/operators actually change, not on every keystroke or unrelated state update.
- **SourceFilter zero-state category fade** (handoff item 7) — when every chip in a category is de-selected, the section reads 0/N in the subtotal. Now the entire category section also fades to 60% opacity (`transition-opacity duration-200`). Chips remain pointer-events-active; fade is purely visual. So a user looking at the sheet now gets two reinforcing signals — the dimmed `0` in tabular-num column AND the recessed section — without sacrificing first-timer discoverability (chips are still legible at 60%). Toggle a chip on, the section snaps to full opacity instantly.
- **Homebrew version chip parity** — the homebrew adapter previously dropped `versions.stable` (formula) / `version` (cask) into `updatedAt` — that was a latent bug since neither field is a date string. Backend `search-homebrew.ts` now emits a proper `version` field on each pkg (mirroring `updated` for back-compat), and the adapter maps `pkg.version` → `project.version` while resetting `updatedAt` to `new Date().toISOString()` (homebrew indexes don't expose updated-at). Net: homebrew formulas now show `v3.7.0` in the card header chip with the same treatment as npm/pypi/crates. DockerHub still skipped — would require pulling latest tag (separate API call), documented for future.
- **Hero Try-pill row** — the `Try` row's hover arrow used `opacity-0 group-hover:opacity-100` (binary fade) while the `Recent` row used `opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0` (slide-in feel). Unified Try onto the Recent pattern + added `transition-all` so width transitions evenly. Container gained `gap-y-1.5` so when the row wraps onto multiple lines (narrow phones) the lines breathe at the same rhythm as horizontal `gap-x-2`.
- **Card caption ISO-date tooltip** — `.ts-caption` ("updated 11 months ago") now ships a native `title=` attribute with the ISO date (YYYY-MM-DD slice). Hovering the caption surfaces the precise timestamp the relative-time string is rounding away. Defensive: `Number.isNaN(d.getTime())` check skips the title attribute if `updatedAt` isn't a parseable date, avoiding a misleading "Invalid Date" tooltip.
- **Footer polish** — brand wordmark now bolds slate-700 against the surrounding faint slate-500 metadata, the platform count is wrapped in `tabular-nums` and bumped to slate-600 so it carries weight, and bullet separators are a faint slate-300/400 hierarchy. GitHub link picks up an inline lucide `Github` icon at 14px to match the rest of the app's iconography. No layout changes — readable on the depth-layer gradient at every breakpoint already; this is a typographic + icon pass.

**Test count:** 49 → 47 (dropped 2 with the deleted DIY useReducedMotion test file; all remaining tests green).

**Files touched:**
- `src/app/page.tsx` (lucide ticker + see-all + more-from pills, view memoization, Try row, footer)
- `src/components/DirectJumps.tsx` (lucide REGISTRIES)
- `src/components/SourceFilter.tsx` (zero-state fade)
- `src/components/UnifiedProjectCard.tsx` (caption ISO-date tooltip)
- `src/components/motion/Shimmer.tsx` + `motion/CountUp.tsx` (framer hook)
- `src/lib/sources/adapters.ts` (homebrew version)
- `functions/api/search-homebrew.ts` (version field on backend)
- Deleted: `src/hooks/useReducedMotion.ts`, `src/hooks/useReducedMotion.test.ts`, `src/hooks/` directory

**Still rough (hand off to iteration 8):**
- **Lucide markdown export fallback** — `cfg.icon` (emoji) now lives only in the registry + ResultsToolbar markdown export. Once dockerhub/sub-future sources are added, the registry still requires both an emoji + a lucide icon. Could collapse to lucide-only by switching markdown export to a name-only (`## npm`, `## crates.io`) prefix style, but emoji-led headings give text-only output more visual rhythm. Decision: keep the dual-field shape; document it as "two-render-target source config".
- **DockerHub version chip** — still untouched. Latest-tag fetch is a separate `/v2/repositories/{namespace}/{repository}/tags` call which adds latency to every dockerhub result. Worth a feature flag if/when users explicitly request package version on docker results.
- **`view` memoization edge** — works correctly, but `parsedQuery` is reconstructed when `query` changes (good — it has to). For users who are searching-as-you-type, this means `view` rebuilds on every keystroke. The cost is now the actual filter pass, not the array allocation. Could debounce `parsedQuery` itself (e.g. 80ms after last keystroke) to coalesce keystrokes, but that fights the "search-as-you-type" UX promise. Leaving as-is.
- **SourceFilter fade interaction with category-level "select-all" UX** — there's no per-category "select all" affordance today. With the new fade, a 0-selected category reads "you've turned this off" — but there's no inverse signal for "everything on". Categories at `N/N` get the indigo subtotal accent already, so the read is asymmetric: clear "off" signal, soft "on" signal. Iter 8 could explore a per-category toggle button next to the subtotal that flips all chips in that category at once.
- **Homebrew updatedAt = now()** — since brew.sh doesn't expose a true updated-at on the formula/cask index files, every homebrew result now reports "updated just now" via `formatRelativeTime`. Previous behavior was equally wrong (using version string as a date string would parse as NaN and the maintenance pill would short-circuit). The card header version chip is the right freshness signal for package registries; the caption's "updated just now" reads slightly off. Iter 8 could either (a) suppress the caption entirely for homebrew, or (b) chase the per-formula `updated_at` field on the individual formula API endpoint (1 extra call per shown result — costly).
- **Footer brand emphasis on the depth-layer hue gradient** — verified visually green; if `--ts-intent-hue` ever lands the gradient near amber/teal, the slate-700 brand wordmark might compete. Not observed in current palette but worth a re-check if intent hues expand.
- **Card caption tooltip cross-platform** — native `title=` is reliable on desktop hover but invisible on touch devices. Iter 8 could add a real Radix/Popover tooltip if a discoverable on-tap timestamp becomes important. Native title is fine baseline.
- **Try-pill row + Recent row visual cousins** — now they share arrow-slide pattern but Try uses static positioning and Recent uses framer staggered fade. If the Try row ever needs the same staggered entrance (e.g. when EXAMPLE_QUERIES becomes dynamic), wrap it in the same `motion.div` + `staggerChildren` pattern.
- **DirectJumps icons cross-platform** — emoji-set was the cross-platform hazard flagged in iter 5. Now lucide vectors render uniformly. As a side effect, the `Box` icon for both PyPI and crates.io is the same glyph — both registries are now visually paired in the inline strip. Works but a future iteration could differentiate (e.g. specific icon for crates if lucide adds one).

### Iteration 8 — 2026-04-24 — error states + drain iter-7 hand-off + a11y + bookmark feedback

**Commits:**
- 49d27bc — Polish: homebrew suppress "just now" caption — empty updatedAt instead of fake now()
- 35e4834 — Polish: SourceFilter — per-category All/None bulk toggle
- 42a55f3 — Polish: PyPI → Package2 + crates.io → Boxes for icon differentiation
- 261f3ae — Polish: error states — retry card on full failure + failed-sources tray indicator
- e062a2f — Polish: bookmark tap feedback — card border pulse + sort/filter Esc-to-close
- 5ee55bc — Polish: aria-live region announces search status + result counts to screen readers
- 46f62d7 — Polish: card entry variety — odd/even tilt for staggered fade rhythm
- 953d5cc — Polish: TrendingSection — retry button on error state

**Wins:**
- **Homebrew "just now" suppressed** (handoff item 1) — homebrew adapter was setting `updatedAt: new Date().toISOString()` because brew.sh exposes no per-formula updated-at on the index. Result: every homebrew card read "updated just now" — a quiet lie that became visible once the version chip from iter 7 made the freshness picture cleaner. Adapter now sets `updatedAt: ""` (empty string), the card guards `formatRelativeTime` and skips the caption when the result is empty, and `maintenanceState` returns `"unknown"` on empty/invalid input (so CardPills' existing "drop unknown maintenance" path Just Works). Header version chip is now the sole freshness signal for homebrew, which is correct.
- **SourceFilter per-category All/None toggle** (handoff item 2) — the iter-7 zero-state fade made the absence of "everything off" obvious but provided no inverse signal for "everything on" or quick way to flip a whole category. Added a small ghost button next to the per-category subtotal: reads "None" when the category is fully selected (action: deselect all), "All" otherwise (action: select rest). Wired via new optional `onSetSelected` prop on SourceFilter so the component still works for parents that only pass `onToggle`. Guards against emptying the global selection (toggling off the last remaining category is a no-op so results don't go blank).
- **DirectJumps PyPI/crates icon differentiation** (handoff item 3) — both used lucide `Box`. Now PyPI → `Package2` (layered-package shape, reads as "Python wheel/distribution") and crates.io → `Boxes` (multiple stacked boxes, reads as Cargo's crate-aggregate model). Updated `lib/sources/registry.ts` and `DirectJumps.tsx` in lockstep so the inline registry strip and the SourceFilter chip render identical icons.
- **Error states — retry card + failed-sources tray** (target 5 + 6 combined) — added per-source error tracking through `SearchProgressEvent.error` so the page knows which sources failed. Two affordances:
  1. **All-sources-failed retry card.** When `failedSources.length === lastSearchedCount` and projects is empty (so the empty-state would otherwise fire), render a friendlier card: `WifiOff` glass icon, "Couldn't reach sources", a one-line explanation, and a primary "Retry search" button. Less of a death-state than the generic empty state.
  2. **Failed-sources tray indicator.** When some-but-not-all sources error and we still have results, a quiet amber ghost pill shows in the toolbar count line ("3 sources unavailable"). Click expands a small tray listing each failed source with its lucide icon + a Retry button. Tray is dismissible by clicking the indicator again. Doesn't distract during normal flow but stays discoverable.
- **Parsed-query memoization** (handoff item 4) — checked: `parsedQuery = useMemo(parseQuery(query), [query])` was already in place from iter 5. The chain `query → parsedQuery (memo) → sortedView (memo) → view (memo)` is stable. The iter-7 handoff note overstated the issue; nothing to fix. Left as-is.
- **Focus-ring consistency audit** (target 7) — global `:focus-visible` rule (`outline: 2px solid var(--ts-accent); outline-offset: 2px`) handles every custom interactive element (search bar, pills, chips, cards, bookmark, shortcut button, footer link, toolbar buttons). The only `outline:none` declarations are in shadcn `ui/*` components which all pair `focus:outline-none` with `focus:ring-1 focus:ring-ring` — the `--ring` token is HSL 238 (indigo), so the visual treatment matches the global rule. SearchBar's `.search-bar-input { outline: none }` is intentional (the `.search-bar-shell:focus-within` glow handles the ring at the shell level). No action needed; documented for future audits.
- **Bookmark tap feedback — card border pulse** (target 8) — the bookmark heart already had a bouncy scale tap (iter 0 work). Now adds a per-card pulse-ring overlay: an absolutely-positioned `<motion.span>` inside the article that animates `opacity: 0 → 1 → 0` with a borderColor of indigo-500/70 on add (delight) or slate-400/55 on remove (acknowledged but quieter). Total ~600ms via easeOut. Uses an overlay instead of animating the article's `boxShadow` directly so we don't fight the `.ts-card:hover` lift-shadow. Reduced-motion handled by the global MotionConfig.
- **Sort + filter dropdowns — Esc-to-close** (target 9) — sort dropdown already had outside-click handling but no keyboard dismiss. Added a global `keydown` listener gated on `sortOpen` that closes on Esc. Did the same for the inline filter expansion (no outside-click needed since it's not a popover, but Esc parity is the right keyboard story).
- **Card entry direction variety** (target 10) — all cards entered from `y: 8 → 0`. Now AnimatedCard takes an optional `index` prop; odd-indexed cards enter from `y: 12, x: -2`; even-indexed from `y: 8, x: 2`. Added explicit `x: 0` to `cardVariants.visible` so framer animates back to the resting offset. Subtle — max ±4px y / ±2px x so the row reads as alive without losing the calm Apple-adjacent rhythm. Reduced-motion auto-skips via MotionConfig.
- **aria-live announcement** (target 11) — added a visually-hidden `role="status" aria-live="polite" aria-atomic="true"` region near the skip-link. Composed message tracks state: "Searching N sources." while loading, "N results for {term} across M sources, K sources unavailable." on success, "Couldn't reach any sources. Retry available." on full failure, "No results found for {term}." on zero-result. Real accessibility win for screen-reader users who previously got no semantic update during the streaming search.
- **TrendingSection retry button** (target 12 / SavedSection-and-Trending placeholder polish) — error state was a passive "rate limit — try again in a minute" line. Now ships a `RefreshCw` ghost button below the message; clicking bumps a `retryNonce` state that the effect dependency-array uses to force a fresh fetch (skipping the sessionStorage cache for the retry). SavedSection already returns `null` on empty state which is correct (no first-visit placeholder needed since the section is bookmarks-driven).

**Test count:** 47 (unchanged).

**Files touched:**
- `src/lib/sources/adapters.ts` (homebrew updatedAt → "")
- `src/lib/sources/types.ts` (SearchProgressEvent.error + SearchResult.error)
- `src/lib/sources/index.ts` (per-source error propagation)
- `src/lib/sources/registry.ts` (PyPI Package2, crates Boxes)
- `src/components/UnifiedProjectCard.tsx` (caption skip-on-empty, pulse overlay, index prop)
- `src/components/SourceFilter.tsx` (All/None toggle)
- `src/components/DirectJumps.tsx` (Package2/Boxes)
- `src/components/ResultsToolbar.tsx` (Esc to close sort/filter)
- `src/components/TrendingSection.tsx` (retry button)
- `src/components/motion/AnimatedCard.tsx` (per-index entry tilt)
- `src/components/card/helpers.ts` (maintenanceState empty/invalid → unknown)
- `src/lib/motion.ts` (cardVariants.visible.x = 0)
- `src/app/page.tsx` (failedSources tracking, retry card, indicator+tray, aria-live, index prop)

**Still rough (hand off to iteration 9):**
- **Homebrew per-formula updated-at via individual API calls** — caption is now correctly suppressed but the underlying truth is that brew.sh's index doesn't carry timestamps. If freshness becomes important for homebrew, the adapter could fetch `https://formulae.brew.sh/api/formula/{name}.json` per shown result for `analytics.install.30d` or git-blob timestamps — costly (1 extra call per card), document as a feature flag.
- **DockerHub version chip + updatedAt** — still untouched. Same shape as homebrew was: backend doesn't expose either today.
- **Error tray placement on narrow viewports** — the failed-sources tray is `absolute left-0 top-full` so on a 320px iPhone-SE it might overflow the viewport on the right. Tested code-path-wise; needs a real-device check.
- **Retry card vs. partial-failure tray cohesion** — they share visual vocabulary (WifiOff/AlertTriangle, RefreshCw button) but were built as siblings in different code blocks. Could extract a single `<NetworkErrorMessage>` component that both call sites use.
- **Bookmark pulse ring + reduced-motion** — framer's MotionConfig auto-shortens the transition under `reducedMotion="user"`, but the pulse is fundamentally a "fades to invisible then back to invisible" cycle. Under reduced-motion users may see no pulse at all (which may be desired). If we want a visible-but-static signal under reduced-motion (e.g. a 200ms solid border), add a useReducedMotion branch in the click handler.
- **Card entry variety on huge result sets** — 9 cards: visible difference. 100+ cards: the variety becomes a wave that makes the late-arriving cards feel slow. If pagination ever lands, cap the variety to the first ~12 cards (then go uniform).
- **aria-live verbosity** — current message includes term, count, and unavailable-source count. On long searches the screen reader hears "Searching 28 sources" then "27 results for {long term} across 28 sources, 1 source unavailable." which is verbose. Could trim to "27 results, 1 source unavailable." but the term-in-announcement is genuinely useful for context.
- **TrendingSection retry — clears cache or not?** — currently bypasses cache via the retryNonce dep but doesn't clear stored cache. If the retry succeeds, `saveCache` overwrites the stored entry. Fine, but the failed cache (from a failed run) was never written so there's no stale-bad-data risk.
- **Focus ring consistency** documented but not visually verified at every breakpoint. Worth a quick screenshot pass on phone widths in iter 9 — particularly the toolbar's wrap groups where `min-w-0 + truncate` could clip a focus ring at the wrap boundary.
- **SourceFilter category-toggle + zero-state fade interaction** — when a category goes 0/N the section fades to 60% opacity (iter 7 work), but the new "All" button is inside the faded section so its own click target is also at 60% opacity. The button is still legible and clickable, but if the fade reads as "this is disabled" to a first-time user, they might not realize the button works. Consider raising the toggle to full-opacity even when its parent fades, or using a different visual treatment.

### Iteration 9 — 2026-04-23 — drain iter-8 handoff + scroll-shadow + FLIP + per-source feedback

**Commits:**
- 37c11ad — Polish: extract NetworkErrorMessage + NetworkErrorTray shared components
- b7600bd — Polish: bookmark pulse — static fallback under reduced-motion
- 226757c — Polish: dockerhub updatedAt — empty fallback (mirror homebrew)
- 604a230 — Polish: TrendingSection retry — clear sessionStorage cache before refetch
- c002982 — Polish: SourceFilter — header stays crisp when category fades
- d86c2a1 — Polish: sticky header — scroll-driven shadow accumulation
- eb1bbe5 — Polish: AnimatedCard layout="position" — FLIP fires on sort reorder
- 049034f — Polish: source-unavailable feedback — quiet "0" pills for empty sources
- fa2893b — Polish: CountUp — snap-to-end on rapid value changes
- 7c66ea5 — Polish: card hover lift gated on (hover: hover) — touch-safe

**Wins:**
- **NetworkErrorMessage extract** (handoff item 1) — the iter-8 retry card and the partial-failure tray were two parallel JSX trees in page.tsx sharing the same vocabulary (WifiOff / AlertTriangle / RefreshCw, indigo+amber tinting) but free to drift. Pulled both into `components/network/NetworkErrorMessage.tsx` exporting `<NetworkErrorMessage>` (full-page card) and `<NetworkErrorTray>` (inline ghost pill + dropdown). Page.tsx call sites collapse from inline JSX to two prop-driven components; net -27 lines in page.tsx + a single source of truth for the error vocabulary.
- **Bookmark pulse — reduced-motion fallback** (handoff item 2) — the iter-8 pulse animates `opacity: [0,1,0]` over 600ms, which the global `<MotionConfig reducedMotion="user">` collapses to a no-op under the OS pref. Result: prefers-reduced-motion users got *no* affordance signal at all. Added `useReducedMotion` branch in the click handler: when set, snap the ring to opacity 1 + indigo/slate borderColor for 1.5s via `setTimeout`, then snap back to 0. Static (no animation), but a clear visible "you did it" signal. Animated path unchanged for everyone else.
- **DockerHub `updatedAt` empty fallback** (handoff item 3, partial) — the search adapter was mirroring the same homebrew bug iter-8 already fixed: falling back to `new Date().toISOString()` when the API omits `last_updated`, causing every dockerhub card to show "updated just now". Now falls back to `""` so the card caption suppresses cleanly via the existing guard. Version chip is **not** wired — DockerHub's `/v2/search/repositories/` endpoint doesn't include tags or digests, and a per-result `/tags` call (the only way to get a version label) adds latency to every hit. Documented as a feature-flag candidate.
- **TrendingSection retry cache clear** (handoff item 4) — the iter-8 retry button bumped `retryNonce` so the effect skipped the cache *read*, but the stored sessionStorage entry was untouched. If the retry network call itself failed, a future fresh visit would still hit the stale cache. Now the click also calls `clearCache(lang)` before bumping the nonce. Effect behavior unchanged on success (saveCache overwrites either way).
- **SourceFilter All/None visibility** (handoff item 5) — the iter-7 zero-state fade dropped the *entire* category section to 60% opacity, sweeping the iter-8 All/None toggle (and the subtotal + title) into the fade and making the affordance to *un-fade* the category read as visually disabled. Restructured: only the chip cluster gets the opacity transition; the title + All/None button + subtotal stay full-opacity always. Two reinforcing signals (faded chips + still-crisp toggle) without the "this is disabled" misread.
- **Sticky header scroll-driven shadow** (handoff item 6 / new) — sticky header had a fixed shadow stamping on the gradient even at scrollY=0, where the header sits flush with the page. Wired framer's `useScroll` + `useTransform` to feed a CSS custom property (`--ts-sticky-shadow-opacity`) tweened 0→1 across 0→60px of scroll; `.glass-sticky`'s box-shadow rgba alphas multiply through it. At scroll-top the shadow is nearly invisible (header reads flush); past 60px the full shadow vocabulary lands. rAF-driven, no React re-renders. Subtle but real depth signal that responds to user motion.
- **AnimatedCard FLIP on sort reorder** (handoff item 7) — cards had `layoutId` (which animates shared elements between mode swaps) but no `layout` prop, so a sort-mode change just snapped each card into its new grid cell with no animation. Added `layout="position"` so cards slide between grid cells smoothly on reorder. The `"position"` variant skips width/height animation — important because cards have different content heights, and animating box dimensions would produce visible squash. 0.3s ease-out cubic. Confirmed firing on sort change.
- **Source-unavailable feedback** (handoff item 8) — sources that completed successfully but returned no matches were invisible to the user. Distinct problem from failed sources (those bubble up via the amber tray). Added a third bucket `emptySources: SourceType[]` populated when a progress event lands with no error and no projects. The toolbar's filter expansion renders empty sources as desaturated, non-interactive pills (50% opacity, `cursor-default`) with a trailing "0" badge and a `title=` of "{source} — no matches". Lives below the active source pills in the same row. Reset alongside `failedSources` on each new search and on clear. Picked over per-card "no matches" lines because the toolbar consolidates the signal in one place rather than scattering it.
- **CountUp snap-to-end on rapid changes** (handoff item 10) — when results streamed faster than CountUp's 0.3s tween, the displayed number was chronically lagging reality. Added a 100ms inter-change threshold via `useRef`: if the previous value change was less than `RAPID_THRESHOLD_MS` ago, snap `mv.set(value)` instead of starting another tween. Slow updates still animate. Reduced-motion path unchanged.
- **Card hover lift on touch** (handoff item 11) — the `.ts-card:hover { transform + shadow }` rule fires on touch devices on tap (sticky-firing until next interaction), leaving the card stuck in its lifted state on phones/tablets. Wrapped the rule in `@media (hover: hover)` so the lift only fires on real hover-capable pointers. Framer's `whileHover` y:-4 stays in place — it's a more modest 4px lift and resets cleanly on framer's pointer events.

**Skipped this iteration:**
- **Sticky header progress bar polish** (target 9) — the existing `.ts-sticky-progress > span` already has `transition: width .3s ease-out` baked into CSS, which animates width changes smoothly as `progressPct` updates. Migrating to framer-motion would just be a re-implementation with no visible change. Re-confirmed smooth; deferred the framer migration.
- **Footer micro-polish** (target 12) — re-read the footer JSX after the iter-7 brand emphasis pass. Bullet hierarchy (slate-400 first, slate-300 second/third) is intentional; brand wordmark at slate-700 against slate-500/400 metadata reads cleanly. Nothing crying out for tightening; left alone.

**Test count:** 47 (unchanged — no new test surface).

**Files touched:**
- `frontend/src/components/network/NetworkErrorMessage.tsx` (new)
- `frontend/src/app/page.tsx` (network extract, sticky shadow, emptySources)
- `frontend/src/components/UnifiedProjectCard.tsx` (reduced-motion bookmark)
- `frontend/src/lib/sources/adapters.ts` (dockerhub fallback)
- `frontend/src/components/TrendingSection.tsx` (cache clear)
- `frontend/src/components/SourceFilter.tsx` (header un-fades)
- `frontend/src/app/globals.css` (sticky shadow vars + hover gate)
- `frontend/src/components/motion/AnimatedCard.tsx` (layout="position")
- `frontend/src/components/motion/CountUp.tsx` (rapid snap)
- `frontend/src/components/ResultsToolbar.tsx` (emptySources pills)

**Still rough (hand off to iteration 10):**
- **DockerHub version chip** still off — would need a per-result `/tags` call. Worth a feature flag if users explicitly request package versions on docker results, but otherwise the latency cost outweighs the polish. Documented in the adapter.
- **NetworkErrorMessage tray placement** still uses `absolute left-0 top-full` — at 320px iPhone-SE width the tray content (~200px min-width) might overflow the viewport when the indicator is mid-row. A device-width clamp or right-edge auto-flip is iter-10 territory.
- **Sticky shadow at scroll y=60-120** — the 0→1 tween across 60px completes quickly. On a slow trackpad scroll the shadow appearance feels like a snap-on. A wider tween (0→120 or 0→200) would feel more atmospheric, but burns the "subtle" budget. Worth a visual look.
- **Source-unavailable pills exhaustion** — when a query is sparse across 28 sources, the toolbar's filter expansion can show ~5 active + ~20 empty pills, which is a visual wall of "0"s. Could collapse all-empty into a single "20 sources had no matches" summary pill for cluttered cases. Simple count threshold (e.g. ≥6 empty → collapse).
- **CountUp 100ms threshold** — picked from the duration math (0.3s tween, so 100ms = ~third of a tween cycle). On *very* slow networks (single source completing per second) the snap path triggers because elapsed > threshold *between* the same two values, but the animation duration absorbs that. Worth tightening to 200ms if QA finds the snap visible on normal-speed streams.
- **`(hover: hover)` not yet checked on every interactive surface** — pills, filter chips, search-bar shell all still use `:hover` without the gate. Card lift was the loudest offender; the rest are subtle color/transform shifts that are less likely to read as "stuck." Iter 10 candidate: audit pill hover states under touch.
- **AnimatedCard layout transition timing** — 0.3s ease-out cubic. Looks good for ~9 cards; on huge result sets the simultaneous animate could get visually noisy. Capping `layout` to the first 24 cards (matching the entry-variety cap suggested in iter 8) is a future option.
- **`<NetworkErrorMessage>` is page-specific** — the component lives in `components/network/` but assumes the calling site has a single `query`/`handleSearch` flow. If TrendingSection or another widget ever needs the same retry vocabulary, the component would need a more generic API (currently `onRetry: () => void` is fine but `<NetworkErrorMessage>` hardcodes "Couldn't reach sources" / "All N sources were unreachable" — brittle if reused for non-search scenarios).
- **emptySources reset on filter-source change?** — currently empty sources from the most-recent search persist as toolbar pills until the next search runs. If the user changes their selectedSources mid-session without re-searching, the pills refer to the old query's results. Fine in practice (the search auto-fires on selection change today), but worth flagging if that auto-fire is ever removed.
