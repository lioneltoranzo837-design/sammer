import {
    BLOOD_MESSAGE_FONT_FAMILY,
    BLOOD_MESSAGE_FONT_URL,
    BLOOD_WALL_MESSAGES,
    GRID_SIZE,
    MAP,
    WALL_HEIGHT,
    getMapForLevel
} from '../config/gameConfig.js';

const { THREE } = window;
let bloodMessageFontLoaded = false;

// --- Procedural noise helpers ---
function _seededRand(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
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
    const S = 1024;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // ---- TYPE 0: Industrial metal panels ----
    if (type === 0 || type === 1 || type === 2) {
        // Base gradient: slight vertical darkening toward bottom
        const baseGrad = ctx.createLinearGradient(0, 0, 0, S);
        baseGrad.addColorStop(0, '#2e3238');
        baseGrad.addColorStop(0.5, '#24272d');
        baseGrad.addColorStop(1, '#1a1d22');
        ctx.fillStyle = baseGrad;
        ctx.fillRect(0, 0, S, S);

        // Multi-octave noise for metal grain (Fast approximation)
        for (let i = 0; i < 6000; i++) {
            const x = Math.random() * S;
            const y = Math.random() * S;
            const sz = 1 + Math.random() * 4;
            const c = 20 + Math.random() * 30;
            ctx.fillStyle = `rgba(${c},${c},${c},0.1)`;
            ctx.fillRect(x, y, sz, sz);
        }

        // Panel grid: 2x2 panels
        const panelInset = 12;
        const halfS = S / 2;
        const panels = [
            [panelInset, panelInset, halfS - panelInset * 2, halfS - panelInset * 2],
            [halfS + panelInset, panelInset, halfS - panelInset * 2, halfS - panelInset * 2],
            [panelInset, halfS + panelInset, halfS - panelInset * 2, halfS - panelInset * 2],
            [halfS + panelInset, halfS + panelInset, halfS - panelInset * 2, halfS - panelInset * 2]
        ];

        // Deep grooves between panels
        ctx.fillStyle = '#0a0c0f';
        ctx.fillRect(halfS - 6, 0, 12, S);
        ctx.fillRect(0, halfS - 6, S, 12);

        // Inner panel bevels (3D effect)
        panels.forEach(([px, py, pw, ph]) => {
            // Top-left highlight
            ctx.strokeStyle = 'rgba(80,85,95,0.45)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(px, py + ph);
            ctx.lineTo(px, py);
            ctx.lineTo(px + pw, py);
            ctx.stroke();
            // Bottom-right shadow
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.moveTo(px + pw, py);
            ctx.lineTo(px + pw, py + ph);
            ctx.lineTo(px, py + ph);
            ctx.stroke();
        });

        // Rivets along panel edges
        const rivetPositions = [];
        const rStep = 100;
        for (let ry = panelInset + 30; ry < S - panelInset; ry += rStep) {
            rivetPositions.push([panelInset + 20, ry]);
            rivetPositions.push([halfS - panelInset - 14, ry]);
            rivetPositions.push([halfS + panelInset + 20, ry]);
            rivetPositions.push([S - panelInset - 14, ry]);
        }
        for (let rx = panelInset + 30; rx < S - panelInset; rx += rStep) {
            rivetPositions.push([rx, panelInset + 20]);
            rivetPositions.push([rx, halfS - panelInset - 14]);
            rivetPositions.push([rx, halfS + panelInset + 20]);
            rivetPositions.push([rx, S - panelInset - 14]);
        }
        rivetPositions.forEach(([rx, ry]) => _drawRivet(ctx, rx, ry, 7));

        // Horizontal pipe conduit across upper third
        const pipeY = 180;
        const pipeH = 36;
        const pipeGrad = ctx.createLinearGradient(0, pipeY, 0, pipeY + pipeH);
        pipeGrad.addColorStop(0, '#4a4e56');
        pipeGrad.addColorStop(0.3, '#606570');
        pipeGrad.addColorStop(0.5, '#555960');
        pipeGrad.addColorStop(0.7, '#3a3e44');
        pipeGrad.addColorStop(1, '#22252a');
        ctx.fillStyle = pipeGrad;
        ctx.fillRect(0, pipeY, S, pipeH);
        // Pipe brackets
        for (let bx = 80; bx < S; bx += 250) {
            ctx.fillStyle = '#2a2d32';
            ctx.fillRect(bx, pipeY - 8, 30, pipeH + 16);
            ctx.strokeStyle = '#1a1c20';
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, pipeY - 8, 30, pipeH + 16);
            _drawRivet(ctx, bx + 15, pipeY - 4, 4);
            _drawRivet(ctx, bx + 15, pipeY + pipeH + 4, 4);
        }
        // Pipe highlight
        ctx.strokeStyle = 'rgba(120,125,135,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, pipeY + 6);
        ctx.lineTo(S, pipeY + 6);
        ctx.stroke();

        // Small ventilation grille in bottom-right panel
        const ventX = halfS + 100, ventY = halfS + 120, ventW = 200, ventH = 120;
        ctx.fillStyle = '#0e1014';
        ctx.fillRect(ventX, ventY, ventW, ventH);
        ctx.strokeStyle = '#2a2d32';
        ctx.lineWidth = 3;
        ctx.strokeRect(ventX, ventY, ventW, ventH);
        for (let vy = ventY + 12; vy < ventY + ventH - 8; vy += 14) {
            const slg = ctx.createLinearGradient(0, vy, 0, vy + 8);
            slg.addColorStop(0, '#1e2126');
            slg.addColorStop(0.5, '#0a0c0f');
            slg.addColorStop(1, '#151719');
            ctx.fillStyle = slg;
            ctx.fillRect(ventX + 8, vy, ventW - 16, 8);
        }
        // Vent screws
        _drawRivet(ctx, ventX + 10, ventY + 10, 5);
        _drawRivet(ctx, ventX + ventW - 10, ventY + 10, 5);
        _drawRivet(ctx, ventX + 10, ventY + ventH - 10, 5);
        _drawRivet(ctx, ventX + ventW - 10, ventY + ventH - 10, 5);

        // Rust streaks
        ctx.globalCompositeOperation = 'multiply';
        for (let rs = 0; rs < 8; rs++) {
            const rx = 50 + Math.sin(rs * 2.7) * 350 + 200;
            const ry = 50 + rs * 95;
            const rLen = 80 + Math.sin(rs * 1.3) * 60;
            const rGrad = ctx.createLinearGradient(rx, ry, rx + 15, ry + rLen);
            rGrad.addColorStop(0, 'rgba(120,60,20,0.08)');
            rGrad.addColorStop(0.3, 'rgba(100,45,15,0.18)');
            rGrad.addColorStop(0.7, 'rgba(80,35,10,0.12)');
            rGrad.addColorStop(1, 'rgba(60,25,5,0.03)');
            ctx.fillStyle = rGrad;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.bezierCurveTo(rx + 8, ry + rLen * 0.3, rx - 5, ry + rLen * 0.6, rx + 3, ry + rLen);
            ctx.bezierCurveTo(rx + 20, ry + rLen * 0.7, rx + 25, ry + rLen * 0.3, rx + 18, ry);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        // Scratch marks
        ctx.strokeStyle = 'rgba(60,64,72,0.3)';
        ctx.lineWidth = 1;
        for (let sc = 0; sc < 12; sc++) {
            const sx = Math.random() * S;
            const sy = Math.random() * S;
            const sl = 20 + Math.random() * 60;
            const sa = Math.random() * Math.PI;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(sa) * sl, sy + Math.sin(sa) * sl);
            ctx.stroke();
        }

        // Industrial stencil markings in upper-left panel
        ctx.save();
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = 'rgba(80,85,90,0.25)';
        ctx.fillText('SEC-7B', 60, 100);
        ctx.font = '18px monospace';
        ctx.fillText('DANGER - HIGH VOLTAGE', 50, 460);
        ctx.restore();

        // Corrosion spots
        for (let cs = 0; cs < 6; cs++) {
            const cx = Math.random() * S;
            const cy = Math.random() * S;
            const cr = 8 + Math.random() * 18;
            const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
            cg.addColorStop(0, 'rgba(70,50,25,0.2)');
            cg.addColorStop(0.6, 'rgba(50,35,15,0.1)');
            cg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
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
        ctx.moveTo(0, bandTop); ctx.lineTo(S, bandTop);
        ctx.moveTo(0, bandBot); ctx.lineTo(S, bandBot);
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
    } else if (type === 2) {
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
                ctx.bezierCurveTo(
                    dx - dw / 2 + 2, dy + dLen * 0.3,
                    midX - dw / 2 - 3, dy + dLen * 0.7,
                    midX - 2, dy + dLen
                );
                ctx.lineTo(midX + 2, dy + dLen);
                ctx.bezierCurveTo(
                    midX + dw / 2 + 3, dy + dLen * 0.7,
                    dx + dw / 2 - 2, dy + dLen * 0.3,
                    dx + dw / 2, dy
                );
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

    } else if (type === 3) {
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
            if(c < 0) {
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

    } else if (type === 4) {
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
            ctx.moveTo(px, py + ph); ctx.lineTo(px, py); ctx.lineTo(px + pw, py);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.moveTo(px + pw, py); ctx.lineTo(px + pw, py + ph); ctx.lineTo(px, py + ph);
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
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // Base concrete color
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(0, 0, S, S);

    // FBM concrete noise (Fast approximation)
    for (let i = 0; i < 4000; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const sz = 1 + Math.random() * 3;
        const c = 30 + Math.random() * 30;
        ctx.fillStyle = `rgba(${c},${c},${c},0.15)`;
        ctx.fillRect(x, y, sz, sz);
    }

    // Tile grid lines (4x4 grid)
    const tileSize = S / 4;
    ctx.strokeStyle = '#0e1014';
    ctx.lineWidth = 4;
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
    // Highlight edge on grid
    ctx.strokeStyle = 'rgba(50,54,62,0.3)';
    ctx.lineWidth = 1;
    for (let gx = tileSize; gx < S; gx += tileSize) {
        ctx.beginPath();
        ctx.moveTo(gx + 3, 0);
        ctx.lineTo(gx + 3, S);
        ctx.stroke();
    }
    for (let gy = tileSize; gy < S; gy += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy + 3);
        ctx.lineTo(S, gy + 3);
        ctx.stroke();
    }

    // Grime in corners of tiles
    for (let tx = 0; tx < 4; tx++) {
        for (let ty = 0; ty < 4; ty++) {
            const corners = [
                [tx * tileSize, ty * tileSize],
                [(tx + 1) * tileSize, ty * tileSize],
                [tx * tileSize, (ty + 1) * tileSize],
                [(tx + 1) * tileSize, (ty + 1) * tileSize]
            ];
            corners.forEach(([cx, cy]) => {
                const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20 + Math.random() * 15);
                gr.addColorStop(0, 'rgba(10,12,14,0.35)');
                gr.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = gr;
                ctx.beginPath();
                ctx.arc(cx, cy, 35, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }

    // Dirty water puddle
    const pudX = 280, pudY = 320;
    const pudGrad = ctx.createRadialGradient(pudX, pudY, 0, pudX, pudY, 55);
    pudGrad.addColorStop(0, 'rgba(18,22,30,0.5)');
    pudGrad.addColorStop(0.5, 'rgba(15,18,25,0.35)');
    pudGrad.addColorStop(0.8, 'rgba(12,14,18,0.15)');
    pudGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pudGrad;
    ctx.beginPath();
    ctx.ellipse(pudX, pudY, 55, 35, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Puddle reflection highlight
    ctx.fillStyle = 'rgba(40,50,70,0.15)';
    ctx.beginPath();
    ctx.ellipse(pudX - 10, pudY - 8, 18, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Drainage grate
    const grateX = 80, grateY = 100, grateW = 50, grateH = 50;
    ctx.fillStyle = '#0a0c0e';
    ctx.fillRect(grateX, grateY, grateW, grateH);
    ctx.strokeStyle = '#2a2d33';
    ctx.lineWidth = 2;
    ctx.strokeRect(grateX, grateY, grateW, grateH);
    for (let gs = grateX + 8; gs < grateX + grateW - 4; gs += 8) {
        ctx.fillStyle = '#1a1c20';
        ctx.fillRect(gs, grateY + 4, 3, grateH - 8);
    }
    for (let gs = grateY + 8; gs < grateY + grateH - 4; gs += 8) {
        ctx.fillStyle = '#1a1c20';
        ctx.fillRect(grateX + 4, gs, grateW - 8, 2);
    }

    // Scuff marks
    ctx.strokeStyle = 'rgba(30,33,38,0.4)';
    ctx.lineWidth = 2;
    for (let sm = 0; sm < 8; sm++) {
        const sx = Math.random() * S;
        const sy = Math.random() * S;
        const sa = Math.random() * Math.PI * 2;
        const sl = 15 + Math.random() * 40;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(sa) * sl, sy + Math.sin(sa) * sl);
        ctx.stroke();
    }

    // Cracks
    ctx.strokeStyle = 'rgba(5,7,10,0.5)';
    ctx.lineWidth = 1.5;
    for (let c = 0; c < 5; c++) {
        ctx.beginPath();
        let cx = Math.random() * S;
        let cy = Math.random() * S;
        ctx.moveTo(cx, cy);
        for (let j = 0; j < 4; j++) {
            cx += (Math.random() - 0.5) * 50;
            cy += (Math.random() - 0.5) * 50;
            ctx.lineTo(cx, cy);
        }
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

export function generateCeilingTexture() {
    const canvas = document.createElement('canvas');
    const S = 512;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // Dark base
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, S, S);

    // FBM for surface texture (Fast approximation)
    for (let i = 0; i < 3000; i++) {
        const x = Math.random() * S;
        const y = Math.random() * S;
        const sz = 1 + Math.random() * 3;
        const c = 20 + Math.random() * 20;
        ctx.fillStyle = `rgba(${c},${c},${c},0.1)`;
        ctx.fillRect(x, y, sz, sz);
    }

    // Ceiling panel grid
    ctx.strokeStyle = '#1a1c22';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, S, S);
    ctx.strokeRect(0, 0, S / 2, S / 2);
    ctx.strokeRect(S / 2, 0, S / 2, S / 2);
    ctx.strokeRect(0, S / 2, S / 2, S / 2);
    ctx.strokeRect(S / 2, S / 2, S / 2, S / 2);

    // Large horizontal pipe
    const pipe1Y = 100, pipe1H = 45;
    const pGrad1 = ctx.createLinearGradient(0, pipe1Y, 0, pipe1Y + pipe1H);
    pGrad1.addColorStop(0, '#22252a');
    pGrad1.addColorStop(0.2, '#3a3e46');
    pGrad1.addColorStop(0.5, '#45484f');
    pGrad1.addColorStop(0.8, '#2e3238');
    pGrad1.addColorStop(1, '#1a1c20');
    ctx.fillStyle = pGrad1;
    ctx.fillRect(0, pipe1Y, S, pipe1H);
    // Pipe joints
    for (let pj = 60; pj < S; pj += 200) {
        ctx.fillStyle = '#2a2d33';
        ctx.fillRect(pj, pipe1Y - 5, 20, pipe1H + 10);
        ctx.strokeStyle = '#1a1c20';
        ctx.lineWidth = 1;
        ctx.strokeRect(pj, pipe1Y - 5, 20, pipe1H + 10);
    }

    // Smaller pipe perpendicular
    const pipe2X = 350, pipe2W = 28;
    const pGrad2 = ctx.createLinearGradient(pipe2X, 0, pipe2X + pipe2W, 0);
    pGrad2.addColorStop(0, '#1e2126');
    pGrad2.addColorStop(0.3, '#32363e');
    pGrad2.addColorStop(0.5, '#3a3e46');
    pGrad2.addColorStop(0.7, '#2a2d33');
    pGrad2.addColorStop(1, '#181a1e');
    ctx.fillStyle = pGrad2;
    ctx.fillRect(pipe2X, 0, pipe2W, S);

    // Cable tray (open mesh running along)
    const ctY = 300, ctH = 30;
    ctx.fillStyle = '#151719';
    ctx.fillRect(0, ctY, S, ctH);
    // Cable mesh pattern
    for (let cx = 5; cx < S; cx += 15) {
        ctx.strokeStyle = '#25282e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, ctY);
        ctx.lineTo(cx, ctY + ctH);
        ctx.stroke();
    }
    for (let cy = ctY + 5; cy < ctY + ctH; cy += 10) {
        ctx.strokeStyle = '#25282e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(S, cy);
        ctx.stroke();
    }
    // Cables inside
    const cableColors = ['#2a1515', '#15152a', '#152a15', '#2a2a15'];
    cableColors.forEach((cc, i) => {
        ctx.strokeStyle = cc;
        ctx.lineWidth = 4;
        ctx.beginPath();
        let cy = ctY + 8 + i * 6;
        ctx.moveTo(0, cy);
        for (let cx = 0; cx < S; cx += 30) {
            ctx.lineTo(cx, cy + Math.sin(cx * 0.03 + i) * 3);
        }
        ctx.stroke();
    });

    // Fluorescent light fixture (off/dim)
    const lightX = S / 2 - 80, lightY = S / 2 - 15, lightW = 160, lightH = 30;
    ctx.fillStyle = '#1e2025';
    ctx.fillRect(lightX - 5, lightY - 5, lightW + 10, lightH + 10);
    ctx.strokeStyle = '#2a2d33';
    ctx.lineWidth = 2;
    ctx.strokeRect(lightX - 5, lightY - 5, lightW + 10, lightH + 10);
    // Tube
    const tubeGrad = ctx.createLinearGradient(0, lightY, 0, lightY + lightH);
    tubeGrad.addColorStop(0, '#252830');
    tubeGrad.addColorStop(0.3, '#2e3240');
    tubeGrad.addColorStop(0.5, '#303545');
    tubeGrad.addColorStop(0.7, '#2e3240');
    tubeGrad.addColorStop(1, '#222530');
    ctx.fillStyle = tubeGrad;
    ctx.fillRect(lightX, lightY, lightW, lightH);
    // Very faint glow
    const glowGrad = ctx.createRadialGradient(lightX + lightW / 2, lightY + lightH / 2, 0, lightX + lightW / 2, lightY + lightH / 2, 100);
    glowGrad.addColorStop(0, 'rgba(60,70,100,0.08)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(lightX - 50, lightY - 50, lightW + 100, lightH + 100);

    // Ventilation duct (lower area)
    const ventX = 20, ventY = 420, ventW = 180, ventH = 60;
    ctx.fillStyle = '#151719';
    ctx.fillRect(ventX, ventY, ventW, ventH);
    ctx.strokeStyle = '#22252a';
    ctx.lineWidth = 2;
    ctx.strokeRect(ventX, ventY, ventW, ventH);
    // Vent slats
    for (let vs = ventY + 8; vs < ventY + ventH - 5; vs += 10) {
        const vsGrad = ctx.createLinearGradient(0, vs, 0, vs + 6);
        vsGrad.addColorStop(0, '#1e2025');
        vsGrad.addColorStop(0.5, '#0c0e12');
        vsGrad.addColorStop(1, '#151719');
        ctx.fillStyle = vsGrad;
        ctx.fillRect(ventX + 8, vs, ventW - 16, 6);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}


async function loadBloodMessageFont() {
    if (bloodMessageFontLoaded) return;

    try {
        const fontFace = new FontFace(BLOOD_MESSAGE_FONT_FAMILY, `url(${BLOOD_MESSAGE_FONT_URL})`);
        await fontFace.load();
        document.fonts.add(fontFace);
        bloodMessageFontLoaded = true;
    } catch (error) {
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
    } else if (placement.side === 'SOUTH') {
        plane.position.z += offset;
    } else if (placement.side === 'WEST') {
        plane.position.x -= offset;
        plane.rotation.y = -Math.PI / 2;
    } else if (placement.side === 'EAST') {
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
            if (map[z][x] !== 1) continue;
            sides.forEach((dir) => {
                if (isWalkableMessageCell(x + dir.dx, z + dir.dz, map)) {
                    candidates.push({ x, z, side: dir.side });
                }
            });
        }
    }

    if (candidates.length === 0) return [];

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
    ctx.moveTo(35, 75); ctx.lineTo(41, 86); ctx.lineTo(47, 75);
    ctx.moveTo(77, 75); ctx.lineTo(83, 86); ctx.lineTo(89, 75);
    ctx.moveTo(55, 110); ctx.lineTo(61, 99); ctx.lineTo(67, 110);
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
        ctx.fillStyle = `rgba(${c},${c+15},${c},0.15)`;
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
        ctx.fillStyle = `rgba(${15+c},${10+c},${5+c},0.3)`;
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
            lr = 30 + Math.random() * 20; lg = 50 + Math.random() * 30; lb = 15 + Math.random() * 10; la = 0.5;
        } else if (decay < 0.7) {
            lr = 80 + Math.random() * 40; lg = 55 + Math.random() * 25; lb = 15 + Math.random() * 10; la = 0.5;
        } else {
            lr = 30 + Math.random() * 20; lg = 20 + Math.random() * 15; lb = 8 + Math.random() * 8; la = 0.4;
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
        ctx.fillStyle = `rgba(${5+c},${15+c},${5+c},0.2)`;
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
    for(let sf = 0; sf < 200; sf++) {
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
