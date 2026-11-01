import { UI } from '../ui.js';
import { escapeHtml } from '../editor.js';

export function updateUserHeader(user, role) {
    if (!user) return;
    this.userName.textContent = user.displayName;
    this.userAvatar.src = user.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURI(user.displayName);
    if (this.menuUserName) this.menuUserName.textContent = user.displayName;
    if (this.menuUserEmail) this.menuUserEmail.textContent = user.email;
    if (this.userRoleBadge) this.userRoleBadge.textContent = role;
}
export function openMembersModal(members, role) {
    this.membersModal.classList.remove('hidden');
    this.membersModal.classList.add('flex');
    this.membersList.innerHTML = members.map(m => {
        const displayName = m.displayName || m.email || 'Kanban user';
        const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`;
        const hasProviderAvatar = typeof m.avatarUrl === 'string'
            && (m.avatarUrl.startsWith('https://') || m.avatarUrl.startsWith('http://'));
        const avatarUrl = hasProviderAvatar ? m.avatarUrl : fallbackAvatarUrl;
        return `
            <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                <div class="flex items-center gap-3">
                    <img src="${escapeHtml(avatarUrl)}" data-fallback-src="${escapeHtml(fallbackAvatarUrl)}"
                        class="w-8 h-8 rounded-full object-cover" alt="${escapeHtml(displayName)}">
                    <div>
                        <div class="text-sm font-bold text-slate-800 dark:text-slate-100">${escapeHtml(displayName)}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(m.email || '')}</div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-400">${escapeHtml(m.role || '')}</span>
                    ${role === 'OWNER' ? `
                        <button class="text-red-500 hover:text-red-700 transition-colors" data-user-id="${escapeHtml(m.userId)}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 1.995 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>` : ''}
                </div>
            </div>`;
    }).join('');
    this.membersList.querySelectorAll('img[data-fallback-src]').forEach(image => {
        image.addEventListener('error', () => {
            const fallbackAvatarUrl = image.dataset.fallbackSrc;
            if (fallbackAvatarUrl) {
                image.removeAttribute('data-fallback-src');
                image.src = fallbackAvatarUrl;
            }
        }, { once: true });
    });
    setTimeout(() => {
        this.membersModal.querySelector('.relative').classList.remove('scale-95', 'opacity-0');
        this.membersModal.querySelector('.relative').classList.add('scale-100', 'opacity-100');
    }, 10);
}
export function closeMembersModal() {
    const modalContent = this.membersModal.querySelector('.relative');
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        this.membersModal.classList.add('hidden');
        this.membersModal.classList.remove('flex');
    }, 200);
}
Object.assign(UI, { updateUserHeader, openMembersModal, closeMembersModal });
