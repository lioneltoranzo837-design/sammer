import { GRID_SIZE, MAX_ARMOR, MAX_HEALTH } from '../config/gameConfig.js';

const { THREE } = window;

export function createInitialPlayer() {
    return {
        health: MAX_HEALTH,
        armor: MAX_ARMOR,
        ammoClip: 8,
        ammoReserve: 24,
        clipMax: 8,
        isReloading: false,
        position: new THREE.Vector3(GRID_SIZE * 1.5, 1.8, GRID_SIZE * 1.5),
        velocity: new THREE.Vector3(),
        pitch: 0,
        yaw: 0
    };
}

export function createKeyboardState() {
    return {};
}
