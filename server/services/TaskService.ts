import { BaseService } from './BaseService';
import { Task } from '../types/database';

export class TaskService extends BaseService {
  
  async getAll(filters?: any): Promise<Task[]> {
    this.requirePermission('read', 'tasks');

    let sql = `
      SELECT t.*, 
        p.title as project_title,
        c.name as client_name
      FROM \${schema}.tasks t
      LEFT JOIN \${schema}.projects p ON t.project_id = p.id
      LEFT JOIN \${schema}.clients c ON t.client_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.search) {
      sql += ` AND (t.title ILIKE $${params.length + 1} OR t.description ILIKE $${params.length + 1})`;
      params.push(`%${filters.search}%`);
    }

    if (filters?.status) {
      sql += ` AND t.status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters?.priority) {
      sql += ` AND t.priority = $${params.length + 1}`;
      params.push(filters.priority);
    }

    if (filters?.assigned_to) {
      sql += ` AND t.assigned_to = $${params.length + 1}`;
      params.push(filters.assigned_to);
    }

    sql += ` ORDER BY t.created_at DESC`;

    return await this.query(sql, params);
  }

  async getById(id: string): Promise<Task> {
    this.requirePermission('read', 'tasks');

    const results = await this.query(`
      SELECT t.*, 
        p.title as project_title,
        c.name as client_name
      FROM \${schema}.tasks t
      LEFT JOIN \${schema}.projects p ON t.project_id = p.id
      LEFT JOIN \${schema}.clients c ON t.client_id = c.id
      WHERE t.id = $1
    `, [id]);

    if (!results || results.length === 0) {
      throw new Error('Tarefa não encontrada');
    }

    return results[0];
  }

  async create(taskData: Partial<Task>): Promise<Task> {
    this.requirePermission('write', 'tasks');

    const {
      title, description, start_date, end_date, status, priority,
      assigned_to, project_id, client_id, tags, estimated_hours,
      actual_hours, progress, notes, subtasks
    } = taskData;

    // Se tem project_id, buscar dados do projeto
    let projectTitle = null;
    let clientName = null;

    if (project_id && project_id !== 'none') {
      const projectResults = await this.query(`
        SELECT p.title, c.name as client_name 
        FROM \${schema}.projects p
        LEFT JOIN \${schema}.clients c ON p.client_id = c.id
        WHERE p.id = $1
      `, [project_id]);
      
      if (projectResults.length > 0) {
        projectTitle = projectResults[0].title;
        clientName = projectResults[0].client_name;
      }
    }

    const results = await this.query(`
      INSERT INTO \${schema}.tasks (
        title, description, start_date, end_date, status, priority,
        assigned_to, project_id, project_title, client_id, client_name,
        tags, estimated_hours, actual_hours, progress, notes, subtasks,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        NOW(), NOW()
      ) RETURNING *
    `, [
      title, description, start_date, end_date, status || 'not_started',
      priority || 'medium', assigned_to, 
      project_id === 'none' ? null : project_id,
      projectTitle, client_id === 'none' ? null : client_id, clientName,
      JSON.stringify(tags || []), estimated_hours, actual_hours || 0,
      progress || 0, notes, JSON.stringify(subtasks || [])
    ]);

    const task = results[0];

    await this.auditLog('tasks', 'CREATE', task.id, null, task);

    await this.createNotification(
      'info',
      'Nova Tarefa Criada',
      `${this.user.name} criou a tarefa: ${task.title}`,
      'task',
      'task',
      task.id,
      { task_id: task.id, page: '/tarefas' }
    );

    return task;
  }

  async update(id: string, taskData: Partial<Task>): Promise<Task> {
    this.requirePermission('write', 'tasks');

    const oldTask = await this.getById(id);

    const {
      title, description, start_date, end_date, status, priority,
      assigned_to, project_id, client_id, tags, estimated_hours,
      actual_hours, progress, notes, subtasks
    } = taskData;

    const results = await this.query(`
      UPDATE \${schema}.tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        status = COALESCE($5, status),
        priority = COALESCE($6, priority),
        assigned_to = COALESCE($7, assigned_to),
        project_id = COALESCE($8, project_id),
        client_id = COALESCE($9, client_id),
        tags = COALESCE($10, tags),
        estimated_hours = COALESCE($11, estimated_hours),
        actual_hours = COALESCE($12, actual_hours),
        progress = COALESCE($13, progress),
        notes = COALESCE($14, notes),
        subtasks = COALESCE($15, subtasks),
        completed_at = CASE WHEN $5 = 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
      WHERE id = $16
      RETURNING *
    `, [
      title, description, start_date, end_date, status, priority,
      assigned_to, project_id === 'none' ? null : project_id,
      client_id === 'none' ? null : client_id, JSON.stringify(tags),
      estimated_hours, actual_hours, progress, notes, 
      JSON.stringify(subtasks), id
    ]);

    const task = results[0];

    await this.auditLog('tasks', 'UPDATE', id, oldTask, task);

    return task;
  }

  async delete(id: string): Promise<void> {
    this.requirePermission('write', 'tasks');

    const task = await this.getById(id);

    await this.query(`DELETE FROM \${schema}.tasks WHERE id = $1`, [id]);

    await this.auditLog('tasks', 'DELETE', id, task, null);
  }

  async getStats() {
    this.requirePermission('read', 'tasks');

    const [total, notStarted, inProgress, completed, overdue, avgCompletion] = await Promise.all([
      this.query(`SELECT COUNT(*) as count FROM \${schema}.tasks`),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.tasks WHERE status = 'not_started'`),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.tasks WHERE status = 'in_progress'`),
      this.query(`SELECT COUNT(*) as count FROM \${schema}.tasks WHERE status = 'completed'`),
      this.query(`
        SELECT COUNT(*) as count FROM \${schema}.tasks 
        WHERE end_date < NOW() AND status NOT IN ('completed', 'cancelled')
      `),
      this.query(`
        SELECT AVG(EXTRACT(DAY FROM (completed_at - created_at))) as avg_days
        FROM \${schema}.tasks
        WHERE status = 'completed' AND completed_at IS NOT NULL
        AND completed_at >= NOW() - INTERVAL '3 months'
      `)
    ]);

    const totalCount = total[0]?.count || 0;
    const completedCount = completed[0]?.count || 0;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      total: totalCount,
      notStarted: notStarted[0]?.count || 0,
      inProgress: inProgress[0]?.count || 0,
      completed: completedCount,
      overdue: overdue[0]?.count || 0,
      completionRate,
      averageCompletionTime: Math.round(avgCompletion[0]?.avg_days || 0)
    };
  }
}