---
name: Personal Dashboard
description: A confident, structured single-user workspace for finances, calendar, and study.
colors:
  primary: "#1d4ed8"
  primary-container: "#dbe6ff"
  on-primary: "#ffffff"
  on-primary-container: "#12318f"
  secondary: "#475e8a"
  secondary-container: "#dfe7f6"
  on-secondary: "#ffffff"
  on-secondary-container: "#33466b"
  tertiary: "#4f46e5"
  tertiary-container: "#e6e8ff"
  on-tertiary: "#ffffff"
  on-tertiary-container: "#2d2a8f"
  error: "#c42626"
  error-container: "#fde8e8"
  on-error: "#ffffff"
  on-error-container: "#8a1a1a"
  success: "#15803d"
  success-container: "#dcf5e4"
  on-success: "#ffffff"
  on-success-container: "#14532d"
  surface: "#f2f5fb"
  surface-dim: "#d0daf0"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f7f9fd"
  surface-container: "#e9eef9"
  surface-container-high: "#dde5f5"
  surface-container-highest: "#d0daf0"
  on-surface: "#0b1020"
  on-surface-variant: "#4a5473"
  outline: "#7a84a3"
  outline-variant: "#d5dcee"
  background: "#f2f5fb"
  on-background: "#0b1020"
  positive-text: "#15803d"
  ink: "#0b1020"
colors-dark:
  primary: "#8fb0ff"
  primary-container: "#1b3a8c"
  on-primary: "#00205f"
  on-primary-container: "#dbe6ff"
  secondary: "#9db4e8"
  secondary-container: "#1c2c52"
  on-secondary: "#0f2550"
  on-secondary-container: "#c6d4f5"
  tertiary: "#aab4ff"
  tertiary-container: "#2a2f6e"
  on-tertiary: "#1e1b4b"
  on-tertiary-container: "#e0e7ff"
  error: "#ff9a9a"
  error-container: "#4a1414"
  on-error: "#5c0a0a"
  on-error-container: "#ffd0d0"
  success: "#7ee2a0"
  success-container: "#0f3321"
  on-success: "#052e16"
  on-success-container: "#c2f2d2"
  surface: "#0a0f1e"
  surface-dim: "#2a3556"
  surface-container-lowest: "#0f1629"
  surface-container-low: "#131b31"
  surface-container: "#182139"
  surface-container-high: "#202a47"
  surface-container-highest: "#2a3556"
  on-surface: "#e3e9f7"
  on-surface-variant: "#9aa8cc"
  outline: "#66759c"
  outline-variant: "#263050"
  background: "#0a0f1e"
  on-background: "#e3e9f7"
  positive-text: "#7ee2a0"
  ink: "#e3e9f7"
typography:
  headline:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: "36px"
  title:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
  heading:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "22px"
  body:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  caption:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  label:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "0.04em"
rounded:
  full: "999px"
  lg: "16px"
  md: "12px"
  sm: "8px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-error-container}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 16px"
  nav-item-active:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "24px"
  field:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 12px"
  pill:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    padding: "2px 12px"
---

# Design System: Personal Dashboard

## 1. Overview

**Creative North Star: "The Ledger"**

Every screen borrows the confident precision of a well-kept financial ledger and applies it to the whole workspace, not just the transaction table. Numbers, dates, and event blocks all get the same treatment: exact, aligned, legible at a glance, never softened into decoration. The system is structured first — a persistent sidebar, a consistent card grid, a single accent color that marks what's active or actionable — and confident second: Ledger Blue is used deliberately and sparingly, so its appearance always means something (primary action, active nav item, current time marker, positive progress).

This is a single-user tool with no marketing surface, so it explicitly rejects generic SaaS dashboard-generator tropes: no gradient text, no hero-metric cards, no uniform icon+heading+text card grids repeated for their own sake, no tiny uppercase eyebrow slapped above every section out of habit. Where an eyebrow or uppercase label appears (table headers, weekday labels), it's functional density labeling, not decoration.

