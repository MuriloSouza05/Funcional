import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { tenantService } from '../services/tenantService';

export class DashboardController {
  async getMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);
      const metrics = await tenantDb.getDashboardMetrics(req.user.accountType);

      // Calculate growth percentages
      const growthMetrics = await this.calculateGrowthMetrics(tenantDb, req.user.accountType);

      res.json({
        metrics: {
          ...metrics,
          ...growthMetrics,
        },
        accountType: req.user.accountType,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Dashboard metrics error:', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard metrics',
        details: error.message,
      });
    }
  }

  async getFinancialData(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Only COMPOSTA and GERENCIAL can access financial data
      if (req.user.accountType === 'SIMPLES') {
        return res.json({
          revenue: 0,
          expenses: 0,
          balance: 0,
          transactions: [],
          charts: [],
          message: 'Financial data not available for this account type',
        });
      }

      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Get financial data for the current month
      const financialData = await tenantDb.query(`
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
          COUNT(*) as transaction_count
        FROM \${schema}.transactions 
        WHERE date >= DATE_TRUNC('month', NOW())
          AND date < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
          AND is_active = true
      `);

      // Get monthly trend data
      const trendData = await tenantDb.query(`
        SELECT 
          DATE_TRUNC('month', date) as month,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
        FROM \${schema}.transactions 
        WHERE date >= DATE_TRUNC('month', NOW() - INTERVAL '6 months')
          AND is_active = true
        GROUP BY DATE_TRUNC('month', date)
        ORDER BY month
      `);

      // Get category breakdown
      const categoryData = await tenantDb.query(`
        SELECT 
          category,
          type,
          SUM(amount) as total,
          COUNT(*) as count
        FROM \${schema}.transactions 
        WHERE date >= DATE_TRUNC('month', NOW())
          AND is_active = true
        GROUP BY category, type
        ORDER BY total DESC
      `);

      const current = financialData[0] || { revenue: 0, expenses: 0, transaction_count: 0 };
      const balance = parseFloat(current.revenue) - parseFloat(current.expenses);

      res.json({
        revenue: parseFloat(current.revenue || 0),
        expenses: parseFloat(current.expenses || 0),
        balance,
        transactionCount: parseInt(current.transaction_count || 0),
        trends: trendData.map(item => ({
          month: item.month,
          revenue: parseFloat(item.revenue || 0),
          expenses: parseFloat(item.expenses || 0),
          balance: parseFloat(item.revenue || 0) - parseFloat(item.expenses || 0),
        })),
        categories: categoryData.map(item => ({
          category: item.category,
          type: item.type,
          total: parseFloat(item.total),
          count: parseInt(item.count),
        })),
      });
    } catch (error) {
      console.error('Financial data error:', error);
      res.status(500).json({
        error: 'Failed to fetch financial data',
        details: error.message,
      });
    }
  }

  async getClientMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Current month clients
      const currentMonthClients = await tenantDb.query(`
        SELECT COUNT(*) as count
        FROM \${schema}.clients 
        WHERE created_at >= DATE_TRUNC('month', NOW())
          AND is_active = true
      `);

      // Previous month clients
      const previousMonthClients = await tenantDb.query(`
        SELECT COUNT(*) as count
        FROM \${schema}.clients 
        WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
          AND created_at < DATE_TRUNC('month', NOW())
          AND is_active = true
      `);

      // Total active clients
      const totalClients = await tenantDb.count('clients', { is_active: true });

      // Client growth calculation
      const currentCount = parseInt(currentMonthClients[0]?.count || 0);
      const previousCount = parseInt(previousMonthClients[0]?.count || 0);
      const growthPercentage = previousCount > 0 
        ? ((currentCount - previousCount) / previousCount) * 100 
        : 0;

      // Clients by status
      const clientsByStatus = await tenantDb.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM \${schema}.clients 
        WHERE is_active = true
        GROUP BY status
      `);

      res.json({
        totalClients,
        newThisMonth: currentCount,
        growthPercentage: Math.round(growthPercentage * 100) / 100,
        byStatus: clientsByStatus.map(item => ({
          status: item.status,
          count: parseInt(item.count),
        })),
      });
    } catch (error) {
      console.error('Client metrics error:', error);
      res.status(500).json({
        error: 'Failed to fetch client metrics',
        details: error.message,
      });
    }
  }

  async getProjectMetrics(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Total projects
      const totalProjects = await tenantDb.count('projects', { is_active: true });

      // Active projects (not won or lost)
      const activeProjects = await tenantDb.query(`
        SELECT COUNT(*) as count
        FROM \${schema}.projects 
        WHERE status NOT IN ('won', 'lost')
          AND is_active = true
      `);

      // Overdue projects
      const overdueProjects = await tenantDb.query(`
        SELECT COUNT(*) as count
        FROM \${schema}.projects 
        WHERE due_date < CURRENT_DATE
          AND status NOT IN ('won', 'lost')
          AND is_active = true
      `);

      // Average progress
      const progressData = await tenantDb.query(`
        SELECT AVG(progress) as avg_progress
        FROM \${schema}.projects 
        WHERE status NOT IN ('won', 'lost')
          AND is_active = true
      `);

      // Revenue from completed projects
      const revenueData = await tenantDb.query(`
        SELECT SUM(budget) as total_revenue
        FROM \${schema}.projects 
        WHERE status = 'won'
          AND completed_at >= DATE_TRUNC('month', NOW())
          AND is_active = true
      `);

      res.json({
        totalProjects,
        activeProjects: parseInt(activeProjects[0]?.count || 0),
        overdueProjects: parseInt(overdueProjects[0]?.count || 0),
        averageProgress: Math.round(parseFloat(progressData[0]?.avg_progress || 0)),
        totalRevenue: parseFloat(revenueData[0]?.total_revenue || 0),
      });
    } catch (error) {
      console.error('Project metrics error:', error);
      res.status(500).json({
        error: 'Failed to fetch project metrics',
        details: error.message,
      });
    }
  }

  private async calculateGrowthMetrics(tenantDb: any, accountType: string) {
    if (accountType === 'SIMPLES') {
      return {
        revenueGrowth: 0,
        expenseGrowth: 0,
        clientGrowth: 0,
      };
    }

    try {
      // Revenue growth
      const revenueGrowth = await tenantDb.query(`
        WITH monthly_revenue AS (
          SELECT 
            DATE_TRUNC('month', date) as month,
            SUM(amount) as revenue
          FROM \${schema}.transactions 
          WHERE type = 'income'
            AND date >= DATE_TRUNC('month', NOW() - INTERVAL '2 months')
            AND is_active = true
          GROUP BY DATE_TRUNC('month', date)
        )
        SELECT 
          LAG(revenue) OVER (ORDER BY month) as previous_revenue,
          revenue as current_revenue
        FROM monthly_revenue
        ORDER BY month DESC
        LIMIT 1
      `);

      // Client growth
      const clientGrowth = await tenantDb.query(`
        WITH monthly_clients AS (
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as new_clients
          FROM \${schema}.clients 
          WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '2 months')
            AND is_active = true
          GROUP BY DATE_TRUNC('month', created_at)
        )
        SELECT 
          LAG(new_clients) OVER (ORDER BY month) as previous_clients,
          new_clients as current_clients
        FROM monthly_clients
        ORDER BY month DESC
        LIMIT 1
      `);

      const revenueData = revenueGrowth[0] || {};
      const clientData = clientGrowth[0] || {};

      const revenueGrowthPercent = revenueData.previous_revenue > 0
        ? ((revenueData.current_revenue - revenueData.previous_revenue) / revenueData.previous_revenue) * 100
        : 0;

      const clientGrowthPercent = clientData.previous_clients > 0
        ? ((clientData.current_clients - clientData.previous_clients) / clientData.previous_clients) * 100
        : 0;

      return {
        revenueGrowth: Math.round(revenueGrowthPercent * 100) / 100,
        clientGrowth: Math.round(clientGrowthPercent * 100) / 100,
      };
    } catch (error) {
      console.error('Growth metrics calculation error:', error);
      return {
        revenueGrowth: 0,
        clientGrowth: 0,
      };
    }
  }
}

export const dashboardController = new DashboardController();