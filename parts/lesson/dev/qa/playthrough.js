// Full playthrough: node dev/qa/playthrough.js <mouse|touch> <fake|none|native> <WxH>   (run from the package root with a server on :8765)
const { chromium } = require('playwright');
const fs=require('fs'); fs.mkdirSync('qa-shots',{recursive:true});
const MODE=process.argv[2]||'mouse';
const results=[]; const ok=(c,m)=>{results.push((c?'PASS ':'FAIL ')+m); if(!c) console.log('FAIL',m);};
(async()=>{
  const b=await chromium.launch();
  const VP=(process.argv[4]||'1920x1080').split('x').map(Number);
  const ctx=await b.newContext({viewport:{width:VP[0],height:VP[1]}, hasTouch: MODE==='touch'});
  const SPEECH=process.argv[3]||'fake';
  await ctx.addInitScript({path: SPEECH==='none'?'dev/qa/no-speech.js':SPEECH==='native'?'dev/qa/native-speech.js':'dev/qa/fake-speech.js'});
  const okS=(c,m)=>{ if(SPEECH==='fake') ok(c,m); };
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if((m.type()==='error'||m.type()==='warning') && !/ERR_TUNNEL_CONNECTION_FAILED/.test(m.text())) errs.push(m.type()+': '+m.text()); });
  p.on('requestfailed',r=>{ if(!/fonts\.googleapis/.test(r.url())) errs.push('request failed: '+r.url()); });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(1500);
  const Q=s=>`[data-qa="${s}"]`;
  const box=async s=>{const bb=await p.locator(Q(s)).first().boundingBox(); return bb?{x:bb.x+bb.width/2,y:bb.y+bb.height/2}:null;};
  const cdp = MODE==='touch'? await ctx.newCDPSession(p):null;
  const tap=async s=>{const c=await box(s); if(!c) throw new Error('no el '+s); if(MODE==='touch') await p.touchscreen.tap(c.x,c.y); else await p.mouse.click(c.x,c.y);};
  const tapXY=async (x,y)=>{ if(MODE==='touch') await p.touchscreen.tap(x,y); else await p.mouse.click(x,y); };
  async function dragXY(x0,y0,x1,y1,steps=14){
    if(MODE==='touch'){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y:y0}]});
      for(let i=1;i<=steps;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*i/steps,y:y0+(y1-y0)*i/steps}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    } else { await p.mouse.move(x0,y0); await p.mouse.down(); await p.mouse.move(x1,y1,{steps}); await p.mouse.up(); }
    await p.waitForTimeout(120);
  }
  const svgOrigin=async()=>p.evaluate(()=>{const s=document.querySelector('svg[aria-label="Trapezium ABCD"]'); const r=s.getBoundingClientRect(); return {x:r.left,y:r.top,s:r.width/520};});
  let o; const X=v=>o.x+v*o.s, Y=v=>o.y+v*o.s;
  const V=async()=>p.evaluate(()=>{const o={}; for(const k of 'ABCD'){const c=document.querySelector(`[data-qa="vtx-${k}"]`); o[k]={x:+c.getAttribute('cx'),y:+c.getAttribute('cy')};} return o;});
  const label=async()=>p.locator('.stage span:has-text("/"), .stage span:has-text("Done")').first().innerText().catch(()=>'?');
  const bubble=async()=>p.evaluate(()=>[...document.querySelectorAll('[data-qa="bubble"] .w')].map(w=>w.textContent).join(' '));
  const shown=async()=>p.evaluate(()=>[...document.querySelectorAll('[data-qa="bubble"] .w')].filter(w=>/\b(on|cur)\b/.test(w.className)).length);
  const chips=async()=>p.evaluate(()=>[...document.querySelectorAll('.chip')].map(c=>c.textContent));
  const tags=async()=>p.evaluate(()=>[...document.querySelectorAll('.tag:not(.vlab):not(.off)')].map(c=>c.textContent));
  const nextEnabled=async()=>p.locator(Q('next')).isEnabled();
  const waitNext=async(ms=12000)=>{const t0=Date.now(); while(Date.now()-t0<ms){ if(await nextEnabled()) return true; await p.waitForTimeout(100);} return false;};
  const waitTalk=async(ms=15000)=>{const t0=Date.now(); while(Date.now()-t0<ms){ const talking=await p.evaluate(()=>!!document.querySelector('[data-qa="bubble"] .w.cur')); const sp=await p.evaluate(()=>!!(window.speechSynthesis&&speechSynthesis.speaking)); if(!talking&&!sp) return; await p.waitForTimeout(100);} };

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
  let n=0; const shot=async(name)=>{ await audit(name); await p.screenshot({path:`qa-shots/${MODE}-${VP[0]}-${String(n++).padStart(2,'0')}-${name}.png`}); };
  const waitChip=async(txt,ms=7000)=>{const t0=Date.now(); while(Date.now()-t0<ms){ if((await chips()).includes(txt)) return true; await p.waitForTimeout(100);} return false;};
  const waitLabel=async(pre,ms=5000)=>{const t0=Date.now(); while(Date.now()-t0<ms){ if((await label()).startsWith(pre)) return true; await p.waitForTimeout(100);} return false;};
  const next=async()=>{ await p.waitForTimeout(500); await tap('next'); await p.waitForTimeout(250); };

  // ---- lesson starts on load (no Start screen) ----
  await shot('start');
  ok((await label()).startsWith('Step 1 '), 'loads straight into step 1: '+await label());
  // word-by-word timing vs fake voice boundaries
  const samples=[]; for(let i=0;i<14;i++){ samples.push([await shown(), await p.evaluate(()=>__speech.log.filter(l=>l.text.includes('quadrilateral')).length)]); await p.waitForTimeout(150);} 
  okS(samples.every(([w,bd])=>w<=bd+1), 'words never run >1 ahead of voice: '+JSON.stringify(samples));
  ok(samples[samples.length-1][0]>=5, 'words progress during VO');
  await waitTalk(); ok((await shown())===(await bubble()).split(' ').length, 'all words shown after VO');
  await shot('intro');
  // double-click Next on a no-task step must advance one step only
  await p.waitForTimeout(500);
  if(MODE==='mouse'){ const c=await box('next'); await p.mouse.dblclick(c.x,c.y);} else { await tap('next'); await tap('next'); }
  await p.waitForTimeout(300);
  ok((await label()).startsWith('Step 2 '), 'double Next advances once: '+await label());
  // VO interruption: Next mid-line
  const cancelsBefore=await p.evaluate(()=>__speech.cancels);
  await p.waitForTimeout(500); await tap('next'); await p.waitForTimeout(400);
  ok((await bubble()).startsWith("Let's extend"), 'new line replaces old after interrupt: '+await bubble());
  okS((await p.evaluate(()=>__speech.cancels))>cancelsBefore, 'speech cancelled on step change');
  await p.waitForTimeout(1200);
  ok(!(await bubble()).includes('look like they will meet'), 'old line never comes back');
  // ---- step 3 extend legs ----
  ok(!(await nextEnabled()), 'Next locked until task done');
  await tap('edge-AB'); await p.waitForTimeout(300);
  ok((await bubble()).startsWith('Try a slanted side'), 'wrong tap: Swiftee explains in the bubble');
  await tap('edge-DA'); await tap('edge-DA'); await tap('edge-BC'); await p.waitForTimeout(1300);
  ok((await bubble()).startsWith('Woah! The sides meet.'), 'legs meet line');
  ok(await nextEnabled(), 'Next unlocked after extend');
  await shot('extended');
  await next();
  // ---- step 4 extend bases ----
  await tap('edge-AB'); await tap('edge-CD'); await p.waitForTimeout(1300);
  ok(await nextEnabled(), 'bases extended');
  await shot('bases-ext');
  // tap during animation then next quickly: no stale anim
  await next(); await shot('parallel'); await next(); ok((await chips()).includes('AB ∥ CD'),'AB ∥ CD chip'); await shot('abcd');
  await next(); ok((await chips()).includes('Trapezium'),'Trapezium chip');
  await next(); // bases
  await p.waitForTimeout(1500); await shot('bases'); // explanation only (Base callout), no tapping
  await next(); // legs
  await p.waitForTimeout(1500); await shot('legs'); // explanation only (Legs callout), no tapping
  await next(); // measure with ruler
  o=await svgOrigin(); let v=await V();
  const rb=await p.locator(Q('ruler')).boundingBox();
  const mid={x:X((v.A.x+v.D.x)/2), y:Y((v.A.y+v.D.y)/2)};
  await dragXY(rb.x+rb.width/2, rb.y+rb.height/2, mid.x-20*o.s, mid.y);
  await p.waitForTimeout(800); await shot('ruler-on-AD');
  ok((await tags()).some(t=>t.startsWith('AD = 5')), 'ruler drag measures AD: '+await tags());
  await tap('edge-BC'); await p.waitForTimeout(1500);
  ok((await tags()).some(t=>t.startsWith('BC = 7')) && await nextEnabled(), 'tap leg measures BC: '+await tags());
  await shot('measured');
  await next(); ok(await waitChip('Scalene trapezium'),'scalene chip after 2nd line'); await shot('scalene');
  await next(); // equal: drag B
  v=await V();
  await dragXY(X(v.B.x),Y(v.B.y), X(v.A.x-150), Y(v.B.y)); v=await V();
  ok(v.B.x>=v.A.x+49.5, 'B cannot pass A (no self-intersection): B='+v.B.x+' A='+v.A.x);
  ok(!(await nextEnabled()), 'not equal yet → locked');
  await dragXY(X(v.B.x),Y(v.B.y), X(800), Y(v.B.y)); v=await V(); ok(v.B.x<=505.1,'B clamped right');
  ok(Math.abs(v.B.y-v.A.y)<0.01,'B stays on base line (parallel)');
  const target=v.C.x-(v.A.x-v.D.x);
  await dragXY(X(v.B.x),Y(v.B.y), X(target+6), Y(v.B.y)); await p.waitForTimeout(200); v=await V();
  ok(Math.abs((v.C.x-v.B.x)-(v.A.x-v.D.x))<0.2, 'B snaps to equal legs');
  await p.waitForTimeout(300); ok((await bubble()).startsWith('Perfect'), 'success line replaces stale feedback: '+await bubble());
  await shot('equal-snap');
  ok(await waitLabel('Step 13 '), 'auto-advance to isosceles: '+await label());
  ok(await waitChip('Isosceles trapezium'),'isosceles chip'); await shot('iso');
  // Back restores scalene geometry, then forward again
  await p.waitForTimeout(500); await tap('back'); await p.waitForTimeout(300); v=await V();
  ok((await label()).startsWith('Step 12 ') && Math.abs(Math.hypot(v.C.x-v.B.x,v.C.y-v.B.y)/40-7)<0.05, 'Back restores scalene shape');
  await dragXY(X(v.B.x),Y(v.B.y), X(target), Y(v.B.y));
  ok(await waitLabel('Step 13 '),'re-solve equal works');
  await next(); // angles
  for(const k of 'ABCD'){ await tap('vtx-'+k); }
  await p.waitForTimeout(500); ok((await tags()).filter(t=>t.endsWith('°')).length===4 && await nextEnabled(), 'angles measured: '+await tags()); await shot('angles');
  await next(); // make90
  v=await V();
  await dragXY(X(v.D.x),Y(v.D.y), X(v.A.x+40), Y(v.D.y)); await p.waitForTimeout(200);
  ok(!(await nextEnabled()),'off-90 not accepted: '+await tags());
  v=await V(); await dragXY(X(v.D.x),Y(v.D.y), X(v.A.x+2), Y(v.D.y)); await p.waitForTimeout(150); v=await V();
  ok(Math.abs(v.D.x-v.A.x)<0.01 && (await tags()).includes('90°'), 'D snaps to 90°'); await shot('right90');
  ok(await waitLabel('Step 16 '),'auto-advance to right trapezium');
  ok(await waitChip('Right trapezium'),'right chip'); await shot('right');
  await next(); // add
  await tap('vtx-B'); await p.waitForTimeout(150); ok((await bubble()).startsWith('Tap the angles at A and D'),'wrong corner: Swiftee explains in the bubble');
  await tap('vtx-A'); await tap('vtx-D'); await p.waitForTimeout(500);
  ok((await chips()).includes('90° + 90° = 180°'),'sum chip'); await shot('add');
  await next(); // change D
  v=await V(); await dragXY(X(v.D.x),Y(v.D.y), X(v.D.x-70), Y(v.D.y)); await p.waitForTimeout(200);
  const ch=(await chips())[0]; const m=ch.match(/(\d+)° \+ (\d+)° = 180°/); ok(m && (+m[1])+(+m[2])===180, 'live sum AD: '+ch);
  ok(await nextEnabled(),'change done'); await dragXY(X(v.D.x-70),Y(v.D.y), X(900), Y(v.D.y)); v=await V(); ok(v.D.x<=v.C.x-79.9,'D cannot cross C');
  await dragXY(X(v.D.x),Y(v.D.y), X(v.D.x-120), Y(v.D.y)); await shot('change');
  await next(); // other leg C
  v=await V(); await dragXY(X(v.C.x),Y(v.C.y), X(v.C.x-50), Y(v.C.y)); await p.waitForTimeout(200);
  const ch2=(await chips())[0]; const m2=ch2.match(/(\d+)° \+ (\d+)° = 180°/); ok(m2 && (+m2[1])+(+m2[2])===180 && await nextEnabled(), 'live sum BC: '+ch2);
  v=await V(); await dragXY(X(v.C.x),Y(v.C.y), o.x-300, Y(v.C.y)); v=await V(); ok(v.C.x>=v.D.x+79.9,'C cannot cross D'); await dragXY(X(v.C.x),Y(v.C.y), X(v.C.x+90), Y(v.C.y));
  await shot('otherleg');
  await next(); const ang=(await tags()).map(t=>parseInt(t)); ok(ang.length===4 && ang.reduce((a,b)=>a+b,0)===360, 'rule angles sum 360: '+ang); await shot('rule');
  await next(); ok((await chips()).length===2,'total chips'); await shot('total');
  // ---- CFUs ----
  await next(); ok((await label()).startsWith('Check 1'),'cfu1');
  await tap('opt-B'); await p.waitForTimeout(150);
  ok(await p.locator(Q('opt-B')).isDisabled() && (await p.getAttribute(Q('opt-B'),'class')).includes('bad'), 'wrong answer disabled+red');
  ok(!(await nextEnabled()),'next locked after wrong');
  await tap('opt-B'); await tap('opt-A'); await p.waitForTimeout(150);
  ok((await chips()).includes('Correct!') && await p.locator(Q('opt-D')).isDisabled(), 'correct locks all'); await shot('cfu1');
  await next(); await tap('opt-i'); await p.waitForTimeout(200); ok(await nextEnabled(),'cfu2 correct first try'); await shot('cfu2');
  await next(); await tap('opt-a'); await tap('opt-c'); await tap('opt-b'); await p.waitForTimeout(200); ok(await nextEnabled(),'cfu3 after 2 wrong'); await shot('cfu3');
  await next(); // cfu4
  const lab=async id=>box('lab-'+id), slot=async id=>box('slot-'+id);
  let a=await lab('iso'), z=await slot('s0'); await dragXY(a.x,a.y,z.x,z.y);
  a=await lab('scal'); z=await slot('s1'); await dragXY(a.x,a.y,z.x,z.y);
  // drag a placed label out → returns to tray
  a=await lab('scal'); await dragXY(a.x,a.y,VP[0]*0.55,VP[1]*0.88); let a2=await lab('scal'), rt=await lab('right'); ok(Math.abs(a2.y-rt.y)<3,'label dropped outside goes home');
  a=await lab('scal'); z=await slot('s1'); await dragXY(a.x,a.y,z.x,z.y);
  // tap-select mode for the last one
  await tap('lab-right'); await tap('slot-s2'); await p.waitForTimeout(700);
  ok((await p.getAttribute(Q('lab-right'),'class')).includes('lock') && !(await nextEnabled()), 'partial correct locks right only');
  await shot('cfu4-wrong');
  a=await lab('scal'); z=await slot('s0'); await dragXY(a.x,a.y,z.x,z.y);
  await tap('lab-iso'); await tap('slot-s1'); await p.waitForTimeout(700);
  ok(await nextEnabled(),'cfu4 solved'); await shot('cfu4');
  await next(); await tap('opt-b'); await p.waitForTimeout(200); ok(await nextEnabled(),'cfu5'); await shot('cfu5');
  await next(); await p.waitForTimeout(400);
  const sc=await p.locator('text=/checks right/').innerText(); ok(/You got 2 of 5/.test(sc),'score counts first-try only: '+sc);
  await shot('end');
  // restart
  await p.locator('text=Play again').click(); await p.waitForTimeout(300); ok((await label()).startsWith('Step 1 '),'play again restarts');
  // idle hint
  await next(); await next(); // extend step
  await waitTalk(); const before=await bubble(); await p.waitForTimeout(9800);
  ok((await bubble())!==before, 'idle hint after 9s: '+await bubble());
  ok(errs.length===0,'no page errors: '+errs.join(' | '));
  console.log('AUDIT', audits.length? '\n  '+audits.join('\n  ') : 'clean');
  fs.writeFileSync(`qa-shots/report-${MODE}-${SPEECH}-${VP[0]}.txt`, results.join('\n'));
  console.log(results.filter(r=>r.startsWith('PASS')).length+' pass, '+results.filter(r=>r.startsWith('FAIL')).length+' fail');
  await b.close();
})().catch(e=>{console.log('CRASH',e.message); fs.writeFileSync(`qa-${MODE}.txt`, results.join('\n')); process.exit(1);});
