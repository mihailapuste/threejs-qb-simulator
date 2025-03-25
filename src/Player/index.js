import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class Player {
    constructor(camera, renderer, world) {
        this.camera = camera;
        this.renderer = renderer;
        this.world = world; // Physics world
        this.controls = null;
        this.throwPower = 0;
        this.maxThrowPower = 100;
        this.throwChargeRate = 2;
        this.throwing = false;
        this.throwReleased = false;
        
        // Movement variables
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveSpeed = 1.5; // Reduced from 5.0 to make movement slower
        
        // Player model
        this.bodyGroup = null;
        this.playerModel = null;
        this.body = null; // Physics body
        
        // New football request flag
        this.requestNewFootball = false;
        
        this.init();
    }

    init() {
        // Create a group for the player body
        this.bodyGroup = new THREE.Group();
        
        // Get the scene from the camera
        const scene = this.camera.parent;
        if (!scene) {
            console.error("Camera is not added to a scene yet");
            return;
        }
        
        // Add the body group to the scene
        scene.add(this.bodyGroup);
        
        // Set up camera for first person view - positioned at face level and forward
        this.camera.position.set(0, 1.9, 0); // Eye level, moved forward
        
        // Load the player model
        this.loadPlayerModel();
        
        // Set up controls - using PointerLockControls
        this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
        
        // Add event listeners for keyboard controls
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Lock pointer on click
        this.renderer.domElement.addEventListener('click', () => {
            this.controls.lock();
        });
        
        // Create physics body
        this.createPhysicsBody();
    }
    
    loadPlayerModel() {
        const loader = new GLTFLoader();
        
        // Load the player GLB file
        loader.load(
            // Resource URL
            '/src/Player/components/quarterback.glb',
            
            // Called when the resource is loaded
            (gltf) => {
                // Get the model from the loaded GLTF
                this.playerModel = gltf.scene;
                
                // Scale the model to match the receiver (1.7)
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
                
                // Add the model to our body group
                this.bodyGroup.add(this.playerModel);
                
                // Position the model correctly
                this.playerModel.position.y = 0; // Adjust as needed to make feet touch ground
                
                // Update the body group position to match camera
                this.updateBodyPosition();
            },
            
            // Called while loading is progressing
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            
            // Called when loading has errors
            (error) => {
                console.error('An error happened loading the player model:', error);
            }
        );
    }
  
    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = true;
                break;
            case 'Space':
                // Start throw on spacebar press
                if (!this.throwing && this.controls.isLocked) {
                    this.startThrow();
                }
                break;
            case 'KeyQ':
                // Request a new football
                this.requestNewFootball = true;
                console.log("Q key pressed - requesting new football");
                break;
        }
    }
    
    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.moveRight = false;
                break;
            case 'Space':
                // End throw on spacebar release
                if (this.throwing) {
                    this.endThrow();
                }
                break;
        }
    }

    startThrow() {
        // Only start throw when controls are locked
        if (this.controls.isLocked) {
            this.throwing = true;
            this.throwPower = 0;
            this.throwReleased = false;
        }
    }

    updateThrowPower() {
        if (this.throwing && !this.throwReleased && this.throwPower < this.maxThrowPower) {
            this.throwPower += this.throwChargeRate;
        }
    }

    endThrow() {
        if (this.throwing) {
            this.throwReleased = true;
        }
    }

    getThrowData() {
        if (this.throwReleased) {
            this.throwing = false;
            this.throwReleased = false;
            
            // Get camera direction for throw
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            
            // Add slight upward angle
            direction.y += 0.2;
            direction.normalize();
            
            // Store the power before resetting
            const power = this.throwPower;
            
            // Reset power
            this.throwPower = 0;
            
            return { direction, power };
        }
        return null;
    }
    
    // New methods to expose throw state
    isChargingThrow() {
        return this.throwing && !this.throwReleased;
    }
    
    getThrowPower() {
        return this.throwPower / this.maxThrowPower; // Return normalized value between 0 and 1
    }

    getNewFootballRequest() {
        if (this.requestNewFootball) {
            console.log("Football request detected and being processed");
            this.requestNewFootball = false;
            return true;
        }
        return false;
    }

    update(deltaTime) {
        if (!this.controls.isLocked) {
            return;
        }
        
        // Handle throw charging
        if (this.throwing && !this.throwReleased) {
            this.throwPower = Math.min(this.throwPower + this.throwChargeRate, this.maxThrowPower);
        }
        
        // Handle movement
        this.velocity.x -= this.velocity.x * 10.0 * deltaTime;
        this.velocity.z -= this.velocity.z * 10.0 * deltaTime;
        
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();
        
        if (this.moveForward || this.moveBackward) {
            this.velocity.z -= this.direction.z * this.moveSpeed * deltaTime;
        }
        if (this.moveLeft || this.moveRight) {
            this.velocity.x -= this.direction.x * this.moveSpeed * deltaTime;
        }
        
        // Move the camera
        this.controls.moveRight(-this.velocity.x);
        this.controls.moveForward(-this.velocity.z);
        
        // Update the body position to follow the camera
        this.updateBodyPosition();
        
        // Update physics body position to match visual body
        if (this.body) {
            this.body.position.x = this.bodyGroup.position.x;
            this.body.position.y = this.bodyGroup.position.y + 0.9; // Center of mass is higher
            this.body.position.z = this.bodyGroup.position.z;
            
            // Convert THREE.js rotation to CANNON quaternion
            const quaternion = new CANNON.Quaternion();
            quaternion.setFromEuler(0, this.bodyGroup.rotation.y, 0);
            this.body.quaternion.copy(quaternion);
        }
    }
    
    updateBodyPosition() {
        if (this.bodyGroup && this.camera) {
            // Get the camera's position
            const cameraPosition = new THREE.Vector3();
            this.camera.getWorldPosition(cameraPosition);
            
            // Calculate position behind the camera (where the body should be)
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            cameraDirection.applyQuaternion(this.camera.quaternion);
            
            // Move the body position behind the camera by 0.5 units
            const bodyPosition = cameraPosition.clone();
            bodyPosition.sub(cameraDirection.multiplyScalar(1));
            
            // Update the body group position (keeping the y position unchanged)
            this.bodyGroup.position.x = bodyPosition.x;
            this.bodyGroup.position.z = bodyPosition.z;
            
            // Rotate the body to match the camera's direction
            const faceDirection = new THREE.Vector3(0, 0, -1);
            faceDirection.applyQuaternion(this.camera.quaternion);
            faceDirection.y = 0; // Keep rotation only in the xz plane
            faceDirection.normalize();
            
            // Set the body rotation to face the same direction as the camera
            if (faceDirection.length() > 0) {
                this.bodyGroup.rotation.y = Math.atan2(faceDirection.x, faceDirection.z);
            }
        }
    }

    createPhysicsBody() {
        // Create a physics body for the player
        const shape = new CANNON.Cylinder(0.3, 0.3, 1.8, 32); // Match the receiver's shape
        this.body = new CANNON.Body({
            mass: 80, // Player has mass (80kg is typical football player)
            position: new CANNON.Vec3(0, 0.9, 0), // Initial position with height
            shape: shape
        });
        
        // Add the physics body to the world
        this.world.addBody(this.body);
    }

    handleResize() {
        // No need to handle resize with PointerLockControls
    }
}

export default Player;
