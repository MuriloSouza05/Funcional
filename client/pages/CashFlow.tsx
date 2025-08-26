/**
 * PÁGINA DE FLUXO DE CAIXA - Sistema Completo
 * ===========================================
 * 
 * Sistema completo de controle financeiro para escritórios de advocacia.
 * MOCK DATA REMOVIDO - Agora usa dados reais do backend via API.
 */

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Filter,
  DollarSign,
  Download,
  Upload,
  BarChart3,
  Calendar,
  Repeat,
  Copy
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TransactionForm } from '@/components/CashFlow/TransactionForm';
import { TransactionsTable } from '@/components/CashFlow/TransactionsTable';
import { TransactionViewDialog } from '@/components/CashFlow/TransactionViewDialog';
import { Transaction, CashFlowStats } from '@/types/cashflow';
import { useCashFlow } from '@/hooks/useData';
import { apiService } from '@/services/api';

export function CashFlow() {
  const [activeTab, setActiveTab] = useState('transactions');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showTransactionView, setShowTransactionView] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>();
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [forceRecurring, setForceRecurring] = useState(false);

  // Real API data instead of mock data
  const { 
    transactions, 
    loading: transactionsLoading, 
    error: transactionsError,
    createTransaction,
    updateTransaction,
    deleteTransaction 
  } = useCashFlow({ 
    search: searchTerm,
    type: typeFilter === 'all' ? undefined : typeFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    status: statusFilter === 'all' ? undefined : statusFilter
  });

  const [stats, setStats] = useState<CashFlowStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Load financial stats
  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await apiService.getCashFlowStats();
        setStats(data);
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, [transactions]);

  const handleSubmitTransaction = async (data: any) => {
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, data);
        setEditingTransaction(undefined);
      } else {
        await createTransaction(data);
      }
      setShowTransactionForm(false);
      setForceRecurring(false);
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      alert('Erro ao salvar transação. Tente novamente.');
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      await deleteTransaction(transactionId);
      setSelectedTransactions(selectedTransactions.filter(id => id !== transactionId));
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      alert('Erro ao excluir transação. Tente novamente.');
    }
  };

  const handleDuplicateTransaction = async (transaction: Transaction) => {
    try {
      await createTransaction({
        ...transaction,
        id: undefined,
        description: `${transaction.description} (Cópia)`,
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Erro ao duplicar transação:', error);
      alert('Erro ao duplicar transação. Tente novamente.');
    }
  };

  const handleViewTransaction = (transaction: Transaction) => {
    setViewingTransaction(transaction);
    setShowTransactionView(true);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowTransactionForm(true);
  };

  const handleEditFromView = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowTransactionView(false);
    setShowTransactionForm(true);
  };

  const handleSelectTransaction = (transactionId: string) => {
    setSelectedTransactions(prev =>
      prev.includes(transactionId)
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const handleSelectAllTransactions = (checked: boolean) => {
    setSelectedTransactions(
      checked ? transactions.map((transaction) => transaction.id) : []
    );
  };

  const handleExportCSV = async () => {
    try {
      const csvBlob = await apiService.exportCashFlow({ 
        type: typeFilter === 'all' ? undefined : typeFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        status: statusFilter === 'all' ? undefined : statusFilter
      });

      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fluxo_caixa_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar CSV:', error);
      alert('Erro ao exportar relatório. Tente novamente.');
    }
  };

  const handleCreateRecurring = () => {
    setForceRecurring(true);
    setEditingTransaction(undefined);
    setShowTransactionForm(true);
  };

  // Get unique assignees for filter
  const assignees = [...new Set(transactions.map(t => t.created_by).filter(Boolean))];

  // Loading state
  if (transactionsLoading || statsLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (transactionsError) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Erro ao carregar fluxo de caixa</h1>
            <p className="text-muted-foreground">Tente recarregar a página</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Fluxo de Caixa</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fluxo de Caixa</h1>
            <p className="text-muted-foreground">
              Controle completo das finanças do escritório
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="outline" onClick={handleCreateRecurring}>
              <Repeat className="h-4 w-4 mr-2" />
              Criar Recorrente
            </Button>
            <Button onClick={() => setShowTransactionForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Transação
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Receitas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.totalIncome || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Todas as receitas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.totalExpenses || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Todas as despesas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(stats?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.balance || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Receitas - Despesas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(stats?.monthlyBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.monthlyBalance || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.growth && stats.growth > 0 ? '+' : ''}{stats?.growth || 0}% vs mês anterior
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar transações..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="income">Receitas</SelectItem>
              <SelectItem value="expense">Despesas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Transações ({transactions?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionsTable
              transactions={transactions || []}
              selectedTransactions={selectedTransactions}
              onSelectTransaction={handleSelectTransaction}
              onSelectAll={handleSelectAllTransactions}
              onViewTransaction={handleViewTransaction}
              onEditTransaction={handleEditTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onDuplicateTransaction={handleDuplicateTransaction}
            />
          </CardContent>
        </Card>

        {/* Transaction Form Modal */}
        <TransactionForm
          open={showTransactionForm}
          onOpenChange={setShowTransactionForm}
          transaction={editingTransaction}
          onSubmit={handleSubmitTransaction}
          isEditing={!!editingTransaction}
          forceRecurring={forceRecurring}
        />

        {/* Transaction View Dialog */}
        <TransactionViewDialog
          open={showTransactionView}
          onOpenChange={setShowTransactionView}
          transaction={viewingTransaction}
          onEdit={handleEditFromView}
          onDuplicate={handleDuplicateTransaction}
        />
      </div>
    </DashboardLayout>
  );
}