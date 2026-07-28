(function(){
  'use strict';
  if(window.JINPO_BOT_STATE) return;

  var KEY='jinpo_local_bot_state_v2';
  var UNDO_KEY='jinpo_local_bot_undo_v1';
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

  window.JINPO_BOT_STATE={
    version:'1.0.0',
    getConditions:getConditions,
    setConditions:setConditions,
    mergeConditions:mergeConditions,
    resetConditions:resetConditions,
    pushUndo:pushUndo,
    popUndo:popUndo,
    clearUndo:clearUndo
  };
})();
