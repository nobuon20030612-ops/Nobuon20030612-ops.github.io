(function(){
  'use strict';
  if(window.JINPO_BOT_HELP) return;
  var HELP={
    capabilities:'陣形・5〜9因縁・検索基準（基礎値/全MAX込み）・第1/第2優先・数値範囲・等級3以下・文曲除外人数・第1/第2合計ソート・おすすめ陣法・検索中止・検索結果表示/並べ替え/比較/適用・配置英傑・除外英傑・配置クリア・差替・因縁判定/因縁一覧・見聞録・鬼神石・転生・全MAX・合計確認・保存編成・共有URL・JSON入出力などを、サイトの既存機能を使って操作できます。誤字・表記揺れも補助し、確信が持てない場合は実行前に『○○ということでよろしいですか？』と確認します。ファイル読込を伴う機能は、サイト上で選択済みのファイルだけを実行します。',
    priority1:'第1優先は、検索結果で最優先に見るステータスです。数値を指定しなければその項目が高い順になります。',
    priority2:'第2優先は、第1優先に続いて見るステータスです。第1・第2は検索一覧と合計表示で同時に強調されます。',
    range:'優先ステータスには「以上」と「以下」を指定できます。生命・気合は2000刻み、その他は200刻みの既存UI値を使います。',
    sum_sort:'第1・第2合計ソートは、選択した2項目の合計が高い順に並べる機能です。同点時に第1優先か第2優先のどちらを優先するかも選べます。',
    included_total:'「転生＆見聞録＆鬼神石込み合計」は、通常の合計に各強化設定を加えた別表示です。Botは画面に表示された実数値を読み取ります。',
    all_max:'全MAXは、見聞録MAX・鬼神石MAX・転生MAXをまとめて反映します。鬼神石は生命・気合17,000、その他2,500、転生は文曲を除いてLv30です。',
    swap_colors:'差替候補は赤＝UP、緑＝FLAT、青＝DOWNです。既存差替機能の候補と判定をそのまま使います。',
    bunkyoku:'文曲除外人数は、文曲を使う人数を絞る検索条件です。Bot側で因縁判定は作らず、サイトの実検索結果を使います。',
    owned:'配置英傑1〜3は、検索結果に必ず含めたい英傑を指定する既存フィルターです。同名英傑が複数ある場合はinternal_id指定が安全です。',
    excluded:'除外英傑はinternal_id単位で検索対象から外します。同名英傑でも別個体として扱われます。',
    data_rule:'陣法の英傑・因縁・ステータス・件数はBotが推測しません。サイトのマスター、既存検索結果、既存計算結果を正として回答します。',
    search_basis:'検索基準は「基礎値」と「全MAX込み」を切り替えます。「基礎値」は強化前の値、「全MAX込み」は転生MAX・見聞録MAX・鬼神石MAXを反映した値で検索します。',
    recommended:'おすすめ陣法は、選んだステータスが高い組み合わせを全陣形から探すモードです。第1項目をおすすめ項目として扱い、第2項目を追加した時は2項目合計で比較できます。おすすめ中は因縁数指定の通常検索とは別モードになります。',
    recommended_off:'おすすめ解除は、おすすめ陣法モードを終了して通常の陣形・因縁指定検索へ戻す操作です。',
    clear_all:'全解除は、陣形や検索条件・配置など現在の陣法検索条件をまとめて初期状態へ戻すための操作です。',
    results_sort:'検索結果は各ステータス列で並べ替えできます。選んだ列が高い順・低い順になるよう切り替えられ、現在の選択列は強調表示されます。',
    active_bonds:'発動中因縁は、現在適用中の6人で成立している因縁を表示する欄です。Botは画面上の実際の成立結果を正として扱います。',
    fullmax_banner:'全MAX中の表示は、見聞録MAX・鬼神石MAX・転生MAXがすべて有効な時の目印です。手動で強化値を下げた場合は全MAX状態ではなくなります。',
    recommend_two_stats:'「腕力と知力高いの」のように2項目を言うと、その2項目の合計が高い組み合わせを全陣形から比較します。陣形を先に指定する必要はありません。'
  };
  function S(v){
    var x=String(v==null?'':v);
    try{x=x.normalize('NFKC');}catch(e){}
    return x.replace(/[\u3000\t]+/g,' ').replace(/\s+/g,' ').trim();
  }

  function isExplainCue(t){
    return /って何|とは|どういう意味|意味|説明|教えて|使い方|どう使う|何する|どんな機能|なにする|なにができる/.test(t);
  }

  function match(text){
    var t=S(text);
    if(!t)return '';

    if(/(?:腕力|耐久|器用|知力|魅力|生命|気合|土|水|火|風).*(?:と|＆|&|\+|＋).*(?:腕力|耐久|器用|知力|魅力|生命|気合|土|水|火|風)/.test(t)&&
       /高い|高め|強い|重視|おすすめ|合計|比較/.test(t) &&
       /何|どう|意味|検索|探/.test(t))return'recommend_two_stats';

    if(/全MAX中|全マックス中/.test(t)&&isExplainCue(t))return'fullmax_banner';
    if(/全MAX|全マックス|フルMAX|フルマックス/.test(t)&&isExplainCue(t))return'all_max';
    if(/おすすめ解除/.test(t)&&isExplainCue(t))return'recommended_off';
    if(/おすすめ陣法|おすすめモード|おすすめ検索/.test(t)&&isExplainCue(t))return'recommended';
    if(/検索基準|基礎値.*全MAX|全MAX込み.*基礎値/.test(t)&&isExplainCue(t))return'search_basis';
    if(/第1優先/.test(t)&&isExplainCue(t))return'priority1';
    if(/第2優先/.test(t)&&isExplainCue(t))return'priority2';
    if(/以上.*以下|以下.*以上|数値範囲|範囲指定|上限.*下限|下限.*上限/.test(t)&&isExplainCue(t))return'range';
    if(/第1.*第2.*合計|2項目合計|二項目合計|合計ソート/.test(t)&&isExplainCue(t))return'sum_sort';
    if(/込み合計|転生.*見聞録.*鬼神石.*合計/.test(t)&&isExplainCue(t))return'included_total';
    if(/差替.*(?:赤|緑|青|色)|赤.*UP|緑.*FLAT|青.*DOWN/.test(t)&&isExplainCue(t))return'swap_colors';
    if(/文曲.*(?:除外|人数|検索条件)/.test(t)&&isExplainCue(t))return'bunkyoku';
    if(/配置英傑/.test(t)&&isExplainCue(t))return'owned';
    if(/除外英傑/.test(t)&&isExplainCue(t))return'excluded';
    if(/全解除/.test(t)&&isExplainCue(t))return'clear_all';
    if(/検索結果.*(?:並べ替え|ソート)|並べ替え.*検索結果/.test(t)&&isExplainCue(t))return'results_sort';
    if(/発動中?因縁|成立因縁/.test(t)&&isExplainCue(t))return'active_bonds';
    if(/データ.*正|数値.*推測|どの数値.*正/.test(t)&&isExplainCue(t))return'data_rule';

    return '';
  }

  function respond(text){
    var key=match(text);
    if(!key)return {handled:false};
    return {handled:true,key:key,answer:HELP[key]||''};
  }

  window.JINPO_BOT_HELP={
    version:'2.0.0',
    get:function(k){return HELP[k]||'';},
    all:function(){return Object.assign({},HELP);},
    match:match,
    respond:respond
  };
})();
