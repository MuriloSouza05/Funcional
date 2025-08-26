import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { PublicationService } from '../services/PublicationService';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const publicationService = new PublicationService(req.user);
    const publications = await publicationService.getAll(req.query);

    res.json(publications);
  } catch (error) {
    console.error('Get publications error:', error);
    res.status(500).json({
      error: 'Erro ao buscar publicações'
    });
  }
});

router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const publicationService = new PublicationService(req.user);
    const stats = await publicationService.getStats();

    res.json(stats);
  } catch (error) {
    console.error('Get publication stats error:', error);
    res.status(500).json({
      error: 'Erro ao buscar estatísticas de publicações'
    });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const publicationService = new PublicationService(req.user);
    const publication = await publicationService.getById(req.params.id);

    res.json(publication);
  } catch (error) {
    console.error('Get publication error:', error);
    res.status(404).json({
      error: 'Publicação não encontrada'
    });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const publicationService = new PublicationService(req.user);
    const publication = await publicationService.create(req.body);

    res.status(201).json({
      message: 'Publicação criada com sucesso',
      publication
    });
  } catch (error) {
    console.error('Create publication error:', error);
    res.status(400).json({
      error: 'Erro ao criar publicação'
    });
  }
});

router.patch('/:id/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, observacoes } = req.body;
    const publicationService = new PublicationService(req.user);
    const publication = await publicationService.updateStatus(req.params.id, status, observacoes);

    res.json({
      message: 'Status da publicação atualizado',
      publication
    });
  } catch (error) {
    console.error('Update publication status error:', error);
    res.status(400).json({
      error: 'Erro ao atualizar status da publicação'
    });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const publicationService = new PublicationService(req.user);
    await publicationService.delete(req.params.id);

    res.json({
      message: 'Publicação excluída com sucesso'
    });
  } catch (error) {
    console.error('Delete publication error:', error);
    res.status(400).json({
      error: 'Erro ao excluir publicação'
    });
  }
});

export default router;