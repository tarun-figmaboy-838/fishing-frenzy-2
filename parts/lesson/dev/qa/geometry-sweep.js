// Drags every movable corner through its full range and checks for label/side/board collisions.
// First: python3 dev/qa/make-debug.py   then: node dev/qa/geometry-sweep.js
const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1920,height:1080}});
  await ctx.addInitScript({path:'dev/qa/no-speech.js'}); const p=await ctx.newPage();
  await p.goto('http://localhost:8765/dev/qa/debug.html'); await p.waitForTimeout(1200);
  const audits=[];
  const audit=async(name)=>{ const r=await p.evaluate(()=>{
    const vis=e=>{ const cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden') return false; const r=e.getBoundingClientRect(); return r.width>0&&r.height>0; };
    const R=e=>{const r=e.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom};};
    const items=[];
    const add=(sel,kind)=>document.querySelectorAll(sel).forEach(e=>{ if(vis(e)) items.push({kind, txt:(e.textContent||'').trim().slice(0,18), ...R(e)}); });
    add('.tag:not(.off)','tag'); add('.chip','chip'); add('.opt','opt'); add('.lab','lab'); add('[data-qa="next"]','nav'); add('[data-qa="back"]','nav');
    const bub=document.querySelector('[data-qa="bubble"]').parentElement; items.push({kind:'bubble',txt:'',...R(bub)});
    const bird=document.querySelector('img.bird'); if(bird) items.push({kind:'bird',txt:'',...R(bird)});
    const out=[]; const ov=(a,b,m=2)=>a.l<b.r-m&&b.l<a.r-m&&a.t<b.b-m&&b.t<a.b-m;
    for(let i=0;i<items.length;i++) for(let j=i+1;j<items.length;j++){ const a=items[i],b=items[j];
      if((a.kind==='opt'&&b.kind==='opt')||(a.kind==='nav'&&b.kind==='nav')) continue;
      if(ov(a,b)) out.push(a.kind+':'+a.txt+' x '+b.kind+':'+b.txt); }
    // tags must clear the polygon's sides
    const svg=document.querySelector('svg[aria-label="Trapezium ABCD"]');
    if(svg && vis(svg)){ const sr=svg.getBoundingClientRect(), s=sr.width/520;
      const segs=[...svg.querySelectorAll('line.edge')].map(l=>['x1','y1','x2','y2'].map(k=>+l.getAttribute(k))).map(([a,b,c,d])=>[sr.left+a*s,sr.top+b*s,sr.left+c*s,sr.top+d*s]);
      items.filter(i=>i.kind==='tag').forEach(tg=>{ segs.forEach(([x1,y1,x2,y2])=>{ for(let k=0;k<=40;k++){ const x=x1+(x2-x1)*k/40,y=y1+(y2-y1)*k/40; if(x>tg.l+1&&x<tg.r-1&&y>tg.t+1&&y<tg.b-1){ out.push('tag over side: '+tg.txt); return; } } }); });
      // everything inside the board
    }
    const pn=[...document.querySelectorAll('img')].find(i=>/ice-panel/.test(i.src)); const pr=pn&&pn.getBoundingClientRect();
    if(pr) items.filter(i=>['tag','chip','opt','lab','hint'].includes(i.kind)).forEach(i=>{ const m=pr.width*0.012; if(i.l<pr.left+m||i.r>pr.right-m) out.push('off-board: '+i.kind+':'+i.txt); });
    const st=document.querySelector('.stage').getBoundingClientRect();
    items.forEach(i=>{ if(i.l<st.left-1||i.r>st.right+1||i.t<st.top-1||i.b>st.bottom+1) out.push('off-stage: '+i.kind+':'+i.txt); });
    // clipped text in bubble / chips / options
    document.querySelectorAll('[data-qa="bubble"], .chip, .opt, .lab, .tag:not(.off)').forEach(e=>{ if(vis(e) && (e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)) out.push('clipped: '+(e.textContent||'').trim().slice(0,20)); });
    return [...new Set(out)];
  }); if(r.length) audits.push(name+': '+r.join(' | ')); };

  const go=async(i,setup)=>{ await p.evaluate(([i,setup])=>{ __g.navAt=0; __g.goTo(i,true); if(setup) (new Function('g',setup))(__g); },[i,setup||'']); await p.waitForTimeout(80); };
  const setX=async(k,x)=>{ await p.evaluate(([k,x])=>{ const P=__g.clone(__g.state.P); P[k].x=x; __g.setState({P}); },[k,x]); await p.waitForTimeout(30); };
  // walk the lesson in order so geometry carries forward like a real play
  const order=[[2,"g.setState({ext:{DA:1,BC:1,AB:0,CD:0},done:true})"],[3,"g.setState({ext:{DA:0,BC:0,AB:1,CD:1},done:true})"],[7,"g.setState({tap:{AB:1,CD:1}})"],[8,"g.setState({tap:{DA:1,BC:1}})"],[9,"g.setState({tap:{DA:1,BC:1}})"],[10,""]];
  for(const [i,s] of order){ await go(i,s); await audit('step'+i); }
  // equal: sweep B across its whole range
  await go(11,""); let P=await p.evaluate(()=>__g.state.P);
  const lo=Math.max(P.A.x+90,P.C.x-243), hi=P.C.x;
  for(let x=lo;x<=hi;x+=12){ await setX('B',x); await audit('equal B='+Math.round(x)); }
  await setX('B',P.C.x-(P.A.x-P.D.x)); await go(12,""); await audit('iso');
  await go(13,"g.setState({ang:{A:1,B:1,C:1,D:1}})"); await audit('angles');
  await go(14,""); P=await p.evaluate(()=>__g.state.P);
  for(let x=Math.max(16,P.A.x-243);x<=Math.min(P.C.x-160,P.A.x+243);x+=12){ await setX('D',x); await audit('make90 D='+Math.round(x)); }
  await setX('D',P.A.x); await go(15,""); await audit('right'); await go(16,"g.setState({ang:{A:1,D:1},done:true})"); await audit('add');
  await go(17,""); P=await p.evaluate(()=>__g.state.P);
  for(let x=Math.max(16,P.A.x-243);x<=Math.min(P.C.x-160,P.A.x+243);x+=12){ await setX('D',x); await audit('change D='+Math.round(x)); }
  for(const dx of [16, P.A.x+200]){ await go(17,""); await setX('D',Math.min(dx,P.C.x-160)); await go(18,""); const Q=await p.evaluate(()=>__g.state.P);
    for(let x=Math.max(Q.D.x+160,Q.B.x-243);x<=Math.min(490,Q.B.x+243);x+=12){ await setX('C',x); await audit('otherleg D='+Math.round(Q.D.x)+' C='+Math.round(x)); }
    await go(19,""); await audit('rule D='+Math.round(Q.D.x)); await go(20,""); await audit('total D='+Math.round(Q.D.x)); }
  for(let i=21;i<=26;i++){ await go(i,""); await p.waitForTimeout(400); await audit('step'+i); }
  console.log(audits.length? audits.join('\n') : 'SWEEP CLEAN', '\nchecked');
  await b.close();
})();
