import { defineConfig } from 'vite';
import { cpSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT_JS = ['config.js', 'i18n.js', 'analytics.js', 'script.js'];

function cloudEnv() {
  return {
    supabaseUrl:
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.LOVABLE_SUPABASE_URL ||
      '',
    supabaseAnonKey:
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.LOVABLE_SUPABASE_ANON_KEY ||
      '',
  };
}

function patchConfig(sourcePath, destPath) {
  let content = readFileSync(sourcePath, 'utf8');
  const env = cloudEnv();

  if (env.supabaseUrl) {
    content = content.replace(
      /supabaseUrl:\s*"[^"]*"/,
      'supabaseUrl: "' + env.supabaseUrl.replace(/"/g, '') + '"'
    );
  }
  if (env.supabaseAnonKey) {
    content = content.replace(
      /supabaseAnonKey:\s*"[^"]*"/,
      'supabaseAnonKey: "' + env.supabaseAnonKey.replace(/"/g, '') + '"'
    );
  }

  writeFileSync(destPath, content);
}

function copyFunnelStatic() {
  return {
    name: 'copy-funnel-static',
    closeBundle() {
      const dist = join(process.cwd(), 'dist');
      for (const file of ROOT_JS) {
        const src = join(process.cwd(), file);
        const dest = join(dist, file);
        if (file === 'config.js') patchConfig(src, dest);
        else cpSync(src, dest);
      }
      const assetsSrc = join(process.cwd(), 'assets');
      if (existsSync(assetsSrc)) {
        cpSync(assetsSrc, join(dist, 'assets'), { recursive: true });
      }
      const adminSrc = join(process.cwd(), 'admin');
      if (existsSync(adminSrc)) {
        cpSync(adminSrc, join(dist, 'admin'), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: { port: 8080, host: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  plugins: [copyFunnelStatic()],
});
