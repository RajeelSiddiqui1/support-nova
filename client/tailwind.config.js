/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        nw: {
          base:     'var(--nw-base)',
          surface:  'var(--nw-surface)',
          elevated: 'var(--nw-elevated)',
          border:   'var(--nw-border)',
          accent:   'var(--nw-accent)',
          gold:     'var(--nw-gold)',
          success:  'var(--nw-success)',
          warning:  'var(--nw-warning)',
          danger:   'var(--nw-danger)',
          info:     'var(--nw-info)',
          text: {
            primary:   'var(--nw-text-primary)',
            secondary: 'var(--nw-text-secondary)',
            muted:     'var(--nw-text-muted)',
          },
        },
      },
    },
  },
  plugins: [],
}
