// Headless logic test (no browser): node qa/logic-test.js
const fs=require('fs');
const path=require('path'), rd=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const html=rd('index.html');
const js=rd('js/config.js')+'\n'+rd('js/lesson-data.js')+'\n'+rd('js/game-engine.js').replace('window.TrapeziumGame = class TrapeziumGame','const Component = class Component');
const tpl=html.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
class DCLogic{constructor(p){this.props=p||{}} setState(u){const v=typeof u==='function'?u(this.state):u; this.state=Object.assign({},this.state,v);} }
const Component=new Function('DCLogic','StreamableLogic','React','window', js+'; return Component;')(DCLogic,DCLogic,{},{});
// speed up timers
const c=new Component({});
const realTm=c.tm.bind(c);
c.tm=function(fn,ms){return realTm(fn,Math.max(0,ms/40));};
const holes=[...tpl.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map(m=>m[1]).filter(h=>!/^(true|false)$/.test(h));
const loops={th:'thumbs',tg:'tags',o:'opts',sl:'slots',lb:'labs',st:'stars',cp:'chips',wd:'words'};
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
      case 'dragFree': { const Q=c.clone(P); Q.B.x=Q.B.x-40; c.setState({P:Q,moved:true}); c.checkDrag('B'); await sleep(600); break; }
      case 'drag90': { const Q=c.clone(P); Q.A.x=Q.D.x+3; c.setState({P:Q,moved:true}); c.checkDrag('A'); await sleep(600); if(Math.abs(c.angle(c.state.P,'A')-90)>0.5) errs.push('drag90: no snap to 90'); break; }
      case 'dragAny': { const Q=c.clone(P); Q.B.x=Q.B.x+2; c.setState({P:Q,moved:true}); c.checkDrag('B'); if(c.state.done) errs.push('dragAny: done while legs still equal'); const R=c.clone(c.state.P); R.B.x=R.B.x-100; c.setState({P:R,moved:true}); c.checkDrag('B'); await sleep(600); break; }
      case 'dragA': { const Q=c.clone(P); Q.A.x=Q.D.x+(Q.C.x-Q.B.x)+5; c.setState({P:Q,moved:true}); c.checkDrag('A'); break; }
      case 'dragD90': { const Q=c.clone(P); Q.D.x=Q.A.x+3; c.setState({P:Q,moved:true}); c.checkDrag('D'); break; }
      case 'dragD': { const Q=c.clone(P); Q.D.x=Q.A.x-60; c.setState({P:Q,moved:true}); c.checkDrag('D'); break; }
      case 'dragC': { const Q=c.clone(P); Q.C.x=Q.C.x-40; c.setState({P:Q,moved:true}); c.checkDrag('C'); break; }
    }
    if((st.cfu||st.practice) && st.opts){ const bad=st.opts.find(o=>!o.ok); c.pick(bad); check(st.id+':bad'); c.pick(st.opts.find(o=>o.ok)); }
    if(st.cfu===4){ c.place('iso','s0',c.state.c4); c.place('scal','s1',c.state.c4); c.place('right','s2',c.state.c4); await sleep(100); check('cfu4-wrong'); 
      const c4=c.state.c4; console.log('  after wrong check locked', JSON.stringify(c4.locked), JSON.stringify(c4.at));
      c.place('scal','s0',c.state.c4); c.place('iso','s1',c.state.c4); await sleep(100); }
    v=check(st.id+':after');
    const V=c.vals(c.state.P);
    const lens=[c.dist(c.state.P.A,c.state.P.D)/40, c.dist(c.state.P.B,c.state.P.C)/40].map(x=>x.toFixed(2));
    console.log(String(i).padStart(2), st.id.padEnd(9), 'done', c.state.done, '| chips', JSON.stringify(v.chips.map(x=>x.t)), '| hint', v.hintText||'-', '| ang', JSON.stringify(V), '| legs', lens.join('/'), '| tags', v.tags.filter(t=>t.cls!=='vlab').map(t=>t.t).join(','));
    if(!c.state.done) errs.push(st.id+': task not done');
    if(st.task||st.cfu||st.opts){ await sleep(300); if(!advCalls) errs.push(st.id+': finished but never moves on'); }
    // advance
    c.navAt=0; if(i<steps.length-1){ if(st.task==='dragA'||st.task==='dragD90'){ c.goTo(i+1,true);} else c.next(); }
  }
  console.log('score', c.renderVals().scoreText, c.renderVals().progressLabel);
  // a narration screen moves on by itself once its line has finished
  c.maybeAdvance=realAdvance;
  { const k=steps.findIndex(x=>x.id==='parallel'); c.navAt=0; c.goTo(k,true); await sleep(250); if(c.state.step<=k) errs.push('parallel: no auto-advance after narration (step '+c.state.step+')'); else console.log('auto-advance after narration: ok'); }
  // Next is hidden everywhere
  if(c.renderVals().nextCls!=='auto') errs.push('Next button is visible');
  // speech conversions
  ['So, AB is parallel to CD.','Can you make ∠A exactly 90°?','In an isosceles trapezium, AB = 6 cm, CD = 10 cm and AD = 5 cm. What is the length of BC?','∠A + ∠D = 180°'].forEach(t=>console.log('SPEECH:',c.speechOf(t)));
  console.log(errs.length? 'ERRORS:\n'+[...new Set(errs)].join('\n') : 'NO ERRORS');
  process.exit(0);
})();
