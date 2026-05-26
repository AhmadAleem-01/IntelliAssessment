import { createLightTheme, type BrandVariants, type Theme } from '@fluentui/react-components';

// Purple brand ramp centered on the design spec's #7F77DD.
const purple: BrandVariants = {
  10: '#040312',
  20: '#0d0a35',
  30: '#1a155a',
  40: '#272078',
  50: '#352c97',
  60: '#4339b6',
  70: '#5448cf',
  80: '#665ad7',
  90: '#7f77dd',
  100: '#928bdf',
  110: '#a5a0e7',
  120: '#b8b4ee',
  130: '#cac8f4',
  140: '#dcdaf8',
  150: '#ebeafa',
  160: '#f4f3fc',
};

const base = createLightTheme(purple);

export const appTheme: Theme = {
  ...base,
  // Surfaces — flat, no decorative tints
  colorNeutralBackground1: '#ffffff',
  colorNeutralBackground2: '#f5f5f4',
  colorNeutralBackground3: '#fafaf9',
  colorNeutralBackground1Hover: '#f5f5f4',
  colorNeutralBackground1Pressed: '#ececea',
  colorNeutralBackground1Selected: '#eeecfb',

  // Borders — extremely subtle to match 0.5px aesthetic
  colorNeutralStroke1: 'rgba(0,0,0,0.08)',
  colorNeutralStroke2: 'rgba(0,0,0,0.06)',
  colorNeutralStroke3: 'rgba(0,0,0,0.05)',

  // Text
  colorNeutralForeground1: '#1a1a1a',
  colorNeutralForeground2: '#3a3a3d',
  colorNeutralForeground3: '#56565a',
  colorNeutralForeground4: '#888780',

  // Brand foregrounds (link/accent text)
  colorBrandForeground1: '#5448cf',
  colorBrandForeground2: '#4339b6',
  colorBrandForegroundLink: '#5448cf',
  colorBrandForegroundLinkHover: '#4339b6',

  // Brand backgrounds (primary button etc.)
  colorBrandBackground: '#7f77dd',
  colorBrandBackgroundHover: '#665ad7',
  colorBrandBackgroundPressed: '#5448cf',
  colorBrandBackground2: '#eeecfb',

  // Type ramp – matches design spec
  fontFamilyBase: "'Inter var', 'Inter', system-ui, -apple-system, sans-serif",
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 500,
  fontWeightBold: 600,

  // Radii — design spec
  borderRadiusSmall: '4px',
  borderRadiusMedium: '8px',
  borderRadiusLarge: '12px',
  borderRadiusXLarge: '12px',

  // Flatten all elevation tokens — design rejects shadows
  shadow2: 'none',
  shadow4: 'none',
  shadow8: 'none',
  shadow16: 'none',
  shadow28: 'none',
  shadow64: 'none',
  shadow2Brand: 'none',
  shadow4Brand: 'none',
  shadow8Brand: 'none',
  shadow16Brand: 'none',
  shadow28Brand: 'none',
  shadow64Brand: 'none',
};
