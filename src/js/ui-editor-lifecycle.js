/**
 * Rich-text editor lifecycle boundary.
 *
 * Card-detail rendering replaces the modal body, so the existing Quill editor
 * must be torn down before that DOM is discarded. This wrapper keeps the
 * existing UI API intact while making editor ownership explicit.
 */

import { UI } from './ui.js';

const destroyCommentEditor = () => {
    if (!UI.commentEditor) return;

    UI.commentEditor.destroy?.();
    UI.commentEditor = null;
};

const originalOpenCardDetail = UI.openCardDetail;
UI.openCardDetail = function (...args) {
    // openCardDetail rebuilds the modal content and mounts a new editor.
    // Destroy the previous instance first so repeated opens do not accumulate
    // detached Quill instances.
    destroyCommentEditor();
    return originalOpenCardDetail.apply(this, args);
};

const originalCloseDetailModal = UI.closeDetailModal;
UI.closeDetailModal = function (...args) {
    // Closing the modal must release the current editor rather than merely
    // dropping the JavaScript reference to it.
    destroyCommentEditor();
    return originalCloseDetailModal.apply(this, args);
};
