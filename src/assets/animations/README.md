# Animações dos mascotes

## Arquivos fornecidos pelo usuário

| Arquivo local | Mascote | Arquivo original |
| --- | --- | --- |
| `mascote-fogo.json` | Foguinho | `Fire.json` |
| `mascote-gato-chorando.json` | Gatinho Chorão | `Cat Crying emojiSticker animation.json` |

Adicionados em 12/10/2026 a partir dos arquivos locais fornecidos pelo usuário,
sem alterações nas animações. Ambos são carregados sob demanda e usam o mesmo
ciclo de exibição dos demais mascotes.

## Animações do LottieFiles

Os quatro arquivos abaixo foram obtidos no LottieFiles em 12/10/2026 e são
distribuídos sob a [Lottie Simple License](https://lottiefiles.com/page/license),
reproduzida em `LICENSE-LottieFiles.txt` e publicada com o app em
`public/licenses/mascotes-lottie.txt`. A serialização JSON foi compactada.
No robô, foram removidas as duas camadas do balão de texto para usar somente
o personagem. Essa adaptação mantém a mesma licença. Não dependem de imagens externas.

| Arquivo | Mascote na loja | Obra e autoria |
| --- | --- | --- |
| `mascote-robo.json` | Robozinho Faísca | [happy-robot — Lamia Bb](https://lottiefiles.com/free-animation/happy-robot-cgzej5O78T) |
| `mascote-raposa.json` | Raposa Astuta | [Fox — Aaron Will Djaba](https://lottiefiles.com/free-animation/fox-animation-VSmva6GqIa) |
| `mascote-pinguim.json` | Pinguim Geladinho | [Penguin — Apps for kids](https://lottiefiles.com/free-animation/penguin-suoTc6cgYl) |
| `mascote-astronauta.json` | Astro, o Explorador | [Astronaut — Alexander Rozhkov](https://lottiefiles.com/free-animation/astronaut-3unpgoOrkw) |

Cada animação é carregada sob demanda pelo componente `MascoteGato.vue`.
Os mascotes aparecem em prévia contínua na loja; no perfil, seguem o ciclo
existente de 5 segundos visíveis e 10 segundos de descanso. A preferência
por movimento reduzido e a pausa ao ocultar a aba continuam respeitadas.

Esta licença se aplica aos quatro arquivos listados. Os mascotes anteriores
(`loader-cat.json` e `mascote-saltitante.json`) não foram substituídos.
