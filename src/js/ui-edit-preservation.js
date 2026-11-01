/**
 * Non-destructive inline editing boundary.
 *
 * Failed saves keep the user's current editor contents in place so the user
 * can retry or explicitly cancel instead of losing their changes.
 */

import { UI } from './ui.js';
import { createRichEditor } from './editor.js';

const showSaveError = (container, message) => {
    let errorEl = container.querySelector('.inline-edit-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'inline-edit-error text-xs text-red-600 dark:text-red-400';
        container.appendChild(errorEl);
    }
    errorEl.textContent = `Failed to save: ${message || 'Please try again.'}`;
};

const clearSaveError = (container) => {
    container.querySelector('.inline-edit-error')?.remove();
};

const originalStartInlineEdit = UI.startInlineEdit;
UI.startInlineEdit = function (displayEl, {
    value,
    multiline = false,
    type = 'text',
    onSave,
}) {
    if (displayEl.dataset.editing === 'true') return;
    displayEl.dataset.editing = 'true';

    const input = document.createElement(multiline ? 'textarea' : 'input');
    if (!multiline) input.type = type;
    input.value = value;
    input.className = 'inline-edit-input px-2 py-1 rounded border border-primary-300 dark:border-primary-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm';
    input.className += multiline ? ' w-full h-24 resize-none' : ' w-full';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>`;
    saveBtn.className = 'p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6" /></svg>`;
    cancelBtn.className = 'p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors';

    const wrapper = document.createElement(multiline ? 'div' : 'span');
    wrapper.className = multiline ? 'flex flex-col gap-2 w-full' : 'flex items-center gap-1 w-full';

    if (multiline) {
        const btnRow = document.createElement('div');
        btnRow.className = 'flex justify-end gap-2';
        btnRow.append(saveBtn, cancelBtn);
        wrapper.append(input, btnRow);
    } else {
        wrapper.append(input, saveBtn, cancelBtn);
    }

    const originalHTML = displayEl.innerHTML;
    displayEl.innerHTML = '';
    displayEl.appendChild(wrapper);
    input.focus();

    const restore = () => {
        displayEl.innerHTML = originalHTML;
        delete displayEl.dataset.editing;
    };

    const setSaving = (saving) => {
        saveBtn.disabled = saving;
        cancelBtn.disabled = saving;
        input.disabled = saving;
    };

    const handleSave = async (event) => {
        if (event?.type === 'keydown' && event.key !== 'Enter') return;
        if (event?.type === 'keydown' && multiline && !event.metaKey && !event.ctrlKey) return;
        if (saveBtn.disabled) return;

        clearSaveError(wrapper);
        setSaving(true);

        try {
            await onSave(input.value);
            delete displayEl.dataset.editing;
        } catch (err) {
            // Keep the editor and its current value intact. The user can retry
            // without having to reconstruct what they typed.
            setSaving(false);
            showSaveError(wrapper, err?.message);
            input.focus();
            input.select?.();
        }
    };

    cancelBtn.onclick = (event) => {
        event.stopPropagation();
        if (!saveBtn.disabled) restore();
    };

    saveBtn.onclick = (event) => {
        event.stopPropagation();
        handleSave(event);
    };

    input.onkeydown = (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            if (!saveBtn.disabled) restore();
            return;
        }
        if (event.key === 'Enter') handleSave(event);
    };
};

const originalStartRichEdit = UI.startRichEdit;
UI.startRichEdit = function (displayEl, {
    html = '',
    placeholder = 'Add a description...',
    onSave,
}) {
    if (displayEl.dataset.editing === 'true') return;
    displayEl.dataset.editing = 'true';

    const originalHTML = displayEl.innerHTML;
    displayEl.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-col gap-2 w-full cursor-auto';

    const editorEl = document.createElement('div');
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.className = 'px-3 py-1 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-all active:scale-95 disabled:opacity-50';

    const btnRow = document.createElement('div');
    btnRow.className = 'flex justify-end gap-2';
    btnRow.append(cancelBtn, saveBtn);
    wrapper.append(editorEl, btnRow);
    displayEl.appendChild(wrapper);

    const editor = createRichEditor(editorEl, { html, placeholder });
    editor.focus();

    const restore = () => {
        editor.destroy();
        displayEl.innerHTML = originalHTML;
        delete displayEl.dataset.editing;
    };

    const setSaving = (saving) => {
        saveBtn.disabled = saving;
        cancelBtn.disabled = saving;
    };

    const save = async () => {
        if (saveBtn.disabled) return;
        clearSaveError(wrapper);
        setSaving(true);

        try {
            await onSave(editor.getHtml());
            delete displayEl.dataset.editing;
        } catch (err) {
            // Do not destroy/recreate Quill on failure. Its current document is
            // the user's work and remains available for retry.
            setSaving(false);
            showSaveError(wrapper, err?.message);
            editor.focus();
        }
    };

    cancelBtn.onclick = (event) => {
        event.stopPropagation();
        if (!saveBtn.disabled) restore();
    };
    saveBtn.onclick = (event) => {
        event.stopPropagation();
        save();
    };

    editor.onKeydown((event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!saveBtn.disabled) restore();
        } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            save();
        }
    });
};

// Keep the original references intentionally unused after wrapping; this module
// preserves the existing UI API while replacing only the destructive failure path.
void originalStartInlineEdit;
void originalStartRichEdit;
