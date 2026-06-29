// @ts-nocheck
import { AudioSynth } from './audio/SoundSynth.js';
import { GRID_SIZE, MAP, MAX_ARMOR, MAX_HEALTH, PLAYER_RADIUS, PLAYER_SPEED, WALL_HEIGHT, WEAPONS, ZOMBIE_ATTACK_COOLDOWN, ZOMBIE_ATTACK_DIST, ZOMBIE_SPEED, ZOMBIE_GROAN_RATE, SPIDER_SPAWN_COUNT, SPIDER_HEALTH, SPIDER_SPEED, SPIDER_CEILING_Y, SPIDER_SHOT_DAMAGE, SPIDER_SHOT_SPEED, SPIDER_SHOT_RANGE, SPIDER_SHOT_COOLDOWN_MIN, SPIDER_SHOT_COOLDOWN_MAX, SPIDER_PLAYER_START_SAFE_CELLS, SPIDER_MIN_SEPARATION_CELLS, BOSS_HEALTH, BOSS_MELEE_DAMAGE, BOSS_ACID_DAMAGE, BOSS_MELEE_RANGE, BOSS_ACID_RANGE_MIN, BOSS_ACID_RANGE_MAX, BOSS_SPEED_MULTIPLIER, BOSS_RUSH_SPEED_MULTIPLIER, BOSS_RUSH_DURATION, BOSS_RUSH_INTERVAL, BOSS_ACID_SHOT_SPEED, BOSS_ROAR_RATE, FUSE_SPARK_RATE, PARTICLE_GRAVITY, LEVEL_ONE_LAMP_COLOR, LEVEL_ONE_LAMP_INTENSITY, LEVEL_ONE_LAMP_DIM_INTENSITY, LEVEL_ONE_LAMP_DISTANCE, LEVEL_ONE_LAMP_ANGLE, LEVEL_ONE_LAMP_PENUMBRA, LEVEL_ONE_LAMP_DECAY, LEVEL_ONE_LAMP_SPACING_MODULO, LEVEL_ONE_LAMP_MIN_GRID_X, LEVEL_ONE_LAMP_MIN_GRID_Z, LEVEL_THREE_FOG_COLOR, LEVEL_THREE_FOG_DENSITY, LEVEL_THREE_HEMI_SKY_COLOR, LEVEL_THREE_HEMI_GROUND_COLOR, LEVEL_THREE_HEMI_INTENSITY, LEVEL_THREE_TONE_EXPOSURE, LEVEL_THREE_PARTICLE_COLOR, LEVEL_THREE_PARTICLE_EMISSIVE, LEVEL_THREE_PARTICLE_SIZE, LEVEL_THREE_PARTICLE_OPACITY, LEVEL_THREE_LAMP_SPAWN_CHANCE, LEVEL_THREE_LAMP_MIN_GRID_X, LEVEL_THREE_LAMP_MIN_GRID_Z, LEVEL_THREE_LAMP_BLUE_CHANCE, LEVEL_THREE_LAMP_BLUE_COLOR, LEVEL_THREE_LAMP_WHITE_COLOR, LEVEL_THREE_LAMP_INTENSITY, LEVEL_THREE_LAMP_DIM_INTENSITY, LEVEL_THREE_LAMP_DISTANCE, LEVEL_THREE_LAMP_DECAY, LEVEL_THREE_LAMP_BLUE_MATERIAL_COLOR, LEVEL_THREE_LAMP_WHITE_MATERIAL_COLOR, FLASHLIGHT_FLICKER_CYCLE_SECONDS, FLASHLIGHT_FLICKER_START_SECONDS, FLASHLIGHT_FLICKER_SECONDS, FLASHLIGHT_OFF_SECONDS, FLASHLIGHT_FLICKER_RATE, SHOW_START_ZAP_ACCESS, SHOW_START_NOSTR_LEADERBOARD, SHOW_START_LUNA_NEGRA_SECTION, LUNA_NEGRA_BASE_URL, LUNA_NEGRA_LEADERBOARD_NAME, getMapForLevel } from './config/gameConfig.js?v=3';
import { createInitialPlayer, createKeyboardState } from './core/state.js';
import { BoundedPool } from './core/boundedPool.js';
import { LazyAsset } from './core/lazyAsset.js';
import { clampSimulationDelta, distanceForDelta, eventOccursForDelta, integrateConstantAcceleration, legacyFrameVelocityToPerSecond } from './core/timing.js';
import { pickFacilityDecorationType } from './gameplay/facilityDecorations.js';
import { ENEMY_SCORE_TYPES, createInitialScoreState, recordEnemyKill, recordPlayerDamage, resolveFinalScore } from './gameplay/scoring.js';
import { canStartPaidRun, createEntryGateState } from './nostr/paymentGate.js';
import { DelegationUnavailableError, buildDelegationTag, isDelegationActive, isSignSchnorrAvailable, requestDelegation } from './nostr/delegation.js';
import { extractScoreboardEntries } from './nostr/scoreboardData.js';
import { buildStartupLeaderboardRows, shortenPlayerIdentity } from './nostr/startupLeaderboard.js';
import { buildLunaNegraLeaderboardRows, buildLunaNegraLeaderboardUrl, buildLunaNegraScoresUrl, buildLunaNegraSessionUrl, getLunaNegraTokenFromSearch, normalizeLunaNegraSession, removeLunaNegraTokenFromUrl } from './nostr/lunaNegra.js';
import {
    addBloodWallMessages, generateCeilingTexture, generateFloorTexture, generateWallTexture, generateZombieFaceTexture,
    generateJungleWallTexture, generateJungleFloorTexture, generateJungleCeilingTexture,
    generateMountainWallTexture, generateMountainFloorTexture, generateMountainCeilingTexture,
    generateInfernalWallTexture, generateInfernalFloorTexture, generateInfernalCeilingTexture,
    createNormalMapFromCanvas, createRoughnessMapFromCanvas,
    generateBarkTexture, generateLeafTexture
} from './rendering/textures.js?v=2';
import { createAdaptiveResolutionState, getRenderViewport, sampleAdaptiveResolution } from './rendering/adaptiveResolution.js';
import {
    ammoClipEl, ammoReserveEl, armorBar, armorVal, crosshair, damageFlash, deathOverlay, feedbackMsg,
    deathClaimBtn, deathJackpotPanel, deathJackpotStatus, deathLnAddress, deathScoreDetail, deathScoreValue,
    healthBar, healthVal, menuOverlay, restartBtn, freeStartBtn, startBtn, victoryOverlay, winBtn,
    zombieCountEl, bossHud, bossHealthFill, nostrConnectBtn, nostrNsecInput, nostrNsecBtn,
    nostrManualSection, entryGateInvoiceOutput, entryGatePanel, entryGatePayBtn, entryGateStatus,
    entryGateVerifyBtn, jackpotValue, startLeaderboardList, startLeaderboardPanel, startLeaderboardStatus, lunaNegraPanel, lunaNegraStatus, lunaNegraPlayer, lunaNegraAvatar, lunaNegraLeaderboardList
} from './ui/dom.js';
const { THREE } = window;
// --- CONFIGURACIÓN DE THREE.JS ---
let scene, camera, renderer, composer;
let envCamera = null;
let globalSnowMaterial = null;
let bloomPass = null;
let frameCount = 0;
let clock;
let adaptiveResolutionState;
let player = createInitialPlayer();
window.player = player;
let keyboard = createKeyboardState();
let colliders = [];
let zombies = [];
let spiders = [];
let particles = [];
let lights = [];
let interactiveDoors = []; // Registro de puertas normales interactuadas
let fuses = []; // Registro de fusibles en el mapa
let fusesCollected = 0; // Fichas recogidas
let ambientParticles = []; // Partículas ambientales flotantes (polvo/esporas/nieve)
let breathParticles = []; // Partículas de aliento para el Nivel 3
let breathTimer = 0;
let hemisphereLight = null; // Luz hemisférica ambiental por bioma
let decorations = []; // Objetos decorativos 3D ambientales
let fuseBoxConsole = null; // Estructura 3D del generador final
let barkMaterial = null;
let leafMaterial = null;
let leafMaterialShader = null;
let sunLight = null;
let sunMesh = null;
let grassMaterial = null;
let grassInstancedMesh = null;
let grassMaterialShader = null;
let cloudMesh = null;
// Variables de Progresión y Nuevas Armas
let currentLevel = 1;
let builtMapLevel = null;

let mapChunks = []; // Array para guardar mallas del mapa y su coordenada Z
let activeMap = MAP;
let supplyPoints = 0;
let scoreState = createInitialScoreState(0);
let unlockedWeapons = { shotgun: true, glock: false, m4: false };
let playerNostrPubkey = null;
let playerNostrPrivateKey = null;
let activeDelegation = null;
const NOSTR_GAME_PUBKEY = 'fdd8790e8c462fc680cf57f5852392a8a22ba93ff26030253030c6da5509928b';
const NOSTR_SCORE_RELAYS = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol'
];
const DEFAULT_ENTRY_FEE_SATS = 100;
let entryFeeSats = DEFAULT_ENTRY_FEE_SATS;
let gameLightningAddress = '';
const JACKPOT_LEDGER_KIND = 30078;
const STARTUP_LEADERBOARD_LIMIT = 5;
const showStartZapAccess = Boolean(SHOW_START_ZAP_ACCESS);
const showStartNostrLeaderboard = Boolean(SHOW_START_NOSTR_LEADERBOARD);
const showStartNostrControls = showStartZapAccess || showStartNostrLeaderboard;
const showStartLunaNegraSection = Boolean(SHOW_START_LUNA_NEGRA_SECTION);
function getRunElapsedSeconds() {
    if (scoreState.startedAtMs <= 0) {
        return 0;
    }
    return Math.max(0, (performance.now() - scoreState.startedAtMs) / 1000);
}
function createScorePublishSnapshot() {
    const elapsedSeconds = getRunElapsedSeconds();
    return {
        finalScore: resolveFinalScore({
            state: scoreState,
            currentLevel,
            elapsedSeconds,
        }),
        kills: scoreState.kills,
        damageTaken: scoreState.damageTaken,
        elapsedSeconds: Math.round(elapsedSeconds),
    };
}
function recordZombieKillScore(zombieType) {
    if (zombieType === 'RUNNER') {
        scoreState = recordEnemyKill(scoreState, ENEMY_SCORE_TYPES.ZombieRunner, currentLevel);
        return;
    }
    if (zombieType === 'SPITTER') {
        scoreState = recordEnemyKill(scoreState, ENEMY_SCORE_TYPES.ZombieSpitter, currentLevel);
        return;
    }
    scoreState = recordEnemyKill(scoreState, ENEMY_SCORE_TYPES.ZombieNormal, currentLevel);
}
// Variables para el Minijuego de Cableado
let wiringFixed = false;
let draggingWireIdx = -1;
let mousePos = { x: 0, y: 0 };
let leftSockets = [];
let rightSockets = [];
let entryGateState = createEntryGateState(entryFeeSats);
let lunaNegraSession = null;
let currentJackpotSats = 0;
let jackpotBackendConfigured = false;
let pendingEntryZapRequest = null;
let pendingEntryZapProviderPubkey = '';
let pendingEntryZapSessionId = '';
let pendingVerificationTimer = 0;
let pendingVerificationDeadline = 0;
let pendingDeathJackpotClaim = null;
const ENTRY_VERIFICATION_INTERVAL_MS = 2500;
const ENTRY_VERIFICATION_TIMEOUT_MS = 5 * 60 * 1000;
let engineReady = false;
let isMouseDown = false;
let autoFireTimer = 0;
let acidProjectiles = [];
// Grupos 3D de Mallas para Armas
let shotgunMeshGroup, glockMeshGroup, m4MeshGroup;
// Elementos de la escena
let wallMaterialStandard, wallMaterialHazard, wallMaterialBlood, doorMaterial;
let floorMaterial, ceilingMaterial;
let zombieFaceTexture;
let cachedZombieModel = null;
let zombieGLBScaleFactor = 1.0;
let zombieGLBBaseYOffset = 0.0;
// Boss Model (Level 4)
let cachedBossModel = null;
let bossGLBScaleFactor = 1.0;
let bossGLBBaseYOffset = 0.0;
let bossEnemy = null;
const BOSS_MODEL_URL = 'assets/Meshy_AI_Infernal_Ironclad_0624210309_texture.glb';
// Arma y disparo
let gunGroup;
let gunRecoilActive = false;
let gunRecoilTimer = 0;
let muzzleFlashSprite;
let muzzleLight;
let playerFlashlight;
let flashlightCycleTimer = 0;
let flashlightUserEnabled = true;
let dustParticles;
const FLASHLIGHT_BASE_INTENSITY = 2.5;

// Estado del juego
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER, VICTORY
// --- INICIALIZACIÓN DE LA ESCENA ---
async function initEngine() {
    // Escena oscura con niebla densa de terror
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050508, 0.08); // niebla grisácea/azulada oscura
    // Cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / (window.innerHeight - 110), 0.1, 1000);
    camera.position.copy(player.position);
    scene.add(camera);
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(128, {
        format: THREE.RGBFormat,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter
    });
    envCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
    scene.add(envCamera);
    // Reloj
    clock = new THREE.Clock();
    // Renderizador con mejoras de calidad gráfica
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // Three r128 reads shader link logs synchronously. In production that query
    // can stall for seconds; opt back in with ?debugShaders=1 while developing.
    renderer.debug.checkShaderErrors = new URLSearchParams(window.location.search).has('debugShaders');
    adaptiveResolutionState = createAdaptiveResolutionState(window.devicePixelRatio);
    renderer.setPixelRatio(adaptiveResolutionState.scale);
    const initialViewport = getRenderViewport(window.innerWidth, window.innerHeight);
    renderer.setSize(initialViewport.width, initialViewport.height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Tone mapping cinematográfico
    renderer.toneMappingExposure = 1.1;
    renderer.outputEncoding = THREE.sRGBEncoding; // Color encoding correcto
    document.getElementById('game-container').appendChild(renderer.domElement);

    // --- POST-PROCESSING ---
    const renderScene = new THREE.RenderPass(scene, camera);

    // UnrealBloomPass para luces intensas (disparos, linterna, fuego)
    bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(initialViewport.width, initialViewport.height),
        0.9,  // Fuerza (strength)
        0.8,  // Radio (radius)
        0.6   // Umbral (threshold)
    );

    // FilmPass para grano de película y scanlines de terror
    const filmPass = new THREE.FilmPass(
        0.5,   // Intensidad de ruido
        0.25,  // Intensidad de scanlines
        648,   // Cantidad de scanlines
        false  // Grayscale
    );
    filmPass.renderToScreen = true;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(filmPass);
    resizeRenderTargets();
    // Luz ambiental base muy tenue
    const ambientLight = new THREE.AmbientLight(0x0a0a14, 0.15);
    scene.add(ambientLight);
    // Luz hemisférica para iluminación natural de relleno (cambia por bioma)
    hemisphereLight = new THREE.HemisphereLight(0x111122, 0x080810, 0.1);
    scene.add(hemisphereLight);
    // Linterna acoplada a la cámara del jugador (SpotLight) - Potente y amplio rango
    playerFlashlight = new THREE.SpotLight(0xfff9e6, 0, 30, Math.PI / 4.5, 0.8, 1.5);
    playerFlashlight.castShadow = true;
    playerFlashlight.shadow.mapSize.width = 1024;
    playerFlashlight.shadow.mapSize.height = 1024;
    playerFlashlight.shadow.camera.near = 0.5;
    playerFlashlight.shadow.camera.far = 45;
    playerFlashlight.shadow.bias = -0.0005;
    playerFlashlight.shadow.radius = 2; // Sombras suavizadas
    camera.add(playerFlashlight);

    // Objetivo de la linterna (apunta al frente de la cámara)
    const flashTarget = new THREE.Object3D();
    flashTarget.position.set(0, 0.58, -1);
    camera.add(flashTarget);
    playerFlashlight.target = flashTarget;
    // Keep the light visible so the shader light topology never changes.
    // Turning it on, off, and flickering only changes its intensity.
    playerFlashlight.visible = true;

    // --- POLVO ATMOSFÉRICO ---
    const particleCount = 2500;
    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
        dustPositions[i] = (Math.random() - 0.5) * 50;
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

    const dustCanvas = document.createElement('canvas');
    dustCanvas.width = 16;
    dustCanvas.height = 16;
    const dCtx = dustCanvas.getContext('2d');
    const dGrad = dCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
    dGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
    dGrad.addColorStop(1, 'rgba(255,255,255,0)');
    dCtx.fillStyle = dGrad;
    dCtx.fillRect(0,0,16,16);
    const dustTex = new THREE.CanvasTexture(dustCanvas);

    const dustMaterial = new THREE.PointsMaterial({
        color: 0xcccccc,
        size: 0.15,
        map: dustTex,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    dustParticles = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustParticles);

    // Carga de Texturas procedimentales
    const texWall0 = generateWallTexture(0);
    const texWall1 = generateWallTexture(1);
    const texWall2 = generateWallTexture(2);
    const texWall3 = generateWallTexture(3);
    const texFloor = generateFloorTexture();
    const texCeiling = generateCeilingTexture();

    wallMaterialStandard = new THREE.MeshStandardMaterial({
        map: texWall0,
        normalMap: createNormalMapFromCanvas(texWall0, 3.0),
        roughnessMap: createRoughnessMapFromCanvas(texWall0, 1.2, 0.1),
        metalness: 0.3
    });
    wallMaterialHazard = new THREE.MeshStandardMaterial({
        map: texWall1,
        normalMap: createNormalMapFromCanvas(texWall1, 2.5),
        roughnessMap: createRoughnessMapFromCanvas(texWall1, 1.0, 0.2),
        metalness: 0.3
    });
    wallMaterialBlood = new THREE.MeshStandardMaterial({
        map: texWall2,
        normalMap: createNormalMapFromCanvas(texWall2, 3.0),
        roughnessMap: createRoughnessMapFromCanvas(texWall2, 2.0, -0.2),
        metalness: 0.2
    });
    doorMaterial = new THREE.MeshStandardMaterial({
        map: texWall3,
        normalMap: createNormalMapFromCanvas(texWall3, 1.5),
        roughnessMap: createRoughnessMapFromCanvas(texWall3, 1.0, 0.0),
        metalness: 0.5
    });

    floorMaterial = new THREE.MeshStandardMaterial({
        map: texFloor,
        normalMap: createNormalMapFromCanvas(texFloor, 2.5),
        roughnessMap: createRoughnessMapFromCanvas(texFloor, 1.5, -0.1),
        metalness: 0.1
    });
    ceilingMaterial = new THREE.MeshStandardMaterial({
        map: texCeiling,
        normalMap: createNormalMapFromCanvas(texCeiling, 1.0),
        roughnessMap: createRoughnessMapFromCanvas(texCeiling, 0.8, 0.3),
        metalness: 0.2
    });

    zombieFaceTexture = generateZombieFaceTexture();
    freeStartBtn.disabled = true;
    engineReady = false;
    const zombieModelReady = new Promise((resolve) => {
        // Carga del modelo de zombie GLB original en segundo plano
        try {
            console.log("Iniciando carga de modelo de zombie GLB original en segundo plano...");
            const gltfLoader = new THREE.GLTFLoader();
            gltfLoader.load('assets/Meshy_AI_1_0613035518_texture.glb', (gltf) => {
                cachedZombieModel = gltf.scene;
                // Pre-calcular la escala y el offset de Y para optimizar instanciación
                cachedZombieModel.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(cachedZombieModel);
                const size = box.getSize(new THREE.Vector3());
                // Proteger contra altura 0 o NaN
                let height = size.y;
                if (isNaN(height) || height < 0.01) {
                    height = 1.8;
                }
                zombieGLBScaleFactor = 1.8 / height;
                if (isNaN(zombieGLBScaleFactor) || !isFinite(zombieGLBScaleFactor)) {
                    zombieGLBScaleFactor = 1.0;
                }
                // Aplicar escala al modelo base
                cachedZombieModel.scale.set(zombieGLBScaleFactor, zombieGLBScaleFactor, zombieGLBScaleFactor);
                cachedZombieModel.updateMatrixWorld(true);
                // Calcular el offset
                const boxScaled = new THREE.Box3().setFromObject(cachedZombieModel);
                zombieGLBBaseYOffset = -boxScaled.min.y;
                if (isNaN(zombieGLBBaseYOffset) || !isFinite(zombieGLBBaseYOffset)) {
                    zombieGLBBaseYOffset = 0.0;
                }
                console.log(`Modelo de zombie GLB original cargado y pre-escalado. Altura original: ${height}, Factor de escala: ${zombieGLBScaleFactor}, Offset Y: ${zombieGLBBaseYOffset}`);
                resolve();
            }, undefined, (err) => {
                resolve();
                console.error("Error al cargar el zombie GLB original, se usará el modelo procedimental de respaldo:", err);
            });
        }
        catch (err) {
            console.error("Error al inicializar el cargador GLTF:", err);
            resolve();
        }
    });
    // El jefe se carga bajo demanda al entrar al nivel 4.
    // Construir el mapa
    buildMap3D();
    await addBloodWallMessages(scene);
    // Ensamblar arma
    buildWeapon3D();
    await zombieModelReady;
    // Warm the first gameplay scene behind the menu. The pristine entities are
    // reused on JUGAR so the first combat frame has no new shader programs.
    spawnFuses();
    spawnZombies();
    renderer.compile(scene, camera);
    // Manejo de eventos
    window.addEventListener('resize', onWindowResize);
    setupControls();
    freeStartBtn.disabled = false;
    engineReady = true;
    updateEntryGateUI();
    // Bucle de renderizado
    animate();
}
function loadBossModel() {
    console.log('Iniciando carga bajo demanda del modelo de jefe GLB...');
    return new Promise((resolve, reject) => {
        const bossLoader = new THREE.GLTFLoader();
        bossLoader.load(BOSS_MODEL_URL, (gltf) => {
            cachedBossModel = gltf.scene;
            
            // Optimización drástica de rendimiento para el modelo pesado
            cachedBossModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = false; // No emitir sombras
                    child.receiveShadow = false;
                    if (child.material) {
                        child.material.envMap = null; // No procesar reflejos
                        child.material.needsUpdate = true;
                    }
                }
            });

            cachedBossModel.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(cachedBossModel);
            const size = box.getSize(new THREE.Vector3());
            let height = size.y;
            if (!Number.isFinite(height) || height < 0.01) {
                height = 4.0;
            }
            bossGLBScaleFactor = 4.0 / height;
            if (!Number.isFinite(bossGLBScaleFactor)) {
                bossGLBScaleFactor = 1.0;
            }
            cachedBossModel.scale.set(bossGLBScaleFactor, bossGLBScaleFactor, bossGLBScaleFactor);
            cachedBossModel.updateMatrixWorld(true);
            const boxScaled = new THREE.Box3().setFromObject(cachedBossModel);
            bossGLBBaseYOffset = -boxScaled.min.y;
            if (!Number.isFinite(bossGLBBaseYOffset)) {
                bossGLBBaseYOffset = 0.0;
            }
            console.log(`Modelo de jefe GLB cargado. Altura original: ${height}, Factor: ${bossGLBScaleFactor}, Offset Y: ${bossGLBBaseYOffset}`);
            resolve(cachedBossModel);
        }, undefined, reject);
    });
}
const bossModelAsset = new LazyAsset(loadBossModel);
function ensureBossModelLoaded() {
    bossModelAsset.ensure().then(model => {
        if (model) {
            if (currentLevel === 4 && bossEnemy && bossEnemy.state === 'ALIVE' && bossEnemy.replaceMeshWithGLB) {
                bossEnemy.replaceMeshWithGLB();
            }
        } else {
            console.error('Error al cargar el modelo del jefe; se mantiene el respaldo procedimental.');
        }
    });
}
function setStartMenuElementVisible(element, visible) {
    if (!element) {
        return;
    }
    element.hidden = !visible;
}
function applyStartMenuVisibility() {
    setStartMenuElementVisible(entryGatePanel, showStartZapAccess);
    setStartMenuElementVisible(startLeaderboardPanel, showStartNostrLeaderboard);
    setStartMenuElementVisible(lunaNegraPanel, showStartLunaNegraSection);
    setStartMenuElementVisible(nostrConnectBtn, showStartNostrControls);
    setStartMenuElementVisible(nostrManualSection, false);
}
function initNostrUI() {
    if (!showStartNostrControls) {
        return;
    }
    nostrConnectBtn.addEventListener('click', async () => {
        if (window.nostr) {
            try {
                const pubkey = await window.nostr.getPublicKey();
                playerNostrPrivateKey = null;
                playerNostrPubkey = pubkey;
                nostrManualSection.style.display = 'none';
                nostrNsecInput.value = '';
                updateNostrButton();
                await tryActivateDelegation(pubkey);
                showFeedback('NOSTR CONECTADO');
            }
            catch (e) {
                console.error('NIP-07 error:', e);
                showManualSection();
            }
        }
        else {
            showManualSection();
        }
    });
    nostrNsecBtn.addEventListener('click', () => {
        const nsec = nostrNsecInput.value.trim();
        if (!nsec)
            return;
        try {
            const { nip19, getPublicKey } = window.NostrTools;
            const decoded = nip19.decode(nsec);
            if (decoded.type !== 'nsec') {
                throw new Error('Expected nsec private key');
            }
            playerNostrPrivateKey = decoded.data;
            playerNostrPubkey = getPublicKey(playerNostrPrivateKey);
            activeDelegation = null;
            nostrManualSection.style.display = 'none';
            nostrNsecInput.value = '';
            updateNostrButton();
            showFeedback('NOSTR CONECTADO');
        }
        catch (error) {
            console.error('Manual Nostr login error:', error);
            showFeedback('NSEC INVALIDO');
        }
    });
}
async function tryActivateDelegation(delegatorPubkey) {
    activeDelegation = null;
    if (!isSignSchnorrAvailable()) {
        console.info('NIP-26 no disponible: la extension no expone signSchnorr. Se usara signEvent por score.');
        return;
    }
    try {
        const delegation = await requestDelegation(delegatorPubkey);
        activeDelegation = delegation;
        console.info('Delegacion NIP-26 activa hasta', new Date(delegation.expiresAt * 1000).toISOString());
    }
    catch (error) {
        if (error instanceof DelegationUnavailableError) {
            console.warn('Delegacion no disponible:', error.message);
        }
        else {
            console.error('Error solicitando delegacion NIP-26:', error);
        }
    }
}
function showManualSection() {
    nostrManualSection.style.display = 'block';
}
function updateNostrButton() {
    const short = playerNostrPubkey ? playerNostrPubkey.substring(0, 8) + '...' : 'Not connected';
    nostrConnectBtn.textContent = short;
    updateEntryGateUI();
}
function isGamePayoutReady() {
    return jackpotBackendConfigured;
}
function setJackpotValueDisplay(value) {
    if (!jackpotValue) {
        return;
    }
    jackpotValue.textContent = String(value);
}
function setEntryGateStatus(message, tone) {
    if (!entryGateStatus) {
        return;
    }
    entryGateStatus.textContent = message;
    entryGateStatus.dataset.tone = tone;
}
function updateEntryGateUI() {
    if (!showStartZapAccess) {
        if (freeStartBtn && engineReady) {
            freeStartBtn.textContent = 'JUGAR GRATIS';
            freeStartBtn.disabled = false;
        }
        return;
    }
    const payoutReady = isGamePayoutReady();
    const startUnlocked = canStartPaidRun(entryGateState) && payoutReady;
    setJackpotValueDisplay(currentJackpotSats);
    if (freeStartBtn && engineReady) {
        const busy = entryGateState.status === 'paying' || entryGateState.status === 'verifying';
        const paid = canStartPaidRun(entryGateState) && payoutReady;
        freeStartBtn.disabled = busy;
        freeStartBtn.textContent = busy
            ? 'ESPERANDO PAGO...'
            : (paid ? 'JUGAR POR EL POZO' : 'JUGAR GRATIS');
    }
    if (entryGatePayBtn) {
        entryGatePayBtn.disabled = !playerNostrPubkey || entryGateState.status === 'paying' || entryGateState.status === 'verifying' || entryGateState.status === 'paid';
        if (entryGateState.status === 'verifying') {
            entryGatePayBtn.textContent = 'ESPERANDO PAGO...';
        } else if (entryGateState.status === 'paid') {
            entryGatePayBtn.textContent = 'APUESTA CONFIRMADA';
        } else {
            entryGatePayBtn.textContent = `APOSTAR ${entryFeeSats} SATS`;
        }
    }
    if (entryGateInvoiceOutput) {
        entryGateInvoiceOutput.value = entryGateState.invoice;
        entryGateInvoiceOutput.hidden = !entryGateState.invoice;
    }
    if (!playerNostrPubkey) {
        setEntryGateStatus('CONECTA NOSTR PARA GENERAR EL ZAP DE ENTRADA', 'idle');
        return;
    }
    if (!payoutReady) {
        setEntryGateStatus('CONFIGURA EL SIGNER Y LA WALLET DEL JUEGO PARA HABILITAR EL JACKPOT.', 'error');
        return;
    }
    if (startUnlocked) {
        setEntryGateStatus('ENTRADA VERIFICADA. OPERACIÓN DESBLOQUEADA.', 'success');
        return;
    }
    if (entryGateState.status === 'invoice-ready') {
        setEntryGateStatus('FACTURA LISTA. ESPERANDO DETECCIÓN DE PAGO...', 'loading');
        return;
    }
    if (entryGateState.status === 'paying') {
        setEntryGateStatus(`GENERANDO FACTURA ZAP DE ${entryFeeSats} SATS...`, 'loading');
        return;
    }
    if (entryGateState.status === 'verifying') {
        setEntryGateStatus('BUSCANDO RECIBO NOSTR DEL PAGO...', 'loading');
        return;
    }
    if (entryGateState.status === 'error' && entryGateState.lastError) {
        setEntryGateStatus(entryGateState.lastError, 'error');
        return;
    }
    setEntryGateStatus(`PAGA ${entryFeeSats} SATS PARA DESBLOQUEAR LA OPERACIÓN`, 'idle');
}
function resetEntryGateState() {
    stopAutoVerification();
    entryGateState = createEntryGateState(entryFeeSats);
    pendingEntryZapRequest = null;
    pendingEntryZapProviderPubkey = '';
    pendingEntryZapSessionId = '';
    updateEntryGateUI();
}
function setStartupLeaderboardStatus(message, tone) {
    if (!startLeaderboardStatus) {
        return;
    }
    startLeaderboardStatus.textContent = message;
    startLeaderboardStatus.dataset.tone = tone;
}
function clearStartupLeaderboard() {
    if (!startLeaderboardList) {
        return;
    }
    startLeaderboardList.replaceChildren();
}
function formatStartupLeaderboardIdentity(playerPubkey) {
    try {
        if (typeof window.NostrTools?.nip19?.npubEncode === 'function' && /^[a-f0-9]{64}$/i.test(playerPubkey)) {
            return shortenPlayerIdentity(window.NostrTools.nip19.npubEncode(playerPubkey));
        }
    }
    catch (error) {
        console.error('Leaderboard identity format error:', error);
    }
    return shortenPlayerIdentity(playerPubkey);
}
function renderStartupLeaderboardRows(rows) {
    if (!startLeaderboardList) {
        return;
    }
    clearStartupLeaderboard();
    if (rows.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'start-leaderboard-empty';
        emptyItem.textContent = 'SIN REGISTROS TODAVÍA';
        startLeaderboardList.appendChild(emptyItem);
        return;
    }
    rows.forEach((row) => {
        const item = document.createElement('li');
        item.className = 'start-leaderboard-item';
        const rank = document.createElement('span');
        rank.className = 'start-leaderboard-rank';
        rank.textContent = row.rank;
        const player = document.createElement('span');
        player.className = 'start-leaderboard-player';
        player.textContent = row.player;
        const score = document.createElement('span');
        score.className = 'start-leaderboard-score';
        score.textContent = row.score;
        const level = document.createElement('span');
        level.className = 'start-leaderboard-level';
        level.textContent = row.level;
        item.append(rank, player, score, level);
        startLeaderboardList.appendChild(item);
    });
}
function getDeathContentElement() {
    return deathOverlay?.querySelector('.menu-content.death') || null;
}
function getDeathTitleElement() {
    return deathOverlay?.querySelector('.death-title') || null;
}
function getDeathMessageElement() {
    return deathOverlay?.querySelector('.death-message') || null;
}
function countScoreKills(kills) {
    return Object.values(kills).reduce((total, value) => total + Number(value || 0), 0);
}
function setDeathJackpotStatus(message, tone) {
    if (!deathJackpotStatus) {
        return;
    }
    deathJackpotStatus.textContent = message;
    deathJackpotStatus.dataset.tone = tone;
}
function hideDeathJackpotPanel() {
    pendingDeathJackpotClaim = null;
    deathJackpotPanel?.setAttribute('hidden', '');
    deathClaimBtn?.removeAttribute('disabled');
    if (deathLnAddress) {
        deathLnAddress.value = '';
    }
}
function renderDeathSummary(scoreSnapshot) {
    const contentElement = getDeathContentElement();
    const titleElement = getDeathTitleElement();
    const messageElement = getDeathMessageElement();
    contentElement?.classList.remove('leaderboard-winner');
    if (titleElement) {
        titleElement.textContent = 'SUJETO ELIMINADO';
    }
    if (messageElement) {
        messageElement.textContent = 'Tu señal biológica se ha extinguido en la oscuridad...';
    }
    if (deathScoreValue) {
        deathScoreValue.textContent = String(scoreSnapshot.finalScore);
    }
    if (deathScoreDetail) {
        deathScoreDetail.textContent = `NIVEL ${currentLevel} | BAJAS ${countScoreKills(scoreSnapshot.kills)} | DAÑO ${scoreSnapshot.damageTaken}`;
    }
    hideDeathJackpotPanel();
}
function renderDeathJackpotWinner(amountSats, scoreSnapshot, scoreProof, receiptId) {
    const contentElement = getDeathContentElement();
    const titleElement = getDeathTitleElement();
    const messageElement = getDeathMessageElement();
    pendingDeathJackpotClaim = {
        amountSats,
        receiptId,
        scoreProof,
    };
    contentElement?.classList.add('leaderboard-winner');
    if (titleElement) {
        titleElement.textContent = 'OPERADOR #1';
    }
    if (messageElement) {
        messageElement.textContent = `Al morir quedaste en la posición #1 con ${scoreSnapshot.finalScore} puntos. El jackpot está listo para enviarse.`;
    }
    deathJackpotPanel?.removeAttribute('hidden');
    setDeathJackpotStatus(`PREMIO DISPONIBLE: ${amountSats} SATS. Ingresá tu Lightning Address para cobrar.`, 'idle');
    deathLnAddress?.focus();
}
function renderDeathLeaderboardTopWithoutPot(scoreSnapshot) {
    const contentElement = getDeathContentElement();
    const titleElement = getDeathTitleElement();
    const messageElement = getDeathMessageElement();
    contentElement?.classList.add('leaderboard-winner');
    if (titleElement) {
        titleElement.textContent = 'OPERADOR #1';
    }
    if (messageElement) {
        messageElement.textContent = `Al morir quedaste en la posición #1 con ${scoreSnapshot.finalScore} puntos, pero no había jackpot acumulado para cobrar.`;
    }
}
async function loadScoreboardEntriesWithLocalScore(localScoreEvent) {
    const pool = new window.NostrTools.SimplePool();
    try {
        const events = await pool.querySync(NOSTR_SCORE_RELAYS, {
            kinds: [78],
            '#p': [NOSTR_GAME_PUBKEY],
            limit: 500
        });
        return extractScoreboardEntries([...(events || []), localScoreEvent]);
    }
    finally {
        if (typeof pool.close === 'function') {
            pool.close(NOSTR_SCORE_RELAYS);
        }
    }
}
async function isLeaderboardTopScore(localScoreEvent) {
    if (!localScoreEvent) {
        return false;
    }
    const entries = await loadScoreboardEntriesWithLocalScore(localScoreEvent);
    const topEntry = entries[0];
    return Boolean(topEntry && topEntry.playerPubkey === playerNostrPubkey && topEntry.eventId === localScoreEvent.id);
}
async function loadStartupLeaderboard() {
    if (!showStartNostrLeaderboard || !startLeaderboardPanel) {
        return;
    }
    if (typeof window.NostrTools?.SimplePool !== 'function') {
        setStartupLeaderboardStatus('NOSTR TOOLS NO DISPONIBLE', 'error');
        renderStartupLeaderboardRows([]);
        return;
    }
    setStartupLeaderboardStatus('CONSULTANDO RELAYS...', 'loading');
    clearStartupLeaderboard();
    const pool = new window.NostrTools.SimplePool();
    try {
        const events = await pool.querySync(NOSTR_SCORE_RELAYS, {
            kinds: [78],
            '#p': [NOSTR_GAME_PUBKEY],
            limit: 200
        });
        const rows = buildStartupLeaderboardRows(extractScoreboardEntries(events || []), STARTUP_LEADERBOARD_LIMIT, formatStartupLeaderboardIdentity);
        renderStartupLeaderboardRows(rows);
        if (rows.length === 0) {
            setStartupLeaderboardStatus('SIN SCORES PUBLICADOS AÚN', 'idle');
        }
        else {
            setStartupLeaderboardStatus(`MEJORES ${rows.length} SCORES REPORTADOS`, 'success');
        }
    }
    catch (error) {
        console.error('Startup leaderboard error:', error);
        renderStartupLeaderboardRows([]);
        setStartupLeaderboardStatus('NO SE PUDO CARGAR EL SCOREBOARD', 'error');
    }
    finally {
        if (typeof pool.close === 'function') {
            pool.close(NOSTR_SCORE_RELAYS);
        }
    }
}

