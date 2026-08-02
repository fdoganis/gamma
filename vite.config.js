import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
    base: "./",
    clearScreen: false,
    build: {
        target: 'es2022',
        sourcemap: true,
        chunkSizeWarningLimit: 1024
    },
    server: {
        open: true,
        allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok-free.dev']
    },
    plugins: [
        glsl()
    ]
})
