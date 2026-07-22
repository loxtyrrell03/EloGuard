// Empirical calibration harness for the EloGuard rating estimator.
//
// Samples finished games from chess.com's public API (both players' pool ratings
// at game time = ground truth), runs the full review pipeline on them, and
// reports estimate-vs-actual error by rating band and time class.
//
// Usage:
//   node tests/calibrate.js fetch    [--target 80]   -> tests/calib_games.json
//   node tests/calibrate.js analyze  [--depth 12]    -> tests/calib_results.json (resumable)
//   node tests/calibrate.js report                    -> error tables (re-runs estimateRating
//                                                        with the CURRENT lib/review-core.js,
//                                                        so refits can be evaluated instantly)
const path = require('path');
const fs = require('fs');
const repo = path.join(__dirname, '..');
const core = require(path.join(repo, 'lib', 'review-core.js'));
const bookSrc = fs.readFileSync(path.join(repo, 'lib', 'book.js'), 'utf8');
core.setBook(JSON.parse(bookSrc.slice(bookSrc.indexOf('['), bookSrc.lastIndexOf(']') + 1)));

const GAMES_FILE = path.join(__dirname, 'calib_games.json');
const RESULTS_FILE = path.join(__dirname, 'calib_results.json');
const UA = 'EloGuard-calibration/1.0 (personal extension; contact loxtyrrell03@gmail.com)';

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? process.argv[i + 1] : dflt;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  await sleep(200);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
      if (resp.status === 429) { await sleep(3000); continue; }
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) { await sleep(1000); }
  }
  return null;
}

function parseTimeControl(str) {
  // "600", "180+2", "1/86400" (daily)
  if (!str) return null;
  if (str.includes('/')) return null; // daily — skip
  const m = String(str).match(/^(\d+)(?:\+(\d+))?$/);
  if (!m) return null;
  return { base: +m[1], inc: +(m[2] || 0) };
}

