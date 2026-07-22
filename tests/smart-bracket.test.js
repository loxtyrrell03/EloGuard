const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../lib/smart-bracket.js');
const {
    normalizeArchiveGames,
    fetchRecentGames,
    computeSmartBracket,
    computePerformance,
    computePerformanceSeries
} = api;

const NOW = 1_800_000_000;
const DAY = 86400;

function gamesFromSessions(ratingSessions, options = {}) {
    const results = options.results || [];
    const sessionGap = options.sessionGap || 7200;
    const gameGap = options.gameGap || 300;
    let end = options.firstEnd || NOW - 2 * DAY;
    let index = 0;
    const games = [];
    for (let sessionIndex = 0; sessionIndex < ratingSessions.length; sessionIndex += 1) {
        if (sessionIndex) end += sessionGap;
        for (let gameIndex = 0; gameIndex < ratingSessions[sessionIndex].length; gameIndex += 1) {
            if (gameIndex) end += gameGap;
            games.push({
                end,
                start: end - 60,
                rating: ratingSessions[sessionIndex][gameIndex],
                result: results[index] || (index === 0 || ratingSessions[sessionIndex][gameIndex] >= games[index - 1].rating ? 'win' : 'loss')
            });
            index += 1;
        }
    }
    return games;
}

function dailyGames(ratings, results, firstEnd) {
    return ratings.map((rating, index) => ({
        end: firstEnd + index * DAY,
        start: firstEnd + index * DAY - 60,
        rating,
        result: results ? results[index] : (index === 0 || rating >= ratings[index - 1] ? 'win' : 'loss')
    }));
}

// Build opponent-tagged Game[] grouped into sessions. Each session is an array of
// { rating, result, opp }; games inside a session are gameGap apart, sessions sessionGap apart.
// endAtNow shifts the whole run so the last game ends exactly at NOW (keeps recency weights high).
function oppSessions(sessions, options = {}) {
    const sessionGap = options.sessionGap || 7200;
    const gameGap = options.gameGap || 300;
    const games = [];
    let end = options.firstEnd !== undefined ? options.firstEnd : NOW - 2 * 3600;
    for (let s = 0; s < sessions.length; s += 1) {
        if (s) end += sessionGap;
        for (let g = 0; g < sessions[s].length; g += 1) {
            if (g) end += gameGap;
            const spec = sessions[s][g];
            games.push({ end, start: end - 60, rating: spec.rating, result: spec.result, opp: spec.opp });
        }
    }
    if (options.endAtNow) {
        const shift = NOW - games[games.length - 1].end;
        for (const game of games) { game.end += shift; game.start += shift; }
    }
    return games;
}

// A flat multi-week band (plateau) whose performance estimate sits well above the band top:
// one anchor game 22 days back plus a recent cluster, all wins over +200 opponents.
function plateauBreakoutGames() {
    const osc = [1500, 1496, 1504, 1497, 1503, 1498, 1502, 1499, 1501, 1496, 1504, 1497, 1503, 1498, 1502, 1499, 1501];
    const games = [{ end: NOW - 22 * DAY, start: NOW - 22 * DAY - 60, rating: 1500, result: 'win', opp: 1700 }];
    const clusterStart = NOW - osc.length * 300;
    osc.forEach((rating, i) => games.push({
        end: clusterStart + i * 300,
        start: clusterStart + i * 300 - 60,
        rating,
        result: 'win',
        opp: 1700
    }));
    return games;
}

function archiveGame(end, rating, result = 'win', extras = {}) {
    return {
        rated: true,
        rules: 'chess',
        time_class: 'rapid',
        end_time: end,
        white: { username: 'PlayerOne', rating, result },
        black: { username: 'Opponent', rating: 1300, result: result === 'win' ? 'resigned' : 'win' },
        ...extras
    };
}

test('normalizeArchiveGames filters, maps results, matches username case-insensitively, and parses starts', () => {
    const drawCodes = ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'];
    const input = [
        archiveGame(300, 1203, 'win', { pgn: '[UTCDate "2024.02.03"]\n[UTCTime "04:05:06"]' }),
        ...drawCodes.map((code, index) => archiveGame(400 + index, 1204 + index, code)),
        archiveGame(200, 1198, 'timeout', {
            white: { username: 'Other', rating: 1300, result: 'win' },
            black: { username: 'pLaYeRoNe', rating: 1198, result: 'timeout' }
        }),
        archiveGame(500, 1210, 'win', { rated: false }),
        archiveGame(501, 1210, 'win', { rules: 'chess960' }),
        archiveGame(502, 1210, 'win', { time_class: 'blitz' }),
        archiveGame(503, 1210, 'win', {
            white: { username: 'Nobody', rating: 1210, result: 'win' }
        })
    ];

    const result = normalizeArchiveGames(input, 'PLAYERONE', 'rapid');
    assert.equal(result.length, 8);
    assert.deepEqual(result.map((game) => game.result), ['loss', 'win', ...drawCodes.map(() => 'draw')]);
    assert.deepEqual(result.map((game) => game.end), [200, 300, 400, 401, 402, 403, 404, 405]);
    assert.equal(result[0].start, null);
    assert.equal(result[1].start, Date.UTC(2024, 1, 3, 4, 5, 6) / 1000);
    assert.equal(result[0].rating, 1198);
});

test('insufficient data returns the manual bracket and exact reason copy', () => {
    const games = dailyGames([1200, 1208, 1201, 1209], null, NOW - 3 * DAY);
    const result = computeSmartBracket({ games, currentRating: 1210, mode: 'blitz', goal: null, manualRange: 35, nowSec: NOW });

    assert.equal(result.ok, false);
    assert.equal(result.copyVersion, api.COPY_VERSION);
    assert.equal(result.floor, 1175);
    assert.equal(result.ceiling, 1245);
    assert.equal(result.trailingDistance, 35);
    assert.equal(result.gamesUsed, 4);
    assert.deepEqual(result.reasons, [{
        icon: 'ℹ️',
        text: 'Only 4 recent blitz games is too few to read your form, so your bracket uses ±35 for now.',
        tone: 'info'
    }]);
    assert.equal(result.stats.avgLossPts, 8);
});

test('volatile histories produce a wider asymmetric floor gap than stable histories', () => {
    const stable = gamesFromSessions([
        [1200, 1204, 1200], [1202, 1206, 1201], [1203, 1208, 1202],
        [1204, 1209, 1203], [1205, 1210, 1204]
    ]);
    const volatile = gamesFromSessions([
        [1200, 1220, 1190], [1200, 1222, 1192], [1202, 1225, 1195],
        [1205, 1228, 1198], [1208, 1230, 1200]
    ]);
    const stableResult = computeSmartBracket({ games: stable, currentRating: 1204, mode: 'rapid', goal: null, nowSec: NOW });
    const volatileResult = computeSmartBracket({ games: volatile, currentRating: 1204, mode: 'rapid', goal: null, nowSec: NOW });

    assert.ok(1204 - volatileResult.floor > 1204 - stableResult.floor);
    assert.ok(1204 - stableResult.floor > stableResult.ceiling - 1204);
    assert.ok(volatileResult.stats.typicalDrawdown > stableResult.stats.typicalDrawdown);
});

test('a recent four-loss session tightens the floor while an old one does not trigger tilt', () => {
    const earlier = [
        [1240, 1248, 1240], [1242, 1250, 1242], [1244, 1252, 1244], [1246, 1254, 1246]
    ];
    const losing = gamesFromSessions([...earlier, [1240, 1232, 1224, 1216, 1208]], {
        firstEnd: NOW - 10 * 3600,
        sessionGap: 7200,
        gameGap: 300
    });
    losing[losing.length - 5].result = 'win';
    const calm = gamesFromSessions([...earlier, [1240, 1248, 1240, 1248, 1240]], {
        firstEnd: NOW - 10 * 3600,
        sessionGap: 7200,
        gameGap: 300
    });
    const recent = computeSmartBracket({ games: losing, currentRating: 1208, mode: 'blitz', goal: null, nowSec: NOW });
    const baseline = computeSmartBracket({ games: calm, currentRating: 1208, mode: 'blitz', goal: null, nowSec: NOW });
    const oldGames = losing.map((game) => ({ ...game, end: game.end - DAY, start: game.start - DAY }));
    const old = computeSmartBracket({ games: oldGames, currentRating: 1208, mode: 'blitz', goal: null, nowSec: NOW });

    assert.equal(recent.stats.tilt, true);
    assert.equal(recent.stats.floorSource, 'tilt');
    assert.equal(recent.reasons[0].text, `You've dropped 4 games in a row, so your floor is pulled up to ${recent.floor} to stop the bleed early.`);
    assert.equal(recent.reasons[0].tone, 'warn');
    assert.ok(recent.floor > baseline.floor);
    assert.equal(old.stats.tilt, false);
});

test('a recent losing session with a big net drop but no 3-loss streak tilts via net change', () => {
    const earlier = [
        [1240, 1248, 1240], [1242, 1250, 1242], [1244, 1252, 1244], [1246, 1254, 1246]
    ];
    // Latest session runs L L L L L W L: a mid-session win breaks the trailing streak to
    // length 1, so tilt can only fire on the net −32 pt drop (1240 -> 1208), not a streak.
    const games = gamesFromSessions([...earlier, [1240, 1232, 1224, 1216, 1208, 1216, 1208]], {
        firstEnd: NOW - 10 * 3600
    });
    const result = computeSmartBracket({ games, currentRating: 1208, mode: 'blitz', goal: null, nowSec: NOW });

    assert.equal(result.stats.tilt, true);
    assert.equal(result.stats.floorSource, 'tilt');
    // Net-drop tilt template: absolute point count in prose, no minus sign.
    assert.equal(result.reasons[0].text, `This session has cost you 32 points, so your floor is pulled up to ${result.floor} to stop the bleed early.`);
    assert.equal(result.reasons[0].tone, 'warn');
});

