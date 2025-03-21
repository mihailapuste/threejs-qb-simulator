import * as THREE from 'three';
import * as CANNON from 'cannon-es';

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
        
        // Define available routes
        this.routes = {
            'seam': [
                { x: 50, z: 10 } // Straight up the field
            ],
            'out': [
                { x: (40 - 50) + 6, z: 10 }, // 6 yards up
                { x: (40 - 50) + 6, z: 26.65 } // Out to the sideline
            ],
            'slant': [
                { x: (40 - 50) + 3, z: 10 }, // 3 yards up
                { x: 50, z: 0 } // 40° angle towards the middle
            ]
        };
        
        this.init();
    }

    init() {
        // Create receiver - positioned at the 40 yard line on the right side near the hash
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0x0000FF }); // Blue jersey
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Position at the 40 yard line (40 yards from the left end zone)
        // Near the hash mark (10 yards from center)
        this.mesh.position.set(40 - 50, 0.9, 10); // Convert to coordinate system (0 is midfield)
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
        
        // Receiver physics
        this.body = new CANNON.Body({
            mass: 0, // Static body until we start moving
            shape: new CANNON.Cylinder(0.3, 0.3, 1.8, 32),
            position: new CANNON.Vec3(40 - 50, 0.9, 10)
        });
        this.world.addBody(this.body);
        
        // Add receiver arms to catch the ball
        const armGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
        const armMaterial = new THREE.MeshStandardMaterial({ color: 0x0000FF });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.4, 0.2, 0);
        this.mesh.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.4, 0.2, 0);
        this.mesh.add(rightArm);
        
        // Add jersey number
        const jerseyCanvas = document.createElement('canvas');
        jerseyCanvas.width = 64;
        jerseyCanvas.height = 64;
        const context = jerseyCanvas.getContext('2d');
        context.fillStyle = 'white';
        context.font = 'bold 48px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('88', 32, 32);
        
        const jerseyTexture = new THREE.CanvasTexture(jerseyCanvas);
        const jerseyMaterial = new THREE.MeshBasicMaterial({
            map: jerseyTexture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const jerseyNumber = new THREE.PlaneGeometry(0.4, 0.4);
        const jerseyMesh = new THREE.Mesh(jerseyNumber, jerseyMaterial);
        jerseyMesh.position.set(0, 0.2, 0.31);
        this.mesh.add(jerseyMesh);
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
                    this.body.position.x += moveX;
                    this.body.position.z += moveZ;
                    
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
        if (this.mesh.material) {
            this.mesh.material.emissive = new THREE.Color(0xFFFF00);
            this.mesh.material.emissiveIntensity = 0.5;
            
            // Reset emissive after 2 seconds
            setTimeout(() => {
                this.mesh.material.emissive = new THREE.Color(0x000000);
                this.mesh.material.emissiveIntensity = 0;
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
                if (this.mesh.material) {
                    this.mesh.material.emissive = new THREE.Color(0x00FF00);
                    this.mesh.material.emissiveIntensity = 0.5;
                    
                    // Reset emissive after 1 second
                    setTimeout(() => {
                        this.mesh.material.emissive = new THREE.Color(0x000000);
                        this.mesh.material.emissiveIntensity = 0;
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
        if (this.mesh.material) {
            this.mesh.material.emissive = new THREE.Color(0xFFFFFF);
            this.mesh.material.emissiveIntensity = 0.5;
            
            // Reset emissive after 0.5 seconds
            setTimeout(() => {
                this.mesh.material.emissive = new THREE.Color(0x000000);
                this.mesh.material.emissiveIntensity = 0;
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
            
            // Reset position to 40 yard line
            this.mesh.position.set(40 - 50, 0.9, 10);
            this.body.position.set(40 - 50, 0.9, 10);
            
            // Reset rotation
            this.mesh.rotation.set(0, 0, 0);
            
            // Reset any visual effects
            if (this.mesh.material) {
                this.mesh.material.emissive = new THREE.Color(0x000000);
                this.mesh.material.emissiveIntensity = 0;
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
