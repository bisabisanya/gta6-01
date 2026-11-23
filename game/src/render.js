// All drawing: the golden-hour city (roads, buildings with shaded roofs, beach and ocean,
// palms, lamps, park), cars, people, combat effects, and the HUD — cash, health, wanted stars,
// speed, mission objective, waypoint arrow, message feed and the minimap — plus the title,
// pause, busted and win screens.
import { WORLD, ROADS_X, ROADS_Y, ROAD_WIDTH, BEACH_X, OCEAN_X, VIEW, MINIMAP, RANKS, PLAYER } from './config.js';
import { clamp } from './random.js';

const SKY = '#ffd9a0';
const GRASS = '#8fae6d';
const SAND = '#e8cf9a';
const OCEAN = '#2e7fa8';
const ROAD = '#3d3a44';
const SIDEWALK_COL = '#b9b3a4';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const camera = { x: 0, y: 0 };

  function updateCamera(state) {
    const targetX = clamp(state.player.x - VIEW.width / 2, 0, Math.max(0, WORLD.width - VIEW.width));
    const targetY = clamp(state.player.y - VIEW.height / 2, 0, Math.max(0, WORLD.height - VIEW.height));
    camera.x += (targetX - camera.x) * 0.12;
    camera.y += (targetY - camera.y) * 0.12;
  }

  // Jump the camera straight onto the player (screenshots stage one frame, no time to pan).
  function snapCamera(state) {
    camera.x = clamp(state.player.x - VIEW.width / 2, 0, Math.max(0, WORLD.width - VIEW.width));
    camera.y = clamp(state.player.y - VIEW.height / 2, 0, Math.max(0, WORLD.height - VIEW.height));
  }

  function worldToScreen(x, y) {
    return { x: x - camera.x, y: y - camera.y };
  }

  function drawGround(state) {
    ctx.fillStyle = GRASS;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Beach and ocean on the east edge.
    const beach = worldToScreen(BEACH_X, 0);
    ctx.fillStyle = SAND;
    ctx.fillRect(beach.x, 0, OCEAN_X - BEACH_X, VIEW.height);
    const ocean = worldToScreen(OCEAN_X, 0);
    ctx.fillStyle = OCEAN;
    ctx.fillRect(ocean.x, 0, VIEW.width - ocean.x, VIEW.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const wy = 60 + i * 160 + Math.sin(state.now * 1.5 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(ocean.x, wy);
      ctx.lineTo(ocean.x + 90, wy);
      ctx.stroke();
    }
    // Park block.
    const park = state.world.parkBlock;
    const pp = worldToScreen(park.x0, park.y0);
    ctx.fillStyle = '#6f9e57';
    ctx.fillRect(pp.x, pp.y, park.x1 - park.x0, park.y1 - park.y0);
    ctx.fillStyle = '#7fb3d9';
    ctx.beginPath();
    ctx.ellipse(pp.x + (park.x1 - park.x0) / 2, pp.y + (park.y1 - park.y0) / 2, 60, 40, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRoads() {
    ctx.fillStyle = ROAD;
    for (const rx of ROADS_X) {
      const p = worldToScreen(rx - ROAD_WIDTH / 2, 0);
      ctx.fillRect(p.x, 0, ROAD_WIDTH, VIEW.height);
    }
    for (const ry of ROADS_Y) {
      const p = worldToScreen(0, ry - ROAD_WIDTH / 2);
      ctx.fillRect(0, p.y, VIEW.width, ROAD_WIDTH);
    }
    // Centre dashes.
    ctx.strokeStyle = '#e8d44f';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (const rx of ROADS_X) {
      const p = worldToScreen(rx, 0);
      ctx.beginPath();
      ctx.moveTo(p.x, -20);
      ctx.lineTo(p.x, VIEW.height + 20);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      const p = worldToScreen(0, ry);
      ctx.beginPath();
      ctx.moveTo(-20, p.y);
      ctx.lineTo(VIEW.width + 20, p.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Crosswalk stripes at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        const p = worldToScreen(rx, ry);
        for (let i = -2; i <= 2; i += 1) ctx.fillRect(p.x - 34 + i * 14, p.y - ROAD_WIDTH / 2 + 8, 8, 16);
      }
    }
  }

  function drawBuildings(state) {
    for (const b of state.world.buildings) {
      const p = worldToScreen(b.x, b.y);
      if (p.x > VIEW.width + 80 || p.y > VIEW.height + 80 || p.x + b.w < -80 || p.y + b.h < -80) continue;
      // Long sunset shadow.
      ctx.fillStyle = 'rgba(60,30,20,0.25)';
      ctx.fillRect(p.x + 10, p.y + b.height * 0.6 + 8, b.w, b.h);
      // Walls and roof.
      ctx.fillStyle = b.color;
      ctx.fillRect(p.x, p.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(p.x + 6, p.y + 6, b.w - 12, b.h - 12);
      // Windows.
      ctx.fillStyle = 'rgba(255,240,180,0.85)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 24));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i * 7 + j * 3 + b.w) % 4 === 0) continue;
          ctx.fillRect(p.x + 12 + i * ((b.w - 24) / cols), p.y + 12 + j * ((b.h - 24) / rows), 8, 9);
        }
      }
      // Neon sign glow.
      if (b.neon) {
        ctx.fillStyle = b.neon;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(p.x + b.w / 2 - 4, p.y - 8, 8, b.h + 4);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawProps(state) {
    for (const palm of state.world.palms) {
      const p = worldToScreen(palm.x, palm.y);
      if (p.x < -30 || p.x > VIEW.width + 30 || p.y < -30 || p.y > VIEW.height + 30) continue;
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
    for (const lamp of state.world.lamps) {
      const p = worldToScreen(lamp.x, lamp.y);
      if (p.x < -10 || p.x > VIEW.width + 10 || p.y < -10 || p.y > VIEW.height + 10) continue;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.fillStyle = '#8a6a4a';
    for (const bench of state.world.benches) {
      const p = worldToScreen(bench.x, bench.y);
      ctx.fillRect(p.x, p.y, 34, 10);
    }
  }

  function drawCar(car, isPlayer) {
    const p = worldToScreen(car.x, car.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-car.length / 2 + 4, -car.width / 2 + 5, car.length, car.width);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-car.length / 2, -car.width / 2, car.length, car.width, 7);
    ctx.fill();
    ctx.fillStyle = '#1d2733';
    ctx.fillRect(-8, -car.width / 2 + 3, 18, car.width - 6);
    ctx.fillStyle = '#dfe8f2';
    ctx.fillRect(car.length / 2 - 8, -car.width / 2 + 4, 4, 5);
    ctx.fillRect(car.length / 2 - 8, car.width / 2 - 9, 4, 5);
    if (car.kind === 'cop') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-car.length / 2 + 4, -car.width / 2 + 2, car.length - 8, 6);
      ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#ff2e2e' : '#2e6bff';
      ctx.beginPath();
      ctx.arc(0, -car.width / 2 + 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#2e6bff' : '#ff2e2e';
      ctx.beginPath();
      ctx.arc(0, car.width / 2 - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.strokeRect(-car.length / 2 - 3, -car.width / 2 - 3, car.length + 6, car.width + 6);
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, bob, isCop) {
    const p = worldToScreen(x, y);
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

  function drawMarker(state) {
    const marker = state.missions.marker;
    if (!marker) return;
    const p = worldToScreen(marker.x, marker.y);
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
    // Ground ring.
    ctx.strokeStyle = 'rgba(255,210,63,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6, 30 * pulse, 12 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPickups(state) {
    for (const p of state.missions.pickups) {
      if (p.taken) continue;
      const s = worldToScreen(p.x, p.y);
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
      const s = worldToScreen(b.x, b.y);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(s.x - 10, s.y - 7, 20, 14);
      ctx.fillStyle = '#7a5a00';
      ctx.fillRect(s.x - 10, s.y - 2, 20, 3);
    }
  }

  function drawEffects(state) {
    if (state.shot && state.shot.t > 0) {
      const a = worldToScreen(state.shot.x1, state.shot.y1);
      const b = worldToScreen(state.shot.x2, state.shot.y2);
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    const { player } = state;
    if (player.muzzle > 0) {
      const s = worldToScreen(player.x, player.y);
      ctx.fillStyle = '#ffdf6b';
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(player.angle) * 22, s.y + Math.sin(player.angle) * 22, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMinimap(state) {
    const { size, margin } = MINIMAP;
    const x0 = margin;
    const y0 = VIEW.height - size - margin;
    const sx = size / WORLD.width;
    const sy = size / WORLD.height;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.82)';
    ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
    ctx.fillStyle = '#233a2a';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(x0 + BEACH_X * sx, y0, size - BEACH_X * sx, size);
    ctx.fillStyle = '#c9c9c9';
    for (const rx of ROADS_X) ctx.fillRect(x0 + rx * sx - 1, y0, 2, size);
    for (const ry of ROADS_Y) ctx.fillRect(x0, y0 + ry * sy, size, 2);
    const dot = (wx, wy, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x0 + wx * sx, y0 + wy * sy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (state.missions.marker) {
      const m = state.missions.marker;
      dot(m.x, m.y, '#ff5da2', 5);
    }
    for (const cop of state.entities.cops) dot(cop.x, cop.y, '#ff2e2e', 3);
    dot(state.player.x, state.player.y, '#ffd23f', 4);
    // North marker.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', x0 + size - 12, y0 + 14);
    ctx.restore();
  }

  function drawStars(stars) {
    const x0 = VIEW.width - 190;
    const y0 = 16;
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', x0 + i * 30, y0 + 22);
    }
  }

  function drawHud(state) {
    const { player } = state;
    // Top-left: cash, rank, health.
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
    drawStars(player.wanted.stars);
    // Top-centre: mission objective.
    const objective = state.objectiveText || '';
    if (objective) {
      ctx.font = 'bold 16px sans-serif';
      const w = ctx.measureText(objective).width + 28;
      ctx.fillStyle = 'rgba(10,14,24,0.72)';
      ctx.fillRect((VIEW.width - w) / 2, 14, w, 34);
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.fillText(objective, VIEW.width / 2, 37);
    }
    // Waypoint: distance + edge arrow.
    const marker = state.missions.marker;
    if (marker) {
      const d = Math.hypot(player.x - marker.x, player.y - marker.y);
      const angle = Math.atan2(marker.y - player.y, marker.x - player.x);
      const cx = VIEW.width / 2;
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
    // Bottom-right: speed + ammo + mode.
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    ctx.fillRect(VIEW.width - 214, VIEW.height - 74, 200, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    if (player.mode === 'car' && player.car) {
      ctx.fillText(`${Math.round(Math.abs(player.car.speed) * 0.18)} km/h`, VIEW.width - 26, VIEW.height - 42);
    } else {
      ctx.fillText(player.mode === 'car' ? '—' : 'ON FOOT', VIEW.width - 26, VIEW.height - 42);
    }
    ctx.font = '13px sans-serif';
    ctx.fillText(`Ammo ${player.ammo}  ·  Missions ${player.missionsDone}/5`, VIEW.width - 26, VIEW.height - 22);
    // Message feed.
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    let my = VIEW.height - 96;
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      const msg = state.messages[i];
      ctx.globalAlpha = clamp(msg.life / 2, 0, 1);
      ctx.fillStyle = 'rgba(10,14,24,0.72)';
      const w = ctx.measureText(msg.text).width + 20;
      ctx.fillRect((VIEW.width - w) / 2, my - 16, w, 22);
      ctx.fillStyle = '#fff';
      ctx.fillText(msg.text, VIEW.width / 2, my);
      ctx.globalAlpha = 1;
      my -= 26;
    }
    // Controls hint.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WASD move/drive · E enter car · F punch · Click shoot · Shift run · Esc pause · G save · M mute', VIEW.width - 14, VIEW.height - 84);
    drawMinimap(state);
    // Low-health vignette.
    if (player.health < 35) {
      const g = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height / 3, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.75);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255,0,0,${0.35 + Math.sin(state.now * 6) * 0.1})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  function drawTitle(state) {
    ctx.fillStyle = 'rgba(20,8,32,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 92px sans-serif';
    ctx.fillText('SOLMAR', VIEW.width / 2, 210);
    ctx.fillStyle = '#ff5da2';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('A NEON COAST STORY', VIEW.width / 2, 252);
    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    ctx.fillText('Mara Reyes is back in Solmar — broke, wanted, and one big score away from freedom.', VIEW.width / 2, 300);
    ctx.fillText('Steal cars, outrun the cops, run five missions and take the bank.', VIEW.width / 2, 326);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('PRESS ENTER TO START', VIEW.width / 2, 400);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '15px sans-serif';
    ctx.fillText('WASD move / drive · E enter & steal cars · F punch · Mouse + click shoot · Shift run', VIEW.width / 2, 448);
    ctx.fillText('Esc pause · G save · M mute · Your progress saves to this browser', VIEW.width / 2, 472);
    if (state.hasSave) {
      ctx.fillStyle = '#37e08a';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Saved game found — press ENTER to continue your story', VIEW.width / 2, 516);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px sans-serif';
    ctx.fillText('An original game. Not affiliated with any commercial game series.', VIEW.width / 2, 690);
  }

  function drawPaused(state) {
    ctx.fillStyle = 'rgba(8,10,20,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 260);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('Esc resume · G save game · Enter restart the story', VIEW.width / 2, 310);
    ctx.fillStyle = '#fff';
    ctx.fillText(`Cash $${state.player.cash} · Missions ${state.player.missionsDone}/5 · Fares ${state.player.faresDone}`, VIEW.width / 2, 350);
  }

  function drawOver(state, title, subtitle) {
    ctx.fillStyle = 'rgba(20,4,8,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 76px sans-serif';
    ctx.fillText(title, VIEW.width / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText(subtitle, VIEW.width / 2, 350);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('PRESS ENTER TO TRY AGAIN', VIEW.width / 2, 420);
  }

  function drawWin(state) {
    ctx.fillStyle = 'rgba(8,24,16,0.8)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('KINGPIN OF SOLMAR', VIEW.width / 2, 280);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText('The bank job is done. The city is yours, Mara.', VIEW.width / 2, 330);
    ctx.fillText(`Final cash $${state.player.cash} · Missions 5/5 · Fares ${state.player.faresDone} · Pickups ${state.player.pickups}`, VIEW.width / 2, 370);
    ctx.fillStyle = '#37e08a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('PRESS ENTER TO KEEP PLAYING IN FREE ROAM', VIEW.width / 2, 430);
  }

  function screenToWorld(x, y) {
    return { x: x + camera.x, y: y + camera.y };
  }

  function draw(state, screen) {
    updateCamera(state);
    drawGround(state);
    drawRoads();
    drawBuildings(state);
    drawProps(state);
    drawPickups(state);
    if (screen === 'play' || screen === 'paused') drawMarker(state);
    for (const car of state.entities.parked) drawCar(car, false);
    for (const car of state.entities.traffic) drawCar(car, false);
    for (const car of state.entities.cops) drawCar(car, false);
    if (state.player.mode === 'car' && state.player.car) drawCar(state.player.car, true);
    for (const ped of state.entities.peds) {
      if (ped.alive) drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.bob, false);
    }
    for (const cop of state.entities.footCops) drawPerson(cop.x, cop.y, cop.angle, '#20242e', state.now * 8, true);
    if (state.player.mode === 'foot') {
      drawPerson(state.player.x, state.player.y, state.player.angle, '#ff5da2', state.now * 10, false);
      // Pistol in hand when aiming.
      const s = worldToScreen(state.player.x, state.player.y);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s.x + Math.cos(state.player.angle) * 10, s.y + Math.sin(state.player.angle) * 10);
      ctx.lineTo(s.x + Math.cos(state.player.angle) * 20, s.y + Math.sin(state.player.angle) * 20);
      ctx.stroke();
    }
    drawEffects(state);
    // Golden-hour sun wash.
    const wash = ctx.createLinearGradient(0, 0, VIEW.width, VIEW.height);
    wash.addColorStop(0, 'rgba(255,180,90,0.10)');
    wash.addColorStop(1, 'rgba(255,90,140,0.06)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    if (screen === 'play') drawHud(state);
    else if (screen === 'title') drawTitle(state);
    else if (screen === 'paused') { drawHud(state); drawPaused(state); }
    else if (screen === 'over') drawOver(state, 'BUSTED', 'The Solmar PD caught up with you. Your cash took a hit.');
    else if (screen === 'win') drawWin(state);
  }

  return { draw, updateCamera, snapCamera, worldToScreen, screenToWorld };
}
