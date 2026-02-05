/**
 * JARVIS Typography System
 * 
 * A consistent type scale for the entire application.
 * All font sizes should reference these constants.
 */

// Font size scale (in pixels, converted to Tailwind classes)
export const fontSize = {
  // Extra Small - Labels, tags, timestamps
  xs: 'text-[10px]',      // 10px - Labels, timestamps
  sm: 'text-xs',          // 12px - Secondary text, descriptions
  
  // Base - Body text
  base: 'text-sm',        // 14px - Primary body text
  lg: 'text-base',        // 16px - Emphasized body text
  
  // Large - Headers
  xl: 'text-lg',          // 20px - Section headers
  '2xl': 'text-xl',       // 24px - Page titles
  '3xl': 'text-2xl',      // 32px - Main titles
} as const;

// Font weight scale
export const fontWeight = {
  normal: 'font-normal',   // 400
  medium: 'font-medium',   // 500
  semibold: 'font-semibold', // 600
  bold: 'font-bold',       // 700
} as const;

// Letter spacing (tracking)
export const tracking = {
  tight: 'tracking-tight',     // -0.025em
  normal: 'tracking-normal',   // 0
  wide: 'tracking-wide',       // 0.025em
  wider: 'tracking-wider',     // 0.05em - UI labels, headers
  widest: 'tracking-widest',   // 0.1em - Main titles
} as const;

// Line height (leading)
export const leading = {
  none: 'leading-none',        // 1
  tight: 'leading-tight',      // 1.25
  snug: 'leading-snug',        // 1.375
  normal: 'leading-normal',    // 1.5
  relaxed: 'leading-relaxed',  // 1.625
} as const;

// Font family
export const fontFamily = {
  mono: 'font-mono',       // Technical data, logs, code
  sans: 'font-sans',       // UI elements, general text
} as const;

// Pre-composed text style combinations for common use cases
export const textStyle = {
  // Page/section headers
  pageTitle: `${fontSize['2xl']} ${fontWeight.bold} ${tracking.widest} ${fontFamily.sans}`,
  sectionHeader: `${fontSize.xl} ${fontWeight.semibold} ${tracking.wider} ${fontFamily.sans}`,
  cardHeader: `${fontSize.sm} ${fontWeight.bold} ${tracking.wider} ${fontFamily.sans}`,
  
  // Body text
  bodyPrimary: `${fontSize.base} ${fontWeight.normal} ${tracking.normal} ${fontFamily.sans}`,
  bodySecondary: `${fontSize.sm} ${fontWeight.normal} ${tracking.normal} ${fontFamily.sans}`,
  
  // Labels and metadata
  label: `${fontSize.xs} ${fontWeight.bold} ${tracking.wider} ${fontFamily.sans}`,
  timestamp: `${fontSize.xs} ${fontWeight.normal} ${tracking.wider} ${fontFamily.mono}`,
  tag: `${fontSize.xs} ${fontWeight.medium} ${tracking.wide} ${fontFamily.sans}`,
  
  // Data/technical
  dataPrimary: `${fontSize.base} ${fontWeight.medium} ${tracking.normal} ${fontFamily.mono}`,
  dataSecondary: `${fontSize.sm} ${fontWeight.normal} ${tracking.normal} ${fontFamily.mono}`,
  status: `${fontSize.sm} ${fontWeight.semibold} ${tracking.wider} ${fontFamily.mono}`,
  
  // Button text
  button: `${fontSize.sm} ${fontWeight.medium} ${tracking.wider} ${fontFamily.sans}`,
  buttonSmall: `${fontSize.xs} ${fontWeight.bold} ${tracking.wider} ${fontFamily.sans}`,
} as const;

// Text color utilities (semantic)
export const textColor = {
  primary: 'text-white',
  secondary: 'text-gray-300',
  muted: 'text-gray-400',
  disabled: 'text-gray-600',
  accent: 'text-cyan-400',
  accentMuted: 'text-cyan-600',
  success: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
} as const;

// Helper function to combine text styles with colors
export const createTextClass = (
  style: keyof typeof textStyle,
  color: keyof typeof textColor = 'primary'
): string => `${textStyle[style]} ${textColor[color]}`;
