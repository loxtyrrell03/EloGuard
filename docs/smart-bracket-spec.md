# Smart Bracket v2 — Design Spec

Replaces the current `rating ± fixed range` smart bracket with a performance-aware bracket
computed from the player's recent chess.com game history, with human-readable explanations
shown on the popup home view. Pro-gated (existing `smartBracket` feature id).

Two parts:
- **Part A — Engine**: `lib/smart-bracket.js` (pure computation + archive fetcher) + `tests/smart-bracket.test.js`.
- **Part B — UI/integration**: popup home-view insight card, settings controls (auto mode,
  trailing toggle, elo goal), popup.js wiring, content.js trailing stop-loss.

---

## Part A — Engine (`lib/smart-bracket.js`)

### Module format
Dual-mode IIFE exactly like `lib/review-core.js` (see its tail around line 1116):
`module.exports = api` when CommonJS, and `window.EloGuardSmartBracket = api` in browser.
No other dependencies (no lib/chess.js). Tests use Node's built-in `node:test` and plain
`require()` like `tests/test_review2.js`.

### Public API

```js
const api = {
  normalizeArchiveGames(archiveGames, username, timeClass), // -> Game[]
  fetchRecentGames(opts),                                   // -> Promise<Game[]>
  computeSmartBracket(input),                               // -> Result  (PURE, deterministic)
};
```

`Game` (normalized, sorted oldest → newest):
```js
{ end: number,          // epoch seconds (archive end_time)
  start: number|null,   // epoch seconds from PGN UTCDate/UTCTime headers, else null
  rating: number,       // MY post-game rating (white/black matched by username, case-insensitive)
  result: 'win'|'draw'|'loss' }
```

### normalizeArchiveGames(archiveGames, username, timeClass)
Input: concatenated `games` arrays from chess.com monthly archive JSON. Filter to
`rated === true && rules === 'chess' && time_class === timeClass` and games where
`white.username` or `black.username` equals `username` case-insensitively.
Result mapping from my side's `result` code: `"win"` → win; one of
`agreed, repetition, stalemate, insufficient, 50move, timevsinsufficient` → draw;
anything else → loss.
`start`: parse `[UTCDate "YYYY.MM.DD"]` + `[UTCTime "HH:MM:SS"]` from the `pgn` string via
regex and `Date.UTC` (deterministic); null if absent. Sort by `end` ascending.

### fetchRecentGames({ username, timeClass, fetchImpl = fetch, nowSec, maxGames = 60, maxDays = 45 })
1. GET `https://api.chess.com/pub/player/{username}/games/archives` → `{ archives: [...] }`
   (urls oldest → newest).
2. Walk archive urls newest-first, fetch each month, normalize, and accumulate until either
   `maxGames` games collected, games get older than `nowSec - maxDays*86400`, or 3 months
   have been fetched (hard cap).
3. Return the games inside the window (oldest → newest), at most `maxGames` (keep the most
   recent ones). Throw on non-OK responses. `nowSec` required from caller (no `Date.now()`
   inside compute paths; the fetcher may default `nowSec` to `Math.floor(Date.now()/1000)`).

### computeSmartBracket(input)

```js
computeSmartBracket({
  games,               // Game[] oldest → newest
  currentRating,       // number (live rating from stats endpoint)
  mode,                // 'rapid'|'blitz'|'bullet' (for copy)
  goal,                // null | { target, startRating, setAt }  (per-mode)
  manualRange = 25,    // user's fallback ± value
  nowSec,              // epoch seconds, REQUIRED (purity)
})
```

**Pure and deterministic.** No `Date.now()`, no randomness. All rounding via `Math.round`.

#### Derived stats
- **Window**: `windowDays = ceil((nowSec - games[0].end) / 86400)` (0 if no games).
- **Deltas**: `delta[i] = rating[i] - rating[i-1]` for `i >= 1` (first game has no delta).
- **avgLossPts** = mean of `|delta|` over games with `result === 'loss'` and `delta < 0`;
  fallback **8** if fewer than 5 samples. **avgWinPts** analogous over wins with `delta > 0`,
  fallback **8**.
- **Sessions**: group consecutive games where the gap to the previous game is ≤ 3600s.
  Gap = `start[i] - end[i-1]` when `start[i]` is available, else `end[i] - end[i-1]`.
- **Per-session drawdown**: within each session's post-game rating sequence, the max
  peak-to-trough drop (classic max drawdown). **typicalDrawdown** = median of drawdowns over
  sessions with ≥ 3 games; if fewer than 3 such sessions, fallback `3.5 * avgLossPts`.
- **Per-session upswing**: max trough-to-peak rise; **typicalUpswing** = median over sessions
  with ≥ 3 games, fallback `2.5 * avgWinPts`.
- **Trend**: least-squares slope of (end time in days, rating) over all games →
  **slopePerWeek** (slope/day × 7, round to 1 decimal). Needs ≥ 5 games, else 0.
- **Form**: over the last 10 games: wins/losses/draws, `net10` = sum of their deltas
  (games with a delta). **streak** = `{ type: 'win'|'loss'|'draw', len }` of the most recent
  consecutive same-result run.
- **Tilt**: look at the most recent session; tilt is true iff that session ended within 12h
  of `nowSec` AND (it ends with ≥ 3 consecutive losses OR its net rating change ≤
  `-2.5 * avgLossPts`).
- **Plateau**: true iff `windowDays >= 21` AND `|slopePerWeek| < 4` AND
  `(maxRating - minRating over window) <= max(2 * typicalDrawdown, 60)`.
  If true, record `{ low: minRating, high: maxRating, weeks: round(windowDays/7) }`.

#### Bracket computation (in this order)
1. **Insufficient data**: if `games.length < 10`, return
   `ok: false, floor = currentRating - manualRange, ceiling = currentRating + manualRange`,
   with the "insufficient" reason line, `stats` still populated with whatever computed,
   `trailingDistance = manualRange`. Done.
2. **Base gaps** (volatility-scaled, asymmetric):
   - `floorGap = clamp(typicalDrawdown + 0.5*avgLossPts, max(2.5*avgLossPts, 15), 100)`
   - `ceilGap  = clamp(typicalUpswing  + 0.5*avgWinPts,  max(2*avgWinPts, 12),  100)`
   - `floor = round(currentRating - floorGap)`, `ceiling = round(currentRating + ceilGap)`.
3. **Tilt tighten**: if tilt, `tiltFloor = currentRating - max(round(1.5*avgLossPts), 15)`;
   `floor = max(floor, tiltFloor)`.
4. **Plateau snugging**: if plateau (and not tilt-tightened above the band),
   `floor = max(floor, plateau.low - round(avgLossPts))` and
   `ceiling = max(min(ceiling, plateau.high + round(avgWinPts)), currentRating + 2*avgWinPts)`.
5. **Rising form headroom**: if `slopePerWeek >= 10 && net10 > 0`,
   `ceiling += round(avgWinPts)`.
6. **Goal ceiling**: if `goal && goal.target > currentRating`:
   `milestone = smallest multiple of 25 that is >= currentRating + max(typicalUpswing, 2*avgWinPts)`;
   `ceiling = min(goal.target, max(milestone, ceiling))`... simplified rule:
   `ceiling = min(goal.target, max(ceiling, milestone))`.
   If `goal && goal.target <= currentRating` → goal reached (reason line only; ceiling untouched).
7. **Goal give-back floor**: if `goal && goal.startRating` and
   `progress = currentRating - goal.startRating >= 30`:
   `floor = max(floor, goal.startRating + round(0.6 * progress))`.
8. **Final safety clamps** (never strangle):
   `floor = min(floor, currentRating - max(round(1.5*avgLossPts), 10))`;
   `ceiling = max(ceiling, currentRating + max(round(1.5*avgWinPts), 10))`.
9. `trailingDistance = currentRating - floor`.

`clamp(x, lo, hi) = min(max(x, lo), hi)`.

#### Goal pace (for reasons/UI, when goal set and not reached)
- `etaWeeks = slopePerWeek > 0 ? round((goal.target - currentRating) / slopePerWeek) : null`
- `onPace = etaWeeks !== null` (no target date in v1; onPace simply means "trend is positive").

#### Result shape
```js
{
  ok: true|false,
  floor, ceiling,            // integers
  trailingDistance,          // integer, currentRating - floor
  gamesUsed, windowDays, sessions,   // counts
  stats: { avgLossPts, avgWinPts, typicalDrawdown, typicalUpswing,
           slopePerWeek, net10, streak, tilt, plateau },  // plateau: null | {low,high,weeks}
  goal: null | { target, reached, etaWeeks, progress },   // progress vs startRating or null
  reasons: [ { icon, text, tone } ],  // tone: 'info'|'good'|'warn'; ordered, UI shows first 4
}
```