test('a tilt that overrides the volatility floor uses the streak floor line at the final value', () => {
    const earlier = [
        [1300, 1310, 1300], [1302, 1312, 1302], [1304, 1314, 1304], [1306, 1316, 1306]
    ];
    // Latest session ends W L L L (a 3-loss streak) and the tightened tilt floor (1271) sits
    // above the volatility-based floor, so tilt determines the floor and its line replaces
    // the plain swings floor line entirely.
    const games = gamesFromSessions([...earlier, [1310, 1302, 1294, 1286]], {
        firstEnd: NOW - 10 * 3600
    });
    const result = computeSmartBracket({ games, currentRating: 1286, mode: 'blitz', goal: null, nowSec: NOW });

    assert.equal(result.stats.floorSource, 'tilt');
    assert.equal(result.floor, 1271);
    assert.equal(result.reasons[0].text, "You've dropped 3 games in a row, so your floor is pulled up to 1271 to stop the bleed early.");
    assert.equal(result.reasons[0].tone, 'warn');
    assert.ok(!result.reasons.some((reason) => reason.text.startsWith('Your floor of')));
});

test('a flat five-week history is a plateau and snugs the floor under the band low', () => {
    const ratings = [1500, 1504, 1496, 1503, 1497, 1502, 1498, 1504, 1496, 1503, 1497, 1500];
    const games = dailyGames(ratings, null, NOW - 35 * DAY);
    const result = computeSmartBracket({ games, currentRating: 1500, mode: 'rapid', goal: null, nowSec: NOW });

    assert.deepEqual(result.stats.plateau, { low: 1496, high: 1504, weeks: 5 });
    assert.equal(result.floor, result.stats.plateau.low - Math.round(result.stats.avgLossPts));
    assert.ok(result.floor < result.stats.plateau.low);
    assert.equal(result.stats.floorSource, 'plateau');
    assert.ok(result.reasons.some((reason) => reason.text === "You've been stuck between 1496 and 1504 for 5 weeks, so your bracket hugs that range."));
    assert.ok(!result.reasons.some((reason) => reason.text.startsWith('Your floor of')));
});

test('strong rising form adds avg-win headroom to the base ceiling', () => {
    const ratings = Array.from({ length: 12 }, (_, index) => 1200 + index * 4);
    const games = dailyGames(ratings, null, NOW - 12 * DAY);
    const result = computeSmartBracket({ games, currentRating: 1244, mode: 'blitz', goal: null, nowSec: NOW });

    assert.equal(result.stats.slopePerWeek, 28);
    assert.equal(result.stats.net10, 40);
    assert.equal(result.stats.avgWinPts, 4);
    assert.equal(result.ceiling, 1260);
    assert.equal(result.stats.ceilingSource, 'climb');
    assert.ok(result.reasons.some((reason) => reason.text === "You're climbing about 28 points a week, so your target gets extra headroom at 1260."));
});

test('a month-old rated trend does not show current pace copy or add climb headroom', () => {
    const ratings = Array.from({ length: 12 }, (_, index) => 1200 + index * 4);
    const games = dailyGames(ratings, null, NOW - 41 * DAY);
    const result = computeSmartBracket({ games, currentRating: 1244, mode: 'blitz', goal: null, nowSec: NOW });

    assert.equal(result.stats.slopePerWeek, 28);
    assert.equal(result.stats.trendFreshnessDays, 7);
    assert.equal(result.stats.trendIsRecent, false);
    assert.equal(result.ceiling, 1256);
    assert.equal(result.stats.ceilingSource, 'swings');
    assert.ok(!result.reasons.some((reason) => reason.text.includes('points a week')));
});

test('a month-old rated trend does not produce a goal ETA at a stale pace', () => {
    const ratings = Array.from({ length: 12 }, (_, index) => 1200 + index * 4);
    const games = dailyGames(ratings, null, NOW - 41 * DAY);
    const result = computeSmartBracket({
        games,
        currentRating: 1244,
        mode: 'blitz',
        goal: { target: 1300, startRating: 1200, setAt: 1 },
        nowSec: NOW
    });

    assert.equal(result.goal.etaWeeks, null);
    assert.ok(!result.reasons.some((reason) => reason.text.startsWith('At this pace')));
});

test('a steep falling trend without tilt or plateau keeps the floor snug', () => {
    // 4 pts lost per day over 12 daily games => slope -28/week. Daily spacing puts each game
    // in its own session (no tilt) and the 13-day window stays under 21 days (no plateau).
    const ratings = Array.from({ length: 12 }, (_, index) => 1250 - 4 * index);
    const games = dailyGames(ratings, null, NOW - 13 * DAY);
    const result = computeSmartBracket({ games, currentRating: 1206, mode: 'rapid', goal: null, nowSec: NOW });

    assert.equal(result.stats.slopePerWeek, -28);
    assert.equal(result.stats.tilt, false);
    assert.equal(result.stats.plateau, null);
    // Slope is spoken as an absolute value ("about 28 points a week"), no minus sign.
    const trend = result.reasons.find((reason) => reason.text === "You're sliding about 28 points a week, so the floor is there to catch it before it spirals.");
    assert.ok(trend);
    assert.equal(trend.tone, 'warn');
});

test('long-term goals report progress without changing the current-session bracket', () => {
    const flatGames = gamesFromSessions([
        [1200, 1208, 1200], [1201, 1209, 1201], [1202, 1210, 1202],
        [1201, 1209, 1201], [1200, 1208, 1200]
    ]);
    const noGoal = computeSmartBracket({ games: flatGames, currentRating: 1200, mode: 'blitz', goal: null, nowSec: NOW });
    const milestone = computeSmartBracket({ games: flatGames, currentRating: 1200, mode: 'blitz', goal: { target: 1250, startRating: 1200, setAt: 1 }, nowSec: NOW });
    const capped = computeSmartBracket({ games: flatGames, currentRating: 1200, mode: 'blitz', goal: { target: 1220, startRating: 1200, setAt: 1 }, nowSec: NOW });
    const reached = computeSmartBracket({ games: flatGames, currentRating: 1200, mode: 'blitz', goal: { target: 1190, startRating: null, setAt: 1 }, nowSec: NOW });
    const protectionGames = gamesFromSessions([
        [1200, 1216, 1200], [1200, 1216, 1200], [1200, 1216, 1200],
        [1200, 1216, 1200], [1200, 1216, 1200]
    ]);
    const withoutProtection = computeSmartBracket({ games: protectionGames, currentRating: 1200, mode: 'blitz', goal: null, nowSec: NOW });
    const protectedResult = computeSmartBracket({ games: protectionGames, currentRating: 1200, mode: 'blitz', goal: { target: 1300, startRating: 1150, setAt: 1 }, nowSec: NOW });

    assert.equal(milestone.floor, noGoal.floor);
    assert.equal(milestone.ceiling, noGoal.ceiling);
    assert.equal(milestone.stats.ceilingSource, noGoal.stats.ceilingSource);
    assert.equal(capped.floor, noGoal.floor);
    assert.equal(capped.ceiling, noGoal.ceiling);
    assert.equal(capped.stats.ceilingSource, noGoal.stats.ceilingSource);
    assert.equal(reached.goal.reached, true);
    assert.equal(reached.ceiling, noGoal.ceiling);
    assert.equal(protectedResult.goal.progress, 50);
    assert.equal(protectedResult.floor, withoutProtection.floor);
    assert.equal(protectedResult.ceiling, withoutProtection.ceiling);
    // Progress remains available as metadata but does not tighten the session floor.
    assert.equal(protectedResult.stats.floorSource, 'swings');
    assert.ok(!protectedResult.reasons.some((reason) => reason.text.includes('protects most of it')));

    const risingRatings = Array.from({ length: 12 }, (_, index) => 1200 + index * 4);
    const risingGames = dailyGames(risingRatings, null, NOW - 12 * DAY);
    const eta = computeSmartBracket({ games: risingGames, currentRating: 1244, mode: 'blitz', goal: { target: 1300, startRating: 1200, setAt: 1 }, nowSec: NOW });
    assert.equal(eta.goal.etaWeeks, 2);
});

test('a goal above a flat trend reports no ETA', () => {
    // A perfectly flat rating history => slopePerWeek 0, so there is no positive pace and no ETA.
    const ratings = Array.from({ length: 12 }, () => 1200);
    const games = dailyGames(ratings, null, NOW - 12 * DAY);
    const result = computeSmartBracket({ games, currentRating: 1200, mode: 'rapid', goal: { target: 1300, startRating: 1200, setAt: 1 }, nowSec: NOW });

    assert.equal(result.stats.slopePerWeek, 0);
    assert.equal(result.goal.reached, false);
    assert.equal(result.goal.etaWeeks, null);
    assert.ok(!result.reasons.some((reason) => reason.text.includes('goal')));
});

test('final safety and base gap clamps preserve room without exceeding maximum gaps', () => {
    const highVolatility = gamesFromSessions([
        [1000, 1050, 1000], [1000, 1050, 1000], [1000, 1050, 1000],
        [1000, 1050, 1000], [1000, 1050, 1000]
    ]);
    const high = computeSmartBracket({ games: highVolatility, currentRating: 1000, mode: 'bullet', goal: null, nowSec: NOW });
    // Bullet scales the max gap to round(100 * 1.5) = 150, so extreme volatility is capped there.
    assert.equal(1000 - high.floor, 150);
    assert.ok(high.ceiling - 1000 <= 150);
    assert.ok(1000 - high.floor >= Math.max(Math.round(1.5 * high.stats.avgLossPts), 10));

    const lowVolatility = gamesFromSessions([
        [1000, 1001, 1000], [1000, 1001, 1000], [1000, 1001, 1000],
        [1000, 1001, 1000], [1000, 1001, 1000]
    ]);
    const low = computeSmartBracket({ games: lowVolatility, currentRating: 1000, mode: 'bullet', goal: null, nowSec: NOW });
    assert.ok(1000 - low.floor >= 15);
    assert.ok(low.ceiling - 1000 >= 12);
});

