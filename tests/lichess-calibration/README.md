# Lichess large-sample calibration

Fits the EloGuard rating-estimation constants from the lichess open database
(https://database.lichess.org) - rated games carrying [%eval] server analysis,
with both players' ratings and exact time controls as ground truth.

1. npm install fzstd
2. node ingest.js   (streams the monthly dump, writes features.jsonl; edit URL_/limits)
3. node fit.js      (fits curves/Bayes layer, writes fitted_constants.json)
4. Bake constants into lib/review-core.js, then validate against the held-out
   chess.com sample: node ../validate_chesscom.js

The lichess->chess.com pool conversion layer comes from the chessgoals.com
rating-comparison survey (N~1300-2500 dual-platform players per pool).

## v3 pipeline (current)

ingest3.js adds: hashed player ids (multi-game slope fitting), [%clk] time-management
features, and raw move lists. fit3.js fits the 6-feature composite (accuracy, ACPL,
book depth, blunder rate, opening delta, fast/scramble rates) plus the EMPIRICAL
multi-game noise split from recurring players. depth_skew.js re-analyzes a sample
with the extension engine at d12 to fit the shallow-vs-deep correction.
fitted_constants.json is the fit output baked into lib/review-core.js.
