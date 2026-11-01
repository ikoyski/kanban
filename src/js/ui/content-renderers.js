import { UI } from '../ui.js';
import { escapeHtml, toDisplayHtml, toPlainText } from '../editor.js';

export function renderBoardSwitcher(boards, currentBoardId) {
    if (!this.boardSwitcher) return;
    this.boardSwitcher.innerHTML = `
        <option value="" disabled ${!currentBoardId ? 'selected' : ''}>Select Board</option>
        ${boards.map(board => `
            <option value="${board.id}" ${board.id === currentBoardId ? 'selected' : ''}>
                ${board.name}
            </option>
        `).join('')}
    `;
}

export function renderComments(container, comments) {
    if (!comments || comments.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-sm text-slate-400">No comments yet. Be the first to add one!</div>';
        return;
    }
    container.innerHTML = comments.map(comment => `
        <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 group">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-200">${comment.userName}</span>
                    <span class="text-[10px] text-slate-400">${new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <button class="delete-comment-btn text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" data-comment-id="${comment.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
            <div class="rich-content text-sm text-slate-600 dark:text-slate-400">${toDisplayHtml(comment.content)}</div>
        </div>
    `).join('');
}

export function renderArchivedCards(container, archivedCards, role, onRestore) {
    if (!archivedCards || archivedCards.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400">No archived cards found.</div>';
        return;
    }
    container.innerHTML = archivedCards.map(card => `
        <div class="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-3">
            <div>
                <h4 class="font-bold text-slate-800 dark:text-slate-100 line-clamp-1">${card.title}</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">${escapeHtml(toPlainText(card.description)) || 'No description'}</p>
            </div>
            <div class="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-slate-700">
                <span class="text-[10px] text-slate-400">Archived: ${card.archivedAt ? new Date(card.archivedAt).toLocaleDateString() : 'Unknown'}</span>
                ${role !== 'VIEWER' ? `
                    <button class="restore-card-btn text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors" data-card-id="${card.id}">
                        Restore
                    </button>` : ''}
            </div>
        </div>
    `).join('');
    if (role !== 'VIEWER') {
        container.querySelectorAll('.restore-card-btn').forEach(button => {
            button.onclick = () => onRestore(button.dataset.cardId);
        });
    }
}

Object.assign(UI, { renderBoardSwitcher, renderComments, renderArchivedCards });
