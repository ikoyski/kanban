import { UI } from '../ui.js';
import { escapeHtml, toPlainText } from '../editor.js';

export function createColumnElement(column, cards, role = 'EDITOR') {
    const div = document.createElement('div');
    div.className = 'group flex-shrink-0 w-[300px] flex flex-col max-h-full bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700';
    div.id = `col-${column.id}`;
    div.dataset.columnId = column.id;

    const cardCount = column.cardIds.length;
    const isViewer = role === 'VIEWER';

    div.innerHTML = `
        <div class="flex items-center justify-between mb-4 px-1">
            <div class="flex items-center gap-2">
                <div class="column-drag-handle cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-primary-600 transition-colors rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 ${isViewer ? 'hidden' : ''}" title="Drag to reorder column">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                    </svg>
                </div>
                <h3 class="font-bold text-slate-700 dark:text-slate-200">${column.title}</h3>
                <div class="flex gap-1 opacity-60 hover:opacity-100 transition-opacity ${isViewer ? 'hidden' : ''}">
                    <button class="rename-col-btn text-slate-400 hover:text-primary-600 transition-colors" title="Rename Column">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button class="delete-col-btn text-slate-400 hover:text-red-600 transition-colors" title="Delete Column">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
                <span class="column-card-count text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">${cardCount}</span>
            </div>
            <button class="add-card-btn text-slate-400 hover:text-primary-600 transition-colors ${isViewer ? 'hidden' : ''}" title="Add Card">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>
            </button>
        </div>
        <div class="card-list flex-1 overflow-y-auto space-y-3 pb-4" data-column-id="${column.id}">
            ${column.cardIds.map(id => this.createCardHTML(cards[id], role)).join('')}
        </div>
    `;

    const addBtn = div.querySelector('.add-card-btn');
    if (addBtn) addBtn.onclick = () => {
        window.dispatchEvent(new CustomEvent('open-card-modal', { detail: { columnId: column.id } }));
    };
    const renameBtn = div.querySelector('.rename-col-btn');
    if (renameBtn) renameBtn.onclick = () => {
        window.dispatchEvent(new CustomEvent('rename-column', { detail: { columnId: column.id } }));
    };
    const deleteBtn = div.querySelector('.delete-col-btn');
    if (deleteBtn) deleteBtn.onclick = () => {
        window.dispatchEvent(new CustomEvent('delete-column', { detail: { columnId: column.id } }));
    };
    return div;
}

export function createCardHTML(card, role = 'EDITOR') {
    if (!card) return '';
    const priorityColors = {
        HIGH: 'border-red-500 text-red-600 bg-red-100 dark:bg-red-900/20',
        MEDIUM: 'border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
        LOW: 'border-green-500 text-green-600 bg-green-100 dark:bg-green-900/20',
    };
    const priorityClass = priorityColors[card.priority] || priorityColors.MEDIUM;
    const labelsHTML = card.labels.map(label =>
        `<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">${label}</span>`
    ).join(' ');
    const isViewer = role === 'VIEWER';

    return `
        <div class="card group dark:bg-slate-800 p-3 rounded-xl shadow-sm border-l-4 ${priorityClass} cursor-pointer relative" data-card-id="${card.id}" data-id="${card.id}">
            <div class="flex items-center justify-between mb-2">
                <div class="flex flex-wrap gap-1">${labelsHTML}</div>
                <div class="drag-handle cursor-grab active:cursor-grabbing p-1.5 text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-md hover:bg-slate-200 dark:hover:bg-slate-700" title="Drag to move">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                    </svg>
                </div>
            </div>
            <h4 class="font-semibold text-sm mb-1 text-slate-800 dark:text-slate-100">${card.title}</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">${escapeHtml(toPlainText(card.description))}</p>
            <div class="flex items-center justify-between mt-auto">
                <div class="flex items-center gap-2 text-[10px] text-slate-400">
                    ${card.dueDate ? `
                        <div class="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg><span>${card.dueDate}</span>
                        </div>` : ''}
                    ${card.commentCount !== undefined ? `
                        <div class="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg><span>${card.commentCount}</span>
                        </div>` : ''}
                </div>
                <div class="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ${isViewer ? 'hidden' : ''}">
                    <button class="delete-btn p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

Object.assign(UI, { createColumnElement, createCardHTML });
