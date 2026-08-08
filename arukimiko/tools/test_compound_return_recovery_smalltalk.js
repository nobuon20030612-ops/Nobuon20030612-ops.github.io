#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};
global.sessionStorage=global.localStorage;global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};
global.addEventListener=()=>{};global.location={href:'https://example.test/index.html',pathname:'/index.html',origin:'https://example.test'};global.fetch=async()=>({ok:false,status:503,text:async()=>''});global.JINPO_BOT_PAGE_MODE='top';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
['jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js','jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js','jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail||'');}
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteOpenedItems:d.siteOpenedItems||[],siteExcludedItems:d.siteExcludedItems||[],selectedSiteItem:d.selectedSiteItem||'',needsClarification:!!d.needsClarification,siteGuideContextCleared:!!d.siteGuideContextCleared,siteLinkMissNeedsSelection:!!d.siteLinkMissNeedsSelection,siteLinkMissRejectedItem:d.siteLinkMissRejectedItem||'',siteLinkMissRecoveryContinuation:!!d.siteLinkMissRecoveryContinuation,siteGuideConversationReturn:!!d.siteGuideConversationReturn,siteGuideReturnFromPause:!!d.siteGuideReturnFromPause,siteGuidePauseTurns:Number(d.siteGuidePauseTurns||0),siteGuideReturnWithGoal:!!d.siteGuideReturnWithGoal,siteGuideReturnTarget:d.siteGuideReturnTarget||'',stoneName:d.stoneName||'',stoneId:d.stoneId||0}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}
function ids(value){return Array.isArray(value)?value.join(','):'';}

(async()=>{
  let s=session(),r;
  await s.ask('文曲の輝光');await s.ask('今日は暑いね');r=await s.ask('案内に戻って、鬼神石を開いて');
  check('return and a new named goal are handled in one turn',r.data&&r.data.siteGuideReturnWithGoal&&r.data.siteGuideConversationReturn&&r.data.siteGuideReturnFromPause,r);
  check('compound return switches to only the requested new page',r.data&&r.data.siteItem==='kishin'&&r.links.length===1&&hasLink(r,'鬼神石.html')&&!stone(r,26,'monkyoku'),r);
  check('compound return records the new target and pause length',r.data&&/鬼神石/.test(r.data.siteGuideReturnTarget)&&r.data.siteGuidePauseTurns===1,r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('今日は暑いね');r=await s.ask('比較の続きに戻って、二つ目を開いて');
  check('compound return understands two-item wording as an ordinal',r.data&&r.data.siteGuideReturnWithGoal&&r.data.siteItem==='tsukumo',r);
  check('second item opens only tsukumo',r.links.length===1&&hasLink(r,'九十九.html')&&!hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');r=await s.ask('さっき案内してたやつに戻って、武曲の輝光');
  check('compound return can switch an exact stone detail',r.data&&r.data.siteGuideReturnWithGoal&&r.data.stoneName==='武曲'&&stone(r,23,'bukyoku'),r);
  check('stone switch does not retain the abandoned monkyoku link',!stone(r,26,'monkyoku'),r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');await s.ask('そうだね');r=await s.ask('サイトの話に戻して、九十九の保存を教えて');
  check('compound return works after two smalltalk turns',r.data&&r.data.siteGuideReturnWithGoal&&r.data.siteGuidePauseTurns===2&&r.data.siteItem==='tsukumo',r);
  check('new save request supplies only the target page',r.links.length===1&&hasLink(r,'九十九.html'),r);

  r=await session().ask('案内に戻って、鬼神石を開いて');
  check('compound return without prior guide does not fabricate a resumed context',!(r.data&&r.data.siteGuideReturnWithGoal),r);
  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('どれでもない');await s.ask('今日は暑いね');r=await s.ask('案内に戻って、鬼神石を開いて');
  check('explicitly cleared guide is not revived by compound return',!(r.data&&r.data.siteGuideReturnWithGoal),r);
  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('足利義昭のカウンターは？');r=await s.ask('比較の続きに戻って、二つ目を開いて');
  check('specialist branch is not mistaken for a smalltalk pause',!(r.data&&r.data.siteGuideReturnWithGoal),r);

  s=session();await s.ask('鬼神石と九十九と魔導結晶の違いは？');await s.ask('ここじゃなかった');r=await s.ask('真ん中のページ');
  check('middle wrong page leaves the two valid candidates',r.data&&r.data.siteLinkMissRejectedItem==='tsukumo'&&ids(r.data.siteCandidates)==='kishin,mado',r);
  check('rejected page is stored as excluded',r.data&&ids(r.data.siteExcludedItems)==='tsukumo',r);
  r=await s.ask('残りを比べて');
  check('remaining comparison uses only the repaired candidate set',r.data&&r.data.siteLinkMissRecoveryContinuation&&ids(r.data.siteComparison)==='kishin,mado',r);
  check('remaining comparison never revives the rejected page',r.links.length===2&&hasLink(r,'鬼神石.html')&&hasLink(r,'魔導結晶.html')&&!hasLink(r,'九十九.html'),r);
  check('remaining comparison explains differences',/違いはこちら/.test(r.answer||'')&&r.data&&ids(r.data.siteExcludedItems)==='tsukumo',r);
  r=await s.ask('両方開いて');
  check('open-both after comparison keeps only the repaired set',r.data&&r.data.siteLinkMissRecoveryContinuation&&ids(r.data.siteOpenedItems)==='kishin,mado',r);
  check('open-both preserves the exclusion',r.links.length===2&&!hasLink(r,'九十九.html')&&r.data&&ids(r.data.siteExcludedItems)==='tsukumo',r);

  s=session();await s.ask('鬼神石と九十九と魔導結晶の違いは？');await s.ask('ここじゃなかった');await s.ask('真ん中のページ');r=await s.ask('残り両方開いて');
  check('direct remaining-open request opens exactly the two kept pages',r.data&&r.data.siteLinkMissRecoveryContinuation&&r.links.length===2&&hasLink(r,'鬼神石.html')&&hasLink(r,'魔導結晶.html')&&!hasLink(r,'九十九.html'),r);
  s=session();await s.ask('鬼神石と九十九と魔導結晶の違いは？');await s.ask('ここじゃなかった');await s.ask('真ん中のページ');r=await s.ask('残りは？');
  check('ambiguous remaining question lists only kept pages',r.data&&r.data.siteLinkMissRecoveryContinuation&&ids(r.data.siteCandidates)==='kishin,mado'&&!hasLink(r,'九十九.html'),r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku deep link remains exact',r.data&&r.data.siteItem==='seikai'&&r.data.stoneName==='文曲'&&stone(r,26,'monkyoku'),r);

  for(const phrase of ['少し休憩しよう','一息つこう','水分とろう','ゆっくりしよう','のんびりしよう']){
    r=await session().ask(phrase);
    check(`everyday invitation stays natural: ${phrase}`,r.mode==='日常会話'&&!(r.data&&r.data.siteGuide)&&r.links.length===0&&!(r.data&&r.data.needsClarification),r);
  }
  r=await session().ask('鬼神石を開いて');
  check('smalltalk expansion does not steal an explicit site request',r.data&&r.data.siteGuide&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);

  console.log(`COMPOUND RETURN RECOVERY SMALLTALK: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
