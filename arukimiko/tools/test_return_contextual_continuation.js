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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteOpenedItems:d.siteOpenedItems||[],selectedSiteItem:d.selectedSiteItem||'',needsClarification:!!d.needsClarification,siteGuideContextCleared:!!d.siteGuideContextCleared,siteGuideConversationReturn:!!d.siteGuideConversationReturn,siteGuideReturnFromPause:!!d.siteGuideReturnFromPause,siteGuidePauseTurns:Number(d.siteGuidePauseTurns||0),siteGuideReturnWithGoal:!!d.siteGuideReturnWithGoal,siteGuideReturnTarget:d.siteGuideReturnTarget||'',siteContextualPageHelp:!!d.siteContextualPageHelp,siteExactLinkOpen:!!d.siteExactLinkOpen,siteOverview:!!d.siteOverview,stoneName:d.stoneName||'',stoneId:d.stoneId||0}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function ids(value){return Array.isArray(value)?value.join(','):'';}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}

(async()=>{
  let s=session(),r;
  await s.ask('九十九と鬼神石の違いは？');await s.ask('今日は暑いね');r=await s.ask('比較の続きに戻って、違いだけ教えて');
  check('compound comparison return accepts difference-only wording',r.data&&r.data.siteGuideReturnWithGoal&&r.data.siteGuideConversationReturn&&!r.data.needsClarification,r);
  check('compound comparison return restores the exact candidate pair',r.data&&ids(r.data.siteComparison)==='kishin,tsukumo'&&r.links.length===2&&hasLink(r,'鬼神石.html')&&hasLink(r,'九十九.html'),r);
  check('compound comparison return explains the difference',/違いはこちら/.test(r.answer||'')&&/そのままご希望の内容を案内します/.test(r.answer||''),r);
  r=await s.ask('じゃあ二つ目を開いて');
  check('two-item ordinal after returned comparison selects one page',r.data&&r.data.siteItem==='tsukumo'&&r.data.selectedSiteItem==='tsukumo',r);
  check('two-item ordinal does not open both pages',r.links.length===1&&hasLink(r,'九十九.html')&&!hasLink(r,'鬼神石.html'),r);
  check('selected comparison context remains available',r.data&&ids(r.data.siteComparison)==='kishin,tsukumo',r);
  r=await s.ask('それは何ができる？');
  check('deictic help follows the selected page',r.data&&r.data.siteItem==='tsukumo'&&r.data.siteContextualPageHelp&&!r.data.siteOverview,r);
  check('deictic help keeps only the selected page link',r.links.length===1&&hasLink(r,'九十九.html'),r);
  r=await s.ask('そこを開いて');
  check('deictic open still opens the selected page',r.data&&r.data.siteExactLinkOpen&&r.links.length===1&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('違いだけ教えて');
  check('difference-only wording works without leaving the comparison',r.data&&ids(r.data.siteComparison)==='kishin,tsukumo'&&r.links.length===2,r);
  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('今日は暑いね');r=await s.ask('案内に戻って、もう一度違いを教えて');
  check('repeat-difference wording works inside compound return',r.data&&r.data.siteGuideReturnWithGoal&&ids(r.data.siteComparison)==='kishin,tsukumo',r);
  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('今日は暑いね');await s.ask('そうだね');r=await s.ask('比較の続きに戻って、違いをもう一回教えて');
  check('difference repetition works after two smalltalk turns',r.data&&r.data.siteGuidePauseTurns===2&&ids(r.data.siteComparison)==='kishin,tsukumo',r);

  r=await session().ask('比較の続きに戻って、違いだけ教えて');
  check('compound difference return without history does not fabricate candidates',!(r.data&&r.data.siteGuideReturnWithGoal),r);
  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('どれでもない');await s.ask('今日は暑いね');r=await s.ask('比較の続きに戻って、違いだけ教えて');
  check('cleared comparison is not revived by difference-only return',!(r.data&&r.data.siteGuideReturnWithGoal),r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');await s.ask('案内に戻って、鬼神石を開いて');r=await s.ask('それは何ができる？');
  check('new target after return becomes the subject of the next deictic question',r.data&&r.data.siteItem==='kishin'&&r.data.siteContextualPageHelp&&!r.data.siteOverview,r);
  check('new-target help never falls back to the old stone',r.links.length===1&&hasLink(r,'鬼神石.html')&&!stone(r,26,'monkyoku'),r);
  r=await s.ask('このサイトは何ができる？');
  check('explicit site-wide question still opens the overview',r.data&&r.data.siteOverview&&r.links.length>1,r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');await s.ask('サイトの話に戻して、九十九の保存を教えて');r=await s.ask('それを開いて');
  check('exact open after compound return keeps the new page',r.data&&r.data.siteExactLinkOpen&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);
  r=await s.ask('何ができる？');
  check('bare capability after exact open describes the current page',r.data&&r.data.siteItem==='tsukumo'&&r.data.siteContextualPageHelp&&!r.data.siteOverview,r);
  check('bare capability after exact open supplies only that page',r.links.length===1&&hasLink(r,'九十九.html')&&!hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('2つ目を開いて');
  check('numeric two-item ordinal opens only the second page',r.data&&r.data.siteItem==='tsukumo'&&r.links.length===1&&!hasLink(r,'鬼神石.html'),r);
  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('この二つを開いて');
  check('explicit two-page wording still opens both pages',r.data&&ids(r.data.siteOpenedItems)==='kishin,tsukumo'&&r.links.length===2,r);
  s=session();await s.ask('鬼神石と九十九と魔導結晶の違いは？');r=await s.ask('三つ目を開いて');
  check('three-item ordinal is not mistaken for opening three pages',r.data&&r.data.siteItem==='mado'&&r.links.length===1&&hasLink(r,'魔導結晶.html'),r);

  for(const phrase of ['気分転換しよう','ちょっと気分転換しよ','今日はここまでにしよう','ここで一区切りにしよう','一旦ひと区切りつけよう']){
    r=await session().ask(phrase);
    check(`short daily transition stays natural: ${phrase}`,r.mode==='日常会話'&&!(r.data&&r.data.siteGuide)&&r.links.length===0&&!(r.data&&r.data.needsClarification),r);
  }
  r=await session().ask('鬼神石を開いて');
  check('daily-transition expansion does not steal a site request',r.data&&r.data.siteGuide&&r.data.siteItem==='kishin'&&hasLink(r,'鬼神石.html'),r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku deep link remains exact',r.data&&r.data.siteItem==='seikai'&&r.data.stoneName==='文曲'&&stone(r,26,'monkyoku'),r);

  console.log(`RETURN CONTEXTUAL CONTINUATION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
