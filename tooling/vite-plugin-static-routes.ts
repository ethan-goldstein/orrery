import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export interface StaticRoute {
  path: string;
  title: string;
  description: string;
}

/**
 * GitHub Pages has no SPA fallback. After the build we copy index.html to
 * dist/<route>/index.html for every route (with its own <title> and
 * description) and to dist/404.html so deep links resolve.
 */
export function staticRoutes(routes: StaticRoute[]): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'orrery:static-routes',
    apply: 'build',
    configResolved(c) {
      config = c;
    },
    writeBundle() {
      const outDir = config.build.outDir;
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      const stamp = (r: StaticRoute) =>
        html
          .replace(/<title>[^<]*<\/title>/, `<title>${escape(r.title)}</title>`)
          .replace(
            /<meta name="description" content="[^"]*"/,
            `<meta name="description" content="${escape(r.description)}"`,
          );
      for (const r of routes) {
        if (r.path === '/') continue;
        const dir = join(outDir, r.path.replace(/^\//, ''));
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.html'), stamp(r));
      }
      writeFileSync(join(outDir, '404.html'), html);
    },
  };
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
