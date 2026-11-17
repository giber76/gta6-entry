// Minimap: a 2D top-down canvas of Solara Bay — roads, beach, player arrow,
// cars (white), police (blue/red flashing), mission marker (yellow diamond),
// enemies (red dots). North is up; the view follows the player.
import { CITY_HALF } from './city.js';

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
  }
  draw(G) {
    const ctx = this.ctx, S = this.size;
    const scale = S / (CITY_HALF * 2 + 80);
    const toX = (x) => S / 2 + x * scale;
    const toY = (z) => S / 2 + z * scale;
    ctx.clearRect(0, 0, S, S);
    // sea + sand + land
    ctx.fillStyle = '#123a4d'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#e8d29a'; ctx.fillRect(0, toY(180), S, S - toY(180));
    ctx.fillStyle = '#2c4a3a'; ctx.fillRect(0, 0, S, toY(180));
    // blocks
    ctx.fillStyle = '#3d5a48';
    for (let x = -170; x < 180; x += 60) for (let z = -170; z < 150; z += 60) {
      ctx.fillRect(toX(x - 28), toY(z - 28), 56 * scale, 56 * scale);
    }
    // roads
    ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 9 * scale;
    for (const c of [-150, -90, -30, 30, 90, 150]) {
      ctx.beginPath(); ctx.moveTo(toX(c), 0); ctx.lineTo(toX(c), toY(180)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toY(c)); ctx.lineTo(S, toY(c)); ctx.stroke();
    }
    const dot = (x, z, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(toX(x), toY(z), r, 0, Math.PI * 2); ctx.fill();
    };
    // mission marker
    if (G.missions.markerPos) {
      const m = G.missions.markerPos;
      ctx.fillStyle = '#ffd23e';
      ctx.save(); ctx.translate(toX(m.x), toY(m.z)); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    }
    // traffic + parked cars
    for (const c of G.cars) {
      if (c === G.player.inCar) continue;
      dot(c.pos.x, c.pos.z, 2.2, c.kind === 'police' ? '#3a86ff' : '#ffffff');
    }
    // enemies
    for (const e of G.combat.enemies) dot(e.pos.x, e.pos.z, 2.6, '#ff4444');
    // police officers
    for (const o of G.police.officers) dot(o.pos.x, o.pos.z, 2.6, '#3a86ff');
    // player arrow
    const p = G.player;
    ctx.save();
    ctx.translate(toX(p.pos.x), toY(p.pos.z));
    const heading = p.inCar ? p.inCar.heading : p.heading;
    ctx.rotate(heading);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
}
