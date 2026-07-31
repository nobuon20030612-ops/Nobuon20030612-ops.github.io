(function(){
  'use strict';
  if(window.JINPO_BOT_NLU) return;

  var VERSION='2.4.0';
  var MEMORY_KEY='jinpo_bot_nlu_memory_v1';
  var MEMORY_TTL=30*60*1000;

  var STATS=[
    {to:'生命',a:['生命','生命力','せいめい','体力','hp','ＨＰ','命','生存','耐久じゃなく生命']},
    {to:'気合',a:['気合','気合い','きあい','mp','ＭＰ','気力']},
    {to:'腕力',a:['腕力','わんりょく','腕','力','火力','物理火力','攻撃力']},
    {to:'耐久力',a:['耐久力','耐久','たいきゅう','硬さ','固さ','かたさ','丈夫さ','タフ','防御寄り']},
    {to:'器用さ',a:['器用さ','器用','きよう','器用度','命中寄り']},
    {to:'知力',a:['知力','ちりょく','賢さ','頭','頭脳','術火力']},
    {to:'魅力',a:['魅力','みりょく']},
    {to:'土属性',a:['土属性','土ぞくせい','つち属性','土']},
    {to:'水属性',a:['水属性','水ぞくせい','みず属性','水']},
    {to:'火属性',a:['火属性','火ぞくせい','ひ属性','火']},
    {to:'風属性',a:['風属性','風ぞくせい','かぜ属性','風']}
  ];
  var FORMS=[
    {to:'鶴翼',a:['鶴翼','かくよく','鶴']},
    {to:'方円',a:['方円','ほうえん']},
    {to:'魚鱗',a:['魚鱗','ぎょりん','魚']},
    {to:'衡軛',a:['衡軛','こうやく','鴻鵠','衝軛','衡']}
  ];
  var JOBS=['侍','僧','神主/巫女','神主','巫女','陰陽師','忍者','鍛冶屋','薬師','傾奇者'];
  var PANELS=[
    {to:'見聞録',a:['見聞録','見聞','けんぶん']},
    {to:'鬼神石',a:['鬼神石','鬼神','きしん']},
    {to:'転生',a:['転生','てんせい']}
  ];
  var SEARCH_WORDS=['検索','探','さが','候補','組み合わせ','陣法','編成','見たい','出して','欲しい','ほしい','ないかな','あるかな','お願い','頼む','やって'];
  var APPLY_WORDS=['適用','使う','使って','これで','それで','決定','選ぶ','選んで','にする','これに','それに','お願い'];
  var INCLUDE_WORDS=['使いたい','使った','使って','使う','入れたい','入れて','含め','残して','固定','必須','ありで','込みで','この人で','こいつで','メンバーに','連れて'];
  var EXCLUDE_WORDS=['持ってない','もってない','未所持','所持なし','いらない','不要','抜き','抜いて','外して','除外','なしで','無しで','使わない','候補から外','出さない'];
  var POLITE_TAIL=/(?:してもらえる|してくれる|してほしい|して欲しい|して下さい|してください|してちょうだい|してくれ|お願い(?:します)?|頼む|たのむ|かな|かも|だといい|がいいな|がいい|ほしい|欲しい|です|ます|なの|なんだけど|んだけど|なんですが|んですが|ね|よ)+[。.!！?？]*$/;

  function S(v){
    var s=String(v==null?'':v);try{s=s.normalize('NFKC');}catch(e){}
    try{
      var conv=window.JINPO_BOT_CONVERSATION;
      if(conv&&typeof conv.normalizeCasualInput==='function'){var c=conv.normalizeCasualInput(s);if(c&&c.text)s=String(c.text);}
      if(conv&&typeof conv.normalizeKanaInput==='function'){var k=conv.normalizeKanaInput(s);if(k&&k.text)s=String(k.text);}
      if(conv&&typeof conv.normalizeKnownInput==='function'){var n=conv.normalizeKnownInput(s);if(n&&n.text)s=String(n.text);}
    }catch(normalizeErr){}
    return s;
  }
  function hira(v){return S(v).replace(/[ァ-ヶ]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0x60);});}
  function compact(v){return hira(v).toLowerCase().replace(/[\s　、。,.!！?？「」『』（）()・ー~〜～:：\/]/g,'');}
  function clean(v){var s=S(v).replace(/[　\t]+/g,' ').replace(/\s+/g,' ').trim();return s.replace(POLITE_TAIL,'').trim();}
  function any(text,list){var s=S(text).toLowerCase();for(var i=0;i<list.length;i++)if(s.indexOf(String(list[i]).toLowerCase())>=0)return true;return false;}
  function startsAny(text,list){var s=clean(text);for(var i=0;i<list.length;i++)if(s.indexOf(list[i])===0)return true;return false;}
  function unique(arr){var out=[];arr.forEach(function(x){if(x!=null&&x!==''&&out.indexOf(x)<0)out.push(x);});return out;}
  function kanjiDigits(v){return S(v).replace(/[〇零一二三四五六七八九]/g,function(c){return {'〇':'0','零':'0','一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9'}[c]||c;});}
  function loadMemory(){try{var raw=localStorage.getItem(MEMORY_KEY);if(!raw)return{};var m=JSON.parse(raw)||{};if(Date.now()-Number(m.at||0)>MEMORY_TTL)return{};return m;}catch(e){return{};}}
  function saveMemory(m){try{m=Object.assign({},m||{},{at:Date.now()});localStorage.setItem(MEMORY_KEY,JSON.stringify(m));}catch(e){}}
  function clearMemory(){try{localStorage.removeItem(MEMORY_KEY);}catch(e){}}

  function findAlias(text,groups,guard){
    var raw=S(text),low=raw.toLowerCase(),hits=[];
    groups.forEach(function(g){g.a.forEach(function(a){var al=String(a),i=low.indexOf(al.toLowerCase());if(i<0)return;if(guard&&!guard(g.to,al,raw,i))return;hits.push({value:g.to,alias:al,index:i,len:al.length});});});
    hits.sort(function(a,b){return a.index-b.index||b.len-a.len;});
    return hits;
  }
  function statGuard(to,alias,text,index){
    if(['力','腕','頭','土','水','火','風','命'].indexOf(alias)>=0){
      if(alias==='力'){var pre=text.slice(Math.max(0,index-2),index),post=text.slice(index,index+3);if(/知$|魅$|耐久$|生命$|気合$/.test(pre)||/^(?:力)/.test(post)&&/(?:知力|魅力|耐久力|生命力|気合力)/.test(text.slice(Math.max(0,index-3),index+3)))return false;}
      if(!any(text,SEARCH_WORDS.concat(['優先','重視','高','低','盛','ステ','数値','以上','以下','第1','第2','メイン','サブ','MAX','込み','因縁','変えて','にして']))&&!/[5-9]/.test(text))return false;
      if(alias==='水'&&/水(?:飲|ください|ほしい|欲しい)/.test(text))return false;
      if(alias==='火'&&/火(?:を|が)?(?:つけ|消し|怖)/.test(text))return false;
      if(alias==='魚'&&/魚(?:食|料理|釣)/.test(text))return false;
    }
    return true;
  }
  function formGuard(to,alias,text){
    if(alias==='鶴'||alias==='魚'||alias==='衡')return any(text,SEARCH_WORDS.concat(['因縁','陣形','変えて','にして','優先','重視','高','盛']))||/[5-9]/.test(text)||extractStatsNoForm(text).length>0;
    return true;
  }
  function extractStatsNoForm(text){return unique(findAlias(text,STATS,statGuard).map(function(x){return x.value;}));}
  function extractStats(text){return extractStatsNoForm(text);}
  function extractFormation(text){var h=findAlias(text,FORMS,formGuard);return h.length?h[0].value:'';}
  function extractCount(text){
    var s=kanjiDigits(text),m=s.match(/(?:^|[^0-9])([5-9])\s*(?:因縁|いんえん|縁)(?:[^0-9]|$)/);if(m)return Number(m[1]);
    m=s.match(/(?:因縁|いんえん|縁)(?:数)?\s*(?:は|=|:|：)?\s*([5-9])/);if(m)return Number(m[1]);
    if(any(s,SEARCH_WORDS.concat(['優先','重視','盛り','盛','陣形','にして','でいこう','でいい','高い','高め','MAX','マックス','基礎','素ステ','素で','強化込み']))||extractStatsNoForm(s).length||extractFormation(s)){m=s.match(/(?:^|[^0-9])([5-9])(?=$|[^0-9時分秒])/);if(m)return Number(m[1]);}
    if(/^\s*[5-9]\s*$/.test(s))return Number(s.trim());
    return 0;
  }
  function extractRanks(text){var s=kanjiDigits(text),out=[];var re=/([1-9][0-9]?)\s*(?:位|番(?:目)?|個目|つ目)/g,m;while((m=re.exec(s)))out.push(Number(m[1]));if(!out.length){if(/一番上|最初|トップ/.test(text))out.push(1);else if(/二番目|二位/.test(text))out.push(2);else if(/三番目|三位/.test(text))out.push(3);}return unique(out);}
  function extractPanel(text){var h=findAlias(text,PANELS);return h.length?h[0].value:'';}
  function extractJob(text){for(var i=0;i<JOBS.length;i++)if(S(text).indexOf(JOBS[i])>=0)return JOBS[i];return'';}
  function extractSlot(text){var s=kanjiDigits(text),m=s.match(/(?:配置|枠|スロット|鬼神石|転生)[^0-9]{0,5}([1-6])/);return m?Number(m[1]):0;}
  function extractRange(text){var s=kanjiDigits(text),min=null,max=null,m=s.match(/([0-9]{2,5})\s*(?:以上|超え|より上|最低)/);if(m)min=Number(m[1]);m=s.match(/([0-9]{2,5})\s*(?:以下|未満|まで|より下)/);if(m)max=Number(m[1]);return {min:min,max:max};}
  function basis(text){if(/(?:全?MAX|マックス|フル)(?:込み|状態|基準)|強化込み/.test(text))return'fullmax';if(/基礎値|基礎|素ステ|素の|元ステ|強化なし|通常値|(?:^|[\s、])素(?:で|基準|$)/.test(text))return'base';return'';}
  function direction(text){if(/低い順|小さい順|昇順/.test(text))return'asc';if(/高い順|大きい順|降順|上から/.test(text))return'desc';return'';}
  function removeFillers(text){return clean(text).replace(/^(?:じゃあ|じゃ|なら|それなら|それじゃ|じゃあさ|えっと|えーと|とりあえず|ひとまず|まず|あと|ちなみに|ねえ|ねぇ|お願いだから)\s*/,'').trim();}
  function heroQuery(text,mode){
    var t=removeFillers(text),suffix=mode==='include'?/(?:を|は)?\s*(?:使いたい|使った(?:やつ|の)(?:ない|ある|がいい)?|使って|使う|入れたい|入れて|入った|入り|含めたい|含めて|残したい|残して|固定したい|固定して|必須|ありで|込みで|メンバーに|連れて|で探|でいき|がいい|にしたい).*$/ : /(?:を|は)?\s*(?:持ってない|もってない|未所持|所持なし|いらない|不要|抜き(?:で)?|抜いて|外して|除外(?:して)?|なし(?:で)?|無し(?:で)?|使わない|候補から外して|出さない).*$/;
    var m=t.match(new RegExp('^(.+?)'+suffix.source));if(!m)return'';var q=m[1].trim().replace(/^(?:英傑|キャラ)\s*/,'');if(!q||/^(?:これ|それ|あれ|こいつ|この人|その人)$/.test(q))return'';if(/^(?:全?MAX|マックス|基礎値?|検索|因縁|陣形|第[12]|見聞録|鬼神石|転生|等級|合計|おすすめ)/.test(q)||extractStatsNoForm(q).length||extractFormation(q)||extractCount(q))return'';return q;
  }

  function add(list,id,score,canonical,reason,extra){if(!canonical&&!(extra&&extra.clarify))return;list.push(Object.assign({id:id,score:Math.max(0,Math.min(1,score)),canonical:canonical||'',reason:reason||''},extra||{}));}
  function searchCanonical(e,site,text){
    var p=[];if(e.formation)p.push(e.formation);if(e.count)p.push(e.count+'因縁');
    if(e.stats[0]){
      var range=e.range||{};var s='第1 '+e.stats[0];if(range.min!=null)s+=' '+range.min+'以上';if(range.max!=null)s+=' '+range.max+'以下';p.push(s);
    }
    if(e.stats[1])p.push('第2 '+e.stats[1]);
    if(e.basis==='fullmax')p.push('検索基準を全MAX込みにして');else if(e.basis==='base')p.push('検索基準を基礎値にして');
    if(/等級\s*3以下/.test(text))p.push(/(?:OFF|オフ|なし|解除|使わない)/i.test(text)?'等級3以下 OFF':'等級3以下 ON');
    var f4=kanjiDigits(text).match(/文曲[^0-9]{0,8}([0-6])\s*人?/);if(f4)p.push('文曲除外'+Number(f4[1])+'人');
    if(!p.length&&site&&(site.formation||site.count))return'検索して';
    p.push('検索して');return p.join(' ');
  }

  function infer(input,context){
    var original=S(input).trim();if(!original)return null;
    var t=removeFillers(original),ct=compact(t),site=context&&context.siteState||{},ref=context&&context.lastReference||{},mem=loadMemory();
    var e={stats:extractStats(t),formation:extractFormation(t),count:extractCount(t),ranks:extractRanks(t),panel:extractPanel(t),job:extractJob(t),slot:extractSlot(t),range:extractRange(t),basis:basis(t),dir:direction(t)};
    // よく使われる2項目省略。単語登録ではなく、陣法のステータス組み合わせとして補完する。
    var pairMap={'腕知':['腕力','知力'],'腕生':['腕力','生命'],'腕耐':['腕力','耐久力'],'生知':['生命','知力'],'生耐':['生命','耐久力'],'知魅':['知力','魅力']};
    Object.keys(pairMap).forEach(function(k){if(t.indexOf(k)>=0)e.stats=unique(pairMap[k].concat(e.stats||[]));});
    if(!e.stats.length&&/(?:^|[^知魅耐器生気水火土風])力(?:トップ|一番|いちばん|最高|最大)/.test(t))e.stats=['腕力'];
    var c=[];
    var searchish=any(t,SEARCH_WORDS),applyish=any(t,APPLY_WORDS),includeish=any(t,INCLUDE_WORDS),excludeish=any(t,EXCLUDE_WORDS);
    var hasEntities=!!(e.formation||e.count||e.stats.length||e.basis);

    // 「一番高い」「トップ」系に加え、「耐久と魅力の合計高い」のような
    // 日常的な2項目合計指定も、陣形を質問せず全陣形DB比較として扱う。
    var pairCompareQuestion=/(?:どっち|どちら|比較|比べ|違い)/.test(t);
    var pairLow=/(?:低い|低く|小さい|少ない|最低)/.test(t);

    // 2つの異なるステータスがあり、高さ・強さ・重視方向が明確なら、
    // 「合計」と言わなくても2項目合計の全陣形最高値検索として扱う。
    var explicitTwoStatHigh=
      e.stats.length>=2 &&
      /(?:高い|高め|高く|強い|強め|強く|重視|優先|盛り|伸ば|バランス)/.test(t) &&
      !pairLow &&
      !pairCompareQuestion;

    var pairHigh=e.stats.length>=2&&(
      explicitTwoStatHigh ||
      (
        /(?:合計|合わせ|足し|足した|足す|両方|どっちも|二つ|2つ|セット|\+|＋|＆|&|と|および|及び)/.test(t)&&
        /(?:高|大き|強|良|いい|上|重視|優先|順|伸ば|盛り|バランス)/.test(t)
      )||
      /(?:両方|どっちも|二つ|2つ|も.+も).*(?:高|強|重視|優先|伸ば|盛り)/.test(t)
    )&&!pairLow&&!pairCompareQuestion;

    var bestish=pairHigh||/(?:一番|いちばん|最も|最高|トップ|最大).*(?:高|大|強)|(?:高|大|強).*(?:一番|いちばん|最も|最高|トップ|最大)/.test(t)||(e.stats.length>0&&/(?:一番|いちばん|最高|トップ|最大)(?:の|で|が|を)?(?:$|[。！!？?])/.test(t));
    if(bestish){
      if(ref.type==='result'&&e.stats[0]&&/(?:この中|結果|候補|今出てる|表示中)/.test(t)){
        add(c,'best_in_results',0.995,'検索結果 '+e.stats[0]+' 高い順','現在の検索結果内で並べ替え');
      }else if(e.stats.length>=2){
        add(c,'global_best_sum',0.995,e.stats[0]+'と'+e.stats[1]+'の合計が一番高い','全陣形から2項目合計の最高値を検索');
      }else if(e.stats[0]){
        add(c,'global_best',0.99,e.stats[0]+'が一番高い','全陣形から最高値を検索');
      }else if(site.priority1){
        add(c,'global_best_current',0.80,site.priority1+'が一番高い','現在の第1優先を最高値の軸として補完',{confirm:true,question:'今の第1優先「'+site.priority1+'」が一番高いものを、全陣形から探すという意味ですか？'});
      }else{
        add(c,'global_best_vague',0.72,'','最高値の軸を確認',{clarify:true,question:'一番高いものを探せるのですよ。生命・気合・腕力・耐久・器用・知力・魅力・土・水・火・風の、どれを一番高くしたいですか？'});
      }
    }

    // 文脈だけで成立する短文。
    if(/^(?:もう一回|もっかい|同じの|同じので|さっきの条件|このまま|今のまま|今ので|そのまま)(?:で)?(?:もう一回|もっかい)?(?:お願い|やって|検索|探して)?$/.test(t))add(c,'search_current',0.99,'検索して','現在条件を維持して再検索');
    if(/^(?:やっぱ|じゃあ|なら)?\s*([5-9])\s*(?:にして|で|でいこう|でいい)?$/.test(kanjiDigits(t))){var nc=extractCount(t);if(nc)add(c,'change_count',0.96,nc+'因縁 検索して','数字を因縁数として補完');}
    if(e.formation&&/^(?:やっぱ|じゃあ|なら)?\s*(?:鶴翼|鶴|方円|魚鱗|魚|衡軛|衡|鴻鵠|衝軛)(?:に|で)?(?:変えて|変える|して|いこう|いい)?$/.test(t))add(c,'change_formation',0.97,e.formation+' 検索して','陣形変更として補完');
    if(e.stats[0]&&!e.formation&&!e.count&&!e.basis&&/^(?:やっぱ|じゃあ|なら)\s*.+?(?:に|で)?(?:変えて|して|いこう|いい)?$/.test(S(original).trim())&&!searchish&&!/とは|なに|何/.test(t)){
      var sc=site.priority1?0.91:0.82;add(c,'change_stat',sc,'第1 '+e.stats[0]+' 検索して','現在の第1優先を変更する文脈');
    }
    var secondStatFollowup=!!(e.stats[0]&&site.priority1&&(/^(?:あと|それと|ついでに)\s*.+/.test(original)||/(?:も|もね|もさ).*(?:高|高め|強|重視|優先|欲しい|ほしい|見たい|見る|盛り)/.test(t)));
    if(secondStatFollowup)add(c,'add_second_stat',0.985,'第2 '+e.stats[0]+' 検索して','追加条件なので第2優先と推定');
    if(/^(?:サブ|第2|2番目)(?:は|を)?\s*(?:やっぱ|やっぱり)?\s*(?:いらない|なし|無し|やめ|外して|消して|解除)$/.test(t))add(c,'clear_p2',0.99,'第2優先解除 検索して','第2優先解除');
    if(/^(?:メイン|第1|1番目)(?:は|を)?\s*(?:やっぱ|やっぱり)?\s*(?:いらない|なし|無し|やめ|外して|消して|解除)$/.test(t))add(c,'clear_p1',0.99,'第1優先解除 検索して','第1優先解除');

    // 普通の検索依頼。動詞が省略されていても、検索エンティティが2個以上なら高めに扱う。
    var entityCount=(e.formation?1:0)+(e.count?1:0)+e.stats.length+(e.basis?1:0);
    if(!bestish&&((searchish&&hasEntities)||entityCount>=2)){var ss=searchish?0.98:0.96;add(c,'search',ss,searchCanonical(e,site,t),'検索条件を組み立て');}
    if(entityCount===1&&e.count&&/^[5-9](?:因縁|縁|いんえん)?$/.test(kanjiDigits(t)))add(c,'count_only',0.84,e.count+'因縁 検索して','因縁数だけの短縮指定');
    if(!bestish&&!secondStatFollowup&&entityCount===1&&e.stats[0]&&/(?:高い|高め|盛り|重視|優先|強め|伸ばした|欲しい|ほしい)/.test(t))add(c,'stat_search',0.93,'第1 '+e.stats[0]+' 検索して','ステータス優先検索');
    if(e.stats[0]&&(e.range.min!=null||e.range.max!=null)){var rc='第1 '+e.stats[0];if(e.range.min!=null)rc+=' '+e.range.min+'以上';if(e.range.max!=null)rc+=' '+e.range.max+'以下';rc+=' 検索して';add(c,'stat_range',0.96,rc,'ステータス数値条件として補完');}
    if(e.stats[0]&&/(?:もっと|さらに|もう少し)(?:高く|上げ|盛り|強く)?/.test(t)&&e.range.min==null&&e.range.max==null){
      add(c,'vague_more',0.63,'','数値の追加指定が必要',{clarify:true,question:(site.priority1===e.stats[0]?'今の第1優先「'+e.stats[0]+'」をさらに絞る':'「'+e.stats[0]+'」をもっと重視する')+'という意味ですか？ 数値まで絞る場合は「'+e.stats[0]+'1000以上」のようにも指定できるのですよ。'});
    }

    // おすすめ・おまかせ。
    if(/おすすめ|オススメ|任せる|おまかせ|いいの(?:ない|ある)|良さそう|強いやつ/.test(t)){
      if(e.stats[0])add(c,'recommended',0.96,'おすすめ '+e.stats[0],'おすすめ検索');
      else add(c,'recommended_vague',0.66,'','おすすめの軸が不足',{clarify:true,question:'おまかせで探せるのですよ。何を重視しますか？ 「生命」「腕力」「知力」などから選べます。'});
    }

    // 結果・差替候補の参照。
    var scope=ref.type==='swap'?'差替候補':'検索結果';
    if((ref.type==='result'||ref.type==='swap')&&e.ranks[0]&&(applyish||/^[0-9一二三四五六七八九]+(?:位|番(?:目)?|個目|つ目)?(?:で|に)?$/.test(t)))add(c,'apply_ref',0.96,scope+e.ranks[0]+'番目を適用','直前一覧の番号参照');
    if((ref.type==='result'||ref.type==='swap')&&/^(?:これ|それ|こっち|上の|最初の|一番上)(?:で|を)?(?:いい|お願い|使って|使う|適用|にして)?$/.test(t))add(c,'apply_deictic',0.91,scope+'1番目を適用','直前一覧の指示語');
    if(ref.type==='result'&&e.ranks.length>=2&&/(?:比べ|比較|どっち|違い)/.test(t))add(c,'compare',0.98,e.ranks[0]+'位と'+e.ranks[1]+'位を比較','検索結果比較');
    if(ref.type==='result'&&/(?:上位|上から|最初の).*(?:見せ|出して|表示)|(?:全部|もっと)(?:結果|候補)(?:見たい|見せて)/.test(t)){
      var lim=(kanjiDigits(t).match(/([1-9][0-9]?)\s*(?:件|個|つ)/)||[])[1]||5;add(c,'show_results',0.94,'上位 '+lim+'件 見せて','検索結果一覧');
    }
    if(e.stats[0]&&e.dir&&/(?:順|並べ|ソート|ランキング)/.test(t))add(c,'sort_results',0.97,'検索結果 '+e.stats[0]+' '+(e.dir==='asc'?'低い順':'高い順'),'結果ソート');

    // 差替。
    if(/(?:因縁|縁).*(?:落と|減ら).*(?:たくない|ない|なし|さず)/.test(t))add(c,'swap_keep_short',0.97,'因縁が減らない差替候補を見せて','因縁維持差替');
    if(/(?:上がる|UP|アップ).*(?:候補|人).*(?:だけ)?/i.test(t))add(c,'swap_up_short',0.96,'UPだけ差替候補を見せて','UP差替');
    if(/(?:差替|差し替|入れ替|入替|交換|変えたい|変えられる|別の人|1人変|一人変)/.test(t)){
      if(/(?:因縁|縁).*(?:減ら|落と).*(?:ない|なし|さず)|維持/.test(t))add(c,'swap_keep',0.97,'因縁が減らない差替候補を見せて','因縁維持差替');
      else if(/(?:UP|アップ|上がる|良くなる|強くなる).*(?:だけ|候補)?/i.test(t))add(c,'swap_up',0.95,'UPだけ差替候補を見せて','UP差替');
      else if(/(?:FLAT|フラット|同じ|変わらない).*(?:だけ|候補)?/i.test(t))add(c,'swap_flat',0.94,'FLATだけ差替候補を見せて','FLAT差替');
      else add(c,'swap',0.90,'差替候補を見せて','差替候補');
    }
    if(ref.type==='swap'&&e.ranks[0]&&applyish)add(c,'apply_swap',0.99,'差替候補'+e.ranks[0]+'番目を適用','差替候補番号参照');

    // 英傑指定。名前確定は既存Interpreterの実マスタ照合へ渡す。
    var hq=heroQuery(t,'include');if(hq&&includeish)add(c,'hero_include',0.94,hq+'を使いたい','英傑を含める意図');
    hq=heroQuery(t,'exclude');if(hq&&excludeish)add(c,'hero_exclude',0.95,hq+'を除外して','英傑を外す意図');
    if(mem.lastHero&&/^(?:やっぱ|やっぱり)?\s*(?:それ|その人|さっきの人)?\s*(?:なし|いらない|外して|抜いて)$/.test(t))add(c,'last_hero_remove',0.72,mem.lastHero+'を除外して','直前英傑の否定',{confirm:true,question:'さっきの「'+mem.lastHero+'」を候補から外す、という意味ですか？'});

    // 現在状態・情報取得。
    if(/(?:今|いま|現在).*(?:どう|どんな|条件|設定)|(?:条件|設定).*(?:教えて|見せて|確認)/.test(t))add(c,'read_state',0.96,'今の条件を教えて','現在条件');
    if(/(?:誰|だれ).*(?:入って|いる)|(?:今|現在).*(?:メンバー|6人|編成|配置)|(?:今|現在)の人(?:は)?(?:誰|だれ)|編成(?:を)?(?:教えて|見せて)/.test(t))add(c,'read_placement',0.97,'今の6人を教えて','現在編成');
    if(/(?:込み|強化込み|MAX込み).*(?:合計|数値|ステ|いくつ|教えて|見せて)/.test(t))add(c,'read_combined',0.98,'今の込み合計を教えて','込み合計');
    else if(/(?:合計|ステータス|ステ|数値|数字).*(?:いくつ|教えて|見せて|確認|どう)|(?:今|現在).*(?:合計|ステ|数字)/.test(t))add(c,'read_total',0.93,'今の合計を教えて','合計');
    if(/(?:何|なに).*(?:因縁).*(?:発動|ついて|出て)|(?:今|現在)の因縁(?:は)?(?:何|なに)|因縁.*(?:何|なに).*(?:出て|発動)?|(?:発動|出てる|出ている).*(?:因縁)|因縁(?:を)?(?:教えて|見せて)/.test(t))add(c,'read_bonds',0.96,'発動因縁を教えて','発動因縁');
    if(/(?:配置|固定).*(?:条件|英傑).*(?:教えて|見せて|何)|(?:誰|だれ).*(?:固定|配置条件)/.test(t))add(c,'read_owned',0.94,'配置英傑条件を教えて','配置英傑条件');
    if(/(?:除外|外してる).*(?:条件|英傑|人).*(?:教えて|見せて|何)|(?:誰|だれ).*(?:除外|外してる)/.test(t))add(c,'read_excluded',0.94,'除外英傑条件を教えて','除外英傑条件');

    // 強化。
    if(/(?:全部|全員|全部の).*(?:MAX|マックス|盛|強化)|(?:フルMAX|全部盛り|全MAX)/.test(t)&&!/(?:全MAX|MAX|マックス).*(?:込み|基準|検索)/.test(t))add(c,'all_max',0.99,'全MAX','全MAX');
    if(/(?:MAX|マックス|強化).*(?:全部|全て)?.*(?:戻|解除|なし|やめ)|強化なしに戻/.test(t)&&!/込み/.test(t))add(c,'clear_all_max',0.91,'全MAX解除','全MAX解除');
    if(e.panel&&/(?:MAX|マックス|盛|上げ|全部)/.test(t)&&!/(?:戻|解除|なし|やめ|外して|OFF|オフ)/.test(t))add(c,'panel_max',0.96,e.panel+'だけMAX',e.panel+'MAX');
    if(e.panel&&/(?:戻|解除|なし|やめ|外して|OFF|オフ)/.test(t))add(c,'panel_clear',0.99,e.panel+'解除',e.panel+'解除');
    if(/(?:強化|見聞録|鬼神石|転生).*(?:画面|設定).*(?:開|見せ)|(?:強化画面|強化設定)(?:開|見せ)/.test(t))add(c,'open_enhance',0.96,'強化画面を開いて','強化画面');

    // 基準・フィルタ。
    if(e.basis&&!/(?:いくつ|教えて|見せて|合計|数値)/.test(t))add(c,'basis',0.90,(e.basis==='fullmax'?'検索基準を全MAX込みにして':'検索基準を基礎値にして')+((searchish||e.count||e.stats.length||e.formation)?' 検索して':''),'検索基準');
    if(/等級\s*3以下/.test(t))add(c,'grade3',0.96,'等級3以下 '+(/(?:なし|解除|OFF|オフ|使わない)/i.test(t)?'OFF':'ON')+(searchish?' 検索して':''),'等級3以下');
    var f4m=kanjiDigits(t).match(/文曲[^0-9]{0,8}([0-6])\s*人?/);if(f4m)add(c,'factor4',0.97,'文曲除外'+Number(f4m[1])+'人'+(searchish?' 検索して':''),'文曲除外人数');
    if(/文曲.*(?:なし|解除|0人|ゼロ)/.test(t))add(c,'factor4_clear',0.98,'文曲除外0人'+(searchish?' 検索して':''),'文曲除外解除');
    if(/(?:第1.*第2|2項目|二項目|両方).*(?:合計|足して|合わせて).*(?:並べ|ソート|優先)/.test(t))add(c,'sum_sort',0.92,'合計ソート ON','合計ソート');

    // 保存・共有・復元。
    if(/(?:これ|今の|この編成|この組み合わせ).*(?:覚え|保存|取っと)|(?:覚え|保存).*(?:これ|今の|編成)/.test(t))add(c,'save',0.96,'編成を保存して','編成保存');
    if(/(?:保存|覚えてる).*(?:一覧|見せ|何がある|教えて)|保存した(?:やつ|の)/.test(t))add(c,'saved_list',0.93,'保存編成一覧を見せて','保存一覧');
    if(/^(?:共有リンク|共有URL|リンク|URL)$/.test(t)||/(?:リンク|URL|共有).*(?:作|ちょうだい|欲しい|ほしい|出して)|(?:人に|友達に).*(?:送り|共有)/.test(t))add(c,'share',0.97,'共有URLを生成して','共有URL');
    if(/^(?:一つ前|ひとつ前|前の状態|さっきの状態|元に戻して|戻して)$/.test(t))add(c,'undo',0.91,'一つ前に戻して','直前状態へ戻す');
    if(/(?:検索|探すの).*(?:止め|やめ|中止|ストップ)/.test(t))add(c,'cancel',0.97,'検索を中止して','検索中止');
    if(/(?:検索条件|条件).*(?:全部)?(?:消して|リセット|初期化|最初から)/.test(t))add(c,'reset_search',0.96,'検索条件をリセット','検索条件リセット');
    if(/(?:全部|すべて|何もかも).*(?:リセット|初期化|解除)/.test(t))add(c,'reset_all',0.72,'全解除','全解除',{confirm:true,question:'検索条件だけではなく、配置や強化状態も含めて全部リセットする、という意味ですか？'});

    // 画面移動。
    if(/(?:一番上|上の方|ページ上|トップ).*(?:戻|行|移動)|^上(?:へ|いって|戻って)$/.test(t))add(c,'scroll_top',0.96,'ページ上部へ移動','ページ上部');
    if(/(?:検索)?結果.*(?:ところ|とこ|場所|欄).*(?:行|移動|飛|見せ)|結果まで/.test(t))add(c,'scroll_result',0.96,'結果位置へ移動','検索結果位置');

    // 検索ヘルプ・概念質問は操作しない。
    if(/(?:とは|って何|ってなに|意味|教えて).*(?:第1|第2|込み合計|全MAX|文曲|差替)|(?:第1|第2|込み合計|全MAX|文曲|差替).*(?:とは|何|なに|意味)/.test(t))return null;
    if(/今日は|天気|雑談|ありがとう|ありがと|こんにちは|こんばんは|おはよう/.test(t)&&!hasEntities)return null;

    c.sort(function(a,b){return b.score-a.score;});if(!c.length)return null;
    var best=c[0],second=c[1];
    if(second&&Math.abs(best.score-second.score)<0.055&&best.canonical!==second.canonical){
      return {decision:'clarify',confidence:best.score,question:'「'+best.reason+'」と「'+second.reason+'」のどちらの意味に近いですか？ もう少しだけ言葉を足してもらえると確実なのですよ。',candidates:c.slice(0,3),entities:e};
    }
    if(best.clarify)return {decision:'clarify',confidence:best.score,question:best.question,candidates:c.slice(0,3),entities:e};
    if(best.confirm)return {decision:'confirm',confidence:best.score,canonical:best.canonical,question:best.question,candidates:c.slice(0,3),entities:e};
    if(best.score<0.68)return null;
    if(best.score<0.86)return {decision:'confirm',confidence:best.score,canonical:best.canonical,question:'「'+best.reason+'」として進めてよろしいですか？',candidates:c.slice(0,3),entities:e};
    return {decision:'execute',confidence:best.score,canonical:best.canonical,note:'「'+best.reason+'」として補完しました。',candidates:c.slice(0,3),entities:e};
  }

  function remember(info){
    info=info||{};var p=info.plan||{},m=loadMemory(),sp=p.searchPatch||{};
    m.lastIntent=p.recommendStat?'recommended':sp?'search':m.lastIntent;
    if(sp.formation)m.lastFormation=sp.formation;if(sp.count)m.lastCount=sp.count;
    if(sp.priority1&&sp.priority1.stat)m.lastStat=sp.priority1.stat;if(sp.priority2&&sp.priority2.stat)m.lastStat=sp.priority2.stat;
    (p.actions||[]).forEach(function(a){var x=a.args||{};m.lastIntent=a.name||m.lastIntent;if((a.name==='set_owned_hero'||a.name==='set_owned_hero_auto'||a.name==='set_excluded_hero')&&x.hero)m.lastHero=x.hero;if(a.name==='apply_result')m.lastRank=x.rank;if(a.name==='apply_swap')m.lastSwapRank=x.rank;if(a.name==='panel_max'||a.name==='panel_clear')m.lastPanel=x.panel;});
    m.lastCanonical=String(info.corrected||info.canonical||'');m.lastOriginal=String(info.original||'');m.lastReference=info.lastReference&&info.lastReference.type||'';saveMemory(m);return m;
  }

  var lexiconCount=STATS.reduce(function(n,x){return n+x.a.length;},0)+FORMS.reduce(function(n,x){return n+x.a.length;},0)+PANELS.reduce(function(n,x){return n+x.a.length;},0)+SEARCH_WORDS.length+APPLY_WORDS.length+INCLUDE_WORDS.length+EXCLUDE_WORDS.length+JOBS.length;
  window.JINPO_BOT_NLU={version:VERSION,infer:infer,remember:remember,getMemory:loadMemory,clearMemory:clearMemory,compact:compact,lexiconCount:lexiconCount,intentCount:42,debugExtract:function(t){return {clean:removeFillers(t),stats:extractStats(t),formation:extractFormation(t),count:extractCount(t),range:extractRange(t),basis:basis(t)};}};
})();
