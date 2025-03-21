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
        
        // Body parts
        this.bodyGroup = null;
        
        this.init();
    }

    init() {
        // Set up camera for first person view
        this.camera.position.set(0, 1.7, 0); // Eye level
        
        // Set up controls - using PointerLockControls instead of FirstPersonControls
        this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
        
        // Create player body
        this.createPlayerBody();
        
        // Add event listeners for keyboard controls
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Lock pointer on click
        this.renderer.domElement.addEventListener('click', () => {
            this.controls.lock();
        });
    }
    
    createPlayerBody() {
        // Get the scene from the camera
        const scene = this.camera.parent;
        if (!scene) {
            console.error("Camera is not added to a scene yet");
            return;
        }
        
        // Create a group for the player body
        this.bodyGroup = new THREE.Group();
        
        // Create torso (orange jersey)
        const torsoGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.7, 16);
        const torsoMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFF5500, // Orange color for jersey
            transparent: false
        });
        const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
        torso.position.y = 0.9; // Position at chest height
        torso.rotation.x = Math.PI / 12; // Slight forward tilt
        this.bodyGroup.add(torso);
        
        // Add jersey number (white "1")
        const jerseyNumberGeometry = new THREE.PlaneGeometry(0.15, 0.2);
        const jerseyNumberMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const jerseyNumber = new THREE.Mesh(jerseyNumberGeometry, jerseyNumberMaterial);
        jerseyNumber.position.set(0, 1.0, 0.21); // Center on chest
        jerseyNumber.rotation.x = Math.PI / 12; // Match torso tilt
        this.bodyGroup.add(jerseyNumber);
        
        // Add lightning bolt logo (yellow)
        const logoGeometry = new THREE.PlaneGeometry(0.1, 0.15);
        const logoMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFFF00,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const logo = new THREE.Mesh(logoGeometry, logoMaterial);
        logo.position.set(0.1, 1.0, 0.22); // Right side of chest
        logo.rotation.x = Math.PI / 12; // Match torso tilt
        this.bodyGroup.add(logo);
        
        // Create arms (orange jersey)
        const armMaterial = new THREE.MeshLambertMaterial({ color: 0xFF5500 }); // Orange
        
        // Left arm
        const leftArmGeometry = new THREE.CylinderGeometry(0.08, 0.06, 0.6, 16);
        const leftArm = new THREE.Mesh(leftArmGeometry, armMaterial);
        leftArm.position.set(-0.3, 0.9, 0);
        leftArm.rotation.z = Math.PI / 6; // Angle the arm outward
        this.bodyGroup.add(leftArm);
        
        // Right arm
        const rightArmGeometry = new THREE.CylinderGeometry(0.08, 0.06, 0.6, 16);
        const rightArm = new THREE.Mesh(rightArmGeometry, armMaterial);
        rightArm.position.set(0.3, 0.9, 0);
        rightArm.rotation.z = -Math.PI / 6; // Angle the arm outward
        this.bodyGroup.add(rightArm);
        
        // Add gloves (black)
        const gloveMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
        
        // Left glove
        const leftGloveGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.15);
        const leftGlove = new THREE.Mesh(leftGloveGeometry, gloveMaterial);
        leftGlove.position.set(-0.5, 0.7, 0);
        this.bodyGroup.add(leftGlove);
        
        // Right glove
        const rightGloveGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.15);
        const rightGlove = new THREE.Mesh(rightGloveGeometry, gloveMaterial);
        rightGlove.position.set(0.5, 0.7, 0);
        this.bodyGroup.add(rightGlove);
        
        // Create legs (white/gray pants)
        const legMaterial = new THREE.MeshLambertMaterial({ color: 0xCCCCCC });
        
        // Left leg
        const leftLegGeometry = new THREE.CylinderGeometry(0.12, 0.1, 0.9, 16);
        const leftLeg = new THREE.Mesh(leftLegGeometry, legMaterial);
        leftLeg.position.set(-0.15, 0.45, 0);
        this.bodyGroup.add(leftLeg);
        
        // Right leg
        const rightLegGeometry = new THREE.CylinderGeometry(0.12, 0.1, 0.9, 16);
        const rightLeg = new THREE.Mesh(rightLegGeometry, legMaterial);
        rightLeg.position.set(0.15, 0.45, 0);
        this.bodyGroup.add(rightLeg);
        
        // Add feet (black cleats)
        const footMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
        
        // Left foot
        const leftFootGeometry = new THREE.BoxGeometry(0.15, 0.1, 0.3);
        const leftFoot = new THREE.Mesh(leftFootGeometry, footMaterial);
        leftFoot.position.set(-0.15, 0, 0.1);
        this.bodyGroup.add(leftFoot);
        
        // Right foot
        const rightFootGeometry = new THREE.BoxGeometry(0.15, 0.1, 0.3);
        const rightFoot = new THREE.Mesh(rightFootGeometry, footMaterial);
        rightFoot.position.set(0.15, 0, 0.1);
        this.bodyGroup.add(rightFoot);
        
        // Add the body to the scene
        scene.add(this.bodyGroup);
        
        // Set initial position
        const cameraPosition = new THREE.Vector3();
        this.camera.getWorldPosition(cameraPosition);
        this.bodyGroup.position.x = cameraPosition.x;
        this.bodyGroup.position.z = cameraPosition.z;
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
            
            // Update body position to match camera
            if (this.bodyGroup) {
                const cameraPosition = new THREE.Vector3();
                this.camera.getWorldPosition(cameraPosition);
                this.bodyGroup.position.x = cameraPosition.x;
                this.bodyGroup.position.z = cameraPosition.z;
                
                // Update body rotation to match camera direction
                const cameraDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDirection);
                this.bodyGroup.rotation.y = Math.atan2(cameraDirection.x, cameraDirection.z);
            }
        }
        
        // Update throw power
        this.updateThrowPower();
    }

    handleResize() {
        // No need to handle resize with PointerLockControls
    }
}

export default Player;
