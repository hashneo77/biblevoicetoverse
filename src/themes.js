// Display colour themes: stage background, verse text, reference/title colour and glow.
// `dark` picks the page chrome (Tailwind dark mode) and the event frame's auto colour.
// NOTE: remote/src/themes.js is a copy of this file — keep the two in sync.
export const THEMES = [
  {
    id: 'dark', label: 'Midnight', dark: true,
    bg: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
    text: '#f1f5f9', ref: '#fcd34d', role: '#fcd34d',
    glow: '0 0 10px rgba(255,255,255,0.15), 0 0 24px rgba(251,191,36,0.12), 0 2px 4px rgba(0,0,0,0.9)',
    refGlow: '0 0 8px rgba(251,191,36,0.4), 0 0 20px rgba(251,191,36,0.15), 0 1px 3px rgba(0,0,0,0.9)',
  },
  {
    id: 'light', label: 'Paper', dark: false,
    bg: '#ffffff',
    text: '#1e293b', ref: '#1e40af', role: '#b45309',
    glow: '0 0 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.12)',
    refGlow: '0 0 6px rgba(37,99,235,0.25), 0 1px 2px rgba(0,0,0,0.15)',
  },
  {
    id: 'royal', label: 'Royal Blue', dark: true,
    bg: 'radial-gradient(ellipse at 50% 30%, #1d3a8a 0%, #0b1f5c 55%, #06123a 100%)',
    text: '#f8fafc', ref: '#fbbf24', role: '#fbbf24',
    glow: '0 0 14px rgba(147,197,253,0.25), 0 2px 4px rgba(0,0,0,0.85)',
    refGlow: '0 0 12px rgba(251,191,36,0.45), 0 1px 3px rgba(0,0,0,0.9)',
  },
  {
    id: 'crimson', label: 'Encounter Crimson', dark: true,
    bg: 'radial-gradient(ellipse at 50% 30%, #7a1530 0%, #4a0b1d 60%, #2a0610 100%)',
    text: '#fff5f5', ref: '#f5d77a', role: '#f5d77a',
    glow: '0 0 14px rgba(255,182,193,0.22), 0 2px 4px rgba(0,0,0,0.85)',
    refGlow: '0 0 12px rgba(245,215,122,0.45), 0 1px 3px rgba(0,0,0,0.9)',
  },
  {
    id: 'forest', label: 'Forest Green', dark: true,
    bg: 'radial-gradient(ellipse at 50% 30%, #0f5c46 0%, #064e3b 50%, #022c22 100%)',
    text: '#ecfdf5', ref: '#fcd34d', role: '#fcd34d',
    glow: '0 0 14px rgba(167,243,208,0.2), 0 2px 4px rgba(0,0,0,0.85)',
    refGlow: '0 0 12px rgba(252,211,77,0.4), 0 1px 3px rgba(0,0,0,0.9)',
  },
  {
    id: 'violet', label: 'Lent Violet', dark: true,
    bg: 'radial-gradient(ellipse at 50% 30%, #4c1d95 0%, #2e1065 55%, #1a0840 100%)',
    text: '#f5f3ff', ref: '#f0abfc', role: '#fde68a',
    glow: '0 0 14px rgba(216,180,254,0.25), 0 2px 4px rgba(0,0,0,0.85)',
    refGlow: '0 0 12px rgba(240,171,252,0.45), 0 1px 3px rgba(0,0,0,0.9)',
  },
  {
    id: 'parchment', label: 'Parchment', dark: false,
    bg: 'radial-gradient(ellipse at 50% 35%, #fbf3df 0%, #f3e3bf 70%, #e8d29f 100%)',
    text: '#3b2a1a', ref: '#8b1e1e', role: '#8b1e1e',
    glow: '0 1px 2px rgba(120,80,30,0.2)',
    refGlow: '0 1px 2px rgba(120,30,30,0.2)',
  },
  {
    id: 'sky', label: 'Sky', dark: false,
    bg: 'linear-gradient(180deg, #f0f9ff 0%, #dbeafe 100%)',
    text: '#0c2d57', ref: '#b45309', role: '#1d4ed8',
    glow: '0 1px 2px rgba(12,45,87,0.15)',
    refGlow: '0 1px 2px rgba(180,83,9,0.2)',
  },
  {
    id: 'contrast', label: 'High Contrast', dark: true,
    bg: '#000000',
    text: '#ffffff', ref: '#ffd60a', role: '#ffd60a',
    glow: 'none', refGlow: 'none',
  },
]

export const getTheme = (id) => THEMES.find(t => t.id === id) || THEMES[0]
export const nextThemeId = (id) => THEMES[(THEMES.findIndex(t => t.id === id) + 1) % THEMES.length].id
