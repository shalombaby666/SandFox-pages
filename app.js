/* SandFox controls and a fixed 60 Hz simulation, independent of rendering. */
(()=>{
'use strict';
const {World,M,COLORS,SCENES}=QuietEngine;
const $=id=>document.getElementById(id),canvas=$('world'),cursor=$('cursor'),cc=cursor.getContext('2d');
const w=384,h=240,world=new World(w,h,918271),scenery=new SandFoxScenery(canvas);
const materials=[
  ['Песок',M.SAND,'песка','сыпучий','Ускоряется в падении, собирается в дюны, тонет в воде.','Лава + песок → стекло'],
  ['Вода',M.WATER,'воды','жидкость','Течёт по склонам и заполняет низины. Тяжелее масла, легче песка.','Вода + лава → камень + пар'],
  ['Огонь',M.FIRE,'огня','горение','Поднимается, зажигает дерево, растения, масло и газ. Оставляет дым и пепел.','Огонь + лёд → вода'],
  ['Лава',M.LAVA,'лавы','вязкая жидкость','Тяжёлая, горячая и тягучая. Постепенно застывает в камень.','Песок → стекло · вода → пар'],
  ['Камень',M.STONE,'камня','твёрдый','Неподвижная опора. Построй стенку, чашу или русло для ручья.','Удерживает воду и песок'],
  ['Газ',M.GAS,'газа','горючий газ','Поднимается и дрейфует по ветру. При воспламенении даёт маленькую вспышку.','Газ + огонь → вспышка'],
  ['Дерево',M.WOOD,'дерева','горючая опора','Греется и горит на месте, пока есть топливо. В сыром тёплом месте постепенно перегнивает.','Тепло → пепел · сырость → компост'],
  ['Пар',M.STEAM,'пара','газ','Уносится тёплым воздухом. Остывая, становится каплями; в живом мире пополняет облака.','Испарение → облака → дождь'],
  ['Земля',M.SOIL,'земли','почва','Держит форму и служит опорой для семян. Построй грядку и полей её.','Земля + семя + вода → росток'],
  ['Снег',M.SNOW,'снега','лёгкий порошок','Мягко оседает на склонах. Рядом с горячими материалами превращается в воду.','Снег + тепло → вода'],
  ['Лёд',M.ICE,'льда','замёрзшая опора','Прозрачные неподвижные стенки. Тают при соприкосновении с огнём и лавой.','Лёд + тепло → вода'],
  ['Масло',M.OIL,'масла','горючая жидкость','Легче воды: всплывает отдельным слоем. Хорошо растекается и горит.','Масло + огонь → пламя'],
  ['Растение',M.PLANT,'зелени','живое','Тянется вверх, ветвится и выпускает листья. Запас роста ограничен.','С огнём сгорает'],
  ['Семена',M.SEED,'семян','живое','Падают на землю. Капля воды рядом пробуждает маленький сад.','Семя + почва + вода → растение'],
  ['Дым',M.SMOKE,'дыма','газ','Дрейфует по ветру, поднимается и рассеивается. Не превращается в дождь.','Появляется после горения'],
  ['Пепел',M.ASH,'пепла','лёгкий порошок','Оседает после горения. Горячий пепел отдаёт тепло, а намокший остывший пепел обогащает почву.','Пепел + вода → компост'],
  ['Стекло',M.GLASS,'стекла','прозрачная опора','Сохраняет форму и пропускает цвет пейзажа. Подходит для сосудов.','Получается из песка в лаве'],
  ['Компост',M.COMPOST,'компоста','плодородная почва','Получается из намокшего пепла и гниющей органики. Сохраняет влагу и питает ростки.','Влага + семя → новая жизнь'],
  ['Ластик',0,'пустоты','инструмент','Стирает физические материалы. Фон и декорации остаются на месте.','Правая кнопка мыши тоже стирает']
];
let material=M.SAND,brush=5,paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let quality='auto',tempo=.4,focus=false,pointer=null,previous=null,paintPoint=null,erase=false;
let sceneTime=0,toastTimer,dirty=true,animationTime=0;
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2300);}
function selectMaterial(id){
  material=id;const item=materials.find(m=>m[1]===id);
  $('selected-name').textContent=item[2];$('material-title').textContent=item[0];$('material-type').textContent=item[3];
  $('material-description').textContent=item[4];$('material-reaction').textContent=item[5];
  document.querySelectorAll('.material').forEach(b=>{const selected=Number(b.dataset.material)===id;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
}
materials.forEach(([name,id])=>{
  const b=document.createElement('button');b.className='material';b.dataset.material=id;
  b.innerHTML=`<span class="swatch" style="background:${id?`rgb(${COLORS[id].join(',')})`:'#35464b'}">${id?'':'×'}</span><span>${name}</span>`;
  b.title=name+(id<=9?` (${id})`:'');b.onclick=()=>selectMaterial(id);$('materials').append(b);
});
SCENES.forEach(scene=>{
  const b=document.createElement('button');b.className='scene';b.dataset.scene=scene.id;
  b.innerHTML=`<canvas width="384" height="240" aria-hidden="true"></canvas><span><b>${scene.name}</b><small>${scene.desc}</small></span><span class="mark"></span>`;
  const previewWorld=new World(w,h,42);previewWorld.reset(scene.id);
  const preview=new SandFoxScenery(b.querySelector('canvas'));preview.build(scene.id);preview.thumbnail(previewWorld);
  b.onclick=()=>loadScene(scene.id);$('scenes').append(b);
});
function releasePointer(){pointer=null;previous=null;paintPoint=null;}
function loadScene(id){
  releasePointer();world.reset(id);sceneTime=0;animationTime=0;scenery.build(id);dirty=true;
  document.body.classList.remove('show-places');
  const s=SCENES.find(s=>s.id===world.scene);$('scene-name').textContent=s.name;$('weather-label').textContent=s.caption;$('world-logic').textContent=s.climate;
  $('cycle-label').textContent=' · '+s.phase[0];
  document.querySelectorAll('.scene').forEach(b=>{const active=b.dataset.scene===world.scene;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));b.querySelector('.mark').textContent=active?'●':'';});
  render();
}
const roomContext=$('room-window').getContext('2d');roomContext.imageSmoothingEnabled=false;
function render(){scenery.render(world,animationTime);roomContext.drawImage(canvas,0,0,160,100);dirty=false;}
function position(e){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(w-1,(e.clientX-r.left)/r.width*w)),y:Math.max(0,Math.min(h-1,(e.clientY-r.top)/r.height*h))};}
function drawAt(p){const m=erase?0:material;world.disk(p.x,p.y,brush,m,m===0);dirty=true;}
function drawStroke(p){
  if(previous){const dx=p.x-previous.x,dy=p.y-previous.y,n=Math.ceil(Math.hypot(dx,dy)/Math.max(1,brush*.4));for(let i=0;i<=n;i++)drawAt({x:previous.x+dx*i/(n||1),y:previous.y+dy*i/(n||1)});}else drawAt(p);
  previous=p;paintPoint=p;
}
function drawCursor(p){
  cc.clearRect(0,0,w,h);if(!p)return;cc.fillStyle='#e0e5bd';
  for(let n=0;n<Math.max(16,brush*7);n++){const a=n/Math.max(16,brush*7)*Math.PI*2;cc.fillRect(Math.round(p.x+Math.cos(a)*brush),Math.round(p.y+Math.sin(a)*brush),1,1);}
}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(pointer!==null||e.button>2)return;e.preventDefault();canvas.focus();pointer=e.pointerId;erase=e.button===2;previous=null;canvas.setPointerCapture(e.pointerId);drawStroke(position(e));render();});
canvas.addEventListener('pointermove',e=>{const p=position(e);drawCursor(p);const i=Math.floor(p.x)+Math.floor(p.y)*w,m=world.cells[i];$('probe').textContent=m?(materials.find(item=>item[1]===m)[0]+' · '+Math.round(world.temperature[i])+'°C'):'';if(pointer===e.pointerId){drawStroke(p);if(paused)render();}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(pointer===e.pointerId)releasePointer();});
canvas.addEventListener('pointerleave',()=>{drawCursor(null);$('probe').textContent='';});window.addEventListener('blur',releasePointer);
document.addEventListener('visibilitychange',()=>{releasePointer();last=0;accumulator=0;});
$('brush').oninput=e=>{brush=Number(e.target.value);$('brush-value').value=brush+' px';};
function setPause(value){paused=value;accumulator=0;$('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Продолжить':'Пауза');$('pause').title=paused?'Продолжить (Пробел)':'Пауза (Пробел)';$('stats').textContent=paused?'пауза':'60 fps';dirty=true;}
$('pause').onclick=()=>setPause(!paused);
function restart(){loadScene(world.scene);toast('Новая история в знакомом месте');}
$('reset').onclick=restart;$('new-world').onclick=restart;
$('ambient').onclick=()=>{world.ambient=!world.ambient;$('ambient').classList.toggle('active',world.ambient);$('ambient').setAttribute('aria-pressed',String(world.ambient));toast(world.ambient?'Погода и круговорот включены':'Источники выключены · мир в твоих руках');};
$('intensity').onchange=e=>{world.intense=e.target.value==='wild';};
$('quality').onchange=e=>{quality=e.target.value;adaptive=60;slow=0;};
$('tempo').onchange=e=>{tempo=Number(e.target.value);};
function setFocus(value){focus=value;document.body.classList.toggle('focus',focus);document.body.classList.remove('show-places','show-options','hide-tools');$('focus').setAttribute('aria-label',focus?'Вернуть интерфейс':'Режим фона');if(focus){toast('F / Esc — выйти · H — кисти');if(!document.fullscreenElement&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{});}else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}
$('focus').onclick=()=>setFocus(!focus);
$('focus-locations').onclick=()=>document.body.classList.toggle('show-places');
$('focus-settings').onclick=()=>{document.body.classList.toggle('show-options');document.body.classList.remove('hide-tools');};
$('focus-tools').onclick=()=>document.body.classList.toggle('hide-tools');
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&focus)setFocus(false);});
$('snapshot').onclick=()=>{render();canvas.toBlob(blob=>{if(!blob){toast('Не удалось сохранить снимок');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='sandfox-'+world.scene+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Маленький мир сохранён');});};
$('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();
document.addEventListener('keydown',e=>{
  if(e.code==='Escape'&&!$('help-dialog').open&&focus){e.preventDefault();setFocus(false);return;}
  if($('help-dialog').open||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable||(e.target.tagName==='BUTTON'&&e.code==='Space'))return;
  if(e.code==='Space'){e.preventDefault();setPause(!paused);}else if(e.code==='KeyF')setFocus(!focus);else if(e.code==='KeyH'&&focus)document.body.classList.toggle('hide-tools');else if(e.code==='Escape')setFocus(false);else if(e.code==='KeyR')restart();
  else if(/^Digit[0-9]$/.test(e.code))selectMaterial(Number(e.code.slice(-1)));
  else if(e.code==='BracketLeft'||e.code==='BracketRight'){$('brush').value=Math.max(1,Math.min(18,brush+(e.code==='BracketLeft'?-1:1)));$('brush').dispatchEvent(new Event('input'));}
});
const STEP=1000/60;
let last=0,accumulator=0,lastPaint=0,frames=0,statTime=0,adaptive=60,slow=0,physicsCost=0;
function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden){last=0;accumulator=0;return;}
  const elapsed=last?Math.min(now-last,80):0;last=now;
  const start=performance.now();let steps=0;
  if(!paused){
    accumulator=Math.min(accumulator+elapsed*tempo,STEP*5);
    while(accumulator>=STEP&&steps<5){if(pointer!==null&&paintPoint)drawAt(paintPoint);world.step();accumulator-=STEP;steps++;}
    animationTime+=elapsed*tempo/1000;sceneTime+=elapsed/1000;
    if($('autocycle').checked&&sceneTime>=120)loadScene(SCENES[(SCENES.findIndex(s=>s.id===world.scene)+1)%SCENES.length].id);
  }else accumulator=0;
  physicsCost=performance.now()-start;
  const fps=quality==='eco'?30:quality==='smooth'?60:adaptive;
  if(now-lastPaint<1000/fps-.8)return;
  // Retain the fractional remainder instead of drifting to a lower frame rate.
  lastPaint=now-((now-lastPaint)%(1000/fps));
  const paintStart=performance.now();if(!paused||dirty)render();
  const cost=physicsCost+performance.now()-paintStart;
  if(quality==='auto'){slow=cost>13?Math.min(50,slow+2):Math.max(0,slow-1);if(slow>18)adaptive=30;else if(slow<3)adaptive=60;}
  frames++;if(now-statTime>=1000){$('stats').textContent=paused?'пауза':Math.round(frames*1000/(now-statTime))+' fps'+(fps===30?' · эко':'');frames=0;statTime=now;const s=SCENES.find(s=>s.id===world.scene);$('cycle-label').textContent=' · '+s.phase[Math.floor(world.tick/1800)%s.phase.length];}
}
selectMaterial(M.SAND);loadScene('forest');setPause(paused);requestAnimationFrame(frame);
window.quietDebug={world,render,get paused(){return paused;},get quality(){return quality;},get tempo(){return tempo;},get physicsCost(){return physicsCost;},get targetFPS(){return quality==='eco'?30:quality==='smooth'?60:adaptive;}};
})();
