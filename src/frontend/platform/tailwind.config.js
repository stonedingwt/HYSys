/** @type {import('tailwindcss').Config} */
const { fontFamily } = require("tailwindcss/defaultTheme");

import plugin from "tailwindcss/plugin";

// ! Check if removing the other module.exports made sense
module.exports = {
  darkMode: ["class"],
  content: [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "./index.html",
    "./src/**/*.{js,ts,tsx,jsx}",
  ],
  safelist: [
    "bg-status-blue",
    "bg-status-green",
    "bg-status-red",
    "bg-status-yellow",
  ],
  important: true,
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        'my-size': '1800px',
        'my-size-lg': '2200px'
      },
      boxShadow: {
        'glow': '0 0 20px rgba(6,182,212,0.15)',
        'glow-lg': '0 0 40px rgba(6,182,212,0.2)',
        'navy': '0 4px 14px rgba(30,58,95,0.12)',
      },
      keyframes: {
        'ai-pulse': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        'ai-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'ai-breathe': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(6,182,212,0.1)' },
          '50%': { boxShadow: '0 0 24px rgba(6,182,212,0.25)' },
        },
      },
      animation: {
        'ai-pulse': 'ai-pulse 2s ease-in-out infinite',
        'ai-shimmer': 'ai-shimmer 2.5s ease-in-out infinite',
        'ai-breathe': 'ai-breathe 3s ease-in-out infinite',
      },
      colors: {
        navy: {
          50: '#F0F4FA',
          100: '#DCE6F2',
          200: '#B8CCE5',
          300: '#8BACD3',
          400: '#5A87BC',
          500: '#3A6699',
          600: '#1E3A5F',
          700: '#182F4D',
          800: '#12243B',
          900: '#0C1A2E',
          950: '#081222',
        },
        cyan: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
          950: '#083344',
        },
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        green: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        "search-input": "var(--search-input)",
        "background-new": "var(--background-new)",
        "prompt-description": "var(--text-prompt)",
        "background-prompt": "var(--background-prompt)",
        "text-answer": "var(--text-answer)",
        "header-icon": "var(--header-icon)",
        "nav-hover": "var(--nav-hover)",
        "background-tip": "var(--background-tip)",
        "background-tip-darkhover": "var(--background-tip-darkhover)",
        "background-main-content": "var(--background-main-content)",
        "background-main": "var(--background-main)",
        "button": "var(--button)",
        "login-input": "var(--login-input)",
        "tx-color": "var(--text-color)",
        "background-login": "var(--background-login)",
        "background-dark": "var(--background)",
        "component-icon": "var(--component-icon)",
        "flow-icon": "var(--flow-icon)",
        "low-indigo": "var(--low-indigo)",
        "chat-send": "var(--chat-send)",
        connection: "var(--connection)",
        "almost-dark-gray": "var(--almost-dark-gray)",
        "almost-light-blue": "var(--almost-light-blue)",
        "almost-medium-blue": "var(--almost-medium-blue)",
        "almost-medium-gray": "var(--almost-medium-gray)",
        "almost-medium-green": "var(--almost-medium-green)",
        "almost-medium-red": "var(--almost-medium-red)",
        "btn-shadow": "var(--round-btn-shadow)",
        "build-trigger": "var(--build-trigger)",
        "chat-trigger": "var(--chat-trigger)",
        "chat-trigger-disabled": "var(--chat-trigger-disabled)",
        "blur-shared": "var(--blur-shared)",
        "dark-blue": "var(--dark-blue)",
        "dark-gray": "var(--dark-gray)",
        "dark-red": "var(--dark-red)",
        "error-background": "var(--error-background)",
        "error-foreground": "var(--error-foreground)",
        "high-dark-gray": "var(--high-dark-gray)",
        "high-indigo": "var(--high-indigo)",
        "high-light-gray": "var(--high-light-gray)",
        "info-background": "var(--info-background)",
        "info-foreground": "var(--info-foreground)",
        "light-blue": "var(--light-blue)",
        "light-gray": "var(--light-gray)",
        "light-slate": "var(--light-slate)",
        "medium-blue": "var(--medium-blue)",
        "status-blue": "var(--status-blue)",
        "medium-dark-gray": "var(--medium-dark-gray)",
        "medium-dark-green": "var(--medium-dark-green)",
        "medium-dark-red": "var(--medium-dark-red)",
        "medium-emerald": "var(--medium-emerald)",
        "medium-gray": "var(--medium-gray)",
        "medium-high-indigo": "var(--medium-high-indigo)",
        "medium-indigo": "var(--medium-indigo)",
        "medium-low-gray": "var(--medium-low-gray)",
        "status-green": "var(--status-green)",
        "status-red": "var(--status-red)",
        "status-yellow": "var(--status-yellow)",
        "success-background": "var(--success-background)",
        "success-foreground": "var(--success-foreground)",
        "beta-background": "var(--beta-background)",
        "beta-foreground": "var(--beta-foreground)",
        "chat-bot-icon": "var(--chat-bot-icon)",
        "chat-user-icon": "var(--chat-user-icon)",
        "black-button": "hsl(var(--black-button))",
        white: "var(--white)",
        border: "hsl(var(--border))",
        input: "hsl(var(--input)/0.15)",
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
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "var(--font-sans)", ...fontFamily.sans],
        display: ["Plus Jakarta Sans", "Inter", ...fontFamily.sans],
      },
    },
  },

  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/forms")({
      strategy: "class", // only generate classes
    }),
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".scrollbar-hide": {
          /* IE and Edge */
          "-ms-overflow-style": "none",
          /* Firefox */
          "scrollbar-width": "none",
          /* Safari and Chrome */
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
        ".truncate-multiline": {
          display: "-webkit-box",
          "-webkit-line-clamp":
            "3" /* Change this number to the number of lines you want to show */,
          "-webkit-box-orient": "vertical",
          overflow: "hidden",
          "text-overflow": "ellipsis",
        },
        ".truncate-doubleline": {
          display: "-webkit-box",
          "-webkit-line-clamp":
            "2" /* Change this number to the number of lines you want to show */,
          "-webkit-box-orient": "vertical",
          overflow: "hidden",
          "text-overflow": "ellipsis",
        },
        ".word-break-break-word": {
          wordBreak: "break-word",
        },
        ".arrow-hide": {
          "&::-webkit-inner-spin-button": {
            "-webkit-appearance": "none",
            margin: 0,
          },
          "&::-webkit-outer-spin-button": {
            "-webkit-appearance": "none",
            margin: 0,
          },
        },
        ".password": {
          "-webkit-text-security": "disc",
          "font-family": "text-security-disc",
        },
        ".stop": {
          "-webkit-animation-play-state": "paused",
          "-moz-animation-play-state": "paused",
          "animation-play-state": "paused",
        },
        ".custom-scroll": {
          "&::-webkit-scrollbar": {
            width: "8px",
            height: "8px",
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: "#f1f1f1",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#ccc",
            borderRadius: "999px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            backgroundColor: "#bbb",
          },
          cursor: "auto",
        },
        ".dark .theme-attribution .react-flow__attribution": {
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          padding: "0px 5px",
        },
        ".dark .theme-attribution .react-flow__attribution a": {
          color: "black",
        },
        ".text-align-last-left": {
          "text-align-last": "left",
        },
        ".text-align-last-right": {
          "text-align-last": "right",
        },
      });
    }),
    require("@tailwindcss/typography")
  ],
};
