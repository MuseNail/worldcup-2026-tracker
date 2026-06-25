import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works whether served from a project page
// (https://user.github.io/worldcup-2026-tracker/) or a custom domain root.
export default defineConfig({
  plugins: [react()],
  base: './',
})
