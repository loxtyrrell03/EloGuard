const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const content = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('enhanced focus toggle has no drag or minimize behavior', () => {
    const removedBehavior = [
        'setupEnhancedFocusToggleDrag',
        'ENHANCED_FOCUS_TOGGLE_DRAG',
        'enhancedFocusButtonLeft',
        'enhancedFocusButtonTop',
        'elo-guard-focus-toggle-dragging',
        'enhancedFocusButtonMinimized',
        'ENHANCED_FOCUS_TOGGLE_MINIMIZED',
        'elo-guard-focus-toggle-minimized',
        'elo-guard-focus-toggle-min'
    ];

    for (const token of removedBehavior) {
        assert.equal(content.includes(token), false, `${token} remains in content.js`);
        assert.equal(styles.includes(token), false, `${token} remains in styles.css`);
    }
});

test('the fixed control has only the primary focus action', () => {
    assert.match(content, /toggle\.addEventListener\('click', handleEnhancedFocusToggleClick\)/);
    assert.match(content, /toggle\.append\(label\);/);
    assert.match(content, /function renderEnhancedFocusToggle\(toggle\)/);
    assert.match(content, /dataset\.eloGuardControlVersion/);
});

test('stale content-script generations stop rendering the focus control', () => {
    assert.match(
        content,
        /function ensureEnhancedFocusToggle\(\) \{\s*if \(!document\.body \|\| window\.__ELOGUARD_CONTENT_VERSION__ !== CONTENT_VERSION\) return null;/
    );
    assert.match(
        content,
        /function applyEnhancedFocusMode\(\) \{\s*if \(!document\.body \|\| window\.__ELOGUARD_CONTENT_VERSION__ !== CONTENT_VERSION\) return;/
    );
});
