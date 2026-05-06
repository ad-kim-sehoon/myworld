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
const player = {x:0,y:0,vx:0,vy:0,maxSpeed:100,accel:800, walkFrame:0, walkTimer:0, walkFrames:6, facing:0};
let target = null;
const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true; });
window.addEventListener('keyup', e => { keys[e.key] = false; });

// Procedural 32x32 pixel hero renderer with multi-frame walk animation and flip (palette-mapped)
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

  // per-frame offsets to simulate smoother limb movement (6 frames)
  const armShift = [0,-1, -2, -1, 1, 0];
  const armShiftRight = [0,1,2,1,-1,0];
  const legShift = [0,-1, -2, -1, 1, 0];

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

      // shirt (body)
      if(py >= 13 && py <= 20 && px >= 10 && px <= 21) color = '#2b6cb0';

      // arms: use frame shifts
      if(py >= 14 && py <= 17){
        const ls = armShift[frame];
        const rs = armShiftRight[frame];
        if((px >= 7+ls && px <= 9+ls) || (px >= 22+rs && px <= 24+rs)) color = '#2b6cb0';
      }

      // pants and legs: shifted per frame
      if(py >= 21 && py <= 29){
        const lshift = legShift[frame];
        const rshift = -legShift[frame];
        if((px >= 11 + lshift && px <= 15 + lshift) || (px >= 17 + rshift && px <= 21 + rshift)) color = '#2b2b2b';
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
// Tree density & types with regional modifiers
const TREE_GLOBAL_DENSITY = 4; // percent (base density)
let TREE_GLOBAL_SCALE = 0.2; // global scale multiplier (0.2 removes ~80% of trees) // global scale multiplier (0.4 removes ~60% of trees) // global scale multiplier (set <1 to remove percentage of trees)
// Quickly reduce object counts by multiplying TREE_GLOBAL_SCALE (e.g., 0.4 removes ~60%)
function regionDensityModifier(tx,ty){
  // Simple region rules to create paths and clearings
  // Create vertical/horizontal paths every 50 tiles
  const mx = Math.abs(tx) % 50;
  const my = Math.abs(ty) % 50;
  if((mx >= 20 && mx <= 30) || (my >= 20 && my <= 30)) return 0; // path
  // occasional circular clearing centers
  if(((tx % 97) === 0 && (ty % 61) === 0)) return 0;
  return 1; // default no change
}
function treeDensityAt(tx,ty){
  if(tileTypeAt(tx,ty) !== 'forest') return 0;
  const base = TREE_GLOBAL_DENSITY; // percent
  const mod = regionDensityModifier(tx,ty);
  const scaled = Math.round(base * mod * TREE_GLOBAL_SCALE);
  return Math.max(0, Math.min(100, scaled));
}
function hasTreeAt(tx,ty){
  const density = treeDensityAt(tx,ty);
  if(density <= 0) return false;
  return (hash2(tx,ty) % 100) < density;
}

// Tree type: 'large' (possible collidable) vs 'small' (decorative)
function treeTypeAt(tx,ty){
  // stable pseudo-random choice per tile
  const v = hash2(tx+7,ty+13) % 100;
  return v < 18 ? 'large' : 'small'; // ~18% of trees are large
}
function tileBlocked(tx,ty){
  // only fully blocked tiles: water and rock
  const t = tileTypeAt(tx,ty);
  if(t === 'water' || t === 'rock') return true;
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
// For trees we use a smaller circular collision around the tree center so player can pass near trunks
// Improvements: only some trees are collidable and large trees are prioritised; far-away trees are ignored.
const TREE_COLLIDABLE_PERCENT = 25; // % of large trees that are solid
const TREE_COLLIDE_IGNORE_DIST = 360; // world pixels beyond which tree collision is ignored
function isTreeCollidable(tx,ty){
  if(!hasTreeAt(tx,ty)) return false;
  const type = treeTypeAt(tx,ty);
  if(type !== 'large') return false; // only large ones block by default
  // use a hashed subset to decide solidity (stable)
  const v = hash2(tx+3,ty+5) % 100;
  return v < TREE_COLLIDABLE_PERCENT;
}
function rectBlockedAtWorld(cx, cy, w, h){
  // cx,cy are center coordinates
  const left = Math.floor((cx - w/2) / TILE);
  const right = Math.floor((cx + w/2) / TILE);
  const top = Math.floor((cy - h/2) / TILE);
  const bottom = Math.floor((cy + h/2) / TILE);
  for(let ty = top; ty <= bottom; ty++){
    for(let tx = left; tx <= right; tx++){
      const t = tileTypeAt(tx,ty);
      if(t === 'water' || t === 'rock') return true;
      if(t === 'forest' && hasTreeAt(tx,ty)){
        if(!isTreeCollidable(tx,ty)) continue; // decorative or non-solid tree
        // tree collision: circle at tile center with radius scaled to hero
        const treeCx = tx * TILE + TILE/2;
        const treeCy = ty * TILE + TILE/2;
        const treeRadius = Math.max(4, Math.round(SPRITE_PX * SPRITE_SCALE * 0.12));
        // ignore far trees for collision (they are rendered small and should not block)
        const dxp = treeCx - player.x;
        const dyp = treeCy - player.y;
        const distToPlayer = Math.hypot(dxp, dyp);
        if(distToPlayer > TREE_COLLIDE_IGNORE_DIST) continue;
        // rectangle bounds
        const rx1 = cx - w/2, ry1 = cy - h/2;
        const rx2 = cx + w/2, ry2 = cy + h/2;
        // closest point on rect to circle center
        const closestX = Math.max(rx1, Math.min(treeCx, rx2));
        const closestY = Math.max(ry1, Math.min(treeCy, ry2));
        const dx = treeCx - closestX;
        const dy = treeCy - closestY;
        if(dx*dx + dy*dy <= treeRadius * treeRadius) return true;
      }
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
  // collision box slightly smaller than sprite to avoid snagging on small background dots
  const w = SPRITE_PX * SPRITE_SCALE * 0.5; // narrower
  const h = SPRITE_PX * SPRITE_SCALE * 0.85; // a bit shorter

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
  const basePeriod = 0.28 - 0.18 * speedRatio; // base cycle period
  const framePeriod = basePeriod / Math.max(1, player.walkFrames);
  if(speed > 1){
    player.walkTimer += dt;
    if(player.walkTimer > framePeriod){ player.walkFrame = (player.walkFrame+1) % player.walkFrames; player.walkTimer = 0; }
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
        // scaled grass detail (use TILE-relative positioning)
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        const dotSize = Math.max(1, Math.round(TILE * 0.6));
        ctx.fillRect(Math.round(sx + TILE * 0.3), Math.round(sy + TILE * 0.3), dotSize, dotSize);
      }

      // draw rock as a larger rounded blob for better proportion with hero
      if(type === 'rock'){
        const rockColor = mapToPalette('#9ca3af');
        ctx.fillStyle = rockColor;
        const rw = Math.max(6, Math.round(SPRITE_PX * SPRITE_SCALE * 0.18));
        const rh = Math.max(4, Math.round(rw * 0.7));
        ctx.beginPath();
        ctx.ellipse(Math.round(sx + TILE/2), Math.round(sy + TILE/2), Math.round(rw/2), Math.round(rh/2), 0, 0, Math.PI*2);
        ctx.fill();
      }

      // draw tree on forest tiles if present (scaled to character) with shadow and LOD
      if(type === 'forest' && hasTreeAt(tx,ty)){
        // world position of tile center
        const treeWorldX = tx * TILE + TILE/2;
        const treeWorldY = ty * TILE + TILE/2;
        const dxp = treeWorldX - player.x;
        const dyp = treeWorldY - player.y;
        const dist = Math.hypot(dxp, dyp);
        // LOD thresholds (in world pixels)
        const LOD_NEAR = 220;
        const LOD_FAR = 420;
        // mapping to screen coords
        const treeBaseX = Math.round(sx + TILE/2);
        const treeBaseY = Math.round(sy + TILE/2);
        const type = treeTypeAt(tx,ty);
        // base sizes (visual)
        const foliageRadiusFull = Math.max(6, Math.round(SPRITE_PX * SPRITE_SCALE * (type === 'large' ? 0.35 : 0.18)));
        const trunkWidthFull = Math.max(2, Math.round(SPRITE_PX * SPRITE_SCALE * (type === 'large' ? 0.12 : 0.06)));
        const trunkHeightFull = Math.max(2, Math.round(SPRITE_PX * SPRITE_SCALE * (type === 'large' ? 0.22 : 0.10)));

        // shadow (subtle ellipse under tree)
        ctx.fillStyle = type === 'large' ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.ellipse(treeBaseX, treeBaseY + Math.round(foliageRadiusFull*0.35), Math.round(foliageRadiusFull*0.9), Math.round(foliageRadiusFull*0.35), 0, 0, Math.PI*2);
        ctx.fill();

        if(dist < LOD_NEAR){
          // full detail
          ctx.fillStyle = mapToPalette('#0b6623');
          ctx.beginPath();
          ctx.ellipse(treeBaseX, treeBaseY - Math.round(trunkHeightFull/2), foliageRadiusFull, Math.round(foliageRadiusFull * 0.8), 0, 0, Math.PI*2);
          ctx.fill();
          if(type === 'large'){
            ctx.fillStyle = mapToPalette('#8b5a2b');
            ctx.fillRect(treeBaseX - Math.floor(trunkWidthFull/2), treeBaseY + Math.floor(foliageRadiusFull * 0.2), trunkWidthFull, trunkHeightFull);
          }
        } else if(dist < LOD_FAR){
          // medium detail: smaller foliage and thinner trunk
          const scale = type === 'large' ? 0.6 : 0.5;
          ctx.fillStyle = mapToPalette('#0b6623');
          ctx.beginPath();
          ctx.ellipse(treeBaseX, treeBaseY - Math.round(trunkHeightFull*scale/2), Math.round(foliageRadiusFull*scale), Math.round(foliageRadiusFull * 0.8 * scale), 0, 0, Math.PI*2);
          ctx.fill();
          if(type === 'large'){
            ctx.fillStyle = mapToPalette('#8b5a2b');
            ctx.fillRect(treeBaseX - Math.floor(trunkWidthFull*scale/2), treeBaseY + Math.floor(foliageRadiusFull * 0.2 * scale), Math.max(1, Math.round(trunkWidthFull*scale)), Math.max(2, Math.round(trunkHeightFull*scale)));
          }
        } else {
          // far: tiny leaf dot only (small trees even smaller)
          const dotSize = type === 'large' ? 3 : 1;
          ctx.fillStyle = mapToPalette('#0b6623');
          ctx.fillRect(treeBaseX - Math.floor(dotSize/2), treeBaseY - Math.floor(dotSize/2), dotSize, dotSize);
        }
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
