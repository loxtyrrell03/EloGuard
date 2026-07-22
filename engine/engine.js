// EloGuard engine host. Runs inside a hidden extension iframe embedded in chess.com.
// Runs Stockfish on this iframe's main thread and exposes a small postMessage
// protocol to the content script:
//   -> { type: 'eg-ping' }
//   <- { type: 'eg-ready' } | { type: 'eg-engine-error', error }
//   -> { type: 'eg-analyze', jobId, moves: [uci...], depth, skipLast, positionIndexes? }
//   <- { type: 'eg-progress', jobId, done, total }
//   <- { type: 'eg-result', jobId, positions: [{ index, best, second, bestMove, depth }] }
//      best/second scores are normalized to White's point of view: { cp } or { mate }
//   -> { type: 'eg-cancel', jobId }
(() => {
    // We run Stockfish IN THIS IFRAME'S MAIN THREAD, not in a Worker. In MV3 the
    // `wasm-unsafe-eval` CSP is granted to extension *pages* (this hidden iframe is
    // one) but is NOT reliably inherited by dedicated Workers spawned from them, so
    // WebAssembly.instantiate is blocked inside a Worker and the engine never starts
    // (surfaces as an opaque, message-less worker onerror). The iframe is dedicated
    // and hidden and runs in its own process (cross-origin to chess.com), so blocking
    // its thread during search is fine. This mirrors the Node harness in tests/.
    // Stockfish's threaded WASM builds need cross-origin isolation/SharedArrayBuffer;
    // Chrome does not treat a web-accessible extension subframe on chess.com as a
    // dependable isolated context, so use the single-threaded build here.
    const ENGINE_ENGINE_FILE = 'stockfish-18-lite-single.js';
    const ENGINE_WASM_FILE = 'stockfish-18-lite-single.wasm';
    const PARENT_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*chess\.com$/i;
    // Emscripten prints fatal load/instantiate failures to its output listener
    // instead of throwing where we can catch it; surface those as engine errors.
    const FATAL_LINE_RE = /\b(aborted|failed to (?:asynchronously )?prepare wasm|failed to load wasm|compileerror|runtimeerror|violates the following content security)/i;

    let engineModule = null; // the initialized emscripten Module
    let sendCommand = null;  // function(cmd) -> feeds a UCI command to the engine
    let engineReady = false;
    let engineError = null;
    let uciListeners = [];
    let commandQueue = [];
    let commandFlushScheduled = false;

    function handleLine(line) {
        if (typeof line !== 'string') return;
        if (!engineReady && FATAL_LINE_RE.test(line)) {
            engineError = 'Engine failed to start: ' + line.slice(0, 200);
        }
        for (const fn of uciListeners.slice()) fn(line);
    }

    function beginUci() {
        send('uci');
        onLine((line) => {
            if (line === 'uciok') {
                send('setoption name Threads value 1');
                send('setoption name Hash value 128');
                send('setoption name MultiPV value 2');
                send('setoption name UCI_ShowWDL value false');
                send('isready');
            } else if (line === 'readyok' && !engineReady) {
                engineReady = true;
            }
            return false; // keep listening
        });
    }

    function startEngine() {
        const jsUrl = new URL(ENGINE_ENGINE_FILE, location.href).href;
        const wasmUrl = new URL(ENGINE_WASM_FILE, location.href).href;
        const script = document.createElement('script');
        script.src = jsUrl;
        script.onerror = () => { engineError = 'Failed to load the engine script'; };
        script.onload = () => {
            // The glue's non-worker branch stashes its factory on the <script> element.
            const factory = script._exports;
            if (typeof factory !== 'function') {
                engineError = 'Engine glue did not expose an initializer';
                return;
            }
            const mod = {
                locateFile: (p) => (p.indexOf('.wasm') > -1 ? wasmUrl : jsUrl),
                listener: (line) => handleLine(line), // receives both print and printErr
            };
            let inited;
            try {
                inited = factory(mod);
            } catch (e) {
                engineError = 'Engine init threw: ' + (e?.message || 'unknown');
                return;
            }
            Promise.resolve(inited).then(function whenReady() {
                if (mod._isReady) {
                    if (!mod._isReady()) return setTimeout(whenReady, 10);
                    delete mod._isReady;
                }
                engineModule = mod;
                sendCommand = (cmd) => mod.ccall('command', null, ['string'], [cmd], { async: /^go\b/.test(cmd) });
                beginUci();
            }).catch((e) => {
                engineError = 'Engine failed to start: ' + (e?.message || 'unknown');
            });
        };
        (document.head || document.documentElement).appendChild(script);
    }

    function scheduleCommandFlush() {
        if (commandFlushScheduled) return;
        commandFlushScheduled = true;
        const enqueue = typeof queueMicrotask === 'function'
            ? queueMicrotask
            : (fn) => Promise.resolve().then(fn);
        enqueue(flushCommandQueue);
    }

    function flushCommandQueue() {
        commandFlushScheduled = false;
        if (!sendCommand) {
            commandQueue = [];
            return;
        }
        const queued = commandQueue;
        commandQueue = [];
        for (const cmd of queued) {
            try {
                sendCommand(cmd);
            } catch (e) {
                if (!engineError) engineError = 'Engine command failed: ' + (e?.message || 'unknown');
            }
        }
        if (commandQueue.length) scheduleCommandFlush();
    }

    function send(cmd) {
        if (!sendCommand) return;
        // Hidden extension iframes can throttle timers to ~1Hz. A microtask queue
        // still avoids same-stack asyncify re-entry without adding per-position lag.
        commandQueue.push(cmd);
        scheduleCommandFlush();
    }

    // Register a listener; return true from the callback to unsubscribe.
    function onLine(fn) {
        const wrapped = (line) => {
            if (fn(line)) uciListeners = uciListeners.filter((f) => f !== wrapped);
        };
        uciListeners.push(wrapped);
        return () => { uciListeners = uciListeners.filter((f) => f !== wrapped); };
    }

    function waitReady() {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();
            const tick = () => {
                if (engineReady) return resolve();
                if (engineError) return reject(new Error(engineError));
                if (Date.now() - startedAt > 30000) return reject(new Error('Engine init timed out'));
                setTimeout(tick, 50);
            };
            tick();
        });
    }

    function parseScore(tokens, i, whiteToMove) {
        // tokens[i] === 'score'; returns { cp } or { mate } from White's POV
        const kind = tokens[i + 1];
        const value = parseInt(tokens[i + 2], 10);
        if (Number.isNaN(value)) return null;
        const sign = whiteToMove ? 1 : -1;
        if (kind === 'cp') return { cp: value * sign };
        if (kind === 'mate') return { mate: value * sign };
        return null;
    }

    // Search one position (startpos + moves[0..count)) at fixed depth.
    function searchPosition(moves, count, depth) {
        return new Promise((resolve, reject) => {
            const whiteToMove = count % 2 === 0;
            const pvs = {}; // multipv index -> { score, move, depth }
            let settled = false;

            const unsub = onLine((line) => {
                if (line.startsWith('info ') && line.indexOf(' pv ') > -1 && line.indexOf(' score ') > -1) {
                    const tokens = line.split(/\s+/);
                    let d = 0, mpv = 1, score = null, move = null;
                    for (let i = 0; i < tokens.length; i++) {
                        if (tokens[i] === 'depth') d = parseInt(tokens[i + 1], 10) || 0;
                        else if (tokens[i] === 'multipv') mpv = parseInt(tokens[i + 1], 10) || 1;
                        else if (tokens[i] === 'score') score = parseScore(tokens, i, whiteToMove);
                        else if (tokens[i] === 'pv') { move = tokens[i + 1] || null; break; }
                    }
                    if (score && move) {
                        const prev = pvs[mpv];
                        if (!prev || d >= prev.depth) pvs[mpv] = { score, move, depth: d };
                    }
                    return false;
                }
                if (line.startsWith('bestmove')) {
                    if (settled) return true;
                    settled = true;
                    const bestMove = (line.split(/\s+/)[1] || '') === '(none)' ? null : line.split(/\s+/)[1];
                    resolve({
                        best: pvs[1] ? pvs[1].score : null,
                        second: pvs[2] ? pvs[2].score : null,
                        secondMove: pvs[2] ? pvs[2].move : null,
                        bestMove: bestMove || (pvs[1] ? pvs[1].move : null),
                        depth: pvs[1] ? pvs[1].depth : 0
                    });
                    return true; // unsubscribe
                }
                return false;
            });

            const prefix = moves.slice(0, count).join(' ');
            send(count === 0 ? 'position startpos' : 'position startpos moves ' + prefix);
            send(`go depth ${depth}`);
        });
    }

    let activeJobId = null;
    let cancelledJobs = new Set();

    function normalizePositionIndexes(msg) {
        const { moves, skipLast } = msg;
        const max = moves.length + (skipLast ? -1 : 0);
        if (Array.isArray(msg.positionIndexes)) {
            return [...new Set(msg.positionIndexes
                .map((idx) => parseInt(idx, 10))
                .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx <= max))]
                .sort((a, b) => a - b);
        }
        const total = moves.length + (skipLast ? 0 : 1);
        return Array.from({ length: total }, (_, idx) => idx);
    }

    async function runJob(source, origin, msg) {
        const { jobId, moves } = msg;
        const depth = Math.max(1, Math.min(32, parseInt(msg.depth, 10) || 10));
        const positionIndexes = normalizePositionIndexes(msg);
        const total = positionIndexes.length;
        const positions = [];
        try {
            await waitReady();
        } catch (e) {
            source.postMessage({ type: 'eg-engine-error', jobId, error: e.message }, origin);
            return;
        }
        activeJobId = jobId;
        // A job cancelled while queued must post no result, even when it has zero
        // positions to analyze (the per-position loop below never runs otherwise).
        if (cancelledJobs.has(jobId)) {
            activeJobId = null;
            cancelledJobs.delete(jobId);
            return;
        }
        if (!total) {
            activeJobId = null;
            source.postMessage({ type: 'eg-result', jobId, positions }, origin);
            cancelledJobs.delete(jobId);
            return;
        }
        for (let n = 0; n < positionIndexes.length; n++) {
            if (cancelledJobs.has(jobId)) break;
            const idx = positionIndexes[n];
            let result;
            try {
                result = await searchPosition(moves, idx, depth);
            } catch (e) {
                source.postMessage({ type: 'eg-engine-error', jobId, error: e.message }, origin);
                activeJobId = null;
                return;
            }
            positions.push(Object.assign({ index: idx }, result));
            source.postMessage({ type: 'eg-progress', jobId, done: n + 1, total }, origin);
        }
        activeJobId = null;
        if (!cancelledJobs.has(jobId)) {
            source.postMessage({ type: 'eg-result', jobId, positions }, origin);
        }
        cancelledJobs.delete(jobId);
    }

    let jobQueue = Promise.resolve();

    window.addEventListener('message', (event) => {
        if (!PARENT_ORIGIN_RE.test(event.origin)) return;
        const msg = event.data;
        if (!msg || typeof msg.type !== 'string') return;
        const source = event.source;
        const origin = event.origin;

        if (msg.type === 'eg-ping') {
            if (engineError) source.postMessage({ type: 'eg-engine-error', error: engineError }, origin);
            else if (engineReady) source.postMessage({ type: 'eg-ready' }, origin);
            return;
        }
        if (msg.type === 'eg-cancel') {
            cancelledJobs.add(msg.jobId);
            if (activeJobId === msg.jobId) send('stop');
            return;
        }
        if (msg.type === 'eg-analyze') {
            if (!Array.isArray(msg.moves) || !msg.moves.every((m) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m))) {
                source.postMessage({ type: 'eg-engine-error', jobId: msg.jobId, error: 'Invalid move list' }, origin);
                return;
            }
            if (msg.positionIndexes !== undefined && (!Array.isArray(msg.positionIndexes)
                || !msg.positionIndexes.every((idx) => Number.isInteger(idx) && idx >= 0 && idx <= msg.moves.length))) {
                source.postMessage({ type: 'eg-engine-error', jobId: msg.jobId, error: 'Invalid position list' }, origin);
                return;
            }
            jobQueue = jobQueue.then(() => runJob(source, origin, msg));
        }
    });

    startEngine();
})();
