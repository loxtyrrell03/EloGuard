// End-to-end test of the EloGuard review pipeline with the real Stockfish build.
const path = require('path');
const fs = require('fs');
const repo = path.join(__dirname, '..');
const { Chess } = require(path.join(repo, 'lib', 'chess.js'));
const core = require(path.join(repo, 'lib', 'review-core.js'));

// load book
const bookSrc = fs.readFileSync(path.join(repo, 'lib', 'book.js'), 'utf8');
const book = JSON.parse(bookSrc.slice(bookSrc.indexOf('['), bookSrc.lastIndexOf(']') + 1));
core.setBook(book);

// ---------- unit tests ----------
let failures = 0;
function check(name, cond, extra) {
  if (!cond) { failures++; console.log('FAIL:', name, extra === undefined ? '' : JSON.stringify(extra)); }
  else console.log('ok:', name);
}

check('winPct cp0 = 50', Math.abs(core.winPctWhite({ cp: 0 }) - 50) < 1e-9);
check('winPct mate+ = 100', core.winPctWhite({ mate: 3 }) === 100);
check('winPct mate- = 0', core.winPctWhite({ mate: -2 }) === 0);
check('winPct +100cp ~ 59', Math.abs(core.winPctWhite({ cp: 100 }) - 59.1) < 1, core.winPctWhite({ cp: 100 }));
check('moveAccuracy(0)=100', core.moveAccuracy(0) === 100);
check('moveAccuracy(10) in (55,75)', core.moveAccuracy(10) > 55 && core.moveAccuracy(10) < 75, core.moveAccuracy(10));

const hangingCheckBefore = '4r1k1/8/1n6/8/Q7/8/8/4K3 w - - 0 1';
const hangingCheckBoard = new Chess(hangingCheckBefore);
const hangingCheckMove = hangingCheckBoard.move('Kd1');
const hangingCheckSac = core.sacrificedMaterial(hangingCheckBefore, hangingCheckBoard.fen(), hangingCheckMove);
check('check evasion does not turn an existing hanger into a sacrifice', hangingCheckSac === 0, hangingCheckSac);

const kingCheckClass = core.classifyMove({
  drop: 0,
  before: 70,
  after: 72,
  playedIsBest: true,
  gap: null,
  isBook: false,
  isForced: false,
  sacNet: 9,
  isRecapture: false,
  bestIsMateForMover: false,
  afterIsMateForMover: false,
  legalCount: 6,
  movePiece: 'k',
  wasInCheck: true
});
check('king move out of check is not brilliant', kingCheckClass !== 'brilliant', kingCheckClass);

const tacticalSacClass = core.classifyMove({
  drop: 0,
  before: 70,
  after: 74,
  playedIsBest: true,
  gap: null,
  isBook: false,
  isForced: false,
  sacNet: 3,
  isRecapture: false,
  bestIsMateForMover: false,
  afterIsMateForMover: false,
  legalCount: 12,
  movePiece: 'b',
  wasInCheck: false
});
check('real near-best non-king sacrifice can still be brilliant', tacticalSacClass === 'brilliant', tacticalSacClass);

