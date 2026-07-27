/*
 * たいらの野望 正本知識データ v1.0.0
 *
 * ここは「サイト内で確定している情報」を置くマスタ。
 * Web検索より先に参照するため、登録済みの内容は即答できる。
 * 会話ユーザーが勝手にこの正本を書き換えることはない。
 *
 * 追加時は facts / topics を増やすだけでよい。
 */
(function(){
  'use strict';
  if(window.JINPO_TAIRANO_KNOWLEDGE_DATA)return;

  window.JINPO_TAIRANO_KNOWLEDGE_DATA={
    version:'1.0.0',
    siteName:'たいらの野望',
    facts:[
      {
        id:'counter_tenka_nijou_ashikaga_yoshiaki',
        kind:'counter',
        canonical:'足利義昭',
        aliases:['足利','足利義昭','義昭'],
        contexts:['天下統一奇譚','二条城','二条城編'],
        cues:['カウンター','counter','数値','いくつ','何番','何'],
        value:'157',
        answer:'天下統一奇譚・二条城編の足利義昭ですね。カウンターは157なのですよ。',
        page:'nijoujou.html',
        sourceLabel:'たいらの野望・天下統一奇譚 二条城'
      }
    ],
    topics:[
      {
        id:'site_overview',
        names:['たいらの野望','このサイト'],
        cues:['何がある','何できる','どんなサイト','ツール','機能'],
        answer:'たいらの野望は、信長の野望Online向けの攻略・計算・検索ツールをまとめたサイトなのですよ。陣法、英傑一覧、能力計算、家臣計算機、七星転生、食料、星海の荒石、鬼神石、九十九、魔導結晶、カウンターなどを案内できます。'
      },
      {
        id:'counter_menu',
        names:['カウンター'],
        cues:['何がある','種類','メニュー','中身'],
        answer:'カウンターには「天下統一奇譚」「修羅の間」「天下武技大会」の入口があるのですよ。',
        page:'counter.html'
      },
      {
        id:'tenka_story_stages',
        names:['天下統一奇譚','天下統一'],
        cues:['何がある','ステージ','場所','章','中身'],
        answer:'天下統一奇譚には、桶狭間・富士地下洞穴・京都・賤ヶ岳・比叡山・二条城の各ページがあるのですよ。',
        page:'tenka_story.html'
      },
      {
        id:'nijoujou_page',
        names:['二条城','二条城編'],
        cues:['どこ','ページ','開いて','見たい','何'],
        answer:'二条城は「カウンター → 天下統一奇譚 → 二条城」から見られるのですよ。',
        page:'nijoujou.html'
      }
    ]
  };
})();
