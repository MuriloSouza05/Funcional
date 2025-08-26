import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { DashboardService } from '../services/DashboardService';

const router = Router();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const dashboardService = new DashboardService(req.user);
    const dashboardData = await dashboardService.getDashboardData();

    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      error: 'Erro ao carregar dados do dashboard'
    });
  }
});

export default router;