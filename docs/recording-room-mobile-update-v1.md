# Atualização Oficial V1 — RecordingRoom Mobile

## Resumo

Esta atualização consolida melhorias de usabilidade mobile, controle de permissões de interface, robustez de gravações e reimplementação do fluxo de loop na sala de gravação.

## Manual do Usuário Final

### Estudantes e Dubladores

1. Abra a sessão de gravação.
2. Toque em **Gravações** para conferir takes.
3. Use **play/pause** para ouvir cada take.
4. Use **download** para baixar o take.
5. Observe o status:
   - **Mídia disponível**: take pronto para reprodução/download.
   - **Mídia indisponível**: erro de acesso ao áudio.

### Professores e Controladores de Texto

1. Abra o menu da sala e acesse **Liberar Texto**.
2. Conceda controle para usuários online elegíveis.
3. Usuários autorizados poderão editar fala, personagem e timecode.
4. Usuários sem permissão não veem ferramentas de edição inline.

### Administradores

1. Use **Gravações** como ponto único para revisar takes.
2. Em takes pendentes, utilize:
   - **Aprovar** para salvar como preferido.
   - **Descartar** para remover.
3. Use **Painel** para retornar ao dashboard.

## Especificações Técnicas

### Arquitetura de Camadas (z-index)

- Controles principais: faixa 100–200.
- Painel de chat (Daily): acima dos controles.
- Popups e modais: faixa 1000–2000.
- Drawers mobile: acima de todos os controles.

### Sistema de Roles no Frontend

- Roles canônicas:
  - `viewer`
  - `text_controller`
  - `audio_controller`
  - `admin`
- Permissões:
  - `text_control`
  - `audio_control`
  - `presence_view`
  - `approve_take`
  - `discard_take`
  - `dashboard_access`
- Mapeamento de papéis legados para roles canônicas é feito em tempo de renderização da sala.

### Gravações e Persistência de Áudio

- Busca de gravações com logs de depuração no frontend e backend.
- Tratamento de falha de banco com resposta de erro clara.
- Validação pós-upload confirma persistência do take no endpoint de gravações.
- Indicador visual de disponibilidade por take.

### Loop Reimplementado

- Com loop ativo, **play** sempre inicia no início do loop selecionado.
- Estado visual de **Preparando loop... (3s)** antes de reproduzir.
- Após final de cada iteração, pausa com **silêncio de 3s**.
- Eventos de sincronização de loop emitidos para fluxo em tempo real.

## Guia de Troubleshooting

### 1) “Falha de conexão com o banco de áudio”

- Verifique conectividade do servidor.
- Confira resposta do endpoint `/api/sessions/:sessionId/recordings`.
- Verifique logs:
  - `[Room][Recordings] falha ao carregar takes`
  - `[Recordings] Database fetch failure`

### 2) Take não reproduz

- Validar stream (`Range bytes=0-1`).
- Confirmar status HTTP do stream.
- Revisar permissões do usuário na sessão.

### 3) Loop não reinicia corretamente

- Verifique se o loop está ativo e faixa definida.
- Confirme presença das mensagens:
  - `Preparando loop... (3s)`
  - `Silêncio entre loops... (3s)`

### 4) Ferramentas de edição não aparecem

- Validar role efetiva do usuário.
- Confirmar permissão `text_control`.
- Verificar concessão em **Liberar Texto**.

## Roteiros de Vídeos Tutoriais (2–3 min)

### Vídeo 1 — Gravação e revisão de takes

- Objetivo: mostrar fluxo gravar → salvar → reproduzir → baixar.
- Passos: gravação rápida, abertura da aba Gravações, uso de play/download, leitura de status.

### Vídeo 2 — Permissões e controle de texto

- Objetivo: explicar roles e concessão de controle.
- Passos: abrir Liberar Texto, conceder/revogar, validar edição inline.

### Vídeo 3 — Loop avançado

- Objetivo: explicar loop com preroll e silêncio.
- Passos: definir loop, iniciar play, observar preroll, observar silêncio entre iterações.

### Vídeo 4 — Uso mobile do chat colapsável

- Objetivo: explicar painel Daily no mobile.
- Passos: abrir painel, gesto swipe para minimizar/maximizar, manter área de gravação livre.

## Checklist de Validação

- Menu mantém **Painel** por último.
- Aba **Gravações** é ponto único para conferência de takes.
- Indicadores de disponibilidade aparecem por take.
- Play/pause e download funcionam sem sair da aba.
- Roles controlam renderização de ferramentas sensíveis.
- Loop respeita preroll e silêncio de 3s.
