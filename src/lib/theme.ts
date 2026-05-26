import { createLightTheme, type BrandVariants, type Theme } from '@fluentui/react-components';

// Indigo brand ramp — Tailwind-style indigo scale tuned for Fluent UI.
const indigo: BrandVariants = {
  10: '#020207',
  20: '#0c0d2f',
  30: '#161a55',
  40: '#1f2473',
  50: '#272e93',
  60: '#3038b3',
  70: '#3a44d3',
  80: '#4f56e8',
  90: '#6366f1',
  100: '#7c7df3',
  110: '#9395f5',
  120: '#a8aaf7',
  130: '#bcbef9',
  140: '#cfd1fb',
  150: '#e1e3fc',
  160: '#eef0fd',
};

const base = createLightTheme(indigo);

export const appTheme: Theme = {
  ...base,
  // Surfaces
  colorNeutralBackground1: '#ffffff',
  colorNeutralBackground2: '#f7f7f9',
  colorNeutralBackground3: '#fafafb',
  colorNeutralBackground1Hover: '#f4f4f7',
  colorNeutralBackground1Pressed: '#eeeef2',
  colorNeutralBackground1Selected: '#eef0fd',

  // Borders
  colorNeutralStroke1: '#ececf0',
  colorNeutralStroke2: '#f0f0f3',
  colorNeutralStroke3: '#f5f5f8',

  // Text
  colorNeutralForeground1: '#0a0a0b',
  colorNeutralForeground2: '#3f3f46',
  colorNeutralForeground3: '#6b7280',
  colorNeutralForeground4: '#9ca3af',

  // Brand foregrounds (link/accent text)
  colorBrandForeground1: '#4f46e5',
  colorBrandForeground2: '#4338ca',
  colorBrandForegroundLink: '#4f46e5',
  colorBrandForegroundLinkHover: '#4338ca',

  // Brand backgrounds (primary button etc.)
  colorBrandBackground: '#6366f1',
  colorBrandBackgroundHover: '#4f46e5',
  colorBrandBackgroundPressed: '#4338ca',
  colorBrandBackground2: '#eef2ff',

  // Type ramp – tighter, more modern
  fontFamilyBase: "'Inter var', 'Inter', system-ui, -apple-system, sans-serif",
  fontWeightRegular: 450,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  fontWeightBold: 700,

  // Borders & shadows feel softer
  borderRadiusSmall: '8px',
  borderRadiusMedium: '10px',
  borderRadiusLarge: '14px',
  borderRadiusXLarge: '18px',
};
