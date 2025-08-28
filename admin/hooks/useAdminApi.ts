import { useState } from 'react';

class AdminApiService {
  private baseUrl = '/api/admin';

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('admin_access_token');
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  }

  // Global Metrics
  async getGlobalMetrics() {
    return this.request('/metrics');
  }

  // Tenant Management
  async getTenants() {
    const response = await this.request('/tenants');
    return response.tenants;
  }

  async createTenant(tenantData: any) {
    return this.request('/tenants', {
      method: 'POST',
      body: JSON.stringify(tenantData),
    });
  }

  async deleteTenant(tenantId: string) {
    return this.request(`/tenants/${tenantId}`, {
      method: 'DELETE',
    });
  }

  // Registration Keys
  async getRegistrationKeys(tenantId?: string) {
    const params = tenantId ? `?tenantId=${tenantId}` : '';
    const response = await this.request(`/keys${params}`);
    return response.keys;
  }

  async createRegistrationKey(keyData: any) {
    return this.request('/keys', {
      method: 'POST',
      body: JSON.stringify(keyData),
    });
  }

  async revokeRegistrationKey(keyId: string) {
    return this.request(`/keys/${keyId}/revoke`, {
      method: 'PATCH',
    });
  }

  // Tenant Settings
  async getTenantSettings(tenantId: string) {
    return this.request(`/tenants/${tenantId}/settings`);
  }

  async updateTenantSettings(tenantId: string, settings: any) {
    return this.request(`/tenants/${tenantId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Usage Monitoring
  async getTenantUsage(tenantId: string, period: string = '30d') {
    return this.request(`/tenants/${tenantId}/usage?period=${period}`);
  }

  // System Logs
  async getSystemLogs(filters: any = {}) {
    const params = new URLSearchParams(filters).toString();
    const response = await this.request(`/logs?${params}`);
    return response.logs;
  }
}

const adminApiService = new AdminApiService();

export function useAdminApi() {
  const [isLoading, setIsLoading] = useState(false);

  const withLoading = async <T>(operation: () => Promise<T>): Promise<T> => {
    setIsLoading(true);
    try {
      return await operation();
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    
    // Global Metrics
    getGlobalMetrics: () => withLoading(() => adminApiService.getGlobalMetrics()),

    // Tenant Management
    getTenants: () => withLoading(() => adminApiService.getTenants()),
    createTenant: (data: any) => withLoading(() => adminApiService.createTenant(data)),
    deleteTenant: (id: string) => withLoading(() => adminApiService.deleteTenant(id)),

    // Registration Keys
    getRegistrationKeys: (tenantId?: string) => withLoading(() => adminApiService.getRegistrationKeys(tenantId)),
    createRegistrationKey: (data: any) => withLoading(() => adminApiService.createRegistrationKey(data)),
    revokeRegistrationKey: (id: string) => withLoading(() => adminApiService.revokeRegistrationKey(id)),

    // Tenant Settings
    getTenantSettings: (tenantId: string) => withLoading(() => adminApiService.getTenantSettings(tenantId)),
    updateTenantSettings: (tenantId: string, settings: any) => withLoading(() => adminApiService.updateTenantSettings(tenantId, settings)),

    // Usage Monitoring
    getTenantUsage: (tenantId: string, period?: string) => withLoading(() => adminApiService.getTenantUsage(tenantId, period)),

    // System Logs
    getSystemLogs: (filters?: any) => withLoading(() => adminApiService.getSystemLogs(filters)),
  };
}