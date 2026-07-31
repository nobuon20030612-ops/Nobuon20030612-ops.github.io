#!/usr/bin/env node
'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const context={console,URL,window:{},location:{href:'https://example.test/index.html',origin:'https://example.test',pathname:'/index.html'}};
context.window=context;context.window.location=context.location;
vm.createContext(context);
function load(name){vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});}
load('jinpo-bot-conversation.js');load('jinpo-bot-site-source-data.js');load('jinpo-bot-site-guide.js');
const G=context.JINPO_BOT_SITE_GUIDE;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function route(q){return G.respond(q,{});}
const cases=[
 ['トップページ開いて','home','/'],
 ['鎮魂府のページどこ','chinkon','/鎮魂符.html'],
 ['ランダムに決めるやつどこ','roulette','/ルーレット.html'],
 ['対戦表つくりたい','tournament','/トーナメント.html'],
 ['6人編成を探したい','jinpo','/陣法/jinpo.html'],
 ['英傑一欄見たい','heroes','/英傑一覧.html'],
 ['徒党の待ち合わせどこ','party','/shuugou.html'],
 ['自分のステ計算したい','stats','/能力計算機.html'],
 ['家臣のステ計算したい','retainer','/家臣計算機.html'],
 ['七星転成のページ','shichisei','/shichiseitensei.html'],
 ['食料計算したい','food','/shokuryou.html'],
 ['星界の荒石のページ','seikai','/seikai.html'],
 ['鬼神席のとこ出して','kishin','/鬼神石.html'],
 ['九十九を比較したい','tsukumo','/九十九.html'],
 ['魔導結品を比較したい','mado','/魔導結晶.html'],
 ['敵のカウンター表を見たい','counter','/counter.html'],
 ['倉庫拡張どっからいくん','okuraban','/okuraban.html'],
 ['天下統一奇談のページ','tenka_story','/tenka_story.html'],
 ['桶狭間のやつ見せて','okehazama','/okehazama.html'],
 ['富士地下の表どこ','fuji','/fuji.html'],
 ['本能寺のカウンター見たい','kyouto','/kyouto.html'],
 ['しずがたけのカウンターどこ','shizugatake','/shizugatake.html'],
 ['比英山のカウンター見たい','hieizan','/hieizan.html'],
 ['二條城の表を開いて','nijoujou','/nijoujou.html'],
 ['封印編のカウンター見たい','fuuin','/封印btn.html'],
 ['修羅間のカウンターどこ','shura','/shura.html'],
 ['武器大会のページどこ','tenka_taikai','/tenka_taikai.html'],
 ['武技大会の天のカウンター見たい','ten_mode','/ten_mode.html'],
 ['武技大会の地のカウンター見たい','chi_mode','/chi_mode.html'],
 ['トップの動画見たい','video','/'],
 ['信オン公式開いて','official','gamecity.ne.jp'],
 ['攻略wikiどこ','wiki','wiki.ohmynobu.net'],
 ['たいらのyoutube見たい','youtube','youtube.com']
];
cases.forEach(([q,id,urlPart])=>{
  const r=route(q),link=r.links&&r.links[0]&&r.links[0].url||'';
  let decoded=String(link);try{decoded=decodeURIComponent(decoded);}catch(e){}
  check('route '+q,!!r.handled&&r.data&&r.data.siteItem===id&&decoded.includes(urlPart),{id:r.data&&r.data.siteItem,answer:r.answer,link});
});
const rough=[
 ['英傑のやつどこで見んの','heroes'],
 ['陣法のとこ連れてって','jinpo'],
 ['家臣計算どっからいくん','retainer'],
 ['桶狭間のカウンター見たい','okehazama'],
 ['魔導結のページ開いて','mado']
];
rough.forEach(([q,id])=>{const r=route(q);check('rough '+q,r.handled&&r.data&&r.data.siteItem===id,{got:r.data&&r.data.siteItem,answer:r.answer});});
const factual=['鬼神石の使い方教えて','魔導結晶の入手は？','九十九1番の能力','黒田の成績','カウンター何番？','家臣の名前つけて'];
factual.forEach(q=>{const r=route(q);check('fact not hijacked '+q,!r.handled,r);});
const ambiguous=route('計算したい');
check('ambiguous calculator asks',ambiguous.handled&&ambiguous.data&&ambiguous.data.needsClarification===true,ambiguous);
const overview=route('このサイト何ができるの');
check('site overview',overview.handled&&overview.data&&overview.data.siteOverview===true,overview);
const current=route('ここ何ができるページ');
check('current page explanation',current.handled&&/トップページ/.test(current.answer||''),current);
check('catalog has all known entries',Array.isArray(G.items)&&G.items.length===34,G.items&&G.items.length);
console.log(`SITE GUIDE NATURAL: ${pass} / ${pass+fail} PASS`);
if(fail)process.exit(1);
