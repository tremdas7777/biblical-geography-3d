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

Acesse **http://localhost:8090/admin/** (senha padrão `admin123`).

| Aba | O que mostra |
|-----|----------------|
| **Dashboard** | KPIs, tráfego no tempo, funil rápido, idioma/device/UTM, eventos |
| **Live View** | Visitantes online agora, seção atual, scroll, funil em tempo real (5s) |
| **Análises** | Profundidade de scroll, tipos de evento, CTAs mais clicados |
| **Funil** | Visita → engajamento → preview → oferta → checkout |
| **Sessões** | Todas as sessões do período selecionado |
| **Carrinhos** | Leads que clicaram no checkout KashPay |

**Períodos:** 1h · Hoje · 24h · 7d · 30d · Tudo

### Publicar admin + analytics online (Render)

1. Crie conta em [render.com](https://render.com)
2. **New → Web Service** → repo `biblical-geography-3d`
3. **Root Directory:** `server`
4. **Build:** `npm install` · **Start:** `npm start`
5. Defina `ADMIN_PASSWORD` nas variáveis de ambiente
6. Após deploy, copie a URL (ex.: `https://bg3d-analytics.onrender.com`)
7. Em `config.js` da landing:

```js
analyticsApi: "https://bg3d-analytics.onrender.com"
```

8. Admin online: `https://bg3d-analytics.onrender.com/admin/`

> O Lovable só serve HTML estático. O servidor Node roda separado (Render, Railway, VPS).

### Admin no Lovable (recomendado — mesmo domínio)

1. Lovable → **Settings → Cloud** → ative o backend
2. SQL Editor → execute `supabase/schema.sql`
3. **Auth → Users** → crie `admin@thebiblicalgeography.com` (ou o e-mail em `config.js`)
4. Preencha em `config.js`:

```js
supabaseUrl: "https://SEU_PROJETO.supabase.co",
supabaseAnonKey: "eyJ...",
adminEmail: "admin@thebiblicalgeography.com"
```

5. `git push lovable main` → Publish
6. **https://thebiblicalgeography.com/admin/** (senha = usuário Supabase Auth)

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
