import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Player from './Player/index.js';
import Field from './Field/index.js';
import Football from './Football/index.js';
import { isCoarsePointer, mountTouchControls } from './touch/controls.js';
import { createSfx } from './audio/sfx.js';
import { createHud } from './ui/hud.js';
import { Offense, qbSpot } from './offense/unit.js';
import { mountDesigner } from './play/designer.js';
import {
    PRESET_PLAYS,
    QB_OFFSET,
    isRun,
    loadCustomPlays,
    normalizePlay,
    saveCustomPlays
} from './game/plays.js';
import { formatClock, formatDown, formatPlayClock, formatYardLine, freshDrive, resolveDrive, snapDrive, tickClock, tickPlayClock } from './game/drive.js';
import { scoreRun } from './game/scoring.js';

const touchMode = isCoarsePointer();
if (touchMode) document.documentElement.classList.add('touch-mode');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const perfOn = new URLSearchParams(window.location.search).has('perf');
const sfx = createSfx();
const hud = createHud();

const gameState = {
    paused: false,
    designing: false,
    score: 0,
    ready: false,
    timeShown: false
};

const loadingScreen = document.getElementById('loading-screen');
const gameContainer = document.getElementById('game-container');
let touchControlsMounted = false;
let hinted = false;
let customs = loadCustomPlays();
let selected = PRESET_PLAYS[0];
let drive = freshDrive();
let playClockWhistled = false;
let sun = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 90, 230);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    precision: touchMode ? 'mediump' : 'highp'
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
gameContainer.appendChild(renderer.domElement);

if (touchMode) {
    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';
}

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

let player;
let field;
let football;
let offense;
const chase = new THREE.Vector3();
const wishForward = new THREE.Vector3();
const wishRight = new THREE.Vector3();

const shakeOffset = new THREE.Vector3();
let shakeAmount = 0;
let fovKick = 0;
const baseFov = 74;

function punch(amount) {
    if (reduceMotion) return;
    shakeAmount = Math.min(1, shakeAmount + amount);
    fovKick = Math.min(5, fovKick + amount * 3.5);
}

function playList() {
    return PRESET_PLAYS.concat(customs);
}

function refresh() {
    const liveGain = offense && offense.isRunLive()
        ? Math.round((carrierX() - drive.los) * 10) / 10
        : null;
    hud.setStats({
        score: gameState.score,
        catches: offense ? offense.catchCount : 0,
        route: selected.name
    });
    const playLive = offense && offense.mode !== 'pre';
    hud.setSituation({
        down: formatDown(drive),
        yard: formatYardLine(drive.los),
        playClock: formatPlayClock(playLive ? drive.playClock : 40),
        clock: formatClock(drive.clock),
        gain: liveGain
    });
}

function carrierX() {
    if (!offense) return drive.los;
    if (offense.mode === 'keeper') return camera.position.x;
    if (offense.mode === 'handoff') return offense.carrierX();
    return drive.los;
}

function setThrowLabel(text) {
    const button = document.getElementById('touch-throw');
    if (button) button.textContent = text;
}

function spotOffense() {
    offense.spot(drive.los);
    const pocket = qbSpot(drive.los);
    player.placePocket(pocket.x, pocket.z);
    player.setRunControl({ attack: false, look: true, suspended: false, cruise: 5.4 });
    football.setHandVisible(true);
    setThrowLabel('Throw');
    playClockWhistled = false;
}

function showOutcome(scored) {
    hud.showResult(scored);
    if (scored.touchdown) {
        sfx.touchdown();
        punch(0.7);
    } else if (scored.points > 0) {
        sfx.catch();
        punch(0.3);
    } else {
        sfx.incomplete();
    }
    if (scored.points > 0) gameState.score += scored.points;
}

function applyResolved(resolved, scored) {
    drive = resolved.drive;
    if (resolved.outcome === 'turnover') scored = { ...scored, label: 'TURNOVER', touchdown: false };
    if (resolved.outcome === 'time') scored = { label: 'TIME', points: 0, touchdown: false };
    showOutcome(scored);
    spotOffense();
    refresh();
}

