// Fits the EloGuard rating model from the lichess large-sample features
// (features.jsonl produced by ingest.js). Outputs a constants block for
// lib/review-core.js. All fitted quantities live on the LICHESS rating scale;
// conversion to chess.com pools is a separate published-survey layer.
const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync(path.join(__dirname, 'features.jsonl'), 'utf8').trim().split('\n');
const games = lines.map((l) => JSON.parse(l));

const sides = [];
const pairs = [];
for (const g of games) {
  const T = g.tc.base + 40 * g.tc.inc;
  const gameSides = [];
  for (const color of ['w', 'b']) {
    const s = g[color];
    if (!s || !s.stats || s.stats.scoredCount < 8) continue;
    const row = {
      elo: color === 'w' ? g.wElo : g.bElo,
      acc: s.stats.accuracy,
      lnAcpl: Math.log(Math.max(1, s.stats.acpl)),
      acpl: s.stats.acpl,
      complexity: s.stats.complexity,
      n: s.stats.scoredCount,
      T,
      cls: g.cls,
      phases: s.phases
    };
    sides.push(row);
    gameSides.push(row);
  }
  if (gameSides.length === 2) pairs.push(gameSides);
}
console.log(`games=${games.length} sides=${sides.length} pairs=${pairs.length}`);
const byCls = {};
for (const s of sides) byCls[s.cls] = (byCls[s.cls] || 0) + 1;
console.log('sides by class:', JSON.stringify(byCls));

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const variance = (a) => { const m = mean(a); return mean(a.map((x) => (x - m) * (x - m))); };
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

// ---- 1. reference curves (rapid-ish, T in [500, 700]) by 100-Elo bin ----
const ref = sides.filter((s) => s.T >= 500 && s.T <= 700);
console.log(`reference (T~600) sides: ${ref.length}`);
const bins = {};
for (const s of ref) {
  const b = Math.floor(s.elo / 100) * 100;
  (bins[b] = bins[b] || []).push(s);
}
const accAnchors = [];
const acplAnchors = [];
for (const b of Object.keys(bins).map(Number).sort((x, y) => x - y)) {
  const list = bins[b];
  if (list.length < 80) continue;
  accAnchors.push([b + 50, median(list.map((s) => s.acc))]);
  acplAnchors.push([b + 50, median(list.map((s) => s.acpl))]);
}
// enforce monotonicity (pool adjacent violators)
for (let i = 1; i < accAnchors.length; i++) {
  if (accAnchors[i][1] <= accAnchors[i - 1][1]) accAnchors[i][1] = accAnchors[i - 1][1] + 0.15;
  if (acplAnchors[i][1] >= acplAnchors[i - 1][1]) acplAnchors[i][1] = acplAnchors[i - 1][1] * 0.97;
}
console.log('ACC_ANCHORS:', JSON.stringify(accAnchors.map(([r, a]) => [r, +a.toFixed(1)])));
console.log('ACPL_ANCHORS:', JSON.stringify(acplAnchors.map(([r, a]) => [r, +a.toFixed(1)])));

const interp = (anchors, x) => {
  if (x <= anchors[0][0]) return anchors[0][1];
  if (x >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];
  for (let i = 1; i < anchors.length; i++) {
    if (x <= anchors[i][0]) {
      const t = (x - anchors[i - 1][0]) / (anchors[i][0] - anchors[i - 1][0]);
      return anchors[i - 1][1] + t * (anchors[i][1] - anchors[i - 1][1]);
    }
  }
  return anchors[anchors.length - 1][1];
};

