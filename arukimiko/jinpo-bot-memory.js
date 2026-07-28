/*
 * 歩き巫女 調査記憶 v1.0.0
 * 無料公開Webで一度調べた一般知識をブラウザ内(localStorage)へ保存し再利用する。
 * 「最新/今日/最近」など鮮度が必要な問い合わせは古い記憶だけで確定回答しない。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_MEMORY)return;
  var VERSION='1.1.0';
  var STORAGE_KEY='jinpoBotResearchMemory.v1';
  var MAX_ENTRIES=200;
  var mem=[];
  var VOLATILE=/最新|今日|現在|今の|最近|直近|ニュース|速報|天気|気温|株価|価格|相場|試合結果|順位|スタメン|先発|登録抹消|ライブ|リアルタイム|今季|今シーズン/i;

  function S(v){return String(v==null?'':v).trim();}
  function now(){return Date.now();}
  function safeParse(raw){try{var v=JSON.parse(raw);return Array.isArray(v)?v:[];}catch(e){return[];}}
  function load(){
    try{mem=safeParse(localStorage.getItem(STORAGE_KEY));}catch(e){mem=mem||[];}
    mem=mem.filter(function(x){return x&&typeof x.key==='string'&&x.key&&typeof x.answer==='string';}).slice(-MAX_ENTRIES);
    return mem;
  }
  function save(){
    mem=mem.slice(-MAX_ENTRIES);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(mem));}catch(e){}
  }
  function normalize(q){
    q=S(q);
    try{q=q.normalize('NFKC');}catch(e){}
    return q.toLowerCase().replace(/[\s　]+/g,' ').replace(/[？?！!。、・「」『』【】()（）［］\[\]]/g,'').trim().slice(0,120);
  }
  function isVolatile(text){return VOLATILE.test(S(text));}
  function find(q){
    load();var k=normalize(q);if(!k)return null;
    var exact=null;
    for(var i=mem.length-1;i>=0;i--){if(mem[i].key===k){exact=mem[i];break;}}
    if(!exact){
      for(var j=mem.length-1;j>=0;j--){
        var e=mem[j];
        if(e.key.indexOf(k)>=0||k.indexOf(e.key)>=0){exact=e;break;}
      }
    }
    if(exact){exact.lastUsedAt=now();save();return Object.assign({},exact);}
    return null;
  }
  function remember(query,result){
    query=S(query);result=result||{};
    var key=normalize(query||result.query||result.title);if(!key)return null;
    var answer=S(result.answer||result.extract);if(!answer)return null;
    load();
    mem=mem.filter(function(x){return x.key!==key;});
    var entry={
      key:key,query:query||S(result.query),title:S(result.title)||query,
      answer:answer,url:S(result.url),source:S(result.source)||'公開Web',
      fetchedAt:Number(result.fetchedAt)||now(),lastUsedAt:now(),volatile:!!result.volatile
    };
    mem.push(entry);save();return Object.assign({},entry);
  }
  function recent(limit){load();limit=Math.max(1,Math.min(20,Number(limit)||5));return mem.slice().sort(function(a,b){return (b.lastUsedAt||b.fetchedAt||0)-(a.lastUsedAt||a.fetchedAt||0);}).slice(0,limit).map(function(x){return Object.assign({},x);});}
  function remove(q){var k=normalize(q);load();var before=mem.length;mem=mem.filter(function(x){return x.key!==k;});save();return before!==mem.length;}
  function clear(){mem=[];try{localStorage.removeItem(STORAGE_KEY);}catch(e){}return true;}
  function stats(){load();return {count:mem.length,max:MAX_ENTRIES};}
  function recallText(text){
    var t=S(text);
    var wants=/前に調べた|前に検索した|この前調べた|さっき調べた|調べた内容|覚えてる|覚えている/.test(t);
    if(!wants)return null;
    var q=t
      .replace(/^.*?(?:前に調べた|前に検索した|この前調べた|さっき調べた)/,'')
      .replace(/(?:のこと)?(?:を|は)?覚えて(?:る|いる).*$/,'')
      .replace(/について(?:教えて)?[？?。\s]*$/,'')
      .replace(/[？?！!。、\s]+$/g,'')
      .trim();
    if(/^(?:内容|こと)?$/.test(q))q='';
    if(q){var hit=find(q);if(hit)return {type:'hit',entry:hit};}
    var list=recent(5);return {type:'recent',entries:list,query:q};
  }
  load();
  window.JINPO_BOT_MEMORY={version:VERSION,normalize:normalize,isVolatile:isVolatile,find:find,remember:remember,recent:recent,remove:remove,clear:clear,stats:stats,recallText:recallText};
})();
