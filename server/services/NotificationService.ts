import { BaseService } from './BaseService';

export class NotificationService extends BaseService {
  
  async getAll(userId?: string) {
    this.requirePermission('read', 'notifications');

    const results = await this.query(`
      SELECT * FROM \${schema}.notifications 
      WHERE user_id IS NULL OR user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId || this.user.id]);

    return results.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      time: this.formatTimeAgo(notification.created_at),
      read: notification.read,
      createdBy: notification.created_by,
      createdAt: notification.created_at,
      details: notification.details,
      category: notification.category,
      actionData: notification.action_data ? JSON.parse(notification.action_data) : null
    }));
  }

  async markAsRead(id: string) {
    this.requirePermission('write', 'notifications');

    await this.query(`
      UPDATE \${schema}.notifications 
      SET read = true, updated_at = NOW()
      WHERE id = $1 AND (user_id IS NULL OR user_id = $2)
    `, [id, this.user.id]);
  }

  async markAllAsRead(userId?: string) {
    this.requirePermission('write', 'notifications');

    await this.query(`
      UPDATE \${schema}.notifications 
      SET read = true, updated_at = NOW()
      WHERE (user_id IS NULL OR user_id = $1) AND read = false
    `, [userId || this.user.id]);
  }

  async delete(id: string) {
    this.requirePermission('write', 'notifications');

    await this.query(`
      DELETE FROM \${schema}.notifications 
      WHERE id = $1 AND (user_id IS NULL OR user_id = $2)
    `, [id, this.user.id]);
  }

  async getUnreadCount(userId?: string): Promise<number> {
    const results = await this.query(`
      SELECT COUNT(*) as count FROM \${schema}.notifications 
      WHERE (user_id IS NULL OR user_id = $1) AND read = false
    `, [userId || this.user.id]);

    return results[0]?.count || 0;
  }

  private formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Agora mesmo';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutos atrás`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} horas atrás`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} dias atrás`;
    
    return date.toLocaleDateString('pt-BR');
  }
}