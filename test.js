
const PITS=6, START=4;
let state={pits:[[4,4,4,4,4,4],[4,4,4,4,4,4]],stores:[0,0],turn:0,gameOver:false};
let history=[]; let marks={best:null,capture:null,extra:null};
const $=id=>document.getElementById(id);
function clone(s){return JSON.parse(JSON.stringify(s))}
function sum(a){return a.reduce((x,y)=>x+y,0)}
function opposite(i){return PITS-1-i}
function legalMoves(s,player=s.turn){return s.pits[player].map((v,i)=>v>0?i:null).filter(v=>v!==null)}
function sideEmpty(s,p){return sum(s.pits[p])===0}
function finishIfNeeded(s){ if(sideEmpty(s,0)||sideEmpty(s,1)){ for(let p=0;p<2;p++){s.stores[p]+=sum(s.pits[p]); s.pits[p]=Array(PITS).fill(0)} s.gameOver=true; } return s; }
function move(s,pit){
 const ns=clone(s); const player=ns.turn; if(ns.gameOver||ns.pits[player][pit]<=0) return {state:ns,invalid:true};
 let stones=ns.pits[player][pit]; ns.pits[player][pit]=0; let side=player, idx=pit; let last=null;
 while(stones>0){
  idx++;
  if(idx===PITS){
   if(side===player){ ns.stores[player]++; stones--; last={type:'store',player}; if(stones===0) break; }
   side=1-side; idx=-1; continue;
  }
  ns.pits[side][idx]++; stones--; last={type:'pit',side,idx};
 }
 let capture=0, capturedFrom=null;
 if(last && last.type==='pit' && last.side===player && ns.pits[player][last.idx]===1){
  const oi=opposite(last.idx); const opp=1-player;
  if(ns.pits[opp][oi]>0){
   capture=ns.pits[opp][oi]+1; capturedFrom=oi;
   ns.stores[player]+=capture; ns.pits[player][last.idx]=0; ns.pits[opp][oi]=0;
  }
 }
 const extra=last && last.type==='store' && last.player===player;
 if(!extra) ns.turn=1-player;
 finishIfNeeded(ns);
 return {state:ns,player,pit,last,capture,capturedFrom,extra,invalid:false};
}
function evaluate(s,root){
 if(s.gameOver) return (s.stores[root]-s.stores[1-root])*100;
 let score=(s.stores[root]-s.stores[1-root])*18 + (sum(s.pits[root])-sum(s.pits[1-root]))*1.4;
 legalMoves(s,root).forEach(i=>{const r=move({...clone(s),turn:root},i); if(r.capture) score+=r.capture*2.2; if(r.extra) score+=7;});
 legalMoves(s,1-root).forEach(i=>{const r=move({...clone(s),turn:1-root},i); if(r.capture) score-=r.capture*2.8; if(r.extra) score-=5;});
 return score;
}
function minimax(s,depth,root,alpha=-Infinity,beta=Infinity){
 if(depth===0||s.gameOver) return {score:evaluate(s,root)};
 const moves=legalMoves(s,s.turn); if(!moves.length){const ns=clone(s); ns.turn=1-ns.turn; return minimax(ns,depth-1,root,alpha,beta)}
 const max=s.turn===root; let best={score:max?-Infinity:Infinity,move:moves[0],result:null};
 for(const m of moves){ const r=move(s,m); const nxt=minimax(r.state,depth-1,root,alpha,beta); const adjusted=nxt.score + (r.capture? r.capture*4:0) + (r.extra?8:0);
  if(max ? adjusted>best.score : adjusted<best.score) best={score:adjusted,move:m,result:r};
  if(max){alpha=Math.max(alpha,adjusted); if(beta<=alpha) break;} else {beta=Math.min(beta,adjusted); if(beta<=alpha) break;}
 }
 return best;
}
function aiAnalysis(){
 const player=state.turn; const moves=legalMoves(state,player); if(!moves.length) return [];
 return moves.map(i=>{ const r=move(state,i); const look=minimax(r.state,7,player); let risk=0; legalMoves(r.state,1-player).forEach(j=>{const rr=move({...clone(r.state),turn:1-player},j); risk=Math.max(risk,rr.capture||0)});
  let score=look.score + (r.capture? r.capture*8:0) + (r.extra?12:0) - risk*5;
  return {pit:i,result:r,score,capture:r.capture,extra:r.extra,risk};
 }).sort((a,b)=>b.score-a.score);
}
function stonesHTML(n){let html=''; for(let i=0;i<Math.min(n,24);i++) html+='<span class="stone"></span>'; return html;}
function render(){
 $('store0').querySelector('.num').textContent=state.stores[0]; $('store1').querySelector('.num').textContent=state.stores[1];
 $('turnPill').textContent=state.gameOver?'終了':(state.turn===0?'あなたの番':'相手の番');
 $('myRow').innerHTML=''; $('oppRow').innerHTML='';
 for(let i=0;i<PITS;i++) addPit(1,i,$('oppRow'),PITS-i); for(let i=0;i<PITS;i++) addPit(0,i,$('myRow'),i+1);
 $('myInput').value=state.pits[0].join(','); $('oppInput').value=state.pits[1].join(','); $('myStoreInput').value=state.stores[0]; $('oppStoreInput').value=state.stores[1]; $('turnInput').value=state.turn;
 if(state.gameOver){ const diff=state.stores[0]-state.stores[1]; $('status').textContent=diff>0?'勝ち！ '+state.stores[0]+' 対 '+state.stores[1]:diff<0?'負け… '+state.stores[0]+' 対 '+state.stores[1]:'引き分け '+state.stores[0]+' 対 '+state.stores[1]; }
}
function addPit(player,i,parent,label){ const b=document.createElement('button'); b.type='button'; b.className='pit'; if(player===state.turn&&i===marks.best)b.classList.add('best'); if(player===state.turn&&i===marks.capture)b.classList.add('capture'); if(player===state.turn&&i===marks.extra)b.classList.add('extra'); b.innerHTML=`<small>${player===0?'自分':'相手'}${label}</small><div class="stones">${stonesHTML(state.pits[player][i])}</div><div class="count">${state.pits[player][i]}</div>`; b.onclick=()=>playPit(player,i); parent.appendChild(b); }
function playPit(player,i){ if(state.gameOver) return; if(player!==state.turn){$('status').textContent='今は '+(state.turn===0?'自分側':'相手側')+' の番です'; return;} if(state.pits[player][i]<=0){$('status').textContent='石がない穴は選べません'; return;} history.push(clone(state)); marks={best:null,capture:null,extra:null}; const r=move(state,i); state=r.state; let msg=(player===0?'自分':'相手')+'の'+(i+1)+'番を選択'; if(r.capture) msg+='：横取りで '+r.capture+' 個ゲット！'; if(r.extra) msg+='：ゴール着地でもう一回'; $('lastMove').textContent=msg; $('analysisBox').textContent='AIおすすめを押すと、この盤面から再計算します。'; render(); }
function showAI(){ const a=aiAnalysis(); if(!a.length){$('analysisBox').textContent='打てる手がありません。';return;} const best=a[0]; marks={best:best.pit,capture:best.capture?best.pit:null,extra:best.extra?best.pit:null}; $('status').textContent=(state.turn===0?'自分':'相手')+'は '+(best.pit+1)+'番がおすすめ';
 $('analysisBox').innerHTML='<b>おすすめ：'+(best.pit+1)+'番</b>'+ (best.capture?'　<span class="tag cap">横取り '+best.capture+'個</span>':'') + (best.extra?'　<span class="tag ext">もう一回</span>':'') + '<div class="hintList">'+ a.slice(0,6).map((x,k)=>'<div class="hintItem"><span>'+(k+1)+'位：'+(x.pit+1)+'番 '+(x.capture?'横取り'+x.capture+'個 ':'')+(x.extra?'もう一回 ':'')+(x.risk?'相手横取りリスク'+x.risk+'個':'')+'</span><span class="tag '+(k===0?'best':'')+'">'+Math.round(x.score)+'</span></div>').join('')+'</div><div class="sub">点数はアプリ内の簡易AI評価です。横取り・連続手・次の相手横取りリスクを含めています。</div>';
 render(); }
