/* Selectively recovered from PR #4 render/lighting.js (fb69933).
 * Original light sources, map, region assignment, and FOV remain authoritative.
 * Natural walls have depth-limited light; constructed walls keep the original arithmetic.
 * Crystal pools illuminate only currently visible rock. No simulation state is written here.
 */
var LEVEL_LIGHT_VALUES={wall_light_depth:1.15,wall_mass_floor:0.1,light_falloff:1.6,
 wall_bleed_rock:0.16,wall_bleed:0.45,crystal_wall_falloff:2.2,light_ceiling:0.3,
 bloom_threshold:1.1,bloom_gain:110,light_blur:0.38,bloom_alpha:0.3};
var LEVEL_LIGHT_TUNE={n:function(k){if(!(k in LEVEL_LIGHT_VALUES))throw Error('Missing light value '+k);return LEVEL_LIGHT_VALUES[k];},has:function(k){return k in LEVEL_LIGHT_VALUES;}};
function levelKnown(x,y){return inb(x,y) && (revealAll || vis[idxOf(x,y)] || seen[idxOf(x,y)]);}
function levelVisible(x,y){return inb(x,y) && (revealAll || vis[idxOf(x,y)]);}
function levelWallAt(x,y){return isWallLike(at(x,y));}
function levelMaterialAt(x,y){
 var id=floorMeta && floorMeta.plane;
 if(!id && typeof inDeep==='function' && inDeep())id=DEEP_REGIONS[deepCellReg(x,y)];
 if(!id)id=typeof inCaverns==='function' && inCaverns()?'caverns':bidx()===1?'crypt':'dungeon';
 var depth={caverns:1.15,underdark:1.05,volcanic:0.95,light:1.3,shadow:1,earth:1.1,fire:0.9,water:1.2,air:1.4}[id];
 return {id:id,depthLight:depth!==undefined,depthTiles:depth,massFloor:0.1};
}
function drawLightmap(now, prp){
    var t=LEVEL_LIGHT_TUNE;
    if (!lightingOn()) return false;
    var S = 2, W = (viewW + 3) * S, H = (viewH + 3) * S, ox = camX - 1, oy = camY - 1;
    if (!LM.c) {
      LM.c = document.createElement('canvas'); LM.x = LM.c.getContext('2d');
      LM.bloom = document.createElement('canvas'); LM.bx = LM.bloom.getContext('2d');
    }
    if (LM.c.width !== W || LM.c.height !== H) {
      LM.c.width = W; LM.c.height = H; LM.bloom.width = W; LM.bloom.height = H;
    }
    var img = LM.x.createImageData(W, H), bl = LM.bx.createImageData(W, H), D = img.data, B = bl.data;
    var lights = gatherLights(now, prp);
  var room=roomAt(player.x,player.y), darkRoom = room && room.dark && !(player.aff.light>0) && !(player.aff.fire>0);
  /* how dark each biome is: the dungeon is a lived-in, torch-lit place; the crypt and caverns are not */
  var BL = [ {amb:[0.50,0.51,0.58], mem:[0.55,0.58,0.70]},    /* dungeon */
             {amb:[0.34,0.35,0.44], mem:[0.46,0.48,0.62]},    /* crypt: brighter, cooler, like the concept art */
             {amb:[0.20,0.21,0.26], mem:[0.38,0.40,0.50]} ][Math.min(2, biomeIdx())];
  /* the elemental planes set their own mood: Light is bright and warm, Shadow near-black, Earth a dim green */
  var PL = floorMeta && floorMeta.plane ? {light:{amb:[0.90,0.89,0.88], mem:[0.60,0.60,0.64]}, shadow:{amb:[0.30,0.26,0.40], mem:[0.40,0.36,0.52]}, earth:{amb:[0.42,0.44,0.34], mem:[0.46,0.48,0.40]}}[floorMeta.plane] : null;
  if(PL) BL=PL;
  var AMB = darkRoom ? [0.08,0.08,0.12] : BL.amb, MEM=BL.mem.map(function(v){ return v*0.45; });   /* the tile fade moved in here (memA) */

    var vals = new Float32Array(W * H * 3), isWall = new Uint8Array(W * H);
    var scratch = [0, 0, 0];
    var tx, ty, k, j;

    /* ---- how far into the rock each subcell sits -------------------------------------------
       Wall light is DEPTH-LIMITED: the exposed edge is lit, the light reaches a little way into
       the mass and then fades out, so a cave boundary keeps an irregular silhouette and the deep
       rock is swallowed. The alternative - lighting a wall cell as a unit - draws a complete
       rectangular face, which is the masonry look this biome must not have.

       Distance is measured over the SUBCELL grid (S per tile) by a two-pass chamfer from every
       open subcell, so the front is as irregular as the cave is, and it costs one sweep rather
       than a search per cell. */
    var depth = new Float32Array(W * H);
    for (ty = 0; ty < H; ty++) for (tx = 0; tx < W; tx++) {
      var di = ty * W + tx;
      var dwx = ox + Math.floor(tx / S), dwy = oy + Math.floor(ty / S);
      depth[di] = (inb(dwx, dwy) && !levelWallAt(dwx, dwy)) ? 0 : 1e4;
    }
    var D1 = 1, D2 = 1.41421356;
    for (ty = 0; ty < H; ty++) for (tx = 0; tx < W; tx++) {
      var c1 = ty * W + tx, v1 = depth[c1];
      if (tx > 0) v1 = Math.min(v1, depth[c1 - 1] + D1);
      if (ty > 0) v1 = Math.min(v1, depth[c1 - W] + D1);
      if (tx > 0 && ty > 0) v1 = Math.min(v1, depth[c1 - W - 1] + D2);
      if (tx < W - 1 && ty > 0) v1 = Math.min(v1, depth[c1 - W + 1] + D2);
      depth[c1] = v1;
    }
    for (ty = H - 1; ty >= 0; ty--) for (tx = W - 1; tx >= 0; tx--) {
      var c2 = ty * W + tx, v2 = depth[c2];
      if (tx < W - 1) v2 = Math.min(v2, depth[c2 + 1] + D1);
      if (ty < H - 1) v2 = Math.min(v2, depth[c2 + W] + D1);
      if (tx < W - 1 && ty < H - 1) v2 = Math.min(v2, depth[c2 + W + 1] + D2);
      if (tx > 0 && ty < H - 1) v2 = Math.min(v2, depth[c2 + W - 1] + D2);
      depth[c2] = v2;
    }
    /* Penetration in TILES, PER CELL'S MATERIAL. This is the correction Codex required on
       checkpoint 1: the depth fade was applied to every wall face and every wall top on every
       floor, so Dungeon and Crypt lighting changed too, contrary to what that commit claimed.

       Now the material decides. `reach()` returns 1 for a CONSTRUCTED cell, which reproduces the
       pre-121480e arithmetic exactly - the face keeps its flat 0.9 and the top its 0.7 ambient
       plus bleed - rather than re-tuning it back to something similar. A NATURAL cell gets the
       depth-limited fade, with its own penetration distance and its own deep-mass floor, so a
       built temple wall and a spider-cavern wall on the same Underdark map light differently. */
    var mats = {at:levelMaterialAt};
    var defPen = t.n('wall_light_depth'), defFloor = t.n('wall_mass_floor');
    var matCache = {};
    function profileAt(wx, wy) {
      var key = wx + ',' + wy;
      var p = matCache[key];
      if (p) return p;
      var m = mats ? mats.at(wx, wy) : null;
      if (!m || !m.depthLight) {
        p = { on: false, penSub: 0, floor: defFloor };
      } else {
        var pen = t.has('wall_light_depth_' + m.id) ? t.n('wall_light_depth_' + m.id)
                : (m.depthTiles === undefined ? defPen : m.depthTiles);
        p = { on: true, penSub: Math.max(0.35, pen * S),
              floor: m.massFloor === undefined ? defFloor : m.massFloor };
      }
      matCache[key] = p;
      return p;
    }
    function reach(cell, wx, wy) {
      if (!profileAt(wx, wy).on) return 1;      /* constructed: the pre-contract path, unchanged */
      var dd = depth[cell];
      if (dd <= 0) return 1;
      var ps = profileAt(wx, wy).penSub;
      if (dd >= ps) return 0;
      var q = 1 - dd / ps;
      return q * q;                     /* squared: bright at the lip, gone quickly behind it */
    }
    

    for (ty = 0; ty < H; ty++) for (tx = 0; tx < W; tx++) {
      var x = ox + Math.floor(tx / S), y = oy + Math.floor(ty / S), o = (ty * W + tx) * 3, cell = ty * W + tx;
      var fx0 = ox + (tx + 0.5) / S - 0.5, fy0 = oy + (ty + 0.5) / S - 0.5;
      if (!inb(x, y)) continue;
      if (!levelKnown(x, y)) continue;
      var wall = levelWallAt(x, y);
      isWall[cell] = wall ? 1 : 0;
      var rr, gg, bb;
      if (!levelVisible(x, y)) { rr = MEM[0]; gg = MEM[1]; bb = MEM[2]; }
      else {
        var reg = (typeof deepAmbAt==='function' ? deepAmbAt(x,y) : null);
        rr = reg ? reg[0] : AMB[0];
        gg = reg ? reg[1] : AMB[1];
        bb = reg ? reg[2] : AMB[2];
        var face = wall && !levelWallAt(x, y + 1);
        if (!wall || face) {
          var sx = fx0, sy = face ? y + 1 : fy0, stx = x, sty = face ? y + 1 : y;
          for (k = 0; k < lights.length; k++) {
            var L = lights[k], ddx = L.x - sx, ddy = L.y - sy, d = Math.sqrt(ddx * ddx + ddy * ddy);
            if (d >= L.r) continue;
            if (face && L.y < y + 0.5) continue;
            if (k === 0 ? !levelVisible(stx, sty) : !lightLOS(L.tx, L.ty, stx, sty)) continue;
            var fq = 1 - d / L.r;
            fq = Math.pow(fq, t.n('light_falloff')) * L.s;
            rr += L.c[0] * fq; gg += L.c[1] * fq; bb += L.c[2] * fq;
          }
          if (face) {
            /* the lit lip fades with depth instead of filling the tile */
            var wf = reach(cell, x, y) * 0.9;
            rr *= wf; gg *= wf; bb *= wf;
          }
          else {
            /* smooth across tiles: a per-tile value showed as a grid */
            var n = 0.93 + 0.09 * (typeof ptVal==='function' ? ptVal(fx0*0.7,fy0*0.7,21) : hash2(x,y,21));
            rr *= n; gg *= n; bb *= n;
          }
        } else { rr = -1; gg = 0; bb = 0; }
      }
      vals[o] = rr; vals[o + 1] = gg; vals[o + 2] = bb;
    }

    /* wall tops: dark masses, faintly picking up the light of the open ground beside them */
    var bleedRock = t.n('wall_bleed_rock'), bleedBrick = t.n('wall_bleed');
    var wallFall = t.n('crystal_wall_falloff');
    var wallLights = [];
    for (k = 0; k < lights.length; k++) if (lights[k].wall) wallLights.push(lights[k]);
    for (ty = 0; ty < H; ty++) for (tx = 0; tx < W; tx++) {
      var o2 = (ty * W + tx) * 3;
      if (vals[o2] !== -1) continue;
      var sr = 0, sg = 0, sb = 0, cnt = 0;
      for (j = 0; j < 4; j++) {
        var nx = tx + [1, -1, 0, 0][j], ny = ty + [0, 0, 1, -1][j];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var no = (ny * W + nx) * 3;
        if (isWall[ny * W + nx] || vals[no] < 0) continue;
        sr += vals[no]; sg += vals[no + 1]; sb += vals[no + 2]; cnt++;
      }
      var wx2 = ox + Math.floor(tx / S), wy2 = oy + Math.floor(ty / S);
      var reg2 = (typeof deepAmbAt==='function' ? deepAmbAt(wx2,wy2) : null);
      var A2 = reg2 || AMB, bleed = reg2 ? bleedRock : bleedBrick;
      var wf2 = reach(ty * W + tx, wx2, wy2);
      var mf2 = profileAt(wx2, wy2).floor;
      var cr2 = A2[0] * (mf2 + (0.7 - mf2) * wf2) + (cnt ? sr / cnt * bleed * wf2 : 0);
      var cg2 = A2[1] * (mf2 + (0.7 - mf2) * wf2) + (cnt ? sg / cnt * bleed * wf2 : 0);
      var cb2 = A2[2] * (mf2 + (0.7 - mf2) * wf2) + (cnt ? sb / cnt * bleed * wf2 : 0);
      /* A CRYSTAL LIGHTS THE ROCK IT GREW OUT OF, and only the rock near it. Distance from the
         crystal's own subcell, the same falloff curve the rest of the lighting uses, and a radius
         of about a tile and a half - so the decal is visibly responsible for the patch, and the
         mass beyond it is as dark as it was. No LOS test: the crystal is embedded IN the rock it
         is lighting, so any line from it to its neighbours is blocked by definition, and a test
         would switch the whole effect off.

         This runs only for cells that reached here, which are the ones the first pass marked -1:
         KNOWN AND CURRENTLY VISIBLE wall. A remembered wall took MEM and never entered this pass,
         and an unseen cell was skipped before either. So a crystal cannot reveal geometry through
         fog - not by policy, by which array element it is allowed to touch. */
      for (k = 0; k < wallLights.length; k++) {
        var WL = wallLights[k];
        var wdx = WL.x - (wx2 + 0.5), wdy = WL.y - (wy2 + 0.5);
        var wd = Math.sqrt(wdx * wdx + wdy * wdy);
        if (wd >= WL.wr) continue;
        var wq = Math.pow(1 - wd / WL.wr, wallFall) * WL.ws;
        cr2 += WL.c[0] * wq; cg2 += WL.c[1] * wq; cb2 += WL.c[2] * wq;
      }
      vals[o2] = cr2; vals[o2 + 1] = cg2; vals[o2 + 2] = cb2;
    }

    /* a soft ceiling, so stacked lights roll off instead of washing the tiles out */
    var ceil = t.n('light_ceiling');
    for (j = 0; j < W * H * 3; j++) { var v = vals[j]; if (v > 1) vals[j] = 1 + (v - 1) * ceil; }
    var bloomAt = t.n('bloom_threshold'), bloomK = t.n('bloom_gain');
    for (j = 0; j < W * H; j++) {
      var q = j * 3, p4 = j * 4;
      D[p4] = Math.min(255, vals[q] * 255);
      D[p4 + 1] = Math.min(255, vals[q + 1] * 255);
      D[p4 + 2] = Math.min(255, vals[q + 2] * 255);
      D[p4 + 3] = 255;
      var ex = Math.max(0, Math.max(vals[q], vals[q + 1], vals[q + 2]) - bloomAt);
      B[p4] = Math.min(255, vals[q] * ex * bloomK);
      B[p4 + 1] = Math.min(255, vals[q + 1] * ex * bloomK);
      B[p4 + 2] = Math.min(255, vals[q + 2] * ex * bloomK);
      B[p4 + 3] = 255;
    }
    LM.x.putImageData(img, 0, 0);
    LM.bx.putImageData(bl, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalCompositeOperation = 'multiply';
    /* the light is worked out a tile at a time, so a wall casts a square-edged shadow and two
       texels a tile leaves square steps. A blur before it is laid down melts them into gradients. */
    ctx.filter = 'blur(' + Math.max(2, Math.round(TS * t.n('light_blur'))) + 'px)';
    ctx.drawImage(LM.c, 0, 0, W, H, -TS, -TS, W * TS / S, H * TS / S);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = t.n('bloom_alpha');
    ctx.drawImage(LM.bloom, 0, 0, W, H, -TS, -TS, W * TS / S, H * TS / S);
    ctx.restore();
    return true;
  };

