// Fork-time packing pass for the smallest possible bundle. Run this on a game
// fork right before submission — it never touches src/, only dist/index.html
// from a normal `npm run build`. Source keeps its real `#private` fields; only
// the packed artifact loses them.
//
// Why: roadroller (below) can't parse ES2022 `#private` class fields, and
// down-leveling the whole build to es2017 to work around that costs more than
// roadroller saves (the WeakMap emulation for `#x` bloats the bundle ~27%; see
// .doc/DECISIONS.md D3). Instead, a tiny Babel AST pass strips the `#` sigil
// from the ALREADY-MINIFIED build output — declarations and `this.#x` alike —
// turning every private into a plain property. Doing this on the built output
// (not TS source) means rolldown's mangler has already shortened most private
// names to 1-2 chars, so the rewrite costs next to nothing (`#` and `_` are
// both 1 byte). A per-class unique suffix keeps two classes' same-named mangled
// privates from aliasing the same property if one extends the other.
//
// Then: rewrite the bundle's one `import ... from "three"` to a dynamic
// `await import("three")` inside an async IIFE (three is externalised via the
// importmap; roadroller can't parse a static `import`, but dynamic `import()`
// still resolves through the importmap and works in a classic <script>).
// Finally roadroller packs the result into a self-extracting blob.
//
//   npm run build && node scripts/pack.mjs && node scripts/zip.mjs
//
// PACK_O env picks the roadroller search level (0 | 1 | 2, default 1).
// 1 ≈ 3s; 2 is a much longer search for a few more bytes — use it for a release.
import { readFileSync, writeFileSync } from 'node:fs';
import { transformSync } from '@babel/core';
import { minify } from 'terser';
import { Packer } from 'roadroller';

const FILE = 'dist/index.html';
const LEVEL = Number(process.env.PACK_O ?? 1);

// Strip every `#private` to a plain `_name` property. Each class gets its own
// id so classes in an inheritance chain never end up sharing a renamed field.
function stripPrivateFields({ types: t }) {
  let nextId = 0;
  const idOf = new WeakMap();
  const classIdFor = (cls) => { if (!idOf.has(cls)) idOf.set(cls, nextId++); return idOf.get(cls); };
  const enclosingClass = (path) => path.findParent((p) => p.isClassDeclaration() || p.isClassExpression())?.node ?? null;
  return {
    visitor: {
      PrivateName(path) {
        const cls = enclosingClass(path);
        const suffix = cls ? `$${classIdFor(cls)}` : '';
        path.replaceWith(t.identifier(`_${path.node.id.name}${suffix}`));
      },
      ClassPrivateProperty(path) { path.node.type = 'ClassProperty'; },
      ClassPrivateMethod(path) { path.node.type = 'ClassMethod'; },
    },
  };
}

const html = readFileSync(FILE, 'utf8');
const tag = html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
if (!tag) throw new Error('pack: no <script type="module"> in dist/index.html — run `npm run build` first');

const stripped = transformSync(tag[1], {
  compact: true, babelrc: false, configFile: false, sourceType: 'module',
  plugins: [stripPrivateFields],
}).code;

// Second minify pass. The point is `mangle.properties` — rolldown won't rename
// object properties (it can't prove that's safe), but every former #private is
// now `_name$N`, and nothing else in the bundle uses a leading underscore
// (checked: no `._foo` accesses survive from three/addons), so `/^_/` renames
// exactly our own members and nothing three.js or the DOM can see. Costs ~0
// risk, saves ~185 B zipped. `unsafe` compress options were measured at only
// 45 B more and are not worth it.
const minified = (await minify(stripped, {
  module: true,
  compress: { passes: 3 },
  mangle: { toplevel: true, properties: { regex: /^_/ } },
  format: { comments: false },
})).code;

const imp = minified.match(/import\s*\{([^}]*)\}\s*from\s*"three";?/);
if (!imp) throw new Error('pack: expected a single `import{...}from"three"` — bundle shape changed');
const bindings = imp[1].replace(/ as /g, ':'); // `A as e,B as t` -> destructure `{A:e,B:t}`
const source = `(async()=>{const{${bindings}}=await import("three");\n${minified.replace(imp[0], '')}\n})()`;

const packer = new Packer([{ data: source, type: 'js', action: 'eval' }], {});
await packer.optimize(LEVEL);
const { firstLine, secondLine } = packer.makeDecoder();
const packed = `${firstLine}\n${secondLine}`;

writeFileSync(FILE, html.replace(tag[0], `<script>${packed}</script>`));

const pct = (100 * (1 - packed.length / tag[1].length)).toFixed(1);
console.log(`pack: script ${tag[1].length} B -> ${packed.length} B  (-${pct}%, roadroller -O${LEVEL})`);
