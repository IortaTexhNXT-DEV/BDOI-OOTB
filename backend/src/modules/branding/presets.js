/**
 * Broker branding: theme presets, the font list, the sign-in picture library and the schema of a theme (setting
 * branding.theme).
 *
 * A theme is data. The screens read it as CSS custom properties (brokerverse/src/theme/runtime/themeEngine.js), the
 * sign-in page reads its `login` part, printed documents and report files its `documents` part (lib/pdf, lib/xlsx) and
 * e-mails its `email` part (lib/mailer.js). The iorta TechNXT preset is the default and the fallback for every value a
 * stored theme leaves out; it reproduces the compiled BDOI theme exactly.
 *
 * Status colours (success, warning, danger) are not part of a theme: they stay semantic on every brand.
 */

/** Fonts a theme may use. Google Fonts are loaded only from fonts.googleapis.com; no other source is accepted. */
export const FONTS = {
  nunito: { label: 'Nunito (bundled, default)', stack: '"Nunito", Arial, sans-serif', source: 'bundled' },
  arial: { label: 'Arial / Helvetica (system)', stack: 'Arial, Helvetica, sans-serif', source: 'system' },
  system: { label: 'System UI (system)', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif', source: 'system' },
  roboto: { label: 'Roboto (Google Fonts)', stack: '"Roboto", Arial, sans-serif', source: 'google', family: 'Roboto' },
  'open-sans': { label: 'Open Sans (Google Fonts)', stack: '"Open Sans", Arial, sans-serif', source: 'google', family: 'Open Sans' },
  lato: { label: 'Lato (Google Fonts)', stack: '"Lato", Arial, sans-serif', source: 'google', family: 'Lato' },
  'source-sans-3': { label: 'Source Sans 3 (Google Fonts)', stack: '"Source Sans 3", Arial, sans-serif', source: 'google', family: 'Source Sans 3' },
  inter: { label: 'Inter (Google Fonts)', stack: '"Inter", Arial, sans-serif', source: 'google', family: 'Inter' },
  montserrat: { label: 'Montserrat (Google Fonts)', stack: '"Montserrat", Arial, sans-serif', source: 'google', family: 'Montserrat' },
  poppins: { label: 'Poppins (Google Fonts)', stack: '"Poppins", Arial, sans-serif', source: 'google', family: 'Poppins' },
  'noto-sans': { label: 'Noto Sans (Google Fonts)', stack: '"Noto Sans", Arial, sans-serif', source: 'google', family: 'Noto Sans' },
};

/** Stylesheet URL of a Google font of the list (300 to 800), else null. Never built from free text. */
export function googleFontUrl(fontKey) {
  const f = FONTS[fontKey];
  if (!f || f.source !== 'google') return null;
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@300;400;600;700;800&display=swap`;
}

/**
 * Sign-in pictures shipped with the product (original artwork, no third-party marks), served by the front end from
 * /brand/library/<file>. `philippines` is the art of earlier releases (/brand/login-panel.svg).
 */
export const LOGIN_LIBRARY = {
  philippines: { label: 'Philippine insurance (default)', file: '/brand/login-panel.svg' },
  motor: { label: 'Motor: road and city', file: '/brand/library/motor.svg' },
  property: { label: 'Property: homes and buildings', file: '/brand/library/property.svg' },
  travel: { label: 'Travel and accident: islands', file: '/brand/library/travel.svg' },
  pattern: { label: 'Neutral pattern', file: '/brand/library/pattern.svg' },
};

/**
 * Schema of a theme: section -> field -> { type, ...limits }. Types: color (#rrggbb), color? (colour or empty =
 * follow another value), enum (values), int (min, max), bool, text (max), image (an uploaded image or a path of the
 * front end; never another web site).
 */
const C = { type: 'color' };
const CE = { type: 'color?' };
export const SCHEMA = {
  colors: Object.fromEntries(['primary', 'primaryDark', 'primaryText', 'primaryLight', 'secondary', 'accent', 'headerBg', 'headerText', 'sidebarBg', 'sidebarText',
    'sidebarActiveBg', 'sidebarActiveText', 'tableHeaderBg', 'tableHeaderText', 'buttonBg', 'buttonText', 'buttonHoverBg', 'link', 'focusRing', 'fieldBorder', 'pageBg',
    'headingText'].map((k) => [k, C])),
  layout: {
    headerStyle: { type: 'enum', values: ['light', 'brand'] },
    sidebarStyle: { type: 'enum', values: ['light', 'dark'] },
    density: { type: 'enum', values: ['comfortable', 'compact'] },
    tableHeaderStyle: { type: 'enum', values: ['solid', 'light'] },
  },
  radius: { sm: { type: 'int', min: 0, max: 24 }, md: { type: 'int', min: 0, max: 24 }, lg: { type: 'int', min: 0, max: 32 }, button: { type: 'int', min: 0, max: 24 } },
  logo: { appHeight: { type: 'int', min: 20, max: 80 }, loginHeight: { type: 'int', min: 24, max: 140 }, documentHeight: { type: 'int', min: 24, max: 80 } },
  login: {
    panel: { type: 'enum', values: ['library', 'image', 'color'] },
    library: { type: 'enum', values: Object.keys(LOGIN_LIBRARY) },
    panelImageUrl: { type: 'image' },
    focalX: { type: 'int', min: 0, max: 100 },
    focalY: { type: 'int', min: 0, max: 100 },
    colorFrom: C,
    colorTo: C,
    overlay: { type: 'int', min: 0, max: 80 },
    showOnMobile: { type: 'bool' },
    headline: { type: 'text', max: 80 },
    tagline: { type: 'text', max: 160 },
    showPoweredBy: { type: 'bool' },
  },
  documents: {
    accentColor: CE, headingColor: CE, headingBg: C, tableHeaderBg: CE, tableHeaderText: C,
    footerText: { type: 'text', max: 300 }, reportFooterText: { type: 'text', max: 300 },
    showLogo: { type: 'bool' }, excelLogo: { type: 'bool' }, excelHeaderBg: C, excelHeaderText: C,
  },
  email: {
    enabled: { type: 'bool' }, headerBg: C, headerText: C, accentColor: C, showLogo: { type: 'bool' }, footerText: { type: 'text', max: 400 },
  },
};

/** The footer line most brokers print: {{licence}}, {{companyName}} and {{tin}} come from the primary company. */
export const IC_FOOTER = 'Authorized by the Insurance Commission to act as an Insurance Broker, Licence No. {{licence}}';

/** iorta TechNXT (BrokerVerse): the compiled BDOI theme of the application, the default and the fallback. */
export const DEFAULT_THEME = Object.freeze({
  preset: 'iorta-technxt',
  name: 'iorta TechNXT (default)',
  colors: {
    primary: '#0072d8', primaryDark: '#005fb4', primaryText: '#ffffff', primaryLight: '#e5f5ff', secondary: '#004ea8', accent: '#fdb913',
    headerBg: '#ffffff', headerText: '#2e2e2e', sidebarBg: '#ffffff', sidebarText: '#004ea8', sidebarActiveBg: '#e5f5ff', sidebarActiveText: '#004ea8',
    tableHeaderBg: '#004ea8', tableHeaderText: '#ffffff', buttonBg: '#0072d8', buttonText: '#ffffff', buttonHoverBg: '#005fb4',
    link: '#0072d8', focusRing: '#0072d8', fieldBorder: '#99c1e7', pageBg: '#f6f6f6', headingText: '#2e2e2e',
  },
  layout: { headerStyle: 'light', sidebarStyle: 'light', density: 'comfortable', tableHeaderStyle: 'solid' },
  font: 'nunito',
  radius: { sm: 8, md: 12, lg: 16, button: 8 },
  logo: { appHeight: 36, loginHeight: 56, documentHeight: 46 },
  login: {
    panel: 'library', library: 'philippines', panelImageUrl: '', focalX: 50, focalY: 50, colorFrom: '#0072d8', colorTo: '#004ea8', overlay: 0,
    showOnMobile: false, headline: '', tagline: '', showPoweredBy: true,
  },
  documents: {
    // an empty accent colour follows Master > Configuration > documents.accent_color (the colour documents had before themes)
    accentColor: '', headingColor: '', headingBg: '#e9eff5', tableHeaderBg: '', tableHeaderText: '#ffffff',
    footerText: IC_FOOTER, reportFooterText: '', showLogo: true, excelLogo: false, excelHeaderBg: '#1f4e78', excelHeaderText: '#ffffff',
  },
  email: { enabled: true, headerBg: '#ffffff', headerText: '#2e2e2e', accentColor: '#0072d8', showLogo: true, footerText: '{{companyName}} | {{address}}' },
});

const clone = (o) => JSON.parse(JSON.stringify(o));
const preset = (key, name, over) => {
  const t = clone(DEFAULT_THEME);
  t.preset = key;
  t.name = name;
  for (const [section, values] of Object.entries(over)) {
    if (typeof values === 'object' && !Array.isArray(values)) t[section] = { ...t[section], ...values };
    else t[section] = values;
  }
  return Object.freeze(t);
};

/** Built-in presets. Custom is any theme saved with preset 'custom' (the values are then the theme's own). */
export const PRESETS = {
  'iorta-technxt': DEFAULT_THEME,
  'classic-blue': preset('classic-blue', 'Classic Blue', {
    colors: {
      primary: '#1d4ed8', primaryDark: '#1e40af', primaryLight: '#dbeafe', secondary: '#1e3a8a', accent: '#f59e0b',
      headerBg: '#1e3a8a', headerText: '#ffffff', sidebarBg: '#ffffff', sidebarText: '#1e3a8a', sidebarActiveBg: '#dbeafe', sidebarActiveText: '#1e3a8a',
      tableHeaderBg: '#1e3a8a', tableHeaderText: '#ffffff', buttonBg: '#1d4ed8', buttonText: '#ffffff', buttonHoverBg: '#1e40af',
      link: '#1d4ed8', focusRing: '#1d4ed8', fieldBorder: '#93c5fd', pageBg: '#f5f7fb', headingText: '#1e293b',
    },
    layout: { headerStyle: 'brand' },
    font: 'arial',
    login: { panel: 'library', library: 'property', colorFrom: '#1d4ed8', colorTo: '#1e3a8a' },
    documents: { accentColor: '#1e3a8a', headingColor: '#1e3a8a', headingBg: '#e8eef9', tableHeaderBg: '#1e3a8a', excelHeaderBg: '#1e3a8a' },
    email: { headerBg: '#1e3a8a', headerText: '#ffffff', accentColor: '#1d4ed8' },
  }),
  'corporate-grey': preset('corporate-grey', 'Corporate Grey', {
    colors: {
      primary: '#374151', primaryDark: '#1f2937', primaryLight: '#f3f4f6', secondary: '#111827', accent: '#9ca3af',
      headerBg: '#ffffff', headerText: '#111827', sidebarBg: '#1f2937', sidebarText: '#e5e7eb', sidebarActiveBg: '#374151', sidebarActiveText: '#ffffff',
      tableHeaderBg: '#374151', tableHeaderText: '#ffffff', buttonBg: '#374151', buttonText: '#ffffff', buttonHoverBg: '#1f2937',
      link: '#1f2937', focusRing: '#4b5563', fieldBorder: '#9ca3af', pageBg: '#f4f4f5', headingText: '#111827',
    },
    layout: { sidebarStyle: 'dark', density: 'compact' },
    font: 'system',
    radius: { sm: 4, md: 6, lg: 8, button: 4 },
    login: { panel: 'library', library: 'pattern', colorFrom: '#374151', colorTo: '#111827' },
    documents: { accentColor: '#374151', headingColor: '#111827', headingBg: '#f0f0f1', tableHeaderBg: '#374151', excelHeaderBg: '#374151' },
    email: { headerBg: '#1f2937', headerText: '#ffffff', accentColor: '#374151' },
  }),
  teal: preset('teal', 'Teal', {
    colors: {
      primary: '#0f766e', primaryDark: '#115e59', primaryLight: '#ccfbf1', secondary: '#134e4a', accent: '#f59e0b',
      headerBg: '#ffffff', headerText: '#134e4a', sidebarBg: '#f0fdfa', sidebarText: '#134e4a', sidebarActiveBg: '#ccfbf1', sidebarActiveText: '#134e4a',
      tableHeaderBg: '#0f766e', tableHeaderText: '#ffffff', buttonBg: '#0f766e', buttonText: '#ffffff', buttonHoverBg: '#115e59',
      link: '#0f766e', focusRing: '#0f766e', fieldBorder: '#5eead4', pageBg: '#f5f8f8', headingText: '#134e4a',
    },
    login: { panel: 'library', library: 'travel', colorFrom: '#0f766e', colorTo: '#134e4a' },
    documents: { accentColor: '#0f766e', headingColor: '#134e4a', headingBg: '#e6f4f2', tableHeaderBg: '#0f766e', excelHeaderBg: '#0f766e' },
    email: { headerBg: '#0f766e', headerText: '#ffffff', accentColor: '#0f766e' },
  }),
};

/** Preset list of the theme endpoint (GET /branding/theme). */
export const presetList = () => Object.values(PRESETS).map((p) => ({ key: p.preset, name: p.name, theme: p }));
