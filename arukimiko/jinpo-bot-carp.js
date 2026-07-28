/*
 * 歩き巫女 広島東洋カープ専用会話 v1.4.0
 * - カープの基本知識・歴史を専用返答
 * - 試合結果/順位/日程/主要成績は NPB公式ページを Reader 経由で自動確認
 * - 最新ニュース/先発/スタメン/登録関連は既存の無料Webニュース検索へフォールバック
 * - APIキー不要。取得失敗時は推測せず、既存Web検索へ安全に切り替える。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_CARP)return;

  var VERSION='1.4.0';
  var NPB_TEAM_URL='https://npb.jp/bis/teams/index_c.html';
  var NPB_READER_URL='https://r.jina.ai/'+NPB_TEAM_URL;
  var NPB_ROSTER_URL='https://npb.jp/bis/teams/rst_c.html';
  var NPB_ROSTER_READER_URL='https://r.jina.ai/'+NPB_ROSTER_URL;
  var NPB_STANDINGS_URL='https://npb.jp/bis/'+(new Date().getFullYear())+'/stats/std_c.html';
  var NPB_STANDINGS_READER_URL='https://r.jina.ai/'+NPB_STANDINGS_URL;
  var STATIC_SOURCE={title:'NPB.jp：広島東洋カープ',url:NPB_TEAM_URL};
  var snapshotCache={text:'',fetchedAt:0};
  var rosterCache={text:'',fetchedAt:0};
  var standingsCache={text:'',fetchedAt:0};
  var CACHE_MS=2*60*1000;

  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function compact(v){return S(v).toLowerCase().replace(/[\s、。,.!！?？「」『』（）()・〜~ー―…]/g,'');}
  function pick(a){return a[Math.floor(Math.random()*a.length)];}

  function distance(a,b){
    a=compact(a);b=compact(b);var al=a.length,bl=b.length;
    if(!al)return bl;if(!bl)return al;
    var d=Array.from({length:al+1},function(){return new Array(bl+1).fill(0);});
    var i,j;for(i=0;i<=al;i++)d[i][0]=i;for(j=0;j<=bl;j++)d[0][j]=j;
    for(i=1;i<=al;i++)for(j=1;j<=bl;j++){
      var cost=a[i-1]===b[j-1]?0:1;
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
    }
    return d[al][bl];
  }

  function isCarp(text){
    var t=S(text),c=compact(t);
    if(/広島(?:東洋)?(?:カープ|かーぷ)|カープ|かーぷ|hiroshima\s*toyo\s*carp|hiroshima\s*carp|\bcarp\b/i.test(t))return true;
    // 単独名や短い文では「カープ」の軽い誤字も拾う。
    if(c.length<=18){
      var aliases=['カープ','かーぷ','広島カープ','広島東洋カープ'];
      for(var i=0;i<aliases.length;i++)if(Math.abs(c.length-compact(aliases[i]).length)<=1&&distance(c,aliases[i])<=1)return true;
    }
    return false;
  }

  function stripMarkdownLine(line){
    var s=String(line||'').trim();
    if(!s)return'';
    s=s.replace(/^#{1,6}\s*/,'')
      .replace(/!\[[^\]]*\]\([^)]*\)/g,'')
      .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
      .replace(/^\|/,'').replace(/\|$/,'').replace(/\s*\|\s*/g,' / ')
      .replace(/\*\*/g,'').replace(/__+/g,'')
      .replace(/\s+/g,' ').trim();
    if(/^[-:|\s]+$/.test(s)||/^Image\b/i.test(s)||/^(?:Title|URL Source|Published Time|Markdown Content):/i.test(s))return'';
    return s;
  }

  function section(text,startRe,stopRe,maxChars){
    var m=startRe.exec(text);if(!m)return'';
    var tail=text.slice(m.index+m[0].length,m.index+m[0].length+(maxChars||2200));
    if(stopRe){var x=stopRe.exec(tail);if(x)tail=tail.slice(0,x.index);}
    return tail;
  }

  function cleanSection(raw,maxLines){
    var out=[];
    String(raw||'').split(/\r?\n/).forEach(function(line){
      line=stripMarkdownLine(line);if(!line)return;
      if(/^(?:月日|曜|球場|対球団|スコア|勝敗|先発投手|打率|本塁打|打点|出塁率|安打|盗塁|防御率|勝利|奪三振|勝率|セーブ|ホールドポイント)(?:\s|\/|$)/.test(line))return;
      if(out.indexOf(line)<0)out.push(line);
    });
    return out.slice(0,maxLines||6);
  }

  function seasonSummary(text){
    var m=String(text||'').match(/〈シーズン成績〉\s*([^\n]{1,180})/);
    if(!m)m=String(text||'').match(/シーズン成績\s*([^\n]{1,180})/);
    if(!m)return'';
    var s=stripMarkdownLine(m[1]).replace(/詳細へ.*$/,'').trim();
    return s;
  }

  function recentGames(text){
    var raw=section(String(text||''),/■?\s*最近7試合/,/〈シーズン成績〉|年度\s*試合予定|リーダーズ/,2600);
    var lines=cleanSection(raw,12).filter(function(x){return /\d{1,2}\s*\/\s*\d{1,2}/.test(x)&&(/\d+\s*[-－]\s*\d+/.test(x)||/[○●△]/.test(x));});
    if(lines.length)return lines.slice(-4);
    // Readerの整形が1行に寄った場合の予備抽出。
    var hits=raw.match(/\d{1,2}\s*\/\s*\d{1,2}[^\n]{0,110}?(?:[○●△]|\d+\s*[-－]\s*\d+)/g)||[];
    return hits.map(stripMarkdownLine).filter(Boolean).slice(-4);
  }

  function upcomingGames(text){
    var raw=section(String(text||''),/■?\s*今後1週間|年度\s*試合予定/,/リーダーズ|個人打撃成績|全選手成績/,2800);
    var lines=cleanSection(raw,16).filter(function(x){return /\d{1,2}\s*\/\s*\d{1,2}/.test(x)&&( /\d{1,2}:\d{2}/.test(x)||/中止|延期|試合なし/.test(x));});
    if(lines.length)return lines.slice(0,5);
    var hits=raw.match(/\d{1,2}\s*\/\s*\d{1,2}[^\n]{0,120}?\d{1,2}:\d{2}/g)||[];
    return hits.map(stripMarkdownLine).filter(Boolean).slice(0,5);
  }

  function leaderStats(text,kind){
    var isPitch=kind==='pitch';
    var start=isPitch?/リーダーズ\s*[（(]\s*投手部門\s*[）)]/:/リーダーズ\s*[（(]\s*打撃部門\s*[）)]/;
    var stop=isPitch?/全選手成績|年度別成績/:/全選手成績|個人投手成績|リーダーズ\s*[（(]\s*投手部門/;
    var raw=section(String(text||''),start,stop,2200),lines=cleanSection(raw,14),out=[];
    for(var i=0;i<lines.length;i++){
      var x=lines[i];
      if(/^(?:リーダーズ|公式戦|ファーム)/.test(x))continue;
      if(x.length>1&&x.length<140)out.push(x);
      if(out.length>=8)break;
    }
    return out;
  }

  function timeoutController(ms){
    var c=typeof AbortController!=='undefined'?new AbortController():null;
    var timer=c?setTimeout(function(){c.abort();},ms||9000):null;
    return {signal:c?c.signal:undefined,clear:function(){if(timer)clearTimeout(timer);}};
  }

  async function fetchSnapshot(){
    if(snapshotCache.text&&Date.now()-snapshotCache.fetchedAt<CACHE_MS)return {ok:true,text:snapshotCache.text,cached:true};
    if(!window.fetch)return {ok:false,unavailable:true};
    var tc=timeoutController(10000);
    try{
      var r=await fetch(NPB_READER_URL,{method:'GET',mode:'cors',credentials:'omit',headers:{'Accept':'text/plain'},signal:tc.signal});
      if(!r.ok)return {ok:false,status:r.status};
      var text=await r.text();
      if(!text||text.length<200||!/(広島東洋カープ|HIROSHIMA TOYO CARP|シーズン成績|最近7試合)/i.test(text))return {ok:false,invalid:true};
      snapshotCache={text:text,fetchedAt:Date.now()};
      return {ok:true,text:text,cached:false};
    }catch(e){return {ok:false,error:true};}
    finally{tc.clear();}
  }


  async function fetchStandings(){
    if(standingsCache.text&&Date.now()-standingsCache.fetchedAt<CACHE_MS)return {ok:true,text:standingsCache.text,cached:true};
    if(!window.fetch)return {ok:false,unavailable:true};
    var tc=timeoutController(10000);
    try{
      var r=await fetch(NPB_STANDINGS_READER_URL,{method:'GET',mode:'cors',credentials:'omit',headers:{'Accept':'text/plain'},signal:tc.signal});
      if(!r.ok)return {ok:false,status:r.status};
      var text=await r.text();
      if(!text||text.length<300||!/(セントラル・リーグ|Central League)/.test(text)||!/(広島東洋カープ|Hiroshima)/i.test(text))return {ok:false,invalid:true};
      standingsCache={text:text,fetchedAt:Date.now()};
      return {ok:true,text:text,cached:false};
    }catch(e){return {ok:false,error:true};}finally{tc.clear();}
  }

  function carpStanding(text){
    text=String(text||'');
    var sectionText=text;
    var cut=sectionText.search(/交流戦チーム勝敗表|Interleague/i);
    if(cut>0)sectionText=sectionText.slice(0,cut);

    var date='';
    var dm=sectionText.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*現在/);
    if(dm)date=dm[1]+'年'+dm[2]+'月'+dm[3]+'日現在';

    var teams=['阪神タイガース','読売ジャイアンツ','東京ヤクルトスワローズ','横浜DeNAベイスターズ','広島東洋カープ','中日ドラゴンズ'];
    var rows=[];
    sectionText.split(/\r?\n/).forEach(function(line){
      line=stripMarkdownLine(line);
      if(!line||line.indexOf('/')<0)return;
      for(var i=0;i<teams.length;i++){
        if(line.indexOf(teams[i])===0){
          var parts=line.split('/').map(function(x){return S(x);});
          if(parts.length>=7){
            rows.push({
              team:teams[i],
              g:Number(parts[1])||0,
              w:Number(parts[2])||0,
              l:Number(parts[3])||0,
              t:Number(parts[4])||0,
              pct:parts[5],
              gb:parts[6]
            });
          }
          break;
        }
      }
    });

    var carpIndex=-1,carpRow=null;
    for(var j=0;j<rows.length;j++){
      if(rows[j].team==='広島東洋カープ'){carpIndex=j;carpRow=rows[j];break;}
    }
    if(carpIndex<0||!carpRow)return null;

    return {
      rank:carpIndex+1,
      date:date,
      games:carpRow.g,
      wins:carpRow.w,
      losses:carpRow.l,
      ties:carpRow.t,
      pct:carpRow.pct,
      gb:carpRow.gb
    };
  }

  async function fetchRoster(){
    if(rosterCache.text&&Date.now()-rosterCache.fetchedAt<CACHE_MS)return {ok:true,text:rosterCache.text,cached:true};
    if(!window.fetch)return {ok:false,unavailable:true};
    var tc=timeoutController(10000);
    try{
      var r=await fetch(NPB_ROSTER_READER_URL,{method:'GET',mode:'cors',credentials:'omit',headers:{'Accept':'text/plain'},signal:tc.signal});
      if(!r.ok)return {ok:false,status:r.status};
      var text=await r.text();
      if(!text||text.length<300||!/(広島東洋カープ|選手一覧|支配下選手)/.test(text))return {ok:false,invalid:true};
      rosterCache={text:text,fetchedAt:Date.now()};return {ok:true,text:text,cached:false};
    }catch(e){return {ok:false,error:true};}finally{tc.clear();}
  }
  function rosterNames(text,label,nextLabel,limit){
    text=String(text||'');var start=text.search(new RegExp('(?:^|\\n).*'+label+'.*','m'));if(start<0)return[];
    var chunk=text.slice(start,start+6500);if(nextLabel){var n=chunk.search(new RegExp('\\n.*'+nextLabel+'.*','m'));if(n>40)chunk=chunk.slice(0,n);}
    var out=[],seen={};
    chunk.split(/\n/).forEach(function(line){
      var x=stripMarkdownLine(line),m=x.match(/^\s*([0-9]{1,3}|00)\s*[|/]\s*([^|/]{2,24})/);
      if(!m)return;var name=S(m[2]).replace(/\s+/g,' ');if(!name||/投手|捕手|内野手|外野手|監督|生年月日/.test(name)||seen[name])return;
      seen[name]=1;out.push(name);
    });
    return out.slice(0,limit||6);
  }
  function rosterSummary(text){
    var ps=rosterNames(text,'投手','捕手',6),cs=rosterNames(text,'捕手','内野手',4),ins=rosterNames(text,'内野手','外野手',6),ofs=rosterNames(text,'外野手','育成選手',6);
    var lines=[];if(ps.length)lines.push('投手：'+ps.join('、'));if(cs.length)lines.push('捕手：'+cs.join('、'));if(ins.length)lines.push('内野手：'+ins.join('、'));if(ofs.length)lines.push('外野手：'+ofs.join('、'));
    return lines;
  }

  function sources(extra){
    var s=[STATIC_SOURCE];
    if(Array.isArray(extra))extra.forEach(function(x){if(x&&x.url&&!s.some(function(y){return y.url===x.url;}))s.push(x);});
    return s;
  }

  function staticReply(text){
    var t=S(text);
    if(/(?:意味|何のこと|なにのこと|わかってる|分かってる|理解してる).*(?:カープ|かーぷ)|(?:カープ|かーぷ).*(?:意味|何のこと|なにのこと|わかってる|分かってる|理解してる)/.test(t)){
      return 'はい。ここでいう「カープ」は広島東洋カープのこととして理解しているのですよ。試合・順位・選手・成績の続きも、カープの話として受け取ります。';
    }
    if(/好き|ファン|応援して|応援する|どこ推し|推して/.test(t))return pick([
      'カープの話は大歓迎なのですよ。試合結果や順位みたいな今の情報なら、その場で確認してから話すのです。',
      'カープですね。赤い話題が来ると少し元気になるのですよ。最新の試合や順位は、覚え込みではなくWebで確認して答えるのです。',
      'もちろんカープの話に付き合うのですよ。昔の話でも、今の試合でも、選手の話でもどうぞなのです。'
    ]);
    if(/本拠地|ホーム球場|球場|マツダスタジアム|mazda/i.test(t))return 'カープの本拠地は「MAZDA Zoom-Zoom スタジアム広島」なのですよ。NPB公式の球団ページでも本拠地として案内されているのです。';
    if(/何リーグ|どのリーグ|リーグは|セリーグ|セ・リーグ/.test(t))return '広島東洋カープはNPBのセントラル・リーグ所属なのですよ。';
    if(/球団名|名前|昔の名前|改名|いつから東洋/.test(t))return 'NPB公式では、球団名は1950～1967年が「広島カープ」、1968年から「広島東洋カープ」と記録されているのですよ。';
    if(/優勝|日本一|日本シリーズ|リーグ制覇/.test(t))return 'NPB公式の記録では、2026年シーズン途中時点までにセ・リーグ優勝9回、日本シリーズ優勝3回なのですよ。今後増える可能性がある数字なので、最新状況が必要な時はWebでも確認するのです。';
    if(/歴史|創設|いつできた|いつから|球団について|どんな球団|カープとは|カープって何/.test(t))return '広島東洋カープは1950年から続く広島のプロ野球球団なのですよ。1950～1967年は「広島カープ」、1968年から現在の「広島東洋カープ」。本拠地はMAZDA Zoom-Zoom スタジアム広島で、セ・リーグに所属しているのです。';
    if(/^(?:広島東洋)?カープ[？?]?$|^かーぷ[？?]?$|^carp[？?]?$/i.test(t))return pick([
      'カープですね。基本情報でも歴史でも、今日の試合・順位・次の予定でも、そのまま聞いてくださいなのですよ。',
      '広島東洋カープの話なのですね。今の情報が必要なら自動でWebを確認してから答えるのですよ。',
      'カープの話なら専用で少し詳しくしてあるのです。試合、順位、日程、選手、歴史あたりはそのまま聞いて大丈夫なのですよ。'
    ]);
    return'';
  }

  function intent(text){
    var t=S(text);
    if(/ニュース|速報|最新情報|話題|報道|記事/.test(t))return'news';
    if(/スタメン|先発|予告先発|登録抹消|一軍登録|故障|けが|怪我|復帰|移籍|トレード|新外国人/.test(t))return'news_detail';
    if(/順位|何位|何勝|何敗|勝敗|勝率|ゲーム差|シーズン成績|(?:カープ|広島).*(?:成績)|^成績[？?]?$/.test(t))return'rank';
    if(/選手一覧|選手|メンバー|誰がいる|だれがいる|投手陣|野手陣|捕手陣|内野手|外野手|監督/.test(t))return'players';
    if(/次の試合|次いつ|次はいつ|日程|予定|いつ試合|今日の試合|明日の試合|対戦相手/.test(t))return'schedule';
    if(/打率|本塁打|ホームラン|打点|出塁率|安打|盗塁/.test(t))return'bat';
    if(/防御率|奪三振|セーブ|ホールド|投手成績/.test(t))return'pitch';
    if(/試合結果|結果|スコア|勝った|負けた|昨日の試合|最近の試合/.test(t))return'result';
    if(/最近どう|今どう|いまどう|調子どう|現在どう|どうなって|今日どう|今のカープ/.test(t))return'overview';
    if(/今日|きょう|昨日|きのう|明日|あした|現在|今の|いまの|最近|最新|直近/.test(t))return'overview';
    return'';
  }

  async function newsFallback(original,detail){
    var web=window.JINPO_BOT_WEB;
    if(!web||typeof web.lookupRealtime!=='function')return null;
    var query='広島東洋カープ '+(detail||'最新ニュース');
    var r=await web.lookupRealtime(query);
    if(!r||!r.ok)return null;
    var src=Array.isArray(r.sources)?r.sources:(r.url?[{title:(r.source||'公開Web')+'：'+r.title,url:r.url}]:[]);
    return {handled:true,answer:'カープの最新情報をWebで確認したのですよ。\n'+r.title+'：'+r.extract,sources:sources(src),mode:'カープ最新Web'};
  }

  async function liveReply(text,kind,opt){
    opt=opt||{};var ctx=opt.context||{};
    if(kind==='news'||kind==='news_detail'){
      var detail=kind==='news_detail'?S(text).replace(/広島東洋カープ|広島カープ|カープ|かーぷ/gi,'').trim():'最新ニュース';
      var n=await newsFallback(text,detail||'最新ニュース');
      if(n)return n;
      return {handled:true,answer:'カープの最新情報を確認しようとしたのですが、今は検索先につながらなかったのですよ。推測では答えず、少し時間を置いてもう一度確認するのです。',sources:sources(),mode:'カープ最新Web'};
    }

    if(kind==='players'){
      var rr=await fetchRoster();
      if(rr.ok){
        var rs=rosterSummary(rr.text);
        if(rs.length)return {handled:true,answer:'カープの選手ですね。NPB公式の現在の選手一覧を見たのですよ。\n'+rs.join('\n')+'\n\n気になる選手がいたら、次は名前だけでも大丈夫なのです。',sources:sources([{title:'NPB.jp：広島東洋カープ 選手一覧',url:NPB_ROSTER_URL}]),mode:'カープ公式選手情報'};
      }
      return {handled:true,answer:'カープの選手の話ですね。今は選手一覧の取得だけ失敗したのですよ。一般的な「プロ野球選手」の説明には飛ばさず、カープの話題のまま待つのです。選手名を言ってくれれば、その選手について調べます。',sources:sources([{title:'NPB.jp：広島東洋カープ 選手一覧',url:NPB_ROSTER_URL}]),mode:'カープ公式選手情報'};
    }

    if(kind==='rank'){
      var standings=await fetchStandings();
      if(standings.ok){
        var sd=carpStanding(standings.text);
        if(sd){
          var rankAnswer='カープは現在、セ・リーグ'+sd.rank+'位なのですよ。';
          rankAnswer+='\n'+sd.games+'試合 '+sd.wins+'勝'+sd.losses+'敗'+sd.ties+'分、勝率'+sd.pct;
          if(sd.gb&&sd.gb!=='--'&&sd.gb!=='-')rankAnswer+='、首位と'+sd.gb+'ゲーム差';
          if(sd.date)rankAnswer+='（'+sd.date+'）';
          rankAnswer+='。';
          return {
            handled:true,
            answer:rankAnswer,
            sources:sources([{title:'NPB.jp：セントラル・リーグ チーム勝敗表',url:NPB_STANDINGS_URL}]),
            mode:'カープ公式順位'
          };
        }
      }
      // 順位表だけ取得できなかった場合は、球団ページの成績を補助的に表示する。
      var rankSnap=await fetchSnapshot();
      if(rankSnap.ok){
        var rankSeason=seasonSummary(rankSnap.text);
        if(rankSeason){
          return {
            handled:true,
            answer:'カープの正確な順位だけ今は順位表から取得できなかったのですが、NPB公式のシーズン成績は '+rankSeason+' なのですよ。順位は推測せず、順位表が取れた時だけ「何位」と断定します。',
            sources:sources([{title:'NPB.jp：セントラル・リーグ チーム勝敗表',url:NPB_STANDINGS_URL}]),
            mode:'カープ公式順位'
          };
        }
      }
      return {
        handled:true,
        answer:'カープの順位を確認しようとしたのですが、今はNPB公式の順位表を取得できなかったのですよ。リンクを出すだけではなく、取得できた時は必ず「何位」と数字で答えるようにしてあります。',
        sources:sources([{title:'NPB.jp：セントラル・リーグ チーム勝敗表',url:NPB_STANDINGS_URL}]),
        mode:'カープ公式順位'
      };
    }

    var snap=await fetchSnapshot();
    if(snap.ok){
      var lines=[],season=seasonSummary(snap.text),recent=recentGames(snap.text),upcoming=upcomingGames(snap.text),stat;
      if(kind==='rank'){
        if(season)lines.push('シーズン成績：'+season);
      }else if(kind==='result'){
        if(recent.length)lines.push('最近の試合：\n'+recent.join('\n'));
        if(season)lines.push('シーズン成績：'+season);
      }else if(kind==='schedule'){
        if(upcoming.length)lines.push('今後の予定：\n'+upcoming.join('\n'));
        if(season)lines.push('シーズン成績：'+season);
      }else if(kind==='bat'){
        stat=leaderStats(snap.text,'bat');if(stat.length)lines.push('打撃部門：\n'+stat.join('\n'));
      }else if(kind==='pitch'){
        stat=leaderStats(snap.text,'pitch');if(stat.length)lines.push('投手部門：\n'+stat.join('\n'));
      }else{
        if(season)lines.push('シーズン成績：'+season);
        if(recent.length)lines.push('最近の試合：\n'+recent.slice(-3).join('\n'));
        if(upcoming.length)lines.push('次の予定：\n'+upcoming.slice(0,3).join('\n'));
      }
      if(lines.length){
        var lead='NPB公式のカープ情報を確認したのですよ。';
        if(ctx.reason==='carp_topic_carry'){
          if(kind==='rank')lead='順位ですね。NPB公式の現在情報では、';
          else if(kind==='result')lead='試合結果ですね。NPB公式では、';
          else if(kind==='schedule')lead='日程ですね。NPB公式では、';
          else if(kind==='bat')lead='打撃成績ですね。NPB公式では、';
          else if(kind==='pitch')lead='投手成績ですね。NPB公式では、';
        }
        return {handled:true,answer:lead+'\n'+lines.join('\n\n'),sources:sources(),mode:'カープ公式情報'};
      }
    }

    // NPB公式の取得に失敗した場合は、既存のニュース検索へ落とす。
    var fallback=await newsFallback(text,'最新ニュース');
    if(fallback)return fallback;
    return {handled:true,answer:'カープの最新情報を確認しようとしたのですが、今はNPB公式ページにもニュース検索にもつながらなかったのですよ。古い情報を推測で埋めず、接続が戻ってから確認するのです。',sources:sources(),mode:'カープ最新Web'};
  }

  async function respond(text,opt){
    opt=opt||{};
    var t=S(text);if(!isCarp(t))return {handled:false};
    var k=intent(t);if(k)return await liveReply(t,k,opt);
    var local=staticReply(t);
    if(local)return {handled:true,answer:local,sources:sources(),mode:'カープ専用会話'};

    // カープ名を含む選手・歴史などの具体質問は、一般Web検索へ自然に引き渡す。
    var web=window.JINPO_BOT_WEB;
    if(web&&typeof web.lookup==='function'&&/(誰|選手|監督|コーチ|歴史|由来|記録|成績|教えて|知りたい|について|[？?]$)/.test(t)){
      var r=await web.lookup(t);
      if(r&&r.ok){
        var src=Array.isArray(r.sources)?r.sources:(r.url?[{title:(r.source||'公開Web')+'：'+r.title,url:r.url}]:[]);
        return {handled:true,answer:'カープのことなので、公開Webも確認したのですよ。\n'+r.title+'：'+r.extract,sources:sources(src),mode:r.realtime?'カープ最新Web':'カープWeb調査'};
      }
    }
    return {handled:true,answer:'カープの話なのですね。試合結果、順位、日程、選手、歴史など、気になるところをそのまま聞いてくださいなのですよ。',sources:sources(),mode:'カープ専用会話'};
  }

  window.JINPO_BOT_CARP={version:VERSION,respond:respond,isCarp:isCarp,intent:intent,fetchSnapshot:fetchSnapshot,fetchRoster:fetchRoster,fetchStandings:fetchStandings,parse:{seasonSummary:seasonSummary,recentGames:recentGames,upcomingGames:upcomingGames,leaderStats:leaderStats,rosterSummary:rosterSummary,carpStanding:carpStanding}};
})();
