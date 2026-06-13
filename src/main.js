import { AudioSynth } from './audio/SoundSynth.js';
import {
    GRID_SIZE,
    MAP,
    MAX_ARMOR,
    MAX_HEALTH,
    PLAYER_RADIUS,
    PLAYER_SPEED,
    WALL_HEIGHT,
    WEAPONS,
    ZOMBIE_ATTACK_COOLDOWN,
    ZOMBIE_ATTACK_DIST,
    ZOMBIE_SPEED,
    getMapForLevel
} from './config/gameConfig.js';
import { createInitialPlayer, createKeyboardState } from './core/state.js';
import {
    addBloodWallMessages,
    generateCeilingTexture,
    generateFloorTexture,
    generateWallTexture,
    generateZombieFaceTexture,
    generateJungleWallTexture,
    generateJungleFloorTexture,
    generateJungleCeilingTexture,
    generateMountainWallTexture,
    generateMountainFloorTexture,
    generateMountainCeilingTexture
} from './rendering/textures.js';
import {
    ammoClipEl,
    ammoReserveEl,
    armorBar,
    armorVal,
    crosshair,
    damageFlash,
    deathOverlay,
    feedbackMsg,
    healthBar,
    healthVal,
    menuOverlay,
    restartBtn,
    startBtn,
    victoryOverlay,
    winBtn,
    zombieCountEl
} from './ui/dom.js';

const { THREE } = window;

// --- CONFIGURACIÓN DE THREE.JS ---
let scene, camera, renderer;
let clock;
let player = createInitialPlayer();
window.player = player;
let keyboard = createKeyboardState();
let colliders = [];
let zombies = [];
let particles = [];
let lights = [];
let interactiveDoors = []; // Registro de puertas normales interactuadas
let fuses = []; // Registro de fusibles en el mapa
let fusesCollected = 0; // Fichas recogidas
let ambientParticles = []; // Partículas ambientales flotantes (polvo/esporas/nieve)
let hemisphereLight = null; // Luz hemisférica ambiental por bioma
let decorations = []; // Objetos decorativos 3D ambientales
let fuseBoxConsole = null; // Estructura 3D del generador final

// Variables de Progresión y Nuevas Armas
let currentLevel = 1;
let activeMap = MAP;
let supplyPoints = 0;
let unlockedWeapons = { shotgun: true, glock: false, m4: false };

// Variables para el Minijuego de Cableado
let wiringFixed = false;
let draggingWireIdx = -1;
let mousePos = { x: 0, y: 0 };
let leftSockets = [];
let rightSockets = [];

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
let cachedMummyWalkClip = null;
let cachedMummyRunClip = null;
let zombieGLBScaleFactor = 1.0;
let zombieGLBBaseYOffset = 0.0;

// Arma y disparo
let gunGroup;
let gunRecoilActive = false;
let gunRecoilTimer = 0;
let muzzleFlashSprite;
let muzzleLight;

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
    
    // Reloj
    clock = new THREE.Clock();
    
    // Renderizador con mejoras de calidad gráfica
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // HiDPI sin excederse
    renderer.setSize(window.innerWidth, window.innerHeight - 110);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Tone mapping cinematográfico
    renderer.toneMappingExposure = 1.1;
    renderer.outputEncoding = THREE.sRGBEncoding; // Color encoding correcto
    document.getElementById('game-container').appendChild(renderer.domElement);
    
    // Luz ambiental base muy tenue
    const ambientLight = new THREE.AmbientLight(0x0a0a14, 0.5);
    scene.add(ambientLight);
    
    // Luz hemisférica para iluminación natural de relleno (cambia por bioma)
    hemisphereLight = new THREE.HemisphereLight(0x111122, 0x080810, 0.3);
    scene.add(hemisphereLight);
    
    // Linterna acoplada a la cámara del jugador (SpotLight) - Potente y amplio rango
    const flashlight = new THREE.SpotLight(0xfff9e6, 3.2, 45, Math.PI / 3.8, 0.55, 0.9);
    flashlight.castShadow = true;
    flashlight.shadow.mapSize.width = 2048; // Sombras de alta resolución
    flashlight.shadow.mapSize.height = 2048;
    flashlight.shadow.camera.near = 0.5;
    flashlight.shadow.camera.far = 45;
    flashlight.shadow.bias = -0.0005;
    flashlight.shadow.radius = 2; // Sombras suavizadas
    camera.add(flashlight);
    
    // Objetivo de la linterna (apunta al frente de la cámara)
    const flashTarget = new THREE.Object3D();
    flashTarget.position.set(0, 0, -1);
    camera.add(flashTarget);
    flashlight.target = flashTarget;
    
    // Carga de Texturas procedimentales
    wallMaterialStandard = new THREE.MeshStandardMaterial({ map: generateWallTexture(0), roughness: 0.75, metalness: 0.25 });
    wallMaterialHazard = new THREE.MeshStandardMaterial({ map: generateWallTexture(1), roughness: 0.75, metalness: 0.25 });
    wallMaterialBlood = new THREE.MeshStandardMaterial({ map: generateWallTexture(2), roughness: 0.75, metalness: 0.25 });
    doorMaterial = new THREE.MeshStandardMaterial({ map: generateWallTexture(3), roughness: 0.6, metalness: 0.4 });
    
    floorMaterial = new THREE.MeshStandardMaterial({ map: generateFloorTexture(), roughness: 0.9, metalness: 0.1 });
    ceilingMaterial = new THREE.MeshStandardMaterial({ map: generateCeilingTexture(), roughness: 0.8, metalness: 0.2 });
    
    zombieFaceTexture = generateZombieFaceTexture();
    
    // Carga del modelo de zombie GLB (Caballero Momia) en segundo plano con sus animaciones
    try {
        console.log("Iniciando carga de Caballero Momia GLB con animaciones en segundo plano...");
        const gltfLoader = new THREE.GLTFLoader();
        
        // 1. Cargar modelo base con animación de caminata
        gltfLoader.load(
            'assets/animation_temp/Meshy_AI_Sandsworn_Mummy_Knigh_biped/Meshy_AI_Sandsworn_Mummy_Knigh_biped_Animation_Walking_withSkin.glb',
            (gltfWalk) => {
                cachedZombieModel = gltfWalk.scene;
                if (gltfWalk.animations && gltfWalk.animations.length > 0) {
                    cachedMummyWalkClip = gltfWalk.animations[0];
                }
                
                // Pre-calcular la escala y el offset de Y para optimizar instanciación
                cachedZombieModel.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(cachedZombieModel);
                const size = box.getSize(new THREE.Vector3());
                const height = size.y || 1.8;
                zombieGLBScaleFactor = 1.8 / height;
                
                // Aplicar escala al modelo base
                cachedZombieModel.scale.set(zombieGLBScaleFactor, zombieGLBScaleFactor, zombieGLBScaleFactor);
                cachedZombieModel.updateMatrixWorld(true);
                
                // Calcular el offset
                const boxScaled = new THREE.Box3().setFromObject(cachedZombieModel);
                zombieGLBBaseYOffset = -boxScaled.min.y;
                console.log(`Modelo de Caballero Momia cargado y pre-escalado. Altura original: ${height}, Factor de escala: ${zombieGLBScaleFactor}, Offset Y: ${zombieGLBBaseYOffset}`);
                
                // 2. Cargar animación de correr para extraer el clip de carrera
                gltfLoader.load(
                    'assets/animation_temp/Meshy_AI_Sandsworn_Mummy_Knigh_biped/Meshy_AI_Sandsworn_Mummy_Knigh_biped_Animation_Running_withSkin.glb',
                    (gltfRun) => {
                        if (gltfRun.animations && gltfRun.animations.length > 0) {
                            cachedMummyRunClip = gltfRun.animations[0];
                            console.log("Animación de carrera cargada con éxito.");
                        }
                    },
                    undefined,
                    (err) => {
                        console.error("Error al cargar la animación de carrera de la momia:", err);
                    }
                );
            },
            undefined,
            (err) => {
                console.error("Error al cargar la momia GLB (caminata), se usará el modelo procedimental de respaldo:", err);
            }
        );
    } catch (err) {
        console.error("Error al inicializar el cargador GLTF:", err);
    }
    
    // Construir el mapa
    buildMap3D();
    await addBloodWallMessages(scene);
    
    // Ensamblar arma
    buildWeapon3D();
    
    // Manejo de eventos
    window.addEventListener('resize', onWindowResize);
    setupControls();
    
    // Bucle de renderizado
    animate();
}

// --- CONSTRUCTOR DE MAPA ---
function buildMap3D() {
    const activeMap = getMapForLevel(currentLevel);
    const wallGeo = new THREE.BoxGeometry(GRID_SIZE, WALL_HEIGHT, GRID_SIZE);
    
    for (let z = 0; z < activeMap.length; z++) {
        for (let x = 0; x < activeMap[z].length; x++) {
            const type = activeMap[z][x];
            const posX = x * GRID_SIZE;
            const posZ = z * GRID_SIZE;
            
            // Suelo y techo para todas las celdas vacías/puertas
            if (type !== 1) {
                // Suelo
                const floorGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
                const floorMesh = new THREE.Mesh(floorGeo, floorMaterial);
                floorMesh.name = "map_floor";
                floorMesh.rotation.x = -Math.PI / 2;
                floorMesh.position.set(posX, 0, posZ);
                floorMesh.receiveShadow = true;
                scene.add(floorMesh);
                
                // Techo
                const ceilGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
                const ceilMesh = new THREE.Mesh(ceilGeo, ceilingMaterial);
                ceilMesh.name = "map_ceiling";
                ceilMesh.rotation.x = Math.PI / 2;
                ceilMesh.position.set(posX, WALL_HEIGHT, posZ);
                ceilMesh.receiveShadow = true;
                scene.add(ceilMesh);
            }
            
            // Paredes
            if (type === 1) {
                // Alternar texturas de las paredes (estándar, peligro, con sangre)
                let mat = wallMaterialStandard;
                const rVal = Math.random();
                if (rVal < 0.15) {
                    mat = wallMaterialHazard;
                } else if (rVal < 0.3) {
                    mat = wallMaterialBlood;
                }
                
                const wall = new THREE.Mesh(wallGeo, mat);
                wall.name = "map_wall";
                wall.position.set(posX, WALL_HEIGHT / 2, posZ);
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                
                // Guardar colisionadores
                colliders.push({
                    mesh: wall,
                    minX: posX - GRID_SIZE/2,
                    maxX: posX + GRID_SIZE/2,
                    minZ: posZ - GRID_SIZE/2,
                    maxZ: posZ + GRID_SIZE/2
                });
            } else if (type === 2) {
                // Puerta de Salida
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
                    minX: posX - GRID_SIZE/2,
                    maxX: posX + GRID_SIZE/2,
                    minZ: posZ - 0.2,
                    maxZ: posZ + 0.2
                });

                // Construir la consola del generador al lado
                buildFuseBox3D(posX, posZ);
            } else if (type === 3) {
                // Puerta Normal Interactiva (Se abre con E)
                let spanZ = false;
                if (z > 0 && z < activeMap.length - 1) {
                    const cellAbove = activeMap[z-1][x];
                    const cellBelow = activeMap[z+1][x];
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
                    state: 'CLOSED', // CLOSED, OPENING, OPEN
                    gridX: x,
                    gridZ: z,
                    spanZ: spanZ,
                    minX: posX - width/2,
                    maxX: posX + width/2,
                    minZ: posZ - depth/2,
                    maxZ: posZ + depth/2
                };
                colliders.push(doorCollider);
                interactiveDoors.push(doorCollider);
            }
            
            // Luces del techo intermitentes en algunas celdas aleatorias del pasillo
            if (type === 0 && Math.random() < 0.08 && z > 2 && x > 2) {
                const isRed = Math.random() < 0.35;
                const lightColor = isRed ? 0xff0000 : 0xffaa44;
                const ceilingLight = new THREE.PointLight(lightColor, 1.2, 8, 1.5);
                ceilingLight.position.set(posX, WALL_HEIGHT - 0.2, posZ);
                ceilingLight.castShadow = true;
                ceilingLight.shadow.bias = -0.002;
                scene.add(ceilingLight);
                
                // Placa visual de la lámpara
                const lampGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8);
                const lampMat = new THREE.MeshBasicMaterial({ color: isRed ? 0x880000 : 0xe59400 });
                const lamp = new THREE.Mesh(lampGeo, lampMat);
                lamp.position.set(posX, WALL_HEIGHT - 0.025, posZ);
                scene.add(lamp);
                
                lights.push({
                    light: ceilingLight,
                    lamp: lamp,
                    color: lightColor,
                    isRed: isRed,
                    flickerTimer: Math.random() * 10
                });
            }
        }
    }
}

