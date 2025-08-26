export interface Database {
  public: {
    Tables: {
      // Admin tables
      tenants: {
        Row: {
          id: string;
          name: string;
          schema_name: string;
          domain?: string;
          plan_type: string;
          max_users_simple: number;
          max_users_composta: number;
          max_users_gerencial: number;
          max_storage_gb: number;
          is_active: boolean;
          trial_ends_at?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };
      users: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          password_hash: string;
          name: string;
          account_type: 'simples' | 'composta' | 'gerencial';
          is_active: boolean;
          must_change_password: boolean;
          last_login?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
    };
    Functions: {
      exec_sql: {
        Args: { query: string; params: any[] };
        Returns: any;
      };
    };
  };
}

// Tenant-specific types
export interface Client {
  id: string;
  name: string;
  organization?: string;
  email?: string;
  mobile: string;
  country: string;
  state: string;
  address?: string;
  city: string;
  zip_code?: string;
  budget: number;
  currency: string;
  level?: string;
  tags: string[];
  description?: string;
  pis?: string;
  cei?: string;
  professional_title?: string;
  marital_status?: string;
  birth_date?: string;
  cpf?: string;
  rg?: string;
  inss_status?: string;
  amount_paid: number;
  referred_by?: string;
  registered_by?: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  client_name: string;
  client_id?: string;
  organization?: string;
  contacts: any[];
  address?: string;
  budget: number;
  currency: string;
  status: 'contacted' | 'proposal' | 'won' | 'lost';
  start_date: string;
  due_date: string;
  tags: string[];
  assigned_to: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  attachments: any[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string;
  project_id?: string;
  project_title?: string;
  client_id?: string;
  client_name?: string;
  tags: string[];
  estimated_hours?: number;
  actual_hours: number;
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  notes?: string;
  attachments: any[];
  subtasks: any[];
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category_id: string;
  category_name: string;
  description: string;
  date: string;
  payment_method?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  tags: string[];
  project_id?: string;
  project_title?: string;
  client_id?: string;
  client_name?: string;
  is_recurring: boolean;
  recurring_frequency?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  notes?: string;
}