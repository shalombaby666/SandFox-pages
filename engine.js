/* SandFox cellular physics. Fixed-size arrays; no framework or network access. */
(function(root) {
'use strict';
const {WorldPhysics}=typeof module!=='undefined'?require('./physics.js'):root.SandFoxPhysics;
const M = {EMPTY:0,SAND:1,WATER:2,FIRE:3,LAVA:4,STONE:5,GAS:6,WOOD:7,STEAM:8,SOIL:9,
  SNOW:10,ICE:11,OIL:12,PLANT:13,SEED:14,SMOKE:15,ASH:16,GLASS:17,COMPOST:18};
const COLORS = [[0,0,0],[220,190,125],[65,153,184],[255,177,74],[243,109,51],
  [100,115,112],[166,186,135],[132,92,60],[181,211,208],[117,111,75],
  [221,234,231],[137,202,214],[164,124,61],[110,157,85],[182,141,82],
  [127,134,140],[133,129,120],[154,197,181],[107,91,65]];
const SCENES = [
  {id:'forest',name:'Лесной дождь',desc:'Прохлада и шелест листвы',caption:'капли на хвое, свет в окне',climate:'Дождь → ручьи → туман',sky:['#203a48','#294b55','#385c60','#526e66'],phase:['вечерний дождь','туман у воды','светлячки в траве']},
  {id:'brook',name:'Мшистый ручей',desc:'Каскады и тёплая мельница',caption:'вода бежит, колесо крутится',climate:'Родник → каскады → заводь',sky:['#344857','#49606a','#637b79','#899184'],phase:['шёпот родника','солнечные просветы','вода на камнях']},
  {id:'cove',name:'Янтарная бухта',desc:'Прилив у старого маяка',caption:'маяк подмигивает морю',climate:'Прилив ↔ отлив, морской бриз',sky:['#49405c','#725268','#a07172','#bf927f'],phase:['прилив','высокая вода','отлив']},
  {id:'snow',name:'Снежный приют',desc:'Снег за тёплым окном',caption:'снаружи снежно, внутри чай',climate:'Снег → сугробы, лёд + тепло → вода',sky:['#2c3853','#414e6b','#5f7387','#8c9aab'],phase:['пушистый снег','северное сияние','следы у крыльца']},
  {id:'garden',name:'Сад после дождя',desc:'Семена тянутся к свету',caption:'ещё один маленький росток',climate:'Вода + семя + земля → растение',sky:['#3c4656','#596372','#7a8a8a','#a1b09a'],phase:['утренний свет','тёплый дождь','сад растёт']},
  {id:'volcano',name:'Тёплый вулкан',desc:'Искры в вечернем небе',caption:'гора дышит, угли светятся',climate:'Лава + вода → камень + пар',sky:['#332c45','#50374c','#784951','#a56759'],phase:['гора дремлет','горячее дыхание','россыпь искр']},
  {id:'hourglass',name:'Песочные часы',desc:'Медленное течение времени',caption:'песок течёт, мысли отдыхают',climate:'Песок возвращается наверх',sky:['#293747','#3e4b5c','#566678','#788483'],phase:['песчаная река','золотая россыпь','ещё один круг']},
  {id:'free',name:'Свободный мир',desc:'Начни с одного пикселя',caption:'а что случится, если?..',climate:'Твои материалы, твои правила',sky:['#293e4c','#3a525c','#526b6b','#77877a'],phase:['чистый лист','место для открытий','твой маленький мир']}
];
const isGas = m => m===M.GAS||m===M.STEAM||m===M.SMOKE||m===M.FIRE;
const isLiquid = m => m===M.WATER||m===M.OIL||m===M.LAVA;
const isPowder = m => m===M.SAND||m===M.SNOW||m===M.SEED||m===M.ASH||m===M.COMPOST;
const DENSITY = new Uint8Array([0,8,5,1,6,0,1,0,1,0,3,0,3,0,4,1,2,0,6]);

class World {
  constructor(w=384,h=240,seed=12345) {
    this.w=w; this.h=h; this.seed=seed>>>0||1; this.tick=0;
    this.cells=new Uint8Array(w*h); this.life=new Uint16Array(w*h);
    this.moved=new Uint32Array(w*h); this.velocity=new Uint8Array(w*h);
    this.drift=new Int8Array(w*h); this.terrain=new Uint8Array(w*h);
    this.physics=new WorldPhysics(this,M);
    this.intense=false; this.ambient=true; this.wind=0; this.reset('forest');
  }
  random() {let s=this.seed;s^=s<<13;s^=s>>>17;s^=s<<5;this.seed=s>>>0;return this.seed/4294967296;}
  set(x,y,m,life) {
    x=Math.floor(x);y=Math.floor(y);if(x<0||x>=this.w||y<0||y>=this.h)return;
    const i=x+y*this.w;this.cells[i]=m;
    this.life[i]=life===undefined?(m===M.FIRE?70+Math.floor(this.random()*60):m===M.STEAM?600:m===M.SMOKE?220:m===M.LAVA?2400:m===M.PLANT?160:0):life;
    this.velocity[i]=0;this.drift[i]=0;this.moved[i]=this.tick;this.physics.onSet(i,m);
  }
  disk(x,y,r,m,replace=false) {
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(dx*dx+dy*dy<=r*r) {
      const xx=Math.floor(x+dx),yy=Math.floor(y+dy);
      if(xx>=0&&xx<this.w&&yy>=0&&yy<this.h&&(replace||!this.cells[xx+yy*this.w]))this.set(xx,yy,m);
    }
  }
  line(x,y,a,b,m) {const n=Math.ceil(Math.max(Math.abs(a-x),Math.abs(b-y)));for(let k=0;k<=n;k++)this.set(x+(a-x)*k/(n||1),y+(b-y)*k/(n||1),m);}
  reset(scene) {
    if(!SCENES.some(s=>s.id===scene))scene='free';
    this.scene=scene;this.tick=0;this.cells.fill(0);this.life.fill(0);this.velocity.fill(0);this.drift.fill(0);this.moved.fill(0);this.physics.reset();
    this.cloudWater=scene==='brook'?1200:scene==='forest'?700:scene==='garden'?300:scene==='snow'?450:0;
    this.oceanWater=5000;
    const w=this.w,h=this.h,sx=w/384,sy=h/240;
    const put=(x,y,m)=>this.set(x*sx,y*sy,m);
    const line=(x,y,a,b,m)=>this.line(x*sx,y*sy,a*sx,b*sy,m);
    const ground=(height,surface=M.SOIL)=>{for(let x=0;x<w;x++){const g=Math.floor(height(x/sx)*sy);for(let y=Math.max(0,g);y<h;y++)this.set(x,y,y<g+4*sy?surface:M.STONE);}};
    const fill=(x1,y1,x2,y2,m)=>{for(let y=Math.floor(y1*sy);y<y2*sy;y++)for(let x=Math.floor(x1*sx);x<x2*sx;x++)this.set(x,y,m);};
    if(scene==='forest') {
      ground(x=>185+Math.sin(x*.031)*9+Math.sin(x*.09)*3);
      for(let x=Math.floor(100*sx);x<290*sx;x++)for(let y=Math.floor(164*sy);y<(207+Math.sin((x/sx-100)/190*Math.PI)*16)*sy;y++)this.set(x,y,y>199*sy?M.WATER:0);
      line(10,154,83,154,M.STONE);line(10,153,83,153,M.SOIL);line(292,166,374,166,M.STONE);line(292,165,374,165,M.SOIL);
      for(const [x,y] of [[40,153],[72,153],[319,165],[348,165]])fill(x,y-22,x+3,y,M.WOOD);
      // Foreground trees are material, not a painted obstacle behind the particles.
      for(const [x,y,size]of[[40,151,70],[72,151,45],[319,163,58],[348,163,82]])for(let tier=0;tier<4;tier++){
        const top=y-size+tier*size*.18,half=size*(.13+tier*.065);
        for(let row=0;row<size*.32;row+=2){const width=half*row/(size*.32);for(let xx=x-width;xx<=x+width;xx++)for(let yy=top+row;yy<top+row+2;yy++)if(!this.cells[Math.floor(xx*sx)+Math.floor(yy*sy)*w]){put(xx,yy,M.PLANT);this.life[Math.floor(xx*sx)+Math.floor(yy*sy)*w]=0;}}
      }
    } else if(scene==='brook') {
      ground(x=>x<92?128+Math.sin(x*.06)*3:x<187?164+Math.sin(x*.05)*3:x<281?194+Math.sin(x*.07)*3:224+Math.sin(x*.04)*3);
      for(const [a,b,y,depth] of [[0,92,119,13],[92,187,157,12],[187,281,187,12],[281,384,214,14]])
        for(let x=Math.floor(a*sx);x<b*sx;x++)for(let yy=Math.floor(y*sy);yy<(y+depth)*sy;yy++)this.set(x,yy,yy>(y+3)*sy?M.WATER:0);
      line(139,150,178,150,M.WOOD);line(143,151,143,163,M.WOOD);line(175,151,175,163,M.WOOD);
    } else if(scene==='cove') {
      ground(x=>x<122?175+x*.13+Math.sin(x*.04)*3:192+Math.min(35,(x-122)*.18),M.SAND);
      for(let x=Math.floor(105*sx);x<w;x++)for(let y=Math.floor(192*sy);y<h;y++)if(!this.cells[x+y*w])this.set(x,y,M.WATER);
      line(67,182,151,182,M.WOOD);line(84,183,84,208,M.WOOD);line(135,183,135,219,M.WOOD);
    } else if(scene==='snow') {
      ground(x=>191+Math.sin(x*.023)*10+Math.sin(x*.071)*3,M.ICE);
      for(let x=0;x<w;x++){const y=Math.floor((188+Math.sin(x/sx*.023)*10+Math.sin(x/sx*.071)*3)*sy);for(let j=0;j<4*sy;j++)this.set(x,y+j,M.SNOW);}
      for(let x=Math.floor(161*sx);x<242*sx;x++) {
        const bed=Math.floor((204+Math.sin((x/sx-161)/81*Math.PI)*13)*sy);
        for(let y=Math.floor(177*sy);y<bed;y++)this.set(x,y,y>201*sy?M.WATER:0);
        this.set(x,bed,M.ICE);
      }
    } else if(scene==='garden') {
      ground(x=>211+Math.sin(x*.025)*2);
      for(const [a,b,y] of [[29,114,181],[144,229,172],[258,352,186]]) {
        fill(a,y,b,y+7,M.SOIL);line(a-2,y+7,b+2,y+7,M.WOOD);line(a-2,y-1,a-2,y+7,M.WOOD);line(b+2,y-1,b+2,y+7,M.WOOD);
        for(let x=a+9;x<b-3;x+=15){put(x,y-1,M.SEED);put(x+1,y-1,M.WATER);}
      }
    } else if(scene==='volcano') {
      ground(x=>220-79*Math.exp(-(((x-204)/69)**2))+Math.sin(x*.14)*2,M.STONE);
      fill(196,139,211,240,M.LAVA);fill(0,217,68,240,M.WATER);
    } else if(scene==='hourglass') {
      line(85,58,299,58,M.GLASS);line(85,58,186,136,M.GLASS);line(299,58,198,136,M.GLASS);line(186,136,85,218,M.GLASS);line(198,136,299,218,M.GLASS);line(85,218,299,218,M.GLASS);
      for(let y=Math.floor(62*sy);y<122*sy;y++)for(let x=0;x<w;x++) {
        const inset=(y/sy-58)*101/78;
        if(x>(85+inset)*sx+1&&x<(299-inset)*sx-1&&!this.cells[x+y*w])this.set(x,y,M.SAND);
      }
    } else ground(()=>232);
    for(let i=0;i<this.cells.length;i++)this.terrain[i]=(this.cells[i]===M.STONE||this.cells[i]===M.ICE||this.cells[i]===M.GLASS)?1:0;
  }
  swap(i,j) {
    let v=this.cells[j];this.cells[j]=this.cells[i];this.cells[i]=v;
    v=this.life[j];this.life[j]=this.life[i];this.life[i]=v;
    v=this.velocity[j];this.velocity[j]=this.velocity[i];this.velocity[i]=v;
    v=this.drift[j];this.drift[j]=this.drift[i];this.drift[i]=v;
    this.physics.swap(i,j);
    this.moved[j]=this.tick;this.moved[i]=this.tick;
  }
  canDisplace(m,other) {return !other||(isGas(other)&&!isGas(m))||(isLiquid(other)&&DENSITY[m]>DENSITY[other]);}
  emit(x,y,m) {const i=Math.floor(x)+Math.floor(y)*this.w;if(x>=0&&x<this.w&&y>=0&&y<this.h&&!this.cells[i])this.set(x,y,m);}
  ambientStep() {
    const {w,h,cells:a}=this,scale=this.intense?2:1;
    if(this.scene==='forest'||this.scene==='garden') {
      const rain=this.tick%3===0?(this.scene==='forest'?scale*2:(this.tick%2400<850?scale:0)):0;
      for(let k=0;k<rain&&this.cloudWater>0;k++){const x=Math.floor(this.random()*w);if(!a[x+5*w]){this.set(x,5,M.WATER);this.cloudWater--;}}
      if(this.tick%8===0)for(let k=0;k<4*scale;k++){
        const x=Math.floor(this.random()*w);
        for(let y=Math.floor(h*.66);y<h*.97;y++){const i=x+y*w;if(a[i]===M.WATER&&!a[i-w]){this.set(x,y,M.STEAM);this.temperature[i]=98;break;}}
      }
    } else if(this.scene==='brook') {
      for(let n=0;n<scale*2&&this.cloudWater>0;n++){const x=Math.floor(w*(.025+this.random()*.09)),y=Math.floor(h*.47);if(!a[x+y*w]){this.set(x,y,M.WATER);this.cloudWater--;}}
      for(let n=0;n<32*scale;n++){const i=Math.floor(w*(.77+this.random()*.23))+Math.floor(h*(.88+this.random()*.11))*w;if(a[i]===M.WATER){a[i]=0;this.cloudWater++;}}
    } else if(this.scene==='cove') {
      const surface=Math.floor(h*(.802+Math.sin(this.tick/900)*.022));
      for(let n=0;n<6*scale&&this.oceanWater>0;n++){const x=w-1-Math.floor(this.random()*8),y=surface+Math.floor(this.random()*Math.max(1,h-surface)),i=x+y*w;if(!a[i]){this.set(x,y,M.WATER);this.oceanWater--;}}
      for(let n=0;n<25;n++){const x=Math.floor(w*(.35+this.random()*.65)),y=Math.floor(h*(.76+this.random()*.19)),i=x+y*w;if(y<surface&&a[i]===M.WATER){a[i]=0;this.oceanWater++;}}
    } else if(this.scene==='snow') {
      if(this.tick%4===0)for(let k=0;k<scale&&this.cloudWater>0;k++){const x=Math.floor(this.random()*w);if(!a[x+3*w]){this.set(x,3,M.SNOW);this.cloudWater--;}}
      for(let k=0;k<20;k++){const i=Math.floor(this.random()*w)+Math.floor(h*(.76+this.random()*.22))*w;if(a[i]===M.SNOW&&!this.terrain[i]&&this.random()<.35){a[i]=0;this.cloudWater++;}}
    } else if(this.scene==='volcano') {
      if(this.tick%(this.intense?3:7)===0)this.disk(w*.531,h*.59,this.intense?3:2,M.LAVA,true);
      if(this.tick%12===0)this.emit(w*(.49+this.random()*.08),h*.56,M.GAS);
      if(this.tick%10===0)for(let n=0;n<140;n++){const i=Math.floor(this.random()*w)+Math.floor(h*(.64+this.random()*.35))*w;if(!this.terrain[i]&&(a[i]===M.LAVA||a[i]===M.STONE))a[i]=0;}
    } else if(this.scene==='hourglass') {
      for(let k=0;k<scale*5;k++){const i=Math.floor(w*(.27+this.random()*.46))+Math.floor(h*(.65+this.random()*.25))*w;
        if(a[i]===M.SAND)for(let n=0;n<12;n++){const x=Math.floor(w*(.36+this.random()*.28)),y=Math.floor(h*.27);if(!a[x+y*w]){a[i]=0;this.set(x,y,M.SAND);break;}}
      }
    }
    if(this.tick%24===0) {
      const chimney={forest:[35,151],brook:[139,126],snow:[68,150],garden:[336,138]}[this.scene];
      if(chimney)this.emit(chimney[0]/384*w,chimney[1]/240*h,M.SMOKE);
    }
  }
  reactHeat(i,x,y,m) {
    const a=this.cells,w=this.w;
    for(let d=0;d<4;d++) {
      if((d===0&&x===0)||(d===1&&x===w-1))continue;
      const j=i+(d===0?-1:d===1?1:d===2?-w:w);if(j<0||j>=a.length)continue;
      if(a[j])this.physics.exchangeHeat(i,j,.65);
    }
  }
  grow(i,x,y) {
    const a=this.cells,w=this.w;if(this.life[i]<24||this.tick%16)return;
    const dir=this.random()<.5?-1:1,nx=x+(this.random()<.55?0:dir),ny=y-1;
    if(ny<2||nx<1||nx>=w-1||a[nx+ny*w])return;
    const energy=this.life[i];this.life[i]=Math.max(0,energy-40);
    this.set(nx,ny,M.PLANT,Math.floor(energy*.65));
    if(energy>90&&x+dir>0&&x+dir<w-1&&!a[i+dir])this.set(x+dir,y,M.PLANT,0);
  }
  step() {
    this.tick++;this.wind=Math.sin(this.tick/650)*.6;
    if(this.ambient)this.ambientStep();
    if(this.tick%4===0)this.physics.thermalStep();
    if(this.tick%8===0)this.physics.balanceWater();
    if(this.tick%16===0)this.physics.ecologyStep();
    const w=this.w,h=this.h,a=this.cells,reverse=this.tick&1;
    for(let y=h-1;y>=0;y--)for(let k=0;k<w;k++) {
      const x=reverse?w-1-k:k,i=x+y*w,m=a[i];
      if(!m||this.moved[i]===this.tick)continue;
      if(m===M.WOOD){this.physics.burnStep(i);continue;}
      if(m===M.STONE||m===M.SOIL||m===M.ICE||m===M.GLASS)continue;
      if(m===M.PLANT){this.grow(i,x,y);continue;}
      if(m===M.FIRE||m===M.LAVA){this.reactHeat(i,x,y,m);if(a[i]!==m)continue;}
      if(m===M.SEED&&y<h-1&&(a[i+w]===M.SOIL||a[i+w]===M.PLANT||a[i+w]===M.COMPOST)) {
        const water=x>0&&a[i-1]===M.WATER?i-1:x<w-1&&a[i+1]===M.WATER?i+1:y>0&&a[i-w]===M.WATER?i-w:-1;
        if(water>=0||this.physics.damp[i+w]>0){let stored=0;if(water>=0){a[water]=0;stored=1;}else if(this.physics.boundWater[i+w]>0){this.physics.boundWater[i+w]--;stored=1;}this.set(x,y,M.PLANT,240);this.physics.boundWater[i]=stored;continue;}
      }
      if(m===M.FIRE||m===M.SMOKE||m===M.LAVA) {
        if(this.life[i]>0)this.life[i]--;
        if(!this.life[i]){const t=this.temperature[i],next=m===M.LAVA?M.STONE:m===M.FIRE?(this.random()<.35?M.ASH:M.SMOKE):0;if(!next&&this.physics.boundWater[i]){this.cloudWater+=this.physics.boundWater[i];this.physics.boundWater[i]=0;}this.physics.change(i,next,m===M.LAVA?Math.min(t,640):Math.min(t,180));continue;}
      }
      if(isGas(m)) {
        if(y<=2){const bound=this.physics.boundWater[i];if(m===M.STEAM&&this.ambient){this.cloudWater+=1+bound;this.set(x,y,0);}else if(m===M.STEAM)this.physics.change(i,M.WATER,18);else {this.cloudWater+=bound;this.set(x,y,0);}continue;}
        if(m===M.SMOKE&&this.tick%2)continue;
        const breeze=this.wind+Math.sin(y*.035+this.tick/800)*.35+Math.sin(x*.021-this.tick/1000)*.2;
        const dir=breeze>.1?1:breeze<-.1?-1:((i+this.tick)%7<3?-1:1),up=i-w;
        if(x+dir>=0&&x+dir<w&&!a[up+dir]&&(!a[up]||!a[i+dir])&&((i+this.tick)%3===0)){this.swap(i,up+dir);continue;}
        if(!a[up]){this.swap(i,up);continue;}
        if(x+dir>=0&&x+dir<w&&!a[up+dir]&&!a[i+dir]){this.swap(i,up+dir);continue;}
        if(x+dir>=0&&x+dir<w&&!a[i+dir]&&this.tick%2===0)this.swap(i,i+dir);
        continue;
      }
      if(!isLiquid(m)&&!isPowder(m))continue;
      if((m===M.LAVA&&this.tick%3)||(m===M.OIL&&this.tick%2))continue;
      if(m===M.SNOW&&this.tick%2)continue;
      if(y===h-1){this.velocity[i]=0;continue;}
      const below=i+w;
      if(this.canDisplace(m,a[below])) {
        // Walk every cell on the path: acceleration never tunnels through walls.
        let j=i,steps=Math.min(m===M.SNOW||m===M.ASH||m===M.LAVA?1:m===M.WATER||m===M.OIL?2:3,1+(this.velocity[i]>>1));
        for(let n=0;n<steps&&j+w<a.length;n++) {
          if(!this.canDisplace(m,a[j+w]))break;
          const other=a[j+w];this.swap(j,j+w);j+=w;if(other)break;
        }
        this.velocity[j]=Math.min(6,this.velocity[j]+1);continue;
      }
      this.velocity[i]=0;const dir=this.drift[i]||(this.random()<.5?-1:1);
      if(x+dir>=0&&x+dir<w&&this.canDisplace(m,a[i+dir])&&this.canDisplace(m,a[below+dir])){this.drift[i]=dir;this.swap(i,below+dir);continue;}
      if(x-dir>=0&&x-dir<w&&this.canDisplace(m,a[i-dir])&&this.canDisplace(m,a[below-dir])){this.drift[i]=-dir;this.swap(i,below-dir);continue;}
      if(isLiquid(m)) {
        let flowed=false;
        for(let d=0;d<2;d++) {
          const direction=d?-dir:dir;let target=i,limit=m===M.WATER?4:m===M.OIL?3:1;
          for(let n=1;n<=limit;n++){if(x+direction*n<0||x+direction*n>=w||a[i+direction*n])break;target=i+direction*n;if(y<h-1&&!a[target+w])break;}
          if(target!==i){this.drift[i]=direction;this.swap(i,target);flowed=true;break;}
        }
        if(!flowed)this.drift[i]=-dir;
      }
    }
  }
}
const api={World,M,COLORS,SCENES};root.QuietEngine=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
