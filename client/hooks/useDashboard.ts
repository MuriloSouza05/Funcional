import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export function useDashboard() {
const [metrics, setMetrics] = useState(null);
const [financialData, setFinancialData] = useState(null);
const [clientMetrics, setClientMetrics] = useState(null);
const [projectMetrics, setProjectMetrics] = useState(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const loadDashboardData = async () => {
try {
setIsLoading(true);
setError(null);


  const [metricsData, financialResponse, clientsResponse, projectsResponse] = await Promise.all([
    apiService.getDashboardMetrics(),
    apiService.getFinancialData(),
    apiService.getClientMetrics(),
    apiService.getProjectMetrics(),
  ]);

  setMetrics(metricsData.metrics);
  setFinancialData(financialResponse);
  setClientMetrics(clientsResponse);
  setProjectMetrics(projectsResponse);
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
  setError(errorMessage);
  throw err;
} finally {
  setIsLoading(false);
}