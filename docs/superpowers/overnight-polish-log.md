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
