# Roles e Permissoes (Matriz)

## Visao Geral

O sistema possui dois eixos:

- **Role de plataforma** (campo `users.role`): controla acessos administrativos globais.
- **Roles por estudio** (tabela `user_studio_roles`): controla acessos dentro do contexto do estudio.

As roles sao normalizadas para evitar inconsistencias (ex.: `adminstudio` -> `studio_admin`).

## Roles de Plataforma

| Role | Pode |
|---|---|
| `platform_owner` | Acesso total, gestao global, aprovacoes, configuracoes |
| `user` | Acesso comum (dependente de roles no estudio) |

Aliases aceitos: `platformowner` -> `platform_owner`.

## Roles de Estudio

| Role | Pode |
|---|---|
| `platform_owner` | Acesso total (override) |
| `studio_admin` | Administrar estudio, membros, permissoes e operacoes criticas |
| `diretor` | Operacao e controle de sessoes e conteudo (sem gestao global do estudio) |
| `engenheiro_audio` | Operacoes de audio e sessao conforme fluxo |
| `dublador` | Acesso operacional limitado (gravacao/consulta conforme permissoes) |
| `aluno` | Acesso de leitura/treinamento (sem controle critico) |

Aliases aceitos:

- `adminstudio` -> `studio_admin`
- `engenheriodeaudio` -> `engenheiro_audio`
- `director`/`teacher` -> `diretor`
- `audio_engineer`/`engineer` -> `engenheiro_audio`
- `voice_actor`/`actor` -> `dublador`
- `student` -> `aluno`

## Hierarquia

Maior -> menor:

`platform_owner` > `studio_admin` > `diretor` > `engenheiro_audio` > `dublador` > `aluno`

## Arquivos de Referencia

- Normalizacao e hierarquia: [roles.ts](file:///Users/gabrielborba/Desktop/THE%20HUB/shared/roles.ts)
- Middleware de autenticacao e role: [auth.ts](file:///Users/gabrielborba/Desktop/THE%20HUB/server/middleware/auth.ts)

