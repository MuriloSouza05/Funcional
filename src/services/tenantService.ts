import { prisma } from '../config/database';
import { TenantDatabase } from '../config/database';

export class TenantService {
  async createTenant(name: string): Promise<string> {
    const tenant = await prisma.tenant.create({
      data: {
        name,
        schemaName: '', // Will be updated after schema creation
      },
    });

    // Generate schema name
    const schemaName = `tenant_${tenant.id.replace(/-/g, '')}`;
    
    // Update tenant with schema name
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { schemaName },
    });

    // Create tenant schema
    await this.createTenantSchema(tenant.id);

    return tenant.id;
  }

  async createTenantSchema(tenantId: string) {
    const schemaName = `tenant_${tenantId.replace(/-/g, '')}`;

    // Create schema
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    // Create tables
    const createTablesSQL = `
      -- Users table (tenant-specific)
      CREATE TABLE IF NOT EXISTS "${schemaName}".users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR UNIQUE NOT NULL,
        name VARCHAR NOT NULL,
        phone VARCHAR,
        avatar_url VARCHAR,
        role VARCHAR DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Clients table
      CREATE TABLE IF NOT EXISTS "${schemaName}".clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        email VARCHAR,
        phone VARCHAR,
        organization VARCHAR,
        address JSONB,
        budget DECIMAL(15,2) DEFAULT 0,
        currency VARCHAR DEFAULT 'BRL',
        status VARCHAR DEFAULT 'active',
        tags TEXT[],
        notes TEXT,
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      );

      -- Projects table
      CREATE TABLE IF NOT EXISTS "${schemaName}".projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        description TEXT,
        client_id UUID,
        client_name VARCHAR,
        organization VARCHAR,
        budget DECIMAL(15,2) DEFAULT 0,
        currency VARCHAR DEFAULT 'BRL',
        status VARCHAR DEFAULT 'contacted',
        priority VARCHAR DEFAULT 'medium',
        progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        start_date DATE,
        due_date DATE,
        completed_at TIMESTAMP,
        tags TEXT[],
        assigned_to TEXT[],
        notes TEXT,
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      );

      -- Tasks table
      CREATE TABLE IF NOT EXISTS "${schemaName}".tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR NOT NULL,
        description TEXT,
        project_id UUID,
        project_title VARCHAR,
        client_id UUID,
        client_name VARCHAR,
        assigned_to VARCHAR,
        status VARCHAR DEFAULT 'not_started',
        priority VARCHAR DEFAULT 'medium',
        progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        start_date DATE,
        end_date DATE,
        completed_at TIMESTAMP,
        estimated_hours DECIMAL(5,2),
        actual_hours DECIMAL(5,2),
        tags TEXT[],
        notes TEXT,
        subtasks JSONB DEFAULT '[]',
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      );

      -- Transactions table (Cash Flow)
      CREATE TABLE IF NOT EXISTS "${schemaName}".transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR CHECK (type IN ('income', 'expense')),
        amount DECIMAL(15,2) NOT NULL,
        category_id VARCHAR,
        category VARCHAR,
        description TEXT NOT NULL,
        date DATE NOT NULL,
        payment_method VARCHAR,
        status VARCHAR DEFAULT 'confirmed',
        project_id UUID,
        project_title VARCHAR,
        client_id UUID,
        client_name VARCHAR,
        tags TEXT[],
        notes TEXT,
        is_recurring BOOLEAN DEFAULT false,
        recurring_frequency VARCHAR,
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      );

      -- Invoices table (Billing)
      CREATE TABLE IF NOT EXISTS "${schemaName}".invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        number VARCHAR UNIQUE NOT NULL,
        title VARCHAR NOT NULL,
        description TEXT,
        client_id UUID,
        client_name VARCHAR,
        client_email VARCHAR,
        client_phone VARCHAR,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR DEFAULT 'BRL',
        status VARCHAR DEFAULT 'draft',
        due_date DATE,
        paid_at TIMESTAMP,
        payment_method VARCHAR,
        items JSONB DEFAULT '[]',
        tags TEXT[],
        notes TEXT,
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      );

      -- Publications table (isolated by user)
      CREATE TABLE IF NOT EXISTS "${schemaName}".publications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        oab_number VARCHAR,
        process_number VARCHAR,
        publication_date DATE,
        content TEXT,
        source VARCHAR,
        external_id VARCHAR,
        status VARCHAR DEFAULT 'nova',
        urgency VARCHAR DEFAULT 'media',
        responsible VARCHAR,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, external_id)
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_clients_created_by ON "${schemaName}".clients(created_by);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_projects_client_id ON "${schemaName}".projects(client_id);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_tasks_project_id ON "${schemaName}".tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_tasks_assigned_to ON "${schemaName}".tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_transactions_date ON "${schemaName}".transactions(date);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_publications_user_id ON "${schemaName}".publications(user_id);
    `;

    await prisma.$executeRawUnsafe(createTablesSQL);
  }

  async getTenantDatabase(tenantId: string): Promise<TenantDatabase> {
    // Verify tenant exists and is active
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || !tenant.isActive) {
      throw new Error('Tenant not found or inactive');
    }

    return new TenantDatabase(tenantId);
  }

  async validateTenantAccess(resourceTenantId: string, userTenantId: string) {
    if (resourceTenantId !== userTenantId) {
      // Log critical security violation
      await prisma.systemLog.create({
        data: {
          tenantId: userTenantId,
          level: 'critical',
          message: 'Cross-tenant access attempt detected',
          metadata: {
            attempted_tenant: resourceTenantId,
            user_tenant: userTenantId,
            timestamp: new Date(),
          },
        },
      });

      throw new Error('Cross-tenant access denied');
    }
  }

  async getTenantUsers(tenantId: string) {
    return await prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        accountType: true,
        lastLogin: true,
        createdAt: true,
      },
    });
  }

  async updateTenantSettings(tenantId: string, settings: any) {
    return await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...settings,
        updatedAt: new Date(),
      },
    });
  }
}

export const tenantService = new TenantService();