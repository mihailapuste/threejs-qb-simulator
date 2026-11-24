import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Player from './Player/index.js';
import Field from './Field/index.js';
import Football from './Football/index.js';
import { isCoarsePointer, mountTouchControls } from './touch/controls.js';
import { createPlayerModelLoader, modelUrls } from './loading/assets.js';
import { createSfx } from './audio/sfx.js';
import { createHud } from './ui/hud.js';

const touchMode = isCoarsePointer();
if (touchMode) document.documentElement.classList.add('touch-mode');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const perfOn = new URLSearchParams(window.location.search).has('perf');
const sfx = createSfx();
const hud = createHud();

const gameState = {
    paused: false,
    score: 0,
    ready: false
};

const loadingScreen = document.getElementById('loading-screen');
const loadingPercent = document.getElementById('loading-percent');
const loadingBar = document.getElementById('loading-bar');
const loadingStatus = document.getElementById('loading-status');
const gameContainer = document.getElementById('game-container');

const {
    manager: loadingManager,
    loader: modelLoader,
    record: recordModelBytes,
    noteItems,
    getProgress
} = createPlayerModelLoader();
let touchControlsMounted = false;
let loadFailed = false;
let hinted = false;

function formatMegabytes(bytes) {
    return Math.round((Number(bytes) || 0) / 1_000_000);
}

function renderLoadProgress() {
    const { loaded, total, percent } = getProgress();
    if (loadingPercent) loadingPercent.textContent = `${percent}%`;
    if (loadingBar) loadingBar.style.width = `${percent}%`;
    if (loadingStatus) {
        loadingStatus.textContent = `Getting the players ready… ${formatMegabytes(loaded)} / ${formatMegabytes(total)} MB`;
    }
}

function noteModelProgress(url, event) {
    recordModelBytes(url, event);
    renderLoadProgress();
}

loadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
    noteItems(itemsLoaded, itemsTotal);
    renderLoadProgress();
};

function revealGame() {
    if (gameState.ready) return;
    gameState.ready = true;
    if (player) player.setInputEnabled(true);

    if (touchMode && !touchControlsMounted) {
        touchControlsMounted = true;
        mountTouchControls({
            player,
            getPaused: () => gameState.paused,
            onNewBall: () => player.requestNewBall(),
            onHike: () => runHike(),
            onRoutes: () => openRouteMenu(),
            onReset: () => runResetReceiver()
        });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', onWindowResize);
        }
    }

    gameContainer.classList.remove('is-loading');
    loadingScreen.setAttribute('aria-busy', 'false');
    loadingScreen.classList.add('is-done');

    const hideGate = () => {
        loadingScreen.setAttribute('aria-hidden', 'true');
        loadingScreen.style.display = 'none';
    };
    loadingScreen.addEventListener('transitionend', hideGate, { once: true });
    window.setTimeout(hideGate, 450);
}

loadingManager.onLoad = () => {
    renderLoadProgress();
    if (loadFailed) return;
    revealGame();
};

loadingManager.onError = (url) => {
    loadFailed = true;
    console.error('Failed to load player model:', url);
    if (loadingStatus) {
        loadingStatus.textContent = 'Couldn’t load the players. Use Back or refresh to try again.';
    }
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 80, 220);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    precision: touchMode ? 'mediump' : 'highp'
});
// The player meshes are hundreds of thousands of vertices. A real shadow map
// of them misses 60fps on a phone, so the receiver carries a blob shadow.
gameContainer.appendChild(renderer.domElement);

if (touchMode) {
    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.webkitTouchCallout = 'none';
}

const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
});
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

let player;
let field;
let football;

const shakeOffset = new THREE.Vector3();
let shakeAmount = 0;
let fovKick = 0;
const baseFov = 74;

function punch(amount) {
    if (reduceMotion) return;
    shakeAmount = Math.min(1, shakeAmount + amount);
    fovKick = Math.min(5, fovKick + amount * 3.5);
}

function refreshStats() {
    hud.setStats({
        score: gameState.score,
        catches: field.getReceiverCatchCount(),
        route: field.getCurrentReceiverRoute()
    });
}

