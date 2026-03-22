// ── TILE / PROP DEFINITIONS ───────────────────────────────────────────────────
const TILE_DEFS = {
  floor:    {cat:'FLOOR',  file:'floor.png',    solid:false,w:1,h:1,color:'#3a3a2a'},
  floor1:   {cat:'FLOOR',  file:'floor1.png',   solid:false,w:1,h:1,color:'#2e3a3a'},
  floor3:   {cat:'FLOOR',  file:'floor3.png',   solid:false,w:1,h:1,color:'#c8b878'},
  floor4:   {cat:'FLOOR',  file:'floor4.png',   solid:false,w:1,h:1,color:'#d4c090'},
  floor5:   {cat:'FLOOR',  file:'floor5.png',   solid:false,w:1,h:1,color:'#1a1a2e'},
  floor6:   {cat:'FLOOR',  file:'floor6.png',   solid:false,w:1,h:1,color:'#3355aa'},
  border:   {cat:'BORDER', file:'border.png',   solid:true, w:1,h:1,color:'#555566'},
  border2:  {cat:'BORDER', file:'border2.png',  solid:true, w:1,h:1,color:'#505060'},
  border3:  {cat:'BORDER', file:'border3.png',  solid:true, w:1,h:1,color:'#4a4a5a'},
  border4:  {cat:'BORDER', file:'border4.png',  solid:true, w:1,h:1,color:'#484858'},
  border5:  {cat:'BORDER', file:'border5.png',  solid:true, w:1,h:1,color:'#444454'},
  border6:  {cat:'BORDER', file:'border6.png',  solid:true, w:1,h:1,color:'#404050'},
  border7:  {cat:'BORDER', file:'border7.png',  solid:true, w:1,h:1,color:'#3c3c4c'},
  border8:  {cat:'BORDER', file:'border8.png',  solid:true, w:1,h:1,color:'#383848'},
  border11: {cat:'BORDER', file:'border11.png', solid:true, w:1,h:1,color:'#343444'},
  border12: {cat:'BORDER', file:'border12.png', solid:true, w:1,h:1,color:'#303040'},
  border13: {cat:'BORDER', file:'border13.png', solid:true, w:1,h:1,color:'#2c2c3c'},
  border14: {cat:'BORDER', file:'border14.png', solid:true, w:1,h:1,color:'#282838'},
  wall:     {cat:'WALL',   file:'wall.png',     solid:true, w:1,h:1,color:'#667788'},
  wall2:    {cat:'WALL',   file:'wall2.png',    solid:false,w:1,h:1,color:'#556677'},
  wall3:    {cat:'WALL',   file:'wall3.png',    solid:true, w:1,h:1,color:'#607080'},
  wall4:    {cat:'WALL',   file:'wall4.png',    solid:true, w:1,h:1,color:'#5a6a7a'},
  wall5:    {cat:'WALL',   file:'wall5.png',    solid:true, w:1,h:1,color:'#546474'},
};
const PROP_DEFS = {
  Door1:    {file:'Door1.png',    w:1,h:2,color:'#8B5E3C'},
  Door2:    {file:'Door2.png',    w:2,h:2,color:'#6B4E3C'},
  Box1:     {file:'Box1.png',     w:1,h:1,color:'#C8843C'},
  BoxPile1: {file:'BoxPile1.png', w:1,h:2,color:'#B8743C', natW:32, natH:50},
  Locker1:  {file:'Locker1.png',  w:1,h:2,color:'#aaaaaa'},
  Locker2:  {file:'Locker2.png',  w:1,h:2,color:'#C8843C'},
  Locker3:  {file:'Locker3.png',  w:1,h:2,color:'#888888', natW:32, natH:80},
  Table:    {file:'Table.png',    w:2,h:1,color:'#C8A050', natW:80, natH:48},
};

// SPRITE_SCALE: player + prop sprites drawn at natural pixel size × this.
// 1 = exact pixel size. Bump up if your sprites are very small.
const SPRITE_SCALE = 1;
const TILE_SIZE    = 32; // 16px sprite × 2 (Scratch halves dimensions) = 32
const PLAYER_W     = 26; // actual sprite width  (13 × 2)
const PLAYER_H     = 52; // actual sprite height (26 × 2)
const PLAYER_SPEED = 2.5;
const CHAT_FADE_MS = 6000;
const CHAT_MAX     = 80;

