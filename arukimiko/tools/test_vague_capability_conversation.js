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
function compact(r){const d=r.data||{};return{mode:r.mode||'',links:r.links||[],data:{siteGuide:!!d.siteGuide,siteItem:d.siteItem||'',siteFeature:d.siteFeature||'',siteFeatures:d.siteFeatures||[],siteItems:d.siteItems||[],siteComparison:d.siteComparison||[],candidates:d.candidates||[],siteCandidates:d.siteCandidates||[],siteSourceCandidates:d.siteSourceCandidates||[],selectedSiteItem:d.selectedSiteItem||'',needsClarification:!!d.needsClarification,siteGuideContextCleared:!!d.siteGuideContextCleared,siteVagueCapability:d.siteVagueCapability||'',siteVagueCapabilityClarification:!!d.siteVagueCapabilityClarification,firstComparisonItem:d.firstComparisonItem||''}};}
function session(){const h=[];return{async ask(q){h.push({role:'user',text:q});const r=await B.handle({message:q,history:h.slice()});h.push({role:'assistant',text:r.answer||'',meta:compact(r)});return r;}};}
function hasLink(r,name){return !!(r&&r.links||[]).some(x=>{try{return decodeURIComponent(String(x.url||'')).includes(name);}catch(e){return false;}});}
function monkyoku(r){return !!(r&&r.links||[]).some(x=>/seikai\.html\?stone=26#monkyoku/.test(decodeURIComponent(String(x.url||''))));}

(async()=>{
  let s=session(),r;
  r=await s.ask('計算できるの');
  check('vague calculation is handled as site guidance',r.data&&r.data.siteVagueCapability==='calculate'&&r.data.siteVagueCapabilityClarification&&r.data.needsClarification,r);
  check('calculation guidance offers seven sourced destinations',r.links.length===7&&hasLink(r,'能力計算機.html')&&hasLink(r,'家臣計算機.html')&&hasLink(r,'shichiseitensei.html'),r);
  r=await s.ask('家臣の');
  check('short retainer reply selects retainer calculator',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteItem==='retainer'&&hasLink(r,'家臣計算機.html'),r);

  s=session();await s.ask('計算できるの');r=await s.ask('自分の');
  check('short own reply selects ability calculator',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteItem==='stats'&&hasLink(r,'能力計算機.html'),r);
  s=session();await s.ask('計算できるの');r=await s.ask('8個の合計');
  check('short eight-item reply narrows to three tools',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteVagueCapability==='calculate'&&r.data.candidates.length===3&&hasLink(r,'鬼神石.html')&&hasLink(r,'九十九.html')&&hasLink(r,'魔導結晶.html'),r);

  s=session();await s.ask('計算できるの');await s.ask('なるほど');r=await s.ask('家臣の');
  check('one acknowledgement preserves vague clarification',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteItem==='retainer',r);
  s=session();await s.ask('計算できるの');await s.ask('今日は暑いね');r=await s.ask('家臣の');
  check('unrelated smalltalk expires vague clarification',!(r.data&&r.data.siteVagueCapabilityFollowup),r);
  s=session();await s.ask('計算できるの');await s.ask('やめる');r=await s.ask('家臣の');
  check('cancellation prevents vague clarification revival',!(r.data&&r.data.siteVagueCapabilityFollowup),r);

  s=session();r=await s.ask('一覧あるの');
  check('vague list request is clarified with sourced choices',r.data&&r.data.siteVagueCapability==='list'&&r.data.siteVagueCapabilityClarification&&r.links.length===6,r);
  r=await s.ask('英傑の');
  check('short hero-list reply opens hero list',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteItem==='heroes'&&hasLink(r,'英傑一覧.html'),r);
  s=session();await s.ask('一覧あるの');r=await s.ask('カウンター');
  check('short counter-list reply opens counter menu',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteItem==='counter'&&hasLink(r,'counter.html'),r);

  s=session();r=await s.ask('比較できるの');
  check('vague comparison asks for two names without inventing targets',r.data&&r.data.siteVagueCapability==='compare'&&r.data.siteVagueCapabilityClarification&&r.links.length===0,r);
  r=await s.ask('九十九と鬼神石');
  check('two bare names complete requested comparison',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteComparison.length===2&&hasLink(r,'九十九.html')&&hasLink(r,'鬼神石.html'),r);
  r=await s.ask('能力計算に使いたい');
  check('purpose can continue after vague comparison completion',r.data&&r.data.siteComparisonPurposeSelected&&r.data.siteItem==='tsukumo',r);

  s=session();await s.ask('比較できるの');r=await s.ask('九十九');
  check('one comparison name asks only for the other side',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.firstComparisonItem==='tsukumo'&&r.data.needsClarification,r);
  r=await s.ask('鬼神石');
  check('second bare name completes the comparison',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteComparison.length===2&&hasLink(r,'九十九.html')&&hasLink(r,'鬼神石.html'),r);

  r=await session().ask('共有できるの');
  check('vague sharing gives the verified formation-sharing route',r.data&&r.data.siteVagueCapability==='share'&&r.data.siteItem==='jinpo'&&r.data.siteFeature==='share'&&hasLink(r,'陣法/jinpo.html'),r);
  check('sharing answer names URL and JSON without claiming other features',/共有URL.*JSON/.test(r.answer||''),r);

  s=session();await s.ask('保存できるの');r=await s.ask('一覧の');
  check('short list reply after save preserves all three list choices',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteVagueCapability==='save'&&r.data.candidates.length===3,r);
  r=await s.ask('九十九');
  check('save-list choice can be selected naturally',r.data&&r.data.siteItem==='tsukumo'&&hasLink(r,'九十九.html'),r);
  s=session();await s.ask('保存できるの');r=await s.ask('編成の');
  check('short formation reply explains formation save and share',r.data&&r.data.siteVagueCapabilityFollowup&&r.data.siteItem==='jinpo'&&/共有URL.*JSON/.test(r.answer||''),r);

  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');r=await s.ask('さっきのやつ続けて');
  check('natural that-one continuation resumes monkyoku guide',r.data&&r.data.siteGuideConversationReturn&&r.data.siteGuideReturnFromPause&&monkyoku(r),r);
  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('今日は暑いね');r=await s.ask('サイトの続き');
  check('site-continuation wording resumes comparison',r.data&&r.data.siteGuideConversationReturn&&r.data.siteComparison.length===2&&r.links.length===2,r);
  s=session();await s.ask('文曲の輝光');await s.ask('今日は暑いね');await s.ask('そうなんだ');r=await s.ask('さっきのやつ続けて');
  check('explicit continuation resumes after two smalltalk turns',r.data&&r.data.siteGuideConversationReturn&&r.data.siteGuidePauseTurns===2&&monkyoku(r),r);
  s=session();await s.ask('九十九と鬼神石の違いは？');await s.ask('どれでもない');r=await s.ask('比較の続き');
  check('cleared comparison is not revived by expanded return wording',!(r.data&&r.data.siteGuideConversationReturn),r);

  r=await session().ask('文曲の輝光');
  check('exact monkyoku deep link remains protected',r.data&&r.data.siteItem==='seikai'&&monkyoku(r),r);
  s=session();await s.ask('九十九');r=await s.ask('計算できるの');
  check('fresh page context prevents broad capability takeover',!(r.data&&r.data.siteVagueCapabilityClarification),r);

  console.log(`VAGUE CAPABILITY CONVERSATION: ${pass} / ${pass+fail} PASS`);if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
