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
  'jinpo-bot-tairano-data.js','jinpo-bot-tairano-knowledge.js',
  'jinpo-bot-site-source-data.js','jinpo-bot-site-guide.js','jinpo-bot.js'
].forEach(load);
const D=global.JINPO_BOT_SITE_SOURCE_DATA,G=global.JINPO_BOT_SITE_GUIDE,B=global.JINPO_BOT;
let pass=0,fail=0;
function check(name,cond,detail){if(cond){pass++;return;}fail++;console.error('FAIL:',name,detail===undefined?'':detail);}
function meta(r){return {links:r.links||[],mode:r.mode||'',data:{siteGuide:!!(r.data&&r.data.siteGuide),siteItem:String(r.data&&r.data.siteItem||''),siteFeature:String(r.data&&r.data.siteFeature||''),candidates:r.data&&r.data.candidates||[],siteCandidates:r.data&&r.data.siteCandidates||[],needsClarification:!!(r.data&&r.data.needsClarification)}};}
function session(){const history=[];return{history,async ask(q){history.push({role:'user',text:q});const r=await B.handle({message:q,history:history.slice()});history.push({role:'assistant',text:String(r.answer||''),meta:meta(r)});return r;}};}
function guide(r,id,feature){return !!(r&&r.mode==='サイト総合案内'&&r.data&&r.data.siteGuide&&(!id||r.data.siteItem===id)&&(!feature||r.data.siteFeature===feature));}
(async()=>{
  check('source version',D&&D.version==='1.2.0',D&&D.version);
  check('source hash',D&&D.sourceSha256==='75cb2d4772528e876857ccb645fa572fb32401c4dc17017af3fb5db941b67af3',D&&D.sourceSha256);
  check('source archive count',D&&D.archiveFileCount===744,D&&D.archiveFileCount);
  check('source html count',D&&D.htmlFileCount===34,D&&D.htmlFileCount);
  check('guide source linked',G&&G.siteSourceVersion==='1.2.0',G&&G.siteSourceVersion);
  check('guide catalog includes meibutsu',G.items.some(x=>x.id==='meibutsu'&&x.path==='meibutsu.html'),G.items.map(x=>x.id));
  check('guide catalog count',G.items.length===34,G.items.length);

  const direct=[
    ['九十九って何個選べる？','tsukumo','selection_count',/8個/],
    ['鬼神石の一覧には何が載ってる？','kishin','columns',/鬼神の力.*入手/],
    ['魔導結晶って第3優先まである？','mado','sort',/第1・第2・第3/],
    ['英傑一覧はどんな項目が見れる？','heroes','columns',/因子1〜4.*固有技能名/],
    ['英傑一覧は200%に拡大できる？','heroes','zoom',/200%/],
    ['能力計算に鎮魂符反映できる？','stats','reflect',/鎮魂符の解放ステータス/],
    ['能力計算の九十九は何個選ぶの？','stats','selection_count',/8個/],
    ['家臣計算に九十九入れられる？','retainer','reflect',/九十九.*8個/],
    ['食料計算で安い順見れる？','food','sort',/最安ベスト10/],
    ['食料は町で絞れる？','food','filter',/町絞り込み解除/],
    ['食料計算は何を入力する？','food','inputs',/LV.*腹持ち要素.*時間/],
    ['星海の荒石は何種類？','seikai','categories',/7種類/],
    ['鎮魂符はどこの部位を登録する？','chinkon','categories',/頭・胴・左・腕・首・腰・右・足/],
    ['鎮魂符の画面保存できる？','chinkon','save',/画像として保存/],
    ['ルーレットの当選履歴は戻せる？','roulette','history',/個別.*全員戻す/],
    ['ルーレットは音消せる？','roulette','categories',/音と紙吹雪/],
    ['トーナメントは団体戦できる？','tournament','types',/シングル団体.*ダブル団体/],
    ['トーナメントの開催時間は設定できる？','tournament','schedule',/開始時刻.*終了時刻/],
    ['トーナメントは参加者をシャッフルできる？','tournament','random',/シャッフル/],
    ['徒党登録は何人まで？','party','entry',/最大10人/],
    ['徒党予定は複数の日を出せる？','party','schedule',/複数の候補日/],
    ['徒党予定のURL共有できる？','party','share',/URLコピー/],
    ['御蔵番から名物見れる？','meibutsu','related',/御蔵番ページ.*名物/],
    ['名物一覧はどこに戻る？','meibutsu','back',/御蔵番ページ/],
    ['カウンターの分類は何がある？','counter','categories',/3分類/],
    ['天下統一奇譚は何か所ある？','tenka_story','categories',/7つ/],
    ['天下武技大会は何種類？','tenka_taikai','categories',/天.*地/],
    ['陣法の共有方法は？','jinpo','share',/共有URL生成.*JSON出力.*JSON読込/],
    ['陣法のマスター差し替えってある？','jinpo','advanced',/英傑マスター.*因縁マスター.*formations_master/],
    ['七星転生は入力して計算するの？','shichisei','inputs',/計算フォームはありません/],
    ['トップの動画はランダム？','video','random',/10%/],
    ['左上のダウンロードはいつ出る？','home','download',/test\.xlsx/]
  ];
  for(const [q,id,feature,re] of direct){const r=await session().ask(q);check('feature '+q,guide(r,id,feature)&&re.test(r.answer||''),r);}

  let s=session(),r=await s.ask('九十九って何個選べる？');
  check('follow base',guide(r,'tsukumo','selection_count'),r);
  r=await s.ask('じゃあ鬼神石は？');
  check('follow kishin same intent',guide(r,'kishin','selection_count')&&/8個/.test(r.answer||''),r);
  r=await s.ask('魔導結晶だと？');
  check('follow mado same intent',guide(r,'mado','selection_count')&&/8個/.test(r.answer||''),r);

  s=session();r=await s.ask('御蔵番のページ見たい');
  check('okuraban open',guide(r,'okuraban'),r);
  r=await s.ask('その次どこ');
  check('okuraban child meibutsu',r&&r.data&&r.data.needsClarification===true&&r.data.candidates[0]==='meibutsu',r);
  r=await s.ask('それ');
  check('single candidate deictic is not guessed',r&&r.data&&r.data.needsClarification===true,r);
  r=await s.ask('名物');
  check('choose meibutsu',guide(r,'meibutsu'),r);

  r=await session().ask('鬼神石1番の入手は？');
  check('tool exact fact remains tool knowledge',r&&r.mode==='たいらの野望ツール実データ'&&!r.data.siteFeature,r);
  r=await session().ask('足利義昭のカウンターは？');
  check('counter exact fact remains counter knowledge',r&&r.mode==='たいらの野望専用知識'&&/157/.test(r.answer||''),r);
  r=await session().ask('黒田の家族は？');
  check('carp remains carp',r&&r.mode!=='サイト総合案内',r);
  r=await session().ask('親戚の話');
  check('ordinary word not kishin typo',r&&!(r.data&&r.data.siteGuide),r);

  console.log(`SITE SOURCE KNOWLEDGE: ${pass} / ${pass+fail} PASS`);
  if(fail)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1);});
