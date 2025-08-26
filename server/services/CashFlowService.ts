import { BaseService } from './BaseService';
import { Transaction } from '../types/database';

export class CashFlowService extends BaseService {
  
  async getAll(filters?: any): Promise<Transaction[]> {
    this.requirePermission('read', 'cash_flow');

    let sql = `
      SELECT * FROM \${schema}.cash_flow 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.search) {
      sql += ` AND description ILIKE $${params.length + 1}`;
      params.push(`%${filters.search}%`);
    }

    if (filters?.type) {
      sql += ` AND type = $${params.length + 1}`;
      params.push(filters.type);
    }

    if (filters?.category) {
      sql += ` AND category_id = $${params.length + 1}`;
      params.push(filters.category);
    }

    if (filters?.status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters?.date_start) {
      sql += ` AND date >= $${params.length + 1}`;
      params.push(filters.date_start);
    }

    if (filters?.date_end) {
      sql += ` AND date <= $${params.length + 1}`;
      params.push(filters.date_end);
    }

    sql += ` ORDER BY date DESC, created_at DESC`;

    return await this.query(sql, params);
  }

  async getById(id: string): Promise<Transaction> {
    this.requirePermission('read', 'cash_flow');

    const results = await this.query(`
      SELECT * FROM \${schema}.cash_flow WHERE id = $1
    `, [id]);

    if (!results || results.length === 0) {
      throw new Error('Transação não encontrada');
    }

    return results[0];
  }

  async create(transactionData: Partial<Transaction>): Promise<Transaction> {
    this.requirePermission('write', 'cash_flow');

    const {
      type, amount, category_id, description, date, payment_method,
      status, tags, project_id, client_id, is_recurring,
      recurring_frequency, notes
    } = transactionData;

    // Buscar nome da categoria
    const categoryName = this.getCategoryName(category_id || '');

    // Se tem project_id, buscar dados do projeto
    let projectTitle = null;
    let clientName = null;

    if (project_id && project_id !== 'none') {
      const projectResults = await this.query(`
        SELECT p.title, c.name as client_name 
        FROM \${schema}.projects p
        LEFT JOIN \${schema}.clients c ON p.client_id = c.id
        WHERE p.id = $1
      `, [project_id]);
      
      if (projectResults.length > 0) {
        projectTitle = projectResults[0].title;
        clientName = projectResults[0].client_name;
      }
    }

    const results = await this.query(`
      INSERT INTO \${schema}.cash_flow (
        type, amount, category_id, category_name, description, date,
        payment_method, status, tags, project_id, project_title,
        client_id, client_name, is_recurring, recurring_frequency,
        notes, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        NOW(), NOW()
      ) RETURNING *
    `, [
      type, amount, category_id, categoryName, description, date,
      payment_method, status || 'confirmed', JSON.stringify(tags || []),
      project_id === 'none' ? null : project_id, projectTitle,
      client_id === 'none' ? null : client_id, clientName,
      is_recurring || false, recurring_frequency, notes, this.user.name
    ]);

    const transaction = results[0];

    await this.auditLog('cash_flow', 'CREATE', transaction.id, null, transaction);

    await this.createNotification(
      'info',
      `Nova ${type === 'income' ? 'Receita' : 'Despesa'} Registrada`,
      `${this.user.name} registrou: ${description}`,
      'cash_flow',
      'transaction',
      transaction.id,
      { transaction_id: transaction.id, page: '/fluxo-caixa' }
    );

    return transaction;
  }

  async update(id: string, transactionData: Partial<Transaction>): Promise<Transaction> {
    this.requirePermission('write', 'cash_flow');

    const oldTransaction = await this.getById(id);

    const {
      type, amount, category_id, description, date, payment_method,
      status, tags, project_id, client_id, is_recurring,
      recurring_frequency, notes
    } = transactionData;

    const categoryName = this.getCategoryName(category_id || '');

    const results = await this.query(`
      UPDATE \${schema}.cash_flow SET
        type = COALESCE($1, type),
        amount = COALESCE($2, amount),
        category_id = COALESCE($3, category_id),
        category_name = COALESCE($4, category_name),
        description = COALESCE($5, description),
        date = COALESCE($6, date),
        payment_method = COALESCE($7, payment_method),
        status = COALESCE($8, status),
        tags = COALESCE($9, tags),
        project_id = COALESCE($10, project_id),
        client_id = COALESCE($11, client_id),
        is_recurring = COALESCE($12, is_recurring),
        recurring_frequency = COALESCE($13, recurring_frequency),
        notes = COALESCE($14, notes),
        updated_at = NOW()
      WHERE id = $15
      RETURNING *
    `, [
      type, amount, category_id, categoryName, description, date,
      payment_method, status, JSON.stringify(tags), 
      project_id === 'none' ? null : project_id,
      client_id === 'none' ? null : client_id,
      is_recurring, recurring_frequency, notes, id
    ]);

    const transaction = results[0];

    await this.auditLog('cash_flow', 'UPDATE', id, oldTransaction, transaction);

    return transaction;
  }

  async delete(id: string): Promise<void> {
    this.requirePermission('write', 'cash_flow');

    const transaction = await this.getById(id);

    await this.query(`DELETE FROM \${schema}.cash_flow WHERE id = $1`, [id]);

    await this.auditLog('cash_flow', 'DELETE', id, transaction, null);
  }

  async getFinancialStats() {
    // Apenas Conta Composta e Gerencial têm acesso aos dados financeiros
    this.requirePermission('read', 'cash_flow');
    
    if (this.user.accountType === 'simples') {
      // Conta Simples sempre recebe zeros nos dados financeiros
      return {
        totalIncome: 0,
        totalExpenses: 0,
        balance: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
        monthlyBalance: 0,
        growth: 0
      };
    }

    const [totals, monthly, growth] = await Promise.all([
      this.query(`
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses
        FROM \${schema}.cash_flow
      `),
      this.query(`
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as monthly_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as monthly_expenses
        FROM \${schema}.cash_flow
        WHERE date >= DATE_TRUNC('month', NOW())
        AND date < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
      `),
      this.query(`
        WITH monthly_data AS (
          SELECT
            DATE_TRUNC('month', date) as month,
            SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance
          FROM \${schema}.cash_flow
          WHERE date >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
          GROUP BY DATE_TRUNC('month', date)
        )
        SELECT
          COALESCE(
            ROUND(
              ((current_month.balance - previous_month.balance) * 100.0 / 
               NULLIF(ABS(previous_month.balance), 0)), 2
            ), 0
          ) as growth_percentage
        FROM monthly_data current_month
        CROSS JOIN monthly_data previous_month
        WHERE current_month.month = DATE_TRUNC('month', NOW())
        AND previous_month.month = DATE_TRUNC('month', NOW() - INTERVAL '1 month')
      `)
    ]);

    const totalIncome = totals[0]?.total_income || 0;
    const totalExpenses = totals[0]?.total_expenses || 0;
    const monthlyIncome = monthly[0]?.monthly_income || 0;
    const monthlyExpenses = monthly[0]?.monthly_expenses || 0;

    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      monthlyIncome,
      monthlyExpenses,
      monthlyBalance: monthlyIncome - monthlyExpenses,
      growth: growth[0]?.growth_percentage || 0
    };
  }

  private getCategoryName(categoryId: string): string {
    const categories: { [key: string]: string } = {
      // Income
      'honorarios': 'Honorários advocatícios',
      'consultorias': 'Consultorias jurídicas',
      'acordos': 'Acordos e mediações',
      'custas_reemb': 'Custas judiciais reembolsadas',
      'outros_servicos': 'Outros serviços jurídicos',
      // Expenses
      'salarios': 'Salários e encargos trabalhistas',
      'aluguel': 'Aluguel / condomínio',
      'contas': 'Contas (água, luz, internet)',
      'material': 'Material de escritório',
      'marketing': 'Marketing e publicidade',
      'custas_judiciais': 'Custas judiciais',
      'treinamentos': 'Treinamentos e cursos',
      'transporte': 'Transporte e viagens',
      'manutencao': 'Manutenção e equipamentos',
      'impostos': 'Impostos e taxas',
      'oab': 'Associações profissionais (OAB)',
      'seguro': 'Seguro profissional',
    };
    
    return categories[categoryId] || categoryId;
  }

  async exportCSV(filters?: any): Promise<string> {
    this.requirePermission('read', 'cash_flow');

    const transactions = await this.getAll(filters);

    const headers = [
      'Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Método Pagamento',
      'Status', 'Projeto', 'Cliente', 'Criado por', 'Observações'
    ];

    const csvData = transactions.map(transaction => [
      new Date(transaction.date).toLocaleDateString('pt-BR'),
      transaction.type === 'income' ? 'Receita' : 'Despesa',
      transaction.description,
      transaction.category_name,
      transaction.amount.toFixed(2).replace('.', ','),
      transaction.payment_method || '-',
      transaction.status === 'confirmed' ? 'Confirmado' : 
      transaction.status === 'pending' ? 'Pendente' : 'Cancelado',
      transaction.project_title || '-',
      transaction.client_name || '-',
      transaction.created_by || '-',
      transaction.notes || '-'
    ]);

    const csv = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    return csv;
  }
}