import ApiClient from '../api.js';
import { UI } from '../ui.js';

// Card creation, detail editing, comments and archive workflows.
export const CardActions = {
    cardDetailCallbacks() {
        return {
            onEditTitle: (el, card) => this.handleDetailEdit(el, card, 'title'),
            onEditDescription: (el, card) => this.handleDetailEdit(el, card, 'description', false, 'text', true),
            onEditLabels: (el, card) => this.handleDetailEdit(el, card, 'labels'),
            onEditDate: (el, card) => this.handleDetailEdit(el, card, 'dueDate', false, 'date'),
            onEditPriority: (priority, card) => this.handleDetailPriorityChange(priority, card),
            onArchive: (cardId) => this.handleArchiveCard(cardId),
            onDelete: (cardId) => {
                this.pendingDeleteId = cardId;
                UI.openConfirm(cardId);
            },
        };
    },

    async handleDetailPriorityChange(newPriority, card) {
        if (newPriority === card.priority) return;

        const oldCard = { ...card };
        this.state.cards[card.id] = { ...card, priority: newPriority };

        this.renderAndBind();
        this.showCardDetail(card.id);

        try {
            await ApiClient.updateCard(card.id, { priority: newPriority });
        } catch (error) {
            this.state.cards[card.id] = oldCard;
            this.renderAndBind();
            this.showCardDetail(card.id);
            alert('Failed to save: ' + error.message);
        }
    },

    async handleFormSubmit() {
        if (this.currentRole === 'VIEWER') {
            alert('You do not have permission to add cards.');
            return;
        }

        const columnId = document.getElementById('column-id').value;

        const cardData = {
            title: document.getElementById('form-title').value,
            description: UI.descriptionEditor.getHtml(),
            priority: document.querySelector('input[name="priority"]:checked').value,
            dueDate: document.getElementById('form-date').value,
            labels: document.getElementById('form-labels').value.split(',').map(l => l.trim()).filter(l => l !== ''),
        };

        const tempId = 'card-' + Date.now();
        const newCard = {
            id: tempId,
            ...cardData,
            createdAt: new Date().toISOString(),
        };
        this.state.cards[tempId] = newCard;
        if (columnId && this.state.columns[columnId]) {
            this.state.columns[columnId].cardIds.push(tempId);
        } else {
            this.state.columns['todo'].cardIds.push(tempId);
        }
        this.renderAndBind();
        UI.closeModal();

        try {
            const createdCard = await ApiClient.createCard(columnId, cardData);
            delete this.state.cards[tempId];
            this.state.cards[createdCard.id] = createdCard;

            Object.values(this.state.columns).forEach(col => {
                col.cardIds = col.cardIds.map(id => id === tempId ? createdCard.id : id);
            });
            this.renderAndBind();
        } catch (error) {
            delete this.state.cards[tempId];
            Object.values(this.state.columns).forEach(col => {
                col.cardIds = col.cardIds.filter(id => id !== tempId);
            });
            this.renderAndBind();
            alert('Failed to create card: ' + error.message);
        }
    },

    async handleDetailEdit(el, card, field, multiline = false, type = 'text', rich = false) {
        const currentValue = card[field];
        const formattedValue = field === 'labels' ? currentValue.join(', ') : currentValue;

        const onSave = async (newValue) => {
            let updatedValue = newValue;
            if (field === 'labels') {
                updatedValue = newValue.split(',').map(l => l.trim()).filter(l => l !== '');
            }

            const oldCard = { ...card };
            this.state.cards[card.id] = { ...card, [field]: updatedValue };

            // Update UI in detail modal
            this.renderAndBind();
            this.showCardDetail(card.id);

            try {
                await ApiClient.updateCard(card.id, { [field]: updatedValue });
            } catch (error) {
                this.state.cards[card.id] = oldCard;
                this.renderAndBind();
                this.showCardDetail(card.id);
                alert('Failed to save: ' + error.message);
            }
        };

        if (rich) {
            await UI.startRichEdit(el, { html: currentValue || '', onSave });
            return;
        }

        await UI.startInlineEdit(el, {
            value: formattedValue || '',
            multiline: multiline,
            type: type,
            onSave,
        });
    },

    async handleDelete() {
        if (this.currentRole === 'VIEWER') {
            alert('You do not have permission to delete cards.');
            return;
        }

        const cardId = this.pendingDeleteId;
        if (!cardId) return;

        const oldState = JSON.parse(JSON.stringify(this.state));

        Object.values(this.state.columns).forEach(col => {
            col.cardIds = col.cardIds.filter(id => id !== cardId);
        });
        delete this.state.cards[cardId];

        this.renderAndBind();
        UI.closeConfirm();
        UI.closeDetailModal();

        try {
            await ApiClient.deleteCard(cardId);
        } catch (error) {
            this.state = oldState;
            this.renderAndBind();
            alert('Failed to delete card: ' + error.message);
        }
        this.pendingDeleteId = null;
    },

    async handleOpenCardDetail(cardId) {
        this.showCardDetail(cardId);
    },

    // Renders the card detail modal and wires up its comments. This runs on open AND after every
    // inline edit (which re-renders the whole modal), so the comment list and the comment editor
    // are always rebuilt together with the modal body.,

    showCardDetail(cardId) {
        const card = this.state.cards[cardId];
        if (!card) return;

        // Keep an unsent comment draft when the modal re-renders for the same card.
        const modal = document.getElementById('card-detail-modal');
        const isOpen = !modal.classList.contains('hidden');
        const draft = isOpen && this.detailCardId === cardId && UI.commentEditor ? UI.commentEditor.getHtml() : '';
        this.detailCardId = cardId;

        UI.openCardDetail(card, this.currentRole, this.cardDetailCallbacks());
        if (draft) UI.commentEditor.setHtml(draft);

        this.refreshComments(cardId);

        // Handle Add Comment
        const addCommentBtn = document.getElementById('add-comment-btn');
        const submitComment = async () => {
            const editor = UI.commentEditor;
            if (!editor || editor.isEmpty()) return;

            if (this.currentRole === 'VIEWER') {
                alert('You do not have permission to add comments.');
                return;
            }

            addCommentBtn.disabled = true;
            try {
                await ApiClient.addComment(cardId, editor.getHtml());
                editor.clear();
                await this.refreshComments(cardId);
            } catch (error) {
                alert('Failed to add comment: ' + error.message);
            } finally {
                addCommentBtn.disabled = false;
            }
        };
        addCommentBtn.onclick = submitComment;

        // Ctrl/Cmd+Enter submits the comment
        UI.commentEditor.onKeydown((e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                submitComment();
            }
        });

        // Handle Delete Comment
        modal.onclick = async (e) => {
            const deleteBtn = e.target.closest('.delete-comment-btn');
            if (deleteBtn) {
                const commentId = deleteBtn.dataset.commentId;
                if (!confirm('Delete this comment?')) return;
                try {
                    await ApiClient.deleteComment(commentId);
                    await this.refreshComments(cardId);
                } catch (error) {
                    alert('Failed to delete comment: ' + error.message);
                }
            }
        };
    },

    async refreshComments(cardId) {
        const commentsListEl = document.querySelector('.comments-list');
        if (commentsListEl) {
            try {
                const comments = await ApiClient.getComments(cardId);
                UI.renderComments(commentsListEl, comments);
            } catch (error) {
                commentsListEl.innerHTML = `<div class="text-center py-4 text-sm text-red-500">Failed to load comments: ${error.message}</div>`;
            }
        }
    },

    async handleArchiveCard(cardId) {
        if (this.currentRole === 'VIEWER') {
            alert('You do not have permission to archive cards.');
            return;
        }

        try {
            await ApiClient.archiveCard(cardId);
            // Refresh board to remove archived card
            await this.loadBoard(this.currentBoardId);
            UI.closeDetailModal();
        } catch (error) {
            alert('Failed to archive card: ' + error.message);
        }
    },

    async openArchivedCardsModal() {
        if (!this.currentBoardId) return;
        UI.openArchivedModal();
        await this.refreshArchivedCards();
    },

    async refreshArchivedCards() {
        const listEl = document.getElementById('archived-cards-list');
        if (!listEl) return;
        listEl.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400">Loading...</div>';
        try {
            const archivedCards = await ApiClient.getArchivedCards(this.currentBoardId);
            UI.renderArchivedCards(listEl, archivedCards, this.currentRole, (cardId) => this.handleRestoreCard(cardId));
        } catch (error) {
            listEl.innerHTML = `<div class="col-span-full text-center py-12 text-red-500">Failed to load archived cards: ${error.message}</div>`;
        }
    },

    async handleRestoreCard(cardId) {
        if (this.currentRole === 'VIEWER') {
            alert('You do not have permission to restore cards.');
            return;
        }

        try {
            await ApiClient.restoreCard(cardId);
            await this.loadBoard(this.currentBoardId);
            await this.refreshArchivedCards();
        } catch (error) {
            alert('Failed to restore card: ' + error.message);
        }
    },
};
