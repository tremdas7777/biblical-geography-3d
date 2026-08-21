# Biblical Geography 3D - clone do funil

Clone estatico do funil `biblical-geography-3d-v3.vercel.app`.

## Rodar local (com analytics + admin)

```bash
cd biblical-geography-3d/server
npm install
npm start
```

- Landing: http://localhost:8090
- **Admin:** http://localhost:8090/admin/ (senha padrão `admin123`)

Defina uma senha segura:

```bash
ADMIN_PASSWORD=sua_senha npm start
```

### Painel admin

- **Live View** — visitantes online nos últimos 5 min
- **Funil** — visita → engajamento → preview → oferta → checkout
- **Carrinhos** — leads que clicaram no botão de compra (KashPay)
- **Períodos** — 1h, hoje, 24h, 7d, 30d, tudo
- Gráficos de tráfego, idioma, dispositivo e origem UTM

> GitHub Pages serve só arquivos estáticos. Para analytics funcionar em produção, hospede o `/server` (Render, Railway, VPS) e configure `analyticsApi` em `config.js`.

Modo estático (sem analytics):

```bash
python3 -m http.server 8090
```

## Idiomas (EN / ES)

O visitante alterna entre **English** e **Español** pelo botão fixo no canto superior direito. O idioma padrão é **Español**; a preferência fica salva no navegador (`localStorage`).

- Textos: `i18n.js`
- Imagens em espanhol: `assets/es/` — recriacoes de alta fidelidade a partir dos originais EN, com todo o texto traduzido

Para validar os assets ES:

```bash
python3 scripts/generate_es_images.py
```

## Antes de publicar

Edite `config.js`:

```js
checkoutUrl: "https://pay.hotmart.com/SEU_PRODUTO?checkoutMode=10",
metaPixelId: "SEU_PIXEL",
gtagId: "G-XXXXXXXXXX",
```

O checkout (Hotmart `P107005363A`) e os pixels do funil original (Meta
`2521051031655568` e GB Trackify) foram **removidos**. Sem trocar por dados
seus, as vendas e o rastreamento iriam para o dono da oferta original.

## Estrutura

```
index.html     landing completa (EN/ES)
analytics.js   tracking do funil (visitas, scroll, checkout)
admin/         painel admin (live, funil, carrinhos)
server/        API Node + SQLite
styles.css     estilos originais
script.js      countdown, FAQ, checkout, pixels
i18n.js        traducoes EN/ES + seletor de idioma
config.js      suas configuracoes
assets/        28 imagens .webp (EN)
assets/es/     imagens em espanhol
scripts/       gerador de assets ES
_raw/          copia intacta do original (referencia)
```

## Aviso

Imagens, textos e depoimentos sao do produto original. Para uso proprio,
troque por material seu - principalmente depoimentos e numeros ("4.000+
leitores", "18 pessoas vendo agora"), que so podem ser usados se forem
verdadeiros para a sua oferta.
