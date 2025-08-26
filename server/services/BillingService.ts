import { BaseService } from './BaseService';

export class BillingService extends BaseService {
  
  async getAll(filters?: any) {
    this.requirePermission('read', 'billing');

    let sql = `
      SELECT * FROM \${schema}.billing 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.search) {
      sql += ` AND (number ILIKE $${params.length + 1} OR title ILIKE $${params.length + 1} OR receiver_name ILIKE $${params.length + 1})`;
      params.push(`%${filters.search}%`);
    }

    if (filters?.type) {
      sql += ` AND type = $${params.length + 1}`;
      params.push(filters.type);
    }

    if (filters?.status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    sql += ` ORDER BY created_at DESC`;

    return await this.query(sql, params);
  }

  async getById(id: string) {
    this.requirePermission('read', 'billing');

    const results = await this.query(`
      SELECT * FROM \${schema}.billing WHERE id = $1
    `, [id]);

    if (!results || results.length === 0) {
      throw new Error('Documento não encontrado');
    }

    return results[0];
  }

  async create(billingData: any) {
    this.requirePermission('write', 'billing');

    const {
      type, date, due_date, sender_id, receiver_id, title, description,
      currency, discount, discount_type, fee, fee_type, tax, tax_type,
      status, tags, notes, items
    } = billingData;

    // Calcular totais
    const subtotal = items.reduce((sum: number, item: any) => sum + item.amount, 0);
    const discountAmount = discount_type === 'percentage' ? (subtotal * discount / 100) : discount;
    const feeAmount = fee_type === 'percentage' ? (subtotal * fee / 100) : fee;
    const taxAmount = tax_type === 'percentage' ? (subtotal * tax / 100) : tax;
    const total = subtotal - discountAmount + feeAmount + taxAmount;

    // Generate document number
    const typePrefix = type === 'estimate' ? 'EST' : 'INV';
    const count = await this.query(`
      SELECT COUNT(*) as count FROM \${schema}.billing WHERE type = $1
    `, [type]);
    const number = `${typePrefix}-${String((count[0]?.count || 0) + 1).padStart(3, '0')}`;

    const results = await this.query(`
      INSERT INTO \${schema}.billing (
        type, number, title, description, date, due_date, 
        sender_name, sender_details, receiver_name, receiver_details,
        items, subtotal, discount, discount_type, fee, fee_type,
        tax, tax_type, total, currency, status, tags, notes,
        created_by, last_modified_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW(), NOW()
      ) RETURNING *
    `, [
      type, number, title, description, date, due_date,
      'Escritório Silva & Associados', 
      JSON.stringify({ name: 'Escritório Silva & Associados', email: 'contato@silva.adv.br' }),
      'Cliente Selecionado',
      JSON.stringify({ name: 'Cliente Selecionado', email: 'cliente@email.com' }),
      JSON.stringify(items), subtotal, discount, discount_type,
      fee, fee_type, tax, tax_type, total, currency, status,
      JSON.stringify(tags || []), notes, this.user.name, this.user.name
    ]);

    const document = results[0];

    await this.auditLog('billing', 'CREATE', document.id, null, document);

    await this.createNotification(
      'info',
      `Novo ${type === 'estimate' ? 'Orçamento' : 'Fatura'} Criado`,
      `${this.user.name} criou ${document.number}`,
      'billing',
      'document',
      document.id,
      { document_id: document.id, page: '/cobranca' }
    );

    return document;
  }

  async update(id: string, billingData: any) {
    this.requirePermission('write', 'billing');

    const oldDocument = await this.getById(id);

    const {
      title, description, date, due_date, currency, discount, 
      discount_type, fee, fee_type, tax, tax_type, status, tags, notes, items
    } = billingData;

    // Recalcular totais se items fornecidos
    let subtotal = oldDocument.subtotal;
    let total = oldDocument.total;

    if (items) {
      subtotal = items.reduce((sum: number, item: any) => sum + item.amount, 0);
      const discountAmount = discount_type === 'percentage' ? (subtotal * discount / 100) : discount;
      const feeAmount = fee_type === 'percentage' ? (subtotal * fee / 100) : fee;
      const taxAmount = tax_type === 'percentage' ? (subtotal * tax / 100) : tax;
      total = subtotal - discountAmount + feeAmount + taxAmount;
    }

    const results = await this.query(`
      UPDATE \${schema}.billing SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        date = COALESCE($3, date),
        due_date = COALESCE($4, due_date),
        currency = COALESCE($5, currency),
        discount = COALESCE($6, discount),
        discount_type = COALESCE($7, discount_type),
        fee = COALESCE($8, fee),
        fee_type = COALESCE($9, fee_type),
        tax = COALESCE($10, tax),
        tax_type = COALESCE($11, tax_type),
        status = COALESCE($12, status),
        tags = COALESCE($13, tags),
        notes = COALESCE($14, notes),
        items = COALESCE($15, items),
        subtotal = COALESCE($16, subtotal),
        total = COALESCE($17, total),
        last_modified_by = $18,
        updated_at = NOW()
      WHERE id = $19
      RETURNING *
    `, [
      title, description, date, due_date, currency, discount, discount_type,
      fee, fee_type, tax, tax_type, status, JSON.stringify(tags), notes,
      JSON.stringify(items), subtotal, total, this.user.name, id
    ]);

    const document = results[0];

    await this.auditLog('billing', 'UPDATE', id, oldDocument, document);

    return document;
  }

  async delete(id: string): Promise<void> {
    this.requirePermission('write', 'billing');

    const document = await this.getById(id);

    await this.query(`DELETE FROM \${schema}.billing WHERE id = $1`, [id]);

    await this.auditLog('billing', 'DELETE', id, document, null);
  }

  async getStats() {
    this.requirePermission('read', 'billing');

    const [estimates, invoices, pending, paid, overdue, thisMonth] = await Promise.all([
      this.query(`SELECT COUNT(*) as count FROM \${schema}.billing WHERE type = 'estimate'`),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.billing WHERE type = 'invoice'`),
      this.query(`
        SELECT SUM(total) as amount FROM \${schema}.billing 
        WHERE status IN ('PENDING', 'SENT', 'VIEWED')
      `),
      this.query(`
        SELECT SUM(total) as amount FROM \${schema}.billing 
        WHERE status = 'PAID' AND payment_date >= DATE_TRUNC('month', NOW())
      `),
      this.query(`
        SELECT SUM(total) as amount FROM \${schema}.billing 
        WHERE due_date < CURRENT_DATE AND status NOT IN ('PAID', 'CANCELLED')
      `),
      this.query(`
        SELECT SUM(total) as amount FROM \${schema}.billing 
        WHERE DATE_TRUNC('month', due_date) = DATE_TRUNC('month', NOW())
      `)
    ]);

    return {
      totalEstimates: estimates[0]?.count || 0,
      totalInvoices: invoices[0]?.count || 0,
      pendingAmount: pending[0]?.amount || 0,
      paidAmount: paid[0]?.amount || 0,
      overdueAmount: overdue[0]?.amount || 0,
      thisMonthAmount: thisMonth[0]?.amount || 0
    };
  }
}