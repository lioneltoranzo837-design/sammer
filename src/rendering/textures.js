import {
    BLOOD_MESSAGE_FONT_FAMILY,
    BLOOD_MESSAGE_FONT_URL,
    BLOOD_WALL_MESSAGES,
    GRID_SIZE,
    MAP,
    WALL_HEIGHT
} from '../config/gameConfig.js';

const { THREE } = window;
let bloodMessageFontLoaded = false;

// --- TEXTURAS PROCEDIMENTALES EN CANVAS ---
export function generateWallTexture(type = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Color base gris industrial
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, 512, 512);
    
    // Suciedad y grano procedimental
    for (let i = 0; i < 4000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 2 + 1;
        const cVal = Math.floor(Math.random() * 30 - 15);
        ctx.fillStyle = `rgba(${34 + cVal}, ${37 + cVal}, ${42 + cVal}, 0.25)`;
        ctx.fillRect(x, y, size, size);
    }
    
    // Planchas de metal divisorias (secciones)
    ctx.strokeStyle = '#111316';
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, 502, 502);
    ctx.beginPath();
    ctx.moveTo(256, 0); ctx.lineTo(256, 512);
    ctx.moveTo(0, 256); ctx.lineTo(512, 256);
    ctx.stroke();
    
    // Bordes biselados 3D
    ctx.strokeStyle = '#3a3e47';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(7, 7); ctx.lineTo(505, 7);
    ctx.moveTo(7, 258); ctx.lineTo(505, 258);
    ctx.moveTo(7, 7); ctx.lineTo(7, 505);
    ctx.moveTo(258, 7); ctx.lineTo(258, 505);
    ctx.stroke();
    
    // Remaches de metal en las esquinas de los paneles
    ctx.fillStyle = '#101214';
    const rivets = [
        [20,20], [240,20], [272,20], [492,20],
        [20,240], [240,240], [272,240], [492,240],
        [20,272], [240,272], [272,272], [492,272],
        [20,492], [240,492], [272,492], [492,492]
    ];
    rivets.forEach(([rx, ry]) => {
        ctx.beginPath();
        ctx.arc(rx, ry, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#454a55';
        ctx.beginPath();
        ctx.arc(rx - 2, ry - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#101214';
    });

    if (type === 1) {
        // Franjas amarillas y negras de advertencia (Peligro/Hazard)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 360, 512, 90);
        ctx.clip();
        ctx.fillStyle = '#ffa500';
        ctx.fillRect(0, 360, 512, 90);
        
        ctx.fillStyle = '#151515';
        const stripe = 40;
        for (let k = -100; k < 600; k += stripe * 2) {
            ctx.beginPath();
            ctx.moveTo(k, 360);
            ctx.lineTo(k + stripe, 360);
            ctx.lineTo(k + stripe - 30, 450);
            ctx.lineTo(k - 30, 450);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 360); ctx.lineTo(512, 360);
        ctx.moveTo(0, 450); ctx.lineTo(512, 450);
        ctx.stroke();
    } else if (type === 2) {
        // Manchas de sangre terroríficas
        ctx.fillStyle = 'rgba(110, 0, 0, 0.75)';
        ctx.beginPath();
        ctx.arc(140, 160, 30, 0, Math.PI*2);
        ctx.arc(165, 190, 18, 0, Math.PI*2);
        ctx.arc(125, 200, 10, 0, Math.PI*2);
        ctx.fill();
        
        // Chorros de sangre goteando
        ctx.beginPath();
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(90, 0, 0, 0.75)';
        ctx.moveTo(140, 160); ctx.lineTo(140, 270);
        ctx.moveTo(165, 190); ctx.lineTo(165, 240);
        ctx.moveTo(125, 200); ctx.lineTo(125, 230);
        ctx.stroke();
        
        // Huella de mano ensangrentada
        ctx.fillStyle = 'rgba(85, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(360, 280, 18, 0, Math.PI*2);
        ctx.fill();
        for(let f=0; f<5; f++) {
            ctx.beginPath();
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(85, 0, 0, 0.8)';
            ctx.moveTo(350 + f*6, 275);
            ctx.lineTo(345 + f*7 + (f === 0 ? -12 : 0), 235 - (f === 2 ? 10 : 0));
            ctx.stroke();
        }
    } else if (type === 3) {
        // Compuerta metálica de salida
        ctx.fillStyle = '#2c2e35';
        ctx.fillRect(40, 40, 432, 432);
        ctx.strokeStyle = '#121417';
        ctx.lineWidth = 8;
        ctx.strokeRect(40, 40, 432, 432);
        
        // Cartelera de peligro central
        ctx.fillStyle = '#e59400';
        ctx.fillRect(166, 166, 180, 180);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(166, 166, 180, 180);
        
        // Dibujo de Biohazard
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(256, 256, 16, 0, Math.PI*2);
        ctx.fill();
        for (let angle = 0; angle < 3; angle++) {
            const a = (angle * Math.PI * 2) / 3 - Math.PI / 6;
            ctx.beginPath();
            ctx.arc(256 + Math.cos(a)*25, 256 + Math.sin(a)*25, 13, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#e59400';
            ctx.beginPath();
            ctx.arc(256 + Math.cos(a)*25, 256 + Math.sin(a)*25, 6, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#000';
        }
        
        // Panel electrónico
        ctx.fillStyle = '#151515';
        ctx.fillRect(60, 200, 40, 110);
        ctx.strokeStyle = '#444';
        ctx.strokeRect(60, 200, 40, 110);
        
        // LED de estado verde
        ctx.fillStyle = '#00ff41';
        ctx.beginPath();
        ctx.arc(80, 225, 6, 0, Math.PI*2);
        ctx.fill();
    } else if (type === 4) {
        // Compuerta normal interactiva
        ctx.fillStyle = '#2d3037';
        ctx.fillRect(0, 0, 512, 512);
        
        // Suciedad / grano
        for (let i = 0; i < 2500; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const size = Math.random() * 2 + 1;
            const cVal = Math.floor(Math.random() * 20 - 10);
            ctx.fillStyle = `rgba(${32 + cVal}, ${35 + cVal}, ${40 + cVal}, 0.25)`;
            ctx.fillRect(x, y, size, size);
        }
        
        // Bordes de chapa
        ctx.strokeStyle = '#111215';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, 502, 502);
        
        // Hendidura central divisoria (las dos hojas que deslizan)
        ctx.fillStyle = '#101113';
        ctx.fillRect(248, 0, 16, 512);
        
        // Panel izquierdo y derecho
        ctx.strokeStyle = '#1e2126';
        ctx.lineWidth = 5;
        ctx.strokeRect(15, 15, 223, 482);
        ctx.strokeRect(274, 15, 223, 482);
        
        // Indicadores direccionales chevron (<<< y >>>)
        ctx.fillStyle = '#ff9900';
        ctx.font = 'bold 36px monospace';
        ctx.fillText('<<<', 55, 266);
        ctx.fillText('>>>', 375, 266);
        
        // Lectores de tarjeta a los lados
        ctx.fillStyle = '#111';
        ctx.fillRect(90, 310, 60, 90);
        ctx.fillRect(360, 310, 60, 90);
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = 3;
        ctx.strokeRect(90, 310, 60, 90);
        ctx.strokeRect(360, 310, 60, 90);
        
        // LED indicador (Amarillo bloqueado)
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(120, 340, 6, 0, Math.PI * 2);
        ctx.arc(390, 340, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Instrucción visual de tecla E
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 22px "Share Tech Mono", monospace';
        ctx.fillText('[E]', 105, 385);
        ctx.fillText('[E]', 375, 385);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

export function generateFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#16171a';
    ctx.fillRect(0, 0, 256, 256);
    
    // Grano fino de concreto
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const size = Math.random() * 1.5 + 0.5;
        const cVal = Math.floor(Math.random() * 16 - 8);
        ctx.fillStyle = `rgba(${22 + cVal}, ${23 + cVal}, ${26 + cVal}, 0.2)`;
        ctx.fillRect(x, y, size, size);
    }
    
    // Líneas de baldosas
    ctx.strokeStyle = '#0a0a0c';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 256, 256);
    
    // Grietas sutiles
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 1;
    for(let c=0; c<3; c++) {
        ctx.beginPath();
        let cx = Math.random() * 200 + 28;
        let cy = Math.random() * 200 + 28;
        ctx.moveTo(cx, cy);
        for(let j=0; j<3; j++) {
            cx += Math.random() * 40 - 20;
            cy += Math.random() * 40 - 20;
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
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Rejilla metálica oscura
    ctx.fillStyle = '#060608';
    ctx.fillRect(0, 0, 256, 256);
    
    // Planchas
    ctx.fillStyle = '#18191e';
    const spacing = 16;
    for (let x = 8; x < 248; x += spacing) {
        ctx.fillRect(x, 8, 6, 240);
    }
    
    ctx.strokeStyle = '#25272e';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 248, 248);
    
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

function isWalkableMessageCell(x, z) {
    return z >= 0 && z < MAP.length && x >= 0 && x < MAP[z].length && MAP[z][x] !== 1;
}

function getBloodMessagePlacements() {
    const sides = [
        { side: 'NORTH', dx: 0, dz: -1 },
        { side: 'EAST', dx: 1, dz: 0 },
        { side: 'SOUTH', dx: 0, dz: 1 },
        { side: 'WEST', dx: -1, dz: 0 }
    ];
    const candidates = [];

    for (let z = 1; z < MAP.length - 1; z++) {
        for (let x = 1; x < MAP[z].length - 1; x++) {
            if (MAP[z][x] !== 1) continue;
            sides.forEach((dir) => {
                if (isWalkableMessageCell(x + dir.dx, z + dir.dz)) {
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

export async function addBloodWallMessages(scene) {
    await loadBloodMessageFont();
    getBloodMessagePlacements().forEach((placement) => {
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
