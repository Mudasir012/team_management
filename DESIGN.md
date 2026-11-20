---
name: Acme Studio
description: A dark aurora workspace where project collaboration feels calm, premium, and quietly futuristic.
colors:
  bg: "#050509"
  bg-elevated: "#0D0D14"
  glass: "rgba(255,255,255,0.08)"
  glass-strong: "rgba(255,255,255,0.14)"
  glass-border: "rgba(255,255,255,0.12)"
  text: "#FFFFFF"
  text-muted: "rgba(255,255,255,0.68)"
  text-faint: "rgba(255,255,255,0.56)"
  accent: "#B6F25C"
  accent-hover: "#C6FB73"
  accent-ink: "#0B1A00"
  danger: "#FF5B5B"
  danger-ink: "#FFB4B4"
  light-btn: "#FFFFFF"
  aurora-purple: "#9B2FC9"
  aurora-indigo: "#2B2BE0"
  aurora-magenta: "#FF2D78"
  aurora-orange: "#FF7A3D"
  aurora-navy: "#0B1033"
  tag-yellow: "#F5E642"
  tag-orange: "#FFA640"
typography:
  display:
    fontFamily: "Instrument Sans, Geist, Plus Jakarta Sans, Inter, system-ui"
    fontSize: "clamp(2.75rem, 6vw, 5rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontStyle: "normal"
  body:
    fontFamily: "Instrument Sans, Geist, Plus Jakarta Sans, Inter, system-ui"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Instrument Sans, Geist, Plus Jakarta Sans, Inter, system-ui"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  sm: "12px"
  md: "20px"
  lg: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "28px"
  xl: "56px"
  section: "104px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
    typography: "Instrument Sans 500 / 14px"
  button-glass:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
    typography: "Instrument Sans 500 / 14px"
  button-light:
    backgroundColor: "{colors.light-btn}"
    textColor: "#101014"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
    typography: "Instrument Sans 500 / 14px"
  auth-tabs:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "4px"
    typography: "Instrument Sans 400 / 13px"
  card:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "24px"
  input:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  hero-frame:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "86px 24px 130px"
---

# Design System: Acme Studio

## Overview

**Creative North Star: "The Quiet Aurora"**

This is a dark, premium collaboration world: near-black canvas, large blurred aurora fields, frosted-glass surfaces, and a single lime action color. The atmosphere is futuristic without becoming noisy. The hero feels expansive and cinematic; the working areas stay solid, fast, and readable.

The system adapts a reference visual language to a team/project collaboration product. It does not copy the reference content. Public surfaces speak in terms of projects, tasks, members, dashboards, chat, and video calls. Copy stays product-first: no demo labels, pricing tables, testimonials, or invented proof.

**Key Characteristics:**
- Near-black field with clipped aurora blobs as large background moments
- Frosted-glass cards used for navigation, floating previews, and overlays
- Light-weight oversized headline with upright and italic words
- One saturated UI accent: lime for actions, focus, active dots, and status
- Solid elevated panels for dense working areas

## Colors

The palette is almost entirely black and white opacity, with lime as the only saturated interface color and aurora hues reserved for large background glows.

