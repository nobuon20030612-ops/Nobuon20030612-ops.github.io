/*
 * 歩き巫女 サイト総合案内 v3.13.0
 *
 * - たいらの野望トップページと、カウンター配下の現行ページを案内する。
 * - ページ名の誤字・脱字・かな入力・ラフな目的表現を会話側の共通正規化と連携して扱う。
 * - 「そのページ」「家臣の方」「天の方」など、直前案内を受けた省略会話にも対応する。
 * - 数値やゲーム仕様は推測せず、「どのページで何ができるか」「画面をどう使うか」だけを担当する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_SITE_GUIDE)return;
  var VERSION='3.15.0';

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
    {id:'seikai',name:'星海の荒石',path:'seikai.html',category:'tool',aliases:['星海の荒石','荒石','星海','星海荒石'],purposes:['星海の荒石を確認する','荒石を見る'],desc:'星海の荒石に関する情報を確認するページです。'},
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
  function expandKnownTermFollowup(text,history){
    var h=Array.isArray(history)?history:[],ctx=historyGuideContext(h),recentItem=ctx.item,item=ctx.knownTermItem||recentItem,t=normalizeInput(text);
    var key=String(ctx.termKey||'item'),term=S(ctx.normalizedTerm||item&&item.name||'');
    var recentContinuation=latestContinuationData(h,ctx.knownTermIndex),recentHeroKnowledge=latestHeroKnowledgeData(h,ctx.knownTermIndex);
    if(!t)return null;
    if(acknowledgementOnly(t))return null;

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
          return {clarification:'どの英傑を除外から戻すか、名前を教えてください。',siteItem:item.id,reason:'exclusion_restore_clarification',termKey:key,normalizedTerm:term};
        }
        var restoreExplicit=exclusionText.match(/^(?:じゃあ|では|次は|今度は|やっぱり|やはり|いや|訂正)?[、,\s]*(.+?)(?:は|を|の除外を)?(?:使う|使いたい|候補に戻して|除外から戻して|除外を解除|戻して|取り消して)$/);
        if(restoreExplicit){
          var restoreHero=S(restoreExplicit[1]).replace(/^(?:それ|その人|その英傑)$/,'');
          if(!restoreHero)restoreHero=previousExcluded;
          if(restoreHero)return reply(restoreHero+'の除外を解除','exclusion_context');
          return {clarification:'どの英傑を除外から戻すか、名前を教えてください。',siteItem:item.id,reason:'exclusion_restore_clarification',termKey:key,normalizedTerm:term};
        }
        exclusionText=exclusionText.replace(/^(?:じゃあ|では|次は|今度は|追加で)[、,\s]*/,'').replace(/^(?:もう一人は|もう1人は)[、,\s]*/,'');
        if(/(?:と|、|,).*(?:外して|抜いて|除外)/.test(exclusionText))return {clarification:'除外英傑は間違いを防ぐため1人ずつ追加します。先に除外する英傑を1人だけ教えてください。',siteItem:item.id,reason:'exclusion_multiple_clarification',termKey:key,normalizedTerm:term};
        if(!/除外/.test(exclusionText)&&/(?:を|も)?(?:外して|抜いて|外す|抜く)$/.test(exclusionText))exclusionText=exclusionText.replace(/(?:を|も)?(?:外して|抜いて|外す|抜く)$/,'を除外して');
        else if(!/除外/.test(exclusionText))exclusionText+='を除外して';
        return reply(exclusionText,'exclusion_context');
      }
      if(/配置/.test(placementTerm)){
        var placementText=t.replace(/[？?。！!]+$/g,'');
        var previousPlaced=recentContinuation&&recentContinuation.reason==='placement_context'?continuationHero(recentContinuation.message,recentContinuation.reason):'';
        if(/^(?:じゃあ|では|次は|今度は|やっぱり|やはり|いや|訂正)?[、,\s]*(?:全部|全て|すべて)?(?:を)?(?:外して|抜いて|解除して|やめて|取り消して|戻して)$/.test(placementText)||/(?:を|は)?(?:外して|抜いて|解除して|やめて|取り消して|戻して)$/.test(placementText)){
          var targetLabel=previousPlaced?'「'+previousPlaced+'」の配置条件を外す意味か、候補から除外する意味か':'配置条件を外す意味か、英傑を候補から除外する意味か';
          return {clarification:targetLabel+'を確認したいです。配置だけを戻すなら「配置英傑1を解除」のように枠番号を、候補から外すなら英傑名と「除外して」を教えてください。',siteItem:item.id,reason:'placement_remove_clarification',termKey:key,normalizedTerm:term};
        }
        placementText=placementText.replace(/^(?:じゃあ|では|次は|今度は|追加で)[、,\s]*/,'').replace(/^(?:もう一人は|もう1人は)[、,\s]*/,'');
        if(/(?:と|、|,).*(?:入れて|加えて|配置)/.test(placementText))return {clarification:'配置英傑は間違いを防ぐため1人ずつ追加します。先に配置する英傑を1人だけ教えてください。',siteItem:item.id,reason:'placement_multiple_clarification',termKey:key,normalizedTerm:term};
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
    return /陣形|因縁|腕力|耐久|器用|知力|魅力|生命|気合|土属性|水属性|火属性|風属性|文曲|配置英傑|除外英傑|英傑.*(?:差替|固定|除外|配置)|(?:配置|除外).*(?:して|したい)|(?:入れて|使って).*(?:探して|検索)|差替|込み合計|全MAX|検索結果|鶴翼|方円|魚鱗|衡軛/.test(t)||/(?:鬼神石|見聞録|転生).*(?:MAX|マックス|設定|解除|数値)/.test(t)||/(?:MAX|マックス).*(?:鬼神石|見聞録|転生)/.test(t);
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
      if(leftItems.length===1&&featureIntents(tail,leftItems[0]).length)tail=leftItems[0].name+' '+tail;
    }
    return S(tail);
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
    var specialColumns=!!(item&&((item.id==='meibutsu'&&/(?:合計|種類)/.test(t))||(item.id==='chinkon'&&/(?:技能一覧|鎮魂符一覧|解放内容)/.test(t))));
    add('columns',specialColumns||/(?:何が載|何が見|表示項目|項目|列|一覧.*内容|どんな情報)/.test(t)||(columnWords.length>=2&&/(?:見られ|見れる|載って|確認|分かる|全部)/.test(t)));
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
    return S(text).replace(/^(?:あと|それと|それから|じゃあ|では|それなら|また|一方(?:で)?|反対に)[、,\s]*/,'');
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
    var h=Array.isArray(history)?history:[],lastItem=null,lastCandidates=[],lastSourceCandidates=[],lastOpenedItems=[],lastExcludedItems=[],lastConditions=[],lastCandidateKind='',lastFeature='',lastFeatureSubjects=[],lastSelectedCandidate=null,lastIndex=-1,candidateIndex=-1;
    var knownTermGuidance=false,knownTermKey='',knownTermValue='',knownTermApproximate=false,knownTermItem=null,knownTermIndex=-1;
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var meta=x.meta||{},data=meta.data||{};
      if(!knownTermGuidance&&data.knownTermGuidance){
        knownTermGuidance=true;knownTermKey=String(data.termKey||'item');knownTermValue=String(data.normalizedTerm||'');knownTermApproximate=!!data.approximateTerm;knownTermIndex=i;
        if(data.siteItem&&BY_ID[data.siteItem])knownTermItem=BY_ID[data.siteItem];
      }
      if(!lastFeature&&data.siteFeature)lastFeature=String(data.siteFeature||'');
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
    return {item:lastItem,candidates:lastCandidates,sourceCandidates:lastSourceCandidates.length?lastSourceCandidates:lastCandidates.slice(),openedItems:lastOpenedItems,excludedItems:lastExcludedItems,conditions:lastConditions,candidateKind:lastCandidateKind,feature:lastFeature,featureSubjects:lastFeatureSubjects,selectedCandidate:lastSelectedCandidate,index:lastIndex,candidateIndex:candidateIndex,knownTermGuidance:knownTermGuidance,termKey:knownTermKey,normalizedTerm:knownTermValue,approximateTerm:knownTermApproximate,knownTermItem:knownTermItem,knownTermIndex:knownTermIndex};
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
    if(idx<0&&/^(?:最後|一番最後|一番下|末尾|最後のやつ|下のやつ)/.test(t))idx=list.length-1;
    else if(idx<0&&list.length%2===1&&/^(?:真ん中|中央|中のやつ|真ん中のやつ)/.test(t))idx=Math.floor(list.length/2);
    else if(idx<0&&/^(?:1|１|一)(?:番|番目)?|最初|一番上|上の|前者/.test(t))idx=0;
    else if(idx<0&&/^(?:2|２|二)(?:番|番目)?|二番目|次の|下の|後者/.test(t))idx=1;
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

    if(/(?:前|最初)(?:の)?二つ/.test(t)){addIndex(0);addIndex(1);return out;}
    if(/(?:後ろ|後半|最後)(?:の)?二つ/.test(t)){addIndex(list.length-2);addIndex(list.length-1);return out;}

    // 候補全体を指す自然な表現。
    if(allCandidatesCue(t)||/(?:この|その|あの)?(?:二つ|2つ|２つ|三つ|3つ|３つ|候補全部|ページ全部|それら全部|この候補|このページたち|この二つのページ|この3つのページ).*(?:開いて|開けて|見せて|出して)/.test(t))return list.slice();

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
    return /(?:^|[、,\s])(?:残り|残った(?:方|ほう|やつ|もの|候補)?|それ以外|そのほか|その他|ほかの候補|他の候補|選んでない(?:方|ほう|やつ|もの)?|選ばなかった(?:方|ほう|やつ|もの)?|開いてない(?:方|ほう|やつ|もの)?|まだの(?:方|ほう|やつ|もの)?)(?:は|も|を|って|だけ|全部|どっち|どれ|何|開いて|見せて|出して|教えて|知りたい|[？?。！!]|$)/.test(t);
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
  function answerCandidateRemainder(text,candidates,sourceCandidates,selectedCandidate,openedItems){
    if(!candidateRemainderCue(text))return null;
    var t=normalizeInput(text),current=uniqueCandidateItems(candidates),source=uniqueCandidateItems(sourceCandidates&&sourceCandidates.length?sourceCandidates:current);
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
    var bodies=intent==='reflect'?reflectBodies(item,text):[featureBody(item,intent,text)],t=normalizeInput(text),target=/能力計算/.test(t)?'stats':/家臣/.test(t)?'retainer':'';
    if(!target&&item&&(item.id==='stats'||item.id==='retainer'))target=item.id;
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
    return /^(?:じゃあ|では|それなら|で|結局|つまり|要するに)?[、,\s]*(?:結局)?(?:どっち|どちら|どれ)(?:を|が)?(?:使えば|使うのが|選べば|選ぶのが|見れば|開けば)(?:いい|おすすめ|良い)[？?。！!]*$/.test(normalizeInput(text));
  }
  function answerComparisonRecommendation(candidates){
    var list=(candidates||[]).filter(Boolean);if(list.length<2)return null;
    var lines=list.map(function(item){var p=sourcePage(item),facts=p&&p.facts||{};return '・'+item.name+'：'+S(facts.compare||item.desc);});
    return {handled:true,mode:'サイト総合案内',answer:'目的で選ぶのが確実なのですよ。\n'+lines.join('\n')+'\n使いたい対象や、計算したいものを教えてくれれば、さらに一つへ絞れます。',links:list.map(itemLink),data:{siteComparison:list.map(function(x){return x.id;}),siteCandidates:list.map(function(x){return x.id;}),candidates:list.map(function(x){return x.id;}),siteRecommendation:true,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
  }
  function sameOrDifferentCue(text){
    return /^(?:じゃあ|では|それなら|で)?[、,\s]*(?:どっちも|両方|全部)?(?:ほぼ|だいたい)?(?:同じ|一緒)(?:なの|ですか|なのかな|ってこと|で合ってる)?[？?。！!]*$/.test(normalizeInput(text));
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
    if(ctx.feature==='reflect'&&!subjects.length&&carried.length===1){
      var label=featureSubjectLabel(carried[0]);if(label)query+=' '+label;
    }
    return {item:item,feature:ctx.feature,query:query};
  }

  function shouldHandleBeforeKnowledge(text,opt){
    var original=S(opt&&opt.original||text),t=normalizeInput(original),ctx=historyGuideContext(opt&&opt.history),cur=currentItem();
    var featureInput=correctionTail(original)||t;
    if(!t)return false;
    if(overviewCue(t))return true;
    if(bareKnownTerm(original))return true;
    if(openToHelpCorrectionCue(original))return true;
    if(explicitMultiOpenItems(original).length>=2)return true;
    if(siteClauseFeatureGroups(original,ctx.item,cur,ctx.candidates).length)return true;
    if(ctx.candidates.length&&candidateRestoreCue(original))return true;
    if(ctx.candidates.length&&candidateRemainderCue(original))return true;
    if(ctx.candidates.length&&(conditionRemovalRequest(original).all||conditionRemovalRequest(original).remove.length))return true;
    if(ctx.candidates.length&&answerCandidateExclusionOnly(original,ctx.candidates,ctx.sourceCandidates))return true;
    if(ctx.candidates.length&&candidateConditionalPlan(original,ctx.candidates))return true;
    if(ctx.candidates.length&&candidateSubset(original,ctx.candidates).length)return true;
    if(ctx.candidates.length&&sameOrDifferentCue(t))return true;
    if(ctx.candidates.length&&comparisonRecommendationCue(t))return true;
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
    var original=S(opt.original||text),t=normalizeInput(original);if(!t)return {handled:false};
    var mode=pageMode(),cur=currentItem(),intent=opt.intentInfo?String(opt.intentInfo.intent||''):'',hist=historyGuideContext(opt.history),recent=hist.item;
    var featureInput=correctionTail(original)||t;

    if(overviewCue(t)){
      return {handled:true,mode:'サイト総合案内',answer:'たいらの野望は、信長の野望Online向けの検索・計算・一覧・集合・抽選・カウンター確認をまとめたサイトです。\n陣法検索、英傑一覧、能力計算、家臣計算、七星転生、食料、鬼神石、九十九、魔導結晶、星海の荒石、鎮魂符、御蔵番拡張・名物一覧、徒党登録、ルーレット、トーナメント、カウンターがあります。\nやりたいことをラフに言ってくれれば、該当ページと使い方を案内するのですよ。',links:[itemLink(BY_ID.jinpo),itemLink(BY_ID.heroes),itemLink(BY_ID.stats),itemLink(BY_ID.retainer),itemLink(BY_ID.kishin),itemLink(BY_ID.tsukumo),itemLink(BY_ID.mado),itemLink(BY_ID.counter)],data:{siteOverview:true,itemCount:ITEMS.length,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
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

    if(/(?:トップ|ホーム|最初のページ)(?:へ|に)?(?:戻|行|移動|開)|トップページ(?:どこ|開いて|へ)|トップ(?:に)?戻りたい/.test(t))return {handled:true,mode:'サイト総合案内',answer:'トップページはこちらなのですよ。',links:[homeLink()],data:{siteItem:'home'}};

    if(/(?:ここ|このページ|これ).*(?:何|なに|どんな|使い方|できる|ページ|何をする)/.test(t)&&cur){
      return explainItem(cur,false);
    }

    if(openToHelpCorrectionCue(original)){
      if(hist.selectedCandidate)return retainCandidateContext(explainItem(hist.selectedCandidate,false),hist.candidates,hist.selectedCandidate,hist.candidateKind,hist.sourceCandidates,hist.conditions);
      if(hist.candidates.length>1)return candidateClarification(hist.candidates,'使い方を知りたいのは、','のどれですか？');
      if(recent)return explainItem(recent,false);
    }

    var directMultiOpen=explicitMultiOpenItems(original);
    if(directMultiOpen.length>=2)return answerCandidateLinks(directMultiOpen,directMultiOpen);

    if(hist.candidates.length){
      if(candidateRestoreCue(original)&&hist.sourceCandidates.length){
        var restored=answerCandidateSet(hist.sourceCandidates,hist.sourceCandidates,{open:candidateOpenCue(original),lead:candidateOpenCue(original)?candidateNames(hist.sourceCandidates)+'を開けるようにしました。':'元の候補 '+candidateNames(hist.sourceCandidates)+'に戻しました。'});if(restored)return restored;
      }
      var conditional=answerCandidateConditionalQuery(original,hist.candidates,hist.sourceCandidates,hist.conditions);
      if(conditional)return conditional;
      var exclusionOnly=answerCandidateExclusionOnly(original,hist.candidates,hist.sourceCandidates);
      if(exclusionOnly)return exclusionOnly;
      var remainder=answerCandidateRemainder(original,hist.candidates,hist.sourceCandidates,hist.selectedCandidate,hist.openedItems);
      if(remainder)return remainder;
      var subset=candidateSubset(original,hist.candidates);
      if(subset.length)return answerCandidateLinks(subset,hist.candidates,hist.sourceCandidates);
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
        if(hist.candidateKind==='comparison')excludedPage=retainCandidateContext(excludedPage,hist.candidates,alternatives[0],'comparison',hist.sourceCandidates,hist.conditions);
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
      var allLinks=answerCandidateLinks(hist.candidates,hist.candidates,hist.sourceCandidates);if(allLinks)return allLinks;
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
        if(hist.candidateKind==='comparison')selectedPage=retainCandidateContext(selectedPage,hist.candidates,selected,'comparison',hist.sourceCandidates,hist.conditions);
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
    if(recent&&pageHelpCue(t,null,recent))return explainItem(recent,true);

    // TOPや一般ページで具体的な陣法操作を言われた場合だけ、操作できる陣法ページへ案内する。
    if(mode!=='jinpo'&&hasJinpoOperation(t)){
      return {handled:true,mode:'サイト総合案内',answer:'その条件は「陣法検索」で扱えます。陣法ページを開けば、歩き巫女が陣形・因縁数・能力条件・配置や除外まで操作できるのですよ。',links:[itemLink(BY_ID.jinpo)],data:{purpose:'jinpo_operation',siteItem:'jinpo'}};
    }

    var correctedTarget=correctionTail(original),targetText=correctedTarget||t;
    var detailed=findItemDetailed(targetText),purpose=purposeScores(targetText),item=detailed.item;
    if(purpose.length&&(!item||purpose[0].score>=detailed.score+10))item=purpose[0].item;
    // 言い直しは後半の対象を優先する。履歴がなくても「家臣計算じゃなくて能力計算」で確定できる。
    if(correctionCue(original)&&!item){var od=findItemDetailed(targetText);if(od.item)item=od.item;}

    var compared=mentionedItems(t);
    if(compared.length>=2&&/(?:どっち|どちら|違い|違う|どう違う|比較|使い分け|どれがいい)/.test(t)){
      var comparedAnswer=compareItems(compared),openCompared=explicitComparedOpen(t,compared);
      if(comparedAnswer&&openCompared){
        comparedAnswer.links=[itemLink(openCompared)];
        comparedAnswer.answer+='\n「'+openCompared.name+'」だけ開けるようにしました。';
        comparedAnswer.data.selectedSiteItem=openCompared.id;
      }
      return comparedAnswer;
    }

    var alternatives=alternativeItems(t);
    if(alternatives.length>=2)return candidateClarification(alternatives,'候補は ');

    if(item&&childrenOf(item).length&&hierarchyCue(t))return candidateClarification(childrenOf(item),'「'+item.name+'」の次は、');

    if(item&&pageHelpCue(t,item,recent||cur))return explainItem(item,true);

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
      return {handled:true,mode:'サイト総合案内',answer:'「'+item.name+'」ですね。'+item.desc+' '+suffix,links:[itemLink(item)],data:{siteItem:item.id,normalized:t,matched:detailed.matched||''}};
    }

    return {handled:true,mode:'サイト総合案内',answer:'どのページへ行きたいか、目的をもう少しだけ教えてください。たとえば「6人編成を探したい」「家臣のステを計算したい」「桶狭間のカウンターを見たい」のように言えば案内できるのですよ。',links:[homeLink()],data:{needsClarification:true}};
  }

  window.JINPO_BOT_SITE_GUIDE={
    version:VERSION,items:ITEMS.slice(),respond:respond,findItem:findItem,findItemDetailed:findItemDetailed,
    purposeItem:purposeItem,purposeScores:purposeScores,currentItem:currentItem,pageMode:pageMode,
    absoluteUrl:abs,normalizeInput:normalizeInput,hasNavigationCue:hasNavigationCue,
    shouldHandleBeforeKnowledge:shouldHandleBeforeKnowledge,preflight:preflight,historyGuideContext:historyGuideContext,candidateContextFresh:candidateContextFresh,
    childrenOf:childrenOf,usageOf:usageOf,sourcePage:sourcePage,featureIntent:featureIntent,featureIntents:featureIntents,answerFeature:answerFeature,candidateFeatureRequests:candidateFeatureRequests,
    splitSiteFeatureClauses:splitSiteFeatureClauses,siteClauseFeatureGroups:siteClauseFeatureGroups,answerClauseFeatureGroups:answerClauseFeatureGroups,answerMixedSiteClauses:answerMixedSiteClauses,bareKnownTerm:bareKnownTerm,knownTermGuidance:knownTermGuidance,expandKnownTermFollowup:expandKnownTermFollowup,knownTermContextFresh:knownTermContextFresh,pageContextFresh:pageContextFresh,pageInternalChoice:pageInternalChoice,siteSourceVersion:SOURCE.version||''
  };
})();
