/**
 * SISTEMA DE GESTÃO JURÍDICA - DASHBOARD PRINCIPAL
 * ================================================
 *
 * Dashboard central do sistema de gestão para escritórios de advocacia.
 * Fornece uma visão geral completa das operações do escritório incluindo:
 *
 * MÉTRICAS PRINCIPAIS:
 * - Receitas e despesas do período
 * - Saldo atual e tendências
 * - Número de clientes ativos
 *
 * SEÇÕES DE MONITORAMENTO:
 * - Notificações urgentes e lembretes
 * - Projetos com prazos próximos
 * - Faturas a vencer
 * - Atividades recentes
 *
 * FUNCIONALIDADES:
 * - Navegação suave entre módulos
 * - Gráficos e visualizações
 * - Links rápidos para ações principais
 * - Feedback visual aprimorado
 *
 * Autor: Sistema de Gestão Jurídica
 * Data: 2024
 * Versão: 2.0
 */

import React from 'react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardCharts } from '@/components/Dashboard/Charts';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '@/hooks/useData';


function MetricCard({ 
  title, 
  value, 
  change, 
  trend, 
  icon: Icon, 
  format = 'currency',
  className 
}: {
  title: string;
  value: number;
  change: number;
  trend: 'up' | 'down';
  icon: React.ElementType;
  format?: 'currency' | 'number';
  className?: string;
}) {
  const formattedValue = format === 'currency' 
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : value.toLocaleString('pt-BR');

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        <div className="flex items-center text-xs text-muted-foreground">
          {trend === 'up' ? (
            <TrendingUp className="mr-1 h-3 w-3 text-green-600" />
          ) : (
            <TrendingDown className="mr-1 h-3 w-3 text-red-600" />
          )}
          <span className={trend === 'up' ? 'text-green-600' : 'text-red-600'}>
            {change > 0 ? '+' : ''}{change}% mês
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { dashboard, loading, error } = useDashboard();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Erro ao carregar dashboard</h1>
            <p className="text-muted-foreground">Tente recarregar a página</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboard) {
    return null;
  }

  const metrics = dashboard;

  const handleViewAllNotifications = () => {
    // Redirect to notifications page instead of showing notification
    navigate('/notificacoes');
  };

  const handleViewAllProjects = () => {
    // Enhanced smooth transition with page fade
    const button = document.activeElement as HTMLElement;
    if (button) {
      button.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
      button.style.transform = 'scale(0.95)';
      button.style.opacity = '0.7';

      // Add ripple effect
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(59, 130, 246, 0.3);
        transform: scale(0);
        animation: ripple 0.6s linear;
        pointer-events: none;
      `;
      button.style.position = 'relative';
      button.style.overflow = 'hidden';
      button.appendChild(ripple);

      setTimeout(() => {
        button.style.transform = 'scale(1)';
        button.style.opacity = '1';

        // Smooth page transition
        document.body.style.transition = 'opacity 0.2s ease-out';
        document.body.style.opacity = '0.95';

        setTimeout(() => {
          navigate('/projetos');
          document.body.style.opacity = '1';
        }, 100);
      }, 150);
    } else {
      navigate('/projetos');
    }
  };

  const handleViewAllInvoices = () => {
    // Enhanced smooth transition for invoices
    const button = document.activeElement as HTMLElement;
    if (button) {
      button.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
      button.style.transform = 'scale(0.95)';
      button.style.opacity = '0.7';

      setTimeout(() => {
        button.style.transform = 'scale(1)';
        button.style.opacity = '1';

        // Smooth page transition with visual feedback
        document.body.style.transition = 'opacity 0.2s ease-out';
        document.body.style.opacity = '0.95';

        setTimeout(() => {
          navigate('/cobranca');
          document.body.style.opacity = '1';
        }, 100);
      }, 150);
    } else {
      navigate('/cobranca');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do seu escritório de advocacia
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="💰 RECEITAS"
            value={metrics.revenue.value}
            change={metrics.revenue.change}
            trend={metrics.revenue.trend}
            icon={DollarSign}
            className="metric-revenue"
          />
          <MetricCard
            title="📉 DESPESAS"
            value={metrics.expenses.value}
            change={metrics.expenses.change}
            trend={metrics.expenses.trend}
            icon={TrendingDown}
            className="metric-expense"
          />
          <MetricCard
            title="🏦 SALDO"
            value={metrics.balance.value}
            change={metrics.balance.change}
            trend={metrics.balance.trend}
            icon={TrendingUp}
            className="metric-balance-positive"
          />
          <MetricCard
            title="👥 CLIENTES"
            value={metrics.clients.value}
            change={metrics.clients.change}
            trend={metrics.clients.trend}
            icon={Users}
            format="number"
            className="metric-clients"
          />
        </div>

        {/* Charts Section */}
        <DashboardCharts />

        {/* Activity Sections */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Recent Activities */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Notificações</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewAllNotifications}
                className="transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Ver todas
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {(dashboard.recentActivities || []).map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <activity.icon className={cn("h-4 w-4 mt-1", activity.color)} />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={handleViewAllNotifications}>
                <Plus className="h-4 w-4 mr-2" />
                Ver mais
              </Button>
            </CardContent>
          </Card>

          {/* Urgent Projects */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Projetos Urgentes</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewAllProjects}
                className="transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Ver todos
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {(dashboard.urgentProjects || []).map((project, index) => (
                <div key={index} className="flex flex-col space-y-2 p-3 border rounded-lg">
                  <h4 className="text-sm font-medium">{project.name}</h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {new Date(project.deadline).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                      {project.status}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming Invoices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Faturas Vencendo</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewAllInvoices}
                className="transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Ver todas
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {(dashboard.upcomingInvoices || []).map((invoice, index) => (
                <div key={index} className="flex flex-col space-y-2 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{invoice.number}</h4>
                    <span className="text-sm font-bold text-green-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{invoice.client}</span>
                    <span className="text-red-600">
                      Vence: {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