### Primary
- **Action Lime** (#B6F25C): Primary buttons, focus rings, active dots, checklist completion, and recommended highlights.
- **Near Black** (#050509): Default canvas and hero base.
- **Elevated Black** (#0D0D14): Solid working panels, forms, and app surfaces.

### Secondary
- **Glass White** (rgba(255,255,255,0.08)): Default frosted surface.
- **Strong Glass** (rgba(255,255,255,0.14)): Hover and overlay glass.
- **Glass Border** (rgba(255,255,255,0.12)): Hairline structure on glass and dark panels.

### Tertiary
- **Aurora Purple** (#9B2FC9): Top-left background glow.
- **Aurora Magenta** (#FF2D78): Right-center diagonal glow.
- **Aurora Orange** (#FF7A3D): Bottom-right warmth.
- **Aurora Indigo** (#2B2BE0): Left and bottom depth.
- **Aurora Navy** (#0B1033): Broad low-frequency background depth.

### Neutral
- **Text White** (#FFFFFF): Headlines, body copy, and primary labels.
- **Muted White** (rgba(255,255,255,0.68)): Essential secondary copy.
- **Faint White** (rgba(255,255,255,0.56)): Decorative metadata and placeholders.
- **Light Button** (#FFFFFF): Tertiary action with dark text.
- **Tag Yellow** (#F5E642) / **Tag Orange** (#FFA640): Cursor name tags with dark text.

**The Lime-Only Rule.** Lime is the only saturated UI color. Purple, magenta, orange, indigo, and navy belong to large background glows only, never to text, buttons, icons, or small controls.

## Typography

**Display Font:** Instrument Sans, 400 weight, italic mixed into 1–2 words  
**Body Font:** Instrument Sans, 400 weight  
**Label Font:** Instrument Sans, 500 weight

**Character:** The typeface is geometric, clean, and slightly warm. At large sizes the regular weight still reads light and airy; the italic voice supplies personality without changing the system color or weight.

### Hierarchy
- **Display** (400, `clamp(2.75rem, 6vw, 5rem)`, 1.05): Hero headline only; centered, white, mixed upright and italic.
- **Section headline** (400, `clamp(2rem, 3.6vw, 3.5rem)`, 1.08): Section titles.
- **Title** (500, 18–24px, 1.2): Cards, panels, and app page titles.
- **Body** (400, 15–16px, 1.6): Supporting copy; 60–75ch maximum line length.
- **Label** (500, 13–14px, 1.2): Navigation, buttons, fields, and metadata.

**The Light Voice Rule.** Headlines never use bold or black weights, and never become all caps. Italic is limited to one or two words per headline.

## Layout

Marketing sections use a centered 1440px frame with generous 104px vertical rhythm. The hero clips its aurora inside a 28px-radius frame, keeps the headline over a dark scrim, and places rotated glass preview cards at the left and right edges. Below the hero, an inline capability strip leads into airy feature, preview, quote, pricing, CTA, and footer sections.

Login uses the same frame language with a split composition. The preview side carries the aurora and glass; the form side uses solid elevated black for readability. Dense app pages stay solid and do not inherit the marketing blur.

## Elevation & Depth

Depth comes from glass translucency, hairline borders, and soft black shadows. There are no hard offset shadows, thick borders, or sticker decorations. Aurora glows sit behind hero and CTA content only; dense tables, lists, and forms use solid panels.

### Shadow Vocabulary
- **Glass card** (`inset 0 1px 0 rgba(255,255,255,0.15), 0 20px 60px rgba(0,0,0,0.4)`): Floating cards, nav pill, feature cards, pricing cards.
- **Frame** (`0 30px 100px rgba(0,0,0,0.55)`): Outer marketing and login frame.
- **Focus ring** (`0 0 0 3px rgba(182,242,92,0.2)`): Input focus in addition to a lime border.
- **Primary hover** (`0 0 24px rgba(182,242,92,0.35)`): Lime button hover.

**The Scrim Rule.** Any text over an aurora field sits over the dark center or receives a dark radial scrim.

## Shapes

Pills dominate controls: buttons, nav items, tags, avatars, and status chips use 999px radii. Cards use 20px radii; large frames and CTA panels use 28px; inputs use 12px. Borders are 1px white-opacity hairlines. The only rotation is the subtle ±5° on floating preview cards and their cursor tags.

## Components

### Buttons
- **Shape:** Pill (`999px`), 44px minimum height, 14px weight 500 label.
- **Primary:** Lime fill with dark ink; hover brightens and gains a soft lime glow.
- **Glass:** White-opacity fill, glass border, white text; hover uses strong glass.
- **Light:** White fill with dark text for tertiary actions.
- **Focus:** 2px lime outline with 2px offset.

### Chips
- **Style:** Pill-shaped translucent labels with hairline borders.
- **Active:** White pill with dark text and a lime dot in the nav.
- **Cursor tags:** Yellow or orange pill with dark text attached to a mouse-pointer icon.

### Cards / Containers
- **Corner Style:** 20px for cards, 28px for frames and major previews.
- **Background:** Glass recipe for floating/card surfaces; solid elevated black for dense working areas.
- **Border:** 1px `rgba(255,255,255,0.12)`.
- **Hover:** Clickable cards lift 2px and brighten the border.

### Inputs / Fields
- **Style:** Glass fill, 1px glass border, 12px radius.
- **Focus:** Lime border plus a 3px lime ring.
- **Error:** Translucent red surface with readable light-red text.

### Navigation
- **Style:** Center glass pill with thin dividers; active item is a white pill with dark text and a lime dot.
- **Mobile:** Collapses to a 44px glass menu button that opens a full-screen-style glass menu.

### Auth Tabs
- **Style:** Glass pill with two options: Log in and Sign up.
- **Active:** White pill with dark ink and 500 weight.
- **Behavior:** Switching modes clears stale errors and loading state without leaving the page.

### Signature Components
- **Aurora Background:** Three to five blurred radial blobs over near black, clipped inside a frame.
- **Avatar Stack:** Overlapping circular avatars with a lime overflow circle, used inline in the headline.
- **Call Widget:** White name pill, lime timer chip, and circular mic/camera/end controls.
- **Checklist Card:** Round checkboxes; completed rows use lime and struck-through muted text.
- **Status Chips:** To do = white/gray, In progress = orange, In review = purple/indigo, Done = lime; always include a dot or icon.

## Do's and Don'ts

### Do:
- **Do** keep the page mostly black and clip aurora blobs to large background regions.
- **Do** keep lime as the only saturated UI color.
- **Do** use solid elevated panels for dense lists, forms, chat, and tables.
- **Do** keep text at 60% opacity or higher when it carries meaning.

### Don't:
- **Don't** use bold or black headline weights, all-caps headlines, or gradient text.
- **Don't** put gradients on buttons, icons, or small controls.
- **Don't** use thick borders, hard offset shadows, or sticker-style decoration.
- **Don't** let aurora blobs sit behind small body text.
- **Don't** label public copy as demo or show placeholder pricing.
- **Don't** invent customers, metrics, pricing, testimonials, or integrations.
