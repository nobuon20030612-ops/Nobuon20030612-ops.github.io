/* jinpo-internal-save.js
   Local save helper for jinpo.html.
   Keeps existing HTML behavior and prevents missing-script load failure.
*/
(function(){
  const KEY = "jinpo_internal_saved_formations";
  function migrateLegacyHeroId(v){
    const id = String(v || "");
    return id === "EIK_0125" ? "EIK_0246" : id;
  }
  function migrateSavedItem(item){
    if(!item || typeof item !== "object") return item;
    if(Array.isArray(item.members)){
      item.members = item.members.map(function(member){
        if(!member || typeof member !== "object") return member;
        const oldId = String(member.internal_id || "");
        const newId = migrateLegacyHeroId(oldId);
        if(newId !== oldId){
          member.internal_id = newId;
          member.name = "竹中半兵衛(知将)";
        }
        return member;
      });
    }
    return item;
  }
  function read(){
    try{
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(data)) return [];
      const migrated = data.map(migrateSavedItem);
      if(JSON.stringify(migrated) !== JSON.stringify(data)) write(migrated);
      return migrated;
    }catch(e){
      return [];
    }
  }
  function write(data){
    try{
      localStorage.setItem(KEY, JSON.stringify(Array.isArray(data) ? data : []));
    }catch(e){}
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
  window.JinpoInternalSave = {
    getSaved: read,
    saveFormation: function(name, placement, formation){
      const list = read();
      const item = {
        id: String(Date.now()),
        name: String(name || "無題"),
        formation: String(formation || ""),
        members: membersFromPlacement(placement),
        savedAt: new Date().toISOString()
      };
      list.unshift(item);
      write(list);
      return item;
    },
    deleteFormation: function(id){
      const target = String(id || "");
      write(read().filter(function(item){ return String(item.id) !== target; }));
    }
  };
})();
