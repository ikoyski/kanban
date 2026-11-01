import { UI } from '../ui.js';
import { createRichEditor, toDisplayHtml } from '../editor.js';

/**
 * Render and wire the card detail dialog.
 * Plain-text fields are escaped by the ui-security facade decorator before
 * this implementation is invoked; descriptions remain on the sanitized
 * rich-text rendering path in editor.js.
 */
export function openCardDetail(card, role, callbacks = {}) {
    const modal = document.getElementById('card-detail-modal');
    const box = modal.querySelector('.relative');
    const content = document.getElementById('card-detail-body');

    content.innerHTML = `
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-slate-800 dark:text-slate-100">Card Details</h2>
            <button class="close-detail-btn text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <div class="detail-scroll max-h-[65vh] overflow-y-auto space-y-6 pr-2">
            <div class="space-y-1">
                <label class="text-xs font-semibold text-slate-500 tracking-wider">Title</label>
                <div class="detail-title text-lg font-bold text-slate-800 dark:text-slate-100 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded transition-colors">${card.title}</div>
            </div>

            <div class="space-y-1">
                <label class="text-xs font-semibold text-slate-500 tracking-wider">Description</label>
                <div class="detail-description rich-content text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded transition-colors">${card.description ? toDisplayHtml(card.description) : '<span class="text-slate-400 italic">No description - click to add one</span>'}</div>
            </div>

            <div class="flex flex-wrap gap-4">
                <div class="space-y-1">
                    <label class="text-xs font-semibold text-slate-500 tracking-wider">Priority</label>
                    <div class="detail-priority flex gap-2 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        ${(() => {
                            const activePriorityClasses = {
                                LOW: 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                                MEDIUM: 'bg-yellow-100 border-yellow-500 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                                HIGH: 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                            };
                            const inactivePriorityClasses = 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400 hover:border-primary-400';
                            return ['LOW', 'MEDIUM', 'HIGH'].map(priority => `
                                <span data-priority="${priority}" class="px-2 py-1 text-xs font-bold rounded border cursor-pointer ${priority === card.priority ? activePriorityClasses[priority] : inactivePriorityClasses}">${priority}</span>
                            `).join('');
                        })()}
                    </div>
                </div>
                <div class="space-y-1">
                    <label class="text-xs font-semibold text-slate-500 tracking-wider">Due Date</label>
                    <div class="detail-date text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded transition-colors">${card.dueDate || 'No date set'}</div>
                </div>
            </div>

            <div class="space-y-1">
                <label class="text-xs font-semibold text-slate-500 tracking-wider">Labels (comma separated)</label>
                <div class="detail-labels flex flex-wrap gap-1 cursor-pointer p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    ${card.labels.length ? card.labels.map(label => `<span class="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">${label}</span>`).join(' ') : '<span class="text-sm text-slate-400 italic">No labels - click to add</span>'}
                </div>
            </div>

            <div class="pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
                <label class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comments</label>
                <div class="comments-list space-y-3">
                    <div class="text-center py-4 text-sm text-slate-400">Loading comments...</div>
                </div>
                <div class="space-y-2">
                    <div id="comment-editor"></div>
                    <div class="flex justify-end">
                        <button id="add-comment-btn" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50">Comment</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="pt-6 mt-6 flex justify-between items-center border-t border-slate-200 dark:border-slate-700">
            <div class="flex gap-3">
                <button id="archive-card-btn" class="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Archive</button>
                <button id="delete-card-btn" class="px-4 py-2 text-sm font-semibold text-red-500 hover:text-red-700 transition-colors">Delete</button>
            </div>
            <button class="close-detail-btn px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">Close</button>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        box.classList.remove('scale-95', 'opacity-0');
        box.classList.add('scale-100', 'opacity-100');
    }, 10);

    if (role !== 'VIEWER') {
        const titleEl = content.querySelector('.detail-title');
        titleEl.onclick = () => callbacks?.onEditTitle?.(titleEl, card);
        const descriptionEl = content.querySelector('.detail-description');
        descriptionEl.onclick = event => {
            if (event.target.closest('a')) return;
            callbacks?.onEditDescription?.(descriptionEl, card);
        };
        const labelsEl = content.querySelector('.detail-labels');
        labelsEl.onclick = () => callbacks?.onEditLabels?.(labelsEl, card);
        const dateEl = content.querySelector('.detail-date');
        dateEl.onclick = () => callbacks?.onEditDate?.(dateEl, card);
        content.querySelectorAll('.detail-priority span').forEach(span => {
            span.onclick = () => callbacks?.onEditPriority?.(span.dataset.priority, card);
        });
    }

    const archiveBtn = content.querySelector('#archive-card-btn');
    const deleteBtn = content.querySelector('#delete-card-btn');
    if (role !== 'VIEWER') {
        if (archiveBtn) archiveBtn.onclick = () => callbacks?.onArchive?.(card.id);
        if (deleteBtn) deleteBtn.onclick = () => callbacks?.onDelete?.(card.id);
    } else {
        archiveBtn?.classList.add('hidden');
        deleteBtn?.classList.add('hidden');
    }

    modal.querySelectorAll('.close-detail-btn').forEach(button => {
        button.onclick = () => this.closeDetailModal();
    });

    // The lifecycle decorator destroys the previous editor before this method
    // runs and also destroys this editor when the dialog closes.
    this.commentEditor = createRichEditor(content.querySelector('#comment-editor'), {
        placeholder: 'Write a comment...',
        compact: true,
    });
}

export function closeDetailModal() {
    const modal = document.getElementById('card-detail-modal');
    const content = modal.querySelector('.relative');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
}

Object.assign(UI, { openCardDetail, closeDetailModal });
