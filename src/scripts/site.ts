/**
 * Small interactive bits of the homepage: theme swatches, menu tabs, the "open now"
 * badge, and starting the 3D cup once the page has settled.
 */
import { THEMES, fontsUrl, type ThemeKey } from '../data/themes';

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];

/* ---------- Themes ---------- */
function loadThemeFonts(key: ThemeKey) {
  const href = fontsUrl(THEMES[key]);
  if ([...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].some((l) => l.href === href)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
}

const swatches = $('#swatches');
if (swatches) {
  const current = document.documentElement.dataset.skin as ThemeKey;
  const input = $<HTMLInputElement>(`#swatches input[value="${current}"]`);
  if (input) input.checked = true;
  const label = $('#themeName');
  if (label && THEMES[current]) label.textContent = THEMES[current].label;

  // Don't move focus on mouse/touch: Chrome can scroll the page to a focused control in a sticky header.
  swatches.addEventListener('pointerdown', (e) => { if ((e.target as Element).closest('.sw')) e.preventDefault(); });

  swatches.addEventListener('change', (e) => {
    const key = (e.target as HTMLInputElement).value as ThemeKey;
    if (!THEMES[key]) return;
    loadThemeFonts(key);
    document.documentElement.dataset.skin = key;
    if (label) label.textContent = THEMES[key].label;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[key].c.paper);
    try { localStorage.setItem('cafe-theme', key); } catch {}
    document.dispatchEvent(new CustomEvent('cafe:theme', { detail: key }));
  });
}

/* ---------- Menu ---------- */
type Look = { cup: 'mug' | 'demi' | 'glass'; liquid: string; art: string; fill: number; name: string; recipe: string; category: string; price: string };
const looksEl = $('#drink-looks');
const menuData: { start: string | null; drinks: Record<string, Look> } = looksEl ? JSON.parse(looksEl.textContent || '{}') : { start: null, drinks: {} };
let currentDrink = menuData.start;

function selectDrink(id: string) {
  const d = menuData.drinks[id];
  if (!d || id === currentDrink) return;
  currentDrink = id;
  $$('.drink').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.drink === id)));
  const set = (sel: string, v: string) => { const el = $(sel); if (el) el.textContent = v; };
  set('#winName', d.name);
  set('#winRatio', d.recipe);
  set('#winBar', d.category);
  set('#winPrice', d.price);
  document.dispatchEvent(new CustomEvent('cafe:drink', { detail: id }));
}

function selectTab(tab: HTMLElement, focus = false) {
  const cat = tab.dataset.cat!;
  $$('.tab').forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  $('#drink-list')?.setAttribute('aria-labelledby', tab.id);
  const items = $$('.drink');
  items.forEach((b) => (b.hidden = b.dataset.cat !== cat));
  if (focus) tab.focus();
  const first = items.find((b) => b.dataset.cat === cat);
  if (first) selectDrink(first.dataset.drink!);
}

document.addEventListener('click', (e) => {
  const t = (e.target as Element).closest<HTMLElement>('.tab, .drink');
  if (!t) return;
  if (t.classList.contains('tab')) selectTab(t);
  else selectDrink(t.dataset.drink!);
});

// Arrow keys move between tabs, as screen-reader users expect from a tablist.
$('.tabs')?.addEventListener('keydown', (e) => {
  const tabs = $$('.tab');
  const i = tabs.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  selectTab(tabs[(next + tabs.length) % tabs.length], true);
});

/* ---------- Opening hours & "open now" ---------- */
type Day = { day: string; closed: boolean; open: string; close: string };
function updateOpenNow() {
  const pill = $('#openPill');
  if (!pill) return;
  const hours: Day[] = JSON.parse(pill.dataset.hours || '[]');
  if (hours.length !== 7) return;

  // Current day and time at the café, whatever the visitor's own time zone.
  let weekday = '', hh = 0, mm = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: pill.dataset.tz || undefined, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    weekday = parts.find((p) => p.type === 'weekday')!.value;
    hh = +parts.find((p) => p.type === 'hour')!.value;
    mm = +parts.find((p) => p.type === 'minute')!.value;
  } catch {
    const d = new Date();
    weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    hh = d.getHours(); mm = d.getMinutes();
  }
  const idx = Math.max(0, hours.findIndex((h) => h.day === weekday));
  $$('#hours > div').forEach((row, i) => row.classList.toggle('today', i === idx));

  const toM = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  const now = hh * 60 + mm;
  const today = hours[idx];
  const open = !today.closed && now >= toM(today.open) && now < toM(today.close);

  let msg: string;
  if (open) msg = `Open now · until ${today.close}`;
  else if (!today.closed && now < toM(today.open)) msg = `Closed now · opens at ${today.open}`;
  else {
    let k = 1;
    while (k < 7 && hours[(idx + k) % 7].closed) k++;
    const nd = hours[(idx + k) % 7];
    msg = k >= 7 ? 'Closed' : `Closed now · opens ${k === 1 ? 'tomorrow' : nd.day} at ${nd.open}`;
  }
  pill.classList.toggle('open', open);
  pill.querySelector('span')!.textContent = msg;
  pill.classList.add('ready');
}
updateOpenNow();
setInterval(updateOpenNow, 60_000);

/* ---------- 3D cup ---------- */
// Skip the 3D scene on data-saver connections and very low-end devices; the illustrated cup stays.
function shouldRun3D() {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 2) return false;
  if ((navigator.hardwareConcurrency || 4) < 2) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function start3D() {
  if (!shouldRun3D() || !$('#stage')) return;
  import('./cup3d')
    .then((m) => m.startCup({ looks: menuData.drinks, start: currentDrink }))
    .catch((err) => console.warn('3D cup unavailable:', err));
}

const idle = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 300));
if (document.readyState === 'complete') idle(start3D);
else addEventListener('load', () => idle(start3D), { once: true });
