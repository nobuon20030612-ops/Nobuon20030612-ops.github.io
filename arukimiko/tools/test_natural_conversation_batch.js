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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteFeatures:d.siteFeatures||[],siteFeatureSubjects:d.siteFeatureSubjects||[],siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],siteOpenedItems:d.siteOpenedItems||[],siteExcludedItems:d.siteExcludedItems||[],siteConditions:d.siteConditions||[],selectedSiteItem:d.selectedSiteItem||'',needsClarification:!!d.needsClarification,siteGuideContextCleared:!!d.siteGuideContextCleared}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function monkyoku(r){return !!(r&&r.links||[]).some(x=>/seikai\.html\?stone=26#monkyoku/.test(decodeURIComponent(String(x.url||''))));}

(async()=>{
  let s=session(),r;
  r=await s.ask('文曲の輝光');
  check('initial natural stone request keeps exact monkyoku deep link',r.data&&r.data.siteItem==='seikai'&&monkyoku(r),r);
  r=await s.ask('今日は暑いね');
  check('ordinary smalltalk is still answered outside site guide',!(r.data&&r.data.siteGuide),r);
  r=await s.ask('さっきの案内に戻って');
  check('generic guide return resumes after one smalltalk turn',r.data&&r.data.siteGuideConversationReturn&&r.data.siteGuideReturnFromPause,r);
  check('resumed stone guide preserves exact destination',monkyoku(r)&&/文曲/.test(r.answer||''),r);

  s=session();r=await s.ask('九十九と鬼神石、能力計算ならどっち？');
  check('casual direct purpose remains a two-way comparison',r.data&&r.data.siteComparisonPurposeSelected&&r.data.siteItem==='tsukumo'&&r.data.siteComparison.length===2&&!r.data.siteComparison.includes('stats'),r);
  check('casual direct purpose gives the exact selected page',r.links.length===1&&hasLink(r,'九十九.html'),r);
  r=await s.ask('今日は暑いね');
  check('comparison can pause for smalltalk naturally',!(r.data&&r.data.siteGuide),r);
  r=await s.ask('比較の続きに戻って');
  check('comparison return restores both candidates',r.data&&r.data.siteGuideConversationReturn&&r.data.siteComparison.length===2&&r.data.siteComparison.includes('tsukumo')&&r.data.siteComparison.includes('kishin'),r);
  check('comparison return remembers the current selection',r.data&&r.data.selectedSiteItem==='tsukumo'&&/今選んでいるのは「九十九」/.test(r.answer||''),r);
  check('comparison return supplies both candidate links',r.links.length===2&&hasLink(r,'九十九.html')&&hasLink(r,'鬼神石.html'),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');r=await s.ask('どっちにしたらいいか分からない');
  check('indecision receives a targeted purpose clarification',r.data&&r.data.siteComparisonPurposeClarification&&r.data.needsClarification&&r.links.length===2,r);
  check('clarification gives concrete answerable examples',/能力計算に使いたい.*合成最低発現数.*画像で保存したい/s.test(r.answer||''),r);
  r=await s.ask('能力計算に使いたい');
  check('clarified purpose selects tsukumo without restarting',r.data&&r.data.siteComparisonPurposeSelected&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);
  r=await s.ask('なんで？');
  check('reason followup stays connected to the selected purpose',r.data&&r.data.siteComparisonReason&&r.data.siteItem==='tsukumo'&&/能力計算/.test(r.answer||''),r);

  r=await session().ask('どっちにしたらいいか分からない');
  check('indecision without candidates does not invent a comparison',!(r.data&&r.data.siteComparisonPurposeClarification),r);

  s=session();r=await s.ask('保存できるの');
  check('vague save question receives site capability clarification',r.data&&r.data.siteVagueCapabilityClarification&&r.data.needsClarification&&r.data.siteFeature==='save',r);
  check('vague save answer distinguishes image and formation saves',/一覧画面を画像保存.*編成をページ内へ保存/s.test(r.answer||''),r);
  check('vague save answer offers useful destinations',r.links.length===6&&hasLink(r,'鬼神石.html')&&hasLink(r,'能力計算機.html')&&hasLink(r,'陣法/jinpo.html'),r);
  r=await s.ask('一覧を8個選ぶやつ');
  check('short followup narrows save candidates to three list tools',r.data&&r.data.pageFreeGoal==='eight_item_total'&&r.data.candidates.length===3&&hasLink(r,'鬼神石.html')&&hasLink(r,'九十九.html')&&hasLink(r,'魔導結晶.html'),r);

  s=session();await s.ask('九十九');r=await s.ask('保存できるの');
  check('save question with fresh page context answers that page instead of broad list',!(r.data&&r.data.siteVagueCapabilityClarification)&&r.data&&r.data.siteItem==='tsukumo'&&/保存/.test(r.answer||''),r);

  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('どれでもない');r=await s.ask('比較の続きに戻って');
  check('cleared comparison is not revived by the new return handler',!(r.data&&r.data.siteGuideConversationReturn),r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');await s.ask('さっきの案内に戻って');r=await s.ask('じゃあ武曲は？');
  check('detail switch still works after pause and guide return',r.data&&r.data.siteItem==='seikai'&&r.data.stoneName==='武曲'&&/seikai\.html\?stone=23#bukyoku/.test(decodeURIComponent(String(r.links[0]&&r.links[0].url||''))),r);
  r=await s.ask('文曲の');
  check('possessive fragment still switches back to exact monkyoku state',r.data&&r.data.stoneName==='文曲'&&monkyoku(r),r);
  r=await s.ask('これどこに飛ぶ？');
  check('destination explanation remains connected after the long dialogue',r.data&&r.data.siteLinkDestinationExplanation&&/文曲/.test(r.answer||'')&&monkyoku(r),r);

  console.log(`NATURAL CONVERSATION BATCH: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
