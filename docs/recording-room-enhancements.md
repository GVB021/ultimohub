# RecordingRoom — Melhorias de UX e Fluxo Técnico

## Cabeçalho
- Removidas as ações de troca de estúdio e logout no cabeçalho desktop.
- Adicionado botão único `PAINEL`, com navegação direta para o dashboard do estúdio.

## Timecode configurável
- Novo endpoint de leitura: `GET /api/studios/:studioId/timecode-format`.
- Novo endpoint de atualização: `PUT /api/studios/:studioId/timecode-format` (somente `studio_admin`).
- Persistência por estúdio usando `platform_settings` com chave `STUDIO_TIMECODE_FORMAT_<studioId>`.
- Formatos suportados:
  - `HH:MM:SS`
  - `HH:MM:SS:MMM`
  - `HH:MM:SS:FF`
- O RecordingRoom sincroniza automaticamente o formato ao abrir a sessão.

## Loop
- Botão dedicado de loop adicionado na barra de transporte.
- Seleção de loop por clique na primeira e na última fala.
- Quando loop está ativo:
  - pre-roll e post-roll ficam em `2s` para navegação de trecho.
  - pre-roll de gravação aplica `3s`.
- Indicador visual mostra estado da seleção e intervalo ativo.

## Filtro de roteiro
- Adicionada opção `APENAS PERSONAGEM` no topo do roteiro.
- Exibe apenas falas do personagem selecionado no perfil de gravação.
- Mantém índice original de cada fala (`#linha original`) para contexto.

## Auditoria de uso
- Novo endpoint: `POST /api/sessions/:sessionId/audit-events`.
- Eventos registrados para:
  - redirecionamento ao painel,
  - ativação de filtro de personagem,
  - seleção/limpeza de loop,
  - aprovação de take.

## Daily.co
- Mantida integração com sala real Daily.co já aplicada anteriormente.
- Sessão permanece ativa ao ocultar popup.
- Minimizando ativa modo econômico (vídeo local pausado e áudio mantido).
