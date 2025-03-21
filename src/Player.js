import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

class Player {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
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
        this.moveSpeed = 5.0;
        
        this.init();
    }

    init() {
        // Set up camera for first person view
        this.camera.position.set(0, 1.7, 0); // Eye level
        
        // Set up controls - using PointerLockControls instead of FirstPersonControls
        this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
        
        // Add event listeners for keyboard controls
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Lock pointer on click
        this.renderer.domElement.addEventListener('click', () => {
            this.controls.lock();
        });
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

    update(delta) {
        // Only update movement when controls are locked
        if (this.controls.isLocked) {
            // Calculate velocity based on key presses
            this.velocity.x = 0;
            this.velocity.z = 0;
            
            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize();
            
            // Move in the direction the camera is facing
            if (this.moveForward || this.moveBackward) {
                this.velocity.z = this.direction.z * this.moveSpeed * delta;
            }
            if (this.moveLeft || this.moveRight) {
                this.velocity.x = this.direction.x * this.moveSpeed * delta;
            }
            
            // Apply movement
            this.controls.moveRight(this.velocity.x);
            this.controls.moveForward(this.velocity.z);
        }
        
        // Update throw power
        this.updateThrowPower();
    }

    handleResize() {
        // No need to handle resize with PointerLockControls
    }
}

export default Player;
