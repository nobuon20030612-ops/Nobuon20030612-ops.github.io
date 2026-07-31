#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{},querySelector:()=>null};
global.addEventListener=()=>{};
global.location={href:'https://example.test/陣法/jinpo.html',pathname:'/陣法/jinpo.html',origin:'https://example.test'};
global.fetch=async()=>({ok:false,status:503,text:async()=>''});
global.JINPO_BOT_PAGE_MODE='jinpo';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
[
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js',
  'jinpo-bot-tool-data.js','jinpo-bot-tool-knowledge.js',
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js',
  'jinpo-bot-parser.js','jinpo-bot-nlu.js','jinpo-bot-interpret.js','jinpo-bot-state.js'
].forEach(load);

let site={formation:'',count:0,searchBasis:'base',priority1:'',priority2:'',grade3:false,factor4Exclude:0,sumSort:false,owned:[],excluded:[],recommendActive:false,allMax:false};
const execLog=[];
global.JINPO_BOT_ACTIONS={
  readSiteState:()=>JSON.parse(JSON.stringify(site)),
  captureSnapshot:()=>JSON.parse(JSON.stringify(site)),
  execute:async(name,args)=>{
    execLog.push({name,args:JSON.parse(JSON.stringify(args||{}))});
    if(name==='run_recommended'){
      site.recommendActive=true;site.priority1=String(args&&args.stat||'');
      return {ok:true,message:site.priority1+'のおすすめ検索を実行しました。',data:{}};
    }
    if(name==='run_current_search')return {ok:true,message:'現在条件で検索しました。',data:{}};
    if(name==='apply_result')return {ok:true,message:'検索結果を適用しました。',data:{}};
    if(name==='apply_search'){Object.assign(site,args||{});return {ok:true,message:'検索条件を反映しました。',data:{}};}
    return {ok:true,message:name+'を実行しました。',data:{}};
  }
};
global.JINPO_BOT_HELP={respond:()=>null,get:()=>''};
load('jinpo-bot.js');
const B=global.JINPO_BOT,C=global.JINPO_BOT_CONVERSATION,K=global.JINPO_BOT_KASHIN_NAME;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function countExec(name){return execLog.filter(x=>x.name===name).length;}
function candidateCount(answer){return (String(answer||'').match(/^\d+\. /gm)||[]).length;}
function clearTransient(){try{K.clear();}catch(e){};store['s:arukimikoConversationResetAt.v1']=undefined;}

