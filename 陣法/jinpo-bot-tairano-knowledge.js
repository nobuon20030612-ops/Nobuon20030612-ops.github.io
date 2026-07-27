/*
 * 歩き巫女 たいらの野望 専用知識エンジン v1.0.0
 * 登録済みのサイト固有知識をWeb検索より先に意味寄せして即答する。
 */
(function(){
  'use strict';
  if(window.JINPO_TAIRANO_KNOWLEDGE)return;
  var VERSION='1.0.0';

  function S(v){
    var s=String(v==null?'':v);try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function N(v){
    return S(v).toLowerCase().replace(/[？?！!。、・「」『』【】（）()\[\]［］\s]/g,'');
  }
  function rootUrl(){
    try{return new URL('/',location.href).href;}catch(e){return'/';}
  }
  function pageLink(label,path){
    try{return {label:label,url:new URL(path,rootUrl()).href};}catch(e){return {label:label,url:path};}
  }
  function recentText(history,role,limit){
    var h=Array.isArray(history)?history:[],out=[];
    for(var i=h.length-1;i>=0&&out.length<(limit||6);i--){
      if(!h[i]||h[i].role!==role)continue;
      if(S(h[i].text))out.push(S(h[i].text));
    }
    return out;
  }
  function recentHas(history,re){
    return recentText(history,'assistant',5).concat(recentText(history,'user',5)).some(function(t){return re.test(t);});
  }

  function factScore(text,f,history){
    var t=N(text),score=0,hasAlias=false,hasCue=false,hasContext=false;
    (f.aliases||[]).forEach(function(a){
      var x=N(a);if(!x)return;
      if(t===x)score=Math.max(score,62);
      else if(t.indexOf(x)>=0){score+=54;hasAlias=true;}
      else if(x.indexOf(t)>=0&&t.length>=2){score+=28;hasAlias=true;}
      if(t===x)hasAlias=true;
    });
    (f.cues||[]).forEach(function(c){var x=N(c);if(x&&t.indexOf(x)>=0){score+=32;hasCue=true;}});
    (f.contexts||[]).forEach(function(c){var x=N(c);if(x&&t.indexOf(x)>=0){score+=22;hasContext=true;}});
    if(!hasCue&&recentHas(history,/カウンター|counter/i)){score+=24;hasCue=true;}
    if(!hasContext&&recentHas(history,/二条城|天下統一奇譚/)){score+=10;}
    if(hasAlias&&hasCue)score+=18;
    return score;
  }

  function topicScore(text,x){
    var t=N(text),s=0,name=false,cue=false;
    (x.names||[]).forEach(function(v){var n=N(v);if(n&&t.indexOf(n)>=0){s+=48;name=true;}});
    (x.cues||[]).forEach(function(v){var n=N(v);if(n&&t.indexOf(n)>=0){s+=22;cue=true;}});
    return name?(s+(cue?15:0)):0;
  }

  function answerFact(f){
    return {
      handled:true,
      answer:S(f.answer)||((f.canonical||'対象')+'は '+S(f.value)+' なのですよ。'),
      mode:'たいらの野望専用知識',
      sources:[],
      links:f.page?[pageLink((f.canonical||'該当ページ')+'を確認',f.page)]:[],
      data:{knowledgeId:f.id,kind:f.kind,canonical:f.canonical,value:f.value,authoritative:true}
    };
  }

  function respond(text,opt){
    var d=window.JINPO_TAIRANO_KNOWLEDGE_DATA;if(!d)return {handled:false};
    var t=S(text),history=opt&&opt.history||[];
    if(!t)return {handled:false};

    var best=null,bs=0;
    (d.facts||[]).forEach(function(f){
      var s=factScore(t,f,history);
      if(s>bs){bs=s;best=f;}
    });
    // 人名だけで誤爆しない。名前＋カウンター等、または直前の同一話題が必要。
    if(best&&bs>=82)return answerFact(best);

    var bt=null,ts=0;
    (d.topics||[]).forEach(function(x){
      var s=topicScore(t,x);if(s>ts){ts=s;bt=x;}
    });
    if(bt&&ts>=70){
      return {handled:true,answer:S(bt.answer),mode:'たいらの野望専用知識',sources:[],links:bt.page?[pageLink('該当ページを開く',bt.page)]:[],data:{knowledgeId:bt.id,authoritative:true}};
    }
    return {handled:false};
  }

  function search(text,opt){
    var r=respond(text,opt||{});return r&&r.handled?r:null;
  }

  window.JINPO_TAIRANO_KNOWLEDGE={version:VERSION,respond:respond,search:search};
})();