function onThrowResult(result) {
    if (result.points > 0) gameState.score += result.points;
    refreshStats();
    hud.showResult(result);
    if (result.touchdown) {
        sfx.touchdown();
        punch(0.75);
        if (navigator.vibrate) navigator.vibrate([16, 36, 20]);
    } else if (result.points > 0) {
        sfx.catch();
        punch(0.4);
        if (navigator.vibrate) navigator.vibrate(12);
    } else {
        sfx.incomplete();
    }
}

function runHike() {
    field.resetReceiver();
    field.startReceiverRoute();
    refreshStats();
}

function runResetReceiver() {
    field.resetReceiver();
    refreshStats();
}

function chooseRoute(routeName) {
    field.resetReceiver();
    field.startReceiverRoute(routeName);
    hud.hideRoutes();
    gameState.paused = false;
    refreshStats();
}

function openRouteMenu() {
    if (!gameState.ready) return;
    player.cancelThrow();
    football.setCharging(null);
    hud.renderRoutes(field.getReceiverRoutes(), field.getCurrentReceiverRoute(), chooseRoute, closeRouteMenu);
    gameState.paused = true;
    if (!touchMode && document.pointerLockElement) {
        ignoreUnlock = true;
        document.exitPointerLock();
    }
}

function closeRouteMenu() {
    hud.hideRoutes();
    gameState.paused = false;
}

let ignoreUnlock = false;

document.addEventListener('pointerlockchange', () => {
    if (touchMode || !gameState.ready) return;
    const locked = document.pointerLockElement === renderer.domElement;
    if (locked) return;
    if (ignoreUnlock) {
        ignoreUnlock = false;
        return;
    }
    // Esc exits pointer lock without a key event. That press is the pause.
    if (!gameState.paused && !hud.routesOpen()) {
        gameState.paused = true;
        hud.setPaused(true);
        player.cancelThrow();
        football.setCharging(null);
    }
});

function togglePause() {
    if (hud.routesOpen()) {
        closeRouteMenu();
        return;
    }
    gameState.paused = !gameState.paused;
    hud.setPaused(gameState.paused);
    if (gameState.paused) {
        player.cancelThrow();
        football.setCharging(null);
        if (document.pointerLockElement) {
            ignoreUnlock = true;
            document.exitPointerLock();
        }
    } else if (!touchMode) {
        renderer.domElement.requestPointerLock();
    }
}

function toggleMute() {
    sfx.setMuted(!sfx.isMuted());
    hud.setMuted(sfx.isMuted());
}

hud.setMuted(sfx.isMuted());
hud.fillPauseHelp(touchMode ? [
    'Drag anywhere to aim',
    'Hold Throw and drag to fine-tune',
    'Release Throw to pass',
    'Left stick moves',
    'Hike sends the receiver'
] : [
    'Mouse look, left mouse or Space to throw',
    'WASD to move in the pocket',
    'E hikes the receiver, R resets him',
    'T or 1 2 3 picks a route',
    'Q new ball, F stadium, M mute, Esc pause'
]);
if (touchMode) {
    document.getElementById('pause-note').textContent = 'Tap Resume to continue';
    hud.setHint('Drag to aim. Hold Throw and drag to fine-tune, then release.');
}

document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM') toggleMute();
    if (!gameState.ready) {
        const target = event.target;
        if (!(target && target.closest && target.closest('#back-link'))) {
            event.preventDefault();
            event.stopPropagation();
        }
        return;
    }
    if (event.key === 'Escape') {
        togglePause();
    } else if (event.key === 'e' || event.key === 'E') {
        runHike();
    } else if (event.key === 'r' || event.key === 'R') {
        runResetReceiver();
    } else if (event.key === 't' || event.key === 'T') {
        if (hud.routesOpen()) closeRouteMenu();
        else openRouteMenu();
    } else if (event.key === 'f' || event.key === 'F') {
        field.toggleField();
    } else if (event.key === '1' || event.key === '2' || event.key === '3') {
        const routes = field.getReceiverRoutes();
        const picked = routes[Number(event.key) - 1];
        if (picked) chooseRoute(picked);
    }
});

