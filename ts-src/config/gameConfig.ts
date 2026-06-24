// @ts-check
// --- CONFIGURACIÓN Y CONSTANTES DEL JUEGO ---
export const GRID_SIZE = 4;
export const WALL_HEIGHT = 4;
export const PLAYER_SPEED = 4.2; // unidades/segundo; conserva 0.07 por frame a 60 FPS
export const PLAYER_RADIUS = 0.6;
export const ZOMBIE_SPEED = 1.5; // unidades/segundo; conserva 0.025 por frame a 60 FPS
export const ZOMBIE_GROAN_RATE = 0.18027054121830648; // eventos/segundo desde p=0.003 a 60 FPS
export const ZOMBIE_ATTACK_DIST = 1.3;
export const ZOMBIE_ATTACK_COOLDOWN = 1500; // ms
export const ZOMBIE_SPAWN_COUNT = 8;
export const SPIDER_SPAWN_COUNT = 3;
export const SPIDER_HEALTH = 60;
export const SPIDER_SPEED = 2.1; // unidades/segundo; conserva 0.035 por frame a 60 FPS
export const SPIDER_CEILING_Y = WALL_HEIGHT - 0.35;
export const SPIDER_SHOT_DAMAGE = 12;
export const SPIDER_SHOT_SPEED = 12; // unidades/segundo; conserva 0.2 por frame a 60 FPS
export const SPIDER_SHOT_RANGE = 18;
export const SPIDER_SHOT_COOLDOWN_MIN = 1800;
export const SPIDER_SHOT_COOLDOWN_MAX = 3200;
export const SPIDER_PLAYER_START_SAFE_CELLS = 4;
export const SPIDER_MIN_SEPARATION_CELLS = 3;
export const MAX_HEALTH = 100;
export const MAX_ARMOR = 100;
export const BOSS_HEALTH = 3000;
export const BOSS_MELEE_DAMAGE = 35;
export const BOSS_ACID_DAMAGE = 25;
export const BOSS_MELEE_RANGE = 3.0;
export const BOSS_ACID_RANGE_MIN = 5.0;
export const BOSS_ACID_RANGE_MAX = 20.0;
export const BOSS_SPEED_MULTIPLIER = 1.8;
export const BOSS_RUSH_SPEED_MULTIPLIER = 3.6;
export const BOSS_RUSH_DURATION = 3.0;
export const BOSS_RUSH_INTERVAL = 15.0;
export const BOSS_ACID_SHOT_SPEED = 15; // unidades/segundo; conserva 0.25 por frame a 60 FPS
export const BOSS_ROAR_RATE = 0.3007525075287223; // eventos/segundo desde p=0.005 a 60 FPS
export const FUSE_SPARK_RATE = 5.002896249256134; // eventos/segundo desde p=0.08 a 60 FPS
export const PARTICLE_GRAVITY = -18; // unidades/segundo²; conserva -0.005 por frame a 60 FPS
export const GAME_PAYOUT_NWC_URI = '';
export const SHOW_START_ZAP_ACCESS = false;
export const SHOW_START_NOSTR_LEADERBOARD = true;
export const SHOW_START_LUNA_NEGRA_SECTION = false;
export const LUNA_NEGRA_BASE_URL = 'https://moon21.vercel.app';
export const LUNA_NEGRA_LEADERBOARD_NAME = 'Sammer';
export const LEVEL_ONE_LAMP_COLOR = 0xffb36a;
export const LEVEL_ONE_LAMP_INTENSITY = 2.0;
export const LEVEL_ONE_LAMP_DIM_INTENSITY = 0.18;
export const LEVEL_ONE_LAMP_DISTANCE = 12;
export const LEVEL_ONE_LAMP_ANGLE = Math.PI / 3.4;
export const LEVEL_ONE_LAMP_PENUMBRA = 0.55;
export const LEVEL_ONE_LAMP_DECAY = 2.2;
export const LEVEL_ONE_LAMP_SPACING_MODULO = 5;
export const LEVEL_ONE_LAMP_MIN_GRID_X = 3;
export const LEVEL_ONE_LAMP_MIN_GRID_Z = 3;
// LEVEL 3 settings
export const LEVEL_THREE_FOG_COLOR = 0x2a3848;
export const LEVEL_THREE_FOG_DENSITY = 0.045;
export const LEVEL_THREE_HEMI_SKY_COLOR = 0x4a5a6a;
export const LEVEL_THREE_HEMI_GROUND_COLOR = 0x1a2530;
export const LEVEL_THREE_HEMI_INTENSITY = 0.2;
export const LEVEL_THREE_TONE_EXPOSURE = 0.75;
export const LEVEL_THREE_PARTICLE_COLOR = 0xffffff;
export const LEVEL_THREE_PARTICLE_EMISSIVE = 0xddeeff;
export const LEVEL_THREE_PARTICLE_SIZE = 0.025;
export const LEVEL_THREE_PARTICLE_OPACITY = 0.6;
export const LEVEL_THREE_LAMP_SPAWN_CHANCE = 0.12;
export const LEVEL_THREE_LAMP_MIN_GRID_X = 3;
export const LEVEL_THREE_LAMP_MIN_GRID_Z = 3;
export const LEVEL_THREE_LAMP_BLUE_CHANCE = 0.5;
export const LEVEL_THREE_LAMP_BLUE_COLOR = 0x55aaff;
export const LEVEL_THREE_LAMP_WHITE_COLOR = 0xcceeff;
export const LEVEL_THREE_LAMP_INTENSITY = 1.5;
export const LEVEL_THREE_LAMP_DIM_INTENSITY = 0.2;
export const LEVEL_THREE_LAMP_DISTANCE = 5;
export const LEVEL_THREE_LAMP_DECAY = 1.2;
export const LEVEL_THREE_LAMP_BLUE_MATERIAL_COLOR = 0x114488;
export const LEVEL_THREE_LAMP_WHITE_MATERIAL_COLOR = 0x88aabb;
export const FLASHLIGHT_FLICKER_CYCLE_SECONDS = 66;
export const FLASHLIGHT_FLICKER_START_SECONDS = 60;
export const FLASHLIGHT_FLICKER_SECONDS = 0.5;
export const FLASHLIGHT_OFF_SECONDS = 4.0;
export const FLASHLIGHT_FLICKER_RATE = 14;
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
// Matrices de mapa 2D por nivel
// 1 = Pared, 2 = Puerta de salida, 3 = Puerta normal interactiva, 0 = Vacío
export const MAP1 = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 3, 1, 1, 1, 1, 3, 1, 1, 1, 1, 3, 1],
    [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
    [1, 0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1],
    [1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 3, 1, 0, 1, 0, 1, 0, 1, 1, 1, 3, 1],
    [1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];
export const MAP2 = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];
export const MAP3 = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1],
    [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 1],
    [1, 0, 1, 3, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 3, 1, 1, 1, 1],
    [1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];
export const MAP4_BOSS = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];
export const MAP = MAP1; // Retrocompatibilidad
/**
 * @param {number} level
 */
export function getMapForLevel(level: number) {
    if (level === 2)
        return MAP2;
    if (level === 3)
        return MAP3;
    if (level === 4)
        return MAP4_BOSS;
    return MAP1;
}
export const BLOOD_MESSAGE_FONT_FAMILY = 'SHLOP';
export const BLOOD_MESSAGE_FONT_URL = 'assets/fonts/SHLOP.ttf';
export const BLOOD_WALL_MESSAGES = [
    'Bitcoin o Muerte!',
    'CORRE!',
    'ACA NADIE RESPAWNEA BIEN',
    'NO ABRAS LA PUERTA ROJA',
    'Sin television y sin cerveza...',
    'ARCA sabe de tus Bitcoins',
    'Halving is coming'
];
