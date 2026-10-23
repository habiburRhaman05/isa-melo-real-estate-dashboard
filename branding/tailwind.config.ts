import type { Config } from "tailwindcss";

/**
 * Tailwind v3 config for the Isa Melo brand (extracted from index.html).
 * Pairs with app/globals.css (HSL CSS variables, shadcn format).
 * Requires:  npm i tailwindcss-animate
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      /* ---------------- Fonts ---------------- */
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Times New Roman", "serif"],
      },

      /* ---------------- Font sizes (exact values from the source) ---------------- */
      fontSize: {
        // headings
        display: ["44px", { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "500" }], // h1
        stat: ["42px", { lineHeight: "1.1", fontWeight: "400" }],                               // stat numbers
        title: ["26px", { lineHeight: "1.2", fontWeight: "500" }],                              // modal h2
        "name-lg": ["20px", { lineHeight: "1.3" }],                                             // lead name (serif)
        "cal-title": ["17px", { lineHeight: "1.3", fontWeight: "500" }],                        // calendar month (serif)
        "card-title": ["17px", { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "700" }], // h3 card title
        // body
        body: ["14px", { lineHeight: "1.5" }],        // base
        "body-sm": ["13px", { lineHeight: "1.5" }],   // descriptions, comments
        "body-xs": ["12.5px", { lineHeight: "1.4" }], // rows, stat labels, names
        caption: ["12px", { lineHeight: "1.4" }],     // labels, small text
        "caption-sm": ["11.5px", { lineHeight: "1.4" }],
        // micro / uppercase labels
        eyebrow: ["11px", { letterSpacing: "0.2em", fontWeight: "700" }],
        micro: ["10.5px", { letterSpacing: "0.12em", fontWeight: "700" }],
        badge: ["9.5px", { letterSpacing: "0.1em", fontWeight: "700" }],
      },

      letterSpacing: {
        eyebrow: "0.2em",
        label: "0.14em",
        th: "0.12em",
      },

      /* ---------------- Colors ---------------- */
      colors: {
        // shadcn core
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // brand extras
        brand: {
          DEFAULT: "hsl(var(--brand))",
          hover: "hsl(var(--brand-hover))",
          soft: "hsl(var(--brand-soft))",
          deep: "hsl(var(--brand-deep))",
        },
        panel: "hsl(var(--panel))",
        column: "hsl(var(--column))",
        faint: "hsl(var(--faint))",
        label: "hsl(var(--label))",
        "border-hover": "hsl(var(--border-hover))",
        "soft-border": "hsl(var(--soft-border))",

        gold: {
          DEFAULT: "hsl(var(--gold))",
          soft: "hsl(var(--gold-soft))",
          border: "hsl(var(--gold-border))",
        },
        amber: {
          soft: "hsl(var(--amber-soft))",
          foreground: "hsl(var(--amber-foreground))",
        },
        danger: {
          soft: "hsl(var(--danger-soft))",
          border: "hsl(var(--danger-border))",
          text: "hsl(var(--danger-text))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          soft: "hsl(var(--success-soft))",
        },
        low: {
          soft: "hsl(var(--low-soft))",
          foreground: "hsl(var(--low-foreground))",
        },

        // pipeline stages  ->  bg-stage-new, text-stage-posted, etc.
        stage: {
          new: "hsl(var(--stage-new))",
          working: "hsl(var(--stage-working))",
          review: "hsl(var(--stage-review))",
          revision: "hsl(var(--stage-revision))",
          approved: "hsl(var(--stage-approved))",
          posted: "hsl(var(--stage-posted))",
        },

        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },

      /* ---------------- Radius ---------------- */
      borderRadius: {
        lg: "var(--radius)",             // 12px  inputs, buttons
        md: "calc(var(--radius) - 2px)", // 10px
        sm: "calc(var(--radius) - 4px)", // 8px
        card: "16px",
        "card-sm": "14px",
        stat: "18px",
        modal: "22px",
        panel: "24px",
      },

      /* ---------------- Shadows ---------------- */
      boxShadow: {
        button: "var(--shadow-button)",
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        popover: "var(--shadow-popover)",
        modal: "var(--shadow-modal)",
        focus: "var(--shadow-focus)",
      },

      /* ---------------- Layout ---------------- */
      height: { topbar: "72px" },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