// ---- 2. time coefficients from accuracy/acpl residuals vs the reference curve ----
const regress = (xs, ys) => {
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return { slope: sxy / sxx, intercept: my - (sxy / sxx) * mx };
};
const inRange = sides.filter((s) => s.elo >= accAnchors[0][0] && s.elo <= accAnchors[accAnchors.length - 1][0]);
const accResid = inRange.map((s) => s.acc - interp(accAnchors, s.elo));
const lnTratio = inRange.map((s) => Math.log(s.T / 600));
const accTimeFit = regress(lnTratio, accResid);
const lnAcplResid = inRange.map((s) => s.lnAcpl - Math.log(interp(acplAnchors, s.elo)));
const acplTimeFit = regress(lnTratio, lnAcplResid);
// rawSkill form: accOffset = TIME_ACC_COEF * ln(600/T); acplMult = (T/600)^TIME_ACPL_EXP
const TIME_ACC_COEF = accTimeFit.slope;   // acc = curve + slope*ln(T/600) -> compensate with -slope*ln(T/600) = slope*ln(600/T)... sign folds below
const TIME_ACPL_EXP = -acplTimeFit.slope; // adjusted acpl = acpl * (T/600)^(-slope)
console.log(`time fits: acc ${accTimeFit.slope.toFixed(2)} per ln(T/600); lnAcpl ${acplTimeFit.slope.toFixed(3)} per ln(T/600)`);

// ---- 3. complexity coefficient (accuracy residual vs volatility, time-adjusted) ----
const accResid2 = inRange.map((s, i) => accResid[i] - accTimeFit.slope * lnTratio[i] - accTimeFit.intercept);
const cxFit = regress(inRange.map((s) => s.complexity - 4.5), accResid2);
console.log(`complexity: ${cxFit.slope.toFixed(2)} acc-points per volatility unit`);
const COMPLEXITY_COEF = -cxFit.slope; // compensate observed accuracy

// ---- 4. feature + Bayes layer ----
function feature(row) {
  const accAdj = Math.min(99.5,
    row.acc - accTimeFit.slope * Math.log(row.T / 600) + COMPLEXITY_COEF * (row.complexity - 4.5));
  const acplAdj = Math.max(1, row.acpl * Math.pow(row.T / 600, TIME_ACPL_EXP));
  // invert curves
  const invert = (anchors, y, decreasing) => {
    const a = anchors;
    if (!decreasing) {
      if (y <= a[0][1]) return a[0][0];
      if (y >= a[a.length - 1][1]) return a[a.length - 1][0];
      for (let i = 1; i < a.length; i++) {
        if (y <= a[i][1]) {
          const t = (y - a[i - 1][1]) / (a[i][1] - a[i - 1][1]);
          return a[i - 1][0] + t * (a[i][0] - a[i - 1][0]);
        }
      }
    } else {
      if (y >= a[0][1]) return a[0][0];
      if (y <= a[a.length - 1][1]) return a[a.length - 1][0];
      for (let i = 1; i < a.length; i++) {
        if (y >= a[i][1]) {
          const t = (a[i - 1][1] - y) / (a[i - 1][1] - a[i][1]);
          return a[i - 1][0] + t * (a[i][0] - a[i - 1][0]);
        }
      }
    }
    return a[a.length - 1][0];
  };
  return 0.6 * invert(accAnchors, accAdj, false) + 0.4 * invert(acplAnchors, acplAdj, true);
}

for (const s of sides) s.f = feature(s);
const fAll = sides.map((s) => s.f);
const yAll = sides.map((s) => s.elo);
const ols = regress(fAll, yAll);
const meanF = mean(fAll), meanY = mean(yAll);
const totalVarF = variance(fAll);
const varRating = variance(yAll);

// Per-game feature noise Vn: mean within-rating-bin variance of the feature.
// (Robust: no reliance on side-pair independence — both sides share one game —
// and no fragile iteration. Within a 100-Elo bin, true-skill spread contributes
// negligibly next to per-game noise.)
const noiseBins = {};
for (const s of sides) {
  const b = Math.floor(s.elo / 100);
  (noiseBins[b] = noiseBins[b] || []).push(s.f);
}
let vnSum = 0, vnW = 0;
for (const b of Object.keys(noiseBins)) {
  const list = noiseBins[b];
  if (list.length < 100) continue;
  vnSum += variance(list) * list.length;
  vnW += list.length;
}
const Vn = vnSum / vnW;
const VarE = Math.max(totalVarF - Vn, totalVarF * 0.2); // Var(E[f|rating])
const cov = ols.slope * totalVarF;                       // Cov(rating, f)
const meanMoves = mean(sides.map((s) => s.n));
// slope with M effective moves: cov / (VarE + Vn * meanMoves / M), capped.
const SLOPE_MAX = Math.min(1.3, cov / VarE);
const slopeM = (M) => Math.min(SLOPE_MAX, cov / (VarE + (Vn * meanMoves) / M));
const predict = (f, M) => meanY + slopeM(M) * (f - meanF);