#### Reason lines (exact templates — copy is final)
Emit in this order (skip non-applicable). `{gap}` values are integers; `{dd}`, `{up}` rounded.
1. Tilt (warn, 📛): `{k} straight losses last session — floor tightened.`
   (if tilt triggered by net drop, not streak: `Rough last session (−{n} pts) — floor tightened.`)
2. Floor basis (info, 📉): `Rough patches cost you ~{dd} pts — floor {gap} below.`
   (when tilt overrode the base floor, instead: `Floor {gap} below until the streak turns.`)
3. Ceiling basis (info, 📈): `Good runs gain ~{up} pts — ceiling {gap} above.`
4. Plateau (info, ⚖️): `Flat {lo}–{hi} for {w} weeks — set to catch a breakout.`
5. Trend (good ↑ / warn ↓, 📊): if `slopePerWeek >= 3`: `Trending +{s}/week over {g} games.`
   if `<= -3`: `Trending {s}/week — floor kept snug.` else skip (plateau line covers flat).
6. Goal (🎯): reached → (good) `Goal {t} reached — set a new one in settings.`
   `etaWeeks` 1..52 → (good) `Goal {t}: ~{w} wks away at current pace.`
   else → (info) `Goal {t}: trend is flat — no ETA yet.`
   give-back active → append (info, 🔒) `Protecting gains made since you set your goal.`
7. Insufficient (info, ℹ️, `ok:false` only): `Only {n} rated {mode} games in {d} days — using ±{r}.`

### Tests (`tests/smart-bracket.test.js`)
Node built-in `node:test` + `assert`, plain `require('../lib/smart-bracket.js')`.
Build synthetic Game[] fixtures with a helper (e.g. `mkGames(spec, nowSec)`); fixed `nowSec`.
Cover at minimum:
- normalizeArchiveGames: filtering (unrated/variants/other time_class), result mapping
  (win/draw codes/loss codes), username case-insensitivity, PGN start-time parsing + missing pgn.
- insufficient data (< 10 games) → ok:false, manualRange fallback, reason present.
- volatile player vs stable player → wider vs narrower floorGap (asymmetry visible).
- tilt: recent session ending in 4 losses → floor tightened vs same history without the streak;
  old (>12h) losing session → no tilt.
- plateau: flat 5-week series → plateau detected, floor snug under band low.
- rising form: strong positive slope → ceiling headroom added.
- goal: milestone/goal capping of ceiling, reached goal, give-back floor after +50 progress,
  eta computation, and goal ignored when target below current rating.
- clamps: floor never within `max(1.5*avgLoss,10)` of current; gaps respect min/max bounds.
- determinism: same input twice → deep-equal output.
- fetchRecentGames with a stubbed `fetchImpl`: month walking newest-first, maxGames/maxDays
  cutoffs, error propagation on non-OK.

---

## Part B — UI & integration

### Storage keys (chrome.storage.sync unless noted)
- `smartAuto` (bool, default **false**; set to `true` automatically after the first successful
  smart Apply — consent by first use)
- `smartTrailing` (bool, default true — only meaningful for Pro users with a computed bracket)
- `smartTrailingDist_${mode}` (int, written on every smart apply; content.js reads it)
- `eloGoal_${mode}` (JSON string `{"target":1500,"startRating":1204,"setAt":<epoch s>}` or unset)
- `smartRange` (existing, kept — now the manual/fallback ± value)
- `stopLoss_${mode}` / `targetRating_${mode}` (existing — smart apply now PERSISTS these
  directly, not just the inputs)
- chrome.storage.local: `smartBracketLast:${username}:${mode}` =
  `{ result, rating, computedAt }` (render cache, 30-min TTL for auto recompute)
- chrome.storage.local (content.js): `eloGuardSessionPeak:${USERNAME}:${GAME_MODE}` =
  `{ peak, ts }`

### Home-view insight card (popup.html / popup.css / popup.js)
Insert AFTER `#activateBtnContainer` (popup.html ~line 60), BEFORE `.toggle-panel`:

```html
<div id="smartBracketCard" class="sb-card hidden">
  <div class="sb-head">
    <span class="sb-title">⚡ Smart bracket</span>
    <button id="sbRefreshBtn" class="pro-refresh-link" title="Recompute from recent games">↻</button>
  </div>
  <div class="sb-rail">
    <div class="sb-track"><div class="sb-dot" id="sbDot"></div></div>
    <div class="sb-rail-labels">
      <span class="sb-floor">🛑 <span id="sbFloorVal">---</span></span>
      <span class="sb-current" id="sbCurrentVal">---</span>
      <span class="sb-ceiling">🏆 <span id="sbCeilVal">---</span></span>
    </div>
  </div>
  <ul id="sbReasons" class="sb-reasons"></ul>
</div>
```

CSS — match the existing card language exactly (see `.status-card`, `.pro-section`):
- `.sb-card`: `margin: 10px 14px 0; padding: 11px 14px 12px; background: var(--eg-surface);
  border: 1px solid var(--eg-line); border-radius: var(--eg-r-2);`
- `.sb-head`: flex row space-between; `.sb-title` styled like `.pro-section-title`
  (11px, 700, uppercase, letter-spacing 0.08em, color var(--eg-text-2)).
- `.sb-track`: `position: relative; height: 4px; border-radius: var(--eg-r-pill);
  background: var(--eg-surface-3); margin: 12px 6px 6px;`
- `.sb-dot`: absolute, 10px circle, `background: var(--eg-green);
  box-shadow: 0 0 8px var(--eg-green-glow); top: 50%; transform: translate(-50%, -50%);`
  `left` set from JS to `((current - floor) / (ceiling - floor)) * 100`% clamped 3–97%.
- `.sb-rail-labels`: flex space-between, 11px, `font-variant-numeric: tabular-nums`;
  `.sb-floor` color `var(--eg-red)`, `.sb-ceiling` color `var(--eg-gold)`,
  `.sb-current` color `var(--eg-text)` weight 700.
- `.sb-reasons`: `list-style: none; margin: 9px 0 0; padding: 8px 0 0;
  border-top: 1px solid var(--eg-line);` items 11px, line-height 1.35,
  color var(--eg-text-2), `+ li` margin-top 5px. `[data-tone="warn"]` → color var(--eg-gold);
  `[data-tone="good"]` → color var(--eg-green-bright).

Card states (render helper `renderSmartBracketCard(state)`):
- **hidden**: free user, no username, or no cached/no computed result → card has `.hidden`.
- **loading**: title + single italic line `Analyzing your last {n} games…` (text-3 color).
- **ready**: rail + first 4 reasons.
- **error**: single line `Couldn't fetch game history — tap ↻ to retry.` (warn tone).
- **manual** (Pro user applied manual ± with smartAuto off): rail + one line
  `Manual bracket: ±{r} around {rating}.` (info).

### Settings view additions (smart bracket group, popup.html ~lines 250-261)
Keep the ± input + Apply button. Add, inside the same `.input-group.smart-bracket-group`,
two toggle rows styled like `.zen-wrapper` (smaller: reuse the switch component):
- `Auto from recent games` → checkbox id `smartAutoToggle` (sync `smartAuto`)
- `Trailing stop-loss` → checkbox id `smartTrailingToggle` (sync `smartTrailing`), with
  tooltip: `Floor rises as your session rating peaks — locks in gains, stops give-backs.`
Update the group tooltip text to: `Pro. Sets floor & ceiling from your last ~45 days of
games — volatility, trend, tilt and plateau aware. The home screen explains every number.`

New goal input-group directly below the smart bracket group:
```html
<div class="input-group goal-group">
  <label>🎯 Long-term Elo goal <span class="pro-inline-badge">Pro</span>
    <div class="tooltip-container"><span class="tooltip" data-text="Per game mode. The smart bracket aims your ceiling at milestones on the way and shows your pace on the home screen.">?</span></div>
  </label>
  <div class="flex-row">
    <input type="number" id="eloGoalInput" placeholder="e.g. 1500">
    <button id="eloGoalClearBtn" class="secondary-btn">Clear</button>
  </div>
</div>
```
- Loads/saves `eloGoal_${activeMode}`; on set (input change or Save), store
  `{target, startRating: currentFetchedRating ?? null, setAt: nowSec}` — preserve the
  original `startRating`/`setAt` if a goal for this mode already exists and only the target
  changed upward/downward (still keep original start; changing target does not reset progress).
  Clear removes the key. Input reflects the active mode's goal on load and on mode switch.
- Pro-gated: extend `setSmartBracketUi(isPro)` (popup.js ~line 875) to also
  disable/enable `smartAutoToggle`, `smartTrailingToggle`, `eloGoalInput`, `eloGoalClearBtn`.

### popup.js wiring
- Load `lib/smart-bracket.js` via a `<script>` tag in popup.html next to the existing
  `lib/entitlements.js` tag (~line 333). Access as `window.EloGuardSmartBracket`.
