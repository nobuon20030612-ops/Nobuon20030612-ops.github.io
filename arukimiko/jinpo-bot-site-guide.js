/*
 * 歩き巫女 サイト総合案内 v3.3.0
 *
 * - たいらの野望トップページと、カウンター配下の現行ページを案内する。
 * - ページ名の誤字・脱字・かな入力・ラフな目的表現を会話側の共通正規化と連携して扱う。
 * - 「そのページ」「家臣の方」「天の方」など、直前案内を受けた省略会話にも対応する。
 * - 数値やゲーム仕様は推測せず、「どのページで何ができるか」「画面をどう使うか」だけを担当する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_SITE_GUIDE)return;
  var VERSION='3.3.0';

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
    return /陣形|因縁|腕力|耐久|器用|知力|魅力|生命|気合|土属性|水属性|火属性|風属性|英傑.*(?:差替|固定|除外|配置)|差替|込み合計|全MAX|検索結果|鶴翼|方円|魚鱗|衡軛/.test(t)||/(?:鬼神石|見聞録|転生).*(?:MAX|マックス|設定|解除|数値)/.test(t)||/(?:MAX|マックス).*(?:鬼神石|見聞録|転生)/.test(t);
  }
  function overviewCue(text){
    var t=normalizeInput(text);
    return /(?:このサイト|たいらの野望|サイト).*(?:何ができる|何できる|何をすればいい|何すればいい|何する|何がある|どんなサイト|機能|ツール|全部|全体|案内)|^(?:サイト案内|ツール一覧|全ページ|ページ一覧|何ができる|何をすればいい|何するサイト)[？?。！!]*$/.test(t);
  }
  function pageHelpCue(text,item,recent){
    var t=normalizeInput(text),hasTarget=!!item||!!recent;
    if(/(?:ページ|画面|ツール).*(?:使い方|やり方|見方|操作|何ができる|何する|どこを押す|どれを押す|分からない)|(?:使い方|やり方|見方|操作|何ができる|何する|どこを押す|どれを押す).*(?:ページ|画面|ツール)/.test(t))return true;
    if(hasTarget&&/(?:何ができる|何できる|何をする|何するやつ|どう使う|どう見る|見方|どこを押す|どれを押す|何を押す|操作方法|使い方が?分からない|見方が?分からない)/.test(t))return true;
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
  function correctionCue(text){return /(?:じゃなくて|ではなくて|じゃなく|ではなく|そっちじゃない|それじゃない|違う[、,\s])/.test(S(text));}
  function correctionTail(text){
    var t=S(text),m=t.match(/(?:じゃなくて|ではなくて|じゃなく|ではなく|そっちじゃない|それじゃない|違う[、,\s]*)(.+)$/);
    return m?S(m[1]):'';
  }
  function deicticOpenCue(text){return /^(?:それ|そこ|そのページ|そっち|これ|このページ)?[、,\s]*(?:を)?(?:開いて|開けて|見せて|出して|行きたい|連れてって)[。！!？?]*$/.test(normalizeInput(text));}

  function featureIntents(text,item){
    var t=normalizeInput(text),page=sourcePage(item),facts=page&&page.facts||{},out=[];
    if(!page)return out;
    function has(key){return !!S(facts[key]);}
    function add(key,cond){if(cond&&has(key)&&out.indexOf(key)<0)out.push(key);}

    add('selection_count',/(?:何個(?:まで)?|いくつ(?:まで)?|最大(?:で)?何個|上限(?:は)?何個).*(?:選|入れ|登録|まで|可能|でき)|(?:選|入れ|登録).*(?:何個|いくつ|最大|上限)|選択数|最大選択|何個まで[？?。！!]*$|(?:どっちも|両方|どれも).*(?:何個|[0-9]+個|同じ|一緒)|[0-9]+個(?:まで)?(?:なの|ですか|で合って|でいい|も同じ|も一緒)?[？?。！!]*$/.test(t));
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
    add('filter',/(?:絞り込|絞れ|絞れる|フィルタ|地域|町.*(?:選|解除|絞)|検索条件)/.test(t));
    var shortReflectQuestion=!!(item&&(item.id==='stats'||item.id==='retainer')&&/(?:九十九|魔導結晶|魔導|鎮魂符|鬼神石)(?:は|って|だと|なら|も)?[？?。！!]*$/.test(t));
    add('reflect',/(?:反映|連携|取り込|入れられ|入れれる|使える|表に入|合計を入|能力計算.*(?:九十九|魔導|鎮魂|鬼神石)|家臣.*(?:九十九|魔導|鎮魂|鬼神石))/.test(t)||shortReflectQuestion);
    add('share',/(?:共有|URL|リンクをコピー|URL.*(?:送|渡)|送れる|JSON|書き出|読込|読み込)/i.test(t));
    add('save',/(?:保存|画像|スクショ|スクリーンショット|ダウンロード)/.test(t));
    add('zoom',/(?:拡大|縮小|倍率|ズーム|100%|125%|150%|175%|200%)/.test(t));
    add('reset',/(?:リセット|初期化|やり直|元に戻|全部消|解除方法|消し方)/.test(t));
    add('sort',/(?:並べ替|ソート|優先|高い順|安い|安い順|値段|必要個数|個数が少|種類が少|少ない順|最安|最小個数|ベスト10|順番|ランキング)/.test(t));
    var columnWords=(t.match(/(?:因子|職業|コスト|能力|ステータス|育成技能|武器|固有技能|入手|番号)/g)||[]);
    add('columns',/(?:何が載|何が見|表示項目|項目|列|一覧.*内容|どんな情報)/.test(t)||(columnWords.length>=2&&/(?:見られ|見れる|載って|確認|分かる|全部)/.test(t)));
    add('inputs',/(?:何を入力|入力項目|どこに入力|どこへ入|入力するもの|何入れる|設定項目|入力.*(?:計算|する)|計算.*入力)/.test(t));
    add('categories',/(?:何種類|種類|カテゴリ|分類|系統|何がある|選択肢|どれがある|何を選|部位|何か所|何箇所|いくつ.*(?:場所|章|地域)|何因縁|因縁.*(?:何個|いくつ|まで))/.test(t));
    add('back',/(?:戻る|戻り先|トップへ|前のページ|どこに戻)/.test(t));
    add('related',/(?:関連|どこから行|つなが|移動でき|行ける|御蔵番.*名物|名物.*(?:どこから|開ける|見られる|見れる))/.test(t));
    add('advanced',/(?:マスター|差し替|上級|formations|CSV|ファイル)/i.test(t));
    add('download',/(?:ダウンロード|test\.xlsx|左上.*ボタン)/i.test(t));
    return out;
  }
  function featureIntent(text,item){var a=featureIntents(text,item);return a.length?a[0]:'';}
  function featureBody(item,intent,text){
    var page=sourcePage(item),facts=page&&page.facts||{};
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
      if(/九十九/.test(t))add('reflect_tsukumo');
      if(/魔導結晶|魔導/.test(t))add('reflect_mado');
      if(/鎮魂符/.test(t))add('reflect_chinkon');
      if(/鬼神石/.test(t))add('reflect_kishin');
    }
    if(!out.length)add('reflect');
    return out;
  }
  function featureQuestionTarget(text,recent,cur){
    var t=normalizeInput(text),detailed=findItemDetailed(t),purpose=purposeScores(t),item=detailed.item||(purpose[0]&&purpose[0].item)||null;
    // 計算機を案内した直後の「九十九も入れれる？」は、九十九一覧ではなく反映先の計算機を主語にする。
    if(recent&&(recent.id==='stats'||recent.id==='retainer')&&/(?:反映|入れられ|入れれる|いれられ|いれれる|使える|表に入)/.test(t)&&featureIntent(t,recent))return recent;
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
    if(recent&&(recent.id==='stats'||recent.id==='retainer')&&/(?:反映|入れられ|入れれる|いれられ|いれれる|使える|表に入)/.test(t)){
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
    return {handled:true,mode:'サイト総合案内',answer:answer,links:links,data:{siteItem:item.id,siteFeature:list[0].intent,siteFeatures:list.map(function(x){return x.intent;}),verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
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
    return {handled:true,mode:'サイト総合案内',answer:'確認できる内容はこちらなのですよ。\n'+lines.join('\n'),links:links,data:{siteItems:items,siteFeatures:features,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
  }


  function homeLink(){return link('トップページを開く','');}
  function itemLink(item){if(item.id==='video')return homeLink();return link(item.name+'を開く',item.path,item.external);}
  function sourcePage(item){return item&&SOURCE_PAGES[item.id]||null;}
  function usageOf(item){var page=sourcePage(item);return S(page&&page.usage||USAGE_BY_ID[item&&item.id]||item&&item.desc||'');}
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
  function candidateClarification(candidates,lead){
    var unique=[],seen={};(candidates||[]).forEach(function(x){var item=x.item||x;if(item&&!seen[item.id]){seen[item.id]=1;unique.push(item);}});
    if(!unique.length)return null;
    return {handled:true,mode:'サイト総合案内',answer:(lead||'近いページが複数あるのですよ。')+unique.map(function(x){return '「'+x.name+'」';}).join('、')+'のどれを開きたいですか？',links:unique.slice(0,8).map(itemLink),data:{needsClarification:true,candidates:unique.map(function(x){return x.id;}),siteCandidates:unique.map(function(x){return x.id;})}};
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
    var h=Array.isArray(history)?history:[],lastItem=null,lastCandidates=[],lastFeature='',lastIndex=-1,candidateIndex=-1;
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;
      var meta=x.meta||{},data=meta.data||{};
      if(!lastFeature&&data.siteFeature)lastFeature=String(data.siteFeature||'');
      if(!lastCandidates.length){
        var ids=data.siteCandidates||data.candidates||data.siteComparison||data.siteItems||[];
        if(Array.isArray(ids)&&ids.length)lastCandidates=ids.map(function(id){return BY_ID[id];}).filter(Boolean);
        if(!lastCandidates.length&&Array.isArray(meta.links)&&meta.links.length>1)lastCandidates=meta.links.map(function(l){return itemFromUrl(l&&l.url);}).filter(Boolean);
        if(lastCandidates.length)candidateIndex=i;
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
    return {item:lastItem,candidates:lastCandidates,feature:lastFeature,index:lastIndex,candidateIndex:candidateIndex};
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
  function selectFromCandidates(text,candidates){
    var t=normalizeInput(text),ct=compact(t),list=(candidates||[]).filter(Boolean);if(!list.length)return null;
    var idx=-1;
    if(/^(?:1|１|一)(?:番|番目)?|最初|一番上|上の|前者/.test(t))idx=0;
    else if(/^(?:2|２|二)(?:番|番目)?|二番目|次の|下の|後者/.test(t))idx=1;
    else if(/^(?:3|３|三)(?:番|番目)?|三番目/.test(t))idx=2;
    else if(/^(?:4|４|四)(?:番|番目)?|四番目/.test(t))idx=3;
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
  function allCandidatesCue(text){
    return /^(?:じゃあ|では|それなら|なら)?[、,\s]*(?:両方|どっちも|どれも|全部|まとめて)(?:のページ|ページ|を|も)?[、,\s]*(?:開いて|開けて|見せて|出して|行きたい|連れてって)[。！!？?]*$/.test(normalizeInput(text));
  }
  function answerCandidateLinks(candidates){
    var list=[],seen={};(candidates||[]).forEach(function(item){if(item&&!seen[item.id]){seen[item.id]=1;list.push(item);}});
    if(!list.length)return null;
    return {handled:true,mode:'サイト総合案内',answer:list.map(function(x){return '「'+x.name+'」';}).join('と')+'をまとめて開けるようにしました。',links:list.slice(0,8).map(itemLink),data:{siteCandidates:list.map(function(x){return x.id;}),candidates:list.map(function(x){return x.id;})}};
  }
  function candidateFeatureRequests(text,candidates){
    var out=[];(candidates||[]).forEach(function(item){
      var intents=featureIntents(text,item);if(intents.length)out.push({item:item,intents:intents});
    });
    return out;
  }

  function hierarchicalSelection(text,recent){
    if(!recent)return null;var t=normalizeInput(text),base=recent;
    var children=childrenOf(base),parent=parentOf(base);
    if(children.length){
      var c=selectFromCandidates(t,children);if(c)return c;
      if(base.id==='tenka_taikai'){
        if(/^(?:じゃあ|では|それなら)?[、,\s]*(?:天|上)(?:の方|のほう|で|を|がいい)?[。！!？?]*$/.test(t))return BY_ID.ten_mode;
        if(/^(?:じゃあ|では|それなら)?[、,\s]*(?:地|下)(?:の方|のほう|で|を|がいい)?[。！!？?]*$/.test(t))return BY_ID.chi_mode;
      }
    }
    if(parent){
      var siblings=childrenOf(parent),s=selectFromCandidates(t,siblings);if(s)return s;
      if(parent.id==='tenka_taikai'){
        if(/^(?:じゃあ|では|それなら)?[、,\s]*(?:天|上)(?:の方|のほう|で|を|がいい)?[。！!？?]*$/.test(t))return BY_ID.ten_mode;
        if(/^(?:じゃあ|では|それなら)?[、,\s]*(?:地|下)(?:の方|のほう|で|を|がいい)?[。！!？?]*$/.test(t))return BY_ID.chi_mode;
      }
    }
    return null;
  }

  function shouldHandleBeforeKnowledge(text,opt){
    var original=S(opt&&opt.original||text),t=normalizeInput(original),ctx=historyGuideContext(opt&&opt.history),cur=currentItem();
    if(!t)return false;
    if(overviewCue(t))return true;
    if(ctx.candidates.length&&allCandidatesCue(t))return true;
    if(ctx.candidates.length&&candidateFeatureRequests(t,ctx.candidates).length)return true;
    if(ctx.candidates.length&&selectFromCandidates(t,ctx.candidates))return true;
    if(hierarchicalSelection(t,ctx.item))return true;
    if(ctx.item&&childrenOf(ctx.item).length&&hierarchyCue(t))return true;
    var correctionText=correctionTail(original),resolveText=correctionText||t;
    var detailed=findItemDetailed(resolveText),purpose=purposeScores(resolveText),item=detailed.item||(purpose[0]&&purpose[0].item)||null;
    var featureReqs=featureRequests(t,ctx.item,cur);if(featureReqs.length)return true;
    // 人物・敵名を主語にした「○○のカウンター見たい」は、ページ移動ではなく
    // 正本の個別カウンター回答へ渡す。
    if(specificCounterSubjectCue(t,item))return false;
    if(featureQuestionTarget(t,ctx.item,cur))return true;
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

    if(overviewCue(t)){
      return {handled:true,mode:'サイト総合案内',answer:'たいらの野望は、信長の野望Online向けの検索・計算・一覧・集合・抽選・カウンター確認をまとめたサイトです。\n陣法検索、英傑一覧、能力計算、家臣計算、七星転生、食料、鬼神石、九十九、魔導結晶、星海の荒石、鎮魂符、御蔵番拡張・名物一覧、徒党登録、ルーレット、トーナメント、カウンターがあります。\nやりたいことをラフに言ってくれれば、該当ページと使い方を案内するのですよ。',links:[itemLink(BY_ID.jinpo),itemLink(BY_ID.heroes),itemLink(BY_ID.stats),itemLink(BY_ID.retainer),itemLink(BY_ID.kishin),itemLink(BY_ID.tsukumo),itemLink(BY_ID.mado),itemLink(BY_ID.counter)],data:{siteOverview:true,itemCount:ITEMS.length,verifiedSiteSource:true,sourceVersion:SOURCE.version||''}};
    }

    if(/(?:トップ|ホーム|最初のページ)(?:へ|に)?(?:戻|行|移動|開)|トップページ(?:どこ|開いて|へ)|トップ(?:に)?戻りたい/.test(t))return {handled:true,mode:'サイト総合案内',answer:'トップページはこちらなのですよ。',links:[homeLink()],data:{siteItem:'home'}};

    if(/(?:ここ|このページ|これ).*(?:何|なに|どんな|使い方|できる|ページ|何をする)/.test(t)&&cur){
      return explainItem(cur,false);
    }

    if(hist.candidates.length&&allCandidatesCue(t)){
      var allLinks=answerCandidateLinks(hist.candidates);if(allLinks)return allLinks;
    }
    if(hist.candidates.length){
      var contextualRequests=candidateFeatureRequests(t,hist.candidates);
      if(contextualRequests.length){
        var contextualAnswer=answerFeatureRequests(contextualRequests,true,t);if(contextualAnswer)return contextualAnswer;
      }
    }

    var requestedFeatures=featureRequests(t,recent,cur);
    if(requestedFeatures.length){
      var requestedAnswer=answerFeatureRequests(requestedFeatures,true,t);
      if(requestedAnswer)return requestedAnswer;
    }
    var featureTarget=featureQuestionTarget(t,recent,cur);
    if(featureTarget){
      var featureKeys=featureIntents(t,featureTarget),samePage=cur&&cur.id===featureTarget.id;
      var featureAnswer=answerFeatures(featureTarget,featureKeys,!samePage,t);
      if(featureAnswer)return featureAnswer;
    }
    if(hist.feature){
      var followDetailed=findItemDetailed(t),followPurpose=purposeScores(t),followItem=followDetailed.item||(followPurpose[0]&&followPurpose[0].item)||null;
      var followPage=sourcePage(followItem);
      if(followItem&&followPage&&followPage.facts&&followPage.facts[hist.feature]&&/^(?:じゃあ|では|なら|それなら|あと|それと)?[、,\s]*.+?(?:は|だと|なら|も同じ|も一緒)[？?。！!]*$/.test(t)){
        var followSame=cur&&cur.id===followItem.id;
        var followAnswer=answerFeatures(followItem,[hist.feature],!followSame,t);
        if(followAnswer)return followAnswer;
      }
    }

    // 直前に候補を出した後の「家臣の方」「2番目」など。
    if(hist.candidates.length){
      var selected=selectFromCandidates(t,hist.candidates);
      if(selected)return explainItem(selected,true);
      if(/^(?:どれ|どっち|どちら|もう一回|候補見せて|何があった)[？?。！!]*$/.test(t))return candidateClarification(hist.candidates,'候補は ');
    }

    // 直前に案内したページの兄弟・子ページを短く選ぶ。
    var hierarchical=hierarchicalSelection(t,recent);
    if(hierarchical)return explainItem(hierarchical,true);
    if(recent&&childrenOf(recent).length&&hierarchyCue(t))return candidateClarification(childrenOf(recent),'「'+recent.name+'」の次は、');

    // 「そのページ何できる」「開いて」「どこ押す」などは直前案内へ接続する。
    if(recent&&deicticOpenCue(t))return explainItem(recent,true);
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
    if(compared.length>=2&&/(?:どっち|どちら|違い|違う|どう違う|比較|使い分け|どれがいい)/.test(t))return compareItems(compared);

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
    shouldHandleBeforeKnowledge:shouldHandleBeforeKnowledge,preflight:preflight,historyGuideContext:historyGuideContext,
    childrenOf:childrenOf,usageOf:usageOf,sourcePage:sourcePage,featureIntent:featureIntent,featureIntents:featureIntents,answerFeature:answerFeature,candidateFeatureRequests:candidateFeatureRequests,siteSourceVersion:SOURCE.version||''
  };
})();
