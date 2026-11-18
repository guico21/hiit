'use strict';
/* ================================================================
   AFTERBURN — HIIT ENGINE · app.js
   Sections:
     1. utils & constants        5. exercise library
     2. config & persistence     6. music sources & panels
     3. timeline builder         7. session engine & particles
     4. audio engine & beats     8. complete / confetti / global events
   ================================================================ */

/* ---------------- 1. utils & constants ---------------- */
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const pad=n=>String(n).padStart(2,'0');
const fmt=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?h+':'+pad(m)+':'+pad(x):m+':'+pad(x);};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
let uidc=0; const uid=()=>'x'+(++uidc)+'_'+Date.now().toString(36);
const EX_COLORS=['#FF4D2E','#FF8A1E','#FFB020','#C6FF3F','#2EFFC4','#2EE6FF','#3D7BFF','#9D6BFF','#FF2E88'];
const exColor=i=>EX_COLORS[i%EX_COLORS.length];
const BASE_TITLE='AFTERBURN — HIIT Engine';

const PHASES={
  prep:{word:'GET READY',c:'#C6FF3F',c2:'#8AFF6A',sub:'find your stance',mode:'prep'},
  warmup:{word:'WARM UP',c:'#FFB020',c2:'#FF8A1E',sub:'raise the heart rate',mode:'warm'},
  work:{word:'WORK',c:'#FF4D2E',c2:'#FF8A1E',sub:'give everything',mode:'work'},
  rest:{word:'REST',c:'#2EE6FF',c2:'#3D7BFF',sub:'shake it loose',mode:'rest'},
  gap:{word:'RECOVER',c:'#2EFFC4',c2:'#2EE6FF',sub:'switch it up',mode:'rest'},
  cooldown:{word:'COOL DOWN',c:'#9D6BFF',c2:'#FF2E88',sub:'stretch it out',mode:'cool'},
  done:{word:'COMPLETE',c:'#C6FF3F',c2:'#FF8A1E',sub:'',mode:'rest'}
};

/* ---------------- 2. config & persistence ---------------- */
const LIMITS={work:{min:5,max:900,step:5},rest:{min:0,max:600,step:5},gap:{min:0,max:600,step:5},
  sets:{min:1,max:20,step:1},rounds:{min:1,max:20,step:1},prep:{min:0,max:120,step:5},
  'warmup.secs':{min:10,max:1800,step:10},'cooldown.secs':{min:10,max:1800,step:10}};
const mkEx=(name,work=40,sets=1,rest=15,gap=20)=>({id:uid(),name,work,sets,rest,gap});

const PRESETS={
  tabata:{rounds:1,prep:10,warmup:{on:true,secs:120,name:'Ramp Up'},cooldown:{on:true,secs:90,name:'Stretch Out'},
    exercises:[mkEx('Burpees',20,8,10,0)]},
  fullbody:{rounds:3,prep:10,warmup:{on:true,secs:180,name:'Warm Up'},cooldown:{on:true,secs:120,name:'Cooldown'},
    exercises:[mkEx('Jump Squats'),mkEx('Push-Ups'),mkEx('Mountain Climbers'),mkEx('Plank Shoulder Taps'),mkEx('High Knees'),mkEx('Burpees')]},
  core:{rounds:2,prep:10,warmup:{on:true,secs:120,name:'Mobility Flow'},cooldown:{on:true,secs:90,name:'Deep Stretch'},
    exercises:[mkEx('Plank',45,1,15,15),mkEx('Bicycle Crunches',40,1,15,15),mkEx('Russian Twists',40,1,15,15),mkEx('Leg Raises',30,1,15,15),mkEx('Hollow Hold',30,1,15,15),mkEx('Mountain Climbers',40,1,15,15)]},
  sprints:{rounds:1,prep:10,warmup:{on:true,secs:300,name:'Easy Jog'},cooldown:{on:true,secs:180,name:'Walk It Out'},
    exercises:[mkEx('Sprint in Place',20,10,40,0)]}
};
const clone=o=>JSON.parse(JSON.stringify(o));
function defaultConfig(){const p=clone(PRESETS.fullbody);p.exercises.forEach(e=>e.id=uid());p.voice=true;p.autoFullscreen=true;return p;}

let config=defaultConfig();
let music={source:'beat',trackId:'afterburn',volume:.75,loop:true,userPaused:false,ytUrl:'',ytTitle:''};
const LS='afterburn_v1';
function persist(){try{localStorage.setItem(LS,JSON.stringify({config,music:{source:music.source,trackId:music.trackId,volume:music.volume,loop:music.loop,userPaused:music.userPaused,ytUrl:music.ytUrl}}));}catch(e){}}
let persistT=null; const persistSoon=()=>{clearTimeout(persistT);persistT=setTimeout(persist,300);};
function loadState(){try{
  const raw=localStorage.getItem(LS); if(!raw)return;
  const d=JSON.parse(raw);
  if(d.config&&Array.isArray(d.config.exercises)){
    config=Object.assign(defaultConfig(),d.config);
    config.exercises=config.exercises.filter(e=>e&&typeof e.name==='string').map(e=>({id:uid(),name:e.name.slice(0,42),
      work:clamp(+e.work||40,5,900),sets:clamp(+e.sets||1,1,20),rest:clamp(+e.rest||0,0,600),gap:clamp(+e.gap||0,0,600)}));
    config.rounds=clamp(+config.rounds||1,1,20); config.prep=clamp(+config.prep||0,0,120);
    config.warmup=Object.assign({on:true,secs:180,name:'Warm Up'},config.warmup);
    config.cooldown=Object.assign({on:true,secs:120,name:'Cooldown'},config.cooldown);
    config.warmup.secs=clamp(+config.warmup.secs||180,10,1800); config.cooldown.secs=clamp(+config.cooldown.secs||120,10,1800);
  }
  if(d.music){music.volume=clamp(+d.music.volume||.75,0,1);music.loop=d.music.loop!==false;music.userPaused=!!d.music.userPaused;music.ytUrl=d.music.ytUrl||'';
    if(['beat','project','device','youtube'].includes(d.music.source))music.source=d.music.source==='device'?'beat':d.music.source;
    if(d.music.trackId)music.trackId=d.music.trackId;}
}catch(e){}}
const getPath=(obj,path)=>path.split('.').reduce((o,k)=>o[k],obj);
function setPath(obj,path,v){const ks=path.split('.');const last=ks.pop();ks.reduce((o,k)=>o[k],obj)[last]=v;}

/* ---------------- 3. timeline builder ---------------- */
function buildTimeline(cfg){
  const segs=[]; const push=(type,dur,label,meta)=>{if(dur>0)segs.push(Object.assign({type,dur,label},meta||{}));};
  if(cfg.prep>0)push('prep',cfg.prep,'Get Ready');
  if(cfg.warmup.on)push('warmup',cfg.warmup.secs,cfg.warmup.name||'Warm Up');
  const exs=cfg.exercises, n=exs.length;
  for(let r=1;r<=cfg.rounds;r++){
    exs.forEach((ex,ei)=>{
      for(let s=1;s<=ex.sets;s++){
        push('work',ex.work,ex.name,{ex:ei,set:s,sets:ex.sets,round:r,lastSet:s===ex.sets});
        if(s<ex.sets&&ex.rest>0)push('rest',ex.rest,'Rest',{ex:ei,set:s,sets:ex.sets,round:r,nextName:ex.name,nextSet:s+1});
      }
      const isLast=(r===cfg.rounds&&ei===n-1);
      if(!isLast&&ex.gap>0){
        const nextName=ei<n-1?exs[ei+1].name:exs[0].name;
        push('gap',ex.gap,'Recover',{ex:ei,round:r,nextName,nextRound:ei===n-1?r+1:r});
      }
    });
  }
  if(cfg.cooldown.on)push('cooldown',cfg.cooldown.secs,cfg.cooldown.name||'Cooldown');
  let t=0,work=0,rest=0,intervals=0;
  segs.forEach((s,i)=>{s.i=i;s.start=t;t+=s.dur;s.end=t;
    if(s.type==='work'){work+=s.dur;intervals++;}
    if(s.type==='rest'||s.type==='gap')rest+=s.dur;});
  return{segs,total:t,work,rest,intervals};
}
function segColor(s){
  if(s.type==='work')return exColor(s.ex||0);
  return{prep:'#5A6379',warmup:'#FFB020',rest:'#1FB6D8',gap:'#22D3A8',cooldown:'#9D6BFF'}[s.type]||'#5A6379';
}
function tlHTML(tl,withPlayhead){
  let h=tl.segs.map(s=>{
    const w=(s.dur/tl.total*100).toFixed(3);
    return `<div class="tl-seg" data-i="${s.i}" style="width:${w}%;background:${segColor(s)};color:${segColor(s)}" title="${esc(s.label)} · ${fmt(s.dur)}"></div>`;
  }).join('');
  if(withPlayhead)h+='<div class="tl-playhead" id="s-playhead" style="left:0%"></div>';
  return h;
}

