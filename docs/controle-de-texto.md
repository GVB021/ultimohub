# Controle de Texto

## Visao Geral

O "Controle de Texto" define quem pode interagir com o roteiro sincronizado dentro da sala (Room). O objetivo e permitir que participantes naveguem livremente no texto (rolagem independente), enquanto apenas um controlador possa clicar em falas e editar o texto para todos.

## Objetivos

- Permitir rolagem vertical livre do texto sem ser "puxado" pelo sincronismo.
- Desativar automaticamente o auto-follow durante rolagem manual.
- Restaurar o auto-follow quando o usuario der play ou selecionar uma fala.
- Implementar um controlador de texto selecionavel (single-controller) com validacao no servidor.
- Exibir indicador visual da posicao atual no texto.

## Arquitetura

### Estados Principais (Client)

- `scriptAutoFollow`: controla se o texto acompanha automaticamente a fala atual.
- `textControllerUserId`: userId do controlador atual do texto (recebido via WebSocket).
- `canTextControl`: `true` quando o usuario e privilegiado ou e o controlador atual.
- `lineEdits`: overrides locais do texto das falas (propagados via WebSocket).

### Estado Principal (Server)

- `textControllerSessions[sessionId]`: userId atual do controlador (ou `null`).

O estado do controlador e mantido em memoria e persiste em refresh do navegador enquanto o servidor estiver ativo.

## Eventos WebSocket

O canal WebSocket e `ws(s)://<host>/ws/video-sync?sessionId=...&userId=...&role=...&name=...`.

### Estado e Presenca

- `presence-sync`: lista de participantes conectados.
- `text-control:state`: estado do controlador atual.

Payload:

```json
{ "type": "text-control:state", "controllerUserId": "uuid-ou-null" }
```

### Selecao do Controlador

- `text-control:set-controller` (somente usuario privilegiado)
- `text-control:clear-controller` (somente usuario privilegiado)

### Edicao de Linha

- `text-control:update-line` (somente controlador ou usuario privilegiado)

Payload:

```json
{ "type": "text-control:update-line", "lineIndex": 12, "text": "Novo texto" }
```

O servidor valida permissao e retransmite para os demais clientes, que aplicam em `lineEdits`.

## Regras de Permissao

### Niveis

- Read-only: pode rolar o roteiro, sem clique e sem edicao.
- Controlador: pode clicar em falas (seek do video com `lineIndex`) e editar texto.
- Privilegiado: pode selecionar o controlador e tambem pode controlar/editar.

### Validacao no Servidor

O servidor bloqueia:

- Mudanca de controlador por usuario nao privilegiado.
- Edicao de linha (`text-control:update-line`) por usuario nao controlador/privilegiado.
- `video-seek` com `lineIndex` por usuario nao controlador/privilegiado (evita bypass de clique via console).

### Edge Cases

- Se o controlador desconectar e nao houver mais presenca dele na sala, o servidor limpa `controllerUserId` e emite `text-control:state` com `null`.

## UX do Roteiro

- Ao iniciar rolagem manual (wheel/touch/pointer), o modo muda para rolagem livre e o auto-follow e desativado.
- Ao clicar em uma fala, o auto-follow e reativado e o scroll centraliza a fala clicada.
- Ao dar play, o auto-follow e reativado.
- Indicadores:
  - Botao `AUTO/SEGUIR` no topo do roteiro.
  - Banner sticky "Rolagem livre" com acao "Voltar ao atual".
  - Barra vertical indicando a posicao relativa da fala atual.

## Pontos de Integracao (Arquivos)

- Room (App principal):
  - `client/src/studio/pages/room.tsx`
  - `server/video-sync.ts`
- Room (HUBDUB-STUDIO):
  - `HUBDUB-STUDIO/client/src/pages/room.tsx`
  - `HUBDUB-STUDIO/server/video-sync.ts`
- Room (HUB-ALIGN):
  - `HUB-ALIGN/client/src/pages/room.tsx`
  - `HUB-ALIGN/server/video-sync.ts`

## Testes Manuais (Checklist)

### Modal e Lista de Participantes

- Abrir/fechar o modal de Controle de Texto.
- Confirmar que a lista reflete usuarios conectados (presence-sync).
- Selecionar um controlador e validar destaque "Controlador".
- Recarregar a pagina e confirmar persistencia do controlador.

### Permissoes

- Usuario read-only:
  - Rolar o roteiro (mouse/touch) funciona.
  - Clique em fala nao busca o video.
  - Nao aparece botao de editar fala.
- Usuario controlador:
  - Clique em fala faz seek do video e centraliza o scroll.
  - Edicao de fala aparece e propaga para outros usuarios.
- Tentativa de bypass:
  - Enviar `text-control:update-line` via console como read-only nao altera para outros usuarios.
  - Enviar `video-seek` com `lineIndex` via console como read-only nao afeta outros usuarios.

### Edge Cases

- Controlador desconecta e o sistema remove o controlador atual.
- Mudanca de controlador enquanto outros usuarios editam/rolam.

## Evidencias

Gravacoes de video devem ser capturadas no ambiente real (browser), pois o ambiente de execucao automatizado nao grava tela.

## Troubleshooting

- Lista de usuarios vazia:
  - Verifique se o WebSocket conecta em `/ws/video-sync` e se chega `presence-sync`.
- Nao atualiza controlador:
  - Verifique se o usuario tem role privilegiada (ex.: `studio_admin`, `diretor`, `engenheiro_audio`).
  - Verifique no Network que `text-control:state` chega apos selecao.
- Edicao nao propaga:
  - Verifique se o usuario e controlador.
  - Verifique se chega `text-control:update-line` nos outros clientes via WebSocket.
