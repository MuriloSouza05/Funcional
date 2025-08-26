import { Router } from 'express';
import { AuthService } from '../services/AuthService';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email e senha são obrigatórios'
      });
    }

    const tokens = await AuthService.login(email, password);

    res.json({
      message: 'Login realizado com sucesso',
      user: {
        email,
      },
      tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      error: 'Email ou senha incorretos'
    });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token é obrigatório'
      });
    }

    const tokens = await AuthService.refreshAccessToken(refreshToken);

    res.json({
      message: 'Token renovado com sucesso',
      tokens
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      error: 'Refresh token inválido'
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    // In a real implementation, you would invalidate the refresh token
    res.json({
      message: 'Logout realizado com sucesso'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

export default router;