- New `runSmartBracket({ trigger })`:
  1. Guard: Pro + username + `currentFetchedRating` present, else no-op (or paywall for the
     button trigger, reusing the exact pattern at popup.js:542-547).
  2. Render loading state; `fetchRecentGames` for `activeMode`; read `eloGoal_${activeMode}`
     and `smartRange`; `computeSmartBracket`.
  3. Apply: set `stopLossInput`/`targetRatingInput`, call `updateMainViewStats()` (popup.js:231),
     persist `stopLoss_${mode}`, `targetRating_${mode}`, `smartTrailingDist_${mode}` to sync,
     cache result to local `smartBracketLast:${username}:${mode}`, then refresh the content
     script the same way the save flow does (`refreshActiveChessTab`, popup.js:952).
  4. Render ready state. On fetch error → error state (button trigger also flashes `❌ Error`).
- Triggers:
  - **Apply button** (popup.js:542 — replace handler body): if `smartAuto` OR the compute
    succeeds, run smart path and set `smartAuto = true` on first success; if the user has
    smartAuto explicitly off, keep the legacy manual ± behavior but persist to sync too and
    render the card's manual state.
  - **checkConnection success** (popup.js:708-755, after `currentFetchedRating` set): if Pro
    && `smartAuto` → render cached result instantly if fresh (< 30 min and same rating),
    else silent `runSmartBracket`.
  - **sbRefreshBtn**: force recompute (ignore cache). Free user → paywall via
    `openBillingForFeature(SMART_BRACKET_FEATURE)`.
  - **Mode switch**: re-render from that mode's cache or hide card; if smartAuto and stale,
    silent recompute after the mode's rating is known.

### content.js — trailing stop-loss
All references: `loadSettings` (content.js:818-850, keys at 845-849), 30s poll (882),
`checkRating()` (1180-1238, breach handling 1216-1224), `lockOut(rating, type)` (1242+),
local-storage key pattern (1746-1749).
- `loadSettings()` additionally reads `smartTrailing` and `SMART_TRAILING_DIST =
  data['smartTrailingDist_' + GAME_MODE]`.
- Session peak: local key `eloGuardSessionPeak:${USERNAME}:${GAME_MODE}`. Reset (delete)
  whenever the guard transitions to active (activation flow) and when a lock is cleared.
- In `checkRating()`, after the current rating `r` is known and guard is active:
  `peak = max(stored peak ?? r, r)`; persist if changed (with `ts: now`).
  If `smartTrailing && SMART_TRAILING_DIST > 0`:
  `effectiveStop = max(STOP_LOSS, peak - SMART_TRAILING_DIST)`; breach when
  `r <= effectiveStop`. When the trailing component (not the static floor) is what triggered,
  the lock overlay message must explain it, e.g.:
  `Trailing stop: you peaked at {peak} this session and gave back {peak - r} points.
   Locking in the gains — come back fresh.`
  Reuse the existing `lockOut(..., 'stop')` machinery; add the message variant, don't fork
  the lock flow. A stale peak (ts older than 12h) is discarded before use.
- No entitlement check in content.js: `smartTrailingDist_${mode}` is only ever written by
  the popup's Pro-gated path, so its presence implies Pro.

### Acceptance
- `node --test tests/smart-bracket.test.js` passes; existing `tests/*.test.js` still pass.
- Popup renders the card in every state without layout overflow at 320×520.
- Free user: card hidden, Apply/refresh routes to paywall, settings controls disabled —
  matching the existing `setSmartBracketUi` pattern.
- Extension packaging script (if it whitelists files) includes `lib/smart-bracket.js`.

---

## Part C — Settings redesign: single entry + two-step flow
**Supersedes Part B's "Settings view additions" section.** The inline smart-bracket
controls (± input + Apply, `smartAutoToggle`, `smartTrailingToggle`) and the separate
goal group are REMOVED from the settings list and replaced by one entry row that opens
a dedicated two-step setup view. Storage keys, the engine, the home card, and content.js
are unchanged. No tooltips anywhere in the new flow — every control gets visible microcopy.

### C1. Settings entry row (replaces `.smart-bracket-group` + `.goal-group`)
```html
<div class="input-group smart-bracket-group">
  <label>⚡ Smart Bracket <span class="pro-inline-badge">Pro</span></label>
  <div class="sb-entry-row">
    <span id="sbEntryStatus" class="sb-entry-status">Not set up</span>
    <button id="smartSetupBtn" class="secondary-btn">Set up</button>
  </div>
</div>
```
- `#sbEntryStatus` (11px, `var(--eg-text-3)`): `Not set up` | `Auto · trailing on` (+
  ` · goal {t}` when the active mode has a goal) | `Manual ±{r}`. Reflects the active mode;
  update on mode switch and after every apply.
- `#smartSetupBtn`: `Set up` when never applied for this mode, else `Manage`. Free user:
  text `Pro`, click → `openBillingForFeature(SMART_BRACKET_FEATURE)` (existing pattern).
  `setSmartBracketUi(isPro)` now only handles this button + the entry row lock styling.
- `.sb-entry-row`: flex row, space-between, align-center, margin-top 6px.

### C2. Setup view (`#smartSetupView`)
New top-level sibling of `#mainView`/`#settingsView`, toggled with `.hidden` exactly like
the existing views; same container CSS as `#settingsView` (padding, `overflow-y: auto`,
full height). Contains two step panels, `#sbStep1` and `#sbStep2`, toggled with `.hidden`.

Header (both steps): `<button id="sbFlowBackBtn" class="icon-btn">← Back</button>` +
`<h2>Smart Bracket</h2>` + step indicator `<span class="sb-step-label">Step 1 of 2</span>`
(11px, `var(--eg-text-3)`). Back behavior: on step 2 → step 1; on step 1 → `#settingsView`.

**Step 1 — preferences.** Rows in order, each control followed by a `.sb-micro` line
(10.5px, `var(--eg-text-3)`, line-height 1.4, margin-top 4px). Copy is final:
1. Intro paragraph (`.sb-intro`, 11.5px, `var(--eg-text-2)`):
   `Your floor & ceiling, computed from your recent games. Every number is explained on the home screen.`
2. Goal — label `🎯 Elo goal — {Mode}` (Mode = capitalized active mode), number input
   `#sbGoalInput` placeholder `e.g. 1500`, small text-link `Clear` (`#sbGoalClearBtn`,
   visible only when a goal exists).
   Micro: `Optional. Your ceiling aims at milestones on the way, and the home screen tracks your pace.`
3. Trailing toggle `#sbTrailingToggle` (reuse `.switch`), label `Trailing stop-loss`.
   Micro: `Floor rises as your session peaks — locks in gains, stops give-backs.`
4. Auto toggle `#sbAutoToggle`, label `Keep bracket up to date`, default ON.
   Micro: `Recalculates from your latest games each time you open EloGuard. Off: your bracket stays fixed until you re-apply it here.`
5. Fallback range — label `Fallback range (±)`, number input `#sbFallbackRange`
   (loads/saves the existing `smartRange` key).
   Micro: `Used only when there's not enough recent game data.`
6. Primary button `#sbPreviewBtn`, full-width `.big-btn`: `Preview bracket`.

Step-1 edits persist immediately to their existing keys (`smartTrailing`, `smartRange`,
`eloGoal_${mode}` via the existing `saveGoalForMode`) EXCEPT `smartAuto`, which is only
written on final Apply (step 2) from `#sbAutoToggle`'s state. Entering step 1 loads current
values for the active mode.

**Step 2 — preview & apply.** On `Preview bracket`: show step 2 in loading state
(`Analyzing your recent games…`), run fetch + compute WITHOUT applying, then render:
1. Section title `Your bracket — {Mode}` (same style as `.sb-title`).
2. The rail visual (reuse the home card's `.sb-track`/`.sb-dot`/`.sb-rail-labels` markup
   and CSS verbatim — same classes, ids suffixed `Prev` e.g. `#sbDotPrev`).
3. ALL reason lines (`.sb-reasons`, not capped at 4 here).
4. Buttons: full-width primary `#sbApplyBtn` `.big-btn` `Apply bracket`; below it a
   `.text-link-btn` `#sbAdjustBtn` `Adjust settings` → back to step 1.
5. Error state: `Couldn't fetch your games. Check the username and try again.` (warn tone)
   + the two buttons become `Retry` (re-runs preview) and `Adjust settings`.
6. Insufficient-data results (`ok:false`) render normally — rail from ±fallback + the
   "Only {n} rated…" reason — and Apply still works.

On `Apply bracket`: persist via the existing apply path (`applySmartResult` — writes
`stopLoss_${mode}`, `targetRating_${mode}`, `smartTrailingDist_${mode}`, caches to
`smartBracketLast:…`, refreshes the content tab) but with `smartAuto` set from
`#sbAutoToggle` (NOT force-true); flash `✅ Applied` on the button (~900ms), then navigate
to `#mainView` so the updated home card is immediately visible.

