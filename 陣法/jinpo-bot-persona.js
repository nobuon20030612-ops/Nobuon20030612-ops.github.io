/*
 * 歩き巫女 キャラクター口調 v1.3.0
 * コアActionの結果や数値は変更せず、表示文だけを柔らかい敬語へ整える。
 */
(function(){
  'use strict';
  if(window.__JINPO_BOT_PERSONA_INSTALLED__)return;
  window.__JINPO_BOT_PERSONA_INSTALLED__=true;
  var VERSION='1.3.0';

  function S(v){return String(v==null?'':v);}
  function isTechnical(text){return /構成ファイル|JSファイル|準備できていません|HTTP\s*\d+|エラー|例外|internal_id|読み込み順/.test(text);}

  function soften(text,data){
    text=S(text);if(!text)return text;
    if(isTechnical(text))return text;

    text=text
      .replace(/^こんにちは。陣法の検索・適用・差替・強化設定などを会話から操作できます。$/,'こんにちはなのですよ。陣法の検索や適用、差替、強化設定までお手伝いできるのですよ。')
      .replace(/^どういたしまして。続けて条件変更や適用もそのまま指示できます。$/,'どういたしましてなのですよ。続けて条件変更や適用も、そのままおまかせくださいね。')
      .replace(/^そうですね。無理せず快適に過ごしてください。陣法操作はそのまま続けられます。$/,'そうですね。無理せず快適に過ごしてくださいね。陣法操作はいつでも続けられるのですよ。')
      .replace(/^承知しました。操作は実行していません。内容を言い直してください。$/,'わかったのですよ。操作は実行していないので、安心して言い直してくださいね。')
      .replace(/^操作内容を特定できませんでした。/,'うまく意図をつかめなかったのですよ。')
      .replace(/^現在、画面に検索結果がありません。$/,'今は画面に検索結果がないのですよ。')
      .replace(/^現在、画面に差替候補がありません。$/,'今は画面に差替候補がないのですよ。')
      .replace(/^保存編成はありません。$/,'保存されている編成はまだないのですよ。')
      .replace(/^今回は候補が見つかりませんでした。/,'今回は候補が見つからなかったのですよ。')
      .replace(/^候補がかなり多めです。/,'候補がかなり多めなのですよ。')
      .replace(/^候補が多めです。/,'候補が少し多めなのですよ。')
      .replace(/ということでよろしいですか？/g,'ということで合っていますか？');

    if(/で検索しました。/.test(text)&&!/なのですよ/.test(text)){
      text=text.replace(/で検索しました。/,'で検索しました。');
      text+='\n気になる候補を見ていくのですよ。';
    }else if(/適用しました。/.test(text)&&!/なのですよ/.test(text)){
      text+='\n次の操作もそのまま選べるのですよ。';
    }else if(/差替候補を取得しました。/.test(text)&&!/なのですよ/.test(text)){
      text+='\n良さそうな候補を一緒に見てみるのですよ。';
    }
    return text;
  }

  function install(){
    if(!window.JINPO_BOT||typeof window.JINPO_BOT.handle!=='function'||!window.JINPO_AI_CHAT||typeof window.JINPO_AI_CHAT.setTransport!=='function')return false;
    if(window.JINPO_BOT_PERSONA&&window.JINPO_BOT_PERSONA.active){
      window.JINPO_AI_TRANSPORT=window.JINPO_BOT_PERSONA.wrapped;
      window.JINPO_AI_CHAT.setTransport(window.JINPO_BOT_PERSONA.wrapped);
      return true;
    }
    var core=window.JINPO_BOT.handle;
    var wrapped=async function(payload){
      var out=await core(payload);
      if(out&&typeof out==='object'&&typeof out.answer==='string')out.answer=soften(out.answer,out.data||{});
      return out;
    };
    window.JINPO_AI_TRANSPORT=wrapped;
    window.JINPO_AI_CHAT.setTransport(wrapped);
    window.JINPO_BOT_PERSONA={version:VERSION,active:true,soften:soften,core:core,wrapped:wrapped};
    return true;
  }

  function boot(){if(install())return;var n=0,t=setInterval(function(){n++;if(install()||n>100)clearInterval(t);},80);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  if(window.addEventListener)window.addEventListener('load',function(){setTimeout(install,0);},{once:true});
})();
