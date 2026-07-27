(function(){
  'use strict';
  if(window.JINPO_BOT_PARSER) return;

  function normalize(t){return String(t==null?'':t).replace(/[０-９]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFEE0);}).replace(/[　\s]+/g,' ').trim();}
  function A(){return window.JINPO_BOT_ACTIONS||{};}
  function cleanHeroText(v){return String(v||'').replace(/^(?:じゃあ|じゃ|それなら|なら|あと|ちなみに|じゃあさ|それじゃ)\s*/,'').replace(/^(?:英傑|キャラ)\s*/,'').trim();}
  function findFormation(t){var aliases=['衡軛','衝軛','鴻鵠','こうやく','鶴翼','かくよく','方円','ほうえん','魚鱗','ぎょりん'];for(var i=0;i<aliases.length;i++)if(t.indexOf(aliases[i])>=0)return A().canonicalFormation?A().canonicalFormation(aliases[i]):aliases[i];return'';}
  function findStats(t){var words=['生命力','耐久力','器用さ','土属性','水属性','火属性','風属性','生命','気合','腕力','耐久','器用','知力','魅力','土','水','火','風'];var hits=[];words.forEach(function(w){var pos=t.indexOf(w);if(pos>=0){var s=A().canonicalStat?A().canonicalStat(w):w;if(s)hits.push({stat:s,pos:pos,len:w.length});}});hits.sort(function(a,b){return a.pos-b.pos||b.len-a.len;});var out=[];hits.forEach(function(h){if(out.indexOf(h.stat)<0)out.push(h.stat);});return out;}
  function statAfter(t,re){var m=re.exec(t);if(!m)return'';var rest=t.slice(m.index+m[0].length);var s=findStats(rest);return s[0]||'';}
  function rangeNear(t,stat){
    var labels=[stat,stat.replace('属性','')];if(stat==='耐久力')labels.push('耐久');if(stat==='器用さ')labels.push('器用');if(stat==='生命')labels.push('生命力');var min=null,max=null;
    for(var i=0;i<labels.length;i++){
      var e=labels[i].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');var m=t.match(new RegExp(e+'[^0-9]{0,8}([0-9]{2,5})\\s*(以上|以下)'));
      if(m){if(m[2]==='以上')min=Number(m[1]);else max=Number(m[1]);break;}
    }
    if(min==null){var m1=t.match(/([0-9]{2,5})\s*以上/);if(m1)min=Number(m1[1]);}
    if(max==null){var m2=t.match(/([0-9]{2,5})\s*以下/);if(m2)max=Number(m2[1]);}
    return {min:min,max:max};
  }
  function helpKey(t){
    if(/何ができる|できること|機能一覧/.test(t))return'capabilities';
    if(/第\s*1|第一/.test(t)&&/とは|意味|なに/.test(t))return'priority1';
    if(/第\s*2|第二/.test(t)&&/とは|意味|なに/.test(t))return'priority2';
    if(/以上|以下/.test(t)&&/優先|絞/.test(t)&&/とは|意味/.test(t))return'range';
    if(/合計ソート|2項目合計/.test(t)&&/とは|意味/.test(t))return'sum_sort';
    if(/込み合計/.test(t)&&/とは|意味/.test(t))return'included_total';
    if(/全MAX|全マックス/i.test(t)&&/とは|意味/.test(t))return'all_max';
    if(/差替/.test(t)&&/赤|緑|青|色/.test(t)&&/意味|とは/.test(t))return'swap_colors';
    if(/文曲/.test(t)&&/除外|人数/.test(t)&&/とは|意味/.test(t))return'bunkyoku';
    if(/配置英傑/.test(t)&&/とは|意味/.test(t))return'owned';
    if(/除外英傑/.test(t)&&/とは|意味/.test(t))return'excluded';
    return'';
  }

  function parse(input){
    var t=normalize(input);try{if(window.JINPO_BOT_CASUAL&&typeof window.JINPO_BOT_CASUAL.rewrite==='function')t=window.JINPO_BOT_CASUAL.rewrite(t,{}).text||t;}catch(e){}
    var plan={raw:t,actions:[],searchPatch:null,recommendStat:'',helpKey:helpKey(t),smalltalk:'',recognized:false};
    if(!t)return plan;
    if(/^(こんにちは|こんちは|こんばんは|おはよう|おはようございます)[!！。\s]*$/.test(t))plan.smalltalk='greeting';
    else if(/ありがとう|助かった|サンキュー|thanks/i.test(t))plan.smalltalk='thanks';
    else if(/暑いね|暑いな|寒いね|寒いな/.test(t))plan.smalltalk='weather';
    else if(/^(君は誰|あなたは誰|誰なの|だれなの|名前は|名前教えて)[?？!！。\s]*$/.test(t))plan.smalltalk='identity';

    if(/検索.*中止|検索.*止め|中止して/.test(t)){plan.actions.push({name:'cancel_search'});plan.recognized=true;}
    if(/先頭6人.*(?:仮配置|配置)|最初の6人.*(?:仮配置|配置)/.test(t)){plan.actions.push({name:'auto_fill'});plan.recognized=true;}
    if(/検索条件.*(?:リセット|初期化|クリア|解除)|条件だけ.*(?:リセット|初期化|クリア)/.test(t)){plan.actions.push({name:'reset_search'});plan.recognized=true;}
    if(/おすすめ(?:陣法|モード)?(?:を)?(?:解除|終了|やめ)/.test(t)){plan.actions.push({name:'exit_recommended'});plan.recognized=true;}
    if(/一つ前|ひとつ前|さっきの構成|元に戻して/.test(t)&&!/標準.*戻/.test(t)){plan.actions.push({name:'undo'});plan.recognized=true;}
    if(/^(全解除|全部解除|全部リセット|すべてリセット|全リセット)$/.test(t)){plan.actions.push({name:'reset_all'});plan.recognized=true;return plan;}
    if(/^(?:配置|6人配置|現在の配置)(?:を)?(?:クリア|解除)$/.test(t)){plan.actions.push({name:'clear_placement'});plan.recognized=true;}
    var bondSearch=t.match(/因縁一覧(?:で|から)?\s*(.+?)\s*(?:を)?検索/);if(bondSearch){plan.actions.push({name:'show_bonds',args:{mode:'all',query:bondSearch[1]}});plan.recognized=true;}
    else if(/現在発動中因縁.*(?:開|表示|見せ)|発動中因縁一覧/.test(t)){plan.actions.push({name:'show_bonds',args:{mode:'active'}});plan.recognized=true;}
    else if(/因縁一覧.*(?:開|表示|見せ)|^因縁一覧$/.test(t)){plan.actions.push({name:'show_bonds',args:{mode:'all'}});plan.recognized=true;}
    if(/転生.*見聞録.*鬼神石.*(?:開|表示)|強化画面.*(?:開|表示)/.test(t)){plan.actions.push({name:'open_enhancement'});plan.recognized=true;}
    var ownedOpen=t.match(/配置英傑\s*([1-3])(?:番|枠)?(?:の)?(?:選択画面|選択|一覧).*(?:開|表示)|配置英傑\s*([1-3])(?:番|枠)?(?:を)?選びたい/);if(ownedOpen){plan.actions.push({name:'open_owned_picker',args:{slot:Number(ownedOpen[1]||ownedOpen[2])}});plan.recognized=true;}
    if(/除外英傑.*(?:選択画面|一覧).*(?:開|表示)|除外英傑を選びたい/.test(t)){plan.actions.push({name:'open_excluded_picker'});plan.recognized=true;}
    if(/JSON.*(?:ファイル)?(?:選びたい|選ぶ|選択|開いて)/i.test(t)){plan.actions.push({name:'open_json_picker'});plan.recognized=true;}
    else if(/JSON.*(?:出力|書き出|エクスポート)/i.test(t)){plan.actions.push({name:'export_json'});plan.recognized=true;}
    else if(/JSON.*(?:読込|読み込|インポート)/i.test(t)){plan.actions.push({name:'import_json'});plan.recognized=true;}
    if(/因縁マスター.*(?:ファイル)?(?:選びたい|選ぶ|選択|開いて)/.test(t)){plan.actions.push({name:'open_bond_master_picker'});plan.recognized=true;}
    if(/formations_master.*(?:ファイル)?(?:選びたい|選ぶ|選択|開いて)/i.test(t)){plan.actions.push({name:'open_formation_master_picker'});plan.recognized=true;}
    if(/(?:選択済み|この)?因縁マスター.*(?:適用|読み込)/.test(t)){plan.actions.push({name:'apply_override_bond_master'});plan.recognized=true;}
    if(/標準因縁(?:マスター)?(?:へ|に)?戻/.test(t)){plan.actions.push({name:'reset_bond_master'});plan.recognized=true;}
    if(/formations_master.*(?:クリア|解除)/i.test(t)){plan.actions.push({name:'clear_formation_master'});plan.recognized=true;}
    if(/(?:ページ)?上(?:部)?へ|一番上へ|トップへ移動/.test(t)){plan.actions.push({name:'scroll_top'});plan.recognized=true;}
    if(/結果(?:位置|欄)?へ(?:移動|スクロール)|結果まで(?:移動|スクロール)/.test(t)){plan.actions.push({name:'scroll_result'});plan.recognized=true;}

    if(/全MAX解除|全マックス解除/i.test(t)){plan.actions.push({name:'clear_all_max'});plan.recognized=true;}
    else if(/全MAX|全マックス/i.test(t)&&!/とは|意味/.test(t)){plan.actions.push({name:'all_max'});plan.recognized=true;}
    var enhStat=findStats(t)[0]||'';
    var km=t.match(/見聞録[^0-9]*(侍|僧|神主\/巫女|神主|巫女|陰陽師|忍者|鍛冶屋|薬師|傾奇者)|(?:^|\s)(侍|僧|神主\/巫女|神主|巫女|陰陽師|忍者|鍛冶屋|薬師|傾奇者)(?:の)?見聞録/);if(km&&km[2]&&!km[1])km[1]=km[2];
    var ks=t.match(/鬼神石[^0-9]*([1-6])(?:番|枠)?/);
    var ten=t.match(/(?:転生\s*([1-6])(?:番|枠)?|([1-6])(?:番|枠)?(?:の)?転生)\s*(?:を|は)?\s*(ON|OFF|オン|オフ|MAX|マックス|解除|クリア)/i);
    var specificKenbun=!!(km&&enhStat),specificKishin=!!(ks&&enhStat),specificTensei=!!ten;

    if(specificTensei){var tv=String(ten[3]||'');plan.actions.push({name:'set_tensei',args:{slot:Number(ten[1]||ten[2]),on:/ON|オン|MAX|マックス/i.test(tv)}});plan.recognized=true;}
    if(specificKenbun){
      if(/MAX|マックス/i.test(t)){plan.actions.push({name:'set_kenbun',args:{job:km[1],stat:enhStat,value:'max'}});plan.recognized=true;}
      else if(/解除|戻して|クリア/.test(t)||/(?:^|[^0-9])0(?:[^0-9]|$)/.test(t)){plan.actions.push({name:'set_kenbun',args:{job:km[1],stat:enhStat,value:0}});plan.recognized=true;}
      else{var vm=t.match(/([0-9]{2,5})/);if(vm){plan.actions.push({name:'set_kenbun',args:{job:km[1],stat:enhStat,value:Number(vm[1])}});plan.recognized=true;}}
    }
    if(specificKishin){
      if(/MAX|マックス/i.test(t)){plan.actions.push({name:'set_kishin',args:{slot:Number(ks[1]),stat:enhStat,value:'max'}});plan.recognized=true;}
      else if(/解除|戻して|クリア/.test(t)||/(?:^|[^0-9])0(?:[^0-9]|$)/.test(t)){plan.actions.push({name:'set_kishin',args:{slot:Number(ks[1]),stat:enhStat,value:0}});plan.recognized=true;}
      else{var vk=t.match(/([0-9]{2,5})\s*$/);if(vk){plan.actions.push({name:'set_kishin',args:{slot:Number(ks[1]),stat:enhStat,value:Number(vk[1])}});plan.recognized=true;}}
    }

    if(!specificKenbun&&/見聞録.*(?:だけ)?.*(?:MAX|マックス)/i.test(t)&&!/全MAX/.test(t)){plan.actions.push({name:'panel_max',args:{panel:'kenbun'}});plan.recognized=true;}
    if(!specificKishin&&/鬼神石.*(?:だけ)?.*(?:MAX|マックス)/i.test(t)&&!/全MAX/.test(t)){plan.actions.push({name:'panel_max',args:{panel:'kishin'}});plan.recognized=true;}
    if(!specificTensei&&/転生.*(?:だけ)?.*(?:MAX|全ON|オン)/i.test(t)&&!/全MAX/.test(t)){plan.actions.push({name:'panel_max',args:{panel:'tensei'}});plan.recognized=true;}
    if(!specificKenbun&&/見聞録.*(?:解除|戻して|クリア)/.test(t)){plan.actions.push({name:'panel_clear',args:{panel:'kenbun'}});plan.recognized=true;}
    if(!specificKishin&&/鬼神石.*(?:解除|戻して|クリア)/.test(t)){plan.actions.push({name:'panel_clear',args:{panel:'kishin'}});plan.recognized=true;}
    if(!specificTensei&&/転生.*(?:解除|戻して|クリア|全部OFF|全OFF)/i.test(t)){plan.actions.push({name:'panel_clear',args:{panel:'tensei'}});plan.recognized=true;}

    if(/保存編成.*(?:一覧|見せ|教え)|保存した編成.*(?:一覧|見せ|教え)/.test(t)){plan.actions.push({name:'list_saved'});plan.recognized=true;}
    if(/(?:編成を)?保存(?:して|する|$)/.test(t)&&!/保存編成.*(?:一覧|見せ|教え|読込|読み込|ロード|削除)/.test(t)){
      var saveName='',sqm=t.match(/(?:「([^」]+)」|『([^』]+)』)\s*(?:という名前で|の名前で|として)?\s*(?:編成を)?保存/);if(sqm)saveName=sqm[1]||sqm[2]||'';
      if(!saveName){var snm=t.match(/^(.+?)\s*(?:という名前で|の名前で|として)\s*(?:編成を)?保存/);if(snm)saveName=snm[1].replace(/^(?:今の|現在の)\s*編成を?$/,'').trim();}
      plan.actions.push({name:'save_current',args:{name:saveName}});plan.recognized=true;
    }
    var load=t.match(/保存編成(?:の)?\s*(?:「([^」]+)」|『([^』]+)』|([0-9]+)番|([^\s]+))\s*(?:を)?(?:読込|読み込|ロード)/);if(load){plan.actions.push({name:'load_saved',args:{ref:load[1]||load[2]||load[3]||load[4]}});plan.recognized=true;}
    var del=t.match(/保存編成(?:の)?\s*(?:「([^」]+)」|『([^』]+)』|([0-9]+)番|([^\s]+))\s*(?:を)?削除/);if(del){plan.actions.push({name:'delete_saved',args:{ref:del[1]||del[2]||del[3]||del[4]}});plan.recognized=true;}
    if(/共有URL.*(?:作|生成|出して|教えて)/.test(t)){plan.actions.push({name:'share_url'});plan.recognized=true;}

    // 普通の会話から「未所持」と「この英傑を使いたい」を拾う。
    // クリック操作ではなく手入力時の会話補助。既存の配置英傑/除外英傑機能をそのまま使う。
    var notOwned=t.match(/^(.+?)(?:を|は)?\s*(?:持ってない|もってない|持っていない|もっていない|持ってません|もってません|持ってへん|所持してない|所持していない|所持なし|未所持|いない|居ない|手持ちにない|手持ちじゃない)(?:んだ|んだよね|です|ですよ|よ|な|ね|。|！|!)*$/);
    if(notOwned){var nh=cleanHeroText(notOwned[1]);if(nh){plan.actions.push({name:'set_excluded_hero',args:{hero:nh,excluded:true}});plan.actions.push({name:'rerun_search'});plan.recognized=true;}}
    var wantHero=t.match(/^(.+?)(?:を|は)?\s*(?:使いたい|使ったのがいい|使うのがいい|使ってほしい|入れたい|入ったのがいい|入りがいい|含めたい|込みがいい|入れて探して|使って探して|必ず入れて|固定したい|固定して|残したい|残して|必須|ありで|込みで探して|入れて|使って)(?:な|ね|です|ですよ|よ|。|！|!)*$/);
    if(wantHero){var wh=cleanHeroText(wantHero[1]);if(wh){plan.actions.push({name:'set_owned_hero_auto',args:{hero:wh}});plan.actions.push({name:'rerun_search'});plan.recognized=true;}}

    if(/配置英傑.*(?:全部|全て|すべて|全解除)|配置英傑(?:指定)?\s*(?:を)?\s*(?:解除|クリア)$/.test(t)){plan.actions.push({name:'clear_owned_heroes'});plan.recognized=true;}
    var ownedClear=t.match(/配置英傑\s*([1-3])(?:番|枠)?[^0-9]*(?:解除|クリア|未選択)/);if(ownedClear){plan.actions.push({name:'clear_owned_hero',args:{slot:Number(ownedClear[1])}});plan.recognized=true;}
    var owned=t.match(/配置英傑\s*([1-3])[^\S\r\n]*(?:を|は|に)?\s*(.+?)(?:にして|指定|登録|$)/);if(owned&&!/解除|クリア|未選択|選択画面|一覧|開いて|表示/.test(t)){plan.actions.push({name:'set_owned_hero',args:{slot:Number(owned[1]),hero:owned[2].trim()}});plan.recognized=true;}
    if(/除外英傑.*(?:全部|全て|すべて).*(?:解除|クリア)|除外.*全解除/.test(t)){plan.actions.push({name:'clear_excluded_heroes'});plan.recognized=true;}
    var exOff=t.match(/(.+?)(?:の)?(?:除外|候補外)(?:を)?(?:解除|取り消|やめ|戻して|戻す)/);if(exOff&&!/全部|全て|すべて/.test(exOff[1])){plan.actions.push({name:'set_excluded_hero',args:{hero:cleanHeroText(exOff[1].replace(/英傑$/,'')),excluded:false}});plan.actions.push({name:'rerun_search'});plan.recognized=true;}
    else {var exOn=t.match(/^(.+?)(?:を|は)?\s*(?:除外(?:して|する)?|外して|外したい|抜いて|抜きで|なしで|無しで|使わない|いらない|候補から外して|候補に出さない)(?:な|ね|です|よ|。|！|!)*$/);if(exOn&&!/除外英傑/.test(exOn[1])){plan.actions.push({name:'set_excluded_hero',args:{hero:cleanHeroText(exOn[1]),excluded:true}});plan.actions.push({name:'rerun_search'});plan.recognized=true;}}

    if(/差替候補.*(?:見せ|一覧|教えて)|(?:UP|FLAT|DOWN|アップ|フラット|ダウン|減らない).*差替候補/i.test(t)){
      var levels=null;if(/(?:減らない|維持以上|FLAT以上|フラット以上)/i.test(t))levels=['up','flat'];else if(/UP|アップだけ/i.test(t))levels=['up'];else if(/FLAT|フラットだけ/i.test(t))levels=['flat'];else if(/DOWN|ダウンだけ/i.test(t))levels=['down'];
      plan.actions.push({name:'get_swap_candidates',args:{limit:20,levels:levels}});plan.recognized=true;
    }
    var sw=t.match(/差替(?:候補)?(?:の)?\s*([0-9]+)番(?:目)?(?:を)?(?:適用|差替)/);if(sw){plan.actions.push({name:'apply_swap',args:{rank:Number(sw[1])}});plan.recognized=true;}

    var apply=t.match(/(?:検索結果(?:の)?\s*)?([0-9]+)(?:番(?:目)?|位)(?:を)?適用/);if(apply&&!/差替/.test(t)){plan.actions.push({name:'apply_result',args:{rank:Number(apply[1]),scope:/検索結果/.test(t)?'result':'auto'}});plan.recognized=true;}
    var cmp=t.match(/([0-9]+)(?:位|番目?)\s*(?:と|、|,)\s*([0-9]+)(?:位|番目?).*(?:比較|比べ)/);if(cmp){plan.actions.push({name:'compare_results',args:{ranks:[Number(cmp[1]),Number(cmp[2])]}});plan.recognized=true;}
    var top=t.match(/(?:上位|最初の)\s*([0-9]+)\s*(?:件|個)(?:.*(?:見せ|教えて|表示))?|検索結果.*(?:見せ|教えて)/);if(top||/検索結果.*(?:見せ|教えて)/.test(t)){plan.actions.push({name:'get_results',args:{limit:top?Number(top[1]):10}});plan.recognized=true;}
    var resultSort=false;if(/(?:検索結果|結果一覧|一覧).*(?:順|昇順|降順|並べ替|ソート)|(?:高い順|低い順|昇順|降順).*(?:検索結果|結果一覧|一覧)/.test(t)){
      var rss=findStats(t);if(rss.length){plan.actions.push({name:'sort_results',args:{stat:rss[0],dir:/(?:低い順|昇順)/.test(t)?'asc':'desc'}});plan.recognized=true;resultSort=true;}
    }
    if(!resultSort&&/(?:順|ソート|並べ)/.test(t)&&!/(?:第\s*[12]|合計ソート)/.test(t)){var crs=findStats(t);if(crs.length){plan.actions.push({name:'sort_results',args:{stat:crs[0],dir:/(?:低い|小さい|昇順)/.test(t)?'asc':'desc'}});plan.recognized=true;resultSort=true;}}
    if(/因縁判定(?:して|お願い|実行)?|現在の6人.*(?:判定|計算)/.test(t)){plan.actions.push({name:'run_calculation'});plan.recognized=true;}

    if(/込み合計.*(?:いくつ|教えて|確認|は\?|は？)|今の込み合計/.test(t)){plan.actions.push({name:'read_totals'});plan.recognized=true;}
    else if(/(?:今の)?合計.*(?:いくつ|教えて|確認|は\?|は？)/.test(t)){plan.actions.push({name:'read_totals'});plan.recognized=true;}
    if(/発動因縁.*(?:教えて|見せて|確認|何)/.test(t)){plan.actions.push({name:'read_activated'});plan.recognized=true;}
    if(/検索状態.*(?:教えて|見せて|確認)|検索.*(?:進んでる|進行状況)/.test(t)){plan.actions.push({name:'read_search_status'});plan.recognized=true;}
    if(/配置英傑条件.*(?:教えて|見せて|確認)|固定してる英傑.*(?:教えて|見せて)/.test(t)){plan.actions.push({name:'get_owned_filters'});plan.recognized=true;}
    if(/除外英傑条件.*(?:教えて|見せて|確認)|外してる英傑.*(?:教えて|見せて)/.test(t)){plan.actions.push({name:'get_excluded_filters'});plan.recognized=true;}
    if(/おすすめ陣法状態.*(?:教えて|見せて|確認)|おすすめ条件.*(?:教えて|見せて)/.test(t)){plan.actions.push({name:'get_recommend_state'});plan.recognized=true;}
    if(/検索の絞り込み条件.*(?:解除|クリア|消して)|フィルター.*(?:解除|クリア|消して)/.test(t)){plan.actions.push({name:'clear_search_filters'});plan.recognized=true;}
    if(/今の(?:条件|検索条件|状態)|現在の(?:条件|検索条件|状態)/.test(t)){plan.actions.push({name:'read_state'});plan.recognized=true;}
    if(/今の(?:6人|編成|配置)|現在の(?:6人|編成|配置)/.test(t)&&!/保存/.test(t)){plan.actions.push({name:'read_placement'});plan.recognized=true;}

    // 「一番高い」「トップ」系は陣形を聞かず、全陣形・因縁数混在のDBから比較する。
    var bestStats=findStats(t);
    if(bestStats.length&&/(?:一番|最も|最高|トップ|最大).*(?:高|大|強)|(?:高|大).*(?:一番|最も|最高|トップ|最大)/.test(t)&&!/ページ|一番上へ|トップへ移動/.test(t)){
      if(bestStats.length>=2&&/(?:合計|合わせ|足し|両方|と)/.test(t))plan.actions.push({name:'run_best',args:{stat1:bestStats[0],stat2:bestStats[1]}});
      else plan.actions.push({name:'run_best',args:{stat1:bestStats[0]}});
      plan.recognized=true;
    }
    if(/おすすめ/.test(t)&&!/とは|意味/.test(t)&&!plan.actions.some(function(a){return a.name==='run_best';})){var rs=findStats(t);if(rs.length){plan.recommendStat=rs[0];plan.recognized=true;}}

    var patch={},hasPatch=false;
    if(/(?:検索基準|基準).*(?:全MAX込み|MAX込み|フルMAX込み|強化込み)|(?:全MAX込み|MAX込み|フルMAX込み|強化込み).*(?:検索|基準)/i.test(t)){patch.searchBasis='fullmax';hasPatch=true;}
    else if(/(?:検索基準|基準).*(?:基礎値|基礎|素ステ|元ステ)|(?:基礎値|素ステ|元ステ).*(?:検索|基準)/.test(t)){patch.searchBasis='base';hasPatch=true;}
    var form=findFormation(t);if(form){patch.formation=form;hasPatch=true;}
    var cm=t.match(/(?:^|[^0-9])([5-9])\s*因縁/);if(!cm)cm=t.match(/因縁(?:数)?\s*(?:は|=|：|:)?\s*([5-9])/);if(!cm){var cm2=t.match(/^([5-9])(?:因縁)?\s*(?:にして|へ|で|でお願い|お願い)?[。！!]*$/);if(cm2)cm=cm2;}if(!cm&&(form||findStats(t).length||/検索|探して|優先|重視|盛り|おすすめ/.test(t))){var cm3=t.match(/(?:^|[^0-9])([5-9])(?=$|[^0-9])/);if(cm3)cm=cm3;}if(cm){patch.count=Number(cm[1]);hasPatch=true;}
    var g3=t.match(/等級\s*3以下(?:\s*(?:を|は)?\s*(ON|オン|OFF|オフ|解除|使わない|なし|無し))?/i);if(g3){patch.grade3=!(g3[1]&&/(OFF|オフ|解除|使わない|なし|無し)/i.test(g3[1]));hasPatch=true;}
    var f4=t.match(/文曲(?:の)?除外(?:人数)?\s*(?:は|=|：|:)?\s*([0-6])/);if(!f4)f4=t.match(/文曲(?:を)?\s*([0-6])\s*人(?:を)?\s*除外/);if(!f4)f4=t.match(/文曲\s*([0-6])\s*人\s*除外/);if(f4){patch.factor4Exclude=Number(f4[1]);hasPatch=true;}
    if(/文曲(?:の)?除外.*(?:解除|なし|0人)/.test(t)){patch.factor4Exclude=0;hasPatch=true;}

    var p1Clear=/(?:第\s*1|第一)(?:(?!(?:第\s*2|第二)).)*?(?:解除|なし|無し|クリア)/.test(t);var p2Clear=/(?:第\s*2|第二)(?:(?!(?:第\s*1|第一)).)*?(?:解除|なし|無し|クリア)/.test(t);
    if(p1Clear){patch.priority1={clear:true};hasPatch=true;}if(p2Clear){patch.priority2={clear:true};hasPatch=true;}
    var s1=statAfter(t,/(?:第\s*1|第一)(?:優先(?:ソート)?)?/);var s2=statAfter(t,/(?:第\s*2|第二)(?:優先(?:ソート)?)?/);
    if(s1&&!p1Clear){var r1=rangeNear(t,s1);patch.priority1={stat:s1,min:r1.min,max:r1.max};hasPatch=true;}
    if(s2&&!p2Clear){var r2=rangeNear(t,s2);patch.priority2={stat:s2,min:r2.min,max:r2.max};hasPatch=true;}
    if(!s1&&!p1Clear){var po1=t.match(/(?:第\s*1|第一)(?:優先)?[^0-9]*([0-9]{2,5})\s*(以上|以下)/);if(po1){patch.priority1={inheritStat:true};if(po1[2]==='以上')patch.priority1.min=Number(po1[1]);else patch.priority1.max=Number(po1[1]);hasPatch=true;}}
    if(!s2&&!p2Clear){var po2=t.match(/(?:第\s*2|第二)(?:優先)?[^0-9]*([0-9]{2,5})\s*(以上|以下)/);if(po2){patch.priority2={inheritStat:true};if(po2[2]==='以上')patch.priority2.min=Number(po2[1]);else patch.priority2.max=Number(po2[1]);hasPatch=true;}}
    if(!s1&&!s2&&!p1Clear&&!p2Clear){var pob=t.match(/^([0-9]{2,5})\s*(以上|以下)(?:にして|で)?[。！!]*$/);if(pob){patch.priority1={inheritStat:true};if(pob[2]==='以上')patch.priority1.min=Number(pob[1]);else patch.priority1.max=Number(pob[1]);hasPatch=true;}}
    if(!s1&&!s2&&!plan.helpKey&&!plan.recommendStat&&!resultSort&&!/見聞録|鬼神石|転生/.test(t)){
      var gs=findStats(t);if(gs.length&&(/優先|重視|高い|高め|盛り|特化|メイン|検索|探して|因縁|おすすめ|強め|伸ば/.test(t)||cm||form)){var rg=rangeNear(t,gs[0]);patch.priority1={stat:gs[0],min:rg.min,max:rg.max};hasPatch=true;}
    }
    if(/優先.*(?:全部|全て|すべて).*(?:解除|クリア)/.test(t)){patch.priority1={clear:true};patch.priority2={clear:true};hasPatch=true;}
    if(/合計ソート|2項目合計/.test(t)&&!/とは|意味/.test(t)){patch.sumSort=!/(OFF|オフ|解除|使わない)/i.test(t);if(/第2.*優先|第二.*優先/.test(t)&&/同点/.test(t))patch.sumTie='second';else if(/第1.*優先|第一.*優先/.test(t)&&/同点/.test(t))patch.sumTie='first';hasPatch=true;}
    var hasRunBest=plan.actions.some(function(a){return a.name==='run_best';});
    if(!hasRunBest&&!plan.recommendStat&&(hasPatch||/検索して|検索お願い|探して/.test(t))){plan.searchPatch=patch;plan.recognized=true;}
    return plan;
  }

  window.JINPO_BOT_PARSER={version:'2.1.0',parse:parse,normalize:normalize};
})();
