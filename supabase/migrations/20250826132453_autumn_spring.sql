/*
  # Sistema de Multi-Tenancy para SaaS Advocacia
  
  Este arquivo configura o sistema inicial com:
  1. Schema de administração global
  2. Função para criar schemas por tenant
  3. Tipos de conta (Simples, Composta, Gerencial)
  4. Sistema de permissões
  5. Tenant de demonstração
*/

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schema administrativo global (fora dos tenants)
CREATE SCHEMA IF NOT EXISTS admin;

-- Tabela de tenants (escritórios de advocacia)
CREATE TABLE IF NOT EXISTS admin.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  schema_name VARCHAR(100) UNIQUE NOT NULL,
  domain VARCHAR(255),
  plan_type VARCHAR(50) DEFAULT 'basic',
  max_users_simple INTEGER DEFAULT 2,
  max_users_composta INTEGER DEFAULT 1,
  max_users_gerencial INTEGER DEFAULT 1,
  max_storage_gb INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de usuários global (para autenticação)
CREATE TABLE IF NOT EXISTS admin.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES admin.tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  account_type VARCHAR(20) CHECK (account_type IN ('simples', 'composta', 'gerencial')) DEFAULT 'simples',
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT false,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de refresh tokens
CREATE TABLE IF NOT EXISTS admin.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES admin.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Logs do sistema
CREATE TABLE IF NOT EXISTS admin.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES admin.tenants(id),
  user_id UUID REFERENCES admin.users(id),
  level VARCHAR(20) DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Função para criar schema de tenant
