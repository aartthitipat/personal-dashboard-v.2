---
name: Personal Dashboard
description: A confident, structured single-user workspace for finances, calendar, and study.
colors:
  primary: "#004ac6"
  primary-container: "#2563eb"
  on-primary: "#ffffff"
  on-primary-container: "#eeefff"
  secondary: "#505f76"
  secondary-container: "#d0e1fb"
  on-secondary: "#ffffff"
  on-secondary-container: "#54647a"
  tertiary: "#525657"
  tertiary-container: "#6b6e70"
  on-tertiary: "#ffffff"
  on-tertiary-container: "#eff1f3"
  error: "#ba1a1a"
  error-container: "#ffdad6"
  on-error: "#ffffff"
  on-error-container: "#93000a"
  success: "#15803d"
  success-container: "#dcfce7"
  on-success: "#ffffff"
  on-success-container: "#166534"
  surface: "#faf8ff"
  surface-dim: "#d2d9f4"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f2f3ff"
  surface-container: "#eaedff"
  surface-container-high: "#e2e7ff"
  surface-container-highest: "#dae2fd"
  on-surface: "#131b2e"
  on-surface-variant: "#434655"
  outline: "#737686"
  outline-variant: "#c3c6d7"
  background: "#faf8ff"
typography:
  headline:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  full: "999px"
  lg: "1rem"
  md: "0.75rem"
  sm: "0.5rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-danger:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-error-container}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  nav-item-active:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  pill:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
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

Cool, saturated blue as the single committed accent against a near-white (light) or near-black (dark) neutral field, with slate and graphite as quiet secondary/tertiary roles that never compete with the primary.

### Primary
- **Ledger Blue** (`#004ac6` light / `#aac7ff` dark): the one color that means "this is active, primary, or actionable." Used on primary buttons, the active nav item's label, the current-time line on the timetable, chart's positive series, progress fill, and links.

### Secondary
- **Slate** (`#505f76` light / `#aec7f7` dark): the active-nav-item background family and subscription-avatar accents. A cooler, quieter partner to Ledger Blue — never used for primary actions.

### Tertiary
- **Graphite** (`#525657` light / `#ffb68c` dark): reserved for the exam/deadline event category, keeping it visually distinct from ordinary study sessions (primary) and tasks (secondary) without introducing a third loud color.

### Neutral
- **Surface** (`#faf8ff` light / `#10131a` dark): page background.
- **Surface Container Lowest** (`#ffffff` light / `#0b0e14` dark): cards, panels, modals, the sidebar — the "paper" layer that sits above the page background.
- **Surface Container / Container High** (`#eaedff`, `#e2e7ff` light): pills, progress track background, hover states — one step up from paper, for elements nested inside a card.
- **On-Surface** (`#131b2e` light / `#e0e2eb` dark): primary text.
- **On-Surface Variant** (`#434655` light / `#c1c6d5` dark): secondary text, labels, muted metadata.
- **Outline Variant** (`#c3c6d7` light / `#414753` dark): the 1px hairline used for every border in the system — cards, fields, table rows, dividers.

### Semantic
- **Success** (`#15803d` light / `#8fdba1` dark): income amounts, positive stat trends.
- **Error** (`#ba1a1a` light / `#ffb4ab` dark): destructive actions, expense-negative flags, pending-review alerts.

### Named Rules
**The One-Accent Rule.** Ledger Blue is the only color allowed to signal "primary action" or "this is active." If a screen needs a second visually loud color, reach for a container tint (`*-container`) at low opacity before introducing a new hue.

**The Hairline Rule.** Separation between surfaces is drawn with a single `1px solid var(--color-outline-variant)` border, not a shadow. Shadows are reserved for elements that visually float above the page (see Elevation).

## 3. Typography

**Body Font:** Inter (with system-ui, -apple-system, "Segoe UI", sans-serif)

**Character:** A single geometric-humanist sans carries the entire system at four weights (400/500/600/800). There is no display tier — the largest heading is 30px — which keeps every screen reading as data-dense and structured rather than promotional.

### Hierarchy
- **Headline** (600, 30px, line-height 1.2): page-level titles (`Financial Overview`, `Study`) and hero numeric values (`stat-value`, savings goal amount).
- **Title** (600, 24px, line-height 1.25): section headers within a page (`Study Timetable`, the Calendar page title).
- **Body** (400, 14px, line-height 1.5): the default for all UI text — table cells, form fields, nav labels, chat messages. Buttons and nav items use the same 14px size at 500 weight for emphasis without introducing a new scale step.
- **Label** (600, 11px, uppercase, letter-spacing 0.04em): table column headers, weekday labels, the `eyebrow` class, and section-header micro-labels — always functional (labeling a data column or region), never decorative.

### Named Rules
**The No-Display Rule.** Nothing on this surface exceeds 30px. If a future screen wants a bigger number, it earns that size by being the single most important figure on the page (e.g. total balance), not by default.

