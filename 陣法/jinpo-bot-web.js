/*
 * 歩き巫女 無料公開Web参照 v1.0.0
 * APIキー不要。匿名CORSが利用できる日本語Wikipedia Action APIのみを使用する。
 * 最新ニュース/天気などリアルタイム性が必要な問い合わせは対象外。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_WEB)return;
  var VERSION='1.2.0';
  var ENDPOINT='https://ja.wikipedia.org/w/api.php';
  var BLOCK=/武器|銃|拳銃|ライフル|ナイフ|刃物|爆弾|爆薬|薬物|ドラッグ|大麻|覚醒剤|コカイン|ギャンブル|賭博|賭け|自傷|自殺|ポルノ|アダルト/i;
  var REALTIME=/最新|今日|現在|今の|ニュース|速報|天気|気温|株価|価格|相場|試合結果|ライブ|リアルタイム/i;
  function S(v){return String(v==null?'':v).trim();}
  function cleanQuery(text){
    var q=S(text)
      .replace(/[？?！!。、]+$/g,'')
      .replace(/^(ねえ|ねぇ|ちょっと|ところで)[、\s]*/,'')
      .replace(/^(web|WEB|Web|ウェブ|ネット)(で|検索で)?[、\s]*/,'')
      .replace(/(について|って何|とは何|とは|を教えて|教えて|を調べて|調べて|検索して|って誰|は誰|ってどこ|はどこ|っていつ|はいつ)$/,'')
      .trim();
    return q.slice(0,80);
  }
  function isSafe(q){return !!q&&!BLOCK.test(q);}
  function isRealtime(text){return REALTIME.test(S(text));}
  async function lookup(text){
    var raw=S(text),q=cleanQuery(raw);
    if(!isSafe(q))return {ok:false,blocked:true};
    if(isRealtime(raw))return {ok:false,realtime:true,query:q};
    var memory=window.JINPO_BOT_MEMORY;
    if(memory&&typeof memory.find==='function'){
      var cached=memory.find(q);
      if(cached&&!cached.volatile)return {ok:true,query:q,title:cached.title||q,extract:cached.answer,url:cached.url||'',cached:true,shared:false,fetchedAt:cached.fetchedAt,source:cached.source||'ローカル記憶'};
    }
    var shared=window.JINPO_BOT_SHARED_MEMORY;
    if(shared&&typeof shared.find==='function'){
      try{
        var remote=await shared.find(q);
        if(remote&&!remote.volatile){
          if(memory&&typeof memory.remember==='function')memory.remember(q,{query:q,title:remote.title||q,extract:remote.answer,url:remote.url||'',source:remote.source||'共有記憶',fetchedAt:remote.fetchedAt,volatile:false});
          return {ok:true,query:q,title:remote.title||q,extract:remote.answer,url:remote.url||'',cached:true,shared:true,fetchedAt:remote.fetchedAt,source:remote.source||'共有記憶'};
        }
      }catch(sharedFindError){}
    }
    if(!window.fetch)return {ok:false,unavailable:true};
    var p=new URLSearchParams({
      action:'query',generator:'search',gsrsearch:q,gsrlimit:'1',
      prop:'extracts|info',exintro:'1',explaintext:'1',inprop:'url',
      redirects:'1',format:'json',formatversion:'2',origin:'*'
    });
    var controller=typeof AbortController!=='undefined'?new AbortController():null;
    var timer=controller?setTimeout(function(){controller.abort();},6500):null;
    try{
      var r=await fetch(ENDPOINT+'?'+p.toString(),{method:'GET',mode:'cors',credentials:'omit',signal:controller?controller.signal:undefined});
      if(!r.ok)return {ok:false,status:r.status};
      var data=await r.json(),pages=data&&data.query&&Array.isArray(data.query.pages)?data.query.pages:[];
      if(!pages.length)return {ok:false,notFound:true,query:q};
      var page=pages[0]||{},extract=S(page.extract).replace(/\s+/g,' ').trim();
      if(!extract)return {ok:false,notFound:true,query:q};
      if(extract.length>520)extract=extract.slice(0,520).replace(/\s+\S*$/,'')+'…';
      var out={ok:true,query:q,title:S(page.title)||q,extract:extract,url:S(page.fullurl)||('https://ja.wikipedia.org/wiki/'+encodeURIComponent(S(page.title)||q)),fetchedAt:Date.now()};
      var memoryResult={query:q,title:out.title,extract:extract,url:out.url,source:'Wikipedia',fetchedAt:out.fetchedAt,volatile:false};
      if(memory&&typeof memory.remember==='function')memory.remember(q,memoryResult);
      if(shared&&typeof shared.remember==='function'){try{shared.remember(q,memoryResult);}catch(sharedWriteError){}}
      return out;
    }catch(e){return {ok:false,error:true,query:q};}
    finally{if(timer)clearTimeout(timer);}
  }
  window.JINPO_BOT_WEB={version:VERSION,lookup:lookup,cleanQuery:cleanQuery,isRealtime:isRealtime};
})();
