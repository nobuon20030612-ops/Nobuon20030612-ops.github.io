/*
 * 歩き巫女 AI会話脳 設定 v1.1.0
 *
 * Firebase AI Logic + Gemini Developer API を利用。
 * AI Logicが未設定・無料枠到達・通信障害の場合は、
 * 既存のローカル歩き巫女へ自動フォールバックする。
 */
(function(){
  'use strict';
  if(window.JINPO_BOT_AI_CONFIG)return;

  window.JINPO_BOT_AI_CONFIG={
    version:'1.1.0',

    // Firebase AI Logicを有効化したら、そのままAI会話脳を使用する。
    // 未設定時も既存Botへ自動フォールバックするため、サイト自体は止まらない。
    enabled:true,

    // Function Calling公式対応を優先。
    // gemini-3.6-flashは一般AI Logic対応だが、
    // 現行Function Callingガイドで明示されている3.5 Flashを採用する。
    model:'gemini-3.5-flash',

    // 現在のFirebase SDK設定に合わせる。
    sdkVersion:'12.16.0',

    timeoutMs:18000,
    cooldownMs:5*60*1000,
    maxHistoryMessages:18,
    maxSequentialFunctionCalls:6,

    // 公開サイトではApp Checkが整うまでAIを有効扱いにしない。
    requireAppCheck:true,

    // AI回答が空・失敗・API未設定の場合は従来エンジンを使う。
    fallbackToLocal:true
  };
})();