document.getElementById('resume-button').addEventListener('click', () => {
    if (gameState.paused) togglePause();
});
document.getElementById('mute-button').addEventListener('click', toggleMute);

function unlockAudio() {
    sfx.unlock();
}
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

function setupLighting() {
    scene.add(new THREE.AmbientLight(0xFFFFFF, touchMode ? 0.95 : 0.62));
    scene.add(new THREE.HemisphereLight(0xC5E4FF, 0x2A4A28, 0.45));

    const sun = new THREE.DirectionalLight(0xFFF4E0, touchMode ? 1.15 : 1.35);
    sun.position.set(40, 70, 24);
    scene.add(sun);
}

function applyResolution() {
    let width = window.innerWidth;
    let height = window.innerHeight;
    if (touchMode && window.visualViewport) {
        width = window.visualViewport.width;
        height = window.visualViewport.height;
    }
    const cap = touchMode ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (player) player.handleResize();
}

function onWindowResize() {
    applyResolution();
}

function init() {
    scene.add(camera);
    player = new Player(camera, renderer, world, {
        touch: touchMode,
        flat: touchMode,
        loader: modelLoader,
        modelUrl: modelUrls.quarterback,
        onLoadProgress: (event) => noteModelProgress(modelUrls.quarterback, event)
    });
    field = new Field(scene, world, {
        loader: modelLoader,
        receiverUrl: modelUrls.receiver,
        onReceiverProgress: (event) => noteModelProgress(modelUrls.receiver, event),
        flat: touchMode,
        shadows: false
    });
    football = new Football(scene, world, camera, field, { onResult: onThrowResult });
    setupLighting();
    refreshStats();
    applyResolution();
    window.addEventListener('resize', onWindowResize);
}

function noteThrown() {
    if (!hinted) {
        hinted = true;
        hud.hideHint();
    }
    sfx.throw();
    punch(0.28);
    if (navigator.vibrate) navigator.vibrate(8);
}

const clock = new THREE.Clock();
let perfFrames = 0;
let perfStamp = performance.now();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    camera.position.sub(shakeOffset);
    shakeOffset.set(0, 0, 0);

    if (!gameState.paused && gameState.ready) {
        world.step(1 / 60, delta, 3);
        player.update(delta);
        field.update(delta);

        if (player.consumeFullChargeTick()) sfx.full();
        const throwData = player.getThrowData();
        if (throwData) {
            const thrown = football.throw(throwData.power);
            if (thrown) noteThrown();
        }
        if (player.getNewFootballRequest()) football.putBallInHand();
        football.setCharging(player.isChargingThrow() ? player.getThrowPower() : null);
        football.update();
        hud.setPower(player.isChargingThrow() ? player.getThrowPower() : null, football.getReadout());
    } else if (!gameState.paused) {
        football.update();
    }

    if (!reduceMotion && shakeAmount > 0) {
        const mag = shakeAmount * 0.05;
        shakeOffset.set((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag * 0.65, 0);
        camera.position.add(shakeOffset);
        shakeAmount = Math.max(0, shakeAmount - delta * 2.2);
    }
    if (fovKick > 0 || camera.fov !== baseFov) {
        fovKick = Math.max(0, fovKick - delta * 16);
        const next = baseFov + (reduceMotion ? 0 : fovKick);
        if (Math.abs(camera.fov - next) > 0.02) {
            camera.fov = next;
            camera.updateProjectionMatrix();
        }
    }

    renderer.render(scene, camera);

    if (perfOn) {
        perfFrames += 1;
        const now = performance.now();
        if (now - perfStamp >= 500) {
            const fps = Math.round((perfFrames * 1000) / (now - perfStamp));
            const info = renderer.info.render;
            hud.setPerf(`${fps} fps · ${info.triangles} tris · ${info.calls} draws`);
            perfFrames = 0;
            perfStamp = now;
        }
    }
}

init();
animate();
