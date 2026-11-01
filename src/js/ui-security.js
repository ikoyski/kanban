/**
 * UI security boundary for untrusted plain-text values.
 *
 * Rich text continues to use the DOMPurify-backed helpers in editor.js
 * (toDisplayHtml / normalizeEditorHtml). Plain-text values that are later
 * interpolated into UI templates are HTML-escaped before ui.js receives them.
 *
 * This module intentionally keeps the existing UI API and rendering structure
 * unchanged while the larger ui.js split remains a separate concern.
 */

import { UI } from './ui.js';
import { escapeHtml } from './editor.js';

const safeText = (value) => escapeHtml(value ?? '');

const safeCardForTemplate = (card) => ({
    ...card,
    title: safeText(card?.title),
    labels: Array.isArray(card?.labels) ? card.labels.map(safeText) : [],
    dueDate: card?.dueDate == null ? card?.dueDate : safeText(card.dueDate),
});

const safeColumnForTemplate = (column) => ({
    ...column,
    title: safeText(column?.title),
});

const safeStateForTemplate = (state) => ({
    ...state,
    name: safeText(state?.name),
});

const safeBoardForTemplate = (board) => ({
    ...board,
    name: safeText(board?.name),
});

const safeCommentForTemplate = (comment) => ({
    ...comment,
    userName: safeText(comment?.userName),
});

const safeArchivedCardForTemplate = (card) => ({
    ...card,
    title: safeText(card?.title),
});

const originalRenderBoard = UI.renderBoard;
UI.renderBoard = function (state, role) {
    return originalRenderBoard.call(this, safeStateForTemplate(state), role);
};

const originalCreateColumnElement = UI.createColumnElement;
UI.createColumnElement = function (column, cards, role) {
    return originalCreateColumnElement.call(
        this,
        safeColumnForTemplate(column),
        cards,
        role,
    );
};

const originalCreateCardHTML = UI.createCardHTML;
UI.createCardHTML = function (card, role) {
    return originalCreateCardHTML.call(this, safeCardForTemplate(card), role);
};

const originalRenderBoardSwitcher = UI.renderBoardSwitcher;
UI.renderBoardSwitcher = function (boards, currentBoardId) {
    return originalRenderBoardSwitcher.call(this, boards.map(safeBoardForTemplate), currentBoardId);
};

const originalOpenCardDetail = UI.openCardDetail;
UI.openCardDetail = function (card, role, callbacks = {}) {
    const safeCard = safeCardForTemplate(card);
    const safeCallbacks = { ...callbacks };

    // ui.js receives the escaped card for rendering, but edit/save handlers
    // must continue receiving the original card object so user-entered values
    // are never persisted in their HTML-escaped form.
    ['onEditTitle', 'onEditDescription', 'onEditLabels', 'onEditDate', 'onEditPriority']
        .forEach((name) => {
            if (typeof callbacks?.[name] !== 'function') return;
            safeCallbacks[name] = (...args) => {
                if (args.length > 1) args[1] = card;
                return callbacks[name](...args);
            };
        });

    return originalOpenCardDetail.call(this, safeCard, role, safeCallbacks);
};

const originalRenderComments = UI.renderComments;
UI.renderComments = function (container, comments) {
    return originalRenderComments.call(this, container, comments?.map(safeCommentForTemplate));
};

const originalRenderArchivedCards = UI.renderArchivedCards;
UI.renderArchivedCards = function (container, archivedCards, role, onRestore) {
    return originalRenderArchivedCards.call(
        this,
        container,
        archivedCards?.map(safeArchivedCardForTemplate),
        role,
        onRestore,
    );
};