const PLAYER_SPRITES = ['player1','player2','player3','player4','player5'];

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

function setPixelPerfect(c){
  c=c||ctx;
  c.imageSmoothingEnabled=false;
  c.mozImageSmoothingEnabled=false;
  c.webkitImageSmoothingEnabled=false;
}

const socket = io();

let myUsername    = '';
let mySprite      = localStorage.getItem('playerSprite')||'player1';
let me            = null;
let players       = {};
let mapTiles      = [];
let mapProps      = [];
let allSolids     = [];
let entityColliders = {};
let keys          = {};
let mobileKeys    = {up:false,down:false,left:false,right:false};
let mutedByAdmin  = false;
let chatOpen      = false;
let chatInputVal  = '';
let chatLog       = [];
let tileImages    = {};
let propImages    = {};
let spriteImages  = {};  // 'player1' → HTMLImageElement
let camX=0,camY=0;
let worldW=800,worldH=600;

// ── SCREEN STATE ──────────────────────────────────────────────────────────────
// 'color' = color picker, 'game' = playing
let screen = 'color';

// ── IMAGE LOADING ─────────────────────────────────────────────────────────────
function loadImage(src){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>res(img);
    img.onerror=()=>{console.warn('Missing:',src);res(null);};
    img.src=src;
  });
}

async function preloadAll(tiles,props){
  for(const t of tiles){
    if(tileImages[t.tile]!==undefined) continue;
    const def=TILE_DEFS[t.tile];
    tileImages[t.tile]=def?await loadImage(`/assets/${def.file}`):null;
  }
  for(const p of props){
    if(propImages[p.tile]!==undefined) continue;
    const def=PROP_DEFS[p.tile];
    propImages[p.tile]=def?await loadImage(`/assets/${def.file}`):null;
  }
}

async function preloadSprites(){
  for(const name of PLAYER_SPRITES){
    spriteImages[name]=await loadImage(`/assets/${name}.png`);
  }
}

// Sprite drawn at natural size × SPRITE_SCALE, not stretched to cell
function drawSpriteNatural(img,px,py,fallbackW,fallbackH,flipX){
  if(!img){
    ctx.fillStyle='#888';ctx.fillRect(px,py,fallbackW,fallbackH);return;
  }
  const dw=img.naturalWidth*SPRITE_SCALE;
  const dh=img.naturalHeight*SPRITE_SCALE;
  ctx.save();
  if(flipX){ctx.translate(px+dw,py);ctx.scale(-1,1);ctx.drawImage(img,0,0,dw,dh);}
  else ctx.drawImage(img,px,py,dw,dh);
  ctx.restore();
}

// Tile sprites: drawn to fill the grid cell exactly (tiles should tile cleanly)
function drawTileSprite(img,px,py,pw,ph,color,label){
  if(img){ctx.drawImage(img,px,py,pw,ph);}
  else{
    ctx.fillStyle=color||'#444';ctx.fillRect(px,py,pw,ph);
    ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,pw-1,ph-1);
    ctx.font='8px monospace';ctx.fillStyle='rgba(255,255,255,0.28)';
    ctx.textAlign='center';ctx.fillText(label||'',px+pw/2,py+ph/2+3);ctx.textAlign='left';
  }
}

function drawPropSprite(img,px,py,def,label){
  // Use explicit nat dimensions if provided, else trust the image, else fall back to grid size
  const dw = def.natW ? def.natW*SPRITE_SCALE
           : (img && img.naturalWidth>0) ? img.naturalWidth*SPRITE_SCALE
           : def.w*TILE_SIZE;
  const dh = def.natH ? def.natH*SPRITE_SCALE
           : (img && img.naturalHeight>0) ? img.naturalHeight*SPRITE_SCALE
           : def.h*TILE_SIZE;
  if(img && img.naturalWidth > 0){
    ctx.drawImage(img, px, py, dw, dh);
  } else {
    ctx.fillStyle=def.color||'#666';
    ctx.fillRect(px,py,dw,dh);
    ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;
    ctx.strokeRect(px+.5,py+.5,dw-1,dh-1);
    ctx.font='8px monospace';ctx.fillStyle='rgba(255,255,255,0.28)';
    ctx.textAlign='center';ctx.fillText(label||'',px+dw/2,py+dh/2+3);ctx.textAlign='left';
  }
}

