import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://sdgsphetqccgyqwunvvo.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkZ3NwaGV0cWNjZ3lxd3VudnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzMDM0NDcsImV4cCI6MjA3MTg3OTQ0N30.9hvtHvOiEHH5R7zAlpjgLdIOERIowQgncUEMbOCwsAE';

// Main Supabase client for global operations
export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client with service role key (for admin operations)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase;

// Database connection class for tenant operations
export class TenantDatabase {
  private tenantId: string;
  private schemaName: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.schemaName = `tenant_${tenantId.replace(/-/g, '')}`;
  }

  // Execute raw SQL with tenant schema
  async query(sql: string, params: any[] = []) {
    const tenantSql = sql.replace(/\$\{schema\}/g, this.schemaName);
    const { data, error } = await supabase.rpc('execute_sql', {
      query: tenantSql,
      params: params
    });
    
    if (error) throw error;
    return data;
  }

  // Generic CRUD operations for tenant tables
  async findMany(table: string, where: any = {}, options: any = {}) {
    const whereClause = Object.keys(where).length > 0 
      ? `WHERE ${Object.keys(where).map((key, i) => `${key} = $${i + 1}`).join(' AND ')}`
      : '';
    
    const orderBy = options.orderBy 
      ? `ORDER BY ${options.orderBy.field} ${options.orderBy.direction || 'ASC'}`
      : '';
    
    const limit = options.limit ? `LIMIT ${options.limit}` : '';
    const offset = options.offset ? `OFFSET ${options.offset}` : '';

    const sql = `
      SELECT * FROM ${this.schemaName}.${table} 
      ${whereClause} 
      ${orderBy} 
      ${limit} 
      ${offset}
    `;

    return await this.query(sql, Object.values(where));
  }

  async findById(table: string, id: string) {
    const sql = `SELECT * FROM ${this.schemaName}.${table} WHERE id = $1`;
    const result = await this.query(sql, [id]);
    return result[0] || null;
  }

  async create(table: string, data: any) {
    const columns = Object.keys(data).join(', ');
    const values = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
    
    const sql = `
      INSERT INTO ${this.schemaName}.${table} (${columns}) 
      VALUES (${values}) 
      RETURNING *
    `;

    const result = await this.query(sql, Object.values(data));
    return result[0];
  }

  async update(table: string, id: string, data: any) {
    const setClause = Object.keys(data)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    const sql = `
      UPDATE ${this.schemaName}.${table} 
      SET ${setClause}, updated_at = NOW() 
      WHERE id = $1 
      RETURNING *
    `;

    const result = await this.query(sql, [id, ...Object.values(data)]);
    return result[0];
  }

  async delete(table: string, id: string) {
    const sql = `DELETE FROM ${this.schemaName}.${table} WHERE id = $1 RETURNING *`;
    const result = await this.query(sql, [id]);
    return result[0];
  }

  async count(table: string, where: any = {}) {
    const whereClause = Object.keys(where).length > 0 
      ? `WHERE ${Object.keys(where).map((key, i) => `${key} = $${i + 1}`).join(' AND ')}`
      : '';

    const sql = `SELECT COUNT(*) as count FROM ${this.schemaName}.${table} ${whereClause}`;
    const result = await this.query(sql, Object.values(where));
    return parseInt(result[0].count);
  }

  // Dashboard metrics methods
  async getDashboardMetrics(accountType: string) {
    if (accountType === 'SIMPLES') {
      // Return zero financial data for simple accounts
      return {
        revenue: 0,
        expenses: 0,
        balance: 0,
        clients: await this.count('clients', { is_active: true }),
        projects: await this.count('projects', { is_active: true }),
        tasks: await this.count('tasks', { is_active: true }),
      };
    }

    // Full metrics for COMPOSTA and GERENCIAL accounts
    const financialData = await this.query(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as revenue,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance
      FROM \${schema}.transactions 
      WHERE date >= DATE_TRUNC('month', NOW())
        AND is_active = true
    `);

    const clientsCount = await this.count('clients', { is_active: true });
    const projectsCount = await this.count('projects', { is_active: true });
    const tasksCount = await this.count('tasks', { is_active: true });

    return {
      revenue: parseFloat(financialData[0]?.revenue || 0),
      expenses: parseFloat(financialData[0]?.expenses || 0),
      balance: parseFloat(financialData[0]?.balance || 0),
      clients: clientsCount,
      projects: projectsCount,
      tasks: tasksCount,
    };
  }
}

// Helper function to execute SQL with error handling
export async function executeSql(sql: string, params: any[] = []) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', {
      query: sql,
      params: params
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('SQL execution error:', error);
    throw error;
  }
}