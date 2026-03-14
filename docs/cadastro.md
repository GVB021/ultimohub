# Cadastro da Plataforma (Basico vs Completo)

## Objetivo

O cadastro inicial foi simplificado para coletar apenas o essencial. Informacoes complementares ficam armazenadas separadamente e podem ser preenchidas/atualizadas depois, via endpoints dedicados.

## Entidades e Campos

### Usuario

**Basico (cadastro inicial)**

- `fullName` (nome)
- `email`
- `password`

**Completo (perfil complementar)**

- `artistName`
- `phone`
- `altPhone`
- `birthDate`
- `city`
- `state`
- `country`
- `mainLanguage`
- `additionalLanguages`
- `experience`
- `specialty`
- `bio`
- `portfolioUrl`

### Estudio

**Basico (criacao inicial)**

- `name`

**Completo (perfil complementar)**

- campos adicionais armazenados em `studio_profiles.data` conforme necessidade do produto

## Armazenamento Complementar

### user_profiles

- Tabela: `user_profiles`
- Chave: `user_id`
- Dados: `data` (jsonb)

### studio_profiles

- Tabela: `studio_profiles`
- Chave: `studio_id`
- Dados: `data` (jsonb)

## Endpoints

### Cadastro basico de usuario

- `POST /api/auth/register`

Payload minimo:

```json
{ "fullName": "Nome", "email": "email@dominio.com", "password": "senha" }
```

Campos de perfil enviados junto no cadastro sao aceitos por compatibilidade e persistidos em `user_profiles`.

### Perfil complementar do usuario autenticado

- `GET /api/users/me/profile`
- `PATCH /api/users/me/profile`

Payload do PATCH (campos opcionais):

```json
{ "artistName": "Nome artistico", "phone": "+55 11 99999-9999" }
```