The system ships full light and dark themes via `[data-theme="dark"]` on `:root`, with every color role re-mapped rather than just inverted — dark mode is a first-class target, not an afterthought filter.

**Key Characteristics:**
- One accent (Ledger Blue) carries meaning: primary actions, active states, positive trend, "now."
- Flat by default; shadow is reserved for things that float above the page (FAB, modal).
- A tight three-step radius scale (8 / 12 / 16px) plus full-round for pills and icon buttons — nothing arbitrary.
- Dense, data-forward layouts: 14px body text throughout, no oversized display type.

## 2. Colors

Cool, saturated blue as the single committed accent against a near-white (light) or near-black (dark) neutral field, with slate as a quiet secondary role and indigo as a tertiary role that never compete with the primary.

### Primary
- **Ledger Blue** (`#1d4ed8` light / `#8fb0ff` dark): the one color that means "this is active, primary, or actionable." Used on primary buttons, the current-time line on the timetable, the income series, progress fill, and links.
- **Primary Container** (`#dbe6ff` light / `#1b3a8c` dark, text `#12318f` / `#dbe6ff`): the active navigation item and the active segmented-control option, plus session event blocks and pills.

### Secondary
- **Slate** (`#475e8a` light / `#9db4e8` dark): the expense series in charts (mixed toward the surface in dark) and the accent dot for task events. Its container (`#dfe7f6` light / `#1c2c52` dark) tints task event blocks. A cooler, quieter partner to Ledger Blue, never used for primary actions.

### Tertiary
- **Indigo** (`#4f46e5` light / `#aab4ff` dark): reserved for the exam and deadline event categories as the accent dot, with its container (`#e6e8ff` light / `#2a2f6e` dark) as the block and pill background. Never used for text or actions.

### Neutral
- **Surface** (`#f2f5fb` light / `#0a0f1e` dark): page background.
- **Surface Container Lowest** (`#ffffff` light / `#0f1629` dark): cards, panels, modals, dialogs, the sidebar, and form fields: the "paper" layer that sits above the page background.
- **Surface Container / Container High** (`#e9eef9`, `#dde5f5` light / `#182139`, `#202a47` dark): hover states, nested elements, pills, and the ring track: one step up from paper.
- **On-Surface** (`#0b1020` light / `#e3e9f7` dark): primary text.
- **On-Surface Variant** (`#4a5473` light / `#9aa8cc` dark): secondary text, labels, muted metadata.
- **Outline** (`#7a84a3` light / `#66759c` dark): field borders, secondary button borders, and the chart zero line.
- **Outline Variant** (`#d5dcee` light / `#263050` dark): the 1px hairline used for borders on cards, panels, table rows, and dividers.

### Semantic
- **Success** (`#15803d` light / `#7ee2a0` dark; container `#dcf5e4` / `#0f3321`): income amounts, positive stat trends, success toasts. The same value is exposed as `positive-text`.
- **Error** (`#c42626` light / `#ff9a9a` dark; container `#fde8e8` / `#4a1414`): destructive actions, over-budget rings, error toasts, and invalid fields. The danger button in confirm dialogs uses the solid Error fill; elsewhere the danger button uses the container.

### Named Rules
**The One-Accent Rule.** Ledger Blue is the only color allowed to signal "primary action" or "this is active." If a screen needs a second visually loud color, reach for a container tint (`*-container`) at low opacity before introducing a new hue.

**The Hairline Rule.** Separation between surfaces is drawn with a single `1px solid var(--color-outline-variant)` border, not a shadow. Shadows are reserved for elements that visually float above the page (see Elevation).

## 3. Typography

**Body Font:** Inter (with system-ui, -apple-system, "Segoe UI", sans-serif)

**Character:** A single geometric-humanist sans carries the entire system at three weights (400/500/600). There is no display tier — the largest heading is 30px — which keeps every screen reading as data-dense and structured rather than promotional.

