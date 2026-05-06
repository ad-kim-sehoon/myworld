// Minimal pixel open-world prototype (tile-based) with virtual joystick and tree collision
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
let DPR = Math.max(1, window.devicePixelRatio || 1);
function resize(){
  DPR = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * DPR);
  canvas.height = Math.floor(window.innerHeight * DPR);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);
resize();

// smaller tile for denser pixels
const TILE = 8;
const player = {x:0,y:0,speed:120};
let target = null;
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; });
window.addEventListener('keyup', e => { keys[e.key] = false; });

// 8x8 pixel sprite (simple hero)
const heroSprite = [
  [null,null,'#000000','#000000','#000000','#000000',null,null],
  [null,'#000000','#ffcc99','#ffcc99','#ffcc99','#ffcc99','#000000',null],
  [null,'#ffcc99','#ffcc99','#ffcc99','#ffcc99','#ffcc99','#ffcc99',null],
  [null,null,'#880000','#880000','#880000','#880000',null,null],
  [null,null,'#00aa00','#00aa00','#00aa00','#00aa00',null,null],
  [null,'#0066ff','#0066ff','#00aaee','#00aaee','#0066ff','#0066ff',null],
  ['#000000',null,'#000000',null,null,'#000000',null,'#000000'],
  [null,null,'#000000','#000000','#000000','#000000',null,null]
];
const SPRITE_PX = heroSprite.length; // 8
const SPRITE_SCALE = 2; // each sprite pixel rendered as SCALE x SCALE canvas pixels

canvas.addEventListener('pointerdown', e => {
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left);
  const cy = (e.clientY - rect.top);
  target = {x: cx, y: cy};
});

function hash2(x,y){
  let n = x*374761393 + y*668265263;
  n = (n ^ (n>>13)) * 1274126177;
  return (n ^ (n>>16)) >>> 0;
}
function tileTypeAt(tx,ty){
  const v = hash2(tx,ty) % 100;
  if(v < 5) return 'water';
  if(v < 12) return 'rock';
  if(v < 30) return 'forest';
  return 'grass';
}
function tileColor(type){
  switch(type){
    case 'water': return '#3b82f6';
    case 'rock': return '#9ca3af';
    case 'forest': return '#16a34a';
    default: return '#bbf7d0';
  }
}

// Tree placement: deterministic; trees appear on some forest tiles
function hasTreeAt(tx,ty){
  if(tileTypeAt(tx,ty) !== 'forest') return false;
  return (hash2(tx,ty) % 10) < 4; // ~40% of forest tiles have trees
}
function tileBlocked(tx,ty){
  const t = tileTypeAt(tx,ty);
  if(t === 'water' || t === 'rock') return true;
  if(t === 'forest' && hasTreeAt(tx,ty)) return true;
  return false;
}

// Virtual joystick
const joy = document.getElementById('joystick');
const joyStick = document.getElementById('joy-stick');
let joystickActive = false;
let joyOrigin = {x:0,y:0};
let joyVector = {x:0,y:0};

function joyPointerDown(e){
  joystickActive = true;
  const rect = joy.getBoundingClientRect();
  joyOrigin = {x: rect.left + rect.width/2, y: rect.top + rect.height/2};
  joyMove(e);
  e.preventDefault();
}
function joyPointerMove(e){
  if(!joystickActive) return;
  joyMove(e);
}
function joyPointerUp(e){
  joystickActive = false;
  joyVector = {x:0,y:0};
  joyStick.style.transform = `translate(0px,0px)`;
}
function joyMove(e){
  const px = e.clientX;
  const py = e.clientY;
  const dx = px - joyOrigin.x;
  const dy = py - joyOrigin.y;
  const max = 44;
  const dist = Math.hypot(dx,dy);
  const nx = dist>0? dx/dist : 0;
  const ny = dist>0? dy/dist : 0;
  const mag = Math.min(dist, max)/max;
  joyVector = {x: nx*mag, y: ny*mag};
  const tx = nx * Math.min(dist, max);
  const ty = ny * Math.min(dist, max);
  joyStick.style.transform = `translate(${tx}px, ${ty}px)`;
}

joy.addEventListener('pointerdown', joyPointerDown);
window.addEventListener('pointermove', joyPointerMove);
window.addEventListener('pointerup', joyPointerUp);

// Movement with axis-separated collision against tile blocks (trees, rock, water)
function isBlockedAtWorld(x,y){
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return tileBlocked(tx,ty);
}

