import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Player from './Player.js';
import Field from './Field.js';
import Football from './Football.js';

// Game state
const gameState = {
    receiverCaught: false,
    paused: false,
    score: 0
};

// DOM elements
const loadingScreen = document.getElementById('loading-screen');

// Create score display
const scoreDisplay = document.createElement('div');
scoreDisplay.id = 'score-display';
scoreDisplay.style.position = 'absolute';
scoreDisplay.style.top = '20px';
scoreDisplay.style.right = '20px';
scoreDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
scoreDisplay.style.color = 'white';
scoreDisplay.style.padding = '10px';
scoreDisplay.style.borderRadius = '5px';
scoreDisplay.style.zIndex = '100';
scoreDisplay.innerHTML = 'Score: 0';
document.getElementById('game-container').appendChild(scoreDisplay);

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('game-container').appendChild(renderer.domElement);

// Physics world
const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
});

// Game objects
let player, field, football;

// Pause menu
const pauseMenu = document.createElement('div');
pauseMenu.id = 'pause-menu';
pauseMenu.style.position = 'absolute';
pauseMenu.style.top = '50%';
pauseMenu.style.left = '50%';
pauseMenu.style.transform = 'translate(-50%, -50%)';
pauseMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
pauseMenu.style.color = 'white';
pauseMenu.style.padding = '20px';
pauseMenu.style.borderRadius = '10px';
pauseMenu.style.textAlign = 'center';
pauseMenu.style.zIndex = '1000';
pauseMenu.style.display = 'none';
pauseMenu.innerHTML = `
    <h2>Game Paused</h2>
    <p>Press ESC to resume</p>
    <button id="resume-button">Resume Game</button>
`;
document.getElementById('game-container').appendChild(pauseMenu);

// Pause/resume functionality
function togglePause() {
    gameState.paused = !gameState.paused;
    pauseMenu.style.display = gameState.paused ? 'block' : 'none';
    
    if (gameState.paused) {
        // Lock pointer when resuming
        document.exitPointerLock();
    } else {
        // Request pointer lock when resuming
        renderer.domElement.requestPointerLock();
    }
}

// Event listeners for pause menu
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        togglePause();
    }
});

document.getElementById('resume-button').addEventListener('click', () => {
    togglePause();
});

// Lighting
function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
    directionalLight.position.set(50, 100, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);
}

// Initialize game
function init() {
    // Create game objects
    player = new Player(camera, renderer);
    field = new Field(scene, world);
    football = new Football(scene, world, camera);
    
    setupLighting();
    
    // Hide loading screen
    loadingScreen.style.display = 'none';
    
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    // Note: Player class already sets up its own event listeners
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    player.handleResize();
}

// Check if receiver caught the ball
function checkCatch() {
    if (football.checkCatch(field.receiverBody) && !gameState.receiverCaught) {
        gameState.receiverCaught = true;
        gameState.score += 7; // Touchdown!
        scoreDisplay.innerHTML = `Score: ${gameState.score}`;
        console.log('Touchdown! Receiver caught the ball!');
        
        // Reset for next play
        setTimeout(() => {
            gameState.receiverCaught = false;
        }, 2000);
    }
}

// Game loop
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    
    // Skip updates if game is paused
    if (gameState.paused) {
        return;
    }
    
    const delta = Math.min(clock.getDelta(), 0.1);
    
    // Update physics
    world.step(1/60, delta);
    
    // Update football position
    football.update();
    
    // Update player
    player.update(delta);
    
    // Check if player is throwing
    const throwData = player.getThrowData();
    if (throwData) {
        football.throw(throwData.direction, throwData.power);
    }
    
    // Check if receiver caught the ball
    checkCatch();
    
    renderer.render(scene, camera);
}

// Start the game
init();
animate();
