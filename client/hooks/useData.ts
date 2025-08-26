import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export const useClients = (filters?: any) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await apiService.getClients(filters);
      setClients(data);
    } catch (err) {
      setError(err as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [JSON.stringify(filters)]);

  return { 
    clients, 
    loading, 
    error, 
    refetch: fetchClients,
    createClient: async (clientData: any) => {
      const result = await apiService.createClient(clientData);
      await fetchClients();
      return result;
    },
    updateClient: async (id: string, clientData: any) => {
      const result = await apiService.updateClient(id, clientData);
      await fetchClients();
      return result;
    },
    deleteClient: async (id: string) => {
      const result = await apiService.deleteClient(id);
      await fetchClients();
      return result;
    }
  };
};

export const useProjects = (filters?: any) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await apiService.getProjects(filters);
      setProjects(data);
    } catch (err) {
      setError(err as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [JSON.stringify(filters)]);

  return { 
    projects, 
    loading, 
    error, 
    refetch: fetchProjects,
    createProject: async (projectData: any) => {
      const result = await apiService.createProject(projectData);
      await fetchProjects();
      return result;
    },
    updateProject: async (id: string, projectData: any) => {
      const result = await apiService.updateProject(id, projectData);
      await fetchProjects();
      return result;
    },
    deleteProject: async (id: string) => {
      const result = await apiService.deleteProject(id);
      await fetchProjects();
      return result;
    }
  };
};

export const useTasks = (filters?: any) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTasks(filters);
      setTasks(data);
    } catch (err) {
      setError(err as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [JSON.stringify(filters)]);

  return { 
    tasks, 
    loading, 
    error, 
    refetch: fetchTasks,
    createTask: async (taskData: any) => {
      const result = await apiService.createTask(taskData);
      await fetchTasks();
      return result;
    },
    updateTask: async (id: string, taskData: any) => {
      const result = await apiService.updateTask(id, taskData);
      await fetchTasks();
      return result;
    },
    deleteTask: async (id: string) => {
      const result = await apiService.deleteTask(id);
      await fetchTasks();
      return result;
    }
  };
};

export const useCashFlow = (filters?: any) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTransactions(filters);
      setTransactions(data);
    } catch (err) {
      setError(err as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [JSON.stringify(filters)]);

  return { 
    transactions, 
    loading, 
    error, 
    refetch: fetchTransactions,
    createTransaction: async (transactionData: any) => {
      const result = await apiService.createTransaction(transactionData);
      await fetchTransactions();
      return result;
    },
    updateTransaction: async (id: string, transactionData: any) => {
      const result = await apiService.updateTransaction(id, transactionData);
      await fetchTransactions();
      return result;
    },
    deleteTransaction: async (id: string) => {
      const result = await apiService.deleteTransaction(id);
      await fetchTransactions();
      return result;
    }
  };
};

export const useBilling = (filters?: any) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await apiService.getBillingDocuments(filters);
      setDocuments(data);
    } catch (err) {
      setError(err as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [JSON.stringify(filters)]);

  return { 
    documents, 
    loading, 
    error, 
    refetch: fetchDocuments,
    createDocument: async (documentData: any) => {
      const result = await apiService.createBillingDocument(documentData);
      await fetchDocuments();
      return result;
    },
    updateDocument: async (id: string, documentData: any) => {
      const result = await apiService.updateBillingDocument(id, documentData);
      await fetchDocuments();
      return result;
    },
    deleteDocument: async (id: string) => {
      const result = await apiService.deleteBillingDocument(id);
      await fetchDocuments();
      return result;
    }
  };
};

export const useInvoices = (filters?: any) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await apiService.getInvoices(filters);
      setInvoices(data);
    } catch (err) {
      setError(err as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [JSON.stringify(filters)]);

  return { 
    invoices, 
    loading, 
    error, 
    refetch: fetchInvoices,
    createInvoice: async (invoiceData: any) => {
      const result = await apiService.createInvoice(invoiceData);
      await fetchInvoices();
      return result;
    },
    updateInvoice: async (id: string, invoiceData: any) => {
      const result = await apiService.updateInvoice(id, invoiceData);
      await fetchInvoices();
      return result;
    },
    deleteInvoice: async (id: string) => {
      const result = await apiService.deleteInvoice(id);
      await fetchInvoices();
      return result;
    }
  };
};

export const usePublications = (filters?: any) => {
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPublications = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPublications(filters);
      setPublications(data);
    } catch (err) {
      setError(err as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublications();
  }, [JSON.stringify(filters)]);

  return { 
    publications, 
    loading, 
    error, 
    refetch: fetchPublications,
    createPublication: async (publicationData: any) => {
      const result = await apiService.createPublication(publicationData);
      await fetchPublications();
      return result;
    },
    updatePublicationStatus: async (id: string, status: string, observacoes?: string) => {
      const result = await apiService.updatePublicationStatus(id, status, observacoes);
      await fetchPublications();
      return result;
    },
    deletePublication: async (id: string) => {
      const result = await apiService.deletePublication(id);
      await fetchPublications();
      return result;
    }
  };
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await apiService.getNotifications();
      setNotifications(data);
    } catch (err) {
      setError(err as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return { 
    notifications, 
    loading, 
    error, 
    refetch: fetchNotifications,
    markAsRead: async (id: string) => {
      await apiService.markNotificationAsRead(id);
      await fetchNotifications();
    },
    markAllAsRead: async () => {
      await apiService.markAllNotificationsAsRead();
      await fetchNotifications();
    },
    deleteNotification: async (id: string) => {
      await apiService.deleteNotification(id);
      await fetchNotifications();
    }
  };
};

export const useDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await apiService.getDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return { 
    dashboard, 
    loading, 
    error, 
    refetch: fetchDashboard
  };
};