/* ---------------- 4. audio engine & synthesized beats ---------------- */
const AE={ctx:null,master:null,cueG:null,musG:null,muted:false,noise:null,
  ensure(){
    if(!this.ctx){
      const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return false;
      this.ctx=new AC();
      this.master=this.ctx.createGain(); this.master.gain.value=this.muted?0:1; this.master.connect(this.ctx.destination);
      this.cueG=this.ctx.createGain(); this.cueG.gain.value=.55; this.cueG.connect(this.master);
      this.musG=this.ctx.createGain(); this.musG.gain.value=music.volume*music.volume; this.musG.connect(this.master);
      const len=this.ctx.sampleRate; const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
      const d=buf.getChannelData(0); for(let i=0;i<len;i++)d[i]=Math.random()*2-1; this.noise=buf;
    }
    if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
    return true;
  },
  now(){return this.ctx?this.ctx.currentTime:0;},
  setMuted(m){this.muted=m;
    if(this.ctx)this.master.gain.setTargetAtTime(m?0:1,this.now(),.03);
    htmlAudio.muted=m;
    try{if(YTMod.player&&YTMod.player.mute){m?YTMod.player.mute():YTMod.player.unMute();}}catch(e){}
    if(m&&window.speechSynthesis)speechSynthesis.cancel();
  },
  setVolume(v){music.volume=v;
    if(this.ctx)this.musG.gain.setTargetAtTime(v*v,this.now(),.05);
    htmlAudio.volume=v;
    try{if(YTMod.player&&YTMod.player.setVolume)YTMod.player.setVolume(Math.round(v*100));}catch(e){}
  },
  tone(f,dur,type,vol,when=0,slide){
    if(!this.ensure())return; const t=this.now()+when;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(f,t);
    if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g); g.connect(this.cueG); o.start(t); o.stop(t+dur+.05);
  },
  tick(){this.tone(1050,.06,'square',.3);},
  go(){this.tone(660,.09,'square',.32);this.tone(990,.09,'square',.32,.09);this.tone(1320,.34,'square',.34,.18);this.duck();},
  restCue(){this.tone(880,.3,'sine',.3,0,440);this.duck();},
  warmCue(){this.tone(520,.22,'triangle',.3,0,660);this.duck();},
  coolCue(){this.tone(660,.4,'sine',.26,0,330);this.duck();},
  fanfare(){const N=[523.25,659.25,783.99,1046.5];
    N.forEach((f,i)=>{this.tone(f,.34,'sawtooth',.16,i*.12);this.tone(f,.34,'triangle',.22,i*.12);});
    [523.25,659.25,783.99].forEach(f=>this.tone(f,1.1,'triangle',.16,.62));
    this.tone(2093,.5,'sine',.14,.62);},
  duck(){if(!this.ctx)return; const g=this.musG.gain,v=music.volume*music.volume,t=this.now();
    g.cancelScheduledValues(t); g.setTargetAtTime(v*.3,t,.02); g.setTargetAtTime(v,t+.55,.18);}
};
const mtof=m=>440*Math.pow(2,(m-69)/12);

const BEATS=[
 {id:'afterburn',name:'AFTERBURN 128',bpm:128,tag:'DRIVE',energy:4,
  kick:[0,4,8,12],clap:[4,12],ohat:[2,6,10,14],chat:true,
  bass:[45,0,45,0,48,0,45,0,52,0,45,0,43,0,48,0],stab:{bar:4,step:0,notes:[57,60,64]}},
 {id:'redline',name:'REDLINE 140',bpm:140,tag:'ATTACK',energy:5,
  kick:[0,4,8,12],clap:[4,12],ohat:[2,6,10,14],chat:true,extraKick:14,
  bass:[40,0,40,40,0,40,43,0,40,0,40,40,46,0,45,0],stab:{bar:2,step:8,notes:[52,55,59]}},
 {id:'drift',name:'DRIFT 84',bpm:84,tag:'RECOVER',energy:2,
  kick:[0,8],soft:true,clap:[],ohat:[],chat:false,gentleHat:[4,12],
  arp:[60,64,67,72,67,64],bass:[36,0,0,0,0,0,0,0,43,0,0,0,0,0,0,0]}
];
const Beat={playing:false,track:null,step:0,next:0,timer:null,
  start(track){
    if(!AE.ensure())return false;
    this.stop(); this.track=track; this.step=0; this.next=AE.now()+.08; this.playing=true;
    this.timer=setInterval(()=>this.schedule(),90); this.schedule(); return true;
  },
  stop(){this.playing=false; if(this.timer){clearInterval(this.timer);this.timer=null;}},
  schedule(){
    if(!this.playing||!AE.ctx)return;
    const ahead=document.hidden?1.6:.18, spb=60/this.track.bpm/4;
    while(this.next<AE.now()+ahead){this.playStep(this.step,this.next);this.next+=spb;this.step=(this.step+1)%64;}
  },
  kick(t,v){const c=AE.ctx,o=c.createOscillator(),g=c.createGain();
    o.type='sine';o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(44,t+.12);
    g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);
    o.connect(g);g.connect(AE.musG);o.start(t);o.stop(t+.2);},
  hat(t,open,v){const c=AE.ctx,s=c.createBufferSource();s.buffer=AE.noise;
    const f=c.createBiquadFilter();f.type='highpass';f.frequency.value=7200;
    const g=c.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+(open?.14:.04));
    s.connect(f);f.connect(g);g.connect(AE.musG);s.start(t);s.stop(t+.2);},
  clap(t){const c=AE.ctx,s=c.createBufferSource();s.buffer=AE.noise;
    const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=1800;f.Q.value=1.1;
    const g=c.createGain();g.gain.setValueAtTime(.4,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);
    s.connect(f);f.connect(g);g.connect(AE.musG);s.start(t);s.stop(t+.25);},
  bassN(t,m,dur,v){const c=AE.ctx,o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
    o.type='sawtooth';o.frequency.value=mtof(m);f.type='lowpass';f.frequency.setValueAtTime(700,t);f.frequency.exponentialRampToValueAtTime(180,t+dur);
    g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(f);f.connect(g);g.connect(AE.musG);o.start(t);o.stop(t+dur+.05);},
  pluck(t,m){const c=AE.ctx,o=c.createOscillator(),g=c.createGain();
    o.type='triangle';o.frequency.value=mtof(m);
    g.gain.setValueAtTime(.17,t);g.gain.exponentialRampToValueAtTime(.001,t+.55);
    o.connect(g);g.connect(AE.musG);o.start(t);o.stop(t+.6);},
  stab(t,notes){const c=AE.ctx;notes.forEach(m=>{
    const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();
    o.type='sawtooth';o.frequency.value=mtof(m);o.detune.value=(Math.random()*10-5);
    f.type='lowpass';f.frequency.value=1400;
    g.gain.setValueAtTime(.07,t);g.gain.exponentialRampToValueAtTime(.001,t+.32);
    o.connect(f);f.connect(g);g.connect(AE.musG);o.start(t);o.stop(t+.4);});},
  playStep(s,t){
    const T=this.track,i=s%16,bar=Math.floor(s/16);
    if(T.kick.includes(i))this.kick(t,T.soft?.45:.85);
    if(T.extraKick===i&&bar%2===1)this.kick(t,.7);
    if(T.clap.includes(i))this.clap(t);
    if(T.ohat.includes(i))this.hat(t,true,.22);
    if(T.chat&&!T.ohat.includes(i))this.hat(t,false,i%2?.07:.13);
    if(T.gentleHat&&T.gentleHat.includes(i))this.hat(t,false,.06);
    if(T.arp&&i%2===0)this.pluck(t,T.arp[(i/2)%T.arp.length]);
    const b=T.bass[i];
    if(b)this.bassN(t,b,T.soft?.7:.22,T.soft?.22:.32);
    if(T.stab&&bar%T.stab.bar===T.stab.bar-1&&i===T.stab.step)this.stab(t,T.stab.notes);
  }
};

/* ---------------- 5. exercise library ---------------- */
const CATS={'Full Body':'#FF4D2E','Cardio':'#FF8A1E','Strength':'#FFB020','Core':'#2EE6FF','Legs':'#C6FF3F','Mobility':'#9D6BFF'};
const LIBRARY=[
 ['Burpees','Full Body',40],['Sprawls','Full Body',30],['Inchworm','Full Body',40],['Bear Crawl','Full Body',30],['Shadow Boxing','Full Body',45],['Tuck Jumps','Full Body',20],
 ['Jumping Jacks','Cardio',45],['High Knees','Cardio',30],['Mountain Climbers','Cardio',40],['Jump Rope','Cardio',60],['Sprint in Place','Cardio',20],['Butt Kicks','Cardio',30],['Skater Hops','Cardio',30],['Lateral Bounds','Cardio',30],['Jab-Cross','Cardio',30],['Uppercuts','Cardio',30],
 ['Push-Ups','Strength',40],['Diamond Push-Ups','Strength',30],['Pike Push-Ups','Strength',30],['Tricep Dips','Strength',40],['Renegade Rows','Strength',40],['Plank Shoulder Taps','Strength',40],['Superman Hold','Strength',30],['Crab Reach','Strength',30],
 ['Plank','Core',45],['Bicycle Crunches','Core',40],['Russian Twists','Core',40],['Leg Raises','Core',40],['V-Ups','Core',30],['Hollow Hold','Core',30],['Flutter Kicks','Core',40],['Dead Bug','Core',40],['Side Plank (L)','Core',30],['Side Plank (R)','Core',30],['Bird Dog','Core',40],
 ['Jump Squats','Legs',40],['Squats','Legs',45],['Sumo Squats','Legs',45],['Lunges','Legs',45],['Jump Lunges','Legs',30],['Curtsy Lunges','Legs',40],['Glute Bridges','Legs',45],['Calf Raises','Legs',40],['Wall Sit','Legs',45],['Step-Ups','Legs',40],['Box Jumps','Legs',30],
 ['March in Place','Mobility',60],['Arm Circles','Mobility',30],['Hip Openers','Mobility',30],['Cat-Cow','Mobility',40],["World's Greatest Stretch",'Mobility',45],["Child's Pose",'Mobility',45]
];
let libCat='All',libQ='';
function renderLibChips(){
  const cats=['All',...Object.keys(CATS)];
  $('#lib-chips').innerHTML=cats.map(c=>
    `<button class="lib-chip${c===libCat?' active':''}" data-cat="${c}" style="--cc:${CATS[c]||'#2EE6FF'}">${c.toUpperCase()}</button>`).join('');
}
function renderLibGrid(){
  const q=libQ.toLowerCase();
  const items=LIBRARY.map((l,i)=>({l,i})).filter(({l})=>(libCat==='All'||l[1]===libCat)&&(!q||l[0].toLowerCase().includes(q)));
  $('#lib-grid').innerHTML=items.map(({l,i})=>
    `<button class="lib-item" data-libidx="${i}" style="--cc:${CATS[l[1]]}"><span class="dot"></span><span>${esc(l[0])}</span><em>${l[2]}s</em></button>`).join('')
    ||'<div class="mempty" style="grid-column:1/-1">No matches — create it above.</div>';
  $('#lib-count').textContent=items.length+' EXERCISES';
}
function openLib(){renderLibChips();renderLibGrid();$('#modal-lib').classList.add('open');setTimeout(()=>$('#lib-search').focus(),80);}
function closeLib(){$('#modal-lib').classList.remove('open');}

