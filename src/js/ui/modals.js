import { UI } from '../ui.js';
import { createRichEditor } from '../editor.js';

export function openModal(title, columnId = null) {
    if (!this.descriptionEditor) {
        this.descriptionEditor = createRichEditor(document.getElementById('form-description'), {
            placeholder: 'Add a description...',
        });
    }
    this.modalTitle.textContent = title;
    this.cardModal.classList.remove('hidden');
    this.cardModal.classList.add('flex');
    setTimeout(() => {
        this.cardModal.querySelector('.relative').classList.remove('scale-95', 'opacity-0');
        this.cardModal.querySelector('.relative').classList.add('scale-100', 'opacity-100');
    }, 10);
    this.cardForm.reset();
    this.descriptionEditor.clear();
    document.getElementById('column-id').value = columnId || '';
    document.querySelector('input[name="priority"][value="MEDIUM"]').checked = true;
}
export function closeModal() {
    const modalContent = this.cardModal.querySelector('.relative');
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        this.cardModal.classList.add('hidden');
        this.cardModal.classList.remove('flex');
    }, 200);
}
export function openConfirm() {
    this.confirmModal.classList.remove('hidden');
    this.confirmModal.classList.add('flex');
    setTimeout(() => {
        this.confirmModal.querySelector('.relative').classList.remove('scale-95', 'opacity-0');
        this.confirmModal.querySelector('.relative').classList.add('scale-100', 'opacity-100');
    }, 10);
}
export function closeConfirm() {
    const modalContent = this.confirmModal.querySelector('.relative');
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        this.confirmModal.classList.add('hidden');
        this.confirmModal.classList.remove('flex');
    }, 200);
}
export function openAboutModal() {
    this.aboutModal.classList.remove('hidden');
    this.aboutModal.classList.add('flex');
    setTimeout(() => {
        this.aboutModal.querySelector('.relative').classList.remove('scale-95', 'opacity-0');
        this.aboutModal.querySelector('.relative').classList.add('scale-100', 'opacity-100');
    }, 10);
}
export function closeAboutModal() {
    const modalContent = this.aboutModal.querySelector('.relative');
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        this.aboutModal.classList.add('hidden');
        this.aboutModal.classList.remove('flex');
    }, 200);
}
export function openDeleteColumnModal(columnId, title, hasCards, otherColumns) {
    this.deleteColumnModal.classList.remove('hidden');
    this.deleteColumnModal.classList.add('flex');
    this.deleteColTitle.textContent = `Delete Column: ${title}`;
    this.deleteColMessage.textContent = hasCards
        ? 'This column contains cards. You must transfer them to another column before deleting.'
        : `Are you sure you want to delete the column "${title}"? This action cannot be undone.`;
    this.deleteColTransferSection.classList.toggle('hidden', !hasCards);
    if (hasCards) {
        this.deleteColDestination.replaceChildren();
        otherColumns.forEach(col => {
            const option = document.createElement('option');
            option.value = col.id;
            option.textContent = col.title;
            this.deleteColDestination.appendChild(option);
        });
    }
    setTimeout(() => {
        this.deleteColumnModal.querySelector('.relative').classList.remove('scale-95', 'opacity-0');
        this.deleteColumnModal.querySelector('.relative').classList.add('scale-100', 'opacity-100');
    }, 10);
}
export function closeDeleteColumnModal() {
    const modalContent = this.deleteColumnModal.querySelector('.relative');
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        this.deleteColumnModal.classList.add('hidden');
        this.deleteColumnModal.classList.remove('flex');
    }, 200);
}
export function openArchivedModal() {
    const modal = document.getElementById('archived-cards-modal');
    const content = modal.querySelector('.relative');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}
export function closeArchivedModal() {
    const modal = document.getElementById('archived-cards-modal');
    const content = modal.querySelector('.relative');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
}
Object.assign(UI, {
    openModal, closeModal, openConfirm, closeConfirm, openAboutModal, closeAboutModal,
    openDeleteColumnModal, closeDeleteColumnModal, openArchivedModal, closeArchivedModal,
});
