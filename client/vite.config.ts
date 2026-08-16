import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // bind to 0.0.0.0 so the dev server is reachable from other devices on
    // the LAN (e.g. a phone), not just localhost
    host: true,
    // ".ts.net" allows any Tailscale MagicDNS hostname on this tailnet,
    // since Vite otherwise rejects requests with an unrecognized Host header
    allowedHosts: ['.ts.net'],
  },
  preview: {
    host: true,
    allowedHosts: ['.ts.net'],
  },
})
