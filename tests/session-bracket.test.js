const test = require('node:test');
const assert = require('node:assert/strict');
const {
    computeGoalExtension,
    shouldOfferGoalExtension,
    shouldAutoRecompute
} = require('../lib/session-bracket.js');

test('goal extension adds a modest stretch target and tightens the trailing floor', () => {
    assert.deepEqual(computeGoalExtension({
        rating: 1525,
        currentFloor: 1490,
        currentCeiling: 1525,
        trailingDistance: 25
    }), {
        floor: 1510,
        ceiling: 1535,
        trailingDistance: 15,
        extensionPoints: 10
    });
});

test('goal extension never lowers an already tighter floor', () => {
    const result = computeGoalExtension({
        rating: 1525,
        currentFloor: 1518,
        currentCeiling: 1525,
        trailingDistance: 25
    });

    assert.equal(result.floor, 1518);
    assert.equal(result.ceiling, 1535);
});

test('goal extension has safe defaults when no trailing distance is available', () => {
    const result = computeGoalExtension({ rating: 1800, currentFloor: 1775, currentCeiling: 1800 });

    assert.equal(result.floor, 1785);
    assert.equal(result.ceiling, 1810);
    assert.equal(result.trailingDistance, 15);
});

test('goal extension rejects a missing rating', () => {
    assert.throws(() => computeGoalExtension({}), /rating must be finite/);
});

test('only a first Smart Bracket ceiling hit can offer continuation', () => {
    const readyGoal = {
        lockType: 'win',
        trailingDistance: 25,
        stateReady: true,
        used: false,
        dismissed: false
    };

    assert.equal(shouldOfferGoalExtension(readyGoal), true);
    assert.equal(shouldOfferGoalExtension({ ...readyGoal, lockType: 'stop' }), false);
    assert.equal(shouldOfferGoalExtension({ ...readyGoal, lockType: 'streak' }), false);
    assert.equal(shouldOfferGoalExtension({ ...readyGoal, used: true }), false);
});

test('automatic recomputation is blocked while a guard session is active', () => {
    const staleConfiguredBracket = {
        fresh: false,
        configured: true,
        allowRecompute: true,
        hasRating: true
    };

    assert.equal(shouldAutoRecompute({ ...staleConfiguredBracket, guardActive: false }), true);
    assert.equal(shouldAutoRecompute({ ...staleConfiguredBracket, guardActive: true }), false);
});
