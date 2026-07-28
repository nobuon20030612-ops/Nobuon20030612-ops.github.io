/*
 * 歩き巫女 たいらの野望 ツール実データ回答 v1.0.0
 * 九十九・鬼神石・魔導結晶について、番号/名称/能力値/入手/上位を直接回答する。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_TOOL_KNOWLEDGE)return;
  var VERSION='1.0.0';
  var STATS=['生命','気合','腕力','耐久','器用','知力','魅力','土','水','火','風'];

  function S(v){
    var s=String(v==null?'':v);
    try{s=s.normalize('NFKC');}catch(e){}
    return s.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function N(v){
    return S(v).toLowerCase()
      .replace(/[？?！!。、・「」『』【】（）()\[\]［］\s]/g,'')
      .replace(/ー/g,'');
  }
  function D(){return window.JINPO_BOT_TOOL_DATA||{};}

  function detectDataset(text){
    var t=N(text),data=D(),hit=null;
    Object.keys(data).forEach(function(key){
      var d=data[key],score=0;
      (d.aliases||[]).forEach(function(a){
        var x=N(a);
        if(!x)return;
        if(t.indexOf(x)>=0)score=Math.max(score,100+x.length);
      });
      if(score&&(!hit||score>hit.score))hit={key:key,data:d,score:score};
    });
    return hit;
  }

  function detectStat(text){
    var t=S(text);
    for(var i=0;i<STATS.length;i++){
      if(t.indexOf(STATS[i])>=0)return STATS[i];
    }
    if(/耐久力/.test(t))return'耐久';
    if(/器用さ/.test(t))return'器用';
    if(/土属性/.test(t))return'土';
    if(/水属性/.test(t))return'水';
    if(/火属性/.test(t))return'火';
    if(/風属性/.test(t))return'風';
    return'';
  }

  function numberFromText(text){
    var t=S(text),m;
    m=t.match(/(?:番号|No\.?|NO\.?|no\.?)\s*([0-9０-９]{1,4})/i);
    if(!m)m=t.match(/([0-9０-９]{1,4})\s*(?:番|ばん)(?!目)/);
    if(!m)return 0;
    return Number(m[1].replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFEE0);}))||0;
  }

  function isAcquisition(text){
    return /入手|どこで|どこから|取れる|とれる|取り方|とりかた|手に入|入手方法|入手先|入手場所/.test(S(text));
  }
  function isRanking(text){
    return /一番|いちばん|最大|最高|トップ|top|上位|高い|高め|強い/.test(S(text));
  }
  function topCount(text){
    var t=S(text),m=t.match(/(?:トップ|top|上位)\s*([1-9１-９][0-9０-９]?)/i);
    if(!m)m=t.match(/([1-9１-９][0-9０-９]?)\s*(?:個|件|位)/);
    if(!m)return /一番|いちばん|最大|最高/.test(t)?1:5;
    var n=Number(m[1].replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFEE0);}))||5;
    return Math.max(1,Math.min(n,10));
  }

  function itemName(row,d){return S(row[d.nameKey]||'');}
  function nonzeroStats(row){
    return STATS.filter(function(k){return Number(row[k]||0)!==0;})
      .map(function(k){return k+String(Number(row[k]||0));});
  }
  function summarize(row,d){
    var parts=nonzeroStats(row);
    var base=d.name+' '+row['番号']+'番「'+itemName(row,d)+'」';
    if(parts.length)base+='は、'+parts.join('・')+'です。';
    else base+='です。';
    if(row['入手'])base+='\n入手：'+row['入手'];
    return base;
  }

  function findItem(text,d){
    var t=N(text),best=null,bestLen=0;
    (d.rows||[]).forEach(function(row){
      var name=itemName(row,d),x=N(name);
      if(!x)return;
      if(t.indexOf(x)>=0&&x.length>bestLen){
        best=row;bestLen=x.length;
      }
    });
    return best;
  }

  function findByNumber(num,d){
    return (d.rows||[]).find(function(r){return Number(r['番号'])===Number(num);})||null;
  }

  function itemMatchesAcrossDatasets(text){
    var data=D(),t=N(text),hits=[];
    Object.keys(data).forEach(function(key){
      var d=data[key];
      (d.rows||[]).forEach(function(row){
        var name=itemName(row,d),x=N(name);
        if(x&&t.indexOf(x)>=0)hits.push({key:key,data:d,row:row,len:x.length});
      });
    });
    hits.sort(function(a,b){return b.len-a.len;});
    return hits;
  }

  function needsDatasetForNumber(text){
    return numberFromText(text)>0&&!detectDataset(text);
  }

  function directQuestion(text){
    var t=S(text);
    return numberFromText(t)>0 ||
      !!detectStat(t) ||
      isAcquisition(t) ||
      isRanking(t) ||
      /何|なに|どんな|詳細|詳しく|教えて|おしえて/.test(t);
  }

  function respond(text,opt){
    var original=S(text);if(!original)return{handled:false};
    var ds=detectDataset(original);
    var stat=detectStat(original);
    var num=numberFromText(original);
    var acquisition=isAcquisition(original);
    var ranking=isRanking(original);

    // First allow a uniquely named item to identify its dataset even without "九十九" etc.
    var itemHits=itemMatchesAcrossDatasets(original);
    if(!ds&&itemHits.length){
      var top=itemHits[0],same=itemHits.filter(function(x){return x.len===top.len&&itemName(x.row,x.data)===itemName(top.row,top.data);});
      if(same.length===1)ds={key:top.key,data:top.data,score:90};
    }

    // "1番は？" alone is too ambiguous.
    if(!ds&&needsDatasetForNumber(original)){
      return {
        handled:true,
        answer:'何の'+num+'番かだけ教えてください。九十九・鬼神石・魔導結晶のどれですか？',
        mode:'たいらの野望ツール実データ',
        sources:[],links:[],
        data:{needsDataset:true,number:num}
      };
    }
    if(!ds)return{handled:false};

    var d=ds.data;

    // Don't steal ordinary page navigation or jinpo's 鬼神石MAX command.
    if(!directQuestion(original)){
      return{handled:false};
    }
    if(/(?:MAX|マックス|全MAX)/i.test(original)&&!/番号|番|入手|どこ|生命|気合|腕力|耐久|器用|知力|魅力|土|水|火|風/.test(original)){
      return{handled:false};
    }

    if(ranking&&stat){
      var n=topCount(original);
      var sorted=(d.rows||[]).slice().sort(function(a,b){
        var diff=Number(b[stat]||0)-Number(a[stat]||0);
        return diff!==0?diff:Number(a['番号']||0)-Number(b['番号']||0);
      });
      var max=Number(sorted[0]&&sorted[0][stat]||0);
      if(n===1){
        var ties=sorted.filter(function(r){return Number(r[stat]||0)===max;});
        var names=ties.slice(0,8).map(function(r){return r['番号']+'番「'+itemName(r,d)+'」';}).join('、');
        var extra=ties.length>8?' ほか'+(ties.length-8)+'件':'';
        return {
          handled:true,
          answer:d.name+'で'+stat+'が一番高いのは '+max+' です。\n'+names+extra+'。',
          mode:'たいらの野望ツール実データ',
          sources:[],links:[],
          data:{dataset:ds.key,stat:stat,topValue:max,count:ties.length}
        };
      }
      var list=sorted.slice(0,n).map(function(r,i){
        return (i+1)+'位：'+r['番号']+'番「'+itemName(r,d)+'」 '+stat+Number(r[stat]||0);
      }).join('\n');
      return {
        handled:true,
        answer:d.name+'の'+stat+'上位'+n+'件です。\n'+list,
        mode:'たいらの野望ツール実データ',
        sources:[],links:[],
        data:{dataset:ds.key,stat:stat,top:n}
      };
    }

    var row=null;
    if(num)row=findByNumber(num,d);
    if(!row)row=findItem(original,d);

    if(row){
      if(stat){
        return {
          handled:true,
          answer:d.name+' '+row['番号']+'番「'+itemName(row,d)+'」の'+stat+'は '+Number(row[stat]||0)+' なのですよ。',
          mode:'たいらの野望ツール実データ',
          sources:[],links:[],
          data:{dataset:ds.key,number:row['番号'],name:itemName(row,d),stat:stat,value:Number(row[stat]||0)}
        };
      }
      if(acquisition){
        return {
          handled:true,
          answer:d.name+' '+row['番号']+'番「'+itemName(row,d)+'」の入手は、'+(row['入手']||'正本に入手情報がありません')+' なのですよ。',
          mode:'たいらの野望ツール実データ',
          sources:[],links:[],
          data:{dataset:ds.key,number:row['番号'],name:itemName(row,d),acquisition:true}
        };
      }
      return {
        handled:true,
        answer:summarize(row,d),
        mode:'たいらの野望ツール実データ',
        sources:[],links:[],
        data:{dataset:ds.key,number:row['番号'],name:itemName(row,d)}
      };
    }

    if(num){
      return {
        handled:true,
        answer:d.name+'の'+num+'番は、現在の正本データには見つからなかったのですよ。',
        mode:'たいらの野望ツール実データ',
        sources:[],links:[],
        data:{dataset:ds.key,number:num,notFound:true}
      };
    }

    // Dataset+stat but no ranking cue: answer useful max instead of a page link.
    if(stat){
      var maxRows=(d.rows||[]).slice().sort(function(a,b){return Number(b[stat]||0)-Number(a[stat]||0);});
      if(maxRows.length){
        var mv=Number(maxRows[0][stat]||0);
        var mr=maxRows.filter(function(r){return Number(r[stat]||0)===mv;}).slice(0,5);
        return {
          handled:true,
          answer:d.name+'の'+stat+'についてですね。最大値は '+mv+' で、'+mr.map(function(r){return r['番号']+'番「'+itemName(r,d)+'」';}).join('、')+'です。',
          mode:'たいらの野望ツール実データ',
          sources:[],links:[],
          data:{dataset:ds.key,stat:stat,max:mv}
        };
      }
    }

    return{handled:false};
  }

  window.JINPO_BOT_TOOL_KNOWLEDGE={
    version:VERSION,
    respond:respond,
    detectDataset:detectDataset,
    detectStat:detectStat
  };
})();
