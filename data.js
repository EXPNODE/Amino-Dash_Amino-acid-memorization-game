const AA = [
  ["Glycine", "Gly", "G", "H"],
  ["Alanine", "Ala", "A", "CH3"],
  ["Valine", "Val", "V", "CH(CH3)2"],
  ["Leucine", "Leu", "L", "CH2-CH(CH3)2"],
  ["Isoleucine", "Ile", "I", "CH(CH3)-CH2-CH3"],
  ["Methionine", "Met", "M", "CH2-CH2-S-CH3"],
  ["Proline", "Pro", "P", "(CH2)3 loops back to backbone N (N has one H)"],
  ["Phenylalanine", "Phe", "F", "CH2-phenyl (benzene ring)"],
  ["Tyrosine", "Tyr", "Y", "CH2-phenyl-OH (OH opposite CH2: para)"],
  [
    "Tryptophan",
    "Trp",
    "W",
    "CH2-(1H-indol-3-yl): fused 5/6 rings, NH in 5-ring",
  ],
  ["Serine", "Ser", "S", "CH2-OH"],
  ["Threonine", "Thr", "T", "CH(OH)-CH3"],
  ["Cysteine", "Cys", "C", "CH2-SH"],
  ["Asparagine", "Asn", "N", "CH2-C(=O)-NH2"],
  ["Glutamine", "Gln", "Q", "CH2-CH2-C(=O)-NH2"],
  ["Aspartic acid", "Asp", "D", "CH2-C(=O)-OH"],
  ["Glutamic acid", "Glu", "E", "CH2-CH2-C(=O)-OH"],
  ["Lysine", "Lys", "K", "(CH2)4-NH2"],
  ["Arginine", "Arg", "R", "(CH2)3-NH-C(=NH)-NH2"],
  [
    "Histidine",
    "His",
    "H",
    "CH2-(1H-imidazol-4-yl): 5-ring, N at positions 1,3",
  ],
];

// User-supplied pKa chart, in AA order: carboxyl, amino, side chain.
const PKA = [
  [2.34,9.60,null],[2.34,9.69,null],[2.32,9.62,null],[2.36,9.60,null],
  [2.36,9.68,null],[2.28,9.21,null],[1.99,10.60,null],[1.83,9.13,null],
  [2.20,9.11,10.07],[2.38,9.39,null],[2.21,9.15,null],[2.63,9.10,null],
  [1.71,10.78,8.33],[2.02,8.84,null],[2.17,9.13,null],[2.09,9.82,3.86],
  [2.19,9.67,4.25],[2.18,8.95,10.79],[2.17,9.04,12.48],[1.82,9.17,6.04]
];
const GROUPS = [0,0,0,0,0,0,0,0,1,0,1,1,1,1,1,2,2,3,3,3];
const GROUP_NAMES = ['Non-polar','Polar','Acidic','Basic'];

