<!-- USER-BROWSER-COMPUTER-POLICY -->
## Chrome plugin and Computer Use

- Chrome plugin use and Chrome browser control are allowed at will for the user's tasks; no separate request or permission is required.
- Computer Use (native desktop/app control) remains prohibited unless the user explicitly asks for it in the current prompt. Chrome plugin permission does not authorize Computer Use.
- Do not infer Computer Use permission from a task needing a GUI, an application or webpage being mentioned, an existing session, or permission in an earlier prompt. Use Chrome plugin tools, commands, scripts, APIs, connectors, or direct file operations where appropriate; if Computer Use is essential, explain the limitation and ask before invoking it.

Updated at the user's request on 2026-09-12.
<!-- /USER-BROWSER-COMPUTER-POLICY -->

<!-- USER-UI-DESIGN-POLICY -->
## UI and app design: standing user requirements

- Apply these requirements to all UI/app design work and all agents, in this repository and its delivery targets. Use the application's own visual language: inspect its current screens, colour/theme tokens, typography, spacing and reusable controls before designing. Do not invent a new palette or visual identity unless the user asks for it.
- Make interfaces simple, coherent and well organised around the user's tasks. Keep the default surface concise; remove filler, repeated explanations, implementation jargon and decorative panels that do not help the next action.
- Give every number a clear label, unit and scope. Explain percentages, probabilities, scores, sample sizes and estimates in plain language; distinguish an estimate from a confirmed fact, and missing data from zero. Keep detailed calculation/method copy off the default surface.
- Put short explanations behind a small, adjacent, hoverable question mark. Reuse the app's help component; support keyboard focus and touch as well as hover, with dismissible, viewport-bounded help. Prefer one or two short sentences. Keep essential errors, costs, destructive consequences and required decisions visible rather than hiding them in a tooltip.
- Make the immediate next action obvious and close to its item. Use explicit, state-appropriate verbs such as Import games, Import & prep, Open Prep or their domain equivalent. Separate acquiring data from opening already-ready content; expose progress, cancellation, failure and retry beside the action. Do not make users hunt through unrelated screens to begin their task.
- For a substantial new interface or redesign, map every affected surface and state first, then present three genuinely different SVG/Figma prototypes within the existing app style unless the user specifies another count or has already chosen a direction. Include setup, main views, details, settings, help, loading, empty, error, progress, cancellation and relevant confirmations, plus narrow/mobile layouts where applicable. Do not present one attractive main screen as the complete design.
- Make prototypes concrete, reviewable and editable; show them to the user and label invented example data. Honour the chosen design and subsequent feedback consistently across all affected surfaces. Once the user says to implement a direction, proceed without asking for the same approval again. Small fixes within an approved design do not require a fresh three-option exercise.
- Verify rendered layouts and the real interaction path, including action wiring, help behaviour and narrow widths. Fix overlap, clipping, unclear labels and state inconsistencies. Preserve active sessions, unsaved edits and existing data. Clearly distinguish prototype/source/test evidence from deployed or physical-device verification.

Adopted as cross-repository user guidance on 2026-09-08. Project-specific architecture and safety rules still apply; these requirements describe design and delivery, not authorization for unrelated actions.
<!-- /USER-UI-DESIGN-POLICY -->

# Repository guidance

## Milestone documentation

- Agents must update this `AGENTS.md` after every meaningful, verified milestone and include that update in the same milestone commit.
- Record concise, durable context: important behavior or architecture changes, decisions and their rationale, relevant tests or verification, deployment or runtime state, and material limitations or follow-up work.
- Update or replace stale guidance instead of accumulating contradictory history; keep notes factual and useful to future agents.
- Do not record secrets, credentials, personal data, raw transcripts, routine command logs, or transient debugging noise.


## Scope

These instructions apply to the entire repository unless a more specific `AGENTS.md` exists deeper in the tree.

## Working practices

- Read the README and existing build or test configuration before changing behavior.
- Keep changes focused and preserve unrelated user or agent work.
- Do not commit credentials, local machine configuration, generated caches, build outputs, or large runtime data unless the repository explicitly tracks them.
- Prefer maintainable source changes over edits to generated artifacts.

## Verification

- Run the smallest relevant tests, checks, or build for each change and report anything that could not be verified.
- Keep durable architecture, workflow, and deployment decisions in this file when they will help future work.

## Opponent risk pill

- Settings exposes `Show opponent risk pill`, saved immediately as the synced
  boolean `showOpponentRiskPill`. Missing values default to Off; only explicit
  `true` enables the pill and its hover details. Other guard settings are independent.
- While Off, the detector hides an existing pill, clears the visible-result
  feedback context and starts no new opponent analysis. Late success/error replies
  cannot render while disabled; re-enabling can use the existing result cache.
- Isolated Chromium checks passed for the default, saved on/off control, 320px
  layout, full content-script toggling and delayed-result suppression. Both scripts
  pass syntax checks. No live Chrome extension reload was performed: browser control
  blocks extension URLs. Existing loaded Chess.com pages need a reload to use this
  source; preserve active games when activating it.

## Git milestones

- At each meaningful working milestone, inspect the diff, stage only relevant files, commit with a clear message, and push to the configured remote.
- Do not rewrite shared history or force-push unless the user explicitly requests it.

## Enhanced focus refresh stability

- Focus refreshes must leave an element in place when it already has the intended slot and focus class. Even `appendChild` to the same parent disconnects/reconnects Chess.com's custom elements; repeating it restarts the board and clocks. Set captured-piece layout attributes only when their value changes, to avoid repeated component updates.
- `npm test` runs the complete content script in a small jsdom game fixture and checks native element lifecycle, clock ticks/turn changes, flip/input continuity, and restoration over repeated focus cycles. The regression fails on the old script with 108 unnecessary removals across 12 refresh cycles; the fix produces zero. No game or evaluation downloads are needed.
- The installed unpacked extension uses this checkout, but Chrome caches its content script until the extension is reloaded. After source updates, reload EloGuard and refresh a finished-game tab; avoid refreshing an active game. The existing content-version guard intentionally prevents popup reinjection from stacking another set of timers. Source tests pass; installed fixed-code verification was blocked by the browser URL policy for extension controls, so do not treat the source result as a live-runtime verification.

## Enhanced focus material rows

- Current Chess.com play pages render material in `.captured-pieces.player-row-pieces`; analysis/older pages use `wc-captured-pieces` or `.player-pieces`. Focus selects whole rows within the top/bottom player hosts so native captured-piece sprites and the material advantage score stay together and continue updating. Sidebar rows remain excluded.
- When Chess.com supplies a replacement row for a player, discard the superseded staged row and its restoration entry. Restoring it into the source host makes it alternate with the replacement in an observer loop. Exiting focus restores the current row to its original host.
- Seven `npm test` regressions cover both material formats, live score changes, replacement rows, sidebar exclusion, restoration, and board/clock stability. Full repaired source was also rendered on a separate, logged-out Chess.com computer page with test PGNs: both material rows, bottom `+1`, top `+3`, and exit/reentry passed. This used mocked extension storage in the in-app browser; the installed Chrome extension was not reloaded because Chrome control was unavailable. The installed unpacked path was verified as this checkout; reload EloGuard and refresh a finished-game tab to activate the fix.