test('the floor line reports kLosses from the final floor gap when the min-room clamp binds', () => {
    // Tiny per-session drawdowns keep typicalDrawdown small, so floorGap is pinned to its
    // max(2.5*avgLossPts, 15) lower bound — the min-room clamp binds and the old copy could
    // not explain the gap coherently. kLosses must derive from the FINAL floor gap.
    const games = gamesFromSessions([
        [1000, 1002, 1000], [1000, 1002, 1000], [1000, 1002, 1000],
        [1000, 1002, 1000], [1000, 1002, 1000]
    ]);
    const currentRating = 1000;
    const result = computeSmartBracket({ games, currentRating, mode: 'blitz', goal: null, nowSec: NOW });

    assert.equal(result.ok, true);
    assert.equal(result.stats.tilt, false);
    assert.equal(result.stats.plateau, null);
    assert.equal(result.stats.floorSource, 'swings');
    const expectedK = Math.max(1, Math.round((currentRating - result.floor) / result.stats.avgLossPts));
    const floorLine = result.reasons.find((reason) => reason.text.startsWith('Your floor of'));
    assert.ok(floorLine);
    assert.equal(floorLine.text, `Your floor of ${result.floor} gives you room for about ${expectedK} losses before EloGuard steps in.`);
});

test('computeSmartBracket is deterministic and does not mutate its input', () => {
    const games = dailyGames([1400, 1408, 1400, 1408, 1400, 1408, 1400, 1408, 1400, 1408, 1400, 1408], null, NOW - 12 * DAY);
    const input = { games, currentRating: 1408, mode: 'blitz', goal: { target: 1500, startRating: 1380, setAt: 123 }, manualRange: 30, nowSec: NOW };
    const snapshot = JSON.parse(JSON.stringify(input));

    assert.deepEqual(computeSmartBracket(input), computeSmartBracket(input));
    assert.deepEqual(input, snapshot);
});

test('every result carries the engine copy version on both the ok:true and ok:false paths', () => {
    const insufficient = computeSmartBracket({ games: dailyGames([1200, 1208, 1201, 1209], null, NOW - 3 * DAY), currentRating: 1210, mode: 'rapid', goal: null, nowSec: NOW });
    const sufficient = computeSmartBracket({
        games: gamesFromSessions([[1200, 1204, 1200], [1202, 1206, 1201], [1203, 1208, 1202], [1204, 1209, 1203], [1205, 1210, 1204]]),
        currentRating: 1204, mode: 'rapid', goal: null, nowSec: NOW
    });

    assert.equal(api.COPY_VERSION, 10);
    assert.equal(insufficient.ok, false);
    assert.equal(insufficient.copyVersion, api.COPY_VERSION);
    assert.equal(sufficient.ok, true);
    assert.equal(sufficient.copyVersion, api.COPY_VERSION);
});

test('the goal ETA line is singular when the goal is about one week away', () => {
    // slope +28/week from current 1244; a 1272 target is (1272-1244)/28 = 1 week away.
    const ratings = Array.from({ length: 12 }, (_, index) => 1200 + index * 4);
    const games = dailyGames(ratings, null, NOW - 12 * DAY);
    const result = computeSmartBracket({ games, currentRating: 1244, mode: 'rapid', goal: { target: 1272, startRating: 1200, setAt: 1 }, nowSec: NOW });

    assert.equal(result.goal.etaWeeks, 1);
});

test('provenance attributes the final floor and ceiling to the rule that determined them', () => {
    // (a) A long-term goal never changes session-ceiling provenance.
    const flatGames = gamesFromSessions([
        [1200, 1208, 1200], [1201, 1209, 1201], [1202, 1210, 1202],
        [1201, 1209, 1201], [1200, 1208, 1200]
    ]);
    const milestone = computeSmartBracket({ games: flatGames, currentRating: 1200, mode: 'rapid', goal: { target: 1250, startRating: 1200, setAt: 1 }, nowSec: NOW });
    const milestoneBaseline = computeSmartBracket({ games: flatGames, currentRating: 1200, mode: 'rapid', goal: null, nowSec: NOW });
    assert.equal(milestone.ceiling, milestoneBaseline.ceiling);
    assert.equal(milestone.stats.ceilingSource, milestoneBaseline.stats.ceilingSource);

    // (b) A flat multi-week band binds both floor and ceiling; the plateau line replaces both.
    const plateauGames = dailyGames([1500, 1504, 1496, 1503, 1497, 1502, 1498, 1504, 1496, 1503, 1497, 1500], null, NOW - 35 * DAY);
    const plateau = computeSmartBracket({ games: plateauGames, currentRating: 1500, mode: 'rapid', goal: null, nowSec: NOW });
    assert.equal(plateau.stats.floorSource, 'plateau');
    assert.equal(plateau.stats.ceilingSource, 'plateau');
    assert.ok(plateau.reasons.some((reason) => reason.icon === '⚖️'));
    assert.ok(!plateau.reasons.some((reason) => reason.text.startsWith('Your floor of')));
    assert.ok(!plateau.reasons.some((reason) => reason.text.startsWith('Your winning runs')));

    // (c) A large post-goal climb does not change floor provenance.
    const givebackGames = dailyGames(Array.from({ length: 12 }, () => 1250), null, NOW - 12 * DAY);
    const giveback = computeSmartBracket({ games: givebackGames, currentRating: 1250, mode: 'rapid', goal: { target: 1400, startRating: 1200, setAt: 1 }, nowSec: NOW });
    const givebackBaseline = computeSmartBracket({ games: givebackGames, currentRating: 1250, mode: 'rapid', goal: null, nowSec: NOW });
    assert.equal(giveback.floor, givebackBaseline.floor);
    assert.equal(giveback.stats.floorSource, givebackBaseline.stats.floorSource);

    // (d) A recent four-loss session binds the floor via tilt; the tilt line carries the final value.
    const tiltEarlier = [
        [1240, 1248, 1240], [1242, 1250, 1242], [1244, 1252, 1244], [1246, 1254, 1246]
    ];
    const tiltGames = gamesFromSessions([...tiltEarlier, [1240, 1232, 1224, 1216, 1208]], { firstEnd: NOW - 10 * 3600 });
    tiltGames[tiltGames.length - 5].result = 'win';
    const tilt = computeSmartBracket({ games: tiltGames, currentRating: 1208, mode: 'blitz', goal: null, nowSec: NOW });
    assert.equal(tilt.stats.floorSource, 'tilt');
    assert.ok(tilt.reasons[0].text.includes(String(tilt.floor)));
});

