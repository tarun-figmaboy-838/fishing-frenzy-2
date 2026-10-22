// Headless logic test (no browser): node dev/qa/logic-test.js
const fs=require('fs');
const path=require('path'), rd=f=>fs.readFileSync(path.join(__dirname,'..','..',f),'utf8');
const html=rd('index.html');
// Motion (GSAP) is browser-only: here every tween jumps to its end and every pause is instant
const motionStub='const Motion=new Proxy({value(f,t,d,e,u,done){u(t);if(done)done();},wait(s,fn){fn();}},{get:(o,k)=>o[k]||(()=>{})});';
const js=motionStub+'\n'+rd('js/config.js')+'\n'+rd('js/lesson-data.js')+'\n'+rd('js/game-engine.js').replace('window.TrapeziumGame = class TrapeziumGame','const Component = class Component');
const tpl=html.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
class DCLogic{constructor(p){this.props=p||{}} setState(u,cb){const v=typeof u==='function'?u(this.state):u; this.state=Object.assign({},this.state,v); if(cb) cb();} }
const Component=new Function('DCLogic','StreamableLogic','React','window', js+'; return Component;')(DCLogic,DCLogic,{},{});
// speed up timers
const c=new Component({});
const realTm=c.tm.bind(c);
c.tm=function(fn,ms){return realTm(fn,Math.max(0,ms/40));};
const holes=[...tpl.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map(m=>m[1]).filter(h=>!/^(true|false)$/.test(h));
const loops={mi:'menuItems',bk:'blanks',tl:'tiles',th:'thumbs',tg:'tags',o:'opts',sl:'slots',lb:'labs',st:'stars',cp:'chips',wd:'words'};
const get=(o,p)=>p.split('.').reduce((a,k)=>a==null?undefined:a[k],o);
const errs=[];
function check(label){
  let v; try{ v=c.renderVals(); }catch(e){ errs.push(label+': renderVals threw '+e.stack); return; }
  for(const h of holes){
    const root=h.split('.')[0];
    if(loops[root]){ const L=v[loops[root]]; if(!Array.isArray(L)){errs.push(label+': list '+loops[root]+' not array'); continue;} for(const it of L){ if(get({[root]:it},h)===undefined) errs.push(label+': undefined '+h);} continue; }
    if(root==='g' && !v.isLesson) continue;
    if(root==='c1' && !v.isCfu1) continue;
    if(get(v,h)===undefined) errs.push(label+': undefined '+h);
  }
  return v;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// focus screens: the shape can only be tapped once it has reached centre stage
const focusWait=async()=>{ for(let k=0;k<100&&c.cur().layout==='focus'&&!c.state.centered;k++) await sleep(20); if(c.cur().layout==='focus'&&!c.state.centered) errs.push(c.cur().id+': shape never reached centre'); };
(async()=>{
  check('prestart');
  // during the walk, record 'move on' requests instead of acting on them, so each step can be checked in place
  const realAdvance=c.maybeAdvance; let advCalls=0;
  c.maybeAdvance=function(){ if(this.state.done) advCalls++; };
  c.start();
  const steps=c.steps();
  for(let i=0;i<steps.length;i++){
    const st=steps[i];
    // finished screens move on by themselves: make sure we are testing step i
    if(c.state.step!==i){ c.navAt=0; c.goTo(i,true); }
    advCalls=0;
    await sleep(30);
    let v=check(st.id+':enter');
    if(c.state.listen && st.opts){ c.pick(st.opts.find(o=>o.ok)); if(c.state.done||Object.keys(c.state.picks).length) errs.push(st.id+': answer accepted during the instructions'); }
    for(let k=0;k<200&&c.state.listen;k++) await sleep(10);
    if(c.state.listen) errs.push(st.id+': instructions never unlocked the activity');
    const before=c.state.done;
    const P=c.state.P;
    switch(st.task){
      case 'extLegs': await focusWait(); c.tapEdge('AB'); await focusWait(); c.tapEdge('DA'); c.tapEdge('BC'); await sleep(1200); break;
      case 'extBases': { const early=c.state.centered; c.tapEdge('AB'); if(!early && c.state.ext.AB>0) errs.push('other: tap accepted before the shape reached centre'); await focusWait(); c.tapEdge('AB'); c.tapEdge('CD'); await sleep(1200); break; }
      case 'tapBases': c.tapEdge('DA'); c.tapEdge('AB'); c.tapEdge('CD'); await sleep(400); break;
      case 'tapLegs': c.tapEdge('DA'); c.tapEdge('BC'); await sleep(400); break;
      case 'measure': for (const k of ['AB','BC','CD','DA']) { c.tapEdge(k); await sleep(120); } await sleep(4500); break;
      case 'tapAngles': ['A','B','C','D'].forEach(k=>c.tapVertex(k)); await sleep(400); break;
      case 'tapAD': c.tapVertex('B'); c.tapVertex('A'); c.tapVertex('D'); await sleep(400); break;
      case 'dragFree': { if(c.isPg(P)){ // a real drag through move(): the parallelogram must stay one
        const ts=c.toSvg; c.toSvg=(svg,e)=>({x:e.x,y:0}); c.down('B',{currentTarget:{ownerSVGElement:{}}}); c.move({x:P.B.x+(P.A.x>120?-80:80)}); c.up(); c.toSvg=ts;
        if(!c.isPg(c.state.P)) errs.push(st.id+': drag broke the parallelogram'); if(Math.abs(c.dist(c.state.P.A,c.state.P.B)-c.dist(c.state.P.D,c.state.P.C))>0.5) errs.push(st.id+': AB != CD after drag'); }
      else { const Q=c.clone(P); Q.B.x=Q.B.x-40; c.setState({P:Q,moved:true}); c.checkDrag('B'); } await sleep(600); break; }
      case 'drag90': { const Q=c.clone(P); Q.A.x=Q.D.x+3; c.setState({P:Q,moved:true}); c.checkDrag('A'); await sleep(600); if(Math.abs(c.angle(c.state.P,'A')-90)>0.5) errs.push('drag90: no snap to 90'); break; }
      case 'dragAny': { const Q=c.clone(P); Q.B.x=Q.B.x+2; c.setState({P:Q,moved:true}); c.checkDrag('B'); if(c.state.done) errs.push('dragAny: done while legs still equal'); const R=c.clone(c.state.P); R.B.x=R.B.x-100; c.setState({P:R,moved:true}); c.checkDrag('B'); await sleep(600); break; }
      case 'dragB': { const Q=c.clone(P); Q.B.x=Q.C.x+(Q.A.x-Q.D.x)-6; c.setState({P:Q,moved:true}); c.checkDrag('B'); if(!c.isPg(c.state.P)) errs.push('dragB: no snap to a parallelogram'); break; }
      case 'tapEq': c.tapVertex(st.ref); c.tapVertex(['A','B','C','D'].find(k=>k!==st.ref&&k!==st.want)); if(c.state.done) errs.push(st.id+': done after a wrong tap'); c.tapVertex(st.want); await sleep(400); break;
      case 'connect': c.connTo('A','B'); if(c.state.diag.AC||c.state.diag.BD) errs.push('connect: a side was accepted as a diagonal');
        c.connTo('A','C'); c.connTo('D','B'); await sleep(300); if(!(c.state.diag.AC&&c.state.diag.BD)) errs.push('connect: diagonals not drawn'); break;
      case 'diags': await sleep(400); if(!(c.state.diag.AC&&c.state.diag.BD)) errs.push('diags: not both drawn'); break;
      case 'dragA': { const Q=c.clone(P); Q.A.x=Q.D.x+(Q.C.x-Q.B.x)+5; c.setState({P:Q,moved:true}); c.checkDrag('A'); break; }
      case 'dragD90': { const Q=c.clone(P); Q.D.x=Q.A.x+3; c.setState({P:Q,moved:true}); c.checkDrag('D'); break; }
      case 'dragD': { const Q=c.clone(P); Q.D.x=Q.A.x-60; c.setState({P:Q,moved:true}); c.checkDrag('D'); break; }
      case 'dragC': { const Q=c.clone(P); Q.C.x=Q.C.x-40; c.setState({P:Q,moved:true}); c.checkDrag('C'); break; }
    }
    if(st.opts){ const bad=st.opts.find(o=>!o.ok); c.pick(bad); check(st.id+':bad'); if(c.state.done) errs.push(st.id+': done after a wrong answer');
      if(st.multi){ const need=st.opts.filter(o=>o.ok&&o.req!==false); need.slice(0,-1).forEach(o=>c.pick(o)); if(need.length>1&&c.state.done) errs.push(st.id+': done before every answer was found'); c.pick(need[need.length-1]); }
      else c.pick(st.opts.find(o=>o.ok)); await sleep(50); }
    if(st.fill){ const D=st.fill;
      // a wrong attempt first: every blank gets a wrong tile (match: wrong pairs)
      const wrong=D.match? ['OA','OB','OC','OD'] : D.blanks.map(b=>D.tiles.find(t=>t!==b.ans));
      D.blanks.forEach((b,j)=>c.fillBlank(b.id, wrong[j])); await sleep(60);
      if(c.state.done) errs.push(st.id+': done after a wrong fill'); check(st.id+':fill-bad');
      for(let k=0;k<100&&c.state.fill.checking;k++) await sleep(10);
      if(Object.keys(c.state.fill.at).length) errs.push(st.id+': wrong tiles not cleared');
      const right=D.match? ['OC','OA','OD','OB'] : D.blanks.map(b=>b.ans);
      D.blanks.forEach((b,j)=>c.fillBlank(b.id, right[j])); await sleep(60);
      if(!c.state.done) errs.push(st.id+': right answers not accepted'); }
    if(st.cfu===4){ c.place('iso','s0',c.state.c4); c.place('scal','s1',c.state.c4); c.place('right','s2',c.state.c4); await sleep(100); check('cfu4-wrong'); 
      const c4=c.state.c4; console.log('  after wrong check locked', JSON.stringify(c4.locked), JSON.stringify(c4.at));
      c.place('right','s1',c.state.c4); c.place('scal','s2',c.state.c4); await sleep(100); }
    if(st.lenSeq||(st.f&&st.f.supp)) await sleep(400); // let a timed sequence run (40x speed)
    v=check(st.id+':after');
    const V=c.vals(c.state.P);
    const lens=[c.dist(c.state.P.A,c.state.P.B)/c.S, c.dist(c.state.P.A,c.state.P.D)/c.S].map(x=>x.toFixed(2));
    // the storyboard's numbers come out of the real geometry: AB = CD = 6 cm, AD = BC = 3 cm, 110° / 70°
    if(st.id==='interesting'){ const t=v.tags.filter(x=>/cm/.test(x.t)&&!/off/.test(x.cls)).map(x=>x.t).sort().join(','); if(t!=='3 cm,3 cm,6 cm,6 cm') errs.push('interesting: lengths '+t); }
    if(st.id==='interestingAng'&&JSON.stringify(V)!=='{"A":110,"D":70,"B":70,"C":110}') errs.push('angles '+JSON.stringify(V));
    console.log(String(i).padStart(2), st.id.padEnd(9), 'done', c.state.done, '| chips', JSON.stringify(v.chips.map(x=>x.t)), '| hint', v.hintText||'-', '| ang', JSON.stringify(V), '| legs', lens.join('/'), '| tags', v.tags.filter(t=>t.cls!=='vlab').map(t=>t.t).join(','));
    if(!c.state.done) errs.push(st.id+': task not done');
    if(st.task||st.cfu||st.opts||st.fill){ await sleep(300); if(!advCalls) errs.push(st.id+': finished but never moves on'); }
    // advance
    c.navAt=0; if(i<steps.length-1){ if(st.task==='dragA'||st.task==='dragB'||st.task==='dragD90'){ c.goTo(i+1,true);} else c.next(); }
  }
  console.log('score', c.renderVals().scoreText, c.renderVals().progressLabel);
  // a narration screen moves on by itself once its line has finished
  c.maybeAdvance=realAdvance;
  { const k=steps.findIndex(x=>x.id==='quadSides'); c.navAt=0; c.goTo(k,true); await sleep(1500); if(c.state.step<=k) errs.push('quadSides: no auto-advance after narration (step '+c.state.step+')'); else console.log('auto-advance after narration: ok'); }
  // Next is hidden everywhere
  if(c.renderVals().nextCls!=='auto') errs.push('Next button is visible');
  // speech conversions
  ['So AB ∥ CD.','In this parallelogram, AO = 6 cm. What is the length of OC?','AC and BD are the diagonals of this parallelogram.','∠B & ∠C','∠A + ∠D = 180°'].forEach(t=>console.log('SPEECH:',c.speechOf(t)));
  console.log(errs.length? 'ERRORS:\n'+[...new Set(errs)].join('\n') : 'NO ERRORS');
  process.exit(0);
})();
