// Tailwind is wired in via its dedicated Vite plugin (Tailwind v4's
// recommended setup) rather than the older PostCSS config file approach.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
