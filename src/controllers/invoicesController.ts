import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { tenantService } from '../services/tenantService';

// Validation schemas
const createInvoiceSchema = z.object({
  number: z.string().min(1, 'Invoice number is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  clientId: z.string().optional(),
  clientName: z.string().min(1, 'Client name is required'),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than zero'),
  currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
  status: z.enum(['draft', 'sent', 'viewed', 'approved', 'rejected', 'pending', 'paid', 'overdue', 'cancelled']).default('draft'),
  dueDate: z.string().min(1, 'Due date is required'),
  items: z.array(z.object({
    id: z.string(),
    description: z.string(),
    quantity: z.number(),
    rate: z.number(),
    amount: z.number(),
    tax: z.number().optional(),
  })).default([]),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const updateInvoiceSchema = createInvoiceSchema.partial();

export class InvoicesController {
  async getInvoices(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Only COMPOSTA and GERENCIAL can access billing data
      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Billing data not available for this account type',
        });
      }

      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);
      
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string;
      const status = req.query.status as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const offset = (page - 1) * limit;

      // Build where conditions
      let whereConditions = ['is_active = true'];
      const params: any[] = [];

      if (search) {
        whereConditions.push(`(number ILIKE $${params.length + 1} OR title ILIKE $${params.length + 1} OR client_name ILIKE $${params.length + 1})`);
        params.push(`%${search}%`);
      }

      if (status && status !== 'all') {
        whereConditions.push(`status = $${params.length + 1}`);
        params.push(status);
      }

      if (startDate) {
        whereConditions.push(`due_date >= $${params.length + 1}`);
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push(`due_date <= $${params.length + 1}`);
        params.push(endDate);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get invoices with pagination
      const invoices = await tenantDb.query(`
        SELECT 
          id, number, title, description, client_id, client_name, client_email, client_phone,
          amount, currency, status, due_date, paid_at, payment_method,
          items, tags, notes, created_by, created_at, updated_at
        FROM \${schema}.invoices 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, params);

      // Get total count
      const totalResult = await tenantDb.query(`
        SELECT COUNT(*) as total
        FROM \${schema}.invoices 
        ${whereClause}
      `, params);

      const total = parseInt(totalResult[0]?.total || 0);
      const totalPages = Math.ceil(total / limit);

      // Process invoices data
      const processedInvoices = invoices.map(invoice => ({
        ...invoice,
        items: Array.isArray(invoice.items) ? invoice.items : [],
        tags: Array.isArray(invoice.tags) ? invoice.tags : [],
      }));

      res.json({
        invoices: processedInvoices,
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
      console.error('Get invoices error:', error);
      res.status(500).json({
        error: 'Failed to fetch invoices',
        details: error.message,
      });
    }
  }

  async getInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Billing data not available for this account type',
        });
      }

      const { id } = req.params;
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const invoice = await tenantDb.findById('invoices', id);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Process invoice data
      const processedInvoice = {
        ...invoice,
        items: Array.isArray(invoice.items) ? invoice.items : [],
        tags: Array.isArray(invoice.tags) ? invoice.tags : [],
      };

      res.json({ invoice: processedInvoice });
    } catch (error) {
      console.error('Get invoice error:', error);
      res.status(500).json({
        error: 'Failed to fetch invoice',
        details: error.message,
      });
    }
  }

  async createInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Billing operations not available for this account type',
        });
      }

      const validatedData = createInvoiceSchema.parse(req.body);
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const invoice = await tenantDb.create('invoices', {
        number: validatedData.number,
        title: validatedData.title,
        description: validatedData.description,
        client_id: validatedData.clientId,
        client_name: validatedData.clientName,
        client_email: validatedData.clientEmail,
        client_phone: validatedData.clientPhone,
        amount: validatedData.amount,
        currency: validatedData.currency,
        status: validatedData.status,
        due_date: new Date(validatedData.dueDate),
        items: JSON.stringify(validatedData.items),
        tags: `{${validatedData.tags.join(',')}}`,
        notes: validatedData.notes,
        created_by: req.user.id,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
      });

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'invoices', invoice.id, 'CREATE', null, invoice);

      res.status(201).json({
        message: 'Invoice created successfully',
        invoice: {
          ...invoice,
          items: validatedData.items,
          tags: validatedData.tags,
        },
      });
    } catch (error) {
      console.error('Create invoice error:', error);
      res.status(400).json({
        error: 'Failed to create invoice',
        details: error.message,
      });
    }
  }

  async updateInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Billing operations not available for this account type',
        });
      }

      const { id } = req.params;
      const validatedData = updateInvoiceSchema.parse(req.body);
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Get current invoice data for audit
      const oldInvoice = await tenantDb.findById('invoices', id);
      if (!oldInvoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Prepare update data
      const updateData: any = { ...validatedData };
      if (updateData.dueDate) {
        updateData.due_date = new Date(updateData.dueDate);
        delete updateData.dueDate;
      }
      if (updateData.items) {
        updateData.items = JSON.stringify(updateData.items);
      }
      if (updateData.tags) {
        updateData.tags = `{${updateData.tags.join(',')}}`;
      }

      // Set payment timestamp if status changed to paid
      if (updateData.status === 'paid' && oldInvoice.status !== 'paid') {
        updateData.paid_at = new Date();
      }

      const updatedInvoice = await tenantDb.update('invoices', id, updateData);

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'invoices', id, 'UPDATE', oldInvoice, updatedInvoice);

      res.json({
        message: 'Invoice updated successfully',
        invoice: updatedInvoice,
      });
    } catch (error) {
      console.error('Update invoice error:', error);
      res.status(400).json({
        error: 'Failed to update invoice',
        details: error.message,
      });
    }
  }

  async deleteInvoice(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Billing operations not available for this account type',
        });
      }

      const { id } = req.params;
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Get invoice data for audit
      const invoice = await tenantDb.findById('invoices', id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Soft delete (set is_active to false)
      await tenantDb.update('invoices', id, { is_active: false });

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'invoices', id, 'DELETE', invoice, null);

      res.json({
        message: 'Invoice deleted successfully',
      });
    } catch (error) {
      console.error('Delete invoice error:', error);
      res.status(500).json({
        error: 'Failed to delete invoice',
        details: error.message,
      });
    }
  }

  async getInvoiceStats(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.json({
          totalInvoices: 0,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          overdueAmount: 0,
        });
      }

      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const stats = await tenantDb.query(`
        SELECT 
          COUNT(*) as total_invoices,
          SUM(amount) as total_amount,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
          SUM(CASE WHEN status IN ('pending', 'sent', 'viewed') THEN amount ELSE 0 END) as pending_amount,
          SUM(CASE WHEN due_date < CURRENT_DATE AND status NOT IN ('paid', 'cancelled') THEN amount ELSE 0 END) as overdue_amount,
          COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
          COUNT(*) FILTER (WHERE status IN ('pending', 'sent', 'viewed')) as pending_count,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('paid', 'cancelled')) as overdue_count
        FROM \${schema}.invoices 
        WHERE is_active = true
      `);

      const statsData = stats[0] || {};

      res.json({
        totalInvoices: parseInt(statsData.total_invoices || 0),
        totalAmount: parseFloat(statsData.total_amount || 0),
        paidAmount: parseFloat(statsData.paid_amount || 0),
        pendingAmount: parseFloat(statsData.pending_amount || 0),
        overdueAmount: parseFloat(statsData.overdue_amount || 0),
        paidCount: parseInt(statsData.paid_count || 0),
        pendingCount: parseInt(statsData.pending_count || 0),
        overdueCount: parseInt(statsData.overdue_count || 0),
      });
    } catch (error) {
      console.error('Get invoice stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch invoice statistics',
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
    }
  }
}

export const invoicesController = new InvoicesController();