function parseNums(v){return v.split(/[、,\s]+/).filter(Boolean).map(x=>Math.max(0,parseInt(x,10)||0)).slice(0,PITS)}
$('aiBtn').onclick=showAI; $('undoBtn').onclick=()=>{if(history.length){state=history.pop(); marks={best:null,capture:null,extra:null}; $('lastMove').textContent='一手戻しました'; render();}};
$('swapBtn').onclick=()=>{state.turn=1-state.turn; marks={best:null,capture:null,extra:null}; $('lastMove').textContent='手番を切り替えました'; render();};
$('resetBtn').onclick=()=>{history.push(clone(state)); state={pits:[Array(PITS).fill(START),Array(PITS).fill(START)],stores:[0,0],turn:0,gameOver:false}; marks={best:null,capture:null,extra:null}; $('lastMove').textContent='初期盤面に戻しました'; $('analysisBox').textContent='AIおすすめを押すと、横取り・もう一回・相手の横取りリスクまで見ます。'; render();};
$('applyBtn').onclick=()=>{let my=parseNums($('myInput').value), op=parseNums($('oppInput').value); while(my.length<PITS)my.push(0); while(op.length<PITS)op.push(0); history.push(clone(state)); state={pits:[my,op],stores:[parseInt($('myStoreInput').value,10)||0,parseInt($('oppStoreInput').value,10)||0],turn:parseInt($('turnInput').value,10)||0,gameOver:false}; finishIfNeeded(state); marks={best:null,capture:null,extra:null}; $('lastMove').textContent='入力した盤面に合わせました'; render();};
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
render();
