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
['jinpo-bot-conversation.js','jinpo-bot-context.js','jinpo-bot-dialog.js','jinpo-bot-page-context.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot-memory.js','jinpo-bot-arukimiko.js','jinpo-bot-hero-data.js','jinpo-bot-hero-knowledge.js','jinpo-bot.js','jinpo-bot-persona.js'].forEach(load);
const B=global.JINPO_BOT;let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function meta(r){return {mode:r.mode||'',data:Object.assign({},r.data||{})};}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:meta(r)});return r;}};}
(async()=>{
  const s=session();let r;
  await s.ask('腕力トップ20');
  await s.ask('侍だけ');

  r=await s.ask('林崎甚助が候補に入っている理由は？');
  check('included reason handled',r.data.candidateReason===true&&r.data.inCandidate===true,r.data);
  check('included reason root',r.data.inRoot===true&&r.data.hero==='林崎甚助',r.data);
  check('included reason condition',r.data.passedConditions.includes('職業「侍」')&&r.data.failedConditions.length===0,r.data);
  check('included reason answer',/現在候補に入っています/.test(r.answer)&&/登録職業：侍/.test(r.answer),r.answer);

  r=await s.ask('母里太兵衛が候補から外れた理由は？');
  check('failed job reason handled',r.data.candidateReason===true&&r.data.inCandidate===false&&r.data.inRoot===true,r.data);
  check('failed job condition',r.data.failedConditions.length===1&&r.data.failedConditions[0]==='職業「侍」',r.data);
  check('failed job actual',/登録職業：僧/.test(r.answer),r.answer);

  r=await s.ask('豊臣秀長がこの中にいないのはなぜ？');
  check('outside root handled',r.data.candidateReason===true&&r.data.inRoot===false&&r.data.inCandidate===false,r.data);
  check('outside root explains root set',/絞り込み元となる候補20人に含まれていない/.test(r.answer),r.answer);

  await s.ask('知力2500以上だけ');
  r=await s.ask('真田幸村(神魔)が外れた理由は？');
  check('threshold failure handled',r.data.candidateReason===true&&r.data.failedConditions.includes('知力2500以上'),r.data);
  check('threshold actual shown',/知力：2326/.test(r.answer),r.answer);
  check('passed and failed split',r.data.passedConditions.includes('職業「侍」')&&r.data.failedConditions.includes('知力2500以上'),r.data);

  r=await s.ask('林崎甚介がこうほにはいってるりゆうは？');
  check('typo kana reason handled',r.data.candidateReason===true&&r.data.hero==='林崎甚助',r.data);
  check('typo correction disclosed',/林崎甚介.*林崎甚助/.test(r.answer),r.answer);
  check('typo reflects current state',r.data.inCandidate===false&&r.data.failedConditions.includes('知力2500以上'),r.data);

  r=await s.ask('豊臣秀ながが候補にいない理由は？');
  check('ambiguous name asks',r.data.needsClarification===true&&r.data.candidateReason===true,r.data);
  check('ambiguous candidates',Array.isArray(r.data.candidates)&&r.data.candidates.length>=2,r.data);

  const bare=session();
  r=await bare.ask('母里太兵衛が候補に入っている理由は？');
  check('no scope asks first',r.data.needsClarification===true&&r.data.candidateReason===true&&r.data.needsHeroScope===true,r.data);

  r=await s.ask('候補に入った理由は？');
  check('missing hero asks',r.data.needsClarification===true&&r.data.candidateReason===true&&r.data.needsHero===true,r.data);

  console.log(`HERO MASTER CANDIDATE REASON: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
