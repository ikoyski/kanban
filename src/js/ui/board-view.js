import { UI } from '../ui.js';

// Board-level rendering stays behind the existing UI facade so app.js callers
// do not need to know where the implementation lives.
export function renderBoard(state, role = 'EDITOR') {
    const roleDisplay = role === 'EDITOR'
        ? ' (can edit)'
        : role === 'VIEWER'
            ? ' (view only)'
            : ' (owned)';

    this.boardName.textContent = state.name + roleDisplay;
    this.setBoardControlsVisible(true);
    this.renameBoardBtn.style.visibility = role === 'VIEWER' ? 'hidden' : '';

    this.boardContainer.replaceChildren();
    Object.values(state.columns)
        .sort((a, b) => a.position - b.position)
        .forEach(column => {
            this.boardContainer.appendChild(this.createColumnElement(column, state.cards, role));
        });
}

export function setBoardControlsVisible(visible) {
    this.renameBoardBtn.style.visibility = visible ? '' : 'hidden';
    [
        'members-menu',
        'export-menu',
        'import-menu',
        'add-column-menu',
        'archived-cards-menu',
    ].forEach(id => {
        document.getElementById(id)?.classList.toggle('hidden', !visible);
    });

    const search = document.getElementById('search-input');
    if (search) {
        search.disabled = !visible;
        if (!visible) search.value = '';
    }
}

export function renderEmptyState() {
    this.boardName.textContent = '';
    this.setBoardControlsVisible(false);
    this.boardContainer.innerHTML = `
        <div class="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6">
            <div class="bg-slate-200 dark:bg-slate-800 p-6 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2m-3 7h3m-3 4h3m-6 0h3m-3 4h3" />
                </svg>
            </div>
            <div>
                <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100">No boards yet</h2>
                <p class="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-2">You don't have any boards yet. Create one to start organizing your tasks!</p>
            </div>
            <button id="create-first-board-btn" class="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95">
                Create Your First Board
            </button>
        </div>
    `;

    document.getElementById('create-first-board-btn').onclick = () => {
        window.dispatchEvent(new CustomEvent('create-board-trigger'));
    };
}

// Install before ui-security.js; the security module wraps these active
// implementations while preserving the long-standing UI method names.
Object.assign(UI, {
    renderBoard,
    setBoardControlsVisible,
    renderEmptyState,
});
