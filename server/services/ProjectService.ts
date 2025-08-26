import { BaseService } from './BaseService';
import { Project } from '../types/database';

export class ProjectService extends BaseService {
  
  async getAll(filters?: any): Promise<Project[]> {
    this.requirePermission('read', 'projects');

    let sql = `
      SELECT * FROM \${schema}.projects 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.search) {
      sql += ` AND (title ILIKE $${params.length + 1} OR client_name ILIKE $${params.length + 1})`;
      params.push(`%${filters.search}%`);
    }

    if (filters?.status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters?.priority) {
      sql += ` AND priority = $${params.length + 1}`;
      params.push(filters.priority);
    }

    sql += ` ORDER BY created_at DESC`;

    return await this.query(sql, params);
  }

  async getById(id: string): Promise<Project> {
    this.requirePermission('read', 'projects');

    const results = await this.query(`
      SELECT * FROM \${schema}.projects WHERE id = $1
    `, [id]);

    if (!results || results.length === 0) {
      throw new Error('Projeto não encontrado');
    }

    return results[0];
  }

  async create(projectData: Partial<Project>): Promise<Project> {
    this.requirePermission('write', 'projects');

    const {
      title, description, client_name, client_id, organization,
      contacts, address, budget, currency, status, start_date,
      due_date, tags, assigned_to, priority, progress, notes
    } = projectData;

    const results = await this.query(`
      INSERT INTO \${schema}.projects (
        title, description, client_name, client_id, organization,
        contacts, address, budget, currency, status, start_date,
        due_date, tags, assigned_to, priority, progress, notes,
        created_by, created_at, updated_at, attachments
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, NOW(), NOW(), '[]'
      ) RETURNING *
    `, [
      title, description, client_name, client_id, organization,
      JSON.stringify(contacts || []), address, budget || 0,
      currency || 'BRL', status || 'contacted', start_date,
      due_date, JSON.stringify(tags || []), JSON.stringify(assigned_to || []),
      priority || 'medium', progress || 0, notes, this.user.name
    ]);

    const project = results[0];

    await this.auditLog('projects', 'CREATE', project.id, null, project);

    await this.createNotification(
      'info',
      'Novo Projeto Criado',
      `${this.user.name} criou o projeto: ${project.title}`,
      'project',
      'project',
      project.id,
      { project_id: project.id, page: '/projetos' }
    );

    return project;
  }

  async update(id: string, projectData: Partial<Project>): Promise<Project> {
    this.requirePermission('write', 'projects');

    const oldProject = await this.getById(id);

    const {
      title, description, client_name, organization, contacts,
      address, budget, currency, status, start_date, due_date,
      tags, assigned_to, priority, progress, notes
    } = projectData;

    const results = await this.query(`
      UPDATE \${schema}.projects SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        client_name = COALESCE($3, client_name),
        organization = COALESCE($4, organization),
        contacts = COALESCE($5, contacts),
        address = COALESCE($6, address),
        budget = COALESCE($7, budget),
        currency = COALESCE($8, currency),
        status = COALESCE($9, status),
        start_date = COALESCE($10, start_date),
        due_date = COALESCE($11, due_date),
        tags = COALESCE($12, tags),
        assigned_to = COALESCE($13, assigned_to),
        priority = COALESCE($14, priority),
        progress = COALESCE($15, progress),
        notes = COALESCE($16, notes),
        updated_at = NOW()
      WHERE id = $17
      RETURNING *
    `, [
      title, description, client_name, organization, 
      JSON.stringify(contacts), address, budget, currency,
      status, start_date, due_date, JSON.stringify(tags),
      JSON.stringify(assigned_to), priority, progress, notes, id
    ]);

    const project = results[0];

    await this.auditLog('projects', 'UPDATE', id, oldProject, project);

    await this.createNotification(
      'info',
      'Projeto Atualizado',
      `${this.user.name} editou o projeto: ${project.title}`,
      'project',
      'project',
      project.id,
      { project_id: project.id, page: '/projetos' }
    );

    return project;
  }

  async delete(id: string): Promise<void> {
    this.requirePermission('write', 'projects');

    const project = await this.getById(id);

    await this.query(`DELETE FROM \${schema}.projects WHERE id = $1`, [id]);

    await this.auditLog('projects', 'DELETE', id, project, null);

    await this.createNotification(
      'warning',
      'Projeto Excluído',
      `${this.user.name} excluiu o projeto: ${project.title}`,
      'project'
    );
  }

  async getStats() {
    this.requirePermission('read', 'projects');

    const [total, active, overdue, revenue, avgProgress] = await Promise.all([
      this.query(`SELECT COUNT(*) as count FROM \${schema}.projects`),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.projects WHERE status NOT IN ('won', 'lost')`),
      this.query(`
        SELECT COUNT(*) as count FROM \${schema}.projects 
        WHERE due_date < CURRENT_DATE AND status NOT IN ('won', 'lost')
      `),
      this.query(`
        SELECT SUM(budget) as total FROM \${schema}.projects 
        WHERE status = 'won' AND 
        updated_at >= DATE_TRUNC('month', NOW())
      `),
      this.query(`
        SELECT AVG(progress) as avg FROM \${schema}.projects 
        WHERE status NOT IN ('won', 'lost')
      `)
    ]);

    return {
      total: total[0]?.count || 0,
      active: active[0]?.count || 0,
      overdue: overdue[0]?.count || 0,
      revenue: revenue[0]?.total || 0,
      avgProgress: Math.round(avgProgress[0]?.avg || 0)
    };
  }
}