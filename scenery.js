/* Hand-built pixel vocabulary, procedural landscapes, small living details. */
(function(root){
'use strict';
const {M,COLORS,SCENES}=root.QuietEngine;
const W=384,H=240;
const ROCK={forest:[78,99,95],brook:[84,109,105],cove:[137,129,115],snow:[100,125,143],garden:[90,106,93],volcano:[87,79,90],hourglass:[100,115,112],free:[100,115,112]};
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
class Scenery {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.image=this.ctx.createImageData(W,H);this.noise=new Int8Array(W*H);for(let i=0;i<this.noise.length;i++)this.noise[i]=((Math.imul(i%W,374761393)^Math.imul(Math.floor(i/W),668265263))>>>12)%13-6;this.build('forest');}
  build(id){
    this.id=id;this.scene=SCENES.find(s=>s.id===id);this.lamps=[];
    const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d',{willReadFrequently:true});this.bg=g;
    const r=rng(48219+SCENES.indexOf(this.scene)*173);
    const rect=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(Math.floor(x),Math.floor(y),Math.ceil(w),Math.ceil(h));};
    const palette=this.scene.sky;
    // Smaller colour steps avoid broad, hard horizon bands without smoothing pixels.
    const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    for(let y=0;y<H;y+=3){const f=y/H*3,j=Math.min(2,Math.floor(f)),a=rgb(palette[j]),b=rgb(palette[j+1]),t=f-j;rect(0,y,W,3,`rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`);}
    const day=id==='garden'||id==='brook';
    for(let n=0;n<(day?12:50);n++)rect(r()*W,r()*110,1,1,n%4?'#889b9e':'#d9ddbf');
    if(day){rect(285,27,17,21,'#e3d3a3');rect(282,31,23,13,'#e3d3a3');}
    else {rect(288,27,15,22,'#dedcbd');rect(285,31,21,14,'#dedcbd');rect(285,28,10,15,palette[0]);}
    if(id==='cove'){
      for(let layer=0;layer<2;layer++)for(let x=115;x<W;x+=2){const y=159+layer*12+Math.sin(x*.04+layer)*3;rect(x,y,2,H-y,layer?'#50616c':'#635c74');}
      for(let n=0;n<9;n++){const x=30+r()*330,y=35+r()*80;rect(x,y,4,1,'#514d63');rect(x+4,y+1,2,1,'#514d63');rect(x+6,y,4,1,'#514d63');}
    }else for(let layer=0;layer<3;layer++){
      const colors=id==='snow'?['#728798','#566f87','#415d73']:id==='volcano'?['#694653','#4c3947','#343341']:['#426264','#315258','#24444b'];
      for(let x=0;x<W;x+=2){let y=115+layer*23+Math.sin(x*.019+layer*2)*16+Math.sin(x*.043+layer)*8;if(id==='volcano')y-=Math.max(0,42-Math.abs(x-205)*.43);rect(x,y,2,H-y,colors[layer]);if(id==='snow'&&layer===0&&y<107)rect(x,y,2,3,'#b7c8cd');}
    }
    const tree=(x,y,size,color,snow=false)=>{
      rect(x-1,y-size*.65,3,size*.7,color);
      for(let j=0;j<4;j++){const yy=y-size+j*size*.18,half=size*(.13+j*.065);for(let k=0;k<size*.32;k+=2){const wid=half*(k/(size*.32));rect(x-wid,yy+k,wid*2+1,2,color);if(snow&&k<size*.09)rect(x-wid,yy+k,wid*2+1,1,'#bdcfd0');}}
    };
    const cabin=(x,y,scale=1,snow=false)=>{
      const p=(a,b,w,h,c)=>rect(x+a*scale,y+b*scale,w*scale,h*scale,c);
      p(0,0,27,23,'#6f6954');for(let j=1;j<5;j++)p(0,j*4,27,1,'#81745b');p(-2,-2,31,3,'#48483f');
      for(let j=0;j<11;j++){p(-4+j,-3-j,35-j*2,2,'#835e4a');if(snow)p(-4+j,-4-j,35-j*2,1,'#d1dcd4');}
      p(20,-14,4,9,'#665e58');p(2,8,7,15,'#394440');p(15,7,8,8,'#edce8d');p(18,7,1,8,'#ab946b');p(15,10,8,1,'#ab946b');p(-3,23,34,2,'#475145');
      this.lamps.push([x+19*scale,y+11*scale,12]);
    };
    const lamp=(x,y)=>{rect(x,y,1,18,'#625f4a');rect(x-3,y-3,7,7,'#6e674c');rect(x-2,y-2,5,5,'#e6cc8f');rect(x-4,y-4,9,1,'#46534b');this.lamps.push([x,y,13]);};
    if(id==='forest'){
      for(let n=0;n<22;n++)tree(n*19+r()*9,154+r()*10,34+r()*26,'#294c4e');
      cabin(15,165);lamp(83,173);lamp(299,178);
      for(let n=0;n<32;n++){const x=r()*W;if(x>99&&x<295)continue;const y=184+Math.sin(x*.031)*9+Math.sin(x*.09)*3;rect(x,y-2,2,3,'#adc18a');if(n%4===0){rect(x-1,y-4,4,2,'#c18c72');rect(x,y-2,1,2,'#dfd2b0');}}
    }else if(id==='brook'){
      for(let n=0;n<25;n++)tree(n*16,130+n*.1,25+r()*28,'#395e55');
      cabin(119,140,.9);lamp(170,135);
      for(let x=5;x<85;x+=9){rect(x,116,3,5,'#789b69');rect(x+1,114,1,3,'#a1b57d');}
      rect(247,174,30,4,'#957453');rect(251,177,3,15,'#675a48');
    }else if(id==='snow'){
      for(let n=0;n<22;n++)tree(n*19,179+Math.sin(n)*5,35+r()*40,'#486778',true);
      cabin(42,168,1.25,true);lamp(104,179);
      for(let n=0;n<12;n++){rect(95+n*4,199+Math.sin(n*.6)*2,2,1,'#8198a1');}
    }else if(id==='garden'){
      cabin(314,154,1.1);lamp(248,173);
      for(let x=0;x<W;x+=12){rect(x,198,2,15,'#7c8d71');rect(x+1,197,1,2,'#a7b38a');}rect(0,202,W,2,'#7c8d71');
      for(let n=0;n<14;n++){const x=r()*W;rect(x,206,2,5,'#809f64');rect(x-1,204,4,2,n%2?'#d2b784':'#c6a0a0');}
      rect(12,169,9,12,'#82745d');rect(10,170,13,2,'#b7a17b');
    }else if(id==='cove'){
      // A striped lighthouse, jetty and warm fishing-house window.
      rect(35,107,17,68,'#c5b7a0');rect(33,133,21,13,'#976e63');rect(34,105,19,4,'#776a61');rect(31,101,25,4,'#4e5159');rect(35,93,17,8,'#dbbd80');rect(41,91,4,11,'#766959');
      for(let n=0;n<8;n++)rect(31+n,92-n,25-n*2,1,'#715d59');rect(41,160,6,15,'#675e58');this.lamps.push([44,97,18]);
      cabin(5,157,.7);lamp(106,164);
      rect(250,179,18,3,'#726960');rect(253,182,12,2,'#726960');rect(258,164,1,15,'#b0ac96');rect(260,164,1,12,'#d4c4a1');
    }else if(id==='hourglass'){
      rect(76,52,232,5,'#b1aa8f');rect(76,220,232,6,'#b1aa8f');rect(80,57,4,163,'#6f817b');rect(300,57,4,163,'#6f817b');rect(69,226,246,4,'#364b4e');lamp(52,201);lamp(331,201);
    }else if(id==='volcano'){
      cabin(24,194,.72);lamp(71,201);
      for(let n=0;n<15;n++){const x=90+r()*290,y=207+r()*23;rect(x,y,3,1,'#a26750');}
    }
    this.base=g.getImageData(0,0,W,H).data;
  }
  render(world,time=world.tick/60){
    const d=this.image.data,a=world.cells,t=world.tick,rock=ROCK[world.scene];d.set(this.base);
    for(let i=0;i<a.length;i++){
      const m=a[i];if(!m)continue;const p=i*4,x=i%W,y=(i/W)|0;let c=COLORS[m],v=this.noise[i];
      let alpha=m===M.GAS?.32:m===M.STEAM?.5:m===M.SMOKE?.34:m===M.GLASS?.45:m===M.ICE?.84:m===M.WATER?.85:1;
      if(m===M.FIRE){v=((i*13+t*7)%55)-15;c=[255,174,63];}
      if(m===M.LAVA)v=Math.sin(x*.19+y*.21-time*2)*19;
      if(m===M.WATER){v=v*.5+Math.sin(x*.1-time*2.2)*5;if(y>0&&a[i-W]!==M.WATER){c=[129,199,202];v=Math.sin(x*.18-time*3)*11;}else if(y%7===0&&Math.sin(x*.055+time*.6)>.94){c=[109,178,190];}}
      if(m===M.PLANT){c=this.noise[i]>2?[126,164,97]:[78,124,82];if(world.scene==='garden'&&this.noise[i]===6&&y>0&&!a[i-W])c=[215,174,144];}
      if(m===M.COMPOST)c=world.physics.damp[i]>0?[91,82,57]:[111,98,65];
      if(world.burning[i]){c=[161,100,51];v+=Math.sin(time*5+i)*16;}
      if(m===M.STONE){c=rock;if(y%13===0)v-=8;if((world.scene==='forest'||world.scene==='brook')&&y>0&&(a[i-W]===0||a[i-W]===M.WATER))c=[104,137,105];}
      if(m===M.SOIL&&y>0&&!a[i-W])c=[138,158,94];
      if(m===M.WOOD)v+=Math.floor(x/2)%3===0?-13:1;
      d[p]=d[p]*(1-alpha)+(c[0]+v)*alpha;d[p+1]=d[p+1]*(1-alpha)+(c[1]+v)*alpha;d[p+2]=d[p+2]*(1-alpha)+(c[2]+v)*alpha;d[p+3]=255;
      if((m===M.FIRE||m===M.LAVA)&&i%5===0){for(const j of [i-W,i+W,i-1,i+1])if(j>=0&&j<a.length&&!a[j]&&Math.abs(j%W-x)<2){const q=j*4;d[q]=Math.min(255,d[q]+35);d[q+1]+=12;}}
    }
    this.ctx.putImageData(this.image,0,0);this.details(world,time);
  }
  details(world,time){
    const g=this.ctx,id=world.scene;
    const rect=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),w,h);};
    // Broad clouds move in the same wind as the small plumes below.
    if(id!=='volcano'&&id!=='hourglass')for(let n=0;n<3;n++){const x=((time*(n+1)*.9+n*151)%(W+120))-90,y=30+n*19;g.globalAlpha=.07;rect(x,y,66,5,'#d6dfcc');rect(x+10,y-4,41,4,'#d6dfcc');g.globalAlpha=1;}
    // Warmth is built from stepped translucent rectangles, never blur filters.
    for(const [x,y,r]of this.lamps){g.globalAlpha=.045+Math.sin(time*1.3+x)*.008;rect(x-r,y-r,2*r,2*r,'#ffcd77');g.globalAlpha=.065;rect(x-r*.55,y-r*.55,Math.floor(r*1.1),Math.floor(r*1.1),'#ffdc8c');}g.globalAlpha=1;
    if(id==='forest'||id==='garden'||id==='brook'){
      for(let n=0;n<12;n++){const x=Math.round(30+n*29+Math.sin(time*.6+n)*8),y=Math.round(145+Math.sin(time*.8+n*4)*22),i=x+y*W;if(x<0||x>=W||world.cells[i])continue;g.globalAlpha=.4+Math.sin(time*2+n)*.3;rect(x-1,y,3,1,'#bfc98f');rect(x,y-1,1,3,'#bfc98f');g.globalAlpha=1;rect(x,y,1,1,'#dde1a5');}
    }
    if(id==='forest'||id==='snow'||id==='garden'){
      const [x,fallback]=id==='forest'?[57,187]:id==='snow'?[112,195]:[239,206];
      let y=fallback;for(let row=170;row<235;row++){const m=world.cells[x+row*W];if(m===M.SOIL||m===M.ICE||m===M.STONE){y=row-5;break;}}
      // A sleepy six-colour fox: ear twitch, breathing and a curling tail.
      const breathe=Math.sin(time*2)>.5?1:0;
      rect(x,y+breathe,10,4,'#bc7b4f');rect(x+7,y-2+breathe,5,5,'#ce905c');rect(x+7,y-4+breathe,2,3,'#ce905c');rect(x+10,y-4+breathe,2,2,'#ce905c');rect(x+10,y+1+breathe,3,2,'#e3c49a');rect(x+10,y+breathe,1,1,'#3d403b');
      const tail=Math.sin(time*1.1)>.7?1:0;rect(x-5,y+tail,7,4,'#d09562');rect(x-6,y+tail,3,3,'#ead4ad');
    }
    if(id==='brook'){
      // Quantised rotation keeps the waterwheel crisp, while updating at display speed.
      const x=155,y=151;for(let n=0;n<10;n++){const angle=time*.9+n*Math.PI/5;const xx=x+Math.cos(angle)*13,yy=y+Math.sin(angle)*13;rect(xx-2,yy-2,4,4,'#aa8960');for(let k=0;k<12;k++)rect(x+Math.cos(angle)*k,y+Math.sin(angle)*k,1,1,'#836b50');}rect(x-2,y-2,5,5,'#c3a26c');
    }
    if(id==='snow'){
      g.globalAlpha=.10;for(let x=50;x<300;x+=3){const y=48+Math.sin(x*.027+time*.15)*9;rect(x,y,3,9,'#b1dbc6');rect(x,y+9,3,7,'#94b8d6');}g.globalAlpha=1;
    }
    if(id==='cove'){
      const p=Math.sin(time*.45);g.globalAlpha=.035+Math.max(0,p)*.05;for(let n=0;n<90;n++)rect(54+n,96-n*.12,1,4+n*.2,'#ffdfa2');g.globalAlpha=1;
      // Tiny reflective glints sit on actual water, not an independent painted sea.
      for(let n=0;n<13;n++){const x=130+n*19,y=195+Math.round(Math.sin(time+n)*2);if(world.cells[x+y*W]===M.WATER)rect(x,y,3,1,'#c1b6a0');}
    }
    if(id==='volcano')for(let n=0;n<12;n++){const age=(time*18+n*11)%50,x=204+Math.sin(n*8+time)*age*.45,y=134-age;g.globalAlpha=1-age/55;rect(x,y,1,2,'#efbc7b');}g.globalAlpha=1;
  }
  thumbnail(world){this.render(world,0);return this.canvas;}
}
root.SandFoxScenery=Scenery;
})(window);
