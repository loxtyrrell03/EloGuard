// Streams the lichess open database (zstd), harvests rated games that carry
// [%eval] annotations (lichess server analysis), computes EloGuard review
// features for both sides, and writes one JSON line per game.
//
// Ground truth: lichess Elo of both players at game time + exact time control.
// Feature computation mirrors lib/review-core.js buildReview scoring exactly
// (book + forced moves excluded, volatility-weighted accuracy, capped ACPL),
// minus engine-bestmove information (not present in the dumps).
const fs = require('fs');
const path = require('path');
const fzstd = require('fzstd');

const repo = 'C:/Users/loxty/Desktop/Development & AI/Projects/Repos/EloGuard';
const core = require(path.join(repo, 'lib', 'review-core.js'));
const bookSrc = fs.readFileSync(path.join(repo, 'lib', 'book.js'), 'utf8');
core.setBook(JSON.parse(bookSrc.slice(bookSrc.indexOf('['), bookSrc.lastIndexOf(']') + 1)));

const URL_ = 'https://database.lichess.org/standard/lichess_db_standard_rated_2026-06.pgn.zst';
const OUT = path.join(__dirname, 'features3.jsonl');
const TARGET_GAMES = 24000;
const MAX_BYTES = 3.5e9;
const MAX_MINUTES = 50;
const BIN_CAP = 240; // per (timeClass, 100-elo bin of avg rating)
const PLAYER_CAP = 8; // extra games per already-seen player (multi-game slope fitting)
const playerCounts = new Map(); // userHash -> accepted game count

function userHash(name) {
  let h = 5381;
  const s = String(name).toLowerCase();
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function parseClock(v) {
  // "0:02:58.9" or "1:00:00" -> seconds
  const parts = v.split(':').map(parseFloat);
  if (parts.some(Number.isNaN)) return null;
  let sec = 0;
  for (const p of parts) sec = sec * 60 + p;
  return sec;
}

const out = fs.createWriteStream(OUT, { flags: 'w' });
const binCounts = {};
let accepted = 0, scanned = 0, withEval = 0, downloaded = 0;
const t0 = Date.now();

function parseHeaders(text) {
  const h = {};
  const re = /^\[(\w+)\s+"([^"]*)"\]/gm;
  let m;
  while ((m = re.exec(text))) h[m[1]] = m[2];
  return h;
}

function parseEvalValue(v) {
  if (v.startsWith('#')) {
    const n = parseInt(v.slice(1), 10);
    return Number.isNaN(n) ? null : { mate: n };
  }
  const p = parseFloat(v);
  return Number.isNaN(p) ? null : { cp: Math.round(p * 100) };
}

