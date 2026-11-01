import ApiClient from '../api.js';

// Board JSON import/export workflows.
export const DataTransfer = {
    async exportData(boardId) {
        try {
            const boardData = await ApiClient.exportBoard(boardId);
            const dataStr = JSON.stringify(boardData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const exportFileDefaultName = 'kanban-data.json';

            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        } catch (error) {
            alert('Failed to export data: ' + error.message);
        }
    },

    async importData(boardId, file) {
        try {
            const text = await file.text();
            const importedState = JSON.parse(text);

            if (!importedState.columns || !importedState.cards) {
                throw new Error('Invalid data format');
            }

            const response = await ApiClient.importBoard(boardId, importedState);

            const fullFreshState = await ApiClient.getBoard(boardId);
            this.state = fullFreshState;

            const boardContainer = document.getElementById('boardContainer');
            if (boardContainer) boardContainer.innerHTML = '';

            this.renderAndBind();

            setTimeout(() => {
                alert('Data imported successfully!');
            }, 10);

        } catch (e) {
            console.error('Import error:', e);
            alert('Failed to import data: ' + e.message);
        }
    },
};
