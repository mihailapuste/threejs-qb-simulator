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
            // Move receiver forward (in positive x direction) at speed
            const moveDistance = this.speed * deltaTime;
            
            // Update mesh position
            this.mesh.position.x += moveDistance;
            
            // Update physics body position
            this.body.position.x += moveDistance;
            
            // Stop the receiver if they reach the end zone
            if (this.mesh.position.x > 50) {
                this.running = false;
                
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
        }
    }
    
    checkCatch(footballBody) {
        if (footballBody && this.body) {
            const distance = footballBody.position.distanceTo(this.body.position);
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
    
    startRoute() {
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
    }
    
    reset() {
        // Reset receiver to starting position
        if (this.mesh && this.body) {
            // Stop running
            this.running = false;
            
            // Reset position to 40 yard line
            this.mesh.position.set(40 - 50, 0.9, 10);
            this.body.position.set(40 - 50, 0.9, 10);
            
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
}

export default Receiver;
