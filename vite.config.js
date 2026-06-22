
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: 'kk9app/',   // например '/kk9/' — со слешами с обеих сторон!
  plugins: [react()],
})