import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { TaskService } from '../services/TaskService';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taskService = new TaskService(req.user);
    const tasks = await taskService.getAll(req.query);

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      error: 'Erro ao buscar tarefas'
    });
  }
});

router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taskService = new TaskService(req.user);
    const stats = await taskService.getStats();

    res.json(stats);
  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({
      error: 'Erro ao buscar estatísticas de tarefas'
    });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taskService = new TaskService(req.user);
    const task = await taskService.getById(req.params.id);

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(404).json({
      error: 'Tarefa não encontrada'
    });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taskService = new TaskService(req.user);
    const task = await taskService.create(req.body);

    res.status(201).json({
      message: 'Tarefa criada com sucesso',
      task
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(400).json({
      error: 'Erro ao criar tarefa'
    });
  }
});

router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taskService = new TaskService(req.user);
    const task = await taskService.update(req.params.id, req.body);

    res.json({
      message: 'Tarefa atualizada com sucesso',
      task
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(400).json({
      error: 'Erro ao atualizar tarefa'
    });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const taskService = new TaskService(req.user);
    await taskService.delete(req.params.id);

    res.json({
      message: 'Tarefa excluída com sucesso'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(400).json({
      error: 'Erro ao excluir tarefa'
    });
  }
});

export default router;