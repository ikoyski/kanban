/**
 * Shared UI facade and cross-module editor state.
 *
 * DOM references are registered after partial loading by ui/dom.js.
 * UI operations are installed by focused feature modules under ui/.
 * Keep this module free of rendering logic so callers retain one stable API
 * without duplicate legacy implementations.
 */
export const UI = {
    descriptionEditor: null,
    commentEditor: null,
};
