/**
 * Loads static HTML partials before the application module is imported.
 *
 * Partials may contain nested data-include placeholders. Each nesting level is
 * fetched concurrently, then inserted together so nested placeholders are
 * discovered on the next pass.
 */
export async function loadPartials(root = document) {
    const maxPasses = 10;

    for (let pass = 0; pass < maxPasses; pass += 1) {
        const placeholders = [...root.querySelectorAll('[data-include]')];

        if (placeholders.length === 0) {
            return;
        }

        const loadedPartials = await Promise.all(placeholders.map(async (placeholder) => {
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

            return { placeholder, content: template.content };
        }));

        // Insert only after every fetch in this level has succeeded.
        loadedPartials.forEach(({ placeholder, content }) => {
            placeholder.replaceWith(content);
        });
    }

    if (root.querySelector('[data-include]')) {
        throw new Error('HTML partials exceeded the maximum nesting depth.');
    }
}
