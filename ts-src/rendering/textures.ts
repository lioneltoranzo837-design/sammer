// @ts-nocheck
import { BLOOD_MESSAGE_FONT_FAMILY, BLOOD_MESSAGE_FONT_URL, BLOOD_WALL_MESSAGES, GRID_SIZE, WALL_HEIGHT, getMapForLevel } from '../config/gameConfig.js';
const { THREE } = window;
let bloodMessageFontLoaded = false;
// --- Procedural noise helpers ---
function _seededRand(seed) {
    let s = seed % 2147483647;
    if (s <= 0)
        s += 2147483646;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}
function _hash2d(x, y) {
    let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
}
function _smoothNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = _hash2d(ix, iy), b = _hash2d(ix + 1, iy);
    const c = _hash2d(ix, iy + 1), d = _hash2d(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function _fbm(x, y, octaves = 5, lacunarity = 2.0, gain = 0.5) {
    let value = 0, amplitude = 1, frequency = 1, maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
        value += amplitude * _smoothNoise(x * frequency, y * frequency);
        maxAmp += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return value / maxAmp;
}
function _fillNoise(ctx, w, h, r, g, b, alphaMin, alphaMax, count, sizeMin, sizeMax) {
    for (let i = 0; i < count; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const size = Math.random() * (sizeMax - sizeMin) + sizeMin;
        const a = Math.random() * (alphaMax - alphaMin) + alphaMin;
        const v = Math.floor(Math.random() * 30 - 15);
        ctx.fillStyle = `rgba(${r + v},${g + v},${b + v},${a})`;
        ctx.fillRect(x, y, size, size);
    }
}
function _drawRivet(ctx, x, y, radius = 6) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(x + 1, y + 1, radius + 1, 0, Math.PI * 2);
    ctx.fill();
    // Body
    const rg = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
    rg.addColorStop(0, '#5a5f6a');
    rg.addColorStop(0.5, '#3a3e47');
    rg.addColorStop(1, '#1a1d22');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    // Cross slot
    ctx.strokeStyle = '#0e1014';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.5, y);
    ctx.lineTo(x + radius * 0.5, y);
    ctx.moveTo(x, y - radius * 0.5);
    ctx.lineTo(x, y + radius * 0.5);
    ctx.stroke();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
}
// --- TEXTURAS PROCEDIMENTALES EN CANVAS ---
export function generateWallTexture(type = 0) {
    const canvas = document.createElement('canvas');
    const S = 2048; // Ultra high res
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // Helper for seeded random in textures
    const _sr = _seededRand(1337 + type);

    // ---- TYPE 0: Futuristic aged-metal industrial (2050 but corroded) ----
    if (type === 0 || type === 1 || type === 2) {
        // Base gradient: dark corroded metal with blue-steel tint
        const baseGrad = ctx.createLinearGradient(0, 0, 0, S);
        baseGrad.addColorStop(0, '#2a3138');
        baseGrad.addColorStop(0.3, '#1f252b');
        baseGrad.addColorStop(0.6, '#181d24');
        baseGrad.addColorStop(1, '#0e1216');
        ctx.fillStyle = baseGrad;
        ctx.fillRect(0, 0, S, S);

        // === BRUSHED METAL GRAIN ===
        ctx.globalAlpha = 0.05;
        for (let y = 0; y < S; y += 2) {
            const brightness = 30 + _sr() * 30;
            ctx.fillStyle = `rgb(${brightness},${brightness + 5},${brightness + 10})`;
            ctx.fillRect(0, y, S, 1 + _sr() * 1.5);
        }
        ctx.globalAlpha = 1.0;

        // Fine metal noise
        _fillNoise(ctx, S, S, 25, 28, 35, 0.02, 0.05, 40000, 0.5, 2.5);

        // === ASYMMETRIC PANEL GRID ===
        const panels = [
            { x: 0, y: 0, w: 400, h: 800, seed: 1 },
            { x: 0, y: 800, w: 400, h: 600, seed: 2, vent: true },
            { x: 0, y: 1400, w: 400, h: 648, seed: 3 },
            { x: 400, y: 0, w: 1000, h: 500, seed: 4, display: true },
            { x: 400, y: 500, w: 600, h: 900, seed: 5 },
            { x: 1000, y: 500, w: 400, h: 900, seed: 6, hazard: true },
            { x: 400, y: 1400, w: 1000, h: 648, seed: 7 },
            { x: 1400, y: 0, w: 648, h: 700, seed: 8 },
            { x: 1400, y: 700, w: 648, h: 500, seed: 9 },
            { x: 1400, y: 1200, w: 648, h: 848, seed: 10 }
        ];

        const panelGap = 16;
        ctx.fillStyle = '#030406';
        ctx.fillRect(0, 0, S, S);

        panels.forEach(p => {
            const px = p.x + panelGap / 2;
            const py = p.y + panelGap / 2;
            const pw = p.w - panelGap;
            const ph = p.h - panelGap;
            const _psr = _seededRand(p.seed * 99);

            ctx.save();
            ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();

            const pTint = _psr();
            let pR = 25, pG = 30, pB = 38;
            if (pTint < 0.3) { pR += 8; pG += 5; }
            else if (pTint < 0.6) { pG += 6; pB += 10; }
            else { pR -= 5; pG -= 5; pB -= 5; }

            const pGrad = ctx.createLinearGradient(px, py, px, py + ph);
            pGrad.addColorStop(0, `rgb(${pR+10},${pG+10},${pB+10})`);
            pGrad.addColorStop(1, `rgb(${pR},${pG},${pB})`);
            ctx.fillStyle = pGrad;
            ctx.fillRect(px, py, pw, ph);

            _fillNoise(ctx, pw, ph, pR+20, pG+20, pB+20, 0.02, 0.06, 15000, 1, 3);

            if (_psr() > 0.6) {
                ctx.globalAlpha = 0.04;
                for (let x = 0; x < pw; x += 3) {
                    ctx.fillStyle = `rgb(${pR+30},${pG+30},${pB+30})`;
                    ctx.fillRect(px + x, py, 1 + _psr() * 2, ph);
                }
                ctx.globalAlpha = 1.0;
            }

            const vGrad = ctx.createRadialGradient(px+pw/2, py+ph/2, Math.min(pw,ph)*0.2, px+pw/2, py+ph/2, Math.max(pw,ph)*0.7);
            vGrad.addColorStop(0, 'rgba(0,0,0,0)');
            vGrad.addColorStop(1, 'rgba(10,12,15,0.4)');
            ctx.fillStyle = vGrad;
            ctx.fillRect(px, py, pw, ph);
            ctx.restore();

            const bevelW = 6;
            ctx.fillStyle = 'rgba(90,100,115,0.4)';
            ctx.beginPath();
            ctx.moveTo(px, py + ph); ctx.lineTo(px, py); ctx.lineTo(px + pw, py);
            ctx.lineTo(px + pw - bevelW, py + bevelW); ctx.lineTo(px + bevelW, py + bevelW); ctx.lineTo(px + bevelW, py + ph - bevelW);
            ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.moveTo(px + pw, py); ctx.lineTo(px + pw, py + ph); ctx.lineTo(px, py + ph);
            ctx.lineTo(px + bevelW, py + ph - bevelW); ctx.lineTo(px + pw - bevelW, py + ph - bevelW); ctx.lineTo(px + pw - bevelW, py + bevelW);
            ctx.fill();

            const rStep = 120, rInset = 16;
            for (let rx = px + rInset; rx <= px + pw - rInset; rx += rStep) {
                _drawRivet(ctx, rx, py + rInset, 6);
                _drawRivet(ctx, rx, py + ph - rInset, 6);
            }
            for (let ry = py + rInset + rStep; ry < py + ph - rInset; ry += rStep) {
                _drawRivet(ctx, px + rInset, ry, 6);
                _drawRivet(ctx, px + pw - rInset, ry, 6);
            }

            if (p.vent) {
                const vx = px + pw*0.1, vy = py + ph*0.2, vw = pw*0.8, vh = ph*0.6;
                ctx.fillStyle = '#080a0c'; ctx.fillRect(vx, vy, vw, vh);
                ctx.strokeStyle = '#22252a'; ctx.lineWidth = 8; ctx.strokeRect(vx, vy, vw, vh);
                for (let ly = vy + 15; ly < vy + vh - 15; ly += 25) {
                    const lGrad = ctx.createLinearGradient(0, ly, 0, ly + 15);
                    lGrad.addColorStop(0, '#3a404a'); lGrad.addColorStop(0.5, '#1e2228'); lGrad.addColorStop(1, '#0c0e12');
                    ctx.fillStyle = lGrad; ctx.fillRect(vx + 8, ly, vw - 16, 15);
                }
            }

            if (p.display) {
                const dx = px + 80, dy = py + 80, dw = 300, dh = 150;
                ctx.fillStyle = '#111316'; ctx.fillRect(dx, dy, dw, dh);
                ctx.strokeStyle = '#333842'; ctx.lineWidth = 4; ctx.strokeRect(dx, dy, dw, dh);
                ctx.fillStyle = '#061a0c'; ctx.fillRect(dx + 10, dy + 10, dw - 20, dh - 20);
                for(let sy=dy+10; sy<dy+dh-10; sy+=4) {
                    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(dx+10, sy, dw-20, 2);
                }
                ctx.save();
                ctx.font = 'bold 36px monospace'; ctx.fillStyle = '#22ff55'; ctx.shadowColor = '#22ff55'; ctx.shadowBlur = 10;
                ctx.fillText('SYS.OK', dx + 30, dy + 60);
                ctx.font = '20px monospace'; ctx.fillText('TEMP: 42°C', dx + 30, dy + 100); ctx.fillText('PRESS: NML', dx + 30, dy + 130);
                ctx.restore();
            }

            if (p.hazard) {
                const sx = px + pw/2 - 150, sy = py + 80, sw = 300, sh = 100;
                ctx.fillStyle = '#d4b024'; ctx.fillRect(sx, sy, sw, sh);
                for(let i=0; i<30; i++) {
                    ctx.fillStyle = `rgb(${pR},${pG},${pB})`;
                    ctx.beginPath(); ctx.arc(sx + _psr()*sw, sy + (_psr()>0.5?0:sh), 2 + _psr()*12, 0, Math.PI*2); ctx.fill();
                }
                ctx.save();
                ctx.font = 'bold 48px "Arial Black", sans-serif'; ctx.fillStyle = '#111'; ctx.globalAlpha = 0.8;
                ctx.fillText('CAUTION', sx + 30, sy + 65);
                ctx.restore();
            }

            if (_psr() > 0.5) {
                ctx.save();
                ctx.font = 'bold 32px monospace'; ctx.fillStyle = 'rgba(80,90,100,0.3)';
                ctx.fillText(`PNL-${Math.floor(_psr()*9000)+1000}`, px + 50, py + ph - 50);
                ctx.restore();
            }
        });

        // === EXPOSED BRICK PATCHES (highly detailed) ===
        const brickPatches = [
            { x: 120, y: 900, w: 260, h: 400 },
            { x: 1450, y: 150, w: 450, h: 300 },
            { x: 800, y: 1600, w: 500, h: 350 },
        ];
        brickPatches.forEach(patch => {
            ctx.save();
            ctx.beginPath();
            for (let e = 0; e < 12; e++) {
                const ex = patch.x + patch.w * (0.1 + _sr() * 0.8);
                const ey = patch.y + patch.h * (0.1 + _sr() * 0.8);
                const erx = patch.w * (0.2 + _sr() * 0.25);
                const ery = patch.h * (0.2 + _sr() * 0.25);
                ctx.ellipse(ex, ey, erx, ery, _sr() * Math.PI, 0, Math.PI * 2);
            }
            ctx.clip();

            ctx.fillStyle = '#4a4540'; ctx.fillRect(patch.x - 50, patch.y - 50, patch.w + 100, patch.h + 100);
            _fillNoise(ctx, patch.w+100, patch.h+100, 50, 45, 40, 0.05, 0.1, 10000, 1, 3);

            const brickW = 84, brickH = 36, mortarW = 6;
            for (let by = patch.y - 50; by < patch.y + patch.h + 50; by += brickH + mortarW) {
                const rowOffset = (Math.floor((by - patch.y) / (brickH + mortarW)) % 2 === 0) ? 0 : brickW / 2;
                for (let bx = patch.x - 50 + rowOffset; bx < patch.x + patch.w + 50; bx += brickW + mortarW) {
                    const bv = _sr();
                    let br, bg, bb;
                    if (bv < 0.3) { br = 150 + _sr()*40; bg = 60 + _sr()*20; bb = 40 + _sr()*20; }
                    else if (bv < 0.6) { br = 100 + _sr()*30; bg = 50 + _sr()*15; bb = 35 + _sr()*10; }
                    else { br = 120 + _sr()*20; bg = 90 + _sr()*20; bb = 60 + _sr()*20; }

                    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx+2, by+2, brickW, brickH);
                    const bGrad = ctx.createLinearGradient(bx, by, bx, by+brickH);
                    bGrad.addColorStop(0, `rgb(${br+20},${bg+15},${bb+10})`);
                    bGrad.addColorStop(1, `rgb(${br-20},${bg-15},${bb-10})`);
                    ctx.fillStyle = bGrad;
                    ctx.beginPath();
                    ctx.moveTo(bx + (_sr()*4), by); ctx.lineTo(bx + brickW - (_sr()*4), by);
                    ctx.lineTo(bx + brickW, by + (_sr()*4)); ctx.lineTo(bx + brickW, by + brickH - (_sr()*4));
                    ctx.lineTo(bx + brickW - (_sr()*4), by + brickH); ctx.lineTo(bx + (_sr()*4), by + brickH);
                    ctx.lineTo(bx, by + brickH - (_sr()*4)); ctx.lineTo(bx, by + (_sr()*4));
                    ctx.fill();

                    for (let n = 0; n < 30; n++) {
                        ctx.fillStyle = `rgba(0,0,0,${0.1 + _sr() * 0.2})`;
                        ctx.fillRect(bx + _sr()*brickW, by + _sr()*brickH, 1 + _sr()*2, 1 + _sr()*2);
                    }
                    for (let n = 0; n < 15; n++) {
                        ctx.fillStyle = `rgba(255,255,255,${0.05 + _sr() * 0.1})`;
                        ctx.fillRect(bx + _sr()*brickW, by + _sr()*brickH, 1, 1);
                    }

                    if (_sr() > 0.8) {
                        const mGrad = ctx.createRadialGradient(bx+brickW/2, by+brickH/2, 0, bx+brickW/2, by+brickH/2, brickH);
                        mGrad.addColorStop(0, 'rgba(40,80,30,0.4)'); mGrad.addColorStop(1, 'rgba(0,0,0,0)');
                        ctx.fillStyle = mGrad; ctx.fillRect(bx, by, brickW, brickH);
                    }
                }
            }

            ctx.globalCompositeOperation = 'multiply';
            const edgeGrad = ctx.createRadialGradient(
                patch.x + patch.w / 2, patch.y + patch.h / 2, Math.min(patch.w, patch.h) * 0.3,
                patch.x + patch.w / 2, patch.y + patch.h / 2, Math.max(patch.w, patch.h) * 0.65
            );
            edgeGrad.addColorStop(0, 'rgba(255,255,255,1)');
            edgeGrad.addColorStop(0.8, 'rgba(100,100,100,1)');
            edgeGrad.addColorStop(1, 'rgba(10,10,10,1)');
            ctx.fillStyle = edgeGrad; ctx.fillRect(patch.x - 50, patch.y - 50, patch.w + 100, patch.h + 100);
            ctx.globalCompositeOperation = 'source-over';

            ctx.restore();
            ctx.strokeStyle = 'rgba(150,160,170,0.6)'; ctx.lineWidth = 3;
            for (let e = 0; e < 12; e++) {
                const ex = patch.x + patch.w * (0.1 + _sr() * 0.8);
                const ey = patch.y + patch.h * (0.1 + _sr() * 0.8);
                const erx = patch.w * (0.2 + _sr() * 0.25);
                const ery = patch.h * (0.2 + _sr() * 0.25);
                ctx.beginPath(); ctx.ellipse(ex, ey, erx+2, ery+2, _sr() * Math.PI, 0, Math.PI * 2); ctx.stroke();
            }
        });

        // === HEAVY WELDING SEAMS (over gaps) ===
        for(let w=0; w<5; w++) {
            const wx = 400 + w*100;
            const wy = 500;
            if(w===0) {
                ctx.strokeStyle = 'rgba(30,25,20,0.8)';
                ctx.lineWidth = 12;
                ctx.beginPath(); ctx.moveTo(400, 100); ctx.lineTo(400, 1900); ctx.stroke();
                for(let by=100; by<1900; by+=14) {
                    ctx.fillStyle = 'rgba(60,50,45,0.9)';
                    ctx.beginPath(); ctx.arc(400 + (_sr()-0.5)*4, by, 8, 0, Math.PI*2); ctx.fill();
                    const hG = ctx.createRadialGradient(400, by, 0, 400, by, 30);
                    hG.addColorStop(0, 'rgba(40,60,100,0.15)');
                    hG.addColorStop(0.5, 'rgba(80,70,30,0.1)');
                    hG.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = hG;
                    ctx.beginPath(); ctx.arc(400, by, 30, 0, Math.PI*2); ctx.fill();
                }
            }
        }

        // === CABLE CONDUIT BUNDLE ===
        const cableY = 1350;
        ctx.fillStyle = '#16181c';
        ctx.fillRect(0, cableY, S, 60);
        ctx.strokeStyle = '#0a0b0d';
        ctx.lineWidth = 6;
        ctx.strokeRect(0, cableY, S, 60);
        const cables = [
            { y: 1360, w: 12, col: '#8B0000' },
            { y: 1375, w: 16, col: '#101010' },
            { y: 1390, w: 10, col: '#00008B' },
            { y: 1398, w: 8,  col: '#B8860B' }
        ];
        cables.forEach(c => {
            for(let x=0; x<S; x+=50) {
                const sag = Math.sin(x*0.02) * 4;
                ctx.strokeStyle = c.col;
                ctx.lineWidth = c.w;
                ctx.beginPath();
                ctx.moveTo(x, c.y + sag);
                ctx.lineTo(x+50, c.y + Math.sin((x+50)*0.02)*4);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = c.w*0.3;
                ctx.beginPath();
                ctx.moveTo(x, c.y + sag - c.w*0.2);
                ctx.lineTo(x+50, c.y + Math.sin((x+50)*0.02)*4 - c.w*0.2);
                ctx.stroke();
            }
            for(let tx=80; tx<S; tx+=200) {
                ctx.fillStyle = '#111';
                ctx.fillRect(tx, 1355, 12, 50);
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fillRect(tx+2, 1355, 2, 50);
            }
        });

        // === HEAVY RUST AND GRIME ===
        ctx.globalCompositeOperation = 'multiply';
        for (let rs = 0; rs < 40; rs++) {
            const rx = _sr() * S;
            const ry = _sr() * S;
            const rLen = 100 + _sr() * 300;
            const rW = 10 + _sr() * 30;
            const rGrad = ctx.createLinearGradient(rx, ry, rx, ry + rLen);
            rGrad.addColorStop(0, 'rgba(130,50,15,0.15)');
            rGrad.addColorStop(0.5, 'rgba(80,30,10,0.08)');
            rGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = rGrad;
            ctx.beginPath();
            ctx.ellipse(rx, ry + rLen/2, rW, rLen/2, 0, 0, Math.PI*2);
            ctx.fill();
        }

        for(let pc=0; pc<30; pc++) {
            const px = _sr() * S, py = _sr() * S;
            const pr = 10 + _sr()*40;
            const pGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
            pGrad.addColorStop(0, 'rgba(40,20,5,0.4)');
            pGrad.addColorStop(0.7, 'rgba(80,40,10,0.2)');
            pGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = pGrad;
            ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        // === SCRATCHES ===
        ctx.strokeStyle = 'rgba(180,190,200,0.15)';
        for (let sc = 0; sc < 50; sc++) {
            const sx = _sr() * S;
            const sy = _sr() * S;
            const sl = 20 + _sr() * 150;
            const sa = _sr() * Math.PI * 2;
            ctx.lineWidth = 0.5 + _sr() * 2;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(sa) * sl, sy + Math.sin(sa) * sl);
            ctx.stroke();
        }
    }
    if (type === 1) {
        // Hazard stripe band with detail
        const bandTop = 700, bandBot = 880;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, bandTop, S, bandBot - bandTop);
        ctx.clip();
        // Yellow base
        const hazGrad = ctx.createLinearGradient(0, bandTop, 0, bandBot);
        hazGrad.addColorStop(0, '#ffb800');
        hazGrad.addColorStop(0.5, '#ffa200');
        hazGrad.addColorStop(1, '#e89000');
        ctx.fillStyle = hazGrad;
        ctx.fillRect(0, bandTop, S, bandBot - bandTop);
        // Black chevrons
        ctx.fillStyle = '#111';
        const sw = 70;
        for (let k = -200; k < S + 200; k += sw * 2) {
            ctx.beginPath();
            ctx.moveTo(k, bandTop);
            ctx.lineTo(k + sw, bandTop);
            ctx.lineTo(k + sw - (bandBot - bandTop) * 0.4, bandBot);
            ctx.lineTo(k - (bandBot - bandTop) * 0.4, bandBot);
            ctx.closePath();
            ctx.fill();
        }
        // Wear on stripes
        _fillNoise(ctx, S, bandBot - bandTop, 180, 160, 80, 0.02, 0.08, 600, 1, 3);
        ctx.restore();
        // Metal edges around band
        ctx.strokeStyle = '#0a0a0a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, bandTop);
        ctx.lineTo(S, bandTop);
        ctx.moveTo(0, bandBot);
        ctx.lineTo(S, bandBot);
        ctx.stroke();
        // Warning triangle symbol
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(S / 2, bandTop + 20);
        ctx.lineTo(S / 2 + 55, bandBot - 15);
        ctx.lineTo(S / 2 - 55, bandBot - 15);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,0,0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Exclamation mark
        ctx.fillStyle = 'rgba(255,220,0,0.5)';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', S / 2, bandBot - 35);
        ctx.restore();
        // Damage marks over stripes
        for (let dm = 0; dm < 5; dm++) {
            const dx = Math.random() * S;
            const dy = bandTop + Math.random() * (bandBot - bandTop);
            ctx.strokeStyle = 'rgba(40,30,10,0.35)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(dx, dy, 5 + Math.random() * 10, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    else if (type === 2) {
        // Blood wall - realistic dripping blood with pooling
        // Large handprint smear
        ctx.save();
        ctx.translate(300, 250);
        ctx.rotate(-0.15);
        // Palm
        const palmGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
        palmGrad.addColorStop(0, 'rgba(130,5,5,0.9)');
        palmGrad.addColorStop(0.7, 'rgba(100,0,0,0.75)');
        palmGrad.addColorStop(1, 'rgba(70,0,0,0.4)');
        ctx.fillStyle = palmGrad;
        ctx.beginPath();
        ctx.ellipse(0, 10, 42, 35, 0, 0, Math.PI * 2);
        ctx.fill();
        // Fingers
        const fingers = [
            { x: -30, y: -20, l: 70, w: 11, a: -0.25 },
            { x: -12, y: -30, l: 85, w: 11, a: -0.1 },
            { x: 8, y: -32, l: 80, w: 11, a: 0.05 },
            { x: 26, y: -25, l: 65, w: 10, a: 0.2 },
            { x: 38, y: 5, l: 45, w: 10, a: 0.8 }
        ];
        fingers.forEach(f => {
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.a);
            const fg = ctx.createLinearGradient(0, 0, 0, -f.l);
            fg.addColorStop(0, 'rgba(120,5,5,0.85)');
            fg.addColorStop(0.7, 'rgba(90,0,0,0.6)');
            fg.addColorStop(1, 'rgba(70,0,0,0.2)');
            ctx.fillStyle = fg;
            ctx.beginPath();
            ctx.ellipse(0, -f.l / 2, f.w / 2, f.l / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        ctx.restore();
        // Major blood drips from different sources
        const drips = [
            { x: 140, startY: 120, count: 3 },
            { x: 300, startY: 200, count: 4 },
            { x: 500, startY: 100, count: 2 },
            { x: 700, startY: 280, count: 3 },
            { x: 850, startY: 150, count: 2 },
        ];
        drips.forEach(drip => {
            for (let d = 0; d < drip.count; d++) {
                const dx = drip.x + (d - drip.count / 2) * 18 + Math.random() * 10;
                const dy = drip.startY + d * 15;
                const dLen = 200 + Math.random() * 500;
                const dw = 4 + Math.random() * 8;
                // Drip trail
                const dripGrad = ctx.createLinearGradient(0, dy, 0, dy + dLen);
                dripGrad.addColorStop(0, `rgba(${100 + Math.random() * 30},0,0,0.8)`);
                dripGrad.addColorStop(0.3, `rgba(90,0,0,0.6)`);
                dripGrad.addColorStop(0.7, `rgba(75,0,0,0.35)`);
                dripGrad.addColorStop(1, `rgba(60,0,0,0.1)`);
                ctx.fillStyle = dripGrad;
                ctx.beginPath();
                ctx.moveTo(dx - dw / 2, dy);
                // Irregular drip path
                const midX = dx + (Math.random() - 0.5) * 12;
                ctx.bezierCurveTo(dx - dw / 2 + 2, dy + dLen * 0.3, midX - dw / 2 - 3, dy + dLen * 0.7, midX - 2, dy + dLen);
                ctx.lineTo(midX + 2, dy + dLen);
                ctx.bezierCurveTo(midX + dw / 2 + 3, dy + dLen * 0.7, dx + dw / 2 - 2, dy + dLen * 0.3, dx + dw / 2, dy);
                ctx.closePath();
                ctx.fill();
                // Drip drop at end
                const dropGrad = ctx.createRadialGradient(midX, dy + dLen, 0, midX, dy + dLen, dw);
                dropGrad.addColorStop(0, 'rgba(100,0,0,0.7)');
                dropGrad.addColorStop(1, 'rgba(60,0,0,0.1)');
                ctx.fillStyle = dropGrad;
                ctx.beginPath();
                ctx.ellipse(midX, dy + dLen, dw * 1.2, dw * 0.8, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        // Blood pooling at bottom
        const poolGrad = ctx.createLinearGradient(0, S - 140, 0, S);
        poolGrad.addColorStop(0, 'rgba(60,0,0,0)');
        poolGrad.addColorStop(0.3, 'rgba(70,0,0,0.15)');
        poolGrad.addColorStop(0.6, 'rgba(85,0,0,0.35)');
        poolGrad.addColorStop(1, 'rgba(50,0,0,0.55)');
        ctx.fillStyle = poolGrad;
        ctx.fillRect(0, S - 140, S, 140);
        // Splatter patterns
        for (let sp = 0; sp < 35; sp++) {
            const sx = Math.random() * S;
            const sy = Math.random() * S;
            const sr = 2 + Math.random() * 8;
            const sa = 0.15 + Math.random() * 0.45;
            const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
            sg.addColorStop(0, `rgba(${100 + Math.random() * 30},0,0,${sa})`);
            sg.addColorStop(1, 'rgba(60,0,0,0)');
            ctx.fillStyle = sg;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }
        // Drag / smear marks
        ctx.save();
        ctx.globalAlpha = 0.3;
        for (let sm = 0; sm < 4; sm++) {
            const sx = 100 + Math.random() * 700;
            const sy = 400 + Math.random() * 300;
            const sl = 80 + Math.random() * 200;
            ctx.strokeStyle = `rgba(${80 + Math.random() * 30},0,0,0.4)`;
            ctx.lineWidth = 15 + Math.random() * 20;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.bezierCurveTo(sx + 30, sy + sl * 0.3, sx - 20, sy + sl * 0.6, sx + 10, sy + sl);
            ctx.stroke();
        }
        ctx.restore();
    }
    else if (type === 3) {
        // Exit door - heavy blast door
        // Door base
        ctx.fillStyle = '#1e2025';
        ctx.fillRect(0, 0, S, S);
        // Reinforced door frame
        const frameW = 50;
        const frameGrad = ctx.createLinearGradient(0, 0, frameW, 0);
        frameGrad.addColorStop(0, '#3a3e46');
        frameGrad.addColorStop(0.5, '#2a2d33');
        frameGrad.addColorStop(1, '#1a1c20');
        ctx.fillStyle = frameGrad;
        ctx.fillRect(0, 0, frameW, S);
        ctx.fillRect(S - frameW, 0, frameW, S);
        ctx.fillRect(0, 0, S, frameW);
        ctx.fillRect(0, S - frameW, S, frameW);
        // Door body
        const doorGrad = ctx.createLinearGradient(0, frameW, 0, S - frameW);
        doorGrad.addColorStop(0, '#32363e');
        doorGrad.addColorStop(0.5, '#282c33');
        doorGrad.addColorStop(1, '#1e2128');
        ctx.fillStyle = doorGrad;
        ctx.fillRect(frameW + 10, frameW + 10, S - (frameW + 10) * 2, S - (frameW + 10) * 2);
        // FBM noise on door (Fast approximation)
        const dw = S - frameW * 2;
        const dh = S - frameW * 2;
        for (let i = 0; i < 4000; i++) {
            const x = frameW + Math.random() * dw;
            const y = frameW + Math.random() * dh;
            const sz = 1 + Math.random() * 3;
            const c = Math.floor(Math.random() * 20) - 10;
            ctx.fillStyle = `rgba(255,255,255,${c > 0 ? 0.05 : 0})`;
            ctx.fillRect(x, y, sz, sz);
            if (c < 0) {
                ctx.fillStyle = `rgba(0,0,0,0.05)`;
                ctx.fillRect(x, y, sz, sz);
            }
        }
        // Bevel on frame
        ctx.strokeStyle = 'rgba(90,95,105,0.3)';
        ctx.lineWidth = 3;
        ctx.strokeRect(frameW + 10, frameW + 10, S - (frameW + 10) * 2, S - (frameW + 10) * 2);
        // Frame rivets
        for (let fr = 30; fr < S - 20; fr += 80) {
            _drawRivet(ctx, 25, fr, 6);
            _drawRivet(ctx, S - 25, fr, 6);
            _drawRivet(ctx, fr, 25, 6);
            _drawRivet(ctx, fr, S - 25, 6);
        }
        // Hydraulic pistons on sides
        [100, S - 100].forEach(px => {
            const pistonGrad = ctx.createLinearGradient(px - 18, 0, px + 18, 0);
            pistonGrad.addColorStop(0, '#555960');
            pistonGrad.addColorStop(0.3, '#70757e');
            pistonGrad.addColorStop(0.5, '#808590');
            pistonGrad.addColorStop(0.7, '#70757e');
            pistonGrad.addColorStop(1, '#45484f');
            ctx.fillStyle = pistonGrad;
            ctx.fillRect(px - 18, frameW + 60, 36, S - frameW * 2 - 120);
            // Piston rings
            for (let pr = frameW + 100; pr < S - frameW - 60; pr += 80) {
                ctx.strokeStyle = '#3a3d43';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(px - 18, pr);
                ctx.lineTo(px + 18, pr);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(150,155,165,0.3)';
                ctx.beginPath();
                ctx.moveTo(px - 18, pr + 2);
                ctx.lineTo(px + 18, pr + 2);
                ctx.stroke();
            }
        });
        // Central biohazard warning panel
        const panelCx = S / 2, panelCy = S / 2 - 30;
        const panelR = 150;
        // Yellow warning background
        const warnGrad = ctx.createRadialGradient(panelCx, panelCy, 0, panelCx, panelCy, panelR + 20);
        warnGrad.addColorStop(0, '#f0a800');
        warnGrad.addColorStop(0.8, '#d89500');
        warnGrad.addColorStop(1, '#b07800');
        ctx.fillStyle = warnGrad;
        ctx.beginPath();
        // Hexagonal panel
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI * 2) / 6 - Math.PI / 6;
            const hx = panelCx + Math.cos(angle) * panelR;
            const hy = panelCy + Math.sin(angle) * panelR;
            i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 5;
        ctx.stroke();
        // Biohazard symbol (detailed)
        const bhR = 70;
        ctx.fillStyle = '#111';
        // Center ring
        ctx.beginPath();
        ctx.arc(panelCx, panelCy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d89500';
        ctx.beginPath();
        ctx.arc(panelCx, panelCy, 8, 0, Math.PI * 2);
        ctx.fill();
        // Three crescents
        for (let i = 0; i < 3; i++) {
            const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
            const bcx = panelCx + Math.cos(a) * 38;
            const bcy = panelCy + Math.sin(a) * 38;
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(bcx, bcy, 32, 0, Math.PI * 2);
            ctx.fill();
            // Inner cutout
            ctx.fillStyle = '#d89500';
            ctx.beginPath();
            ctx.arc(bcx + Math.cos(a) * 8, bcy + Math.sin(a) * 8, 16, 0, Math.PI * 2);
            ctx.fill();
            // Connecting arcs to center
            ctx.fillStyle = '#111';
            const lineA = a + Math.PI;
            ctx.beginPath();
            ctx.moveTo(panelCx + Math.cos(lineA - 0.15) * 18, panelCy + Math.sin(lineA - 0.15) * 18);
            ctx.lineTo(bcx + Math.cos(lineA + Math.PI - 0.3) * 32, bcy + Math.sin(lineA + Math.PI - 0.3) * 32);
            ctx.lineTo(bcx + Math.cos(lineA + Math.PI + 0.3) * 32, bcy + Math.sin(lineA + Math.PI + 0.3) * 32);
            ctx.lineTo(panelCx + Math.cos(lineA + 0.15) * 18, panelCy + Math.sin(lineA + 0.15) * 18);
            ctx.closePath();
            ctx.fill();
        }
        // Warning text below symbol
        ctx.fillStyle = '#111';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BIOHAZARD', panelCx, panelCy + panelR + 60);
        ctx.font = '22px monospace';
        ctx.fillText('AUTHORIZED PERSONNEL ONLY', panelCx, panelCy + panelR + 90);
        // Warning lights (top corners of door)
        [{ x: frameW + 50, y: frameW + 50 }, { x: S - frameW - 50, y: frameW + 50 }].forEach(light => {
            const lg = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, 25);
            lg.addColorStop(0, 'rgba(255,60,0,0.9)');
            lg.addColorStop(0.4, 'rgba(200,30,0,0.6)');
            lg.addColorStop(1, 'rgba(100,10,0,0)');
            ctx.fillStyle = lg;
            ctx.beginPath();
            ctx.arc(light.x, light.y, 25, 0, Math.PI * 2);
            ctx.fill();
            // Lens
            ctx.fillStyle = '#cc3300';
            ctx.beginPath();
            ctx.arc(light.x, light.y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,120,60,0.6)';
            ctx.beginPath();
            ctx.arc(light.x - 3, light.y - 3, 5, 0, Math.PI * 2);
            ctx.fill();
        });
        // Electronic side panel
        ctx.fillStyle = '#0d0f12';
        ctx.fillRect(frameW + 15, S / 2 + 150, 70, 180);
        ctx.strokeStyle = '#3a3e46';
        ctx.lineWidth = 2;
        ctx.strokeRect(frameW + 15, S / 2 + 150, 70, 180);
        // LED
        const ledGrad = ctx.createRadialGradient(frameW + 50, S / 2 + 180, 0, frameW + 50, S / 2 + 180, 10);
        ledGrad.addColorStop(0, '#00ff60');
        ledGrad.addColorStop(0.5, '#00cc40');
        ledGrad.addColorStop(1, '#004415');
        ctx.fillStyle = ledGrad;
        ctx.beginPath();
        ctx.arc(frameW + 50, S / 2 + 180, 8, 0, Math.PI * 2);
        ctx.fill();
        // Small display lines
        for (let dl = 0; dl < 4; dl++) {
            ctx.fillStyle = 'rgba(0,180,60,0.3)';
            ctx.fillRect(frameW + 22, S / 2 + 210 + dl * 25, 50, 12);
        }
    }
    else if (type === 4) {
        // Interactive sliding pneumatic door
        ctx.fillStyle = '#1a1c20';
        ctx.fillRect(0, 0, S, S);
        // FBM metal noise (Fast approximation)
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * S;
            const y = Math.random() * S;
            const sz = 1 + Math.random() * 4;
            const c = 20 + Math.random() * 20;
            ctx.fillStyle = `rgba(${c},${c},${c},0.1)`;
            ctx.fillRect(x, y, sz, sz);
        }
        // Door frame
        const dfW = 40;
        const dfGrad = ctx.createLinearGradient(0, 0, dfW, 0);
        dfGrad.addColorStop(0, '#3a3e46');
        dfGrad.addColorStop(0.5, '#2e3238');
        dfGrad.addColorStop(1, '#22252a');
        ctx.fillStyle = dfGrad;
        ctx.fillRect(0, 0, dfW, S);
        ctx.fillRect(S - dfW, 0, dfW, S);
        ctx.fillRect(0, 0, S, dfW);
        ctx.fillRect(0, S - dfW, S, dfW);
        // Central gap (where doors slide apart)
        ctx.fillStyle = '#050608';
        ctx.fillRect(S / 2 - 10, dfW, 20, S - dfW * 2);
        // Track rail at top and bottom
        const railGrad = ctx.createLinearGradient(0, dfW, 0, dfW + 16);
        railGrad.addColorStop(0, '#45484f');
        railGrad.addColorStop(0.5, '#606570');
        railGrad.addColorStop(1, '#35383f');
        ctx.fillStyle = railGrad;
        ctx.fillRect(dfW, dfW, S - dfW * 2, 16);
        ctx.fillRect(dfW, S - dfW - 16, S - dfW * 2, 16);
        // Left and right door panels
        const panels4 = [
            [dfW + 8, dfW + 24, S / 2 - dfW - 18, S - dfW * 2 - 48],
            [S / 2 + 10, dfW + 24, S / 2 - dfW - 18, S - dfW * 2 - 48]
        ];
        panels4.forEach(([px, py, pw, ph]) => {
            const pg = ctx.createLinearGradient(px, py, px + pw, py);
            pg.addColorStop(0, '#2a2d33');
            pg.addColorStop(0.5, '#32363e');
            pg.addColorStop(1, '#282c33');
            ctx.fillStyle = pg;
            ctx.fillRect(px, py, pw, ph);
            // Inner bevel
            ctx.strokeStyle = 'rgba(80,85,95,0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, py + ph);
            ctx.lineTo(px, py);
            ctx.lineTo(px + pw, py);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.moveTo(px + pw, py);
            ctx.lineTo(px + pw, py + ph);
            ctx.lineTo(px, py + ph);
            ctx.stroke();
            // Panel sub-divisions
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px + 15, py + 15, pw - 30, ph / 3 - 20);
            ctx.strokeRect(px + 15, py + ph / 3 + 5, pw - 30, ph / 3 - 20);
            ctx.strokeRect(px + 15, py + ph * 2 / 3 + 5, pw - 30, ph / 3 - 20);
        });
        // Direction chevrons
        ctx.save();
        ctx.strokeStyle = '#ff9900';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Left panel arrows (pointing left <<<)
        const arrowY = S / 2;
        for (let ac = 0; ac < 3; ac++) {
            const ax = 160 + ac * 50;
            ctx.beginPath();
            ctx.moveTo(ax + 15, arrowY - 25);
            ctx.lineTo(ax, arrowY);
            ctx.lineTo(ax + 15, arrowY + 25);
            ctx.stroke();
        }
        // Right panel arrows (pointing right >>>)
        for (let ac = 0; ac < 3; ac++) {
            const ax = S - 160 - ac * 50;
            ctx.beginPath();
            ctx.moveTo(ax - 15, arrowY - 25);
            ctx.lineTo(ax, arrowY);
            ctx.lineTo(ax - 15, arrowY + 25);
            ctx.stroke();
        }
        ctx.restore();
        // Card readers with detail
        [{ x: 130, side: 'left' }, { x: S - 220, side: 'right' }].forEach(reader => {
            const ry = S / 2 + 100;
            // Reader housing
            ctx.fillStyle = '#0e1014';
            const readerPath = new Path2D();
            readerPath.rect(reader.x, ry, 90, 140);
            ctx.fill(readerPath);
            // Bezel
            ctx.strokeStyle = '#3a3e46';
            ctx.lineWidth = 2;
            ctx.strokeRect(reader.x, ry, 90, 140);
            // Card slot
            ctx.fillStyle = '#050608';
            ctx.fillRect(reader.x + 15, ry + 55, 60, 6);
            ctx.strokeStyle = '#2a2d33';
            ctx.lineWidth = 1;
            ctx.strokeRect(reader.x + 15, ry + 55, 60, 6);
            // LED indicators
            const ledColors = ['#ff3030', '#ffaa00', '#00ff60'];
            ledColors.forEach((c, i) => {
                const lg = ctx.createRadialGradient(reader.x + 25 + i * 20, ry + 25, 0, reader.x + 25 + i * 20, ry + 25, 7);
                lg.addColorStop(0, c);
                lg.addColorStop(0.6, c);
                lg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = lg;
                ctx.beginPath();
                ctx.arc(reader.x + 25 + i * 20, ry + 25, 6, 0, Math.PI * 2);
                ctx.fill();
            });
            // [E] text
            ctx.fillStyle = '#ffaa00';
            ctx.font = 'bold 28px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('[E]', reader.x + 45, ry + 110);
            // Wiring from reader
            ctx.strokeStyle = 'rgba(60,65,75,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(reader.x + 45, ry + 140);
            ctx.bezierCurveTo(reader.x + 45, ry + 170, reader.x + 20, ry + 200, reader.x + 20, ry + 240);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(80,40,40,0.4)';
            ctx.beginPath();
            ctx.moveTo(reader.x + 55, ry + 140);
            ctx.bezierCurveTo(reader.x + 55, ry + 160, reader.x + 70, ry + 190, reader.x + 70, ry + 230);
            ctx.stroke();
        });
        // Frame rivets
        for (let fr = 50; fr < S; fr += 90) {
            _drawRivet(ctx, 20, fr, 5);
            _drawRivet(ctx, S - 20, fr, 5);
        }
        // "CAUTION" stencil text near top
        ctx.save();
        ctx.fillStyle = 'rgba(180,160,60,0.2)';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CAUTION - AUTOMATIC DOOR', S / 2, dfW + 55);
        ctx.restore();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
export function generateFloorTexture() {
    const canvas = document.createElement('canvas');
    const S = 1024;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // Seeded random for deterministic placement of special features
    const _sr = _seededRand(90417);

    // === BASE: Dark industrial sub-floor ===
    ctx.fillStyle = '#0e1014';
    ctx.fillRect(0, 0, S, S);
    _fillNoise(ctx, S, S, 16, 18, 22, 0.03, 0.08, 12000, 0.5, 2.5);

    // === TILE GRID: 4x4 checkerboard ===
    const tileSize = S / 4;
    const trimW = 6;         // L-channel trim width
    const bevel = 5;         // bevel depth illusion
    const innerPad = trimW + bevel + 1;

    // Pick one tile for drainage grate
    const grateTX = 3, grateTY = 1;

    // ---------- HELPER: draw one wood plank ----------
    function _drawWoodPlank(px, py, pw, ph, hue, sat, lum) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, pw, ph);
        ctx.clip();

        // Base colour with subtle horizontal gradient
        const wg = ctx.createLinearGradient(px, py, px + pw, py);
        const rBase = lum + 28, gBase = lum + 14, bBase = lum - 4;
        wg.addColorStop(0, `rgb(${rBase + hue},${gBase + sat},${bBase})`);
        wg.addColorStop(0.35, `rgb(${rBase + hue - 4},${gBase + sat - 2},${bBase - 3})`);
        wg.addColorStop(0.7, `rgb(${rBase + hue + 2},${gBase + sat + 1},${bBase + 1})`);
        wg.addColorStop(1, `rgb(${rBase + hue - 2},${gBase + sat},${bBase - 1})`);
        ctx.fillStyle = wg;
        ctx.fillRect(px, py, pw, ph);

        // Fine-grain noise on the plank
        _fillNoise(ctx, pw, ph, 35 + hue, 22 + sat, 10, 0.02, 0.06, Math.floor(pw * ph * 0.06), 0.5, 1.5);
        ctx.save();
        ctx.translate(px, py);
        // Darker noise specks
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = `rgba(10,6,2,${0.03 + _sr() * 0.05})`;
            ctx.fillRect(_sr() * pw, _sr() * ph, 1 + _sr() * 2, 1 + _sr());
        }
        ctx.restore();

        // === Wood grain: bezier curves with varying thickness ===
        const grainCount = 35 + Math.floor(_sr() * 20);
        for (let g = 0; g < grainCount; g++) {
            const gy = py + 2 + _sr() * (ph - 4);
            const thick = 0.3 + _sr() * 2.2;
            const alpha = 0.03 + _sr() * 0.1;
            const dark = _sr() > 0.45;
            ctx.strokeStyle = dark
                ? `rgba(12,6,1,${alpha})`
                : `rgba(65,40,18,${alpha})`;
            ctx.lineWidth = thick;
            ctx.beginPath();
            ctx.moveTo(px, gy);
            // Multi-segment bezier for organic waviness
            const segs = 2 + Math.floor(_sr() * 3);
            let cx = px;
            for (let s = 0; s < segs; s++) {
                const nx = px + (pw * (s + 1)) / segs;
                const cpy1 = gy + (_sr() - 0.5) * 6;
                const cpy2 = gy + (_sr() - 0.5) * 6;
                ctx.bezierCurveTo(
                    cx + (nx - cx) * 0.33, cpy1,
                    cx + (nx - cx) * 0.66, cpy2,
                    nx, gy + (_sr() - 0.5) * 3
                );
                cx = nx;
            }
            ctx.stroke();
        }

        // === Wood knots with concentric rings ===
        const knotCount = _sr() > 0.4 ? (_sr() > 0.75 ? 2 : 1) : 0;
        for (let ki = 0; ki < knotCount; ki++) {
            const kx = px + 18 + _sr() * (pw - 36);
            const ky = py + 12 + _sr() * (ph - 24);
            const kr = 6 + _sr() * 10;
            const kAngle = _sr() * 0.6;
            // Dark center
            const kGrad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
            kGrad.addColorStop(0, 'rgba(18,10,3,0.65)');
            kGrad.addColorStop(0.3, 'rgba(28,16,6,0.45)');
            kGrad.addColorStop(0.7, 'rgba(42,24,10,0.25)');
            kGrad.addColorStop(1, 'rgba(55,32,14,0)');
            ctx.fillStyle = kGrad;
            ctx.beginPath();
            ctx.ellipse(kx, ky, kr, kr * 0.65, kAngle, 0, Math.PI * 2);
            ctx.fill();
            // Concentric ring detail (3-5 rings)
            const rings = 3 + Math.floor(_sr() * 3);
            for (let r = 1; r <= rings; r++) {
                const rr = kr * (r / (rings + 1));
                ctx.strokeStyle = `rgba(24,14,5,${0.12 + _sr() * 0.1})`;
                ctx.lineWidth = 0.6 + _sr() * 0.8;
                ctx.beginPath();
                ctx.ellipse(kx, ky, rr, rr * 0.65, kAngle + _sr() * 0.15, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // === Nail heads at plank ends ===
        const nailR = 2.2;
        const nailInsetX = 8 + _sr() * 4;
        const nailY1 = py + ph * 0.3 + _sr() * ph * 0.1;
        const nailY2 = py + ph * 0.65 + _sr() * ph * 0.1;
        const nailPositions = [
            [px + nailInsetX, nailY1], [px + nailInsetX, nailY2],
            [px + pw - nailInsetX, nailY1], [px + pw - nailInsetX, nailY2]
        ];
        nailPositions.forEach(([nx, ny]) => {
            // Nail shadow
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.beginPath();
            ctx.arc(nx + 0.5, ny + 0.5, nailR + 0.5, 0, Math.PI * 2);
            ctx.fill();
            // Nail body
            const ng = ctx.createRadialGradient(nx - 0.5, ny - 0.5, 0, nx, ny, nailR);
            ng.addColorStop(0, '#6a6e78');
            ng.addColorStop(0.6, '#3e424a');
            ng.addColorStop(1, '#22252a');
            ctx.fillStyle = ng;
            ctx.beginPath();
            ctx.arc(nx, ny, nailR, 0, Math.PI * 2);
            ctx.fill();
            // Tiny highlight
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.arc(nx - 0.6, ny - 0.6, 0.8, 0, Math.PI * 2);
            ctx.fill();
        });

        // === Splinters/chips on edges ===
        const chipCount = 2 + Math.floor(_sr() * 4);
        for (let ci = 0; ci < chipCount; ci++) {
            const onTop = _sr() > 0.5;
            const cx = px + 6 + _sr() * (pw - 12);
            const cy = onTop ? py : py + ph;
            const cw = 2 + _sr() * 6;
            const ch = 1 + _sr() * 3;
            const chipAlpha = 0.08 + _sr() * 0.12;
            ctx.fillStyle = `rgba(8,4,1,${chipAlpha})`;
            ctx.fillRect(cx, cy - ch * 0.5, cw, ch);
            // Light edge on chip
            ctx.fillStyle = `rgba(90,65,35,${chipAlpha * 0.6})`;
            ctx.fillRect(cx, onTop ? cy : cy - 0.5, cw, 0.5);
        }

        // === Boot scuff wear patterns ===
        if (_sr() > 0.55) {
            const scuffX = px + _sr() * (pw * 0.6) + pw * 0.2;
            const scuffY = py + _sr() * (ph * 0.6) + ph * 0.2;
            const scuffW = 15 + _sr() * 30;
            const scuffH = 8 + _sr() * 12;
            const scG = ctx.createRadialGradient(scuffX, scuffY, 0, scuffX, scuffY, scuffW * 0.5);
            scG.addColorStop(0, 'rgba(55,42,28,0.15)');
            scG.addColorStop(0.5, 'rgba(45,34,22,0.08)');
            scG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = scG;
            ctx.beginPath();
            ctx.ellipse(scuffX, scuffY, scuffW * 0.5, scuffH * 0.5, _sr() * 0.4, 0, Math.PI * 2);
            ctx.fill();
            // Fine scratch lines inside scuff
            for (let sl = 0; sl < 5; sl++) {
                ctx.strokeStyle = `rgba(30,20,10,${0.06 + _sr() * 0.08})`;
                ctx.lineWidth = 0.4 + _sr() * 0.8;
                ctx.beginPath();
                const slx = scuffX - scuffW * 0.3 + _sr() * scuffW * 0.6;
                const sly = scuffY - scuffH * 0.3 + _sr() * scuffH * 0.3;
                ctx.moveTo(slx, sly);
                ctx.lineTo(slx + 6 + _sr() * 14, sly + (_sr() - 0.5) * 4);
                ctx.stroke();
            }
        }

        // === Age darkening near edges (dirt accumulation) ===
        // Top edge
        const edgeDark = ctx.createLinearGradient(px, py, px, py + 10);
        edgeDark.addColorStop(0, 'rgba(5,3,1,0.25)');
        edgeDark.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = edgeDark;
        ctx.fillRect(px, py, pw, 10);
        // Bottom edge
        const edgeDarkB = ctx.createLinearGradient(px, py + ph, px, py + ph - 10);
        edgeDarkB.addColorStop(0, 'rgba(5,3,1,0.25)');
        edgeDarkB.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = edgeDarkB;
        ctx.fillRect(px, py + ph - 10, pw, 10);
        // Left edge
        const edgeDarkL = ctx.createLinearGradient(px, py, px + 8, py);
        edgeDarkL.addColorStop(0, 'rgba(5,3,1,0.2)');
        edgeDarkL.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = edgeDarkL;
        ctx.fillRect(px, py, 8, ph);
        // Right edge
        const edgeDarkR = ctx.createLinearGradient(px + pw, py, px + pw - 8, py);
        edgeDarkR.addColorStop(0, 'rgba(5,3,1,0.2)');
        edgeDarkR.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = edgeDarkR;
        ctx.fillRect(px + pw - 8, py, 8, ph);

        ctx.restore();
    }

    // ---------- HELPER: draw diamond plate metal ----------
    function _drawDiamondPlate(px, py, pw, ph, blueShift) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, pw, ph);
        ctx.clip();

        // Base metal gradient with colour variation
        const mGrad = ctx.createLinearGradient(px, py, px + pw * 0.3, py + ph);
        const mr = 28 + blueShift * 0.3, mg = 32 + blueShift * 0.6, mb = 38 + blueShift;
        mGrad.addColorStop(0, `rgb(${mr + 6},${mg + 6},${mb + 8})`);
        mGrad.addColorStop(0.5, `rgb(${mr},${mg},${mb})`);
        mGrad.addColorStop(1, `rgb(${mr - 4},${mg - 2},${mb + 2})`);
        ctx.fillStyle = mGrad;
        ctx.fillRect(px, py, pw, ph);

        // Brushed metal base noise
        _fillNoise(ctx, pw, ph, mr, mg, mb, 0.02, 0.06, Math.floor(pw * ph * 0.04), 0.4, 1.8);
        ctx.save();
        ctx.translate(px, py);
        for (let i = 0; i < 25; i++) {
            const gy = _sr() * ph;
            ctx.strokeStyle = `rgba(${mr + 12},${mg + 14},${mb + 16},${0.04 + _sr() * 0.06})`;
            ctx.lineWidth = 0.3 + _sr() * 0.6;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(pw, gy + (_sr() - 0.5) * 2);
            ctx.stroke();
        }
        ctx.restore();

        // === Diamond plate pattern with per-diamond highlight/shadow ===
        const dStep = 14;
        const dRx = 5, dRy = 3.5;
        for (let dx = px + 6; dx < px + pw - 6; dx += dStep) {
            for (let dy = py + 6; dy < py + ph - 6; dy += dStep) {
                const row = Math.floor((dy - py) / dStep);
                const offX = (row % 2) * (dStep * 0.5);
                const cx = dx + offX;
                const cy = dy;
                if (cx > px + pw - 6) continue;

                // Shadow underneath diamond
                ctx.fillStyle = 'rgba(0,0,0,0.12)';
                ctx.beginPath();
                ctx.moveTo(cx, cy - dRy + 0.8);
                ctx.lineTo(cx + dRx + 0.8, cy + 0.8);
                ctx.lineTo(cx, cy + dRy + 0.8);
                ctx.lineTo(cx - dRx + 0.8, cy + 0.8);
                ctx.closePath();
                ctx.fill();

                // Diamond body
                const dVal = 42 + Math.floor(_hash2d(cx * 0.1, cy * 0.1) * 18);
                ctx.fillStyle = `rgb(${dVal + blueShift * 0.2},${dVal + blueShift * 0.4},${dVal + blueShift * 0.7})`;
                ctx.beginPath();
                ctx.moveTo(cx, cy - dRy);
                ctx.lineTo(cx + dRx, cy);
                ctx.lineTo(cx, cy + dRy);
                ctx.lineTo(cx - dRx, cy);
                ctx.closePath();
                ctx.fill();

                // Top-left highlight
                ctx.fillStyle = 'rgba(255,255,255,0.07)';
                ctx.beginPath();
                ctx.moveTo(cx, cy - dRy);
                ctx.lineTo(cx + dRx, cy);
                ctx.lineTo(cx, cy);
                ctx.lineTo(cx - dRx, cy);
                ctx.closePath();
                ctx.fill();

                // Bottom-right darker
                ctx.fillStyle = 'rgba(0,0,0,0.06)';
                ctx.beginPath();
                ctx.moveTo(cx, cy + dRy);
                ctx.lineTo(cx + dRx, cy);
                ctx.lineTo(cx, cy);
                ctx.lineTo(cx - dRx, cy);
                ctx.closePath();
                ctx.fill();
            }
        }

        // === Anti-slip texture bumps ===
        for (let ab = 0; ab < 30; ab++) {
            const bx = px + 4 + _sr() * (pw - 8);
            const by = py + 4 + _sr() * (ph - 8);
            const br = 0.6 + _sr() * 1.2;
            ctx.fillStyle = `rgba(60,65,75,${0.1 + _sr() * 0.1})`;
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.arc(bx - 0.3, by - 0.3, br * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // === Oil/grease stains ===
        if (_sr() > 0.45) {
            const ox = px + 15 + _sr() * (pw - 30);
            const oy = py + 15 + _sr() * (ph - 30);
            const oRx = 10 + _sr() * 18;
            const oRy = 6 + _sr() * 12;
            const oG = ctx.createRadialGradient(ox, oy, 0, ox, oy, oRx);
            oG.addColorStop(0, 'rgba(8,6,3,0.3)');
            oG.addColorStop(0.4, 'rgba(12,10,6,0.18)');
            oG.addColorStop(0.7, 'rgba(15,12,8,0.06)');
            oG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = oG;
            ctx.beginPath();
            ctx.ellipse(ox, oy, oRx, oRy, _sr() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
            // Iridescent sheen on oil
            const sheenColors = [
                `rgba(60,30,80,0.06)`, `rgba(30,60,80,0.05)`,
                `rgba(50,70,40,0.04)`, `rgba(80,50,30,0.04)`
            ];
            sheenColors.forEach((col, i) => {
                ctx.fillStyle = col;
                ctx.beginPath();
                ctx.ellipse(
                    ox + (_sr() - 0.5) * 6, oy + (_sr() - 0.5) * 4,
                    oRx * (0.5 + i * 0.12), oRy * (0.5 + i * 0.12),
                    _sr() * Math.PI, 0, Math.PI * 2
                );
                ctx.fill();
            });
        }

        // === Heavy equipment drag scratches ===
        const scratchCount = 2 + Math.floor(_sr() * 4);
        for (let si = 0; si < scratchCount; si++) {
            const sx1 = px + _sr() * pw;
            const sy1 = py + _sr() * ph;
            const sAngle = _sr() * Math.PI;
            const sLen = 25 + _sr() * 60;
            const sx2 = sx1 + Math.cos(sAngle) * sLen;
            const sy2 = sy1 + Math.sin(sAngle) * sLen;
            // Dark scratch line
            ctx.strokeStyle = `rgba(10,12,16,${0.15 + _sr() * 0.15})`;
            ctx.lineWidth = 0.5 + _sr() * 1.5;
            ctx.beginPath();
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(sx2, sy2);
            ctx.stroke();
            // Bright edge beside scratch (exposed metal)
            ctx.strokeStyle = `rgba(70,75,85,${0.06 + _sr() * 0.06})`;
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.moveTo(sx1 + 0.8, sy1 + 0.8);
            ctx.lineTo(sx2 + 0.8, sy2 + 0.8);
            ctx.stroke();
        }

        ctx.restore();
    }

    // =============================================
    // PASS 1: Draw all tiles
    // =============================================
    for (let tx = 0; tx < 4; tx++) {
        for (let ty = 0; ty < 4; ty++) {
            const px = tx * tileSize;
            const py = ty * tileSize;
            const isWood = (tx + ty) % 2 === 0;
            const isDrain = (tx === grateTX && ty === grateTY);

            // === Beveled edge (3D depth illusion) ===
            // Shadow on bottom and right edges
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(px + tileSize - bevel, py + bevel, bevel, tileSize - bevel);
            ctx.fillRect(px + bevel, py + tileSize - bevel, tileSize - bevel, bevel);
            // Highlight on top and left edges
            ctx.fillStyle = 'rgba(50,55,65,0.18)';
            ctx.fillRect(px, py, tileSize, bevel);
            ctx.fillRect(px, py, bevel, tileSize);

            if (isDrain) {
                // === DRAINAGE GRATE TILE ===
                // Dark void beneath
                ctx.fillStyle = '#040506';
                ctx.fillRect(px + innerPad, py + innerPad, tileSize - innerPad * 2, tileSize - innerPad * 2);

                // Subtle depth glow from below
                const voidG = ctx.createRadialGradient(
                    px + tileSize * 0.5, py + tileSize * 0.5, 0,
                    px + tileSize * 0.5, py + tileSize * 0.5, tileSize * 0.35
                );
                voidG.addColorStop(0, 'rgba(6,10,14,0.4)');
                voidG.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = voidG;
                ctx.fillRect(px + innerPad, py + innerPad, tileSize - innerPad * 2, tileSize - innerPad * 2);

                // Metal grate bars
                const barW = 4;
                const gapW = 14;
                const gx1 = px + innerPad + 4;
                const gy1 = py + innerPad + 4;
                const gx2 = px + tileSize - innerPad - 4;
                const gy2 = py + tileSize - innerPad - 4;

                // Horizontal bars
                for (let by = gy1; by < gy2; by += gapW + barW) {
                    const bGrad = ctx.createLinearGradient(gx1, by, gx1, by + barW);
                    bGrad.addColorStop(0, '#3a3e46');
                    bGrad.addColorStop(0.3, '#50555e');
                    bGrad.addColorStop(0.7, '#3a3e46');
                    bGrad.addColorStop(1, '#22252c');
                    ctx.fillStyle = bGrad;
                    ctx.fillRect(gx1, by, gx2 - gx1, barW);
                    // Top highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.08)';
                    ctx.fillRect(gx1, by, gx2 - gx1, 1);
                    // Bottom shadow
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(gx1, by + barW - 1, gx2 - gx1, 1);
                }

                // Vertical bars
                for (let bx = gx1; bx < gx2; bx += gapW + barW) {
                    const bGrad = ctx.createLinearGradient(bx, gy1, bx + barW, gy1);
                    bGrad.addColorStop(0, '#3a3e46');
                    bGrad.addColorStop(0.3, '#4e535c');
                    bGrad.addColorStop(0.7, '#3a3e46');
                    bGrad.addColorStop(1, '#22252c');
                    ctx.fillStyle = bGrad;
                    ctx.fillRect(bx, gy1, barW, gy2 - gy1);
                    // Left highlight
                    ctx.fillStyle = 'rgba(255,255,255,0.06)';
                    ctx.fillRect(bx, gy1, 1, gy2 - gy1);
                }

                // Rust stains dripping from grate
                for (let rs = 0; rs < 3; rs++) {
                    const rx = gx1 + _sr() * (gx2 - gx1);
                    const rl = 8 + _sr() * 25;
                    ctx.fillStyle = `rgba(60,30,12,${0.08 + _sr() * 0.1})`;
                    ctx.fillRect(rx, gy2, 2, rl);
                }

            } else if (isWood) {
                // === WOOD PLANK TILE (2-3 planks per tile) ===
                const plankCount = 2 + (_sr() > 0.5 ? 1 : 0);
                const plankH = (tileSize - innerPad * 2) / plankCount;
                const plankGap = 2;

                for (let pi = 0; pi < plankCount; pi++) {
                    const ppx = px + innerPad;
                    const ppy = py + innerPad + pi * plankH;
                    const ppw = tileSize - innerPad * 2;
                    const pph = plankH - plankGap;

                    // Per-plank colour variation
                    const hueShift = Math.floor(_sr() * 12) - 4;
                    const satShift = Math.floor(_sr() * 8) - 3;
                    const lumBase = 30 + Math.floor(_sr() * 18);
                    // Some planks reddish, some darker
                    const reddish = _sr() > 0.7 ? 6 : 0;

                    _drawWoodPlank(ppx, ppy, ppw, pph, hueShift + reddish, satShift, lumBase);

                    // Plank gap shadow line
                    ctx.fillStyle = 'rgba(0,0,0,0.4)';
                    ctx.fillRect(ppx, ppy + pph, ppw, plankGap);
                    ctx.fillStyle = 'rgba(40,30,18,0.15)';
                    ctx.fillRect(ppx, ppy + pph + plankGap - 0.5, ppw, 0.5);
                }

                // Corner rivets holding wood panels
                const ri = innerPad + 6;
                _drawRivet(ctx, px + ri, py + ri, 3.5);
                _drawRivet(ctx, px + tileSize - ri, py + ri, 3.5);
                _drawRivet(ctx, px + ri, py + tileSize - ri, 3.5);
                _drawRivet(ctx, px + tileSize - ri, py + tileSize - ri, 3.5);

            } else {
                // === METAL PLATE TILE ===
                // Per-tile colour variation: blueish vs grey
                const blueShift = Math.floor(_sr() * 14) - 3;
                _drawDiamondPlate(
                    px + innerPad, py + innerPad,
                    tileSize - innerPad * 2, tileSize - innerPad * 2,
                    blueShift
                );

                // Corner rivets plus center rivet
                const ri = innerPad + 6;
                _drawRivet(ctx, px + ri, py + ri, 3);
                _drawRivet(ctx, px + tileSize - ri, py + ri, 3);
                _drawRivet(ctx, px + ri, py + tileSize - ri, 3);
                _drawRivet(ctx, px + tileSize - ri, py + tileSize - ri, 3);
                _drawRivet(ctx, px + tileSize * 0.5, py + tileSize * 0.5, 4);
            }
        }
    }

    // =============================================
    // PASS 2: L-channel metal trim between tiles
    // =============================================
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    for (let tx = 0; tx < 4; tx++) {
        for (let ty = 0; ty < 4; ty++) {
            const px = tx * tileSize;
            const py = ty * tileSize;

            // Draw L-channel trim on all four edges
            const edges = [
                { x: px, y: py, w: tileSize, h: trimW, horiz: true, top: true },
                { x: px, y: py + tileSize - trimW, w: tileSize, h: trimW, horiz: true, top: false },
                { x: px, y: py, w: trimW, h: tileSize, horiz: false, top: true },
                { x: px + tileSize - trimW, y: py, w: trimW, h: tileSize, horiz: false, top: false }
            ];

            edges.forEach(e => {
                // Trim base
                const tGrad = e.horiz
                    ? ctx.createLinearGradient(e.x, e.y, e.x, e.y + e.h)
                    : ctx.createLinearGradient(e.x, e.y, e.x + e.w, e.y);
                if (e.top) {
                    tGrad.addColorStop(0, '#2a2e36');
                    tGrad.addColorStop(0.5, '#3a3e48');
                    tGrad.addColorStop(1, '#22262e');
                } else {
                    tGrad.addColorStop(0, '#22262e');
                    tGrad.addColorStop(0.5, '#3a3e48');
                    tGrad.addColorStop(1, '#2a2e36');
                }
                ctx.fillStyle = tGrad;
                ctx.fillRect(e.x, e.y, e.w, e.h);

                // Trim highlight line
                ctx.fillStyle = 'rgba(255,255,255,0.06)';
                if (e.horiz) {
                    ctx.fillRect(e.x, e.top ? e.y : e.y + e.h - 0.5, e.w, 0.5);
                } else {
                    ctx.fillRect(e.top ? e.x : e.x + e.w - 0.5, e.y, 0.5, e.h);
                }
            });

            // Rivets along trim (every ~64px on horizontal, same on vertical)
            const rivetSpacing = 64;
            for (let rx = px + rivetSpacing * 0.5; rx < px + tileSize; rx += rivetSpacing) {
                _drawRivet(ctx, rx, py + trimW * 0.5, 2.2);
                _drawRivet(ctx, rx, py + tileSize - trimW * 0.5, 2.2);
            }
            for (let ry = py + rivetSpacing * 0.5; ry < py + tileSize; ry += rivetSpacing) {
                _drawRivet(ctx, px + trimW * 0.5, ry, 2.2);
                _drawRivet(ctx, px + tileSize - trimW * 0.5, ry, 2.2);
            }
        }
    }

    // =============================================
    // PASS 3: Grid lines (deep gaps between tiles)
    // =============================================
    ctx.strokeStyle = '#050608';
    ctx.lineWidth = 3;
    for (let gx = 0; gx <= S; gx += tileSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, S);
        ctx.stroke();
    }
    for (let gy = 0; gy <= S; gy += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(S, gy);
        ctx.stroke();
    }
    // Inner highlight on grid edges
    ctx.strokeStyle = 'rgba(55,60,70,0.12)';
    ctx.lineWidth = 1;
    for (let gx = tileSize; gx < S; gx += tileSize) {
        ctx.beginPath();
        ctx.moveTo(gx + 1.5, 0);
        ctx.lineTo(gx + 1.5, S);
        ctx.stroke();
    }
    for (let gy = tileSize; gy < S; gy += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy + 1.5);
        ctx.lineTo(S, gy + 1.5);
        ctx.stroke();
    }

    // =============================================
    // PASS 4: Dirt/dust accumulation in corners
    // =============================================
    for (let tx = 0; tx < 4; tx++) {
        for (let ty = 0; ty < 4; ty++) {
            const corners = [
                [tx * tileSize, ty * tileSize],
                [(tx + 1) * tileSize, ty * tileSize],
                [tx * tileSize, (ty + 1) * tileSize],
                [(tx + 1) * tileSize, (ty + 1) * tileSize]
            ];
            corners.forEach(([cx, cy]) => {
                const dirtR = 18 + _sr() * 14;
                const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, dirtR);
                gr.addColorStop(0, 'rgba(6,5,3,0.4)');
                gr.addColorStop(0.4, 'rgba(10,8,5,0.2)');
                gr.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = gr;
                ctx.beginPath();
                ctx.arc(cx, cy, dirtR + 8, 0, Math.PI * 2);
                ctx.fill();
            });

            // Edge dirt accumulation (along tile edges)
            const edgeDirtAlpha = 0.03 + _sr() * 0.06;
            const tpx = tx * tileSize;
            const tpy = ty * tileSize;
            for (let d = 0; d < 20; d++) {
                const side = Math.floor(_sr() * 4);
                let dx, dy;
                if (side === 0) { dx = tpx + _sr() * tileSize; dy = tpy + _sr() * 5; }
                else if (side === 1) { dx = tpx + _sr() * tileSize; dy = tpy + tileSize - _sr() * 5; }
                else if (side === 2) { dx = tpx + _sr() * 5; dy = tpy + _sr() * tileSize; }
                else { dx = tpx + tileSize - _sr() * 5; dy = tpy + _sr() * tileSize; }
                ctx.fillStyle = `rgba(8,6,3,${edgeDirtAlpha})`;
                ctx.fillRect(dx, dy, 2 + _sr() * 4, 1 + _sr() * 3);
            }
        }
    }

    // =============================================
    // PASS 5: Global details
    // =============================================

    // --- Boot prints (2 partial, faded) ---
    for (let bp = 0; bp < 2; bp++) {
        const bpx = 150 + _sr() * (S - 300);
        const bpy = 150 + _sr() * (S - 300);
        const bpAngle = _sr() * Math.PI * 2;
        const bpScale = 0.7 + _sr() * 0.5;
        ctx.save();
        ctx.translate(bpx, bpy);
        ctx.rotate(bpAngle);
        ctx.scale(bpScale, bpScale);
        ctx.globalAlpha = 0.06 + _sr() * 0.06;

        // Boot sole shape
        ctx.fillStyle = 'rgba(12,10,6,1)';
        ctx.beginPath();
        // Heel
        ctx.ellipse(0, 22, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Sole body
        ctx.beginPath();
        ctx.ellipse(0, -5, 16, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        // Toe
        ctx.beginPath();
        ctx.ellipse(0, -28, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tread pattern (horizontal lines)
        ctx.strokeStyle = 'rgba(20,16,10,0.8)';
        ctx.lineWidth = 1.5;
        for (let t = -28; t < 30; t += 5) {
            const tw = t < -15 ? 10 : (t < 10 ? 14 : 12);
            ctx.beginPath();
            ctx.moveTo(-tw, t);
            ctx.lineTo(tw, t);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // --- Oil puddle with rainbow sheen ---
    const oilX = S * 0.6, oilY = S * 0.65;
    const oilRx = 50 + _sr() * 20;
    const oilRy = 28 + _sr() * 15;
    const oilAngle = _sr() * 0.5;

    // Dark oil base
    const oilBase = ctx.createRadialGradient(oilX, oilY, 0, oilX, oilY, oilRx);
    oilBase.addColorStop(0, 'rgba(8,6,4,0.5)');
    oilBase.addColorStop(0.5, 'rgba(10,8,5,0.35)');
    oilBase.addColorStop(0.8, 'rgba(8,6,4,0.15)');
    oilBase.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = oilBase;
    ctx.beginPath();
    ctx.ellipse(oilX, oilY, oilRx, oilRy, oilAngle, 0, Math.PI * 2);
    ctx.fill();

    // Rainbow iridescence rings
    const iridColors = [
        { r: 80, g: 30, b: 90, a: 0.07 },   // purple
        { r: 30, g: 50, b: 100, a: 0.06 },  // blue
        { r: 20, g: 80, b: 60, a: 0.05 },   // teal
        { r: 70, g: 80, b: 20, a: 0.05 },   // yellow-green
        { r: 90, g: 50, b: 20, a: 0.06 },   // orange
        { r: 90, g: 25, b: 40, a: 0.05 }    // magenta
    ];
    iridColors.forEach((col, i) => {
        const frac = 0.3 + i * 0.1;
        const iG = ctx.createRadialGradient(
            oilX + (_sr() - 0.5) * 8, oilY + (_sr() - 0.5) * 5,
            oilRx * (frac - 0.08),
            oilX, oilY, oilRx * (frac + 0.08)
        );
        iG.addColorStop(0, `rgba(${col.r},${col.g},${col.b},0)`);
        iG.addColorStop(0.5, `rgba(${col.r},${col.g},${col.b},${col.a})`);
        iG.addColorStop(1, `rgba(${col.r},${col.g},${col.b},0)`);
        ctx.fillStyle = iG;
        ctx.beginPath();
        ctx.ellipse(oilX, oilY, oilRx, oilRy, oilAngle, 0, Math.PI * 2);
        ctx.fill();
    });

    // Bright specular highlight on oil surface
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.ellipse(oilX - oilRx * 0.2, oilY - oilRy * 0.25, oilRx * 0.3, oilRy * 0.25, oilAngle, 0, Math.PI * 2);
    ctx.fill();

    // --- Global scuff marks across floor ---
    for (let sm = 0; sm < 10; sm++) {
        const sx = _sr() * S;
        const sy = _sr() * S;
        const sa = _sr() * Math.PI * 2;
        const sl = 15 + _sr() * 60;
        ctx.strokeStyle = `rgba(18,20,24,${0.12 + _sr() * 0.18})`;
        ctx.lineWidth = 1 + _sr() * 2.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(
            sx + Math.cos(sa) * sl * 0.33, sy + Math.sin(sa) * sl * 0.33 + (_sr() - 0.5) * 8,
            sx + Math.cos(sa) * sl * 0.66, sy + Math.sin(sa) * sl * 0.66 + (_sr() - 0.5) * 8,
            sx + Math.cos(sa) * sl, sy + Math.sin(sa) * sl
        );
        ctx.stroke();
    }

    // --- Final overall dust layer ---
    _fillNoise(ctx, S, S, 20, 18, 14, 0.01, 0.03, 3000, 0.5, 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
export function generateCeilingTexture() {
    const canvas = document.createElement('canvas');
    const S = 1024; // High res ceiling
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    const _sr = _seededRand(445566);

    // Dark base
    ctx.fillStyle = '#050608';
    ctx.fillRect(0, 0, S, S);

    // Noise base
    _fillNoise(ctx, S, S, 15, 17, 20, 0.05, 0.15, 20000, 1, 3);

    // === CEILING PANEL GRID (Acoustic / Metal panels) ===
    const cols = 4, rows = 4;
    const pW = S / cols, pH = S / rows;

    for(let r=0; r<rows; r++) {
        for(let c=0; c<cols; c++) {
            const px = c * pW;
            const py = r * pH;

            // Randomly missing or drooping panels
            const state = _sr();
            if (state < 0.05) {
                // Missing panel - show deep dark abyss with structural supports
                ctx.fillStyle = '#020203';
                ctx.fillRect(px + 4, py + 4, pW - 8, pH - 8);
                // Structural cross brace
                ctx.strokeStyle = '#0a0c10'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px+pW, py+pH); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(px+pW, py); ctx.lineTo(px, py+pH); ctx.stroke();
                continue;
            }

            // Draw panel
            const isDrooping = state > 0.9;
            ctx.save();
            if (isDrooping) {
                // Skew the context slightly to make panel look unhinged
                ctx.translate(px, py);
                ctx.rotate(0.05 * (_sr()>0.5?1:-1));
                ctx.translate(-px, -py);
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 10;
                ctx.shadowOffsetY = 10;
            }

            const tint = 10 + _sr()*8;
            ctx.fillStyle = `rgb(${tint}, ${tint+1}, ${tint+2})`;
            ctx.fillRect(px + 4, py + 4, pW - 8, pH - 8);

            // Panel acoustic texture (dots)
            if (_sr() > 0.3) {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                for(let dy=py+10; dy<py+pH-10; dy+=6) {
                    for(let dx=px+10; dx<px+pW-10; dx+=6) {
                        ctx.fillRect(dx, dy, 2, 2);
                    }
                }
            }

            // Water damage / stains
            if (_sr() > 0.6) {
                const sx = px + _sr()*pW, sy = py + _sr()*pH;
                const sGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, pW*0.4);
                sGrad.addColorStop(0, 'rgba(40,30,20,0.6)');
                sGrad.addColorStop(0.5, 'rgba(30,25,20,0.3)');
                sGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = sGrad;
                ctx.beginPath(); ctx.arc(sx, sy, pW*0.4, 0, Math.PI*2); ctx.fill();
            }

            // Metal grid rails holding panels
            ctx.restore();
        }
    }

    // Grid rails (T-bars)
    ctx.fillStyle = '#111316';
    for(let r=0; r<=rows; r++) {
        ctx.fillRect(0, r*pH - 6, S, 12);
        ctx.strokeStyle = '#050608'; ctx.lineWidth=2;
        ctx.strokeRect(0, r*pH - 6, S, 12);
    }
    for(let c=0; c<=cols; c++) {
        ctx.fillRect(c*pW - 6, 0, 12, S);
        ctx.strokeStyle = '#050608'; ctx.lineWidth=2;
        ctx.strokeRect(c*pW - 6, 0, 12, S);
    }

    // === LARGE OVERHEAD DUCTWORK ===
    const ductY = 200, ductH = 160;
    // Duct body
    const dGrad = ctx.createLinearGradient(0, ductY, 0, ductY + ductH);
    dGrad.addColorStop(0, '#15171a');
    dGrad.addColorStop(0.2, '#2c3138');
    dGrad.addColorStop(0.5, '#3a404a');
    dGrad.addColorStop(0.8, '#1e2126');
    dGrad.addColorStop(1, '#0a0c0e');
    ctx.fillStyle = dGrad;
    ctx.fillRect(0, ductY, S, ductH);

    // Duct segments
    for(let dx=0; dx<S; dx+=180) {
        // Vertical seam
        ctx.fillStyle = '#111316'; ctx.fillRect(dx, ductY, 15, ductH);
        ctx.strokeStyle = '#0a0b0d'; ctx.lineWidth = 2; ctx.strokeRect(dx, ductY, 15, ductH);
        // Rivets
        for(let ry=ductY+10; ry<ductY+ductH-5; ry+=15) {
            _drawRivet(ctx, dx + 7.5, ry, 4);
        }
        // Horizontal ridges
        for(let ix=dx+30; ix<dx+170; ix+=25) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(ix, ductY+5, 4, ductH-10);
            ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(ix-2, ductY+5, 2, ductH-10);
        }
    }

    // === SMALLER INTERSECTING PIPES ===
    const pipes = [
        { x: 300, w: 40, col: '#452015', rust: true }, // Rusty pipe
        { x: 700, w: 25, col: '#203545', rust: false }, // Blue/grey pipe
        { x: 800, w: 25, col: '#3a3e46', rust: false }
    ];
    pipes.forEach(p => {
        const pGrad = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
        pGrad.addColorStop(0, '#0a0b0e');
        pGrad.addColorStop(0.3, p.col);
        pGrad.addColorStop(0.7, p.col);
        pGrad.addColorStop(1, '#050608');
        ctx.fillStyle = pGrad;
        ctx.fillRect(p.x, 0, p.w, S);

        // Pipe joints
        for(let jy=100; jy<S; jy+=300) {
            ctx.fillStyle = '#111'; ctx.fillRect(p.x-4, jy, p.w+8, 20);
            _drawRivet(ctx, p.x, jy+10, 3);
            _drawRivet(ctx, p.x+p.w, jy+10, 3);
        }

        // Rust
        if(p.rust) {
            for(let ry=0; ry<S; ry+=40) {
                if(_sr()>0.4) {
                    ctx.fillStyle = 'rgba(150,60,20,0.3)';
                    ctx.beginPath();
                    ctx.arc(p.x+p.w/2, ry, p.w*0.8, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
    });

    // === HANGING CABLES ===
    for(let c=0; c<15; c++) {
        const cy1 = _sr()*S, cy2 = _sr()*S;
        const cx1 = 0, cx2 = S;
        ctx.strokeStyle = _sr()>0.8 ? '#802020' : '#111'; // rare red cable
        ctx.lineWidth = 2 + _sr()*4;
        ctx.beginPath();
        ctx.moveTo(cx1, cy1);
        ctx.bezierCurveTo(cx1+300, cy1+200, cx2-300, cy2+200, cx2, cy2);
        ctx.stroke();
    }

    // === BROKEN / FLICKERING FLUORESCENT LIGHTS ===
    const lights = [
        { x: 150, y: 100, on: true },
        { x: 650, y: 700, on: false },
        { x: 150, y: 700, on: true }
    ];

    lights.forEach(l => {
        const lw = 280, lh = 50;

        // Shadow cast on ceiling
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 20;

        // Fixture body
        ctx.fillStyle = '#111215';
        ctx.fillRect(l.x, l.y, lw, lh);
        ctx.shadowColor = 'transparent';

        // Rim
        ctx.strokeStyle = '#22252a'; ctx.lineWidth = 4;
        ctx.strokeRect(l.x, l.y, lw, lh);

        // Tubes
        const tubeGrad = ctx.createLinearGradient(0, l.y, 0, l.y + lh);
        if (l.on) {
            // Bright eerie green-blue glow
            tubeGrad.addColorStop(0, '#e0ffff');
            tubeGrad.addColorStop(0.5, '#ffffff');
            tubeGrad.addColorStop(1, '#d0f0f0');

            // Emissive glow
            const glowGrad = ctx.createRadialGradient(l.x + lw/2, l.y + lh/2, 0, l.x + lw/2, l.y + lh/2, 300);
            glowGrad.addColorStop(0, 'rgba(180, 220, 255, 0.15)');
            glowGrad.addColorStop(0.5, 'rgba(100, 150, 200, 0.05)');
            glowGrad.addColorStop(1, 'rgba(0,0,0,0)');

            // Draw glow behind
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = glowGrad;
            ctx.fillRect(l.x - 300, l.y - 300, lw + 600, lh + 600);
            ctx.globalCompositeOperation = 'source-over';

        } else {
            // Dead tube
            tubeGrad.addColorStop(0, '#15181a');
            tubeGrad.addColorStop(0.5, '#20252a');
            tubeGrad.addColorStop(1, '#111215');
        }

        ctx.fillStyle = tubeGrad;
        // Two tubes
        ctx.fillRect(l.x + 10, l.y + 10, lw - 20, 10);
        ctx.fillRect(l.x + 10, l.y + 30, lw - 20, 10);

        // Cage / Grill over light
        ctx.strokeStyle = '#050608';
        ctx.lineWidth = 2;
        for(let gx=l.x+15; gx<l.x+lw; gx+=15) {
            ctx.beginPath(); ctx.moveTo(gx, l.y); ctx.lineTo(gx, l.y+lh); ctx.stroke();
        }
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
async function loadBloodMessageFont() {
    if (bloodMessageFontLoaded)
        return;
    try {
        const fontFace = new FontFace(BLOOD_MESSAGE_FONT_FAMILY, `url(${BLOOD_MESSAGE_FONT_URL})`);
        await fontFace.load();
        document.fonts.add(fontFace);
        bloodMessageFontLoaded = true;
    }
    catch (error) {
        console.warn('No se pudo cargar la fuente de mensajes sangrientos:', error);
    }
}
function generateBloodMessageTexture(message) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const longMessage = message.length > 22;
    const fontSize = longMessage ? 80 : 104;
    ctx.font = `400 ${fontSize}px ${BLOOD_MESSAGE_FONT_FAMILY}, "Arial Black", Impact, sans-serif`;
    // Sombra húmeda y borde oscuro para que parezca sangre sobre metal.
    ctx.shadowColor = 'rgba(15, 0, 0, 0.85)';
    ctx.shadowBlur = 8;
    ctx.lineWidth = longMessage ? 14 : 18;
    ctx.strokeStyle = 'rgba(45, 0, 0, 0.92)';
    ctx.strokeText(message, canvas.width / 2, canvas.height * 0.45);
    ctx.shadowBlur = 4;
    ctx.fillStyle = 'rgba(125, 0, 0, 0.92)';
    ctx.fillText(message, canvas.width / 2, canvas.height * 0.45);
    // Trazos irregulares y goteos debajo de letras simulando escritura a mano.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(92, 0, 0, 0.78)';
    ctx.lineCap = 'round';
    const dripCount = Math.max(6, Math.floor(message.length / 3));
    for (let i = 0; i < dripCount; i++) {
        const x = 120 + ((i * 97) % 780) + Math.sin(i * 1.7) * 18;
        const y = canvas.height * (0.54 + (i % 3) * 0.025);
        const length = 38 + ((i * 29) % 110);
        ctx.lineWidth = 4 + (i % 4);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + 10, y + length * 0.35, x - 12, y + length * 0.75, x + 4, y + length);
        ctx.stroke();
        ctx.fillStyle = 'rgba(105, 0, 0, 0.82)';
        ctx.beginPath();
        ctx.arc(x + 4, y + length + 4, 5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
    }
    // Salpicaduras pequeñas alrededor del texto.
    ctx.fillStyle = 'rgba(110, 0, 0, 0.55)';
    for (let i = 0; i < 36; i++) {
        const x = 70 + ((i * 151) % 890);
        const y = 70 + ((i * 83) % 250);
        const radius = 2 + (i % 5);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}
function addBloodMessageToWall(scene, message, placement) {
    const texture = generateBloodMessageTexture(message);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(GRID_SIZE * 0.9, WALL_HEIGHT * 0.42), material);
    const posX = placement.x * GRID_SIZE;
    const posZ = placement.z * GRID_SIZE;
    const offset = GRID_SIZE / 2 + 0.012;
    plane.position.set(posX, WALL_HEIGHT * (0.54 + placement.heightOffset), posZ);
    if (placement.side === 'NORTH') {
        plane.position.z -= offset;
        plane.rotation.y = Math.PI;
    }
    else if (placement.side === 'SOUTH') {
        plane.position.z += offset;
    }
    else if (placement.side === 'WEST') {
        plane.position.x -= offset;
        plane.rotation.y = -Math.PI / 2;
    }
    else if (placement.side === 'EAST') {
        plane.position.x += offset;
        plane.rotation.y = Math.PI / 2;
    }
    scene.add(plane);
}
function isWalkableMessageCell(x, z, map) {
    return z >= 0 && z < map.length && x >= 0 && x < map[z].length && map[z][x] !== 1;
}
function getBloodMessagePlacements(level = 1) {
    const map = getMapForLevel(level);
    const sides = [
        { side: 'NORTH', dx: 0, dz: -1 },
        { side: 'EAST', dx: 1, dz: 0 },
        { side: 'SOUTH', dx: 0, dz: 1 },
        { side: 'WEST', dx: -1, dz: 0 }
    ];
    const candidates = [];
    for (let z = 1; z < map.length - 1; z++) {
        for (let x = 1; x < map[z].length - 1; x++) {
            if (map[z][x] !== 1)
                continue;
            sides.forEach((dir) => {
                if (isWalkableMessageCell(x + dir.dx, z + dir.dz, map)) {
                    candidates.push({ x, z, side: dir.side });
                }
            });
        }
    }
    if (candidates.length === 0)
        return [];
    // Elegir posiciones espaciadas para que haya una sola copia de cada frase y queden distribuidas por el mapa.
    return BLOOD_WALL_MESSAGES.map((message, index) => {
        const candidateIndex = Math.floor(((index + 0.5) * candidates.length) / BLOOD_WALL_MESSAGES.length);
        return {
            ...candidates[candidateIndex % candidates.length],
            message,
            heightOffset: (index % 3 - 1) * 0.06
        };
    });
}
export async function addBloodWallMessages(scene, level = 1) {
    if (level === 2) return; // No generar textos en la jungla
    await loadBloodMessageFont();
    getBloodMessagePlacements(level).forEach((placement) => {
        addBloodMessageToWall(scene, placement.message, placement);
    });
}
export function generateZombieFaceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    // Piel verde podrida
    ctx.fillStyle = '#42543c';
    ctx.fillRect(0, 0, 128, 128);
    // Sombras inferiores
    ctx.fillStyle = '#2c3828';
    ctx.fillRect(0, 80, 128, 48);
    // Ojos rojos brillantes
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(18, 30, 22, 16);
    ctx.fillRect(88, 30, 22, 16);
    // Pupilas amarillas
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(25, 35, 8, 6);
    ctx.fillRect(95, 35, 8, 6);
    // Boca abierta gritando
    ctx.fillStyle = '#150303';
    ctx.fillRect(30, 75, 68, 35);
    // Dientes podridos
    ctx.fillStyle = '#dfcf9f';
    ctx.beginPath();
    ctx.moveTo(35, 75);
    ctx.lineTo(41, 86);
    ctx.lineTo(47, 75);
    ctx.moveTo(77, 75);
    ctx.lineTo(83, 86);
    ctx.lineTo(89, 75);
    ctx.moveTo(55, 110);
    ctx.lineTo(61, 99);
    ctx.lineTo(67, 110);
    ctx.fill();
    // Sangre chorreando de la boca
    ctx.fillStyle = '#7a0000';
    ctx.fillRect(38, 100, 5, 18);
    ctx.fillRect(63, 105, 8, 20);
    ctx.fillRect(80, 100, 6, 12);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}
// --- TEXTURAS ADICIONALES PARA TEMÁTICAS DE NIVELES ---
// 1. SELVA (NIVEL 2)
export function generateJungleWallTexture() {
    const canvas = document.createElement('canvas');
    const S = 1024;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    // Dark jungle base
    const baseGrad = ctx.createLinearGradient(0, 0, 0, S);
    baseGrad.addColorStop(0, '#0e1a0a');
    baseGrad.addColorStop(0.5, '#152210');
    baseGrad.addColorStop(1, '#0a1208');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, S, S);
    // Fast noise overlay using random rects
    for (let i = 0; i < 5000; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const sz = 2 + Math.random() * 4;
        const c = 10 + Math.random() * 20;
        ctx.fillStyle = `rgba(${c},${c + 15},${c},0.15)`;
        ctx.fillRect(x, y, sz, sz);
    }
    // Large tree trunks with bark texture
    const trunks = [
        { x: 200, w: 120 },
        { x: 550, w: 100 },
        { x: 850, w: 90 },
    ];
    trunks.forEach(trunk => {
        // Bark base
        const barkGrad = ctx.createLinearGradient(trunk.x - trunk.w / 2, 0, trunk.x + trunk.w / 2, 0);
        barkGrad.addColorStop(0, '#1a1208');
        barkGrad.addColorStop(0.2, '#2e2010');
        barkGrad.addColorStop(0.4, '#3a2a14');
        barkGrad.addColorStop(0.6, '#342618');
        barkGrad.addColorStop(0.8, '#281c0e');
        barkGrad.addColorStop(1, '#1a1208');
        ctx.fillStyle = barkGrad;
        // Slightly wavy trunk
        ctx.beginPath();
        ctx.moveTo(trunk.x - trunk.w / 2, 0);
        for (let y = 0; y <= S; y += 50) {
            const wobble = Math.sin(y * 0.015) * 8;
            ctx.lineTo(trunk.x - trunk.w / 2 + wobble, y);
        }
        for (let y = S; y >= 0; y -= 50) {
            const wobble = Math.sin(y * 0.018 + 2) * 6;
            ctx.lineTo(trunk.x + trunk.w / 2 + wobble, y);
        }
        ctx.closePath();
        ctx.fill();
        // Bark lines
        ctx.strokeStyle = 'rgba(10,8,4,0.5)';
        for (let bl = 0; bl < 5; bl++) {
            const bx = trunk.x - trunk.w / 2 + 10 + bl * (trunk.w / 5);
            ctx.lineWidth = 2 + Math.random() * 2;
            ctx.beginPath();
            ctx.moveTo(bx, 0);
            for (let y = 0; y <= S; y += 40) {
                ctx.lineTo(bx + (Math.random() - 0.5) * 6, y);
            }
            ctx.stroke();
        }
        // Moss patches on trunk
        for (let ms = 0; ms < 6; ms++) {
            const mx = trunk.x - trunk.w / 3 + Math.random() * (trunk.w * 0.6);
            const my = Math.random() * S;
            const mr = 10 + Math.random() * 20;
            ctx.fillStyle = 'rgba(30,70,20,0.4)';
            ctx.beginPath();
            ctx.ellipse(mx, my, mr, mr * 0.6, Math.random() * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    // Vines hanging and wrapping
    ctx.lineCap = 'round';
    for (let v = 0; v < 12; v++) {
        const vx = Math.random() * S;
        ctx.strokeStyle = `rgba(${15 + Math.random() * 20},${30 + Math.random() * 40},${10 + Math.random() * 15},0.7)`;
        ctx.lineWidth = 3 + Math.random() * 4;
        ctx.beginPath();
        ctx.moveTo(vx, 0);
        let cvx = vx;
        for (let y = 0; y <= S; y += 30) {
            cvx += Math.sin(y * 0.03 + v) * 8;
            ctx.lineTo(cvx, y);
        }
        ctx.stroke();
    }
    // Large tropical leaves
    for (let tl = 0; tl < 8; tl++) {
        const tlx = tl < 4 ? -20 + Math.random() * 60 : S - 40 + Math.random() * 60;
        const tly = 50 + tl * 120 + Math.random() * 40;
        const tlAngle = tl < 4 ? 0.3 + Math.random() * 0.5 : Math.PI - 0.3 - Math.random() * 0.5;
        const tlLen = 80 + Math.random() * 100;
        const tlWidth = 25 + Math.random() * 20;
        ctx.save();
        ctx.translate(tlx, tly);
        ctx.rotate(tlAngle);
        ctx.fillStyle = `rgba(${25 + Math.random() * 20},${55 + Math.random() * 30},${15},0.6)`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(tlLen * 0.3, -tlWidth, tlLen * 0.7, -tlWidth * 0.8, tlLen, 0);
        ctx.bezierCurveTo(tlLen * 0.7, tlWidth * 0.8, tlLen * 0.3, tlWidth, 0, 0);
        ctx.fill();
        // Leaf center vein
        ctx.strokeStyle = 'rgba(20,40,10,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tlLen, 0);
        ctx.stroke();
        ctx.restore();
    }
    // Ferns at the bottom
    for (let fn = 0; fn < 6; fn++) {
        const fx = 50 + fn * 170 + Math.random() * 60;
        const fy = S - 30;
        ctx.save();
        ctx.translate(fx, fy);
        for (let fb = 0; fb < 7; fb++) {
            const fAngle = -Math.PI / 2 + (fb - 3) * 0.25 + Math.random() * 0.1;
            const fLen = 60 + Math.random() * 50;
            ctx.strokeStyle = `rgba(${20 + Math.random() * 15},${45 + Math.random() * 25},${12},0.6)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            for (let ft = 0; ft < fLen; ft += 15) {
                ctx.lineTo(Math.cos(fAngle) * ft, Math.sin(fAngle) * ft);
            }
            ctx.stroke();
            // Fern leaflets
            ctx.fillStyle = `rgba(${22 + Math.random() * 15},${50 + Math.random() * 20},${14},0.45)`;
            for (let fl = 10; fl < fLen - 10; fl += 15) {
                const flx = Math.cos(fAngle) * fl;
                const fly = Math.sin(fAngle) * fl;
                ctx.beginPath();
                ctx.ellipse(flx + 4, fly, 6, 2.5, fAngle + 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(flx - 4, fly, 6, 2.5, fAngle - 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
export function generateJungleFloorTexture() {
    const canvas = document.createElement('canvas');
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    // Dark wet soil base
    ctx.fillStyle = '#1a140c';
    ctx.fillRect(0, 0, S, S);
    // Fast noise overlay
    for (let i = 0; i < 4000; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const sz = 1 + Math.random() * 3;
        const c = Math.floor(Math.random() * 15);
        ctx.fillStyle = `rgba(${15 + c},${10 + c},${5 + c},0.3)`;
        ctx.fillRect(x, y, sz, sz);
    }
    // Tangled roots
    ctx.lineCap = 'round';
    for (let r = 0; r < 10; r++) {
        const rx = Math.random() * S;
        const ry = Math.random() * S;
        const rootLen = 80 + Math.random() * 150;
        const rootAngle = Math.random() * Math.PI * 2;
        ctx.strokeStyle = 'rgba(45,30,15,0.7)';
        ctx.lineWidth = 3 + Math.random() * 5;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        let crx = rx, cry = ry;
        for (let rs = 0; rs < 6; rs++) {
            crx += Math.cos(rootAngle + (Math.random() - 0.5) * 0.6) * (rootLen / 6);
            cry += Math.sin(rootAngle + (Math.random() - 0.5) * 0.6) * (rootLen / 6);
            ctx.lineTo(crx, cry);
        }
        ctx.stroke();
    }
    // Fallen leaves
    for (let fl = 0; fl < 30; fl++) {
        const lx = Math.random() * S;
        const ly = Math.random() * S;
        const lAngle = Math.random() * Math.PI * 2;
        const lSize = 8 + Math.random() * 16;
        const decay = Math.random();
        let lr, lg, lb, la;
        if (decay < 0.3) {
            lr = 30 + Math.random() * 20;
            lg = 50 + Math.random() * 30;
            lb = 15 + Math.random() * 10;
            la = 0.5;
        }
        else if (decay < 0.7) {
            lr = 80 + Math.random() * 40;
            lg = 55 + Math.random() * 25;
            lb = 15 + Math.random() * 10;
            la = 0.5;
        }
        else {
            lr = 30 + Math.random() * 20;
            lg = 20 + Math.random() * 15;
            lb = 8 + Math.random() * 8;
            la = 0.4;
        }
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(lAngle);
        ctx.fillStyle = `rgba(${lr},${lg},${lb},${la})`;
        ctx.beginPath();
        ctx.ellipse(lSize / 2, 0, lSize / 2, lSize / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    // Small stones
    for (let st = 0; st < 15; st++) {
        const sx = Math.random() * S;
        const sy = Math.random() * S;
        const sr = 3 + Math.random() * 6;
        ctx.fillStyle = 'rgba(60,55,50,0.5)';
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
export function generateJungleCeilingTexture() {
    const canvas = document.createElement('canvas');
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    // Very dark canopy base
    ctx.fillStyle = '#050a04';
    ctx.fillRect(0, 0, S, S);
    // Fast noise
    for (let i = 0; i < 3000; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const sz = 2 + Math.random() * 4;
        const c = Math.floor(Math.random() * 20);
        ctx.fillStyle = `rgba(${5 + c},${15 + c},${5 + c},0.2)`;
        ctx.fillRect(x, y, sz, sz);
    }
    // Light beams piercing through gaps
    for (let lb = 0; lb < 4; lb++) {
        const lbx = 80 + lb * 130 + Math.random() * 40;
        const lby = 60 + Math.random() * 380;
        const lbr = 25 + Math.random() * 35;
        ctx.fillStyle = 'rgba(100,130,60,0.1)';
        ctx.beginPath();
        ctx.arc(lbx, lby, lbr, 0, Math.PI * 2);
        ctx.fill();
    }
    // Hanging vines
    for (let hv = 0; hv < 8; hv++) {
        const hvx = Math.random() * S;
        const hvLen = 40 + Math.random() * 120;
        ctx.strokeStyle = `rgba(${15 + Math.random() * 15},${30 + Math.random() * 20},${10},0.6)`;
        ctx.lineWidth = 2 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(hvx, 0);
        let chvx = hvx;
        for (let hy = 0; hy <= hvLen; hy += 15) {
            chvx += Math.sin(hy * 0.08 + hv) * 4;
            ctx.lineTo(chvx, hy);
        }
        ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
// 2. MONTAÑA (NIVEL 3)
export function generateMountainWallTexture() {
    const canvas = document.createElement('canvas');
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    // Bright icy base gradient
    const baseGrad = ctx.createLinearGradient(0, 0, 0, S);
    baseGrad.addColorStop(0, '#eaf2f8'); // Light snow top
    baseGrad.addColorStop(0.5, '#cce0f0'); // Ice middle
    baseGrad.addColorStop(1, '#99badd'); // Darker ice bottom
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, S, S);
    // Snow noise texture (Fast approximation)
    for (let i = 0; i < 8000; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const sz = 1 + Math.random() * 4;
        const c = 200 + Math.random() * 55;
        ctx.fillStyle = `rgba(${c},${c},${c},0.4)`;
        ctx.fillRect(x, y, sz, sz);
    }
    // Ice fissures/cracks (light blue/white)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    for (let cr = 0; cr < 15; cr++) {
        ctx.lineWidth = 1 + Math.random() * 3;
        ctx.beginPath();
        let cx = Math.random() * S;
        let cy = Math.random() * S;
        ctx.moveTo(cx, cy);
        const segments = 4 + Math.floor(Math.random() * 5);
        for (let s = 0; s < segments; s++) {
            cx += (Math.random() - 0.5) * 60;
            cy += Math.random() * 80; // Cracks go mostly down
            ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        // Dark blue shadow next to crack
        ctx.strokeStyle = 'rgba(100,140,180,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    }
    // Large snow patches clinging to the wall
    for (let sp = 0; sp < 10; sp++) {
        const spx = Math.random() * S;
        const spy = Math.random() * S;
        const spw = 100 + Math.random() * 200;
        const sph = 40 + Math.random() * 80;
        const sGrad = ctx.createRadialGradient(spx, spy, 0, spx, spy, spw / 2);
        sGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
        sGrad.addColorStop(0.5, 'rgba(230,240,250,0.6)');
        sGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.ellipse(spx, spy, spw / 2, sph / 2, Math.random() * 0.2, 0, Math.PI * 2);
        ctx.fill();
    }
    // Sharp icicles hanging
    ctx.fillStyle = 'rgba(200,230,255,0.8)';
    for (let ic = 0; ic < 12; ic++) {
        const icx = Math.random() * S;
        const icy = Math.random() * 100; // Start near top
        const icw = 10 + Math.random() * 20;
        const ich = 60 + Math.random() * 150;
        ctx.beginPath();
        ctx.moveTo(icx - icw / 2, 0);
        ctx.lineTo(icx + icw / 2, 0);
        ctx.lineTo(icx + icw * 0.1, ich * 0.7);
        ctx.lineTo(icx, ich);
        ctx.lineTo(icx - icw * 0.1, ich * 0.7);
        ctx.closePath();
        ctx.fill();
        // Icicle highlight
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(icx - icw * 0.1, 0);
        ctx.lineTo(icx, 0);
        ctx.lineTo(icx, ich * 0.9);
        ctx.closePath();
        ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
export function generateMountainFloorTexture() {
    const canvas = document.createElement('canvas');
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    // Deep snow base
    ctx.fillStyle = '#f0f5fa';
    ctx.fillRect(0, 0, S, S);
    // Snow noise (Fast approximation)
    for (let i = 0; i < 15000; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const sz = 1 + Math.random() * 3;
        const c = 200 + Math.random() * 55;
        ctx.fillStyle = `rgba(${c},${c},${c},0.6)`;
        ctx.fillRect(x, y, sz, sz);
    }
    // Footprints / Indentations in snow
    for (let fp = 0; fp < 20; fp++) {
        const fx = Math.random() * S;
        const fy = Math.random() * S;
        const fr = 15 + Math.random() * 20;
        const fGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
        fGrad.addColorStop(0, 'rgba(150,180,210,0.3)');
        fGrad.addColorStop(0.6, 'rgba(200,220,240,0.1)');
        fGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = fGrad;
        ctx.beginPath();
        ctx.ellipse(fx, fy, fr, fr * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    // Small rocks peeking through snow
    for (let r = 0; r < 30; r++) {
        const rx = Math.random() * S;
        const ry = Math.random() * S;
        const rSize = 3 + Math.random() * 8;
        ctx.fillStyle = '#4a5058';
        ctx.beginPath();
        ctx.arc(rx, ry, rSize, 0, Math.PI * 2);
        ctx.fill();
        // Snow on top of rock
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(rx, ry - rSize * 0.3, rSize * 0.8, 0, Math.PI);
        ctx.fill();
    }
    // Large snowdrifts (curves)
    ctx.strokeStyle = 'rgba(200,220,240,0.4)';
    ctx.lineWidth = 15;
    ctx.lineCap = 'round';
    for (let sd = 0; sd < 5; sd++) {
        ctx.beginPath();
        let sdx = Math.random() * S;
        let sdy = Math.random() * S;
        ctx.moveTo(sdx, sdy);
        ctx.bezierCurveTo(sdx + 100, sdy + 50, sdx + 200, sdy - 50, sdx + 300, sdy + 20);
        ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
export function generateMountainCeilingTexture() {
    const canvas = document.createElement('canvas');
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    // Frosty sky base
    const skyGrad = ctx.createLinearGradient(0, 0, 0, S);
    skyGrad.addColorStop(0, '#dbe5f0');
    skyGrad.addColorStop(1, '#b0c4de');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, S, S);
    // Thick snow clouds
    for (let c = 0; c < 15; c++) {
        const cx = Math.random() * S;
        const cy = Math.random() * S;
        const cr = 80 + Math.random() * 100;
        const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
        cGrad.addColorStop(0, 'rgba(255,255,255,0.8)');
        cGrad.addColorStop(0.5, 'rgba(240,248,255,0.4)');
        cGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cr, cr * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    // Snowflakes falling (dots)
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let sf = 0; sf < 200; sf++) {
        const sfx = Math.random() * S;
        const sfy = Math.random() * S;
        const sfr = 1 + Math.random() * 2;
        ctx.beginPath();
        ctx.arc(sfx, sfy, sfr, 0, Math.PI * 2);
        ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
export function generateInfernalWallTexture() {
    const canvas = document.createElement('canvas');
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    // Base gradient: dark gray to very dark red
    const baseGrad = ctx.createLinearGradient(0, 0, 0, S);
    baseGrad.addColorStop(0, '#1a1010');
    baseGrad.addColorStop(1, '#0d0505');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, S, S);
    // Noise texture: dark red/black speckles
    for (let i = 0; i < 8000; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const sz = 1 + Math.random() * 3;
        const v = Math.floor(Math.random() * 20);
        ctx.fillStyle = `rgba(${40 + v},${10 + v},${5 + v},0.5)`;
        ctx.fillRect(x, y, sz, sz);
    }
    // Lava cracks: 12 cracks going mostly downward
    for (let c = 0; c < 12; c++) {
        let cx = Math.random() * S;
        let cy = Math.random() * S * 0.3;
        const segments = 8 + Math.floor(Math.random() * 6);
        // Shadow crack (darker, offset)
        ctx.strokeStyle = 'rgba(80, 10, 0, 0.6)';
        ctx.lineWidth = 3 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(cx + 2, cy + 2);
        let scx = cx + 2, scy = cy + 2;
        for (let s = 0; s < segments; s++) {
            scx += (Math.random() - 0.5) * 40;
            scy += 20 + Math.random() * 30;
            ctx.lineTo(scx, scy);
        }
        ctx.stroke();
        // Main lava crack
        ctx.strokeStyle = 'rgba(255, 80, 0, 0.8)';
        ctx.lineWidth = 1.5 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let s = 0; s < segments; s++) {
            cx += (Math.random() - 0.5) * 40;
            cy += 20 + Math.random() * 30;
            ctx.lineTo(cx, cy);
        }
        ctx.stroke();
    }
    // Glowing lava patches: 8 radial gradients
    for (let p = 0; p < 8; p++) {
        const px = Math.random() * S;
        const py = Math.random() * S;
        const pr = 20 + Math.random() * 40;
        const pGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
        pGrad.addColorStop(0, 'rgba(255, 100, 0, 0.7)');
        pGrad.addColorStop(0.5, 'rgba(200, 50, 0, 0.3)');
        pGrad.addColorStop(1, 'rgba(100, 20, 0, 0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
    }
    // Rock formations: dark irregular shapes for depth
    for (let r = 0; r < 10; r++) {
        const rx = Math.random() * S;
        const ry = Math.random() * S;
        const rw = 30 + Math.random() * 60;
        const rh = 20 + Math.random() * 40;
        ctx.fillStyle = `rgba(${5 + Math.floor(Math.random() * 10)},${2 + Math.floor(Math.random() * 5)},${Math.floor(Math.random() * 3)},0.6)`;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + rw * 0.3, ry - rh * 0.5);
        ctx.lineTo(rx + rw * 0.6, ry - rh * 0.3);
        ctx.lineTo(rx + rw, ry + rh * 0.2);
        ctx.lineTo(rx + rw * 0.8, ry + rh);
        ctx.lineTo(rx + rw * 0.2, ry + rh * 0.8);
        ctx.closePath();
        ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
export function generateInfernalFloorTexture() {
    const canvas = document.createElement('canvas');
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    // Base: very dark charcoal
    ctx.fillStyle = '#0a0606';
    ctx.fillRect(0, 0, S, S);
    // Noise: dark gray/red speckles
    for (let i = 0; i < 8000; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const sz = 1 + Math.random() * 3;
        const v = Math.floor(Math.random() * 15);
        ctx.fillStyle = `rgba(${20 + v},${8 + v},${5 + v},0.5)`;
        ctx.fillRect(x, y, sz, sz);
    }
    // Cracks: network of glowing orange/red lava veins (18 cracks)
    for (let c = 0; c < 18; c++) {
        let cx = Math.random() * S;
        let cy = Math.random() * S;
        const segments = 6 + Math.floor(Math.random() * 8);
        const angle = Math.random() * Math.PI * 2;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        // Glow under crack
        ctx.strokeStyle = 'rgba(200, 60, 0, 0.25)';
        ctx.lineWidth = 6 + Math.random() * 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        let gcx = cx, gcy = cy;
        for (let s = 0; s < segments; s++) {
            gcx += dx * (15 + Math.random() * 25) + (Math.random() - 0.5) * 20;
            gcy += dy * (15 + Math.random() * 25) + (Math.random() - 0.5) * 20;
            ctx.lineTo(gcx, gcy);
        }
        ctx.stroke();
        // Main crack line
        ctx.strokeStyle = `rgba(255, ${60 + Math.floor(Math.random() * 40)}, 0, 0.8)`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        let mcx = cx, mcy = cy;
        for (let s = 0; s < segments; s++) {
            mcx += dx * (15 + Math.random() * 25) + (Math.random() - 0.5) * 20;
            mcy += dy * (15 + Math.random() * 25) + (Math.random() - 0.5) * 20;
            ctx.lineTo(mcx, mcy);
        }
        ctx.stroke();
    }
    // Ember spots: small bright orange/yellow dots
    for (let e = 0; e < 60; e++) {
        const ex = Math.random() * S;
        const ey = Math.random() * S;
        const er = 1 + Math.random() * 3;
        const eGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, er * 3);
        eGrad.addColorStop(0, `rgba(255, ${200 + Math.floor(Math.random() * 55)}, 0, 0.9)`);
        eGrad.addColorStop(0.4, 'rgba(255, 120, 0, 0.4)');
        eGrad.addColorStop(1, 'rgba(150, 30, 0, 0)');
        ctx.fillStyle = eGrad;
        ctx.beginPath();
        ctx.arc(ex, ey, er * 3, 0, Math.PI * 2);
        ctx.fill();
        // Bright core
        ctx.fillStyle = 'rgba(255, 255, 150, 0.9)';
        ctx.beginPath();
        ctx.arc(ex, ey, er * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
export function generateInfernalCeilingTexture() {
    const canvas = document.createElement('canvas');
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    // Base gradient: dark red to black
    const baseGrad = ctx.createLinearGradient(0, 0, 0, S);
    baseGrad.addColorStop(0, '#1a0505');
    baseGrad.addColorStop(1, '#050000');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, S, S);
    // Smoke clouds: large semi-transparent dark patches
    for (let c = 0; c < 12; c++) {
        const cx = Math.random() * S;
        const cy = Math.random() * S;
        const cr = 60 + Math.random() * 100;
        const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
        cGrad.addColorStop(0, `rgba(${15 + Math.floor(Math.random() * 10)}, 0, 0, 0.5)`);
        cGrad.addColorStop(0.5, `rgba(${5 + Math.floor(Math.random() * 8)}, 0, 0, 0.25)`);
        cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cr, cr * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    // Red glow patches: subtle red glowing areas like distant flames
    for (let g = 0; g < 8; g++) {
        const gx = Math.random() * S;
        const gy = Math.random() * S;
        const gr = 40 + Math.random() * 80;
        const gGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        gGrad.addColorStop(0, 'rgba(120, 20, 0, 0.35)');
        gGrad.addColorStop(0.5, 'rgba(80, 10, 0, 0.15)');
        gGrad.addColorStop(1, 'rgba(40, 0, 0, 0)');
        ctx.fillStyle = gGrad;
        ctx.beginPath();
        ctx.arc(gx, gy, gr, 0, Math.PI * 2);
        ctx.fill();
    }
    // Ember particles: tiny bright orange dots floating upward
    for (let e = 0; e < 100; e++) {
        const ex = Math.random() * S;
        const ey = Math.random() * S;
        const er = 0.5 + Math.random() * 2;
        const eGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, er * 2.5);
        eGrad.addColorStop(0, `rgba(255, ${150 + Math.floor(Math.random() * 105)}, 0, 0.9)`);
        eGrad.addColorStop(0.5, 'rgba(255, 80, 0, 0.3)');
        eGrad.addColorStop(1, 'rgba(200, 30, 0, 0)');
        ctx.fillStyle = eGrad;
        ctx.beginPath();
        ctx.arc(ex, ey, er * 2.5, 0, Math.PI * 2);
        ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

export function generateBarkTexture() {
    const canvas = document.createElement('canvas');
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // Base wood color
    ctx.fillStyle = '#4a3018';
    ctx.fillRect(0, 0, S, S);

    // Vertical bark grooves
    for (let i = 0; i < 600; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const w = 1 + Math.random() * 3;
        const h = 20 + Math.random() * 80;

        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(30, 15, 5, 0.4)' : 'rgba(90, 60, 30, 0.3)';
        ctx.fillRect(x, y, w, h);
    }

    // Horizontal noise
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
        ctx.fillRect(x, y, 2, 1);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

export function generateLeafTexture() {
    const canvas = document.createElement('canvas');
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // Base dark green
    ctx.fillStyle = '#0f2910';
    ctx.fillRect(0, 0, S, S);

    // Leaf blotches
    for (let i = 0; i < 1500; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const r = 5 + Math.random() * 15;

        const g = 30 + Math.floor(Math.random() * 60);
        ctx.fillStyle = `rgba(10, ${g}, 15, 0.6)`;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// --- PBR MAP GENERATORS ---

export function createNormalMapFromCanvas(baseTexture, strength = 3.0) {
    const sourceCanvas = baseTexture.image;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const sCtx = sourceCanvas.getContext('2d');
    const srcData = sCtx.getImageData(0, 0, width, height);
    const destData = ctx.createImageData(width, height);

    // Sobel filter
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const getLum = (nx, ny) => {
                if (nx < 0) nx = 0; else if (nx >= width) nx = width - 1;
                if (ny < 0) ny = 0; else if (ny >= height) ny = height - 1;
                const i = (ny * width + nx) * 4;
                return (srcData.data[i] * 0.299 + srcData.data[i+1] * 0.587 + srcData.data[i+2] * 0.114) / 255.0;
            };

            const tl = getLum(x-1, y-1);
            const l  = getLum(x-1, y);
            const bl = getLum(x-1, y+1);
            const t  = getLum(x, y-1);
            const b  = getLum(x, y+1);
            const tr = getLum(x+1, y-1);
            const r  = getLum(x+1, y);
            const br = getLum(x+1, y+1);

            const dx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
            const dy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);

            const nx = -dx * strength;
            const ny = -dy * strength;
            const nz = 1.0;

            const len = Math.sqrt(nx*nx + ny*ny + nz*nz);

            const i = (y * width + x) * 4;
            destData.data[i]   = Math.floor((nx/len * 0.5 + 0.5) * 255);
            destData.data[i+1] = Math.floor((ny/len * 0.5 + 0.5) * 255);
            destData.data[i+2] = Math.floor((nz/len * 0.5 + 0.5) * 255);
            destData.data[i+3] = 255;
        }
    }

    ctx.putImageData(destData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

export function createRoughnessMapFromCanvas(baseTexture, contrast = 1.2, brightness = 0.1) {
    const sourceCanvas = baseTexture.image;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const sCtx = sourceCanvas.getContext('2d');
    const srcData = sCtx.getImageData(0, 0, width, height);
    const destData = ctx.createImageData(width, height);

    for (let i = 0; i < srcData.data.length; i += 4) {
        let lum = (srcData.data[i] * 0.299 + srcData.data[i+1] * 0.587 + srcData.data[i+2] * 0.114) / 255.0;
        let roughness = 1.0 - lum;
        roughness = (roughness - 0.5) * contrast + 0.5 + brightness;
        roughness = Math.max(0, Math.min(1, roughness));

        const val = Math.floor(roughness * 255);
        destData.data[i] = val;
        destData.data[i+1] = val;
        destData.data[i+2] = val;
        destData.data[i+3] = 255;
    }

    ctx.putImageData(destData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
