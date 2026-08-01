#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),release='3.36.0';
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail||'');}
function text(name){return fs.readFileSync(path.join(root,name),'utf8');}
const loader=text('loader.js'),bootstrap=text('bootstrap.js'),hard=text('bootstrap-v304.js'),guide=text('jinpo-bot-site-guide.js');
check('loader asset version',loader.includes("var ASSET_VERSION='"+release+"';"));
check('loader public shared version',loader.includes("version:'"+release+"-local-only'"));
check('loader metrics version',loader.includes("version:'"+release+"'"));
check('normal bootstrap version',bootstrap.includes("var VERSION='"+release+"';"));
check('hard bootstrap version',hard.includes("var VERSION='"+release+"';"));
check('site guide internal version',guide.includes("var VERSION='3.9.0';"));
check('no stale 3.32 shared version',!loader.includes("version:'3.32.0"));
console.log(`RELEASE VERSION CONSISTENCY: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
