import { useTheme } from './theme'

/**
 * Categorical chart palette. Validated (lightness band, chroma, CVD and
 * normal-vision separation, contrast) against both chart surfaces.
 * Order is fixed: series keep their color regardless of filters.
 */
const light = {
  s1: '#6366F1', // indigo — always the primary series
  s2: '#0D9488', // teal
  s3: '#D946EF', // fuchsia
  s4: '#E11D48', // rose — reserved for the negative series (not indexed / lost)
  grid: 'rgba(15,23,42,0.06)',
  axis: '#94A3B8',
  cursor: 'rgba(99,102,241,0.35)',
  surface: '#FFFFFF',
  muted: '#CBD5E1',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
}

const dark: typeof light = {
  s1: '#7C7FF3',
  s2: '#0F9F92',
  s3: '#D946EF',
  s4: '#F0476A',
  grid: 'rgba(148,163,184,0.09)',
  axis: '#64748B',
  cursor: 'rgba(129,140,248,0.45)',
  surface: '#111827',
  muted: '#2B3546',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
}

export type ChartColors = typeof light

export function useChartColors(): ChartColors {
  const { theme } = useTheme()
  return theme === 'dark' ? dark : light
}