// ── MAP ───────────────────────────────────────────────────────────────────────
async function loadMap(){
  const r=await fetch('/map');const d=await r.json();
  await applyMap(d);return d;
}
async function applyMap(d){
  mapTiles=d.data||[];mapProps=d.props||[];entityColliders=d.entityColliders||{};
  await preloadAll(mapTiles,mapProps);
  computeWorldSize();buildSolids();
}
function computeWorldSize(){
  worldW=800;worldH=600;
  [...mapTiles.map(t=>({col:t.col,row:t.row,def:TILE_DEFS[t.tile]})),
   ...mapProps.map(p=>({col:p.col,row:p.row,def:PROP_DEFS[p.tile]}))
  ].forEach(({col,row,def})=>{
    if(!def) return;
    worldW=Math.max(worldW,(col+def.w)*TILE_SIZE);
    worldH=Math.max(worldH,(row+def.h)*TILE_SIZE);
  });
}
function buildSolids(){
  allSolids=[];
  mapTiles.forEach(t=>{
    const def=TILE_DEFS[t.tile];if(!def||!def.solid) return;
    allSolids.push({x:t.col*TILE_SIZE,y:t.row*TILE_SIZE,w:def.w*TILE_SIZE,h:def.h*TILE_SIZE});
  });
  allSolids._playerBoxes=(entityColliders['player']&&entityColliders['player'].length)
    ?entityColliders['player']:[{x:4,y:14,w:PLAYER_W-8,h:PLAYER_H-14}];
}

// ── CAMERA ────────────────────────────────────────────────────────────────────
function updateCamera(){
  if(!me) return;
  camX=Math.round(me.x+PLAYER_W/2-canvas.width/2);
  camY=Math.round(me.y+PLAYER_H/2-canvas.height/2);
  camX=Math.max(0,Math.min(camX,Math.max(0,worldW-canvas.width)));
  camY=Math.max(0,Math.min(camY,Math.max(0,worldH-canvas.height)));
}

// ── COLLISION ─────────────────────────────────────────────────────────────────
function overlap(ax,ay,aw,ah,bx,by,bw,bh){return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;}
function tryMove(px,py,dx,dy){
  const nx=px+dx,ny=py+dy;
  let canX=true,canY=true;
  const boxes=allSolids._playerBoxes||[{x:0,y:0,w:PLAYER_W,h:PLAYER_H}];
  for(const r of allSolids){
    if(typeof r.x!=='number') continue;
    for(const box of boxes){
      if(overlap(nx+box.x,py+box.y,box.w,box.h,r.x,r.y,r.w,r.h)) canX=false;
      if(overlap(px+box.x,ny+box.y,box.w,box.h,r.x,r.y,r.w,r.h)) canY=false;
    }
  }
  if(nx<0||nx+PLAYER_W>worldW) canX=false;
  if(ny<0||ny+PLAYER_H>worldH) canY=false;
  return{x:canX?nx:px,y:canY?ny:py,moved:canX||canY};
}

// ── DRAW MAP ──────────────────────────────────────────────────────────────────
function drawTileLayer(){
  ['FLOOR','BORDER','WALL'].forEach(cat=>{
    mapTiles.filter(t=>TILE_DEFS[t.tile]?.cat===cat).forEach(t=>{
      const def=TILE_DEFS[t.tile];if(!def) return;
      const px=Math.round(t.col*TILE_SIZE-camX);
      const py=Math.round(t.row*TILE_SIZE-camY);
      const pw=def.w*TILE_SIZE,ph=def.h*TILE_SIZE;
      if(px+pw<0||py+ph<0||px>canvas.width||py>canvas.height) return;
      drawTileSprite(tileImages[t.tile],px,py,pw,ph,def.color,t.tile);
    });
  });
}

