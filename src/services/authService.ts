import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';

export interface User {
  id: string;
  email: string;
  name: string;
  accountType: 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL';
  tenantId: string;
  isActive: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
  isActive: boolean;
}

export interface JWTPayload {
  userId: string;
  tenantId?: string;
  accountType?: string;
  email: string;
  name: string;
  role?: string;
  type: 'access' | 'refresh';
}

export class AuthService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'access-secret-change-in-production';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  async generateTokens(user: User | AdminUser, isAdmin = false) {
    const payload: Omit<JWTPayload, 'type'> = {
      userId: user.id,
      email: user.email,
      name: user.name,
      ...(isAdmin ? { role: (user as AdminUser).role } : {
        tenantId: (user as User).tenantId,
        accountType: (user as User).accountType,
      }),
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

    await supabase.from('refresh_tokens').insert({
      token_hash: tokenHash,
      user_id: user.id,
      expires_at: expiresAt.toISOString(),
      is_active: true,
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
      const { data: storedTokens } = await supabase
        .from('refresh_tokens')
        .select('*')
        .eq('user_id', decoded.userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      if (!storedTokens || storedTokens.length === 0) {
        throw new Error('Refresh token not found');
      }

      // Check if any stored token matches
      let validToken = null;
      for (const stored of storedTokens) {
        const isValid = await bcrypt.compare(token, stored.token_hash);
        if (isValid) {
          validToken = stored;
          break;
        }
      }

      if (!validToken) {
        throw new Error('Refresh token not found or invalid');
      }

      // Invalidate used refresh token (rotation)
      await supabase
        .from('refresh_tokens')
        .update({ is_active: false })
        .eq('id', validToken.id);

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  async revokeAllTokens(userId: string) {
    await supabase
      .from('refresh_tokens')
      .update({ is_active: false })
      .eq('user_id', userId);
  }

  async loginUser(email: string, password: string): Promise<{ user: User; tokens: any }> {
    // Find user
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        *,
        tenants!inner(*)
      `)
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !users) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, users.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if tenant is active
    if (!users.tenants.is_active) {
      throw new Error('Account suspended - contact support');
    }

    const user: User = {
      id: users.id,
      email: users.email,
      name: users.name,
      accountType: users.account_type,
      tenantId: users.tenant_id,
      isActive: users.is_active,
    };

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    return { user, tokens };
  }

  async loginAdmin(email: string, password: string): Promise<{ user: AdminUser; tokens: any }> {
    // Find admin user
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !adminUser) {
      throw new Error('Invalid admin credentials');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(password, adminUser.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid admin credentials');
    }

    const user: AdminUser = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      isActive: adminUser.is_active,
    };

    // Generate tokens
    const tokens = await this.generateTokens(user, true);

    // Update last login
    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    return { user, tokens };
  }

  async registerUser(email: string, password: string, name: string, registrationKey: string): Promise<{ user: User; tokens: any; isNewTenant: boolean }> {
    // Validate registration key
    const keyResult = await this.validateRegistrationKey(registrationKey, email);
    
    // Hash password
    const passwordHash = await this.hashPassword(password);

    let tenantId = keyResult.tenantId;
    let isNewTenant = false;

    // Create tenant if needed
    if (!tenantId) {
      tenantId = await this.createTenant(`Tenant for ${email}`);
      isNewTenant = true;
    }

    // Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        name,
        account_type: keyResult.accountType,
        tenant_id: tenantId,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    // Update key usage
    await this.useRegistrationKey(keyResult.keyId, email);

    const user: User = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      accountType: newUser.account_type,
      tenantId: newUser.tenant_id,
      isActive: newUser.is_active,
    };

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return { user, tokens, isNewTenant };
  }

  private async validateRegistrationKey(key: string, email: string) {
    // Get all non-revoked, non-expired keys
    const { data: keys, error } = await supabase
      .from('registration_keys')
      .select('*')
      .eq('revoked', false)
      .gt('uses_left', 0)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (error || !keys) {
      throw new Error('Failed to validate registration key');
    }

    // Find matching key
    let validKey = null;
    for (const keyRecord of keys) {
      const isValid = await bcrypt.compare(key, keyRecord.key_hash);
      if (isValid) {
        validKey = keyRecord;
        break;
      }
    }

    if (!validKey) {
      throw new Error('Invalid, expired, or revoked registration key');
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new Error('Email already registered');
    }

    return {
      keyId: validKey.id,
      tenantId: validKey.tenant_id,
      accountType: validKey.account_type,
    };
  }

  private async useRegistrationKey(keyId: string, email: string) {
    const { data: key } = await supabase
      .from('registration_keys')
      .select('*')
      .eq('id', keyId)
      .single();

    if (!key) return;

    const usedLogs = Array.isArray(key.used_logs) ? key.used_logs : [];
    usedLogs.push({
      email,
      usedAt: new Date().toISOString(),
    });

    await supabase
      .from('registration_keys')
      .update({
        uses_left: key.uses_left - 1,
        used_logs: usedLogs,
        ...(key.single_use && { revoked: true }),
      })
      .eq('id', keyId);
  }

  private async createTenant(name: string): Promise<string> {
    const tenantId = crypto.randomUUID();
    const schemaName = `tenant_${tenantId.replace(/-/g, '')}`;

    // Create tenant record
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        id: tenantId,
        name,
        schema_name: schemaName,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create tenant: ${error.message}`);
    }

    // Create tenant schema
    await supabase.rpc('create_tenant_schema', { tenant_uuid: tenantId });

    return tenantId;
  }

  async refreshTokens(refreshToken: string): Promise<{ user: User | AdminUser; tokens: any; isAdmin: boolean }> {
    const decoded = await this.verifyRefreshToken(refreshToken);

    // Determine if it's admin or regular user
    const isAdmin = !!decoded.role;

    let user: User | AdminUser;

    if (isAdmin) {
      // Get admin user
      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', decoded.userId)
        .eq('is_active', true)
        .single();

      if (error || !adminUser) {
        throw new Error('Admin user not found or inactive');
      }

      user = {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        isActive: adminUser.is_active,
      };
    } else {
      // Get regular user
      const { data: regularUser, error } = await supabase
        .from('users')
        .select(`
          *,
          tenants!inner(*)
        `)
        .eq('id', decoded.userId)
        .eq('is_active', true)
        .single();

      if (error || !regularUser || !regularUser.tenants.is_active) {
        throw new Error('User not found or inactive');
      }

      user = {
        id: regularUser.id,
        email: regularUser.email,
        name: regularUser.name,
        accountType: regularUser.account_type,
        tenantId: regularUser.tenant_id,
        isActive: regularUser.is_active,
      };
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user, isAdmin);

    return { user, tokens, isAdmin };
  }
}

export const authService = new AuthService();