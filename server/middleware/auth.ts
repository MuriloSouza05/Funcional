import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../config/database';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  accountType: 'simples' | 'composta' | 'gerencial';
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  tenantId: string;
  tenantSchema: string;
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

export const authenticateToken: RequestHandler = async (req: any, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso necessário' });
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any;

    // Buscar usuário atualizado
    const { data: user, error } = await supabaseAdmin
      .schema('admin')
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user || !user.is_active) {
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    }

    // Adicionar informações do usuário à requisição
    req.user = {
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      name: user.name,
      accountType: user.account_type,
    };
    req.tenantId = user.tenant_id;
    req.tenantSchema = `tenant_${user.tenant_id.replace(/-/g, '')}`;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        error: 'Token expirado', 
        code: 'TOKEN_EXPIRED' 
      });
    }
    return res.status(403).json({ error: 'Token inválido' });
  }
};

export const requireAccountType = (allowedTypes: string[]): RequestHandler => {
  return (req: any, res, next) => {
    const userAccountType = req.user.accountType;

    if (!allowedTypes.includes(userAccountType)) {
      return res.status(403).json({
        error: 'Acesso negado',
        required: allowedTypes,
        current: userAccountType,
        message: `Apenas contas ${allowedTypes.join(', ')} têm acesso a esta funcionalidade`
      });
    }

    next();
  };
};

export class AuthService {
  static async generateTokens(user: any) {
    const payload = {
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      accountType: user.account_type,
    };

    const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Salvar refresh token no banco (com hash para segurança)
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await supabaseAdmin
      .schema('admin')
      .from('refresh_tokens')
      .insert({
        user_id: user.id,
        token_hash: hashedRefreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      });

    return { accessToken, refreshToken };
  }

  static async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;

      // Verificar se refresh token existe no banco
      const { data: storedTokens } = await supabaseAdmin
        .schema('admin')
        .from('refresh_tokens')
        .select('*')
        .eq('user_id', decoded.userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      if (!storedTokens || storedTokens.length === 0) {
        throw new Error('Refresh token inválido');
      }

      // Validar hash do token
      let validToken = null;
      for (const stored of storedTokens) {
        const isValid = await bcrypt.compare(refreshToken, stored.token_hash);
        if (isValid) {
          validToken = stored;
          break;
        }
      }

      if (!validToken) {
        throw new Error('Refresh token inválido');
      }

      // Invalidar o refresh token usado (rotação)
      await supabaseAdmin
        .schema('admin')
        .from('refresh_tokens')
        .update({ is_active: false })
        .eq('id', validToken.id);

      // Buscar usuário atualizado
      const { data: user, error } = await supabaseAdmin
        .schema('admin')
        .from('users')
        .select('*')
        .eq('id', decoded.userId)
        .single();

      if (error || !user || !user.is_active) {
        throw new Error('Usuário inativo');
      }

      // Gerar novos tokens
      return await this.generateTokens(user);
    } catch (error) {
      // Em caso de erro, invalidar todos os refresh tokens do usuário
      if ((error as any).userId) {
        await supabaseAdmin
          .schema('admin')
          .from('refresh_tokens')
          .update({ is_active: false })
          .eq('user_id', (error as any).userId);
      }
      throw new Error('Refresh token inválido');
    }
  }

  static async login(email: string, password: string) {
    const { data: user, error } = await supabaseAdmin
      .schema('admin')
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      throw new Error('Email ou senha incorretos');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Email ou senha incorretos');
    }

    // Atualizar último login
    await supabaseAdmin
      .schema('admin')
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    return await this.generateTokens(user);
  }
}