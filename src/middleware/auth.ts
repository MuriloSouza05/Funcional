import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../config/database';
import { AccountType } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    accountType: AccountType;
    name: string;
  };
  tenantId?: string;
}

export interface JWTPayload {
  userId: string;
  tenantId: string;
  accountType: AccountType;
  email: string;
  name: string;
  type: 'access' | 'refresh';
}

export class AuthService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'access-secret';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  async generateTokens(user: any) {
    const payload: Omit<JWTPayload, 'type'> = {
      userId: user.id,
      tenantId: user.tenantId,
      accountType: user.accountType,
      email: user.email,
      name: user.name,
    };

    // Generate access token
    const accessToken = jwt.sign(
      { ...payload, type: 'access' },
      this.accessTokenSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      this.refreshTokenSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    // Store refresh token hash in database
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
        isActive: true,
      },
    });

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret) as JWTPayload;
      
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  async verifyRefreshToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret) as JWTPayload;
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Verify token exists in database
      const storedTokens = await prisma.refreshToken.findMany({
        where: {
          userId: decoded.userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      });

      // Check if any stored token matches
      let validToken = null;
      for (const stored of storedTokens) {
        const isValid = await bcrypt.compare(token, stored.tokenHash);
        if (isValid) {
          validToken = stored;
          break;
        }
      }

      if (!validToken) {
        throw new Error('Refresh token not found or invalid');
      }

      // Invalidate used refresh token (rotation)
      await prisma.refreshToken.update({
        where: { id: validToken.id },
        data: { isActive: false },
      });

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  async revokeAllTokens(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }
}

// Authentication middleware
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'AUTH_001' 
    });
  }

  try {
    const authService = new AuthService();
    const decoded = await authService.verifyAccessToken(token);

    // Verify user is still active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true },
    });

    if (!user || !user.isActive || !user.tenant.isActive) {
      return res.status(401).json({ 
        error: 'User or tenant inactive',
        code: 'AUTH_002' 
      });
    }

    // Add user info to request
    req.user = {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      accountType: user.accountType,
      name: user.name,
    };
    req.tenantId = user.tenantId;

    next();
  } catch (error) {
    return res.status(403).json({ 
      error: 'Invalid token',
      code: 'AUTH_003',
      details: error.message 
    });
  }
};

// Authorization middleware for account types
export const requireAccountType = (allowedTypes: AccountType[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedTypes.includes(req.user.accountType)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedTypes,
        current: req.user.accountType,
        code: 'AUTH_004',
      });
    }

    next();
  };
};

// Tenant isolation middleware
export const tenantMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenantId) {
    return res.status(403).json({ 
      error: 'Tenant not identified',
      code: 'TENANT_001' 
    });
  }

  next();
};

export const authService = new AuthService();