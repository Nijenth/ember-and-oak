# Ember & Oak: café website

A fast, production-ready café website with a 3D coffee cup, built with [Astro](https://astro.build). Café staff update the menu, prices, hours and text from a simple admin panel at `/keystatic`, with no code involved.

## What's inside

| | |
|---|---|
| **Astro 7** | Builds the site as plain HTML, so pages load fast and rank well in search. |
| **Keystatic** | The admin panel staff use. Edits are saved as small JSON files in `src/content/`. |
| **Three.js** | The 3D cup, saucer, beans and steam. Loaded only after the page is ready, and skipped on data-saver or very low-end phones (an illustrated cup shows instead). |
| **Cloudflare Workers** | Hosting on the free plan, which allows business use. Pages are served as static files; only the admin panel runs as code. |

Also included: search-engine tags, link previews (`public/og.png`), structured data so Google can show your address and hours, a sitemap, `robots.txt`, a 404 page, keyboard and screen-reader support, and six colour themes.

## Run it on your computer

You need **Node.js 24** (or 22.23.4 or newer). Check with `node -v`.

```bash
npm install
npm run dev
```

- Website: http://127.0.0.1:4321
- Admin panel: http://127.0.0.1:4321/keystatic

Edits made in the admin while running locally are written straight into `src/content/`.

Other commands:

```bash
npm run build     # production build into dist/
npm run preview   # run that build locally on Cloudflare's runtime (after npm run build)
npm run check     # type-check everything
```

`npm run dev` runs on Node so the admin can save files; builds target Cloudflare.

## Project layout

```
keystatic.config.ts      Admin panel: every form field staff can edit
astro.config.mjs         Site settings, hosting adapter, sitemap
wrangler.jsonc           Cloudflare Workers settings
src/
  content/               ← All editable content (JSON). Staff edit these via /keystatic.
    settings.json          Café name, address, phone, currency, theme, links
    hours.json             Opening hours
    homepage.json          Hero, banner, section text
    drinks/*.json          One file per drink
    origins/*.json         One file per coffee on bar
  data/themes.ts         The six colour/font themes (and the 3D cup's colours for each)
  components/            Header, Hero, Ticker, Beans, Menu, Visit, Footer…
  layouts/Base.astro     <head>: SEO tags, structured data, fonts
  pages/                 index, 404, robots.txt
  scripts/site.ts        Theme switcher, menu tabs, "open now" badge
  scripts/cup3d.ts       The 3D scene
  styles/global.css      All styles
public/                  Favicon, link-preview image, _headers (caching and security headers)
```

## Go live (Cloudflare, free)

1. **Sign in** at [dash.cloudflare.com](https://dash.cloudflare.com) (a free account is enough).
2. Go to **Compute → Workers & Pages → Create application → Import a repository**, connect GitHub and pick **ember-and-oak**.
3. Use these build settings:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy` (the default)
4. Under **Build variables**, add `SITE_URL` = your live address (for now, the `https://ember-and-oak.<your-subdomain>.workers.dev` address Cloudflare gives you; change it once you add a domain).
5. Click **Deploy**. The site is live at its `workers.dev` address in a minute or two.
6. **Your own domain:** Worker → **Settings → Domains & Routes → Add → Custom domain**. HTTPS is automatic.

Every push to GitHub (including every save in the admin, see below) rebuilds and redeploys the site.

If a build ever fails with a Node version error, add the build variable `NODE_VERSION` = `24`.

## Let staff edit the live site

On the live site, the admin needs somewhere to save. The easiest option for café staff is **Keystatic Cloud**: they sign in with their email and don't need a GitHub account. It's free for up to 3 people.

1. Sign up at [keystatic.cloud](https://keystatic.cloud), create a team and a project, and connect it to your GitHub repository.
2. Copy the project name it shows you (it looks like `your-team/ember-and-oak`).
3. In Cloudflare, open the Worker → **Settings → Build → Build variables**, add `PUBLIC_KEYSTATIC_CLOUD_PROJECT` with that value, and redeploy.
4. Invite staff from the Keystatic Cloud dashboard. They go to `https://your-domain.com/keystatic`, sign in, edit, and press **Save**. The site updates a minute or two later.

**Alternative:** if everyone who edits has a GitHub account, add the build variable `PUBLIC_KEYSTATIC_GITHUB_REPO=your-name/ember-and-oak`, plus `PUBLIC_KEYSTATIC_GITHUB_APP_SLUG` both as a build variable and as a runtime variable. The other three GitHub values (`KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET`) are secrets the Worker reads while running, so they go under **Settings → Variables and Secrets** instead, as type *Secret*. See `.env.example`.

Until one of these is set, the admin is left out of the live build (it only runs on your computer), so nobody can reach a half-working `/keystatic` page, and the site deploys as plain static files.

There's a one-page guide for staff in [STAFF_GUIDE.md](STAFF_GUIDE.md).

## Before launch: replace the sample content

- [ ] **Café details** (admin → Café details): name, address, phone, time zone, currency and number format. The time zone drives the "Open now" badge.
- [ ] **Opening hours**, **Drinks**, **Coffees on bar**, **Homepage text**.
- [ ] **Ordering link**: the "Order ahead" button only appears once this is filled in.
- [ ] **Link-preview image**: `public/og.png` (1200 × 630) currently shows the sample headline. Replace it with a photo or a screenshot of your finished homepage.
- [ ] **Favicon**: `public/favicon.svg`, `favicon.ico` and `apple-touch-icon.png` use the bean mark. Swap in your logo if you have one.
- [ ] **Theme**: pick one in Café details, and decide whether visitors can switch (the swatches in the header).
- [ ] Set `SITE_URL` to your final domain in Cloudflare (see above), then submit `https://your-domain.com/sitemap-index.xml` in [Google Search Console](https://search.google.com/search-console) and claim your [Google Business Profile](https://business.google.com).

## Customising

- **Theme colours and fonts:** `src/data/themes.ts`. Each theme also sets the 3D cup, saucer and bean colours.
- **Cup size:** `CUP_SIZE` near the top of `src/scripts/cup3d.ts`.
- **Add a field staff can edit:** add it to `keystatic.config.ts`, then use it in the component. `src/lib/content.ts` is where content is read.
- **Host elsewhere:** swap the adapter in `astro.config.mjs` (for example `@astrojs/netlify` or `@astrojs/vercel`) and delete `wrangler.jsonc` and `public/_headers`.

## Good next steps

- Real photos of the café, drinks and beans (Astro's `<Image>` component resizes and compresses them automatically).
- Privacy-friendly analytics: Cloudflare Web Analytics is free and needs no cookie banner.
- A contact or catering form, using a form service such as Formspree or a small Worker route.
