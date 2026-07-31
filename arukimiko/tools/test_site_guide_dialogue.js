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
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js','jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js',
  'jinpo-bot.js'
].forEach(load);
const B=global.JINPO_BOT,C=global.JINPO_BOT_CONVERSATION;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function compactMeta(r){
  let data=null;
  if(r&&r.data&&r.data.siteGuide){
    data={
      siteGuide:true,
      siteItem:String(r.data.siteItem||''),
      siteFeature:String(r.data.siteFeature||''),
      candidates:Array.isArray(r.data.candidates)?r.data.candidates.slice(0,8):[],
      siteCandidates:Array.isArray(r.data.siteCandidates)?r.data.siteCandidates.slice(0,8):[],
      needsClarification:!!r.data.needsClarification
    };
  }
  return {links:r&&r.links||[],mode:r&&r.mode||'',data};
}
function session(){
  const history=[];
  return {
    history,
    async ask(q){
      history.push({role:'user',text:q});
      const r=await B.handle({message:q,history:history.slice()});
      history.push({role:'assistant',text:String(r.answer||''),meta:compactMeta(r)});
      return r;
    }
  };
}
function isGuide(r,id){return !!(r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteGuide&&(id===undefined||r.data.siteItem===id));}

(async()=>{
  let n=C.normalizeKanaInput('鬼神石と九十九どっちがいい');
  check('normalization preserves どっちがいい',n.text==='鬼神石と九十九どっちがいい',n);
  n=C.normalizeKanaInput('ちがいは');
  check('standalone ちがい still normalizes',n.text==='違いは',n);

  const direct=[
    ['このサイト何すりゃいいん',null,r=>isGuide(r)&&r.data.siteOverview===true],
    ['英傑の能力見れるとこ','heroes',r=>isGuide(r,'heroes')],
    ['陣法で何できんの','jinpo',r=>isGuide(r,'jinpo')&&/使い方/.test(r.answer||'')],
    ['桶狭間見たいんだけど','okehazama',r=>isGuide(r,'okehazama')],
    ['魔導結晶の見方わからん','mado',r=>isGuide(r,'mado')&&/使い方/.test(r.answer||'')],
    ['鬼神石と九十九どっちがいい',null,r=>isGuide(r)&&Array.isArray(r.links)&&r.links.length===2&&/扱う対象が違う/.test(r.answer||'')]
  ];
  for(const [q,id,judge] of direct){const r=await session().ask(q);check('direct '+q,judge(r),r);}

  let s=session(),r=await s.ask('計算したい');
  check('calculator ambiguity keeps candidates',isGuide(r)&&r.data.needsClarification===true&&r.data.candidates.length===4,r);
  r=await s.ask('家臣のほう');
  check('candidate chosen by short noun',isGuide(r,'retainer'),r);
  r=await s.ask('そのページ何できる');
  check('deictic page help keeps selected page',isGuide(r,'retainer')&&/家臣/.test(r.answer||'')&&/使い方/.test(r.answer||''),r);
  r=await s.ask('開いて');
  check('deictic open keeps selected page',isGuide(r,'retainer')&&r.links&&r.links.length===1,r);

  s=session();r=await s.ask('カウンターの次どれ');
  check('counter child candidates',isGuide(r)&&r.data.needsClarification===true&&r.data.candidates.join(',')==='tenka_story,shura,tenka_taikai',r);
  r=await s.ask('武技大会の方');
  check('counter candidate rough selection',isGuide(r,'tenka_taikai'),r);
  r=await s.ask('その次どれ');
  check('hierarchy asks ten or chi',isGuide(r)&&r.data.needsClarification===true&&r.data.candidates.join(',')==='ten_mode,chi_mode',r);
  r=await s.ask('天の方');
  check('hierarchy selects ten',isGuide(r,'ten_mode'),r);
  r=await s.ask('じゃあ地');
  check('sibling correction selects chi',isGuide(r,'chi_mode'),r);

  s=session();await s.ask('九十九のページ見たい');r=await s.ask('それじゃなくて魔導');
  check('correction carries navigation intent',isGuide(r,'mado'),r);
  s=session();await s.ask('比叡山見たい');r=await s.ask('そっちじゃなくて封印');
  check('counter location correction',isGuide(r,'fuuin'),r);

  r=await session().ask('鬼神石の使い方教えて');
  check('tool fact is not hijacked',r&&r.mode==='たいらの野望ツール実データ'&&!(r.data&&r.data.siteGuide),r);
  r=await session().ask('魔導結晶の入手は？');
  check('tool missing target asks naturally',r&&r.mode==='たいらの野望ツール実データ'&&/番号または名称/.test(r.answer||''),r);
  r=await session().ask('足利義昭のカウンター見たい');
  check('named counter remains authoritative',r&&r.mode==='たいらの野望専用知識'&&/157/.test(r.answer||'')&&!(r.data&&r.data.siteGuide),r);

  console.log(`SITE GUIDE DIALOGUE: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
