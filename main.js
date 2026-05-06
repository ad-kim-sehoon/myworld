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

// higher density tiles (TILE=4) and larger procedural hero sprite
const TILE = 4;
const player = {x:0,y:0,vx:0,vy:0,maxSpeed:100,accel:800, walkFrame:0, walkTimer:0, facing:0};
let target = null;
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; });
window.addEventListener('keyup', e => { keys[e.key] = false; });

// Procedural 32x32 pixel hero renderer with frame and flip support (palette-mapped)
const SPRITE_PX = 32;
const SPRITE_SCALE = 2; // displayed size: 64x64
function renderHero(ctx, centerX, centerY, frame = 0, flip = false, bob = 0){
  const pixelSize = SPRITE_SCALE;
  const total = SPRITE_PX * pixelSize;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(centerX, centerY + bob);
  if(flip) ctx.scale(-1,1);
  const startX = Math.round(-total/2);
  const startY = Math.round(-total/2);
  // draw body parts using grid rules (skin/hair/shirt/pants)
  for(let py=0; py<SPRITE_PX; py++){
    for(let px=0; px<SPRITE_PX; px++){
      let color = null;
      // hair (top)
      if(py >= 2 && py <= 6 && px >= 11 && px <= 20) color = '#2b2b2b';
      // head/skin
      if(py >= 6 && py <= 12 && px >= 12 && px <= 19) color = '#f5d0c5';
      // eyes
      if(py == 9 && (px == 14 || px == 17)) color = '#000000';
      // mouth
      if(py == 11 && px >= 15 && px <= 16) color = '#882222';

      // shirt
      if(py >= 13 && py <= 20 && px >= 10 && px <= 21) color = '#2b6cb0';

      // arms: change position slightly based on frame to simulate swing
      if(py >= 14 && py <= 17){
        if(frame === 0){
          if((px >= 7 && px <= 9) || (px >= 22 && px <= 24)) color = '#2b6cb0';
        } else {
          // swing arms: left arm moves down, right arm moves up
          if((px >= 6 && px <= 8) || (px >= 23 && px <= 25)) color = '#2b6cb0';
        }
      }

      // pants and legs: shift leg pixels for walking frames
      if(py >= 21 && py <= 29){
        if(frame === 0){
          if((px >= 11 && px <= 15) || (px >= 17 && px <= 21)) color = '#2b2b2b';
        } else {
          // alternate leg positions
          if((px >= 10 && px <= 14) || (px >= 18 && px <= 22)) color = '#2b2b2b';
        }
      }

      // shoes
      if(py >= 30 && px >= 11 && px <= 21 && (px <= 13 || px >= 19)) color = '#000000';

      if(color){
        const mapped = mapToPalette(color) || color;
        ctx.fillStyle = mapped;
        ctx.fillRect(startX + px*pixelSize, startY + py*pixelSize, pixelSize, pixelSize);
      }
    }
  }
  ctx.restore();
}

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
// Palette: 256-color palette (6x6x6 cube + 40 grays) and fast nearest-color cache
const PALETTE = (function(){
  const p = [];
  const steps = [0,51,102,153,204,255]; // 6 levels
  for(let r of steps) for(let g of steps) for(let b of steps) p.push(rgbToHex(r,g,b));
  // add 40 grays
  for(let i=0;i<40;i++){ const v = Math.round(i * 255 / 39); p.push(rgbToHex(v,v,v)); }
  // ensure length 256
  while(p.length < 256) p.push('#000000');
  return p.slice(0,256);
})();
const _paletteCache = new Map();
function hexToRgb(hex){
  if(!hex) return null;
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16);
  const g = parseInt(h.substring(2,4),16);
  const b = parseInt(h.substring(4,6),16);
  return {r,g,b};
}
function rgbToHex(r,g,b){
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function colorDist2(a,b){
  const dr = a.r - b.r; const dg = a.g - b.g; const db = a.b - b.b; return dr*dr + dg*dg + db*db;
}
function mapToPalette(hex){
  if(!hex) return null;
  if(_paletteCache.has(hex)) return _paletteCache.get(hex);
  const rgb = hexToRgb(hex);
  let best = PALETTE[0]; let bestD = Infinity;
  for(const ph of PALETTE){
    const pr = hexToRgb(ph);
    const d = colorDist2(rgb, pr);
    if(d < bestD){ bestD = d; best = ph; if(d === 0) break; }
  }
  _paletteCache.set(hex, best);
  return best;
}

function tileColor(type){
  switch(type){
    case 'water': return mapToPalette('#3b82f6');
    case 'rock': return mapToPalette('#9ca3af');
    case 'forest': return mapToPalette('#16a34a');
    default: return mapToPalette('#bbf7d0');
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

// Rectangle collision: check any tile overlapped by axis-aligned rectangle is blocked
function rectBlockedAtWorld(cx, cy, w, h){
  // cx,cy are center coordinates
  const left = Math.floor((cx - w/2) / TILE);
  const right = Math.floor((cx + w/2) / TILE);
  const top = Math.floor((cy - h/2) / TILE);
  const bottom = Math.floor((cy + h/2) / TILE);
  for(let ty = top; ty <= bottom; ty++){
    for(let tx = left; tx <= right; tx++){
      if(tileBlocked(tx,ty)) return true;
    }
  }
  return false;
}

function update(dt){
  // determine desired input vector
  let inx = 0, iny = 0;
  if(keys['ArrowUp'] || keys['w']) iny -= 1;
  if(keys['ArrowDown'] || keys['s']) iny += 1;
  if(keys['ArrowLeft'] || keys['a']) inx -= 1;
  if(keys['ArrowRight'] || keys['d']) inx += 1;
  if(joystickActive){ inx = joyVector.x; iny = joyVector.y; }

  // if pointer target exists, override input towards target (screen -> world)
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
    if(dist > 4){ inx = dirx/dist; iny = diry/dist; }
    else { target = null; inx = 0; iny = 0; }
  }

  // desired velocity
  const desiredSpeed = Math.hypot(inx, iny) > 0 ? Math.min(1, Math.hypot(inx,iny)) * player.maxSpeed : 0;
  const desiredVx = desiredSpeed * (inx === 0 && iny === 0 ? 0 : inx / (Math.hypot(inx,iny) || 1));
  const desiredVy = desiredSpeed * (inx === 0 && iny === 0 ? 0 : iny / (Math.hypot(inx,iny) || 1));

  // accelerate towards desired velocity
  const ax = desiredVx - player.vx;
  const ay = desiredVy - player.vy;
  const maxDelta = player.accel * dt;
  const deltaVx = Math.max(-maxDelta, Math.min(maxDelta, ax));
  const deltaVy = Math.max(-maxDelta, Math.min(maxDelta, ay));
  player.vx += deltaVx;
  player.vy += deltaVy;

  // attempt movement with axis-separated rectangle collision using player's bbox
  const w = SPRITE_PX * SPRITE_SCALE * 0.6; // narrower collision box than sprite for natural feel
  const h = SPRITE_PX * SPRITE_SCALE * 0.9;

  // X
  const newX = player.x + player.vx * dt;
  if(!rectBlockedAtWorld(newX, player.y, w, h)){
    player.x = newX;
  } else {
    player.vx = 0;
  }
  // Y
  const newY = player.y + player.vy * dt;
  if(!rectBlockedAtWorld(player.x, newY, w, h)){
    player.y = newY;
  } else {
    player.vy = 0;
  }

  // update facing based on horizontal velocity (smooth)
  if(Math.abs(player.vx) > 5) player.facing = player.vx < 0 ? 1 : 0;

  // update walk animation speed based on current speed ratio
  const speed = Math.hypot(player.vx, player.vy);
  const speedRatio = Math.min(1, speed / player.maxSpeed);
  const framePeriod = 0.28 - 0.2 * speedRatio; // faster when moving faster
  if(speed > 1){
    player.walkTimer += dt;
    if(player.walkTimer > framePeriod){ player.walkFrame = (player.walkFrame+1) % 2; player.walkTimer = 0; }
  } else {
    // idle reset
    player.walkTimer = 0;
    player.walkFrame = 0;
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

  // draw player (procedural 32x32 hero) centered with bob & facing
  const px = halfW;
  const py = halfH;
  const speed = Math.hypot(player.vx || 0, player.vy || 0);
  const speedRatio = Math.min(1, speed / player.maxSpeed);
  const bob = Math.sin((performance.now()/1000) * 8) * (speedRatio * 2);
  renderHero(ctx, px, py, player.walkFrame, !!player.facing, bob);

  // debug HUD
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(10,10,340,64);
  ctx.fillStyle = '#0b1220';
  ctx.font = '12px system-ui';
  ctx.fillText('Player: ('+player.x.toFixed(0)+', '+player.y.toFixed(0)+')', 18, 28);
  ctx.fillText('Tile: ('+Math.floor(player.x/TILE)+', '+Math.floor(player.y/TILE)+')', 18, 44);
  ctx.fillText('Speed: '+Math.round(speed), 18, 60);
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

// Clear caches and hard-reload handler (wired to #clear-cache-btn)
;(function(){
  const clearBtn = document.getElementById('clear-cache-btn');
  if(!clearBtn) return;
  clearBtn.addEventListener('click', async ()=>{
    clearBtn.disabled = true;
    const originalText = clearBtn.textContent;
    clearBtn.textContent = '캐시 삭제 중...';
    try{
      // delete CacheStorage entries
      if('caches' in window){
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      // unregister service workers
      if('serviceWorker' in navigator){
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      // clear storages
      try{ localStorage.clear(); sessionStorage.clear(); } catch(e){}
      // force reload cache-busted
      const url = window.location.origin + window.location.pathname + '?_=' + Date.now();
      // small timeout so UI updates before navigation
      setTimeout(()=> window.location.replace(url), 200);
    }catch(err){
      console.error('Cache clear failed', err);
      alert('캐시 삭제 중 오류가 발생했습니다. 콘솔을 확인하세요.');
      clearBtn.disabled = false;
      clearBtn.textContent = originalText;
    }
  });
})();
