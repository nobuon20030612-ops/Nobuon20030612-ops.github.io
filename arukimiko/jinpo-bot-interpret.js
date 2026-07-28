(function(){
  'use strict';
  if(window.JINPO_BOT_INTERPRETER) return;

  var VERSION='2.0.0';
  var PENDING_KEY='jinpo_local_bot_pending_interpret_v1';
  var PENDING_TTL=5*60*1000;

  var DIRECT=[
    {to:'腕力',aliases:['わんりょく','ワンリョク','わんりよく','腕りょく','うでりょく']},
    {to:'生命',aliases:['せいめい','セイメイ','生命力']},
    {to:'気合',aliases:['きあい','キアイ','気合い']},
    {to:'耐久力',aliases:['たいきゅう','タイキュウ','たいきゆう','耐久りょく']},
    {to:'器用さ',aliases:['きようさ','キヨウサ','きよう','キヨウ']},
    {to:'知力',aliases:['ちりょく','チリョク','ちりよく']},
    {to:'魅力',aliases:['みりょく','ミリョク','みりよく']},
    {to:'土属性',aliases:['つちぞくせい','土ぞくせい']},
    {to:'水属性',aliases:['みずぞくせい','水ぞくせい']},
    {to:'火属性',aliases:['ひぞくせい','火ぞくせい']},
    {to:'風属性',aliases:['かぜぞくせい','風ぞくせい']},
    {to:'鶴翼',aliases:['かくよく','カクヨク']},
    {to:'方円',aliases:['ほうえん','ホウエン']},
    {to:'魚鱗',aliases:['ぎょりん','ギョリン','ぎよりん']},
    {to:'衡軛',aliases:['こうやく','コウヤク','鴻鵠','衝軛']},
    {to:'検索',aliases:['けんさく','ケンサク']},
    {to:'適用',aliases:['てきよう','テキヨウ']},
    {to:'差替',aliases:['差し替え','差替え','さしかえ','サシカエ']},
    {to:'解除',aliases:['かいじょ','カイジョ']},
    {to:'見聞録',aliases:['けんぶんろく','ケンブンロク']},
    {to:'鬼神石',aliases:['きしんせき','キシンセキ']},
    {to:'転生',aliases:['てんせい','テンセイ']},
    {to:'文曲',aliases:['ぶんきょく','ブンキョク']},
    {to:'因縁',aliases:['いんねん','インネン']},
    {to:'全MAX',aliases:['ぜんまっくす','ゼンマックス','全マックス']}
  ];

  var FUZZY=[
    {to:'腕力',aliases:['わんりょく'],kind:'stat'},
    {to:'生命',aliases:['せいめい'],kind:'stat'},
    {to:'気合',aliases:['きあい'],kind:'stat'},
    {to:'耐久力',aliases:['たいきゅう'],kind:'stat'},
    {to:'器用さ',aliases:['きようさ','きよう'],kind:'stat'},
    {to:'知力',aliases:['ちりょく'],kind:'stat'},
    {to:'魅力',aliases:['みりょく'],kind:'stat'},
    {to:'土属性',aliases:['つちぞくせい'],kind:'stat'},
    {to:'水属性',aliases:['みずぞくせい'],kind:'stat'},
    {to:'火属性',aliases:['ひぞくせい'],kind:'stat'},
    {to:'風属性',aliases:['かぜぞくせい'],kind:'stat'},
    {to:'鶴翼',aliases:['かくよく'],kind:'formation'},
    {to:'方円',aliases:['ほうえん'],kind:'formation'},
    {to:'魚鱗',aliases:['ぎょりん'],kind:'formation'},
    {to:'衡軛',aliases:['こうやく'],kind:'formation'},
    {to:'検索',aliases:['けんさく'],kind:'command'},
    {to:'適用',aliases:['てきよう'],kind:'command'},
    {to:'差替',aliases:['さしかえ'],kind:'command'},
    {to:'解除',aliases:['かいじょ'],kind:'command'},
    {to:'見聞録',aliases:['けんぶんろく'],kind:'command'},
    {to:'鬼神石',aliases:['きしんせき'],kind:'command'},
    {to:'転生',aliases:['てんせい'],kind:'command'},
    {to:'文曲',aliases:['ぶんきょく'],kind:'command'},
    {to:'因縁',aliases:['いんねん'],kind:'command'}
  ];

  function str(v){return String(v==null?'':v);}
  function nfkc(v){try{return str(v).normalize('NFKC');}catch(e){return str(v);}}
  function hira(v){return nfkc(v).replace(/[ァ-ヶ]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0x60);});}
  function compact(v){return hira(v).toLowerCase().replace(/[\s　、。,.!！?？「」『』（）()・ー~〜～]/g,'');}
  function esc(v){return str(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function levenshtein(a,b){
    a=Array.from(compact(a));b=Array.from(compact(b));var n=a.length,m=b.length;if(!n)return m;if(!m)return n;
    var prev=new Array(m+1),cur=new Array(m+1);for(var j=0;j<=m;j++)prev[j]=j;
    for(var i=1;i<=n;i++){cur[0]=i;for(j=1;j<=m;j++){var cost=a[i-1]===b[j-1]?0:1;cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+cost);}var tmp=prev;prev=cur;cur=tmp;}return prev[m];
  }
  function replaceAllLiteral(text,from,to){return str(text).replace(new RegExp(esc(from),'g'),to);}
  function alreadyCanonical(text,to){return text.indexOf(to)>=0;}
  function directNormalize(input){
    var out=nfkc(input),corrections=[];
    DIRECT.forEach(function(item){item.aliases.forEach(function(alias){if(alias===item.to)return;if(out.indexOf(alias)>=0){out=replaceAllLiteral(out,alias,item.to);corrections.push({from:alias,to:item.to,kind:'alias',confidence:0.98});}});});
    return {text:out,corrections:corrections};
  }
  function contextAllows(kind,text){
    if(kind==='stat')return /優先|第\s*[12]|第一|第二|高|低|因縁|検索|おすすめ|ソート|見聞録|鬼神石|合計|以上|以下/.test(text);
    if(kind==='formation')return /因縁|陣形|検索|だけ|おすすめ|[5-9]/.test(text)||text.length<=8;
    if(kind==='command')return /して|してる|お願い|開|見せ|教|結果|候補|編成|英傑|MAX|max|[0-9]/i.test(text);
    return true;
  }
  function bestApproxSubstring(text,needle){
    var raw=compact(text),target=compact(needle);if(!raw||!target||target.length<3)return null;
    var best=null,minLen=Math.max(2,target.length-1),maxLen=Math.min(raw.length,target.length+1);
    for(var len=minLen;len<=maxLen;len++)for(var i=0;i+len<=raw.length;i++){
      var sub=raw.slice(i,i+len),d=levenshtein(sub,target),score=1-d/Math.max(sub.length,target.length);
      if(!best||score>best.score)best={sub:sub,score:score,distance:d,start:i,len:len};
    }
    return best;
  }
  function findRawApprox(text,sub){
    var t=hira(text),c=compact(sub);if(!c)return'';
    for(var len=Math.max(2,c.length-1);len<=c.length+1;len++)for(var i=0;i+len<=t.length;i++){
      var s=t.slice(i,i+len);if(compact(s)===c)return s;
    }
    return sub;
  }
  function fuzzyNormalize(input){
    var out=input,candidates=[];
    FUZZY.forEach(function(item){if(alreadyCanonical(out,item.to)||!contextAllows(item.kind,out))return;item.aliases.forEach(function(alias){
      var b=bestApproxSubstring(out,alias);if(!b||b.distance===0)return;
      var maxDist=compact(alias).length>=5?2:1;if(b.distance>maxDist||b.score<0.72)return;
      candidates.push({to:item.to,alias:alias,kind:item.kind,score:b.score,distance:b.distance,sub:b.sub});
    });});
    candidates.sort(function(a,b){return b.score-a.score||a.distance-b.distance;});
    var chosen=[],usedTo={};
    for(var i=0;i<candidates.length;i++){
      var c=candidates[i];if(usedTo[c.to])continue;
      var same=candidates.filter(function(x){return x.to!==c.to&&Math.abs(x.score-c.score)<0.035;});
      if(same.length&&c.score<0.86)continue;
      var raw=findRawApprox(out,c.sub);if(raw&&out.indexOf(raw)>=0){out=replaceAllLiteral(out,raw,c.to);chosen.push({from:raw,to:c.to,kind:c.kind,confidence:c.score});usedTo[c.to]=true;}
    }
    return {text:out,corrections:chosen};
  }

  function cleanHeroText(v){return str(v).replace(/^(?:じゃあ|じゃ|それなら|なら|あと|ちなみに|じゃあさ|それじゃ)\s*/,'').replace(/^(?:英傑|キャラ)\s*/,'').trim();}

  function heroCatalog(){
    var list=[];
    function add(name,id){name=str(name).trim();if(!name)return;var key=name+'\u0000'+str(id);if(!list.some(function(x){return x.key===key;}))list.push({key:key,name:name,id:str(id)});}
    try{if(typeof eiketsuMaster!=='undefined'&&Array.isArray(eiketsuMaster))eiketsuMaster.forEach(function(h){add(h&& (h['英傑名']||h['名前']||h.name),h&&(h.internal_id||h.id));});}catch(e){}
    try{if(Array.isArray(window.eiketsuMaster))window.eiketsuMaster.forEach(function(h){add(h&& (h['英傑名']||h['名前']||h.name),h&&(h.internal_id||h.id));});}catch(e){}
    try{Array.prototype.slice.call(document.querySelectorAll('.ownedHeroName')).forEach(function(el){add(el.textContent,'');});}catch(e){}
    try{Array.prototype.slice.call(document.querySelectorAll('[data-jinpo-exclude-id]')).forEach(function(el){var lab=el.closest&&el.closest('label');add(lab&&lab.textContent,el.getAttribute('data-jinpo-exclude-id'));});}catch(e){}
    return list;
  }
  function extractHeroQuery(text){
    var m=text.match(/配置英傑\s*[1-3](?:番|枠)?\s*(?:を|は|に)?\s*(.+?)(?:にして|指定|登録|$)/);if(m)return {value:cleanHeroText(m[1]),mode:'owned'};
    m=text.match(/^(.+?)(?:を|は)?\s*(?:使いたい|使ったのがいい|使うのがいい|使ってほしい|入れたい|入ったのがいい|入りがいい|含めたい|込みがいい|入れて探して|使って探して|必ず入れて|固定したい|固定して|残したい|残して|必須|ありで|込みで探して|入れて|使って|使おう|入れよう|固定|がいい|が良い|にしたい)(?:な|ね|です|ですよ|よ|。|！|!)*$/);if(m)return {value:cleanHeroText(m[1]),mode:'owned'};
    m=text.match(/^(.+?)(?:を|は)?\s*(?:持ってない|もってない|持っていない|もっていない|持ってません|もってません|持ってへん|所持してない|所持していない|所持なし|未所持|いない|居ない|手持ちにない|手持ちじゃない)(?:んだ|んだよね|です|ですよ|よ|な|ね|。|！|!)*$/);if(m)return {value:cleanHeroText(m[1]),mode:'excluded'};
    m=text.match(/^(.+?)(?:を|は)?\s*(?:除外(?:して|する)?|外して|外したい|抜いて|抜きで|抜き|なしで|無しで|なし|無し|使わない|いらない|不要|候補から外して|候補に出さない)(?:な|ね|です|よ|。|！|!)*$/);if(m&&!/除外英傑/.test(m[1]))return {value:cleanHeroText(m[1]),mode:'excluded'};
    return null;
  }
  function fuzzyHero(input){
    var q=extractHeroQuery(input);if(!q||!q.value||/^EIK_/i.test(q.value))return null;var cat=heroCatalog();if(!cat.length)return null;
    var nq=compact(q.value),scored=[];cat.forEach(function(h){var nh=compact(h.name);if(!nh)return;if(nh===nq){scored.push({hero:h,score:1,distance:0});return;}if(nq&&nh.indexOf(nq)>=0){scored.push({hero:h,score:0.96,distance:Math.max(0,nh.length-nq.length),partial:true});return;}var d=levenshtein(nq,nh),score=1-d/Math.max(nq.length,nh.length);if(score>=0.67&&d<=Math.max(1,Math.floor(nh.length/3)))scored.push({hero:h,score:score,distance:d});});
    scored.sort(function(a,b){return b.score-a.score||a.distance-b.distance;});if(!scored.length)return null;
    if(scored[1]&&scored[1].hero.name!==scored[0].hero.name&&Math.abs(scored[0].score-scored[1].score)<0.06)return {ambiguous:true,query:q.value,candidates:scored.slice(0,3).map(function(x){return x.hero.name;})};
    var best=scored[0];return {query:q.value,to:best.hero.name,confidence:best.score,mode:q.mode};
  }

  function planSummary(plan){
    if(!plan)return'';var bits=[],p=plan.searchPatch||{};
    if(p.formation)bits.push('陣形を'+p.formation);if(p.count)bits.push(p.count+'因縁');
    if(p.priority1){if(p.priority1.clear)bits.push('第1優先を解除');else if(p.priority1.stat)bits.push('第1優先を'+p.priority1.stat);}
    if(p.priority2){if(p.priority2.clear)bits.push('第2優先を解除');else if(p.priority2.stat)bits.push('第2優先を'+p.priority2.stat);}
    if(p.factor4Exclude!==undefined)bits.push('文曲除外'+p.factor4Exclude+'人');
    if(plan.recommendStat)bits.push(plan.recommendStat+'優先のおすすめ検索');
    (plan.actions||[]).forEach(function(a){var x=a.args||{};if(a.name==='apply_result')bits.push('検索結果の'+x.rank+'番目を適用');else if(a.name==='apply_swap')bits.push('差替候補の'+x.rank+'番目を適用');else if(a.name==='set_owned_hero')bits.push('配置英傑'+x.slot+'を'+x.hero+'に指定');else if(a.name==='set_owned_hero_auto')bits.push(x.hero+'を使う条件に追加');else if(a.name==='set_excluded_hero')bits.push(x.hero+'を'+(x.excluded===false?'除外解除':'除外'));else if(a.name==='all_max')bits.push('全MAXを実行');else if(a.name==='clear_all_max')bits.push('全MAXを解除');});
    return bits.join('、');
  }
  function riskyPlan(plan){return !!(plan&&plan.actions&&plan.actions.some(function(a){return ['delete_saved','reset_all','clear_formation_master','import_json','apply_override_bond_master'].indexOf(a.name)>=0;}));}
  function planCoverage(plan){
    if(!plan)return 0;var n=plan.recognized?0.25:0,p=plan.searchPatch||{};
    if(p.formation)n+=1;if(p.count)n+=1;if(p.searchBasis)n+=1;if(p.priority1)n+=1;if(p.priority2)n+=1;
    if(p.grade3!==undefined)n+=0.5;if(p.factor4Exclude!==undefined)n+=0.5;if(p.sumSort!==undefined)n+=0.5;
    if(plan.recommendStat)n+=1.5;n+=(plan.actions||[]).length*1.1;return n;
  }

  function analyze(input,context){
    var original=nfkc(input),semantic=null,semanticNote='';

    function normalizeAndParse(source,useCasual){
      var casual={text:source,changed:false};
      if(useCasual!==false){try{if(window.JINPO_BOT_CASUAL&&typeof window.JINPO_BOT_CASUAL.rewrite==='function')casual=window.JINPO_BOT_CASUAL.rewrite(source,context)||casual;}catch(e){}}
      var d=directNormalize(casual.text||source),f=fuzzyNormalize(d.text),corrected=f.text,corrections=d.corrections.concat(f.corrections),hero=fuzzyHero(corrected);
      if(hero&&hero.ambiguous)return {ambiguous:hero,corrected:corrected,corrections:corrections,plan:null};
      if(hero&&hero.to){
        corrected=hero.mode==='owned'?(hero.to+'を使いたい'):(hero.to+'を除外して');
        if(hero.query!==hero.to)corrections.push({from:hero.query,to:hero.to,kind:'hero',confidence:hero.confidence});
      }
      var parser=window.JINPO_BOT_PARSER,plan=parser&&typeof parser.parse==='function'?parser.parse(corrected):null;
      return {corrected:corrected,corrections:corrections,plan:plan,hero:hero};
    }

    var resolved=normalizeAndParse(original,true);
    if(resolved.ambiguous)return {decision:'clarify',original:original,correctedText:resolved.corrected,corrections:resolved.corrections,question:'「'+resolved.ambiguous.query+'」に近い英傑が複数あります。'+resolved.ambiguous.candidates.join(' / ')+' のどれですか？'};

    // 意味推定層は常に候補を作るが、既存Parserより具体的な条件を補完できる場合だけ採用する。
    // 例: 「鶴の8で力高め」で既存Parserが8因縁+腕力まで読めた場合も、NLUが鶴翼まで補えるなら採用する。
    if(window.JINPO_BOT_NLU&&typeof window.JINPO_BOT_NLU.infer==='function'){
      try{semantic=window.JINPO_BOT_NLU.infer(original,context)||null;}catch(e){semantic=null;}
      if(semantic&&semantic.canonical){
        var semResolved=normalizeAndParse(semantic.canonical,false);
        if(semResolved.ambiguous)return {decision:'clarify',original:original,correctedText:semResolved.corrected,corrections:semResolved.corrections,question:'「'+semResolved.ambiguous.query+'」に近い英傑が複数あります。'+semResolved.ambiguous.candidates.join(' / ')+' のどれですか？',semantic:semantic};
        var useSemantic=(!resolved.plan||!resolved.plan.recognized)||planCoverage(semResolved.plan)>planCoverage(resolved.plan)+0.20;
        if(useSemantic){
          semResolved.corrections.unshift({from:original,to:semantic.canonical,kind:'semantic',confidence:Number(semantic.confidence)||0.8});
          resolved=semResolved;semanticNote=semantic.note||'';
          if(semantic.decision==='confirm')return {decision:'confirm',original:original,correctedText:resolved.corrected,corrections:resolved.corrections,confidence:Number(semantic.confidence)||0.8,question:semantic.question||'この解釈で進めますか？',plan:resolved.plan,semantic:semantic};
        }
      }else if(semantic&&semantic.decision==='clarify'&&(!resolved.plan||!resolved.plan.recognized)){
        return {decision:'clarify',original:original,correctedText:original,corrections:[],confidence:semantic.confidence||0,question:semantic.question,semantic:semantic};
      }
    }

    var corrected=resolved.corrected,corrections=resolved.corrections||[],plan=resolved.plan;
    var ref=context&&context.lastReference;var cm=compact(corrected);
    if(/^[0-9]{1,2}$/.test(cm)&&ref&&(ref.type==='result'||ref.type==='swap')){
      var n=Number(cm);if(n>=1){corrected=(ref.type==='swap'?'差替候補':'検索結果')+n+'番目を適用';corrections.push({from:original,to:corrected,kind:'context',confidence:0.78});var parser2=window.JINPO_BOT_PARSER;plan=parser2&&parser2.parse?parser2.parse(corrected):plan;}
    }
    var site=context&&context.siteState||{};
    var vague=corrected.match(/(生命|気合|腕力|耐久力|器用さ|知力|魅力|土属性|水属性|火属性|風属性).*(?:もっと|上げて|高くして)$/);
    if(vague&&!/[0-9]/.test(corrected))return {decision:'clarify',original:original,correctedText:corrected,corrections:corrections,question:(site.priority1===vague[1]?'第1優先の'+vague[1]:'「'+vague[1]+'」')+'の条件を上げる、という意味でしょうか？ 上げたい数値も指定してください（例：'+vague[1]+'1000以上）。'};

    var min=1;corrections.forEach(function(c){min=Math.min(min,Number(c.confidence)||0);});
    if(!corrections.length)return {decision:'execute',original:original,correctedText:corrected,corrections:[],confidence:1,plan:plan};
    var summary=planSummary(plan),mustConfirm=min<0.90||corrections.some(function(c){return (c.kind==='hero'&&Number(c.confidence)<0.94)||c.kind==='context';})||riskyPlan(plan);
    // NLUが高確信で補完した場合は、単なる言い換えだけを理由に聞き返さない。
    if(plan&&!plan.recognized&&min<0.95)mustConfirm=true;
    var note=corrections.map(function(c){return '「'+c.from+'」→「'+c.to+'」';}).join('、');
    if(mustConfirm){var q=summary?'「'+summary+'」ということでよろしいですか？':'入力は '+note+' の意味でしょうか？';return {decision:'confirm',original:original,correctedText:corrected,corrections:corrections,confidence:min,question:q,plan:plan,semantic:semantic};}
    return {decision:'execute',original:original,correctedText:corrected,corrections:corrections,confidence:min,note:semanticNote||(note+' と解釈しました。'),plan:plan,semantic:semantic};
  }

  function savePending(v){try{localStorage.setItem(PENDING_KEY,JSON.stringify(Object.assign({},v,{at:Date.now()})));return true;}catch(e){return false;}}
  function getPending(){try{var raw=localStorage.getItem(PENDING_KEY);if(!raw)return null;var v=JSON.parse(raw);if(!v||Date.now()-Number(v.at||0)>PENDING_TTL){clearPending();return null;}return v;}catch(e){return null;}}
  function clearPending(){try{localStorage.removeItem(PENDING_KEY);}catch(e){}}
  function isYes(v){return /^(?:はい|うん|そう|そうです|それで|それでお願い|お願い|お願いします|ok|okay|ＯＫ|その通り|あってる|合ってる)[!！。\s]*$/i.test(nfkc(v).trim());}
  function isNo(v){return /^(?:いいえ|いや|違う|ちがう|違います|ちがいます|やめ|やめて|キャンセル|取消|取り消し)[!！。\s]*$/i.test(nfkc(v).trim());}

  window.JINPO_BOT_INTERPRETER={version:VERSION,analyze:analyze,savePending:savePending,getPending:getPending,clearPending:clearPending,isYes:isYes,isNo:isNo,levenshtein:levenshtein,compact:compact};
})();