### C3. popup.js refactor
- Split the current `runSmartBracket` into `computeBracketForMode(mode)` (fetch + goal read
  + `computeSmartBracket` → result, no side effects) and the existing `applySmartResult`.
  Home-card auto path (`checkConnection` → `updateSmartBracketCardForMode`) and the card's
  `↻` keep compute+apply behavior unchanged.
- Remove the `applySmartBtn`/`smartRangeInput`/`smartAutoToggle`/`smartTrailingToggle`/
  `eloGoalInput`/`eloGoalClearBtn` element refs and handlers (ids no longer exist); remove
  `applyManualBracket` (manual mode is now just "auto off": the bracket applies once via
  the flow; `Manual ±{r}` status shows only for legacy users who had smartAuto off with no
  computed cache). Ensure no dangling references (`node --check`).
- Mode switch additionally refreshes `#sbEntryStatus`, and — if `#smartSetupView` is open —
  reloads step-1 values for the new mode.

### C4. Global tooltip fix (all remaining `?` marks: username, cooldown, etc.)
The bug: `.tooltip:hover::after` uses `position: fixed` with no `top`, so the tooltip
inherits the icon's static Y position inside the scrollable `#settingsView` — anything
scrolled far enough renders at/below the popup's bottom edge (popup.css:781-813).
Fix — replace the `::after` mechanism with one shared, JS-positioned element:
- Remove the `.tooltip:hover::after` rule entirely (keep the `?` badge styles + hover color).
- popup.js: create `<div id="egTooltip">` appended to `document.body`:
  `position: fixed; left: 14px; right: 14px; z-index: 10000;` + the same visual style the
  `::after` had (background `#14130f`, border `var(--eg-line-2)`, radius `var(--eg-r-1)`,
  font 11px, padding 10px 12px, shadow `var(--eg-sh-3)`); hidden by default.
- Event delegation on `document`: `mouseover` on a `.tooltip[data-text]` → set text, then
  position: below the icon (`rect.bottom + 8px`) unless that would overflow
  (`rect.bottom + tooltipHeight + 16 > innerHeight`), in which case above
  (`rect.top - tooltipHeight - 8`). `mouseout` + any `scroll` (capture) → hide.
- Works unchanged for every existing `.tooltip[data-text]` in the markup; no per-usage edits.

### C5. Acceptance (Part C — see also Part D)
- Settings shows exactly one smart-bracket row; no toggles/goal group in the settings list.
- Full flow works: Set up → step 1 → Preview → step 2 (rail + reasons) → Apply →
  lands on home view with the card updated; Back behaves per step.
- Free user: entry button `Pro` → paywall; setup view unreachable.
- Hovering any remaining `?` (e.g. username, cooldown) shows the tooltip adjacent to the
  icon, fully inside the 320×520 viewport, including for controls at the bottom of a
  scrolled settings view.
- `node --check popup.js` passes; no references to removed element ids remain.

---

## Part D — Explanation copy v2 + rail clarity
**Supersedes Part A's "Reason lines" templates and the rail-label markup from Part B/C.**
User feedback: the green dot's meaning was unclear, and the reason lines read as a raw
stats dump. Principle for all copy: each line states WHAT THE BRACKET DOES FOR THE USER
(the "why"), with the personal stat as a supporting clause. Human units — "losses/wins of
room", never bare point-gaps as the lead. All strings below are FINAL copy.

### D1. Rail clarity (home card AND step-2 preview — same classes, `Prev` ids)
- Add a "you" marker above the dot: `<div class="sb-you" id="sbYou">You · {rating}</div>`
  (10px, weight 700, color var(--eg-green-bright), `position: absolute;
  transform: translateX(-50%); bottom: calc(100% + 4px);` inside `.sb-track`'s positioning
  context — give the track `margin-top: 22px` to make room). Its `left` uses the SAME
  percentage as the dot but clamped 12–88% so it never collides with the card edges.
- Rail end labels gain words: left `🛑 Floor <b>{floor}</b>`, right
  `Target <b>{ceiling}</b> 🏆`. REMOVE the center current-rating span from the label row
  (`#sbCurrentVal` / `#sbCurrentValPrev`) — the you-marker replaces it. The `<b>` values
  keep tabular-nums; the words "Floor"/"Target" render at 10px, color var(--eg-text-3).

### D2. Reason templates v2 (engine `lib/smart-bracket.js` — replaces Part A section)
New derived value: `kLosses = max(1, round(floorGapFinal / avgLossPts))` where
`floorGapFinal = currentRating - floor` (post-adjustments).
Emit order unchanged: tilt → floor → ceiling → plateau → trend → goal → give-back.
Home card still shows the first 4; step-2 preview shows all.

1. Tilt streak (warn, 📛): `{k} straight losses — floor pulled in to stop the bleed.`
   Tilt by net drop (warn, 📛): `Tough session (−{n} pts) — floor pulled in to stop the bleed.`
2. Floor, normal (info, 🛡️): `Room for ~{kLosses} losses, then EloGuard steps in — bad nights stay small.`
   Floor when tilt override is binding (info, 🛡️): `Tight floor until the streak turns.`
3. Ceiling (info, 🏆): `Hit {ceiling} and you're up — a nudge to bank the win.`
4. Plateau (info, ⚖️): `Stuck {lo}–{hi} for {w} weeks — clear {hi} and it's a real breakout.`
5. Trend, rising-form headroom applied (good, 📈): `On a climb (+{s}/wk) — ceiling raised so the run can breathe.`
   Trend up without headroom, slope >= 3 (good, 📈): `Trending up (+{s}/wk) — keep it rolling.`
   Trend down, slope <= -3 (warn, 📉): `Sliding {s}/wk — floor kept close so a dip can't spiral.`
   (|slope| < 3: no trend line.)
6. Goal reached (good, 🎯): `Goal {t} reached — set a new one in settings.`
   Goal with etaWeeks 1..52 (good, 🎯): `{t} is ~{w} weeks away at this pace.`
   Goal otherwise (info, 🎯): `Goal {t}: stalled for now — bracket guards what you've banked.`
7. Give-back active (info, 🔒): `Protecting the +{n} pts gained since you set your goal.`
8. Insufficient data, ok:false only (info, ℹ️): `Too few recent {mode} games to read your form — using ±{r} for now.`

Unicode: minus U+2212 in `−{n}`; em-dash U+2014 everywhere a `—` appears; en-dash U+2013
in `{lo}–{hi}`. Negative slope in item 5 renders as the JS number (ASCII hyphen).

### D3. Tests
Update `tests/smart-bracket.test.js` exact-string assertions to the D2 templates (take the
strings from THIS spec, not from engine output). Add one assertion that the floor line's
`~{kLosses}` equals `max(1, round((currentRating - floor)/avgLossPts))` for a fixture where
the min-room clamp binds (small typicalDrawdown), since that clamp was exactly the case the
old copy explained incoherently.

### D4. Acceptance
- All engine tests pass with the new strings; reason `icon`/`tone` fields match D2.
- Home card and step-2 preview both show the you-marker and Floor/Target words; no center
  rating span remains; marker never overlaps the card edges at dot extremes (3%/97%).
- Reason lines wrap to at most 2 lines at 320px width without overflow.

---

## Part E — Conversational explanations with provenance (copy v3)
**Supersedes Part D's D2 templates.** User feedback on v2: still too robotic, kill the
dash-separated fragments, speak to the user ("you/your"), and every line must explain WHY
the floor/ceiling landed on its exact value. v3 principle: each line is a full English
sentence (or two) of the form "[what we saw in your games], so your floor/ceiling is set
to {value}". No em-dashes, no minus signs anywhere (use absolute values in prose:
"sliding about 12 points a week"). All strings final.

### E1. Provenance tracking (engine)
The engine must know which rule DETERMINED the final floor and ceiling:
- `floorSource`: `'tilt'` | `'giveback'` | `'plateau'` | `'swings'` — the rule whose
  candidate equals the final floor (after all max() applications and safety clamps).
  When candidates tie, attribute by priority tilt > giveback > plateau > swings.
- `ceilingSource`: `'goal'` (goal target or milestone set the final value) | `'climb'`
  (rising-form headroom applied and nothing later overrode it) | `'plateau'` | `'swings'`.
  Ties: goal > climb > plateau > swings. If the step-8 safety clamp raised the ceiling
  past every candidate, source is `'swings'`.
Expose both in `stats` (additive, non-breaking).

### E2. Templates v3
Exactly ONE floor line and ONE ceiling line per result, chosen by provenance. Values in
prose: `{floor}`/`{ceiling}` final integers; `{k}` = kLosses; `{n}`,`{p}`,`{s}`,`{w}`
rounded absolute values; `{t}` goal target; `{lo}`/`{hi}` plateau band; `{r}` manualRange;
`{mode}` time format.

