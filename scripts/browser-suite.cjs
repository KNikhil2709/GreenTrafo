const {spawn} = require('node:child_process');
const {mkdtempSync,rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const {chromium} = require('playwright');
const {setTimeout:delay} = require('node:timers/promises');
async function run(file,env) {
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[file],{stdio:'inherit',env});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${file}: exit ${code}`)));
  });
}
(async()=>{
  const port=process.env.CDP_PORT||'9333',profile=mkdtempSync(join(tmpdir(),'greentrafo-ci-'));
  let chrome, chromeExit;
  try {
    const cdp=process.env.CDP_URL||`http://127.0.0.1:${port}`;
    if(!process.env.CDP_URL) {
      chrome=spawn(process.env.CHROME_PATH||chromium.executablePath(),[
        '--headless=new','--no-sandbox',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,
        '--no-first-run','--no-default-browser-check','about:blank'],{stdio:['ignore','ignore','inherit']});
      chromeExit=new Promise(resolve=>{chrome.once('exit',resolve);chrome.once('error',resolve);});
      chrome.on('error',error=>console.error(error));
      let ready=false;
      for(let i=0;i<100;i++){try{ready=(await fetch(cdp+'/json/version')).ok;}catch{}if(ready)break;await delay(100);}
      if(!ready)throw new Error('Chrome CDP did not become ready');
    }
    const env={...process.env,CDP_URL:cdp};
    for(const name of ['budget','warm-start','plan-protect','overnight','full']) await run(`tests/browser-${name}.cjs`,env);
  } finally {
    if(chrome){chrome.kill('SIGTERM');await chromeExit;}
    rmSync(profile,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
