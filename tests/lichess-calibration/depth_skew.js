// Fits the depth-skew correction: the extension analyzes at d12-15, but the
// rating curves were trained on lichess's deep server analysis. Shallow search
// over-penalizes moves in sharp positions. This job re-analyzes a stratified
// sample of the training games with OUR engine (extension pipeline, d12) and
// regresses the feature deltas (deep - shallow) on position complexity.
const fs = require('fs');
const path = require('path');
const repo = 'C:/Users/loxty/Desktop/Development & AI/Projects/Repos/EloGuard';
const core = require(path.join(repo, 'lib', 'review-core.js'));
const bookSrc = fs.readFileSync(path.join(repo, 'lib', 'book.js'), 'utf8');
core.setBook(JSON.parse(bookSrc.slice(bookSrc.indexOf('['), bookSrc.lastIndexOf(']') + 1)));

const DEPTH = 12;
const SAMPLE = 150;
const OUT = path.join(__dirname, 'depth_skew_results.json');

const lines = fs.readFileSync(path.join(__dirname, 'features3.jsonl'), 'utf8').trim().split('\n');
const games = lines.map((l) => JSON.parse(l)).filter((g) => g.sans);
// stratify by white-side complexity so the regression sees the full range
games.sort((a, b) => (a.w.stats.complexity || 0) - (b.w.stats.complexity || 0));
const step = Math.max(1, Math.floor(games.length / SAMPLE));
const sample = [];
for (let i = 0; i < games.length && sample.length < SAMPLE; i += step) sample.push(games[i]);
console.log(`sampling ${sample.length} of ${games.length} games at depth ${DEPTH}`);

// resume support
let results = [];
if (fs.existsSync(OUT)) results = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const done = new Set(results.map((r) => r.sans));

const enginePath = path.join(repo, 'engine', 'stockfish-18-lite-single.js');
const wasmPath = path.join(repo, 'engine', 'stockfish-18-lite-single.wasm');
const INIT_ENGINE = require(enginePath);
const engine = { locateFile: (p) => (p.indexOf('.wasm') > -1 ? wasmPath : enginePath) };
let handlers = [];
engine.listener = (line) => { if (typeof line === 'string') for (const fn of handlers.slice()) fn(line); };
const onLine = (fn) => handlers.push(fn);
const offAll = () => { handlers = []; };
const send = (cmd) => engine.sendCommand(cmd);

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

INIT_ENGINE()(engine).then(function checkIfReady() {
  if (engine._isReady) {
    if (!engine._isReady()) return setTimeout(checkIfReady, 10);
    delete engine._isReady;
  }
  engine.sendCommand = (cmd) => setImmediate(() =>
    engine.ccall('command', null, ['string'], [cmd], { async: /^go\b/.test(cmd) }));
  main().catch((e) => { console.error(e); process.exit(1); });
});

async function main() {
  await new Promise((resolve) => {
    onLine((line) => {
      if (line === 'uciok') {
        send('setoption name Threads value 1');
        send('setoption name Hash value 128');
        send('setoption name MultiPV value 1');
        send('isready');
      } else if (line === 'readyok') { offAll(); resolve(); }
    });
    send('uci');
  });

  const t0 = Date.now();
  for (let gi = 0; gi < sample.length; gi++) {
    const g = sample[gi];
    if (done.has(g.sans)) continue;
    const prepared = core.prepareGame(g.sans.split(' '));
    if (prepared.error) continue;
    const uciMoves = prepared.moves.map((m) => m.uci);
    const total = uciMoves.length + (prepared.terminal ? 0 : 1);
    const positions = [];
    send('ucinewgame');
    for (let i = 0; i < total; i++) {
      positions.push(Object.assign({ index: i }, await searchPosition(uciMoves, i, DEPTH)));
    }
    const review = core.buildReview(prepared, positions, { timeControl: g.tc });
    const row = { sans: g.sans, sides: {} };
    for (const color of ['w', 'b']) {
      const deep = g[color].stats;
      const shallow = review.players[color];
      if (!deep || !shallow || shallow.accuracy === null || deep.accuracy === null) continue;
      row.sides[color] = {
        complexity: deep.complexity,
        dAcc: deep.accuracy - shallow.accuracy,
        dLnAcpl: Math.log(Math.max(1, deep.acpl)) - Math.log(Math.max(1, shallow.acpl))
      };
    }
    results.push(row);
    fs.writeFileSync(OUT, JSON.stringify(results));
    if (results.length % 10 === 0) {
      console.log(`[${results.length}/${sample.length}] elapsed=${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }

  // regression: delta = a + b * (complexity - 4.5)
  const rows = [];
  for (const r of results) for (const c of ['w', 'b']) if (r.sides[c]) rows.push(r.sides[c]);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const reg = (xs, ys) => {
    const mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    return { slope: sxy / sxx, intercept: my - (sxy / sxx) * mx };
  };
  const cx = rows.map((r) => r.complexity - 4.5);
  const accFit = reg(cx, rows.map((r) => r.dAcc));
  const acplFit = reg(cx, rows.map((r) => r.dLnAcpl));
  console.log(`\nn=${rows.length} sides`);
  console.log(`dAcc (deep - d12) = ${accFit.intercept.toFixed(2)} + ${accFit.slope.toFixed(2)} * (complexity - 4.5)`);
  console.log(`dLnAcpl (deep - d12) = ${acplFit.intercept.toFixed(3)} + ${acplFit.slope.toFixed(3)} * (complexity - 4.5)`);
  console.log(`\nDEPTH_ADJUST = { accBase: ${accFit.intercept.toFixed(2)}, accPerCx: ${accFit.slope.toFixed(2)}, lnAcplBase: ${acplFit.intercept.toFixed(3)}, lnAcplPerCx: ${acplFit.slope.toFixed(3)} }`);
  send('quit');
  setTimeout(() => process.exit(0), 200);
}
