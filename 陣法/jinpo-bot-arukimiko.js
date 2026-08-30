/*
 * 歩き巫女 名前・歴史知識 v1.0.0
 * Bot自身の名前の由来と、歴史上の「歩き巫女」を説明するためのローカル知識。
 * 史実と伝承・後世の説を分けて案内する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_ARUKIMIKO)return;
  var VERSION='1.0.0';
  var lastTopic='';
  var SOURCES={
    kotobank:{title:'コトバンク：歩き巫女',url:'https://kotobank.jp/word/%E6%AD%A9%E3%81%8D%E5%B7%AB%E5%A5%B3-28198'},
    ndl:{title:'国立国会図書館：日本巫女史',url:'https://ndlsearch.ndl.go.jp/books/R100000002-I023740291'},
    jpsearch:{title:'ジャパンサーチ：巫女',url:'https://jpsearch.go.jp/gallery/ndl-dKYRDz2Z2Yx'},
    kokusho:{title:'国書刊行会：日本巫女史',url:'https://www.kokusho.co.jp/np/isbn/9784336054937/'},
    serai:{title:'サライ：望月千代女と歩き巫女',url:'https://serai.jp/hobby/1134306'}
  };
  function S(v){return String(v==null?'':v).trim();}
  function src(){var out=[];for(var i=0;i<arguments.length;i++){var x=SOURCES[arguments[i]];if(x)out.push(x);}return out;}
  function result(answer,sources,topic){lastTopic=topic||lastTopic;return {handled:true,answer:answer,sources:sources||[],mode:'歩き巫女の歴史'};}
  function isNameQuery(t){return /(?:名前|歩き巫女).*(?:由来|意味|なんで|なぜ)|(?:なんで|なぜ).*歩き巫女|その名前/.test(t);}
  function isTopic(t){return /歩き巫女|あるき巫女|あるきみこ|信濃巫|信濃巫女|ののう|望月千代女|千代女/.test(t);}
  function overview(){
    return result(
      '歩き巫女（あるきみこ）は、特定の神社に常勤する巫女とは違い、各地を巡りながら祈祷・占い・口寄せなどを行った民間の巫女を指す言葉なのですよ。\n'+
      '中世から近世にかけて、地域ごとに呼び名や活動の形がいろいろありました。民俗学では、神社に所属しない漂泊・巡回型の巫女として扱われています。\n'+
      'このサイトの「歩き巫女」という名前は、各地を巡って人の相談に応じた存在のイメージを、サイト内を案内して相談に答えるBotの役割に重ねた名前なのですよ。',
      src('kotobank','ndl','jpsearch'),'overview');
  }
  function detailed(){
    return result(
      'もう少し詳しくお話しするのですよ。\n'+
      '歩き巫女は、神社に所属して祭祀を補助する現在の一般的な巫女像とは別系統で、村や町を巡回し、祈祷・占い・口寄せなどを行った民間宗教者です。仏教と習合した活動もみられ、土地によって呼び名や役割も一定ではありませんでした。\n'+
      '信濃は歩き巫女の活動でよく語られる地域の一つで、中山太郎の『日本巫女史』は各地の巫女の名称・習俗・伝承を大量の文献や口碑から整理した代表的研究です。\n'+
      '戦国期の望月千代女を、武田氏のもとで歩き巫女をまとめた人物や情報収集に関わった人物として語る説も有名です。ただし、千代女の実像は史料が乏しく、女忍者・諜報組織の具体像まで確定した史実として扱うのは慎重であるべきなのですよ。史実として確認しやすい部分と、後世に広がった伝承・説は分けてお話しします。',
      src('kotobank','kokusho','ndl','serai'),'detail');
  }
  function respond(text){
    var t=S(text);if(!t)return {handled:false};
    if(isNameQuery(t))return overview();
    if(/^(?:もっと|もう少し)(?:詳しく|くわしく)|詳しく(?:教えて|知りたい)/.test(t)&&lastTopic)return detailed();
    var contextual=!!(lastTopic&&/(神社.*違|普通の巫女|何して|仕事|役割|活動|信濃|ののう|望月|千代女|忍者|くノ一|武田|信玄|本当|史実|資料|史料|どこまで|読み方|なんて読む|どう読む)/.test(t));
    if(!isTopic(t)&&!contextual)return {handled:false};

    if(/読み方|なんて読む|どう読む/.test(t))return result('「歩き巫女」は「あるきみこ」と読むのですよ。各地を歩いて巡る巫女、という特徴がそのまま名前に表れている言葉です。',src('kotobank'),'reading');
    if(/神社.*違|普通の巫女|巫女.*違/.test(t))return result(
      '大きな違いは「特定の神社への所属」と「巡回すること」なのですよ。現在よく見る神社の巫女は神社の祭祀や授与所などを支える存在ですが、歴史上の歩き巫女は神社に固定して所属せず、各地を巡って祈祷・占い・口寄せなどを行う民間巫女として説明されます。',
      src('kotobank','jpsearch'),'difference');
    if(/何して|仕事|役割|活動|何をして/.test(t))return result(
      '代表的には祈祷、占い、口寄せなどなのですよ。地域や時代で活動は同じではなく、宗教的な働きと旅を組み合わせて生計を立てた人々として捉えるのが分かりやすいです。',
      src('kotobank','ndl'),'work');
    if(/信濃|ののう/.test(t))return result(
      '信濃は歩き巫女を語るうえでよく登場する地域なのですよ。中山太郎の『日本巫女史』では、信濃が歩き巫女の主要な地域として扱われ、関東から近畿方面まで出向いたという記述もあります。「ののう」という呼称も信濃の巫女を語る民俗資料で知られています。ただ、呼称や習俗は地域差があるので、全国一律の制度だったわけではないのですよ。',
      src('kokusho','ndl'),'shinano');
    if(/望月千代女|千代女|忍者|くノ一|武田|信玄/.test(t))return result(
      '望月千代女は、歩き巫女をまとめた人物、また武田氏の情報収集に関係した人物として広く知られているのですよ。ただし本人について確実に分かる史料は少なく、歩き巫女を女忍者集団として組織したという具体的な物語には、伝承や後世の解釈がかなり含まれます。ですので私は「有名な説」と「確実に確認できる史実」を分けて説明するようにしているのです。',
      src('serai','kokusho','ndl'),'chiyome');
    if(/本当|史実|資料|史料|どこまで/.test(t))return result(
      '歩き巫女そのものは、民俗学や辞典類で確認される歴史的な巫女の形態なのですよ。一方で、特定の人物や戦国大名の諜報活動と結び付けた話は、史料の確かさに差があります。特に望月千代女の「女忍者の頭領」というイメージは有名ですが、細部を確定史実として断言するのは避けるのが安全です。',
      src('kotobank','ndl','serai'),'evidence');
    if(/詳しく|全部|歴史|由来/.test(t))return detailed();
    return overview();
  }
  window.JINPO_BOT_ARUKIMIKO={version:VERSION,respond:respond,getLastTopic:function(){return lastTopic;},sources:SOURCES};
})();