function drawPropsAndPlayers(){
  const items=[];
  mapProps.forEach(p=>{
    const def=PROP_DEFS[p.tile];if(!def) return;
    const img=propImages[p.tile];
    const drawnH = def.natH ? def.natH*SPRITE_SCALE
                 : (img && img.naturalHeight>0) ? img.naturalHeight*SPRITE_SCALE
                 : def.h*TILE_SIZE;
    const drawnW = def.natW ? def.natW*SPRITE_SCALE
                 : (img && img.naturalWidth>0) ? img.naturalWidth*SPRITE_SCALE
                 : def.w*TILE_SIZE;
    const px=Math.round(p.col*TILE_SIZE-camX);
    const py=Math.round(p.row*TILE_SIZE-camY);
    if(px+drawnW<0||py+drawnH<0||px>canvas.width||py>canvas.height) return;
    items.push({sortY:p.row*TILE_SIZE+drawnH,draw:()=>drawPropSprite(img,px,py,def,p.tile)});
  });
  Object.values(players).forEach(p=>{
    items.push({sortY:p.y+PLAYER_H,draw:()=>drawPlayer(p,false)});
  });
  if(me) items.push({sortY:me.y+PLAYER_H,draw:()=>drawPlayer({...me,username:myUsername,sprite:mySprite},true)});
  items.sort((a,b)=>a.sortY-b.sortY).forEach(i=>i.draw());
}

function drawPlayer(p,isSelf){
  const px=Math.round(p.x-camX),py=Math.round(p.y-camY);
  const now=Date.now();
  const img=spriteImages[p.sprite||'player1'];
  drawSpriteNatural(img,px,py,PLAYER_W,PLAYER_H,p.facingLeft);

  // Name tag
  ctx.font='bold 10px monospace';ctx.textAlign='center';
  const cx=px+PLAYER_W/2;
  const tw=ctx.measureText(p.username).width;
  ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(cx-tw/2-3,py-17,tw+6,13);
  ctx.fillStyle=isSelf?'#00ffe7':'#fff';ctx.fillText(p.username,cx,py-6);

  // Chat bubble — wraps long text
  if(p.chatMsg&&p.chatTime){
    const age=now-p.chatTime;
    if(age<CHAT_FADE_MS){
      const alpha=age>CHAT_FADE_MS-1000?1-(age-(CHAT_FADE_MS-1000))/1000:1;
      ctx.save();ctx.globalAlpha=alpha;
      drawWrappedBubble(p.chatMsg,cx,py-44,200);
      ctx.restore();
    } else {p.chatMsg=null;}
  }
  ctx.textAlign='left';
}

// Wraps text into multiple lines inside a bubble above the player
function drawWrappedBubble(text,cx,bottomY,maxW){
  ctx.font='10px monospace';
  const words=text.split(' ');
  const lines=[];
  let line='';
  for(const w of words){
    const test=line?line+' '+w:w;
    if(ctx.measureText(test).width>maxW&&line){lines.push(line);line=w;}
    else line=test;
  }
  if(line) lines.push(line);
  const lh=14,pad=5;
  const bw=Math.min(maxW,Math.max(...lines.map(l=>ctx.measureText(l).width)))+pad*2;
  const bh=lines.length*lh+pad*2;
  const bx=cx-bw/2,by=bottomY-bh;
  ctx.fillStyle='rgba(0,0,0,0.65)';
  rrect(bx,by,bw,bh,4);ctx.fill();
  ctx.fillStyle='#fff';
  lines.forEach((l,i)=>ctx.fillText(l,bx+pad,by+pad+lh*(i+1)-2));
}

function rrect(x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}

// ── CHAT OVERLAY ──────────────────────────────────────────────────────────────
function drawChatOverlay(){
  const now=Date.now();
  const OX=14,maxW=Math.min(300,canvas.width-28);
  const visible=chatOpen?chatLog.slice(-8):chatLog.filter(m=>now-m.time<12000).slice(-4);
  if(!chatOpen&&visible.length===0) return;

  ctx.save();
  // Measure all lines first to know total height
  ctx.font='11px monospace';
  const rendered=visible.map(m=>{
    const who=m.username+': ';
    return{who,msg:m.msg,alpha:chatOpen?0.9:Math.max(0,1-(now-m.time-8000)/4000)};
  });

  // Draw from bottom up
  let y=canvas.height-60;
  if(chatOpen) y-=24; // leave room for input box
  for(let i=rendered.length-1;i>=0;i--){
    const{who,msg,alpha}=rendered[i];
    ctx.globalAlpha=Math.max(0,alpha);
    const whoW=ctx.measureText(who).width;
    const fw=Math.min(ctx.measureText(who+msg).width,maxW)+10;
    ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(OX-2,y-12,fw,15);
    ctx.fillStyle='#00ffe7';ctx.fillText(who,OX,y);
    // Clip long message text
    ctx.save();
    ctx.beginPath();ctx.rect(OX+whoW,y-12,maxW-whoW,15);ctx.clip();
    ctx.fillStyle='#fff';ctx.fillText(msg,OX+whoW,y);
    ctx.restore();
    y-=17;
  }

  if(chatOpen){
    ctx.globalAlpha=0.95;
    const IY=canvas.height-36;
    ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(OX-2,IY-14,maxW,20);
    ctx.strokeStyle='#00ffe7';ctx.lineWidth=1;ctx.strokeRect(OX-2,IY-14,maxW,20);
    const cursor=Math.floor(Date.now()/500)%2===0?'|':'';
    // Clip input text if too long
    ctx.save();ctx.beginPath();ctx.rect(OX+2,IY-13,maxW-40,18);ctx.clip();
    ctx.fillStyle='#00ffe7';ctx.font='11px monospace';ctx.fillText('> '+chatInputVal+cursor,OX+2,IY);
    ctx.restore();
    ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font='9px monospace';ctx.textAlign='right';
    ctx.fillText(`${chatInputVal.length}/${CHAT_MAX}`,OX+maxW-4,IY);ctx.textAlign='left';
  }
  ctx.restore();
}