test('every emitted reason avoids forbidden characters and is a single sentence', () => {
    const flatGames = gamesFromSessions([
        [1200, 1208, 1200], [1201, 1209, 1201], [1202, 1210, 1202],
        [1201, 1209, 1201], [1200, 1208, 1200]
    ]);
    const tiltEarlier = [
        [1240, 1248, 1240], [1242, 1250, 1242], [1244, 1252, 1244], [1246, 1254, 1246]
    ];
    const tiltStreak = gamesFromSessions([...tiltEarlier, [1240, 1232, 1224, 1216, 1208]], { firstEnd: NOW - 10 * 3600 });
    tiltStreak[tiltStreak.length - 5].result = 'win';

    const results = [
        // insufficient data
        computeSmartBracket({ games: dailyGames([1200, 1208, 1201, 1209], null, NOW - 3 * DAY), currentRating: 1210, mode: 'rapid', goal: null, manualRange: 35, nowSec: NOW }),
        // stable / volatile swings floor + ceiling
        computeSmartBracket({ games: gamesFromSessions([[1200, 1204, 1200], [1202, 1206, 1201], [1203, 1208, 1202], [1204, 1209, 1203], [1205, 1210, 1204]]), currentRating: 1204, mode: 'rapid', goal: null, nowSec: NOW }),
        computeSmartBracket({ games: gamesFromSessions([[1200, 1220, 1190], [1200, 1222, 1192], [1202, 1225, 1195], [1205, 1228, 1198], [1208, 1230, 1200]]), currentRating: 1204, mode: 'rapid', goal: null, nowSec: NOW }),
        // tilt (streak and net-drop)
        computeSmartBracket({ games: tiltStreak, currentRating: 1208, mode: 'blitz', goal: null, nowSec: NOW }),
        computeSmartBracket({ games: gamesFromSessions([...tiltEarlier, [1240, 1232, 1224, 1216, 1208, 1216, 1208]], { firstEnd: NOW - 10 * 3600 }), currentRating: 1208, mode: 'blitz', goal: null, nowSec: NOW }),
        // plateau (both sides)
        computeSmartBracket({ games: dailyGames([1500, 1504, 1496, 1503, 1497, 1502, 1498, 1504, 1496, 1503, 1497, 1500], null, NOW - 35 * DAY), currentRating: 1500, mode: 'rapid', goal: null, nowSec: NOW }),
        // rising-form climb ceiling
        computeSmartBracket({ games: dailyGames(Array.from({ length: 12 }, (_, i) => 1200 + i * 4), null, NOW - 12 * DAY), currentRating: 1244, mode: 'rapid', goal: null, nowSec: NOW }),
        // falling trend (negative slope in prose)
        computeSmartBracket({ games: dailyGames(Array.from({ length: 12 }, (_, i) => 1250 - 4 * i), null, NOW - 13 * DAY), currentRating: 1206, mode: 'rapid', goal: null, nowSec: NOW }),
        // goals: milestone, capped, reached, eta, stalled
        computeSmartBracket({ games: flatGames, currentRating: 1200, mode: 'rapid', goal: { target: 1250, startRating: 1200, setAt: 1 }, nowSec: NOW }),
        computeSmartBracket({ games: flatGames, currentRating: 1200, mode: 'rapid', goal: { target: 1220, startRating: 1200, setAt: 1 }, nowSec: NOW }),
        computeSmartBracket({ games: flatGames, currentRating: 1200, mode: 'rapid', goal: { target: 1190, startRating: null, setAt: 1 }, nowSec: NOW }),
        computeSmartBracket({ games: dailyGames(Array.from({ length: 12 }, (_, i) => 1200 + i * 4), null, NOW - 12 * DAY), currentRating: 1244, mode: 'rapid', goal: { target: 1300, startRating: 1200, setAt: 1 }, nowSec: NOW }),
        computeSmartBracket({ games: dailyGames(Array.from({ length: 12 }, () => 1200), null, NOW - 12 * DAY), currentRating: 1200, mode: 'rapid', goal: { target: 1300, startRating: 1200, setAt: 1 }, nowSec: NOW }),
        // give-back bound floor
        computeSmartBracket({ games: dailyGames(Array.from({ length: 12 }, () => 1250), null, NOW - 12 * DAY), currentRating: 1250, mode: 'rapid', goal: { target: 1400, startRating: 1200, setAt: 1 }, nowSec: NOW }),
        // Part I performance strings: underrated ceiling, overrated floor, surprise tilt, plateau breakout
        computeSmartBracket({ games: oppSessions([Array.from({ length: 16 }, (_, i) => ({ rating: 1500, result: i < 13 ? 'win' : 'loss', opp: 1700 }))], { endAtNow: true }), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW }),
        computeSmartBracket({ games: oppSessions([Array.from({ length: 20 }, () => ({ rating: 1500, result: 'loss', opp: 1300 }))], { endAtNow: true, gameGap: 43200 }), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW }),
        computeSmartBracket({ games: oppSessions([Array.from({ length: 8 }, (_, i) => ({ rating: 1500, result: i % 2 === 0 ? 'win' : 'loss', opp: 1500 })), [{ rating: 1500, result: 'loss', opp: 1350 }, { rating: 1500, result: 'loss', opp: 1350 }, { rating: 1500, result: 'loss', opp: 1350 }, { rating: 1500, result: 'loss', opp: 1350 }, { rating: 1500, result: 'win', opp: 1350 }]], { endAtNow: true }), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW }),
        computeSmartBracket({ games: plateauBreakoutGames(), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW }),
        // Part M perfHold ceiling via a form-gated skipped milestone (recent form below the rating)
        computeSmartBracket({ games: oppSessions([Array.from({ length: 15 }, (_, i) => ({ rating: 2407, result: i % 2 === 0 ? 'win' : 'loss', opp: 2347 }))], { endAtNow: true }), currentRating: 2407, mode: 'blitz', goal: { target: 2500, startRating: 2407, setAt: 1 }, nowSec: NOW })
    ];

    // U+2014 em-dash, U+2013 en-dash, U+2212 minus, and the tilde are all forbidden in v4.
    const banned = ['—', '–', '−', '~'];
    let checked = 0;
    for (const result of results) {
        for (const reason of result.reasons) {
            checked += 1;
            for (const ch of banned) {
                assert.ok(!reason.text.includes(ch), `reason contains U+${ch.codePointAt(0).toString(16)}: ${reason.text}`);
            }
            // v4 copy is one sentence per line; strings carry no decimals, so exactly one period.
            const periods = (reason.text.match(/\./g) || []).length;
            assert.equal(periods, 1, `reason is not a single sentence: ${reason.text}`);
        }
    }
    assert.ok(checked >= 20);
});

test('thin history scales the manual offset and reason copy by the mode prior', () => {
    const thin = dailyGames([1200, 1208, 1201, 1209], null, NOW - 3 * DAY);
    const base = { games: thin, currentRating: 1210, goal: null, manualRange: 40, nowSec: NOW };
    const bullet = computeSmartBracket({ ...base, mode: 'bullet' });
    const rapid = computeSmartBracket({ ...base, mode: 'rapid' });
    const blitz = computeSmartBracket({ ...base, mode: 'blitz' });

    // Offsets are round(manualRange * modeScale): bullet 1.5, rapid 0.7, blitz 1.0 (baseline).
    assert.equal(1210 - bullet.floor, Math.round(40 * 1.5));
    assert.equal(bullet.ceiling - 1210, Math.round(40 * 1.5));
    assert.equal(bullet.trailingDistance, Math.round(40 * 1.5));
    assert.equal(1210 - rapid.floor, Math.round(40 * 0.7));
    assert.equal(rapid.trailingDistance, Math.round(40 * 0.7));
    assert.equal(1210 - blitz.floor, 40);
    assert.equal(blitz.trailingDistance, 40);

    // Blitz baseline: a single reason, no mode microcopy. Bullet/rapid append one mode line.
    assert.equal(blitz.reasons.length, 1);
    assert.equal(bullet.reasons.length, 2);
    assert.equal(bullet.reasons[1].text, 'Bullet sessions pack in lots of games, so your bracket gets extra room.');
    assert.equal(rapid.reasons.length, 2);
    assert.equal(rapid.reasons[1].text, 'Rapid games take longer, so your bracket stays closer.');
    // The insufficient-data copy reports the scaled range, not the raw manualRange.
    assert.ok(bullet.reasons[0].text.includes(`±${Math.round(40 * 1.5)}`));
});

test('a clamp-bound low-volatility floor gap widens with the mode prior', () => {
    const flat = gamesFromSessions([
        [1000, 1001, 1000], [1000, 1001, 1000], [1000, 1001, 1000],
        [1000, 1001, 1000], [1000, 1001, 1000]
    ]);
    const bullet = computeSmartBracket({ games: flat, currentRating: 1000, mode: 'bullet', goal: null, nowSec: NOW });
    const blitz = computeSmartBracket({ games: flat, currentRating: 1000, mode: 'blitz', goal: null, nowSec: NOW });
    const rapid = computeSmartBracket({ games: flat, currentRating: 1000, mode: 'rapid', goal: null, nowSec: NOW });

    // Tiny drawdowns pin every floor gap to the scaled min-room clamp, so it scales with the mode.
    assert.ok(1000 - bullet.floor > 1000 - blitz.floor);
    assert.ok(1000 - blitz.floor > 1000 - rapid.floor);
});

test('empirical medians inside every clamp yield identical brackets and no mode microcopy', () => {
    // Moderate per-session swings: qualifying sessions supply the medians (not the scaled
    // fallback), and the pre-clamp gaps sit inside all three modes' scaled clamps, so the
    // mode prior never binds and the result is mode independent.
    const session = [1000, 1008, 1016, 1024, 1032, 1024, 1016, 1008, 1000];
    const games = gamesFromSessions([session, session, session, session, session]);
    const bullet = computeSmartBracket({ games, currentRating: 1000, mode: 'bullet', goal: null, nowSec: NOW });
    const blitz = computeSmartBracket({ games, currentRating: 1000, mode: 'blitz', goal: null, nowSec: NOW });
    const rapid = computeSmartBracket({ games, currentRating: 1000, mode: 'rapid', goal: null, nowSec: NOW });

    assert.equal(bullet.floor, blitz.floor);
    assert.equal(rapid.floor, blitz.floor);
    assert.equal(bullet.ceiling, blitz.ceiling);
    assert.equal(rapid.ceiling, blitz.ceiling);

    const modeLines = [
        'Bullet sessions pack in lots of games, so your bracket gets extra room.',
        'Rapid games take longer, so your bracket stays closer.',
        'Daily games trickle in one at a time, so your bracket stays snug.'
    ];
    for (const result of [bullet, blitz, rapid]) {
        assert.ok(!result.reasons.some((reason) => modeLines.includes(reason.text)));
    }
});

test('an unknown mode string falls back to the blitz baseline exactly', () => {
    const session = [1000, 1008, 1016, 1024, 1032, 1024, 1016, 1008, 1000];
    const games = gamesFromSessions([session, session, session, session, session]);
    const unknown = computeSmartBracket({ games, currentRating: 1000, mode: 'ultrabullet', goal: null, nowSec: NOW });
    const blitz = computeSmartBracket({ games, currentRating: 1000, mode: 'blitz', goal: null, nowSec: NOW });
    assert.deepEqual(unknown, blitz);
});

test('mode microcopy lines avoid forbidden characters and stay a single sentence', () => {
    const thin = dailyGames([1200, 1208, 1201, 1209], null, NOW - 3 * DAY);
    const flat = gamesFromSessions([
        [1000, 1001, 1000], [1000, 1001, 1000], [1000, 1001, 1000],
        [1000, 1001, 1000], [1000, 1001, 1000]
    ]);
    const results = [
        computeSmartBracket({ games: thin, currentRating: 1210, mode: 'bullet', goal: null, manualRange: 40, nowSec: NOW }),
        computeSmartBracket({ games: thin, currentRating: 1210, mode: 'rapid', goal: null, manualRange: 40, nowSec: NOW }),
        computeSmartBracket({ games: thin, currentRating: 1210, mode: 'daily', goal: null, manualRange: 40, nowSec: NOW }),
        computeSmartBracket({ games: flat, currentRating: 1000, mode: 'bullet', goal: null, nowSec: NOW }),
        computeSmartBracket({ games: flat, currentRating: 1000, mode: 'rapid', goal: null, nowSec: NOW })
    ];
    const modeLines = [
        'Bullet sessions pack in lots of games, so your bracket gets extra room.',
        'Rapid games take longer, so your bracket stays closer.',
        'Daily games trickle in one at a time, so your bracket stays snug.'
    ];
    const banned = ['—', '–', '−', '~'];
    let modeLinesSeen = 0;
    for (const result of results) {
        for (const reason of result.reasons) {
            for (const ch of banned) {
                assert.ok(!reason.text.includes(ch), `reason contains U+${ch.codePointAt(0).toString(16)}: ${reason.text}`);
            }
            const periods = (reason.text.match(/\./g) || []).length;
            assert.equal(periods, 1, `reason is not a single sentence: ${reason.text}`);
            if (modeLines.includes(reason.text)) modeLinesSeen += 1;
        }
    }
    // Three thin-history modes plus two clamp-bound modes each emit exactly one mode line.
    assert.equal(modeLinesSeen, 5);
});

