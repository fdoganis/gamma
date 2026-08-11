import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {

    const isProd = mode === 'production';

    return {
        base: "./",
        clearScreen: false,
        resolve: {
            alias: {
                'three/addons': 'three/examples/jsm',
            },
        },
        build: {
            target: 'es2022',
            sourcemap: !isProd,
            chunkSizeWarningLimit: 1024,

            modulePreload: { polyfill: false },
            rolldownOptions: {
                external: ['three'],
                output: {
                    minify: isProd ? {
                        compress: true,
                        mangle: true
                    } : false
                },
            },
        },
        server: {
            open: true,
            allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok-free.dev']
        },
        plugins: [
            glsl(),
            viteSingleFile()
        ]

    };
})
