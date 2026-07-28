(function(){
  'use strict';
  if(window.JINPO_BOT_STATE) return;

  var KEY='jinpo_local_bot_state_v2';
  var UNDO_KEY='jinpo_local_bot_undo_v1';
  var LAST_SEARCH_KEY='jinpo_local_bot_last_search_v1';
  var SEARCH_HISTORY_KEY='jinpo_local_bot_search_history_v1';
  var MAX_UNDO=8;

  function safeParse(raw,fallback){
    try{var v=JSON.parse(raw);return v==null?fallback:v;}catch(e){return fallback;}
  }
  function read(key,fallback){
    try{return safeParse(localStorage.getItem(key),fallback);}catch(e){return fallback;}
  }
  function write(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(e){return false;}
  }
  function normalizeConditions(v){
    v=v||{};
    return {
      formation:String(v.formation||''),
      count:Number(v.count)||0,
      searchBasis:String(v.searchBasis||'base')==='fullmax'?'fullmax':'base',
      priority1:String(v.priority1||''),
      priority1Min:v.priority1Min==null||v.priority1Min===''?null:Number(v.priority1Min),
      priority1Max:v.priority1Max==null||v.priority1Max===''?null:Number(v.priority1Max),
      priority2:String(v.priority2||''),
      priority2Min:v.priority2Min==null||v.priority2Min===''?null:Number(v.priority2Min),
      priority2Max:v.priority2Max==null||v.priority2Max===''?null:Number(v.priority2Max),
      grade3:typeof v.grade3==='boolean'?v.grade3:null,
      factor4Exclude:Number.isFinite(Number(v.factor4Exclude))?Number(v.factor4Exclude):0,
      sumSort:!!v.sumSort,
      sumTie:v.sumTie==='second'?'second':'first'
    };
  }

  var current=normalizeConditions(read(KEY,{}));

  function getConditions(){return JSON.parse(JSON.stringify(current));}
  function setConditions(v){current=normalizeConditions(v);write(KEY,current);return getConditions();}
  function mergeConditions(v){return setConditions(Object.assign({},current,v||{}));}
  function resetConditions(){return setConditions({});}

  function getUndo(){
    var list=read(UNDO_KEY,[]);
    return Array.isArray(list)?list:[];
  }
  function pushUndo(snapshot,label){
    if(!snapshot||typeof snapshot!=='object') return false;
    var list=getUndo();
    list.push({snapshot:snapshot,label:String(label||''),at:Date.now()});
    if(list.length>MAX_UNDO) list=list.slice(-MAX_UNDO);
    write(UNDO_KEY,list);
    return true;
  }
  function popUndo(){
    var list=getUndo();
    var item=list.pop()||null;
    write(UNDO_KEY,list);
    return item;
  }
  function clearUndo(){write(UNDO_KEY,[]);}

  function clone(v){
    try{return JSON.parse(JSON.stringify(v));}catch(e){return null;}
  }

  function saveLastSearch(snapshot,label,recipe){
    if(!snapshot||typeof snapshot!=='object')return null;
    var item={
      snapshot:clone(snapshot),
      label:String(label||''),
      recipe:recipe&&typeof recipe==='object'?clone(recipe):null,
      at:Date.now()
    };
    write(LAST_SEARCH_KEY,item);

    var hist=read(SEARCH_HISTORY_KEY,[]);
    if(!Array.isArray(hist))hist=[];

    // 同じ条件・同じ検索方式が連続した場合は履歴を水増しせず最新化。
    var sig='';
    try{sig=JSON.stringify({snapshot:item.snapshot,recipe:item.recipe});}catch(e){}
    var firstSig='';
    if(hist[0]){
      try{firstSig=JSON.stringify({snapshot:hist[0].snapshot,recipe:hist[0].recipe});}catch(e2){}
    }
    if(sig&&sig===firstSig){
      hist[0]=clone(item);
    }else{
      hist.unshift(clone(item));
    }
    hist=hist.slice(0,5);
    write(SEARCH_HISTORY_KEY,hist);

    return clone(item);
  }

  function getLastSearch(){
    var x=read(LAST_SEARCH_KEY,null);
    if(!x||typeof x!=='object'||!x.snapshot)return null;
    return clone(x);
  }

  function clearLastSearch(){
    try{localStorage.removeItem(LAST_SEARCH_KEY);}catch(e){}
    return true;
  }


  function getSearchHistory(){
    var hist=read(SEARCH_HISTORY_KEY,[]);
    if(!Array.isArray(hist))return[];
    return clone(hist)||[];
  }

  function getSearchHistoryItem(index){
    var i=Math.max(1,Number(index)||1)-1;
    var hist=getSearchHistory();
    return hist[i]?clone(hist[i]):null;
  }

  function clearSearchHistory(){
    try{localStorage.removeItem(SEARCH_HISTORY_KEY);}catch(e){}
    return true;
  }

  window.JINPO_BOT_STATE={
    version:'1.2.0',
    getConditions:getConditions,
    setConditions:setConditions,
    mergeConditions:mergeConditions,
    resetConditions:resetConditions,
    pushUndo:pushUndo,
    popUndo:popUndo,
    clearUndo:clearUndo,
    saveLastSearch:saveLastSearch,
    getLastSearch:getLastSearch,
    clearLastSearch:clearLastSearch,
    getSearchHistory:getSearchHistory,
    getSearchHistoryItem:getSearchHistoryItem,
    clearSearchHistory:clearSearchHistory
  };
})();
