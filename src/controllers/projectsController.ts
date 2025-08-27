import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { tenantService } from '../services/tenantService';

// Validation schemas
const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  clientName: z.string().min(1, 'Client name is required'),
  clientId: z.string().optional(),
  organization: z.string().optional(),
  address: z.string().optional(),
  budget: z.number().min(0).optional(),
  currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
  status: z.enum(['contacted', 'proposal', 'won', 'lost']).default('contacted'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).default([]),
  assignedTo: z.array(z.string()).default([]),
  notes: z.string().optional(),
  contacts: z.array(z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    role: z.string(),
  })).default([]),
});

const updateProjectSchema = createProjectSchema.partial();

export class ProjectsController {
  async getProjects(req: AuthenticatedRequest, res: Response) {
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
      const offset = (page - 1) * limit;

      // Build where conditions
      let whereConditions = ['is_active = true'];
      const params: any[] = [];

      if (search) {
        whereConditions.push(`(title ILIKE $${params.length + 1} OR client_name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`);
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

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get projects with pagination
      const projects = await tenantDb.query(`
        SELECT 
          id, title, description, client_name, client_id, organization,
          address, budget, currency, status, priority, progress,
          start_date, due_date, completed_at, tags, assigned_to,
          notes, created_by, created_at, updated_at
        FROM \${schema}.projects 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `, params);

      // Get total count
      const totalResult = await tenantDb.query(`
        SELECT COUNT(*) as total
        FROM \${schema}.projects 
        ${whereClause}
      `, params);

      const total = parseInt(totalResult[0]?.total || 0);
      const totalPages = Math.ceil(total / limit);

      // Process projects data
      const processedProjects = projects.map(project => ({
        ...project,
        tags: Array.isArray(project.tags) ? project.tags : [],
        assignedTo: Array.isArray(project.assigned_to) ? project.assigned_to : [],
        contacts: [], // Will be populated from separate table in full implementation
      }));

      res.json({
        projects: processedProjects,
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
      console.error('Get projects error:', error);
      res.status(500).json({
        error: 'Failed to fetch projects',
        details: error.message,
      });
    }
  }

  async getProject(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const project = await tenantDb.findById('projects', id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get related tasks
      const tasks = await tenantDb.query(`
        SELECT id, title, status, priority, progress, due_date, assigned_to, created_at
        FROM \${schema}.tasks 
        WHERE project_id = $1 AND is_active = true
        ORDER BY created_at DESC
      `, [id]);

      // Process project data
      const processedProject = {
        ...project,
        tags: Array.isArray(project.tags) ? project.tags : [],
        assignedTo: Array.isArray(project.assigned_to) ? project.assigned_to : [],
        contacts: [], // Will be populated from separate table in full implementation
        tasks,
      };

      res.json({ project: processedProject });
    } catch (error) {
      console.error('Get project error:', error);
      res.status(500).json({
        error: 'Failed to fetch project',
        details: error.message,
      });
    }
  }

  async createProject(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validatedData = createProjectSchema.parse(req.body);
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      const project = await tenantDb.create('projects', {
        ...validatedData,
        start_date: validatedData.startDate ? new Date(validatedData.startDate) : null,
        due_date: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        tags: `{${validatedData.tags.join(',')}}`,
        assigned_to: `{${validatedData.assignedTo.join(',')}}`,
        created_by: req.user.id,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        progress: 0,
      });

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'projects', project.id, 'CREATE', null, project);

      res.status(201).json({
        message: 'Project created successfully',
        project: {
          ...project,
          tags: validatedData.tags,
          assignedTo: validatedData.assignedTo,
          contacts: validatedData.contacts,
        },
      });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(400).json({
        error: 'Failed to create project',
        details: error.message,
      });
    }
  }

  async updateProject(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const validatedData = updateProjectSchema.parse(req.body);
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Get current project data for audit
      const oldProject = await tenantDb.findById('projects', id);
      if (!oldProject) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Prepare update data
      const updateData: any = { ...validatedData };
      if (updateData.startDate) {
        updateData.start_date = new Date(updateData.startDate);
        delete updateData.startDate;
      }
      if (updateData.dueDate) {
        updateData.due_date = new Date(updateData.dueDate);
        delete updateData.dueDate;
      }
      if (updateData.tags) {
        updateData.tags = `{${updateData.tags.join(',')}}`;
      }
      if (updateData.assignedTo) {
        updateData.assigned_to = `{${updateData.assignedTo.join(',')}}`;
        delete updateData.assignedTo;
      }

      const updatedProject = await tenantDb.update('projects', id, updateData);

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'projects', id, 'UPDATE', oldProject, updatedProject);

      res.json({
        message: 'Project updated successfully',
        project: updatedProject,
      });
    } catch (error) {
      console.error('Update project error:', error);
      res.status(400).json({
        error: 'Failed to update project',
        details: error.message,
      });
    }
  }

  async deleteProject(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user || !req.tenantId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { id } = req.params;
      const tenantDb = await tenantService.getTenantDatabase(req.tenantId);

      // Get project data for audit
      const project = await tenantDb.findById('projects', id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Soft delete (set is_active to false)
      await tenantDb.update('projects', id, { is_active: false });

      // Also soft delete related tasks
      await tenantDb.query(`
        UPDATE \${schema}.tasks 
        SET is_active = false, updated_at = NOW()
        WHERE project_id = $1
      `, [id]);

      // Log audit trail
      await this.logAuditTrail(req.user.id, req.tenantId, 'projects', id, 'DELETE', project, null);

      res.json({
        message: 'Project deleted successfully',
      });
    } catch (error) {
      console.error('Delete project error:', error);
      res.status(500).json({
        error: 'Failed to delete project',
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

export const projectsController = new ProjectsController();