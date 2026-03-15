# Fluxo de Login e Redirecionamento de Estúdio

## Escopo
Fluxo analisado:
- `/` (entrada)
- `/hub-dub/login`
- `POST /api/auth/login`
- decisão de redirecionamento por quantidade de estúdios
- `/hub-dub/studios`
- `/hub-dub/studio/:studioId/dashboard`

## Componentes do fluxo
- Frontend Router: `client/src/studio/App.tsx`
- Tela de login: `client/src/studio/pages/login.tsx`
- Hook de autenticação: `client/src/studio/hooks/use-auth.ts`
- Hook de auto-entry: `client/src/studio/hooks/use-studios.ts`
- Backend login/auth: `server/replit_integrations/auth/routes.ts`
- Backend auto-entry: `server/routes.ts`
- Regra de decisão: `server/lib/studio-auto-entry.ts`

## Entradas e validações
- Entrada de credenciais:
  - email (formato válido)
  - senha (não vazia)
- Sessão:
  - criação com `req.login`
  - leitura de usuário em `/api/auth/user`
- Estúdios vinculados:
  - consulta via `storage.getStudiosForUser(user.id)` ou `storage.getStudios()` para `platform_owner`
- Regra de negócio:
  - 1 estúdio -> dashboard direto
  - 2+ estúdios -> seleção de estúdio

## Etapas de execução
1. Usuário acessa `/`.
2. Se não autenticado, roteia para `/hub-dub/login`.
3. Login envia `POST /api/auth/login`.
4. Backend valida credenciais, status da conta e cria sessão.
5. Backend consulta estúdios vinculados.
6. Backend calcula `redirectTo`:
   - 1 estúdio -> `/hub-dub/studio/:id/dashboard`
   - 2+ estúdios -> `/hub-dub/studios`
7. Frontend recebe sucesso e navega para `redirectTo`.
8. Em `/hub-dub/studios`, o frontend pode validar auto-entry para manter consistência de rota.
9. Dashboard valida sessão/permissão por middleware.

## Saídas esperadas
- `200` em login com payload:
  - `user`
  - `redirectTo`
  - `studioCount`
  - `autoEntryMode`
- `401` para credenciais inválidas
- `403` para conta pendente/rejeitada
- `409` para usuário sem estúdio vinculado (anomalia operacional)
- `500` para inconsistência de estúdio único inválido ou falha na resolução de redirect

## Pontos de falha identificados
- Redirecionamento com alvo inesperado no frontend sem sanitização.
- Query de auto-entry sendo executada sem usuário autenticado.
- Falta de tratamento explícito para cenário anômalo de usuário sem estúdio.
- Falta de sinalização forte para inconsistência de estúdio único sem `id`.

## Gargalos e riscos
- Chamada desnecessária de auto-entry em usuário anônimo (custo de rede e ruído de erro).
- Dependência de fallback silencioso em casos que deveriam ser erro operacional.
- Possível inconsistência de UX quando payload de redirect vier fora do padrão esperado.

## Melhorias aplicadas
- Sanitização de `redirectTo` no frontend (`/hub-dub/*` apenas).
- Auto-entry condicionado a usuário autenticado.
- Tratamento explícito de anomalia sem estúdio (`409`) no login e no endpoint de auto-entry.
- Tratamento explícito de decisão inválida (`mode: error`) com `500` e log estruturado.
- Testes atualizados para cobrir as novas proteções.

## Resultado esperado após melhorias
- Menor custo de rede em rota de seleção.
- Maior robustez contra payload inválido de redirecionamento.
- Melhor observabilidade operacional de inconsistências de vínculo de estúdio.
- Fluxo estritamente aderente à regra:
  - 1 estúdio -> dashboard
  - 2+ estúdios -> seleção
