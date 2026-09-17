import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

export interface StaticRoute {
  path: string;
  id: string;
  title: string;
  description: string;
}

export interface StaticRoutesOptions {
  /** absolute origin of the deployed site, for canonical links, OG urls and the sitemap */
  site: string;
}

/**
 * GitHub Pages has no SPA fallback. After the build we copy index.html to
 * dist/<route>/index.html for every route, stamped with its own title,
 * description, Open Graph card (icons/og-<id>.jpg when one exists) and
 * canonical address, plus dist/404.html so deep links resolve, and a
 * sitemap and robots.txt for crawlers.
 */
export function staticRoutes(routes: StaticRoute[], opts: StaticRoutesOptions): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'orrery:static-routes',
    apply: 'build',
    configResolved(c) {
      config = c;
    },
    writeBundle() {
      const outDir = config.build.outDir;
      const base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      const origin = opts.site.replace(/\/$/, '');
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      const urlOf = (r: StaticRoute) => `${origin}${base}${r.path.replace(/^\//, '')}${r.path === '/' ? '' : '/'}`;
      const cardOf = (r: StaticRoute) => {
        const own = `icons/og-${r.id}.jpg`;
        return `${origin}${base}${existsSync(join(outDir, own)) ? own : 'icons/og.jpg'}`;
      };
      const stamp = (r: StaticRoute) =>
        html
          .replace(/<title>[^<]*<\/title>/, `<title>${escape(r.title)}</title>`)
          .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${escape(r.description)}"`)
          .replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${escape(r.title)}"`)
          .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${escape(r.description)}"`)
          .replace(/<meta property="og:image" content="[^"]*"/, `<meta property="og:image" content="${cardOf(r)}"`)
          .replace(/<meta property="og:type" content="website" \/>/, `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${urlOf(r)}" />\n    <link rel="canonical" href="${urlOf(r)}" />`);
      for (const r of routes) {
        if (r.path === '/') {
          writeFileSync(join(outDir, 'index.html'), stamp(r));
          continue;
        }
        const dir = join(outDir, r.path.replace(/^\//, ''));
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.html'), stamp(r));
      }
      writeFileSync(join(outDir, '404.html'), html);
      const today = new Date().toISOString().slice(0, 10);
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
        .map((r) => `  <url><loc>${urlOf(r)}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${r.path === '/' ? '1.0' : '0.8'}</priority></url>`)
        .join('\n')}\n</urlset>\n`;
      writeFileSync(join(outDir, 'sitemap.xml'), sitemap);
      writeFileSync(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}${base}sitemap.xml\n`);
    },
  };
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
