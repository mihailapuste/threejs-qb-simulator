import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Player from './Player.js';
import Field from './Field.js';
import Football from './Football.js';

// Game state
const gameState = {
    receiverCaught: false,
    paused: false,
    score: 0,
    catches: 0
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

// Create catch counter display
const catchCounter = document.createElement('div');
catchCounter.id = 'catch-counter';
catchCounter.style.position = 'absolute';
catchCounter.style.top = '60px';
catchCounter.style.right = '20px';
catchCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
catchCounter.style.color = 'white';
catchCounter.style.padding = '10px';
catchCounter.style.borderRadius = '5px';
catchCounter.style.zIndex = '100';
catchCounter.style.fontSize = '24px';
catchCounter.style.fontWeight = 'bold';
catchCounter.innerHTML = 'Catches: 0';
document.getElementById('game-container').appendChild(catchCounter);

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
    <p>Q: Get new football</p>
    <p>E: Start receiver route</p>
    <p>R: Reset receiver</p>
    <p>T: Open route selection menu</p>
`;
document.getElementById('game-container').appendChild(controlsInfo);

// Create route menu
const routeMenu = document.createElement('div');
routeMenu.id = 'route-menu';
routeMenu.style.position = 'absolute';
routeMenu.style.top = '20px';
routeMenu.style.left = '20px';
routeMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
routeMenu.style.color = 'white';
routeMenu.style.padding = '15px';
routeMenu.style.borderRadius = '5px';
routeMenu.style.zIndex = '100';
routeMenu.style.minWidth = '200px';
routeMenu.style.display = 'none'; // Hidden by default
document.getElementById('game-container').appendChild(routeMenu);

// Create route display
const routeDisplay = document.createElement('div');
routeDisplay.id = 'route-display';
routeDisplay.style.position = 'absolute';
routeDisplay.style.top = '100px';
routeDisplay.style.right = '20px';
routeDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
routeDisplay.style.color = 'white';
routeDisplay.style.padding = '10px';
routeDisplay.style.borderRadius = '5px';
routeDisplay.style.zIndex = '100';
routeDisplay.style.fontSize = '18px';
routeDisplay.style.fontWeight = 'bold';
routeDisplay.innerHTML = 'Route: Seam';
document.getElementById('game-container').appendChild(routeDisplay);

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
scene.fog = new THREE.Fog(0x87CEEB, 100, 1000); // Color matches sky, starts at 100 units, ends at 1000 units

// Camera setup
const camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.1, 2000);

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

// Function to update route menu
function updateRouteMenu() {
    if (!field || !field.receiver) return;
    
    const routes = field.getReceiverRoutes();
    const currentRoute = field.getCurrentReceiverRoute();
    
    let menuHTML = `
        <h3>Route Selection</h3>
        <ul style="list-style-type: none; padding: 0; margin: 0;">
    `;
    
    routes.forEach(route => {
        const isSelected = route === currentRoute;
        const style = isSelected ? 
            'background-color: #3498db; color: white; font-weight: bold;' : 
            'background-color: #2c3e50;';
        
        menuHTML += `
            <li style="padding: 8px; margin: 5px 0; border-radius: 3px; cursor: pointer; ${style}" 
                onclick="selectRoute('${route}')">
                ${route.charAt(0).toUpperCase() + route.slice(1)}
            </li>
        `;
    });
    
    menuHTML += `
        </ul>
        <div style="margin-top: 10px; text-align: center;">
            <button style="padding: 8px 15px; background-color: #27ae60; border: none; color: white; border-radius: 3px; cursor: pointer;" 
                onclick="closeRouteMenu()">Close</button>
        </div>
    `;
    
    routeMenu.innerHTML = menuHTML;
}

// Route menu functions
function openRouteMenu() {
    updateRouteMenu();
    routeMenu.style.display = 'block';
    gameState.paused = true; // Pause the game while menu is open
}

function closeRouteMenu() {
    routeMenu.style.display = 'none';
    gameState.paused = false; // Resume the game
}

function selectRoute(routeName) {
    if (field) {
        field.startReceiverRoute(routeName);
        closeRouteMenu();
        routeDisplay.innerHTML = `Route: ${routeName.charAt(0).toUpperCase() + routeName.slice(1)}`;
    }
}

// Make these functions available globally
window.openRouteMenu = openRouteMenu;
window.closeRouteMenu = closeRouteMenu;
window.selectRoute = selectRoute;

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
    } else if (event.key === 'e' || event.key === 'E') {
        // Start receiver route on E key
        const currentRoute = field.startReceiverRoute();
        routeDisplay.innerHTML = `Route: ${currentRoute.charAt(0).toUpperCase() + currentRoute.slice(1)}`;
        console.log("Receiver running route");
    } else if (event.key === 'r' || event.key === 'R') {
        // Reset receiver on R key
        field.resetReceiver();
        console.log("Receiver reset");
    } else if (event.key === 't' || event.key === 'T') {
        // Open route selection menu on T key
        openRouteMenu();
        console.log("Route menu opened");
    }
});

document.getElementById('resume-button').addEventListener('click', () => {
    togglePause();
    // Request pointer lock when clicking resume
    renderer.domElement.requestPointerLock();
});

// Lighting
function setupLighting() {
    // Increased ambient light for better overall visibility
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.8);
    scene.add(ambientLight);
    
    // Main directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    directionalLight.position.set(50, 100, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);
    
    // Additional directional light from behind to highlight the field
    const backLight = new THREE.DirectionalLight(0xFFFFFF, 0.4);
    backLight.position.set(-50, 80, -100);
    scene.add(backLight);
    
    // Add a spotlight to illuminate the field ahead
    const spotLight = new THREE.SpotLight(0xFFFFFF, 0.6);
    spotLight.position.set(0, 50, -50);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.1;
    spotLight.decay = 1;
    spotLight.distance = 200;
    scene.add(spotLight);
}

// Initialize game
function init() {
    // Add camera to scene first
    scene.add(camera);
    
    // Create game objects
    player = new Player(camera, renderer);
    field = new Field(scene, world);
    football = new Football(scene, world, camera, field);
    
    setupLighting();
    
    // Hide loading screen
    loadingScreen.style.display = 'none';
    
    // Initialize route display with default route
    if (field && field.receiver) {
        const currentRoute = field.getCurrentReceiverRoute();
        if (currentRoute) {
            routeDisplay.innerHTML = `Route: ${currentRoute.charAt(0).toUpperCase() + currentRoute.slice(1)}`;
        }
    }
    
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
    
    // Update field elements (including receiver)
    field.update(delta);
    
    // Update catch counter display
    catchCounter.innerHTML = `Catches: ${field.getReceiverCatchCount()}`;
    
    // Check if player is throwing
    const throwData = player.getThrowData();
    if (throwData) {
        football.throw(throwData.direction, throwData.power);
    }
    
    // Check if player has requested a new football with Q key
    if (player.getNewFootballRequest()) {
        football.forceNewFootball();
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
    
    renderer.render(scene, camera);
}

// Start the game
init();
animate();
