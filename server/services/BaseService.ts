import { supabaseAdmin } from '../config/database';
import { AuthenticatedUser } from '../middleware/auth';

export class BaseService {
  protected tenantSchema: string;
  protected tenantId: string;
  protected user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
    this.tenantId = user.tenantId;
    this.tenantSchema = `tenant_${user.tenantId.replace(/-/g, '')}`;
  }

  protected async query(sql: string, params: any[] = []) {
    try {
      const tenantSql = sql.replace(/\$\{schema\}/g, this.tenantSchema);
      
      // Execute query using Supabase
      const { data, error } = await supabaseAdmin.rpc('exec_sql', {
        query: tenantSql,
        params: params
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error('Erro na consulta ao banco de dados');
    }
  }

  protected async auditLog(
    tableName: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    recordId: string,
    oldData?: any,
    newData?: any
  ) {
    try {
      await this.query(`
        INSERT INTO \${schema}.audit_log (
          user_id, table_name, record_id, operation, old_data, new_data, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        this.user.id,
        tableName,
        recordId,
        operation,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null
      ]);
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }

  protected async createNotification(
    type: string,
    title: string,
    message: string,
    category: string,
    entityType?: string,
    entityId?: string,
    actionData?: any,
    userId?: string
  ) {
    try {
      await this.query(`
        INSERT INTO \${schema}.notifications (
          type, title, message, category, entity_type, entity_id, 
          action_data, user_id, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        type,
        title,
        message,
        category,
        entityType,
        entityId,
        actionData ? JSON.stringify(actionData) : null,
        userId,
        this.user.name
      ]);
    } catch (error) {
      console.error('Notification creation error:', error);
    }
  }

  protected requirePermission(permission: 'read' | 'write' | 'admin', module: string) {
    const { accountType } = this.user;

    // Conta Simples: Sem acesso financeiro
    if (accountType === 'simples' && 
        ['cash_flow', 'financial_dashboard'].includes(module)) {
      throw new Error('Conta Simples não tem acesso a dados financeiros');
    }

    // Apenas Conta Gerencial pode acessar configurações
    if (module === 'settings' && accountType !== 'gerencial') {
      throw new Error('Apenas Conta Gerencial pode acessar configurações');
    }

    // Permissões de escrita para todos os módulos (exceto restrições acima)
    return true;
  }
}