const ruy = core.matchBook(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
check('book Ruy Lopez plies>=5', ruy.bookPlies >= 5, ruy);
check('book Ruy has name', !!ruy.opening && /Ruy|Spanish/i.test(ruy.opening.name), ruy.opening);

const statsGood = { accuracy: 90, acpl: 30, scoredCount: 30, complexity: 4.5 };
const statsMid = { accuracy: 80, acpl: 60, scoredCount: 30, complexity: 4.5 };
// Cross-pool ordering at equal stats is an empirical conversion outcome (chess.com
// pools are differently inflated), so assert only the model's real guarantee:
// on the underlying skill scale, the same stats imply more skill with less time.
check('less time implies more skill (lichess scale, in-range stats)',
  core.rawSkill(statsMid, 'bullet') > core.rawSkill(statsMid, 'blitz')
  && core.rawSkill(statsMid, 'blitz') > core.rawSkill(statsMid, 'rapid')
  && core.rawSkill(statsMid, 'rapid') > core.rawSkill(statsMid, 'classical'),
  { bullet: core.rawSkill(statsMid, 'bullet'), rapid: core.rawSkill(statsMid, 'rapid') });
const rRapidGood = core.estimateRating(statsGood, 'rapid').rating;
const statsBad = { accuracy: 68, acpl: 130, scoredCount: 30, complexity: 4.5 };
check('90%acc >> 68%acc', rRapidGood - core.estimateRating(statsBad, 'rapid').rating > 400, { good: rRapidGood, bad: core.estimateRating(statsBad, 'rapid').rating });
const statsShort = { accuracy: 90, acpl: 30, scoredCount: 4, complexity: 4.5 };
check('short game shrinks toward mean', core.estimateRating(statsShort, 'rapid').rating < rRapidGood, core.estimateRating(statsShort, 'rapid'));

// granular time controls: chess.com pool classification via T = base + 40*inc
check('2+1 is bullet', core.timeClassOf({ base: 120, inc: 1 }) === 'bullet');
check('3+0 is blitz', core.timeClassOf({ base: 180, inc: 0 }) === 'blitz');
check('3+2 is blitz', core.timeClassOf({ base: 180, inc: 2 }) === 'blitz');
check('5+5 is blitz', core.timeClassOf({ base: 300, inc: 5 }) === 'blitz');
check('10+0 is rapid', core.timeClassOf({ base: 600, inc: 0 }) === 'rapid');
check('15+10 is rapid', core.timeClassOf({ base: 900, inc: 10 }) === 'rapid');
check('30+0 is rapid', core.timeClassOf({ base: 1800, inc: 0 }) === 'rapid');
// same stats, same pool: less thinking time implies more skill (in-range stats;
// extreme stats clamp at the fitted anchor bounds and lose granularity).
const r30 = core.estimateRating(statsMid, { base: 180, inc: 0 }).rating;
const r32 = core.estimateRating(statsMid, { base: 180, inc: 2 }).rating;
const r50 = core.estimateRating(statsMid, { base: 300, inc: 0 }).rating;
check('3+0 >= 3+2 >= 5+0 for same stats', r30 >= r32 && r32 >= r50, { r30, r32, r50 });
check('rawSkill strictly increases with less time',
  core.rawSkill(statsMid, { base: 180, inc: 0 }) > core.rawSkill(statsMid, { base: 180, inc: 2 })
  && core.rawSkill(statsMid, { base: 180, inc: 2 }) > core.rawSkill(statsMid, { base: 300, inc: 0 })
  && core.rawSkill(statsMid, { base: 600, inc: 0 }) > core.rawSkill(statsMid, { base: 900, inc: 10 }));
const r100 = core.estimateRating(statsMid, { base: 600, inc: 0 }).rating;
const r1510 = core.estimateRating(statsMid, { base: 900, inc: 10 }).rating;
check('10+0 >= 15+10 for same stats', r100 >= r1510, { r100, r1510 });
check('pool reported', core.estimateRating(statsGood, { base: 180, inc: 2 }).pool === 'blitz');
check('legacy string still supported', typeof core.estimateRating(statsGood, 'blitz').rating === 'number');

// anchored strength: baseline pins the level, features move it by a shrunk delta
const efr = core.CALIBRATION.cov / core.CALIBRATION.varRating;
const fAt = (ccRating, pool) => {
  // feature exactly at the expected level for this baseline
  const lichess = core.chessComToLichess(pool, ccRating);
  return core.CALIBRATION.meanFeature + efr * (Math.max(800, Math.min(2600, lichess)) - core.CALIBRATION.meanActual);
};
const atLevel = core.anchoredStrength(fAt(2400, 'blitz'), 1500, 'blitz', 2400);
check('anchored: at-baseline play stays near baseline', Math.abs(atLevel.strength - 2400) <= 100, atLevel);
const below = core.anchoredStrength(fAt(2400, 'blitz') - 300, 1500, 'blitz', 2400);
const above = core.anchoredStrength(fAt(2400, 'blitz') + 300, 1500, 'blitz', 2400);
check('anchored: worse play -> negative delta, better -> positive', below.delta < 0 && above.delta > 0, { below: below.delta, above: above.delta });
const fewMoves = core.anchoredStrength(fAt(2400, 'blitz') - 300, 30, 'blitz', 2400);
check('anchored: one game moves the needle far less than 50', Math.abs(fewMoves.delta) < Math.abs(below.delta), { one: fewMoves.delta, fifty: below.delta });
check('anchored: uncertainty tightens with data', fewMoves.uncertainty >= atLevel.uncertainty, { one: fewMoves.uncertainty, fifty: atLevel.uncertainty });

// single-game performance: half-credit quality-only delta, capped +/-600
const disaster = { accuracy: 62, acpl: 140, scoredCount: 35, complexity: 5, bookMoves: 6, blunderRate: 5 / 35 };
const perfBad = core.gamePerformance(disaster, { base: 180, inc: 0 }, 2400);
check('gamePerformance: 5-blunder game at 2400 reads ~1650-1850', perfBad && perfBad.perf >= 1550 && perfBad.perf <= 1950, perfBad);
const solid = { accuracy: 89, acpl: 28, scoredCount: 35, complexity: 4.5, bookMoves: 8, blunderRate: 0 };
const perfGood = core.gamePerformance(solid, { base: 180, inc: 0 }, 2400);
check('gamePerformance: clean game at 2400 stays near baseline', perfGood && perfGood.perf >= 2300 && perfGood.perf <= 2600, perfGood);
const perfMidGood = core.gamePerformance(solid, { base: 180, inc: 0 }, 1200);
check('gamePerformance: great game at 1200 reads well above baseline', perfMidGood && perfMidGood.delta >= 150, perfMidGood);
check('gamePerformance: null without a baseline', core.gamePerformance(disaster, { base: 180, inc: 0 }, undefined) === null);
const solidAdj = core.adjustedStats(solid, { base: 180, inc: 0 });
const solidFeature = core.performanceFeatureFromAdjusted(solidAdj);
const solidAnchored = core.anchoredPerformance(solidFeature, solid.scoredCount, 'blitz', 2400);
check('anchoredPerformance: aggregate uses same quality signal as gamePerformance',
  solidAnchored && Math.abs(Math.round(solidAnchored.delta / 25) * 25 - perfGood.delta) <= 25,
  { aggregate: solidAnchored, single: perfGood });

// phase segmentation
const phasePrep = core.prepareGame(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
const earlyPhases = core.assignPhases(phasePrep.fens, phasePrep.bookPlies);
check('early moves are opening', earlyPhases.every((p) => p === 'opening'), earlyPhases);
// K+R vs K+R position: 2 majors -> endgame from ply 0
const endFens = ['4k3/8/8/8/8/8/8/R3K2r w - - 0 1', '4k3/8/8/8/8/8/8/R3K2r b - - 0 1'];
check('bare-rook position is endgame', core.assignPhases(endFens, 0)[0] === 'endgame');

// multi-game aggregation
const NOW = 1750000000000;
const mkEntry = (daysAgo, tc, acc, acpl, n) => ({
  ts: NOW - daysAgo * 86400000, timeControl: tc,
  stats: { accuracy: acc, acpl, scoredCount: n, complexity: 4.5 },
  phases: {
    opening: { accuracy: acc + 3, acpl: acpl * 0.6, scoredCount: Math.round(n / 4), complexity: 4 },
    middlegame: { accuracy: acc - 2, acpl: acpl * 1.3, scoredCount: Math.round(n / 2), complexity: 5 },
    endgame: { accuracy: acc + 1, acpl, scoredCount: Math.round(n / 4), complexity: 4.5 }
  }
});
const fewGames = [mkEntry(1, { base: 180, inc: 0 }, 78, 62, 30)];
const manyGames = [];
for (let i = 0; i < 20; i++) manyGames.push({ ...mkEntry(i, { base: 180, inc: 0 }, 78, 62, 30), key: 'k' + i });
const profFew = core.aggregateProfile(fewGames, NOW);
const profMany = core.aggregateProfile(manyGames, NOW);
check('profile builds', !!profFew && !!profMany);
// More data -> steeper response (this is where multi-game discrimination lives).
// End-to-end uncertainty is NOT asserted monotone across game counts: it is
// scaled by the local lichess->chess.com conversion slope, which shifts as the
// estimate moves between conversion segments.
check('profile slope grows with data toward cap',
  core.slopeFor(30) < core.slopeFor(300) && core.slopeFor(300) <= core.CALIBRATION.slopeMax,
  { s30: core.slopeFor(30), s300: core.slopeFor(300) });
const skillDir = core.rawSkill(fewGames[0].stats, fewGames[0].timeControl) >= core.CALIBRATION.meanFeature ? 1 : -1;
check('more games amplifies distance from the population center',
  skillDir * (profMany.pools.blitz.rating - profFew.pools.blitz.rating) >= 0,
  { few: profFew.pools.blitz.rating, many: profMany.pools.blitz.rating, skillDir });
check('profile has all phases', ['opening', 'middlegame', 'endgame'].every((p) => profMany.phases[p]), Object.keys(profMany.phases));
check('profile counts games', profMany.totalGames === 20, profMany.totalGames);
const mixed = [...manyGames, mkEntry(0, { base: 600, inc: 0 }, 90, 30, 40)];
const profMixed = core.aggregateProfile(mixed, NOW);
check('pools kept separate', !!profMixed.pools.blitz && !!profMixed.pools.rapid, Object.keys(profMixed.pools));
check('empty profile is null', core.aggregateProfile([], NOW) === null);

const inflatedExtras = [85, 83, 86, 78, 84, 80, 85, 83, 86].map((acc, i) => ({
  ts: NOW - i * 1000,
  timeControl: { base: 600, inc: 0 },
  stats: {
    accuracy: acc,
    acpl: [42, 50, 38, 75, 48, 65, 45, 52, 37][i],
    scoredCount: 30,
    complexity: 4.5,
    bookMoves: 12,
    blunderRate: 0,
    fastRate: 0.2,
    scramble: 0.02
  }
}));
const inflatedProfile = core.aggregateProfile(inflatedExtras, NOW, { noDecay: true });
const inflatedPool = inflatedProfile.pools.rapid;
const rangePerf = core.anchoredPerformance(inflatedPool.performanceFeature, inflatedPool.performanceEffMoves, 'rapid', 2401);
const rowDeltaMean = inflatedExtras.reduce((sum, e) => sum + core.gamePerformance(e.stats, e.timeControl, 2401).delta, 0) / inflatedExtras.length;
const fullStrength = core.anchoredStrength(inflatedPool.feature, inflatedPool.effMoves, 'rapid', 2401);
check('profile anchored card tracks recent played-like rows, not full strength extras',
  rangePerf.delta < 0 && Math.abs(rangePerf.delta - rowDeltaMean) <= 75 && fullStrength.delta > rangePerf.delta + 200,
  { range: rangePerf.delta, rowMean: rowDeltaMean, full: fullStrength.delta });

// ---------- engine-driven review of the Opera Game ----------
const OPERA = ('e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 ' +
  'Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#').split(' ');

const prepared = core.prepareGame(OPERA);
if (prepared.error) { console.log('PREPARE ERROR', prepared.error); process.exit(1); }
check('terminal checkmate', prepared.terminal === 'checkmate', prepared.terminal);
check('opening detected', !!prepared.opening, prepared.opening);
console.log('opening:', prepared.opening, 'bookPlies:', prepared.bookPlies);

const enginePath = path.join(repo, 'engine', 'stockfish-18-lite-single.js');
const wasmPath = path.join(repo, 'engine', 'stockfish-18-lite-single.wasm');
const INIT_ENGINE = require(enginePath);
const engine = { locateFile: (p) => (p.indexOf('.wasm') > -1 ? wasmPath : enginePath) };

INIT_ENGINE()(engine).then(function checkIfReady() {
  if (engine._isReady) {
    if (!engine._isReady()) return setTimeout(checkIfReady, 10);
    delete engine._isReady;
  }
  engine.sendCommand = (cmd) => {
    setImmediate(() => engine.ccall('command', null, ['string'], [cmd], { async: /^go\b/.test(cmd) }));
  };
  main().catch((e) => { console.error(e); process.exit(1); });
});

let lineHandlers = [];
function onLine(fn) { lineHandlers.push(fn); }
function offAll() { lineHandlers = []; }

function send(cmd) { engine.sendCommand(cmd); }

function initUci() {
  return new Promise((resolve) => {
    onLine((line) => {
      if (line === 'uciok') {
        send('setoption name Threads value 1');
        send('setoption name Hash value 128');
        send('setoption name MultiPV value 2');
        send('isready');
      } else if (line === 'readyok') { offAll(); resolve(); }
    });
    send('uci');
  });
}

// Same parsing approach as engine/engine.js
function parseScore(tokens, i, whiteToMove) {
  const kind = tokens[i + 1];
  const value = parseInt(tokens[i + 2], 10);
  if (Number.isNaN(value)) return null;
  const sign = whiteToMove ? 1 : -1;
  if (kind === 'cp') return { cp: value * sign };
  if (kind === 'mate') return { mate: value * sign };
  return null;
}

function searchPosition(moves, count, depth) {
  return new Promise((resolve) => {
    const whiteToMove = count % 2 === 0;
    const pvs = {};
    onLine((line) => {
      if (line.startsWith('info ') && line.indexOf(' pv ') > -1 && line.indexOf(' score ') > -1) {
        const tokens = line.split(/\s+/);
        let d = 0, mpv = 1, score = null, move = null;
        for (let i = 0; i < tokens.length; i++) {
          if (tokens[i] === 'depth') d = parseInt(tokens[i + 1], 10) || 0;
          else if (tokens[i] === 'multipv') mpv = parseInt(tokens[i + 1], 10) || 1;
          else if (tokens[i] === 'score') score = parseScore(tokens, i, whiteToMove);
          else if (tokens[i] === 'pv') { move = tokens[i + 1] || null; break; }
        }
        if (score && move) {
          const prev = pvs[mpv];
          if (!prev || d >= prev.depth) pvs[mpv] = { score, move, depth: d };
        }
      } else if (line.startsWith('bestmove')) {
        const bm = line.split(/\s+/)[1];
        offAll();
        resolve({
          best: pvs[1] ? pvs[1].score : null,
          second: pvs[2] ? pvs[2].score : null,
          secondMove: pvs[2] ? pvs[2].move : null,
          bestMove: bm === '(none)' ? (pvs[1] ? pvs[1].move : null) : bm,
          depth: pvs[1] ? pvs[1].depth : 0
        });
      }
    });
    const prefix = moves.slice(0, count).join(' ');
    send(count === 0 ? 'position startpos' : 'position startpos moves ' + prefix);
    send('go depth ' + depth);
  });
}

function reviewPositionsToAnalyze(prepared) {
  const indexes = new Set();
  for (let i = 0; i < prepared.moves.length; i++) {
    if (i < prepared.bookPlies || prepared.legalCounts[i] === 1) continue;
    indexes.add(i);
    if (!(prepared.terminal && i + 1 === prepared.moves.length)) indexes.add(i + 1);
  }
  return [...indexes].sort((a, b) => a - b);
}

async function main() {
  engine.listener = (line) => { if (typeof line === 'string') for (const fn of lineHandlers.slice()) fn(line); };
  await initUci();
  const uciMoves = prepared.moves.map((m) => m.uci);
  const indexes = reviewPositionsToAnalyze(prepared);
  const positions = [];
  const t0 = Date.now();
  for (const i of indexes) {
    const r = await searchPosition(uciMoves, i, 12);
    positions.push(Object.assign({ index: i }, r));
  }
  console.log(`analyzed ${indexes.length}/${uciMoves.length} positions in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const review = core.buildReview(prepared, positions, { timeClass: 'rapid' });

  // print the annotated game
  for (const mv of review.moves) {
    const num = mv.color === 'w' ? Math.ceil(mv.ply / 2) + '.' : '   ';
    console.log(
      String(num).padEnd(5),
      mv.san.padEnd(8),
      mv.cls.padEnd(11),
      ('drop ' + mv.drop.toFixed(1)).padEnd(11),
      'eval ' + mv.evalDisplay.padEnd(7),
      mv.bestSan && mv.bestSan !== mv.san ? 'best ' + mv.bestSan : ''
    );
  }
  const w = review.players.w, b = review.players.b;
  console.log('WHITE acc', w.accuracy?.toFixed(1), 'acpl', Math.round(w.acpl), 'est', w.estimate, 'counts', JSON.stringify(w.counts));
  console.log('BLACK acc', b.accuracy?.toFixed(1), 'acpl', Math.round(b.acpl), 'est', b.estimate, 'counts', JSON.stringify(b.counts));

  // assertions
  check('book/blunder stats present', typeof review.players.w.bookMoves === 'number'
    && typeof review.players.b.blunderRate === 'number'
    && review.players.b.blunderRate > 0, // 15...Nxd7 was a blunder
    { wBook: review.players.w.bookMoves, bBlunder: review.players.b.blunderRate });
  const qb8 = review.moves.find((m) => m.san === 'Qb8+');
  check('Qb8+ is brilliant', qb8 && qb8.cls === 'brilliant', qb8 && qb8.cls);
  check('review moves carry from/to squares (board glyphs)', qb8 && qb8.from === 'b3' && qb8.to === 'b8', qb8 && { from: qb8.from, to: qb8.to });
  check('white accuracy > black accuracy', w.accuracy > b.accuracy, { w: w.accuracy, b: b.accuracy });
  check('black has mistakes/blunders', (b.counts.blunder + b.counts.mistake + b.counts.inaccuracy + b.counts.miss) >= 2, b.counts);
  check('white est > black est', w.estimate.rating > b.estimate.rating, { w: w.estimate, b: b.estimate });
  check('book plies detected', review.bookPlies >= 4, review.bookPlies);
  const forcedMoves = review.moves.filter((m) => m.cls === 'forced');
  console.log('forced moves:', forcedMoves.map((m) => m.san).join(', ') || 'none');

  console.log(failures ? `\n${failures} FAILURES` : '\nALL CHECKS PASSED');
  send('quit');
  setTimeout(() => process.exit(failures ? 1 : 0), 200);
}