/* ---------------- toasts & confirm ---------------- */
function toast(msg,type='info',action){
  const box=$('#toasts');
  while(box.children.length>=3)box.firstChild.remove();
  const colors={info:'#2EE6FF',ok:'#C6FF3F',warn:'#FFB020',err:'#FF4D5E'};
  const icons={info:'#i-bolt',ok:'#i-check',warn:'#i-timer',err:'#i-x'};
  const el=document.createElement('div');el.className='toast';el.style.setProperty('--tc',colors[type]||colors.info);
  el.innerHTML=`<svg class="ic"><use href="${icons[type]||icons.info}"/></svg><span>${esc(msg)}</span>`;
  if(action){const b=document.createElement('button');b.textContent=action.label;
    b.addEventListener('click',()=>{action.fn();kill();});el.appendChild(b);}
  box.appendChild(el);
  let killed=false;const kill=()=>{if(killed)return;killed=true;el.classList.add('out');setTimeout(()=>el.remove(),260);};
  setTimeout(kill,action?5200:3200);
}
let confirmFn=null;
function openConfirm(title,bodyHTML,okLabel,fn,danger=true){
  $('#cf-title').textContent=title;$('#cf-body').innerHTML=bodyHTML;
  const ok=$('#cf-ok');ok.textContent=okLabel;ok.className='btn btn-sm '+(danger?'btn-danger':'btn-go');
  confirmFn=fn;$('#modal-confirm').classList.add('open');ok.focus();
}
function closeConfirm(){$('#modal-confirm').classList.remove('open');confirmFn=null;}

/* ---------------- builder rendering ---------------- */
function stepHTML(k,val,unit,lab){
  return `<div class="step" data-k="${k}"><div class="step-row">
    <button class="step-btn" data-act="dec" aria-label="decrease ${lab}"><svg class="ic"><use href="#i-minus"/></svg></button>
    <span class="step-val"><input type="number" inputmode="numeric" value="${val}" aria-label="${lab}"><span class="unit">${unit}</span></span>
    <button class="step-btn" data-act="inc" aria-label="increase ${lab}"><svg class="ic"><use href="#i-plus"/></svg></button>
  </div><span class="step-lab">${lab}</span></div>`;
}
const exTotal=e=>e.sets*e.work+(e.sets-1)*e.rest+e.gap;
function renderExercises(){
  const list=$('#ex-list');
  list.innerHTML=config.exercises.map((e,i)=>`
   <div class="ex-row" data-id="${e.id}" style="--ec:${exColor(i)}">
    <span class="drag-handle" title="Drag to reorder"><svg class="ic"><use href="#i-grip"/></svg></span>
    <span class="ex-idx">${i+1}</span>
    <div class="ex-main">
      <div class="ex-name-row">
        <input class="ex-name" data-field="name" value="${esc(e.name)}" maxlength="42" aria-label="exercise name">
        <span class="ex-time">≈ ${fmt(exTotal(e))}</span>
      </div>
    </div>
    <div class="ex-actions">
      <button class="icon-btn" data-act="up" title="Move up"><svg class="ic"><use href="#i-up"/></svg></button>
      <button class="icon-btn" data-act="down" title="Move down"><svg class="ic"><use href="#i-down"/></svg></button>
      <button class="icon-btn" data-act="dup" title="Duplicate"><svg class="ic"><use href="#i-copy"/></svg></button>
      <button class="icon-btn danger" data-act="del" title="Remove"><svg class="ic"><use href="#i-trash"/></svg></button>
    </div>
    <div class="ex-steps">
      ${stepHTML('work',e.work,'s','WORK')}
      ${stepHTML('sets',e.sets,'×','SETS')}
      ${stepHTML('rest',e.rest,'s','REST')}
      ${stepHTML('gap',e.gap,'s','BREAK')}
    </div>
   </div>`).join('');
  $('#ex-empty').hidden=config.exercises.length>0;
  $('#ex-count').textContent=config.exercises.length;
  refreshSummary();
}
function refreshSummary(){
  const tl=buildTimeline(config);
  $('#sum-total').textContent=fmt(tl.total);$('#mast-total').textContent=fmt(tl.total);$('#m-total').textContent=fmt(tl.total);
  $('#sum-work').textContent=fmt(tl.work);$('#sum-rest').textContent=fmt(tl.rest);
  $('#sum-int').textContent=tl.intervals;$('#sum-rounds').textContent=config.exercises.length?config.rounds:0;
  const parts=[];
  if(config.warmup.on)parts.push(fmt(config.warmup.secs)+' warm-up');
  if(config.cooldown.on)parts.push(fmt(config.cooldown.secs)+' cool-down');
  if(config.prep>0)parts.push(fmt(config.prep)+' prep');
  $('#sum-includes').textContent=parts.length?'Includes '+parts.join(' · '):'No warm-up or cool-down — straight to work.';
  $('#sum-timeline').innerHTML=tl.total?tlHTML(tl,false):'';
  const dis=!config.exercises.length||tl.total<=0;
  $('#btn-start').disabled=dis;$('#btn-start-m').disabled=dis;
  $('#btn-start').title=dis?'Add at least one exercise':'';
  syncStructureUI();
}
function syncStructureUI(){
  const setStep=(k,v)=>{const el=$(`#screen-builder .step[data-k="${k}"] input`);if(el&&document.activeElement!==el)el.value=v;};
  setStep('rounds',config.rounds);setStep('prep',config.prep);
  setStep('warmup.secs',config.warmup.secs);setStep('cooldown.secs',config.cooldown.secs);
  const wName=$('[data-field="warmup.name"]'),cName=$('[data-field="cooldown.name"]');
  if(document.activeElement!==wName)wName.value=config.warmup.name;
  if(document.activeElement!==cName)cName.value=config.cooldown.name;
  const setSw=(k,v)=>{const el=$(`[data-toggle="${k}"]`);if(el)el.setAttribute('aria-checked',String(v));};
  setSw('warmup.on',config.warmup.on);setSw('cooldown.on',config.cooldown.on);
  setSw('voice',config.voice);setSw('autoFullscreen',config.autoFullscreen);
  $('#warm-block').classList.toggle('off',!config.warmup.on);
  $('#cool-block').classList.toggle('off',!config.cooldown.on);
}
const findEx=id=>config.exercises.find(e=>e.id===id);
function updateRowChip(row,e){row.querySelector('.ex-time').textContent='≈ '+fmt(exTotal(e));}
function applyStep(stepEl,dir){
  const k=stepEl.dataset.k,L=LIMITS[k];if(!L)return;
  const row=stepEl.closest('[data-id]');
  let cur;
  if(row){const e=findEx(row.dataset.id);if(!e)return;cur=e[k];}
  else cur=getPath(config,k);
  const v=clamp(cur+dir*L.step,L.min,L.max);
  if(v===cur)return;
  if(row){const e=findEx(row.dataset.id);e[k]=v;updateRowChip(row,e);}
  else setPath(config,k,v);
  const inp=stepEl.querySelector('input');if(inp)inp.value=v;
  refreshSummary();persistSoon();
}
function flashRow(id){const r=$(`.ex-row[data-id="${id}"]`);if(r){r.classList.add('flash');r.scrollIntoView({block:'nearest',behavior:REDUCED?'auto':'smooth'});setTimeout(()=>r.classList.remove('flash'),1200);}}
function addExercise(name,work=40){
  name=(name||'').trim();if(!name){toast('Give the exercise a name first.','warn');return null;}
  const e=mkEx(name.slice(0,42),work);config.exercises.push(e);
  renderExercises();persistSoon();flashRow(e.id);return e;
}

/* ---------------- 6. music sources & panels ---------------- */
const htmlAudio=new Audio(); htmlAudio.loop=true; htmlAudio.preload='auto';
let projectTracks=[],deviceTracks=[],htmlLoadedId=null;
htmlAudio.addEventListener('ended',()=>{if(!music.loop){music.userPaused=true;refreshMusicUI();}});
htmlAudio.addEventListener('play',refreshMusicUI);
htmlAudio.addEventListener('pause',refreshMusicUI);
htmlAudio.addEventListener('error',()=>{if(music.source==='project'||music.source==='device'){htmlLoadedId=null;toast('Could not load that track file.','err');music.userPaused=true;refreshMusicUI();}});