// --- LIMPIEZA DE MAPA Y AMBIENTACIÓN ---
function clearCurrentMap() {
    // 1. Quitar meshes del mapa de la escena
    const toRemove = [];
    scene.traverse((child) => {
        if (child.name === "map_floor" || child.name === "map_ceiling" || child.name === "map_wall") {
            toRemove.push(child);
        }
        // Quitar calcomanías de sangre (planos que no son suelo/techo)
        if (child.isMesh && child.geometry && child.geometry.type === 'PlaneGeometry' && child.name !== 'map_floor' && child.name !== 'map_ceiling') {
            toRemove.push(child);
        }
    });
    toRemove.forEach(mesh => {
        scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else {
                mesh.material.dispose();
            }
        }
    });

    // 2. Quitar luces y lámparas del mapa
    lights.forEach(item => {
        scene.remove(item.light);
        scene.remove(item.lamp);
        if (item.lamp.geometry) item.lamp.geometry.dispose();
        if (item.lamp.material) item.lamp.material.dispose();
    });
    lights = [];

    // 3. Quitar generador final de la escena
    if (fuseBoxConsole && fuseBoxConsole.group) {
        scene.remove(fuseBoxConsole.group);
        fuseBoxConsole.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        fuseBoxConsole = null;
    }

    // 4. Limpiar arreglos de colisiones
    colliders = [];
    interactiveDoors = [];
}

function updateLevelEnvironment() {
    activeMap = getMapForLevel(currentLevel);
    let fogColor, fogDensity;
    let wallTex, wallHazardTex, wallBloodTex;
    let floorTex, ceilingTex;
    let hemiSkyColor, hemiGroundColor, hemiIntensity;
    let toneExposure;
    
    if (currentLevel === 2) {
        fogColor = 0x071a06;
        fogDensity = 0.065;
        wallTex = generateJungleWallTexture();
        wallHazardTex = generateJungleWallTexture();
        wallBloodTex = generateJungleWallTexture();
        floorTex = generateJungleFloorTexture();
        ceilingTex = generateJungleCeilingTexture();
        hemiSkyColor = 0x1a3a1a;
        hemiGroundColor = 0x0a1a06;
        hemiIntensity = 0.4;
        toneExposure = 1.0;
    } else if (currentLevel === 3) {
        // Bright snowy environment
        fogColor = 0xdbe5f0;
        fogDensity = 0.025; // Less dense so the bright snow is visible
        wallTex = generateMountainWallTexture();
        wallHazardTex = generateMountainWallTexture();
        wallBloodTex = generateMountainWallTexture();
        floorTex = generateMountainFloorTexture();
        ceilingTex = generateMountainCeilingTexture();
        hemiSkyColor = 0xffffff;
        hemiGroundColor = 0x8899aa;
        hemiIntensity = 1.0;
        toneExposure = 1.2;
    } else {
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
    }
    
    // Cambiar niebla
    if (scene.fog) {
        scene.fog.color.setHex(fogColor);
        scene.fog.density = fogDensity;
    }
    renderer.setClearColor(fogColor);
    renderer.toneMappingExposure = toneExposure;
    
    // Actualizar luz hemisférica por bioma
    if (hemisphereLight) {
        hemisphereLight.color.setHex(hemiSkyColor);
        hemisphereLight.groundColor.setHex(hemiGroundColor);
        hemisphereLight.intensity = hemiIntensity;
    }
    
    // Cambiar texturas en materiales existentes
    if (wallMaterialStandard) {
        wallMaterialStandard.map = wallTex;
        wallMaterialStandard.needsUpdate = true;
    }
    if (wallMaterialHazard) {
        wallMaterialHazard.map = wallHazardTex;
        wallMaterialHazard.needsUpdate = true;
    }
    if (wallMaterialBlood) {
        wallMaterialBlood.map = wallBloodTex;
        wallMaterialBlood.needsUpdate = true;
    }
    if (floorMaterial) {
        floorMaterial.map = floorTex;
        floorMaterial.needsUpdate = true;
    }
    if (ceilingMaterial) {
        ceilingMaterial.map = ceilingTex;
        ceilingMaterial.needsUpdate = true;
    }
    
    // Limpiar y regenerar decoraciones y partículas ambientales
    clearDecorations();
    spawnLevelDecorations();
    clearAmbientParticles();
    spawnAmbientParticles();
}

// --- DECORACIONES 3D AMBIENTALES ---
function clearDecorations() {
    decorations.forEach(d => {
        scene.remove(d);
        d.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
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
    const maxDecorations = 20;
    
    for (let z = 2; z < map.length - 2 && spawned < maxDecorations; z++) {
        for (let x = 2; x < map[z].length - 2 && spawned < maxDecorations; x++) {
            if (map[z][x] !== 0) continue;
            if (Math.random() > 0.12) continue; // ~12% de celdas vacías reciben decoración
            
            const posX = x * GRID_SIZE;
            const posZ = z * GRID_SIZE;
            
            // Verificar que no esté en el spawn o salida
            if (x < 3 && z < 3) continue;
            if (x > 13 && z > 13) continue;
            
            let group;
            if (currentLevel === 1) {
                group = createFacilityDecoration(posX, posZ);
            } else if (currentLevel === 2) {
                group = createJungleDecoration(posX, posZ);
            } else {
                group = createMountainDecoration(posX, posZ);
            }
            
            if (group) {
                scene.add(group);
                decorations.push(group);
                spawned++;
            }
        }
    }
}

function createFacilityDecoration(px, pz) {
    const group = new THREE.Group();
    const type = Math.floor(Math.random() * 4);
    
    if (type === 0) {
        // Barril tóxico
        const barrelGeo = new THREE.CylinderGeometry(0.35, 0.38, 1.0, 10);
        const barrelMat = new THREE.MeshStandardMaterial({
            color: 0x3a4a2e, roughness: 0.85, metalness: 0.3
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(px + (Math.random()-0.5)*1.5, 0.5, pz + (Math.random()-0.5)*1.5);
        barrel.castShadow = true;
        barrel.receiveShadow = true;
        group.add(barrel);
        
        // Franja de peligro
        const bandGeo = new THREE.CylinderGeometry(0.36, 0.39, 0.12, 10);
        const bandMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00, roughness: 0.6, metalness: 0.2, emissive: 0x332200, emissiveIntensity: 0.2
        });
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.copy(barrel.position);
        band.position.y = 0.65;
        group.add(band);
        
        // Goteo tóxico luminoso
        const dripGeo = new THREE.SphereGeometry(0.06, 6, 6);
        const dripMat = new THREE.MeshBasicMaterial({ color: 0x44ff22, transparent: true, opacity: 0.7 });
        const drip = new THREE.Mesh(dripGeo, dripMat);
        drip.position.set(barrel.position.x + 0.35, 0.15, barrel.position.z);
        group.add(drip);
        
        const dripLight = new THREE.PointLight(0x44ff22, 0.3, 1.5);
        dripLight.position.copy(drip.position);
        group.add(dripLight);
    } else if (type === 1) {
        // Caja de suministros militar
        const crateGeo = new THREE.BoxGeometry(0.9, 0.6, 0.7);
        const crateMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a1e, roughness: 0.9, metalness: 0.15
        });
        const crate = new THREE.Mesh(crateGeo, crateMat);
        crate.position.set(px + (Math.random()-0.5)*1.2, 0.3, pz + (Math.random()-0.5)*1.2);
        crate.rotation.y = Math.random() * Math.PI;
        crate.castShadow = true;
        crate.receiveShadow = true;
        group.add(crate);
        
        // Refuerzos metálicos
        const stripGeo = new THREE.BoxGeometry(0.92, 0.04, 0.72);
        const stripMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.5 });
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.copy(crate.position);
        strip.position.y = 0.45;
        strip.rotation.y = crate.rotation.y;
        group.add(strip);
    } else if (type === 2) {
        // Tubería rota con vapor
        const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8);
        const pipeMat = new THREE.MeshStandardMaterial({
            color: 0x555555, roughness: 0.4, metalness: 0.8
        });
        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        const offset = (Math.random()-0.5) * 1.2;
        pipe.position.set(px + offset, 1.25, pz + (Math.random()-0.5) * 0.5);
        pipe.rotation.z = Math.PI / 2 + (Math.random()-0.5) * 0.15;
        pipe.castShadow = true;
        group.add(pipe);
    } else {
        // Cable colgante del techo
        const cableCount = 2 + Math.floor(Math.random() * 3);
        for (let c = 0; c < cableCount; c++) {
            const cableGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2 + Math.random() * 1.5, 4);
            const cableMat = new THREE.MeshStandardMaterial({
                color: Math.random() > 0.5 ? 0x222222 : 0x332211, roughness: 0.9
            });
            const cable = new THREE.Mesh(cableGeo, cableMat);
            cable.position.set(
                px + (Math.random()-0.5) * 1.5,
                WALL_HEIGHT - (0.3 + Math.random() * 0.8),
                pz + (Math.random()-0.5) * 1.5
            );
            cable.rotation.z = (Math.random()-0.5) * 0.3;
            cable.rotation.x = (Math.random()-0.5) * 0.3;
            group.add(cable);
        }
    }
    
    return group;
}

