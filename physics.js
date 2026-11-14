/* Bounded thermal diffusion and discrete hydrostatic surface balancing. */
(function(root){
'use strict';
const CAPACITY=new Float32Array([1,1,4,.2,2,2,.2,1.5,.8,2,2,2,2,1,1,.3,1.2,2,2]);
const CONDUCTIVITY=new Float32Array([0,.10,.16,.08,.12,.17,.03,.05,.04,.12,.08,.20,.08,.06,.06,.02,.06,.13,.10]);
class WorldPhysics {
  constructor(world,M){
    this.world=world;this.M=M;const n=world.cells.length;
    this.temperature=new Float32Array(n);this.phase=new Float32Array(n);this.burning=new Uint16Array(n);
    this.damp=new Uint16Array(n);this.rot=new Uint16Array(n);
    this.boundWater=new Uint16Array(n);
    this.seen=new Uint32Array(n);this.queue=new Uint32Array(n);this.stamp=0;this.scan=0;
    world.temperature=this.temperature;world.burning=this.burning;
  }
  reset(){this.temperature.fill(this.ambient());this.phase.fill(0);this.burning.fill(0);this.damp.fill(0);this.rot.fill(0);this.boundWater.fill(0);this.scan=0;}
  ambient(){return this.world.scene==='snow'?-8:this.world.scene==='volcano'?28:18;}
  onSet(i,m){
    const M=this.M;this.temperature[i]=m===M.LAVA?1180:m===M.FIRE?650:m===M.STEAM?110:m===M.SMOKE?80:m===M.ICE?-12:m===M.SNOW?-8:m===M.WATER?Math.max(3,this.ambient()):this.ambient();
    this.phase[i]=0;this.burning[i]=0;this.damp[i]=0;this.rot[i]=0;this.boundWater[i]=0;
  }
  swap(i,j){let v=this.temperature[j];this.temperature[j]=this.temperature[i];this.temperature[i]=v;v=this.phase[j];this.phase[j]=this.phase[i];this.phase[i]=v;v=this.burning[j];this.burning[j]=this.burning[i];this.burning[i]=v;v=this.damp[j];this.damp[j]=this.damp[i];this.damp[i]=v;v=this.rot[j];this.rot[j]=this.rot[i];this.rot[i]=v;v=this.boundWater[j];this.boundWater[j]=this.boundWater[i];this.boundWater[i]=v;}
  exchangeHeat(i,j,scale=1){
    const a=this.world.cells;if(!a[i]||!a[j])return;
    const heat=(this.temperature[i]-this.temperature[j])*Math.min(CONDUCTIVITY[a[i]],CONDUCTIVITY[a[j]])*scale;
    this.temperature[i]-=heat/CAPACITY[a[i]];this.temperature[j]+=heat/CAPACITY[a[j]];
  }
  change(i,m,t){const w=this.world,stored=this.boundWater[i];w.set(i%w.w,Math.floor(i/w.w),m);this.temperature[i]=t;if(m)this.boundWater[i]=stored;}
  thermalStep(){
    const w=this.world,a=w.cells,width=w.w,M=this.M,T=this.temperature,air=this.ambient();
    for(let i=0;i<a.length;i++)if(a[i]){
      if(i%width<width-1&&a[i+1])this.exchangeHeat(i,i+1);
      if(i+width<a.length&&a[i+width])this.exchangeHeat(i,i+width);
      if(!a[i-width]||!a[i+width]||i%width===0||i%width===width-1)T[i]+=(air-T[i])*.003;
    }
    for(let i=0;i<a.length;i++){
      const m=a[i];if(!m)continue;const t=T[i];
      if(m===M.FIRE){T[i]=Math.max(570,t);continue;}
      if(m===M.ICE||m===M.SNOW){
        if(t>0){this.phase[i]+=t*2;T[i]=0;if(this.phase[i]>32)this.change(i,M.WATER,2);}
      }else if(m===M.WATER){
        if(t>100){this.phase[i]+=(t-100)*4;T[i]=100;if(this.phase[i]>80)this.change(i,M.STEAM,105);}
        else if(t<0){this.phase[i]+=t*4;T[i]=0;if(this.phase[i]<-32)this.change(i,M.ICE,-2);}
      }else if(m===M.STEAM&&t<55)this.change(i,M.WATER,Math.max(1,t));
      else if(m===M.LAVA&&t<650)this.change(i,M.STONE,t);
      else if(m===M.SAND&&t>850)this.change(i,M.GLASS,t);
      else if(m===M.WOOD&&t>280&&!this.burning[i])this.burning[i]=360;
      else if((m===M.OIL&&t>230)||(m===M.GAS&&t>190)||(m===M.PLANT&&t>180)||(m===M.SEED&&t>180))this.change(i,M.FIRE,650);
    }
  }
  burnStep(i){
    if(!this.burning[i])return;
    const w=this.world,M=this.M,x=i%w.w,y=Math.floor(i/w.w);
    if(this.temperature[i]<120){this.burning[i]=0;return;}
    this.burning[i]--;this.temperature[i]=Math.min(640,this.temperature[i]+9);
    if(w.tick%8===0)w.emit(x,y-1,M.FIRE);
    if(w.tick%35===0)w.emit(x+(w.tick%2?1:-1),y-1,M.SMOKE);
    if(!this.burning[i])this.change(i,M.ASH,180);
  }
  ecologyStep(){
    const w=this.world,a=w.cells,M=this.M,width=w.w;
    for(let i=0;i<a.length;i++){
      const m=a[i];
      if(this.boundWater[i]>0&&this.temperature[i]>55&&i>=width&&!a[i-width]){w.set(i%width,Math.floor(i/width)-1,M.STEAM);this.temperature[i-width]=98;this.boundWater[i]--;}
      if(m!==M.ASH&&m!==M.WOOD&&m!==M.PLANT&&m!==M.COMPOST&&m!==M.SOIL)continue;
      const x=i%width;let water=-1;
      if(x>0&&a[i-1]===M.WATER)water=i-1;else if(x<width-1&&a[i+1]===M.WATER)water=i+1;else if(i>=width&&a[i-width]===M.WATER)water=i-width;else if(i+width<a.length&&a[i+width]===M.WATER)water=i+width;
      if(water>=0)this.damp[i]=240;else if(this.damp[i]>0)this.damp[i]--;
      if(m===M.ASH&&water>=0&&this.temperature[i]<90){this.change(i,M.COMPOST,Math.min(60,this.temperature[water]));this.damp[i]=240;continue;}
      if((m===M.WOOD||m===M.PLANT)&&this.damp[i]>80&&this.temperature[i]>3&&this.temperature[i]<50&&!this.burning[i]){
        this.rot[i]++;if(this.rot[i]>(m===M.WOOD?500:240)){this.change(i,M.COMPOST,18);this.damp[i]=200;}
      }
      if(m===M.PLANT&&this.damp[i]>0&&w.life[i]<60&&i+width<a.length&&a[i+width]===M.COMPOST){w.life[i]+=120;this.change(i+width,M.SOIL,18);}
      // Re-seeding a mature damp garden keeps growth and decay cycling, with a cap.
      if(m===M.COMPOST&&this.damp[i]>100&&i>=width&&!a[i-width]&&w.scene==='garden'&&w.ambient&&w.tick%480===0){w.set(x,Math.floor(i/width)-1,M.SEED);}
    }
  }
  balanceWater(){
    // Surface transfer follows a connected water path, never through a partition.
    // This approximates incompressible pressure without expensive fluid equations.
    const w=this.world,a=w.cells,width=w.w,M=this.M,n=a.length;
    this.stamp=(this.stamp+1)>>>0;if(!this.stamp){this.seen.fill(0);this.stamp=1;}
    const stamp=this.stamp;let visited=0,transfers=0;
    for(let offset=0;offset<n&&visited<8192&&transfers<4;offset++){
      const start=(this.scan+offset)%n;if(a[start]!==M.WATER||this.seen[start]===stamp)continue;
      let head=0,tail=1,high=-1,low=-1;this.queue[0]=start;this.seen[start]=stamp;
      while(head<tail&&visited<8192){
        const i=this.queue[head++],x=i%width,y=Math.floor(i/width);visited++;
        if(y>0&&!a[i-width]){if(high<0||i<high)high=i;if(low<0||i>low)low=i;}
        for(let d=0;d<4;d++){
          if((d===0&&x===0)||(d===1&&x===width-1))continue;
          const j=i+(d===0?-1:d===1?1:d===2?-width:width);
          if(j<0||j>=n||a[j]!==M.WATER||this.seen[j]===stamp)continue;
          this.seen[j]=stamp;this.queue[tail++]=j;
        }
      }
      if(high>=0&&low>=0&&Math.floor(low/width)-Math.floor(high/width)>1){
        const target=low-width,temperature=this.temperature[high],phase=this.phase[high];
        this.change(high,0,this.ambient());this.change(target,M.WATER,temperature);this.phase[target]=phase;transfers++;
      }
    }
    this.scan=(this.scan+Math.floor(n/7))%n;
  }
}
const api={WorldPhysics,CAPACITY};root.SandFoxPhysics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
