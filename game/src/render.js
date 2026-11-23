// Everything the eye sees: the golden-hour city (roads, buildings with shaded
// roofs, beach and ocean, palms, lamps, the park), the cars and people, combat
// effects, and the HUD — cash, health, wanted stars, speed, the mission
// objective, the waypoint arrow, the message feed and the minimap — plus the
// title, pause, busted and win screens.

import {
  WORLD_W, WORLD_H, ROAD_LINES_X, ROAD_LINES_Y, ROAD_W, SAND_X, SEA_X,
  VIEW_W, VIEW_H, MAP_SIZE, MAP_GAP, RANKS,
} from './config.js';
import { clamp } from './rng.js';

const LAWN = '#8fae6d';
const SAND = '#e8cf9a';
const SEA = '#2e7fa8';
const ASPHALT = '#3d3a44';

export function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const cam = { x: 0, y: 0 };

  function followPlayer(state) {
    const tx = clamp(state.player.x - VIEW_W / 2, 0, Math.max(0, WORLD_W - VIEW_W));
    const ty = clamp(state.player.y - VIEW_H / 2, 0, Math.max(0, WORLD_H - VIEW_H));
    cam.x += (tx - cam.x) * 0.12;
    cam.y += (ty - cam.y) * 0.12;
  }

  // Put the camera straight on the player (a staged shot gets one frame).
  function jumpCamera(state) {
    cam.x = clamp(state.player.x - VIEW_W / 2, 0, Math.max(0, WORLD_W - VIEW_W));
    cam.y = clamp(state.player.y - VIEW_H / 2, 0, Math.max(0, WORLD_H - VIEW_H));
  }

  function toScreen(x, y) {
    return { x: x - cam.x, y: y - cam.y };
  }

  function paintGround(state) {
    ctx.fillStyle = LAWN;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Sand, then the ocean, on the east edge.
    const sand = toScreen(SAND_X, 0);
    ctx.fillStyle = SAND;
    ctx.fillRect(sand.x, 0, SEA_X - SAND_X, VIEW_H);
    const sea = toScreen(SEA_X, 0);
    ctx.fillStyle = SEA;
    ctx.fillRect(sea.x, 0, VIEW_W - sea.x, VIEW_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const wy = 60 + i * 160 + Math.sin(state.now * 1.5 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(sea.x, wy);
      ctx.lineTo(sea.x + 90, wy);
      ctx.stroke();
    }
    // The park block: lawn with a pond.
    const park = state.city.park;
    const pp = toScreen(park.x0, park.y0);
    ctx.fillStyle = '#6f9e57';
    ctx.fillRect(pp.x, pp.y, park.x1 - park.x0, park.y1 - park.y0);
    ctx.fillStyle = '#7fb3d9';
    ctx.beginPath();
    ctx.ellipse(pp.x + (park.x1 - park.x0) / 2, pp.y + (park.y1 - park.y0) / 2, 60, 40, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintRoads() {
    ctx.fillStyle = ASPHALT;
    for (const rx of ROAD_LINES_X) {
      const p = toScreen(rx - ROAD_W / 2, 0);
      ctx.fillRect(p.x, 0, ROAD_W, VIEW_H);
    }
    for (const ry of ROAD_LINES_Y) {
      const p = toScreen(0, ry - ROAD_W / 2);
      ctx.fillRect(0, p.y, VIEW_W, ROAD_W);
    }
    // Centre dashes.
    ctx.strokeStyle = '#e8d44f';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (const rx of ROAD_LINES_X) {
      const p = toScreen(rx, 0);
      ctx.beginPath();
      ctx.moveTo(p.x, -20);
      ctx.lineTo(p.x, VIEW_H + 20);
      ctx.stroke();
    }
    for (const ry of ROAD_LINES_Y) {
      const p = toScreen(0, ry);
      ctx.beginPath();
      ctx.moveTo(-20, p.y);
      ctx.lineTo(VIEW_W + 20, p.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Crosswalk stripes at every crossing.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of ROAD_LINES_X) {
      for (const ry of ROAD_LINES_Y) {
        const p = toScreen(rx, ry);
        for (let i = -2; i <= 2; i += 1) ctx.fillRect(p.x - 34 + i * 14, p.y - ROAD_W / 2 + 8, 8, 16);
      }
    }
  }

  function paintBlocks(state) {
    for (const b of state.city.buildings) {
      const p = toScreen(b.x, b.y);
      if (p.x > VIEW_W + 80 || p.y > VIEW_H + 80 || p.x + b.w < -80 || p.y + b.h < -80) continue;
      // A long sunset shadow, then walls and roof.
      ctx.fillStyle = 'rgba(60,30,20,0.25)';
      ctx.fillRect(p.x + 10, p.y + b.tall * 0.6 + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(p.x, p.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(p.x + 6, p.y + 6, b.w - 12, b.h - 12);
      // Lit windows.
      ctx.fillStyle = 'rgba(255,240,180,0.85)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 24));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i * 7 + j * 3 + b.w) % 4 === 0) continue;
          ctx.fillRect(p.x + 12 + i * ((b.w - 24) / cols), p.y + 12 + j * ((b.h - 24) / rows), 8, 9);
        }
      }
      // A neon strip for the buildings that have one.
      if (b.neon) {
        ctx.fillStyle = b.neon;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(p.x + b.w / 2 - 4, p.y - 8, 8, b.h + 4);
        ctx.globalAlpha = 1;
      }
    }
  }

  function paintProps(state) {
    for (const palm of state.city.palms) {
      const p = toScreen(palm.x, palm.y);
      if (p.x < -30 || p.x > VIEW_W + 30 || p.y < -30 || p.y > VIEW_H + 30) continue;
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 6, p.y - 26);
      ctx.stroke();
      ctx.fillStyle = '#3f8f4f';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(p.x + 6 + Math.cos(a) * 13, p.y - 26 + Math.sin(a) * 8, 14, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#2c2c34';
    for (const lamp of state.city.lamps) {
      const p = toScreen(lamp.x, lamp.y);
      if (p.x < -10 || p.x > VIEW_W + 10 || p.y < -10 || p.y > VIEW_H + 10) continue;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.fillStyle = '#8a6a4a';
    for (const bench of state.city.benches) {
      const p = toScreen(bench.x, bench.y);
      ctx.fillRect(p.x, p.y, 34, 10);
    }
  }

  function paintCar(car, isPlayer) {
    const p = toScreen(car.x, car.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 + 5, car.len, car.wid);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-car.len / 2, -car.wid / 2, car.len, car.wid, 7);
    ctx.fill();
    ctx.fillStyle = '#1d2733';
    ctx.fillRect(-8, -car.wid / 2 + 3, 18, car.wid - 6);
    ctx.fillStyle = '#dfe8f2';
    ctx.fillRect(car.len / 2 - 8, -car.wid / 2 + 4, 4, 5);
    ctx.fillRect(car.len / 2 - 8, car.wid / 2 - 9, 4, 5);
    if (car.kind === 'cop') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 + 2, car.len - 8, 6);
      const phase = Math.floor(performance.now() / 300) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
      ctx.beginPath();
      ctx.arc(0, -car.wid / 2 + 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
      ctx.beginPath();
      ctx.arc(0, car.wid / 2 - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.strokeRect(-car.len / 2 - 3, -car.wid / 2 - 3, car.len + 6, car.wid + 6);
    }
    ctx.restore();
  }

  function paintWalker(x, y, angle, color, bob, isCop) {
    const p = toScreen(x, y);
    const bounce = Math.sin(bob) * 1.5;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 5, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isCop ? '#20242e' : color;
    ctx.beginPath();
    ctx.arc(0, bounce - 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 3, bounce - 9, 5, 0, Math.PI * 2);
    ctx.fill();
    if (isCop) {
      ctx.fillStyle = '#20242e';
      ctx.fillRect(-6, bounce - 16, 12, 4);
    }
    ctx.restore();
  }

  function paintMarker(state) {
    const marker = state.missions.marker;
    if (!marker) return;
    const p = toScreen(marker.x, marker.y);
    const pulse = 1 + Math.sin(state.now * 4) * 0.12;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(12, -12);
    ctx.lineTo(-12, -12);
    ctx.closePath();
    ctx.fillStyle = '#ff5da2';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,210,63,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6, 30 * pulse, 12 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function paintPickups(state) {
    for (const p of state.missions.pickups) {
      if (p.taken) continue;
      const s = toScreen(p.x, p.y);
      ctx.fillStyle = '#37e08a';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9 + Math.sin(state.now * 5) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0c5a2e';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', s.x, s.y + 4);
    }
    for (const b of state.missions.bags) {
      if (b.taken) continue;
      const s = toScreen(b.x, b.y);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(s.x - 10, s.y - 7, 20, 14);
      ctx.fillStyle = '#7a5a00';
      ctx.fillRect(s.x - 10, s.y - 2, 20, 3);
    }
  }

  function paintEffects(state) {
    if (state.shot && state.shot.t > 0) {
      const a = toScreen(state.shot.x1, state.shot.y1);
      const b = toScreen(state.shot.x2, state.shot.y2);
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    const { player } = state;
    if (player.muzzle > 0) {
      const s = toScreen(player.x, player.y);
      ctx.fillStyle = '#ffdf6b';
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(player.angle) * 22, s.y + Math.sin(player.angle) * 22, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function paintMinimap(state) {
    const { size, gap } = { size: MAP_SIZE, gap: MAP_GAP };
    const x0 = gap;
    const y0 = VIEW_H - size - gap;
    const sx = size / WORLD_W;
    const sy = size / WORLD_H;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.82)';
    ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
    ctx.fillStyle = '#233a2a';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(x0 + SAND_X * sx, y0, size - SAND_X * sx, size);
    ctx.fillStyle = '#c9c9c9';
    for (const rx of ROAD_LINES_X) ctx.fillRect(x0 + rx * sx - 1, y0, 2, size);
    for (const ry of ROAD_LINES_Y) ctx.fillRect(x0, y0 + ry * sy, size, 2);
    const dot = (wx, wy, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x0 + wx * sx, y0 + wy * sy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (state.missions.marker) dot(state.missions.marker.x, state.missions.marker.y, '#ff5da2', 5);
    for (const cop of state.actors.patrol) dot(cop.x, cop.y, '#ff2e2e', 3);
    dot(state.player.x, state.player.y, '#ffd23f', 4);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', x0 + size - 12, y0 + 14);
    ctx.restore();
  }

  function paintStars(stars) {
    const x0 = VIEW_W - 190;
    const y0 = 16;
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', x0 + i * 30, y0 + 22);
    }
  }

  function paintHud(state) {
    const { player } = state;
    // Top-left: cash, rank, health bar.
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    ctx.fillRect(14, 14, 250, 74);
    ctx.fillStyle = '#37e08a';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${player.cash}`, 26, 44);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(RANKS[Math.min(player.missionsDone, RANKS.length - 1)], 26, 64);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(26, 70, 200, 10);
    ctx.fillStyle = player.health > 40 ? '#37e08a' : '#ff5a5a';
    ctx.fillRect(26, 70, 200 * clamp(player.health / 100, 0, 1), 10);
    // Top-right: wanted stars.
    paintStars(player.wanted.stars);
    // Top-centre: the live objective.
    const objective = state.objectiveText || '';
    if (objective) {
      ctx.font = 'bold 16px sans-serif';
      const w = ctx.measureText(objective).width + 28;
      ctx.fillStyle = 'rgba(10,14,24,0.72)';
      ctx.fillRect((VIEW_W - w) / 2, 14, w, 34);
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.fillText(objective, VIEW_W / 2, 37);
    }
    // Waypoint: distance and an edge arrow pointing at it.
    const marker = state.missions.marker;
    if (marker) {
      const d = Math.hypot(player.x - marker.x, player.y - marker.y);
      const angle = Math.atan2(marker.y - player.y, marker.x - player.x);
      const cx = VIEW_W / 2;
      const cy = 96;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = '#ff5da2';
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(8, -9);
      ctx.lineTo(8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(d)}m  ·  ${marker.label}`, cx, cy + 34);
    }
    // Bottom-right: speed, ammo and mission count.
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    ctx.fillRect(VIEW_W - 214, VIEW_H - 74, 200, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    if (player.mode === 'car' && player.car) {
      ctx.fillText(`${Math.round(Math.abs(player.car.speed) * 0.18)} km/h`, VIEW_W - 26, VIEW_H - 42);
    } else {
      ctx.fillText('ON FOOT', VIEW_W - 26, VIEW_H - 42);
    }
    ctx.font = '13px sans-serif';
    ctx.fillText(`Ammo ${player.ammo}  ·  Missions ${player.missionsDone}/5`, VIEW_W - 26, VIEW_H - 22);
    // Message feed, newest last, fading out.
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    let my = VIEW_H - 96;
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      const msg = state.messages[i];
      ctx.globalAlpha = clamp(msg.life / 2, 0, 1);
      ctx.fillStyle = 'rgba(10,14,24,0.72)';
      const w = ctx.measureText(msg.text).width + 20;
      ctx.fillRect((VIEW_W - w) / 2, my - 16, w, 22);
      ctx.fillStyle = '#fff';
      ctx.fillText(msg.text, VIEW_W / 2, my);
      ctx.globalAlpha = 1;
      my -= 26;
    }
    // Controls hint.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WASD move/drive · E enter car · F punch · Click shoot · Shift run · Esc pause · G save · M mute', VIEW_W - 14, VIEW_H - 84);
    paintMinimap(state);
    // Low-health red vignette, pulsing.
    if (player.health < 35) {
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H / 3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255,0,0,${0.35 + Math.sin(state.now * 6) * 0.1})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function paintTitle(state) {
    ctx.fillStyle = 'rgba(20,8,32,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 92px sans-serif';
    ctx.fillText('SOLMAR', VIEW_W / 2, 210);
    ctx.fillStyle = '#ff5da2';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('A NEON COAST STORY', VIEW_W / 2, 252);
    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    ctx.fillText('Mara Reyes is back in Solmar — broke, wanted, and one big score away from freedom.', VIEW_W / 2, 300);
    ctx.fillText('Steal cars, outrun the cops, run five missions and take the bank.', VIEW_W / 2, 326);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('PRESS ENTER TO START', VIEW_W / 2, 400);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '15px sans-serif';
    ctx.fillText('WASD move / drive · E enter & steal cars · F punch · Mouse + click shoot · Shift run', VIEW_W / 2, 448);
    ctx.fillText('Esc pause · G save · M mute · Your progress saves to this browser', VIEW_W / 2, 472);
    if (state.hasSave) {
      ctx.fillStyle = '#37e08a';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Saved game found — press ENTER to continue your story', VIEW_W / 2, 516);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px sans-serif';
    ctx.fillText('An original game. Not affiliated with any commercial game series.', VIEW_W / 2, 690);
  }

  function paintPaused(state) {
    ctx.fillStyle = 'rgba(8,10,20,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('PAUSED', VIEW_W / 2, 260);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('Esc resume · G save game · Enter restart the story', VIEW_W / 2, 310);
    ctx.fillStyle = '#fff';
    ctx.fillText(`Cash $${state.player.cash} · Missions ${state.player.missionsDone}/5 · Fares ${state.player.faresDone}`, VIEW_W / 2, 350);
  }

  function paintBusted(title, subtitle) {
    ctx.fillStyle = 'rgba(20,4,8,0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 76px sans-serif';
    ctx.fillText(title, VIEW_W / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText(subtitle, VIEW_W / 2, 350);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('PRESS ENTER TO TRY AGAIN', VIEW_W / 2, 420);
  }

  function paintWon(state) {
    ctx.fillStyle = 'rgba(8,24,16,0.8)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('KINGPIN OF SOLMAR', VIEW_W / 2, 280);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('The bank job is done. The city is yours, Mara.', VIEW_W / 2, 330);
    ctx.fillText(`Final cash $${state.player.cash} · Missions 5/5 · Fares ${state.player.faresDone} · Pickups ${state.player.pickups}`, VIEW_W / 2, 370);
    ctx.fillStyle = '#37e08a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('PRESS ENTER TO KEEP PLAYING IN FREE ROAM', VIEW_W / 2, 430);
  }

  function toWorld(x, y) {
    return { x: x + cam.x, y: y + cam.y };
  }

  function paint(state, screen) {
    followPlayer(state);
    paintGround(state);
    paintRoads();
    paintBlocks(state);
    paintProps(state);
    paintPickups(state);
    if (screen === 'play' || screen === 'paused') paintMarker(state);
    for (const car of state.actors.parked) paintCar(car, false);
    for (const car of state.actors.traffic) paintCar(car, false);
    for (const car of state.actors.patrol) paintCar(car, false);
    if (state.player.mode === 'car' && state.player.car) paintCar(state.player.car, true);
    for (const ped of state.actors.walkers) {
      if (ped.alive) paintWalker(ped.x, ped.y, ped.angle, ped.color, ped.bob, false);
    }
    for (const cop of state.actors.beat) paintWalker(cop.x, cop.y, cop.angle, '#20242e', state.now * 8, true);
    if (state.player.mode === 'foot') {
      paintWalker(state.player.x, state.player.y, state.player.angle, '#ff5da2', state.now * 10, false);
      // The pistol in her hand, pointing where she aims.
      const s = toScreen(state.player.x, state.player.y);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s.x + Math.cos(state.player.angle) * 10, s.y + Math.sin(state.player.angle) * 10);
      ctx.lineTo(s.x + Math.cos(state.player.angle) * 20, s.y + Math.sin(state.player.angle) * 20);
      ctx.stroke();
    }
    paintEffects(state);
    // Golden-hour sun wash over everything.
    const wash = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    wash.addColorStop(0, 'rgba(255,180,90,0.10)');
    wash.addColorStop(1, 'rgba(255,90,140,0.06)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (screen === 'play') paintHud(state);
    else if (screen === 'title') paintTitle(state);
    else if (screen === 'paused') { paintHud(state); paintPaused(state); }
    else if (screen === 'over') paintBusted('BUSTED', 'The Solmar PD caught up with you. Your cash took a hit.');
    else if (screen === 'win') paintWon(state);
  }

  return { paint, followPlayer, jumpCamera, toScreen, toWorld };
}
