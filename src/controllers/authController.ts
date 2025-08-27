import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../middleware/auth';
import { registrationKeyService } from '../services/registrationKeyService';
import { prisma } from '../config/database';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  key: z.string().min(1, 'Registration key is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      // Use registration key
      const keyResult = await registrationKeyService.validateAndUseKey({
        ...validatedData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Find the created user
      const user = await prisma.user.findUnique({
        where: { email: validatedData.email },
        include: { tenant: true },
      });

      if (!user) {
        throw new Error('User creation failed');
      }

      // Generate tokens
      const tokens = await authService.generateTokens(user);

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          accountType: user.accountType,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
        },
        tokens,
        isNewTenant: keyResult.isNewTenant,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({
        error: 'Registration failed',
        details: error.message,
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const validatedData = loginSchema.parse(req.body);

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: validatedData.email },
        include: { tenant: true },
      });

      if (!user || !user.isActive || !user.tenant.isActive) {
        return res.status(401).json({
          error: 'Invalid credentials or inactive account',
        });
      }

      // Verify password
      const isValidPassword = await authService.verifyPassword(
        validatedData.password,
        user.password
      );

      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
        });
      }

      // Generate tokens
      const tokens = await authService.generateTokens(user);

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          accountType: user.accountType,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
        },
        tokens,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({
        error: 'Login failed',
        details: error.message,
      });
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const validatedData = refreshSchema.parse(req.body);

      // Verify refresh token
      const decoded = await authService.verifyRefreshToken(validatedData.refreshToken);

      // Get updated user data
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { tenant: true },
      });

      if (!user || !user.isActive || !user.tenant.isActive) {
        return res.status(401).json({
          error: 'User or tenant inactive',
        });
      }

      // Generate new tokens
      const tokens = await authService.generateTokens(user);

      res.json({
        message: 'Tokens refreshed',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          accountType: user.accountType,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
        },
        tokens,
      });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(401).json({
        error: 'Token refresh failed',
        details: error.message,
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];

      if (token) {
        const decoded = await authService.verifyAccessToken(token);
        await authService.revokeAllTokens(decoded.userId);
      }

      res.json({ message: 'Logout successful' });
    } catch (error) {
      // Even if token verification fails, return success for logout
      res.json({ message: 'Logout successful' });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { tenant: true },
        select: {
          id: true,
          email: true,
          name: true,
          accountType: true,
          tenantId: true,
          lastLogin: true,
          createdAt: true,
          tenant: {
            select: {
              name: true,
              planType: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: 'Failed to get profile',
        details: error.message,
      });
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const updateData = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate update data
      const updateSchema = z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        currentPassword: z.string().optional(),
        newPassword: z.string().min(8).optional(),
      });

      const validatedData = updateSchema.parse(updateData);

      // If changing password, verify current password
      if (validatedData.newPassword) {
        if (!validatedData.currentPassword) {
          return res.status(400).json({
            error: 'Current password required to change password',
          });
        }

        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        const isValidPassword = await authService.verifyPassword(
          validatedData.currentPassword,
          user!.password
        );

        if (!isValidPassword) {
          return res.status(400).json({
            error: 'Current password is incorrect',
          });
        }

        // Hash new password
        validatedData.newPassword = await authService.hashPassword(validatedData.newPassword);
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(validatedData.name && { name: validatedData.name }),
          ...(validatedData.email && { email: validatedData.email }),
          ...(validatedData.newPassword && { password: validatedData.newPassword }),
          updatedAt: new Date(),
        },
        include: { tenant: true },
      });

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          accountType: updatedUser.accountType,
          tenantId: updatedUser.tenantId,
          tenantName: updatedUser.tenant.name,
        },
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(400).json({
        error: 'Failed to update profile',
        details: error.message,
      });
    }
  }
}

export const authController = new AuthController();