function onThrowResult(result) {
    if (!offense || offense.isRunLive() || offense.mode === 'pre') return;
    const caught = result.points > 0;
    const gain = caught ? result.receiverX - drive.los : 0;
    const resolved = resolveDrive(drive, {
        gain,
        incomplete: !caught,
        touchdown: result.touchdown === true
    });
    applyResolved(resolved, result);
}

function endRun() {
    if (!offense || !offense.isRunLive()) return;
    const x = carrierX();
    const resolved = resolveDrive(drive, { gain: x - drive.los, touchdown: x >= 50 });
    const scored = scoreRun({ gain: resolved.gain, touchdown: resolved.outcome === 'touchdown' });
    applyResolved(resolved, scored);
}

function runHike() {
    if (!gameState.ready || gameState.designing || gameState.paused || drive.over) return;
    if (offense.mode !== 'pre') return;
    hud.hidePlaybook();
    offense.setPlay(selected);
    const kind = offense.snap();
    drive = snapDrive(drive);
    playClockWhistled = false;
    if (kind === 'keeper') player.setRunControl({ attack: false, look: true, suspended: false, cruise: 8.6 });
    else if (kind === 'handoff') {
        player.setRunControl({ attack: false, look: false, suspended: true, cruise: 5.4 });
        if (document.pointerLockElement) document.exitPointerLock();
    } else player.setRunControl({ attack: true, look: true, suspended: false, cruise: 5.4 });
    // Pass plays can throw. Runs cannot. Pre-snap cannot, until the hike above.
    football.setHandVisible(kind !== 'handoff');
    setThrowLabel(isRun(kind) ? 'Down' : 'Throw');
    if (!hinted) {
        hinted = true;
        hud.hideHint();
    }
    refresh();
}

function selectPlay(play) {
    selected = play;
    if (offense.mode === 'pre') offense.setPlay(play);
    hud.hidePlaybook();
    refresh();
}

function openPlaybook() {
    if (gameState.designing) return;
    if (document.pointerLockElement) document.exitPointerLock();
    const plays = playList();
    hud.renderPlaybook(plays, selected.id, selectPlay, deletePlay, () => hud.hidePlaybook());
}

function deletePlay(id) {
    customs = saveCustomPlays(customs.filter((play) => play.id !== id));
    if (selected.id === id) selected = PRESET_PLAYS[0];
    if (offense.mode === 'pre') offense.setPlay(selected);
    openPlaybook();
    refresh();
}

function openDesigner() {
    if (offense.mode !== 'pre' || gameState.paused) return;
    gameState.designing = true;
    hud.hidePlaybook();
    if (document.pointerLockElement) document.exitPointerLock();
    designer.open(selected);
}

function closeDesigner() {
    gameState.designing = false;
    designer.close();
}

const designer = mountDesigner({
    root: document.getElementById('designer'),
    onClose: closeDesigner,
    onSave: (draft) => {
        const play = normalizePlay({
            ...draft,
            id: `custom-${Date.now()}`,
            custom: true,
            kind: 'pass',
            name: draft.name && draft.name.trim() ? draft.name.trim() : 'My play'
        });
        customs = saveCustomPlays([play, ...customs.filter((item) => item.name !== play.name)]);
        selected = customs[0] || play;
        offense.setPlay(selected);
        closeDesigner();
        refresh();
    }
});

