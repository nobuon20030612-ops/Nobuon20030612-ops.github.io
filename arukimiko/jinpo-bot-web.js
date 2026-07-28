/*
 * 歩き巫女 無料公開Web参照 v1.7.0
 * APIキー不要の公開APIだけを使用し、一般知識と鮮度が必要な情報を自動で振り分ける。
 * - 一般知識: 日本語Wikipedia -> Wikidata
 * - 最新ニュース: GDELT DOC 2.0（直近記事、CORS対応）
 * - 天気: Open-Meteo（地名検索 + 現在/予報）
 * - 為替: Frankfurter（最新の参照レート）
 *
 * 最新系は古い記憶で確定回答しない。陣法操作はこの層へ送らない。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_WEB)return;
  var VERSION='2.1.0';
  var WIKIPEDIA_ENDPOINT='https://ja.wikipedia.org/w/api.php';
  var WIKIDATA_ENDPOINT='https://www.wikidata.org/w/api.php';
  var GDELT_ENDPOINT='https://api.gdeltproject.org/api/v2/doc/doc';
  var GEO_ENDPOINT='https://geocoding-api.open-meteo.com/v1/search';
  var WEATHER_ENDPOINT='https://api.open-meteo.com/v1/forecast';
  var FX_ENDPOINT='https://api.frankfurter.dev/v2/rate/';
  var LOCATION_FALLBACK={
    '東京':{name:'東京',admin1:'東京都',country:'日本',country_code:'JP',latitude:35.6762,longitude:139.6503},
    '東京都':{name:'東京',admin1:'東京都',country:'日本',country_code:'JP',latitude:35.6762,longitude:139.6503},
    '広島':{name:'広島',admin1:'広島県',country:'日本',country_code:'JP',latitude:34.3853,longitude:132.4553},
    '広島市':{name:'広島',admin1:'広島県',country:'日本',country_code:'JP',latitude:34.3853,longitude:132.4553},
    '大阪':{name:'大阪',admin1:'大阪府',country:'日本',country_code:'JP',latitude:34.6937,longitude:135.5023},
    '大阪市':{name:'大阪',admin1:'大阪府',country:'日本',country_code:'JP',latitude:34.6937,longitude:135.5023},
    '京都':{name:'京都',admin1:'京都府',country:'日本',country_code:'JP',latitude:35.0116,longitude:135.7681},
    '名古屋':{name:'名古屋',admin1:'愛知県',country:'日本',country_code:'JP',latitude:35.1815,longitude:136.9066},
    '横浜':{name:'横浜',admin1:'神奈川県',country:'日本',country_code:'JP',latitude:35.4437,longitude:139.6380},
    '札幌':{name:'札幌',admin1:'北海道',country:'日本',country_code:'JP',latitude:43.0618,longitude:141.3545},
    '仙台':{name:'仙台',admin1:'宮城県',country:'日本',country_code:'JP',latitude:38.2682,longitude:140.8694},
    '福岡':{name:'福岡',admin1:'福岡県',country:'日本',country_code:'JP',latitude:33.5904,longitude:130.4017},
    '神戸':{name:'神戸',admin1:'兵庫県',country:'日本',country_code:'JP',latitude:34.6901,longitude:135.1955},
    '沖縄':{name:'那覇',admin1:'沖縄県',country:'日本',country_code:'JP',latitude:26.2124,longitude:127.6809},
    '那覇':{name:'那覇',admin1:'沖縄県',country:'日本',country_code:'JP',latitude:26.2124,longitude:127.6809}
  };

  var BLOCK=/(?:銃|拳銃|ライフル|ショットガン|弾薬|サイレンサー|ナイフ|刃物|爆弾|爆薬|火薬|違法薬物|ドラッグ|大麻|覚醒剤|コカイン|マリファナ|THC|CBD|酒|ビール|ワイン|タバコ|煙草|電子タバコ|VAPE|ニコチン|賭博|ギャンブル|賭け|オンラインカジノ|スポーツベット|自傷|自殺|ポルノ|アダルト)/i;
  var REALTIME=/(?:最新|今日|きょう|明日|あした|現在|今の|いまの|最近|直近|ニュース|速報|新機能|アップデート|更新情報|リリース|発表|公開予定|発売予定|日程|スケジュール|結果|スコア|成績|ランキング|天気|気温|予報|降水|湿度|為替|レート|何円|ドル円|円ドル|ユーロ円|円ユーロ|株価|相場|試合結果|順位|スタメン|先発|登録抹消|ライブ|リアルタイム|運行状況|混雑|営業時間|在庫|空席)/i;
  var WEATHER=/(?:天気|てんき|気温|きおん|予報|よほう|降水|こうすい|雨|あめ|雪|ゆき|晴れ|はれ|曇り|くもり|湿度|しつど|風速|ふうそく|最高気温|最低気温)/i;
  var FX=/(?:為替|為替レート|レート|何円|ドル円|円ドル|ユーロ円|円ユーロ|米ドル|日本円|ユーロ|英ポンド|豪ドル|カナダドル|スイスフラン|人民元|USD|JPY|EUR|GBP|AUD|CAD|CHF|CNY)/i;
  var NEWS=/(?:ニュース|速報|最新情報|最新ニュース|最近の(?:情報|話題)|直近の(?:情報|話題)|今日の(?:出来事|ニュース)|今の(?:情報|状況)|現在の(?:情報|状況)|新機能|アップデート|更新情報|リリース|発表|公開予定|発売予定)/i;
  var UNSUPPORTED_LIVE=/(?:株価|株式価格|仮想通貨|暗号資産|ビットコイン|運行状況|混雑|営業時間|在庫|空席|試合結果|順位|スタメン|先発|登録抹消|ライブ配信)/i;

  function S(v){var s=String(v==null?'':v);try{s=s.normalize('NFKC');}catch(e){}return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();}
  function unique(list){var out=[];list.forEach(function(x){x=S(x);if(x&&out.indexOf(x)<0)out.push(x);});return out;}
  function round(v,d){var n=Number(v);if(!isFinite(n))return'';var p=Math.pow(10,d==null?1:d);return String(Math.round(n*p)/p);}
  function timeoutController(ms){var c=typeof AbortController!=='undefined'?new AbortController():null;var timer=c?setTimeout(function(){c.abort();},ms||8500):null;return {controller:c,signal:c?c.signal:undefined,clear:function(){if(timer)clearTimeout(timer);}};}

  function stripFiller(text){
    return S(text)
      .replace(/[？?！!。、]+$/g,'')
      .replace(/^(?:ねえ|ねぇ|ちょっと|ところで|歩き巫女|巫女さん)[、\s]*/,'')
      .replace(/^(?:(?:そう|そっち|それ)(?:じゃ|では)?(?:ない|なくて|なく|違う)|(?:いや|いえ|違う|ちがう|訂正|ごめん|ごめんね))[、。,:：\s]*/,'')
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
  function isRealtime(text){var t=S(text);return REALTIME.test(t)||/\b[A-Z]{3}\s*[\/→>\-]\s*[A-Z]{3}\b/i.test(t);}
  function liveKind(text){var t=S(text);if(WEATHER.test(t))return'weather';if(FX.test(t))return'fx';if(NEWS.test(t)||/(?:最新|最近|直近|今日|現在|今).+(?:教えて|調べて|検索|情報|どう|何|変わ|あった)|(?:アップデート|リリース|新機能|発表).*(?:教えて|何|どう|内容|変更)/.test(t))return'news';if(UNSUPPORTED_LIVE.test(t))return'unsupported';return isRealtime(t)?'news':'';}

  async function fetchWikipedia(q,signal){
    var p=new URLSearchParams({
      action:'query',generator:'search',gsrsearch:q,gsrlimit:'3',
      prop:'extracts|info',exintro:'1',explaintext:'1',inprop:'url',
      redirects:'1',format:'json',formatversion:'2',origin:'*'
    });
    var r=await fetch(WIKIPEDIA_ENDPOINT+'?'+p.toString(),{method:'GET',mode:'cors',credentials:'omit',signal:signal});
    if(!r.ok)return {ok:false,status:r.status};
    var data=await r.json(),pages=data&&data.query&&Array.isArray(data.query.pages)?data.query.pages:[];
    if(!pages.length)return {ok:false,notFound:true,query:q};
    for(var i=0;i<pages.length;i++){
      var page=pages[i]||{},extract=S(page.extract).replace(/\s+/g,' ').trim();
      if(!extract)continue;
      if(extract.length>620)extract=extract.slice(0,620).replace(/\s+\S*$/,'')+'…';
      return {ok:true,query:q,title:S(page.title)||q,extract:extract,url:S(page.fullurl)||('https://ja.wikipedia.org/wiki/'+encodeURIComponent(S(page.title)||q)),fetchedAt:Date.now(),source:'Wikipedia',kind:'general',volatile:false};
    }
    return {ok:false,notFound:true,query:q};
  }

  async function fetchWikidata(q,signal){
    var p=new URLSearchParams({action:'wbsearchentities',search:q,language:'ja',uselang:'ja',limit:'1',format:'json',origin:'*'});
    var r=await fetch(WIKIDATA_ENDPOINT+'?'+p.toString(),{method:'GET',mode:'cors',credentials:'omit',signal:signal});
    if(!r.ok)return {ok:false,status:r.status};
    var data=await r.json(),items=data&&Array.isArray(data.search)?data.search:[];
    if(!items.length)return {ok:false,notFound:true,query:q};
    var item=items[0]||{},label=S(item.label)||q,desc=S(item.description);
    if(!desc)return {ok:false,notFound:true,query:q};
    return {ok:true,query:q,title:label,extract:desc,url:S(item.concepturi)||'',fetchedAt:Date.now(),source:'Wikidata',kind:'general',volatile:false};
  }

  async function englishEntityLabel(q,signal){
    q=S(q);if(!q)return'';
    if(/^[\x20-\x7E]+$/.test(q))return q;
    var aliases={
      'カープ':'Hiroshima Toyo Carp','広島カープ':'Hiroshima Toyo Carp','広島東洋カープ':'Hiroshima Toyo Carp',
      '信オン':"Nobunaga's Ambition Online",'信長の野望online':"Nobunaga's Ambition Online",'信長の野望オンライン':"Nobunaga's Ambition Online",
      '大谷翔平':'Shohei Ohtani','大谷':'Shohei Ohtani','ドジャース':'Los Angeles Dodgers',
      '阪神':'Hanshin Tigers','阪神タイガース':'Hanshin Tigers','巨人':'Yomiuri Giants','読売ジャイアンツ':'Yomiuri Giants',
      '任天堂':'Nintendo','ソニー':'Sony','トヨタ':'Toyota','日経平均':'Nikkei 225','日本':'Japan','東京':'Tokyo'
    };
    var key=q.toLowerCase().replace(/[\s　]/g,'');
    if(aliases[key])return aliases[key];
    try{
      var p=new URLSearchParams({action:'wbsearchentities',search:q,language:'ja',uselang:'ja',limit:'1',format:'json',origin:'*'});
      var r=await fetch(WIKIDATA_ENDPOINT+'?'+p.toString(),{method:'GET',mode:'cors',credentials:'omit',signal:signal});
      if(!r.ok)return q;
      var data=await r.json(),items=data&&Array.isArray(data.search)?data.search:[];
      if(!items.length||!items[0].id)return q;
      var p2=new URLSearchParams({action:'wbgetentities',ids:items[0].id,props:'labels',languages:'en|ja',format:'json',origin:'*'});
      var r2=await fetch(WIKIDATA_ENDPOINT+'?'+p2.toString(),{method:'GET',mode:'cors',credentials:'omit',signal:signal});
      if(!r2.ok)return q;
      var d2=await r2.json(),entity=d2&&d2.entities&&d2.entities[items[0].id],en=entity&&entity.labels&&entity.labels.en&&entity.labels.en.value;
      return S(en)||q;
    }catch(e){return q;}
  }

  function extractNewsTopic(text){
    var q=stripFiller(text)
      .replace(/(?:について)?(?:の)?(?:最新ニュース|ニュース|速報|最新情報|最新の情報|最近の情報|直近の情報|今日の情報|現在の情報|今の情報|新機能|アップデート|更新情報|リリース|発表|公開予定|発売予定)/g,' ')
      .replace(/^(?:今日|きょう|現在|今|いま|最近|直近|最新)(?:の)?/,'')
      .replace(/(?:について|のこと)?(?:を)?(?:教えて|知りたい|調べて|検索して|見せて|ある[？?]?)$/,'')
      .replace(/[？?！!。、]+$/g,'')
      .replace(/\s+/g,' ').trim();
    q=q.replace(/(?:の)?最新$/,'').trim();
    if(/^(?:日本|国内)?$/.test(q))return q==='日本'?'日本':'';
    return q.slice(0,80);
  }

  function gdeltDate(v){
    var s=S(v),m=s.match(/(\d{4})(\d{2})(\d{2})[T ]?(\d{2})?(\d{2})?/);
    if(!m)return s;
    return Number(m[2])+'/'+Number(m[3])+(m[4]?' '+m[4]+':'+(m[5]||'00'):'');
  }

  async function fetchGdeltArticles(query,signal){
    var p=new URLSearchParams({query:query,mode:'artlist',maxrecords:'5',format:'json',sort:'datedesc',timespan:'3d'});
    var r=await fetch(GDELT_ENDPOINT+'?'+p.toString(),{method:'GET',mode:'cors',credentials:'omit',signal:signal});
    if(!r.ok)return {ok:false,status:r.status};
    var data=await r.json(),items=data&&Array.isArray(data.articles)?data.articles:[];
    return {ok:items.length>0,items:items,notFound:items.length===0};
  }

  async function fetchNews(text,signal){
    var topic=extractNewsTopic(text),english=topic?await englishEntityLabel(topic,signal):'';
    var base=english||topic;
    var qJa=base?(base+' sourcelang:japanese'):'sourcecountry:japan sourcelang:japanese';
    var first=await fetchGdeltArticles(qJa,signal),items=first.items||[];
    if(!items.length&&base){
      var global=await fetchGdeltArticles(base,signal);items=global.items||[];
    }
    if(!items.length)return {ok:false,notFound:true,realtime:true,kind:'news',query:topic||'最新ニュース'};
    var seen={},clean=[];
    for(var i=0;i<items.length&&clean.length<5;i++){
      var a=items[i]||{},url=S(a.url),title=S(a.title),domain=S(a.domain);
      if(!url||!title||seen[url])continue;seen[url]=1;
      clean.push({title:title,url:url,domain:domain,date:gdeltDate(a.seendate||a.seendateformatted||a.date)});
    }
    if(!clean.length)return {ok:false,notFound:true,realtime:true,kind:'news',query:topic||'最新ニュース'};
    var lines=clean.map(function(a,idx){return (idx+1)+'. '+(a.date?a.date+' ':'')+a.title+(a.domain?'（'+a.domain+'）':'');});
    return {
      ok:true,realtime:true,volatile:true,kind:'news',query:topic||'最新ニュース',title:(topic?topic+'の最新ニュース':'最新ニュース'),
      extract:'直近の記事を新しい順に見つけたのですよ。\n'+lines.join('\n'),
      url:clean[0].url,source:'GDELT / 各ニュースサイト',sources:clean.map(function(a){return {title:(a.date?a.date+' ':'')+a.title,url:a.url};}),fetchedAt:Date.now()
    };
  }

  function extractWeatherLocation(text){
    var q=stripFiller(text)
      .replace(/^(?:今日|きょう|明日|あした|明後日|あさって|現在|今|いま)(?:の)?/,'')
      .replace(/(?:の)?(?:今日|きょう|明日|あした|明後日|あさって)(?:の)?(?=(?:天気|てんき|気温|きおん|予報|よほう|降水|こうすい|雨|あめ|雪|ゆき|湿度|しつど|風速|ふうそく|最高気温|最低気温))/g,'')
      .replace(/(?:の|で)?(?:天気予報|天気|てんき|気温|きおん|予報|よほう|降水確率|こうすいかくりつ|降水|こうすい|雨|あめ|雪|ゆき|湿度|しつど|風速|ふうそく|最高気温|最低気温).*/,'')
      .replace(/(?:は|を)?(?:教えて|おしえて|知りたい|しりたい|調べて|しらべて|検索して)$/,'')
      .replace(/[？?！!。、\s]+$/g,'').trim();
    if(/^(?:ここ|現在地|この辺|このへん|近く)$/.test(q))return'';
    return q.slice(0,60);
  }
  function requestedWeatherTime(text){
    var t=S(text);
    if(/明後日|あさって/.test(t))return'day_after_tomorrow';
    if(/明日|あした/.test(t))return'tomorrow';
    if(/今日|きょう/.test(t))return'today';
    return'current';
  }

  function weatherLabel(code){
    code=Number(code);
    if(code===0)return'快晴';if(code===1)return'晴れ';if(code===2)return'晴れ時々くもり';if(code===3)return'くもり';
    if(code===45||code===48)return'霧';if(code>=51&&code<=57)return'霧雨';if(code>=61&&code<=67)return'雨';
    if(code>=71&&code<=77)return'雪';if(code>=80&&code<=82)return'にわか雨';if(code===85||code===86)return'にわか雪';
    if(code>=95)return'雷雨';return'天候コード '+code;
  }

  async function geocode(place,signal){
    place=S(place);
    var direct=LOCATION_FALLBACK[place]||LOCATION_FALLBACK[place.replace(/(?:都|道|府|県|市)$/,'')];
    var p=new URLSearchParams({name:place,count:'5',language:'ja',format:'json'});
    try{
      var r=await fetch(GEO_ENDPOINT+'?'+p.toString(),{method:'GET',mode:'cors',credentials:'omit',signal:signal});
      if(r.ok){
        var data=await r.json(),items=data&&Array.isArray(data.results)?data.results:[];
        if(items.length){
          for(var i=0;i<items.length;i++)if(String(items[i].country_code||'').toUpperCase()==='JP')return items[i];
          return items[0];
        }
      }
    }catch(e){}
    return direct||null;
  }

  async function fetchWeather(text,signal){
    var place=extractWeatherLocation(text),requestTime=requestedWeatherTime(text);
    if(!place)return {ok:false,realtime:true,kind:'weather',needsLocation:true,requestTime:requestTime};
    var loc=await geocode(place,signal);
    if(!loc)return {ok:false,realtime:true,kind:'weather',notFound:true,query:place,requestTime:requestTime};
    var p=new URLSearchParams({
      latitude:String(loc.latitude),longitude:String(loc.longitude),timezone:'auto',forecast_days:'4',
      current:'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
      daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum'
    });
    var r=await fetch(WEATHER_ENDPOINT+'?'+p.toString(),{method:'GET',mode:'cors',credentials:'omit',signal:signal});
    if(!r.ok)return {ok:false,realtime:true,kind:'weather',status:r.status,query:place,requestTime:requestTime};
    var d=await r.json(),c=d.current||{},daily=d.daily||{},name=S(loc.name)||place,admin=S(loc.admin1),country=S(loc.country);
    var where=name+(admin&&admin!==name?'（'+admin+'）':'');
    var lines=[];
    function jpDate(iso){
      var m=S(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m?(Number(m[2])+'月'+Number(m[3])+'日'):'';
    }
    function dailyLine(i,label){
      if(!Array.isArray(daily.time)||!daily.time[i])return'';
      var wx=Array.isArray(daily.weather_code)?daily.weather_code[i]:null;
      var max=Array.isArray(daily.temperature_2m_max)?daily.temperature_2m_max[i]:null;
      var min=Array.isArray(daily.temperature_2m_min)?daily.temperature_2m_min[i]:null;
      var pop=Array.isArray(daily.precipitation_probability_max)?daily.precipitation_probability_max[i]:null;
      var sum=Array.isArray(daily.precipitation_sum)?daily.precipitation_sum[i]:null;
      var date=jpDate(daily.time[i]);
      return label+(date?'（'+date+'）':'')+'は'+weatherLabel(wx)+(max!=null&&min!=null?'、最高'+round(max,1)+'℃・最低'+round(min,1)+'℃':'')+(pop!=null?'、降水確率'+round(pop,0)+'%':'')+(sum!=null&&Number(sum)>0?'（予想降水量'+round(sum,1)+'mm）':'');
    }

    if(requestTime==='day_after_tomorrow'){
      var dat=dailyLine(2,'明後日');if(dat)lines.push(dat);
    }else if(requestTime==='tomorrow'){
      var tom=dailyLine(1,'明日');if(tom)lines.push(tom);
    }else{
      if(c.temperature_2m!=null){
        var currentTime=S(c.time);
        lines.push('今'+(currentTime?'（'+currentTime.replace('T',' ')+'）':'')+'は'+weatherLabel(c.weather_code)+'で'+round(c.temperature_2m,1)+'℃'+(c.apparent_temperature!=null?'、体感'+round(c.apparent_temperature,1)+'℃':''));
      }
      if(c.relative_humidity_2m!=null)lines.push('湿度'+round(c.relative_humidity_2m,0)+'%'+(c.wind_speed_10m!=null?'、風'+round(c.wind_speed_10m,1)+'km/h':''));
      var today=dailyLine(0,'今日');if(today)lines.push(today);
    }
    if(!lines.length)return {ok:false,realtime:true,kind:'weather',error:true,query:place,requestTime:requestTime};
    var titleLabel=requestTime==='day_after_tomorrow'?'明後日の':requestTime==='tomorrow'?'明日の':'';
    return {
      ok:true,realtime:true,volatile:true,freshness:'live',kind:'weather',query:place,title:where+'の'+titleLabel+'天気',
      extract:lines.join('\n'),url:'https://open-meteo.com/',source:'Open-Meteo',
      sources:[{title:'Open-Meteo 天気データ',url:'https://open-meteo.com/'}],fetchedAt:Date.now(),requestTime:requestTime,
      sourceTime:S(c.time),
      location:{name:name,admin1:admin,country:country,latitude:loc.latitude,longitude:loc.longitude}
    };
  }

  var CURRENCIES=[
    {code:'JPY',names:['日本円','円','JPY']},{code:'USD',names:['米ドル','ドル','USD']},{code:'EUR',names:['ユーロ','EUR']},{code:'GBP',names:['英ポンド','ポンド','GBP']},
    {code:'AUD',names:['豪ドル','オーストラリアドル','AUD']},{code:'CAD',names:['カナダドル','CAD']},{code:'CHF',names:['スイスフラン','CHF']},{code:'CNY',names:['人民元','中国元','CNY']}
  ];
  function currencyMentions(text){
    var t=S(text),found=[];
    CURRENCIES.forEach(function(c){
      var pos=9999,label='';c.names.forEach(function(n){var p=t.toUpperCase().indexOf(n.toUpperCase());if(p>=0&&p<pos){pos=p;label=n;}});
      if(pos<9999)found.push({code:c.code,pos:pos,label:label});
    });
    found.sort(function(a,b){return a.pos-b.pos;});return found;
  }
  function parseFx(text){
    var t=S(text),m=t.toUpperCase().match(/\b([A-Z]{3})\s*[\/→>\-]\s*([A-Z]{3})\b/),base='',quote='';
    if(m){base=m[1];quote=m[2];}else{
      var f=currencyMentions(t);if(f.length>=2){base=f[0].code;quote=f[1].code;}else if(f.length===1){base=f[0].code;quote=base==='JPY'?'USD':'JPY';}
      else if(/ドル円/.test(t)){base='USD';quote='JPY';}else if(/円ドル/.test(t)){base='JPY';quote='USD';}
    }
    var amount=1,am=t.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:米ドル|ドル|日本円|円|ユーロ|英ポンド|ポンド|豪ドル|カナダドル|スイスフラン|人民元|中国元|USD|JPY|EUR|GBP|AUD|CAD|CHF|CNY)/i);
    if(am&&Number(am[1])>0)amount=Number(am[1]);
    return base&&quote&&base!==quote?{base:base,quote:quote,amount:amount}:null;
  }
  function formatMoney(n,code){
    try{return new Intl.NumberFormat('ja-JP',{style:'currency',currency:code,maximumFractionDigits:code==='JPY'?2:4}).format(n);}catch(e){return round(n,4)+' '+code;}
  }
  async function fetchFx(text,signal){
    var p=parseFx(text);
    if(!p)return {ok:false,realtime:true,kind:'fx',needsPair:true};
    var r=await fetch(FX_ENDPOINT+encodeURIComponent(p.base)+'/'+encodeURIComponent(p.quote),{method:'GET',mode:'cors',credentials:'omit',signal:signal});
    if(!r.ok)return {ok:false,realtime:true,kind:'fx',status:r.status};
    var d=await r.json(),rate=Number(d.rate);if(!isFinite(rate))return {ok:false,realtime:true,kind:'fx',notFound:true};
    var converted=p.amount*rate,when=S(d.date);
    return {ok:true,realtime:true,volatile:true,kind:'fx',query:p.base+'/'+p.quote,title:p.base+'/'+p.quote+' 最新参照レート',extract:(when?when+'時点。\n':'')+formatMoney(p.amount,p.base)+' ≒ '+formatMoney(converted,p.quote)+'\n1 '+p.base+' = '+round(rate,6)+' '+p.quote+' なのですよ。※中央銀行等の参照データを使う日次レートで、取引所の秒単位価格ではありません。',url:'https://frankfurter.dev/',source:'Frankfurter',sources:[{title:'Frankfurter exchange rates',url:'https://frankfurter.dev/'}],fetchedAt:Date.now()};
  }

  async function lookupRealtime(text){
    var t=S(text),kind=liveKind(t);if(!kind)return {ok:false,realtime:false};
    if(!isSafe(t))return {ok:false,blocked:true};
    if(kind==='unsupported')return {ok:false,realtime:true,unsupported:true,kind:'unsupported'};
    if(!window.fetch)return {ok:false,realtime:true,unavailable:true,kind:kind};
    var tc=timeoutController(9000);
    try{
      if(kind==='weather')return await fetchWeather(t,tc.signal);
      if(kind==='fx')return await fetchFx(t,tc.signal);
      return await fetchNews(t,tc.signal);
    }catch(e){return {ok:false,realtime:true,error:true,kind:kind};}
    finally{tc.clear();}
  }

  async function lookup(text){
    var raw=S(text),candidates=queryCandidates(raw),q=candidates[0]||'';
    if(!isSafe(q||raw))return {ok:false,blocked:true};

    if(isRealtime(raw)){
      var live=await lookupRealtime(raw);
      if(live&&live.realtime)return live;
    }

    var memory=window.JINPO_BOT_MEMORY;
    if(memory&&typeof memory.find==='function'){
      for(var mi=0;mi<candidates.length;mi++){
        var cached=memory.find(candidates[mi]);
        if(cached&&!cached.volatile)return {ok:true,query:candidates[mi],title:cached.title||candidates[mi],extract:cached.answer||cached.extract||'',url:cached.url||'',cached:true,shared:false,fetchedAt:cached.fetchedAt,source:cached.source||'ローカル記憶',kind:'general',volatile:false};
      }
    }

    var shared=window.JINPO_BOT_SHARED_MEMORY;
    if(shared&&typeof shared.find==='function'){
      for(var si=0;si<candidates.length;si++){
        try{
          var remote=await shared.find(candidates[si]);
          if(remote&&!remote.volatile){
            if(memory&&typeof memory.remember==='function')memory.remember(candidates[si],{query:candidates[si],title:remote.title||candidates[si],extract:remote.answer||remote.extract||'',url:remote.url||'',source:remote.source||'共有記憶',fetchedAt:remote.fetchedAt,volatile:false});
            return {ok:true,query:candidates[si],title:remote.title||candidates[si],extract:remote.answer||remote.extract||'',url:remote.url||'',cached:true,shared:true,fetchedAt:remote.fetchedAt,source:remote.source||'共有記憶',kind:'general',volatile:false};
          }
        }catch(sharedFindError){}
      }
    }

    if(!window.fetch)return {ok:false,unavailable:true};
    var tc=timeoutController(7500);
    try{
      var last={ok:false,notFound:true,query:q};
      for(var i=0;i<candidates.length;i++){
        if(!isSafe(candidates[i]))continue;
        var result=await fetchWikipedia(candidates[i],tc.signal);
        if(result&&result.ok){
          var memoryResult={query:result.query,title:result.title,extract:result.extract,url:result.url,source:result.source||'Wikipedia',fetchedAt:result.fetchedAt,volatile:false};
          if(memory&&typeof memory.remember==='function')memory.remember(result.query,memoryResult);
          if(shared&&typeof shared.remember==='function'){try{shared.remember(result.query,memoryResult);}catch(sharedWriteError){}}
          return result;
        }
        last=result||last;
      }
      for(var wi=0;wi<candidates.length;wi++){
        if(!isSafe(candidates[wi]))continue;
        var entity=await fetchWikidata(candidates[wi],tc.signal);
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
    finally{tc.clear();}
  }

  window.JINPO_BOT_WEB={
    version:VERSION,lookup:lookup,lookupRealtime:lookupRealtime,cleanQuery:cleanQuery,queryCandidates:queryCandidates,isRealtime:isRealtime,liveKind:liveKind,
    extractNewsTopic:extractNewsTopic,extractWeatherLocation:extractWeatherLocation,parseFx:parseFx,weatherLabel:weatherLabel,fetchWeather:fetchWeather,requestedWeatherTime:requestedWeatherTime
  };
})();
