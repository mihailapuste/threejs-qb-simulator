import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Field {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.field = null;
        this.fieldBody = null;
        this.receiver = null;
        this.receiverBody = null;
        this.receiverRunning = false;
        this.receiverSpeed = 4; // yards per second
        this.catchCount = 0; // Track number of catches
        this.init();
    }

    init() {
        // Create field mesh - NCAA field dimensions (120 yards x 53.3 yards)
        const fieldGeometry = new THREE.PlaneGeometry(120, 53.3);
        const fieldMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2E5A35,  // Darker field green
            roughness: 0.8,
            emissive: 0x112211,
            emissiveIntensity: 0.1
        });
        this.field = new THREE.Mesh(fieldGeometry, fieldMaterial);
        this.field.rotation.x = -Math.PI / 2;
        this.field.receiveShadow = true;
        this.scene.add(this.field);
        
        // Field physics
        this.fieldBody = new CANNON.Body({
            type: CANNON.Body.STATIC,
            shape: new CANNON.Plane()
        });
        this.fieldBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(this.fieldBody);
        
        // Add all field markings in the correct order
        this.addEndZones();
        this.addYardLines();
        this.addHashMarks();
        this.addGoalPosts();
        this.addReceiver();
    }

    addYardLines() {
        // Add yard lines every 5 yards (4 inches wide, white)
        for (let i = 0; i <= 100; i += 5) {
            // Only make 5-yard lines visible
            if (i % 5 === 0) {
                const lineGeometry = new THREE.BoxGeometry(0.1, 0.01, 53.3); // 4 inches wide (0.1 yards)
                const lineMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0xFFFFFF,
                    emissive: 0xFFFFFF,
                    emissiveIntensity: 0.2
                });
                const line = new THREE.Mesh(lineGeometry, lineMaterial);
                line.position.set(i - 50, 0.01, 0);
                this.scene.add(line);
            }
        }
        
        // Add yard numbers in NFL style (G, 10, 20, 30, 40, 50, 40, 30, 20, 10, G)
        // But upside down on one side to match the reference image
        const yardMarkers = [
            { position: -40, text: "10" }, // 10 yard line
            { position: -30, text: "20" }, // 20 yard line
            { position: -20, text: "30" }, // 30 yard line
            { position: -10, text: "40" }, // 40 yard line
            { position: 0, text: "50" },   // 50 yard line
            { position: 10, text: "40" },  // 40 yard line (other side)
            { position: 20, text: "30" },  // 30 yard line (other side)
            { position: 30, text: "20" },  // 20 yard line (other side)
            { position: 40, text: "10" }   // 10 yard line (other side)
        ];
        
        yardMarkers.forEach(marker => {
            // Create upside-down numbers for the top of the field (as seen in the reference image)
            const yardNumber = document.createElement('canvas');
            yardNumber.width = 128;
            yardNumber.height = 128;
            const context = yardNumber.getContext('2d');
            context.fillStyle = 'white';
            context.font = 'bold 96px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(marker.text, 64, 64);
            
            const numberTexture = new THREE.CanvasTexture(yardNumber);
            const numberMaterial = new THREE.MeshBasicMaterial({ 
                map: numberTexture,
                transparent: true,
                side: THREE.DoubleSide
            });
            
            // Numbers should be properly sized and positioned
            const numberGeometry = new THREE.PlaneGeometry(3, 3);
            
            // Top row of numbers (upside down in the reference image)
            const topNumberMesh = new THREE.Mesh(numberGeometry, numberMaterial);
            topNumberMesh.rotation.x = -Math.PI / 2;
            topNumberMesh.rotation.z = Math.PI; // Upside down
            topNumberMesh.position.set(marker.position, 0.02, -15);
            this.scene.add(topNumberMesh);
            
            // Bottom row of numbers (right side up)
            const bottomNumberMesh = new THREE.Mesh(numberGeometry, numberMaterial);
            bottomNumberMesh.rotation.x = -Math.PI / 2;
            bottomNumberMesh.position.set(marker.position, 0.02, 15);
            this.scene.add(bottomNumberMesh);
        });
    }
    
    addHashMarks() {
        // Add hash marks every yard - in reference image, there are many small hash marks
        for (let i = 0; i <= 100; i += 1) {
            // Create small hash marks on both sides of each yard line
            const hashGeometry = new THREE.BoxGeometry(0.1, 0.01, 0.5); // Smaller hash marks
            const hashMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
            
            // Top side hash marks (closer to top sideline)
            const topHash = new THREE.Mesh(hashGeometry, hashMaterial);
            topHash.position.set(i - 50, 0.01, -10); // Positioned to match reference
            this.scene.add(topHash);
            
            // Bottom side hash marks (closer to bottom sideline)
            const bottomHash = new THREE.Mesh(hashGeometry, hashMaterial);
            bottomHash.position.set(i - 50, 0.01, 10); // Positioned to match reference
            this.scene.add(bottomHash);
        }
    }
    
    addEndZones() {
        // Add end zones (10 yards deep at each end of the field)
        const endZoneGeometry = new THREE.PlaneGeometry(10, 53.3);
        
        // Dark end zones (almost black with a hint of color)
        const endZoneMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            roughness: 0.8,
            emissive: 0x111111,
            emissiveIntensity: 0.1
        });
        
        // Left end zone
        const leftEndZone = new THREE.Mesh(endZoneGeometry, endZoneMaterial);
        leftEndZone.rotation.x = -Math.PI / 2;
        leftEndZone.position.set(-55, 0.01, 0);
        this.scene.add(leftEndZone);
        
        // Right end zone
        const rightEndZone = new THREE.Mesh(endZoneGeometry, endZoneMaterial);
        rightEndZone.rotation.x = -Math.PI / 2;
        rightEndZone.position.set(55, 0.01, 0);
        this.scene.add(rightEndZone);
        
        // Add "FORZA" text in both end zones (rotated 90 degrees to match image)
        this.addEndZoneText("FORZA", -55, 0xFFFFFF, Math.PI/2);
        this.addEndZoneText("FORZA", 55, 0xFFFFFF, -Math.PI/2);
    }
    
    addEndZoneText(text, position, color, rotation = 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        context.fillStyle = '#' + color.toString(16).padStart(6, '0');
        context.font = 'bold 96px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 256, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ 
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const geometry = new THREE.PlaneGeometry(20, 5);
        const textMesh = new THREE.Mesh(geometry, material);
        textMesh.rotation.x = -Math.PI / 2;
        textMesh.rotation.z = rotation; // Apply rotation
        textMesh.position.set(position, 0.02, 0);
        this.scene.add(textMesh);
    }

    addReceiver() {
        // Create receiver - positioned at the 40 yard line on the right side near the hash
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0x0000FF }); // Blue jersey
        this.receiver = new THREE.Mesh(geometry, material);
        
        // Position at the 40 yard line (40 yards from the left end zone)
        // Near the hash mark (10 yards from center)
        this.receiver.position.set(40 - 50, 0.9, 10); // Convert to coordinate system (0 is midfield)
        this.receiver.castShadow = true;
        this.scene.add(this.receiver);
        
        // Receiver physics
        this.receiverBody = new CANNON.Body({
            mass: 0, // Static body until we start moving
            shape: new CANNON.Cylinder(0.3, 0.3, 1.8, 32),
            position: new CANNON.Vec3(40 - 50, 0.9, 10)
        });
        this.world.addBody(this.receiverBody);
        
        // Add receiver arms to catch the ball
        const armGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
        const armMaterial = new THREE.MeshStandardMaterial({ color: 0x0000FF });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.4, 0.2, 0);
        this.receiver.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.4, 0.2, 0);
        this.receiver.add(rightArm);
        
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
        this.receiver.add(jerseyMesh);
    }

    checkCatch(footballBody) {
        if (footballBody && this.receiverBody) {
            const distance = footballBody.position.distanceTo(this.receiverBody.position);
            if (distance < 0.5) { 
                // Highlight the receiver to indicate a catch
                if (this.receiver.material) {
                    this.receiver.material.emissive = new THREE.Color(0x00FF00);
                    this.receiver.material.emissiveIntensity = 0.5;
                    
                    // Reset emissive after 1 second
                    setTimeout(() => {
                        this.receiver.material.emissive = new THREE.Color(0x000000);
                        this.receiver.material.emissiveIntensity = 0;
                    }, 1000);
                }
                this.catchCount++; 
                console.log(`Catch made! Total catches: ${this.catchCount}`);
                return true;
            }
        }
        return false;
    }
    
    update(deltaTime) {
        // Update receiver position if running
        if (this.receiverRunning && this.receiver && this.receiverBody) {
            // Move receiver forward (in positive x direction) at receiverSpeed
            const moveDistance = this.receiverSpeed * deltaTime;
            
            // Update mesh position
            this.receiver.position.x += moveDistance;
            
            // Update physics body position
            this.receiverBody.position.x += moveDistance;
            
            // Stop the receiver if they reach the end zone
            if (this.receiver.position.x > 50) {
                this.receiverRunning = false;
                
                // Celebrate the touchdown
                if (this.receiver.material) {
                    this.receiver.material.emissive = new THREE.Color(0xFFFF00);
                    this.receiver.material.emissiveIntensity = 0.5;
                    
                    // Reset emissive after 2 seconds
                    setTimeout(() => {
                        this.receiver.material.emissive = new THREE.Color(0x000000);
                        this.receiver.material.emissiveIntensity = 0;
                    }, 2000);
                }
            }
        }
    }
    
    startReceiverRoute() {
        // Start the receiver running
        this.receiverRunning = true;
        
        // Make the receiver flash briefly to indicate they're starting
        if (this.receiver.material) {
            this.receiver.material.emissive = new THREE.Color(0xFFFFFF);
            this.receiver.material.emissiveIntensity = 0.5;
            
            // Reset emissive after 0.5 seconds
            setTimeout(() => {
                this.receiver.material.emissive = new THREE.Color(0x000000);
                this.receiver.material.emissiveIntensity = 0;
            }, 500);
        }
    }
    
    resetReceiver() {
        // Reset receiver to starting position
        if (this.receiver && this.receiverBody) {
            // Stop running
            this.receiverRunning = false;
            
            // Reset position to 40 yard line
            this.receiver.position.set(40 - 50, 0.9, 10);
            this.receiverBody.position.set(40 - 50, 0.9, 10);
            
            // Reset any visual effects
            if (this.receiver.material) {
                this.receiver.material.emissive = new THREE.Color(0x000000);
                this.receiver.material.emissiveIntensity = 0;
            }
        }
    }

    addGoalPosts() {
        // Add simple goal posts at each end of the field
        const postMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFFFFF,
            emissive: 0xFFFFFF,
            emissiveIntensity: 0.2
        });
        
        // Create left goal post (simple upright)
        const leftPostGeometry = new THREE.CylinderGeometry(0.1, 0.1, 10, 8);
        const leftPost = new THREE.Mesh(leftPostGeometry, postMaterial);
        leftPost.position.set(-55, 5, 0);
        this.scene.add(leftPost);
        
        // Create right goal post (simple upright)
        const rightPostGeometry = new THREE.CylinderGeometry(0.1, 0.1, 10, 8);
        const rightPost = new THREE.Mesh(rightPostGeometry, postMaterial);
        rightPost.position.set(55, 5, 0);
        this.scene.add(rightPost);
    }

}

export default Field;