function revealGame() {
    if (gameState.ready) return;
    gameState.ready = true;
    player.setInputEnabled(true);
    if (touchMode && !touchControlsMounted) {
        touchControlsMounted = true;
        mountTouchControls({
            player,
            getPaused: () => gameState.paused || gameState.designing,
            onHike: () => runHike(),
            onPlays: () => openPlaybook(),
            onDraw: () => openDesigner(),
            onReset: () => {
                if (offense.isRunLive()) endRun();
                else if (offense.mode === 'pass' && !football.liveBall()) {
                    applyResolved(resolveDrive(drive, { incomplete: true }), { label: 'INCOMPLETE', points: 0, touchdown: false });
                } else if (offense.mode === 'pre') {
                    offense.setPlay(selected);
                    refresh();
                }
            },
            onThrowStart: () => {
                if (offense.isRunLive()) endRun();
                else player.startThrow();
            },
            onThrowEnd: () => {
                if (!offense.isRunLive()) player.endThrow();
            }
        });
        if (window.visualViewport) window.visualViewport.addEventListener('resize', onWindowResize);
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

const shakeDecay = () => {};
void shakeDecay;

function togglePause() {
    if (designer.isOpen()) {
        closeDesigner();
        return;
    }
    if (hud.playbookOpen()) {
        hud.hidePlaybook();
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
    } else if (!touchMode && player.allowLook) {
        renderer.domElement.requestPointerLock();
    }
}

let ignoreUnlock = false;
document.addEventListener('pointerlockchange', () => {
    if (touchMode || !gameState.ready || player.suspended) return;
    if (document.pointerLockElement === renderer.domElement) return;
    if (ignoreUnlock) {
        ignoreUnlock = false;
        return;
    }
    if (!gameState.paused && !gameState.designing && !hud.playbookOpen()) {
        gameState.paused = true;
        hud.setPaused(true);
        player.cancelThrow();
    }
});

function toggleMute() {
    sfx.setMuted(!sfx.isMuted());
    hud.setMuted(sfx.isMuted());
}

hud.setMuted(sfx.isMuted());
hud.fillPauseHelp(touchMode ? [
    'Plays picks a call. Draw builds your own.',
    'Hike snaps. Drag to aim, hold Throw to pass.',
    'On a run, move and tap Down.',
    'Left stick moves the ball carrier.'
] : [
    '1–6 select a play, P opens the playbook, D draws',
    'E hikes. Mouse or Space throws.',
    'Keeper and Handoff: move, Space whistles the play',
    'F stands, M mute, Esc pause'
]);
if (touchMode) {
    document.getElementById('pause-note').textContent = 'Tap Resume to continue';
}

document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM') toggleMute();
    if (!gameState.ready || gameState.designing) return;
    if (event.key === 'Escape') togglePause();
    else if (event.key === 'e' || event.key === 'E') runHike();
    else if (event.key === 'p' || event.key === 'P' || event.key === 't' || event.key === 'T') {
        if (hud.playbookOpen()) hud.hidePlaybook();
        else openPlaybook();
    } else if (event.key === 'd' || event.key === 'D' || event.key === 'b' || event.key === 'B') openDesigner();
    else if (event.key === 'f' || event.key === 'F') field.toggleField();
    else if (event.key === 'r' || event.key === 'R') {
        if (offense.isRunLive()) endRun();
        else if (offense.mode === 'pass' && !football.liveBall()) {
            applyResolved(resolveDrive(drive, { incomplete: true }), { label: 'INCOMPLETE', points: 0, touchdown: false });
        } else if (offense.mode === 'pre') offense.setPlay(selected);
    } else if (event.code === 'Space' && offense.isRunLive()) {
        event.preventDefault();
        endRun();
    } else if (/^[1-9]$/.test(event.key)) {
        const play = playList()[Number(event.key) - 1];
        if (play && offense.mode === 'pre') selectPlay(play);
    }
});

document.getElementById('resume-button').addEventListener('click', () => {
    if (gameState.paused) togglePause();
});
document.getElementById('plays-launch').addEventListener('click', () => openPlaybook());
document.getElementById('draw-launch').addEventListener('click', () => openDesigner());
document.getElementById('mute-button').addEventListener('click', toggleMute);
window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
window.addEventListener('keydown', () => sfx.unlock(), { once: true });

function whistlePlayClock() {
    if (playClockWhistled || !offense) return;
    if (offense.isRunLive()) {
        playClockWhistled = true;
        endRun();
    } else if (offense.mode === 'pass' && football && !football.liveBall()) {
        playClockWhistled = true;
        applyResolved(resolveDrive(drive, { incomplete: true }), { label: 'DELAY', points: 0, touchdown: false });
    }
}

