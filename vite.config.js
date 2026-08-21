import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT_JS = ['config.js', 'i18n.js', 'analytics.js', 'script.js'];

function copyFunnelStatic() {
  return {
    name: 'copy-funnel-static',
    closeBundle() {
      const dist = join(process.cwd(), 'dist');
      for (const file of ROOT_JS) {
        cpSync(join(process.cwd(), file), join(dist, file));
      }
      const assetsSrc = join(process.cwd(), 'assets');
      if (existsSync(assetsSrc)) {
        cpSync(assetsSrc, join(dist, 'assets'), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: false,
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
