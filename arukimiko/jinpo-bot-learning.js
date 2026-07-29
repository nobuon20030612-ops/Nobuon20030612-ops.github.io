/*
 * 歩き巫女 会話学習 v1.0.0
 *
 * 目的:
 * - 会話するほど「よく話す話題」「明示的に教えられたこと」「訂正」を端末内で覚える。
 * - 公開サイトの全利用者が勝手に共有知識を書き換える事故を避けるため、
 *   ユーザー会話から得た事実は localStorage の端末内学習を基本とする。
 * - たいらの野望の正本知識は JINPO_TAIRANO_KNOWLEDGE 側を優先する。
 *
 * 生チャット全文はここへ複製保存しない。話題回数と、明示的に覚えるよう言われた短い事実だけを保存する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_LEARNING)return;

  var VERSION='1.0.0';
  var KEY='jinpoBotLearning.v1';
  var MAX_FACTS=120;
  var MAX_TOPICS=40;

  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function N(v){
    return S(v).toLowerCase()
      .replace(/[？?！!。、・「」『』【】（）()\[\]［］:：=＝\s]/g,'')
      .slice(0,160);
  }
  function empty(){return {version:1,facts:[],topics:{},lastTopic:'',turns:0,updatedAt:0};}
  function load(){
    try{
      var d=JSON.parse(localStorage.getItem(KEY)||'null');
      if(!d||typeof d!=='object')return empty();
      d.facts=Array.isArray(d.facts)?d.facts.slice(-MAX_FACTS):[];
      d.topics=d.topics&&typeof d.topics==='object'?d.topics:{};
      d.turns=Number(d.turns)||0;
      return d;
    }catch(e){return empty();}
  }
  function save(d){
    d.updatedAt=Date.now();
    try{localStorage.setItem(KEY,JSON.stringify(d));}catch(e){}
    return d;
  }

  var TOPICS=[
    ['陣法',/陣法|因縁|陣形|鶴翼|方円|魚鱗|衡軛|英傑|差替|全MAX/],
    ['たいらの野望',/たいらの野望|鬼神石|九十九|魔導結晶|七星転生|家臣計算|能力計算|鎮魂符|御蔵番|カウンター/],
    ['カープ',/カープ|広島東洋|プロ野球|野球|順位|スタメン|先発/],
    ['動画編集',/動画編集|編集|premiere|after effects|davinci|字幕|テロップ/i],
    ['AI',/生成AI|chatgpt|openai|claude|画像生成|動画生成|\bAI\b/i],
    ['サイト運営',/サイト運営|seo|アクセス|github pages|firebase|webサイト|ホームページ/i],
    ['仕事',/仕事|会社|経営|営業|接客|作業|締切|納期/],
    ['ゲーム',/信長の野望|信オン|ゲーム/],
    ['天気',/天気|気温|雨|雪|予報/]
  ];

  function classify(text){
    var t=S(text),out=[];
    TOPICS.forEach(function(x){if(x[1].test(t))out.push(x[0]);});
    return out;
  }

  function observe(text){
    var t=S(text);if(!t)return null;
    var d=load();d.turns++;
    var topics=classify(t);
    topics.forEach(function(k){d.topics[k]=(Number(d.topics[k])||0)+1;d.lastTopic=k;});
    var keys=Object.keys(d.topics);
    if(keys.length>MAX_TOPICS){
      keys.sort(function(a,b){return (d.topics[b]||0)-(d.topics[a]||0);});
      var keep={};keys.slice(0,MAX_TOPICS).forEach(function(k){keep[k]=d.topics[k];});d.topics=keep;
    }
    save(d);
    return {turns:d.turns,topics:topics,lastTopic:d.lastTopic};
  }

  function parseFact(note){
    note=S(note).replace(/^[、,:：\s]+/,'').replace(/[。！!]+$/,'');
    var m=note.match(/^(.{1,50}?)のカウンター(?:は|が|=|＝)?\s*([0-9０-９]{1,6})$/);
    if(m)return {subject:S(m[1])+'のカウンター',answer:S(m[2]).replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFEE0);})};
    m=note.match(/^(.{1,60}?)(?:は|=|＝)\s*(.{1,220})$/);
    if(m)return {subject:S(m[1]),answer:S(m[2])};
    return null;
  }

  function teachFromText(text){
    var t=S(text),note='',kind='';
    var m=t.match(/^(?:これ|それ)?(?:を)?覚えて(?:おいて|て)?[、,:：\s]*(.+)$/);
    if(m){note=S(m[1]);kind='explicit';}
    if(!note){
      m=t.match(/^(?:訂正|正しくは|違う(?:よ|です)?)[、。,:：\s]*(.+)$/);
      if(m){note=S(m[1]);kind='correction';}
    }
    if(!note)return null;
    var f=parseFact(note);
    if(!f)return {handled:true,ok:false,answer:'覚えておく内容を「○○は△△」の形で教えてもらえると確実なのですよ。'};
    var d=load(),key=N(f.subject);
    d.facts=d.facts.filter(function(x){return x.key!==key;});
    d.facts.push({key:key,subject:f.subject,answer:f.answer,kind:kind,learnedAt:Date.now(),used:0});
    d.facts=d.facts.slice(-MAX_FACTS);save(d);
    return {handled:true,ok:true,answer:'覚えたのですよ。「'+f.subject+'」は「'+f.answer+'」ですね。この端末では次からすぐ思い出せるのです。',fact:f};
  }

  function find(text){
    var t=S(text),n=N(t);if(!n)return null;
    var d=load(),best=null,score=0;
    for(var i=d.facts.length-1;i>=0;i--){
      var f=d.facts[i],k=f.key||N(f.subject),s=0;
      if(n===k)s=100;
      else if(n.indexOf(k)>=0)s=85;
      else if(k.indexOf(n)>=0&&n.length>=3)s=68;
      if(s>score){score=s;best=f;}
    }
    if(best&&score>=68){
      best.used=(Number(best.used)||0)+1;save(d);
      return {subject:best.subject,answer:best.answer,score:score,localLearned:true};
    }
    return null;
  }

  function forget(text){
    var t=S(text).replace(/^忘れて[、,:：\s]*/,'').trim();
    if(!t)return {handled:true,answer:'忘れてほしい内容を続けて教えてくださいね。'};
    var d=load(),n=N(t),before=d.facts.length;
    d.facts=d.facts.filter(function(f){return !(f.key===n||f.key.indexOf(n)>=0||n.indexOf(f.key)>=0);});
    save(d);
    return {handled:true,answer:before!==d.facts.length?'その内容は端末内の学習から忘れたのですよ。':'その内容は端末内の学習には見つからなかったのです。'};
  }

  function profile(){
    var d=load();
    var top=Object.keys(d.topics).sort(function(a,b){return (d.topics[b]||0)-(d.topics[a]||0);}).slice(0,5);
    return {turns:d.turns,factCount:d.facts.length,lastTopic:d.lastTopic,topTopics:top.map(function(k){return {name:k,count:d.topics[k]};})};
  }

  function respond(text){
    var t=S(text);
    if(/^忘れて/.test(t))return forget(t);
    var taught=teachFromText(t);if(taught)return taught;
    if(/(?:何を|なにを|どれくらい)覚え(?:てる|ている)|学習(?:状況|した内容)|成長した[？?]?$/.test(t)){
      var p=profile(),topics=p.topTopics.map(function(x){return x.name+' '+x.count+'回';}).join('、');
      return {handled:true,answer:'この端末では会話 '+p.turns+'回分の話題傾向を見ていて、明示的に教えてもらった事実は '+p.factCount+'件覚えているのですよ。'+(topics?'\nよく出る話題は '+topics+' です。':'')};
    }
    return {handled:false};
  }

  window.JINPO_BOT_LEARNING={
    version:VERSION,observe:observe,respond:respond,find:find,profile:profile,
    teachFromText:teachFromText,forget:forget,normalize:N
  };
})();
