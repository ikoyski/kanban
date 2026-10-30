import { getAccessToken } from './auth.js';

const BASE_URL = 'https://api.ikoyski.top/kanban-backend';

class ApiClient {
  static async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const token = getAccessToken();
    if (!token) {
      // No token, or it has expired: nothing to send. The app shows the sign-in screen.
      window.dispatchEvent(new CustomEvent('auth-expired'));
      throw new Error('Not signed in');
    }
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('auth-expired'));
      }

      if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
              if (errorText) {
                  const errorData = JSON.parse(errorText);
                  // Validation errors are shaped like { field: "message" } with no top-level "message".
                  const fieldErrors = Object.values(errorData).filter(v => typeof v === 'string').join(' ');
                  errorMessage = errorData.message || fieldErrors || errorMessage;
              }
          } catch (e) {
              // Fallback if error body isn't JSON
          }
          throw new Error(errorMessage);
      }

      const responseText = await response.text();
      return responseText ? JSON.parse(responseText) : null;

    } catch (error) {
      console.error(`API Request failed: ${endpoint}`, error);
      throw error;
    }
  }

  static async getMe() {
    return this.request('/v1/users/me');
  }

  static async getBoards() {
    return this.request('/v1/boards');
  }

  static async getBoard(boardId) {
    return this.request(`/v1/boards/${boardId}`);
  }

  static async createBoard(name) {
    return this.request('/v1/boards', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  static async renameBoard(boardId, name) {
    return this.request(`/v1/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }

  static async deleteBoard(boardId) {
    return this.request(`/v1/boards/${boardId}`, {
      method: 'DELETE',
    });
  }

  static async createColumn(title, boardId) {
    return this.request('/v1/columns', {
      method: 'POST',
      body: JSON.stringify({
        title,
        boardId
      }),
    });
  }

  static async renameColumn(id, title) {
    return this.request(`/v1/columns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  }

  static async deleteColumn(id) {
    return this.request(`/v1/columns/${id}`, {
      method: 'DELETE',
    });
  }

  static async createCard(columnId, cardData) {
    return this.request('/v1/cards', {
      method: 'POST',
      body: JSON.stringify({ ...cardData, columnId }),
    });
  }

  static async updateCard(id, cardData) {
    return this.request(`/v1/cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(cardData),
    });
  }

  static async deleteCard(id) {
    return this.request(`/v1/cards/${id}`, {
      method: 'DELETE',
    });
  }

  static async reorderColumns(columnPositions) {
    return this.request('/v1/columns/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ columns: columnPositions }),
    });
  }

  static async moveCard(cardId, columnId, position) {
    return this.request(`/v1/cards/${cardId}/move`, {
      method: 'PATCH',
      body: JSON.stringify({
        columnId,
        position
      }),
    });
  }

  static async exportBoard(boardId) {
    return this.request(`/v1/boards/${boardId}/export`);
  }

  static async importBoard(boardId, boardData) {
    return this.request(`/v1/boards/${boardId}/import`, {
      method: 'PUT',
      body: JSON.stringify(boardData),
    });
  }

  static async getMembers(boardId) {
    return this.request(`/v1/boards/${boardId}/members`);
  }

  static async addMember(boardId, email, role) {
    return this.request(`/v1/boards/${boardId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  static async updateMemberRole(boardId, userId, role) {
    return this.request(`/v1/boards/${boardId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  static async removeMember(boardId, userId) {
    return this.request(`/v1/boards/${boardId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  // Card Comments
  static async getComments(cardId) {
    return this.request(`/v1/comments/card/${cardId}`);
  }

  static async addComment(cardId, content) {
    return this.request(`/v1/comments/card/${cardId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  static async deleteComment(commentId) {
    return this.request(`/v1/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // Card Archive
  static async archiveCard(cardId) {
    return this.request(`/v1/cards/${cardId}/archive`, {
      method: 'POST',
    });
  }

  static async restoreCard(cardId) {
    return this.request(`/v1/cards/${cardId}/restore`, {
      method: 'POST',
    });
  }

  static async getArchivedCards(boardId) {
    return this.request(`/v1/cards/board/${boardId}/archived`);
  }
}

export default ApiClient;
