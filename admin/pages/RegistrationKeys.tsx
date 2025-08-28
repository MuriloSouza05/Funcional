import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Key,
  Plus,
  Search,
  MoreHorizontal,
  Copy,
  Eye,
  Trash2,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdminApi';
import { RegistrationKeyForm } from '../components/RegistrationKeyForm';
import { KeyUsageDialog } from '../components/KeyUsageDialog';

interface RegistrationKey {
  id: string;
  accountType: string;
  usesAllowed: number;
  usesLeft: number;
  singleUse: boolean;
  expiresAt?: string;
  revoked: boolean;
  createdAt: string;
  tenant?: {
    id: string;
    name: string;
  };
  usageCount: number;
}

export function AdminRegistrationKeys() {
  const { getRegistrationKeys, revokeRegistrationKey } = useAdminApi();
  const [keys, setKeys] = useState<RegistrationKey[]>([]);
  const [filteredKeys, setFilteredKeys] = useState<RegistrationKey[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  const [selectedKey, setSelectedKey] = useState<RegistrationKey | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  useEffect(() => {
    // Filter keys based on search term
    const filtered = keys.filter(key =>
      key.accountType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      key.tenant?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      key.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredKeys(filtered);
  }, [keys, searchTerm]);

  const loadKeys = async () => {
    try {
      setIsLoading(true);
      const data = await getRegistrationKeys();
      setKeys(data);
    } catch (error) {
      console.error('Failed to load keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this registration key?')) {
      return;
    }

    try {
      await revokeRegistrationKey(keyId);
      await loadKeys();
    } catch (error) {
      console.error('Failed to revoke key:', error);
      alert('Failed to revoke key');
    }
  };

  const handleCopyKey = async (keyId: string) => {
    // In a real implementation, you'd need to store the plain key temporarily
    // or provide a way to regenerate it for copying
    try {
      await navigator.clipboard.writeText(keyId);
      alert('Key ID copied to clipboard');
    } catch (error) {
      console.error('Failed to copy key:', error);
    }
  };

  const handleViewUsage = (key: RegistrationKey) => {
    setSelectedKey(key);
    setShowUsageDialog(true);
  };

  const getStatusBadge = (key: RegistrationKey) => {
    if (key.revoked) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (key.usesLeft === 0) {
      return <Badge variant="secondary">Used Up</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
  };

  const getAccountTypeBadge = (accountType: string) => {
    const colors = {
      SIMPLES: 'bg-blue-100 text-blue-800',
      COMPOSTA: 'bg-yellow-100 text-yellow-800',
      GERENCIAL: 'bg-purple-100 text-purple-800',
    };
    return colors[accountType as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registration Keys</h1>
            <p className="text-muted-foreground">
              Manage registration keys for new user accounts
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Key
          </Button>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search keys..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Keys Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Key className="h-5 w-5 mr-2" />
              Registration Keys ({filteredKeys.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading keys...</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key ID</TableHead>
                      <TableHead>Account Type</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-12">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredKeys.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No registration keys found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell>
                            <div className="font-mono text-sm">
                              {key.id.substring(0, 8)}...
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getAccountTypeBadge(key.accountType)}>
                              {key.accountType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {key.tenant ? (
                              <div>
                                <div className="font-medium">{key.tenant.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {key.tenant.id.substring(0, 8)}...
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">New Tenant</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">
                                {key.usageCount}/{key.usesAllowed}
                              </span>
                              {key.usageCount > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewUsage(key)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(key)}
                          </TableCell>
                          <TableCell>
                            {key.expiresAt ? (
                              <div className="text-sm">
                                {new Date(key.expiresAt).toLocaleDateString()}
                                {isExpiringSoon(key.expiresAt) && (
                                  <AlertTriangle className="h-3 w-3 inline ml-1 text-yellow-500" />
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(key.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleCopyKey(key.id)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy ID
                                </DropdownMenuItem>
                                {key.usageCount > 0 && (
                                  <DropdownMenuItem onClick={() => handleViewUsage(key)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Usage
                                  </DropdownMenuItem>
                                )}
                                {!key.revoked && (
                                  <DropdownMenuItem 
                                    onClick={() => handleRevokeKey(key.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Revoke
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Key Form */}
        <RegistrationKeyForm
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
          onSuccess={loadKeys}
        />

        {/* Key Usage Dialog */}
        <KeyUsageDialog
          registrationKey={selectedKey}
          open={showUsageDialog}
          onOpenChange={setShowUsageDialog}
        />
      </div>
    </AdminLayout>
  );
}