function setupLighting() {
    scene.add(new THREE.AmbientLight(0xfff4e4, 0.38));
    scene.add(new THREE.HemisphereLight(0x9ecbff, 0x3d6a32, 0.62));
    sun = new THREE.DirectionalLight(0xfff1d0, 1.55);
    sun.position.set(18, 46, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -26;
    sun.shadow.camera.right = 26;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    sun.shadow.bias = -0.001;
    sun.target.position.set(4, 0, 0);
    scene.add(sun);
    scene.add(sun.target);
}

function applyResolution() {
    let width = window.innerWidth;
    let height = window.innerHeight;
    if (touchMode && window.visualViewport) {
        width = window.visualViewport.width;
        height = window.visualViewport.height;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touchMode ? 1.5 : 2));
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function onWindowResize() {
    applyResolution();
}

function noteThrown() {
    if (!hinted) {
        hinted = true;
        hud.hideHint();
    }
    sfx.throw();
    punch(0.28);
}

function init() {
    scene.add(camera);
    player = new Player(camera, renderer, world, { touch: touchMode });
    field = new Field(scene, world);
    offense = new Offense(scene, { shadows: true });
    field.bindOffense(offense);
    offense.setPlay(selected);
    offense.spot(0);
    player.placePocket(QB_OFFSET.x, QB_OFFSET.z);
    football = new Football(scene, world, camera, field, { onResult: onThrowResult });
    setupLighting();
    refresh();
    applyResolution();
    window.addEventListener('resize', onWindowResize);
    revealGame();
}

const clock = new THREE.Clock();
let perfFrames = 0;
let perfStamp = performance.now();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    camera.position.sub(shakeOffset);
    shakeOffset.set(0, 0, 0);

    if (!gameState.paused && gameState.ready && !gameState.designing) {
        if (drive.running && !hud.playbookOpen()) drive = tickClock(drive, delta);
        const playLive = offense && offense.mode !== 'pre' && !hud.playbookOpen();
        drive = tickPlayClock(drive, delta, playLive);
        if (playLive && drive.playClock <= 0) whistlePlayClock();
        if (drive.over && !gameState.timeShown) {
            gameState.timeShown = true;
            hud.showResult({ label: 'TIME', points: 0, touchdown: false });
            drive = freshDrive();
            spotOffense();
            gameState.timeShown = false;
        }
        world.step(1 / 60, delta, 3);
        if (offense.mode === 'handoff') {
            const wish = player.getWish();
            camera.getWorldDirection(wishForward);
            wishForward.y = 0;
            if (wishForward.lengthSq() < 1e-4) wishForward.set(1, 0, 0);
            wishForward.normalize();
            wishRight.crossVectors(camera.up, wishForward).normalize();
            offense.moveCarrier(
                wishForward.x * wish.forward + wishRight.x * wish.right,
                wishForward.z * wish.forward + wishRight.z * wish.right,
                delta
            );
            chase.set(offense.rb.x - 7, 2.5, offense.rb.z);
            camera.position.lerp(chase, 1 - Math.exp(-delta * 7));
            camera.lookAt(offense.rb.x + 9, 1.15, offense.rb.z);
        } else {
            player.update(delta);
        }
        offense.update(delta, football.liveBall());
        if (offense.isRunLive()) {
            const x = carrierX();
            const z = offense.mode === 'keeper' ? camera.position.z : offense.rb.z;
            if (x >= 50 || Math.abs(z) > 24.5) endRun();
        }
        if (player.consumeFullChargeTick()) sfx.full();
        const throwData = player.attackEnabled ? player.getThrowData() : null;
        if (throwData && offense.mode === 'pass') {
            const thrown = football.throw(throwData.power);
            if (thrown) noteThrown();
        }
        if (player.getNewFootballRequest()) football.putBallInHand();
        const charging = offense.mode === 'pass' && player.isChargingThrow();
        football.setCharging(charging ? player.getThrowPower() : null);
        football.update();
        hud.setPower(charging ? player.getThrowPower() : null, football.getReadout());
        if (sun) {
            sun.position.set(drive.los + 12, 46, 16);
            sun.target.position.set(drive.los + 4, 0, 0);
            sun.target.updateMatrixWorld();
        }
        refresh();
    }

    if (!reduceMotion && shakeAmount > 0) {
        const mag = shakeAmount * 0.05;
        shakeOffset.set((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag * 0.6, 0);
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
            const info = renderer.info.render;
            hud.setPerf(`${Math.round((perfFrames * 1000) / (now - perfStamp))} fps · ${info.triangles} tris · ${info.calls} draws`);
            perfFrames = 0;
            perfStamp = now;
        }
    }
}

init();
animate();