function createJungleDecoration(px, pz) {
    const group = new THREE.Group();
    const type = Math.floor(Math.random() * 4);
    
    if (type === 0) {
        // Arbusto frondoso
        const bushGeo = new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 8, 6);
        const bushMat = new THREE.MeshStandardMaterial({
            color: 0x2a5a1e, roughness: 0.95, metalness: 0.0
        });
        const bush = new THREE.Mesh(bushGeo, bushMat);
        bush.position.set(px + (Math.random()-0.5)*1.8, 0.35, pz + (Math.random()-0.5)*1.8);
        bush.scale.y = 0.7;
        bush.castShadow = true;
        bush.receiveShadow = true;
        group.add(bush);
        
        // Hojas más claras por encima
        const topGeo = new THREE.SphereGeometry(0.3, 6, 6);
        const topMat = new THREE.MeshStandardMaterial({ color: 0x44882e, roughness: 0.9 });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.copy(bush.position);
        top.position.y += 0.3;
        group.add(top);
    } else if (type === 1) {
        // Hongo bioluminiscente
        const stemGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.35, 6);
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.95 });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        const ox = px + (Math.random()-0.5)*1.5;
        const oz = pz + (Math.random()-0.5)*1.5;
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
        
        const mushroomLight = new THREE.PointLight(glowColor, 0.5, 3.0);
        mushroomLight.position.set(ox, 0.35, oz);
        group.add(mushroomLight);
    } else if (type === 2) {
        // Tronco caído
        const logGeo = new THREE.CylinderGeometry(0.18, 0.22, 2.0 + Math.random(), 8);
        const logMat = new THREE.MeshStandardMaterial({
            color: 0x3a2a18, roughness: 0.95, metalness: 0.0
        });
        const log = new THREE.Mesh(logGeo, logMat);
        log.position.set(px + (Math.random()-0.5), 0.2, pz + (Math.random()-0.5));
        log.rotation.z = Math.PI / 2;
        log.rotation.y = Math.random() * Math.PI;
        log.castShadow = true;
        log.receiveShadow = true;
        group.add(log);
    } else {
        // Lianas colgantes del techo
        const vineCount = 3 + Math.floor(Math.random() * 4);
        for (let v = 0; v < vineCount; v++) {
            const vineGeo = new THREE.CylinderGeometry(0.02, 0.015, 1.5 + Math.random() * 2.0, 4);
            const vineMat = new THREE.MeshStandardMaterial({ color: 0x1a4a12, roughness: 0.95 });
            const vine = new THREE.Mesh(vineGeo, vineMat);
            vine.position.set(
                px + (Math.random()-0.5) * 2.0,
                WALL_HEIGHT - (0.5 + Math.random() * 1.0),
                pz + (Math.random()-0.5) * 2.0
            );
            vine.rotation.z = (Math.random()-0.5) * 0.4;
            vine.rotation.x = (Math.random()-0.5) * 0.4;
            group.add(vine);
        }
    }
    
    return group;
}

function createMountainDecoration(px, pz) {
    const group = new THREE.Group();
    const type = Math.floor(Math.random() * 4);
    
    if (type === 0) {
        // Roca grande
        const rockGeo = new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.3, 1);
        const rockMat = new THREE.MeshStandardMaterial({
            color: 0x555560, roughness: 0.95, metalness: 0.1
        });
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(px + (Math.random()-0.5)*1.5, 0.25, pz + (Math.random()-0.5)*1.5);
        rock.scale.y = 0.6;
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        rock.receiveShadow = true;
        group.add(rock);
        
        // Escarcha encima
        const frostGeo = new THREE.SphereGeometry(0.3, 6, 6, 0, Math.PI * 2, 0, Math.PI / 3);
        const frostMat = new THREE.MeshStandardMaterial({
            color: 0xddeeff, roughness: 0.2, metalness: 0.1,
            transparent: true, opacity: 0.6
        });
        const frost = new THREE.Mesh(frostGeo, frostMat);
        frost.position.copy(rock.position);
        frost.position.y += 0.35;
        group.add(frost);
    } else if (type === 1) {
        // Cristal de hielo luminoso
        const crystalGeo = new THREE.ConeGeometry(0.12, 0.6 + Math.random() * 0.4, 5);
        const crystalMat = new THREE.MeshStandardMaterial({
            color: 0x88ccff, emissive: 0x2255aa, emissiveIntensity: 0.4,
            roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        const ox = px + (Math.random()-0.5)*1.5;
        const oz = pz + (Math.random()-0.5)*1.5;
        crystal.position.set(ox, 0.3 + Math.random() * 0.2, oz);
        crystal.rotation.z = (Math.random()-0.5) * 0.3;
        crystal.castShadow = true;
        group.add(crystal);
        
        const crystalLight = new THREE.PointLight(0x5599ff, 0.4, 2.5);
        crystalLight.position.copy(crystal.position);
        group.add(crystalLight);
    } else if (type === 2) {
        // Estalactita colgando del techo
        const stalGeo = new THREE.ConeGeometry(0.08 + Math.random()*0.06, 0.8 + Math.random() * 0.6, 6);
        const stalMat = new THREE.MeshStandardMaterial({
            color: 0x665555, roughness: 0.8, metalness: 0.15
        });
        const stalactite = new THREE.Mesh(stalGeo, stalMat);
        stalactite.position.set(
            px + (Math.random()-0.5)*1.5,
            WALL_HEIGHT - (0.4 + Math.random() * 0.3),
            pz + (Math.random()-0.5)*1.5
        );
        stalactite.rotation.x = Math.PI; // Invertido, colgando
        stalactite.castShadow = true;
        group.add(stalactite);
    } else {
        // Montículo de nieve
        const snowGeo = new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 8, 6);
        const snowMat = new THREE.MeshStandardMaterial({
            color: 0xe8eff5, roughness: 0.6, metalness: 0.0
        });
        const snow = new THREE.Mesh(snowGeo, snowMat);
        snow.position.set(px + (Math.random()-0.5)*1.2, 0.15, pz + (Math.random()-0.5)*1.2);
        snow.scale.y = 0.3;
        snow.receiveShadow = true;
        group.add(snow);
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
}

function spawnAmbientParticles() {
    const map = getMapForLevel(currentLevel);
    const count = 80; // Cantidad de partículas flotantes
    let color, emissive, size, opacity;
    
    if (currentLevel === 2) {
        color = 0x44ff66;
        emissive = 0x22aa33;
        size = 0.04;
        opacity = 0.5;
    } else if (currentLevel === 3) {
        color = 0xffffff;
        emissive = 0x8888aa;
        size = 0.035;
        opacity = 0.7;
    } else {
        color = 0x888888;
        emissive = 0x222222;
        size = 0.025;
        opacity = 0.35;
    }
    
    for (let i = 0; i < count; i++) {
        // Elegir posición aleatoria dentro de celdas vacías
        let attempts = 0;
        while (attempts < 15) {
            attempts++;
            const gz = Math.floor(Math.random() * map.length);
            const gx = Math.floor(Math.random() * map[gz].length);
            if (map[gz][gx] !== 0) continue;
            
            const px = gx * GRID_SIZE + (Math.random()-0.5) * GRID_SIZE * 0.8;
            const pz = gz * GRID_SIZE + (Math.random()-0.5) * GRID_SIZE * 0.8;
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
                baseY: py,
                baseX: px,
                baseZ: pz,
                speed: 0.3 + Math.random() * 0.5,
                phase: Math.random() * Math.PI * 2,
                amplitude: 0.1 + Math.random() * 0.25,
                driftX: (Math.random()-0.5) * 0.3,
                driftZ: (Math.random()-0.5) * 0.3
            });
            break;
        }
    }
}


// --- CONSOLA GENERADORA FINAL (CAJA DE FUSIBLES) ---
function buildFuseBox3D(posX, posZ) {
    const group = new THREE.Group();
    // Posicionada ligeramente a un lado de la compuerta final
    group.position.set(posX - 1.5, 0, posZ - 1.5);
    
    // Malla del pedestal principal
    const baseGeo = new THREE.BoxGeometry(0.8, 1.2, 0.6);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.8, metalness: 0.4 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.6;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    
    // Panel inclinado del lector
    const panelGeo = new THREE.BoxGeometry(0.7, 0.3, 0.5);
    const panel = new THREE.Mesh(panelGeo, baseMat);
    panel.position.set(0, 1.25, 0.05);
    panel.rotation.x = Math.PI / 6; // Inclinado para comodidad visual
    group.add(panel);
    
    // 3 ranuras para fusibles (cilindros oscuros)
    const slotGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8);
    const slotMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95 });
    for (let i = 0; i < 3; i++) {
        const slot = new THREE.Mesh(slotGeo, slotMat);
        slot.position.set(-0.18 + i * 0.18, 1.3, 0.12);
        slot.rotation.x = Math.PI / 6;
        group.add(slot);
    }
    
    // LED de estado en el frente del generador
    const ledGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Comienza en rojo apagado
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 1.0, 0.31);
    group.add(led);
    
    // Luz de estado del LED
    const ledLight = new THREE.PointLight(0xff0000, 0.6, 2.5);
    ledLight.position.set(0, 1.0, 0.35);
    group.add(ledLight);

    // Cableado auxiliar para nivel 2+
    let wiringLed = null;
    let wiringLedLight = null;
    if (currentLevel >= 2) {
        const sidePanelGeo = new THREE.BoxGeometry(0.35, 0.7, 0.45);
        const sidePanelMat = new THREE.MeshStandardMaterial({ color: 0x33353b, roughness: 0.8, metalness: 0.3 });
        const sidePanel = new THREE.Mesh(sidePanelGeo, sidePanelMat);
        sidePanel.position.set(0.55, 0.8, 0); // en el lado derecho
        sidePanel.castShadow = true;
        sidePanel.receiveShadow = true;
        group.add(sidePanel);
        
        // LED de estado del cableado
        const wLedGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const wLedMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        wiringLed = new THREE.Mesh(wLedGeo, wLedMat);
        wiringLed.position.set(0.55, 1.05, 0.18);
        group.add(wiringLed);
        
        wiringLedLight = new THREE.PointLight(0xffaa00, 0.8, 2.0);
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
    
    // Añadir el generador a colisionadores para evitar atravesarlo
    colliders.push(fuseBoxConsole);
}

