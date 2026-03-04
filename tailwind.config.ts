import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./components/**/*.{vue,js,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./app.vue"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "ui-sans-serif", "system-ui"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular"]
      },
      colors: {
        ink: {
          950: "#0c0f14",
          900: "#11151c",
          800: "#1a2230",
          700: "#243248"
        },
        glow: {
          500: "#22d3ee",
          600: "#06b6d4"
        },
        lime: {
          500: "#84cc16",
          600: "#65a30d"
        },
        ember: {
          500: "#f97316",
          600: "#ea580c"
        },
        violet: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed"
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))"
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(0,0,0,0.35)",
        glow: "0 0 0 1px rgba(34,211,238,0.2), 0 12px 30px -18px rgba(34,211,238,0.6)",
        "glow-lg": "0 0 0 1px rgba(34,211,238,0.3), 0 20px 60px -20px rgba(34,211,238,0.5)",
        card: "0 4px 24px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)"
      },
      backgroundImage: {
        grid: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
        haze: "radial-gradient(1200px 600px at 70% -10%, rgba(34,211,238,0.18), transparent 55%), radial-gradient(800px 400px at 20% 0%, rgba(132,204,22,0.15), transparent 60%)"
      }
    }
  },
  plugins: []
} satisfies Config;
