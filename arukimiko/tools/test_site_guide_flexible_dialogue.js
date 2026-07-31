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
    siteFeatures:Array.isArray(d.siteFeatures)?d.siteFeatures.slice():[],
    candidates:Array.isArray(d.candidates)?d.candidates.slice():[],siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice():[],
    needsClarification:!!d.needsClarification
  }};
}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:compactMeta(r)});return r;}};}
function guide(r,id){return !!(r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteGuide&&(!id||r.data.siteItem===id));}
function features(r){return r&&r.data&&Array.isArray(r.data.siteFeatures)?r.data.siteFeatures:[];}
(async()=>{
  let r=await session().ask('九十九って何個選べて能力計算にも反映できるん？');
  check('same subject multiple features',guide(r,'tsukumo')&&features(r).includes('selection_count')&&features(r).includes('reflect')&&/8個/.test(r.answer||'')&&/能力計算機/.test(r.answer||''),r);

  r=await session().ask('鬼神石は並べ替えと保存どっちもできる？');
  check('sort and save together',guide(r,'kishin')&&features(r).includes('sort')&&features(r).includes('save')&&/第1・第2・第3/.test(r.answer||'')&&/画像として保存/.test(r.answer||''),r);

  r=await session().ask('徒党登録って何人まででURL送れる？');
  check('entry and share together',guide(r,'party')&&features(r).includes('entry')&&features(r).includes('share')&&/最大10人/.test(r.answer||'')&&/URLコピー/.test(r.answer||''),r);

  r=await session().ask('英傑一覧で因子と職業とコスト全部見れる？');
  check('rough columns question',guide(r,'heroes')&&r.data.siteFeature==='columns'&&/因子1〜4/.test(r.answer||'')&&/コスト/.test(r.answer||''),r);

  r=await session().ask('陣法で何因縁までいけて結果保存できるん？');
  check('jinpo range and save',guide(r,'jinpo')&&features(r).includes('categories')&&features(r).includes('save')&&/5〜9因縁/.test(r.answer||'')&&/共有URL/.test(r.answer||''),r);

  r=await session().ask('ルーレット音消して履歴から戻すこともできる？');
  check('roulette settings and history',guide(r,'roulette')&&features(r).includes('categories')&&features(r).includes('history')&&/音と紙吹雪/.test(r.answer||'')&&/全員戻す/.test(r.answer||''),r);

  r=await session().ask('トーナメントは団体のダブルできて日程も入れれる？');
  check('tournament type and schedule',guide(r,'tournament')&&features(r).includes('types')&&features(r).includes('schedule')&&/ダブル団体/.test(r.answer||'')&&/開始時刻/.test(r.answer||''),r);

  let s=session();r=await s.ask('九十九のページ開いて');
  check('open tsukumo',guide(r,'tsukumo'),r);
  r=await s.ask('何個までで何に反映できる？');
  check('deictic multiple feature followup',guide(r,'tsukumo')&&features(r).includes('selection_count')&&features(r).includes('reflect'),r);
  r=await s.ask('保存も？');
  check('short feature followup',guide(r,'tsukumo')&&r.data.siteFeature==='save',r);

  s=session();r=await s.ask('計算したい');
  check('calculator candidates',r&&r.data&&r.data.needsClarification&&r.data.candidates.length===4,r);
  r=await s.ask('自分のやつ');
  check('rough candidate self means stats',guide(r,'stats'),r);
  r=await s.ask('九十九も入れれる？');
  check('calculator context beats component page',guide(r,'stats')&&r.data.siteFeature==='reflect'&&/右手または左手/.test(r.answer||''),r);

  s=session();await s.ask('カウンター見たい');await s.ask('天下統一');r=await s.ask('京都');
  check('hierarchy one-word child',guide(r,'kyouto'),r);
  r=await s.ask('戻るとどこ？');
  check('child back destination',guide(r,'kyouto')&&r.data.siteFeature==='back'&&/天下統一奇譚メニュー/.test(r.answer||''),r);

  s=session();r=await s.ask('家臣計算じゃなくて能力計算');
  check('correction without previous history',guide(r,'stats'),r);
  r=await s.ask('それで鎮魂符も反映したい');
  check('correction target remains subject',guide(r,'stats')&&r.data.siteFeature==='reflect'&&/鎮魂符の解放ステータス/.test(r.answer||''),r);

  r=await session().ask('家臣計算で九十九いれれる？あと保存できる？');
  check('compound same subject keeps context',r&&r.mode==='サイト総合案内'&&!/絞り切れなかった/.test(r.answer||'')&&/九十九選択/.test(r.answer||'')&&/画像として保存/.test(r.answer||''),r);

  r=await session().ask('御蔵番から名物いける？戻るとどこ？');
  check('compound relation keeps destination',r&&r.mode==='サイト総合案内'&&!/絞り切れなかった|目的をもう少し/.test(r.answer||'')&&/御蔵番ページの「名物」/.test(r.answer||'')&&/御蔵番ページへ戻/.test(r.answer||''),r);

  r=await session().ask('鬼神石何個まで？あと九十九は？魔導も同じ？');
  check('same feature across three tools',r&&r.mode==='サイト総合案内'&&((r.answer||'').match(/8個まで/g)||[]).length===3&&r.links&&r.links.length===3,r);

  r=await session().ask('魔導結晶のページじゃなくて入手方法知りたい');
  check('fact correction is not hijacked',r&&r.mode==='たいらの野望ツール実データ'&&/番号または名称/.test(r.answer||''),r);

  r=await session().ask('足利義昭のカウンター見たい');
  check('named counter still authoritative',r&&r.mode==='たいらの野望専用知識'&&/157/.test(r.answer||''),r);

  console.log(`SITE GUIDE FLEXIBLE DIALOGUE: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
