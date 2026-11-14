import { loadPartials } from './partial-loader.js?v=20261114-startup-optimization';
import * as Auth from './auth.js';

function markStartup(stage) {
    if (!window.performance?.mark) return;
    const name = `kanban:${stage}`;
    if (performance.getEntriesByName(name, 'mark').length === 0) {
        performance.mark(name);
    }
}

markStartup('bootstrap-start');

document.addEventListener('click', async (event) => {
    const button = event.target.closest?.('#signin-btn');
    if (!button) return;
    event.preventDefault();
    const message = document.getElementById('auth-message');
    if (!message || button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    message.textContent = 'Connecting to the sign-in service…';
    message.classList.remove('hidden');
    try {
        await Auth.startLogin();
    } catch (error) {
        console.error('Could not start sign-in:', error);
        message.textContent = 'Could not start sign-in: ' + error.message;
        button.disabled = false;
        button.removeAttribute('aria-busy');
    }
}, true);

async function bootstrap() {
    try {
        await loadPartials();
        markStartup('partials-loaded');

        // DOM references must be captured only after all HTML partials are present.
        await import('./ui/dom.js');

        // These modules install independent UI methods, so they can be evaluated
        // together. All must finish before the decorators are applied.
        await Promise.all([
            import('./ui/board-view.js'),
            import('./ui/board-cards.js'),
            import('./ui/app-state.js'),
            import('./ui/modals.js'),
            import('./ui/members.js'),
            import('./ui/content-renderers.js'),
            import('./ui/inline-edit.js'),
            import('./ui/card-detail.js'),
        ]);
        markStartup('ui-modules-loaded');

        // Keep decorator order: each layer wraps the implementations installed above.
        await import('./ui-security.js');
        await import('./ui-edit-preservation.js');
        await import('./ui-editor-lifecycle.js');
        markStartup('decorators-loaded');

        await import('./app.js?v=20261114-startup-optimization');
    } catch (error) {
        console.error('Kanban failed to initialize:', error);
        const message = document.createElement('div');
        message.className = 'min-h-screen flex items-center justify-center p-6 bg-slate-50 text-slate-800';
        message.setAttribute('role', 'alert');
        const content = document.createElement('div');
        content.className = 'max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-lg';
        const title = document.createElement('h1');
        title.className = 'text-lg font-bold';
        title.textContent = 'Kanban could not finish loading';
        const description = document.createElement('p');
        description.className = 'mt-2 text-sm text-slate-600';
        description.textContent = 'A page component could not be loaded. Check your connection and refresh the page. If the problem continues, contact the application administrator.';
        const refresh = document.createElement('button');
        refresh.type = 'button';
        refresh.className = 'mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700';
        refresh.textContent = 'Refresh page';
        refresh.addEventListener('click', () => window.location.reload());
        content.append(title, description, refresh);
        message.append(content);
        document.body.replaceChildren(message);
    }
}

bootstrap();
