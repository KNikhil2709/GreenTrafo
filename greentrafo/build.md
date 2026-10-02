# Build

`index.html` (same as `greentrafo.html`) is assembled from `src/` by concatenation — no
bundler, because the page uses in-browser Babel (`type="text/babel"`).

Order: `head.html`, then `<script>` + combined engine + `</script>`, then
`<script type="text/babel" data-presets="react">` + `app.jsx` + `</script>`, then
`</body></html>`.

Combine the engine first: strip `import`/`export` from `engine.js` and `optimize.js`,
concatenate (engine first), and rename `optimize.js`'s local `rng` helper to `rng2` so it
does not clash with the one in `engine.js`.

```js
const fs = require("fs");
let eng = fs.readFileSync("src/engine.js","utf8")
  .replace(/^export\s+/gm,"").replace(/export\s*\{[^}]*\};?/g,"")
  .replace(/^\{ DAY_STEPS[\s\S]*?\};\s*$/m,"");
let opt = fs.readFileSync("src/optimize.js","utf8")
  .replace(/^import[\s\S]*?from\s+["'][^"']+["'];/gm,"")
  .replace(/^export\s+/gm,"").replace(/export\s*\{[^}]*\};?/g,"")
  .replace(/function rng\(/,"function rng2(")
  .replace(/rng\((seed \* 2246822519)\)/,"rng2($1)");
const html = fs.readFileSync("src/head.html","utf8")
  + "\n<script>\n"+eng+"\n"+opt+"\n</script>\n"
  + '<script type="text/babel" data-presets="react">\n'
  + fs.readFileSync("src/app.jsx","utf8") + "\n</script>\n</body></html>";
fs.writeFileSync("index.html", html);
fs.writeFileSync("greentrafo.html", html);
```

## Toward the real backend
Move `engine.js` to Python (pandapower power flow, NumPy IEEE C57.91), replace the JS
optimisers with pymoo (Plan) and cvxpy (Protect), expose via FastAPI, and point the React
UI at the API instead of the inlined engine.