Floor line (first):
- floorSource tilt, streak trigger (warn, 📛):
  `You've dropped {k} games in a row, so your floor is pulled up to {floor} to stop the bleed early.`
  (here {k} = the loss streak length, not kLosses)
- floorSource tilt, net-drop trigger (warn, 📛):
  `This session has cost you {n} points, so your floor is pulled up to {floor} to stop the bleed early.`
- floorSource giveback (info, 🔒):
  `You've climbed {p} points since setting your goal, so your floor is set to {floor} to protect most of it.`
- floorSource swings (info, 🛡️):
  `Your floor is set to {floor}. That gives you room for about {k} losses before EloGuard steps in.`
- floorSource plateau: no standalone floor line; the plateau line (below) covers it.

Ceiling line (second):
- ceilingSource goal (info, 🎯):
  `Your target {ceiling} is the next milestone on the way to your {t} goal.`
  (If final ceiling === goal.target exactly: `Your target is {ceiling}, your goal. Hit it and celebrate.`)
- ceilingSource climb (good, 📈):
  `You're climbing fast at about {s} points a week, so your target gets extra headroom at {ceiling}.`
- ceilingSource swings (info, 🏆):
  `Your winning runs usually peak near {ceiling}, so that's your target. Hit it and bank the win.`
- ceilingSource plateau: covered by the plateau line.

Plateau line (⚖️, info) — emitted when plateau detected AND it determined the floor
and/or ceiling; replaces the covered side's line(s):
`You've been stuck between {lo} and {hi} for {w} weeks, so your bracket hugs that range. Clearing {hi} would be a real breakout.`
(If plateau detected but neither side bound by it, emit nothing extra.)

Trend line (third, optional) — only when NO tilt line and NO climb ceiling line shown,
and |slopePerWeek| >= 3:
- up (good, 📈): `You're gaining about {s} points a week. Keep it rolling.`
- down (warn, 📉): `You're sliding about {s} points a week, so the floor is there to catch it before it spirals.`

Goal line (fourth) — when a goal is set:
- reached (good, 🎯): `You've already hit your {t} goal. Time to set a new one in settings.`
- etaWeeks 1..52 (good, 🎯): `At this pace you'll hit your {t} goal in about {w} weeks.`
- stalled (info, 🎯): `Your {t} goal has stalled for now. Your bracket protects what you've already banked.`
  SUPPRESSED when the giveback floor line is shown (it already says this).

Insufficient data (ok:false, info, ℹ️) — sole line besides nothing else changing:
`Only {n} recent {mode} games is too few to read your form, so your bracket uses ±{r} for now.`

Emit order: floor → ceiling → plateau → trend → goal. Home card caps at 4 (unchanged);
step-2 preview shows all.

### E3. Tests
Update all string assertions to E2 (strings from THIS spec). Keep a kLosses-derivation
assertion on the swings floor line. Add provenance cases: (a) milestone-bound ceiling →
goal line variant; (b) plateau binding both sides → plateau line present, no swings
floor/ceiling lines; (c) giveback-bound floor → 🔒 line and stalled-goal suppression;
(d) tilt line includes the final floor value. Verify NO reason text contains "—", "–",
or "−" (add a blanket assertion iterating every emitted reason across all fixtures).

### E4. Acceptance
- 18+ tests pass; blanket no-dash assertion passes.
- Sentences read as normal English; every floor/ceiling line contains its final value.

---

## Part F — Copy v4: one sentence, two lines, no emojis, cache versioning
**Supersedes Part E's E2 templates and the card's reason rendering.** User feedback:
explanations must be at most 1–2 sentences total on the home card, no dash characters
ever (v3 already complies; a stale render cache showed v2 strings), and far fewer emojis.

### F1. Templates v4 (engine) — every line exactly ONE sentence
Same provenance selection rules as Part E (E1 unchanged). Replace the strings:

Floor line:
- tilt streak (warn): `You've dropped {k} games in a row, so your floor is pulled up to {floor} to stop the bleed early.`
- tilt net (warn): `This session has cost you {n} points, so your floor is pulled up to {floor} to stop the bleed early.`
- giveback (info): `You've climbed {p} points since setting your goal, so your floor of {floor} protects most of it.`
- swings (info): `Your floor of {floor} gives you room for about {k} losses before EloGuard steps in.`

Ceiling line:
- goal milestone (info): `Your target {ceiling} is the next milestone on the way to your {t} goal.`
- goal exact (info): `Your target is {ceiling} because that's your goal.`
- climb (good): `You're climbing about {s} points a week, so your target gets extra headroom at {ceiling}.`
- swings (info): `Your winning runs usually peak near {ceiling}, so that's where your target sits.`

Plateau combined (info): `You've been stuck between {lo} and {hi} for {w} weeks, so your bracket hugs that range.`

Trend (same show conditions as E2):
- up (good): `You're gaining about {s} points a week.`
- down (warn): `You're sliding about {s} points a week, so the floor is there to catch it before it spirals.`

Goal:
- reached (good): `You've already hit your {t} goal, time to set a new one in settings.`
- eta (good): `At this pace you'll hit your {t} goal in about {w} {week|weeks}.` (singular when w === 1)
- stalled (info): `Your {t} goal has stalled for now.` (still suppressed when giveback floor line shows)

Insufficient (info): `Only {n} recent {mode} games is too few to read your form, so your bracket uses ±{r} for now.`

Engine keeps emitting `{icon, text, tone}` (icons unchanged in data; UI stops rendering
them). Add `copyVersion: 4` to the result object (top level, additive).

### F2. Rendering (popup)
- HOME CARD: render only the FIRST TWO reasons, text only (no icon), tone colors kept.
- STEP-2 PREVIEW: all reasons, text only (no icons).
- Rail labels lose their emojis in BOTH places: `Floor <b>{floor}</b>` and
  `Target <b>{ceiling}</b>` (colors/weights unchanged). The card title keeps its single ⚡.
- CACHE VERSIONING: when reading `smartBracketLast:…`, treat a cached result whose
  `copyVersion` !== the engine's current version (export `COPY_VERSION` from the module)
  as stale → recompute instead of rendering it. This guarantees no outdated copy ever
  renders after an update.

### F3. Tests
- Update all string assertions to F1; keep provenance cases and the kLosses assertion.
- Pluralization: eta fixture with w === 1 asserts `about 1 week` (no trailing s).
- Extend the blanket forbidden-character assertion to: U+2014, U+2013, U+2212, and `~`.
- Add: every emitted reason text contains exactly one `.` (i.e., is a single sentence).
- Assert `result.copyVersion === COPY_VERSION` and both are exported/consistent.

---

## Part G — Settings entry row v2
**Supersedes C1's status strings and row layout.** User feedback: the entry row read as
cryptic shorthand ("Auto · trailing on · goal 2500") and the layout was ragged.

### G1. Status copy (final; plain sentences, no separators, no "trailing" mention)
Base state (pick one):
- cache exists, smartAuto true: `On, updating automatically.`
- cache exists, smartAuto false: `On, not auto-updating.`
- legacy manual (no cache, stopLoss set, smartAuto false): `Fixed range of ±{r}.`
- otherwise: `Not set up yet.`
Goal suffix, appended to any base EXCEPT "Not set up yet." when the active mode has a
goal: ` Aiming for {t}.`
Free (not Pro) users always see: `Sets your floor and ceiling from your recent games.`
(button label `Pro`, unchanged behavior).

### G2. Layout
Within the existing `.input-group.smart-bracket-group`:
- Label row unchanged (`⚡ Smart Bracket` + PRO badge), but margin below reduced to 6px.
- `.sb-entry-row`: `display: flex; align-items: center; gap: 10px;`
  `#sbEntryStatus`: `flex: 1; font-size: 12px; line-height: 1.35; color: var(--eg-text-2);`
  wraps to two lines max naturally; button `flex: 0 0 auto`, vertically centered.

### G3. Acceptance
Status shows the correct string for each of the five states and updates on mode switch
and after apply; no "·" characters anywhere in the row; layout has no dead vertical gap
between label and row at 320px.

---

## Part H — Entry row v3: toggle + gear
**Supersedes Part G entirely.** User wants the row to match the extension's toggle-row
language: one switch plus a small manage button. No status text.

### H1. Markup (replaces the entry row contents)
```html
<div class="input-group smart-bracket-group">
  <div class="sb-entry-row">
    <span class="sb-entry-label">⚡ Smart Bracket <span class="pro-inline-badge">Pro</span></span>
    <button id="smartSetupBtn" class="icon-btn sb-gear-btn" title="Smart Bracket settings">⚙️</button>
    <label class="switch"><input type="checkbox" id="smartBracketToggle"><span class="slider"></span></label>
  </div>
</div>
```
`#sbEntryStatus` is REMOVED. CSS: `.sb-entry-row { display:flex; align-items:center;
gap:10px; }`, `.sb-entry-label { flex:1; font-size:12.5px; font-weight:500;
color: var(--eg-text); }` (visually consistent with `.zen-label`), `.sb-gear-btn` compact
(existing `.icon-btn` base, padding trimmed to fit the row).

