const fs = require('fs');
let eng = fs.readFileSync('src/engine.js', 'utf8')
    .replace(/^export\s*\{[^}]*\};?/gm, '').replace(/^export\s+/gm, '');
let opt = fs.readFileSync('src/optimize.js', 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];/gm, '')
    .replace(/^export\s*\{[^}]*\};?/gm, '').replace(/^export\s+/gm, '')
    .replace(/function rng\(/, 'function rng2(')
    .replace(/rng\((seed \* 2246822519)\)/, 'rng2($1)');
const html = fs.readFileSync('src/head.html', 'utf8')
    + '\n<script>\n' + eng + '\n' + opt + '\n</script>\n'
    + '<script type="text/babel" data-presets="react">\n'
    + fs.readFileSync('src/app.jsx', 'utf8') + '\n</script>\n</body></html>';
fs.writeFileSync('index.html', html);
fs.writeFileSync('greentrafo.html', html);
console.log('OK size:', html.length);