## 4. Elevation

Flat by default. Surfaces are separated by the 1px `outline-variant` hairline (see Colors → Named Rules), not by shadow — cards, the sidebar, the topbar, and table rows all sit at the same visual depth. Shadow is reserved for the two elements that genuinely float above the page content: the floating action button and modal dialogs.

### Shadow Vocabulary
- **Floating action** (`box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22)`): the circular "+" FAB on the Dashboard page — the one element meant to read as hovering above the timetable.
- **Modal** (`box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35)`): dialog overlays (event form, class-schedule form) — a deliberately heavier shadow since the modal sits above a dimmed backdrop, not just above page content.

### Named Rules
**The Flat-By-Default Rule.** If you're reaching for `box-shadow` on a card, table, or panel, use a border instead. Shadow is earned only by elements that overlay other content (modals) or float independent of the page's scroll layer (the FAB).

## 5. Components

### Buttons
- **Shape:** 12px radius (`rounded.md`) on standard buttons; full-round (999px) on icon-only buttons and the FAB.
- **Primary:** Ledger Blue fill, white text, 10px/16px padding, 500 weight, 14px.
- **Secondary:** white/lowest-surface fill with a 1px outline-variant border and on-surface text — same shape and padding as primary, distinguished by fill only.
- **Danger:** error-container fill with on-error-container text, same shape.
- **Small variants** (`btn-sm`): 6px/12px padding, 12px text, used inline in cards (goal edit, subscription add) where a full-size button would overpower the layout.

### Pills / Badges
- **Style:** full-round (999px), surface-container background, on-surface-variant text, 12px/500.
- **State:** an error variant (`pill-error`, error-container background) marks "Action Required" on pending transactions. Event pills on the calendar reuse this shape with category colors (primary for sessions, tertiary-container for exams/deadlines, secondary-container for tasks).

### Cards / Containers
- **Corner Style:** 16px radius (`rounded.lg`).
- **Background:** `surface-container-lowest` — the "paper" layer.
- **Shadow Strategy:** none (see Elevation) — a 1px `outline-variant` border does the separation work instead.
- **Internal Padding:** 24px (`spacing.xl`).

### Inputs / Fields
- **Style:** 12px radius, 1px outline-variant border, `surface` background (one step darker than card background, so fields read as recessed relative to the card they sit in), 14px text.
- **Focus:** no custom focus treatment currently defined beyond the browser default — a gap worth closing before shipping new forms (see Do's and Don'ts).

### Navigation
- **Sidebar nav items:** transparent by default, on-surface-variant text; active item gets `secondary-container` background with Ledger Blue text — the one place secondary and primary colors combine. Collapses to icon-only at 84px width with a 0.25s width transition.
- **Mobile nav:** a fixed bottom bar below 900px, same active/inactive color logic as the sidebar, icon-over-label instead of icon-beside-label.

### Timetable / Calendar Event Blocks
Category color is carried by a 30%-opacity tint of the matching `*-container` color (`color-mix(in srgb, var(--color-primary-container) 30%, transparent)`) plus a small leading color dot next to the time — never a border-left stripe (see Do's and Don'ts). Recurring events get a full 1px dashed outline instead of a solid one.

## 6. Do's and Don'ts

### Do:
- **Do** let Ledger Blue mean one thing: primary/active/now. Reuse it for anything that needs to say "this is the important one" (primary buttons, active nav, current-time line, positive progress).
- **Do** separate surfaces with the 1px `outline-variant` hairline, not a shadow.
- **Do** keep body text at 14px/400 Inter; reserve 600 weight for headline/title/label roles only.
- **Do** use `color-mix(...) 18%` tints with a solid left border for category-coded blocks (calendar/timetable), matching the existing `ev-session` / `ev-exam` / `ev-task` pattern.
- **Do** cap headings at 30px (`headline`) — the system has no display tier and shouldn't invent one casually.

### Don't:
- **Don't** use the generic SaaS dashboard-generator look: no gradient text, no hero-metric-card template, no identical icon+heading+text card grids repeated for their own sake. (Direct from PRODUCT.md's anti-references.)
- **Don't** add a tiny uppercase tracked eyebrow above a section just because "dashboards do this." The existing 11px uppercase `label` role is reserved for genuine data labels (table headers, weekday row) — don't extend it to section-intro decoration.
- **Don't** add shadow to cards, tables, or panels to create depth; that's the border's job here (see Elevation's Flat-By-Default Rule).
- **Don't** introduce a second saturated accent color competing with Ledger Blue. Use a `*-container` tint or the neutral scale instead.
- **Don't** use `border-left` as a colored accent anywhere in this system — including calendar/timetable event category coding, which uses a leading color dot plus background tint instead (see Components → Timetable / Calendar Event Blocks). The side-stripe pattern has no sanctioned exception here.
