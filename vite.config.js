import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    minify: 'esbuild', // Use esbuild for fast minification (default)
    // Alternative: 'terser' for more aggressive minification
    // minify: 'terser',
    sourcemap: false, // Set to true if you want source maps
    rollupOptions: {
      output: {
        // Ensure single bundle
        manualChunks: undefined
      }
    }
  }
})