const YTMod={api:'idle',player:null,ready:false,pending:null,
  parse(url){url=(url||'').trim();
    const m=url.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/);
    if(m)return m[1]; if(/^[\w-]{11}$/.test(url))return url; return null;},
  ensureApi(){
    if(window.YT&&window.YT.Player){this.api='ready';return;}
    if(this.api==='loading')return; this.api='loading';
    window.onYouTubeIframeAPIReady=()=>{this.api='ready';if(this.pending){const id=this.pending;this.pending=null;this.create(id);}};
    const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';
    s.onerror=()=>{this.api='error';ytStatus('err','YouTube API failed to load — check your connection.');};
    document.head.appendChild(s);
    setTimeout(()=>{if(this.api==='loading'){this.api='error';ytStatus('err','YouTube API timed out. Try again.');}},9000);
  },
  load(id){
    music.source='youtube';music.trackId=id;stopOtherSources('youtube');
    ytStatus('load','Loading audio stream…');this.ensureApi();
    if(this.api==='ready')this.create(id);else this.pending=id;
    persistSoon();refreshMusicUI();
  },
  create(id){
    if(this.player&&this.ready){try{this.player.loadVideoById(id);this.player.setVolume(Math.round(music.volume*100));AE.muted?this.player.mute():this.player.unMute();this.player.playVideo();}catch(e){}return;}
    if(this.player){this.pending=id;return;}
    const vars={autoplay:1,controls:0,disablekb:1,fs:0,modestbranding:1,playsinline:1,rel:0,loop:1,playlist:id};
    if(location.protocol.startsWith('http'))vars.origin=location.origin;
    try{
      this.player=new YT.Player('yt-player',{width:'320',height:'180',videoId:id,playerVars:vars,events:{
        onReady:()=>{this.ready=true;
          try{
            if(this.pending){const p=this.pending;this.pending=null;this.player.loadVideoById(p);}
            this.player.setVolume(Math.round(music.volume*100));AE.muted?this.player.mute():this.player.unMute();this.player.playVideo();
          }catch(e){}
          ytStatus('ok','Stream ready — audio only.');},
        onStateChange:(ev)=>{
          const S=YT.PlayerState;
          if(ev.data===S.PLAYING){music.userPaused=false;
            try{const d=this.player.getVideoData();if(d&&d.title)music.ytTitle=d.title;}catch(e){}
            ytStatus('ok','▶ '+(music.ytTitle||'Playing')+' — audio only');}
          if(ev.data===S.PAUSED){music.userPaused=true;}
          if(ev.data===S.ENDED){if(music.loop){try{this.player.seekTo(0);this.player.playVideo();}catch(e){}}else music.userPaused=true;}
          refreshMusicUI();
        },
        onError:(ev)=>{const map={2:'Invalid video ID.',5:'Playback error in this browser.',100:'Video not found or private.',101:'Owner disabled embedding — try another link.',150:'Owner disabled embedding — try another link.'};
          ytStatus('err',map[ev.data]||'This video can’t be played here.');music.userPaused=true;refreshMusicUI();}
      }});
    }catch(e){ytStatus('err','Could not create the YouTube player.');}
  },
  play(){if(this.player&&this.ready){try{this.player.playVideo();}catch(e){}}else if(music.trackId)this.load(music.trackId);},
  pause(){if(this.player&&this.ready){try{this.player.pauseVideo();}catch(e){}}},
  stop(){this.pause();},
  isPlaying(){try{return this.ready&&this.player.getPlayerState()===YT.PlayerState.PLAYING;}catch(e){return false;}}
};
function ytStatus(kind,msg){const el=$('#yt-status');el.className='yt-status '+(kind==='ok'?'ok':kind==='err'?'err':kind==='load'?'load':'');
  el.innerHTML=(kind==='load'?'<span class="spin"></span>':'')+esc(msg);}

function trackName(){
  if(music.source==='beat'){const b=BEATS.find(x=>x.id===music.trackId);return b?b.name:'Built-in beat';}
  if(music.source==='youtube')return music.ytTitle||'YouTube audio';
  const list=music.source==='project'?projectTracks:deviceTracks;
  const t=list.find(x=>x.id===music.trackId);return t?t.title:'Track';
}
function isMusicPlaying(){
  if(music.source==='beat')return Beat.playing;
  if(music.source==='youtube')return YTMod.isPlaying();
  return !htmlAudio.paused&&!htmlAudio.ended;
}
function stopOtherSources(except){
  if(except!=='beat')Beat.stop();
  if(except!=='project'&&except!=='device'&&except!=='file')htmlAudio.pause();
  if(except!=='youtube')YTMod.stop();
}
function playCurrent(){
  AE.ensure();
  if(music.source==='beat'){
    const b=BEATS.find(x=>x.id===music.trackId)||BEATS[0];music.trackId=b.id;
    stopOtherSources('beat');Beat.start(b);
  }else if(music.source==='youtube'){stopOtherSources('youtube');YTMod.play();}
  else{
    const list=music.source==='project'?projectTracks:deviceTracks;
    const t=list.find(x=>x.id===music.trackId);
    if(!t){toast('Track unavailable — pick another source.','err');music.source='beat';music.trackId='afterburn';return playCurrent();}
    stopOtherSources('file');
    if(htmlLoadedId!==t.id){htmlAudio.src=t.src;htmlLoadedId=t.id;}
    htmlAudio.loop=music.loop;htmlAudio.volume=music.volume;htmlAudio.muted=AE.muted;
    htmlAudio.play().catch(()=>{toast('Tap play again — browser blocked autoplay.','warn');music.userPaused=true;refreshMusicUI();});
  }
  music.userPaused=false;persistSoon();refreshMusicUI();
}
function pauseCurrent(){
  if(music.source==='beat')Beat.stop();
  else if(music.source==='youtube')YTMod.pause();
  else htmlAudio.pause();
  music.userPaused=true;persistSoon();refreshMusicUI();
}
function toggleMusic(){isMusicPlaying()?pauseCurrent():playCurrent();}
function selectTrack(source,id){music.source=source;music.trackId=id;music.userPaused=false;playCurrent();}
function refreshMusicUI(){
  const playing=isMusicPlaying(),name=trackName();
  $('#mc-title').textContent=name;$('#sm-title').textContent=name;
  $('#mc-play-ic').setAttribute('href',playing?'#i-pause':'#i-play');
  $('#sm-play-ic').setAttribute('href',playing?'#i-pause':'#i-play');
  $('#mc-loop').setAttribute('aria-pressed',String(music.loop));
  $('#vol-main').value=Math.round(music.volume*100);$('#vol-sess').value=Math.round(music.volume*100);
  $$('#beats-list .track-row').forEach(r=>{
    const active=music.source==='beat'&&r.dataset.beat===music.trackId;
    r.classList.toggle('active',active);r.classList.toggle('playing',active&&playing);
    r.querySelector('use').setAttribute('href',active&&playing?'#i-pause':'#i-play');
  });
  const markList=(sel,src)=>$$(sel).forEach(r=>{
    const active=music.source===src&&r.dataset.tid===music.trackId;
    r.classList.toggle('active',active);r.classList.toggle('playing',active&&playing);
    const u=r.querySelector('.tr-play use');if(u)u.setAttribute('href',active&&playing?'#i-pause':'#i-play');
  });
  markList('#project-list .track-row','project');markList('#device-list .track-row','device');
}
function renderBeats(){
  $('#beats-list').innerHTML=BEATS.map(b=>{
    const bars=[1,2,3,4,5].map(i=>`<i class="${i<=b.energy?'on':''}" style="height:${3+i*2}px"></i>`).join('');
    return `<button class="track-row" data-beat="${b.id}">
      <span class="tr-play"><svg class="ic"><use href="#i-play"/></svg></span>
      <span class="tr-info"><span class="tr-name">${b.name}</span>
        <span class="tr-meta"><span class="bpm">${b.bpm} BPM</span><span>${b.tag}</span><span class="energy">${bars}</span></span></span>
      <span class="eq"><i></i><i></i><i></i><i></i></span></button>`;
  }).join('');
}
function renderTrackList(container,list,src,emptyEl){
  container.innerHTML=list.map(t=>
    `<div class="track-row" data-tid="${t.id}" role="button" tabindex="0">
      <span class="tr-play"><svg class="ic"><use href="#i-play"/></svg></span>
      <span class="tr-info"><span class="tr-name">${esc(t.title)}</span><span class="tr-meta"><span>${src==='project'?'PROJECT FILE':'LOCAL FILE'}</span></span></span>
      <span class="eq"><i></i><i></i><i></i><i></i></span>
      ${src==='device'?`<button class="icon-btn danger" data-rm="${t.id}" title="Remove"><svg class="ic"><use href="#i-x"/></svg></button>`:''}
    </div>`).join('');
  if(emptyEl)emptyEl.hidden=list.length>0;
}
function bindTrackList(container,getList,src){
  container.addEventListener('click',e=>{
    const rm=e.target.closest('[data-rm]');
    if(rm){const list=getList();const i=list.findIndex(t=>t.id===rm.dataset.rm);
      if(i>=0){try{URL.revokeObjectURL(list[i].src);}catch(err){}
        if(music.source===src&&music.trackId===list[i].id){htmlAudio.pause();htmlLoadedId=null;music.source='beat';music.trackId='afterburn';music.userPaused=true;}
        list.splice(i,1);renderTrackList(container,list,src);refreshMusicUI();}
      return;}
    const r=e.target.closest('[data-tid]');if(!r)return;
    const id=r.dataset.tid;
    if(music.source===src&&music.trackId===id&&isMusicPlaying())pauseCurrent();
    else selectTrack(src,id);
  });
}
function loadProjectTracks(){
  fetch('audio/tracks.json').then(r=>{if(!r.ok)throw 0;return r.json();}).then(d=>{
    if(!Array.isArray(d))throw 0;
    projectTracks=d.map((t,i)=>{
      const title=typeof t==='string'?t:(t.title||t.name||'Track '+(i+1));
      const file=typeof t==='string'?t:(t.file||t.src||'');
      return{id:'p'+i,title:String(title),src:'audio/'+String(file)};
    }).filter(t=>t.src!=='audio/');
    renderTrackList($('#project-list'),projectTracks,'project',$('#project-empty'));
    if(music.source==='project'&&!projectTracks.find(t=>t.id===music.trackId)){music.source='beat';music.trackId='afterburn';}
    refreshMusicUI();
  }).catch(()=>{projectTracks=[];renderTrackList($('#project-list'),projectTracks,'project',$('#project-empty'));
    if(music.source==='project'){music.source='beat';music.trackId='afterburn';refreshMusicUI();}});
}
function addDeviceFiles(files){
  let n=0;
  Array.from(files).forEach(f=>{
    if(!(f.type.startsWith('audio/')||/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(f.name)))return;
    deviceTracks.push({id:uid(),title:f.name.replace(/\.[^.]+$/,''),src:URL.createObjectURL(f)});n++;
  });
  if(n){renderTrackList($('#device-list'),deviceTracks,'device');toast(n+' file'+(n>1?'s':'')+' added','ok');
    if(!isMusicPlaying())selectTrack('device',deviceTracks[deviceTracks.length-n].id);}
  else toast('No audio files found in that drop.','warn');
}
function speak(text){
  if(!config.voice||AE.muted||!window.speechSynthesis)return;
  try{speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);u.rate=1.05;u.pitch=1;u.volume=1;u.lang='en-US';
    speechSynthesis.speak(u);}catch(e){}
}

