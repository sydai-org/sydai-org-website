/**
 * Konami shooter — single engine entry point.
 *
 * Re-exports the LittleJS *release* build (littlejs.esm.min.js) instead of the
 * package root. The root's `exports` map serves the debug build outside of
 * production ("default" condition), and the debug build renders a version/FPS
 * watermark and binds debug keys (its debug toggle is Escape — the same key
 * this game uses to exit). The release build compiles all of that out.
 *
 * All `src/game/*` modules must import the engine from here, never from
 * `littlejsengine` directly.
 *
 * The file is referenced by path because the package's `exports` map only
 * exposes the root specifier (serving the debug build by default), so the bare
 * `littlejsengine/dist/littlejs.esm.min.js` subpath is not importable.
 */
export * from '../../node_modules/littlejsengine/dist/littlejs.esm.min.js';
