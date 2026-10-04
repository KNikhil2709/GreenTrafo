const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const headers = Object.fromEntries(require('../vercel.json').headers[0].headers.map(h=>[h.key,h.value]));
const root = path.resolve('dist');
http.createServer((req,res)=>{
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400).end();return;}
  const file = path.resolve(root, '.'+(pathname==='/'?'/index.html':pathname));
  const exists = file.startsWith(root+path.sep) && fs.existsSync(file) && fs.statSync(file).isFile();
  const content = exists ? fs.readFileSync(file) : fs.readFileSync(path.join(root,'404.html'));
  const type = exists && file.endsWith('.json') ? 'application/json' : exists && file.endsWith('.txt') ? 'text/plain' : 'text/html';
  res.writeHead(exists?200:404,{...headers,'Content-Type':type+'; charset=utf-8'});
  res.end(req.method==='HEAD'?undefined:content);
}).listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log(`Serving production dist on port ${process.env.PORT||3000}`));
