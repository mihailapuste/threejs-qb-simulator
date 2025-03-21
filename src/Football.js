import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Football {
    constructor(scene, world, camera) {
        this.scene = scene;
        this.world = world;
        this.camera = camera;
        this.mesh = null;
        this.body = null;
        this.thrownBalls = [];
        this.init();
    }

    init() {
        // Create football mesh - use ellipsoid shape for American football
        const radiusX = 0.08; // narrower on the sides
        const radiusY = 0.12; // taller in the middle
        const radiusZ = 0.2;  // longer front to back
        
        // Create the football shape
        const footballGeometry = new THREE.SphereGeometry(1, 32, 16);
        footballGeometry.scale(radiusX, radiusY, radiusZ);
        
        // Create the material with a football texture
        const footballMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,  // Brown
            roughness: 0.7
        });
        
        this.mesh = new THREE.Mesh(footballGeometry, footballMaterial);
        this.mesh.castShadow = true;
        
        // Add laces to the football
        this.addLaces(this.mesh, radiusY);
        
        // Position the football in hands
        this.positionInHands();
    }

    addLaces(footballMesh, radiusY) {
        // Create laces
        const lacesGeometry = new THREE.BoxGeometry(0.02, 0.01, 0.1);
        const lacesMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
        const laces = new THREE.Mesh(lacesGeometry, lacesMaterial);
        
        // Position laces on top of the football
        laces.position.set(0, radiusY * 0.8, 0);
        footballMesh.add(laces);
    }

    positionInHands() {
        // Position the football at the bottom of the screen as if being held
        const handPosition = new THREE.Vector3(0.3, -0.4, -0.5);
        
        // Convert to world position
        this.mesh.position.copy(handPosition);
        this.mesh.rotation.set(0, Math.PI / 4, 0); // Rotate the ball to show laces
        
        // Update the mesh position relative to the camera
        this.camera.add(this.mesh);
    }

    update() {
        // Update all thrown footballs
        if (this.thrownBalls.length > 0) {
            this.thrownBalls.forEach(ball => {
                ball.mesh.position.copy(ball.body.position);
                ball.mesh.quaternion.copy(ball.body.quaternion);
            });
        }
        
        // Clean up old footballs
        this.cleanupOldFootballs();
    }

    throw(direction, power) {
        // Create a clone of the football for throwing
        const worldPosition = new THREE.Vector3();
        this.mesh.getWorldPosition(worldPosition);
        
        const worldQuaternion = new THREE.Quaternion();
        this.mesh.getWorldQuaternion(worldQuaternion);
        
        // Clone the football mesh
        const thrownFootball = this.mesh.clone();
        this.scene.add(thrownFootball);
        
        // Set position and rotation in world space
        thrownFootball.position.copy(worldPosition);
        thrownFootball.quaternion.copy(worldQuaternion);
        
        // Create a new physics body for the thrown football
        const radiusX = 0.08;
        const radiusY = 0.12;
        const radiusZ = 0.2;
        const physicsRadius = (radiusX + radiusY + radiusZ) / 3;
        
        const thrownBody = new CANNON.Body({
            mass: 0.43, // Football mass in kg
            shape: new CANNON.Sphere(physicsRadius),
            material: new CANNON.Material({ restitution: 0.7 }),
            linearDamping: 0.1,
            angularDamping: 0.1
        });
        
        thrownBody.position.copy(worldPosition);
        thrownBody.quaternion.copy(worldQuaternion);
        this.world.addBody(thrownBody);
        
        // Apply force to throw the football
        const throwForce = 20 * (power / 100); // Increased force for better throws
        thrownBody.velocity.set(
            direction.x * throwForce,
            direction.y * throwForce,
            direction.z * throwForce
        );
        
        // Add some spin to the ball
        thrownBody.angularVelocity.set(
            -direction.z * 10,
            0,
            direction.x * 10
        );
        
        // Add the thrown football to the list of thrown balls
        this.thrownBalls.push({
            mesh: thrownFootball,
            body: thrownBody,
            timeThrownAt: Date.now(),
            caught: false
        });
        
        // Keep only the last 10 thrown footballs to manage memory
        if (this.thrownBalls.length > 10) {
            const oldestBall = this.thrownBalls.shift();
            this.scene.remove(oldestBall.mesh);
            this.world.removeBody(oldestBall.body);
        }
    }
    
    // Check if any thrown football is caught by the receiver
    checkCatch(receiverBody) {
        if (!this.thrownBalls || this.thrownBalls.length === 0) {
            return false;
        }
        
        for (let i = 0; i < this.thrownBalls.length; i++) {
            const ball = this.thrownBalls[i];
            if (!ball.caught) {
                const distance = ball.body.position.distanceTo(receiverBody.position);
                if (distance < 1.5) {
                    ball.caught = true;
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // Clean up old footballs that have been on the ground for a while
    cleanupOldFootballs() {
        if (!this.thrownBalls || this.thrownBalls.length === 0) {
            return;
        }
        
        const now = Date.now();
        const ballsToRemove = [];
        
        // Find balls that have been on the ground for more than 10 seconds
        this.thrownBalls.forEach((ball, index) => {
            if (ball.body.position.y < 0.2 && now - ball.timeThrownAt > 10000) {
                ballsToRemove.push(index);
            }
        });
        
        // Remove the balls from the scene and physics world
        for (let i = ballsToRemove.length - 1; i >= 0; i--) {
            const index = ballsToRemove[i];
            const ball = this.thrownBalls[index];
            
            this.scene.remove(ball.mesh);
            this.world.removeBody(ball.body);
            this.thrownBalls.splice(index, 1);
        }
    }
}

export default Football;
