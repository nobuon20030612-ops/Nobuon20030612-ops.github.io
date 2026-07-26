/* jinpo-internal-save.js
   Local save helper for jinpo.html.
   Keeps existing HTML behavior and prevents missing-script load failure.
*/
(function(){
  const KEY = "jinpo_internal_saved_formations";
  let storageWarningShown = false;
  function notifyStorageIssue(message, error){
    try{ console.error(message, error || ""); }catch(_){}
    try{
      window.dispatchEvent(new CustomEvent("jinpo:save-storage-error", {detail:{message:String(message || "編成保存に失敗しました")}}));
    }catch(_){}
    if(storageWarningShown) return;
    storageWarningShown = true;
    try{
      setTimeout(function(){ try{ if(typeof window.alert === "function") window.alert(String(message || "編成保存に失敗しました")); }catch(_){} }, 0);
    }catch(_){}
  }
  function migrateLegacyHeroId(v){
    const id = String(v || "");
    return id === "EIK_0125" ? "EIK_0246" : id;
  }
  function canonicalFormationName(v){
    const s = String(v || "").trim();
    if(/衡軛|衝軛|kogaku|kougaku/i.test(s)) return "衡軛";
    if(/鶴翼|kakuyoku/i.test(s)) return "鶴翼";
    if(/魚鱗|gyorin/i.test(s)) return "魚鱗";
    if(/方円|hoen/i.test(s)) return "方円";
    return "";
  }
  function migrateSavedItem(item){
    if(!item || typeof item !== "object") return item;
    if(Array.isArray(item.members)){
      const seenIds = new Set();
      const seenSlots = new Set();
      const cleanedMembers = [];
      item.members.forEach(function(member){
        if(!member || typeof member !== "object") return;
        const slot = Number(member.slot);
        /* 不正枠・重複枠は項目そのものを捨てる。
           空IDを同じslotへ残すと、読込時に先の正常英傑をnullで上書きするため。 */
        if(!Number.isInteger(slot) || slot < 1 || slot > 6 || seenSlots.has(slot)) return;
        seenSlots.add(slot);
        member.slot = slot;
        const oldId = String(member.internal_id || "");
        const newId = migrateLegacyHeroId(oldId);
        if(newId !== oldId){
          member.internal_id = newId;
          member.name = "竹中半兵衛(知将)";
        }
        /* 同じ英傑が別枠に重複する旧データは、後ろ側だけ空枠化する。 */
        if(newId && seenIds.has(newId)){
          member.internal_id = ""; member.name = "";
        }else if(newId){
          seenIds.add(newId);
        }
        cleanedMembers.push(member);
      });
      item.members = cleanedMembers;
    }
    /* 旧保存は formation、新UIは formationName を参照するため両方を常に同期する。 */
    const formation = canonicalFormationName(item.formationName || item.formation);
    if(formation){
      item.formation = formation;
      item.formationName = formation;
    }
    return item;
  }
  function read(){
    try{
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(data)) return [];
      const before = JSON.stringify(data);
      const migrated = data.map(migrateSavedItem);
      const seenSaveIds = new Set();
      migrated.forEach(function(item){
        if(!item || typeof item !== "object") return;
        let id = String(item.id || "");
        if(!id || seenSaveIds.has(id)){
          id = makeSaveId();
          item.id = id;
        }
        seenSaveIds.add(id);
      });
      if(JSON.stringify(migrated) !== before) write(migrated);
      return migrated;
    }catch(e){
      notifyStorageIssue("保存済み編成を読み込めませんでした。ブラウザの保存領域を確認してください。", e);
      return [];
    }
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
  function membersFromPlacement(placement){
    return [1,2,3,4,5,6].map(function(slot){
      const h = placement && placement[slot] ? placement[slot] : {};
      return {
        slot: slot,
        internal_id: String(h.internal_id || h["番号"] || h.id || ""),
        name: String(h["英傑名"] || h.name || h["名前"] || "")
      };
    });
  }
  let saveSequence = 0;
  function makeSaveId(){
    try{
      if(typeof crypto !== "undefined" && crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    }catch(e){}
    saveSequence = (saveSequence + 1) % 1000000;
    return String(Date.now()) + "-" + String(saveSequence) + "-" + Math.random().toString(36).slice(2,10);
  }
  window.JinpoInternalSave = {
    getSaved: read,
    saveFormation: function(name, placement, formation){
      const list = read();
      const canonical = canonicalFormationName(formation);
      if(!canonical){
        try{ console.error("陣形未選択または未対応の陣形のため保存しません", formation); }catch(e){}
        return null;
      }
      const item = {
        id: makeSaveId(),
        name: String(name || "無題"),
        formation: canonical,
        formationName: canonical,
        members: membersFromPlacement(placement),
        savedAt: new Date().toISOString()
      };
      list.unshift(item);
      if(!write(list)) return null;
      return item;
    },
    deleteFormation: function(id){
      const target = String(id || "");
      return write(read().filter(function(item){ return String(item.id) !== target; }));
    }
  };
})();
