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
            roughness: 0.8
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
        this.addReceiver();
    }

    addYardLines() {
        // Add yard lines
        for (let i = 0; i <= 100; i += 10) {
            const lineGeometry = new THREE.BoxGeometry(0.2, 0.01, 53.3);
            const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            line.position.set(i - 50, 0.01, 0);
            this.scene.add(line);
        }
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
