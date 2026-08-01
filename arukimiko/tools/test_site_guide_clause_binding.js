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
    siteComparison:Array.isArray(d.siteComparison)?d.siteComparison.slice():[],candidates:Array.isArray(d.candidates)?d.candidates.slice():[],
    siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice():[],selectedSiteItem:String(d.selectedSiteItem||''),
    needsClarification:!!d.needsClarification
  }};
}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:compactMeta(r)});return r;}};}
function guide(r){return !!(r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteGuide);}
function line(r,name){return String(r&&r.answer||'').split(/\n/).find(x=>x.includes('・'+name+'：'))||'';}
(async()=>{
  let r=await session().ask('九十九は何個までで、魔導は保存できる？');
  check('clause binding enabled',guide(r)&&r.data.siteClauseBinding===true,r);
  check('tsukumo only selection count',/8個まで/.test(line(r,'九十九'))&&!/保存/.test(line(r,'九十九')),r&&r.answer);
  check('mado only save',/画像として保存/.test(line(r,'魔導結晶'))&&!/8個まで/.test(line(r,'魔導結晶')),r&&r.answer);

  r=await session().ask('九十九は何個まで、魔導はどこに反映、鬼神石は保存できる？');
  check('triple subjects retained',guide(r)&&r.data.siteClauseBinding&&r.data.siteItems.join(',')==='tsukumo,mado,kishin',r);
  check('triple feature mapping',/8個まで/.test(line(r,'九十九'))&&/首の欄/.test(line(r,'魔導結晶'))&&/画像として保存/.test(line(r,'鬼神石')),r&&r.answer);
  check('triple no cross feature',!/保存/.test(line(r,'九十九'))&&!/8個まで/.test(line(r,'鬼神石')),r&&r.answer);

  r=await session().ask('九十九は何個まで、保存もできる？');
  check('same subject multiple clauses merged',guide(r)&&r.data.siteClauseBinding&&/8個まで/.test(line(r,'九十九'))&&/画像として保存/.test(line(r,'九十九')),r&&r.answer);

  r=await session().ask('九十九は保存できるけど魔導は？');
  check('ellipsis inherits previous feature',guide(r)&&r.data.siteClauseBinding&&/画像として保存/.test(line(r,'九十九'))&&/画像として保存/.test(line(r,'魔導結晶')),r&&r.answer);

  r=await session().ask('鬼神石は8個、九十九は？');
  check('numeric feature inheritance',guide(r)&&r.data.siteClauseBinding&&/8個まで/.test(line(r,'鬼神石'))&&/8個まで/.test(line(r,'九十九')),r&&r.answer);

  r=await session().ask('能力計算に九十九と魔導を入れたい、家臣計算は九十九だけ？');
  check('two calculators in one sentence',guide(r)&&r.data.siteClauseBinding&&/右手または左手/.test(line(r,'能力計算'))&&/首の欄/.test(line(r,'能力計算'))&&/付与選択/.test(line(r,'家臣計算機')),r&&r.answer);

  r=await session().ask('家臣計算は九十九だけ？');
  check('only question explains other supported input',guide(r)&&/付与選択/.test(r.answer||''),r&&r.answer);

  r=await session().ask('鬼神石じゃなくて九十九の保存、あと魔導の反映先');
  check('correction removes denied target',r&&r.mode==='サイト総合案内'&&!/鬼神石/.test(r.answer||'')&&/九十九/.test(r.answer||'')&&/魔導結晶/.test(r.answer||''),r&&r.answer);

  r=await session().ask('鬼神石は何個まで？九十九は保存できる？魔導は並べ替えられる？');
  check('strong punctuation compound remains exact',r&&r.data&&r.data.compound&&/鬼神石/.test(r.answer||'')&&/九十九/.test(r.answer||'')&&/魔導結晶/.test(r.answer||''),r);

  r=await session().ask('九十九は第1、第2、第3優先で並べ替えできる？');
  check('priority commas not false split',guide(r)&&!r.data.siteClauseBinding&&/第1・第2・第3優先/.test(r.answer||''),r);

  r=await session().ask('九十九、魔導、鬼神石は何個まで？');
  check('plain item list keeps shared question',guide(r)&&Array.isArray(r.data.siteItems)&&r.data.siteItems.length===3&&((r.answer||'').match(/8個まで/g)||[]).length===3,r);

  let s=session();r=await s.ask('九十九は何個まで、魔導は保存できる？');
  r=await s.ask('前者は保存もできる？');
  check('former candidate feature only',guide(r)&&r.data.siteItem==='tsukumo'&&r.data.selectedSiteItem==='tsukumo'&&!/魔導結晶/.test(r.answer||''),r);
  r=await s.ask('後者は何個まで？');
  check('latter candidate remains available',guide(r)&&r.data.siteItem==='mado'&&r.data.selectedSiteItem==='mado'&&/8個まで/.test(r.answer||''),r);
  r=await s.ask('それは並べ替えもできる？');
  check('deictic follows selected candidate',guide(r)&&r.data.siteItem==='mado'&&/第1・第2・第3優先/.test(r.answer||''),r);
  r=await s.ask('前者は？');
  check('former can still be selected later',guide(r)&&r.data.siteItem==='tsukumo',r);

  s=session();await s.ask('九十九は何個まで、魔導は保存できる？');
  r=await s.ask('九十九の方は保存も？');
  check('named candidate feature only',guide(r)&&r.data.siteItem==='tsukumo'&&!/魔導結晶/.test(r.answer||''),r);

  s=session();await s.ask('九十九は何個まで、魔導は保存できる？');
  r=await s.ask('前者じゃなくて後者の保存');
  check('candidate correction uses correction tail',guide(r)&&r.data.siteItem==='mado'&&!/九十九/.test(r.answer||''),r);

  s=session();await s.ask('九十九は何個まで、魔導は保存できる？');
  r=await s.ask('前者は保存、後者は何個まで？');
  check('candidate clauses bind separately',guide(r)&&r.data.siteClauseBinding&&/保存/.test(line(r,'九十九'))&&/8個まで/.test(line(r,'魔導結晶')),r);

  s=session();await s.ask('九十九は何個まで、魔導は保存できる？');
  r=await s.ask('前者は保存できるけど後者は？');
  check('candidate ellipsis inherits feature',guide(r)&&r.data.siteClauseBinding&&((r.answer||'').match(/画像として保存/g)||[]).length===2,r);

  s=session();await s.ask('九十九は何個まで、魔導は保存できる？');
  r=await s.ask('両方開いて');
  check('all candidate links preserved',guide(r)&&Array.isArray(r.links)&&r.links.length===2,r);

  r=await session().ask('魔導結晶のページじゃなくて入手方法知りたい');
  check('tool fact correction boundary preserved',r&&r.mode==='たいらの野望ツール実データ'&&/番号または名称/.test(r.answer||''),r);
  r=await session().ask('鬼神石1番の入手は？');
  check('exact tool fact boundary preserved',r&&r.mode==='たいらの野望ツール実データ',r);
  r=await session().ask('足利義昭のカウンター見たい');
  check('counter authority preserved',r&&r.mode==='たいらの野望専用知識'&&/157/.test(r.answer||''),r);

  console.log(`SITE GUIDE CLAUSE BINDING: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
