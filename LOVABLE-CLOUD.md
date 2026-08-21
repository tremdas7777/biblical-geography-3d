# Ativar Lovable Cloud — Biblical Geography 3D

## Cole este prompt no chat do Lovable

```
Ative o Lovable Cloud neste projeto.

Depois execute a migration SQL em supabase/migrations/20250821140000_bg3d_analytics.sql
(cria tabelas bg3d_events e bg3d_sessions com trigger e RLS para analytics do funil).

Crie um usuário admin no Auth:
- email: admin@thebiblicalgeography.com
- senha: [escolha uma senha forte]

Preencha config.js com:
- supabaseUrl = URL do projeto Cloud
- supabaseAnonKey = chave anon/public do Cloud
- adminEmail = admin@thebiblicalgeography.com

Confirme que /admin/ funciona com login Supabase, live view, funil, carrinhos e filtros por período (1h, hoje, 24h, 7d, 30d, tudo).
```

## Passo a passo manual (se preferir)

### 1. Ativar Cloud
Lovable → aba **Cloud** (menu More) → ativar / Enable Cloud

### 2. Rodar SQL
Cloud → **SQL editor** → cole o conteúdo de `supabase/schema.sql` → Run

### 3. Criar admin
Cloud → **Users** → Add user  
- E-mail: `admin@thebiblicalgeography.com`  
- Senha: a sua escolha

### 4. Copiar credenciais
Cloud → **Overview** ou **Settings** → copie:
- Project URL → `supabaseUrl` em `config.js`
- anon / publishable key → `supabaseAnonKey` em `config.js`

### 5. Publicar
```bash
git push lovable main
```
No Lovable clique **Publish**.

### 6. Acessar
- Site: https://thebiblicalgeography.com/
- Admin: https://thebiblicalgeography.com/admin/
- Login: e-mail + senha do passo 3

## Notas
- O build do Lovable injeta credenciais Cloud automaticamente se as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` existirem no ambiente.
- Tracking do funil grava em `bg3d_events` via `analytics.js`.
- Admin lê `bg3d_sessions` e `bg3d_events` após login Supabase Auth.
