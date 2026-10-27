/**
 * Unified Design Tokens & Typography Scale
 * Based on Platform Requirements Document (PRD) - Section 4
 */

export const DESIGN_TOKENS = {
  // Typography Scale (Section 4.1)
  typography: {
    fontFamily: "'Vazirmatn', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    levels: {
      pageTitle: {
        fontSize: 'text-xl sm:text-2xl',
        fontWeight: 'font-extrabold',
        lineHeight: 'leading-tight',
        tracking: 'tracking-tight',
      },
      sectionTitle: {
        fontSize: 'text-base sm:text-lg',
        fontWeight: 'font-bold',
        lineHeight: 'leading-snug',
      },
      cardTitle: {
        fontSize: 'text-sm sm:text-base',
        fontWeight: 'font-bold',
        lineHeight: 'leading-snug',
      },
      body: {
        fontSize: 'text-xs sm:text-sm',
        fontWeight: 'font-normal',
        lineHeight: 'leading-relaxed',
      },
      caption: {
        fontSize: 'text-[11px] sm:text-xs',
        fontWeight: 'font-medium',
        lineHeight: 'leading-normal',
      },
      meta: {
        fontSize: 'text-[10px] sm:text-[11px]',
        fontWeight: 'font-normal',
        lineHeight: 'leading-tight',
      },
      tabular: {
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'font-mono',
      },
    },
  },

  // Sizing Standards (Section 4.3)
  sizing: {
    // Buttons min heights
    button: {
      sm: 'min-h-[36px] text-xs px-3 py-1.5 gap-1.5',
      md: 'min-h-[44px] text-xs sm:text-sm px-4 py-2 gap-2',
      lg: 'min-h-[48px] text-sm sm:text-base px-6 py-2.5 gap-2.5',
    },
    // Form Inputs min height (Single-line inputs, selects, search)
    input: 'min-h-[44px] text-xs sm:text-sm px-3.5 py-2.5 rounded-xl',
    // Cards padding and radius
    card: {
      padding: 'p-4 sm:p-5 md:p-6',
      borderRadius: 'rounded-2xl',
      border: 'border border-[#DCE3EE] dark:border-[#344257]',
    },
    // Tables
    table: {
      headerHeight: 'h-11 px-3 py-2.5 text-xs font-bold',
      rowHeight: 'min-h-[48px] px-3 py-3 text-xs',
    },
    // Modal Max Widths
    modal: {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      '2xl': 'max-w-2xl',
      full: 'max-w-4xl',
    },
  },

  // Color Palette (Light & Dark)
  colors: {
    primary: {
      DEFAULT: '#2457C5',
      hover: '#1c469f',
      light: '#EBF1FF',
      dark: '#8BAEFF',
    },
    accent: '#F4B740',
    status: {
      success: {
        text: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        border: 'border-emerald-200 dark:border-emerald-800',
      },
      warning: {
        text: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200 dark:border-amber-800',
      },
      danger: {
        text: 'text-rose-700 dark:text-rose-300',
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        border: 'border-rose-200 dark:border-rose-800',
      },
      info: {
        text: 'text-blue-700 dark:text-blue-300',
        bg: 'bg-blue-50 dark:bg-blue-950/40',
        border: 'border-blue-200 dark:border-blue-800',
      },
    },
  },
} as const;

export default DESIGN_TOKENS;
