// Build-time flag: `true` in `npm run dev`, replaced with the literal `false`
// in the production build (vite `define`), so `if (__DEV__) { … }` blocks and
// `__DEV__ && …` guards fold away and their code tree-shakes out of the zip.
declare const __DEV__: boolean;
