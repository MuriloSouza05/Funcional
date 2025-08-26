import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { ProjectService } from '../services/ProjectService';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const projectService = new ProjectService(req.user);
    const projects = await projectService.getAll(req.query);

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      error: 'Erro ao buscar projetos'
    });
  }
});

router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const projectService = new ProjectService(req.user);
    const stats = await projectService.getStats();

    res.json(stats);
  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({
      error: 'Erro ao buscar estatísticas de projetos'
    });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const projectService = new ProjectService(req.user);
    const project = await projectService.getById(req.params.id);

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(404).json({
      error: 'Projeto não encontrado'
    });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const projectService = new ProjectService(req.user);
    const project = await projectService.create(req.body);

    res.status(201).json({
      message: 'Projeto criado com sucesso',
      project
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(400).json({
      error: 'Erro ao criar projeto'
    });
  }
});

router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const projectService = new ProjectService(req.user);
    const project = await projectService.update(req.params.id, req.body);

    res.json({
      message: 'Projeto atualizado com sucesso',
      project
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(400).json({
      error: 'Erro ao atualizar projeto'
    });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const projectService = new ProjectService(req.user);
    await projectService.delete(req.params.id);

    res.json({
      message: 'Projeto excluído com sucesso'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(400).json({
      error: 'Erro ao excluir projeto'
    });
  }
});

export default router;