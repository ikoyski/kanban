import { UI } from '../ui.js';
import { createRichEditor } from '../editor.js';

export function startInlineEdit(displayEl, { value, multiline = false, type = 'text', onSave }) {
    if (displayEl.dataset.editing === 'true') return;
    displayEl.dataset.editing = 'true';
    const input = document.createElement(multiline ? 'textarea' : 'input');
    if (!multiline) input.type = type;
    input.value = value;
    input.className = 'inline-edit-input px-2 py-1 rounded border border-primary-300 dark:border-primary-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm w-full';
    if (multiline) input.classList.add('h-24', 'resize-none');
    const saveBtn = document.createElement('button');
    saveBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>';
    saveBtn.className = 'p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors';
    const cancelBtn = document.createElement('button');
    cancelBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    cancelBtn.className = 'p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors';
    const wrapper = document.createElement(multiline ? 'div' : 'span');
    wrapper.className = multiline ? 'flex flex-col gap-2 w-full' : 'flex items-center gap-1 w-full';
    if (multiline) {
        const row = document.createElement('div');
        row.className = 'flex justify-end gap-2';
        row.append(saveBtn, cancelBtn);
        wrapper.append(input, row);
    } else wrapper.append(input, saveBtn, cancelBtn);
    const originalHTML = displayEl.innerHTML;
    displayEl.replaceChildren(wrapper);
    input.focus();
    const restore = () => {
        displayEl.innerHTML = originalHTML;
        delete displayEl.dataset.editing;
    };
    cancelBtn.onclick = event => { event.stopPropagation(); restore(); };
    const handleSave = async event => {
        if (event?.type === 'keydown' && event.key !== 'Enter') return;
        if (event?.type === 'keydown' && multiline && !event.metaKey && !event.ctrlKey) return;
        try {
            await onSave(input.value);
            delete displayEl.dataset.editing;
        } catch (error) {
            restore();
            alert('Failed to save: ' + error.message);
        }
    };
    saveBtn.onclick = event => { event.stopPropagation(); handleSave(event); };
    input.onkeydown = event => {
        if (event.key === 'Escape') restore();
        if (event.key === 'Enter') handleSave(event);
    };
}

export function startRichEdit(displayEl, { html = '', placeholder = 'Add a description...', onSave }) {
    if (displayEl.dataset.editing === 'true') return;
    displayEl.dataset.editing = 'true';
    const originalHTML = displayEl.innerHTML;
    displayEl.replaceChildren();
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
    const row = document.createElement('div');
    row.className = 'flex justify-end gap-2';
    row.append(cancelBtn, saveBtn);
    wrapper.append(editorEl, row);
    displayEl.appendChild(wrapper);
    const editor = createRichEditor(editorEl, { html, placeholder });
    editor.focus();
    const restore = () => {
        editor.destroy();
        displayEl.innerHTML = originalHTML;
        delete displayEl.dataset.editing;
    };
    const save = async () => {
        saveBtn.disabled = true;
        try {
            await onSave(editor.getHtml());
            delete displayEl.dataset.editing;
        } catch (error) {
            restore();
            alert('Failed to save: ' + error.message);
        }
    };
    cancelBtn.onclick = event => { event.stopPropagation(); restore(); };
    saveBtn.onclick = event => { event.stopPropagation(); save(); };
    editor.onKeydown(event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            restore();
        } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            save();
        }
    });
}
Object.assign(UI, { startInlineEdit, startRichEdit });
