import ApiClient from '../api.js';
import { UI } from '../ui.js?v=20261101-members-avatar-fix';
import { toPlainText } from '../editor.js';

// Board rendering, sorting and client-side filtering.
export const BoardInteractions = {
    renderAndBind() {
        UI.renderBoard(this.state, this.currentRole);
        this.initSortables();
    }

    initSortables() {
        if (this.currentRole === 'VIEWER') return;

        if (typeof Sortable === 'undefined') {
            console.error('SortableJS is not loaded. Please check the CDN link in kanban.html');
            return;
        }

        // Column Sortable (the container survives re-renders, so drop the previous instance first)
        if (this.columnSortable) this.columnSortable.destroy();
        this.columnSortable = Sortable.create(UI.boardContainer, {
            group: 'kanban-columns',
            handle: '.column-drag-handle',
            animation: 150,
            draggable: '[data-column-id]',
            onEnd: (evt) => this.handleColumnSortEnd(evt),
        });

        Object.values(this.state.columns).forEach(column => {
            const el = document.querySelector(`.card-list[data-column-id="${column.id}"]`);
            if (!el) {
                console.warn(`Column element not found for id: ${column.id}`);
                return;
            }

            Sortable.create(el, {
                group: 'kanban',
                handle: '.drag-handle',
                animation: 150,
                ghostClass: 'drag-card-ghost',
                dragClass: 'drag-card-active',
                onStart: (evt) => console.log('Drag started!', evt),
                onUpdate: (evt) => console.log('Card moved!', evt),
                onEnd: (evt) => {
                    console.log('Drag ended!', evt);
                    this.handleSortEnd(evt);
                }
            });
        });
    }

    async handleColumnSortEnd(evt) {
        if (this.currentRole === 'VIEWER') {
            this.renderAndBind();
            return;
        }
        const orderedIds = [...UI.boardContainer.children]
            .map(el => el.dataset.columnId)
            .filter(Boolean);

        const oldState = JSON.parse(JSON.stringify(this.state));

        const reordered = {};
        orderedIds.forEach((id, index) => {
            this.state.columns[id].position = index;
            reordered[id] = this.state.columns[id];
        });
        this.state.columns = reordered;

        try {
            await ApiClient.reorderColumns(
                orderedIds.map((id, index) => ({ id, position: index }))
            );
        } catch (error) {
            this.renderAndBind();
            alert('Failed to reorder columns: ' + error.message);
        }
    }

    async handleSortEnd(evt) {
        if (this.currentRole === 'VIEWER') {
            // Revert the move visually if Sortable allowed it
            this.renderAndBind();
            return;
        }

        const { oldIndex, newIndex } = evt;
        const sourceColId = evt.from.dataset.columnId;
        const destColId = evt.to.dataset.columnId;

        const oldState = JSON.parse(JSON.stringify(this.state));
        const cardId = this.state.columns[sourceColId].cardIds.splice(oldIndex, 1)[0];
        this.state.columns[destColId].cardIds.splice(newIndex, 0, cardId);
        UI.updateCardCounts(this.state);

        try {
            await ApiClient.moveCard(cardId, destColId, newIndex);
        } catch (error) {
            this.state = oldState;
            this.renderAndBind();
            alert('Failed to delete card: ' + error.message);
        }
    }

    // Create a new card (existing cards are edited inline in the detail modal)

    filterCards(term) {
        const cards = document.querySelectorAll('.card');
        cards.forEach(cardEl => {
            const id = cardEl.dataset.cardId;
            const card = this.state.cards[id];
            const matches = card.title.toLowerCase().includes(term) ||
                           toPlainText(card.description).toLowerCase().includes(term) ||
                           card.labels.some(l => l.toLowerCase().includes(term));

            cardEl.classList.toggle('hidden', !matches);
        });
    }
};