function movetextToSans(pgn) {
  const idx = pgn.indexOf('\n\n');
  let text = idx > -1 ? pgn.slice(idx + 2) : pgn;
  text = text.replace(/\{[^}]*\}/g, ' ').replace(/\$\d+/g, ' ');
  const sans = [];
  for (const tok of text.split(/\s+/)) {
    if (!tok || /^\d+\.+$/.test(tok) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;
    const clean = tok.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
    if (!clean) continue;
    if (!/^(O-O(-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?)[+#]?$/.test(clean)) return null;
    sans.push(clean);
  }
  return sans.length ? sans : null;
}

function bandOf(rating) {
  if (rating < 800) return '<800';
  if (rating < 1200) return '800-1199';
  if (rating < 1600) return '1200-1599';
  if (rating < 2000) return '1600-1999';
  if (rating < 2400) return '2000-2399';
  return '2400+';
}

// ---------------- fetch ----------------

async function cmdFetch() {
  const target = +arg('target', 80);
  const PER_BAND_CAP = Math.ceil(target / 4);
  const games = [];
  const bandCounts = {};
  const seenPlayers = new Set();

  async function tryPlayer(username) {
    if (games.length >= target || seenPlayers.has(username)) return;
    seenPlayers.add(username);
    const archives = await fetchJson(`https://api.chess.com/pub/player/${username}/games/archives`);
    if (!archives || !archives.archives || !archives.archives.length) return;
    const month = await fetchJson(archives.archives[archives.archives.length - 1]);
    if (!month || !month.games) return;
    for (let i = month.games.length - 1; i >= 0; i--) {
      const g = month.games[i];
      if (g.rules !== 'chess' || !g.rated || !g.pgn) continue;
      if (!['bullet', 'blitz', 'rapid'].includes(g.time_class)) continue;
      const tc = parseTimeControl(g.time_control);
      if (!tc) continue;
      const wr = g.white && g.white.rating, br = g.black && g.black.rating;
      if (!wr || !br || wr < 100 || br < 100) continue;
      const sans = movetextToSans(g.pgn);
      if (!sans || sans.length < 24 || sans.length > 160) continue;
      const prepared = core.prepareGame(sans);
      if (prepared.error) continue;
      const band = bandOf((wr + br) / 2);
      if ((bandCounts[band] || 0) >= PER_BAND_CAP) continue;
      bandCounts[band] = (bandCounts[band] || 0) + 1;
      games.push({
        url: g.url, timeClass: g.time_class, timeControl: tc,
        whiteRating: wr, blackRating: br, sans
      });
      console.log(`[${games.length}/${target}] ${band.padEnd(9)} ${g.time_class.padEnd(6)} ${g.time_control.padEnd(7)} ${wr}v${br} ${username}`);
      break; // one game per player
    }
  }

  // Broad-population sample: country player lists (skew low/mid ratings)
  const COUNTRIES = ['IS', 'EE', 'NZ', 'UY', 'SG', 'IE'];
  for (const cc of COUNTRIES) {
    if (games.length >= target) break;
    const list = await fetchJson(`https://api.chess.com/pub/country/${cc}/players`);
    if (!list || !list.players || !list.players.length) continue;
    const step = Math.max(1, Math.floor(list.players.length / 30));
    for (let i = 0; i < list.players.length && games.length < target; i += step) {
      await tryPlayer(list.players[i]);
    }
  }
  // High-band sample: titled players
  for (const title of ['FM', 'IM', 'NM']) {
    if (games.length >= target) break;
    const list = await fetchJson(`https://api.chess.com/pub/titled/${title}`);
    if (!list || !list.players) continue;
    const step = Math.max(1, Math.floor(list.players.length / 20));
    for (let i = 0; i < list.players.length && games.length < target; i += step) {
      await tryPlayer(list.players[i]);
    }
  }

  fs.writeFileSync(GAMES_FILE, JSON.stringify(games, null, 1));
  console.log(`\nsaved ${games.length} games -> ${GAMES_FILE}`);
  console.log('bands:', JSON.stringify(bandCounts));
}

// ---------------- analyze ----------------

function startEngine() {
  const enginePath = path.join(repo, 'engine', 'stockfish-18-lite-single.js');
  const wasmPath = path.join(repo, 'engine', 'stockfish-18-lite-single.wasm');
  const INIT_ENGINE = require(enginePath);
  const engine = { locateFile: (p) => (p.indexOf('.wasm') > -1 ? wasmPath : enginePath) };
  let handlers = [];
  engine.listener = (line) => { if (typeof line === 'string') for (const fn of handlers.slice()) fn(line); };
  const api = {
    send: (cmd) => engine.sendCommand(cmd),
    onLine: (fn) => handlers.push(fn),
    offAll: () => { handlers = []; }
  };
  const ready = new Promise((resolve) => {
    INIT_ENGINE()(engine).then(function checkIfReady() {
      if (engine._isReady) {
        if (!engine._isReady()) return setTimeout(checkIfReady, 10);
        delete engine._isReady;
      }
      engine.sendCommand = (cmd) => setImmediate(() =>
        engine.ccall('command', null, ['string'], [cmd], { async: /^go\b/.test(cmd) }));
      api.onLine((line) => {
        if (line === 'uciok') {
          api.send('setoption name Threads value 1');
          api.send('setoption name Hash value 128');
          api.send('setoption name MultiPV value 1');
          api.send('isready');
        } else if (line === 'readyok') { api.offAll(); resolve(); }
      });
      api.send('uci');
    });
  });
  api.ready = ready;
  return api;
}

function parseScore(tokens, i, whiteToMove) {
  const kind = tokens[i + 1];
  const value = parseInt(tokens[i + 2], 10);
  if (Number.isNaN(value)) return null;
  const sign = whiteToMove ? 1 : -1;
  if (kind === 'cp') return { cp: value * sign };
  if (kind === 'mate') return { mate: value * sign };
  return null;
}

function searchPosition(api, moves, count, depth) {
  return new Promise((resolve) => {
    const whiteToMove = count % 2 === 0;
    const pvs = {};
    api.onLine((line) => {
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
        api.offAll();
        resolve({
          best: pvs[1] ? pvs[1].score : null,
          second: pvs[2] ? pvs[2].score : null,
          bestMove: bm === '(none)' ? (pvs[1] ? pvs[1].move : null) : bm,
          depth: pvs[1] ? pvs[1].depth : 0
        });
      }
    });
    const prefix = moves.slice(0, count).join(' ');
    api.send(count === 0 ? 'position startpos' : 'position startpos moves ' + prefix);
    api.send('go depth ' + depth);
  });
}

async function cmdAnalyze() {
  const depth = +arg('depth', 12);
  const games = JSON.parse(fs.readFileSync(GAMES_FILE, 'utf8'));
  let results = [];
  if (fs.existsSync(RESULTS_FILE)) results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
  const done = new Set(results.map((r) => r.url));
  const api = startEngine();
  await api.ready;
  const t0 = Date.now();
  for (let gi = 0; gi < games.length; gi++) {
    const g = games[gi];
    if (done.has(g.url)) continue;
    const prepared = core.prepareGame(g.sans);
    if (prepared.error) continue;
    const uciMoves = prepared.moves.map((m) => m.uci);
    const total = uciMoves.length + (prepared.terminal ? 0 : 1);
    const positions = [];
    api.send('ucinewgame');
    for (let i = 0; i < total; i++) {
      positions.push(Object.assign({ index: i }, await searchPosition(api, uciMoves, i, depth)));
    }
    const review = core.buildReview(prepared, positions, { timeControl: g.timeControl });
    results.push({
      url: g.url, depth, timeClass: g.timeClass, timeControl: g.timeControl,
      sides: ['w', 'b'].map((color) => ({
        color,
        actual: color === 'w' ? g.whiteRating : g.blackRating,
        stats: {
          accuracy: review.players[color].accuracy,
          acpl: review.players[color].acpl,
          scoredCount: review.players[color].scoredCount,
          complexity: review.players[color].complexity,
          bookMoves: review.players[color].bookMoves,
          blunderRate: review.players[color].blunderRate
        },
        phases: review.players[color].phases
      }))
    });
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 1));
    const elapsed = (Date.now() - t0) / 1000;
    console.log(`[${results.length}/${games.length}] ${g.timeClass.padEnd(6)} plies=${uciMoves.length} elapsed=${Math.round(elapsed)}s`);
  }
  console.log('analysis complete ->', RESULTS_FILE);
  api.send('quit');
  setTimeout(() => process.exit(0), 200);
}

