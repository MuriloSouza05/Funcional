import { BaseService } from './BaseService';

export class InvoiceService extends BaseService {
  
  async getAll(filters?: any) {
    this.requirePermission('read', 'receivables');

    let sql = `
      SELECT * FROM \${schema}.invoices 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.search) {
      sql += ` AND (numero_fatura ILIKE $${params.length + 1} OR cliente_nome ILIKE $${params.length + 1})`;
      params.push(`%${filters.search}%`);
    }

    if (filters?.status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    sql += ` ORDER BY 
      CASE 
        WHEN status = 'pendente' THEN 1
        WHEN status = 'nova' THEN 2
        WHEN status = 'processando' THEN 3
        WHEN status = 'atribuida' THEN 4
        WHEN status = 'paga' THEN 5
        ELSE 6
      END,
      data_vencimento ASC
    `;

    return await this.query(sql, params);
  }

  async getById(id: string) {
    this.requirePermission('read', 'receivables');

    const results = await this.query(`
      SELECT * FROM \${schema}.invoices WHERE id = $1
    `, [id]);

    if (!results || results.length === 0) {
      throw new Error('Fatura não encontrada');
    }

    return results[0];
  }

  async create(invoiceData: any) {
    this.requirePermission('write', 'receivables');

    const {
      cliente_nome, cliente_email, cliente_telefone, numero_fatura,
      valor, descricao, servico_prestado, data_vencimento, observacoes,
      urgencia, recorrente, intervalo_dias, proxima_fatura_data
    } = invoiceData;

    const results = await this.query(`
      INSERT INTO \${schema}.invoices (
        client_id, numero_fatura, valor, descricao, servico_prestado,
        data_emissao, data_vencimento, status, tentativas_cobranca,
        recorrente, intervalo_dias, proxima_fatura_data, cliente_nome,
        cliente_email, cliente_telefone, criado_por, criado_em,
        atualizado_em, observacoes, urgencia
      ) VALUES (
        $1, $2, $3, $4, $5, CURRENT_DATE, $6, 'nova', 0,
        $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), $14, $15
      ) RETURNING *
    `, [
      'generated_' + Date.now(), numero_fatura, valor, descricao,
      servico_prestado, data_vencimento, recorrente || false,
      intervalo_dias || 30, proxima_fatura_data, cliente_nome,
      cliente_email, cliente_telefone, this.user.name, observacoes,
      urgencia || 'media'
    ]);

    const invoice = results[0];

    await this.auditLog('invoices', 'CREATE', invoice.id, null, invoice);

    await this.createNotification(
      'warning',
      'Nova Fatura Criada',
      `${this.user.name} criou a fatura ${invoice.numero_fatura}`,
      'billing',
      'invoice',
      invoice.id,
      { invoice_id: invoice.id, page: '/recebiveis' }
    );

    return invoice;
  }

  async update(id: string, invoiceData: any) {
    this.requirePermission('write', 'receivables');

    const oldInvoice = await this.getById(id);

    const {
      cliente_nome, cliente_email, cliente_telefone, numero_fatura,
      valor, descricao, servico_prestado, data_vencimento, observacoes,
      urgencia, status
    } = invoiceData;

    const results = await this.query(`
      UPDATE \${schema}.invoices SET
        cliente_nome = COALESCE($1, cliente_nome),
        cliente_email = COALESCE($2, cliente_email),
        cliente_telefone = COALESCE($3, cliente_telefone),
        numero_fatura = COALESCE($4, numero_fatura),
        valor = COALESCE($5, valor),
        descricao = COALESCE($6, descricao),
        servico_prestado = COALESCE($7, servico_prestado),
        data_vencimento = COALESCE($8, data_vencimento),
        observacoes = COALESCE($9, observacoes),
        urgencia = COALESCE($10, urgencia),
        status = COALESCE($11, status),
        data_pagamento = CASE WHEN $11 = 'paga' THEN NOW() ELSE data_pagamento END,
        atualizado_em = NOW()
      WHERE id = $12
      RETURNING *
    `, [
      cliente_nome, cliente_email, cliente_telefone, numero_fatura,
      valor, descricao, servico_prestado, data_vencimento, observacoes,
      urgencia, status, id
    ]);

    const invoice = results[0];

    await this.auditLog('invoices', 'UPDATE', id, oldInvoice, invoice);

    return invoice;
  }

  async delete(id: string): Promise<void> {
    this.requirePermission('write', 'receivables');

    const invoice = await this.getById(id);

    await this.query(`DELETE FROM \${schema}.invoices WHERE id = $1`, [id]);

    await this.auditLog('invoices', 'DELETE', id, invoice, null);
  }

  async getDashboardStats() {
    this.requirePermission('read', 'receivables');

    const [pagas, pendentes, vencidas, proximoVencimento, valores] = await Promise.all([
      this.query(`SELECT COUNT(*) as count FROM \${schema}.invoices WHERE status = 'paga'`),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.invoices WHERE status IN ('nova', 'pendente')`),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.invoices WHERE status = 'vencida'`),
      this.query(`
        SELECT COUNT(*) as count FROM \${schema}.invoices 
        WHERE data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
        AND status IN ('nova', 'pendente')
      `),
      this.query(`
        SELECT 
          SUM(CASE WHEN status = 'paga' THEN valor ELSE 0 END) as valor_pago,
          SUM(CASE WHEN status IN ('nova', 'pendente') THEN valor ELSE 0 END) as valor_pendente,
          SUM(CASE WHEN status = 'vencida' THEN valor ELSE 0 END) as valor_vencido
        FROM \${schema}.invoices
      `)
    ]);

    return {
      faturasPagas: pagas[0]?.count || 0,
      faturasPendentes: pendentes[0]?.count || 0,
      faturasVencidas: vencidas[0]?.count || 0,
      faturasProximoVencimento: proximoVencimento[0]?.count || 0,
      valorTotal: (valores[0]?.valor_pago || 0) + (valores[0]?.valor_pendente || 0) + (valores[0]?.valor_vencido || 0),
      valorPago: valores[0]?.valor_pago || 0,
      valorPendente: valores[0]?.valor_pendente || 0,
      valorVencido: valores[0]?.valor_vencido || 0,
      novosClientes: 0, // Will be calculated from clients
      taxaCobranças: 96.8, // Will be calculated
      tempoMedioPagamento: 8, // Will be calculated
      notificacoesAgendadas: 0, // Will be calculated
      faturamentoMensal: valores[0]?.valor_pago || 0,
      crescimentoMensal: 0, // Will be calculated
      clientesAtivos: 0 // Will be calculated
    };
  }

  async getClients() {
    this.requirePermission('read', 'receivables');

    const results = await this.query(`
      SELECT 
        DISTINCT cliente_nome as nome,
        cliente_email as email,
        cliente_telefone as telefone,
        COUNT(*) as total_faturas,
        SUM(valor) as total_faturado,
        SUM(CASE WHEN status = 'paga' THEN valor ELSE 0 END) as total_pago,
        SUM(CASE WHEN status IN ('nova', 'pendente') THEN 1 ELSE 0 END) as faturas_pendentes,
        MAX(CASE WHEN status = 'paga' THEN data_pagamento ELSE NULL END) as ultimo_pagamento
      FROM \${schema}.invoices
      WHERE cliente_nome IS NOT NULL AND cliente_nome != ''
      GROUP BY cliente_nome, cliente_email, cliente_telefone
      ORDER BY total_faturado DESC
    `);

    return results.map((row: any) => ({
      id: row.nome.replace(/\s+/g, '_').toLowerCase(),
      nome: row.nome,
      email: row.email,
      telefone: row.telefone,
      whatsapp: row.telefone,
      totalFaturado: parseFloat(row.total_faturado || 0),
      totalPago: parseFloat(row.total_pago || 0),
      faturasPendentes: parseInt(row.faturas_pendentes || 0),
      ultimoPagamento: row.ultimo_pagamento,
      ativo: true,
      bloqueado: false
    }));
  }
}