test('computeSmartBracket stays deterministic and pure with a mode prior applied', () => {
    const session = [1000, 1008, 1016, 1024, 1032, 1024, 1016, 1008, 1000];
    const games = gamesFromSessions([session, session, session, session, session]);
    const input = { games, currentRating: 1000, mode: 'bullet', goal: { target: 1100, startRating: 980, setAt: 7 }, manualRange: 30, nowSec: NOW };
    const snapshot = JSON.parse(JSON.stringify(input));

    assert.deepEqual(computeSmartBracket(input), computeSmartBracket(input));
    assert.deepEqual(input, snapshot);
});

test('normalizeArchiveGames extracts the opponent rating from the other side and nulls it when missing', () => {
    const input = [
        // I am white -> opp is the black side's rating
        {
            rated: true, rules: 'chess', time_class: 'rapid', end_time: 100,
            white: { username: 'PlayerOne', rating: 1500, result: 'win' },
            black: { username: 'Foe', rating: 1600, result: 'resigned' }
        },
        // I am black (matched case-insensitively) -> opp is the white side's rating
        {
            rated: true, rules: 'chess', time_class: 'rapid', end_time: 200,
            white: { username: 'Other', rating: 1700, result: 'win' },
            black: { username: 'playerone', rating: 1400, result: 'timeout' }
        },
        // opponent rating absent -> opp null
        {
            rated: true, rules: 'chess', time_class: 'rapid', end_time: 300,
            white: { username: 'PlayerOne', rating: 1500, result: 'win' },
            black: { username: 'Foe' }
        }
    ];
    const games = normalizeArchiveGames(input, 'PlayerOne', 'rapid');
    assert.deepEqual(games.map((game) => game.opp), [1600, 1700, null]);
});

test('the performance MAP recovers the anchor at a 50% score and stays finite and monotone for all wins', () => {
    // 16 games, alternating win/loss, all against equal-rated (R0) opponents.
    const balanced = Array.from({ length: 16 }, (_, i) => ({ rating: 1500, result: i % 2 === 0 ? 'win' : 'loss', opp: 1500 }));
    const p50 = computeSmartBracket({ games: oppSessions([balanced], { endAtNow: true }), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW }).stats.performance;
    assert.ok(p50);
    assert.equal(p50.windowStartRating, 1500);
    assert.equal(p50.gamesWithOpp, 16);
    assert.ok(Math.abs(p50.perf - 1500) <= 1);           // 50% vs equal opposition sits on the anchor
    assert.ok(Number.isFinite(p50.perf) && Number.isFinite(p50.sd));

    const allWin = (n) => oppSessions([Array.from({ length: n }, () => ({ rating: 1500, result: 'win', opp: 1500 }))], { endAtNow: true });
    const w14 = computeSmartBracket({ games: allWin(14), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW }).stats.performance;
    const w22 = computeSmartBracket({ games: allWin(22), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW }).stats.performance;
    assert.ok(Number.isFinite(w14.perf) && Number.isFinite(w14.sd));   // all-win stays finite (prior + clamp)
    assert.ok(Number.isFinite(w22.perf) && Number.isFinite(w22.sd));
    assert.ok(w14.perf > 1500);                          // all wins push above the anchor
    assert.ok(w22.perf > w14.perf);                      // more evidence raises the estimate
});

test('extreme rating gaps keep every performance figure finite', () => {
    // All opponents 1000 points above, both when the player loses (expected) and wins (surprising):
    // the iterate clamp and the prior term keep R_hat, sd, ci and probAboveCurrent finite (no NaN/Infinity).
    for (const result of ['loss', 'win']) {
        const spec = Array.from({ length: 16 }, () => ({ rating: 1500, result, opp: 2500 }));
        const perf = computeSmartBracket({ games: oppSessions([spec], { endAtNow: true }), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW }).stats.performance;
        assert.ok(perf);
        assert.ok(Number.isFinite(perf.perf) && Number.isFinite(perf.sd));
        assert.ok(perf.ci68.every(Number.isFinite) && perf.ci95.every(Number.isFinite));
        assert.ok(Number.isFinite(perf.probAboveCurrent) && perf.probAboveCurrent >= 0 && perf.probAboveCurrent <= 1);
        assert.ok(Math.abs(perf.perf - perf.windowStartRating) <= 800);   // iterate clamp respected
    }
});

test('the performance layer starts at three opponent-tagged games', () => {
    // Three games total but only two carry an opponent rating -> gated null.
    const spec = Array.from({ length: 2 }, () => ({ rating: 1500, result: 'win', opp: 1500 }));
    spec.push({ rating: 1500, result: 'win', opp: null });
    const thinResult = computeSmartBracket({ games: oppSessions([spec], { endAtNow: true }), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW });
    assert.equal(thinResult.stats.performance, null);
    // No performance reason lines and no tilt refinement propagate from a null layer.
    assert.ok(!thinResult.reasons.some((reason) => reason.text.includes('lately') || reason.text.includes('recent play sits')));

    const minimum = oppSessions([[...spec.slice(0, 2), { rating: 1500, result: 'loss', opp: 1500 }]], { endAtNow: true });
    const minimumResult = computeSmartBracket({ games: minimum, currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW });
    assert.ok(minimumResult.stats.performance);
    assert.equal(minimumResult.stats.performance.gamesWithOpp, 3);
});

test('smart-bracket performance uses all rated and casual games from only the last seven days', () => {
    const baseGames = dailyGames(Array.from({ length: 12 }, () => 1500), null, NOW - 20 * DAY);
    const performanceGames = oppSessions([
        Array.from({ length: 14 }, () => ({ rating: 1500, result: 'win', opp: 1700 }))
    ], { endAtNow: true }).map((game, index) => ({ ...game, rated: index % 2 === 0 }));

    const result = computeSmartBracket({
        games: baseGames,
        performanceGames,
        currentRating: 1500,
        mode: 'blitz',
        goal: null,
        nowSec: NOW
    });

    assert.equal(result.stats.performanceWindowDays, 7);
    assert.equal(result.stats.recentPerformanceGameCount, 14);
    assert.equal(result.stats.performance.gamesWithOpp, 14);
    assert.ok(performanceGames.some((game) => game.rated) && performanceGames.some((game) => !game.rated));
    assert.equal(result.stats.ceilingSource, 'performance');
});

test('smart bracket omits performance when the seven-day window has no games', () => {
    const oldGames = oppSessions([
        Array.from({ length: 16 }, () => ({ rating: 1500, result: 'win', opp: 1700 }))
    ], { endAtNow: true }).map((game) => ({
        ...game,
        end: game.end - 8 * DAY,
        start: game.start - 8 * DAY,
        rated: true
    }));

    const result = computeSmartBracket({
        games: oldGames,
        performanceGames: oldGames,
        currentRating: 1500,
        mode: 'blitz',
        goal: null,
        nowSec: NOW
    });

    assert.equal(result.stats.recentPerformanceGameCount, 0);
    assert.equal(result.stats.performance, null);
    assert.notEqual(result.stats.floorSource, 'performance');
    assert.notEqual(result.stats.ceilingSource, 'performance');
    assert.ok(!result.reasons.some((reason) => reason.text.includes('performing at') || reason.text.includes('recent play')));
});

test('an underrated player (wins over stronger opponents) boosts the ceiling via the performance layer', () => {
    // Flat 1500 rating, 13 wins + 3 losses against 1700-rated opponents -> true level well above 1500.
    const spec = Array.from({ length: 16 }, (_, i) => ({ rating: 1500, result: i < 13 ? 'win' : 'loss', opp: 1700 }));
    const result = computeSmartBracket({ games: oppSessions([spec], { endAtNow: true }), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW });
    const perf = result.stats.performance;
    assert.ok(perf);
    assert.ok(perf.perf - perf.sd > 1500 + 15);          // underrated signal
    assert.equal(result.stats.ceilingSource, 'performance');
    assert.ok(result.ceiling > 1500 + 24);               // boosted past the plain swings ceiling
    assert.ok(result.reasons.some((reason) => reason.text === `You've been playing at about ${perf.perf} lately, so your target gets extra room at ${result.ceiling}.`));
});

test('an overrated player (losses to weaker opponents) snugs the floor via the performance layer', () => {
    // Flat 1500 rating, 20 losses against 1300-rated opponents (each its own session) -> true level below 1500.
    const spec = Array.from({ length: 20 }, () => ({ rating: 1500, result: 'loss', opp: 1300 }));
    const result = computeSmartBracket({ games: oppSessions([spec], { endAtNow: true, gameGap: 43200 }), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW });
    const perf = result.stats.performance;
    assert.ok(perf);
    assert.ok(perf.perf + perf.sd < 1500 - 15);          // overrated signal
    assert.equal(result.stats.tilt, false);              // single-game sessions never tilt
    assert.equal(result.stats.floorSource, 'performance');
    assert.equal(result.floor, 1485);
    assert.ok(result.reasons.some((reason) => reason.text === `Your recent play sits closer to ${perf.perf} than your 1500 rating, so your floor stays close at ${result.floor}.`));
});

