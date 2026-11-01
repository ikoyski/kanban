/**
 * Stable UI facade shared by the application modules.
 *
 * DOM references are attached by ui/dom.js after HTML partials are loaded.
 * Feature implementations are attached by focused modules under ui/.
 * Keep only cross-module editor state here; avoid duplicating implementations.
 */
export const UI = {
    descriptionEditor: null,
    commentEditor: null,
};
