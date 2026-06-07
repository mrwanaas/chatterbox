/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Discord-inspired dark theme
        cb: {
          bg:         '#36393f',
          'bg-dark':  '#2f3136',
          'bg-darker':'#202225',
          'bg-input': '#40444b',
          sidebar:    '#2f3136',
          'sidebar-hover': '#35393f',
          text:       '#dcddde',
          'text-muted':'#72767d',
          'text-link': '#00b0f4',
          accent:     '#5865f2',
          'accent-hover': '#4752c4',
          green:      '#3ba55c',
          red:        '#ed4245',
          yellow:     '#faa81a',
          mention:    '#f0b232',
        },
      },
      fontFamily: {
        sans: ['"gg sans"', '"Noto Sans"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in':   'fadeIn 0.15s ease',
        'slide-up':  'slideUp 0.2s ease',
        'pulse-dot': 'pulseDot 1.4s infinite',
      },
      keyframes: {
        fadeIn:   { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp:  { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pulseDot: { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.3)' } },
      },
    },
  },
  plugins: [],
};
