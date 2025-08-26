import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { BillingService } from '../services/BillingService';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const billingService = new BillingService(req.user);
    const documents = await billingService.getAll(req.query);

    res.json(documents);
  } catch (error) {
    console.error('Get billing documents error:', error);
    res.status(500).json({
      error: 'Erro ao buscar documentos de cobrança'
    });
  }
});

router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const billingService = new BillingService(req.user);
    const stats = await billingService.getStats();

    res.json(stats);
  } catch (error) {
    console.error('Get billing stats error:', error);
    res.status(500).json({
      error: 'Erro ao buscar estatísticas de cobrança'
    });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const billingService = new BillingService(req.user);
    const document = await billingService.getById(req.params.id);

    res.json(document);
  } catch (error) {
    console.error('Get billing document error:', error);
    res.status(404).json({
      error: 'Documento não encontrado'
    });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const billingService = new BillingService(req.user);
    const document = await billingService.create(req.body);

    res.status(201).json({
      message: 'Documento criado com sucesso',
      document
    });
  } catch (error) {
    console.error('Create billing document error:', error);
    res.status(400).json({
      error: 'Erro ao criar documento'
    });
  }
});

router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const billingService = new BillingService(req.user);
    const document = await billingService.update(req.params.id, req.body);

    res.json({
      message: 'Documento atualizado com sucesso',
      document
    });
  } catch (error) {
    console.error('Update billing document error:', error);
    res.status(400).json({
      error: 'Erro ao atualizar documento'
    });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const billingService = new BillingService(req.user);
    await billingService.delete(req.params.id);

    res.json({
      message: 'Documento excluído com sucesso'
    });
  } catch (error) {
    console.error('Delete billing document error:', error);
    res.status(400).json({
      error: 'Erro ao excluir documento'
    });
  }
});

export default router;