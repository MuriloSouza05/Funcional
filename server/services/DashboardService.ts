import { BaseService } from './BaseService';
import { ClientService } from './ClientService';
import { ProjectService } from './ProjectService';
import { TaskService } from './TaskService';
import { CashFlowService } from './CashFlowService';
import { BillingService } from './BillingService';

export class DashboardService extends BaseService {
  
  async getDashboardData() {
    this.requirePermission('read', 'dashboard');

    const clientService = new ClientService(this.user);
    const projectService = new ProjectService(this.user);
    const taskService = new TaskService(this.user);
    const cashFlowService = new CashFlowService(this.user);
    const billingService = new BillingService(this.user);

    // Buscar estatísticas de todos os módulos
    const [
      clientStats,
      projectStats,
      taskStats,
      financialStats,
      billingStats
    ] = await Promise.all([
      clientService.getStats(),
      projectService.getStats(),
      taskService.getStats(),
      cashFlowService.getFinancialStats(),
      billingService.getStats()
    ]);

    // Atividades recentes
    const recentActivities = await this.getRecentActivities();

    return {
      // Métricas principais
      revenue: {
        value: financialStats.monthlyIncome,
        change: financialStats.growth,
        trend: financialStats.growth >= 0 ? 'up' : 'down' as const,
      },
      expenses: {
        value: financialStats.monthlyExpenses,
        change: Math.abs(financialStats.growth), // Inversão para despesas
        trend: financialStats.growth <= 0 ? 'up' : 'down' as const,
      },
      balance: {
        value: financialStats.monthlyBalance,
        change: Math.abs(financialStats.growth),
        trend: financialStats.monthlyBalance >= 0 ? 'up' : 'down' as const,
      },
      clients: {
        value: clientStats.total,
        change: clientStats.growth,
        trend: clientStats.growth >= 0 ? 'up' : 'down' as const,
        period: 'este mês',
      },

      // Estatísticas detalhadas
      stats: {
        clients: clientStats,
        projects: projectStats,
        tasks: taskStats,
        financial: financialStats,
        billing: billingStats
      },

      // Atividades recentes
      recentActivities,

      // Projetos urgentes
      urgentProjects: await this.getUrgentProjects(),

      // Faturas vencendo
      upcomingInvoices: await this.getUpcomingInvoices()
    };
  }

  private async getRecentActivities() {
    const results = await this.query(`
      SELECT 
        id, type, title, message, category, created_at, created_by
      FROM \${schema}.notifications
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    return results.map((activity: any) => ({
      id: activity.id,
      type: activity.category,
      message: activity.message,
      time: this.formatTimeAgo(activity.created_at),
      icon: this.getCategoryIcon(activity.category),
      color: this.getCategoryColor(activity.category),
    }));
  }

  private async getUrgentProjects() {
    const results = await this.query(`
      SELECT title, due_date, status FROM \${schema}.projects
      WHERE due_date <= CURRENT_DATE + INTERVAL '7 days'
      AND status NOT IN ('won', 'lost')
      ORDER BY due_date ASC
      LIMIT 5
    `);

    return results.map((project: any) => ({
      name: project.title,
      deadline: project.due_date,
      status: this.getProjectStatusLabel(project.status)
    }));
  }

  private async getUpcomingInvoices() {
    // Verificar se usuário tem acesso a dados financeiros
    if (this.user.accountType === 'simples') {
      return [];
    }

    const results = await this.query(`
      SELECT numero_fatura, cliente_nome, valor, data_vencimento
      FROM \${schema}.invoices
      WHERE data_vencimento <= CURRENT_DATE + INTERVAL '7 days'
      AND status IN ('nova', 'pendente')
      ORDER BY data_vencimento ASC
      LIMIT 5
    `);

    return results.map((invoice: any) => ({
      number: invoice.numero_fatura,
      client: invoice.cliente_nome,
      amount: parseFloat(invoice.valor),
      dueDate: invoice.data_vencimento
    }));
  }

  private formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Agora mesmo';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutos atrás`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} horas atrás`;
    return `${Math.floor(diffInSeconds / 86400)} dias atrás`;
  }

  private getCategoryIcon(category: string) {
    const icons: { [key: string]: any } = {
      'client': 'Users',
      'project': 'FileText',
      'task': 'CheckSquare',
      'billing': 'DollarSign',
      'cash_flow': 'TrendingUp',
    };
    return icons[category] || 'Bell';
  }

  private getCategoryColor(category: string) {
    const colors: { [key: string]: string } = {
      'client': 'text-blue-600',
      'project': 'text-purple-600',
      'task': 'text-green-600',
      'billing': 'text-yellow-600',
      'cash_flow': 'text-indigo-600',
    };
    return colors[category] || 'text-gray-600';
  }

  private getProjectStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'contacted': 'Em Contato',
      'proposal': 'Com Proposta',
      'won': 'Concluído',
      'lost': 'Perdido'
    };
    return labels[status] || status;
  }
}