// ── COLOR PICKER SCREEN ───────────────────────────────────────────────────────
let colorPickerLoaded=false;
function drawColorScreen(){
  ctx.fillStyle='#07070f';ctx.fillRect(0,0,canvas.width,canvas.height);
  setPixelPerfect();

  // Grid BG
  ctx.strokeStyle='rgba(0,255,231,0.04)';ctx.lineWidth=1;
  for(let x=0;x<canvas.width;x+=40) {ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
  for(let y=0;y<canvas.height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}

  const cx=canvas.width/2;

  // Title
  ctx.font='bold 18px Orbitron, monospace';ctx.fillStyle='#00ffe7';ctx.textAlign='center';
  ctx.fillText('CHOOSE YOUR CHARACTER',cx,60);
  ctx.font='11px monospace';ctx.fillStyle='#445566';
  ctx.fillText('select a sprite to play as',cx,82);

  const spriteW=40,spriteH=60;
  const gap=24;
  const totalW=PLAYER_SPRITES.length*(spriteW+gap)-gap;
  const startX=cx-totalW/2;
  const sprY=canvas.height/2-spriteH/2-10;

  PLAYER_SPRITES.forEach((name,i)=>{
    const sx=startX+i*(spriteW+gap);
    const isSelected=name===mySprite;

    // Card bg
    ctx.fillStyle=isSelected?'rgba(0,255,231,0.12)':'rgba(255,255,255,0.04)';
    ctx.strokeStyle=isSelected?'#00ffe7':'rgba(255,255,255,0.1)';
    ctx.lineWidth=isSelected?2:1;
    rrect(sx-8,sprY-10,spriteW+16,spriteH+36,6);
    ctx.fill();ctx.stroke();

    // Sprite
    const img=spriteImages[name];
    if(img){ctx.drawImage(img,sx,sprY,spriteW,spriteH);}
    else{
      ctx.fillStyle='#333';ctx.fillRect(sx,sprY,spriteW,spriteH);
      ctx.font='8px monospace';ctx.fillStyle='#666';ctx.textAlign='center';
      ctx.fillText(name,sx+spriteW/2,sprY+spriteH/2+3);ctx.textAlign='left';
    }

    // Label
    ctx.font=isSelected?'bold 10px monospace':'10px monospace';
    ctx.fillStyle=isSelected?'#00ffe7':'#c8d8e8';ctx.textAlign='center';
    ctx.fillText(name,sx+spriteW/2,sprY+spriteH+16);

    if(isSelected){
      ctx.font='8px monospace';ctx.fillStyle='#00ffe7';
      ctx.fillText('▲ SELECTED',sx+spriteW/2,sprY+spriteH+28);
    }
    ctx.textAlign='left';
  });

  // Play button
  const btnW=160,btnH=40,btnX=cx-btnW/2,btnY=sprY+spriteH+60;
  ctx.fillStyle='rgba(0,255,231,0.1)';
  ctx.strokeStyle='#00ffe7';ctx.lineWidth=2;
  rrect(btnX,btnY,btnW,btnH,6);ctx.fill();ctx.stroke();
  ctx.font='bold 13px Orbitron, monospace';ctx.fillStyle='#00ffe7';ctx.textAlign='center';
  ctx.fillText('ENTER WORLD',cx,btnY+26);ctx.textAlign='left';

  // Store clickable areas for mouse/touch
  canvas._colorPicker={sprites:[],btn:{x:btnX,y:btnY,w:btnW,h:btnH}};
  PLAYER_SPRITES.forEach((name,i)=>{
    const sx=startX+i*(spriteW+gap);
    canvas._colorPicker.sprites.push({name,x:sx-8,y:sprY-10,w:spriteW+16,h:spriteH+46});
  });
}

function handleColorPickerClick(px,py){
  const cp=canvas._colorPicker;if(!cp) return;
  // Check sprite cards
  for(const s of cp.sprites){
    if(px>=s.x&&px<=s.x+s.w&&py>=s.y&&py<=s.y+s.h){
      mySprite=s.name;
      localStorage.setItem('playerSprite',mySprite);
      return;
    }
  }
  // Check play button
  const b=cp.btn;
  if(px>=b.x&&px<=b.x+b.w&&py>=b.y&&py<=b.y+b.h){
    enterGame();
  }
}

function enterGame(){
  screen='game';
  socket.emit('join',myUsername,mySprite);
}

// ── GAME LOOP ─────────────────────────────────────────────────────────────────
function resize(){
  canvas.width=window.innerWidth;
  canvas.height=window.innerHeight;
  setPixelPerfect();
}

function tick(){
  requestAnimationFrame(tick);

  if(screen==='color'){
    drawColorScreen();
    return;
  }

  if(!me) return;

  if(!chatOpen){
    let dx=0,dy=0;
    const L=keys['ArrowLeft'] ||keys['a']||keys['A']||mobileKeys.left;
    const R=keys['ArrowRight']||keys['d']||keys['D']||mobileKeys.right;
    const U=keys['ArrowUp']   ||keys['w']||keys['W']||mobileKeys.up;
    const D=keys['ArrowDown'] ||keys['s']||keys['S']||mobileKeys.down;
    if(L){dx-=PLAYER_SPEED;me.facingLeft=true;}
    if(R){dx+=PLAYER_SPEED;me.facingLeft=false;}
    if(U) dy-=PLAYER_SPEED;
    if(D) dy+=PLAYER_SPEED;
    if(dx||dy){
      const r=tryMove(me.x,me.y,dx,dy);
      if(r.moved){me.x=r.x;me.y=r.y;socket.emit('move',{x:me.x,y:me.y,facingLeft:me.facingLeft});}
    }
  }

  updateCamera();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  setPixelPerfect();
  ctx.fillStyle='#07070f';ctx.fillRect(0,0,canvas.width,canvas.height);
  drawTileLayer();
  drawPropsAndPlayers();
  drawChatOverlay();
}

// ── INPUT ─────────────────────────────────────────────────────────────────────
window.addEventListener('keydown',e=>{
  if(screen==='color'){
    if(e.key==='Enter') enterGame();
    return;
  }
  if(e.key==='/'&&!chatOpen){logout();return;}
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&!chatOpen) e.preventDefault();
  if(!chatOpen&&(e.key==='t'||e.key==='T')){openChat();e.preventDefault();return;}
  if(chatOpen){
    e.preventDefault();
    if(e.key==='Escape') closeChat();
    else if(e.key==='Enter') sendChat();
    else if(e.key==='Backspace') chatInputVal=chatInputVal.slice(0,-1);
    else if(e.key.length===1&&chatInputVal.length<CHAT_MAX) chatInputVal+=e.key;
    return;
  }
  keys[e.key]=true;
});
window.addEventListener('keyup',e=>{keys[e.key]=false;});
window.addEventListener('resize',resize);

