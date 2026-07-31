#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};
global.addEventListener=()=>{};
global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};
global.fetch=async()=>({ok:false,status:503,text:async()=>''});
global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
[
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js',
  'jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function compactMeta(r){
  const d=r&&r.data||{};
  return {links:r&&r.links||[],mode:r&&r.mode||'',data:{
    siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),
    siteFeatures:Array.isArray(d.siteFeatures)?d.siteFeatures.slice():[],siteItems:Array.isArray(d.siteItems)?d.siteItems.slice():[],
    siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice():[],
    candidates:Array.isArray(d.candidates)?d.candidates.slice():[],siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice():[],
    needsClarification:!!d.needsClarification
  }};
}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:compactMeta(r)});return r;}};}
function guide(r){return !!(r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteGuide);}
function hasItems(r,ids){const got=(r&&r.data&&r.data.siteItems||[]).slice().sort();return ids.slice().sort().every(x=>got.includes(x));}
(async()=>{
  let s=session(),r=await s.ask('鬼神石と九十九って何が違う？');
  check('difference routes to guide',guide(r)&&Array.isArray(r.data.siteComparison)&&r.data.siteComparison.includes('kishin')&&r.data.siteComparison.includes('tsukumo'),r);
  check('difference has shared points',/最大8個/.test(r.answer||'')&&/第1〜第3優先/.test(r.answer||'')&&/画像保存/.test(r.answer||''),r&&r.answer);
  check('difference has actual distinction',/合成最低発現数/.test(r.answer||'')&&/右手・左手/.test(r.answer||'')&&/家臣計算機/.test(r.answer||''),r&&r.answer);

  r=await s.ask('どっちも8個？');
  check('comparison followup selection count',guide(r)&&hasItems(r,['kishin','tsukumo'])&&((r.answer||'').match(/8個まで/g)||[]).length===2,r);
  r=await s.ask('能力計算に入れられる方');
  check('comparison followup reflect contrast',guide(r)&&/鬼神石.*直接反映/.test(r.answer||'')&&/九十九.*能力計算機/.test(r.answer||''),r);
  r=await s.ask('両方開いて');
  check('open all compared pages',guide(r)&&Array.isArray(r.links)&&r.links.length===2&&/まとめて開ける/.test(r.answer||''),r);

  s=session();r=await s.ask('九十九と魔導って保存できる？');
  check('multi item feature base',guide(r)&&hasItems(r,['tsukumo','mado'])&&((r.answer||'').match(/画像として保存/g)||[]).length===2,r);
  r=await s.ask('じゃあ並べ替えは？');
  check('multi item new feature followup',guide(r)&&hasItems(r,['tsukumo','mado'])&&((r.answer||'').match(/第1・第2・第3優先/g)||[]).length===2,r);
  r=await s.ask('どっちも開いて');
  check('multi item links retained',guide(r)&&r.links&&r.links.length===2,r);

  r=await session().ask('能力計算したいんだけど九十九と魔導と鎮魂符はどこに入る？');
  check('three component reflect answered',guide(r)&&r.data.siteItem==='stats'&&/右手または左手/.test(r.answer||'')&&/首の欄/.test(r.answer||'')&&/鎮魂符の解放ステータス/.test(r.answer||''),r);
  check('three component no false automatic sharing',((r.answer||'').match(/自動共有/g)||[]).length>=2,r&&r.answer);

  r=await session().ask('能力計算に鬼神石も入れれる？');
  check('stats rejects kishin direct reflect',guide(r)&&r.data.siteItem==='stats'&&/直接選択・反映する欄は確認できません/.test(r.answer||''),r);
  r=await session().ask('鬼神石って能力計算に入れれる？');
  check('kishin subject rejects direct reflect',guide(r)&&r.data.siteItem==='kishin'&&/直接反映する選択欄は確認できません/.test(r.answer||''),r);
  r=await session().ask('家臣計算に魔導結晶も入れれる？');
  check('retainer rejects mado',guide(r)&&r.data.siteItem==='retainer'&&/魔導結晶を直接選択・反映する欄は確認できません/.test(r.answer||'')&&/能力計算機の首/.test(r.answer||''),r);
  r=await session().ask('家臣計算に鎮魂符も反映できる？');
  check('retainer rejects chinkon',guide(r)&&r.data.siteItem==='retainer'&&/鎮魂符を直接選択・反映する欄は確認できません/.test(r.answer||''),r);
  r=await session().ask('家臣計算に鬼神石は？');
  check('retainer rejects kishin',guide(r)&&r.data.siteItem==='retainer'&&/鬼神石を直接選択・反映する欄は確認できません/.test(r.answer||''),r);

  s=session();r=await s.ask('九十九と魔導は何が違うの');
  check('tsukumo mado comparison',guide(r)&&/右手・左手/.test(r.answer||'')&&/首の欄/.test(r.answer||'')&&/家臣計算機へ直接反映する欄は確認できません/.test(r.answer||''),r);
  r=await s.ask('家臣に入れれる方は？');
  check('comparison followup retainer target',guide(r)&&/九十九.*家臣計算機/.test(r.answer||'')&&/魔導結晶.*家臣計算機へ直接反映する欄は確認できません/.test(r.answer||''),r);

  r=await session().ask('魔導結晶のページじゃなくて入手方法知りたい');
  check('correction still goes tool data',r&&r.mode==='たいらの野望ツール実データ'&&/番号または名称/.test(r.answer||''),r);
  r=await session().ask('鬼神石1番の入手は？');
  check('exact item fact still tool data',r&&r.mode==='たいらの野望ツール実データ',r);
  r=await session().ask('足利義昭のカウンター見たい');
  check('counter authority preserved',r&&r.mode==='たいらの野望専用知識'&&/157/.test(r.answer||''),r);

  console.log(`SITE GUIDE COMPARISON CONTEXT: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
