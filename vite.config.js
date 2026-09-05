import { mkdirSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import { viteSingleFile } from "vite-plugin-singlefile";

// Dev-only: the XR hand recorder page (tests/tools/xr-hand-recorder.html) POSTs
// its capture here so it lands on the machine running `npm run dev` — no cable,
// no file transfer off the headset. Saves to tests/fixtures/whack-<ts>.json.
const recordSink = {
    name: 'record-sink',
    apply: 'serve',
    configureServer(server) {
        server.middlewares.use('/__record', (req, res) => {
            if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
            const name = (new URL(req.url, 'http://x').searchParams.get('to') || 'whack').replace(/[^a-z0-9-]/gi, '') || 'whack';
            const chunks = [];
            req.on('data', (c) => chunks.push(c));
            req.on('end', () => {
                const buf = Buffer.concat(chunks);
                mkdirSync('tests/fixtures', { recursive: true });
                const file = `tests/fixtures/${name}-${Date.now()}.json`;
                writeFileSync(file, buf);
                console.log(`\n[record-sink] saved ${file} (${buf.length} bytes)\n`);
                res.setHeader('content-type', 'text/plain');
                res.end(file);
            });
        });
    },
};

export default defineConfig(({ mode }) => {
    const isProd = mode === 'production';

    return {
        base: "./",
        clearScreen: false,
        define: { __DEV__: JSON.stringify(!isProd) }, // dev-only code folds to `if(false)` in prod -> tree-shaken

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
            !isProd && recordSink,
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
