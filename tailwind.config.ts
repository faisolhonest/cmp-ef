import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#2f66ff',
        success: '#1fbf75',
        warning: '#f7b84b',
        violet: '#8f6bff',
        navy: {
          900: '#081c3f',
          800: '#0b295d',
          950: '#0d1c3d',
        },
      },
    },
  },
  plugins: [],
}

export default config
