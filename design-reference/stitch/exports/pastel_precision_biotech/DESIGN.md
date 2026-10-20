---
name: Pastel Precision BioTech
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#534434'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#867461'
  outline-variant: '#d8c3ad'
  surface-tint: '#855300'
  primary: '#855300'
  on-primary: '#ffffff'
  primary-container: '#f59e0b'
  on-primary-container: '#613b00'
  inverse-primary: '#ffb95f'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#006398'
  on-tertiary: '#ffffff'
  tertiary-container: '#5bb8fe'
  on-tertiary-container: '#00476e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffddb8'
  primary-fixed-dim: '#ffb95f'
  on-primary-fixed: '#2a1700'
  on-primary-fixed-variant: '#653e00'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  telemetry-num:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  gutter-desktop: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system blends biological precision with accessible field-ready technology. Designed for precision apiculture, hive sensor analytics, and predictive AI telemetry, the interface balances scientific rigor with an organic, calm emotional signature. 

The aesthetic is clean, warm-minimalist, and modern tactile. It abandons sterile, overly industrial dashboard tropes in favor of soft pastel-tinted surfaces, deep charcoal legibility, and generous breathing room. This ensures effortless comprehension under direct outdoor sunlight as well as in-depth desk analysis. Interfaces feel intelligent, protective, and seamlessly integrated with natural ecosystems.

## Colors

The palette establishes a dual-tier semantic framework: soft pastel fills for large structural areas and telemetry backdrops paired with saturated, high-contrast accents for critical states, metrics, and actionable items.

- **Primary (Honey Gold):** `#F59E0B` for active states, key interactive indicators, and primary visual emphasis, supported by `#FDE68A` for soft container fills and highlighting.
- **Secondary (Health Emerald):** `#10B981` denotes colony vigor, optimal temperature, and balanced queen activity, with `#BBF7D0` used as its low-friction background pairing.
- **Tertiary (Sensor Azure):** `#0284C7` signals IoT connectivity, battery/telemetry metrics, and AI inference data, grounded with `#BAE6FD` surface highlights.
- **Pollen Warning (Warm Orange):** `#F97316` and `#FED7AA` identify hive moisture variance, pest suspicion, or attention-needed states.
- **Neutrals & Canvas:** The primary canvas rests on `#FAFAF9` (warm stone), secondary surfaces adopt `#F3F4F6`, and typography is anchored to `#1E293B` (deep slate charcoal) to eliminate eye strain while maintaining strict AAA accessibility.

## Typography

Typography delivers high-speed recognition in variable lighting conditions. Headings leverage **Plus Jakarta Sans** for its balanced geometry and approachable curves, while structured body copy, numerical telemetry, and operational tags utilize **Inter** for optical clarity at micro scales.

Telemetry readings, decimal readouts (such as internal hive temperature, weight variations, and acoustic frequency bands), and AI probability rates employ dedicated tabular figures via Inter to prevent visual jitter during streaming data updates.

## Layout & Spacing

The layout is built around a mobile-first, 4-column fluid grid system for standard phone screens (360px–428px), transitioning to an 8-column layout for tablets and a 12-column layout for desktop operations. 

Outer screen margins default to `1rem` (16px) on mobile viewports to maximize data density while preserving an edge-safe area for thumb reach. Metric cards, visual charts, and actionable modules stack vertically with standard gaps of `1rem` (`space-md`). Multi-metric cards use internal nestings spaced at `0.5rem` (`space-sm`) to group related measurements visually without adding heavy separator lines.

## Elevation & Depth

Visual hierarchy relies on ambient, tinted shadows and low-contrast surface boundaries rather than dense borders.

- **Level 0 (Base Canvas):** Flat `#FAFAF9` warm background with zero elevation.
- **Level 1 (Card & Module Surface):** Pure `#FFFFFF` fill supported by a diffused, honey-tinted ambient drop shadow: `0 4px 16px -2px rgba(30, 41, 59, 0.04), 0 2px 6px -1px rgba(245, 158, 11, 0.03)`. Surfaces maintain a subtle 1px border of `rgba(226, 232, 240, 0.6)`.
- **Level 2 (Interactive Floating Elements / Drawers):** Elevated controls, bottom navigation sheets, and active filter chips utilize `0 8px 24px -4px rgba(30, 41, 59, 0.08)`.
- **Level 3 (Modals & Critical Alerts):** Alert overlays utilize soft ambient occlusion: `0 16px 36px -6px rgba(30, 41, 59, 0.14)`.

## Shapes

The design system embraces refined organic curves, aligning with biological and natural themes:

- **Cards & Modules:** Explicitly employ `1rem` (16px) corner radiuses on standard metric blocks, with major dashboard widgets utilizing up to `1.5rem` (`rounded-2xl`) for an approachable, modern feel.
- **Pills & Status Chips:** Fully rounded (`rounded-full` / 9999px) for telemetry badges, pest alert pills, and quick filters.
- **Inputs & Buttons:** Uniform `0.75rem` (12px) to provide clear target affordance.

## Components

### Buttons
- **Primary:** Background `#F59E0B`, text `#FFFFFF`, rounded 12px, font `Inter` semibold. On press, transitions subtly to `#D97706`.
- **Secondary / Soft:** Tinted pastel background (e.g., `#FEF3C7`), text `#92400E`, with zero heavy border.
- **Icon Actions:** 44x44px touch targets with 20px Material 3 icons centered inside `#FFFFFF` circle surfaces elevated at Level 1.

### Telemetry Cards
- Built with a `#FFFFFF` base, `1.5rem` radius, and Level 1 elevation.
- Cards consist of a top metadata row (label, connectivity icon, battery indicator), a center focal metric (`telemetry-num`), and a bottom contextual trend line or micro-sparkline.

### Status Badges & Micro-Indicators
- Micro-pills consisting of a solid 6px dot indicator accompanied by compact uppercase text (`label-sm`).
- **Optimal Colony Status:** Dot `#10B981`, pill background `#BBF7D0`, text `#065F46`.
- **Warning / Variance:** Dot `#F97316`, pill background `#FED7AA`, text `#9A3412`.
- **Critical / Pest Detected:** Dot `#EF4444`, pill background `#FEE2E2`, text `#991B1B`.

### AI Pest Detection Viewers
- Full-bleed or inset media frame with a continuous live feed or photo snapshot.
- Detection bounding boxes utilize a glowing pastel-bordered frame (`#F59E0B` or `#EF4444`) with an anchored floating pill displaying the pest species label and percentage confidence.

### Input Fields & Controls
- Height 48px, background `#FFFFFF`, border 1px solid `#E2E8F0`, corner radius 12px.
- Focus state shifts border color to `#F59E0B` alongside a 3px soft outer ring in `rgba(245, 158, 11, 0.15)`.
- Checkboxes and radios use a 20px squircle shape with vibrant `#F59E0B` active check states.