// Click / tap handler for color picker
canvas.addEventListener('click',e=>{
  if(screen==='color'){
    const rect=canvas.getBoundingClientRect();
    handleColorPickerClick(e.clientX-rect.left,e.clientY-rect.top);
  }
});
canvas.addEventListener('touchend',e=>{
  if(screen==='color'){
    const rect=canvas.getBoundingClientRect();
    const t=e.changedTouches[0];
    handleColorPickerClick(t.clientX-rect.left,t.clientY-rect.top);
    e.preventDefault();
  }
},{passive:false});

// ── CHAT HELPERS ──────────────────────────────────────────────────────────────
function openChat(){
  chatOpen=true;chatInputVal='';
  const inp=document.getElementById('mobileChatInput');
  if(inp){inp.style.bottom='0';inp.style.pointerEvents='all';inp.value='';inp.focus();}
}
function closeChat(){
  chatOpen=false;chatInputVal='';
  const inp=document.getElementById('mobileChatInput');
  if(inp){inp.blur();inp.style.bottom='-200px';inp.style.pointerEvents='none';}
}
function sendChat(){
  const msg=chatInputVal.trim();
  if(msg&&!mutedByAdmin) socket.emit('chat',msg);
  else if(mutedByAdmin) chatLog.push({username:'SYSTEM',msg:'You are muted.',time:Date.now()});
  closeChat();
}

