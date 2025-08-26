# 🏛️ Sistema SaaS para Escritórios de Advocacia

## 🚀 Sistema Completo Implementado

Este é um sistema SaaS completo para gestão de escritórios de advocacia com:

### ✅ Backend Completo
- **PostgreSQL Multi-tenant** com Supabase
- **Autenticação JWT** com refresh token rotativo
- **Sistema de Permissões** por tipo de conta
- **APIs RESTful** para todos os módulos
- **Isolamento de dados** por tenant
- **Audit log** completo

### ✅ Módulos Funcionais
- **Dashboard** - Métricas em tempo real
- **CRM** - Gestão de clientes e pipeline
- **Projetos** - Controle de projetos jurídicos
- **Tarefas** - Sistema de tarefas por responsável
- **Cobrança** - Orçamentos e faturas
- **Gestão de Recebíveis** - Automação de cobranças
- **Fluxo de Caixa** - Controle financeiro completo
- **Publicações** - Painel isolado por usuário
- **Notificações** - Sistema em tempo real

### 🔐 Tipos de Conta
1. **Conta Simples** - CRM básico (sem dados financeiros)
2. **Conta Composta** - CRM + Financeiro completo
3. **Conta Gerencial** - Acesso total + Configurações

### 🗄️ Banco de Dados
- **Multi-tenant** com schema por escritório
- **Isolamento total** de dados entre tenants
- **Publicações isoladas** por usuário (única exceção)
- **Audit log** de todas as operações
- **Sistema de notificações** integrado

## 🛠️ Tecnologias

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase PostgreSQL
- **Auth**: JWT + Refresh Token
- **UI**: Radix UI + shadcn/ui

## 🚀 Como Executar

### 1. Configurar Supabase
```bash
# Conectar ao Supabase (clique no botão "Connect to Supabase" no topo)
# Executar as migrations automaticamente
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Executar o Sistema
```bash
npm run dev
```

### 4. Credenciais de Teste
- **Conta Gerencial**: admin@escritorio.com / 123456
- **Conta Composta**: financeiro@escritorio.com / 123456  
- **Conta Simples**: atendimento@escritorio.com / 123456

## 📊 Funcionalidades Principais

### Dashboard Inteligente
- Métricas financeiras (ocultas para Conta Simples)
- Gráficos em tempo real
- Atividades recentes
- Projetos urgentes

### CRM Completo
- Gestão de clientes com dados jurídicos
- Pipeline de vendas
- Sistema de tags
- Filtros avançados

### Sistema Financeiro
- Fluxo de caixa detalhado
- Categorias específicas para advocacia
- Transações recorrentes
- Relatórios em CSV

### Automação
- Notificações em tempo real
- Sistema de audit log
- Isolamento de dados
- Permissões granulares

## 🔧 Preparação para Painel Admin

O sistema está preparado para um futuro painel administrativo com:

### Estrutura Admin Global
- Schema `admin` separado dos tenants
- Tabela `tenants` para controle de escritórios
- Tabela `users` global para autenticação
- Sistema de logs centralizado

### Funcionalidades Futuras do Painel Admin
- **Gestão de Tenants**: Criar, editar, desativar escritórios
- **Controle de Usuários**: Gerenciar contas de todos os tenants
- **Monitoramento**: Logs, métricas e uso por tenant
- **Planos e Cobrança**: Sistema de assinatura
- **APIs por Tenant**: Controle de integrações externas

### Estrutura Preparada
```sql
-- Schema admin já criado com:
admin.tenants          -- Escritórios cadastrados
admin.users            -- Usuários globais
admin.system_logs      -- Logs do sistema
admin.refresh_tokens   -- Controle de sessões
```

## 🎯 Status do Projeto

### ✅ Implementado
- [x] Backend completo com Supabase
- [x] Sistema de autenticação
- [x] Todos os módulos funcionais
- [x] Isolamento multi-tenant
- [x] Sistema de permissões
- [x] Notificações em tempo real
- [x] Audit log completo
- [x] APIs RESTful
- [x] Frontend integrado

### 🔄 Próximos Passos
- [ ] Integração Stripe (pagamentos)
- [ ] Integração Resend (emails)
- [ ] Integração WhatsApp (n8n)
- [ ] APIs jurídicas (CNJ, Codilo, JusBrasil)
- [ ] Painel administrativo
- [ ] Sistema de arquivos (AWS S3)

## 📞 Suporte

O sistema está **100% funcional** e pronto para uso em produção. Todos os mock data foram removidos e substituídos por dados reais do banco PostgreSQL via Supabase.

**🎉 Sistema SaaS Completo e Funcional!**