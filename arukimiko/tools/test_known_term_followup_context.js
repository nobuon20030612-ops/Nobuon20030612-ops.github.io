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
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js','jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT,G=global.JINPO_BOT_SITE_GUIDE;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function compactMeta(r){
  const d=r&&r.data||{};
  return {links:r&&r.links||[],mode:r&&r.mode||'',data:{
    siteGuide:!!d.siteGuide,siteItem:String(d.siteItem||''),siteFeature:String(d.siteFeature||''),
    siteCandidates:Array.isArray(d.siteCandidates)?d.siteCandidates.slice(0,8):[],candidates:Array.isArray(d.candidates)?d.candidates.slice(0,8):[],
    knownTermGuidance:!!d.knownTermGuidance,termKey:String(d.termKey||''),normalizedTerm:String(d.normalizedTerm||''),approximateTerm:!!d.approximateTerm,
    needsClarification:!!d.needsClarification,heroKnowledge:!!d.heroKnowledge,hero:String(d.hero||''),heroes:Array.isArray(d.heroes)?d.heroes.slice(0,12):[]
  }};
}
async function pair(first,second){
  const history=[{role:'user',text:first}];
  const a=await B.handle({message:first,history:history.slice()});
  history.push({role:'assistant',text:String(a.answer||''),meta:compactMeta(a)});
  history.push({role:'user',text:second});
  const b=await B.handle({message:second,history:history.slice()});
  return {first:a,second:b,history};
}
function guide(r,id,feature){
  const d=r&&r.data||{};
  return !!(r&&r.mode==='サイト総合案内'&&d.siteGuide&&(!id||d.siteItem===id)&&(!feature||d.siteFeature===feature));
}
(async()=>{
  let x=await pair('配置英傑','前田慶次を入れて');
  check('placement followup avoids person-domain hijack',guide(x.second,'jinpo')&&!/前田智徳|職業 傾奇者/.test(x.second.answer||''),x.second);
  check('placement canonical message retained',x.second.data&&x.second.data.context&&x.second.data.context.message==='前田慶次を入れて探して',x.second.data&&x.second.data.context);

  x=await pair('除外英傑','前田慶次');
  check('exclusion followup avoids hero profile',guide(x.second,'jinpo')&&!/能力：/.test(x.second.answer||''),x.second);
  check('exclusion canonical message retained',x.second.data&&x.second.data.context&&x.second.data.context.message==='前田慶次を除外して',x.second.data&&x.second.data.context);

  x=await pair('文曲','2人除外');
  check('bunkyoku count followup reaches jinpo path',guide(x.second,'jinpo')&&!/解釈をうまく絞り切れなかった/.test(x.second.answer||''),x.second);
  check('bunkyoku canonical message retained',x.second.data&&x.second.data.context&&x.second.data.context.message==='文曲を2人除外',x.second.data&&x.second.data.context);

  x=await pair('英傑','コスト7は？');
  check('hero cost followup uses hero master',x.second&&x.second.mode==='英傑マスター実データ'&&/コスト7の英傑は 162人/.test(x.second.answer||''),x.second);
  x=await pair('英傑','一覧の使い方');
  check('hero list usage followup uses page guide',guide(x.second,'heroes')&&/第1〜第3優先/.test(x.second.answer||''),x.second);

  x=await pair('鬼神石','腕力が高い順');
  check('kishin ranking followup uses authoritative rows',x.second&&x.second.mode==='たいらの野望ツール実データ'&&/戦鬼の霊光/.test(x.second.answer||''),x.second);
  x=await pair('九十九','知力が高い順');
  check('tsukumo ranking followup uses authoritative rows',x.second&&x.second.mode==='たいらの野望ツール実データ'&&/八幡神の武運/.test(x.second.answer||''),x.second);
  x=await pair('鬼神石','合計の出し方');
  check('kishin total followup uses page fact',guide(x.second,'kishin','selection_count')&&/8個まで選択/.test(x.second.answer||''),x.second);

  x=await pair('ルーレット','何人登録できる？');
  check('roulette participant followup never becomes hero count',guide(x.second,'roulette','entry')&&/固定の最大登録人数は明記されていません/.test(x.second.answer||'')&&!/全英傑/.test(x.second.answer||''),x.second);
  x=await pair('トーナメント','何人登録できる？');
  check('tournament participant followup never becomes hero count',guide(x.second,'tournament','entry')&&/個人またはチーム/.test(x.second.answer||'')&&!/全英傑/.test(x.second.answer||''),x.second);
  x=await pair('トーナメント','勝敗の付け方');
  check('tournament progress followup avoids carp standings',guide(x.second,'tournament','progress')&&/管理画面で勝敗を入力/.test(x.second.answer||'')&&!/カープの順位/.test(x.second.answer||''),x.second);

  x=await pair('カウンター','どの場所がある？');
  check('counter location categories',guide(x.second,'counter','categories')&&/天下統一奇譚.*修羅の間.*天下武技大会/.test(x.second.answer||''),x.second);
  x=await pair('天下統一奇譚','場所は？');
  check('tenka story locations stay one exact page',guide(x.second,'tenka_story','categories')&&Array.isArray(x.second.links)&&x.second.links.length===1&&/桶狭間.*封印/.test(x.second.answer||''),x.second);
  x=await pair('名物','合計は？');
  check('meibutsu total column followup',guide(x.second,'meibutsu','columns')&&/種類や合計/.test(x.second.answer||''),x.second);
  x=await pair('鎮魂符','技能一覧');
  check('chinkon skill list followup',guide(x.second,'chinkon','columns')&&/技能一覧/.test(x.second.answer||''),x.second);
  x=await pair('七星転生','何が分かる？');
  check('shichisei is image guide not calculator',guide(x.second,'shichisei')&&/説明画像/.test(x.second.answer||'')&&/入力式の計算フォームはありません/.test(x.second.answer||''),x.second);

  const history=[{role:'user',text:'配置英傑'},{role:'assistant',text:'x',meta:{data:{siteGuide:true,siteItem:'jinpo',knownTermGuidance:true,termKey:'placement',normalizedTerm:'配置英傑'}}},{role:'user',text:'前田慶次を入れて'}];
  const expanded=G.expandKnownTermFollowup('前田慶次を入れて',history);
  check('known term expansion carries operation marker',expanded&&expanded.jinpoOperation===true&&expanded.message==='前田慶次を入れて探して',expanded);

  x=await pair('九十九','今日は暑いね');
  check('unrelated next turn is not forced into tsukumo',x.second&&x.second.mode!=='たいらの野望ツール実データ'&&!/九十九/.test(x.second.answer||''),x.second);

  const direct=await B.handle({message:'九十九1番の能力',history:[]});
  check('explicit authoritative query remains direct',direct&&direct.mode==='たいらの野望ツール実データ'&&/八幡神の武運/.test(direct.answer||''),direct);

  console.log(`KNOWN TERM FOLLOWUP CONTEXT: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