function setLunaNegraStatus(message, tone) {
    if (!lunaNegraStatus) {
        return;
    }
    lunaNegraStatus.textContent = message;
    lunaNegraStatus.dataset.tone = tone;
}
function clearLunaNegraLeaderboard() {
    if (!lunaNegraLeaderboardList) {
        return;
    }
    lunaNegraLeaderboardList.replaceChildren();
}
function renderLunaNegraPlayer(session) {
    if (!lunaNegraPlayer) {
        return;
    }
    const nameElement = lunaNegraPlayer.querySelector('[data-luna-negra-name]');
    const npubElement = lunaNegraPlayer.querySelector('[data-luna-negra-npub]');
    if (nameElement) {
        nameElement.textContent = session.displayName;
    }
    if (npubElement) {
        npubElement.textContent = session.npub || session.pubkey || session.gameId || '';
    }
    if (lunaNegraAvatar) {
        if (session.avatarUrl) {
            lunaNegraAvatar.src = session.avatarUrl;
            lunaNegraAvatar.hidden = false;
        }
        else {
            lunaNegraAvatar.removeAttribute('src');
            lunaNegraAvatar.hidden = true;
        }
    }
    lunaNegraPlayer.hidden = false;
}
function renderLunaNegraLeaderboardRows(rows) {
    if (!lunaNegraLeaderboardList) {
        return;
    }
    clearLunaNegraLeaderboard();
    if (rows.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'start-leaderboard-empty';
        emptyItem.textContent = 'SIN REGISTROS EN LUNA NEGRA';
        lunaNegraLeaderboardList.appendChild(emptyItem);
        return;
    }
    rows.forEach((row) => {
        const item = document.createElement('li');
        item.className = 'start-leaderboard-item';
        const rank = document.createElement('span');
        rank.className = 'start-leaderboard-rank';
        rank.textContent = row.rank;
        const player = document.createElement('span');
        player.className = 'start-leaderboard-player';
        player.textContent = row.player;
        const score = document.createElement('span');
        score.className = 'start-leaderboard-score';
        score.textContent = row.score;
        const level = document.createElement('span');
        level.className = 'start-leaderboard-level';
        level.textContent = row.level;
        item.append(rank, player, score, level);
        lunaNegraLeaderboardList.appendChild(item);
    });
}
async function fetchLunaNegraJson(url, options = {}) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.error || payload.message || `Luna Negra HTTP ${response.status}`);
    }
    return payload;
}
async function loadLunaNegraLeaderboard() {
    if (!showStartLunaNegraSection || !lunaNegraSession?.token) {
        return;
    }
    setLunaNegraStatus('CARGANDO LEADERBOARD LUNA NEGRA...', 'loading');
    clearLunaNegraLeaderboard();
    const payload = await fetchLunaNegraJson(buildLunaNegraLeaderboardUrl(LUNA_NEGRA_BASE_URL, LUNA_NEGRA_LEADERBOARD_NAME), {
        headers: { authorization: `Bearer ${lunaNegraSession.token}` }
    });
    const rows = buildLunaNegraLeaderboardRows(payload, STARTUP_LEADERBOARD_LIMIT);
    renderLunaNegraLeaderboardRows(rows);
    setLunaNegraStatus(rows.length > 0 ? `TOP ${rows.length} LUNA NEGRA` : 'SIN SCORES EN LUNA NEGRA', rows.length > 0 ? 'success' : 'idle');
}
async function initLunaNegraUI() {
    if (!showStartLunaNegraSection || !lunaNegraPanel) {
        return;
    }
    const token = getLunaNegraTokenFromSearch(window.location.search);
    if (!token) {
        setLunaNegraStatus('ABRÍ EL JUEGO DESDE LUNA NEGRA PARA INICIAR SESIÓN', 'idle');
        clearLunaNegraLeaderboard();
        renderLunaNegraLeaderboardRows([]);
        return;
    }
    setLunaNegraStatus('VALIDANDO SESIÓN LUNA NEGRA...', 'loading');
    try {
        const sessionPayload = await fetchLunaNegraJson(buildLunaNegraSessionUrl(LUNA_NEGRA_BASE_URL), {
            headers: { authorization: `Bearer ${token}` }
        });
        lunaNegraSession = normalizeLunaNegraSession(sessionPayload, token);
        renderLunaNegraPlayer(lunaNegraSession);
        history.replaceState(history.state, document.title, removeLunaNegraTokenFromUrl(window.location.href));
        await loadLunaNegraLeaderboard();
    }
    catch (error) {
        console.error('Luna Negra session error:', error);
        setLunaNegraStatus('ERROR DE SESIÓN LUNA NEGRA', 'error');
    }
}
async function publishLunaNegraScore(scoreSnapshot) {
    if (!showStartLunaNegraSection || !lunaNegraSession?.token) {
        return;
    }
    try {
        await fetchLunaNegraJson(buildLunaNegraScoresUrl(LUNA_NEGRA_BASE_URL, LUNA_NEGRA_LEADERBOARD_NAME), {
            method: 'POST',
            headers: {
                authorization: `Bearer ${lunaNegraSession.token}`,
                'content-type': 'application/json'
            },
            body: JSON.stringify({ score: scoreSnapshot.finalScore })
        });
        setLunaNegraStatus('PUNTAJE ENVIADO A LUNA NEGRA', 'success');
        await loadLunaNegraLeaderboard();
    }
    catch (error) {
        console.error('Luna Negra score publish error:', error);
        setLunaNegraStatus('NO SE PUDO ENVIAR PUNTAJE A LUNA NEGRA', 'error');
    }
}

function parseLedgerAmount(event) {
    const amount = Number.parseInt(event.tags.find((tag) => tag[0] === 'amount')?.[1] || '0', 10);
    return Number.isFinite(amount) ? amount : 0;
}
function parseLedgerTimestamp(event) {
    const taggedTimestamp = Number.parseInt(event.tags.find((tag) => tag[0] === 'timestamp')?.[1] || '0', 10);
    if (Number.isFinite(taggedTimestamp) && taggedTimestamp > 0) {
        return taggedTimestamp;
    }
    return event.created_at || 0;
}
function parseJackpotLedgerEvents(events) {
    return (events || [])
        .filter((event) => event.kind === JACKPOT_LEDGER_KIND)
        .filter((event) => event.tags.some((tag) => tag[0] === 'ledger' && tag[1] === 'jackpot'))
        .map((event) => ({
        amountSats: parseLedgerAmount(event),
        createdAt: parseLedgerTimestamp(event),
        playerPubkey: event.tags.find((tag) => tag[0] === 'player')?.[1] || '',
        pubkey: event.pubkey,
        receiptId: event.tags.find((tag) => tag[0] === 'receipt')?.[1] || '',
        type: event.tags.find((tag) => tag[0] === 'type')?.[1] === 'jackpot-claim' ? 'jackpot-claim' : 'entry-loss'
    }));
}
async function fetchLnurlPayConfig(lightningAddress) {
    const [name, domain] = lightningAddress.split('@');
    if (!name || !domain) {
        throw new Error(`Lightning address inválida: ${lightningAddress}`);
    }
    const lnurlUrl = new URL(`/.well-known/lnurlp/${name}`, `https://${domain}`).toString();
    const response = await fetch(lnurlUrl);
    const lnurlData = await response.json();
    if (!lnurlData?.allowsNostr || !lnurlData?.callback || !lnurlData?.nostrPubkey) {
        throw new Error('El proveedor LNURL del juego no soporta zaps Nostr.');
    }
    return {
        callback: lnurlData.callback,
        providerPubkey: lnurlData.nostrPubkey,
    };
}

async function loadZapConfigurationForPubkey(targetPubkey) {
    const pool = new window.NostrTools.SimplePool();
    try {
        const events = await pool.querySync(NOSTR_SCORE_RELAYS, {
            authors: [targetPubkey],
            kinds: [0],
            limit: 1,
        });
        const profileEvent = (events || []).sort((left, right) => right.created_at - left.created_at)[0];
        if (!profileEvent) {
            throw new Error('El perfil Nostr del juego no publica metadata.');
        }
        const profile = JSON.parse(profileEvent.content || '{}');
        if (!profile.lud16 || typeof profile.lud16 !== 'string' || !profile.lud16.includes('@')) {
            throw new Error('El perfil del juego no publica un lud16 válido para zaps.');
        }
        const lnurlConfig = await fetchLnurlPayConfig(profile.lud16);
        return {
            ...lnurlConfig,
            profileEvent,
        };
    }
    finally {
        if (typeof pool.close === 'function') {
            pool.close(NOSTR_SCORE_RELAYS);
        }
    }
}
async function loadGameZapConfiguration() {
    if (gameLightningAddress) {
        return fetchLnurlPayConfig(gameLightningAddress);
    }
    return loadZapConfigurationForPubkey(NOSTR_GAME_PUBKEY);
}
function signUnsignedNostrEvent(unsignedEvent) {
    if (playerNostrPrivateKey) {
        return Promise.resolve(window.NostrTools.finalizeEvent(unsignedEvent, playerNostrPrivateKey));
    }
    if (typeof window.nostr?.signEvent === 'function') {
        return window.nostr.signEvent(unsignedEvent);
    }
    throw new Error('No hay firmador Nostr disponible para esta operación.');
}
function buildJackpotLedgerEvent(type, amountSats) {
    const now = Math.floor(Date.now() / 1000);
    return {
        kind: JACKPOT_LEDGER_KIND,
        content: JSON.stringify({
            amountSats,
            game: 'sammer',
            receiptId: entryGateState.verifiedReceiptId,
            sessionId: pendingEntryZapSessionId,
            type,
        }),
        created_at: now,
        tags: [
            ['d', `sammer-jackpot-${type}-${now}`],
            ['game', 'sammer'],
            ['ledger', 'jackpot'],
            ['type', type],
            ['amount', String(amountSats)],
            ['p', NOSTR_GAME_PUBKEY],
            ['player', playerNostrPubkey || ''],
            ['receipt', entryGateState.verifiedReceiptId],
            ['timestamp', String(now)],
        ],
        pubkey: playerNostrPubkey,
    };
}
async function loadCurrentJackpot() {
    if (!showStartZapAccess || !entryGatePanel) {
        return;
    }
    try {
        const response = await fetch('/api/jackpot/status');
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || 'No se pudo cargar el estado del jackpot.');
        }
        jackpotBackendConfigured = Boolean(payload.configured);
        currentJackpotSats = Number.isFinite(payload.currentPotSats) ? payload.currentPotSats : 0;
        const statusFeeSats = Number(payload.entryFeeSats);
        if (Number.isFinite(statusFeeSats) && statusFeeSats > 0 && statusFeeSats !== entryFeeSats) {
            entryFeeSats = statusFeeSats;
            entryGateState = createEntryGateState(entryFeeSats);
        }
        const statusLightning = typeof payload.lightningAddress === 'string' ? payload.lightningAddress.trim() : '';
        if (statusLightning && statusLightning !== gameLightningAddress) {
            gameLightningAddress = statusLightning;
        }
        updateEntryGateUI();
    }
    catch (error) {
        console.error('Jackpot ledger error:', error);
        jackpotBackendConfigured = false;
        currentJackpotSats = 0;
        updateEntryGateUI();
    }
}
async function requestEntryInvoice() {
    if (!playerNostrPubkey) {
        showFeedback('CONECTA NOSTR PRIMERO');
        updateEntryGateUI();
        return;
    }
    entryGateState.status = 'paying';
    entryGateState.lastError = '';
    entryGateState.invoice = '';
    updateEntryGateUI();
    try {
        if (typeof window.NostrTools?.nip57?.makeZapRequest !== 'function') {
            throw new Error('El bundle Nostr actual no soporta NIP-57.');
        }
        const zapConfig = await loadGameZapConfiguration();
        const amountMillisats = entryFeeSats * 1000;
        const zapRequest = window.NostrTools.nip57.makeZapRequest({
            amount: amountMillisats,
            comment: 'Sammer entry fee',
            pubkey: NOSTR_GAME_PUBKEY,
            relays: NOSTR_SCORE_RELAYS,
        });
        const signedZapRequest = await signUnsignedNostrEvent(zapRequest);
        const response = await fetch(`${zapConfig.callback}?amount=${amountMillisats}&nostr=${encodeURIComponent(JSON.stringify(signedZapRequest))}`);
        const invoiceData = await response.json();
        if (!invoiceData?.pr || typeof invoiceData.pr !== 'string') {
            throw new Error('El proveedor LNURL no devolvió una factura usable.');
        }
        pendingEntryZapRequest = signedZapRequest;
        pendingEntryZapProviderPubkey = zapConfig.providerPubkey;
        pendingEntryZapSessionId = `${playerNostrPubkey}-${Date.now()}`;
        entryGateState.invoice = invoiceData.pr;
        entryGateState.invoiceAmountSats = entryFeeSats;
        entryGateState.status = 'invoice-ready';
        updateEntryGateUI();
        if (window.webln) {
            try {
                await window.webln.enable();
                await window.webln.sendPayment(invoiceData.pr);
            }
            catch (error) {
                console.error('WebLN payment error:', error);
            }
        }
        showFeedback('FACTURA ZAP GENERADA');
        startAutoVerification();
    }
    catch (error) {
        console.error('Entry invoice error:', error);
        entryGateState.status = 'error';
        entryGateState.lastError = error.message || 'NO SE PUDO GENERAR LA FACTURA ZAP';
    }
    finally {
        updateEntryGateUI();
    }
}
function parseZapDescription(receipt) {
    const descriptionTag = receipt.tags.find((tag) => tag[0] === 'description')?.[1];
    if (!descriptionTag) {
        return null;
    }
    try {
        return JSON.parse(descriptionTag);
    }
    catch {
        return null;
    }
}
function isMatchingEntryReceipt(receipt) {
    if (!pendingEntryZapRequest || !pendingEntryZapProviderPubkey) {
        return false;
    }
    if (receipt.pubkey !== pendingEntryZapProviderPubkey) {
        return false;
    }
    if (typeof window.NostrTools?.nip57?.getSatoshisAmountFromBolt11 !== 'function') {
        return false;
    }
    const description = parseZapDescription(receipt);
    if (!description || description.kind !== 9734 || description.pubkey !== playerNostrPubkey) {
        return false;
    }
    const recipientTag = description.tags?.find((tag) => tag[0] === 'p')?.[1];
    const amountTag = description.tags?.find((tag) => tag[0] === 'amount')?.[1];
    const invoiceTag = receipt.tags.find((tag) => tag[0] === 'bolt11')?.[1] || '';
    const receiptAmount = window.NostrTools.nip57.getSatoshisAmountFromBolt11(invoiceTag);
    return recipientTag === NOSTR_GAME_PUBKEY
        && amountTag === String(entryFeeSats * 1000)
        && invoiceTag === entryGateState.invoice
        && description.id === pendingEntryZapRequest.id
        && receiptAmount === entryFeeSats;
}
function isMatchingPayoutReceipt(receipt, signedZapRequest, invoice, winnerPubkey, providerPubkey, amountSats) {
    if (receipt.pubkey !== providerPubkey) {
        return false;
    }
    if (typeof window.NostrTools?.nip57?.getSatoshisAmountFromBolt11 !== 'function') {
        return false;
    }
    const description = parseZapDescription(receipt);
    if (!description || description.kind !== 9734 || description.pubkey !== NOSTR_GAME_PUBKEY) {
        return false;
    }
    const recipientTag = description.tags?.find((tag) => tag[0] === 'p')?.[1];
    const amountTag = description.tags?.find((tag) => tag[0] === 'amount')?.[1];
    const invoiceTag = receipt.tags.find((tag) => tag[0] === 'bolt11')?.[1] || '';
    const receiptAmount = window.NostrTools.nip57.getSatoshisAmountFromBolt11(invoiceTag);
    return recipientTag === winnerPubkey
        && amountTag === String(amountSats * 1000)
        && invoiceTag === invoice
        && description.id === signedZapRequest.id
        && receiptAmount === amountSats;
}
function stopAutoVerification() {
    if (pendingVerificationTimer) {
        clearInterval(pendingVerificationTimer);
        pendingVerificationTimer = 0;
    }
    pendingVerificationDeadline = 0;
}

function startAutoVerification() {
    stopAutoVerification();
    entryGateState.status = 'verifying';
    entryGateState.lastError = '';
    pendingVerificationDeadline = Date.now() + ENTRY_VERIFICATION_TIMEOUT_MS;
    updateEntryGateUI();
    void attemptVerifyOnce();
    pendingVerificationTimer = setInterval(() => {
        void attemptVerifyOnce();
    }, ENTRY_VERIFICATION_INTERVAL_MS);
}

async function attemptVerifyOnce() {
    if (entryGateState.status !== 'verifying' || !entryGateState.invoice) {
        stopAutoVerification();
        return;
    }
    if (Date.now() > pendingVerificationDeadline) {
        stopAutoVerification();
        entryGateState.status = 'error';
        entryGateState.lastError = 'TIEMPO AGOTADO ESPERANDO EL PAGO. VOLVÉ A GENERAR LA FACTURA.';
        updateEntryGateUI();
        return;
    }
    const pool = new window.NostrTools.SimplePool();
    try {
        const receipts = await pool.querySync(NOSTR_SCORE_RELAYS, {
            kinds: [9735],
            '#p': [NOSTR_GAME_PUBKEY],
            limit: 50,
        });
        const matchingReceipt = (receipts || [])
            .sort((left, right) => right.created_at - left.created_at)
            .find((receipt) => isMatchingEntryReceipt(receipt));
        if (!matchingReceipt) {
            return;
        }
        stopAutoVerification();
        entryGateState.status = 'verifying';
        entryGateState.verifiedReceiptId = matchingReceipt.id;
        updateEntryGateUI();
        const verifyResponse = await fetch('/api/jackpot/verify-zap', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ playerPubkey: playerNostrPubkey, receiptId: matchingReceipt.id }),
        });
        const verifyPayload = await verifyResponse.json();
        if (!verifyResponse.ok || !verifyPayload.ok) {
            throw new Error(verifyPayload.error || 'El backend no pudo verificar el zap de entrada.');
        }
        entryGateState.isPaid = true;
        entryGateState.status = 'paid';
        updateEntryGateUI();
        await loadCurrentJackpot();
        showFeedback('ENTRADA VERIFICADA');
    }
    catch (error) {
        console.error('Verify entry receipt error:', error);
        stopAutoVerification();
        entryGateState.status = 'error';
        entryGateState.lastError = error.message || 'NO SE PUDO VERIFICAR EL ZAP';
        if (typeof pool.close === 'function') {
            pool.close(NOSTR_SCORE_RELAYS);
        }
        updateEntryGateUI();
        return;
    }
    if (typeof pool.close === 'function') {
        pool.close(NOSTR_SCORE_RELAYS);
    }
}