### H2. Behavior
- Toggle checked = `smartAuto === true`. It is the feature's auto-update switch.
- Toggle ON:
  - Free user: revert the toggle, `openBillingForFeature(SMART_BRACKET_FEATURE)`.
  - Pro, never configured for the active mode (no version-valid cache AND no
    `smartTrailingDist_${mode}`): open the setup flow at step 1 with an internal
    `pendingAutoEnable` flag; on flow Apply → `smartAuto = true` (toggle stays on);
    leaving the flow without applying → revert the toggle, `smartAuto` untouched.
  - Pro, previously configured: set `smartAuto = true`, silent recompute+apply for the
    active mode (existing runSmartBracket auto path).
- Toggle OFF: `smartAuto = false`; the last applied floor/ceiling stay as-is.
- Gear: Pro → open the setup flow step 1 (no pendingAutoEnable); free → paywall.
- The step-1 "Keep bracket up to date" toggle row is REMOVED from the flow (the entry
  toggle is now the single source of that state). Flow Apply no longer touches
  `smartAuto` except in the `pendingAutoEnable` case above. Step 1 keeps: intro, goal,
  trailing, fallback range, Preview button.
- Free-user styling: toggle disabled + lock dim on the row; gear stays clickable (paywall).
- `refreshEntryStatus` becomes `refreshEntryUi`: sets toggle checked/disabled and lock
  styling only. Mode switch re-runs it (cache/config checks are per-mode for the
  first-time-vs-configured decision; the checked state itself is the global smartAuto).

### H3. Acceptance
Row renders as: label left, gear + switch right, single line, no status text. All toggle
paths above work; step 1 no longer shows an auto toggle; node --check passes; no
references to sbEntryStatus/sbAutoToggle remain.

### H4. Amendment: unify on the owner's master-switch model
The repo owner hand-added a home-card master toggle `#smartBracketToggle` bound to
`smartBracketEnabled` (only `=== false` means off; apply sets it true). That model wins.
- ONE concept: Smart Bracket on/off. `smartAuto` is deprecated: remove its reads/writes;
  the silent recompute path is gated on `smartBracketEnabled !== false` (plus Pro +
  configured) instead. No "on but not auto-updating" state exists anymore.
