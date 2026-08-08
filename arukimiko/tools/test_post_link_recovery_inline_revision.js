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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteOpenedItems:d.siteOpenedItems||[],selectedSiteItem:d.selectedSiteItem||'',previousSelectedSiteItem:d.previousSelectedSiteItem||'',needsClarification:!!d.needsClarification,siteGuideContextCleared:!!d.siteGuideContextCleared,siteVagueCapability:d.siteVagueCapability||'',siteVagueCapabilityClarification:!!d.siteVagueCapabilityClarification,siteVagueCapabilityFollowup:!!d.siteVagueCapabilityFollowup,siteLinkMissRecovery:!!d.siteLinkMissRecovery,siteLinkMissNeedsSelection:!!d.siteLinkMissNeedsSelection,siteInlineGoalRevision:!!d.siteInlineGoalRevision,stoneName:d.stoneName||'',stoneId:d.stoneId||0}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function stone(r,id,key){return !!(r&&r.links||[]).some(x=>new RegExp('seikai\\.html\\?stone='+id+'#'+key).test(decodeURIComponent(String(x.url||''))));}

(async()=>{
  let s=session(),r;
  await s.ask('計算できるの');await s.ask('家臣の');r=await s.ask('ここじゃなかった');
  check('wrong selected calculator returns remaining original choices',r.data&&r.data.siteLinkMissRecovery&&r.data.siteCandidates.length===6&&!r.data.siteCandidates.includes('retainer')&&r.data.siteSourceCandidates.length===7,r);
  check('wrong calculator reply excludes the rejected link',hasLink(r,'能力計算機.html')&&!hasLink(r,'家臣計算機.html'),r);
  r=await s.ask('自分の');
  check('short reply selects from recovered choices',r.data&&r.data.siteItem==='stats'&&hasLink(r,'能力計算機.html'),r);

  s=session();await s.ask('一覧あるの');await s.ask('英傑の');r=await s.ask('戻って別の');
  check('back-and-another wording restores five non-hero list choices',r.data&&r.data.siteLinkMissRecovery&&r.data.siteCandidates.length===5&&!r.data.siteCandidates.includes('heroes'),r);
  r=await s.ask('九十九の');
  check('recovered list accepts natural possessive selection',r.data&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);

  s=session();await s.ask('計算できるの');await s.ask('家臣の');await s.ask('それ開いて');r=await s.ask('このページじゃなかった');
  check('wrong-page recovery also works after explicit open wording',r.data&&r.data.siteLinkMissRecovery&&r.data.siteCandidates.length===6,r);

  s=session();await s.ask('九十九を開いて');r=await s.ask('ここじゃなかった、家臣の能力を計算したい');
  check('wrong-page message with explicit target redirects immediately',r.data&&r.data.siteLinkMissRecovery&&r.data.previousSelectedSiteItem==='tsukumo'&&r.data.siteItem==='retainer'&&hasLink(r,'家臣計算機.html'),r);
  check('explicit redirect does not repeat the rejected page',!hasLink(r,'九十九.html'),r);

  s=session();await s.ask('九十九を開いて');r=await s.ask('ここじゃなかった');
  check('single page without known alternatives clears stale page context',r.data&&r.data.siteLinkMissRecovery&&r.data.siteGuideContextCleared&&r.data.siteItem==='__site_guide_context_cleared__'&&r.links.length===0,r);
  r=await s.ask('別のは？');
  check('cleared single-page context does not revive',!(r.data&&r.data.siteLinkMissRecovery),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('ここじゃなかった');
  check('multiple links ask which opened page was wrong instead of guessing',r.data&&r.data.siteLinkMissRecovery&&r.data.siteLinkMissNeedsSelection&&r.data.needsClarification&&r.links.length===2,r);

  s=session();await s.ask('文曲の輝光');r=await s.ask('ここじゃなかった');
  check('wrong stone offers the six other exact stone links',r.data&&r.data.siteLinkMissRecovery&&r.links.length===6&&!stone(r,26,'monkyoku')&&stone(r,23,'bukyoku'),r);
  r=await s.ask('最初の');
  check('stone alternatives remain selectable by position',r.data&&r.data.siteItem==='seikai'&&stone(r,23,'bukyoku'),r);
  s=session();await s.ask('文曲の輝光');r=await s.ask('ここじゃなかった、武曲の輝光');
  check('wrong stone with named correction opens exact new stone',r.data&&r.data.siteLinkMissRecovery&&r.data.stoneName==='武曲'&&stone(r,23,'bukyoku'),r);

  s=session();await s.ask('九十九を開いて');await s.ask('今日は暑いね');r=await s.ask('ここじゃなかった');
  check('unrelated smalltalk expires wrong-link recovery',!(r.data&&r.data.siteLinkMissRecovery),r);
  r=await session().ask('ここじゃなかった');
  check('wrong-link wording without a link context is not fabricated',!(r.data&&r.data.siteLinkMissRecovery),r);

  r=await session().ask('家臣の能力を計算したい、いや自分の能力の方');
  check('inline calculator correction keeps only the final target',r.data&&r.data.siteInlineGoalRevision&&r.data.siteItem==='stats'&&hasLink(r,'能力計算機.html')&&!hasLink(r,'家臣計算機.html'),r);
  r=await session().ask('英傑一覧を見たい、やっぱり九十九の一覧');
  check('inline list correction switches hero list to tsukumo',r.data&&r.data.siteInlineGoalRevision&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html')&&!hasLink(r,'英傑一覧.html'),r);
  r=await session().ask('鬼神石を見たい、いや比較したい、九十九と魔導結晶');
  check('inline comparison excludes the abandoned first target',r.data&&r.data.siteInlineGoalRevision&&r.data.siteComparison.join(',')==='tsukumo,mado'&&r.links.length===2&&!hasLink(r,'鬼神石.html'),r);
  r=await session().ask('九十九を保存したい、いや使い方を知りたい');
  check('inline feature correction retains the page but changes the requested action',r.data&&r.data.siteInlineGoalRevision&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);
  r=await session().ask('鬼神石の一覧、じゃなくてカウンターを見たい');
  check('inline page correction follows the final page request',r.data&&r.data.siteInlineGoalRevision&&r.data.siteItem==='counter'&&hasLink(r,'counter.html')&&!hasLink(r,'鬼神石.html'),r);
  r=await session().ask('家臣の能力計算、いや自分の、やっぱり九十九の一覧');
  check('multiple inline corrections give priority to the final goal',r.data&&r.data.siteInlineGoalRevision&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);
  r=await session().ask('文曲の輝光、いや武曲の輝光');
  check('inline stone correction selects exact final stone',r.data&&r.data.siteInlineGoalRevision&&r.data.stoneName==='武曲'&&stone(r,23,'bukyoku')&&!stone(r,26,'monkyoku'),r);

  r=await session().ask('文曲の輝光');
  check('protected monkyoku deep link remains exact',r.data&&r.data.siteItem==='seikai'&&stone(r,26,'monkyoku'),r);
  console.log(`POST-LINK RECOVERY INLINE REVISION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
