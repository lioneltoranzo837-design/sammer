// --- CONFIGURACIÓN Y CONSTANTES DEL JUEGO ---
export const GRID_SIZE = 4;
export const WALL_HEIGHT = 4;
export const PLAYER_SPEED = 0.07;
export const PLAYER_RADIUS = 0.6;
export const ZOMBIE_SPEED = 0.025;
export const ZOMBIE_ATTACK_DIST = 1.3;
export const ZOMBIE_ATTACK_COOLDOWN = 1500; // ms
export const ZOMBIE_SPAWN_COUNT = 8;
export const MAX_HEALTH = 100;
export const MAX_ARMOR = 100;

// Configuración de Armamento
export const WEAPONS = {
    shotgun: {
        name: 'ESCOPETA REMINGTON',
        clipMax: 8,
        damage: 35,
        fireInterval: 750,
        automatic: false,
        clip: 8,
        reserve: 24,
        reserveMax: 48
    },
    glock: {
        name: 'GLOCK 17',
        clipMax: 17,
        damage: 20,
        fireInterval: 250,
        automatic: false,
        clip: 17,
        reserve: 51,
        reserveMax: 102
    },
    m4: {
        name: 'FUSIL M4 CARABINA',
        clipMax: 30,
        damage: 15,
        fireInterval: 120,
        automatic: true,
        clip: 30,
        reserve: 90,
        reserveMax: 180
    }
};

// Matriz de mapa 2D
// 1 = Pared metálica, 2 = Puerta de salida, 3 = Puerta normal interactiva (se abre con E), 0 = Vacío
export const MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,1,1,1,0,1,0,1],
    [1,0,1,0,0,0,1,0,0,0,0,1,0,1,0,1],
    [1,0,1,1,1,1,1,0,1,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,1,0,0,1,0,0,0,1],
    [1,1,1,1,3,1,1,1,1,3,1,1,1,1,3,1], // Compuertas añadidas en intersecciones
    [1,0,0,1,0,1,0,0,0,0,0,0,0,1,0,1],
    [1,0,0,1,0,1,0,1,1,1,1,1,0,1,0,1],
    [1,0,1,1,0,1,0,1,0,0,0,1,0,1,0,1],
    [1,0,0,0,0,1,0,1,0,1,0,1,0,0,0,1],
    [1,1,1,1,3,1,0,1,0,1,0,1,1,1,3,1], // Compuertas añadidas
    [1,0,0,0,0,0,0,1,0,1,0,0,0,1,0,1],
    [1,0,1,1,1,1,1,1,0,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2], // 2 = Puerta de salida
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];


export const BLOOD_MESSAGE_FONT_FAMILY = 'SHLOP';
export const BLOOD_MESSAGE_FONT_URL = 'assets/fonts/SHLOP.ttf';

export const BLOOD_WALL_MESSAGES = [
    'Bitcoin o Muerte!',
    'CORRÉ!',
    'ACÁ NADIE RESPAWNEA BIEN',
    'NO ABRAS LA PUERTA ROJA',
    'Sin television y sin cerveza...',
    'ARCA sabe de tus Bitcoins',
    'Halving is coming'
];
