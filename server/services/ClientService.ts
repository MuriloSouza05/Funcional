import { BaseService } from './BaseService';
import { Client } from '../types/database';

export class ClientService extends BaseService {
  
  async getAll(filters?: any): Promise<Client[]> {
    this.requirePermission('read', 'crm');

    let sql = `
      SELECT * FROM \${schema}.clients 
      WHERE 1=1
    `;
    const params: any[] = [];

    // Aplicar filtros se fornecidos
    if (filters?.search) {
      sql += ` AND (name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`;
      params.push(`%${filters.search}%`);
    }

    if (filters?.status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    sql += ` ORDER BY created_at DESC`;

    return await this.query(sql, params);
  }

  async getById(id: string): Promise<Client> {
    this.requirePermission('read', 'crm');

    const results = await this.query(`
      SELECT * FROM \${schema}.clients WHERE id = $1
    `, [id]);

    if (!results || results.length === 0) {
      throw new Error('Cliente não encontrado');
    }

    return results[0];
  }

  async create(clientData: Partial<Client>): Promise<Client> {
    this.requirePermission('write', 'crm');

    const {
      name, organization, email, mobile, country, state, address,
      city, zip_code, budget, currency, level, tags, description,
      pis, cei, professional_title, marital_status, birth_date,
      cpf, rg, inss_status, amount_paid, referred_by
    } = clientData;

    const results = await this.query(`
      INSERT INTO \${schema}.clients (
        name, organization, email, mobile, country, state, address,
        city, zip_code, budget, currency, level, tags, description,
        pis, cei, professional_title, marital_status, birth_date,
        cpf, rg, inss_status, amount_paid, referred_by, registered_by,
        status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
        'active', NOW(), NOW()
      ) RETURNING *
    `, [
      name, organization, email, mobile, country, state, address,
      city, zip_code, budget || 0, currency || 'BRL', level, 
      JSON.stringify(tags || []), description, pis, cei, professional_title,
      marital_status, birth_date, cpf, rg, inss_status, amount_paid || 0,
      referred_by, this.user.name
    ]);

    const client = results[0];

    // Audit log
    await this.auditLog('clients', 'CREATE', client.id, null, client);

    // Notificação
    await this.createNotification(
      'info',
      'Novo Cliente Cadastrado',
      `${this.user.name} cadastrou novo cliente: ${client.name}`,
      'client',
      'client',
      client.id,
      { client_id: client.id, page: '/crm' }
    );

    return client;
  }

  async update(id: string, clientData: Partial<Client>): Promise<Client> {
    this.requirePermission('write', 'crm');

    // Buscar dados atuais para audit
    const oldClient = await this.getById(id);

    const {
      name, organization, email, mobile, country, state, address,
      city, zip_code, budget, currency, level, tags, description,
      pis, cei, professional_title, marital_status, birth_date,
      cpf, rg, inss_status, amount_paid, referred_by
    } = clientData;

    const results = await this.query(`
      UPDATE \${schema}.clients SET
        name = COALESCE($1, name),
        organization = COALESCE($2, organization),
        email = COALESCE($3, email),
        mobile = COALESCE($4, mobile),
        country = COALESCE($5, country),
        state = COALESCE($6, state),
        address = COALESCE($7, address),
        city = COALESCE($8, city),
        zip_code = COALESCE($9, zip_code),
        budget = COALESCE($10, budget),
        currency = COALESCE($11, currency),
        level = COALESCE($12, level),
        tags = COALESCE($13, tags),
        description = COALESCE($14, description),
        pis = COALESCE($15, pis),
        cei = COALESCE($16, cei),
        professional_title = COALESCE($17, professional_title),
        marital_status = COALESCE($18, marital_status),
        birth_date = COALESCE($19, birth_date),
        cpf = COALESCE($20, cpf),
        rg = COALESCE($21, rg),
        inss_status = COALESCE($22, inss_status),
        amount_paid = COALESCE($23, amount_paid),
        referred_by = COALESCE($24, referred_by),
        updated_at = NOW()
      WHERE id = $25
      RETURNING *
    `, [
      name, organization, email, mobile, country, state, address,
      city, zip_code, budget, currency, level, JSON.stringify(tags),
      description, pis, cei, professional_title, marital_status,
      birth_date, cpf, rg, inss_status, amount_paid, referred_by, id
    ]);

    const client = results[0];

    // Audit log
    await this.auditLog('clients', 'UPDATE', id, oldClient, client);

    // Notificação
    await this.createNotification(
      'info',
      'Cliente Atualizado',
      `${this.user.name} editou o cliente: ${client.name}`,
      'client',
      'client',
      client.id,
      { client_id: client.id, page: '/crm' }
    );

    return client;
  }

  async delete(id: string): Promise<void> {
    this.requirePermission('write', 'crm');

    const client = await this.getById(id);

    await this.query(`
      DELETE FROM \${schema}.clients WHERE id = $1
    `, [id]);

    // Audit log
    await this.auditLog('clients', 'DELETE', id, client, null);

    // Notificação
    await this.createNotification(
      'warning',
      'Cliente Excluído',
      `${this.user.name} excluiu o cliente: ${client.name}`,
      'client'
    );
  }

  async getStats() {
    this.requirePermission('read', 'crm');

    const [totalClients, activeClients, growth] = await Promise.all([
      this.query(`SELECT COUNT(*) as count FROM \${schema}.clients`),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.clients WHERE status = 'active'`),
      this.query(`
        WITH monthly_clients AS (
          SELECT
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as new_clients,
            SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('month', created_at)) as cumulative_clients
          FROM \${schema}.clients
          WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '2 months')
          GROUP BY DATE_TRUNC('month', created_at)
        )
        SELECT
          COALESCE(
            ROUND(
              ((current_month.cumulative_clients - previous_month.cumulative_clients) * 100.0 / 
               NULLIF(previous_month.cumulative_clients, 0)), 2
            ), 0
          ) as growth_percentage
        FROM monthly_clients current_month
        LEFT JOIN monthly_clients previous_month 
          ON previous_month.month = current_month.month - INTERVAL '1 month'
        WHERE current_month.month = DATE_TRUNC('month', NOW())
      `)
    ]);

    return {
      total: totalClients[0]?.count || 0,
      active: activeClients[0]?.count || 0,
      growth: growth[0]?.growth_percentage || 0
    };
  }
}