/* ---------------- 7. session engine & particles ---------------- */
const FX={cv:null,ctx:null,parts:[],sparks:[],mode:'rest',acc:0,w:0,h:0,dpr:1,
  init(){this.cv=$('#fx');this.ctx=this.cv.getContext('2d');this.resize();},
  resize(){if(!this.cv)return;this.dpr=Math.min(window.devicePixelRatio||1,1.75);
    this.w=this.cv.clientWidth;this.h=this.cv.clientHeight;
    this.cv.width=Math.max(1,this.w*this.dpr);this.cv.height=Math.max(1,this.h*this.dpr);
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);},
  palette(){return{work:['#FF4D2E','#FF8A1E','#FFB020'],warm:['#FFB020','#FF8A1E'],
    rest:['#2EE6FF','#3D7BFF','#2EFFC4'],cool:['#9D6BFF','#FF2E88'],prep:['#C6FF3F','#8AFF6A']}[this.mode]||['#2EE6FF'];},
  burst(x,y){if(REDUCED)return;const cols=['#C6FF3F','#FF8A1E','#FF4D2E','#2EFFC4','#FFFFFF'];
    for(let i=0;i<64;i++){const a=Math.random()*Math.PI*2,sp=180+Math.random()*380;
      this.sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-60,life:.7+Math.random()*.6,t:0,
        size:1.5+Math.random()*2.5,c:cols[i%cols.length]});}},
  step(dt,paused){
    if(!this.ctx)return;const c=this.ctx;c.clearRect(0,0,this.w,this.h);
    if(REDUCED)return;
    const rate=(this.mode==='work'?13:this.mode==='warm'?8:6)*(paused?.15:1);
    this.acc+=dt*rate;
    const pal=this.palette();
    while(this.acc>=1&&this.parts.length<90){this.acc--;
      const ember=this.mode==='work'||this.mode==='warm';
      this.parts.push({x:Math.random()*this.w,y:ember?this.h+10:Math.random()*this.h,
        vx:(Math.random()-.5)*14,vy:ember?-(35+Math.random()*85):-(6+Math.random()*16),
        t:0,life:ember?2.6+Math.random()*3:5+Math.random()*5,size:ember?1+Math.random()*2.4:.8+Math.random()*1.8,
        c:pal[Math.floor(Math.random()*pal.length)],wig:Math.random()*Math.PI*2,ember});}
    const slow=paused?.25:1;
    c.globalCompositeOperation='lighter';
    this.parts=this.parts.filter(p=>{
      p.t+=dt;if(p.t>p.life||p.y<-20)return false;
      p.wig+=dt*2;p.x+=(p.vx+Math.sin(p.wig)*(p.ember?16:6))*dt*slow;p.y+=p.vy*dt*slow;
      const a=Math.sin(Math.min(1,p.t/p.life)*Math.PI)*(p.ember?.75:.5);
      c.globalAlpha=a;c.fillStyle=p.c;c.beginPath();c.arc(p.x,p.y,p.size,0,7);c.fill();return true;});
    this.sparks=this.sparks.filter(p=>{
      p.t+=dt;if(p.t>p.life)return false;
      p.vy+=340*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;
      c.globalAlpha=(1-p.t/p.life);c.fillStyle=p.c;
      c.beginPath();c.arc(p.x,p.y,p.size*(1-p.t/p.life*.5),0,7);c.fill();return true;});
    c.globalAlpha=1;c.globalCompositeOperation='source-over';
  }
};

