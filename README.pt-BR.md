# TravaLive

[English](README.md) · **[Português](README.pt-BR.md)**

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/efghjheocblnlfgimdhnapdlmojijoaa?label=chrome%20web%20store)](https://chromewebstore.google.com/detail/travalive/efghjheocblnlfgimdhnapdlmojijoaa)
[![release](https://img.shields.io/github/v/release/loadez/travalive)](https://github.com/loadez/travalive/releases/latest)
![license](https://img.shields.io/badge/license-GPL--3.0--only-blue)
![manifest](https://img.shields.io/badge/manifest-v3-brightgreen)
![sem build](https://img.shields.io/badge/build-nenhum-lightgrey)

Trava uma **live** do YouTube num atraso fixo pra você e a galera ficarem **em sincronia, no mesmo frame** —
todo mundo reage ao gol no mesmo instante. Feito pras resenhas das lives da Copa 2026 no Discord.

## Instalar

**Um clique:** [**Instalar pela Chrome Web Store**](https://chromewebstore.google.com/detail/travalive/efghjheocblnlfgimdhnapdlmojijoaa) (funciona no Chrome / Brave / Edge / qualquer Chromium). Firefox Add-ons _(em análise — em breve)_.

**Agora (manual):** baixe a [última release](https://github.com/loadez/travalive/releases/latest), descompacte e carregue sem empacotar:
- **Chrome / Brave / Edge:** `chrome://extensions` → *Modo do desenvolvedor* → *Carregar sem compactação* → a pasta descompactada
- **Firefox:** `about:debugging#/runtime/this-firefox` → *Carregar extensão temporária* → `manifest.json` _(temporário — some ao reiniciar)_

Abra uma live, clique no ícone, defina o atraso alvo. Todo mundo do grupo coloca o **mesmo número** → sincronizado. **Cada live guarda o próprio atraso** (cada uma tem uma latência mínima diferente), então o slider do popup define o alvo da live que você está assistindo. Um HUD de debug opcional (desligado por padrão) mostra o status da sincronia.

## Como funciona

O player do YouTube já sabe quantos segundos atrás do ao vivo você está — a mesma referência pra todos — então não precisa de relógio próprio/NTP:

1. Lê a **Live Latency** do próprio YouTube — o mesmo número que todo viewer vê.
2. Ajusta `video.playbackRate` (até **2×** pra alcançar, até **0,8×** pra recuar suavemente) e trava no seu alvo.
3. Mesmo alvo pra todos → mesmo frame capturado → **sincronizado**.

Só age numa **live** e só enquanto você está no **ao vivo** — se você volta pra rever um lance, ele não mexe na sua velocidade. **Nunca altera a velocidade de anúncios nem de vídeos normais (não ao vivo)** (não pula nem adianta nada — só não encosta neles). HUD opcional (canto superior esquerdo): `lat 12.3s → 10s  1.20x`.

## Limites

- Não dá pra ficar mais perto do ao vivo do que a latência real da transmissão — o player não mostra frames que ainda não chegaram.
- A aceleração de 2× deixa o áudio "esquilo" (correção de tom está no roadmap).

## Privacidade e permissões

Sem coleta de dados, sem servidores, sem requisições de rede. Só salva suas configurações (alvo + chaves) localmente via `chrome.storage.sync`. A única permissão é `storage`; os content scripts rodam apenas em `youtube.com/watch*` e `/live/*`.

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md). É JavaScript puro — sem build, sem dependências.

## Licença

[GPL-3.0-only](LICENSE) — Somente GNU General Public License v3.0.
