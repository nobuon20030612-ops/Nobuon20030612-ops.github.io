#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),store={};
global.window=global;
global.localStorage={getItem:k=>store['l:'+k]||null,setItem:(k,v)=>store['l:'+k]=String(v),removeItem:k=>delete store['l:'+k]};
global.sessionStorage={getItem:k=>store['s:'+k]||null,setItem:(k,v)=>store['s:'+k]=String(v),removeItem:k=>delete store['s:'+k]};
global.document={readyState:'complete',addEventListener:()=>{},title:'',location:{}};
global.addEventListener=()=>{};
global.fetch=async()=>({ok:false,status:503,text:async()=>''});
global.JINPO_BOT_PAGE_MODE='jinpo';
function load(name){vm.runInThisContext(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});}
[
  'jinpo-bot-carp-knowledge-data.js','jinpo-bot-conversation.js','jinpo-bot-smalltalk.js',
  'jinpo-bot-carp-knowledge.js','jinpo-bot-carp.js','jinpo-bot-kashin-name.js',
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
    if(name==='apply_result')return {ok:true,message:'検索結果1位を適用しました。',data:{}};
    if(name==='clear_placement')return {ok:true,message:'配置を解除しました。',data:{}};
    if(name==='apply_search'){Object.assign(site,args||{});return {ok:true,message:'検索条件を反映しました。',data:{}};}
    return {ok:true,message:name+'を実行しました。',data:{}};
  }
};
global.JINPO_BOT_HELP={
  respond:text=>/全MAXって何|全MAXとは/.test(String(text||''))?{handled:true,answer:'全MAXの説明です。',key:'allmax'}:null,
  get:()=>''
};
load('jinpo-bot.js');
const B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function countExec(name){return execLog.filter(x=>x.name===name).length;}

