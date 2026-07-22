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
const OUT = path.join(__dirname, 'features.jsonl');
const TARGET_GAMES = 30000;
const MAX_BYTES = 3.0e9;
const MAX_MINUTES = 45;
const BIN_CAP = 220; // per (timeClass, 100-elo bin of avg rating)

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

// movetext -> aligned { sans: [...], evals: [...] } (eval AFTER each move, White POV)
function parseMovetext(text) {
  const sans = [];
  const evals = [];
  const re = /\{([^}]*)\}|(\S+)/g;
  let m;
  let pendingSan = null;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) {
      const em = m[1].match(/\[%eval\s+([^\]\s]+)/);
      if (em && pendingSan !== null) {
        const ev = parseEvalValue(em[1]);
        if (ev === null) return null;
        sans.push(pendingSan);
        evals.push(ev);
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
  // trailing move without an eval (e.g. the mating move) is allowed
  return { sans: pendingSan !== null ? [...sans, pendingSan] : sans, evals };
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

  for (let i = 0; i < moves.length; i++) {
    const color = moves[i].color;
    if (i < bookPlies || legalCounts[i] === 1) continue; // book / forced: not scored
    const before = core.winPctFor(positionsEvals[i], color);
    const after = core.winPctFor(positionsEvals[i + 1], color);
    const drop = Math.max(0, before - after);
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
  if ((binCounts[bin] || 0) >= BIN_CAP) return;

  const parsed = parseMovetext(text.slice(headerEnd + 2));
  if (!parsed || parsed.sans.length < 24 || parsed.sans.length > 160) return;
  const { sans, evals } = parsed;

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
  binCounts[bin] = (binCounts[bin] || 0) + 1;
  accepted++;
  out.write(JSON.stringify({
    tc, cls, wElo, bElo,
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