function update(dt){
  let vx = 0, vy = 0;
  // keyboard
  if(keys['ArrowUp'] || keys['w']) vy -= 1;
  if(keys['ArrowDown'] || keys['s']) vy += 1;
  if(keys['ArrowLeft'] || keys['a']) vx -= 1;
  if(keys['ArrowRight'] || keys['d']) vx += 1;

  // joystick overrides if active
  if(joystickActive){
    vx = joyVector.x;
    vy = joyVector.y;
  }

  // compute proposed movement
  if(vx !== 0 || vy !== 0){
    const len = Math.hypot(vx,vy) || 1;
    const nx = vx / len;
    const ny = vy / len;
    const moveX = nx * player.speed * dt;
    const moveY = ny * player.speed * dt;

    // axis-separated collision: try X, then Y
    let newX = player.x + moveX;
    if(!isBlockedAtWorld(newX, player.y)){
      player.x = newX;
    }
    let newY = player.y + moveY;
    if(!isBlockedAtWorld(player.x, newY)){
      player.y = newY;
    }
    target = null;
    return;
  }

  if(target){
    const screenCenterX = window.innerWidth/2;
    const screenCenterY = window.innerHeight/2;
    const worldCenterX = player.x;
    const worldCenterY = player.y;
    const dx = target.x - screenCenterX;
    const dy = target.y - screenCenterY;
    const desiredX = worldCenterX + dx;
    const desiredY = worldCenterY + dy;
    const dirx = desiredX - player.x;
    const diry = desiredY - player.y;
    const dist = Math.hypot(dirx,diry);
    if(dist > 4){
      const nx = dirx / dist;
      const ny = diry / dist;
      const moveX = nx * player.speed * dt;
      const moveY = ny * player.speed * dt;
      let newX = player.x + moveX;
      if(!isBlockedAtWorld(newX, player.y)) player.x = newX;
      let newY = player.y + moveY;
      if(!isBlockedAtWorld(player.x, newY)) player.y = newY;
    } else {
      target = null;
    }
  }
}

function draw(){
  ctx.fillStyle = '#e6f0ff';
  ctx.fillRect(0,0,canvas.width/DPR, canvas.height/DPR);
  const halfW = (canvas.width/DPR)/2;
  const halfH = (canvas.height/DPR)/2;
  const camX = player.x - halfW;
  const camY = player.y - halfH;
  const startTx = Math.floor(camX / TILE) - 1;
  const startTy = Math.floor(camY / TILE) - 1;
  const endTx = Math.floor((camX + canvas.width/DPR)/TILE) + 1;
  const endTy = Math.floor((camY + canvas.height/DPR)/TILE) + 1;
  for(let ty=startTy; ty<=endTy; ty++){
    for(let tx=startTx; tx<=endTx; tx++){
      const type = tileTypeAt(tx,ty);
      ctx.fillStyle = tileColor(type);
      const sx = tx * TILE - camX;
      const sy = ty * TILE - camY;
      ctx.fillRect(Math.round(sx), Math.round(sy), TILE+1, TILE+1);
      if(type === 'grass'){
        ctx.fillStyle = 'rgba(0,0,0,0.02)';
        ctx.fillRect(Math.round(sx+4), Math.round(sy+4), 2, 2);
      }

      // draw tree on forest tiles if present
      if(type === 'forest' && hasTreeAt(tx,ty)){
        // trunk
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(Math.round(sx + TILE*0.45), Math.round(sy + TILE*0.45), Math.round(TILE*0.1), Math.round(TILE*0.2));
        // foliage (circle)
        ctx.fillStyle = '#0b6623';
        ctx.beginPath();
        ctx.arc(Math.round(sx + TILE*0.5), Math.round(sy + TILE*0.35), Math.round(TILE*0.28), 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // draw player sprite centered
  const px = halfW;
  const py = halfH;
  const pixelSize = SPRITE_SCALE;
  const spriteTotal = SPRITE_PX * pixelSize;
  const startX = Math.round(px - spriteTotal/2);
  const startY = Math.round(py - spriteTotal/2);
  for(let sy=0; sy<SPRITE_PX; sy++){
    for(let sx=0; sx<SPRITE_PX; sx++){
      const c = heroSprite[sy][sx];
      if(!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(startX + sx*pixelSize, startY + sy*pixelSize, pixelSize, pixelSize);
    }
  }

  // debug HUD
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(10,10,300,56);
  ctx.fillStyle = '#0b1220';
  ctx.font = '12px system-ui';
  ctx.fillText('Player: ('+player.x.toFixed(0)+', '+player.y.toFixed(0)+')', 18, 28);
  ctx.fillText('Tile: ('+Math.floor(player.x/TILE)+', '+Math.floor(player.y/TILE)+')', 18, 44);
}

let last = performance.now();
function frame(t){
  const dt = Math.min(0.05, (t-last)/1000);
  update(dt);
  draw();
  last = t;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