let S=null,rafId=null,logicTimer=null,sessionActive=false,wakeLock=null,lastFrame=0;
const RING_C=2*Math.PI*170;
const D={};
function cacheSessionDom(){
  ['s-phase-txt','hud-ex','hud-set','hud-round','hud-elapsed','hud-left','rc-phase','rc-time','rc-sub',
   's-name-tag','s-name','s-next','ring-arc','ring-tap','stamp','done-banner','done-banner-txt','pause-ic','s-timeline','liveTxt']
  .forEach(id=>D[id]=document.getElementById(id));
  D.rg1=$('#rg1');D.rg2=$('#rg2');D.playhead=null;
  $('#ring-arc').style.strokeDasharray=RING_C;
}
function buildTicks(){
  let h='';for(let i=0;i<60;i++){const a=i/60*Math.PI*2,maj=i%5===0;
    const r1=maj?181:184,r2=189;
    h+=`<line class="tick${maj?' major':''}" x1="${200+Math.cos(a)*r1}" y1="${200+Math.sin(a)*r1}" x2="${200+Math.cos(a)*r2}" y2="${200+Math.sin(a)*r2}"/>`;}
  $('#ticks').innerHTML=h;
}
async function acquireWake(){try{if('wakeLock'in navigator){wakeLock=await navigator.wakeLock.request('screen');}}catch(e){}}
function releaseWake(){try{if(wakeLock){wakeLock.release();wakeLock=null;}}catch(e){}}
function showScreen(name){
  document.body.dataset.screen=name;
  $('#screen-builder').hidden=name!=='builder';
  $('#screen-session').hidden=name!=='session';
  $('#screen-complete').hidden=name!=='complete';
  $('#btn-end').hidden=name!=='session';
  $('#liveDot').hidden=name!=='session';
  if(name==='builder'){document.body.dataset.phase='build';document.title=BASE_TITLE;}
  window.scrollTo(0,0);
}
function startSession(){
  if(sessionActive)return;
  const tl=buildTimeline(config);
  if(!config.exercises.length||tl.total<=0){toast('Add at least one exercise first.','warn');return;}
  AE.ensure();closeLib();closeConfirm();
  S={tl,segs:tl.segs,total:tl.total,elapsed:0,lastTs:performance.now(),idx:-1,whole:-1,status:'running',lastElapsedTxt:'',lastLeftTxt:''};
  sessionActive=true;
  showScreen('session');document.body.classList.remove('paused');
  D['pause-ic'].setAttribute('href','#i-pause');D.liveTxt.textContent='LIVE';
  $('#s-timeline').innerHTML=tlHTML(tl,true);D.playhead=$('#s-playhead');
  FX.init();FX.parts.length=0;FX.sparks.length=0;
  acquireWake();
  if(config.autoFullscreen&&!document.fullscreenElement&&document.documentElement.requestFullscreen)
    document.documentElement.requestFullscreen().catch(()=>{});
  if(!music.userPaused&&!isMusicPlaying())playCurrent();
  advance(performance.now());
  clearInterval(logicTimer);logicTimer=setInterval(()=>advance(performance.now()),250);
  cancelAnimationFrame(rafId);lastFrame=performance.now();
  rafId=requestAnimationFrame(frame);
  speak('Session starting. Get ready.');
}
function locate(t){
  let i=clamp(S.idx,0,S.segs.length-1);
  while(i<S.segs.length-1&&t>=S.segs[i].end)i++;
  while(i>0&&t<S.segs[i].start)i--;
  return S.segs[i];
}
function advance(now){
  if(!S)return;
  if(S.status!=='running'){S.lastTs=now;return;}
  S.elapsed+=(now-S.lastTs)/1000;S.lastTs=now;
  if(S.elapsed>=S.total){S.elapsed=S.total;finish();return;}
  const seg=locate(S.elapsed);
  if(seg.i!==S.idx){const prev=S.idx>=0?S.segs[S.idx]:null;const jumped=seg.i-S.idx>1;S.idx=seg.i;onPhase(prev,seg,jumped);}
  const whole=Math.ceil(seg.end-S.elapsed);
  if(whole!==S.whole){S.whole=whole;
    if(whole>=1&&whole<=3){AE.tick();pulseTime();}
    D['ring-tap'].classList.toggle('last3',whole<=3&&seg.type!=='prep');}
}
function pulseTime(){if(REDUCED)return;const el=D['rc-time'];el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse');}
function setPhaseTheme(type){
  const P=PHASES[type]||PHASES.work;
  document.body.dataset.phase=type;
  D.rg1.setAttribute('stop-color',P.c2);D.rg2.setAttribute('stop-color',P.c);
  FX.mode=P.mode;
}
function stamp(word){const el=D.stamp;el.textContent=word;el.classList.remove('go');void el.offsetWidth;el.classList.add('go');}
function banner(txt){const el=D['done-banner'];D['done-banner-txt'].textContent=txt;el.classList.remove('go');void el.offsetWidth;el.classList.add('go');}
function nextWorkAfter(i){for(let j=i+1;j<S.segs.length;j++){const s=S.segs[j];if(s.type==='work'||s.type==='warmup'||s.type==='cooldown')return s;}return null;}
function onPhase(prev,seg,jumped){
  setPhaseTheme(seg.type);
  const P=PHASES[seg.type];
  if(!jumped)stamp(P.word);
  D['s-phase-txt'].textContent=P.word;D['rc-phase'].textContent=P.word;D['rc-sub'].textContent=P.sub;
  if(seg.type==='work'){if(!jumped){AE.go();speak(seg.label);}}
  else if(seg.type==='rest'||seg.type==='gap'){if(!jumped){AE.restCue();speak(seg.type==='gap'?'Recover. Next, '+seg.nextName:'Rest');}}
  else if(seg.type==='warmup'){if(!jumped){AE.warmCue();speak(seg.label);}}
  else if(seg.type==='cooldown'){if(!jumped){AE.coolCue();speak(seg.label+'. Great work.');}}
  else if(seg.type==='prep'){AE.tick();}
  if(prev&&prev.type==='work'&&!jumped){
    const r=D['ring-tap'].getBoundingClientRect();
    FX.burst(r.left+r.width/2,r.top+r.height/2);
    banner(prev.lastSet?'EXERCISE COMPLETE':'INTERVAL COMPLETE');
  }
  let tag='',name=seg.label,next='';
  const nw=nextWorkAfter(seg.i);
  if(seg.type==='work'){tag='';name=seg.label;
    next=nw?('NEXT · '+nw.label+' · '+fmt(nw.dur)):'FINAL PUSH — EMPTY THE TANK';}
  else if(seg.type==='rest'){tag='UP NEXT'+(seg.nextSet?' · SET '+seg.nextSet+'/'+seg.sets:'');name=seg.nextName;
    next=nw?('THEN · '+nw.label):'';}
  else if(seg.type==='gap'){tag='UP NEXT'+(seg.nextRound&&seg.nextRound>seg.round?' · ROUND '+seg.nextRound:'');name=seg.nextName;
    next=nw?('THEN · '+nw.label):'';}
  else if(seg.type==='prep'){tag='FIRST UP';name=nw?nw.label:'GET READY';next='SESSION LENGTH · '+fmt(S.total);}
  else if(seg.type==='cooldown'){tag='FINAL PHASE';name=seg.label;next='ALMOST DONE — BREATHE';}
  else{tag=seg.type==='warmup'?'EASE IN':'';name=seg.label;next=nw?('FIRST INTERVAL · '+nw.label):'';}
  D['s-name-tag'].textContent=tag;D['s-name'].textContent=name.toUpperCase();D['s-next'].textContent=next.toUpperCase();
  const hasEx=seg.ex!==undefined;
  D['hud-ex'].hidden=!hasEx;D['hud-set'].hidden=!(hasEx&&seg.sets>1);D['hud-round'].hidden=!(hasEx&&config.rounds>1);
  if(hasEx){D['hud-ex'].textContent='EX '+(seg.ex+1)+'/'+config.exercises.length;
    D['hud-set'].textContent='SET '+(seg.set||1)+'/'+(seg.sets||1);
    D['hud-round'].textContent='ROUND '+(seg.round||1)+'/'+config.rounds;}
  $('#sr-live').textContent=P.word+': '+name+', '+fmt(seg.dur)+' seconds';
  $$('#s-timeline .tl-seg').forEach(el=>{const i=+el.dataset.i;
    el.classList.toggle('done',i<seg.i);el.classList.toggle('active',i===seg.i);});
}
function drawSession(now){
  if(!S)return;
  const seg=S.segs[clamp(S.idx,0,S.segs.length-1)];
  const rem=Math.max(0,seg.end-S.elapsed),frac=clamp(rem/seg.dur,0,1);
  D['ring-arc'].style.strokeDashoffset=RING_C*(1-frac);
  const tTxt=fmt(Math.ceil(rem));
  if(D['rc-time'].textContent!==tTxt)D['rc-time'].textContent=tTxt;
  const eTxt=fmt(Math.floor(S.elapsed));
  if(eTxt!==S.lastElapsedTxt){S.lastElapsedTxt=eTxt;D['hud-elapsed'].textContent=eTxt;
    document.title=tTxt+' · '+PHASES[seg.type].word+' — AFTERBURN';}
  const lTxt=fmt(Math.ceil(S.total-S.elapsed));
  if(lTxt!==S.lastLeftTxt){S.lastLeftTxt=lTxt;D['hud-left'].textContent=lTxt;}
  if(D.playhead)D.playhead.style.left=(S.elapsed/S.total*100)+'%';
  const dt=Math.min(.05,(now-lastFrame)/1000);
  FX.step(dt,S.status==='paused');
}
function frame(now){
  if(!sessionActive)return;
  advance(now);
  if(sessionActive){drawSession(now);lastFrame=now;rafId=requestAnimationFrame(frame);}
}
function togglePause(){
  if(!S||!sessionActive)return;
  if(S.status==='running'){S.status='paused';document.body.classList.add('paused');
    D['pause-ic'].setAttribute('href','#i-play');D.liveTxt.textContent='PAUSED';
    if(window.speechSynthesis)speechSynthesis.cancel();}
  else{S.status='running';S.lastTs=performance.now();document.body.classList.remove('paused');
    D['pause-ic'].setAttribute('href','#i-pause');D.liveTxt.textContent='LIVE';AE.ensure();}
}
function seek(t){
  if(!S)return;
  if(t>=S.total){S.elapsed=S.total;finish();return;}
  S.elapsed=clamp(t,0,S.total-.001);
  const seg=locate(S.elapsed);
  if(seg.i!==S.idx){const prev=S.idx>=0?S.segs[S.idx]:null;S.idx=seg.i;onPhase(prev,seg,true);}
  S.whole=Math.ceil(seg.end-S.elapsed);
  D['ring-tap'].classList.toggle('last3',S.whole<=3);
  $$('#s-timeline .tl-seg').forEach(el=>{const i=+el.dataset.i;
    el.classList.toggle('done',i<seg.i);el.classList.toggle('active',i===seg.i);});
}
function skipNext(){if(!S)return;const seg=S.segs[clamp(S.idx,0,S.segs.length-1)];AE.tick();seek(seg.end+.001);}
function skipPrev(){if(!S)return;const seg=S.segs[clamp(S.idx,0,S.segs.length-1)];AE.tick();
  if(S.elapsed-seg.start>2)seek(seg.start+.001);
  else seek(Math.max(0,(S.segs[seg.i-1]||seg).start)+.001);}
function teardownSession(){
  sessionActive=false;cancelAnimationFrame(rafId);rafId=null;
  clearInterval(logicTimer);logicTimer=null;releaseWake();
  document.body.classList.remove('paused');
  if(window.speechSynthesis)speechSynthesis.cancel();
}
function endSession(){teardownSession();S=null;showScreen('builder');toast('Session ended — the lineup is saved.','info');}
function finish(){
  if(!S||S.status==='done')return;
  S.status='done';teardownSession();
  AE.fanfare();speak('Session complete. Great work.');
  document.body.dataset.phase='done';document.title='COMPLETE 🔥 — AFTERBURN';
  showScreen('complete');
  const tl=S.tl;
  $('#done-sub').textContent=config.exercises.length+' EXERCISES · '+config.rounds+' ROUND'+(config.rounds>1?'S':'')+' · '+tl.intervals+' INTERVALS CRUSHED';
  animateVal($('#st-total'),tl.total,true);animateVal($('#st-work'),tl.work,true);animateVal($('#st-rest'),tl.rest,true);
  animateVal($('#st-int'),tl.intervals,false);animateVal($('#st-ex'),config.exercises.length,false);animateVal($('#st-rounds'),config.rounds,false);
  launchConfetti();
}
function animateVal(el,to,isTime){
  if(REDUCED){el.textContent=isTime?fmt(to):to;return;}
  const t0=performance.now(),dur=1100;
  const step=n=>{const p=Math.min(1,(n-t0)/dur),e=1-Math.pow(1-p,3),v=to*e;
    el.textContent=isTime?fmt(v):Math.round(v);
    if(p<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
}

/* ---------------- 8. confetti, complete & global events ---------------- */
let confettiRaf=null,confettiPieces=[],confettiT0=0;
function launchConfetti(){
  const cv=$('#confetti');if(REDUCED){cv.getContext('2d').clearRect(0,0,cv.width,cv.height);return;}
  const dpr=Math.min(window.devicePixelRatio||1,1.75);
  cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;
  const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  const cols=['#FF4D2E','#FF8A1E','#FFB020','#C6FF3F','#2EFFC4','#2EE6FF','#9D6BFF','#FF2E88'];
  confettiPieces=[];confettiT0=performance.now();
  const spawn=(x,y,ang,spread,n,sp)=>{for(let i=0;i<n;i++){
    const a=ang+(Math.random()-.5)*spread,v=sp*(.5+Math.random()*.7);
    confettiPieces.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*7,vr:(Math.random()-.5)*12,
      w:5+Math.random()*7,h:3+Math.random()*5,c:cols[i%cols.length],shape:Math.random()<.3?1:0});}};
  spawn(0,innerHeight*.85,-Math.PI/3.2,.9,90,900);
  spawn(innerWidth,innerHeight*.85,-Math.PI+Math.PI/3.2,.9,90,900);
  setTimeout(()=>{if(confettiRaf)spawn(innerWidth/2,-10,Math.PI/2,2.4,70,260);},900);
  cancelAnimationFrame(confettiRaf);let last=performance.now();
  const loop=n=>{
    const dt=Math.min(.04,(n-last)/1000);last=n;
    c.clearRect(0,0,innerWidth,innerHeight);
    confettiPieces=confettiPieces.filter(p=>{
      p.vy+=560*dt;p.vx*=.99;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt;
      if(p.y>innerHeight+30)return false;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.fillStyle=p.c;
      if(p.shape){c.beginPath();c.arc(0,0,p.w/2,0,7);c.fill();}
      else c.fillRect(-p.w/2,-p.h/2,p.w,p.h*(0.4+Math.abs(Math.sin(p.rot*2))*0.6));
      c.restore();return true;});
    if(n-confettiT0<5200&&confettiPieces.length)confettiRaf=requestAnimationFrame(loop);
    else{c.clearRect(0,0,innerWidth,innerHeight);confettiRaf=null;}
  };
  confettiRaf=requestAnimationFrame(loop);
}
function stopConfetti(){cancelAnimationFrame(confettiRaf);confettiRaf=null;confettiPieces=[];
  const cv=$('#confetti');cv.getContext('2d').clearRect(0,0,cv.width,cv.height);}
function fallbackCopy(txt,done){try{const ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();done();}catch(e){toast('Copy failed on this browser.','warn');}}

function refreshMuteUI(){
  const m=AE.muted;
  $('#mute-ic').setAttribute('href',m?'#i-volx':'#i-vol');
  $('#mute-txt').innerHTML=m?'MUTED':'SOUND&nbsp;ON';
  const b=$('#btn-mute');b.classList.toggle('on',!m);b.classList.toggle('off',m);
  b.setAttribute('aria-pressed',String(m));
}
const fsSupported=()=>!!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen);
function toggleFs(){
  const el=document.documentElement;
  if(document.fullscreenElement||document.webkitFullscreenElement){
    (document.exitFullscreen||document.webkitExitFullscreen).call(document).catch(()=>{});
  }else{
    const req=el.requestFullscreen||el.webkitRequestFullscreen;
    if(req)req.call(el).catch(()=>toast('Fullscreen was blocked by the browser.','warn'));
  }
}
const fsChange=()=>{const on=!!(document.fullscreenElement||document.webkitFullscreenElement);
  $('#fs-ic').setAttribute('href',on?'#i-compress':'#i-expand');
  setTimeout(()=>FX.resize(),120);};