const resid = sides.map((s) => s.elo - predict(s.f, s.n));
console.log(`\nOLS b=${ols.slope.toFixed(3)} cov=${Math.round(cov)} Vn=${Math.round(Vn)} VarE=${Math.round(VarE)} varRating=${Math.round(varRating)}`);
console.log(`slope(1gm)=${slopeM(meanMoves).toFixed(3)} slope(x10)=${slopeM(meanMoves * 10).toFixed(3)} slope(x30)=${slopeM(meanMoves * 30).toFixed(3)} slopeMax=${SLOPE_MAX.toFixed(3)}`);
console.log(`meanF=${Math.round(meanF)} meanY=${Math.round(meanY)} residual sd=${Math.round(Math.sqrt(variance(resid)))}`);
const r = ols.slope * Math.sqrt(totalVarF / varRating);
console.log(`per-side correlation r=${r.toFixed(3)}`);

// per-class residuals (should be ~0 if the continuous time model suffices)
for (const cls of ['bullet', 'blitz', 'rapid', 'classical']) {
  const list = sides.filter((s) => s.cls === cls);
  if (list.length < 50) continue;
  const b = mean(list.map((s) => s.elo - predict(s.f, s.n)));
  console.log(`class ${cls.padEnd(9)} n=${String(list.length).padStart(6)} residual bias=${Math.round(b)}`);
}

// ---- 5. phase offsets ----
console.log('\nphase offsets (lichess scale):');
const phaseOffsets = {};
for (const ph of ['opening', 'middlegame', 'endgame']) {
  const errs = [];
  for (const s of sides) {
    const p = s.phases && s.phases[ph];
    if (!p || p.accuracy === null || p.scoredCount < 8) continue;
    const row = { acc: p.accuracy, acpl: p.acpl, complexity: p.complexity, T: s.T };
    errs.push(s.elo - predict(feature(row), p.scoredCount));
  }
  phaseOffsets[ph] = Math.round(mean(errs));
  console.log(`  ${ph.padEnd(12)} n=${errs.length} offset=${phaseOffsets[ph]} sd=${Math.round(Math.sqrt(variance(errs)))}`);
}

// ---- 6. calibration-in-forecast check ----
console.log('\nbias by estimate band (lichess scale, should be ~0):');
const ebands = {};
for (const s of sides) {
  const est = predict(s.f, s.n);
  const band = est < 1200 ? '<1200' : est < 1600 ? '1200-1599' : est < 2000 ? '1600-1999' : est < 2400 ? '2000-2399' : '2400+';
  (ebands[band] = ebands[band] || []).push(s.elo - est);
}
for (const b of Object.keys(ebands).sort()) {
  console.log(`  ${b.padEnd(10)} n=${String(ebands[b].length).padStart(6)} bias=${Math.round(mean(ebands[b]))} mae=${Math.round(mean(ebands[b].map(Math.abs)))}`);
}

// ---- output constants ----
const constants = {
  ACC_ANCHORS: accAnchors.map(([r, a]) => [r, +a.toFixed(1)]),
  ACPL_ANCHORS: acplAnchors.map(([r, a]) => [r, +a.toFixed(1)]),
  TIME_ACC_SLOPE: +accTimeFit.slope.toFixed(3),
  TIME_ACPL_EXP: +TIME_ACPL_EXP.toFixed(3),
  COMPLEXITY_COEF: +COMPLEXITY_COEF.toFixed(3),
  CALIBRATION: {
    meanFeature: Math.round(meanF),
    meanActual: Math.round(meanY),
    cov: Math.round(cov),
    varSignal: Math.round(VarE),
    varNoise: Math.round(Vn),
    varRating: Math.round(varRating),
    slopeMax: +SLOPE_MAX.toFixed(3),
    meanMoves: +meanMoves.toFixed(1),
    modelFloor: 150
  },
  PHASE_RATING_OFFSET: phaseOffsets,
  SAMPLE: { games: games.length, sides: sides.length, month: '2026-06' }
};
fs.writeFileSync(path.join(__dirname, 'fitted_constants.json'), JSON.stringify(constants, null, 2));
console.log('\nwrote fitted_constants.json');
