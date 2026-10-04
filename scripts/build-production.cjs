const fs = require('node:fs');
const {createHash} = require('node:crypto');
const esbuild = require('esbuild');
const hash = value => createHash('sha256').update(value).digest('base64');
(async () => {
  const legacy = fs.readFileSync('index.html', 'utf8');
  const engine = legacy.match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
  const result = await esbuild.build({
    stdin: {contents: 'import React from "react"; import * as ReactDOM from "react-dom/client";\n' + fs.readFileSync('src/app.jsx', 'utf8'), resolveDir: process.cwd(), loader: 'jsx'},
    bundle: true, write: false, format: 'iife', minify: true, target: ['es2020'],
    define: {'process.env.NODE_ENV': '"production"'}, legalComments: 'inline',
  });
  const ui = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  let head = fs.readFileSync('src/head.html', 'utf8')
    .replace(/<link[^>]*https:\/\/fonts\.[^>]*>\n/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>\n?/g, '');
  const fonts = [400,500,600,700].map(weight => {
    const data = fs.readFileSync(`node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`).toString('base64');
    return `@font-face{font-family:Inter;font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format('woff2')}`;
  }).join('\n');
  const csp = `default-src 'none'; script-src 'sha256-${hash(engine)}' 'sha256-${hash(ui)}'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'`;
  head = head.replace('<title>', `<meta http-equiv="Content-Security-Policy" content="${csp}">\n<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='8' fill='%233DCD58'/%3E%3Ctext x='9' y='29' font-size='28'%3EG%3C/text%3E%3C/svg%3E">\n<style>${fonts}</style>\n<title>`);
  const html = head + `<script>${engine}</script>\n<script>${ui}</script>\n</body></html>`;
  fs.mkdirSync('dist', {recursive:true});
  // An allowlisted, self-contained artifact: no source, secrets or test files.
  for (const name of fs.readdirSync('dist')) fs.rmSync(`dist/${name}`, {recursive:true, force:true});
  for (const name of ['index.html','greentrafo.html']) fs.writeFileSync(`dist/${name}`, html);
  const revision = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'local';
  fs.writeFileSync('dist/health.json', JSON.stringify({status:'ok', revision, buildId:hash(html)}, null, 2)+'\n');
  fs.writeFileSync('dist/404.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>Not found · GreenTrafo</title><h1>Page not found</h1><p><a href="/">Return to GreenTrafo</a></p></html>');
  fs.copyFileSync('node_modules/@fontsource/inter/LICENSE','dist/FONT-LICENSE.txt');
  console.log(`Production: self-contained HTML, ${Buffer.byteLength(html)} bytes; no runtime CDN or Babel.`);
})().catch(error => {console.error(error);process.exitCode=1;});
