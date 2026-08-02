#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),release='3.60.0';
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail||'');}
function text(name){return fs.readFileSync(path.join(root,name),'utf8');}
const loader=text('loader.js'),bootstrap=text('bootstrap.js'),hard=text('bootstrap-v304.js'),guide=text('jinpo-bot-site-guide.js'),bot=text('jinpo-bot.js'),source=text('jinpo-bot-site-source-data.js');
check('loader asset version',loader.includes("var ASSET_VERSION='"+release+"';"));
check('loader public shared version',loader.includes("version:'"+release+"-local-only'"));
check('loader metrics version',loader.includes("version:'"+release+"'"));
check('normal bootstrap version',bootstrap.includes("var VERSION='"+release+"';"));
check('hard bootstrap version',hard.includes("var VERSION='"+release+"';"));
check('site guide internal version',guide.includes("var VERSION='3.13.0';"));
check('bot internal version',bot.includes("var VERSION='3.26.0';"));
check('site source internal version',source.includes("version:'1.3.0'"));
check('no stale 3.32 shared version',!loader.includes("version:'3.32.0"));
console.log(`RELEASE VERSION CONSISTENCY: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
