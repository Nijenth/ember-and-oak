/**
 * Keystatic: the admin panel staff use at /keystatic to edit the site.
 *
 * Every field below becomes a form in the admin. Edits are saved as JSON files
 * in src/content/, and the site rebuilds from those files.
 *
 * Where edits are saved depends on environment variables (see .env.example):
 *   - nothing set                   → "local": edits write straight to this folder (for npm run dev)
 *   - PUBLIC_KEYSTATIC_CLOUD_PROJECT → Keystatic Cloud: staff sign in with email, no GitHub account needed
 *   - PUBLIC_KEYSTATIC_GITHUB_REPO  → GitHub: staff sign in with their own GitHub accounts
 */
import { config, fields, collection, singleton } from '@keystatic/core';
import { THEME_OPTIONS } from './src/data/themes';

const cloudProject = import.meta.env.PUBLIC_KEYSTATIC_CLOUD_PROJECT as string | undefined;
const githubRepo = import.meta.env.PUBLIC_KEYSTATIC_GITHUB_REPO as `${string}/${string}` | undefined;

const storage = cloudProject
  ? ({ kind: 'cloud' } as const)
  : githubRepo
    ? ({ kind: 'github', repo: githubRepo } as const)
    : ({ kind: 'local' } as const);

const time = (label: string, defaultValue: string) =>
  fields.text({
    label,
    defaultValue,
    validation: { pattern: { regex: /^([01]\d|2[0-3]):[0-5]\d$/, message: 'Use 24-hour time, like 07:00 or 18:30' } },
  });

const day = (label: string, open: string, close: string) =>
  fields.object(
    {
      closed: fields.checkbox({ label: 'Closed all day', defaultValue: false }),
      open: time('Opens', open),
      close: time('Closes', close),
    },
    { label },
  );

