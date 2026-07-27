/*
 * 歩き巫女 無料公開Web参照 v1.5.0
 * APIキー不要。匿名CORSが利用できる日本語Wikipedia Action APIを使用する。
 * 一般知識は明示的に「検索して」と言われなくても、質問文・固有名詞らしい入力から自動参照する。
 * 最新ニュース/天気/相場など、リアルタイム性が必要な問い合わせは別検索基盤の対象。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_WEB)return;
  var VERSION='1.5.0';
  var ENDPOINT='https://ja.wikipedia.org/w/api.php';
  var WIKIDATA_ENDPOINT='https://www.wikidata.org/w/api.php';
  var BLOCK=/(?:武器|銃|拳銃|ライフル|ナイフ|刃物|爆弾|爆薬|違法薬物|薬物|ドラッグ|大麻|覚醒剤|コカイン|マリファナ|THC|CBD|酒|ビール|ワイン|タバコ|煙草|電子タバコ|VAPE|ニコチン|賭博|ギャンブル|賭け|自傷|自殺|ポルノ|アダルト)/i;
  var REALTIME=/(?:最新|今日|きょう|現在|今の|いまの|ニュース|速報|天気|気温|株価|価格|相場|試合結果|ライブ|リアルタイム|運行状況|混雑|営業時間|在庫|空席)/i;

  function S(v){var s=String(v==null?'':v);try{s=s.normalize('NFKC');}catch(e){}return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();}
  function unique(list){var out=[];list.forEach(function(x){x=S(x);if(x&&out.indexOf(x)<0)out.push(x);});return out;}

  function stripFiller(text){
    return S(text)
      .replace(/[？?！!。、]+$/g,'')
      .replace(/^(?:ねえ|ねぇ|ちょっと|ところで|歩き巫女|巫女さん)[、\s]*/,'')
      .replace(/^(?:(?:web|WEB|Web|ウェブ|ネット)(?:で)?(?:検索|調査)?|検索|調査)[、\s:]*/,'')
      .replace(/(?:お願い(?:します)?|頼む|よろしく)[。\s]*$/,'')
      .trim();
  }

  function topicFromQuestion(text){
    var q=stripFiller(text),m;
    var patterns=[
      /^(.+?)(?:について)(?:を)?(?:教えて|知りたい|調べて|検索して)?$/,
      /^(.+?)(?:って|とは|は)(?:誰|だれ|何|なに|何者|どんな人|どんなもの|どんな|いつ|どこ|なぜ|どうして|どういう|何をした|何した|何年|どれくらい|どのくらい).*$/,
      /^(.+?)(?:の)(?:意味|由来|歴史|読み方|仕組み|特徴|概要|使い方|違い|原因|理由|人口|面積|高さ|標高|誕生日|生年月日|出身地)(?:は|って|を)?(?:何|なに|どこ|いつ|教えて|知りたい)?$/,
      /^(.+?)(?:を)?(?:教えて|調べて|検索して|知りたい|知ってる)$/,
      /^(.+?)(?:が|は)(?:生まれた|誕生した|亡くなった|死んだ)(?:年|日|場所)?(?:は|って)?(?:いつ|どこ)?$/
    ];
    for(var i=0;i<patterns.length;i++){m=q.match(patterns[i]);if(m&&S(m[1]).length>=2)return S(m[1]);}
    return q;
  }

  function cleanQuery(text){
    var q=topicFromQuestion(text)
      .replace(/^(?:web|WEB|Web|ウェブ|ネット)(?:で)?[、\s]*/,'')
      .replace(/(?:を)?(?:教えて|調べて|検索して|知りたい)$/,'')
      .trim();
    return q.slice(0,80);
  }

  function queryCandidates(text){
    var raw=stripFiller(text),topic=cleanQuery(text);
    var simple=raw
      .replace(/(?:について|って何|ってなに|とは何|とは|を教えて|教えて|を調べて|調べて|検索して|知りたい|知ってる)$/,'')
      .trim();
    return unique([topic,simple,raw]).filter(function(x){return x.length>=2&&x.length<=80;}).slice(0,3);
  }

  function isSafe(q){return !!q&&!BLOCK.test(q);}
  function isRealtime(text){return REALTIME.test(S(text));}

  async function fetchWikipedia(q,signal){
    var p=new URLSearchParams({
      action:'query',generator:'search',gsrsearch:q,gsrlimit:'3',
      prop:'extracts|info',exintro:'1',explaintext:'1',inprop:'url',
      redirects:'1',format:'json',formatversion:'2',origin:'*'
    });
    var r=await fetch(ENDPOINT+'?'+p.toString(),{method:'GET',mode:'cors',credentials:'omit',signal:signal});
    if(!r.ok)return {ok:false,status:r.status};
    var data=await r.json(),pages=data&&data.query&&Array.isArray(data.query.pages)?data.query.pages:[];
    if(!pages.length)return {ok:false,notFound:true,query:q};
    // 概要が空のページを避け、検索順位の高い順に利用。
    for(var i=0;i<pages.length;i++){
      var page=pages[i]||{},extract=S(page.extract).replace(/\s+/g,' ').trim();
      if(!extract)continue;
      if(extract.length>620)extract=extract.slice(0,620).replace(/\s+\S*$/,'')+'…';
      return {ok:true,query:q,title:S(page.title)||q,extract:extract,url:S(page.fullurl)||('https://ja.wikipedia.org/wiki/'+encodeURIComponent(S(page.title)||q)),fetchedAt:Date.now(),source:'Wikipedia'};
    }
    return {ok:false,notFound:true,query:q};
  }

  async function fetchWikidata(q,signal){
    var p=new URLSearchParams({
      action:'wbsearchentities',search:q,language:'ja',uselang:'ja',limit:'1',
      format:'json',origin:'*'
    });
    var r=await fetch(WIKIDATA_ENDPOINT+'?'+p.toString(),{method:'GET',mode:'cors',credentials:'omit',signal:signal});
    if(!r.ok)return {ok:false,status:r.status};
    var data=await r.json(),items=data&&Array.isArray(data.search)?data.search:[];
    if(!items.length)return {ok:false,notFound:true,query:q};
    var item=items[0]||{},label=S(item.label)||q,desc=S(item.description);
    if(!desc)return {ok:false,notFound:true,query:q};
    return {ok:true,query:q,title:label,extract:desc,url:S(item.concepturi)||'',fetchedAt:Date.now(),source:'Wikidata'};
  }

  async function lookup(text){
    var raw=S(text),candidates=queryCandidates(raw),q=candidates[0]||'';
    if(!isSafe(q))return {ok:false,blocked:true};
    if(isRealtime(raw))return {ok:false,realtime:true,query:q};

    var memory=window.JINPO_BOT_MEMORY;
    if(memory&&typeof memory.find==='function'){
      for(var mi=0;mi<candidates.length;mi++){
        var cached=memory.find(candidates[mi]);
        if(cached&&!cached.volatile)return {ok:true,query:candidates[mi],title:cached.title||candidates[mi],extract:cached.answer||cached.extract||'',url:cached.url||'',cached:true,shared:false,fetchedAt:cached.fetchedAt,source:cached.source||'ローカル記憶'};
      }
    }

    var shared=window.JINPO_BOT_SHARED_MEMORY;
    if(shared&&typeof shared.find==='function'){
      for(var si=0;si<candidates.length;si++){
        try{
          var remote=await shared.find(candidates[si]);
          if(remote&&!remote.volatile){
            if(memory&&typeof memory.remember==='function')memory.remember(candidates[si],{query:candidates[si],title:remote.title||candidates[si],extract:remote.answer||remote.extract||'',url:remote.url||'',source:remote.source||'共有記憶',fetchedAt:remote.fetchedAt,volatile:false});
            return {ok:true,query:candidates[si],title:remote.title||candidates[si],extract:remote.answer||remote.extract||'',url:remote.url||'',cached:true,shared:true,fetchedAt:remote.fetchedAt,source:remote.source||'共有記憶'};
          }
        }catch(sharedFindError){}
      }
    }

    if(!window.fetch)return {ok:false,unavailable:true};
    var controller=typeof AbortController!=='undefined'?new AbortController():null;
    var timer=controller?setTimeout(function(){controller.abort();},7500):null;
    try{
      var last={ok:false,notFound:true,query:q};
      for(var i=0;i<candidates.length;i++){
        if(!isSafe(candidates[i]))continue;
        var result=await fetchWikipedia(candidates[i],controller?controller.signal:undefined);
        if(result&&result.ok){
          var memoryResult={query:result.query,title:result.title,extract:result.extract,url:result.url,source:result.source||'Wikipedia',fetchedAt:result.fetchedAt,volatile:false};
          if(memory&&typeof memory.remember==='function')memory.remember(result.query,memoryResult);
          if(shared&&typeof shared.remember==='function'){try{shared.remember(result.query,memoryResult);}catch(sharedWriteError){}}
          return result;
        }
        last=result||last;
      }
      // Wikipediaで概要が取れない場合はWikidataの日本語ラベル・説明へフォールバック。
      for(var wi=0;wi<candidates.length;wi++){
        if(!isSafe(candidates[wi]))continue;
        var entity=await fetchWikidata(candidates[wi],controller?controller.signal:undefined);
        if(entity&&entity.ok){
          var entityMemory={query:entity.query,title:entity.title,extract:entity.extract,url:entity.url,source:'Wikidata',fetchedAt:entity.fetchedAt,volatile:false};
          if(memory&&typeof memory.remember==='function')memory.remember(entity.query,entityMemory);
          if(shared&&typeof shared.remember==='function'){try{shared.remember(entity.query,entityMemory);}catch(sharedEntityWriteError){}}
          return entity;
        }
        last=entity||last;
      }
      return last;
    }catch(e){return {ok:false,error:true,query:q};}
    finally{if(timer)clearTimeout(timer);}
  }

  window.JINPO_BOT_WEB={version:VERSION,lookup:lookup,cleanQuery:cleanQuery,queryCandidates:queryCandidates,isRealtime:isRealtime};
})();