(async()=>{
  let h=[];
  async function say(q){const out=await B.handle({message:q,history:h});h.push({role:'user',text:q},{role:'assistant',text:out.answer,meta:{mode:out.mode}});return out;}

  await say('黒田博樹について教えて');
  let r=await say('腕力高いの検索して');
  check('mixed initial jinpo search executes once',countExec('run_recommended')===1,execLog);
  check('mixed search reply',r&&/腕力/.test(r.answer||''),r);

  await say('家臣の名前つけて');
  await say('全部お任せ');
  const beforeBack=execLog.length;
  r=await say('前の話に戻って');
  check('back to jinpo does not replay any action',execLog.length===beforeBack,{beforeBack,execLog});
  check('back to jinpo explicitly says no replay',r&&r.data&&r.data.resumedWithoutReplay===true&&/再実行していません/.test(r.answer||''),r);
  check('back to jinpo remembers original command',/腕力高いの検索して/.test(r&&r.answer||''),r&&r.answer);

  // 会話復帰後に新しく明示した検索は、通常どおり1回だけ実行できる。
  r=await say('耐久高いの検索して');
  check('new search after back still executes',countExec('run_recommended')===2,execLog);
  check('new search is durability',execLog.filter(x=>x.name==='run_recommended').slice(-1)[0].args.stat==='耐久',execLog);

  // 「戻る」ではなく明示した操作は抑止しない。
  r=await say('1位を適用');
  check('explicit apply remains executable',countExec('apply_result')===1,execLog);

  // 適用操作そのものが直前の枝でも、「戻る」で再適用しない。
  await say('家臣の名前つけて');
  const beforeApplyBack=countExec('apply_result');
  r=await say('前の話に戻って');
  check('back to apply branch does not reapply',countExec('apply_result')===beforeApplyBack,{r,execLog});
  check('back to action branch reports no replay',r&&r.data&&r.data.resumedWithoutReplay===true,r);

  // 説明質問は操作ではないので、復帰時に「再実行抑止」へ誤分類しない。
  h=[];
  r=await say('全MAXって何？');
  check('fullmax factual question handled as explanation',r&&r.mode==='機能説明',r);
  r=await say('黒田博樹について教えて');
  r=await say('前の話に戻って');
  check('back to fullmax explanation is not action replay guard',!(r&&r.data&&r.data.resumedWithoutReplay)&&r&&r.mode==='機能説明',r);

  // 操作枝へ安全復帰した後も、もう一度「戻って」でさらに前の人物枝へ進める。
  h=[];
  await say('黒田博樹について教えて');
  await say('腕力高いの検索して');
  await say('家臣の名前つけて');
  await say('全部お任せ');
  const beforeDeepBack=execLog.length;
  r=await say('前の話に戻って');
  check('deep back first stops at jinpo without replay',r&&r.data&&r.data.resumedWithoutReplay===true&&execLog.length===beforeDeepBack,r);
  r=await say('前の話に戻って');
  check('deep back second reaches kuroda',r&&/黒田博樹/.test(r.answer||'')&&execLog.length===beforeDeepBack,r);
  r=await say('家族は？');
  check('deep back kuroda persists to family',r&&/黒田博樹/.test(r.answer||'')&&/父/.test(r.answer||''),r);


  // 「前回の続き」でも、過去の陣法操作は話題だけ復帰して再実行しない。
  h=[];
  await say('腕力高いの検索して');
  await say('バグ出た');
  const beforeNaturalResume=countExec('run_recommended');
  r=await say('前回の続き');
  check('natural resume jinpo no replay',countExec('run_recommended')===beforeNaturalResume&&r&&r.data&&r.data.resumedWithoutReplay===true,{r,execLog});

  // 「陣法の話に戻って」の名前付き復帰でも、過去検索を再実行しない。
  h=[];
  await say('腕力高いの検索して');
  await say('黒田博樹について教えて');
  const beforeNamedJinpoBack=countExec('run_recommended');
  r=await say('陣法の話に戻って');
  check('named jinpo back no replay',countExec('run_recommended')===beforeNamedJinpoBack&&r&&r.data&&r.data.resumedWithoutReplay===true,{r,execLog});
  r=await say('耐久高いの検索して');
  check('named jinpo back explicit new search works',countExec('run_recommended')===beforeNamedJinpoBack+1&&execLog.filter(x=>x.name==='run_recommended').slice(-1)[0].args.stat==='耐久',execLog);


  // 自然な反応・部分同意を前置きしても、その後ろの明示操作は1回だけ実行する。
  h=[];
  await say('腕力高いの検索して');
  const beforeContrastSearch=countExec('run_recommended');
  r=await say('それは分かったけど、耐久高いの検索して');
  check('contrastive lead-in search executes once',countExec('run_recommended')===beforeContrastSearch+1,{r,execLog});
  check('contrastive lead-in search uses durability',execLog.filter(x=>x.name==='run_recommended').slice(-1)[0].args.stat==='耐久',execLog);

  const beforeContrastApply=countExec('apply_result');
  r=await say('まあそれは分かるけど、1位を適用');
  check('contrastive lead-in apply executes once',countExec('apply_result')===beforeContrastApply+1,{r,execLog});

  const beforeContrastHelp=execLog.length;
  r=await say('それはそうだけど、全MAXって何？');
  check('contrastive lead-in help stays explanation only',r&&r.mode==='機能説明'&&execLog.length===beforeContrastHelp,{r,execLog});


  // 話題復帰と新規操作を同じ発話で明示した場合は、古い操作を再実行せず新規操作だけ1回実行する。
  h=[];
  await say('黒田博樹について教えて');
  await say('腕力高いの検索して');
  await say('家臣の名前つけて');
  await say('全部お任せ');
  const beforeBackAndSearch=countExec('run_recommended');
  r=await say('陣法の話に戻って、耐久高いの検索して');
  check('back plus explicit new search executes only new search',countExec('run_recommended')===beforeBackAndSearch+1&&execLog.filter(x=>x.name==='run_recommended').slice(-1)[0].args.stat==='耐久',{r,execLog});

  // 同一発話内の言い直しでは、訂正後の検索条件だけを1回実行する。
  h=[];
  const beforeInlineCorrection=countExec('run_recommended');
  r=await say('腕力高いの検索して、いや耐久高いの検索して');
  check('inline corrected search executes final condition once',countExec('run_recommended')===beforeInlineCorrection+1&&execLog.filter(x=>x.name==='run_recommended').slice(-1)[0].args.stat==='耐久',{r,execLog});

  const beforeNegativeCorrection=countExec('run_recommended');
  r=await say('腕力じゃなくて耐久高いの検索して');
  check('negative corrected search executes final condition once',countExec('run_recommended')===beforeNegativeCorrection+1&&execLog.filter(x=>x.name==='run_recommended').slice(-1)[0].args.stat==='耐久',{r,execLog});

  const beforeRankCorrection=countExec('apply_result');
  r=await say('1位じゃなくて2位を適用');
  const lastApply=execLog.filter(x=>x.name==='apply_result').slice(-1)[0];
  check('corrected rank applies only final rank once',countExec('apply_result')===beforeRankCorrection+1&&lastApply&&lastApply.args.rank===2,{r,execLog});


  // 「同じので」は現在の検索条件を維持した明示的な再検索として扱う。
  h=[];
  await say('耐久高いの検索して');
  const beforeSameCurrent=countExec('run_current_search');
  r=await say('同じので検索して');
  check('same current conditions rerun once',countExec('run_current_search')===beforeSameCurrent+1,{r,execLog});

  // 別話題を挟んでも「さっきの検索をもう一回やって」は最後の成功検索を明示的に再実行する。
  h=[];
  await say('耐久高いの検索して');
  await say('黒田博樹について教えて');
  const beforeExplicitLastRerun=countExec('run_recommended');
  r=await say('さっきの検索をもう一回やって');
  check('explicit last search rerun after topic switch',countExec('run_recommended')===beforeExplicitLastRerun+1&&execLog.filter(x=>x.name==='run_recommended').slice(-1)[0].args.stat==='耐久',{r,execLog});
  check('explicit last search rerun reports same recipe',r&&/前回と同じ条件・検索方式でもう一度検索/.test(r.answer||''),r);


  // 検索直後だけ、短い「同じの／同じので／今ので」を現在条件の再検索として扱う。
  for (const phrase of ['同じの','同じので','今ので']) {
    h=[];
    await say('耐久高いの検索して');
    const beforeShortRepeat=countExec('run_current_search');
    r=await say(phrase);
    check('short repeat '+phrase+' reruns immediate search',countExec('run_current_search')===beforeShortRepeat+1,{r,execLog});
  }

  // 別話題を挟んだ裸の「同じの」は、昔の検索を勝手に再実行しない。
  h=[];
  await say('耐久高いの検索して');
  await say('黒田博樹について教えて');
  const beforeStaleSame=execLog.length;
  r=await say('同じの');
  check('bare same after topic switch does not revive old search',execLog.length===beforeStaleSame,{r,execLog});

  console.log(`BOT ROUTE MIXED: ${pass}/${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
