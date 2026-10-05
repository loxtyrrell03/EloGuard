const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const source = readFileSync(process.env.ELOGUARD_CONTENT_FILE || resolve(__dirname, '../content.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

async function fixture(t) {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
        url: 'https://www.chess.com/game/test', runScripts: 'outside-only'
    });
    t.after(() => dom.window.close());
    const { window } = dom;
    const intervals = [];
    const frames = [];
    const settings = {};
    const storageListeners = [];
    window.setInterval = (callback, delay) => (intervals.push({ callback, delay }), intervals.length);
    window.requestAnimationFrame = callback => (frames.push(callback), frames.length);
    const storage = {
        get: (_keys, callback) => queueMicrotask(() => callback({ ...settings })),
        set: (values, callback) => {
            Object.assign(settings, values);
            queueMicrotask(() => {
                const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }]));
                storageListeners.forEach(listener => listener(changes));
                callback?.();
            });
        },
        remove: () => {}
    };
    window.chrome = { storage: { sync: storage, local: storage, onChanged: { addListener: fn => storageListeners.push(fn) } } };
    window.fetch = () => { throw new Error('Focus tests must not fetch external data'); };
    window.HTMLElement.prototype.getBoundingClientRect = function () {
        const isBoard = this.id === 'board-single';
        const isClock = this.classList.contains('clock-component');
        const width = isBoard ? 600 : isClock ? 190 : 200;
        const height = isBoard ? 600 : isClock ? 56 : 22;
        const top = this.dataset.position === 'bottom' || this.closest('#board-layout-player-bottom') ? 700 : 0;
        return { x: 0, y: top, left: 0, top, right: width, bottom: top + height, width, height };
    };
    class Board extends window.HTMLElement {
        connections = 0;
        disconnections = 0;
        connectedCallback() { this.connections++; }
        disconnectedCallback() { this.disconnections++; }
    }
    class CapturedPieces extends window.HTMLElement {
        static observedAttributes = ['vertical-layout'];
        layoutChanges = 0;
        attributeChangedCallback() { this.layoutChanges++; }
    }
    window.customElements.define('wc-chess-board', Board);
    window.customElements.define('wc-captured-pieces', CapturedPieces);
    window.document.body.innerHTML = `
        <main id="board-layout-main">
            <div id="board-layout-player-top">
                <div id="top-clock" class="clock-component" data-position="top">3:00</div>
                <wc-captured-pieces id="top-material" vertical-layout="true"></wc-captured-pieces>
            </div>
            <div id="board-layout-chessboard"><wc-chess-board id="board-single"><div class="piece wp square-12"></div></wc-chess-board><button id="board-controls-settings">Settings</button></div>
            <div id="board-layout-player-bottom">
                <div id="bottom-clock" class="clock-component clock-player-turn" data-position="bottom">2:59</div>
                <wc-captured-pieces id="bottom-material" vertical-layout="true"></wc-captured-pieces>
            </div>
        </main>`;
    window.eval(source);
    await settle();
    const document = window.document;
    const board = document.getElementById('board-single');
    const topClock = document.getElementById('top-clock');
    const bottomClock = document.getElementById('bottom-clock');
    const toggle = () => document.getElementById('elo-guard-enhanced-focus-toggle').click();
    const poll = async () => {
        intervals.filter(item => item.delay === 1000 || item.delay === 250).forEach(item => item.callback());
        while (frames.length) frames.shift()();
        await settle();
    };
    toggle();
    await settle();
    await poll();
    return { window, document, board, topClock, bottomClock, toggle, poll, settings };
}

test('focus polling preserves board lifecycle, pieces, clock identity and captured-piece layout', async t => {
    const { window, document, board, topClock, bottomClock, poll } = await fixture(t);
    const piece = board.querySelector('.piece');
    const material = document.getElementById('top-material');
    const before = { connections: board.connections, disconnections: board.disconnections, layoutChanges: material.layoutChanges };
    let removals = 0;
    let resizes = 0;
    const observer = new window.MutationObserver(records => {
        for (const record of records) {
            for (const removed of record.removedNodes) {
                if ([board, topClock, bottomClock, material].includes(removed)) removals++;
            }
        }
    });
    observer.observe(document.body, { subtree: true, childList: true });
    window.addEventListener('resize', () => resizes++);
    for (let i = 0; i < 12; i++) await poll();
    assert.equal(removals, 0, 'unchanged native elements must stay attached during refreshes');
    assert.equal(resizes, 0, 'unchanged refreshes must not ask Chess.com to resize');
    assert.deepEqual({ connections: board.connections, disconnections: board.disconnections, layoutChanges: material.layoutChanges }, before);
    assert.equal(board.querySelector('.piece'), piece);
    assert.equal(topClock.closest('.elo-guard-focus-clock-mirror').dataset.position, 'top');
    assert.equal(bottomClock.closest('.elo-guard-focus-clock-mirror').dataset.position, 'bottom');
    observer.disconnect();
});

test('native clock ticks and active-turn changes still update focus clocks', async t => {
    const { topClock, bottomClock, poll } = await fixture(t);
    bottomClock.textContent = '2:58';
    await poll();
    assert.equal(bottomClock.textContent, '2:58');
    assert.equal(bottomClock.closest('.elo-guard-focus-clock-mirror').dataset.active, 'true');
    bottomClock.classList.remove('clock-player-turn');
    topClock.classList.add('clock-player-turn');
    topClock.textContent = '2:59';
    await poll();
    assert.equal(topClock.closest('.elo-guard-focus-clock-mirror').dataset.active, 'true');
    assert.equal(bottomClock.closest('.elo-guard-focus-clock-mirror').dataset.active, 'false');
});

test('focus flip keeps the same board, pieces and input listeners', async t => {
    const { window, document, board, poll } = await fixture(t);
    const connections = board.connections;
    const piece = board.querySelector('.piece');
    let inputs = 0;
    board.addEventListener('pointerdown', () => inputs++);
    document.getElementById('elo-guard-enhanced-focus-flip').click();
    await poll();
    assert.equal(document.body.classList.contains('elo-guard-enhanced-focus-visual-flipped'), true);
    assert.equal(board.connections, connections);
    assert.equal(board.querySelector('.piece'), piece);
    board.dispatchEvent(new window.Event('pointerdown'));
    assert.equal(inputs, 1);
    document.getElementById('elo-guard-enhanced-focus-flip').click();
    await poll();
    assert.equal(document.body.classList.contains('elo-guard-enhanced-focus-visual-flipped'), false);
    assert.equal(board.connections, connections);
});

test('exit restores native elements and focus can be entered again', async t => {
    const { document, board, topClock, bottomClock, toggle, poll, settings } = await fixture(t);
    for (let cycle = 0; cycle < 3; cycle++) {
        toggle();
        await settle();
        assert.equal(settings.enhancedFocusMode, false);
        assert.equal(document.getElementById('elo-guard-enhanced-focus-stage'), null);
        assert.equal(board.parentElement.id, 'board-layout-chessboard');
        assert.equal(board.nextElementSibling.id, 'board-controls-settings');
        assert.equal(topClock.parentElement.id, 'board-layout-player-top');
        assert.equal(bottomClock.parentElement.id, 'board-layout-player-bottom');
        toggle();
        await settle();
        await poll();
        assert.equal(document.querySelectorAll('#board-single').length, 1);
        assert.equal(board.parentElement.className, 'elo-guard-enhanced-focus-board-slot');
    }
});
