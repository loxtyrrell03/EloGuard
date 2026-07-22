// Fits the empirical calibration layer from tests/calib_results.json.
//
// Model: rawSkill (the monotone feature built from accuracy/ACPL/time control)
// relates to true rating (converted to the rapid scale) via a noisy linear map.
// Because chess.com matchmaking pairs similar-rated players, the two sides of
// one game act as pseudo-replicates: Var(f_w - f_b)/2 estimates per-game feature
// noise Vn, letting us split total feature variance into signal Vs and noise Vn.
//
// Prediction with M scored moves (single game or aggregated):
//   lambda_M = Vs / (Vs + Vn * meanMoves / M)
//   rating_rapid = meanActual + betaTrue * lambda_M * (f - meanF)
// where betaTrue = b_ols * (Vs + Vn) / Vs de-attenuates the OLS slope.
// This is the Bayes-optimal linear estimator: honestly shrunk for one game,
// progressively steeper as moves accumulate.
const path = require('path');
const fs = require('fs');
const repo = path.join(__dirname, '..');
const core = require(path.join(repo, 'lib', 'review-core.js'));
const bookSrc = fs.readFileSync(path.join(repo, 'lib', 'book.js'), 'utf8');
core.setBook(JSON.parse(bookSrc.slice(bookSrc.indexOf('['), bookSrc.lastIndexOf(']') + 1)));

const POOL_OFFSETS = { bullet: -150, blitz: -100, rapid: 0, classical: 50 };
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'calib_results.json'), 'utf8'));

const sides = [];
const pairs = [];
for (const r of results) {
  const pool = core.timeClassOf(r.timeControl);
  const gameSides = [];
  for (const s of r.sides) {
    if (!s.stats || s.stats.accuracy === null || s.stats.scoredCount < 8) continue;
    const f = core.rawSkill(s.stats, r.timeControl);
    if (f === null) continue;
    const row = {
      f,
      actualRs: s.actual - (POOL_OFFSETS[pool] || 0),
      moves: s.stats.scoredCount,
      pool,
      timeControl: r.timeControl,
      phases: s.phases
    };
    sides.push(row);
    gameSides.push(row);
  }
  if (gameSides.length === 2) pairs.push(gameSides);
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const variance = (a) => { const m = mean(a); return mean(a.map((x) => (x - m) * (x - m))); };

const fs_ = sides.map((s) => s.f);
const ys = sides.map((s) => s.actualRs);
const meanF = mean(fs_);
const meanY = mean(ys);
let sxy = 0, sxx = 0;
for (let i = 0; i < fs_.length; i++) { sxy += (fs_[i] - meanF) * (ys[i] - meanY); sxx += (fs_[i] - meanF) ** 2; }
const bOls = sxy / sxx;
const totalVarF = variance(fs_);

// Noise from rating-matched side pairs: Var(f_w - f_b)/2 = Vn + (real skill diff term).
// Subtract the (small) real-diff contribution using actual rating gaps and betaTrue
// iteratively (two passes suffice).
const dF = pairs.map(([a, b]) => a.f - b.f);
const dY = pairs.map(([a, b]) => a.actualRs - b.actualRs);
const rawPairVar = variance(dF) / 2; // upper bound on Vn
let Vn = rawPairVar;
let Vs, betaTrue;
for (let iter = 0; iter < 3; iter++) {
  Vs = Math.max(totalVarF - Vn, totalVarF * 0.05);
  betaTrue = bOls * (Vs + Vn) / Vs;
  const realDiffVar = variance(dY) / 2 / (betaTrue * betaTrue); // skill-diff in feature units
  Vn = Math.max(rawPairVar - realDiffVar, rawPairVar * 0.3);
}
const meanMoves = mean(sides.map((s) => s.moves));

function predict(f, moves) {
  const lambda = Vs / (Vs + (Vn * meanMoves) / moves);
  return meanY + betaTrue * lambda * (f - meanF);
}

// residuals + per-pool corrections
const resid = sides.map((s) => s.actualRs - predict(s.f, s.moves));
const residSd = Math.sqrt(variance(resid));
console.log(`sides=${sides.length} pairs=${pairs.length}`);
console.log(`OLS slope b=${bOls.toFixed(3)}  totalVarF=${Math.round(totalVarF)}  Vn=${Math.round(Vn)}  Vs=${Math.round(Vs)}`);
console.log(`betaTrue=${betaTrue.toFixed(3)}  meanF=${Math.round(meanF)}  meanY(actual,rapid-scale)=${Math.round(meanY)}  meanMoves=${meanMoves.toFixed(1)}`);
console.log(`lambda(1 game ~${Math.round(meanMoves)}mv)=${(Vs / (Vs + Vn)).toFixed(3)}  lambda(10 games)=${(Vs / (Vs + Vn / 10)).toFixed(3)}`);
console.log(`single-game residual sd=${Math.round(residSd)}`);

for (const pool of ['bullet', 'blitz', 'rapid']) {
  const list = sides.filter((s) => s.pool === pool);
  if (!list.length) continue;
  const bias = mean(list.map((s) => s.actualRs - predict(s.f, s.moves)));
  console.log(`pool ${pool.padEnd(7)} n=${String(list.length).padStart(3)} residual bias=${Math.round(bias)} (positive => we under-estimate this pool)`);
}

// phase offsets: mean residual when predicting from phase-only stats
console.log('\nphase fit (rating-unit offsets to add for phase-only estimates):');
for (const ph of ['opening', 'middlegame', 'endgame']) {
  const errs = [];
  for (const s of sides) {
    const p = s.phases && s.phases[ph];
    if (!p || p.accuracy === null || p.scoredCount < 8) continue;
    const f = core.rawSkill(p, s.timeControl);
    if (f === null) continue;
    errs.push(s.actualRs - predict(f, p.scoredCount));
  }
  if (errs.length) {
    console.log(`  ${ph.padEnd(12)} n=${String(errs.length).padStart(3)} offset=${Math.round(mean(errs))} sd=${Math.round(Math.sqrt(variance(errs)))}`);
  }
}

// calibration-in-the-forecast sense: bias grouped by ESTIMATE band
console.log('\nbias by estimate band (should be ~0 everywhere):');
const bands = {};
for (const s of sides) {
  const est = predict(s.f, s.moves);
  const band = est < 800 ? '<800' : est < 1200 ? '800-1199' : est < 1600 ? '1200-1599' : est < 2000 ? '1600-1999' : '2000+';
  (bands[band] = bands[band] || []).push(s.actualRs - est);
}
for (const b of Object.keys(bands).sort()) {
  console.log(`  ${b.padEnd(10)} n=${String(bands[b].length).padStart(3)} bias=${Math.round(mean(bands[b]))} mae=${Math.round(mean(bands[b].map(Math.abs)))}`);
}
