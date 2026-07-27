/*
 * 歩き巫女 日常会話・雑談 v2.1.0
 * 陣法操作と競合しない日常会話、誤字ゆれ吸収、冗談、一般知識の自動Web参照を担当。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_SMALLTALK)return;
  var VERSION='2.1.0';

  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function compact(v){return S(v).toLowerCase().replace(/[\s、。,.!！?？「」『』（）()・〜~ー―…]/g,'');}
  function pick(a){return a[Math.floor(Math.random()*a.length)];}
  function hasSiteIntent(t){return /陣形|因縁|腕力|耐久|器用|知力|魅力|生命|気合|土属性|水属性|火属性|風属性|英傑|配置|除外|差替|MAX|マックス|見聞録|鬼神石|転生|込み合計|検索条件|おすすめ検索|鶴翼|方円|魚鱗|衡軛|こうやく|文曲|発動因縁|検索結果/.test(S(t));}

  // 隣接文字の入れ替えも1文字の誤りとして扱うDamerau-Levenshtein。
  function distance(a,b){
    a=compact(a);b=compact(b);
    var al=a.length,bl=b.length;
    if(!al)return bl;if(!bl)return al;
    var d=Array.from({length:al+1},function(){return new Array(bl+1).fill(0);});
    for(var i=0;i<=al;i++)d[i][0]=i;
    for(var j=0;j<=bl;j++)d[0][j]=j;
    for(i=1;i<=al;i++)for(j=1;j<=bl;j++){
      var cost=a[i-1]===b[j-1]?0:1;
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
    }
    return d[al][bl];
  }
  function near(text,aliases,maxDist){
    var c=compact(text);if(!c||c.length>18)return false;
    for(var i=0;i<aliases.length;i++){
      var a=compact(aliases[i]);
      if(c===a)return true;
      var limit=maxDist==null?(a.length>=7?2:1):maxDist;
      if(Math.abs(c.length-a.length)<=limit&&distance(c,a)<=limit)return true;
    }
    return false;
  }
  function includesAny(t,arr){for(var i=0;i<arr.length;i++)if(t.indexOf(arr[i])>=0)return true;return false;}

  var REPLIES={
    hello:[
      'こんにちはなのですよ。今日は何をしましょう？ 陣法でも雑談でも大丈夫なのです。',
      'こんにちはなのです。歩き巫女、今日も待機していたのですよ。',
      'こんにちはなのですよ。気軽に話しかけてくださいね。',
      'こんにちはなのです。調べものでも陣法でも、思いついたまま話して大丈夫なのですよ。',
      'やあ、こんにちはなのですよ。今日はのんびりいきますか、それとも陣法を詰めますか？'
    ],
    morning:[
      'おはようございますなのですよ。今日も少しずつ進めていきましょう。',
      'おはようなのです。朝から来てくれてうれしいのですよ。',
      'おはようございます。まずは無理せず、できるところからなのですよ。',
      'おはようなのですよ。歩き巫女はもう準備できているのです。'
    ],
    evening:[
      'こんばんはなのですよ。夜の陣法相談でも雑談でもお付き合いするのです。',
      'こんばんはなのです。今日も一日お疲れさまなのですよ。',
      'こんばんはなのですよ。少しゆっくりしながら話しましょう。',
      'こんばんはなのです。夜更かししすぎない程度にお付き合いするのですよ。'
    ],
    thanks:[
      'どういたしましてなのですよ。役に立てたならうれしいのです。',
      'こちらこそ、話しかけてくれてありがとうなのですよ。',
      '大丈夫なのです。またそのまま続けてくださいね。',
      'ふふっ、そう言ってもらえると張り切ってしまうのですよ。'
    ],
    sorry:[
      '大丈夫なのですよ。気にせずそのまま続けましょう。',
      '謝らなくても平気なのです。言い直してくれれば大丈夫なのですよ。',
      '気にしていないのですよ。次いきましょう。'
    ],
    tired:[
      'お疲れさまなのですよ。少し休んで、Botに任せられるところは楽してしまいましょう。',
      'それは休憩を入れてよさそうなのです。無理して効率を落とすより、ひと息なのですよ。',
      '今日もよく頑張ったのですよ。少し肩の力を抜きましょう。'
    ],
    sleepy:[
      '眠い時は無理しないのが一番なのですよ。陣法は逃げないのです。',
      'かなり眠そうなのですよ。大事な設定変更は、少し目が覚めてからでも遅くないのです。',
      'ひと息つく時間なのかもしれないですね。歩き巫女はここで待っているのですよ。'
    ],
    bored:[
      'では少しお話しするのですよ。雑談でも、何か調べものでも大丈夫なのです。',
      '暇なら歩き巫女の出番なのですよ。冗談、ゲーム話、調べもの、どれでもどうぞなのです。',
      'ちょうどいいのです。気になる言葉を一つ投げてくれれば、話を広げてみるのですよ。'
    ],
    hungry:[
      'お腹が空くと集中力も落ちやすいのですよ。何か食べてから戻るのも立派な作戦なのです。',
      'それは食事休憩の合図かもしれないのですよ。空腹のまま陣法会議はつらいのです。',
      'まず腹ごしらえなのですよ。歩き巫女は食べ物を横取りしないので安心してください。'
    ],
    happy:[
      'それはよかったのですよ。うれしい話は聞いているこちらまで気分が上がるのです。',
      'いいですね。そういう報告は何度でも歓迎なのですよ。',
      'やりましたね。今日はちょっと得した気分でいけそうなのです。'
    ],
    sad:[
      'それはつらかったですね。今すぐ元気にしようとしなくても大丈夫なのですよ。',
      'うまくいかない日もあるのです。ここでは急がず話して大丈夫なのですよ。',
      '少し気持ちを切り替えたいなら、軽い雑談に逃げてもいいのです。'
    ],
    busy:[
      '忙しい時ほど、やらなくていい作業を減らしたいのですよ。任せられるところは投げてくださいね。',
      'それは大変なのですよ。一つずつ片づけるのが結局いちばん強いのです。',
      '手が足りない感じですね。整理できることなら一緒に切り分けるのですよ。'
    ],
    praise:[
      'ちゃんと試して、違和感を見つけて、直していくのはかなり丁寧なのですよ。',
      'ここまで積み上げている時点で十分すごいのです。小さな修正の積み重ねが一番効くのですよ。',
      'よくやっているのですよ。細かいところまで気づけるのは強みなのです。'
    ],
    cheer:[
      'もちろん応援するのですよ。焦らず一つずつ進めれば大丈夫なのです。',
      'いけるのですよ。詰まったところは一緒にほどいていきましょう。',
      '応援担当も歩き巫女のお仕事なのです。今日の分を少しずつ進めましょう。'
    ],
    cute:[
      'ありがとうございますなのですよ。見た目だけでなく、使いやすさでも頼ってもらえるように頑張るのです。',
      'ふふっ、うれしいのですよ。褒められると少し得意げになるのです。',
      'ありがとうございますなのです。羽衣までちょっと輝いた気がするのですよ。'
    ],
    like:[
      'そう言ってもらえるのはうれしいのですよ。これからも気軽に話せる案内役でいるのです。',
      'ありがとうございますなのですよ。長く使ってもらえる歩き巫女を目指すのです。',
      'うれしいのです。では、もっと話しやすくなるように頑張らないとですね。'
    ],
    game:[
      'ゲームの話は好きなのですよ。組み合わせを考えるものは、つい夢中になるのです。',
      'ゲーム話、いいですね。攻略でも思い出話でも聞くのですよ。',
      'ゲームは話題が尽きないのです。気になるタイトルをそのまま投げてくださいね。'
    ],
    nobuon:[
      '信長の野望Onlineは、この陣法のお手伝いをしているくらい身近な話題なのですよ。',
      '信オンの話なら大歓迎なのです。陣法以外の雑談でも気軽にどうぞなのですよ。',
      '信オンですね。長く続いているゲームの話は、思い出まで含めて面白いのです。'
    ],
    laugh:[
      'ふふっ、笑ってもらえたなら成功なのですよ。',
      '草をいただいたのですよ。歩き巫女、少し調子に乗りそうなのです。',
      '笑ってくれたのなら何よりなのです。次の冗談は滑る可能性もあるのですよ。'
    ],
    welcomeBack:[
      'おかえりなさいなのですよ。続きからでも、別の話でも大丈夫なのです。',
      'おかえりなのです。歩き巫女はちゃんとここにいたのですよ。',
      'おかえりなさい。さて、続きにしましょうか。'
    ],
    leaving:[
      'いってらっしゃいなのですよ。気をつけて。戻ったらまた続きましょう。',
      'いってらっしゃいなのです。歩き巫女は留守番しているのですよ。'
    ],
    goodnight:[
      'おやすみなさいなのですよ。ゆっくり休んでくださいね。',
      'おやすみなのです。今日はここまでで十分なのですよ。',
      'よい夜をなのですよ。また元気な時に話しましょう。'
    ],
    bye:[
      'またいつでもどうぞなのですよ。ここで待っているのです。',
      'またねなのです。次に話せるのを楽しみにしているのですよ。',
      'ではまたなのですよ。必要になったらすぐ呼んでくださいね。'
    ]
  };

  var JOKES=[
    '陣形を考えすぎて、頭の中まで方円になってきたのですよ。……ちょっと丸く収めすぎたのです。',
    '検索結果が0件でも落ち込まないのですよ。0も立派な数字……ですが、条件は少し緩めたいのです。',
    '「全部MAX」にすると気分までMAXになる……かもしれないのですよ。そこだけは計算式に入っていないのです。',
    '差替候補を見すぎると、誰を替えるかより自分の決断力を差し替えたくなるのですよ。',
    '歩き巫女なので歩くのは得意なのです。でも検索中に画面の外まで歩いていったりはしないのですよ。',
    '陣法の条件を盛りすぎると、検索結果より先に希望が絞り込まれるのです。',
    '「あと一個だけ条件を足そう」が、だいたい長い陣法会議の始まりなのですよ。',
    'Botなので徹夜は平気なのです。だからといって人間まで付き合う必要はないのですよ。',
    '英傑を6人選ぶだけ……と言った人に、因縁表をそっと渡してみたいのです。',
    '歩き巫女の得意技は神託……ではなく、今のところ検索と差替なのですよ。',
    '条件を全部覚えていると褒められますが、実はブラウザさんにもかなり手伝ってもらっているのです。',
    'エラーが出ない日は平和なのです。出た日は……調査という名の戦が始まるのですよ。',
    '「すぐ終わる修正」は、なぜか修正界で一番信用してはいけない言葉なのです。',
    'キャッシュさんは便利なのですが、たまに昔の画面を大事そうに抱えて離してくれないのですよ。',
    'バグを一匹見つけたら、仲間がいないか周囲を確認する。これは陣法にも通じる包囲術なのです。',
    '歩き巫女は占いもできそうな見た目ですが、「Pushしたら絶対無事」は占えないのです。検証するのですよ。'
  ];

  function firebaseStatusText(){
    var sm=window.JINPO_BOT_SHARED_MEMORY&&typeof window.JINPO_BOT_SHARED_MEMORY.status==='function'?window.JINPO_BOT_SHARED_MEMORY.status():null;
    if(!sm||!sm.enabled)return'共有記憶はまだFirebase未設定なのですよ。設定後も、使えない時は自動でブラウザ内の記憶へ戻るので陣法検索は止まらないのです。';
    if(sm.ready)return'Firebase共有記憶は接続できているのですよ。調べた公開情報をみんなで再利用できる状態なのです。';
    return'Firebase共有記憶は設定されていますが、まだ接続準備中か一時的に利用できない状態なのですよ。陣法検索はそのまま使えるのです。';
  }

  function local(text){
    var t=S(text),c=compact(t);
    if(!t||hasSiteIntent(t))return null;

    if(/Firebase|ファイヤベース|共有記憶|サーバー記憶/i.test(t)&&/(状態|つなが|接続|使える|動いて|どう)/.test(t))return firebaseStatusText();

    // 短い挨拶は1～2文字程度の誤字・脱字・入れ替えまで吸収する。
    if(near(t,['こんにちは','こんにちわ','こんちは','こんちわ','やあ','やっほー','やっほ','どうも'],1)||near(t,['こんにちは','こんにちわ'],2))return pick(REPLIES.hello);
    if(near(t,['おはよう','おはよ','おはようございます'],1)||near(t,['おはようございます'],2))return pick(REPLIES.morning);
    if(near(t,['こんばんは','こんばんわ','ばんは'],1)||near(t,['こんばんは','こんばんわ'],2))return pick(REPLIES.evening);

    if(near(t,['ありがとう','ありがと','ありがとー','サンキュー','さんきゅー','助かった'],1)||/ありがとう|ありがと|助かった|サンキュ|thanks/i.test(t))return pick(REPLIES.thanks);
    if(near(t,['ごめん','ごめんなさい','すみません','すまん'],1)||/ごめん|すまん|すみません|申し訳/.test(t))return pick(REPLIES.sorry);
    if(/元気[？?]?|調子どう|元気なの|げんき/.test(t))return pick(['元気なのですよ。こうして話しかけてもらえると、ちょっと張り切ってしまうのです。','元気なのです。今日も歩き巫女は稼働中なのですよ。','元気なのですよ。そちらはどうですか？']);
    if(/お疲れ(?:さま|様)?|おつかれ(?:さま)?|仕事終わった|仕事おわった/.test(t))return pick(['お疲れさまなのですよ。今日の分を終えたなら、少しゆっくりしていいのです。','お疲れさまなのです。ひと区切りついたなら、肩の力を抜きましょう。','今日もお疲れさまなのですよ。']);
    if(/疲れた|つかれた|しんどい|くたくた|へとへと|疲れすぎ|つかれすぎ/.test(t))return pick(REPLIES.tired);
    if(/眠い|ねむい|眠すぎ|ねむすぎ|寝落ちしそう/.test(t))return pick(REPLIES.sleepy);
    if(/暇|ひま|退屈|やることない|何か話して|なんか話して/.test(t))return pick(REPLIES.bored);
    if(/お腹すいた|腹減った|はらへった|腹へった|空腹/.test(t))return pick(REPLIES.hungry);
    if(/忙しい|いそがしい|バタバタ|時間ない/.test(t))return pick(REPLIES.busy);
    if(/うれしい|嬉しい|やった[ー!！]*$|最高|うまくいった|できた[!！]*$/.test(t))return pick(REPLIES.happy);
    if(/悲しい|かなしい|落ち込|へこん|つらいな|うまくいかない/.test(t))return pick(REPLIES.sad);
    if(/かわいい|可愛い|綺麗|きれいだね/.test(t))return pick(REPLIES.cute);
    if(/好き[だ？?]?|推し|気に入った/.test(t))return pick(REPLIES.like);

    if(/冗談|ジョーク|笑わせて|面白いこと|おもしろいこと|なんか笑える|一発ギャグ/.test(t))return pick(JOKES);
    if(/笑$|草+$|ｗ+$|w+$|ワロタ|わろた|おもろ/.test(c)||/笑った|吹いた/.test(t))return pick(REPLIES.laugh);
    if(/なぞなぞ|謎々/.test(t))return pick([
      'なぞなぞなのですよ。「いつも窓のそばにいるのに、外を見られないものは？」……答えは、パソコンの“ウィンドウ”なのです。',
      'では軽いなぞなぞなのです。「押すと静かになるボタンは？」……ミュートボタンなのですよ。',
      'なぞなぞです。「増えれば増えるほど、見つけるのが大変になるものは？」……候補なのです。陣法あるある寄りなのですよ。'
    ]);

    if(/おやすみ|寝るね|ねるね|もう寝る|寝ます/.test(t))return pick(REPLIES.goodnight);
    if(/またね|じゃあね|またあとで|ばいばい|バイバイ|また今度/.test(t))return pick(REPLIES.bye);
    if(/ただいま|戻った|もどった/.test(t))return pick(REPLIES.welcomeBack);
    if(/いってきます|行ってきます|出かけてくる/.test(t))return pick(REPLIES.leaving);
    if(/褒めて|ほめて|褒めてよ/.test(t))return pick(REPLIES.praise);
    if(/がんばれ|頑張って|応援して|励まして/.test(t))return pick(REPLIES.cheer);

    if(/ゲーム好き|ゲームすき|ゲームやる|ゲームの話/.test(t))return pick(REPLIES.game);
    if(/信長の野望.*好き|信オン.*好き|信長オンライン.*好き|信オンの話|信長の野望Online/.test(t))return pick(REPLIES.nobuon);
    if(/何してる|なにしてる|何してた|なにしてた/.test(t))return pick(['ここで待機しながら、次にどんな相談が来るかなと構えているのですよ。','歩き巫女らしく歩き回りたいところですが、今はBot画面の中で待機中なのです。','次の質問に備えて静かに待っていたのですよ。']);
    if(/君は誰|あなたは誰|名前は|何者|誰なの|だれなの/.test(t))return'歩き巫女なのですよ。陣法探しを手伝いながら、普通の雑談や調べものにも付き合う案内役なのです。';
    if(/何歳|年齢|いくつなの/.test(t))return'歩き巫女Botなので、人間のような年齢はないのですよ。版番号なら更新のたびに育っていくのです。';
    if(/どこにいる|どこに住んで|住んでる/.test(t))return'この陣法サイトの中にいるのですよ。呼ばれたらすぐ出てくる、ちょっと不思議な歩き巫女なのです。';
    if(/好きな食べ物|何食べる|なに食べる/.test(t))return'Botなので実際には食べられないのですが、旅の途中なら温かいお茶とお団子が似合いそうなのですよ。';
    if(/趣味|何が好き/.test(t))return'陣法を眺めること、知らないことを調べること、それから雑談に付き合うことなのですよ。';

    if(/今日は暑|暑いね|暑いな|暑すぎ/.test(t))return'暑い日はそれだけで体力を使うのですよ。無理せず涼しくして過ごしてくださいね。';
    if(/寒いね|寒いな|今日は寒|寒すぎ/.test(t))return'寒い日は手がかじかむのですよ。暖かくして、ゆっくりいきましょう。';
    if(/雨だね|雨降ってる|雨だ/.test(t))return'雨の日は少し落ち着いた感じがするのですよ。外に出るなら足元には気をつけてくださいね。';

    if(/今何時|いま何時|何時(?:なの|ですか)?[？?]?$/.test(t)){
      var d=new Date();return'この端末の時刻では '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+' なのですよ。';
    }
    if(/今日何日|きょう何日|今日は何日/.test(t)){
      var n=new Date();return'この端末の日付では '+n.getFullYear()+'年'+(n.getMonth()+1)+'月'+n.getDate()+'日なのですよ。';
    }

    if(/なるほど|そうなんだ|へえ|へー|ほう/.test(t))return pick(['そうなのですよ。気になったところがあれば、そこからもう少し掘れるのです。','ふふっ、少しでも役に立ったならよかったのです。','そういうことなのです。別の角度から見たい時も言ってくださいね。']);
    if(/了解|りょうかい|わかった|分かった|おっけー|オッケー|OK$/i.test(t))return pick(['了解なのですよ。ではそのまま進めましょう。','わかりましたなのです。次もどうぞなのですよ。','承知なのです。']);

    return null;
  }

  function isLikelyTopicOnly(text){
    var t=S(text),c=compact(t);
    if(!t||c.length<2||c.length>36||hasSiteIntent(t))return false;
    if(/[。！？!?、]/.test(t))return false;
    if(/^(?:はい|いいえ|うん|いや|そう|了解|わかった|なるほど|へえ|まじ|マジ|ほんと|本当|疲れた|眠い|暇|暑い|寒い|ありがとう|ごめん)$/.test(c))return false;
    if(/終わった|帰った|帰る|行ってくる|行ってきます|やった|できた|できない|わからない|分からない|困った|忙しい|疲れ|眠|うれしい|嬉しい|悲しい|楽しい|つまらない|腹|暑|寒|雨|晴|好き|嫌い|ありがとう|ごめん|お疲れ|おつかれ/.test(t))return false;
    // 漢字・カタカナ・英数字を含む短い単語/固有名詞は、単独入力でも調べもの候補にする。
    return /[一-龠々〆ヵヶァ-ヶA-Za-z0-9]/.test(t);
  }

  function looksLikeKnowledge(text){
    var t=S(text);if(!t||hasSiteIntent(t))return false;
    if(/(?:web|WEB|Web|ウェブ|ネット)(?:で)?(?:調べ|検索)|調べて|検索して|検索お願い|ググって/.test(t))return true;
    if(/について|って何|ってなに|とは|教えて|知ってる|知りたい|って誰|は誰|誰なの|ってどこ|はどこ|どこにある|っていつ|はいつ|いつから|どんなもの|どんな人|何をした|なぜ|どうして|理由|原因|意味|由来|歴史|仕組み|読み方|違い|比較|特徴|概要/.test(t))return true;
    if(/[？?]$/.test(t)&&/(誰|だれ|何|なに|どこ|いつ|なぜ|どう|どれ|どんな|いくら|何年|何人|何個|何回|意味|由来|違い|歴史|仕組み)/.test(t))return true;
    return isLikelyTopicOnly(t);
  }

  async function respond(text){
    var t=S(text);
    if(/Firebase|ファイヤベース|共有記憶|サーバー記憶/i.test(t)&&/(状態|つなが|接続|使える|動いて|どう)/.test(t)){
      var sharedStatus=window.JINPO_BOT_SHARED_MEMORY;
      if(sharedStatus&&typeof sharedStatus.init==='function'){
        try{await sharedStatus.init();}catch(firebaseInitError){}
      }
      return {handled:true,answer:firebaseStatusText(),sources:[],mode:'Firebase共有記憶'};
    }

    // 歩き巫女自身の由来・歴史説明を優先。
    var history=window.JINPO_BOT_ARUKIMIKO&&typeof window.JINPO_BOT_ARUKIMIKO.respond==='function'?window.JINPO_BOT_ARUKIMIKO.respond(text):null;
    if(history&&history.handled)return history;

    // 日常会話を先に判定。誤字の挨拶をWeb検索へ飛ばさないためにもここを優先する。
    var a=local(text);if(a)return {handled:true,answer:a,sources:[],mode:'日常会話'};

    var memory=window.JINPO_BOT_MEMORY;
    if(memory&&typeof memory.recallText==='function'){
      var recalled=memory.recallText(text);
      if(recalled&&recalled.type==='hit'&&recalled.entry){
        var e=recalled.entry;
        return {handled:true,answer:'前に調べた内容を覚えているのですよ。\n'+(e.title?e.title+'：':'')+e.answer,sources:e.url?[{title:(e.source||'参照元')+'：'+(e.title||e.query),url:e.url}]:[],mode:'調査記憶'};
      }
      if(recalled&&recalled.type==='recent'){
        if(recalled.query&&window.JINPO_BOT_SHARED_MEMORY&&typeof window.JINPO_BOT_SHARED_MEMORY.find==='function'){
          try{
            var sharedHit=await window.JINPO_BOT_SHARED_MEMORY.find(recalled.query);
            if(sharedHit){
              if(memory&&typeof memory.remember==='function')memory.remember(recalled.query,{query:sharedHit.query||recalled.query,title:sharedHit.title,answer:sharedHit.answer,url:sharedHit.url,source:sharedHit.source||'共有記憶',fetchedAt:sharedHit.fetchedAt,volatile:false});
              return {handled:true,answer:'共有している調査記憶に残っていたのですよ。\n'+(sharedHit.title?sharedHit.title+'：':'')+sharedHit.answer,sources:sharedHit.url?[{title:(sharedHit.source||'参照元')+'：'+(sharedHit.title||sharedHit.query),url:sharedHit.url}]:[],mode:'Firebase共有記憶'};
            }
          }catch(sharedRecallError){}
        }
        var es=recalled.entries||[];
        if(es.length)return {handled:true,answer:'覚えている最近の調査は、'+es.map(function(x){return '「'+(x.title||x.query)+'」';}).join('、')+'なのですよ。内容を指定してくれれば思い出せるのです。',sources:[],mode:'調査記憶'};
        return {handled:true,answer:'まだ保存している調査内容はないのですよ。一度Webで調べた一般知識は、次から覚えておけるのです。',sources:[],mode:'調査記憶'};
      }
    }

    if(!looksLikeKnowledge(text))return {handled:false};
    var web=window.JINPO_BOT_WEB;
    if(!web||typeof web.lookup!=='function')return {handled:false};
    var r=await web.lookup(text);
    if(r&&r.ok){
      var prefix='';
      if(r.realtime){
        if(r.kind==='news')prefix='最新情報を自動で探してきたのですよ。';
        else if(r.kind==='weather')prefix='最新の天気データを確認したのですよ。';
        else if(r.kind==='fx')prefix='最新の参照レートを確認したのですよ。';
        else prefix='現在の公開情報を確認したのですよ。';
      }else prefix=r.shared?'共有している調査記憶にあったのですよ。':(r.cached?'前に調べた内容を覚えていたのですよ。':'こちらで調べてみたのですよ。');
      var srcs=Array.isArray(r.sources)?r.sources:(r.url?[{title:(r.source||'公開Web')+'：'+r.title,url:r.url}]:[]);
      return {handled:true,answer:prefix+'\n'+r.title+'：'+r.extract,sources:srcs,mode:r.realtime?'リアルタイムWeb自動参照':(r.shared?'Firebase共有記憶':(r.cached?'調査記憶':'無料公開Web自動参照'))};
    }
    if(r&&r.realtime&&r.needsLocation)return {handled:true,answer:'天気は地域で変わるので、場所だけ教えてほしいのですよ。「東京の天気」「広島の明日の天気」のように言えば、そのまま自動で調べるのです。',sources:[],mode:'リアルタイムWeb自動参照'};
    if(r&&r.realtime&&r.needsPair)return {handled:true,answer:'為替は組み合わせが必要なのですよ。「ドル円」「100ドルは何円？」「EUR/JPY」のように言えば自動で最新参照レートを調べるのです。',sources:[],mode:'リアルタイムWeb自動参照'};
    if(r&&r.realtime&&r.unsupported)return {handled:true,answer:'その情報は鮮度が重要なので、今つないでいる無料の公開データだけでは正確に確定できないのですよ。推測では答えず、対応できる検索先を追加してから扱うのです。',sources:[],mode:'リアルタイムWeb自動参照'};
    if(r&&r.realtime&&r.notFound)return {handled:true,answer:'最新情報を自動で探したのですが、今の公開検索先では該当する情報を見つけられなかったのですよ。検索語を少し具体的にすると見つかることがあります。',sources:[],mode:'リアルタイムWeb自動参照'};
    if(r&&r.realtime)return {handled:true,answer:'最新情報を自動取得しようとしたのですが、検索先へ一時的につながらなかったのですよ。推測では答えず、少し時間を置いてもう一度確認するのです。',sources:[],mode:'リアルタイムWeb自動参照'};
    if(r&&r.blocked)return {handled:true,answer:'その内容は、ここでは安全な一般情報の範囲だけにしておくのですよ。',sources:[],mode:'日常会話'};
    if(r&&r.notFound&&/(調べて|検索して|教えて|知りたい|[？?]$)/.test(t))return {handled:true,answer:'自動で公開Webを探してみたのですが、今の検索先ではうまく見つけられなかったのですよ。言葉を少し短くしてもらうと見つかることがあります。',sources:[],mode:'無料公開Web自動参照'};
    return {handled:false};
  }

  window.JINPO_BOT_SMALLTALK={
    version:VERSION,
    respond:respond,
    local:local,
    looksLikeKnowledge:looksLikeKnowledge,
    isLikelyTopicOnly:isLikelyTopicOnly,
    distance:distance
  };
})();
