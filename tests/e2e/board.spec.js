import { test, expect } from '@playwright/test';
import { installCdnStubs, mockKanbanApi } from './helpers.js';

test.describe('authenticated board workflows', () => {
    let api;

    test.beforeEach(async ({ page }) => {
        await installCdnStubs(page);
        api = await mockKanbanApi(page);
        await page.goto('/kanban.html');
        await expect(page.locator('#app-board-view')).toBeVisible();
        await expect(page.locator('#board-name')).toContainText('Demo Board');
    });

    test('resolves all HTML partials before rendering the authenticated board', async ({ page }) => {
        await expect(page.locator('#app-auth-view')).toBeHidden();
        await expect(page.locator('#board-container .card')).toHaveCount(1);
        await expect(page.locator('[data-include]')).toHaveCount(0);
        await expect(page.locator('#profile-trigger')).toBeAttached();
        await expect(page.locator('#card-detail-modal')).toBeAttached();
    });

    test('searches cards and opens the card detail modal', async ({ page }) => {
        await page.locator('#search-input').fill('not a matching task');
        await expect(page.locator('.card[data-card-id="sample-card"]')).toBeHidden();

        await page.locator('#search-input').fill('sample task');
        await expect(page.locator('.card[data-card-id="sample-card"]')).toBeVisible();

        await page.locator('.card[data-card-id="sample-card"]').click();
        await expect(page.locator('#card-detail-modal')).toBeVisible();
        await expect(page.locator('#card-detail-body')).toContainText('Card Details');
        await expect(page.locator('#card-detail-body .detail-title')).toHaveText('Sample task');
    });

    test('updates card title and priority from the detail modal', async ({ page }) => {
        await page.locator('.card[data-card-id="sample-card"]').click();
        await expect(page.locator('#card-detail-modal')).toBeVisible();

        await page.locator('.detail-title').click();
        await page.locator('.detail-title .inline-edit-input').fill('Updated regression task');
        await page.locator('.detail-title button').first().click();
        await expect(page.locator('.detail-title')).toHaveText('Updated regression task');

        await page.locator('.detail-priority [data-priority="HIGH"]').click();
        await expect(page.locator('.detail-priority [data-priority="HIGH"]')).toHaveClass(/bg-red-100/);

        const updates = api.calls.filter(
            call => call.method === 'PATCH' && call.path === '/v1/cards/sample-card'
        );
        expect(updates).toEqual(expect.arrayContaining([
            expect.objectContaining({ body: { title: 'Updated regression task' } }),
            expect.objectContaining({ body: { priority: 'HIGH' } }),
        ]));
    });

    test('adds a comment to a card and refreshes the comment list', async ({ page }) => {
        await page.locator('.card[data-card-id="sample-card"]').click();
        await expect(page.locator('.comments-list')).toContainText('No comments yet');

        await page.locator('#comment-editor [contenteditable="true"]').fill('A regression comment');
        await page.locator('#add-comment-btn').click();

        await expect(page.locator('.comments-list')).toContainText('A regression comment');
        const commentCall = api.calls.find(
            call => call.method === 'POST' && call.path === '/v1/comments/card/sample-card'
        );
        expect(commentCall).toBeTruthy();
        expect(commentCall.body).toMatchObject({ content: 'A regression comment' });
    });

    test('moves a card between columns and persists the destination', async ({ page }) => {
        await page.evaluate(async () => {
            const source = document.querySelector('.card-list[data-column-id="todo"]');
            const destination = document.querySelector('.card-list[data-column-id="doing"]');
            const card = source.querySelector('[data-card-id="sample-card"]');

            // Trigger the same SortableJS onEnd callback used after a browser drag.
            destination.appendChild(card);
            await source.__playwrightSortable.onEnd({
                oldIndex: 0,
                newIndex: 0,
                from: source,
                to: destination,
                item: card,
            });
        });

        await expect(page.locator('#col-doing .card[data-card-id="sample-card"]')).toBeVisible();
        const moveCall = api.calls.find(
            call => call.method === 'PATCH' && call.path === '/v1/cards/sample-card/move'
        );
        expect(moveCall).toBeTruthy();
        expect(moveCall.body).toMatchObject({ columnId: 'doing', position: 0 });
    });

    test('archives a card and restores it from the archived cards modal', async ({ page }) => {
        await page.locator('.card[data-card-id="sample-card"]').click();
        await page.locator('#archive-card-btn').click();
        await expect(page.locator('.card[data-card-id="sample-card"]')).toHaveCount(0);

        await page.locator('#profile-trigger').click();
        await page.locator('#archived-cards-menu').click();
        await expect(page.locator('#archived-cards-modal')).toBeVisible();
        await expect(page.locator('#archived-cards-list')).toContainText('Sample task');

        await page.locator('.restore-card-btn[data-card-id="sample-card"]').click();
        await expect(page.locator('#col-todo .card[data-card-id="sample-card"]')).toBeVisible();
        await expect(page.locator('#archived-cards-list')).toContainText('No archived cards found.');

        expect(api.calls.some(call =>
            call.method === 'POST' && call.path === '/v1/cards/sample-card/archive'
        )).toBeTruthy();
        expect(api.calls.some(call =>
            call.method === 'POST' && call.path === '/v1/cards/sample-card/restore'
        )).toBeTruthy();
    });

    test('creates a card and sends the expected payload to the API', async ({ page }) => {
        await page.locator('#col-todo .add-card-btn').click();
        await expect(page.locator('#card-modal')).toBeVisible();

        await page.locator('#form-title').fill('Regression test card');
        await page.locator('#form-labels').fill('UI, Regression');
        await page.locator('label').filter({
            has: page.locator('input[name="priority"][value="HIGH"]'),
        }).click();
        await page.locator('#card-form button[type="submit"]').click();

        await expect(page.locator('.card', { hasText: 'Regression test card' })).toBeVisible();
        const createCall = api.calls.find(call => call.method === 'POST' && call.path === '/v1/cards');
        expect(createCall).toBeTruthy();
        expect(createCall.body).toMatchObject({
            title: 'Regression test card',
            priority: 'HIGH',
            labels: ['UI', 'Regression'],
            columnId: 'todo',
        });
    });

    test('deletes a card only after confirmation', async ({ page }) => {
        const card = page.locator('.card[data-card-id="sample-card"]');
        await card.locator('.delete-btn').click();
        await expect(page.locator('#confirm-modal')).toBeVisible();
        await expect(card).toBeVisible();

        await page.locator('#confirm-delete').click();

        await expect(page.locator('.card[data-card-id="sample-card"]')).toHaveCount(0);
        expect(api.calls.some(call => call.method === 'DELETE' && call.path === '/v1/cards/sample-card')).toBeTruthy();
    });

    test('switches between boards', async ({ page }) => {
        await page.locator('#profile-trigger').click();
        await page.locator('#board-switcher').selectOption('second-board');
        await expect(page.locator('#board-name')).toContainText('Second Board');
        await expect(page.locator('.card')).toHaveAttribute('data-card-id', 'sample-card-second-board');
        expect(api.calls.some(call => call.method === 'GET' && call.path === '/v1/boards/second-board')).toBeTruthy();
    });

    test('toggles dark mode from the profile menu', async ({ page }) => {
        await page.locator('#profile-trigger').click();
        await page.locator('#theme-toggle-menu').click();
        await expect(page.locator('html')).toHaveClass(/dark/);
        await expect(page.locator('#menu-dropdown')).toBeHidden();
    });
});