- Settings entry-row switch id: `smartBracketSettingsToggle` (NOT smartBracketToggle —
  that id stays on the owner's home-card switch). Both switches mirror the same
  `smartBracketEnabled` state: changing either updates storage, the other switch, and the
  card. Same H1 row layout otherwise (label + gear + switch).
- Settings toggle checked iff `smartBracketEnabled !== false` AND the active mode is
  configured (version-valid cache or `smartTrailingDist_${mode}`). Flipping it ON when
  unconfigured opens the flow with `pendingAutoEnable` (H2 unchanged); Apply already sets
  `smartBracketEnabled = true` via the owner's applySmartResult edit. Back-out reverts.
  Flipping OFF writes `smartBracketEnabled = false` (both switches uncheck).
- Legacy `smartAuto` values in storage are ignored (no migration needed; enabled-ness is
  governed by smartBracketEnabled + configured state).
- H3 acceptance holds with `sbAutoToggle`/`refreshEntryStatus`/`sbEntryStatus` gone and
  zero remaining `smartAuto` references in popup.js.

---

## Part I — SWB-TPR performance layer
Adds an opponent-strength signal to the engine: a Surprise-Weighted Bayesian performance
rating (MAP Bradley–Terry with Gaussian prior), owner's formula adapted for online data.
Engine + tests only; no popup changes (reason lines flow through the existing renderer).
**Bump `COPY_VERSION` to 5** (new reason strings ship).

### I1. Data
`normalizeArchiveGames` adds `opp: number|null` to each Game: the OTHER side's `rating`
(null if absent/invalid). Additive; existing fields unchanged.

### I2. computePerformance(games, { currentRating, nowSec }) — internal, pure
- Valid games: `opp` finite. `S`: win 1, draw 0.5, loss 0.
- Recency weight: `w_i = 0.5^((nowSec - end_i) / (21*86400))` (21-day half-life).
- Prior: `R0 = games[0].rating` (window-start anchor, NOT currentRating — avoids
  double-counting), `sigma0 = 200`.
- `k = ln(10)/400`; `E_i(R) = 1/(1+10^((opp_i - R)/400))`.
- MAP by Newton: `g(R) = k*Σ w_i(S_i - E_i(R)) - (R - R0)/sigma0²`,
  `H(R) = -k²*Σ w_i*E_i(R)(1-E_i(R)) - 1/sigma0²` (H < 0 always). Start `R = R0`,
  iterate `R -= g/H`, clamp each iterate to `[R0-800, R0+800]`, stop at `|g/H| < 0.005`
  or 50 iterations. Deterministic; no NaN for any input (guard empty sums).
- `sd = sqrt(-1/H(R̂))` (Laplace). `perf = round(R̂)`.
- `ess = Σ w_i` over valid games; `gamesWithOpp` = count.
- GATE: return `null` unless `gamesWithOpp >= 10 && ess >= 12`.
- `probAboveCurrent = Φ((R̂ - currentRating)/sd)` via the Abramowitz–Stegun 7.1.26 erf
  approximation (deterministic).
- Expose in `stats.performance`: `{ perf, sd, ci68: [perf-round(sd), perf+round(sd)],
  ci95: [perf-round(2*sd), perf+round(2*sd)], ess (1 decimal), gamesWithOpp,
  windowStartRating: R0, probAboveCurrent (2 decimals), sessionSurprise }` or `null`.

### I3. Bracket integration (only when performance layer is non-null)
Signal strength: UNDERRATED iff `perf - sd > currentRating + 15`; OVERRATED iff
`perf + sd < currentRating - 15`.
- Step 3.5 (after tilt, before plateau) — OVERRATED floor snug: identical expression to
  the tilt floor as implemented (mode-scaled):
  `floor = max(floor, currentRating - max(round(1.5*modeScale*avgLossPts), round(15*modeScale)))`.
  floorSource priority becomes: tilt > giveback > performance > plateau > swings.
- Step 5.5 (after climb, before goal) — UNDERRATED ceiling boost: the perf-delta term is
  real rating points (unscaled); only the absolute clamp bounds are mode-scaled:
  `ceiling = max(ceiling, currentRating + clamp(round(0.6*(perf - currentRating)), round(12*modeScale), round(80*modeScale)))`.
  ceilingSource priority becomes: goal > performance > climb > plateau > swings.
- SURPRISE TILT REFINEMENT. `sessionSurprise = Σ (S_i - E_i(currentRating))` over the most
  recent session's valid-opp games (null if < 3 such games).
  (a) Suppression: if tilt fired via the STREAK rule and `sessionSurprise !== null` and
  `sessionSurprise > -0.8`, tilt is cancelled (losses to much stronger opponents are not
  tilt). The net-drop rule is never suppressed.
  (b) Enhancement: if tilt did NOT fire, the latest session ended within 12h, it has
  >= 4 valid-opp games, and `sessionSurprise <= -1.5`, tilt fires with trigger
  `'surprise'`.
- Plateau breakout: if plateau line would be emitted AND `perf - sd > plateau.high`,
  use the breakout variant instead of the standard plateau line.
- Goal/ETA math unchanged. Final safety clamps (step 8) unchanged and still last.

### I4. Reason lines (Part F rules apply: one sentence, no dashes/minus/~, values inline)
- floorSource performance (warn): `Your recent play sits closer to {perf} than your {current} rating, so your floor stays close at {floor}.`
- ceilingSource performance (good): `You've been playing at about {perf} lately, so your target gets extra room at {ceiling}.`
- tilt trigger 'surprise' (warn): `You've been losing games you'd usually win, so your floor is pulled up to {floor} to stop the bleed early.`
- plateau breakout variant (good): `You've been stuck between {lo} and {hi} for {w} weeks, but you're performing at about {perf}, so a breakout looks close.`
Emit order unchanged (floor → ceiling → plateau → trend → goal).

### I5. Tests
- normalizeArchiveGames extracts `opp` from the correct (other) side; null when missing.
- MAP sanity: 50% score vs equal-rated opposition → perf ≈ R0 (within 1); all-win
  fixture stays finite and increases with more games; prior dominates tiny samples.
- Gate: 9 valid-opp games → performance null; stats.performance null propagates (no
  perf reasons, no tilt refinement).
- Underrated fixture (flat own rating, wins vs stronger opps) → ceilingSource
  'performance', boosted ceiling, exact reason string.
- Overrated fixture → floorSource 'performance', exact string.
- Tilt suppression: 3 straight losses to opponents ~200 above, sessionSurprise > -0.8 →
  no tilt; swings floor line shows.
- Surprise tilt: recent session, no 3-streak, >= 4 games losing to opponents ~150 below →
  tilt fires with the 'surprise' line.
- Plateau breakout variant fixture; exact string.
- copyVersion === COPY_VERSION === 5 on both ok paths.
- Existing blanket tests (forbidden chars, single sentence, determinism) still pass and
  cover the new strings.

---

## Part J — Performance stats view (popup)
Replaces the popup header Stats button's behavior (site-overlay injection) with a new
in-popup stats view centered on SWB-TPR performance. The site Strength Profile overlay
in content.js is untouched (still reachable from the review panel header). Design goals:
visually consistent with the extension, minimal labels, NO explanatory microcopy —
labels and data only. Chess.com-stats-page spirit at 320px.

### J1. Engine additions (lib/smart-bracket.js + tests) — all additive
- Game gains `rated: boolean`.
- `normalizeArchiveGames(archiveGames, username, timeClass, opts = {})`:
  `opts.ratedFilter`: `'rated'` (default, current behavior) | `'unrated'` | `'both'`.
  `rules === 'chess'` and `time_class` filters always apply.
- `fetchRecentGames(opts)`: new `opts.ratedFilter` (passed through) and `opts.monthsCap`
  (default 3, the existing hard cap made configurable).
- EXPORT `computePerformance(games, { currentRating, nowSec })` on the api object —
  returns the same object shape as `stats.performance` or null; `currentRating` becomes
  optional (`probAboveCurrent: null` when absent).
- NEW `computePerformanceSeries(games, { windowSize = 20 })`: for each game index i,
  window = the up-to-`windowSize` games ending at i; compute the MAP with per-window
  `nowSec = games[i].end` (recency relative to the window's end) and `R0 = window[0].rating`;
  emit `{ end: games[i].end, perf, sd }` when the window has `gamesWithOpp >= 10 &&
  ess >= 8`, else skip the point. Pure and deterministic.
- `computeSmartBracket` unchanged (defaults keep the bracket rated-only). COPY_VERSION
  unchanged (no reason strings change).
- Tests: ratedFilter modes incl. `rated` flag on games; monthsCap passthrough with a
  stubbed fetchImpl; exported computePerformance returns the same values as
  `computeSmartBracket(...).stats.performance` on an identical rated fixture (same
  nowSec); series: shape, per-window gating (points appear only once 10 valid-opp games
  accumulate), determinism, and last-point consistency with computePerformance when
  windowSize >= games.length and nowSec = last game end.

### J2. Stats view (popup.html / popup.css / popup.js)
New top-level view `#statsView` (sibling of mainView/settingsView/smartSetupView/
sbHowView, same `.hidden` toggling and the scrollable container styles). Header matches
settings: `<button id="stxBackBtn" class="icon-btn">← Back</button><h2>Stats</h2>`.
Back → mainView.

Controls row (directly under header): two selects side by side, both styled `.mode-select`
(flex row, gap 8px, centered):
- `#stxMode`: Blitz / Rapid / Bullet (initialized to activeMode on open).
- `#stxRated`: options `Rated` (value `rated`) / `Casual` (`unrated`) /
  `All games` (`both`, default).

Cards (reuse the `.sb-card` visual language: surface, line border, r-2, same paddings):
1. **Performance Rating card**: head row = `PERFORMANCE RATING` (`.sb-title` style) left, hero value
   right (16px, 800, tabular): the current SWB-TPR `perf`. Hero color:
   `var(--eg-green-bright)` when `perf >= rating + 15`, `var(--eg-red)` when
   `perf <= rating - 15`, else `var(--eg-text)`. Below: SVG chart `#stxPerfChart`
   (rolling series). Under the chart one data line (11px, `--eg-text-2`):
   `Likely range {ci68lo} to {ci68hi}`. Not-enough-data state: single line
   `Not enough games.` replaces chart + range.
2. **Rating card**: head `RATING` + current rating (last rated game's rating; fallback
   to the live fetched rating when the selected mode is the active one). SVG chart
   `#stxRatingChart` from rated games' post-game ratings. When `#stxRated` = Casual:
   the chart area shows the single line `Rated games only.`
3. **Record row**: four cells (flex, equal width): value (16px, 700, tabular) over label
   (10px, `--eg-text-3`): Wins (value `--eg-green-bright`) / Draws (`--eg-text-2`) /
   Losses (`--eg-red`) / Games (`--eg-text`). Counts from the filtered game set.

Charts — hand-rolled inline SVG, no libraries:
`renderStxChart(svgEl, points, { stroke })` with `points = [{ t: epochSec, v: number }]`:
viewBox `0 0 264 96`, 6px inner padding, y-domain = data min/max padded 8% (guard the
flat-series case: pad ±10 when min === max); polyline stroke-width 2 in the given color;
closed area path beneath at fill-opacity 0.10 same color; y max label top-left and y min
label bottom-left (10px, `--eg-text-3`, tabular, inside the chart); x labels: first and
last point dates bottom-left/bottom-right (9px, `--eg-text-3`, format `Jun 12` via a
deterministic month-name array from the epoch). Performance stroke
`var(--eg-green-bright)`; rating stroke `var(--eg-blue)`.

Data flow (popup.js):
- Rewire `#statsBtn`: REMOVE the site-injection handler entirely (and
  `flashStatsUnavailable` if it becomes unused) → `openStatsView()`.
- `openStatsView()`: hide other views, show `#statsView`, set `#stxMode` to activeMode,
  `loadStats()`.
- `loadStats()`: no username → single line `Connect your username first.`; else fetch via
  `engine.fetchRecentGames({ username, timeClass, ratedFilter, maxGames: 50000,
  maxDays: requestedDays, monthsCap: ceil(requestedDays / 28) + 1 })`, then: hero + range from `engine.computePerformance`
  (currentRating = rating card's value), perf series from
  `engine.computePerformanceSeries`, rating series from rated games, record from the
  filtered set. In-memory cache per `${username}|${mode}|${filter}` for the popup
  session; select changes re-render from cache or fetch.
- States: loading = single centered `Loading…` line (`--eg-text-3`); fetch error =
  `Couldn't load games.` + a `Retry` `.text-link-btn`.
- Not Pro-gated (the old Stats button wasn't; the view is free).
- No forbidden characters in any string (no dashes, minus, `~`); ranges say `X to Y`.

### J3. Acceptance
- Engine: full suite green including new J1 tests; api exports computePerformance and
  computePerformanceSeries.
- Popup: `node --check popup.js`; view renders all states; both charts draw correctly for
  a normal fixture (spot-check numbers map into the viewBox); mode/filter changes
  re-render; no references to the removed injection handler remain; the review panel's
  in-page Strength Profile stays untouched (content.js not edited).

---

## Part K — Stats view: time periods + change deltas
Extends Part J. Popup-only (popup.html/css/js); no engine changes.

### K1. Period selector
A third `.mode-select` (`#stxPeriod`) sits beside mode and rated filters. Options are
`Last hour`, `Today`, `7 days`, `14 days`, `30 days`, `3 months`, `6 months`, and
`1 year`; default **30 days**. `Today` starts at local midnight, while numeric ranges are
rolling windows. The standard cache covers 90 days; selecting 6 months or 1 year expands
the mode/filter cache on demand. Periods within cached coverage filter client-side and
re-render instantly. Cache stays keyed `username|mode|filter`; period is render-time state.

### K2. Period-scoped rendering
All cards render from the period-filtered game set:
- Performance hero = `computePerformance(periodGames, ...)` (the existing gates apply —
  short periods that do not qualify show the existing `Not enough games.` state).
- Perf chart = the FULL-fetch `computePerformanceSeries` points filtered to
  `point.end` within the period (windows correctly look back past the period start).
- Rating hero/chart = rated games within the period. When the period has none, carry
  the newest known rated value from the wider cache (or the active mode's live rating)
  across the full period as a flat, unfilled line through today.
- Record row = period counts.

### K3. Delta chips
Next to each hero value (Performance and Rating cards), a signed change chip
(`span.stx-delta`, 12px, 700, tabular, margin-left 6px):
- Performance delta = last minus first perf-series point WITHIN the period
  (needs >= 2 points in period, else no chip).
- Rating delta = last minus first rated game's rating within the period (>= 2 rated
  games, else no chip).
- Format: ASCII sign: `+34` / `-21` / `0`. Color: positive `var(--eg-green-bright)`,
  negative `var(--eg-red)`, zero `var(--eg-text-3)`. NOTE: the ASCII `-` sign in these
  chips is intentional user-requested DATA formatting; the Part F forbidden-character
  rule continues to apply to sentence copy only (engine reason strings unchanged).
- Record row gets no chips (its counts are already period-scoped).

### K4. Acceptance
node --check popup.js; period switch re-renders without network activity; deltas match
hand-computed first/last values on a fixture; 7d with sparse data degrades to the
existing not-enough states; all three periods keep every existing state reachable.

---

## Part L — Stats charts: hover crosshair
Extends Part J/K. Popup-only (popup.js + minimal CSS). Both stats charts (they share
renderStxChart) get a hover crosshair:
- On pointer move over the chart SVG: map pointer x into viewBox coords
  (getBoundingClientRect scaling), snap to the NEAREST data point by x (linear scan is
  fine, <= 150 points), and show: a vertical guide line at the point's x (1px,
  rgba(255,255,255,0.18), full plot height), a highlight dot (r 3.5, fill var(--eg-bg-deep),
  stroke = the chart's stroke color, stroke-width 2), and a floating label group: rounded
  rect (fill #14130f, stroke var(--eg-line-2), rx 6, padding ~6x4) containing the value
  (11px, 700, var(--eg-text), tabular) above the point's date (9px, var(--eg-text-3),
  same `Jun 12` format as the axis labels).
- Label anchors above the dot; clamp within the viewBox and flip below the dot when the
  point is near the top, flip horizontal side near the left/right edges. All coordinates
  finite for every point incl. single-point series.
- Pointer leave hides the crosshair group. No crosshair when the series is empty.
- Implementation: renderStxChart keeps the scaled points (and formatted values/dates) on
  the svg element or in a closure; build the crosshair elements once per render (hidden),
  update positions on move (no per-move DOM creation). Use pointer events on the svg
  itself (a full-size transparent rect if needed for hit area).
- No new strings beyond the value/date already shown elsewhere.

Acceptance: node --check popup.js; simulated pointer math (viewBox mapping + nearest
point + clamping at both edges, top flip, single point) asserts finite in-bounds
coordinates; hovering causes zero re-fetch/re-render of the page (crosshair updates only).

---

## Part M — Smart Bracket seven-day performance window

The Smart Bracket's `Recent performance` signal is independent from the rated-game
history used for rating swings, trends, and session limits:

- Fetch rated and casual games together, then retain the latest 60 rated games for the
  existing bracket-history calculations.
- Pass the combined game set as `performanceGames`; `computeSmartBracket` filters this
  set to the rolling seven days ending at `nowSec` before computing performance.
- Expose `stats.performanceWindowDays = 7` and `stats.recentPerformanceGameCount`.
- When the seven-day set is empty, `stats.performance` is `null`, so no performance
  floor, ceiling, breakout, or surprise-tilt adjustment can apply.
- Label both Smart Bracket surfaces `Recent performance (last 7 days)`.
- Render an empty seven-day set as `No recent games` in red. A non-empty set that does
  not pass the performance sample gates continues to render `Building sample`.
- Bump `COPY_VERSION` to 6 so cached results without the new window metadata are ignored.

Acceptance: mixed rated/casual games inside seven days contribute to performance; games
older than seven days do not; an empty window produces no performance-driven bracket
source or reason; popup and engine syntax checks pass.

---

## Part M — Form-gated ceiling (performance holds the target honest)
User-reported flaw: with performance BELOW rating (e.g. perf 2376 vs rating 2401), the
goal milestone still stretched the ceiling to +49 (next multiple of 25 toward the goal).
The milestone rule predates the performance layer and never consulted it. Fix: the
ceiling may only be stretched when recent form supports it. Engine + tests only.
**Bump COPY_VERSION to 6.**

### M1. Milestone gating (replaces the Part A step-6 goal-ceiling rule's raise arm)
When `goal && goal.target > currentRating`:
- `allowMilestone = performance == null || performance.probAboveCurrent >= 0.4`
- `candidate = allowMilestone ? max(ceiling, milestone) : ceiling`
- `ceiling = min(goal.target, candidate)`
(The goal can still CAP the ceiling downward; it can no longer raise it when
probAboveCurrent < 0.4.)

### M2. Confident-overrated ceiling pull-in (new step 5.6, after 5.5, before goal)
When the existing OVERRATED gate fires (`perf + sd < currentRating - 15`):
`ceiling = min(ceiling, currentRating + max(round(0.7 * baseCeilGap), round(12*modeScale)))`
where `baseCeilGap` is the step-2 swings ceilGap before any adjustments. (Mutually
exclusive with the step-5.5 underrated boost.)

### M3. Provenance + reason line
New ceilingSource value `'perfHold'`, attributed when M2 lowered the ceiling OR M1
skipped a milestone that would otherwise have raised it (i.e. milestone > ceiling at the
gate). Priority: goal > perfHold > performance > climb > plateau > swings — but note
'goal' only attributes when the goal/milestone actually set the final value; a skipped
milestone attributes 'perfHold'.
Ceiling line for perfHold (info): `Your recent play is running below your rating, so your target stays close at {ceiling}.`
All other lines unchanged. Part F rules apply (one sentence, no dashes/minus/~).

### M4. Tests
- The user's scenario: goal 2500, rating ~2401, perf point estimate ~25 below rating with
  sd such that probAboveCurrent < 0.4 → ceiling NOT milestone-stretched, ceilingSource
  'perfHold', exact new string; same fixture with perf ABOVE rating → milestone applies
  as before (regression pair).
- probAboveCurrent exactly at/above 0.4 → milestone allowed (boundary).
- Confident OVERRATED → ceiling pulled to the M2 value AND floor snug both present;
  exactly one floor line + one ceiling line (perfHold) emit; strings comply with blanket
  tests.
- performance null → behavior identical to pre-Part-M (regression on existing fixtures —
  they must pass unmodified except the copyVersion bump).
- copyVersion === 6 both ok paths.

---

## Part N — Continuous form-scaled ceiling (supersedes M2)
User-reported: with perf below rating (P≈0.35), the ceiling still sat at the full
swings gap (+33 in rapid) because Part M only gated the milestone and the hard
overrated pull-in never fired. Two binary gates → one continuous rule. Engine + tests.
**Bump COPY_VERSION to 9** (owner hand-edits took it to 8).

### N1. Form factor
When `stats.performance` is non-null, let `p = performance.probAboveCurrent` and
`f = clamp((p - 0.30) / 0.25, 0, 1)`  (0 at p<=0.30, 1 at p>=0.55, linear between).
When performance is null, `f = 1` (behavior unchanged).

### N2. Application
- Immediately after step 2's base gaps: `minCeilGap = max(2*avgWinPts, round(12*modeScale))`
  (identical to step 2's existing lower bound); then
  `ceilGap = minCeilGap + f * (ceilGap - minCeilGap)` (no-op when f = 1).
- Step 5 rising-form headroom is multiplied by `f` (round after multiplying).
- REMOVE Part M2's confident-overrated 0.7 pull-in entirely — subsumed (confident
  overrated implies p well under 0.30, so the gap is already at minCeilGap).
- Part M1's milestone gate (p >= 0.4) unchanged. Step 5.5 underrated boost unchanged
  (requires UNDERRATED, i.e. high p). Plateau rule and final safety clamps unchanged.

### N3. Provenance + line
`ceilingSource 'perfHold'` now attributes when performance is non-null AND f < 1 AND the
scaled gap produced a lower pre-goal ceiling than the unscaled gap would have (track
with an explicit flag), OR the milestone skip from M3. Line unchanged:
`Your recent play is running below your rating, so your target stays close at {ceiling}.`

### N4. Tests
- User scenario (rapid, modeScale 0.7): swings gap well above minimum, p in (0.30, 0.40)
  → ceiling lands between minGap and full gap per the formula (hand-derive the expected
  integer in a test comment); ceilingSource 'perfHold'; string exact.
- p <= 0.30 → gap = minCeilGap exactly. p >= 0.55 → full gap (unchanged vs performance-null
  twin fixture). Boundary p = 0.55 and p = 0.30.
- Confident-overrated fixture (was M2's): ceiling = currentRating + minCeilGap now;
  update the old M2 expectation; floor snug unchanged.
- Climb headroom scaling: slope >= 10 fixture with low p → headroom scaled by f.
- Existing performance-null fixtures unchanged except copyVersion 9.

---

## Part O — Session bracket and long-term goal separation

Part O supersedes every earlier rule that lets an Elo goal change a bracket boundary.

- `floor` and `ceiling` describe only the current guarded session. Compute them from mode,
  recent swings, tilt, plateau, trend, and recent performance.
- A long-term goal must never cap, stretch, or otherwise change either boundary. Remove the
  milestone-ceiling and goal give-back-floor rules and their provenance/reason variants.
- Keep `result.goal` as progress metadata. Display `Long-term goal {target}` below the rail,
  separately from the session `Target` label, with reached/points-away context.
- Bump `COPY_VERSION` to 10 so cached goal-derived brackets cannot render or be applied.
- Regression coverage must compare identical histories with and without a goal and require
  identical floor, ceiling, provenance, and session-reason output. The reported rapid case with
  weak form and a 2450 goal must retain the performance-scaled session ceiling of 2415.
