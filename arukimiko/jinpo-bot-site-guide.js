/*
 * 歩き巫女 サイト総合案内 v3.30.0
 *
 * - たいらの野望トップページと、カウンター配下の現行ページを案内する。
 * - ページ名の誤字・脱字・かな入力・ラフな目的表現を会話側の共通正規化と連携して扱う。
 * - 「そのページ」「家臣の方」「天の方」など、直前案内を受けた省略会話にも対応する。
 * - 数値やゲーム仕様は推測せず、「どのページで何ができるか」「画面をどう使うか」だけを担当する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_SITE_GUIDE)return;
  var VERSION='3.30.0';

  function S(v){var s=String(v==null?'':v);try{s=s.normalize('NFKC');}catch(e){}return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();}
  function normalizeInput(v){
    var text=S(v);
    try{
      var c=window.JINPO_BOT_CONVERSATION;
      if(c&&typeof c.normalizeCasualInput==='function'){var a=c.normalizeCasualInput(text);if(a&&a.text)text=String(a.text);}
      if(c&&typeof c.normalizeKanaInput==='function'){var k=c.normalizeKanaInput(text);if(k&&k.text)text=String(k.text);}
      if(c&&typeof c.normalizeKnownInput==='function'){var n=c.normalizeKnownInput(text);if(n&&n.text)text=String(n.text);}
    }catch(e){}
    return S(text);
  }
  function compact(v){return normalizeInput(v).toLowerCase().replace(/[\s、。,.!！?？「」『』【】（）()・ー―〜~:：;；\[\]［］]/g,'');}
  function rootUrl(){try{return new URL('/',location.href).href;}catch(e){return'/';}}
  function abs(path){try{return new URL(path||'',rootUrl()).href;}catch(e){return path||'/';}}
  function link(label,path,external){return {label:label,url:external?path:abs(path)};}

  var ITEMS=[
    {id:'home',name:'トップページ',path:'',category:'home',aliases:['トップ','ホーム','トップページ','最初のページ','たいらの野望トップ'],desc:'たいらの野望の各ツールへの入口です。'},

    {id:'chinkon',name:'鎮魂符',path:'鎮魂符.html',category:'tool',aliases:['鎮魂符','鎮魂符ツール','ちんこんふ'],purposes:['鎮魂符を確認','鎮魂符を見る'],desc:'鎮魂符に関する確認用ページです。'},
    {id:'roulette',name:'ルーレット',path:'ルーレット.html',category:'utility',aliases:['ルーレット','抽選ルーレット'],purposes:['ランダムに決める','抽選する'],desc:'候補をルーレットで決めるページです。'},
    {id:'tournament',name:'トーナメント',path:'トーナメント.html',category:'utility',aliases:['トーナメント','勝ち抜き表','対戦表'],purposes:['トーナメントを作る','対戦表を作る'],desc:'トーナメント形式の組み合わせを扱うページです。'},
    {id:'jinpo',name:'陣法検索',path:'陣法/jinpo.html',category:'jinpo',aliases:['陣法','陣法検索','因縁検索','英傑組み合わせ','組み合わせ検索','6人編成','六人編成','編成検索','じんぽう','じんぽ'],purposes:['6人の英傑を探す','因縁数で探す','陣形から探す','能力が高い編成を探す','英傑を配置して検索する'],desc:'6人の英傑編成を、陣形・因縁数・ステータス・配置英傑・除外英傑・全MAX条件などから検索するページです。'},
    {id:'heroes',name:'英傑一覧',path:'英傑一覧.html',category:'database',aliases:['英傑一覧','英傑リスト','英傑名簿','英傑データ','英傑表'],purposes:['英傑の能力を見る','英傑の因子を見る','英傑の職業を見る','英傑のコストを見る','英傑を一覧で見る'],desc:'英傑の名前・能力・因子・職業・コストなどを一覧で確認するページです。'},
    {id:'party',name:'徒党登録',path:'shuugou.html',category:'community',aliases:['徒党登録','徒党予定','徒党集合','徒党募集','集合','待ち合わせ','予定表'],purposes:['徒党を登録する','徒党で集合する','待ち合わせをする'],desc:'徒党の登録・集合・待ち合わせに使うページです。'},
    {id:'stats',name:'能力計算',path:'能力計算機.html',category:'calculator',aliases:['能力計算','能力計算機','ステータス計算','能力値計算','ステ計算','キャラ能力計算'],purposes:['能力値を計算する','ステータスを計算する','装備込みの能力を確認する'],desc:'プレイヤー側の能力値を入力して計算・確認するページです。'},
    {id:'retainer',name:'家臣計算機',path:'家臣計算機.html',category:'calculator',aliases:['家臣計算','家臣計算機','家臣能力計算','家臣ステータス','家臣ステ計算'],purposes:['家臣の能力を計算する','家臣のステータスを確認する'],desc:'家臣の能力・ステータスを計算するページです。'},
    {id:'shichisei',name:'七星転生',path:'shichiseitensei.html',category:'calculator',aliases:['七星転生','七星','転生計算','七星転生計算'],purposes:['七星転生を計算する','転生後を確認する'],desc:'七星転生に関する計算・確認用ページです。'},
    {id:'food',name:'食料',path:'shokuryou.html',category:'calculator',aliases:['食料','食料計算','食料計算機','兵糧'],purposes:['食料を計算する','必要な食料を確認する'],desc:'食料に関する計算・確認用ページです。'},
    {id:'seikai',name:'星海の荒石',path:'seikai.html',category:'tool',aliases:['星海の荒石','荒石','星海','星海荒石','輝光','星光','微光','輝光合成'],purposes:['星海の荒石を確認する','荒石を見る','輝光の合成を見る'],desc:'星海の荒石に関する情報を確認するページです。'},
    {id:'kishin',name:'鬼神石',path:'鬼神石.html',category:'tool',aliases:['鬼神石','鬼神石計算','鬼神石ツール','鬼神石一覧'],purposes:['鬼神石を選ぶ','鬼神石を比較する','鬼神石の合計を出す','鬼神石の合成最低発現数を見る'],desc:'鬼神石を一覧から選び、能力合計・並べ替え・合成最低発現数などを確認するページです。'},
    {id:'tsukumo',name:'九十九',path:'九十九.html',category:'tool',aliases:['九十九','九十九ツール','九十九計算','九十九の力','つくも'],purposes:['九十九を選ぶ','九十九を比較する','九十九の合計を出す','九十九の入手を調べる'],desc:'九十九の力を一覧から選び、能力・入手・合計などを確認するページです。'},
    {id:'mado',name:'魔導結晶',path:'魔導結晶.html',category:'tool',aliases:['魔導結晶','魔導','魔導結晶計算','魔導結晶ツール'],purposes:['魔導結晶を選ぶ','魔導結晶を比較する','魔導結晶の合計を出す','魔導結晶の入手を調べる'],desc:'魔導結晶を一覧から選び、能力・入手・合計などを確認するページです。'},
    {id:'counter',name:'カウンター',path:'counter.html',category:'counter',aliases:['カウンター','カウンター表','敵カウンター','敵の数値','カウンターメニュー'],purposes:['カウンター表を見る','敵のカウンターを確認する','天下統一奇譚の表を選ぶ','修羅の間の表を見る','天下武技大会の表を選ぶ'],desc:'天下統一奇譚・修羅の間・天下武技大会のカウンター表へ進むメニューページです。'},
    {id:'okuraban',name:'御蔵番拡張',path:'okuraban.html',category:'tool',aliases:['御蔵番拡張','御蔵番','蔵拡張','倉庫拡張','御蔵拡張'],purposes:['御蔵番を拡張する','蔵の拡張を確認する'],desc:'御蔵番拡張に関する確認用ページです。'},
    {id:'meibutsu',name:'名物一覧',path:'meibutsu.html',category:'tool',parent:'okuraban',aliases:['名物','名物一覧','名物表','御蔵番の名物','おくらばんの名物'],purposes:['名物を見る','名物一覧を確認する'],desc:'御蔵番拡張に関連する名物一覧を確認するページです。'},

    {id:'tenka_story',name:'天下統一奇譚カウンター',path:'tenka_story.html',category:'counter',parent:'counter',aliases:['天下統一奇譚','天下統一奇譚カウンター','天下統一','奇譚カウンター'],purposes:['天下統一奇譚の場所を選ぶ'],desc:'桶狭間・富士地下洞穴・京都・賤ヶ岳・比叡山・二条城・封印の各カウンター表を選ぶページです。'},
    {id:'okehazama',name:'天下統一奇譚・桶狭間',path:'okehazama.html',category:'counter_detail',parent:'tenka_story',aliases:['桶狭間','桶狭間編','駿府城の桶狭間'],purposes:['桶狭間のカウンターを見る'],desc:'天下統一奇譚・桶狭間のカウンター表です。'},
    {id:'fuji',name:'天下統一奇譚・富士地下洞穴',path:'fuji.html',category:'counter_detail',parent:'tenka_story',aliases:['富士地下洞穴','富士地下','富士編','富士地下洞窟'],purposes:['富士地下洞穴のカウンターを見る'],desc:'天下統一奇譚・富士地下洞穴のカウンター表です。'},
    {id:'kyouto',name:'天下統一奇譚・京都',path:'kyouto.html',category:'counter_detail',parent:'tenka_story',aliases:['京都編','天下統一京都','京都カウンター','本能寺'],purposes:['京都のカウンターを見る','本能寺のカウンターを見る'],desc:'天下統一奇譚・京都（本能寺）のカウンター表です。'},
    {id:'shizugatake',name:'天下統一奇譚・賤ヶ岳',path:'shizugatake.html',category:'counter_detail',parent:'tenka_story',aliases:['賤ヶ岳','賤ヶ岳編','しずがたけ'],purposes:['賤ヶ岳のカウンターを見る'],desc:'天下統一奇譚・賤ヶ岳のカウンター表です。'},
    {id:'hieizan',name:'天下統一奇譚・比叡山',path:'hieizan.html',category:'counter_detail',parent:'tenka_story',aliases:['比叡山','比叡山編'],purposes:['比叡山のカウンターを見る'],desc:'天下統一奇譚・比叡山のカウンター表です。'},
    {id:'nijoujou',name:'天下統一奇譚・二条城',path:'nijoujou.html',category:'counter_detail',parent:'tenka_story',aliases:['二条城','二条城編','二條城'],purposes:['二条城のカウンターを見る'],desc:'天下統一奇譚・二条城のカウンター表です。'},
    {id:'fuuin',name:'天下統一奇譚・封印',path:'封印btn.html',category:'counter_detail',parent:'tenka_story',aliases:['封印','封印編','天下統一封印'],purposes:['封印のカウンターを見る'],desc:'天下統一奇譚・封印のカウンター表です。'},
    {id:'shura',name:'修羅の間',path:'shura.html',category:'counter_detail',parent:'counter',aliases:['修羅の間','修羅','修羅カウンター'],purposes:['修羅の間のカウンターを見る'],desc:'修羅の間のカウンター表です。'},
    {id:'tenka_taikai',name:'天下武技大会カウンター',path:'tenka_taikai.html',category:'counter',parent:'counter',aliases:['天下武技大会','武技大会','天下武技大会カウンター'],purposes:['天下武技大会の天か地を選ぶ'],desc:'天下武技大会の「天」「地」のカウンター表を選ぶページです。'},
    {id:'ten_mode',name:'天下武技大会・天',path:'ten_mode.html',category:'counter_detail',parent:'tenka_taikai',aliases:['武技大会天','大会天','天下武技大会天','天のカウンター'],purposes:['天下武技大会の天を見る'],desc:'天下武技大会・天のカウンター表です。'},
    {id:'chi_mode',name:'天下武技大会・地',path:'chi_mode.html',category:'counter_detail',parent:'tenka_taikai',aliases:['武技大会地','大会地','天下武技大会地','地のカウンター'],purposes:['天下武技大会の地を見る'],desc:'天下武技大会・地のカウンター表です。'},

    {id:'video',name:'トップページの動画再生',path:'',category:'home_action',aliases:['動画再生','サイトの動画','トップの動画','ランダム動画'],purposes:['動画を再生する','サイトの動画を見る'],desc:'トップページにある「動画再生」ボタンから再生できます。'},
    {id:'official',name:'信長の野望Online公式サイト',path:'https://www.gamecity.ne.jp/nol/index.htm',external:true,category:'external',aliases:['信オン公式','公式サイト','信長の野望オンライン公式','ゲームシティ'],desc:'信長の野望Onlineの公式サイトです。'},
    {id:'wiki',name:'信長の野望Online攻略Wiki',path:'https://wiki.ohmynobu.net/nol/',external:true,category:'external',aliases:['信オンwiki','攻略wiki','wiki','ウィキ'],desc:'信長の野望Online攻略Wikiです。'},
    {id:'youtube',name:'たいらのYouTube',path:'https://www.youtube.com/@%E3%81%9F%E3%81%84%E3%82%89%E3%81%AEzzz',external:true,category:'external',aliases:['youtube','ユーチューブ','たいらのyoutube','たいらの動画','動画チャンネル'],desc:'たいらののYouTubeチャンネルです。'}
  ];

  var SOURCE=window.JINPO_BOT_SITE_SOURCE_DATA||{pages:{}};
  var SOURCE_PAGES=SOURCE&&SOURCE.pages||{};
  ITEMS.forEach(function(item){
    var page=SOURCE_PAGES[item.id];if(!page)return;
    if(page.path!==undefined)item.path=page.path;
    if(page.desc)item.desc=page.desc;
    item.sourceFeatures=Array.isArray(page.features)?page.features.slice():[];
  });

  var BY_ID={};ITEMS.forEach(function(x){BY_ID[x.id]=x;});
  var CHILDREN_BY_ID={
    counter:['tenka_story','shura','tenka_taikai'],
    okuraban:['meibutsu'],
    tenka_story:['okehazama','fuji','kyouto','shizugatake','hieizan','nijoujou','fuuin'],
    tenka_taikai:['ten_mode','chi_mode']
  };
  var USAGE_BY_ID={
    home:'目的に合う画像ボタンを押して各ページへ進みます。ページ名が分からない時は、やりたいことを歩き巫女へそのまま話してください。',
    chinkon:'装備部位の枠を選び、職業・レベル・技能などを設定します。選択内容と発動効果、合計は画面内の一覧で確認できます。やり直す時は解除・リセット系のボタンを使います。',
    roulette:'候補名を追加してルーレットを回します。当選した名前は履歴へ移り、「全員戻す」で候補へ戻せます。「履歴削除」は当選履歴だけを消します。',
    tournament:'大会を作成し、参加者またはチームを登録して組み合わせを作ります。登録後は対戦結果を入力しながら勝ち上がりを進めます。',
    jinpo:'陣形・因縁数・能力条件・配置英傑・除外英傑・全MAXなどを指定して検索します。おすすめ検索、検索結果の並べ替え、適用、差替候補の確認もできます。',
    heroes:'第1から第3までの優先項目を、ステータスまたは育成技能から選ぶと一覧を並べ替えられます。選択を戻す時は解除ボタンを使います。',
    party:'目的と説明を入力し、候補日と時間帯を選んで集合用の登録を作ります。参加側は共有された登録から都合を入力します。',
    stats:'基礎能力や装備などの数値を入力し、最終能力を確認します。九十九・魔導結晶・装飾石などは選択画面から該当欄へ反映できます。',
    retainer:'家臣の条件や装備、九十九などを選択して能力合計を確認します。項目ごとの選択・差替・除外を使いながら家臣の構成を計算します。',
    shichisei:'七星転生の案内を確認するページです。現在の画面では説明を見て、右下の戻るボタンからトップへ戻れます。',
    food:'必要な項目を入力して食料に関する量を計算・確認します。',
    seikai:'星海の荒石の候補や数値を一覧で確認します。',
    kishin:'鬼神石を一覧から選び、能力合計や並べ替え、合成時の最低発現数などを確認します。',
    tsukumo:'九十九の力を番号・名称・能力・入手で確認し、複数選択の合計や比較に使います。',
    mado:'魔導結晶を番号・名称・能力・入手で確認し、複数選択の合計や比較に使います。',
    counter:'「天下統一奇譚」「修羅の間」「天下武技大会」から見たい分類を選びます。',
    okuraban:'御蔵番拡張に関する条件や必要内容を確認します。',
    meibutsu:'御蔵番拡張に関連する名物の種類や合計を表で確認します。',
    tenka_story:'桶狭間・富士地下洞穴・京都・賤ヶ岳・比叡山・二条城・封印から場所を選びます。',
    okehazama:'表から敵名を探し、登録されたカウンター値を確認します。',
    fuji:'表から敵名を探し、登録されたカウンター値を確認します。',
    kyouto:'表から敵名を探し、登録されたカウンター値を確認します。',
    shizugatake:'表から敵名を探し、登録されたカウンター値を確認します。',
    hieizan:'表から敵名を探し、登録されたカウンター値を確認します。',
    nijoujou:'表から敵名を探し、登録されたカウンター値を確認します。',
    fuuin:'表から敵名を探し、登録されたカウンター値を確認します。',
    shura:'表から敵名を探し、登録されたカウンター値を確認します。',
    tenka_taikai:'「天」「地」から見たい大会表を選びます。',
    ten_mode:'表から敵名を探し、登録されたカウンター値を確認します。',
    chi_mode:'表から敵名を探し、登録されたカウンター値を確認します。',
    video:'トップページの「動画再生」画像を押すと、全画面で動画が再生されます。',
    official:'リンクを押すと信長の野望Online公式サイトを別タブで開きます。',
    wiki:'リンクを押すと攻略Wikiを別タブで開きます。',
    youtube:'リンクを押すとたいらののYouTubeチャンネルを別タブで開きます。'
  };

  function decodedPath(){try{return decodeURIComponent(location.pathname||'');}catch(e){return String(location.pathname||'');}}
  function pageMode(){
    if(window.JINPO_BOT_PAGE_MODE)return String(window.JINPO_BOT_PAGE_MODE);
    var p=decodedPath();if(p==='/'||/\/index\.html$/i.test(p))return'top';
    return /\/(?:陣法\/)?jinpo\.html$/i.test(p)?'jinpo':'site';
  }
  function currentItem(){
    var href=decodedPath();
    for(var i=0;i<ITEMS.length;i++){
      var item=ITEMS[i];if(item.external||item.id==='video')continue;
      if(item.id==='home'&&(href==='/'||/\/index\.html$/i.test(href)))return item;
      if(!item.path)continue;
      var p='/'+item.path.replace(/^\//,'');if(href===p||href.endsWith(p))return item;
    }
    return null;
  }
  function itemFromUrl(url){
    var u=S(url);if(!u)return null;var decoded=u;try{decoded=decodeURIComponent(u);}catch(e){}
    for(var i=0;i<ITEMS.length;i++){
      var item=ITEMS[i];
      if(item.external&&item.path&&decoded.indexOf(item.path)>=0)return item;
      if(item.id==='home'&&/\/$|\/index\.html(?:[?#]|$)/.test(decoded))return item;
      if(item.path&&decoded.indexOf('/'+item.path)>=0)return item;
    }
    return null;
  }
  function childrenOf(item){
    var ids=CHILDREN_BY_ID[item&&item.id]||[];
    return ids.map(function(id){return BY_ID[id];}).filter(Boolean);
  }
  function parentOf(item){return item&&item.parent?BY_ID[item.parent]||null:null;}

  function distance(a,b){
    try{var c=window.JINPO_BOT_CONVERSATION;if(c&&typeof c.knownTypoDistance==='function')return c.knownTypoDistance(a,b);}catch(e){}
    a=compact(a);b=compact(b);var n=a.length,m=b.length;if(!n)return m;if(!m)return n;
    var prev=new Array(m+1),cur=new Array(m+1),i,j;for(j=0;j<=m;j++)prev[j]=j;
    for(i=1;i<=n;i++){cur[0]=i;for(j=1;j<=m;j++){var cost=a.charAt(i-1)===b.charAt(j-1)?0:1;cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+cost);}var tmp=prev;prev=cur;cur=tmp;}return prev[m];
  }
  function bestApprox(text,alias){
    var t=compact(text),a=compact(alias);if(!t||!a||a.length<4)return null;
    var maxDist=a.length>=8?2:1,best=null,min=Math.max(3,a.length-maxDist),max=Math.min(t.length,a.length+maxDist);
    for(var len=min;len<=max;len++)for(var i=0;i+len<=t.length;i++){
      var sub=t.slice(i,i+len),d=distance(sub,a),score=1-d/Math.max(sub.length,a.length);
      if(d<=maxDist&&(!best||score>best.score||score===best.score&&d<best.distance))best={score:score,distance:d};
    }
    return best;
  }
  function itemScore(text,item){
    var t=normalizeInput(text),ct=compact(t),best=0,matched='';
    var aliases=[item.name].concat(item.aliases||[]).concat(item.purposes||[]);
    aliases.forEach(function(alias){
      var ca=compact(alias);if(!ca)return;
      if(ct===ca&&145+ca.length>best){best=145+ca.length;matched=alias;return;}
      if(ct.indexOf(ca)>=0&&95+Math.min(ca.length,30)>best){best=95+Math.min(ca.length,30);matched=alias;return;}
      if(ca.indexOf(ct)>=0&&ct.length>=4&&82+ct.length>best){best=82+ct.length;matched=alias;return;}
      var ap=bestApprox(t,alias);if(ap&&ap.score>=0.74){var score=65+Math.round(ap.score*20)-ap.distance;if(score>best){best=score;matched=alias;}}
    });
    return {score:best,matched:matched};
  }
  function rankedItems(text){
    var out=ITEMS.map(function(item){var s=itemScore(text,item);return {item:item,score:s.score,matched:s.matched};}).filter(function(x){return x.score>0;});
    out.sort(function(a,b){return b.score-a.score||String(a.item.name).length-String(b.item.name).length;});
    return out;
  }
  function findItemDetailed(text){
    var ranked=rankedItems(text);if(!ranked.length)return {item:null,score:0,candidates:[]};
    var best=ranked[0],near=ranked.filter(function(x){return x.item.id!==best.item.id&&best.score-x.score<5;}).slice(0,3);
    return {item:near.length&&best.score<100?null:best.item,score:best.score,matched:best.matched,candidates:[best].concat(near)};
  }
  function findItem(text){return findItemDetailed(text).item;}

  // 機能名だけ・用語だけを送られた時に、汎用の理解不能へ落とさず、
  // その用語の範囲内で次に必要な情報を聞き返す。
  // 個別の数値・人物・条件が書かれている質問は従来の専門ルーターへ渡す。
  function bareTermCore(text){
    var t=S(text);
    if(!t||t.length>48)return'';
    t=t.replace(/^(?:ねえ|ねぇ|あの|えっと|じゃあ|では|それじゃ|それなら)[、,\s]*/,'')
      .replace(/[？?！!。．.]+$/g,'').trim();
    var prev='';
    while(prev!==t){
      prev=t;
      t=t.replace(/(?:を)?(?:教えて|おしえて|知りたい|説明して|説明してほしい|お願い|おねがい)$/,'').trim();
      t=t.replace(/(?:について|のこと)$/,'').trim();
      t=t.replace(/(?:って何|ってなに|とは何|とはなに|って|とは|は)$/,'').trim();
    }
    return t;
  }
  function bareTermKey(v){
    var t=S(v).toLowerCase().replace(/[ぁ-ゖ]/g,function(ch){return String.fromCharCode(ch.charCodeAt(0)+96);});
    return t.replace(/[\s、。,.!！?？「」『』【】（）()・―〜~:：;；\[\]［］]/g,'');
  }
  function bareVirtualTerm(core){
    var raw=bareTermKey(core),normalized=bareTermKey(normalizeInput(core)),keys=[raw];
    if(normalized&&keys.indexOf(normalized)<0)keys.push(normalized);
    var rows=[
      {key:'site',terms:['たいらの野望','たいらのサイト'],item:'home'},
      {key:'hero',terms:['英傑'],item:'heroes'},
      {key:'formation',terms:['陣形'],item:'jinpo'},
      {key:'bond',terms:['因縁','発動因縁'],item:'jinpo'},
      {key:'kenbun',terms:['見聞録'],item:'jinpo'},
      {key:'bunkyoku',terms:['文曲','文曲除外'],item:'jinpo'},
      {key:'allmax',terms:['全max','フルmax','全部max'],item:'jinpo'},
      {key:'placement',terms:['配置英傑','除外英傑','差替候補','差し替え候補'],item:'jinpo'}
    ];
    for(var i=0;i<rows.length;i++){
      for(var j=0;j<rows[i].terms.length;j++){
        if(keys.indexOf(bareTermKey(rows[i].terms[j]))>=0)return {key:rows[i].key,item:BY_ID[rows[i].item],term:rows[i].terms[j],inputTerm:core,virtual:true};
      }
    }
    return null;
  }
  function wholeTermMatch(core,item){
    var rawKey=bareTermKey(core),normalized=normalizeInput(core),normalizedKey=bareTermKey(normalized);
    var aliases=[item.name].concat(item.aliases||[]),best=null;
    for(var i=0;i<aliases.length;i++){
      var alias=aliases[i],key=bareTermKey(alias);if(!key)continue;
      if(rawKey===key||normalizedKey===key)return {exact:true,alias:alias,distance:0};
      var source=rawKey.length<=normalizedKey.length?rawKey:normalizedKey;
      var d=distance(source,key),maxDist=key.length>=8?2:1,ratio=1-d/Math.max(source.length,key.length);
      if(d<=maxDist&&ratio>=0.78&&(!best||d<best.distance||d===best.distance&&ratio>best.ratio))best={exact:false,alias:alias,distance:d,ratio:ratio};
    }
    return best;
  }
  function bareKnownTerm(text){
    var core=bareTermCore(text);if(!core)return null;
    var virtual=bareVirtualTerm(core);if(virtual)return virtual;
    var best=null;
    for(var i=0;i<ITEMS.length;i++){
      var match=wholeTermMatch(core,ITEMS[i]);if(!match)continue;
      if(match.exact)return {key:'item',item:ITEMS[i],term:core,matched:match.alias||'',virtual:false,approximate:false};
      if(!best||match.distance<best.match.distance||match.distance===best.match.distance&&match.ratio>best.match.ratio)best={item:ITEMS[i],match:match};
    }
    if(!best)return null;
    return {key:'item',item:best.item,term:core,matched:best.match.alias||'',virtual:false,approximate:true};
  }
  function incompletePagePossessive(text){
    var t=normalizeInput(text).replace(/[？?！!。．.]+$/g,'').trim();
    if(!/の$/.test(t))return null;
    var core=t.replace(/の$/,'').trim(),best=null;
    for(var i=0;i<ITEMS.length;i++){
      var item=ITEMS[i],aliases=[item.name].concat(item.aliases||[]);
      for(var j=0;j<aliases.length;j++){
        if(bareTermKey(core)===bareTermKey(aliases[j])){
          if(!best||bareTermKey(aliases[j]).length>best.length)best={item:item,matched:aliases[j],length:bareTermKey(aliases[j]).length};
        }
      }
    }
    return best;
  }
  function acknowledgementOnly(text){
    var t=normalizeInput(text);
    return /^(?:なるほど(?:ね|です)?|そうなんだ|そうか|了解(?:です|しました)?|わかった|分かった|わかりました|分かりました|おけ|オッケー|OK|ありがとう|ありがと|うん|はい|へえ|ふーん|ほう)[。！!？?～〜]*$/i.test(t);
  }
  function relevantKnownTermContinuation(ctx,entry){
    var c=ctx||{},x=entry||{},meta=x.meta||{},data=meta.data||{},mode=S(meta.mode||''),item=c.knownTermItem||null,key=String(c.termKey||'item');
    if(x.role!=='assistant')return false;
    if(data.conversationRepair||data.contextBoundary||data.topicSwitch)return false;
    if(/^(?:formation|bond|kenbun|bunkyoku|allmax|placement)$/.test(key)){
      return !!data.jinpoContinuation||data.siteItem==='jinpo'||/陣法|検索/.test(mode)||/「陣法検索」で扱えます/.test(S(x.text));
    }
    if(item&&item.id==='heroes')return !!data.heroKnowledge||/^英傑/.test(mode);
    if(item&&(item.id==='tsukumo'||item.id==='mado'||item.id==='kishin')){
      return !!data.toolKnowledge||/たいらの野望ツール実データ/.test(mode)||S(x.text).indexOf(item.name)>=0;
    }
    if(item){
      if(data.siteItem===item.id)return true;
      var children=CHILDREN_BY_ID[item.id]||[];
      if(children.indexOf(String(data.siteItem||''))>=0)return true;
    }
    return false;
  }
  function knownTermContextFresh(history,ctx){
    var h=Array.isArray(history)?history:[],c=ctx||{},idx=Number(c.knownTermIndex);
    if(!c.knownTermGuidance||idx<0)return false;
    if(idx>=Math.max(0,h.length-3))return true;
    var between=h.slice(idx+1,Math.max(idx+1,h.length-1));
    if(between.length===2&&between[0]&&between[0].role==='user'&&between[1]&&between[1].role==='assistant'){
      if(!acknowledgementOnly(between[0].text))return false;
      var ackMeta=between[1].meta||{};
      return !ackMeta.data||!ackMeta.data.siteGuide;
    }
    // 用語案内→実質的な質問→回答→相づち→相づち回答→次の変更、までを1回だけ保持する。
    // 回答が元の用語に対応した専門回答であることを確認し、別話題を挟んだ場合は保持しない。
    if(between.length===4&&between[0]&&between[0].role==='user'&&between[1]&&between[1].role==='assistant'&&between[2]&&between[2].role==='user'&&between[3]&&between[3].role==='assistant'){
      if(!relevantKnownTermContinuation(c,between[1])||!acknowledgementOnly(between[2].text))return false;
      var followAckMeta=between[3].meta||{};
      return !followAckMeta.data||!followAckMeta.data.siteGuide;
    }
    return false;
  }
  function pageContextFresh(history,ctx){
    var h=Array.isArray(history)?history:[],c=ctx||{},idx=Number(c.index);
    if(!c.item||idx<0)return false;
    if(idx>=Math.max(0,h.length-3))return true;
    var between=h.slice(idx+1,Math.max(idx+1,h.length-1));
    if(between.length!==2||!between[0]||between[0].role!=='user'||!between[1]||between[1].role!=='assistant')return false;
    if(!acknowledgementOnly(between[0].text))return false;
    var meta=between[1].meta||{};
    return !meta.data||!meta.data.siteGuide;
  }
  function pageInternalChoice(item,text){
    var t=normalizeInput(text);if(!item||!t)return null;
    if(item.id==='seikai'){
      var stoneCorrection=t.match(/(?:武曲|禄存|破軍|文曲|廉貞|巨門|貪狼).*(?:じゃなくて|ではなくて|じゃなく|ではなく|違って)[、,\s]*(武曲|禄存|破軍|文曲|廉貞|巨門|貪狼)/);
      var stone=stoneCorrection||t.match(/^(?:じゃあ|では|それなら|やっぱり|やはり|いや|違う|訂正|それじゃなくて|それではなくて|そっちじゃなくて|そちらではなくて)?[、,\s]*(武曲|禄存|破軍|文曲|廉貞|巨門|貪狼)(?:の方|のほう|を|がいい|を見たい|を見せて|を開いて|を選びたい|にして|について)?[。！!？?]*$/);
      if(stone)return {message:'星海の荒石 '+stone[1]+'を見たい',reason:'seikai_selection'};
    }
    if(item.id==='chinkon'){
      var partCorrection=t.match(/(?:頭|胴|左|腕|首|腰|右|足).*(?:じゃなくて|ではなくて|じゃなく|ではなく|違って)[、,\s]*(頭|胴|左|腕|首|腰|右|足)/);
      var part=partCorrection||t.match(/^(?:じゃあ|では|それなら|やっぱり|やはり|いや|違う|訂正|それじゃなくて|それではなくて|そっちじゃなくて|そちらではなくて)?[、,\s]*(頭|胴|左|腕|首|腰|右|足)(?:の枠|の部位|を|がいい|を設定したい|を登録したい|を選びたい|を見たい|にして|について)?[。！!？?]*$/);
      if(part)return {message:'鎮魂符 '+part[1]+'を設定したい',reason:'chinkon_part'};
    }
    return null;
  }
  function latestContinuationData(history,afterIndex){
    var h=Array.isArray(history)?history:[],min=Number(afterIndex)||-1;
    for(var i=h.length-1;i>min;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var data=x.meta&&x.meta.data||{};
      if(data.conversationRepair||data.contextBoundary||data.topicSwitch)return null;
      if(data.contextMessage||data.resolutionReason||data.jinpoContinuation){
        return {message:S(data.contextMessage||''),reason:S(data.resolutionReason||''),index:i};
      }
    }
    return null;
  }
  function latestHeroKnowledgeData(history,afterIndex){
    var h=Array.isArray(history)?history:[],min=Number(afterIndex)||-1;
    for(var i=h.length-1;i>min;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var data=x.meta&&x.meta.data||{};
      if(data.conversationRepair||data.contextBoundary||data.topicSwitch)return null;
      if(data.heroKnowledge)return data;
    }
    return null;
  }
  function continuationHero(contextMessage,reason){
    var m=S(contextMessage),r=S(reason),hit=null;
    if(r==='placement_context')hit=m.match(/^(.+?)を(?:入れて探して|使って探して|必ず入れて)$/);
    else if(r==='exclusion_context')hit=m.match(/^(.+?)(?:を除外して|の除外を解除)$/);
    if(!hit)return '';
    return S(hit[1]).replace(/^(?:じゃあ|では|次は|今度は|追加で|もう一人は|もう1人は)[、,\s]*/,'');
  }
  function latestKnownTermClarification(history){
    var h=Array.isArray(history)?history:[],i=h.length-2;
    if(i<0||!h[i]||h[i].role!=='assistant')return null;
    var data=h[i].meta&&h[i].meta.data||{};
    if(!data.knownTermClarification)return null;
    return {
      reason:S(data.clarificationReason||data.reason||''),
      siteItem:S(data.siteItem||'jinpo'),
      termKey:S(data.termKey||'placement'),
      normalizedTerm:S(data.normalizedTerm||''),
      pendingHero:S(data.pendingHero||''),
      index:i
    };
  }
  function clarificationHeroName(text){
    var t=normalizeInput(text).replace(/[？?。！!]+$/g,'').trim();
    t=t.replace(/^(?:じゃあ|では|それなら|なら|次は|今度は|追加で|もう一人は|もう1人は|先に|まず|最初は|最初に)[、,\s]*/,'');
    t=t.replace(/(?:も|を|は)?(?:入れて探して|使って探して|必ず入れて|入れて|加えて|配置して|除外して|外して|抜いて|候補から外して|除外から戻して|除外を解除して|除外を解除|戻して|取り消して)$/,'');
    t=t.replace(/(?:は)?(?:使う|使いたい)$/,'');
    t=t.replace(/(?:を先に|から|でお願いします|をお願いします|お願いします|お願い|にして|でいい|がいい|で)$/,'').trim();
    if(!t||/^(?:それ|その人|その英傑|こっち|そっち|配置|除外|英傑)$/.test(t))return '';
    var rows=window.JINPO_BOT_HERO_DATA&&Array.isArray(window.JINPO_BOT_HERO_DATA.rows)?window.JINPO_BOT_HERO_DATA.rows:[];
    for(var i=0;i<rows.length;i++)if(S(rows[i]&&rows[i][1])===t)return t;
    return '';
  }
  function clarificationResult(pending,message,reason){
    return {message:String(message||''),siteItem:String(pending.siteItem||'jinpo'),reason:String(reason||pending.reason||'known_term_clarification_followup'),preferKnowledge:false,jinpoOperation:true,termKey:String(pending.termKey||'placement'),normalizedTerm:String(pending.normalizedTerm||'')};
  }
  function repeatClarification(pending,answer,reason,hero){
    return {clarification:String(answer||''),siteItem:String(pending.siteItem||'jinpo'),reason:String(reason||pending.reason||''),termKey:String(pending.termKey||'placement'),normalizedTerm:String(pending.normalizedTerm||''),pendingHero:String(hero||pending.pendingHero||'')};
  }
  function latestImmediateJinpoContinuation(history){
    var h=Array.isArray(history)?history:[];
    function fromAssistant(index){
      if(index<0||!h[index]||h[index].role!=='assistant')return null;
      var data=h[index].meta&&h[index].meta.data||{};
      if(data.conversationRepair||data.contextBoundary||data.topicSwitch)return null;
      var reason=S(data.resolutionReason||''),message=S(data.contextMessage||'');
      if((data.jinpoContinuation||data.siteItem==='jinpo')&&reason&&message)return {reason:reason,message:message,index:index};
      return null;
    }
    var direct=fromAssistant(h.length-2);if(direct)return direct;
    if(h.length>=4&&h[h.length-3]&&h[h.length-3].role==='user'&&acknowledgementOnly(h[h.length-3].text)){
      var ackAssistant=h[h.length-2],ackData=ackAssistant&&ackAssistant.meta&&ackAssistant.meta.data||{};
      if(ackAssistant&&ackAssistant.role==='assistant'&&(!ackData||!ackData.siteGuide&&!ackData.heroKnowledge&&!ackData.jinpoContinuation))return fromAssistant(h.length-4);
    }
    return null;
  }
  function resolveImmediateJinpoContinuation(text,continuation){
    if(!continuation||!continuation.reason||!continuation.message)return null;
    var t=normalizeInput(text).replace(/[？?。！!]+$/g,'').trim();
    var hasCue=/^(?:じゃあ|では|それなら|次は|今度は|追加で|もう一人は|もう1人は)[、,\s]*/.test(t);
    var hero=clarificationHeroName(t);if(!hero)return null;
    if(continuation.reason==='placement_context'&&/を(?:入れて探して|使って探して|必ず入れて)$/.test(continuation.message)){
      if(hasCue||/(?:入れて|加えて|配置して)$/.test(t))return clarificationResult({siteItem:'jinpo',termKey:'placement',normalizedTerm:'配置英傑'},hero+'を入れて探して','placement_context');
    }
    if(continuation.reason==='exclusion_context'&&/を除外して$/.test(continuation.message)){
      if(hasCue||/(?:除外して|外して|抜いて)$/.test(t))return clarificationResult({siteItem:'jinpo',termKey:'placement',normalizedTerm:'除外英傑'},hero+'を除外して','exclusion_context');
    }
    if(continuation.reason==='exclusion_context'&&/の除外を解除$/.test(continuation.message)){
      if(hasCue||/(?:戻して|解除して|使う|使いたい)$/.test(t))return clarificationResult({siteItem:'jinpo',termKey:'placement',normalizedTerm:'除外英傑'},hero+'の除外を解除','exclusion_context');
    }
    return null;
  }
  function resolveKnownTermClarification(text,pending){
    if(!pending||!pending.reason)return null;
    var t=normalizeInput(text).replace(/[？?。！!]+$/g,'').trim(),hero='';
    if(!t||acknowledgementOnly(t))return null;

    if(pending.reason==='placement_multiple_clarification'){
      if(/(?:と|、|,).*(?:入れて|加えて|配置)/.test(t))return repeatClarification(pending,'配置英傑は1人ずつ追加します。先に配置する英傑を1人だけ教えてください。');
      hero=clarificationHeroName(t);
      if(hero)return clarificationResult(pending,hero+'を入れて探して','placement_context');
      return null;
    }
    if(pending.reason==='exclusion_multiple_clarification'){
      if(/(?:と|、|,).*(?:外して|抜いて|除外)/.test(t))return repeatClarification(pending,'除外英傑は1人ずつ追加します。先に除外する英傑を1人だけ教えてください。');
      hero=clarificationHeroName(t);
      if(hero)return clarificationResult(pending,hero+'を除外して','exclusion_context');
      return null;
    }
    if(pending.reason==='exclusion_restore_clarification'){
      hero=clarificationHeroName(t);
      if(hero)return clarificationResult(pending,hero+'の除外を解除','exclusion_context');
      return null;
    }
    if(pending.reason==='placement_remove_clarification'){
      var slot=t.match(/^(?:じゃあ|では|それなら|配置(?:英傑)?|枠)?[、,\s]*([1-3１-３])(?:番|番目|枠)?(?:を)?(?:解除|外して|戻して|取り消して)?$/);
      if(slot)return clarificationResult(pending,'配置英傑'+numberValue(slot[1])+'を解除','placement_context');
      if(/(?:除外|候補から外|検索候補から外)/.test(t)){
        hero=clarificationHeroName(t)||pending.pendingHero;
        if(hero)return clarificationResult(pending,hero+'を除外して','exclusion_context');
        return repeatClarification(pending,'候補から除外する英傑の名前を教えてください。','exclusion_multiple_clarification','');
      }
      if(/(?:配置|固定).*(?:外|解除|戻|取り消)|^(?:配置から外して|配置だけ外して|配置を解除|配置条件から外して)$/.test(t)){
        return repeatClarification(pending,'配置英傑1〜3のどの枠を解除するか教えてください。たとえば「配置英傑1を解除」のように指定してください。','placement_remove_clarification',pending.pendingHero);
      }
      return null;
    }
    return null;
  }
  function expandKnownTermFollowup(text,history){
    var h=Array.isArray(history)?history:[],ctx=historyGuideContext(h),recentItem=ctx.item,item=ctx.knownTermItem||recentItem,t=normalizeInput(text);
    var key=String(ctx.termKey||'item'),term=S(ctx.normalizedTerm||item&&item.name||'');
    var recentContinuation=latestContinuationData(h,ctx.knownTermIndex),recentHeroKnowledge=latestHeroKnowledgeData(h,ctx.knownTermIndex);
    if(!t)return null;
    if(acknowledgementOnly(t))return null;

    // 歩き巫女が聞き直した直後の回答は、元の配置・除外操作へ1回だけ戻す。
    // 聞き直し以外の会話へは持ち越さず、無関係な人物質問や日常会話を拘束しない。
    var pendingClarification=latestKnownTermClarification(h);
    var clarificationFollowup=resolveKnownTermClarification(t,pendingClarification);
    if(clarificationFollowup)return clarificationFollowup;

    // 直前の配置・除外実行後に「次は」「もう一人は」と続けた場合だけ、
    // 同じ操作をもう1人へ引き継ぐ。裸の人物名は英傑紹介との区別がつかないため補完しない。
    var immediateContinuation=latestImmediateJinpoContinuation(h);
    var immediateFollowup=resolveImmediateJinpoContinuation(t,immediateContinuation);
    if(immediateFollowup)return immediateFollowup;

    function reply(message,reason,preferKnowledge){
      var jinpoOperation=/^(?:formation|bond|kenbun|bunkyoku|allmax|placement)$/.test(key);
      return {message:String(message||''),siteItem:item.id,reason:String(reason||'known_term_followup'),preferKnowledge:!!preferKnowledge,jinpoOperation:jinpoOperation,termKey:key,normalizedTerm:term};
    }
    function internalReply(target,choice){
      return {message:String(choice.message||''),siteItem:target.id,reason:String(choice.reason||'page_internal_selection'),preferKnowledge:false,jinpoOperation:false,termKey:'item',normalizedTerm:target.name};
    }
    function firstNumber(){var m=t.match(/([0-9０-９一二三四五六七八九十]+)/);return m?S(m[1]):'';}

    // 直前のページ内案内から続く選択・言い直しは、古い用語案内より最新ページを優先する。
    var recentChoice=recentItem&&pageContextFresh(h,ctx)?pageInternalChoice(recentItem,t):null;
    if(recentChoice)return internalReply(recentItem,recentChoice);

    if(!ctx.knownTermGuidance||!item||!knownTermContextFresh(h,ctx))return null;

    // 同じページ内の選択肢が別機能名と重なる場合は、直前ページの文脈を優先する。
    // 例: 「星海の荒石」→「文曲」は陣法の文曲除外ではなく、荒石の画像選択。
    var internalChoice=pageInternalChoice(item,t);
    if(internalChoice)return internalReply(item,internalChoice);

    if(bareKnownTerm(text)||mentionedItems(t).length)return null;

    if(key==='formation'){
      if(/^(?:今|現在|いま).*(?:は|どれ|何)|^(?:今の|現在の)?(?:は|どれ|何)[？?。！!]*$/.test(t))return reply('今の陣形は？','formation_context');
      return reply('陣形 '+t,'formation_context');
    }
    if(key==='bond'){
      var bondNo=firstNumber(),bondValue=numberValue(bondNo);
      var bareBondChange=/^(?:じゃあ|では|次は|今度は|やっぱり|やはり|いや|訂正)?[、,\s]*[5-9５-９](?:因縁)?(?:で|にして|へ変更|に変更)?[。！!？?]*$/.test(t);
      if(bondNo&&bondValue>=5&&bondValue<=9&&(bareBondChange||/(?:探|検索|指定|で|因縁|にして|へ変更|に変更|へ変)/.test(t)))return reply(bondValue+'因縁で探して','bond_context');
      if(/発動|今の|現在|見せ|表示/.test(t))return reply('発動因縁を見せて','bond_context');
      if(/一覧|種類|何がある/.test(t))return reply('因縁一覧を見せて','bond_context');
      return reply('因縁 '+t,'bond_context');
    }
    if(key==='kenbun'){
      if(/max|マックス|最大/i.test(t))return reply('見聞録MAXにして','kenbun_context');
      if(/数値|いくつ|どれくらい|意味|説明|って何/.test(t))return reply('見聞録の数値は？','kenbun_context');
      return reply('見聞録 '+t,'kenbun_context');
    }
    if(key==='bunkyoku'){
      var people=firstNumber();
      if(/^(?:じゃあ|では|次は|今度は|やっぱり|やはり|いや|訂正)?[、,\s]*(?:0|０|ゼロ|なし|無し)(?:人)?(?:にして|で|へ変更|に変更|解除|外して|に戻して)?[。！!？?]*$/.test(t))return reply('文曲除外0人','bunkyoku_context');
      if(people&&/(?:人|除外|外)/.test(t))return reply('文曲を'+numberValue(people)+'人除外','bunkyoku_context');
      if(/意味|説明|って何|何のため|使い方|転生.*MAX|MAX.*転生/i.test(t))return reply('文曲除外人数の意味を説明して','bunkyoku_context',true);
      return reply('文曲 '+t,'bunkyoku_context');
    }
    if(key==='allmax'){
      if(/解除|外|戻|やめ|オフ|off/i.test(t))return reply('全MAX解除','allmax_context');
      if(/設定|入れ|して|オン|on/i.test(t)&&!/検索|込み/.test(t))return reply('全MAXにして','allmax_context');
      if(/意味|説明|って何|何なの|どんな/.test(t))return reply('全MAXの意味を説明して','allmax_context',true);
      return reply('全MAX '+t,'allmax_context');
    }
    if(key==='placement'){
      var placementTerm=bareTermKey(term);
      if(/差替|差し替/.test(placementTerm)||/候補/.test(t))return reply('差替候補を見せて','replacement_context');
      if(/除外/.test(placementTerm)){
        var exclusionText=t.replace(/[？?。！!]+$/g,'');
        var previousExcluded=recentContinuation&&recentContinuation.reason==='exclusion_context'?continuationHero(recentContinuation.message,recentContinuation.reason):'';
        if(/^(?:じゃあ|では|次は|今度は|やっぱり|やはり|いや|訂正)?[、,\s]*(?:戻して|取り消して|解除して|使う|使いたい)[。！!？?]*$/.test(exclusionText)){
          if(previousExcluded)return reply(previousExcluded+'の除外を解除','exclusion_context');
          return {clarification:'どの英傑を除外から戻すか、名前を教えてください。',siteItem:item.id,reason:'exclusion_restore_clarification',termKey:key,normalizedTerm:term,pendingHero:''};
        }
        var restoreExplicit=exclusionText.match(/^(?:じゃあ|では|次は|今度は|やっぱり|やはり|いや|訂正)?[、,\s]*(.+?)(?:は|を|の除外を)?(?:使う|使いたい|候補に戻して|除外から戻して|除外を解除|戻して|取り消して)$/);
        if(restoreExplicit){
          var restoreHero=S(restoreExplicit[1]).replace(/^(?:それ|その人|その英傑)$/,'');
          if(!restoreHero)restoreHero=previousExcluded;
          if(restoreHero)return reply(restoreHero+'の除外を解除','exclusion_context');
          return {clarification:'どの英傑を除外から戻すか、名前を教えてください。',siteItem:item.id,reason:'exclusion_restore_clarification',termKey:key,normalizedTerm:term,pendingHero:''};
        }
        exclusionText=exclusionText.replace(/^(?:じゃあ|では|次は|今度は|追加で)[、,\s]*/,'').replace(/^(?:もう一人は|もう1人は)[、,\s]*/,'');
        if(/(?:と|、|,).*(?:外して|抜いて|除外)/.test(exclusionText))return {clarification:'除外英傑は間違いを防ぐため1人ずつ追加します。先に除外する英傑を1人だけ教えてください。',siteItem:item.id,reason:'exclusion_multiple_clarification',termKey:key,normalizedTerm:term,pendingHero:''};
        if(!/除外/.test(exclusionText)&&/(?:を|も)?(?:外して|抜いて|外す|抜く)$/.test(exclusionText))exclusionText=exclusionText.replace(/(?:を|も)?(?:外して|抜いて|外す|抜く)$/,'を除外して');
        else if(!/除外/.test(exclusionText))exclusionText+='を除外して';
        return reply(exclusionText,'exclusion_context');
      }
      if(/配置/.test(placementTerm)){
        var placementText=t.replace(/[？?。！!]+$/g,'');
        var previousPlaced=recentContinuation&&recentContinuation.reason==='placement_context'?continuationHero(recentContinuation.message,recentContinuation.reason):'';
        if(/^(?:じゃあ|では|次は|今度は|やっぱり|やはり|いや|訂正)?[、,\s]*(?:全部|全て|すべて)?(?:を)?(?:外して|抜いて|解除して|やめて|取り消して|戻して)$/.test(placementText)||/(?:を|は)?(?:外して|抜いて|解除して|やめて|取り消して|戻して)$/.test(placementText)){
          var targetLabel=previousPlaced?'「'+previousPlaced+'」の配置条件を外す意味か、候補から除外する意味か':'配置条件を外す意味か、英傑を候補から除外する意味か';
          return {clarification:targetLabel+'を確認したいです。配置だけを戻すなら「配置英傑1を解除」のように枠番号を、候補から外すなら英傑名と「除外して」を教えてください。',siteItem:item.id,reason:'placement_remove_clarification',termKey:key,normalizedTerm:term,pendingHero:previousPlaced};
        }
        placementText=placementText.replace(/^(?:じゃあ|では|次は|今度は|追加で)[、,\s]*/,'').replace(/^(?:もう一人は|もう1人は)[、,\s]*/,'');
        if(/(?:と|、|,).*(?:入れて|加えて|配置)/.test(placementText))return {clarification:'配置英傑は間違いを防ぐため1人ずつ追加します。先に配置する英傑を1人だけ教えてください。',siteItem:item.id,reason:'placement_multiple_clarification',termKey:key,normalizedTerm:term,pendingHero:''};
        if(/入れて探して|使って探して|必ず入れて/.test(placementText))return reply(placementText,'placement_context');
        if(/(?:を|も)?(?:入れて|加えて|配置して)$/.test(placementText))placementText=placementText.replace(/(?:を|も)?(?:入れて|加えて|配置して)$/,'を入れて探して');
        else placementText+='を入れて探して';
        return reply(placementText,'placement_context');
      }
      return reply('配置英傑 '+t,'placement_context');
    }

    if(item.id==='video'){
      if(/(?:再生|見る|見方|使い方|やり方|方法|どう使|どう見)/.test(t))return reply('動画再生の使い方','video_followup');
    }

    if(item.id==='heroes'){
      if(/(?:編成|陣法|陣形|因縁|6人|六人)/.test(t))return null;
      var cost=firstNumber(),costValue=numberValue(cost);
      var priorCost=recentHeroKnowledge&&Number(recentHeroKnowledge.cost)>=4&&Number(recentHeroKnowledge.cost)<=8&&(recentHeroKnowledge.list||recentHeroKnowledge.costEdge);
      var bareCostChange=priorCost&&/^(?:じゃあ|では|次は|今度は|やっぱり|やはり|いや|訂正)?[、,\s]*[4-8４-８](?:は|で|にして|の方|のほう)?[。！!？?]*$/.test(t);
      if(costValue>=4&&costValue<=8&&(/コスト/.test(t)||bareCostChange))return reply('コスト'+costValue+'の英傑を一覧で見せて','hero_term_followup',true);
      if(/一覧.*(?:使い方|見方|操作)|(?:使い方|見方|操作).*一覧/.test(t))return reply('英傑一覧の使い方','hero_page_followup');
      var heroStatName=(t.match(/(?:生命|気合|腕力|耐久|器用|知力|魅力|土属性|水属性|火属性|風属性)/)||[])[0]||'';
      var heroStat=!!heroStatName&&/(?:高|低|一番|トップ|順位|順|誰|どれ|何人|比較)/.test(t);
      var priorRanking=recentHeroKnowledge&&recentHeroKnowledge.ranking&&Array.isArray(recentHeroKnowledge.stats)&&recentHeroKnowledge.stats.length;
      var bareStatChange=priorRanking&&!!heroStatName&&/^(?:じゃあ|では|次は|今度は|やっぱり|やはり|いや|訂正)?[、,\s]*(?:生命|気合|腕力|耐久|器用|知力|魅力|土属性|水属性|火属性|風属性)(?:は|で|にして|の方|のほう)?[。！!？?]*$/.test(t);
      if(bareStatChange)return reply('英傑 '+heroStatName+(recentHeroKnowledge.low?'が低い順':'が高い順'),'hero_term_followup',true);
      var heroData=/(?:因子|職業|コスト|固有技能|育成技能)/.test(t);
      if(heroStat||heroData)return reply('英傑 '+t,'hero_term_followup',true);
    }

    if(item.id==='tsukumo'||item.id==='mado'||item.id==='kishin'){
      var toolSpecific=/^(?:第?[0-9０-９一二三四五六七八九十]+番|番号|名前|名称|能力|ステータス|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風|入手)/.test(t);
      var toolRanking=/(?:生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風).*(?:高い順|低い順|ランキング|トップ|上位|下位)/.test(t);
      if(toolSpecific||toolRanking)return reply(item.name+' '+t,'tool_term_followup',true);
    }

    // ページ固有の短い質問は主語を補い、英傑・カープなど別分野への誤振り分けを防ぐ。
    if(featureIntents(t,item).length){var subject=ctx.approximateTerm?item.name:(term||item.name);return reply(subject+' '+t,'site_feature_followup');}
    if(deicticOpenCue(t)||pageHelpCue(t,null,item)||hasNavigationCue(t))return null;
    return null;
  }
  function knownTermGuidance(info){
    if(!info||!info.item)return null;
    var item=info.item,key=info.key||'item',options='',example='';

    if(key==='site'){
      return {handled:true,mode:'サイト総合案内',answer:'たいらの野望の話ですね。陣法検索、英傑、能力計算、家臣計算、鬼神石、九十九、魔導結晶、カウンターなどの中から、知りたい機能名か「何をしたいか」を一言で教えてください。\nたとえば「腕力が高い編成を探したい」「九十九の入手方法」「桶狭間のカウンター」のように言えば、その話へ進めます。',links:[],data:{siteGuide:true,siteItem:'home',knownTermGuidance:true,needsClarification:true,termKey:key}};
    }
    if(key==='formation'){options='陣形の選択、陣形を指定した検索、現在の陣形、陣形についての説明';example='「方円で探して」「今の陣形は？」「陣形の使い方」';}
    else if(key==='bond'){options='因縁数を指定した検索、発動中の因縁、因縁一覧、因縁についての説明';example='「7因縁で探して」「発動因縁を見せて」「因縁一覧」';}
    else if(key==='kenbun'){options='見聞録MAX、個別の数値設定、全MAXとの関係、検索結果への反映';example='「見聞録MAXにして」「見聞録の数値」「全MAXとの違い」';}
    else if(key==='bunkyoku'){options='文曲を使う条件、転生MAXでの扱い、文曲除外人数の設定';example='「文曲を2人除外」「転生MAXではどうなる？」「文曲って何？」';}
    else if(key==='allmax'){options='全MAXの意味、設定・解除、全MAX込み検索、見聞録・鬼神石・転生の個別設定';example='「全MAXって何？」「全MAXにして」「全MAX込みで検索」';}
    else if(key==='placement'){options='使いたい英傑の配置、除外する英傑、差替候補、現在の6人';example='「前田慶次を入れて」「この英傑を除外」「差替候補を見せて」';}
    else if(item.id==='jinpo'){options='編成検索、検索条件の指定、検索結果の適用、使い方、ページを開く';example='「腕力が高い編成」「方円7因縁で」「陣法の使い方」「ページを開いて」';}
    else if(item.id==='heroes'){options='特定英傑の能力・因子、ランキングや比較、一覧の使い方、ページを開く';example='「前田慶次の因子」「腕力トップ3」「英傑一覧の使い方」';}
    else if(item.id==='tenka_story'){options='桶狭間・富士地下洞穴・京都・賤ヶ岳・比叡山・二条城・封印の選択、場所一覧、表の見方、ページを開く';example='「桶狭間を見たい」「封印の方」「どの場所がある？」「ページを開いて」';}
    else if(item.id==='tenka_taikai'){options='「天」「地」の選択、各カウンター表の見方、ページを開く';example='「天を見たい」「地の方」「天の表の見方」「ページを開いて」';}
    else if(item.category==='counter_detail'){options='敵名を指定したカウンター値、表の見方、ページを開く';example='「今川義元のカウンター」「表の見方」「ページを開いて」';}
    else if(item.category==='counter'){options='敵のカウンター値、場所別の一覧、表の見方、ページを開く';example='「足利義昭のカウンター」「桶狭間を見たい」「どの場所がある？」';}
    else if(item.id==='tsukumo'||item.id==='mado'){options='番号・名前の登録データ、能力、入手方法、合計や比較、ページの使い方';example='「1番の能力」「入手方法」「知力が高い順」「ページを開いて」';}
    else if(item.id==='kishin'){options='番号・名前の登録データ、能力や合計、比較・並べ替え、ページの使い方';example='「1番の能力」「腕力が高い順」「合計の出し方」「ページを開いて」';}
    else if(item.id==='shichisei'){options='説明画像で確認できる内容、ページの見方、ページを開く';example='「何が分かる？」「見方」「ページを開いて」';}
    else if(item.category==='calculator'){options='入力する内容、計算方法、確認できる結果、ページを開く';example='「何を入力する？」「使い方」「ページを開いて」';}
    else if(item.id==='party'){options='登録方法、参加方法、日程の決め方、ページを開く';example='「登録方法」「参加するには？」「ページを開いて」';}
    else if(item.id==='roulette'){options='使い方、参加者名の登録、抽選、当選履歴や演出設定、ページを開く';example='「参加者の登録方法」「抽選の使い方」「履歴を戻す方法」「ページを開いて」';}
    else if(item.id==='tournament'){options='大会形式、参加者登録、組み合わせ、勝敗の入力、日程、ページを開く';example='「参加者の登録方法」「勝敗の付け方」「開催日時の設定」「ページを開いて」';}
    else if(item.external){
      return {handled:true,mode:'サイト総合案内',answer:'「'+item.name+'」ですね。'+item.desc+' こちらから開けます。',links:[itemLink(item)],data:{siteGuide:true,siteItem:item.id,knownTermGuidance:true}};
    }else{options='確認できる内容、使い方、ページを開く';example='「何が分かる？」「使い方」「ページを開いて」';}

    var prefix=info.approximate?'「'+S(info.term)+'」は「'+item.name+'」のことだと思います。':'「'+(key==='item'?item.name:S(info.term))+'」の話ですね。';
    return {
      handled:true,mode:'サイト総合案内',
      answer:prefix+' '+item.desc+'\n知りたいのは、'+options+'のどれですか？\nたとえば '+example+' のように続けてください。',
      links:[],
      data:{siteGuide:true,siteItem:item.id,knownTermGuidance:true,needsClarification:true,termKey:key,normalizedTerm:S(info.term),approximateTerm:!!info.approximate}
    };
  }
  function mentionedItems(text){
    var t=normalizeInput(text),out=[],seen={};
    ITEMS.forEach(function(item){
      var aliases=[item.name].concat(item.aliases||[]);
      for(var i=0;i<aliases.length;i++){
        var a=normalizeInput(aliases[i]);if(a&&t.indexOf(a)>=0){if(!seen[item.id]){seen[item.id]=1;out.push(item);}break;}
      }
    });
    return out;
  }
  function mentionedItemPosition(text,item){
    var t=normalizeInput(text),aliases=[item&&item.name].concat(item&&item.aliases||[]),best=t.length+1;
    aliases.forEach(function(alias){var a=normalizeInput(alias),pos=a?t.indexOf(a):-1;if(pos>=0&&pos<best)best=pos;});
    return best;
  }
  function directComparisonPurposeItems(text){
    var t=normalizeInput(text),items=mentionedItems(t);if(items.length<2)return[];
    var materialIds={kishin:1,tsukumo:1,mado:1,chinkon:1,seikai:1},materials=items.filter(function(x){return !!materialIds[x.id];}),calculators=items.filter(function(x){return x.id==='stats'||x.id==='retainer';}),selected=[];
    if(materials.length>=2)selected=materials;
    else if(calculators.length===2)selected=calculators;
    else if(items.length===2)selected=items;
    else return[];
    return selected.slice().sort(function(a,b){return mentionedItemPosition(t,a)-mentionedItemPosition(t,b);});
  }

  function purposeScores(text){
    var t=normalizeInput(text),scores={};
    function add(id,score){scores[id]=Math.max(scores[id]||0,score);}

    if(/家臣.*(?:名前|名付け|命名)/.test(t))return [];
    if(/(?:6人|六人|編成|組み合わせ|因縁|陣形|鶴翼|方円|魚鱗|衡軛|全MAX|文曲).*(?:探|検索|組|高|優先|おすすめ)|(?:生命|気合|腕力|耐久|器用|知力|魅力|土属性|水属性|火属性|風属性).*(?:高い|高め|優先|編成|検索|探)/.test(t))add('jinpo',120);
    if(/英傑.*(?:一覧|能力|ステータス|因子|職業|コスト|技能|見る|見たい|見られる|見ん|見れ|確認|調べ)/.test(t))add('heroes',118);
    if(/家臣.*(?:能力|ステータス|ステ|計算|育成)/.test(t))add('retainer',118);
    if(/(?:自分|キャラ|人物|装備|能力|ステータス|ステ).*(?:計算|シミュ|合計)|(?:能力計算|ステ計算)/.test(t)&&!/家臣|英傑/.test(t))add('stats',108);
    if(/徒党|集合|待ち合わせ|募集/.test(t))add('party',108);
    if(/七星転生|七星.*(?:計算|確認)|転生後.*(?:計算|確認)/.test(t))add('shichisei',115);
    if(/食料|兵糧/.test(t))add('food',108);
    if(/星海の荒石|荒石/.test(t))add('seikai',115);
    if(/鬼神石/.test(t))add('kishin',116);
    if(/九十九|九十九の力/.test(t))add('tsukumo',116);
    if(/魔導結晶|魔導/.test(t))add('mado',116);
    if(/鎮魂符/.test(t))add('chinkon',116);
    if(/名物(?:一覧|表)?|御蔵番.*名物/.test(t))add('meibutsu',120);
    if(/御蔵番|蔵.*拡張|倉庫.*拡張/.test(t))add('okuraban',115);
    if(/ルーレット|ランダム.*(?:決|選)|抽選/.test(t))add('roulette',108);
    if(/トーナメント|勝ち抜き|対戦表/.test(t))add('tournament',108);
    if(/動画.*(?:再生|見る)|ランダム動画/.test(t))add('video',105);
    if(/youtube|ユーチューブ|動画チャンネル/i.test(t))add('youtube',118);
    if(/公式サイト|信オン公式|ゲームシティ/.test(t))add('official',118);
    if(/攻略wiki|信オンwiki|ウィキ/i.test(t))add('wiki',118);

    if(/桶狭間/.test(t))add('okehazama',132);
    if(/富士地下|富士.*洞/.test(t))add('fuji',132);
    if(/(?:天下統一|奇譚|カウンター).*(?:京都|本能寺)|(?:京都|本能寺).*(?:カウンター|奇譚)/.test(t))add('kyouto',132);
    if(/賤ヶ岳|しずがたけ/.test(t))add('shizugatake',132);
    if(/比叡山/.test(t))add('hieizan',132);
    if(/二条城/.test(t))add('nijoujou',132);
    if(/封印(?:編)?/.test(t))add('fuuin',132);
    if(/修羅の間|修羅.*カウンター/.test(t))add('shura',132);
    if(/(?:天下武技大会|武技大会|大会).*(?:天|上)|天.*(?:武技大会|カウンター)/.test(t))add('ten_mode',134);
    if(/(?:天下武技大会|武技大会|大会).*(?:地|下)|地.*(?:武技大会|カウンター)/.test(t))add('chi_mode',134);
    if(/天下統一奇譚|天下統一.*(?:場所|メニュー|選)/.test(t))add('tenka_story',124);
    if(/天下武技大会|武技大会/.test(t))add('tenka_taikai',124);
    if(/カウンター|敵.*(?:数値|表)/.test(t))add('counter',110);

    return Object.keys(scores).map(function(id){return {item:BY_ID[id],score:scores[id]};}).filter(function(x){return x.item;}).sort(function(a,b){return b.score-a.score;});
  }
  function purposeItem(text){var r=purposeScores(text);return r.length?r[0].item:null;}

  function pageFreeGoal(text){
    var t=normalizeInput(text),items=[],reason='';
    function set(ids,why){items=ids.map(function(id){return BY_ID[id];}).filter(Boolean);reason=why;}
    if(/8個.*(?:選|合計)|(?:選|合計).*8個/.test(t))set(['kishin','tsukumo','mado'],'eight_item_total');
    else if(/保存.*(?:できる|可能).*(?:計算機|計算|どれ)|(?:計算機|計算).*(?:保存).*(?:どれ|できる)/.test(t))set(['stats','retainer'],'savable_calculator');
    else if(/合成最低発現数/.test(t))set(['kishin'],'minimum_activation');
    else if(/英傑.*(?:因子|職業|コスト|能力|技能).*(?:調べ|確認|見たい)|(?:因子|職業|コスト).*(?:英傑).*(?:調べ|確認|見たい)/.test(t))set(['heroes'],'hero_lookup');
    else if(/(?:6人|六人).*(?:組み合わせ|編成|探)|(?:組み合わせ|編成).*(?:6人|六人)/.test(t))set(['jinpo'],'six_hero_formation');
    else if(/(?:輝光|星光|微光).*(?:材料|合成|作り方|つくり方)|(?:材料|合成).*(?:輝光|星光|微光)/.test(t))set(['seikai'],'stone_recipe');
    else if(/敵.*(?:数値|カウンター|表).*(?:見|確認|調べ)|(?:数値|カウンター).*(?:敵).*(?:見|確認|調べ)/.test(t))set(['counter'],'enemy_counter');
    else if(/名物.*(?:合計|一覧|表).*(?:見|確認|調べ)|(?:合計|一覧).*(?:名物)/.test(t))set(['meibutsu'],'specialty_total');
    if(!items.length)return null;
    return {items:items,reason:reason};
  }
  function answerPageFreeGoal(goal){
    if(!goal||!goal.items||!goal.items.length)return null;
    if(goal.items.length>1){
      var c=candidateClarification(goal.items,'その目的に使えるページは、','です。どれを使いたいですか？');
      c.answer+=' 用途をもう一言足せば、さらに絞れます。';
      c.data.pageFreeGoal=goal.reason;return c;
    }
    var item=goal.items[0],r=explainItem(item,true);
    r.answer='目的から「'+item.name+'」が合っています。\n'+r.answer;
    r.data=r.data||{};r.data.pageFreeGoal=goal.reason;return r;
  }

  function vagueSaveCapabilityCue(text){
    var t=normalizeInput(text).replace(/[？?。！!]+$/g,'').trim();
    if(!t||mentionedItems(t).length)return false;
    return /^(?:(?:このサイト|ここ|これ|それ)(?:で|は|って)?[、,\s]*)?(?:画像|画面)?保存(?:は|って)?(?:できる|出来る|可能)(?:の|もの|やつ|ページ|ところ)?$/.test(t)||/^(?:どれ|何|なに)(?:が|を)?(?:画像|画面)?保存(?:できる|出来る|可能)(?:の|もの|やつ|ページ)?$/.test(t);
  }
  function answerVagueSaveCapability(){
    var list=[BY_ID.kishin,BY_ID.tsukumo,BY_ID.mado,BY_ID.stats,BY_ID.retainer,BY_ID.jinpo].filter(Boolean),ids=list.map(function(x){return x.id;});
    return {
      handled:true,
      mode:'サイト総合案内',
      answer:'保存はできます。何を残したいかで案内先が変わります。\n・鬼神石・九十九・魔導結晶：選んだ一覧画面を画像保存\n・能力計算・家臣計算：能力表を画像保存\n・陣法検索：編成をページ内へ保存し、共有URLやJSONでも受け渡し\n「一覧を8個選ぶやつ」「能力計算の結果」「編成」のように、保存したいものを一言だけ教えてください。',
      links:list.map(itemLink),
      data:{siteFeature:'save',siteItems:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:ids,siteVagueCapability:'save',siteVagueCapabilityClarification:true,needsClarification:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}
    };
  }

  function vagueSiteCapabilityKind(text){
    var t=normalizeInput(text).replace(/[？?。！!]+$/g,'').trim();
    if(!t||mentionedItems(t).length)return'';
    t=t.replace(/^(?:このサイト|ここ|これ|それ)(?:で|は|って)?[、,\s]*/,'');
    if(/^(?:何か|なにか)?(?:を)?(?:計算|シミュレーション)(?:は|って)?(?:できる|出来る|可能|ある)(?:の|もの|やつ|ページ|ところ)?$/.test(t)||/^(?:何|なに)(?:を|が)?計算できる(?:の)?$/.test(t))return'calculate';
    if(/^(?:何か|なにか)?(?:の)?(?:一覧|リスト|表)(?:は|って)?(?:ある|見られる|見れる|出せる|見たい)(?:の|もの|やつ|ページ)?$/.test(t)||/^(?:何|なに)(?:の)?(?:一覧|リスト|表)(?:が)?ある(?:の)?$/.test(t))return'list';
    if(/^(?:何か|なにか)?(?:を)?(?:比較|比べること)(?:は|って)?(?:できる|出来る|可能)(?:の|もの|やつ|ページ)?$/.test(t)||/^(?:何|なに)(?:を|が)?比較できる(?:の)?$/.test(t))return'compare';
    if(/^(?:何か|なにか)?(?:を)?(?:共有|シェア|URL共有)(?:は|って)?(?:できる|出来る|可能)(?:の|もの|やつ|ページ)?$/.test(t)||/^(?:何|なに)(?:を|が)?共有できる(?:の)?$/.test(t))return'share';
    if(/^(?:(?:何|なに)(?:が|を)?(?:検索|探せる)|(?:検索|探すこと)(?:は|って)?(?:できる|出来る|可能))(?:の|もの|やつ|ページ)?$/.test(t))return'search';
    if(/^(?:使い方(?:を)?教えて|どう使う(?:の|もの)?|どこから(?:開く|始める)(?:の|もの)?|何から(?:始める|見ればいい)(?:の)?)$/.test(t))return'use';
    return'';
  }
  function answerVagueSiteCapability(kind){
    var list=[],ids=[];
    if(kind==='calculate'){
      list=[BY_ID.stats,BY_ID.retainer,BY_ID.shichisei,BY_ID.food,BY_ID.kishin,BY_ID.tsukumo,BY_ID.mado].filter(Boolean);ids=list.map(function(x){return x.id;});
      return {handled:true,mode:'サイト総合案内',answer:'計算できます。何を計算したいですか？\n・自分の能力：能力計算\n・家臣の能力：家臣計算\n・転生後：七星転生\n・必要な食料：食料\n・一覧から8個選んだ合計：鬼神石・九十九・魔導結晶\n「家臣の」「自分の」「8個の合計」のような短い返事で大丈夫です。',links:list.map(itemLink),data:{siteItems:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:ids,siteVagueCapability:'calculate',siteVagueCapabilityClarification:true,needsClarification:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
    }
    if(kind==='list'){
      list=[BY_ID.heroes,BY_ID.kishin,BY_ID.tsukumo,BY_ID.mado,BY_ID.counter,BY_ID.meibutsu].filter(Boolean);ids=list.map(function(x){return x.id;});
      return {handled:true,mode:'サイト総合案内',answer:'一覧はあります。何の一覧を見たいですか？\n・英傑：能力・因子・職業・コストなど\n・鬼神石・九十九・魔導結晶：能力・入手・合計など\n・カウンター：場所ごとの敵の数値\n・名物：御蔵番に関連する名物一覧\n「英傑の」「九十九の」「カウンター」のように一言で続けてください。',links:list.map(itemLink),data:{siteItems:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:ids,siteVagueCapability:'list',siteVagueCapabilityClarification:true,needsClarification:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
    }
    if(kind==='compare'){
      return {handled:true,mode:'サイト総合案内',answer:'比較できます。何と何を比べたいですか？\nたとえば「九十九と鬼神石」「能力計算と家臣計算」のように、二つの名前だけ続けてください。違いを説明して、目的があれば合う方まで絞ります。',links:[],data:{siteVagueCapability:'compare',siteVagueCapabilityClarification:true,needsClarification:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
    }
    if(kind==='share'){
      var jinpo=BY_ID.jinpo;
      return {handled:true,mode:'サイト総合案内',answer:'陣法の編成なら共有できます。陣法検索には、編成保存・共有URL・JSON出力と読込があります。\n別のものを共有したい場合は、その名前を教えてください。',links:jinpo?[itemLink(jinpo)]:[],data:{siteItem:'jinpo',siteFeature:'share',siteVagueCapability:'share',siteVagueCapabilityAnswer:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
    }
    if(kind==='search'){
      list=[BY_ID.jinpo,BY_ID.heroes,BY_ID.kishin,BY_ID.tsukumo,BY_ID.mado,BY_ID.counter].filter(Boolean);ids=list.map(function(x){return x.id;});
      return {handled:true,mode:'サイト総合案内',answer:'探せます。探したいものによって入口が変わります。\n・6人編成：陣法検索で条件を指定して検索\n・英傑：英傑一覧で能力・因子・職業・コストを確認\n・鬼神石・九十九・魔導結晶：各一覧で能力や入手を確認\n・敵の数値：カウンターから場所を選択\n「編成の」「英傑の」「九十九の」「カウンター」のように一言で続けてください。',links:list.map(itemLink),data:{siteItems:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:ids,siteVagueCapability:'search',siteVagueCapabilityClarification:true,needsClarification:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
    }
    if(kind==='use'){
      list=[BY_ID.jinpo,BY_ID.heroes,BY_ID.stats,BY_ID.retainer,BY_ID.kishin,BY_ID.tsukumo,BY_ID.mado,BY_ID.counter].filter(Boolean);ids=list.map(function(x){return x.id;});
      return {handled:true,mode:'サイト総合案内',answer:'もちろんです。やりたいことを一言もらえれば、使うページと最初の操作まで案内します。\n・6人編成を探す：陣法検索\n・英傑を調べる：英傑一覧\n・自分／家臣の能力を見る：能力計算／家臣計算\n・鬼神石・九十九・魔導結晶を見る：各一覧\n・敵の数値を見る：カウンター\n「家臣の」「編成の」「九十九の」のような短い返事で大丈夫です。',links:list.map(itemLink),data:{siteItems:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:ids,siteVagueCapability:'use',siteVagueCapabilityClarification:true,needsClarification:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
    }
    return null;
  }
  function latestVagueCapabilityContext(history){
    var h=Array.isArray(history)?history:[];
    function fromAssistant(index){
      if(index<0||!h[index]||h[index].role!=='assistant')return null;
      var data=h[index].meta&&h[index].meta.data||{},kind=String(data.siteVagueCapability||'');
      if(!data.siteVagueCapabilityClarification||!kind||data.siteGuideContextCleared)return null;
      var ids=data.siteCandidates||data.candidates||data.siteItems||[],sourceIds=data.siteSourceCandidates||ids;
      return {kind:kind,candidates:Array.isArray(ids)?ids.map(function(id){return BY_ID[id];}).filter(Boolean):[],sourceCandidates:Array.isArray(sourceIds)?sourceIds.map(function(id){return BY_ID[id];}).filter(Boolean):[],firstComparisonItem:String(data.firstComparisonItem||''),index:index};
    }
    var direct=fromAssistant(h.length-2);if(direct)return direct;
    if(h.length>=4&&h[h.length-3]&&h[h.length-3].role==='user'&&acknowledgementOnly(h[h.length-3].text)){
      var ackAssistant=h[h.length-2],ackData=ackAssistant&&ackAssistant.meta&&ackAssistant.meta.data||{};
      if(ackAssistant&&ackAssistant.role==='assistant'&&!ackData.siteGuide)return fromAssistant(h.length-4);
    }
    return null;
  }
  function markVagueCapabilityFollowup(result,kind){
    if(!result)return null;result.data=result.data||{};result.data.siteVagueCapability=kind;result.data.siteVagueCapabilityFollowup=true;return result;
  }
  function vagueCapabilitySingleAnswer(item,kind,feature,text,sourceCandidates){
    if(!item)return null;
    var result=feature?answerFeatures(item,[feature],true,text):explainItem(item,true);
    result=markVagueCapabilityFollowup(result,kind);result.data.selectedSiteItem=item.id;
    var source=(sourceCandidates||[]).filter(Boolean);if(source.length)result.data.siteSourceCandidates=source.map(function(x){return x.id;});
    return result;
  }
  function vagueCapabilityChoiceItem(kind,text,candidates){
    var t=normalizeInput(text).replace(/[？?。！!]+$/g,'').trim().replace(/^(?:じゃあ|では|それなら|なら|えっと|えーと|やっぱり|やっぱ|やはり|いや|ううん|違う|ちがう|訂正)[、,\s]*/,'').replace(/(?:の|やつ|ほう|方|について)$/,'').trim();
    var list=(candidates||[]).filter(Boolean);
    function listed(id){for(var i=0;i<list.length;i++)if(list[i]&&list[i].id===id)return list[i];return null;}
    if((kind==='calculate'||kind==='save'||kind==='use')&&/^(?:自分|自分の能力|能力|能力値|能力計算|能力表|ステ|ステータス|キャラ)$/.test(t))return listed('stats');
    if((kind==='calculate'||kind==='save'||kind==='use')&&/^(?:家臣|家臣計算|家臣の能力|家臣能力表|家臣ステ)$/.test(t))return listed('retainer');
    if(kind==='calculate'&&/^(?:七星|七星転生|転生|転生後)$/.test(t))return listed('shichisei');
    if(kind==='calculate'&&/^(?:食料|兵糧|必要な食料)$/.test(t))return listed('food');
    if((kind==='save'||kind==='search'||kind==='use')&&/^(?:編成|陣法|陣法編成|編成検索|6人編成|六人編成|検索条件)$/.test(t))return listed('jinpo');
    if((kind==='list'||kind==='search'||kind==='use')&&/^(?:英傑|英傑一覧|英傑データ|人物|因子|職業|コスト)$/.test(t))return listed('heroes');
    if((kind==='list'||kind==='search'||kind==='use')&&/^(?:鬼神石|鬼神)$/.test(t))return listed('kishin');
    if((kind==='list'||kind==='search'||kind==='use')&&/^(?:九十九|九十九の力)$/.test(t))return listed('tsukumo');
    if((kind==='list'||kind==='search'||kind==='use')&&/^(?:魔導|魔導結晶)$/.test(t))return listed('mado');
    if((kind==='list'||kind==='search'||kind==='use')&&/^(?:カウンター|敵|敵の数値)$/.test(t))return listed('counter');
    if(kind==='list'&&/^(?:名物|名物一覧)$/.test(t))return listed('meibutsu');
    return selectFromCandidates(t,list);
  }
  function answerVagueCapabilityFollowup(text,history){
    var ctx=latestVagueCapabilityContext(history);if(!ctx)return null;
    var t=normalizeInput(text).replace(/[？?。！!]+$/g,'').trim().replace(/^(?:じゃあ|では|それなら|なら|えっと|えーと)[、,\s]*/,'').replace(/(?:の|やつ|ほう|方|について)$/,'').trim();
    if(!t||acknowledgementOnly(t))return null;
    var item=null;
    if(ctx.kind==='save'){
      if(/^(?:一覧|一覧画面|8個|8個の一覧|選ぶ一覧)$/.test(t)){
        var saveLists=[BY_ID.kishin,BY_ID.tsukumo,BY_ID.mado].filter(Boolean),saveChoice=candidateClarification(saveLists,'一覧画面を画像保存できるのは、','です。どの一覧ですか？');
        saveChoice.data.siteVagueCapability='save';saveChoice.data.siteVagueCapabilityClarification=true;saveChoice.data.siteVagueCapabilityFollowup=true;saveChoice.data.siteSourceCandidates=(ctx.sourceCandidates.length?ctx.sourceCandidates:ctx.candidates).map(function(x){return x.id;});return saveChoice;
      }
      var saveNamed=vagueCapabilityChoiceItem('save',t,ctx.candidates);if(saveNamed)return vagueCapabilitySingleAnswer(saveNamed,'save','save',text,ctx.sourceCandidates);
    }
    if(ctx.kind==='calculate'){
      if(/^(?:8個|8個の合計|一覧の合計|選んだ合計)$/.test(t)){
        var totalLists=[BY_ID.kishin,BY_ID.tsukumo,BY_ID.mado].filter(Boolean),totalChoice=candidateClarification(totalLists,'8個を選んで合計を見られるのは、','です。どれを計算しますか？');
        totalChoice.data.siteVagueCapability='calculate';totalChoice.data.siteVagueCapabilityClarification=true;totalChoice.data.siteVagueCapabilityFollowup=true;totalChoice.data.siteSourceCandidates=(ctx.sourceCandidates.length?ctx.sourceCandidates:ctx.candidates).map(function(x){return x.id;});return totalChoice;
      }
      var calculateNamed=vagueCapabilityChoiceItem('calculate',t,ctx.candidates);if(calculateNamed)return vagueCapabilitySingleAnswer(calculateNamed,'calculate','',text,ctx.sourceCandidates);
    }
    if(ctx.kind==='list'){
      item=vagueCapabilityChoiceItem('list',t,ctx.candidates);
      if(item)return vagueCapabilitySingleAnswer(item,'list','',text,ctx.sourceCandidates);
    }
    if(ctx.kind==='search'||ctx.kind==='use'){
      item=vagueCapabilityChoiceItem(ctx.kind,t,ctx.candidates);
      if(item)return vagueCapabilitySingleAnswer(item,ctx.kind,'',text,ctx.sourceCandidates);
    }
    if(ctx.kind==='compare'){
      var pair=mentionedItems(t);
      if(pair.length===1&&ctx.firstComparisonItem&&BY_ID[ctx.firstComparisonItem]&&ctx.firstComparisonItem!==pair[0].id)pair=[BY_ID[ctx.firstComparisonItem],pair[0]];
      if(pair.length>=2)return markVagueCapabilityFollowup(compareItems(pair),'compare');
      if(pair.length===1)return {handled:true,mode:'サイト総合案内',answer:'「'+pair[0].name+'」と、もう一つは何を比べたいですか？ 名前を一つだけ教えてください。',links:[itemLink(pair[0])],data:{siteVagueCapability:'compare',siteVagueCapabilityClarification:true,siteVagueCapabilityFollowup:true,firstComparisonItem:pair[0].id,needsClarification:true}};
    }
    return null;
  }

  function latestVagueCapabilityDecisionContext(history){
    var h=Array.isArray(history)?history:[];
    function fromAssistant(index){
      if(index<0||!h[index]||h[index].role!=='assistant')return null;
      var data=h[index].meta&&h[index].meta.data||{},kind=String(data.siteVagueCapability||''),item=BY_ID[String(data.siteItem||'')];
      if(!data.siteVagueCapabilityFollowup||!kind||!item||data.siteGuideContextCleared)return null;
      var ids=data.siteSourceCandidates||[],source=Array.isArray(ids)?ids.map(function(id){return BY_ID[id];}).filter(Boolean):[];
      if(source.length<2)return null;
      return {kind:kind,item:item,sourceCandidates:source,index:index};
    }
    var direct=fromAssistant(h.length-2);if(direct)return direct;
    if(h.length>=4&&h[h.length-3]&&h[h.length-3].role==='user'&&acknowledgementOnly(h[h.length-3].text)){
      var ackAssistant=h[h.length-2],ackData=ackAssistant&&ackAssistant.meta&&ackAssistant.meta.data||{};
      if(ackAssistant&&ackAssistant.role==='assistant'&&!ackData.siteGuide)return fromAssistant(h.length-4);
    }
    return null;
  }
  function vagueCapabilityRevisionCue(text){
    var t=normalizeInput(text);
    return /^(?:いや|ううん|違う|ちがう|訂正|やっぱり|やっぱ|やはり)[、,\s]*.+/.test(t)||/^(?:それじゃない|それではない|今のじゃない|別の(?:は|がいい|にして)?|ほかの(?:は|がいい|にして)?|他の(?:は|がいい|にして)?|どれでもない|どれも違う|全部違う)[。！!？?]*$/.test(t);
  }
  function answerVagueCapabilityRevision(text,history){
    var ctx=latestVagueCapabilityDecisionContext(history);if(!ctx||!vagueCapabilityRevisionCue(text))return null;
    var t=normalizeInput(text),source=ctx.sourceCandidates,ids=source.map(function(x){return x.id;});
    if(/(?:どれでもない|どれも違う|全部違う)/.test(t)){
      return {handled:true,mode:'サイト総合案内',answer:'わかりました。今の候補はいったん外します。探したいものを「何をしたいか」で言い直してくれれば、そこから案内し直します。',links:[],data:{siteItem:'__site_guide_context_cleared__',siteGuideContextCleared:true,siteVagueCapability:ctx.kind,siteVagueCapabilityFollowup:true,siteVagueCapabilityCancelled:true,rejectedSiteCandidates:ids,needsClarification:true}};
    }
    var target=vagueCapabilityChoiceItem(ctx.kind,text,source);
    if(target){
      var revised=vagueCapabilitySingleAnswer(target,ctx.kind,ctx.kind==='save'?'save':'',text,source);
      revised.data.siteVagueCapabilityRevision=true;revised.data.previousSelectedSiteItem=ctx.item.id;return revised;
    }
    if(/(?:それじゃない|それではない|今のじゃない|別の|ほかの|他の)/.test(t)){
      var remaining=source.filter(function(x){return x.id!==ctx.item.id;}),choice=candidateClarification(remaining,'わかりました。「'+ctx.item.name+'」以外なら、','です。どれにしますか？');
      if(!choice)return null;
      choice.data.siteVagueCapability=ctx.kind;choice.data.siteVagueCapabilityClarification=true;choice.data.siteVagueCapabilityFollowup=true;choice.data.siteVagueCapabilityRevision=true;choice.data.siteSourceCandidates=ids;choice.data.previousSelectedSiteItem=ctx.item.id;return choice;
    }
    return null;
  }

  function explicitNavigationCue(text){
    var t=normalizeInput(text);
    return /どこ|どのページ|何ページ|ページ|開い|開け|開く|見に行|見にい|見せて|見せろ|行きたい|移動|案内|リンク|場所|画面(?:出|見せ|開)|(?:の|とこ|ところ).{0,4}出して|飛ば|連れて|戻りたい|どれ(?:を)?押|どこ(?:を)?押|何(?:を)?押|入口|辿り着|アクセス|どこで見|どこにある|どこから|見られる(?:とこ|ところ)|見れる(?:とこ|ところ)/.test(t);
  }
  function taskNavigationCue(text){
    var t=normalizeInput(text);
    if(/使い方|入手|効果|数値|何番|いくつ|誰|成績|倍率|上限|下限|必要数/.test(t)&&!/ツール.*使|ページ|画面|計算したい|組み合わせたい|一覧.*(?:見たい|見られる)/.test(t))return false;
    return /(?:計算|シミュレーション|組み合わせ|編成|一覧|比較|選択|登録|集合|抽選|作成)(?:したい|してみたい|やりたい|できるところ|するところ)|ツール.*(?:使いたい|どれ)|(?:一覧|表|カウンター|画面).*(?:見たい|見せて|開きたい|出して|確認したい|見られる)|(?:見たい|見せて|開きたい|出して|見られる).*(?:一覧|表|カウンター|画面)|(?:のやつ|の方|のほう)(?:を)?(?:見たい|開きたい)?/.test(t);
  }
  function hasNavigationCue(text){return explicitNavigationCue(text)||taskNavigationCue(text);}
  function hasJinpoOperation(text){
    var t=normalizeInput(text);
    return /陣形|因縁|腕力|耐久|器用|知力|魅力|生命|気合|土属性|水属性|火属性|風属性|文曲|配置英傑|除外英傑|英傑.*(?:差替|固定|除外|配置)|(?:配置|除外).*(?:して|したい)|(?:配置英傑|配置条件|除外).*(?:解除|戻|取り消|使う)|(?:入れて|使って).*(?:探して|検索)|差替|込み合計|全MAX|検索結果|鶴翼|方円|魚鱗|衡軛/.test(t)||/(?:鬼神石|見聞録|転生).*(?:MAX|マックス|設定|解除|数値)/.test(t)||/(?:MAX|マックス).*(?:鬼神石|見聞録|転生)/.test(t);
  }
  function overviewCue(text){
    var t=normalizeInput(text);
    return /(?:このサイト|たいらの野望|サイト).*(?:何ができる|何できる|何をすればいい|何すればいい|何する|何がある|どんなサイト|機能|ツール|全部|全体|案内)|^(?:サイト案内|ツール一覧|全ページ|ページ一覧|何ができる|何をすればいい|何するサイト)[？?。！!]*$/.test(t);
  }
  function pageHelpCue(text,item,recent){
    var t=normalizeInput(text),hasTarget=!!item||!!recent;
    if(/(?:ページ|画面|ツール).*(?:使い方|やり方|見方|操作|何ができる|何する|どこを押す|どれを押す|分からない)|(?:使い方|やり方|見方|操作|何ができる|何する|どこを押す|どれを押す).*(?:ページ|画面|ツール)/.test(t))return true;
    if(hasTarget&&/(?:何ができる|何できる|何が分かる|何を確認できる|何をする|何するやつ|どう使う|どう見る|見方|使い方|やり方|付け方|進め方|どこを押す|どれを押す|何を押す|操作方法|使い方が?分からない|見方が?分からない)/.test(t))return true;
    if(recent&&/^(?:それ|そのページ|そこ|これ|このページ)?(?:って|は|の)?[、,\s]*(?:何ができる|何をする|何するやつ|どう使う|見方|どこを押す|使い方|操作方法)(?:なの|ですか|の)?[？?。！!]*$/.test(t))return true;
    return false;
  }
  function hierarchyCue(text){return /次(?:は|どれ|どこ|何)|その先|中(?:は|に)?何|何がある|どれを選|どっち|選びたい|メニュー/.test(normalizeInput(text));}
  function factSpecificCue(text){return /入手|効果|数値|何番|いくつ|誰|成績|倍率|上限|下限|必要数|能力(?:値)?(?:は|いくつ|どれ)|カウンター(?:値)?(?:は|何番|いくつ)/.test(normalizeInput(text));}
  function specificCounterSubjectCue(text,item){
    var t=normalizeInput(text);
    // 桶狭間・比叡山・武技大会など、専用ページ名まで一致した時はページ案内を優先する。
    if(item&&item.id&&item.id!=='counter')return false;
    if(!/カウンター/.test(t))return false;
    if(/カウンター(?:表|一覧|ページ|画面|メニュー)|(?:敵|ボス|全体|全部|サイト)のカウンター/.test(t))return false;
    var m=t.match(/^(.{2,40}?)(?:の)?カウンター(?:を)?(?:見たい|見せて|教えて|知りたい|確認したい|は|って|何番|いくつ)/);
    if(!m)return false;
    var subject=S(m[1]).replace(/[、,。！!？?\s]+$/g,'');
    if(!subject||/^(?:この|その|あの|例の|たいらの野望|天下統一奇譚|修羅の間|天下武技大会)$/.test(subject))return false;
    return true;
  }
  // 同じ発言の途中で「いや」「やっぱ」「そこじゃない」などと言い直した時は、
  // 最後の訂正部分を優先する。訂正後が機能名だけなら、訂正前の単一ページ主語だけを安全に補う。
  function siteCorrectionParts(text){
    var t=S(text),re=/(?:じゃなくて|ではなくて|じゃなく|ではなく|そっちじゃない|それじゃない|そこじゃない|ここじゃない|あっちじゃない|(?:^|[、,。？?！!…．.\s])(?:あ[、,\s]*やっぱ(?:り)?|やっぱ(?:り)?|いや(?:違う)?|訂正(?:すると)?|ごめん(?:ね)?)[、,\s…・:：]*)/g,m,best=null;
    while((m=re.exec(t))){
      var tail=S(t.slice(re.lastIndex));
      if(!tail||/^(?:でも|まあ|まー)[、,\s]/.test(tail))continue;
      best={left:S(t.slice(0,m.index)),tail:tail,index:m.index};
    }
    return best;
  }
  function correctionCue(text){return !!siteCorrectionParts(text);}
  function correctionTail(text){
    var info=siteCorrectionParts(text);if(!info)return'';
    var tail=info.tail,tailItems=mentionedItems(tail);
    if(!tailItems.length){
      var leftItems=mentionedItems(info.left);
      if(leftItems.length===1&&(featureIntents(tail,leftItems[0]).length||pageHelpCue(tail,leftItems[0],leftItems[0])))tail=leftItems[0].name+' '+tail;
    }
    return S(tail);
  }
  function inlineSiteGoalRevision(text){
    var info=siteCorrectionParts(text);if(!info||!S(info.left))return null;
    if(/[、,]\s*(?:でも|ただ|ただし|一方で)[、,\s]*.+(?:も|についても)(?:知りたい|教えて|見たい|確認したい)/.test(info.tail))return null;
    var leftItems=mentionedItems(info.left),leftPurpose=purposeScores(info.left),tail=correctionTail(text);
    if(!tail||(!leftItems.length&&!leftPurpose.length))return null;
    if(!mentionedItems(tail).length&&!purposeScores(tail).length&&factSpecificCue(tail))return null;
    return {left:info.left,tail:tail,leftItems:leftItems};
  }
  function answerInlineSiteGoalRevision(text,opt){
    var revision=inlineSiteGoalRevision(text);if(!revision||opt&&opt._inlineSiteGoalRevision)return null;
    var nested={};Object.keys(opt||{}).forEach(function(key){nested[key]=opt[key];});
    nested.original=revision.tail;nested._inlineSiteGoalRevision=true;
    var result=respond(revision.tail,nested),specific=!!(result&&result.handled&&result.data&&(result.data.siteItem&&result.data.siteItem!=='__site_guide_context_cleared__'||Array.isArray(result.data.siteComparison)&&result.data.siteComparison.length>=2||result.data.stoneName));
    if(!specific){
      var stoneRequest=seikaiStoneRequest(revision.tail,null,currentItem());
      if(stoneRequest)result=seikaiStoneAnswer(stoneRequest);
      else{
        var pair=mentionedItems(revision.tail);
        if(pair.length>=2&&/(?:どっち|どちら|違い|違う|どう違う|比較|使い分け|どれがいい)/.test(normalizeInput(revision.tail)))result=compareItems(pair);
        else{
          var detailed=findItemDetailed(revision.tail),purpose=purposeScores(revision.tail),item=detailed.item||(purpose[0]&&purpose[0].item)||roughFollowupItem(revision.tail);
          if(item){var intents=featureIntents(revision.tail,item);result=intents.length?answerFeatures(item,intents,true,revision.tail):explainItem(item,true);}
        }
      }
    }
    if(!result||!result.handled)return null;
    result.data=result.data||{};result.data.siteInlineGoalRevision=true;
    result.data.replacedSiteItems=revision.leftItems.map(function(x){return x.id;});
    var selected=result.data.siteItem&&BY_ID[result.data.siteItem],prefix=selected?'わかりました。「'+selected.name+'」の方ですね。':'わかりました。言い直した後の内容を優先します。';
    result.answer=prefix+'\n'+String(result.answer||'');
    return result;
  }
  function deicticOpenCue(text){
    var t=normalizeInput(text);
    return /^(?:(?:うん|はい|じゃあ|じゃ|では|それで|で|あと|それと|よし|なら)[、,\s]*)*(?:それ|そこ|ページ|そのページ|そっち|これ|このページ|あれ|あそこ|あのページ|あっち)?[、,\s]*(?:を)?(?:開いて|開けて|見せて|出して|行きたい|連れてって)[。！!？?]*$/.test(t);
  }

  function featureIntents(text,item){
    var t=normalizeInput(text),page=sourcePage(item),facts=page&&page.facts||{},out=[];
    if(!page)return out;
    function has(key){return !!S(facts[key]);}
    function add(key,cond){if(cond&&has(key)&&out.indexOf(key)<0)out.push(key);}

    var materialTotalCue=!!(item&&(item.id==='tsukumo'||item.id==='mado'||item.id==='kishin')&&/合計(?:は|って|を|の見方|どう見る|どう出す|出し方|の出し方|を出す方法)?[？?。！!]*$/.test(t));
    add('selection_count',/(?:何個(?:まで)?|いくつ(?:まで)?|最大(?:で)?何個|上限(?:は)?何個).*(?:選|入れ|登録|まで|可能|でき)|(?:選|入れ|登録).*(?:何個|いくつ|最大|上限)|選択数|最大選択|何個まで[？?。！!]*$|(?:どっちも|両方|どれも).*(?:何個|[0-9]+個|同じ|一緒)|[0-9]+個(?:まで)?(?:なの|ですか|で合って|でいい|も同じ|も一緒)?[？?。！!]*$/.test(t)||materialTotalCue);
    add('types',/(?:シングル|ダブル|個人|団体|形式|何種類|種類.*(?:ある|選)|どんな種類)/.test(t));
    // 演出設定やシャッフルは「参加」「ルーレット」という一般語より先に判定する。
    add('categories',/(?:音|効果音|紙吹雪|演出).*(?:消|切|止|OFF|オフ|入|ON|オン)|(?:消|切|止|OFF|オフ).*(?:音|効果音|紙吹雪|演出)/i.test(t));
    add('history',/(?:履歴|当選者|当たった人|候補に戻|全員戻)/.test(t));
    var randomCue=item&&item.id==='roulette'
      ?/(?:ランダム|シャッフル|抽選|確率|何パー|別動画)/
      :/(?:ランダム|シャッフル|抽選|ルーレット|確率|何パー|別動画)/;
    add('random',randomCue.test(t));
    add('entry',/(?:参加|エントリー|メンバー登録|徒党登録|登録方法|何人|人数)/.test(t));
    add('schedule',/(?:日程|日時|時間|時刻|候補日|開催日|複数.*(?:日|候補)|何日)/.test(t));
    add('progress',/(?:勝敗|勝ち負け|勝者|敗者).*(?:付け|入力|決め|進め|登録)|(?:大会|トーナメント).*(?:進め方|進行)/.test(t));
    add('filter',/(?:絞り込|絞れ|絞れる|フィルタ|地域|町.*(?:選|解除|絞)|検索条件)/.test(t));
    var shortReflectQuestion=!!(item&&(item.id==='stats'||item.id==='retainer')&&/(?:九十九|魔導結晶|魔導|鎮魂符|鬼神石)(?:だけ|のみ|しか)?(?:は|って|だと|なら|も)?[？?。！!]*$/.test(t));
    add('reflect',/(?:反映|連携|取り込|取り込みたい|入れられ|入れれる|入れたい|いれたい|入らない|入れられない|いれられない|使える|使えない|使いたい|表に入|合計を入|能力計算.*(?:九十九|魔導|鎮魂|鬼神石)|家臣.*(?:九十九|魔導|鎮魂|鬼神石)|(?:九十九|魔導結晶|魔導|鎮魂符|鬼神石).*(?:能力計算|家臣).*(?:に|へ)?入る|(?:能力計算|家臣計算).*(?:に|へ)?入る|(?:九十九|魔導結晶|魔導|鎮魂符|鬼神石).*(?:入れる|いれる).*(?:なら|場合|どっち|どれ))/.test(t)||shortReflectQuestion);
    add('share',/(?:共有|URL|リンクをコピー|URL.*(?:送|渡)|送れる|JSON|書き出|読込|読み込)/i.test(t));
    add('save',/(?:保存|画像|スクショ|スクリーンショット|ダウンロード)/.test(t));
    add('zoom',/(?:拡大|縮小|倍率|ズーム|100%|125%|150%|175%|200%)/.test(t));
    add('reset',/(?:リセット|初期化|やり直|元に戻|全部消|解除方法|消し方)/.test(t));
    add('sort',/(?:並べ替|ソート|優先|高い順|安い|安い順|値段|必要個数|個数が少|種類が少|少ない順|最安|最小個数|ベスト10|順番|ランキング)/.test(t));
    var columnWords=(t.match(/(?:因子|職業|コスト|能力|ステータス|育成技能|武器|固有技能|入手|番号)/g)||[]);
    var materialAcquisitionCue=!!(item&&(item.id==='kishin'||item.id==='tsukumo'||item.id==='mado')&&/(?:入手(?:先|方法)?|どこで(?:取れる|とれる|手に入る)|どこから(?:取れる|とれる|入手)|取り方|とり方)/.test(t)&&/(?:開いて|開けて|見せて|出して|ページ|一覧|どこを見|どこで確認)/.test(t));
    var specialColumns=!!(item&&((item.id==='meibutsu'&&/(?:合計|種類)/.test(t))||(item.id==='chinkon'&&/(?:技能一覧|鎮魂符一覧|解放内容)/.test(t))));
    add('columns',materialAcquisitionCue||specialColumns||/(?:何が載|何が見|表示項目|項目|列|一覧.*内容|どんな情報)/.test(t)||(columnWords.length>=2&&/(?:見られ|見れる|載って|確認|分かる|全部)/.test(t)));
    var pageInternalInput=!!(item&&((item.id==='seikai'&&/(?:武曲|禄存|破軍|文曲|廉貞|巨門|貪狼).*(?:見たい|見せて|開いて|選びたい|にして)/.test(t))||(item.id==='chinkon'&&/(?:頭|胴|左|腕|首|腰|右|足).*(?:設定|登録|選びたい|見たい)/.test(t))));
    add('inputs',pageInternalInput||/(?:何を入力|入力項目|どこに入力|どこへ入|入力するもの|何入れる|何を設定|設定するもの|どこを設定|設定項目|入力.*(?:計算|する)|計算.*入力)/.test(t));
    add('categories',/(?:何種類|種類|カテゴリ|分類|系統|何がある|選択肢|どれがある|何を選|部位|何か所|何箇所|どの場所|場所(?:は|一覧|どれ|何)|いくつ.*(?:場所|章|地域)|何因縁|因縁.*(?:何個|いくつ|まで))/.test(t));
    add('back',/(?:戻る|戻り先|トップへ|前のページ|どこに戻)/.test(t));
    add('related',/(?:関連|どこから行|つなが|移動でき|行ける|御蔵番.*名物|名物.*(?:どこから|開ける|見られる|見れる))/.test(t));
    add('advanced',/(?:マスター|差し替|上級|formations|CSV|ファイル)/i.test(t));
    add('download',/(?:ダウンロード|test\.xlsx|左上.*ボタン)/i.test(t));
    return out;
  }
  function featureIntent(text,item){var a=featureIntents(text,item);return a.length?a[0]:'';}
  function featureBody(item,intent,text){
    var page=sourcePage(item),facts=page&&page.facts||{},t=normalizeInput(text);
    if(intent==='columns'&&item&&(item.id==='kishin'||item.id==='tsukumo'||item.id==='mado')&&/(?:入手|どこで|取り方|とり方)/.test(t)){
      return '一覧の「入手」列で入手先を確認できます。必要なら、見たいものの名前や番号を続けて教えてください。';
    }
    if(intent==='inputs'&&item&&item.id==='seikai'){
      var stone=t.match(/(武曲|禄存|破軍|文曲|廉貞|巨門|貪狼)/);
      if(stone)return '「'+stone[1]+'」のボタンを押すと、対応する説明画像へ切り替わります。';
    }
    if(intent==='inputs'&&item&&item.id==='chinkon'){
      var part=t.match(/(?:^|[\s、])(頭|胴|左|腕|首|腰|右|足)(?:[\s、]|を|の|$)/);
      if(part)return '「'+part[1]+'」の枠を押し、メイン選択と2枠目選択を行って、+25〜+200の解放内容を確認して登録します。';
    }
    if(intent==='reflect'){
      var t=normalizeInput(text);
      if(item&&(item.id==='stats'||item.id==='retainer')){
        if(/鬼神石/.test(t)&&facts.reflect_kishin)return S(facts.reflect_kishin);
        if(/鎮魂符/.test(t)&&facts.reflect_chinkon)return S(facts.reflect_chinkon);
        if(/魔導結晶|魔導/.test(t)&&facts.reflect_mado)return S(facts.reflect_mado);
        if(/九十九/.test(t)&&facts.reflect_tsukumo)return S(facts.reflect_tsukumo);
      }
    }
    return S(facts[intent]);
  }
  function reflectBodies(item,text){
    var page=sourcePage(item),facts=page&&page.facts||{},t=normalizeInput(text),out=[],seen={};
    function add(key){var body=S(facts[key]);if(body&&!seen[body]){seen[body]=1;out.push(body);}}
    if(item&&(item.id==='stats'||item.id==='retainer')){
      // 「九十九だけ？」のように“それ以外もあるか”を聞かれた場合は、
      // 個別要素だけでなく計算機全体の反映対象を答える。
      if(/(?:九十九|魔導結晶|魔導|鎮魂符|鬼神石).*?(?:だけ(?!ど|れ)|のみ|しか)/.test(t)){
        add('reflect');
        return out;
      }
      if(/九十九/.test(t))add('reflect_tsukumo');
      if(/魔導結晶|魔導/.test(t))add('reflect_mado');
      if(/鎮魂符/.test(t))add('reflect_chinkon');
      if(/鬼神石/.test(t))add('reflect_kishin');
    }
    if(!out.length)add('reflect');
    return out;
  }
  function featureSubjectIds(text){
    var t=normalizeInput(text),out=[];
    function add(id,re){if(re.test(t)&&out.indexOf(id)<0)out.push(id);}
    add('tsukumo',/九十九/);
    add('mado',/(?:魔導結晶|魔導)/);
    add('chinkon',/鎮魂符/);
    add('kishin',/鬼神石/);
    return out;
  }
  function featureSubjectLabel(id){
    return id==='tsukumo'?'九十九':id==='mado'?'魔導結晶':id==='chinkon'?'鎮魂符':id==='kishin'?'鬼神石':'';
  }

  function featureQuestionTarget(text,recent,cur){
    var t=normalizeInput(text),detailed=findItemDetailed(t),purpose=purposeScores(t),item=detailed.item||(purpose[0]&&purpose[0].item)||null;
    // 計算機を案内した直後の「九十九も入れれる？」は、九十九一覧ではなく反映先の計算機を主語にする。
    if(recent&&(recent.id==='stats'||recent.id==='retainer')&&/(?:反映|入れられ|入れれる|いれられ|いれれる|入れたい|いれたい|使える|使いたい|取り込みたい|表に入)/.test(t)&&featureIntent(t,recent))return recent;
    if(/能力計算|能力計算機/.test(t)&&featureIntent(t,BY_ID.stats))item=BY_ID.stats;
    else if(/家臣(?:計算|計算機|ステ|能力)/.test(t)&&featureIntent(t,BY_ID.retainer))item=BY_ID.retainer;
    if(item&&featureIntent(text,item))return item;
    if(recent&&featureIntent(text,recent))return recent;
    if(cur&&featureIntent(text,cur))return cur;
    return null;
  }
  function featureRequests(text,recent,cur){
    var t=normalizeInput(text),out=[],seen={};
    function add(item){
      if(!item||seen[item.id])return;
      var intents=featureIntents(t,item);if(!intents.length)return;
      seen[item.id]=1;out.push({item:item,intents:intents});
    }
    // 反映先の計算機が直前主題なら、部品名が書かれていても計算機側の操作として答える。
    if(recent&&(recent.id==='stats'||recent.id==='retainer')&&/(?:反映|入れられ|入れれる|いれられ|いれれる|入れたい|いれたい|使える|使いたい|取り込みたい|表に入)/.test(t)){
      add(recent);if(out.length)return out;
    }
    var explicit=mentionedItems(t);
    explicit.forEach(add);

    // 計算機と素材ページが同時に書かれた反映質問は、語順から主語を一つに決めて重複説明を避ける。
    // 例: 「家臣計算で九十九を入れれる？」は家臣計算機、
    //     「九十九は何個で能力計算に反映できる？」は九十九を主語にする。
    if(out.length>1){
      var calcReq=null,partReqs=[];
      out.forEach(function(req){
        if(req.item.id==='stats'||req.item.id==='retainer')calcReq=calcReq||req;
        if(req.item.id==='tsukumo'||req.item.id==='mado'||req.item.id==='chinkon'||req.item.id==='kishin')partReqs.push(req);
      });
      var pairFeature=calcReq&&partReqs.length&&(
        calcReq.intents.indexOf('reflect')>=0||calcReq.intents.indexOf('selection_count')>=0||
        partReqs.some(function(req){return req.intents.indexOf('reflect')>=0||req.intents.indexOf('selection_count')>=0;})
      );
      if(pairFeature){
        var calcNames=calcReq.item.id==='stats'?'(?:能力計算|能力計算機|自分のステ|キャラのステ)':'(?:家臣計算|家臣計算機|家臣のステ|家臣能力)';
        var calcPos=(t.match(new RegExp(calcNames))||{}).index;
        var partPos=t.length+1;
        partReqs.forEach(function(req){
          var names=req.item.id==='tsukumo'?'九十九':req.item.id==='mado'?'(?:魔導結晶|魔導)':req.item.id==='chinkon'?'鎮魂符':'鬼神石';
          var m=t.match(new RegExp(names));if(m&&m.index<partPos)partPos=m.index;
        });
        return calcPos!==undefined&&calcPos<=partPos?[calcReq]:partReqs;
      }
    }
    // 「トップの動画はランダム？」はトップ全体ではなく動画再生機能を主語にする。
    if(out.length>1&&/(?:動画|video)/i.test(t)){
      for(var vi=0;vi<out.length;vi++)if(out[vi].item.id==='video')return [out[vi]];
    }
    // 「御蔵番から名物へ行ける？」は、移動先の名物一覧を会話主題として保持する。
    if(out.length>1&&/御蔵番.*名物/.test(t)&&/(?:行け|いける|開け|見られ|見れる|移動|どこから)/.test(t)){
      for(var oi=0;oi<out.length;oi++)if(out[oi].item.id==='meibutsu')return [out[oi]];
    }
    if(!out.length){
      var d=findItemDetailed(t),p=purposeScores(t),item=d.item||(p[0]&&p[0].item)||null;
      add(item);
    }
    if(!out.length)add(recent);
    if(!out.length)add(cur);
    return out;
  }

  function siteClauseLead(text){
    return S(text).replace(/^(?:そのあと|その後|続いて|次に|あと|それと|それから|じゃあ|では|それなら|また|一方(?:で)?|反対に)[、,\s]*/,'');
  }
  function siteClauseFeatureLead(text){
    var t=siteClauseLead(normalizeInput(text));
    if(/^(?:前者|後者|最初の方|最初のほう|二つ目|2つ目|もう片方)(?:は|って|だと|なら|も)?[？?。！!]*$/.test(t))return true;
    return /^(?:それ|そっち|こっち|その方|この方|前者|後者)?(?:は|って|だと|なら|も)?[、,\s]*(?:何個|いくつ|最大|保存|画像|スクショ|並べ替|ソート|優先|反映|入れられ|入れれる|使える|共有|URL|リンク|拡大|縮小|ズーム|リセット|初期化|入力|何を入力|何人|人数|日程|日時|履歴|音|紙吹雪|シャッフル|抽選|種類|形式|どこに|どこへ|戻り先|ダウンロード)/.test(t);
  }
  // 読点で区切られた文を無条件には分割しない。
  // 右側に別ページ名、または明確な別機能質問がある時だけ節境界として採用する。
  function splitSiteFeatureClauses(text){
    var raw=normalizeInput(text);if(!raw||raw.length<8||raw.length>420)return [];
    var re=/[、,；;。]|(?:けれども|けれど|だけど|ですが|けど|一方で)/g,m,last=0,parts=[];
    while((m=re.exec(raw))){
      var right=siteClauseLead(raw.slice(re.lastIndex));
      if(!right)continue;
      var rightItems=mentionedItems(right);
      if(!rightItems.length&&!siteClauseFeatureLead(right))continue;
      var left=S(raw.slice(last,m.index));
      if(left)parts.push(left);
      last=re.lastIndex;
    }
    var tail=S(raw.slice(last));if(tail)parts.push(tail);
    parts=parts.map(siteClauseLead).filter(Boolean);
    return parts.length>=2&&parts.length<=5?parts:[];
  }
  function featureCuePhrase(intent){
    var map={
      selection_count:'何個まで選べる',types:'何種類ある',categories:'何が選べる',history:'履歴は使える',random:'シャッフルできる',entry:'何人登録できる',schedule:'日程を設定できる',filter:'絞り込みできる',reflect:'反映できる',share:'共有できる',save:'保存できる',zoom:'拡大できる',reset:'リセットできる',sort:'並べ替えできる',columns:'何が見られる',inputs:'何を入力する',back:'どこに戻る',related:'どこから行ける',advanced:'上級機能はある',download:'ダウンロードできる'
    };
    return map[intent]||'';
  }
  function commonRequestFeature(requests){
    var keys=[];(requests||[]).forEach(function(req){(req.intents||[]).forEach(function(k){if(keys.indexOf(k)<0)keys.push(k);});});
    return keys.length===1?keys[0]:'';
  }
  function siteClauseFeatureGroups(text,recent,cur,candidates){
    var parts=splitSiteFeatureClauses(text);if(parts.length<2)return [];
    var groups=[],carryItem=recent||cur||null,carryFeature='';
    for(var i=0;i<parts.length;i++){
      var originalPart=parts[i],target=correctionTail(originalPart)||originalPart;
      target=siteClauseLead(target);
      var explicit=mentionedItems(target),selected=selectFromCandidates(target,candidates||[]),requests=[];
      if(selected){
        var selectedIntents=featureIntents(target,selected);
        if(!selectedIntents.length&&carryFeature){
          var selectedCue=featureCuePhrase(carryFeature);
          if(selectedCue)selectedIntents=featureIntents(target+' '+selectedCue,selected);
        }
        if(selectedIntents.length)requests=[{item:selected,intents:selectedIntents}];
      }
      // 複数節の中だけは「魔導結晶の入手も」のような短い節を、
      // 単独のゲーム知識質問へ流さず「一覧の入手列を見る」という局所観点として束ねる。
      // 単独の「魔導結晶の入手は？」は従来どおり実データ回答側へ残す。
      if(explicit.length===1&&(explicit[0].id==='kishin'||explicit[0].id==='tsukumo'||explicit[0].id==='mado')&&/(?:入手(?:先|方法)?|取り方|とり方|どこで(?:取れる|とれる|手に入る))/.test(target)){
        var acquisitionReq=requests.length&&requests[0].item&&requests[0].item.id===explicit[0].id?requests[0]:null;
        if(!acquisitionReq){acquisitionReq={item:explicit[0],intents:[]};requests=[acquisitionReq];}
        if(acquisitionReq.intents.indexOf('columns')<0)acquisitionReq.intents.push('columns');
      }
      if(!requests.length)requests=featureRequests(target,carryItem,cur);
      // 「九十九は保存できるけど魔導は？」の後半は、直前節の観点を引き継ぐ。
      if(!requests.length&&carryFeature&&explicit.length&&/(?:は|って|だと|なら|も|どう|同じ|一緒|だけ|のみ)[？?。！!]*$/.test(target)){
        var cue=featureCuePhrase(carryFeature);
        if(cue)requests=featureRequests(target+' '+cue,carryItem,cur);
      }
      if(!requests.length)return [];
      groups.push({text:target,requests:requests});
      carryFeature=commonRequestFeature(requests);
      if(requests.length===1)carryItem=requests[0].item;
      else if(explicit.length===1)carryItem=explicit[0];
      else carryItem=null;
    }
    return groups.length>=2?groups:[];
  }
  function answerMixedSiteClauses(text,recent,cur,candidates){
    var parts=splitSiteFeatureClauses(text);if(parts.length<2)return null;
    var results=[],hasOpen=false,hasFeature=false;
    for(var i=0;i<parts.length;i++){
      var target=siteClauseLead(correctionTail(parts[i])||parts[i]);
      var explicit=mentionedItems(target),selected=selectFromCandidates(target,candidates||[]),item=selected||(explicit.length===1?explicit[0]:null),r=null;
      if(item){
        var intents=featureIntents(target,item);
        if(intents.length){r=answerFeatures(item,intents,true,target);hasFeature=true;}
        else if(hasNavigationCue(target)||/(?:開いて|開けて|見せて|出して|行きたい|連れてって)/.test(target)){r=openItem(item);hasOpen=true;}
      }
      if(!r)return null;
      results.push(r);
    }
    if(!hasOpen||!hasFeature)return null;
    var answers=[],links=[],seenLink={},items=[];
    results.forEach(function(r){
      if(r.answer)answers.push(String(r.answer));
      var d=r.data||{},id=String(d.siteItem||'');if(id&&items.indexOf(id)<0)items.push(id);
      (r.links||[]).forEach(function(l){var k=String(l&&l.url||'');if(k&&!seenLink[k]){seenLink[k]=1;links.push(l);}});
    });
    return {handled:true,mode:'サイト総合案内',answer:answers.join('\n\n'),links:links,data:{siteItems:items,siteMixedClauses:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
  }

  function answerClauseFeatureGroups(groups,withOpen){
    groups=(groups||[]).filter(Boolean);if(groups.length<2)return null;
    var entries=[],byId={},links=[],seenLink={},features=[];
    groups.forEach(function(group){
      (group.requests||[]).forEach(function(req){
        if(!req||!req.item)return;
        var id=req.item.id,entry=byId[id];
        if(!entry){entry={item:req.item,bodies:[],seen:{}};byId[id]=entry;entries.push(entry);}
        (req.intents||[]).forEach(function(intent){
          if(features.indexOf(intent)<0)features.push(intent);
          var bodies=intent==='reflect'?reflectBodies(req.item,group.text):[featureBody(req.item,intent,group.text)];
          bodies.forEach(function(body){body=S(body);if(body&&!entry.seen[body]){entry.seen[body]=1;entry.bodies.push(body);}});
        });
      });
    });
    entries=entries.filter(function(x){return x.bodies.length;});if(!entries.length)return null;
    if(withOpen!==false)entries.forEach(function(entry){
      if(entry.item.id==='video')return;
      var l=itemLink(entry.item),key=String(l.url||'');if(!seenLink[key]){seenLink[key]=1;links.push(l);}
    });
    var ids=entries.map(function(x){return x.item.id;}),answer='質問の対象ごとに分けると、こちらなのですよ。\n'+entries.map(function(entry){return '・'+entry.item.name+'：'+entry.bodies.join(' ');}).join('\n');
    var data={siteItems:ids,siteFeatures:features,siteClauseBinding:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''};
    if(ids.length===1)data.siteItem=ids[0];
    if(features.length===1)data.siteFeature=features[0];
    return {handled:true,mode:'サイト総合案内',answer:answer,links:links,data:data};
  }

  function answerFeatures(item,intents,withOpen,text){
    var list=[],seen={};(intents||[]).forEach(function(intent){
      var bodies=intent==='reflect'?reflectBodies(item,text):[featureBody(item,intent,text)];
      bodies.forEach(function(body){if(!body||seen[body])return;seen[body]=1;list.push({intent:intent,body:body});});
    });
    if(!item||!list.length)return null;
    var answer='「'+item.name+'」についてですね。';
    if(list.length===1)answer+=list[0].body;
    else answer+='\n'+list.map(function(x){return '・'+x.body;}).join('\n');
    var links=[];
    if(withOpen!==false&&!item.external&&item.id!=='video')links=[itemLink(item)];
    return {handled:true,mode:'サイト総合案内',answer:answer,links:links,data:{siteItem:item.id,siteFeature:list[0].intent,siteFeatures:list.map(function(x){return x.intent;}),siteFeatureSubjects:featureSubjectIds(text),verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
  }
  function answerFeature(item,intent,withOpen,text){return answerFeatures(item,[intent],withOpen,text);}
  function answerFeatureRequests(requests,withOpen,text){
    requests=(requests||[]).filter(Boolean);if(!requests.length)return null;
    if(requests.length===1)return answerFeatures(requests[0].item,requests[0].intents,withOpen,text);
    var lines=[],links=[],seenLink={},items=[],features=[];
    requests.forEach(function(req){
      var bodies=[],seenBody={};
      (req.intents||[]).forEach(function(intent){
        var parts=intent==='reflect'?reflectBodies(req.item,text):[featureBody(req.item,intent,text)];
        parts.forEach(function(body){if(body&&!seenBody[body]){seenBody[body]=1;bodies.push(body);if(features.indexOf(intent)<0)features.push(intent);}});
      });
      if(!bodies.length)return;
      items.push(req.item.id);lines.push('・'+req.item.name+'：'+bodies.join(' '));
      if(withOpen!==false&&req.item.id!=='video'){var l=itemLink(req.item),k=String(l.url||'');if(!seenLink[k]){seenLink[k]=1;links.push(l);}}
    });
    if(!lines.length)return null;
    return {handled:true,mode:'サイト総合案内',answer:'確認できる内容はこちらなのですよ。\n'+lines.join('\n'),links:links,data:{siteItems:items,siteFeatures:features,siteFeatureSubjects:featureSubjectIds(text),verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
  }

  // 一つのページを明示して「開いて、保存方法も教えて」のように二段で頼まれた時は、
  // 後半だけに縮めず、ページを開く案内と機能説明を一つの回答へまとめる。
  function answerExplicitOpenAndFeature(text,ctx){
    var t=normalizeInput(text);if(!/(?:開いて|開けて|見せて|出して)/.test(t))return null;
    // 比較候補がある状態の「能力計算に入るやつだけ開いて」は、
    // 能力計算ページを開いて説明する依頼ではなく、候補を条件で絞る依頼。
    // 単一ページの二段要求より、候補集合の条件判定を優先する。
    if(ctx&&(ctx.candidates||[]).length>1&&candidateConditionalPlan(t,ctx.candidates))return null;
    var explicit=mentionedItems(t);if(explicit.length!==1)return null;
    var item=explicit[0],intents=featureIntents(t,item),help=pageHelpCue(t,item,item),result=null;
    if(!intents.length&&!help)return null;
    if(intents.length)result=answerFeatures(item,intents,true,t);
    else result=explainItem(item,true);
    if(!result)return null;
    result.answer='「'+item.name+'」を開けるようにしました。\n'+String(result.answer||'');
    result.data=result.data||{};result.data.siteOpenAndFeature=true;result.data.siteOpen=true;
    ctx=ctx||{};
    if((ctx.candidates||[]).some(function(x){return x&&x.id===item.id;}))result=retainCandidateContext(result,ctx.candidates,item,ctx.candidateKind,ctx.sourceCandidates,ctx.conditions);
    return result;
  }


  function retainCandidateContext(result,candidates,selected,kind,sourceCandidates,conditions){
    if(!result||!result.data||!selected)return result;
    var ids=[],seen={};(candidates||[]).forEach(function(item){if(item&&!seen[item.id]){seen[item.id]=1;ids.push(item.id);}});
    if(ids.length){
      result.data.siteCandidates=ids;result.data.candidates=ids;
      if(!Array.isArray(result.data.siteSourceCandidates)||!result.data.siteSourceCandidates.length){var src=uniqueCandidateItems(sourceCandidates&&sourceCandidates.length?sourceCandidates:candidates);result.data.siteSourceCandidates=src.map(function(x){return x.id;});}
      if(kind==='comparison')result.data.siteComparison=ids.slice();
      if(!Array.isArray(result.data.siteConditions)&&conditions&&conditions.length)result.data.siteConditions=conditionSnapshot(conditions);
    }
    result.data.selectedSiteItem=selected.id;
    return result;
  }

  function homeLink(){return link('トップページを開く','');}
  function itemLink(item){if(item.id==='video')return homeLink();return link(item.name+'を開く',item.path,item.external);}
  function repeatGuideLinkCue(text){
    var t=normalizeInput(text);
    return /^(?:(?:さっき|直前|今|その|この|前)(?:の)?[、,\s]*)?(?:リンク|URL)(?:を)?(?:だけ|もう一回|もう一度|再掲|また|貼って|張って|ちょうだい|ください|見せて|出して|開いて)?[。！!？?]*$/i.test(t);
  }
  function latestImmediateGuideLinkContext(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var meta=x.meta||{},data=meta.data||{},raw=Array.isArray(meta.links)?meta.links:[];
      if(!data.siteGuide||data.siteGuideContextCleared||String(data.siteItem||'')==='__site_guide_context_cleared__'||!raw.length)return null;
      var links=[];raw.slice(0,8).forEach(function(v){
        if(typeof v==='string'){if(v)links.push({label:'リンクを開く',url:v});return;}
        if(!v||typeof v!=='object')return;var url=String(v.url||v.href||'');if(!url)return;
        var copy={};Object.keys(v).forEach(function(k){copy[k]=v[k];});copy.url=url;if(!copy.label)copy.label=String(v.title||'リンクを開く');links.push(copy);
      });
      return links.length?{links:links,data:data}:null;
    }
    return null;
  }
  function copyGuideLinkContextData(source,seed){
    source=source||{};var data=seed||{},keys=['siteItem','siteFeature','siteFeatureSubjects','siteItems','siteComparison','candidates','siteCandidates','siteSourceCandidates','siteOpenedItems','siteExcludedItems','siteConditions','selectedSiteItem','previousSelectedSiteItem','siteLinkMissRejectedItem','needsClarification','siteVagueCapability','siteVagueCapabilityClarification','siteVagueCapabilityFollowup','siteVagueCapabilityAnswer','stoneName','stoneId'];
    keys.forEach(function(key){
      var value=source[key];
      if(Array.isArray(value))data[key]=value.slice(0,12);
      else if(value!==undefined&&value!==null&&value!=='')data[key]=value;
    });
    return data;
  }
  function repeatGuideLinks(history){
    var prior=latestImmediateGuideLinkContext(history);if(!prior)return null;
    var data=copyGuideLinkContextData(prior.data,{siteRepeatedLinks:true,siteExactLinkRecall:true});
    return {handled:true,mode:'サイト総合案内',answer:prior.links.length===1?'直前のリンクはこちらです。':'直前に案内したリンクはこちらです。',links:prior.links,data:data};
  }
  function guideConversationReturnCue(text){
    var t=normalizeInput(text);
    if(/^(?:(?:さっき|直前|前|今まで)(?:の)?[、,\s]*)?(?:(?:サイト|ページ|リンク)(?:の)?|たいらの野望の)?案内(?:の話|の続き|のところ)?(?:に|へ)?戻(?:って|ろう|して|りたい|る)?[。！!？?]*$/.test(t))return true;
    if(/^(?:(?:さっき|直前|前)(?:の)?[、,\s]*)?比較(?:の話|の続き|のところ)?(?:に|へ)?戻(?:って|ろう|して|りたい|る)?[。！!？?]*$/.test(t))return true;
    if(/^(?:(?:さっき|直前|前)(?:の)?[、,\s]*)?(?:案内|サイト|ページ|比較)(?:の話)?(?:の)?続き(?:を)?(?:お願い|続けて|見せて|再開して)?[。！!？?]*$/.test(t))return true;
    if(/^(?:その|この|あの)(?:話|話題|やつ|ところ)(?:に|へ)?戻(?:って|ろう|して|りたい|る)?[、,\s]*(?:続き(?:から|を)?(?:お願い|続けて|やろう|やって|再開して)?|続けよう)?[。！!？?]*$/.test(t))return true;
    if(/^(?:(?:さっき|直前|前)(?:の)?[、,\s]*)?(?:サイト|ページ|リンク)(?:の)?(?:案内|話|続き|ところ)(?:に|へ)?戻(?:って|ろう|して|りたい|る)?[。！!？?]*$/.test(t))return true;
    if(/^(?:(?:さっき|直前|前)(?:の)?[、,\s]*)?案内して(?:いた|た)(?:やつ|もの|ページ|ところ)(?:に|へ)?戻(?:って|ろう|して|りたい|る)?[。！!？?]*$/.test(t))return true;
    if(/^(?:(?:じゃあ|では|そろそろ|また)[、,\s]*)?(?:さっきの)?続き(?:を)?(?:やろう|やろ|続けよう|続けよ|再開しよう|再開しよ)[。！!？?]*$/.test(t)||/^(?:また|そろそろ)[、,\s]*(?:始めよう|始めよ|再開しよう|再開しよ)[。！!？?]*$/.test(t))return true;
    return /^(?:さっき|直前|前)(?:の)?(?:やつ|ところ|続き)(?:を)?(?:続けて|お願い|見せて|再開して)[。！!？?]*$/.test(t);
  }
  function guideConversationReturnTail(text){
    var t=normalizeInput(text),patterns=[
      /^(?:(?:さっき|直前|前|今まで)(?:の)?[、,\s]*)?(?:(?:サイト|ページ|リンク)(?:の)?|たいらの野望の)?案内(?:の話|の続き|のところ)?(?:に|へ)?戻(?:って|ろう|して|りたい|る)[、,。\s]+(.+)$/,
      /^(?:(?:さっき|直前|前)(?:の)?[、,\s]*)?比較(?:の話|の続き|のところ)?(?:に|へ)?戻(?:って|ろう|して|りたい|る)[、,。\s]+(.+)$/,
      /^(?:(?:さっき|直前|前)(?:の)?[、,\s]*)?(?:サイト|ページ|リンク)(?:の)?(?:案内|話|続き|ところ)(?:に|へ)?戻(?:って|ろう|して|りたい|る)[、,。\s]+(.+)$/,
      /^(?:その|この|あの)(?:話|話題|やつ|ところ)(?:に|へ)?戻(?:って|して)[、,\s]*(?:続き(?:から|を)?(?:やろう|やって|続けよう|再開して)?)[、,。\s]+(.+)$/,
      /^(?:(?:さっき|直前|前)(?:の)?[、,\s]*)?案内して(?:いた|た)(?:やつ|もの|ページ|ところ)(?:に|へ)?戻(?:って|ろう|して|りたい|る)[、,。\s]+(.+)$/,
      /^(?:(?:じゃあ|では|そろそろ|また)[、,\s]*)?(?:さっきの)?続き(?:を)?(?:やろう|やろ|続けよう|続けよ|再開しよう|再開しよ)[、,。\s]+(.+)$/,
      /^(?:また|そろそろ)[、,\s]*(?:始めよう|始めよ|再開しよう|再開しよ)[、,。\s]+(.+)$/,
      /^(?:作業を)?再開(?:しよう|しよ|して)[、,。\s]+(.+)$/,
      /^(?:休憩(?:は)?終わり|休憩終わった|休憩おわり)[、,。\s]+(.+)$/
    ];
    for(var i=0;i<patterns.length;i++){
      var match=t.match(patterns[i]),tail=match&&S(match[1]||'');
      if(tail&&!/^(?:ください|お願い|続けて)[。！!？?]*$/.test(tail))return tail;
    }
    return'';
  }
  function guidePauseTurns(entries){
    var list=Array.isArray(entries)?entries:[];if(!list.length)return 0;
    if(list.length%2!==0||list.length>6)return-1;
    for(var i=0;i<list.length;i+=2){
      var user=list[i],assistant=list[i+1];
      if(!user||user.role!=='user'||!assistant||assistant.role!=='assistant')return-1;
      var meta=assistant.meta||{},data=meta.data||{},mode=S(meta.mode||'');
      if(data.siteGuide||data.siteGuideContextCleared||data.conversationRepair||data.contextBoundary||data.topicSwitch)return-1;
      if(mode&&mode!=='日常会話')return-1;
    }
    return list.length/2;
  }
  function latestPausedGuideContext(history){
    var h=Array.isArray(history)?history:[],end=Math.max(0,h.length-1),lower=Math.max(0,end-7);
    for(var i=end-1;i>=lower;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var meta=x.meta||{},data=meta.data||{};
      if(data.siteGuideContextCleared||String(data.siteItem||'')==='__site_guide_context_cleared__')return null;
      if(!data.siteGuide)continue;
      var between=h.slice(i+1,end),pauseTurns=guidePauseTurns(between);if(pauseTurns<0)return null;
      var raw=Array.isArray(meta.links)?meta.links:[],links=[];
      raw.slice(0,8).forEach(function(v){
        if(typeof v==='string'){if(v)links.push({label:'リンクを開く',url:v});return;}
        if(!v||typeof v!=='object')return;var url=String(v.url||v.href||'');if(!url)return;
        var copy={};Object.keys(v).forEach(function(k){copy[k]=v[k];});copy.url=url;if(!copy.label)copy.label=String(v.title||'リンクを開く');links.push(copy);
      });
      var ids=Array.isArray(data.siteComparison)&&data.siteComparison.length?data.siteComparison:(data.siteCandidates||data.candidates||data.siteItems||[]),items=Array.isArray(ids)?ids.map(function(id){return BY_ID[id];}).filter(Boolean):[];
      if(items.length>1&&links.length<2)links=items.slice(0,8).map(itemLink);
      else if(!links.length&&items.length)links=items.slice(0,8).map(itemLink);
      if(!links.length&&data.siteItem&&BY_ID[data.siteItem])links=[itemLink(BY_ID[data.siteItem])];
      if(!links.length)return null;
      return {links:links,data:data,items:items,pauseTurns:pauseTurns,text:S(x.text)};
    }
    return null;
  }
  function pausedGuideFeatureFollowupCue(text){
    var t=normalizeInput(text);
    if(/^(?:(?:じゃあ|では|それなら|で|あと|それと)[、,\s]*)?(?:それ|その話|さっきの(?:話|説明)?|今の(?:話|説明)?)(?:って|は|を)?(?:どうやるの|どうするの|どう見るの|どう確認するの|やり方(?:は)?|見方(?:は)?|もう少し教えて|詳しく教えて|続き(?:は|教えて)?)[。！!？?]*$/.test(t))return true;
    return /^(?:その|この|あの)(?:話|話題|やつ|ところ)(?:に|へ)?戻(?:って|して)[、,\s]*(?:続き(?:から|を)?(?:お願い|続けて|やろう|やって|再開して)?|続けよう)[。！!？?]*$/.test(t);
  }
  function answerPausedGuideFeatureFollowup(text,history){
    if(!pausedGuideFeatureFollowupCue(text))return null;
    var prior=latestPausedGuideContext(history);if(!prior)return null;
    var data=prior.data||{},feature=String(data.siteFeature||''),item=data.siteItem&&BY_ID[data.siteItem]||data.selectedSiteItem&&BY_ID[data.selectedSiteItem]||prior.items[0]||itemFromUrl(prior.links[0]&&prior.links[0].url);
    if(!feature||!item)return null;
    var page=sourcePage(item),facts=page&&page.facts||{};if(!S(facts[feature]))return null;
    var query=featureCuePhrase(feature);
    if(feature==='columns'&&/入手/.test(prior.text||''))query='入手をどこで確認する';
    var result=answerFeatures(item,[feature],true,query||text);if(!result)return null;
    result.answer=(prior.pauseTurns>0?'さっきの「'+item.name+'」の話ですね。':'「'+item.name+'」の続きですね。')+'\n'+String(result.answer||'');
    result.data=result.data||{};result.data.siteGuideConversationReturn=true;result.data.siteGuideReturnFromPause=prior.pauseTurns>0;result.data.siteGuidePauseTurns=prior.pauseTurns;result.data.siteGuideFeatureContinuation=true;
    var candidates=(data.siteCandidates||data.candidates||[]).map(function(id){return BY_ID[id];}).filter(Boolean);
    if(candidates.length&&candidates.some(function(x){return x.id===item.id;}))result=retainCandidateContext(result,candidates,item,Array.isArray(data.siteComparison)&&data.siteComparison.length?'comparison':'choice',(data.siteSourceCandidates||[]).map(function(id){return BY_ID[id];}).filter(Boolean),data.siteConditions||[]);
    return result;
  }
  function answerGuideConversationReturn(history){
    var prior=latestPausedGuideContext(history);if(!prior)return null;
    var data=copyGuideLinkContextData(prior.data,{siteGuideConversationReturn:true,siteGuideReturnFromPause:prior.pauseTurns>0,siteGuidePauseTurns:prior.pauseTurns,siteExactLinkRecall:true}),answer='',items=uniqueCandidateItems(prior.items),returnLead=prior.pauseTurns>1?'世間話の前の案内へ戻りますね。':'さっきの案内に戻りました。';
    var stoneName=prior.links.length===1?stoneNameFromGuideUrl(prior.links[0]&&prior.links[0].url):'';
    if(stoneName){
      answer=returnLead+' 星海の荒石の「'+stoneName+'」はこちらから開けます。';
      data.siteItem='seikai';data.stoneName=stoneName;
    }else if(items.length>1){
      var selected=data.selectedSiteItem&&BY_ID[data.selectedSiteItem];
      answer=(prior.pauseTurns>1?'世間話の前の比較へ戻りますね。':'比較の続きに戻りました。')+' 候補は'+candidateNames(items)+'です。';
      if(selected&&items.some(function(x){return x.id===selected.id;}))answer+=' 今選んでいるのは「'+selected.name+'」です。';
      else answer+=' 何に使いたいか言ってくれれば、一つへ絞れます。';
      data.siteComparison=items.map(function(x){return x.id;});data.siteCandidates=data.siteComparison.slice();data.candidates=data.siteComparison.slice();
    }else{
      var item=data.siteItem&&BY_ID[data.siteItem]||items[0]||itemFromUrl(prior.links[0]&&prior.links[0].url);
      answer=item?returnLead+' 「'+item.name+'」はこちらから続けられます。':returnLead+' こちらから続けられます。';
      if(item)data.siteItem=item.id;
    }
    return {handled:true,mode:'サイト総合案内',answer:answer,links:prior.links,data:data};
  }
  function answerGuideConversationReturnWithGoal(text,history,opt){
    if(opt&&opt._guideReturnWithGoal)return null;
    var tail=guideConversationReturnTail(text);if(!tail)return null;
    var goalTail=tail.replace(/^([1-9１-９一二三四五六七八九])(?:つ目|個目)/,'$1番目');
    var prior=latestPausedGuideContext(history);if(!prior)return null;
    var resumedData=copyGuideLinkContextData(prior.data,{siteGuide:true}),base=Array.isArray(history)?history.slice():[];
    if(base.length&&base[base.length-1]&&base[base.length-1].role==='user')base.pop();
    base.push({role:'assistant',text:'',meta:{mode:'サイト総合案内',links:prior.links,data:resumedData}});
    base.push({role:'user',text:goalTail});
    var nested={};Object.keys(opt||{}).forEach(function(key){nested[key]=opt[key];});
    nested.original=goalTail;nested.history=base;nested._guideReturnWithGoal=true;
    var result=respond(goalTail,nested);if(!result||!result.handled)return null;
    result.data=result.data||{};result.data.siteGuideConversationReturn=true;result.data.siteGuideReturnFromPause=prior.pauseTurns>0;result.data.siteGuidePauseTurns=prior.pauseTurns;result.data.siteGuideReturnWithGoal=true;result.data.siteGuideReturnTarget=tail;
    result.answer='案内へ戻って、そのままご希望の内容を案内します。\n'+String(result.answer||'');
    return result;
  }
  function selectiveGuideLinkCue(text){
    var t=normalizeInput(text);
    if(!/(?:リンク|URL)/i.test(t)||repeatGuideLinkCue(t))return false;
    return /(?:[1-9１-９一二三四五六七八九](?:番目|個目)|上から|下から|先頭|末尾|最後|一番上|一番下|真ん中|中央|と|、|,|だけ)/.test(t)||mentionedItems(t).length>0;
  }
  function selectedGuideLinks(text,prior){
    var t=normalizeInput(text),list=prior&&Array.isArray(prior.links)?prior.links:[],out=[],seen={};if(list.length<2||!selectiveGuideLinkCue(t))return out;
    function addIndex(index){if(index>=0&&index<list.length&&!seen[index]){seen[index]=1;out.push(list[index]);}}
    if(/(?:上|先頭)から(?:の)?(?:2|２|二)(?:つ|個)(?:の)?(?:リンク|URL)/i.test(t)){addIndex(0);addIndex(1);return out;}
    if(/(?:下|末尾|最後)から(?:の)?(?:2|２|二)(?:つ|個)(?:の)?(?:リンク|URL)/i.test(t)){addIndex(list.length-2);addIndex(list.length-1);return out;}
    var fromTop=t.match(/(?:上|先頭)から([1-9１-９一二三四五六七八九])(?:番|番目|個目)(?:の)?(?:リンク|URL)/i);
    var fromBottom=t.match(/(?:下|末尾|最後)から([1-9１-９一二三四五六七八九])(?:番|番目|個目)(?:の)?(?:リンク|URL)/i);
    if(fromTop){addIndex(numberValue(fromTop[1])-1);return out;}
    if(fromBottom){addIndex(list.length-numberValue(fromBottom[1]));return out;}
    if(/(?:真ん中|中央)(?:の)?(?:リンク|URL)/i.test(t)&&list.length%2===1){addIndex(Math.floor(list.length/2));return out;}
    if(/(?:最後|一番下|末尾)(?:の)?(?:リンク|URL)/i.test(t)){addIndex(list.length-1);return out;}
    if(/(?:最初|一番上|先頭)(?:の)?(?:リンク|URL)/i.test(t)){addIndex(0);return out;}
    var ordinal=t.match(/([1-9１-９一二三四五六七八九])(?:番|番目|個目)(?:の)?(?:リンク|URL)/i);
    if(ordinal){addIndex(numberValue(ordinal[1])-1);return out;}

    var ct=compact(t);
    list.forEach(function(linkValue,index){
      var item=itemFromUrl(linkValue&&linkValue.url),keys=item?candidateKeys(item):[],label=compact(linkValue&&linkValue.label||'').replace(/を開く$/,'');if(label)keys.push(label);
      for(var i=0;i<keys.length;i++)if(keys[i]&&ct.indexOf(keys[i])>=0){addIndex(index);break;}
    });
    return out;
  }
  function selectGuideLinks(text,history){
    var prior=latestImmediateGuideLinkContext(history);if(!prior)return null;
    var chosen=selectedGuideLinks(text,prior);if(!chosen.length)return null;
    var data=copyGuideLinkContextData(prior.data,{siteLinkSelection:true,siteLinkSelectionCount:chosen.length,siteExactLinkRecall:true});
    if(chosen.length===1){
      var item=itemFromUrl(chosen[0]&&chosen[0].url);if(item){data.siteItem=item.id;data.selectedSiteItem=item.id;}
    }
    return {handled:true,mode:'サイト総合案内',answer:chosen.length===1?'指定されたリンクはこちらです。':'指定されたリンクはこちらです。',links:chosen,data:data};
  }
  function guideLinkDestinationCue(text){
    var t=normalizeInput(text);
    if(/^(?:リンク|URL)(?:の)?先(?:は|って)?(?:どこ|何|どのページ|何のページ)?[。！!？?]*$/i.test(t))return true;
    if(/^(?:これ|それ|このリンク|そのリンク|さっきのリンク|今のリンク)(?:は|って|を)?(?:押したら|開いたら)?[、,\s]*(?:どこ(?:に)?(?:飛ぶ|行く|いく|移動する|開く)?|何(?:が|を|の)?(?:開く|出る|ページ)?|どのページ|何のページ|リンク先)[。！!？?]*$/i.test(t))return true;
    return /^(?:これ|それ)?(?:を)?押したら[、,\s]*(?:何が開く|どこに飛ぶ|どのページ)[。！!？?]*$/.test(t);
  }
  function stoneNameFromGuideUrl(url){
    var s=String(url||'');
    for(var name in SEIKAI_STONES){
      if(!Object.prototype.hasOwnProperty.call(SEIKAI_STONES,name))continue;
      var stone=SEIKAI_STONES[name];
      if(new RegExp('(?:[?&]stone='+stone.id+'(?:[&#]|$)|#'+stone.key+'(?:$|[?&]))').test(s))return name;
    }
    return '';
  }
  function guideLinkDestination(linkValue){
    var url=String(linkValue&&linkValue.url||''),stoneName=stoneNameFromGuideUrl(url);
    if(stoneName)return '星海の荒石の「'+stoneName+'」表示';
    var item=itemFromUrl(url);if(item)return '「'+item.name+'」ページ';
    var label=String(linkValue&&linkValue.label||'リンク先').replace(/を開く$/,'');
    return '「'+label+'」';
  }
  function explainGuideLinkDestinations(history){
    var prior=latestImmediateGuideLinkContext(history);if(!prior)return null;
    var lines=prior.links.map(function(linkValue){return '・'+String(linkValue.label||'リンク')+'：'+guideLinkDestination(linkValue);});
    var answer=prior.links.length===1?'このリンクは、'+guideLinkDestination(prior.links[0])+'へ移動します。':'リンク先はこちらです。\n'+lines.join('\n');
    var data=copyGuideLinkContextData(prior.data,{siteLinkDestinationExplanation:true,siteLinkDestinationCount:prior.links.length,siteExactLinkRecall:true});
    return {handled:true,mode:'サイト総合案内',answer:answer,links:prior.links,data:data};
  }
  function exactGuideLinkOpenCue(text){
    var t=normalizeInput(text);
    return /^(?:(?:じゃあ|では|それなら|なら)[、,\s]*)?(?:それ|これ|そこ|そっち|そのページ|このページ|今の|さっきの)(?:を|に|へ)?(?:開いて|開けて|見せて|出して|行きたい|行って|いきたい|いって|飛びたい|お願い|でお願い)[。！!？?]*$/.test(t);
  }
  function openExactGuideLinks(history){
    var prior=latestImmediateGuideLinkContext(history);if(!prior)return null;
    var multiple=prior.links.length>1,data=copyGuideLinkContextData(prior.data,{siteExactLinkOpen:!multiple,siteLinkOpenNeedsSelection:multiple,siteExactLinkRecall:true});
    if(multiple)data.needsClarification=true;
    return {handled:true,mode:'サイト総合案内',answer:multiple?'リンクが複数あります。どのリンクを開くか、名前・順番・上や下で教えてください。':'では、このリンクから開けます。',links:prior.links,data:data};
  }
  function guideLinkMissCue(text){
    var t=normalizeInput(text);
    return /^(?:(?:あれ|ごめん|ごめんね)[、,\s]*)?(?:ここ|そこ|このページ|そのページ|今のページ|開いたページ|リンク先)(?:は|が)?(?:じゃなかった|ではなかった|じゃない|ではない|違った|ちがった)(?:[、,。\s]+.+)?[。！!？?]*$/.test(t)||/^(?:(?:一つ|ひとつ|いったん|一旦)?(?:前|元|候補)(?:に|へ)?[、,\s]*)?戻って[、,\s]*(?:別|ほか|他)(?:の|のページ|の候補)?(?:にして|を見たい|を開いて|は)?(?:[、,。\s]+.+)?[。！!？?]*$/.test(t);
  }
  function guideLinkMissTail(text){
    var t=normalizeInput(text),m=t.match(/(?:ここ|そこ|このページ|そのページ|今のページ|開いたページ|リンク先)(?:は|が)?(?:じゃなかった|ではなかった|じゃない|ではない|違った|ちがった)[、,。\s]+(.+)$/);
    if(!m)m=t.match(/戻って[、,\s]*(?:別|ほか|他)(?:の|のページ|の候補)?(?:にして|を見たい|を開いて|は)?[、,。\s]+(.+)$/);
    var tail=m&&S(m[1])||'';
    if(/^(?:別|別の|ほか|ほかの|他|他の)(?:ページ|候補)?[。！!？?]*$/.test(tail))return'';
    return tail;
  }
  function answerGuideLinkMiss(text,history,opt){
    if(!guideLinkMissCue(text))return null;
    var prior=latestImmediateGuideLinkContext(history);if(!prior)return null;
    var explicit=guideLinkMissTail(text);
    if(explicit&&!(opt&&opt._guideLinkMissRecovery)){
      var nested={};Object.keys(opt||{}).forEach(function(key){nested[key]=opt[key];});
      nested.original=explicit;nested._guideLinkMissRecovery=true;
      var redirected=respond(explicit,nested);
      if(redirected&&redirected.handled){
        redirected.data=redirected.data||{};redirected.data.siteLinkMissRecovery=true;
        var oldItem=prior.data&&prior.data.selectedSiteItem||prior.data&&prior.data.siteItem||'',oldLinkItem=prior.links.length===1&&itemFromUrl(prior.links[0]&&prior.links[0].url);
        redirected.data.previousSelectedSiteItem=oldItem||(oldLinkItem&&oldLinkItem.id)||'';
        redirected.answer='わかりました。今の案内先ではなく、こちらですね。\n'+String(redirected.answer||'');
        return redirected;
      }
    }
    if(prior.links.length===1&&stoneNameFromGuideUrl(prior.links[0]&&prior.links[0].url)){
      var stoneChoices=answerStoneAlternatives('別の',history);
      if(stoneChoices){stoneChoices.data.siteLinkMissRecovery=true;stoneChoices.answer='その荒石ではなかったのですね。\n'+stoneChoices.answer;return stoneChoices;}
    }
    var data=prior.data||{},rawIds=data.siteSourceCandidates||data.siteCandidates||data.candidates||data.siteComparison||data.siteItems||[],source=Array.isArray(rawIds)?rawIds.map(function(id){return BY_ID[id];}).filter(Boolean):[];
    var selected=data.selectedSiteItem&&BY_ID[data.selectedSiteItem]||data.siteItem&&BY_ID[data.siteItem]||null;
    if(!selected&&prior.links.length===1)selected=itemFromUrl(prior.links[0]&&prior.links[0].url);
    if(source.length>1&&selected){
      var remaining=uniqueCandidateItems(source).filter(function(x){return x.id!==selected.id;}),choice=candidateClarification(remaining,'「'+selected.name+'」ではなかったのですね。戻って選べるのは、','です。どれにしますか？');
      if(choice){
        choice.data.siteSourceCandidates=uniqueCandidateItems(source).map(function(x){return x.id;});choice.data.previousSelectedSiteItem=selected.id;choice.data.siteLinkMissRecovery=true;
        if(data.siteVagueCapability){choice.data.siteVagueCapability=data.siteVagueCapability;choice.data.siteVagueCapabilityClarification=true;choice.data.siteVagueCapabilityFollowup=true;}
        return choice;
      }
    }
    if(prior.links.length>1&&!selected){
      var multipleData=copyGuideLinkContextData(data,{siteLinkMissRecovery:true,siteLinkMissNeedsSelection:true,needsClarification:true});
      multipleData.needsClarification=true;
      return {handled:true,mode:'サイト総合案内',answer:'案内したリンクが複数あるので、どれを開いたかまでは分からないのですよ。違ったページの名前か順番を教えてください。',links:prior.links,data:multipleData};
    }
    return {handled:true,mode:'サイト総合案内',answer:'そこではなかったのですね。今の案内はいったん外しました。ページ名が分からなくても、「何をしたいか」をそのまま教えてください。',links:[],data:{siteItem:'__site_guide_context_cleared__',siteGuideContextCleared:true,siteLinkMissRecovery:true,previousSelectedSiteItem:selected&&selected.id||'',needsClarification:true}};
  }
  function guideLinkMissSelectionRequest(text,prior){
    var data=prior&&prior.data||{};if(!data.siteLinkMissNeedsSelection)return null;
    var items=[],seen={};(prior.links||[]).forEach(function(linkValue){
      var item=itemFromUrl(linkValue&&linkValue.url);if(item&&!seen[item.id]){seen[item.id]=1;items.push(item);}
    });
    if(items.length<2)return null;
    var t=normalizeInput(text),cleaned=t
      .replace(/^(?:違った(?:の|ページ)(?:は)?|開いた(?:の|ページ)(?:は)?|間違えた(?:の|ページ)(?:は)?)[、,\s]*/,'')
      .replace(/^(?:さっき|直前|今)(?:の)?[、,\s]*/,'')
      .replace(/^(?:(?:開いた|案内した)(?:リンク|ページ|候補)|リンク|ページ|候補)(?:の)?[、,\s]*/,'')
      .replace(/^([1-9１-９一二三四五六七八九])(?:つ目|個目)/,'$1番目');
    var selected=selectFromCandidates(cleaned,items,null),requested=!!selected||/^(?:[1-9１-９一二三四五六七八九](?:番|番目)?|最初|一番上|先頭|上の|前者|最後|一番下|末尾|下の|後者|真ん中|中央|そっち|そちら|こっち|こちら|それ|そのページ|開いた方|開いたほう|どっち|どちら)/.test(cleaned);
    return requested?{selected:selected,items:items,query:cleaned}:null;
  }
  function answerGuideLinkMissSelection(text,history){
    var prior=latestImmediateGuideLinkContext(history),request=guideLinkMissSelectionRequest(text,prior);if(!request)return null;
    var priorData=prior.data||{},source=uniqueCandidateItems(request.items),selected=request.selected;
    if(!selected){
      var unresolved=copyGuideLinkContextData(priorData,{siteLinkMissRecovery:true,siteLinkMissNeedsSelection:true,siteLinkMissSelectionUnresolved:true,needsClarification:true});
      return {handled:true,mode:'サイト総合案内',answer:'どのページが違ったか、まだ一つに決められないのですよ。「上の方」「二つ目」「鬼神石の方」のように教えてください。',links:prior.links,data:unresolved};
    }
    var remaining=source.filter(function(item){return item.id!==selected.id;}),data=copyGuideLinkContextData(priorData,{});
    data.siteComparison=[];data.siteItems=[];data.siteOpenedItems=[];data.siteExcludedItems=[selected.id];data.siteCandidates=remaining.map(function(item){return item.id;});data.candidates=data.siteCandidates.slice();data.siteSourceCandidates=source.map(function(item){return item.id;});
    data.previousSelectedSiteItem=selected.id;data.siteLinkMissRejectedItem=selected.id;data.siteLinkMissRecovery=true;data.siteLinkMissNeedsSelection=false;data.siteLinkMissSelectionResolved=true;
    if(remaining.length===1){
      var target=remaining[0];data.siteItem=target.id;data.selectedSiteItem=target.id;data.needsClarification=false;
      return {handled:true,mode:'サイト総合案内',answer:'違ったのは「'+selected.name+'」ですね。では、もう一つの「'+target.name+'」はこちらです。',links:[itemLink(target)],data:data};
    }
    data.siteItem='';data.selectedSiteItem='';data.needsClarification=true;
    return {handled:true,mode:'サイト総合案内',answer:'違ったのは「'+selected.name+'」ですね。残りは'+candidateNames(remaining)+'です。どれを開きますか？',links:remaining.slice(0,8).map(itemLink),data:data};
  }
  function postOpenGuideCue(text){
    var t=normalizeInput(text);
    if(/^(?:次|次は|この次|このあと|この後|それから)(?:は|どうする|何する|何をする|どうすればいい|何をすればいい)?[。！!？?]*$/.test(t))return true;
    return /^(?:(?:開いたら|開いたあと|開いた後|開いたけど|そこで|そこでは|そのページで|このページで|次に|まず)[、,\s]*)?(?:まず[、,\s]*)?(?:何をすればいい|何すればいい|何をする|何する|どう使う|どうすればいい|どこを見ればいい|どこを押せばいい)(?:の|ですか)?[。！!？?]*$/.test(t);
  }
  function postOpenGuideAnswer(history){
    var prior=latestImmediateGuideLinkContext(history);if(!prior)return null;
    var multiple=prior.links.length>1,data=copyGuideLinkContextData(prior.data,{sitePostOpenGuidance:!multiple,sitePostOpenNeedsSelection:multiple,siteExactLinkRecall:true,pageHelp:!multiple});
    if(multiple){
      data.needsClarification=true;
      return {handled:true,mode:'サイト総合案内',answer:'ページごとに次の操作が違います。どれを使うか、名前・順番・上や下で教えてください。',links:prior.links,data:data};
    }
    var linkValue=prior.links[0],url=String(linkValue&&linkValue.url||''),stoneName=stoneNameFromGuideUrl(url),item=itemFromUrl(url),answer='';
    if(stoneName){
      answer='リンクを開くと、星海の荒石の「'+stoneName+'」合成早見表が表示されます。そこで材料と完成能力を確認できます。';
      data.siteItem='seikai';data.siteInternal='stone';data.stoneName=stoneName;
    }else if(item){
      var usage=usageOf(item);
      answer='「'+item.name+'」を開いたら、'+(usage||item.desc);
      data.siteItem=item.id;data.selectedSiteItem=data.selectedSiteItem||item.id;data.verifiedSiteSource=!!sourcePage(item);
    }else{
      answer='リンク先を開いたら、ページ内の案内に沿って進めてください。';
    }
    return {handled:true,mode:'サイト総合案内',answer:answer,links:prior.links,data:data};
  }
  function continuedGuideDetailIntent(text){
    var t=normalizeInput(text);
    if(/^(?:(?:それ|これ|そこで|そこでは|そのページ|このページ)(?:で|では|は|って)?[、,\s]*)?(?:何を入力する|何入力する|何を入れる|何入れる|入力するのは何|入力項目は何)(?:の|ですか)?[。！!？?]*$/.test(t))return 'inputs';
    if(/^(?:(?:それ|これ|そこで|そこでは|そのページ|このページ)(?:で|では|は|って)?[、,\s]*)?(?:どこを押す|何を押す|どれを押す|どう操作する|操作はどうする|どう進める)(?:の|ですか)?[。！!？?]*$/.test(t))return 'operation';
    if(/^(?:(?:それ|これ|そこで|そこでは|そのページ|このページ)(?:で|では|は|って)?[、,\s]*)?(?:何が分かる|何がわかる|何を確認できる|どんな結果が出る|何が出る|何が表示される|何を見られる|何を見れる)(?:の|ですか)?[。！!？?]*$/.test(t))return 'result';
    return '';
  }
  function continuedGuideResultBody(item){
    if(!item)return'';
    var map={
      jinpo:'条件に合う6人編成と能力値、発動因縁、差替候補を確認できます。',
      stats:'入力した基礎能力・装備・付与などを合わせた最終能力を確認できます。',
      retainer:'入力した家臣能力・付与・九十九などを合わせた合計を確認できます。',
      food:'必要な食料を、最安・最小個数・種類が少ない候補ごとに確認できます。',
      kishin:'鬼神石の能力・入手先・選択中の8個合計・合成最低発現数を確認できます。',
      tsukumo:'九十九の力の能力・入手先・選択中の8個合計を確認できます。',
      mado:'魔導結晶の能力・入手先・選択中の8個合計を確認できます。'
    };
    return map[item.id]||item.desc;
  }
  function answerContinuedGuideDetailFromPrior(intent,prior){
    if(!intent||!prior)return null;
    var multiple=prior.links.length>1,data=copyGuideLinkContextData(prior.data,{siteContinuedDetail:!multiple,siteContinuedDetailNeedsSelection:multiple,siteContinuedDetailIntent:intent,siteExactLinkRecall:true,pageHelp:!multiple});
    if(multiple){
      data.needsClarification=true;
      return {handled:true,mode:'サイト総合案内',answer:'ページごとに確認できる内容が違います。どのページについて知りたいか、名前・順番・上や下で教えてください。',links:prior.links,data:data};
    }
    var linkValue=prior.links[0],url=String(linkValue&&linkValue.url||''),stoneName=stoneNameFromGuideUrl(url),item=itemFromUrl(url),answer='';
    if(stoneName){
      if(intent==='inputs')answer='数値の入力はありません。リンク先の「'+stoneName+'」合成早見表で材料と完成能力を確認します。';
      else if(intent==='operation')answer='リンクを開くと「'+stoneName+'」の合成早見表が表示されます。別の荒石を見る時は、上の名前ボタンで切り替えます。';
      else answer=stoneName+'の輝光に必要な材料と、完成時の能力が分かります。';
      if(stoneName==='文曲'&&intent==='result')answer+=' 文曲は紺碧・山吹・濡羽・朽葉の星光（金）を合成し、完成時は生命1500、知力250です。';
      data.siteItem='seikai';data.siteInternal='stone';data.stoneName=stoneName;data.siteFeature=intent==='inputs'?'inputs':intent;
    }else if(item){
      var page=sourcePage(item),facts=page&&page.facts||{};
      if(intent==='inputs')answer='「'+item.name+'」では、'+(S(facts.inputs)||usageOf(item));
      else if(intent==='operation')answer='「'+item.name+'」では、'+usageOf(item);
      else answer='「'+item.name+'」では、'+continuedGuideResultBody(item);
      data.siteItem=item.id;data.selectedSiteItem=data.selectedSiteItem||item.id;data.siteFeature=intent==='inputs'?'inputs':intent;data.verifiedSiteSource=!!page;
    }else{
      answer=intent==='inputs'?'リンク先の入力欄を確認してください。':intent==='operation'?'リンク先の案内に沿って操作してください。':'リンク先で確認できる内容を案内しています。';
    }
    return {handled:true,mode:'サイト総合案内',answer:answer,links:prior.links,data:data};
  }
  function answerContinuedGuideDetail(text,history){
    var intent=continuedGuideDetailIntent(text);if(!intent)return null;
    return answerContinuedGuideDetailFromPrior(intent,latestImmediateGuideLinkContext(history));
  }
  function broadGuideDetailIntent(text){
    var t=normalizeInput(text);
    if(/(?:何を入力|何入力|何を入れ|何入れ|入力項目)/.test(t))return'inputs';
    if(/(?:どこを押|何を押|どれを押|どう操作|操作はどう|どう進め)/.test(t))return'operation';
    if(/(?:何が分か|何がわか|何を確認でき|どんな結果|何が出る|何が表示|何を見られ|何を見れ)/.test(t))return'result';
    return'';
  }
  function latestGuideDetailIntent(history,prior){
    var data=prior&&prior.data||{},intent=String(data.siteContinuedDetailIntent||data.siteFeature||'');
    if(intent==='inputs'||intent==='operation'||intent==='result')return intent;
    var h=Array.isArray(history)?history:[],seen=0;
    for(var i=h.length-1;i>=0&&seen<4;i--){
      var x=h[i];if(!x||x.role!=='user')continue;seen++;
      intent=broadGuideDetailIntent(x.text);if(intent)return intent;
    }
    return'';
  }
  function detailTargetSwitchCue(text){
    var t=normalizeInput(text);
    return /(?:じゃあ|では|それなら|なら|やっぱ|比べ|こっちは|こちらは|の方は|のほうは|はどう|だとどう|ならどう)/.test(t)||/(?:は|って)[？?。！!]*$/.test(t);
  }
  function answerGuideDetailTargetSwitch(text,history){
    if(!detailTargetSwitchCue(text))return null;
    var prior=latestImmediateGuideLinkContext(history);if(!prior||prior.links.length!==1)return null;
    var intent=latestGuideDetailIntent(history,prior);if(!intent)return null;
    var targets=mentionedItems(text),current=itemFromUrl(prior.links[0]&&prior.links[0].url);if(targets.length!==1||current&&targets[0].id===current.id)return null;
    var target=targets[0],seed=copyGuideLinkContextData(prior.data,{siteItem:target.id,selectedSiteItem:target.id});
    var pair=current?[current,target]:[target],pairIds=pair.map(function(x){return x.id;});
    if(current&&/(?:比べ|比較|違い|どう違)/.test(normalizeInput(text))){
      var compared=compareItems(pair);if(!compared)return null;
      compared.links=[itemLink(target)];
      compared.data=compared.data||{};compared.data.siteItem=target.id;compared.data.selectedSiteItem=target.id;compared.data.siteFeature=intent;
      compared.data.siteSourceCandidates=pairIds.slice();compared.data.siteDetailTargetSwitch=true;compared.data.siteDetailTargetComparison=true;compared.data.previousSiteItem=current.id;
      return compared;
    }
    seed.candidates=pairIds.slice();seed.siteCandidates=pairIds.slice();seed.siteComparison=pairIds.slice();seed.siteSourceCandidates=pairIds.slice();
    seed.siteOpenedItems=[];seed.siteExcludedItems=[];seed.siteConditions=[];seed.needsClarification=false;
    var result=answerContinuedGuideDetailFromPrior(intent,{links:[itemLink(target)],data:seed});if(!result)return null;
    result.data=result.data||{};result.data.siteDetailTargetSwitch=true;result.data.previousSiteItem=current&&current.id||'';
    result.data.siteComparison=pairIds.slice();result.data.siteCandidates=pairIds.slice();result.data.candidates=pairIds.slice();result.data.siteSourceCandidates=pairIds.slice();result.data.selectedSiteItem=target.id;
    return result;
  }
  var SEIKAI_STONES={
    '武曲':{id:23,key:'bukyoku'},'禄存':{id:24,key:'rokuzon'},'破軍':{id:25,key:'hagun'},
    '文曲':{id:26,key:'monkyoku'},'廉貞':{id:27,key:'rentei'},'巨門':{id:28,key:'kyomon'},'貪狼':{id:29,key:'tanrou'}
  };
  function seikaiStoneRequest(text,recent,cur){
    var t=normalizeInput(text),m=t.match(/(武曲|禄存|破軍|文曲|廉貞|巨門|貪狼)/);if(!m)return null;
    var contextual=!!((recent&&recent.id==='seikai')||(cur&&cur.id==='seikai'));
    var explicit=/(?:星海|荒石|輝光|星光|微光|合成|作り方|つくり方|材料|レシピ)/.test(t);
    var possessive=new RegExp('^'+m[1]+'(?:の|って|とは)[？?。！!]*$').test(t);
    if(!contextual&&!explicit&&!possessive)return null;
    return {name:m[1],stone:SEIKAI_STONES[m[1]],query:t};
  }
  function seikaiStoneLink(request){
    var x=request.stone;
    return link(request.name+'の輝光を開く','seikai.html?stone='+x.id+'#'+x.key,false);
  }
  function stoneAlternativeCue(text){
    var t=normalizeInput(text);
    return /^(?:(?:じゃあ|では|それなら)[、,\s]*)?(?:別|ほか|他)(?:の(?:荒石|輝光)?|には)?(?:は|も)?(?:を?見たい|見せて|ある|ありますか)?[。！!？?]*$/.test(t);
  }
  function stoneLinkSet(prior){
    var links=prior&&Array.isArray(prior.links)?prior.links:[],out=[];
    if(links.length<2)return out;
    for(var i=0;i<links.length;i++){
      var name=stoneNameFromGuideUrl(links[i]&&links[i].url);if(!name)return[];
      out.push({name:name,link:links[i]});
    }
    return out;
  }
  function stoneAlternativeSelectionRequest(text,count){
    var t=normalizeInput(text),m,index=-1,requested=false,ambiguous=false;
    if(/^(?:真ん中|中央)(?:の)?(?:やつ|もの|荒石|輝光)?[。！!？?]*$/.test(t)){requested=true;if(count%2===1)index=Math.floor(count/2);else ambiguous=true;}
    else if(/^(?:最初|一番上|先頭)(?:の)?(?:やつ|もの|荒石|輝光)?[。！!？?]*$/.test(t)){requested=true;index=0;}
    else if(/^(?:最後|一番下|末尾)(?:の)?(?:やつ|もの|荒石|輝光)?[。！!？?]*$/.test(t)){requested=true;index=count-1;}
    else if((m=t.match(/^(?:上|先頭)から(?:の)?([1-9１-９一二三四五六七八九])(?:番|番目|個目)(?:の)?(?:やつ|もの|荒石|輝光)?[。！!？?]*$/))){requested=true;index=numberValue(m[1])-1;}
    else if((m=t.match(/^(?:下|最後|末尾)から(?:の)?([1-9１-９一二三四五六七八九])(?:番|番目|個目)(?:の)?(?:やつ|もの|荒石|輝光)?[。！!？?]*$/))){requested=true;index=count-numberValue(m[1]);}
    else if((m=t.match(/^([1-9１-９一二三四五六七八九])(?:番|番目|個目)(?:の)?(?:やつ|もの|荒石|輝光)?[。！!？?]*$/))){requested=true;index=numberValue(m[1])-1;}
    if(index<0||index>=count){if(requested&&!ambiguous)ambiguous=true;index=-1;}
    return {requested:requested,index:index,ambiguous:ambiguous};
  }
  function answerStoneAlternativeSelection(text,history){
    var prior=latestImmediateGuideLinkContext(history),set=stoneLinkSet(prior);if(!set.length)return null;
    var request=stoneAlternativeSelectionRequest(text,set.length);if(!request.requested)return null;
    if(request.ambiguous){
      var ambiguousData=copyGuideLinkContextData(prior.data,{siteItem:'seikai',siteStoneAlternativeSelectionAmbiguous:true,needsClarification:true});
      return {handled:true,mode:'サイト総合案内',answer:'候補が偶数なので、真ん中は一つに決められません。名前か、上から何番目かで教えてください。',links:prior.links,data:ambiguousData};
    }
    var chosen=set[request.index],result=seikaiStoneAnswer({name:chosen.name,stone:SEIKAI_STONES[chosen.name]});
    result.answer='「'+chosen.name+'」ですね。'+result.answer;result.data.siteStoneAlternativeSelection=true;result.data.selectedStoneName=chosen.name;
    return result;
  }
  function answerStoneAlternatives(text,history){
    if(!stoneAlternativeCue(text))return null;
    var prior=latestImmediateGuideLinkContext(history);if(!prior||prior.links.length!==1)return null;
    var currentName=stoneNameFromGuideUrl(prior.links[0]&&prior.links[0].url);if(!currentName)return null;
    var names=[],links=[];
    Object.keys(SEIKAI_STONES).forEach(function(name){if(name===currentName)return;names.push(name);links.push(seikaiStoneLink({name:name,stone:SEIKAI_STONES[name]}));});
    return {handled:true,mode:'サイト総合案内',answer:currentName+'以外なら、'+names.join('・')+'があります。どれを見たいですか？',links:links,data:{siteItem:'seikai',siteFeature:'stone_alternatives',siteStoneAlternatives:true,currentStoneName:currentName,needsClarification:true}};
  }
  function seikaiStoneAnswer(request){
    var name=request.name,q=normalizeInput(request.query||''),detail=/(?:作り方|つくり方|材料|レシピ|合成|能力|数値|生命|知力|ステータス|何が必要|なにが必要)/.test(q);
    var answer=name+'の輝光ですね。星海の荒石の「'+name+'」合成早見表はこちらです。';
    if(detail&&name==='文曲')answer+=' 文曲の輝光は、紺碧・山吹・濡羽・朽葉の星光（金）を合成します。完成時は生命1500、知力250です。';
    return {handled:true,mode:'サイト総合案内',answer:answer,links:[seikaiStoneLink(request)],data:{siteItem:'seikai',siteInternal:'stone',siteFeature:detail?'inputs':'',siteFeatures:detail?['inputs']:[],stoneName:name,stoneId:request.stone.id,siteOpen:true,verifiedSiteSource:true}};
  }
  function sourcePage(item){return item&&SOURCE_PAGES[item.id]||null;}
  function usageOf(item){var page=sourcePage(item);return S(page&&page.usage||USAGE_BY_ID[item&&item.id]||item&&item.desc||'');}
  function openItem(item){
    if(!item)return null;
    var answer=item.external?'「'+item.name+'」を別タブで開けるようにしました。':'「'+item.name+'」を開けるようにしました。';
    if(item.id==='video')answer='トップページの動画再生ボタンから使えるのですよ。';
    return {handled:true,mode:'サイト総合案内',answer:answer,links:[itemLink(item)],data:{siteItem:item.id,siteOpen:true,verifiedSiteSource:!!sourcePage(item)}};
  }
  function explainItem(item,withOpen){
    if(!item)return null;
    var answer='「'+item.name+'」ですね。'+item.desc;
    var usage=usageOf(item);if(usage&&usage!==item.desc)answer+='\n使い方は、'+usage;
    var page=sourcePage(item),features=page&&Array.isArray(page.features)?page.features:[];
    if(features.length)answer+='\n主な機能は、'+features.join('・')+'です。';
    if(item.external)answer+=' 別タブで開けます。';
    else if(item.id==='video')answer+=' トップページの動画再生ボタンから使います。';
    else if(withOpen!==false)answer+=' 下のボタンからページを開けます。';
    return {handled:true,mode:'サイト総合案内',answer:answer,links:withOpen===false?[]:[itemLink(item)],data:{siteItem:item.id,pageHelp:true,verifiedSiteSource:!!page}};
  }
  function candidateClarification(candidates,lead,question){
    var unique=[],seen={};(candidates||[]).forEach(function(x){var item=x.item||x;if(item&&!seen[item.id]){seen[item.id]=1;unique.push(item);}});
    if(!unique.length)return null;
    return {handled:true,mode:'サイト総合案内',answer:(lead||'近いページが複数あるのですよ。')+unique.map(function(x){return '「'+x.name+'」';}).join('、')+(question||'のどれを開きたいですか？'),links:unique.slice(0,8).map(itemLink),data:{needsClarification:true,candidates:unique.map(function(x){return x.id;}),siteCandidates:unique.map(function(x){return x.id;})}};
  }
  function compareItems(items){
    var unique=[],seen={};(items||[]).forEach(function(x){if(x&&!seen[x.id]){seen[x.id]=1;unique.push(x);}});if(unique.length<2)return null;
    var names=unique.map(function(x){return '「'+x.name+'」';}).join('と'),common=[];
    function allHave(key){return unique.every(function(x){var p=sourcePage(x),f=p&&p.facts||{};return !!S(f[key]);});}
    var materialCompare=unique.every(function(x){return x.id==='kishin'||x.id==='tsukumo'||x.id==='mado';});
    if(materialCompare&&allHave('selection_count'))common.push('いずれも最大8個を選んで合計を確認できます。');
    if(materialCompare&&allHave('sort'))common.push('いずれも第1〜第3優先で並べ替えできます。');
    if(materialCompare&&allHave('save'))common.push('いずれも現在の一覧画面を画像保存できます。');
    var body=unique.map(function(x){var p=sourcePage(x),facts=p&&p.facts||{};return '・'+x.name+'：'+S(facts.compare||x.desc);}).join('\n');
    var answer=names+'の違いはこちらなのですよ。';
    if(common.length)answer+='\n【共通】'+common.join(' ');
    answer+='\n【違い】\n'+body+'\n目的に合う方を選んでください。';
    var ids=unique.map(function(x){return x.id;});
    return {handled:true,mode:'サイト総合案内',answer:answer,links:unique.slice(0,4).map(itemLink),data:{siteComparison:ids,siteCandidates:ids,candidates:ids}};
  }

  function historyGuideContext(history){
    var h=Array.isArray(history)?history:[],lastItem=null,lastCandidates=[],lastSourceCandidates=[],lastOpenedItems=[],lastExcludedItems=[],lastConditions=[],lastCandidateKind='',lastFeature='',lastFeatureDetail='',lastFeatureSubjects=[],lastSelectedCandidate=null,lastIndex=-1,candidateIndex=-1,contextCleared=false;
    var knownTermGuidance=false,knownTermKey='',knownTermValue='',knownTermApproximate=false,knownTermItem=null,knownTermIndex=-1;
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var meta=x.meta||{},data=meta.data||{};
      // 候補拒否・候補選択中止の後は、それより前のページや候補を掘り起こさない。
      // siteItem は既存の軽量履歴にも保存されるため、追加の保存領域を作らず確実に伝播できる。
      if(data.siteGuideContextCleared||String(data.siteItem||'')==='__site_guide_context_cleared__'){
        contextCleared=true;lastIndex=i;candidateIndex=i;break;
      }
      if(!knownTermGuidance&&data.knownTermGuidance){
        knownTermGuidance=true;knownTermKey=String(data.termKey||'item');knownTermValue=String(data.normalizedTerm||'');knownTermApproximate=!!data.approximateTerm;knownTermIndex=i;
        if(data.siteItem&&BY_ID[data.siteItem])knownTermItem=BY_ID[data.siteItem];
      }
      if(!lastFeature&&data.siteFeature){lastFeature=String(data.siteFeature||'');if(lastFeature==='columns'&&/入手/.test(S(x.text)))lastFeatureDetail='acquisition';}
      if(!lastFeatureSubjects.length){
        var subjectIds=Array.isArray(data.siteFeatureSubjects)?data.siteFeatureSubjects:[];
        if(subjectIds.length)lastFeatureSubjects=subjectIds.filter(function(id){return !!featureSubjectLabel(id);}).slice(0,4);
        if(!lastFeatureSubjects.length&&String(data.siteFeature||'')==='reflect')lastFeatureSubjects=featureSubjectIds(x.text);
      }
      if(!lastSelectedCandidate&&data.selectedSiteItem&&BY_ID[data.selectedSiteItem])lastSelectedCandidate=BY_ID[data.selectedSiteItem];
      if(!lastCandidates.length){
        var comparisonIds=Array.isArray(data.siteComparison)?data.siteComparison:[];
        var ids=data.siteCandidates||data.candidates||comparisonIds||data.siteItems||[];
        if(Array.isArray(ids)&&ids.length){lastCandidates=ids.map(function(id){return BY_ID[id];}).filter(Boolean);lastCandidateKind=comparisonIds.length?'comparison':'choice';}
        if(!lastCandidates.length&&Array.isArray(meta.links)&&meta.links.length>1)lastCandidates=meta.links.map(function(l){return itemFromUrl(l&&l.url);}).filter(Boolean);
        if(lastCandidates.length){
          candidateIndex=i;
          // 古い履歴保存形式では selectedSiteItem が省かれることがあるため、
          // 候補内の siteItem を「選択済み候補」として安全に復元する。
          if(!lastSelectedCandidate&&data.siteItem&&BY_ID[data.siteItem]&&lastCandidates.some(function(x){return x.id===data.siteItem;}))lastSelectedCandidate=BY_ID[data.siteItem];
          var sourceIds=Array.isArray(data.siteSourceCandidates)?data.siteSourceCandidates:ids;
          lastSourceCandidates=(sourceIds||[]).map(function(id){return BY_ID[id];}).filter(Boolean);
          if(!lastSourceCandidates.length)lastSourceCandidates=lastCandidates.slice();
          var openedIds=Array.isArray(data.siteOpenedItems)?data.siteOpenedItems:[];
          lastOpenedItems=openedIds.map(function(id){return BY_ID[id];}).filter(Boolean);
          var excludedIds=Array.isArray(data.siteExcludedItems)?data.siteExcludedItems:[];
          lastExcludedItems=excludedIds.map(function(id){return BY_ID[id];}).filter(Boolean);
          if(Array.isArray(data.siteConditions))lastConditions=data.siteConditions.map(function(x){return x&&typeof x==='object'?{intent:String(x.intent||''),target:String(x.target||''),positive:x.positive!==false,query:String(x.query||'')}:null;}).filter(function(x){return x&&x.intent;});
        }
      }
      if(!lastItem){
        if(data.siteItem&&BY_ID[data.siteItem])lastItem=BY_ID[data.siteItem];
        if(!lastItem&&Array.isArray(meta.links)&&meta.links.length===1)lastItem=itemFromUrl(meta.links[0]&&meta.links[0].url);
        if(!lastItem){
          var tx=S(x.text);for(var j=0;j<ITEMS.length;j++){if(tx.indexOf('「'+ITEMS[j].name+'」')>=0){lastItem=ITEMS[j];break;}}
        }
        if(lastItem)lastIndex=i;
      }
      if(lastItem&&lastCandidates.length)break;
    }
    // 候補提示後に単一ページを選択済みなら、古い候補を次の質問へ持ち越さない。
    if(lastIndex>candidateIndex&&candidateIndex>=0)lastCandidates=[];
    return {item:lastItem,candidates:lastCandidates,sourceCandidates:lastSourceCandidates.length?lastSourceCandidates:lastCandidates.slice(),openedItems:lastOpenedItems,excludedItems:lastExcludedItems,conditions:lastConditions,candidateKind:lastCandidateKind,feature:lastFeature,featureDetail:lastFeatureDetail,featureSubjects:lastFeatureSubjects,selectedCandidate:lastSelectedCandidate,index:lastIndex,candidateIndex:candidateIndex,contextCleared:contextCleared,knownTermGuidance:knownTermGuidance,termKey:knownTermKey,normalizedTerm:knownTermValue,approximateTerm:knownTermApproximate,knownTermItem:knownTermItem,knownTermIndex:knownTermIndex};
  }
  // 比較や候補提示の直後に「なるほど」「了解」などの短い相づちを一度だけ挟んでも、
  // 次の「そっち」「後者」を候補参照として扱う。別の実質的な話題を挟んだ場合は保持しない。
  function candidateContextFresh(history,ctx){
    var h=Array.isArray(history)?history:[],c=ctx||{},idx=Number(c.candidateIndex);
    if(!Array.isArray(c.candidates)||!c.candidates.length||idx<0)return false;
    if(idx>=Math.max(0,h.length-3))return true;
    if(idx<Math.max(0,h.length-5))return false;
    var between=h.slice(idx+1,Math.max(idx+1,h.length-1));
    if(between.length!==2||!between[0]||between[0].role!=='user'||!between[1]||between[1].role!=='assistant')return false;
    var ack=S(between[0].text);
    if(!/^(?:なるほど(?:ね)?|そうなんだ|そうか|了解|わかった|分かった|おけ|OK|ありがとう|ありがと|うん|はい|へえ|ふーん|ほう|なるほどです)[。！!？?～〜]*$/i.test(ack))return false;
    var meta=between[1].meta||{};
    return !meta.data||!meta.data.siteGuide;
  }
  function discardStaleCandidateContext(history,ctx){
    ctx=ctx||{};if(!ctx.candidates||!ctx.candidates.length||candidateContextFresh(history,ctx))return ctx;
    ctx.candidates=[];ctx.sourceCandidates=[];ctx.openedItems=[];ctx.excludedItems=[];ctx.conditions=[];ctx.candidateKind='';ctx.selectedCandidate=null;ctx.candidateIndex=-1;
    return ctx;
  }
  function candidateKeys(item){
    var out=[],seen={},names=[item&&item.name].concat(item&&item.aliases||[]);
    // 階層候補では「天下統一奇譚・京都」→「京都」のように末尾名だけでも選べる。
    // 通常の全体検索には使わず、直前に候補が出ている時だけ使うため、一般会話を奪わない。
    if(item&&item.name){
      var tail=String(item.name).split(/[・／/]/).pop();
      if(tail&&tail!==item.name)names.push(tail);
    }
    names.forEach(function(v){
      var x=compact(v);if(!x)return;
      [x,x.replace(/(?:計算機|計算|一覧|カウンター|ツール|ページ|表)$/,'')].forEach(function(k){
        if(k&&k.length>=2&&!seen[k]){seen[k]=1;out.push(k);}
      });
    });
    return out;
  }
  function selectFromCandidates(text,candidates,selectedCandidate){
    var t=siteClauseLead(normalizeInput(text)),ct=compact(t),list=(candidates||[]).filter(Boolean);if(!list.length)return null;
    var idx=-1,selectedIndex=-1;
    if(selectedCandidate)for(var si=0;si<list.length;si++)if(list[si]&&list[si].id===selectedCandidate.id){selectedIndex=si;break;}
    if(list.length===2){
      if(/^(?:そっち|そちら|もう片方|もう一方|反対の方|反対のほう|上じゃない方|上じゃないほう|最初じゃない方|最初じゃないほう|前者じゃない方|前者じゃないほう)/.test(t))idx=selectedIndex>=0?(selectedIndex===0?1:0):1;
      else if(/^(?:こっち|こちら|下じゃない方|下じゃないほう|後者じゃない方|後者じゃないほう)/.test(t))idx=selectedIndex>=0?selectedIndex:0;
    }
    var fromTop=t.match(/^(?:上|先頭)から([1-9１-９一二三四五六七八九])(?:番|番目|個目)/);
    var fromBottom=t.match(/^(?:下|末尾|最後)から([1-9１-９一二三四五六七八九])(?:番|番目|個目)/);
    if(fromTop)idx=numberValue(fromTop[1])-1;
    else if(fromBottom)idx=list.length-numberValue(fromBottom[1]);
    if(idx<0&&/^(?:最後|一番最後|一番下|末尾|最後のやつ|下のやつ)/.test(t))idx=list.length-1;
    else if(idx<0&&list.length%2===1&&/^(?:真ん中|中央|中のやつ|真ん中のやつ)/.test(t))idx=Math.floor(list.length/2);
    else if(idx<0&&/^(?:1|１|一)(?:番|番目)?|最初|一番上|上の|前者|前の方|前のほう/.test(t))idx=0;
    else if(idx<0&&/^(?:2|２|二)(?:番|番目)?|二番目|次の|下の|後者|後の方|後のほう/.test(t))idx=1;
    else if(idx<0&&/^(?:3|３|三)(?:番|番目)?|三番目/.test(t))idx=2;
    else if(idx<0&&/^(?:4|４|四)(?:番|番目)?|四番目/.test(t))idx=3;
    if(idx>=0&&idx<list.length)return list[idx];

    // 計算候補を出した後の「自分のやつ」「家臣の方」のような目的語だけの返答。
    // 候補内に該当ページがある場合だけ確定し、通常会話では使わない。
    function listed(id){for(var li=0;li<list.length;li++)if(list[li]&&list[li].id===id)return list[li];return null;}
    if(/(?:自分|自キャラ|プレイヤー|本人|普通のキャラ|キャラの方|キャラのほう)/.test(t)&&listed('stats'))return listed('stats');
    if(/(?:家臣|家来|NPCの方|NPCのほう)/i.test(t)&&listed('retainer'))return listed('retainer');
    if(/(?:七星|転生)/.test(t)&&listed('shichisei'))return listed('shichisei');
    if(/(?:食料|兵糧|腹持ち)/.test(t)&&listed('food'))return listed('food');

    // 「家臣の方」「武技大会のほう」のように、候補名の中心語だけで選べるようにする。
    var direct=[];
    list.forEach(function(item){
      var keys=candidateKeys(item);
      for(var i=0;i<keys.length;i++)if(ct.indexOf(keys[i])>=0){direct.push(item);break;}
    });
    if(direct.length===1)return direct[0];

    // 「そのページ何できる」のような指示語だけで、先頭候補へ勝手に決めない。
    if(/^(?:それ|その|これ|この|あれ|あの)?(?:ページ|やつ|方|ほう)?(?:って|は|の)?[、,\s]*(?:何|なに|どれ|どっち|どう|開いて|見せて|使い方|見方|次)/.test(t))return null;

    var ranked=list.map(function(item){var sc=itemScore(t,item);return {item:item,score:sc.score};}).sort(function(a,b){return b.score-a.score;});
    if(ranked.length&&ranked[0].score>=85&&(ranked.length===1||ranked[0].score-ranked[1].score>=3))return ranked[0].item;
    return null;
  }
  function candidateAlternativeCue(text){
    var t=siteClauseLead(normalizeInput(correctionTail(text)||text));
    return /^(?:(?:じゃあ|では|それなら|やっぱ(?:り)?|やはり|いや|違う|訂正)[、,\s]*)?(?:別の|別の方|別のほう|ほかの|他の|違うの|違う方|違うほう|今のじゃない方|今のじゃないほう|選んだのじゃない方|選んだのじゃないほう|もう片方|もう一方)(?:にして|がいい|を見たい|を見せて|を開いて|開いて|見せて|はどう|ってどう)?[。！!？?]*$/.test(t);
  }
  function candidateRejectionCue(text){
    var t=normalizeInput(text);
    return /^(?:(?:いや|ううん|違う|ちがう)[、,\s]*)?(?:どれでもない|どっちでもない|どちらでもない|どれも違う|どっちも違う|どちらも違う|全部違う|全部ちがう|その中にはない|その中にない|この中にはない|この中にない|候補にない|候補が違う|候補がちがう|そうじゃない|そういうことじゃない)[。！!？?]*$/.test(t);
  }
  function candidateCancelCue(text){
    var t=normalizeInput(text);
    return /^(?:もう|いったん|一旦)?[、,\s]*(?:候補選び|この候補|候補の話|この話)(?:は|を)?(?:やめる|やめて|終わり|終了|なしにして)|^(?:もう)?[、,\s]*候補(?:は|選びは)?(?:いい|いらない)[。！!？?]*$/.test(t);
  }
  function answerCandidateRejection(text,candidates){
    var cancelled=candidateCancelCue(text);if(!cancelled&&!candidateRejectionCue(text))return null;
    var ids=uniqueCandidateItems(candidates).map(function(x){return x.id;}),answer=cancelled?'わかりました。候補選びはいったん終了しますね。別のことを聞きたくなったら、そのまま話しかけてください。':'候補が違っていたのですね。いったんこの候補は外しました。探しているものを、ページ名ではなく「何をしたいか」で言い直しても大丈夫なのですよ。';
    return {handled:true,mode:'サイト総合案内',answer:answer,links:[],data:{siteItem:'__site_guide_context_cleared__',siteGuideContextCleared:true,siteCandidateRejected:!cancelled,siteCandidateCancelled:cancelled,rejectedSiteCandidates:ids,needsClarification:!cancelled}};
  }
  function previousCandidateCue(text){
    var t=siteClauseLead(normalizeInput(correctionTail(text)||text));
    return /^(?:(?:じゃあ|では|それなら|やっぱ(?:り)?|やはり)[、,\s]*)?(?:(?:さっき|直前)(?:の)?|前に)(?:(?:選んだ|見ていた|見てた|開いていた|開いてた)(?:の)?)?(?:方|ほう|やつ|もの|ページ|候補)(?:の(?:使い方|やり方|保存(?:方法)?|画像保存|入手(?:方法|先)?|見方))?(?:は|って|を|に)?(?:戻して|して|開いて|見せて|教えて|知りたい)?[。！!？?]*$/.test(t);
  }
  function previousViewedCandidateCue(text){
    var t=normalizeInput(text);
    return /(?:(?:さっき|直前)(?:の)?|前に)(?:(?:選んだ|見ていた|見てた|開いていた|開いてた)(?:の)?)?(?:方|ほう|やつ|もの|ページ|候補)/.test(t)&&/(?:じゃなく|ではなく|戻|前に|さっき|直前)/.test(t);
  }
  function viewedHistoryStepCue(text){
    var t=siteClauseLead(normalizeInput(correctionTail(text)||text)),m=null,step=0;
    // 「前の候補」は候補リスト上の位置指定として従来処理へ残す。
    if(/(?:前|次)(?:の)?候補/.test(t)&&!/(?:見て|見た|開いて|開いた|選んで|選んだ)/.test(t))return {requested:false,step:0};
    var historyWord=/(?:見ていた|見てた|見た|開いていた|開いてた|開いた|選んでいた|選んでた|選んだ)/.test(t);
    var deicticHistory=/^(?:(?:じゃあ|では|それなら|やっぱ(?:り)?)[、,\s]*)?(?:その前|さっきの前)(?:の)?(?:方|ほう|やつ|もの|ページ)(?:の(?:使い方|やり方|保存(?:方法)?|画像保存|入手(?:方法|先)?|見方))?(?:は|って|を|に)?(?:戻して|して|開いて|見せて|教えて|知りたい)?[。！!？?]*$/.test(t);
    if(!historyWord&&!deicticHistory)return {requested:false,step:0};
    m=t.match(/([2-9２-９二三四五六七八九])(?:つ|個)?(?:前|まえ)/);
    if(m)step=numberValue(m[1]);
    if(!step&&/(?:一つ|ひとつ|1つ|１つ|一個|1個|１個)(?:前|まえ)/.test(t))step=1;
    if(!step&&/(?:その前|さっきの前|前に|さっき|直前)/.test(t))step=1;
    return {requested:step>0,step:step||0};
  }
  function candidateViewedHistory(history,current,candidates){
    var h=Array.isArray(history)?history:[],list=uniqueCandidateItems(candidates),allowed={},out=[],seen={},currentId=current&&current.id||'';
    list.forEach(function(x){allowed[x.id]=1;});
    if(currentId)seen[currentId]=1;
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var data=(x.meta&&x.meta.data)||{},id=String(data.selectedSiteItem||'');
      if(!id&&data.siteItem&&allowed[String(data.siteItem)])id=String(data.siteItem);
      if(!id||!allowed[id]||seen[id])continue;
      seen[id]=1;if(BY_ID[id])out.push(BY_ID[id]);
    }
    return out;
  }
  function candidateRelativeMove(text,candidates,selectedCandidate){
    if(viewedHistoryStepCue(text).requested)return {requested:false,target:null,boundary:false};
    var t=siteClauseLead(normalizeInput(correctionTail(text)||text)),list=uniqueCandidateItems(candidates),selectedIndex=-1,direction=0,step=0,m;
    if(!selectedCandidate||list.length<2)return {requested:false,target:null,boundary:false};
    for(var i=0;i<list.length;i++)if(list[i].id===selectedCandidate.id){selectedIndex=i;break;}
    if(selectedIndex<0)return {requested:false,target:null,boundary:false};
    m=t.match(/^([2-9２-９二三四五六七八九])(?:つ|個)?(?:先|下|後ろ|右)/);
    if(m){direction=1;step=numberValue(m[1]);}
    if(!step){m=t.match(/^([2-9２-９二三四五六七八九])(?:つ|個)?(?:前|上|左)/);if(m){direction=-1;step=numberValue(m[1]);}}
    if(!step&&/^(?:(?:その)?次(?:の候補|のやつ|のページ)?|(?:一つ|ひとつ|1つ|１つ|一個|1個|１個)(?:先|下|後ろ|右))/.test(t)){direction=1;step=1;}
    if(!step&&/^(?:(?:その)?前(?:の候補|のやつ|のページ)?|(?:一つ|ひとつ|1つ|１つ|一個|1個|１個)(?:前|上|左))/.test(t)){direction=-1;step=1;}
    if(!step)return {requested:false,target:null,boundary:false};
    var targetIndex=selectedIndex+(direction*step);
    return {requested:true,target:targetIndex>=0&&targetIndex<list.length?list[targetIndex]:null,boundary:targetIndex<0||targetIndex>=list.length,direction:direction,step:step,index:selectedIndex,targetIndex:targetIndex};
  }
  function answerCandidateRelativeMove(text,ctx){
    ctx=ctx||{};
    // 選んだページの下に専用メニューがあり「その次どれ」と聞かれた場合は、
    // 横並び候補の次ではなく従来どおり子ページ案内を優先する。
    if(ctx.selectedCandidate&&childrenOf(ctx.selectedCandidate).length&&hierarchyCue(text))return null;
    var move=candidateRelativeMove(text,ctx.candidates,ctx.selectedCandidate);if(!move.requested)return null;
    if(move.boundary){
      var edge=move.direction>0?'最後':'最初',boundary={handled:true,mode:'サイト総合案内',answer:'「'+ctx.selectedCandidate.name+'」が'+edge+'の候補です。これより'+(move.direction>0?'次':'前')+'の候補はないのですよ。',links:[],data:{siteItem:ctx.selectedCandidate.id,siteCandidateBoundary:true,siteCandidateDirection:move.direction>0?'next':'previous'}};
      return retainCandidateContext(boundary,ctx.candidates,ctx.selectedCandidate,ctx.candidateKind,ctx.sourceCandidates,ctx.conditions);
    }
    var features=featureIntents(text,move.target),result=features.length?answerFeatures(move.target,features,true,text):explainItem(move.target,true);
    if(!features.length)result.answer=(move.direction>0?'次':'前')+'の候補は「'+move.target.name+'」です。\n'+result.answer;
    result.data=result.data||{};result.data.siteCandidateRelativeMove=true;result.data.siteCandidateDirection=move.direction>0?'next':'previous';result.data.siteCandidateStep=move.step;
    return retainCandidateContext(result,ctx.candidates,move.target,ctx.candidateKind,ctx.sourceCandidates,ctx.conditions);
  }
  function previousSelectedCandidate(history,current,candidates,step){
    var timeline=candidateViewedHistory(history,current,candidates),index=Math.max(1,Number(step)||1)-1;
    return timeline[index]||null;
  }
  function answerCandidateAlternative(text,history,ctx){
    ctx=ctx||{};var list=uniqueCandidateItems(ctx.candidates),selected=ctx.selectedCandidate;
    if(list.length<2||!selected||!candidateAlternativeCue(text))return null;
    var alternatives=list.filter(function(x){return x.id!==selected.id;});if(!alternatives.length)return null;
    if(alternatives.length>1){
      var choice=answerCandidateSet(alternatives,ctx.sourceCandidates,{lead:'「'+selected.name+'」ではない候補は '+candidateNames(alternatives)+'です。どちらにしますか？',conditions:ctx.conditions});
      if(choice){choice.data.needsClarification=true;choice.data.previousSelectedSiteItem=selected.id;}return choice;
    }
    var target=alternatives[0],result=explainItem(target,true);
    result.answer='では「'+target.name+'」ですね。\n'+result.answer;
    return retainCandidateContext(result,list,target,ctx.candidateKind,ctx.sourceCandidates,ctx.conditions);
  }
  function answerPreviousCandidate(text,history,ctx){
    ctx=ctx||{};var historyCue=viewedHistoryStepCue(text),genericCue=previousCandidateCue(text)||previousViewedCandidateCue(text);
    if((!historyCue.requested&&!genericCue)||!ctx.selectedCandidate)return null;
    var list=uniqueCandidateItems(ctx.candidates),step=historyCue.requested?historyCue.step:1,previous=previousSelectedCandidate(history,ctx.selectedCandidate,list,step);
    if(!previous){
      // 「二つ前」など明示的な履歴段数は、候補順から推測して埋めない。
      if(historyCue.requested&&step>1){
        var known=candidateViewedHistory(history,ctx.selectedCandidate,list),knownNames=known.length?candidateNames(known):'確認できる以前のページがありません';
        var shortfall={handled:true,mode:'サイト総合案内',answer:'会話履歴では「'+step+'つ前に見ていたページ」まで一意にたどれませんでした。'+(known.length?'直前にたどれるのは '+knownNames+'です。':'')+' ページ名か「前に見ていた方」のように一段ずつ指定してもらえれば、勝手に決めずに戻れます。',links:known.slice(0,4).map(itemLink),data:{needsClarification:true,siteHistoryStepNeedsClarification:true,siteHistoryRequestedStep:step,siteCandidates:list.map(function(x){return x.id;}),candidates:list.map(function(x){return x.id;}),siteSourceCandidates:(ctx.sourceCandidates.length?ctx.sourceCandidates:list).map(function(x){return x.id;}),selectedSiteItem:ctx.selectedCandidate.id,siteItem:ctx.selectedCandidate.id}};
        return shortfall;
      }
      var alternatives=list.filter(function(x){return x.id!==ctx.selectedCandidate.id;});
      if(!alternatives.length)return null;
      if(alternatives.length===1)previous=alternatives[0];
      else{
        var unresolved=answerCandidateSet(alternatives,ctx.sourceCandidates,{lead:'今の「'+ctx.selectedCandidate.name+'」ではないことは分かりました。ただ、「前に見ていた方」を履歴から一つに特定できないので、残りは '+candidateNames(alternatives)+'です。どれに戻しますか？',conditions:ctx.conditions});
        if(unresolved&&unresolved.data){unresolved.data.needsClarification=true;unresolved.data.sitePreviousCandidateNeedsSelection=true;unresolved.data.previousSelectedSiteItem=ctx.selectedCandidate.id;}
        return unresolved;
      }
    }
    var intents=featureIntents(text,previous),result=intents.length?answerFeatures(previous,intents,true,text):explainItem(previous,true),label=step>1?step+'つ前に見ていた':'前に見ていた';
    result.answer=label+'「'+previous.name+'」に戻しますね。\n'+result.answer;
    result=retainCandidateContext(result,list,previous,ctx.candidateKind,ctx.sourceCandidates,ctx.conditions);
    result.data=result.data||{};result.data.sitePreviousCandidateRestored=true;result.data.siteHistoryRelativeRestore=!!historyCue.requested;result.data.siteHistoryRequestedStep=step;result.data.previousSelectedSiteItem=ctx.selectedCandidate.id;
    return result;
  }
  function excludedPageReference(text){
    var t=normalizeInput(text),m=t.match(/^(.{1,40}?)(?:じゃない方|じゃないほう|ではない方|ではないほう|以外の方|以外のほう)(.*)$/);
    if(!m)return null;
    var item=findItem(m[1]);if(!item)return null;
    return {item:item,tail:S(m[2]||'')};
  }
  function alternativeItems(text){
    var t=normalizeInput(text),items=mentionedItems(t);
    if(items.length<2)return [];
    if(/(?:それとも|または|もしくは|どちらか|どっちか)/.test(t))return items;
    // 「能力計算か家臣計算」のように、ページ名同士を助詞「か」で並べた二択。
    if(/(?:計算|一覧|鬼神石|九十九|魔導結晶|魔導|鎮魂符|カウンター).{0,8}か.{0,8}(?:計算|一覧|鬼神石|九十九|魔導結晶|魔導|鎮魂符|カウンター)/.test(t))return items;
    return [];
  }
  function explicitComparedOpen(text,items){
    var t=normalizeInput(text),list=(items||[]).filter(Boolean),found=[];
    function add(item){if(item&&found.indexOf(item)<0)found.push(item);}
    list.forEach(function(item){
      var names=[item.name].concat(item.aliases||[]);
      for(var i=0;i<names.length;i++){
        var n=S(names[i]);if(!n)continue;
        var pos=t.lastIndexOf(n);if(pos<0)continue;
        var tail=t.slice(pos+n.length,pos+n.length+24);
        if(/^(?:の方|のほう|だけ|のみ)?(?:を)?[、,\s]*(?:開いて|開けて|見せて|出して)/.test(tail)){add(item);break;}
      }
    });
    if(!found.length&&list.length>=2){
      if(/(?:前者|最初の方|最初のほう).{0,8}(?:開いて|開けて|見せて|出して)/.test(t))add(list[0]);
      if(/(?:後者|最後の方|最後のほう).{0,8}(?:開いて|開けて|見せて|出して)/.test(t))add(list[list.length-1]);
    }
    return found.length===1?found[0]:null;
  }

  function allCandidatesCue(text){
    return /^(?:じゃあ|では|それなら|なら)?[、,\s]*(?:両方|どっちも|どれも|全部|まとめて)(?:のページ|ページ|を|も)?[、,\s]*(?:開いて|開けて|見せて|出して|行きたい|連れてって)[。！!？?]*$/.test(normalizeInput(text));
  }
  function candidateOpenCue(text){
    return /(?:開いて|開けて|見せて|出して|行きたい|連れてって|ページを?見たい|ページ見たい)/.test(normalizeInput(text));
  }
  function numberValue(v){
    var s=S(v),map={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
    if(map[s])return map[s];
    var n=parseInt(s,10);return isFinite(n)?n:0;
  }
  function candidateSubset(text,candidates){
    var t=normalizeInput(text),list=(candidates||[]).filter(Boolean),out=[],seen={};
    if(list.length<2||!candidateOpenCue(t))return out;
    function addIndex(i){if(i>=0&&i<list.length&&list[i]&&!seen[list[i].id]){seen[list[i].id]=1;out.push(list[i]);}}
    function addItem(item){if(item&&!seen[item.id]){seen[item.id]=1;out.push(item);}}

    // 「2番目以外」「真ん中以外」のような除外指定は、単一候補選択より先に扱う。
    var ex=t.match(/([1-9１-９一二三四五六七八九])(?:個目|番目|番)?(?:のページ)?以外/);
    if(ex){var exi=numberValue(ex[1])-1;for(var ei=0;ei<list.length;ei++)if(ei!==exi)addIndex(ei);return out;}
    if(/(?:真ん中|中央|中のやつ)(?:のページ)?以外/.test(t)&&list.length%2===1){var mid=Math.floor(list.length/2);for(var mi=0;mi<list.length;mi++)if(mi!==mid)addIndex(mi);return out;}
    if(/(?:最初|一番上|先頭)(?:のページ)?以外/.test(t)){for(var fi=1;fi<list.length;fi++)addIndex(fi);return out;}
    if(/(?:最後|一番下|末尾)(?:のページ)?以外/.test(t)){for(var li=0;li<list.length-1;li++)addIndex(li);return out;}

    if(/(?:前|最初|上から)(?:の)?(?:二つ|2つ|２つ)/.test(t)){addIndex(0);addIndex(1);return out;}
    if(/(?:後ろ|後半|最後|下から)(?:の)?(?:二つ|2つ|２つ)/.test(t)){addIndex(list.length-2);addIndex(list.length-1);return out;}

    // 候補全体を指す自然な表現。
    if(allCandidatesCue(t)||/(?:この|その|あの)?(?:二つ(?!目)|2つ(?!目)|２つ(?!目)|三つ(?!目)|3つ(?!目)|３つ(?!目)|候補全部|ページ全部|それら全部|この候補|このページたち|この二つのページ|この3つのページ).*(?:開いて|開けて|見せて|出して)/.test(t))return list.slice();

    // 「最初と最後」「1個目と3個目」のような複数位置指定。
    if(/(?:最初|一番上|先頭).*(?:と|、|,|および).*(?:最後|一番下|末尾)|(?:最後|一番下|末尾).*(?:と|、|,|および).*(?:最初|一番上|先頭)/.test(t)){
      addIndex(0);addIndex(list.length-1);return out;
    }
    var re=/([1-9１-９一二三四五六七八九])(?:個目|番目)/g,m;
    while((m=re.exec(t)))addIndex(numberValue(m[1])-1);
    if(out.length>=2)return out;
    out=[];seen={};

    // 候補名を複数明示して開く場合。
    list.forEach(function(item){
      var keys=candidateKeys(item),ct=compact(t);
      for(var i=0;i<keys.length;i++)if(ct.indexOf(keys[i])>=0){addItem(item);break;}
    });
    if(out.length>=2)return out;
    return [];
  }
  function explicitMultiOpenItems(text){
    var t=normalizeInput(text),items=mentionedItems(t);if(items.length<2||!candidateOpenCue(t))return [];
    // 比較説明と「片方だけ開いて」が同居する文は、既存の比較処理へ渡す。
    if(/(?:違い|比較|どう違う)/.test(t)&&/(?:だけ|のみ).*(?:開いて|開けて|見せて|出して)/.test(t))return [];
    var found=[],seen={};
    function add(item){if(item&&!seen[item.id]){seen[item.id]=1;found.push(item);}}
    items.forEach(function(item){
      var names=[item.name].concat(item.aliases||[]),matched=false;
      for(var i=0;i<names.length;i++){
        var n=S(names[i]),pos=t.indexOf(n);if(pos<0)continue;
        var tail=t.slice(pos+n.length,pos+n.length+34);
        if(/^(?:の方|のほう|も|を|と|、|,|\s)*(?:そのあと|あと|続けて|一緒に|まとめて)?[、,\s]*(?:開いて|開けて|見せて|出して|見たい)/.test(tail)){matched=true;break;}
      }
      if(matched)add(item);
    });
    if(found.length>=2)return found;
    if(!/(?:違い|比較|どう違う|どっちが|どちらが)/.test(t)&&/(?:両方|どっちも|全部|まとめて|一緒に|そのあと|続けて)/.test(t))return items;
    return [];
  }
  function answerCandidateLinks(candidates,contextCandidates,sourceCandidates){
    var list=[],seen={};(candidates||[]).forEach(function(item){if(item&&!seen[item.id]){seen[item.id]=1;list.push(item);}});
    if(!list.length)return null;
    var context=[],contextSeen={};(contextCandidates||list).forEach(function(item){if(item&&!contextSeen[item.id]){contextSeen[item.id]=1;context.push(item);}});
    var source=[],sourceSeen={};(sourceCandidates||context).forEach(function(item){if(item&&!sourceSeen[item.id]){sourceSeen[item.id]=1;source.push(item);}});
    return {handled:true,mode:'サイト総合案内',answer:list.map(function(x){return '「'+x.name+'」';}).join('と')+'をまとめて開けるようにしました。',links:list.slice(0,8).map(itemLink),data:{siteOpenedItems:list.map(function(x){return x.id;}),siteCandidates:context.map(function(x){return x.id;}),candidates:context.map(function(x){return x.id;}),siteSourceCandidates:source.map(function(x){return x.id;})}};
  }
  function candidateFeatureRequests(text,candidates){
    var out=[];(candidates||[]).forEach(function(item){
      var intents=featureIntents(text,item);if(intents.length)out.push({item:item,intents:intents});
    });
    return out;
  }

  function uniqueCandidateItems(items){
    var out=[],seen={};(items||[]).forEach(function(item){if(item&&!seen[item.id]){seen[item.id]=1;out.push(item);}});return out;
  }
  function candidateNames(items){return uniqueCandidateItems(items).map(function(x){return '「'+x.name+'」';}).join('と');}
  function conditionSnapshot(specs){
    return (specs||[]).map(function(x){return x&&x.intent?{intent:String(x.intent||''),target:String(x.target||''),positive:x.positive!==false,query:String(x.query||'')}:null;}).filter(Boolean);
  }
  function conditionSpecKey(spec){return String(spec&&spec.intent||'')+'|'+String(spec&&spec.target||'');}
  function mergeConditionSpecs(previous,current,replacePrevious){
    var out=[],index={};
    function add(spec){
      if(!spec||!spec.intent)return;var copy={intent:String(spec.intent||''),target:String(spec.target||''),positive:spec.positive!==false,query:String(spec.query||'')},key=conditionSpecKey(copy);
      if(index[key]===undefined){index[key]=out.length;out.push(copy);}else out[index[key]]=copy;
    }
    if(!replacePrevious)(previous||[]).forEach(add);
    (current||[]).forEach(add);
    return out;
  }
  function answerCandidateSet(items,sourceItems,opt){
    opt=opt||{};var list=uniqueCandidateItems(items),source=uniqueCandidateItems(sourceItems&&sourceItems.length?sourceItems:list);if(!list.length)return null;
    var open=!!opt.open,lead=S(opt.lead||''),answer=lead||(open?candidateNames(list)+'を開けるようにしました。':'該当する候補は '+candidateNames(list)+'です。');
    var ids=list.map(function(x){return x.id;}),data={siteItems:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:source.map(function(x){return x.id;}),siteConditions:conditionSnapshot(opt.conditions||[])};
    if(open)data.siteOpenedItems=ids.slice();
    if(opt.excluded&&opt.excluded.length)data.siteExcludedItems=uniqueCandidateItems(opt.excluded).map(function(x){return x.id;});
    if(ids.length===1){data.siteItem=ids[0];data.selectedSiteItem=ids[0];}
    return {handled:true,mode:'サイト総合案内',answer:answer,links:list.slice(0,8).map(itemLink),data:data};
  }
  function candidateRestoreCue(text){
    var t=normalizeInput(text);
    return /^(?:じゃあ|では|それなら|やっぱ(?:り)?|一回)?[、,\s]*(?:(?:元|最初)の(?:候補|一覧|組み合わせ|メンバー|ページ|三つ|3つ|３つ)(?:に)?戻(?:して|す)|絞り込み(?:を)?(?:解除|リセット|なしにして)|条件(?:を)?(?:全部|すべて)?(?:外して|解除して|消して|なしにして)|全部(?:の候補)?に戻(?:して|す))(?:ください|くれる|ほしい)?[。！!？?]*$/.test(t);
  }

  function candidateRemainderCue(text){
    var t=normalizeInput(text);
    return /(?:^|[、,\s])(?:残り|残った(?:方|ほう|やつ|もの|候補)?|それ以外|そのほか|その他|ほかの候補|他の候補|選んでない(?:方|ほう|やつ|もの)?|選ばなかった(?:方|ほう|やつ|もの)?|開いてない(?:方|ほう|やつ|もの)?|まだの(?:方|ほう|やつ|もの)?)(?:は|も|を|って|だけ|全部|両方|まとめて|比べて|比較して|違い|どっち|どれ|何|開いて|見せて|出して|教えて|知りたい|[？?。！!]|$)/.test(t);
  }
  function candidateRemainderItems(candidates,sourceCandidates,selectedCandidate,openedItems){
    var current=uniqueCandidateItems(candidates),source=uniqueCandidateItems(sourceCandidates&&sourceCandidates.length?sourceCandidates:current),remove={},hasRemove=false;
    var opened=uniqueCandidateItems(openedItems);
    if(opened.length){opened.forEach(function(x){remove[x.id]=1;hasRemove=true;});}
    else if(selectedCandidate){remove[selectedCandidate.id]=1;hasRemove=true;}
    else if(source.length>current.length){current.forEach(function(x){remove[x.id]=1;hasRemove=true;});}
    if(!hasRemove)return [];
    return source.filter(function(x){return !remove[x.id];});
  }
  function answerCandidateRemainder(text,candidates,sourceCandidates,selectedCandidate,openedItems,excludedItems){
    if(!candidateRemainderCue(text))return null;
    var t=normalizeInput(text),current=uniqueCandidateItems(candidates),source=uniqueCandidateItems(sourceCandidates&&sourceCandidates.length?sourceCandidates:current),excluded=uniqueCandidateItems(excludedItems);
    var keptAfterExclusion=excluded.length&&source.length>current.length&&current.every(function(item){return !excluded.some(function(x){return x.id===item.id;});});
    if(keptAfterExclusion){
      var retainedResult;
      if(current.length>=2&&comparisonDifferenceCue(t))retainedResult=compareItems(current);
      else{
        var retainedOpen=candidateOpenCue(t),retainedLead=retainedOpen?candidateNames(current)+'をまとめて開けるようにしました。':'間違っていたページを除いた残りは '+candidateNames(current)+'です。';
        retainedResult=answerCandidateSet(current,source,{open:retainedOpen,lead:retainedLead,excluded:excluded});
      }
      if(retainedResult){
        retainedResult.data=retainedResult.data||{};retainedResult.data.siteSourceCandidates=source.map(function(item){return item.id;});retainedResult.data.siteExcludedItems=excluded.map(function(item){return item.id;});retainedResult.data.siteLinkMissRecoveryContinuation=true;
      }
      return retainedResult;
    }
    if(!selectedCandidate&&!uniqueCandidateItems(openedItems).length&&source.length>current.length&&/(?:残った|残ってる|残っている)/.test(t))return null;
    var rest=candidateRemainderItems(current,source,selectedCandidate,openedItems);if(!rest.length)return null;
    var open=candidateOpenCue(text),lead=open?candidateNames(rest)+'を開けるようにしました。':'残りは '+candidateNames(rest)+'です。';
    return answerCandidateSet(rest,source,{open:open,lead:lead});
  }
  function answerCandidateExclusionOnly(text,candidates,sourceCandidates){
    var t=normalizeInput(correctionTail(text)||text),list=uniqueCandidateItems(candidates);if(list.length<2)return null;
    if(!/(?:以外で|以外を|を除いて|除いて|抜きで|なしで)/.test(t))return null;
    var base=candidateConditionBase(t,list);if(!base.changed||!base.items.length)return null;
    var source=uniqueCandidateItems(sourceCandidates&&sourceCandidates.length?sourceCandidates:list),open=candidateOpenCue(t),lead=open?candidateNames(base.items)+'を開けるようにしました。':'除外後の候補は '+candidateNames(base.items)+'です。';
    return answerCandidateSet(base.items,source,{open:open,lead:lead,excluded:base.excluded});
  }
  function conditionRemovalRequest(text){
    var t=normalizeInput(text),all=/^(?:じゃあ|では|やっぱ(?:り)?|一回)?[、,\s]*(?:(?:条件|絞り込み)(?:を)?(?:全部|すべて)?(?:なし|無し|外して|解除|リセット|やめて|消して)|(?:全部|すべて)の条件(?:を)?(?:外して|解除|なし))/.test(t),remove=[];
    function add(intent,target){var key=intent+'|'+(target||'');if(!remove.some(function(x){return x.key===key;}))remove.push({key:key,intent:intent,target:target||''});}
    var suffix='(?:(?:の)?条件(?:は|を)?(?:なし|無し|外して|解除|やめて|消して)|(?:は)?(?:なしで|無しで))';
    var rules=[
      ['save','',new RegExp('(?:保存|画像保存)'+suffix)],['sort','',new RegExp('(?:並べ替え|ソート|優先順)'+suffix)],
      ['share','',new RegExp('(?:共有|URL|リンク)'+suffix)],['zoom','',new RegExp('(?:拡大|縮小|ズーム)'+suffix)],
      ['filter','',new RegExp('(?:絞り込み|フィルタ)'+suffix)],['reflect','stats',new RegExp('(?:能力計算(?:機)?)'+suffix)],
      ['reflect','retainer',new RegExp('(?:家臣(?:計算(?:機)?)?)'+suffix)],['reflect','',new RegExp('(?:反映|取り込み)'+suffix)]
    ];
    rules.forEach(function(r){if(r[2].test(t))add(r[0],r[1]);});
    return {all:all,remove:remove};
  }
  function removeConditionSpecs(previous,request){
    var list=conditionSnapshot(previous||[]);if(request.all)return [];
    return list.filter(function(spec){return !request.remove.some(function(r){return r.intent===spec.intent&&(!r.target||r.target===spec.target);});});
  }
  function conditionReplacementCue(text){
    return !!correctionTail(text)||/^(?:じゃあ|では|やっぱ(?:り)?|今度は|代わりに|条件(?:を)?変えて|切り替えて)[、,\s]*/.test(normalizeInput(text));
  }

  function negativeCapabilityCue(text){
    return /(?:できない|出来ない|無理|非対応|入らない|入れられない|入れれない|使えない|反映できない|保存できない|選べない|ないのは|ない方|ないほう)/.test(normalizeInput(text));
  }
  function choiceCapabilityCue(text){
    var t=normalizeInput(text);
    if(/(?:どっちも|どちらも|どれも|両方|全部|それぞれ)/.test(t))return false;
    if(/(?:どれ|どっち|どちら|どのページ|どの方|どのほう|どれが|どっちが|ならどっち|ならどれ)/.test(t))return true;
    return negativeCapabilityCue(t)&&/(?:方は|ほうは|のは|なのは)/.test(t);
  }
  function sentenceForTarget(body,target){
    var parts=S(body).split(/[。\n]/).map(S).filter(Boolean),key=target==='stats'?'能力計算':target==='retainer'?'家臣計算':'';
    if(!key)return parts;
    return parts.filter(function(x){return x.indexOf(key)>=0;});
  }
  function capabilityStatus(item,intent,text){
    var bodies=intent==='reflect'?reflectBodies(item,text):[featureBody(item,intent,text)],t=normalizeInput(text),target='';
    if(item&&(item.id==='stats'||item.id==='retainer'))target=item.id;
    else target=/能力計算/.test(t)?'stats':/家臣/.test(t)?'retainer':'';
    bodies=(bodies||[]).map(S).filter(Boolean);if(!bodies.length)return {status:0,bodies:[]};
    var check=[];bodies.forEach(function(body){var p=sentenceForTarget(body,target);check=check.concat(p.length?p:[body]);});
    var positive=false,negative=false;
    check.forEach(function(body){
      if(/(?:確認できません|ありません|できません|非対応|直接反映する欄はない|入力フォームはありません)/.test(body))negative=true;
      if(/(?:できます|できる|選べます|使えます|反映できます|保存できます|対応しています|あります)/.test(body)&&!/(?:確認できません|できません|ありません)/.test(body))positive=true;
    });
    // 正本にその機能の専用記載があり、非対応表現がなければ、反映以外は対応済みと判定する。
    // 「並べ替えられます」「戻せます」のような表現も安全に扱う。
    if(!positive&&!negative&&intent!=='reflect'&&bodies.length)positive=true;
    if(positive&&!negative)return {status:1,bodies:bodies};
    if(negative&&!positive)return {status:-1,bodies:bodies};
    if(positive&&negative){
      // 対象先が明記されている場合は、その文だけで判定済み。一般質問では「どこかには使える」を優先する。
      return {status:target?-1:1,bodies:bodies};
    }
    return {status:0,bodies:bodies};
  }
  function answerCandidateCapability(text,candidates){
    var t=normalizeInput(text),list=(candidates||[]).filter(Boolean);if(list.length<2||!choiceCapabilityCue(t))return null;
    var requests=candidateFeatureRequests(t,list),intent=commonRequestFeature(requests);if(!intent)return null;
    var wantNegative=negativeCapabilityCue(t),matched=[],opposite=[],unknown=[];
    list.forEach(function(item){
      var ev=capabilityStatus(item,intent,t),entry={item:item,bodies:ev.bodies};
      if(ev.status===0)unknown.push(entry);
      else if((wantNegative&&ev.status<0)||(!wantNegative&&ev.status>0))matched.push(entry);
      else opposite.push(entry);
    });
    var featureName=featureCuePhrase(intent)||'その機能',answer='';
    if(matched.length){
      if(matched.length===list.length)answer=wantNegative?'候補の中では、どれも'+featureName.replace(/できる$/,'できません')+'。':'候補はどれも'+featureName+'のですよ。';
      else answer=(wantNegative?'該当するのは ':'使えるのは ')+matched.map(function(x){return '「'+x.item.name+'」';}).join('と')+'です。';
      answer+='\n'+matched.map(function(x){return '・'+x.item.name+'：'+x.bodies.join(' ');}).join('\n');
    }else if(!unknown.length){
      answer=wantNegative?'候補の中に、'+featureName.replace(/できる$/,'できない')+'ものはありません。':'候補の中に、'+featureName+'ものはありません。';
      if(opposite.length)answer+='\n'+opposite.map(function(x){return '・'+x.item.name+'：'+x.bodies.join(' ');}).join('\n');
    }else{
      answer='確認できる情報だけでは、対象を一つに絞れません。\n'+unknown.map(function(x){return '・'+x.item.name+'：確認できる記載が不足しています。';}).join('\n');
    }
    var show=matched.length?matched:opposite,links=show.map(function(x){return itemLink(x.item);});
    return {handled:true,mode:'サイト総合案内',answer:answer,links:links,data:{siteItems:show.map(function(x){return x.item.id;}),siteCandidates:list.map(function(x){return x.id;}),candidates:list.map(function(x){return x.id;}),siteFeature:intent,siteFeatures:[intent],siteFeatureSubjects:featureSubjectIds(t),siteCapabilityFilter:true,siteCapabilityNegative:wantNegative,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
  }
  function candidateConditionBase(text,candidates){
    var t=normalizeInput(text),list=(candidates||[]).filter(Boolean),out=list.slice(),excluded=[],changed=false;
    if(list.length<2)return {items:out,excluded:excluded,changed:false};
    function removeIndex(idx){
      if(idx<0||idx>=list.length)return;
      var id=list[idx].id;out=out.filter(function(x){return x&&x.id!==id;});excluded.push(list[idx]);changed=true;
    }
    function removeItem(item){
      if(!item)return;var before=out.length;out=out.filter(function(x){return x&&x.id!==item.id;});
      if(out.length!==before){excluded.push(item);changed=true;}
    }

    // 「鬼神石以外で」「魔導を除いて」のように、候補を外してから条件を判定する。
    list.forEach(function(item){
      var keys=candidateKeys(item),ct=compact(t);
      for(var i=0;i<keys.length;i++){
        var key=keys[i],pos=ct.indexOf(key);if(pos<0)continue;
        var tail=ct.slice(pos+key.length,pos+key.length+12);
        if(/^(?:以外|を除いて|除いて|抜きで|なしで)/.test(tail)){removeItem(item);break;}
      }
    });

    var m=t.match(/([1-9１-９一二三四五六七八九])(?:個目|番目|番)?(?:の候補|のページ)?以外/);
    if(m)removeIndex(numberValue(m[1])-1);
    if(/(?:最初|一番上|先頭|前者)(?:の候補|のページ)?以外/.test(t))removeIndex(0);
    if(/(?:最後|一番下|末尾|後者)(?:の候補|のページ)?以外/.test(t))removeIndex(list.length-1);
    if(/(?:真ん中|中央|中のやつ)(?:の候補|のページ)?以外/.test(t)&&list.length%2===1)removeIndex(Math.floor(list.length/2));
    return {items:out,excluded:excluded,changed:changed};
  }
  function reflectConditionSpecs(text){
    var t=normalizeInput(text),out=[],seen={};
    var re=/(能力計算(?:機)?|家臣(?:計算(?:機)?)?)(?:に|へ|では|には|だと|なら|で)?[^、。！？?]{0,18}?(反映できない|直接反映できない|入らない|入れられない|入れれない|使えない|反映できる|直接反映できる|入る|入れられる|入れれる|使える)/g,m;
    while((m=re.exec(t))){
      var target=/能力/.test(m[1])?'stats':'retainer',positive=!/(?:ない|ません|無理|非対応)/.test(m[2]),key=target+':'+positive;
      if(!seen[key]){seen[key]=1;out.push({intent:'reflect',target:target,positive:positive,query:(target==='stats'?'能力計算':'家臣計算')+'に反映できる'});}
    }
    return out;
  }
  function conditionCueForIntent(intent){
    var map={
      reflect:'(?:反映|入れられ|入れれる|入る|使える|取り込)',
      save:'(?:保存|画像保存|スクショ|スクリーンショット)',
      sort:'(?:並べ替|ソート|優先順)',
      share:'(?:共有|URL|リンク)',
      zoom:'(?:拡大|縮小|ズーム|倍率)',
      reset:'(?:リセット|初期化|やり直|元に戻)',
      filter:'(?:絞り込|フィルタ)',
      download:'(?:ダウンロード)',
      random:'(?:シャッフル|抽選|ランダム)',
      history:'(?:履歴|候補に戻|全員戻)',
      schedule:'(?:日程|日時|時間)',
      entry:'(?:参加|エントリー|登録)'
    };
    return map[intent]||'';
  }
  function genericConditionSegment(intent,text){
    var cue=conditionCueForIntent(intent),t=normalizeInput(text);if(!cue)return'';
    var re=new RegExp(cue),m=re.exec(t);if(!m)return'';
    var seg=t.slice(m.index,Math.min(t.length,m.index+42)),boundary=seg.search(/(?:けれども|けれど|だけど|ですが|だが|けど|一方で|、|。|；|;|かつ|なおかつ|そして|そのうえ)/);
    if(boundary>0)seg=seg.slice(0,boundary);
    // 別機能の語が続く場合は、現在機能の局所表現だけで肯否を判定する。
    var intents=['reflect','save','sort','share','zoom','reset','filter','download','random','history','schedule','entry'];
    intents.forEach(function(other){
      if(other===intent)return;var oc=conditionCueForIntent(other);if(!oc)return;var om=new RegExp(oc).exec(seg);
      if(om&&om.index>0)seg=seg.slice(0,om.index);
    });
    return seg;
  }
  function genericConditionNegative(intent,text){
    var seg=genericConditionSegment(intent,text);if(!seg)return false;
    return /(?:できない|出来ない|無理|非対応|使えない|入らない|入れられない|反映できない|保存できない|選べない|戻せない)/.test(seg);
  }
  function genericConditionDoubleNegative(intent,text){
    var seg=genericConditionSegment(intent,text);if(!seg)return false;
    return /(?:できない|使えない|入らない|入れられない|反映できない|保存できない|選べない|戻せない)(?:もの|の|やつ|方|ほう)?(?:以外|を除いて|除いて|抜き)/.test(seg);
  }
  function genericConditionSpecs(text,items,targetSpecs){
    var t=normalizeInput(text),requests=candidateFeatureRequests(t,items),keys=[],supported={reflect:1,save:1,sort:1,share:1,zoom:1,reset:1,filter:1,download:1,random:1,history:1,schedule:1,entry:1};
    requests.forEach(function(req){(req.intents||[]).forEach(function(k){if(supported[k]&&keys.indexOf(k)<0)keys.push(k);});});
    var hasTargetReflect=(targetSpecs||[]).some(function(x){return x.intent==='reflect'&&x.target;});
    if(hasTargetReflect)keys=keys.filter(function(k){return k!=='reflect';});
    // 単独条件はそのまま、複数条件は「できて」「かつ」「けど」「も」などがある場合に集合条件として扱う。
    if(keys.length>1&&!/(?:かつ|なおかつ|両方|どっちも|どれも|できて|できるし|できるけど|できるが|も.*(?:でき|可能)|そして|そのうえ)/.test(t))keys=keys.slice(0,1);
    return keys.map(function(intent){
      var negative=genericConditionNegative(intent,t);if(genericConditionDoubleNegative(intent,t))negative=false;
      return {intent:intent,target:'',positive:!negative,query:t};
    });
  }
  function candidateConditionalPlan(text,candidates){
    var t=normalizeInput(correctionTail(text)||text),list=(candidates||[]).filter(Boolean);if(list.length<2)return null;
    var base=candidateConditionBase(t,list),conditions=reflectConditionSpecs(t),open=candidateOpenCue(t);

    var doubleNegative=/(?:できない|入らない|入れられない|使えない|反映できない|保存できない|選べない)(?:もの|の|やつ|方|ほう)?(?:以外|を除いて|除いて|抜き)/.test(t);
    if(conditions.length&&doubleNegative)conditions.forEach(function(spec){if(spec.positive===false)spec.positive=true;});
    conditions=conditions.concat(genericConditionSpecs(t,base.items,conditions));
    var singleFilterCue=conditions.length===1&&/(?:だけ|のみ|のだけ|ものだけ|やつだけ|該当するもの|該当するやつ|合うもの|合うやつ)(?:を)?(?:教えて|知りたい|どれ|は)?[？?。！!]*$/.test(t);
    var distinctive=base.changed||conditions.length>=2||singleFilterCue||open&&/(?:だけ|のみ|全部|すべて|のだけ|ものだけ|やつだけ|のうち|中から|条件|なら|合う|該当|以外|除いて|抜き)/.test(t);
    if(!conditions.length||!distinctive)return null;
    return {text:t,candidates:list,base:base,conditions:conditions,open:open};
  }
  function candidateConditionEvidence(item,spec){
    var query=spec.query||'',ev=capabilityStatus(item,spec.intent,query);
    return {item:item,spec:spec,status:ev.status,bodies:ev.bodies||[]};
  }
  function conditionLabel(spec){
    if(spec.intent==='reflect'){
      var target=spec.target==='stats'?'能力計算':'家臣計算';
      return target+(spec.positive?'に反映できる':'に反映できない');
    }
    var name=featureCuePhrase(spec.intent)||'その機能を使える';
    if(spec.positive)return name;
    return name.replace(/できる$/,'できない').replace(/使える$/,'使えない');
  }
  function filteredPositionItems(text,items){
    var t=normalizeInput(text),list=(items||[]).filter(Boolean);if(list.length<2)return list;
    var out=[];
    function add(i){if(i>=0&&i<list.length&&out.indexOf(list[i])<0)out.push(list[i]);}
    if(!candidateOpenCue(t))return list;
    if(/(?:のうち|中から|その中で|該当する中で).*(?:最後|一番下|末尾)/.test(t)){add(list.length-1);return out;}
    if(/(?:のうち|中から|その中で|該当する中で).*(?:最初|一番上|先頭)/.test(t)){add(0);return out;}
    if(list.length%2===1&&/(?:のうち|中から|その中で|該当する中で).*(?:真ん中|中央)/.test(t)){add(Math.floor(list.length/2));return out;}
    var m=t.match(/(?:のうち|中から|その中で|該当する中で).*?([1-9１-９一二三四五六七八九])(?:個目|番目)/);
    if(m){add(numberValue(m[1])-1);return out.length?out:list;}
    if(/(?:のうち|中から|その中で|該当する中で).*(?:前|最初)(?:の)?二つ/.test(t)){add(0);add(1);return out;}
    if(/(?:のうち|中から|その中で|該当する中で).*(?:後ろ|後半|最後)(?:の)?二つ/.test(t)){add(list.length-2);add(list.length-1);return out;}
    return list;
  }
  function answerCandidateConditionalQuery(text,candidates,sourceCandidates,priorConditions){
    var raw=normalizeInput(correctionTail(text)||text),current=uniqueCandidateItems(candidates),source=uniqueCandidateItems(sourceCandidates&&sourceCandidates.length?sourceCandidates:current),prior=conditionSnapshot(priorConditions||[]),removal=conditionRemovalRequest(raw),hasRemoval=removal.all||removal.remove.length>0,removedCondition=false,plan=null;
    if(hasRemoval&&prior.length){
      var remaining=removeConditionSpecs(prior,removal);removedCondition=remaining.length!==prior.length||removal.all;
      if(!removedCondition)return null;
      if(!remaining.length){
        var resetOpen=candidateOpenCue(raw),resetLead=resetOpen?candidateNames(source)+'を開けるようにしました。':'条件を外して、元の候補 '+candidateNames(source)+'に戻しました。';
        return answerCandidateSet(source,source,{open:resetOpen,lead:resetLead,conditions:[]});
      }
      plan={text:raw,candidates:source,base:{items:source.slice(),excluded:[],changed:false},conditions:remaining,open:candidateOpenCue(raw)};
    }else{
      plan=candidateConditionalPlan(raw,current);if(!plan)return null;
      var replacePrevious=conditionReplacementCue(text),combined=mergeConditionSpecs(prior,plan.conditions,replacePrevious);
      if(prior.length||replacePrevious){
        var evaluationBase=candidateConditionBase(raw,source);
        plan={text:raw,candidates:source,base:evaluationBase,conditions:combined,open:plan.open};
      }else plan.conditions=combined;
    }
    var matched=[],unknown=[],details=[];
    plan.base.items.forEach(function(item){
      var evidence=[],ok=true,uncertain=false;
      plan.conditions.forEach(function(spec){
        var ev=candidateConditionEvidence(item,spec);evidence.push(ev);
        if(ev.status===0){ok=false;uncertain=true;}
        else if(spec.positive?ev.status<0:ev.status>0)ok=false;
      });
      var entry={item:item,evidence:evidence};details.push(entry);
      if(ok)matched.push(entry);else if(uncertain)unknown.push(entry);
    });
    var eligible=matched.slice(),selected=filteredPositionItems(plan.text,eligible.map(function(x){return x.item;}));
    if(selected.length!==matched.length)matched=matched.filter(function(x){return selected.indexOf(x.item)>=0;});
    var labels=plan.conditions.map(conditionLabel),conditionText=labels.join('、かつ');
    var answer='',links=[];
    if(matched.length){
      answer=(removedCondition?'条件を外した結果、':'条件に合うのは ')+matched.map(function(x){return '「'+x.item.name+'」';}).join('と')+(removedCondition?'が残ります。':'です。');
      if(plan.open)answer+=' 該当するページを開けるようにしました。';
      var lines=matched.map(function(entry){
        var bodies=[],seen={};entry.evidence.forEach(function(ev){ev.bodies.forEach(function(body){body=S(body);if(body&&!seen[body]){seen[body]=1;bodies.push(body);}});});
        return bodies.length?'・'+entry.item.name+'：'+bodies.join(' '):'';
      }).filter(Boolean);
      if(lines.length)answer+='\n'+lines.join('\n');
      links=matched.map(function(x){return itemLink(x.item);});
    }else if(unknown.length){
      answer='確認できる情報だけでは、「'+conditionText+'」候補を確定できません。判断に必要な情報が不足しています。';
    }else{
      answer='候補の中に、「'+conditionText+'」条件をすべて満たすものはありません。';
      var explain=details.map(function(entry){
        var bodies=[],seen={};entry.evidence.forEach(function(ev){ev.bodies.forEach(function(body){body=S(body);if(body&&!seen[body]){seen[body]=1;bodies.push(body);}});});
        return bodies.length?'・'+entry.item.name+'：'+bodies.join(' '):'';
      }).filter(Boolean);
      if(explain.length)answer+='\n'+explain.join('\n');
    }
    var ids=matched.map(function(x){return x.item.id;}),eligibleIds=eligible.map(function(x){return x.item.id;}),sourceIds=source.map(function(x){return x.id;}),contextIds=eligibleIds.length?eligibleIds:sourceIds,features=[];
    plan.conditions.forEach(function(x){if(features.indexOf(x.intent)<0)features.push(x.intent);});
    var data={siteItems:ids,siteCandidates:contextIds,candidates:contextIds,siteSourceCandidates:sourceIds,siteConditions:conditionSnapshot(plan.conditions),siteCapabilityFilter:true,siteConditionalFilter:true,siteConditionCount:plan.conditions.length,siteFeatures:features,siteFeatureSubjects:featureSubjectIds(plan.text),verifiedSiteSource:true,sourceVersion:SOURCE.version||''};
    if(features.length===1)data.siteFeature=features[0];
    if(ids.length===1){data.siteItem=ids[0];data.selectedSiteItem=ids[0];}
    if(plan.open){data.siteConditionalOpen=true;data.siteOpenedItems=ids.slice();}
    if(plan.base.excluded.length)data.siteExcludedItems=plan.base.excluded.map(function(x){return x.id;});
    if(removedCondition)data.siteConditionRemoved=true;
    return {handled:true,mode:'サイト総合案内',answer:answer,links:links,data:data};
  }

  function comparisonRecommendationCue(text){
    return /^(?:じゃあ|では|それなら|で|結局|つまり|要するに)?[、,\s]*(?:結局)?(?:どっち|どちら|どれ)(?:(?:を|が)?(?:使えば|使うのが|選べば|選ぶのが|見れば|開けば)(?:いい|おすすめ|良い)|(?:が)?(?:いい|おすすめ|良い))(?:の|ですか)?[？?。！!]*$/.test(normalizeInput(text));
  }
  function answerComparisonRecommendation(candidates){
    var list=(candidates||[]).filter(Boolean);if(list.length<2)return null;
    var lines=list.map(function(item){var p=sourcePage(item),facts=p&&p.facts||{};return '・'+item.name+'：'+S(facts.compare||item.desc);});
    return {handled:true,mode:'サイト総合案内',answer:'目的で選ぶのが確実なのですよ。\n'+lines.join('\n')+'\n使いたい対象や、計算したいものを教えてくれれば、さらに一つへ絞れます。',links:list.map(itemLink),data:{siteComparison:list.map(function(x){return x.id;}),siteCandidates:list.map(function(x){return x.id;}),candidates:list.map(function(x){return x.id;}),siteRecommendation:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
  }
  function comparisonIndecisionCue(text){
    var t=normalizeInput(text);
    return /(?:どっち|どちら|どれ)(?:に|を)?(?:したら|すれば|選べば)?(?:いい|良い)(?:か)?(?:分からない|わからない|迷う|迷ってる|迷っています|決められない)/.test(t)||/(?:選び方|決め方)(?:が|は)?(?:分からない|わからない)|^(?:迷ってる|迷っています|決められない|選べない)[。！!？?]*$/.test(t);
  }
  function answerComparisonIndecision(text,candidates){
    var list=uniqueCandidateItems(candidates);if(list.length<2||!comparisonIndecisionCue(text))return null;
    var ids=list.map(function(x){return x.id;});
    return {
      handled:true,
      mode:'サイト総合案内',
      answer:candidateNames(list)+'で迷っているのですね。目的で絞れます。\n「能力計算に使いたい」「合成最低発現数を見たい」「画像で保存したい」のように、何に使いたいかをそのまま教えてください。分かる範囲の一言で大丈夫です。',
      links:list.map(itemLink),
      data:{siteComparison:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:ids,siteRecommendation:true,siteComparisonPurposeClarification:true,needsClarification:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}
    };
  }
  function comparisonPurposeCue(text){
    var t=normalizeInput(text);
    if(/(?:したい|してみたい|見たい|確認したい|使いたい|入れたい|選びたい|重視したい|が必要|を使う|が目的)/.test(t))return true;
    if(/(?:能力計算|家臣計算|右手|左手|首|画像保存|画面保存|合成最低発現数|最低発現数)(?:に|で)?(?:なら|の場合|だと).*(?:どっち|どちら|どれ)/.test(t))return true;
    if(/(?:反映する|入れる|保存する|確認する|見る|使う)(?:の)?(?:なら|場合).*(?:どっち|どちら|どれ)/.test(t))return true;
    if(/(?:できる|使える|見られる|見れる|確認できる)(?:方|ほう|もの|やつ|ページ)(?:がいい|を開いて|を見たい)?/.test(t))return true;
    return /(?:合成最低発現数|最低発現数|開運系|英雄系|上覧系)(?:は|を|が)?[？?。！!]*$/.test(t);
  }
  function comparisonPurposeExactSpecs(text){
    var t=normalizeInput(text),out=[];
    function add(key,needle){if(!out.some(function(x){return x.key===key;}))out.push({key:key,needle:needle});}
    if(/(?:合成最低発現数|最低発現数|合成.*発現)/.test(t))add('minimum_activation',/合成最低発現数/);
    if(/開運系/.test(t))add('kaiun',/開運系/);
    if(/英雄系/.test(t))add('eiyu',/英雄系/);
    if(/上覧系/.test(t))add('joran',/上覧系/);
    if(/右手/.test(t))add('right_hand',/右手/);
    if(/左手/.test(t))add('left_hand',/左手/);
    if(/首(?:の欄)?/.test(t))add('neck',/首(?:の欄)?/);
    return out;
  }
  function comparisonPurposeSearchText(item){
    var page=sourcePage(item),facts=page&&page.facts||{},parts=[item&&item.desc,page&&page.desc,page&&page.usage].concat(page&&page.features||[]);
    Object.keys(facts).forEach(function(key){parts.push(facts[key]);});
    return S(parts.filter(Boolean).join(' '));
  }
  function comparisonPurposeSpecs(text,candidates){
    var t=normalizeInput(text),list=(candidates||[]).filter(Boolean),intents=[];
    list.forEach(function(item){featureIntents(t,item).forEach(function(intent){if(intents.indexOf(intent)<0)intents.push(intent);});});
    if(/(?:能力計算|家臣計算)(?:に|で)?(?:なら|の場合|だと).*(?:どっち|どちら|どれ)/.test(t)&&intents.indexOf('reflect')<0)intents.push('reflect');
    if(/(?:合計|何個まで|最大.*個)/.test(t)&&intents.indexOf('selection_count')<0)intents.push('selection_count');
    if(/(?:入手|一覧の項目|何が載)/.test(t)&&intents.indexOf('columns')<0)intents.push('columns');
    return intents.map(function(intent){return {intent:intent};}).concat(comparisonPurposeExactSpecs(t));
  }
  function comparisonPurposeEvidence(item,spec,text){
    if(spec.intent)return capabilityStatus(item,spec.intent,text);
    var hit=spec.needle&&spec.needle.test(comparisonPurposeSearchText(item)),page=sourcePage(item),facts=page&&page.facts||{};
    return {status:hit?1:-1,bodies:hit?[S(facts.compare||item.desc)]:[]};
  }
  function answerComparisonPurposeRecommendation(text,candidates){
    var t=normalizeInput(text),list=uniqueCandidateItems(candidates);if(list.length<2||!comparisonPurposeCue(t))return null;
    var specs=comparisonPurposeSpecs(t,list);if(!specs.length)return null;
    var matched=[],unknown=[];
    list.forEach(function(item){
      var bodies=[],seen={},ok=true,uncertain=false;
      specs.forEach(function(spec){var ev=comparisonPurposeEvidence(item,spec,t);if(ev.status===0)uncertain=true;else if(ev.status<0)ok=false;(ev.bodies||[]).forEach(function(body){body=S(body);if(body&&!seen[body]){seen[body]=1;bodies.push(body);}});});
      var entry={item:item,bodies:bodies};if(ok&&!uncertain)matched.push(entry);else if(uncertain)unknown.push(entry);
    });
    var ids=list.map(function(x){return x.id;}),data={siteComparison:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:ids,siteRecommendation:true,siteComparisonPurpose:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''},answer='',links=[];
    if(matched.length===1&&!unknown.length){
      var chosen=matched[0];answer='その目的なら「'+chosen.item.name+'」が合っています。';
      if(chosen.bodies.length)answer+='\n・'+chosen.item.name+'：'+chosen.bodies.join(' ');
      answer+='\nこのページから確認できます。';links=[itemLink(chosen.item)];data.siteItem=chosen.item.id;data.selectedSiteItem=chosen.item.id;data.siteItems=[chosen.item.id];data.siteComparisonPurposeSelected=true;
    }else if(matched.length>=2&&!unknown.length){
      answer='その目的なら、'+candidateNames(matched.map(function(x){return x.item;}))+(matched.length===2?'のどちらでも':'のいずれでも')+'できます。';
      if(specs.length===1&&specs[0].intent)answer+='\n候補はどれも'+(featureCuePhrase(specs[0].intent)||'その機能を使える')+'のですよ。';
      answer+='\n'+matched.map(function(x){return '・'+x.item.name+'：'+(x.bodies.join(' ')||'その目的に使えます。');}).join('\n');
      answer+='\nもう一つ重視したいことを教えてくれれば、絞り込めます。';links=matched.map(function(x){return itemLink(x.item);});data.siteItems=matched.map(function(x){return x.item.id;});data.siteComparisonPurposeMultiple=true;data.needsClarification=true;
    }else if(!matched.length&&!unknown.length){
      answer='比べている'+candidateNames(list)+'の中には、その目的に合うものはありません。別の目的を教えてくれれば選び直せます。';links=list.map(itemLink);data.siteItems=[];data.siteComparisonPurposeNoMatch=true;
    }else{
      answer='確認できる情報だけでは、その目的で一つに絞れません。もう少し具体的に、何を確認・反映したいか教えてください。';links=list.map(itemLink);data.siteItems=matched.map(function(x){return x.item.id;});data.siteComparisonPurposeUnknown=true;data.needsClarification=true;
    }
    if(specs.length===1&&specs[0].intent){data.siteFeature=specs[0].intent;data.siteFeatures=[specs[0].intent];}
    return {handled:true,mode:'サイト総合案内',answer:answer,links:links,data:data};
  }
  function answerDirectComparisonPurpose(text){
    var t=normalizeInput(text);if(/(?:それぞれ|各(?:ページ|対象|計算機)?|全部|すべて|どこに|どこへ).*(?:入る|入れる|反映|使う|使える)|(?:どこに|どこへ)(?:入る|入れる|反映)/.test(t))return null;
    var mentioned=mentionedItems(t),choice=/(?:どっち|どちら|どれ|どの方|どのほう|おすすめ|選ぶなら|使うなら)/.test(t),materialIds={kishin:1,tsukumo:1,mado:1,chinkon:1,seikai:1},materialCount=mentioned.filter(function(x){return !!materialIds[x.id];}).length,calculatorCount=mentioned.filter(function(x){return x.id==='stats'||x.id==='retainer';}).length;
    if(mentioned.length>2&&!choice)return null;
    if(mentioned.length===2&&materialCount===1&&calculatorCount===1&&!choice)return null;
    var items=directComparisonPurposeItems(t);if(items.length<2)return null;
    var result=answerComparisonPurposeRecommendation(text,items);if(!result)return null;
    result.data=result.data||{};result.data.siteDirectComparisonPurpose=true;
    return result;
  }
  function comparisonPurposeShorthandText(text,candidates){
    var t=normalizeInput(text),list=uniqueCandidateItems(candidates);if(list.length<2||comparisonPurposeCue(t)||t.length>32)return'';
    var core=t.replace(/^(?:じゃあ|じゃ|では|それなら|ならば|次は|今度は|あと)[、,\s]*/,'').replace(/[？?。！!]+$/,'').replace(/(?:の場合|だったら|ならば|なら|だと|では|はどう|は)$/,'').trim();
    if(!core)return'';
    if(/^(?:能力計算(?:機)?|自分|自キャラ|キャラ|プレイヤー)$/.test(core))return'能力計算に反映したい';
    if(/^(?:家臣|家臣計算(?:機)?)$/.test(core))return'家臣計算に反映したい';
    if(/^(?:首|首の欄)$/.test(core))return'首に反映したい';
    if(/^(?:右手|右手の欄)$/.test(core))return'右手に反映したい';
    if(/^(?:左手|左手の欄)$/.test(core))return'左手に反映したい';
    if(/^(?:合成最低発現数|最低発現数)$/.test(core))return'合成最低発現数を見たい';
    if(/^(?:開運系|英雄系|上覧系)$/.test(core))return core+'を確認したい';
    if(/^(?:画像保存|画面保存|保存|スクショ|スクリーンショット)$/.test(core))return'画像で保存したい';
    if(/^(?:合計|合計値|能力合計|選択数)$/.test(core))return'合計を見たい';
    if(/^(?:並べ替え|並び替え|ソート)$/.test(core))return'並べ替えを使いたい';
    if(/^(?:共有|リンク共有|URL共有)$/.test(core))return'共有したい';
    var found=findItemDetailed(core),item=found&&found.item,calculatorPair=list.every(function(x){return x.id==='stats'||x.id==='retainer';}),coreKey=compact(core);
    if(calculatorPair&&item&&!list.some(function(x){return x.id===item.id;})&&candidateKeys(item).indexOf(coreKey)>=0)return item.name+'を入れたい';
    return'';
  }
  function answerComparisonPurposeShorthand(text,candidates){
    var expanded=comparisonPurposeShorthandText(text,candidates);if(!expanded)return null;
    var result=answerComparisonPurposeRecommendation(expanded,candidates);if(!result)return null;
    result.data=result.data||{};result.data.siteComparisonPurposeShorthand=true;
    return result;
  }
  function comparisonSelectionRevisionCancelCue(text){
    var t=normalizeInput(text);
    return /^(?:(?:やっぱ(?:り)?|やはり|いったん|一旦|まだ|もう)[、,\s]*)?(?:決めるの|選ぶの|選択を|この選択を|どっちにするか|どちらにするか)(?:は|を)?(?:やめる|やめて|取り消す|取消す|保留にする)|^(?:(?:やっぱ(?:り)?|いったん|一旦|まだ)[、,\s]*)?(?:保留|決めない|選ばない)(?:にする|でいい|でお願い)?[。！!？?]*$/.test(t);
  }
  function comparisonSelectionRevisionTarget(text,candidates,selected){
    var list=uniqueCandidateItems(candidates);if(!selected||list.length<2)return null;
    if(comparisonSelectionConfirmationCue(text))return null;
    if(candidateAlternativeCue(text)){
      var alternatives=list.filter(function(x){return x.id!==selected.id;});return alternatives.length===1?alternatives[0]:null;
    }
    var t=normalizeInput(text),tail=correctionTail(text)||t;
    if(!/(?:やっぱ|やはり|いや|訂正|変える|変えて|変更|切り替|にする|でお願い|じゃなく|ではなく|今のなし)/.test(t))return null;
    var target=selectFromCandidates(tail,list,selected);return target&&target.id!==selected.id?target:null;
  }
  function comparisonSelectionRevisionCue(text,candidates,selected){
    return comparisonSelectionRevisionCancelCue(text)||!!comparisonSelectionRevisionTarget(text,candidates,selected);
  }
  function comparisonAlternativeFeatureCue(text,candidates){
    var t=normalizeInput(text),list=uniqueCandidateItems(candidates);if(list.length!==2||!/(?:もう片方|もう一方|反対の方|反対のほう|別の方|別のほう)/.test(t))return false;
    return list.some(function(item){return featureIntents(t,item).length||pageHelpCue(t,item,item);});
  }
  function answerComparisonAlternativeFeature(text,history){
    var ctx=discardStaleCandidateContext(history,historyGuideContext(history));if(ctx.candidateKind!=='comparison'||ctx.candidates.length!==2||!comparisonAlternativeFeatureCue(text,ctx.candidates))return null;
    var list=uniqueCandidateItems(ctx.candidates),selected=ctx.selectedCandidate&&list.filter(function(x){return x.id===ctx.selectedCandidate.id;})[0]||null;
    if(!selected){
      var unresolved=candidateClarification(list,'まだ基準になる一方を選んでいないので、','のどちらについて知りたいですか？');
      if(unresolved&&unresolved.data)unresolved.data.siteComparisonAlternativeFeatureNeedsSelection=true;
      return unresolved;
    }
    var target=list.filter(function(x){return x.id!==selected.id;})[0],intents=featureIntents(text,target),result=intents.length?answerFeatures(target,intents,true,text):explainItem(target,true);
    if(!result)return null;
    result.answer='「'+selected.name+'」ではなく、もう片方の「'+target.name+'」についてですね。\n'+String(result.answer||'');
    result=retainCandidateContext(result,list,target,'comparison',ctx.sourceCandidates,ctx.conditions);
    result.data=result.data||{};result.data.siteComparisonAlternativeFeature=true;result.data.siteComparisonSelectionRevised=true;result.data.previousSelectedSiteItem=selected.id;
    return result;
  }
  function answerComparisonSelectionRevision(text,history){
    var ctx=discardStaleCandidateContext(history,historyGuideContext(history));if(ctx.candidateKind!=='comparison'||ctx.candidates.length<2)return null;
    var list=uniqueCandidateItems(ctx.candidates),selected=ctx.selectedCandidate;
    if(comparisonSelectionRevisionCancelCue(text)){
      return {handled:true,mode:'サイト総合案内',answer:'わかりました。比較の選択はいったん取り消します。必要になったら、比べたい二つと目的をそのまま言ってください。',links:[],data:{siteItem:'__site_guide_context_cleared__',siteGuideContextCleared:true,siteComparisonSelectionRevisionCancelled:true,siteCandidateCancelled:true,needsClarification:false}};
    }
    var target=comparisonSelectionRevisionTarget(text,list,selected);if(!target)return null;
    var result=explainItem(target,true),previous=selected;
    result.answer='「'+previous.name+'」から「'+target.name+'」へ変更します。\n'+result.answer;
    result=retainCandidateContext(result,list,target,'comparison',ctx.sourceCandidates,ctx.conditions);
    result.data=result.data||{};result.data.siteComparisonSelectionRevised=true;result.data.previousSelectedSiteItem=previous.id;
    return result;
  }
  function comparisonCandidateSetRecallCue(text){
    var t=normalizeInput(text);if(!t)return false;
    if(/^(?:(?:今|いま|さっき|先ほど)[、,\s]*)?(?:何と何|どれとどれ|何を|どれを)(?:を)?(?:比べてた|比べていた|比べてる|比べている|比較してた|比較していた|比較してる|比較している)(?:の|んだっけ|っけ)?[。！!？?]*$/.test(t))return true;
    if(/^(?:(?:今|いま|さっき|先ほど)[の、,\s]*)?(?:(?:比較|比べていた|比べてた)(?:中)?の)?候補(?:は|って)?(?:何|どれ|何だった|どれだった|何だっけ|どれだっけ|何でしたっけ|どれでしたっけ)[。！!？?]*$/.test(t))return true;
    return /^(?:比べてた|比べていた|比較してた|比較していた)(?:の|候補)(?:は|って)?(?:何|どれ)(?:だった|だっけ|でしたっけ)?[。！!？?]*$/.test(t);
  }
  function comparisonOtherCandidateRecallCue(text){
    var t=normalizeInput(text);if(!t)return false;
    return /^(?:(?:今|いま|さっき|先ほど)[、,\s]*)?(?:もう片方|もう一方|選ばなかった方|選ばなかったほう|選んでない方|選んでないほう|選んでいない方|選んでいないほう|反対の方|反対のほう|別の方|別のほう)(?:は|って)(?:何|どれ|どっち)?(?:だっけ|だった|でしたっけ|なの|ですか)?[。！!？?]*$/.test(t);
  }
  function comparisonCandidateRecallCue(text){return comparisonCandidateSetRecallCue(text)||comparisonOtherCandidateRecallCue(text);}
  function comparisonViewedAlternativeRecord(entry){
    if(!entry||entry.role!=='assistant')return null;
    var meta=entry.meta||{},data=meta.data||{},ids=Array.isArray(data.siteComparison)?data.siteComparison:(data.siteCandidates||data.candidates||[]);
    if(!Array.isArray(ids)||ids.length!==2)return null;
    var list=ids.map(function(id){return BY_ID[id];}).filter(Boolean),selected=BY_ID[String(data.selectedSiteItem||'')],viewed=BY_ID[String(data.siteItem||'')],answer=S(entry.text);
    if(list.length!==2||!selected||!viewed||selected.id===viewed.id||!list.some(function(x){return x.id===selected.id;})||!list.some(function(x){return x.id===viewed.id;}))return null;
    if(!data.siteComparisonOtherCandidateRecall&&!/もう片方は「[^」]+」です。現在の選択は「[^」]+」のままです/.test(answer))return null;
    var sourceIds=Array.isArray(data.siteSourceCandidates)?data.siteSourceCandidates:ids;
    return {candidates:list,selected:selected,viewed:viewed,sourceCandidates:sourceIds.map(function(id){return BY_ID[id];}).filter(Boolean),feature:String(data.siteFeature||''),featureSubjects:Array.isArray(data.siteFeatureSubjects)?data.siteFeatureSubjects.slice(0,4):[],conditions:Array.isArray(data.siteConditions)?data.siteConditions.slice():[]};
  }
  function latestComparisonViewedAlternative(history){
    var h=Array.isArray(history)?history:[],last=-1;
    for(var i=h.length-1;i>=0;i--)if(h[i]&&h[i].role==='assistant'){last=i;break;}
    if(last<0)return null;
    var direct=comparisonViewedAlternativeRecord(h[last]);if(direct)return direct;
    if(last<2||!h[last-1]||h[last-1].role!=='user'||!h[last-2]||h[last-2].role!=='assistant')return null;
    if(!/^(?:なるほど(?:ね)?|そうなんだ|そうか|了解|わかった|分かった|おけ|OK|ありがとう|ありがと|うん|はい|へえ|ふーん|ほう|なるほどです)[。！!？?～〜]*$/i.test(S(h[last-1].text)))return null;
    var meta=h[last].meta||{};if(meta.data&&meta.data.siteGuide)return null;
    return comparisonViewedAlternativeRecord(h[last-2]);
  }
  function comparisonViewedAlternativeSelectionCue(text){
    var t=normalizeInput(text),lead='(?:(?:じゃあ|じゃ|では|それなら|やっぱ(?:り)?|やはり|うん|はい)[、,\\s]*)?';
    return new RegExp('^'+lead+'(?:それ|そっち|そちら|その方|そのほう)(?:に(?:する|決める|変える|変更する)|で(?:お願い|いい|頼む|進めて)|を(?:選ぶ|使う)|がいい)[。！!？?]*$').test(t);
  }
  function answerComparisonViewedAlternativeSelection(text,history){
    if(!comparisonViewedAlternativeSelectionCue(text))return null;
    var ref=latestComparisonViewedAlternative(history);if(!ref)return null;
    var result=explainItem(ref.viewed,true);
    result.answer='「'+ref.selected.name+'」から「'+ref.viewed.name+'」へ変更します。\n'+result.answer;
    result=retainCandidateContext(result,ref.candidates,ref.viewed,'comparison',ref.sourceCandidates,ref.conditions);
    result.data=result.data||{};result.data.siteComparisonViewedAlternativeSelected=true;result.data.siteComparisonSelectionRevised=true;result.data.previousSelectedSiteItem=ref.selected.id;
    if(ref.feature){result.data.siteFeature=ref.feature;result.data.siteFeatures=[ref.feature];result.data.siteFeatureSubjects=ref.featureSubjects.slice();}
    return result;
  }
  function answerComparisonCandidateRecall(text,history){
    if(!comparisonCandidateRecallCue(text))return null;
    var ctx=discardStaleCandidateContext(history,historyGuideContext(history));if(ctx.candidateKind!=='comparison'||ctx.candidates.length<2)return null;
    var list=uniqueCandidateItems(ctx.candidates),ids=list.map(function(x){return x.id;}),selected=ctx.selectedCandidate&&list.filter(function(x){return x.id===ctx.selectedCandidate.id;})[0]||null;
    if(comparisonOtherCandidateRecallCue(text)&&list.length!==2)return null;
    var data={siteComparison:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:(ctx.sourceCandidates.length?ctx.sourceCandidates:list).map(function(x){return x.id;}),siteComparisonCandidateRecall:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''};
    if(ctx.feature){data.siteFeature=ctx.feature;data.siteFeatures=[ctx.feature];data.siteFeatureSubjects=(ctx.featureSubjects||[]).slice(0,4);}
    if(ctx.conditions.length)data.siteConditions=conditionSnapshot(ctx.conditions);
    if(selected){data.siteItem=selected.id;data.selectedSiteItem=selected.id;}
    if(comparisonCandidateSetRecallCue(text)){
      data.siteItems=ids.slice();data.siteComparisonCandidateSetRecall=true;
      return {handled:true,mode:'サイト総合案内',answer:'今比べているのは'+candidateNames(list)+'です。'+(selected?'現在選んでいるのは「'+selected.name+'」です。':'まだ一つには決めていません。'),links:list.map(itemLink),data:data};
    }
    data.siteComparisonOtherCandidateRecall=true;
    if(!selected){
      data.needsClarification=true;data.siteComparisonOtherRecallNeedsSelection=true;data.siteItems=ids.slice();
      return {handled:true,mode:'サイト総合案内',answer:'まだ一つを選んでいないので、「もう片方」は決められません。今比べているのは'+candidateNames(list)+'です。',links:list.map(itemLink),data:data};
    }
    var others=list.filter(function(x){return x.id!==selected.id;});
    if(others.length!==1){
      data.needsClarification=true;data.siteComparisonOtherRecallNeedsSelection=true;data.siteItems=ids.slice();
      return {handled:true,mode:'サイト総合案内',answer:'「'+selected.name+'」以外に候補が複数あります。どの候補か名前で教えてください。',links:list.map(itemLink),data:data};
    }
    var other=others[0];data.siteItem=other.id;data.siteItems=[other.id];data.siteViewedAlternative=other.id;data.selectedSiteItem=selected.id;
    return {handled:true,mode:'サイト総合案内',answer:'「'+selected.name+'」のもう片方は「'+other.name+'」です。現在の選択は「'+selected.name+'」のままです。',links:[itemLink(other)],data:data};
  }
  function comparisonSelectionRecallCue(text){
    var t=normalizeInput(text);if(!t)return false;
    if(/^(?:(?:今|いま|現在|結局|さっき|先ほど)[、,\s]*)?(?:何|どれ|どっち|どちら)(?:を)?(?:選んでる|選んでいる|選んだ|決めた)(?:の|ん)?(?:だっけ|でしたっけ|か|は)?[。！!？?]*$/.test(t))return true;
    if(/^(?:(?:今|いま|現在|結局|さっき|先ほど)[、,\s]*)?(?:何|どれ|どっち|どちら)(?:に|を)(?:した|選んだ|決めた)(?:んだっけ|っけ|の|のか|か)?[。！!？?]*$/.test(t))return true;
    if(/^(?:今|いま|現在|さっき|先ほど|結局)(?:の)?(?:選択|決定)(?:は|って|どれ|何|どっち|どちら)?(?:だっけ|でしたっけ)?[。！!？?]*$/.test(t))return true;
    if(/^(?:さっき|先ほど|今)(?:に)?(?:選んだ|決めた|選択した)(?:の|方|ほう)(?:は|って|どれ|何)?(?:だっけ|でしたっけ)?[。！!？?]*$/.test(t))return true;
    return /^(?:選んだ|決めた|選択した)(?:の|方|ほう)(?:は|って|どれ|何|どっち|どちら)(?:だっけ|でしたっけ)?[。！!？?]*$/.test(t);
  }
  function answerComparisonSelectionRecall(text,history){
    if(!comparisonSelectionRecallCue(text))return null;
    var ctx=discardStaleCandidateContext(history,historyGuideContext(history));if(ctx.candidateKind!=='comparison'||ctx.candidates.length<2)return null;
    var list=uniqueCandidateItems(ctx.candidates),ids=list.map(function(x){return x.id;}),selected=ctx.selectedCandidate&&list.filter(function(x){return x.id===ctx.selectedCandidate.id;})[0]||null;
    var data={siteComparison:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:(ctx.sourceCandidates.length?ctx.sourceCandidates:list).map(function(x){return x.id;}),siteComparisonSelectionRecall:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''};
    if(ctx.feature){data.siteFeature=ctx.feature;data.siteFeatures=[ctx.feature];data.siteFeatureSubjects=(ctx.featureSubjects||[]).slice(0,4);}
    if(ctx.conditions.length)data.siteConditions=conditionSnapshot(ctx.conditions);
    if(!selected){
      data.needsClarification=true;data.siteComparisonSelectionRecallUndecided=true;
      return {handled:true,mode:'サイト総合案内',answer:'まだどちらにも決めていません。今比べているのは'+candidateNames(list)+'です。選ぶなら、名前か前・後で教えてください。',links:list.map(itemLink),data:data};
    }
    data.siteItem=selected.id;data.selectedSiteItem=selected.id;data.siteItems=[selected.id];
    return {handled:true,mode:'サイト総合案内',answer:'現在選んでいるのは「'+selected.name+'」です。こちらから開けます。',links:[itemLink(selected)],data:data};
  }
  function comparisonSelectionConfirmationCue(text){
    var t=normalizeInput(text),lead='(?:(?:じゃあ|じゃ|では|それなら|うん|はい)[、,\\s]*)?';
    return new RegExp('^'+lead+'(?:それ(?:で(?:いい|お願い|頼む|進めて)?|に(?:する|決める)|を(?:使う|選ぶ)|がいい)|そっち(?:で(?:いい|お願い|頼む|進めて)?|に(?:する|決める)|を(?:使う|選ぶ)|がいい)|(?:おすすめ|選んだ|その)(?:の)?(?:方|ほう)(?:で(?:いい|お願い|頼む|進めて)?|に(?:する|決める)|がいい))[？?。！!]*$').test(t);
  }
  function comparisonDecisionBridgeCue(text){
    var t=normalizeInput(text);
    if(comparisonViewedAlternativeSelectionCue(t))return true;
    if(comparisonSelectionConfirmationCue(t))return true;
    if(comparisonCandidateRecallCue(t))return true;
    if(comparisonSelectionRecallCue(t))return true;
    if(comparisonSelectionRevisionCue(t,[],null)||/(?:やっぱ|やはり|いや|訂正|変える|変えて|変更|切り替|にする|でお願い|じゃなく|ではなく|今のなし)/.test(t))return true;
    if(comparisonChoiceReasonCue(t))return true;
    return /^(?:なるほど(?:ね)?|そうなんだ|そうか|了解|わかった|分かった|おけ|OK|ありがとう|ありがと|うん|はい|へえ|ふーん|ほう)[。！!？?～〜]*$/i.test(t);
  }
  function answerComparisonSelectionConfirmation(text,history){
    if(!comparisonSelectionConfirmationCue(text))return null;
    var ctx=discardStaleCandidateContext(history,historyGuideContext(history));if(ctx.candidateKind!=='comparison'||ctx.candidates.length<2)return null;
    var list=uniqueCandidateItems(ctx.candidates),ids=list.map(function(x){return x.id;}),selected=ctx.selectedCandidate&&list.filter(function(x){return x.id===ctx.selectedCandidate.id;})[0]||null;
    var data={siteComparison:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:(ctx.sourceCandidates.length?ctx.sourceCandidates:list).map(function(x){return x.id;}),siteComparisonSelectionConfirmation:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''};
    if(!selected){
      data.needsClarification=true;data.siteComparisonSelectionConfirmationNeedsChoice=true;
      return {handled:true,mode:'サイト総合案内',answer:'まだ一つには決まっていないのですよ。'+candidateNames(list)+'のどちらにするか、名前か前・後で教えてください。',links:list.map(itemLink),data:data};
    }
    data.siteItem=selected.id;data.selectedSiteItem=selected.id;data.siteItems=[selected.id];data.siteComparisonSelectionConfirmed=true;
    if(ctx.feature){data.siteFeature=ctx.feature;data.siteFeatures=[ctx.feature];data.siteFeatureSubjects=(ctx.featureSubjects||[]).slice(0,4);}
    return {handled:true,mode:'サイト総合案内',answer:'では「'+selected.name+'」で進めます。こちらから開けます。',links:[itemLink(selected)],data:data};
  }
  function comparisonChoiceReasonCue(text){
    var t=normalizeInput(text);
    if(/(?:なんで|なぜ|どうして|理由|根拠)/.test(t))return true;
    if(/^(?:じゃあ|では|それなら|でも|で|それで)?[、,\s]*(?:なんで|なぜ|どうして|理由(?:は|を教えて|教えて)?|根拠(?:は|を教えて|教えて)?|どういう理由|どういうこと)(?:なの|ですか|そうなるの|そう言えるの|そっちなの|そっちを選ぶの|一つに絞れないの|両方なの)?[？?。！!]*$/.test(t))return true;
    return /(?:じゃ|では|だと|なら|は)(?:だめ|ダメ|駄目|違う|合わない)(?:なの|ですか)?|(?:じゃ|では)ないの[？?。！!]*$/.test(t)&&mentionedItems(t).length>0;
  }
  function comparisonPurposeDecisionContext(history){
    var h=Array.isArray(history)?history:[],ctx=discardStaleCandidateContext(h,historyGuideContext(h));
    if(ctx.candidateKind!=='comparison'||ctx.candidates.length<2||ctx.candidateIndex<0)return null;
    var assistant=h[ctx.candidateIndex],data=assistant&&assistant.meta&&assistant.meta.data||{},query='',purposeQuery='',list=uniqueCandidateItems(ctx.candidates),min=Math.max(0,ctx.candidateIndex-12);
    for(var i=ctx.candidateIndex-1;i>=min;i--){
      if(!h[i]||h[i].role!=='user')continue;query=S(h[i].text);
      purposeQuery=comparisonPurposeCue(query)?query:comparisonPurposeShorthandText(query,list);
      if(purposeQuery)break;
      if(comparisonDecisionBridgeCue(query))continue;
      return null;
    }
    if(!purposeQuery)return null;
    var specs=comparisonPurposeSpecs(purposeQuery,list);if(!specs.length)return null;
    var matched=[],unknown=[];
    list.forEach(function(item){
      var bodies=[],seen={},ok=true,uncertain=false;
      specs.forEach(function(spec){
        var ev=comparisonPurposeEvidence(item,spec,purposeQuery);if(ev.status===0)uncertain=true;else if(ev.status<0)ok=false;
        (ev.bodies||[]).forEach(function(body){body=S(body);if(body&&!seen[body]){seen[body]=1;bodies.push(body);}});
      });
      var entry={item:item,bodies:bodies};if(ok&&!uncertain)matched.push(entry);else if(uncertain)unknown.push(entry);
    });
    var selectedId=S(data.selectedSiteItem||data.siteItem||''),selected=list.filter(function(x){return x.id===selectedId;})[0]||null;
    var selectedMatches=!!(selected&&matched.some(function(x){return x.item.id===selected.id;}));
    return {items:list,specs:specs,query:purposeQuery,matched:matched,unknown:unknown,selected:selected,selectionOverrodePurpose:!!(selected&&matched.length&&!selectedMatches)};
  }
  function comparisonPurposeLabel(query,specs){
    var t=normalizeInput(query),exact={minimum_activation:'合成最低発現数を見る',kaiun:'開運系を確認する',eiyu:'英雄系を確認する',joran:'上覧系を確認する',right_hand:'右手へ反映する',left_hand:'左手へ反映する',neck:'首へ反映する'};
    if((specs||[]).some(function(x){return x.intent==='reflect';})){
      if(/能力計算/.test(t))return '能力計算に反映する';
      if(/家臣/.test(t))return '家臣計算に反映する';
    }
    for(var i=0;i<(specs||[]).length;i++){if(specs[i].key&&exact[specs[i].key])return exact[specs[i].key];}
    for(var j=0;j<(specs||[]).length;j++){
      if(!specs[j].intent)continue;var phrase=featureCuePhrase(specs[j].intent);
      if(phrase)return phrase.replace(/できる$/,'する').replace(/使える$/,'使う');
    }
    return 'その目的に使う';
  }
  function comparisonReasonBody(entry,usePurposeEvidence){
    var item=entry&&entry.item,page=sourcePage(item),facts=page&&page.facts||{},body=usePurposeEvidence&&(entry.bodies||[]).join(' ');
    return S(body||facts.compare||item&&item.desc||'');
  }
  function answerComparisonChoiceReason(text,history){
    if(!comparisonChoiceReasonCue(text))return null;
    var ctx=comparisonPurposeDecisionContext(history);if(!ctx)return null;
    var ids=ctx.items.map(function(x){return x.id;}),label=comparisonPurposeLabel(ctx.query,ctx.specs),data={siteComparison:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:ids,siteComparisonReason:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''},answer='',links=[];
    var mentioned=mentionedItems(text).filter(function(x){return ids.indexOf(x.id)>=0;}),challenged=mentioned.length===1&&(!ctx.selected||mentioned[0].id!==ctx.selected.id)?mentioned[0]:null;
    if(ctx.selected){
      var chosen=ctx.matched.filter(function(x){return x.item.id===ctx.selected.id;})[0]||{item:ctx.selected,bodies:[]};
      if(ctx.selectionOverrodePurpose){
        answer='現在「'+ctx.selected.name+'」を選んでいるのは、直前の変更を優先したためです。\n元の「'+label+'」目的に合うのは '+candidateNames(ctx.matched.map(function(x){return x.item;}))+'です。\n・'+ctx.selected.name+'：'+comparisonReasonBody(chosen,false);
        data.siteComparisonReasonOverride=true;
      }else answer='「'+ctx.selected.name+'」を選んだのは、「'+label+'」目的に合うことを確認できるためです。\n・'+ctx.selected.name+'：'+comparisonReasonBody(chosen,true);
      if(challenged){
        var other=ctx.items.filter(function(x){return x.id===challenged.id;})[0],otherEntry={item:other,bodies:[]};
        answer+='\n「'+other.name+'」が悪いのではなく、主な用途が違います。\n・'+other.name+'：'+comparisonReasonBody(otherEntry,false);
        data.siteComparisonReasonChallenge=true;data.reasonChallengedSiteItem=other.id;
      }
      answer+='\n選んだページはこちらです。';links=[itemLink(ctx.selected)];data.siteItem=ctx.selected.id;data.selectedSiteItem=ctx.selected.id;data.siteItems=[ctx.selected.id];
    }else if(ctx.matched.length>=2&&!ctx.unknown.length){
      answer='一つに絞れないのは、「'+label+'」目的を'+candidateNames(ctx.matched.map(function(x){return x.item;}))+'のどちらも満たすためです。\n'+ctx.matched.map(function(x){return '・'+x.item.name+'：'+comparisonReasonBody(x,true);}).join('\n')+'\nもう一つ条件があれば、そこから絞り込めます。';
      links=ctx.matched.map(function(x){return itemLink(x.item);});data.siteItems=ctx.matched.map(function(x){return x.item.id;});data.siteComparisonReasonShared=true;data.needsClarification=true;
    }else if(!ctx.matched.length&&!ctx.unknown.length){
      answer='理由は、比べている'+candidateNames(ctx.items)+'のどちらにも「'+label+'」ための対応を確認できないからです。別の目的なら選び直せます。';
      links=ctx.items.map(itemLink);data.siteItems=[];data.siteComparisonReasonNoMatch=true;
    }else{
      answer='一つに決めなかったのは、「'+label+'」目的を判断する情報が不足しているためです。推測では選ばず、もう少し具体的な条件を確認しています。';
      links=ctx.items.map(itemLink);data.siteItems=ctx.matched.map(function(x){return x.item.id;});data.siteComparisonReasonUnknown=true;data.needsClarification=true;
    }
    var intents=ctx.specs.filter(function(x){return !!x.intent;}).map(function(x){return x.intent;}),uniqueIntents=[];intents.forEach(function(x){if(uniqueIntents.indexOf(x)<0)uniqueIntents.push(x);});
    if(uniqueIntents.length===1){data.siteFeature=uniqueIntents[0];data.siteFeatures=uniqueIntents.slice();data.siteFeatureSubjects=featureSubjectIds(ctx.query);}
    return {handled:true,mode:'サイト総合案内',answer:answer,links:links,data:data};
  }
  function sameOrDifferentCue(text){
    return /^(?:じゃあ|では|それなら|で)?[、,\s]*(?:どっちも|両方|全部)?(?:ほぼ|だいたい)?(?:同じ|一緒)(?:なの|ですか|なのかな|ってこと|で合ってる)?[？?。！!]*$/.test(normalizeInput(text));
  }
  function comparisonDifferenceCue(text){
    return /^(?:じゃあ|では|それなら|で)?[、,\s]*(?:もう一度|もう一回|改めて)?[、,\s]*(?:二つ|2つ|２つ|両方|それぞれ|残り)?(?:の|を)?(?:違い|差|どう違う|何が違う|比べて|比較して|比べたい)(?:だけ)?(?:(?:を)?(?:もう一度|もう一回|改めて))?(?:は|って|を教えて|教えて|ですか)?[？?。！!]*$/.test(normalizeInput(text));
  }
  function openToHelpCorrectionCue(text){
    var t=normalizeInput(text);
    return /(?:開く|開いて|開ける|見せる|出す)(?:ん)?(?:じゃなくて|ではなくて|じゃなく|ではなく)[、,\s]*(?:使い方|やり方|何ができる|できること|入力項目|見方|説明)(?:だけ|を|教えて|知りたい)?[。！!？?]*$/.test(t);
  }

  function tenkaTournamentBranch(text){
    var t=normalizeInput(text);
    if(/(?:天|上).*(?:じゃなくて|ではなくて|じゃなく|ではなく|違って)[、,\s]*(?:地|下)/.test(t))return BY_ID.chi_mode;
    if(/(?:地|下).*(?:じゃなくて|ではなくて|じゃなく|ではなく|違って)[、,\s]*(?:天|上)/.test(t))return BY_ID.ten_mode;
    var lead='(?:(?:じゃあ|では|それなら|やっぱり|やはり|いや|違う|訂正)[、,\s]*)?',tail='(?:の方|のほう|で|を|がいい|を見たい|を見せて|を開いて|へ行きたい|にして|に変えて|へ変えて|に変更|でお願い|の表の見方|の見方|のカウンター(?:表)?の見方)?[。！!？?]*';
    if(new RegExp('^'+lead+'(?:天|上)'+tail+'$').test(t))return BY_ID.ten_mode;
    if(new RegExp('^'+lead+'(?:地|下)'+tail+'$').test(t))return BY_ID.chi_mode;
    return null;
  }
  function hierarchicalSelection(text,recent){
    if(!recent)return null;var t=normalizeInput(text),base=recent;
    var children=childrenOf(base),parent=parentOf(base);
    if(children.length){
      var c=selectFromCandidates(t,children);if(c)return c;
      if(base.id==='tenka_taikai'){
        var branch=tenkaTournamentBranch(t);if(branch)return branch;
      }
    }
    if(parent){
      var siblings=childrenOf(parent),s=selectFromCandidates(t,siblings);if(s)return s;
      if(parent.id==='tenka_taikai'){
        var siblingBranch=tenkaTournamentBranch(t);if(siblingBranch)return siblingBranch;
      }
    }
    return null;
  }

  function roughFollowupItem(text){
    var t=siteClauseLead(normalizeInput(text)),d=findItemDetailed(t),p=purposeScores(t),item=d.item||(p[0]&&p[0].item)||null;
    if(!item&&/家臣(?:の)?(?:方|ほう)?/.test(t))item=BY_ID.retainer;
    if(!item&&/(?:自分|自キャラ|キャラ|プレイヤー|能力計算)(?:の)?(?:方|ほう)?/.test(t))item=BY_ID.stats;
    return item;
  }
  function featureCarryFollowup(text,ctx){
    ctx=ctx||{};if(!ctx.feature)return null;
    var t=siteClauseLead(normalizeInput(text)),item=roughFollowupItem(t),page=sourcePage(item),facts=page&&page.facts||{};
    if(!item||!S(facts[ctx.feature]))return null;
    if(!/^(?:.+?)(?:は|って|だと|なら|の方(?:は)?|のほう(?:は)?|はどう|だとどう|ならどう)[？?。！!]*$/.test(t))return null;
    var query=t,subjects=featureSubjectIds(t),carried=Array.isArray(ctx.featureSubjects)?ctx.featureSubjects:[];
    if(ctx.feature==='columns'&&ctx.featureDetail==='acquisition'&&!/(?:入手|取り方|とり方|どこで)/.test(query))query+=' 入手をどこで確認';
    if(ctx.feature==='reflect'&&!subjects.length&&carried.length===1){
      var label=featureSubjectLabel(carried[0]);if(label)query+=' '+label;
    }
    return {item:item,feature:ctx.feature,query:query};
  }

  function explicitContextFeatureIntents(text,item){
    var t=normalizeInput(text),out=featureIntents(t,item),material=!!(item&&(item.id==='kishin'||item.id==='tsukumo'||item.id==='mado'));
    function add(key){if(out.indexOf(key)<0)out.push(key);}
    // 単独の「入手は？」は実データ回答へ残す一方、既にサイト案内の文脈がある
    // 「保存じゃなく入手の方」のような観点訂正では、一覧の入手列を意味すると解釈する。
    if(material&&/(?:入手(?:先|方法)?|取り方|とり方|どこで(?:取れる|とれる|手に入る)|入手の方|入手のほう)/.test(t))add('columns');
    return out;
  }
  function contextFeatureLabel(intent,text){
    var t=normalizeInput(text),map={save:'保存',sort:'並べ替え',selection_count:'選択数',reflect:'反映',share:'共有',zoom:'拡大・縮小',reset:'リセット',inputs:'入力',columns:'表示内容',types:'種類',categories:'選択肢',history:'履歴',random:'抽選',entry:'登録人数',schedule:'日程',filter:'絞り込み',back:'戻り先',related:'関連ページ',download:'ダウンロード'};
    if(intent==='columns'&&/(?:入手|取り方|とり方|どこで)/.test(t))return'入手';
    return map[intent]||featureCuePhrase(intent)||'その内容';
  }
  function featureRevisionCue(text){
    var t=normalizeInput(text);
    return /(?:じゃなくて|ではなくて|じゃなく|ではなく|違って|ちがって|訂正|やっぱ(?:り)?)[、,\s]*/.test(t)&&/(?:保存|画像|スクショ|入手|取り方|とり方|並べ替|ソート|共有|URL|リンク|拡大|縮小|リセット|入力|反映|何個|いくつ|種類|履歴)/.test(t);
  }
  function answerFeatureRevision(text,history){
    if(!featureRevisionCue(text))return null;
    // 「もう片方」「もう一方」は観点ではなく比較候補そのものの訂正。
    // 既存の比較候補訂正を先に扱わせ、対象選択の意味を奪わない。
    if(/(?:もう片方|もう一方|反対の方|反対のほう|選ばなかった方|選ばなかったほう|今のじゃない方|今のじゃないほう)/.test(normalizeInput(text)))return null;
    var removal=conditionRemovalRequest(text);
    if(removal&&(removal.all||(removal.remove||[]).length))return null;
    var ctx=historyGuideContext(history);
    // 観点だけの言い直しは、直前までサイト案内をしていた場合に限定する。
    // 単独の「ページじゃなく入手方法」は正本の実データ質問なので横取りしない。
    if(!ctx.item)return null;
    var tail=correctionTail(text)||normalizeInput(text),explicit=mentionedItems(tail),parts=siteCorrectionParts(text),leftItems=parts?mentionedItems(parts.left):[],item=explicit.length===1?explicit[0]:(leftItems.length===1?leftItems[0]:ctx.item);
    if(!item)return null;
    var intents=explicitContextFeatureIntents(tail,item);if(!intents.length)return null;
    var result=answerFeatures(item,intents,true,tail);if(!result)return null;
    result.answer='わかりました。観点を「'+contextFeatureLabel(intents[0],tail)+'」の方へ切り替えますね。\n'+String(result.answer||'');
    result.data=result.data||{};result.data.siteFeatureRevision=true;result.data.previousSiteFeature=String(ctx.feature||'');
    if((ctx.candidates||[]).some(function(x){return x&&x.id===item.id;}))result=retainCandidateContext(result,ctx.candidates,item,ctx.candidateKind,ctx.sourceCandidates,ctx.conditions);
    return result;
  }
  function sameFeatureTargetSwitchCue(text){
    var t=normalizeInput(text),items=mentionedItems(t);
    if(items.length!==1)return null;
    if(!/(?:同じこと|同じの|同じ内容|同様に|同じように|それも同じ|同じで|同じやつ)/.test(t))return null;
    return items[0];
  }
  function answerSameFeatureTargetSwitch(text,history){
    var target=sameFeatureTargetSwitchCue(text);if(!target)return null;
    var ctx=historyGuideContext(history),feature=String(ctx.feature||''),page=sourcePage(target),facts=page&&page.facts||{};
    if(!feature||!S(facts[feature]))return null;
    var query=normalizeInput(text);
    if(feature==='columns'&&ctx.featureDetail==='acquisition'&&!/(?:入手|取り方|とり方|どこで)/.test(query))query+=' 入手をどこで確認';
    if(feature==='reflect'&&!featureSubjectIds(query).length&&ctx.featureSubjects.length===1){var label=featureSubjectLabel(ctx.featureSubjects[0]);if(label)query+=' '+label;}
    var result=answerFeatures(target,[feature],true,query);if(!result)return null;
    result.answer='同じ内容を「'+target.name+'」に切り替えますね。\n'+String(result.answer||'');
    result.data=result.data||{};result.data.siteSameFeatureTargetSwitch=true;result.data.previousSiteItem=ctx.item&&ctx.item.id||'';
    return result;
  }
  function topicHistoryStepCue(text){
    var t=siteClauseLead(normalizeInput(correctionTail(text)||text)),m=null,step=0;
    if(!/(?:話題|話)/.test(t)||!/(?:前|まえ)/.test(t))return {requested:false,step:0};
    m=t.match(/([2-9２-９二三四五六七八九])(?:つ|個)?(?:前|まえ)(?:の)?(?:話題|話)/);if(m)step=numberValue(m[1]);
    if(!step&&/(?:一つ|ひとつ|1つ|１つ|一個|1個|１個)(?:前|まえ)(?:の)?(?:話題|話)/.test(t))step=1;
    if(!step&&/(?:その前|前の)(?:の)?(?:話題|話)/.test(t))step=1;
    return {requested:step>0,step:step||0};
  }
  function siteGuideTopicHistory(history,current){
    var h=Array.isArray(history)?history:[],out=[],lastId=current&&current.id||'';
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var data=(x.meta&&x.meta.data)||{};if(data.siteGuideContextCleared||String(data.siteItem||'')==='__site_guide_context_cleared__')break;
      if(!data.siteGuide)continue;
      var id=String(data.siteItem||'');
      if(!id&&Array.isArray(data.siteItems)&&data.siteItems.length===1)id=String(data.siteItems[0]||'');
      if(!BY_ID[id]||id===lastId)continue;
      var feature=String(data.siteFeature||''),detail=feature==='columns'&&/入手/.test(S(x.text))?'acquisition':'';
      out.push({item:BY_ID[id],feature:feature,featureDetail:detail,text:S(x.text),index:i});lastId=id;
    }
    return out;
  }
  function answerTopicHistoryReference(text,history){
    var cue=topicHistoryStepCue(text);if(!cue.requested)return null;
    var ctx=historyGuideContext(history),topics=siteGuideTopicHistory(history,ctx.item),step=cue.step;
    if(topics.length<step){
      var known=topics.slice(0,4),knownNames=known.map(function(x){return '「'+x.item.name+'」';}).join('、');
      return {handled:true,mode:'サイト総合案内',answer:'会話履歴では「'+step+'つ前の話題」まで一意にたどれませんでした。'+(known.length?'戻れる直近の話題は '+knownNames+'です。':'')+' ページ名を言ってもらえれば、勝手に決めずに続けます。',links:known.map(function(x){return itemLink(x.item);}),data:{needsClarification:true,siteTopicHistoryNeedsClarification:true,siteTopicHistoryRequestedStep:step,siteItem:ctx.item&&ctx.item.id||''}};
    }
    var ref=topics[step-1],item=ref.item,intents=explicitContextFeatureIntents(text,item),same=/(?:同じこと|同じ内容|同じの)/.test(normalizeInput(text));
    if(!intents.length&&same&&ctx.feature)intents=[ctx.feature];
    var query=normalizeInput(text);
    if(intents.length&&intents[0]==='columns'&&/(?:入手|取り方|とり方)/.test(query)===false&&((same&&ctx.featureDetail==='acquisition')||ref.featureDetail==='acquisition'))query+=' 入手をどこで確認';
    var result=intents.length?answerFeatures(item,intents,true,query):explainItem(item,true);if(!result)return null;
    result.answer=step+'つ前の話題だった「'+item.name+'」に戻りますね。\n'+String(result.answer||'');
    result.data=result.data||{};result.data.siteTopicHistoryRestore=true;result.data.siteTopicHistoryRequestedStep=step;result.data.previousSiteItem=ctx.item&&ctx.item.id||'';
    return result;
  }

  function siteGuideTopicSequence(history){
    var h=Array.isArray(history)?history:[],start=0,out=[],lastId='';
    for(var c=h.length-1;c>=0;c--){
      var clear=(h[c]&&h[c].role==='assistant'&&h[c].meta&&h[c].meta.data)||{};
      if(clear.siteGuideContextCleared||String(clear.siteItem||'')==='__site_guide_context_cleared__'){start=c+1;break;}
    }
    for(var i=start;i<h.length;i++){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var data=(x.meta&&x.meta.data)||{};if(!data.siteGuide)continue;
      var id=String(data.siteItem||'');
      if(!id&&Array.isArray(data.siteItems)&&data.siteItems.length===1)id=String(data.siteItems[0]||'');
      if(!BY_ID[id]||id===lastId)continue;
      var feature=String(data.siteFeature||''),detail=feature==='columns'&&/入手/.test(S(x.text))?'acquisition':'';
      out.push({item:BY_ID[id],feature:feature,featureDetail:detail,text:S(x.text),index:i});lastId=id;
    }
    return out;
  }
  function absoluteTopicHistoryCue(text){
    var t=siteClauseLead(normalizeInput(correctionTail(text)||text));
    if(!/(?:最初|一番最初|いちばん最初|初め|はじめ)/.test(t))return false;
    return /(?:見てた|見ていた|見た|話題|話|ページ|やつ|ところ)/.test(t);
  }
  function answerAbsoluteTopicReference(text,history){
    if(!absoluteTopicHistoryCue(text))return null;
    var ctx=historyGuideContext(history),seq=siteGuideTopicSequence(history);
    if(!seq.length){
      return {handled:true,mode:'サイト総合案内',answer:'この会話では、最初に見ていたサイト案内の話題をまだ特定できませんでした。ページ名を一つ言ってもらえれば、そこから続けます。',links:[],data:{needsClarification:true,siteAbsoluteTopicNeedsClarification:true}};
    }
    var ref=seq[0],item=ref.item,intents=explicitContextFeatureIntents(text,item),same=/(?:同じこと|同じ内容|同じの|同じように)/.test(normalizeInput(text));
    if(!intents.length&&same&&ctx.feature)intents=[ctx.feature];
    var query=normalizeInput(text);
    if(intents.length&&intents[0]==='columns'&&!/(?:入手|取り方|とり方)/.test(query)&&((same&&ctx.featureDetail==='acquisition')||ref.featureDetail==='acquisition'))query+=' 入手をどこで確認';
    var result=intents.length?answerFeatures(item,intents,true,query):explainItem(item,true);if(!result)return null;
    result.answer='最初に見ていた「'+item.name+'」の話へ戻りますね。\n'+String(result.answer||'');
    result.data=result.data||{};result.data.siteAbsoluteTopicRestore=true;result.data.siteTopicHistoryPosition='first';result.data.previousSiteItem=ctx.item&&ctx.item.id||'';
    return result;
  }
  function featureEpisodeReferenceCue(text){
    var t=siteClauseLead(normalizeInput(text));
    if(!/(?:さっき|先ほど|前に|以前|この前)/.test(t))return null;
    // 「前に見ていた方の保存」はページ履歴→新しい保存質問であり、
    // 「前に保存を聞いた方」とは意味が違う。観点語と過去の質問/説明行為が
    // 同じまとまりにある場合だけ、観点エピソード参照として扱う。
    var episodeForward=/(?:保存|画像|スクショ|スクリーンショット|入手|取り方|とり方|並べ替|ソート|共有|URL|リンク)(?:について|のこと|の話|を|って|は)?[^。！？!?]{0,14}(?:聞いた|聞いてた|聞いていた|話した|話してた|話していた|案内して|説明して)/.test(t);
    var episodeReverse=/(?:聞いた|聞いてた|聞いていた|話した|話してた|話していた|案内してた|説明してた)[^。！？!?]{0,10}(?:保存|入手|取り方|とり方|並べ替|ソート|共有)/.test(t);
    if(!episodeForward&&!episodeReverse)return null;
    if(/(?:入手|取り方|とり方|どこで手に入)/.test(t))return {feature:'columns',featureDetail:'acquisition',label:'入手'};
    if(/(?:保存|画像|スクショ|スクリーンショット)/.test(t))return {feature:'save',featureDetail:'',label:'保存'};
    if(/(?:並べ替|ソート|高い順|安い順|順番)/.test(t))return {feature:'sort',featureDetail:'',label:'並べ替え'};
    if(/(?:共有|URL|リンク)/i.test(t))return {feature:'share',featureDetail:'',label:'共有'};
    var intents=[];
    return null;
  }
  function latestFeatureEpisode(history,cue){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var data=(x.meta&&x.meta.data)||{};
      if(data.siteGuideContextCleared||String(data.siteItem||'')==='__site_guide_context_cleared__')break;
      if(!data.siteGuide)continue;
      var id=String(data.siteItem||''),feature=String(data.siteFeature||'');if(!BY_ID[id]||feature!==cue.feature)continue;
      var detail=feature==='columns'&&/入手/.test(S(x.text))?'acquisition':'';
      if(cue.featureDetail&&detail!==cue.featureDetail)continue;
      return {item:BY_ID[id],feature:feature,featureDetail:detail,text:S(x.text),index:i};
    }
    return null;
  }
  function answerFeatureEpisodeReference(text,history){
    var cue=featureEpisodeReferenceCue(text);if(!cue)return null;
    var ctx=historyGuideContext(history),ref=latestFeatureEpisode(history,cue);
    if(!ref){
      return {handled:true,mode:'サイト総合案内',answer:'この会話履歴では、前に「'+cue.label+'」を案内した対象を一つに特定できませんでした。ページ名を言ってもらえれば、その内容で続けます。',links:[],data:{needsClarification:true,siteFeatureEpisodeNeedsClarification:true,siteFeatureEpisodeRequested:cue.feature}};
    }
    var query=normalizeInput(text);if(cue.featureDetail==='acquisition'&&!/(?:入手|取り方|とり方)/.test(query))query+=' 入手をどこで確認';
    var result=answerFeatures(ref.item,[ref.feature],true,query);if(!result)return null;
    result.answer='前に「'+cue.label+'」を案内した「'+ref.item.name+'」の話へ戻りますね。\n'+String(result.answer||'');
    result.data=result.data||{};result.data.siteFeatureEpisodeRestore=true;result.data.siteFeatureEpisodeRequested=cue.feature;result.data.previousSiteItem=ctx.item&&ctx.item.id||'';
    return result;
  }

  function qualifiedHistoricalEpisodeCue(text){
    var t=siteClauseLead(normalizeInput(text)),items=mentionedItems(t);if(items.length!==1)return null;
    var historical=/(?:さっき|先ほど|前に|以前|この前|あの時|あのとき|その時|そのとき)/.test(t)||/(?:話(?:を)?して(?:た|いた)|聞い(?:た|てた|ていた)|案内して(?:た|いた)|説明して(?:た|いた))[^。！？!?]{0,10}(?:時|とき)|(?:時|とき)の/.test(t);
    if(!historical)return null;
    var item=items[0],intents=explicitContextFeatureIntents(t,item);if(intents.length!==1)return null;
    var feature=intents[0],detail=feature==='columns'&&/(?:入手|取り方|とり方|どこで)/.test(t)?'acquisition':'',label=contextFeatureLabel(feature,t);
    return {item:item,feature:feature,featureDetail:detail,label:label};
  }
  function latestQualifiedHistoricalEpisode(history,cue){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var data=(x.meta&&x.meta.data)||{};
      if(data.siteGuideContextCleared||String(data.siteItem||'')==='__site_guide_context_cleared__')break;
      if(!data.siteGuide||String(data.siteItem||'')!==cue.item.id||String(data.siteFeature||'')!==cue.feature)continue;
      var detail=cue.feature==='columns'&&/入手/.test(S(x.text))?'acquisition':'';
      if(cue.featureDetail&&detail!==cue.featureDetail)continue;
      return {item:cue.item,feature:cue.feature,featureDetail:detail,text:S(x.text),index:i};
    }
    return null;
  }
  function answerQualifiedHistoricalEpisode(text,history){
    var cue=qualifiedHistoricalEpisodeCue(text);if(!cue)return null;
    var ctx=historyGuideContext(history),ref=latestQualifiedHistoricalEpisode(history,cue);
    if(!ref){
      return {handled:true,mode:'サイト総合案内',answer:'この会話履歴では、「'+cue.item.name+'」の「'+cue.label+'」を前に案内した場面を確認できませんでした。今の内容として聞きたい場合は「'+cue.item.name+'の'+cue.label+'を教えて」のように言ってもらえれば、以前の話と混同せず案内します。',links:[itemLink(cue.item)],data:{needsClarification:true,siteQualifiedEpisodeNeedsClarification:true,siteItem:cue.item.id,siteFeature:cue.feature}};
    }
    var query=normalizeInput(text);if(cue.featureDetail==='acquisition'&&!/(?:入手|取り方|とり方)/.test(query))query+=' 入手をどこで確認';
    var result=answerFeatures(ref.item,[ref.feature],true,query);if(!result)return null;
    result.answer='前に「'+ref.item.name+'」の「'+cue.label+'」を話していたところですね。\n'+String(result.answer||'');
    result.data=result.data||{};result.data.siteQualifiedEpisodeRestore=true;result.data.siteQualifiedEpisodeFeature=cue.feature;result.data.previousSiteItem=ctx.item&&ctx.item.id||'';
    return result;
  }
  function pastMomentReferenceCue(text){
    var t=siteClauseLead(normalizeInput(text));
    if(mentionedItems(t).length)return false;
    return /^(?:(?:じゃあ|では|それなら)[、,\s]*)?(?:あの時|あのとき|あの頃|あのころ)(?:の)?(?:やつ|もの|話|話題|ページ|ところ)(?:に|へ)?(?:戻って|戻して|戻りたい|して|開いて|見せて)?[。！!？?]*$/.test(t);
  }
  function uniqueTopicRefs(seq,excludeId){
    var out=[],seen={};for(var i=seq.length-1;i>=0;i--){var ref=seq[i],id=ref&&ref.item&&ref.item.id||'';if(!id||id===excludeId||seen[id])continue;seen[id]=1;out.unshift(ref);}return out;
  }
  function answerPastMomentReference(text,history){
    if(!pastMomentReferenceCue(text))return null;
    var ctx=historyGuideContext(history),seq=siteGuideTopicSequence(history),older=uniqueTopicRefs(seq,ctx.item&&ctx.item.id||'');
    if(!older.length&&ctx.item){
      var only=seq.length?seq[seq.length-1]:{item:ctx.item,feature:ctx.feature,featureDetail:ctx.featureDetail},onlyResult=only.feature?answerFeatures(only.item,[only.feature],true,only.feature==='columns'&&only.featureDetail==='acquisition'?'入手をどこで確認':featureCuePhrase(only.feature)):explainItem(only.item,true);
      if(!onlyResult)return null;onlyResult.answer='「あの時」の話として確認できるのは「'+only.item.name+'」です。\n'+String(onlyResult.answer||'');onlyResult.data=onlyResult.data||{};onlyResult.data.sitePastMomentRestore=true;return onlyResult;
    }
    if(older.length===1){
      var ref=older[0],query=ref.feature==='columns'&&ref.featureDetail==='acquisition'?'入手をどこで確認':featureCuePhrase(ref.feature),result=ref.feature?answerFeatures(ref.item,[ref.feature],true,query):explainItem(ref.item,true);if(!result)return null;
      result.answer='「あの時」の話なら、今の話題より前に見ていた「'+ref.item.name+'」ですね。\n'+String(result.answer||'');result.data=result.data||{};result.data.sitePastMomentRestore=true;result.data.previousSiteItem=ctx.item&&ctx.item.id||'';return result;
    }
    if(older.length>1){
      var choices=older.slice(-4),ids=choices.map(function(x){return x.item.id;});
      return {handled:true,mode:'サイト総合案内',answer:'「あの時」だけだと、以前の話題が複数あります。'+candidateNames(choices.map(function(x){return x.item;}))+'のどれを指していますか？ 名前を一つ言ってもらえれば、その続きへ戻れます。',links:choices.map(function(x){return itemLink(x.item);}),data:{needsClarification:true,sitePastMomentNeedsClarification:true,siteItems:ids,siteCandidates:ids,candidates:ids}};
    }
    return {handled:true,mode:'サイト総合案内',answer:'この会話では、「あの時」と指せる以前のサイト案内をまだ確認できませんでした。ページ名か、何をしていた時かを一言もらえれば探せます。',links:[],data:{needsClarification:true,sitePastMomentNeedsClarification:true}};
  }
  function comparisonEpisodeSequence(history){
    var h=Array.isArray(history)?history:[],out=[],lastSignature='';
    for(var i=0;i<h.length;i++){
      var x=h[i];if(!x||x.role!=='assistant')continue;var data=(x.meta&&x.meta.data)||{};
      if(data.siteGuideContextCleared||String(data.siteItem||'')==='__site_guide_context_cleared__'){out=[];lastSignature='';continue;}
      var ids=Array.isArray(data.siteComparison)?data.siteComparison.map(String).filter(function(id){return !!BY_ID[id];}):[];
      if(ids.length<2){
        if(data.siteGuide&&String(data.siteItem||'')&&BY_ID[String(data.siteItem||'')])lastSignature='';
        continue;
      }
      var signature=ids.join('|'),items=ids.map(function(id){return BY_ID[id];}).filter(Boolean);if(items.length<2)continue;
      var selected=BY_ID[String(data.selectedSiteItem||'')];
      if(!selected||!items.some(function(y){return y.id===selected.id;})){
        var viewed=BY_ID[String(data.siteItem||'')];if(viewed&&items.some(function(y){return y.id===viewed.id;}))selected=viewed;else selected=null;
      }
      var feature=String(data.siteFeature||''),detail=feature==='columns'&&/入手/.test(S(x.text))?'acquisition':'';
      var ep=null;
      if(signature===lastSignature&&out.length)ep=out[out.length-1];
      else {ep={items:items.slice(),selected:null,feature:'',featureDetail:'',features:[],featureSubjects:[],conditions:[],startIndex:i,index:i,signature:signature};out.push(ep);lastSignature=signature;}
      ep.index=i;
      if(selected)ep.selected=selected;
      if(feature){ep.feature=feature;ep.featureDetail=detail;if(!ep.features.some(function(f){return f.feature===feature&&f.featureDetail===detail;}))ep.features.push({feature:feature,featureDetail:detail});}
      if(Array.isArray(data.siteFeatureSubjects)&&data.siteFeatureSubjects.length)ep.featureSubjects=data.siteFeatureSubjects.slice(0,4);
      if(Array.isArray(data.siteConditions)&&data.siteConditions.length)ep.conditions=data.siteConditions.slice();
    }
    return out;
  }
  function comparisonHistoryFeatureCue(text){
    var t=normalizeInput(text);
    if(/(?:入手|取り方|とり方|どこで手に入)/.test(t))return {feature:'columns',featureDetail:'acquisition',label:'入手'};
    if(/(?:保存|画像|スクショ|スクリーンショット)/.test(t))return {feature:'save',featureDetail:'',label:'保存'};
    if(/(?:並べ替|ソート|高い順|安い順|順番)/.test(t))return {feature:'sort',featureDetail:'',label:'並べ替え'};
    if(/(?:共有|URL|リンク)/i.test(t))return {feature:'share',featureDetail:'',label:'共有'};
    return null;
  }
  function comparisonRelativeStepCue(text){
    var t=normalizeInput(text),step=0;
    if(/(?:五つ前|いつつ前|五個前|5つ前|５つ前|5個前|５個前)/.test(t))step=5;
    else if(/(?:四つ前|よっつ前|四個前|4つ前|４つ前|4個前|４個前)/.test(t))step=4;
    else if(/(?:三つ前|みっつ前|三個前|3つ前|３つ前|3個前|３個前)/.test(t))step=3;
    else if(/(?:その前|さらに前|もう一つ前|もうひとつ前|もう一個前|二つ前|ふたつ前|二個前|2つ前|２つ前|2個前|２個前)/.test(t))step=2;
    else if(/(?:一つ前|ひとつ前|一個前|1つ前|１つ前|1個前|１個前)/.test(t))step=1;
    return step;
  }
  function comparisonAbsoluteOrderCue(text){
    var t=normalizeInput(text);
    if(/(?:最後から(?:二|2|２)番目|後ろから(?:二|2|２)番目)/.test(t))return {from:'end',position:2,label:'最後から二番目'};
    if(/(?:最後から(?:三|3|３)番目|後ろから(?:三|3|３)番目)/.test(t))return {from:'end',position:3,label:'最後から三番目'};
    if(/(?:最初から(?:二|2|２)番目)/.test(t))return {from:'start',position:2,label:'最初から二番目'};
    if(/(?:最初から(?:三|3|３)番目)/.test(t))return {from:'start',position:3,label:'最初から三番目'};
    if(/(?:一番最初|いちばん最初|最初|はじめ|初め)(?:の)?$/.test(t)||/(?:一番最初|いちばん最初|最初|はじめ|初め)(?:の)?(?:過去)?$/.test(t))return {from:'start',position:1,label:'最初'};
    if(/(?:一番最後|いちばん最後|最後|最新|直近)(?:の)?$/.test(t)||/(?:一番最後|いちばん最後|最後|最新|直近)(?:の)?(?:過去)?$/.test(t))return {from:'end',position:1,label:'最後'};
    return null;
  }
  function comparisonOrdinalAlternativeCue(text){
    var t=siteClauseLead(normalizeInput(text));
    if(!/(?:比較|比べ)/.test(t)||!/(?:もう片方|もう一方|反対の方|反対のほう|選ばなかった方|選ばなかったほう|別の方|別のほう)/.test(t))return null;
    var pos=t.search(/(?:比較|比べ)/),before=pos>=0?t.slice(0,pos):t,step=comparisonRelativeStepCue(before);
    if(!step)return null;
    return {step:step};
  }
  function historicalComparisonFeatureAlternativeCue(text){
    var t=siteClauseLead(normalizeInput(text));
    if(!/(?:比較|比べ)/.test(t)||!/(?:もう片方|もう一方|反対の方|反対のほう|選ばなかった方|選ばなかったほう|別の方|別のほう)/.test(t))return null;
    var pos=t.search(/(?:比較|比べ)/);if(pos<0)return null;
    var before=t.slice(0,pos),after=t.slice(pos),source=comparisonHistoryFeatureCue(before);
    if(!source||!/(?:話|聞い|案内|説明|してた|していた|だった)/.test(before))return null;
    var target=comparisonHistoryFeatureCue(after),anchors=mentionedItems(before),step=comparisonRelativeStepCue(before),absolute=comparisonAbsoluteOrderCue(before);
    return {source:source,target:target,anchors:anchors,step:step,absolute:absolute};
  }
  function comparisonOutputFeatureIntents(text,item){
    if(!item)return [];
    var t=normalizeInput(text),pos=t.search(/(?:比較|比べ)/),tail=pos>=0?t.slice(pos):t,intents=featureIntents(tail,item),cue=comparisonHistoryFeatureCue(tail);
    if(!intents.length&&cue&&sourcePage(item)&&S((sourcePage(item).facts||{})[cue.feature]))intents=[cue.feature];
    return intents;
  }
  function sameFeatureCarryCue(text){
    var t=normalizeInput(text);
    return /(?:さっき|先ほど|前|今|いま)?(?:と)?同じ(?:こと|内容|の|ように|感じで)|同様に|同じように/.test(t);
  }
  function comparisonShortOppositeCue(text){
    var t=siteClauseLead(normalizeInput(text));
    return /^(?:(?:じゃあ|じゃ|では|それなら|なら|やっぱ(?:り)?|いや)[、,\s]*)?(?:反対|逆|反対の方|反対のほう|逆の方|逆のほう|もう片方|もう一方)(?:は|って|だと|なら|にして|で|お願い)?[。！!？?]*$/.test(t);
  }
  function answerComparisonShortOpposite(text,history){
    if(!comparisonShortOppositeCue(text))return null;
    var ctx=historyGuideContext(history);
    if(ctx.candidateKind!=='comparison'||ctx.candidates.length!==2||!ctx.selectedCandidate)return null;
    var list=uniqueCandidateItems(ctx.candidates),selected=list.filter(function(x){return x.id===ctx.selectedCandidate.id;})[0];
    if(!selected)return null;
    var target=list.filter(function(x){return x.id!==selected.id;})[0];if(!target)return null;
    var result=explainItem(target,true);if(!result)return null;
    result.answer='今の比較で「'+selected.name+'」の反対側なら「'+target.name+'」です。\n'+String(result.answer||'');
    result=retainCandidateContext(result,list,target,'comparison',ctx.sourceCandidates,ctx.conditions);result.data=result.data||{};
    result.data.siteComparisonShortOpposite=true;result.data.siteComparisonSelectionRevised=true;result.data.previousSelectedSiteItem=selected.id;result.data.selectedSiteItem=target.id;
    return result;
  }
  function comparisonDeicticFeatureCue(text){
    var t=siteClauseLead(normalizeInput(text));
    if(mentionedItems(t).length)return false;
    if(/(?:もう片方|もう一方|反対の方|反対のほう|逆の方|逆のほう|別の方|別のほう|じゃなく|ではなく|違う|訂正)/.test(t))return false;
    if(!/^(?:それ|そっち|その方|そのほう|今の|いまの|こっち|この方|このほう)(?:の|は|って|だと|なら|で|について)?/.test(t))return false;
    return !!comparisonHistoryFeatureCue(t);
  }
  function answerComparisonDeicticFeature(text,history){
    if(!comparisonDeicticFeatureCue(text))return null;
    var ctx=discardStaleCandidateContext(history,historyGuideContext(history));
    if(ctx.candidateKind!=='comparison'||!ctx.selectedCandidate||ctx.candidates.length<2)return null;
    var list=uniqueCandidateItems(ctx.candidates),target=list.filter(function(x){return x.id===ctx.selectedCandidate.id;})[0];if(!target)return null;
    var intents=featureIntents(text,target),featureCue=comparisonHistoryFeatureCue(text);
    if(!intents.length&&featureCue&&sourcePage(target)&&S((sourcePage(target).facts||{})[featureCue.feature]))intents=[featureCue.feature];
    if(!intents.length)return null;
    var result=answerFeatures(target,intents,true,text);if(!result)return null;
    result.answer='今選んでいる「'+target.name+'」についてですね。\n'+String(result.answer||'');
    result=retainCandidateContext(result,list,target,'comparison',ctx.sourceCandidates,ctx.conditions);result.data=result.data||{};
    result.data.siteComparisonDeicticFeature=true;result.data.selectedSiteItem=target.id;
    return result;
  }
  function currentComparisonSelectedContext(history,allowHistorical){
    var raw=historyGuideContext(history),ctx=allowHistorical?raw:discardStaleCandidateContext(history,raw),list=[],selected=null,other=null;
    if(ctx.candidateKind==='comparison'&&ctx.selectedCandidate&&ctx.candidates.length===2){
      list=uniqueCandidateItems(ctx.candidates);selected=list.filter(function(x){return x.id===ctx.selectedCandidate.id;})[0]||null;
      if(selected&&list.length===2){other=list.filter(function(x){return x.id!==selected.id;})[0]||null;if(other)return {ctx:ctx,list:list,selected:selected,other:other};}
    }
    if(!allowHistorical)return null;
    var ref=latestHistoricalComparison(history);if(!ref||!ref.selected||ref.items.length!==2)return null;
    list=uniqueCandidateItems(ref.items);selected=list.filter(function(x){return x.id===ref.selected.id;})[0]||null;if(!selected||list.length!==2)return null;other=list.filter(function(x){return x.id!==selected.id;})[0]||null;if(!other)return null;
    return {ctx:{item:selected,candidates:list,sourceCandidates:list,conditions:ref.conditions||[],candidateKind:'comparison',feature:ref.feature||'',featureDetail:ref.featureDetail||'',featureSubjects:ref.featureSubjects||[],selectedCandidate:selected},list:list,selected:selected,other:other};
  }
  function currentComparisonNeedsBaseSelection(history){
    var ctx=historyGuideContext(history),list=uniqueCandidateItems(ctx.candidates||[]);
    if(ctx.candidateKind!=='comparison'||list.length!==2||ctx.selectedCandidate)return null;
    var ids=list.map(function(x){return x.id;});
    return {handled:true,mode:'サイト総合案内',answer:'「反対」の基準にする側がまだ決まっていません。'+candidateNames(list)+'のどちらを基準にするか先に教えてください。',links:list.map(itemLink),data:{needsClarification:true,siteComparisonOppositeNeedsSelection:true,siteComparison:ids,siteCandidates:ids,candidates:ids}};
  }
  function featureIntentsForComparisonFollowup(text,item){
    var intents=explicitContextFeatureIntents(text,item),cue=comparisonHistoryFeatureCue(text),page=sourcePage(item),facts=page&&page.facts||{};
    if(!intents.length&&cue&&S(facts[cue.feature]))intents=[cue.feature];
    return {intents:intents,cue:cue};
  }
  function comparisonOppositeFeatureCue(text){
    var t=normalizeInput(text);
    if(/(?:じゃなく|ではなく|訂正|違って|ちがって)/.test(t))return null;
    var m=t.match(/(?:^|そのあと|その後|続けて|次に|あと)[、,\s]*(?:じゃあ|では|なら)?[、,\s]*(?:反対(?:にした)?(?:の)?(?:方|ほう)?|逆(?:の)?(?:方|ほう)?)(?:にして|にしたら|なら|は|で|の)?[、,\s]*(.*)$/);
    if(!m)return null;
    var tail=String(m[1]||'');if(!tail)return null;
    var cue=comparisonHistoryFeatureCue(tail);if(!cue)return null;
    return {tail:tail,feature:cue};
  }
  function answerComparisonOppositeFeature(text,history){
    var cue=comparisonOppositeFeatureCue(text);if(!cue)return null;
    var ref=currentComparisonSelectedContext(history,true);if(!ref)return currentComparisonNeedsBaseSelection(history);
    var parsed=featureIntentsForComparisonFollowup(cue.tail,ref.other),intents=parsed.intents;if(!intents.length)return null;
    var result=answerFeatures(ref.other,intents,true,cue.tail);if(!result)return null;
    result.answer='今選んでいる「'+ref.selected.name+'」の反対側、「'+ref.other.name+'」では「'+contextFeatureLabel(intents[0],cue.tail)+'」ですね。\n'+String(result.answer||'');
    result=retainCandidateContext(result,ref.list,ref.other,'comparison',ref.ctx.sourceCandidates,ref.ctx.conditions);result.data=result.data||{};
    result.data.siteComparisonOppositeFeature=true;result.data.siteComparisonSelectionRevised=true;result.data.previousSelectedSiteItem=ref.selected.id;result.data.selectedSiteItem=ref.other.id;
    return result;
  }
  function comparisonOppositeSameFeatureCue(text){
    var t=normalizeInput(text);
    if(!/(?:反対|逆|もう片方|もう一方)/.test(t))return false;
    if(comparisonHistoryFeatureCue(t))return false;
    return /(?:続き|続け|同じこと|同じ内容|同じの|同様に|同じように|同じ感じ)/.test(t);
  }
  function answerComparisonOppositeSameFeature(text,history){
    if(!comparisonOppositeSameFeatureCue(text))return null;
    var ref=currentComparisonSelectedContext(history,true);if(!ref)return currentComparisonNeedsBaseSelection(history);
    var feature=String(ref.ctx.feature||''),detail=String(ref.ctx.featureDetail||''),page=sourcePage(ref.other),facts=page&&page.facts||{};
    if(!feature)return null;
    if(!S(facts[feature]))return {handled:true,mode:'サイト総合案内',answer:'今選んでいる「'+ref.selected.name+'」の反対側は「'+ref.other.name+'」ですが、さっきと同じ案内項目はこのページでは確認できません。別の内容を指定してください。',links:[itemLink(ref.other)],data:{needsClarification:true,siteComparisonOppositeSameFeatureUnsupported:true,siteItem:ref.other.id,siteComparison:ref.list.map(function(x){return x.id;}),selectedSiteItem:ref.other.id,previousSelectedSiteItem:ref.selected.id}};
    var query=feature==='columns'&&detail==='acquisition'?'入手をどこで確認':featureCuePhrase(feature),result=answerFeatures(ref.other,[feature],true,query||text);if(!result)return null;
    result.answer='今選んでいる「'+ref.selected.name+'」の反対側、「'+ref.other.name+'」に切り替えて、さっきの続きですね。\n'+String(result.answer||'');
    result=retainCandidateContext(result,ref.list,ref.other,'comparison',ref.ctx.sourceCandidates,ref.ctx.conditions);result.data=result.data||{};
    result.data.siteComparisonOppositeSameFeatureCarry=true;result.data.siteComparisonSelectionRevised=true;result.data.previousSelectedSiteItem=ref.selected.id;result.data.selectedSiteItem=ref.other.id;
    return result;
  }
  function comparisonRevisionOppositeBundleCue(text){
    var t=normalizeInput(text),m=t.match(/^(.+?)(?:[、,。\s]*(?:そのあと|その後|続けて|次に|あと)[、,\s]*)(.+)$/);if(!m)return null;
    var first=String(m[1]||''),second=String(m[2]||'');
    if(!featureRevisionCue(first))return null;
    var opposite=comparisonOppositeFeatureCue(second);if(!opposite)return null;
    return {first:first,second:second,opposite:opposite};
  }
  function answerComparisonRevisionOppositeBundle(text,history){
    var cue=comparisonRevisionOppositeBundleCue(text);if(!cue)return null;
    var ref=currentComparisonSelectedContext(history,true);if(!ref)return currentComparisonNeedsBaseSelection(history);
    var tail=correctionTail(cue.first)||cue.first,firstParsed=featureIntentsForComparisonFollowup(tail,ref.selected),secondParsed=featureIntentsForComparisonFollowup(cue.opposite.tail,ref.other);
    if(!firstParsed.intents.length||!secondParsed.intents.length)return null;
    var first=answerFeatures(ref.selected,firstParsed.intents,true,tail),second=answerFeatures(ref.other,secondParsed.intents,true,cue.opposite.tail);if(!first||!second)return null;
    var links=[],seen={};(first.links||[]).concat(second.links||[]).forEach(function(l){var k=String(l&&l.url||'');if(k&&!seen[k]){seen[k]=1;links.push(l);}});
    var ids=ref.list.map(function(x){return x.id;}),result={handled:true,mode:'サイト総合案内',answer:'まず今選んでいる「'+ref.selected.name+'」は「'+contextFeatureLabel(firstParsed.intents[0],tail)+'」へ訂正し、そのあと反対側の「'+ref.other.name+'」は「'+contextFeatureLabel(secondParsed.intents[0],cue.opposite.tail)+'」として案内します。\n'+String(first.answer||'')+'\n\n'+String(second.answer||''),links:links,data:{siteItem:ref.other.id,siteFeature:(second.data&&second.data.siteFeature)||secondParsed.intents[0],siteFeatures:(second.data&&second.data.siteFeatures)||secondParsed.intents.slice(),siteComparison:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:ids,selectedSiteItem:ref.other.id,previousSelectedSiteItem:ref.selected.id,siteComparisonRevisionOppositeBundle:true,siteComparisonSelectionRevised:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
    return result;
  }
  function comparisonImplicitSelectionCommitted(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;var data=(x.meta&&x.meta.data)||{},ids=Array.isArray(data.siteComparison)?data.siteComparison:[];
      if(ids.length<2)continue;
      if(data.needsClarification)return false;
      if(String(data.siteFeature||'')==='result')return false;
      if(data.siteDetailTargetSwitch&&!data.siteComparisonSelectionConfirmed&&!data.siteComparisonPurposeSelected&&!data.siteComparisonSelectionRevised&&!data.siteHistoricalAbsoluteComparisonRestore)return false;
      var prior=i>0&&h[i-1]&&h[i-1].role==='user'?normalizeInput(h[i-1].text):'';
      if(prior&&mentionedItems(prior).length===1&&/(?:は|って|だと|なら)[？?。！!]*$/.test(prior)&&!/(?:にして|でお願い|それで|選ん|決め)/.test(prior))return false;
      return !!data.selectedSiteItem;
    }
    return false;
  }
  function comparisonImplicitSelectedFeatureCue(text){
    var t=siteClauseLead(normalizeInput(text));
    if(mentionedItems(t).length)return false;
    if(/(?:比較|比べ|反対|逆|もう片方|もう一方|前者|後者|元の方|元のほう|反対にした方|反対にしたほう|じゃなく|ではなく|訂正|違って|ちがって|それ|そっち|今の|いまの)/.test(t))return false;
    if(!comparisonHistoryFeatureCue(t))return false;
    return /(?:教えて|知りたい|確認|見たい|どこ|方法|やり方|は|って|について|お願い|？|\?)?[。！!？?]*$/.test(t);
  }
  function answerComparisonImplicitSelectedFeature(text,history){
    if(!comparisonImplicitSelectedFeatureCue(text)||!comparisonImplicitSelectionCommitted(history))return null;
    var ref=currentComparisonSelectedContext(history,false);if(!ref)return null;
    var parsed=featureIntentsForComparisonFollowup(text,ref.selected);if(!parsed.intents.length)return null;
    var result=answerFeatures(ref.selected,parsed.intents,true,text);if(!result)return null;
    result.answer='今選んでいる「'+ref.selected.name+'」の「'+contextFeatureLabel(parsed.intents[0],text)+'」ですね。\n'+String(result.answer||'');
    result=retainCandidateContext(result,ref.list,ref.selected,'comparison',ref.ctx.sourceCandidates,ref.ctx.conditions);result.data=result.data||{};
    result.data.siteComparisonImplicitSelectedFeature=true;result.data.selectedSiteItem=ref.selected.id;
    return result;
  }
  function currentComparisonPairContext(history,allowHistorical){
    var raw=historyGuideContext(history),ctx=allowHistorical?raw:discardStaleCandidateContext(history,raw),list=uniqueCandidateItems(ctx.candidates||[]);
    if(ctx.candidateKind==='comparison'&&list.length===2){
      var selected=ctx.selectedCandidate&&list.filter(function(x){return x.id===ctx.selectedCandidate.id;})[0]||null;
      return {ctx:ctx,list:list,selected:selected};
    }
    if(!allowHistorical)return null;
    var ref=latestHistoricalComparison(history);if(!ref||ref.items.length!==2)return null;
    list=uniqueCandidateItems(ref.items);if(list.length!==2)return null;
    var sel=ref.selected&&list.filter(function(x){return x.id===ref.selected.id;})[0]||null;
    return {ctx:{item:sel,candidates:list,sourceCandidates:list,conditions:ref.conditions||[],candidateKind:'comparison',feature:ref.feature||'',featureDetail:ref.featureDetail||'',featureSubjects:ref.featureSubjects||[],selectedCandidate:sel},list:list,selected:sel};
  }
  function latestComparisonTransition(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;var data=(x.meta&&x.meta.data)||{},ids=Array.isArray(data.siteComparison)?data.siteComparison:[];
      if(ids.length!==2)continue;
      var list=ids.map(function(id){return BY_ID[String(id||'')];}).filter(Boolean);if(list.length!==2)continue;
      var current=BY_ID[String(data.selectedSiteItem||'')],previous=BY_ID[String(data.previousSelectedSiteItem||'')];
      if(current&&previous&&current.id!==previous.id&&list.some(function(y){return y.id===current.id;})&&list.some(function(y){return y.id===previous.id;})){
        return {list:list,current:current,previous:previous,feature:String(data.siteFeature||''),featureDetail:String(data.siteFeatureDetail||''),conditions:Array.isArray(data.siteConditions)?data.siteConditions.slice():[],data:data,index:i};
      }
    }
    return null;
  }
  function comparisonOriginalSideFeatureCue(text){
    var t=normalizeInput(text);
    if(!/(?:元の方|元のほう|元の側|元に戻って|元へ戻って|元の方へ戻って|元のほうへ戻って)/.test(t))return null;
    var cue=comparisonHistoryFeatureCue(t);if(!cue)return null;
    return {feature:cue};
  }
  function answerComparisonOriginalSideFeature(text,history){
    var cue=comparisonOriginalSideFeatureCue(text);if(!cue)return null;
    var tr=latestComparisonTransition(history);if(!tr)return null;
    var parsed=featureIntentsForComparisonFollowup(text,tr.previous);if(!parsed.intents.length)return null;
    var result=answerFeatures(tr.previous,parsed.intents,true,text);if(!result)return null;
    result.answer='さっき切り替える前の「'+tr.previous.name+'」へ戻って、「'+contextFeatureLabel(parsed.intents[0],text)+'」ですね。\n'+String(result.answer||'');
    result=retainCandidateContext(result,tr.list,tr.previous,'comparison',tr.list,tr.conditions);result.data=result.data||{};
    result.data.siteComparisonOriginalSideFeature=true;result.data.siteComparisonSelectionRevised=true;result.data.previousSelectedSiteItem=tr.current.id;result.data.selectedSiteItem=tr.previous.id;
    return result;
  }
  function comparisonNamedSideFeatureCue(text){
    var t=normalizeInput(text),side='';
    if(/(?:さっき|先ほど)?(?:反対にした|反対へ変えた|逆にした)(?:方|ほう)/.test(t))side='transition-current';
    else if(/(?:今|いま)(?:選んでいる|選択中の|の)(?:方|ほう)/.test(t))side='current';
    else if(/(?:前者|最初の方|最初のほう|一つ目|1つ目|１つ目)/.test(t))side='first';
    else if(/(?:後者|二つ目|2つ目|２つ目)/.test(t))side='second';
    if(!side)return null;
    var cue=comparisonHistoryFeatureCue(t);if(!cue)return null;
    return {side:side,feature:cue};
  }
  function answerComparisonNamedSideFeature(text,history){
    var cue=comparisonNamedSideFeatureCue(text);if(!cue)return null;
    var pair=currentComparisonPairContext(history,true);if(!pair)return null;
    var target=null,previous=pair.selected;
    if(cue.side==='first')target=pair.list[0];
    else if(cue.side==='second')target=pair.list[1];
    else if(cue.side==='current')target=pair.selected;
    else if(cue.side==='transition-current'){var tr=latestComparisonTransition(history);target=tr&&tr.current||pair.selected;}
    if(!target)return {handled:true,mode:'サイト総合案内',answer:'比較している二つは確認できましたが、今どちらを選んでいるかまでは決まっていません。'+candidateNames(pair.list)+'のどちらかを指定してください。',links:pair.list.map(itemLink),data:{needsClarification:true,siteComparisonNamedSideNeedsSelection:true,siteComparison:pair.list.map(function(x){return x.id;}),siteCandidates:pair.list.map(function(x){return x.id;})}};
    var parsed=featureIntentsForComparisonFollowup(text,target);if(!parsed.intents.length)return null;
    var result=answerFeatures(target,parsed.intents,true,text);if(!result)return null;
    var label=cue.side==='first'?'前者':cue.side==='second'?'後者':cue.side==='transition-current'?'さっき反対にした方':'今選んでいる方';
    result.answer='比較中の'+label+'、「'+target.name+'」で「'+contextFeatureLabel(parsed.intents[0],text)+'」ですね。\n'+String(result.answer||'');
    result=retainCandidateContext(result,pair.list,target,'comparison',pair.ctx.sourceCandidates||pair.list,pair.ctx.conditions);result.data=result.data||{};
    result.data.siteComparisonNamedSideFeature=true;result.data.selectedSiteItem=target.id;if(previous&&previous.id!==target.id){result.data.siteComparisonSelectionRevised=true;result.data.previousSelectedSiteItem=previous.id;}
    return result;
  }
  function comparisonRoundTripBundleCue(text){
    var t=normalizeInput(text),m=t.match(/^(.+?)(?:[、,。\s]*(?:そのあと|その後|続けて|次に|それから)[、,\s]*)(.+)$/);if(!m)return null;
    var first=String(m[1]||''),second=String(m[2]||'');
    if(!/(?:反対|逆|もう片方|もう一方)/.test(first))return null;
    if(!/(?:元の方|元のほう|元の側|元に戻って|元へ戻って|元の方へ戻って|元のほうへ戻って)/.test(second))return null;
    var secondFeature=comparisonHistoryFeatureCue(second);if(!secondFeature)return null;
    var firstFeature=comparisonHistoryFeatureCue(first),carry=!firstFeature&&comparisonOppositeSameFeatureCue(first);
    if(!firstFeature&&!carry)return null;
    return {first:first,second:second,firstFeature:firstFeature,carry:carry,secondFeature:secondFeature};
  }
  function answerComparisonRoundTripBundle(text,history){
    var cue=comparisonRoundTripBundleCue(text);if(!cue)return null;
    var ref=currentComparisonSelectedContext(history,true);if(!ref)return currentComparisonNeedsBaseSelection(history);
    var firstIntents=[],firstDetail='',firstQuery=cue.first;
    if(cue.firstFeature){var fp=featureIntentsForComparisonFollowup(cue.first,ref.other);firstIntents=fp.intents;firstDetail=cue.firstFeature.featureDetail||'';}
    else {var f=String(ref.ctx.feature||'');if(f&&sourcePage(ref.other)&&S((sourcePage(ref.other).facts||{})[f])){firstIntents=[f];firstDetail=String(ref.ctx.featureDetail||'');firstQuery=f==='columns'&&firstDetail==='acquisition'?'入手をどこで確認':featureCuePhrase(f);}}
    var secondParsed=featureIntentsForComparisonFollowup(cue.second,ref.selected);if(!firstIntents.length||!secondParsed.intents.length)return null;
    var first=answerFeatures(ref.other,firstIntents,true,firstQuery),second=answerFeatures(ref.selected,secondParsed.intents,true,cue.second);if(!first||!second)return null;
    var links=[],seen={};(first.links||[]).concat(second.links||[]).forEach(function(l){var k=String(l&&l.url||'');if(k&&!seen[k]){seen[k]=1;links.push(l);}});
    var ids=ref.list.map(function(x){return x.id;}),result={handled:true,mode:'サイト総合案内',answer:'まず「'+ref.selected.name+'」の反対側、「'+ref.other.name+'」で'+(cue.carry?'さっきの続き':'「'+contextFeatureLabel(firstIntents[0],cue.first)+'」')+'を確認し、そのあと元の「'+ref.selected.name+'」へ戻って「'+contextFeatureLabel(secondParsed.intents[0],cue.second)+'」を案内します。\n'+String(first.answer||'')+'\n\n'+String(second.answer||''),links:links,data:{siteItem:ref.selected.id,siteFeature:(second.data&&second.data.siteFeature)||secondParsed.intents[0],siteFeatures:(second.data&&second.data.siteFeatures)||secondParsed.intents.slice(),siteComparison:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:ids,selectedSiteItem:ref.selected.id,previousSelectedSiteItem:ref.other.id,siteComparisonRoundTripFeatureBundle:true,siteComparisonSelectionRevised:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
    return result;
  }
  function comparisonAbsoluteDualSideFeatureCue(text){
    var t=normalizeInput(text),pos=t.search(/(?:比較|比べ)/);if(pos<0)return null;
    var order=comparisonAbsoluteOrderCue(t.slice(0,pos));if(!order)return null;
    var after=t.slice(pos),selectedMatch=after.match(/(?:選んだ方|選んでいた方|選んでた方|決めた方|決めていた方|決めてた方)/);if(!selectedMatch)return null;
    var altRe=/(?:もう片方|もう一方|反対の方|反対のほう|逆の方|逆のほう|選ばなかった方|選ばなかったほう|別の方|別のほう)/g,altMatch,altIndex=-1;
    while((altMatch=altRe.exec(after))){if(altMatch.index>selectedMatch.index){altIndex=altMatch.index;break;}}
    if(altIndex<0)return null;
    var selectedPart=after.slice(0,altIndex),alternativePart=after.slice(altIndex);
    if(!comparisonHistoryFeatureCue(selectedPart)||!comparisonHistoryFeatureCue(alternativePart))return null;
    return {order:order,selectedPart:selectedPart,alternativePart:alternativePart};
  }
  function answerComparisonAbsoluteDualSideFeature(text,history){
    var cue=comparisonAbsoluteDualSideFeatureCue(text);if(!cue)return null;
    var ref=comparisonEpisodeByOrder(comparisonEpisodeSequence(history),cue.order),ids=ref&&ref.items?ref.items.map(function(x){return x.id;}):[];
    if(!ref)return {handled:true,mode:'サイト総合案内',answer:'この会話履歴では「'+cue.order.label+'の比較」まで一意にたどれませんでした。比較していた対象を一つ言ってもらえれば、履歴と照合して続けます。',links:[],data:{needsClarification:true,siteHistoricalAbsoluteComparisonNeedsClarification:true,siteHistoricalComparisonRequestedOrder:cue.order.label}};
    if(ref.items.length!==2)return {handled:true,mode:'サイト総合案内',answer:'「'+cue.order.label+'の比較」には候補が3つ以上あるので、「選んだ方」と「反対の方」だけでは二つへ分けられません。対象名を指定してください。',links:ref.items.slice(0,8).map(itemLink),data:{needsClarification:true,siteHistoricalAbsoluteComparisonNeedsClarification:true,siteComparison:ids,siteHistoricalComparisonRequestedOrder:cue.order.label}};
    if(!ref.selected||!ref.items.some(function(x){return x.id===ref.selected.id;}))return {handled:true,mode:'サイト総合案内',answer:'「'+cue.order.label+'の比較」は確認できましたが、その時にどちらを選んだかまでは決まっていません。'+candidateNames(ref.items)+'のどちらかを指定してください。',links:ref.items.map(itemLink),data:{needsClarification:true,siteHistoricalAbsoluteComparisonNeedsClarification:true,siteComparison:ids,siteHistoricalComparisonRequestedOrder:cue.order.label}};
    var other=ref.items.filter(function(x){return x.id!==ref.selected.id;})[0],selectedIntents=featureIntents(cue.selectedPart,ref.selected),otherIntents=featureIntents(cue.alternativePart,other),selectedFeatureCue=comparisonHistoryFeatureCue(cue.selectedPart),otherFeatureCue=comparisonHistoryFeatureCue(cue.alternativePart);
    if(!selectedIntents.length&&selectedFeatureCue&&sourcePage(ref.selected)&&S((sourcePage(ref.selected).facts||{})[selectedFeatureCue.feature]))selectedIntents=[selectedFeatureCue.feature];
    if(!otherIntents.length&&otherFeatureCue&&sourcePage(other)&&S((sourcePage(other).facts||{})[otherFeatureCue.feature]))otherIntents=[otherFeatureCue.feature];
    if(!selectedIntents.length||!otherIntents.length)return null;
    var first=answerFeatures(ref.selected,selectedIntents,true,cue.selectedPart),second=answerFeatures(other,otherIntents,true,cue.alternativePart);if(!first||!second)return null;
    var links=[],seen={};(first.links||[]).concat(second.links||[]).forEach(function(l){var k=String(l&&l.url||'');if(k&&!seen[k]){seen[k]=1;links.push(l);}});
    var result={handled:true,mode:'サイト総合案内',answer:'「'+cue.order.label+'の比較」で選んでいた「'+ref.selected.name+'」と、その反対側の「'+other.name+'」を順番に案内します。\n'+String(first.answer||'')+'\n\n'+String(second.answer||''),links:links,data:{siteItem:other.id,siteFeature:(second.data&&second.data.siteFeature)||otherIntents[0],siteFeatures:(second.data&&second.data.siteFeatures)||otherIntents.slice(),siteComparison:ids,siteCandidates:ids,candidates:ids,siteSourceCandidates:ids,selectedSiteItem:other.id,previousSelectedSiteItem:ref.selected.id,siteHistoricalAbsoluteComparisonRestore:true,siteHistoricalComparisonDualFeature:true,siteHistoricalComparisonRequestedOrder:cue.order.label,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
    return result;
  }
  function comparisonAbsoluteReferenceCue(text){
    var t=siteClauseLead(normalizeInput(text)),pos=t.search(/(?:比較|比べ)/);if(pos<0)return null;
    var before=t.slice(0,pos),order=comparisonAbsoluteOrderCue(before);if(!order)return null;
    var alternative=/(?:もう片方|もう一方|反対の方|反対のほう|選ばなかった方|選ばなかったほう|別の方|別のほう)/.test(t);
    var selected=/(?:選んだ方|選んでいた方|選んでた方|決めた方|決めていた方|決めてた方)/.test(t);
    return {order:order,alternative:alternative,selected:selected};
  }
  function comparisonEpisodeByOrder(list,order){
    var seq=Array.isArray(list)?list:[];if(!seq.length||!order)return null;
    var pos=Math.max(1,Number(order.position)||1),idx=order.from==='start'?pos-1:seq.length-pos;
    return idx>=0&&idx<seq.length?seq[idx]:null;
  }
  function comparisonEpisodeMatchesFeature(ep,cue){
    if(!ep||!cue)return false;
    var list=Array.isArray(ep.features)&&ep.features.length?ep.features:[{feature:ep.feature,featureDetail:ep.featureDetail||''}];
    return list.some(function(f){if(f.feature!==cue.feature)return false;if(cue.featureDetail&&f.featureDetail!==cue.featureDetail)return false;return true;});
  }
  function answerComparisonEpisodeAlternative(ref,text,history,opt){
    opt=opt||{};
    if(!ref)return null;
    var ids=ref.items.map(function(x){return x.id;});
    if(ref.items.length!==2)return {handled:true,mode:'サイト総合案内',answer:'指定された過去の比較には候補が3つ以上あるので、「もう片方」だけでは一つに決められません。'+candidateNames(ref.items)+'のどれかを指定してください。',links:ref.items.slice(0,8).map(itemLink),data:{needsClarification:true,siteHistoricalOrderedComparisonNeedsClarification:true,siteComparison:ids,siteCandidates:ids,candidates:ids}};
    var base=ref.selected;
    if(!base||!ref.items.some(function(x){return x.id===base.id;}))return {handled:true,mode:'サイト総合案内',answer:'指定された過去の比較は確認できましたが、どちらを選んだかまでは決まっていません。「もう片方」の基準にする方を教えてください。',links:ref.items.map(itemLink),data:{needsClarification:true,siteHistoricalOrderedComparisonNeedsClarification:true,siteComparison:ids,siteCandidates:ids,candidates:ids}};
    var other=ref.items.filter(function(x){return x.id!==base.id;})[0];if(!other)return null;
    var ctx=historyGuideContext(history),feature='',featureDetail='',query=normalizeInput(text),tail=query;
    var comparePos=tail.search(/(?:比較|比べ)/);if(comparePos>=0)tail=tail.slice(comparePos);
    var explicit=comparisonHistoryFeatureCue(tail);
    if(explicit){feature=explicit.feature;featureDetail=explicit.featureDetail;}
    else if(opt.outputFeature){feature=opt.outputFeature.feature;featureDetail=opt.outputFeature.featureDetail||'';}
    else if(/(?:同じこと|同じ内容|同じの|同様に|同じように)/.test(query)&&ctx.feature&&sourcePage(other)&&S((sourcePage(other).facts||{})[ctx.feature])){feature=ctx.feature;featureDetail=ctx.featureDetail||'';}
    else if(opt.sourceFeature&&sourcePage(other)&&S((sourcePage(other).facts||{})[opt.sourceFeature.feature])){feature=opt.sourceFeature.feature;featureDetail=opt.sourceFeature.featureDetail||'';}
    else if(ref.feature&&sourcePage(other)&&S((sourcePage(other).facts||{})[ref.feature])){feature=ref.feature;featureDetail=ref.featureDetail||'';}
    if(feature&&(!sourcePage(other)||!S(((sourcePage(other).facts||{})[feature]))))return {handled:true,mode:'サイト総合案内',answer:'過去の比較のもう片方は「'+other.name+'」ですが、そのページでは同じ案内項目を確認できません。別の内容を指定してください。',links:[itemLink(other)],data:{needsClarification:true,siteHistoricalOrderedComparisonNeedsClarification:true,siteItem:other.id,siteComparison:ids,selectedSiteItem:other.id}};
    if(feature==='columns'&&featureDetail==='acquisition'&&!/(?:入手|取り方|とり方|どこで)/.test(query))query+=' 入手をどこで確認';
    var result=feature?answerFeatures(other,[feature],true,query):explainItem(other,true);if(!result)return null;
    var prefix=opt.prefix||('指定された過去の比較で選んでいた「'+base.name+'」のもう片方は「'+other.name+'」です。');
    result.answer=prefix+'\n'+String(result.answer||'');
    result=retainCandidateContext(result,ref.items,other,'comparison',ref.items,ref.conditions);result.data=result.data||{};
    result.data.siteHistoricalOrderedComparisonAlternativeRestore=true;result.data.previousSelectedSiteItem=base.id;result.data.siteComparison=ids;result.data.selectedSiteItem=other.id;
    if(opt.step)result.data.siteHistoricalComparisonRequestedStep=opt.step;
    if(opt.sourceFeature){result.data.siteHistoricalComparisonFeatureSource=opt.sourceFeature.feature;result.data.siteHistoricalComparisonFeatureSourceDetail=opt.sourceFeature.featureDetail||'';}
    return result;
  }
  function answerComparisonOrdinalAlternative(text,history){
    var cue=comparisonOrdinalAlternativeCue(text);if(!cue)return null;
    var eps=comparisonEpisodeSequence(history);
    if(eps.length<cue.step)return {handled:true,mode:'サイト総合案内',answer:'この会話履歴では、'+cue.step+'つ前の比較まで一意にたどれませんでした。比較していた対象を一つ言ってもらえれば、勝手に過去を作らず続けます。',links:[],data:{needsClarification:true,siteHistoricalOrderedComparisonNeedsClarification:true,siteHistoricalComparisonRequestedStep:cue.step}};
    var ref=eps[eps.length-cue.step];
    return answerComparisonEpisodeAlternative(ref,text,history,{step:cue.step,prefix:cue.step+'つ前の比較で選んでいた「'+(ref.selected?ref.selected.name:'')+'」のもう片方へ戻ります。'});
  }
  function answerHistoricalComparisonFeatureAlternative(text,history){
    var cue=historicalComparisonFeatureAlternativeCue(text);if(!cue)return null;
    var eps=comparisonEpisodeSequence(history),matches=eps.filter(function(ep){
      if(!comparisonEpisodeMatchesFeature(ep,cue.source))return false;
      if(cue.anchors&&cue.anchors.length&&!cue.anchors.every(function(a){return ep.items.some(function(x){return x.id===a.id;});}))return false;
      return true;
    }),ref=null;
    if(cue.absolute)ref=comparisonEpisodeByOrder(matches,cue.absolute);
    else if(cue.step)ref=matches.length>=cue.step?matches[matches.length-cue.step]:null;
    else ref=matches.length?matches[matches.length-1]:null;
    if(!ref){
      var qualifier=cue.absolute?cue.absolute.label+(cue.source.label?'で「'+cue.source.label+'」を扱った':''):(cue.step?cue.step+'つ前の「'+cue.source.label+'」を扱った':'「'+cue.source.label+'」の話をしていた');
      return {handled:true,mode:'サイト総合案内',answer:'この会話履歴では、'+qualifier+'比較を一意に確認できませんでした。比較対象か時点をもう少し指定してもらえれば、履歴と照合して続けます。',links:[],data:{needsClarification:true,siteHistoricalComparisonFeatureNeedsClarification:true,siteHistoricalComparisonFeatureSource:cue.source.feature,siteHistoricalComparisonFeatureRequestedStep:cue.step||0,siteHistoricalComparisonFeatureRequestedOrder:cue.absolute?cue.absolute.label:''}};
    }
    var output=cue.target||cue.source,orderLabel=cue.absolute?cue.absolute.label:(cue.step?cue.step+'つ前':'前');
    var result=answerComparisonEpisodeAlternative(ref,text,history,{sourceFeature:cue.source,outputFeature:output,prefix:orderLabel+'の「'+cue.source.label+'」を扱った比較で、選んでいた「'+(ref.selected?ref.selected.name:'')+'」のもう片方へ戻ります。'});
    if(result&&result.data){
      result.data.siteHistoricalComparisonFeatureAlternativeRestore=true;result.data.siteHistoricalComparisonFeatureSource=cue.source.feature;result.data.siteHistoricalComparisonFeatureTarget=output.feature;
      if(cue.step)result.data.siteHistoricalComparisonFeatureRequestedStep=cue.step;
      if(cue.absolute)result.data.siteHistoricalComparisonFeatureRequestedOrder=cue.absolute.label;
      if(cue.anchors&&cue.anchors.length)result.data.siteHistoricalComparisonFeatureAnchors=cue.anchors.map(function(x){return x.id;});
    }
    return result;
  }
  function answerComparisonAbsoluteReference(text,history){
    var cue=comparisonAbsoluteReferenceCue(text);if(!cue)return null;
    var eps=comparisonEpisodeSequence(history),ref=comparisonEpisodeByOrder(eps,cue.order);
    if(!ref)return {handled:true,mode:'サイト総合案内',answer:'この会話履歴では「'+cue.order.label+'の比較」まで一意にたどれませんでした。比較していた対象を一つ言ってもらえれば、履歴と照合して続けます。',links:[],data:{needsClarification:true,siteHistoricalAbsoluteComparisonNeedsClarification:true,siteHistoricalComparisonRequestedOrder:cue.order.label}};
    if(cue.alternative){
      var alt=answerComparisonEpisodeAlternative(ref,text,history,{prefix:'「'+cue.order.label+'の比較」で選んでいた「'+(ref.selected?ref.selected.name:'')+'」のもう片方へ戻ります。'});
      if(alt&&alt.data){alt.data.siteHistoricalAbsoluteComparisonRestore=true;alt.data.siteHistoricalComparisonRequestedOrder=cue.order.label;}
      return alt;
    }
    if(cue.selected){
      if(!ref.selected)return {handled:true,mode:'サイト総合案内',answer:'「'+cue.order.label+'の比較」は確認できましたが、その時にどちらを選んだかまでは決まっていません。'+candidateNames(ref.items)+'のどちらかを指定してください。',links:ref.items.map(itemLink),data:{needsClarification:true,siteHistoricalAbsoluteComparisonNeedsClarification:true,siteComparison:ref.items.map(function(x){return x.id;}),siteHistoricalComparisonRequestedOrder:cue.order.label}};
      var selectedIntents=comparisonOutputFeatureIntents(text,ref.selected),selectedResult=selectedIntents.length?answerFeatures(ref.selected,selectedIntents,true,text):explainItem(ref.selected,true);if(!selectedResult)return null;
      selectedResult.answer='「'+cue.order.label+'の比較」で選んでいたのは「'+ref.selected.name+'」です。\n'+String(selectedResult.answer||'');
      selectedResult=retainCandidateContext(selectedResult,ref.items,ref.selected,'comparison',ref.items,ref.conditions);selectedResult.data=selectedResult.data||{};
      selectedResult.data.siteHistoricalAbsoluteComparisonRestore=true;selectedResult.data.siteHistoricalComparisonRequestedOrder=cue.order.label;selectedResult.data.selectedSiteItem=ref.selected.id;if(selectedIntents.length)selectedResult.data.siteHistoricalComparisonSelectedFeature=true;return selectedResult;
    }
    var carryCtx=historyGuideContext(history),carryFeature=sameFeatureCarryCue(text)&&carryCtx.feature?carryCtx.feature:'',carryDetail=carryCtx.featureDetail||'';
    if(carryFeature){
      if(!ref.selected)return {handled:true,mode:'サイト総合案内',answer:'「'+cue.order.label+'の比較」には戻れますが、「同じこと」をどちらへ続けるかが決まっていません。'+candidateNames(ref.items)+'のどちらかを指定してください。',links:ref.items.map(itemLink),data:{needsClarification:true,siteHistoricalAbsoluteComparisonNeedsClarification:true,siteHistoricalComparisonSameFeatureNeedsSelection:true,siteComparison:ref.items.map(function(x){return x.id;}),siteHistoricalComparisonRequestedOrder:cue.order.label}};
      var page=sourcePage(ref.selected),facts=page&&page.facts||{};
      if(!S(facts[carryFeature]))return {handled:true,mode:'サイト総合案内',answer:'「'+cue.order.label+'の比較」で選んでいた「'+ref.selected.name+'」へは戻れますが、さっきと同じ案内項目はこのページでは確認できません。別の内容を指定してください。',links:[itemLink(ref.selected)],data:{needsClarification:true,siteHistoricalComparisonSameFeatureUnsupported:true,siteItem:ref.selected.id,siteComparison:ref.items.map(function(x){return x.id;}),siteHistoricalComparisonRequestedOrder:cue.order.label}};
      var carryQuery=carryFeature==='columns'&&carryDetail==='acquisition'?'入手をどこで確認':featureCuePhrase(carryFeature),carryResult=answerFeatures(ref.selected,[carryFeature],true,carryQuery||text);if(!carryResult)return null;
      carryResult.answer='「'+cue.order.label+'の比較」に戻って、選んでいた「'+ref.selected.name+'」でさっきと同じ内容を続けます。\n'+String(carryResult.answer||'');
      carryResult=retainCandidateContext(carryResult,ref.items,ref.selected,'comparison',ref.items,ref.conditions);carryResult.data=carryResult.data||{};carryResult.data.siteHistoricalAbsoluteComparisonRestore=true;carryResult.data.siteHistoricalComparisonSameFeatureCarry=true;carryResult.data.siteHistoricalComparisonRequestedOrder=cue.order.label;carryResult.data.selectedSiteItem=ref.selected.id;return carryResult;
    }
    var compared=compareItems(ref.items);if(!compared)return null;
    compared.answer='「'+cue.order.label+'の比較」は'+candidateNames(ref.items)+'です。\n'+String(compared.answer||'');
    compared=retainCandidateContext(compared,ref.items,ref.selected||null,'comparison',ref.items,ref.conditions);compared.data=compared.data||{};
    compared.data.siteHistoricalAbsoluteComparisonRestore=true;compared.data.siteHistoricalComparisonRequestedOrder=cue.order.label;if(ref.selected)compared.data.selectedSiteItem=ref.selected.id;return compared;
  }

  function historicalComparisonAlternativeCue(text){
    var t=siteClauseLead(normalizeInput(text));
    var historical=/(?:さっき|先ほど|前に|以前|この前|あの時|あのとき|その時|そのとき)/.test(t)||/(?:その|前の)(?:比較|比べ)/.test(t);
    if(!historical||!/(?:比較|比べ)/.test(t))return null;
    if(!/(?:もう片方|もう一方|反対の方|反対のほう|選ばなかった方|選ばなかったほう|別の方|別のほう)/.test(t))return null;
    var anchors=mentionedItems(t);
    return {anchor:anchors.length===1?anchors[0]:null,anchorCount:anchors.length};
  }
  function latestHistoricalComparisonMatching(history,anchor){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;var data=(x.meta&&x.meta.data)||{};
      if(data.siteGuideContextCleared||String(data.siteItem||'')==='__site_guide_context_cleared__')break;
      var ids=Array.isArray(data.siteComparison)?data.siteComparison:[];if(ids.length<2)continue;
      var list=ids.map(function(id){return BY_ID[id];}).filter(Boolean);if(list.length<2)continue;
      if(anchor&&!list.some(function(y){return y.id===anchor.id;}))continue;
      var selected=BY_ID[String(data.selectedSiteItem||'')];
      if(!selected||!list.some(function(y){return y.id===selected.id;})){
        var viewed=BY_ID[String(data.siteItem||'')];if(viewed&&list.some(function(y){return y.id===viewed.id;}))selected=viewed;
      }
      return {items:list,selected:selected||null,feature:String(data.siteFeature||''),featureSubjects:Array.isArray(data.siteFeatureSubjects)?data.siteFeatureSubjects.slice(0,4):[],conditions:Array.isArray(data.siteConditions)?data.siteConditions.slice():[],index:i};
    }
    return null;
  }
  function answerHistoricalComparisonAlternative(text,history){
    var cue=historicalComparisonAlternativeCue(text);if(!cue)return null;
    if(cue.anchorCount>1)return {handled:true,mode:'サイト総合案内',answer:'「もう片方」の基準にする対象が複数入っています。どちらを基準にした比較か一つだけ言ってください。',links:[],data:{needsClarification:true,siteHistoricalComparisonAlternativeNeedsClarification:true}};
    var ref=latestHistoricalComparisonMatching(history,cue.anchor);
    if(!ref)return {handled:true,mode:'サイト総合案内',answer:'この会話履歴では、その比較の「もう片方」を特定できませんでした。比較していた対象を一つ言ってもらえれば、履歴と照合して続けます。',links:[],data:{needsClarification:true,siteHistoricalComparisonAlternativeNeedsClarification:true}};
    if(ref.items.length!==2){
      var ids=ref.items.map(function(x){return x.id;});
      return {handled:true,mode:'サイト総合案内',answer:'前の比較候補が3つ以上あるので、「もう片方」だけでは一つに決められません。'+candidateNames(ref.items)+'のどれかを指定してください。',links:ref.items.slice(0,8).map(itemLink),data:{needsClarification:true,siteHistoricalComparisonAlternativeNeedsClarification:true,siteComparison:ids,siteCandidates:ids,candidates:ids}};
    }
    var base=cue.anchor||ref.selected;
    if(!base||!ref.items.some(function(x){return x.id===base.id;})){
      var ids2=ref.items.map(function(x){return x.id;});
      return {handled:true,mode:'サイト総合案内',answer:'前に比較していたのは'+candidateNames(ref.items)+'ですが、「もう片方」の基準になる方が決まっていません。どちらを基準にするか教えてください。',links:ref.items.map(itemLink),data:{needsClarification:true,siteHistoricalComparisonAlternativeNeedsClarification:true,siteComparison:ids2,siteCandidates:ids2,candidates:ids2}};
    }
    var other=ref.items.filter(function(x){return x.id!==base.id;})[0];if(!other)return null;
    var ctx=historyGuideContext(history),intents=explicitContextFeatureIntents(text,other),same=/(?:同じこと|同じ内容|同じの|同様に|同じように)/.test(normalizeInput(text)),feature='';
    if(intents.length)feature=intents[0];
    else if(same&&ctx.feature&&sourcePage(other)&&S((sourcePage(other).facts||{})[ctx.feature]))feature=ctx.feature;
    else if(ref.feature&&sourcePage(other)&&S((sourcePage(other).facts||{})[ref.feature]))feature=ref.feature;
    var query=normalizeInput(text);
    if(feature==='columns'&&!/(?:入手|取り方|とり方|どこで)/.test(query)&&((same&&ctx.featureDetail==='acquisition')||/入手/.test(query)))query+=' 入手をどこで確認';
    var result=feature?answerFeatures(other,[feature],true,query):explainItem(other,true);if(!result)return null;
    result.answer='前に比較していた「'+base.name+'」のもう片方は「'+other.name+'」です。\n'+String(result.answer||'');
    result=retainCandidateContext(result,ref.items,other,'comparison',ref.items,ref.conditions);result.data=result.data||{};
    result.data.siteHistoricalComparisonAlternativeRestore=true;result.data.previousSelectedSiteItem=base.id;result.data.siteComparison=ref.items.map(function(x){return x.id;});result.data.selectedSiteItem=other.id;
    return result;
  }

  function historicalFeatureTransferCue(text){
    var t=siteClauseLead(normalizeInput(text)),items=mentionedItems(t);if(items.length!==1)return null;
    var transfer=/(?:同じこと|同じ内容|同じの|同様に|同じように|それを|今度は|今度|でも|にも)/.test(t);if(!transfer)return null;
    var historical=/(?:さっき|先ほど|前に|前の|以前|この前)/.test(t)||/(?:話|ところ|内容)(?:に|へ|を)?(?:戻って|戻り|戻して|戻る)/.test(t);if(!historical)return null;
    var cue=null;
    if(/(?:入手|取り方|とり方|どこで手に入)/.test(t))cue={feature:'columns',featureDetail:'acquisition',label:'入手'};
    else if(/(?:保存|画像|スクショ|スクリーンショット)/.test(t))cue={feature:'save',featureDetail:'',label:'保存'};
    else if(/(?:並べ替|ソート|高い順|安い順|順番)/.test(t))cue={feature:'sort',featureDetail:'',label:'並べ替え'};
    else if(/(?:共有|URL|リンク)/i.test(t))cue={feature:'share',featureDetail:'',label:'共有'};
    if(!cue)return null;cue.target=items[0];return cue;
  }
  function answerHistoricalFeatureTransfer(text,history){
    var cue=historicalFeatureTransferCue(text);if(!cue)return null;
    var ref=latestFeatureEpisode(history,cue),page=sourcePage(cue.target),facts=page&&page.facts||{};
    if(!ref)return {handled:true,mode:'サイト総合案内',answer:'この会話履歴では、戻り元になる「'+cue.label+'」の案内を確認できませんでした。先に対象か内容を一つ指定してもらえれば、勝手に過去を作らず続けます。',links:[itemLink(cue.target)],data:{needsClarification:true,siteHistoricalFeatureTransferNeedsClarification:true,siteItem:cue.target.id,siteFeature:cue.feature}};
    if(!S(facts[cue.feature]))return {handled:true,mode:'サイト総合案内',answer:'前の「'+cue.label+'」の話は確認できましたが、「'+cue.target.name+'」では同じ案内項目を確認できません。別の内容を指定してください。',links:[itemLink(cue.target)],data:{needsClarification:true,siteHistoricalFeatureTransferNeedsClarification:true,siteItem:cue.target.id,siteFeature:cue.feature}};
    var query=normalizeInput(text);if(cue.featureDetail==='acquisition'&&!/(?:入手|取り方|とり方|どこで)/.test(query))query+=' 入手をどこで確認';
    var result=answerFeatures(cue.target,[cue.feature],true,query);if(!result)return null;
    result.answer='前に「'+ref.item.name+'」で話していた「'+cue.label+'」を引き継いで、今度は「'+cue.target.name+'」で案内しますね。\n'+String(result.answer||'');
    result.data=result.data||{};result.data.siteHistoricalFeatureTransfer=true;result.data.siteHistoricalFeatureSourceItem=ref.item.id;result.data.previousSiteItem=ref.item.id;
    return result;
  }

  function historicalComparisonReferenceCue(text){
    var t=siteClauseLead(normalizeInput(text));
    if(!/(?:さっき|先ほど|前に|以前|この前)/.test(t)||!/(?:比較|比べ)/.test(t)||!/(?:方|ほう|やつ|もの|ページ|選んだ|決めた)/.test(t))return false;
    if(/(?:何と何|どれとどれ|候補|もう片方|もう一方)/.test(t))return false;
    return true;
  }
  function latestHistoricalComparison(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;var data=(x.meta&&x.meta.data)||{};
      if(data.siteGuideContextCleared||String(data.siteItem||'')==='__site_guide_context_cleared__')break;
      var ids=Array.isArray(data.siteComparison)?data.siteComparison:[];if(ids.length<2)continue;
      var list=ids.map(function(id){return BY_ID[id];}).filter(Boolean);if(list.length<2)continue;
      var selected=BY_ID[String(data.selectedSiteItem||'')];if(!selected||!list.some(function(y){return y.id===selected.id;})){var viewed=BY_ID[String(data.siteItem||'')];if(viewed&&list.some(function(y){return y.id===viewed.id;}))selected=viewed;}
      return {items:list,selected:selected||null,feature:String(data.siteFeature||''),featureSubjects:Array.isArray(data.siteFeatureSubjects)?data.siteFeatureSubjects.slice(0,4):[],conditions:Array.isArray(data.siteConditions)?data.siteConditions.slice():[],index:i};
    }
    return null;
  }
  function answerHistoricalComparisonReference(text,history){
    if(!historicalComparisonReferenceCue(text))return null;
    var ref=latestHistoricalComparison(history);if(!ref)return {handled:true,mode:'サイト総合案内',answer:'この会話履歴では、前に比較していた対象を確認できませんでした。比べたい二つを言ってもらえれば、そこから続けます。',links:[],data:{needsClarification:true,siteHistoricalComparisonNeedsClarification:true}};
    if(!ref.selected){
      var ids=ref.items.map(function(x){return x.id;});return {handled:true,mode:'サイト総合案内',answer:'前に比較していたのは'+candidateNames(ref.items)+'ですが、どちらを選んだかまでは決まっていません。どちらの方か教えてください。',links:ref.items.map(itemLink),data:{needsClarification:true,siteHistoricalComparisonNeedsClarification:true,siteComparison:ids,siteCandidates:ids,candidates:ids}};
    }
    var result=explainItem(ref.selected,true);if(ref.feature&&sourcePage(ref.selected)&&S((sourcePage(ref.selected).facts||{})[ref.feature])){var q=featureCuePhrase(ref.feature);result=answerFeatures(ref.selected,[ref.feature],true,q||text)||result;}
    result.answer='さっき比較して選んでいた方は「'+ref.selected.name+'」です。\n'+String(result.answer||'');
    result=retainCandidateContext(result,ref.items,ref.selected,'comparison',ref.items,ref.conditions);result.data=result.data||{};result.data.siteHistoricalComparisonRestore=true;result.data.siteComparison=ref.items.map(function(x){return x.id;});result.data.selectedSiteItem=ref.selected.id;return result;
  }

  function shouldHandleBeforeKnowledge(text,opt){
    var original=S(opt&&opt.original||text),historyReferenceInput=S(opt&&opt.context&&opt.context.original||opt&&opt.intentInfo&&opt.intentInfo.original||original),t=normalizeInput(original),ctx=discardStaleCandidateContext(opt&&opt.history,historyGuideContext(opt&&opt.history)),cur=currentItem();
    var featureInput=correctionTail(original)||t;
    if(!t)return false;
    if(inlineSiteGoalRevision(original))return true;
    if(answerComparisonOrdinalAlternative(historyReferenceInput,opt&&opt.history))return true;
    if(answerHistoricalComparisonFeatureAlternative(historyReferenceInput,opt&&opt.history))return true;
    if(answerComparisonAbsoluteDualSideFeature(historyReferenceInput,opt&&opt.history))return true;
    if(answerComparisonAbsoluteReference(historyReferenceInput,opt&&opt.history))return true;
    if(answerComparisonRoundTripBundle(original,opt&&opt.history))return true;
    if(answerComparisonOriginalSideFeature(original,opt&&opt.history))return true;
    if(answerComparisonNamedSideFeature(original,opt&&opt.history))return true;
    if(answerComparisonRevisionOppositeBundle(original,opt&&opt.history))return true;
    if(answerComparisonOppositeSameFeature(original,opt&&opt.history))return true;
    if(answerComparisonOppositeFeature(original,opt&&opt.history))return true;
    if(answerComparisonShortOpposite(historyReferenceInput,opt&&opt.history))return true;
    if(answerComparisonDeicticFeature(historyReferenceInput,opt&&opt.history))return true;
    if(answerComparisonImplicitSelectedFeature(original,opt&&opt.history))return true;
    if(answerHistoricalComparisonAlternative(historyReferenceInput,opt&&opt.history))return true;
    if(answerHistoricalFeatureTransfer(historyReferenceInput,opt&&opt.history))return true;
    if(answerQualifiedHistoricalEpisode(historyReferenceInput,opt&&opt.history))return true;
    if(answerHistoricalComparisonReference(historyReferenceInput,opt&&opt.history))return true;
    if(answerPastMomentReference(historyReferenceInput,opt&&opt.history))return true;
    if(answerAbsoluteTopicReference(historyReferenceInput,opt&&opt.history))return true;
    if(answerFeatureEpisodeReference(historyReferenceInput,opt&&opt.history))return true;
    if(answerFeatureRevision(original,opt&&opt.history))return true;
    if(answerSameFeatureTargetSwitch(original,opt&&opt.history))return true;
    if(answerTopicHistoryReference(original,opt&&opt.history))return true;
    if(guideLinkMissCue(original)&&latestImmediateGuideLinkContext(opt&&opt.history))return true;
    if(guideLinkMissSelectionRequest(original,latestImmediateGuideLinkContext(opt&&opt.history)))return true;
    if(guideConversationReturnTail(original)&&latestPausedGuideContext(opt&&opt.history))return true;
    if(pausedGuideFeatureFollowupCue(original)&&latestPausedGuideContext(opt&&opt.history))return true;
    if(guideConversationReturnCue(original)&&latestPausedGuideContext(opt&&opt.history))return true;
    if(answerVagueCapabilityRevision(original,opt&&opt.history))return true;
    if(answerVagueCapabilityFollowup(original,opt&&opt.history))return true;
    if(answerComparisonAlternativeFeature(original,opt&&opt.history))return true;
    if(answerComparisonViewedAlternativeSelection(original,opt&&opt.history))return true;
    if(answerComparisonSelectionRevision(original,opt&&opt.history))return true;
    if(answerComparisonCandidateRecall(original,opt&&opt.history))return true;
    if(answerComparisonSelectionRecall(original,opt&&opt.history))return true;
    if(answerComparisonSelectionConfirmation(original,opt&&opt.history))return true;
    if(exactGuideLinkOpenCue(original)&&latestImmediateGuideLinkContext(opt&&opt.history))return true;
    if(postOpenGuideCue(original)&&latestImmediateGuideLinkContext(opt&&opt.history))return true;
    if(continuedGuideDetailIntent(original)&&latestImmediateGuideLinkContext(opt&&opt.history))return true;
    if(answerGuideDetailTargetSwitch(original,opt&&opt.history))return true;
    if(guideLinkDestinationCue(original)&&latestImmediateGuideLinkContext(opt&&opt.history))return true;
    if(selectiveGuideLinkCue(original)&&selectedGuideLinks(original,latestImmediateGuideLinkContext(opt&&opt.history)).length)return true;
    if(repeatGuideLinkCue(original)&&latestImmediateGuideLinkContext(opt&&opt.history))return true;
    if(answerStoneAlternativeSelection(original,opt&&opt.history))return true;
    if(stoneAlternativeCue(original)&&answerStoneAlternatives(original,opt&&opt.history))return true;
    if(answerComparisonChoiceReason(original,opt&&opt.history))return true;
    if(answerDirectComparisonPurpose(featureInput))return true;
    if(pageFreeGoal(original))return true;
    if(vagueSaveCapabilityCue(original)&&!pageContextFresh(opt&&opt.history,ctx)&&!ctx.candidates.length)return true;
    if(vagueSiteCapabilityKind(original)&&!pageContextFresh(opt&&opt.history,ctx)&&!ctx.candidates.length)return true;
    if(overviewCue(t))return true;
    if(seikaiStoneRequest(original,ctx.item,cur))return true;
    if(incompletePagePossessive(original))return true;
    if(bareKnownTerm(original))return true;
    if(openToHelpCorrectionCue(original))return true;
    if(explicitMultiOpenItems(original).length>=2)return true;
    if(answerExplicitOpenAndFeature(featureInput,ctx))return true;
    if(siteClauseFeatureGroups(original,ctx.item,cur,ctx.candidates).length)return true;
    if(ctx.candidates.length&&candidateRestoreCue(original))return true;
    if(ctx.candidates.length&&candidateRemainderCue(original))return true;
    if(ctx.candidates.length&&(conditionRemovalRequest(original).all||conditionRemovalRequest(original).remove.length))return true;
    if(ctx.candidates.length&&answerCandidateExclusionOnly(original,ctx.candidates,ctx.sourceCandidates))return true;
    if(ctx.candidates.length&&candidateConditionalPlan(original,ctx.candidates))return true;
    if(ctx.candidates.length&&candidateSubset(original,ctx.candidates).length)return true;
    if(ctx.candidates.length&&(candidateRejectionCue(original)||candidateCancelCue(original)))return true;
    if(ctx.candidates.length&&ctx.selectedCandidate&&candidateRelativeMove(original,ctx.candidates,ctx.selectedCandidate).requested)return true;
    if(ctx.candidates.length&&ctx.selectedCandidate&&candidateAlternativeCue(original))return true;
    if(ctx.candidates.length&&ctx.selectedCandidate&&(previousCandidateCue(original)||previousViewedCandidateCue(original)))return true;
    if(ctx.candidates.length&&comparisonDifferenceCue(t))return true;
    if(ctx.candidates.length&&sameOrDifferentCue(t))return true;
    if(ctx.candidates.length&&comparisonRecommendationCue(t))return true;
    if(ctx.candidateKind==='comparison'&&comparisonIndecisionCue(original))return true;
    if(ctx.candidateKind==='comparison'&&answerComparisonPurposeShorthand(featureInput,ctx.candidates))return true;
    if(ctx.candidateKind==='comparison'&&answerComparisonPurposeRecommendation(featureInput,ctx.candidates))return true;
    if(ctx.candidates.length&&answerCandidateCapability(featureInput,ctx.candidates))return true;
    if(ctx.candidates.length&&allCandidatesCue(t))return true;
    var selectedContextCandidate=ctx.candidates.length?selectFromCandidates(featureInput,ctx.candidates,ctx.selectedCandidate):null;
    if(selectedContextCandidate&&featureIntents(featureInput,selectedContextCandidate).length)return true;
    if(ctx.candidates.length&&candidateFeatureRequests(featureInput,ctx.candidates).length)return true;
    if(selectedContextCandidate)return true;
    if(hierarchicalSelection(t,ctx.item))return true;
    if(ctx.item&&childrenOf(ctx.item).length&&hierarchyCue(t))return true;
    if(featureCarryFollowup(featureInput,ctx))return true;
    var correctionText=correctionTail(original),resolveText=correctionText||t;
    var detailed=findItemDetailed(resolveText),purpose=purposeScores(resolveText),item=detailed.item||(purpose[0]&&purpose[0].item)||null;
    var featureReqs=featureRequests(featureInput,ctx.item,cur);if(featureReqs.length)return true;
    // 人物・敵名を主語にした「○○のカウンター見たい」は、ページ移動ではなく
    // 正本の個別カウンター回答へ渡す。
    if(specificCounterSubjectCue(t,item))return false;
    if(featureQuestionTarget(featureInput,ctx.item,cur))return true;
    if(ctx.feature&&item&&sourcePage(item)&&sourcePage(item).facts&&sourcePage(item).facts[ctx.feature]&&/^(?:じゃあ|では|なら|それなら)?[、,\s]*.+?(?:は|だと|なら)[？?。！!]*$/.test(t))return true;
    if(correctionCue(original)&&item)return true;
    if(deicticOpenCue(t)&&ctx.item)return true;
    if(pageHelpCue(t,item,ctx.item||cur))return true;
    if(item&&childrenOf(item).length&&hierarchyCue(t))return true;
    var mentioned=mentionedItems(t);if(mentioned.length>=2&&/(?:どっち|どちら|違い|違う|どう違う|比較|使い分け|どれがいい)/.test(t))return true;
    if(hasNavigationCue(t)&&item&&!factSpecificCue(t))return true;
    if(item&&/(?:見たいんだけど|開きたいんだけど|のやつ|の方|のほう)[。！!？?]*$/.test(t))return true;
    return false;
  }
  function preflight(text,opt){return shouldHandleBeforeKnowledge(text,opt||{});}

  function respond(text,opt){
    opt=opt||{};
    var original=S(opt.original||text),historyReferenceInput=S(opt.context&&opt.context.original||opt.intentInfo&&opt.intentInfo.original||original),t=normalizeInput(original);if(!t)return {handled:false};
    var mode=pageMode(),cur=currentItem(),intent=opt.intentInfo?String(opt.intentInfo.intent||''):'',hist=discardStaleCandidateContext(opt.history,historyGuideContext(opt.history)),recent=hist.item;
    var featureInput=correctionTail(original)||t;

    var inlineGoalRevision=answerInlineSiteGoalRevision(original,opt);if(inlineGoalRevision)return inlineGoalRevision;

    var historicalComparisonFeatureAlternative=answerHistoricalComparisonFeatureAlternative(historyReferenceInput,opt.history);if(historicalComparisonFeatureAlternative)return historicalComparisonFeatureAlternative;

    var comparisonAbsoluteDualSideFeature=answerComparisonAbsoluteDualSideFeature(historyReferenceInput,opt.history);if(comparisonAbsoluteDualSideFeature)return comparisonAbsoluteDualSideFeature;

    var comparisonAbsoluteReference=answerComparisonAbsoluteReference(historyReferenceInput,opt.history);if(comparisonAbsoluteReference)return comparisonAbsoluteReference;

    var comparisonRoundTripBundle=answerComparisonRoundTripBundle(original,opt.history);if(comparisonRoundTripBundle)return comparisonRoundTripBundle;

    var comparisonOriginalSideFeature=answerComparisonOriginalSideFeature(original,opt.history);if(comparisonOriginalSideFeature)return comparisonOriginalSideFeature;

    var comparisonNamedSideFeature=answerComparisonNamedSideFeature(original,opt.history);if(comparisonNamedSideFeature)return comparisonNamedSideFeature;

    var comparisonRevisionOppositeBundle=answerComparisonRevisionOppositeBundle(original,opt.history);if(comparisonRevisionOppositeBundle)return comparisonRevisionOppositeBundle;

    var comparisonOppositeSameFeature=answerComparisonOppositeSameFeature(original,opt.history);if(comparisonOppositeSameFeature)return comparisonOppositeSameFeature;

    var comparisonOppositeFeature=answerComparisonOppositeFeature(original,opt.history);if(comparisonOppositeFeature)return comparisonOppositeFeature;

    var comparisonShortOpposite=answerComparisonShortOpposite(historyReferenceInput,opt.history);if(comparisonShortOpposite)return comparisonShortOpposite;

    var comparisonDeicticFeature=answerComparisonDeicticFeature(historyReferenceInput,opt.history);if(comparisonDeicticFeature)return comparisonDeicticFeature;

    var comparisonImplicitSelectedFeature=answerComparisonImplicitSelectedFeature(original,opt.history);if(comparisonImplicitSelectedFeature)return comparisonImplicitSelectedFeature;

    var comparisonOrdinalAlternative=answerComparisonOrdinalAlternative(historyReferenceInput,opt.history);if(comparisonOrdinalAlternative)return comparisonOrdinalAlternative;

    var historicalComparisonAlternative=answerHistoricalComparisonAlternative(historyReferenceInput,opt.history);if(historicalComparisonAlternative)return historicalComparisonAlternative;

    var historicalFeatureTransfer=answerHistoricalFeatureTransfer(historyReferenceInput,opt.history);if(historicalFeatureTransfer)return historicalFeatureTransfer;

    var qualifiedHistoricalEpisode=answerQualifiedHistoricalEpisode(historyReferenceInput,opt.history);if(qualifiedHistoricalEpisode)return qualifiedHistoricalEpisode;

    var historicalComparisonReference=answerHistoricalComparisonReference(historyReferenceInput,opt.history);if(historicalComparisonReference)return historicalComparisonReference;

    var pastMomentReference=answerPastMomentReference(historyReferenceInput,opt.history);if(pastMomentReference)return pastMomentReference;

    var absoluteTopicReference=answerAbsoluteTopicReference(historyReferenceInput,opt.history);if(absoluteTopicReference)return absoluteTopicReference;

    var featureEpisodeReference=answerFeatureEpisodeReference(historyReferenceInput,opt.history);if(featureEpisodeReference)return featureEpisodeReference;

    var featureRevision=answerFeatureRevision(original,opt.history);if(featureRevision)return featureRevision;

    var sameFeatureTargetSwitch=answerSameFeatureTargetSwitch(original,opt.history);if(sameFeatureTargetSwitch)return sameFeatureTargetSwitch;

    var topicHistoryReference=answerTopicHistoryReference(original,opt.history);if(topicHistoryReference)return topicHistoryReference;

    var linkMissRecovery=answerGuideLinkMiss(original,opt.history,opt);if(linkMissRecovery)return linkMissRecovery;

    var linkMissSelection=answerGuideLinkMissSelection(original,opt.history);if(linkMissSelection)return linkMissSelection;

    var guideReturnWithGoal=answerGuideConversationReturnWithGoal(original,opt.history,opt);if(guideReturnWithGoal)return guideReturnWithGoal;

    var pausedFeatureFollowup=answerPausedGuideFeatureFollowup(original,opt.history);if(pausedFeatureFollowup)return pausedFeatureFollowup;

    if(guideConversationReturnCue(original)){
      var guideReturn=answerGuideConversationReturn(opt.history);if(guideReturn)return guideReturn;
    }

    var vagueCapabilityRevision=answerVagueCapabilityRevision(original,opt.history);if(vagueCapabilityRevision)return vagueCapabilityRevision;

    var vagueCapabilityFollowup=answerVagueCapabilityFollowup(original,opt.history);if(vagueCapabilityFollowup)return vagueCapabilityFollowup;

    var comparisonAlternativeFeature=answerComparisonAlternativeFeature(original,opt.history);if(comparisonAlternativeFeature)return comparisonAlternativeFeature;

    var viewedAlternativeSelection=answerComparisonViewedAlternativeSelection(original,opt.history);if(viewedAlternativeSelection)return viewedAlternativeSelection;

    var comparisonSelectionRevision=answerComparisonSelectionRevision(original,opt.history);if(comparisonSelectionRevision)return comparisonSelectionRevision;

    var comparisonCandidateRecall=answerComparisonCandidateRecall(original,opt.history);if(comparisonCandidateRecall)return comparisonCandidateRecall;

    var comparisonSelectionRecall=answerComparisonSelectionRecall(original,opt.history);if(comparisonSelectionRecall)return comparisonSelectionRecall;

    var comparisonSelectionConfirmation=answerComparisonSelectionConfirmation(original,opt.history);if(comparisonSelectionConfirmation)return comparisonSelectionConfirmation;

    if(exactGuideLinkOpenCue(original)){
      var exactOpen=openExactGuideLinks(opt.history);if(exactOpen)return exactOpen;
    }

    if(postOpenGuideCue(original)){
      var postOpen=postOpenGuideAnswer(opt.history);if(postOpen)return postOpen;
    }

    var continuedDetail=answerContinuedGuideDetail(original,opt.history);if(continuedDetail)return continuedDetail;

    var detailSwitch=answerGuideDetailTargetSwitch(original,opt.history);if(detailSwitch)return detailSwitch;

    if(guideLinkDestinationCue(original)){
      var linkDestinations=explainGuideLinkDestinations(opt.history);if(linkDestinations)return linkDestinations;
    }

    if(selectiveGuideLinkCue(original)){
      var selectedLinks=selectGuideLinks(original,opt.history);if(selectedLinks)return selectedLinks;
    }

    if(repeatGuideLinkCue(original)){
      var repeatedLinks=repeatGuideLinks(opt.history);if(repeatedLinks)return repeatedLinks;
    }

    var stoneAlternativeSelection=answerStoneAlternativeSelection(original,opt.history);if(stoneAlternativeSelection)return stoneAlternativeSelection;
    var stoneAlternatives=answerStoneAlternatives(original,opt.history);if(stoneAlternatives)return stoneAlternatives;

    var comparisonChoiceReason=answerComparisonChoiceReason(original,opt.history);if(comparisonChoiceReason)return comparisonChoiceReason;

    var directPurposeRecommendation=answerDirectComparisonPurpose(featureInput);if(directPurposeRecommendation)return directPurposeRecommendation;

    if(hist.candidateKind==='comparison'){
      var comparisonIndecision=answerComparisonIndecision(original,hist.candidates);if(comparisonIndecision)return comparisonIndecision;
      var shorthandPurposeRecommendation=answerComparisonPurposeShorthand(featureInput,hist.candidates);if(shorthandPurposeRecommendation)return shorthandPurposeRecommendation;
      var earlyPurposeRecommendation=answerComparisonPurposeRecommendation(featureInput,hist.candidates);if(earlyPurposeRecommendation)return earlyPurposeRecommendation;
    }

    var freeGoal=pageFreeGoal(original);
    if(freeGoal)return answerPageFreeGoal(freeGoal);

    if(vagueSaveCapabilityCue(original)&&!pageContextFresh(opt.history,hist)&&!hist.candidates.length)return answerVagueSaveCapability();

    var vagueCapabilityKind=vagueSiteCapabilityKind(original);
    if(vagueCapabilityKind&&!pageContextFresh(opt.history,hist)&&!hist.candidates.length)return answerVagueSiteCapability(vagueCapabilityKind);

    // 直前に一つのページを案内・再掲した直後の裸の「何ができる？」は、
    // サイト全体ではなく、そのページについての質問として扱う。
    // 「このサイトは何ができる？」のような明示的な全体質問は従来どおり概要へ進める。
    if(overviewCue(t)&&!(recent&&!/(?:このサイト|たいらの野望|サイト案内|全ページ|ページ一覧|ツール一覧)/.test(t)&&pageHelpCue(t,null,recent))){
      return {handled:true,mode:'サイト総合案内',answer:'たいらの野望は、信長の野望Online向けの検索・計算・一覧・集合・抽選・カウンター確認をまとめたサイトです。\n陣法検索、英傑一覧、能力計算、家臣計算、七星転生、食料、鬼神石、九十九、魔導結晶、星海の荒石、鎮魂符、御蔵番拡張・名物一覧、徒党登録、ルーレット、トーナメント、カウンターがあります。\nやりたいことをラフに言ってくれれば、該当ページと使い方を案内するのですよ。',links:[itemLink(BY_ID.jinpo),itemLink(BY_ID.heroes),itemLink(BY_ID.stats),itemLink(BY_ID.retainer),itemLink(BY_ID.kishin),itemLink(BY_ID.tsukumo),itemLink(BY_ID.mado),itemLink(BY_ID.counter)],data:{siteOverview:true,itemCount:ITEMS.length,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
    }

    // 「文曲の輝光」「文曲の」「それじゃ武曲」のような自然な省略を、
    // 陣法の文曲設定へ誤配せず、星海の荒石の該当表示へ直接つなぐ。
    var directStone=seikaiStoneRequest(original,recent,cur);
    if(directStone)return seikaiStoneAnswer(directStone);

    var incompletePage=incompletePagePossessive(original);
    if(incompletePage){
      var incompleteAnswer=explainItem(incompletePage.item,true);
      incompleteAnswer.answer='「'+incompletePage.item.name+'」のことですね。言葉が途中でも大丈夫なのですよ。\n'+incompleteAnswer.answer;
      incompleteAnswer.data=incompleteAnswer.data||{};
      incompleteAnswer.data.incompletePossessive=true;
      incompleteAnswer.data.matched=incompletePage.matched;
      return incompleteAnswer;
    }

    // 直前の機能質問を別ページへ引き継ぐ短い返答は、用語単独の案内より優先する。
    // 例: 「九十九は何個？」→「じゃあ鬼神石は？」は同じ選択数を答える。
    var carryBeforeBare=featureCarryFollowup(featureInput,hist);
    var bareInfo=carryBeforeBare?null:bareKnownTerm(original);
    if(bareInfo&&featureIntents(featureInput,bareInfo.item).length)bareInfo=null;
    if(bareInfo){
      var bareAnswer=knownTermGuidance(bareInfo);
      if(bareAnswer)return bareAnswer;
    }

    if(/(?:トップ|ホーム|最初のページ)(?:へ|に)?(?:戻|行|移動|開)|トップページ(?:どこ|開いて|へ)|トップ(?:に)?戻りたい/.test(t))return {handled:true,mode:'サイト総合案内',answer:'トップページはこちらなのですよ。',links:[homeLink()],data:{siteItem:'home',siteOpen:true}};

    if(/(?:ここ|このページ|これ).*(?:何|なに|どんな|使い方|できる|ページ|何をする)/.test(t)&&cur){
      return explainItem(cur,false);
    }

    if(openToHelpCorrectionCue(original)){
      if(hist.selectedCandidate)return retainCandidateContext(explainItem(hist.selectedCandidate,false),hist.candidates,hist.selectedCandidate,hist.candidateKind,hist.sourceCandidates,hist.conditions);
      if(hist.candidates.length>1)return candidateClarification(hist.candidates,'使い方を知りたいのは、','のどれですか？');
      if(recent)return explainItem(recent,false);
    }

    var explicitOpenFeature=answerExplicitOpenAndFeature(featureInput,hist);if(explicitOpenFeature)return explicitOpenFeature;

    var directMultiOpen=explicitMultiOpenItems(original);
    if(directMultiOpen.length>=2)return answerCandidateLinks(directMultiOpen,directMultiOpen);

    if(hist.candidates.length){
      var rejectedCandidates=answerCandidateRejection(original,hist.candidates);
      if(rejectedCandidates)return rejectedCandidates;
      var relativeCandidate=answerCandidateRelativeMove(original,hist);
      if(relativeCandidate)return relativeCandidate;
      var previousCandidate=answerPreviousCandidate(original,opt.history,hist);
      if(previousCandidate)return previousCandidate;
      var alternativeCandidate=answerCandidateAlternative(original,opt.history,hist);
      if(alternativeCandidate)return alternativeCandidate;
      if(candidateRestoreCue(original)&&hist.sourceCandidates.length){
        var restored=answerCandidateSet(hist.sourceCandidates,hist.sourceCandidates,{open:candidateOpenCue(original),lead:candidateOpenCue(original)?candidateNames(hist.sourceCandidates)+'を開けるようにしました。':'元の候補 '+candidateNames(hist.sourceCandidates)+'に戻しました。'});if(restored)return restored;
      }
      var conditional=answerCandidateConditionalQuery(original,hist.candidates,hist.sourceCandidates,hist.conditions);
      if(conditional)return conditional;
      var exclusionOnly=answerCandidateExclusionOnly(original,hist.candidates,hist.sourceCandidates);
      if(exclusionOnly)return exclusionOnly;
      var remainder=answerCandidateRemainder(original,hist.candidates,hist.sourceCandidates,hist.selectedCandidate,hist.openedItems,hist.excludedItems);
      if(remainder)return remainder;
      var subset=candidateSubset(original,hist.candidates);
      if(subset.length){
        var subsetLinks=answerCandidateLinks(subset,hist.candidates,hist.sourceCandidates);
        if(subsetLinks&&hist.excludedItems.length){subsetLinks.data.siteExcludedItems=hist.excludedItems.map(function(item){return item.id;});subsetLinks.data.siteLinkMissRecoveryContinuation=true;}
        if(subsetLinks)return subsetLinks;
      }
      if(comparisonDifferenceCue(t)){
        var differenceAnswer=compareItems(hist.candidates);if(differenceAnswer)return differenceAnswer;
      }
      if(sameOrDifferentCue(t)){
        var sameAnswer=compareItems(hist.candidates);
        if(sameAnswer)sameAnswer.answer='完全に同じではないのですよ。\n'+sameAnswer.answer;
        if(sameAnswer)return sameAnswer;
      }
      if(comparisonRecommendationCue(t)){
        var recommendation=answerComparisonRecommendation(hist.candidates);if(recommendation)return recommendation;
      }
      var capabilityAnswer=answerCandidateCapability(featureInput,hist.candidates);
      if(capabilityAnswer)return capabilityAnswer;
    }

    var excluded=excludedPageReference(featureInput);
    if(excluded){
      var alternatives=(hist.candidates||[]).filter(function(x){return x&&x.id!==excluded.item.id;});
      if(alternatives.length===1){
        var excludedIntents=featureIntents(excluded.tail||featureInput,alternatives[0]);
        if(excludedIntents.length)return retainCandidateContext(answerFeatures(alternatives[0],excludedIntents,true,excluded.tail||featureInput),hist.candidates,alternatives[0],hist.candidateKind,hist.sourceCandidates,hist.conditions);
        var excludedPage=explainItem(alternatives[0],true);
        excludedPage=retainCandidateContext(excludedPage,hist.candidates,alternatives[0],hist.candidateKind,hist.sourceCandidates,hist.conditions);
        return excludedPage;
      }
      if(alternatives.length>1)return candidateClarification(alternatives,'「'+excluded.item.name+'」ではない候補は、');
      return {handled:true,mode:'サイト総合案内',answer:'「'+excluded.item.name+'」ではない方だけでは、対象を一つに決められないのですよ。比較していた相手の名前を教えてください。',links:[],data:{needsClarification:true,excludedSiteItem:excluded.item.id}};
    }

    var mixedClauses=answerMixedSiteClauses(original,recent,cur,hist.candidates);
    if(mixedClauses)return mixedClauses;

    var clauseGroups=siteClauseFeatureGroups(original,recent,cur,hist.candidates);
    if(clauseGroups.length){
      var clauseAnswer=answerClauseFeatureGroups(clauseGroups,true);if(clauseAnswer)return clauseAnswer;
    }

    if(hist.candidates.length&&allCandidatesCue(t)){
      var allLinks=answerCandidateLinks(hist.candidates,hist.candidates,hist.sourceCandidates);
      if(allLinks&&hist.excludedItems.length){allLinks.data.siteExcludedItems=hist.excludedItems.map(function(item){return item.id;});allLinks.data.siteLinkMissRecoveryContinuation=true;}
      if(allLinks)return allLinks;
    }
    if(hist.candidates.length){
      var selectedContextCandidate=selectFromCandidates(featureInput,hist.candidates,hist.selectedCandidate);
      if(selectedContextCandidate){
        var selectedContextFeatures=featureIntents(featureInput,selectedContextCandidate);
        if(selectedContextFeatures.length){
          var selectedContextAnswer=retainCandidateContext(answerFeatures(selectedContextCandidate,selectedContextFeatures,true,featureInput),hist.candidates,selectedContextCandidate,hist.candidateKind,hist.sourceCandidates,hist.conditions);if(selectedContextAnswer)return selectedContextAnswer;
        }
      }
      if(!selectedContextCandidate&&hist.selectedCandidate&&!/(?:両方|どっちも|どちらも|それぞれ|全部|全員)/.test(featureInput)){
        var continuedSelectedFeatures=featureIntents(featureInput,hist.selectedCandidate);
        if(continuedSelectedFeatures.length){
          var continuedSelectedAnswer=retainCandidateContext(answerFeatures(hist.selectedCandidate,continuedSelectedFeatures,true,featureInput),hist.candidates,hist.selectedCandidate,hist.candidateKind,hist.sourceCandidates,hist.conditions);if(continuedSelectedAnswer)return continuedSelectedAnswer;
        }
      }
      var contextualRequests=candidateFeatureRequests(featureInput,hist.candidates);
      if(contextualRequests.length){
        var contextualAnswer=answerFeatureRequests(contextualRequests,true,featureInput);if(contextualAnswer)return contextualAnswer;
      }
    }

    var requestedFeatures=featureRequests(featureInput,recent,cur);
    if(requestedFeatures.length){
      var requestedAnswer=answerFeatureRequests(requestedFeatures,true,featureInput);
      if(requestedAnswer)return requestedAnswer;
    }
    var featureTarget=featureQuestionTarget(featureInput,recent,cur);
    if(featureTarget){
      var featureKeys=featureIntents(featureInput,featureTarget),samePage=cur&&cur.id===featureTarget.id;
      var featureAnswer=answerFeatures(featureTarget,featureKeys,!samePage,featureInput);
      if(featureAnswer)return featureAnswer;
    }
    if(hist.feature){
      var carriedFeature=featureCarryFollowup(t,hist);
      if(carriedFeature){
        var carriedSame=cur&&cur.id===carriedFeature.item.id;
        var carriedAnswer=answerFeatures(carriedFeature.item,[carriedFeature.feature],!carriedSame,carriedFeature.query);
        if(carriedAnswer)return carriedAnswer;
      }
      var followDetailed=findItemDetailed(t),followPurpose=purposeScores(t),followItem=followDetailed.item||(followPurpose[0]&&followPurpose[0].item)||null;
      var followPage=sourcePage(followItem);
      if(followItem&&followPage&&followPage.facts&&followPage.facts[hist.feature]&&/^(?:じゃあ|じゃ|では|なら|それなら|あと|それと|で|それで)?[、,\s]*.+?(?:は|だと|なら|も同じ|も一緒)[？?。！!]*$/.test(t)){
        var followSame=cur&&cur.id===followItem.id;
        var followQuery=t;
        if(hist.feature==='reflect'&&!featureSubjectIds(t).length&&hist.featureSubjects.length===1){var followLabel=featureSubjectLabel(hist.featureSubjects[0]);if(followLabel)followQuery+=' '+followLabel;}
        var followAnswer=answerFeatures(followItem,[hist.feature],!followSame,followQuery);
        if(followAnswer)return followAnswer;
      }
    }

    // 直前に候補を出した後の「家臣の方」「2番目」など。
    if(hist.candidates.length){
      var selected=selectFromCandidates(featureInput,hist.candidates,hist.selectedCandidate);
      if(selected){
        var selectedPage=explainItem(selected,true);
        selectedPage=retainCandidateContext(selectedPage,hist.candidates,selected,hist.candidateKind,hist.sourceCandidates,hist.conditions);
        return selectedPage;
      }
      if(/^(?:どれ|どっち|どちら|もう一回|候補見せて|何があった)[？?。！!]*$/.test(t))return candidateClarification(hist.candidates,'候補は ');
    }

    // 直前に案内したページの兄弟・子ページを短く選ぶ。
    var hierarchical=hierarchicalSelection(t,recent);
    if(hierarchical)return explainItem(hierarchical,true);
    if(recent&&childrenOf(recent).length&&hierarchyCue(t))return candidateClarification(childrenOf(recent),'「'+recent.name+'」の次は、');

    // 「そのページ何できる」「開いて」「どこ押す」などは直前案内へ接続する。
    if(recent&&deicticOpenCue(t))return openItem(recent);
    if(recent&&pageHelpCue(t,null,recent)&&!mentionedItems(t).length){
      var contextualPageHelp=explainItem(recent,true);
      if(contextualPageHelp&&contextualPageHelp.data)contextualPageHelp.data.siteContextualPageHelp=true;
      return contextualPageHelp;
    }

    // TOPや一般ページで具体的な陣法操作を言われた場合だけ、操作できる陣法ページへ案内する。
    if(mode!=='jinpo'&&hasJinpoOperation(t)){
      return {handled:true,mode:'サイト総合案内',answer:'その条件は「陣法検索」で扱えます。陣法ページを開けば、歩き巫女が陣形・因縁数・能力条件・配置や除外まで操作できるのですよ。',links:[itemLink(BY_ID.jinpo)],data:{purpose:'jinpo_operation',siteItem:'jinpo'}};
    }

    var correctedTarget=correctionTail(original),targetText=correctedTarget||t;
    var detailed=findItemDetailed(targetText),purpose=purposeScores(targetText),item=detailed.item;
    if(purpose.length&&(!item||purpose[0].score>=detailed.score+10))item=purpose[0].item;
    // 言い直しは後半の対象を優先する。履歴がなくても「家臣計算じゃなくて能力計算」で確定できる。
    if(correctionCue(original)&&!item){var od=findItemDetailed(targetText);if(od.item)item=od.item;}

    var comparisonText=correctedTarget||t,compared=mentionedItems(comparisonText);
    if(compared.length>=2&&/(?:どっち|どちら|違い|違う|どう違う|比較|使い分け|どれがいい)/.test(comparisonText)){
      var comparedAnswer=compareItems(compared),openCompared=explicitComparedOpen(comparisonText,compared);
      if(comparedAnswer&&openCompared){
        comparedAnswer.links=[itemLink(openCompared)];
        comparedAnswer.answer+='\n「'+openCompared.name+'」だけ開けるようにしました。';
        comparedAnswer.data.selectedSiteItem=openCompared.id;
        comparedAnswer.data.siteOpen=true;
      }
      return comparedAnswer;
    }

    var alternatives=alternativeItems(correctedTarget||t);
    if(alternatives.length>=2)return candidateClarification(alternatives,'候補は ');

    if(item&&childrenOf(item).length&&hierarchyCue(t))return candidateClarification(childrenOf(item),'「'+item.name+'」の次は、');

    if(item&&pageHelpCue(t,item,recent||cur)){
      var pageHelpResult=explainItem(item,true);
      if(pageHelpResult&&pageHelpResult.data&&(hasNavigationCue(t)||/(?:開いて|開けて|移動|行きたい|連れて|見せて|出して)/.test(t)))pageHelpResult.data.siteOpen=true;
      return pageHelpResult;
    }

    var desire=/(?:見たい|見せて|見せろ|見られる|使いたい|やりたい|したい|してみたい|探したい|作りたい|つくりたい|開いて|開けて|出して|行きたい|どこ|どこから|連れて|見たいんだけど|開きたいんだけど|のやつ|の方|のほう)/.test(t);
    var factSpecific=factSpecificCue(t);
    var nav=hasNavigationCue(t)||intent==='navigation'||!!(item&&desire&&!factSpecific)||!!(item&&correctionCue(original));

    if(!nav)return {handled:false};

    if(/^(?:何か)?(?:を)?(?:計算|シミュレーション)(?:したい|してみたい|できる)[？?！!。]*$/.test(t)){
      return candidateClarification([BY_ID.stats,BY_ID.retainer,BY_ID.shichisei,BY_ID.food]);
    }

    if(!item&&detailed.candidates&&detailed.candidates.length>1)return candidateClarification(detailed.candidates);
    if(!item&&purpose.length>1&&purpose[0].score-purpose[1].score<4)return candidateClarification(purpose.slice(0,4));

    if(item){
      if(childrenOf(item).length&&/次|どれ|選/.test(t))return candidateClarification(childrenOf(item),'「'+item.name+'」の次は、');
      var suffix=item.external?'別タブで開けます。':item.id==='video'?'トップページの動画再生ボタンを押してください。':'こちらから開けます。';
      return {handled:true,mode:'サイト総合案内',answer:'「'+item.name+'」ですね。'+item.desc+' '+suffix,links:[itemLink(item)],data:{siteItem:item.id,siteOpen:true,normalized:t,matched:detailed.matched||''}};
    }

    return {handled:true,mode:'サイト総合案内',answer:'どのページへ行きたいか、目的をもう少しだけ教えてください。たとえば「6人編成を探したい」「家臣のステを計算したい」「桶狭間のカウンターを見たい」のように言えば案内できるのですよ。',links:[homeLink()],data:{needsClarification:true}};
  }

  window.JINPO_BOT_SITE_GUIDE={
    version:VERSION,items:ITEMS.slice(),respond:respond,findItem:findItem,findItemDetailed:findItemDetailed,
    purposeItem:purposeItem,purposeScores:purposeScores,currentItem:currentItem,pageMode:pageMode,
    absoluteUrl:abs,normalizeInput:normalizeInput,hasNavigationCue:hasNavigationCue,
    shouldHandleBeforeKnowledge:shouldHandleBeforeKnowledge,preflight:preflight,historyGuideContext:historyGuideContext,candidateContextFresh:candidateContextFresh,guideConversationReturnCue:guideConversationReturnCue,latestPausedGuideContext:latestPausedGuideContext,
    childrenOf:childrenOf,usageOf:usageOf,sourcePage:sourcePage,featureIntent:featureIntent,featureIntents:featureIntents,answerFeature:answerFeature,candidateFeatureRequests:candidateFeatureRequests,
    splitSiteFeatureClauses:splitSiteFeatureClauses,siteClauseFeatureGroups:siteClauseFeatureGroups,answerClauseFeatureGroups:answerClauseFeatureGroups,answerMixedSiteClauses:answerMixedSiteClauses,bareKnownTerm:bareKnownTerm,knownTermGuidance:knownTermGuidance,expandKnownTermFollowup:expandKnownTermFollowup,knownTermContextFresh:knownTermContextFresh,pageContextFresh:pageContextFresh,pageInternalChoice:pageInternalChoice,siteSourceVersion:SOURCE.version||''
  };
})();
