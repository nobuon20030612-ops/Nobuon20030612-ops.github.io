/*
 * 歩き巫女 共通会話ルーター v3.3.0
 *
 * 目的:
 * - 「ページ案内」「事実質問」「会話の続き」を各モジュール任せにせず最初に一度だけ判定。
 * - 短い追質問を直前の話題へ接続。
 * - 「違う」「そうじゃなくて」の後半を優先。
 * - ページ案内は明示的に移動を頼まれた時だけ。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_CONVERSATION)return;
  var VERSION='3.7.0';
  var RESET_KEY='arukimikoConversationResetAt.v1';

  function resetContext(){
    var at=Date.now();
    try{sessionStorage.setItem(RESET_KEY,String(at));}catch(e){}
    return at;
  }

  function resetAt(){
    try{
      var n=Number(sessionStorage.getItem(RESET_KEY)||0);
      return isFinite(n)&&n>0?n:0;
    }catch(e){return 0;}
  }

  function filterHistory(history){
    var h=Array.isArray(history)?history:[];
    var cut=resetAt();
    if(!cut)return h.slice();
    return h.filter(function(x){return x&&Number(x.at||0)>=cut;});
  }


  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function C(v){
    return S(v).toLowerCase().replace(/[？?！!。、・「」『』【】（）()\[\]［］\s]/g,'');
  }

  // ラフな日本語のうち、意味がほぼ一意な短い崩れだけを会話判定用に正規化する。
  // 固有名詞・ゲーム用語・数値は触らない。広い自動訂正は誤認の原因になるため行わない。
  function normalizeCasualInput(v){
    var original=S(v),t=original;
    if(!t)return {text:'',changed:false,original:original};
    var rules=[
      [/ど[ー~〜～]?ゆ[ー]?こと/g,'どういうこと'],
      [/どいうこと/g,'どういうこと'],
      [/そ[ー~〜～]?ゆ[ー]?こと/g,'そういうこと'],
      [/そいうこと/g,'そういうこと'],
      [/ど[ー~〜～]?した(?:の|ん)?(?=[？?！!。\s]*$)/g,'どうした'],
      [/ど[ー~〜～]?しよ(?:う)?(?=[かな？?！!。\s]*$)/g,'どうしよう'],
      [/^(?:もっかい|もっぺん)(?=[お願いして教説明？?！!。\s]*$)/g,'もう一回'],
      [/わかた(?=[よね？?！!。\s]*$)/g,'わかった'],
      [/りょ[ー~〜～]?かい(?=[よね？?！!。\s]*$)/g,'了解'],
      [/りょー(?=[！!。\s]*$)/g,'了解'],
      [/^りょ(?=[！!。？?\s]*$)/g,'了解'],
      [/おけ(?=[！!。\s]*$)/g,'OK'],
      [/おっけ(?=[！!。\s]*$)/g,'OK'],
      [/そ[ー~〜～]+なんだ(?=[ねよな？?！!。\s]*$)/g,'そうなんだ'],
      [/そ[ー~〜～]+なの(?=[かね？?！!。\s]*$)/g,'そうなの'],
      [/そなんだ(?=[ねよな？?！!。\s]*$)/g,'そうなんだ'],
      [/そ[ー~〜～]+か(?=[なね？?！!。\s]*$)/g,'そうか'],
      [/どうなん(?=[？?！!。\s]*$)/g,'どうなの'],
      [/^(?:んで|そんで|ほんで)(?=[？?！!。…\s]*$)/g,'それで'],
      [/^(?:だる|だりぃ|だりい)(?=[ねなよわ？?！!。…\s]*$)/g,'だるい'],
      [/^(?:ねむ|ねみぃ|ねみい)(?=[ねなよわ？?！!。…\s]*$)/g,'眠い'],
      [/^しんど(?=[ねなよわ？?！!。…\s]*$)/g,'しんどい'],
      [/^つら(?=[ねなよわ？?！!。…\s]*$)/g,'つらい'],
      [/^(?:まじそれ|マジそれ)(?=[ねなよわ？?！!。…\s]*$)/g,'それな'],
      [/^(?:ま[ー〜～]?ね|まぁね)(?=[？?！!。…\s]*$)/g,'まあね'],
      [/^(?:まぁ|まー)[、,\s]*いっか(?=[？?！!。…\s]*$)/g,'まあいっか'],
      [/^そなん(?=[ねなよわ？?！!。…\s]*$)/g,'そうなん'],
      [/^あ[ー~〜～]*そういう(?=[？?！!。\s]*$)/g,'そういうことね'],
      [/^そっか[ー~〜～]+(?=[？?！!。\s]*$)/g,'そっか'],
      [/まぢ(?=(?:で)?[？?！!。\s]*$)/g,'マジ']
    ];
    for(var i=0;i<rules.length;i++)t=t.replace(rules[i][0],rules[i][1]);
    return {text:t,changed:t!==original,original:original};
  }



  // 漢字を知らない入力でも、既知の会話語・サイト用語・主要人物名を
  // ひらがな/カタカナから既存の正規表記へ戻す。
  // 一般文全体をかな変換するのではなく、意味が明確な登録語だけを置換する。
  function hiraText(v){
    var s=S(v);
    return s.replace(/[ァ-ヶ]/g,function(ch){return String.fromCharCode(ch.charCodeAt(0)-0x60);}).replace(/ヴ/g,'ゔ');
  }
  function kataText(v){
    return String(v==null?'':v).replace(/[ぁ-ゖ]/g,function(ch){return String.fromCharCode(ch.charCodeAt(0)+0x60);}).replace(/ゔ/g,'ヴ');
  }
  function escKanaRe(v){return String(v||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

  // かな入力の安全な表記ゆれ照合用。
  // - 小書き文字を通常サイズで入力: しょうさい -> しようさい
  // - 濁点/半濁点を省略: まどう -> まとう
  // 文字数は変えず、元の文字位置へ正規表記を戻せる形に限定する。
  function smallKanaFold(v){
    var map={'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お','ゃ':'や','ゅ':'ゆ','ょ':'よ','ゎ':'わ','っ':'つ','ゕ':'か','ゖ':'け'};
    return hiraText(v).replace(/[ぁぃぅぇぉゃゅょゎっゕゖ]/g,function(ch){return map[ch]||ch;});
  }
  function unvoiceKanaFold(v){
    var map={
      'が':'か','ぎ':'き','ぐ':'く','げ':'け','ご':'こ',
      'ざ':'さ','じ':'し','ず':'す','ぜ':'せ','ぞ':'そ',
      'だ':'た','ぢ':'ち','づ':'つ','で':'て','ど':'と',
      'ば':'は','び':'ひ','ぶ':'ふ','べ':'へ','ぼ':'ほ',
      'ぱ':'は','ぴ':'ひ','ぷ':'ふ','ぺ':'へ','ぽ':'ほ','ゔ':'う'
    };
    return smallKanaFold(v).replace(/[がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽゔ]/g,function(ch){return map[ch]||ch;});
  }


  // 音声入力・スマホ入力で、かなの間だけに入った空白を取り除く。
  // 英数字や漢字の単語間スペースには触らず、日本語かな・数字の連続だけをつなぐ。
  function collapseKanaSpacing(v){
    var out=S(v),prev='';
    while(prev!==out){
      prev=out;
      out=out.replace(/([ぁ-ゖァ-ヶー0-9０-９])\s+(?=[ぁ-ゖァ-ヶー0-9０-９])/g,'$1');
    }
    return out;
  }

  var KANA_CANONICAL_RULES=[
    ['広島東洋カープ',['ひろしまとうようかーぷ','ひろしまとうようかあぷ']],
    ['たいらの野望',['たいらのやぼう']],
    ['天下統一奇譚',['てんかとういつきたん']],
    ['天下武技大会',['てんかぶぎたいかい']],
    ['富士地下洞穴',['ふじちかどうけつ']],
    ['星海の荒石',['せいかいのあらいし']],
    ['魔導結晶',['まどうけっしょう','まどうけつしょう']],
    ['鬼神石',['きしんせき']],
    ['九十九',['つくも']],
    ['見聞録',['けんぶんろく']],
    ['七星転生',['しちせいてんせい']],
    ['鎮魂符',['ちんこんふ']],
    ['御蔵番',['おくらばん']],
    ['家臣計算機',['かしんけいさんき']],
    ['能力計算',['のうりょくけいさん']],
    ['徒党登録',['ととうとうろく']],
    ['修羅の間',['しゅらのま']],
    ['二条城',['にじょうじょう']],
    ['桶狭間',['おけはざま']],
    ['比叡山',['ひえいざん']],
    ['賤ヶ岳',['しずがたけ']],
    ['カウンター',['かうんたー','かうんたあ','かうんた']],
    ['トーナメント',['とーなめんと','となーめんと']],
    ['ルーレット',['るーれっと','るうれっと']],
    ['陣法',['じんぽう']],
    ['陣形',['じんけい']],
    ['発動因縁',['はつどういんねん']],
    ['5因縁',['ごいんねん']],['6因縁',['ろくいんねん']],['7因縁',['なないんねん','しちいんねん']],['8因縁',['はちいんねん']],['9因縁',['きゅういんねん','くいんねん']],
    ['因縁',['いんねん']],
    ['英傑',['えいけつ']],
    ['鶴翼',['かくよく']],
    ['方円',['ほうえん']],
    ['魚鱗',['ぎょりん']],
    ['衡軛',['こうやく']],
    ['全MAX込み',['ぜんまっくすこみ','ぜんまっくす込み']],
    ['全MAX',['ぜんまっくす']],
    ['込み合計',['こみごうけい']],
    ['検索結果',['けんさくけっか']],
    ['検索条件',['けんさくじょうけん']],
    ['発動中因縁',['はつどうちゅういんねん']],
    ['英傑一覧',['えいけついちらん']],
    ['因縁一覧',['いんねんいちらん']],
    ['検索結果一覧',['けんさくけっかいちらん']],
    ['配置英傑',['はいちえいけつ']],
    ['除外英傑',['じょがいえいけつ']],
    ['差替候補',['さしかえこうほ']],
    ['基礎値',['きそち']],
    ['検索基準',['けんさくきじゅん']],
    ['第一優先',['だいいちゆうせん']],
    ['第二優先',['だいにゆうせん']],
    ['第1優先',['だいいちゆうせん']],
    ['第2優先',['だいにゆうせん']],
    ['ヒット件数',['ひっとけんすう']],
    ['表示件数',['ひょうじけんすう']],
    ['並べ替え',['ならべかえ']],
    ['上に戻る',['うえにもどる']],
    ['全解除',['ぜんかいじょ']],
    ['見聞録MAX',['けんぶんろくまっくす']],
    ['鬼神石MAX',['きしんせきまっくす']],
    ['転生MAX',['てんせいまっくす']],
    ['生命',['せいめい']],
    ['気合',['きあい']],
    ['腕力',['わんりょく']],
    ['耐久力',['たいきゅうりょく']],
    ['耐久',['たいきゅう']],
    ['器用さ',['きようさ']],
    ['器用',['きよう']],
    ['知力',['ちりょく']],
    ['魅力',['みりょく']],
    ['土属性',['つちぞくせい','どぞくせい']],
    ['水属性',['みずぞくせい']],
    ['火属性',['ひぞくせい']],
    ['風属性',['かぜぞくせい']],
    ['四象',['ししょう']],
    ['総合',['そうごう']],
    ['合計',['ごうけい']],
    ['家臣',['かしん']],
    ['名付け',['なづけ','なまえつけ']],
    ['命名',['めいめい']],
    ['家族',['かぞく']],
    ['親族',['しんぞく']],
    ['奥さん',['おくさん']],
    ['配偶者',['はいぐうしゃ']],
    ['成績',['せいせき']],
    ['経歴',['けいれき']],
    ['逸話',['いつわ']],
    ['現役時代',['げんえきじだい']],
    ['現役',['げんえき']],
    ['引退',['いんたい']],
    ['年齢',['ねんれい']],
    ['現在',['げんざい']],
    ['入手方法',['にゅうしゅほうほう']],
    ['入手',['にゅうしゅ']],
    ['使い方',['つかいかた']],
    ['注意点',['ちゅういてん']],
    ['必要数',['ひつようすう']],
    ['上限',['じょうげん']],
    ['下限',['かげん']],
    ['1番',['いちばん']],['2番',['にばん']],['3番',['さんばん']],['4番',['よんばん']],['5番',['ごばん']],
    ['6番',['ろくばん']],['7番',['ななばん','しちばん']],['8番',['はちばん']],['9番',['きゅうばん','くばん']],
    ['高い',['たかい']],
    ['低い',['ひくい']],
    ['多い',['おおい']],
    ['少ない',['すくない']],
    ['検索',['けんさく']],
    ['適用',['てきよう']],
    ['解除',['かいじょ']],
    ['配置',['はいち']],
    ['除外',['じょがい']],
    ['差替',['さしかえ','さしかええ']],
    ['おすすめ',['おすすめ']],
    ['優先',['ゆうせん']],
    ['等級',['とうきゅう']],
    ['文曲',['ぶんきょく']],
    ['転生',['てんせい']],
    ['非表示',['ひひょうじ']],
    ['最小化',['さいしょうか']],
    ['再表示',['さいひょうじ']],
    ['閉じる',['とじる']],
    ['開いて',['ひらいて']],
    ['たたむ',['たたむ','おりたたむ']],
    ['説明',['せつめい']],
    ['詳しく',['くわしく']],
    ['教えて',['おしえて']],
    ['前の話',['まえのはなし']],
    ['戻って',['もどって']],
    ['両方',['りょうほう']],
    ['前者',['ぜんしゃ']],
    ['後者',['こうしゃ']],
    ['広島カープ',['ひろしまかーぷ','ひろしまかあぷ']],
    ['カープ',['かーぷ','かあぷ']],
    ['表示中',['ひょうじちゅう']],
    ['表示',['ひょうじ']],
    ['画面',['がめん']],
    ['入力欄',['にゅうりょくらん']],
    ['会話欄',['かいわらん']],
    ['チャット欄',['ちゃっとらん']],
    ['ボタン',['ぼたん']],
    ['設定',['せってい']],
    ['機能',['きのう']],
    ['項目',['こうもく']],
    ['条件',['じょうけん']],
    ['一覧',['いちらん']],
    ['詳細',['しょうさい']],
    ['数値',['すうち']],
    ['名前',['なまえ']],
    ['人物',['じんぶつ']],
    ['選手',['せんしゅ']],
    ['監督',['かんとく']],
    ['場所',['ばしょ']],
    ['候補',['こうほ']],
    ['結果',['けっか']],
    ['比較',['ひかく']],
    ['違い',['ちがい']],
    ['絞り込み',['しぼりこみ','しぼり込み']],
    ['上下限',['じょうげげん']],
    ['未満',['みまん']],
    ['保存',['ほぞん']],
    ['履歴',['りれき']],
    ['読込中',['よみこみちゅう','よみ込み中']],
    ['読み込み',['よみこみ']],
    ['実行',['じっこう']],
    ['中止',['ちゅうし']],
    ['再検索',['さいけんさく']],
    ['開く',['ひらく']],
    ['消す',['けす']],
    ['隠す',['かくす']],
    ['戻る',['もどる']],
    ['進む',['すすむ']],
    ['使う',['つかう']],
    ['因子',['いんし']],
    ['職業',['しょくぎょう']],
    ['コスト',['こすと']],
    ['固有技能',['こゆうぎのう']],
    ['技能',['ぎのう']],
    ['食料',['しょくりょう']],
    ['屋敷',['やしき']],
    ['京都',['きょうと']],
    ['駿府城',['すんぷじょう']],
    ['封印',['ふういん']],
    ['文曲除外',['ぶんきょくじょがい']],
    ['転生レベル',['てんせいれべる']]
  ];

  var KANA_PERSON_RULES=[
    ['黒田博樹',['くろだひろき']],['黒田',['くろだ']],
    ['新井貴浩',['あらいたかひろ']],['新井',['あらい']],
    ['鈴木誠也',['すずきせいや']],['誠也',['せいや']],
    ['菊池涼介',['きくちりょうすけ']],['菊池',['きくち']],
    ['丸佳浩',['まるよしひろ']],
    ['前田智徳',['まえだとものり']],['前田',['まえだ']],
    ['緒方孝市',['おがたこういち']],['緒方',['おがた']],
    ['野間峻祥',['のまたかよし']],['野間',['のま']],
    ['堂林翔太',['どうばやししょうた']],['堂林',['どうばやし']],
    ['栗林良吏',['くりばやしりょうじ']],['栗林',['くりばやし']],
    ['大瀬良大地',['おおせらだいち']],['大瀬良',['おおせら']],
    ['森下暢仁',['もりしたまさと']],['森下',['もりした']],
    ['床田寛樹',['とこだひろき']],['床田',['とこだ']],
    ['小園海斗',['こぞのかいと']],['小園',['こぞの']],
    ['坂倉将吾',['さかくらしょうご']],['坂倉',['さかくら']],
    ['秋山翔吾',['あきやましょうご']],['秋山',['あきやま']],
    ['會澤翼',['あいざわつばさ']],['會澤',['あいざわ']],
    ['江夏豊',['えなつゆたか']],['江夏',['えなつ']],
    ['衣笠祥雄',['きぬがささちお']],['衣笠',['きぬがさ']],
    ['山本浩二',['やまもとこうじ']],['浩二',['こうじ']],
    ['金本知憲',['かねもとともあき']],['金本',['かねもと']],
    ['北別府学',['きたべっぷまなぶ']],['北別府',['きたべっぷ']],
    ['達川光男',['たつかわみつお']],['達川',['たつかわ']],
    ['津田恒実',['つだつねみ']],['津田',['つだ']],
    ['佐々岡真司',['ささおかしんじ']],['佐々岡',['ささおか']],
    ['野村謙二郎',['のむらけんじろう','のむけん']],
    ['前田健太',['まえだけんた']],['田中広輔',['たなかこうすけ']],
    ['田村俊介',['たむらしゅんすけ']],['末包昇大',['すえかねしょうた']],
    ['矢野雅哉',['やのまさや']],['島内颯太郎',['しまうちそうたろう']],
    ['森浦大輔',['もりうらだいすけ']],['中村奨成',['なかむらしょうせい']],
    ['上本崇司',['うえもとたかし']],['松山竜平',['まつやまりゅうへい']],
    ['野村祐輔',['のむらゆうすけ']],['大野豊',['おおのゆたか']],
    ['古葉竹識',['こばたけし']],['高橋慶彦',['たかはしよしひこ']],
    ['外木場義郎',['そとこばよしろう']],
    ['織田信長',['おだのぶなが']],['武田信玄',['たけだしんげん']],
    ['北条氏康',['ほうじょううじやす']],['今川義元',['いまがわよしもと']],
    ['今川氏真',['いまがわうじざね']],['徳川家康',['とくがわいえやす']],
    ['羽柴秀吉',['はしばひでよし']],['豊臣秀吉',['とよとみひでよし']],
    ['斎藤道三',['さいとうどうさん']],['本願寺顕如',['ほんがんじけんにょ']],
    ['朝倉義景',['あさくらよしかげ']],['浅井長政',['あざいながまさ']],
    ['百地三太夫',['ももちさんだゆう']],['足利義輝',['あしかがよしてる']],
    ['足利義昭',['あしかがよしあき']],['三好長慶',['みよしながよし']],
    ['雑賀孫市',['さいかまごいち']],['伊達政宗',['だてまさむね']],
    ['真田昌幸',['さなだまさゆき']],['上泉信綱',['かみいずみのぶつな']],
    ['立花宗茂',['たちばなむねしげ']],['細川藤孝',['ほそかわふじたか']],
    ['黒田官兵衛',['くろだかんべえ']],['風魔小太郎',['ふうまこたろう']],
    ['小早川隆景',['こばやかわたかかげ']],['立花誾千代',['たちばなぎんちよ']],
    ['島津義弘',['しまづよしひろ']],['禅魔',['ぜんま']],['雪斎',['せっさい']]
  ];

  function compileKanaRules(rules){
    var entries=[];
    (rules||[]).forEach(function(rule,order){
      var canonical=rule[0],forms=rule[1]||[],seen={};
      forms.forEach(function(form){
        [form,kataText(form)].forEach(function(v){
          if(v&&!seen[v]){
            seen[v]=1;
            entries.push({canonical:canonical,variant:v,order:order,regex:new RegExp(escKanaRe(v),'g')});
          }
        });
      });
    });
    entries.sort(function(a,b){return b.variant.length-a.variant.length||a.order-b.order;});
    return entries;
  }

  // ゆるい読みは、同じ読みが複数の正規語へ衝突しない場合だけ登録する。
  function compileFoldedKanaRules(rules,foldFn,minLength){
    var map=Object.create(null),orderMap=Object.create(null);
    (rules||[]).forEach(function(rule,order){
      var canonical=rule[0],forms=rule[1]||[];
      forms.forEach(function(form){
        var base=hiraText(form),key=foldFn(form);
        if(!key||key.length<(minLength||4)||key===base)return;
        if(!map[key])map[key]=Object.create(null);
        map[key][canonical]=1;
        if(orderMap[key]==null||order<orderMap[key])orderMap[key]=order;
      });
    });
    var entries=[];
    Object.keys(map).forEach(function(key){
      var names=Object.keys(map[key]);
      if(names.length!==1)return;
      entries.push({canonical:names[0],variant:key,order:orderMap[key]||0,regex:new RegExp(escKanaRe(key),'g')});
    });
    entries.sort(function(a,b){return b.variant.length-a.variant.length||a.order-b.order;});
    return entries;
  }

  function compilePersonKanaRules(rules){
    return (rules||[]).map(function(rule){
      var canonical=rule[0],forms=rule[1]||[],variants=[],foldVariants=[],seen={},foldSeen={};
      forms.forEach(function(form){
        [form,kataText(form)].forEach(function(v){if(v&&!seen[v]){seen[v]=1;variants.push(v);}});
        var fv=hiraText(form);if(fv&&!foldSeen[fv]){foldSeen[fv]=1;foldVariants.push(fv);}
      });
      variants.sort(function(a,b){return b.length-a.length;});
      foldVariants.sort(function(a,b){return b.length-a.length;});
      if(!variants.length)return null;
      var prefix='(^|[\\s、。,.!！?？「」『』（）()・はがをにでとのもへハガヲニデトノモヘ])';
      var suffix='(?=$|[\\s、。,.!！?？「」『』（）()・]|(?:は|ハ|って|ッテ|の|ノ|について|ニツイテ|を|ヲ|が|ガ|も|モ|さん|サン|選手|センシュ|監督|カントク|投手|トウシュ|家族|カゾク|親族|シンゾク|奥さん|オクサン|妻|ツマ|成績|セイセキ|経歴|ケイレキ|逸話|イツワ|現役|ゲンエキ|引退|インタイ|年齢|ネンレイ|何歳|ナンサイ|カウンター|カウンタア))';
      return {
        canonical:canonical,
        regex:new RegExp(prefix+'('+variants.map(escKanaRe).join('|')+')'+suffix,'g'),
        foldRegex:foldVariants.length?new RegExp(prefix+'('+foldVariants.map(escKanaRe).join('|')+')'+suffix,'g'):null
      };
    }).filter(Boolean);
  }

  function compilePersonFoldedKanaRules(rules,foldFn,minLength){
    var map=Object.create(null);
    (rules||[]).forEach(function(rule){
      var canonical=rule[0],forms=rule[1]||[];
      forms.forEach(function(form){
        var base=hiraText(form),key=foldFn(form);
        if(!key||key.length<(minLength||4)||key===base)return;
        if(!map[key])map[key]=Object.create(null);
        map[key][canonical]=1;
      });
    });
    var unique=[];
    Object.keys(map).forEach(function(key){
      var names=Object.keys(map[key]);
      if(names.length===1)unique.push([names[0],[key]]);
    });
    return compilePersonKanaRules(unique);
  }


  // 読みの1文字だけを落として入力した場合の保守的な候補を作る。
  // 6文字以上の読み、先頭・末尾以外の欠落、かつ正規語が一つに決まる場合だけ採用する。
  // 境界付きの人物用ルールとしてコンパイルし、普通の文章中の部分一致を避ける。
  function compileOmittedKanaRules(rules,minOriginalLength,minVariantLength){
    var map=Object.create(null),minLen=minOriginalLength||6,minVariant=minVariantLength||5;
    (rules||[]).forEach(function(rule){
      var canonical=rule[0],forms=rule[1]||[];
      forms.forEach(function(form){
        var base=hiraText(form).replace(/[\s　・]/g,'');
        if(!base||base.length<minLen)return;
        for(var i=1;i<base.length;i++){
          var key=base.slice(0,i)+base.slice(i+1);
          if(key.length<minVariant)continue;
          if(!map[key])map[key]=Object.create(null);
          map[key][canonical]=1;
        }
      });
    });
    var unique=[];
    Object.keys(map).forEach(function(key){
      var names=Object.keys(map[key]);
      if(names.length===1)unique.push([names[0],[key]]);
    });
    return compilePersonKanaRules(unique);
  }

  var KANA_CANONICAL_ENTRIES=compileKanaRules(KANA_CANONICAL_RULES);
  var KANA_CANONICAL_SMALL_ENTRIES=compileFoldedKanaRules(KANA_CANONICAL_RULES,smallKanaFold,4);
  // 濁点省略は誤認しやすいため、5文字以上の専門語だけを自動登録する。
  var KANA_CANONICAL_LOOSE_ENTRIES=compileFoldedKanaRules(KANA_CANONICAL_RULES,unvoiceKanaFold,5);
  var KANA_CANONICAL_OMISSION_ENTRIES=compileOmittedKanaRules(KANA_CANONICAL_RULES,5,4);
  var KANA_PERSON_ENTRIES=compilePersonKanaRules(KANA_PERSON_RULES);
  var KANA_PERSON_SMALL_ENTRIES=compilePersonFoldedKanaRules(KANA_PERSON_RULES,smallKanaFold,4);
  var KANA_PERSON_LOOSE_ENTRIES=compilePersonFoldedKanaRules(KANA_PERSON_RULES,unvoiceKanaFold,5);
  var KANA_PERSON_OMISSION_ENTRIES=compileOmittedKanaRules(KANA_PERSON_RULES,6,5);
  var KANA_DYNAMIC_TAIRANO_ENTRIES=[];
  var KANA_DYNAMIC_TAIRANO_SMALL_ENTRIES=[];
  var KANA_DYNAMIC_TAIRANO_LOOSE_ENTRIES=[];
  var KANA_DYNAMIC_TAIRANO_OMISSION_ENTRIES=[];
  var KANA_DYNAMIC_TAIRANO_SIGNATURE='';

  // カウンター正本が遅延読込された後は、正本に登録済みの読みを自動で人物・敵名辞書へ加える。
  // 正本データ自体は変更せず、同じ読みが複数の別名を指す場合は勝手に一つへ決めない。
  function ensureDynamicTairanoKanaEntries(){
    var d=window.JINPO_TAIRANO_KNOWLEDGE_DATA;
    var facts=d&&Array.isArray(d.facts)?d.facts:[];
    var signature=facts.length?String(d.version||'')+':'+facts.length:'';
    if(signature===KANA_DYNAMIC_TAIRANO_SIGNATURE)return KANA_DYNAMIC_TAIRANO_ENTRIES;
    KANA_DYNAMIC_TAIRANO_SIGNATURE=signature;
    KANA_DYNAMIC_TAIRANO_ENTRIES=[];
    KANA_DYNAMIC_TAIRANO_SMALL_ENTRIES=[];
    KANA_DYNAMIC_TAIRANO_LOOSE_ENTRIES=[];
    KANA_DYNAMIC_TAIRANO_OMISSION_ENTRIES=[];
    if(!facts.length)return KANA_DYNAMIC_TAIRANO_ENTRIES;

    var readingMap=Object.create(null);
    facts.forEach(function(f){
      var canonical=S(f&&f.canonical||'');if(!canonical)return;
      (f.readings||[]).forEach(function(reading){
        var r=hiraText(reading).replace(/[\s　・]/g,'');
        // 2文字以下は一般語との衝突が大きいため自動登録しない。
        if(r.length<3)return;
        if(!readingMap[r])readingMap[r]=Object.create(null);
        readingMap[r][canonical]=1;
      });
    });
    var rules=[];
    Object.keys(readingMap).forEach(function(reading){
      var names=Object.keys(readingMap[reading]);
      if(names.length===1)rules.push([names[0],[reading]]);
    });
    KANA_DYNAMIC_TAIRANO_ENTRIES=compilePersonKanaRules(rules);
    KANA_DYNAMIC_TAIRANO_SMALL_ENTRIES=compilePersonFoldedKanaRules(rules,smallKanaFold,4);
    KANA_DYNAMIC_TAIRANO_LOOSE_ENTRIES=compilePersonFoldedKanaRules(rules,unvoiceKanaFold,5);
    KANA_DYNAMIC_TAIRANO_OMISSION_ENTRIES=compileOmittedKanaRules(rules,6,5);
    return KANA_DYNAMIC_TAIRANO_ENTRIES;
  }

  var TAIRANO_ENTITY_ROWS=[];
  var TAIRANO_ENTITY_SIGNATURE='';
  function dynamicTairanoEntityRows(){
    var d=window.JINPO_TAIRANO_KNOWLEDGE_DATA;
    var facts=d&&Array.isArray(d.facts)?d.facts:[];
    var signature=facts.length?String(d.version||'')+':'+facts.length:'';
    if(signature===TAIRANO_ENTITY_SIGNATURE)return TAIRANO_ENTITY_ROWS;
    TAIRANO_ENTITY_SIGNATURE=signature;
    TAIRANO_ENTITY_ROWS=[];
    if(!facts.length)return TAIRANO_ENTITY_ROWS;

    var canonicalSeen=Object.create(null),aliasMap=Object.create(null),readingMap=Object.create(null);
    facts.forEach(function(f){
      var canonical=S(f&&f.canonical||'');if(!canonical)return;
      if(!canonicalSeen[canonical]){
        canonicalSeen[canonical]=1;
        TAIRANO_ENTITY_ROWS.push({canonical:canonical,form:canonical,reading:'',score:119});
      }
      (f.aliases||[]).forEach(function(alias){
        var a=S(alias);if(!a||a===canonical||a.length<2)return;
        if(!aliasMap[a])aliasMap[a]=Object.create(null);
        aliasMap[a][canonical]=1;
      });
      (f.readings||[]).forEach(function(reading){
        var r=hiraText(reading).replace(/[\s　・]/g,'');if(r.length<3)return;
        if(!readingMap[r])readingMap[r]=Object.create(null);
        readingMap[r][canonical]=1;
      });
    });
    Object.keys(aliasMap).forEach(function(alias){
      var names=Object.keys(aliasMap[alias]);
      if(names.length===1)TAIRANO_ENTITY_ROWS.push({canonical:names[0],form:alias,reading:'',score:114});
    });
    Object.keys(readingMap).forEach(function(reading){
      var names=Object.keys(readingMap[reading]);
      if(names.length===1)TAIRANO_ENTITY_ROWS.push({canonical:names[0],form:'',reading:reading,score:116});
    });
    TAIRANO_ENTITY_ROWS.sort(function(a,b){
      var al=(a.form||a.reading||'').length,bl=(b.form||b.reading||'').length;
      return bl-al||b.score-a.score;
    });
    return TAIRANO_ENTITY_ROWS;
  }

  function applyKanaRules(text,entries){
    var out=S(text);
    (entries||[]).forEach(function(e){
      e.regex.lastIndex=0;
      out=out.replace(e.regex,function(match,offset){
        // 正規表記の一部に短い読みが含まれていても、再正規化で文字を増やさない。
        // 例: カウンター内の「カウンタ」を再びカウンターへ広げない。
        if(out.slice(offset,offset+e.canonical.length)===e.canonical)return match;
        return e.canonical;
      });
    });
    return out;
  }

  function applyFoldedKanaRules(text,entries,foldFn){
    var out=S(text);
    (entries||[]).forEach(function(e){
      var folded=foldFn(out),matches=[],m;
      e.regex.lastIndex=0;
      while((m=e.regex.exec(folded))){
        var at=m.index;
        if(out.slice(at,at+e.canonical.length)!==e.canonical)matches.push({at:at,len:m[0].length});
        if(m[0]==='')e.regex.lastIndex++;
      }
      for(var i=matches.length-1;i>=0;i--){
        var hit=matches[i];out=out.slice(0,hit.at)+e.canonical+out.slice(hit.at+hit.len);
      }
    });
    return out;
  }

  function applyPersonKanaRules(text,entries){
    var out=S(text);
    (entries||[]).forEach(function(e){
      e.regex.lastIndex=0;
      out=out.replace(e.regex,function(_,pre){return pre+e.canonical;});

      // ひらがなとカタカナが混ざった氏名も、読みをひらがなへ畳んで照合する。
      // 例: 「アサヒナやすとも」→「朝比奈泰朝」。文字数が同じかな範囲だけを置換する。
      if(!e.foldRegex)return;
      var folded=hiraText(out),matches=[],m;
      e.foldRegex.lastIndex=0;
      while((m=e.foldRegex.exec(folded))){
        var pre=m[1]||'',name=m[2]||'',at=m.index+pre.length;
        if(name&&out.slice(at,at+e.canonical.length)!==e.canonical)matches.push({at:at,len:name.length});
        if(m[0]==='')e.foldRegex.lastIndex++;
      }
      for(var i=matches.length-1;i>=0;i--){
        var hit=matches[i];out=out.slice(0,hit.at)+e.canonical+out.slice(hit.at+hit.len);
      }
    });
    return out;
  }

  function applyPersonFoldedKanaRules(text,entries,foldFn){
    var out=S(text);
    (entries||[]).forEach(function(e){
      if(!e.foldRegex)return;
      var folded=foldFn(out),matches=[],m;
      e.foldRegex.lastIndex=0;
      while((m=e.foldRegex.exec(folded))){
        var pre=m[1]||'',name=m[2]||'',at=m.index+pre.length;
        if(name&&out.slice(at,at+e.canonical.length)!==e.canonical)matches.push({at:at,len:name.length});
        if(m[0]==='')e.foldRegex.lastIndex++;
      }
      for(var i=matches.length-1;i>=0;i--){
        var hit=matches[i];out=out.slice(0,hit.at)+e.canonical+out.slice(hit.at+hit.len);
      }
    });
    return out;
  }

  function normalizeKatakanaGrammar(text){
    var out=S(text);
    // 登録語を一つ以上正規化できた発話だけ、全カタカナ入力に残る助詞・疑問語を整える。
    // 固有名詞そのものは変えない。
    var rules=[
      [/ニツイテ/g,'について'],[/オシエテ/g,'教えて'],[/ツカイカタ/g,'使い方'],
      [/ドウヤッテ/g,'どうやって'],[/ドウ/g,'どう'],[/ナニ/g,'何'],[/ダレ/g,'誰'],[/ドコ/g,'どこ'],
      [/イチバン/g,'1番'],[/ニバン/g,'2番'],[/サンバン/g,'3番'],[/ヨンバン/g,'4番'],[/ゴバン/g,'5番'],
      [/ロクバン/g,'6番'],[/ナナバン/g,'7番'],[/ハチバン/g,'8番'],[/キュウバン/g,'9番'],[/バンメ/g,'番目'],[/バン/g,'番'],
      [/タカイ/g,'高い'],[/タカメ/g,'高め'],[/ツヨイ/g,'強い'],
      [/モドッテ/g,'戻って'],[/ヒライテ/g,'開いて'],[/シテ/g,'して'],[/ッテ/g,'って'],
      [/ノ/g,'の'],[/ハ/g,'は'],[/ヲ/g,'を'],[/ニ/g,'に'],[/デ/g,'で'],[/ト/g,'と'],[/ガ/g,'が'],[/モ/g,'も'],[/ヘ/g,'へ']
    ];
    rules.forEach(function(r){out=out.replace(r[0],r[1]);});
    return out;
  }

  function normalizeNumericKanaForms(text){
    var out=S(text);
    // 数字の直後にある上下限だけを変換する。「いかが」「異常」などは触らない。
    out=out.replace(/([0-9０-９]+)\s*(?:いじょう|イジョウ)/g,'$1以上');
    out=out.replace(/([0-9０-９]+)\s*(?:いか|イカ)(?=$|[\s、。,.!！?？「」『』（）()・]|(?:で|に|を|かつ|または))/g,'$1以下');

    // 順位の読みは、助詞・文末が続く時だけ数字の「位」へ変換する。
    // 「そこにいる」の「にい」など、普通の文章中は変換しない。
    var rankMap={いち:'1',イチ:'1',に:'2',ニ:'2',さん:'3',サン:'3',よん:'4',ヨン:'4',ご:'5',ゴ:'5',ろく:'6',ロク:'6',なな:'7',ナナ:'7',しち:'7',シチ:'7',はち:'8',ハチ:'8',きゅう:'9',キュウ:'9',く:'9',ク:'9'};
    out=out.replace(/(^|[\s、。,.!！?？「」『』（）()・のノはハをヲにニでデとト])(?:いち|イチ|に|ニ|さん|サン|よん|ヨン|ご|ゴ|ろく|ロク|なな|ナナ|しち|シチ|はち|ハチ|きゅう|キュウ|く|ク)[いイ](?=$|[\s、。,.!！?？「」『』（）()・]|(?:を|ヲ|の|ノ|じゃ|では|に|ニ|まで|から|で|デ))/g,function(match,pre){
      var body=match.slice(pre.length,-1);return pre+(rankMap[body]||body)+'位';
    });
    return out;
  }

  var KANA_NORMALIZE_CACHE=Object.create(null),KANA_NORMALIZE_KEYS=[],KANA_NORMALIZE_CACHE_MAX=1200;
  function cachedKanaResult(original){
    if(!Object.prototype.hasOwnProperty.call(KANA_NORMALIZE_CACHE,original))return null;
    return KANA_NORMALIZE_CACHE[original];
  }
  function storeKanaResult(original,text){
    if(!Object.prototype.hasOwnProperty.call(KANA_NORMALIZE_CACHE,original)){
      KANA_NORMALIZE_KEYS.push(original);
      if(KANA_NORMALIZE_KEYS.length>KANA_NORMALIZE_CACHE_MAX){
        var old=KANA_NORMALIZE_KEYS.shift();delete KANA_NORMALIZE_CACHE[old];
      }
    }
    KANA_NORMALIZE_CACHE[original]=text;
  }

  function normalizeKanaInput(v){
    var original=S(v),dynamicEntries=ensureDynamicTairanoKanaEntries();
    var cacheKey=original+'\u0001'+KANA_DYNAMIC_TAIRANO_SIGNATURE;
    var cached=cachedKanaResult(cacheKey);
    if(cached!==null)return {text:cached,changed:cached!==original,original:original};
    var text=collapseKanaSpacing(original);
    var h=hiraText(text);
    var personContext=/(?:かーぷ|かあぷ|ひろしま|せんしゅ|かぞく|しんぞく|おくさん|せいせき|けいれき|いつわ|げんえき|いんたい|なんさい|ねんれい|かうんた|てんか|しゅら|にじょう|おけはざま|ふういん)/.test(h) ||
      /^[ぁ-ゖァ-ヶー]{2,24}(?:は|って|の|について|をおしえて|おしえて|です|だよ|かな|か|[？?！!。])*$/.test(text);

    // 人物・敵名の長い読みを先に確定する。
    // 「きようらんこんごう」の先頭を能力の「器用」と部分変換しないため。
    if(personContext){
      text=applyPersonKanaRules(text,KANA_PERSON_ENTRIES.concat(dynamicEntries));
      text=applyPersonFoldedKanaRules(text,KANA_PERSON_SMALL_ENTRIES.concat(KANA_DYNAMIC_TAIRANO_SMALL_ENTRIES),smallKanaFold);
      text=applyPersonFoldedKanaRules(text,KANA_PERSON_LOOSE_ENTRIES.concat(KANA_DYNAMIC_TAIRANO_LOOSE_ENTRIES),unvoiceKanaFold);
      text=applyPersonKanaRules(text,KANA_PERSON_OMISSION_ENTRIES.concat(KANA_DYNAMIC_TAIRANO_OMISSION_ENTRIES));
    }

    // 1文字抜けの長い専門語を、短い部分語へ先に分解される前に戻す。
    text=applyPersonKanaRules(text,KANA_CANONICAL_OMISSION_ENTRIES);

    // 長い一般語のゆれを先に戻し、その後で通常の短い登録語を補う。
    // 例: 「けんさくけつか」を先に「検索結果」へ戻し、「検索」だけの部分変換を防ぐ。
    text=applyFoldedKanaRules(text,KANA_CANONICAL_SMALL_ENTRIES,smallKanaFold);
    text=applyFoldedKanaRules(text,KANA_CANONICAL_LOOSE_ENTRIES,unvoiceKanaFold);
    text=applyKanaRules(text,KANA_CANONICAL_ENTRIES);
    text=normalizeNumericKanaForms(text);
    if(text!==original&&/[ァ-ヶ]/.test(text))text=normalizeKatakanaGrammar(text);
    text=normalizeNumericKanaForms(text);
    storeKanaResult(cacheKey,text);
    return {text:text,changed:text!==original,original:original};
  }

  // 入力途中で送信された短い断片を保守的に検出する。
  // 「黒田の」「明日は」「全MAXで」のように助詞で終わり、述語がまだ無い形だけを対象にする。
  // 「それで」「ところで」など、それ自体が会話接続として成立する語は断片扱いしない。
  function isOpenUserFragment(text){
    var t=S(text);
    if(!t||t.length>34||/[？?！!。]/.test(t))return false;
    if(/^(?:それで|で|そんで|ほんで|それから|あと|ちなみに|そういえば|ところで|でも|ただ|けど|とはいえ|まあ|今日はここまで|きょうはここまで|ここまで|一旦ここまで|いったんここまで)$/.test(t))return false;
    if(/^(?:うん|はい|いや|了解|わかった|分かった|なるほど|そっか|そうなんだ|マジ|まじ|こんにちは|こんにちわ|こんばんは|こんばんわ|おはよう|おはよ|やあ|やっほ|やっほー)$/.test(t))return false;
    // 「もっと」は末尾が「と」でも助詞ではなく、それ自体で成立する追質問。
    // 「その話もっと」も同様に、次の入力と「…と家族に戻って」のように誤連結しない。
    if(/^(?:(?:その|この|今の|さっきの|前の)話[、,\s]*)?(?:もっと|もう少し|詳しく|くわしく)$/.test(t))return false;
    // 「前のは／その前のは」は助詞「は」で終わるが、それ自体で成立する談話参照。
    // 分割発話の断片として次の「家族は？」等へ連結しない。
    if(/^(?:前のは|その前のは|前のやつ|その前のやつ|さっきのやつ|例のやつ|あの話|例の話)[？?！!。]*$/.test(t))return false;
    if(isFollowupOnlyUtterance(t))return false;
    // 「について」は単独でも話題指定として成立しやすいので、断片にはしない。
    if(/について$/.test(t))return false;
    return /(?:の|は|が|を|に|へ|で|と|から|まで|より)$/.test(t);
  }

  function previousOpenUserFragment(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),parts=[],lastIndex=-1,userSeen=0;
    for(var i=h.length-1;i>=0&&userSeen<4;i--){
      var x=h[i];if(!x||x.role!=='user')continue;
      userSeen++;
      var t=S(x.text);if(!t)continue;
      if(!isOpenUserFragment(t))break;
      parts.unshift(t);lastIndex=i;
    }
    if(!parts.length)return null;
    return {text:parts.join(''),parts:parts,index:lastIndex};
  }

  // 2回に分かれて送られた一つの発話をつなぐ。
  // 例: 「黒田の」→「家族について」 / 「全MAXで」→「腕力高いの」
  function isFragmentCancelCue(text){
    var t=S(text);
    return /^(?:やっぱ(?:り)?(?:いいや|やめ(?:る|とく|ておく)?)|もういい(?:や)?|いいや|やめ(?:る|とく|ておく)?|今のなし|今の無し|なしで|ナシで|忘れて|気にしない|気にしなくていい)[。！!？?\s]*$/.test(t);
  }

  // 分割発話の途中で観点だけ言い直した時は、古い観点を捨てて主題だけ残す。
  // 例: 「黒田の」→「家族の」→「いや成績」 = 「黒田の成績について」。
  function repairOpenFragmentCorrection(text,history){
    var t=S(text),m=t.match(/^(?:いや|違う|ちがう|やっぱ(?:り)?|訂正(?:すると)?)[、,。:\s]*(家族|親族|成績|逸話|昔話|歴史|経歴|現在|現役時代|順位|日程|結果|年齢|妻|奥さん|配偶者|カウンター)(?:の話|の方|のほう)?[？?！!。]*$/);
    if(!m)return null;
    var prev=previousOpenUserFragment(history,t);if(!prev)return null;
    var aspect=S(m[1]),ents=entityCandidatesFromText(prev.text,domainFromText(prev.text)||''),vals=entityValues(ents),subject=vals.length?vals[0]:'';
    if(!subject&&prev.parts&&prev.parts.length){
      subject=S(prev.parts[0]).replace(/(?:の|は|が|を|に|へ|で|と|から|まで|より)$/,'');
    }
    if(!subject)return null;
    var normalized=aspect==='奥さん'||aspect==='配偶者'?'妻':aspect;
    return {message:subject+'の'+normalized+'について',fragment:prev.text,current:t,kind:'fragment_correction',subject:subject,aspect:normalized};
  }

  function stitchUserFragment(text,history){
    var t=S(text);
    if(!t||t.length>96||isExplicitTopicShift(t))return null;
    if(isFollowupOnlyUtterance(t))return null;
    if(/^(?:いや|違う|ちがう|訂正|ごめん|やっぱ|やっぱり)/.test(t))return null;
    if(isFragmentCancelCue(t))return null;
    var prev=previousOpenUserFragment(history,t);if(!prev)return null;
    // handle()内でresolve()が複数段通る場合、すでに連結済みの文へ同じ断片を二重付加しない。
    if(prev.text&&t.indexOf(prev.text)===0)return null;
    // 一度解決済みの完全な主題文（例: 黒田の成績について）へ、古い断片を再付加しない。
    var prevEnt=entityValues(entityCandidatesFromText(prev.text,domainFromText(prev.text)||''));
    var curEnt=entityValues(entityCandidatesFromText(t,domainFromText(t)||''));
    if(prevEnt.some(function(v){return curEnt.indexOf(v)>=0;}))return null;
    var joined=S(prev.text+t);
    if(!joined||joined===t||joined.length>128)return null;
    return {message:joined,fragment:prev.text,current:t,kind:'stitched_user_fragment'};
  }

  // 同じ発話の途中での自己訂正を処理する。
  // 「黒田の家族、いや成績を教えて」のように観点だけ直した場合は主語を保持し、
  // 「黒田じゃなくて新井」のように訂正後が十分な文なら後半を優先する。
  function inlineSelfCorrection(text){
    var t=S(text),m,left,right;
    if(!t)return {text:t,changed:false,type:'none'};

    m=t.match(/^(.{1,80}?)(?:じゃなくて|ではなくて|じゃなく|ではなく)[、,\s]*(.{1,100})$/);
    if(m){left=S(m[1]);right=S(m[2]);}
    if(!m){
      m=t.match(/^(.{1,80}?)[、,\s]+(?:いや|違う|ちがう|訂正(?:すると)?|ごめん(?:ね)?)[、,\s]*(.{1,100})$/);
      if(m){left=S(m[1]);right=S(m[2]);}
    }
    if(!m||!right)return {text:t,changed:false,type:'none'};

    var aspect=/^(家族|親族|逸話|昔話|歴史|成績|経歴|現在|順位|日程|結果|カウンター)(.*)$/;
    var am=right.match(aspect);
    if(am){
      var subject=left
        .replace(/(?:の)?(?:家族|親族|逸話|昔話|歴史|成績|経歴|現在|順位|日程|結果|カウンター).*$/,'')
        .replace(/[、,\s]+$/,'').trim();
      if(subject&&subject.length<=36&&!/(?:教えて|知りたい|調べて|検索して|どう|何|なに|誰|だれ|いつ|どこ|なぜ|なんで)$/.test(subject)){
        var tail=S(am[2]||'');
        return {text:subject+'の'+am[1]+tail,changed:true,type:'inline_aspect_correction',subject:subject,aspect:am[1]};
      }
    }
    return {text:right,changed:true,type:'inline_correction'};
  }

  function isExplicitTopicShift(text){
    var t=S(text);
    return /^(?:そういえば|ところで|それはそうと|それはそれとして|話(?:は|を)?変(?:わる|える)(?:けど|が|と)?|話題(?:は|を)?変(?:わる|える)(?:けど|が|と)?|別件(?:だけど|ですが|なんだけど|で)?|全然(?:関係ない|別の)(?:話)?(?:だけど|ですが|なんだけど)?)[、,\s]*/.test(t);
  }

  // ユーザーが実際に使っている会話テンポだけを、セッション内の軽い信号として読む。
  // 個人属性は推測せず、長さ・敬体/常体・勢いなど返答の見た目に必要な範囲だけを扱う。
  function interactionStyle(history,currentMessage){
    var h=filterHistory(history),cur=S(currentMessage),items=[];
    if(cur)items.push(cur);
    for(var i=h.length-1;i>=0&&items.length<12;i--){
      var x=h[i];if(!x||x.role!=='user')continue;
      var t=S(x.text);if(!t||t===cur&&items[0]===cur)continue;
      items.push(t);
    }
    if(!items.length)return {pace:'normal',register:'neutral',energy:'neutral',avgLength:0,samples:0,topicShift:false};
    var total=0,shortN=0,longN=0,polite=0,casual=0,lively=0,calm=0;
    items.forEach(function(t){
      var n=t.length;total+=n;if(n<=14)shortN++;if(n>=56)longN++;
      if(/(?:です|ます|ください|お願いします|でしょう|ですか|ません)(?:[。！？!?]|$)/.test(t))polite++;
      if(/(?:だね|だよ|だな|だろ|じゃん|かな|かも|だわ|だぞ|だぜ|って感じ|なんだよ)(?:[。！？!?]|$)/.test(t)||/^(?:うん|いや|まじ|マジ|そうそう|そっか|なるほど|了解|おけ|おっけ)/.test(t))casual++;
      if(/[!！]{2,}|(?:ｗ|w){2,}|笑|草|すげ|最高|やば/.test(t))lively++;
      if(/(?:ゆっくり|落ち着いて|静かに|淡々|冷静)/.test(t))calm++;
    });
    var avg=total/items.length,pace='normal';
    if(shortN/items.length>=0.6&&avg<=22)pace='terse';
    else if(longN/items.length>=0.25||(items.length>=3&&avg>=32))pace='elaborate';
    var register='neutral';
    if(polite>=Math.max(2,casual+1))register='polite';
    else if(casual>=Math.max(2,polite+1))register='casual';
    var energy='neutral';
    if(lively>=2&&lively>calm)energy='lively';
    else if(calm>=2&&calm>lively)energy='calm';
    return {pace:pace,register:register,energy:energy,avgLength:Math.round(avg),samples:items.length,topicShift:isExplicitTopicShift(cur)};
  }


  function carriedListenIntent(history,currentMessage){
    var cur=S(currentMessage);
    if(!cur||isExplicitTopicShift(cur)||/(?:まあいいや|まあいっか|ま[、,\s]*いっか|もういい|この話は終わり|話変えよう|別の話|ちょっと待って)/.test(cur))return false;
    // 明確な新しい質問・調べものは、話題転換語がなくても「聞き役継続」より現在の依頼を優先する。
    if(/[？?]/.test(cur)||/(?:教えて|知りたい|調べて|検索して|って何|ってなに|とは|誰|だれ|どこ|いつ|なぜ|なんで|どうして)/.test(cur))return false;
    var h=historyBeforeCurrent(history,cur),seen=0;
    for(var i=h.length-1;i>=0&&seen<6;i--){
      var x=h[i];if(!x||x.role!=='user')continue;
      var t=S(x.text);if(!t)continue;seen++;
      if(isExplicitTopicShift(t)||/(?:まあいいや|もういい|この話は終わり|話変えよう|別の話)/.test(t))return false;
      // 後から相談・意見要求へ切り替えた記録があれば、古い「聞いて」指定は引き継がない。
      if(/(?:どうしたら|どうすれば|どうするのがいい|アドバイス(?:して|ください|ほしい|欲しい|お願い)|一緒に考えて|どう思う|意見(?:を)?(?:聞きたい|教えて))/.test(t))return false;
      if(/(?:ただ|とりあえず)?(?:聞いて|聞いてほしい|話を聞いて|愚痴(?:を)?聞いて|吐き出したい|話したいだけ)|(?:アドバイス|助言|解決策|改善策|対処法|意見)(?:は|なんて|とか)?(?:いらない|要らない|不要|求めてない|いらん)/.test(t))return true;
    }
    return false;
  }

  // その発言で明示された「会話上どう受けてほしいか」だけを読む。
  // 心理状態や性格は推測せず、助言希望・ただ聞いてほしい・喜び共有など返答形式に必要な信号だけを返す。
  function listeningSignals(history,currentMessage){
    var t=S(currentMessage),c=C(t);
    if(!t)return {mode:'neutral',need:'respond',valence:'neutral',intensity:'normal',openness:'neutral',avoidAdvice:false,explicit:false};

    var need='respond',mode='conversation',explicit=false;
    // 「アドバイスはいらない」のような明示的な拒否は、語中の「アドバイス」に先に反応させない。
    if(/(?:ただ|とりあえず)?(?:聞いて|聞いてほしい|話を聞いて|愚痴(?:を)?聞いて|吐き出したい|話したいだけ)|(?:アドバイス|助言|解決策|改善策|対処法|意見)(?:は|なんて|とか)?(?:いらない|要らない|不要|求めてない|いらん)/.test(t)){
      need='listen';mode='listen_only';explicit=true;
    }else if(/(?:アドバイス(?:して|ください|ほしい|欲しい|ある|お願い)|助言(?:して|ください|ほしい|欲しい|お願い)|どうしたら|どうすれば|どうするのがいい|どうしよ(?:う)?(?:かな)?|相談(?:したい|乗って|に乗って)|解決(?:策|方法)(?:を)?(?:教えて|ほしい|欲しい|考えて)|改善(?:策|方法)(?:を)?(?:教えて|ほしい|欲しい|考えて)|対処(?:法|方法)(?:を)?(?:教えて|ほしい|欲しい)|手伝って|一緒に考えて|直して|修正して|原因(?:を)?(?:見て|調べて))/.test(t)){
      need='advice';mode='advice';explicit=true;
    }else if(/(?:どう思う|どう感じる|どうかな|意見(?:を)?(?:聞きたい|教えて)|率直にどう|感想(?:を)?(?:聞きたい|教えて)|(?:どっち|どちら)(?:が|の方が|のほうが)?(?:いい|良い|よさそう|良さそう|無難|見やすい|自然|おすすめ)(?:と思う)?|おすすめ(?:は|って)?|(?:それ|これ)(?:って|は)?(?:あり|アリ|なし|ナシ)(?:だと思う)?)/.test(t)||/^(?:あり|アリ|なし|ナシ)(?:かな|ですか)?[？?。！!\s]*$/.test(t)){
      need='opinion';mode='opinion_request';explicit=true;
    }

    var carriedListen=need==='respond'&&carriedListenIntent(history,t);
    if(carriedListen){need='listen';mode='listen_only';}

    var achievementPositive=/^(?:やった|やったー|やったぞ)[！!。\s]*$/.test(t)||/(?:できた|成功(?:した)?|うまくいった|勝った|当たった|完成した|通った|合格した|受かった|採用された|達成した|公開できた|リリースできた|直った)(?:んだ|んだよ|よ|ね|ぞ)?[！!。\s]*$/.test(t);
    var taskFinished=/(?:仕事|作業).*(?:終わった|終えた|片づいた|片付いた)/.test(t);
    var experiencePositive=/(?:楽しかった|面白かった|おもしろかった|いい日だった|良い日だった|うれしかった|嬉しかった)(?:んだ|んだよ|よ|ね)?[！!。\s]*$/.test(t)||/(?:面白い|おもしろい|楽しい)(?:んだ|んだよ|んだよな|んだな|よ|ね|な)?[！!。\s]*$/.test(t);
    var positive=achievementPositive||experiencePositive||/(?:うれしい|嬉しい|最高|元気)(?:なんだ|なんだよ|だよ|だ|よ|ね|ぞ)?[！!。\s]*$/.test(t)||/(?:めっちゃ|すごく|かなり).*(?:うれしい|嬉しい|楽しい|よかった|良かった)/.test(t);
    var negative=/(?:つらい|つらかった|辛い|辛かった|きつい|きつかった|しんどい|だるい|だりい|疲れた|大変だった|最悪|落ち込|へこん|困った|嫌だった|いやだった|悲しい|かなしい|うまくいかない|失敗した|怒られた|ミスした|腹立つ|むかつく|悔しい|不安|心配|迷ってる|迷っている|忙しい|バタバタ|時間ない|手が回らない|めんどくさい|面倒くさい|バグ(?:った|出た|が出た)|エラー(?:が)?出た|動かない|壊れた)/.test(t);
    var uncertain=/(?:迷ってる|迷っている|決めきれない|どうしようかな|どうしよかな|何しようかな|なにしようかな|どっちにしよう|どちらにしよう|悩んでる|悩んでいる|自信ない|よく分からない|よくわからない)/.test(t);

    var recentNegative=false;
    if(taskFinished&&/^(?:まあ[、,\s]*)?(?:でも|けど|とはいえ)/.test(t)){
      var ph=historyBeforeCurrent(history,t),pc=0;
      for(var pi=ph.length-1;pi>=0&&pc<4;pi--){
        var px=ph[pi];if(!px||px.role!=='user')continue;pc++;
        var pt=S(px.text);if(!pt)continue;
        if(isExplicitTopicShift(pt))break;
        if(/(?:つらい|辛い|きつい|しんどい|疲れた|大変|最悪|忙しい|昼飯も食べられ|食べられなく|困った|バグ|エラー|動かない)/.test(pt)){recentNegative=true;break;}
      }
    }
    var valence=positive&&!negative?'positive':negative&&!positive?'negative':positive&&negative?'mixed':recentNegative&&taskFinished?'mixed':'neutral';
    var infoQuestion=need==='respond'&&/[？?]/.test(t);
    if(need==='respond'&&!infoQuestion){
      if(positive&&negative||(taskFinished&&recentNegative))mode='mixed_sharing';
      else if(achievementPositive)mode='celebration';
      else if(experiencePositive||positive)mode='positive_sharing';
      else if(uncertain)mode='uncertain';
      else if(negative)mode='venting';
      else if(taskFinished)mode='sharing';
      else if(/(?:今日|昨日|きのう|さっき|この前|最近|帰ってから).*(?:した(?!い)|してた|やった|やってた|遊んでた|見てた|読んでた|行ってた|帰った|だった|あった|起きた|言われた|なった)|(?:ゲーム|動画|映画|本|漫画|アニメ|買い物|散歩|仕事|作業).*(?:した(?!い)|してた|やった|やってた|遊んでた|見た|見てた|読んでた|行ってた)|(?:したんだ|だったんだ|あったんだ|してたんだ|やったんだ|やってたんだ)(?:よ|けど|けどさ)?[。！!]*$/.test(t))mode='sharing';
      else if(/^(?:でさ|でね|それでさ|それでね|そしたら|そのあとさ|そのあとね|あとさ|それからさ|ていうかさ|というかさ)[、,\s].{2,100}$/.test(t))mode='sharing';
    }

    var intensity='normal';
    if(/[!！]{3,}|(?:めちゃくちゃ|めっちゃ|本当に|ほんとに|かなり|最悪|最高|やばい|ヤバい)/.test(t))intensity='strong';
    else if(/[!！]{1,2}|(?:ちょっと|少し|なんか)/.test(t))intensity='light';

    var openness='neutral';
    if(/(?:聞いて|話したい|ちょっといい|まだある|続きが|それでね|それでさ)/.test(t))openness='open';
    else if(/(?:まあいいや|まあいっか|ま[、,\s]*いっか|もういい|この話は終わり|それだけ|以上|話変えよう|別の話)/.test(t))openness='closed';

    return {
      mode:mode,
      need:need,
      valence:valence,
      intensity:intensity,
      openness:openness,
      avoidAdvice:need==='listen'||(need==='respond'&&(mode==='venting'||mode==='sharing'||mode==='celebration'||mode==='mixed_sharing')),
      explicit:explicit,
      carriedListen:carriedListen,
      compact:c
    };
  }

  // 短い反応が「同意」「保留」「軽い反論」「訂正」のどれかを読む。
  // 単語だけではなく、発話全体の形を見て「違いを教えて」のような通常質問を反論扱いしない。
  function conversationalStance(history,currentMessage){
    var t=S(currentMessage),c=C(t);
    if(!t)return {type:'neutral',confidence:'low',explicit:false};
    var infoRequest=/(?:教えて|知りたい|調べて|検索して|とは|って何|ってなに|違い(?:は|を)|比較|どっち|どちら|何が違)/.test(t);
    if(infoRequest&&!/^(?:いや|でも|うーん|んー|そうかな|本当かな|ほんとかな|それは違|そうじゃ)/.test(t))return {type:'neutral',confidence:'low',explicit:false};

    if(/^(?:いや[、,\s]*)?(?:違う|そうじゃない|そこじゃない|そういう意味じゃない|そういうことじゃない|言いたいのは違う|話が違う)(?:[。！!…\s]|$)/.test(t)||/^(?:いや|違う)[、,\s]+.{2,}/.test(t))
      return {type:'correction',confidence:'high',explicit:true};
    if(/^(?:いや|でも|ただ)[、,\s]*(?:それは違う|違うと思う|そうは思わない|納得できない|ちょっと違う|違う気がする|それはない|それ無い)|^(?:それは|そこは)?(?:違うと思う|そうは思わない|納得できない|ちょっと違う|違う気がする|ないと思う)|^(?:いや[、,\s]*)?それ(?:は)?(?:ない|無い)(?:[。！!…\s]|$)/.test(t))
      return {type:'disagreement',confidence:'high',explicit:true};
    if(/^(?:え[、,\s]*)?(?:(?:それは|そこは)[、,\s]*)?(?:そうかな|そうなのかな|そうなん|そうなの|本当かな|ほんとかな|本当にそう|ほんとにそう|ほんと(?:に)?|本当(?:に)?|マジ(?:で)?|まじ(?:で)?|うそでしょ|嘘でしょ|違くない|ちがくない|どうだろう|どうなんだろう|うーん|んー|微妙(?:だな|かも)?|そうとも限らない)(?:[。！!？?…\s]|$)/.test(t))
      return {type:'skepticism',confidence:/[？?]/.test(t)?'high':'medium',explicit:true};
    if(/^(?:わからんでもない|分からんでもない|わからないでもない|分からないでもない)(?:[。！!？?\s]|$)/.test(t)||/^(?:まあ|確かに|たしかに|そうだね|そうなんだけど|分かる|わかる|それはそう)(?:[^。！？!?]{0,30})?(?:けど|けれど|ただ|でも)(?:[、,\s…\.]|$)/.test(t))
      return {type:'partial_agreement',confidence:'high',explicit:true};
    if(/^(?:うん|うんうん|そうだね|そうそう|だよね|それな|ほんとそれ|本当それ|確かに|たしかに|その通り|分かる|わかる|分かるわ|わかるわ|そう思う|同感|なるほどね|たしかにね|確かにね)(?:[。！!\s]|$)/.test(t) && t.length<=36)
      return {type:'agreement',confidence:'high',explicit:true};
    return {type:'neutral',confidence:'low',explicit:false,compact:c};
  }

  // 「けど…」「でも…」のように結論を置かず発話を開いたままにしている形。
  // こちらで続きを補完せず、相手に発話権を残すための信号としてのみ使う。
  function unfinishedThoughtCue(text){
    var t=S(text);if(!t||/[？?]/.test(t))return false;
    // 「知らんけど」「別にいいけど」は、それ自体で成立する口語なので単純な言いかけ扱いにしない。
    if(/^(?:知らんけど|知らないけど|別にいいけど)[。！!\s]*$/.test(t))return false;
    if(/(?:けど|けれど|けれども|けどさ|でも|でもさ|ただ|たださ|というか|ていうか|てか|てかさ|つーか|つーかさ|なんというか|なんていうか|まあ|いやでも|いやまあ)[、,…\.\s]*$/.test(t))return true;
    if(/^なんか[、,…\.\s]*$/.test(t))return true;
    if(/(?:けどね|でもね|ただね|まあね)[…\.]+$/.test(t))return true;
    if(/(?:うーん|んー|えっと|あの)[…\.\s]*$/.test(t))return true;
    // 「それで昼飯も食べられなくて」「これがまた難しくて」のような、
    // 文法的にまだ後ろへ続く口語。単なる過去報告や命令まで広げないよう、
    // 接続語/指示語を伴う -て/-で 終止だけを保守的に拾う。
    if(/^(?:それで|で|そしたら|そのあと(?:さ|ね)?|あと(?:さ|ね)?)[、,\s]*.{2,80}(?:なくて|くて|て|で)[、,…\.\s]*$/.test(t))return true;
    if(/^(?:これ|それ)(?:が|は)[、,\s]*.{2,60}(?:なくて|くて)[、,…\.\s]*$/.test(t))return true;
    // 主語だけ置いて「会議も長くて」「仕事が忙しくて」のように接続形で止める話し方。
    // 「〜くて／〜で」は文法的に続きを要求するため、短い日常文に限って拾う。
    if(t.length<=80&&/(?:長くて|短くて|忙しくて|難しくて|むずくて|大変で|つらくて|辛くて|しんどくて|眠くて|暑くて|寒くて|楽しくて|嬉しくて|うれしくて|悔しくて|怖くて|こわくて|嫌で|いやで|面倒で|めんどくて)[、,…\.\s]*$/.test(t))return true;
    return false;
  }

  // 「冗談」「本気」「軽い皮肉の可能性」を、明示的な言葉だけから保守的に読む。
  // 皮肉は断定せず possible_irony として返し、文字通りの称賛へ決め打ちしないためにだけ使う。
  function pragmaticTone(history,currentMessage){
    var t=S(currentMessage),c=C(t);
    if(!t)return {type:'neutral',confidence:'low',explicit:false};

    if(/(?:冗談じゃなく|冗談じゃない|冗談抜き(?:で(?:本気|真面目(?:に)?|まじめ(?:に)?)?)?|ふざけ(?:て)?ない|本気で|本気なんだけど|マジで(?:相談|困|聞|言)|真面目に|まじめに)(?:[、,。！!？?…\s]|$)/.test(t))
      return {type:'serious',confidence:'high',explicit:true};
    if(/(?:って(?:いう|の)は冗談|冗談(?:だよ|です|だけど|だけね|だから)|なんちゃって|うそうそ|ウソウソ|嘘嘘|ジョーク(?:だよ|です)?)(?:[、,。！!…\s]|$)/.test(t))
      return {type:'joke',confidence:'high',explicit:true};
    if(/(?:皮肉(?:だよ|です|だから)|[（(]\s*棒\s*[）)]|棒読み|はいはい[、,\s]*(?:さすが|最高|すごい)|(?:最高|ありがたい|助かる|さすが)(?:だね|ですね|だな)?[、,。.!！\s]*(?:また|なのに|バグ|エラー|失敗|落ち|動かない|最悪))/.test(t))
      return {type:'possible_irony',confidence:/[（(]\s*棒/.test(t)?'high':'medium',explicit:/[（(]\s*棒|棒読み/.test(t)};
    if(/(?:www+|ｗｗ+|草(?:$|[。！!\s])|[（(]?笑[）)]?\s*$)/i.test(t)&&t.length<=80)
      return {type:'playful',confidence:'low',explicit:false};
    return {type:'neutral',confidence:'low',explicit:false,compact:c};
  }


  // 冗談へどの程度「冗談で返すか」を会話の勢いから決める。
  // 冗談を検出したからといって毎回大きくボケ返さず、真面目・皮肉・聞き役では抑える。
  function humorResponsePolicy(history,currentMessage){
    var t=S(currentMessage),tone=pragmaticTone(history,t),style=interactionStyle(history,t),listen=listeningSignals(history,t);
    var h=historyBeforeCurrent(history,t),recentPlayful=0,seen=0;
    for(var i=h.length-1;i>=0&&seen<5;i--){
      var x=h[i];if(!x||x.role!=='assistant')continue;seen++;
      if(/(?:ふふ|冗談|なんちゃって|ボケ|ツッコミ|笑|ｗ|w{2,}|草)/i.test(S(x.text)))recentPlayful++;
    }
    if(tone.type==='serious')return {mode:'none',reason:'serious',confidence:'high'};
    if(tone.type==='possible_irony')return {mode:'ack',reason:'possible_irony',confidence:tone.confidence||'medium'};
    if(listen&&listen.need==='listen'&&(listen.valence==='negative'||listen.valence==='mixed'))return {mode:'ack',reason:'listening_first',confidence:'high'};
    if(tone.type==='joke'){
      if(recentPlayful>=2)return {mode:'light',reason:'avoid_humor_pileup',confidence:'high'};
      if(style.energy==='lively'||style.register==='casual')return {mode:'playful',reason:'explicit_joke_lively_context',confidence:'medium'};
      return {mode:'light',reason:'explicit_joke',confidence:'high'};
    }
    if(tone.type==='playful'){
      if(recentPlayful>=2)return {mode:'ack',reason:'recent_playful_replies',confidence:'medium'};
      return {mode:'light',reason:'playful_signal',confidence:'low'};
    }
    return {mode:'none',reason:'no_humor_signal',confidence:'low'};
  }

  // ユーザー自身の「考えが変わった」と、歩き巫女への「前の説明と違う」を区別する。
  // 前者は矛盾として責めず最新の発言を採用し、後者だけ正本再確認の対象にする。
  function continuitySignal(history,currentMessage){
    var t=S(currentMessage);if(!t)return {type:'none',confidence:'low'};
    if(/(?:前と違う|さっきと違う|前に言ってたのと違う|さっき言ってたのと違う|言ってること(?:が)?違う|矛盾して(?:る|ない)|どっちが正しい|どちらが正しい)/.test(t))
      return {type:'assistant_conflict',confidence:'high',latestWins:false};
    if(/(?:さっき|前に|この前)(?:は|、|そう)?[^。！？]{0,50}(?:って言った|と言った|思ってた|思っていた|言ってた|言っていた)[^。！？]{0,30}(?:けど|けれど|が)[^。！？]{0,40}(?:やっぱり|今は|今回は)/.test(t)||
       /(?:やっぱり|やっぱ)[、\s]*[^。！？]{1,60}(?:にする|がいい|と思う|好き|嫌い|違う|かな|かも|だな)(?:[。！!\s]|$)/.test(t))
      return {type:'user_revision',confidence:'high',latestWins:true};
    if(/(?:前は|以前は)[^。！？]{2,70}(?:てた|ていた|だった|してた|していた|思ってた|好きだった|嫌いだった)[^。！？]{0,35}(?:けど|が|でも)[、\s]*(?:今は|最近は|今だと|今なら)/.test(t))
      return {type:'temporal_update',confidence:'high',latestWins:true};
    return {type:'none',confidence:'low'};
  }


  // 会話履歴の中でユーザー自身が明示した予定・約束を軽量に保持する。
  // ここで扱うのは「会話上そう言った」という記録だけで、実際のリマインダー作成や実行完了を意味しない。
  function planTimePhrase(text){
    var t=S(text),m=t.match(/(?:今日(?:中)?|今夜|今晩|明日|明後日|あさって|週末|今週|来週|再来週|来月|[月火水木金土日]曜(?:日)?|\d{1,2}月\d{1,2}日|\d{1,2}日|\d{1,2}時(?:\d{1,2}分)?|あとで|後で|そのうち)/);
    return m?m[0]:'';
  }
  function isPlanRecallCue(text){
    var t=S(text);if(!t)return false;
    return /(?:前に|さっき|この前)?(?:言ってた|話してた|決めた)?(?:予定|つもり|約束)(?:は|って)?(?:何|なんだっけ|何だっけ|どうだった|どうなった|覚えてる)|(?:何|なに)(?:する|やる)(?:って)?(?:言ってた|決めてた|予定だった)(?:っけ|かな)?|(?:明日|今夜|週末|来週)(?:は)?(?:何|なに)(?:する|やる)(?:って)?(?:言ってた|決めてた)?(?:っけ|かな)?|(?:あの|その|前の)?予定(?:って|は)?(?:どうなった|終わった|済んだ|完了した|まだある|残ってる)(?:っけ|かな|の)?/.test(t);
  }
  function isPlanCancellation(text){
    var t=S(text);if(!t||/[？?]/.test(t))return false;
    return /(?:やっぱり|予定(?:を)?変更|予定変え|予定が変わ|予定なくな|キャンセル|延期).*(?:やめ|しない|延期|変更|別の日|なくな|キャンセル)|(?:明日|今夜|週末|来週).*(?:やめる|やらない|しない|延期する|変更する)|(?:^|[、,\s])[^。！？]{1,60}?(?:は|を)?(?:延期(?:する|した|にする)|キャンセル(?:する|した)|中止(?:する|した)|取りやめ(?:る|た)|やめ(?:る|た))(?:[。！!\s]|$)/.test(t);
  }
  function isGenericPlanCancellationCue(text){
    var t=S(text);
    return /^(?:(?:やっぱり|やっぱ)[、,\s]*)?(?:(?:その|あの|前の)?予定(?:は|を)?[、,\s]*)?(?:延期(?:する|した|にする)|キャンセル(?:する|した)|中止(?:する|した)|やめ(?:る|た)|取りやめ(?:る|た)|別の日にする|予定を変える)[。！!\s]*$/.test(t);
  }
  function explicitUserPlan(text){
    var t=S(text);if(!t||/[？?]/.test(t))return null;
    if(/(?:予定|日程|スケジュール|次の試合).*(?:教えて|知りたい|何|なに|いつ)/.test(t))return null;
    var strong=/(?:予定(?:だ|です|にしてる|にしている)|つもり(?:だ|です)?|ことにした|やることにした|することにした|約束(?:した|してる|している)|忘れないように(?:する|しないと))/.test(t);
    var timed=/(?:今日(?:中)?|今夜|今晩|明日|明後日|あさって|週末|今週|来週|再来週|来月|[月火水木金土日]曜(?:日)?|\d{1,2}月\d{1,2}日|\d{1,2}時|あとで|後で).{0,48}(?:する|やる|行く|見る|更新する|公開する|試す|確認する|直す|修正する|作る|送る|アップする|差し替える|差替える|休む|寝る|話す|続ける)(?:よ|ね|から|予定|つもり|ことにした|。|$)/.test(t);
    if(!strong&&!timed)return null;
    if(/^(?:カープ|試合|天気|ニュース).*(?:予定|日程)/.test(t))return null;
    return {text:t,time:planTimePhrase(t),kind:/約束/.test(t)?'commitment':'plan'};
  }
  function isPlanCompletion(text){
    var t=S(text);if(!t||/[？?]/.test(t))return false;
    return /(?:終わった|終えた|済んだ|すんだ|完了した|片付いた|片づいた|やり終えた|やってきた|できた|出来た|公開した|更新した|送った|アップした|差し替えた|差替えた)(?:よ|ね|ぞ|。|！|!|$)/.test(t);
  }
  function planActionFingerprint(text){
    var t=S(text)
      .replace(/(?:今日(?:中)?|今夜|今晩|明日|明後日|あさって|週末|今週|来週|再来週|来月|[月火水木金土日]曜(?:日)?|\d{1,2}月\d{1,2}日|\d{1,2}日|\d{1,2}時(?:\d{1,2}分)?|あとで|後で|そのうち)/g,'')
      .replace(/(?:予定(?:だ|です|にしてる|にしている)?|つもり(?:だ|です)?|ことにした|やることにした|することにした|約束(?:した|してる|している)?|忘れないように(?:する|しないと))/g,'')
      .replace(/(?:終わった|終えた|済んだ|すんだ|完了した|片付いた|片づいた|やり終えた|やってきた|できた|出来た)/g,'')
      .replace(/(?:する|やる|行く|見る|試す|確認する|直す|修正する|作る|休む|寝る|話す|続ける)$/,'')
      .replace(/[「」『』、,。.!！?？\s]/g,'');
    return t;
  }
  function planEventScore(plan,eventText){
    var a=planActionFingerprint(plan&&plan.text||''),b=planActionFingerprint(eventText||'');
    if(!a||!b)return 0;
    if(a===b)return 1;
    if(a.indexOf(b)>=0||b.indexOf(a)>=0)return Math.min(a.length,b.length)/Math.max(a.length,b.length)+0.35;
    return statementSimilarity(a,b);
  }
  function planLedger(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),list=[],start=Math.max(0,h.length-180),retracted=retractedMemoryIndexes(h,'');
    for(var i=start;i<h.length;i++){
      var x=h[i];if(!x||x.role!=='user')continue;
      var t=S(x.text);if(!t)continue;
      if(isPlanCancellation(t)){
        var tm=planTimePhrase(t),best=-1,bestScore=0;
        for(var r=list.length-1;r>=0;r--){
          if(list[r].status!=='active')continue;
          var sc=planEventScore(list[r],t)+(tm&&list[r].time===tm?1:0);
          if(sc>bestScore){bestScore=sc;best=r;}
        }
        // 対象語・時刻が十分一致した予定だけを閉じる。
        // 「ゲームはやめる」のような無関係な発言で、直近のサイト更新予定を勝手に消さない。
        if(best>=0&&bestScore>=0.34){
          list[best].status=/延期/.test(t)?'postponed':'cancelled';list[best].closedBy=t;list[best].closedIndex=i;
        }else if(isGenericPlanCancellationCue(t)){
          var active=[];for(var r2=list.length-1;r2>=0;r2--)if(list[r2].status==='active')active.push(r2);
          if(active.length===1){best=active[0];list[best].status=/延期/.test(t)?'postponed':'cancelled';list[best].closedBy=t;list[best].closedIndex=i;}
        }
        continue;
      }
      if(isPlanCompletion(t)){
        var cbest=-1,cscore=0;
        for(var cr=list.length-1;cr>=0;cr--){
          if(list[cr].status!=='active')continue;
          var cs=planEventScore(list[cr],t);if(cs>cscore){cscore=cs;cbest=cr;}
        }
        // 十分に同じ行動だと確認できた時だけ完了扱い。単なる「できた」は勝手に結び付けない。
        if(cbest>=0&&cscore>=0.34){list[cbest].status='completed';list[cbest].closedBy=t;list[cbest].closedIndex=i;}
      }
      var p=explicitUserPlan(t);if(!p||retracted[i])continue;
      p.index=i;p.at=Number(x.at||0);p.entities=entityCandidatesFromText(t,domainFromHistoryItem(x)||'');p.status='active';p.closedBy='';p.closedIndex=-1;
      var key=C(p.text),duplicate=false;
      for(var j=list.length-1;j>=0;j--){if(C(list[j].text)===key&&list[j].status==='active'){duplicate=true;break;}}
      if(!duplicate)list.push(p);
      if(list.length>12)list.shift();
    }
    return list;
  }
  function planMemory(history,currentMessage){
    return planLedger(history,currentMessage||'').filter(function(x){return x&&x.status==='active';}).slice(-8);
  }
  function recallPlan(history,currentMessage){
    var t=S(currentMessage);if(!isPlanRecallCue(t))return null;
    var statusCue=/(?:どうなった|終わった|終えた|済んだ|完了|キャンセル|延期|まだ|残って)/.test(t);
    var list=statusCue?planLedger(history,t):planMemory(history,t);if(!list.length)return {found:false,candidates:[]};
    var tm=planTimePhrase(t),hits=tm?list.filter(function(x){return x.time===tm||x.text.indexOf(tm)>=0;}):list.slice(-4);
    if(!hits.length)hits=list.slice(-4);
    // 質問中に予定本文の語があれば優先する。
    hits=hits.map(function(x){return {x:x,score:planEventScore(x,t)+(x.status==='active'?0.05:0)};}).sort(function(a,b){return b.score-a.score||b.x.index-a.x.index;}).map(function(v){return v.x;});
    if(hits.length===1)return {found:true,plan:hits[0],candidates:hits};
    var s1=planEventScore(hits[0],t),s2=planEventScore(hits[1],t);
    if(s1>=0.34&&s1>s2+0.08)return {found:true,plan:hits[0],candidates:hits};
    return {found:true,ambiguous:true,plan:hits[0],candidates:hits.slice(0,4)};
  }

  // ユーザーが「自分で明言した」現在の選択・好みだけを会話履歴から整理する。
  // 推測した性格・嗜好は入れない。更新語がある時だけ古い同種レコードを置き換え扱いにする。
  function cleanPositionValue(v){
    var x=S(v).replace(/^(?:私は|わたしは|俺は|僕は|自分は|今は|今なら|今回は|結局|やっぱり|やっぱ|正直)[、,\s]*/,'');
    if(/(?:じゃなくて|ではなく|じゃなく|よりも)/.test(x))x=S(x.split(/(?:じゃなくて|ではなく|じゃなく|よりも)/).pop());
    if(/なら/.test(x))x=S(x.split(/なら/).pop());
    return x.replace(/^(?:やっぱり|やっぱ|今は|今回は|結局)[、,\s]*/,'').replace(/[「」『』]/g,'').trim();
  }
  function positionRevisionCue(text){
    var t=S(text);return /(?:やっぱり|やっぱ|今は|今なら|今回は|結局|前は.*(?:けど|が|でも).*今は|じゃなくて|ではなく|訂正|変更|変え(?:る|た)|にし直す|考え直した)/.test(t);
  }
  function explicitUserPosition(text){
    var t=S(text),m,value='';if(!t||/[？?]/.test(t))return null;
    // 「AとBどっちが好き？」のような質問や、他人の好みを述べる文は記憶しない。
    if(/(?:どっち|どれ|何|なに).*(?:好き|好み|選ぶ|選ん|にする|決め)/.test(t))return null;
    if(/(?:らしい|みたい|と言ってた|って言ってた|そうだ)/.test(t)&&!/(?:私は|わたしは|俺は|僕は|自分は)/.test(t))return null;

    // 否定付きの好みは「反対側」と同一視しない。
    // 例: 「好きじゃない」≠「嫌い」、「嫌いじゃない」≠「好き」。
    m=t.match(/(.{1,58}?)(?:の方|のほう)?(?:が|は)(?:あまり|そんなに|そこまで)?(?:好き|好み)(?:じゃない|ではない|じゃなく|ではなく)(?:んだ|のだ|です|かな|かも)?(?:[。！!]|$)/);
    if(m){value=cleanPositionValue(m[1]);if(value)return {kind:'preference',polarity:'not_positive',value:value,text:t,revision:positionRevisionCue(t)};}
    m=t.match(/(.{1,58}?)(?:が|は)(?:嫌い|苦手)(?:じゃない|ではない|じゃなく|ではなく)(?:んだ|のだ|です|かな|かも)?(?:[。！!]|$)/);
    if(m){value=cleanPositionValue(m[1]);if(value)return {kind:'preference',polarity:'not_negative',value:value,text:t,revision:positionRevisionCue(t)};}
    m=t.match(/(.{1,58}?)(?:の方|のほう)?(?:が|は)(?:一番|いちばん)?(?:好き|好み)(?:だ|です|かな|かも|なんだ|なの)?(?:[。！!]|$)/);
    if(m){value=cleanPositionValue(m[1]);if(value)return {kind:'preference',polarity:'positive',value:value,text:t,revision:positionRevisionCue(t)};}
    m=t.match(/(.{1,58}?)(?:が|は)(?:嫌い|苦手)(?:だ|です|かな|かも|なんだ|なの)?(?:[。！!]|$)/);
    if(m){value=cleanPositionValue(m[1]);if(value)return {kind:'preference',polarity:'negative',value:value,text:t,revision:positionRevisionCue(t)};}
    m=t.match(/(.{1,64}?)(?:にする|でいく|に決めた|に決める|を選ぶ|を選んだ|を採用する|を採用した|にしようと思う|で進める)(?:[。！!]|$)/);
    if(m){value=cleanPositionValue(m[1]);if(value)return {kind:'decision',polarity:'selected',value:value,text:t,revision:positionRevisionCue(t)||/(?:決めた|採用した)/.test(t)};}
    m=t.match(/(.{1,58}?)(?:の方|のほう)?(?:が|は)(?:いい|良い)(?:と思う|かな|かも|な|です)?(?:[。！!]|$)/);
    if(m&&/(?:私は|わたしは|俺は|僕は|自分は|なら|やっぱ|今は|正直|と思う)/.test(t)){
      value=cleanPositionValue(m[1]);if(value)return {kind:'preference',polarity:'positive',value:value,text:t,revision:positionRevisionCue(t)};
    }
    return null;
  }
  function isPositionRecallCue(text){
    var t=S(text);if(!t)return false;
    // 話者が歩き巫女側だと明示されている「前にあなたが～と言った」は、
    // ユーザー本人の好み/選択記憶ではなく、歩き巫女の実発言履歴を照合する。
    if(/(?:歩き巫女|あなた|君|きみ|そっち)(?:が|は)?.{0,60}(?:言ってた|言っていた|言った|話してた|話していた|答えた)/.test(t))return false;
    // 「前に○○って言ってたよね？」は好み/選択の検索ではなく、実際の発言履歴の照合を優先する。
    if(/(?:前に|さっき|この前|以前)(?:[^。！？]{0,90})?(?:って|と)(?:言ってた|言っていた|言った|話してた|話していた|言ってたよね|言ったよね|言ってなかった)/.test(t)&&
       !/(?:好き|好み|嫌い|苦手|どっちがいい|どれがいい|にする|選ぶ|選ん|決め)/.test(t))return false;
    // 「さっき何話してたっけ？」は好み/選択の記憶ではなく、会話の話題復帰。
    if(/^(?:(?:さっき|前|この前|前回)(?:は)?[、,\s]*)?(?:何|なに)(?:を)?話してた(?:っけ|かな)|^(?:どこまで|何の話まで)話した(?:っけ|かな)/.test(t))return false;
    var recall=/(?:前に|さっき|この前|以前|前は|結局).*(?:言ってた|言った|話してた|決めてた|選んでた|好きって|好みって)|(?:どっち|どれ|何|なに).*(?:好き|好み|にする|選ぶ|選んだ|決めた).*(?:言ってた|話してた|決めてた|っけ|かな)|(?:何|なに)(?:に|を)(?:する|選ぶ|決める)(?:って)?(?:言ってた|決めてた)?(?:っけ|かな)/.test(t);
    return recall;
  }
  function positionMemory(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),records=[],start=Math.max(0,h.length-180),retracted=retractedMemoryIndexes(h,'');
    for(var i=start;i<h.length;i++){
      var x=h[i];if(!x||x.role!=='user')continue;
      var p=explicitUserPosition(x.text);if(!p||retracted[i])continue;
      p.index=i;p.at=Number(x.at||0);p.status='active';p.replacedBy=-1;
      p.domain=domainFromHistoryItem(x)||domainFromText(p.text)||'';
      p.entities=entityCandidatesFromText(p.text,p.domain||'');
      if(p.revision){
        for(var r=records.length-1;r>=0;r--){
          var old=records[r];if(!old||old.status!=='active'||old.kind!==p.kind)continue;
          // 更新の明示がある時だけ、直前の同種判断を過去扱いにする。
          old.status='replaced';old.replacedBy=i;break;
        }
      }
      records.push(p);
      if(records.length>16)records.shift();
    }
    return records;
  }
  function positionRecallPolarity(text){
    var t=S(text);if(!t)return '';
    if(/(?:好き|好み)(?:じゃない|ではない|じゃなく|ではなく)/.test(t))return 'not_positive';
    if(/(?:嫌い|苦手)(?:じゃない|ではない|じゃなく|ではなく)/.test(t))return 'not_negative';
    if(/(?:嫌い|苦手)/.test(t))return 'negative';
    if(/(?:好き|好み)/.test(t))return 'positive';
    return '';
  }

  function recallPosition(history,currentMessage){
    var t=S(currentMessage);if(!isPositionRecallCue(t))return null;
    var all=positionMemory(history,t);if(!all.length)return {found:false,candidates:[]};
    var kind=/好き|好み|嫌い|苦手|どっちがいい|どれがいい/.test(t)?'preference':(/にする|選ぶ|選ん|決め/.test(t)?'decision':'');
    var queryPolarity=kind==='preference'?positionRecallPolarity(t):'';
    var wantsPast=/(?:前は|以前は|元々|もともと)/.test(t);
    // 「前に黒田が好きって言ってた？」のように値そのものを明示している時は、
    // 現在有効な好みだけに絞らず、置き換え前の記録も含めて実際の一致を探す。
    var explicitValueMention=all.some(function(x){var v=C(x&&x.value);return v&&C(t).indexOf(v)>=0;});
    var pool=all.filter(function(x){
      if(kind&&x.kind!==kind)return false;
      if(queryPolarity&&x.kind==='preference'&&x.polarity!==queryPolarity)return false;
      return explicitValueMention?true:(wantsPast?x.status==='replaced':x.status==='active');
    });
    if(!pool.length&&wantsPast)pool=all.filter(function(x){
      return (!kind||x.kind===kind)&&(!queryPolarity||x.kind!=='preference'||x.polarity===queryPolarity);
    }).slice(0,-1);
    if(!pool.length)pool=all.filter(function(x){
      return (!kind||x.kind===kind)&&(!queryPolarity||x.kind!=='preference'||x.polarity===queryPolarity);
    });
    if(!pool.length)return {found:false,candidates:[]};

    var cueEntities=entityCandidatesFromText(t,domainFromText(t)||''),ranked=pool.map(function(x){
      var score=x.index/100000,cv=C(x.value);if(cv&&C(t).indexOf(cv)>=0)score+=20;
      (cueEntities||[]).forEach(function(e){var ev=C(e&&e.value);if(!ev)return;(x.entities||[]).forEach(function(pe){if(C(pe&&pe.value)===ev)score+=8;});});
      if(x.status==='active'&&!wantsPast)score+=2;
      return {x:x,score:score};
    }).sort(function(a,b){return b.score-a.score||b.x.index-a.x.index;});
    var top=ranked[0],second=ranked[1];
    if(second&&Math.abs(top.score-second.score)<0.01&&top.x.value!==second.x.value){
      return {found:true,ambiguous:true,position:top.x,candidates:ranked.slice(0,4).map(function(v){return v.x;})};
    }
    return {found:true,position:top.x,candidates:ranked.slice(0,4).map(function(v){return v.x;})};
  }

  function isMemoryRetractionCue(text){
    var t=S(text);if(!t)return false;
    return /^(?:今の(?:は)?なし|さっきの(?:は)?なし|今言ったの(?:は)?なし|それ(?:は|も)?覚えなくていい|それ(?:は|も)?記憶しないで|今の(?:は)?忘れて|さっきの(?:は)?忘れて|忘れといて|忘れておいて)[。！!？?]*$/.test(t)||
      /(?:その|この|さっきの)?(?:予定|約束|好み|選択|決めたこと)(?:は|を)?(?:なしにして|忘れて|覚えなくていい|記憶しないで)/.test(t);
  }
  function retractedMemoryIndexes(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),map={},lastPlan=null,lastPosition=null,userSerial=0;
    for(var i=0;i<h.length;i++){
      var x=h[i];if(!x||x.role!=='user')continue;userSerial++;
      var t=S(x.text);if(!t)continue;
      if(isMemoryRetractionCue(t)){
        var target=null,maxAge=3;
        if(/予定|約束/.test(t)){target=lastPlan;maxAge=10;}
        else if(/好み|選択|決めたこと/.test(t)){target=lastPosition;maxAge=10;}
        else{
          if(lastPlan&&lastPosition)target=lastPlan.serial>lastPosition.serial?lastPlan:lastPosition;
          else target=lastPlan||lastPosition;
        }
        if(target&&userSerial-target.serial<=maxAge)map[target.index]=true;
        continue;
      }
      var pp=explicitUserPlan(t);if(pp)lastPlan={index:i,serial:userSerial};
      var pos=explicitUserPosition(t);if(pos)lastPosition={index:i,serial:userSerial};
    }
    return map;
  }

  function statementSimilarityText(v){
    return C(v)
      /* 発言照合では「私は/歩き巫女は」など話者の自己主語は内容本体から外す。話者判定自体はroleで行う。 */
      .replace(/^(?:私は|わたしは|俺は|僕は|自分は|歩き巫女は)/,'')
      .replace(/ありません/g,'ない')
      .replace(/あります/g,'ある')
      .replace(/でした/g,'だ')
      .replace(/です/g,'')
      .replace(/ました/g,'た')
      .replace(/(?:タダ|ただで使える|無料枠)/g,'無料')
      .replace(/(?:利用できる|利用可能|使うことができる)/g,'使える')
      .replace(/(?:安心して使える|安心)/g,'安全');
  }
  function statementSimilarity(a,b){
    var x=statementSimilarityText(a),y=statementSimilarityText(b);if(!x||!y)return 0;
    if(x===y)return 1;if(x.indexOf(y)>=0||y.indexOf(x)>=0)return Math.min(x.length,y.length)/Math.max(x.length,y.length)+0.35;
    function grams(v){var o={};if(v.length<2){o[v]=1;return o;}for(var i=0;i<v.length-1;i++)o[v.slice(i,i+2)]=1;return o;}
    var gx=grams(x),gy=grams(y),inter=0,total=0,k;
    for(k in gx){total++;if(gy[k])inter++;}for(k in gy)if(!gx[k])total++;
    return total?inter/total:0;
  }
  function statementSemanticConflict(a,b){
    var x=S(a),y=S(b);if(!x||!y)return false;
    var pairs=[
      [/無料|タダ/,/有料|課金/],
      [/好き/,/(?:嫌い|苦手)/],
      [/できる|出来る|使える|利用できる/,/(?:できない|出来ない|使えない|利用できない)/],
      [/ある|あります|存在する/,/(?:ない|ありません|存在しない)/],
      [/安全|安心/,/(?:危険|危ない|安全ではない|安全じゃない)/],
      [/完了|終わった|済んだ/,/(?:未完了|終わってない|済んでない)/],
      [/投手|ピッチャー/,/(?:野手|捕手|内野手|外野手)/]
    ];
    for(var i=0;i<pairs.length;i++){
      var a1=pairs[i][0].test(x),a2=pairs[i][1].test(x),b1=pairs[i][0].test(y),b2=pairs[i][1].test(y);
      if((a1&&b2)||(a2&&b1))return true;
    }
    return false;
  }

  function statementFacetGroups(text){
    var t=S(text),groups=[];
    var defs=[
      ['free',/(?:無料|タダ|有料|課金)/],
      ['safety',/(?:安全|安心|危険|危ない)/],
      ['family',/(?:家族|親族|父|母|兄|弟|姉|妹|息子|娘|子供|子ども|妻|夫|結婚)/],
      ['stats',/(?:成績|打率|本塁打|ホームラン|打点|防御率|勝利|勝数|セーブ|ホールド|記録)/],
      ['role',/(?:投手|野手|捕手|監督|コーチ|内野手|外野手|ピッチャー)/],
      ['age',/(?:年齢|何歳|歳)/],
      ['current',/(?:現在|今は|今も|現役|引退|存命|亡くな)/],
      ['usage',/(?:使い方|使える|利用|用途|何ができる|できること)/],
      ['price',/(?:料金|価格|値段|費用)/],
      ['history',/(?:歴史|由来|創設|沿革)/],
      ['anecdote',/(?:逸話|エピソード|伝説|名場面)/],
      ['effect',/(?:効果|倍率|上限|下限|必要数|必要個数|入手方法|取り方)/]
    ];
    defs.forEach(function(d){if(d[1].test(t))groups.push(d[0]);});
    return groups;
  }
  function statementFacetCompatible(claim,candidate){
    var cg=statementFacetGroups(claim);if(!cg.length)return true;
    var tg=statementFacetGroups(candidate);
    // 「無料で使える」「安全に使える」の「使える」は補助表現。
    // 具体的な観点が同時にある時は generic usage を必須一致にしない。
    var strong=cg.filter(function(g){return g!=='usage';});
    var need=strong.length?strong:cg;
    for(var i=0;i<need.length;i++)if(tg.indexOf(need[i])<0)return false;
    return true;
  }

  // 「Firebase」と「Firestore」のように観点は同じでも対象が違う発言を
  // 過去発言の一致として扱わない。主語が明示されている時だけ保守的に照合する。
  function statementExplicitSubjects(text){
    var t=S(text),out=[],seen={};
    function add(v){
      var x=cleanEntityCandidate(v);if(!x)return;
      var c=C(x);if(!c||seen[c])return;
      if(/^(?:前|さっき|この前|以前|私|俺|僕|自分|歩き巫女|あなた|君|きみ)$/.test(x))return;
      seen[c]=1;out.push(x);
    }
    var m,re=/(?:^|[。！？\n「『])\s*([A-Za-z][A-Za-z0-9._+\-]{1,40}|[一-龠々ァ-ヶー]{2,20})(?:に?は|では|が|について|とは|って)/g;
    while((m=re.exec(t)))add(m[1]);
    // 「黒田の成績」「Firebaseの料金」のような所有・観点形。
    re=/(?:^|[。！？\n「『])\s*([A-Za-z][A-Za-z0-9._+\-]{1,40}|[一-龠々ァ-ヶー]{2,20})の(?:家族|親族|成績|経歴|逸話|歴史|料金|価格|使い方|安全性|特徴|機能|無料枠)/g;
    while((m=re.exec(t)))add(m[1]);
    return out;
  }
  function statementSubjectCompatible(claim,candidate){
    var a=statementExplicitSubjects(claim),b=statementExplicitSubjects(candidate);
    if(!a.length||!b.length)return true;
    for(var i=0;i<a.length;i++){
      var ca=C(a[i]);
      for(var j=0;j<b.length;j++){
        var cb=C(b[j]);
        if(ca===cb)return true;
        // 「黒田」↔「黒田博樹」のような省略は許可。英字製品名の前方一致は許可しない。
        if(/^[一-龠々ァ-ヶー]{2,}$/.test(a[i])&&/^[一-龠々ァ-ヶー]{2,}$/.test(b[j])&&(ca.indexOf(cb)===0||cb.indexOf(ca)===0))return true;
      }
    }
    return false;
  }

  function priorStatementReference(history,currentMessage){
    var t=S(currentMessage);if(!t)return null;
    // 「さっき何話してたっけ？」は発言内容の真偽照合ではなく、話題の再開要求。
    if(/^(?:(?:さっき|前|この前|前回)(?:は)?[、,\s]*)?(?:何|なに)(?:を)?話してた(?:っけ|かな)|^(?:どこまで|何の話まで)話した(?:っけ|かな)/.test(t))return null;
    var cue=/(?:前に|さっき|この前|以前)(?:[^。！？]{0,90})?(?:って|と)?(?:言ってた|言っていた|言った|話してた|話していた|言ってなかった|言ったよね|言ってたよね)|(?:前にも|さっきも)(?:そう|同じこと)(?:言ってた|言った)/.test(t);
    if(!cue)return null;
    var speaker='assistant';
    if(/(?:私|俺|僕|自分)(?:が|は)?.{0,40}(?:言ってた|言った|話してた)/.test(t))speaker='user';
    else if(/(?:歩き巫女|あなた|君|きみ|そっち)(?:が|は)?.{0,40}(?:言ってた|言った|話してた)/.test(t))speaker='assistant';
    var claimed='';
    var m=t.match(/(?:前に|さっき|この前|以前)(?:歩き巫女|あなた|君|きみ|私|俺|僕|自分)?(?:が|は)?[、,\s]*([^。！？]{2,90}?)(?:って|と)(?:言ってた|言っていた|言った|話してた|話していた|言ってなかった)/);
    if(m)claimed=S(m[1]).replace(/^(?:そう|同じこと)$/,'');
    var h=historyBeforeCurrent(history,t),best=null,bestScore=0;
    for(var i=h.length-1,seen=0;i>=0&&seen<80;i--){
      var x=h[i];if(!x||x.role!==speaker||!S(x.text))continue;seen++;
      var tx=S(x.text);if(!claimed){best={speaker:speaker,text:tx,index:i,score:0.5};break;}
      // 過去の質問文を、後から「そう言った」という断定記憶として扱わない。
      if(/[？?]/.test(tx))continue;
      // 「無料」と「有料」など意味が逆の内容は、文字列が似ていても一致候補にしない。
      if(statementSemanticConflict(claimed,tx))continue;
      // 「Firebase」という主題だけ同じでも、「無料」「安全」「家族」など肝心の観点が違えば同じ発言とは扱わない。
      if(!statementFacetCompatible(claimed,tx))continue;
      // 観点が同じでも、Firebase と Firestore のように対象が違えば一致させない。
      if(!statementSubjectCompatible(claimed,tx))continue;
      var sc=statementSimilarity(claimed,tx);
      if(sc>bestScore){bestScore=sc;best={speaker:speaker,text:tx,index:i,score:sc};}
    }
    var minScore=statementFacetGroups(claimed).length?0.09:0.34;
    if(best&&(!claimed||bestScore>=minScore))return {found:true,speaker:speaker,claimed:claimed,match:best.text,index:best.index,score:best.score};
    return {found:false,speaker:speaker,claimed:claimed,match:'',score:bestScore};
  }

  function isGeneralResumeCue(text){
    var t=S(text);if(!t)return false;
    return /^(?:(?:じゃあ|では|さて)[、,\s]*)?(?:前回|この前)(?:の)?(?:話|続き)(?:から|を|に|へ)?(?:続け(?:よう|て)|話(?:そう|して)|戻(?:ろう|って|る|して))?[？?！!。]*$/.test(t)||
      /^(?:(?:じゃあ|では)[、,\s]*)?さっきの続き(?:から|を|に|へ)?(?:続け(?:よう|て)|話(?:そう|して))?[？?！!。]*$/.test(t)||
      /^(?:続きから|続き(?:を)?話そう|続き(?:を)?しよう|前回どこまで話した(?:っけ|かな)?|どこまで話した(?:っけ|かな)?|(?:(?:さっき|前|この前|前回)(?:は)?[、,\s]*)?(?:何|なに)(?:を)?話してた(?:っけ|かな)?)[？?！!。]*$/.test(t);
  }

  function isConversationRecallCue(text){
    var t=S(text);if(!t)return false;
    return /^(?:前回どこまで話した(?:っけ|かな)?|どこまで話した(?:っけ|かな)?|何の話まで話した(?:っけ|かな)?|(?:(?:さっき|前|この前|前回)(?:は)?[、,\s]*)?(?:何|なに)(?:を)?話してた(?:っけ|かな)?)[？?！!。]*$/.test(t);
  }

  function recallConversationState(history,currentMessage){
    if(!isConversationRecallCue(currentMessage))return null;
    var r=restoreNaturalResume(history,currentMessage);
    if(!r||!r.restoreMessage)return {control:'recall',answer:'直前の実質的な話題をこちらでは特定できませんでした。',restoreMessage:'',domain:'',sourceText:'',resume:true};
    var aspectMap={family:'家族',anecdote:'逸話',history:'歴史',current:'現在',stats:'成績',career:'経歴',rank:'順位',schedule:'日程',result:'結果',compare:'比較',counter:'カウンター',overview:'概要'};
    var label='';
    if(r.primary&&r.primary.value)label=S(r.primary.value)+(r.aspect&&aspectMap[r.aspect]?'の'+aspectMap[r.aspect]:'');
    if(!label)label=S(r.sourceText||r.restoreMessage).replace(/[？?！!。]+$/,'');
    return {control:'recall',answer:'直前は「'+label+'」の話をしていました。',restoreMessage:r.restoreMessage,domain:r.domain||'',sourceText:r.sourceText||'',sourceIndex:r.sourceIndex,resume:true,aspect:r.aspect||'',primary:r.primary||null};
  }

  function isResumeNoise(text){
    var t=S(text);return /^(?:こんにちは|こんばんは|おはよう(?:ございます)?|ただいま|おかえり|ありがとう|ありがと|了解|わかった|分かった|またね|じゃあね|おやすみ|久しぶり|ひさしぶり)[。！!？?]*$/.test(t);
  }
  function restoreNaturalResume(history,currentMessage){
    if(!isGeneralResumeCue(currentMessage))return null;
    var h=historyBeforeCurrent(history,currentMessage||''),frames=topicFrames(h,{limit:48});
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];if(!f||!S(f.userText)||isResumeNoise(f.userText)||isFollowupOnlyUtterance(f.userText)||isBackCue(f.userText)||isTopicChangeCue(f.userText)||isGeneralResumeCue(f.userText))continue;
      if(isPlanRecallCue(f.userText))continue;
      var b=frameAsBranch(f);if(!b||!b.message)continue;
      if(f.primary||f.domain||f.aspect||S(f.userText).length>=6)return {control:'back',restoreMessage:b.message,domain:b.domain||'',sourceText:b.sourceText||'',sourceIndex:b.index,branch:true,resume:true,aspect:b.aspect||'',primary:b.primary||null};
    }
    return null;
  }

  // 「あれ」「あの件」「そっちの話」など、人物名を含まない談話指示語を具体的な会話枝へ戻す。
  // 並行話題が複数残る「そっち」は勝手に一つへ決めない。
  function rewriteTopicFollowup(subject,suffix){
    var sub=S(subject),q=S(suffix);if(!sub||!q)return'';
    q=q.replace(/^の[、,\s]*/,'').replace(/^は[、,\s]*/,'').replace(/^って[、,\s]*/,'');
    if(/^(?:何|なに|どんな)(?:が|ことが)?(?:できる|出来る)(?:の|んですか)?[？?]?$/.test(q))return sub+'について、何ができる？';
    if(/^(?:どう使う|どうやって使う|使い方(?:は|って)?)(?:の|んですか)?[？?]?$/.test(q))return sub+'の使い方は？';
    if(/^(?:使える|利用できる)(?:の|んですか)?[？?]?$/.test(q))return sub+'は使える？';
    if(/^(?:料金|値段|価格)(?:は|って)?[？?]?$/.test(q))return sub+'の料金は？';
    if(/^(?:無料|タダ)(?:なの|ですか)?[？?]?$/.test(q))return sub+'は無料で使える？';
    if(/^(?:何|なに)に使う(?:の|んですか)?[？?]?$/.test(q))return sub+'は何に使う？';
    if(/^(?:どこで使う|どこで使える)(?:の|んですか)?[？?]?$/.test(q))return sub+'はどこで使える？';
    if(/^(?:必要|必要なの|必要ですか)[？?]?$/.test(q))return sub+'は必要？';
    if(/^(?:難しい|むずかしい|簡単|かんたん)(?:の|んですか)?[？?]?$/.test(q))return sub+'は'+q.replace(/[？?]+$/,'')+'？';
    if(/^(?:安全|安全なの|安全ですか)[？?]?$/.test(q))return sub+'は安全？';
    if(/^(?:いつから|いつ頃から|いつごろから)(?:なの|ですか)?[？?]?$/.test(q))return sub+'はいつから？';
    if(/^(?:他と|ほかと)?(?:何|なに)(?:が|がどう)?違う(?:の|んですか)?[？?]?$/.test(q))return sub+'は他と何が違う？';
    if(/^(?:実際|じっさい)?(?:どう|どんな感じ)(?:なの|ですか)?[？?]?$/.test(q))return sub+'について、実際どんな感じ？';
    if(/^(?:どんな時|どんなとき|いつ)(?:に)?使う(?:の|んですか)?[？?]?$/.test(q))return sub+'はどんな時に使う？';
    if(/^(?:誰向け|だれ向け|どんな人向け|向いてる人(?:は)?|向いている人(?:は)?)(?:なの|ですか)?[？?]?$/.test(q))return sub+'はどんな人向け？';
    if(/^(?:初心者|初めての人)(?:でも)?使える(?:の|んですか)?[？?]?$/.test(q))return sub+'は初心者でも使える？';
    if(/^(?:初心者向け|初めての人向け)(?:なの|ですか)?[？?]?$/.test(q))return sub+'は初心者向け？';
    if(/^(?:実用的|実践的)(?:なの|ですか)?[？?]?$/.test(q))return sub+'は実用的？';
    if(/^(?:便利|便利なの|便利ですか)[？?]?$/.test(q))return sub+'は便利？';
    if(/^(?:有名|有名なの|有名ですか)[？?]?$/.test(q))return sub+'は有名？';
    if(/^(?:人気|人気なの|人気ですか)[？?]?$/.test(q))return sub+'は人気？';
    if(/^(?:今も|現在も)?(?:使われてる|使われている|利用されてる|利用されている)(?:の|んですか)?[？?]?$/.test(q))return sub+'は現在も使われている？';
    if(/^(?:将来性|今後|これから)(?:は|って)?[？?]?$/.test(q))return sub+'の将来性は？';
    if(/^(?:一番の|主な)?(?:利点|良い点|いい点)(?:は|って)?[？?]?$/.test(q))return sub+'の主なメリットは？';
    if(/^(?:注意点|気をつける点|気を付ける点)(?:は|って)?[？?]?$/.test(q))return sub+'の注意点は？';
    if(/^(?:代わり|代替|代替候補)(?:は|って)?[？?]?$/.test(q))return sub+'の代替候補は？';
    if(/^(?:他に|ほかに)?(?:似たの|似たもの|似てるの|似ているもの)(?:ある|はある|ってある)(?:の|んですか)?[？?]?$/.test(q))return sub+'に似たものはある？';
    if(/^(?:結局|けっきょく)おすすめ(?:なの|ですか)?[？?]?$/.test(q))return sub+'はどんな場合におすすめ？';
    if(/^(?:結局|けっきょく)?(?:使うべき|使った方がいい|使ったほうがいい|おすすめする)(?:なの|ですか)?[？?]?$/.test(q))return sub+'はどんな場合におすすめ？';
    if(/^(?:導入|設定|始めるの)(?:は)?(?:難しい|むずかしい|大変)(?:の|んですか)?[？?]?$/.test(q))return sub+'の導入は難しい？';
    if(/^(?:学ぶ|覚える|使いこなす)(?:の)?(?:は)?(?:難しい|むずかしい|大変)(?:の|んですか)?[？?]?$/.test(q))return sub+'を学ぶのは大変？';
    return'';
  }

  function resolveDiscourseDeictic(text,history){
    var t=S(text);if(!t||t.length>96)return null;
    var m=t.match(/^(?:(?:じゃあ|では|なら)[、,\s]*)?(あれ|あの件|あの話|例のやつ|例の話|この前(?:に)?言ってたやつ|この前(?:に)?話してたやつ|さっき(?:に)?言ってたやつ|さっき(?:に)?話してたやつ|前に言ってたやつ|前に話してたやつ|さっきのやつ|前のやつ|前のは|その前のやつ|その前のは|こっち|こっちの話|そっち|そっちの話|あっち|あっちの話)(.*)$/);
    if(!m)return null;
    var head=m[1],suffix=S(m[2]||''),h=historyBeforeCurrent(history,t),branches=recentTopicBranches(h,t);

    // 「そっち/あっち」は、明示的な並行話題があればその候補を使う。
    // 並行指定がなくても直近に複数の異なる枝がある時は、勝手に一つへ決めない。
    if(/^(?:そっち|あっち)/.test(head)){
      var ps=parallelTopics(h,t);
      if(ps.length>1)return {ambiguous:true,candidates:ps.map(function(x){return x.subject||x.message;}).filter(Boolean).slice(0,4),kind:'parallel_deictic'};
      if(branches.length>1){
        var alt=[],seenAlt={};
        branches.slice(0,4).forEach(function(x){
          var label=x.message||x.sourceText;if(!label||seenAlt[label])return;seenAlt[label]=1;alt.push(label);
        });
        if(alt.length>1)return {ambiguous:true,candidates:alt.slice(0,4),kind:'discourse_deictic'};
      }
    }

    if(!branches.length)return null;
    var depth=0;
    // 「前の」は現在の具体的な枝から一つ前、「その前」はさらに一つ前。
    // 既存の「前の話に戻ろう」と同じ深さ規則にそろえる。
    if(/^(?:前のやつ|前のは)$/.test(head))depth=1;
    else if(/^(?:その前のやつ|その前のは)$/.test(head))depth=2;
    // 「この前言ってたやつ」「さっき言ってたやつ」「例の話」は最後の実質的な枝を指す。
    if(branches.length===1&&depth>0)return null;
    // 「その前」を指定したが履歴がそこまで深くない場合は、無関係な別話題へ落とさず
    // 現在見えている最古の具体的な枝で止める。restorePreviousTopic() と同じ境界にそろえる。
    if(branches.length<=depth)depth=branches.length-1;
    var b=branches[depth],defaultRef=!suffix||/^(?:は|って)?[？?！!。]*$/.test(suffix);
    if(defaultRef)suffix='について';
    var base=b.message||b.sourceText;
    if(!base)return null;

    // 「あれの家族」のように新しい観点を明示した時だけ主役へ戻す。
    // 単なる「あれは？」「前のやつは？」では、黒田×家族のような枝を丸ごと保持する。
    if(/^の/.test(suffix)&&b.primary&&b.primary.value)base=b.primary.value;
    else suffix=suffix.replace(/^は[、,\s]*/,'');
    if(defaultRef)return {message:base,reference:b.primary||null,branch:b,kind:'discourse_deictic'};
    var topicSubject=b.primary&&b.primary.type==='topic'?b.primary.value:(/について$/.test(base)?base.replace(/について$/,''):'');
    var topicRewrite=topicSubject?rewriteTopicFollowup(topicSubject,suffix):'';
    if(topicRewrite)return {message:topicRewrite,reference:b.primary||null,branch:b,kind:'discourse_deictic'};
    return {message:base+(suffix==='について'?'':(/^の|^について/.test(suffix)?suffix:('、'+suffix))),reference:b.primary||null,branch:b,kind:'discourse_deictic'};
  }

  // 「続きは後で話す」「もう一つあるけど後で」のような、ユーザー自身が置いた会話の伏線。
  // 内容を推測せず、どの会話枝に紐づいた未回収メモかだけを保持する。
  function isConversationHookCue(text){
    var t=S(text);if(!t)return false;
    return /(?:この話には|この件には|それには)?(?:まだ)?(?:続き|もう一つ|もうひとつ|別の話|話したいこと)(?:が)?(?:ある|あって).*(?:あとで|後で)|(?:あとで|後で)(?:話す|話したい|言う|教える|続き(?:を)?話す)|(?:続きは|もう一つは|もうひとつは)(?:あとで|後で)/.test(t);
  }
  function isResumeHookCue(text){
    var t=S(text);if(!t)return false;
    return /^(?:(?:じゃあ|では|そういえば)[、,\s]*)?(?:さっき|前に|この前)(?:言ってた|言っていた|話してた|話していた)?(?:続き|もう一つ|もうひとつ|件|やつ|話)(?:に|へ)?(?:戻(?:ろう|って|る|して)|続け(?:よう|て)|話(?:そう|して))?[？?！!。]*$/.test(t)||
      /^(?:さっきの|前の)(?:続き|もう一つ|もうひとつ)(?:に|へ)?戻(?:ろう|って|る|して)[？?！!。]*$/.test(t);
  }
  function conversationHooks(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),frames=topicFrames(h,{limit:64}),stack=[];
    for(var i=0;i<frames.length;i++){
      var f=frames[i];if(!f||!S(f.userText))continue;
      var t=S(f.userText);
      if(isResumeHookCue(t)){if(stack.length)stack.pop();continue;}
      if(!isConversationHookCue(t))continue;
      var target=null;
      if(f.primary&&f.primary.value)target=frameAsBranch(f);
      if(!target){
        for(var j=i-1;j>=0;j--){if(frames[j]&&S(frames[j].userText)&&!isFollowupOnlyUtterance(frames[j].userText)&&!isBackCue(frames[j].userText)&&!isTopicChangeCue(frames[j].userText)){target=frameAsBranch(frames[j]);break;}}
      }
      stack.push({sourceText:t,message:target&&target.message||'',domain:target&&target.domain||'',aspect:target&&target.aspect||'',primary:target&&target.primary||null,index:f.index});
      if(stack.length>5)stack.shift();
    }
    return stack;
  }
  function restoreConversationHook(history,currentMessage){
    var list=conversationHooks(history,currentMessage||'');if(!list.length)return null;
    var x=list[list.length-1];
    return {control:'back',restoreMessage:x.message||x.sourceText,domain:x.domain||'',sourceText:x.sourceText||'',sourceIndex:x.index,branch:true,hook:true,aspect:x.aspect||'',primary:x.primary||null};
  }

  function isParallelCue(text){
    var t=S(text);if(!t)return false;
    return /(?:両方|両方とも|どっちも|どちらも|それぞれ|並行(?:して)?|交互に).*(?:気になる|知りたい|話したい|進めたい|見たい|覚えて|追いたい)|(?:気になる|知りたい|話したい|進めたい).*(?:両方|どっちも|どちらも|それぞれ|並行)/.test(t);
  }
  function parallelResumeParts(text){
    var t=S(text),m;if(!t)return null;
    m=t.match(/^(?:(?:じゃあ|では)[、,\s]*)?(?:前者|最初の方|最初のほう|一つ目|1つ目)(?:の)?(?:話|方|ほう)?(?:は|に|へ)?[、,\s]*(.*)$/);
    if(m)return {suffix:S(m[1]||''),kind:'first'};
    m=t.match(/^(?:(?:じゃあ|では)[、,\s]*)?(?:後者|後の方|後のほう|二つ目|2つ目)(?:の)?(?:話|方|ほう)?(?:は|に|へ)?[、,\s]*(.*)$/);
    if(m)return {suffix:S(m[1]||''),kind:'last'};
    m=t.match(/^(?:(?:じゃあ|では)[、,\s]*)?(?:もう片方|もう一方)(?:の)?(?:話|方|ほう)?(?:は|に|へ)?[、,\s]*(.*)$/);
    if(m)return {suffix:S(m[1]||''),kind:'other'};
    m=t.match(/^(?:(?:じゃあ|では)[、,\s]*)?(?:もうひとつ|もう一つ)の話(?:は|に|へ)?[、,\s]*(.*)$/);
    if(m)return {suffix:S(m[1]||''),kind:'other'};
    m=t.match(/^(?:(?:じゃあ|では)[、,\s]*)?(?:そっち|そっちの話)(?:は|に|へ)?[、,\s]*(.*)$/);
    if(m)return {suffix:S(m[1]||''),kind:'other'};
    m=t.match(/^(?:並行してた|両方追ってた)(?:話|やつ)?(?:の)?(?:もう片方|もう一方|もうひとつ|もう一つ)(?:は|に|へ)?[、,\s]*(.*)$/);
    if(m)return {suffix:S(m[1]||''),kind:'other'};
    return null;
  }
  function parallelCorrectionResumeText(text){
    var t=S(text);if(!t||t.length>64)return'';
    var body=t,hasCorrection=false;
    var pm=body.match(/^(?:いや|違う|ちがう|そうじゃない|そうじゃなくて|そうじゃなく|それじゃない|そっちじゃない|訂正(?:すると)?|やっぱり|やっぱ)[、,\s]*(.*)$/);
    if(pm){body=S(pm[1]);hasCorrection=true;}

    // 「前者じゃなくて後者」のように両側を言った時は、否定された左側ではなく右側を採用する。
    var nm=body.match(/(?:じゃなくて|じゃなく|ではなくて|ではなく|でなくて|でなく)[、,\s]*(.+)$/);
    if(nm){body=S(nm[1]);hasCorrection=true;}
    if(!hasCorrection)return'';

    var m=body.match(/^(前者|後者|最初(?:の)?(?:方|ほう)?|前の(?:方|ほう)|一つ目|1つ目|後(?:の)?(?:方|ほう)|二つ目|2つ目|もう片方|もう一方)(.*)$/);
    if(!m)return'';
    var target=S(m[1]),suffix=S(m[2]||''),selector='';
    if(/^(?:前者|最初|最初の方|最初のほう|前の方|前のほう|一つ目|1つ目)$/.test(target))selector='前者';
    else if(/^(?:後者|後の方|後のほう|二つ目|2つ目)$/.test(target))selector='後者';
    else if(/^(?:もう片方|もう一方)$/.test(target))selector='もう片方';
    return selector?selector+suffix:'';
  }

  function isResumeParallelCue(text){
    var raw=S(text);
    // 明示的な並行話題が履歴に無ければ restoreParallelTopic 側が null を返すため、
    // ここでは自然な比較表現も入口として許可する。
    if(/^(?:二つ|2つ|両方|この二つ|この2つ)(?:の)?違い(?:は|って)?[？?]?$/.test(raw))return true;
    if(/^(?:どっち|どちら)(?:の方|のほう)?(?:が)?(?:簡単|かんたん|難しい|むずかしい|おすすめ|向いてる|向いている|便利|安全)(?:なの|ですか)?[？?]?$/.test(raw))return true;
    if(/^(?:それぞれ|両方)(?:は|の)?(?:何|なに)(?:が)?(?:得意|できる|向いてる|向いている)(?:なの|ですか)?[？?]?$/.test(raw))return true;
    var p=parallelResumeParts(raw);if(!p)return false;
    var s=S(p.suffix||'');
    if(!s)return true;
    if(/^(?:戻(?:ろう|って|る|して)|続け(?:よう|て)|どう|教えて)[？?！!。]*$/.test(s))return true;
    // 「もう片方は無料？」「そっちは安全？」のように、そのまま質問を続ける形。
    return /[？?]$/.test(s)||/(?:無料|料金|使い方|使える|安全|必要|難しい|簡単|何|なに|どう|どこ|いつ|メリット|デメリット)/.test(s);
  }
  // 明示的に「両方/並行」と言われた時だけ、同じ発言に出た複数人物を並行スロットとして保持する。
  // 一般の「AとB」を勝手に並行タスクへしない。
  function parallelTopics(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),frames=topicFrames(h,{limit:48}),latest=null;
    for(var i=0;i<frames.length;i++){
      var f=frames[i];if(!f)continue;
      if(/(?:両方|並行|この二つ|この2つ)(?:の話)?(?:は|を)?(?:もう)?(?:いい|終わり|終わろう|やめよう|閉じよう)/.test(S(f.userText))){latest=null;continue;}

      // 「黒田の家族と新井の成績を教えて」のように、1発言内で別主語・別観点を
      // 明示して尋ねた場合は、その2項目自体を前者/後者で参照できる並行スロットにする。
      // 単なる「黒田と新井」の列挙は対象外で、splitDifferentSubjectAspects()が成立した時だけ有効。
      var compoundParts=splitDifferentSubjectAspects(f.userText);
      if(compoundParts.length>=2){
        var slots=[];
        compoundParts.slice(0,4).forEach(function(part){
          var ents=entityCandidatesFromText(part,f.domain||''),vals=entityValues(ents),subject=vals.length?vals[0]:S(part).split('の')[0];
          if(!subject)return;
          var ent=(ents||[]).find(function(x){return x&&x.value===subject;})||{};
          slots.push({message:part,subject:subject,type:ent.type||'topic',domain:f.domain||'',aspect:aspectFromText(part)||'',sourceText:f.userText,index:f.index});
        });
        if(slots.length>=2){latest=slots;continue;}
      }

      // 同じ主語の複数観点も、ユーザーが1発言で明示した時だけ前者/後者の参照対象にする。
      // 例: 「黒田の家族と成績を教えて」→ 前者=家族、後者=成績。
      var coordinatedParts=splitCoordinatedAspects(f.userText);
      if(coordinatedParts.length>=2){
        var coordinatedSlots=[];
        coordinatedParts.slice(0,4).forEach(function(part){
          var ents=entityCandidatesFromText(part,f.domain||''),vals=entityValues(ents),subject=vals.length?vals[0]:S(part).split('の')[0];
          if(!subject)return;
          var ent=(ents||[]).find(function(x){return x&&x.value===subject;})||{};
          coordinatedSlots.push({message:part,subject:subject,type:ent.type||'topic',domain:f.domain||'',aspect:aspectFromText(part)||'',sourceText:f.userText,index:f.index});
        });
        if(coordinatedSlots.length>=2){latest=coordinatedSlots;continue;}
      }

      if(!isParallelCue(f.userText))continue;
      var vals=entityValues(f.userEntities),uniq=[];
      vals.forEach(function(v){if(v&&uniq.indexOf(v)<0)uniq.push(v);});
      if(uniq.length<2)continue;
      latest=uniq.slice(0,4).map(function(v){
        var ent=(f.userEntities||[]).find(function(x){return x&&x.value===v;})||{};
        return {message:v+'について',subject:v,type:ent.type||'topic',domain:f.domain||'',aspect:f.aspect||'',sourceText:f.userText,index:f.index};
      });
    }
    return latest||[];
  }
  function restoreParallelTopic(history,currentMessage){
    var list=parallelTopics(history,currentMessage||'');if(list.length<2)return null;
    var raw=S(currentMessage||''),parts=parallelResumeParts(raw),suffix=S(parts&&parts.suffix||'');

    // 明示的な並行2話題への比較質問。「両方」を宣言した履歴がある時だけ発動する。
    if(list.length===2){
      var a=list[0],b=list[1],pair=a.subject+'と'+b.subject;
      if(/^(?:二つ|2つ|両方|この二つ|この2つ)(?:の)?違い(?:は|って)?[？?]?$/.test(raw))
        return {control:'back',restoreMessage:pair+'の違いは？',domain:'',sourceText:a.sourceText||'',parallel:true,compare:true,candidates:[a.subject,b.subject]};
      if(/^(?:どっち|どちら)(?:の方|のほう)?(?:が)?(?:簡単|かんたん|難しい|むずかしい|おすすめ|向いてる|向いている|便利|安全)(?:なの|ですか)?[？?]?$/.test(raw)){
        var m=raw.match(/(?:簡単|かんたん|難しい|むずかしい|おすすめ|向いてる|向いている|便利|安全)/),facet=m?m[0]:'比較';
        return {control:'back',restoreMessage:pair+'では、どちらが'+facet+'？',domain:'',sourceText:a.sourceText||'',parallel:true,compare:true,candidates:[a.subject,b.subject]};
      }
      if(/^(?:それぞれ|両方)(?:は|の)?(?:何|なに)(?:が)?(?:得意|できる|向いてる|向いている)(?:なの|ですか)?[？?]?$/.test(raw))
        return {control:'back',restoreMessage:pair+'は、それぞれ何が得意？',domain:'',sourceText:a.sourceText||'',parallel:true,compare:true,candidates:[a.subject,b.subject]};
    }

    var recent=recentSubjects(historyBeforeCurrent(history,currentMessage||''),{limit:4}),current=recent.length?recent[0].value:'';
    var options=list.filter(function(x){return x.subject!==current;});
    if(/^[？?！!。、,\s]*$/.test(suffix))suffix='';
    if(/^(?:戻(?:ろう|って|る|して)|続け(?:よう|て)|どう|教えて)[？?！!。]*$/.test(suffix))suffix='';

    // 「前者／後者」は現在話題に関係なく、並行宣言時の並びをそのまま参照する。
    var selected=null;
    if(parts&&parts.kind==='first')selected=list[0];
    else if(parts&&parts.kind==='last')selected=list[list.length-1];
    else if(options.length===1)selected=options[0];
    if(selected){
      var msg=selected.message;
      if(suffix)msg=rewriteTopicFollowup(selected.subject,suffix)||(selected.subject+'について、'+suffix);
      return {control:'back',restoreMessage:msg,domain:selected.domain||'',sourceText:selected.sourceText||'',sourceIndex:selected.index,branch:true,parallel:true,primary:{value:selected.subject,type:selected.type||'topic'},suffix:suffix};
    }
    return {control:'back',restoreMessage:'',domain:'',sourceText:'',parallel:true,ambiguous:true,candidates:options.map(function(x){return x.subject;}).slice(0,4)};
  }

  // 「前の内容を直す」のか「同じ内容を言い換える」のか「情報を足すだけ」なのかを分ける。
  // 補足を訂正として扱って前の文脈を捨てないための会話信号。
  function utteranceRepair(history,currentMessage){
    var t=S(currentMessage);if(!t)return {type:'none',confidence:'low',preservePrevious:true};
    if(/^(?:訂正(?:すると|です|、|,)?|違う[、,\s]|いや[、,\s]*(?:違う|そうじゃなく)|言い間違えた|言い間違い|間違えた|正しくは|正確には).{1,}/.test(t)||/(?:じゃなくて|ではなくて|じゃなく|ではなく).{1,}/.test(t))
      return {type:'correction',confidence:'high',preservePrevious:false};
    if(/^(?:言い直すと|言い換えると|というより|ていうより|もう少し正確に言うと|正確に言うなら|要するに[、,]).{2,}/.test(t))
      return {type:'rephrase',confidence:'high',preservePrevious:true};
    if(/^(?:補足(?:すると|だけど|ですが)?|付け加えると|あと(?:もう一つ)?[、,]|それと[、,]|ちなみに[、,]).{2,}/.test(t))
      return {type:'supplement',confidence:'high',preservePrevious:true};
    return {type:'none',confidence:'low',preservePrevious:true};
  }

  // ユーザーがこの発言で実際に強調している「会話上の焦点」を読む。
  // 心理や本音は推測せず、質問・強調語・対比・繰り返し・発言末尾など観測できる手掛かりだけを使う。
  function focusClauses(text){
    var t=S(text).replace(/^(?:そういえば|ところで|それはそうと|それはそれとして|話(?:は|を)?変(?:わる|える)(?:けど|が|と)?|話題(?:は|を)?変(?:わる|える)(?:けど|が|と)?|別件(?:だけど|ですが|なんだけど|で)?)[、,\s]*/,'');
    if(!t)return[];
    var first=t.split(/[。！？!?\n]+/).map(S).filter(Boolean),out=[];
    first.forEach(function(part){
      var pieces=part.split(/(?:、|,)\s*(?=(?:でも|ただ|それでも|とはいえ|特に|とくに|一番|いちばん|結局|やっぱり|その中でも|それが|そこが))/).map(S).filter(Boolean);
      pieces.forEach(function(piece){
        var m=piece.match(/^(.{3,}?)(?:けど|けれども|けれど|けどさ|けどね)[、,\s]*(.{3,})$/);
        // 「黒田は好きだけど…」の末尾の三点リーダーだけを“後半主張”として切り出さない。
        if(m&&/[一-龯々ぁ-んァ-ヶA-Za-z0-9]/.test(S(m[2]))){out.push({text:S(m[1]),contrast:false});out.push({text:S(m[2]),contrast:true});}
        else out.push({text:piece,contrast:/^(?:でも|ただ|それでも|とはいえ)/.test(piece)});
      });
    });
    return out.slice(0,8);
  }

  function isVagueFocusClause(text){
    var t=S(text);
    return /^(?:それ|これ|そこ|そういうの|そういうこと)(?:が|は|も)?(?:一番|いちばん|かなり|本当に|ほんとに)?(?:きつい|きつかった|つらい|つらかった|辛い|辛かった|大変|大変だった|嫌|いや|うれしい|嬉しい|よかった|良かった|気になる|引っかかる)(?:んだ|んだよ|んだよね|んだね|ね|よ)?$/.test(t);
  }

  function conversationalFocus(history,currentMessage){
    var t=S(currentMessage),clauses=focusClauses(t),ls=listeningSignals(history,t),h=historyBeforeCurrent(history,t);
    if(!t)return {text:'',concreteText:'',reason:'none',confidence:'low',flow:'respond',askPolicy:'optional',narrativeMomentum:false};
    if(!clauses.length)clauses=[{text:t,contrast:false}];

    var recent=recentSubjects(h,{limit:4}),hasQuestion=/[？?]/.test(t)||/(?:教えて|知りたい|どう思う|どうしたら|どうすれば|何|なに|誰|だれ|どこ|いつ|なぜ|なんで|どうして|どっち)/.test(t);
    var scored=clauses.map(function(x,idx){
      var c=S(x.text),score=0,reasons=[];
      if(!c)return {text:c,score:-99,reasons:[],idx:idx,contrast:!!x.contrast};
      score+=Math.min(3,Math.max(0,c.length-3)/12);
      var cq=/[？?]/.test(c)||/(?:教えて|知りたい|どう思う|どうしたら|どうすれば|何|なに|誰|だれ|どこ|いつ|なぜ|なんで|どうして|どっち)/.test(c);
      if(cq){score+=hasQuestion?9:5;reasons.push('question');}
      else if(hasQuestion)score-=3;
      if(/(?:一番|いちばん|特に|とくに|何より|なにより|結局|やっぱり|一番言いたい|問題は|困るのは|気になるのは|引っかかるのは)/.test(c)){score+=6;reasons.push('emphasis');}
      if(x.contrast||/^(?:でも|ただ|それでも|とはいえ)/.test(c)){score+=4;reasons.push('contrast');}
      if(/(?:つらい|辛い|しんどい|疲れた|最悪|嫌|いや|困った|悔しい|不安|心配|うれしい|嬉しい|最高|楽しい|助かった|成功|できた|完成|直った|公開|リリース|バグ|エラー|動かない|手こず|苦労|びっくり|驚いた)/.test(c)){score+=3;reasons.push('concrete_reaction');}
      if(/[0-9０-９]|(?:回|個|人|時間|分|件|日|週間|ヶ月|年)/.test(c)){score+=1.5;reasons.push('detail');}
      recent.forEach(function(r){
        var a=S(r&&r.value);if(a&&c.indexOf(a)>=0){score+=2.5;reasons.push('recent_subject');}
      });
      if(idx===clauses.length-1){score+=1.5;reasons.push('latest');}
      if(/^(?:まあ|うん|いや|なんか|とりあえず)[、,\s]/.test(c))score-=1;
      if(isVagueFocusClause(c))score-=2;
      return {text:c,score:score,reasons:reasons,idx:idx,contrast:!!x.contrast};
    }).sort(function(a,b){return b.score-a.score||b.idx-a.idx;});

    var best=scored[0]||{text:t,score:0,reasons:[],idx:0},concrete=S(best.text);
    if(isVagueFocusClause(concrete)&&best.idx>0){
      var prev=clauses[best.idx-1]&&S(clauses[best.idx-1].text);
      if(prev&&prev.length>=4){
        // 「それが一番きつかった」のような指示語なら、直前節のうち最後の具体部分を焦点として使う。
        var prevParts=prev.split(/[、,]/).map(S).filter(Boolean);
        concrete=prevParts.length?prevParts[prevParts.length-1]:prev;
      }
    }
    concrete=concrete.replace(/^(?:でも|ただ|それでも|とはいえ|特に|とくに|その中でも)[、,\s]*/,'').slice(0,100);

    var stance=conversationalStance(h,t),unfinished=unfinishedThoughtCue(t);
    var connectiveOpen=/^(?:でさ|でね|それでさ|それでね|そしたら|そのあとさ|そのあとね|あとさ|それからさ)[、,\s].*(?:て|で|けど|けどさ|んだけど|なんだけど|って)[、,…\.\s]*$/.test(t);
    var narrativeMomentum=unfinished || connectiveOpen || /(?:それで|それでさ|でさ|そしたら|そのあと(?:さ|ね)?|まだ(?:あって|続きがあって)|続きがある|聞いてよ|聞いてほしい)[…。、\s]*$/.test(t) ||
      (ls.openness==='open'&&!hasQuestion&&/(?:それで|まだ|続き|話したい|聞いて)/.test(t));
    var flow='respond',askPolicy='optional';
    var currentClosed=/もういい|十分|そこまで|興味(?:は)?ない|興味なくな|気にならない|もう気にならない|知りたくない/.test(t);
    var currentEngaged=!currentClosed&&/(?:もっと|さらに|もう少し|面白い|おもしろい|興味(?:ある|がある|深い)|気になる|掘りたい|深掘り)/.test(t);
    // 「興味は薄いけど必要なので教えて」のように明示依頼がある時は、閉じる語より依頼を優先する。
    if(ls.need==='advice'||ls.need==='opinion'||hasQuestion){flow='answer';askPolicy='none';}
    else if(ls.openness==='closed'||currentClosed){flow='close';askPolicy='none';}
    else if(ls.mode==='listen_only'||narrativeMomentum){flow='yield';askPolicy='none';}
    else if(stance.type==='correction'||stance.type==='disagreement'||stance.type==='skepticism'||stance.type==='partial_agreement'){flow='respond';askPolicy='none';}
    else if(ls.mode==='venting'||ls.mode==='mixed_sharing'||ls.mode==='sharing'||ls.mode==='celebration'||ls.mode==='uncertain'){flow='reflect';askPolicy='optional';}
    else{
      var sig=conversationSignals(h);
      if(currentEngaged||(sig&&sig.engagement==='engaged'&&Number(sig.engagementAge||99)<=3)){flow='expand';askPolicy='prefer_statement';}
    }

    return {
      text:S(best.text),
      concreteText:concrete,
      reason:(best.reasons||[]).join('+')||'latest_clause',
      confidence:best.score>=8?'high':best.score>=4?'medium':'low',
      score:Math.round(best.score*10)/10,
      flow:flow,
      askPolicy:askPolicy,
      narrativeMomentum:narrativeMomentum,
      unfinishedThought:unfinished,
      stance:stance.type||'neutral',
      stanceConfidence:stance.confidence||'low',
      pragmaticTone:(pragmaticTone(h,t).type||'neutral'),
      repairType:(utteranceRepair(h,t).type||'none'),
      explicitQuestion:hasQuestion,
      listeningMode:ls.mode||'conversation'
    };
  }

  function historyBeforeCurrent(history,current){
    var h=filterHistory(history),cur=C(current);
    while(h.length&&h[h.length-1]&&h[h.length-1].role==='system')h.pop();
    if(h.length&&h[h.length-1]&&h[h.length-1].role==='user'&&C(h[h.length-1].text)===cur)h.pop();
    return h;
  }

  function recentAssistantAnswers(history,limit){
    var h=filterHistory(history),out=[],n=Number(limit)||5;
    for(var i=h.length-1;i>=0&&out.length<n;i--){
      if(!h[i]||h[i].role!=='assistant')continue;
      var t=S(h[i].text);if(t)out.push(t);
    }
    return out;
  }

  function stablePick(list,seed,history){
    if(!list||!list.length)return'';
    var recent=recentAssistantAnswers(history,5).map(C);
    var candidates=list.filter(function(x){return recent.indexOf(C(x))<0;});
    if(!candidates.length&&recent.length){
      candidates=list.filter(function(x){return C(x)!==recent[0];});
    }
    if(!candidates.length)candidates=list.slice();
    seed=S(seed);var h=0;
    for(var i=0;i<seed.length;i++)h=((h<<5)-h+seed.charCodeAt(i))|0;
    return candidates[Math.abs(h)%candidates.length];
  }

  function naturalReaction(text,history){
    var t=S(text),c=C(t);
    if(!t||t.length>24)return null;

    var kind='';
    if(/^(?:違う|それは違う|違うと思う|それは違うと思う|そうは思わない|それはそうは思わない|ちょっと違う|それはちょっと違う|違う気がする|それは違う気がする|それはない|いやそれはない)$/.test(c))kind='disagreement';
    else if(/^(?:マジ|マジで|まじ|まじで|マジか|まじか|うそでしょ|嘘でしょ|そうなん|そうなの)$/.test(c))kind='surprise_check';
    else if(/^(?:え)?(?:(?:それは|そこは))?(?:そうかな|そうなのかな|本当かな|ほんとかな|ほんと|本当|違くない|ちがくない|どうだろう|どうなんだろう|うーん|んー|微妙)$/.test(c))kind='skepticism';
    else if(/^(?:まあそうだけど|確かにそうだけど|たしかにそうだけど|そうなんだけど|分かるけど|わかるけど|わからんでもない|分からんでもない)$/.test(c))kind='partial_agreement';
    else if(/^(?:なるほど|なるほどな|そうなんだ|そうなのか|そうなんか|そうか|そっか|そうだね|だよね|それな|ほんとそれ|本当それ|わかる|分かる|わかるわ|分かるわ|そうそう|ふむ|ふむふむ|へえ|へー|ほう|確かに|たしかに|たしかにな|たしかにね|そういうことか|そういうことね|理解した|把握した)$/.test(c))kind='ack';
    else if(/^(?:いいね|それいいね|面白い|おもしろい|それ面白い|それおもしろい|それは面白い|それはおもしろい|それ面白いね|それおもしろいね|それは面白いね|それはおもしろいね|面白いね|おもしろいね|すごい|すげえ|それはすごい|そりゃすごい|そりゃ面白い|そりゃおもしろい|さすが|おお|おー|興味深い|きょうみぶかい)$/.test(c))kind='positive';
    else if(/^(?:(?:それは|それ|そこは|そりゃ))?(?:きつい|きついね|きつそう|つらい|つらいね|辛い|辛いね|しんどい|しんどいね|大変|大変だね|大変そう|ひどい|ひどいね|怖い|こわい|嫌だ|いやだ|かわいそう)$/.test(c))kind='negative_reaction';
    else if(/^(?:知らなかった|しらなかった|初めて知った|はじめて知った|そんなことあったんだ|そんなことがあったんだ|意外だね|いがいだね|意外だった|びっくり|びっくりした|驚いた|おどろいた)$/.test(c))kind='surprise';
    else if(/^(?:(?:昔|当時)は)?(?:そんなに|かなり|ずいぶん|相当)?(?:すごかった|強かった|有名だった|人気だった|活躍してた|活躍していた|大変だった|苦労した)(?:んだね|んですね|んだな|のか|んだ|んですねえ)?$/.test(c))kind='reflection';
    else if(/^(?:わかった|分かった|了解|りょうかい|おっけー|オッケー|ok)$/.test(c))kind='understood';
    if(!kind)return null;

    // 操作確認の「了解」等は会話反応で奪わない。main側でもpending時は早期雑談を止める。
    var h=historyBeforeCurrent(history,t);
    if(!h.length)return null;

    var lastAssistant='';
    for(var i=h.length-1;i>=0;i--){
      if(h[i]&&h[i].role==='assistant'&&S(h[i].text)){lastAssistant=S(h[i].text);break;}
    }
    if(!lastAssistant)return null;

    var rx=immediateReactionContext(h),domain=rx.domain||'',label='';
    if(domain==='carp')label='カープ';
    else if(domain==='counter')label='カウンター';
    else if(domain==='jinpo')label='陣法';
    else if(domain==='weather')label='天気';
    else if(domain==='kashin_name')label='家臣名付け';
    else if(domain==='tsukumo')label='九十九';
    else if(domain==='kishin')label='鬼神石';
    else if(domain==='madou')label='魔導結晶';

    var subject='',personAmbiguous=false;
    try{
      var reactionHistory=rx&&rx.history&&rx.history.length?rx.history:h;
      var personRef=findRecentEntity(reactionHistory,{personOnly:true});
      personAmbiguous=!!(personRef&&personRef.ambiguous);
      if(personRef&&!personRef.ambiguous&&personRef.value)subject=personRef.value;
      // 同じ返答に人物が複数いる時は、感想だけから誰か一人を勝手に選ばない。
      if(!subject&&!personAmbiguous){
        var entityRef=findRecentEntity(reactionHistory);
        if(entityRef&&!entityRef.ambiguous&&entityRef.value)subject=entityRef.value;
      }
    }catch(subjectErr){}

    var seed=t+'|'+lastAssistant.slice(0,120)+'|'+domain+'|'+subject;
    var answers;
    var domainAck={
      carp:[
        'そうなんですよ。カープの話は、選手や時代をたどっていくとどんどんつながってくるのです。',
        'そうなんですよ。カープは昔の話まで掘っていくと、いろいろつながって面白いのです。'
      ],
      counter:[
        'そうなんですよ。カウンターは章や相手を取り違えないように見るのが大事なのです。',
        'そういうことなのです。カウンターは同じ呼び方でも対象をきちんと分けて見る必要があるのですよ。'
      ],
      jinpo:[
        'そうなんですよ。陣法は条件を少し変えるだけでも結果が動くので、話しながら詰めるのが合っているのです。',
        'そういうことなのです。陣法は条件同士がつながっているので、一つずつ見ていくと分かりやすいのですよ。'
      ],
      weather:[
        'そうなんですよ。天気の続きなら、場所や日付だけ変えてそのまま聞いて大丈夫なのです。',
        'そういうことなのです。天気はこのまま地域や日付を変えて続けられるのですよ。'
      ],
      kashin_name:['そうなんですよ。名前は候補を見ながら少しずつ好みに寄せていくと選びやすいのです。'],
      tsukumo:['そうなんですよ。九十九は正本の数値を見ながら、そのまま条件を変えて比べられるのです。'],
      kishin:['そうなんですよ。鬼神石は正本の数値を基準に、そのまま比較していけるのです。'],
      madou:['そうなんですよ。魔導結晶は正本の数値を基準に、そのまま比較していけるのです。']
    };
    var domainPositive={
      carp:['ですよね。カープは逸話や選手同士のつながりまで入ると、さらに面白くなるのです。'],
      counter:['そこ、面白いところなのですよ。章や相手ごとの差まで見ると、かなり奥が深いのです。'],
      jinpo:['そこが陣法の面白いところなのですよ。条件を変えた時の動きまで見ると、かなり奥が深いのです。'],
      weather:['分かるのですよ。天気は日ごとの差を見ると意外と変化があって面白いのです。']
    };

    if(kind==='surprise_check'){
      answers=subject?[
        'そこ、ちょっと驚きますよね。「'+subject+'」の話として聞くと、なおさらです。',
        '「ほんと？」ってなりますよね。「'+subject+'」のその点は、驚きやすいところです。'
      ]:[
        'びっくりしますよね。',
        '「ほんと？」ってなりますよね。',
        'そこ、ちょっと驚くところですよね。'
      ];
    }else if(kind==='disagreement'){
      answers=subject?[
        'なるほど。「'+subject+'」のその点は、前の説明を押し通さずに捉え直します。',
        'そこは違うということですね。「'+subject+'」について、今の指摘を優先して見直します。'
      ]:[
        'なるほど、そこは同じ見方ではないんですね。前の説明を押し通さずに捉え直します。',
        '分かりました。そこは前の言い方に固執せず、いったん切り分けます。'
      ];
    }else if(kind==='skepticism'){
      answers=subject?[
        'そうかな、というところですね。「'+subject+'」のその点は、いったん断定せずに見ます。',
        'そこは少し引っかかりますよね。「'+subject+'」について、前の言い方をそのまま確定扱いしないでおきます。'
      ]:[
        'そうかな、というところですね。そこは断定せずに見たほうがよさそうです。',
        'うん、そこは少し引っかかるところですね。前の言い方をそのまま押し通さないでおきます。'
      ];
    }else if(kind==='partial_agreement'){
      answers=[
        '分かります。完全に同意ってほどではないけど、言いたいことは分かる感じですね。',
        'なるほど。納得できる部分はあるけど、全部そのままではない感じですね。',
        '「分からなくもない」くらいの距離感ですね。そこは無理に白黒つけなくてよさそうです。'
      ];
    }else if(kind==='positive'){
      if(subject){
        answers=[
          'ですよね。「'+subject+'」の話として前後までつなげて見ると、さらに面白くなるのです。',
          '分かるのですよ。「'+subject+'」は、今の話の続きとしてもう少し掘ると見え方が広がるのです。',
          'そこ、面白いところなのですよ。「'+subject+'」を軸にすると話がつながりやすいのです。'
        ];
      }else{
        answers=domainPositive[domain]||[
          'ですよね。そこ、ちょっと面白いところなのです。',
          'ふふっ、そこに反応してもらえるとうれしいのですよ。',
          '分かるのですよ。そこはもう少し掘ってみたくなるところですね。'
        ];
      }
    }else if(kind==='negative_reaction'){
      if(subject){
        answers=[
          'ですよね。「'+subject+'」のその部分は、かなり重く感じるところです。',
          'そこはきつく感じますよね。「'+subject+'」の話の中でも、軽く流しにくいところです。',
          '分かります。「'+subject+'」のそこは、簡単には受け流せないところですね。'
        ];
      }else{
        answers=[
          'ですよね。そこはきつく感じます。',
          'うん、そこは軽く流しにくいところですね。',
          'それはしんどく感じますよね。'
        ];
      }
    }else if(kind==='surprise'){
      answers=subject?[
        '意外に感じますよね。「'+subject+'」の話としてつなげて見ると、印象が変わるところなのです。',
        'そうなんですよ。「'+subject+'」には、こうして続けて見ないと気づきにくい話もあるのです。',
        'そこは驚きますよね。「'+subject+'」の続きを追うと、前の話とのつながりも見えやすくなるのです。'
      ]:[
        '意外に感じますよね。こういうところは、前後の話までつなげると見え方が変わるのです。',
        'そうなんですよ。知っているつもりでも、掘ると初めて出てくる話があるのです。',
        'そこはちょっと驚くところですよね。'
      ];
    }else if(kind==='reflection'){
      answers=subject?[
        'そう感じますよね。今話していた「'+subject+'」は、当時の話と今を分けて見ると整理しやすいのです。',
        'そうなんですよ。「'+subject+'」を当時の文脈で見ると、今の印象とはまた違って見えるのです。',
        'ですよね。「'+subject+'」は、その時代の中で見ていくと話がつながりやすいのです。'
      ]:[
        'そう感じますよね。当時の話として見ると、今とはまた違った見え方になるのです。',
        'ですよね。昔の話は、その時代の流れまで見ると印象が変わるのです。',
        'そうなんですよ。今の感覚だけでなく、当時の文脈で見ると分かりやすいのです。'
      ];
    }else if(kind==='understood'){
      answers=[
        '了解なのですよ。続けましょう。',
        '分かりました。では、そのまま続けますね。',
        '了解です。次もそのままどうぞなのですよ。'
      ];
    }else{
      answers=domainAck[domain]||[
        'そうなんですよ。',
        'そういうことなのです。',
        'なるほど、という感じなのですよ。'
      ];
    }

    // 短いテンポで会話している相手には、相槌だけ急に長文化させない。
    // 内容の正確さや人格は変えず、返答量だけ自然に合わせる。
    var style=interactionStyle(h,t);
    if(style.pace==='terse'){
      if(kind==='understood')answers=['了解です。','わかりました。','はい、そのまま進めます。'];
      else if(kind==='disagreement')answers=['了解です。そこは捉え直します。','そこは違うんですね。押し通さず見直します。'];
      else if(kind==='surprise_check')answers=['びっくりしますよね。','「ほんと？」ってなりますよね。'];
      else if(kind==='skepticism')answers=['そこは断定しないで見ます。','うん、そこは少し引っかかりますね。'];
      else if(kind==='partial_agreement')answers=['分からなくもない、くらいの感じですね。','全部に同意ではないけど、分かる部分はある感じですね。'];
      else if(kind==='ack')answers=['そうなんです。','その理解で大丈夫です。','うん、そういうことです。'];
      else if(kind==='positive'){
        if(subject)answers=['ですよね。「'+subject+'」、そこ面白いです。','「'+subject+'」のそこ、面白いところです。','分かります。「'+subject+'」はそこが面白いです。'];
        else if(domain==='carp')answers=['ですよね。カープのそこ、面白いです。','分かります。カープのそこは話が広がるところです。'];
        else if(domain==='jinpo')answers=['ですよね。陣法のそこ、面白いです。','分かります。陣法はそこが面白いです。'];
        else if(domain==='counter')answers=['ですよね。そこ、カウンターの面白いところです。'];
        else answers=['ですよね。そこ面白いです。','分かります。そこ、いいところです。'];
      }
      else if(kind==='negative_reaction')answers=subject?['ですよね。「'+subject+'」のそこはきついです。','そこは重いところですね。']:['ですよね。そこはきついです。','うん、そこは重いですね。'];
      else if(kind==='surprise')answers=['そこは意外ですよね。','そうなんです。ちょっと驚くところです。'];
      else if(kind==='reflection')answers=['そう感じますよね。','当時の文脈で見ると印象が変わります。'];
    }
    return {handled:true,kind:kind,domain:domain,answer:stablePick(answers,seed,h)};
  }

  function stripCorrection(text){
    var t=S(text);
    var before=t;
    // 「そうじゃない」は単独でも明確な訂正開始。
    t=t.replace(/^(?:そう|そっち|それ)(?:じゃ|では)?(?:ない|なくて|なく|違う)[、。,:：\s]*/,'').trim();
    // 訂正語は区切りがある時だけ前置きとして落とす。
    // 「いやでも面白い」「いやまあ分かる」のような一体の口語から「いや」だけを剥がさない。
    t=t.replace(/^(?:違う|ちがう|訂正|ごめん|ごめんね|やっぱり|やっぱ)[、。,:：\s]+/,'').trim();
    t=t.replace(/^(?:いや|いえ)[、。,:：\s]+(?!(?:でも|まあ))/,'').trim();
    return {text:t||before,corrected:t!==before};
  }

  // 「まあそれは分かるけど、成績は？」のように、前半が反応・部分同意で
  // 後半が実際の質問になっている発話では、後半の質問を現在の会話枝へ接続する。
  // 単なる「分かるけど…」の言いかけは対象外にし、明示的な質問/既知観点がある時だけ使う。
  function contrastiveFollowupTail(text){
    var t=S(text);if(!t||t.length>100)return'';
    var m=t.match(/^(?:まあ[、,\s]*)?(?:(?:それ|そこ|その話|内容)(?:は|も)?[、,\s]*)?(?:分かる|わかる|理解(?:は)?できる|知ってる|知っている|そうだね|そうなんだ|そう|確かに|たしかに)(?:[^。！？!?]{0,20})?(?:けど|けれど|けれども|でも|ただ)[、,\s]*(.+)$/);
    if(!m)return'';
    var tail=S(m[1]);if(!tail||tail.length>48)return'';
    if(!/[？?]/.test(tail)&&!aspectFromText(tail)&&!isBarePersonFollowupCue(tail))return'';
    return tail;
  }

  function navigationCue(text){
    var t=S(text);
    // 「どこで取れる」は入手情報であり、ページ移動ではない。
    if(/どこで(?:取|と)れる|入手|手に入|取り方|とりかた/.test(t))return false;
    return /(?:ページ|サイト|リンク).*(?:開|見|行|案内|どこ)|(?:開いて|ひらいて|見せて|みせて|移動して|案内して|リンクちょうだい|リンク教えて)|(?:どこにある|どのページ)/.test(t);
  }

  function counterCue(text){
    return /カウンター|カウンタ|かうんたー|かうんた|かうん|counter/i.test(S(text));
  }

  function factCue(text){
    var t=S(text);
    if(counterCue(t))return true;
    if(/何位|順位|何番|なんばん|いくつ|数値|効果|倍率|上限|下限|必要数|何個|何人|誰|だれ|いつ|どれ|いくら|どのくらい|どれくらい/.test(t))return true;
    if(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/.test(t)&&/[？?]|は$|いくつ|高い|最大|トップ/.test(t))return true;
    if(/どこで(?:取|と)れる|入手|手に入|取り方|とりかた/.test(t))return true;
    return false;
  }

  function domainFromText(text){
    var t=S(text);
    if(/カープ|かーぷ|広島東洋|carp/i.test(t))return'carp';
    if(counterCue(t)||/天下統一奇譚|修羅の間|天下武技大会|二条城|桶狭間|比叡山|賤ヶ岳|封印/.test(t))return'counter';
    if(/九十九|つくも/.test(t))return'tsukumo';
    if(/鬼神石|きしん/.test(t))return'kishin';
    if(/魔導結晶|魔導|まどう/.test(t))return'madou';
    if(/たいらの野望/.test(t))return'tairano';
    if(/家臣.*(?:名前|名付|命名)|(?:名前|名付|命名).*家臣/.test(t))return'kashin_name';
    if(/天気|気温|予報|降水|雨|雪|湿度|風速/.test(t))return'weather';
    if(/陣法|因縁|陣形|鶴翼|方円|魚鱗|衡軛|英傑|全MAX/.test(t))return'jinpo';
    if(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/.test(t)&&
       /高い|高め|強い|おすすめ|一番|最も|トップ|最大|重視|検索|探して|比較/.test(t))return'jinpo';
    return'';
  }

  function isWeakAssistantText(text){
    var t=S(text);
    return /ページはこちら|こちらから開け|入口がある|サイト内のページ案内|該当ページを開く/.test(t);
  }

  function domainFromHistoryItem(item){
    if(!item)return'';
    // assistantのmodeは実際に通ったルーターを示すため、本文中の語より優先する。
    // 例: 家臣名候補「時雨」で天気、「黒田」でカープへ誤分類しない。
    // 「たいらの野望ツール実データ」を先にcounter扱いすると、
    // 鬼神石1番→「入手は？」がカウンターへ誤接続するため、個別正本を先に判定する。
    var mode=S(item.meta&&item.meta.mode||'');
    if(/カープ/.test(mode))return'carp';
    if(/九十九/.test(mode))return'tsukumo';
    if(/鬼神石/.test(mode))return'kishin';
    if(/魔導/.test(mode))return'madou';
    if(/カウンター/.test(mode))return'counter';
    // 現行の「たいらの野望専用知識」はカウンター正本エンジンのmode名。
    if(mode==='たいらの野望専用知識')return'counter';
    // ツール実データのmode名は共通なので、回答本文に書かれたデータ種別で判定する。
    if(mode==='たいらの野望ツール実データ'){
      var toolModeDomain=domainFromText(item.text||'');
      if(toolModeDomain==='tsukumo'||toolModeDomain==='kishin'||toolModeDomain==='madou')return toolModeDomain;
      return'tairano';
    }
    if(/たいらの野望|サイト総合案内/.test(mode))return'tairano';
    if(/陣法|検索結果|おすすめ陣法/.test(mode))return'jinpo';
    if(/天気/.test(mode))return'weather';
    if(/家臣.*(?:名前|名付)/.test(mode))return'kashin_name';
    var d=domainFromText(item.text||'');
    if(d)return d;
    return'';
  }

  function recentDomain(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0&&i>=h.length-14;i--){
      if(!h[i])continue;
      var d=domainFromHistoryItem(h[i]);
      if(d)return d;
    }
    return'';
  }


  // 短い相槌・感想では、何ターンも前の専門話題を引きずらず、
  // 直前の1往復だけを反応対象にする。これにより
  // 「カープの話 → 日常雑談 → それな」で古いカープへ戻る誤りを防ぐ。
  function immediateReactionContext(history){
    var h=filterHistory(history),lastAssistant=-1;
    for(var i=h.length-1;i>=0;i--){
      if(h[i]&&h[i].role==='assistant'&&S(h[i].text)){lastAssistant=i;break;}
    }
    if(lastAssistant<0)return {history:[],domain:'',assistantText:'',userText:''};
    var start=lastAssistant,prevUser=-1;
    for(var j=lastAssistant-1;j>=0;j--){
      if(h[j]&&h[j].role==='user'&&S(h[j].text)){prevUser=j;start=j;break;}
      // 直前応答よりさらに前のassistantへは広げない。
      if(h[j]&&h[j].role==='assistant'&&S(h[j].text))break;
    }
    var slice=h.slice(start,lastAssistant+1),domain='';
    // assistant側のmodeが最も確実。その次に直前user文を見る。
    domain=domainFromHistoryItem(h[lastAssistant])||'';
    if(!domain&&prevUser>=0)domain=domainFromHistoryItem(h[prevUser])||'';
    return {
      history:slice,
      domain:domain,
      assistantText:S(h[lastAssistant]&&h[lastAssistant].text),
      userText:prevUser>=0?S(h[prevUser].text):''
    };
  }

  var ENTITY_STOP={
    '歩き巫女':1,'カープ':1,'広島東洋カープ':1,'陣法':1,'天気':1,'全MAX':1,
    '資料基準日':1,'正本資料':1,'正本':1,'候補':1,'選手':1,'監督':1,'投手':1,
    '野手':1,'家族':1,'親族':1,'試合':1,'結果':1,'順位':1,'今日':1,'明日':1,
    '昨日':1,'今回':1,'現在':1,'最新情報':1,'検索結果':1,'おすすめ':1,
    '前者':1,'後者':1,'もう片方':1,'もう一方':1,'そっち':1,
    '代表例':1,'代表':1,'一例':1,'具体例':1,'例':1,'入手':1,'必要数':1,'上限':1,'下限':1
  };

  function cleanEntityCandidate(v){
    var x=S(v)
      .replace(/^[「『【\[（(\s]+|[」』】\]）)\s]+$/g,'')
      .replace(/^(?:その中でも|中でも|特に|とくに|例えば|たとえば|なお|ちなみに)[、\s]*/,'')
      .replace(/(?:って何|ってなに|とは)$/,'')
      .replace(/(?:選手|監督|投手|野手|捕手|内野手|外野手|氏|さん|くん|ちゃん)$/,'')
      .trim();
    if(!x||x.length<2||x.length>30||ENTITY_STOP[x])return'';
    if(/^(?:そう|これ|それ|その|この|あの|ここ|そこ|どこ|もの|こと|ため|よう|感じ|内容|情報)$/.test(x))return'';
    if(/^[0-9０-９.,年月日時分秒\-\/]+$/.test(x))return'';
    return x;
  }

  function looksLikePersonName(v){
    var x=cleanEntityCandidate(v);if(!x)return false;
    // 一般トピックを「その人」の候補にしない。固有名詞らしい英字/漢字でも、
    // 開発・仕事・ゲーム等の語は会話上のtopicとして保持する。
    if(ENTITY_STOP[x]||/年|月|日|試合|球団|資料|情報|記録|成績|順位|逸話|歴史|カウンター|編集|運営|経営|開発|機能|検索|設定|サイト|動画|ゲーム|野球|仕事|会社|プログラム|コード|Firebase|ChatGPT|JavaScript|CSS|AI$|編$|章$|^(?:九十九|鬼神石|魔導結晶|見聞録|文曲|鶴翼|方円|魚鱗|衡軛|こうやく)$|^(?:生命|気合|腕力|耐久(?:力)?|器用|知力|魅力|土|水|火|風)$|(?:無料枠|有料枠)$|(?:枠|欄|項目|条件|履歴|資料|結果|機能|設定|モード|画面|ボタン|サービス|プラン|料金|価格|値段|認証|データ|通知|権限|検索|会話|記憶|仕組み|方法)$/.test(x))return false;
    if(/^[一-龠々]{2,8}$/.test(x))return true;
    // 英字1語はサービス・製品名であることが多いので、人物接尾辞などが無い限りtopicを優先する。
    // "Shohei Ohtani" のような複数語は人物候補として扱い、"Ohtani選手" は上の人物接尾辞抽出で確定する。
    if(/^[A-Za-z][A-Za-z.'’\-]*$/.test(x))return false;
    if(/^[A-Za-z][A-Za-z.'’\- ]{2,28}$/.test(x)&&/\s/.test(x))return true;
    if(/^[ァ-ヶ][ァ-ヶ・ー.'’\-]{2,28}$/.test(x))return true;
    return false;
  }

  function entityCandidatesFromText(text,domain){
    var t=S(text),out=[],seen={};
    function add(value,type,score){
      var x=cleanEntityCandidate(value);if(!x||seen[x])return;
      seen[x]=1;out.push({value:x,type:type||'topic',score:Number(score)||0});
    }

    // カープ正本が既に読込済みなら、955名索引を最優先の人物辞書として使う。
    try{
      if(window.JINPO_BOT_CARP_KNOWLEDGE&&typeof window.JINPO_BOT_CARP_KNOWLEDGE.foundNames==='function'){
        var names=window.JINPO_BOT_CARP_KNOWLEDGE.foundNames(t)||[];
        names.slice(0,4).forEach(function(name){add(name,'person',120);});
      }
    }catch(e){}

    // カウンター正本が読込済みなら、全canonical・一意な別名・読みを会話の主役として保持する。
    // これにより「アサヒナヤストモは？」の後の「その人は？」も朝比奈泰朝へ戻せる。
    try{
      var tf=hiraText(t).replace(/[\s　・]/g,'');
      var tairanoEntityContext=domain==='counter'||domain==='tairano'||counterCue(t)||
        /天下統一奇譚|天下武技大会|修羅の間|桶狭間|富士地下洞穴|二条城|封印/.test(t)||
        /^[ぁ-ゖァ-ヶー]{3,24}(?:は|って|の|について|をおしえて|おしえて|です|だよ|かな|か|[？?！!。])*$/.test(t);
      if(tairanoEntityContext){
        var tairanoRows=dynamicTairanoEntityRows();
        for(var tri=0;tri<tairanoRows.length;tri++){
          var tr=tairanoRows[tri],hit=false;
          if(tr.form&&t.indexOf(tr.form)>=0)hit=true;
          else if(tr.reading&&tf.indexOf(tr.reading)>=0)hit=true;
          if(hit)add(tr.canonical,'person',tr.score);
        }
      }
    }catch(tairanoEntityErr){}

    // たいらの野望で取り違えやすい人物は明示的に人物として保持する。
    var knownPeople=t.match(/今川義元|今川氏真|足利義輝|足利義昭|織田信長|豊臣秀吉|徳川家康/g)||[];
    knownPeople.forEach(function(name){add(name,'person',115);});

    // 「AとB、両方気になる」のように並行話題を明示した時だけ、正本が遅延読込前でも
    // 2つの主題を会話スロットとして保持する。通常の「AとB」はここでは分解しない。
    if(isParallelCue(t)){
      var pm=t.match(/^(.{2,24}?)と(.{2,24}?)[、,\s]*(?:両方(?:とも)?|どっちも|どちらも|それぞれ)(?:が|は|も)?(?:気になる|知りたい|話したい|進めたい|見たい|追いたい)/);
      if(pm){
        var pv1=S(pm[1]).replace(/^(?:まず|じゃあ|では)[、,\s]*/,'');
        var pv2=S(pm[2]);
        if(pv1)add(pv1,looksLikePersonName(pv1)?'person':'topic',82);
        if(pv2)add(pv2,looksLikePersonName(pv2)?'person':'topic',82);
      }
    }

    // 見出しは回答の主題になりやすい。「【江夏の21球】」などを拾う。
    var m,re=/【([^】]{2,30})】/g;
    while((m=re.exec(t)))add(m[1],looksLikePersonName(m[1])?'person':'topic',92);

    // 「○○選手」「○○監督」などは一般人物名として扱える。
    re=/([一-龠々ァ-ヶA-Za-z・ー.'’\-]{2,28})(?:選手|監督|投手|野手|捕手|内野手|外野手|氏|さん)(?=について|[はがの、。！？\s]|$)/g;
    while((m=re.exec(t)))add(m[1],'person',88);

    // 回答冒頭や文頭の「黒田博樹は」「新井貴浩について」のような主語。
    re=/(?:^|[\n。！？])\s*([一-龠々]{2,8}|[ァ-ヶA-Za-z][ァ-ヶA-Za-z・ー.'’\- ]{2,28})(?:は|が|について)/g;
    while((m=re.exec(t)))add(m[1],looksLikePersonName(m[1])?'person':'topic',78);

    // 一般テーマも会話グラフの主役として保持する。
    // 「サイト運営について話そう」「動画編集についてどう思う？」のような混在文字列を拾う。
    re=/(?:^|[\n。！？])\s*(?:(?:まず(?:は)?|じゃあ|では|次は)[、,\s]*)?([^\n。！？、]{2,24}?)(?:について|の話)(?:を)?(?:教えて|知りたい|話そう|話したい|詳しく|どう思う|どうなの|しよう|する)?(?=[？?！!。\s]|$)/g;
    while((m=re.exec(t)))add(m[1],looksLikePersonName(m[1])?'person':'topic',76);

    // 「新井貴浩の家族」「黒田博樹の経歴」のような所有・観点表現。
    // 正本の人物索引がまだ遅延読込されていない起動直後でも主役を保持する。
    re=/(?:^|[\n。！？、])\s*([一-龠々]{2,8}|[ァ-ヶA-Za-z][ァ-ヶA-Za-z・ー.'’\- ]{2,28})の(?:家族|親族|経歴|成績|逸話|歴史|父|母|兄|弟|姉|妹|息子|娘|妻|夫)/g;
    while((m=re.exec(t)))add(m[1],'person',84);

    // 家族説明の「弟は新井良太」「父：○○」から、回答内の関係人物を拾う。
    re=/(?:父|母|兄|弟|姉|妹|息子|娘|妻|夫|配偶者|長男|次男|三男|長女|次女|三女)(?:は|が|[:：])\s*([一-龠々]{2,8}|[ァ-ヶA-Za-z][ァ-ヶA-Za-z・ー.'’\- ]{2,28})(?=[です、。！？\s]|$)/g;
    while((m=re.exec(t)))add(m[1],'person',86);

    // 引用された短い固有名詞も汎用の話題として保持する。
    re=/「([^」]{2,30})」/g;
    while((m=re.exec(t)))add(m[1],looksLikePersonName(m[1])?'person':'topic',70);

    out.sort(function(a,b){return b.score-a.score;});
    return out;
  }

  function findRecentEntity(history,opt){
    opt=opt||{};
    var h=filterHistory(history),wantPerson=!!opt.personOnly,limit=Number(opt.limit)||18;
    for(var i=h.length-1,age=0;i>=0&&age<limit;i--,age++){
      var item=h[i];if(!item||!S(item.text))continue;
      var d=domainFromHistoryItem(item)||recentDomain(h.slice(0,i+1));
      var list=entityCandidatesFromText(item.text,d).filter(function(x){return !wantPerson||x.type==='person';});
      if(!list.length)continue;

      // 同じ直近発言に人物が複数いる時、「その人」を片方へ決め打ちしない。
      if(wantPerson){
        var people=[];
        list.forEach(function(x){if(people.indexOf(x.value)<0)people.push(x.value);});
        if(people.length>1){
          return {ambiguous:true,candidates:people.slice(0,6),type:'person',domain:d||'',role:item.role||'',sourceText:S(item.text),index:i};
        }
      }

      return {value:list[0].value,type:list[0].type,domain:d||'',role:item.role||'',sourceText:S(item.text),index:i};
    }
    return null;
  }

  function aspectFromText(text){
    var t=S(text);if(!t)return'';
    // 「黒田の家族、いや成績」のような同一発話内の訂正は、訂正後の観点を正とする。
    // topicFrames() は生のユーザー発話も読むため、ここで古い観点を先に拾わないようにする。
    var correctionTail=t.match(/(?:じゃなくて|ではなくて|じゃなく|ではなく|[、,\s](?:いや|違う|ちがう|訂正(?:すると)?|ごめん(?:ね)?|やっぱ(?:り)?)[、,\s]*)([^、。！？!?]{1,40})$/);
    if(correctionTail&&S(correctionTail[1])){
      var corrected=S(correctionTail[1]);
      if(/家族|親族|父|母|兄|弟|姉|妹|息子|娘|妻|嫁|奥さん|夫人|夫|旦那|配偶者|子供|子ども/.test(corrected))return'family';
      if(/逸話|昔話|名場面|伝説|エピソード/.test(corrected))return'anecdote';
      if(/歴史|創設|沿革|昔の名前|由来/.test(corrected))return'history';
      if(/現在|今は|今どう|最近|最新|その後|それから/.test(corrected))return'current';
      if(/成績|打率|本塁打|ホームラン|打点|防御率|勝率|勝ち|セーブ|ホールド|記録/.test(corrected))return'stats';
      if(/経歴|所属|移籍|入団|退団|引退|現役|ドラフト/.test(corrected))return'career';
      if(/順位|何位|ゲーム差/.test(corrected))return'rank';
      if(/日程|予定|次の試合|対戦相手/.test(corrected))return'schedule';
      if(/結果|スコア|勝った|負けた|引き分け/.test(corrected))return'result';
      if(/比較|比べ|どっち|違い/.test(corrected))return'compare';
      if(/カウンター/.test(corrected))return'counter';
    }
    if(/家族|親族|父|母|兄|弟|姉|妹|息子|娘|妻|嫁|奥さん|夫人|夫|旦那|配偶者|子供|子ども/.test(t))return'family';
    if(/逸話|昔話|名場面|伝説|エピソード/.test(t))return'anecdote';
    if(/歴史|創設|沿革|昔の名前|由来/.test(t))return'history';
    if(/現在|今は|今どう|最近|最新|その後|それから/.test(t))return'current';
    if(/成績|打率|本塁打|ホームラン|打点|防御率|勝率|勝ち|セーブ|ホールド|記録/.test(t))return'stats';
    if(/経歴|所属|移籍|入団|退団|引退|現役|ドラフト/.test(t))return'career';
    if(/順位|何位|ゲーム差/.test(t))return'rank';
    if(/日程|予定|次の試合|対戦相手/.test(t))return'schedule';
    if(/結果|スコア|勝った|負けた|引き分け/.test(t))return'result';
    if(/比較|比べ|どっち|違い/.test(t))return'compare';
    if(/カウンター/.test(t))return'counter';
    // 人物・話題そのものを尋ねる「概要」。特定観点より後で判定し、
    // 「家族について教えて」などをoverviewへ潰さない。
    if(/について(?:教えて|知りたい|説明して|詳しく(?:教えて)?)|どんな(?:人|選手|人物|監督)|何者|(?:誰|だれ)(?:なの|ですか|だった)/.test(t))return'overview';
    return'';
  }

  function entityValues(list,type){
    var out=[];
    (Array.isArray(list)?list:[]).forEach(function(x){
      if(!x||!x.value||(type&&x.type!==type)||out.indexOf(x.value)>=0)return;
      out.push(x.value);
    });
    return out;
  }

  function isBarePersonFollowupCue(text){
    var t=S(text).replace(/^(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*/,'');
    if(t.length>34)return false;
    return /^(?:(?:何歳|なんさい|年齢|いくつ)(?:は|って)?(?:なの|ですか|だったっけ|だっけ|でしたっけ)?|(?:何年生まれ|なんねんうまれ|いつ生まれ|生年月日|誕生日)(?:は|って)?(?:なの|ですか)?|(?:奥さん|妻|嫁|夫人|配偶者|夫|旦那|父親|父|母親|母|兄弟|兄|弟|姉妹|姉|妹|息子|娘|子供|子ども)(?:は|って)?|(?:まだ)?現役(?:なの|ですか|だったっけ|だっけ|でしたっけ)?|(?:いつ|何年に|なんねんに)?引退(?:した|したの)?(?:っけ|んだっけ|でしたっけ|の|ですか)?|(?:今|いま|現在)(?:は|も)?(?:何してる|なにしてる|何をしてる|何している|なにしている|何をしている|どこ|どこにいる)(?:の|んですか)?|現在の(?:所属|活動)(?:は|って)?)[？?！!。]*$/.test(t);
  }

  function choosePrimaryEntity(userEntities,assistantEntities,previousFrame,userText){
    var up=entityValues(userEntities,'person');
    if(up.length)return {value:up[0],type:'person',source:'user'};
    var ue=entityValues(userEntities);
    if(ue.length)return {value:ue[0],type:(userEntities.find(function(x){return x&&x.value===ue[0];})||{}).type||'topic',source:'user'};

    // 「その人」「その選手」「今はどう？」のような追質問は、前フレームの主役を継承する。
    // 年齢・配偶者・現役などの人物専用短文は、前フレームが人物の時だけ継承する。
    if(previousFrame&&previousFrame.primary&&(
       /^(?:(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*)?(?:その人|この人|あの人|さっきの人|前の人|その選手|この選手|さっきの選手|前の選手|その監督|その投手|その野手|その敵|この敵|あの敵|さっきの敵|前の敵|それ|これ|その件|その話|そのやつ|さっきのやつ|今のやつ|前のやつ|さっきの話|今の話|前の話|今は|現在は|その後|それから|もっと|詳しく)/.test(S(userText)) ||
       isFollowupOnlyUtterance(userText) ||
       (aspectFromText(userText)&&S(userText).length<=24) ||
       (previousFrame.primary.type==='person'&&isBarePersonFollowupCue(userText))
    )){
      return {value:previousFrame.primary.value,type:previousFrame.primary.type||'topic',source:'carry'};
    }

    var ap=entityValues(assistantEntities,'person');
    // 回答に一人だけ人物が出た時だけ、回答側から主役を補う。複数なら決め打ちしない。
    if(ap.length===1)return {value:ap[0],type:'person',source:'assistant'};
    var ae=entityValues(assistantEntities);
    if(ae.length===1)return {value:ae[0],type:(assistantEntities.find(function(x){return x&&x.value===ae[0];})||{}).type||'topic',source:'assistant'};
    return null;
  }

  // 会話を「ユーザー質問 + その回答」のフレームにまとめる。
  // 主役・分野・質問した観点・回答内に出た人物を分離し、直前回答の脇役を主語と誤認しにくくする。
  function topicFrames(history,opt){
    opt=opt||{};
    var h=filterHistory(history),frames=[],current=null;
    for(var i=0;i<h.length;i++){
      var item=h[i];if(!item||!S(item.text)||item.role==='system')continue;
      if(item.role==='user'){
        var currentAspect=aspectFromText(item.text);
        var aspectOnlyFollowup=!!currentAspect&&/^(?:家族|親族|成績|経歴|逸話|昔話|歴史|現在|現役時代|順位|日程|結果|カウンター)(?:は|って)?[？?。！!\s]*$/.test(S(item.text));
        var parallelCorrectionText=parallelCorrectionResumeText(item.text);
        var parallelReferenceCue=isResumeParallelCue(item.text)||!!parallelCorrectionText;
        var discourseResume=null;
        try{discourseResume=resolveDiscourseDeictic(item.text,h.slice(0,i));}catch(discourseFrameErr){discourseResume=null;}
        // 「前回の続き」「さっきの続き」は話題を実際に再開するが、
        // 「どこまで話したっけ？」は履歴確認だけなので主役を再活性化しない。
        var naturalResumeCue=isGeneralResumeCue(item.text)&&!isConversationRecallCue(item.text);
        current={
          index:i,at:Number(item.at||0),userText:S(item.text),assistantText:'',
          domain:domainFromHistoryItem(item)||'',aspect:currentAspect,
          // 「料金は？」「注意点は？」や「成績は？」などの追質問専用短文を新しい主題として登録しない。
          // ただし観点フレーム自体は残し、直前主題の「成績」「経歴」等の枝として記憶する。
          // 「前者／後者／もう片方」も人物名ではなく談話参照なのでentity候補へ入れない。
          userEntities:(isFollowupOnlyUtterance(item.text)||aspectOnlyFollowup||parallelReferenceCue)?[]:entityCandidatesFromText(item.text,domainFromHistoryItem(item)||''),
          assistantEntities:[],primary:null,secondaryPeople:[]
        };
        var prev=frames.length?frames[frames.length-1]:null;
        var restoredBack=null;
        // 「前の話に戻って」は、直前フレームをそのまま継承するのではなく、
        // 実際に復帰対象として選ばれた枝をこの履歴フレームの主役にする。
        // これにより「戻った直後だけ黒田→次の家族で新井へ逆戻り」のような再反転を防ぐ。
        if(isBackCue(item.text)){
          try{
            var namedFrameDomain=namedBackDomain(item.text);
            if(namedFrameDomain){
              var namedFrameBranch=latestBranchByDomain(h.slice(0,i),namedFrameDomain);
              restoredBack=namedFrameBranch?{
                restoreMessage:namedFrameBranch.message||namedFrameBranch.sourceText,
                domain:namedFrameDomain,
                sourceText:namedFrameBranch.sourceText||'',
                sourceIndex:namedFrameBranch.index,
                aspect:namedFrameBranch.aspect||'',
                primary:namedFrameBranch.primary||null
              }:null;
            }else{
              restoredBack=restorePreviousTopic(h.slice(0,i),item.text);
            }
          }catch(backFrameErr){restoredBack=null;}
          if(restoredBack&&restoredBack.restoreMessage){
            if(restoredBack.domain)current.domain=restoredBack.domain;
            if(restoredBack.aspect)current.aspect=restoredBack.aspect;
            if(restoredBack.primary&&restoredBack.primary.value){
              current.primary={value:restoredBack.primary.value,type:restoredBack.primary.type||'topic',source:'restore'};
            }
          }
        }else if(naturalResumeCue){
          // 「前回の続き」は、その場の返答だけ復帰させるのではなく、
          // 次ターンの省略質問でも同じ主役・観点を使える会話枝として固定する。
          try{
            restoredBack=restoreNaturalResume(h.slice(0,i),item.text);
          }catch(naturalResumeFrameErr){restoredBack=null;}
          if(restoredBack&&restoredBack.restoreMessage){
            if(restoredBack.domain)current.domain=restoredBack.domain;
            if(restoredBack.aspect)current.aspect=restoredBack.aspect;
            if(restoredBack.primary&&restoredBack.primary.value){
              current.primary={value:restoredBack.primary.value,type:restoredBack.primary.type||'topic',source:'resume_restore'};
            }
          }
        }else if(parallelReferenceCue){
          // 「後者は？」の返答だけ合って次の「今何してる？」で元の主役へ戻るのを防ぐ。
          // 選ばれた並行スロットを、このターンの主役・観点として履歴へ固定する。
          try{
            var restoredParallel=restoreParallelTopic(h.slice(0,i),parallelCorrectionText||item.text);
            if(restoredParallel&&restoredParallel.restoreMessage){
              if(restoredParallel.domain)current.domain=restoredParallel.domain;
              if(restoredParallel.suffix){
                var parallelAspect=aspectFromText(restoredParallel.restoreMessage);if(parallelAspect)current.aspect=parallelAspect;
              }else if(restoredParallel.primary&&restoredParallel.primary.value){
                var slots=parallelTopics(h.slice(0,i),item.text),slot=slots.find(function(x){return x&&x.subject===restoredParallel.primary.value&&x.message===restoredParallel.restoreMessage;});
                if(slot&&slot.aspect)current.aspect=slot.aspect;
              }
              if(restoredParallel.primary&&restoredParallel.primary.value){
                current.primary={value:restoredParallel.primary.value,type:restoredParallel.primary.type||'topic',source:'parallel_restore'};
              }
            }
          }catch(parallelFrameErr){}
        }else if(discourseResume&&discourseResume.message&&!discourseResume.ambiguous){
          // 「前のやつ」「その前のは」のような談話指示語も、その場の表示だけでなく
          // 次ターンの省略質問へ主役・観点を引き継げる会話枝として固定する。
          if(discourseResume.branch&&discourseResume.branch.domain)current.domain=discourseResume.branch.domain;
          if(discourseResume.branch&&discourseResume.branch.aspect)current.aspect=discourseResume.branch.aspect;
          if(discourseResume.branch&&discourseResume.branch.primary&&discourseResume.branch.primary.value){
            current.primary={value:discourseResume.branch.primary.value,type:discourseResume.branch.primary.type||'topic',source:'discourse_restore'};
          }else if(discourseResume.reference&&discourseResume.reference.value){
            current.primary={value:discourseResume.reference.value,type:discourseResume.reference.type||'topic',source:'discourse_restore'};
          }
        }
        // 「それは知ってる」「そこは分かってる」は、直前に説明した観点を既知として保持する。
        // 以後の「他には？」で同じ観点へ戻りにくくする。
        if(!current.aspect&&prev&&prev.aspect&&/^(?:それ|そこ|その話)?(?:は|もう)?(?:知ってる|知っている|分かってる|わかってる|分かっている|わかっている)(?:よ|って|から)?[。！!？?]*$/.test(current.userText)){
          current.aspect=prev.aspect;
        }
        // 「もっと」「その話もっと」などは新しい観点ではなく、直前観点の継続。
        // 連続して「もっと」と言っても family/anecdote 等を失わないようにする。
        if(!current.aspect&&prev&&prev.aspect&&/^(?:(?:その|この|今の|さっきの|前の)話[、,\s]*)?(?:もっと|もう少し|詳しく|くわしく|他には|ほかには|続き|つづき)[？?！!。]*$/.test(current.userText)){
          current.aspect=prev.aspect;
        }
        if(!current.primary)current.primary=choosePrimaryEntity(current.userEntities,[],(isBackCue(current.userText)||naturalResumeCue||parallelReferenceCue||(discourseResume&&discourseResume.message&&!discourseResume.ambiguous))?null:prev,current.userText);
        if(!current.domain&&prev&&current.primary&&prev.primary&&current.primary.value===prev.primary.value)current.domain=prev.domain||'';
        frames.push(current);
      }else if(item.role==='assistant'){
        if(!current){
          current={index:i,at:Number(item.at||0),userText:'',assistantText:'',domain:domainFromHistoryItem(item)||'',aspect:'',userEntities:[],assistantEntities:[],primary:null,secondaryPeople:[]};
          frames.push(current);
        }
        current.assistantText+=(current.assistantText?'\n':'')+S(item.text);
        // 「前の話に戻ろう」のような制御発言はユーザー文だけでは観点が分からない。
        // 戻した直後の回答に明示された観点だけを補い、次の「さらに前へ」で枝を失わないようにする。
        if(!current.aspect&&isBackCue(current.userText)){
          var restoredAspect=aspectFromText(item.text);if(restoredAspect)current.aspect=restoredAspect;
        }
        var ad=domainFromHistoryItem(item)||'';
        if(!current.domain&&ad)current.domain=ad;
        // 家臣名付けの候補は創作名なので、実在人物・一般テーマの会話主語へ登録しない。
        // 「黒田 時雨」のような候補が黒田博樹/天気として後続会話を汚染するのを防ぐ。
        if((current.domain||ad)!=='kashin_name'){
          current.assistantEntities=current.assistantEntities.concat(entityCandidatesFromText(item.text,current.domain||ad));
        }
        if(!current.primary){
          var prevFrame=frames.length>1?frames[frames.length-2]:null;
          current.primary=choosePrimaryEntity(current.userEntities,current.assistantEntities,(isBackCue(current.userText)||isResumeParallelCue(current.userText))?null:prevFrame,current.userText);
        }
        var pp=current.primary&&current.primary.value||'';
        current.secondaryPeople=entityValues(current.assistantEntities,'person').filter(function(x){return x!==pp;});
      }
    }
    var frameLimit=Math.max(8,Math.min(64,Number(opt.limit)||16));
    return frames.slice(-frameLimit);
  }

  function recentSubjects(history,opt){
    opt=opt||{};
    var frames=topicFrames(history),out=[],seen={};
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i],p=f&&f.primary;if(!p||!p.value)continue;
      if(opt.personOnly&&p.type!=='person')continue;
      var key=p.type+'|'+p.value;if(seen[key])continue;seen[key]=1;
      out.push({value:p.value,type:p.type||'topic',domain:f.domain||'',aspect:f.aspect||'',frameIndex:i,userText:f.userText||'',assistantText:f.assistantText||'',secondaryPeople:(f.secondaryPeople||[]).slice()});
      if(out.length>=(Number(opt.limit)||8))break;
    }
    return out;
  }

  function normalizeAnchor(v){
    return C(v).replace(/(?:選手|監督|投手|野手|さん|氏)$/,'');
  }

  function findSubjectByAnchor(history,anchor,opt){
    var a=normalizeAnchor(anchor);if(!a)return null;
    var list=recentSubjects(history,opt||{}),hits=[];
    list.forEach(function(x){
      var v=normalizeAnchor(x.value);
      if(v===a||v.indexOf(a)>=0||a.indexOf(v)>=0)hits.push(x);
    });
    if(hits.length===1)return hits[0];
    if(hits.length>1)return {ambiguous:true,candidates:hits.map(function(x){return x.value;}).slice(0,6)};
    return null;
  }

  function previousDistinctSubject(history,opt){
    var list=recentSubjects(history,opt||{});
    return {current:list[0]||null,previous:list[1]||null,list:list};
  }

  // 回答内に出た「主役以外の人物」を、話題移動用の脇役として保持する。
  // 直近フレームを優先し、同一人物の重複は除く。
  function recentSecondaryPeople(history,opt){
    opt=opt||{};
    var frames=topicFrames(history),out=[],seen={},limit=Number(opt.limit)||8;
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];if(!f)continue;
      var pp=f.primary&&f.primary.value||'';
      var people=Array.isArray(f.secondaryPeople)?f.secondaryPeople:[];
      for(var j=0;j<people.length;j++){
        var v=people[j];if(!v||v===pp||seen[v])continue;
        seen[v]=1;
        out.push({value:v,type:'person',domain:f.domain||'',aspect:f.aspect||'',frameIndex:i,primary:pp,userText:f.userText||'',assistantText:f.assistantText||''});
        if(out.length>=limit)return out;
      }
    }
    return out;
  }

  function latestSecondaryFrame(history,opt){
    opt=opt||{};
    var frames=topicFrames(history);
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];if(!f)continue;
      if(opt.aspect&&f.aspect!==opt.aspect)continue;
      var pp=f.primary&&f.primary.value||'';
      var people=(f.secondaryPeople||[]).filter(function(v){return v&&v!==pp;});
      var uniq=[];people.forEach(function(v){if(uniq.indexOf(v)<0)uniq.push(v);});
      if(uniq.length)return {frame:f,people:uniq};
    }
    return null;
  }

  function findPersonByAnchor(history,anchor){
    var a=normalizeAnchor(anchor);if(!a)return null;
    var pool=recentSubjects(history,{personOnly:true,limit:10}).concat(recentSecondaryPeople(history,{limit:10}));
    var hits=[],seen={};
    pool.forEach(function(x){
      if(!x||!x.value||seen[x.value])return;
      var v=normalizeAnchor(x.value);
      if(v===a||v.indexOf(a)>=0||a.indexOf(v)>=0){seen[x.value]=1;hits.push(x);}
    });
    if(hits.length===1)return hits[0];
    if(hits.length>1)return {ambiguous:true,candidates:hits.map(function(x){return x.value;}).slice(0,6)};
    return null;
  }

  function pairFromNamedAnchors(history,left,right){
    var a=findPersonByAnchor(history,left);
    var b=findPersonByAnchor(history,right);
    if(a&&a.ambiguous)return {ambiguous:true,candidates:a.candidates||[],side:'left'};
    if(b&&b.ambiguous)return {ambiguous:true,candidates:b.candidates||[],side:'right'};
    if(!a||!a.value||!b||!b.value||a.value===b.value)return null;
    return {left:a,right:b};
  }

  function relationPeopleFromFrame(frame,relation){
    if(!frame)return[];
    var pp=frame.primary&&frame.primary.value||'',people=(frame.secondaryPeople||[]).filter(function(v){return v&&v!==pp;});
    var text=S(frame.assistantText||''),out=[];
    if(!people.length||!text)return out;
    var aliases={
      '父':['父','父親','お父さん'], '母':['母','母親','お母さん'],
      '兄':['兄','兄貴','お兄さん'], '弟':['弟','弟さん'], '姉':['姉','お姉さん'], '妹':['妹','妹さん'],
      '息子':['息子','長男','次男','三男'], '娘':['娘','長女','次女','三女'],
      '妻':['妻','奥さん','夫人','配偶者'], '夫':['夫','旦那','配偶者'], '子供':['子供','子ども','子']
    };
    var words=aliases[relation]||[relation],scores={};
    function positions(hay,needle){
      var a=[],from=0,p;while((p=hay.indexOf(needle,from))>=0){a.push(p);from=p+Math.max(1,needle.length);}return a;
    }
    words.forEach(function(w){
      positions(text,w).forEach(function(wp){
        people.forEach(function(name){
          positions(text,name).forEach(function(np){
            var left=Math.min(wp,np),right=Math.max(wp+w.length,np+name.length);
            var between=text.slice(left,right);
            if(/[。！？\n]/.test(between))return;
            var after=np>=wp+w.length;
            var dist=after?(np-(wp+w.length)):(wp-(np+name.length)+12);
            if(dist<0||dist>36)return;
            if(scores[name]==null||dist<scores[name])scores[name]=dist;
          });
        });
      });
    });
    var ranked=Object.keys(scores).sort(function(a,b){return scores[a]-scores[b];});
    if(ranked.length){
      var best=scores[ranked[0]];
      // ほぼ同距離の候補が複数なら、関係を決め打ちしない。
      return ranked.filter(function(name){return scores[name]<=best+1;});
    }
    // 文構造が特殊な時だけ、同じ文に関係語と人物がいるかを保守的に見る。
    var sentences=text.split(/[。！？\n]/).filter(Boolean);
    sentences.forEach(function(sentence){
      if(!words.some(function(w){return sentence.indexOf(w)>=0;}))return;
      people.forEach(function(name){if(sentence.indexOf(name)>=0&&out.indexOf(name)<0)out.push(name);});
    });
    return out;
  }

  function askedHistory(history,limit){
    var frames=topicFrames(history),out=[],n=Number(limit)||6;
    for(var i=frames.length-1;i>=0&&out.length<n;i--){
      var f=frames[i];if(!f||!f.userText)continue;
      out.push({subject:f.primary&&f.primary.value||'',domain:f.domain||'',aspect:f.aspect||'',question:f.userText,index:f.index});
    }
    return out;
  }

  function subjectMemory(history){
    var frames=topicFrames(history),out=[],map={};
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i],p=f&&f.primary;if(!p||!p.value)continue;
      var key=(p.type||'topic')+'|'+p.value,m=map[key];
      if(!m){
        m=map[key]={subject:p.value,type:p.type||'topic',domain:f.domain||'',aspects:[],questions:[],lastAssistant:f.assistantText||'',lastIndex:f.index};
        out.push(m);
      }
      if(f.aspect&&m.aspects.indexOf(f.aspect)<0)m.aspects.push(f.aspect);
      if(f.userText&&m.questions.indexOf(f.userText)<0)m.questions.push(f.userText);
      if(!m.domain&&f.domain)m.domain=f.domain;
      if(!m.lastAssistant&&f.assistantText)m.lastAssistant=f.assistantText;
    }
    return out.slice(0,8);
  }


  // セッション内だけの会話傾向。個人属性を推測せず、ユーザーが実際に示した
  // 「そこは知っている」「もっと知りたい」「違う」などの会話上の信号だけを圧縮する。
  function conversationSignals(history){
    var h=filterHistory(history),frames=topicFrames(h),known=[],corrections=[],engagement='neutral',engagementAge=0,seenKnown={};
    var userCount=0,explicitDepth='',depthPersistent=false;

    // 「これからは短く/詳しく」のような継続指定は、100件履歴の範囲で最後の指定を保持する。
    for(var pi=h.length-1;pi>=0;pi--){
      var px=h[pi];if(!px||px.role!=='user')continue;
      var pt=S(px.text);if(!pt||!/(?:今後|これから|以降|これ以降)/.test(pt))continue;
      if(/短く|簡潔|簡単に|要点だけ/.test(pt)){explicitDepth='brief';depthPersistent=true;break;}
      if(/詳しく|深く|細かく|徹底的/.test(pt)){explicitDepth='deep';depthPersistent=true;break;}
    }

    for(var i=h.length-1;i>=0&&userCount<14;i--){
      var item=h[i];if(!item||item.role!=='user')continue;
      var t=S(item.text);if(!t)continue;
      userCount++;

      if(!explicitDepth&&/(?:短く|簡潔に|要点だけ).*(?:答えて|話して|お願い)/.test(t)){
        explicitDepth='brief';
      }else if(!explicitDepth&&/(?:詳しく|深く|細かく).*(?:答えて|話して|お願い)/.test(t)){
        explicitDepth='deep';
      }

      if(corrections.length<3&&/(?:違う|ちがう|そうじゃない|それじゃない|前と違|さっきと違|矛盾|間違|まちが)/.test(t)){
        corrections.push(t.slice(0,160));
      }

      if(engagement==='neutral'){
        // 「興味ない」「もう気にならない」は、語中に「興味」「気になる」があっても閉じる合図を優先する。
        if(/もういい|十分|そこまで|話変え|別の話|次の話|興味(?:は)?ない|興味なくな|気にならない|もう気にならない|知りたくない/.test(t)){engagement='closed';engagementAge=userCount;}
        else if(/もっと|他には|ほかには|続き|詳しく|面白い|おもしろい|興味(?:ある|がある|深い)|気になる|知りたい|初めて知った|知らなかった/.test(t)){engagement='engaged';engagementAge=userCount;}
      }
    }

    for(var j=frames.length-1;j>=0&&known.length<8;j--){
      var f=frames[j];if(!f||!f.userText)continue;
      if(!/(?:知ってる|知っている|分かってる|わかってる|分かっている|わかっている|既に知って|もう知って)/.test(f.userText))continue;
      var subject=f.primary&&f.primary.value||'';
      var aspect=f.aspect||'';
      var key=subject+'|'+aspect;
      if(seenKnown[key])continue;
      seenKnown[key]=1;
      known.push({subject:subject,aspect:aspect,text:S(f.userText).slice(0,160)});
    }

    return {
      engagement:engagement,
      engagementAge:engagementAge,
      known:known,
      corrections:corrections,
      depth:explicitDepth,
      depthPersistent:depthPersistent
    };
  }

  function graphNodeId(type,value){
    return String(type||'topic')+'|'+String(value||'');
  }

  // 会話内だけの関係を保持する軽量グラフ。
  // ここでは外部事実を推測せず、「質問した」「回答内に出た」「家族回答で弟として出た」
  // といった会話上で確認済みの接続だけを記録する。
  function conversationGraph(history){
    var frames=topicFrames(history),nodes=[],edges=[],nodeMap={},edgeMap={};

    function ensureNode(value,type,domain,index){
      if(!value)return null;
      type=type||'topic';
      var id=graphNodeId(type,value),n=nodeMap[id];
      if(!n){
        n=nodeMap[id]={id:id,subject:value,type:type,domain:domain||'',aspects:[],questions:[],lastQuestion:'',lastAssistant:'',lastIndex:Number(index)||0};
        nodes.push(n);
      }
      if(domain&&!n.domain)n.domain=domain;
      if(Number(index)>n.lastIndex)n.lastIndex=Number(index);
      return n;
    }
    function addEdge(from,to,relation,label,index){
      if(!from||!to||from.id===to.id)return;
      relation=relation||'mentioned';
      var key=from.id+'>'+to.id+'|'+relation;
      if(edgeMap[key])return;
      edgeMap[key]=1;
      edges.push({from:from.id,to:to.id,relation:relation,label:label||relation,lastIndex:Number(index)||0});
    }

    frames.forEach(function(f){
      if(!f)return;
      var p=f.primary&&f.primary.value?ensureNode(f.primary.value,f.primary.type||'topic',f.domain||'',f.index):null;
      if(p){
        if(f.aspect&&p.aspects.indexOf(f.aspect)<0)p.aspects.push(f.aspect);
        if(f.userText&&p.questions.indexOf(f.userText)<0)p.questions.push(f.userText);
        if(f.userText)p.lastQuestion=S(f.userText).slice(0,220);
        if(f.assistantText)p.lastAssistant=S(f.assistantText).slice(0,420);
      }

      var secondary=(f.secondaryPeople||[]).filter(Boolean);
      secondary.forEach(function(name){
        var sn=ensureNode(name,'person',f.domain||'',f.index);
        if(p)addEdge(p,sn,'mentioned','回答内で言及',f.index);
      });

      // 家族回答で関係語と人物が同じ文脈に結び付いた場合だけ、関係エッジを追加する。
      if(p&&f.aspect==='family'){
        ['父','母','兄','弟','姉','妹','息子','娘','妻','夫','子供'].forEach(function(rel){
          relationPeopleFromFrame(f,rel).forEach(function(name){
            var rn=ensureNode(name,'person',f.domain||'',f.index);
            addEdge(p,rn,'family:'+rel,rel,f.index);
          });
        });
      }

      // 比較質問でユーザー側に2人以上が明示されている時だけ比較接続を記録する。
      if(f.aspect==='compare'){
        var people=entityValues(f.userEntities,'person');
        for(var i=0;i<people.length;i++)for(var j=i+1;j<people.length;j++){
          addEdge(ensureNode(people[i],'person',f.domain||'',f.index),ensureNode(people[j],'person',f.domain||'',f.index),'compared','比較した',f.index);
        }
      }
    });

    nodes.sort(function(a,b){return b.lastIndex-a.lastIndex;});
    edges.sort(function(a,b){return b.lastIndex-a.lastIndex;});
    return {nodes:nodes.slice(0,24),edges:edges.slice(0,48)};
  }

  function memoryForSubject(history,subject){
    var a=normalizeAnchor(subject);if(!a)return null;
    var mem=conversationGraph(history).nodes||[],hits=[];
    mem.forEach(function(x){
      var v=normalizeAnchor(x.subject);
      if(v===a||v.indexOf(a)>=0||a.indexOf(v)>=0)hits.push(x);
    });
    return hits.length===1?hits[0]:null;
  }

  var ASPECT_LABELS={career:'経歴',stats:'成績',anecdote:'逸話',family:'家族',current:'現在',history:'歴史'};
  function nextUnaskedAspect(history,subject,domain){
    var mem=memoryForSubject(history,subject);if(!mem)return'';
    domain=domain||mem.domain||'';
    // 現時点では正本の観点分けが最も安定しているカープ人物を中心に広げる。
    // 他ドメインは既存の専門ルーターへ任せ、会話グラフが勝手に質問内容を作らない。
    var plan=domain==='carp'?['career','stats','anecdote','family','current']:[];
    if(!plan.length)return'';
    var seen=mem.aspects||[];
    for(var i=0;i<plan.length;i++)if(seen.indexOf(plan[i])<0)return plan[i];
    return'';
  }

  function genericOverviewAnchor(text){
    var t=S(text).replace(/[？?！!。]+$/,'').trim(),m;
    m=t.match(/^(.{1,32}?)(?:について|って)(?:教えて|知りたい|説明して|詳しく(?:教えて)?)$/);
    if(m)return S(m[1]);
    m=t.match(/^(.{1,24}?)(?:は|って)?どんな(?:人|選手|人物|監督)(?:なの|ですか|だった)?$/);
    if(m)return S(m[1]);
    return'';
  }

  // 同じ概要説明をそのまま繰り返す代わりに、まだ聞いていない観点へ自然に展開する。
  // 「もう一度」「最初から」など再説明を明示した場合は一切変換しない。
  function conversationGraphExpansion(text,history){
    var t=S(text);if(!t||t.length>80)return null;
    if(/もう一度|もう一回|改めて|あらためて|最初から|同じ説明|さっきの説明/.test(t))return null;
    var h=historyBeforeCurrent(history,t);if(!h.length)return null;

    var ref=null,reason='';
    if(isMoreCue(t)){
      var frames=topicFrames(h),last=frames.length?frames[frames.length-1]:null;
      // 逸話・家族など特定観点の直後の「他には？」は、その観点の続きを意味し得るため既存処理を優先。
      if(last&&last.aspect&&last.aspect!=='overview')return null;
      var recent=recentSubjects(h,{limit:1});
      if(recent.length)ref=recent[0];
      reason='more_after_overview';
    }else{
      var anchor=genericOverviewAnchor(t);if(!anchor)return null;
      ref=findSubjectByAnchor(h,anchor);
      if(!ref||ref.ambiguous||!ref.value)return null;
      var mem=memoryForSubject(h,ref.value);if(!mem)return null;
      // 概要をまだ聞いていないなら通常の概要質問をそのまま通す。
      if((mem.aspects||[]).indexOf('overview')<0)return null;
      reason='repeated_overview';
    }

    if(!ref||!ref.value)return null;
    var aspect=nextUnaskedAspect(h,ref.value,ref.domain||'');
    if(!aspect)return null;
    var label=ASPECT_LABELS[aspect]||'';if(!label)return null;
    return {
      message:ref.value+'の'+label+'について教えて',
      reference:ref,
      aspect:aspect,
      reason:reason,
      kind:'conversation_graph_expansion'
    };
  }

  function recentFrameByAspect(history,aspect){
    var frames=topicFrames(history);
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];
      if(f&&f.aspect===aspect&&f.primary&&f.primary.value)return f;
    }
    return null;
  }

  function workingMemory(history){
    var h=filterHistory(history),entity=findRecentEntity(h),person=findRecentEntity(h,{personOnly:true});
    var frames=topicFrames(h),subjects=recentSubjects(h,{limit:8}),people=recentSubjects(h,{personOnly:true,limit:8});
    return {
      domain:recentDomain(h),
      entity:entity,
      person:person,
      lastUser:lastSubstantiveUser(h),
      lastAssistant:recentAssistantAnswers(h,1)[0]||'',
      frames:frames,
      subjects:subjects,
      people:people,
      asked:askedHistory(h,8),
      subjectMemory:subjectMemory(h),
      signals:conversationSignals(h),
      interactionStyle:interactionStyle(h,''),
      graph:conversationGraph(h),
      hooks:conversationHooks(h,''),
      parallelTopics:parallelTopics(h,''),
      positions:positionMemory(h,''),
      continuity:continuitySignal(h,'')
    };
  }

  // 歩き巫女が「候補が複数」と聞き返した直後の「前者」「2番目」「義輝の方」などを、
  // 元の質問へ差し戻す。候補は実際の直前会話フレームからだけ取り、推測で増やさない。
  function clarificationSelection(text,history){
    var t=S(text);if(!t||t.length>40)return null;
    var h=historyBeforeCurrent(history,t);if(!h.length)return null;
    var frames=topicFrames(h),f=null;
    for(var i=frames.length-1;i>=0&&i>=frames.length-4;i--){
      var x=frames[i],a=S(x&&x.assistantText);
      if(!a)continue;
      if(/(?:(?:複数候補|候補が複数|複数ある|複数の話題).*(?:どれ|どちら|名前|教えて)|(?:どれか|どちらか|どの人).*(?:名前|教えて))/.test(a)){
        f=x;break;
      }
      // 候補確認より後に通常回答が1つでも返っていれば、その確認は解消済み。
      // 古い「どちら？」が次ターンの質問へ再介入するのを防ぐ。
      return null;
    }
    if(!f)return null;
    var candidates=[];
    function add(v){v=S(v);if(v&&candidates.indexOf(v)<0)candidates.push(v);}
    if(f.primary&&f.primary.value)add(f.primary.value);
    (f.secondaryPeople||[]).forEach(add);
    // 人物ではなく Firebase / Firestore のような並行一般テーマの確認でも、
    // 直前の並行スロットから候補を復元する。
    if(candidates.length<2){
      try{
        var pendingParallel=parallelTopics(h.slice(0,Math.max(0,f.index)),f.userText||'');
        (pendingParallel||[]).forEach(function(x){if(x&&x.subject)add(x.subject);});
      }catch(pendingParallelErr){}
    }
    if(candidates.length<2)return null;

    // 「義昭じゃなくて義輝」「前者じゃなくて後者」のような訂正は、
    // 否定された側ではなく「じゃなくて」以降だけを選択回答として読む。
    var selectionText=t,cm=t.match(/(?:じゃなくて|じゃなく|ではなくて|ではなく|でなくて|でなく)[、,\s]*(.+)$/);
    if(cm&&S(cm[1]))selectionText=S(cm[1]);
    var c=C(selectionText),idx=-1,m;
    if(/^(?:どっちでもない|どちらでもない|どれでもない|どの人でもない|違う|ちがう|その二人じゃない|その2人じゃない|その候補じゃない)$/.test(c))
      return {rejected:true,candidates:candidates,kind:'clarification_rejected',frame:f};
    if(/^(?:両方|両方とも|二人とも|2人とも|どっちも|どちらも)$/.test(c)){
      if(candidates.length!==2)return {ambiguous:true,candidates:candidates,kind:'clarification_selection',reason:'both_requires_two',frame:f};
      var both=candidates[0]+'と'+candidates[1],bothBase=S(f.userText),bothMessage='';
      // 「その人は？」「それは？」のような曖昧確認そのものへ「両方」と答えた時は、
      // 代名詞を無理に残さず、2候補を明示した概要質問へ作り直す。
      if(/^(?:その人|この人|あの人|さっきの人|前の人|その選手|この選手|その敵|この敵|それ|これ|その話|この話|そっち|あっち)(?:は|って|について)?[？?！!。]*$/.test(bothBase)){
        bothMessage=both+'、両方について教えて';
      }else if(bothBase){
        bothMessage=bothBase.replace(/(?:その人|この人|あの人|さっきの人|前の人|その選手|この選手|さっきの選手|前の選手|その監督|その投手|その野手|その敵|この敵|あの敵|さっきの敵|前の敵|彼)/,both);
      }
      if(!bothMessage||bothMessage===bothBase)bothMessage=both+'、両方について教えて';
      return {message:bothMessage,selected:both,candidates:candidates,both:true,kind:'clarification_selection',frame:f};
    }
    if(/^(?:前者|最初|最初の人|一人目|1人目|1番目|一番目|上|上の方|上の人)$/.test(c))idx=0;
    else if(/^(?:後者|最後|最後の人|二人目|2人目|2番目|二番目|下|下の方|下の人)$/.test(c)&&candidates.length===2)idx=1;
    else if((m=c.match(/^(?:第)?([1-6])(?:人目|番目|番)?$/)))idx=Number(m[1])-1;
    if(idx<0){
      var hits=[];
      for(i=0;i<candidates.length;i++){
        var cv=C(candidates[i]);
        if(c&&cv&&(cv.indexOf(c)>=0||c.indexOf(cv)>=0||C(selectionText.replace(/(?:の方|のほう|で|です|かな|ね)$/,'')).length>=2&&cv.indexOf(C(selectionText.replace(/(?:の方|のほう|で|です|かな|ね)$/,'')))>=0))hits.push(i);
      }
      if(hits.length===1)idx=hits[0];
      else if(hits.length>1){
        // handle() 内の2段目解決で、1段目が作った「AとB、両方について教えて」を
        // 再び「候補が複数」と判定しない。2候補とも明示されている文は解決済みとして通す。
        if(candidates.length===2&&hits.length===2&&candidates.every(function(v){return C(selectionText).indexOf(C(v))>=0;})){
          return {message:selectionText,selected:candidates[0]+'と'+candidates[1],candidates:candidates,both:true,kind:'clarification_selection',frame:f};
        }
        return {ambiguous:true,candidates:hits.map(function(n){return candidates[n];}),kind:'clarification_selection'};
      }
    }
    if(idx<0||idx>=candidates.length){
      // 確認待ちのまま再び「それ／その話」とだけ聞かれた場合は、先頭候補を勝手に選ばない。
      if(/^(?:(?:じゃあ|では)[、,\s]*)?(?:それ|これ|その話|この話|そっち|あっち)(?:の|は|って|について)?(?:.+)?[？?！!。]*$/.test(selectionText)){
        return {ambiguous:true,candidates:candidates,kind:'clarification_selection',frame:f};
      }
      return null;
    }
    var chosen=candidates[idx],base=S(f.userText),message='';
    // 候補名に質問内容まで明示している場合は、その質問をそのまま正とする。
    // 例: 確認待ち中の「Firestoreの使い方は？」を、元の「それは？」へ戻さない。
    var explicitRemainder=S(selectionText).replace(chosen,'').replace(/^(?:の方|のほう|で|です|かな|ね)$/,'').trim();
    var explicitDetailed=!!(explicitRemainder&&/(?:について|の.{2,}|は.{2,}|って.{2,}|を.{2,}|が.{2,})/.test(explicitRemainder));
    if(explicitDetailed)message=selectionText;
    if(base&&!message){
      message=base.replace(/(?:その人|この人|あの人|さっきの人|前の人|その選手|この選手|さっきの選手|前の選手|その監督|その投手|その野手|その敵|この敵|あの敵|さっきの敵|前の敵|彼)/,chosen);
      // 一般テーマの「それは？」「その話は？」に候補名で答えた場合も、
      // 2回目の文脈解決で先頭候補へ戻らないよう、選んだ対象そのものへ置き換える。
      if(message===base&&/^(?:それ|これ|その件|この件|その話|この話|そっち|あっち)(?:は|って|について)?[？?！!。]*$/.test(base))message=chosen+'について';
      if(message===base&&/(?:どれ|どっち|どちら|誰|だれ)/.test(base))message=chosen+'について'+base;
    }
    if(!message||message===base&&base===t)message=chosen;
    return {message:message,selected:chosen,candidates:candidates,kind:'clarification_selection',frame:f};
  }

  function multiTurnReference(text,history){
    var t=S(text);if(!t||t.length>100)return null;
    var h=historyBeforeCurrent(history,t),m,anchor,tail,ref,pair;
    if(!h.length)return null;

    // 「さっき聞いた家族の続きは？」のように、質問済みの観点から主役を呼び戻す。
    m=t.match(/^(?:じゃあ[、,\s]*)?(?:さっき|前に)(?:聞いた|聞いてた|話した|話してた)?(?:の)?(家族|親族|逸話|昔話|歴史|成績|経歴)(?:の)?(?:話|こと)?(?:の)?続き(?:は|って)?[？?！!。]*$/);
    if(m){
      var aspectMap={家族:'family',親族:'family',逸話:'anecdote',昔話:'anecdote',歴史:'history',成績:'stats',経歴:'career'};
      var af=recentFrameByAspect(h,aspectMap[m[1]]||'');
      if(af&&af.primary&&af.primary.value)return {message:af.primary.value+'の'+m[1]+'について、もう少し続けて',reference:{value:af.primary.value,type:af.primary.type||'topic',domain:af.domain||''},kind:'asked_aspect'};
    }

    // 「家族の話に戻って」「逸話に戻ろう」のように、観点だけで過去の枝へ戻る。
    m=t.match(/^(家族|親族|逸話|昔話|歴史|成績|経歴|現在)(?:の)?(?:話|こと)?(?:に|へ)?戻(?:って|ろう|る|して)(?:[、,\s]*(.*))?[？?！!。]*$/);
    if(m){
      var backAspectMap={家族:'family',親族:'family',逸話:'anecdote',昔話:'anecdote',歴史:'history',成績:'stats',経歴:'career',現在:'current'};
      var bf=recentFrameByAspect(h,backAspectMap[m[1]]||'');
      if(bf&&bf.primary&&bf.primary.value){
        var bt=S(m[2]||'');
        return {message:bf.primary.value+'の'+m[1]+'について'+(bt?'、'+bt:''),reference:{value:bf.primary.value,type:bf.primary.type||'topic',domain:bf.domain||''},kind:'aspect_back'};
      }
    }

    // 「さっきのFirebaseの料金ってどうだった？」「前に話した黒田の成績は？」のように、
    // 名前と観点を明示して過去の枝へ戻る。名前が明示されているため、現在主題とは独立して安全に復帰できる。
    m=t.match(/^(?:さっきの|この前の|前に(?:話した|話してた|話していた|言ってた|言っていた)?)[、,\s]*(.{1,24}?)の(家族|親族|成績|逸話|経歴|歴史|現在|近況|料金|価格|値段|使い方|安全|安全性|メリット|デメリット|注意点|入手方法|取り方|上限|下限|効果|倍率)(?:って)?(?:結局)?(?:どうだった|どうなの|どう|は)?[？?！!。]*$/);
    if(m){
      ref=findSubjectByAnchor(h,m[1]);
      if(ref&&ref.ambiguous)return {ambiguous:true,candidates:ref.candidates||[],kind:'named_history_aspect'};
      if(ref&&ref.value){
        var histAspect=S(m[2]),histMsg=rewriteTopicFollowup(ref.value,histAspect+'は？');
        if(!histMsg)histMsg=ref.value+'の'+histAspect+'について教えて';
        return {message:histMsg,reference:ref,kind:'named_history_aspect'};
      }
    }
    m=t.match(/^(?:さっきの|この前の|前に(?:話した|話してた|話していた|言ってた|言っていた)?)[、,\s]*(.{1,24}?)(?:って|は)[、,\s]*(無料|タダ|安全|必要|使える|利用できる)(?:だった|なの|だったっけ|だっけ|ですか)?[？?！!。]*$/);
    if(m){
      ref=findSubjectByAnchor(h,m[1]);
      if(ref&&ref.ambiguous)return {ambiguous:true,candidates:ref.candidates||[],kind:'named_history_property'};
      if(ref&&ref.value){
        var propMsg=rewriteTopicFollowup(ref.value,S(m[2])+'？');
        if(propMsg)return {message:propMsg,reference:ref,kind:'named_history_property'};
      }
    }

    // 「さっき黒田の話で言ってた家族の方は？」のように、数ターン前の主役を名前で呼び戻す。
    m=t.match(/^(?:じゃあ[、,\s]*)?(?:さっき|前に|この前)(?:の)?(.{1,24}?)(?:の)?話(?:で)?(?:言ってた|言っていた|出てた|出ていた|話してた|話していた|触れてた|触れていた)?[、,\s]*(.+)$/);
    if(m){
      anchor=S(m[1]);tail=S(m[2]);
      ref=findSubjectByAnchor(h,anchor);
      if(ref&&ref.ambiguous)return {ambiguous:true,candidates:ref.candidates||[],kind:'named_history'};
      if(ref&&ref.value){
        tail=tail.replace(/^(?:その|この|あの)/,'').replace(/^(?:人|選手)の/,'');
        return {message:ref.value+'について、'+tail,reference:ref,kind:'named_history'};
      }
    }

    // 「黒田の話に戻って、家族は？」のような明示的な話題復帰。
    m=t.match(/^(.{1,24}?)(?:の)?話(?:に|へ)?戻(?:って|ろう|る|して)[、,\s]*(.+)$/);
    if(m){
      ref=findSubjectByAnchor(h,m[1]);
      if(ref&&ref.ambiguous)return {ambiguous:true,candidates:ref.candidates||[],kind:'named_back'};
      if(ref&&ref.value){
        var namedBackTail=S(m[2]),namedBackMsg=rewriteTopicFollowup(ref.value,namedBackTail);
        if(!namedBackMsg){
          var nbm=namedBackTail.match(/^(家族|親族|成績|逸話|経歴|歴史|現在|近況)(?:は|って)?[？?！!。]*$/);
          if(nbm)namedBackMsg=ref.value+'の'+nbm[1]+'について教えて';
        }
        if(!namedBackMsg)namedBackMsg=ref.value+'について、'+namedBackTail;
        return {message:namedBackMsg,reference:ref,kind:'named_back'};
      }
    }

    // 「前の二人ならどっち？」は、直近で主役だった別人物2人を比較する。
    if(/(?:前|さっき|今まで)(?:の)?(?:二人|2人)/.test(t)&&/(?:なら|どっち|どちら|比べ|比較|違い)/.test(t)){
      var recentPair=recentSubjects(h,{personOnly:true,limit:3});
      if(recentPair.length>=2){
        return {message:recentPair[0].value+'と'+recentPair[1].value+'を比較すると？',reference:recentPair[1],current:recentPair[0],kind:'recent_two_people_compare'};
      }
    }

    // 「その二人ってどういう関係？」は、直近の別人物2人を明示して専門知識側へ渡す。
    // 会話グラフは関係そのものを推測せず、対象人物の特定だけを担う。
    if(/^(?:(?:じゃあ|では|なら)[、,\s]*)?(?:その|この|さっきの|前の)?(?:二人|2人)(?:って|は|の)?(?:どういう|どんな)?(?:関係|つながり|繋がり)(?:なの|ですか|だった|だったの)?[？?！!。]*$/.test(t)){
      var relationPair=recentSubjects(h,{personOnly:true,limit:3});
      if(relationPair.length>=2){
        return {message:relationPair[0].value+'と'+relationPair[1].value+'はどういう関係？',reference:relationPair[1],current:relationPair[0],kind:'recent_two_people_relation'};
      }
    }

    // 「黒田と新井なら？」のように、最近の会話に出た略称2人をフルネームへ戻して比較する。
    m=t.match(/^(.{1,18}?)(?:と|＆|&)(.{1,18}?)(?:(?:なら|だったら|ならば)(?:[、,\s]*(?:どっち|どちら)(?:が)?[^？?！!。]*)?|[、,\s]*(?:どっち|どちら)(?:が)?[^？?！!。]*)[？?！!。]*$/);
    if(m){
      var namedPair=pairFromNamedAnchors(h,m[1],m[2]);
      if(namedPair&&namedPair.ambiguous)return {ambiguous:true,candidates:namedPair.candidates||[],kind:'named_pair'};
      if(namedPair&&namedPair.left&&namedPair.right){
        return {message:namedPair.left.value+'と'+namedPair.right.value+'を比較すると？',reference:namedPair.right,current:namedPair.left,kind:'named_pair_compare'};
      }
    }

    // 「さっき出てきた別の人は？」は、回答内に一人だけ出た脇役人物へ話題を移す。
    if(/^(?:(?:じゃあ|では|なら)[、,\s]*)?(?:さっき|前に|今)(?:の話で)?(?:出てきた|出てた|出ていた|名前(?:が)?出た|触れてた)?(?:別の|ほかの|他の|もう一人の?)(?:人|選手|人物)?(.*)$/.test(t)){
      var sec=latestSecondaryFrame(h);
      if(sec){
        if(sec.people.length>1)return {ambiguous:true,candidates:sec.people.slice(0,6),kind:'secondary_person'};
        var sm=t.match(/(?:人|選手|人物)(.*)$/),ss=S(sm&&sm[1]||'');
        if(!ss||/^(?:は|って)?[？?！!。]*$/.test(ss))ss='について';
        return {message:sec.people[0]+ss,reference:{value:sec.people[0],type:'person',domain:sec.frame.domain||''},kind:'secondary_person'};
      }
    }

    // 「その弟について詳しく」のように、家族回答で示された関係から人物を特定する。
    m=t.match(/^(?:(?:じゃあ|では|なら)[、,\s]*)?(?:その|この|さっきの|前の)?(?:お)?(父|母|兄|弟|姉|妹|息子|娘|妻|夫|奥さん|旦那|配偶者|子供|子ども)(?:さん)?(?:の)?(?:人|方|人物)?(.*)$/);
    if(m){
      var rel=m[1],relKey=rel;
      if(rel==='奥さん')relKey='妻';else if(rel==='旦那')relKey='夫';else if(rel==='子ども')relKey='子供';
      var framesForRel=topicFrames(h);
      for(var rfi=framesForRel.length-1;rfi>=0;rfi--){
        var rf=framesForRel[rfi];if(!rf||rf.aspect!=='family')continue;
        var rp=relationPeopleFromFrame(rf,relKey);
        if(!rp.length)continue;
        if(rp.length>1)return {ambiguous:true,candidates:rp.slice(0,6),kind:'family_relation_person'};
        var rs=S(m[2]||'');if(!rs||/^(?:は|って)?[？?！!。]*$/.test(rs))rs='について';
        return {message:rp[0]+rs,reference:{value:rp[0],type:'person',domain:rf.domain||''},kind:'family_relation_person'};
      }
    }

    // 「その家族の人について詳しく」は、直近の家族回答で主役以外に出た人物へ移る。
    if(/^(?:(?:じゃあ|では|なら)[、,\s]*)?(?:その|この|さっきの|前の)?(?:家族|親族)(?:の)?(?:人|方|人物)(.*)$/.test(t)){
      var fam=latestSecondaryFrame(h,{aspect:'family'});
      if(fam){
        if(fam.people.length>1)return {ambiguous:true,candidates:fam.people.slice(0,6),kind:'family_secondary_person'};
        var fm=t.match(/(?:人|方|人物)(.*)$/),fs=S(fm&&fm[1]||'');
        if(!fs||/^(?:は|って)?[？?！!。]*$/.test(fs))fs='について';
        return {message:fam.people[0]+fs,reference:{value:fam.people[0],type:'person',domain:fam.frame.domain||''},kind:'family_secondary_person'};
      }
    }

    // 「その前の選手と比べると？」は、今の主役と一つ前の別人物を比較する。
    if(/(?:その前|一つ前|ひとつ前|前に話してた|前に話した)(?:の)?(?:選手|人|監督|投手|野手)/.test(t)){
      pair=previousDistinctSubject(h,{personOnly:true});
      if(pair.previous){
        if(/比べ|比較|どっち|違い/.test(t)&&pair.current){
          return {message:pair.current.value+'と'+pair.previous.value+'を比較すると？',reference:pair.previous,current:pair.current,kind:'previous_person_compare'};
        }
        var rewritten=t.replace(/(?:その前|一つ前|ひとつ前|前に話してた|前に話した)(?:の)?(?:選手|人|監督|投手|野手)/,pair.previous.value);
        return {message:rewritten,reference:pair.previous,kind:'previous_person'};
      }
    }

    // 「さっきの選手と前の選手を比べて」のような二重参照。
    if(/(?:さっき|今)(?:の)?(?:選手|人).*(?:前|その前)(?:の)?(?:選手|人)/.test(t)&&/比べ|比較|どっち|違い/.test(t)){
      pair=previousDistinctSubject(h,{personOnly:true});
      if(pair.current&&pair.previous)return {message:pair.current.value+'と'+pair.previous.value+'を比較して',reference:pair.previous,current:pair.current,kind:'two_person_compare'};
    }

    return null;
  }

  function resolveEntityReference(text,history){
    var t=S(text);if(!t||t.length>64)return null;
    // 「それで？」は対象指示の「それ＋で」ではなく、会話を先へ進める短い追質問。
    // ここで「黒田博樹で？」のように人物へ貼り付けず、genericFollowup()へ渡す。
    if(/^(?:それで)[？?]$/.test(t))return null;
    var h=historyBeforeCurrent(history,t),m,suffix,ref;

    m=t.match(/^(?:(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*)?(?:その人|この人|あの人|さっきの人|前の人|その選手|この選手|さっきの選手|前の選手|その監督|さっきの監督|その投手|その野手|その敵|この敵|あの敵|さっきの敵|前の敵|彼)(.*)$/);
    if(m){
      suffix=S(m[1]);
      if(!suffix||/^(?:は|って)?[？?]?$|^(?:の|は|って|について|を|が|も|以外|以外の).+/.test(suffix)){
        // 「その人」はBot回答本文にたまたま列挙された脇役ではなく、現在の会話枝の主役を優先する。
        // ただしユーザー自身が同一発話で複数人物を並べた直後だけは決め打ちしない。
        var activePerson=activeRecentSubject(h,{personOnly:true}),personFrames=topicFrames(h,{limit:12}),personFrame=personFrames.length?personFrames[personFrames.length-1]:null;
        var explicitPeople=[];
        if(personFrame&&Array.isArray(personFrame.userEntities)){
          personFrame.userEntities.forEach(function(x){
            if(!x||x.type!=='person'||!x.value)return;
            var v=S(x.value),merged=false;
            for(var epi=0;epi<explicitPeople.length;epi++){
              var ev=S(explicitPeople[epi]);
              // 「黒田」と「黒田博樹」のような同一人物の略称/フルネームは長い方へ統合する。
              if(ev===v||ev.indexOf(v)>=0||v.indexOf(ev)>=0){
                if(v.length>ev.length)explicitPeople[epi]=v;
                merged=true;break;
              }
            }
            if(!merged)explicitPeople.push(v);
          });
        }
        if(explicitPeople.length>1)return {ambiguous:true,candidates:explicitPeople.slice(0,6),kind:'person'};
        if(activePerson&&activePerson.value)ref=activePerson;
        else ref=findRecentEntity(h,{personOnly:true});
        if(ref&&ref.ambiguous)return {ambiguous:true,candidates:ref.candidates||[],reference:ref,kind:'person'};
        if(ref&&ref.value)return {message:ref.value+(suffix||'について'),reference:ref,kind:'person'};
      }
    }

    m=t.match(/^(?:(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*)?(?:それ|これ|その件|この件|その話|この話|さっきの話|今の話|前の話|さっきの|今の|前の)(.*)$/);
    if(m){
      suffix=S(m[1]);
      // 「その話もっと」の「も」は助詞ではない。ここで「黒田もっと」のように置換せず、
      // genericFollowup() に現在枝の継続要求として渡す。
      if(/^(?:もっと|もう少し|詳しく|くわしく)[？?！!。]*$/.test(suffix))return null;
      // 「それいいね」等の感想は参照解決しない。
      if(suffix&&!/^(?:は|って)?[？?]?$|^(?:の|は|って|について|を|が|で|も|以外|以外の).+/.test(suffix))return null;
      // 一般テーマも人物と同様、現在の会話枝のprimaryを優先する。
      // Firebaseの回答にFirestoreが出ても「それ」が勝手にFirestoreへ飛ばない。
      var activeEntity=activeRecentSubject(h),entityFrames=topicFrames(h,{limit:12}),entityFrame=entityFrames.length?entityFrames[entityFrames.length-1]:null;
      var explicitEntities=[];
      if(entityFrame&&Array.isArray(entityFrame.userEntities)){
        entityFrame.userEntities.forEach(function(x){if(x&&x.value&&explicitEntities.indexOf(x.value)<0)explicitEntities.push(x.value);});
      }
      if(explicitEntities.length>1)return {ambiguous:true,candidates:explicitEntities.slice(0,6),kind:'entity'};
      ref=activeEntity&&activeEntity.value?activeEntity:findRecentEntity(h);
      if(ref)return {message:ref.value+(suffix||'について'),reference:ref,kind:'entity'};
    }
    return null;
  }

  // 相槌・言い換え要求・短い追質問は「新しい話題」ではない。
  // 会話枝や「前の話」を作る時に主題として残さず、直前の実質的な話題を維持する。
  function isFollowupOnlyUtterance(text){
    var t=S(text);if(!t||t.length>48)return false;
    if(/^(?:うん|うんうん|はい|そっか|そうか|そうなんだ|そうなんだね|そうなんか|そうなんよ|なるほど|なるほどね|なるほどな|へえ|へー|ふーん|まあね|まあな|たしかに|確かに|たしかにな|それな|ほんとそれ|わかる|分かる|わかるわ|分かるわ|わかりみ|そういうことね|そういうことか|そんな感じ|まあそんなもん|だよね|ですよね|そうそう|せやな|せやねん|了解|りょ|OK|ok|おけ|おっけ|わかった|分かった|ありがとう|ありがと)[。！!？?\s]*$/.test(t))return true;
    if(/^(?:マジ(?:で|か)?|まじ(?:で|か)?|うそでしょ|嘘でしょ|そうなん|そうなの)[？?。！!\s]*$/.test(t))return true;
    if(/^(?:わからんでもない|分からんでもない|わからないでもない|分からないでもない|まあいっか|ま[、,\s]*いっか|知らんけど|知らないけど|別にいいけど|ちょっと待って|それはそれとして|それはそうと|それは置いといて|それは置いておいて|あとでいい|後でいい|話戻すけど)[。！!？?\s]*$/.test(t))return true;
    if(/^(?:どゆこと|どういうこと|どういう意味|まだ(?:よく)?(?:わからん|分からん|わかんない|分かんない|わかんね|分かんね)|わかんない|分かんない|わかんね|分かんね|意味わからん|意味分からん|何言ってるかわからん|何言ってるか分からん)[？?。！!\s]*$/.test(t))return true;
    if(/^(?:もう一回|もう一度|もっかい|もっぺん|もっと短く|簡単に(?:言って)?|ざっくり(?:言うと)?|一言で|ひとことで|具体的には|具体的に|例ある|例は|たとえば|例えば|例で教えて|例を出して)[？?。！!\s]*$/.test(t))return true;
    if(/^(?:それで|で|んで|そんで|ほんで|それから|続き|続きは|結局|要するに|つまり|もっと|もう少し|詳しく|他には|ほかには|ほかは|それだけ|もっとある|逆に|じゃあ逆に|メリットは|デメリットは)[？?。！!\s]*$/.test(t))return true;
    if(/^(?:いつ|いつの話|いつのこと|どこ|どこの話|どこのこと|誰|だれ|昔は|以前は|前は|何があった|なにがあった|何が起きた|なにが起きた)[？?。！!\s]*$/.test(t))return true;
    if(/^(?:(?:それ|これ)(?:って|は)?|(?:その|この)(?:機能|サービス|仕組み)(?:って|は)?)?[、,\s]*(?:何ができる|なにができる|どう使う|どうやって使う|使い方(?:は|って)?|使える|利用できる|料金(?:は|って)?|値段(?:は|って)?|価格(?:は|って)?|無料|タダ|何に使う|なにに使う|どこで使う|どこで使える|必要|難しい|むずかしい|簡単|かんたん|安全|いつから|いつ頃から|いつごろから|何が違う|なにが違う|他と何が違う|ほかと何が違う|実際どう|どんな感じ|どんな時に使う|どんなときに使う|誰向け|だれ向け|どんな人向け|向いてる人(?:は)?|向いている人(?:は)?|初心者でも使える|初心者向け|実用的|便利|有名|人気|今も使われてる|現在も使われている|将来性(?:は)?|一番の利点(?:は)?|主な利点(?:は)?|良い点(?:は)?|いい点(?:は)?|注意点(?:は)?|代わり(?:は)?|代替(?:は)?|他に似たのある|ほかに似たのある|結局使うべき|使った方がいい|使ったほうがいい|おすすめする|結局おすすめ|導入難しい|導入は難しい|学ぶの大変|覚えるの大変)[？?。！!\s]*$/.test(t))return true;
    if(/^(?:あとさ|あとね|でさ|でね|それでさ|それでね|ていうかさ|というかさ|てかさ|つーかさ|でもさ|たださ|いやさ|でもまあ|まあでも|いやでも|いやまあ|うーん|んー|えっと|あの)[、,…\.\s]*$/.test(t))return true;
    return false;
  }

  function lastSubstantiveUser(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0&&i>=h.length-18;i--){
      if(!h[i]||h[i].role!=='user')continue;
      var t=S(h[i].text);
      if(!t)continue;
      if(isFollowupOnlyUtterance(t))continue;
      if(/^(?:もっと|詳しく|くわしく|なんで|なぜ|どうして|それ|これ|じゃあ|では|なら|順位|選手|明日|今日)[？?]?$/.test(t))continue;
      return t;
    }
    return'';
  }

  function shortFollowup(text){
    var t=S(text);
    return t.length>0&&t.length<=18;
  }

  function cleanFollowupTarget(text){
    var t=S(text)
      .replace(/^(?:じゃあ|では|なら|それじゃ|それなら|次は|つぎは)[、,\s]*/,'')
      .replace(/[？?！!。]+$/,'')
      .trim();
    t=t.replace(/(?:は|って|の方|のほう)$/,'').trim();
    return t;
  }

  function recentText(history,pattern,limit){
    var h=filterHistory(history),n=Number(limit)||20;
    for(var i=h.length-1;i>=0&&i>=h.length-n;i--){
      var t=S(h[i]&&h[i].text);
      if(t&&pattern.test(t))return t;
    }
    return'';
  }

  function recentCarpSubtopic(history){
    if(recentText(history,/逸話|昔話|名場面|伝説|他の逸話|別の逸話/,24))return'anecdote';
    if(recentText(history,/順位|何位|ゲーム差|勝率|何勝|何敗/,18))return'rank';
    if(recentText(history,/選手|メンバー|投手|野手|捕手|内野手|外野手|監督|コーチ/,18))return'players';
    if(recentText(history,/日程|予定|次の試合|今日(?:の)?試合|明日(?:の)?試合|明後日(?:の)?試合|試合ある|対戦相手/,18))return'schedule';
    if(recentText(history,/結果|スコア|勝った|勝って|負けた|負けて|引き分け|昨日(?:の)?試合|一昨日(?:の)?試合/,18))return'result';
    if(recentText(history,/歴史|創設|球団名|昔の名前/,18))return'history';
    return'';
  }

  function recentJinpoStatStyle(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0&&i>=h.length-18;i--){
      if(!h[i]||h[i].role!=='user')continue;
      var t=S(h[i].text);
      if(!t)continue;
      var stat=(t.match(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/)||[])[0]||'';
      if(!stat)continue;
      if(/高い|高め|強い|おすすめ|一番|最も|トップ|最大|重視/.test(t)){
        return {stat:stat,kind:'high'};
      }
    }
    return null;
  }

  function isMoreCue(text){
    return /^(?:もっと|他にも|ほかにも|他には|ほかには|別のも|別の|もう一つ|もう1つ|続き|つづき|まだある|もっとある|それだけ|ほかは)[？?！!。]*$/.test(S(text));
  }

  function recentCounterAmbiguity(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0&&i>=h.length-10;i--){
      if(!h[i]||h[i].role!=='assistant')continue;
      var raw=String(h[i].text||'');
      if(/候補が複数/.test(raw)&&/場所か名前/.test(raw))return true;
    }
    return false;
  }

  function counterCandidateSelector(text){
    var t=S(text)
      .replace(/^(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*/,'')
      .replace(/[？?！!。]+$/,'')
      .trim();

    if(!t||t.length>40)return false;

    t=t
      .replace(/^(?:いや|違う|ちがう|そうじゃない|それじゃない|そっちじゃない|訂正|やっぱり|やっぱ|ごめん|すまん|まちがえた|間違えた)[、,\s]*/,'')
      .trim();
    var parts=t.split(/(?:じゃなくて|じゃなく|ではなくて|ではなく|でなくて|でなく)/);
    if(parts.length>=2)t=parts[parts.length-1].trim();

    if(/^(?:[1-6一二三四五六](?:番|番目|つ目)?|上から[1-6一二三四五六](?:番|番目|つ目)?|最初|一番上|上(?:のやつ|の方|のほう)?|真ん中|中(?:のやつ|の方|のほう)?|最後|一番下|下(?:のやつ|の方|のほう)?)$/.test(t))return true;

    if(/桶狭間|富士地下洞穴|武技大会|大会天|大会地|京都|二条城|修羅の間|封印/.test(t))return true;
    if(/今川義元|今川氏真|足利義輝|足利義昭|義元|氏真|義輝|義昭/.test(t))return true;

    return false;
  }

  function isCounterCandidateFollowup(text,history){
    return recentCounterAmbiguity(history)&&counterCandidateSelector(text);
  }

  function isToolDatasetDomain(domain){
    return domain==='tsukumo'||domain==='kishin'||domain==='madou';
  }

  function toolDatasetLabel(domain){
    if(domain==='tsukumo')return'九十九';
    if(domain==='kishin')return'鬼神石';
    if(domain==='madou')return'魔導結晶';
    return'';
  }

  function portableToolIntentFromText(text){
    var t=S(text),stat=(t.match(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/)||[])[0]||'';
    var num=0,m=t.match(/([0-9０-９]{1,4})\s*(?:番|ばん)(?!目)/);
    if(m){
      num=Number(m[1].replace(/[０-９]/g,function(c){
        return String.fromCharCode(c.charCodeAt(0)-0xFEE0);
      }))||0;
    }

    var top=0;
    m=t.match(/(?:トップ|top|上位)\s*([1-9１-９][0-9０-９]?)/i);
    if(m){
      top=Number(m[1].replace(/[０-９]/g,function(c){
        return String.fromCharCode(c.charCodeAt(0)-0xFEE0);
      }))||0;
    }

    var ranking=!!(stat&&/一番|いちばん|最大|最高|トップ|top|上位|高い|高め|強い/.test(t));
    if(ranking&&!top)top=1;

    if(stat)return {kind:ranking?'stat_ranking':'stat',stat:stat,top:top};
    if(num)return {kind:'number',number:num};
    return null;
  }

  function recentPortableToolIntent(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0&&i>=h.length-18;i--){
      if(!h[i]||h[i].role!=='user')continue;
      var d=domainFromText(h[i].text||'');
      if(!isToolDatasetDomain(d))continue;
      var intent=portableToolIntentFromText(h[i].text||'');
      if(intent){
        intent.domain=d;
        return intent;
      }
    }
    return null;
  }

  function isDatasetOnlySwitch(text,domain){
    if(!isToolDatasetDomain(domain))return false;

    var t=S(text)
      .replace(/^(?:じゃあ|では|なら|それじゃ|それなら|次は|つぎは)[、,\s]*/,'')
      .replace(/[？?！!。]+$/,'')
      .trim();

    if(domain==='tsukumo')t=t.replace(/九十九|つくも/g,'');
    if(domain==='kishin')t=t.replace(/鬼神石|きしん(?:せき)?/g,'');
    if(domain==='madou')t=t.replace(/魔導結晶|魔導|まどう(?:けっしょう)?/g,'');

    t=t.replace(/^(?:で|では|は|なら|だと|の場合|の方|のほう)+/,'')
       .replace(/(?:で|では|は|なら|だと|の場合|の方|のほう)+$/,'')
       .trim();

    // 今の入力に新しい条件が書かれているなら、古い条件を足さない。
    if(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/.test(t))return false;
    if(/[0-9０-９]+\s*(?:番|ばん|位)/.test(t))return false;
    if(/トップ|top|上位|一番|最大|最高|高い|高め|強い/.test(t))return false;
    if(/入手|どこで|取れる|取り方|詳細|全部|他の能力|ほかの能力/.test(t))return false;

    return t===''||/^(?:で|では|は|なら|だと|の場合|の方|のほう)*$/.test(t);
  }

  function carryExplicitToolDatasetSwitch(text,currentDomain,previousDomain,history){
    if(!isToolDatasetDomain(currentDomain))return'';
    if(!isToolDatasetDomain(previousDomain))return'';
    if(currentDomain===previousDomain)return'';
    if(!isDatasetOnlySwitch(text,currentDomain))return'';

    var intent=recentPortableToolIntent(history);
    if(!intent)return'';

    var label=toolDatasetLabel(currentDomain);
    if(intent.kind==='stat_ranking'){
      if(intent.top>1)return label+'で'+intent.stat+'トップ'+intent.top;
      return label+'で'+intent.stat+'一番高いのは？';
    }
    if(intent.kind==='stat')return label+'の'+intent.stat+'は？';
    if(intent.kind==='number')return label+intent.number+'番は？';
    return'';
  }

  function carryByDomain(text,domain,history){
    var t=S(text);
    if(!domain)return'';

    if(domain==='carp'){
      var ct=t.replace(/^(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*/,'');
      var ctCore=ct.replace(/は(?=[？?]?$)/,'');
      // 人物を主役に話している最中の「逸話」だけは、チーム全体の逸話へ飛ばさない。
      // 回答文に別人物が出ていても、ユーザー側で保持した primary を優先する。
      var carpPerson=activeRecentSubject(history,{personOnly:true});
      if(carpPerson&&carpPerson.value&&/^(?:逸話|昔話)[？?]?$/.test(ctCore)){
        return carpPerson.value+'の逸話について';
      }
      if(/^(?:順位|何位|なんい|選手|選手一覧|メンバー|日程|予定|結果|試合結果|先発|スタメン|打率|本塁打|防御率|誰がいる|逸話|他の逸話|別の逸話|昔話|歴史|名場面|伝説|スター|名選手)[？?]?$/.test(ctCore)){
        return'カープの'+ctCore;
      }
      var dayOnly=t.replace(/^(?:じゃあ|では|なら|それじゃ|それなら)[、,\s]*/,'');
      if(/^(?:今日|きょう|昨日|きのう|明日|あした|明後日|あさって|一昨日|おととい)(?:は)?[？?]?$/.test(dayOnly)){
        var subDay=recentCarpSubtopic(history);
        var dword=dayOnly.replace(/(?:は)?[？?]$/,'');
        if(subDay==='result')return'カープの'+dword+'の試合結果';
        return'カープの'+dword+'の試合';
      }

      if(isMoreCue(t)){
        // 人物の会話枝が生きている時は、回答本文に「選手」等が出ていてもチーム全体へ飛ばさない。
        // 例: 黒田の家族 →「もっと」 = 黒田の家族の続き。
        if(carpPerson&&carpPerson.value&&carpPerson.aspect&&ASPECT_LABELS[carpPerson.aspect]){
          return carpPerson.value+'の'+ASPECT_LABELS[carpPerson.aspect]+'について、もう少し続けて';
        }
        var sub=recentCarpSubtopic(history);
        if(sub==='anecdote')return'カープの他の逸話';
        if(sub==='players')return'カープの選手をもう少し';
        if(sub==='history')return'カープの歴史をもう少し詳しく';
      }
    }

    if(domain==='counter'){
      // 候補一覧の続きは、候補選択エンジンへ生のまま渡す。
      if(isCounterCandidateFollowup(t,history))return t;

      if(!counterCue(t)&&shortFollowup(t)&&
         !/ページ|サイト|リンク|開いて|どこにある/.test(t)&&
         !/^(?:もっと|詳しく|なんで|なぜ|どうして)$/.test(t)){
        var target=cleanFollowupTarget(t);
        if(target&&target.length<=18){
          return target+'のカウンターは？';
        }
      }
    }

    if(domain==='jinpo'){
      var jt=cleanFollowupTarget(t);
      var stat=(jt.match(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/)||[])[0]||'';
      if(stat&&shortFollowup(t)&&!/陣形|因縁|英傑|全MAX/.test(t)){
        var prev=recentJinpoStatStyle(history);
        if(prev&&prev.kind==='high'&&!/高い|高め|一番|最も|トップ|最大|おすすめ|重視/.test(jt)){
          return stat+'高いの';
        }
      }
    }

    if(domain==='tsukumo'&&shortFollowup(t)&&!/九十九|つくも/.test(t))
      if(/番|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風|入手|どこで|取れる|とれる|取り方|トップ|一番|詳細|全部|他の能力|ほかの能力/.test(t))return'九十九の'+t;

    if(domain==='kishin'&&shortFollowup(t)&&!/鬼神石|きしん/.test(t))
      if(/番|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風|入手|どこで|取れる|とれる|取り方|トップ|一番|詳細|全部|他の能力|ほかの能力/.test(t))return'鬼神石の'+t;

    if(domain==='madou'&&shortFollowup(t)&&!/魔導|まどう/.test(t))
      if(/番|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風|入手|どこで|取れる|とれる|取り方|トップ|一番|詳細|全部|他の能力|ほかの能力/.test(t))return'魔導結晶の'+t;

    return'';
  }

  // 「今はどうなんだろう」「その後どうなった？」のような、
  // 主語を省いた自然な続き方を直前の回答側の人物・出来事へ接続する。
  function openEndedFollowup(text,history){
    var t=S(text);
    if(!t||t.length>36)return null;

    var kind='';
    if(/^(?:じゃあ[、,\s]*)?(?:今は|今だと|現在は|今現在は|今のところは|いまは)?(?:どうなんだろう|どうなんだろ|どうなの|どうなってる(?:の)?|どうなっている(?:の)?|どうなんですか|どうですか)[？?！!。]*$/.test(t) ||
       /^(?:じゃあ[、,\s]*)?(?:今|現在)(?:は)?[？?！!。]*$/.test(t))kind='current';
    else if(/^(?:(?:じゃあ|で|結局)[、,\s]*)?(?:(?:その後|それから|以後|そのあと)(?:は|って)?)?(?:どうなった(?:の)?|どうなってる(?:の)?|どうなったんだろう|どうだった(?:の)?)?[？?！!。]*$/.test(t) && /(?:その後|それから|以後|そのあと|どうなった|どうなってる|どうだった)/.test(t))kind='after';
    if(!kind)return null;

    var h=historyBeforeCurrent(history,t);
    if(!h.length)return null;

    var person=findRecentEntity(h,{personOnly:true});
    if(person&&person.ambiguous){
      return {ambiguous:true,candidates:person.candidates||[],kind:kind};
    }

    // 人物に限定せず、見出し化された出来事・制度なども直前の主題として使う。
    var ref=findRecentEntity(h);
    if(!ref&&person&&person.value)ref=person;
    // 「それから？」「どうなった？」も、人物名だけでなく直近の「家族/逸話」等の枝を優先。
    var target=followupBranchBase(h,t)||(ref&&ref.value?ref.value:'');
    if(!target){
      var ant=lastSubstantiveUser(h);
      if(ant)target=cleanFollowupTarget(ant);
    }
    if(!target)return null;

    return {
      message:kind==='current'
        ?target+'について、現在はどうなっている？'
        :target+'について、その後どうなった？',
      reference:ref||null,
      kind:kind
    };
  }

  // 「さっきの説明と違う」のような指摘では、可能なら直前の事実質問そのものへ戻して
  // 正本・実データ側へ再ルーティングする。操作系コマンドは勝手に再実行しない。
  function conflictRecheckTarget(history,currentMessage){
    var sig=continuitySignal(history,currentMessage);
    if(!sig||sig.type!=='assistant_conflict')return null;
    var h=historyBeforeCurrent(history,currentMessage),frames=topicFrames(h);
    for(var i=frames.length-1;i>=0&&i>=frames.length-10;i--){
      var f=frames[i],u=S(f&&f.userText),d=S(f&&f.domain);
      if(!u||!S(f.assistantText))continue;
      if(isExplicitTopicShift(u))continue;
      // 検索・適用・解除・変更などのサイト操作は、矛盾指摘だけで再実行しない。
      if(/(?:検索して|探して|適用|解除|全解除|差替|差し替|変更して|にして|使って|入れて|除外|固定|戻して|実行して|押して)/.test(u))continue;
      var factual=factCue(u)||['carp','counter','tsukumo','kishin','madou','weather'].indexOf(d)>=0||
        /(?:教えて|知りたい|とは|って何|ってなに|誰|だれ|いつ|どこ|なぜ|なんで|どうして|意味|由来|歴史|家族|成績|逸話|現在|順位|結果)/.test(u);
      if(!factual)continue;
      return {message:u,domain:d,frame:f,kind:'assistant_conflict_recheck'};
    }
    return null;
  }

  // 並行して保持している2項目について、「いや前者」「違う、後の方」のように
  // 直前の選択だけを訂正する短文を扱う。通常の「前の話に戻る」と混同しないよう、
  // 明示的な訂正語 + 前者/後者系の表現がそろった時だけ発動する。
  function parallelSelectionCorrection(text,history){
    var t=S(text);if(!t||t.length>64)return null;
    var normalized=parallelCorrectionResumeText(t);if(!normalized)return null;
    var restored=restoreParallelTopic(history,normalized);
    if(!restored||!restored.restoreMessage)return null;
    return {
      message:restored.restoreMessage,
      domain:restored.domain||'',
      kind:'parallel_selection_correction',
      subject:restored.primary&&restored.primary.value||'',
      aspect:aspectFromText(restored.restoreMessage)||'',
      restored:restored
    };
  }

  function normalizeCorrectionSubjectTarget(value,history){
    var raw=S(value);if(!raw)return raw;
    var x=raw
      .replace(/^(?:今の|いまの|さっきの|直前の)[、,\s]*/,'')
      .replace(/(?:の方|のほう)$/,'')
      .trim();
    if(!x)return raw;

    // 「今の新井の方」のような言い方では、「今」を最新情報要求とは見なさず、
    // 実際に直近で話した主役の中から一意に一致する人物/話題へ戻す。
    var recent=recentSubjects(history,{limit:10}),hits=[],cx=C(x);
    (recent||[]).forEach(function(item){
      var v=S(item&&item.value);if(!v)return;
      var cv=C(v);if(!cv||!cx)return;
      if(cv===cx||cv.indexOf(cx)>=0||cx.indexOf(cv)>=0){if(hits.indexOf(v)<0)hits.push(v);}
    });
    if(hits.length===1)return hits[0];
    return x;
  }

  function correctionFollowup(text,history){
    var t=S(text);if(!t||t.length>110)return null;
    var repair=utteranceRepair(history,t),strippedPrefix=stripCorrection(t);
    // 「いやFirestore」のように区切りを省いた一般テーマ訂正。
    // 普通の「いや無理」「いや面白い」まで訂正扱いしないよう、現在ローカル説明対象の固有テーマだけ許可する。
    var compactTopic=t.match(/^(?:いや|違う|ちがう)[、,\s]*(Firebase|Firestore)[。！!？?\s]*$/i);
    var selectorCorrection=!!(strippedPrefix&&strippedPrefix.corrected&&/^(?:(?:今の|いまの|さっきの|直前の)[、,\s]*)?.{2,28}(?:の方|のほう)$/.test(S(strippedPrefix.text)));
    // 「いや成績」「違う家族」のように区切りを省いた短い訂正は、
    // 右側が既知の観点語で、直前に具体的な主題がある時だけ訂正として扱う。
    // 「いや面白い」など普通の反応まで訂正扱いしない。
    var compactAspect=t.match(/^(?:いや|違う|ちがう)[、,\s]*(家族|親族|逸話|昔話|歴史|成績|経歴|現在|順位|日程|結果|カウンター)(?:の話|について)?[。！!？?\s]*$/);
    if((!repair||repair.type!=='correction')&&!compactAspect&&!compactTopic&&!selectorCorrection)return null;
    // サイト操作の訂正はここで会話文へ変換せず、陣法parser等へそのまま渡す。
    if(/(?:検索|探して|適用|解除|全MAX|差替|差し替|配置|除外|固定|実行|押して)/.test(t))return null;

    var positive=compactAspect?S(compactAspect[1]):(compactTopic?S(compactTopic[1]):(selectorCorrection?S(strippedPrefix.text):'')),m=t.match(/(?:じゃなくて|じゃなく|ではなくて|ではなく|でなくて|でなく)[、,\s]*(.+)$/);
    if(!positive&&m)positive=S(m[1]);
    if(!positive){
      positive=t.replace(/^(?:いや[、,\s]*)?(?:違う|ちがう|そうじゃなくて|そうじゃなく|そこじゃなくて|そこじゃなく|訂正(?:すると)?|正しくは|正確には)[、,\s]*/,'').trim();
    }
    positive=positive.replace(/^(?:その|こっちの|あっちの)[、,\s]*/,'')
      .replace(/(?:のこと|の話|について)$/,'').replace(/[？?！!。]+$/,'').trim();
    positive=normalizeCorrectionSubjectTarget(positive,history);
    if(!positive||positive.length>42)return null;

    var frames=topicFrames(history),prev=null;
    for(var i=frames.length-1;i>=0;i--){if(frames[i]&&frames[i].primary&&frames[i].primary.value){prev=frames[i];break;}}
    var asp=aspectFromText(positive),labels={family:'家族',anecdote:'逸話',history:'歴史',stats:'成績',career:'経歴',current:'現在',rank:'順位',schedule:'日程',result:'結果',compare:'比較',counter:'カウンター'};

    // 「違う、新井の家族」のように、訂正後の主語と観点を同時に明示した場合は
    // 直前主語へ観点だけ戻さず、訂正後の主語＋観点をそのまま採用する。
    var explicitSubjectAspect=positive.match(/^(.{1,28}?)の(家族|親族|逸話|昔話|歴史|成績|経歴|現在|順位|日程|結果|カウンター)(?:について)?$/);
    if(explicitSubjectAspect){
      var explicitSubject=S(explicitSubjectAspect[1]),explicitAspectLabel=S(explicitSubjectAspect[2]);
      var explicitAspect=aspectFromText(explicitAspectLabel)||asp;
      if(explicitSubject&&explicitAspect){
        return {message:explicitSubject+'の'+(labels[explicitAspect]||explicitAspectLabel)+'について',domain:prev&&prev.domain||domainFromText(explicitSubject)||'',kind:'subject_aspect_correction',aspect:explicitAspect,subject:explicitSubject};
      }
    }

    if(asp&&prev&&prev.primary&&prev.primary.value){
      return {message:prev.primary.value+'の'+(labels[asp]||positive)+'について',domain:prev.domain||'',kind:'aspect_correction',aspect:asp,subject:prev.primary.value};
    }

    // 訂正後が短い固有名・話題なら、現在の観点だけを引き継ぐ。
    // 「新井」のような姓だけはここで人物を決め打ちせず、その文字列のまま専用知識へ渡す。
    if(!/[？?]/.test(positive)&&positive.length<=28){
      var prevAsp=prev&&prev.aspect||'',label=labels[prevAsp]||'';
      var msg=positive+(label&&prevAsp!=='overview'?'の'+label+'について':'について');
      return {message:msg,domain:prev&&prev.domain||'',kind:'subject_correction',aspect:prevAsp,subject:positive};
    }
    return null;
  }

  // 短い追質問で使う対象は、単なる直前ユーザー文より会話グラフ上の具体的な枝を優先する。
  // 例: 「黒田について」→「家族は？」の後の「続きは？」を「黒田の家族」へつなぐ。
  function followupBranchBase(history,currentText){
    var branches=recentTopicBranches(history,currentText||'');
    if(branches&&branches.length&&branches[0]&&branches[0].message){
      return S(branches[0].message).replace(/[？?！!。]+$/,'')
        .replace(/(?:について)?(?:教えて|説明して|知りたい|詳しく|くわしく)$/,'')
        .replace(/(?:って何|ってなに|とは|って)$/,'')
        .replace(/について$/,'').trim();
    }
    var ant=lastSubstantiveUser(history);
    if(!ant)return'';
    return ant.replace(/[？?！!。]+$/,'')
      .replace(/(?:について)?(?:教えて|説明して|知りたい|詳しく|くわしく)$/,'')
      .replace(/(?:って何|ってなに|とは|って)$/,'').trim();
  }

  // 「どう思う？」「それってあり？」など、直前の具体的な枝への意見要求。
  // 「それ」を人物名へ直接置換すると「黒田博樹ってあり？」のような不自然な文になるため、
  // 通常の指示語解決より先に“意見要求”として扱う。
  function isOpinionFollowupCue(text){
    var t=S(text);if(!t||t.length>48)return false;
    return /^(?:それ(?:について)?[、,\s]*)?(?:どう思う|どう感じる|どうかな|率直にどう)(?:の|かな|ですか)?[？?]*$/.test(t)||
      /^(?:(?:でも|じゃあ)[、,\s]*)?(?:(?:それ|これ)(?:って|は)?[、,\s]*)?(?:どうなの|どうなんだろう|あり|アリ|なし|ナシ)(?:だと思う|かな|ですか)?[？?]*$/.test(t)||
      /^(?:どっち|どちら)(?:が|の方が|のほうが)?(?:いい|良い|よさそう|良さそう|無難|見やすい|自然|おすすめ)(?:と思う|かな|ですか)?[？?]*$/.test(t)||
      /^おすすめ(?:は|って)?[？?]*$/.test(t);
  }

  function activeRecentSubject(history,opt){
    opt=opt||{};
    var frames=topicFrames(history,{limit:12});
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];if(!f)continue;
      var u=S(f.userText||'');
      if(f.primary&&f.primary.value){
        if(opt.personOnly&&f.primary.type!=='person')return null;
        return {value:S(f.primary.value),type:f.primary.type||'topic',domain:f.domain||'',aspect:f.aspect||'',frameIndex:i,userText:u,assistantText:S(f.assistantText||'')};
      }
      if(!u)continue;
      // 挨拶・相槌・短い追質問は主題を切り替えない。
      if(isResumeNoise(u)||isFollowupOnlyUtterance(u)||isBackCue(u)||isGeneralResumeCue(u)||isConversationRecallCue(u))continue;
      // 実質的な別話題が一つでも入ったら、昔の人物・機能を裸の省略質問で復活させない。
      return null;
    }
    return null;
  }

  function followupPrimarySubject(history){
    var a=activeRecentSubject(history)||null;
    return a&&a.value?S(a.value):'';
  }

  function genericFollowup(text,history){
    var t=S(text),ant=lastSubstantiveUser(history);
    if(!ant)return'';

    // 「その話もっと」「今の話もう少し」は、単なる相槌ではなく現在枝の続きを求める表現。
    t=t.replace(/^(?:(?:その|この|今の|さっきの|前の)話|(?:その|この|さっきの|前の)(?:人|選手))[、,\s]*(?=(?:もっと|もう少し|詳しく|くわしく)[？?！!。]*$)/,'');

    var d=recentDomain(history),base=followupBranchBase(history,t);
    var subjectInfo=activeRecentSubject(history)||null;
    var subject=subjectInfo&&subjectInfo.value?S(subjectInfo.value):followupPrimarySubject(history);
    var personSubject=subjectInfo&&subjectInfo.type==='person'?subject:'';

    // 「家族」「成績」「経歴」など観点だけを短く言った時は、
    // 直前にユーザーが主役として話していた人物へ安全に接続する。
    // 回答内に出た脇役人物ではなく topicFrames の primary を使う。
    if(personSubject){
      var aspectOnlyMap={
        family:'家族',anecdote:'逸話',history:'歴史',stats:'成績',career:'経歴',current:'現在',
        rank:'順位',schedule:'日程',result:'結果',compare:'比較',counter:'カウンター'
      };
      var aspectOnly=aspectFromText(t);
      if(aspectOnly&&aspectOnlyMap[aspectOnly]&&
         /^(?:家族|親族|逸話|昔話|歴史|成績|経歴|現役時代|現在|近況|順位|日程|予定|結果|比較|カウンター)(?:は|って|について)?[？?！!。]*$/.test(t)){
        return personSubject+'の'+aspectOnlyMap[aspectOnly]+'について';
      }
    }

    // 人物・主題を省いた、日常的な短い追質問。
    if(/^(?:(?:まだ|ちょっと)?(?:よく)?(?:分からん|わからん|分からない|わからない|分かんない|わかんない|分かんね|わかんね)|(?:意味分からん|意味わからん|何言ってるか分からん|何言ってるかわからん))[？?。！!]*$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、もう少し分かりやすく説明して';
    if(/^(?:もう一回|もういっかい|もう一度|もういちど|もっかい|もっぺん)(?:お願い|説明して|教えて)?[？?。！!]*$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、もう一度説明して';
    if(/^(?:もっと)?(?:簡単|かんたん)(?:に|にして|に説明して|に言って)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、もっと簡単に説明して';
    if(/^(?:もっと)?(?:短く|みじかく)(?:して|言って|説明して)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、もっと短く説明して';
    if(/^(?:例えば|たとえば)(?:は|って)?[？?]?$|^(?:例|具体例)(?:は|ある|あるの|って)?[？?]?$|^(?:例で教えて|例を出して|具体例を出して)[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、具体例を一つ挙げて';
    if(/^(?:ざっくり|ざっくり言うと|大まかに|おおまかに)[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、ざっくり要点だけ説明して';
    if(/^(?:一言で|ひとことで|一言なら|ひとことなら)[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、一言で要点を説明して';
    if(/^(?:具体的には|具体的に)(?:どういうこと|教えて|説明して)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、具体的に説明して';
    if(/^(?:いつ|いつの話|いつのこと)(?:なの|ですか)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、直前の話はいつのこと？';
    if(/^(?:どこ|どこの話|どこのこと)(?:なの|ですか)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、直前の話はどこのこと？';
    if(/^(?:昔は|以前は|前は)(?:どう|どうだった)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、以前はどうだった？';
    if(/^(?:何があった|なにがあった|何が起きた|なにが起きた)(?:の|んですか)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、何があったの？';

    // 人物以外の機能・サービス・一般テーマでも、短い省略追質問は直前の説明対象へつなぐ。
    // 雑談の出来事そのものは topicFrames に主題として残らないため、むやみに前の一言へ連結しない。
    var actionLikeAnt=/(?:検索して|探して|適用|解除|全解除|差替|差し替|配置|除外|固定|実行して|押して|変更して|にして|使って|入れて)/.test(ant);
    var priorKnowledgeQuestion=/(?:について|って何|ってなに|とは|教えて|説明して|知りたい|詳しく|使い方|機能|仕組み)/.test(ant)||(!actionLikeAnt&&!!d);
    // 検索・適用などの操作命令そのものに「無料？」「安全？」を貼り付けない。
    var generalTarget=subject||(!actionLikeAnt&&priorKnowledgeQuestion?base:'');
    if(generalTarget){
      // 「それ無料？」「その機能どう使う？」のような短い指示語は、
      // 明確な説明対象が残っている時だけその対象へ戻す。
      var generalCue=t.replace(/^(?:(?:それ|これ)(?:って|は)?|(?:その|この)(?:機能|サービス|仕組み)(?:って|は)?)[、,\s]*/,'');
      if(!generalCue)generalCue=t;
      var sharedGeneralRewrite=rewriteTopicFollowup(generalTarget,generalCue);
      if(sharedGeneralRewrite)return sharedGeneralRewrite;
      if(/^(?:何|なに|どんな)(?:が|ことが)?(?:できる|出来る)(?:の|んですか)?[？?]?$/.test(generalCue))
        return generalTarget+'について、何ができる？';
      if(/^(?:どう使う|どうやって使う|使い方(?:は|って)?)(?:の|んですか)?[？?]?$/.test(generalCue))
        return generalTarget+'の使い方は？';
      if(/^(?:使える|利用できる)(?:の|んですか)?[？?]?$/.test(generalCue))
        return generalTarget+'は使える？';
      if(/^(?:料金|値段|価格)(?:は|って)?[？?]?$/.test(generalCue))
        return generalTarget+'の料金は？';
      if(/^(?:無料|タダ)(?:なの|ですか)?[？?]?$/.test(generalCue))
        return generalTarget+'は無料で使える？';
      if(/^(?:何|なに)に使う(?:の|んですか)?[？?]?$/.test(generalCue))
        return generalTarget+'は何に使う？';
      if(/^(?:どこで使う|どこで使える)(?:の|んですか)?[？?]?$/.test(generalCue))
        return generalTarget+'はどこで使える？';
      if(/^(?:必要|必要なの|必要ですか)[？?]?$/.test(generalCue))
        return generalTarget+'は必要？';
      if(/^(?:難しい|むずかしい|簡単|かんたん)(?:の|んですか)?[？?]?$/.test(generalCue))
        return generalTarget+'は'+generalCue.replace(/[？?]+$/,'')+'？';
      if(/^(?:安全|安全なの|安全ですか)[？?]?$/.test(generalCue))
        return generalTarget+'は安全？';
      if(/^(?:いつから|いつ頃から|いつごろから)(?:なの|ですか)?[？?]?$/.test(generalCue))
        return generalTarget+'はいつから？';
      if(/^(?:他と|ほかと)?(?:何|なに)(?:が|がどう)?違う(?:の|んですか)?[？?]?$/.test(generalCue))
        return generalTarget+'は他と何が違う？';
    }

    if(personSubject&&/^(?:何歳|なんさい|年齢(?:は)?|いくつ)(?:だったっけ|だっけ|でしたっけ)[？?]?$/.test(t))
      return personSubject+'の年齢は？';
    if(personSubject&&/^(?:何歳|なんさい|年齢(?:は)?|いくつ)(?:なの|ですか)?[？?]?$/.test(t))
      return personSubject+'の年齢は？';
    if(personSubject&&/^(?:何年生まれ|なんねんうまれ|いつ生まれ|生年月日(?:は)?|誕生日(?:は)?)(?:なの|ですか)?[？?]?$/.test(t))
      return personSubject+'の生年月日・生年は？';
    if(/^(?:理由(?:は)?|何が原因|なにが原因|原因(?:は)?)(?:なの|ですか)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、その理由や原因は？';
    if(/^(?:どのくらい|どれくらい|どんくらい)(?:なの|ですか)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、どのくらい？';
    if(/^(?:いつまで)(?:なの|ですか)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、いつまで？';
    if(personSubject&&/^(?:今|いま)?(?:何してる|なにしてる|何をしてる|何している|なにしている)(?:の|んですか)?[？?]?$/.test(t))
      return personSubject+'について、現在は何をしている？';
    if(personSubject&&/^(?:元気|元気なの|元気ですか|げんき)[？?]+$/.test(t))
      return personSubject+'について、現在は元気？';
    if(personSubject&&/^(?:趣味(?:は)?|好きな食べ物(?:は)?|好物(?:は)?)(?:何|なに)?[？?]?$/.test(t))
      return personSubject+'について、'+t.replace(/[？?]+$/,'')+'？';
    if(/^(?:じゃあ[、,\s]*)?逆に[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、逆の見方や反対側の面も教えて';
    if(/^(?:メリット|良いところ|いいところ|長所)(?:は|って)?[？?]?$|^(?:何|なに|どこ)(?:が|は)?(?:いい|良い)(?:の|ところ)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、良いところや評価されている点は？';
    if(/^(?:デメリット|悪いところ|わるいところ|短所)(?:は|って)?[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、注意点や弱いところは？';
    if(/^(?:つまり|要するに)(?:何が言いたいの|なにが言いたいの|どういうこと|何|なに)[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、要点だけ短く説明して';
    if(/^(?:待って[、,\s]*)?(?:今の|さっきの)(?:何|なに|どういうこと)[？?]?$/.test(t))
      return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、今の説明をもう一度分かりやすく説明して';
    var truthCue=/^(?:それ(?:って|は)?[、,\s]*)?(?:本当|ほんと|ホント|マジ(?:で)?|まじ(?:で)?|うそでしょ|嘘でしょ)(?:なの|ですか|か)?[？?]?$/.test(t)||/^(?:そうなん|そうなの)[？?]+$/.test(t);
    if(truthCue){
      var truthBranches=recentTopicBranches(history,t),truthTop=truthBranches&&truthBranches[0]||null;
      var factContext=['carp','counter','jinpo','tsukumo','kishin','madou','weather','kashin_name'].indexOf(d)>=0||factCue(ant)||!!(truthTop&&truthTop.primary&&truthTop.primary.type==='person');
      if(factContext)return (base||subject||ant.replace(/[？?！!。]+$/,''))+'について、本当か事実確認して';
      return'';
    }

    if(subject){
      if(personSubject){
      // 人物名を毎回言い直さない日本語の追質問を、直前人物へ安全に接続する。
      // 物理的な現在地を推測するのではなく、「今どこ？」は現在の所属・活動として扱う。
      if(/^(?:どんな人|どういう人|どんな人物|どういう人物)(?:なの|ですか)?[？?]?$/.test(t))return subject+'はどんな人物？';
      if(/^(?:結婚してる|結婚している|結婚は|既婚|独身)(?:なの|ですか)?[？?]?$/.test(t))return subject+'は結婚している？';
      if(/^(?:まだ)?現役(?:だったっけ|だっけ|でしたっけ)[？?]?$/.test(t))return subject+'は現在も現役？';
      if(/^(?:まだ)?現役(?:なの|ですか)?[？?]?$/.test(t))return subject+'は現在も現役？';
      if(/^(?:いつ|何年に|なんねんに)?(?:引退した)(?:っけ|んだっけ|でしたっけ)[？?]?$/.test(t))return subject+'はいつ引退した？';
      if(/^(?:いつ|何年に|なんねんに)?(?:引退した|引退したの|引退)(?:の|ですか)?[？?]?$/.test(t))return subject+'はいつ引退した？';
      if(/^(?:まだ)?(?:生きてる|生きている|存命)(?:なの|ですか)?[？?]?$/.test(t))return subject+'は現在存命？';
      if(/^(?:どこ出身|出身はどこ|出身地(?:は)?)(?:なの|ですか)?[？?]?$/.test(t))return subject+'の出身地は？';
      if(/^(?:身長|体重)(?:は|って)?[？?]?$/.test(t))return subject+'の'+t.replace(/[？?]+$/,'')+'？';
      if(/^(?:背番号|ポジション|守備位置)(?:は|って)?[？?]?$/.test(t))return subject+'の'+t.replace(/[？?]+$/,'')+'？';
      if(/^(?:右投げ|左投げ|右打ち|左打ち|投打)(?:なの|ですか)?[？?]?$/.test(t))return subject+'の投打は？';
      if(/^(?:何年いた|なんねんいた|何年間いた|在籍年数(?:は)?)(?:の|ですか)?[？?]?$/.test(t))return subject+'は何年間在籍した？';
      if(/^(?:何勝した|なんしょうした|通算何勝)(?:の|ですか)?[？?]?$/.test(t))return subject+'の通算勝利数は？';
      if(/^(?:何本打った|通算何本)(?:の|ですか)?[？?]?$/.test(t))return subject+'の通算本塁打数は？';
      if(/^(?:何安打|通算何安打)(?:の|ですか)?[？?]?$/.test(t))return subject+'の通算安打数は？';
      if(/^(?:一番|いちばん)(?:すごい|凄い|良かった|よかった)(?:年|シーズン)(?:は|って)?[？?]?$/.test(t))return subject+'の最も活躍したシーズンは？';
      if(/^(?:代表歴|日本代表歴|代表経験)(?:は|って)?[？?]?$/.test(t))return subject+'の代表歴は？';
      if(/^(?:今|いま)(?:どこにいる|どこ|何してる|なにしてる)(?:の|んですか)?[？?]?$/.test(t))return subject+'の現在の所属・活動は？';
      if(/^(?:何歳で|なんさいで)?(?:亡くなった|死去した)(?:の|んですか)?[？?]?$/.test(t))return subject+'はいつ、何歳で亡くなった？';
      var kin=t.match(/^(父親|父|母親|母|兄弟|兄|弟|姉|妹|妻|奥さん|夫人|配偶者|夫|旦那|息子|娘|子供|子ども)(?:は|って)?[？?]?$/);
      if(kin){
        var kinLabel=kin[1];
        if(kinLabel==='奥さん'||kinLabel==='夫人'||kinLabel==='配偶者')kinLabel='妻';
        else if(kinLabel==='旦那')kinLabel='夫';
        return subject+'の'+kinLabel+'は？';
      }
      if(/^(?:本人|その人)(?:の)?(?:話|こと)?(?:に|へ)?戻(?:って|ろう|る|して)?[？?]?$/.test(t))return subject+'について教えて';
      if(/^(?:何|なに|どこ)(?:が|が一番)?(?:すごい|凄い|有名)(?:の|ですか)?[？?]?$/.test(t))return subject+'について、何が特にすごいの？';
      if(/^(?:一番|いちばん)(?:有名|すごい|凄い)(?:なの|なのは|のは|の)?[？?]?$/.test(t))return subject+'について、一番有名な出来事は？';
      if(/^(?:誰|だれ)(?:と|に)(?:関係|つながり)(?:が)?(?:ある|深い)(?:の|ですか)?[？?]?$/.test(t))return subject+'は誰と関係が深い？';
      var rel=t.match(/^(.{1,18}?)(?:とは|との関係(?:は)?|とどういう関係)[？?]?$/);
      if(rel&&S(rel[1])&&C(rel[1])!==C(subject))return subject+'と'+S(rel[1])+'はどういう関係？';
      }
      if(/^(?:逆に[、,\s]*)?(?:弱点|欠点|弱いところ|苦手なところ)(?:は|って)?[？?]?$/.test(t))return subject+'の弱点や欠点として確認できることは？';
    }

    if(isOpinionFollowupCue(t)){
      var opinionBase=base||ant.replace(/[？?！!。]+$/,'').replace(/について$/,'').trim();
      if(!opinionBase)return'';
      // 人物名・名詞句ならそのまま「〜について」、出来事や変更を表す文なら引用して日本語を崩さない。
      var opinionTarget=/(?:した|して|だった|迷って|変えた|変えて|大きく|小さく|光らせ|使う|使って|する|したい|なった|できた)/.test(opinionBase)
        ?'「'+opinionBase+'」について'
        :opinionBase+'について';
      if(/^(?:どっち|どちら)/.test(t))return opinionTarget+'、どちらがいいと思う？';
      return opinionTarget+'、どう思う？';
    }
    if(isMoreCue(t)){
      // 人物の特定観点を話している時は、その人物×観点を維持する。
      // 「黒田の家族」→「もっと」でカープ全体の選手一覧へ飛ばさない。
      if(personSubject&&subjectInfo&&subjectInfo.aspect&&ASPECT_LABELS[subjectInfo.aspect]){
        return personSubject+'の'+ASPECT_LABELS[subjectInfo.aspect]+'について、もう少し続けて';
      }
      if(d==='carp'&&recentCarpSubtopic(history)==='anecdote'&&personSubject)return personSubject+'の逸話について、もう少し続けて';
      if(d==='carp'&&recentCarpSubtopic(history)==='anecdote')return'カープの他の逸話';
      return (base||ant.replace(/[？?]$/,''))+'について、もう少し続けて';
    }

    // 「それで？」「続きは？」は直近の具体的な会話枝を継続する。
    // 「続きは後で話す」のようなユーザー自身の伏線は control() 側が先に処理するため、ここでは短い追質問だけ扱う。
    if(/^(?:(?:それで|で|それから)[、,\s]*)?[？?]$/.test(t) ||
       /^(?:それで|で|それから)[？?]?$/.test(t) ||
       /^(?:(?:その|さっきの|前の)[、,\s]*)?(?:続き|つづき)(?:は|って|を教えて|教えて|お願い)?[？?]?$/.test(t))
      return (base||ant.replace(/[？?]$/,''))+'について、続きを教えて';

    // 「結局？」は新しい事実を作らず、すでに話している枝の要点・結論を求める追質問として扱う。
    if(/^(?:(?:で|それで)[、,\s]*)?(?:結局|要するに|つまり)(?:どういうこと|どうなの|何|なに)?[？?]?$/.test(t))
      return (base||ant.replace(/[？?]$/,''))+'について、要点と結論を短く教えて';

    if(/^(?:もっと|もう少し|詳しく|くわしく)[？?]?$/.test(t))
      return (base||ant.replace(/[？?]$/,''))+'について、もう少し詳しく教えて';
    if(/^(?:なんで|なぜ|どうして)[？?]?$/.test(t))
      return (base||ant.replace(/[？?]$/,''))+'について、なぜそうなるの？';
    if(/^(?:それは|それって|それ何|それなに)[？?]?$/.test(t))
      return (base||ant.replace(/[？?]$/,''))+'について説明して';
    if(/^(?:それ(?:って|は)?[、,\s]*)?(?:どういう意味|どういうこと|何の意味|なんの意味)[？?]?$/.test(t)){
      var meaningTarget=base||ant.replace(/[？?！!。]+$/,'').replace(/(?:について)?(?:教えて|説明して|知りたい|詳しく|くわしく)$/,'').replace(/(?:って何|ってなに|とは)$/,'').trim();
      return (meaningTarget||ant.replace(/[？?]$/,''))+'について、どういう意味か説明して';
    }
    if(/^(?:何の話|なんの話|何のこと|なんのこと)[？?]?$/.test(t)){
      var topicTarget=base||ant.replace(/[？?！!。]+$/,'').replace(/(?:について)?(?:教えて|説明して|知りたい|詳しく|くわしく)$/,'').replace(/(?:って何|ってなに|とは)$/,'').trim();
      return (topicTarget||ant.replace(/[？?]$/,''))+'について、何を指しているか説明して';
    }
    return'';
  }

  var BRANCH_ASPECT_LABELS={overview:'概要',family:'家族',anecdote:'逸話',history:'歴史',stats:'成績',career:'経歴',current:'現在',schedule:'日程',result:'結果',ranking:'順位',comparison:'比較',counter:'カウンター'};
  function branchMessage(frame){
    if(!frame)return'';
    var p=frame.primary&&frame.primary.value?S(frame.primary.value):'',a=S(frame.aspect),u=S(frame.userText);
    if(p){
      var label=BRANCH_ASPECT_LABELS[a]||'';
      if(label&&a!=='overview')return p+'の'+label+'について';
      return p+'について';
    }
    return u;
  }
  function recentTopicBranches(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),frames=topicFrames(h),out=[],seen={};
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];if(!f||!S(f.userText)||isBackCue(f.userText)||isTopicChangeCue(f.userText)||isFollowupOnlyUtterance(f.userText))continue;
      var p=f.primary&&f.primary.value?S(f.primary.value):'',a=S(f.aspect),d=S(f.domain);
      var key=p?((f.primary.type||'topic')+'|'+p+'|'+(a||'overview')):
        (d?(d==='kashin_name'?('domain|'+d):('domain|'+d+'|'+C(f.userText))):('text|'+C(f.userText)));
      if(!key||seen[key])continue;seen[key]=1;
      out.push({message:branchMessage(f),sourceText:S(f.userText),domain:d,aspect:a,primary:f.primary||null,index:f.index});
      if(out.length>=8)break;
    }
    return out;
  }

  function isDeferCue(text){
    var t=S(text);if(!t)return false;
    // 「続きは後で話す」はユーザーが自分で後から話す“伏線”であり、
    // 歩き巫女がその話題を保留して回答へ戻る指示とは分ける。
    if(isConversationHookCue(t))return false;
    return /(?:この話|その話|それ|これ|.+?の話|.+?について)?(?:は|を)?[、,\s]*(?:いったん|一旦)?(?:置いといて|置いておいて|置いとく|保留(?:にして|して)?|後回し(?:にして)?|あとで(?:にして|話そう|戻ろう)?|後で(?:にして|話そう|戻ろう)?)/.test(t);
  }

  function isResumeDeferredCue(text){
    var t=S(text);if(!t)return false;
    return /^(?:(?:じゃあ|では|そろそろ)[、,\s]*)?(?:さっき|前に)?(?:保留(?:に)?した|保留してた|置いといた|置いてた|後回しにした|あとにした|後にした)(?:話|やつ|件)(?:に|へ)?(?:戻(?:ろう|って|る|して)|続け(?:よう|て)|話(?:そう|して))?[？?！!。]*$/.test(t) ||
      /^(?:保留中|保留してた)(?:の)?(?:話|やつ|件)(?:に|へ)?戻(?:ろう|って|る|して)[？?！!。]*$/.test(t);
  }

  function frameAsBranch(f){
    if(!f)return null;
    return {message:branchMessage(f),sourceText:S(f.userText),domain:S(f.domain),aspect:S(f.aspect),primary:f.primary||null,index:f.index};
  }

  function deferTargetFromText(text,priorFrames){
    var t=S(text),prefix=t.split(/(?:は|を)?[、,\s]*(?:いったん|一旦)?(?:置いといて|置いておいて|置いとく|保留(?:にして|して)?|後回し(?:にして)?|あとで|後で)/)[0]||'';
    prefix=S(prefix).replace(/^(?:じゃあ|では|その|この)[、,\s]*/,'').replace(/(?:この話|その話|それ|これ)$/,'');
    var aspect=aspectFromText(prefix);
    var entities=entityCandidatesFromText(prefix,domainFromText(prefix));
    var primary=entities.length?entities[0]:null;
    if(primary&&primary.value){
      var synthetic={userText:prefix,domain:domainFromText(prefix)||'',aspect:aspect||'',primary:primary,index:-1};
      return frameAsBranch(synthetic);
    }
    if(aspect){
      for(var ai=priorFrames.length-1;ai>=0;ai--){
        if(priorFrames[ai]&&priorFrames[ai].aspect===aspect&&priorFrames[ai].primary)return frameAsBranch(priorFrames[ai]);
      }
    }
    for(var i=priorFrames.length-1;i>=0;i--){
      var f=priorFrames[i];if(!f||!S(f.userText)||isFollowupOnlyUtterance(f.userText)||isBackCue(f.userText)||isTopicChangeCue(f.userText))continue;
      return frameAsBranch(f);
    }
    return null;
  }

  // 明示的に「後で」「保留」とされた話題だけをスタックとして復元する。
  // 会話履歴から毎回再構成するので、永続状態が壊れて古い保留が残ることを避ける。
  function deferredTopics(history,currentMessage){
    var h=historyBeforeCurrent(history,currentMessage||''),frames=topicFrames(h,{limit:48}),stack=[];
    for(var i=0;i<frames.length;i++){
      var f=frames[i];if(!f||!S(f.userText))continue;
      var t=S(f.userText);
      if(isResumeDeferredCue(t)){
        if(stack.length)stack.pop();
        continue;
      }
      if(!isDeferCue(t))continue;
      var target=deferTargetFromText(t,frames.slice(0,i));
      if(!target||!target.message)continue;
      var key=(target.primary&&target.primary.value||'')+'|'+(target.aspect||'')+'|'+target.message;
      for(var j=stack.length-1;j>=0;j--){
        var x=stack[j],xk=(x.primary&&x.primary.value||'')+'|'+(x.aspect||'')+'|'+x.message;
        if(xk===key)stack.splice(j,1);
      }
      stack.push(target);
      if(stack.length>6)stack.shift();
    }
    return stack;
  }

  function restoreDeferredTopic(history,currentMessage){
    var list=deferredTopics(history,currentMessage||'');if(!list.length)return null;
    var x=list[list.length-1];
    return {control:'back',restoreMessage:x.message||x.sourceText,domain:x.domain||'',sourceText:x.sourceText||'',sourceIndex:x.index,branch:true,deferred:true,aspect:x.aspect||'',primary:x.primary||null};
  }

  function namedBackDomain(text){
    var t=S(text).replace(/もど/g,'戻');
    if(/^(?:カープ|かーぷ|広島東洋(?:カープ)?)(?:の話)?(?:に|へ)?戻(?:そう|ろう|して|す|る|って)?[？?！!。]*$/i.test(t))return'carp';
    if(/^天気(?:の話)?(?:に|へ)?戻(?:そう|ろう|して|す|る|って)?[？?！!。]*$/.test(t))return'weather';
    if(/^(?:陣法|陣形)(?:の話)?(?:に|へ)?戻(?:そう|ろう|して|す|る|って)?[？?！!。]*$/.test(t))return'jinpo';
    if(/^(?:たいらの野望|たいらの)(?:の話)?(?:に|へ)?戻(?:そう|ろう|して|す|る|って)?[？?！!。]*$/.test(t))return'tairano';
    if(/^カウンター(?:の話)?(?:に|へ)?戻(?:そう|ろう|して|す|る|って)?[？?！!。]*$/.test(t))return'counter';
    if(/^家臣(?:名付け|の名前|の話)?(?:に|へ)?戻(?:そう|ろう|して|す|る|って)?[？?！!。]*$/.test(t))return'kashin_name';
    return'';
  }

  function isBackCue(text){
    var t=S(text).replace(/もど/g,'戻');
    if(namedBackDomain(t))return true;
    return /^(?:話(?:を|に)?戻(?:そう|ろう|して|す|る|って)|前の話(?:に|へ)?戻(?:そう|ろう|して|って|る)?|さっきの話(?:に|へ)?戻(?:そう|ろう|して|って|る)?|(?:前のやつ|前の|さっきのやつ|さっきの)(?:に|へ)?戻(?:そう|ろう|して|って|る)?|その前の話(?:に|へ)?戻(?:そう|ろう|して|って|る)?|(?:その前のやつ|その前)(?:に|へ)?戻(?:そう|ろう|して|って|る)?|さらに前(?:の話)?(?:に|へ)?戻(?:そう|ろう|して|って|る)?|(?:二つ|2つ|二個|2個)前(?:の話)?(?:に|へ)?戻(?:そう|ろう|して|って|る)?|一個前(?:に)?戻(?:そう|ろう|して|って|る)?|元の話(?:に)?戻(?:そう|ろう|して|って|る)?|戻ろう)[？?！!。]*$/.test(t);
  }

  function isTopicChangeCue(text){
    return /^(?:話(?:を)?変え(?:よう|たい|る)|話題(?:を)?変え(?:よう|たい|る)|別の話(?:にしよう|したい)?)[？?！!。]*$/.test(S(text));
  }

  function userTopicCandidates(history){
    var h=filterHistory(history),out=[];
    for(var i=h.length-1;i>=0&&i>=h.length-30;i--){
      var x=h[i];
      if(!x||x.role!=='user')continue;
      var t=S(x.text);
      if(!t||isBackCue(t)||isTopicChangeCue(t))continue;
      var d=domainFromText(t);
      if(!d)continue;
      if(out.some(function(y){return y.domain===d;}))continue;
      out.push({text:t,domain:d,index:i});
      if(out.length>=6)break;
    }
    return out;
  }

  function restorePreviousTopic(history,currentMessage){
    // まず同一ドメイン内の枝（例: 黒田の家族 → 新井の経歴）まで含めて戻す。
    var branches=recentTopicBranches(history,currentMessage||''),cue=S(currentMessage||''),depth=1;

    // 「前の話に戻って」を連続した場合は、同じ枝で止まらず一段ずつさらに前へ進める。
    // assistant回答は飛ばし、直近の実質ユーザー発言までの連続back回数だけ数える。
    var prior=historyBeforeCurrent(history,currentMessage||''),priorBacks=0;
    for(var bi=prior.length-1;bi>=0;bi--){
      var bx=prior[bi];if(!bx||bx.role!=='user')continue;
      if(isBackCue(bx.text)){priorBacks++;continue;}
      break;
    }

    if(/^(?:その前|さらに前|(?:二つ|2つ|二個|2個)前)/.test(cue))depth=Math.max(2,priorBacks+1);
    else if(/^元の話/.test(cue))depth=Math.max(1,branches.length-1);
    else depth=1+priorBacks;

    // これ以上古い枝が無い時は、無関係な別ドメインへ飛ばず最古の実質枝で止める。
    if(branches.length&&depth>=branches.length)depth=branches.length-1;
    if(branches.length>depth){
      var b=branches[depth];
      return {control:'back',restoreMessage:b.message||b.sourceText,domain:b.domain||'',sourceText:b.sourceText,sourceIndex:b.index,branch:true,branchDepth:depth,aspect:b.aspect||'',primary:b.primary||null};
    }

    // 人物・話題フレームが作れない天気などは従来のドメイン単位へフォールバック。
    var list=userTopicCandidates(history);
    if(!list.length)return branches.length?{control:'back',restoreMessage:branches[0].message||branches[0].sourceText,domain:branches[0].domain||'',sourceText:branches[0].sourceText,sourceIndex:branches[0].index,branch:true}:null;

    var x=list.length>=2?list[1]:list[0];
    var message=x.text;

    if(x.domain==='carp'&&!/カープ|かーぷ|広島東洋|carp/i.test(message)){
      message='カープの'+message;
    }
    if(x.domain==='weather'&&!/天気|気温|予報|雨|雪/.test(message)){
      message=message+'の天気';
    }

    return {control:'back',restoreMessage:message,domain:x.domain,sourceText:x.text,sourceIndex:x.index};
  }

  function latestByDomain(history,domain){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];
      if(!x||x.role!=='user')continue;
      var t=S(x.text);
      if(domainFromText(t)===domain)return t;
    }
    return'';
  }

  // 「カープの話に戻って」のようなドメイン名付き復帰では、単なる生テキスト判定ではなく
  // topicFramesの主役・観点を使って、そのドメインで最後に話していた具体的な枝へ戻す。
  function latestBranchByDomain(history,domain){
    var frames=topicFrames(history,{limit:64});
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];
      if(!f||f.domain!==domain||!S(f.userText)||isBackCue(f.userText)||isTopicChangeCue(f.userText))continue;
      var b=frameAsBranch(f);
      if(b&&S(b.message||b.sourceText))return b;
    }
    return null;
  }

  function isTairanoDomain(domain){
    return ['tairano','counter','tsukumo','kishin','madou','jinpo'].indexOf(String(domain||''))>=0;
  }

  // 「たいらの野望の話に戻って」は、サイト案内だけでなく、最後に話していた
  // カウンター・九十九・鬼神石・魔導結晶・陣法を含む具体的な枝へ戻す。
  function tairanoRestoreMessage(frame){
    var f=frame||{},u=S(f.userText),a=S(f.assistantText),domain=String(f.domain||'');

    if(domain==='counter'){
      // 正本回答に含まれる「場所＋人物」を使い、短い「義輝は？」を曖昧な状態へ戻さない。
      var cm=a.match(/(?:^|\n)([^。\n]{2,60}?)の([^。\n]{2,28}?)ですね。カウンター(?:は|持ちは)/);
      if(cm)return S(cm[1])+'の'+S(cm[2])+'のカウンターは？';
      return u;
    }

    if(domain==='tsukumo'||domain==='kishin'||domain==='madou'){
      var label=domain==='tsukumo'?'九十九':(domain==='kishin'?'鬼神石':'魔導結晶');
      var tm=a.match(/(?:九十九|鬼神石|魔導結晶)\s*([0-9０-９]{1,4})番/);
      if(tm){
        var num=String(tm[1]).replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFEE0);});
        if(/入手|どこで|取れる|取り方/.test(u))return label+num+'番の入手は？';
        var stat=(u.match(/生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/)||[])[0]||'';
        if(stat)return label+num+'番の'+stat+'は？';
        if(/詳細|詳しく|全部|他の能力|ほかの能力/.test(u))return label+num+'番を詳しく';
        return label+num+'番は？';
      }
      if(new RegExp(label).test(u))return u;
      return label+'の'+u;
    }

    return u;
  }

  function latestTairanoBranch(history){
    var frames=topicFrames(history,{limit:64});
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];
      if(!f||!isTairanoDomain(f.domain)||!S(f.userText)||isBackCue(f.userText)||isTopicChangeCue(f.userText))continue;
      var b=frameAsBranch(f)||{};
      // 専用正本の回答から対象・場所・番号・観点を組み直し、長時間後でも同じ枝へ戻す。
      b.message=tairanoRestoreMessage(f);
      b.sourceText=S(f.userText);
      b.domain=f.domain||b.domain||'tairano';
      b.index=f.index;
      return b;
    }
    return null;
  }

  function latestTairanoText(history){
    var h=filterHistory(history);
    for(var i=h.length-1;i>=0;i--){
      var x=h[i];
      if(!x||x.role!=='user'||!S(x.text)||isBackCue(x.text)||isTopicChangeCue(x.text))continue;
      var d=domainFromHistoryItem(x);
      if(isTairanoDomain(d))return S(x.text);
    }
    return'';
  }


  // 「Firebaseに戻って」「黒田に戻って」のように、ドメイン名ではなく
  // 履歴上の具体的な主題名を指定した復帰。観点語だけの「家族に戻って」は
  // multiTurnReference() 側へ残し、主題名として誤認しない。
  function namedSubjectBack(text,history){
    var t=S(text).replace(/もど/g,'戻'),m=t.match(/^(.{1,28}?)(?:の話)?(?:に|へ)?戻(?:そう|ろう|して|す|る|って)[？?！!。]*$/);
    if(!m)return null;
    var anchor=S(m[1]);
    if(!anchor||/^(?:前|前の|さっき|さっきの|その前|さらに前|元|元の|話|家族|親族|逸話|昔話|歴史|成績|経歴|現在)$/.test(anchor))return null;
    var ref=findSubjectByAnchor(history,anchor);
    if(!ref||ref.ambiguous||!ref.value)return null;
    var frames=topicFrames(history,{limit:64});
    for(var i=frames.length-1;i>=0;i--){
      var f=frames[i];if(!f||!f.primary||f.primary.value!==ref.value||!S(f.userText))continue;
      var b=frameAsBranch(f);if(!b||!S(b.message||b.sourceText))continue;
      return {control:'back',restoreMessage:b.message||b.sourceText,domain:b.domain||ref.domain||'',sourceText:b.sourceText||'',sourceIndex:b.index,branch:true,aspect:b.aspect||'',primary:b.primary||ref,namedSubject:true};
    }
    return {control:'back',restoreMessage:ref.value+'について',domain:ref.domain||'',sourceText:ref.sourceText||'',sourceIndex:ref.index,branch:true,primary:ref,namedSubject:true};
  }

  function control(text,history){
    var t=S(text);

    var named=namedBackDomain(t);

    if(named){
      var namedBranch=named==='tairano'?latestTairanoBranch(history):latestBranchByDomain(history,named);
      if(namedBranch){
        var restoredDomain=named==='tairano'?(namedBranch.domain||'tairano'):named;
        return {control:'back',restoreMessage:namedBranch.message||namedBranch.sourceText,domain:restoredDomain,sourceText:namedBranch.sourceText||'',sourceIndex:namedBranch.index,branch:true,aspect:namedBranch.aspect||'',primary:namedBranch.primary||null,namedDomain:true,tairanoGroup:named==='tairano'};
      }
      var prev=named==='tairano'?latestTairanoText(history):latestByDomain(history,named);
      if(prev){
        if(named==='carp'&&!/カープ|かーぷ|広島東洋/i.test(prev))prev='カープの'+prev;
        return {control:'back',restoreMessage:prev,domain:named,sourceText:prev,namedDomain:true,tairanoGroup:named==='tairano'};
      }
    }

    var namedSubject=namedSubjectBack(t,history);
    if(namedSubject)return namedSubject;

    // 入力途中の断片が残っている時だけ「やっぱりいいや」を、その言いかけの中止として扱う。
    if(isFragmentCancelCue(t)&&previousOpenUserFragment(history,t)){
      return {control:'fragment_cancel',restoreMessage:'',domain:'',sourceText:''};
    }

    if(isResumeHookCue(t)){
      var hr=restoreConversationHook(history,t);
      return hr||restoreNaturalResume(history,t)||{control:'back',restoreMessage:'',domain:'',sourceText:'',hook:true};
    }
    if(isConversationRecallCue(t)){
      return recallConversationState(history,t)||{control:'recall',answer:'直前の実質的な話題をこちらでは特定できませんでした。',restoreMessage:'',domain:'',sourceText:'',resume:true};
    }
    if(isGeneralResumeCue(t)){
      var nr=restoreNaturalResume(history,t);
      return nr||{control:'back',restoreMessage:'',domain:'',sourceText:'',resume:true};
    }
    if(isResumeParallelCue(t)){
      var pr=restoreParallelTopic(history,t);
      if(pr)return pr;
      // 「もう片方／前者／後者」は並行参照そのものなので候補なしでも制御として返す。
      // 一方「どっちが簡単？」等の比較表現は、並行履歴が無ければ通常の二択処理へ流す。
      if(parallelResumeParts(t))return {control:'back',restoreMessage:'',domain:'',sourceText:'',parallel:true};
    }
    if(isResumeDeferredCue(t)){
      var dr=restoreDeferredTopic(history,t);
      return dr||{control:'back',restoreMessage:'',domain:'',sourceText:'',deferred:true};
    }
    if(isBackCue(t)){
      var r=restorePreviousTopic(history,t);
      return r||{control:'back',restoreMessage:'',domain:'',sourceText:''};
    }
    if(isTopicChangeCue(t)){
      return {control:'change',restoreMessage:'',domain:'',sourceText:''};
    }
    // 「ところで黒田は？」「そういえば別件だけど…」は、新しい発言そのものを止めずに
    // 古い質問待ちだけ破棄するソフトな話題転換として扱う。
    if(isExplicitTopicShift(t)){
      return {control:'soft_change',restoreMessage:'',domain:'',sourceText:t};
    }
    return null;
  }


  function compoundClauseScore(text){
    var t=S(text);if(!t)return 0;
    var score=0,d=domainFromText(t);
    if(d)score+=2;
    if(/[？?]/.test(t))score+=2;
    if(/(?:教えて|知りたい|調べて|見せて|見たい|探して|検索して|比較して|お願い|してほしい|して欲しい|どう|どこ|いつ|誰|だれ|何|なに|なぜ|なんで|順位|成績|逸話|歴史|家族|親族|現在|最新)/.test(t))score+=1;
    if(/^(?:こんにちは|こんばんは|おはよう|ありがとう|ありがと|了解|わかった|なるほど|そうなんだ)[。！!？?]*$/.test(t))score-=2;
    return score;
  }

  function splitDifferentSubjectAspects(text){
    var t=S(text);if(!t||t.length<8||t.length>220)return [];
    var aspect='(?:家族|親族|成績|逸話|経歴|歴史|現在|近況|順位|使い方|料金|価格|値段|安全|安全性|メリット|デメリット|入手方法|取り方|入手|上限|下限|効果|倍率|必要数|必要個数)';
    var re=new RegExp('^(.{1,45}?)の('+aspect+')\s*(?:と|、|,)\s*(.{1,45}?)の('+aspect+')(?:を)?(?:教えて|知りたい|説明して|詳しく教えて|は[？?])(?:[。！!]*)$');
    var m=t.match(re);if(!m)return [];
    var s1=S(m[1]),a1=S(m[2]),s2=S(m[3]),a2=S(m[4]);
    if(!s1||!s2||!a1||!a2||C(s1)===C(s2))return [];
    return [s1+'の'+a1+'について教えて',s2+'の'+a2+'について教えて'];
  }

  function splitCoordinatedAspects(text){
    var t=S(text);if(!t||t.length<6||t.length>180)return [];
    // 「黒田の成績と家族を教えて」「Firebaseの使い方と料金は？」のように、
    // 同じ主題に対して明確に別観点が並んだ時だけ分ける。
    var m=t.match(/^(.{1,60})の(.+?)(?:(?:を)?(?:教えて|知りたい|説明して|詳しく教えて)|(?:は|って)?[？?])(?:[。！!]*)$/);
    if(!m)return [];
    var subject=S(m[1]),body=S(m[2]);if(!subject||!body)return [];
    var allowed={
      '家族':1,'親族':1,'成績':1,'逸話':1,'経歴':1,'歴史':1,'現在':1,'近況':1,
      '使い方':1,'料金':1,'価格':1,'値段':1,'安全':1,'安全性':1,'メリット':1,'デメリット':1,
      '入手方法':1,'取り方':1,'入手':1,'上限':1,'下限':1,'効果':1,'倍率':1,'必要数':1,'必要個数':1
    };
    var parts=body.split(/(?:と|、|,)/).map(function(x){return S(x).replace(/^(?:それと|あと)[、,\s]*/,'');}).filter(Boolean);
    if(parts.length<2||parts.length>4)return [];
    if(parts.some(function(x){return !allowed[x];}))return [];
    var out=[];
    parts.forEach(function(a){out.push(subject+'の'+a+'について教えて');});
    return out;
  }

  // 1発言に複数の依頼・質問がある時だけ、安全な境界で分割する。
  // 「腕力と耐久」「黒田と新井」のような同一条件・並列表現は分割しない。
  function splitCompoundIntents(text){
    var rawText=String(text==null?'':text);
    try{rawText=rawText.normalize('NFKC');}catch(e){}
    rawText=rawText.replace(/[\u3000\t]+/g,' ').replace(/ *\r?\n */g,'\n').trim();
    var original=S(rawText);if(!original||original.length<8||original.length>500)return [];
    var differentSubjects=splitDifferentSubjectAspects(original);if(differentSubjects.length)return differentSubjects;
    var coordinated=splitCoordinatedAspects(original);if(coordinated.length)return coordinated;
    var mark='\u241e',t=rawText;

    // 「〜を知りたいし、〜も教えて」「〜知りたいけど、〜も教えて」のような依頼接続。
    t=t.replace(/((?:知りたい|教えて|調べて|見せて|見たい|探して|検索して|比較して|お願い|してほしい|して欲しい))\s*し[、,]?\s*/g,'$1'+mark);
    t=t.replace(/((?:知りたい|教えて|調べて|見せて|見たい|探して|検索して|比較して))\s*(?:けど|けれど|けれども|ですが|だけど)[、,]?\s*/g,'$1'+mark);

    // 明示的に別件を足す接続語。文頭の「あと」は対象外。
    t=t.replace(/[、,]\s*(?:それと|それから|あと|ついでに|もう一つ|もう1つ)[、,\s]*/g,mark);
    t=t.replace(/\s+(?:それと|それから|ついでに)\s+/g,mark);

    // 疑問符・改行は強い発話境界。疑問符自体は前の節に残す。
    t=t.replace(/[？?]+\s*(?=\S)/g,function(m){return m.charAt(0)+mark;});
    t=t.replace(/\s*\n+\s*/g,mark);

    // 句点は両側が質問/依頼らしい時だけ後段の検証で採用する。
    t=t.replace(/。\s*(?=\S)/g,'。'+mark);

    var raw=t.split(mark).map(function(x){
      return S(x).replace(/^(?:それと|それから|ついでに|もう一つ|もう1つ)[、,\s]*/,'').replace(/^あと[、,\s]+/,'');
    }).filter(Boolean);
    if(raw.length<2||raw.length>4)return [];
    if(raw.some(function(x){return x.length<2;}))return [];

    var scored=raw.map(compoundClauseScore);
    var meaningful=scored.filter(function(x){return x>0;}).length;
    if(meaningful<2)return [];

    // 「こんにちは。今日は暑いね」のような単なる雑談2文は複合タスク扱いしない。
    if(scored.some(function(x){return x<=0;}))return [];

    // 同じ内容を句読点だけで重複させたケースは除外。
    var compact=raw.map(C),seen={};
    for(var i=0;i<compact.length;i++){
      if(seen[compact[i]])return [];
      seen[compact[i]]=1;
    }
    return raw;
  }

  function resolve(text,history,opt){
    var original=S(text);
    var casual=normalizeCasualInput(original);
    var kana=normalizeKanaInput(casual.text||original);
    var routingText=kana.text||casual.text||original;
    var contrastiveTail=contrastiveFollowupTail(routingText);
    if(contrastiveTail)routingText=contrastiveTail;
    var priorHistory=historyBeforeCurrent(history,original);
    var fragmentCorrection=repairOpenFragmentCorrection(routingText,priorHistory);
    if(fragmentCorrection&&fragmentCorrection.message)routingText=fragmentCorrection.message;
    var fragmentCarry=fragmentCorrection?null:stitchUserFragment(routingText,priorHistory);
    if(fragmentCarry&&fragmentCarry.message)routingText=fragmentCarry.message;
    var inlineCorrection={text:routingText,changed:false,type:'none'};
    var correction=stripCorrection(routingText);
    var message=correction.text;
    var domain=domainFromText(message);
    var explicitTopicShift=isExplicitTopicShift(message);
    // 「ところで」「話変わるけど」など明示的な話題転換では、旧ドメインの省略補完を持ち込まない。
    var prevDomain=explicitTopicShift?'':recentDomain(priorHistory);
    var carried='',referenceClarification='',conversationExpansion=null;

    // 「いや前者」「違う、後の方」のような“選択そのものの訂正”は、
    // 候補確認や通常の指示語解決より先に並行スロットへ戻す。
    var parallelCorrection=parallelSelectionCorrection(routingText,priorHistory);
    if(parallelCorrection&&parallelCorrection.message){
      message=parallelCorrection.message;
      domain=parallelCorrection.domain||domainFromText(message)||domain||prevDomain;
      carried=message;
    }

    // 直前に候補確認を返している時は、「前者」「2番目」「義輝の方」のような短い回答を
    // 先に元質問へ復元する。通常の談話指示語より優先する。
    var clarification=parallelCorrection?null:clarificationSelection(message,priorHistory);
    if(clarification&&clarification.rejected){
      referenceClarification='了解です。その候補ではないんですね。対象の名前か、分かる特徴を一つ教えてください。';
    }else if(clarification&&clarification.ambiguous){
      referenceClarification='候補がまだ複数残っているのですよ。'+(clarification.candidates||[]).join('、')+'のどれか教えてください。';
    }else if(clarification&&clarification.message){
      message=clarification.message;
      domain=domainFromText(message)||domain||prevDomain;
      carried=message;
    }

    // 候補選択ではない一般訂正も、「主役だけ変更」「観点だけ変更」に分けて前の枝へつなぐ。
    var correctionCarry=!parallelCorrection&&!clarification&&!referenceClarification?correctionFollowup(routingText,priorHistory):null;
    if(correctionCarry&&correctionCarry.message){
      message=correctionCarry.message;
      domain=correctionCarry.domain||domainFromText(message)||domain||prevDomain;
      carried=message;
    }else if(!parallelCorrection&&!clarification&&!referenceClarification){
      // 履歴を使う訂正で解決できなかった時だけ、同一発話内の「A、いやB」を処理する。
      // これにより「黒田じゃなくて新井」は従来どおり前の観点を保持しつつ、
      // 「黒田の家族、いや成績を教えて」のような途中言い直しも扱える。
      inlineCorrection=inlineSelfCorrection(routingText);
      if(inlineCorrection&&inlineCorrection.changed){
        message=inlineCorrection.text;
        domain=domainFromText(message)||domain||prevDomain;
        carried=message;
      }
    }

    // 「あれ」「あの件」「そっちの話」のような談話指示語は、人物名ではなく具体的な会話枝から解決する。
    var discourseRef=!parallelCorrection&&!clarification&&!referenceClarification&&!correctionCarry?resolveDiscourseDeictic(message,priorHistory):null;
    if(discourseRef&&discourseRef.ambiguous){
      referenceClarification='指している話題が複数あるのですよ。'+(discourseRef.candidates||[]).join('、')+'のどれか教えてください。';
    }else if(discourseRef&&discourseRef.message){
      message=discourseRef.message;
      domain=domainFromText(message)||(discourseRef.branch&&discourseRef.branch.domain)||domain||prevDomain;
      carried=message;
    }

    // 数ターン前の主役を明示/相対参照する表現を、直前指示語より先に解決する。
    var multiRef=!parallelCorrection&&!referenceClarification?multiTurnReference(message,priorHistory):null;
    if(multiRef&&multiRef.ambiguous){
      referenceClarification='前の話題に候補が複数あるのですよ。'+(multiRef.candidates||[]).join('、')+'のどれか、名前で教えてください。';
    }else if(multiRef&&multiRef.message){
      message=multiRef.message;
      domain=domainFromText(message)||(multiRef.reference&&multiRef.reference.domain)||domain||prevDomain;
      carried=message;
    }

    // 「その人」「その選手」「それはいつ？」などは、直前の回答側に出た対象も参照する。
    // 「封印編」のような属性語からdomainが先に付いても、指示語そのものは解決する。
    var shortStance=conversationalStance(priorHistory,message);
    var stanceOnly=shortStance&&['skepticism','disagreement','partial_agreement','agreement'].indexOf(shortStance.type)>=0&&S(message).length<=36;
    var entityRef=!parallelCorrection&&!referenceClarification&&!discourseRef&&!correctionCarry&&!stanceOnly&&!explicitTopicShift&&!isOpinionFollowupCue(message)?resolveEntityReference(message,priorHistory):null;
    if(entityRef&&entityRef.ambiguous){
      referenceClarification=entityRef.kind==='person'
        ?'「その人」が複数候補に当てはまるのですよ。'+(entityRef.candidates||[]).join('、')+'のどれか、名前で教えてください。'
        :'「それ」が複数の話題を指せるのですよ。'+(entityRef.candidates||[]).join('、')+'のどちらか教えてください。';
    }else if(entityRef&&entityRef.message){
      message=entityRef.message;
      domain=domainFromText(message)||(entityRef.reference&&entityRef.reference.domain)||domain||prevDomain;
      carried=message;
    }

    // 主語を省いた「今はどう？」「その後は？」も、直前の回答内容へ接続する。
    if(!referenceClarification){
      var openFollow=openEndedFollowup(message,priorHistory);
      if(openFollow&&openFollow.ambiguous){
        referenceClarification='直前に人物が複数出ているのですよ。'+(openFollow.candidates||[]).join('、')+'のどれについて聞いているか、名前で教えてください。';
      }else if(openFollow&&openFollow.message){
        message=openFollow.message;
        domain=domainFromText(message)||(openFollow.reference&&openFollow.reference.domain)||domain||prevDomain;
        carried=message;
      }
    }

    // 同じ人物・話題の概要を再度聞かれた時は、会話グラフ上でまだ未質問の観点へ広げる。
    // 明示的な再説明要求や、逸話/家族など特定観点の「他には？」は既存経路を優先する。
    if(!referenceClarification){
      var graphExpansion=conversationGraphExpansion(message,priorHistory);
      if(graphExpansion&&graphExpansion.message){
        message=graphExpansion.message;
        domain=domainFromText(message)||(graphExpansion.reference&&graphExpansion.reference.domain)||domain||prevDomain;
        carried=message;
        conversationExpansion=graphExpansion;
      }
    }

    // 「前の説明と違う」と指摘された時は、操作を再実行しない範囲で直前の事実質問へ戻す。
    var conflictRecheck=null;
    if(!referenceClarification){
      conflictRecheck=conflictRecheckTarget(priorHistory,message);
      if(conflictRecheck&&conflictRecheck.message){
        message=conflictRecheck.message;
        domain=conflictRecheck.domain||domainFromText(message)||domain||prevDomain;
        carried=message;
      }
    }

    // 新しいデータ種別は今の発言を最優先。
    // ただし「じゃあ鬼神石では？」のように対象だけ切り替えた時は、
    // 直前の腕力/知力/トップN/番号など移植可能な条件だけ引き継ぐ。
    if(domain&&isToolDatasetDomain(domain)&&isToolDatasetDomain(prevDomain)&&domain!==prevDomain){
      var switched=carryExplicitToolDatasetSwitch(message,domain,prevDomain,priorHistory);
      if(switched){
        message=switched;
        carried=switched;
      }
    }

    if(!carried&&!domain&&!referenceClarification){
      if(prevDomain==='counter'&&isCounterCandidateFollowup(message,priorHistory)){
        carried=message;
        domain='counter';
      }else{
        carried=carryByDomain(message,prevDomain,priorHistory);
        if(carried){
          message=carried;
          domain=domainFromText(message)||prevDomain;
        }
      }
    }

    if(!carried&&!referenceClarification){
      // Firebase / Firestore の曖昧確認で「両方」を明示選択した直後は、
      // 次の短い一般質問を片方だけへ落とさず、両方を対象にした質問へ保つ。
      var lastUserForBoth='';
      for(var bu=priorHistory.length-1;bu>=0;bu--){
        if(priorHistory[bu]&&priorHistory[bu].role==='user'&&S(priorHistory[bu].text)){lastUserForBoth=S(priorHistory[bu].text);break;}
      }
      if(/^(?:両方|両方とも|どっちも|どちらも)[？?！!。]*$/.test(lastUserForBoth)){
        var bothSlots=parallelTopics(priorHistory,message)||[],bothNames=bothSlots.map(function(x){return S(x&&x.subject);}).filter(Boolean);
        var hasFirebase=bothNames.indexOf('Firebase')>=0,hasFirestore=bothNames.indexOf('Firestore')>=0;
        if(hasFirebase&&hasFirestore){
          if(/^(?:使い方|どう使う|どうやって使う|始め方|導入)(?:は|って)?[？?！!。]*$/.test(message)){
            message='FirebaseとFirestore、両方の使い方は？';carried=message;
          }else if(/^(?:何ができる|なにができる|できること|機能)(?:は|って)?[？?！!。]*$/.test(message)){
            message='FirebaseとFirestore、両方で何ができる？';carried=message;
          }else if(/^(?:安全|安全性|セキュリティ|注意点)(?:は|って)?[？?！!。]*$/.test(message)){
            message='FirebaseとFirestore、両方の安全性は？';carried=message;
          }
        }
      }
    }

    if(!carried&&!referenceClarification){
      var generic=genericFollowup(message,priorHistory);
      if(generic){
        message=generic;
        domain=domainFromText(message)||prevDomain;
        carried=generic;
      }
    }

    var nav=navigationCue(message);
    var fact=factCue(message);

    var intent='conversation';
    if(nav)intent='navigation';
    else if(fact)intent='fact';
    else if(domain==='kashin_name')intent='task';
    else if(domain)intent='topic';

    return {
      original:original,
      message:message,
      normalizedInput:routingText,
      inputNormalized:!!(casual.changed||kana.changed||contrastiveTail),
      contrastiveFollowup:!!contrastiveTail,
      corrected:!!(correction.corrected||parallelCorrection||(inlineCorrection&&inlineCorrection.changed)),
      fragmentStitched:!!(fragmentCarry&&fragmentCarry.message),
      fragmentSource:fragmentCarry?fragmentCarry.fragment:(fragmentCorrection?fragmentCorrection.fragment:''),
      fragmentCorrection:!!(fragmentCorrection&&fragmentCorrection.message),
      inlineCorrection:inlineCorrection&&inlineCorrection.changed?inlineCorrection.type:'',
      carried:!!carried,
      domain:domain||prevDomain||'',
      previousDomain:prevDomain,
      intent:intent,
      navigation:nav,
      fact:fact,
      referenceClarification:referenceClarification,
      conversationExpansion:conversationExpansion,
      planRecall:recallPlan(priorHistory,original),
      positionRecall:recallPosition(priorHistory,original),
      priorStatement:priorStatementReference(priorHistory,original),
      conflictRecheck:conflictRecheck
    };
  }

  window.JINPO_BOT_CONVERSATION={
    version:VERSION,
    resolve:resolve,
    normalizeCasualInput:normalizeCasualInput,
    normalizeKanaInput:normalizeKanaInput,
    smallKanaFold:smallKanaFold,
    looseKanaFold:unvoiceKanaFold,
    isOpenUserFragment:isOpenUserFragment,
    stitchUserFragment:stitchUserFragment,
    inlineSelfCorrection:inlineSelfCorrection,
    clarificationSelection:clarificationSelection,
    navigationCue:navigationCue,
    factCue:factCue,
    domainFromText:domainFromText,
    recentDomain:recentDomain,
    immediateReactionContext:immediateReactionContext,
    stripCorrection:stripCorrection,
    contrastiveFollowupTail:contrastiveFollowupTail,
    isWeakAssistantText:isWeakAssistantText,
    control:control,
    isBackCue:isBackCue,
    isTopicChangeCue:isTopicChangeCue,
    isExplicitTopicShift:isExplicitTopicShift,
    interactionStyle:interactionStyle,
    listeningSignals:listeningSignals,
    conversationalStance:conversationalStance,
    pragmaticTone:pragmaticTone,
    humorResponsePolicy:humorResponsePolicy,
    continuitySignal:continuitySignal,
    planTimePhrase:planTimePhrase,
    isPlanRecallCue:isPlanRecallCue,
    explicitUserPlan:explicitUserPlan,
    isPlanCompletion:isPlanCompletion,
    planLedger:planLedger,
    planMemory:planMemory,
    recallPlan:recallPlan,
    explicitUserPosition:explicitUserPosition,
    isPositionRecallCue:isPositionRecallCue,
    positionMemory:positionMemory,
    recallPosition:recallPosition,
    isMemoryRetractionCue:isMemoryRetractionCue,
    retractedMemoryIndexes:retractedMemoryIndexes,
    priorStatementReference:priorStatementReference,
    isGeneralResumeCue:isGeneralResumeCue,
    isConversationRecallCue:isConversationRecallCue,
    recallConversationState:recallConversationState,
    restoreNaturalResume:restoreNaturalResume,
    resolveDiscourseDeictic:resolveDiscourseDeictic,
    rewriteTopicFollowup:rewriteTopicFollowup,
    utteranceRepair:utteranceRepair,
    isConversationHookCue:isConversationHookCue,
    isResumeHookCue:isResumeHookCue,
    conversationHooks:conversationHooks,
    restoreConversationHook:restoreConversationHook,
    isParallelCue:isParallelCue,
    isResumeParallelCue:isResumeParallelCue,
    parallelTopics:parallelTopics,
    restoreParallelTopic:restoreParallelTopic,
    unfinishedThoughtCue:unfinishedThoughtCue,
    conversationalFocus:conversationalFocus,
    focusClauses:focusClauses,
    carriedListenIntent:carriedListenIntent,
    restorePreviousTopic:restorePreviousTopic,
    recentTopicBranches:recentTopicBranches,
    followupPrimarySubject:followupPrimarySubject,
    activeRecentSubject:activeRecentSubject,
    isDeferCue:isDeferCue,
    isResumeDeferredCue:isResumeDeferredCue,
    deferredTopics:deferredTopics,
    restoreDeferredTopic:restoreDeferredTopic,
    resetContext:resetContext,
    filterHistory:filterHistory,
    resetAt:resetAt,
    cleanFollowupTarget:cleanFollowupTarget,
    recentCarpSubtopic:recentCarpSubtopic,
    recentJinpoStatStyle:recentJinpoStatStyle,
    recentCounterAmbiguity:recentCounterAmbiguity,
    counterCandidateSelector:counterCandidateSelector,
    isCounterCandidateFollowup:isCounterCandidateFollowup,
    isToolDatasetDomain:isToolDatasetDomain,
    portableToolIntentFromText:portableToolIntentFromText,
    recentPortableToolIntent:recentPortableToolIntent,
    isDatasetOnlySwitch:isDatasetOnlySwitch,
    carryExplicitToolDatasetSwitch:carryExplicitToolDatasetSwitch,
    naturalReaction:naturalReaction,
    domainFromHistoryItem:domainFromHistoryItem,
    entityCandidatesFromText:entityCandidatesFromText,
    findRecentEntity:findRecentEntity,
    topicFrames:topicFrames,
    recentSubjects:recentSubjects,
    findSubjectByAnchor:findSubjectByAnchor,
    previousDistinctSubject:previousDistinctSubject,
    recentSecondaryPeople:recentSecondaryPeople,
    latestSecondaryFrame:latestSecondaryFrame,
    findPersonByAnchor:findPersonByAnchor,
    pairFromNamedAnchors:pairFromNamedAnchors,
    relationPeopleFromFrame:relationPeopleFromFrame,
    askedHistory:askedHistory,
    subjectMemory:subjectMemory,
    conversationSignals:conversationSignals,
    conversationGraph:conversationGraph,
    memoryForSubject:memoryForSubject,
    nextUnaskedAspect:nextUnaskedAspect,
    conversationGraphExpansion:conversationGraphExpansion,
    recentFrameByAspect:recentFrameByAspect,
    multiTurnReference:multiTurnReference,
    resolveEntityReference:resolveEntityReference,
    workingMemory:workingMemory,
    splitCompoundIntents:splitCompoundIntents,
    splitCoordinatedAspects:splitCoordinatedAspects,
    splitDifferentSubjectAspects:splitDifferentSubjectAspects,
    compoundClauseScore:compoundClauseScore,
    openEndedFollowup:openEndedFollowup,
    isOpinionFollowupCue:isOpinionFollowupCue,
    isFollowupOnlyUtterance:isFollowupOnlyUtterance,
    correctionFollowup:correctionFollowup,
    parallelSelectionCorrection:parallelSelectionCorrection,
    conflictRecheckTarget:conflictRecheckTarget
  };
})();