test('losses to much stronger opponents suppress a streak tilt and leave the swings floor', () => {
    // Latest session is 3 straight losses to +200 opponents: streak fires, but the session
    // surprise (about -0.72, above -0.8) marks them as expected losses, so tilt is cancelled.
    const earlier = Array.from({ length: 10 }, (_, i) => ({ rating: 1500, result: i % 2 === 0 ? 'win' : 'loss', opp: 1500 }));
    const losses = Array.from({ length: 3 }, () => ({ rating: 1500, result: 'loss', opp: 1700 }));
    const result = computeSmartBracket({ games: oppSessions([earlier, losses], { endAtNow: true }), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW });
    assert.ok(result.stats.performance);
    assert.ok(result.stats.performance.sessionSurprise > -0.8);
    assert.equal(result.stats.tilt, false);
    assert.equal(result.stats.floorSource, 'swings');
    assert.ok(result.reasons.some((reason) => reason.text.startsWith('Your floor of')));
});

test('quietly losing games you would usually win fires a surprise tilt', () => {
    // Latest session: 4 losses + a trailing win (no 3-loss streak) against 1350-rated opponents,
    // session surprise about -2.5 (<= -1.5) -> enhancement fires tilt with the surprise line.
    const earlier = Array.from({ length: 8 }, (_, i) => ({ rating: 1500, result: i % 2 === 0 ? 'win' : 'loss', opp: 1500 }));
    const latest = [
        { rating: 1500, result: 'loss', opp: 1350 }, { rating: 1500, result: 'loss', opp: 1350 },
        { rating: 1500, result: 'loss', opp: 1350 }, { rating: 1500, result: 'loss', opp: 1350 },
        { rating: 1500, result: 'win', opp: 1350 }
    ];
    const result = computeSmartBracket({ games: oppSessions([earlier, latest], { endAtNow: true }), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW });
    assert.ok(result.stats.performance.sessionSurprise <= -1.5);
    assert.equal(result.stats.tilt, true);
    assert.equal(result.stats.floorSource, 'tilt');
    assert.equal(result.reasons[0].text, `You've been losing games you'd usually win, so your floor is pulled up to ${result.floor} to stop the bleed early.`);
    assert.equal(result.reasons[0].tone, 'warn');
});

test('a plateau with a high performance estimate uses the breakout variant line', () => {
    const result = computeSmartBracket({ games: plateauBreakoutGames(), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW });
    const perf = result.stats.performance;
    assert.deepEqual(result.stats.plateau, { low: 1496, high: 1504, weeks: 3 });
    assert.ok(perf.perf - perf.sd > result.stats.plateau.high);
    assert.equal(result.stats.floorSource, 'plateau');
    assert.ok(result.reasons.some((reason) => reason.text === `You've been stuck between 1496 and 1504 for 3 weeks, but you're performing at about ${perf.perf}, so a breakout looks close.`));
    assert.ok(!result.reasons.some((reason) => reason.text === "You've been stuck between 1496 and 1504 for 3 weeks, so your bracket hugs that range."));
});

test('the copy version is 10 and travels on both the performance ok path and the insufficient path', () => {
    const spec = Array.from({ length: 16 }, (_, i) => ({ rating: 1500, result: i < 13 ? 'win' : 'loss', opp: 1700 }));
    const okResult = computeSmartBracket({ games: oppSessions([spec], { endAtNow: true }), currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW });
    const insufficient = computeSmartBracket({ games: dailyGames([1200, 1208, 1201, 1209], null, NOW - 3 * DAY), currentRating: 1210, mode: 'blitz', goal: null, nowSec: NOW });
    assert.equal(api.COPY_VERSION, 10);
    assert.ok(okResult.stats.performance);
    assert.equal(okResult.ok, true);
    assert.equal(okResult.copyVersion, 10);
    assert.equal(insufficient.ok, false);
    assert.equal(insufficient.copyVersion, 10);
});

test('performance-driven results stay deterministic and do not mutate their input', () => {
    const underrated = oppSessions([Array.from({ length: 16 }, (_, i) => ({ rating: 1500, result: i < 13 ? 'win' : 'loss', opp: 1700 }))], { endAtNow: true });
    const surprise = oppSessions([
        Array.from({ length: 8 }, (_, i) => ({ rating: 1500, result: i % 2 === 0 ? 'win' : 'loss', opp: 1500 })),
        [{ rating: 1500, result: 'loss', opp: 1350 }, { rating: 1500, result: 'loss', opp: 1350 }, { rating: 1500, result: 'loss', opp: 1350 }, { rating: 1500, result: 'loss', opp: 1350 }, { rating: 1500, result: 'win', opp: 1350 }]
    ], { endAtNow: true });
    for (const games of [underrated, surprise]) {
        const input = { games, currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW };
        const snapshot = JSON.parse(JSON.stringify(input));
        assert.deepEqual(computeSmartBracket(input), computeSmartBracket(input));
        assert.deepEqual(input, snapshot);
    }
});

test('fetchRecentGames walks months newest-first and keeps the most recent maxGames', async () => {
    const archives = ['jan', 'feb', 'mar', 'apr'];
    const payloads = {
        apr: { games: [archiveGame(NOW - 100, 1404), archiveGame(NOW - 50, 1405)] },
        mar: { games: [archiveGame(NOW - 300, 1402), archiveGame(NOW - 200, 1403)] },
        feb: { games: [archiveGame(NOW - 500, 1401)] }
    };
    const calls = [];
    const fetchImpl = async (url) => {
        calls.push(url);
        if (url.includes('/games/archives')) return { ok: true, json: async () => ({ archives }) };
        return { ok: true, json: async () => payloads[url] };
    };

    const games = await fetchRecentGames({ username: 'PlayerOne', timeClass: 'rapid', fetchImpl, nowSec: NOW, maxGames: 3 });
    assert.deepEqual(calls.slice(1), ['apr', 'mar']);
    assert.deepEqual(games.map((game) => game.rating), [1403, 1404, 1405]);
    assert.deepEqual(games.map((game) => game.end), [NOW - 200, NOW - 100, NOW - 50]);
});

test('fetchRecentGames stops at maxDays and excludes older games', async () => {
    const archives = ['jan', 'feb', 'mar'];
    const payloads = {
        mar: { games: [archiveGame(NOW - DAY, 1503)] },
        feb: { games: [archiveGame(NOW - 5 * DAY, 1502), archiveGame(NOW - 20 * DAY, 1501)] },
        jan: { games: [archiveGame(NOW - 25 * DAY, 1500)] }
    };
    const calls = [];
    const fetchImpl = async (url) => {
        calls.push(url);
        if (url.includes('/games/archives')) return { ok: true, json: async () => ({ archives }) };
        return { ok: true, json: async () => payloads[url] };
    };

    const games = await fetchRecentGames({ username: 'PlayerOne', timeClass: 'rapid', fetchImpl, nowSec: NOW, maxDays: 10 });
    assert.deepEqual(calls.slice(1), ['mar', 'feb']);
    assert.deepEqual(games.map((game) => game.rating), [1502, 1503]);
});

test('fetchRecentGames enforces the three-month hard cap', async () => {
    const archives = ['jan', 'feb', 'mar', 'apr'];
    const calls = [];
    const fetchImpl = async (url) => {
        calls.push(url);
        if (url.includes('/games/archives')) return { ok: true, json: async () => ({ archives }) };
        return { ok: true, json: async () => ({ games: [archiveGame(NOW - calls.length, 1500 + calls.length)] }) };
    };

    await fetchRecentGames({ username: 'PlayerOne', timeClass: 'rapid', fetchImpl, nowSec: NOW, maxGames: 60 });
    assert.deepEqual(calls.slice(1), ['apr', 'mar', 'feb']);
});

test('fetchRecentGames propagates non-OK responses', async () => {
    const listFailure = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await assert.rejects(
        fetchRecentGames({ username: 'PlayerOne', timeClass: 'rapid', fetchImpl: listFailure, nowSec: NOW }),
        /Chess\.com request failed \(503\)/
    );

    const monthFailure = async (url) => url.includes('/games/archives')
        ? { ok: true, json: async () => ({ archives: ['month'] }) }
        : { ok: false, status: 404, json: async () => ({}) };
    await assert.rejects(
        fetchRecentGames({ username: 'PlayerOne', timeClass: 'rapid', fetchImpl: monthFailure, nowSec: NOW }),
        /Chess\.com request failed \(404\)/
    );
});

// ----- Part J1: engine additions (rated flag / ratedFilter, monthsCap, exported perf + series) -----

test('normalizeArchiveGames honors ratedFilter and tags each game with its rated flag', () => {
    const input = [
        archiveGame(100, 1500, 'win'),                      // rated
        archiveGame(200, 1490, 'win', { rated: false }),    // casual
        archiveGame(300, 1495, 'win'),                      // rated
        archiveGame(400, 1480, 'win', { rated: false })     // casual
    ];

    // No opts -> current behavior (rated only) and each game carries rated: true.
    const ratedDefault = normalizeArchiveGames(input, 'PlayerOne', 'rapid');
    assert.deepEqual(ratedDefault.map((g) => g.end), [100, 300]);
    assert.ok(ratedDefault.every((g) => g.rated === true));

    // Explicit 'rated' is identical to the default.
    assert.deepEqual(normalizeArchiveGames(input, 'PlayerOne', 'rapid', { ratedFilter: 'rated' }), ratedDefault);

    const unrated = normalizeArchiveGames(input, 'PlayerOne', 'rapid', { ratedFilter: 'unrated' });
    assert.deepEqual(unrated.map((g) => g.end), [200, 400]);
    assert.ok(unrated.every((g) => g.rated === false));

    const both = normalizeArchiveGames(input, 'PlayerOne', 'rapid', { ratedFilter: 'both' });
    assert.deepEqual(both.map((g) => g.end), [100, 200, 300, 400]);
    assert.deepEqual(both.map((g) => g.rated), [true, false, true, false]);

    // rules/time_class filters always apply, even under 'both'.
    const filtered = normalizeArchiveGames([
        archiveGame(500, 1500, 'win'),
        archiveGame(600, 1500, 'win', { rated: false, rules: 'chess960' }),
        archiveGame(700, 1500, 'win', { rated: false, time_class: 'blitz' })
    ], 'PlayerOne', 'rapid', { ratedFilter: 'both' });
    assert.deepEqual(filtered.map((g) => g.end), [500]);
});