// Neutral molecular graphs also supply editable references and protonation skeletons.
// Carbon vertices and carbon-bound hydrogens remain implicit.
function molecule(i) {
  const atoms = [], bonds = [], sites = [];
  const atom = (e,x,y) => (atoms.push({e,x,y}),atoms.length-1);
  const bond = (a,b,t='single') => bonds.push({a,b,t});
  const add = (a,e,x,y,t='single') => { const b=atom(e,x,y); bond(a,b,t); return b; };
  const n=atom(i===6?'NH':'NH2',230,480), alpha=atom('C',310,440);
  bond(n,alpha);
  const car=add(alpha,'C',390,480), ox=add(car,'O',390,550,'double');
  const oh=add(car,'OH',470,440);
  sites.push({atom:n,kind:'N',pka:PKA[i][1],base:i===6?'NH':'NH2',acid:i===6?'NH2+':'NH3+',charge:1});
  sites.push({atom:oh,kind:'C',pka:PKA[i][0],base:'O−',acid:'OH',charge:0});
  const rsite=(a,base,acid,charge=0)=>sites.push({atom:a,kind:'R',pka:PKA[i][2],base,acid,charge});
  const chain=(length)=> { let last=alpha; for(let j=0;j<length;j++) last=add(last,'C',310+(j%2?40:0),380-j*60); return last; };
  if(i===1) chain(1);
  if(i===2 || i===3) { const c=chain(i===2?1:2); add(c,'C',c===5?255:290,atoms[c].y-65); add(c,'C',395,atoms[c].y-60); }
  if(i===4) { const c=chain(1); add(c,'C',245,340); const d=add(c,'C',365,320); add(d,'C',365,250); }
  if(i===5) { const c=chain(2),s=add(c,'S',310,260); add(s,'C',350,200); }
  if(i===6) { const a=add(alpha,'C',315,365),b=add(a,'C',235,330),c=add(b,'C',180,405); bond(c,n); }
  if([7,8,9,19].includes(i)) {
    const c=chain(1), count=[7,8].includes(i)?6:5, ids=[];
    const points=count===6?[[310,315],[253,282],[253,216],[310,183],[367,216],[367,282]]:[[310,315],[253,273],[275,206],[345,206],[367,273]];
    points.forEach(([x,y],j)=>ids.push(atom(i===19?(j===2?'N':j===4?'NH':'C'):i===9&&j===2?'NH':'C',x,y)));
    bond(c,ids[0]);
    for(let j=0;j<count;j++) bond(ids[j],ids[(j+1)%count],(count===6?j%2===0:j===0||j===2)?'double':'single');
    if(i===8) rsite(add(ids[3],'OH',310,112),'O−','OH');
    if(i===19) rsite(ids[2],'N','NH+',1);
    if(i===9) {
      // Indole: pyrrole NH, fused benzene, alternating Kekule bonds.
      bonds.find(b=>b.a===ids[2]&&b.b===ids[3]).t='single';
      bonds.find(b=>b.a===ids[3]&&b.b===ids[4]).t='double';
      const extra=[[436,287],[483,237],[461,170],[392,156]].map(([x,y])=>atom('C',x,y));
      const ring=[ids[4],...extra,ids[3]];
      for(let j=0;j<ring.length-1;j++) bond(ring[j],ring[j+1],j===1||j===3?'double':'single');
    }
  }
  if([10,11,12].includes(i)) {
    const c=chain(1), e=i===12?'SH':'OH', o=add(c,e,255,315);
    if(i===11) add(c,'C',370,320);
    if(i===12) rsite(o,'S−','SH');
  }
  if([13,14,15,16].includes(i)) {
    const c=chain([13,15].includes(i)?1:2), a=add(c,'C',310,atoms[c].y-65);
    add(a,'O',250,atoms[a].y-35,'double');
    const o=add(a,i<15?'NH2':'OH',370,atoms[a].y-35);
    if(i>=15) rsite(o,'O−','OH');
  }
  if(i===17) rsite(add(chain(4),'NH2',310,140),'NH2','NH3+',1);
  if(i===18) {
    const a=add(chain(3),'NH',350,200),c=add(a,'C',310,140);
    rsite(add(c,'NH',250,105,'double'),'NH','NH2+',1);
    add(c,'NH2',370,105);
  }
  return {atoms,bonds,sites,alpha,n,car,ox,oh};
}

