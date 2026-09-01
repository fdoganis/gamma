import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
    const isProd = mode === 'production';

    return {
        base: "./",
        clearScreen: false,
        define: { __DEV__: JSON.stringify(!isProd) }, // dev-only code folds to `if(false)` in prod → tree-shaken

        resolve: {
            alias: {
                'three/addons': 'three/examples/jsm'
            }
        },
        build: {
            target: 'es2022',
            sourcemap: !isProd,
            chunkSizeWarningLimit: 1024,
            modulePreload: { polyfill: false },
            rolldownOptions: {
                external: isProd ? ['three'] : [],
                output: {
                    format: 'es',
                    minify: isProd ? {
                        compress: {
                            dropConsole: true,
                            dropDebugger: true
                        },
                        mangle: true
                    } : false
                }
            }
        },
        server: {
            open: true,
            allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok-free.dev']
        },
        plugins: [
            glsl(),
            viteSingleFile(),
            isProd && {
                name: 'runtime-cdn-selector',
                transformIndexHtml(html) {
                    const script = `
                    <script>
                        (function() {
                            const isJs13k = window.location.hostname.includes('js13kgames.com');
                            const threeUrl = isJs13k 
                                ? 'https://play.js13kgames.com/2026/webxr/three.js' 
                                : 'https://cdn.jsdelivr.net/npm/three@0.185.0/+esm';
                            
                            const map = { imports: { 'three': threeUrl } };
                            const scriptTag = document.createElement('script');
                            scriptTag.type = 'importmap';
                            scriptTag.textContent = JSON.stringify(map);
                            document.head.appendChild(scriptTag);
                        })();
                    </script>`;
                    return html.replace('<head>', '<head>' + script);
                }
            }
        ].filter(Boolean)
    };
});
