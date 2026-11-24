import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { prepareCharacter } from '../render/materials.js';

class Receiver {
    constructor(scene, world, options = {}) {
        this.scene = scene;
        this.world = world;
        this.loader = options.loader || null;
        this.modelUrl = options.modelUrl || '';
        this.onLoadProgress = options.onLoadProgress || null;
        this.flatMaterials = options.flat === true;
        this.castShadows = options.shadows !== false;
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

        // Cheap stand-in for the crosshair. Raycasting the full player mesh is too heavy.
        this.aimMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.7, 0.7, 2.05, 10),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this.aimMesh.position.y = 1.05;
        this.aimMesh.visible = false;
        this.mesh.add(this.aimMesh);

        const blob = new THREE.Mesh(
            new THREE.CircleGeometry(0.62, 20),
            new THREE.MeshBasicMaterial({ color: 0x061208, transparent: true, opacity: 0.4, depthWrite: false })
        );
        blob.rotation.x = -Math.PI / 2;
        blob.position.y = 0.025;
        this.mesh.add(blob);
        
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
        if (!this.loader || !this.modelUrl) {
            console.error('Receiver model loader is not configured');
            this.createSimplePlayer();
            return;
        }

        // Load the player GLB file
        this.loader.load(
            this.modelUrl,
            
            // Called when the resource is loaded
            (gltf) => {
                // Get the model from the loaded GLTF
                this.playerModel = gltf.scene;
                
                // Scale the model to be 2x bigger (1.0 instead of 0.5)
                this.playerModel.scale.set(1.7, 1.7, 1.7);
                prepareCharacter(this.playerModel, {
                    shadows: this.castShadows,
                    flat: this.flatMaterials
                });
                
                // Add the model to our mesh group
                this.mesh.add(this.playerModel);
                
                // Position the model correctly
                this.playerModel.position.y = 0; // Adjust as needed to make feet touch ground
            },
            
            // Called while loading is progressing
            (xhr) => {
                if (this.onLoadProgress) this.onLoadProgress(xhr);
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
    
    _flash(hex, intensity, milliseconds) {
        const apply = (material) => {
            if (!material || !material.emissive) return;
            material.emissive.set(hex);
            material.emissiveIntensity = intensity;
            window.setTimeout(() => {
                material.emissive.set(0x000000);
                material.emissiveIntensity = 0;
            }, milliseconds);
        };
        if (this.playerModel) {
            this.playerModel.traverse((child) => {
                if (child.isMesh) apply(child.material);
            });
        } else if (this.mesh.children[0] && this.mesh.children[0].material) {
            apply(this.mesh.children[0].material);
        }
    }

    noteCatch() {
        this.catchCount += 1;
        this._flash(0x66FF88, 0.65, 700);
    }

    checkCatch(footballBody) {
        if (!footballBody || !this.body) return false;
        const distance = footballBody.position.distanceTo(this.body.position);
        if (distance < 1.2) {
            this.noteCatch();
            return true;
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