async function claimLeaderboardJackpot() {
    if (!pendingDeathJackpotClaim || !playerNostrPubkey) {
        return;
    }
    const winnerLightningAddress = deathLnAddress?.value.trim() || '';
    if (!winnerLightningAddress || !winnerLightningAddress.includes('@')) {
        setDeathJackpotStatus('Ingresá una Lightning Address válida para cobrar.', 'error');
        deathLnAddress?.focus();
        return;
    }
    try {
        deathClaimBtn?.setAttribute('disabled', 'true');
        setDeathJackpotStatus('ENVIANDO JACKPOT...', 'loading');
        const response = await fetch('/api/jackpot/claim', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                receiptId: pendingDeathJackpotClaim.receiptId,
                scoreProof: pendingDeathJackpotClaim.scoreProof,
                winnerLightningAddress,
                winnerPubkey: playerNostrPubkey,
            }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
            throw new Error(payload.error || 'El backend no pudo ejecutar el payout del jackpot.');
        }
        setDeathJackpotStatus(`JACKPOT ENVIADO: ${payload.currentPotSats || pendingDeathJackpotClaim.amountSats} SATS.`, 'success');
        showFeedback(`JACKPOT ENVIADO: ${payload.currentPotSats || pendingDeathJackpotClaim.amountSats} SATS`);
        pendingDeathJackpotClaim = null;
        resetEntryGateState();
        await loadCurrentJackpot();
    }
    catch (error) {
        console.error('Leaderboard jackpot claim error:', error);
        deathClaimBtn?.removeAttribute('disabled');
        setDeathJackpotStatus(error.message || 'No se pudo enviar el jackpot.', 'error');
        showFeedback('NO SE PUDO ENVIAR EL JACKPOT');
    }
}
async function reportPaidRunLoss(receiptId) {
    const response = await fetch('/api/jackpot/report-loss', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerPubkey: playerNostrPubkey, receiptId }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'El backend no pudo registrar la derrota.');
    }
    await loadCurrentJackpot();
}
async function settlePaidRunAfterDeath(scorePublishResult, receiptId) {
    try {
        if (scorePublishResult.nostrScoreEvent && await isLeaderboardTopScore(scorePublishResult.nostrScoreEvent)) {
            if (currentJackpotSats > 0) {
                renderDeathJackpotWinner(currentJackpotSats, scorePublishResult.scoreSnapshot, scorePublishResult.nostrScoreEvent, receiptId);
                return;
            }
            renderDeathLeaderboardTopWithoutPot(scorePublishResult.scoreSnapshot);
            resetEntryGateState();
            return;
        }
        await reportPaidRunLoss(receiptId);
        resetEntryGateState();
    }
    catch (error) {
        console.error('Paid run settlement error:', error);
        await reportPaidRunLoss(receiptId).catch(reportError => console.error('Jackpot loss publish error:', reportError));
        resetEntryGateState();
    }
}
async function finalizeBossJackpotVictory(victoryMessageElement) {
    const baseMessage = 'Has escapado de la instalación biológica, cruzado la selva hostil, sobrevivido al frío extremo de la montaña y purgado la amenaza volcánica.';
    if (victoryMessageElement) {
        victoryMessageElement.innerHTML = `${baseMessage}<br><br><strong>FIN DEL CAPÍTULO 1.</strong><br>El jackpot se evalúa al morir por posición #1 del scoreboard.`;
    }
    resetEntryGateState();
    updateEntryGateUI();
}
function handlePaidStart() {
    if (!canStartPaidRun(entryGateState)) {
        if (gameState === 'GAMEOVER' || gameState === 'VICTORY') {
            deathOverlay.classList.remove('active');
            victoryOverlay.classList.remove('active');
            menuOverlay.classList.add('active');
            void loadStartupLeaderboard();
            void loadCurrentJackpot();
        }
        showFeedback(`PAGA ${entryFeeSats} SATS PARA INICIAR`);
        updateEntryGateUI();
        return;
    }
    startGame();
}
async function publishNostrScore(scoreSnapshot) {
    try {
        if (!playerNostrPubkey) {
            return null;
        }
        const now = Math.floor(Date.now() / 1000);
        const useDelegation = isDelegationActive(activeDelegation);
        const signerPubkey = useDelegation ? activeDelegation.delegateePubkey : playerNostrPubkey;
        const tags = [
            ['d', `sammer-score-${currentLevel}-${now}`],
            ['game', 'sammer'],
            ['p', NOSTR_GAME_PUBKEY],
            ['p', playerNostrPubkey],
            ['player', playerNostrPubkey],
            ['score', scoreSnapshot.finalScore.toString()],
            ['level', currentLevel.toString()],
            ['timestamp', now.toString()],
            ['kills', JSON.stringify(scoreSnapshot.kills)],
            ['damage', scoreSnapshot.damageTaken.toString()],
            ['seconds', scoreSnapshot.elapsedSeconds.toString()]
        ];
        if (entryGateState.isPaid && entryGateState.verifiedReceiptId) {
            tags.push(['receipt', entryGateState.verifiedReceiptId]);
        }
        if (useDelegation) {
            tags.push(buildDelegationTag(activeDelegation));
        }
        const unsignedEvent = {
            kind: 78,
            content: JSON.stringify({
                game: 'sammer',
                score: scoreSnapshot.finalScore,
                level: currentLevel,
                timestamp: now,
                kills: scoreSnapshot.kills,
                damage: scoreSnapshot.damageTaken,
                seconds: scoreSnapshot.elapsedSeconds
            }),
            created_at: now,
            tags,
            pubkey: signerPubkey
        };
        let signedEvent;
        if (useDelegation) {
            signedEvent = window.NostrTools.finalizeEvent(unsignedEvent, activeDelegation.delegateePrivateKey);
        }
        else if (playerNostrPrivateKey) {
            signedEvent = window.NostrTools.finalizeEvent(unsignedEvent, playerNostrPrivateKey);
        }
        else if (typeof window.nostr?.signEvent === 'function') {
            signedEvent = await window.nostr.signEvent(unsignedEvent);
        }
        else {
            throw new Error('No Nostr signer available for score publishing');
        }
        const pool = new window.NostrTools.SimplePool();
        const publishResults = await Promise.allSettled(pool.publish(NOSTR_SCORE_RELAYS, signedEvent));
        pool.close(NOSTR_SCORE_RELAYS);
        const successfulPublishes = publishResults.filter((result) => result.status === 'fulfilled' && result.value === '');
        if (successfulPublishes.length === 0) {
            throw new Error('Failed to publish score to configured relays');
        }
        console.log('Score published:', signedEvent.id, publishResults);
        showFeedback('PUNTAJE PUBLICADO EN NOSTR');
        return signedEvent;
    }
    catch (error) {
        console.error('Publish score error:', error);
        showFeedback('NO SE PUDO PUBLICAR EL PUNTAJE');
        return null;
    }
}
async function publishScore() {
    const scoreSnapshot = createScorePublishSnapshot();
    const [nostrResult] = await Promise.allSettled([
        publishNostrScore(scoreSnapshot),
        publishLunaNegraScore(scoreSnapshot)
    ]);
    return {
        nostrScoreEvent: nostrResult.status === 'fulfilled' ? nostrResult.value : null,
        scoreSnapshot,
    };
}
// --- CONSTRUCTOR DE MAPA ---
function shouldPlaceLevelOneMazeLamp(x, z) {
    const awayFromStart = x >= LEVEL_ONE_LAMP_MIN_GRID_X && z >= LEVEL_ONE_LAMP_MIN_GRID_Z;
    const staggeredSpacing = (x + z) % LEVEL_ONE_LAMP_SPACING_MODULO === 0;
    return currentLevel === 1 && awayFromStart && staggeredSpacing;
}

function buildLevelOneMazeLamp(posX, posZ) {
    const lampHeight = WALL_HEIGHT - 0.18;
    const targetY = 0.35;
    const ceilingLight = new THREE.SpotLight(
        LEVEL_ONE_LAMP_COLOR,
        LEVEL_ONE_LAMP_INTENSITY,
        LEVEL_ONE_LAMP_DISTANCE,
        LEVEL_ONE_LAMP_ANGLE,
        LEVEL_ONE_LAMP_PENUMBRA,
        LEVEL_ONE_LAMP_DECAY
    );
    ceilingLight.position.set(posX, lampHeight, posZ);
    ceilingLight.target.position.set(posX, targetY, posZ);
    ceilingLight.castShadow = false;
    scene.add(ceilingLight);
    scene.add(ceilingLight.target);

    const lampGeo = new THREE.CylinderGeometry(0.24, 0.32, 0.16, 12);
    const lampMat = new THREE.MeshStandardMaterial({
        color: 0x372417,
        emissive: 0xff8a22,
        emissiveIntensity: 0.8,
        roughness: 0.45,
        metalness: 0.35
    });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(posX, WALL_HEIGHT - 0.08, posZ);
    scene.add(lamp);

    lights.push({
        light: ceilingLight,
        lamp: lamp,
        target: ceilingLight.target,
        color: LEVEL_ONE_LAMP_COLOR,
        isRed: false,
        baseIntensity: LEVEL_ONE_LAMP_INTENSITY,
        dimIntensity: LEVEL_ONE_LAMP_DIM_INTENSITY,
        flickerTimer: Math.random() * 10
    });
}

function buildMap3D() {
    builtMapLevel = currentLevel;
    const activeMap = getMapForLevel(currentLevel);
    const wallGeo = new THREE.BoxGeometry(GRID_SIZE, WALL_HEIGHT, GRID_SIZE);
    for (let z = 0; z < activeMap.length; z++) {
        for (let x = 0; x < activeMap[z].length; x++) {
            const type = activeMap[z][x];
            const posX = x * GRID_SIZE;
            const posZ = z * GRID_SIZE;
            // Suelo y techo para todas las celdas vacías/puertas
            if (type !== 1 || currentLevel === 2) {
                // Suelo
                const floorGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
                let currentFloorMat = floorMaterial;
                if (currentLevel === 2) {
                    if (!grassMaterial) {
                        grassMaterial = new THREE.ShaderMaterial({
                            uniforms: {
                                time: { value: 0.0 },
                                baseColor: { value: new THREE.Color(0x162c11) },
                                waveColor: { value: new THREE.Color(0x28471c) }
                            },
                            vertexShader: `
                                varying vec2 vUv;
                                void main() {
                                    vUv = uv;
                                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                                }
                            `,
                            fragmentShader: `
                                uniform float time;
                                uniform vec3 baseColor;
                                uniform vec3 waveColor;
                                varying vec2 vUv;
                                void main() {
                                    float noise = sin(vUv.x * 20.0 + time*1.5) * cos(vUv.y * 20.0 + time * 1.2);
                                    vec3 col = mix(baseColor, waveColor, noise * 0.5 + 0.5);
                                    gl_FragColor = vec4(col, 1.0);
                                }
                            `
                        });
                    }
                    currentFloorMat = grassMaterial;
                }
                const floorMesh = new THREE.Mesh(floorGeo, currentFloorMat);
                floorMesh.name = "map_floor";
                floorMesh.rotation.x = -Math.PI / 2;
                floorMesh.position.set(posX, 0, posZ);
                floorMesh.receiveShadow = true;
                scene.add(floorMesh);
                mapChunks.push({ zIndex: z, mesh: floorMesh });
                // Techo (excepto en la jungla)
                if (currentLevel !== 2) {
                    const ceilGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
                    const ceilMesh = new THREE.Mesh(ceilGeo, ceilingMaterial);
                    ceilMesh.name = "map_ceiling";
                    ceilMesh.rotation.x = Math.PI / 2;
                    ceilMesh.position.set(posX, WALL_HEIGHT, posZ);
                    ceilMesh.receiveShadow = true;
                    scene.add(ceilMesh);
                    mapChunks.push({ zIndex: z, mesh: ceilMesh });
                    
                    // Luces bioluminiscentes en techo (Nivel 3)
                    if (currentLevel === 3 && Math.random() < 0.02) {
                        const bioGroup = new THREE.Group();
                        bioGroup.name = "map_ceiling_light";
                        
                        // Hongo emisivo en el techo
                        const spotGeo = new THREE.SphereGeometry(0.1 + Math.random() * 0.15, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2);
                        const spotMat = new THREE.MeshStandardMaterial({
                            color: 0x44ffaa, emissive: 0x22cc66, emissiveIntensity: 1.2,
                            roughness: 0.2
                        });
                        const spot = new THREE.Mesh(spotGeo, spotMat);
                        spot.position.set(posX + (Math.random() - 0.5) * 1.5, WALL_HEIGHT - 0.05, posZ + (Math.random() - 0.5) * 1.5);
                        spot.rotation.x = Math.PI; // Mirando hacia abajo
                        bioGroup.add(spot);
                        
                        // Luz real
                        const bioLight = new THREE.Group(); // Eliminado PointLight
                        bioLight.position.copy(spot.position);
                        bioLight.position.y -= 0.1;
                        bioGroup.add(bioLight);
                        
                        scene.add(bioGroup);
                        mapChunks.push({ zIndex: z, mesh: bioGroup });
                        
                        // Add to array for cleanup if needed? Wait, clearCurrentMap clears by name 'map_ceiling' but not 'map_ceiling_light'. I should name it 'map_ceiling'.
                        bioGroup.name = "map_ceiling";
                    }
                }
            }
            // Paredes
            if (type === 1) {
                let collisionMesh = null;

                if (currentLevel === 2) {
                    // Generar múltiples árboles si estamos en los bordes para crear un bosque denso que tape el fondo
                    const isEdge = (x === 0 || x === activeMap[0].length - 1 || z === 0 || z === activeMap.length - 1);
                    const numTrees = isEdge ? 15 : 1;

                    for (let t = 0; t < numTrees; t++) {
                        const tPosX = (t === 0) ? posX : posX + (Math.random() - 0.5) * GRID_SIZE * (isEdge ? 2.5 : 0.9);
                        const tPosZ = (t === 0) ? posZ : posZ + (Math.random() - 0.5) * GRID_SIZE * (isEdge ? 2.5 : 0.9);

                        // --- ÁRBOL 3D PROCEDURAL ---
                        const treeGroup = new THREE.Group();
                        treeGroup.name = "map_tree";
                        treeGroup.position.set(tPosX, 0, tPosZ);

                        if (!barkMaterial) {
                            const barkTex = generateBarkTexture();
                            const barkNorm = createNormalMapFromCanvas(barkTex, 2.0);
                            const barkRough = createRoughnessMapFromCanvas(barkTex, 1.5, 0.1);
                            barkMaterial = new THREE.MeshStandardMaterial({
                                map: barkTex,
                                normalMap: barkNorm,
                                roughnessMap: barkRough
                            });

                            const leafTex = generateLeafTexture();
                            const leafNorm = createNormalMapFromCanvas(leafTex, 1.0);
                            const leafRough = createRoughnessMapFromCanvas(leafTex, 0.8, 0.2);
                            leafMaterial = new THREE.MeshStandardMaterial({
                                map: leafTex,
                                normalMap: leafNorm,
                                roughnessMap: leafRough,
                                alphaTest: 0.3,
                                side: THREE.DoubleSide,
                                transparent: true
                            });
                            leafMaterial.onBeforeCompile = (shader) => {
                                shader.uniforms.time = { value: 0 };
                                shader.vertexShader = `
                                    uniform float time;
                                    ` + shader.vertexShader;
                                shader.vertexShader = shader.vertexShader.replace(
                                    `#include <begin_vertex>`,
                                    `
                                    #include <begin_vertex>
                                    float sway = sin(time * 2.5 + position.x * 0.5 + position.z * 0.5) * 0.5;
                                    float strength = (position.y + 2.0) / 4.0;
                                    transformed.x -= sway * strength * 0.8 + (strength * 0.5);
                                    transformed.z += cos(time * 1.5 + position.x) * strength * 0.2;
                                    `
                                );
                                leafMaterialShader = shader;
                            };
                        }

                        // Tronco
                        const trunkRadius = 0.3 + Math.random() * 0.4;
                        const trunkHeight = WALL_HEIGHT + 1 + Math.random() * 4;
                        const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.6, trunkRadius, trunkHeight, 8);

                        const trunk = new THREE.Mesh(trunkGeo, barkMaterial);
                        trunk.position.y = trunkHeight / 2;
                        trunk.castShadow = true;
                        trunk.receiveShadow = true;
                        treeGroup.add(trunk);

                        // Follaje (Esferas interceptadas)
                        const leafCount = 3 + Math.floor(Math.random() * 4);
                        for (let i = 0; i < leafCount; i++) {
                            const leafSize = 2.0 + Math.random() * 2.5;
                            const leafGeo = new THREE.DodecahedronGeometry(leafSize, 1);
                            const leaf = new THREE.Mesh(leafGeo, leafMaterial);

                            leaf.position.y = trunkHeight - 1.0 + Math.random() * 2.5;
                            leaf.position.x = (Math.random() - 0.5) * 2.5;
                            leaf.position.z = (Math.random() - 0.5) * 2.5;

                            leaf.castShadow = true;
                            leaf.receiveShadow = true;
                            treeGroup.add(leaf);
                        }

                        scene.add(treeGroup);
                        mapChunks.push({ zIndex: z, mesh: treeGroup });
                    }
                    collisionMesh = null; // Árboles manejados manualmente
                } else {
                    // --- PARED ESTÁNDAR ---
                    let mat = wallMaterialStandard;
                    const rVal = Math.random();
                    if (rVal < 0.15) {
                        mat = wallMaterialHazard;
                    }
                    else if (rVal < 0.3) {
                        mat = wallMaterialBlood;
                    }
                    const wall = new THREE.Mesh(wallGeo, mat);
                    wall.name = "map_wall";
                    wall.position.set(posX, WALL_HEIGHT / 2, posZ);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    scene.add(wall);
                    mapChunks.push({ zIndex: z, mesh: wall });
                    collisionMesh = wall;
                }

                // Guardar colisionadores
                if (currentLevel === 2) {
                    colliders.push({
                        isTree: true,
                        posX: posX,
                        posZ: posZ
                    });
                } else {
                    colliders.push({
                        mesh: collisionMesh,
                        minX: posX - GRID_SIZE / 2,
                        maxX: posX + GRID_SIZE / 2,
                        minZ: posZ - GRID_SIZE / 2,
                        maxZ: posZ + GRID_SIZE / 2
                    });
                }
            }
            else if (type === 2) {
                if (currentLevel === 2) {
                    const exitGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
                    const exitMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3 });
                    const exitMesh = new THREE.Mesh(exitGeo, exitMat);
                    exitMesh.position.set(posX, 0.1, posZ);
                    exitMesh.rotation.x = -Math.PI / 2;
                    scene.add(exitMesh);

                    const exitLight = new THREE.PointLight(0x00ff00, 2, 20);
                    exitLight.position.set(posX, 3, posZ);
                    scene.add(exitLight);

                    colliders.push({
                        mesh: exitMesh,
                        isExit: true,
                        unlocked: true,
                        minX: posX - GRID_SIZE / 2,
                        maxX: posX + GRID_SIZE / 2,
                        minZ: posZ - GRID_SIZE / 2,
                        maxZ: posZ + GRID_SIZE / 2
                    });
                } else {
                    const doorGeo = new THREE.BoxGeometry(GRID_SIZE, WALL_HEIGHT, 0.4);
                    const door = new THREE.Mesh(doorGeo, doorMaterial);
                    door.name = "map_wall";
                    door.position.set(posX, WALL_HEIGHT / 2, posZ);
                    door.castShadow = true;
                    door.receiveShadow = true;
                    scene.add(door);
                    colliders.push({
                        mesh: door,
                        isExit: true,
                        minX: posX - GRID_SIZE / 2,
                        maxX: posX + GRID_SIZE / 2,
                        minZ: posZ - 0.2,
                        maxZ: posZ + 0.2
                    });
                    buildFuseBox3D(posX, posZ);
                    // Las cajas de fusibles no se ocultan dinámicamente porque son críticas
                }
            }
            else if (type === 3) {
                let spanZ = false;
                if (z > 0 && z < activeMap.length - 1) {
                    const cellAbove = activeMap[z - 1][x];
                    const cellBelow = activeMap[z + 1][x];
                    if (cellAbove === 1 && cellBelow === 1) {
                        spanZ = true;
                    }
                }
                const width = spanZ ? 0.45 : GRID_SIZE;
                const depth = spanZ ? GRID_SIZE : 0.45;
                const doorGeo = new THREE.BoxGeometry(width, WALL_HEIGHT, depth);
                const interactiveDoorMat = new THREE.MeshStandardMaterial({ map: generateWallTexture(4), roughness: 0.6, metalness: 0.4 });
                const door = new THREE.Mesh(doorGeo, interactiveDoorMat);
                door.name = "map_wall";
                door.position.set(posX, WALL_HEIGHT / 2, posZ);
                door.castShadow = true;
                door.receiveShadow = true;
                scene.add(door);
                const doorCollider = {
                    mesh: door,
                    isInteractive: true,
                    isOpen: false,
                    state: 'CLOSED',
                    gridX: x,
                    gridZ: z,
                    spanZ: spanZ,
                    minX: posX - width / 2,
                    maxX: posX + width / 2,
                    minZ: posZ - depth / 2,
                    maxZ: posZ + depth / 2
                };
                colliders.push(doorCollider);
                interactiveDoors.push(doorCollider);
            }
            if (type === 0 && shouldPlaceLevelOneMazeLamp(x, z)) {
                buildLevelOneMazeLamp(posX, posZ);
            }
            else if (type === 0 && currentLevel !== 1 && currentLevel !== 2) {
                const lampSpawnChance = currentLevel === 3 ? LEVEL_THREE_LAMP_SPAWN_CHANCE : 0.08;
                const lampMinGridX = currentLevel === 3 ? LEVEL_THREE_LAMP_MIN_GRID_X : 3;
                const lampMinGridZ = currentLevel === 3 ? LEVEL_THREE_LAMP_MIN_GRID_Z : 3;
                if (Math.random() < lampSpawnChance && z >= lampMinGridZ && x >= lampMinGridX) {
                    const blueChance = currentLevel === 3 ? LEVEL_THREE_LAMP_BLUE_CHANCE : 0.35;
                    const isBlueOrRed = Math.random() < blueChance;
                    const lightColor = currentLevel === 3
                        ? (isBlueOrRed ? LEVEL_THREE_LAMP_BLUE_COLOR : LEVEL_THREE_LAMP_WHITE_COLOR)
                        : (isBlueOrRed ? 0xff0000 : 0xffaa44);
                    const lightIntensity = currentLevel === 3 ? LEVEL_THREE_LAMP_INTENSITY : 1.2;
                    const lightDistance = currentLevel === 3 ? LEVEL_THREE_LAMP_DISTANCE : 8;
                    const lightDecay = currentLevel === 3 ? LEVEL_THREE_LAMP_DECAY : 1.5;
                    const lampMaterialColor = currentLevel === 3
                        ? (isBlueOrRed ? LEVEL_THREE_LAMP_BLUE_MATERIAL_COLOR : LEVEL_THREE_LAMP_WHITE_MATERIAL_COLOR)
                        : (isBlueOrRed ? 0x880000 : 0xe59400);
                    const ceilingLight = new THREE.PointLight(lightColor, lightIntensity, lightDistance, lightDecay);
                    ceilingLight.position.set(posX, WALL_HEIGHT - 0.2, posZ);
                    ceilingLight.castShadow = false;
                    ceilingLight.shadow.bias = -0.002;
                    scene.add(ceilingLight);
                    const lampGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8);
                    const lampMat = new THREE.MeshBasicMaterial({ color: lampMaterialColor });
                    const lamp = new THREE.Mesh(lampGeo, lampMat);
                    lamp.position.set(posX, WALL_HEIGHT - 0.025, posZ);
                    scene.add(lamp);
                    lights.push({
                        light: ceilingLight,
                        lamp: lamp,
                        color: lightColor,
                        isRed: isBlueOrRed,
                        baseIntensity: lightIntensity,
                        dimIntensity: currentLevel === 3 ? LEVEL_THREE_LAMP_DIM_INTENSITY : undefined,
                        flickerTimer: Math.random() * 10
                    });
                }
            }
        }
    }
}
// --- LIMPIEZA DE MAPA Y AMBIENTACIÓN ---
function clearCurrentMap() {
    const toRemove = [];
    scene.traverse((child) => {
        if (child.name === "map_floor" || child.name === "map_ceiling" || child.name === "map_wall" || child.name === "map_tree" || child.name === "map_snow") {
            toRemove.push(child);
        }
        if (child.isMesh && child.geometry && child.geometry.type === 'PlaneGeometry' && child.name !== 'map_floor' && child.name !== 'map_ceiling') {
            toRemove.push(child);
        }
    });
    toRemove.forEach(mesh => {
        scene.remove(mesh);
        if (mesh.geometry)
            mesh.geometry.dispose();
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            }
            else {
                mesh.material.dispose();
            }
        }
    });
    lights.forEach(item => {
        scene.remove(item.light);
        scene.remove(item.lamp);
        if (item.target)
            scene.remove(item.target);
        if (item.lamp.geometry)
            item.lamp.geometry.dispose();
        if (item.lamp.material)
            item.lamp.material.dispose();
    });
    lights = [];
    if (fuseBoxConsole && fuseBoxConsole.group) {
        scene.remove(fuseBoxConsole.group);
        fuseBoxConsole.group.traverse(child => {
            if (child.geometry)
                child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                }
                else {
                    child.material.dispose();
                }
            }
        });
        fuseBoxConsole = null;
    }
    if (grassInstancedMesh) {
        scene.remove(grassInstancedMesh);
        if (grassInstancedMesh.geometry) grassInstancedMesh.geometry.dispose();
        if (grassInstancedMesh.material) grassInstancedMesh.material.dispose();
        grassInstancedMesh = null;
        grassMaterialShader = null;
    }
    if (cloudMesh) {
        scene.remove(cloudMesh);
        if (cloudMesh.geometry) cloudMesh.geometry.dispose();
        if (cloudMesh.material) cloudMesh.material.dispose();
        cloudMesh = null;
    }
    colliders = [];
    interactiveDoors = [];
    mapChunks = [];
    builtMapLevel = null;
}
function updateLevelEnvironment() {
    activeMap = getMapForLevel(currentLevel);
    let fogColor, fogDensity;
    let wallTex, wallHazardTex, wallBloodTex;
    let floorTex, ceilingTex;
    let hemiSkyColor, hemiGroundColor, hemiIntensity;
    let toneExposure;
    if (currentLevel === 2) {
        fogColor = 0x2c3e38;
        fogDensity = 0.02;
        wallTex = generateJungleWallTexture();
        wallHazardTex = generateJungleWallTexture();
        wallBloodTex = generateJungleWallTexture();
        floorTex = generateJungleFloorTexture();
        ceilingTex = generateJungleCeilingTexture();
        hemiSkyColor = 0x334433;
        hemiGroundColor = 0x081008;
        hemiIntensity = 0.45;
        toneExposure = 0.9;
    }
    else if (currentLevel === 3) {
        fogColor = LEVEL_THREE_FOG_COLOR;
        fogDensity = LEVEL_THREE_FOG_DENSITY;
        wallTex = generateMountainWallTexture();
        wallHazardTex = generateMountainWallTexture();
        wallBloodTex = generateMountainWallTexture();
        floorTex = generateMountainFloorTexture();
        ceilingTex = generateMountainCeilingTexture();
        hemiSkyColor = LEVEL_THREE_HEMI_SKY_COLOR;
        hemiGroundColor = LEVEL_THREE_HEMI_GROUND_COLOR;
        hemiIntensity = LEVEL_THREE_HEMI_INTENSITY;
        toneExposure = LEVEL_THREE_TONE_EXPOSURE;
        if (bloomPass) {
            bloomPass.threshold = 0.3; // Catch bioluminescent glow
            bloomPass.strength = 1.6; // Intense mushroom/crystal glow
        }
    }
    else if (currentLevel === 4) {
        fogColor = 0x210404; // Deep dark red
        fogDensity = 0.035; // Thicker fog for heat illusion
        wallTex = generateInfernalWallTexture();
        wallHazardTex = generateInfernalWallTexture();
        wallBloodTex = generateInfernalWallTexture();
        floorTex = generateInfernalFloorTexture();
        ceilingTex = generateInfernalCeilingTexture();
        hemiSkyColor = 0x551111;
        hemiGroundColor = 0x330000;
        hemiIntensity = 0.8;
        toneExposure = 0.8; // Darker base so emissive lava pops
        if (bloomPass) {
            bloomPass.threshold = 0.3; // Catch the glowing cracks
            bloomPass.strength = 1.8; // Intense lava glow!
        }
    }
    else {
        fogColor = 0x050508;
        fogDensity = 0.075;
        wallTex = generateWallTexture(0);
        wallHazardTex = generateWallTexture(1);
        wallBloodTex = generateWallTexture(2);
        floorTex = generateFloorTexture();
        ceilingTex = generateCeilingTexture();
        hemiSkyColor = 0x111122;
        hemiGroundColor = 0x080810;
        hemiIntensity = 0.3;
        toneExposure = 1.1;
        if (bloomPass) {
            bloomPass.threshold = 0.6;
            bloomPass.strength = 0.9;
        }
    }

    if (currentLevel === 2) {
        if (!sunLight) {
            sunLight = new THREE.DirectionalLight(0xffffff, 0.5);
            sunLight.position.set(60, 100, 60);
            sunLight.castShadow = true;
            sunLight.shadow.mapSize.width = 1024;
            sunLight.shadow.mapSize.height = 1024;
            sunLight.shadow.camera.near = 10;
            sunLight.shadow.camera.far = 300;
            sunLight.shadow.camera.left = -60;
            sunLight.shadow.camera.right = 60;
            sunLight.shadow.camera.top = 60;
            sunLight.shadow.camera.bottom = -60;
            sunLight.shadow.bias = -0.001;
            scene.add(sunLight);
        }
        sunLight.color.setHex(0x778899);
        sunLight.intensity = 0.5;
    } else if (sunLight) {
        scene.remove(sunLight);
        sunLight.dispose();
        sunLight = null;
    }

    if (scene.fog) {
        scene.fog.color.setHex(fogColor);
        scene.fog.density = fogDensity;
    }
    renderer.setClearColor(fogColor);
    renderer.toneMappingExposure = toneExposure;
    if (hemisphereLight) {
        hemisphereLight.color.setHex(hemiSkyColor);
        hemisphereLight.groundColor.setHex(hemiGroundColor);
        hemisphereLight.intensity = hemiIntensity;
    }
    if (wallMaterialStandard) {
        wallMaterialStandard.map = wallTex;
        if (currentLevel === 4) {
            wallMaterialStandard.emissiveMap = wallTex;
            wallMaterialStandard.emissive = new THREE.Color(0xff4400);
            wallMaterialStandard.emissiveIntensity = 1.8;
        } else {
            wallMaterialStandard.emissiveMap = null;
            wallMaterialStandard.emissive.setHex(0x000000);
        }
        if (typeof createNormalMapFromCanvas !== 'undefined') {
            wallMaterialStandard.normalMap = createNormalMapFromCanvas(wallTex, currentLevel === 2 ? 1.0 : 3.0);
            wallMaterialStandard.roughnessMap = createRoughnessMapFromCanvas(wallTex, 1.2, 0.1);
        }
        wallMaterialStandard.needsUpdate = true;
    }
    if (wallMaterialHazard) {
        wallMaterialHazard.map = wallHazardTex;
        if (currentLevel === 4) {
            wallMaterialHazard.emissiveMap = wallHazardTex;
            wallMaterialHazard.emissive = new THREE.Color(0xff4400);
            wallMaterialHazard.emissiveIntensity = 1.8;
        } else {
            wallMaterialHazard.emissiveMap = null;
            wallMaterialHazard.emissive.setHex(0x000000);
        }
        if (typeof createNormalMapFromCanvas !== 'undefined') {
            wallMaterialHazard.normalMap = createNormalMapFromCanvas(wallHazardTex, currentLevel === 2 ? 1.0 : 2.5);
            wallMaterialHazard.roughnessMap = createRoughnessMapFromCanvas(wallHazardTex, 1.0, 0.2);
        }
        wallMaterialHazard.needsUpdate = true;
    }
    if (wallMaterialBlood) {
        wallMaterialBlood.map = wallBloodTex;
        if (currentLevel === 4) {
            wallMaterialBlood.emissiveMap = wallBloodTex;
            wallMaterialBlood.emissive = new THREE.Color(0xff4400);
            wallMaterialBlood.emissiveIntensity = 1.8;
        } else {
            wallMaterialBlood.emissiveMap = null;
            wallMaterialBlood.emissive.setHex(0x000000);
        }
        if (typeof createNormalMapFromCanvas !== 'undefined') {
            wallMaterialBlood.normalMap = createNormalMapFromCanvas(wallBloodTex, currentLevel === 2 ? 1.0 : 3.0);
            wallMaterialBlood.roughnessMap = createRoughnessMapFromCanvas(wallBloodTex, 2.0, -0.2);
        }
        wallMaterialBlood.needsUpdate = true;
    }
    if (floorMaterial) {
        floorMaterial.map = floorTex;
        if (currentLevel === 4) {
            floorMaterial.emissiveMap = floorTex;
            floorMaterial.emissive = new THREE.Color(0xff4400);
            floorMaterial.emissiveIntensity = 1.5;
        } else {
            floorMaterial.emissiveMap = null;
            floorMaterial.emissive.setHex(0x000000);
        }
        if (typeof createNormalMapFromCanvas !== 'undefined') {
            floorMaterial.normalMap = createNormalMapFromCanvas(floorTex, currentLevel === 2 ? 1.5 : 2.5);
            floorMaterial.roughnessMap = createRoughnessMapFromCanvas(floorTex, currentLevel === 2 ? 1.8 : 1.5, currentLevel === 2 ? 0.2 : 0.2);
        }
        floorMaterial.needsUpdate = true;
    }
    if (ceilingMaterial) {
        ceilingMaterial.map = ceilingTex;
        if (typeof createNormalMapFromCanvas !== 'undefined') {
            ceilingMaterial.normalMap = createNormalMapFromCanvas(ceilingTex, currentLevel === 2 ? 0.5 : 1.0);
            ceilingMaterial.roughnessMap = createRoughnessMapFromCanvas(ceilingTex, 0.8, 0.3);
        }
        ceilingMaterial.needsUpdate = true;
    }
    clearDecorations();
    spawnLevelDecorations();
    if (currentLevel === 2) {
        spawnDynamicGrass();
        spawnDynamicClouds();
    }
    clearAmbientParticles();
    spawnAmbientParticles();
}
// --- DECORACIONES 3D AMBIENTALES ---
function spawnDynamicGrass() {
    const map = getMapForLevel(currentLevel);
    let floorCells = [];
    for (let z = 0; z < map.length; z++) {
        for (let x = 0; x < map[z].length; x++) {
            if (map[z][x] !== 1 || currentLevel === 2) {
                floorCells.push({x: x * GRID_SIZE, z: z * GRID_SIZE});
            }
        }
    }

    const bladesPerCell = 60;
    const totalBlades = floorCells.length * bladesPerCell;

    const grassGeo = new THREE.PlaneGeometry(0.3, 0.6, 1, 4);
    grassGeo.translate(0, 0.3, 0);

    const tex = typeof generateGrassBladeTexture !== 'undefined' ? generateGrassBladeTexture() : null;
    const grassMat = new THREE.MeshStandardMaterial({
        map: tex,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        color: 0x2a7a1a,
        roughness: 0.9
    });

    grassMat.onBeforeCompile = (shader) => {
        shader.uniforms.time = { value: 0 };
        shader.vertexShader = `
            uniform float time;
            ` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            `#include <begin_vertex>`,
            `
            #include <begin_vertex>
            float sway = sin(time * 3.0 + position.x * 0.5 + position.z * 0.5) * 0.5;
            float strength = position.y / 0.6;
            transformed.x -= sway * strength * 0.8 + (strength * 0.5);
            transformed.z += cos(time * 2.0 + position.x) * strength * 0.2;
            `
        );
        grassMaterialShader = shader;
    };

    grassInstancedMesh = new THREE.InstancedMesh(grassGeo, grassMat, totalBlades);
    grassInstancedMesh.name = "map_grass";
    grassInstancedMesh.receiveShadow = true;
    grassInstancedMesh.castShadow = false;

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (const cell of floorCells) {
        for (let i = 0; i < bladesPerCell; i++) {
            dummy.position.set(
                cell.x + (Math.random() - 0.5) * GRID_SIZE,
                0,
                cell.z + (Math.random() - 0.5) * GRID_SIZE
            );
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.scale.setScalar(0.4 + Math.random() * 0.4);
            dummy.updateMatrix();
            grassInstancedMesh.setMatrixAt(idx++, dummy.matrix);
        }
    }
    
    scene.add(grassInstancedMesh);
}

