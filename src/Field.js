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
        this.init();
    }

    init() {
        // Create field mesh
        const fieldGeometry = new THREE.PlaneGeometry(120, 53.3); // NFL field dimensions in yards
        const fieldMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x355E3B,  // Field green
            roughness: 0.8,
            emissive: 0x112211, // Slight emissive glow to make it more visible
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
        
        this.addYardLines();
        this.addEndZones();
        this.addReceiver();
    }

    addYardLines() {
        // Add yard lines
        for (let i = 0; i <= 100; i += 10) {
            const lineGeometry = new THREE.BoxGeometry(0.2, 0.01, 53.3);
            const lineMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xFFFFFF,
                emissive: 0xFFFFFF,
                emissiveIntensity: 0.2
            });
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            line.position.set(i - 50, 0.01, 0);
            this.scene.add(line);
        }
        
        // Add yard numbers in NFL style (G, 10, 20, 30, 40, 50, 40, 30, 20, 10, G)
        const yardMarkers = [
            { position: -50, text: "G" },  // Goal line
            { position: -40, text: "10" }, // 10 yard line
            { position: -30, text: "20" }, // 20 yard line
            { position: -20, text: "30" }, // 30 yard line
            { position: -10, text: "40" }, // 40 yard line
            { position: 0, text: "50" },   // 50 yard line
            { position: 10, text: "40" },  // 40 yard line (other side)
            { position: 20, text: "30" },  // 30 yard line (other side)
            { position: 30, text: "20" },  // 20 yard line (other side)
            { position: 40, text: "10" },  // 10 yard line (other side)
            { position: 50, text: "G" }    // Goal line (other side)
        ];
        
        yardMarkers.forEach(marker => {
            // Skip the 50 yard line if desired
            // if (marker.position === 0) return;
            
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
            
            const numberGeometry = new THREE.PlaneGeometry(3, 3);
            const numberMesh = new THREE.Mesh(numberGeometry, numberMaterial);
            
            // Position the number on the field
            numberMesh.rotation.x = -Math.PI / 2;
            numberMesh.position.set(marker.position, 0.02, 15); // On one side
            this.scene.add(numberMesh);
            
            // Add another on the opposite side
            const numberMesh2 = numberMesh.clone();
            numberMesh2.position.set(marker.position, 0.02, -15);
            numberMesh2.rotation.z = Math.PI; // Rotate 180 degrees so it's readable from the other side
            this.scene.add(numberMesh2);
        });
    }
    
    addEndZones() {
        // Add end zones (red and blue)
        const endZoneGeometry = new THREE.PlaneGeometry(10, 53.3);
        
        // Red end zone
        const redEndZoneMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xCC0000,
            roughness: 0.8,
            emissive: 0x330000,
            emissiveIntensity: 0.1
        });
        const redEndZone = new THREE.Mesh(endZoneGeometry, redEndZoneMaterial);
        redEndZone.rotation.x = -Math.PI / 2;
        redEndZone.position.set(-55, 0.01, 0);
        this.scene.add(redEndZone);
        
        // Blue end zone
        const blueEndZoneMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x0000CC,
            roughness: 0.8,
            emissive: 0x000033,
            emissiveIntensity: 0.1
        });
        const blueEndZone = new THREE.Mesh(endZoneGeometry, blueEndZoneMaterial);
        blueEndZone.rotation.x = -Math.PI / 2;
        blueEndZone.position.set(55, 0.01, 0);
        this.scene.add(blueEndZone);
    }

    addReceiver() {
        // Simple receiver representation
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 1.8, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0xFF0000 }); // Red jersey
        this.receiver = new THREE.Mesh(geometry, material);
        this.receiver.position.set(20, 0.9, 10); // To the right of the player
        this.receiver.castShadow = true;
        this.scene.add(this.receiver);
        
        // Receiver physics
        this.receiverBody = new CANNON.Body({
            mass: 0, // Static body
            shape: new CANNON.Cylinder(0.3, 0.3, 1.8, 32),
            position: new CANNON.Vec3(20, 0.9, 10)
        });
        this.world.addBody(this.receiverBody);
        
        // Add receiver arms to catch the ball
        const armGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
        const armMaterial = new THREE.MeshStandardMaterial({ color: 0xFF0000 });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.4, 0.2, 0);
        this.receiver.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.4, 0.2, 0);
        this.receiver.add(rightArm);
    }

    checkCatch(footballBody) {
        // This method is no longer used since the Football class handles catch detection
        // Keeping it for backward compatibility
        if (footballBody && this.receiverBody) {
            const distance = footballBody.position.distanceTo(this.receiverBody.position);
            if (distance < 1.5) {
                return true;
            }
        }
        return false;
    }
}

export default Field;