CREATE OR REPLACE FUNCTION admin.create_tenant_schema(tenant_id UUID, schema_name VARCHAR)
RETURNS VOID AS $$
BEGIN
  -- Criar schema
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
  
  -- Configurar search_path
  EXECUTE format('ALTER DATABASE %I SET search_path TO %I, public', current_database(), schema_name);
  
  -- Criar tabelas do tenant
  EXECUTE format('
    -- Clientes (CRM)
    CREATE TABLE %I.clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      organization VARCHAR(255),
      email VARCHAR(255),
      mobile VARCHAR(50) NOT NULL,
      country VARCHAR(100) NOT NULL,
      state VARCHAR(100) NOT NULL,
      address TEXT,
      city VARCHAR(100) NOT NULL,
      zip_code VARCHAR(20),
      budget DECIMAL(15,2) DEFAULT 0,
      currency VARCHAR(3) DEFAULT ''BRL'',
      level VARCHAR(50),
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      description TEXT,
      
      -- Legal fields
      pis VARCHAR(20),
      cei VARCHAR(20),
      professional_title VARCHAR(100),
      marital_status VARCHAR(20),
      birth_date DATE,
      cpf VARCHAR(14),
      rg VARCHAR(20),
      inss_status VARCHAR(20),
      amount_paid DECIMAL(15,2) DEFAULT 0,
      referred_by VARCHAR(255),
      registered_by VARCHAR(255),
      
      status VARCHAR(20) DEFAULT ''active'' CHECK (status IN (''active'', ''inactive'', ''pending'')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Projetos
    CREATE TABLE %I.projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      client_name VARCHAR(255) NOT NULL,
      client_id UUID REFERENCES %I.clients(id),
      organization VARCHAR(255),
      contacts JSONB DEFAULT ''[]'',
      address TEXT,
      budget DECIMAL(15,2) DEFAULT 0,
      currency VARCHAR(3) DEFAULT ''BRL'',
      status VARCHAR(20) DEFAULT ''contacted'' CHECK (status IN (''contacted'', ''proposal'', ''won'', ''lost'')),
      start_date DATE NOT NULL,
      due_date DATE NOT NULL,
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      assigned_to TEXT[] DEFAULT ARRAY[]::TEXT[],
      priority VARCHAR(20) DEFAULT ''medium'' CHECK (priority IN (''low'', ''medium'', ''high'', ''urgent'')),
      progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
      created_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      notes TEXT,
      attachments JSONB DEFAULT ''[]''
    );

    -- Tarefas
    CREATE TABLE %I.tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT ''not_started'' CHECK (status IN (''not_started'', ''in_progress'', ''completed'', ''on_hold'', ''cancelled'')),
      priority VARCHAR(20) DEFAULT ''medium'' CHECK (priority IN (''low'', ''medium'', ''high'', ''urgent'')),
      assigned_to VARCHAR(255) NOT NULL,
      project_id UUID REFERENCES %I.projects(id),
      project_title VARCHAR(255),
      client_id UUID REFERENCES %I.clients(id),
      client_name VARCHAR(255),
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      estimated_hours DECIMAL(8,2),
      actual_hours DECIMAL(8,2) DEFAULT 0,
      progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP,
      notes TEXT,
      attachments JSONB DEFAULT ''[]'',
      subtasks JSONB DEFAULT ''[]''
    );

    -- Fluxo de Caixa
    CREATE TABLE %I.cash_flow (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(10) CHECK (type IN (''income'', ''expense'')) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      category_id VARCHAR(50) NOT NULL,
      category_name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      date DATE NOT NULL,
      payment_method VARCHAR(20),
      status VARCHAR(20) DEFAULT ''confirmed'' CHECK (status IN (''pending'', ''confirmed'', ''cancelled'')),
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      project_id UUID REFERENCES %I.projects(id),
      project_title VARCHAR(255),
      client_id UUID REFERENCES %I.clients(id),
      client_name VARCHAR(255),
      is_recurring BOOLEAN DEFAULT false,
      recurring_frequency VARCHAR(20),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      created_by VARCHAR(255),
      notes TEXT
    );

    -- Sistema de Cobrança
    CREATE TABLE %I.billing (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(20) CHECK (type IN (''estimate'', ''invoice'')) NOT NULL,
      number VARCHAR(50) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      due_date DATE NOT NULL,
      sender_name VARCHAR(255) NOT NULL,
      sender_details JSONB NOT NULL,
      receiver_name VARCHAR(255) NOT NULL,
      receiver_details JSONB NOT NULL,
      items JSONB DEFAULT ''[]'',
      subtotal DECIMAL(15,2) DEFAULT 0,
      discount DECIMAL(15,2) DEFAULT 0,
      discount_type VARCHAR(20) DEFAULT ''fixed'',
      fee DECIMAL(15,2) DEFAULT 0,
      fee_type VARCHAR(20) DEFAULT ''fixed'',
      tax DECIMAL(15,2) DEFAULT 0,
      tax_type VARCHAR(20) DEFAULT ''percentage'',
      total DECIMAL(15,2) DEFAULT 0,
      currency VARCHAR(3) DEFAULT ''BRL'',
      status VARCHAR(20) DEFAULT ''DRAFT'',
      payment_status VARCHAR(20),
      payment_method VARCHAR(20),
      payment_date TIMESTAMP,
      email_sent BOOLEAN DEFAULT false,
      email_sent_at TIMESTAMP,
      reminders_sent INTEGER DEFAULT 0,
      last_reminder_at TIMESTAMP,
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      created_by VARCHAR(255),
      last_modified_by VARCHAR(255)
    );

    -- Sistema de Recebíveis
    CREATE TABLE %I.invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id VARCHAR(255) NOT NULL,
      numero_fatura VARCHAR(50) UNIQUE NOT NULL,
      valor DECIMAL(15,2) NOT NULL,
      descricao TEXT NOT NULL,
      servico_prestado VARCHAR(255) NOT NULL,
      data_emissao DATE NOT NULL,
      data_vencimento DATE NOT NULL,
      data_pagamento TIMESTAMP,
      status VARCHAR(20) DEFAULT ''nova'' CHECK (status IN (''nova'', ''pendente'', ''atribuida'', ''paga'', ''vencida'', ''cancelada'', ''processando'')),
      tentativas_cobranca INTEGER DEFAULT 0,
      
      -- Stripe Integration
      stripe_invoice_id VARCHAR(255),
      stripe_customer_id VARCHAR(255),
      stripe_payment_intent_id VARCHAR(255),
      link_pagamento TEXT,
      
      -- Automação
      webhook_n8n_id VARCHAR(255),
      ultima_notificacao TIMESTAMP,
      proxima_notificacao TIMESTAMP,
      
      -- Recorrência
      recorrente BOOLEAN DEFAULT false,
      intervalo_dias INTEGER DEFAULT 30,
      proxima_fatura_data DATE,
      
      -- Client data
      cliente_nome VARCHAR(255),
      cliente_email VARCHAR(255),
      cliente_telefone VARCHAR(50),
      
      -- Metadata
      criado_por VARCHAR(255),
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW(),
      observacoes TEXT,
      urgencia VARCHAR(10) DEFAULT ''media'' CHECK (urgencia IN (''baixa'', ''media'', ''alta''))
    );

    -- Painel de Publicações (ISOLADO POR USUÁRIO)
    CREATE TABLE %I.publications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL, -- Isolamento crítico por usuário
      data_publicacao DATE NOT NULL,
      processo VARCHAR(255) NOT NULL,
      diario VARCHAR(500) NOT NULL,
      vara_comarca VARCHAR(255) NOT NULL,
      nome_pesquisado VARCHAR(255) NOT NULL,
      status VARCHAR(20) DEFAULT ''nova'' CHECK (status IN (''nova'', ''pendente'', ''atribuida'', ''finalizada'', ''descartada'')),
      conteudo TEXT,
      observacoes TEXT,
      responsavel VARCHAR(255),
      numero_processo VARCHAR(255),
      cliente VARCHAR(255),
      urgencia VARCHAR(10) DEFAULT ''media'' CHECK (urgencia IN (''baixa'', ''media'', ''alta'')),
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      atribuido_para_id VARCHAR(255),
      atribuido_para_nome VARCHAR(255),
      data_atribuicao TIMESTAMP,
      tarefas_vinculadas TEXT[] DEFAULT ARRAY[]::TEXT[],
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Notificações
    CREATE TABLE %I.notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(20) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      category VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50),
      entity_id UUID,
      action_data JSONB,
      user_id UUID,
      read BOOLEAN DEFAULT false,
      created_by VARCHAR(255),
      details TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    -- Audit log
    CREATE TABLE %I.audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255),
      table_name VARCHAR(100) NOT NULL,
      record_id UUID,
      operation VARCHAR(10) CHECK (operation IN (''CREATE'', ''UPDATE'', ''DELETE'')) NOT NULL,
      old_data JSONB,
      new_data JSONB,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Índices para performance
    CREATE INDEX IF NOT EXISTS idx_clients_name ON %I.clients(name);
    CREATE INDEX IF NOT EXISTS idx_clients_email ON %I.clients(email);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON %I.projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_client_id ON %I.projects(client_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON %I.tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON %I.tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON %I.tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_cash_flow_date ON %I.cash_flow(date);
    CREATE INDEX IF NOT EXISTS idx_cash_flow_type ON %I.cash_flow(type);
    CREATE INDEX IF NOT EXISTS idx_billing_status ON %I.billing(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON %I.invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_data_vencimento ON %I.invoices(data_vencimento);
    CREATE INDEX IF NOT EXISTS idx_publications_user_id ON %I.publications(user_id);
    CREATE INDEX IF NOT EXISTS idx_publications_status ON %I.publications(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON %I.notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON %I.notifications(read);
  ', schema_name, schema_name, schema_name, schema_name, schema_name, schema_name,
     schema_name, schema_name, schema_name, schema_name, schema_name, schema_name,
     schema_name, schema_name, schema_name, schema_name, schema_name, schema_name,
     schema_name, schema_name, schema_name, schema_name, schema_name, schema_name,
     schema_name, schema_name, schema_name, schema_name, schema_name, schema_name,
     schema_name, schema_name, schema_name, schema_name);

END;
$$ LANGUAGE plpgsql;

-- Criar tenant de demonstração
DO $$
DECLARE
  demo_tenant_id UUID;
  demo_user_id UUID;
BEGIN
  -- Inserir tenant demo
  INSERT INTO admin.tenants (id, name, schema_name, plan_type)
  VALUES (
    gen_random_uuid(),
    'Escritório Silva & Associados (Demo)',
    'tenant_demo',
    'premium'
  ) RETURNING id INTO demo_tenant_id;

  -- Criar schema do tenant demo
  PERFORM admin.create_tenant_schema(demo_tenant_id, 'tenant_demo');

  -- Criar usuários demo com diferentes tipos de conta
  
  -- 1. Conta Gerencial (acesso total)
  INSERT INTO admin.users (tenant_id, email, password_hash, name, account_type)
  VALUES (
    demo_tenant_id,
    'admin@escritorio.com',
    crypt('123456', gen_salt('bf')),
    'Dr. Silva - Sócio Gerente',
    'gerencial'
  ) RETURNING id INTO demo_user_id;

  -- 2. Conta Composta (CRM + Financeiro)
  INSERT INTO admin.users (tenant_id, email, password_hash, name, account_type)
  VALUES (
    demo_tenant_id,
    'financeiro@escritorio.com',
    crypt('123456', gen_salt('bf')),
    'Dra. Costa - Sócia Financeira',
    'composta'
  );

  -- 3. Conta Simples (CRM apenas)
  INSERT INTO admin.users (tenant_id, email, password_hash, name, account_type)
  VALUES (
    demo_tenant_id,
    'atendimento@escritorio.com',
    crypt('123456', gen_salt('bf')),
    'Ana Santos - Atendimento',
    'simples'
  );

END;
$$;