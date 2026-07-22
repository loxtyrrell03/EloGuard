const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const content = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');

test('post-game actions retain a move record across Chess.com DOM replacement', () => {
  assert.match(content, /function buildPostGameButtons\(variant\)\s*{\s*const retainedRecord = getPostGameRecord\(\);/);
  assert.match(content, /openOnLichess\(lichessBtn, retainedRecord\);/);
  assert.match(content, /openReviewPanel\(retainedRecord\);/);
});

test('the retained record is scoped to the current game page and keeps the fullest move list', () => {
  assert.match(content, /POSTGAME_RECORD_LOCATION === postGameLocationKey\(\) \? POSTGAME_RECORD_SNAPSHOT : null/);
  assert.match(content, /record\.sans\.length >= POSTGAME_RECORD_SNAPSHOT\.sans\.length/);
});
