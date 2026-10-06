'use strict';
const $ = s => document.querySelector(s), app = $('#app'), modal = $('#modal');
const PAIRS = Array.from({length:3},(_,a)=>Array.from({length:3},(_,b)=>[a,b])).flat().filter(([a,b])=>a!==b);
const STRUCTURES = [[0,3],[1,3],[2,3],[3,0],[3,1],[3,2]];
const TYPES = [...PAIRS,...STRUCTURES,[0,4],...[0,1,2,3].map(a=>[a,5]),[0,6],...[0,1,2].map(a=>[a,7])];
const LABELS = ['Name','3-letter code','1-letter code','Structure'];
const MODES = {mixed:'Mixed',codes:'Names & codes',structures:'Structures',draw:'Drawing',combined:'Combined · Hard',protonation:'Deprotonation',hh:'Henderson–Hasselbalch'};
const THEMES = ['dark','grey','light','slate'];
const SAVE_KEY = 'amino-dash:v2:' + location.pathname.replace(/index\.html$/,''), INTRO_KEY = SAVE_KEY+':intro';
const clone=x=>JSON.parse(JSON.stringify(x));
const shuffle=a=> {const out=a.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
const key=c=>c.join(':');
const day=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dateNumber=d=>Math.round(Date.parse(d+'T00:00:00Z')/86400000);
const dateString=n=>new Date(n*86400000).toISOString().slice(0,10);
const normalize=s=>s.trim().toLowerCase().replace(/\s+/g,' ').replace(/^aspartate$/,'aspartic acid').replace(/^glutamate$/,'glutamic acid');
const cardID=c=>c[0]*TYPES.length+TYPES.findIndex(([a,b])=>a===c[1]&&b===c[2]);
const fromID=n=>[Math.floor(n/TYPES.length),...TYPES[n%TYPES.length]];
function fresh(){return {version:2,scoreVersion:3,rotation:{},variants:[.3,.3,.3,.3],memory:{},retry:[],turn:0,totalXP:0,answers:0,fullCorrect:0,rounds:0,medals:0,bestStreak:0,bests:{},days:{},history:[],settings:{speed:true,sound:true,theme:'dark'}};}
function validKey(k){if(!/^\d{1,2}:\d:\d$/.test(k))return false;const [i,a,b]=k.split(':').map(Number);return i<20&&TYPES.some(p=>p[0]===a&&p[1]===b)&&(b!==7||a!==2||PKA[i][2]!==null);}
function validate(v){
  if(!v||v.version!==2)throw Error('Use an AD2 / AH2 or AD3 / AH3 save.');
  const n=fresh(),num=(x,max=1e12)=>Number.isFinite(x)&&x>=0&&x<=max,int=(x,max=1e12)=>Number.isSafeInteger(x)&&num(x,max);
  if(!v.memory||Array.isArray(v.memory)||Object.keys(v.memory).length>420)throw Error('Invalid mastery data.');
  for(const [k,a]of Object.entries(v.memory)){if(!validKey(k)||!Array.isArray(a)||a.length!==2||!num(a[0],8)||!int(a[1]))throw Error('Invalid card.');n.memory[k]=a.slice();}
  for(const k of ['turn','totalXP','answers','fullCorrect','rounds','medals','bestStreak']){if(!int(v[k]))throw Error('Invalid score.');n[k]=v[k];}
  if(n.fullCorrect>n.answers||n.medals>n.rounds)throw Error('Inconsistent scores.');
  if(!Array.isArray(v.retry)||v.retry.length>420)throw Error('Invalid retries.');
  const retries=new Set();n.retry=v.retry.map(r=>{if(!r||!validKey(r.key)||!int(r.due)||retries.has(r.key))throw Error('Invalid retry.');retries.add(r.key);return {key:r.key,due:r.due};});
  if(!v.bests||typeof v.bests!=='object'||Array.isArray(v.bests))throw Error('Invalid best scores.');
  for(const [k,x]of Object.entries(v.bests)){if(!Object.hasOwn(MODES,k)||!int(x))throw Error('Invalid best score.');n.bests[k]=x;}
  if(!v.days||Array.isArray(v.days)||Object.keys(v.days).length>366)throw Error('Invalid dates.');
  for(const [d,x]of Object.entries(v.days)){if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(dateNumber(d))||dateString(dateNumber(d))!==d||!int(x))throw Error('Invalid date.');n.days[d]=x;}
  if(!Array.isArray(v.history)||v.history.length>60)throw Error('Invalid history.');
  n.history=v.history.map(h=>{if(!h||!Object.hasOwn(MODES,h.mode)||!int(h.score)||!num(h.correct,12)||!int(h.seconds,1e9)||!/^\d{4}-\d{2}-\d{2}$/.test(h.date)||!Number.isFinite(dateNumber(h.date)))throw Error('Invalid round.');const questions=h.questions??12,scoring=h.scoring??2;if(!int(questions,12)||questions<1||h.correct>questions||![2,3].includes(scoring))throw Error('Invalid round length.');return {...h,questions,scoring};});
  if(v.scoreVersion!==3)n.bests={}; // New scoring starts a new leaderboard; old rounds stay in history.
  if(v.rotation){
    if(typeof v.rotation!=='object'||Array.isArray(v.rotation))throw Error('Invalid rotation.');
    for(const [m,a]of Object.entries(v.rotation)){
      if(!Object.hasOwn(MODES,m)||!Array.isArray(a)||a.length!==21||!a.every(x=>int(x))||a.slice(1).some(x=>x>a[0]))throw Error('Invalid rotation.');
      n.rotation[m]=a.slice();
    }
  }
  if(v.variants){if(!Array.isArray(v.variants)||v.variants.length!==4||!v.variants.every(x=>num(x,1)))throw Error('Invalid variants.');n.variants=v.variants.slice();}
  n.settings={speed:v.settings?.speed!==false,sound:v.settings?.sound!==false,theme:THEMES.includes(v.settings?.theme)?v.settings.theme:'dark'};
  return n;
}
let save=fresh(),blocked=false,round=null,state='home',editor=null,ready=0,audioContext;
try{const raw=localStorage.getItem(SAVE_KEY);if(raw)save=validate(JSON.parse(raw));}catch{blocked=true;$('#storage-warning').textContent='Local progress could not be read. Restore a backup to continue saving.';}
function persist(){if(blocked)return false;try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));$('#storage-warning').textContent='';return true;}catch{$('#storage-warning').textContent='Browser storage unavailable. Copy or download a save before closing.';return false;}}
function applyTheme(){document.documentElement.dataset.theme=save.settings.theme;$('#theme').value=save.settings.theme;document.querySelector('meta[name="theme-color"]').content=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();}
function showModal(html){$('#modal-body').innerHTML=html;if(!modal.open)modal.showModal();}
function img(i,cls='structure',alt='Amino acid skeletal structure'){return `<img class="${cls}" src="assets/${i}.svg" alt="${alt}" data-zoom="${i}">`;}
function zoom(i){showModal(`<h2>${AA[i][0]}</h2>${img(i)}<p>Neutral form · Carbon-bound hydrogen implicit</p>`);}
function bindZoom(){app.querySelectorAll('[data-zoom]').forEach(el=>{el.oncontextmenu=e=>{e.preventDefault();zoom(+el.dataset.zoom);};if(!el.closest('.choice')){el.tabIndex=0;el.onclick=()=>zoom(+el.dataset.zoom);el.onkeydown=e=>{if(e.key==='Enter'){e.stopPropagation();zoom(+el.dataset.zoom);}};}});}
// Missing attached SVGs have a local graph fallback; existing /assets/ files take priority.
document.addEventListener('error',e=>{const el=e.target;if(el.tagName!=='IMG'||!el.hasAttribute('data-zoom')||el.dataset.fallback)return;el.dataset.fallback='1';el.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(graphSVG(molecule(+el.dataset.zoom)));},true);
function trained(){return Object.entries(save.memory).filter(([k,v])=>{const [,a,b]=k.split(':').map(Number);return a<3&&b<3&&v[0]>=2;}).length;}
function streakDays(){let d=new Date(),n=0;if(!save.days[day()])d.setDate(d.getDate()-1);for(let i=0;i<366;i++){const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;if(!save.days[k])break;n++;d.setDate(d.getDate()-1);}return n;}
function trends(mode){
  const modes=mode?[mode]:Object.keys(MODES),blocks=[];
  for(const m of modes){const h=save.history.filter(h=>h.mode===m&&h.scoring===3).slice(0,12).reverse();if(!h.length)continue;
    const bests=[];let best=0;h.forEach(x=>bests.push(best=Math.max(best,x.score)));
    const points=bests.map((x,i)=>`${12+i*276/Math.max(1,h.length-1)},${65-x/Math.max(1,...bests)*50}`).join(' ');
    const recent=h.slice(-3),earlier=h.slice(-6,-3),avg=a=>a.reduce((s,x)=>s+x.correct/(x.questions||12)*100,0)/a.length;
    const change=earlier.length===3?avg(recent)-avg(earlier):null,first=h[0].score,gain=first?Math.round((best-first)/first*100):null;
    blocks.push(`<article class="trend"><div class="row"><strong>${MODES[m]}</strong><span class="gold">${save.bests[m]||best} best</span></div><svg class="spark" viewBox="0 0 300 80" role="img" aria-label="Best score across ${h.length} recent rounds"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="${12+(h.length-1)*276/Math.max(1,h.length-1)}" cy="${65-bests.at(-1)/Math.max(1,...bests)*50}" r="4" fill="currentColor"/></svg><small>${h.length} recent rounds${gain!==null?' · Best '+(gain>=0?'+':'')+gain+'%':''}</small><p>${change!==null?(change>=0?'+':'')+change.toFixed(1)+' percentage points accuracy vs previous 3 rounds':(avg(recent)).toFixed(1)+'% recent accuracy'} · ${Math.round(recent.reduce((s,x)=>s+x.seconds,0)/recent.length)}s / round</p></article>`);
  }
  return blocks.length?`<div class="trends">${blocks.join('')}</div>`:'<p>Complete a round to start tracking your scores and accuracy.</p>';
}
function home(){state='home';round=null;editor=null;const today=save.days[day()]||0;
  app.innerHTML=`<section class="hero"><div><span class="eyebrow">Practice</span><h1>Amino Acids</h1><div class="stats"><div class="stat"><strong>${save.totalXP.toLocaleString()}</strong><small>XP</small></div><div class="stat"><strong>${streakDays()}</strong><small>Day streak</small></div><div class="stat"><strong>${save.medals}</strong><small>Medals</small></div></div></div><aside class="panel"><div class="row"><span class="eyebrow">Daily target</span><span class="tag">${today>=24?'COMPLETE':'24 ANSWERS'}</span></div><h2>${Math.min(today,24)} <span class="muted">/ 24</span></h2><div class="progress"><div style="width:${Math.min(100,today/24*100)}%"></div></div><div class="row"><small>Mastered name/code prompts</small><strong>${trained()} / 120</strong></div></aside></section><div class="row"><h2>Select mode</h2><span class="tag">12 QUESTIONS · PROTONATION 6</span></div><section class="modes">${[
  ['mixed','↔','6 names/codes + 6 structure questions'],['codes','Aa','Names and codes in every direction'],['structures','⌬','Identify structures and draw from names or codes'],['draw','✎','Draw from memory · Autograde with override'],['combined','4','One given, three answers: structure, name and codes'],['protonation','H⁺','6 questions · Identify hidden residues and protonation sites'],['hh','pH','Solve pH, acid/base ratios and protonated fractions']
  ].map(([m,icon,txt])=>`<button class="mode" data-start="${m}"><span class="icon">${icon}</span><strong>${MODES[m]}</strong><small>${txt}</small><small>Best: ${save.bests[m]||0} pts</small></button>`).join('')}</section><div class="row settings"><small>Missed cards return after three questions. Overdue amino acids reappear; Combined gently favors weaker prompts.</small><label class="switch"><input id="speed" type="checkbox" ${save.settings.speed?'checked':''}> Speed bonus</label><label class="switch"><input id="sound" type="checkbox" ${save.settings.sound?'checked':''}> Gold sound</label></div><section class="panel improvement"><div class="row"><h2>Improvement</h2><small>${save.answers} answers · ${save.rounds} rounds · Best streak ${save.bestStreak}</small></div>${trends()}<details><summary>Round history</summary>${save.history.length?`<table class="history"><thead><tr><th>Date / mode</th><th>Accuracy</th><th>Score</th><th>Time</th></tr></thead><tbody>${save.history.slice(0,12).map(h=>`<tr><td>${h.date}<br><small>${MODES[h.mode]}${h.scoring===2?' · previous scoring':''}</small></td><td>${Math.round(h.correct/(h.questions||12)*100)}%</td><td>${h.score}</td><td>${h.seconds}s</td></tr>`).join('')}</tbody></table>`:'<p>No rounds completed.</p>'}</details></section>`;
  app.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>start(b.dataset.start));
  for(const k of ['speed','sound'])$('#'+k).onchange=e=>{save.settings[k]=e.target.checked;persist();};
}
function unlockSound(){if(!save.settings.sound||matchMedia('(prefers-reduced-motion: reduce)').matches)return;try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});}catch{}}
function thonk(delay=0){if(!save.settings.sound||!audioContext||audioContext.state!=='running')return;try{const t=audioContext.currentTime+delay,o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(55,t+.09);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.09,t+.007);g.gain.exponentialRampToValueAtTime(.0001,t+.15);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+.16);}catch{}}
function celebrate(kind='retry'){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const host=$('#effects'),box=document.createElement('div');box.className='confetti';
  for(let i=0;i<(kind==='gold'?14:8);i++){const bit=document.createElement('i');bit.style.setProperty('--x',`${(Math.random()-.5)*230}px`);bit.style.setProperty('--y',`${-40-Math.random()*80}px`);bit.style.setProperty('--r',`${Math.random()*300}deg`);bit.style.background=i%2?'var(--gold)':'var(--green)';box.append(bit);}
  host.append(box);setTimeout(()=>box.remove(),1000);
}
function start(mode){unlockSound();round={mode,length:mode==='protonation'?6:12,done:0,correct:0,score:0,streak:0,hints:0,started:Date.now(),recent:[],givens:[],mix:[]};for(let n=0;n<3;n++)round.mix.push(...shuffle(['codes','codes','to','from']));next();}
function weighted(pool,weight){const weights=pool.map(weight);let r=Math.random()*weights.reduce((a,b)=>a+b,0);return pool.find((c,i)=>(r-=weights[i])<0)||pool.at(-1);}
function choose(){
  let pairs=round.mode==='draw'?[[0,4]]:round.mode==='structures'?STRUCTURES:round.mode==='combined'?[0,1,2,3].map(a=>[a,5]):round.mode==='protonation'?[[0,6]]:round.mode==='hh'?[0,1,2].map(a=>[a,7]):PAIRS;
  if(round.mode==='mixed'){const m=round.mix[round.done];pairs=m==='codes'?PAIRS:STRUCTURES.filter(p=>(p[1]===3)===(m==='to'));}
  const cards=AA.flatMap((_,i)=>pairs.filter(([a,b])=>b!==7||a!==2||PKA[i][2]!==null).map(([a,b])=>[i,a,b])),keys=new Set(cards.map(key));
  const rotation=save.rotation[round.mode]||=Array(21).fill(0);rotation[0]++;
  const age=i=>rotation[0]-rotation[i+1],oldest=Math.max(...AA.map((_,i)=>age(i)));
  const varied=c=>round.mode!=='combined'||round.givens.length<2||!round.givens.slice(-2).every(a=>a===c[1]);
  // Coverage outranks retries once a residue is overdue. Random ties avoid fixed ordering.
  let overdue=oldest>=24?cards.filter(c=>age(c[0])===oldest):[];
  if(overdue.length){const balanced=overdue.filter(varied);return weighted(balanced.length?balanced:overdue,c=>1+(round.mode==='combined'?2*save.variants[c[1]]:0));}
  const retry=save.retry.filter(r=>r.due<=save.turn&&keys.has(r.key)&&!round.recent.includes(+r.key.split(':')[0])&&varied(r.key.split(':').map(Number))).sort((a,b)=>a.due-b.due)[0];
  if(retry)return retry.key.split(':').map(Number);
  const pending=new Set(save.retry.map(r=>r.key));let pool=cards.filter(c=>!pending.has(key(c))&&!round.recent.includes(c[0])&&varied(c));
  if(!pool.length)pool=cards.filter(c=>!round.recent.includes(c[0])&&varied(c));if(!pool.length)pool=cards;
  return weighted(pool,c=>{
    const [level,seen]=save.memory[key(c)]||[0,0];
    const freshness=1+(seen?Math.min(2,Math.max(0,(Date.now()/1000-seen)/86400)):0),coverage=1+Math.min(2,age(c[0])/10);
    return freshness*coverage*(round.mode==='combined'?1+2*save.variants[c[1]]:1)/(1+level*.5);
  });
}
function questionShell(body,extra=''){app.innerHTML=`<section class="question ${extra}"><div class="row"><span class="eyebrow">${MODES[round.mode]}</span><span>${round.done+1} / ${round.length} · ${round.score} pts · <span class="gold">${round.streak} streak</span></span></div><div class="progress"><div style="width:${round.done/round.length*100}%"></div></div>${body}</section>`;}
function next(){
  if(round.done===round.length){finish();return;}save.turn++;round.card=choose();round.wasMissed=save.retry.some(r=>r.key===key(round.card));round.recent=[...round.recent,round.card[0]].slice(-3);round.feedbackHTML='';round.asked=performance.now();round.checks=null;round.hinted=false;round.difficulty=1;editor=null;save.rotation[round.mode][round.card[0]+1]=save.rotation[round.mode][0];round.givens.push(round.card[1]);round.givens=round.givens.slice(-2);
  if(round.mode==='combined'){combinedQuestion();return;}if(round.mode==='protonation'){protonQuestion();return;}if(round.mode==='hh'){hhQuestion();return;}
  const [i,a,b]=round.card,level=save.memory[key(round.card)]?.[0]||0;
  state=round.mode==='draw'||round.mode==='structures'&&b===3?'draw':level>=2&&b<3?'type':'choice';round.answer=b<3?AA[i][b]:i;
  round.difficulty=state==='draw'?1.65:state==='type'?1.25:1;
  questionShell(`<div class="prompt"><span class="tag">${state==='draw'?'DRAW STRUCTURE':state==='type'?'TYPE '+LABELS[b].toUpperCase():'SELECT '+LABELS[b].toUpperCase()}</span>${a===3?img(i):`<h1>${AA[i][a]}</h1>`}</div><div id="answer-area"></div>`);
  const area=$('#answer-area');
  if(state==='draw'){
    area.innerHTML=`<div id="editor"></div><label class="switch"><input type="checkbox" id="paper"> Drawing on paper</label><small>Autograder checks connectivity, labels and bond orders. Stereochemistry needs your review.</small><div class="actions"><button class="primary" id="reveal">Check structure</button></div>`;
    editor=new MoleculeEditor($('#editor'));$('#paper').onchange=e=>$('#editor').hidden=e.target.checked;$('#reveal').onclick=reveal;
  }else if(state==='type'){
    area.innerHTML=`<form id="answer-form"><label for="typed">${LABELS[b]}</label><input id="typed" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"><div class="actions"><button class="primary">Submit</button><button type="button" id="teach">Show answer</button></div></form>`;
    $('#answer-form').onsubmit=e=>{e.preventDefault();submit();};$('#teach').onclick=()=>grade(0);$('#typed').focus();
  }else{
    round.options=shuffle([...shuffle(AA.map((v,j)=>b===3?j:v[b]).filter(v=>v!==round.answer)).slice(0,3),round.answer]);
    area.innerHTML=`<div class="choices">${round.options.map((v,n)=>`<button class="choice" data-pick="${n}"><b>${n+1}</b>${b===3?img(v,'structure',`Option ${n+1}`):v}</button>`).join('')}</div><small>1–4 or click${b===3?' · Right-click to zoom':''}</small>`;
    app.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>pick(+b.dataset.pick));
  }
  bindZoom();window.scrollTo(0,0);
}
function pick(n){if(state==='choice')grade(round.options[n]===round.answer?1:0);}
function submit(){if(state==='type')grade(normalize($('#typed').value)===normalize(round.answer)?1:0);}
function structureCheck(i){return graphMatch(editor,molecule(i));}
function reveal(){
  if(state!=='draw')return;state='judge';round.elapsed=performance.now()-round.asked;const paper=$('#paper').checked,correct=!paper&&structureCheck(round.card[0]);editor.freeze();const own=editor.svg.outerHTML,i=round.card[0];
  $('#answer-area').innerHTML=`<div class="compare">${paper?'':`<div><h3>Your drawing</h3><div class="editor-wrap">${own}</div></div>`}<div><h3>Reference</h3>${img(i)}</div></div><p>${AA[i][3]}</p><p>${paper?'Self-grade your paper drawing.':`Autograder: <strong>${correct?'Match':'No match'}</strong>. Check stereochemistry before accepting.`}</p><div class="actions centered"><button class="primary" id="accept-grade">${paper?'Use self-grade below':`Accept ${correct?'100':'0'}%`}</button></div><details ${paper?'open':''}><summary>Override autograder / partial credit</summary><div class="credit">${[0,.25,.5,.75,1].map(c=>`<button data-credit="${c}">${c*100}%</button>`).join('')}</div></details><small>Atom labels must include heteroatom H (NH₂, OH, etc.); carbon H is implicit. Wedge/dash stereochemistry is reviewed manually. Equivalent aromatic bond placements are accepted.</small>`;
  $('#accept-grade').hidden=paper;$('#accept-grade').onclick=()=>grade(correct?1:0);app.querySelectorAll('[data-credit]').forEach(b=>b.onclick=()=>grade(+b.dataset.credit));bindZoom();
}
function combinedQuestion(){
  state='combined';const [i,given]=round.card;round.difficulty=given===3?1.45:1.85;
  questionShell(`<div class="combined-row">${[3,1,2,0].map(a=>`<div class="combined-part"><label ${a===given||a===3?'':`for="part-${a}"`}>${LABELS[a]} ${a===given?'<span class="tag">GIVEN</span>':''}</label>${a===given?(a===3?img(i):`<h2>${AA[i][a]}</h2>`):a===3?'<div id="editor"></div>':`<input id="part-${a}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">`}</div>`).join('')}</div><small>All three missing parts count equally. Review / override the structure grade before continuing.</small><div class="actions"><button id="check-combined" class="primary">Check all three</button></div>`,'combined-question');
  if(given!==3)editor=new MoleculeEditor($('#editor'));
  $('#check-combined').onclick=()=>{
    if(state!=='combined')return;round.elapsed=performance.now()-round.asked;state='judge';
    const checks=[0,1,2,3].filter(a=>a!==given).map(a=>({a,ok:a===3?structureCheck(i):normalize($('#part-'+a).value)===normalize(AA[i][a])}));
    if(editor)editor.freeze();
    app.querySelectorAll('input').forEach(el=>el.disabled=true);$('#check-combined').remove();
    const area=document.createElement('div');area.innerHTML=`<div class="panel"><h3>Check</h3>${checks.map(c=>`<p>${LABELS[c.a]}: <strong>${c.ok?'Correct':'Incorrect'}</strong>${c.a<3?' · '+AA[i][c.a]:''}</p>`).join('')}${given!==3?`${img(i)}<label class="switch"><input type="checkbox" id="override-structure" ${checks.find(c=>c.a===3).ok?'checked':''}> Structure correct (override; review stereochemistry)</label>`:''}<button id="accept-combined" class="primary">Continue</button></div>`;$('.combined-question').append(area);bindZoom();
    $('#accept-combined').onclick=()=>{const s=checks.find(c=>c.a===3);if(s)s.ok=$('#override-structure').checked;round.checks=checks;grade(checks.filter(c=>c.ok).length/3);};
  };bindZoom();window.scrollTo(0,0);
}
function pkaChart(){return `<aside class="pka-panel panel"><h3>pKₐ chart</h3><div class="table-scroll"><table class="pka-table"><thead><tr><th>Amino acid</th><th>α-COOH</th><th>α-amino</th><th>R</th></tr></thead><tbody>${[0,1,2,3].map(group=>`<tr class="group"><th colspan="4">${GROUP_NAMES[group]}</th></tr>${AA.flatMap((a,i)=>GROUPS[i]===group?[`<tr><th scope="row">${a[0]}</th>${PKA[i].map(x=>`<td>${x===null?'—':x.toFixed(2)}</td>`).join('')}</tr>`]:[]).join('')}`).join('')}</tbody></table></div><small>For peptides: pKₐ(N) from the first residue; pKₐ(C) from the last; all ionizable R groups. Use this chart's values as the exercise model.</small></aside>`;}
function protonQuestion(){
  state='proton';const i=round.card[0];let sequence=[i];
  if(Math.random()<.65){const ionizable=[8,12,15,16,17,18,19];sequence=shuffle([i,...shuffle(ionizable.filter(a=>a!==i)).slice(0,Math.random()<.5?1:2)]);}
  sequence.forEach(a=>save.rotation[round.mode][a+1]=save.rotation[round.mode][0]);
  const graph=peptide(sequence);let ph;
  do{ph=Math.round((.5+Math.random()*13)*10)/10;}while(graph.sites.some(s=>Math.abs(s.pka-ph)<.35));
  round.proton={sequence,graph,ph,selected:new Set()};
  round.difficulty=1.2+Math.min(5,graph.sites.length)*.12;
  graph.sites.forEach(s=>graph.atoms[s.atom].e=s.base);
  questionShell(`<div class="chem-layout"><div><div class="row"><h2>${sequence.length===1?'Identify the amino acid':sequence.length+'-residue peptide'}</h2><span class="ph">pH ${ph.toFixed(1)}</span></div><p>Click every outlined atom that keeps its <strong>ionizable proton</strong>. Fixed heteroatom hydrogens are shown. Click again to remove H⁺.</p><div class="proton-canvas"><div id="proton-svg"></div></div><div class="actions"><button class="primary" id="grade-proton">Next · Grade</button><button id="clear-protons">Clear</button><button id="proton-hint">Hint · names (−25%)</button></div><p id="proton-names" hidden></p><small>Predominant form: protonated below pKₐ, deprotonated above. Peptide-bond nitrogens do not use pKₐ(N).</small></div>${pkaChart()}</div>`,'chem-question');
  drawProtons();$('#proton-hint').onclick=()=>{round.hinted=true;round.hints++;$('#proton-names').hidden=false;$('#proton-names').textContent=sequence.map(a=>AA[a].slice(0,3).join(' · ')).join(' → ');$('#proton-hint').disabled=true;drawProtons();};$('#grade-proton').onclick=gradeProtons;$('#clear-protons').onclick=()=>{round.proton.selected.clear();drawProtons();};window.scrollTo(0,0);
}
function drawProtons(graded=false){
  const p=round.proton,g=clone(p.graph);
  g.sites.forEach((s,index)=>g.atoms[s.atom].e=(graded?p.ph<s.pka:p.selected.has(index))?s.acid:s.base);
  let svg=graphSVG(g),circles='';
  g.sites.forEach((s,index)=>{const a=g.atoms[s.atom],selected=p.selected.has(index),expected=p.ph<s.pka;circles+=`<g class="proton-site ${graded?(selected===expected?'site-correct':'site-wrong'):selected?'selected':''}" ${graded?'':`role="button" tabindex="0" data-site="${index}" aria-pressed="${selected}" aria-label="${round.hinted?AA[s.aa][0]:'Residue '+(s.index+1)} ${s.kind==='N'?'N terminus':s.kind==='C'?'C terminus':'side chain'} proton"`}><circle cx="${a.x}" cy="${a.y}" r="33"/><title>${graded||round.hinted?AA[s.aa][0]:'Residue '+(s.index+1)} ${s.kind} · ${graded?'pKa '+s.pka:'Toggle ionizable H⁺'}</title>${(graded?expected:selected)?`<text x="${a.x+23}" y="${a.y-20}">H⁺</text>`:''}</g>`;});
  svg=svg.replace('</svg>',circles+'</svg>');$('#proton-svg').innerHTML=svg;
  if(!graded)$('#proton-svg').querySelectorAll('[data-site]').forEach(el=>{const toggle=()=>{const j=+el.dataset.site;p.selected.has(j)?p.selected.delete(j):p.selected.add(j);drawProtons();$('#proton-svg').querySelector(`[data-site="${j}"]`).focus();};el.onclick=toggle;el.onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();toggle();}};});
}
function gradeProtons(){
  if(state!=='proton')return;const p=round.proton;const correct=p.graph.sites.filter((s,j)=>(p.ph<s.pka)===p.selected.has(j)).length;
  drawProtons(true);const svg=$('#proton-svg').innerHTML;
  const charge=p.graph.sites.reduce((sum,s)=>sum+(p.ph<s.pka?s.charge:s.charge-1),0);
  round.feedbackHTML=`<h2>${p.sequence.map(i=>AA[i][1]).join('–')} · pH ${p.ph.toFixed(1)}</h2><div class="proton-canvas">${svg}</div><p>${correct} / ${p.graph.sites.length} sites correct · Net charge ${charge>0?'+':''}${charge}</p><table class="history"><thead><tr><th>Site</th><th>pKₐ</th><th>Expected</th><th>Your choice</th></tr></thead><tbody>${p.graph.sites.map((s,j)=>`<tr><td>${AA[s.aa][1]} ${s.kind==='N'?'N terminus':s.kind==='C'?'C terminus':'R group'}</td><td>${s.pka.toFixed(2)}</td><td>${p.ph<s.pka?'Protonated':'Deprotonated'}</td><td>${p.selected.has(j)?'Protonated':'Deprotonated'} ${(p.ph<s.pka)===p.selected.has(j)?'✓':'×'}</td></tr>`).join('')}</tbody></table>`;
  grade(correct/p.graph.sites.length);
}
function hhQuestion(){
  state='hh';const [i,site]=round.card,pka=PKA[i][site],delta=shuffle([-2,-1.5,-1,-.5,.5,1,1.5,2])[0],ph=+(pka+delta).toFixed(2),ratio=10**(ph-pka),task=Math.floor(Math.random()*4);
  const label=['α-carboxyl','α-amino','side chain'][site];let prompt,answer,unit,explanation;
  if(task===0){const r=+ratio.toPrecision(5);answer=pka+Math.log10(r);prompt=`The deprotonated : protonated ratio for the ${label} group is <strong>${r} : 1</strong>. Find the pH.`;unit='pH (±0.03)';explanation=`pH = ${pka.toFixed(2)} + log₁₀(${r}) = ${answer.toFixed(3)}`;}
  else if(task===1){answer=ratio;prompt=`At <strong>pH ${ph.toFixed(2)}</strong>, find the <strong>deprotonated / protonated</strong> ratio for the ${label} group.`;unit='Ratio (2% tolerance)';explanation=`[base] / [acid] = 10^(${ph.toFixed(2)} − ${pka.toFixed(2)}) = ${answer.toPrecision(4)}`;}
  else if(task===2){answer=1/ratio;prompt=`At <strong>pH ${ph.toFixed(2)}</strong>, find the <strong>protonated / deprotonated</strong> ratio for the ${label} group.`;unit='Ratio (2% tolerance)';explanation=`[acid] / [base] = 10^(${pka.toFixed(2)} − ${ph.toFixed(2)}) = ${answer.toPrecision(4)}`;}
  else{answer=100/(1+ratio);prompt=`At <strong>pH ${ph.toFixed(2)}</strong>, what <strong>percentage</strong> of the ${label} groups are protonated?`;unit='Percent (±0.1 percentage point)';explanation=`Protonated % = 100 / (1 + 10^(${ph.toFixed(2)} − ${pka.toFixed(2)})) = ${answer.toFixed(3)}%`;}
  round.hh={i,site,task,answer,explanation,prompt};round.difficulty=task===3?1.5:1.3;
  questionShell(`<div class="chem-layout"><div><h2>${AA[i][0]}</h2><p class="hh-prompt">${prompt}</p><p class="equation">pH = pKₐ + log₁₀([base] / [acid])</p><small>Acid = protonated; base = deprotonated, including amine groups.</small><form id="hh-form"><label for="hh-answer">${unit}</label><input id="hh-answer" type="text" inputmode="decimal" autocomplete="off" placeholder="e.g. 0.032 or 3.2e-2"><div class="actions"><button class="primary">Check answer</button><button type="button" id="hh-reveal">Show solution</button></div><p class="toast" id="hh-status" role="status"></p></form>${calculatorHTML()}</div>${pkaChart()}</div>`,'chem-question');
  $('#hh-form').onsubmit=e=>{e.preventDefault();const n=parseHHAnswer($('#hh-answer').value);if(n===null){$('#hh-status').textContent='Enter a finite number, e.g. .0316, 3.16e-2, or 0.0316:1.';return;}round.feedbackHTML=`<h2>${AA[i][0]} · ${label}</h2><p>${prompt}</p><p>Your answer: ${n}</p><p class="equation">${explanation}</p>`;grade(hhCorrect(n,answer,task)?1:0);};
  $('#hh-reveal').onclick=()=>{round.feedbackHTML=`<h2>${AA[i][0]} · ${label}</h2><p>${prompt}</p><p class="equation">${explanation}</p>`;grade(0);};bindCalculator();$('#hh-answer').focus();window.scrollTo(0,0);
}
function parseHHAnswer(value) {
  const raw=value.trim().replace(/[−–]/g,'-').replace(/%$/,'').trim(),number='[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';
  const m=raw.match(new RegExp('^('+number+')(?:\\s*[:/]\\s*('+number+'))?$','i'));
  if(!m)return null;const n=Number(m[1])/(m[2]===undefined?1:Number(m[2]));return Number.isFinite(n)?n:null;
}
function hhCorrect(value,answer,task) {
  if(!Number.isFinite(value)||(task!==0&&value<0))return false;
  const tolerance=task===0?.03:task===3?.1:Math.abs(answer)*.02;
  return Math.abs(value-answer)<=tolerance+Number.EPSILON*Math.max(1,Math.abs(answer))*8;
}
function calculatorHTML(){return `<details class="calculator" open><summary>Calculator</summary><label for="calc-input" class="sr-only">Calculator expression</label><input id="calc-input" type="text" spellcheck="false" autocomplete="off" placeholder="10^(7.4-6.04)"><div class="calc-keys">${['7','8','9','/','log(','4','5','6','*','10^(','1','2','3','-','(', '0','.','^','+',')'].map(k=>`<button type="button" data-calc="${k}">${k}</button>`).join('')}</div><div class="actions"><button type="button" id="calc-equals" class="primary">=</button><button type="button" id="calc-back">⌫</button><button type="button" id="calc-clear">Clear</button><button type="button" id="calc-use">Use result</button></div><output id="calc-output" aria-live="polite"></output><small>log is base 10 · Supports scientific notation and parentheses.</small></details>`;}
// Recursive descent parser: no eval, external scripts, or account required.
function calculate(source){
  if(source.length>240)throw Error('Expression too long.');const s=source.replace(/\s+/g,'');let p=0;
  const primary=()=>{if(s.startsWith('log(',p)){p+=4;const x=expression();if(s[p++]!==')')throw Error('Missing ).');if(x<=0)throw Error('log requires a positive number.');return Math.log10(x);}if(s[p]==='('){p++;const x=expression();if(s[p++]!==')')throw Error('Missing ).');return x;}const m=s.slice(p).match(/^(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?/i);if(!m)throw Error('Enter a valid expression.');p+=m[0].length;return Number(m[0]);};
  const power=()=>{let x=primary();if(s[p]==='^'){p++;x=x**unary();}return x;};
  const unary=()=>{if(s[p]==='+'){p++;return unary();}if(s[p]==='-'){p++;return -unary();}return power();};
  const term=()=>{let x=unary();while(s[p]==='*'||s[p]==='/'){const op=s[p++],y=unary();x=op==='*'?x*y:x/y;}return x;};
  const expression=()=>{let x=term();while(s[p]==='+'||s[p]==='-'){const op=s[p++],y=term();x=op==='+'?x+y:x-y;}return x;};
  const result=expression();if(p!==s.length||!Number.isFinite(result))throw Error('Expression has no finite result.');return result;
}
function bindCalculator(){let result=null;
  const run=()=>{try{result=calculate($('#calc-input').value);$('#calc-output').textContent=Number(result.toPrecision(10)).toString();}catch(e){result=null;$('#calc-output').textContent=e.message;}};
  app.querySelectorAll('[data-calc]').forEach(b=>b.onclick=()=>{const el=$('#calc-input'),p=el.selectionStart,end=el.selectionEnd;el.value=el.value.slice(0,p)+b.dataset.calc+el.value.slice(end);el.focus();el.setSelectionRange(p+b.dataset.calc.length,p+b.dataset.calc.length);result=null;});
  $('#calc-equals').onclick=run;$('#calc-input').oninput=()=>result=null;$('#calc-input').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();run();}};
  $('#calc-clear').onclick=()=>{$('#calc-input').value='';$('#calc-output').textContent='';result=null;};$('#calc-back').onclick=()=>{const el=$('#calc-input'),p=el.selectionStart,end=el.selectionEnd;el.value=el.value.slice(0,p===end?Math.max(0,p-1):p)+el.value.slice(end);result=null;el.focus();el.setSelectionRange(Math.max(0,p-1),Math.max(0,p-1));};
  $('#calc-use').onclick=()=>{if(result===null)run();if(result!==null){$('#hh-answer').value=Number(result.toPrecision(10));$('#hh-answer').focus();}};
}
function learn(card,credit,retry=true) {
  const k=key(card),level=save.memory[k]?.[0]||0;
  save.memory[k]=[Math.round((credit===1?Math.min(8,level+1):credit===0?0:Math.min(8,level+credit*.5))*1000)/1000,Math.floor(Date.now()/1000)];
  if(retry){save.retry=save.retry.filter(r=>r.key!==k);if(credit<1)save.retry.push({key:k,due:save.turn+3});}
}
function combinedLearning() {
  const [i,given]=round.card,checks=round.checks;
  if(!checks)return;
  if(given<3)checks.forEach(c=>learn([i,given,c.a],c.ok?1:0,false));
  else {
    checks.forEach(c=>learn([i,3,c.a],c.ok?1:0,false));
    PAIRS.forEach(([a,b])=>{if(checks.find(c=>c.a===a).ok)learn([i,a,b],checks.find(c=>c.a===b).ok?1:0,false);});
  }
  // Smooth, bounded adaptation: weak given fields get at most 3x sampling weight.
  save.variants[given]=save.variants[given]*.8+.2*(checks.some(c=>!c.ok)?1:0);
}
function scoreAnswer(credit,seconds) {
  const base=Math.round((100+35*(round.difficulty-1))*credit),combo=credit===1?Math.round(12*Math.pow(round.streak-1,.85)):0;
  const target=round.mode==='combined'?100:round.mode==='draw'||editor?80:round.mode==='protonation'?45:round.mode==='hh'?35:state==='type'?14:8;
  const pace=save.settings.speed&&credit===1?Math.round(70*Math.exp(-Math.max(0,seconds)/target)):0;
  return {base,combo,pace,total:Math.round((base+combo+pace)*(round.hinted?.75:1))};
}
function grade(credit){
  if(!['choice','type','judge','proton','hh'].includes(state))return;
  const i=round.card[0],seconds=(round.elapsed??performance.now()-round.asked)/1000;
  learn(round.card,credit);if(round.mode==='combined')combinedLearning();
  round.done++;round.correct+=credit;round.streak=credit===1?round.streak+1:0;
  const score=scoreAnswer(credit,seconds),points=score.total;state='feedback';round.elapsed=null;
  round.score+=points;save.totalXP+=points;save.answers++;save.fullCorrect+=credit===1?1:0;save.bestStreak=Math.max(save.bestStreak,round.streak);
  const before=save.days[day()]||0;save.days[day()]=before+1;const dates=Object.keys(save.days).sort();for(const d of dates.slice(0,Math.max(0,dates.length-366)))delete save.days[d];persist();ready=performance.now()+(credit===1?250:600);
  const recovered=credit===1&&round.wasMissed;
  app.innerHTML=`<section class="question feedback"><span class="eyebrow">${round.done} / ${round.length} · ${round.score} pts</span><h1>${credit===1?`+${points} · Correct`:credit>0?`+${points} · Partial`:'Incorrect'}</h1>${round.feedbackHTML||`<h2>${AA[i].slice(0,3).join(' · ')}</h2>${img(i)}<p>${AA[i][3]}</p>`}<p class="score-detail">${credit>0?`${score.base} answer + ${score.combo} streak + ${score.pace} pace${round.hinted?' · hint ×0.75':''}`:''}</p><p>${recovered?'<span class="gold">Missed card recovered ✓</span>':credit<1?`${Math.round(credit*100)}% credit · This card will return.`:round.streak>=3?`${round.streak} correct in a row`:''}</p>${before<24&&save.days[day()]>=24?'<p class="gold">Daily target reached</p>':''}<button class="primary" id="next">${round.done===round.length?'View summary':'Next card'} →</button></section>`;
  $('#next').onclick=()=>{if(performance.now()>=ready)next();};bindZoom();if(recovered||before<24&&save.days[day()]>=24)celebrate();window.scrollTo(0,0);
}
function finish(){
  state='end';save.rounds++;const gold=Math.abs(round.correct-round.length)<1e-8&&round.hints===0&&round.score>=round.length*(save.settings.speed?170:130),medal=gold?'Gold':round.correct/round.length>=.85?'Silver':'Complete',old=save.bests[round.mode]||0,isBest=round.score>old;
  save.bests[round.mode]=Math.max(old,round.score);if(round.correct/round.length>=.85)save.medals++;const seconds=Math.round((Date.now()-round.started)/1000);
  save.history.unshift({date:day(),mode:round.mode,correct:Math.min(round.length,round.correct),questions:round.length,scoring:3,score:round.score,seconds});save.history=save.history.slice(0,60);persist();
  app.innerHTML=`<section class="question panel feedback"><span class="eyebrow">${MODES[round.mode]} · Finished</span>${gold?'<div class="gold-stars" aria-label="Three gold stars"><span>★</span><span>★</span><span>★</span></div>':''}<h1 class="gold">${medal}</h1><h2>${Math.round(round.correct/round.length*100)}% accuracy</h2><div class="stats"><div class="stat"><strong>${round.score}</strong><small>Points</small></div><div class="stat"><strong>${seconds}s</strong><small>Time</small></div><div class="stat"><strong>${save.bests[round.mode]}</strong><small>Best</small></div></div><p class="gold">${isBest?'New best'+(old?' · +'+(round.score-old)+' points':''):''}</p><p>${round.hints?round.hints+' hint used · ':''}Gold: perfect, no hints, ${round.length*(save.settings.speed?170:130)}+ points. Keep building your streak and pace.</p>${trends(round.mode)}<div class="actions centered"><button class="primary" id="again">Play again</button><button id="menu">Main menu</button></div></section>`;
  $('#again').onclick=()=>start(round.mode);$('#menu').onclick=home;if(gold){celebrate('gold');thonk(.30);thonk(.47);thonk(.64);}else if(isBest||round.correct/round.length>=.85)celebrate();
}
function atlas(){state='atlas';round=null;
  app.innerHTML=`<div class="row"><h1>Field guide</h1><span class="tag">${trained()} / 120 MASTERED</span></div><div class="atlas">${AA.map((v,i)=>{const entries=Object.entries(save.memory).filter(([k])=>+k.split(':')[0]===i),level=entries.reduce((s,[,v])=>s+v[0],0);return `<button data-aa="${i}">${img(i)}<strong>${v[0]}</strong><small>${v[1]} · ${v[2]}</small><div class="progress"><div style="width:${Math.min(100,level/(TYPES.length*8)*100)}%"></div></div></button>`;}).join('')}</div>`;
  app.querySelectorAll('[data-aa]').forEach(b=>b.onclick=()=>{const i=+b.dataset.aa;showModal(`<span class="eyebrow">${AA[i][1]} · ${AA[i][2]}</span><h2>${AA[i][0]}</h2>${img(i)}<p>${AA[i][3]}</p><p>pKₐ: COOH ${PKA[i][0]} · amino ${PKA[i][1]} · R ${PKA[i][2]??'—'}</p><small>${i===4?'L-isoleucine: 2S, 3S':i===11?'L-threonine: 2S, 3R':'Neutral form; alpha stereochemistry unspecified.'}</small>`);});
}
// Crockford base32: no I/L/O/U; groups are cosmetic, case/whitespace tolerant.
const ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const METRICS=['turn','totalXP','answers','fullCorrect','rounds','medals','bestStreak'];
function checksum(bytes){let h=2166136261;for(const x of bytes){h^=x;h=Math.imul(h,16777619);}return h>>>0;}
function base32(bytes){let out='',bits=0,value=0;for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){bits-=5;out+=ALPHABET[(value>>>bits)&31];}}if(bits)out+=ALPHABET[(value<<(5-bits))&31];return out;}
function unbase32(s){const out=[];let bits=0,value=0;for(const c of s){const n=ALPHABET.indexOf(c);if(n<0)throw Error('Code contains an unsupported character.');value=(value<<5)|n;bits+=5;if(bits>=8){bits-=8;out.push((value>>>bits)&255);}}if(bits&&(value&((1<<bits)-1)))throw Error('Incomplete code.');return out;}
function encode(v,hand=false){
  const bytes=[],put=x=>{if(!Number.isSafeInteger(x)||x<0)throw Error('Invalid save number.');do{let b=x%128;x=Math.floor(x/128);bytes.push(b+(x?128:0));}while(x);},float=x=>{const b=new Uint8Array(8);new DataView(b.buffer).setFloat64(0,x,true);bytes.push(...b);};
  bytes.push(3);METRICS.forEach(k=>put(v[k]));bytes.push((v.settings.speed?1:0)+(v.settings.sound?2:0)+THEMES.indexOf(v.settings.theme)*4);Object.keys(MODES).forEach(k=>put(v.bests[k]||0));
  if(hand){
    const levels=AA.map((_,i)=>{const a=Object.entries(v.memory).filter(([k])=>+k.split(':')[0]===i).map(([,v])=>v[0]);return a.length?Math.min(8,Math.round(a.reduce((s,x)=>s+x,0)/a.length)):0;});
    for(let i=0;i<20;i+=2)bytes.push(levels[i]+levels[i+1]*16);
  }else{
    const memory=Object.entries(v.memory).sort((a,b)=>cardID(a[0].split(':').map(Number))-cardID(b[0].split(':').map(Number)));put(memory.length);let last=0;
    for(const [k,a]of memory){const id=cardID(k.split(':').map(Number));put(id-last);last=id;put(Math.round(a[0]*1000));put(a[1]);}
    put(v.retry.length);v.retry.forEach(r=>{put(cardID(r.key.split(':').map(Number)));put(r.due);});
    const days=Object.entries(v.days).sort((a,b)=>a[0].localeCompare(b[0]));put(days.length);last=0;for(const [d,x]of days){const n=dateNumber(d);put(n-last);last=n;put(x);}
    put(v.history.length);for(const h of v.history){put(Object.keys(MODES).indexOf(h.mode));put(h.score);float(h.correct);put(h.seconds);put(dateNumber(h.date));put(h.questions||12);put(h.scoring||2);}
  }
  if(!hand){Object.keys(MODES).forEach(m=>(v.rotation[m]||Array(21).fill(0)).forEach(put));v.variants.forEach(x=>put(Math.round(x*1000)));}
  const check=checksum(bytes);for(let i=0;i<4;i++)bytes.push((check>>>(i*8))&255);
  return (hand?'AH3':'AD3')+'-'+base32(bytes).match(/.{1,5}/g).join('-');
}
function decode(code){
  if(code.length>30000)throw Error('Code too large.');const cleaned=code.toUpperCase().replace(/[\s-]/g,'').replace(/[IL]/g,'1').replace(/O/g,'0'),prefix=cleaned.slice(0,3);
  if(!['AD2','AH2','AD3','AH3'].includes(prefix))throw Error('Use an AD2 / AD3 full backup or AH2 / AH3 hand code.');
  const bytes=unbase32(cleaned.slice(3));if(bytes.length<20)throw Error('Code is incomplete.');const body=bytes.slice(0,-4),check=bytes.slice(-4).reduce((s,b,i)=>(s|(b<<(i*8)))>>>0,0);if(checksum(body)!==check)throw Error('Checksum failed. Check every group for a copying error.');
  let pos=0;const byte=()=>{if(pos>=body.length)throw Error('Code ended early.');return body[pos++];},get=()=>{let x=0,power=1;for(let i=0;i<6;i++){const b=byte();x+=(b&127)*power;if(!Number.isSafeInteger(x)||x>1e12)throw Error('Save number too large.');if(b<128)return x;power*=128;}throw Error('Invalid number.');},count=max=>{const n=get();if(n>max)throw Error('Save has too many entries.');return n;},float=()=>{const a=Uint8Array.from(Array.from({length:8},byte));return new DataView(a.buffer).getFloat64(0,true);};
  const version=byte();if(![2,3].includes(version)||Number(prefix.at(-1))!==version)throw Error('Unknown save version.');const v=fresh();v.scoreVersion=version;METRICS.forEach(k=>v[k]=get());const settings=byte();if(settings>15)throw Error('Invalid settings.');v.settings={speed:!!(settings&1),sound:!!(settings&2),theme:THEMES[settings>>2]};Object.keys(MODES).forEach(k=>v.bests[k]=get());
  if(prefix.startsWith('AH')){
    for(let i=0;i<20;i+=2){const b=byte();for(let j=0;j<2;j++){const level=j?b>>4:b&15;if(level>8)throw Error('Invalid mastery.');if(level)for(const [a,t]of TYPES){const k=key([i+j,a,t]);if(validKey(k))v.memory[k]=[level,0];}}}
  }else{
    let id=0;for(let n=count(420);n>0;n--){id+=get();if(id>=420)throw Error('Invalid card index.');const k=key(fromID(id));if(Object.hasOwn(v.memory,k))throw Error('Duplicate card.');v.memory[k]=[get()/1000,get()];}
    for(let n=count(420);n>0;n--){const id=get();if(id>=420)throw Error('Invalid retry card.');v.retry.push({key:key(fromID(id)),due:get()});}
    let date=0;for(let n=count(366);n>0;n--){date+=get();if(date>dateNumber('9999-12-31'))throw Error('Invalid day.');v.days[dateString(date)]=get();}
    for(let n=count(60);n>0;n--){const m=get();if(m>=Object.keys(MODES).length)throw Error('Invalid mode.');const score=get(),correct=float(),seconds=get(),date=get();if(date>dateNumber('9999-12-31'))throw Error('Invalid round date.');const questions=version===3?get():12,scoring=version===3?get():2;v.history.push({mode:Object.keys(MODES)[m],score,correct,seconds,date:dateString(date),questions,scoring});}
  }
  if(version===3&&prefix==='AD3'){Object.keys(MODES).forEach(m=>v.rotation[m]=Array.from({length:21},get));v.variants=Array.from({length:4},()=>get()/1000);}
  if(pos!==body.length)throw Error('Unexpected trailing data.');return validate(v);
}
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function importHTML(){return `<label for="import-code">Have a save code?</label><textarea id="import-code" class="compact-code" placeholder="AD3-… full backup or AH3-… hand code" spellcheck="false" autocapitalize="characters"></textarea><div class="actions"><button id="review">Review & restore</button><label class="file-button">Load .txt<input id="import-file" type="file" accept=".txt,text/plain"></label></div><div id="review-area" role="status"></div>`;}
function bindImport(){
  $('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>30000){$('#review-area').textContent='Backup file is too large.';return;}try{$('#import-code').value=await file.text();}catch{$('#review-area').textContent='Could not read this file.';}};
  $('#review').onclick=()=>{try{const raw=$('#import-code').value.trim(),candidate=decode(raw),hand=/^AH[23]/i.test(raw.replace(/[\s-]/g,''));$('#review-area').innerHTML=`<div class="panel"><h3>Restore ${hand?'hand checkpoint':'full backup'}</h3><p>${candidate.totalXP} XP · ${candidate.rounds} rounds · ${candidate.medals} medals</p><p>${hand?'Scores, settings and approximate mastery only. Retry queue, daily streak and round history will reset.':'All recorded progress, retry cards, rotation, settings and history will be restored.'}</p><p>This replaces progress in this browser and ends an active round.</p><button id="confirm-restore" class="primary">Restore this save</button></div>`;
    $('#confirm-restore').onclick=()=>{save=candidate;blocked=false;try{localStorage.setItem(INTRO_KEY,'1');}catch{}const stored=persist();applyTheme();modal.close();home();if(!stored)$('#storage-warning').textContent='Save restored for this session. Browser storage unavailable; export before closing.';};
  }catch(e){$('#review-area').textContent=e.message;}};
}
function readme(first=false){
  showModal(`<h2>${first?'Welcome to Amino Dash':'Readme'}</h2><p>Progress saves automatically in this browser. Transfer it to any phone, tablet or computer with a save code. No account required.</p>${importHTML()}<div class="actions"><button id="start-practice" class="primary">${first?'Start practicing':'Done'}</button></div><details class="save-help" ${first?'':'open'}><summary>How saves work</summary><ol><li>Open <strong>Save / restore</strong> on your current device.</li><li>Copy a code, download a .txt backup, or write down a hand code.</li><li>On another device, open this app and paste the code here or load the file.</li><li>Review the summary, then restore. Codes work across browsers and operating systems; devices do not sync automatically.</li></ol><p><strong>Full backup (AD3):</strong> exact recorded mastery, scores, missed cards, question rotation, Combined adaptation, daily activity, the last 60 rounds and settings.</p><p><strong>Hand code (AH3):</strong> shorter, grouped in five characters, with totals, best scores, settings and rounded average mastery for each amino acid. It omits retries, daily activity and round history. Use a full backup when transferring everything.</p><p>Spaces, hyphens and lowercase are accepted. A checksum catches copy errors. AD2 / AH2 backups still import; mastery is preserved. Earlier scores remain in history under previous scoring. Export before clearing browser data.</p></details>`);
  bindImport();$('#start-practice').onclick=()=>modal.close();
}
function backup(){
  showModal(`<h2>Save / restore</h2><label for="save-kind">Save format</label><select id="save-kind"><option value="full">Full backup · all progress</option><option value="hand">Hand code · compact checkpoint</option></select><p id="format-note"></p><label for="export-code">Current save code <small id="code-size"></small></label><textarea id="export-code" readonly spellcheck="false"></textarea><div class="actions"><button id="copy" class="primary">Copy code</button><button id="download">Download .txt</button></div><p class="toast" id="save-status" role="status"></p><hr>${importHTML()}`);
  let code;const refresh=()=>{const hand=$('#save-kind').value==='hand';code=encode(save,hand);$('#export-code').value=code;$('#code-size').textContent=`· ${code.replace(/-/g,'').length} characters`;$('#format-note').textContent=hand?'Keeps scores, bests, settings and approximate per-amino-acid mastery. Omits retries, daily streak and history.':'Keeps all recorded progress. For copying by hand, choose the shorter hand code.';$('#save-status').textContent='';};refresh();$('#save-kind').onchange=refresh;
  $('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(code);$('#save-status').textContent='Copied.';}catch{$('#export-code').select();$('#save-status').textContent='Press Ctrl+C / ⌘C to copy the selected code.';}};$('#download').onclick=()=>download('amino-dash-'+($('#save-kind').value)+'-save.txt',code);bindImport();
}
$('#close-modal').onclick=()=>modal.close();modal.addEventListener('close',()=>{try{localStorage.setItem(INTRO_KEY,'1');}catch{}});
$('#home').onclick=home;$('#brand').onclick=e=>{e.preventDefault();home();};$('#atlas').onclick=atlas;$('#backup').onclick=backup;$('#readme').onclick=()=>readme();$('#theme').onchange=e=>{save.settings.theme=e.target.value;applyTheme();persist();};
document.addEventListener('keydown',e=>{if(modal.open)return;if(e.key==='Escape'){home();return;}if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA','SELECT','BUTTON','A','SUMMARY'].includes(document.activeElement.tagName)||document.activeElement.closest('[data-site]'))return;if(state==='choice'&&/^[1-4]$/.test(e.key)){e.preventDefault();pick(+e.key-1);}else if(e.key==='Enter'||e.code==='Space'){e.preventDefault();if(state==='home'&&e.key==='Enter')start('mixed');else if(state==='end'&&e.key==='Enter')start(round.mode);else if(state==='draw')reveal();else if(state==='feedback'&&performance.now()>=ready)next();}});
window.addEventListener('storage',e=>{if(e.key===SAVE_KEY||e.key===null){blocked=true;$('#storage-warning').textContent='Progress changed in another tab. Reload to load the latest save.';}});
applyTheme();home();let firstLoad=true;try{firstLoad=!localStorage.getItem(INTRO_KEY);}catch{}if(firstLoad)readme(true);