// --- GENERACIÓN Y GESTIÓN DE FUSIBLES ---
function spawnFuses() {
    // Limpiar anteriores
    fuses.forEach(f => {
        scene.remove(f.mesh);
        if (fuseBoxConsole && fuseBoxConsole.group) {
            // Limpiar fusibles montados en consola si los hay
            try {
                const fuseMesh = fuseBoxConsole.group.getObjectByName(`mounted_fuse_${fuses.indexOf(f)}`);
                if (fuseMesh) fuseBoxConsole.group.remove(fuseMesh);
            } catch(e){}
        }
        if (f.light) scene.remove(f.light);
    });
    
    fuses = [];
    fusesCollected = 0;
    updateFuseHUD();
    
    let spawned = 0;
    let attempts = 0;
    
    while (spawned < 3 && attempts < 150) {
        attempts++;
        const z = Math.floor(Math.random() * activeMap.length);
        const x = Math.floor(Math.random() * activeMap[z].length);
        
        // Debe ser vacío, no muy pegado a la consola de salida y no pegado al spawn
        if (activeMap[z][x] === 0) {
            if ((x < 3 && z < 3) || (x > 12 && z > 12)) continue;
            
            // Comprobar colisión con fusibles ya posicionados
            const dup = fuses.some(f => f.gridX === x && f.gridZ === z);
            if (dup) continue;
            
            const px = x * GRID_SIZE;
            const pz = z * GRID_SIZE;
            
            const fuseGroup = new THREE.Group();
            fuseGroup.position.set(px, 0.8, pz);
            
            // Cuerpo transparente de cristal que brilla en azul
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
            
            // Tapas metálicas de latón/cobre dorado
            const capGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 8);
            const capMat = new THREE.MeshStandardMaterial({ color: 0xe5a93b, roughness: 0.3, metalness: 0.85 });
            
            const topCap = new THREE.Mesh(capGeo, capMat);
            topCap.position.y = 0.22;
            fuseGroup.add(topCap);
            
            const bottomCap = new THREE.Mesh(capGeo, capMat);
            bottomCap.position.y = -0.22;
            fuseGroup.add(bottomCap);
            
            scene.add(fuseGroup);
            
            // Pequeña luz de color cian para dar visibilidad
            const light = new THREE.PointLight(0x00d9ff, 1.5, 4);
            light.position.set(px, 0.8, pz);
            scene.add(light);
            
            fuses.push({
                mesh: fuseGroup,
                light: light,
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
        fuseCountEl.innerText = `${fusesCollected}/3`;
        if (fusesCollected === 3) {
            fuseCountEl.style.color = '#00ff41'; // Brillo verde al tenerlos todos
            fuseCountEl.style.textShadow = '0 0 12px rgba(0, 255, 65, 0.6)';
        } else {
            fuseCountEl.style.color = '#00d9ff';
            fuseCountEl.style.textShadow = '0 0 8px rgba(0, 217, 255, 0.4)';
        }
    }
}

// --- CONSTRUCTOR DE ARMA ---
function buildWeapon3D() {
    gunGroup = new THREE.Group();
    
    // 1. SHOTGUN MESH GROUP
    shotgunMeshGroup = new THREE.Group();
    
    // Barrilete izquierdo (Cilindro metálico detallado)
    const barrelGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 16);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.95 });
    const leftBarrel = new THREE.Mesh(barrelGeo, barrelMat);
    leftBarrel.rotation.x = Math.PI / 2;
    leftBarrel.position.set(-0.015, 0, -0.22);
    leftBarrel.castShadow = true;
    shotgunMeshGroup.add(leftBarrel);
    
    // Barrilete derecho
    const rightBarrel = new THREE.Mesh(barrelGeo, barrelMat);
    rightBarrel.rotation.x = Math.PI / 2;
    rightBarrel.position.set(0.015, 0, -0.22);
    rightBarrel.castShadow = true;
    shotgunMeshGroup.add(rightBarrel);
    
    // Costilla ventilada (Vented rib) entre cañones
    const ribGeo = new THREE.BoxGeometry(0.015, 0.008, 0.45);
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.8 });
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.position.set(0, 0.012, -0.22);
    shotgunMeshGroup.add(rib);

    // Culata y soporte del cañón (Madera barnizada o polímero táctico)
    const stockGeo = new THREE.BoxGeometry(0.05, 0.05, 0.22);
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x241108, roughness: 0.8, metalness: 0.1 });
    const stock = new THREE.Mesh(stockGeo, stockMat);
    stock.position.set(0, -0.035, 0.02);
    shotgunMeshGroup.add(stock);
    
    // Empuñadura de recarga metálica inferior (Pump) texturizada
    const pumpGeo = new THREE.BoxGeometry(0.045, 0.035, 0.16);
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.9, bumpScale: 0.02 });
    const pump = new THREE.Mesh(pumpGeo, pumpMat);
    pump.position.set(0, -0.025, -0.16);
    shotgunMeshGroup.add(pump);
    
    // Tubo de munición inferior
    const magTubeGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.35, 12);
    const magTube = new THREE.Mesh(magTubeGeo, barrelMat);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.015, -0.22);
    shotgunMeshGroup.add(magTube);

    gunGroup.add(shotgunMeshGroup);
    
    // 2. GLOCK MESH GROUP (Táctica con láser)
    glockMeshGroup = new THREE.Group();
    glockMeshGroup.visible = false; // Oculta inicialmente
    
    const glockSlideMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.4, metalness: 0.85 });
    const glockPolyMat = new THREE.MeshStandardMaterial({ color: 0x0f1011, roughness: 0.85, metalness: 0.2 });
    
    // Empuñadura ergonómica
    const glockGripGeo = new THREE.BoxGeometry(0.026, 0.09, 0.038);
    const glockGrip = new THREE.Mesh(glockGripGeo, glockPolyMat);
    glockGrip.position.set(0, -0.05, -0.02);
    glockGrip.rotation.x = -Math.PI / 9;
    glockMeshGroup.add(glockGrip);
    
    // Corredera detallada
    const glockSlideGeo = new THREE.BoxGeometry(0.029, 0.032, 0.165);
    const glockSlide = new THREE.Mesh(glockSlideGeo, glockSlideMat);
    glockSlide.position.set(0, 0, -0.08);
    glockMeshGroup.add(glockSlide);
    
    // Punta del cañón (más oscuro)
    const glockTipGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.02, 12);
    const glockTipMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.95 });
    const glockTip = new THREE.Mesh(glockTipGeo, glockTipMat);
    glockTip.rotation.x = Math.PI / 2;
    glockTip.position.set(0, 0.004, -0.17);
    glockMeshGroup.add(glockTip);
    
    // Miras de hierro (Iron Sights) con puntos brillantes
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

    // Guardamonte y gatillo
    const guardGeo = new THREE.BoxGeometry(0.012, 0.025, 0.035);
    const guard = new THREE.Mesh(guardGeo, glockPolyMat);
    guard.position.set(0, -0.035, -0.05);
    glockMeshGroup.add(guard);
    
    // Módulo Láser bajo el cañón
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
    
    // 3. M4 CARBINE MESH GROUP (Totalmente Táctica)
    m4MeshGroup = new THREE.Group();
    m4MeshGroup.visible = false; // Oculta inicialmente
    
    const m4MetalMat = new THREE.MeshStandardMaterial({ color: 0x222325, roughness: 0.35, metalness: 0.9 });
    const m4PlasticMat = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.85, metalness: 0.15 });
    
    // Recibidor superior e inferior detallado
    const m4RecGeo = new THREE.BoxGeometry(0.032, 0.058, 0.22);
    const m4Receiver = new THREE.Mesh(m4RecGeo, m4MetalMat);
    m4Receiver.position.set(0, -0.01, -0.1);
    m4MeshGroup.add(m4Receiver);
    
    // Guardamanos picatinny (Rieles tácticos)
    const m4GuardGeo = new THREE.BoxGeometry(0.042, 0.042, 0.22);
    const m4Guard = new THREE.Mesh(m4GuardGeo, m4MetalMat);
    m4Guard.position.set(0, -0.01, -0.32);
    m4MeshGroup.add(m4Guard);
    
    // Cañón externo
    const m4BarrelGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.28, 12);
    const m4Barrel = new THREE.Mesh(m4BarrelGeo, m4MetalMat);
    m4Barrel.rotation.x = Math.PI / 2;
    m4Barrel.position.set(0, -0.01, -0.5);
    m4MeshGroup.add(m4Barrel);
    
    // Bocacha apagallamas estilo birdcage
    const m4TipGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.045, 12);
    const m4Tip = new THREE.Mesh(m4TipGeo, m4MetalMat);
    m4Tip.rotation.x = Math.PI / 2;
    m4Tip.position.set(0, -0.01, -0.6);
    m4MeshGroup.add(m4Tip);
    
    // Empuñadura
    const m4GripGeo = new THREE.BoxGeometry(0.026, 0.08, 0.035);
    const m4Grip = new THREE.Mesh(m4GripGeo, m4PlasticMat);
    m4Grip.position.set(0, -0.075, -0.04);
    m4Grip.rotation.x = -Math.PI / 8;
    m4MeshGroup.add(m4Grip);
    
    // Culata táctica ajustable
    const m4StockGeo = new THREE.BoxGeometry(0.03, 0.07, 0.16);
    const m4Stock = new THREE.Mesh(m4StockGeo, m4PlasticMat);
    m4Stock.position.set(0, -0.025, 0.08);
    m4MeshGroup.add(m4Stock);
    
    // Tubo de culata metálico
    const m4BufferGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 12);
    const m4Buffer = new THREE.Mesh(m4BufferGeo, m4MetalMat);
    m4Buffer.rotation.x = Math.PI / 2;
    m4Buffer.position.set(0, -0.01, 0.02);
    m4MeshGroup.add(m4Buffer);
    
    // Cargador curvado
    const m4MagGeo = new THREE.BoxGeometry(0.025, 0.14, 0.055);
    const m4Mag = new THREE.Mesh(m4MagGeo, m4MetalMat);
    m4Mag.position.set(0, -0.11, -0.14);
    m4Mag.rotation.x = Math.PI / 16;
    m4MeshGroup.add(m4Mag);
    
    // Mira holográfica EOTech realista
    const m4HoloGeo = new THREE.BoxGeometry(0.025, 0.035, 0.06);
    const m4Holo = new THREE.Mesh(m4HoloGeo, m4MetalMat);
    m4Holo.position.set(0, 0.035, -0.1);
    m4MeshGroup.add(m4Holo);
    
    const m4HoloGlassGeo = new THREE.BoxGeometry(0.02, 0.025, 0.002);
    const m4HoloGlassMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4 });
    const m4HoloGlass = new THREE.Mesh(m4HoloGlassGeo, m4HoloGlassMat);
    m4HoloGlass.position.set(0, 0.035, -0.125);
    m4MeshGroup.add(m4HoloGlass);

    // Linterna táctica lateral
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
    
    // Luz de fogonazo de disparo central
    muzzleLight = new THREE.PointLight(0xffaa00, 0, 8);
    muzzleLight.position.set(0, 0, -0.46);
    gunGroup.add(muzzleLight);
    
    // Sprite de fogonazo
    const flashGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 });
    muzzleFlashSprite = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlashSprite.position.set(0, 0, -0.46);
    gunGroup.add(muzzleFlashSprite);
    
    // Posicionar el arma en la esquina inferior derecha
    gunGroup.position.set(0.18, -0.20, -0.45);
    camera.add(gunGroup);
}

// Helper para clonar modelos riggeados (SkinnedMesh) en Three.js
function cloneRiggedModel(source) {
    const clone = source.clone();
    
    // Buscar todos los huesos en el modelo origen y en el clonado
    const sourceBones = [];
    source.traverse(node => {
        if (node.isBone) sourceBones.push(node);
    });
    
    const cloneBones = [];
    clone.traverse(node => {
        if (node.isBone) cloneBones.push(node);
    });
    
    // Re-vincular los SkinnedMesh del clon a los huesos clonados correspondientes
    clone.traverse(node => {
        if (node.isSkinnedMesh) {
            const originalSkeleton = node.skeleton;
            const newBones = [];
            for (let i = 0; i < originalSkeleton.bones.length; i++) {
                const originalBone = originalSkeleton.bones[i];
                const matchingBone = cloneBones.find(b => b.name === originalBone.name);
                newBones.push(matchingBone || originalBone);
            }
            node.bind(new THREE.Skeleton(newBones, originalSkeleton.boneInverses), node.matrixWorld);
        }
    });
    
    return clone;
}

