/**
 * API Service - Centralized API calls
 * Replaces all mock data with real API calls
 */

const API_BASE = '/api';

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem('accessToken');

// Create authenticated fetch
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, try to refresh
      await refreshToken();
      // Retry original request
      const retryResponse = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
          ...options.headers
        }
      });
      if (!retryResponse.ok) {
        throw new Error(`API Error: ${retryResponse.status}`);
      }
      return retryResponse;
    }
    throw new Error(`API Error: ${response.status}`);
  }

  return response;
};

const refreshToken = async () => {
  const refreshTokenValue = localStorage.getItem('refreshToken');
  if (!refreshTokenValue) {
    throw new Error('No refresh token');
  }

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshTokenValue })
  });

  if (response.ok) {
    const data = await response.json();
    localStorage.setItem('accessToken', data.tokens.accessToken);
    localStorage.setItem('refreshToken', data.tokens.refreshToken);
  } else {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }
};

export const apiService = {
  // Dashboard
  async getDashboard() {
    const response = await authFetch('/dashboard');
    return response.json();
  },

  // Clients (CRM)
  async getClients(filters?: any) {
    const query = filters ? `?${new URLSearchParams(filters)}` : '';
    const response = await authFetch(`/clients${query}`);
    return response.json();
  },

  async getClientById(id: string) {
    const response = await authFetch(`/clients/${id}`);
    return response.json();
  },

  async createClient(clientData: any) {
    const response = await authFetch('/clients', {
      method: 'POST',
      body: JSON.stringify(clientData)
    });
    return response.json();
  },

  async updateClient(id: string, clientData: any) {
    const response = await authFetch(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clientData)
    });
    return response.json();
  },

  async deleteClient(id: string) {
    const response = await authFetch(`/clients/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  async getClientStats() {
    const response = await authFetch('/clients/stats');
    return response.json();
  },

  // Projects
  async getProjects(filters?: any) {
    const query = filters ? `?${new URLSearchParams(filters)}` : '';
    const response = await authFetch(`/projects${query}`);
    return response.json();
  },

  async createProject(projectData: any) {
    const response = await authFetch('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
    return response.json();
  },

  async updateProject(id: string, projectData: any) {
    const response = await authFetch(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData)
    });
    return response.json();
  },

  async deleteProject(id: string) {
    const response = await authFetch(`/projects/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  async getProjectStats() {
    const response = await authFetch('/projects/stats');
    return response.json();
  },

  // Tasks
  async getTasks(filters?: any) {
    const query = filters ? `?${new URLSearchParams(filters)}` : '';
    const response = await authFetch(`/tasks${query}`);
    return response.json();
  },

  async createTask(taskData: any) {
    const response = await authFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
    return response.json();
  },

  async updateTask(id: string, taskData: any) {
    const response = await authFetch(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    });
    return response.json();
  },

  async deleteTask(id: string) {
    const response = await authFetch(`/tasks/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  async getTaskStats() {
    const response = await authFetch('/tasks/stats');
    return response.json();
  },

  // Cash Flow
  async getTransactions(filters?: any) {
    const query = filters ? `?${new URLSearchParams(filters)}` : '';
    const response = await authFetch(`/cashflow${query}`);
    return response.json();
  },

  async createTransaction(transactionData: any) {
    const response = await authFetch('/cashflow', {
      method: 'POST',
      body: JSON.stringify(transactionData)
    });
    return response.json();
  },

  async updateTransaction(id: string, transactionData: any) {
    const response = await authFetch(`/cashflow/${id}`, {
      method: 'PUT',
      body: JSON.stringify(transactionData)
    });
    return response.json();
  },

  async deleteTransaction(id: string) {
    const response = await authFetch(`/cashflow/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  async getCashFlowStats() {
    const response = await authFetch('/cashflow/stats');
    return response.json();
  },

  async exportCashFlow(filters?: any) {
    const query = filters ? `?${new URLSearchParams(filters)}` : '';
    const response = await authFetch(`/cashflow/export${query}`);
    return response.blob();
  },

  // Billing
  async getBillingDocuments(filters?: any) {
    const query = filters ? `?${new URLSearchParams(filters)}` : '';
    const response = await authFetch(`/billing${query}`);
    return response.json();
  },

  async createBillingDocument(documentData: any) {
    const response = await authFetch('/billing', {
      method: 'POST',
      body: JSON.stringify(documentData)
    });
    return response.json();
  },

  async updateBillingDocument(id: string, documentData: any) {
    const response = await authFetch(`/billing/${id}`, {
      method: 'PUT',
      body: JSON.stringify(documentData)
    });
    return response.json();
  },

  async deleteBillingDocument(id: string) {
    const response = await authFetch(`/billing/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  async getBillingStats() {
    const response = await authFetch('/billing/stats');
    return response.json();
  },

  // Invoices (Receivables)
  async getInvoices(filters?: any) {
    const query = filters ? `?${new URLSearchParams(filters)}` : '';
    const response = await authFetch(`/invoices${query}`);
    return response.json();
  },

  async createInvoice(invoiceData: any) {
    const response = await authFetch('/invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData)
    });
    return response.json();
  },

  async updateInvoice(id: string, invoiceData: any) {
    const response = await authFetch(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(invoiceData)
    });
    return response.json();
  },

  async deleteInvoice(id: string) {
    const response = await authFetch(`/invoices/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  async getInvoiceDashboard() {
    const response = await authFetch('/invoices/dashboard');
    return response.json();
  },

  async getInvoiceClients() {
    const response = await authFetch('/invoices/clients');
    return response.json();
  },

  // Publications (ISOLADO POR USUÁRIO)
  async getPublications(filters?: any) {
    const query = filters ? `?${new URLSearchParams(filters)}` : '';
    const response = await authFetch(`/publications${query}`);
    return response.json();
  },

  async createPublication(publicationData: any) {
    const response = await authFetch('/publications', {
      method: 'POST',
      body: JSON.stringify(publicationData)
    });
    return response.json();
  },

  async updatePublicationStatus(id: string, status: string, observacoes?: string) {
    const response = await authFetch(`/publications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, observacoes })
    });
    return response.json();
  },

  async deletePublication(id: string) {
    const response = await authFetch(`/publications/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  async getPublicationStats() {
    const response = await authFetch('/publications/stats');
    return response.json();
  },

  // Notifications
  async getNotifications() {
    const response = await authFetch('/notifications');
    return response.json();
  },

  async markNotificationAsRead(id: string) {
    const response = await authFetch(`/notifications/${id}/read`, {
      method: 'PATCH'
    });
    return response.json();
  },

  async markAllNotificationsAsRead() {
    const response = await authFetch('/notifications/mark-all-read', {
      method: 'PATCH'
    });
    return response.json();
  },

  async deleteNotification(id: string) {
    const response = await authFetch(`/notifications/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  },

  async getUnreadNotificationCount() {
    const response = await authFetch('/notifications/unread-count');
    return response.json();
  }
};