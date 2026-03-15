# Upgrade do Painel Administrativo

## Escopo implementado
- Gestão de sessões administrativas e sessões web
- Controle avançado de usuários
- Gestão de estudos por estúdio
- Alocação de usuários em estudos com fila
- Proteção de super administrador fixo
- Logs detalhados e trilha de auditoria

## Funcionalidades entregues

### 1) Gestão de Sessões
- Lista de sessões ativas por usuário: `GET /api/admin/sessions/active-by-user`
- Limpeza de sessões expiradas (domínio): `POST /api/admin/sessions/cleanup-expired`
- Encerramento forçado de sessão web por SID: `DELETE /api/admin/auth-sessions/:sid`
- Logout forçado por usuário: `POST /api/admin/auth-sessions/force-logout-user/:userId`
- Limpeza de sessões web expiradas: `POST /api/admin/auth-sessions/cleanup-expired`
- Exclusão de sessão com logout forçado de participantes: `DELETE /api/admin/sessions/:id`

### 2) Controle de Usuários
- Exportação CSV: `GET /api/admin/users/export`
- Histórico de atividade por usuário: `GET /api/admin/users/:id/activity`
- Proteção para elevação a `platform_owner` somente pelo master admin
- Bloqueio de exclusão/desativação/rebaixamento do super administrador

### 3) Gestão de Estudos
- Configuração de estudo por estúdio:
  - `GET /api/admin/studios/:id/study-config`
  - `PUT /api/admin/studios/:id/study-config`
- Associação e visualização de membros:
  - `GET /api/admin/studios/:id/users`
  - `POST /api/admin/users/:id/assign-studio`
  - `DELETE /api/admin/users/:id/studios/:studioId`
- Progresso por usuário:
  - `PUT /api/admin/studios/:id/study-progress/:userId`

### 4) Alocação Inteligente de Usuários
- Relatório de alocação e fila: `GET /api/admin/studios/:id/study-allocation`
- Alocação com elegibilidade e capacidade:
  - `POST /api/admin/studios/:id/study-allocate/:userId`
  - Se lotado, usuário entra automaticamente em fila de espera
- Desalocação:
  - `POST /api/admin/studios/:id/study-unallocate/:userId`
- Notificações de estudo:
  - `study_assigned`
  - `study_waitlist`

### 5) Hardening e Auditoria
- Log admin enriquecido com método, rota, IP, ator e timestamp
- Prefixo `MASTER_` para ações do super administrador
- Tratamento de erro explícito em operações críticas

## Frontend admin atualizado
- Exportar usuários em CSV
- Visualizar histórico de atividades por usuário
- Painel de sessões web ativas com limpeza e logout forçado
- Painel de sessões de domínio com limpeza de expiradas
- Dialog de gestão de estudo por estúdio:
  - capacidade, prazo, elegibilidade e auto-notificação
  - alocar/desalocar
  - atualizar progresso

## Super administrador fixo
- Email protegido: `borbaggabriel@gmail.com`
- Não pode ser excluído
- Não pode ser desativado
- Não pode perder `platform_owner`
- Concessão de `platform_owner` restrita ao próprio master admin
