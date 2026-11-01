import { UI } from '../ui.js';

export function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        this.themeDarkIcon.classList.add('hidden');
        this.themeLightIcon.classList.remove('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        this.themeLightIcon.classList.add('hidden');
        this.themeDarkIcon.classList.remove('hidden');
    }
}

export function updateCardCounts(state) {
    Object.values(state.columns).forEach(column => {
        const colEl = document.getElementById(`col-${column.id}`);
        if (!colEl) return;
        const countEl = colEl.querySelector('.column-card-count');
        if (countEl) countEl.textContent = column.cardIds.length;
    });
}

Object.assign(UI, { setTheme, updateCardCounts });
