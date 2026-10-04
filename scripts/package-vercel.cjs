// Package the already-tested artifact. Never rebuild between verification and promotion.
const fs = require('node:fs');
const headers = Object.fromEntries(require('../vercel.json').headers[0].headers.map(h=>[h.key,h.value]));
fs.rmSync('.vercel/output', {recursive:true,force:true});
fs.mkdirSync('.vercel/output', {recursive:true});
fs.cpSync('dist','.vercel/output/static',{recursive:true});
fs.writeFileSync('.vercel/output/config.json', JSON.stringify({version:3,routes:[
  {src:'/(.*)',headers,continue:true},
  {src:'/',dest:'/index.html'},
  {handle:'filesystem'},
  {src:'/(.*)',status:404,dest:'/404.html'},
]},null,2)+'\n');
console.log('Packaged tested dist/ as Vercel Build Output API v3.');
