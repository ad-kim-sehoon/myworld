// Minimal pixel open-world prototype (tile-based)
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

// World settings
const TILE = 24; // pixel tile size
const VIEW_TILES_X = Math.ceil(window.innerWidth / TILE) + 4;
const VIEW_TILES_Y = Math.ceil(window.innerHeight / TILE) + 4;

// Player
const player = {x: 0, y:0, speed: 140}; // world coords in pixels
let target = null;

// Simple deterministic pseudo-random terrain using hash of coords
function hash2(x,y){
  let n = x*374761393 + y*668265263; n = (n^(n>>13))*1274126177; return (n ^ (n>>16)) >>> 0;
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

// Input
const keys = {};
window.addEventListener('keydown', e=>{ keys[e.key]=true; });
window.addEventListener('keyup', e=>{ keys[e.key]=false; });

canvas.addEventListener('pointerdown', e=>{
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left);
  const cy = (e.clientY - rect.top);
  target = {x: cx, y: cy};
});

function update(dt){
  let vx=0, vy=0;
  if(keys['ArrowUp']||keys['w']) vy -= 1;
  if(keys['ArrowDown']||keys['s']) vy += 1;
  if(keys['ArrowLeft']||keys['a']) vx -= 1;
  if(keys['ArrowRight']||keys['d']) vx += 1;
  if(vx!==0||vy!==0){
    const len = Math.hypot(vx,vy)||1; vx/=len; vy/=len;
    player.x += vx * player.speed * dt;
    player.y += vy * player.speed * dt;
    target = null;
  } else if(target){
    // move toward target in screen space
    // convert screen target to world coords
    const screenCenterX = window.innerWidth/2;
    const screenCenterY = window.innerHeight/2;
    // world coords of screen center (player follows center)
    const worldCenterX = player.x;
    const worldCenterY = player.y;
    // desired world position for player based on click: convert screen cx/cy into world coords
    // screen point is relative to center
    const dx = target.x - screenCenterX;
    const dy = target.y - screenCenterY;
    const desiredX = worldCenterX + dx;
    const desiredY = worldCenterY + dy;
    const dirx = desiredX - player.x;
    const diry = desiredY - player.y;
    const dist = Math.hypot(dirx, diry);
    if(dist > 4){
      player.x += (dirx/dist) * player.speed * dt;
      player.y += (diry/dist) * player.speed * dt;
    } else {
      target = null;
    }
  }
}

function draw(){
  // clear
  ctx.fillStyle = '#e6f0ff';
  ctx.fillRect(0,0,canvas.width/DPR, canvas.height/DPR);

  const halfW = (canvas.width/DPR)/2;
  const halfH = (canvas.height/DPR)/2;

  // camera centered on player
  const camX = player.x - halfW;
  const camY = player.y - halfH;

  // draw tiles
  const startTx = Math.floor(camX / TILE) - 1;
  const startTy = Math.floor(camY / TILE) - 1;
  const endTx = Math.floor((camX + canvas.width/DPR)/TILE) + 1;
  const endTy = Math.floor((camY + canvas.height/DPR)/TILE) + 1;

  for(let ty=startTy; ty<=endTy; ty++){
    for(let tx=startTx; tx<=endTx; tx++){
      const type = tileTypeAt(tx, ty);
      ctx.fillStyle = tileColor(type);
      const sx = tx * TILE - camX;
      const sy = ty * TILE - camY;
      // draw pixelated tile
      ctx.fillRect(Math.round(sx), Math.round(sy), TILE+1, TILE+1);
      // small pattern
      if(type==='grass'){
        ctx.fillStyle = 'rgba(0,0,0,0.02)';
        ctx.fillRect(Math.round(sx+4), Math.round(sy+4), 2,2);
      }
    }
  }

  // draw player as rectangle in center
  const px = halfW;
  const py = halfH;
  ctx.fillStyle = '#111827';
  ctx.fillRect(px-8, py-8, 16,16);

  // debug HUD
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(10,10,220,48);
  ctx.fillStyle = '#0b1220';
  ctx.font = '12px system-ui';
  ctx.fillText('Player: ('+player.x.toFixed(0)+', '+player.y.toFixed(0)+')', 18, 28);
  ctx.fillText('Tile center: ('+Math.floor(player.x/TILE)+', '+Math.floor(player.y/TILE)+')', 18, 44);
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
