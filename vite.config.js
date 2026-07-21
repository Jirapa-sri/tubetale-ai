import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { youtubeMetadataPlugin } from './server/youtubePlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), youtubeMetadataPlugin()],
})
