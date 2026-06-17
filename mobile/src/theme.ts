export const Colors = {
  background: '#1A1A1A',
  surface: '#242424',
  text: '#F0F0F0',
  textSecondary: '#888888',
  textDim: '#444444',       // very muted text: placeholders, past dates, hour labels, disabled
  textOnAccent: '#FFFFFF',  // text on accent-colored backgrounds (today circle, action buttons)
  accent: '#E8461A',
  accentSubtle: '#1F1410',  // very dark accent-hued background for today cell tints
  separator: '#333333',
  divider: '#222222',       // stronger divider than separator (hour lines, section borders)
  surfaceSelected: '#2D2D2D', // selected-state backgrounds
  checkboxBorder: '#555555',
  inputBg: '#141414',       // input field background
  actionDone: '#E8461A',
  actionDelete: '#6B0000',
  navBar: '#111111',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

export const Fonts = {
  mono: 'JetBrainsMono_400Regular',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
