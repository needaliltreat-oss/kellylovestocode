/* Shared behaviour for the inner pages (About and the six Work pages), 12 Nov 2026.
   The same effects as the home page, because Kelly asked for "Full effects everywhere" (E517): the loader, the hamburger-to-heart icon, the full-screen menu with
   links that fall and stack and a Settings section holding the light / dark toggle, the page title falling in with real physics on the cobalt-to-signal scale with the
   same hover glow one step along it, the text arriving word by word at different sizes (AK4), and the screens arriving as you reach them.
   Nothing here is a new design choice. Every number is a placeholder. */
(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],root=document.documentElement,body=document.body;
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const C={cob:"#2448d8",sig:"#ff6a2b"};
const mix=(a,b,t)=>`color-mix(in oklch, ${b} ${Math.round(clamp(t)*100)}%, ${a})`;
const GSTEP=.22;                       /* the hover glow sits this far along the scale from the word's own colour (placeholder, same as the home page) */
const bandColour=yn=>yn<=0?C.cob:yn>=1?C.sig:mix(C.cob,C.sig,yn);

/* ── skin (E130): follows the device until the toggle in the menu is used ── */
const st={skin:"auto"},mq=matchMedia("(prefers-color-scheme: dark)");
const skin=()=>st.skin!=="auto"?st.skin:(root.dataset.theme==="dark"?"dark":root.dataset.theme==="light"?"light":(mq.matches?"dark":"light"));
const SUN=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg>`;
const MOON=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.2A8.4 8.4 0 1 1 9.8 4a6.9 6.9 0 0 0 10.2 10.2z"/></svg>`;
const CLASSIC="M12 21.3s-7.6-4.7-10.1-9.4C.2 8.6 1.9 4.6 5.6 4.2c2.4-.3 4.3 1 6.4 3.3 2.1-2.3 4-3.6 6.4-3.3 3.7.4 5.4 4.4 3.7 7.7C19.6 16.6 12 21.3 12 21.3z";
const HEART=`<svg viewBox="0 0 24 24"><path d="${CLASSIC}" fill="none" stroke="#ff6a2b" stroke-width="2.6" stroke-linejoin="round"/></svg>`;   /* HT4, her pick */
const ARROWL=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`;
let skinSw=null;
function syncSkinSw(){if(!skinSw)return;const dark=skin()==="dark",next=dark?"Light":"Dark";
 skinSw.querySelector(".si").innerHTML=dark?SUN:MOON;
 skinSw.querySelector(".sl1").textContent=next+" mode";skinSw.querySelector(".sl2").textContent=next+" mode";
 skinSw.setAttribute("aria-checked",String(dark));skinSw.setAttribute("aria-label","Dark mode")}
function applySkin(){body.dataset.skin=skin();syncSkinSw();paintWords()}
mq.addEventListener("change",applySkin);
new MutationObserver(applySkin).observe(root,{attributes:true,attributeFilter:["data-theme"]});

/* ── the top bar and the menu are built here, so every page carries the same ones (E536: "back to work and the menu on but i want it animated") ── */
/* every page says how far it sits from the site's root (data-root on <body>), so the links work both on the live site and when a file is opened straight from the folder */
const R=body.dataset.root||"/";
const LINKS=[["Work",R+"#work"],["About",R+"about/"],["Contact",R+"contact/"]];   /* 12 Nov: Contact opens its own page now */
function chrome(){
 const back=$(".back");
 if(back)back.innerHTML=`<span class="ba" aria-hidden="true">${ARROWL}${ARROWL}</span><span class="r"><span>Back to Work</span><span aria-hidden="true">Back to Work</span></span>`;
 const bar=$(".topbar");if(!bar)return;
 const b=document.createElement("button");b.type="button";b.id="menuBtn";b.setAttribute("aria-label","Open menu");b.setAttribute("aria-expanded","false");b.setAttribute("aria-controls","menu");
 b.innerHTML=`<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="nh" aria-hidden="true">${HEART}</span>`;bar.append(b);
 const m=document.createElement("div");m.id="menu";m.hidden=true;m.setAttribute("role","dialog");m.setAttribute("aria-modal","true");m.setAttribute("aria-label","Menu");
 m.innerHTML=`<button type="button" id="menuClose" aria-label="Close menu">&#10005;</button><nav id="mstage" aria-label="Main">`
  +LINKS.map(([t,h])=>`<a href="${h}"><span class="r"><span>${t}</span><span aria-hidden="true">${t}</span></span></a>`).join("")
  +`</nav><div id="mset"><p class="mslab">Settings</p><button type="button" class="btn" id="skinSw" role="switch" aria-checked="false"><span class="si" aria-hidden="true"></span><span class="r"><span class="sl1"></span><span class="sl2" aria-hidden="true"></span></span><span class="sw" aria-hidden="true"><i></i></span></button></div>`;
 body.append(m);
 skinSw=$("#skinSw");skinSw.addEventListener("click",()=>{st.skin=skin()==="dark"?"light":"dark";applySkin()});
 b.addEventListener("click",openMenu);$("#menuClose").addEventListener("click",closeMenu);
 addEventListener("keydown",e=>{if(e.key==="Escape"&&m.classList.contains("open"))closeMenu()})}

