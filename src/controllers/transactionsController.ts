import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { tenantService } from '../services/tenantService';

// Validation schemas
const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().min(0.01, 'Amount must be greater than zero'),
  categoryId: z.string().min(1, 'Category is required'),
  category: z.string().min(1, 'Category name is required'),
  description: z.string().min(1, 'Description is required'),
  date: z.string().min(1, 'Date is required'),
  paymentMethod: z.enum(['pix', 'credit_card', 'debit_card', 'bank_transfer', 'boleto', 'cash', 'check']).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).default('confirmed'),
  projectId: z.string().optional(),
  projectTitle: z.string().optional(),
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
});

const updateTransactionSchema = createTransactionSchema.partial();

export class TransactionsController {
  async getTransactions(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Only COMPOSTA and GERENCIAL can access financial data
      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Financial data not available for this account type',
        });
      }

      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);
      
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string;
      const type = req.query.type as string;
      const status = req.query.status as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const offset = (page - 1) * limit;

      // Build where conditions
      let whereConditions = ['is_active = true'];
      const params: any[] = [];

      if (search) {
        whereConditions.push(`(description ILIKE $${params.length + 1} OR category ILIKE $${params.length + 1})`);
        params.push(`%${search}%`);
      }

      if (type && type !== 'all') {
        whereConditions.push(`type = $${params.length + 1}`);
        params.push(type);
      }

      if (status && status !== 'all') {
        whereConditions.push(`status = $${params.length + 1}`);
        params.push(status);
      }

      if (startDate) {
        whereConditions.push(`date >= $${params.length + 1}`);
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push(`date <= $${params.length + 1}`);
        params.push(endDate);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get transactions with pagination
      const transactions = await tenantDb.query(`
        SELECT 
          id, type, amount, category_id, category, description, date,
          payment_method, status, project_id, project_title, client_id, client_name,
          tags, notes, is_recurring, recurring_frequency,
          created_by, created_at, updated_at
        FROM \${schema}.transactions 
        ${whereClause}
        ORDER BY date DESC, created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, params);

      // Get total count
      const totalResult = await tenantDb.query(`
        SELECT COUNT(*) as total
        FROM \${schema}.transactions 
        ${whereClause}
      `, params);

      const total = parseInt(totalResult[0]?.total || 0);
      const totalPages = Math.ceil(total / limit);

      // Process transactions data
      const processedTransactions = transactions.map(transaction => ({
        ...transaction,
        tags: Array.isArray(transaction.tags) ? transaction.tags : [],
      }));

      res.json({
        transactions: processedTransactions,
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
      console.error('Get transactions error:', error);
      res.status(500).json({
        error: 'Failed to fetch transactions',
        details: error.message,
      });
    }
  }

  async getTransaction(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Financial data not available for this account type',
        });
      }

      const { id } = req.params;
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const transaction = await tenantDb.findById('transactions', id);

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Process transaction data
      const processedTransaction = {
        ...transaction,
        tags: Array.isArray(transaction.tags) ? transaction.tags : [],
      };

      res.json({ transaction: processedTransaction });
    } catch (error) {
      console.error('Get transaction error:', error);
      res.status(500).json({
        error: 'Failed to fetch transaction',
        details: error.message,
      });
    }
  }

  async createTransaction(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Financial operations not available for this account type',
        });
      }

      const validatedData = createTransactionSchema.parse(req.body);
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const transaction = await tenantDb.create('transactions', {
        type: validatedData.type,
        amount: validatedData.amount,
        category_id: validatedData.categoryId,
        category: validatedData.category,
        description: validatedData.description,
        date: new Date(validatedData.date),
        payment_method: validatedData.paymentMethod,
        status: validatedData.status,
        project_id: validatedData.projectId,
        project_title: validatedData.projectTitle,
        client_id: validatedData.clientId,
        client_name: validatedData.clientName,
        tags: `{${validatedData.tags.join(',')}}`,
        notes: validatedData.notes,
        is_recurring: validatedData.isRecurring,
        recurring_frequency: validatedData.recurringFrequency,
        created_by: req.user.id,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
      });

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'transactions', transaction.id, 'CREATE', null, transaction);

      res.status(201).json({
        message: 'Transaction created successfully',
        transaction: {
          ...transaction,
          tags: validatedData.tags,
        },
      });
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(400).json({
        error: 'Failed to create transaction',
        details: error.message,
      });
    }
  }

  async updateTransaction(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Financial operations not available for this account type',
        });
      }

      const { id } = req.params;
      const validatedData = updateTransactionSchema.parse(req.body);
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Get current transaction data for audit
      const oldTransaction = await tenantDb.findById('transactions', id);
      if (!oldTransaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Prepare update data
      const updateData: any = { ...validatedData };
      if (updateData.date) {
        updateData.date = new Date(updateData.date);
      }
      if (updateData.tags) {
        updateData.tags = `{${updateData.tags.join(',')}}`;
      }

      const updatedTransaction = await tenantDb.update('transactions', id, updateData);

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'transactions', id, 'UPDATE', oldTransaction, updatedTransaction);

      res.json({
        message: 'Transaction updated successfully',
        transaction: updatedTransaction,
      });
    } catch (error) {
      console.error('Update transaction error:', error);
      res.status(400).json({
        error: 'Failed to update transaction',
        details: error.message,
      });
    }
  }

  async deleteTransaction(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.accountType === 'SIMPLES') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Financial operations not available for this account type',
        });
      }

      const { id } = req.params;
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Get transaction data for audit
      const transaction = await tenantDb.findById('transactions', id);
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Soft delete (set is_active to false)
      await tenantDb.update('transactions', id, { is_active: false });

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'transactions', id, 'DELETE', transaction, null);

      res.json({
        message: 'Transaction deleted successfully',
      });
    } catch (error) {
      console.error('Delete transaction error:', error);
      res.status(500).json({
        error: 'Failed to delete transaction',
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

export const transactionsController = new TransactionsController();