test('fetchRecentGames respects a configurable monthsCap and passes ratedFilter through', async () => {
    const archives = ['jan', 'feb', 'mar', 'apr'];
    const makeFetch = (calls) => async (url) => {
        calls.push(url);
        if (url.includes('/games/archives')) return { ok: true, json: async () => ({ archives }) };
        // Each month: one rated and one casual game, both recent (never older than maxDays).
        return { ok: true, json: async () => ({ games: [
            archiveGame(NOW - calls.length * 10, 1500),
            archiveGame(NOW - calls.length * 10 - 5, 1490, 'win', { rated: false })
        ] }) };
    };

    // monthsCap 2 stops after two months even though maxGames is never reached.
    const calls2 = [];
    const twoMonths = await fetchRecentGames({ username: 'PlayerOne', timeClass: 'rapid', fetchImpl: makeFetch(calls2), nowSec: NOW, maxGames: 60, monthsCap: 2 });
    assert.deepEqual(calls2.slice(1), ['apr', 'mar']);
    assert.equal(twoMonths.length, 2);
    assert.ok(twoMonths.every((g) => g.rated === true));

    // Default monthsCap remains 3.
    const calls3 = [];
    await fetchRecentGames({ username: 'PlayerOne', timeClass: 'rapid', fetchImpl: makeFetch(calls3), nowSec: NOW, maxGames: 60 });
    assert.deepEqual(calls3.slice(1), ['apr', 'mar', 'feb']);

    // ratedFilter 'both' flows into normalizeArchiveGames and keeps casual games too.
    const callsBoth = [];
    const both = await fetchRecentGames({ username: 'PlayerOne', timeClass: 'rapid', fetchImpl: makeFetch(callsBoth), nowSec: NOW, maxGames: 60, monthsCap: 1, ratedFilter: 'both' });
    assert.equal(both.length, 2);
    assert.deepEqual(both.map((g) => g.rated).sort(), [false, true]);
});

test('the exported computePerformance matches stats.performance and makes currentRating optional', () => {
    const spec = Array.from({ length: 16 }, (_, i) => ({ rating: 1500, result: i < 13 ? 'win' : 'loss', opp: 1700 }));
    const games = oppSessions([spec], { endAtNow: true });

    const viaBracket = computeSmartBracket({ games, currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW }).stats.performance;
    const direct = computePerformance(games, { currentRating: 1500, nowSec: NOW });
    assert.ok(direct);
    assert.deepEqual(direct, viaBracket);

    // currentRating optional: probAboveCurrent null when absent; perf/sd/ci unchanged.
    const noCurrent = computePerformance(games, { nowSec: NOW });
    assert.equal(noCurrent.probAboveCurrent, null);
    assert.equal(noCurrent.sessionSurprise, null);
    assert.equal(noCurrent.perf, viaBracket.perf);
    assert.equal(noCurrent.sd, viaBracket.sd);
    assert.deepEqual(noCurrent.ci68, viaBracket.ci68);
    assert.deepEqual(noCurrent.ci95, viaBracket.ci95);

    // Same thin-sample gate as the internal layer.
    const thin = oppSessions([Array.from({ length: 2 }, () => ({ rating: 1500, result: 'win', opp: 1500 }))], { endAtNow: true });
    assert.equal(computePerformance(thin, { currentRating: 1500, nowSec: NOW }), null);
});

test('computePerformanceSeries gates per window and stays deterministic and consistent with computePerformance', () => {
    const spec = Array.from({ length: 15 }, (_, i) => ({ rating: 1500 + i, result: i % 2 === 0 ? 'win' : 'loss', opp: 1500 }));
    const games = oppSessions([spec], { endAtNow: true });

    const series = computePerformanceSeries(games, { windowSize: 20 });
    // Windows reach gamesWithOpp 3 at index 2, so points appear from games[2] onward.
    assert.equal(series.length, 13);
    assert.deepEqual(Object.keys(series[0]), ['end', 'perf', 'sd']);
    assert.deepEqual(series.map((p) => p.end), games.slice(2).map((g) => g.end));
    for (const point of series) {
        assert.ok(Number.isInteger(point.perf));
        assert.ok(Number.isFinite(point.sd));
    }

    // windowSize defaults to 20 and the computation is deterministic.
    assert.deepEqual(computePerformanceSeries(games), series);
    assert.deepEqual(computePerformanceSeries(games, { windowSize: 20 }), series);

    // Last point consistency: windowSize >= games.length makes the final window the whole run,
    // with nowSec = last game end -> identical perf/sd to computePerformance on the same fixture.
    const full = computePerformanceSeries(games, { windowSize: games.length });
    const last = full[full.length - 1];
    const direct = computePerformance(games, { nowSec: games[games.length - 1].end });
    assert.equal(last.end, games[games.length - 1].end);
    assert.equal(last.perf, direct.perf);
    assert.equal(last.sd, direct.sd);
});

// ----- Long-term goal separation from the current-session ceiling -----

// The reported flaw: a long-term goal stretched a current-session ceiling. These fixtures ensure
// the goal is now progress metadata only, regardless of the strength of the performance signal.
const FORM_GATE_RATING = 2407;
const FORM_GATE_GOAL = { target: 2500, startRating: FORM_GATE_RATING, setAt: 1 };
function formGateGames(opp) {
    // 15 recent opponent-tagged games at a flat 2407 rating; opp sets the performance estimate.
    return oppSessions([Array.from({ length: 15 }, (_, i) => ({
        rating: FORM_GATE_RATING, result: i % 2 === 0 ? 'win' : 'loss', opp
    }))], { endAtNow: true });
}

test('recent form below the rating sets the same session ceiling with or without a long-term goal', () => {
    // opp 2347 -> performance estimate 2376 (about 31 below the rating), probAboveCurrent 0.35 < 0.4.
    const games = formGateGames(2347);
    const result = computeSmartBracket({ games, currentRating: FORM_GATE_RATING, mode: 'blitz', goal: FORM_GATE_GOAL, nowSec: NOW });
    const noGoal = computeSmartBracket({ games, currentRating: FORM_GATE_RATING, mode: 'blitz', goal: null, nowSec: NOW });
    assert.equal(result.stats.performance.perf, 2376);
    assert.equal(result.stats.performance.probAboveCurrent, 0.35);
    // Part N form factor f = clamp((0.35 - 0.30) / 0.25, 0, 1) = 0.2 scales the swings gap:
    // avgWinPts 8, typicalUpswing 20 (fallback) => unscaled ceilGap 24, minCeilGap max(2*8, 12) = 16,
    // ceilGap = 16 + 0.2*(24 - 16) = 17.6 => swings ceiling round(2407 + 17.6) = 2425. The milestone
    // (2450) is skipped (p < 0.4), so the ceiling stays at the scaled swings value, attributed perfHold.
    assert.equal(result.ceiling, 2425);
    assert.equal(result.ceiling, noGoal.ceiling);
    assert.equal(result.stats.ceilingSource, 'perfHold');
    assert.ok(result.reasons.some((reason) => reason.text === 'Your recent play is running below your rating, so your target stays close at 2425.'));
    assert.ok(!result.reasons.some((reason) => reason.text.includes('milestone')));
});

test('recent form above the rating still ignores the long-term goal for the session ceiling', () => {
    // Same fixture shape, opp 2407 -> performance estimate above the rating, probAboveCurrent >= 0.4,
    // so the pre-Part-M milestone stretch applies exactly as before.
    const games = formGateGames(2407);
    const result = computeSmartBracket({ games, currentRating: FORM_GATE_RATING, mode: 'blitz', goal: FORM_GATE_GOAL, nowSec: NOW });
    const noGoal = computeSmartBracket({ games, currentRating: FORM_GATE_RATING, mode: 'blitz', goal: null, nowSec: NOW });
    assert.ok(result.stats.performance.probAboveCurrent >= 0.4);
    assert.equal(result.ceiling, noGoal.ceiling);
    assert.equal(result.stats.ceilingSource, noGoal.stats.ceilingSource);
    assert.ok(!result.reasons.some((reason) => reason.text.includes('goal')));
});

test('a probAboveCurrent of exactly 0.40 does not let a long-term goal stretch the session', () => {
    // opp 2359 -> probAboveCurrent rounds to exactly 0.40 (Part I keeps two decimals); at the
    // >= 0.4 gate the milestone is allowed and the ceiling stretches to 2450.
    const games = formGateGames(2359);
    const result = computeSmartBracket({ games, currentRating: FORM_GATE_RATING, mode: 'blitz', goal: FORM_GATE_GOAL, nowSec: NOW });
    const noGoal = computeSmartBracket({ games, currentRating: FORM_GATE_RATING, mode: 'blitz', goal: null, nowSec: NOW });
    assert.equal(result.stats.performance.probAboveCurrent, 0.4);
    assert.equal(result.ceiling, noGoal.ceiling);
    assert.equal(result.stats.ceilingSource, noGoal.stats.ceilingSource);
});

