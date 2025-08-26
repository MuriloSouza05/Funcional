import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { InvoiceService } from '../services/InvoiceService';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const invoiceService = new InvoiceService(req.user);
    const invoices = await invoiceService.getAll(req.query);

    res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      error: 'Erro ao buscar faturas'
    });
  }
});

router.get('/dashboard', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const invoiceService = new InvoiceService(req.user);
    const dashboard = await invoiceService.getDashboardStats();

    res.json(dashboard);
  } catch (error) {
    console.error('Get invoices dashboard error:', error);
    res.status(500).json({
      error: 'Erro ao buscar dashboard de recebíveis'
    });
  }
});

router.get('/clients', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const invoiceService = new InvoiceService(req.user);
    const clients = await invoiceService.getClients();

    res.json(clients);
  } catch (error) {
    console.error('Get invoice clients error:', error);
    res.status(500).json({
      error: 'Erro ao buscar clientes de recebíveis'
    });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const invoiceService = new InvoiceService(req.user);
    const invoice = await invoiceService.getById(req.params.id);

    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(404).json({
      error: 'Fatura não encontrada'
    });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const invoiceService = new InvoiceService(req.user);
    const invoice = await invoiceService.create(req.body);

    res.status(201).json({
      message: 'Fatura criada com sucesso',
      invoice
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(400).json({
      error: 'Erro ao criar fatura'
    });
  }
});

router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const invoiceService = new InvoiceService(req.user);
    const invoice = await invoiceService.update(req.params.id, req.body);

    res.json({
      message: 'Fatura atualizada com sucesso',
      invoice
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(400).json({
      error: 'Erro ao atualizar fatura'
    });
  }
});

router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const invoiceService = new InvoiceService(req.user);
    await invoiceService.delete(req.params.id);

    res.json({
      message: 'Fatura excluída com sucesso'
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(400).json({
      error: 'Erro ao excluir fatura'
    });
  }
});

export default router;