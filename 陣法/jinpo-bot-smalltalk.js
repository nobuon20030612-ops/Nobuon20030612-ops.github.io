/*
 * 歩き巫女 日常会話・雑談 v1.1.0
 * 陣法操作と競合しない軽い日常会話、冗談、一般知識の無料公開Web参照を担当。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_SMALLTALK)return;
  var VERSION='1.4.0';
  function S(v){return String(v==null?'':v).trim();}
  function pick(a){return a[Math.floor(Math.random()*a.length)];}
  function hasSiteIntent(t){return /陣形|因縁|腕力|耐久|器用|知力|魅力|生命|気合|土属性|水属性|火属性|風属性|英傑|配置|除外|差替|MAX|見聞録|鬼神石|転生|込み合計|検索|おすすめ|鶴翼|方円|魚鱗|衡軛|文曲/.test(t);}
  function local(text){
    var t=S(text);
    if(!t||hasSiteIntent(t))return null;
    if(/Firebase|ファイヤベース|共有記憶|サーバー記憶/.test(t)&&/(状態|つなが|接続|使える|動いて|どう)/.test(t)){
      var sm=window.JINPO_BOT_SHARED_MEMORY&&typeof window.JINPO_BOT_SHARED_MEMORY.status==='function'?window.JINPO_BOT_SHARED_MEMORY.status():null;
      if(!sm||!sm.enabled)return'共有記憶はまだFirebase未設定なのですよ。設定後も、使えない時は自動でブラウザ内の記憶へ戻るので陣法検索は止まらないのです。';
      if(sm.ready)return'Firebase共有記憶は接続できているのですよ。調べた公開情報をみんなで再利用できる状態なのです。';
      return'Firebase共有記憶は設定されていますが、まだ接続準備中か一時的に利用できない状態なのですよ。陣法検索はそのまま使えるのです。';
    }
    if(/^(こんにちは|こんちは|こんちわ|やあ|やっほ|どうも)[！!。\s]*$/.test(t))return'こんにちはなのですよ。今日はどんな感じですか？ 陣法の話でも雑談でも大丈夫なのですよ。';
    if(/^(おはよう|おはよ)[！!。\s]*$/.test(t))return'おはようございますなのですよ。ゆっくり始めていきましょう。';
    if(/^(こんばんは|こんばんわ)[！!。\s]*$/.test(t))return'こんばんはなのですよ。夜の陣法相談でも、ちょっとした雑談でもお付き合いするのですよ。';
    if(/ありがとう|ありがと|助かった|サンキュ/.test(t))return'どういたしましてなのですよ。そう言ってもらえるとうれしいのです。';
    if(/ごめん|すまん|すみません/.test(t))return'大丈夫なのですよ。気にせずそのまま続けましょう。';
    if(/元気[？?]?|調子どう/.test(t))return'元気なのですよ。こうして話しかけてもらえると、ちょっと張り切ってしまうのです。';
    if(/疲れた|つかれた|しんどい/.test(t))return'お疲れさまなのですよ。少し休んでからでも大丈夫ですし、Botに任せられるところは楽してしまいましょう。';
    if(/眠い|ねむい/.test(t))return'眠い時は無理しないのが一番なのですよ。陣法は逃げないので、ひと息ついても大丈夫です。';
    if(/暇|ひま|退屈/.test(t))return'では少しお話しするのですよ。陣法をいじって遊ぶのもいいですし、雑談のお題を投げてもらっても大丈夫です。';
    if(/お腹すいた|腹減った|はらへった/.test(t))return'それは集中力が落ちる合図かもしれないのですよ。まず何か食べてから陣法会議に戻るのも立派な作戦です。';
    if(/かわいい|可愛い/.test(t))return'ありがとうございますなのですよ。見た目だけでなく、使いやすさでも頼ってもらえるように頑張るのです。';
    if(/好き[だ？?]?|推し/.test(t))return'そう言ってもらえるのはうれしいのですよ。これからも気軽に話せる案内役でいるのです。';
    if(/冗談|ジョーク|笑わせて|面白いこと|おもしろいこと/.test(t))return pick([
      '陣形を考えすぎて、頭の中まで方円になってきたのですよ。……ちょっと丸く収めすぎたのです。',
      '検索結果が0件でも落ち込まないのですよ。0も立派な数字……ですが、条件は少し緩めたいのです。',
      '「全部MAX」にすると気分までMAXになる……かもしれないのですよ。そこだけは計算式に入っていないのです。',
      '差替候補を見すぎると、誰を替えるかより自分の決断力を差し替えたくなるのですよ。'
    ]);

    if(/おやすみ|寝るね|ねるね/.test(t))return'おやすみなさいなのですよ。ゆっくり休んでくださいね。またいつでも話しかけてほしいのです。';
    if(/またね|じゃあね|またあとで/.test(t))return'またいつでもどうぞなのですよ。ここで待っているのです。';
    if(/褒めて|ほめて/.test(t))return'ちゃんと試しながら使いやすくしようとしているの、かなり丁寧でいいと思うのですよ。少しずつ良くなっているのです。';
    if(/がんばれ|頑張って|応援して/.test(t))return'もちろん応援するのですよ。焦らず一つずつ進めれば大丈夫なのです。';
    if(/ゲーム好き|ゲームすき|ゲームやる/.test(t))return'ゲームの話は好きなのですよ。陣法みたいに組み合わせを考えるものは、つい夢中になってしまうのです。';
    if(/信長の野望.*好き|信オン.*好き|信長オンライン.*好き/.test(t))return'こうして陣法のお手伝いをしているくらいなので、とても身近に感じているのですよ。ゲームの話も気軽に振ってくださいね。';
    if(/笑$|草$|ｗ+$|w+$/.test(t))return'ふふっ、ちょっとでも笑ってもらえたなら成功なのですよ。';
    if(/何してる|なにしてる/.test(t))return'ここで待機しながら、次にどんな相談が来るかなと構えているのですよ。';
    if(/君は誰|あなたは誰|名前は|何者/.test(t))return'歩き巫女なのですよ。陣法探しを手伝いながら、普通の雑談にも付き合う案内役なのです。';
    if(/今日は暑|暑いね|暑いな/.test(t))return'暑い日はそれだけで体力を使うのですよ。無理せず涼しくして過ごしてくださいね。';
    if(/寒いね|寒いな|今日は寒/.test(t))return'寒い日は手がかじかむのですよ。暖かくして、ゆっくりいきましょう。';
    return null;
  }
  function looksLikeKnowledge(text){
    var t=S(text);if(!t||hasSiteIntent(t))return false;
    return /について|って何|とは|教えて|調べて|検索して|webで|WEBで|ウェブで|ネットで|って誰|は誰|ってどこ|はどこ|っていつ|はいつ|どんなもの|どんな人/.test(t);
  }
  async function respond(text){
    var t=S(text);
    if(/Firebase|ファイヤベース|共有記憶|サーバー記憶/.test(t)&&/(状態|つなが|接続|使える|動いて|どう)/.test(t)){
      var sharedStatus=window.JINPO_BOT_SHARED_MEMORY;
      if(sharedStatus&&typeof sharedStatus.init==='function'){
        try{await sharedStatus.init();}catch(firebaseInitError){}
      }
      var statusAnswer=local(text);
      if(statusAnswer)return {handled:true,answer:statusAnswer,sources:[],mode:'Firebase共有記憶'};
    }
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
    var history=window.JINPO_BOT_ARUKIMIKO&&typeof window.JINPO_BOT_ARUKIMIKO.respond==='function'?window.JINPO_BOT_ARUKIMIKO.respond(text):null;
    if(history&&history.handled)return history;
    var a=local(text);if(a)return {handled:true,answer:a,sources:[],mode:'日常会話'};
    if(!looksLikeKnowledge(text))return {handled:false};
    var web=window.JINPO_BOT_WEB;
    if(!web||typeof web.lookup!=='function')return {handled:false};
    var r=await web.lookup(text);
    if(r&&r.ok){
      var prefix=r.shared?'共有している調査記憶にあったのですよ。':(r.cached?'前に調べた内容を覚えていたのですよ。':'調べてみたのですよ。');
      return {handled:true,answer:prefix+'\n'+r.title+'：'+r.extract,sources:r.url?[{title:(r.source||'Wikipedia')+'：'+r.title,url:r.url}]:[],mode:r.shared?'Firebase共有記憶':(r.cached?'調査記憶':'無料公開Web参照')};
    }
    if(r&&r.realtime)return {handled:true,answer:'それは最新情報が大事な内容なのですよ。今の無料Web参照は百科事典の公開情報向けなので、速報や今日の情報を正確に追う用途にはまだ向いていないのです。',sources:[],mode:'無料公開Web参照'};
    if(r&&r.blocked)return {handled:true,answer:'その内容については、安全に案内できる一般的な範囲でならお話しできるのですよ。',sources:[],mode:'日常会話'};
    return {handled:false};
  }
  window.JINPO_BOT_SMALLTALK={version:VERSION,respond:respond,local:local,looksLikeKnowledge:looksLikeKnowledge};
})();
