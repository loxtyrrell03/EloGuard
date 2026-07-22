// EloGuard Smart Bracket engine - deterministic bracket analysis and archive loading.
(function () {
    'use strict';

    // Bump whenever reason copy changes so the popup can discard stale render caches.
    const COPY_VERSION = 10;
    const PERFORMANCE_WINDOW_DAYS = 7;
    const PERFORMANCE_MIN_GAMES = 3;
    const TREND_FRESHNESS_DAYS = 7;

    // Time-control priors. Bullet sessions run far more games than rapid/daily, so per-session
    // rating excursions scale with the mode. Blitz is the baseline (1.0): with modeScale 1.0
    // every mode-blind constant is exactly unchanged. Only mode-blind priors/edges are scaled;
    // the empirical medians already encode the mode's session length and are left untouched.
    const MODE_PROFILES = { bullet: 1.5, blitz: 1.0, rapid: 0.7, daily: 0.55 };
    const MODE_REASONS = {
        bullet: 'Bullet sessions pack in lots of games, so your bracket gets extra room.',
        rapid: 'Rapid games take longer, so your bracket stays closer.',
        daily: 'Daily games trickle in one at a time, so your bracket stays snug.'
    };

    const DRAW_RESULTS = new Set([
        'agreed',
        'repetition',
        'stalemate',
        'insufficient',
        '50move',
        'timevsinsufficient'
    ]);

    function clamp(x, lo, hi) {
        return Math.min(Math.max(x, lo), hi);
    }

    function parsePgnStart(pgn) {
        if (typeof pgn !== 'string') return null;
        const date = pgn.match(/\[UTCDate\s+"(\d{4})\.(\d{2})\.(\d{2})"\]/);
        const time = pgn.match(/\[UTCTime\s+"(\d{2}):(\d{2}):(\d{2})"\]/);
        if (!date || !time) return null;
        const value = Date.UTC(
            Number(date[1]),
            Number(date[2]) - 1,
            Number(date[3]),
            Number(time[1]),
            Number(time[2]),
            Number(time[3])
        );
        return Number.isNaN(value) ? null : value / 1000;
    }

    function normalizedResult(result) {
        if (result === 'win') return 'win';
        if (DRAW_RESULTS.has(result)) return 'draw';
        return 'loss';
    }

    function normalizeArchiveGames(archiveGames, username, timeClass, opts) {
        opts = opts || {};
        const ratedFilter = opts.ratedFilter === undefined ? 'rated' : opts.ratedFilter;
        const wantedUser = String(username).toLowerCase();
        const normalized = [];

        for (const game of Array.isArray(archiveGames) ? archiveGames : []) {
            if (!game || game.rules !== 'chess' || game.time_class !== timeClass) continue;
            const isRated = game.rated === true;
            // ratedFilter: 'rated' (default) keeps rated only, 'unrated' keeps casual only,
            // 'both' keeps everything. rules/time_class filters above always apply.
            if (ratedFilter === 'rated' && !isRated) continue;
            if (ratedFilter === 'unrated' && isRated) continue;

            const whiteName = game.white && typeof game.white.username === 'string'
                ? game.white.username.toLowerCase()
                : '';
            const blackName = game.black && typeof game.black.username === 'string'
                ? game.black.username.toLowerCase()
                : '';
            const mine = whiteName === wantedUser
                ? game.white
                : (blackName === wantedUser ? game.black : null);
            if (!mine) continue;

            const opponent = mine === game.white ? game.black : game.white;
            const oppRating = opponent && typeof opponent.rating === 'number' && Number.isFinite(opponent.rating)
                ? opponent.rating
                : null;

            normalized.push({
                end: game.end_time,
                start: parsePgnStart(game.pgn),
                rating: mine.rating,
                result: normalizedResult(mine.result),
                opp: oppRating,
                rated: isRated
            });
        }

        normalized.sort((a, b) => a.end - b.end);
        return normalized;
    }

    async function fetchRecentGames(opts) {
        opts = opts || {};
        const username = opts.username;
        const timeClass = opts.timeClass;
        const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
        const nowSec = opts.nowSec === undefined ? Math.floor(Date.now() / 1000) : opts.nowSec;
        const maxGames = opts.maxGames === undefined ? 60 : opts.maxGames;
        const maxDays = opts.maxDays === undefined ? 45 : opts.maxDays;
        const monthsCap = opts.monthsCap === undefined ? 3 : opts.monthsCap;
        const ratedFilter = opts.ratedFilter;
        if (!fetchImpl) throw new Error('No fetch implementation available');

        async function getJson(url) {
            const response = await fetchImpl(url);
            if (!response || !response.ok) {
                const status = response && response.status !== undefined ? ` (${response.status})` : '';
                throw new Error(`Chess.com request failed${status}: ${url}`);
            }
            return response.json();
        }

        const archiveIndex = await getJson(
            `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`
        );
        const archives = Array.isArray(archiveIndex.archives) ? archiveIndex.archives : [];
        const cutoff = nowSec - maxDays * 86400;
        const collected = [];
        let monthsFetched = 0;

        for (let i = archives.length - 1; i >= 0 && monthsFetched < monthsCap; i -= 1) {
            const archive = await getJson(archives[i]);
            monthsFetched += 1;
            const monthGames = normalizeArchiveGames(archive.games, username, timeClass, { ratedFilter });
            const hasOlderGames = monthGames.some((game) => game.end < cutoff);
            for (const game of monthGames) {
                if (game.end >= cutoff) collected.push(game);
            }
            if (collected.length >= maxGames || hasOlderGames) break;
        }

        collected.sort((a, b) => a.end - b.end);
        if (maxGames <= 0) return [];
        return collected.slice(-maxGames);
    }

    function mean(values) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function median(values) {
        const ordered = values.slice().sort((a, b) => a - b);
        const middle = Math.floor(ordered.length / 2);
        return ordered.length % 2
            ? ordered[middle]
            : (ordered[middle - 1] + ordered[middle]) / 2;
    }

    function groupSessions(games) {
        if (!games.length) return [];
        const sessions = [[games[0]]];
        for (let i = 1; i < games.length; i += 1) {
            const previous = games[i - 1];
            const game = games[i];
            const gap = game.start !== null && game.start !== undefined
                ? game.start - previous.end
                : game.end - previous.end;
            if (gap <= 3600) sessions[sessions.length - 1].push(game);
            else sessions.push([game]);
        }
        return sessions;
    }

    function sessionDrawdown(session) {
        let peak = session[0].rating;
        let drawdown = 0;
        for (const game of session) {
            peak = Math.max(peak, game.rating);
            drawdown = Math.max(drawdown, peak - game.rating);
        }
        return drawdown;
    }

    function sessionUpswing(session) {
        let trough = session[0].rating;
        let upswing = 0;
        for (const game of session) {
            trough = Math.min(trough, game.rating);
            upswing = Math.max(upswing, game.rating - trough);
        }
        return upswing;
    }

    function trendPerWeek(games) {
        if (games.length < 5) return 0;
        const xs = games.map((game) => game.end / 86400);
        const ys = games.map((game) => game.rating);
        const meanX = mean(xs);
        const meanY = mean(ys);
        let numerator = 0;
        let denominator = 0;
        for (let i = 0; i < games.length; i += 1) {
            numerator += (xs[i] - meanX) * (ys[i] - meanY);
            denominator += (xs[i] - meanX) * (xs[i] - meanX);
        }
        if (denominator === 0) return 0;
        return Math.round((numerator / denominator) * 7 * 10) / 10;
    }

    function recentStreak(games) {
        if (!games.length) return null;
        const type = games[games.length - 1].result;
        let len = 1;
        for (let i = games.length - 2; i >= 0 && games[i].result === type; i -= 1) len += 1;
        return { type, len };
    }

    function goalSummary(goal, currentRating, slopePerWeek) {
        if (!goal) return null;
        const reached = goal.target <= currentRating;
        const progress = goal.startRating
            ? currentRating - goal.startRating
            : null;
        const etaWeeks = !reached && slopePerWeek > 0
            ? Math.round((goal.target - currentRating) / slopePerWeek)
            : null;
        return { target: goal.target, reached, etaWeeks, progress };
    }

    // Abramowitz & Stegun 7.1.26 error-function approximation (closed form, deterministic).
    function erf(x) {
        const sign = x < 0 ? -1 : 1;
        const ax = Math.abs(x);
        const t = 1 / (1 + 0.3275911 * ax);
        const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
        return sign * (1 - poly * Math.exp(-ax * ax));
    }

    function normalCdf(z) {
        return 0.5 * (1 + erf(z / Math.SQRT2));
    }

    // Build the recency-weighted valid-opponent sample (21-day half-life) for the MAP. Games
    // without a finite opponent rating are dropped. Returns the weighted rows and the ess sum.
    function weightValidGames(games, nowSec) {
        const valid = [];
        let ess = 0;
        for (const game of games) {
            if (typeof game.opp !== 'number' || !Number.isFinite(game.opp)) continue;
            const w = Math.pow(0.5, (nowSec - game.end) / (21 * 86400));
            const s = game.result === 'win' ? 1 : (game.result === 'draw' ? 0.5 : 0);
            valid.push({ opp: game.opp, w, s });
            ess += w;
        }
        return { valid, ess };
    }

    // MAP Bradley-Terry estimate via Newton, Gaussian prior anchored at R0 (sigma0 200).
    // Pure and deterministic; H < 0 always (prior term guards it). Returns { R, sd } (Laplace).
    function mapEstimate(valid, R0) {
        const k = Math.LN10 / 400;
        const sigma0 = 200;
        const priorVar = sigma0 * sigma0;

        function gradients(R) {
            let g = -(R - R0) / priorVar;
            let H = -1 / priorVar;
            for (const v of valid) {
                const E = 1 / (1 + Math.pow(10, (v.opp - R) / 400));
                g += k * v.w * (v.s - E);
                H += -(k * k) * v.w * E * (1 - E);
            }
            return { g, H };
        }

        let R = R0;
        for (let iter = 0; iter < 50; iter += 1) {
            const point = gradients(R);
            const step = point.g / point.H;      // finite: H < 0
            R = clamp(R - step, R0 - 800, R0 + 800);
            if (Math.abs(step) < 0.005) break;
        }

        const sd = Math.sqrt(-1 / gradients(R).H);   // Laplace approximation
        return { R, sd };
    }

    // Surprise-Weighted Bayesian performance rating: MAP Bradley-Terry with a Gaussian prior
    // anchored on the window-start rating. Pure and deterministic. Returns null when the
    // opponent-tagged sample has fewer than three games. The Gaussian prior and reported
    // confidence interval keep the deliberately early estimate appropriately conservative.
    // currentRating is optional: probAboveCurrent (and the session-surprise reference) are null
    // when it is absent.
    function computePerformance(games, opts) {
        const currentRating = opts.currentRating;
        const nowSec = opts.nowSec;
        const hasCurrent = typeof currentRating === 'number' && Number.isFinite(currentRating);
        const R0 = games.length ? games[0].rating : currentRating;

        const { valid, ess } = weightValidGames(games, nowSec);
        const gamesWithOpp = valid.length;
        if (gamesWithOpp < PERFORMANCE_MIN_GAMES) return null;

        const { R, sd } = mapEstimate(valid, R0);
        const perf = Math.round(R);

        // Recent-session surprise vs the CURRENT rating (drives the tilt refinement).
        const sessions = groupSessions(games);
        let sessionSurprise = null;
        if (hasCurrent && sessions.length) {
            const latest = sessions[sessions.length - 1].filter(
                (game) => typeof game.opp === 'number' && Number.isFinite(game.opp)
            );
            if (latest.length >= 3) {
                sessionSurprise = 0;
                for (const game of latest) {
                    const E = 1 / (1 + Math.pow(10, (game.opp - currentRating) / 400));
                    const s = game.result === 'win' ? 1 : (game.result === 'draw' ? 0.5 : 0);
                    sessionSurprise += s - E;
                }
            }
        }

        const probAboveCurrent = hasCurrent
            ? Math.round(normalCdf((R - currentRating) / sd) * 100) / 100
            : null;

        return {
            perf,
            sd,
            ci68: [perf - Math.round(sd), perf + Math.round(sd)],
            ci95: [perf - Math.round(2 * sd), perf + Math.round(2 * sd)],
            ess: Math.round(ess * 10) / 10,
            gamesWithOpp,
            windowStartRating: R0,
            probAboveCurrent,
            sessionSurprise
        };
    }

    // Rolling SWB-TPR series for the stats chart. For each game index i, the window is the
    // up-to-windowSize games ending at i, with per-window nowSec = games[i].end (recency
    // relative to the window's end) and R0 = window's first game rating. A point is emitted
    // only once the window carries at least PERFORMANCE_MIN_GAMES opponent-tagged games.
    // Pure and deterministic.
    function computePerformanceSeries(games, opts) {
        opts = opts || {};
        const windowSize = opts.windowSize === undefined ? 20 : opts.windowSize;
        const series = [];
        for (let i = 0; i < games.length; i += 1) {
            const window = games.slice(Math.max(0, i - windowSize + 1), i + 1);
            const nowSec = games[i].end;
            const R0 = window[0].rating;
            const { valid } = weightValidGames(window, nowSec);
            if (valid.length < PERFORMANCE_MIN_GAMES) continue;
            const { R, sd } = mapEstimate(valid, R0);
            series.push({ end: games[i].end, perf: Math.round(R), sd });
        }
        return series;
    }

    function computeSmartBracket(input) {
        const games = input.games;
        const currentRating = input.currentRating;
        const mode = input.mode;
        const modeKey = String(mode || '').toLowerCase();
        const modeScale = MODE_PROFILES[modeKey] === undefined ? 1.0 : MODE_PROFILES[modeKey];
        const goal = input.goal;
        const manualRange = input.manualRange === undefined ? 25 : input.manualRange;
        const nowSec = input.nowSec;
        const performanceCutoff = nowSec - PERFORMANCE_WINDOW_DAYS * 86400;
        const latestRatedGame = games.length ? games[games.length - 1] : null;
        const trendIsRecent = Boolean(
            latestRatedGame
            && Number.isFinite(latestRatedGame.end)
            && latestRatedGame.end >= nowSec - TREND_FRESHNESS_DAYS * 86400
            && latestRatedGame.end <= nowSec
        );
        const performanceSource = Array.isArray(input.performanceGames) ? input.performanceGames : games;
        const performanceGames = performanceSource.filter((game) => (
            game
            && Number.isFinite(game.end)
            && game.end >= performanceCutoff
            && game.end <= nowSec
        ));

        const windowDays = games.length
            ? Math.ceil((nowSec - games[0].end) / 86400)
            : 0;
        const deltas = games.map((game, index) => index === 0 ? null : game.rating - games[index - 1].rating);
        const lossSamples = [];
        const winSamples = [];
        for (let i = 1; i < games.length; i += 1) {
            if (games[i].result === 'loss' && deltas[i] < 0) lossSamples.push(Math.abs(deltas[i]));
            if (games[i].result === 'win' && deltas[i] > 0) winSamples.push(deltas[i]);
        }
        const avgLossPts = lossSamples.length >= 5 ? mean(lossSamples) : 8;
        const avgWinPts = winSamples.length >= 5 ? mean(winSamples) : 8;

        const grouped = groupSessions(games);
        const qualifying = grouped.filter((session) => session.length >= 3);
        // With < 3 qualifying sessions the empirical medians are unavailable, so scaled mode
        // priors supply typicalDrawdown/typicalUpswing. This counts as the mode prior binding.
        const fallbackUsed = qualifying.length < 3;
        const typicalDrawdown = qualifying.length >= 3
            ? median(qualifying.map(sessionDrawdown))
            : 3.5 * modeScale * avgLossPts;
        const typicalUpswing = qualifying.length >= 3
            ? median(qualifying.map(sessionUpswing))
            : 2.5 * modeScale * avgWinPts;
        const slopePerWeek = trendPerWeek(games);

        const last10Start = Math.max(0, games.length - 10);
        let net10 = 0;
        for (let i = last10Start; i < games.length; i += 1) {
            if (deltas[i] !== null) net10 += deltas[i];
        }
        const streak = recentStreak(games);

        const latestSession = grouped.length ? grouped[grouped.length - 1] : [];
        const performanceSessions = groupSessions(performanceGames);
        const latestPerformanceSession = performanceSessions.length
            ? performanceSessions[performanceSessions.length - 1]
            : [];
        const latestSessionStreak = recentStreak(latestSession);
        const latestSessionNet = latestSession.length
            ? latestSession[latestSession.length - 1].rating - latestSession[0].rating
            : 0;
        const latestIsRecent = latestSession.length
            ? nowSec - latestSession[latestSession.length - 1].end <= 12 * 3600
            : false;
        const tiltFromStreak = latestIsRecent
            && latestSessionStreak.type === 'loss'
            && latestSessionStreak.len >= 3;
        const tiltFromNet = latestIsRecent && latestSessionNet <= -2.5 * avgLossPts;
        const tilt = tiltFromStreak || tiltFromNet;

        let plateau = null;
        if (games.length) {
            const ratings = games.map((game) => game.rating);
            const low = Math.min(...ratings);
            const high = Math.max(...ratings);
            if (
                windowDays >= 21
                && Math.abs(slopePerWeek) < 4
                && high - low <= Math.max(2 * typicalDrawdown, 60)
            ) {
                plateau = { low, high, weeks: Math.round(windowDays / 7) };
            }
        }

        const stats = {
            avgLossPts,
            avgWinPts,
            typicalDrawdown,
            typicalUpswing,
            slopePerWeek,
            net10,
            streak,
            tilt,
            plateau,
            performance: null,
            performanceWindowDays: PERFORMANCE_WINDOW_DAYS,
            recentPerformanceGameCount: performanceGames.length,
            trendFreshnessDays: TREND_FRESHNESS_DAYS,
            trendIsRecent,
            floorSource: null,
            ceilingSource: null
        };
        stats.performance = computePerformance(performanceGames, { currentRating, nowSec });
        const performance = stats.performance;
        const resultGoal = goalSummary(goal, currentRating, trendIsRecent ? slopePerWeek : 0);

        if (games.length < 10) {
            const scaledRange = Math.round(manualRange * modeScale);
            const reasons = [{
                icon: 'ℹ️',
                text: `Only ${games.length} recent ${mode} games is too few to read your form, so your bracket uses ±${scaledRange} for now.`,
                tone: 'info'
            }];
            if (modeScale !== 1.0) {
                reasons.push({ icon: '⏱️', text: MODE_REASONS[modeKey], tone: 'info' });
            }
            return {
                ok: false,
                copyVersion: COPY_VERSION,
                floor: currentRating - scaledRange,
                ceiling: currentRating + scaledRange,
                trailingDistance: scaledRange,
                gamesUsed: games.length,
                windowDays,
                sessions: grouped.length,
                stats,
                goal: resultGoal,
                reasons
            };
        }

        const floorGapPre = typicalDrawdown + 0.5 * avgLossPts;
        const floorGapLo = Math.max(2.5 * modeScale * avgLossPts, Math.round(15 * modeScale));
        const floorGapHi = Math.round(100 * modeScale);
        const floorGap = clamp(floorGapPre, floorGapLo, floorGapHi);
        const floorClampBound = floorGapPre < floorGapLo || floorGapPre > floorGapHi;

        const ceilGapPre = typicalUpswing + 0.5 * avgWinPts;
        const ceilGapLo = Math.max(2 * modeScale * avgWinPts, Math.round(12 * modeScale));
        const ceilGapHi = Math.round(100 * modeScale);
        const unscaledCeilGap = clamp(ceilGapPre, ceilGapLo, ceilGapHi);
        const ceilClampBound = ceilGapPre < ceilGapLo || ceilGapPre > ceilGapHi;

        // Part N (supersedes M2) - continuous form-scaled ceiling. When the performance layer is
        // trustworthy, recent form scales the swings ceiling gap from its full clamped value down
        // toward the step-2 lower bound: f = clamp((p - 0.30) / 0.25, 0, 1) is 0 at p <= 0.30 and
        // 1 at p >= 0.55, linear between (p = performance.probAboveCurrent). A null performance
        // layer (or an absent probAboveCurrent) leaves f = 1, so behavior is unchanged. This one
        // continuous rule subsumes the old M2 hard overrated pull-in.
        const formFactor = performance && Number.isFinite(performance.probAboveCurrent)
            ? clamp((performance.probAboveCurrent - 0.30) / 0.25, 0, 1)
            : 1;
        const minCeilGap = ceilGapLo;   // identical to step 2's existing lower bound
        const ceilGap = minCeilGap + formFactor * (unscaledCeilGap - minCeilGap);

        const swingsFloor = Math.round(currentRating - floorGap);
        const swingsCeiling = Math.round(currentRating + ceilGap);
        // Explicit flag: did the form scaling actually lower the pre-goal ceiling versus the
        // unscaled gap? Used to attribute 'perfHold' when the scaled swings ceiling determines
        // the final value.
        const ceilGapScaledDown = performance !== null && formFactor < 1
            && swingsCeiling < Math.round(currentRating + unscaledCeilGap);
        let floor = swingsFloor;
        let ceiling = swingsCeiling;
        const baseFloor = floor;

        // Performance signal (SWB-TPR). Non-null only when the opponent-tagged sample is
        // trustworthy; drives the surprise-tilt refinement and the overrated/underrated edges.
        const perf = performance ? performance.perf : null;
        const perfSd = performance ? performance.sd : null;
        const underrated = performance ? (perf - perfSd > currentRating + 15) : false;
        const overrated = performance ? (perf + perfSd < currentRating - 15) : false;
        const validLatestOppCount = latestPerformanceSession.filter(
            (game) => typeof game.opp === 'number' && Number.isFinite(game.opp)
        ).length;
        const latestPerformanceIsRecent = latestPerformanceSession.length
            ? nowSec - latestPerformanceSession[latestPerformanceSession.length - 1].end <= 12 * 3600
            : false;

        // Surprise-weighted tilt refinement (only when the performance layer is non-null).
        let effTiltFromStreak = tiltFromStreak;
        const effTiltFromNet = tiltFromNet;
        let tiltTrigger = null;
        if (performance) {
            const ss = performance.sessionSurprise;
            // (a) Suppression: a pure loss streak against much stronger opponents is not tilt.
            if (effTiltFromStreak && !effTiltFromNet && ss !== null && ss > -0.8) {
                effTiltFromStreak = false;
            }
            // (b) Enhancement: quietly losing games you would usually win fires tilt.
            if (!effTiltFromStreak && !effTiltFromNet
                && latestPerformanceIsRecent && validLatestOppCount >= 4
                && ss !== null && ss <= -1.5) {
                tiltTrigger = 'surprise';
            }
        }
        const effTilt = effTiltFromStreak || effTiltFromNet || tiltTrigger === 'surprise';
        if (tiltTrigger === null && effTilt) {
            tiltTrigger = effTiltFromStreak ? 'streak' : 'net';
        }
        stats.tilt = effTilt;

        // Track each rule's floor candidate so we can attribute the final value.
        let tiltFloor = null;
        if (effTilt) {
            tiltFloor = currentRating - Math.max(Math.round(1.5 * modeScale * avgLossPts), Math.round(15 * modeScale));
            floor = Math.max(floor, tiltFloor);
        }
        const tiltOverrodeBaseFloor = effTilt && floor > baseFloor;
        const tiltTightenedAboveBand = plateau && tiltOverrodeBaseFloor && floor > plateau.high;

        // Step 3.5 - an overrated player gets a snug floor near the current rating (same
        // "snug floor" expression as the tilt floor above, mode-scaled identically).
        let performanceFloor = null;
        if (overrated) {
            performanceFloor = currentRating - Math.max(Math.round(1.5 * modeScale * avgLossPts), Math.round(15 * modeScale));
            floor = Math.max(floor, performanceFloor);
        }

        // Ceiling provenance is tracked incrementally across session signals only. The long-term
        // goal is intentionally excluded: it is progress context for the UI, never a boundary for
        // the current session.
        let ceilingSource = ceilGapScaledDown ? 'perfHold' : 'swings';
        let plateauFloor = null;
        if (plateau && !tiltTightenedAboveBand) {
            plateauFloor = plateau.low - Math.round(avgLossPts);
            floor = Math.max(floor, plateauFloor);

            const plateauCeiling = Math.max(
                Math.min(ceiling, plateau.high + Math.round(avgWinPts)),
                currentRating + 2 * avgWinPts
            );
            if (plateauCeiling !== ceiling) ceilingSource = 'plateau';
            ceiling = plateauCeiling;
        }

        const risingHeadroom = trendIsRecent && slopePerWeek >= 10 && net10 > 0;
        if (risingHeadroom) {
            const beforeClimb = ceiling;
            // Part N - the rising-form headroom is scaled by the same form factor (round after).
            ceiling += Math.round(avgWinPts * formFactor);
            if (ceiling !== beforeClimb) ceilingSource = 'climb';
        }

        // Step 5.5 - an underrated player gets extra ceiling headroom toward their true level.
        // The 0.6*(perf-currentRating) term is already real rating points (unscaled); only the
        // absolute clamp bounds are mode-scaled like the other absolute ceiling bounds.
        if (underrated) {
            const boost = clamp(Math.round(0.6 * (perf - currentRating)), Math.round(12 * modeScale), Math.round(80 * modeScale));
            const beforePerf = ceiling;
            ceiling = Math.max(ceiling, currentRating + boost);
            if (ceiling !== beforePerf) ceilingSource = 'performance';
        }

        // Part N removed the old step 5.6 confident-overrated pull-in: a confidently overrated
        // player has p well under 0.30, so the form factor has already pinned the ceiling gap to
        // minCeilGap above - the hard pull-in is subsumed by the continuous rule.

        floor = Math.min(floor, currentRating - Math.max(Math.round(1.5 * modeScale * avgLossPts), Math.round(10 * modeScale)));

        const beforeCeilingSafety = ceiling;
        ceiling = Math.max(ceiling, currentRating + Math.max(Math.round(1.5 * modeScale * avgWinPts), Math.round(10 * modeScale)));
        // If the safety clamp raised the ceiling past every candidate, it is a plain swings ceiling.
        if (ceiling !== beforeCeilingSafety) ceilingSource = 'swings';

        floor = Math.round(floor);
        ceiling = Math.round(ceiling);

        // Floor provenance: the highest-priority candidate that equals the final floor.
        // If the safety clamp moved the floor past every candidate, it is a plain swings floor.
        let floorSource;
        if (tiltFloor !== null && floor === tiltFloor) floorSource = 'tilt';
        else if (performanceFloor !== null && floor === performanceFloor) floorSource = 'performance';
        else if (plateauFloor !== null && floor === plateauFloor) floorSource = 'plateau';
        else floorSource = 'swings';

        stats.floorSource = floorSource;
        stats.ceilingSource = ceilingSource;

        const floorGapFinal = currentRating - floor;
        const kLosses = Math.max(1, Math.round(floorGapFinal / avgLossPts));

        const reasons = [];

        // Floor line (one only; skipped when the plateau line covers this side).
        if (floorSource === 'tilt') {
            let tiltText;
            if (tiltTrigger === 'surprise') {
                tiltText = `You've been losing games you'd usually win, so your floor is pulled up to ${floor} to stop the bleed early.`;
            } else if (effTiltFromStreak) {
                tiltText = `You've dropped ${latestSessionStreak.len} games in a row, so your floor is pulled up to ${floor} to stop the bleed early.`;
            } else {
                tiltText = `This session has cost you ${Math.round(Math.abs(latestSessionNet))} points, so your floor is pulled up to ${floor} to stop the bleed early.`;
            }
            reasons.push({ icon: '📛', text: tiltText, tone: 'warn' });
        } else if (floorSource === 'performance') {
            reasons.push({
                icon: '🛡️',
                text: `Your recent play sits closer to ${perf} than your ${currentRating} rating, so your floor stays close at ${floor}.`,
                tone: 'warn'
            });
        } else if (floorSource === 'swings') {
            reasons.push({
                icon: '🛡️',
                text: `Your floor of ${floor} gives you room for about ${kLosses} losses before EloGuard steps in.`,
                tone: 'info'
            });
        }

        // Ceiling line (one only; skipped when the plateau line covers this side).
        if (ceilingSource === 'perfHold') {
            reasons.push({
                icon: '📊',
                text: `Your recent play is running below your rating, so your target stays close at ${ceiling}.`,
                tone: 'info'
            });
        } else if (ceilingSource === 'performance') {
            reasons.push({
                icon: '📈',
                text: `You've been playing at about ${perf} lately, so your target gets extra room at ${ceiling}.`,
                tone: 'good'
            });
        } else if (ceilingSource === 'climb') {
            reasons.push({
                icon: '📈',
                text: `You're climbing about ${Math.round(Math.abs(slopePerWeek))} points a week, so your target gets extra headroom at ${ceiling}.`,
                tone: 'good'
            });
        } else if (ceilingSource === 'swings') {
            reasons.push({
                icon: '🏆',
                text: `Your winning runs usually peak near ${ceiling}, so that's where your target sits.`,
                tone: 'info'
            });
        }

        // Plateau line replaces whichever side(s) it determined.
        if (plateau && (floorSource === 'plateau' || ceilingSource === 'plateau')) {
            const breakout = Boolean(performance) && (perf - perfSd > plateau.high);
            reasons.push({
                icon: '⚖️',
                text: breakout
                    ? `You've been stuck between ${plateau.low} and ${plateau.high} for ${plateau.weeks} weeks, but you're performing at about ${perf}, so a breakout looks close.`
                    : `You've been stuck between ${plateau.low} and ${plateau.high} for ${plateau.weeks} weeks, so your bracket hugs that range.`,
                tone: breakout ? 'good' : 'info'
            });
        }

        // Trend line only when no tilt floor line and no climb ceiling line are shown.
        if (trendIsRecent && floorSource !== 'tilt' && ceilingSource !== 'climb' && Math.abs(slopePerWeek) >= 3) {
            const s = Math.round(Math.abs(slopePerWeek));
            if (slopePerWeek > 0) {
                reasons.push({
                    icon: '📈',
                    text: `You're gaining about ${s} points a week.`,
                    tone: 'good'
                });
            } else {
                reasons.push({
                    icon: '📉',
                    text: `You're sliding about ${s} points a week, so the floor is there to catch it before it spirals.`,
                    tone: 'warn'
                });
            }
        }

        // Mode microcopy: only when the scaled prior materially bound the result (a scaled
        // gap clamp determined a side, or the < 3-session fallback supplied the medians).
        if (modeScale !== 1.0 && (fallbackUsed || floorClampBound || ceilClampBound)) {
            reasons.push({ icon: '⏱️', text: MODE_REASONS[modeKey], tone: 'info' });
        }

        return {
            ok: true,
            copyVersion: COPY_VERSION,
            floor,
            ceiling,
            trailingDistance: currentRating - floor,
            gamesUsed: games.length,
            windowDays,
            sessions: grouped.length,
            stats,
            goal: resultGoal,
            reasons
        };
    }

    const api = {
        COPY_VERSION,
        normalizeArchiveGames,
        fetchRecentGames,
        computeSmartBracket,
        computePerformance,
        computePerformanceSeries
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.EloGuardSmartBracket = api;
})();
