import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest, requireAccountType } from '../middleware/auth';
import { CashFlowService } from '../services/CashFlowService';

const router = Router();

// Apenas Conta Composta e Gerencial têm acesso ao fluxo de caixa
router.get('/', 
  authenticateToken, 
  requireAccountType(['composta', 'gerencial']), 
  async (req: AuthenticatedRequest, res) => {
    try {
      const cashFlowService = new CashFlowService(req.user);
      const transactions = await cashFlowService.getAll(req.query);

      res.json(transactions);
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({
        error: 'Erro ao buscar transações'
      });
    }
  }
);

router.get('/stats', 
  authenticateToken, 
  async (req: AuthenticatedRequest, res) => {
    try {
      const cashFlowService = new CashFlowService(req.user);
      const stats = await cashFlowService.getFinancialStats();

      res.json(stats);
    } catch (error) {
      console.error('Get financial stats error:', error);
      res.status(500).json({
        error: 'Erro ao buscar estatísticas financeiras'
      });
    }
  }
);

router.get('/export', 
  authenticateToken, 
  requireAccountType(['composta', 'gerencial']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const cashFlowService = new CashFlowService(req.user);
      const csv = await cashFlowService.exportCSV(req.query);

      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=fluxo_caixa_${new Date().toISOString().split('T')[0]}.csv`
      });
      
      res.send(csv);
    } catch (error) {
      console.error('Export CSV error:', error);
      res.status(500).json({
        error: 'Erro ao exportar relatório'
      });
    }
  }
);

router.get('/:id', 
  authenticateToken, 
  requireAccountType(['composta', 'gerencial']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const cashFlowService = new CashFlowService(req.user);
      const transaction = await cashFlowService.getById(req.params.id);

      res.json(transaction);
    } catch (error) {
      console.error('Get transaction error:', error);
      res.status(404).json({
        error: 'Transação não encontrada'
      });
    }
  }
);

router.post('/', 
  authenticateToken, 
  requireAccountType(['composta', 'gerencial']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const cashFlowService = new CashFlowService(req.user);
      const transaction = await cashFlowService.create(req.body);

      res.status(201).json({
        message: 'Transação criada com sucesso',
        transaction
      });
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(400).json({
        error: 'Erro ao criar transação'
      });
    }
  }
);

router.put('/:id', 
  authenticateToken, 
  requireAccountType(['composta', 'gerencial']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const cashFlowService = new CashFlowService(req.user);
      const transaction = await cashFlowService.update(req.params.id, req.body);

      res.json({
        message: 'Transação atualizada com sucesso',
        transaction
      });
    } catch (error) {
      console.error('Update transaction error:', error);
      res.status(400).json({
        error: 'Erro ao atualizar transação'
      });
    }
  }
);

router.delete('/:id', 
  authenticateToken, 
  requireAccountType(['composta', 'gerencial']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const cashFlowService = new CashFlowService(req.user);
      await cashFlowService.delete(req.params.id);

      res.json({
        message: 'Transação excluída com sucesso'
      });
    } catch (error) {
      console.error('Delete transaction error:', error);
      res.status(400).json({
        error: 'Erro ao excluir transação'
      });
    }
  }
);

export default router;