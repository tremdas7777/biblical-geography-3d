import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const pub = join(root, 'public');

if (existsSync(pub)) rmSync(pub, { recursive: true });
mkdirSync(pub, { recursive: true });

cpSync(join(root, 'admin'), join(pub, 'admin'), { recursive: true });

writeFileSync(
  join(pub, '_redirects'),
  '/admin    /admin/index.html   200\n/admin/   /admin/index.html   200\n'
);

console.log('prebuild: public/admin ready');
