// Validates the composed rating model (lichess-fitted curves + published
// lichess->chess.com conversion) against the held-out chess.com sample
// (tests/calib_results.json: real games, real pool ratings, full extension
// pipeline features at depth 12).
const path = require('path');
const fs = require('fs');
const repo = path.join(__dirname, '..');
const core = require(path.join(repo, 'lib', 'review-core.js'));
const bookSrc = fs.readFileSync(path.join(repo, 'lib', 'book.js'), 'utf8');
core.setBook(JSON.parse(bookSrc.slice(bookSrc.indexOf('['), bookSrc.lastIndexOf(']') + 1)));

const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'calib_results.json'), 'utf8'));
const rows = [];
for (const r of results) {
  for (const side of r.sides) {
    if (!side.stats || side.stats.accuracy === null || side.stats.scoredCount < 8) continue;
    // the sample was engine-analyzed at this depth — enable the depth-skew correction
    const stats = Object.assign({}, side.stats, { analysisDepth: r.depth || 12, phases: side.phases });
    const est = core.estimateRating(stats, r.timeControl);
    if (!est) continue;
    rows.push({ actual: side.actual, est: est.rating, err: est.rating - side.actual, cls: r.timeClass });
  }
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const groups = {};
for (const row of rows) {
  const band = row.actual < 800 ? '<800' : row.actual < 1200 ? '800-1199' : row.actual < 1600 ? '1200-1599'
    : row.actual < 2000 ? '1600-1999' : row.actual < 2400 ? '2000-2399' : '2400+';
  for (const key of [`band ${band}`, `class ${row.cls}`, 'ALL']) (groups[key] = groups[key] || []).push(row.err);
}
console.log('group                n   bias   MAE');
for (const key of Object.keys(groups).sort()) {
  const errs = groups[key];
  console.log(`${key.padEnd(18)} ${String(errs.length).padStart(4)} ${String(Math.round(mean(errs))).padStart(6)} ${String(Math.round(mean(errs.map(Math.abs)))).padStart(5)}`);
}
// calibration-in-forecast: bias by estimate band
const ebands = {};
for (const row of rows) {
  const b = row.est < 800 ? '<800' : row.est < 1200 ? '800-1199' : row.est < 1600 ? '1200-1599' : row.est < 2000 ? '1600-1999' : '2000+';
  (ebands[b] = ebands[b] || []).push(row.err);
}
console.log('\nby estimate band:');
for (const b of Object.keys(ebands).sort()) {
  console.log(`  ${b.padEnd(10)} n=${String(ebands[b].length).padStart(3)} bias=${Math.round(mean(ebands[b]))} mae=${Math.round(mean(ebands[b].map(Math.abs)))}`);
}
const xs = rows.map((r) => r.actual), ys = rows.map((r) => r.est);
const mx = mean(xs), my = mean(ys);
let sxy = 0, sxx = 0;
for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
console.log(`\nn=${rows.length} slope(est~actual)=${(sxy / sxx).toFixed(2)} overall bias=${Math.round(mean(rows.map((r) => r.err)))}`);
console.log(`suggested VALIDATION_OFFSET (add to conversion output): ${-Math.round(mean(rows.map((r) => r.err)))}`);