// --- CONTRATACIÓN Y MOVIMIENTO DE ZOMBIS ---
class Zombie {
    constructor(x, z, type = 'NORMAL') {
        this.group = new THREE.Group();
        this.group.position.set(x, 0, z);
        this.type = type;
        this.state = 'ALIVE'; // ALIVE, DYING, DEAD
        this.hurtTimer = 0;
        this.attackCooldownTimer = 0;
        this.walkCycle = Math.random() * 100;
        
        // Atributos y colores según variante de zombi
        if (this.type === 'RUNNER') {
            this.maxHealth = 45;
            this.health = 45;
            this.speedMultiplier = 1.65; // Corredor rápido
            this.colorClothing = 0x5c1515; // Ropa oscura ensangrentada
            this.colorSkin = 0x4a3636; // Piel necrosada
        } else if (this.type === 'SPITTER') {
            this.maxHealth = 80;
            this.health = 80;
            this.speedMultiplier = 0.6; // Escupidor lento
            this.colorClothing = 0x133815; // Ropa rasgada pantanosa
            this.colorSkin = 0x5a754b; // Piel verde putrefacta
            this.spitCooldownTimer = 1000 + Math.random() * 1500;
        } else {
            // NORMAL
            this.maxHealth = 100;
            this.health = 100;
            this.speedMultiplier = 1.0;
            this.colorClothing = 0x2d2538; // Ropa oscura/púrpura
            this.colorSkin = 0x3d4a36; // Piel verde grisácea
        }
        
        // Contenedor del cuerpo (para inclinar al zombie hacia adelante)
        this.bodyGroup = new THREE.Group();
        this.group.add(this.bodyGroup);

        if (cachedZombieModel) {
            // Clonar el modelo 3D riggeado pre-escalado personalizado
            this.zombieMesh = cloneRiggedModel(cachedZombieModel);
            
            // Alinear la base del zombi al suelo usando el offset pre-calculado
            this.baseYOffset = zombieGLBBaseYOffset;
            this.zombieMesh.position.set(0, this.baseYOffset, 0);
            
            // Configurar el AnimationMixer para animaciones de esqueleto
            const clip = (this.type === 'RUNNER' && cachedMummyRunClip) ? cachedMummyRunClip : cachedMummyWalkClip;
            if (clip) {
                this.mixer = new THREE.AnimationMixer(this.zombieMesh);
                this.activeAction = this.mixer.clipAction(clip);
                // Escalar la velocidad de reproducción de la animación para que coincida con el movimiento
                this.activeAction.timeScale = this.speedMultiplier * 0.95;
                this.activeAction.play();
            }
            
            // Clonar materiales para poder tintar independientemente y configurar sombras
            this.zombieMesh.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material = child.material.clone();
                        // Aplicar tintes según el tipo
                        if (this.type === 'RUNNER') {
                            child.material.color.setHex(0xff5555); // Tinte rojo para corredores
                        } else if (this.type === 'SPITTER') {
                            child.material.color.setHex(0x55ff55); // Tinte verde fuerte para escupidores
                        }
                    }
                }
            });
            
            this.group.add(this.zombieMesh);
            
            // Ojos / luz puntual frontal según tipo
            const eyeColor = this.type === 'SPITTER' ? 0x39ff14 : (this.type === 'RUNNER' ? 0xff4400 : 0xffea00);
            this.eyeLight = new THREE.PointLight(eyeColor, 0.7, 4.0);
            this.eyeLight.position.set(0, 1.5, 0.2); // Colocar cerca de la cabeza
            this.group.add(this.eyeLight);
        } else {
            // --- CÓDIGO PROCEDIMENTAL DE RESPALDO (VIEJO) ---
            // Torso (Más alto y delgado)
            const torsoGeo = new THREE.BoxGeometry(0.65, 1.2, 0.35);
            const torsoMat = new THREE.MeshStandardMaterial({ color: this.colorClothing, roughness: 0.9, metalness: 0.1 });
            this.torso = new THREE.Mesh(torsoGeo, torsoMat);
            this.torso.position.y = 0.6;
            this.torso.castShadow = true;
            this.torso.receiveShadow = true;
            this.bodyGroup.add(this.torso);

            // Detalles de costillas / huesos expuestos en el pecho
            const ribGeo = new THREE.BoxGeometry(0.35, 0.4, 0.1);
            const ribMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 });
            this.ribcage = new THREE.Mesh(ribGeo, ribMat);
            this.ribcage.position.set(0, 0.7, 0.18);
            this.bodyGroup.add(this.ribcage);
            
            // Manchas de sangre en el torso
            const bloodGeo = new THREE.BoxGeometry(0.5, 0.6, 0.05);
            const bloodMat = new THREE.MeshStandardMaterial({ color: 0x400000, roughness: 1.0 });
            this.blood = new THREE.Mesh(bloodGeo, bloodMat);
            this.blood.position.set(0.05, 0.5, 0.16);
            this.bodyGroup.add(this.blood);

            // Cabeza (Caja con textura de cara procedimental)
            const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
            this.headMaterials = [
                new THREE.MeshStandardMaterial({ color: this.colorSkin }),
                new THREE.MeshStandardMaterial({ color: this.colorSkin }),
                new THREE.MeshStandardMaterial({ color: this.colorSkin }),
                new THREE.MeshStandardMaterial({ color: this.colorSkin }),
                new THREE.MeshStandardMaterial({ map: zombieFaceTexture, color: this.colorSkin }), // Frente
                new THREE.MeshStandardMaterial({ color: this.colorSkin })
            ];
            this.head = new THREE.Mesh(headGeo, this.headMaterials);
            this.head.position.set(0, 1.4, 0.1); // Cabeza echada hacia adelante
            this.head.rotation.x = -0.15; // Mirando ligeramente hacia abajo/adelante
            this.head.castShadow = true;
            this.bodyGroup.add(this.head);

            // Mandíbula caída y desencajada (Terrorífico)
            const jawGeo = new THREE.BoxGeometry(0.35, 0.25, 0.35);
            const jawMat = new THREE.MeshStandardMaterial({ color: this.colorSkin });
            this.jaw = new THREE.Mesh(jawGeo, jawMat);
            this.jaw.position.set(0, -0.28, 0.05);
            this.jaw.rotation.x = 0.4; // Colgando
            this.head.add(this.jaw);

            // Ojos emisivos brillantes (visibles en la oscuridad)
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
            
            // Luz puntual tenue desde los ojos
            this.eyeLight = new THREE.PointLight(eyeColor, 0.6, 4.0);
            this.eyeLight.position.set(0, 0.05, 0.25);
            this.head.add(this.eyeLight);
            
            // Brazos estirados irregularmente
            const armGeo = new THREE.BoxGeometry(0.16, 0.16, 0.8);
            const armMat = new THREE.MeshStandardMaterial({ color: this.colorSkin });
            
            this.leftArm = new THREE.Mesh(armGeo, armMat);
            this.leftArm.position.set(-0.45, 0.95, 0.4);
            this.leftArm.rotation.y = 0.2; // Torcido
            this.leftArm.rotation.x = 0.1;
            this.leftArm.castShadow = true;
            this.bodyGroup.add(this.leftArm);
            
            this.rightArm = new THREE.Mesh(armGeo, armMat);
            this.rightArm.position.set(0.45, 1.05, 0.35); // Un brazo más alto que el otro
            this.rightArm.rotation.y = -0.15;
            this.rightArm.rotation.x = -0.2;
            this.rightArm.castShadow = true;
            this.bodyGroup.add(this.rightArm);
            
            // Piernas (Huesudas)
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

            // Inclinar todo el torso hacia adelante para que luzca acechante
            this.bodyGroup.position.y = 0.7; // Levantar el pivote
            this.torso.position.y -= 0.7; // Ajustar posición relativa
            this.head.position.y -= 0.7;
            this.leftArm.position.y -= 0.7;
            this.rightArm.position.y -= 0.7;
            this.ribcage.position.y -= 0.7;
            this.blood.position.y -= 0.7;
            this.bodyGroup.rotation.x = 0.15; // Inclinación
        }

        // Escalar zombis para que tengan un tamaño más amenazante
        this.group.scale.set(1.25, 1.35, 1.25);
        
        scene.add(this.group);
    }

    update(deltaTime, playerPos) {
        if (this.state === 'DEAD') return;
        
        // Actualizar el AnimationMixer si está disponible y está vivo
        if (this.mixer && this.state === 'ALIVE') {
            this.mixer.update(deltaTime);
        }
        
        if (this.state === 'DYING') {
            // Animación de caída al morir
            if (this.activeAction) {
                this.activeAction.paused = true;
            }
            if (this.group.rotation.x > -Math.PI / 2) {
                this.group.rotation.x -= deltaTime * 4;
                this.group.position.y = Math.max(0.1, this.group.position.y - deltaTime * 2);
            } else {
                this.state = 'DEAD';
                zombiesRemainingCount();
            }
            return;
        }

        // Recuperar color normal tras flash de daño
        if (this.hurtTimer > 0) {
            this.hurtTimer -= deltaTime;
            if (this.hurtTimer <= 0) {
                this.setMaterialColor(null);
            }
        }
        
        // Temporizador de ataque
        if (this.attackCooldownTimer > 0) {
            this.attackCooldownTimer -= deltaTime * 1000;
        }

        // IA: Perseguir al jugador
        const dir = new THREE.Vector3().subVectors(playerPos, this.group.position);
        dir.y = 0;
        const dist = dir.length();
        dir.normalize();
        
        const angle = Math.atan2(dir.x, dir.z);
        this.group.rotation.y = angle;
        
        // Gemidos aleatorios ocasionales
        if (Math.random() < 0.003 && dist < 22) {
            AudioSynth.playZombieGroan();
        }

        // Ataque de ácido para Escupidores (Spitters)
        if (this.type === 'SPITTER' && dist < 12.0 && dist > 2.0 && this.state === 'ALIVE') {
            this.spitCooldownTimer -= deltaTime * 1000;
            if (this.spitCooldownTimer <= 0) {
                this.spitAcid(dir);
                this.spitCooldownTimer = 2000 + Math.random() * 2000; // cada 2-4 segundos
            }
        }

        if (dist > ZOMBIE_ATTACK_DIST) {
            // Moverse hacia el jugador (escalando con la velocidad del nivel)
            const currentSpeed = ZOMBIE_SPEED * this.speedMultiplier * (1.0 + (currentLevel - 1) * 0.08);
            const nextX = this.group.position.x + dir.x * currentSpeed;
            const nextZ = this.group.position.z + dir.z * currentSpeed;
            
            // Colisiones con paredes y compuertas cerradas
            const resolved = checkZombieWallCollisions(nextX, nextZ);
            this.group.position.x = resolved.x;
            this.group.position.z = resolved.z;
            
            // Animación de caminata
            if (this.zombieMesh) {
                if (this.activeAction) {
                    this.activeAction.paused = false;
                }
                // Limpiar cualquier rotación/desplazamiento residual procedimental en el mesh raíz
                this.zombieMesh.rotation.z = 0;
                this.zombieMesh.rotation.x = 0;
                this.zombieMesh.position.y = this.baseYOffset;
            } else {
                this.walkCycle += deltaTime * 8 * this.speedMultiplier;
                this.leftLeg.rotation.x = Math.sin(this.walkCycle) * 0.45;
                this.rightLeg.rotation.x = -Math.sin(this.walkCycle) * 0.45;
                this.leftArm.rotation.x = (Math.sin(this.walkCycle * 0.5) * 0.1);
                this.rightArm.rotation.x = -(Math.sin(this.walkCycle * 0.5) * 0.1);
                
                this.torso.position.y = 0.55 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.05;
                this.head.position.y = 1.28 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.04;
            }
        } else {
            // Atacar!
            if (this.activeAction) {
                this.activeAction.paused = true;
            }
            if (this.attackCooldownTimer <= 0 && player.health > 0) {
                this.attack();
            }
        }
    }

    spitAcid(dir) {
        // Sonido de escupitajo neumático procedimental
        AudioSynth.playMetallicClick(350, 0.15, 0.2);
        
        // Spawnear proyectil verde en la posición de la cabeza
        const startPos = this.group.position.clone();
        startPos.y += 1.28;
        
        const projGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const projMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
        const projMesh = new THREE.Mesh(projGeo, projMat);
        projMesh.position.copy(startPos);
        
        const projLight = new THREE.PointLight(0x39ff14, 1.5, 3);
        projMesh.add(projLight);
        
        scene.add(projMesh);
        
        // Apuntar con pequeña imprecisión
        const targetPos = camera.position.clone();
        targetPos.x += (Math.random() - 0.5) * 0.4;
        targetPos.z += (Math.random() - 0.5) * 0.4;
        
        const velocity = new THREE.Vector3().subVectors(targetPos, startPos).normalize().multiplyScalar(0.18);
        
        acidProjectiles.push({
            mesh: projMesh,
            velocity: velocity,
            life: 3.5,
            damage: 15
        });
        
        // Animación rápida de escupitajo
        if (this.zombieMesh) {
            const originalZ = this.zombieMesh.position.z;
            this.zombieMesh.position.z += 0.25;
            setTimeout(() => {
                if (this.zombieMesh) this.zombieMesh.position.z = originalZ;
            }, 300);
        } else {
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
        if (this.state !== 'ALIVE') return;
        
        this.health -= amount;
        
        this.setMaterialColor(0xff0000);
        this.hurtTimer = 0.12;
        
        AudioSynth.playZombieHurt();
        
        if (this.health <= 0) {
            this.state = 'DYING';
            const backDir = new THREE.Vector3().subVectors(this.group.position, camera.position).normalize();
            this.group.position.addScaledVector(backDir, 0.4);
        }
    }

    setMaterialColor(hexColor) {
        if (this.zombieMesh) {
            this.zombieMesh.traverse(child => {
                if (child.isMesh && child.material) {
                    if (hexColor !== null) {
                        child.material.color.setHex(hexColor);
                    } else {
                        // Restaurar tinte basado en variante
                        if (this.type === 'RUNNER') {
                            child.material.color.setHex(0xff5555);
                        } else if (this.type === 'SPITTER') {
                            child.material.color.setHex(0x55ff55);
                        } else {
                            child.material.color.setHex(0xffffff); // Sin tinte (original)
                        }
                    }
                }
            });
        } else {
            const list = [this.torso, this.leftArm, this.rightArm, this.leftLeg, this.rightLeg, this.jaw];
            list.forEach(mesh => {
                if (mesh) {
                    if (hexColor !== null) {
                        mesh.material.color.setHex(hexColor);
                    } else {
                        if (mesh === this.torso) mesh.material.color.setHex(this.colorClothing);
                        else if (mesh === this.leftLeg || mesh === this.rightLeg) mesh.material.color.setHex(0x111115);
                        else mesh.material.color.setHex(this.colorSkin);
                    }
                }
            });
            
            if (this.ribcage && this.blood) {
                if (hexColor !== null) {
                    this.ribcage.material.color.setHex(hexColor);
                    this.blood.material.color.setHex(hexColor);
                } else {
                    this.ribcage.material.color.setHex(0x8a8578);
                    this.blood.material.color.setHex(0x400000);
                }
            }
            
            if (this.headMaterials) {
                this.headMaterials.forEach((mat) => {
                    if (hexColor !== null) {
                        mat.color.setHex(hexColor);
                    } else {
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
                if (this.zombieMesh) this.zombieMesh.position.z = originalZ;
            }, 200);
        } else {
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

// Spawnea zombis en posiciones vacías del mapa
function spawnZombies() {
    zombies.forEach(z => scene.remove(z.group));
    zombies = [];
    
    // Limpiar proyectiles de ácido viejos
    acidProjectiles.forEach(p => scene.remove(p.mesh));
    acidProjectiles = [];
    
    let spawned = 0;
    let attempts = 0;
    
    // La cantidad de zombis escala con el nivel
    const zombiesToSpawn = 6 + currentLevel * 2;
    
    while (spawned < zombiesToSpawn && attempts < 200) {
        attempts++;
        const z = Math.floor(Math.random() * activeMap.length);
        const x = Math.floor(Math.random() * activeMap[z].length);
        
        if (activeMap[z][x] === 0) {
            if (x < 3 && z < 3) continue;
            
            const px = x * GRID_SIZE;
            const pz = z * GRID_SIZE;
            
            // Elegir tipo según probabilidades: 50% Normal, 25% Runner, 25% Spitter
            let zType = 'NORMAL';
            const rand = Math.random();
            if (rand < 0.5) {
                zType = 'NORMAL';
            } else if (rand < 0.75) {
                zType = 'RUNNER';
            } else {
                zType = 'SPITTER';
            }
            
            zombies.push(new Zombie(px, pz, zType));
            spawned++;
        }
    }
    zombiesRemainingCount();
}

function zombiesRemainingCount() {
    const aliveCount = zombies.filter(z => z.state === 'ALIVE').length;
    zombieCountEl.innerText = aliveCount;
    
    if (aliveCount === 0 && gameState === 'PLAYING') {
        showFeedback("SECTOR LIMPIO. ENCUENTRA LOS FUSIBLES Y ACTIVA EL GENERADOR");
    }
}

// --- SISTEMA DE PARTÍCULAS (SANGRE / CHISPAS / ELECTRICIDAD) ---
class Particle {
    constructor(pos, color, scale, speedY) {
        this.geometry = new THREE.BoxGeometry(scale, scale, scale);
        this.material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.copy(pos);
        scene.add(this.mesh);
        
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.12,
            Math.random() * 0.06 + speedY,
            (Math.random() - 0.5) * 0.12
        );
        this.gravity = -0.005;
        this.life = 1.0; // segundos
    }
    
    update(deltaTime) {
        this.velocity.y += this.gravity;
        this.mesh.position.add(this.velocity);
        this.life -= deltaTime * 1.8;
        this.material.opacity = Math.max(0, this.life);
        
        if (this.life <= 0) {
            scene.remove(this.mesh);
            this.geometry.dispose();
            this.material.dispose();
            return false;
        }
        return true;
    }
}

function spawnBloodSpatter(pos) {
    for (let i = 0; i < 18; i++) {
        particles.push(new Particle(pos, 0x990000, 0.05 + Math.random()*0.04, 0.05));
    }
}

function spawnSparkSpatter(pos) {
    for (let i = 0; i < 8; i++) {
        particles.push(new Particle(pos, 0xffd700, 0.03 + Math.random()*0.03, 0.02));
    }
}

// --- COLISIONES JUGADOR ---
function checkCollisions(newX, newZ) {
    let resolvedX = newX;
    let resolvedZ = newZ;
    
    const currentGridX = Math.floor((newX + GRID_SIZE/2) / GRID_SIZE);
    const currentGridZ = Math.floor((newZ + GRID_SIZE/2) / GRID_SIZE);
    
    // Verificar celdas vecinas (3x3)
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const gx = currentGridX + dx;
            const gz = currentGridZ + dz;
            
            if (gx < 0 || gx >= activeMap[0].length || gz < 0 || gz >= activeMap.length) continue;
            
            const type = activeMap[gz][gx];
            if (type === 1 || type === 2 || type === 3) {
                // Si es compuerta normal interactiva
                if (type === 3) {
                    const door = interactiveDoors.find(d => d.gridX === gx && d.gridZ === gz);
                    if (door && door.isOpen) {
                        continue; // Bypasear colisión si está abierta
                    }
                }

                const boxMinX = gx * GRID_SIZE - GRID_SIZE/2;
                const boxMaxX = gx * GRID_SIZE + GRID_SIZE/2;
                const boxMinZ = gz * GRID_SIZE - GRID_SIZE/2;
                const boxMaxZ = gz * GRID_SIZE + GRID_SIZE/2;
                
                const closestX = Math.max(boxMinX, Math.min(resolvedX, boxMaxX));
                const closestZ = Math.max(boxMinZ, Math.min(resolvedZ, boxMaxZ));
                
                const diffX = resolvedX - closestX;
                const diffZ = resolvedZ - closestZ;
                const dist = Math.sqrt(diffX*diffX + diffZ*diffZ);
                
                if (dist < PLAYER_RADIUS) {
                    if (dist === 0) continue;
                    
                    // Si es compuerta de salida (2)
                    if (type === 2) {
                        const exitCollider = colliders.find(c => c.isExit);
                        if (exitCollider && exitCollider.unlocked) {
                            triggerVictory();
                            return { x: resolvedX, z: resolvedZ };
                        } else {
                            // Advertencia rápida en HUD
                            if (fusesCollected >= 3) {
                                showFeedback("PRESIONA 'E' EN EL GENERADOR (LUZ ROJA) PARA ABRIR EL ESCAPE");
                            } else {
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
    
    const currentGridX = Math.floor((zX + GRID_SIZE/2) / GRID_SIZE);
    const currentGridZ = Math.floor((zZ + GRID_SIZE/2) / GRID_SIZE);
    
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const gx = currentGridX + dx;
            const gz = currentGridZ + dz;
            
            if (gx < 0 || gx >= activeMap[0].length || gz < 0 || gz >= activeMap.length) continue;
            
            const type = activeMap[gz][gx];
            if (type === 1 || type === 2 || type === 3) {
                if (type === 3) {
                    const door = interactiveDoors.find(d => d.gridX === gx && d.gridZ === gz);
                    if (door && door.isOpen) {
                        continue;
                    }
                }

                const boxMinX = gx * GRID_SIZE - GRID_SIZE/2;
                const boxMaxX = gx * GRID_SIZE + GRID_SIZE/2;
                const boxMinZ = gz * GRID_SIZE - GRID_SIZE/2;
                const boxMaxZ = gz * GRID_SIZE + GRID_SIZE/2;
                
                const closestX = Math.max(boxMinX, Math.min(resolvedX, boxMaxX));
                const closestZ = Math.max(boxMinZ, Math.min(resolvedZ, boxMaxZ));
                
                const diffX = resolvedX - closestX;
                const diffZ = resolvedZ - closestZ;
                const dist = Math.sqrt(diffX*diffX + diffZ*diffZ);
                
                if (dist < zRadius) {
                    if (dist === 0) continue;
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
    if (player.health <= 0 || gameState !== 'PLAYING') return;
    
    if (player.armor > 0) {
        const armorDamage = Math.floor(amount * 0.6);
        player.armor = Math.max(0, player.armor - armorDamage);
        player.health = Math.max(0, player.health - (amount - armorDamage));
    } else {
        player.health = Math.max(0, player.health - amount);
    }
    
    if (isAcid) {
        damageFlash.classList.add('acid');
        AudioSynth.playAcidBurn();
    } else {
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
        if (!fuseBoxConsole) return false;
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

    if ((isCloseToConsole || isCloseToExitDoor) && fuseBoxConsole && !fuseBoxConsole.activated) {
        if (currentLevel >= 2 && !wiringFixed) {
            if (isCloseToConsole) {
                openWiringMinigame();
            } else {
                showFeedback("ERROR: CABLEADO AUXILIAR DAÑADO. REPARA EL PANEL CON 'E'");
            }
            return;
        }
        
        if (fusesCollected >= 3) {
            // Activar generador!
            fuseBoxConsole.activated = true;
            fuseBoxConsole.led.material.color.setHex(0x00ff41); // Luz a verde
            fuseBoxConsole.ledLight.color.setHex(0x00ff41);
            
            AudioSynth.playPowerRestored();
            showFeedback("ENERGÍA RESTAURADA. ESCAPE ACTIVADO");
            
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
                    } else {
                        exitDoor.mesh.position.y = initialY + WALL_HEIGHT;
                        clearInterval(exitSlide);
                    }
                }, 50);
            }
            
            // Encender las lámparas parpadeantes de la instalación de forma fija
            lights.forEach(item => {
                item.light.intensity = 2.0;
                item.lamp.material.color.setHex(0xffffff);
            });
            lights = []; // suspender el parpadeo
            
            // Montar visualmente los 3 fusibles en la consola
            const fuseCapMat = new THREE.MeshStandardMaterial({ color: 0xe5a93b, roughness: 0.3, metalness: 0.85 });
            const fuseGlassMat = new THREE.MeshStandardMaterial({ color: 0x00ff41, emissive: 0x008822, transparent: true, opacity: 0.9 });
            
            for(let k=0; k<3; k++) {
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
        } else {
            showFeedback(`GENERADOR SIN ENERGÍA. REQUIERE 3 FUSIBLES (TIENES ${fusesCollected}/3)`);
        }
    }
}

// --- DISPARAR Y RECARGAR ---
function shoot() {
    if (player.isReloading) return;
    
    const activeWep = WEAPONS[player.activeWeapon];
    
    // Validar cooldown en armas semi-automáticas
    if (!activeWep.automatic && gunRecoilActive) return;
    
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
    } else if (player.activeWeapon === 'glock') {
        AudioSynth.playGlockShot();
    } else if (player.activeWeapon === 'm4') {
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
            targets.push(z.torso, z.head, z.leftArm, z.rightArm, z.leftLeg, z.rightLeg);
        }
    });
    
    const intersects = raycaster.intersectObjects(targets);
    
    if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        const hitPoint = intersects[0].point;
        
        let hitZombie = null;
        for (let z of zombies) {
            if (z.state === 'ALIVE' && (
                hitObj === z.torso || 
                hitObj === z.head || 
                hitObj === z.leftArm || 
                hitObj === z.rightArm ||
                hitObj === z.leftLeg ||
                hitObj === z.rightLeg
            )) {
                hitZombie = z;
                break;
            }
        }
        
        if (hitZombie) {
            let dmg = activeWep.damage;
            if (hitObj === hitZombie.head) {
                dmg = dmg * 3; // Triple daño por headshot
                showFeedback("¡TIRO A LA CABEZA!");
            }
            hitZombie.damage(dmg);
            spawnBloodSpatter(hitPoint);
        } else {
            spawnSparkSpatter(hitPoint);
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
    if (player.isReloading || player.ammoClip === player.clipMax || player.ammoReserve <= 0) return;
    
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
        } else if (t < 1.0) {
            gunGroup.position.y = (originalY - 0.15) + ((t - 0.5) * 0.3);
        } else {
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
    
    // Restablecer variables de progresión y tienda
    currentLevel = 1;
    supplyPoints = 0;
    unlockedWeapons.glock = false;
    unlockedWeapons.m4 = false;
    wiringFixed = false;
    
    document.getElementById('level-display').innerText = `SECTOR C-14   |   NIVEL ${currentLevel}`;

    // Reconstruir el mapa para el Nivel 1
    clearCurrentMap();
    updateLevelEnvironment();
    buildMap3D();
    await addBloodWallMessages(scene, currentLevel);

    // Restablecer textos de victoria original en el overlay
    const titleEl = victoryOverlay.querySelector('.victory-title');
    const subtitleEl = victoryOverlay.querySelector('.subtitle');
    const msgEl = victoryOverlay.querySelector('.victory-message');
    const btnEl = victoryOverlay.querySelector('.victory-btn');
    if (titleEl) titleEl.innerText = "MISIÓN COMPLETADA";
    if (subtitleEl) subtitleEl.innerText = "SECTOR PURGADO COMPLETAMENTE";
    if (msgEl) msgEl.innerText = "Has restaurado la energía y escapado con vida de la instalación. Excelente trabajo, soldado.";
    if (btnEl) btnEl.innerText = "REINICIAR OPERACIÓN";
    
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
    
    player.position.set(GRID_SIZE * 1.0, 1.8, GRID_SIZE * 1.0);
    player.yaw = 0;
    player.pitch = 0;
    player.isReloading = false;
    
    camera.position.copy(player.position);
    camera.rotation.set(0, 0, 0);
    
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
        fuseBoxConsole.ledLight.color.setHex(0xff0000);
        
        // Limpiar fusibles montados
        for(let k=0; k<3; k++) {
            try {
                const fuseMesh = fuseBoxConsole.group.getObjectByName(`mounted_fuse_${k}`);
                if (fuseMesh) fuseBoxConsole.group.remove(fuseMesh);
            } catch(e){}
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
    particles.forEach(p => scene.remove(p.mesh));
    particles = [];
    acidProjectiles.forEach(p => scene.remove(p.mesh));
    acidProjectiles = [];
    
    // Spawnear fusibles
    spawnFuses();

    // Spawneo de zombis
    spawnZombies();
    
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
}

function triggerVictory() {
    isMouseDown = false;
    document.exitPointerLock();
    AudioSynth.stopHorrorMusic();
    
    if (currentLevel === 3) {
        // Capítulo 1 Completado!
        gameState = 'VICTORY';
        victoryOverlay.classList.add('active');
        
        const titleEl = victoryOverlay.querySelector('.victory-title');
        const subtitleEl = victoryOverlay.querySelector('.subtitle');
        const msgEl = victoryOverlay.querySelector('.victory-message');
        const btnEl = victoryOverlay.querySelector('.victory-btn');
        
        if (titleEl) titleEl.innerText = "CAPÍTULO 1 COMPLETADO";
        if (subtitleEl) subtitleEl.innerText = "SOBREVIVISTE A LA MONTAÑA HELADA";
        if (msgEl) {
            msgEl.innerHTML = "Has escapado de la instalación biológica, cruzado la selva hostil y sobrevivido al frío extremo de la montaña.<br><br><strong>FIN DEL CAPÍTULO 1.</strong><br>El próximo capítulo comenzará pronto...";
        }
        if (btnEl) btnEl.innerText = "VOLVER A JUGAR";
        
        AudioSynth.playWinTune();
    } else {
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
    if (player.isReloading || gameState !== 'PLAYING') return;
    
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
    } else {
        buyGlockBtn.innerText = "DESBLOQUEAR";
        buyGlockBtn.className = "retro-btn shop-btn";
        buyGlockBtn.disabled = (supplyPoints < 1);
    }
    
    if (unlockedWeapons.m4) {
        buyM4Btn.innerText = "DESBLOQUEADO";
        buyM4Btn.className = "retro-btn shop-btn unlocked";
        buyM4Btn.disabled = true;
    } else {
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
    currentLevel++;
    document.getElementById('level-display').innerText = `SECTOR C-14   |   NIVEL ${currentLevel}`;

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
    colliders.forEach(c => { if(c.isExit) c.unlocked = false; });
    
    const exitDoor = colliders.find(c => c.isExit);
    if (exitDoor && exitDoor.mesh) {
        exitDoor.mesh.position.y = WALL_HEIGHT / 2;
        exitDoor.isOpen = false;
    }
    
    if (fuseBoxConsole) {
        fuseBoxConsole.activated = false;
        fuseBoxConsole.led.material.color.setHex(0xff0000);
        fuseBoxConsole.ledLight.color.setHex(0xff0000);
        for(let k=0; k<3; k++) {
            try {
                const fuseMesh = fuseBoxConsole.group.getObjectByName(`mounted_fuse_${k}`);
                if (fuseMesh) fuseBoxConsole.group.remove(fuseMesh);
            } catch(e){}
        }
    }

    interactiveDoors.forEach(door => {
        door.mesh.position.y = WALL_HEIGHT / 2;
        door.mesh.material.color.setHex(0xffffff);
        door.state = 'CLOSED';
        door.isOpen = false;
    });

    player.position.set(GRID_SIZE * 1.0, 1.8, GRID_SIZE * 1.0);
    camera.position.copy(player.position);
    
    // Limpiar partículas y proyectiles
    particles.forEach(p => scene.remove(p.mesh));
    particles = [];
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
    document.body.requestPointerLock();
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
    if (overlay) overlay.classList.add('active');
    
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
    if (overlay) overlay.classList.remove('active');
    
    gameState = 'PLAYING';
    document.body.requestPointerLock();
}

function drawWiring() {
    const canvas = document.getElementById('wiring-canvas');
    if (!canvas) return;
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
            fuseBoxConsole.wiringLedLight.color.setHex(0x00ff41);
            fuseBoxConsole.wiringLedLight.intensity = 0.8;
        }
        
        setTimeout(() => {
            closeWiringMinigame();
        }, 1000);
    }
}

function setupWiringCanvasEvents() {
    const canvas = document.getElementById('wiring-canvas');
    if (!canvas) return;
    
    canvas.addEventListener('mousedown', (e) => {
        if (gameState !== 'WIRING') return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        for (let i = 0; i < leftSockets.length; i++) {
            const socket = leftSockets[i];
            const dist = Math.sqrt((mx - socket.x)**2 + (my - socket.y)**2);
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
        if (gameState !== 'WIRING' || draggingWireIdx === -1) return;
        const rect = canvas.getBoundingClientRect();
        mousePos.x = e.clientX - rect.left;
        mousePos.y = e.clientY - rect.top;
        drawWiring();
    });
    
    canvas.addEventListener('mouseup', (e) => {
        if (gameState !== 'WIRING' || draggingWireIdx === -1) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        let connected = false;
        for (let i = 0; i < rightSockets.length; i++) {
            const socket = rightSockets[i];
            const dist = Math.sqrt((mx - socket.x)**2 + (my - socket.y)**2);
            if (dist < 25) {
                if (socket.symbol === leftSockets[draggingWireIdx].symbol) {
                    leftSockets[draggingWireIdx].connectedTo = i;
                    AudioSynth.playMetallicClick(1200, 0.1, 0.15);
                    connected = true;
                    checkWiringVictory();
                } else {
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
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    winBtn.addEventListener('click', startGame);
    
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
        } else {
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
            if (k === 'E') tryOpenDoor();
            if (k === '1') switchWeapon('shotgun');
            if (k === '2') switchWeapon('glock');
            if (k === '3') switchWeapon('m4');
        }
    });
    
    window.addEventListener('keyup', (e) => {
        const k = e.key.toUpperCase();
        keyboard[k] = false;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (gameState !== 'PLAYING' || document.pointerLockElement !== document.body) return;
        
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
    camera.aspect = window.innerWidth / (window.innerHeight - 110);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight - 110);
}

// --- BIOMONITOR ECG PROCEDIMENTAL EN TIEMPO REAL ---
const bioCanvas = document.getElementById('biomonitor-canvas');
const bioCtx = bioCanvas.getContext('2d');
let bioTime = 0;

function drawBiomonitor(deltaTime) {
    if (!bioCtx) return;
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
    bioCtx.moveTo(4, 30); bioCtx.lineTo(56, 30);
    bioCtx.moveTo(30, 4); bioCtx.lineTo(30, 56);
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
    } else if (player.health < 30) {
        color = '#ff2020';
        pulseInterval = 0.35;
    } else if (player.health < 70) {
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
        } else if (phase >= 0.16 && phase < 0.18) {
            const qVal = (phase - 0.16) / 0.02;
            y = 30 + qVal * 2;
        } else if (phase >= 0.18 && phase < 0.23) {
            const qrsVal = (phase - 0.18) / 0.05;
            if (qrsVal < 0.5) {
                y = 32 - (qrsVal / 0.5) * 19; 
            } else {
                y = 13 + ((qrsVal - 0.5) / 0.5) * 21;
            }
        } else if (phase >= 0.23 && phase < 0.26) {
            const sVal = (phase - 0.23) / 0.03;
            y = 34 - (1 - sVal) * 4;
        } else if (phase >= 0.32 && phase < 0.44) {
            const tVal = (phase - 0.32) / 0.12;
            y = 30 - Math.sin(tVal * Math.PI) * 4;
        }
        
        if (x === 0) bioCtx.moveTo(screenX, y);
        else bioCtx.lineTo(screenX, y);
    }
    
    bioCtx.stroke();
    bioCtx.shadowBlur = 0;
}

// --- BUCLE DE RENDERIZADO PRINCIPAL (ANIMATE) ---
function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = Math.min(0.1, clock.getDelta());
    
    drawBiomonitor(deltaTime);
    
    if (gameState === 'PLAYING') {
        // Disparar en ráfaga para armas automáticas
        const activeWep = WEAPONS[player.activeWeapon];
        if (activeWep.automatic && isMouseDown && !player.isReloading && !gunRecoilActive) {
            autoFireTimer += deltaTime * 1000;
            if (autoFireTimer >= activeWep.fireInterval) {
                shoot();
                autoFireTimer = 0;
            }
        } else if (!isMouseDown) {
            autoFireTimer = activeWep.fireInterval;
        }

        // Actualizar luces parpadeantes
        lights.forEach(item => {
            item.flickerTimer += deltaTime;
            const noise = Math.sin(item.flickerTimer * 10) * Math.cos(item.flickerTimer * 4.3);
            if (noise > 0.4) {
                item.light.intensity = 0.1;
                item.lamp.material.color.setHex(0x332211);
            } else {
                item.light.intensity = item.isRed ? 1.5 : 1.2;
                item.lamp.material.color.setHex(item.isRed ? 0xcc0000 : 0xe59400);
            }
        });

        // Actualizar luces de cableado auxiliar en consola
        if (currentLevel >= 2 && fuseBoxConsole && fuseBoxConsole.wiringLed) {
            if (!wiringFixed) {
                const flash = Math.sin(clock.getElapsedTime() * 8) > 0;
                fuseBoxConsole.wiringLed.material.color.setHex(flash ? 0xffaa00 : 0x221100);
                fuseBoxConsole.wiringLedLight.intensity = flash ? 0.8 : 0.0;
            } else {
                fuseBoxConsole.wiringLed.material.color.setHex(0x00ff41);
                fuseBoxConsole.wiringLedLight.color.setHex(0x00ff41);
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
            
            fuse.light.intensity = 1.0 + Math.sin(fuse.angle * 4) * 0.35;
            
            // Emitir chispas eléctricas azules procedimentales
            if (Math.random() < 0.08) {
                const sparkPos = fuse.mesh.position.clone();
                sparkPos.x += (Math.random() - 0.5) * 0.3;
                sparkPos.y += (Math.random() - 0.5) * 0.4;
                sparkPos.z += (Math.random() - 0.5) * 0.3;
                particles.push(new Particle(sparkPos, 0x00d9ff, 0.02 + Math.random()*0.02, 0.015));
            }
        });

        // Colisión de recogida automática de fusibles
        for (let i = fuses.length - 1; i >= 0; i--) {
            const fuse = fuses[i];
            const dist = player.position.distanceTo(fuse.mesh.position);
            if (dist < 1.3) {
                // ¡Recogido!
                scene.remove(fuse.mesh);
                scene.remove(fuse.light);
                fuses.splice(i, 1);
                
                fusesCollected++;
                updateFuseHUD();
                AudioSynth.playFusePickup();
                showFeedback(`FUSIBLE ELÉCTRICO RECOLECTADO (${fusesCollected}/3)`);
                
                // Generar chispas de luz alrededor del jugador
                for (let k = 0; k < 12; k++) {
                    const sparkPos = player.position.clone();
                    sparkPos.y -= 0.5; // altura cintura
                    particles.push(new Particle(sparkPos, 0x00d9ff, 0.03 + Math.random()*0.03, 0.03));
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
        
        // Actualizar proyectiles de ácido de los Spitters
        for (let i = acidProjectiles.length - 1; i >= 0; i--) {
            const proj = acidProjectiles[i];
            proj.mesh.position.add(proj.velocity);
            proj.life -= deltaTime;
            
            // Colisión con el jugador
            const distToPlayer = proj.mesh.position.distanceTo(camera.position);
            if (distToPlayer < 0.8) {
                damagePlayer(proj.damage, true);
                scene.remove(proj.mesh);
                acidProjectiles.splice(i, 1);
                continue;
            }
            
            // Colisión con paredes
            const gridX = Math.floor((proj.mesh.position.x + GRID_SIZE/2) / GRID_SIZE);
            const gridZ = Math.floor((proj.mesh.position.z + GRID_SIZE/2) / GRID_SIZE);
            let hitWall = false;
            
            if (gridX >= 0 && gridX < activeMap[0].length && gridZ >= 0 && gridZ < activeMap.length) {
                const type = activeMap[gridZ][gridX];
                if (type === 1 || type === 2 || type === 3) {
                    const boxMinX = gridX * GRID_SIZE - GRID_SIZE/2;
                    const boxMaxX = gridX * GRID_SIZE + GRID_SIZE/2;
                    const boxMinZ = gridZ * GRID_SIZE - GRID_SIZE/2;
                    const boxMaxZ = gridZ * GRID_SIZE + GRID_SIZE/2;
                    
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
                // Spawnear partículas de salpicadura verde
                AudioSynth.playMetallicClick(900, 0.05, 0.08);
                for (let k = 0; k < 8; k++) {
                    particles.push(new Particle(proj.mesh.position, 0x39ff14, 0.04 + Math.random()*0.03, 0.02));
                }
                scene.remove(proj.mesh);
                acidProjectiles.splice(i, 1);
                continue;
            }
        }
        
        // Actualizar partículas ambientales flotantes
        const elapsedTime = clock.getElapsedTime();
        ambientParticles.forEach(p => {
            p.mesh.position.y = p.baseY + Math.sin(elapsedTime * p.speed + p.phase) * p.amplitude;
            p.mesh.position.x = p.baseX + Math.sin(elapsedTime * p.speed * 0.7 + p.phase * 1.3) * p.driftX;
            p.mesh.position.z = p.baseZ + Math.cos(elapsedTime * p.speed * 0.5 + p.phase * 0.8) * p.driftZ;
            // Pulsación de opacidad sutil
            p.mesh.material.opacity = p.mesh.material.opacity * 0.99 + 
                (0.15 + 0.2 * Math.abs(Math.sin(elapsedTime * p.speed * 0.3 + p.phase))) * 0.01;
        });
        
        // Efecto bobbing de caminar
        const walkSpeed = player.velocity.length();
        if (walkSpeed > 0.01) {
            const bob = Math.sin(clock.getElapsedTime() * 12) * 0.06;
            camera.position.y = 1.8 + bob;
            gunGroup.position.x = 0.18 + Math.cos(clock.getElapsedTime() * 6) * 0.012;
            gunGroup.position.y = -0.20 + Math.abs(Math.sin(clock.getElapsedTime() * 12)) * 0.008;
        } else {
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
            } else if (gunRecoilTimer < (rTime + rRecovery)) {
                const ratio = (gunRecoilTimer - rTime) / rRecovery;
                gunGroup.position.z = (-0.45 + rForce) - ratio * rForce;
                gunGroup.rotation.x = rAngle * (1 - ratio);
            } else {
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
            particles.splice(i, 1);
        }
    }
    
    renderer.render(scene, camera);
}

function updatePlayerMovement(deltaTime) {
    player.velocity.set(0, 0, 0);
    
    const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forwardVec.y = 0;
    forwardVec.normalize();
    
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    rightVec.y = 0;
    rightVec.normalize();
    
    if (keyboard['W']) player.velocity.add(forwardVec);
    if (keyboard['S']) player.velocity.addScaledVector(forwardVec, -1);
    if (keyboard['D']) player.velocity.add(rightVec);
    if (keyboard['A']) player.velocity.addScaledVector(rightVec, -1);
    
    if (player.velocity.length() > 0) {
        player.velocity.normalize();
        player.velocity.multiplyScalar(PLAYER_SPEED);
        
        const nextX = player.position.x + player.velocity.x;
        const nextZ = player.position.z + player.velocity.z;
        
        const resolved = checkCollisions(nextX, nextZ);
        
        player.position.x = resolved.x;
        player.position.z = resolved.z;
    }
    
    camera.position.x = player.position.x;
    camera.position.z = player.position.z;
}

// Iniciar cargador del motor de renderizado
initEngine();
