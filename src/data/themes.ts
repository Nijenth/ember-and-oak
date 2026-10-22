/**
 * Site themes. Each one sets the page colours, the three fonts, and how the 3D cup,
 * saucer, beans and rim light look. Staff pick the default theme in the admin
 * (Café details → Site theme); visitors can switch if the swatches are turned on.
 *
 * To add a theme, copy one block, give it a new key, and add the Google Fonts it
 * needs to `gf` (the part after "family=" in a Google Fonts URL).
 */
export type Theme = {
  label: string;
  dark: boolean;
  c: { paper: string; surface: string; ink: string; muted: string; line: string; chip: string; accent: string; onAccent: string };
  fonts: [display: string, body: string, mono: string];
  gf: string[];
  weight: number;
  track: string;
  r: string;
  d3: { cup: string; rough: number; saucer: string; bean: string; rim: string; glow: string };
};

export const THEMES = {
  espresso: {
    label: 'Espresso', dark: true,
    c: { paper: '#120C09', surface: '#1C1410', ink: '#F3E7D9', muted: '#B09A86', line: '#33251D', chip: '#241A14', accent: '#E0913F', onAccent: '#120C09' },
    fonts: ['DM Serif Display', 'Figtree', 'DM Mono'],
    gf: ['DM+Serif+Display:ital@0;1', 'Figtree:wght@400..700', 'DM+Mono:wght@400;500'],
    weight: 400, track: '-0.01em', r: '14px',
    d3: { cup: '#F2EAE0', rough: 0.32, saucer: '#F2EAE0', bean: '#3B2416', rim: '#E0913F', glow: '#E0913F' },
  },
  oat: {
    label: 'Oat Milk', dark: false,
    c: { paper: '#EFE6DA', surface: '#F8F2EA', ink: '#2B1D14', muted: '#6E5A4B', line: '#DDCFBF', chip: '#E6DACB', accent: '#9E481E', onAccent: '#FFFFFF' },
    fonts: ['Fraunces', 'Figtree', 'DM Mono'],
    gf: ['Fraunces:ital,opsz,wght@0,9..144,300..800;1,9..144,300..800', 'Figtree:wght@400..700', 'DM+Mono:wght@400;500'],
    weight: 500, track: '-0.03em', r: '10px',
    d3: { cup: '#C79F7A', rough: 0.85, saucer: '#C79F7A', bean: '#4A2C1A', rim: '#FFD3A1', glow: '#E8A36B' },
  },
  matcha: {
    label: 'Matcha', dark: false,
    c: { paper: '#E4EBD9', surface: '#F1F5EA', ink: '#1D2A1B', muted: '#55634F', line: '#CBD6BD', chip: '#D8E2CB', accent: '#447026', onAccent: '#FFFFFF' },
    fonts: ['Young Serif', 'Outfit', 'DM Mono'],
    gf: ['Young+Serif', 'Outfit:wght@300..700', 'DM+Mono:wght@400;500'],
    weight: 400, track: '-0.02em', r: '18px',
    d3: { cup: '#2F3E2B', rough: 0.22, saucer: '#2F3E2B', bean: '#3E2A1B', rim: '#B9E07A', glow: '#9CCB5E' },
  },
  coldbrew: {
    label: 'Cold Brew', dark: true,
    c: { paper: '#0A111C', surface: '#111B2B', ink: '#E5EEF9', muted: '#8FA0B8', line: '#1F2C40', chip: '#16223A', accent: '#7CC8FF', onAccent: '#0A111C' },
    fonts: ['Syne', 'Manrope', 'JetBrains Mono'],
    gf: ['Syne:wght@400..800', 'Manrope:wght@400..700', 'JetBrains+Mono:wght@400;500'],
    weight: 700, track: '-0.035em', r: '12px',
    d3: { cup: '#DDE7F2', rough: 0.18, saucer: '#22324D', bean: '#2E1C12', rim: '#7CC8FF', glow: '#4C8DFF' },
  },
  cherry: {
    label: 'Cherry Roast', dark: false,
    c: { paper: '#F7E4E1', surface: '#FFF3F1', ink: '#3A0D16', muted: '#7A4750', line: '#EBC8C4', chip: '#F2D4D0', accent: '#B81D34', onAccent: '#FFFFFF' },
    fonts: ['Gloock', 'DM Sans', 'DM Mono'],
    gf: ['Gloock', 'DM+Sans:opsz,wght@9..40,400..700', 'DM+Mono:wght@400;500'],
    weight: 400, track: '-0.02em', r: '16px',
    d3: { cup: '#C8213A', rough: 0.12, saucer: '#F6EDEA', bean: '#4A1E14', rim: '#FF8FA0', glow: '#FF6B81' },
  },
  diner: {
    label: 'Retro Diner', dark: false,
    c: { paper: '#F2E8D0', surface: '#FBF4E2', ink: '#1F3140', muted: '#56626A', line: '#DCCDAA', chip: '#E9DDBF', accent: '#AE3B17', onAccent: '#FFFFFF' },
    fonts: ['Bowlby One', 'Work Sans', 'IBM Plex Mono'],
    gf: ['Bowlby+One', 'Work+Sans:wght@400..700', 'IBM+Plex+Mono:wght@400;500'],
    weight: 400, track: '0em', r: '24px',
    d3: { cup: '#2C8C80', rough: 0.3, saucer: '#F7F1E3', bean: '#4A2C1A', rim: '#FFB36B', glow: '#FF8A4C' },
  },
} satisfies Record<string, Theme>;

export type ThemeKey = keyof typeof THEMES;

export const THEME_OPTIONS = (Object.keys(THEMES) as ThemeKey[]).map((value) => ({ label: THEMES[value].label, value }));

export const fontsUrl = (t: Theme) =>
  'https://fonts.googleapis.com/css2?' + t.gf.map((g) => 'family=' + g).join('&') + '&display=swap';

/** CSS custom properties for every theme, keyed by [data-skin]. */
export function themeCss() {
  return (Object.entries(THEMES) as [ThemeKey, Theme][])
    .map(([k, t]) => {
      const c = t.c;
      return `:root[data-skin="${k}"]{--paper:${c.paper};--surface:${c.surface};--ink:${c.ink};--muted:${c.muted};--line:${c.line};--chip:${c.chip};--accent:${c.accent};--on-accent:${c.onAccent};--f-display:"${t.fonts[0]}",Georgia,serif;--f-body:"${t.fonts[1]}",system-ui,-apple-system,"Segoe UI",sans-serif;--f-mono:"${t.fonts[2]}",ui-monospace,Menlo,monospace;--dw:${t.weight};--dt:${t.track};--r:${t.r};--glow:${t.d3.glow};color-scheme:${t.dark ? 'dark' : 'light'}}`;
    })
    .join('\n');
}