function spawnDynamicClouds() {
    const cloudGeo = new THREE.PlaneGeometry(GRID_SIZE * 20, GRID_SIZE * 20);
    const tex = typeof generateCloudTexture !== 'undefined' ? generateCloudTexture() : null;
    if (tex) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
    }
    const cloudMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMesh.rotation.x = Math.PI / 2;
    cloudMesh.position.set(GRID_SIZE * 10, WALL_HEIGHT + 3, GRID_SIZE * 10);
    scene.add(cloudMesh);
}

function clearDecorations() {
    decorations.forEach(d => {
        scene.remove(d);
        d.traverse(child => {
            if (child.geometry)
                child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                }
                else {
                    child.material.dispose();
                }
            }
        });
    });
    decorations = [];
}
function spawnLevelDecorations() {
    const map = getMapForLevel(currentLevel);
    let spawned = 0;
    const maxDecorations = currentLevel === 3 ? 45 : 20;
    for (let z = 2; z < map.length - 2 && spawned < maxDecorations; z++) {
        for (let x = 2; x < map[z].length - 2 && spawned < maxDecorations; x++) {
            if (map[z][x] !== 0)
                continue;
            if (Math.random() > 0.12)
                continue;
            const posX = x * GRID_SIZE;
            const posZ = z * GRID_SIZE;
            if (x < 3 && z < 3)
                continue;
            
            // Limitación original era x>13,z>13 (para 16x16). Ahora dejamos que crezcan a lo largo del mapa
            // Pero limitamos la densidad drásticamente
            if (currentLevel === 3 && Math.random() > 0.05)
                continue;

            let group;
            if (currentLevel === 1) {
                group = createFacilityDecoration(posX, posZ);
            }
            else if (currentLevel === 2) {
                group = createJungleDecoration(posX, posZ);
            }
            else if (currentLevel === 3) {
                group = createCaveDecoration(posX, posZ);
            }
            if (group) {
                scene.add(group);
                decorations.push(group);
                mapChunks.push({ zIndex: z, mesh: group });
                spawned++;
            }
        }
    }
}
function createFacilityDecoration(px, pz) {
    const group = new THREE.Group();
    const type = pickFacilityDecorationType(Math.random());
    if (type === 'barrel') {
        const barrelGeo = new THREE.CylinderGeometry(0.35, 0.38, 1.0, 10);
        const barrelMat = new THREE.MeshStandardMaterial({
            color: 0x3a4a2e, roughness: 0.85, metalness: 0.3
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(px + (Math.random() - 0.5) * 1.5, 0.5, pz + (Math.random() - 0.5) * 1.5);
        barrel.castShadow = true;
        barrel.receiveShadow = true;
        group.add(barrel);
        const bandGeo = new THREE.CylinderGeometry(0.36, 0.39, 0.12, 10);
        const bandMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00, roughness: 0.6, metalness: 0.2, emissive: 0x332200, emissiveIntensity: 0.2
        });
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.copy(barrel.position);
        band.position.y = 0.65;
        group.add(band);
        const dripGeo = new THREE.SphereGeometry(0.06, 6, 6);
        const dripMat = new THREE.MeshBasicMaterial({ color: 0x44ff22, transparent: true, opacity: 0.7 });
        const drip = new THREE.Mesh(dripGeo, dripMat);
        drip.position.set(barrel.position.x + 0.35, 0.15, barrel.position.z);
        group.add(drip);
        const dripLight = new THREE.Group();
        dripLight.position.copy(drip.position);
        group.add(dripLight);
    }
    else if (type === 'crate') {
        const crateGeo = new THREE.BoxGeometry(0.9, 0.6, 0.7);
        const crateMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a1e, roughness: 0.9, metalness: 0.15
        });
        const crate = new THREE.Mesh(crateGeo, crateMat);
        crate.position.set(px + (Math.random() - 0.5) * 1.2, 0.3, pz + (Math.random() - 0.5) * 1.2);
        crate.rotation.y = Math.random() * Math.PI;
        crate.castShadow = true;
        crate.receiveShadow = true;
        group.add(crate);
        const stripGeo = new THREE.BoxGeometry(0.92, 0.04, 0.72);
        const stripMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.5 });
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.copy(crate.position);
        strip.position.y = 0.45;
        strip.rotation.y = crate.rotation.y;
        group.add(strip);
    } else if (type === 2) {
    } else {
        const cableCount = 2 + Math.floor(Math.random() * 3);
        for (let c = 0; c < cableCount; c++) {
            const cableGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2 + Math.random() * 1.5, 4);
            const cableMat = new THREE.MeshStandardMaterial({
                color: Math.random() > 0.5 ? 0x222222 : 0x332211, roughness: 0.9
            });
            const cable = new THREE.Mesh(cableGeo, cableMat);
            cable.position.set(px + (Math.random() - 0.5) * 1.5, WALL_HEIGHT - (0.3 + Math.random() * 0.8), pz + (Math.random() - 0.5) * 1.5);
            cable.rotation.z = (Math.random() - 0.5) * 0.3;
            cable.rotation.x = (Math.random() - 0.5) * 0.3;
            group.add(cable);
        }
    }
    return group;
}
function createJungleDecoration(px, pz) {
    const group = new THREE.Group();
    const type = Math.floor(Math.random() * 4);
    if (type === 0 && leafMaterial) {
        const bushGroup = new THREE.Group();
        const bushCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < bushCount; i++) {
            const bushGeo = new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.4, 1);
            const bush = new THREE.Mesh(bushGeo, leafMaterial);
            bush.position.set((Math.random() - 0.5) * 1.0, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 1.0);
            bush.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            bush.castShadow = true;
            bush.receiveShadow = true;
            bushGroup.add(bush);
        }
        bushGroup.position.set(px + (Math.random() - 0.5) * 1.8, 0, pz + (Math.random() - 0.5) * 1.8);
        group.add(bushGroup);
    }
    else if (type === 1) {
        const stemGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.35, 6);
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.95 });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        const ox = px + (Math.random() - 0.5) * 1.5;
        const oz = pz + (Math.random() - 0.5) * 1.5;
        stem.position.set(ox, 0.175, oz);
        group.add(stem);
        const capGeo = new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        const glowColor = Math.random() > 0.5 ? 0x22ff88 : 0x00ccff;
        const capMat = new THREE.MeshStandardMaterial({
            color: glowColor, emissive: glowColor, emissiveIntensity: 0.6,
            roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.85
        });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(ox, 0.35, oz);
        group.add(cap);
        const mushroomLight = new THREE.Group();
        mushroomLight.position.set(ox, 0.35, oz);
        group.add(mushroomLight);
    }
    else if (type === 2) {
        const logGeo = new THREE.CylinderGeometry(0.18, 0.22, 2.0 + Math.random(), 8);
        const logMat = new THREE.MeshStandardMaterial({
            color: 0x3a2a18, roughness: 0.95, metalness: 0.0
        });
        const log = new THREE.Mesh(logGeo, logMat);
        log.position.set(px + (Math.random() - 0.5), 0.2, pz + (Math.random() - 0.5));
        log.rotation.z = Math.PI / 2;
        log.rotation.y = Math.random() * Math.PI;
        log.castShadow = true;
        log.receiveShadow = true;
        group.add(log);
    }
    else {
        const vineCount = 3 + Math.floor(Math.random() * 4);
        for (let v = 0; v < vineCount; v++) {
            const vineGeo = new THREE.CylinderGeometry(0.02, 0.015, 1.5 + Math.random() * 2.0, 4);
            const vineMat = new THREE.MeshStandardMaterial({ color: 0x1a4a12, roughness: 0.95 });
            const vine = new THREE.Mesh(vineGeo, vineMat);
            vine.position.set(px + (Math.random() - 0.5) * 2.0, WALL_HEIGHT - (0.5 + Math.random() * 1.0), pz + (Math.random() - 0.5) * 2.0);
            vine.rotation.z = (Math.random() - 0.5) * 0.4;
            vine.rotation.x = (Math.random() - 0.5) * 0.4;
            group.add(vine);
        }
    }
    return group;
}
function createCaveDecoration(px, pz) {
    const group = new THREE.Group();
    const type = Math.floor(Math.random() * 5);
    
    if (type === 0) {
        // Tipo 0 — Estalagmitas con colisión
        const stalagmiteCount = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < stalagmiteCount; i++) {
            const h = 1.0 + Math.random() * 2.0;
            const r = 0.3 + Math.random() * 0.3;
            const stalGeo = new THREE.ConeGeometry(r, h, 6);
            const stalMat = new THREE.MeshStandardMaterial({
                color: 0x3a3530, roughness: 0.95, metalness: 0.05
            });
            const stalagmite = new THREE.Mesh(stalGeo, stalMat);
            const ox = px + (Math.random() - 0.5) * 1.5;
            const oz = pz + (Math.random() - 0.5) * 1.5;
            stalagmite.position.set(ox, h / 2, oz);
            stalagmite.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI, (Math.random() - 0.5) * 0.2);
            stalagmite.castShadow = true;
            stalagmite.receiveShadow = true;
            group.add(stalagmite);
            
            // Añadir colisionador
            const bbox = new THREE.Box3().setFromObject(stalagmite);
            colliders.push({ isTree: true, mesh: stalagmite, box: bbox });
        }
    }
    else if (type === 1) {
        // Tipo 1 — Hongos bioluminiscentes
        const clusterSize = 2 + Math.floor(Math.random() * 4);
        const basePath = new THREE.Vector3(px + (Math.random() - 0.5), 0, pz + (Math.random() - 0.5));
        for (let i = 0; i < clusterSize; i++) {
            const h = 0.2 + Math.random() * 0.4;
            const stemGeo = new THREE.CylinderGeometry(0.02, 0.04, h, 5);
            const stemMat = new THREE.MeshStandardMaterial({ color: 0x112211, roughness: 0.9 });
            const stem = new THREE.Mesh(stemGeo, stemMat);
            const ox = basePath.x + (Math.random() - 0.5) * 0.8;
            const oz = basePath.z + (Math.random() - 0.5) * 0.8;
            stem.position.set(ox, h / 2, oz);
            stem.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
            group.add(stem);
            
            const capGeo = new THREE.SphereGeometry(0.08 + Math.random() * 0.08, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2);
            const capMat = new THREE.MeshStandardMaterial({
                color: 0x44ff88, emissive: 0x11aa44, emissiveIntensity: 1.5,
                roughness: 0.3, metalness: 0.1
            });
            const cap = new THREE.Mesh(capGeo, capMat);
            cap.position.copy(stem.position);
            cap.position.y += h / 2;
            cap.rotation.copy(stem.rotation);
            group.add(cap);
        }
        const mushroomLight = new THREE.Group();
        mushroomLight.position.set(basePath.x, 0.5, basePath.z);
        group.add(mushroomLight);
    }
    else if (type === 2) {
        // Tipo 2 — Estalactitas colgando del techo
        const stCount = 3 + Math.floor(Math.random() * 5);
        for(let i = 0; i < stCount; i++) {
            const stalGeo = new THREE.ConeGeometry(0.2 + Math.random() * 0.2, 1.0 + Math.random() * 2.0, 6);
            const stalMat = new THREE.MeshStandardMaterial({
                color: 0x252220, roughness: 0.9, metalness: 0.1
            });
            const stalactite = new THREE.Mesh(stalGeo, stalMat);
            stalactite.position.set(px + (Math.random() - 0.5) * 2.0, WALL_HEIGHT, pz + (Math.random() - 0.5) * 2.0);
            stalactite.rotation.x = Math.PI;
            stalactite.rotation.z = (Math.random() - 0.5) * 0.2;
            stalactite.rotation.y = Math.random() * Math.PI;
            stalactite.castShadow = true;
            group.add(stalactite);
        }
    }
    else if (type === 3) {
        // Tipo 3 — Rocas sueltas en el suelo con colisión
        const rockCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < rockCount; i++) {
            const rockGeo = new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.4, 0);
            const rockMat = new THREE.MeshStandardMaterial({
                color: 0x3a3025, roughness: 0.95, metalness: 0.05
            });
            const rock = new THREE.Mesh(rockGeo, rockMat);
            const ox = px + (Math.random() - 0.5) * 1.5;
            const oz = pz + (Math.random() - 0.5) * 1.5;
            rock.position.set(ox, 0.1 + Math.random() * 0.2, oz);
            rock.scale.y = 0.5 + Math.random() * 0.3;
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.castShadow = true;
            rock.receiveShadow = true;
            group.add(rock);
            
            // Añadir colisionador
            const bbox = new THREE.Box3().setFromObject(rock);
            colliders.push({ isTree: true, mesh: rock, box: bbox });
        }
    }
    else {
        // Tipo 4 — Cristales minerales en el suelo
        const crystalCount = 1 + Math.floor(Math.random() * 3);
        const basePath = new THREE.Vector3(px + (Math.random() - 0.5), 0, pz + (Math.random() - 0.5));
        for (let i = 0; i < crystalCount; i++) {
            const crystalGeo = new THREE.ConeGeometry(0.15 + Math.random() * 0.1, 0.6 + Math.random() * 0.8, 5);
            const crystalMat = new THREE.MeshStandardMaterial({
                color: 0x55ffaa, emissive: 0x114422, emissiveIntensity: 1.2,
                roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.85
            });
            const crystal = new THREE.Mesh(crystalGeo, crystalMat);
            crystal.position.set(basePath.x + (Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.2, basePath.z + (Math.random() - 0.5) * 0.5);
            crystal.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
            crystal.castShadow = true;
            group.add(crystal);
        }
        const crystalLight = new THREE.Group();
        crystalLight.position.set(basePath.x, 0.5, basePath.z);
        group.add(crystalLight);
    }
    return group;
}
// --- PARTÍCULAS AMBIENTALES ---
function clearAmbientParticles() {
    ambientParticles.forEach(p => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
    });
    ambientParticles = [];
    breathParticles.forEach(p => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
    });
    breathParticles = [];
}
function spawnAmbientParticles() {
    const map = getMapForLevel(currentLevel);
    const count = currentLevel === 3 ? 200 : 80;
    let color, emissive, size, opacity;
    if (currentLevel === 2) {
        color = 0x44ff66;
        emissive = 0x22aa33;
        size = 0.04;
        opacity = 0.5;
    }
    else if (currentLevel === 3) {
        color = LEVEL_THREE_PARTICLE_COLOR;
        emissive = LEVEL_THREE_PARTICLE_EMISSIVE;
        size = LEVEL_THREE_PARTICLE_SIZE;
        opacity = LEVEL_THREE_PARTICLE_OPACITY;
    }
    else {
        color = 0x888888;
        emissive = 0x222222;
        size = 0.025;
        opacity = 0.35;
    }
    for (let i = 0; i < count; i++) {
        let attempts = 0;
        while (attempts < 15) {
            attempts++;
            const gz = Math.floor(Math.random() * map.length);
            const gx = Math.floor(Math.random() * map[gz].length);
            if (map[gz][gx] !== 0)
                continue;
            const px = gx * GRID_SIZE + (Math.random() - 0.5) * GRID_SIZE * 0.8;
            const pz = gz * GRID_SIZE + (Math.random() - 0.5) * GRID_SIZE * 0.8;
            const py = 0.5 + Math.random() * (WALL_HEIGHT - 1.0);
            const geo = new THREE.SphereGeometry(size + Math.random() * size, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color: color, transparent: true, opacity: opacity * (0.5 + Math.random() * 0.5)
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(px, py, pz);
            scene.add(mesh);
            ambientParticles.push({
                mesh: mesh,
                isSnow: false,
                baseY: py,
                baseX: px,
                baseZ: pz,
                speed: currentLevel === 3 ? 0.2 + Math.random() * 0.3 : 0.3 + Math.random() * 0.5,
                phase: Math.random() * Math.PI * 2,
                amplitude: currentLevel === 3 ? 0.3 + Math.random() * 0.5 : 0.1 + Math.random() * 0.25,
                driftX: (Math.random() - 0.5) * 0.3,
                driftZ: (Math.random() - 0.5) * 0.3
            });
            break;
        }
    }
}
// --- CONSOLA GENERADORA FINAL (CAJA DE FUSIBLES) ---
function buildFuseBox3D(posX, posZ) {
    const group = new THREE.Group();
    group.position.set(posX - 1.5, 0, posZ - 1.5);
    const baseGeo = new THREE.BoxGeometry(0.8, 1.2, 0.6);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.8, metalness: 0.4 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.6;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    const panelGeo = new THREE.BoxGeometry(0.7, 0.3, 0.5);
    const panel = new THREE.Mesh(panelGeo, baseMat);
    panel.position.set(0, 1.25, 0.05);
    panel.rotation.x = Math.PI / 6;
    group.add(panel);
    const slotGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8);
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95 });
    for (let i = 0; i < 3; i++) {
        const slot = new THREE.Mesh(slotGeo, slotMat);
        slot.position.set(-0.18 + i * 0.18, 1.3, 0.12);
        slot.rotation.x = Math.PI / 6;
        group.add(slot);
    }
    const ledGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 1.0, 0.31);
    group.add(led);
    const ledLight = new THREE.Group();
    ledLight.position.set(0, 1.0, 0.35);
    group.add(ledLight);
    let wiringLed = null;
    let wiringLedLight = null;
    if (currentLevel >= 2) {
        const sidePanelGeo = new THREE.BoxGeometry(0.35, 0.7, 0.45);
        const sidePanelMat = new THREE.MeshStandardMaterial({ color: 0x33353b, roughness: 0.8, metalness: 0.3 });
        const sidePanel = new THREE.Mesh(sidePanelGeo, sidePanelMat);
        sidePanel.position.set(0.55, 0.8, 0);
        sidePanel.castShadow = true;
        sidePanel.receiveShadow = true;
        group.add(sidePanel);
        const wLedGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const wLedMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        wiringLed = new THREE.Mesh(wLedGeo, wLedMat);
        wiringLed.position.set(0.55, 1.05, 0.18);
        group.add(wiringLed);
        wiringLedLight = new THREE.Group();
        wiringLedLight.position.set(0.55, 1.05, 0.22);
        group.add(wiringLedLight);
    }
    scene.add(group);
    fuseBoxConsole = {
        group: group,
        led: led,
        ledLight: ledLight,
        wiringLed: wiringLed,
        wiringLedLight: wiringLedLight,
        activated: false,
        minX: group.position.x - 0.4,
        maxX: group.position.x + 0.4,
        minZ: group.position.z - 0.3,
        maxZ: group.position.z + 0.3
    };
    colliders.push(fuseBoxConsole);
}
// --- GENERACIÓN Y GESTIÓN DE FUSIBLES ---
function spawnFuses() {
    fuses.forEach(f => {
        scene.remove(f.mesh);
        if (fuseBoxConsole && fuseBoxConsole.group) {
            try {
                const fuseMesh = fuseBoxConsole.group.getObjectByName(`mounted_fuse_${fuses.indexOf(f)}`);
                if (fuseMesh)
                    fuseBoxConsole.group.remove(fuseMesh);
            }
            catch (e) { }
        }
    });
    fuses = [];
    fusesCollected = 0;
    updateFuseHUD();
    if (currentLevel === 2 || currentLevel === 4) return;
    let spawned = 0;
    let attempts = 0;
    while (spawned < 3 && attempts < 150) {
        attempts++;
        const z = Math.floor(Math.random() * activeMap.length);
        const x = Math.floor(Math.random() * activeMap[z].length);
        if (activeMap[z][x] === 0) {
            if ((x < 3 && z < 3) || (x > 12 && z > 12))
                continue;
            const dup = fuses.some(f => f.gridX === x && f.gridZ === z);
            if (dup)
                continue;
            const px = x * GRID_SIZE;
            const pz = z * GRID_SIZE;
            const fuseGroup = new THREE.Group();
            fuseGroup.position.set(px, 0.8, pz);
            const glassGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
            const glassMat = new THREE.MeshStandardMaterial({
                color: 0x00bfff,
                emissive: 0x007acc,
                roughness: 0.1,
                metalness: 0.9,
                transparent: true,
                opacity: 0.95
            });
            const glass = new THREE.Mesh(glassGeo, glassMat);
            fuseGroup.add(glass);
            const capGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 8);
            const capMat = new THREE.MeshStandardMaterial({ color: 0xe5a93b, roughness: 0.3, metalness: 0.85 });
            const topCap = new THREE.Mesh(capGeo, capMat);
            topCap.position.y = 0.22;
            fuseGroup.add(topCap);
            const bottomCap = new THREE.Mesh(capGeo, capMat);
            bottomCap.position.y = -0.22;
            fuseGroup.add(bottomCap);
            scene.add(fuseGroup);
            fuses.push({
                mesh: fuseGroup,
                gridX: x,
                gridZ: z,
                angle: Math.random() * Math.PI * 2,
                baseY: 0.6 + Math.random() * 0.4
            });
            spawned++;
        }
    }
}
function updateFuseHUD() {
    const fuseCountEl = document.getElementById('fuse-count');
    if (fuseCountEl) {
        const trackerEl = fuseCountEl.parentElement;
        if (currentLevel === 2 || currentLevel === 4) {
            if (trackerEl) trackerEl.style.display = 'none';
            return;
        } else {
            if (trackerEl) trackerEl.style.display = 'flex';
        }
        fuseCountEl.innerText = `${fusesCollected}/3`;
        if (fusesCollected === 3) {
            fuseCountEl.style.color = '#00ff41';
            fuseCountEl.style.textShadow = '0 0 12px rgba(0, 255, 65, 0.6)';
        }
        else {
            fuseCountEl.style.color = '#00d9ff';
            fuseCountEl.style.textShadow = '0 0 8px rgba(0, 217, 255, 0.4)';
        }
    }
}
// --- CONSTRUCTOR DE ARMA ---
function buildWeapon3D() {
    gunGroup = new THREE.Group();
    shotgunMeshGroup = new THREE.Group();
    const barrelGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 16);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.95 });
    const leftBarrel = new THREE.Mesh(barrelGeo, barrelMat);
    leftBarrel.rotation.x = Math.PI / 2;
    leftBarrel.position.set(-0.015, 0, -0.22);
    leftBarrel.castShadow = true;
    shotgunMeshGroup.add(leftBarrel);
    const rightBarrel = new THREE.Mesh(barrelGeo, barrelMat);
    rightBarrel.rotation.x = Math.PI / 2;
    rightBarrel.position.set(0.015, 0, -0.22);
    rightBarrel.castShadow = true;
    shotgunMeshGroup.add(rightBarrel);
    const ribGeo = new THREE.BoxGeometry(0.015, 0.008, 0.45);
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.8 });
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.position.set(0, 0.012, -0.22);
    shotgunMeshGroup.add(rib);
    const stockGeo = new THREE.BoxGeometry(0.05, 0.05, 0.22);
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x241108, roughness: 0.8, metalness: 0.1 });
    const stock = new THREE.Mesh(stockGeo, stockMat);
    stock.position.set(0, -0.035, 0.02);
    shotgunMeshGroup.add(stock);
    const pumpGeo = new THREE.BoxGeometry(0.045, 0.035, 0.16);
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.9, bumpScale: 0.02 });
    const pump = new THREE.Mesh(pumpGeo, pumpMat);
    pump.position.set(0, -0.025, -0.16);
    shotgunMeshGroup.add(pump);
    const magTubeGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.35, 12);
    const magTube = new THREE.Mesh(magTubeGeo, barrelMat);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.015, -0.22);
    shotgunMeshGroup.add(magTube);
    gunGroup.add(shotgunMeshGroup);
    glockMeshGroup = new THREE.Group();
    glockMeshGroup.visible = false;
    const glockSlideMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.4, metalness: 0.85 });
    const glockPolyMat = new THREE.MeshStandardMaterial({ color: 0x0f1011, roughness: 0.85, metalness: 0.2 });
    const glockGripGeo = new THREE.BoxGeometry(0.026, 0.09, 0.038);
    const glockGrip = new THREE.Mesh(glockGripGeo, glockPolyMat);
    glockGrip.position.set(0, -0.05, -0.02);
    glockGrip.rotation.x = -Math.PI / 9;
    glockMeshGroup.add(glockGrip);
    const glockSlideGeo = new THREE.BoxGeometry(0.029, 0.032, 0.165);
    const glockSlide = new THREE.Mesh(glockSlideGeo, glockSlideMat);
    glockSlide.position.set(0, 0, -0.08);
    glockMeshGroup.add(glockSlide);
    const glockTipGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.02, 12);
    const glockTipMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.95 });
    const glockTip = new THREE.Mesh(glockTipGeo, glockTipMat);
    glockTip.rotation.x = Math.PI / 2;
    glockTip.position.set(0, 0.004, -0.17);
    glockMeshGroup.add(glockTip);
    const sightBackGeo = new THREE.BoxGeometry(0.015, 0.005, 0.008);
    const sightBack = new THREE.Mesh(sightBackGeo, glockSlideMat);
    sightBack.position.set(0, 0.018, -0.01);
    glockMeshGroup.add(sightBack);
    const sightFrontGeo = new THREE.BoxGeometry(0.004, 0.005, 0.008);
    const sightFront = new THREE.Mesh(sightFrontGeo, glockSlideMat);
    sightFront.position.set(0, 0.018, -0.155);
    glockMeshGroup.add(sightFront);
    const sightDotMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    const sightDot = new THREE.Mesh(new THREE.SphereGeometry(0.0015, 4, 4), sightDotMat);
    sightDot.position.set(0, 0.018, -0.16);
    glockMeshGroup.add(sightDot);
    const guardGeo = new THREE.BoxGeometry(0.012, 0.025, 0.035);
    const guard = new THREE.Mesh(guardGeo, glockPolyMat);
    guard.position.set(0, -0.035, -0.05);
    glockMeshGroup.add(guard);
    const laserModuleGeo = new THREE.BoxGeometry(0.02, 0.02, 0.04);
    const laserModule = new THREE.Mesh(laserModuleGeo, glockPolyMat);
    laserModule.position.set(0, -0.025, -0.13);
    glockMeshGroup.add(laserModule);
    const laserDotMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const laserLens = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.002, 8), laserDotMat);
    laserLens.rotation.x = Math.PI / 2;
    laserLens.position.set(0, -0.025, -0.151);
    glockMeshGroup.add(laserLens);
    gunGroup.add(glockMeshGroup);
    m4MeshGroup = new THREE.Group();
    m4MeshGroup.visible = false;
    const m4MetalMat = new THREE.MeshStandardMaterial({ color: 0x222325, roughness: 0.35, metalness: 0.9 });
    const m4PlasticMat = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.85, metalness: 0.15 });
    const m4RecGeo = new THREE.BoxGeometry(0.032, 0.058, 0.22);
    const m4Receiver = new THREE.Mesh(m4RecGeo, m4MetalMat);
    m4Receiver.position.set(0, -0.01, -0.1);
    m4MeshGroup.add(m4Receiver);
    const m4GuardGeo = new THREE.BoxGeometry(0.042, 0.042, 0.22);
    const m4Guard = new THREE.Mesh(m4GuardGeo, m4MetalMat);
    m4Guard.position.set(0, -0.01, -0.32);
    m4MeshGroup.add(m4Guard);
    const m4BarrelGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.28, 12);
    const m4Barrel = new THREE.Mesh(m4BarrelGeo, m4MetalMat);
    m4Barrel.rotation.x = Math.PI / 2;
    m4Barrel.position.set(0, -0.01, -0.5);
    m4MeshGroup.add(m4Barrel);
    const m4TipGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.045, 12);
    const m4Tip = new THREE.Mesh(m4TipGeo, m4MetalMat);
    m4Tip.rotation.x = Math.PI / 2;
    m4Tip.position.set(0, -0.01, -0.6);
    m4MeshGroup.add(m4Tip);
    const m4GripGeo = new THREE.BoxGeometry(0.026, 0.08, 0.035);
    const m4Grip = new THREE.Mesh(m4GripGeo, m4PlasticMat);
    m4Grip.position.set(0, -0.075, -0.04);
    m4Grip.rotation.x = -Math.PI / 8;
    m4MeshGroup.add(m4Grip);
    const m4StockGeo = new THREE.BoxGeometry(0.03, 0.07, 0.16);
    const m4Stock = new THREE.Mesh(m4StockGeo, m4PlasticMat);
    m4Stock.position.set(0, -0.025, 0.08);
    m4MeshGroup.add(m4Stock);
    const m4BufferGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 12);
    const m4Buffer = new THREE.Mesh(m4BufferGeo, m4MetalMat);
    m4Buffer.rotation.x = Math.PI / 2;
    m4Buffer.position.set(0, -0.01, 0.02);
    m4MeshGroup.add(m4Buffer);
    const m4MagGeo = new THREE.BoxGeometry(0.025, 0.14, 0.055);
    const m4Mag = new THREE.Mesh(m4MagGeo, m4MetalMat);
    m4Mag.position.set(0, -0.11, -0.14);
    m4Mag.rotation.x = Math.PI / 16;
    m4MeshGroup.add(m4Mag);
    const m4HoloGeo = new THREE.BoxGeometry(0.025, 0.035, 0.06);
    const m4Holo = new THREE.Mesh(m4HoloGeo, m4MetalMat);
    m4Holo.position.set(0, 0.035, -0.1);
    m4MeshGroup.add(m4Holo);
    const m4HoloGlassGeo = new THREE.BoxGeometry(0.02, 0.025, 0.002);
    const m4HoloGlassMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4 });
    const m4HoloGlass = new THREE.Mesh(m4HoloGlassGeo, m4HoloGlassMat);
    m4HoloGlass.position.set(0, 0.035, -0.125);
    m4MeshGroup.add(m4HoloGlass);
    const lightBodyGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 12);
    const lightBody = new THREE.Mesh(lightBodyGeo, m4MetalMat);
    lightBody.rotation.x = Math.PI / 2;
    lightBody.position.set(0.025, -0.01, -0.35);
    m4MeshGroup.add(lightBody);
    const lightLensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lightLens = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.002, 12), lightLensMat);
    lightLens.rotation.x = Math.PI / 2;
    lightLens.position.set(0.025, -0.01, -0.39);
    m4MeshGroup.add(lightLens);
    gunGroup.add(m4MeshGroup);
    muzzleLight = new THREE.PointLight(0xffaa00, 0, 8);
    muzzleLight.position.set(0, 0, -0.46);
    gunGroup.add(muzzleLight);
    const flashGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 });
    muzzleFlashSprite = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlashSprite.position.set(0, 0, -0.46);
    gunGroup.add(muzzleFlashSprite);
    gunGroup.position.set(0.18, -0.20, -0.45);
    camera.add(gunGroup);
}
// Helper para clonar modelos riggeados (SkinnedMesh) en Three.js utilizando el algoritmo de SkeletonUtils
function cloneRiggedModel(source) {
    if (!source)
        return null;
    try {
        const sourceLookup = new Map();
        const cloneLookup = new Map();
        const clone = source.clone();
        function parallelTraverse(a, b) {
            sourceLookup.set(a, b);
            cloneLookup.set(b, a);
            for (let i = 0; i < a.children.length; i++) {
                parallelTraverse(a.children[i], b.children[i]);
            }
        }
        parallelTraverse(source, clone);
        clone.traverse(node => {
            if (node.isSkinnedMesh) {
                const sourceMesh = cloneLookup.get(node);
                const sourceBones = sourceMesh.skeleton.bones;
                node.skeleton = sourceMesh.skeleton.clone();
                node.bindMatrix.copy(sourceMesh.bindMatrix);
                node.bindMatrixInverse.copy(sourceMesh.bindMatrixInverse);
                node.skeleton.bones = sourceBones.map(bone => sourceLookup.get(bone));
                node.bind(node.skeleton, node.bindMatrix);
            }
        });
        return clone;
    }
    catch (err) {
        console.error("Error al clonar el modelo riggeado usando SkeletonUtils clone:", err);
        return source.clone();
    }
}
// --- CONTRATACIÓN Y MOVIMIENTO DE ZOMBIS ---
class Zombie {
    constructor(x, z, type = 'NORMAL') {
        this.group = new THREE.Group();
        this.group.position.set(x, 0, z);
        this.type = type;
        this.state = 'ALIVE';
        this.hurtTimer = 0;
        this.attackCooldownTimer = 0;
        this.walkCycle = Math.random() * 100;
        if (this.type === 'RUNNER') {
            this.maxHealth = 45;
            this.health = 45;
            this.speedMultiplier = 1.65;
            this.colorClothing = 0x5c1515;
            this.colorSkin = 0x4a3636;
        }
        else if (this.type === 'SPITTER') {
            this.maxHealth = 80;
            this.health = 80;
            this.speedMultiplier = 0.6;
            this.colorClothing = 0x133815;
            this.colorSkin = 0x5a754b;
            this.spitCooldownTimer = 1000 + Math.random() * 1500;
        }
        else {
            this.maxHealth = 100;
            this.health = 100;
            this.speedMultiplier = 1.0;
            this.colorClothing = 0x2d2538;
            this.colorSkin = 0x3d4a36;
        }
        this.bodyGroup = new THREE.Group();
        this.group.add(this.bodyGroup);
        if (cachedZombieModel) {
            this.zombieMesh = cachedZombieModel.clone(true);
            this.baseYOffset = zombieGLBBaseYOffset;
            this.zombieMesh.position.set(0, this.baseYOffset, 0);
            this.zombieMesh.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(mat => {
                                const clonedMat = mat.clone();
                                if (this.type === 'RUNNER') {
                                    clonedMat.color.setHex(0xff5555);
                                }
                                else if (this.type === 'SPITTER') {
                                    clonedMat.color.setHex(0x55ff55);
                                }
                                return clonedMat;
                            });
                        }
                        else {
                            child.material = child.material.clone();
                            if (this.type === 'RUNNER') {
                                child.material.color.setHex(0xff5555);
                            }
                            else if (this.type === 'SPITTER') {
                                child.material.color.setHex(0x55ff55);
                            }
                        }
                    }
                }
            });
            this.group.add(this.zombieMesh);
            const eyeColor = this.type === 'SPITTER' ? 0x39ff14 : (this.type === 'RUNNER' ? 0xff4400 : 0xffea00);
            this.eyeLight = new THREE.Group();
            this.eyeLight.position.set(0, 1.5, 0.2);
            this.group.add(this.eyeLight);
        }
        else {
            const torsoGeo = new THREE.BoxGeometry(0.65, 1.2, 0.35);
            const torsoMat = new THREE.MeshStandardMaterial({ color: this.colorClothing, roughness: 0.9, metalness: 0.1 });
            this.torso = new THREE.Mesh(torsoGeo, torsoMat);
            this.torso.position.y = 0.6;
            this.torso.castShadow = true;
            this.torso.receiveShadow = true;
            this.bodyGroup.add(this.torso);
            const ribGeo = new THREE.BoxGeometry(0.35, 0.4, 0.1);
            const ribMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 });
            this.ribcage = new THREE.Mesh(ribGeo, ribMat);
            this.ribcage.position.set(0, 0.7, 0.18);
            this.bodyGroup.add(this.ribcage);
            const bloodGeo = new THREE.BoxGeometry(0.5, 0.6, 0.05);
            const bloodMat = new THREE.MeshStandardMaterial({ color: 0x400000, roughness: 1.0 });
            this.blood = new THREE.Mesh(bloodGeo, bloodMat);
            this.blood.position.set(0.05, 0.5, 0.16);
            this.bodyGroup.add(this.blood);
            const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
            this.headMaterials = [
                new THREE.MeshStandardMaterial({ color: this.colorSkin }),
                new THREE.MeshStandardMaterial({ color: this.colorSkin }),
                new THREE.MeshStandardMaterial({ color: this.colorSkin }),
                new THREE.MeshStandardMaterial({ color: this.colorSkin }),
                new THREE.MeshStandardMaterial({ map: zombieFaceTexture, color: this.colorSkin }),
                new THREE.MeshStandardMaterial({ color: this.colorSkin })
            ];
            this.head = new THREE.Mesh(headGeo, this.headMaterials);
            this.head.position.set(0, 1.4, 0.1);
            this.head.rotation.x = -0.15;
            this.head.castShadow = true;
            this.bodyGroup.add(this.head);
            const jawGeo = new THREE.BoxGeometry(0.35, 0.25, 0.35);
            const jawMat = new THREE.MeshStandardMaterial({ color: this.colorSkin });
            this.jaw = new THREE.Mesh(jawGeo, jawMat);
            this.jaw.position.set(0, -0.28, 0.05);
            this.jaw.rotation.x = 0.4;
            this.head.add(this.jaw);
            const eyeColor = this.type === 'SPITTER' ? 0x39ff14 : (this.type === 'RUNNER' ? 0xffaa00 : 0xff2200);
            const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
            const eyeMat = new THREE.MeshBasicMaterial({
                color: eyeColor, transparent: true, opacity: 0.95
            });
            this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
            this.leftEye.position.set(-0.12, 0.05, 0.23);
            this.head.add(this.leftEye);
            this.rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
            this.rightEye.position.set(0.12, 0.05, 0.23);
            this.head.add(this.rightEye);
            this.eyeLight = new THREE.Group();
            this.eyeLight.position.set(0, 0.05, 0.25);
            this.head.add(this.eyeLight);
            const armGeo = new THREE.BoxGeometry(0.16, 0.16, 0.8);
            const armMat = new THREE.MeshStandardMaterial({ color: this.colorSkin });
            this.leftArm = new THREE.Mesh(armGeo, armMat);
            this.leftArm.position.set(-0.45, 0.95, 0.4);
            this.leftArm.rotation.y = 0.2;
            this.leftArm.rotation.x = 0.1;
            this.leftArm.castShadow = true;
            this.bodyGroup.add(this.leftArm);
            this.rightArm = new THREE.Mesh(armGeo, armMat);
            this.rightArm.position.set(0.45, 1.05, 0.35);
            this.rightArm.rotation.y = -0.15;
            this.rightArm.rotation.x = -0.2;
            this.rightArm.castShadow = true;
            this.bodyGroup.add(this.rightArm);
            const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.9 });
            this.leftLeg = new THREE.Mesh(legGeo, legMat);
            this.leftLeg.position.set(-0.2, 0.35, 0);
            this.leftLeg.castShadow = true;
            this.group.add(this.leftLeg);
            this.rightLeg = new THREE.Mesh(legGeo, legMat);
            this.rightLeg.position.set(0.2, 0.35, 0);
            this.rightLeg.castShadow = true;
            this.group.add(this.rightLeg);
            this.bodyGroup.position.y = 0.7;
            this.torso.position.y -= 0.7;
            this.head.position.y -= 0.7;
            this.leftArm.position.y -= 0.7;
            this.rightArm.position.y -= 0.7;
            this.ribcage.position.y -= 0.7;
            this.blood.position.y -= 0.7;
            this.bodyGroup.rotation.x = 0.15;
        }
        this.group.scale.set(1.25, 1.35, 1.25);
        scene.add(this.group);
    }
    update(deltaTime, playerPos) {
        if (this.state === 'DEAD')
            return;
        if (this.state === 'DYING') {
            if (this.group.rotation.x > -Math.PI / 2) {
                this.group.rotation.x -= deltaTime * 4;
                this.group.position.y = Math.max(0.1, this.group.position.y - deltaTime * 2);
            }
            else {
                this.state = 'DEAD';
                zombiesRemainingCount();
            }
            return;
        }
        if (this.hurtTimer > 0) {
            this.hurtTimer -= deltaTime;
            if (this.hurtTimer <= 0) {
                this.setMaterialColor(null);
            }
        }
        if (this.attackCooldownTimer > 0) {
            this.attackCooldownTimer -= deltaTime * 1000;
        }
        const dir = new THREE.Vector3().subVectors(playerPos, this.group.position);
        dir.y = 0;
        const dist = dir.length();
        dir.normalize();
        const angle = Math.atan2(dir.x, dir.z);
        this.group.rotation.y = angle;
        if (eventOccursForDelta(ZOMBIE_GROAN_RATE, deltaTime, Math.random()) && dist < 22) {
            AudioSynth.playZombieGroan();
        }
        if (this.type === 'SPITTER' && dist < 12.0 && dist > 2.0 && this.state === 'ALIVE') {
            this.spitCooldownTimer -= deltaTime * 1000;
            if (this.spitCooldownTimer <= 0) {
                this.spitAcid(dir);
                this.spitCooldownTimer = 2000 + Math.random() * 2000;
            }
        }
        if (dist > ZOMBIE_ATTACK_DIST) {
            const currentSpeed = ZOMBIE_SPEED * this.speedMultiplier * (1.0 + (currentLevel - 1) * 0.08);
            const movementDistance = distanceForDelta(currentSpeed, deltaTime);
            const nextX = this.group.position.x + dir.x * movementDistance;
            const nextZ = this.group.position.z + dir.z * movementDistance;
            const resolved = checkZombieWallCollisions(nextX, nextZ);
            this.group.position.x = resolved.x;
            this.group.position.z = resolved.z;
            if (this.zombieMesh) {
                this.walkCycle += deltaTime * 8 * this.speedMultiplier;
                this.zombieMesh.rotation.z = Math.sin(this.walkCycle) * 0.08;
                this.zombieMesh.rotation.x = 0.15 + Math.cos(this.walkCycle * 2) * 0.05;
                this.zombieMesh.position.y = this.baseYOffset + Math.abs(Math.sin(this.walkCycle * 2)) * 0.06;
            }
            else {
                this.walkCycle += deltaTime * 8 * this.speedMultiplier;
                this.leftLeg.rotation.x = Math.sin(this.walkCycle) * 0.45;
                this.rightLeg.rotation.x = -Math.sin(this.walkCycle) * 0.45;
                this.leftArm.rotation.x = (Math.sin(this.walkCycle * 0.5) * 0.1);
                this.rightArm.rotation.x = -(Math.sin(this.walkCycle * 0.5) * 0.1);
                this.torso.position.y = 0.55 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.05;
                this.head.position.y = 1.28 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.04;
            }
        }
        else {
            if (this.attackCooldownTimer <= 0 && player.health > 0) {
                this.attack();
            }
        }
    }
    spitAcid(dir) {
        AudioSynth.playMetallicClick(350, 0.15, 0.2);
        const startPos = this.group.position.clone();
        startPos.y += 1.28;
        const projGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const projMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
        const projMesh = new THREE.Mesh(projGeo, projMat);
        projMesh.position.copy(startPos);
        const projLight = new THREE.Group();
        projMesh.add(projLight);
        scene.add(projMesh);
        const targetPos = camera.position.clone();
        targetPos.x += (Math.random() - 0.5) * 0.4;
        targetPos.z += (Math.random() - 0.5) * 0.4;
        const velocity = new THREE.Vector3().subVectors(targetPos, startPos).normalize().multiplyScalar(0.18);
        acidProjectiles.push({
            mesh: projMesh,
            velocity: velocity,
            life: 3.5,
            damage: 15,
            type: 'acid',
            isAcid: true,
            impactColor: 0x39ff14
        });
        if (this.zombieMesh) {
            const originalZ = this.zombieMesh.position.z;
            this.zombieMesh.position.z += 0.25;
            setTimeout(() => {
                if (this.zombieMesh)
                    this.zombieMesh.position.z = originalZ;
            }, 300);
        }
        else {
            const originalL = this.leftArm.rotation.x;
            const originalR = this.rightArm.rotation.x;
            this.leftArm.rotation.x = -0.5;
            this.rightArm.rotation.x = -0.5;
            setTimeout(() => {
                if (this.state === 'ALIVE' && this.leftArm) {
                    this.leftArm.rotation.x = originalL;
                    this.rightArm.rotation.x = originalR;
                }
            }, 300);
        }
    }
    damage(amount) {
        if (this.state !== 'ALIVE')
            return;
        this.health -= amount;
        this.setMaterialColor(0xff0000);
        this.hurtTimer = 0.12;
        AudioSynth.playZombieHurt();
        if (this.health <= 0) {
            recordZombieKillScore(this.type);
            this.state = 'DYING';
            const backDir = new THREE.Vector3().subVectors(this.group.position, camera.position).normalize();
            this.group.position.addScaledVector(backDir, 0.4);
        }
    }
    setMaterialColor(hexColor) {
        if (this.zombieMesh) {
            this.zombieMesh.traverse(child => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        if (mat && mat.color) {
                            if (hexColor !== null) {
                                mat.color.setHex(hexColor);
                            }
                            else {
                                if (this.type === 'RUNNER') {
                                    mat.color.setHex(0xff5555);
                                }
                                else if (this.type === 'SPITTER') {
                                    mat.color.setHex(0x55ff55);
                                }
                                else {
                                    mat.color.setHex(0xffffff);
                                }
                            }
                        }
                    });
                }
            });
        }
        else {
            const list = [this.torso, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg, this.jaw];
            list.forEach(mesh => {
                if (mesh) {
                    if (hexColor !== null) {
                        mesh.material.color.setHex(hexColor);
                    }
                    else {
                        if (mesh === this.torso)
                            mesh.material.color.setHex(this.colorClothing);
                        else if (mesh === this.leftLeg || mesh === this.rightLeg)
                            mesh.material.color.setHex(0x111115);
                        else
                            mesh.material.color.setHex(this.colorSkin);
                    }
                }
            });
            if (this.ribcage && this.blood) {
                if (hexColor !== null) {
                    this.ribcage.material.color.setHex(hexColor);
                    this.blood.material.color.setHex(hexColor);
                }
                else {
                    this.ribcage.material.color.setHex(0x8a8578);
                    this.blood.material.color.setHex(0x400000);
                }
            }
            if (this.headMaterials) {
                this.headMaterials.forEach((mat) => {
                    if (hexColor !== null) {
                        mat.color.setHex(hexColor);
                    }
                    else {
                        mat.color.setHex(this.colorSkin);
                    }
                });
            }
        }
    }
    attack() {
        this.attackCooldownTimer = ZOMBIE_ATTACK_COOLDOWN;
        if (this.zombieMesh) {
            const originalZ = this.zombieMesh.position.z;
            this.zombieMesh.position.z += 0.35;
            setTimeout(() => {
                if (this.zombieMesh)
                    this.zombieMesh.position.z = originalZ;
            }, 200);
        }
        else {
            const originalZ = this.leftArm.position.z;
            this.leftArm.position.z += 0.25;
            this.rightArm.position.z += 0.25;
            setTimeout(() => {
                if (this.leftArm) {
                    this.leftArm.position.z = originalZ;
                    this.rightArm.position.z = originalZ;
                }
            }, 200);
        }
        damagePlayer(18 + Math.floor(Math.random() * 8));
    }
}
class CeilingSpider {
    constructor(x, z) {
        this.group = new THREE.Group();
        this.group.position.set(x, SPIDER_CEILING_Y, z);
        this.state = 'ALIVE';
        this.health = SPIDER_HEALTH;
        this.hurtTimer = 0;
        this.shotCooldownTimer = SPIDER_SHOT_COOLDOWN_MIN + Math.random() * (SPIDER_SHOT_COOLDOWN_MAX - SPIDER_SHOT_COOLDOWN_MIN);
        this.walkCycle = Math.random() * Math.PI * 2;
        this.hitMeshes = [];
        this.legs = [];
        this.legBaseRotations = [];
        const spiderMat = this.createMaterial(0x171018);
        const headMat = this.createMaterial(0x24131c);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
        eyeMat.userData.originalColor = 0xff3300;
        const bodyGeo = new THREE.SphereGeometry(0.5, 12, 8);
        this.body = new THREE.Mesh(bodyGeo, spiderMat);
        this.body.scale.set(1.2, 0.28, 0.85);
        this.body.castShadow = true;
        this.group.add(this.body);
        this.hitMeshes.push(this.body);
        const headGeo = new THREE.SphereGeometry(0.24, 10, 8);
        this.head = new THREE.Mesh(headGeo, headMat);
        this.head.position.set(0, -0.02, 0.48);
        this.head.scale.set(1.0, 0.75, 0.9);
        this.head.castShadow = true;
        this.group.add(this.head);
        this.hitMeshes.push(this.head);
        const eyeGeo = new THREE.SphereGeometry(0.045, 6, 6);
        this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        this.leftEye.position.set(-0.08, 0.02, 0.67);
        this.group.add(this.leftEye);
        this.hitMeshes.push(this.leftEye);
        this.rightEye = new THREE.Mesh(eyeGeo.clone(), eyeMat.clone());
        this.rightEye.material.userData.originalColor = 0xff3300;
        this.rightEye.position.set(0.08, 0.02, 0.67);
        this.group.add(this.rightEye);
        this.hitMeshes.push(this.rightEye);
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < 4; i++) {
                const legGeo = new THREE.CylinderGeometry(0.025, 0.018, 0.82, 6);
                const leg = new THREE.Mesh(legGeo, this.createMaterial(0x130d10));
                leg.position.set(side * 0.52, -0.08, -0.35 + i * 0.23);
                leg.rotation.z = side > 0 ? Math.PI / 2 : -Math.PI / 2;
                leg.rotation.y = (-0.38 + i * 0.25) * side;
                leg.castShadow = true;
                this.group.add(leg);
                this.legs.push(leg);
                this.legBaseRotations.push(leg.rotation.y);
                this.hitMeshes.push(leg);
            }
        }
        this.eyeLight = new THREE.Group();
        this.eyeLight.position.set(0, 0.0, 0.55);
        this.group.add(this.eyeLight);
        scene.add(this.group);
    }
    createMaterial(color) {
        const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.9, metalness: 0.05 });
        material.userData.originalColor = color;
        return material;
    }
    update(deltaTime, playerPos) {
        if (this.state === 'DEAD')
            return;
        if (this.state === 'DYING') {
            this.group.position.y = Math.max(0.12, this.group.position.y - deltaTime * 2.4);
            this.group.rotation.x += deltaTime * 5.0;
            this.group.rotation.z += deltaTime * 1.5;
            if (this.group.position.y <= 0.12) {
                this.state = 'DEAD';
                zombiesRemainingCount();
            }
            return;
        }
        if (this.hurtTimer > 0) {
            this.hurtTimer -= deltaTime;
            if (this.hurtTimer <= 0) {
                this.setMaterialColor(null);
            }
        }
        this.shotCooldownTimer -= deltaTime * 1000;
        const dir = new THREE.Vector3().subVectors(playerPos, this.group.position);
        dir.y = 0;
        const dist = dir.length();
        if (dist > 0.001) {
            dir.normalize();
            this.group.rotation.y = Math.atan2(dir.x, dir.z);
        }
        if (dist > 4.5) {
            const movementDistance = distanceForDelta(SPIDER_SPEED, deltaTime);
            const nextX = this.group.position.x + dir.x * movementDistance;
            const nextZ = this.group.position.z + dir.z * movementDistance;
            const resolved = checkZombieWallCollisions(nextX, nextZ);
            this.group.position.x = resolved.x;
            this.group.position.z = resolved.z;
        }
        this.walkCycle += deltaTime * 8;
        this.body.rotation.z = Math.sin(this.walkCycle) * 0.08;
        this.legs.forEach((leg, index) => {
            leg.rotation.y = this.legBaseRotations[index] + Math.sin(this.walkCycle + index) * 0.18;
        });
        if (dist <= SPIDER_SHOT_RANGE && this.shotCooldownTimer <= 0 && player.health > 0) {
            this.shootAtPlayer();
            this.shotCooldownTimer = SPIDER_SHOT_COOLDOWN_MIN + Math.random() * (SPIDER_SHOT_COOLDOWN_MAX - SPIDER_SHOT_COOLDOWN_MIN);
        }
    }
    shootAtPlayer() {
        AudioSynth.playMetallicClick(900, 0.08, 0.12);
        const startPos = this.group.position.clone();
        startPos.y -= 0.18;
        const projGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const projMat = new THREE.MeshBasicMaterial({ color: 0xddeeff });
        const projMesh = new THREE.Mesh(projGeo, projMat);
        projMesh.position.copy(startPos);
        const projLight = new THREE.Group();
        projMesh.add(projLight);
        scene.add(projMesh);
        const targetPos = camera.position.clone();
        targetPos.x += (Math.random() - 0.5) * 0.35;
        targetPos.y += (Math.random() - 0.5) * 0.2;
        targetPos.z += (Math.random() - 0.5) * 0.35;
        const velocity = new THREE.Vector3().subVectors(targetPos, startPos).normalize().multiplyScalar(SPIDER_SHOT_SPEED);
        acidProjectiles.push({
            mesh: projMesh,
            velocity: velocity,
            life: 3.2,
            damage: SPIDER_SHOT_DAMAGE,
            type: 'spider',
            isAcid: false,
            impactColor: 0xddeeff
        });
    }
    damage(amount) {
        if (this.state !== 'ALIVE')
            return;
        this.health -= amount;
        this.setMaterialColor(0xff0000);
        this.hurtTimer = 0.12;
        AudioSynth.playZombieHurt();
        if (this.health <= 0) {
            scoreState = recordEnemyKill(scoreState, ENEMY_SCORE_TYPES.CeilingSpider, currentLevel);
            this.state = 'DYING';
            this.eyeLight.intensity = 0.15;
        }
    }
    setMaterialColor(hexColor) {
        this.group.traverse(child => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if (mat && mat.color) {
                        if (hexColor !== null) {
                            mat.color.setHex(hexColor);
                        }
                        else if (mat.userData.originalColor !== undefined) {
                            mat.color.setHex(mat.userData.originalColor);
                        }
                    }
                });
            }
        });
    }
    dispose() {
        scene.remove(this.group);
        this.group.traverse(child => {
            if (child.geometry)
                child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                }
                else {
                    child.material.dispose();
                }
            }
        });
    }
}
// --- CLASE DEL JEFE FINAL (NIVEL 4) ---
class BossEnemy {
    constructor(x, z) {
        this.group = new THREE.Group();
        this.group.position.set(x, 0, z);
        this.state = 'ALIVE';
        this.health = BOSS_HEALTH;
        this.maxHealth = BOSS_HEALTH;
        this.hurtTimer = 0;
        this.attackCooldownTimer = 0;
        this.spitCooldownTimer = 3000 + Math.random() * 2000;
        this.walkCycle = 0;
        this.rushTimer = BOSS_RUSH_INTERVAL;
        this.isRushing = false;
        this.rushDurationTimer = 0;
        if (cachedBossModel) {
            this.bossMesh = cachedBossModel.clone(true);
            this.baseYOffset = bossGLBBaseYOffset;
            this.bossMesh.position.set(0, this.baseYOffset, 0);
            this.bossMesh.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(mat => mat.clone());
                        }
                        else {
                            child.material = child.material.clone();
                        }
                    }
                }
            });
            this.group.add(this.bossMesh);
        }
        else {
            this.proceduralParts = [];
            const bodyGeo = new THREE.BoxGeometry(2.5, 3.5, 2.0);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x880000, roughness: 0.7, metalness: 0.5 });
            this.bossMesh = new THREE.Mesh(bodyGeo, bodyMat);
            this.bossMesh.position.y = 1.75;
            this.bossMesh.castShadow = true;
            this.baseYOffset = 0;
            this.group.add(this.bossMesh);
            this.proceduralParts.push(this.bossMesh);
            const eyeGeo = new THREE.SphereGeometry(0.15, 8, 8);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
            const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
            leftEye.position.set(-0.4, 2.8, 1.05);
            this.group.add(leftEye);
            this.proceduralParts.push(leftEye);
            const rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
            rightEye.position.set(0.4, 2.8, 1.05);
            this.group.add(rightEye);
            this.proceduralParts.push(rightEye);
        }
        this.eyeLight = new THREE.Group();
        this.eyeLight.position.set(0, 2.8, 0.5);
        this.group.add(this.eyeLight);
        this.auraLight = new THREE.Group();
        this.auraLight.position.set(0, 0.5, 0);
        this.group.add(this.auraLight);
        scene.add(this.group);
        if (bossHud) {
            bossHud.classList.remove('hidden');
            bossHud.classList.remove('boss-low-health');
        }
        this.updateHealthBar();
        AudioSynth.playBossRoar();
    }
    replaceMeshWithGLB() {
        if (!cachedBossModel || this.state !== 'ALIVE') return;
        if (this.proceduralParts) {
            this.proceduralParts.forEach(p => {
                this.group.remove(p);
                if (p.geometry) p.geometry.dispose();
                if (p.material) p.material.dispose();
            });
            this.proceduralParts = null;
        }
        this.bossMesh = cachedBossModel.clone(true);
        this.baseYOffset = bossGLBBaseYOffset;
        this.bossMesh.position.set(0, this.baseYOffset, 0);
        this.group.add(this.bossMesh);
    }
    updateHealthBar() {
        if (bossHealthFill) {
            const pct = Math.max(0, this.health / this.maxHealth) * 100;
            bossHealthFill.style.width = pct + '%';
            if (bossHud) {
                if (pct < 25) {
                    bossHud.classList.add('boss-low-health');
                }
                else {
                    bossHud.classList.remove('boss-low-health');
                }
            }
        }
    }
    update(deltaTime, playerPos) {
        if (this.state === 'DEAD')
            return;
        if (this.state === 'DYING') {
            if (this.group.rotation.x > -Math.PI / 2) {
                this.group.rotation.x -= deltaTime * 2;
                this.group.position.y = Math.max(0.1, this.group.position.y - deltaTime * 1.5);
            }
            else {
                this.state = 'DEAD';
                if (bossHud)
                    bossHud.classList.add('hidden');
                setTimeout(() => triggerVictory(), 2000);
            }
            return;
        }
        if (this.hurtTimer > 0) {
            this.hurtTimer -= deltaTime;
            if (this.hurtTimer <= 0) {
                this.setMaterialColor(null);
            }
        }
        if (this.attackCooldownTimer > 0) {
            this.attackCooldownTimer -= deltaTime * 1000;
        }
        this.rushTimer -= deltaTime;
        if (this.rushTimer <= 0 && !this.isRushing) {
            this.isRushing = true;
            this.rushDurationTimer = BOSS_RUSH_DURATION;
            this.rushTimer = BOSS_RUSH_INTERVAL;
            showFeedback("¡EL JEFE ENTRA EN FORMA RÁPIDA!");
            AudioSynth.playBossRoar();
        }
        if (this.isRushing) {
            this.rushDurationTimer -= deltaTime;
            if (this.rushDurationTimer <= 0) {
                this.isRushing = false;
            }
        }
        const dir = new THREE.Vector3().subVectors(playerPos, this.group.position);
        dir.y = 0;
        const dist = dir.length();
        dir.normalize();
        const angle = Math.atan2(dir.x, dir.z);
        this.group.rotation.y = angle;
        if (eventOccursForDelta(BOSS_ROAR_RATE, deltaTime, Math.random()) && dist < 30) {
            AudioSynth.playBossRoar();
        }
        if (dist >= BOSS_ACID_RANGE_MIN && dist <= BOSS_ACID_RANGE_MAX && this.state === 'ALIVE') {
            this.spitCooldownTimer -= deltaTime * 1000;
            if (this.spitCooldownTimer <= 0) {
                this.spitAcid(dir);
                this.spitCooldownTimer = 3000 + Math.random() * 2000;
            }
        }
        const speedMult = this.isRushing ? BOSS_RUSH_SPEED_MULTIPLIER : BOSS_SPEED_MULTIPLIER;
        const currentSpeed = ZOMBIE_SPEED * speedMult;
        if (dist > BOSS_MELEE_RANGE) {
            const movementDistance = distanceForDelta(currentSpeed, deltaTime);
            const nextX = this.group.position.x + dir.x * movementDistance;
            const nextZ = this.group.position.z + dir.z * movementDistance;
            const resolved = checkZombieWallCollisions(nextX, nextZ);
            this.group.position.x = resolved.x;
            this.group.position.z = resolved.z;
            this.walkCycle += deltaTime * 6 * speedMult;
            if (this.bossMesh) {
                this.bossMesh.rotation.z = Math.sin(this.walkCycle) * 0.06;
                this.bossMesh.rotation.x = 0.1 + Math.cos(this.walkCycle * 2) * 0.04;
                this.bossMesh.position.y = this.baseYOffset + Math.abs(Math.sin(this.walkCycle * 2)) * 0.08;
            }
        }
        else {
            if (this.attackCooldownTimer <= 0 && player.health > 0) {
                this.meleeAttack();
            }
        }
        if (this.auraLight) {
            this.auraLight.intensity = 1.5 + Math.sin(this.walkCycle * 3) * 0.5;
        }
        if (this.eyeLight) {
            this.eyeLight.intensity = 2.0 + (this.isRushing ? Math.sin(this.walkCycle * 8) * 1.5 : 0);
        }
    }
    meleeAttack() {
        this.attackCooldownTimer = 1500;
        AudioSynth.playBossImpact();
        if (this.bossMesh) {
            const origZ = this.bossMesh.position.z;
            this.bossMesh.position.z += 0.5;
            setTimeout(() => {
                if (this.bossMesh)
                    this.bossMesh.position.z = origZ;
            }, 250);
        }
        damagePlayer(BOSS_MELEE_DAMAGE);
        showFeedback("¡EL JEFE TE GOLPEÓ!");
    }
    spitAcid(dir) {
        AudioSynth.playMetallicClick(250, 0.2, 0.3);
        const startPos = this.group.position.clone();
        startPos.y += 2.5;
        const projGeo = new THREE.SphereGeometry(0.25, 10, 10);
        const projMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
        const projMesh = new THREE.Mesh(projGeo, projMat);
        projMesh.position.copy(startPos);
        const projLight = new THREE.Group();
        projMesh.add(projLight);
        scene.add(projMesh);
        const targetPos = camera.position.clone();
        targetPos.x += (Math.random() - 0.5) * 0.3;
        targetPos.z += (Math.random() - 0.5) * 0.3;
        const velocity = new THREE.Vector3().subVectors(targetPos, startPos).normalize().multiplyScalar(BOSS_ACID_SHOT_SPEED);
        acidProjectiles.push({
            mesh: projMesh,
            velocity: velocity,
            life: 4.0,
            damage: BOSS_ACID_DAMAGE,
            type: 'acid',
            isAcid: true,
            impactColor: 0x39ff14
        });
    }
    damage(amount, isHeadshot) {
        if (this.state !== 'ALIVE')
            return;
        let finalDmg = amount;
        if (isHeadshot) {
            finalDmg = amount * 2;
        }
        this.health -= finalDmg;
        this.setMaterialColor(0xff0000);
        this.hurtTimer = 0.12;
        AudioSynth.playBossImpact();
        this.updateHealthBar();
        if (this.health <= 0) {
            scoreState = recordEnemyKill(scoreState, ENEMY_SCORE_TYPES.Boss, currentLevel);
            this.state = 'DYING';
            AudioSynth.stopBossMusic();
            showFeedback("¡JEFE ELIMINADO! VICTORIA INMINENTE...");
            for (let i = 0; i < 30; i++) {
                const sparkPos = this.group.position.clone();
                sparkPos.y += Math.random() * 3;
                spawnParticle(sparkPos, 0xff4400, 0.08 + Math.random() * 0.06, 0.04);
            }
        }
    }
    setMaterialColor(hexColor) {
        if (!this.bossMesh)
            return;
        this.bossMesh.traverse(child => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    if (hexColor !== null) {
                        if (!mat._origColor)
                            mat._origColor = mat.color.getHex();
                        mat.color.setHex(hexColor);
                    }
                    else {
                        if (mat._origColor !== undefined) {
                            mat.color.setHex(mat._origColor);
                            delete mat._origColor;
                        }
                    }
                });
            }
        });
    }
    dispose() {
        scene.remove(this.group);
        if (bossHud)
            bossHud.classList.add('hidden');
    }
}
function clearSpiders() {
    spiders.forEach(spider => spider.dispose());
    spiders = [];
}
function isSpiderSpawnCellValid(x, z, selectedCells) {
    if (activeMap[z][x] !== 0)
        return false;
    if (x < SPIDER_PLAYER_START_SAFE_CELLS && z < SPIDER_PLAYER_START_SAFE_CELLS)
        return false;
    return selectedCells.every(cell => {
        const dx = x - cell.x;
        const dz = z - cell.z;
        return Math.sqrt(dx * dx + dz * dz) >= SPIDER_MIN_SEPARATION_CELLS;
    });
}
function findSpiderSpawnCell(selectedCells) {
    for (let attempt = 0; attempt < 120; attempt++) {
        const z = Math.floor(Math.random() * activeMap.length);
        const x = Math.floor(Math.random() * activeMap[z].length);
        if (isSpiderSpawnCellValid(x, z, selectedCells)) {
            return { x, z };
        }
    }
    for (let z = 0; z < activeMap.length; z++) {
        for (let x = 0; x < activeMap[z].length; x++) {
            if (isSpiderSpawnCellValid(x, z, selectedCells)) {
                return { x, z };
            }
        }
    }
    return null;
}
function spawnSpiders() {
    clearSpiders();
    if (currentLevel === 4 || currentLevel === 2)
        return;
    const selectedCells = [];
    while (selectedCells.length < SPIDER_SPAWN_COUNT) {
        const cell = findSpiderSpawnCell(selectedCells);
        if (!cell)
            break;
        selectedCells.push(cell);
    }
    selectedCells.forEach(cell => {
        const px = cell.x * GRID_SIZE + (Math.random() - 0.5) * GRID_SIZE * 0.25;
        const pz = cell.z * GRID_SIZE + (Math.random() - 0.5) * GRID_SIZE * 0.25;
        spiders.push(new CeilingSpider(px, pz));
    });
}
function spawnZombies() {
    zombies.forEach(z => scene.remove(z.group));
    zombies = [];
    clearSpiders();
    if (bossEnemy) {
        bossEnemy.dispose();
        bossEnemy = null;
    }
    acidProjectiles.forEach(p => scene.remove(p.mesh));
    acidProjectiles = [];
    if (currentLevel === 4) {
        ensureBossModelLoaded();
        const mapSize = activeMap.length;
        const centerX = Math.floor(mapSize / 2) * GRID_SIZE;
        const centerZ = Math.floor(mapSize / 2) * GRID_SIZE;
        bossEnemy = new BossEnemy(centerX, centerZ);
        zombiesRemainingCount();
        return;
    }
    let spawned = 0;
    let attempts = 0;
    let zombiesToSpawn = 6 + currentLevel * 2;
    if (currentLevel === 3) {
        zombiesToSpawn = 30;
    }
    while (spawned < zombiesToSpawn && attempts < 1000) {
        attempts++;
        const z = Math.floor(Math.random() * activeMap.length);
        const x = Math.floor(Math.random() * activeMap[z].length);
        if (activeMap[z][x] === 0) {
            if (x < 3 && z < 3)
                continue;
            const px = x * GRID_SIZE;
            const pz = z * GRID_SIZE;
            let zType = 'NORMAL';
            const rand = Math.random();
            if (rand < 0.5) {
                zType = 'NORMAL';
            }
            else if (rand < 0.75) {
                zType = 'RUNNER';
            }
            else {
                zType = 'SPITTER';
            }
            zombies.push(new Zombie(px, pz, zType));
            spawned++;
        }
    }
    spawnSpiders();
    zombiesRemainingCount();
}
function zombiesRemainingCount() {
    const aliveCount = zombies.filter(z => z.state === 'ALIVE').length + spiders.filter(spider => spider.state === 'ALIVE').length;
    zombieCountEl.innerText = aliveCount;
    if (aliveCount === 0 && gameState === 'PLAYING') {
        if (currentLevel === 2) {
            showFeedback("ZONA DESPEJADA. AVANZANDO...");
            setTimeout(() => {
                triggerVictory();
            }, 2000);
        } else {
            showFeedback("SECTOR LIMPIO. ENCUENTRA LOS FUSIBLES Y ACTIVA EL GENERADOR");
        }
    }
}
class Particle {
    constructor() {
        this.geometry = new THREE.BoxGeometry(1, 1, 1);
        this.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.velocity = new THREE.Vector3();
        this.gravity = PARTICLE_GRAVITY;
        this.life = 0;
    }
    activate(pos, color, scale, speedY) {
        this.mesh.scale.setScalar(scale);
        this.mesh.position.copy(pos);
        this.material.color.setHex(color);
        this.material.opacity = 1;
        scene.add(this.mesh);
        this.velocity.set(
            legacyFrameVelocityToPerSecond((Math.random() - 0.5) * 0.12),
            legacyFrameVelocityToPerSecond(Math.random() * 0.06 + speedY, PARTICLE_GRAVITY),
            legacyFrameVelocityToPerSecond((Math.random() - 0.5) * 0.12)
        );
        this.life = 1.0;
    }
    update(deltaTime) {
        const verticalStep = integrateConstantAcceleration(this.velocity.y, this.gravity, deltaTime);
        this.mesh.position.x += distanceForDelta(this.velocity.x, deltaTime);
        this.mesh.position.y += verticalStep.displacement;
        this.mesh.position.z += distanceForDelta(this.velocity.z, deltaTime);
        this.velocity.y = verticalStep.velocity;
        this.life -= deltaTime * 1.8;
        this.material.opacity = Math.max(0, this.life);
        if (this.life <= 0) {
            scene.remove(this.mesh);
            return false;
        }
        return true;
    }
}
const MAX_TRANSIENT_PARTICLES = 256;
const particlePool = new BoundedPool(MAX_TRANSIENT_PARTICLES, () => new Particle());
function spawnParticle(pos, color, scale, speedY) {
    const particle = particlePool.acquire();
    if (!particle) {
        return;
    }
    particle.activate(pos, color, scale, speedY);
    particles.push(particle);
}
function clearTransientParticles() {
    particles.forEach(particle => scene.remove(particle.mesh));
    particles = [];
    particlePool.clear();
}
function spawnBloodSpatter(pos) {
    for (let i = 0; i < 18; i++) {
        spawnParticle(pos, 0x990000, 0.05 + Math.random() * 0.04, 0.05);
    }
}
function spawnSparkSpatter(pos) {
    for (let i = 0; i < 8; i++) {
        spawnParticle(pos, 0xffd700, 0.03 + Math.random() * 0.03, 0.02);
    }
}
let sharedBulletMaterial = null;
function spawnBulletDecal(pos, normal) {
    if (!sharedBulletMaterial) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        grad.addColorStop(0.3, 'rgba(15, 15, 15, 0.9)');
        grad.addColorStop(0.7, 'rgba(30, 30, 30, 0.5)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        const tex = new THREE.CanvasTexture(canvas);
        sharedBulletMaterial = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4
        });
    }
    const size = 0.15 + Math.random() * 0.1;
    const geometry = new THREE.PlaneGeometry(size, size);
    const decal = new THREE.Mesh(geometry, sharedBulletMaterial);
    decal.position.copy(pos);
    const dummyTarget = pos.clone().add(normal);
    decal.lookAt(dummyTarget);
    decal.rotation.z = Math.random() * Math.PI * 2;
    scene.add(decal);
}
let sharedBloodMaterial = null;
function spawnBloodFloorDecal(pos) {
    if (!sharedBloodMaterial) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        for (let i = 0; i < 20; i++) {
            const x = 64 + (Math.random() - 0.5) * 60;
            const y = 64 + (Math.random() - 0.5) * 60;
            const r = 5 + Math.random() * 25;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(90, 0, 0, 0.95)');
            grad.addColorStop(1, 'rgba(50, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        const tex = new THREE.CanvasTexture(canvas);
        sharedBloodMaterial = new THREE.MeshStandardMaterial({
            map: tex,
            transparent: true,
            roughness: 0.1,
            metalness: 0.2,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4
        });
    }
    const size = 1.5 + Math.random() * 1.5;
    const geometry = new THREE.PlaneGeometry(size, size);
    const decal = new THREE.Mesh(geometry, sharedBloodMaterial);
    decal.position.set(pos.x, -1.98, pos.z);
    decal.rotation.x = -Math.PI / 2;
    decal.rotation.z = Math.random() * Math.PI * 2;
    scene.add(decal);
}
function checkCollisions(newX, newZ) {
    let resolvedX = newX;
    let resolvedZ = newZ;
    const currentGridX = Math.floor((newX + GRID_SIZE / 2) / GRID_SIZE);
    const currentGridZ = Math.floor((newZ + GRID_SIZE / 2) / GRID_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const gx = currentGridX + dx;
            const gz = currentGridZ + dz;
            if (gx < 0 || gx >= activeMap[0].length || gz < 0 || gz >= activeMap.length)
                continue;
            const type = activeMap[gz][gx];
            if (type === 1 || type === 2 || type === 3) {
                if (currentLevel === 2 && type === 1) {
                    const centerX = gx * GRID_SIZE;
                    const centerZ = gz * GRID_SIZE;
                    const diffX = resolvedX - centerX;
                    const diffZ = resolvedZ - centerZ;
                    const dist = Math.sqrt(diffX*diffX + diffZ*diffZ);
                    const trunkRadius = 0.5;
                    const minAllowedDist = PLAYER_RADIUS + trunkRadius;

                    if (dist < minAllowedDist && dist > 0.01) {
                        const overlap = minAllowedDist - dist;
                        resolvedX += (diffX / dist) * overlap;
                        resolvedZ += (diffZ / dist) * overlap;
                    }
                    continue; // Saltar chequeo cuadrado para árboles de jungla
                }

                // Si es compuerta normal interactiva
                if (type === 3) {
                    const door = interactiveDoors.find(d => d.gridX === gx && d.gridZ === gz);
                    if (door && door.isOpen) {
                        continue; // Bypasear colisión si está abierta
                    }
                }
                const boxMinX = gx * GRID_SIZE - GRID_SIZE / 2;
                const boxMaxX = gx * GRID_SIZE + GRID_SIZE / 2;
                const boxMinZ = gz * GRID_SIZE - GRID_SIZE / 2;
                const boxMaxZ = gz * GRID_SIZE + GRID_SIZE / 2;
                const closestX = Math.max(boxMinX, Math.min(resolvedX, boxMaxX));
                const closestZ = Math.max(boxMinZ, Math.min(resolvedZ, boxMaxZ));
                const diffX = resolvedX - closestX;
                const diffZ = resolvedZ - closestZ;
                const dist = Math.sqrt(diffX * diffX + diffZ * diffZ);
                if (dist < PLAYER_RADIUS) {
                    if (dist === 0)
                        continue;
                    // Si es compuerta de salida (2)
                    if (type === 2) {
                        const exitCollider = colliders.find(c => c.isExit);
                        if (exitCollider && exitCollider.unlocked) {
                            triggerVictory();
                            return { x: resolvedX, z: resolvedZ };
                        }
                        else {
                            // Advertencia rápida en HUD
                            if (fusesCollected >= 3) {
                                showFeedback("PRESIONA 'E' EN EL GENERADOR (LUZ ROJA) PARA ABRIR EL ESCAPE");
                            }
                            else {
                                showFeedback(`ESCAPE COMPROMETIDO. BUSCA FUSIBLES (${fusesCollected}/3 ENCONTRADOS)`);
                            }
                        }
                    }
                    const overlap = PLAYER_RADIUS - dist;
                    resolvedX += (diffX / dist) * overlap;
                    resolvedZ += (diffZ / dist) * overlap;
                }
            }
        }
    }
    return { x: resolvedX, z: resolvedZ };
}
// Colisiones de zombis con paredes y puertas cerradas
function checkZombieWallCollisions(zX, zZ) {
    let resolvedX = zX;
    let resolvedZ = zZ;
    const zRadius = 0.4;
    const currentGridX = Math.floor((zX + GRID_SIZE / 2) / GRID_SIZE);
    const currentGridZ = Math.floor((zZ + GRID_SIZE / 2) / GRID_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const gx = currentGridX + dx;
            const gz = currentGridZ + dz;
            if (gx < 0 || gx >= activeMap[0].length || gz < 0 || gz >= activeMap.length)
                continue;
            const type = activeMap[gz][gx];
            if (type === 1 || type === 2 || type === 3) {
                // --- COLISION CIRCULAR PERFECTA PARA ARBOLES (Nivel 2) ---
                if (currentLevel === 2 && type === 1) {
                    const centerX = gx * GRID_SIZE;
                    const centerZ = gz * GRID_SIZE;
                    const diffX = resolvedX - centerX;
                    const diffZ = resolvedZ - centerZ;
                    const dist = Math.sqrt(diffX*diffX + diffZ*diffZ);
                    const trunkRadius = 0.5;
                    const minAllowedDist = zRadius + trunkRadius;
                    if (dist < minAllowedDist && dist > 0.01) {
                        const overlap = minAllowedDist - dist;
                        resolvedX += (diffX / dist) * overlap;
                        resolvedZ += (diffZ / dist) * overlap;
                    }
                    continue;
                }
                if (type === 3) {
                    const door = interactiveDoors.find(d => d.gridX === gx && d.gridZ === gz);
                    if (door && door.isOpen) {
                        continue;
                    }
                }
                const boxMinX = gx * GRID_SIZE - GRID_SIZE / 2;
                const boxMaxX = gx * GRID_SIZE + GRID_SIZE / 2;
                const boxMinZ = gz * GRID_SIZE - GRID_SIZE / 2;
                const boxMaxZ = gz * GRID_SIZE + GRID_SIZE / 2;
                const closestX = Math.max(boxMinX, Math.min(resolvedX, boxMaxX));
                const closestZ = Math.max(boxMinZ, Math.min(resolvedZ, boxMaxZ));
                const diffX = resolvedX - closestX;
                const diffZ = resolvedZ - closestZ;
                const dist = Math.sqrt(diffX * diffX + diffZ * diffZ);
                if (dist < zRadius) {
                    if (dist === 0)
                        continue;
                    const overlap = zRadius - dist;
                    resolvedX += (diffX / dist) * overlap;
                    resolvedZ += (diffZ / dist) * overlap;
                }
            }
        }
    }
    return { x: resolvedX, z: resolvedZ };
}
// --- MECÁNICAS DE JUEGO ---
function damagePlayer(amount, isAcid = false) {
    if (player.health <= 0 || gameState !== 'PLAYING')
        return;
    const protectionBeforeDamage = player.health + player.armor;
    if (player.armor > 0) {
        const armorDamage = Math.floor(amount * 0.6);
        player.armor = Math.max(0, player.armor - armorDamage);
        player.health = Math.max(0, player.health - (amount - armorDamage));
    }
    else {
        player.health = Math.max(0, player.health - amount);
    }
    const damageTaken = Math.max(0, protectionBeforeDamage - player.health - player.armor);
    scoreState = recordPlayerDamage(scoreState, damageTaken);
    if (isAcid) {
        damageFlash.classList.add('acid');
        AudioSynth.playAcidBurn();
    }
    else {
        AudioSynth.playPlayerHurt();
    }
    damageFlash.classList.add('flash');
    setTimeout(() => {
        damageFlash.classList.remove('flash');
        damageFlash.classList.remove('acid');
    }, 120);
    camera.position.y -= 0.15;
    setTimeout(() => { camera.position.y = 1.8; }, 150);
    updateHUD();
    if (player.health <= 0) {
        triggerGameOver();
    }
}
function updateHUD() {
    healthVal.innerText = `${player.health}%`;
    healthBar.style.width = `${player.health}%`;
    armorVal.innerText = `${player.armor}%`;
    armorBar.style.width = `${player.armor}%`;
    ammoClipEl.innerText = player.ammoClip;
    ammoReserveEl.innerText = player.ammoReserve;
    if (player.ammoClip === 0 && player.ammoReserve > 0 && !player.isReloading) {
        showFeedback("PRESIONA 'R' PARA RECARGAR");
    }
}
function showFeedback(text) {
    feedbackMsg.innerText = text;
    feedbackMsg.classList.add('active');
    clearTimeout(feedbackMsg.timer);
    feedbackMsg.timer = setTimeout(() => {
        feedbackMsg.classList.remove('active');
    }, 2500);
}
function toggleFlashlight() {
    if (playerFlashlight) {
        flashlightUserEnabled = !flashlightUserEnabled;
        if (flashlightUserEnabled)
            flashlightCycleTimer = 0;
        setFlashlightOutput(flashlightUserEnabled);
        showFeedback(flashlightUserEnabled ? "LINTERNA: ENCENDIDA" : "LINTERNA: APAGADA");
    }
}
function setFlashlightOutput(enabled) {
    if (!playerFlashlight)
        return;
    playerFlashlight.visible = true;
    playerFlashlight.intensity = enabled ? FLASHLIGHT_BASE_INTENSITY : 0;
}
function updateFlashlightFlicker(deltaTime) {
    if (!playerFlashlight)
        return;
    if (!flashlightUserEnabled) {
        setFlashlightOutput(false);
        return;
    }
    flashlightCycleTimer = (flashlightCycleTimer + deltaTime) % FLASHLIGHT_FLICKER_CYCLE_SECONDS;
    const offStart = FLASHLIGHT_FLICKER_START_SECONDS + FLASHLIGHT_FLICKER_SECONDS;
    const secondFlickerStart = offStart + FLASHLIGHT_OFF_SECONDS;
    const flickerBeforeOff = flashlightCycleTimer >= FLASHLIGHT_FLICKER_START_SECONDS && flashlightCycleTimer < offStart;
    const fullyOff = flashlightCycleTimer >= offStart && flashlightCycleTimer < secondFlickerStart;
    const flickerBeforeOn = flashlightCycleTimer >= secondFlickerStart;
    if (fullyOff) {
        setFlashlightOutput(false);
    }
    else if (flickerBeforeOff || flickerBeforeOn) {
        setFlashlightOutput(Math.floor(flashlightCycleTimer * FLASHLIGHT_FLICKER_RATE) % 2 === 0);
    }
    else {
        setFlashlightOutput(true);
    }
}
// --- ACCIÓN: INTERACTUAR ---
function tryOpenDoor() {
    // 1. Evaluar si estamos frente a una compuerta neumática normal
    let closestDoor = null;
    let minDist = 3.5;
    interactiveDoors.forEach(door => {
        if (door.state === 'CLOSED') {
            const dist = player.position.distanceTo(door.mesh.position);
            if (dist < minDist) {
                minDist = dist;
                closestDoor = door;
            }
        }
    });
    if (closestDoor) {
        closestDoor.state = 'OPENING';
        showFeedback("ABRIENDO COMPUERTA...");
        AudioSynth.playDoorOpen();
        closestDoor.mesh.material.color.setHex(0xaaffaa); // LED verde
        return;
    }
    // 2. Evaluar si estamos frente al generador eléctrico final o la compuerta de salida
    const isCloseToConsole = (() => {
        if (!fuseBoxConsole)
            return false;
        const consolePos = fuseBoxConsole.group.position;
        // Calcular distancia horizontal (2D) ignorando la diferencia de altura Y
        const dx = player.position.x - consolePos.x;
        const dz = player.position.z - consolePos.z;
        return Math.sqrt(dx * dx + dz * dz) < 4.2; // Rango más amplio y cómodo
    })();
    const isCloseToExitDoor = (() => {
        const exitPosX = 15 * GRID_SIZE;
        const exitPosZ = 14 * GRID_SIZE;
        const dx = player.position.x - exitPosX;
        const dz = player.position.z - exitPosZ;
        return Math.sqrt(dx * dx + dz * dz) < 4.0; // Rango de tolerancia frente a la compuerta
    })();
    const canActivateExit = currentLevel === 2 ? isCloseToExitDoor : ((isCloseToConsole || isCloseToExitDoor) && fuseBoxConsole && !fuseBoxConsole.activated);
    if (canActivateExit) {
        if (currentLevel === 2) {
            const aliveCount = zombies.filter(z => z.state === 'ALIVE').length + spiders.filter(spider => spider.state === 'ALIVE').length;
            if (aliveCount > 0) {
                showFeedback(`DEBES ELIMINAR A TODOS LOS ZOMBIES PARA ESCAPAR (${aliveCount} RESTANTES)`);
                return;
            }
        } else if (currentLevel > 2 && !wiringFixed) {
            if (isCloseToConsole) {
                openWiringMinigame();
            }
            else {
                showFeedback("ERROR: CABLEADO AUXILIAR DAÑADO. REPARA EL PANEL CON 'E'");
            }
            return;
        }
        if (fusesCollected >= 3 || currentLevel === 2) {
            // Activar generador!
            if (fuseBoxConsole) {
                fuseBoxConsole.activated = true;
                fuseBoxConsole.led.material.color.setHex(0x00ff41); // Luz a verde
                if (fuseBoxConsole.ledLight.color) fuseBoxConsole.ledLight.color.setHex(0x00ff41);
            }
            AudioSynth.playPowerRestored();
            showFeedback("ESCAPE DESBLOQUEADO");
            // Desbloquear puerta de salida final
            const exitDoor = colliders.find(c => c.isExit);
            if (exitDoor) {
                exitDoor.unlocked = true;
                exitDoor.isOpen = true; // Quitar colisión física
                // Animar la compuerta de salida deslizándola hacia arriba
                const initialY = exitDoor.mesh.position.y;
                let slTimer = 0;
                const exitSlide = setInterval(() => {
                    slTimer += 0.05;
                    if (slTimer < 1.0) {
                        exitDoor.mesh.position.y = initialY + (slTimer * WALL_HEIGHT);
                    }
                    else {
                        exitDoor.mesh.position.y = initialY + WALL_HEIGHT;
                        clearInterval(exitSlide);
                    }
                }, 50);
            }
            // Encender las lámparas parpadeantes de la instalación de forma fija
            lights.forEach(item => {
                item.light.intensity = 1.2;
                item.lamp.material.color.setHex(0xffffff);
            });
            lights = []; // suspender el parpadeo
            // Montar visualmente los 3 fusibles en la consola
            if (currentLevel !== 2) {
                const fuseCapMat = new THREE.MeshStandardMaterial({ color: 0xe5a93b, roughness: 0.3, metalness: 0.85 });
                const fuseGlassMat = new THREE.MeshStandardMaterial({ color: 0x00ff41, emissive: 0x008822, transparent: true, opacity: 0.9 });
                for (let k = 0; k < 3; k++) {
                    const fuseMesh = new THREE.Group();
                    fuseMesh.name = `mounted_fuse_${k}`;
                    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8), fuseCapMat);
                    cap.position.y = 0.08;
                    const capBot = cap.clone();
                    capBot.position.y = -0.08;
                    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), fuseGlassMat);
                    fuseMesh.add(cap);
                    fuseMesh.add(capBot);
                    fuseMesh.add(glass);
                    fuseMesh.position.set(-0.18 + k * 0.18, 1.34, 0.12);
                    fuseMesh.rotation.x = Math.PI / 6;
                    fuseBoxConsole.group.add(fuseMesh);
                }
            }
        }
        else {
            showFeedback(`GENERADOR SIN ENERGÍA. REQUIERE 3 FUSIBLES (TIENES ${fusesCollected}/3)`);
        }
    }
}
// --- DISPARAR Y RECARGAR ---
function shoot() {
    if (player.isReloading)
        return;
    const activeWep = WEAPONS[player.activeWeapon];
    // Validar cooldown en armas semi-automáticas
    if (!activeWep.automatic && gunRecoilActive)
        return;
    if (player.ammoClip <= 0) {
        AudioSynth.playEmptyClick();
        showFeedback("MUNICIÓN AGOTADA");
        isMouseDown = false;
        return;
    }
    player.ammoClip--;
    activeWep.clip = player.ammoClip; // Sincronizar
    updateHUD();
    // Reproducir sonido de disparo según el arma activa
    if (player.activeWeapon === 'shotgun') {
        AudioSynth.playGunshot();
    }
    else if (player.activeWeapon === 'glock') {
        AudioSynth.playGlockShot();
    }
    else if (player.activeWeapon === 'm4') {
        AudioSynth.playM4Shot();
    }
    triggerMuzzleFlash();
    gunRecoilActive = true;
    gunRecoilTimer = 0;
    // ¡CORRECCIÓN CRÍTICA DE COLISIÓN DE APUNTA!: Actualizar matrices de la escena para zombis móviles antes de raycasting
    scene.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    raycaster.setFromCamera(center, camera);
    const targets = [];
    colliders.forEach(c => {
        if (!c.isOpen && c.mesh) {
            targets.push(c.mesh);
        }
    });
    zombies.forEach(z => {
        if (z.state === 'ALIVE') {
            if (z.zombieMesh) {
                targets.push(z.zombieMesh);
            }
            else {
                if (z.torso)
                    targets.push(z.torso);
                if (z.head)
                    targets.push(z.head);
                if (z.leftArm)
                    targets.push(z.leftArm);
                if (z.rightArm)
                    targets.push(z.rightArm);
                if (z.leftLeg)
                    targets.push(z.leftLeg);
                if (z.rightLeg)
                    targets.push(z.rightLeg);
            }
        }
    });
    spiders.forEach(spider => {
        if (spider.state === 'ALIVE') {
            spider.hitMeshes.forEach(mesh => targets.push(mesh));
        }
    });
    if (bossEnemy && bossEnemy.state === 'ALIVE' && bossEnemy.bossMesh) {
        targets.push(bossEnemy.bossMesh);
    }
    // Pasar true para realizar intersección recursiva (necesaria para el modelo GLTF)
    const intersects = raycaster.intersectObjects(targets, true);
    if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        const hitPoint = intersects[0].point;
        let hitZombie = null;
        let hitSpider = null;
        let hitBoss = false;
        let isHeadshot = false;
        if (bossEnemy && bossEnemy.state === 'ALIVE' && bossEnemy.bossMesh) {
            let parent = hitObj;
            let found = false;
            while (parent) {
                if (parent === bossEnemy.bossMesh) {
                    found = true;
                    break;
                }
                parent = parent.parent;
            }
            if (found) {
                hitBoss = true;
                const localHitY = hitPoint.y - bossEnemy.group.position.y;
                if (localHitY > 2.8) {
                    isHeadshot = true;
                }
            }
        }
        if (!hitBoss) {
            for (let spider of spiders) {
                if (spider.state !== 'ALIVE')
                    continue;
                let parent = hitObj;
                let found = false;
                while (parent) {
                    if (parent === spider.group) {
                        found = true;
                        break;
                    }
                    parent = parent.parent;
                }
                if (found) {
                    hitSpider = spider;
                    break;
                }
            }
        }
        if (!hitBoss && !hitSpider) {
            for (let z of zombies) {
                if (z.state === 'ALIVE') {
                    if (z.zombieMesh) {
                        // Verificar si el objeto impactado es descendiente del zombieMesh del modelo GLB
                        let parent = hitObj;
                        let found = false;
                        while (parent) {
                            if (parent === z.zombieMesh) {
                                found = true;
                                break;
                            }
                            parent = parent.parent;
                        }
                        if (found) {
                            hitZombie = z;
                            // Altura relativa Y para headshot en zombi de 1.8 de altura (escala base 1.35 de group)
                            const localHitY = hitPoint.y - z.group.position.y;
                            if (localHitY > 1.45) {
                                isHeadshot = true;
                            }
                            break;
                        }
                    }
                    else {
                        // Soporte procedimental
                        if (hitObj === z.torso ||
                            hitObj === z.head ||
                            hitObj === z.leftArm ||
                            hitObj === z.rightArm ||
                            hitObj === z.leftLeg ||
                            hitObj === z.rightLeg) {
                            hitZombie = z;
                            if (hitObj === z.head) {
                                isHeadshot = true;
                            }
                            break;
                        }
                    }
                }
            }
        }
        if (hitBoss) {
            let dmg = activeWep.damage;
            if (isHeadshot) {
                showFeedback("¡TIRO CRÍTICO AL JEFE!");
            }
            bossEnemy.damage(dmg, isHeadshot);
            spawnBloodSpatter(hitPoint);
        }
        else if (hitSpider) {
            hitSpider.damage(activeWep.damage);
            spawnBloodSpatter(hitPoint);
            spawnBloodFloorDecal(hitPoint);
        }
        else if (hitZombie) {
            let dmg = activeWep.damage;
            if (isHeadshot) {
                dmg = dmg * 3; // Triple daño por headshot
                showFeedback("¡TIRO A LA CABEZA!");
            }
            hitZombie.damage(dmg);
            spawnBloodSpatter(hitPoint);
            spawnBloodFloorDecal(hitPoint);
        }
        else {
            spawnSparkSpatter(hitPoint);
            if (intersects[0].face) {
                const normal = intersects[0].face.normal.clone().transformDirection(hitObj.matrixWorld);
                spawnBulletDecal(hitPoint, normal);
            }
        }
    }
    crosshair.classList.add('firing');
    setTimeout(() => { crosshair.classList.remove('firing'); }, 80);
}
function triggerMuzzleFlash() {
    muzzleLight.intensity = 3.5;
    muzzleFlashSprite.material.opacity = 0.95;
    setTimeout(() => {
        muzzleLight.intensity = 0;
        muzzleFlashSprite.material.opacity = 0;
    }, 60);
}
function reload() {
    if (player.isReloading || player.ammoClip === player.clipMax || player.ammoReserve <= 0)
        return;
    player.isReloading = true;
    showFeedback("RECARGANDO...");
    AudioSynth.playReload();
    const originalY = gunGroup.position.y;
    let t = 0;
    // Personalizar duración de recarga
    const activeWep = WEAPONS[player.activeWeapon];
    const reloadDuration = player.activeWeapon === 'shotgun' ? 1000 : (player.activeWeapon === 'm4' ? 820 : 600);
    const steps = 15;
    const intervalTime = reloadDuration / steps;
    const reloadAnim = setInterval(() => {
        t += 1 / steps;
        if (t < 0.5) {
            gunGroup.position.y = originalY - (t * 0.3);
        }
        else if (t < 1.0) {
            gunGroup.position.y = (originalY - 0.15) + ((t - 0.5) * 0.3);
        }
        else {
            gunGroup.position.y = originalY;
            clearInterval(reloadAnim);
            const needed = player.clipMax - player.ammoClip;
            const transfer = Math.min(needed, player.ammoReserve);
            player.ammoClip += transfer;
            player.ammoReserve -= transfer;
            // Sincronizar cargadores
            activeWep.clip = player.ammoClip;
            activeWep.reserve = player.ammoReserve;
            player.isReloading = false;
            updateHUD();
            showFeedback("RECARGADO");
        }
    }, intervalTime);
}
// --- FLUJO DE ESTADOS DE JUEGO ---
async function startGame() {
    AudioSynth.init();
    const shouldRebuildInitialMap = builtMapLevel !== 1;
    const shouldReuseInitialEntities = !shouldRebuildInitialMap && gameState === 'MENU' && zombies.length > 0 && fuses.length === 3;
    // Restablecer variables de progresión y tienda
    currentLevel = 1;
    supplyPoints = 0;
    scoreState = createInitialScoreState(performance.now());
    unlockedWeapons.glock = false;
    unlockedWeapons.m4 = false;
    wiringFixed = false;
    clearSpiders();
    document.getElementById('level-display').innerText = `SECTOR C-14   |   NIVEL ${currentLevel}`;
    // Level 1 is already built and compiled behind the start menu. Reusing it
    // avoids invalidating programs and recompiling shaders on JUGAR or retry.
    if (shouldRebuildInitialMap) {
        clearCurrentMap();
        updateLevelEnvironment();
        buildMap3D();
        await addBloodWallMessages(scene, currentLevel);
    }
    // Restablecer textos de victoria original en el overlay
    const titleEl = victoryOverlay.querySelector('.victory-title');
    const subtitleEl = victoryOverlay.querySelector('.subtitle');
    const msgEl = victoryOverlay.querySelector('.victory-message');
    const btnEl = victoryOverlay.querySelector('.victory-btn');
    if (titleEl)
        titleEl.innerText = "MISIÓN COMPLETADA";
    if (subtitleEl)
        subtitleEl.innerText = "SECTOR PURGADO COMPLETAMENTE";
    if (msgEl)
        msgEl.innerText = "Has restaurado la energía y escapado con vida de la instalación. Excelente trabajo, soldado.";
    if (btnEl)
        btnEl.innerText = "REINICIAR OPERACIÓN";
    // Restablecer inventarios de armas
    WEAPONS.shotgun.clip = WEAPONS.shotgun.clipMax;
    WEAPONS.shotgun.reserve = 24;
    WEAPONS.glock.clip = WEAPONS.glock.clipMax;
    WEAPONS.glock.reserve = 51;
    WEAPONS.m4.clip = WEAPONS.m4.clipMax;
    WEAPONS.m4.reserve = 90;
    player.activeWeapon = 'shotgun';
    shotgunMeshGroup.visible = true;
    glockMeshGroup.visible = false;
    m4MeshGroup.visible = false;
    player.health = MAX_HEALTH;
    player.armor = MAX_ARMOR;
    player.ammoClip = WEAPONS.shotgun.clip;
    player.ammoReserve = WEAPONS.shotgun.reserve;
    player.clipMax = WEAPONS.shotgun.clipMax;
    document.getElementById('weapon-name').innerText = WEAPONS.shotgun.name;
    if (currentLevel === 2) {
        player.position.set(GRID_SIZE * 10.0, 1.8, GRID_SIZE * 10.0);
    } else {
        player.position.set(GRID_SIZE * 1.0, 1.8, GRID_SIZE * 1.0);
    }
    player.yaw = 0;
    player.pitch = 0;
    player.isReloading = false;
    camera.position.copy(player.position);
    camera.rotation.set(0, 0, 0);
    flashlightCycleTimer = 0;
    flashlightUserEnabled = true;
    setFlashlightOutput(true);
    // Resetea compuerta salida
    const exitDoor = colliders.find(c => c.isExit);
    if (exitDoor && exitDoor.mesh) {
        exitDoor.mesh.position.y = WALL_HEIGHT / 2;
        exitDoor.unlocked = false;
        exitDoor.isOpen = false;
    }
    // Resetea consola generadora
    if (fuseBoxConsole) {
        fuseBoxConsole.activated = false;
        fuseBoxConsole.led.material.color.setHex(0xff0000);
        if (fuseBoxConsole.ledLight.color) fuseBoxConsole.ledLight.color.setHex(0xff0000);
        // Limpiar fusibles montados
        for (let k = 0; k < 3; k++) {
            try {
                const fuseMesh = fuseBoxConsole.group.getObjectByName(`mounted_fuse_${k}`);
                if (fuseMesh)
                    fuseBoxConsole.group.remove(fuseMesh);
            }
            catch (e) { }
        }
    }
    // Resetea compuertas normales interactivas
    interactiveDoors.forEach(door => {
        door.mesh.position.y = WALL_HEIGHT / 2;
        door.mesh.material.color.setHex(0xffffff);
        door.state = 'CLOSED';
        door.isOpen = false;
    });
    // Limpiar partículas viejas y proyectiles
    clearTransientParticles();
    acidProjectiles.forEach(p => scene.remove(p.mesh));
    acidProjectiles = [];
    if (!shouldReuseInitialEntities) {
        // Spawnear fusibles
        spawnFuses();
        // Spawneo de zombis
        spawnZombies();
    }
    updateHUD();
    gameState = 'PLAYING';
    menuOverlay.classList.remove('active');
    deathOverlay.classList.remove('active');
    victoryOverlay.classList.remove('active');
    document.getElementById('upgrade-overlay').classList.remove('active');
    document.body.requestPointerLock();
    showFeedback("SISTEMA OPERATIVO. RECUPERA LOS 3 FUSIBLES");
}
function triggerGameOver() {
    gameState = 'GAMEOVER';
    isMouseDown = false;
    document.exitPointerLock();
    deathOverlay.classList.add('active');
    AudioSynth.stopHorrorMusic();
    AudioSynth.playLoseTune();
    const scoreSnapshot = createScorePublishSnapshot();
    const paidReceiptId = entryGateState.isPaid && entryGateState.verifiedReceiptId ? entryGateState.verifiedReceiptId : '';
    renderDeathSummary(scoreSnapshot);
    if (playerNostrPubkey) {
        publishScore()
            .then(scorePublishResult => {
                if (paidReceiptId) {
                    return settlePaidRunAfterDeath(scorePublishResult, paidReceiptId);
                }
                return undefined;
            })
            .catch(error => console.error('Publish score error:', error));
    }
    else if (paidReceiptId) {
        reportPaidRunLoss(paidReceiptId)
            .then(() => resetEntryGateState())
            .catch(error => {
                console.error('Jackpot loss publish error:', error);
                resetEntryGateState();
            });
        return;
    }
    if (!paidReceiptId) {
        resetEntryGateState();
    }
}
function triggerVictory() {
    isMouseDown = false;
    document.exitPointerLock();
    AudioSynth.stopHorrorMusic();
    if (currentLevel === 4) {
        // Capítulo 1 Completado! (Ahora después del nivel 4)
        gameState = 'VICTORY';
        victoryOverlay.classList.add('active');
        const titleEl = victoryOverlay.querySelector('.victory-title');
        const subtitleEl = victoryOverlay.querySelector('.subtitle');
        const msgEl = victoryOverlay.querySelector('.victory-message');
        const btnEl = victoryOverlay.querySelector('.victory-btn');
        if (titleEl)
            titleEl.innerText = "CAPÍTULO 1 COMPLETADO";
        if (subtitleEl)
            subtitleEl.innerText = "DERROTASTE AL INFERNAL IRONCLAD";
        if (msgEl) {
            msgEl.innerHTML = 'Has escapado de la instalación biológica, cruzado la selva hostil, sobrevivido al frío extremo de la montaña y purgado la amenaza volcánica.<br><br><strong>PROCESANDO JACKPOT...</strong>';
        }
        if (btnEl)
            btnEl.innerText = "VOLVER A JUGAR";
        AudioSynth.playWinTune();
        if (playerNostrPubkey) {
            publishScore().catch(error => console.error('Publish score error:', error));
        }
        void finalizeBossJackpotVictory(msgEl);
    }
    else {
        // Ir a la tienda / refugio
        gameState = 'SHOP';
        supplyPoints += 1;
        document.getElementById('supply-points').innerText = supplyPoints;
        updateShopButtons();
        document.getElementById('upgrade-overlay').classList.add('active');
        AudioSynth.playWinTune();
    }
}
// --- MECÁNICAS DE TIENDA Y CAMBIO DE ARMAS ---
function switchWeapon(type) {
    if (player.isReloading || gameState !== 'PLAYING')
        return;
    if (!unlockedWeapons[type]) {
        showFeedback(`ARMA BLOQUEADA: COMPRA EN EL REFUGIO`);
        return;
    }
    player.activeWeapon = type;
    // Alternar visibilidad de mallas 3D
    shotgunMeshGroup.visible = (type === 'shotgun');
    glockMeshGroup.visible = (type === 'glock');
    m4MeshGroup.visible = (type === 'm4');
    const activeWep = WEAPONS[type];
    player.ammoClip = activeWep.clip;
    player.ammoReserve = activeWep.reserve;
    player.clipMax = activeWep.clipMax;
    document.getElementById('weapon-name').innerText = activeWep.name;
    updateHUD();
    AudioSynth.playMetallicClick(1000, 0.08, 0.15);
    showFeedback(`EQUIPADO: ${activeWep.name}`);
}
function updateShopButtons() {
    const buyGlockBtn = document.getElementById('buy-glock-btn');
    const buyM4Btn = document.getElementById('buy-m4-btn');
    const buyRationsBtn = document.getElementById('buy-rations-btn');
    if (unlockedWeapons.glock) {
        buyGlockBtn.innerText = "DESBLOQUEADO";
        buyGlockBtn.className = "retro-btn shop-btn unlocked";
        buyGlockBtn.disabled = true;
    }
    else {
        buyGlockBtn.innerText = "DESBLOQUEAR";
        buyGlockBtn.className = "retro-btn shop-btn";
        buyGlockBtn.disabled = (supplyPoints < 1);
    }
    if (unlockedWeapons.m4) {
        buyM4Btn.innerText = "DESBLOQUEADO";
        buyM4Btn.className = "retro-btn shop-btn unlocked";
        buyM4Btn.disabled = true;
    }
    else {
        buyM4Btn.innerText = "DESBLOQUEAR";
        buyM4Btn.className = "retro-btn shop-btn";
        buyM4Btn.disabled = (supplyPoints < 2);
    }
    buyRationsBtn.disabled = (supplyPoints < 1 || (player.health >= MAX_HEALTH && player.armor >= MAX_ARMOR));
}
function buyGlock() {
    if (supplyPoints >= 1 && !unlockedWeapons.glock) {
        supplyPoints -= 1;
        unlockedWeapons.glock = true;
        document.getElementById('supply-points').innerText = supplyPoints;
        updateShopButtons();
        AudioSynth.playReload();
        showFeedback("GLOCK 17 DESBLOQUEADA");
    }
}
function buyM4() {
    if (supplyPoints >= 2 && !unlockedWeapons.m4) {
        supplyPoints -= 2;
        unlockedWeapons.m4 = true;
        document.getElementById('supply-points').innerText = supplyPoints;
        updateShopButtons();
        AudioSynth.playReload();
        showFeedback("FUSIL M4 CARBINE DESBLOQUEADO");
    }
}
function buyRations() {
    if (supplyPoints >= 1) {
        supplyPoints -= 1;
        player.health = Math.min(MAX_HEALTH, player.health + 50);
        player.armor = Math.min(MAX_ARMOR, player.armor + 50);
        document.getElementById('supply-points').innerText = supplyPoints;
        updateShopButtons();
        AudioSynth.playFusePickup();
        showFeedback("SUMINISTROS COMPRADOS (+50% HP / ARMADURA)");
    }
}
async function startNextLevel() {
    document.body.requestPointerLock();
    currentLevel++;
    document.getElementById('level-display').innerText = `SECTOR C-14   |   NIVEL ${currentLevel}`;
    clearSpiders();
    // Reconstruir el mapa para el nuevo nivel
    clearCurrentMap();
    updateLevelEnvironment();
    buildMap3D();
    await addBloodWallMessages(scene, currentLevel);
    // Restablecer variables del minijuego de cableado
    wiringFixed = false;
    // Restaurar salud y armadura al 100% en el nuevo nivel
    player.health = MAX_HEALTH;
    player.armor = MAX_ARMOR;
    // Resetea compuertas y salida
    colliders.forEach(c => { if (c.isExit)
        c.unlocked = false; });
    const exitDoor = colliders.find(c => c.isExit);
    if (exitDoor && exitDoor.mesh) {
        exitDoor.mesh.position.y = WALL_HEIGHT / 2;
        exitDoor.isOpen = false;
    }
    if (fuseBoxConsole) {
        fuseBoxConsole.activated = false;
        fuseBoxConsole.led.material.color.setHex(0xff0000);
        if (fuseBoxConsole.ledLight.color) fuseBoxConsole.ledLight.color.setHex(0xff0000);
        for (let k = 0; k < 3; k++) {
            try {
                const fuseMesh = fuseBoxConsole.group.getObjectByName(`mounted_fuse_${k}`);
                if (fuseMesh)
                    fuseBoxConsole.group.remove(fuseMesh);
            }
            catch (e) { }
        }
    }
    interactiveDoors.forEach(door => {
        door.mesh.position.y = WALL_HEIGHT / 2;
        door.mesh.material.color.setHex(0xffffff);
        door.state = 'CLOSED';
        door.isOpen = false;
    });
    if (currentLevel === 2) {
        player.position.set(GRID_SIZE * 10.0, 1.8, GRID_SIZE * 10.0);
    } else {
        player.position.set(GRID_SIZE * 1.0, 1.8, GRID_SIZE * 1.0);
    }
    camera.position.copy(player.position);
    // Limpiar partículas y proyectiles
    clearTransientParticles();
    acidProjectiles.forEach(p => scene.remove(p.mesh));
    acidProjectiles = [];
    // Spawnear fusibles
    spawnFuses();
    // Spawneo de zombis con dificultad incrementada
    spawnZombies();
    // Recargar parcialmente las reservas al pasar de nivel
    WEAPONS.shotgun.reserve = Math.min(WEAPONS.shotgun.reserveMax, WEAPONS.shotgun.reserve + 16);
    WEAPONS.glock.reserve = Math.min(WEAPONS.glock.reserveMax, WEAPONS.glock.reserve + 34);
    WEAPONS.m4.reserve = Math.min(WEAPONS.m4.reserveMax, WEAPONS.m4.reserve + 60);
    // Sincronizar arma activa
    const activeWep = WEAPONS[player.activeWeapon];
    player.ammoClip = activeWep.clip;
    player.ammoReserve = activeWep.reserve;
    player.clipMax = activeWep.clipMax;
    updateHUD();
    gameState = 'PLAYING';
    document.getElementById('upgrade-overlay').classList.remove('active');
    AudioSynth.init();
    showFeedback(`INICIANDO NIVEL ${currentLevel}. RECUPERA LOS FUSIBLES`);
}
// --- MINIJUEGO DE CABLEADO (CANVAS DRAG & DROP) ---
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
}
function openWiringMinigame() {
    gameState = 'WIRING';
    document.exitPointerLock();
    const overlay = document.getElementById('wiring-overlay');
    if (overlay)
        overlay.classList.add('active');
    const symbols = ['O', 'Δ', '☆', 'X'];
    const colors = ['#ff3333', '#ffff33', '#3333ff', '#33ff33'];
    const itemsLeft = [
        { symbol: 'O', color: '#ff3333' },
        { symbol: 'Δ', color: '#ffff33' },
        { symbol: '☆', color: '#3333ff' },
        { symbol: 'X', color: '#33ff33' }
    ];
    const itemsRight = [...itemsLeft];
    shuffleArray(itemsLeft);
    shuffleArray(itemsRight);
    leftSockets = itemsLeft.map((item, idx) => ({
        id: idx,
        x: 60,
        y: 80 + idx * 80,
        symbol: item.symbol,
        color: item.color,
        connectedTo: null
    }));
    rightSockets = itemsRight.map((item, idx) => ({
        id: idx,
        x: 440,
        y: 80 + idx * 80,
        symbol: item.symbol,
        color: item.color
    }));
    draggingWireIdx = -1;
    drawWiring();
}
function closeWiringMinigame() {
    const overlay = document.getElementById('wiring-overlay');
    if (overlay)
        overlay.classList.remove('active');
    gameState = 'PLAYING';
    document.body.requestPointerLock();
}
function drawWiring() {
    const canvas = document.getElementById('wiring-canvas');
    if (!canvas)
        return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#121216';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Cuadrícula retro
    ctx.strokeStyle = '#1b1b22';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    // Dibujar cables conectados
    leftSockets.forEach(left => {
        if (left.connectedTo !== null) {
            const right = rightSockets[left.connectedTo];
            ctx.strokeStyle = left.color;
            ctx.lineWidth = 5;
            ctx.shadowBlur = 8;
            ctx.shadowColor = left.color;
            ctx.beginPath();
            ctx.moveTo(left.x, left.y);
            ctx.bezierCurveTo(left.x + 150, left.y, right.x - 150, right.y, right.x, right.y);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    });
    // Dibujar cable siendo arrastrado
    if (draggingWireIdx !== -1) {
        const left = leftSockets[draggingWireIdx];
        ctx.strokeStyle = left.color;
        ctx.lineWidth = 5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = left.color;
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.bezierCurveTo(left.x + 150, left.y, mousePos.x - 100, mousePos.y, mousePos.x, mousePos.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    // Dibujar sockets izquierdos
    leftSockets.forEach(socket => {
        ctx.fillStyle = '#1e1e24';
        ctx.strokeStyle = socket.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(socket.x, socket.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(socket.symbol, socket.x - 28, socket.y);
        ctx.fillStyle = socket.color;
        ctx.beginPath();
        ctx.arc(socket.x, socket.y, 6, 0, Math.PI * 2);
        ctx.fill();
    });
    // Dibujar sockets derechos
    rightSockets.forEach(socket => {
        ctx.fillStyle = '#1e1e24';
        ctx.strokeStyle = socket.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(socket.x, socket.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(socket.symbol, socket.x + 28, socket.y);
        ctx.fillStyle = socket.color;
        ctx.beginPath();
        ctx.arc(socket.x, socket.y, 6, 0, Math.PI * 2);
        ctx.fill();
    });
}
function checkWiringVictory() {
    const allConnected = leftSockets.every(s => s.connectedTo !== null);
    if (allConnected) {
        wiringFixed = true;
        showFeedback("CABLEADO AUXILIAR RESTAURADO");
        AudioSynth.playPowerRestored();
        if (fuseBoxConsole && fuseBoxConsole.wiringLed) {
            fuseBoxConsole.wiringLed.material.color.setHex(0x00ff41);
            if (fuseBoxConsole.wiringLedLight.color) fuseBoxConsole.wiringLedLight.color.setHex(0x00ff41);
            fuseBoxConsole.wiringLedLight.intensity = 0.8;
        }
        setTimeout(() => {
            closeWiringMinigame();
        }, 1000);
    }
}
function setupWiringCanvasEvents() {
    const canvas = document.getElementById('wiring-canvas');
    if (!canvas)
        return;
    canvas.addEventListener('mousedown', (e) => {
        if (gameState !== 'WIRING')
            return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        for (let i = 0; i < leftSockets.length; i++) {
            const socket = leftSockets[i];
            const dist = Math.sqrt((mx - socket.x) ** 2 + (my - socket.y) ** 2);
            if (dist < 25) {
                draggingWireIdx = i;
                mousePos.x = mx;
                mousePos.y = my;
                socket.connectedTo = null;
                AudioSynth.playMetallicClick(800, 0.05, 0.1);
                drawWiring();
                break;
            }
        }
    });
    canvas.addEventListener('mousemove', (e) => {
        if (gameState !== 'WIRING' || draggingWireIdx === -1)
            return;
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;
        drawWiring();
    });
    canvas.addEventListener('mouseup', (e) => {
        if (gameState !== 'WIRING' || draggingWireIdx === -1)
            return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        let connected = false;
        for (let i = 0; i < rightSockets.length; i++) {
            const socket = rightSockets[i];
            const dist = Math.sqrt((mx - socket.x) ** 2 + (my - socket.y) ** 2);
            if (dist < 25) {
                if (socket.symbol === leftSockets[draggingWireIdx].symbol) {
                    leftSockets[draggingWireIdx].connectedTo = i;
                    AudioSynth.playMetallicClick(1200, 0.1, 0.15);
                    connected = true;
                    checkWiringVictory();
                }
                else {
                    AudioSynth.playMetallicClick(300, 0.15, 0.2);
                    showFeedback("ERROR: SÍMBOLOS INCOMPATIBLES");
                }
                break;
            }
        }
        if (!connected) {
            AudioSynth.playMetallicClick(400, 0.05, 0.1);
        }
        draggingWireIdx = -1;
        drawWiring();
    });
}
// --- BINDING DE CONTROLES ---
function setupControls() {
    applyStartMenuVisibility();
    initNostrUI();
    void loadStartupLeaderboard();
    void initLunaNegraUI();
    void loadCurrentJackpot();
    updateEntryGateUI();
    freeStartBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', handlePaidStart);
    winBtn.addEventListener('click', handlePaidStart);
    entryGatePayBtn?.addEventListener('click', () => {
        void requestEntryInvoice();
    });
    deathClaimBtn?.addEventListener('click', () => {
        void claimLeaderboardJackpot();
    });
    // Eventos de la tienda
    document.getElementById('buy-glock-btn').addEventListener('click', buyGlock);
    document.getElementById('buy-m4-btn').addEventListener('click', buyM4);
    document.getElementById('buy-rations-btn').addEventListener('click', buyRations);
    document.getElementById('next-level-btn').addEventListener('click', startNextLevel);
    // Eventos del minijuego de cableado
    document.getElementById('abort-wiring-btn').addEventListener('click', closeWiringMinigame);
    setupWiringCanvasEvents();
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === document.body) {
            if (gameState === 'MENU' || gameState === 'GAMEOVER' || gameState === 'VICTORY' || gameState === 'SHOP' || gameState === 'WIRING') {
                document.exitPointerLock();
            }
        }
        else {
            isMouseDown = false;
        }
    });
    document.getElementById('game-container').addEventListener('click', () => {
        if (gameState === 'PLAYING' && document.pointerLockElement !== document.body) {
            document.body.requestPointerLock();
        }
    });
    window.addEventListener('keydown', (e) => {
        const k = e.key.toUpperCase();
        keyboard[k] = true;
        if (gameState === 'PLAYING') {
            if (k === 'R') reload();
            if (k === 'F') toggleFlashlight();
            if (k === 'E') tryOpenDoor();
            if (k === '1') switchWeapon('shotgun');
            if (k === '2') switchWeapon('glock');
            if (k === '3') switchWeapon('m4');
            // Cheat code para saltar nivel
            if (k === 'K') {
                if (currentLevel < 4) {
                    showFeedback("TRUCO ACTIVADO: VICTORIA INSTANTÁNEA");
                    triggerVictory();
                }
                else {
                    showFeedback("YA ESTÁS EN EL ÚLTIMO NIVEL.");
                }
            }
        }
    });
    window.addEventListener('keyup', (e) => {
        const k = e.key.toUpperCase();
        keyboard[k] = false;
    });
    document.addEventListener('mousemove', (e) => {
        if (gameState !== 'PLAYING' || document.pointerLockElement !== document.body)
            return;
        const sensitivity = 0.0025;
        player.yaw -= e.movementX * sensitivity;
        player.pitch -= e.movementY * sensitivity;
        player.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, player.pitch));
        camera.rotation.order = "YXZ";
        camera.rotation.set(player.pitch, player.yaw, 0);
    });
    window.addEventListener('mousedown', (e) => {
        if (gameState === 'PLAYING' && document.pointerLockElement === document.body && e.button === 0) {
            isMouseDown = true;
            shoot();
        }
    });
    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            isMouseDown = false;
        }
    });
}
function onWindowResize() {
    resizeRenderTargets();
}
function resizeRenderTargets() {
    if (!camera || !renderer || !composer || !adaptiveResolutionState) {
        return;
    }
    const viewport = getRenderViewport(window.innerWidth, window.innerHeight);
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(adaptiveResolutionState.scale);
    renderer.setSize(viewport.width, viewport.height);
    if (typeof composer.setPixelRatio === 'function') {
        composer.setPixelRatio(adaptiveResolutionState.scale);
    }
    composer.setSize(viewport.width, viewport.height);
}
// --- BIOMONITOR ECG PROCEDIMENTAL EN TIEMPO REAL ---
const bioCanvas = document.getElementById('biomonitor-canvas');
const bioCtx = bioCanvas.getContext('2d');
let bioTime = 0;
function drawBiomonitor(deltaTime) {
    if (!bioCtx)
        return;
    bioTime += deltaTime;
    bioCtx.fillStyle = '#051305';
    bioCtx.fillRect(0, 0, 60, 60);
    bioCtx.strokeStyle = 'rgba(0, 255, 65, 0.12)';
    bioCtx.lineWidth = 1;
    bioCtx.beginPath();
    bioCtx.arc(30, 30, 26, 0, Math.PI * 2);
    bioCtx.stroke();
    bioCtx.beginPath();
    bioCtx.arc(30, 30, 13, 0, Math.PI * 2);
    bioCtx.stroke();
    bioCtx.beginPath();
    bioCtx.moveTo(4, 30);
    bioCtx.lineTo(56, 30);
    bioCtx.moveTo(30, 4);
    bioCtx.lineTo(30, 56);
    bioCtx.stroke();
    let color = '#00ff41';
    let pulseInterval = 1.0;
    if (player.health <= 0) {
        bioCtx.strokeStyle = '#6a0000';
        bioCtx.lineWidth = 2.5;
        bioCtx.beginPath();
        bioCtx.moveTo(4, 30);
        bioCtx.lineTo(56, 30);
        bioCtx.stroke();
        return;
    }
    else if (player.health < 30) {
        color = '#ff2020';
        pulseInterval = 0.35;
    }
    else if (player.health < 70) {
        color = '#ff9900';
        pulseInterval = 0.6;
    }
    bioCtx.strokeStyle = color;
    bioCtx.lineWidth = 2;
    bioCtx.shadowBlur = 3;
    bioCtx.shadowColor = color;
    bioCtx.beginPath();
    const width = 52;
    const startX = 4;
    for (let x = 0; x <= width; x++) {
        const screenX = startX + x;
        const phase = ((bioTime / pulseInterval) + (x / width)) % 1.0;
        let y = 30;
        if (phase > 0.1 && phase < 0.16) {
            const pVal = (phase - 0.1) / 0.06;
            y = 30 - Math.sin(pVal * Math.PI) * 2.5;
        }
        else if (phase >= 0.16 && phase < 0.18) {
            const qVal = (phase - 0.16) / 0.02;
            y = 30 + qVal * 2;
        }
        else if (phase >= 0.18 && phase < 0.23) {
            const qrsVal = (phase - 0.18) / 0.05;
            if (qrsVal < 0.5) {
                y = 32 - (qrsVal / 0.5) * 19;
            }
            else {
                y = 13 + ((qrsVal - 0.5) / 0.5) * 21;
            }
        }
        else if (phase >= 0.23 && phase < 0.26) {
            const sVal = (phase - 0.23) / 0.03;
            y = 34 - (1 - sVal) * 4;
        }
        else if (phase >= 0.32 && phase < 0.44) {
            const tVal = (phase - 0.32) / 0.12;
            y = 30 - Math.sin(tVal * Math.PI) * 4;
        }
        if (x === 0)
            bioCtx.moveTo(screenX, y);
        else
            bioCtx.lineTo(screenX, y);
    }
    bioCtx.stroke();
    bioCtx.shadowBlur = 0;
}
// --- BUCLE DE RENDERIZADO PRINCIPAL (ANIMATE) ---
function animate() {
    requestAnimationFrame(animate);
    
    // Chunk visibility logic: Show roughly 40 blocks ahead and 10 behind
    const playerZ = Math.floor(player.position.z / GRID_SIZE);
    mapChunks.forEach(chunk => {
        const isVisible = (chunk.zIndex >= playerZ - 10 && chunk.zIndex <= playerZ + 40);
        if (chunk.mesh.visible !== isVisible) {
            chunk.mesh.visible = isVisible;
        }
    });

    const frameDelta = clock.getDelta();
    const previousRenderScale = adaptiveResolutionState.scale;
    adaptiveResolutionState = sampleAdaptiveResolution(
        adaptiveResolutionState,
        frameDelta > 0 ? 1 / frameDelta : 0,
        frameDelta,
    );
    if (adaptiveResolutionState.scale !== previousRenderScale) {
        resizeRenderTargets();
    }
    const deltaTime = clampSimulationDelta(frameDelta);
    drawBiomonitor(deltaTime);
    if (typeof grassMaterial !== 'undefined' && grassMaterial) {
        grassMaterial.uniforms.time.value = performance.now() * 0.002;
    }
    if (grassMaterialShader) {
        grassMaterialShader.uniforms.time.value = performance.now() * 0.001;
    }
    if (leafMaterialShader) {
        leafMaterialShader.uniforms.time.value = performance.now() * 0.001;
    }
    if (cloudMesh && cloudMesh.material.map) {
        cloudMesh.material.map.offset.x -= deltaTime * 0.02;
    }
    if (gameState === 'PLAYING') {
        updateFlashlightFlicker(deltaTime);
        // Disparar en ráfaga para armas automáticas
        const activeWep = WEAPONS[player.activeWeapon];
        if (activeWep.automatic && isMouseDown && !player.isReloading && !gunRecoilActive) {
            autoFireTimer += deltaTime * 1000;
            if (autoFireTimer >= activeWep.fireInterval) {
                shoot();
                autoFireTimer = 0;
            }
        }
        else if (!isMouseDown) {
            autoFireTimer = activeWep.fireInterval;
        }
        // Actualizar luces parpadeantes
        lights.forEach(item => {
            item.flickerTimer += deltaTime;
            const noise = Math.sin(item.flickerTimer * 10) * Math.cos(item.flickerTimer * 4.3);
            if (noise > 0.4) {
                item.light.intensity = item.dimIntensity ?? 0.1;
                item.lamp.material.color.setHex(0x332211);
            }
            else {
                item.light.intensity = item.baseIntensity ?? (item.isRed ? 1.5 : 1.2);
                item.lamp.material.color.setHex(item.isRed ? 0xcc0000 : 0xe59400);
            }
        });
        // Actualizar luces de cableado auxiliar en consola
        if (currentLevel >= 2 && fuseBoxConsole && fuseBoxConsole.wiringLed) {
            if (!wiringFixed) {
                const flash = Math.sin(clock.getElapsedTime() * 8) > 0;
                fuseBoxConsole.wiringLed.material.color.setHex(flash ? 0xffaa00 : 0x221100);
                fuseBoxConsole.wiringLedLight.intensity = flash ? 0.8 : 0.0;
            }
            else {
                fuseBoxConsole.wiringLed.material.color.setHex(0x00ff41);
                if (fuseBoxConsole.wiringLedLight.color) fuseBoxConsole.wiringLedLight.color.setHex(0x00ff41);
                fuseBoxConsole.wiringLedLight.intensity = 0.8;
            }
        }
        // Movimiento del jugador
        updatePlayerMovement(deltaTime);
        // Animar fusibles flotando y emitir chispas
        fuses.forEach(fuse => {
            fuse.angle += deltaTime * 2.5;
            fuse.mesh.position.y = fuse.baseY + Math.sin(fuse.angle) * 0.15;
            fuse.mesh.rotation.y += deltaTime * 1.5;
            fuse.mesh.rotation.x = Math.sin(fuse.angle * 0.5) * 0.1;
            // Emitir chispas eléctricas azules procedimentales
            if (eventOccursForDelta(FUSE_SPARK_RATE, deltaTime, Math.random())) {
                const sparkPos = fuse.mesh.position.clone();
                sparkPos.x += (Math.random() - 0.5) * 0.3;
                sparkPos.y += (Math.random() - 0.5) * 0.4;
                sparkPos.z += (Math.random() - 0.5) * 0.3;
                spawnParticle(sparkPos, 0x00d9ff, 0.02 + Math.random() * 0.02, 0.015);
            }
        });
        // Colisión de recogida automática de fusibles
        for (let i = fuses.length - 1; i >= 0; i--) {
            const fuse = fuses[i];
            const dist = player.position.distanceTo(fuse.mesh.position);
            if (dist < 1.3) {
                // ¡Recogido!
                scene.remove(fuse.mesh);
                fuses.splice(i, 1);
                fusesCollected++;
                updateFuseHUD();
                AudioSynth.playFusePickup();
                showFeedback(`FUSIBLE ELÉCTRICO RECOLECTADO (${fusesCollected}/3)`);
                // Generar chispas de luz alrededor del jugador
                for (let k = 0; k < 12; k++) {
                    const sparkPos = player.position.clone();
                    sparkPos.y -= 0.5; // altura cintura
                    spawnParticle(sparkPos, 0x00d9ff, 0.03 + Math.random() * 0.03, 0.03);
                }
            }
        }
        // Actualizar apertura de compuertas normales interactuadas
        interactiveDoors.forEach(door => {
            if (door.state === 'OPENING') {
                door.mesh.position.y += deltaTime * 5.0;
                if (door.mesh.position.y >= WALL_HEIGHT * 1.5) {
                    door.mesh.position.y = WALL_HEIGHT * 1.5;
                    door.state = 'OPEN';
                    door.isOpen = true; // Quita colisiones
                    showFeedback("PUERTA DESBLOQUEADA");
                }
            }
        });
        // Actualizar zombis
        zombies.forEach(z => {
            z.update(deltaTime, player.position);
        });
        spiders.forEach(spider => {
            spider.update(deltaTime, player.position);
        });
        // Actualizar jefe
        if (bossEnemy) {
            bossEnemy.update(deltaTime, player.position);
        }
        for (let i = acidProjectiles.length - 1; i >= 0; i--) {
            const proj = acidProjectiles[i];
            proj.mesh.position.addScaledVector(proj.velocity, deltaTime);
            proj.life -= deltaTime;
            // Colisión con el jugador
            const distToPlayer = proj.mesh.position.distanceTo(camera.position);
            if (distToPlayer < 0.8) {
                damagePlayer(proj.damage, proj.isAcid !== false);
                scene.remove(proj.mesh);
                acidProjectiles.splice(i, 1);
                continue;
            }
            // Colisión con paredes
            const gridX = Math.floor((proj.mesh.position.x + GRID_SIZE / 2) / GRID_SIZE);
            const gridZ = Math.floor((proj.mesh.position.z + GRID_SIZE / 2) / GRID_SIZE);
            let hitWall = false;
            if (gridX >= 0 && gridX < activeMap[0].length && gridZ >= 0 && gridZ < activeMap.length) {
                const type = activeMap[gridZ][gridX];
                if (type === 1 || type === 2 || type === 3) {
                    const boxMinX = gridX * GRID_SIZE - GRID_SIZE / 2;
                    const boxMaxX = gridX * GRID_SIZE + GRID_SIZE / 2;
                    const boxMinZ = gridZ * GRID_SIZE - GRID_SIZE / 2;
                    const boxMaxZ = gridZ * GRID_SIZE + GRID_SIZE / 2;
                    if (proj.mesh.position.x >= boxMinX && proj.mesh.position.x <= boxMaxX &&
                        proj.mesh.position.z >= boxMinZ && proj.mesh.position.z <= boxMaxZ) {
                        hitWall = true;
                    }
                }
            }
            // Colisión con techo/suelo
            if (proj.mesh.position.y <= 0.1 || proj.mesh.position.y >= WALL_HEIGHT - 0.1) {
                hitWall = true;
            }
            if (hitWall || proj.life <= 0) {
                AudioSynth.playMetallicClick(900, 0.05, 0.08);
                const impactColor = proj.impactColor || 0x39ff14;
                for (let k = 0; k < 8; k++) {
                    spawnParticle(proj.mesh.position, impactColor, 0.04 + Math.random() * 0.03, 0.02);
                }
                scene.remove(proj.mesh);
                acidProjectiles.splice(i, 1);
                continue;
            }
        }
        // Actualizar partículas ambientales flotantes
        const elapsedTime = clock.getElapsedTime();
        ambientParticles.forEach(p => {
            if (p.isSnow) {
                p.mesh.position.y -= p.speed * deltaTime;
                p.mesh.position.x += Math.sin(elapsedTime * 0.5 + p.phase) * p.driftX * deltaTime;
                p.mesh.position.z += Math.cos(elapsedTime * 0.6 + p.phase) * p.driftZ * deltaTime;
                if (p.mesh.position.y < 0) {
                    p.mesh.position.y = WALL_HEIGHT;
                    p.mesh.position.x = p.baseX + (Math.random() - 0.5) * 4.0;
                    p.mesh.position.z = p.baseZ + (Math.random() - 0.5) * 4.0;
                }
            } else {
                p.mesh.position.y = p.baseY + Math.sin(elapsedTime * p.speed + p.phase) * p.amplitude;
                p.mesh.position.x = p.baseX + Math.sin(elapsedTime * p.speed * 0.7 + p.phase * 1.3) * p.driftX;
                p.mesh.position.z = p.baseZ + Math.cos(elapsedTime * p.speed * 0.5 + p.phase * 0.8) * p.driftZ;
                // Pulsación de opacidad sutil
                p.mesh.material.opacity = p.mesh.material.opacity * 0.99 +
                    (0.15 + 0.2 * Math.abs(Math.sin(elapsedTime * p.speed * 0.3 + p.phase))) * 0.01;
            }
        });

        // No breath effect in cave
        
        for (let i = breathParticles.length - 1; i >= 0; i--) {
            const p = breathParticles[i];
            p.life -= deltaTime;
            if (p.life <= 0) {
                scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                breathParticles.splice(i, 1);
            } else {
                p.mesh.position.addScaledVector(p.vel, deltaTime);
                p.vel.y += deltaTime * 0.2; 
                p.mesh.material.opacity = (p.life / 1.5) * 0.15; 
                p.mesh.scale.multiplyScalar(1.0 + deltaTime * 2.0);
            }
        }
        if (typeof dustParticles !== 'undefined' && dustParticles) {
            dustParticles.position.copy(camera.position);
            dustParticles.rotation.y += deltaTime * 0.03;
            dustParticles.rotation.x += deltaTime * 0.01;
        }
        // Efecto bobbing de caminar
        const walkSpeed = player.velocity.length();
        if (walkSpeed > 0.01) {
            const bob = Math.sin(clock.getElapsedTime() * 12) * 0.06;
            camera.position.y = 1.8 + bob;
            gunGroup.position.x = 0.18 + Math.cos(clock.getElapsedTime() * 6) * 0.012;
            gunGroup.position.y = -0.20 + Math.abs(Math.sin(clock.getElapsedTime() * 12)) * 0.008;
        }
        else {
            camera.position.y = 1.8 + Math.sin(clock.getElapsedTime() * 2) * 0.02;
            gunGroup.position.x = 0.18;
            gunGroup.position.y = -0.20;
        }
        // Animación de retroceso del arma
        if (gunRecoilActive) {
            gunRecoilTimer += deltaTime;
            const rData = WEAPONS[player.activeWeapon];
            // Personalizar valores según el arma
            const rForce = player.activeWeapon === 'shotgun' ? 0.12 : (player.activeWeapon === 'm4' ? 0.06 : 0.04);
            const rTime = player.activeWeapon === 'shotgun' ? 0.08 : (player.activeWeapon === 'm4' ? 0.04 : 0.05);
            const rRecovery = player.activeWeapon === 'shotgun' ? 0.27 : (player.activeWeapon === 'm4' ? 0.08 : 0.15);
            const rAngle = player.activeWeapon === 'shotgun' ? 0.35 : (player.activeWeapon === 'm4' ? 0.1 : 0.15);
            if (gunRecoilTimer < rTime) {
                gunGroup.position.z = -0.45 + (gunRecoilTimer / rTime) * rForce;
                gunGroup.rotation.x = (gunRecoilTimer / rTime) * rAngle;
            }
            else if (gunRecoilTimer < (rTime + rRecovery)) {
                const ratio = (gunRecoilTimer - rTime) / rRecovery;
                gunGroup.position.z = (-0.45 + rForce) - ratio * rForce;
                gunGroup.rotation.x = rAngle * (1 - ratio);
            }
            else {
                gunRecoilActive = false;
                gunGroup.position.z = -0.45;
                gunGroup.rotation.x = 0;
            }
        }
    }
    // Actualizar partículas
    for (let i = particles.length - 1; i >= 0; i--) {
        const active = particles[i].update(deltaTime);
        if (!active) {
            particlePool.release(particles[i]);
            particles.splice(i, 1);
        }
    }
    frameCount++;
    if (currentLevel === 3 && envCamera && frameCount % 60 === 0) {
        // Solo actualizar el reflejo estático de forma infrecuente para no trancar los FPS (una vez por segundo)
        envCamera.position.copy(camera.position);
        envCamera.update(renderer, scene);
    }
    // Renderizar escena usando EffectComposer en lugar del renderer normal
    composer.render(deltaTime);
}
function updatePlayerMovement(deltaTime) {
    player.velocity.set(0, 0, 0);
    const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forwardVec.y = 0;
    forwardVec.normalize();
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    rightVec.y = 0;
    rightVec.normalize();
    if (keyboard['W'])
        player.velocity.add(forwardVec);
    if (keyboard['S'])
        player.velocity.addScaledVector(forwardVec, -1);
    if (keyboard['D'])
        player.velocity.add(rightVec);
    if (keyboard['A'])
        player.velocity.addScaledVector(rightVec, -1);
    if (player.velocity.length() > 0) {
        player.velocity.normalize();
        player.velocity.multiplyScalar(PLAYER_SPEED);
        const nextX = player.position.x + distanceForDelta(player.velocity.x, deltaTime);
        const nextZ = player.position.z + distanceForDelta(player.velocity.z, deltaTime);
        const resolved = checkCollisions(nextX, nextZ);
        player.position.x = resolved.x;
        player.position.z = resolved.z;
    }
    camera.position.x = player.position.x;
    camera.position.z = player.position.z;
}
// Iniciar cargador del motor de renderizado
initEngine();