/* the menu links fall and stack and rest at 24% of the screen (MN2, ML2) */
let mEng=null,mRaf=0,mLinks=[],mDown=null;
function stopMenuPhys(){cancelAnimationFrame(mRaf);if(mEng&&window.Matter)Matter.Engine.clear(mEng);mEng=null}
function menuPhys(){stopMenuPhys();const stg=$("#mstage"),links=$$("#mstage a"),W=stg.clientWidth,H=stg.clientHeight,lift=Math.round(H*.24);
 if(!window.Matter||reduce){let y=H*.2;links.forEach(a=>{a.style.transform=`translate(${Math.max(16,W*.06)}px,${y}px)`;y+=a.offsetHeight});return}
 const {Engine,Bodies,Composite,Mouse,MouseConstraint}=Matter;mEng=Engine.create();mEng.gravity.y=1.2;mEng.positionIterations=10;
 Composite.add(mEng.world,[Bodies.rectangle(W/2,H-lift+200,W*3,400,{isStatic:true}),Bodies.rectangle(-200,H/2,400,H*4,{isStatic:true}),Bodies.rectangle(W+200,H/2,400,H*4,{isStatic:true})]);
 mLinks=links.map((a,i)=>{const bw=a.offsetWidth,bh=a.offsetHeight;
  const b=Bodies.rectangle(W*.08+bw/2+Math.random()*Math.max(1,W*.5-bw/2),-bh*(1+i*1.2),bw,bh,{chamfer:{radius:10},restitution:.25,friction:.6,angle:(Math.random()-.5)*.4});
  Composite.add(mEng.world,b);return {a,b,bw,bh}});
 const mouse=Mouse.create(stg);["mousewheel","DOMMouseScroll","wheel"].forEach(ev=>mouse.element.removeEventListener(ev,mouse.mousewheel));
 Composite.add(mEng.world,MouseConstraint.create(mEng,{mouse,constraint:{stiffness:.2,render:{visible:false}}}));
 let last=performance.now();const loop=now=>{const dt=Math.min(32,now-last);last=now;Engine.update(mEng,dt);
  mLinks.forEach(l=>{const p=l.b.position;l.a.style.transform=`translate(${p.x-l.bw/2}px,${p.y-l.bh/2}px) rotate(${l.b.angle}rad)`});mRaf=requestAnimationFrame(loop)};
 mRaf=requestAnimationFrame(loop)}