### Hierarchy
- **Headline** (600, 30px, line-height 36px): page-level titles (`Financial Overview`, `Study`) and hero numeric values (`stat-value`, savings goal amount).
- **Title** (600, 22px, line-height 28px): section headers within a page (`Study Timetable`), modal and dialog titles.
- **Heading** (600, 16px, line-height 22px): card titles and agenda day headings.
- **Body** (400, 14px, line-height 20px): the default for all UI text — table cells, form fields, nav labels, chat messages. Buttons and nav items use the same 14px size at 500 weight for emphasis without introducing a new scale step.
- **Caption** (400, 12px, line-height 16px): helper text, chart ticks, event metadata.
- **Label** (600, 11px, line-height 14px, uppercase, letter-spacing 0.04em): table column headers, weekday labels, the `eyebrow` class, and section-header micro-labels — always functional (labeling a data column or region), never decorative.

### Named Rules
**The No-Display Rule.** Nothing on this surface exceeds 30px. If a future screen wants a bigger number, it earns that size by being the single most important figure on the page (e.g. total balance), not by default.

## 4. Elevation

Flat by default. Surfaces are separated by the 1px `outline-variant` hairline (see Colors → Named Rules), not by shadow — cards, the sidebar, the topbar, and table rows all sit at the same visual depth. Shadow is reserved for the elements that genuinely float above the page content: the floating action button, toasts, and modal dialogs.

### Shadow Vocabulary
- **Floating action** (`box-shadow: 0 8px 20px rgba(11, 16, 32, 0.22)` light / `rgba(0, 0, 0, 0.5)` dark): the circular "+" FAB on the Dashboard page and toasts, the elements meant to read as hovering above the page.
- **Modal** (`box-shadow: 0 20px 60px rgba(11, 16, 32, 0.35)` light / `rgba(0, 0, 0, 0.6)` dark): modal overlays (event form, class-schedule form) and the alert/confirm dialogs — a deliberately heavier shadow since the modal sits above a dimmed backdrop, not just above page content.

### Named Rules
**The Flat-By-Default Rule.** If you're reaching for `box-shadow` on a card, table, or panel, use a border instead. Shadow is earned only by elements that overlay other content (modals) or float independent of the page's scroll layer (the FAB).

## 5. Components

### Buttons
- **Shape:** 8px radius (`rounded.sm`) on standard buttons; full-round (999px) on icon-only buttons and the FAB. 36px tall (44px at 899px and below).
- **Primary:** Ledger Blue fill, `on-primary` text, 0/16px padding, 500 weight, 14px.
- **Secondary:** white/lowest-surface fill with a 1px outline border and on-surface text — same shape and padding as primary, distinguished by fill only.
- **Danger:** error-container fill with on-error-container text, same shape. In confirm dialogs the danger action is the solid Error fill with `on-error` text.
- **Small variants** (`btn-sm`): 32px tall, 0/12px padding, 13px text, used inline in cards (goal edit, subscription add) where a full-size button would overpower the layout.

### Pills / Badges
- **Style:** full-round (999px), surface-container background, on-surface-variant text, 12px/500, 2px/12px padding.
- **State:** an error variant (`pill-error`, error-container background) marks "Action Required" on pending transactions. Event pills on the calendar reuse this shape with category colors (primary-container for sessions, tertiary-container for exams/deadlines, secondary-container for tasks).

### Cards / Containers
- **Corner Style:** 12px radius (`rounded.md`); modals and dialogs use 16px (`rounded.lg`).
- **Background:** `surface-container-lowest` — the "paper" layer.
- **Shadow Strategy:** none (see Elevation) — a 1px `outline-variant` border does the separation work instead.
- **Internal Padding:** 24px (16px at 899px and below).

### Inputs / Fields
- **Style:** 8px radius, 1px outline border, `surface-container-lowest` background, 36px tall (44px at 899px and below, 16px text to prevent mobile zoom), 14px text.
- **Focus:** the border turns Ledger Blue with a 1px Ledger Blue ring; every other interactive element gets a 2px Ledger Blue outline with 2px offset on `:focus-visible`. Invalid fields use the Error border and a helper line in Error.

