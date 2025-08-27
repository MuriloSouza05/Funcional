import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { tenantService } from '../services/tenantService';

// Validation schemas
const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  projectId: z.string().optional(),
  projectTitle: z.string().optional(),
  clientId: z.string().optional(),
  clientName: z.string().optional(),
  assignedTo: z.string().min(1, 'Assigned to is required'),
  status: z.enum(['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled']).default('not_started'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  estimatedHours: z.number().min(0).optional(),
  actualHours: z.number().min(0).optional(),
  progress: z.number().min(0).max(100).default(0),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  subtasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
    createdAt: z.string(),
    completedAt: z.string().optional(),
  })).default([]),
});

const updateTaskSchema = createTaskSchema.partial();

export class TasksController {
  async getTasks(req: AuthenticatedRequest, res: Response) {
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
      const priority = req.query.priority as string;
      const assignedTo = req.query.assignedTo as string;
      const offset = (page - 1) * limit;

      // Build where conditions
      let whereConditions = ['is_active = true'];
      const params: any[] = [];

      if (search) {
        whereConditions.push(`(title ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`);
        params.push(`%${search}%`);
      }

      if (status && status !== 'all') {
        whereConditions.push(`status = $${params.length + 1}`);
        params.push(status);
      }

      if (priority && priority !== 'all') {
        whereConditions.push(`priority = $${params.length + 1}`);
        params.push(priority);
      }

      if (assignedTo && assignedTo !== 'all') {
        whereConditions.push(`assigned_to = $${params.length + 1}`);
        params.push(assignedTo);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get tasks with pagination
      const tasks = await tenantDb.query(`
        SELECT 
          id, title, description, project_id, project_title, client_id, client_name,
          assigned_to, status, priority, progress, start_date, end_date, completed_at,
          estimated_hours, actual_hours, tags, notes, subtasks,
          created_by, created_at, updated_at
        FROM \${schema}.tasks 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, params);

      // Get total count
      const totalResult = await tenantDb.query(`
        SELECT COUNT(*) as total
        FROM \${schema}.tasks 
        ${whereClause}
      `, params);

      const total = parseInt(totalResult[0]?.total || 0);
      const totalPages = Math.ceil(total / limit);

      // Process tasks data
      const processedTasks = tasks.map(task => ({
        ...task,
        tags: Array.isArray(task.tags) ? task.tags : [],
        subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
        attachments: [], // Will be populated from file attachments in full implementation
      }));

      res.json({
        tasks: processedTasks,
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
      console.error('Get tasks error:', error);
      res.status(500).json({
        error: 'Failed to fetch tasks',
        details: error.message,
      });
    }
  }

  async getTask(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const task = await tenantDb.findById('tasks', id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Process task data
      const processedTask = {
        ...task,
        tags: Array.isArray(task.tags) ? task.tags : [],
        subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
        attachments: [], // Will be populated from file attachments
      };

      res.json({ task: processedTask });
    } catch (error) {
      console.error('Get task error:', error);
      res.status(500).json({
        error: 'Failed to fetch task',
        details: error.message,
      });
    }
  }

  async createTask(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validatedData = createTaskSchema.parse(req.body);
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const task = await tenantDb.create('tasks', {
        title: validatedData.title,
        description: validatedData.description,
        project_id: validatedData.projectId,
        project_title: validatedData.projectTitle,
        client_id: validatedData.clientId,
        client_name: validatedData.clientName,
        assigned_to: validatedData.assignedTo,
        status: validatedData.status,
        priority: validatedData.priority,
        progress: validatedData.progress,
        start_date: validatedData.startDate ? new Date(validatedData.startDate) : null,
        end_date: validatedData.endDate ? new Date(validatedData.endDate) : null,
        estimated_hours: validatedData.estimatedHours,
        actual_hours: validatedData.actualHours,
        tags: `{${validatedData.tags.join(',')}}`,
        notes: validatedData.notes,
        subtasks: JSON.stringify(validatedData.subtasks),
        created_by: req.user.id,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
      });

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'tasks', task.id, 'CREATE', null, task);

      res.status(201).json({
        message: 'Task created successfully',
        task: {
          ...task,
          tags: validatedData.tags,
          subtasks: validatedData.subtasks,
        },
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(400).json({
        error: 'Failed to create task',
        details: error.message,
      });
    }
  }

  async updateTask(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const validatedData = updateTaskSchema.parse(req.body);
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Get current task data for audit
      const oldTask = await tenantDb.findById('tasks', id);
      if (!oldTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Prepare update data
      const updateData: any = { ...validatedData };
      if (updateData.startDate) {
        updateData.start_date = new Date(updateData.startDate);
        delete updateData.startDate;
      }
      if (updateData.endDate) {
        updateData.end_date = new Date(updateData.endDate);
        delete updateData.endDate;
      }
      if (updateData.tags) {
        updateData.tags = `{${updateData.tags.join(',')}}`;
      }
      if (updateData.subtasks) {
        updateData.subtasks = JSON.stringify(updateData.subtasks);
      }
      if (updateData.assignedTo) {
        updateData.assigned_to = updateData.assignedTo;
        delete updateData.assignedTo;
      }

      // Set completion timestamp if status changed to completed
      if (updateData.status === 'completed' && oldTask.status !== 'completed') {
        updateData.completed_at = new Date();
        updateData.progress = 100;
      }

      const updatedTask = await tenantDb.update('tasks', id, updateData);

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'tasks', id, 'UPDATE', oldTask, updatedTask);

      res.json({
        message: 'Task updated successfully',
        task: updatedTask,
      });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(400).json({
        error: 'Failed to update task',
        details: error.message,
      });
    }
  }

  async deleteTask(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Get task data for audit
      const task = await tenantDb.findById('tasks', id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Soft delete (set is_active to false)
      await tenantDb.update('tasks', id, { is_active: false });

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'tasks', id, 'DELETE', task, null);

      res.json({
        message: 'Task deleted successfully',
      });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({
        error: 'Failed to delete task',
        details: error.message,
      });
    }
  }

  async getTaskStats(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const stats = await tenantDb.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'not_started') as not_started,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          COUNT(*) FILTER (WHERE end_date < NOW() AND status NOT IN ('completed', 'cancelled')) as overdue,
          AVG(progress) as avg_progress
        FROM \${schema}.tasks 
        WHERE is_active = true
      `);

      // Calculate completion rate
      const statsData = stats[0] || {};
      const total = parseInt(statsData.total || 0);
      const completed = parseInt(statsData.completed || 0);
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Calculate average completion time
      const completionTimeData = await tenantDb.query(`
        SELECT AVG(EXTRACT(DAY FROM (completed_at - created_at))) as avg_completion_days
        FROM \${schema}.tasks 
        WHERE status = 'completed'
          AND completed_at IS NOT NULL
          AND completed_at >= NOW() - INTERVAL '3 months'
          AND is_active = true
      `);

      const avgCompletionTime = Math.round(parseFloat(completionTimeData[0]?.avg_completion_days || 0));

      res.json({
        total,
        notStarted: parseInt(statsData.not_started || 0),
        inProgress: parseInt(statsData.in_progress || 0),
        completed,
        onHold: parseInt(statsData.on_hold || 0),
        cancelled: parseInt(statsData.cancelled || 0),
        overdue: parseInt(statsData.overdue || 0),
        completionRate,
        averageProgress: Math.round(parseFloat(statsData.avg_progress || 0)),
        averageCompletionTime: avgCompletionTime,
      });
    } catch (error) {
      console.error('Get task stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch task statistics',
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

export const tasksController = new TasksController();