function openMenu(){const m=$("#menu"),btn=$("#menuBtn"),r=btn.getBoundingClientRect();
 m.style.setProperty("--mx",(r.left+r.width/2)+"px");m.style.setProperty("--my",(r.top+r.height/2)+"px");
 m.hidden=false;void m.offsetWidth;m.classList.add("open");btn.setAttribute("aria-expanded","true");body.classList.add("locked");
 $$("#mstage a").forEach(a=>a.style.transform="translate(-9999px,0)");setTimeout(menuPhys,250);
 setTimeout(()=>$("#menuClose").focus({preventScroll:true}),300)}
function closeMenu(){const m=$("#menu"),btn=$("#menuBtn");m.classList.remove("open");btn.setAttribute("aria-expanded","false");body.classList.remove("locked");
 setTimeout(()=>{if(!m.classList.contains("open")){m.hidden=true;stopMenuPhys()}},800);btn.focus({preventScroll:true})}
addEventListener("pointerdown",e=>{if(e.target.closest("#mstage"))mDown={x:e.clientX,y:e.clientY}});
addEventListener("click",e=>{const a=e.target.closest("#mstage a");if(!a)return;
 if(mDown&&Math.hypot(e.clientX-mDown.x,e.clientY-mDown.y)>6)e.preventDefault()},true);

/* ── the page title: its words fall in and land, with the same physics and the same colour scale as the home page ── */
let pEng=null,pRaf=0,pItems=[],pTimers=[],pStage=null,pH=0;
function paintWords(){pItems.forEach(t=>{if(!t.body)return;const yn=clamp(t.body.position.y/Math.max(1,pH));
 const c=bandColour(yn),gy=yn<.5?Math.min(1,yn+GSTEP):Math.max(0,yn-GSTEP);
 t.el.style.setProperty("--wc",c);t.el.style.setProperty("--glow",bandColour(gy))})}
function titlePhys(){pStage=$(".ptrack");if(!pStage)return;
 const words=$$(".pw");if(!words.length)return;
 if(!window.Matter||reduce){words.forEach(w=>{w.classList.add("on","flat");w.style.setProperty("--wc",bandColour(.5))});return}
 const {Engine,Bodies,Composite,Body,Mouse,MouseConstraint,Events}=Matter;
 const W=pStage.clientWidth,H=pH=pStage.clientHeight;
 pEng=Engine.create();pEng.gravity.y=1.1;pEng.positionIterations=10;pEng.velocityIterations=8;
 const wall=400;Composite.add(pEng.world,[Bodies.rectangle(W/2,H+wall/2,W*3,wall,{isStatic:true}),Bodies.rectangle(-wall/2,0,wall,H*6,{isStatic:true}),Bodies.rectangle(W+wall/2,0,wall,H*6,{isStatic:true})]);
 pItems=words.map((el,i)=>({el,i,bw:el.offsetWidth,bh:el.offsetHeight,body:null}));
 const by=new Map();
 const drop=t=>{const x=t.bw/2+Math.random()*Math.max(1,W-t.bw),y0=-t.bh*1.3-Math.random()*H*.3;
  t.body=Bodies.rectangle(x,y0,t.bw,t.bh,{chamfer:{radius:Math.min(8,t.bh*.12)},restitution:.2+Math.random()*.12,friction:.5,frictionAir:.008+Math.random()*.03,angle:(Math.random()-.5)*.5});
  Body.setVelocity(t.body,{x:(Math.random()-.5)*2,y:Math.random()*4});by.set(t.body,t);Composite.add(pEng.world,t.body);t.el.classList.add("on")};
 const mouse=Mouse.create(pStage);["mousewheel","DOMMouseScroll","wheel"].forEach(ev=>mouse.element.removeEventListener(ev,mouse.mousewheel));
 ["touchstart","touchmove","touchend"].forEach(ev=>{mouse.element.removeEventListener(ev,mouse.mousedown);mouse.element.removeEventListener(ev,mouse.mousemove);mouse.element.removeEventListener(ev,mouse.mouseup)});
 const mc=MouseConstraint.create(pEng,{mouse,constraint:{stiffness:.2,render:{visible:false}}});Composite.add(pEng.world,mc);
 Events.on(mc,"startdrag",e=>{const t=by.get(e.body);if(t)t.el.classList.add("hot")});
 Events.on(mc,"enddrag",e=>{const t=by.get(e.body);if(t)setTimeout(()=>t.el.classList.remove("hot"),400)});
 words.forEach(el=>{el.addEventListener("pointerenter",()=>el.classList.add("hot"));el.addEventListener("pointerleave",()=>el.classList.remove("hot"))});
 pItems.forEach((t,i)=>pTimers.push(setTimeout(()=>drop(t),260+i*150+Math.random()*120)));
 let last=performance.now();
 const loop=now=>{const dt=Math.min(32,now-last);last=now;Engine.update(pEng,dt);
  pItems.forEach(t=>{if(!t.body)return;const p=t.body.position;t.el.style.transform=`translate(${p.x-t.bw/2}px,${p.y-t.bh/2}px) rotate(${t.body.angle}rad)`});
  paintWords();pRaf=requestAnimationFrame(loop)};
 pRaf=requestAnimationFrame(loop)}

