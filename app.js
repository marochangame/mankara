'use strict';

const START = { human:[4,4,4,4,4,4], cpu:[4,4,4,4,4,4], humanStore:0, cpuStore:0, turn:'human', over:false };
let state = clone(START);
let history = [];
let showHints = true;

const els = {
  cpuPits: document.getElementById('cpuPits'), humanPits: document.getElementById('humanPits'), cpuStore: document.getElementById('cpuStore'), humanStore: document.getElementById('humanStore'),
  scoreCpu: document.getElementById('scoreCpu'), scoreHuman: document.getElementById('scoreHuman'), turnText: document.getElementById('turnText'), bestMoveTitle: document.getElementById('bestMoveTitle'),
  coachReason: document.getElementById('coachReason'), ranking: document.getElementById('ranking'), hintBtn: document.getElementById('hintBtn'), newGameBtn: document.getElementById('newGameBtn'),
  resetBtn: document.getElementById('resetBtn'), undoBtn: document.getElementById('undoBtn'), cpuMoveBtn: document.getElementById('cpuMoveBtn')
};

function clone(x){ return JSON.parse(JSON.stringify(x)); }
function sum(a){ return a.reduce((p,c)=>p+c,0); }
function legalMoves(s, side=s.turn){ return s[side].map((v,i)=>v>0?i:null).filter(v=>v!==null); }
function other(side){ return side==='human'?'cpu':'human'; }

function applyMove(s, side, pitIndex){
  const ns = clone(s); if(ns.over) return ns;
  const opp = other(side); let stones = ns[side][pitIndex]; if(stones<=0) return ns;
  ns[side][pitIndex]=0; let pos = pitIndex; let lane = side;
  while(stones>0){
    pos++;
    if(lane===side && pos===6){
      if(side==='human') ns.humanStore++; else ns.cpuStore++;
      stones--;
      if(stones===0){ ns.turn = side; finishIfOver(ns); return ns; }
      lane = opp; pos = -1;
    } else if(lane===opp && pos===6){
      lane = side; pos = -1;
    } else {
      ns[lane][pos]++; stones--;
      if(stones===0){
        if(lane===side && ns[side][pos]===1){
          const opposite = 5-pos;
          const captured = ns[opp][opposite];
          if(captured>0){
            ns[opp][opposite]=0; ns[side][pos]=0;
            if(side==='human') ns.humanStore += captured + 1; else ns.cpuStore += captured + 1;
          }
        }
        ns.turn = opp;
      }
    }
  }
  finishIfOver(ns); return ns;
}

function finishIfOver(s){
  if(sum(s.human)===0 || sum(s.cpu)===0){
    s.humanStore += sum(s.human); s.cpuStore += sum(s.cpu);
    s.human = [0,0,0,0,0,0]; s.cpu = [0,0,0,0,0,0]; s.over = true;
  }
}

function evaluate(s){
  if(s.over){ return (s.humanStore - s.cpuStore) * 1000; }
  const storeDiff = s.humanStore - s.cpuStore;
  const pitDiff = sum(s.human) - sum(s.cpu);
  const mobility = legalMoves(s,'human').length - legalMoves(s,'cpu').length;
  let extra = 0, capture = 0;
  for(const side of ['human','cpu']){
    for(const m of legalMoves(s,side)){
      const n = applyMove(s,side,m);
      const sign = side==='human'?1:-1;
      if(n.turn===side && !n.over) extra += sign*1.7;
      const gain = (side==='human'?n.humanStore-s.humanStore:n.cpuStore-s.cpuStore);
      if(gain>1) capture += sign*gain*.5;
    }
  }
  return storeDiff*8 + pitDiff*.35 + mobility*.25 + extra + capture;
}

const memo = new Map();
function key(s, depth, alpha, beta){ return `${depth}|${s.turn}|${s.human}|${s.cpu}|${s.humanStore}|${s.cpuStore}|${s.over}`; }
function minimax(s, depth, alpha=-Infinity, beta=Infinity){
  const k = key(s,depth); if(memo.has(k)) return memo.get(k);
  if(depth===0 || s.over){ const val = evaluate(s); memo.set(k,val); return val; }
  const moves = legalMoves(s,s.turn);
  if(s.turn==='human'){
    let best = -Infinity;
    for(const m of moves){ best = Math.max(best, minimax(applyMove(s,'human',m), depth-1, alpha, beta)); alpha = Math.max(alpha,best); if(beta<=alpha) break; }
    memo.set(k,best); return best;
  } else {
    let best = Infinity;
    for(const m of moves){ best = Math.min(best, minimax(applyMove(s,'cpu',m), depth-1, alpha, beta)); beta = Math.min(beta,best); if(beta<=alpha) break; }
    memo.set(k,best); return best;
  }
}

