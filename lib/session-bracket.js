// EloGuard live-session bracket helpers. Kept pure so the guard UI and tests use
// the same stretch-target calculation.
(function () {
    'use strict';

    const MIN_EXTENSION_POINTS = 5;
    const DEFAULT_TRAILING_DISTANCE = 25;
    const EXTENSION_SHARE = 0.4;
    const TIGHTENED_FLOOR_SHARE = 0.6;

    function finiteInt(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.round(parsed) : null;
    }

    function shouldOfferGoalExtension(input = {}) {
        return input.lockType === 'win'
            && Number(input.trailingDistance) > 0
            && input.stateReady === true
            && input.used !== true
            && input.dismissed !== true;
    }

    function shouldAutoRecompute(input = {}) {
        return input.fresh !== true
            && input.configured === true
            && input.allowRecompute === true
            && input.hasRating === true
            && input.guardActive !== true;
    }

    function computeGoalExtension(input = {}) {
        const rating = finiteInt(input.rating);
        if (rating === null) throw new TypeError('rating must be finite');

        const currentFloor = finiteInt(input.currentFloor);
        const currentCeiling = finiteInt(input.currentCeiling);
        const suppliedDistance = finiteInt(input.trailingDistance);
        const floorDistance = currentFloor !== null && currentFloor < rating
            ? rating - currentFloor
            : null;
        const ceilingDistance = currentCeiling !== null && currentCeiling > rating
            ? currentCeiling - rating
            : null;
        const baseDistance = Math.max(
            MIN_EXTENSION_POINTS + 1,
            suppliedDistance && suppliedDistance > 0
                ? suppliedDistance
                : (floorDistance || ceilingDistance || DEFAULT_TRAILING_DISTANCE)
        );

        const extensionPoints = Math.max(
            MIN_EXTENSION_POINTS,
            Math.round(baseDistance * EXTENSION_SHARE)
        );
        const tightenedDistance = Math.max(
            MIN_EXTENSION_POINTS,
            Math.min(baseDistance - 1, Math.round(baseDistance * TIGHTENED_FLOOR_SHARE))
        );
        const protectedFloor = rating - tightenedDistance;

        return {
            floor: currentFloor === null ? protectedFloor : Math.max(currentFloor, protectedFloor),
            ceiling: rating + extensionPoints,
            trailingDistance: tightenedDistance,
            extensionPoints
        };
    }

    const api = {
        MIN_EXTENSION_POINTS,
        DEFAULT_TRAILING_DISTANCE,
        computeGoalExtension,
        shouldOfferGoalExtension,
        shouldAutoRecompute
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.EloGuardSessionBracket = api;
})();