/* ── the text arrives word by word at different sizes (AK4, her pick) ── */
function kinetic(){
 $$("[data-kin]").forEach(p=>{if(p.dataset.done)return;
  p.dataset.src=p.dataset.src||p.textContent;
  p.innerHTML=p.dataset.src.split(" ").map(w=>`<span class="kw">${w}</span>`).join(" ")});
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting||e.target.dataset.done)return;e.target.dataset.done="1";
  const ws=[...e.target.querySelectorAll(".kw")];
  if(reduce){ws.forEach(w=>w.style.opacity=1);return}
  ws.forEach(w=>{w.style.opacity=0;
   const sc=[.2,.35,2.4,3,.5,1.9,.28][Math.floor(Math.random()*7)];
   const an=w.animate([{transform:`scale(${sc})`,opacity:0},{transform:`scale(${sc>1?.82:1.25})`,opacity:1,offset:.55},{transform:"scale(1)",opacity:1}],
    {duration:700,delay:Math.random()*700,easing:"cubic-bezier(.34,1.5,.5,1)",fill:"both"});
   an.finished.then(()=>{w.style.opacity=1;w.style.transform="";an.cancel()},()=>{})})}),{threshold:.35});
 $$("[data-kin]").forEach(p=>io.observe(p))}

/* ── the grey screens arrive as you reach them ── */
function shots(){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.2});
 $$(".shot").forEach((s,i)=>{s.style.transitionDelay=(i%3)*.09+"s";io.observe(s)})}

/* ── the loader, as on the home page ── */
function circlePts(r){const pts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;pts.push(`${(50+Math.cos(a)*r).toFixed(2)}% ${(50+Math.sin(a)*r*innerWidth/innerHeight).toFixed(2)}%`)}return pts.join(", ")}
function opening(done){const L=$("#loader");if(!L||reduce){if(L)L.classList.add("done");body.classList.remove("locked");done();return}
 body.classList.add("locked");
 let t0=null;const hold=260,dur=900;
 const step=now=>{if(!t0)t0=now;const e=now-t0-hold;if(e<0){requestAnimationFrame(step);return}
  const k=clamp(e/dur),ease=1-Math.pow(1-k,4);
  L.style.clipPath=`polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${circlePts(ease*90)})`;
  if(k<1)requestAnimationFrame(step);else{L.classList.add("done");body.classList.remove("locked");done()}};
 requestAnimationFrame(step)}

chrome();applySkin();kinetic();shots();
opening(()=>{titlePhys()});
let rzT=0;
addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(!pEng)return;
 cancelAnimationFrame(pRaf);pTimers.forEach(clearTimeout);pTimers=[];
 if(window.Matter)Matter.Engine.clear(pEng);pEng=null;
 pItems.forEach(t=>{t.el.style.transform="";t.el.classList.remove("on")});pItems=[];titlePhys()},250)});
})();
