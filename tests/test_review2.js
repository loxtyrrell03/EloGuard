// Second-pass tests: non-terminal game (engine evaluates final position),
// promotion + en passant handling, empty/edge inputs.
const path = require('path');
const fs = require('fs');
const repo = path.join(__dirname, '..');
const core = require(path.join(repo, 'lib', 'review-core.js'));
const bookSrc = fs.readFileSync(path.join(repo, 'lib', 'book.js'), 'utf8');
core.setBook(JSON.parse(bookSrc.slice(bookSrc.indexOf('['), bookSrc.lastIndexOf(']') + 1)));

let failures = 0;
function check(name, cond, extra) {
  if (!cond) { failures++; console.log('FAIL:', name, extra === undefined ? '' : JSON.stringify(extra)); }
  else console.log('ok:', name);
}

// promotion + en passant + underpromotion SAN round-trip
const promo = core.prepareGame(['e4', 'a6', 'e5', 'd5', 'exd6', 'Nf6', 'dxc7', 'a5', 'cxb8=Q', 'Rxb8']);
check('ep+promotion game parses', !promo.error, promo.error);
if (!promo.error) {
  check('ep flag', promo.moves[4].flags.includes('e'), promo.moves[4]);
  check('promo uci', promo.moves[8].uci === 'c7b8q', promo.moves[8].uci);
}
const bad = core.prepareGame(['e4', 'e5', 'Ke7']);
check('illegal move reports error', !!bad.error, bad.error);

// uciToSan
const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
check('uciToSan g1f3=Nf3', core.uciToSan(startFen, 'g1f3') === 'Nf3');
check('uciToSan castling', core.uciToSan('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1g1') === 'O-O');

// non-terminal quiet Petrov game
const PETROV = ('e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Bd6 O-O O-O c4 c6 cxd5 cxd5 ' +
  'Nc3 Nxc3 bxc3 Bg4 Rb1 b6 h3 Bh5 Re1 Re8 Rxe8+ Qxe8').split(' ');
const prepared = core.prepareGame(PETROV);
if (prepared.error) { console.log('PREPARE ERROR', prepared.error); process.exit(1); }
check('non-terminal', prepared.terminal === null, prepared.terminal);
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
  engine.sendCommand = (cmd) => setImmediate(() => engine.ccall('command', null, ['string'], [cmd], { async: /^go\b/.test(cmd) }));
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
        send('setoption name MultiPV value 1');
        send('isready');
      } else if (line === 'readyok') { offAll(); resolve(); }
    });
    send('uci');
  });
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
function reviewPositionsToAnalyze(prepared) {
  const indexes = new Set();
  for (let i = 0; i < prepared.moves.length; i++) {
    if (i < prepared.bookPlies || prepared.legalCounts[i] === 1) continue;
    indexes.add(i);
    if (!(prepared.terminal && i + 1 === prepared.moves.length)) indexes.add(i + 1);
  }
  if (!indexes.size && prepared.moves.length && !prepared.terminal) indexes.add(prepared.moves.length);
  return [...indexes].sort((a, b) => a - b);
}
async function main() {
  engine.listener = (line) => { if (typeof line === 'string') for (const fn of lineHandlers.slice()) fn(line); };
  await initUci();
  const uciMoves = prepared.moves.map((m) => m.uci);
  const indexes = reviewPositionsToAnalyze(prepared);
  const positions = [];
  for (const i of indexes) {
    positions.push(Object.assign({ index: i }, await searchPosition(uciMoves, i, 12)));
  }
  const review = core.buildReview(prepared, positions, { timeClass: 'blitz' });
  for (const mv of review.moves) {
    const num = mv.color === 'w' ? Math.ceil(mv.ply / 2) + '.' : '   ';
    console.log(String(num).padEnd(5), mv.san.padEnd(7), mv.cls.padEnd(11), 'drop ' + mv.drop.toFixed(1).padEnd(6), 'eval ' + mv.evalDisplay);
  }
  const w = review.players.w, b = review.players.b;
  console.log('WHITE acc', w.accuracy?.toFixed(1), 'acpl', Math.round(w.acpl), 'est', JSON.stringify(w.estimate));
  console.log('BLACK acc', b.accuracy?.toFixed(1), 'acpl', Math.round(b.acpl), 'est', JSON.stringify(b.estimate));
  check('both accuracies high (quiet theory game)', w.accuracy > 80 && b.accuracy > 80, { w: w.accuracy, b: b.accuracy });
  check('no brilliant in quiet game', w.counts.brilliant === 0 && b.counts.brilliant === 0);
  check('no blunders in quiet game', w.counts.blunder === 0 && b.counts.blunder === 0);
  check('book detected deep', review.bookPlies >= 10, review.bookPlies);
  console.log(failures ? `\n${failures} FAILURES` : '\nALL CHECKS PASSED');
  send('quit');
  setTimeout(() => process.exit(failures ? 1 : 0), 200);
}
