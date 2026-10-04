// Exercise the real release script with stubbed external commands; never deploy.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'greentrafo-gate-'));
const stub=`#!/usr/bin/env bash
set -eu
name="$(basename "$0")"
echo "$name $*" >> "$TEST_LOG"
case "$name" in
 gh)
  count=0
  if [ -f "$TEST_COUNT" ]; then count="$(cat "$TEST_COUNT")"; fi
  count=$((count + 1)); echo "$count" > "$TEST_COUNT"
  if [ "$TEST_CASE" = stale ] || { [ "$TEST_CASE" = stale-after ] && [ "$count" -gt 1 ]; }; then echo newer; else echo tested; fi ;;
 vercel)
  if [ "$1" = deploy ]; then
   if [ "$TEST_CASE" = build-fail ]; then exit 1; fi
   if [ "$TEST_CASE" = bad-url ]; then echo https://untrusted.example; else echo https://greentrafo-test.vercel.app; fi
  fi ;;
 node)
  if [ "$1" = tests/deployment.cjs ] && [ "$TEST_CASE" = smoke-fail ]; then exit 1; fi ;;
esac
`;
try {
 for(const name of ['gh','vercel','node'])fs.writeFileSync(path.join(root,name),stub,{mode:0o755});
 for(const scenario of ['ok','stale','stale-after','build-fail','smoke-fail','bad-url']){
  const log=path.join(root,scenario+'.log');
  const result=spawnSync('bash',['scripts/deploy-vercel.sh'],{encoding:'utf8',env:{...process.env,
   PATH:root+path.delimiter+process.env.PATH,TEST_LOG:log,TEST_COUNT:log+'.count',TEST_CASE:scenario,
   VERCEL_ORG_ID:'test',VERCEL_PROJECT_ID:'test',VERCEL_TOKEN:'test',GITHUB_SHA:'tested',GITHUB_REPOSITORY:'example/test',GITHUB_STEP_SUMMARY:''}});
  const calls=fs.readFileSync(log,'utf8');
  assert.equal(calls.includes('vercel promote'),scenario==='ok',scenario+' must not promote failed/stale releases');
  if(scenario==='ok'){
   assert.ok(calls.indexOf('tests/deployment.cjs')<calls.indexOf('vercel promote'));
   assert.match(calls,/deploy --prebuilt --prod --skip-domain/);
   assert.equal(result.status,0);
  }else if(scenario.startsWith('stale'))assert.equal(result.status,0);
  else assert.notEqual(result.status,0);
 }
 console.log('PASS release gate: successful staging tested before promotion; build/smoke failures, invalid URLs and stale commits never promote.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
