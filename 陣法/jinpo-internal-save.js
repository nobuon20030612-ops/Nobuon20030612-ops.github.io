/* jinpo-internal-save.js
   現行たいらの式専用のローカル編成保存。
   現行internal_id・現行陣形名・現行保存形式だけを保存/読込する。
*/
(function(){
  const KEY = "jinpo_internal_saved_formations";
  const FORMS = new Set(["衡軛","鶴翼","魚鱗","方円"]);
  let saveSequence = 0;
  let storageWarningShown = false;

  function notifyStorageIssue(message, error){
    try{ console.error(message, error || ""); }catch(_){}
    try{
      if(typeof CustomEvent === "function" && window && typeof window.dispatchEvent === "function"){
        window.dispatchEvent(new CustomEvent("jinpo:save-storage-error", {detail:{message:String(message || "編成保存に失敗しました")}}));
      }
    }catch(_){}
    if(storageWarningShown) return;
    storageWarningShown = true;
    try{
      setTimeout(function(){ try{ if(typeof window.alert === "function") window.alert(String(message || "編成保存に失敗しました")); }catch(_){} }, 0);
    }catch(_){}
  }

  function canonicalFormationName(v){
    const s = String(v || "").trim();
    return FORMS.has(s) ? s : "";
  }

  function write(data){
    try{
      localStorage.setItem(KEY, JSON.stringify(Array.isArray(data) ? data : []));
      return true;
    }catch(e){
      notifyStorageIssue("編成を保存できませんでした。ブラウザの保存容量・プライベート設定を確認してください。", e);
      return false;
    }
  }

  function normalizeSavedItem(item){
    if(!item || typeof item !== "object" || Array.isArray(item)) return null;
    const formation = canonicalFormationName(item.formationName || item.formation);
    if(!formation || !Array.isArray(item.members)) return null;
    const seenSlots = new Set();
    const seenIds = new Set();
    const members = [];
    item.members.forEach(function(member){
      if(!member || typeof member !== "object") return;
      const slot = Number(member.slot);
      const internalId = String(member.internal_id || "").trim();
      if(!Number.isInteger(slot) || slot < 1 || slot > 6 || seenSlots.has(slot)) return;
      if(internalId && seenIds.has(internalId)) return;
      seenSlots.add(slot);
      if(internalId) seenIds.add(internalId);
      members.push({slot:slot, internal_id:internalId, name:String(member.name || "")});
    });
    return {
      id:String(item.id || "").trim(),
      name:String(item.name || "無題"),
      formation:formation,
      formationName:formation,
      members:members,
      savedAt:String(item.savedAt || "")
    };
  }

  function makeSaveId(usedIds){
    const used = usedIds instanceof Set ? usedIds : new Set();
    try{
      if(typeof crypto !== "undefined" && crypto && typeof crypto.randomUUID === "function"){
        const uuid = String(crypto.randomUUID() || "").trim();
        if(uuid && !used.has(uuid)) return uuid;
      }
    }catch(_){}
    for(let attempt=0; attempt<1000005; attempt++){
      saveSequence = (saveSequence + 1) % 1000000;
      const id = String(Date.now()) + "-" + String(saveSequence) + "-" + Math.random().toString(36).slice(2,10);
      if(!used.has(id)) return id;
    }
    throw new Error("保存IDを一意に生成できませんでした");
  }

  function read(){
    try{
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(data)) return [];
      const normalized = data.map(normalizeSavedItem).filter(Boolean);
      const used = new Set();
      normalized.forEach(function(item){
        let id = item.id;
        if(!id || used.has(id)) id = makeSaveId(used);
        item.id = id;
        used.add(id);
      });
      if(JSON.stringify(normalized) !== JSON.stringify(data)) write(normalized);
      return normalized;
    }catch(e){
      notifyStorageIssue("保存済み編成を読み込めませんでした。ブラウザの保存領域を確認してください。", e);
      return [];
    }
  }

  function membersFromPlacement(placement){
    const seen = new Set();
    return [1,2,3,4,5,6].map(function(slot){
      const h = placement && placement[slot] ? placement[slot] : {};
      const internalId = String(h.internal_id || "").trim();
      if(internalId && seen.has(internalId)) return {slot:slot, internal_id:"", name:""};
      if(internalId) seen.add(internalId);
      return {slot:slot, internal_id:internalId, name:String(h["英傑名"] || h.name || h["名前"] || "")};
    });
  }

  window.JinpoInternalSave = {
    getSaved: read,
    saveFormation: function(name, placement, formation){
      const canonical = canonicalFormationName(formation);
      if(!canonical) return null;
      const list = read();
      const used = new Set(list.map(function(item){ return item.id; }).filter(Boolean));
      const item = {
        id:makeSaveId(used),
        name:String(name || "無題"),
        formation:canonical,
        formationName:canonical,
        members:membersFromPlacement(placement),
        savedAt:new Date().toISOString()
      };
      list.unshift(item);
      return write(list) ? item : null;
    },
    deleteFormation: function(id){
      const target = String(id || "");
      return write(read().filter(function(item){ return item.id !== target; }));
    }
  };
})();