const hexColor = (label: string, defaultValue: string, description?: string) =>
  fields.text({
    label,
    defaultValue,
    description,
    validation: { pattern: { regex: /^#[0-9a-fA-F]{6}$/, message: 'Use a hex colour like #A87148' } },
  });

export default config({
  storage,
  ...(cloudProject ? { cloud: { project: cloudProject } } : {}),

  ui: {
    brand: { name: 'Ember & Oak' },
    navigation: {
      'Café': ['settings', 'hours'],
      Menu: ['drinks', 'origins'],
      Website: ['homepage'],
    },
  },

  singletons: {
    settings: singleton({
      label: 'Café details',
      path: 'src/content/settings',
      format: { data: 'json' },
      schema: {
        name: fields.text({ label: 'Café name', validation: { isRequired: true } }),
        tagline: fields.text({ label: 'Tagline', description: 'Short line under the name in search results and link previews.' }),
        description: fields.text({
          label: 'Search description',
          multiline: true,
          description: 'One or two sentences that Google and social media show for the site. Aim for 120–160 characters.',
          validation: { length: { max: 200 } },
        }),
        phone: fields.text({ label: 'Phone number', description: 'Include the country code, e.g. +1 555 0142' }),
        email: fields.text({ label: 'Email (optional)' }),
        address: fields.object(
          {
            street: fields.text({ label: 'Street address', validation: { isRequired: true } }),
            area: fields.text({ label: 'Area / neighbourhood (optional)' }),
            city: fields.text({ label: 'City', validation: { isRequired: true } }),
            region: fields.text({ label: 'State / region' }),
            postalCode: fields.text({ label: 'Postal code' }),
            country: fields.text({ label: 'Country code', description: 'Two letters, e.g. US, GB, IN', defaultValue: 'US' }),
          },
          { label: 'Address' },
        ),
        mapsUrl: fields.url({
          label: 'Google Maps link (optional)',
          description: 'Paste the share link for your café on Google Maps. If empty, directions search for the address.',
        }),
        orderUrl: fields.url({
          label: 'Online ordering link (optional)',
          description: 'Swiggy, Zomato, Square, Toast, your own page… The "Order ahead" button only appears when this is set.',
        }),
        instagram: fields.url({ label: 'Instagram link (optional)' }),
        currency: fields.select({
          label: 'Currency',
          defaultValue: 'USD',
          options: [
            { label: 'US dollar ($)', value: 'USD' },
            { label: 'Indian rupee (₹)', value: 'INR' },
            { label: 'Euro (€)', value: 'EUR' },
            { label: 'British pound (£)', value: 'GBP' },
            { label: 'Australian dollar (A$)', value: 'AUD' },
            { label: 'Canadian dollar (C$)', value: 'CAD' },
            { label: 'Singapore dollar (S$)', value: 'SGD' },
            { label: 'UAE dirham (AED)', value: 'AED' },
          ],
        }),
        locale: fields.text({
          label: 'Number format',
          defaultValue: 'en-US',
          description: 'How prices are written. en-US → $4.50, en-IN → ₹450.00, en-GB → £4.50',
        }),
        timeZone: fields.text({
          label: 'Time zone',
          defaultValue: 'America/New_York',
          description: 'Used for the "Open now" badge. Examples: America/New_York, Europe/London, Asia/Kolkata',
        }),
        theme: fields.select({
          label: 'Site theme',
          defaultValue: 'espresso',
          options: THEME_OPTIONS,
        }),
        showThemeSwitcher: fields.checkbox({
          label: 'Let visitors switch themes',
          description: 'Shows the colour swatches in the header.',
          defaultValue: true,
        }),
      },
    }),

    hours: singleton({
      label: 'Opening hours',
      path: 'src/content/hours',
      format: { data: 'json' },
      schema: {
        monday: day('Monday', '07:00', '18:00'),
        tuesday: day('Tuesday', '07:00', '18:00'),
        wednesday: day('Wednesday', '07:00', '18:00'),
        thursday: day('Thursday', '07:00', '18:00'),
        friday: day('Friday', '07:00', '19:00'),
        saturday: day('Saturday', '08:00', '17:00'),
        sunday: day('Sunday', '08:00', '15:00'),
        note: fields.text({ label: 'Note under the hours (optional)', description: 'e.g. "Closed 25 December"' }),
      },
    }),

    homepage: singleton({
      label: 'Homepage text',
      path: 'src/content/homepage',
      format: { data: 'json' },
      schema: {
        hero: fields.object(
          {
            eyebrow: fields.text({ label: 'Small heading above the title' }),
            title: fields.text({ label: 'Big title', description: 'The last word is shown in italics and the accent colour.' }),
            text: fields.text({ label: 'Intro paragraph', multiline: true }),
          },
          { label: 'Top of page' },
        ),
        stats: fields.array(
          fields.object({
            value: fields.text({ label: 'Big value', description: 'Short, e.g. "Tue" or "12"' }),
            label: fields.text({ label: 'Caption' }),
          }),
          { label: 'Three facts under the intro', itemLabel: (p) => `${p.fields.value.value} · ${p.fields.label.value}`, validation: { length: { max: 3 } } },
        ),
        ticker: fields.array(fields.text({ label: 'Line' }), {
          label: 'Scrolling banner lines',
          itemLabel: (p) => p.value,
        }),
        beans: fields.object(
          {
            eyebrow: fields.text({ label: 'Small heading' }),
            title: fields.text({ label: 'Title' }),
            text: fields.text({ label: 'Paragraph', multiline: true }),
          },
          { label: 'Beans section' },
        ),
        steps: fields.array(
          fields.object({
            title: fields.text({ label: 'Step title' }),
            text: fields.text({ label: 'Step text', multiline: true }),
          }),
          { label: 'How we work (steps)', itemLabel: (p) => p.fields.title.value, validation: { length: { max: 4 } } },
        ),
        menu: fields.object(
          {
            eyebrow: fields.text({ label: 'Small heading' }),
            title: fields.text({ label: 'Title' }),
            note: fields.text({ label: 'Note under the drinks', multiline: true }),
          },
          { label: 'Menu section' },
        ),
        visit: fields.object(
          {
            eyebrow: fields.text({ label: 'Small heading' }),
            title: fields.text({ label: 'Title' }),
          },
          { label: 'Visit section' },
        ),
      },
    }),
  },

  collections: {
    drinks: collection({
      label: 'Drinks',
      slugField: 'name',
      path: 'src/content/drinks/*',
      format: { data: 'json' },
      columns: ['category', 'price', 'available'],
      schema: {
        name: fields.slug({ name: { label: 'Drink name', validation: { isRequired: true } } }),
        category: fields.text({
          label: 'Menu tab',
          defaultValue: 'Espresso bar',
          description: 'Drinks with the same tab name are grouped together, e.g. Espresso bar, Slow bar, Cold.',
          validation: { isRequired: true },
        }),
        price: fields.number({ label: 'Price', step: 0.01, validation: { isRequired: true, min: 0 } }),
        description: fields.text({ label: 'Short description', multiline: true }),
        recipe: fields.text({ label: 'Recipe line (optional)', description: 'Shown under the 3D cup, e.g. "Double shot · 150 ml milk"' }),
        available: fields.checkbox({ label: 'On the menu', description: 'Untick to hide without deleting.', defaultValue: true }),
        order: fields.integer({ label: 'Sort order', description: 'Lower numbers come first within a tab.', defaultValue: 10 }),
        featured: fields.checkbox({ label: 'Show this drink in the 3D cup first', defaultValue: false }),
        look: fields.object(
          {
            cup: fields.select({
              label: 'Cup',
              defaultValue: 'mug',
              options: [
                { label: 'Mug', value: 'mug' },
                { label: 'Small espresso cup', value: 'demi' },
                { label: 'Glass (cold drinks)', value: 'glass' },
              ],
            }),
            liquid: hexColor('Drink colour', '#A87148'),
            art: fields.select({
              label: 'Surface',
              defaultValue: 'plain',
              options: [
                { label: 'Plain', value: 'plain' },
                { label: 'Crema', value: 'crema' },
                { label: 'Latte art heart', value: 'heart' },
                { label: 'Latte art rosetta', value: 'rosetta' },
                { label: 'Foam with cocoa', value: 'foam' },
                { label: 'Chocolate drizzle', value: 'drizzle' },
                { label: 'Matcha heart', value: 'matcha' },
              ],
            }),
            fill: fields.number({ label: 'How full (0.5–1)', defaultValue: 0.85, step: 0.01, validation: { min: 0.3, max: 1 } }),
          },
          { label: '3D cup appearance' },
        ),
      },
    }),

    origins: collection({
      label: 'Coffees on bar',
      slugField: 'name',
      path: 'src/content/origins/*',
      format: { data: 'json' },
      columns: ['process', 'onBar'],
      schema: {
        name: fields.slug({ name: { label: 'Coffee name', description: 'e.g. Ethiopia · Guji', validation: { isRequired: true } } }),
        process: fields.text({ label: 'Process', description: 'Washed, Natural, Honey…' }),
        altitude: fields.text({ label: 'Altitude', description: 'e.g. 2,100 masl' }),
        notes: fields.array(fields.text({ label: 'Tasting note' }), { label: 'Tasting notes', itemLabel: (p) => p.value }),
        roast: fields.integer({ label: 'Roast level (1 light – 5 dark)', defaultValue: 3, validation: { min: 1, max: 5 } }),
        use: fields.text({ label: 'Used for', description: 'e.g. Pour over, House espresso' }),
        onBar: fields.checkbox({ label: 'On bar now', description: 'Untick to hide without deleting.', defaultValue: true }),
        order: fields.integer({ label: 'Sort order', defaultValue: 10 }),
      },
    }),
  },
});
