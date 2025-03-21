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

// Create crosshair
const crosshair = document.createElement('div');
crosshair.id = 'crosshair';
crosshair.style.position = 'absolute';
crosshair.style.top = '50%';
crosshair.style.left = '50%';
crosshair.style.transform = 'translate(-50%, -50%)';
crosshair.style.zIndex = '100';
crosshair.style.pointerEvents = 'none'; // Ensure it doesn't interfere with clicks

// Add CSS animation for the crosshair
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { opacity: 0.8; }
        50% { opacity: 1; }
        100% { opacity: 0.8; }
    }
    
    #crosshair-circle {
        animation: pulse 2s infinite ease-in-out;
        transition: all 0.2s ease-out;
    }
`;
document.head.appendChild(style);

// Create a circular crosshair
crosshair.innerHTML = `
    <div id="crosshair-circle" style="
        width: 40px;
        height: 40px;
        border: 2px solid white;
        border-radius: 50%;
        position: relative;
    ">
        <div id="crosshair-dot" style="
            position: absolute;
            width: 4px;
            height: 4px;
            background-color: white;
            border-radius: 50%;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        "></div>
    </div>
`;
document.getElementById('game-container').appendChild(crosshair);

// Create throw power indicator
const throwPowerIndicator = document.createElement('div');
throwPowerIndicator.id = 'throw-power-indicator';
throwPowerIndicator.style.position = 'absolute';
throwPowerIndicator.style.bottom = '50px';
throwPowerIndicator.style.left = '50%';
throwPowerIndicator.style.transform = 'translateX(-50%)';
throwPowerIndicator.style.width = '200px';
throwPowerIndicator.style.height = '20px';
throwPowerIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
throwPowerIndicator.style.borderRadius = '10px';
throwPowerIndicator.style.overflow = 'hidden';
throwPowerIndicator.style.zIndex = '100';
throwPowerIndicator.style.display = 'none'; // Hidden by default

const powerBar = document.createElement('div');
powerBar.id = 'power-bar';
powerBar.style.width = '0%';
powerBar.style.height = '100%';
powerBar.style.backgroundColor = 'red';
powerBar.style.transition = 'width 0.1s';
throwPowerIndicator.appendChild(powerBar);

document.getElementById('game-container').appendChild(throwPowerIndicator);

// Create controls info display
const controlsInfo = document.createElement('div');
controlsInfo.id = 'controls-info';
controlsInfo.style.position = 'absolute';
controlsInfo.style.bottom = '20px';
controlsInfo.style.left = '20px';
controlsInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
controlsInfo.style.color = 'white';
controlsInfo.style.padding = '10px';
controlsInfo.style.borderRadius = '5px';
controlsInfo.style.zIndex = '100';
controlsInfo.innerHTML = `
    <h3>Controls:</h3>
    <p>Mouse: Look around</p>
    <p>WASD/Arrow Keys: Move</p>
    <p>Spacebar: Throw (hold to charge)</p>
    <p>ESC: Pause game</p>
`;
document.getElementById('game-container').appendChild(controlsInfo);

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

// Pause/resume functionality
function togglePause() {
    gameState.paused = !gameState.paused;
    pauseMenu.style.display = gameState.paused ? 'block' : 'none';
    
    if (gameState.paused) {
        // Unlock pointer when pausing
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
    // Request pointer lock when clicking resume
    renderer.domElement.requestPointerLock();
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

// Helper function to get color based on throw power
function getColorForPower(power) {
    // Start with green, transition to yellow, then red as power increases
    if (power < 0.5) {
        // Green to yellow (0 to 0.5)
        const r = Math.floor(255 * (power * 2));
        const g = 255;
        const b = 0;
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        // Yellow to red (0.5 to 1.0)
        const r = 255;
        const g = Math.floor(255 * (1 - (power - 0.5) * 2));
        const b = 0;
        return `rgb(${r}, ${g}, ${b})`;
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
    
    // Update throw power indicator and crosshair
    if (player.isChargingThrow()) {
        // Show power indicator
        throwPowerIndicator.style.display = 'block';
        powerBar.style.width = `${player.getThrowPower() * 100}%`;
        
        // Change crosshair color based on throw power
        const power = player.getThrowPower();
        const color = getColorForPower(power);
        
        // Update crosshair color
        document.getElementById('crosshair-circle').style.borderColor = color;
        document.getElementById('crosshair-dot').style.backgroundColor = color;
        
        // Shrink the crosshair as power increases (more focused aim)
        const minSize = 20; // Minimum size at full power
        const maxSize = 40; // Maximum size at no power
        const size = maxSize - (power * (maxSize - minSize));
        
        document.getElementById('crosshair-circle').style.width = `${size}px`;
        document.getElementById('crosshair-circle').style.height = `${size}px`;
    } else {
        // Hide power indicator
        throwPowerIndicator.style.display = 'none';
        
        // Reset crosshair color and size
        document.getElementById('crosshair-circle').style.borderColor = 'white';
        document.getElementById('crosshair-dot').style.backgroundColor = 'white';
        document.getElementById('crosshair-circle').style.width = '40px';
        document.getElementById('crosshair-circle').style.height = '40px';
    }
    
    // Check if receiver caught the ball
    checkCatch();
    
    renderer.render(scene, camera);
}

// Start the game
init();
animate();
