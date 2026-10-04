const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createHash}=require('node:crypto');
const html=fs.readFileSync('dist/index.html','utf8');
assert.equal(html,fs.readFileSync('dist/greentrafo.html','utf8'));
assert.doesNotMatch(html,/<script[^>]+src=|type="text\/babel"|https:\/\/fonts\.|cdnjs\.cloudflare/);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,2);
for(const script of scripts){
 new vm.Script(script);
 assert.ok(html.includes(`'sha256-${createHash('sha256').update(script).digest('base64')}'`),'CSP permits exact shipped script');
}
const legacy=fs.readFileSync('index.html','utf8').match(/<script>\n([\s\S]*?)\n<\/script>/)[1];
assert.equal(scripts[0],legacy,'deployed engine is byte-identical to the regression-tested engine');
assert.deepEqual(fs.readdirSync('dist').sort(),['404.html','FONT-LICENSE.txt','greentrafo.html','health.json','index.html']);
const health=JSON.parse(fs.readFileSync('dist/health.json'));
assert.equal(health.buildId,createHash('sha256').update(html).digest('base64'));
assert.equal(health.status,'ok');
require('node:child_process').execFileSync(process.execPath,['scripts/package-vercel.cjs']);
for(const file of fs.readdirSync('dist'))assert.deepEqual(fs.readFileSync(`dist/${file}`),fs.readFileSync(`.vercel/output/static/${file}`),'Vercel packages exact tested bytes');
const output=JSON.parse(fs.readFileSync('.vercel/output/config.json'));
assert.equal(output.version,3);
assert.equal(output.routes[0].headers['X-Frame-Options'],'DENY');
console.log('PASS production: allowlisted artifact, identical engine/HTML, compiled UI, embedded fonts, no runtime CDN, CSP hashes, content-derived health identity.');
