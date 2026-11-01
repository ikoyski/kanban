import ApiClient from '../api.js';
import { UI } from '../ui.js?v=20261101-members-avatar-fix';

// DOM event wiring is kept separate from the application lifecycle.
export const AppEvents = {
    setupEventListeners() {
        // Board Switcher
        UI.boardSwitcher.onchange = async (e) => {
            const newBoardId = e.target.value;
            if (newBoardId && newBoardId !== this.currentBoardId) {
                const params = new URLSearchParams(window.location.search);
                params.set('board', newBoardId);
                history.pushState(null, '', `${window.location.pathname}?${params.toString()}`);
                await this.loadBoard(newBoardId);
            }
        };

        // Board Rename handler
        UI.renameBoardBtn.onclick = async () => {
            if (this.currentRole === 'VIEWER') {
                alert('You do not have permission to rename the board.');
                return;
            }

            const boardNameEl = document.getElementById('board-name');
            // We want to edit the actual name, not the (owned/can edit/view only) suffix
            const currentName = this.currentBoardName;

            await UI.startInlineEdit(boardNameEl, {
                value: currentName,
                onSave: async (newName) => {
                    const trimmedName = newName.trim();
                    if (!trimmedName) throw new Error('Board name cannot be empty');

                    const oldName = this.currentBoardName;
                    // Optimistic update
                    this.currentBoardName = trimmedName;
                    this.state.name = trimmedName;
                    this.renderAndBind();

                    try {
                        await ApiClient.renameBoard(this.currentBoardId, trimmedName);
                    } catch (error) {
                        // Rollback
                        this.currentBoardName = oldName;
                        this.state.name = oldName;
                        this.renderAndBind();
                        throw error;
                    }
                }
            });
        };

        // Create Board
        UI.createBoardBtn.onclick = async () => {

            await this.createBoard();
        };

        // Empty State Create Board Trigger
        window.addEventListener('create-board-trigger', async () => {
            await this.createBoard();
        });

        // Members Modal
        UI.membersMenu.onclick = async (e) => {
            e.stopPropagation();
            try {
                const members = await ApiClient.getMembers(this.currentBoardId);
                UI.openMembersModal(members, this.currentRole);
            } catch (error) {
                alert('Failed to load members: ' + error.message);
            }
            UI.menuDropdown.classList.add('hidden');
        };

        // Handle Member Invitations
        UI.inviteMemberForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = UI.inviteEmail.value;
            const role = UI.inviteRole.value;
            try {
                await ApiClient.addMember(this.currentBoardId, email, role);
                // Refresh members list
                const members = await ApiClient.getMembers(this.currentBoardId);
                UI.openMembersModal(members, this.currentRole);
                UI.inviteEmail.value = '';
            } catch (error) {
                alert('Failed to invite member: ' + error.message);
            }
        };

        // Handle Member Removal
        UI.membersList.onclick = async (e) => {
            const removeBtn = e.target.closest('button[data-user-id]');
            if (removeBtn) {
                const userId = removeBtn.dataset.userId;
                if (!confirm('Are you sure you want to remove this member?')) return;
                try {
                    await ApiClient.removeMember(this.currentBoardId, userId);
                    const members = await ApiClient.getMembers(this.currentBoardId);
                    UI.openMembersModal(members, this.currentRole);
                } catch (error) {
                    alert('Failed to remove member: ' + error.message);
                }
            }
        };

        // Menu Toggle
        UI.menuToggle.onclick = (e) => {
            e.stopPropagation();
            UI.menuDropdown.classList.toggle('hidden');
        };

        // Theme Toggle from Menu
        UI.themeToggleMenu.onclick = (e) => {
            e.stopPropagation();
            if (!this.settings.theme) {
                this.settings.theme = 'light';
            }
            const newTheme = this.settings.theme === 'light' ? 'dark' : 'light';
            this.settings.theme = newTheme;
            UI.setTheme(newTheme);
            localStorage.setItem('kanban-theme', newTheme);
            UI.menuDropdown.classList.add('hidden');
        };

        // About Menu
        UI.aboutMenu.onclick = (e) => {
            e.stopPropagation();
            UI.openAboutModal();
            UI.menuDropdown.classList.add('hidden');
        };

        // Export Menu
        UI.exportMenu.onclick = (e) => {
            e.stopPropagation();
            this.exportData(this.currentBoardId);
            UI.menuDropdown.classList.add('hidden');
        };

        // Import Menu
        UI.importMenu.onclick = (e) => {
            console.log('this.currentBoardId: '+this.currentBoardId);
            e.stopPropagation();
            UI.importFile.click();
            UI.menuDropdown.classList.add('hidden');
        };

        // Import File Change
        UI.importFile.onchange = (e) => {
            console.log('this.currentBoardId: '+this.currentBoardId);
            const file = e.target.files[0];
            if (file) {
                this.importData(this.currentBoardId, file);
            }
            UI.importFile.value = ''; // Reset input
        };

        // Add Column handler
        UI.addColumnMenu.onclick = async (e) => {
            e.stopPropagation();
            const newName = prompt('Enter new column name:');
            if (newName !== null && newName.trim() !== '') {
                try {
                    const newColumn = await ApiClient.createColumn(newName.trim(), this.state.id);
                    this.state.columns[newColumn.id] = newColumn;
                    this.renderAndBind();
                } catch (error) {
                    alert('Failed to create column: ' + error.message);
                }
            }
            UI.menuDropdown.classList.add('hidden');
        };

        // Archived Cards Menu
        document.getElementById('archived-cards-menu').onclick = async (e) => {
            e.stopPropagation();
            UI.menuDropdown.classList.add('hidden');
            await this.openArchivedCardsModal();
        };

        // Close Archived Cards Modal
        document.getElementById('close-archived-modal').onclick = () => UI.closeArchivedModal();

        // Close Archived Cards Modal when clicking outside
        document.getElementById('archived-cards-modal').onclick = (e) => {
            if (e.target.id === 'archived-cards-modal') UI.closeArchivedModal();
        };

        // Logout Handler
        UI.logoutMenu.onclick = (e) => {
            e.stopPropagation();
            this.handleLogout();
        };

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!UI.menuDropdown.contains(e.target) && e.target !== UI.menuToggle) {
                UI.menuDropdown.classList.add('hidden');
            }
        });

        // Close members modal when clicking outside
        UI.membersModal.onclick = (e) => {
            if (e.target === UI.membersModal) {
                UI.closeMembersModal();
            }
        };

        // About Modal Controls
        UI.closeAboutModalBtn.onclick = () => UI.closeAboutModal();
        UI.aboutOkBtn.onclick = () => UI.closeAboutModal();

        // Close members modal via button
        UI.closeMembersModalBtn.onclick = () => UI.closeMembersModal();

        // Modal Controls
        document.getElementById('close-modal').onclick = () => UI.closeModal();
        document.getElementById('cancel-modal').onclick = () => UI.closeModal();

        // Modal Open Event
        window.addEventListener('open-card-modal', (e) => {
            const { columnId } = e.detail;
            UI.openModal('Add New Card', columnId);
        });

        // Form Submit
        UI.cardForm.onsubmit = (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        };

        // Confirm Modal Controls
        document.getElementById('confirm-cancel').onclick = () => UI.closeConfirm();
        document.getElementById('confirm-delete').onclick = () => this.handleDelete();

        // Card Clicks (Delete/Detail). Editing happens inline in the detail modal.
        UI.boardContainer.onclick = (e) => {
            const deleteBtn = e.target.closest('.delete-btn');
            const cardEl = e.target.closest('.card');

            if (deleteBtn && cardEl) {
                const cardId = cardEl.dataset.cardId;
                this.pendingDeleteId = cardId;
                UI.openConfirm(cardId);
            } else if (cardEl) {
                // Open the detail view (all card edits happen there)
                const cardId = cardEl.dataset.cardId;
                this.handleOpenCardDetail(cardId);
            }
        };

        // Search functionality
        document.getElementById('search-input').oninput = (e) => {
            const term = e.target.value.toLowerCase();
            this.filterCards(term);
        };

        // Accessibility: ESC key to close modals
        window.onkeydown = (e) => {
            if (e.key === 'Escape') {
                UI.closeModal();
                UI.closeConfirm();
            }
        };

        // Rename Column handler
        window.addEventListener('rename-column', async (e) => {
            const { columnId } = e.detail;
            const column = this.state.columns[columnId];

            const colEl = document.getElementById(`col-${columnId}`);
            const titleEl = colEl.querySelector('h3');

            await UI.startInlineEdit(titleEl, {
                value: column.title,
                onSave: async (newTitle) => {
                    const trimmedTitle = newTitle.trim();
                    if (!trimmedTitle) throw new Error('Column title cannot be empty');

                    const oldTitle = column.title;
                    this.state.columns[columnId].title = trimmedTitle;
                    this.renderAndBind();

                    try {
                        await ApiClient.renameColumn(columnId, trimmedTitle);
                    } catch (error) {
                        this.state.columns[columnId].title = oldTitle;
                        this.renderAndBind();
                        throw error;
                    }
                }
            });
        });

        // Delete Column handler
        window.addEventListener('delete-column', async (e) => {
            const { columnId } = e.detail;
            const column = this.state.columns[columnId];
            const hasCards = column.cardIds.length > 0;
            const otherColumns = Object.values(this.state.columns).filter(col => col.id !== columnId);

            this.pendingDeleteColId = columnId;
            UI.openDeleteColumnModal(columnId, column.title, hasCards, otherColumns);
        });

        // Confirm Delete Column handler
        UI.deleteColConfirm.onclick = async () => {
            const columnId = this.pendingDeleteColId;
            if (!columnId) return;

            const column = this.state.columns[columnId];
            const destinationId = UI.deleteColDestination.value;

            if (column.cardIds.length > 0) {
                if (!destinationId) {
                    alert('Please select a destination column for the cards.');
                    return;
                }
                const destCol = this.state.columns[destinationId];
                destCol.cardIds.push(...column.cardIds);
            }

            const oldColumns = { ...this.state.columns };
            delete this.state.columns[columnId];

            this.renderAndBind();
            UI.closeDeleteColumnModal();
            this.pendingDeleteColId = null;

            try {
                // Move cards via API if necessary
                if (column.cardIds.length > 0 && destinationId) {
                    await Promise.all(column.cardIds.map((cardId, index) =>
                        ApiClient.moveCard(cardId, destinationId, this.state.columns[destinationId].cardIds.length - 1)
                    ));
                }
                await ApiClient.deleteColumn(columnId);
            } catch (error) {
                this.state.columns = oldColumns;
                this.renderAndBind();
                alert('Failed to delete column: ' + error.message);
            }
        };

        UI.deleteColCancel.onclick = () => {
            UI.closeDeleteColumnModal();
            this.pendingDeleteColId = null;
        };

        UI.closeDeleteColModal.onclick = () => {
            UI.closeDeleteColumnModal();
            this.pendingDeleteColId = null;
        };
    }

    // The person chose to sign out: forget the tokens and end the auth server's session too.
};