(async()=>{
  let h=[];
  async function say(q){
    const out=await B.handle({message:q,history:h});
    h.push({role:'user',text:q},{role:'assistant',text:out.answer,meta:{mode:out.mode}});
    return out;
  }

  // 1. カープ→実データ→カウンター→名付け→陣法→雑談を長く混在。
  let r=await say('黒田博樹について教えて');
  check('longmix carp starts with kuroda',r&&/黒田博樹/.test(r.answer||''),r);
  r=await say('家族は？');
  check('longmix carp family keeps kuroda',r&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||''),r);

  r=await say('鬼神石1番は？');
  check('longmix kishin number uses tool truth',r&&r.mode==='たいらの野望ツール実データ'&&/不壊金剛/.test(r.answer||''),r);
  r=await say('入手は？');
  check('longmix kishin acquisition stays tool truth',r&&r.mode==='たいらの野望ツール実データ'&&/不壊金剛/.test(r.answer||'')&&/入手/.test(r.answer||''),r);
  check('longmix kishin acquisition never becomes counter',!/カウンター値を聞いている/.test(r&&r.answer||''),r);

  r=await say('足利のカウンターは？');
  check('longmix counter uses authoritative branch',r&&r.mode==='たいらの野望専用知識'&&/足利義昭/.test(r.answer||'')&&/157/.test(r.answer||''),r);
  r=await say('義輝は？');
  check('longmix counter short followup keeps counter',r&&r.mode==='たいらの野望専用知識'&&/足利義輝/.test(r.answer||'')&&/カウンター/.test(r.answer||''),r);

  r=await say('家臣の名前つけて');
  check('longmix naming starts',r&&r.mode==='家臣名付け',r);
  r=await say('全部お任せ');
  check('longmix naming generates five',r&&r.mode==='家臣名付け'&&candidateCount(r.answer)===5,r);
  r=await say('もっと渋く');
  check('longmix naming style continuation generates five',r&&r.mode==='家臣名付け'&&candidateCount(r.answer)===5,r);

  const beforeSearch=countExec('run_recommended');
  r=await say('腕力高いの検索して');
  check('longmix jinpo search executes once',countExec('run_recommended')===beforeSearch+1,{r,execLog});
  const afterSearch=execLog.length;
  r=await say('バグ出た');
  check('longmix casual bug report does not execute',execLog.length===afterSearch,{r,execLog});

  r=await say('前の話に戻って');
  check('longmix first back restores jinpo without replay',r&&r.data&&r.data.resumedWithoutReplay===true&&execLog.length===afterSearch,r);
  r=await say('前の話に戻って');
  check('longmix second back restores naming',r&&r.mode==='家臣名付け'&&/前に出した候補/.test(r.answer||'')&&execLog.length===afterSearch,r);

  r=await say('カープの話に戻って');
  check('longmix named carp back restores kuroda family',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||''),r);
  r=await say('成績は？');
  check('longmix carp branch persists after named back',r&&r.mode==='カープ専用正本知識'&&/黒田博樹/.test(r.answer||'')&&/200勝/.test(r.answer||''),r);

  r=await say('たいらの野望の話に戻って');
  check('longmix named tairano back chooses latest jinpo branch',r&&r.data&&r.data.resumedWithoutReplay===true&&/腕力高いの検索して/.test(r.answer||''),r);
  check('longmix named tairano back does not execute jinpo',execLog.length===afterSearch,{r,execLog});

  // 2. カウンターがたいらの野望内の最新枝なら、場所・人物・値まで正確に復元。
  clearTransient();h=[];
  r=await say('足利のカウンターは？');
  r=await say('義輝は？');
  r=await say('黒田博樹について教えて');
  r=await say('たいらの野望の話に戻って');
  check('counter named tairano back restores exact target',r&&r.mode==='たいらの野望専用知識'&&/天下統一奇譚・京都/.test(r.answer||'')&&/足利義輝/.test(r.answer||'')&&/7/.test(r.answer||''),r);

  // 3. 実データの短い観点を、別話題を挟んだ名前付き復帰でも対象付きで復元。
  clearTransient();h=[];
  r=await say('鬼神石1番は？');
  r=await say('入手は？');
  r=await say('新井貴浩について教えて');
  r=await say('たいらの野望の話に戻って');
  check('tool named tairano back restores item and acquisition',r&&r.mode==='たいらの野望ツール実データ'&&/鬼神石 1番/.test(r.answer||'')&&/不壊金剛/.test(r.answer||'')&&/入手/.test(r.answer||''),r);
  r=await say('耐久は？');
  check('tool followup after named back keeps same item',r&&r.mode==='たいらの野望ツール実データ'&&/不壊金剛/.test(r.answer||'')&&/耐久は 200/.test(r.answer||''),r);

  // 4. サイト総合案内も「たいらの野望」グループとして復帰可能。
  clearTransient();h=[];
  r=await say('このサイトで何ができる？');
  check('site overview handled as tairano capability',r&&/たいらの野望/.test(r.answer||'')&&/陣法検索/.test(r.answer||''),r);
  r=await say('黒田博樹について教えて');
  r=await say('たいらの野望に戻って');
  check('site overview named tairano back handled',r&&/たいらの野望/.test(r.answer||'')&&/陣法検索/.test(r.answer||''),r);

  // 5. たいらの野望内で陣法が最も新しい場合は陣法へ戻すが、過去検索は再実行しない。
  clearTransient();h=[];
  r=await say('鬼神石1番は？');
  const beforeGroupedJinpo=countExec('run_recommended');
  r=await say('耐久高いの検索して');
  check('grouped tairano setup jinpo executes once',countExec('run_recommended')===beforeGroupedJinpo+1,{r,execLog});
  r=await say('黒田博樹について教えて');
  const beforeGroupedBack=execLog.length;
  r=await say('たいらの野望に戻って');
  check('named tairano chooses latest jinpo branch',r&&r.data&&r.data.resumedWithoutReplay===true&&/耐久高いの検索して/.test(r.answer||''),r);
  check('named tairano latest jinpo does not replay',execLog.length===beforeGroupedBack,{r,execLog});

  // 6. 会話ルーター単体でも個別データのmode分類をcounterへ落とさない。
  const modeHistory=[
    {role:'user',text:'鬼神石1番は？'},
    {role:'assistant',text:'鬼神石 1番「不壊金剛」は、生命2500・耐久200です。',meta:{mode:'たいらの野望ツール実データ'}}
  ];
  check('conversation recent domain classifies kishin mode',C.recentDomain(modeHistory)==='kishin',C.recentDomain(modeHistory));
  const acquisition=C.resolve('入手は？',modeHistory);
  check('conversation carries acquisition to kishin',acquisition&&acquisition.domain==='kishin'&&/鬼神石/.test(acquisition.message||''),acquisition);
  check('conversation recognizes named tairano back',C.isBackCue('たいらの野望の話に戻って')===true,C.isBackCue('たいらの野望の話に戻って'));

  console.log(`LONG MIXED CONVERSATION: ${pass}/${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