// movetext -> aligned { sans, evals, clocks } (eval + remaining clock AFTER each move)
function parseMovetext(text) {
  const sans = [];
  const evals = [];
  const clocks = [];
  const re = /\{([^}]*)\}|(\S+)/g;
  let m;
  let pendingSan = null;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) {
      const em = m[1].match(/\[%eval\s+([^\]\s]+)/);
      if (em && pendingSan !== null) {
        const ev = parseEvalValue(em[1]);
        if (ev === null) return null;
        const cm = m[1].match(/\[%clk\s+([^\]\s]+)/);
        sans.push(pendingSan);
        evals.push(ev);
        clocks.push(cm ? parseClock(cm[1]) : null);
        pendingSan = null;
      }
      continue;
    }
    const tok = m[2];
    if (/^\d+\.+$/.test(tok) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;
    const clean = tok.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
    if (!clean) continue;
    if (!/^(O-O(-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?)[+#]?$/.test(clean)) return null;
    if (pendingSan !== null) return null; // move without eval mid-game -> not fully analyzed
    pendingSan = clean;
  }
  if (pendingSan !== null) { sans.push(pendingSan); evals.push(undefined); clocks.push(null); }
  if (evals.length && evals[evals.length - 1] === undefined) { evals.pop(); }
  return { sans, evals, clocks };
}

// Per-side clock features from remaining-clock sequence (own non-book moves):
// fastRate = share of near-instant moves; scramble = share played under 12% clock.
function clockFeatures(sans, clocks, tc, bookPlies) {
  const threshold = Math.max(0.8, tc.base * 0.015);
  const result = {};
  for (const color of ['w', 'b']) {
    const offset = color === 'w' ? 0 : 1;
    let prev = tc.base;
    let considered = 0, fast = 0, scramble = 0, known = 0;
    for (let i = offset; i < sans.length; i += 2) {
      const clk = i < clocks.length ? clocks[i] : null;
      if (clk === null || clk === undefined) { prev = null; continue; }
      if (prev !== null && i >= bookPlies) {
        const spent = prev - clk + tc.inc;
        considered++;
        known++;
        if (spent <= threshold) fast++;
        if (clk < tc.base * 0.12) scramble++;
      }
      prev = clk;
    }
    result[color] = known >= 8
      ? { fastRate: fast / considered, scramble: scramble / considered }
      : { fastRate: null, scramble: null };
  }
  return result;
}

// Mirrors buildReview's scoring exactly (see lib/review-core.js) minus glyphs.
function computeFeatures(prepared, positionsEvals) {
  const { moves, legalCounts, bookPlies, fens } = prepared;
  const winPcts = positionsEvals.map((e) => core.winPctWhite(e));
  const weights = core.volatilityWeights(winPcts);
  const movePhases = core.assignPhases(fens, bookPlies);
  const mk = () => ({ accs: [], ws: [], losses: [], wsum: 0 });
  const buckets = { w: mk(), b: mk() };
  const phaseBuckets = { w: {}, b: {} };
  for (const ph of core.PHASES) { phaseBuckets.w[ph] = mk(); phaseBuckets.b[ph] = mk(); }

  const bookMoves = { w: 0, b: 0 };
  const blunders = { w: 0, b: 0 };
  for (let i = 0; i < moves.length; i++) {
    const color = moves[i].color;
    if (i < bookPlies) { bookMoves[color]++; continue; }
    if (legalCounts[i] === 1) continue; // forced: not scored
    const before = core.winPctFor(positionsEvals[i], color);
    const after = core.winPctFor(positionsEvals[i + 1], color);
    const drop = Math.max(0, before - after);
    if (drop >= 20) blunders[color]++;
    const acc = core.moveAccuracy(drop);
    const cpBefore = color === 'w' ? core.scoreToCp(positionsEvals[i]) : -core.scoreToCp(positionsEvals[i]);
    const cpAfter = color === 'w' ? core.scoreToCp(positionsEvals[i + 1]) : -core.scoreToCp(positionsEvals[i + 1]);
    const cpLoss = Math.max(0, Math.min(1000, cpBefore - cpAfter));
    const w = weights[i] || 1;
    for (const b of [buckets[color], phaseBuckets[color][movePhases[i]]]) {
      b.accs.push(acc); b.ws.push(w); b.losses.push(cpLoss); b.wsum += w;
    }
  }
  const statsOf = (b) => {
    const n = b.accs.length;
    if (!n) return null;
    return {
      accuracy: core.gameAccuracy(b.accs, b.ws),
      acpl: b.losses.reduce((a, x) => a + x, 0) / n,
      scoredCount: n,
      complexity: b.wsum / n
    };
  };
  const result = {};
  for (const color of ['w', 'b']) {
    const stats = statsOf(buckets[color]);
    if (!stats || stats.scoredCount < 8) return null;
    stats.bookMoves = bookMoves[color];
    stats.blunderRate = blunders[color] / stats.scoredCount;
    const phases = {};
    for (const ph of core.PHASES) phases[ph] = statsOf(phaseBuckets[color][ph]);
    result[color] = { stats, phases };
  }
  return result;
}

function processGame(text) {
  scanned++;
  if (text.indexOf('%eval') === -1) return;
  withEval++;
  const headerEnd = text.indexOf('\n\n');
  if (headerEnd === -1) return;
  const h = parseHeaders(text.slice(0, headerEnd));
  if (!h.WhiteRatingDiff || !h.BlackRatingDiff) return; // rated only
  const wElo = +h.WhiteElo, bElo = +h.BlackElo;
  if (!wElo || !bElo || wElo < 600 || bElo < 600 || wElo > 3100 || bElo > 3100) return;
  const tcm = (h.TimeControl || '').match(/^(\d+)\+(\d+)$/);
  if (!tcm) return;
  const tc = { base: +tcm[1], inc: +tcm[2] };
  if (tc.base < 60) return; // no ultrabullet on chess.com
  const cls = core.timeClassOf(tc);
  const bin = `${cls}:${Math.floor(((wElo + bElo) / 2) / 100)}`;
  const uhW = userHash(h.White || ''), uhB = userHash(h.Black || '');
  const binOk = (binCounts[bin] || 0) < BIN_CAP;
  // accept over-cap games of players we already hold: builds multi-game groups
  const wSeen = playerCounts.get(uhW) || 0, bSeen = playerCounts.get(uhB) || 0;
  const playerOk = (wSeen > 0 && wSeen < PLAYER_CAP) || (bSeen > 0 && bSeen < PLAYER_CAP);
  if (!binOk && !playerOk) return;

  const parsed = parseMovetext(text.slice(headerEnd + 2));
  if (!parsed || parsed.sans.length < 24 || parsed.sans.length > 160) return;
  const { sans, evals, clocks } = parsed;

  const prepared = core.prepareGame(sans);
  if (prepared.error) return;

  // positions 0..N, White POV; start position fixed at +15cp (lichess convention)
  const positions = [{ cp: 15 }, ...evals];
  if (positions.length === sans.length) {
    // final move had no eval (game-ending move): synthesize from the known terminal
    if (prepared.terminal === 'checkmate') {
      positions.push({ mate: prepared.moves[prepared.moves.length - 1].color === 'w' ? 1 : -1 });
    } else if (prepared.terminal) {
      positions.push({ cp: 0 });
    } else {
      return; // incomplete analysis
    }
  }
  if (positions.length !== sans.length + 1) return;

  const feats = computeFeatures(prepared, positions);
  if (!feats) return;
  const clkFeats = clockFeatures(sans, clocks, tc, prepared.bookPlies);
  feats.w.stats.fastRate = clkFeats.w.fastRate;
  feats.w.stats.scramble = clkFeats.w.scramble;
  feats.b.stats.fastRate = clkFeats.b.fastRate;
  feats.b.stats.scramble = clkFeats.b.scramble;
  binCounts[bin] = (binCounts[bin] || 0) + 1;
  playerCounts.set(uhW, wSeen + 1);
  playerCounts.set(uhB, bSeen + 1);
  accepted++;
  out.write(JSON.stringify({
    tc, cls, wElo, bElo, uhW, uhB,
    sans: sans.join(' '),
    w: feats.w, b: feats.b
  }) + '\n');
  if (accepted % 1000 === 0) {
    const mins = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`accepted=${accepted} scanned=${scanned} withEval=${withEval} downloadedMB=${Math.round(downloaded / 1e6)} mins=${mins}`);
  }
}

async function main() {
  const controller = new AbortController();
  const resp = await fetch(URL_, { signal: controller.signal });
  if (!resp.ok || !resp.body) throw new Error('download failed: ' + resp.status);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let buffer = '';
  let stop = false;

  const ds = new fzstd.Decompress((chunk) => {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n[Event ', 1)) !== -1) {
      const game = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      try { processGame(game); } catch (e) { /* skip malformed */ }
      if (accepted >= TARGET_GAMES) { stop = true; return; }
    }
  });

  try {
    for await (const chunk of resp.body) {
      downloaded += chunk.length;
      ds.push(new Uint8Array(chunk));
      if (stop || downloaded > MAX_BYTES || (Date.now() - t0) / 60000 > MAX_MINUTES) {
        controller.abort();
        break;
      }
    }
  } catch (e) {
    if (!stop && e.name !== 'AbortError') console.error('stream ended:', e.message);
  }
  out.end();
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`DONE accepted=${accepted} scanned=${scanned} withEval=${withEval} downloadedMB=${Math.round(downloaded / 1e6)} mins=${mins}`);
  const clsCounts = {};
  for (const k of Object.keys(binCounts)) {
    const cls = k.split(':')[0];
    clsCounts[cls] = (clsCounts[cls] || 0) + binCounts[k];
  }
  console.log('by class:', JSON.stringify(clsCounts));
}

main().catch((e) => { console.error(e); process.exit(1); });
