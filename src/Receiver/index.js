import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class Receiver {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.mesh = null;
        this.body = null;
        this.running = false;
        this.speed = 4; // yards per second
        this.catchCount = 0;
        this.currentRoute = 'seam'; // Default route
        this.routeStep = 0; // Current step in the route
        this.routeTarget = null; // Target position for current route step
        this.playerModel = null; // To store the GLB model
        
        // Define available routes
        this.routes = {
            'seam': [
                { x: 8, z: 10 }, 
                { x: 30, z: 0 }   
            ],
            'out': [
                { x: 6, z: 10 }, // 6 yards up
                { x: 6, z: 26.65 } // Out to the sideline
            ],
            'slant': [
                { x: 3, z: 10 }, // 3 yards up
                { x: 7, z: 0 }  // Harsh 40 degree cut inwards
            ]
        };
        
        this.init();
    }

    init() {
        // Create a group to hold the player model and any additional elements
        this.mesh = new THREE.Group();
        
        // Position at the 50 yard line (midfield)
        // Near the hash mark (10 yards from center)
        this.mesh.position.set(0, 0, 10); // 0 is midfield
        this.scene.add(this.mesh);
        
        // Load the player GLB model
        this.loadPlayerModel();
        
        // Receiver physics
        this.body = new CANNON.Body({
            mass: 0, // Static body until we start moving
            shape: new CANNON.Cylinder(0.3, 0.3, 1.8, 32),
            position: new CANNON.Vec3(0, 0.9, 10)
        });
        this.world.addBody(this.body);
    }
    
    loadPlayerModel() {
        const loader = new GLTFLoader();
        
        // Load the player GLB file
        loader.load(
            // Resource URL
            '/src/Receiver/components/american_football_player.glb',
            
            // Called when the resource is loaded
            (gltf) => {
                // Get the model from the loaded GLTF
                this.playerModel = gltf.scene;
                
                // Scale the model to be 2x bigger (1.0 instead of 0.5)
                this.playerModel.scale.set(1.7, 1.7, 1.7);
                
                // Adjust material properties if needed
                this.playerModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Make sure materials are available for highlighting
                        if (!child.material.emissive) {
                            child.material = new THREE.MeshStandardMaterial({
                                color: child.material.color || 0x0000FF,
                                map: child.material.map || null
                            });
                        }
                    }
                });
                
                // Add the model to our mesh group
                this.mesh.add(this.playerModel);
                
                // Position the model correctly
                this.playerModel.position.y = 0; // Adjust as needed to make feet touch ground
            },
            
            // Called while loading is progressing
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            
            // Called when loading has errors
            (error) => {
                console.error('An error happened loading the player model:', error);
                
                // Fallback to a simple player if model fails to load
                this.createSimplePlayer();
            }
        );
    }
    
    createSimplePlayer() {
        // Fallback to a simple player if the GLB fails to load
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0x0000FF }); // Blue jersey
        const playerMesh = new THREE.Mesh(geometry, material);
        playerMesh.position.y = 0.75; // Half height to place bottom at origin
        playerMesh.castShadow = true;
        this.mesh.add(playerMesh);
        
        // Add simple arms
        const armGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
        const armMaterial = new THREE.MeshStandardMaterial({ color: 0x0000FF });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.4, 0.2, 0);
        playerMesh.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.4, 0.2, 0);
        playerMesh.add(rightArm);
    }
    
    update(deltaTime) {
        // Update receiver position if running
        if (this.running && this.mesh && this.body) {
            // If we don't have a current target, set it to the first step of the route
            if (!this.routeTarget && this.routes[this.currentRoute] && this.routeStep < this.routes[this.currentRoute].length) {
                this.routeTarget = this.routes[this.currentRoute][this.routeStep];
            }
            
            // If we have a target, move towards it
            if (this.routeTarget) {
                // Calculate direction to target
                const targetX = this.routeTarget.x;
                const targetZ = this.routeTarget.z;
                const dirX = targetX - this.mesh.position.x;
                const dirZ = targetZ - this.mesh.position.z;
                
                // Normalize direction
                const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
                
                // If we're close enough to the target, move to the next step
                if (length < 0.5) {
                    this.routeStep++;
                    if (this.routeStep < this.routes[this.currentRoute].length) {
                        this.routeTarget = this.routes[this.currentRoute][this.routeStep];
                    } else {
                        // End of route, celebrate if in end zone
                        if (this.mesh.position.x > 45) {
                            this.celebrate();
                        }
                        this.routeTarget = null;
                        this.running = false;
                    }
                } else {
                    // Move towards target
                    const moveDistance = this.speed * deltaTime;
                    const moveX = (dirX / length) * moveDistance;
                    const moveZ = (dirZ / length) * moveDistance;
                    
                    // Update mesh position
                    this.mesh.position.x += moveX;
                    this.mesh.position.z += moveZ;
                    
                    // Update physics body position
                    this.body.position.x = this.mesh.position.x;
                    this.body.position.y = this.mesh.position.y + 0.9; // Adjust for height
                    this.body.position.z = this.mesh.position.z;
                    
                    // Make receiver face the direction of movement
                    if (length > 0.1) {
                        this.mesh.rotation.y = Math.atan2(moveX, moveZ);
                    }
                }
            }
        }
    }
    
    celebrate() {
        // Celebrate the touchdown
        if (this.playerModel) {
            this.playerModel.traverse((child) => {
                if (child.isMesh && child.material && child.material.emissive) {
                    child.material.emissive.set(0xFFFF00);
                    child.material.emissiveIntensity = 0.5;
                    
                    // Reset emissive after 2 seconds
                    setTimeout(() => {
                        child.material.emissive.set(0x000000);
                        child.material.emissiveIntensity = 0;
                    }, 2000);
                }
            });
        } else if (this.mesh.children[0] && this.mesh.children[0].material) {
            this.mesh.children[0].material.emissive = new THREE.Color(0xFFFF00);
            this.mesh.children[0].material.emissiveIntensity = 0.5;
            
            // Reset emissive after 2 seconds
            setTimeout(() => {
                this.mesh.children[0].material.emissive = new THREE.Color(0x000000);
                this.mesh.children[0].material.emissiveIntensity = 0;
            }, 2000);
        }
    }
    
    checkCatch(footballBody) {
        console.log("Checking for catch...");
        if (footballBody && this.body) {
            const distance = footballBody.position.distanceTo(this.body.position);
            console.log(`Distance to football: ${distance}`);
            if (distance < 0.5) { // 0.5 meters catch radius
                // Highlight the receiver to indicate a catch
                if (this.playerModel) {
                    this.playerModel.traverse((child) => {
                        if (child.isMesh && child.material && child.material.emissive) {
                            child.material.emissive.set(0x00FF00);
                            child.material.emissiveIntensity = 0.5;
                            
                            // Reset emissive after 1 second
                            setTimeout(() => {
                                child.material.emissive.set(0x000000);
                                child.material.emissiveIntensity = 0;
                            }, 1000);
                        }
                    });
                } else if (this.mesh.children[0] && this.mesh.children[0].material) {
                    this.mesh.children[0].material.emissive = new THREE.Color(0x00FF00);
                    this.mesh.children[0].material.emissiveIntensity = 0.5;
                    
                    // Reset emissive after 1 second
                    setTimeout(() => {
                        this.mesh.children[0].material.emissive = new THREE.Color(0x000000);
                        this.mesh.children[0].material.emissiveIntensity = 0;
                    }, 1000);
                }
                this.catchCount++;
                console.log(`Catch made! Total catches: ${this.catchCount}`);
                return true;
            }
        }
        return false;
    }
    
    startRoute(routeName = null) {
        // Set the route if provided
        if (routeName && this.routes[routeName]) {
            this.currentRoute = routeName;
        }
        
        // Reset route step and target
        this.routeStep = 0;
        this.routeTarget = null;
        
        // Start the receiver running
        this.running = true;
        
        // Make the receiver flash briefly to indicate they're starting
        if (this.playerModel) {
            this.playerModel.traverse((child) => {
                if (child.isMesh && child.material && child.material.emissive) {
                    child.material.emissive.set(0xFFFFFF);
                    child.material.emissiveIntensity = 0.5;
                    
                    // Reset emissive after 0.5 seconds
                    setTimeout(() => {
                        child.material.emissive.set(0x000000);
                        child.material.emissiveIntensity = 0;
                    }, 500);
                }
            });
        } else if (this.mesh.children[0] && this.mesh.children[0].material) {
            this.mesh.children[0].material.emissive = new THREE.Color(0xFFFFFF);
            this.mesh.children[0].material.emissiveIntensity = 0.5;
            
            // Reset emissive after 0.5 seconds
            setTimeout(() => {
                this.mesh.children[0].material.emissive = new THREE.Color(0x000000);
                this.mesh.children[0].material.emissiveIntensity = 0;
            }, 500);
        }
        
        return this.currentRoute;
    }
    
    reset() {
        // Reset receiver to starting position
        if (this.mesh && this.body) {
            // Stop running
            this.running = false;
            
            // Reset route step and target
            this.routeStep = 0;
            this.routeTarget = null;
            
            // Reset position to 50 yard line
            this.mesh.position.set(0, 0, 10);
            this.body.position.set(0, 0.9, 10);
            
            // Reset rotation
            this.mesh.rotation.set(0, 0, 0);
            
            // Reset any visual effects
            if (this.playerModel) {
                this.playerModel.traverse((child) => {
                    if (child.isMesh && child.material && child.material.emissive) {
                        child.material.emissive.set(0x000000);
                        child.material.emissiveIntensity = 0;
                    }
                });
            } else if (this.mesh.children[0] && this.mesh.children[0].material) {
                this.mesh.children[0].material.emissive = new THREE.Color(0x000000);
                this.mesh.children[0].material.emissiveIntensity = 0;
            }
        }
    }
    
    getCatchCount() {
        return this.catchCount;
    }
    
    getAvailableRoutes() {
        return Object.keys(this.routes);
    }
    
    getCurrentRoute() {
        return this.currentRoute;
    }
}

export default Receiver;
