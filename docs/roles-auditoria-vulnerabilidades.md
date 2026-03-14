# Auditoria de Roles e Permissoes (Achados e Correcoes)

## Achados Principais

### 1) Inconsistencia de nomenclatura de roles

Foram encontrados formatos mistos e aliases de roles (PT/EN e diferentes convencoes), o que aumenta risco de permissao incorreta:

- `platformowner` vs `platform_owner`
- `adminstudio` vs `studio_admin`
- `engenheriodeaudio` vs `engenheiro_audio`
- `director`/`teacher` vs `diretor`

**Risco:** checagens por string literal podem falhar (bloqueando acesso legitimo ou liberando acesso indevido).

**Correcao:** normalizacao centralizada de roles em `shared/roles.ts` e uso no middleware.

### 2) Validacao parcial em pontos de controle

Checagens estavam espalhadas em rotas e UI. Isso aumenta duplicacao e divergencia.

**Correcao:** introducao de funcoes de hierarquia/normalizacao reutilizaveis.

## Correcoes Aplicadas

- Normalizacao de role de plataforma e roles de estudio:
  - [roles.ts](file:///Users/gabrielborba/Desktop/THE%20HUB/shared/roles.ts)
- Middleware passou a usar normalizacao e hierarquia ao avaliar acesso:
  - [auth.ts](file:///Users/gabrielborba/Desktop/THE%20HUB/server/middleware/auth.ts)
- Testes automatizados para garantir normalizacao e hierarquia:
  - [roles.test.ts](file:///Users/gabrielborba/Desktop/THE%20HUB/tests/roles.test.ts)

## Recomendacoes Pendentes

- Persistir o controle e auditoria de permissoes sensiveis no banco (audit trail).
- Introduzir testes de integracao de rotas criticas com usuarios de roles diferentes.

