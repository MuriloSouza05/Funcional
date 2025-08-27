import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { tenantService } from '../services/tenantService';

// Validation schemas
const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional(),
  phone: z.string().min(1, 'Phone is required'),
  organization: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  budget: z.number().min(0).optional(),
  currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
  status: z.string().default('active'),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const updateClientSchema = createClientSchema.partial();

export class ClientsController {
  async getClients(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);
      
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string;
      const status = req.query.status as string;
      const offset = (page - 1) * limit;

      // Build where conditions
      let whereConditions = ['is_active = true'];
      const params: any[] = [];

      if (search) {
        whereConditions.push(`(name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
        params.push(`%${search}%`);
      }

      if (status && status !== 'all') {
        whereConditions.push(`status = $${params.length + 1}`);
        params.push(status);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get clients with pagination
      const clients = await tenantDb.query(`
        SELECT 
          id, name, email, phone, organization, address, budget, currency,
          status, tags, notes, created_by, created_at, updated_at
        FROM \${schema}.clients 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, params);

      // Get total count
      const totalResult = await tenantDb.query(`
        SELECT COUNT(*) as total
        FROM \${schema}.clients 
        ${whereClause}
      `, params);

      const total = parseInt(totalResult[0]?.total || 0);
      const totalPages = Math.ceil(total / limit);

      res.json({
        clients,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      console.error('Get clients error:', error);
      res.status(500).json({
        error: 'Failed to fetch clients',
        details: error.message,
      });
    }
  }

  async getClient(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const client = await tenantDb.findById('clients', id);

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Get related projects and tasks
      const projects = await tenantDb.query(`
        SELECT id, title, status, budget, created_at
        FROM \${schema}.projects 
        WHERE client_id = $1 AND is_active = true
        ORDER BY created_at DESC
      `, [id]);

      const tasks = await tenantDb.query(`
        SELECT id, title, status, priority, due_date, created_at
        FROM \${schema}.tasks 
        WHERE client_id = $1 AND is_active = true
        ORDER BY created_at DESC
      `, [id]);

      res.json({
        client,
        related: {
          projects,
          tasks,
        },
      });
    } catch (error) {
      console.error('Get client error:', error);
      res.status(500).json({
        error: 'Failed to fetch client',
        details: error.message,
      });
    }
  }

  async createClient(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validatedData = createClientSchema.parse(req.body);
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const client = await tenantDb.create('clients', {
        ...validatedData,
        address: validatedData.address ? JSON.stringify(validatedData.address) : null,
        tags: `{${validatedData.tags.join(',')}}`,
        created_by: req.user.id,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
      });

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'clients', client.id, 'CREATE', null, client);

      res.status(201).json({
        message: 'Client created successfully',
        client,
      });
    } catch (error) {
      console.error('Create client error:', error);
      res.status(400).json({
        error: 'Failed to create client',
        details: error.message,
      });
    }
  }

  async updateClient(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const validatedData = updateClientSchema.parse(req.body);
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Get current client data for audit
      const oldClient = await tenantDb.findById('clients', id);
      if (!oldClient) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Prepare update data
      const updateData: any = { ...validatedData };
      if (updateData.address) {
        updateData.address = JSON.stringify(updateData.address);
      }
      if (updateData.tags) {
        updateData.tags = `{${updateData.tags.join(',')}}`;
      }

      const updatedClient = await tenantDb.update('clients', id, updateData);

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'clients', id, 'UPDATE', oldClient, updatedClient);

      res.json({
        message: 'Client updated successfully',
        client: updatedClient,
      });
    } catch (error) {
      console.error('Update client error:', error);
      res.status(400).json({
        error: 'Failed to update client',
        details: error.message,
      });
    }
  }

  async deleteClient(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Get client data for audit
      const client = await tenantDb.findById('clients', id);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Soft delete (set is_active to false)
      await tenantDb.update('clients', id, { is_active: false });

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'clients', id, 'DELETE', client, null);

      res.json({
        message: 'Client deleted successfully',
      });
    } catch (error) {
      console.error('Delete client error:', error);
      res.status(500).json({
        error: 'Failed to delete client',
        details: error.message,
      });
    }
  }

  private async logAuditTrail(
    userId: string,
    tenantId: string,
    tableName: string,
    recordId: string,
    operation: string,
    oldData: any,
    newData: any
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          tenantId,
          tableName,
          recordId,
          operation,
          oldData: oldData || undefined,
          newData: newData || undefined,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Audit log error:', error);
      // Don't fail the main operation if audit logging fails
    }
  }
}

export const clientsController = new ClientsController();