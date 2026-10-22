// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';
import keystatic from '@keystatic/astro';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const SITE_URL = env.SITE_URL || 'https://example.com';
const remoteCms = Boolean(env.PUBLIC_KEYSTATIC_CLOUD_PROJECT || env.PUBLIC_KEYSTATIC_GITHUB_REPO);

// `npm run dev` runs on Node so the admin panel can save edits straight into src/content/.
// Builds target Cloudflare Workers.
const isDev = process.argv.slice(2).includes('dev');

/**
 * The admin panel (/keystatic) is always available in `npm run dev`.
 * In a production build it is only included once Keystatic Cloud or GitHub
 * storage is configured, because "local" storage can't save on a live server.
 */
function cms() {
  const k = keystatic();
  return {
    name: 'keystatic-when-configured',
    hooks: {
      /** @param {any} opts */
      'astro:config:setup': (opts) => {
        if (opts.command === 'dev' || remoteCms) return k.hooks['astro:config:setup']?.(opts);
      },
    },
  };
}

/**
 * Without the admin panel the build is plain static files with no Worker script,
 * and Cloudflare rejects `run_worker_first` in that case, so drop it from the output.
 */
function staticDeployFix() {
  return {
    name: 'static-deploy-fix',
    hooks: {
      'astro:build:done': () => {
        const file = new URL('./dist/client/wrangler.json', import.meta.url);
        if (!existsSync(file)) return;
        const cfg = JSON.parse(readFileSync(file, 'utf8'));
        if (!cfg.main && cfg.assets?.run_worker_first) {
          delete cfg.assets.run_worker_first;
          writeFileSync(file, JSON.stringify(cfg));
        }
      },
    },
  };
}

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  // Cloudflare Workers: static pages are served as files; only the admin panel runs as code.
  // Pages are prerendered in Node because they read the content files from disk;
  // images (if you add any with <Image>) are optimised at build time, so no paid image service is needed.
  adapter: isDev ? node({ mode: 'standalone' }) : cloudflare({ prerenderEnvironment: 'node', imageService: 'compile' }),
  // No server-side sessions needed (avoids provisioning a KV store).
  session: false,
  compressHTML: true,
  integrations: [
    react(),
    cms(),
    sitemap({ filter: (page) => !page.includes('/keystatic') && !page.includes('/404') }),
    staticDeployFix(),
  ],
});