### Navigation
- **Sidebar nav items:** transparent by default, on-surface-variant text; active item gets `primary-container` background with `on-primary-container` text and a Ledger Blue icon. Fixed frame sidebar with the brand mark on top and the theme toggle pinned to the bottom; it does not collapse.
- **Mobile nav:** a fixed bottom bar at 899px and below (the sidebar is replaced by a slim top bar with brand and theme toggle), same active/inactive color logic as the sidebar, icon-over-label instead of icon-beside-label.

### Charts, Rings and Stat Cards
Built once in `js/charts.js` and styled by `.chart-*`, `.bar-*`, `.mini-*`, `.ring-*` in `css/style.css`. Income is Ledger Blue, expense is Slate (mixed toward the surface in dark); the diverging bars put income above and expense below a zero line, so position, not hue, carries the distinction. Budget rings turn error-red past 100%. Stat cards are plain `card`s with a 13px label, a 24px value (30px for the balance), a trend line whose colour reflects good or bad (not up or down), and a 32px round link to the related page.

### Timetable / Calendar Event Blocks
Category color is carried by the matching `*-container` fill (primary for sessions, tertiary for exams and deadlines, secondary for tasks) plus a small leading dot in the matching accent next to the time, never a border-left stripe (see Do's and Don'ts). Recurring events get a 1px dashed outline in the accent color. The same blocks appear as agenda items: on narrow screens the month grid shows only colored dots, tapping a day selects it, and an agenda list for that day and for the whole month sits beneath the grid.

### Dialogs and Toasts
Alerts and confirmations are handled by `js/dialog.js` (`ui.alert`, `ui.confirm`, `ui.toast`) and never by native browser dialogs. Dialogs are a native modal `<dialog>` with `rounded.lg`, the modal shadow, and a scrim backdrop; buttons are at least 44px tall and the safe action (Cancel) takes initial focus on destructive confirms. Toasts are `rounded.md` with the float shadow, a leading status dot (Ledger Blue, Success, or Error) and a 44px dismiss button; errors announce assertively and appear at the top, other kinds announce politely and appear at the bottom. Animation is skipped under `prefers-reduced-motion`.

## 6. Do's and Don'ts

### Do:
- **Do** let Ledger Blue mean one thing: primary/active/now. Reuse it for anything that needs to say "this is the important one" (primary buttons, active nav, current-time line, positive progress).
- **Do** separate surfaces with the 1px `outline-variant` hairline, not a shadow.
- **Do** keep body text at 14px/400 Inter; reserve 600 weight for headline/title/heading/label roles and emphasized body-strong text.
- **Do** use `*-container` fills with a leading accent dot for category-coded blocks (calendar/timetable), matching the existing `ev-session` / `ev-exam` / `ev-task` pattern.
- **Do** cap headings at 30px (`headline`) — the system has no display tier and shouldn't invent one casually.

### Don't:
- **Don't** use the generic SaaS dashboard-generator look: no gradient text, no hero-metric-card template, no identical icon+heading+text card grids repeated for their own sake. (Direct from PRODUCT.md's anti-references.)
- **Don't** add a tiny uppercase tracked eyebrow above a section just because "dashboards do this." The existing 11px uppercase `label` role is reserved for genuine data labels (table headers, weekday row) — don't extend it to section-intro decoration.
- **Don't** add shadow to cards, tables, or panels to create depth; that's the border's job here (see Elevation's Flat-By-Default Rule).
- **Don't** introduce a second saturated accent color competing with Ledger Blue. Use a `*-container` tint or the neutral scale instead.
- **Don't** use `border-left` as a colored accent anywhere in this system — including calendar/timetable event category coding, which uses a leading color dot plus background tint instead (see Components → Timetable / Calendar Event Blocks). The side-stripe pattern has no sanctioned exception here.
