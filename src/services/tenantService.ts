import { supabase } from '../config/supabase';
import { TenantDatabase } from '../config/supabase';

export class TenantService {
  async createTenant(name: string): Promise<string> {
    const tenantId = crypto.randomUUID();
    const schemaName = `tenant_${tenantId.replace(/-/g, '')}`;

    // Create tenant record
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        id: tenantId,
        name,
        schema_name: schemaName,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create tenant: ${error.message}`);
    }

    // Create tenant schema
    await supabase.rpc('create_tenant_schema', { tenant_uuid: tenantId });

    return tenantId;
  }

  async getTenantDatabase(tenantId: string): Promise<TenantDatabase> {
    // Verify tenant exists and is active
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !tenant) {
      throw new Error('Tenant not found or inactive');
    }

    return new TenantDatabase(tenantId);
  }

  async validateTenantAccess(resourceTenantId: string, userTenantId: string) {
    if (resourceTenantId !== userTenantId) {
      // Log critical security violation
      await supabase.from('audit_logs').insert({
        tenant_id: userTenantId,
        table_name: 'security_violation',
        operation: 'CROSS_TENANT_ACCESS',
        new_data: {
          attempted_tenant: resourceTenantId,
          user_tenant: userTenantId,
          timestamp: new Date().toISOString(),
        },
      });

      throw new Error('Cross-tenant access denied');
    }
  }

  async getTenantUsers(tenantId: string) {
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id, name, email, account_type, is_active, last_login, created_at
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to get tenant users: ${error.message}`);
    }

    return users;
  }

  async updateTenantSettings(tenantId: string, settings: any) {
    const { error } = await supabase
      .from('tenants')
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (error) {
      throw new Error(`Failed to update tenant settings: ${error.message}`);
    }
  }

  async getTenantStats(tenantId: string) {
    const tenantDb = new TenantDatabase(tenantId);

    try {
      const [clients, projects, tasks, transactions, invoices] = await Promise.all([
        tenantDb.count('clients', { is_active: true }),
        tenantDb.count('projects', { is_active: true }),
        tenantDb.count('tasks', { is_active: true }),
        tenantDb.count('transactions', { is_active: true }),
        tenantDb.count('invoices', { is_active: true }),
      ]);

      return {
        clients,
        projects,
        tasks,
        transactions,
        invoices,
      };
    } catch (error) {
      return {
        clients: 0,
        projects: 0,
        tasks: 0,
        transactions: 0,
        invoices: 0,
        error: 'Failed to load stats',
      };
    }
  }

  async getAllTenants() {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select(`
        *,
        users!inner(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get tenants: ${error.message}`);
    }

    // Get stats for each tenant
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        const stats = await this.getTenantStats(tenant.id);
        return {
          ...tenant,
          userCount: tenant.users?.length || 0,
          stats,
        };
      })
    );

    return tenantsWithStats;
  }

  async deleteTenant(tenantId: string) {
    // Get tenant info
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('schema_name')
      .eq('id', tenantId)
      .single();

    if (fetchError || !tenant) {
      throw new Error('Tenant not found');
    }

    // Drop tenant schema
    await supabase.rpc('execute_sql', {
      query: `DROP SCHEMA IF EXISTS "${tenant.schema_name}" CASCADE`
    });

    // Delete tenant record (cascade will delete users and keys)
    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (error) {
      throw new Error(`Failed to delete tenant: ${error.message}`);
    }
  }
}

export const tenantService = new TenantService();