/* ---------------- event wiring (runs once) ---------------- */
function bindEvents(){
  /* builder: stepper clicks + row actions */
  $('#screen-builder').addEventListener('click',e=>{
    const btn=e.target.closest('[data-act]');if(!btn)return;
    if(hold.suppress){hold.suppress=false;return;}
    const act=btn.dataset.act;
    if(act==='inc'||act==='dec'){applyStep(btn.closest('.step'),act==='inc'?1:-1);return;}
    const row=btn.closest('[data-id]');if(!row)return;
    const id=row.dataset.id,idx=config.exercises.findIndex(x=>x.id===id);if(idx<0)return;
    if(act==='del'){
      const removed=config.exercises.splice(idx,1)[0];renderExercises();persistSoon();
      toast('Removed '+removed.name,'warn',{label:'UNDO',fn:()=>{config.exercises.splice(Math.min(idx,config.exercises.length),0,removed);renderExercises();persistSoon();}});
    }else if(act==='dup'){
      const c=clone(config.exercises[idx]);c.id=uid();config.exercises.splice(idx+1,0,c);
      renderExercises();persistSoon();flashRow(c.id);toast('Duplicated '+c.name,'ok');
    }else if(act==='up'&&idx>0){
      [config.exercises[idx-1],config.exercises[idx]]=[config.exercises[idx],config.exercises[idx-1]];
      renderExercises();persistSoon();flashRow(id);
    }else if(act==='down'&&idx<config.exercises.length-1){
      [config.exercises[idx+1],config.exercises[idx]]=[config.exercises[idx],config.exercises[idx+1]];
      renderExercises();persistSoon();flashRow(id);
    }
  });
  /* builder: number inputs */
  $('#screen-builder').addEventListener('change',e=>{
    const inp=e.target;
    if(!inp.matches('.step input'))return;
    const stepEl=inp.closest('.step'),k=stepEl.dataset.k,L=LIMITS[k];if(!L)return;
    let v=parseInt(inp.value,10);if(isNaN(v))v=L.min;v=clamp(v,L.min,L.max);inp.value=v;
    const row=inp.closest('[data-id]');
    if(row){const ex=findEx(row.dataset.id);if(ex){ex[k]=v;updateRowChip(row,ex);}}
    else setPath(config,k,v);
    refreshSummary();persistSoon();
  });
  /* builder: name fields */
  $('#screen-builder').addEventListener('input',e=>{
    const inp=e.target;
    if(inp.matches('.ex-name')){const row=inp.closest('[data-id]');const ex=findEx(row.dataset.id);
      if(ex){ex.name=inp.value;refreshSummary();persistSoon();}}
    else if(inp.dataset.field==='warmup.name'){config.warmup.name=inp.value;refreshSummary();persistSoon();}
    else if(inp.dataset.field==='cooldown.name'){config.cooldown.name=inp.value;refreshSummary();persistSoon();}
  });
  /* builder: switches */
  $('#screen-builder').addEventListener('click',e=>{
    const sw=e.target.closest('[data-toggle]');if(!sw)return;
    const k=sw.dataset.toggle,v=!getPath(config,k);setPath(config,k,v);
    sw.setAttribute('aria-checked',String(v));refreshSummary();persistSoon();
    if(k==='voice'&&v)speak('Voice coach on');
  });
  /* hold-to-repeat steppers */
  document.addEventListener('pointerdown',e=>{
    const btn=e.target.closest('.step-btn');if(!btn)return;
    const stepEl=btn.closest('.step'),dir=btn.dataset.act==='inc'?1:-1;
    hold.t1=setTimeout(()=>{hold.t2=setInterval(()=>{hold.suppress=true;applyStep(stepEl,dir);},85);},380);
  });
  const endHold=()=>{clearTimeout(hold.t1);clearInterval(hold.t2);hold.t1=hold.t2=null;
    setTimeout(()=>{hold.suppress=false;},50);};
  document.addEventListener('pointerup',endHold);
  document.addEventListener('pointercancel',endHold);

  /* quick add */
  $('#quick-add').addEventListener('click',()=>{const i=$('#quick-name');if(addExercise(i.value))i.value='';});
  $('#quick-name').addEventListener('keydown',e=>{if(e.key==='Enter'){const i=e.target;if(addExercise(i.value))i.value='';}});

  /* drag & drop reorder */
  const exList=$('#ex-list');
  exList.addEventListener('pointerdown',e=>{
    const h=e.target.closest('.drag-handle');if(!h)return;
    h.closest('.ex-row').draggable=true;
  });
  document.addEventListener('pointerup',()=>{$$('.ex-row[draggable="true"]').forEach(r=>{if(!r.classList.contains('dragging'))r.draggable=false;});});
  exList.addEventListener('dragstart',e=>{
    const row=e.target.closest('.ex-row');if(!row){e.preventDefault();return;}
    dragId=row.dataset.id;row.classList.add('dragging');
    e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragId);}catch(err){}
  });
  exList.addEventListener('dragover',e=>{
    e.preventDefault();
    const row=e.target.closest('.ex-row');
    $$('.ex-row').forEach(r=>r.classList.remove('drop-before','drop-after'));
    if(!row||row.dataset.id===dragId)return;
    const r=row.getBoundingClientRect();
    row.classList.add(e.clientY<r.top+r.height/2?'drop-before':'drop-after');
  });
  exList.addEventListener('drop',e=>{
    e.preventDefault();
    const row=e.target.closest('.ex-row');if(!row||!dragId||row.dataset.id===dragId)return;
    const r=row.getBoundingClientRect(),after=e.clientY>=r.top+r.height/2;
    const from=config.exercises.findIndex(x=>x.id===dragId);
    const moved=config.exercises.splice(from,1)[0];
    let to=config.exercises.findIndex(x=>x.id===row.dataset.id);
    if(after)to++;
    config.exercises.splice(to,0,moved);
    renderExercises();persistSoon();flashRow(dragId);
  });
  exList.addEventListener('dragend',()=>{
    dragId=null;$$('.ex-row').forEach(r=>{r.classList.remove('dragging','drop-before','drop-after');r.draggable=false;});
  });

  /* presets & clear */
  $$('.preset').forEach(b=>b.addEventListener('click',()=>{
    const snapshot=clone(config);
    const p=clone(PRESETS[b.dataset.preset]);
    p.exercises.forEach(e=>e.id=uid());p.voice=config.voice;p.autoFullscreen=config.autoFullscreen;
    config=p;renderExercises();persistSoon();
    toast(b.textContent.trim()+' loaded','ok',{label:'UNDO',fn:()=>{config=snapshot;renderExercises();persistSoon();}});
  }));
  $('#btn-clear').addEventListener('click',()=>{
    if(!config.exercises.length)return;
    openConfirm('CLEAR THE LINEUP?','This removes all <b>'+config.exercises.length+'</b> exercises. Warm-up, cool-down and structure stay.','CLEAR ALL',()=>{
      const snapshot=clone(config.exercises);config.exercises=[];renderExercises();persistSoon();
      toast('Lineup cleared','warn',{label:'UNDO',fn:()=>{config.exercises=snapshot;renderExercises();persistSoon();}});
    });
  });

  /* library modal */
  $('#btn-lib-1').addEventListener('click',openLib);
  $('#btn-lib-2').addEventListener('click',openLib);
  $('#lib-close').addEventListener('click',closeLib);
  $('#lib-done').addEventListener('click',closeLib);
  $('#lib-search').addEventListener('input',e=>{libQ=e.target.value;renderLibGrid();});
  $('#lib-chips').addEventListener('click',e=>{const c=e.target.closest('[data-cat]');if(!c)return;libCat=c.dataset.cat;renderLibChips();renderLibGrid();});
  $('#lib-grid').addEventListener('click',e=>{
    const b=e.target.closest('[data-libidx]');if(!b)return;
    const l=LIBRARY[+b.dataset.libidx];
    addExercise(l[0],l[2]);toast('Added '+l[0],'ok');
    b.classList.add('added');setTimeout(()=>b.classList.remove('added'),700);
  });
  const libCustomAdd=()=>{const i=$('#lib-custom');if(addExercise(i.value)){toast('Added '+i.value.trim(),'ok');i.value='';}};
  $('#lib-custom-add').addEventListener('click',libCustomAdd);
  $('#lib-custom').addEventListener('keydown',e=>{if(e.key==='Enter')libCustomAdd();});

  /* confirm modal */
  $('#cf-ok').addEventListener('click',()=>{const f=confirmFn;closeConfirm();if(f)f();});
  $('#cf-cancel').addEventListener('click',closeConfirm);
  $$('.modal-bg').forEach(bg=>bg.addEventListener('click',()=>{bg.dataset.close==='lib'?closeLib():closeConfirm();}));

  /* music panels */
  $('#beats-list').addEventListener('click',e=>{
    const r=e.target.closest('[data-beat]');if(!r)return;
    const id=r.dataset.beat;
    if(music.source==='beat'&&music.trackId===id&&Beat.playing)pauseCurrent();
    else selectTrack('beat',id);
  });
  bindTrackList($('#project-list'),()=>projectTracks,'project');
  bindTrackList($('#device-list'),()=>deviceTracks,'device');
  const dz=$('#dropzone'),fi=$('#file-input');
  dz.addEventListener('click',()=>fi.click());
  fi.addEventListener('change',()=>{addDeviceFiles(fi.files);fi.value='';});
  ['dragover','dragenter'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('over');}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('over');}));
  dz.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files)addDeviceFiles(e.dataTransfer.files);});
  $$('.mtab').forEach(t=>t.addEventListener('click',()=>{
    $$('.mtab').forEach(x=>x.classList.toggle('active',x===t));
    ['beats','project','device','youtube'].forEach(p=>{$('#mpanel-'+p).hidden=p!==t.dataset.mtab;});
  }));
  $('#yt-load').addEventListener('click',()=>{
    const url=$('#yt-url').value;const id=YTMod.parse(url);
    if(!id){ytStatus('err','That doesn’t look like a YouTube link.');return;}
    music.ytUrl=url;music.ytTitle='';YTMod.load(id);
  });
  $('#yt-url').addEventListener('keydown',e=>{if(e.key==='Enter')$('#yt-load').click();});
  $('#mc-play').addEventListener('click',toggleMusic);
  $('#sm-play').addEventListener('click',toggleMusic);
  $('#mc-loop').addEventListener('click',()=>{music.loop=!music.loop;htmlAudio.loop=music.loop;
    try{if(YTMod.player&&YTMod.ready)YTMod.player.setLoop(music.loop);}catch(e){}
    refreshMusicUI();persistSoon();toast(music.loop?'Loop on':'Loop off','info');});
  const onVol=e=>{const v=clamp(+e.target.value/100,0,1);AE.ensure();AE.setVolume(v);
    $('#vol-main').value=Math.round(v*100);$('#vol-sess').value=Math.round(v*100);persistSoon();};
  $('#vol-main').addEventListener('input',onVol);
  $('#vol-sess').addEventListener('input',onVol);

  /* session controls */
  $('#btn-start').addEventListener('click',startSession);
  $('#btn-start-m').addEventListener('click',startSession);
  $('#btn-pause').addEventListener('click',togglePause);
  $('#ring-tap').addEventListener('click',togglePause);
  $('#ring-tap').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();togglePause();}});
  $('#btn-skip').addEventListener('click',skipNext);
  $('#btn-prev').addEventListener('click',skipPrev);
  $('#s-timeline').addEventListener('click',e=>{
    if(!S)return;const r=e.currentTarget.getBoundingClientRect();
    const pct=clamp((e.clientX-r.left)/r.width,0,1);AE.tick();seek(pct*S.total);
  });
  $('#btn-end').addEventListener('click',()=>{
    if(!S){showScreen('builder');return;}
    openConfirm('END THIS SESSION?','You’re <b>'+fmt(Math.floor(S.elapsed))+'</b> in with <b>'+fmt(Math.ceil(S.total-S.elapsed))+'</b> to go. The lineup stays saved.','END SESSION',endSession);
  });
  $('#brandBtn').addEventListener('click',()=>{
    if(document.body.dataset.screen==='session')$('#btn-end').click();
    else if(document.body.dataset.screen==='complete')$('#btn-edit').click();
    else window.scrollTo({top:0,behavior:REDUCED?'auto':'smooth'});
  });

  /* complete screen */
  $('#btn-again').addEventListener('click',()=>{stopConfetti();S=null;startSession();});
  $('#btn-edit').addEventListener('click',()=>{stopConfetti();S=null;showScreen('builder');});
  $('#btn-copy').addEventListener('click',()=>{
    if(!S)return;const tl=S.tl;
    const txt='🔥 AFTERBURN HIIT — '+fmt(tl.total)+' total | '+tl.intervals+' intervals | '+config.rounds+' rounds | '+
      config.exercises.length+' exercises | Work '+fmt(tl.work)+' · Rest '+fmt(tl.rest)+
      (config.warmup.on?' · Warm-up '+fmt(config.warmup.secs):'')+(config.cooldown.on?' · Cool-down '+fmt(config.cooldown.secs):'')+'. No excuses, just intervals.';
    const done=()=>toast('Summary copied to clipboard','ok');
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done).catch(()=>fallbackCopy(txt,done));
    else fallbackCopy(txt,done);
  });

  /* header */
  $('#btn-mute').addEventListener('click',()=>{AE.ensure();AE.setMuted(!AE.muted);refreshMuteUI();});
  $('#btn-fs').addEventListener('click',toggleFs);
  document.addEventListener('fullscreenchange',fsChange);
  document.addEventListener('webkitfullscreenchange',fsChange);

  /* keyboard */
  document.addEventListener('keydown',e=>{
    const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable;
    if($('#modal-confirm').classList.contains('open')){
      if(e.key==='Escape'){e.preventDefault();closeConfirm();}
      if(e.key==='Enter'){e.preventDefault();$('#cf-ok').click();}
      return;
    }
    if($('#modal-lib').classList.contains('open')){
      if(e.key==='Escape'){e.preventDefault();closeLib();}
      return;
    }
    if(typing)return;
    const scr=document.body.dataset.screen;
    if(e.key==='m'||e.key==='M'){AE.ensure();AE.setMuted(!AE.muted);refreshMuteUI();return;}
    if(e.key==='f'||e.key==='F'){if(fsSupported())toggleFs();return;}
    if(scr==='session'){
      if(e.code==='Space'){e.preventDefault();togglePause();}
      else if(e.key==='ArrowRight'){e.preventDefault();skipNext();}
      else if(e.key==='ArrowLeft'){e.preventDefault();skipPrev();}
      else if(e.key==='Escape'){$('#btn-end').click();}
    }else if(scr==='complete'){
      if(e.target.closest('button,a,input'))return;
      if(e.code==='Space'||e.key==='Enter'){e.preventDefault();$('#btn-again').click();}
      else if(e.key==='Escape')$('#btn-edit').click();
    }
  });

  /* lifecycle */
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){
      AE.ensure();
      if(sessionActive){advance(performance.now());lastFrame=performance.now();acquireWake();}
    }
  });
  window.addEventListener('resize',()=>{FX.resize();});
  window.addEventListener('beforeunload',e=>{
    if(S&&(S.status==='running'||S.status==='paused')){e.preventDefault();e.returnValue='';}
  });
  document.addEventListener('pointerdown',function unlock(){AE.ensure();document.removeEventListener('pointerdown',unlock);},{once:true});
}

/* shared mutable handles */
const hold={t1:null,t2:null,suppress:false};
let dragId=null;

/* ---------------- init ---------------- */
loadState();
cacheSessionDom();
buildTicks();
renderExercises();
renderBeats();
renderTrackList($('#project-list'),projectTracks,'project',$('#project-empty'));
renderTrackList($('#device-list'),deviceTracks,'device');
loadProjectTracks();
if(music.source==='beat'&&!BEATS.find(b=>b.id===music.trackId))music.trackId='afterburn';
if(music.source==='youtube'&&music.ytUrl){$('#yt-url').value=music.ytUrl;music.userPaused=true;}
if(!fsSupported())$('#btn-fs').hidden=true;
htmlAudio.volume=music.volume;htmlAudio.loop=music.loop;
refreshMuteUI();
refreshMusicUI();
refreshSummary();
bindEvents();
