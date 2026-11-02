(() => {
  'use strict';
  document.querySelectorAll('[data-language]').forEach(select => select.addEventListener('change',()=>location.assign(select.value)));
  const area=document.querySelector('.reading'); if(!area)return;
  const messages=JSON.parse(document.querySelector('#translations').textContent);
  const t=(key,...args)=>(messages[key]||key).replace(/\{(\d+)\}/g,(_,i)=>String(args[i]));
  const $=s=>document.querySelector(s);
  const engine=new ScrollCadenceCore.Engine({now:()=>performance.now(),frame:f=>requestAnimationFrame(f),cancelFrame:id=>cancelAnimationFrame(id),setTimer:(f,ms)=>setTimeout(f,ms),clearTimer:id=>clearTimeout(id)},snapshot=>{
    $('.demo-status').textContent=t(({running:'Running',countdown:'Countdown',paused:'Paused',stopped:'Stopped',completed:'Completed',error:'Needs attention',ready:'Ready'})[snapshot.state] || 'Ready');
    $('#start').textContent=t(snapshot.state==='running'||snapshot.state==='countdown'?'Pause':snapshot.state==='paused'?'Resume':'Start');
  });
  engine.setTarget({connected:()=>area.isConnected,canScroll:d=>['left','right'].includes(d)?area.scrollWidth>area.clientWidth:area.scrollHeight>area.clientHeight,viewport:h=>h?area.clientWidth:area.clientHeight,position:h=>h?area.scrollLeft:area.scrollTop,move:(h,delta)=>area.scrollBy({left:h?delta:0,top:h?0:delta,behavior:'instant'})});
  let settings={direction:'down',mode:'continuous',speed:40,interval:3,countdown:0,pageFraction:.9};
  function configure(patch){settings={...settings,...patch};engine.configure(settings);document.querySelectorAll('[data-direction]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.direction===settings.direction)));document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===settings.mode)));$('#interval-setting').hidden=settings.mode!=='paged';$('#speed').closest('label').hidden=settings.mode==='paged';$('#speed-output').textContent=t('{0} CSS px / second',settings.speed);}
  configure({});
  document.querySelectorAll('[data-direction]').forEach(b=>b.addEventListener('click',()=>{configure({direction:b.dataset.direction});const h=['left','right'].includes(settings.direction);if((settings.direction==='up'&&area.scrollTop===0)||(settings.direction==='left'&&area.scrollLeft===0))area.scrollTo({left:h?area.scrollWidth:area.scrollLeft,top:h?area.scrollTop:area.scrollHeight,behavior:'instant'});}));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>configure({mode:b.dataset.mode})));
  $('#speed').addEventListener('input',e=>configure({speed:Number(e.target.value)}));
  $('#interval').addEventListener('change',e=>configure({interval:Number(e.target.value)}));
  $('#start').addEventListener('click',()=>{if(engine.state==='running'||engine.state==='countdown')engine.pause();else if(engine.state==='paused')engine.resume();else engine.start();});
  $('#stop').addEventListener('click',()=>engine.stop());
  for(const name of ['wheel','touchmove','keydown'])area.addEventListener(name,()=>{if(engine.state==='running')engine.pause(t('Manual interaction; paused.'));},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&engine.state==='running')engine.pause();});
  window.addEventListener('pagehide',()=>engine.stop());
})();
