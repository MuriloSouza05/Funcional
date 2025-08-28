import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { supabase } from '../config/supabase';

export interface CreateKeyRequest {
  tenantId?: string;
  accountType: 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL';
  usesAllowed?: number;
  expiresAt?: Date;
  singleUse?: boolean;
  metadata?: any;
}

export class RegistrationKeyService {
  async generateKey(request: CreateKeyRequest, createdBy: string): Promise<string> {
    // Generate random key
    const key = crypto.randomBytes(32).toString('hex');
    const keyHash = await bcrypt.hash(key, 12);

    // Create key record
    const { error } = await supabase.from('registration_keys').insert({
      key_hash: keyHash,
      tenant_id: request.tenantId,
      account_type: request.accountType,
      uses_allowed: request.usesAllowed || 1,
      uses_left: request.usesAllowed || 1,
      single_use: request.singleUse ?? true,
      expires_at: request.expiresAt?.toISOString(),
      metadata: request.metadata || {},
      created_by: createdBy,
      used_logs: [],
    });

    if (error) {
      throw new Error(`Failed to create registration key: ${error.message}`);
    }

    return key; // Return plain key only once
  }

  async listKeys(tenantId?: string) {
    let query = supabase
      .from('registration_keys')
      .select(`
        *,
        tenants(name)
      `)
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list keys: ${error.message}`);
    }

    return data;
  }

  async revokeKey(keyId: string) {
    const { error } = await supabase
      .from('registration_keys')
      .update({ revoked: true })
      .eq('id', keyId);

    if (error) {
      throw new Error(`Failed to revoke key: ${error.message}`);
    }
  }

  async getKeyUsage(keyId: string) {
    const { data: key, error } = await supabase
      .from('registration_keys')
      .select('*')
      .eq('id', keyId)
      .single();

    if (error || !key) {
      throw new Error('Key not found');
    }

    return {
      id: key.id,
      accountType: key.account_type,
      usesAllowed: key.uses_allowed,
      usesLeft: key.uses_left,
      usedLogs: key.used_logs,
      revoked: key.revoked,
      expiresAt: key.expires_at,
      createdAt: key.created_at,
    };
  }
}

export const registrationKeyService = new RegistrationKeyService();