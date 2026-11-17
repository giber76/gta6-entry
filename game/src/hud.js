// HUD: health bar, cash, wanted stars, objective text, speed, prompts,
// dialogue box, toasts and the damage vignette. All DOM, updated from the
// game state each frame; the minimap itself lives in minimap.js.
import { Minimap } from './minimap.js';

export class HUD {
  constructor() {
    this.el = document.getElementById('hud');
    this.healthFill = document.getElementById('healthFill');
    this.cash = document.getElementById('cash');
    this.stars = document.getElementById('stars');
    this.missionName = document.getElementById('missionName');
    this.missionText = document.getElementById('missionText');
    this.speedo = document.getElementById('speedo');
    this.speed = document.getElementById('speed');
    this.crosshair = document.getElementById('crosshair');
    this.prompt = document.getElementById('prompt');
    this.dialogue = document.getElementById('dialogue');
    this.dialogueWho = document.getElementById('dialogueWho');
    this.dialogueText = document.getElementById('dialogueText');
    this.toastEl = document.getElementById('toast');
    this.damage = document.getElementById('damage');
    this.minimap = new Minimap(document.getElementById('minimap'));
    this.toastTimer = 0;
    this.lastStars = -1;
  }
  show() { this.el.classList.add('on'); }
  hide() { this.el.classList.remove('on'); }
  toast(text, seconds) {
    this.toastEl.textContent = text;
    this.toastEl.style.display = 'block';
    this.toastTimer = seconds || 3.5;
  }
  showPrompt(html) { this.prompt.innerHTML = html; this.prompt.style.display = 'block'; }
  hidePrompt() { this.prompt.style.display = 'none'; }
  update(dt, G) {
    const p = G.player;
    this.healthFill.style.width = `${Math.max(0, p.health)}%`;
    this.healthFill.style.background = p.health > 50 ? 'linear-gradient(90deg,#37d67a,#a5e635)'
      : p.health > 25 ? 'linear-gradient(90deg,#e8a13a,#e8d84a)' : 'linear-gradient(90deg,#d83a3a,#e86a3a)';
    this.cash.textContent = p.cash.toLocaleString('en-US');
    const w = G.police.wanted;
    if (w !== this.lastStars) {
      this.lastStars = w;
      let html = '';
      for (let i = 0; i < 5; i++) html += `<span class="${i < w ? '' : 'off'}">★</span>`;
      this.stars.innerHTML = html;
    }
    this.missionName.textContent = G.missions.missionName();
    this.missionText.textContent = G.missions.objectiveText();
    if (p.inCar) {
      this.speedo.style.display = 'block';
      this.speed.textContent = Math.round(Math.abs(p.inCar.speed) * 3.6);
    } else this.speedo.style.display = 'none';
    this.crosshair.style.display = (!p.inCar && p.weapon === 'pistol') ? 'block' : 'none';
    // dialogue
    const d = G.missions.dialogue[0];
    if (d) {
      this.dialogue.style.display = 'block';
      this.dialogueWho.textContent = d.who + ':';
      this.dialogueText.textContent = d.text;
    } else this.dialogue.style.display = 'none';
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.display = 'none';
    }
    this.damage.style.display = (p.health > 0 && p.health < 35) ? 'block' : 'none';
    this.minimap.draw(G);
  }
}
