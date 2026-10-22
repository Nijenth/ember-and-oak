// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';
import keystatic from '@keystatic/astro';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const SITE_URL = env.SITE_URL || process.env.URL || 'https://example.com';
const remoteCms = Boolean(env.PUBLIC_KEYSTATIC_CLOUD_PROJECT || env.PUBLIC_KEYSTATIC_GITHUB_REPO);

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

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  adapter: netlify(),
  compressHTML: true,
  integrations: [
    react(),
    cms(),
    sitemap({ filter: (page) => !page.includes('/keystatic') && !page.includes('/404') }),
  ],
});
