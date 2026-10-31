/**
 * Loads static HTML partials before the application module is imported.
 *
 * Partials may contain nested data-include placeholders. This loader resolves
 * those in subsequent passes, so profile-menu.html can be nested in
 * app-header.html without adding a frontend framework or build step.
 */
export async function loadPartials(root = document) {
    const maxPasses = 10;

    for (let pass = 0; pass < maxPasses; pass += 1) {
        const placeholders = [...root.querySelectorAll('[data-include]')];

        if (placeholders.length === 0) {
            return;
        }

        for (const placeholder of placeholders) {
            const path = placeholder.getAttribute('data-include');

            if (!path) {
                throw new Error('An HTML partial placeholder is missing its data-include path.');
            }

            const response = await fetch(new URL(path, document.baseURI));

            if (!response.ok) {
                throw new Error(`Could not load HTML partial "${path}" (HTTP ${response.status}).`);
            }

            const html = await response.text();
            const template = document.createElement('template');
            template.innerHTML = html;

            if (template.content.childElementCount === 0) {
                throw new Error(`HTML partial "${path}" did not contain an element.`);
            }

            placeholder.replaceWith(template.content);
        }
    }

    if (root.querySelector('[data-include]')) {
        throw new Error('HTML partials exceeded the maximum nesting depth.');
    }
}
