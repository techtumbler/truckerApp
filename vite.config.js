// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// HTTP-Dev-Server, im LAN erreichbar
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // iPhone/Tablet im selben WLAN kann zugreifen (http://<deine-IP>:5173)
    https: false, // explizit aus
    port: 5173
  },
  preview: {
    https: false
  }
})
