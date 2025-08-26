import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { ClientService } from '../services/ClientService';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const clientService = new ClientService(req.user);
    const clients = await clientService.getAll(req.query);

    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      error: 'Erro ao buscar clientes'
    });
  }
});

router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const clientService = new ClientService(req.user);
    const stats = await clientService.getStats();

    res.json(stats);
  } catch (error) {
    console.error('Get client stats error:', error);
    res.status(500).json({
      error: 'Erro ao buscar estatísticas de clientes'
    });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const clientService = new ClientService(req.user);
    const client = await clientService.getById(req.params.id);

    res.json(client);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(404).json({
      error: 'Cliente não encontrado'
    });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const clientService = new ClientService(req.user);
    const client = await clientService.create(req.body);

    res.status(201).json({
      message: 'Cliente criado com sucesso',
      client
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(400).json({
      error: 'Erro ao criar cliente'
    });
  }
});

router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const clientService = new ClientService(req.user);
    const client = await clientService.update(req.params.id, req.body);

    res.json({
      message: 'Cliente atualizado com sucesso',
      client
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(400).json({
      error: 'Erro ao atualizar cliente'
    });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const clientService = new ClientService(req.user);
    await clientService.delete(req.params.id);

    res.json({
      message: 'Cliente excluído com sucesso'
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(400).json({
      error: 'Erro ao excluir cliente'
    });
  }
});

export default router;