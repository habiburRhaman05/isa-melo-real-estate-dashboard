# Isa Melo Dashboard: Design Tokens (extracted from index.html)

## 1. Fonts

| Role | Font | Weights | Used for |
|---|---|---|---|
| Sans | **Inter** | 400 / 500 / 600 / 700 | body, buttons, inputs, card titles, labels |
| Serif | **Fraunces** (opsz 9..144) | 400 / 500 | h1, modal h2, stat numbers, lead name, calendar month |

Fallbacks: sans -> `system-ui, -apple-system, 'Segoe UI', sans-serif`; serif -> `Georgia, 'Times New Roman', serif`.
Base: `font-size: 14px`, `-webkit-font-smoothing: antialiased`.

## 2. Type scale

| Token | Size | Weight | Font | Extra | Tailwind class |
|---|---|---|---|---|---|
| h1 page title | 44px | 500 | Fraunces | letter-spacing -0.01em | `text-display font-serif` |
| Stat number | 42px | 400 | Fraunces | line-height 1.1 | `text-stat font-serif` |
| h2 modal title | 26px | 500 | Fraunces | | `text-title font-serif` |
| Lead name | 20px | 400 | Fraunces | | `text-name-lg font-serif` |
| Calendar month | 17px | 500 | Fraunces | | `text-cal-title font-serif` |
| h3 card title | 17px | 700 | Inter | line-height 1.25, ls -0.01em | `text-card-title` |
| Body / subtitle | 14px | 400 | Inter | | `text-body` |
| Description | 13px | 400 | Inter | line-height 1.5 | `text-body-sm` |
| Row / stat label | 12.5px | 500-600 | Inter | | `text-body-xs` |
| Caption / form label | 12px | 600 | Inter | | `text-caption` |
| Eyebrow | 11px | 700 | Inter | ls 0.2em, uppercase, gold | `eyebrow` class |
| Pane title / th | 10.5px | 700 | Inter | ls 0.12-0.14em, uppercase | `pane-title` / `th-label` |
| Badge | 9.5px | 700 | Inter | ls 0.1em | `text-badge` |

## 3. Color palette

### Core
| Name | Hex | HSL (shadcn) | Variable |
|---|---|---|---|
| Background | `#ffffff` | 0 0% 100% | `--background` |
| Ink (foreground) | `#1b1233` | 256 48% 14% | `--foreground` |
| **Brand purple** | `#5a2d9c` | 264 55% 39% | `--primary` / `--brand` |
| Brand hover | `#4a2385` | 264 58% 33% | `--brand-hover` |
| Brand soft | `#ece4fa` | 262 69% 94% | `--secondary` / `--accent` |
| Muted text | `#6f6888` | 253 13% 47% | `--muted-foreground` |
| Faint text | `#9a93b3` | 253 17% 64% | `--faint` |
| Border / line | `#e8e2f3` | 261 41% 92% | `--border` |
| Panel (board bg) | `#f1ebfb` | 262 67% 95% | `--panel` |
| Column bg | `#f8f5fd` | 262 67% 98% | `--muted` / `--column` |
| Focus ring | `#a98ddb` | 262 52% 71% | `--ring` |
| Deep purple | `#2a1458` | 259 63% 21% | `--brand-deep` |

### Accents
| Name | Hex | HSL | Variable |
|---|---|---|---|
| Gold | `#8a6212` | 40 77% 31% | `--gold` |
| Gold soft | `#f6ecc8` | 47 72% 87% | `--gold-soft` |
| Red (destructive) | `#b32d45` | 349 60% 44% | `--destructive` |
| Red soft | `#fdecef` | 349 81% 96% | `--danger-soft` |
| Green (success) | `#25704f` | 154 50% 29% | `--success` |
| Green soft | `#dcefe5` | 148 37% 90% | `--success-soft` |

### Pipeline stages
New `#a99bd0` · Working `#5a2d9c` · Need Review `#7a5a00` · Revision `#c0364a` · Approved `#d4a02a` · Posted `#2f9e6e`
(Use as `bg-stage-new`, `text-stage-posted`, etc.)

### Lead stages (inline in the source JS)
New `#a99bd0` · Contacted `#5a2d9c` · Qualified `#d4a02a` · Proposal Sent `#2a1458` · Won `#2f9e6e` · Lost `#c0364a`

### Priority pills
- High: bg `#fbe9c9`, text `#8a5a0f`, border `#f1d9a6`
- Medium: bg `#ece4fa`, text `#5a2d9c`, border `#d9cbf3`
- Low: bg `#eeeaf3`, text `#6b6480`, border `#e0dbe8`

## 4. Radius, shadows, spacing

| Token | Value |
|---|---|
| Inputs / buttons | 12px (`rounded-lg`) |
| Cards | 16px (`rounded-card`), lead cards 14px |
| Stat strip | 18px (`rounded-stat`) |
| Modal | 22px (`rounded-modal`) |
| Board panel | 24px (`rounded-panel`) |
| Pills / badges | 999px (`rounded-full`) |
| Top bar height | 72px (`h-topbar`), 1px border bottom |
| Page padding | 36px 24px 48px |
| Button shadow | `0 4px 14px rgba(90,45,156,.25)` (`shadow-button`) |
| Card shadow | `0 1px 2px rgba(40,20,80,.05)` -> hover `0 8px 22px rgba(60,30,120,.14)` |
| Modal shadow | `0 30px 80px rgba(30,10,70,.35)`, overlay `rgba(27,18,51,.45)` + `blur(2px)` |
| Input focus | border `#a98ddb` + `0 0 0 3px rgba(122,84,200,.15)` |

## 5. Install checklist

```bash
npm i tailwindcss-animate class-variance-authority clsx tailwind-merge lucide-react
npx shadcn@latest init        # if the project doesn't have shadcn yet
npx shadcn@latest add button input select textarea dialog badge card table tabs
```

Copy `app/globals.css`, `app/layout.tsx`, and `tailwind.config.ts` into your project (merge if you already have them).

## 6. Usage examples

```tsx
<p className="eyebrow">SOCIAL MEDIA BOARD</p>
<h1>Content pipeline</h1>               {/* serif 44px via globals.css */}
<p className="text-muted-foreground">Every post, from brief to published.</p>

<Button className="rounded-xl bg-brand px-[18px] py-3 font-semibold shadow-button hover:bg-brand-hover">
  New task
</Button>

<div className="rounded-stat border">
  <b className="stat-number text-brand">12</b>
  <span className="stat-label">Active tasks</span>
</div>

<span className="prio prio-high">High</span>
```

## 7. Tailwind v4 note

If your app uses **Tailwind v4** (shadcn's newer default), there is no `tailwind.config.ts`. Replace the three `@tailwind` lines at the top of `globals.css` with `@import "tailwindcss";` and add this block after the `:root` and `.dark` blocks:

```css
@theme inline {
  --font-sans: var(--font-inter);
  --font-serif: var(--font-fraunces);
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-card: hsl(var(--card));
  --color-popover: hsl(var(--popover));
  --color-brand: hsl(var(--brand));
  --color-brand-hover: hsl(var(--brand-hover));
  --color-brand-soft: hsl(var(--brand-soft));
  --color-gold: hsl(var(--gold));
  --color-success: hsl(var(--success));
  --color-panel: hsl(var(--panel));
  --color-column: hsl(var(--column));
  --radius-lg: var(--radius);
}
```

In v4 also rename the font variables in `layout.tsx` to `variable: "--font-inter"` and `variable: "--font-fraunces"` (a theme variable can't point at itself). The `@apply border-border` and `@apply font-serif` lines in the base layer work in v4 once these theme keys exist.
