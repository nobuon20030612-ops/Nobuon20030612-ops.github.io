/*
 * 歩き巫女 英傑マスター質問応答 v1.0.0
 * jinpo_eiketsu_master.csv由来の参照専用データだけで回答する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_HERO_KNOWLEDGE)return;

  var VERSION='2.0.0';
  var STAT_ORDER=['生命','気合','腕力','耐久力','器用さ','知力','魅力','土属性','水属性','火属性','風属性'];
  var STAT_ALIASES=[
    {to:'生命',a:['生命力','生命','体力','HP','hp']},
    {to:'気合',a:['気合']},
    {to:'腕力',a:['腕力','腕りょく','わんりょく','わんりく','うでりょく','物理火力','攻撃力']},
    {to:'耐久力',a:['耐久力','耐久りょく','耐久','たいきゅうりょく','たいきゅう','たいきゅ','硬さ','固さ']},
    {to:'器用さ',a:['器用さ','器用','きようさ','きよう']},
    {to:'知力',a:['知力','知りょく','ちりょく','ちりょ']},
    {to:'魅力',a:['魅力','みりょく']},
    {to:'土属性',a:['土属性','土']},
    {to:'水属性',a:['水属性','水']},
    {to:'火属性',a:['火属性','火']},
    {to:'風属性',a:['風属性','風']}
  ];
  var JOB_ALIASES={
    '侍':['侍','さむらい'],
    '傾奇者':['傾奇者','かぶきもの','傾奇'],
    '僧':['僧','そう'],
    '忍者':['忍者','忍び','にんじゃ'],
    '神主/巫女':['神主/巫女','神主','巫女','神職'],
    '薬師':['薬師','くすし'],
    '鍛冶屋':['鍛冶屋','鍛冶','かじや'],
    '陰陽師':['陰陽師','おんみょうじ']
  };
  var SKILL_DETAIL_CONCEPTS=[
    {label:'追加行動',aliases:['追加行動','もう一回動く','再行動'],terms:['追加行動']},
    {label:'武装解除',aliases:['武装解除','装備解除'],terms:['武装解除']},
    {label:'回復',aliases:['回復','生命回復','味方を回復'],terms:['回復']},
    {label:'蘇生',aliases:['蘇生','生き返らせる','復活'],terms:['蘇生']},
    {label:'標的固定',aliases:['標的固定','固定する技能','釣る技能'],terms:['標的固定']},
    {label:'行動不能',aliases:['行動不能','動けなくする','しびれ'],terms:['行動不能']},
    {label:'術耐性低下',aliases:['術耐性低下','術耐性を下げる','術耐性ダウン'],terms:['術耐性を低下']},
    {label:'物理耐性低下',aliases:['物理耐性低下','物理耐性を下げる','物理耐性ダウン'],terms:['物理耐性を低下']},
    {label:'敵全体攻撃',aliases:['全体攻撃','敵全体攻撃','全体に攻撃'],terms:['敵全体'],pattern:/敵全体に[^。]{0,80}(?:攻撃|ダメージ)/},
    {label:'敵単体攻撃',aliases:['単体攻撃','敵単体攻撃','単体に攻撃'],terms:['敵単体'],pattern:/敵単体に[^。]{0,80}(?:攻撃|ダメージ)/},
    {label:'生命継続回復',aliases:['生命継続回復','継続回復','リジェネ'],terms:['生命継続回復']},
    {label:'守護',aliases:['守護する','守護技能','守護を持つ'],terms:['守護']}
  ];
  var cache=null;

  function S(v){return String(v==null?'':v).trim();}
  function nfkc(v){var s=S(v);try{s=s.normalize('NFKC');}catch(e){}return s;}
  function hira(v){return nfkc(v).replace(/[ァ-ヶ]/g,function(ch){return String.fromCharCode(ch.charCodeAt(0)-0x60);}).replace(/ヴ/g,'ゔ');}
  function fold(v){return hira(v).toLowerCase().replace(/[\s　、。,.!！?？「」『』【】（）()・〜~ー―…:：;；\[\]／\/_-]/g,'');}
  function esc(v){return S(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function link(){return {label:'英傑一覧を開く',url:'英傑一覧.html'};}

  function data(){
    if(cache)return cache;
    var d=window.JINPO_BOT_HERO_DATA||{},cols=d.columns||[],rows=d.rows||[],idx={};
    cols.forEach(function(c,i){idx[c]=i;});
    var factors=Object.create(null),skills=Object.create(null),names=[];
    var out=rows.map(function(a){
      var r={};cols.forEach(function(c,i){r[c]=a[i];});
      r._fold=fold(r['英傑名']);
      r._stats={};STAT_ORDER.forEach(function(k){r._stats[k]=Number(r[k]||0);});
      ['因子1','因子2','因子3','因子4'].forEach(function(k){var f=S(r[k]);if(f&&f!=='対象外'&&f!=='なし'&&f!=='ー')factors[f]=1;});
      var skill=S(r['技能']);if(skill)skills[skill]=1;
      names.push(r);
      return r;
    });
    names.sort(function(a,b){return b._fold.length-a._fold.length;});
    cache={meta:d,rows:out,names:names,factors:Object.keys(factors).sort(function(a,b){return b.length-a.length;}),skills:Object.keys(skills).sort(function(a,b){return b.length-a.length;})};
    return cache;
  }

  function detectStats(text){
    var t=nfkc(text),out=[];
    STAT_ALIASES.forEach(function(row){
      for(var i=0;i<row.a.length;i++){
        var a=row.a[i];
        if((a==='土'||a==='水'||a==='火'||a==='風')&&!new RegExp('(?:^|[^一-龠ぁ-んァ-ヶ])'+a+'(?:属性|が|は|を|の|で|と|、|,|$)').test(t))continue;
        if(t.indexOf(a)>=0){out.push(row.to);break;}
      }
    });
    return out.filter(function(x,i){return out.indexOf(x)===i;});
  }
  function detectJob(text){
    var t=nfkc(text),best='';
    Object.keys(JOB_ALIASES).forEach(function(job){(JOB_ALIASES[job]||[]).forEach(function(a){if(t.indexOf(a)>=0&&a.length>best.length)best=job;});});
    return best;
  }
  function detectCost(text){var m=nfkc(text).match(/(?:コスト|コスと|こすと)\s*([4-8])/);return m?Number(m[1]):0;}
  function detectFactors(text){var t=nfkc(text),d=data(),out=[];d.factors.forEach(function(f){if(t.indexOf(f)>=0)out.push(f);});return out;}
  function detectFactorSlots(text){
    var t=nfkc(text),out=[];
    data().factors.forEach(function(f){
      for(var n=1;n<=4;n++){
        var a=new RegExp('因子\s*'+n+'(?:が|は|に|で|:|：)?[^、。]{0,12}'+esc(f));
        var b=new RegExp(esc(f)+'[^、。]{0,12}因子\s*'+n);
        if(a.test(t)||b.test(t)){out.push({slot:n,factor:f});break;}
      }
    });
    return out;
  }
  function detectSkill(text){var t=nfkc(text),hit='';data().skills.forEach(function(skill){if(!hit&&t.indexOf(skill)>=0)hit=skill;});return hit;}
  function detectSkillConcepts(text){
    var t=nfkc(text),out=[];
    SKILL_DETAIL_CONCEPTS.forEach(function(c){
      for(var i=0;i<c.aliases.length;i++)if(t.indexOf(c.aliases[i])>=0){out.push(c);break;}
    });
    return out;
  }
  function validSkill(r){var v=S(r['技能']);return !!(v&&v!=='対象外'&&v!=='なし');}
  function detailMatches(r,concept){var d=S(r['詳細']);if(concept.pattern)return concept.pattern.test(d);return concept.terms.some(function(term){return d.indexOf(term)>=0;});}
  function detectFactorCount(text){
    var t=nfkc(text),m=t.match(/因子(?:を|が)?\s*([234])\s*(?:個|つ|種類)(?:持ち|持って|ある|の)?/);
    if(!m)m=t.match(/([234])\s*(?:個|つ|種類)\s*の?因子(?:持ち|を持つ|がある)?/);
    return m?Number(m[1]):0;
  }
  function rowFactors(r){return ['因子1','因子2','因子3','因子4'].map(function(k){return S(r[k]);}).filter(function(x){return x&&x!=='対象外'&&x!=='なし'&&x!=='ー';});}

  function exactNamedRows(text){
    var remaining=fold(text),d=data(),hits=[];
    d.names.forEach(function(r){
      if(!r._fold)return;
      var at=remaining.indexOf(r._fold);
      if(at<0)return;
      hits.push({row:r,at:at});
      remaining=remaining.slice(0,at)+new Array(r._fold.length+1).join('　')+remaining.slice(at+r._fold.length);
    });
    hits.sort(function(a,b){return a.at-b.at;});
    return hits.map(function(x){return x.row;});
  }
  function distance(a,b){
    a=fold(a);b=fold(b);var n=a.length,m=b.length;if(!n)return m;if(!m)return n;
    var prev=[],cur=[],i,j;for(j=0;j<=m;j++)prev[j]=j;
    for(i=1;i<=n;i++){
      cur[0]=i;
      for(j=1;j<=m;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1));
      var tmp=prev;prev=cur;cur=tmp;
    }
    return prev[m];
  }
  function candidateName(text){
    var t=nfkc(text).replace(/^(?:じゃあ|では|なら|ちなみに|ところで|えっと|あの)[、,\s]*/,'');
    var m=t.match(/^(.+?)(?:の|って|は|を|よりも?|に比べて)?(?:生命|気合|腕力|腕りょく|わんりょく|うでりょく|耐久力?|耐久りょく|たいきゅう|器用さ?|きようさ?|知力|知りょく|ちりょく|魅力|みりょく|土属性|水属性|火属性|風属性|能力|ステータス|因子|職業|コスト|技能|詳細|どんな英傑|どんな人|どんなやつ|強み|つよみ|弱み|よわみ|得意|とくい|苦手|にがて|順位|何位|上位互換|下位互換|完全上位|完全下位)/);
    if(!m)return'';
    var q=S(m[1]).replace(/^(?:英傑|武将|キャラ)[の ]*/,'').replace(/[「」『』]/g,'');
    if(!q||/^(?:英傑|武将|キャラ|誰|だれ|どれ|一番|最も|トップ|上位|下位|高い|低い|平均|平均値|中央値|全体|全部|全能力)$/.test(q))return'';
    if(detectStats(q).length||detectJob(q)||detectCost(q)||detectFactors(q).length||detectSkill(q)||/コスト|因子|職業|技能|持ち|英傑|武将|キャラ|高い|低い|トップ|上位|下位|ランキング|誰|だれ|どれ|以上|以下|未満|超|MAX|マックス|込み|多い|多く/.test(q))return'';
    if(q.length<2||q.length>24)return'';
    return q;
  }
  function fuzzyName(text){
    var q=candidateName(text);if(!q)return null;
    var fq=fold(q),hits=[];
    data().rows.forEach(function(r){
      var maxLen=Math.max(fq.length,r._fold.length),lim=maxLen>=8?2:(maxLen>=5?2:1);
      var dist=distance(fq,r._fold);
      if(dist<=lim)hits.push({row:r,dist:dist});
    });
    hits.sort(function(a,b){return a.dist-b.dist||a.row._fold.length-b.row._fold.length;});
    if(!hits.length)return {query:q,notFound:true,candidates:[]};
    var best=hits[0].dist,same=hits.filter(function(x){return x.dist===best;});
    if(same.length===1)return {query:q,row:same[0].row,corrected:S(same[0].row['英傑名'])!==q};
    return {query:q,ambiguous:true,candidates:same.slice(0,6).map(function(x){return x.row['英傑名'];})};
  }
  function fuzzyRowFromFragment(fragment){
    var q=S(fragment).replace(/^(?:英傑|武将|キャラ)[の ]*/,'').replace(/[「」『』]/g,'').replace(/(?:について|って|は|の)$/,'').trim();
    if(!q||q.length<2||q.length>24)return null;
    var fq=fold(q),hits=[];
    data().rows.forEach(function(r){
      if(r._fold===fq){hits=[{row:r,dist:0}];return;}
      var maxLen=Math.max(fq.length,r._fold.length),lim=maxLen>=8?2:(maxLen>=5?2:1),dist=distance(fq,r._fold);
      if(dist<=lim)hits.push({row:r,dist:dist});
    });
    hits.sort(function(a,b){return a.dist-b.dist||a.row._fold.length-b.row._fold.length;});
    if(!hits.length)return null;
    var best=hits[0].dist,same=hits.filter(function(x){return x.dist===best;});
    if(same.length===1)return {query:q,row:same[0].row,corrected:best>0||S(same[0].row['英傑名'])!==q};
    return {query:q,ambiguous:true,candidates:same.slice(0,6).map(function(x){return x.row['英傑名'];})};
  }
  function augmentComparisonNames(text,named){
    var t=nfkc(text),out=[],corrections=[],ambiguous=null;
    if(!/(?:と|対|vs|VS|、|,).*(?:違い|共通|比較|比べ|どっち|どちら|能力|ステータス|高い|低い)/.test(t))return {rows:named,corrections:corrections};
    var head=t.split(/(?:の)?(?:違い|共通因子|共通の因子|比較|比べ|どっち|どちら|能力|ステータス|高い方|低い方|高い|低い)/)[0];
    var parts=head.split(/(?:\s*(?:と|対|vs|VS|、|,)\s*)/).filter(Boolean);
    parts.forEach(function(part){
      var exact=exactNamedRows(part);
      if(exact.length){exact.forEach(function(r){if(out.indexOf(r)<0)out.push(r);});return;}
      var fr=fuzzyRowFromFragment(part);
      if(fr&&fr.row){if(out.indexOf(fr.row)<0)out.push(fr.row);if(fr.corrected)corrections.push({query:fr.query,name:fr.row['英傑名']});}
      else if(fr&&fr.ambiguous&&!ambiguous)ambiguous=fr;
    });
    named.forEach(function(r){if(out.indexOf(r)<0)out.push(r);});
    return {rows:out,corrections:corrections,ambiguous:ambiguous};
  }

  function latestPairGapContext(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0&&i>=h.length-24;i--){
      var m=h[i]||{},d=(m.meta||{}).data||{};
      if(m.role==='assistant'&&d.heroKnowledge&&d.pairGap&&Array.isArray(d.heroes)&&d.heroes.length>=2)return {heroes:d.heroes.slice(0,2),stats:Array.isArray(d.stats)?d.stats.slice():STAT_ORDER.slice(),percentage:!!d.percentage,smallest:!!d.smallest,sameOnly:!!d.sameOnly};
    }
    return null;
  }
  function cloneList(v){return Array.isArray(v)?v.slice():[];}
  function emptyFilterState(){return {job:'',cost:0,factors:[],factorSlots:[],skill:'',excludedJobs:[],excludedCosts:[],excludedFactors:[],skillPresence:null,thresholds:[]};}
  function cloneFilterState(v){
    v=v||{};return {job:S(v.job),cost:Number(v.cost||0),factors:cloneList(v.factors),factorSlots:cloneList(v.factorSlots).map(function(x){return {slot:Number(x.slot),factor:S(x.factor)};}),skill:S(v.skill),excludedJobs:cloneList(v.excludedJobs),excludedCosts:cloneList(v.excludedCosts).map(Number),excludedFactors:cloneList(v.excludedFactors),skillPresence:v.skillPresence===true?true:(v.skillPresence===false?false:null),thresholds:cloneList(v.thresholds).map(function(x){return {stat:S(x.stat),value:Number(x.value),op:S(x.op)};})};
  }
  function uniqueList(v){var out=[];(v||[]).forEach(function(x){if(out.indexOf(x)<0)out.push(x);});return out;}
  function mergeFilterState(base,add){
    var out=cloneFilterState(base),a=cloneFilterState(add);
    if(a.job)out.job=a.job;if(a.cost)out.cost=a.cost;if(a.skill)out.skill=a.skill;
    out.factors=uniqueList(out.factors.concat(a.factors));
    a.factorSlots.forEach(function(x){out.factorSlots=out.factorSlots.filter(function(y){return y.slot!==x.slot;});out.factorSlots.push(x);});
    out.excludedJobs=uniqueList(out.excludedJobs.concat(a.excludedJobs));out.excludedCosts=uniqueList(out.excludedCosts.concat(a.excludedCosts));out.excludedFactors=uniqueList(out.excludedFactors.concat(a.excludedFactors));
    if(a.skillPresence!==null)out.skillPresence=a.skillPresence;
    a.thresholds.forEach(function(x){out.thresholds=out.thresholds.filter(function(y){return y.stat!==x.stat;});out.thresholds.push(x);});
    return out;
  }
  function filterStateFromRowsFilter(f){return cloneFilterState({job:f.job,cost:f.cost,factors:f.factors,factorSlots:f.factorSlots,skill:f.skill,excludedJobs:f.excludedJobs,excludedCosts:f.excludedCosts,excludedFactors:f.excludedFactors,skillPresence:f.skillPresence,thresholds:f.thresholds});}
  function applyFilterState(rows,state){
    var s=cloneFilterState(state),out=(rows||[]).slice();
    if(s.job)out=out.filter(function(r){return S(r['職業'])===s.job;});
    if(s.cost)out=out.filter(function(r){return Number(r['コスト'])===s.cost;});
    if(s.factors.length)out=out.filter(function(r){var rf=rowFactors(r);return s.factors.every(function(f){return rf.indexOf(f)>=0;});});
    if(s.factorSlots.length)out=out.filter(function(r){return s.factorSlots.every(function(x){return S(r['因子'+x.slot])===x.factor;});});
    if(s.skill)out=out.filter(function(r){return S(r['技能'])===s.skill;});
    if(s.excludedJobs.length)out=out.filter(function(r){return s.excludedJobs.indexOf(S(r['職業']))<0;});
    if(s.excludedCosts.length)out=out.filter(function(r){return s.excludedCosts.indexOf(Number(r['コスト']))<0;});
    if(s.excludedFactors.length)out=out.filter(function(r){var rf=rowFactors(r);return s.excludedFactors.every(function(f){return rf.indexOf(f)<0;});});
    if(s.skillPresence!==null)out=out.filter(function(r){return validSkill(r)===s.skillPresence;});
    if(s.thresholds.length)out=out.filter(function(r){return matchesThreshold(r,s.thresholds);});
    return out;
  }
  function cloneRefinementSnapshot(v){v=v||{};return {filters:cloneFilterState(v.filters),sortStats:cloneList(v.sortStats),sortLow:!!v.sortLow};}
  function cloneRefinementStack(v){return cloneList(v).map(cloneRefinementSnapshot).slice(-8);}
  function cleanSavedViewName(v){return nfkc(v).replace(/^[「『【"']+|[」』】"']+$/g,'').replace(/(?:として|という名前|という名|の結果|の候補)$/g,'').trim().slice(0,16);}
  function cloneSavedView(v){v=v||{};var active=cloneList(v.activeCandidates),root=cloneList(v.rootCandidates);if(!root.length)root=active.slice();return {name:cleanSavedViewName(v.name),rootCandidates:root,snapshot:cloneRefinementSnapshot(v.snapshot),activeCandidates:active,displayFilters:cloneFilterState(v.displayFilters||v.snapshot&&v.snapshot.filters),displaySortStats:cloneList(v.displaySortStats||v.snapshot&&v.snapshot.sortStats),displaySortLow:v.displaySortLow===undefined?!!(v.snapshot&&v.snapshot.sortLow):!!v.displaySortLow,count:Number(v.count||active.length||0)};}
  function cloneSavedViews(v){var out=[];cloneList(v).forEach(function(x){var c=cloneSavedView(x);if(!c.name||!c.rootCandidates.length)return;out=out.filter(function(y){return y.name!==c.name;});out.push(c);});return out.slice(-6);}
  function refinementSnapshot(v){return cloneRefinementSnapshot(v);}
  function sameRefinementSnapshot(a,b){return JSON.stringify(refinementSnapshot(a))===JSON.stringify(refinementSnapshot(b));}
  function latestHeroRefinementContext(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0&&i>=h.length-28;i--){
      var m=h[i]||{},d=(m.meta||{}).data||{},x=d.heroRefinement;
      if(m.role==='assistant'&&d.heroKnowledge&&x&&Array.isArray(x.rootCandidates)&&x.rootCandidates.length){return {rootCandidates:x.rootCandidates.slice(),activeCandidates:cloneList(x.activeCandidates),filters:cloneFilterState(x.filters),sortStats:cloneList(x.sortStats),sortLow:!!x.sortLow,undoStack:cloneRefinementStack(x.undoStack),redoStack:cloneRefinementStack(x.redoStack),savedViews:cloneSavedViews(x.savedViews)};}
    }
    return null;
  }
  function refinementDiff(before,after){
    var b=cloneList(before),a=cloneList(after),bm=Object.create(null),am=Object.create(null);b.forEach(function(x){bm[x]=1;});a.forEach(function(x){am[x]=1;});
    return {before:b,after:a,added:a.filter(function(x){return !bm[x];}),removed:b.filter(function(x){return !am[x];})};
  }
  function refinementData(rootNames,activeRows,filters,sortStats,sortLow,undoStack,redoStack,savedViews){return {rootCandidates:cloneList(rootNames),activeCandidates:(activeRows||[]).map(function(r){return r['英傑名'];}),filters:cloneFilterState(filters),sortStats:cloneList(sortStats),sortLow:!!sortLow,undoStack:cloneRefinementStack(undoStack),redoStack:cloneRefinementStack(redoStack),savedViews:cloneSavedViews(savedViews)};}
  function attachRefinementMeta(meta,f,activeRows,sortStats,sortLow,prior){
    meta=meta||{};var current=filterStateFromRowsFilter(f||{}),filters=prior?mergeFilterState(prior.filters,current):current,rootNames,undo=[],redo=[];
    if(prior&&prior.rootCandidates&&prior.rootCandidates.length)rootNames=prior.rootCandidates.slice();
    else if(f&&f.scopeNames&&f.scopeNames.length)rootNames=f.scopeNames.slice();
    else rootNames=(activeRows||[]).map(function(r){return r['英傑名'];});
    if(prior){undo=cloneRefinementStack(prior.undoStack);if(!sameRefinementSnapshot(prior,{filters:filters,sortStats:sortStats,sortLow:sortLow}))undo.push(refinementSnapshot(prior));undo=undo.slice(-8);}
    meta.filters=cloneFilterState(filters);meta.heroRefinement=refinementData(rootNames,activeRows,filters,sortStats,sortLow,undo,redo,prior&&prior.savedViews);
    if(prior){var diff=refinementDiff(prior.activeCandidates,meta.heroRefinement.activeCandidates);meta.heroRefinementChange=diff;meta.previousCandidates=diff.before;meta.addedCandidates=diff.added;meta.removedCandidates=diff.removed;}
    return meta;
  }

  function latestHeroGroupContext(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0&&i>=h.length-28;i--){
      var m=h[i]||{},d=(m.meta||{}).data||{};
      if(m.role!=='assistant'||!d.heroKnowledge||!Array.isArray(d.heroes)||d.heroes.length<3)continue;
      return {heroes:d.heroes.slice(0,12),stats:Array.isArray(d.stats)?d.stats.slice():STAT_ORDER.slice(),perStatLeaders:!!d.perStatLeaders,leaderCounts:!!d.leaderCounts,commonRegistration:!!d.commonRegistration,factorComparison:!!d.factorComparison};
    }
    return null;
  }
  function replacementTargetIndex(text,names){
    var t=nfkc(text),m=t.match(/([1-9])\s*(?:人目|番目)/);if(m){var i=Number(m[1])-1;if(i>=0&&i<names.length)return i;}
    if(/前者|最初|一番上|上の人/.test(t))return 0;if(/後者/.test(t))return 1;if(/最後|一番下/.test(t))return names.length-1;
    var exact=exactNamedRows(t);for(var j=0;j<exact.length;j++){var at=names.indexOf(exact[j]['英傑名']);if(at>=0)return at;}
    return -1;
  }
  function detectGroupReplacement(text,history){
    var t=nfkc(text),group=latestHeroGroupContext(history);if(!group||!/(?:変えて|替えて|入れ替えて|差し替えて|変更して|じゃなくて|ではなく)/.test(t))return null;
    var target=replacementTargetIndex(t,group.heroes),exact=exactNamedRows(t),replacement=null,correction=null,ambiguous=null;
    for(var i=exact.length-1;i>=0;i--)if(group.heroes.indexOf(exact[i]['英傑名'])<0){replacement=exact[i];break;}
    if(!replacement){var frag=replacementFragment(t),fr=frag?fuzzyRowFromFragment(frag):null;if(fr&&fr.row){replacement=fr.row;if(fr.corrected)correction={query:fr.query,name:fr.row['英傑名']};}else if(fr&&fr.ambiguous)ambiguous=fr;}
    if(target<0&&exact.length){for(var j=0;j<exact.length;j++){var idx=group.heroes.indexOf(exact[j]['英傑名']);if(idx>=0){target=idx;break;}}}
    if(ambiguous)return {group:group,ambiguous:ambiguous};
    if(target<0||!replacement)return {group:group,needsClarification:true};
    if(group.heroes[target]===replacement['英傑名'])return {group:group,needsClarification:true,sameTarget:true,heroes:group.heroes.slice(),correction:correction};
    var heroes=group.heroes.slice();heroes[target]=replacement['英傑名'];if(uniqueList(heroes).length!==heroes.length)return {group:group,needsClarification:true,sameHero:true,heroes:heroes};
    return {group:group,target:target,row:replacement,heroes:heroes,correction:correction};
  }

  function latestHeroPairContext(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0&&i>=h.length-24;i--){
      var m=h[i]||{},d=(m.meta||{}).data||{};
      if(m.role!=='assistant'||!d.heroKnowledge||!Array.isArray(d.heroes)||d.heroes.length<2)continue;
      return {
        heroes:d.heroes.slice(0,2),
        stats:Array.isArray(d.stats)?d.stats.slice():[],
        pairGap:!!d.pairGap,
        pairwiseWins:!!d.pairwiseWins,
        fullComparison:!!d.fullComparison,
        comparison:!!d.comparison,
        commonRegistration:!!d.commonRegistration,
        factorComparison:!!d.factorComparison,
        percentage:!!d.percentage,
        smallest:!!d.smallest,
        sameOnly:!!d.sameOnly,
        gapCount:Array.isArray(d.gaps)?d.gaps.length:0
      };
    }
    return null;
  }
  function replacementFragment(text){
    var t=nfkc(text),m=t.match(/(?:前者|後者|1人目|2人目|一人目|二人目)\s*を\s*(.+?)\s*に(?:変えて|替えて|変更して|差し替えて)/);
    if(m)return S(m[1]);
    m=t.match(/(?:じゃなくて|ではなく)\s*(.+?)(?:に)?(?:変えて|替えて|変更して|差し替えて|して)?[？?。]*$/);
    if(m)return S(m[1]);
    m=t.match(/を\s*(.+?)\s*に(?:変えて|替えて|変更して|差し替えて)/);
    return m?S(m[1]):'';
  }
  function detectPairReplacement(text,history){
    var t=nfkc(text),pair=latestHeroPairContext(history);
    if(!pair||!/(?:変えて|替えて|入れ替えて|差し替えて|変更して|じゃなくて|ではなく)/.test(t))return null;
    var exact=exactNamedRows(t),target=-1,replacement=null,correction=null,ambiguous=null;
    if(/前者|1人目|一人目|最初の人|上の人/.test(t))target=0;
    else if(/後者|2人目|二人目|最後の人|下の人/.test(t))target=1;
    for(var i=0;i<exact.length;i++){
      var name=exact[i]['英傑名'],pi=pair.heroes.indexOf(name);
      if(pi>=0&&target<0)target=pi;
    }
    for(var j=exact.length-1;j>=0;j--){
      if(pair.heroes.indexOf(exact[j]['英傑名'])<0){replacement=exact[j];break;}
    }
    if(!replacement&&exact.length===1&&target>=0&&exact[0]['英傑名']!==pair.heroes[target])replacement=exact[0];
    if(!replacement){
      var frag=replacementFragment(t),fr=frag?fuzzyRowFromFragment(frag):null;
      if(fr&&fr.row){replacement=fr.row;if(fr.corrected)correction={query:fr.query,name:fr.row['英傑名']};}
      else if(fr&&fr.ambiguous)ambiguous=fr;
    }
    if(target<0&&replacement){
      var oldExact=exact.filter(function(r){return pair.heroes.indexOf(r['英傑名'])>=0;});
      if(oldExact.length===1)target=pair.heroes.indexOf(oldExact[0]['英傑名']);
    }
    if(ambiguous)return {pair:pair,ambiguous:ambiguous};
    if(target<0||target>1||!replacement)return {pair:pair,needsClarification:true};
    var heroes=pair.heroes.slice();heroes[target]=replacement['英傑名'];
    if(heroes[0]===heroes[1])return {pair:pair,needsClarification:true,sameHero:true,heroes:heroes};
    return {pair:pair,target:target,row:replacement,heroes:heroes,correction:correction};
  }
  function parseCrossHeroStatThreshold(text){
    var t=nfkc(text).replace(/ぜんいん/g,'全員').replace(/みんな/g,'全員').replace(/いじょう/g,'以上').replace(/いか(?=の|で|な|能力|ステ|$)/g,'以下').replace(/みまん/g,'未満').replace(/こえる/g,'超える');
    if(!/(?:全員|全員とも|全員が|共通して|誰か|だれか|1人でも|一人でも|ひとりでも)/.test(t)||!/(?:能力|ステータス|ステ|項目)/.test(t))return null;
    var m=t.match(/([0-9]{3,5})\s*(以上|以下|超(?:える)?|未満)/);
    if(!m)return null;
    return {value:Number(m[1]),op:m[2],quantifier:/(?:誰か|だれか|1人でも|一人でも|ひとりでも)/.test(t)?'any':'all'};
  }
  function crossThresholdMatch(value,cond){
    if(cond.op==='以上')return value>=cond.value;
    if(cond.op==='以下')return value<=cond.value;
    if(/^超/.test(cond.op))return value>cond.value;
    return value<cond.value;
  }

  function heroContexts(history){
    var h=Array.isArray(history)?history:[],out=[];
    for(var i=h.length-1;i>=0&&i>=h.length-24;i--){
      var m=h[i]||{},meta=m.meta||{},d=meta.data||{};
      if(m.role==='assistant'&&d.heroKnowledge){
        out.push({
          hero:S(d.hero),
          heroes:Array.isArray(d.heroes)?d.heroes.slice():[],
          candidates:Array.isArray(d.candidates)?d.candidates.slice():[],
          needsClarification:!!d.needsClarification,
          stats:Array.isArray(d.stats)?d.stats.slice():[]
        });
      }
    }
    return out;
  }
  function contextHeroName(text,history){
    var contexts=heroContexts(history);if(!contexts.length)return'';
    var t=nfkc(text).replace(/[？?！!。]+$/,'').trim();
    var idx=-1,m=t.match(/(?:^|[^0-9])([1-9])(?:位|番|番目|人目|つ目)/);
    if(m)idx=Number(m[1])-1;
    else if(/前者|最初|一番上|上の人/.test(t))idx=0;
    else if(/後者/.test(t))idx=1;
    else if(/最後|一番下/.test(t))idx=-2;
    if(idx!==-1){
      for(var ci=0;ci<contexts.length;ci++){
        var cp=contexts[ci].candidates.length?contexts[ci].candidates:contexts[ci].heroes;
        if(!cp.length)continue;
        var real=idx===-2?cp.length-1:idx;
        if(real>=0&&real<cp.length)return cp[real];
      }
    }
    if(/(?:その人|その英傑|さっきの人|さっきの英傑|この人|この英傑|今の人|今の英傑)/.test(t)){
      for(var di=0;di<contexts.length;di++){
        if(contexts[di].hero)return contexts[di].hero;
        var dp=contexts[di].candidates.length?contexts[di].candidates:contexts[di].heroes;
        if(dp.length===1)return dp[0];
      }
    }
    var selector=t.replace(/^(?:じゃあ|では|なら|その中で|候補の)[、,\s]*/,'').replace(/(?:の方|のほう|について|って|は|の)?(?:生命|気合|腕力|耐久力?|器用さ?|知力|魅力|土属性|水属性|火属性|風属性|能力|ステータス|因子|職業|コスト|技能|詳細).*$/,'').replace(/(?:の方|のほう|について|って|は)$/,'').trim();
    var sf=fold(selector);
    if(sf&&sf.length>=2){
      for(var si=0;si<contexts.length;si++){
        var sp=contexts[si].candidates.length?contexts[si].candidates:(contexts[si].heroes.length?contexts[si].heroes:(contexts[si].hero?[contexts[si].hero]:[]));
        var hits=sp.filter(function(name){return fold(name).indexOf(sf)>=0;});
        if(hits.length===1)return hits[0];
      }
    }
    return'';
  }
  function contextHeroNames(text,history){
    var t=nfkc(text),plural=/(?:(?:その|この|さっきの)?(?:2人|二人|両方|二人とも|2人とも)|(?:その|この|さっきの)(?:3人|三人|[4-9]人))|共通|どっち|どちら|比較|違い|差が(?:大き|小さ|ない)|能力ごと|各能力|1位を取|トップを取|割合(?:だと|では|で)?|比率(?:だと|では|で)?|登録値(?:だと|では|で)?/.test(t);
    if(!plural)return [];
    var contexts=heroContexts(history);
    for(var i=0;i<contexts.length;i++){
      var names=contexts[i].heroes.length?contexts[i].heroes:contexts[i].candidates;
      if(names.length>=2)return names.slice(0,6);
    }
    return [];
  }
  function contextStats(history){
    var contexts=heroContexts(history);
    for(var i=0;i<contexts.length;i++)if(contexts[i].stats.length)return contexts[i].stats.slice();
    return [];
  }
  function latestHeroScope(history){
    var contexts=heroContexts(history),fallback=null;
    for(var i=0;i<contexts.length;i++){
      var c=contexts[i],names=c.candidates.length?c.candidates:c.heroes;
      names=names.filter(function(name){return !!data().rows.find(function(r){return r['英傑名']===name;});});
      if(!names.length)continue;
      var info={names:names.slice(0,20),stats:c.stats.slice(),needsClarification:c.needsClarification};
      if(!c.needsClarification)return info;
      if(!fallback)fallback=info;
    }
    return fallback;
  }
  function latestHeroActiveScope(history){
    var contexts=heroContexts(history),fallback=null;
    for(var i=0;i<contexts.length;i++){
      var c=contexts[i],names=c.heroes.length?c.heroes:c.candidates;
      names=names.filter(function(name){return !!data().rows.find(function(r){return r['英傑名']===name;});});
      if(!names.length)continue;
      var info={names:names.slice(0,20),stats:c.stats.slice(),needsClarification:c.needsClarification};
      if(!c.needsClarification)return info;
      if(!fallback)fallback=info;
    }
    return fallback;
  }
  function explicitContextScopeCue(text){
    var t=nfkc(text);
    return /この中|その中|この人たち|この英傑たち|さっきの(?:候補|ランキング|上位|英傑)|直前の(?:候補|ランキング|上位|英傑)|候補の中|ランキングの中/.test(t);
  }
  function contextScopeCue(text){
    var t=nfkc(text);
    return explicitContextScopeCue(t)||/(?:最初|先頭)の?\s*[0-9]{1,2}\s*(?:人|名)(?:の|を|は)|上位\s*[0-9]{1,2}\s*(?:人|名)(?:の|を|は)|[0-9]{1,2}\s*位(?:\s*(?:と|、|,|から|〜|～|~|－|-)\s*[0-9]{1,2}\s*位)?(?:の|と|を|は)/.test(t);
  }
  function implicitContextScopeCue(text,scope){
    var t=nfkc(text).replace(/^[\s　]*(?:じゃあ|では|なら|あと|次は|今度は|そこから|そのまま|さらに|続けて)[、,\s　]*/,'').trim();
    if(!scope||!scope.names||!scope.names.length||!t||t.length>42)return false;
    if(/全英傑|英傑全体|全体の英傑|全部の英傑|全員/.test(t))return false;
    if(exactNamedRows(t).length||candidateName(t))return false;
    var hasFilter=!!detectJob(t)||!!detectCost(t)||detectFactors(t).length>0||!!detectSkill(t)||/(?:技能|固有技能)(?:が|の)?(?:ある|あり|ない|なし|未登録|登録)/.test(t);
    var hasStat=detectStats(t).length>0&&/(?:順|ランキング|トップ|上位|下位|高い|低い|一番|最も|平均|中央値|以上|以下|未満|超|何人|誰|だれ|教えて|見せて)/.test(t);
    var hasConstraint=/(?:だけ|のみ|以外|じゃない|ではない|除いて|除外|抜き|外して|持ち|ある人|ない人|登録あり|登録なし)/.test(t);
    return !!((hasFilter&&hasConstraint)||hasStat||/(?:職業|コスト|因子|技能).*(?:内訳|何人|一覧|順)/.test(t));
  }
  function selectContextNames(text,names){
    var t=nfkc(text),out=[];
    if(!names||!names.length)return {names:[],label:'',invalid:false};
    var range=t.match(/([0-9]{1,2})\s*位?\s*(?:から|〜|～|~|－|-)\s*([0-9]{1,2})\s*位/);
    if(range){
      var a=Math.max(1,Number(range[1])),b=Math.max(1,Number(range[2]));if(a>b){var z=a;a=b;b=z;}
      for(var ri=a;ri<=b&&ri<=names.length;ri++)out.push(names[ri-1]);
      return {names:out,label:a+'位〜'+Math.min(b,names.length)+'位',invalid:!out.length};
    }
    var top=t.match(/(?:^|この中の|その中の|さっきの|直前の)上位\s*([0-9]{1,2})\s*(?:人|名)(?:の|を|は|で|について|$)/);
    if(top){var n=Math.min(names.length,Math.max(1,Number(top[1])));return {names:names.slice(0,n),label:'上位'+n+'人',invalid:false};}
    var first=t.match(/(?:最初|先頭)の?\s*([0-9]{1,2})\s*(?:人|名)/);
    if(first){var fn=Math.min(names.length,Math.max(1,Number(first[1])));return {names:names.slice(0,fn),label:'最初の'+fn+'人',invalid:false};}
    var rankText=t.replace(/[0-9]{1,2}\s*位(?:を取|を獲|になる|が多|の回数)/g,''),re=/([0-9]{1,2})\s*位/g,m,seen={};
    while((m=re.exec(rankText))){var idx=Number(m[1])-1;if(idx>=0&&idx<names.length&&!seen[idx]){seen[idx]=1;out.push(names[idx]);}}
    if(out.length)return {names:out,label:out.length===1?'指定順位':'指定した'+out.length+'人',invalid:false};
    if(/[0-9]{1,2}\s*位/.test(rankText))return {names:[],label:'',invalid:true};
    return {names:[],label:'',invalid:false};
  }
  function rowsByNames(names){
    var map=Object.create(null);(names||[]).forEach(function(n){map[n]=1;});
    return data().rows.filter(function(r){return !!map[r['英傑名']];}).sort(function(a,b){return names.indexOf(a['英傑名'])-names.indexOf(b['英傑名']);});
  }
  function scopeMeta(scopeNames,obj){
    obj=obj||{};
    if(scopeNames&&scopeNames.length){obj.candidates=scopeNames.slice();obj.contextScope=true;obj.scopeCount=scopeNames.length;}
    return obj;
  }

  function isBlocked(text){return /九十九|鬼神石|魔導結晶|鎮魂符|星海の荒石|カープ|広島|カウンター|家臣計算|能力計算/.test(nfkc(text));}
  function isNavigationOnly(text){var t=nfkc(text);return /(?:ページ|一覧).*(?:開|見せ|どこ|行きたい)|(?:開|見せ).*(?:ページ|一覧)/.test(t)&&!/(?:誰|だれ|ランキング|トップ|上位|下位|一番|最高|最低|何人|何名|数値|値|比較|どっち|因子|職業|コスト|技能)/.test(t);}
  function isSearchAction(text){return /(?:陣法|編成|組み合わせ|6人|六人|因縁|陣形|鶴翼|方円|魚鱗|衡軛|全MAX).*(?:検索|探|組)|(?:検索|適用|差替|配置|除外).*(?:して|したい|お願い)/.test(nfkc(text));}
  function hasHeroFactCue(text){
    var t=nfkc(text),stats=detectStats(t),named=exactNamedRows(t).length>0,possibleName=!!candidateName(t),concepts=detectSkillConcepts(t);
    var explicit=/英傑|武将|キャラ|因子|職業|コスト|技能|固有技能|何人|何名|何体|比較|どっち|順位|何位|強み|つよみ|弱み|よわみ|得意|とくい|苦手|にがて|共通|違い|平均|へいきん|中央値|前後|ぜんご|付近|ふきん|近い|ちかい|似て|にて|同じ(?:値|数値)?|差が(?:大き|小さ|ない)|差の大き|差の小さ|能力ごと|各能力|1位を取|トップを取|\d+台|[0-9]{3,5}\s*(?:から|〜|～|~|－|-)\s*[0-9]{3,5}|上位\s*\d+\s*(?:%|％|パーセント|パーセンと|ぱーせんと)|(?:トップ|とップ|とっぷ|上位)\s*\d+\s*(?:位)?(?:入り|以内)|[0-9]{1,3}\s*位\s*(?:から|〜|～|~|－|-)|総合|バランス|上位互換|下位互換|勝って|勝る|上回|下回|比較優位|変えて|替えて|入れ替えて|差し替えて|変更して|全員|ぜんいん|誰か1人でも|だれか1人でも/.test(t);
    var ranked=stats.length&&/誰|だれ|どれ|ランキング|トップ|上位|下位|一番|最も|最高|最低|最大|最小/.test(t);
    return !!(explicit||ranked||named||possibleName||concepts.length);
  }

  function negativeTerm(text,term){
    var t=nfkc(text),e=esc(term);
    return new RegExp(e+'(?:\s*(?:以外|じゃない|ではない|でない|を除いて|除いて|を除外|除外|抜き|を抜いて|を外して|を持たない|持たない|なし))').test(t)||
      new RegExp('(?:以外|除外|抜き)[^、。]{0,8}'+e).test(t);
  }
  function detectExcludedJobs(text){
    var t=nfkc(text),out=[];
    Object.keys(JOB_ALIASES).forEach(function(job){
      (JOB_ALIASES[job]||[]).some(function(a){if(negativeTerm(t,a)){out.push(job);return true;}return false;});
    });
    return out;
  }
  function detectExcludedCosts(text){
    var t=nfkc(text),out=[],re=/(?:コスト|コスと|こすと)\s*([4-8])\s*(?:以外|じゃない|ではない|でない|を除いて|除いて|を除外|除外|抜き|を外して)/g,m;
    while((m=re.exec(t)))if(out.indexOf(Number(m[1]))<0)out.push(Number(m[1]));
    return out;
  }
  function detectExcludedFactors(text){
    var t=nfkc(text),out=[];
    data().factors.forEach(function(f){if(negativeTerm(t,f))out.push(f);});
    return out;
  }
  function detectSkillPresence(text){
    var t=nfkc(text);
    if(/(?:技能|固有技能)(?:が|の|は)?\s*(?:ない|なし|未登録|登録なし|登録されていない|ついていない)/.test(t))return false;
    if(/(?:技能|固有技能)(?:が|の|は)?\s*(?:ある|あり|登録あり|登録済み|登録されている|ついている|持っている|持ち)/.test(t))return true;
    return null;
  }
  function parseTopRankSet(text,stats){
    var t=nfkc(text);if(/(?:上位|下位)\s*[0-9]{1,3}(?:\.[0-9]+)?\s*(?:%|％|パーセント|パーセンと|ぱーせんと)/.test(t))return null;
    var unionCue=/(?:どちらか|どっちか|いずれか|片方でも|どれか)/.test(t),intersectionCue=/(?:両方|どちらも|どっちも|双方|共通|すべて|全て)/.test(t),differenceCue=/(?:入らない|入っていない|入ってない|含まれない|除く|除外)/.test(t);
    if(!stats||stats.length<2||(!unionCue&&!intersectionCue&&!differenceCue))return null;
    var found=[];
    stats.forEach(function(stat){
      var best=null;
      statAliases(stat).forEach(function(a){var at=t.indexOf(a);if(at>=0&&(!best||at<best.at))best={at:at,alias:a};});
      if(best)found.push({stat:stat,at:best.at,alias:best.alias});
    });
    found.sort(function(a,b){return a.at-b.at;});
    var shared=t.match(/(?:トップ|とップ|とっぷ|上位)\s*([0-9]{1,2})\s*(?:位)?(?:以内|入り|に入る)?(?!\s*(?:%|％|パーセント|パーセンと|ぱーせんと))/),entries=[];
    found.forEach(function(x,i){
      var end=i+1<found.length?found[i+1].at:t.length,seg=t.slice(x.at,end),m=seg.match(/(?:トップ|とップ|とっぷ|上位)\s*([0-9]{1,2})\s*(?:位)?(?:以内|入り|に入る)?(?!\s*(?:%|％|パーセント|パーセンと|ぱーせんと))/),n=m?Number(m[1]):(shared?Number(shared[1]):0);
      if(!n)return;
      entries.push({stat:x.stat,topN:Math.min(20,Math.max(1,n)),negative:/(?:入らない|入っていない|入ってない|含まれない|除く|除外)/.test(seg)});
    });
    if(entries.length<2)return null;
    var operation=entries.some(function(x){return x.negative;})?'difference':(unionCue?'union':'intersection');
    return {operation:operation,entries:entries};
  }
  function parseTop(text){
    var t=nfkc(text),m=t.match(/(?:トップ|とップ|とっぷ|上位|下位|ベスト|ワースト)\s*([0-9]{1,2})/);if(m)return Math.min(20,Math.max(1,Number(m[1])));
    m=t.match(/([0-9]{1,2})(?:人|名|体|件)(?:くらい|ぐらい)?(?:教|見|出|挙)/);if(m)return Math.min(20,Math.max(1,Number(m[1])));
    if(/一番|いちばん|最も|最高|最大|最低|最小/.test(t))return 1;
    return 5;
  }
  function threshold(text,stats){
    var t=nfkc(text),out=[];
    stats.forEach(function(st){
      var aliases=[];STAT_ALIASES.forEach(function(x){if(x.to===st)aliases=x.a.slice();});
      aliases.sort(function(a,b){return b.length-a.length;});
      for(var i=0;i<aliases.length;i++){
        var re=new RegExp(esc(aliases[i])+'(?:が|は|を)?\\s*([0-9]{3,5})\\s*(以上|いじょう|以下|いか|超(?:える|え)?|こえる|未満|みまん)');
        var m=t.match(re);if(m){var op=m[2].replace('いじょう','以上').replace('いか','以下').replace('こえる','超える').replace('みまん','未満');out.push({stat:st,value:Number(m[1]),op:op});break;}
      }
    });
    return out;
  }
  function matchesThreshold(r,th){return th.every(function(x){var v=r._stats[x.stat];if(x.op==='以上')return v>=x.value;if(x.op==='以下')return v<=x.value;if(/^超/.test(x.op))return v>x.value;return v<x.value;});}
  function correctionPrefix(fuzzy){return fuzzy&&fuzzy.corrected?'「'+fuzzy.query+'」は「'+fuzzy.row['英傑名']+'」のこととして答えますね。\n':'';}
  function comparisonCorrectionPrefix(rows){return rows&&rows.length?rows.map(function(x){return '「'+x.query+'」は「'+x.name+'」として見ています。';}).join('\n')+'\n':'';}
  function sourceSuffix(){return '\n※たいらの野望の英傑マスターに登録された基礎値で比較しています。';}
  function result(mode,answer,dataObj){return {handled:true,answer:answer,mode:mode||'英傑マスター実データ',sources:[],links:[link()],data:Object.assign({heroKnowledge:true,sourceSha256:data().meta.sourceSha256||'',rowCount:data().rows.length},dataObj||{})};}

  function filteredRows(text,baseRows,scopeNames){
    var rows=Array.isArray(baseRows)?baseRows.slice():data().rows.slice(),job=detectJob(text),cost=detectCost(text),factors=detectFactors(text),factorSlots=detectFactorSlots(text),skill=detectSkill(text),stats=detectStats(text),th=threshold(text,stats),excludedJobs=detectExcludedJobs(text),excludedCosts=detectExcludedCosts(text),excludedFactors=detectExcludedFactors(text),skillPresence=detectSkillPresence(text);
    if(excludedJobs.indexOf(job)>=0)job='';
    if(excludedCosts.indexOf(cost)>=0)cost=0;
    if(job&&(factors.some(function(f){return f.indexOf(job)>=0;})||excludedFactors.some(function(f){return f.indexOf(job)>=0;})))job='';
    var slotted=Object.create(null);factorSlots.forEach(function(x){slotted[x.factor]=1;});factors=factors.filter(function(f){return !slotted[f]&&excludedFactors.indexOf(f)<0;});
    if(job)rows=rows.filter(function(r){return r['職業']===job;});
    if(cost)rows=rows.filter(function(r){return Number(r['コスト'])===cost;});
    if(factors.length)rows=rows.filter(function(r){var rf=rowFactors(r);return factors.every(function(f){return rf.indexOf(f)>=0;});});
    if(factorSlots.length)rows=rows.filter(function(r){return factorSlots.every(function(x){return S(r['因子'+x.slot])===x.factor;});});
    if(skill)rows=rows.filter(function(r){return S(r['技能'])===skill;});
    if(excludedJobs.length)rows=rows.filter(function(r){return excludedJobs.indexOf(S(r['職業']))<0;});
    if(excludedCosts.length)rows=rows.filter(function(r){return excludedCosts.indexOf(Number(r['コスト']))<0;});
    if(excludedFactors.length)rows=rows.filter(function(r){var rf=rowFactors(r);return excludedFactors.every(function(f){return rf.indexOf(f)<0;});});
    if(skillPresence!==null)rows=rows.filter(function(r){return validSkill(r)===skillPresence;});
    if(th.length)rows=rows.filter(function(r){return matchesThreshold(r,th);});
    return {rows:rows,job:job,cost:cost,factors:factors,factorSlots:factorSlots,skill:skill,excludedJobs:excludedJobs,excludedCosts:excludedCosts,excludedFactors:excludedFactors,skillPresence:skillPresence,stats:stats,thresholds:th,scopeNames:Array.isArray(scopeNames)?scopeNames.slice():[]};
  }
  function filterStateLabel(s){
    var f={job:s.job,cost:s.cost,factors:s.factors,factorSlots:s.factorSlots,skill:s.skill,excludedJobs:s.excludedJobs,excludedCosts:s.excludedCosts,excludedFactors:s.excludedFactors,skillPresence:s.skillPresence,thresholds:s.thresholds,scopeNames:[]};
    var label=filterLabel(f);return label==='全英傑の'?'条件なし':label.replace(/の$/,'');
  }
  function lastStatInText(text){
    var t=nfkc(text),best=null;STAT_ALIASES.forEach(function(row){row.a.forEach(function(a){var at=t.lastIndexOf(a);if(at>=0&&(!best||at>best.at||(at===best.at&&a.length>best.len)))best={stat:row.to,at:at,len:a.length};});});return best?best.stat:'';
  }
  function refinementRowsFor(context,snapshot){
    var roots=rowsByNames(context.rootCandidates),state=cloneFilterState(snapshot.filters),sortStats=cloneList(snapshot.sortStats),sortLow=!!snapshot.sortLow,rows=applyFilterState(roots,state);
    if(sortStats.length)rows.sort(function(a,b){var av=scoreOf(a,sortStats),bv=scoreOf(b,sortStats),d=sortLow?av-bv:bv-av;return d||context.rootCandidates.indexOf(a['英傑名'])-context.rootCandidates.indexOf(b['英傑名']);});
    else rows.sort(function(a,b){return context.rootCandidates.indexOf(a['英傑名'])-context.rootCandidates.indexOf(b['英傑名']);});
    return rows;
  }
  function refinementAnswer(head,rows,state,sortStats,sortLow){
    var take=rows.slice(0,20),condition=filterStateLabel(state),sortLabel=sortStats.length?' / 並び：'+sortStats.join('＋')+(sortLow?'が低い順':'が高い順'):'';
    var answer=head+'\n現在は '+condition+sortLabel+'、該当 '+rows.length+'人です。'+(take.length?'\n'+take.map(function(r,i){var vals=sortStats.length?'（'+sortStats.map(function(st){return st+':'+r._stats[st];}).join(' / ')+'）':'（'+r['職業']+'・コスト'+r['コスト']+'）';return (i+1)+'：'+r['英傑名']+vals;}).join('\n'):'\n該当する英傑はいません。');
    if(rows.length>take.length)answer+='\nほか '+(rows.length-take.length)+'人います。';
    return {answer:answer,take:take};
  }
  function savedViewByName(views,name){var n=cleanSavedViewName(name);return cloneSavedViews(views).find(function(v){return v.name===n;})||null;}
  function savedViewRows(view){var roots=rowsByNames(view.activeCandidates&&view.activeCandidates.length?view.activeCandidates:view.rootCandidates),stats=cloneList(view.snapshot&&view.snapshot.sortStats),low=!!(view.snapshot&&view.snapshot.sortLow);if(stats.length)roots.sort(function(a,b){var av=scoreOf(a,stats),bv=scoreOf(b,stats),d=low?av-bv:bv-av;return d||String(a['英傑名']).localeCompare(String(b['英傑名']),'ja');});return roots;}
  function extractSavedViewName(text){
    var t=nfkc(text),m=t.match(/(?:この|今の|現在の)?(?:結果|候補|条件|状態)?\s*を\s*[「『【\"]?([^」』】\"\n]{1,20}?)[」』】\"]?\s*(?:として|という名前で|という名で)\s*(?:保存|覚えて|残して)/);
    if(!m)m=t.match(/[「『【\"]?([^」』】\"\n]{1,20}?)[」』】\"]?\s*(?:として|という名前で|という名で)\s*(?:保存|覚えて|残して)/);
    if(!m)m=t.match(/(?:保存名|名前|名)\s*(?:は|を|:|：)\s*[「『【\"]?([^」』】\"\n]{1,20})/);
    var n=cleanSavedViewName(m?m[1]:'');
    if(/^(?:この|今|現在|結果|候補|条件|状態|保存|覚えて|残して|元|最初)$/.test(n))return '';
    return n;
  }
  function mentionedSavedViews(text,views){
    var t=nfkc(text),hits=[];cloneSavedViews(views).forEach(function(v){var at=t.indexOf(v.name);if(at>=0)hits.push({view:v,at:at,end:at+v.name.length});});
    hits.sort(function(a,b){return a.at-b.at||(b.end-b.at)-(a.end-a.at);});var out=[],ranges=[];hits.forEach(function(h){if(ranges.some(function(r){return h.at>=r.at&&h.end<=r.end;}))return;ranges.push({at:h.at,end:h.end});out.push(h.view);});return out;
  }
  function parseSavedViewCommand(text,history){
    var ctx=latestHeroRefinementContext(history);if(!ctx)return null;
    var t=nfkc(text),views=cloneSavedViews(ctx.savedViews),mentioned=mentionedSavedViews(t,views);
    if(/(?:保存した|覚えた|残した)(?:結果|候補|条件|状態)?(?:の)?(?:一覧|リスト|名前)|(?:保存結果|保存候補|保存条件)(?:を)?(?:見せて|教えて|一覧)/.test(t))return {action:'list',context:ctx,views:views};
    if(/(?:保存|覚えて|残して)/.test(t)&&/(?:結果|候補|条件|状態|として|という名前|という名)/.test(t)){
      var name=extractSavedViewName(t);return {action:name?'save':'saveClarify',context:ctx,views:views,name:name};
    }
    if(mentioned.length>=2&&/(?:比べ|比較|違い|差|共通|同じ|増え|減っ)/.test(t))return {action:'compare',context:ctx,views:views,a:mentioned[0],b:mentioned[1]};
    if(mentioned.length&&/(?:削除|消して|消す|忘れて|破棄)/.test(t))return {action:'delete',context:ctx,views:views,view:mentioned[0]};
    if(mentioned.length&&/(?:戻して|戻る|復元|呼び出|切り替|切替|再開)/.test(t))return {action:'restore',context:ctx,views:views,view:mentioned[0]};
    if(/(?:保存した|覚えた|残した)(?:結果|候補|条件|状態).*(?:比べ|比較)/.test(t))return {action:'compareClarify',context:ctx,views:views};
    return null;
  }
  function savedViewSummary(v){var condition=filterStateLabel(v.displayFilters||v.snapshot.filters),sort=(v.displaySortStats||v.snapshot.sortStats).length?' / '+(v.displaySortStats||v.snapshot.sortStats).join('＋')+((v.displaySortLow===undefined?v.snapshot.sortLow:v.displaySortLow)?'が低い順':'が高い順'):'';return v.name+'：'+v.count+'人（'+condition+sort+'）';}
  function renderSavedViewCommand(cmd){
    var ctx=cmd.context,views=cloneSavedViews(cmd.views),currentRows=rowsByNames(ctx.activeCandidates),currentData=function(vs){return refinementData(ctx.rootCandidates,currentRows,ctx.filters,ctx.sortStats,ctx.sortLow,ctx.undoStack,ctx.redoStack,vs);};
    if(cmd.action==='saveClarify')return result('英傑マスター確認','保存する名前を教えてください。例：「今の結果をAとして保存」のように指定できます。',{needsClarification:true,savedViewCommand:true,heroRefinement:currentData(views)});
    if(cmd.action==='list')return result('英傑マスター実データ',views.length?'保存している英傑候補は '+views.length+'件です。\n'+views.map(savedViewSummary).join('\n'):'保存している英傑候補はありません。',{savedViewCommand:true,savedViewList:true,savedViews:views.map(function(v){return {name:v.name,count:v.count};}),heroRefinement:currentData(views)});
    if(cmd.action==='save'){
      var entry={name:cmd.name,rootCandidates:ctx.activeCandidates.slice(),snapshot:{filters:emptyFilterState(),sortStats:ctx.sortStats.slice(),sortLow:ctx.sortLow},activeCandidates:ctx.activeCandidates.slice(),displayFilters:cloneFilterState(ctx.filters),displaySortStats:ctx.sortStats.slice(),displaySortLow:ctx.sortLow,count:ctx.activeCandidates.length};
      var replaced=!!savedViewByName(views,cmd.name);views=views.filter(function(v){return v.name!==cmd.name;});views.push(entry);views=cloneSavedViews(views);
      return result('英傑マスター実データ','現在の英傑候補 '+entry.count+'人を「'+cmd.name+'」として'+(replaced?'上書き保存':'保存')+'しました。保存はこの会話内だけで、最大6件です。',{savedViewCommand:true,savedViewSaved:true,savedViewName:cmd.name,savedViewCount:entry.count,heroRefinement:currentData(views)});
    }
    if(cmd.action==='delete'){
      views=views.filter(function(v){return v.name!==cmd.view.name;});
      return result('英傑マスター実データ','保存した「'+cmd.view.name+'」を削除しました。',{savedViewCommand:true,savedViewDeleted:true,savedViewName:cmd.view.name,heroRefinement:currentData(views)});
    }
    if(cmd.action==='compareClarify')return result('英傑マスター確認',views.length>=2?'比較する保存名を2つ指定してください。保存中：'+views.map(function(v){return v.name;}).join(' / '):'比較するには、英傑候補を別名で2件以上保存してください。',{needsClarification:true,savedViewCommand:true,heroRefinement:currentData(views)});
    if(cmd.action==='compare'){
      var ar=savedViewRows(cmd.a).map(function(r){return r['英傑名'];}),br=savedViewRows(cmd.b).map(function(r){return r['英傑名'];}),diff=refinementDiff(ar,br),common=ar.filter(function(n){return br.indexOf(n)>=0;});
      var answer='保存結果「'+cmd.a.name+'」と「'+cmd.b.name+'」を比較しました。\n'+cmd.a.name+'：'+ar.length+'人 / '+cmd.b.name+'：'+br.length+'人\n共通：'+common.length+'人'+(common.length?'（'+common.slice(0,20).join(' / ')+(common.length>20?' ほか'+(common.length-20)+'人':'')+'）':'')+'\n'+cmd.a.name+'だけ：'+diff.removed.length+'人'+(diff.removed.length?'（'+diff.removed.slice(0,20).join(' / ')+(diff.removed.length>20?' ほか'+(diff.removed.length-20)+'人':'')+'）':'')+'\n'+cmd.b.name+'だけ：'+diff.added.length+'人'+(diff.added.length?'（'+diff.added.slice(0,20).join(' / ')+(diff.added.length>20?' ほか'+(diff.added.length-20)+'人':'')+'）':'');
      return result('英傑マスター実データ',answer+sourceSuffix(),{savedViewCommand:true,savedViewCompared:true,savedViewNames:[cmd.a.name,cmd.b.name],commonCandidates:common,onlyFirst:diff.removed,onlySecond:diff.added,heroRefinement:currentData(views)});
    }
    if(cmd.action==='restore'){
      var rows=savedViewRows(cmd.view),snap=cmd.view.snapshot,diff2=refinementDiff(ctx.activeCandidates,rows.map(function(r){return r['英傑名'];})),savedCondition=filterStateLabel(cmd.view.displayFilters||snap.filters),shown=refinementAnswer('保存した「'+cmd.view.name+'」へ切り替えました。保存時の条件：'+savedCondition,rows,snap.filters,snap.sortStats,snap.sortLow);
      return result('英傑マスター実データ',shown.answer+sourceSuffix(),{savedViewCommand:true,savedViewRestored:true,savedViewName:cmd.view.name,count:rows.length,heroes:shown.take.map(function(r){return r['英傑名'];}),candidates:cmd.view.rootCandidates.slice(),filters:cloneFilterState(snap.filters),stats:cloneList(snap.sortStats),low:!!snap.sortLow,heroRefinement:refinementData(cmd.view.rootCandidates,rows,snap.filters,snap.sortStats,snap.sortLow,[],[],views),heroRefinementChange:diff2,previousCandidates:diff2.before,addedCandidates:diff2.added,removedCandidates:diff2.removed});
    }
    return result('英傑マスター確認','保存した英傑候補の操作を確認できませんでした。',{needsClarification:true,savedViewCommand:true,heroRefinement:currentData(views)});
  }

  function parseRefinementHistoryCommand(text,history){
    var ctx=latestHeroRefinementContext(history);if(!ctx)return null;
    var t=nfkc(text),redo=/(?:取り消し|戻した|戻す前|一つ前に戻した|ひとつ前に戻した).*(?:やり直|元に戻|戻して)|(?:やっぱ|やはり).*(?:取り消す前|変更後|さっきの変更).*(?:戻)/.test(t);
    var undo=/(?:直前|さっき|今の)(?:の)?(?:変更|絞り込み|条件変更|並べ替え).*(?:取り消|戻)|(?:条件|絞り込み|結果|並び順|候補).*(?:一つ|ひとつ|1つ|一個|1個)前.*(?:戻)|(?:一つ|ひとつ|1つ|一個|1個)前の(?:条件|絞り込み|結果|状態).*(?:戻)|(?:さっき外した|今外した)(?:条件|絞り込み).*(?:戻)|(?:外れた人|除外された人).*(?:戻)/.test(t);
    if(!redo&&!undo)return null;
    return {context:ctx,action:redo?'redo':'undo'};
  }
  function renderRefinementHistoryCommand(cmd){
    var ctx=cmd.context,current=refinementSnapshot(ctx),undo=cloneRefinementStack(ctx.undoStack),redo=cloneRefinementStack(ctx.redoStack),target;
    if(cmd.action==='undo'){
      if(!undo.length)return result('英傑マスター確認','これ以上戻せる英傑の条件変更はありません。通常の話題へ戻る場合は「前の話に戻って」と言ってください。',{needsClarification:true,refinementHistory:true,heroRefinement:refinementData(ctx.rootCandidates,rowsByNames(ctx.activeCandidates),ctx.filters,ctx.sortStats,ctx.sortLow,undo,redo,ctx.savedViews)});
      target=undo.pop();redo.push(current);redo=redo.slice(-8);
    }else{
      if(!redo.length)return result('英傑マスター確認','やり直せる英傑の条件変更はありません。',{needsClarification:true,refinementHistory:true,heroRefinement:refinementData(ctx.rootCandidates,rowsByNames(ctx.activeCandidates),ctx.filters,ctx.sortStats,ctx.sortLow,undo,redo,ctx.savedViews)});
      target=redo.pop();undo.push(current);undo=undo.slice(-8);
    }
    var rows=refinementRowsFor(ctx,target),shown=refinementAnswer(cmd.action==='undo'?'直前の英傑条件変更を取り消しました。':'取り消した英傑条件変更をやり直しました。',rows,target.filters,target.sortStats,target.sortLow),diff=refinementDiff(ctx.activeCandidates,rows.map(function(r){return r['英傑名'];}));
    return result('英傑マスター実データ',shown.answer+sourceSuffix(),{refinementHistoryEdited:true,refinementAction:cmd.action,count:rows.length,heroes:shown.take.map(function(r){return r['英傑名'];}),candidates:ctx.rootCandidates.slice(),filters:cloneFilterState(target.filters),stats:cloneList(target.sortStats),low:!!target.sortLow,heroRefinement:refinementData(ctx.rootCandidates,rows,target.filters,target.sortStats,target.sortLow,undo,redo,ctx.savedViews),heroRefinementChange:diff,previousCandidates:diff.before,addedCandidates:diff.added,removedCandidates:diff.removed});
  }
  function latestRefinementChange(history){
    var h=Array.isArray(history)?history:[];
    for(var i=h.length-1;i>=0&&i>=h.length-16;i--){var m=h[i]||{},d=(m.meta||{}).data||{};if(m.role==='assistant'&&d.heroKnowledge)return d.heroRefinementChange?d.heroRefinementChange:null;}
    return null;
  }
  function parseRefinementChangeQuestion(text,history){
    var t=nfkc(text),change=latestRefinementChange(history);if(!change)return null;
    if(/(?:誰|だれ|どの英傑).*(?:外れ|除外|消え|いなくな)|(?:外れ|除外|消え)た(?:人|英傑).*(?:誰|だれ)?/.test(t))return {kind:'removed',change:change};
    if(/(?:誰|だれ|どの英傑).*(?:増え|追加|戻っ)|(?:増え|追加され|戻っ)た(?:人|英傑).*(?:誰|だれ)?/.test(t))return {kind:'added',change:change};
    if(/(?:前|さっき|変更前).*(?:何人|どれくらい|差|違い|変わ)|(?:何人|どれくらい).*(?:増え|減っ|変わ)|(?:前の結果|変更前).*(?:比べ|比較)/.test(t))return {kind:'summary',change:change};
    return null;
  }
  function renderRefinementChangeQuestion(q,history){
    var c=q.change,ctx=latestHeroRefinementContext(history),list=q.kind==='removed'?c.removed:c.added,label=q.kind==='removed'?'外れた英傑':'増えた英傑',answer;
    if(q.kind==='summary')answer='直前の変更前は '+c.before.length+'人、変更後は '+c.after.length+'人です。\n増えた英傑：'+c.added.length+'人'+(c.added.length?'（'+c.added.slice(0,20).join(' / ')+(c.added.length>20?' ほか'+(c.added.length-20)+'人':'')+'）':'')+'\n外れた英傑：'+c.removed.length+'人'+(c.removed.length?'（'+c.removed.slice(0,20).join(' / ')+(c.removed.length>20?' ほか'+(c.removed.length-20)+'人':'')+'）':'');
    else answer=label+'は '+list.length+'人です。'+(list.length?'\n'+list.slice(0,20).join(' / ')+(list.length>20?'\nほか '+(list.length-20)+'人います。':''):'該当者はいません。');
    var meta={refinementChangeAnswered:true,changeKind:q.kind,beforeCount:c.before.length,afterCount:c.after.length,addedCandidates:cloneList(c.added),removedCandidates:cloneList(c.removed),heroRefinementChange:{before:cloneList(c.before),after:cloneList(c.after),added:cloneList(c.added),removed:cloneList(c.removed)}};
    if(ctx)meta.heroRefinement=refinementData(ctx.rootCandidates,rowsByNames(ctx.activeCandidates),ctx.filters,ctx.sortStats,ctx.sortLow,ctx.undoStack,ctx.redoStack,ctx.savedViews);
    return result('英傑マスター実データ',answer+sourceSuffix(),meta);
  }
  function parseRefinementEdit(text,history){
    var ctx=latestHeroRefinementContext(history);if(!ctx)return null;
    var t=nfkc(text),stats=detectStats(t),state=cloneFilterState(ctx.filters),sortStats=ctx.sortStats.slice(),sortLow=ctx.sortLow,changed=[],kind='';
    var resetAll=/(?:条件|絞り込み|フィルター).*(?:全部|すべて|全て).*(?:外|解除|なし|消)|(?:全部|すべて|全て)の(?:条件|絞り込み).*(?:外|解除|なし|消)|(?:元|最初)の(?:候補|一覧|メンバー|英傑|[0-9]+人).*(?:戻)/.test(t);
    var resetSort=/(?:並び|並べ替え|順番|ランキング基準).*(?:元|解除|外|なし|戻)/.test(t);
    var reverse=/(?:逆順|逆の順|並びを逆|順番を逆)/.test(t);
    var lowOnly=/(?:低い順|小さい順|下から順|ワースト順)(?:に|で|へ)?(?:して|並べ|変更|戻)?/.test(t);
    var highOnly=/(?:高い順|大きい順|上から順)(?:に|で|へ)?(?:して|並べ|変更|戻)?/.test(t);
    var removeCue=/(?:条件|絞り込み|フィルター|基準)?(?:は|を|だけ)?\s*(?:外して|外す|解除して|解除|なしで|消して|取り消して|やめて)/.test(t);
    var switchCue=/(?:じゃなくて|ではなく|から).*(?:順|基準|に変えて|にして|へ変更)/.test(t);
    if(resetAll){state=emptyFilterState();sortStats=[];sortLow=false;kind='resetAll';changed.push('すべての条件と並び順を解除');}
    else{
      if(removeCue){
        if(stats.length){
          stats.forEach(function(st){var before=state.thresholds.length;state.thresholds=state.thresholds.filter(function(x){return x.stat!==st;});if(before!==state.thresholds.length){changed.push(st+'の数値条件を解除');kind='removeFilter';}if(sortStats.indexOf(st)>=0&&!state.thresholds.some(function(x){return x.stat===st;})){sortStats=sortStats.filter(function(x){return x!==st;});changed.push(st+'の並び順を解除');kind='removeSort';}});
        }
        var job=detectJob(t);if(job){if(state.job===job){state.job='';changed.push('職業「'+job+'」条件を解除');kind='removeFilter';}state.excludedJobs=state.excludedJobs.filter(function(x){return x!==job;});}
        var cost=detectCost(t);if(cost){if(state.cost===cost){state.cost=0;changed.push('コスト'+cost+'条件を解除');kind='removeFilter';}state.excludedCosts=state.excludedCosts.filter(function(x){return x!==cost;});}
        var factors=detectFactors(t);factors.forEach(function(f){var before=state.factors.length+state.excludedFactors.length;state.factors=state.factors.filter(function(x){return x!==f;});state.excludedFactors=state.excludedFactors.filter(function(x){return x!==f;});state.factorSlots=state.factorSlots.filter(function(x){return x.factor!==f;});if(before!==state.factors.length+state.excludedFactors.length){changed.push('因子「'+f+'」条件を解除');kind='removeFilter';}});
        if(/技能|固有技能/.test(t)){state.skill='';state.skillPresence=null;changed.push('技能条件を解除');kind='removeFilter';}
      }
      if(resetSort){sortStats=[];sortLow=false;kind='removeSort';changed.push('並び順を解除');}
      if(reverse){sortLow=!sortLow;kind='sort';changed.push('並び順を逆転');}
      if(lowOnly){if(!sortStats.length&&stats.length)sortStats=[stats[stats.length-1]];sortLow=true;kind='sort';changed.push((sortStats.join('＋')||'現在の基準')+'を低い順へ変更');}
      if(highOnly){if(!sortStats.length&&stats.length)sortStats=[stats[stats.length-1]];sortLow=false;kind='sort';changed.push((sortStats.join('＋')||'現在の基準')+'を高い順へ変更');}
      if(switchCue&&stats.length){sortStats=[lastStatInText(t)||stats[stats.length-1]];sortLow=/低い順|下から|ワースト/.test(t);kind='sort';changed.push('並び基準を'+sortStats[0]+'へ変更');}
    }
    if(!kind&&!changed.length)return null;
    return {context:ctx,state:state,sortStats:sortStats,sortLow:sortLow,kind:kind,changed:uniqueList(changed)};
  }
  function renderRefinementEdit(edit){
    var rows=refinementRowsFor(edit.context,{filters:edit.state,sortStats:edit.sortStats,sortLow:edit.sortLow}),sortStats=edit.sortStats.slice(),head=edit.changed.length?edit.changed.join('・')+'しました。':'条件を更新しました。',shown=refinementAnswer(head,rows,edit.state,sortStats,edit.sortLow),undo=cloneRefinementStack(edit.context.undoStack),redo=[];
    if(!sameRefinementSnapshot(edit.context,{filters:edit.state,sortStats:sortStats,sortLow:edit.sortLow}))undo.push(refinementSnapshot(edit.context));undo=undo.slice(-8);
    var diff=refinementDiff(edit.context.activeCandidates,rows.map(function(r){return r['英傑名'];}));
    return result('英傑マスター実データ',shown.answer+sourceSuffix(),{refinementEdited:true,refinementAction:edit.kind,count:rows.length,heroes:shown.take.map(function(r){return r['英傑名'];}),candidates:edit.context.rootCandidates.slice(),filters:cloneFilterState(edit.state),stats:sortStats,low:edit.sortLow,heroRefinement:refinementData(edit.context.rootCandidates,rows,edit.state,sortStats,edit.sortLow,undo,redo,edit.context.savedViews),heroRefinementChange:diff,previousCandidates:diff.before,addedCandidates:diff.added,removedCandidates:diff.removed});
  }
  function renderGroupReplacement(change){
    var rows=rowsByNames(change.heroes),g=change.group,prefix=(change.correction?'「'+change.correction.query+'」は「'+change.correction.name+'」として見ています。\n':'')+'比較対象を '+g.heroes[change.target]+' から '+change.row['英傑名']+' に変更しました。\n';
    if(g.perStatLeaders){var ls=perStatLeaders(rows,g.stats);return result('英傑マスター実データ',prefix+'更新後の'+rows.length+'人の能力別トップです。\n'+ls.map(function(x){return x.stat+'：'+x.leaders.map(function(r){return r['英傑名'];}).join(' / ')+'（'+x.value+'）';}).join('\n')+sourceSuffix(),{groupTargetReplaced:true,perStatLeaders:true,heroes:change.heroes.slice(),stats:g.stats.slice(),leaders:ls.map(function(x){return {stat:x.stat,value:x.value,heroes:x.leaders.map(function(r){return r['英傑名'];})};})});}
    if(g.leaderCounts){var lc=leaderCounts(rows,g.stats),mx=lc.length?lc[0].count:0,w=lc.filter(function(x){return x.count===mx;});return result('英傑マスター実データ',prefix+'更新後、能力別1位を最も多く取るのは '+w.map(function(x){return x.row['英傑名'];}).join(' / ')+' です（'+mx+'能力）。\n'+lc.map(function(x){return x.row['英傑名']+'：'+x.count+'能力'+(x.stats.length?'（'+x.stats.join(' / ')+'）':'');}).join('\n')+sourceSuffix(),{groupTargetReplaced:true,leaderCounts:true,heroes:change.heroes.slice(),stats:g.stats.slice(),winners:w.map(function(x){return x.row['英傑名'];}),counts:lc.map(function(x){return {hero:x.row['英傑名'],count:x.count,stats:x.stats.slice()};})});}
    if(g.commonRegistration||g.factorComparison){var shared=sharedRegistration(rows),parts=[];if(shared.job)parts.push('職業：'+shared.job);if(shared.cost!==null)parts.push('コスト：'+shared.cost);if(shared.factors.length)parts.push('共通因子：'+shared.factors.join(' / '));if(shared.skill)parts.push('技能：'+shared.skill);if(shared.equalStats.length)parts.push('同値能力：'+shared.equalStats.join(' / '));return result('英傑マスター実データ',prefix+'更新後の共通点です。\n'+(parts.length?parts.join('\n'):'全員共通の登録項目はありません。')+sourceSuffix(),{groupTargetReplaced:true,commonRegistration:true,heroes:change.heroes.slice(),common:shared});}
    return result('英傑マスター確認',prefix+'更新後の '+change.heroes.join(' / ')+' について、能力別トップ・共通点・数値条件など、何を比べるか教えてください。',{groupTargetReplaced:true,needsClarification:true,heroes:change.heroes.slice()});
  }

  function filterLabel(f){
    var p=[];if(f.job)p.push('職業「'+f.job+'」');if(f.cost)p.push('コスト'+f.cost);if(f.factors.length)p.push('因子「'+f.factors.join('・')+'」');
    (f.factorSlots||[]).forEach(function(x){p.push('因子'+x.slot+'「'+x.factor+'」');});if(f.skill)p.push('技能「'+f.skill+'」');
    (f.excludedJobs||[]).forEach(function(x){p.push('職業「'+x+'」以外');});(f.excludedCosts||[]).forEach(function(x){p.push('コスト'+x+'以外');});
    if((f.excludedFactors||[]).length)p.push('因子「'+f.excludedFactors.join('・')+'」なし');
    if(f.skillPresence===true)p.push('技能登録あり');else if(f.skillPresence===false)p.push('技能登録なし');
    f.thresholds.forEach(function(x){p.push(x.stat+x.value+x.op);});
    if(f.scopeNames&&f.scopeNames.length)return '直前の候補'+f.scopeNames.length+'人の中で'+(p.length?'、'+p.join('・')+'の':'');
    return p.length?p.join('・')+'の':'全英傑の';
  }
  function scoreOf(r,stats){var n=0;stats.forEach(function(st){n+=Number(r._stats[st]||0);});return n;}
  function rankInfo(rows,r,stat,low){
    var value=r._stats[stat],better=0,tied=0;
    rows.forEach(function(x){
      if(low?x._stats[stat]<value:x._stats[stat]>value)better++;
      if(x._stats[stat]===value)tied++;
    });
    return {rank:better+1,total:rows.length,value:value,tied:tied};
  }
  function median(values){
    var a=values.slice().sort(function(x,y){return x-y;}),n=a.length;
    if(!n)return 0;
    return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;
  }
  function rounded(n){return Math.round(n*10)/10;}
  function parseRankRange(text){
    var t=nfkc(text),m=t.match(/([0-9]{1,3})\s*位?\s*(?:から|〜|～|~|－|-)\s*([0-9]{1,3})\s*位/);
    if(!m)m=t.match(/([0-9]{1,3})\s*位\s*(?:から|〜|～|~|－|-)\s*([0-9]{1,3})(?:\s*位)?/);
    if(!m)return null;
    var a=Math.max(1,Number(m[1])),b=Math.max(1,Number(m[2]));if(a>b){var x=a;a=b;b=x;}
    return {start:a,end:Math.min(383,b)};
  }
  function parseGlobalRankReference(text,stats){
    var t=nfkc(text);if(!stats||stats.length!==1)return null;
    var m=t.match(new RegExp('(?:'+statAliases(stats[0]).map(esc).join('|')+')(?:が|は|の)?\\s*([0-9]{1,3})\\s*位(?:の英傑|の人|の(?:因子|職業|コスト|技能|固有|詳細)|は誰|って誰|はだれ|ってだれ|を教えて|を知りたい|$)'));
    if(!m)return null;
    return {stat:stats[0],rank:Math.max(1,Math.min(data().rows.length,Number(m[1]))),low:/低い方|下から|ワースト/.test(t)};
  }
  function parsePercent(text){
    var m=nfkc(text).match(/(?:上位|下位)\s*([0-9]{1,3}(?:\.[0-9]+)?)\s*(?:%|％|パーセント|パーセンと|ぱーせんと)/);
    if(!m)return null;var p=Math.max(0.1,Math.min(100,Number(m[1])));return {percent:p,low:/下位/.test(nfkc(text))};
  }
  function statAliases(stat){
    var out=[];STAT_ALIASES.forEach(function(x){if(x.to===stat)out=x.a.slice();});
    return out.sort(function(a,b){return b.length-a.length;});
  }
  function parseStatPercentConditions(text,stats){
    var t=nfkc(text),out=[];
    stats.forEach(function(stat){
      var aliases=statAliases(stat),hit=null;
      for(var i=0;i<aliases.length&&!hit;i++){
        var a=esc(aliases[i]);
        var m=t.match(new RegExp(a+'(?:が|は|を)?[^、。]{0,12}?(上位|下位)\\s*([0-9]{1,3}(?:\\.[0-9]+)?)\\s*(?:%|％|パーセント|パーセンと|ぱーせんと)'));
        if(!m)m=t.match(new RegExp('(上位|下位)\\s*([0-9]{1,3}(?:\\.[0-9]+)?)\\s*(?:%|％|パーセント|パーセンと|ぱーせんと)[^、。]{0,12}?'+a));
        if(m)hit={stat:stat,low:m[1]==='下位',percent:Math.max(0.1,Math.min(100,Number(m[2])))};
      }
      if(hit)out.push(hit);
    });
    if(!out.length&&stats.length>=2&&/(?:両方|どちらも|どっちも|全部|すべて|全て)/.test(t)){
      var shared=t.match(/(上位|下位)\s*([0-9]{1,3}(?:\.[0-9]+)?)\s*(?:%|％|パーセント|パーセンと|ぱーせんと)/);
      if(shared)stats.forEach(function(stat){out.push({stat:stat,low:shared[1]==='下位',percent:Math.max(0.1,Math.min(100,Number(shared[2])))});});
    }
    return out;
  }
  function percentileCondition(rows,cond){
    var sorted=sortedByStat(rows,cond.stat,cond.low),count=Math.max(1,Math.ceil(sorted.length*cond.percent/100)),slice=sorted.slice(0,count),cutoff=slice.length?slice[slice.length-1]._stats[cond.stat]:0;
    return {stat:cond.stat,low:cond.low,percent:cond.percent,count:count,cutoff:cutoff};
  }
  function parseAverageConditions(text,stats){
    var t=nfkc(text).replace(/(?:平均|へいきん)いじょう/g,'平均以上').replace(/(?:平均|へいきん)いか(?=の|で|な|英傑|武将|キャラ|$)/g,'平均以下'),out=[];
    function dirOf(v){return /以下|未満|低い|下回/.test(v)?'low':'high';}
    stats.forEach(function(stat){
      var aliases=statAliases(stat),hit=null;
      for(var i=0;i<aliases.length&&!hit;i++){
        var a=esc(aliases[i]),m=t.match(new RegExp(a+'(?:が|は|を)?[^、。]{0,10}?平均(?:値)?\\s*(以上|以下|より高い|より低い|を?上回る?|を?下回る?)'));
        if(!m)m=t.match(new RegExp('(?:平均|へいきん)(?:値)?(?:の)?'+a+'(?:が|は|を)?\\s*(以上|以下|より高い|より低い|を?上回る?|を?下回る?)'));
        if(m)hit={stat:stat,direction:dirOf(m[1])};
      }
      if(hit)out.push(hit);
    });
    if(!out.length&&stats.length){
      var shared=t.match(/(?:平均|へいきん)(?:値)?\s*(以上|以下|より高い|より低い|を?上回る?|を?下回る?)/);
      if(shared)stats.forEach(function(stat){out.push({stat:stat,direction:dirOf(shared[1])});});
    }
    return out;
  }
  function statRange(rows,stat){
    var min=Infinity,max=-Infinity;rows.forEach(function(r){var v=r._stats[stat];if(v<min)min=v;if(v>max)max=v;});
    if(!isFinite(min)||!isFinite(max))return {min:0,max:0,span:1};
    return {min:min,max:max,span:Math.max(1,max-min)};
  }
  function parseRelativeStatConditions(text,stats){
    var t=nfkc(text),list=(stats||[]).slice(),out=[];
    if(!list.length&&/(?:全能力|全ステータス|全ステ|すべての能力|全部の能力)/.test(t))list=STAT_ORDER.slice();
    if(!list.length||!/(?:より|上回|下回|超え|未満|勝る|劣る)/.test(t))return out;
    function dir(seg){
      if(/(?:低い|低く|下回|未満|劣る|弱い)/.test(seg))return 'low';
      if(/(?:高い|高く|上回|超え|勝る|強い)/.test(seg))return 'high';
      return '';
    }
    var positions=[];
    list.forEach(function(st){
      var aliases=statAliases(st),best=-1,bestLen=0;
      aliases.forEach(function(a){var at=t.indexOf(a);if(at>=0&&(best<0||at<best)){best=at;bestLen=a.length;}});
      positions.push({stat:st,at:best,len:bestLen});
    });
    positions.sort(function(a,b){return (a.at<0?999999:a.at)-(b.at<0?999999:b.at);});
    positions.forEach(function(x,i){
      if(x.at<0)return;
      var end=t.length;
      for(var j=i+1;j<positions.length;j++)if(positions[j].at>=0){end=positions[j].at;break;}
      var seg=t.slice(x.at,end),cut=seg.search(/(?:コスト|こすと|コスと|職業|因子|技能|固有)/);if(cut>0)seg=seg.slice(0,cut);
      var d=dir(seg);
      if(d)out.push({stat:x.stat,direction:d});
    });
    var sharedText=t,sharedCut=sharedText.search(/(?:コスト|こすと|コスと|職業|因子|技能|固有)/);if(sharedCut>0)sharedText=sharedText.slice(0,sharedCut);
    var shared=dir(sharedText),hasMixed=/(?:けど|けれど|一方|反対に|逆に)/.test(t);
    if((!out.length||(!hasMixed&&out.length<list.length))&&shared){
      out=[];list.forEach(function(st){out.push({stat:st,direction:shared});});
    }
    var seen=Object.create(null);return out.filter(function(x){if(seen[x.stat])return false;seen[x.stat]=1;return true;});
  }
  function relativeCostMode(text){
    var t=nfkc(text);
    if(/(?:同じコスト|同コスト).*(?:以下|低い|安い)|(?:コスト).*(?:同じか低い|同じ以下)/.test(t))return 'atMost';
    if(/(?:同じコスト|同コスト).*(?:以上|高い)|(?:コスト).*(?:同じか高い|同じ以上)/.test(t))return 'atLeast';
    if(/(?:同じコスト|同コスト)/.test(t))return 'same';
    if(/(?:コスト).*(?:より低い|低い|未満|安い)/.test(t))return 'lower';
    if(/(?:コスト).*(?:より高い|高い|超え)/.test(t))return 'higher';
    return '';
  }
  function relativeScore(row,base,conditions,ranges){
    return conditions.reduce(function(sum,c){var diff=c.direction==='low'?base._stats[c.stat]-row._stats[c.stat]:row._stats[c.stat]-base._stats[c.stat];return sum+diff/(ranges[c.stat]||1);},0);
  }
  function multiStatNearest(base,rows,stats){
    var ranges={};stats.forEach(function(st){ranges[st]=statRange(rows,st);});
    return rows.filter(function(r){return r!==base;}).map(function(r){
      var parts=stats.map(function(st){return Math.abs(r._stats[st]-base._stats[st])/ranges[st].span;});
      return {row:r,distance:parts.reduce(function(a,b){return a+b;},0),parts:parts};
    }).sort(function(a,b){return a.distance-b.distance||String(a.row['英傑名']).localeCompare(String(b.row['英傑名']),'ja');});
  }
  function parseTopEntry(text){
    var t=nfkc(text),m=t.match(/(?:トップ|とップ|とっぷ|上位)\s*([0-9]{1,2})\s*(?:位)?(?:入り|以内|に入る|に入った|入っている)/);
    if(!m)m=t.match(/([0-9]{1,2})\s*位以内(?:に入る|入り|の)?/);
    return m?Math.min(50,Math.max(1,Number(m[1]))):0;
  }
  function parseEntryResultCount(text){
    var t=nfkc(text).replace(/(?:トップ|とップ|とっぷ|上位)\s*[0-9]{1,2}\s*(?:位)?(?:入り|以内|に入る|に入った|入っている)/g,'');
    return parseTop(t);
  }
  function topEntryLeaders(rows,stats,topN){
    var map=new Map();rows.forEach(function(r){map.set(r,{row:r,count:0,stats:[],rankSum:0});});
    stats.forEach(function(stat){
      rows.forEach(function(r){var ri=rankInfo(rows,r,stat,false);if(ri.rank<=topN){var x=map.get(r);x.count++;x.stats.push(stat+' '+ri.rank+'位');x.rankSum+=ri.rank;}});
    });
    return Array.from(map.values()).filter(function(x){return x.count>0;}).sort(function(a,b){return b.count-a.count||a.rankSum-b.rankSum||String(a.row['英傑名']).localeCompare(String(b.row['英傑名']),'ja');});
  }
  function parseStatBand(text,stat){
    var t=nfkc(text),aliases=[];STAT_ALIASES.forEach(function(x){if(x.to===stat)aliases=x.a.slice();});aliases.sort(function(a,b){return b.length-a.length;});
    for(var i=0;i<aliases.length;i++){
      var a=esc(aliases[i]),m=t.match(new RegExp(a+'(?:が|は|を)?\\s*([0-9])000\\s*台'));
      if(m){var base=Number(m[1])*1000;return {type:'band',min:base,max:base+999,label:base+'台'};}
      m=t.match(new RegExp(a+'(?:が|は|を)?\\s*([0-9]{3,5})\\s*(?:から|〜|～|~|－|-)\\s*([0-9]{3,5})'));
      if(m){var lo=Number(m[1]),hi=Number(m[2]);if(lo>hi){var z=lo;lo=hi;hi=z;}return {type:'range',min:lo,max:hi,label:lo+'〜'+hi};}
      m=t.match(new RegExp(a+'(?:が|は|を)?\\s*([0-9]{3,5})\\s*(?:前後|ぜんご|くらい|ぐらい|付近|ふきん|あたり|に近い|にちかい|近辺)'));
      if(m)return {type:'near',target:Number(m[1]),label:String(Number(m[1]))};
    }
    var generic=t.match(/([0-9]{3,5})\s*(?:前後|ぜんご|くらい|ぐらい|付近|ふきん|あたり|に近い|にちかい|近辺)/);
    if(generic)return {type:'near',target:Number(generic[1]),label:String(Number(generic[1]))};
    return null;
  }
  function sortedByStat(rows,stat,low){return rows.slice().sort(function(a,b){var d=low?a._stats[stat]-b._stats[stat]:b._stats[stat]-a._stats[stat];return d||String(a['英傑名']).localeCompare(String(b['英傑名']),'ja');});}
  function groupAggregates(rows,key,stat,useMedian){
    var groups=Object.create(null);rows.forEach(function(r){var k=S(r[key]);if(!k)return;(groups[k]||(groups[k]=[])).push(r._stats[stat]);});
    return Object.keys(groups).sort(function(a,b){return key==='コスト'?Number(a)-Number(b):a.localeCompare(b,'ja');}).map(function(k){var vals=groups[k],v=useMedian?median(vals):vals.reduce(function(x,y){return x+y;},0)/vals.length;return {group:k,value:rounded(v),count:vals.length};});
  }
  function tieGroups(rows,stat){
    var map=Object.create(null);rows.forEach(function(r){var v=r._stats[stat];(map[v]||(map[v]=[])).push(r);});
    return Object.keys(map).filter(function(v){return map[v].length>=2;}).map(function(v){return {value:Number(v),rows:map[v]};}).sort(function(a,b){return b.value-a.value;});
  }
  function factorCountGroups(){
    var counts={2:0,3:0,4:0};data().rows.forEach(function(r){var n=rowFactors(r).length;counts[n]=(counts[n]||0)+1;});return counts;
  }
  function groupCounts(key,rows){
    var counts=Object.create(null);(Array.isArray(rows)?rows:data().rows).forEach(function(r){var k=S(r[key]);if(k)counts[k]=(counts[k]||0)+1;});
    return Object.keys(counts).sort(function(a,b){return key==='コスト'?Number(a)-Number(b):a.localeCompare(b,'ja');}).map(function(k){return {group:k,count:counts[k]};});
  }
  function commonFactors(rows){
    if(!rows.length)return [];
    var base=rowFactors(rows[0]);
    return base.filter(function(f){return rows.slice(1).every(function(r){return rowFactors(r).indexOf(f)>=0;});});
  }
  function pairStatDifferences(a,b,stats,percentage){
    return (stats&&stats.length?stats:STAT_ORDER).map(function(st){
      var av=a._stats[st],bv=b._stats[st],diff=Math.abs(av-bv),denom=(Math.abs(av)+Math.abs(bv))/2,rate=denom?diff/denom*100:0;
      return {stat:st,a:av,b:bv,diff:diff,rate:rate,winner:av===bv?'':(av>bv?a['英傑名']:b['英傑名'])};
    }).sort(function(x,y){var xv=percentage?x.rate:x.diff,yv=percentage?y.rate:y.diff;return yv-xv||STAT_ORDER.indexOf(x.stat)-STAT_ORDER.indexOf(y.stat);});
  }
  function perStatLeaders(rows,stats){
    return (stats&&stats.length?stats:STAT_ORDER).map(function(st){
      var max=Math.max.apply(null,rows.map(function(r){return r._stats[st];})),leaders=rows.filter(function(r){return r._stats[st]===max;});
      return {stat:st,value:max,leaders:leaders};
    });
  }
  function leaderCounts(rows,stats){
    var counts=new Map();rows.forEach(function(r){counts.set(r,{row:r,count:0,stats:[]});});
    perStatLeaders(rows,stats).forEach(function(x){x.leaders.forEach(function(r){var c=counts.get(r);c.count++;c.stats.push(x.stat);});});
    return Array.from(counts.values()).sort(function(a,b){return b.count-a.count||String(a.row['英傑名']).localeCompare(String(b.row['英傑名']),'ja');});
  }
  function sharedRegistration(rows){
    if(!rows.length)return {job:'',cost:null,factors:[],skill:'',equalStats:[]};
    var job=rows.every(function(r){return r['職業']===rows[0]['職業'];})?rows[0]['職業']:'',cost=rows.every(function(r){return Number(r['コスト'])===Number(rows[0]['コスト']);})?Number(rows[0]['コスト']):null;
    var skill0=S(rows[0]['技能']),skill=skill0&&skill0!=='対象外'&&skill0!=='なし'&&rows.every(function(r){return S(r['技能'])===skill0;})?skill0:'';
    var equalStats=STAT_ORDER.filter(function(st){return rows.every(function(r){return r._stats[st]===rows[0]._stats[st];});});
    return {job:job,cost:cost,factors:commonFactors(rows),skill:skill,equalStats:equalStats};
  }
  function strengthProfile(r){
    var rows=data().rows,profile=STAT_ORDER.map(function(st){var ri=rankInfo(rows,r,st,false);return {stat:st,rank:ri.rank,total:ri.total,value:ri.value};});
    profile.sort(function(a,b){return a.rank-b.rank||STAT_ORDER.indexOf(a.stat)-STAT_ORDER.indexOf(b.stat);});
    return profile;
  }
  function detailKeywordRows(concepts){
    return data().rows.filter(function(r){return validSkill(r)&&concepts.every(function(c){return detailMatches(r,c);});});
  }
  function groupedLeaders(rows,key,stat,low){
    var groups=Object.create(null);rows.forEach(function(r){var k=S(r[key]);if(!k)return;(groups[k]||(groups[k]=[])).push(r);});
    return Object.keys(groups).sort(function(a,b){return key==='コスト'?Number(a)-Number(b):a.localeCompare(b,'ja');}).map(function(k){
      var list=groups[k].slice().sort(function(a,b){var d=low?a._stats[stat]-b._stats[stat]:b._stats[stat]-a._stats[stat];return d||String(a['英傑名']).localeCompare(String(b['英傑名']),'ja');});
      return {group:k,row:list[0],count:list.length};
    });
  }
  function factorFrequency(rows){
    var counts=Object.create(null);(Array.isArray(rows)?rows:data().rows).forEach(function(r){rowFactors(r).forEach(function(f){counts[f]=(counts[f]||0)+1;});});
    return Object.keys(counts).map(function(f){return {factor:f,count:counts[f]};}).sort(function(a,b){return b.count-a.count||a.factor.localeCompare(b.factor,'ja');});
  }
  function listRanking(f,stats,text,priorRefinement){
    var low=/低い|低め|最低|最小|ワースト|下位/.test(nfkc(text)),n=parseTop(text),sum=stats.length>1;
    var sorted=f.rows.slice().sort(function(a,b){var av=scoreOf(a,stats),bv=scoreOf(b,stats),diff=low?av-bv:bv-av;return diff||String(a['英傑名']).localeCompare(String(b['英傑名']),'ja');});
    if(!sorted.length)return result('英傑マスター実データ',filterLabel(f)+'該当英傑は、現在の英傑マスターには見つかりませんでした。',{notFound:true});
    var top=sorted.slice(0,n),label=sum?stats.join('＋')+'合計':stats[0];
    var lines=top.map(function(r,i){var vals=sum?stats.map(function(st){return st+':'+r._stats[st];}).join(' / '):label+':'+r._stats[label];return (i+1)+'位：'+r['英傑名']+'（'+vals+(sum?' / 合計:'+scoreOf(r,stats):'')+'）';});
    var meta=scopeMeta(f.scopeNames,{ranking:true,stats:stats,low:low,count:top.length,heroes:top.map(function(r){return r['英傑名'];})});
    attachRefinementMeta(meta,f,top,stats,low,priorRefinement);
    return result('英傑マスター実データ',filterLabel(f)+label+(low?'が低い':'が高い')+'順の上位'+top.length+'人です。\n'+lines.join('\n')+sourceSuffix(),meta);
  }
  function heroSummary(r){
    return r['英傑名']+'は、職業 '+r['職業']+'・コスト'+r['コスト']+'です。\n'+
      '能力：'+STAT_ORDER.map(function(st){return st+' '+r._stats[st];}).join(' / ')+'\n'+
      '因子：'+(rowFactors(r).join(' / ')||'登録なし')+'\n'+
      '技能：'+(S(r['技能'])||'登録なし')+(S(r['詳細'])?'\n技能詳細：'+r['詳細']:'')+sourceSuffix();
  }

  function respond(text,opt){
    opt=opt||{};
    var routedText=nfkc(text),suppliedOriginal=nfkc(opt.original||text),pairGapContext=latestPairGapContext(opt.history),groupReplacement=detectGroupReplacement(suppliedOriginal,opt.history),pairReplacement=groupReplacement?null:detectPairReplacement(suppliedOriginal,opt.history),refinementContext=latestHeroRefinementContext(opt.history),savedViewCommand=parseSavedViewCommand(suppliedOriginal,opt.history),refinementHistoryCommand=savedViewCommand?null:parseRefinementHistoryCommand(suppliedOriginal,opt.history),refinementChangeQuestion=savedViewCommand?null:parseRefinementChangeQuestion(suppliedOriginal,opt.history),refinementEdit=(savedViewCommand||refinementHistoryCommand)?null:parseRefinementEdit(suppliedOriginal,opt.history),rootScope=latestHeroScope(opt.history),activeScope=latestHeroActiveScope(opt.history),implicitScopeRequested=!!activeScope&&!contextScopeCue(suppliedOriginal)&&implicitContextScopeCue(suppliedOriginal,activeScope),original=(contextScopeCue(suppliedOriginal)||implicitScopeRequested)?suppliedOriginal:routedText,earlyStats=detectStats(original),globalRankRef=parseGlobalRankReference(original,earlyStats),scope=implicitScopeRequested?activeScope:rootScope,scopeRequested=(implicitScopeRequested||explicitContextScopeCue(original)||!!scope&&contextScopeCue(original))&&!globalRankRef,selection=scope?selectContextNames(original,scope.names):{names:[],label:'',invalid:false},contextName=contextHeroName(original,opt.history),contextNames=selection.names.length?selection.names:contextHeroNames(original,opt.history),earlySkillConcepts=detectSkillConcepts(original),earlyFactorCount=detectFactorCount(original),scopeRows=scope&&scopeRequested?rowsByNames(scope.names):[],scopeNames=scope&&scopeRequested?scope.names.slice():[];
    if(!original||isBlocked(original)||isSearchAction(original)||isNavigationOnly(original)||(!hasHeroFactCue(original)&&!contextName&&!contextNames.length&&!scopeRequested&&!pairReplacement&&!groupReplacement&&!refinementEdit&&!refinementHistoryCommand&&!refinementChangeQuestion&&!savedViewCommand))return {handled:false};
    if(savedViewCommand)return renderSavedViewCommand(savedViewCommand);
    if(refinementHistoryCommand)return renderRefinementHistoryCommand(refinementHistoryCommand);
    if(refinementChangeQuestion)return renderRefinementChangeQuestion(refinementChangeQuestion,opt.history);
    if(refinementEdit)return renderRefinementEdit(refinementEdit);
    if(scopeRequested&&!scope)return result('英傑マスター確認','「この中」「その順位」として参照できる直前の英傑一覧がありません。先に「腕力トップ10」のように候補を出すか、英傑名を指定してください。',{needsClarification:true,needsHeroScope:true});
    if(scopeRequested&&selection.invalid)return result('英傑マスター確認','直前の候補は '+scope.names.length+'人です。その範囲にない順位が指定されています。1位〜'+scope.names.length+'位の中から選んでください。',scopeMeta(scope.names,{needsClarification:true,invalidContextRank:true}));
    if(groupReplacement&&groupReplacement.ambiguous)return result('英傑マスター確認','「'+groupReplacement.ambiguous.query+'」に近い英傑が複数います。\n'+groupReplacement.ambiguous.candidates.join(' / ')+'\n差し替える英傑名をもう少し詳しく教えてください。',{needsClarification:true,groupTargetReplacement:true,candidates:groupReplacement.ambiguous.candidates,query:groupReplacement.ambiguous.query});
    if(groupReplacement&&groupReplacement.needsClarification)return result('英傑マスター確認',groupReplacement.sameTarget?'その位置はすでに '+groupReplacement.group.heroes[replacementTargetIndex(original,groupReplacement.group.heroes)]+' です。別の英傑へ変える場合は、新しい名前を指定してください。':(groupReplacement.sameHero?'比較対象に同じ英傑が重複します。別の英傑を指定してください。':'どの英傑を、誰に差し替えるか教えてください。例：「3人目を遠足娘まりに変えて」のように指定できます。'),{needsClarification:true,groupTargetReplacement:true,heroes:groupReplacement.heroes||groupReplacement.group.heroes.slice()});
    if(groupReplacement&&groupReplacement.row)return renderGroupReplacement(groupReplacement);
    var named=exactNamedRows(original),fuzzy=null,comparisonAugment=augmentComparisonNames(original,named),comparisonCorrections=comparisonAugment.corrections||[];
    named=comparisonAugment.rows||named;
    if(comparisonAugment.ambiguous)return result('英傑マスター確認','「'+comparisonAugment.ambiguous.query+'」に近い英傑が複数います。\n'+comparisonAugment.ambiguous.candidates.join(' / ')+'\nどの英傑か、名前をもう少し詳しく教えてください。',{needsClarification:true,candidates:comparisonAugment.ambiguous.candidates,query:comparisonAugment.ambiguous.query});
    if(pairReplacement&&pairReplacement.ambiguous)return result('英傑マスター確認','「'+pairReplacement.ambiguous.query+'」に近い英傑が複数います。\n'+pairReplacement.ambiguous.candidates.join(' / ')+'\n差し替える英傑名をもう少し詳しく教えてください。',{needsClarification:true,comparisonTargetReplacement:true,candidates:pairReplacement.ambiguous.candidates,query:pairReplacement.ambiguous.query});
    if(pairReplacement&&pairReplacement.needsClarification)return result('英傑マスター確認',pairReplacement.sameHero?'比較する2人が同じ英傑になっています。別の英傑を指定してください。':'どちらの英傑を、誰に差し替えるか教えてください。例：「後者を母里太兵衛に変えて」のように指定できます。',{needsClarification:true,comparisonTargetReplacement:true,heroes:pairReplacement.heroes||pairReplacement.pair.heroes.slice()});
    if(pairReplacement&&pairReplacement.row){
      named=rowsByNames(pairReplacement.heroes);
      if(pairReplacement.correction)comparisonCorrections.push(pairReplacement.correction);
    }
    if(!named.length&&contextNames.length)named=contextNames.map(function(name){return data().rows.filter(function(r){return r['英傑名']===name;})[0];}).filter(Boolean);
    if(!named.length&&contextName&&!scopeRequested)named=exactNamedRows(contextName);
    if(!named.length&&!earlySkillConcepts.length&&!earlyFactorCount&&!scopeRequested){fuzzy=fuzzyName(original);if(fuzzy&&fuzzy.row)named=[fuzzy.row];}
    if(fuzzy&&fuzzy.ambiguous)return result('英傑マスター確認','「'+fuzzy.query+'」に近い英傑が複数います。\n'+fuzzy.candidates.join(' / ')+'\nどの英傑か、名前をもう少し詳しく教えてください。',{needsClarification:true,candidates:fuzzy.candidates,query:fuzzy.query});
    if(fuzzy&&fuzzy.notFound&&candidateName(original))return result('英傑マスター確認','「'+fuzzy.query+'」は現在の英傑マスターに見つかりませんでした。誤字や表記違いかもしれないので、分かる範囲でもう一度名前を教えてください。',{notFound:true,query:fuzzy.query});

    var stats=earlyStats;
    if(pairReplacement&&pairReplacement.row&&!stats.length&&pairReplacement.pair.comparison)stats=pairReplacement.pair.stats.slice();
    if(named.length===1&&!stats.length&&/(?:全能力|全ステータス|全ステ|すべての能力|全部の能力)/.test(original)&&/(?:より|上回|下回|超え|未満)/.test(original))stats=STAT_ORDER.slice();
    if(!named.length&&globalRankRef){var grList=sortedByStat(data().rows,globalRankRef.stat,globalRankRef.low),grRow=grList[globalRankRef.rank-1];if(grRow)named=[grRow];}
    if(!stats.length&&named.length>=2&&/(?:どっち|どちら|両方|2人|二人).*(?:高い|低い|値|数値|能力)|(?:高い|低い).*(?:どっち|どちら)/.test(original))stats=contextStats(opt.history);
    if(/全MAX|見聞録MAX|鬼神石MAX|転生MAX|全マックス/.test(original)&&stats.length&&!named.length){
      return result('英傑マスター確認','個別英傑の全MAX込み順位として答えるか、6人編成の全MAX検索として探すかで結果が変わります。\n英傑単体の基礎値ランキングなら、そのまま「'+stats.join('と')+'が高い英傑」と聞いてください。6人編成なら「全MAX込みで'+stats.join('と')+'が高い編成を検索」と言えば陣法検索へつなげます。',{needsClarification:true,needsMaxScope:true,stats:stats});
    }
    var factorCount=earlyFactorCount,skillConcepts=earlySkillConcepts;
    if(!named.length&&(((scopeRows.length||scopeNames.length)&&/(?:この中|その中|この人たち|この英傑たち).*(?:一番|いちばん|最も|どれ|誰|だれ).*(?:強い|おすすめ|優秀|いい|良い)|(?:この中|その中).*(?:総合|バランス|おすすめ)/.test(original))||/(?:総合的?に?|全体的?に?|トータルで).*(?:強い|高い|おすすめ|優秀)|(?:バランス|均整).*(?:いい|良い|高い|おすすめ)/.test(original))){
      return result('英傑マスター確認','「総合的に強い」「バランスがいい」は、どの能力を重視するかで順位が変わります。\n腕力・耐久・知力などの能力を指定するか、「腕力と知力の合計」のように評価基準を教えてください。',scopeMeta(scopeNames,{needsClarification:true,needsMetric:true}));
    }
    if(named.length&& !stats.length&&/(?:似た英傑|似ている英傑|似てる英傑|誰に似て|だれに似て|近い英傑)/.test(original)){
      return result('英傑マスター確認',named.map(function(r){return r['英傑名'];}).join('と')+'について、どの点が似ている英傑を探しますか？\n腕力・知力などの能力、職業、因子、技能のどれを基準にするか教えてください。',{needsClarification:true,needsSimilarityBasis:true,heroes:named.map(function(r){return r['英傑名'];})});
    }
    if(named.length===1&&/(?:上位互換|下位互換|完全上位|完全下位)/.test(original)){
      return result('英傑マスター確認',named[0]['英傑名']+'の「'+(/下位/.test(original)?'下位互換':'上位互換')+'」を、どの基準で探すか教えてください。\n能力だけなら「腕力と知力が両方高い」、条件も付けるなら「同じ職業・同じコストで腕力が高い」のように指定できます。因子や技能は単純な上下関係を決められないため、勝手には評価しません。',{needsClarification:true,needsUpgradeBasis:true,hero:named[0]['英傑名']});
    }
    if(named.length===1&&!stats.length&&/(?:よりも?).*(?:高い|低い|上回る|下回る).*(?:能力|項目).*(?:いくつ|何個|何項目)/.test(original)){
      return result('英傑マスター確認',named[0]['英傑名']+'と、どの英傑を比べるか教えてください。比較相手が決まれば、11能力のうち何項目高いかを数えられます。',{needsClarification:true,needsComparisonHero:true,hero:named[0]['英傑名']});
    }
    if(pairReplacement&&pairReplacement.row&&named.length>=2){
      var rp=named.slice(0,2),rpa=rp[0],rpb=rp[1],rpPrefix=comparisonCorrectionPrefix(comparisonCorrections)+'比較対象を '+pairReplacement.pair.heroes[pairReplacement.target]+' から '+pairReplacement.row['英傑名']+' に変更しました。\n';
      if(pairReplacement.pair.pairGap){
        var rpgStats=pairReplacement.pair.stats.length?pairReplacement.pair.stats.slice():STAT_ORDER.slice(),rpg=pairStatDifferences(rpa,rpb,rpgStats,pairReplacement.pair.percentage),rpgSame=pairReplacement.pair.sameOnly,rpgSmall=pairReplacement.pair.smallest,rpgTake;
        if(rpgSame)rpgTake=rpg.filter(function(x){return x.diff===0;});else{if(rpgSmall)rpg.reverse();rpgTake=rpg.slice(0,Math.min(pairReplacement.pair.gapCount||1,rpg.length));}
        return result('英傑マスター実データ',rpPrefix+rpa['英傑名']+'と'+rpb['英傑名']+'の'+(rpgSame?'同じ数値の能力':((rpgSmall?'差が小さい':'差が大きい')+(pairReplacement.pair.percentage?'割合':'登録値')))+'です。'+(rpgTake.length?'\n'+rpgTake.map(function(x,i){return (rpgSame?'':(i+1)+'位：')+x.stat+'（'+rpa['英傑名']+' '+x.a+' / '+rpb['英傑名']+' '+x.b+' / '+(pairReplacement.pair.percentage?'差 '+rounded(x.rate)+'%':'差 '+x.diff)+'）';}).join('\n'):'\n該当する能力はありません。')+sourceSuffix(),{comparisonTargetReplaced:true,pairGap:true,percentage:pairReplacement.pair.percentage,smallest:rpgSmall,sameOnly:rpgSame,heroes:pairReplacement.heroes.slice(),stats:rpgStats,gaps:rpgTake.map(function(x){return {stat:x.stat,a:x.a,b:x.b,diff:x.diff,rate:rounded(x.rate),winner:x.winner};})});
      }
      if(pairReplacement.pair.pairwiseWins){
        var rpwStats=pairReplacement.pair.stats.length?pairReplacement.pair.stats.slice():STAT_ORDER.slice(),rpaw=[],rpbw=[],rpt=[];
        rpwStats.forEach(function(st){var av=rpa._stats[st],bv=rpb._stats[st],diff=Math.abs(av-bv);if(av>bv)rpaw.push({stat:st,diff:diff});else if(bv>av)rpbw.push({stat:st,diff:diff});else rpt.push(st);});
        return result('英傑マスター実データ',rpPrefix+rpa['英傑名']+'と'+rpb['英傑名']+'を'+rpwStats.length+'能力で比べます。\n'+rpa['英傑名']+'が高い：'+rpaw.length+'項目'+(rpaw.length?'（'+rpaw.map(function(x){return x.stat+' +'+x.diff;}).join(' / ')+'）':'')+'\n'+rpb['英傑名']+'が高い：'+rpbw.length+'項目'+(rpbw.length?'（'+rpbw.map(function(x){return x.stat+' +'+x.diff;}).join(' / ')+'）':'')+(rpt.length?'\n同値：'+rpt.length+'項目（'+rpt.join(' / ')+'）':'')+sourceSuffix(),{comparisonTargetReplaced:true,pairwiseWins:true,heroes:pairReplacement.heroes.slice(),stats:rpwStats,wins:[{hero:rpa['英傑名'],count:rpaw.length,stats:rpaw.map(function(x){return x.stat;})},{hero:rpb['英傑名'],count:rpbw.length,stats:rpbw.map(function(x){return x.stat;})}],ties:rpt});
      }
      if(pairReplacement.pair.fullComparison){
        var rpcf=commonFactors(rp),rpaf=rowFactors(rpa).filter(function(f){return rpcf.indexOf(f)<0;}),rpbf=rowFactors(rpb).filter(function(f){return rpcf.indexOf(f)<0;}),rpLines=STAT_ORDER.map(function(st){var av=rpa._stats[st],bv=rpb._stats[st];return st+'：'+rpa['英傑名']+' '+av+' / '+rpb['英傑名']+' '+bv+'（'+(av===bv?'同値':(av>bv?rpa['英傑名']:rpb['英傑名']))+'）';});
        return result('英傑マスター実データ',rpPrefix+rpa['英傑名']+'と'+rpb['英傑名']+'の登録内容を比べます。\n共通因子：'+(rpcf.join(' / ')||'なし')+'\n'+rpa['英傑名']+'だけの因子：'+(rpaf.join(' / ')||'なし')+'\n'+rpb['英傑名']+'だけの因子：'+(rpbf.join(' / ')||'なし')+'\n'+rpLines.join('\n')+sourceSuffix(),{comparisonTargetReplaced:true,fullComparison:true,heroes:pairReplacement.heroes.slice(),commonFactors:rpcf});
      }
      if(stats.length){
        var rpLines2=rp.map(function(r){return r['英傑名']+'：'+stats.map(function(st){return st+' '+r._stats[st];}).join(' / ');}),rpSorted=rp.slice().sort(function(a,b){return scoreOf(b,stats)-scoreOf(a,stats);}),rpLabel=stats.length>1?stats.join('＋')+'合計':stats[0];
        return result('英傑マスター実データ',rpPrefix+rpLabel+'で比べると、一番高いのは '+rpSorted[0]['英傑名']+' です。\n'+rpLines2.join('\n')+sourceSuffix(),{comparisonTargetReplaced:true,comparison:true,stats:stats,heroes:pairReplacement.heroes.slice()});
      }
      return result('英傑マスター確認',rpPrefix+rpa['英傑名']+'と'+rpb['英傑名']+'の、どの能力を比べますか？ 腕力・耐久・知力などを指定してください。',{comparisonTargetReplaced:true,needsClarification:true,heroes:pairReplacement.heroes.slice()});
    }

    if(!named.length&&factorCount&&/(?:何人|何名|何体|誰|だれ|一覧|教えて|見せて|いる|持ち)/.test(original)){
      var factorRows=data().rows.filter(function(r){return rowFactors(r).length===factorCount;}),factorTake=factorRows.slice(0,15);
      if(/何人|何名|何体|人数/.test(original))return result('英傑マスター実データ','因子を'+factorCount+'つ持つ英傑は '+factorRows.length+'人です。',{factorCount:true,value:factorCount,count:factorRows.length});
      return result('英傑マスター実データ','因子を'+factorCount+'つ持つ英傑は '+factorRows.length+'人です。\n'+factorTake.map(function(r){return r['英傑名']+'（'+rowFactors(r).join(' / ')+'）';}).join('\n')+(factorRows.length>factorTake.length?'\nほか '+(factorRows.length-factorTake.length)+'人います。':''),{factorCount:true,value:factorCount,count:factorRows.length,heroes:factorTake.map(function(r){return r['英傑名'];})});
    }
    if(!named.length&&/(?:因子数別|因子の数ごと|因子の個数ごと).*(?:人数|何人)|(?:人数|何人).*(?:因子数別|因子の数ごと)/.test(original)){
      var fcg=factorCountGroups();
      return result('英傑マスター実データ','因子数ごとの登録人数です。\n因子2つ：'+fcg[2]+'人\n因子3つ：'+fcg[3]+'人\n因子4つ：'+fcg[4]+'人',{factorCountGroups:true,counts:fcg});
    }
    if(!named.length&&scopeRows.length&&/(?:職業(?:別|ごと|内訳|分布)|何人ずつ.*職業|職業.*何人ずつ)/.test(original)){
      var sjcg=groupCounts('職業',scopeRows);
      return result('英傑マスター実データ','直前の候補'+scopeNames.length+'人の職業内訳です。\n'+sjcg.map(function(x){return x.group+'：'+x.count+'人';}).join('\n'),scopeMeta(scopeNames,{groupCounts:true,groupBy:'職業',groups:sjcg}));
    }
    if(!named.length&&scopeRows.length&&/(?:コスト(?:別|ごと|内訳|分布)|何人ずつ.*コスト|コスト.*何人ずつ)/.test(original)){
      var sccg=groupCounts('コスト',scopeRows);
      return result('英傑マスター実データ','直前の候補'+scopeNames.length+'人のコスト内訳です。\n'+sccg.map(function(x){return 'コスト'+x.group+'：'+x.count+'人';}).join('\n'),scopeMeta(scopeNames,{groupCounts:true,groupBy:'コスト',groups:sccg}));
    }
    if(!named.length&&/(?:職業別|職業ごと|各職業).*(?:人数|何人)|(?:人数|何人).*(?:職業別|職業ごと|各職業)/.test(original)){
      var jcg=groupCounts('職業');
      return result('英傑マスター実データ','職業ごとの登録人数です。\n'+jcg.map(function(x){return x.group+'：'+x.count+'人';}).join('\n'),{groupCounts:true,groupBy:'職業',groups:jcg});
    }
    if(!named.length&&/(?:コスト別|コストごと|各コスト).*(?:人数|何人)|(?:人数|何人).*(?:コスト別|コストごと|各コスト)/.test(original)){
      var ccg=groupCounts('コスト');
      return result('英傑マスター実データ','コストごとの登録人数です。\n'+ccg.map(function(x){return 'コスト'+x.group+'：'+x.count+'人';}).join('\n'),{groupCounts:true,groupBy:'コスト',groups:ccg});
    }
    if(!named.length&&skillConcepts.length&&/(?:英傑|武将|キャラ|誰|だれ|何人|何名|技能|持つ|ある|できる|する)/.test(original)){
      var conceptRows=detailKeywordRows(skillConcepts),conceptLabel=skillConcepts.map(function(c){return c.label;}).join('＋'),conceptTake=conceptRows.slice(0,15);
      if(/何人|何名|何体|人数/.test(original))return result('英傑マスター実データ','技能詳細に「'+conceptLabel+'」が登録されている英傑は '+conceptRows.length+'人です。',{skillDetailSearch:true,concepts:skillConcepts.map(function(c){return c.label;}),count:conceptRows.length});
      if(!conceptRows.length)return result('英傑マスター実データ','技能詳細に「'+conceptLabel+'」が登録されている英傑は、現在の英傑マスターには見つかりませんでした。',{skillDetailSearch:true,concepts:skillConcepts.map(function(c){return c.label;}),notFound:true});
      return result('英傑マスター実データ','技能詳細に「'+conceptLabel+'」が登録されている英傑は '+conceptRows.length+'人です。\n'+conceptTake.map(function(r){return r['英傑名']+'：'+r['技能'];}).join('\n')+(conceptRows.length>conceptTake.length?'\nほか '+(conceptRows.length-conceptTake.length)+'人います。':''),{skillDetailSearch:true,concepts:skillConcepts.map(function(c){return c.label;}),count:conceptRows.length,heroes:conceptTake.map(function(r){return r['英傑名'];})});
    }
    if(!named.length&&/因子/.test(original)&&/(?:一番|最も|どれ|何が).*(?:多い|多く)|(?:多い|多く).*(?:因子)/.test(original)){
      var ff=factorFrequency(scopeRows.length?scopeRows:null),fn=parseTop(original),fl=ff.slice(0,fn),ffPrefix=scopeRows.length?'直前の候補'+scopeNames.length+'人で':'英傑マスターで';
      return result('英傑マスター実データ',ffPrefix+'登録人数が多い因子の上位'+fl.length+'件です。\n'+fl.map(function(x,i){return (i+1)+'位：'+x.factor+'（'+x.count+'人）';}).join('\n'),scopeMeta(scopeNames,{factorFrequency:true,factors:fl}));
    }
    if(!named.length&&stats.length===1&&/(?:各職業|職業別|職業ごと|職業毎|どの職業|職業の中|高い職業|低い職業|職業.*(?:平均|中央値)|(?:平均|中央値).*職業)/.test(original)&&/(?:平均|平均値|中央値|真ん中の値)/.test(original)){
      var useJobMedian=/(?:中央値|真ん中の値)/.test(original),jag=groupAggregates(data().rows,'職業',stats[0],useJobMedian),jobOrder=/一番|最も|ランキング|順位|順|高い職業|低い職業/.test(original);
      if(jobOrder){
        var jobLow=/低い|最低|下位/.test(original),jobSorted=jag.slice().sort(function(a,b){return jobLow?a.value-b.value:b.value-a.value;}),jobTake=jobSorted.slice(0,parseTop(original));
        return result('英傑マスター実データ','職業ごとの'+stats[0]+'の'+(useJobMedian?'中央値':'平均値')+(jobLow?'が低い':'が高い')+'順です。\n'+jobTake.map(function(x,i){return (i+1)+'位：'+x.group+'（'+x.value+'・'+x.count+'人）';}).join('\n')+sourceSuffix(),{groupAggregate:true,groupAggregateRanking:true,groupBy:'職業',aggregateType:useJobMedian?'median':'average',stat:stats[0],low:jobLow,groups:jobTake});
      }
      return result('英傑マスター実データ','職業ごとの'+stats[0]+'の'+(useJobMedian?'中央値':'平均値')+'です。\n'+jag.map(function(x){return x.group+'：'+x.value+'（'+x.count+'人）';}).join('\n')+sourceSuffix(),{groupAggregate:true,groupBy:'職業',aggregateType:useJobMedian?'median':'average',stat:stats[0],groups:jag});
    }
    if(!named.length&&stats.length===1&&/(?:各コスト|コスト別|コストごと|コスト毎|どのコスト|コストの中|高いコスト|低いコスト|コスト.*(?:平均|中央値)|(?:平均|中央値).*コスト)/.test(original)&&/(?:平均|平均値|中央値|真ん中の値)/.test(original)){
      var useCostMedian=/(?:中央値|真ん中の値)/.test(original),cag=groupAggregates(data().rows,'コスト',stats[0],useCostMedian),costOrder=/一番|最も|ランキング|順位|順|高いコスト|低いコスト/.test(original);
      if(costOrder){
        var costLow=/低い|最低|下位/.test(original),costSorted=cag.slice().sort(function(a,b){return costLow?a.value-b.value:b.value-a.value;}),costTake=costSorted.slice(0,parseTop(original));
        return result('英傑マスター実データ','コストごとの'+stats[0]+'の'+(useCostMedian?'中央値':'平均値')+(costLow?'が低い':'が高い')+'順です。\n'+costTake.map(function(x,i){return (i+1)+'位：コスト'+x.group+'（'+x.value+'・'+x.count+'人）';}).join('\n')+sourceSuffix(),{groupAggregate:true,groupAggregateRanking:true,groupBy:'コスト',aggregateType:useCostMedian?'median':'average',stat:stats[0],low:costLow,groups:costTake});
      }
      return result('英傑マスター実データ','コストごとの'+stats[0]+'の'+(useCostMedian?'中央値':'平均値')+'です。\n'+cag.map(function(x){return 'コスト'+x.group+'：'+x.value+'（'+x.count+'人）';}).join('\n')+sourceSuffix(),{groupAggregate:true,groupBy:'コスト',aggregateType:useCostMedian?'median':'average',stat:stats[0],groups:cag});
    }
    if(!named.length&&stats.length===1&&/(?:各職業|職業別|職業ごと|職業毎)/.test(original)){
      var lowJob=/低い|最低|最小|下位/.test(original),jl=groupedLeaders(data().rows,'職業',stats[0],lowJob);
      return result('英傑マスター実データ','職業ごとの'+stats[0]+(lowJob?'最低':'最高')+'英傑です。\n'+jl.map(function(x){return x.group+'：'+x.row['英傑名']+'（'+stats[0]+':'+x.row._stats[stats[0]]+'）';}).join('\n')+sourceSuffix(),{groupRanking:true,groupBy:'職業',stat:stats[0],heroes:jl.map(function(x){return x.row['英傑名'];})});
    }
    if(!named.length&&stats.length===1&&/(?:各コスト|コスト別|コストごと|コスト毎)/.test(original)){
      var lowCost=/低い|最低|最小|下位/.test(original),cl=groupedLeaders(data().rows,'コスト',stats[0],lowCost);
      return result('英傑マスター実データ','コストごとの'+stats[0]+(lowCost?'最低':'最高')+'英傑です。\n'+cl.map(function(x){return 'コスト'+x.group+'：'+x.row['英傑名']+'（'+stats[0]+':'+x.row._stats[stats[0]]+'）';}).join('\n')+sourceSuffix(),{groupRanking:true,groupBy:'コスト',stat:stats[0],heroes:cl.map(function(x){return x.row['英傑名'];})});
    }
    var nestedLeaderMatch=!named.length&&!scopeRows.length&&stats.length===1&&nfkc(original).match(/(?:トップ|上位)\s*([0-9]{1,2})\s*(?:人|名|位)?[^。]{0,20}(?:能力ごと|各能力|能力別|ステータスごと)/),nestedCountMatch=!named.length&&!scopeRows.length&&stats.length===1&&nfkc(original).match(/(?:トップ|上位)\s*([0-9]{1,2})\s*(?:人|名|位)?[^。]{0,24}(?:一番|最も|最多).*(?:1位|トップ).*(?:取|獲)/);
    if(nestedLeaderMatch||nestedCountMatch){
      var nestedN=Math.min(20,Math.max(2,Number((nestedLeaderMatch||nestedCountMatch)[1]))),nestedBase=sortedByStat(data().rows,stats[0],false).slice(0,nestedN),nestedLabel=stats[0]+'トップ'+nestedN;
      if(nestedLeaderMatch){
        var nestedLeaders=perStatLeaders(nestedBase,STAT_ORDER);
        return result('英傑マスター実データ',nestedLabel+'の中での能力別トップです。\n'+nestedLeaders.map(function(x){return x.stat+'：'+x.leaders.map(function(r){return r['英傑名'];}).join(' / ')+'（'+x.value+'）';}).join('\n')+sourceSuffix(),{perStatLeaders:true,nestedRanking:true,baseStat:stats[0],heroes:nestedBase.map(function(r){return r['英傑名'];}),stats:STAT_ORDER.slice(),leaders:nestedLeaders.map(function(x){return {stat:x.stat,value:x.value,heroes:x.leaders.map(function(r){return r['英傑名'];})};})});
      }
      var nestedCounts=leaderCounts(nestedBase,STAT_ORDER),nestedMax=nestedCounts[0].count,nestedWinners=nestedCounts.filter(function(x){return x.count===nestedMax;});
      return result('英傑マスター実データ',nestedLabel+'の中で能力別1位を最も多く取るのは '+nestedWinners.map(function(x){return x.row['英傑名'];}).join(' / ')+' です（'+nestedMax+'能力）。\n'+nestedCounts.map(function(x){return x.row['英傑名']+'：'+x.count+'能力'+(x.stats.length?'（'+x.stats.join(' / ')+'）':'');}).join('\n')+sourceSuffix(),{leaderCounts:true,nestedRanking:true,baseStat:stats[0],heroes:nestedBase.map(function(r){return r['英傑名'];}),stats:STAT_ORDER.slice(),winners:nestedWinners.map(function(x){return x.row['英傑名'];}),counts:nestedCounts.map(function(x){return {hero:x.row['英傑名'],count:x.count,stats:x.stats.slice()};})});
    }
    var comparisonRows=named.length>=2?named.slice(0,10):(scopeRows.length>=2?scopeRows.slice(0,20):[]);
    var crossThreshold=parseCrossHeroStatThreshold(original);
    if(comparisonRows.length>=2&&crossThreshold){
      var crossStats=STAT_ORDER.filter(function(st){return crossThreshold.quantifier==='all'?comparisonRows.every(function(r){return crossThresholdMatch(r._stats[st],crossThreshold);}):comparisonRows.some(function(r){return crossThresholdMatch(r._stats[st],crossThreshold);});}),crossHead=selection.label||((scopeRows.length&&scopeRequested)?'直前の候補'+comparisonRows.length+'人':'指定した'+comparisonRows.length+'人'),crossQuant=crossThreshold.quantifier==='all'?'全員':'誰か1人以上';
      var crossLines=crossStats.map(function(st){return st+'：'+comparisonRows.map(function(r){return r['英傑名']+' '+r._stats[st];}).join(' / ');});
      return result('英傑マスター実データ',crossHead+'で、'+crossQuant+'が '+crossThreshold.value+crossThreshold.op+' になる能力は '+crossStats.length+'個です。'+(crossLines.length?'\n'+crossLines.join('\n'):'\n該当する能力はありません。')+'\n※生命・気合とその他能力では登録値の尺度が異なるため、数値条件をそのまま判定しています。'+sourceSuffix(),scopeMeta(scopeNames,{crossHeroThreshold:true,quantifier:crossThreshold.quantifier,value:crossThreshold.value,op:crossThreshold.op,heroes:comparisonRows.map(function(r){return r['英傑名'];}),stats:crossStats}));
    }
    if(comparisonRows.length>=2&&/(?:能力ごと|各能力|ステータスごと|能力別).*(?:一番|トップ|最高|誰|だれ)|(?:一番|トップ|最高).*(?:能力ごと|各能力|能力別)/.test(original)){
      var leaderStats=stats.length?stats.slice():STAT_ORDER.slice(),leaders=perStatLeaders(comparisonRows,leaderStats),leaderHead=selection.label||((scopeRows.length&&scopeRequested)?'直前の候補'+comparisonRows.length+'人':'指定した'+comparisonRows.length+'人');
      return result('英傑マスター実データ',leaderHead+'の能力別トップです。\n'+leaders.map(function(x){return x.stat+'：'+x.leaders.map(function(r){return r['英傑名'];}).join(' / ')+'（'+x.value+'）';}).join('\n')+sourceSuffix(),scopeMeta(scopeNames,{perStatLeaders:true,heroes:comparisonRows.map(function(r){return r['英傑名'];}),stats:leaderStats,leaders:leaders.map(function(x){return {stat:x.stat,value:x.value,heroes:x.leaders.map(function(r){return r['英傑名'];})};})}));
    }
    if(comparisonRows.length>=2&&/(?:一番|最も|最多).*(?:多く|たくさん).*(?:1位|トップ).*(?:取|獲)|(?:1位|トップ).*(?:回数|数).*(?:多い|最多)|(?:能力別|各能力).*(?:1位|トップ).*(?:多い|最多)/.test(original)){
      var countStats=stats.length?stats.slice():STAT_ORDER.slice(),lc=leaderCounts(comparisonRows,countStats),maxCount=lc.length?lc[0].count:0,winners=lc.filter(function(x){return x.count===maxCount;}),lcHead=selection.label||((scopeRows.length&&scopeRequested)?'直前の候補'+comparisonRows.length+'人':'指定した'+comparisonRows.length+'人');
      return result('英傑マスター実データ',lcHead+'で能力別1位を最も多く取るのは '+winners.map(function(x){return x.row['英傑名'];}).join(' / ')+' です（'+maxCount+'能力）。\n'+lc.map(function(x){return x.row['英傑名']+'：'+x.count+'能力'+(x.stats.length?'（'+x.stats.join(' / ')+'）':'');}).join('\n')+sourceSuffix(),scopeMeta(scopeNames,{leaderCounts:true,heroes:comparisonRows.map(function(r){return r['英傑名'];}),stats:countStats,winners:winners.map(function(x){return x.row['英傑名'];}),counts:lc.map(function(x){return {hero:x.row['英傑名'],count:x.count,stats:x.stats.slice()};})}));
    }
    var gapFollowup=!!pairGapContext&&/^(?:じゃあ|では|なら|次は|今度は|それなら)?[、,\s　]*(?:割合|比率|パーセント|登録値|数値差)(?:だと|では|で|なら)?[？?]?$/.test(original);
    if(named.length>=2&&(/(?:差が(?:大き|小さ|少な|ない)|差の(?:大き|小さ)|開きが(?:大き|小さ)|最大差|最小差|同じ(?:数値|値)?の?能力|同値の能力)/.test(original)||gapFollowup)){
      var gdRows=named.slice(0,2),ga=gdRows[0],gb=gdRows[1],gdStats=stats.length?stats.slice():(gapFollowup&&pairGapContext?pairGapContext.stats.slice():STAT_ORDER.slice()),byRate=/(?:割合|比率|パーセント|％|%)/.test(original),gaps=pairStatDifferences(ga,gb,gdStats,byRate),sameGap=!gapFollowup&&/(?:差がない|同じ(?:数値|値)?の?能力|同値の能力)/.test(original),smallGap=gapFollowup&&pairGapContext?pairGapContext.smallest:/(?:小さ|少な|最小|近い)/.test(original),gdTake;
      if(sameGap){gdTake=gaps.filter(function(x){return x.diff===0;});if(!gdTake.length)return result('英傑マスター実データ',comparisonCorrectionPrefix(comparisonCorrections)+ga['英傑名']+'と'+gb['英傑名']+'に、同じ数値の能力はありません。'+sourceSuffix(),{pairGap:true,sameOnly:true,heroes:gdRows.map(function(r){return r['英傑名'];}),stats:gdStats,gaps:[]});}
      else{if(smallGap)gaps.reverse();gdTake=gaps.slice(0,Math.min(parseTop(original),gaps.length));}
      var gapLabel=sameGap?'同じ数値の能力':((smallGap?'差が小さい':'差が大きい')+(byRate?'割合':'登録値'));
      return result('英傑マスター実データ',comparisonCorrectionPrefix(comparisonCorrections)+ga['英傑名']+'と'+gb['英傑名']+'の'+gapLabel+'です。\n'+gdTake.map(function(x,i){return (sameGap?'':(i+1)+'位：')+x.stat+'（'+ga['英傑名']+' '+x.a+' / '+gb['英傑名']+' '+x.b+' / '+(byRate?'差 '+rounded(x.rate)+'%':'差 '+x.diff)+(x.winner?' / 高い方 '+x.winner:' / 同値')+'）';}).join('\n')+(byRate?'\n※割合差は2人の平均値に対する差の割合です。':'\n※「差」は英傑マスターの登録値を単純に引いた数値です。生命・気合と他能力では数値の尺度が異なります。')+sourceSuffix(),{pairGap:true,percentage:byRate,smallest:smallGap,sameOnly:sameGap,heroes:gdRows.map(function(r){return r['英傑名'];}),stats:gdStats,gaps:gdTake.map(function(x){return {stat:x.stat,a:x.a,b:x.b,diff:x.diff,rate:rounded(x.rate),winner:x.winner};})});
    }
    if(named.length>=2&&!stats.length&&/(?:共通点|同じところ|同じ点|似ているところ|共通しているところ)/.test(original)){
      var crRows=named.slice(0,10),shared=sharedRegistration(crRows),parts=[];
      if(shared.job)parts.push('職業：'+shared.job);if(shared.cost!==null)parts.push('コスト：'+shared.cost);if(shared.factors.length)parts.push('共通因子：'+shared.factors.join(' / '));if(shared.skill)parts.push('技能：'+shared.skill);if(shared.equalStats.length)parts.push('同値能力：'+shared.equalStats.map(function(st){return st+' '+crRows[0]._stats[st];}).join(' / '));
      return result('英傑マスター実データ',comparisonCorrectionPrefix(comparisonCorrections)+crRows.map(function(r){return r['英傑名'];}).join('・')+'の登録内容上の共通点です。\n'+(parts.length?parts.join('\n'):'職業・コスト・因子・技能・能力値に、全員共通の項目はありません。')+sourceSuffix(),{commonRegistration:true,heroes:crRows.map(function(r){return r['英傑名'];}),common:shared});
    }
    if(named.length>=2&&/(?:何項目|何能力|何個).*(?:高い|上回|勝)|(?:勝って|勝る|上回って|高い能力|優れている能力)/.test(original)){
      var pw=named.slice(0,2),pa=pw[0],pb=pw[1],pwStats=stats.length?stats.slice():STAT_ORDER.slice(),aWins=[],bWins=[],ties=[];
      pwStats.forEach(function(st){var av=pa._stats[st],bv=pb._stats[st],diff=Math.abs(av-bv);if(av>bv)aWins.push({stat:st,a:av,b:bv,diff:diff});else if(bv>av)bWins.push({stat:st,a:av,b:bv,diff:diff});else ties.push({stat:st,a:av,b:bv,diff:0});});
      var pwLines=[];
      pwLines.push(pa['英傑名']+'が高い：'+aWins.length+'項目'+(aWins.length?'（'+aWins.map(function(x){return x.stat+' +'+x.diff;}).join(' / ')+'）':''));
      pwLines.push(pb['英傑名']+'が高い：'+bWins.length+'項目'+(bWins.length?'（'+bWins.map(function(x){return x.stat+' +'+x.diff;}).join(' / ')+'）':''));
      if(ties.length)pwLines.push('同値：'+ties.length+'項目（'+ties.map(function(x){return x.stat;}).join(' / ')+'）');
      return result('英傑マスター実データ',comparisonCorrectionPrefix(comparisonCorrections)+pa['英傑名']+'と'+pb['英傑名']+'を'+pwStats.length+'能力で比べます。\n'+pwLines.join('\n')+sourceSuffix(),{pairwiseWins:true,heroes:pw.map(function(r){return r['英傑名'];}),stats:pwStats,wins:[{hero:pa['英傑名'],count:aWins.length,stats:aWins.map(function(x){return x.stat;})},{hero:pb['英傑名'],count:bWins.length,stats:bWins.map(function(x){return x.stat;})}],ties:ties.map(function(x){return x.stat;})});
    }
    if(named.length>=2&&/(?:共通.*因子|同じ因子|因子.*共通)/.test(original)){
      var cfRows=named.slice(0,6),cf=commonFactors(cfRows);
      return result('英傑マスター実データ',comparisonCorrectionPrefix(comparisonCorrections)+cfRows.map(function(r){return r['英傑名'];}).join('と')+'の共通因子は '+(cf.length?'「'+cf.join(' / ')+'」':'ありません')+'。',{factorComparison:true,heroes:cfRows.map(function(r){return r['英傑名'];}),commonFactors:cf});
    }
    if(named.length>=2&&!stats.length&&/(?:職業|コスト|因子|技能|固有)/.test(original)){
      var mfAskJob=/職業|職は/.test(original),mfAskCost=/(?:コスト|こすと|コスと)/.test(original),mfAskFactors=/因子/.test(original),mfAskSkill=/技能|固有/.test(original),mfRows=named.slice(0,10);
      var mfLines=mfRows.map(function(r){var parts=[];if(mfAskJob)parts.push('職業 '+r['職業']);if(mfAskCost)parts.push('コスト'+r['コスト']);if(mfAskFactors)parts.push('因子 '+(rowFactors(r).join(' / ')||'登録なし'));if(mfAskSkill)parts.push('技能 '+(validSkill(r)?S(r['技能']):'登録なし'));return r['英傑名']+'：'+parts.join(' / ');});
      var mfExtra='';
      if(mfAskFactors&&/(?:比較|比べ|違い|共通)/.test(original)){var mfc=commonFactors(mfRows);mfExtra='\n共通因子：'+(mfc.length?mfc.join(' / '):'なし');}
      var mfHead=selection.label||('指定した'+mfRows.length+'人');
      return result('英傑マスター実データ',mfHead+'の登録内容です。\n'+mfLines.join('\n')+mfExtra,scopeMeta(scopeNames,{multiHeroFields:true,heroes:mfRows.map(function(r){return r['英傑名'];}),fields:{job:mfAskJob,cost:mfAskCost,factors:mfAskFactors,skill:mfAskSkill}}));
    }
    if(named.length>=2&&!stats.length&&/(?:違い|全体比較|全部比べ|全部比較|ステータス全部|能力全部)/.test(original)){
      var allCmp=named.slice(0,2),a=allCmp[0],b=allCmp[1],acf=commonFactors(allCmp),af=rowFactors(a).filter(function(f){return acf.indexOf(f)<0;}),bf=rowFactors(b).filter(function(f){return acf.indexOf(f)<0;});
      var statLines=STAT_ORDER.map(function(st){var av=a._stats[st],bv=b._stats[st],winner=av===bv?'同値':(av>bv?a['英傑名']:b['英傑名']);return st+'：'+a['英傑名']+' '+av+' / '+b['英傑名']+' '+bv+'（'+winner+'）';});
      return result('英傑マスター実データ',comparisonCorrectionPrefix(comparisonCorrections)+a['英傑名']+'と'+b['英傑名']+'の登録内容を比べます。\n職業・コスト：'+a['英傑名']+' '+a['職業']+'・'+a['コスト']+' / '+b['英傑名']+' '+b['職業']+'・'+b['コスト']+'\n共通因子：'+(acf.join(' / ')||'なし')+'\n'+a['英傑名']+'だけの因子：'+(af.join(' / ')||'なし')+'\n'+b['英傑名']+'だけの因子：'+(bf.join(' / ')||'なし')+'\n技能：'+a['英傑名']+'「'+(S(a['技能'])||'登録なし')+'」 / '+b['英傑名']+'「'+(S(b['技能'])||'登録なし')+'」\n'+statLines.join('\n')+sourceSuffix(),{fullComparison:true,heroes:allCmp.map(function(r){return r['英傑名'];}),commonFactors:acf});
    }
    if(named.length===1&&globalRankRef&&!/(?:因子|職業|コスト|技能|固有|詳細)/.test(original)){
      var grHero=named[0];
      return result('英傑マスター実データ',globalRankRef.stat+(globalRankRef.low?'が低い':'が高い')+'順の'+globalRankRef.rank+'位は '+grHero['英傑名']+'（'+globalRankRef.stat+':'+grHero._stats[globalRankRef.stat]+'）です。'+sourceSuffix(),{globalRankReference:true,hero:grHero['英傑名'],stat:globalRankRef.stat,rank:globalRankRef.rank,low:globalRankRef.low});
    }
    if(named.length===1&&/(?:何位|順位|上から何番|ランキングで何番)/.test(original)){
      var rankHero=named[0];
      if(!stats.length)return result('英傑マスター確認',rankHero['英傑名']+'の、どの能力の順位を知りたいですか？ 腕力・耐久・知力などを指定してください。',{needsClarification:true,hero:rankHero['英傑名'],needsStat:true});
      var rankFilter=filteredRows(original),rankRows=rankFilter.rows;
      if(/同じ職業/.test(original))rankRows=data().rows.filter(function(x){return x['職業']===rankHero['職業'];});
      if(/同じコスト/.test(original))rankRows=data().rows.filter(function(x){return Number(x['コスト'])===Number(rankHero['コスト']);});
      if(rankRows.indexOf(rankHero)<0)rankRows.push(rankHero);
      var rankScope=/同じ職業/.test(original)?'同じ職業「'+rankHero['職業']+'」の中':(/同じコスト/.test(original)?'同じコスト'+rankHero['コスト']+'の中':(rankFilter.job||rankFilter.cost||rankFilter.factors.length?filterLabel(rankFilter).replace(/の$/,'')+'の中':'全'+rankRows.length+'人の中'));
      var rankData=stats.map(function(st){var ri=rankInfo(rankRows,rankHero,st,false);return {stat:st,rank:ri.rank,total:ri.total,value:ri.value,tied:ri.tied};});
      return result('英傑マスター実データ',correctionPrefix(fuzzy)+rankHero['英傑名']+'は、'+rankScope+'で '+rankData.map(function(x){return x.stat+' '+x.value+'・'+x.rank+'位'+(x.tied>1?'タイ':'')+'／'+x.total+'人';}).join('、')+'です。'+sourceSuffix(),{heroRank:true,hero:rankHero['英傑名'],ranks:rankData});
    }
    if(named.length===1&&/(?:強み|つよみ|強いところ|強いとこ|長所|得意|とくい|弱み|よわみ|弱いところ|弱いとこ|短所|苦手|にがて|どの能力が高い|何が高い|どの能力が低い|何が低い)/.test(original)){
      var profHero=named[0],profile=strengthProfile(profHero),wantWeak=/(?:弱み|よわみ|弱いところ|弱いとこ|短所|苦手|にがて|低い)/.test(original),wantBoth=/(?:強み.*弱み|つよみ.*よわみ|長所.*短所|得意.*苦手|とくい.*にがて)/.test(original);
      var best=profile.slice(0,3),worst=profile.slice().sort(function(x,y){return y.rank-x.rank||STAT_ORDER.indexOf(x.stat)-STAT_ORDER.indexOf(y.stat);}).slice(0,3);
      var parts=[];
      if(!wantWeak||wantBoth)parts.push('上位に入る能力：'+best.map(function(x){return x.stat+' '+x.value+'（'+x.rank+'位／'+x.total+'人）';}).join(' / '));
      if(wantWeak||wantBoth)parts.push('順位が低めの能力：'+worst.map(function(x){return x.stat+' '+x.value+'（'+x.rank+'位／'+x.total+'人）';}).join(' / '));
      return result('英傑マスター実データ',correctionPrefix(fuzzy)+profHero['英傑名']+'の基礎値を、能力ごとに全英傑内順位で比べると次の通りです。\n'+parts.join('\n')+'\n※生命・気合と腕力などは数値尺度が違うため、素の数値同士ではなく能力別順位で見ています。',{strengthProfile:true,hero:profHero['英傑名'],best:best,worst:worst});
    }
    var relativeConditions=named.length===1?parseRelativeStatConditions(original,stats):[];
    if(named.length===1&&relativeConditions.length){
      var relBase=named[0],relFilter=filteredRows(original),relRows=relFilter.rows.filter(function(x){return x!==relBase;}),costMode=relativeCostMode(original),relLabels=[];
      if(/(?:同じ職業|同職)/.test(original)){relRows=relRows.filter(function(x){return x['職業']===relBase['職業'];});relLabels.push('同じ職業「'+relBase['職業']+'」');}
      if(/(?:同じ因子構成|因子構成が同じ)/.test(original)){var relFactorKey=rowFactors(relBase).slice().sort().join('|');relRows=relRows.filter(function(x){return rowFactors(x).slice().sort().join('|')===relFactorKey;});relLabels.push('同じ因子構成');}
      if(costMode){relRows=relRows.filter(function(x){var c=Number(x['コスト']),b=Number(relBase['コスト']);return costMode==='same'?c===b:(costMode==='atMost'?c<=b:(costMode==='atLeast'?c>=b:(costMode==='lower'?c<b:c>b)));});relLabels.push(costMode==='same'?'同じコスト'+relBase['コスト']:(costMode==='atMost'?'コスト'+relBase['コスト']+'以下':(costMode==='atLeast'?'コスト'+relBase['コスト']+'以上':(costMode==='lower'?'コスト'+relBase['コスト']+'未満':'コスト'+relBase['コスト']+'超'))));}
      var relUnion=/(?:どちらか|どっちか|いずれか|または|片方でも)/.test(original),relMatches=relRows.filter(function(x){return relUnion?relativeConditions.some(function(c){return c.direction==='low'?x._stats[c.stat]<relBase._stats[c.stat]:x._stats[c.stat]>relBase._stats[c.stat];}):relativeConditions.every(function(c){return c.direction==='low'?x._stats[c.stat]<relBase._stats[c.stat]:x._stats[c.stat]>relBase._stats[c.stat];});}),relRanges={};
      relativeConditions.forEach(function(c){relRanges[c.stat]=statRange(data().rows,c.stat).span;});
      relMatches.sort(function(a,b){var as=relativeScore(a,relBase,relativeConditions,relRanges),bs=relativeScore(b,relBase,relativeConditions,relRanges);return bs-as||String(a['英傑名']).localeCompare(String(b['英傑名']),'ja');});
      var relConditionLabel=relativeConditions.map(function(c){return c.stat+(c.direction==='low'?'が低い':'が高い');}).join(relUnion?'、または ':'・'),relTake=relMatches.slice(0,Math.min(parseTop(original),20)),relPrefix=relLabels.length?relLabels.join('・')+'で、':'',relCorrection=correctionPrefix(fuzzy),relMeta={relativeMulti:true,hero:relBase['英傑名'],conditions:relativeConditions,operation:relUnion?'union':'intersection',count:relMatches.length,filters:relLabels};
      if(relativeConditions.length===1){relMeta.relative=true;relMeta.stat=relativeConditions[0].stat;relMeta.higher=relativeConditions[0].direction==='high';}
      if(/何人|何名|何体|人数/.test(original))return result('英傑マスター実データ',relCorrection+relPrefix+relBase['英傑名']+'より '+relConditionLabel+' 英傑は '+relMatches.length+'人です。'+sourceSuffix(),relMeta);
      var relHead=relMatches.length?relBase['英傑名']+'より '+relConditionLabel+' 英傑は '+relMatches.length+'人です。':relBase['英傑名']+'より '+relConditionLabel+' 該当英傑はいません。';
      relMeta.heroes=relTake.map(function(x){return x['英傑名'];});
      return result('英傑マスター実データ',relCorrection+relPrefix+relHead+(relTake.length?'\n'+relTake.map(function(x,i){return (i+1)+'位：'+x['英傑名']+'（'+relativeConditions.map(function(c){var d=x._stats[c.stat]-relBase._stats[c.stat];return c.stat+':'+x._stats[c.stat]+'（'+(d>=0?'+':'')+d+'）';}).join(' / ')+' / コスト'+x['コスト']+'）';}).join('\n'):'')+(relMatches.length>relTake.length?'\nほか '+(relMatches.length-relTake.length)+'人います。':'')+sourceSuffix(),relMeta);
    }
    if(named.length===1&&stats.length>=2&&/(?:近い|近似|似た|似ている|似てる|同じくらい)/.test(original)){
      var multiBase=named[0],multiRows=data().rows.slice(),multiFilter=[];
      if(/同じ職業/.test(original)){multiRows=multiRows.filter(function(x){return x['職業']===multiBase['職業'];});multiFilter.push('同じ職業「'+multiBase['職業']+'」');}
      if(/同じコスト/.test(original)){multiRows=multiRows.filter(function(x){return Number(x['コスト'])===Number(multiBase['コスト']);});multiFilter.push('同じコスト'+multiBase['コスト']);}
      var multiNear=multiStatNearest(multiBase,multiRows,stats).slice(0,parseTop(original));
      if(!multiNear.length)return result('英傑マスター実データ',multiBase['英傑名']+'に指定能力が近い別英傑は、条件内に見つかりませんでした。',{nearestMulti:true,hero:multiBase['英傑名'],stats:stats,heroes:[]});
      return result('英傑マスター実データ',correctionPrefix(fuzzy)+(multiFilter.length?multiFilter.join('・')+'で、':'')+multiBase['英傑名']+'に '+stats.join('・')+' が近い英傑です。\n'+multiNear.map(function(x,i){return (i+1)+'位：'+x.row['英傑名']+'（'+stats.map(function(st){return st+':'+x.row._stats[st];}).join(' / ')+'）';}).join('\n')+'\n※能力ごとの数値幅が違うため、各能力を英傑マスター内の最小〜最大幅で正規化して近さを比較しています。',{nearestMulti:true,hero:multiBase['英傑名'],stats:stats,heroes:multiNear.map(function(x){return x.row['英傑名'];}),filters:multiFilter});
    }
    if(named.length===1&&stats.length===1&&/(?:近い|近似|似た数値|同じくらい)/.test(original)){
      var nearHero=named[0],nearStat=stats[0],nearRows=data().rows.filter(function(x){return x!==nearHero;}).sort(function(a,b){var da=Math.abs(a._stats[nearStat]-nearHero._stats[nearStat]),db=Math.abs(b._stats[nearStat]-nearHero._stats[nearStat]);return da-db||b._stats[nearStat]-a._stats[nearStat]||String(a['英傑名']).localeCompare(String(b['英傑名']),'ja');}),nearTake=nearRows.slice(0,parseTop(original));
      return result('英傑マスター実データ',nearHero['英傑名']+'（'+nearStat+' '+nearHero._stats[nearStat]+'）に'+nearStat+'が近い英傑です。\n'+nearTake.map(function(x,i){return (i+1)+'位：'+x['英傑名']+'（'+nearStat+':'+x._stats[nearStat]+' / 差:'+Math.abs(x._stats[nearStat]-nearHero._stats[nearStat])+'）';}).join('\n')+sourceSuffix(),{nearest:true,hero:nearHero['英傑名'],stat:nearStat,heroes:nearTake.map(function(x){return x['英傑名'];})});
    }
    if(named.length===1&&stats.length===1&&!/(?:同じ職業|職業が同じ|同じコスト|コストが同じ|同じ因子|因子が同じ|同じ技能|技能が同じ)/.test(original)&&/(?:同じ|一緒).*(?:数値|値|能力|英傑)|(?:数値|値).*(?:同じ|一緒)/.test(original)){
      var tieHero=named[0],tieStat=stats[0],tieValue=tieHero._stats[tieStat],tieRows=data().rows.filter(function(x){return x!==tieHero&&x._stats[tieStat]===tieValue;});
      return result('英傑マスター実データ',tieHero['英傑名']+'と'+tieStat+'が同じ '+tieValue+' の別英傑は '+tieRows.length+'人です。'+(tieRows.length?'\n'+tieRows.map(function(x){return x['英傑名'];}).join(' / '):'' )+sourceSuffix(),{sameValue:true,hero:tieHero['英傑名'],stat:tieStat,value:tieValue,count:tieRows.length,heroes:tieRows.map(function(x){return x['英傑名'];})});
    }
    if(named.length===1&&/(?:同じ因子構成|因子構成が同じ|全く同じ因子)/.test(original)){
      var sameFactorHero=named[0],sameFactorKey=rowFactors(sameFactorHero).slice().sort().join('|'),sameFactorRows=data().rows.filter(function(x){return x!==sameFactorHero&&rowFactors(x).slice().sort().join('|')===sameFactorKey;}),sameFactorTake=sameFactorRows.slice(0,15);
      return result('英傑マスター実データ',sameFactorHero['英傑名']+'と同じ因子構成「'+rowFactors(sameFactorHero).join(' / ')+'」の別英傑は '+sameFactorRows.length+'人です。'+(sameFactorRows.length?'\n'+sameFactorTake.map(function(x){return x['英傑名'];}).join(' / '):''),{sameFactorSet:true,hero:sameFactorHero['英傑名'],count:sameFactorRows.length,heroes:sameFactorTake.map(function(x){return x['英傑名'];})});
    }
    if(named.length===1&&/(?:同じ技能|技能が同じ|同一技能)/.test(original)){
      var sameSkillHero=named[0],sameSkill=S(sameSkillHero['技能']);
      if(!sameSkill||sameSkill==='対象外'||sameSkill==='なし')return result('英傑マスター実データ',sameSkillHero['英傑名']+'には比較できる技能名が登録されていません。',{sameSkill:true,hero:sameSkillHero['英傑名'],count:0});
      var sameSkillRows=data().rows.filter(function(x){return x!==sameSkillHero&&S(x['技能'])===sameSkill;});
      return result('英傑マスター実データ',sameSkillHero['英傑名']+'と同じ技能「'+sameSkill+'」の別英傑は '+sameSkillRows.length+'人です。'+(sameSkillRows.length?'\n'+sameSkillRows.slice(0,15).map(function(x){return x['英傑名'];}).join(' / '):''),{sameSkill:true,hero:sameSkillHero['英傑名'],skill:sameSkill,count:sameSkillRows.length,heroes:sameSkillRows.slice(0,15).map(function(x){return x['英傑名'];})});
    }
    if(named.length===1&&stats.length===1&&/(?:よりも?).*(?:高い|上回|超え)|(?:よりも?).*(?:低い|下回)/.test(original)){
      var base=named[0],st=stats[0],higher=/(?:よりも?).*(?:高い|上回|超え)/.test(original),baseValue=base._stats[st],fr=filteredRows(original),rel=fr.rows.filter(function(r){return r!==base&&(higher?r._stats[st]>baseValue:r._stats[st]<baseValue);});
      rel.sort(function(a,b){return higher?b._stats[st]-a._stats[st]:a._stats[st]-b._stats[st];});
      if(/何人|何名|何体|人数/.test(original))return result('英傑マスター実データ',base['英傑名']+'（'+st+' '+baseValue+'）'+(higher?'より高い':'より低い')+'英傑は '+rel.length+'人です。'+sourceSuffix(),{relative:true,hero:base['英傑名'],stat:st,count:rel.length,higher:higher});
      var rn=Math.min(parseTop(original),rel.length),rl=rel.slice(0,rn);
      return result('英傑マスター実データ',base['英傑名']+'（'+st+' '+baseValue+'）'+(higher?'より高い':'より低い')+'英傑'+(rl.length?'の上位'+rl.length+'人':'はいません')+(rl.length?'です。\n'+rl.map(function(r,i){return (i+1)+'位：'+r['英傑名']+'（'+st+':'+r._stats[st]+'）';}).join('\n'):'。')+sourceSuffix(),{relative:true,hero:base['英傑名'],stat:st,heroes:rl.map(function(r){return r['英傑名'];}),higher:higher});
    }
    if(named.length===1&&/同じ職業/.test(original)){
      var sameBase=named[0],sameRows=data().rows.filter(function(r){return r['職業']===sameBase['職業'];}),sf={rows:sameRows,job:sameBase['職業'],cost:0,factors:[],factorSlots:[],skill:'',stats:stats,thresholds:[]};
      if(stats.length)return listRanking(sf,stats,original);
      return result('英傑マスター実データ',sameBase['英傑名']+'と同じ職業「'+sameBase['職業']+'」の英傑は '+sameRows.length+'人です。\n'+sameRows.slice(0,15).map(function(r){return r['英傑名'];}).join(' / ')+(sameRows.length>15?' ほか'+(sameRows.length-15)+'人':''),{sameJob:true,hero:sameBase['英傑名'],job:sameBase['職業'],count:sameRows.length});
    }

    if(named.length>=2&&(stats.length||/どっち|どちら|比較|比べ|高い方|低い方|差/.test(original))){
      if(!stats.length)return result('英傑マスター確認',named.slice(0,4).map(function(r){return r['英傑名'];}).join('と')+'の、どの能力を比べますか？ 腕力・耐久・知力などを指定してください。',{needsClarification:true,heroes:named.slice(0,4).map(function(r){return r['英傑名'];})});
      var cmp=named.slice(0,6),lines=cmp.map(function(r){return r['英傑名']+'：'+stats.map(function(st){return st+' '+r._stats[st];}).join(' / ');});
      var label=stats.length>1?stats.join('＋')+'合計':stats[0],sorted=cmp.slice().sort(function(a,b){return scoreOf(b,stats)-scoreOf(a,stats);});
      return result('英傑マスター実データ',comparisonCorrectionPrefix(comparisonCorrections)+label+'で比べると、一番高いのは '+sorted[0]['英傑名']+' です。\n'+lines.join('\n')+sourceSuffix(),{comparison:true,stats:stats,heroes:cmp.map(function(r){return r['英傑名'];})});
    }

    if(named.length===1){
      var r=named[0],prefix=correctionPrefix(fuzzy),askFactors=/因子/.test(original),askJob=/職業|職は/.test(original),askCost=/(?:コスト|コスと|こすと)/.test(original),askSkill=/技能|固有/.test(original),aspectCount=(stats.length?1:0)+(askFactors?1:0)+(askJob?1:0)+(askCost?1:0)+(askSkill?1:0);
      if(skillConcepts.length){
        var conceptOk=skillConcepts.every(function(c){return detailMatches(r,c);}),conceptNames=skillConcepts.map(function(c){return c.label;}).join('＋');
        return result('英傑マスター実データ',prefix+r['英傑名']+'の技能「'+(S(r['技能'])||'登録なし')+'」には、'+conceptNames+'の記載が'+(conceptOk?'あります。':'ありません。')+(S(r['詳細'])?'\n技能詳細：'+r['詳細']:''),{hero:r['英傑名'],skillDetailCheck:true,concepts:skillConcepts.map(function(c){return c.label;}),matched:conceptOk});
      }
      if(/因子.*(?:何個|いくつ|数)|(?:何個|いくつ).*因子/.test(original))return result('英傑マスター実データ',prefix+r['英傑名']+'の因子は '+rowFactors(r).length+'個です。「'+(rowFactors(r).join(' / ')||'登録なし')+'」',scopeMeta(scopeNames,{hero:r['英傑名'],aspect:'factorCount',factorCount:rowFactors(r).length}));
      if(aspectCount>=2){
        var details=[];
        if(stats.length)details.push(stats.map(function(st){return st+' '+r._stats[st];}).join(' / '));
        if(askJob)details.push('職業 '+r['職業']);
        if(askCost)details.push('コスト'+r['コスト']);
        if(askFactors)details.push('因子 '+(rowFactors(r).join(' / ')||'登録なし'));
        if(askSkill)details.push('技能 '+(S(r['技能'])||'登録なし')+(S(r['詳細'])?'（'+r['詳細']+'）':''));
        return result('英傑マスター実データ',prefix+r['英傑名']+'の登録内容です。\n'+details.join('\n')+(stats.length?sourceSuffix():''),scopeMeta(scopeNames,{hero:r['英傑名'],aspect:'multiple',stats:stats,corrected:!!(fuzzy&&fuzzy.corrected)}));
      }
      if(stats.length){return result('英傑マスター実データ',prefix+r['英傑名']+'の'+stats.map(function(st){return st+'は '+r._stats[st];}).join('、')+'です。'+sourceSuffix(),{hero:r['英傑名'],stats:stats,corrected:!!(fuzzy&&fuzzy.corrected)});}
      if(askFactors)return result('英傑マスター実データ',prefix+r['英傑名']+'の因子は「'+(rowFactors(r).join(' / ')||'登録なし')+'」です。',scopeMeta(scopeNames,{hero:r['英傑名'],aspect:'factors',corrected:!!(fuzzy&&fuzzy.corrected)}));
      if(askJob)return result('英傑マスター実データ',prefix+r['英傑名']+'の職業は「'+r['職業']+'」です。',scopeMeta(scopeNames,{hero:r['英傑名'],aspect:'job'}));
      if(askCost)return result('英傑マスター実データ',prefix+r['英傑名']+'のコストは '+r['コスト']+' です。',scopeMeta(scopeNames,{hero:r['英傑名'],aspect:'cost'}));
      if(askSkill)return result('英傑マスター実データ',prefix+r['英傑名']+'の技能は「'+(S(r['技能'])||'登録なし')+'」です。'+(S(r['詳細'])?'\n'+r['詳細']:''),scopeMeta(scopeNames,{hero:r['英傑名'],aspect:'skill'}));
      return result('英傑マスター実データ',prefix+heroSummary(r),scopeMeta(scopeNames,{hero:r['英傑名'],aspect:'summary',corrected:!!(fuzzy&&fuzzy.corrected)}));
    }

    var f=filteredRows(original,scopeRows.length?scopeRows:null,scopeNames),rankSet=parseTopRankSet(original,stats),topEntryN=parseTopEntry(original),statPercentConditions=parseStatPercentConditions(original,stats),averageConditions=parseAverageConditions(original,stats);
    if(rankSet){
      var rankRows=f.rows,rankMaps=rankSet.entries.map(function(e){var list=sortedByStat(rankRows,e.stat,false),map=Object.create(null);list.slice(0,e.topN).forEach(function(r,i){map[r['英傑名']]={rank:i+1,row:r};});return {entry:e,map:map,list:list};}),positive=rankMaps.filter(function(x){return !x.entry.negative;}),negative=rankMaps.filter(function(x){return x.entry.negative;}),matches=rankRows.filter(function(r){var name=r['英傑名'],posOk=rankSet.operation==='union'?positive.some(function(x){return !!x.map[name];}):positive.every(function(x){return !!x.map[name];}),negOk=negative.every(function(x){return !x.map[name];});return posOk&&negOk;});
      matches.sort(function(a,b){function rs(r){return rankMaps.reduce(function(sum,x){var hit=x.map[r['英傑名']];return sum+(hit?hit.rank:x.entry.topN+rankRows.length);},0);}return rs(a)-rs(b)||String(a['英傑名']).localeCompare(String(b['英傑名']),'ja');});
      var positiveLabels=rankSet.entries.filter(function(e){return !e.negative;}).map(function(e){return e.stat+'トップ'+e.topN;}),negativeLabels=rankSet.entries.filter(function(e){return e.negative;}).map(function(e){return e.stat+'トップ'+e.topN;}),setLabel=rankSet.operation==='union'?positiveLabels.join('・')+'のどちらかに入る':(rankSet.operation==='difference'?positiveLabels.join('・')+'に入り、'+negativeLabels.join('・')+'には入らない':positiveLabels.join('・')+'の両方に入る'),rankTake=matches.slice(0,20);
      if(/何人|何名|何体|人数/.test(original))return result('英傑マスター実データ',filterLabel(f)+setLabel+'英傑は '+matches.length+'人です。'+sourceSuffix(),scopeMeta(f.scopeNames,{rankSet:true,operation:rankSet.operation,conditions:rankSet.entries,count:matches.length,heroes:matches.map(function(r){return r['英傑名'];})}));
      return result('英傑マスター実データ',filterLabel(f)+setLabel+'英傑は '+matches.length+'人です。\n'+rankTake.map(function(r){return r['英傑名']+'（'+rankMaps.map(function(x){var ri=rankInfo(rankRows,r,x.entry.stat,false);return x.entry.stat+' '+ri.rank+'位:'+r._stats[x.entry.stat];}).join(' / ')+'）';}).join('\n')+(matches.length>rankTake.length?'\nほか '+(matches.length-rankTake.length)+'人います。':'')+sourceSuffix(),scopeMeta(f.scopeNames,{rankSet:true,operation:rankSet.operation,conditions:rankSet.entries,count:matches.length,heroes:rankTake.map(function(r){return r['英傑名'];})}));
    }
    if(topEntryN&&/(?:多い|最多|一番|ランキング|順位|誰|だれ|教えて)/.test(original)){
      var entryStats=stats.length?stats.slice():STAT_ORDER.slice(),entryRows=f.rows,entryLeaders=topEntryLeaders(entryRows,entryStats,topEntryN),entryTake=entryLeaders.slice(0,parseEntryResultCount(original));
      if(!entryLeaders.length)return result('英傑マスター実データ',filterLabel(f)+entryStats.join('・')+'でトップ'+topEntryN+'以内に入る英傑は見つかりませんでした。',{topEntryCount:true,topN:topEntryN,stats:entryStats,heroes:[]});
      return result('英傑マスター実データ',filterLabel(f)+entryStats.length+'能力のうち、トップ'+topEntryN+'以内に入る回数が多い英傑です。\n'+entryTake.map(function(x,i){return (i+1)+'位：'+x.row['英傑名']+'（'+x.count+'能力：'+x.stats.join(' / ')+'）';}).join('\n')+sourceSuffix(),{topEntryCount:true,topN:topEntryN,stats:entryStats,heroes:entryTake.map(function(x){return x.row['英傑名'];}),counts:entryTake.map(function(x){return {hero:x.row['英傑名'],count:x.count,stats:x.stats.slice()};})});
    }
    if(statPercentConditions.length>=2){
      var pctConds=statPercentConditions.map(function(c){return percentileCondition(f.rows,c);}),pctMatch=f.rows.filter(function(r){return pctConds.every(function(c){return c.low?r._stats[c.stat]<=c.cutoff:r._stats[c.stat]>=c.cutoff;});});
      pctMatch.sort(function(a,b){return scoreOf(b,pctConds.map(function(c){return c.stat;}))-scoreOf(a,pctConds.map(function(c){return c.stat;}));});
      var pctCondLabel=pctConds.map(function(c){return c.stat+(c.low?'下位':'上位')+c.percent+'%（境界 '+c.cutoff+'）';}).join('・'),pctMatchTake=pctMatch.slice(0,Math.min(parseTop(original),20));
      if(/何人|何名|何体|人数/.test(original))return result('英傑マスター実データ',filterLabel(f)+pctCondLabel+'をすべて満たす英傑は '+pctMatch.length+'人です。'+sourceSuffix(),{multiPercentile:true,conditions:pctConds,count:pctMatch.length});
      return result('英傑マスター実データ',filterLabel(f)+pctCondLabel+'をすべて満たす英傑は '+pctMatch.length+'人です。\n'+pctMatchTake.map(function(r){return r['英傑名']+'（'+pctConds.map(function(c){return c.stat+':'+r._stats[c.stat];}).join(' / ')+'）';}).join('\n')+(pctMatch.length>pctMatchTake.length?'\nほか '+(pctMatch.length-pctMatchTake.length)+'人います。':'')+sourceSuffix(),{multiPercentile:true,conditions:pctConds,count:pctMatch.length,heroes:pctMatchTake.map(function(r){return r['英傑名'];})});
    }
    if(averageConditions.length){
      var avgConds=averageConditions.map(function(c){var values=f.rows.map(function(r){return r._stats[c.stat];}),avg=values.length?values.reduce(function(a,b){return a+b;},0)/values.length:0;return {stat:c.stat,direction:c.direction,average:avg};}),avgRows=f.rows.filter(function(r){return avgConds.every(function(c){return c.direction==='low'?r._stats[c.stat]<=c.average:r._stats[c.stat]>=c.average;});});
      avgRows.sort(function(a,b){return scoreOf(b,avgConds.map(function(c){return c.stat;}))-scoreOf(a,avgConds.map(function(c){return c.stat;}));});
      var avgLabel=avgConds.map(function(c){return c.stat+'が平均'+(c.direction==='low'?'以下':'以上')+'（平均 '+rounded(c.average)+'）';}).join('・'),avgTake=avgRows.slice(0,Math.min(parseTop(original),20));
      if(/何人|何名|何体|人数/.test(original))return result('英傑マスター実データ',filterLabel(f)+avgLabel+'の英傑は '+avgRows.length+'人です。'+sourceSuffix(),{averageThreshold:true,conditions:avgConds,count:avgRows.length});
      return result('英傑マスター実データ',filterLabel(f)+avgLabel+'の英傑は '+avgRows.length+'人です。\n'+avgTake.map(function(r){return r['英傑名']+'（'+avgConds.map(function(c){return c.stat+':'+r._stats[c.stat];}).join(' / ')+'）';}).join('\n')+(avgRows.length>avgTake.length?'\nほか '+(avgRows.length-avgTake.length)+'人います。':'')+sourceSuffix(),{averageThreshold:true,conditions:avgConds,count:avgRows.length,heroes:avgTake.map(function(r){return r['英傑名'];})});
    }
    if(!named.length&&stats.length===1){
      var stat=stats[0],band=parseStatBand(original,stat),rankRange=parseRankRange(original),percent=parsePercent(original);
      if(band&&band.type==='near'){
        var nearList=f.rows.slice().sort(function(a,b){var da=Math.abs(a._stats[stat]-band.target),db=Math.abs(b._stats[stat]-band.target);return da-db||b._stats[stat]-a._stats[stat]||String(a['英傑名']).localeCompare(String(b['英傑名']),'ja');}).slice(0,parseTop(original));
        return result('英傑マスター実データ',filterLabel(f)+stat+'が '+band.target+' に近い英傑です。\n'+nearList.map(function(x,i){return (i+1)+'位：'+x['英傑名']+'（'+stat+':'+x._stats[stat]+' / 差:'+Math.abs(x._stats[stat]-band.target)+'）';}).join('\n')+sourceSuffix(),{nearest:true,stat:stat,target:band.target,heroes:nearList.map(function(x){return x['英傑名'];})});
      }
      if(band&&(band.type==='band'||band.type==='range')){
        var bandRows=f.rows.filter(function(x){return x._stats[stat]>=band.min&&x._stats[stat]<=band.max;});bandRows=sortedByStat(bandRows,stat,false);
        if(/何人|何名|何体|人数/.test(original))return result('英傑マスター実データ',filterLabel(f)+stat+'が '+band.label+' の英傑は '+bandRows.length+'人です。'+sourceSuffix(),{valueRange:true,stat:stat,min:band.min,max:band.max,count:bandRows.length});
        var bandTake=bandRows.slice(0,Math.min(parseTop(original),20));
        return result('英傑マスター実データ',filterLabel(f)+stat+'が '+band.label+' の英傑は '+bandRows.length+'人です。\n'+bandTake.map(function(x){return x['英傑名']+'（'+stat+':'+x._stats[stat]+'）';}).join('\n')+(bandRows.length>bandTake.length?'\nほか '+(bandRows.length-bandTake.length)+'人います。':'')+sourceSuffix(),{valueRange:true,stat:stat,min:band.min,max:band.max,count:bandRows.length,heroes:bandTake.map(function(x){return x['英傑名'];})});
      }
      if(rankRange){
        var rankSorted=sortedByStat(f.rows,stat,/低い|低め|最低|最小|ワースト|下位/.test(original)),slice=rankSorted.slice(rankRange.start-1,rankRange.end);
        return result('英傑マスター実データ',filterLabel(f)+stat+'順位の '+rankRange.start+'位〜'+Math.min(rankRange.end,rankSorted.length)+'位です。\n'+slice.map(function(x,i){var rank=rankRange.start+i;return rank+'位：'+x['英傑名']+'（'+stat+':'+x._stats[stat]+'）';}).join('\n')+sourceSuffix(),{rankRange:true,stat:stat,start:rankRange.start,end:rankRange.end,heroes:slice.map(function(x){return x['英傑名'];})});
      }
      if(percent){
        var pctSorted=sortedByStat(f.rows,stat,percent.low),pctCount=Math.max(1,Math.ceil(pctSorted.length*percent.percent/100)),pctRows=pctSorted.slice(0,pctCount),pctTake=pctRows.slice(0,20),cutoff=pctRows.length?pctRows[pctRows.length-1]._stats[stat]:0;
        if(/何人|何名|何体|人数/.test(original))return result('英傑マスター実データ',filterLabel(f)+(percent.low?'下位':'上位')+percent.percent+'%は '+pctCount+'人です。境界の'+stat+'は '+cutoff+' です。'+sourceSuffix(),{percentile:true,stat:stat,percent:percent.percent,low:percent.low,count:pctCount,cutoff:cutoff});
        return result('英傑マスター実データ',filterLabel(f)+(percent.low?'下位':'上位')+percent.percent+'%に入る英傑は '+pctCount+'人です。境界の'+stat+'は '+cutoff+' です。\n'+pctTake.map(function(x,i){return (i+1)+'位：'+x['英傑名']+'（'+stat+':'+x._stats[stat]+'）';}).join('\n')+(pctRows.length>pctTake.length?'\nほか '+(pctRows.length-pctTake.length)+'人います。':'')+sourceSuffix(),{percentile:true,stat:stat,percent:percent.percent,low:percent.low,count:pctCount,cutoff:cutoff,heroes:pctTake.map(function(x){return x['英傑名'];})});
      }
      if(/(?:同じ|一緒).*(?:数値|値|能力|英傑)|(?:数値|値|英傑).*(?:同じ|一緒)/.test(original)){
        var tg=tieGroups(f.rows,stat),tgTake=tg.slice(0,10);
        if(!tg.length)return result('英傑マスター実データ',filterLabel(f)+stat+'が同じ英傑の組み合わせは見つかりませんでした。',{sameValueGroups:true,stat:stat,count:0});
        return result('英傑マスター実データ',filterLabel(f)+stat+'が同じ英傑の組み合わせは '+tg.length+'組あります。数値が高い順の先頭'+tgTake.length+'組です。\n'+tgTake.map(function(g){return stat+' '+g.value+'：'+g.rows.map(function(x){return x['英傑名'];}).join(' / ');}).join('\n'),{sameValueGroups:true,stat:stat,count:tg.length,groups:tgTake.map(function(g){return {value:g.value,heroes:g.rows.map(function(x){return x['英傑名'];})};})});
      }
    }
    if(stats.length&&/(?:平均|平均値|中央値|真ん中の値)/.test(original)){
      if(!f.rows.length)return result('英傑マスター実データ',filterLabel(f)+'該当英傑がいないため、平均・中央値を計算できません。',{notFound:true});
      var useMedian=/(?:中央値|真ん中の値)/.test(original),agg=stats.map(function(st){var vals=f.rows.map(function(r){return r._stats[st];}),value=useMedian?median(vals):vals.reduce(function(a,b){return a+b;},0)/vals.length;return {stat:st,value:rounded(value)};});
      return result('英傑マスター実データ',filterLabel(f)+stats.join('・')+'の'+(useMedian?'中央値':'平均値')+'です。\n'+agg.map(function(x){return x.stat+'：'+x.value;}).join('\n')+'\n対象：'+f.rows.length+'人'+sourceSuffix(),scopeMeta(f.scopeNames,{aggregate:true,aggregateType:useMedian?'median':'average',stats:stats,values:agg,count:f.rows.length}));
    }
    if(/何人|何名|何体|人数|件数|何件/.test(original)){
      var countMeta=scopeMeta(f.scopeNames,{count:true,value:f.rows.length,heroes:f.rows.slice(0,20).map(function(r){return r['英傑名'];})});
      attachRefinementMeta(countMeta,f,f.rows,stats,false,refinementContext);
      return result('英傑マスター実データ',filterLabel(f)+'英傑は '+f.rows.length+'人です。',countMeta);
    }
    if(stats.length&&/誰|だれ|どれ|ランキング|トップ|上位|下位|高い|低い|一番|最も|最高|最低|最大|最小|順|教えて|知りたい/.test(original))return listRanking(f,stats,original,refinementContext);
    if((f.job||f.cost||f.factors.length||f.factorSlots.length||f.skill||(f.excludedJobs||[]).length||(f.excludedCosts||[]).length||(f.excludedFactors||[]).length||f.skillPresence!==null||f.thresholds.length)&&/誰|だれ|一覧|教えて|見せて|いる|ある|ない|持ち|該当|だけ|のみ|以外|じゃない|除いて|除外|抜き|外して/.test(original)){
      var take=f.rows.slice(0,15),extra=f.rows.length>take.length?'\nほか '+(f.rows.length-take.length)+'人います。':'';
      var listMeta=scopeMeta(f.scopeNames,{list:true,count:f.rows.length,heroes:take.map(function(r){return r['英傑名'];})});
      attachRefinementMeta(listMeta,f,f.rows,[],false,refinementContext);
      return result('英傑マスター実データ',filterLabel(f)+'英傑は '+f.rows.length+'人です。\n'+take.map(function(r){return r['英傑名']+'（'+r['職業']+'・コスト'+r['コスト']+'）';}).join('\n')+extra,listMeta);
    }
    if(/英傑.*(?:何人|何名|何体)|全部で.*(?:何人|何名)/.test(original))return result('英傑マスター実データ','現在の英傑マスターには '+data().rows.length+'人が登録されています。',{count:true,value:data().rows.length});
    return {handled:false};
  }

  window.JINPO_BOT_HERO_KNOWLEDGE={
    version:VERSION,
    respond:respond,
    detectStats:detectStats,
    detectJob:detectJob,
    detectFactors:detectFactors,
    detectFactorSlots:detectFactorSlots,
    detectSkill:detectSkill,
    detectSkillConcepts:detectSkillConcepts,
    detectFactorCount:detectFactorCount,
    exactNamedRows:exactNamedRows,
    fuzzyName:fuzzyName,
    sourceSha256:function(){return data().meta.sourceSha256||'';},
    rowCount:function(){return data().rows.length;}
  };
})();