// Small rings are shared by rendering and aromatic graph matching.
function molecularRings(g) {
  const adj=g.atoms.map(()=>[]), rings=new Map();
  g.bonds.forEach(b=>{adj[b.a]?.push(b.b);adj[b.b]?.push(b.a);});
  for(let start=0;start<adj.length;start++) {
    const walk=path=>{
      const last=path.at(-1);
      if(path.length>=5&&adj[last].includes(start)) {
        const edges=path.map((a,j)=>[a,path[(j+1)%path.length]].sort((a,b)=>a-b).join(':'));
        rings.set(edges.slice().sort().join('|'),{atoms:path,edges});
      }
      if(path.length===6)return;
      for(const next of adj[last])if(next>start&&!path.includes(next))walk([...path,next]);
    };
    walk([start]);
  }
  return [...rings.values()];
}
function atomLabel(e) {
  return [...e].map(c=>/[0-9]/.test(c)?`<tspan baseline-shift="sub" font-size="70%">${c}</tspan>`:/[+−-]/.test(c)?`<tspan baseline-shift="super" font-size="70%">${c}</tspan>`:c).join('');
}
// One renderer for the sketcher, fallback references and protonation structures.
function moleculeMarkup(g) {
  const rings=molecularRings(g), color='#17241f';let out='';
  const line=(x,y,X,Y,w=3)=>`<line x1="${x}" y1="${y}" x2="${X}" y2="${Y}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  for(const b of g.bonds) {
    const a=g.atoms[b.a],c=g.atoms[b.b],length=Math.hypot(c.x-a.x,c.y-a.y)||1;
    const ux=(c.x-a.x)/length,uy=(c.y-a.y)/length,nx=-uy,ny=ux;
    const pad=e=>e==='C'?0:Math.min(length*.3,15+Math.abs(ux)*Math.max(0,e.length-1)*6);
    const pa=pad(a.e),pc=pad(c.e),x=a.x+ux*pa,y=a.y+uy*pa,X=c.x-ux*pc,Y=c.y-uy*pc;
    if(b.t==='wedge')out+=`<polygon points="${x},${y} ${X+nx*8},${Y+ny*8} ${X-nx*8},${Y-ny*8}" fill="${color}"/>`;
    else if(b.t==='dash')for(let t=.12;t<1;t+=.12)out+=line(x+(X-x)*t-nx*8*t,y+(Y-y)*t-ny*8*t,x+(X-x)*t+nx*8*t,y+(Y-y)*t+ny*8*t,2.5);
    else if(b.t==='double') {
      const ring=rings.find(r=>r.edges.includes([b.a,b.b].sort((a,b)=>a-b).join(':')));
      if(ring) {
        const cx=ring.atoms.reduce((s,i)=>s+g.atoms[i].x,0)/ring.atoms.length,cy=ring.atoms.reduce((s,i)=>s+g.atoms[i].y,0)/ring.atoms.length;
        const side=(cx-(a.x+c.x)/2)*nx+(cy-(a.y+c.y)/2)*ny>=0?1:-1,offset=side*9,trim=Math.min(14,length*.2);
        out+=line(x,y,X,Y)+line(x+ux*trim+nx*offset,y+uy*trim+ny*offset,X-ux*trim+nx*offset,Y-uy*trim+ny*offset,2.6);
      }else for(const o of [-4.5,4.5])out+=line(x+nx*o,y+ny*o,X+nx*o,Y+ny*o);
    }else for(const o of b.t==='triple'?[-8,0,8]:[0])out+=line(x+nx*o,y+ny*o,X+nx*o,Y+ny*o);
  }
  g.atoms.forEach((a,i)=>{
    const neighbors=g.bonds.filter(b=>b.a===i||b.b===i).map(b=>g.atoms[b.a===i?b.b:b.a]);
    const label=neighbors.length===1&&neighbors[0].x>a.x+15?a.e.replace(/^([NOS])H(\d*)([+−-]?)$/,'H$2$1$3'):a.e;
    if(a.e!=='C'||!neighbors.length)out+=`<text x="${a.x}" y="${a.y+8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" fill="${color}" paint-order="stroke" stroke="white" stroke-width="5" stroke-linejoin="round">${atomLabel(label)}</text>`;
  });
  return out;
}
function graphSVG(g) {
  const xs=g.atoms.map(a=>a.x),ys=g.atoms.map(a=>a.y),x=Math.min(...xs)-48,y=Math.min(...ys)-48;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${Math.max(...xs)-x+48} ${Math.max(...ys)-y+48}" role="img" aria-label="Molecular skeleton">${moleculeMarkup(g)}</svg>`;
}
// Coordinate-independent matching; valid fused Kekule forms and imidazole tautomers agree.
function graphMatch(own,target) {
  const normalize=e=>e.replace(/[₀-₉]/g,c=>String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c))).replace(/−/g,'-').replace(/⁺/g,'+').replace(/⁻/g,'-').replace(/\s/g,'').toUpperCase();
  function prepare(g) {
    const atoms=g.atoms.map(a=>normalize(a.e)),adj=atoms.map(()=>new Map());
    for(const b of g.bonds) {
      if(!adj[b.a]||!adj[b.b]||b.a===b.b||adj[b.a].has(b.b))return null;
      const order=b.t==='double'?2:b.t==='triple'?3:1;
      adj[b.a].set(b.b,order);adj[b.b].set(b.a,order);
    }
    // Merge rings sharing an edge, then validate conjugation across the entire system.
    const systems=[];
    for(const ring of molecularRings(g)) {
      if(!ring.atoms.every(i=>['C','N','NH'].includes(atoms[i])))continue;
      let edges=new Set(ring.edges),ids=new Set(ring.atoms);
      for(let i=systems.length-1;i>=0;i--)if([...edges].some(e=>systems[i].edges.has(e))) {
        systems[i].edges.forEach(e=>edges.add(e));systems[i].ids.forEach(a=>ids.add(a));systems.splice(i,1);
      }
      systems.push({edges,ids});
    }
    for(const {edges,ids} of systems) {
      const orders=i=>[...adj[i]].filter(([j])=>ids.has(j)).map(([,o])=>o);
      const valid=[...ids].every(i=>orders(i).every(o=>o===1||o===2)&&orders(i).filter(o=>o===2).length===(atoms[i]==='NH'?0:1)&&[...adj[i]].every(([j,o])=>ids.has(j)||o===1));
      const electrons=[...ids].reduce((s,i)=>s+(atoms[i]==='NH'?2:1),0);
      if(!valid||electrons%4!==2)continue;
      edges.forEach(k=>{const [a,b]=k.split(':').map(Number);adj[a].set(b,4);adj[b].set(a,4);});
      // Histidine's two neutral ring-N proton placements have the same identity.
      if(ids.size===5&&[...ids].filter(i=>atoms[i]==='N').length===1&&[...ids].filter(i=>atoms[i]==='NH').length===1)
        ids.forEach(i=>{if(atoms[i]==='N'||atoms[i]==='NH')atoms[i]='N_ar';});
    }
    return {atoms,adj};
  }
  if(own.atoms.length!==target.atoms.length||own.bonds.length!==target.bonds.length||own.atoms.length>40)return false;
  const a=prepare(own),b=prepare(target);if(!a||!b)return false;
  const signature=(g,i)=>g.atoms[i]+'|'+[...g.adj[i].values()].sort().join(',');
  const candidates=a.atoms.map((_,i)=>b.atoms.flatMap((_,j)=>signature(a,i)===signature(b,j)?[j]:[]));
  if(candidates.some(c=>!c.length))return false;
  const order=a.atoms.map((_,i)=>i).sort((i,j)=>candidates[i].length-candidates[j].length);
  const map=new Map(),used=new Set();let work=0;
  function search(depth) {
    if(++work>50000)return false;if(depth===order.length)return true;
    const i=order[depth];
    for(const j of candidates[i]) {
      if(used.has(j)||[...map].some(([x,y])=>a.adj[i].get(x)!==b.adj[j].get(y)))continue;
      map.set(i,j);used.add(j);if(search(depth+1))return true;map.delete(i);used.delete(j);
    }
    return false;
  }
  return search(0);
}

function peptide(sequence) {
  const g={atoms:[],bonds:[],sites:[]};
  sequence.forEach((aa,index)=> {
    const m=molecule(aa), map=new Map();
    m.atoms.forEach((a,j)=> {
      if(index<sequence.length-1&&j===m.oh)return;
      map.set(j,g.atoms.length);
      g.atoms.push({...a,x:a.x+index*260,e:j===m.n&&index>0?(aa===6?'N':'NH'):a.e});
    });
    m.bonds.forEach(b=> { if(map.has(b.a)&&map.has(b.b))g.bonds.push({...b,a:map.get(b.a),b:map.get(b.b)}); });
    m.sites.filter(s=>s.kind==='R'||s.kind==='N'&&index===0||s.kind==='C'&&index===sequence.length-1)
      .forEach(s=>g.sites.push({...s,atom:map.get(s.atom),aa,index}));
    if(index>0) g.bonds.push({a:g.previousCar,b:map.get(m.n),t:'single'});
    g.previousCar=map.get(m.car);
  });
  return g;
}