// ---------------- report ----------------

function cmdReport() {
  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
  const rows = [];
  for (const r of results) {
    for (const side of r.sides) {
      if (!side.stats || side.stats.accuracy === null || side.stats.scoredCount < 8) continue;
      const est = core.estimateRating(side.stats, r.timeControl);
      if (!est) continue;
      rows.push({
        actual: side.actual, est: est.rating, err: est.rating - side.actual,
        timeClass: r.timeClass, band: bandOf(side.actual), n: side.stats.scoredCount
      });
    }
  }
  const groups = {};
  for (const row of rows) {
    for (const key of [`band ${row.band}`, `class ${row.timeClass}`, 'ALL']) {
      (groups[key] = groups[key] || []).push(row);
    }
  }
  const fmt = (v) => String(Math.round(v)).padStart(5);
  console.log('group                n   bias   MAE  stdev');
  for (const key of Object.keys(groups).sort()) {
    const errs = groups[key].map((r) => r.err);
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
    const mae = errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length;
    const sd = Math.sqrt(errs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / errs.length);
    console.log(`${key.padEnd(18)} ${String(errs.length).padStart(4)} ${fmt(mean)} ${fmt(mae)} ${fmt(sd)}`);
  }
  // per-phase bias (fits PHASE_ADJUST in lib/review-core.js)
  console.log('\nphase              n   bias   MAE');
  for (const ph of ['opening', 'middlegame', 'endgame']) {
    const errs = [];
    for (const r of results) {
      for (const side of r.sides) {
        const p = side.phases && side.phases[ph];
        if (!p || p.accuracy === null || p.scoredCount < 8) continue;
        const est = core.estimateRating(p, r.timeControl, ph);
        if (est) errs.push(est.rating - side.actual);
      }
    }
    if (!errs.length) continue;
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
    const mae = errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length;
    console.log(`${ph.padEnd(16)} ${String(errs.length).padStart(4)} ${fmt(mean)} ${fmt(mae)}`);
  }

  // correlation
  const xs = rows.map((r) => r.actual), ys = rows.map((r) => r.est);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  console.log(`\ncorrelation r = ${(sxy / Math.sqrt(sxx * syy)).toFixed(3)}  (n=${rows.length} sides)`);
  console.log(`regression est ~ actual: slope ${(sxy / sxx).toFixed(2)}, i.e. est = ${(my - (sxy / sxx) * mx).toFixed(0)} + ${(sxy / sxx).toFixed(2)}*actual`);
}

const cmd = process.argv[2];
if (cmd === 'fetch') cmdFetch();
else if (cmd === 'analyze') cmdAnalyze();
else if (cmd === 'report') cmdReport();
else console.log('usage: node tests/calibrate.js fetch|analyze|report');
