import { prisma } from '../config/database';
import { AccountType } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export interface CreateKeyRequest {
  tenantId?: string;
  accountType: AccountType;
  usesAllowed?: number;
  expiresAt?: Date;
  singleUse?: boolean;
  metadata?: any;
}

export interface UseKeyRequest {
  key: string;
  email: string;
  password: string;
  name: string;
  ipAddress?: string;
  userAgent?: string;
}

export class RegistrationKeyService {
  async generateKey(request: CreateKeyRequest, createdBy: string): Promise<string> {
    // Generate random key
    const key = crypto.randomBytes(32).toString('hex');
    const keyHash = await bcrypt.hash(key, 12);

    // Create key record
    await prisma.registrationKey.create({
      data: {
        keyHash,
        tenantId: request.tenantId,
        accountType: request.accountType,
        usesAllowed: request.usesAllowed || 1,
        usesLeft: request.usesAllowed || 1,
        singleUse: request.singleUse ?? true,
        expiresAt: request.expiresAt,
        metadata: request.metadata,
        createdBy,
        usedLogs: [],
      },
    });

    return key; // Return plain key only once
  }

  async validateAndUseKey(request: UseKeyRequest): Promise<{
    tenantId: string;
    accountType: AccountType;
    isNewTenant: boolean;
  }> {
    // Find all non-revoked, non-expired keys
    const keys = await prisma.registrationKey.findMany({
      where: {
        revoked: false,
        usesLeft: { gt: 0 },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: { tenant: true },
    });

    // Find matching key
    let validKey = null;
    for (const keyRecord of keys) {
      const isValid = await bcrypt.compare(request.key, keyRecord.keyHash);
      if (isValid) {
        validKey = keyRecord;
        break;
      }
    }

    if (!validKey) {
      throw new Error('Invalid, expired, or revoked registration key');
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: request.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    let tenantId = validKey.tenantId;
    let isNewTenant = false;

    // Create tenant if needed
    if (!tenantId) {
      const { tenantService } = await import('./tenantService');
      tenantId = await tenantService.createTenant(`Tenant for ${request.email}`);
      isNewTenant = true;
    }

    // Create user
    const { authService } = await import('../middleware/auth');
    const hashedPassword = await authService.hashPassword(request.password);

    await prisma.user.create({
      data: {
        email: request.email,
        password: hashedPassword,
        name: request.name,
        accountType: validKey.accountType,
        tenantId: tenantId!,
        isActive: true,
      },
    });

    // Update key usage
    const updatedUsedLogs = Array.isArray(validKey.usedLogs) ? validKey.usedLogs : [];
    updatedUsedLogs.push({
      email: request.email,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      usedAt: new Date().toISOString(),
    });

    await prisma.registrationKey.update({
      where: { id: validKey.id },
      data: {
        usesLeft: validKey.usesLeft - 1,
        usedLogs: updatedUsedLogs,
        ...(validKey.singleUse && { revoked: true }),
      },
    });

    return {
      tenantId: tenantId!,
      accountType: validKey.accountType,
      isNewTenant,
    };
  }

  async listKeys(tenantId?: string) {
    return await prisma.registrationKey.findMany({
      where: tenantId ? { tenantId } : {},
      include: { tenant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeKey(keyId: string) {
    return await prisma.registrationKey.update({
      where: { id: keyId },
      data: { revoked: true },
    });
  }

  async getKeyUsage(keyId: string) {
    const key = await prisma.registrationKey.findUnique({
      where: { id: keyId },
    });

    if (!key) {
      throw new Error('Key not found');
    }

    return {
      id: key.id,
      accountType: key.accountType,
      usesAllowed: key.usesAllowed,
      usesLeft: key.usesLeft,
      usedLogs: key.usedLogs,
      revoked: key.revoked,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    };
  }
}

export const registrationKeyService = new RegistrationKeyService();