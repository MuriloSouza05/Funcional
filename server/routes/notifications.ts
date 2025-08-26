import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { NotificationService } from '../services/NotificationService';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const notificationService = new NotificationService(req.user);
    const notifications = await notificationService.getAll(req.query.user_id as string);

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      error: 'Erro ao buscar notificações'
    });
  }
});

router.get('/unread-count', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const notificationService = new NotificationService(req.user);
    const count = await notificationService.getUnreadCount(req.query.user_id as string);

    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      error: 'Erro ao buscar contagem de notificações'
    });
  }
});

router.patch('/:id/read', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const notificationService = new NotificationService(req.user);
    await notificationService.markAsRead(req.params.id);

    res.json({
      message: 'Notificação marcada como lida'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(400).json({
      error: 'Erro ao marcar notificação como lida'
    });
  }
});

router.patch('/mark-all-read', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const notificationService = new NotificationService(req.user);
    await notificationService.markAllAsRead(req.body.user_id);

    res.json({
      message: 'Todas as notificações foram marcadas como lidas'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(400).json({
      error: 'Erro ao marcar todas as notificações como lidas'
    });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const notificationService = new NotificationService(req.user);
    await notificationService.delete(req.params.id);

    res.json({
      message: 'Notificação excluída com sucesso'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(400).json({
      error: 'Erro ao excluir notificação'
    });
  }
});

export default router;