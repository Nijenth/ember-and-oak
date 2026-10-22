# Ember & Oak: café website

A fast, production-ready café website with a 3D coffee cup, built with [Astro](https://astro.build). Café staff update the menu, prices, hours and text from a simple admin panel at `/keystatic`, with no code involved.

## What's inside

| | |
|---|---|
| **Astro 7** | Builds the site as plain HTML, so pages load fast and rank well in search. |
| **Keystatic** | The admin panel staff use. Edits are saved as small JSON files in `src/content/`. |
| **Three.js** | The 3D cup, saucer, beans and steam. Loaded only after the page is ready, and skipped on data-saver or very low-end phones (an illustrated cup shows instead). |
| **Netlify** | Hosting (free tier is plenty). Switching to Vercel or Cloudflare is a one-line change. |

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
npm run build   # production build into dist/
npm run check   # type-check everything
```

## Project layout

```
keystatic.config.ts      Admin panel: every form field staff can edit
astro.config.mjs         Site settings, hosting adapter, sitemap
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
public/                  Favicon, link-preview image
```

## Go live (Netlify)

1. **Put the project on GitHub.** Create an empty repository, then from this folder:
   ```bash
   git remote add origin https://github.com/YOUR-NAME/ember-and-oak.git
   git push -u origin main
   ```
2. **Create the site on Netlify.** Netlify → *Add new site* → *Import an existing project* → pick the repository. The build settings are read from `netlify.toml`, so just click *Deploy*.
3. **Set your address.** Netlify → *Site configuration* → *Environment variables* → add `SITE_URL` = `https://your-domain.com`. Redeploy.
4. **Connect your domain.** Netlify → *Domain management* → *Add a domain*, then follow the DNS steps. HTTPS is automatic.

Every push to GitHub (including every save in the admin, see below) rebuilds the site in about a minute.

## Let staff edit the live site

On the live site, the admin needs somewhere to save. The easiest option for café staff is **Keystatic Cloud**: they sign in with their email and don't need a GitHub account. It's free for up to 3 people.

1. Sign up at [keystatic.cloud](https://keystatic.cloud), create a team and a project, and connect it to your GitHub repository.
2. Copy the project name it shows you (it looks like `your-team/ember-and-oak`).
3. In Netlify, add the environment variable `PUBLIC_KEYSTATIC_CLOUD_PROJECT` with that value, and redeploy.
4. Invite staff from the Keystatic Cloud dashboard. They go to `https://your-domain.com/keystatic`, sign in, edit, and press **Save**. The site updates about a minute later.

**Alternative:** if everyone who edits has a GitHub account, set `PUBLIC_KEYSTATIC_GITHUB_REPO=your-name/ember-and-oak` instead. The first visit to `/keystatic` walks you through creating a GitHub App; see `.env.example` for the variables it needs.

Until one of these is set, the admin is left out of the live build (it only runs on your computer), so nobody can reach a half-working `/keystatic` page.

There's a one-page guide for staff in [STAFF_GUIDE.md](STAFF_GUIDE.md).

## Before launch: replace the sample content

- [ ] **Café details** (admin → Café details): name, address, phone, time zone, currency and number format. The time zone drives the "Open now" badge.
- [ ] **Opening hours**, **Drinks**, **Coffees on bar**, **Homepage text**.
- [ ] **Ordering link**: the "Order ahead" button only appears once this is filled in.
- [ ] **Link-preview image**: `public/og.png` (1200 × 630) currently shows the sample headline. Replace it with a photo or a screenshot of your finished homepage.
- [ ] **Favicon**: `public/favicon.svg`, `favicon.ico` and `apple-touch-icon.png` use the bean mark. Swap in your logo if you have one.
- [ ] **Theme**: pick one in Café details, and decide whether visitors can switch (the swatches in the header).
- [ ] Set `SITE_URL` on Netlify (see above), then submit `https://your-domain.com/sitemap-index.xml` in [Google Search Console](https://search.google.com/search-console) and claim your [Google Business Profile](https://business.google.com).

## Customising

- **Theme colours and fonts:** `src/data/themes.ts`. Each theme also sets the 3D cup, saucer and bean colours.
- **Cup size:** `CUP_SIZE` near the top of `src/scripts/cup3d.ts`.
- **Add a field staff can edit:** add it to `keystatic.config.ts`, then use it in the component. `src/lib/content.ts` is where content is read.
- **Host on Vercel instead:** `npm i @astrojs/vercel`, then in `astro.config.mjs` replace `netlify()` with `vercel()` (import from `@astrojs/vercel`). Delete `netlify.toml`.

## Good next steps

- Real photos of the café, drinks and beans (Astro's `<Image>` component resizes and compresses them automatically).
- Privacy-friendly analytics, such as Plausible or Netlify Analytics.
- A contact or catering form (Netlify Forms works with a single `data-netlify="true"` attribute).
