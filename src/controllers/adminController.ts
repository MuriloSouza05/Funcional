import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { registrationKeyService } from '../services/registrationKeyService';
import { tenantService } from '../services/tenantService';
import { AccountType } from '@prisma/client';

// Validation schemas
const createKeySchema = z.object({
  tenantId: z.string().optional(),
  accountType: z.enum(['SIMPLES', 'COMPOSTA', 'GERENCIAL']),
  usesAllowed: z.number().min(1).default(1),
  expiresAt: z.string().optional(),
  singleUse: z.boolean().default(true),
  metadata: z.any().optional(),
});

const createTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required'),
  planType: z.string().default('basic'),
  maxUsers: z.number().min(1).default(5),
  maxStorage: z.number().min(1).default(1073741824), // 1GB
});

export class AdminController {
  // Registration Keys Management
  async createRegistrationKey(req: Request, res: Response) {
    try {
      const validatedData = createKeySchema.parse(req.body);
      
      // For demo purposes, we'll allow this without authentication
      // In production, this should require admin authentication
      const createdBy = 'admin'; // req.user?.id || 'system'

      const key = await registrationKeyService.generateKey(
        {
          tenantId: validatedData.tenantId,
          accountType: validatedData.accountType,
          usesAllowed: validatedData.usesAllowed,
          expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : undefined,
          singleUse: validatedData.singleUse,
          metadata: validatedData.metadata,
        },
        createdBy
      );

      res.status(201).json({
        message: 'Registration key created successfully',
        key, // Return the plain key only once
        metadata: {
          accountType: validatedData.accountType,
          usesAllowed: validatedData.usesAllowed,
          singleUse: validatedData.singleUse,
          expiresAt: validatedData.expiresAt,
        },
      });
    } catch (error) {
      console.error('Create registration key error:', error);
      res.status(400).json({
        error: 'Failed to create registration key',
        details: error.message,
      });
    }
  }

  async getRegistrationKeys(req: Request, res: Response) {
    try {
      const tenantId = req.query.tenantId as string;
      const keys = await registrationKeyService.listKeys(tenantId);

      // Remove sensitive data
      const safeKeys = keys.map(key => ({
        id: key.id,
        accountType: key.accountType,
        usesAllowed: key.usesAllowed,
        usesLeft: key.usesLeft,
        singleUse: key.singleUse,
        expiresAt: key.expiresAt,
        revoked: key.revoked,
        createdAt: key.createdAt,
        tenant: key.tenant ? {
          id: key.tenant.id,
          name: key.tenant.name,
        } : null,
        usageCount: Array.isArray(key.usedLogs) ? key.usedLogs.length : 0,
      }));

      res.json({ keys: safeKeys });
    } catch (error) {
      console.error('Get registration keys error:', error);
      res.status(500).json({
        error: 'Failed to fetch registration keys',
        details: error.message,
      });
    }
  }

  async revokeRegistrationKey(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      await registrationKeyService.revokeKey(id);

      res.json({
        message: 'Registration key revoked successfully',
      });
    } catch (error) {
      console.error('Revoke registration key error:', error);
      res.status(400).json({
        error: 'Failed to revoke registration key',
        details: error.message,
      });
    }
  }

  // Tenant Management
  async getTenants(req: Request, res: Response) {
    try {
      const tenants = await prisma.tenant.findMany({
        include: {
          _count: {
            select: {
              users: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const tenantsWithStats = await Promise.all(
        tenants.map(async (tenant) => {
          // Get basic stats for each tenant
          try {
            const tenantDb = await tenantService.getTenantDatabase(tenant.id);
            const clientsCount = await tenantDb.count('clients', { is_active: true });
            const projectsCount = await tenantDb.count('projects', { is_active: true });
            const tasksCount = await tenantDb.count('tasks', { is_active: true });

            return {
              id: tenant.id,
              name: tenant.name,
              schemaName: tenant.schemaName,
              planType: tenant.planType,
              isActive: tenant.isActive,
              maxUsers: tenant.maxUsers,
              userCount: tenant._count.users,
              createdAt: tenant.createdAt,
              stats: {
                clients: clientsCount,
                projects: projectsCount,
                tasks: tasksCount,
              },
            };
          } catch (error) {
            return {
              id: tenant.id,
              name: tenant.name,
              schemaName: tenant.schemaName,
              planType: tenant.planType,
              isActive: tenant.isActive,
              maxUsers: tenant.maxUsers,
              userCount: tenant._count.users,
              createdAt: tenant.createdAt,
              stats: {
                clients: 0,
                projects: 0,
                tasks: 0,
              },
              error: 'Failed to load stats',
            };
          }
        })
      );

      res.json({ tenants: tenantsWithStats });
    } catch (error) {
      console.error('Get tenants error:', error);
      res.status(500).json({
        error: 'Failed to fetch tenants',
        details: error.message,
      });
    }
  }

  async createTenant(req: Request, res: Response) {
    try {
      const validatedData = createTenantSchema.parse(req.body);
      
      const tenantId = await tenantService.createTenant(validatedData.name);

      // Update tenant with additional settings
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          planType: validatedData.planType,
          maxUsers: validatedData.maxUsers,
          maxStorage: BigInt(validatedData.maxStorage),
        },
      });

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      res.status(201).json({
        message: 'Tenant created successfully',
        tenant,
      });
    } catch (error) {
      console.error('Create tenant error:', error);
      res.status(400).json({
        error: 'Failed to create tenant',
        details: error.message,
      });
    }
  }

  async deleteTenant(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Get tenant info
      const tenant = await prisma.tenant.findUnique({
        where: { id },
      });

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Drop tenant schema
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);

      // Delete tenant record (cascade will delete users and keys)
      await prisma.tenant.delete({
        where: { id },
      });

      res.json({
        message: 'Tenant deleted successfully',
      });
    } catch (error) {
      console.error('Delete tenant error:', error);
      res.status(500).json({
        error: 'Failed to delete tenant',
        details: error.message,
      });
    }
  }

  // Global Metrics
  async getGlobalMetrics(req: Request, res: Response) {
    try {
      // Get tenant statistics
      const tenantStats = await prisma.tenant.aggregate({
        _count: true,
        where: { isActive: true },
      });

      const userStats = await prisma.user.aggregate({
        _count: true,
        where: { isActive: true },
      });

      // Get registration key statistics
      const keyStats = await prisma.registrationKey.groupBy({
        by: ['accountType'],
        _count: true,
        where: { revoked: false },
      });

      // Get recent activity
      const recentLogs = await prisma.systemLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { tenant: true },
      });

      res.json({
        tenants: {
          total: tenantStats._count,
          active: tenantStats._count, // All counted tenants are active due to where clause
        },
        users: {
          total: userStats._count,
        },
        registrationKeys: keyStats.map(stat => ({
          accountType: stat.accountType,
          count: stat._count,
        })),
        recentActivity: recentLogs.map(log => ({
          id: log.id,
          level: log.level,
          message: log.message,
          tenantName: log.tenant?.name,
          createdAt: log.createdAt,
        })),
      });
    } catch (error) {
      console.error('Get global metrics error:', error);
      res.status(500).json({
        error: 'Failed to fetch global metrics',
        details: error.message,
      });
    }
  }
}

export const adminController = new AdminController();