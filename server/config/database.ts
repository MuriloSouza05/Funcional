import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

if (!process.env.VITE_SUPABASE_URL) {
  throw new Error('Missing env.VITE_SUPABASE_URL');
}
if (!process.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Admin client para operações do sistema
export const supabaseAdmin = createClient<Database>(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export interface TenantConnection {
  schema: string;
  tenantId: string;
  query: (sql: string, params?: any[]) => Promise<any>;
}

export const getTenantConnection = (tenantId: string): TenantConnection => {
  const schema = `tenant_${tenantId.replace(/-/g, '')}`;
  
  return {
    schema,
    tenantId,
    async query(sql: string, params: any[] = []) {
      const tenantSql = sql.replace(/\${schema}/g, schema);
      const { data, error } = await supabase.rpc('exec_sql', {
        query: tenantSql,
        params: params
      });
      
      if (error) throw error;
      return data;
    }
  };
};