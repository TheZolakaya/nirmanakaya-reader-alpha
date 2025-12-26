/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontSize: {
        'scaled-xs': 'var(--text-xs)',
        'scaled-sm': 'var(--text-sm)',
        'scaled-base': 'var(--text-base)',
        'scaled-lg': 'var(--text-lg)',
        'scaled-xl': 'var(--text-xl)',
      },
    },
  },
  plugins: [],
}