test('a null performance layer still keeps the long-term goal out of the session ceiling', () => {
    // Identical rating history with no opponent tags -> performance null -> allowMilestone true, so
    // the milestone stretches exactly as it did before form gating existed.
    const games = oppSessions([Array.from({ length: 15 }, (_, i) => ({
        rating: FORM_GATE_RATING, result: i % 2 === 0 ? 'win' : 'loss', opp: null
    }))], { endAtNow: true });
    const result = computeSmartBracket({ games, currentRating: FORM_GATE_RATING, mode: 'blitz', goal: FORM_GATE_GOAL, nowSec: NOW });
    const noGoal = computeSmartBracket({ games, currentRating: FORM_GATE_RATING, mode: 'blitz', goal: null, nowSec: NOW });
    assert.equal(result.stats.performance, null);
    assert.equal(result.ceiling, noGoal.ceiling);
    assert.equal(result.stats.ceilingSource, noGoal.stats.ceilingSource);
    assert.equal(result.copyVersion, 10);
});

test('a confidently overrated player holds the ceiling at the minimum gap and snugs the floor with one line each', () => {
    // 20 losses to 1300-rated opponents -> perf far below 1500 with perf + sd < 1500 - 15 (overrated).
    const games = oppSessions([Array.from({ length: 20 }, () => ({ rating: 1500, result: 'loss', opp: 1300 }))], { endAtNow: true, gameGap: 43200 });
    const result = computeSmartBracket({ games, currentRating: 1500, mode: 'blitz', goal: null, nowSec: NOW });
    const perf = result.stats.performance;
    assert.ok(perf.perf + perf.sd < 1500 - 15);          // overrated gate fires
    assert.equal(perf.probAboveCurrent, 0);              // confidently overrated -> p 0, so form factor f = 0
    // Part N (supersedes M2): f = 0 pins the ceiling gap to minCeilGap = max(2*avgWinPts, round(12*modeScale))
    // = max(2*8, 12) = 16, so the ceiling is current + 16 = 1516 (the old M2 hard pull-in is subsumed).
    assert.equal(result.ceiling, 1516);
    assert.equal(result.stats.ceilingSource, 'perfHold');
    assert.equal(result.floor, 1485);
    assert.equal(result.stats.floorSource, 'performance');
    // Exactly one floor line and one ceiling line (the perfHold line) are emitted.
    assert.equal(result.reasons.length, 2);
    assert.equal(result.reasons[1].text, 'Your recent play is running below your rating, so your target stays close at 1516.');
    const banned = ['—', '–', '−', '~'];
    for (const ch of banned) assert.ok(!result.reasons[1].text.includes(ch));
    assert.equal((result.reasons[1].text.match(/\./g) || []).length, 1);
});

// ----- Part N: continuous form-scaled ceiling (supersedes M2's binary overrated pull-in) -----

// A rapid fixture whose swings ceiling gap sits well above its minimum: three sessions that
// each climb +4 x10 (wins) then fall -4 x10 (losses), so avgWinPts 4 keeps minCeilGap small
// while the median session upswing (36) makes the unscaled gap large. Opponent rating tunes
// the performance estimate, hence probAboveCurrent (rounded to 2 decimals) and the form factor.
function formScaledSession(opp) {
    const specs = [];
    let r = 2400;
    for (let i = 0; i < 10; i += 1) { r += 4; specs.push({ rating: r, result: 'win', opp }); }
    for (let i = 0; i < 10; i += 1) { r -= 4; specs.push({ rating: r, result: 'loss', opp }); }
    return specs;
}
function formScaledGames(opp) {
    return oppSessions([formScaledSession(opp), formScaledSession(opp), formScaledSession(opp)], { endAtNow: true });
}
const FORM_SCALED_RATING = 2407;

test('the user scenario interpolates the ceiling between the minimum and full gap when p is 0.30 to 0.55', () => {
    // opp 2390 -> perf 2390, probAboveCurrent 0.35 (rounded). Rapid modeScale 0.7, avgWinPts 4,
    // typicalUpswing 36 => unscaled ceilGap = 36 + 0.5*4 = 38 (the full gap), and
    // minCeilGap = max(2*0.7*4, round(12*0.7)) = max(5.6, 8) = 8.
    // f = clamp((0.35 - 0.30) / 0.25, 0, 1) = 0.2, so ceilGap = 8 + 0.2*(38 - 8) = 14 and the
    // ceiling lands at round(2407 + 14) = 2421 -- between minGap (+8 => 2415) and full gap (+38 => 2445).
    const result = computeSmartBracket({ games: formScaledGames(2390), currentRating: FORM_SCALED_RATING, mode: 'rapid', goal: null, nowSec: NOW });
    assert.equal(result.stats.performance.probAboveCurrent, 0.35);
    assert.equal(result.stats.avgWinPts, 4);
    assert.equal(result.stats.typicalUpswing, 36);
    assert.equal(result.ceiling, 2421);
    assert.equal(result.stats.ceilingSource, 'perfHold');
    assert.ok(result.reasons.some((reason) => reason.text === 'Your recent play is running below your rating, so your target stays close at 2421.'));
});

test('a form factor of zero (p at or below 0.30) pins the ceiling gap to its minimum', () => {
    // opp 2383 -> probAboveCurrent 0.30 exactly => f = 0, so ceilGap = minCeilGap = 8 and the
    // ceiling collapses to round(2407 + 8) = 2415 regardless of the large unscaled gap (38).
    const result = computeSmartBracket({
        games: formScaledGames(2383),
        currentRating: FORM_SCALED_RATING,
        mode: 'rapid',
        goal: { target: 2450, startRating: FORM_SCALED_RATING, setAt: 1 },
        nowSec: NOW
    });
    assert.equal(result.stats.performance.probAboveCurrent, 0.30);
    assert.equal(result.ceiling, 2415);
    assert.equal(result.stats.ceilingSource, 'perfHold');
    assert.equal(result.goal.target, 2450);
    assert.ok(result.reasons.some((reason) => reason.text === 'Your recent play is running below your rating, so your target stays close at 2415.'));
});

test('a form factor of one (p at or above 0.55) leaves the full gap, matching the performance-null twin', () => {
    // opp 2413 -> probAboveCurrent 0.55 exactly => f = 1, so ceilGap = unscaled 38 and the ceiling
    // is round(2407 + 38) = 2445, identical to the same fixture with no opponent tags (f defaults to 1).
    const scaled = computeSmartBracket({ games: formScaledGames(2413), currentRating: FORM_SCALED_RATING, mode: 'rapid', goal: null, nowSec: NOW });
    assert.equal(scaled.stats.performance.probAboveCurrent, 0.55);
    assert.equal(scaled.ceiling, 2445);
    assert.equal(scaled.stats.ceilingSource, 'swings');

    const nullTwin = computeSmartBracket({
        games: formScaledGames(2413).map((game) => ({ ...game, opp: null })),
        currentRating: FORM_SCALED_RATING, mode: 'rapid', goal: null, nowSec: NOW
    });
    assert.equal(nullTwin.stats.performance, null);   // no opponent tags -> null layer -> f = 1
    assert.equal(nullTwin.ceiling, scaled.ceiling);   // the full gap is unchanged at f = 1
    assert.equal(nullTwin.ceiling, 2445);
});

test('the rising-form climb headroom is scaled by the form factor', () => {
    // Six blocks of 3 wins (+10) then 2 losses (-4) climbing from 1400 to 1532, all opponent-tagged.
    // avgWinPts 10, typicalUpswing 25 (fallback), minCeilGap = max(2*10, 12) = 20, unscaled ceilGap
    // = 25 + 0.5*10 = 30. opp 1465 -> probAboveCurrent 0.45 => f = clamp((0.45 - 0.30)/0.25,0,1) = 0.6.
    // Base swings ceiling = round(1532 + (20 + 0.6*(30 - 20))) = round(1532 + 26) = 1558, and the
    // climb headroom is round(avgWinPts * f) = round(10 * 0.6) = 6 (not the full 10), so ceiling = 1564.
    const climbFormGames = (opp) => {
        const specs = [];
        let r = 1400;
        for (let b = 0; b < 6; b += 1) {
            for (let i = 0; i < 3; i += 1) { r += 10; specs.push({ rating: r, result: 'win', opp }); }
            for (let i = 0; i < 2; i += 1) { r -= 4; specs.push({ rating: r, result: 'loss', opp }); }
        }
        return oppSessions([specs], { endAtNow: true });
    };
    const games = climbFormGames(1465);
    const cur = games[games.length - 1].rating;
    assert.equal(cur, 1532);
    const result = computeSmartBracket({ games, currentRating: cur, mode: 'blitz', goal: null, nowSec: NOW });
    assert.equal(result.stats.performance.probAboveCurrent, 0.45);
    assert.ok(result.stats.slopePerWeek >= 10 && result.stats.net10 > 0);   // rising-form headroom fires
    assert.equal(result.stats.avgWinPts, 10);
    assert.equal(result.ceiling, 1564);
    assert.equal(result.stats.ceilingSource, 'climb');

    // Performance-null twin: f = 1, so both the base gap and the headroom are full (round(10) = 10):
    // ceiling = round(1532 + 30) + 10 = 1572, strictly higher than the form-scaled 1564.
    const nullTwin = computeSmartBracket({
        games: climbFormGames(1465).map((game) => ({ ...game, opp: null })),
        currentRating: cur, mode: 'blitz', goal: null, nowSec: NOW
    });
    assert.equal(nullTwin.stats.performance, null);
    assert.equal(nullTwin.ceiling, 1572);
    assert.ok(nullTwin.ceiling > result.ceiling);
});