const mobileInput=document.getElementById('mobileChatInput');
if(mobileInput){
  mobileInput.addEventListener('input',e=>{chatInputVal=e.target.value.slice(0,CHAT_MAX);});
  mobileInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'){sendChat();e.preventDefault();}
    if(e.key==='Escape') closeChat();
  });
  mobileInput.addEventListener('blur',()=>setTimeout(()=>{if(chatOpen)closeChat();},200));
}

// Mobile dpad
function bindDpad(id,dir){
  const el=document.getElementById(id);if(!el) return;
  const on=()=>{mobileKeys[dir]=true;el.classList.add('pressed');};
  const off=()=>{mobileKeys[dir]=false;el.classList.remove('pressed');};
  el.addEventListener('touchstart',e=>{on();e.preventDefault();},{passive:false});
  el.addEventListener('touchend',  e=>{off();e.preventDefault();},{passive:false});
  el.addEventListener('touchcancel',off);
  el.addEventListener('mousedown',on);el.addEventListener('mouseup',off);el.addEventListener('mouseleave',off);
}
bindDpad('dbUp','up');bindDpad('dbDown','down');bindDpad('dbLeft','left');bindDpad('dbRight','right');
const btnChat=document.getElementById('btnChat');
if(btnChat) btnChat.addEventListener('touchstart',e=>{openChat();e.preventDefault();},{passive:false});
const btnLogout=document.getElementById('btnLogout');
if(btnLogout) btnLogout.addEventListener('touchstart',e=>{logout();e.preventDefault();},{passive:false});

// ── SOCKETS ───────────────────────────────────────────────────────────────────
socket.on('currentPlayers',data=>{
  players={};
  Object.entries(data).forEach(([id,p])=>{
    if(id!==socket.id) players[id]={...p,chatMsg:null,chatTime:null};
  });
});
socket.on('playerJoined',({id,username,x,y,sprite})=>{
  if(id!==socket.id) players[id]={username,x,y,sprite:sprite||'player1',facingLeft:false,chatMsg:null,chatTime:null};
});
socket.on('playerMoved',({id,x,y,facingLeft})=>{
  if(players[id]){players[id].x=x;players[id].y=y;players[id].facingLeft=facingLeft;}
});
socket.on('playerLeft',id=>{delete players[id];});
socket.on('chat',({id:sid,username,msg})=>{
  chatLog.push({username,msg,time:Date.now()});
  if(chatLog.length>40) chatLog.shift();
  if(sid===socket.id){if(me){me.chatMsg=msg;me.chatTime=Date.now();}}
  else if(players[sid]){players[sid].chatMsg=msg;players[sid].chatTime=Date.now();}
});
socket.on('mapUpdate',async d=>{
  await applyMap(d);
  if(me){me.x=d.spawnX||me.x;me.y=d.spawnY||me.y;}
});
socket.on('kick',()=>{alert('You were kicked.');window.location.href='/login.html';});
socket.on('mute',({muted})=>{
  mutedByAdmin=muted;
  chatLog.push({username:'SYSTEM',msg:muted?'You have been muted.':'You have been unmuted.',time:Date.now()});
});

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init(){
  resize();
  const auth=await(await fetch('/me')).json();
  if(!auth.ok){window.location.href='/login.html';return;}
  myUsername=auth.user.username;

  await preloadSprites();
  const d=await loadMap();
  me={x:d.spawnX||100,y:d.spawnY||100,facingLeft:false,chatMsg:null,chatTime:null,sprite:mySprite};

  screen='color';
  tick();
}

async function logout(){
  await fetch('/logout',{method:'POST'});
  window.location.href='/login.html';
}

init();