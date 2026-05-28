/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
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
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
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
        // ClassCard custom colors
        navy: {
          DEFAULT: '#0f1629',
          light: '#1a1f3d',
          lighter: '#242a52',
        },
        parchment: {
          DEFAULT: '#f0e6d3',
          dark: '#e8dcc0',
          ink: '#3d2b1f',
        },
        leather: {
          base: '#5c2818',
          mid: '#7a3a24',
          dark: '#3d180e',
          light: '#8f4a30',
        },
        brass: {
          DEFAULT: '#c9a84c',
          dark: '#8b7340',
          light: '#e8d5a0',
        },
        gold: {
          DEFAULT: '#c8a000',
          light: '#ffe680',
          dark: '#8b6000',
        },
        silver: {
          DEFAULT: '#7a9ab0',
          light: '#b0c8d8',
        },
        cc: {
          danger: '#e05555',
          success: '#4caf82',
          warning: '#ff9800',
          info: '#4a90d9',
          'text-muted': '#8a8a9a',
          'pg-muted': '#7a5a40',
          'pg-border': 'rgba(90,50,10,0.18)',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Nunito', 'sans-serif'],
        handwritten: ['Caveat', 'cursive'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        'gold': '0 6px 20px rgba(200,160,0,0.4)',
        'card-common': '0 8px 25px rgba(200,160,0,0.2)',
        'card-silver': '0 0 0 2px #7a9ab0, 0 8px 30px rgba(120,160,200,0.2)',
        'card-gold': '0 0 0 3px #d4a017, 0 8px 40px rgba(212,160,23,0.35)',
        'card-prismatic': '0 0 0 3px #c080ff, 0 8px 50px rgba(180,100,255,0.5), 0 0 30px rgba(255,150,255,0.2)',
        'parchment': '2px 3px 12px rgba(0,0,0,0.09), inset 0 1px 0 rgba(255,255,255,0.5)',
        'scrap-hover': '4px 8px 20px rgba(0,0,0,0.14)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "prismShift": {
          "0%, 100%": { filter: "hue-rotate(0deg) brightness(1.05)" },
          "50%": { filter: "hue-rotate(30deg) brightness(1.12)" },
        },
        "starPop": {
          "0%": { transform: "scale(0) rotate(0deg)", opacity: "0" },
          "40%": { opacity: "1" },
          "70%": { transform: "scale(1.3) rotate(20deg)", opacity: "0.9" },
          "100%": { transform: "scale(0) rotate(40deg)", opacity: "0" },
        },
        "lockPulse": {
          "0%, 100%": { opacity: "0.9" },
          "50%": { opacity: "1" },
        },
        "shackleRise": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-20px)" },
        },
        "shackleRotate": {
          "0%": { transform: "translateY(-20px) rotate(0deg)" },
          "100%": { transform: "translateY(-20px) rotate(45deg)" },
        },
        "lockFade": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.8)" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-5px)" },
          "50%": { transform: "translateX(5px)" },
          "75%": { transform: "translateX(-5px)" },
        },
        "cardShimmerTilt": {
          "0%": { transform: "rotateY(0deg) rotateX(0deg) scale(1)" },
          "20%": { transform: "rotateY(12deg) rotateX(-6deg) scale(1.04)" },
          "45%": { transform: "rotateY(-10deg) rotateX(5deg) scale(1.04)" },
          "70%": { transform: "rotateY(8deg) rotateX(-4deg) scale(1.04)" },
          "90%": { transform: "rotateY(-4deg) rotateX(2deg) scale(1.02)" },
          "100%": { transform: "rotateY(0deg) rotateX(0deg) scale(1)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(200,160,0,0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(200,160,0,0.6)" },
        },
        "confettiFall": {
          "0%": { transform: "translateY(-100vh) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(100vh) rotate(720deg)", opacity: "0" },
        },
        "countUp": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "prism": "prismShift 4s ease-in-out infinite",
        "star-pop": "starPop 1.4s ease-in-out infinite",
        "lock-pulse": "lockPulse 2s ease-in-out infinite",
        "shackle-rise": "shackleRise 0.4s ease-out forwards",
        "shackle-rotate": "shackleRotate 0.4s ease-out 0.4s forwards",
        "lock-fade": "lockFade 0.4s ease-out 0.8s forwards",
        "shake": "shake 0.3s ease-in-out",
        "card-shimmer": "cardShimmerTilt 1.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards",
        "float": "float 3s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite",
        "confetti": "confettiFall 3s ease-in forwards",
        "count-up": "countUp 0.5s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
