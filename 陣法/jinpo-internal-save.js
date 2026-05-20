/* jinpo-internal-save.js
   Local save helper for jinpo.html.
   Keeps existing HTML behavior and prevents missing-script load failure.
*/
(function(){
  const KEY = "jinpo_internal_saved_formations";
  function read(){
    try{
      const raw = localStorage.getItem(KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
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
