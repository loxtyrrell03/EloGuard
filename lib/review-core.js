// EloGuard Game Review core — pure analysis logic, no DOM.
// Loaded as a content script (globals) and unit-testable in Node via module.exports.
//
// The math, briefly:
//  * Engine evals (centipawns / mate) are converted to a win probability with the
//    logistic model published by lichess (fitted on millions of rated games):
//        winPct = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
//  * Per-move accuracy uses lichess's fitted exponential on the win% lost by the move:
//        acc = 103.1668 * exp(-0.04354 * drop) - 3.1669 (+1 leniency, clamped 0..100)
//  * Game accuracy is the average of a volatility-weighted mean (sharp, "hot" positions
//    count more) and a harmonic mean (punishes single large errors) — lichess's method.
//  * Move labels (brilliant/great/best/.../blunder) follow chess.com's taxonomy, driven
//    by win% drop buckets, MultiPV gap (only-move detection) and a static-exchange
//    (SEE) sacrifice detector for brilliancies.
//  * Estimated rating inverts "expected accuracy / expected ACPL by rating" curves
//    (anchored to published CAPS/ACPL-vs-Elo data, calibrated for rapid), adjusts for
//    time control and position sharpness, blends both estimates and shrinks toward the
//    population mean for short games. It never looks at anyone's actual rating.
(function () {
    const CoreChess = typeof Chess !== 'undefined'
        ? Chess
        : (typeof require === 'function' ? require('./chess.js').Chess : null);

    const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
    const CP_CEIL = 1000; // clamp evals to +/- 10 pawns for win% + ACPL

    const THRESHOLDS = {
        BEST_EPS: 0.6,          // win% band in which a move counts as "best"
        EXCELLENT: 2,
        GOOD: 5,
        INACCURACY: 10,
        MISTAKE: 20,
        GREAT_GAP: 12,          // pv1-pv2 win% gap that makes the best move "critical"
        BRILLIANT_MAX_DROP: 1.2,
        BRILLIANT_MAX_BEFORE: 96,
        BRILLIANT_MIN_AFTER: 42,
        BRILLIANT_MIN_LEGAL: 3,
        BRILLIANT_CHECK_MIN_LEGAL: 4,
        MISS_BEFORE: 80,
        MISS_MIN_DROP: 8,
        MISS_MIN_AFTER: 42,
        SACRIFICE_MIN: 2        // at least an exchange
    };

    const CLASS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'forced', 'inaccuracy', 'miss', 'mistake', 'blunder'];

    // Median game accuracy by LICHESS rating at T~600s (10+0) — fitted from
    // 6,458 reference sides of the lichess calibration sample. Note the flat
    // stretch around 1350-1750: accuracy barely discriminates there; ACPL does
    // the separating (which is why both curves feed the blend).
    // Entries above 2350 are EXTRAPOLATED (continuing the last fitted segment's
    // slope) — eval-annotated 2400+ reference games are scarce in the dumps.
    // Without the tail, exceptional games clamp at 2350 and become invisible.
    const ACC_ANCHORS = [
        [650, 65.3], [750, 70.3], [850, 72.7], [950, 72.8], [1050, 75.5], [1150, 76.6],
        [1250, 76.8], [1350, 79.5], [1450, 79.7], [1550, 80.4], [1650, 81.1], [1750, 81.2],
        [1850, 82.6], [1950, 83.1], [2050, 83.6], [2150, 85.2], [2250, 87.4], [2350, 88.7],
        [2550, 91.3], [2800, 94.3]
    ];
    // Median ACPL by LICHESS rating at T~600s — same fit (tail extrapolated).
    const ACPL_ANCHORS = [
        [650, 109.4], [750, 90.5], [850, 85.9], [950, 83.3], [1050, 76.7], [1150, 68.7],
        [1250, 66.6], [1350, 61.7], [1450, 59.8], [1550, 55.9], [1650, 54.6], [1750, 54.5],
        [1850, 51.8], [1950, 48], [2050, 45.8], [2150, 41.5], [2250, 35], [2350, 30.2],
        [2550, 23.5], [2800, 17.5]
    ];
    // --- time-control model -------------------------------------------------
    // Effective thinking time per game: T = base + 40 * increment (seconds).
    // This convention reproduces chess.com's own pool boundaries exactly:
    //   2|1 -> 160s bullet, 3|0 -> 180s blitz, 5|5 -> 500s blitz, 10|0 -> 600s rapid.
    //
    // ALL fitted constants below come from the lichess open-database calibration:
    // 15,253 rated games / 30,506 player-sides with server [%eval] analysis
    // (2026-06 dump, bin-balanced across 600-3100 and bullet/blitz/rapid) —
    // see tests/lichess-calibration/. The model estimates a LICHESS-scale rating
    // first, then converts to the chess.com pool of the game via the published
    // chessgoals.com dual-platform survey tables (N~1300-2500 players per pool).
    const TIME_CLASS_DEFAULT_SECONDS = { bullet: 60, blitz: 180, rapid: 600, classical: 7200 };

    // Fitted: accuracy shifts by +1.264 points per ln(T/600); ACPL by (T/600)^-0.080.
    const TIME_ACC_SLOPE = 1.264;
    const TIME_ACPL_EXP = 0.080;
    // Fitted: sharper games (higher avg volatility weight) depress measured
    // accuracy by ~5.22 points per volatility unit — compensated before inversion.
    const COMPLEXITY_COEF = 5.217;
    // Fitted residual per pool after the continuous time model (lichess scale).
    // (classical is unmeasured in the sample; held near rapid.)
    const CLASS_ADJUST = { bullet: 59, blitz: 4, rapid: -108, classical: -58 };

    // lichess -> chess.com conversion per pool (chessgoals.com survey anchors);
    // classical/daily uses the rapid table.
    const POOL_CONVERT = {
        bullet: [[975, 500], [1115, 800], [1770, 1500], [2000, 1800], [2195, 2000], [2490, 2300]],
        blitz: [[1030, 500], [1200, 800], [1500, 1500], [1800, 1800], [2100, 2000], [2400, 2300]],
        rapid: [[1205, 500], [1400, 800], [1930, 1500], [2085, 1800], [2185, 2000], [2400, 2300]],
        classical: [[1205, 500], [1400, 800], [1930, 1500], [2085, 1800], [2185, 2000], [2400, 2300]]
    };

    function lichessToChessCom(pool, lichessRating) {
        const table = POOL_CONVERT[pool] || POOL_CONVERT.rapid;
        let lo = table[0], hi = table[table.length - 1];
        for (let i = 1; i < table.length; i++) {
            if (lichessRating <= table[i][0]) { lo = table[i - 1]; hi = table[i]; break; }
            lo = table[i - 1]; hi = table[i];
        }
        const t = (lichessRating - lo[0]) / (hi[0] - lo[0]);
        return lo[1] + t * (hi[1] - lo[1]); // extrapolates linearly beyond the ends
    }

    function conversionSlope(pool, lichessRating) {
        return (lichessToChessCom(pool, lichessRating + 50) - lichessToChessCom(pool, lichessRating - 50)) / 100;
    }

    function chessComToLichess(pool, chessComRating) {
        const table = POOL_CONVERT[pool] || POOL_CONVERT.rapid;
        let lo = table[0], hi = table[table.length - 1];
        for (let i = 1; i < table.length; i++) {
            if (chessComRating <= table[i][1]) { lo = table[i - 1]; hi = table[i]; break; }
            lo = table[i - 1]; hi = table[i];
        }
        const t = (chessComRating - lo[1]) / (hi[1] - lo[1]);
        return lo[0] + t * (hi[0] - lo[0]);
    }

    // timeControl: { base, inc } in seconds, or a legacy class string.
    function effectiveGameSeconds(timeControl) {
        if (!timeControl) return 600;
        if (typeof timeControl === 'string') {
            return TIME_CLASS_DEFAULT_SECONDS[timeControl] || 600;
        }
        const base = Math.max(15, timeControl.base || 0);
        return base + 40 * (timeControl.inc || 0);
    }

    function timeClassOf(timeControl) {
        const t = effectiveGameSeconds(timeControl);
        if (t < 180) return 'bullet';
        if (t < 600) return 'blitz';
        if (t < 5400) return 'rapid';
        return 'classical';
    }

    function timeSkillAdjust(timeControl) {
        const t = effectiveGameSeconds(timeControl);
        return {
            accOffset: Math.max(-3.5, Math.min(3.5, TIME_ACC_SLOPE * Math.log(600 / t))),
            acplMult: Math.max(0.75, Math.min(1.25, Math.pow(t / 600, TIME_ACPL_EXP)))
        };
    }

    // ---- eval helpers -------------------------------------------------------

    // score: { cp } or { mate }, always from White's POV. Returns clamped cp.
    function scoreToCp(score) {
        if (!score) return 0;
        if (typeof score.mate === 'number') {
            if (score.mate === 0) return 0; // shouldn't happen for non-terminal
            return score.mate > 0 ? CP_CEIL : -CP_CEIL;
        }
        return Math.max(-CP_CEIL, Math.min(CP_CEIL, score.cp || 0));
    }

    function winPctWhite(score) {
        if (score && typeof score.mate === 'number' && score.mate !== 0) {
            return score.mate > 0 ? 100 : 0;
        }
        const cp = scoreToCp(score);
        return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
    }

    function winPctFor(score, color) {
        const w = winPctWhite(score);
        return color === 'w' ? w : 100 - w;
    }

    function moveAccuracy(drop) {
        if (drop <= 0) return 100;
        const raw = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669 + 1;
        return Math.max(0, Math.min(100, raw));
    }

    function stdev(values) {
        if (!values.length) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
        return Math.sqrt(variance);
    }

    // Weight of the move at ply k: volatility (stdev) of the win% sequence in a
    // trailing window — errors in sharp positions matter more than in dead-equal ones.
    function volatilityWeights(winPcts) {
        const n = Math.max(winPcts.length - 1, 1);
        const windowSize = Math.max(2, Math.min(8, Math.ceil(n / 10)));
        const weights = [];
        for (let k = 0; k < winPcts.length - 1; k++) {
            const from = Math.max(0, k + 2 - windowSize);
            const win = winPcts.slice(from, k + 2);
            weights.push(Math.max(0.5, Math.min(12, stdev(win))));
        }
        return weights;
    }

    function gameAccuracy(accuracies, weights) {
        if (!accuracies.length) return null;
        let wSum = 0, wTotal = 0, hSum = 0;
        for (let i = 0; i < accuracies.length; i++) {
            const w = weights[i] || 1;
            wSum += accuracies[i] * w;
            wTotal += w;
            hSum += 1 / Math.max(accuracies[i], 1);
        }
        const weighted = wSum / wTotal;
        const harmonic = accuracies.length / hSum;
        return Math.max(0, Math.min(100, (weighted + harmonic) / 2));
    }

    // ---- opening book -------------------------------------------------------

    let bookIndex = null;
    function setBook(bookArray) {
        bookIndex = { prefixes: new Set(), lines: new Map() };
        for (const [eco, name, line] of bookArray) {
            const sans = line.split(' ');
            let prefix = '';
            for (let i = 0; i < sans.length; i++) {
                prefix = i === 0 ? sans[0] : prefix + ' ' + sans[i];
                bookIndex.prefixes.add(prefix);
            }
            bookIndex.lines.set(line, { eco, name });
        }
    }

    function matchBook(sans) {
        if (!bookIndex && typeof ELOGUARD_OPENING_BOOK !== 'undefined') setBook(ELOGUARD_OPENING_BOOK);
        if (!bookIndex) return { bookPlies: 0, opening: null };
        let bookPlies = 0;
        let opening = null;
        let prefix = '';
        for (let i = 0; i < sans.length; i++) {
            prefix = i === 0 ? sans[0] : prefix + ' ' + sans[i];
            if (!bookIndex.prefixes.has(prefix)) break;
            bookPlies = i + 1;
            const hit = bookIndex.lines.get(prefix);
            if (hit) opening = hit;
        }
        return { bookPlies, opening };
    }

    // ---- sacrifice detection (SEE) ------------------------------------------

    function pieceValue(type) {
        return PIECE_VALUES[type] || 0;
    }

    // Best net material the side to move can win on `square` (>= 0, may decline).
    function seeGain(chess, square, depthLeft) {
        if (depthLeft <= 0) return 0;
        const caps = chess.moves({ verbose: true }).filter((m) => m.to === square && m.captured && m.captured !== 'k');
        if (!caps.length) return 0;
        caps.sort((a, b) => pieceValue(a.piece) - pieceValue(b.piece));
        const m = caps[0];
        chess.move(m);
        const gain = pieceValue(m.captured) - seeGain(chess, square, depthLeft - 1);
        chess.undo();
        return Math.max(0, gain);
    }

    // Best material the side to move can win anywhere on the board via a capture chain.
    function bestCaptureGain(chess) {
        const caps = chess.moves({ verbose: true }).filter((m) => m.captured && m.captured !== 'k');
        let best = 0;
        for (const m of caps) {
            chess.move(m);
            const gain = pieceValue(m.captured) - seeGain(chess, m.to, 10);
            chess.undo();
            if (gain > best) best = gain;
        }
        return best;
    }

    function flipTurn(fen) {
        const parts = fen.split(' ');
        if (parts.length < 6) return null;
        parts[1] = parts[1] === 'w' ? 'b' : 'w';
        parts[3] = '-'; // clear en passant
        return parts.join(' ');
    }

    function inCheckFen(fen) {
        if (!CoreChess) return false;
        try {
            return new CoreChess(fen).in_check();
        } catch (e) {
            return false;
        }
    }

    // Did `move` (played from fenBefore, leading to fenAfter) give up material on purpose?
    // Measured as: what the opponent can now win via captures, minus what they could
    // already win if it were their turn before the move, minus what the move captured.
    function sacrificedMaterial(fenBefore, fenAfter, move) {
        if (!CoreChess) return 0;
        const after = new CoreChess(fenAfter);
        const gainAfter = bestCaptureGain(after);
        if (gainAfter < THRESHOLDS.SACRIFICE_MIN) return 0;

        let baseline = 0;
        const flipped = flipTurn(fenBefore);
        if (flipped) {
            try {
                // Count already-hanging material even when this move is a check evasion.
                const nullMoved = new CoreChess(flipped);
                if (nullMoved.moves().length) baseline = bestCaptureGain(nullMoved);
            } catch (e) { /* illegal flipped position: keep baseline 0 */ }
        }
        const banked = move.captured ? pieceValue(move.captured) : 0;
        return Math.max(0, gainAfter - baseline - banked);
    }

    // ---- game phases ---------------------------------------------------------

    const PHASES = ['opening', 'middlegame', 'endgame'];
    // Rating-unit offsets (lichess scale) applied when estimating strength from
    // phase-only stats — fitted on 12k-27k phase samples. Opening accuracy runs
    // hot (theory-adjacent moves) even after book exclusion; endgame-only stats
    // run cold and get credited back.
    const PHASE_RATING_OFFSET = { opening: -54, middlegame: 0, endgame: 29 };

    function majorMinorCount(fen) {
        const placement = fen.split(' ')[0];
        let count = 0;
        for (const ch of placement) if (/[nbrq]/i.test(ch)) count++;
        return count;
    }

    // Phase of the move played from position `fens[i]`. Monotonic state machine,
    // lichess-divider-flavored: middlegame once pieces start coming off or the
    // opening runs long; endgame at <= 6 majors+minors on the board.
    function assignPhases(fens, bookPlies) {
        const phases = [];
        let phase = 'opening';
        const openingLimit = Math.max(bookPlies, 20);
        for (let i = 0; i < fens.length - 1; i++) {
            const count = majorMinorCount(fens[i]);
            if (count <= 6) phase = 'endgame';
            else if (phase === 'opening' && (count <= 10 || i >= openingLimit)) phase = 'middlegame';
            phases.push(phase);
        }
        return phases;
    }

    // ---- game preparation ----------------------------------------------------

    // Replays SAN moves; returns everything the engine job and classifier need.
    function prepareGame(sans) {
        if (!CoreChess) return { error: 'chess library missing' };
        const chess = new CoreChess();
        const fens = [chess.fen()];
        const legalCounts = [chess.moves().length];
        const moves = [];
        for (let i = 0; i < sans.length; i++) {
            const mv = chess.move(sans[i], { sloppy: true });
            if (!mv) return { error: 'Unreadable move "' + sans[i] + '" at ply ' + (i + 1) };
            moves.push({
                san: mv.san,
                uci: mv.from + mv.to + (mv.promotion || ''),
                color: mv.color,
                piece: mv.piece,
                captured: mv.captured || null,
                from: mv.from,
                to: mv.to,
                flags: mv.flags
            });
            fens.push(chess.fen());
            legalCounts.push(chess.moves().length);
        }
        let terminal = null;
        if (chess.in_checkmate()) terminal = 'checkmate';
        else if (chess.in_stalemate()) terminal = 'stalemate';
        else if (chess.in_draw()) terminal = 'draw';
        const { bookPlies, opening } = matchBook(moves.map((m) => m.san));
        return { moves, fens, legalCounts, terminal, bookPlies, opening };
    }

    function uciToSan(fen, uci) {
        if (!CoreChess || !uci) return null;
        const chess = new CoreChess(fen);
        const mv = chess.moves({ verbose: true }).find(
            (m) => m.from === uci.slice(0, 2) && m.to === uci.slice(2, 4) && (m.promotion || '') === uci.slice(4)
        );
        return mv ? mv.san : null;
    }

    function formatEval(score) {
        if (!score) return '0.00';
        if (typeof score.mate === 'number') {
            if (score.mate === 0) return '#';
            return (score.mate > 0 ? '+M' : '-M') + Math.abs(score.mate);
        }
        const pawns = (score.cp || 0) / 100;
        return (pawns >= 0 ? '+' : '') + pawns.toFixed(2);
    }

    // ---- classification -------------------------------------------------------

    function hasBrilliantMoveShape(ctx) {
        const minLegal = ctx.wasInCheck
            ? THRESHOLDS.BRILLIANT_CHECK_MIN_LEGAL
            : THRESHOLDS.BRILLIANT_MIN_LEGAL;
        return ctx.movePiece !== 'k'
            && !ctx.isRecapture
            && (typeof ctx.legalCount !== 'number' || ctx.legalCount >= minLegal);
    }

    function classifyMove(ctx) {
        const {
            drop, before, after, playedIsBest, gap, isBook, isForced,
            sacNet, isRecapture, bestIsMateForMover, afterIsMateForMover, legalCount,
            movePiece, wasInCheck
        } = ctx;
        if (isBook) return 'book';
        if (isForced) return 'forced';

        const nearBest = playedIsBest || drop <= THRESHOLDS.BRILLIANT_MAX_DROP;
        // A sacrifice in an already-crushing position isn't brilliant — unless it forces mate.
        const brilliantEligible = before <= THRESHOLDS.BRILLIANT_MAX_BEFORE || bestIsMateForMover;
        if (nearBest
            && hasBrilliantMoveShape({ movePiece, isRecapture, legalCount, wasInCheck })
            && sacNet >= THRESHOLDS.SACRIFICE_MIN
            && brilliantEligible
            && after >= THRESHOLDS.BRILLIANT_MIN_AFTER) {
            return 'brilliant';
        }
        if (playedIsBest
            && gap !== null && gap >= THRESHOLDS.GREAT_GAP
            && before >= 8 && before <= 92
            && !isRecapture
            && legalCount > 2) {
            return 'great';
        }
        if (playedIsBest || drop <= THRESHOLDS.BEST_EPS) return 'best';
        if (drop <= THRESHOLDS.EXCELLENT) return 'excellent';
        if (drop <= THRESHOLDS.GOOD) return 'good';

        const missedMate = bestIsMateForMover && !afterIsMateForMover
            && after >= THRESHOLDS.MISS_MIN_AFTER && drop >= 3;
        const missedWin = before >= THRESHOLDS.MISS_BEFORE
            && drop >= THRESHOLDS.MISS_MIN_DROP
            && after >= THRESHOLDS.MISS_MIN_AFTER;
        if (missedMate || missedWin) return 'miss';

        if (drop <= THRESHOLDS.INACCURACY) return 'inaccuracy';
        if (drop <= THRESHOLDS.MISTAKE) return 'mistake';
        return 'blunder';
    }

    // ---- rating estimation -----------------------------------------------------

    function invertAccuracy(acc) {
        const a = ACC_ANCHORS;
        if (acc <= a[0][1]) return a[0][0];
        if (acc >= a[a.length - 1][1]) return a[a.length - 1][0];
        for (let i = 1; i < a.length; i++) {
            if (acc <= a[i][1]) {
                const t = (acc - a[i - 1][1]) / (a[i][1] - a[i - 1][1]);
                return a[i - 1][0] + t * (a[i][0] - a[i - 1][0]);
            }
        }
        return a[a.length - 1][0];
    }

    function invertAcpl(acpl) {
        const a = ACPL_ANCHORS;
        const x = Math.log(Math.max(acpl, 1));
        if (acpl >= a[0][1]) return a[0][0];
        if (acpl <= a[a.length - 1][1]) return a[a.length - 1][0];
        for (let i = 1; i < a.length; i++) {
            if (acpl >= a[i][1]) {
                const hi = Math.log(a[i - 1][1]);
                const lo = Math.log(a[i][1]);
                const t = (hi - x) / (hi - lo);
                return a[i - 1][0] + t * (a[i][0] - a[i - 1][0]);
            }
        }
        return a[a.length - 1][0];
    }

    // stats: { accuracy, acpl, scoredCount, complexity } — complexity is the average
    // volatility weight of the player's scored moves (~4.5 is a typical game).
    // timeControl: { base, inc } seconds (e.g. 10+0 -> {base:600,inc:0}) or a class string.
    // Skill is estimated on the chess.com rapid scale (anchors calibrated against
    // the tests/calibrate.js dataset of real chess.com games), then converted to
    // the pool the game was played in. No one's actual rating is ever consulted.

    // Unshrunk skill estimate on the chess.com rapid scale (no pool conversion,
    // no small-sample shrinkage) — the aggregatable quantity. `phase` optionally
    // applies phase-specific calibration when estimating from phase-only stats.
    // Extra fitted features beyond accuracy/ACPL (see tests/lichess-calibration/):
    // own book-move depth (theory knowledge, independent of the noisy accuracy
    // signal) and blunder rate (the FLOOR separates rating bands more than the
    // ceiling). Coefficients are lichess-rating units per feature unit; means
    // center them so entries missing the fields get zero adjustment.
    // Fitted on 48,000 sides (24,000 games, lichess 2026-06): these lift per-game
    // rating correlation from r=0.295 (accuracy+ACPL alone) to r=0.453.
    const EXTRA_FEATURE = {
        bookCoef: 227.23, bookMean: 2.33, bookCap: 16,
        blunderCoef: -5611.1, blunderMean: 0.0482,
        opDeltaCoef: 46.36, opDeltaMean: 6.07,
        fastCoef: 376.6, fastMean: 0.465,
        scrambleCoef: 1129.3, scrambleMean: 0.061
    };

    // Depth-skew correction, FITTED (tests/lichess-calibration/depth_skew.js,
    // 300 sides re-analyzed at d12 vs their deep server evals). Shallow analysis
    // INFLATES measured accuracy (~1.7 pts, more in sharp games — it misses the
    // refutations of your moves too) and understates ACPL (~7%). Values map
    // d12-pipeline measurements onto the deep training scale; scaled toward zero
    // as analysis depth approaches the training data's depth.
    const DEPTH_ADJUST = { accBase: -1.71, accPerCx: -0.78, lnAcplBase: 0.068, lnAcplPerCx: 0.050 };

    function depthScale(analysisDepth) {
        if (typeof analysisDepth !== 'number') return 0; // unknown/deep: no correction
        return Math.max(0, Math.min(1, (22 - analysisDepth) / 10));
    }

    // Time- and sharpness-adjusted measurements: the aggregatable quantities.
    // (Aggregate THESE across games, then invert once — averaging post-inversion
    // features through the flat middle of the curve would amplify noise.)
    function adjustedStats(stats, timeControl) {
        if (!stats || stats.accuracy === null || !stats.scoredCount) return null;
        const adjust = timeSkillAdjust(timeControl);
        const complexityAdj = Math.max(-8, Math.min(8, ((stats.complexity || 4.5) - 4.5) * COMPLEXITY_COEF));
        // Opening-vs-overall accuracy delta. With phase data: 0 when the opening
        // sample is tiny (matching the fit's treatment). Without phase data at
        // all (phase-only estimates, unknown inputs): neutral (= the mean).
        let opDelta = EXTRA_FEATURE.opDeltaMean;
        if (stats.phases) {
            opDelta = 0;
            const op = stats.phases.opening;
            if (op && op.accuracy !== null && op.scoredCount >= 5) {
                opDelta = Math.max(-25, Math.min(25, op.accuracy - stats.accuracy));
            }
        }
        // depth-skew correction toward the deep-analysis training scale
        const dScale = depthScale(stats.analysisDepth);
        const cx = (stats.complexity || 4.5) - 4.5;
        const accDepthAdj = dScale * (DEPTH_ADJUST.accBase + DEPTH_ADJUST.accPerCx * cx);
        const lnAcplDepthAdj = dScale * (DEPTH_ADJUST.lnAcplBase + DEPTH_ADJUST.lnAcplPerCx * cx);
        return {
            acc: Math.min(99.5, stats.accuracy + adjust.accOffset + complexityAdj + accDepthAdj),
            lnAcpl: Math.log(Math.max(1, stats.acpl * adjust.acplMult)) + lnAcplDepthAdj,
            book: Math.min(typeof stats.bookMoves === 'number' ? stats.bookMoves : EXTRA_FEATURE.bookMean, EXTRA_FEATURE.bookCap),
            blunder: typeof stats.blunderRate === 'number' ? stats.blunderRate : EXTRA_FEATURE.blunderMean,
            opDelta,
            fast: typeof stats.fastRate === 'number' ? stats.fastRate : EXTRA_FEATURE.fastMean,
            scramble: typeof stats.scramble === 'number' ? stats.scramble : EXTRA_FEATURE.scrambleMean,
            moves: stats.scoredCount
        };
    }

    function skillFromAdjusted(adj) {
        const fromAcc = invertAccuracy(adj.acc);
        const fromAcpl = invertAcpl(Math.exp(adj.lnAcpl));
        let skill = 0.6 * fromAcc + 0.4 * fromAcpl;
        const x = EXTRA_FEATURE;
        skill += x.bookCoef * ((typeof adj.book === 'number' ? adj.book : x.bookMean) - x.bookMean);
        skill += x.blunderCoef * ((typeof adj.blunder === 'number' ? adj.blunder : x.blunderMean) - x.blunderMean);
        skill += x.opDeltaCoef * ((typeof adj.opDelta === 'number' ? adj.opDelta : x.opDeltaMean) - x.opDeltaMean);
        skill += x.fastCoef * ((typeof adj.fast === 'number' ? adj.fast : x.fastMean) - x.fastMean);
        skill += x.scrambleCoef * ((typeof adj.scramble === 'number' ? adj.scramble : x.scrambleMean) - x.scrambleMean);
        return skill;
    }

    function performanceFeatureFromAdjusted(adj) {
        if (!adj) return null;
        return 0.6 * invertAccuracy(adj.acc) + 0.4 * invertAcpl(Math.exp(adj.lnAcpl));
    }

    function rawSkill(stats, timeControl) {
        const adj = adjustedStats(stats, timeControl);
        return adj === null ? null : skillFromAdjusted(adj);
    }

    // Empirical-Bayes layer, fitted on the lichess sample (30,506 sides):
    // rawSkill is a noisy feature of true strength (Vn >> VarE: a single game is
    // mostly noise). Predicting from M effective scored moves:
    //   slope_M = Cov(rating, f) / (VarE + Vn * meanMoves / M)   [capped]
    //   estimate = meanActual + slope_M * (f - meanFeature)      [lichess scale]
    //   residVar_M = Var(rating) - Cov^2 / (VarE + Vn * meanMoves / M)
    // Single game responds at slope 0.40 (honestly humble); a 10+ game profile
    // reaches the 1.3 cap — where the discrimination actually lives.
    // v3 fit: noise split MEASURED from 4,495 recurring-player groups
    // (single-game slope 0.246, ~5-game groups 0.507), not theorized.
    const CALIBRATION = {
        meanFeature: 1537,
        meanActual: 1630,
        cov: 174985,
        varSignal: 246906,
        varNoise: 465520,
        varRating: 227228,
        slopeMax: 0.709,
        meanMoves: 30.7,
        modelFloor: 150
    };

    // Residual bias per pool measured on the held-out chess.com sample after
    // composing with the survey conversion (tests/validate_chesscom.js,
    // n=160 sides: bullet 22 / blitz 68 / rapid 70). The blitz survey table is
    // the outlier vs observed chess.com blitz play; the data gets the last word.
    // Residual bias per pool on the held-out chess.com sample (160 sides,
    // full v3 model incl. depth correction) — tests/validate_chesscom.js.
    const VALIDATION_OFFSET = { bullet: 107, blitz: -227, rapid: 215, classical: 215 };

    function slopeFor(effMoves) {
        const c = CALIBRATION;
        return Math.min(c.slopeMax, c.cov / (c.varSignal + (c.varNoise * c.meanMoves) / Math.max(effMoves, 1)));
    }

    function finalizeRating(skill, pool, effMoves, extraOffset) {
        const c = CALIBRATION;
        const denom = c.varSignal + (c.varNoise * c.meanMoves) / Math.max(effMoves, 1);
        const lichess = c.meanActual + slopeFor(effMoves) * (skill - c.meanFeature)
            + (CLASS_ADJUST[pool] || 0) + (extraOffset || 0);
        const convSlope = Math.max(0.4, conversionSlope(pool, lichess));
        const converted = lichessToChessCom(pool, lichess) + (VALIDATION_OFFSET[pool] || 0);
        const rating = Math.max(100, Math.min(3200, Math.round(converted / 25) * 25));
        const residVar = Math.max(c.varRating - (c.cov * c.cov) / denom, c.modelFloor * c.modelFloor);
        // Cap the conversion-slope amplification and the display value: a ±800
        // band is honest math but useless guidance.
        const uncertainty = Math.min(500, Math.round((Math.sqrt(residVar) * Math.min(convSlope, 1.2)) / 25) * 25);
        return { rating, uncertainty, pool };
    }

    function estimateRating(stats, timeControl, phase) {
        const skill = rawSkill(stats, timeControl);
        if (skill === null) return null;
        return finalizeRating(skill, timeClassOf(timeControl), stats.scoredCount,
            phase ? PHASE_RATING_OFFSET[phase] || 0 : 0);
    }

    // --- baseline-anchored strength (empirical Bayes around the player's own
    // rating). The rating pins the LEVEL (it is a far better level estimator
    // than any move analysis); the measured features move it by a noise-shrunk
    // performance delta. This answers "how am I playing vs my established
    // strength?", not "what is my rating?" — the two must not be conflated.
    const SIGMA_FORM = 150; // plausible true spread of medium-term form (Elo)

    // Expected feature level for a player of this chess.com rating in this pool.
    function baselineExpectation(pool, chessComRating) {
        const c = CALIBRATION;
        const efr = c.cov / c.varRating; // E[feature | rating] responsiveness (~0.77)
        const lichessBase = chessComToLichess(pool, chessComRating - (VALIDATION_OFFSET[pool] || 0));
        // beyond the fitted range the E[f|rating] line is extrapolated fiction
        const lichessForExp = Math.max(800, Math.min(2600, lichessBase));
        const fExpected = c.meanFeature + efr * (lichessForExp - (CLASS_ADJUST[pool] || 0) - c.meanActual);
        return { efr, lichessBase, fExpected };
    }

    function anchoredStrength(aggFeature, effMoves, pool, chessComRating, extraLichessOffset) {
        if (typeof aggFeature !== 'number' || typeof chessComRating !== 'number') return null;
        const c = CALIBRATION;
        const { efr, lichessBase, fExpected } = baselineExpectation(pool, chessComRating);
        // performance semantics (inverse regression): full-credit delta, then
        // shrink by measurement noise vs the plausible form spread
        const rawDelta = (aggFeature - fExpected) / efr + (extraLichessOffset || 0);
        const noiseVarR = (c.varNoise * c.meanMoves / Math.max(effMoves, 1)) / (efr * efr);
        const lambda = (SIGMA_FORM * SIGMA_FORM) / (SIGMA_FORM * SIGMA_FORM + noiseVarR);
        const slope = Math.max(0.4, Math.min(1.2, conversionSlope(pool, lichessBase)));
        const delta = Math.round(Math.max(-400, Math.min(400, lambda * rawDelta)) * slope / 5) * 5;
        const strength = Math.round((chessComRating + delta) / 5) * 5;
        const sd = Math.sqrt(1 - lambda) * SIGMA_FORM * slope;
        return {
            strength,
            delta,
            baseline: chessComRating,
            uncertainty: Math.max(25, Math.round(sd / 25) * 25),
            lambda: +lambda.toFixed(3),
            pool
        };
    }

    // Single-game performance vs baseline — "this game played like ~X".
    // Uses the QUALITY-ONLY feature (accuracy/ACPL curves; the fitted extras
    // like book depth are population-predictive, not per-game performance) at
    // half credit, capped at ±600: swingy enough that a 5-blunder game at a
    // 2400 baseline reads ~1800, without acc-noise flinging it to the moon.
    const GAME_PERF_CREDIT = 0.4;
    const GAME_PERF_CAP = 750;

    function expectedPerformanceFeature(pool, chessComRating) {
        const { lichessBase } = baselineExpectation(pool, chessComRating);
        const anchorTop = ACC_ANCHORS[ACC_ANCHORS.length - 1][0];
        const anchorBottom = ACC_ANCHORS[0][0];
        return Math.max(anchorBottom, Math.min(anchorTop, lichessBase - (CLASS_ADJUST[pool] || 0)));
    }

    function anchoredPerformance(performanceFeature, effMoves, pool, chessComRating) {
        if (typeof chessComRating !== 'number') return null;
        if (typeof performanceFeature !== 'number') return null;
        const { lichessBase } = baselineExpectation(pool, chessComRating);
        const fExpectedCore = expectedPerformanceFeature(pool, chessComRating);
        const slope = Math.max(0.4, Math.min(1.2, conversionSlope(pool, lichessBase)));
        const rawDelta = GAME_PERF_CREDIT * (performanceFeature - fExpectedCore) * slope;
        const delta = Math.round(Math.max(-GAME_PERF_CAP, Math.min(GAME_PERF_CAP, rawDelta)) / 5) * 5;
        const strength = Math.max(100, Math.min(3200, Math.round((chessComRating + delta) / 5) * 5));
        const c = CALIBRATION;
        const noiseVar = c.varNoise * c.meanMoves / Math.max(effMoves || 1, 1);
        const uncertainty = Math.max(25, Math.min(500,
            Math.round((Math.sqrt(noiseVar) * GAME_PERF_CREDIT * slope) / 25) * 25));
        return {
            strength,
            delta,
            baseline: chessComRating,
            uncertainty,
            pool
        };
    }

    function gamePerformance(stats, timeControl, chessComRating) {
        const adj = adjustedStats(stats, timeControl);
        if (adj === null) return null;
        const pool = timeClassOf(timeControl);
        const anchor = anchoredPerformance(performanceFeatureFromAdjusted(adj), stats.scoredCount, pool, chessComRating);
        if (!anchor) return null;
        const delta = Math.round(anchor.delta / 25) * 25;
        const perf = Math.max(100, Math.min(3200, Math.round((chessComRating + delta) / 25) * 25));
        return { perf, delta, baseline: chessComRating, pool };
    }

    // Multi-game aggregation: entries = [{ ts, timeControl, stats, phases }], one
    // per reviewed game (the user's side). Each game's unshrunk skill is combined
    // with weight = scoredMoves x recency decay (45-day half-life), per pool and
    // per phase. Sampling error shrinks with total moves; a floor remains for
    // model error, which no amount of games removes.
    function aggregateProfile(entries, nowTs, opts) {
        const HALF_LIFE_DAYS = 45;
        const noDecay = !!(opts && opts.noDecay); // period views weight all games equally
        const rows = (entries || [])
            .filter((e) => e && e.stats && e.stats.accuracy !== null && e.stats.scoredCount >= 6 && e.timeControl)
            .map((e) => {
                const ageDays = Math.max(0, (nowTs - (e.ts || nowTs)) / 86400000);
                return {
                    e,
                    decay: noDecay ? 1 : Math.pow(0.5, ageDays / HALF_LIFE_DAYS),
                    pool: timeClassOf(e.timeControl),
                    adj: adjustedStats(Object.assign({}, e.stats, { phases: e.phases }), e.timeControl)
                };
            })
            .filter((r) => r.adj !== null);
        if (!rows.length) return null;

        const weightedMean = (list, valueOf, weightOf) => {
            let wSum = 0, vSum = 0;
            for (const item of list) {
                const v = valueOf(item);
                if (v === null || v === undefined || Number.isNaN(v)) continue;
                const w = weightOf(item);
                wSum += w; vSum += v * w;
            }
            return wSum ? { value: vSum / wSum, weight: wSum } : null;
        };

        // Average the adjusted measurements across games, invert the curve once.
        const combinedSkill = (list, adjOf, weightOf) => {
            const accAgg = weightedMean(list, (r) => adjOf(r).acc, weightOf);
            const acplAgg = weightedMean(list, (r) => adjOf(r).lnAcpl, weightOf);
            if (!accAgg || !acplAgg) return null;
            const agg = (field) => {
                const w = weightedMean(list, (r) => adjOf(r)[field], weightOf);
                return w ? w.value : undefined;
            };
            return {
                skill: skillFromAdjusted({
                    acc: accAgg.value,
                    lnAcpl: acplAgg.value,
                    book: agg('book'),
                    blunder: agg('blunder'),
                    opDelta: agg('opDelta'),
                    fast: agg('fast'),
                    scramble: agg('scramble')
                }),
                weight: accAgg.weight
            };
        };

        const combinedPerformance = (list, adjOf, weightOf) => {
            const accAgg = weightedMean(list, (r) => adjOf(r).acc, weightOf);
            const acplAgg = weightedMean(list, (r) => adjOf(r).lnAcpl, weightOf);
            if (!accAgg || !acplAgg) return null;
            return {
                feature: performanceFeatureFromAdjusted({ acc: accAgg.value, lnAcpl: acplAgg.value }),
                weight: accAgg.weight
            };
        };

        const pools = {};
        let primaryPool = 'rapid';
        let primaryWeight = -1;
        for (const pool of ['bullet', 'blitz', 'rapid', 'classical']) {
            const list = rows.filter((r) => r.pool === pool);
            if (!list.length) continue;
            const wOf = (r) => r.e.stats.scoredCount * r.decay;
            const agg = combinedSkill(list, (r) => r.adj, wOf);
            const perfAgg = combinedPerformance(list, (r) => r.adj, wOf);
            if (!agg) continue;
            const est = finalizeRating(agg.skill, pool, agg.weight);
            pools[pool] = {
                rating: est.rating,
                uncertainty: est.uncertainty,
                feature: agg.skill,
                performanceFeature: perfAgg ? perfAgg.feature : null,
                performanceEffMoves: perfAgg ? perfAgg.weight : agg.weight,
                effMoves: agg.weight,
                games: list.length,
                moves: list.reduce((a, r) => a + r.e.stats.scoredCount, 0),
                accuracy: weightedMean(list, (r) => r.e.stats.accuracy, wOf).value,
                acpl: weightedMean(list, (r) => r.e.stats.acpl, wOf).value
            };
            if (agg.weight > primaryWeight) { primaryWeight = agg.weight; primaryPool = pool; }
        }

        const phases = {};
        for (const ph of PHASES) {
            const list = rows.filter((r) => r.e.phases && r.e.phases[ph] && r.e.phases[ph].scoredCount >= 3
                && r.e.phases[ph].accuracy !== null);
            if (!list.length) continue;
            const wOf = (r) => r.e.phases[ph].scoredCount * r.decay;
            const agg = combinedSkill(list, (r) => adjustedStats(r.e.phases[ph], r.e.timeControl), wOf);
            if (!agg) continue;
            const est = finalizeRating(agg.skill, primaryPool, agg.weight, PHASE_RATING_OFFSET[ph] || 0);
            phases[ph] = {
                rating: est.rating,
                uncertainty: est.uncertainty,
                feature: agg.skill,
                effMoves: agg.weight,
                phaseOffset: PHASE_RATING_OFFSET[ph] || 0,
                moves: list.reduce((a, r) => a + r.e.phases[ph].scoredCount, 0),
                games: list.length,
                accuracy: weightedMean(list, (r) => r.e.phases[ph].accuracy, wOf).value
            };
        }

        const recent = rows
            .slice()
            .sort((a, b) => (b.e.ts || 0) - (a.e.ts || 0))
            .slice(0, 12)
            .map((r) => ({
                ts: r.e.ts,
                pool: r.pool,
                accuracy: r.e.stats.accuracy,
                moves: r.e.stats.scoredCount,
                // Carry the raw inputs so the UI can render a per-game strength
                // with the SAME estimator (gamePerformance) the single-game
                // Game Review card uses — keeping the two views consistent.
                stats: r.e.stats,
                timeControl: r.e.timeControl,
                rating: finalizeRating(skillFromAdjusted(r.adj), r.pool, r.e.stats.scoredCount).rating
            }));

        return {
            pools,
            primaryPool,
            phases,
            recent,
            totalGames: rows.length,
            totalMoves: rows.reduce((a, r) => a + r.e.stats.scoredCount, 0)
        };
    }

    // ---- review assembly --------------------------------------------------------

    // prepared: output of prepareGame(); positions: engine output per position index
    // (see engine/engine.js); missing trailing position is synthesized from `terminal`.
    function buildReview(prepared, positions, opts) {
        const { moves, fens, legalCounts, terminal, bookPlies, opening } = prepared;
        const timeControl = (opts && (opts.timeControl || opts.timeClass)) || 'rapid';
        const timeClass = timeClassOf(timeControl);
        const byIndex = new Map();
        for (const p of positions) byIndex.set(p.index, p);

        // Fill terminal eval if the engine skipped the final position.
        if (!byIndex.has(moves.length)) {
            let score = { cp: 0 };
            if (terminal === 'checkmate') {
                const lastMover = moves[moves.length - 1].color;
                score = { mate: lastMover === 'w' ? 1 : -1 };
            }
            byIndex.set(moves.length, { index: moves.length, best: score, second: null, bestMove: null, depth: 0 });
        }

        const fallbackScoreNear = (idx) => {
            const exact = byIndex.get(idx);
            if (exact && exact.best) return exact.best;
            for (let d = 1; d <= moves.length; d++) {
                const after = byIndex.get(idx + d);
                if (after && after.best) return after.best;
                const before = byIndex.get(idx - d);
                if (before && before.best) return before.best;
            }
            return { cp: 0 };
        };

        // Use the nearest real eval for positions the engine skipped (book/forced),
        // rather than a fabricated 50% dead-equal point that would distort the
        // volatility weights, complexity, and rating estimation downstream.
        const winPcts = [];
        for (let i = 0; i <= moves.length; i++) {
            winPcts.push(winPctWhite(fallbackScoreNear(i)));
        }
        const weights = volatilityWeights(winPcts);

        const reviewMoves = [];
        const movePhases = assignPhases(fens, bookPlies);
        const newBucket = () => ({ accs: [], accWeights: [], losses: [], complexitySum: 0 });
        const bookCounts = { w: 0, b: 0 };
        const blunderCounts = { w: 0, b: 0 };
        const perColor = {
            w: { accs: [], accWeights: [], losses: [], counts: {}, complexitySum: 0, phases: {} },
            b: { accs: [], accWeights: [], losses: [], counts: {}, complexitySum: 0, phases: {} }
        };
        for (const cls of CLASS_ORDER) { perColor.w.counts[cls] = 0; perColor.b.counts[cls] = 0; }
        for (const ph of PHASES) { perColor.w.phases[ph] = newBucket(); perColor.b.phases[ph] = newBucket(); }

        for (let i = 0; i < moves.length; i++) {
            const mv = moves[i];
            const isBook = i < bookPlies;
            const isForced = legalCounts[i] === 1;
            const posBefore = byIndex.get(i);
            const posAfter = byIndex.get(i + 1);
            if ((!posBefore || !posAfter) && (isBook || isForced)) {
                const cls = isBook ? 'book' : 'forced';
                const evalAfter = fallbackScoreNear(i + 1);
                if (cls === 'book') bookCounts[mv.color] += 1;
                perColor[mv.color].counts[cls] += 1;
                reviewMoves.push({
                    ply: i + 1,
                    san: mv.san,
                    uci: mv.uci,
                    from: mv.from,
                    to: mv.to,
                    color: mv.color,
                    phase: movePhases[i],
                    cls,
                    accuracy: null,
                    drop: 0,
                    scored: false,
                    evalAfter,
                    evalDisplay: formatEval(evalAfter),
                    bestUci: null,
                    bestSan: null,
                    depth: 0
                });
                continue;
            }
            if (!posBefore || !posAfter) continue;

            const before = winPctFor(posBefore.best, mv.color);
            const after = winPctFor(posAfter.best, mv.color);
            const rawDrop = Math.max(0, before - after);
            // The pre-move search sometimes prefers a move that its own post-move
            // search refutes (horizon/TT artifacts). A small disagreement on the
            // engine's chosen move is noise — score it as a clean best move. A large
            // one means the deeper post-move search knows better — trust the drop.
            const playedIsBest = posBefore.bestMove === mv.uci && rawDrop <= 6;
            const drop = playedIsBest ? 0 : rawDrop;
            const gap = posBefore.second !== null && posBefore.second !== undefined && posBefore.second
                ? before - winPctFor(posBefore.second, mv.color)
                : null;
            const prev = i > 0 ? moves[i - 1] : null;
            const isRecapture = !!(prev && prev.captured && mv.captured && mv.to === prev.to);
            const wasInCheck = inCheckFen(fens[i]);

            const bestIsMateForMover = !!(posBefore.best && typeof posBefore.best.mate === 'number'
                && (mv.color === 'w' ? posBefore.best.mate > 0 : posBefore.best.mate < 0));
            const afterIsMateForMover = !!(posAfter.best && typeof posAfter.best.mate === 'number'
                && (mv.color === 'w' ? posAfter.best.mate > 0 : posAfter.best.mate < 0));

            let sacNet = 0;
            if (!isBook && !isForced && (playedIsBest || drop <= THRESHOLDS.BRILLIANT_MAX_DROP)
                && hasBrilliantMoveShape({
                    movePiece: mv.piece,
                    isRecapture,
                    legalCount: legalCounts[i],
                    wasInCheck
                })
                && (before <= THRESHOLDS.BRILLIANT_MAX_BEFORE || bestIsMateForMover)
                && after >= THRESHOLDS.BRILLIANT_MIN_AFTER) {
                try {
                    sacNet = sacrificedMaterial(fens[i], fens[i + 1], mv);
                } catch (e) { sacNet = 0; }
            }

            const cls = classifyMove({
                drop, before, after, playedIsBest, gap, isBook, isForced,
                sacNet, isRecapture, bestIsMateForMover, afterIsMateForMover,
                legalCount: legalCounts[i],
                movePiece: mv.piece,
                wasInCheck
            });

            const scored = cls !== 'book' && cls !== 'forced';
            const acc = moveAccuracy(drop);
            const cpBefore = mv.color === 'w' ? scoreToCp(posBefore.best) : -scoreToCp(posBefore.best);
            const cpAfter = mv.color === 'w' ? scoreToCp(posAfter.best) : -scoreToCp(posAfter.best);
            const cpLoss = playedIsBest ? 0 : Math.max(0, Math.min(CP_CEIL, cpBefore - cpAfter));

            if (cls === 'book') bookCounts[mv.color] += 1;
            if (scored) {
                if (drop >= 20) blunderCounts[mv.color] += 1;
                const bucket = perColor[mv.color];
                bucket.accs.push(acc);
                bucket.accWeights.push(weights[i] || 1);
                bucket.losses.push(cpLoss);
                bucket.complexitySum += weights[i] || 1;
                const phaseBucket = bucket.phases[movePhases[i]];
                phaseBucket.accs.push(acc);
                phaseBucket.accWeights.push(weights[i] || 1);
                phaseBucket.losses.push(cpLoss);
                phaseBucket.complexitySum += weights[i] || 1;
            }
            perColor[mv.color].counts[cls] += 1;

            reviewMoves.push({
                ply: i + 1,
                san: mv.san,
                uci: mv.uci,
                from: mv.from,
                to: mv.to,
                color: mv.color,
                phase: movePhases[i],
                cls,
                accuracy: scored ? acc : null,
                drop,
                scored,
                evalAfter: posAfter.best,
                evalDisplay: formatEval(posAfter.best),
                bestUci: posBefore.bestMove,
                bestSan: playedIsBest ? mv.san : uciToSan(fens[i], posBefore.bestMove),
                depth: posBefore.depth || 0
            });
        }

        const bucketStats = (bucket) => {
            const n = bucket.accs.length;
            return {
                accuracy: n ? gameAccuracy(bucket.accs, bucket.accWeights) : null,
                acpl: n ? bucket.losses.reduce((a, b) => a + b, 0) / n : null,
                scoredCount: n,
                complexity: n ? bucket.complexitySum / n : 4.5
            };
        };
        const players = {};
        for (const color of ['w', 'b']) {
            const bucket = perColor[color];
            const stats = bucketStats(bucket);
            stats.bookMoves = bookCounts[color];
            stats.blunderRate = stats.scoredCount ? blunderCounts[color] / stats.scoredCount : 0;
            if (opts && typeof opts.depth === 'number') stats.analysisDepth = opts.depth;
            stats.counts = bucket.counts;
            stats.phases = {};
            for (const ph of PHASES) stats.phases[ph] = bucketStats(bucket.phases[ph]);
            stats.estimate = estimateRating(stats, timeControl);
            players[color] = stats;
        }

        return {
            timeControl,
            timeClass,
            opening: opening || null,
            bookPlies,
            terminal,
            moves: reviewMoves,
            players,
            winPcts
        };
    }

    const api = {
        THRESHOLDS,
        CLASS_ORDER,
        scoreToCp,
        winPctWhite,
        winPctFor,
        moveAccuracy,
        gameAccuracy,
        volatilityWeights,
        setBook,
        matchBook,
        sacrificedMaterial,
        prepareGame,
        uciToSan,
        formatEval,
        classifyMove,
        effectiveGameSeconds,
        timeClassOf,
        timeSkillAdjust,
        PHASES,
        PHASE_RATING_OFFSET,
        CALIBRATION,
        EXTRA_FEATURE,
        assignPhases,
        slopeFor,
        adjustedStats,
        skillFromAdjusted,
        performanceFeatureFromAdjusted,
        rawSkill,
        estimateRating,
        chessComToLichess,
        anchoredStrength,
        anchoredPerformance,
        gamePerformance,
        aggregateProfile,
        buildReview
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.EloGuardReviewCore = api;
    else if (typeof globalThis !== 'undefined') globalThis.EloGuardReviewCore = api;
})();
