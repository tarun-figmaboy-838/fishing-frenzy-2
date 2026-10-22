window.__speech={spoken:[],cancels:0,log:[]};
window.SpeechSynthesisUtterance=class{constructor(t){this.text=t;}};
const synth={speaking:false,pending:false,_cur:null,_timers:[],getVoices(){return [{name:'Fake Female',lang:'en-GB'}]},
 speak(u){ this._stop(); this.speaking=true; this._cur=u; __speech.spoken.push(u.text); const t0=performance.now(); u.onstart&&u.onstart({});
   const words=u.text.split(/\s+/); let ci=0; words.forEach((w,i)=>{ const idx=ci; this._timers.push(setTimeout(()=>{ __speech.log.push({t:performance.now(),i,text:u.text}); u.onboundary&&u.onboundary({name:'word',charIndex:idx});}, i*300)); ci+=w.length+1; });
   this._timers.push(setTimeout(()=>{this.speaking=false; this._cur=null; u.onend&&u.onend({});}, words.length*300+150)); },
 _stop(){ this._timers.forEach(clearTimeout); this._timers=[]; if(this._cur){const u=this._cur; this._cur=null; this.speaking=false; u.onerror&&u.onerror({error:'interrupted'});} },
 cancel(){ __speech.cancels++; this._stop(); }, onvoiceschanged:null};
Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true});