function analyze(s, side='human'){
  memo.clear();
  const moves = legalMoves(s,side);
  const rows = moves.map(m=>{
    const ns = applyMove(s,side,m);
    const score = minimax(ns, 8);
    const pct = Math.max(3, Math.min(97, Math.round(50 + Math.tanh(score/24)*47)));
    return {move:m, score, pct, next:ns, reason: reasonForMove(s, side, m, ns)};
  });
  rows.sort((a,b)=> side==='human' ? b.score-a.score : a.score-b.score);
  return rows;
}

function reasonForMove(s, side, m, ns){
  const beforeStore = side==='human'?s.humanStore:s.cpuStore;
  const afterStore = side==='human'?ns.humanStore:ns.cpuStore;
  const notes=[];
  if(ns.turn===side && !ns.over) notes.push('最後の石がストアに入り、連続手番になります');
  if(afterStore-beforeStore>1) notes.push(`この一手で${afterStore-beforeStore}点取れます`);
  if(ns.over) notes.push('この手で終局まで進みます');
  if(notes.length===0) notes.push('点差と次の相手手番を見て、損が少ない手です');
  return notes.join('。') + '。';
}

function render(){
  els.cpuPits.innerHTML=''; els.humanPits.innerHTML='';
  let analysis = (!state.over && state.turn==='human') ? analyze(state,'human') : [];
  const best = analysis[0];
  state.cpu.slice().reverse().forEach((v,revIdx)=>{
    const idx = 5-revIdx; const div = pitEl(v, idx+1, false); els.cpuPits.appendChild(div);
  });
  state.human.forEach((v,idx)=>{
    const div = pitEl(v, idx+1, true); if(showHints && best && best.move===idx) div.classList.add('best');
    div.addEventListener('click',()=>humanMove(idx)); els.humanPits.appendChild(div);
  });
  els.cpuStore.textContent = state.cpuStore; els.humanStore.textContent = state.humanStore; els.scoreCpu.textContent = state.cpuStore; els.scoreHuman.textContent = state.humanStore;
  if(state.over){
    const result = state.humanStore>state.cpuStore?'あなたの勝ち！':state.humanStore<state.cpuStore?'相手の勝ち':'引き分け';
    els.turnText.textContent = `終了：${result}`; els.bestMoveTitle.textContent = result; els.coachReason.textContent = `最終スコアは あなた${state.humanStore} - 相手${state.cpuStore} です。`;
    els.ranking.innerHTML=''; return;
  }
  els.turnText.textContent = state.turn==='human'?'あなたの手番':'相手の手番';
  if(state.turn==='human' && best){
    els.bestMoveTitle.textContent = `おすすめ：左から${best.move+1}番　有利度${best.pct}%`;
    els.coachReason.textContent = best.reason;
    els.ranking.innerHTML = analysis.map((r,i)=>`<div class="rank-row"><b>${i+1}位 ${r.move+1}番</b><div class="bar"><span style="width:${r.pct}%"></span></div><b>${r.pct}%</b></div>`).join('');
  } else {
    els.bestMoveTitle.textContent = '相手AIの手番です'; els.coachReason.textContent = '「相手AIを動かす」を押すと、相手が一手進めます。'; els.ranking.innerHTML='';
  }
}
function pitEl(v,num,isHuman){ const div=document.createElement('button'); div.className=`pit ${isHuman?'human':'disabled'}`; div.disabled=!isHuman||state.turn!=='human'||v===0||state.over; div.innerHTML=`<span class="num">${num}</span>${v}${isHuman?'<span class="badge">タップ</span>':''}`; return div; }
function humanMove(idx){ if(state.turn!=='human'||state.human[idx]===0||state.over) return; history.push(clone(state)); state=applyMove(state,'human',idx); render(); }
function cpuMove(){ if(state.turn!=='cpu'||state.over) return; history.push(clone(state)); const choices=analyze(state,'cpu'); if(choices[0]) state=applyMove(state,'cpu',choices[0].move); render(); }
function reset(){ state=clone(START); history=[]; render(); }
els.cpuMoveBtn.addEventListener('click', cpuMove); els.newGameBtn.addEventListener('click', reset); els.resetBtn.addEventListener('click', reset); els.undoBtn.addEventListener('click',()=>{ if(history.length){ state=history.pop(); render(); }}); els.hintBtn.addEventListener('click',()=>{ showHints=!showHints; els.hintBtn.textContent=showHints?'おすすめ非表示':'おすすめ表示'; render(); });
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
render();
