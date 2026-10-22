/**
 * Reads everything staff edit in the admin (src/content/*) at build time and
 * shapes it for the page. Nothing here runs in the browser.
 */
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';
import { THEMES, type ThemeKey } from '../data/themes';

const reader = createReader(process.cwd(), keystaticConfig);

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export type Drink = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  recipe: string;
  featured: boolean;
  look: { cup: 'mug' | 'demi' | 'glass'; liquid: string; art: string; fill: number };
};

export type DayHours = { day: string; closed: boolean; open: string; close: string };

function required<T>(value: T | null, what: string): T {
  if (value == null) throw new Error(`Missing ${what}. Open the admin at /keystatic and save it once.`);
  return value;
}

export async function loadSite() {
  const [settings, hoursRaw, home, drinkEntries, originEntries] = await Promise.all([
    reader.singletons.settings.read(),
    reader.singletons.hours.read(),
    reader.singletons.homepage.read(),
    reader.collections.drinks.all(),
    reader.collections.origins.all(),
  ]);

  const s = required(settings, 'café details');
  const h = required(hoursRaw, 'opening hours');
  const page = required(home, 'homepage text');

  const themeKey: ThemeKey = (s.theme in THEMES ? s.theme : 'espresso') as ThemeKey;

  const drinks: Drink[] = drinkEntries
    .filter((e) => e.entry.available)
    .sort((a, b) => (a.entry.order ?? 0) - (b.entry.order ?? 0) || a.entry.name.localeCompare(b.entry.name))
    .map(({ slug, entry: e }) => ({
      id: slug,
      name: e.name,
      category: e.category.trim() || 'Menu',
      price: e.price,
      description: e.description,
      recipe: e.recipe,
      featured: e.featured,
      look: {
        cup: e.look.cup as Drink['look']['cup'],
        liquid: /^#[0-9a-f]{6}$/i.test(e.look.liquid) ? e.look.liquid : '#A87148',
        art: e.look.art,
        fill: Math.min(1, Math.max(0.3, e.look.fill ?? 0.85)),
      },
    }));

  // Keep tabs in the order their first drink appears.
  const categories = [...new Set(drinks.map((d) => d.category))];

  const origins = originEntries
    .filter((e) => e.entry.onBar)
    .sort((a, b) => (a.entry.order ?? 0) - (b.entry.order ?? 0))
    .map(({ slug, entry: e }) => ({ id: slug, ...e, roast: Math.min(5, Math.max(1, e.roast ?? 3)) }));

  const hours: DayHours[] = DAYS.map((k, i) => ({ day: DAY_LABELS[i], ...h[k] }));

  let money: Intl.NumberFormat;
  try {
    money = new Intl.NumberFormat(s.locale || 'en-US', { style: 'currency', currency: s.currency, minimumFractionDigits: 2 });
  } catch {
    money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  const a = s.address;
  const addressLines = [a.street, [a.area, a.city].filter(Boolean).join(', '), [a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean);
  const mapsUrl = s.mapsUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([a.street, a.area, a.city, a.region, a.postalCode, a.country].filter(Boolean).join(', '));

  // A default drink for the 3D cup: the featured one, else the first.
  const startDrink = drinks.find((d) => d.featured) ?? drinks[0];

  return {
    settings: s,
    themeKey,
    page,
    drinks,
    categories,
    startDrink,
    origins,
    hours,
    hoursNote: h.note,
    formatPrice: (n: number) => money.format(n),
    addressLines,
    mapsUrl,
  };
}

export type Site = Awaited<ReturnType<typeof loadSite>>;
