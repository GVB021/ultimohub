# Documentação de QA - Refatoração da Sala de Gravação

## Resumo

Esta documentação detalha as principais alterações e novas funcionalidades implementadas na sala de gravação para a equipe de QA. O objetivo desta refatoração foi melhorar a usabilidade, a performance e a confiabilidade da sala de gravação, com foco especial na experiência mobile.

## Alterações e Novas Funcionalidades

### 1. Remoção do Texto Inferior do Vídeo

- **O que foi feito:** O elemento de texto que exibia a fala atual do roteiro abaixo do vídeo foi completamente removido.
- **O que testar:** Verificar se o texto não é mais exibido em nenhuma circunstância.

### 2. Controle de Fonte do Roteiro

- **O que foi feito:** Adicionados botões de "+" e "-" no painel de roteiro lateral para aumentar e diminuir o tamanho da fonte.
- **O que testar:**
    - Verificar se os botões aumentam e diminuem o tamanho da fonte do roteiro.
    - Verificar se o tamanho da fonte é persistido no `localStorage` e restaurado ao recarregar a página.
    - Verificar se os limites de tamanho mínimo (12px) e máximo (24px) são respeitados.

### 3. Remoção do Controle de Velocidade do Cabeçalho

- **O que foi feito:** O controle de velocidade de reprodução do vídeo foi removido do cabeçalho.
- **O que testar:** Verificar se o controle de velocidade não está mais presente no cabeçalho.

### 4. Ícone de Retorno ao Dashboard

- **O que foi feito:** Adicionado um ícone de seta para a esquerda no canto superior esquerdo do cabeçalho.
- **O que testar:**
    - Verificar se o ícone redireciona para o dashboard principal.
    - Verificar se uma mensagem de confirmação é exibida ao clicar no ícone se houver uma gravação em andamento.

### 5. Sincronização de Gravação com Preroll

- **O que foi feito:** A gravação agora começa exatamente quando o número "1" do preroll é exibido.
- **O que testar:** Verificar se a gravação começa no momento exato em que o "1" do preroll é exibido.

### 6. Estilização do Preroll

- **O que foi feito:** O contador de preroll agora é exibido em vermelho e em negrito.
- **O que testar:** Verificar se o contador de preroll está estilizado corretamente.

### 7. Remoção dos Filtros da Aba de Gravações

- **O que foi feito:** O menu de filtros da aba de gravações foi completamente removido.
- **O que testar:** Verificar se o menu de filtros não está mais presente na aba de gravações.

### 8. Substituição de "Versão" por Nome do Dublador

- **O que foi feito:** O campo "Versão" na aba de gravações foi substituído pelo nome do dublador.
- **O que testar:** Verificar se o nome do dublador é exibido corretamente na aba de gravações.

### 9. Sincronização de Playback em Tempo Real

- **O que foi feito:** O play/pause em qualquer vídeo afeta simultaneamente todos os vídeos na sala.
- **O que testar:**
    - Verificar se o play/pause em um vídeo afeta todos os outros vídeos na sala.
    - Verificar se os timestamps dos vídeos permanecem sincronizados.

### 10. Simplificação do Menu de Seleção de Dispositivos

- **O que foi feito:** O menu de seleção de dispositivos foi simplificado, removendo os testes de microfone e saída.
- **O que testar:** Verificar se o menu de seleção de dispositivos contém apenas os controles esperados.

### 11. Refinamento Visual Completo

- **O que foi feito:** Realizado um refinamento visual completo da sala de gravação, incluindo alinhamento à grade de 8px, espaçamentos consistentes, padronização de ícones, hierarquia visual clara e responsividade.
- **O que testar:** Verificar se a interface da sala de gravação está visualmente consistente e responsiva em diferentes resoluções de tela.
