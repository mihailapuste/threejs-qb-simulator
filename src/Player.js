import * as THREE from 'three';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js';

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
        this.powerBar = document.getElementById('power-bar');
        
        this.init();
    }

    init() {
        // Set up camera for first person view
        this.camera.position.set(0, 1.7, 0); // Eye level
        
        // Set up controls
        this.controls = new FirstPersonControls(this.camera, this.renderer.domElement);
        this.controls.movementSpeed = 5;
        this.controls.lookSpeed = 0.1;
        this.controls.lookVertical = true;
        this.controls.constrainVertical = true;
        this.controls.verticalMin = Math.PI / 4;
        this.controls.verticalMax = Math.PI / 2;
        
        // Add event listeners for throwing
        document.addEventListener('mousedown', this.startThrow.bind(this));
        document.addEventListener('mouseup', this.endThrow.bind(this));
        
        // Disable the default click behavior of FirstPersonControls
        this.renderer.domElement.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    startThrow(event) {
        // Only react to left mouse button
        if (event.button === 0) {
            this.throwing = true;
            this.throwPower = 0;
            this.throwReleased = false;
        }
    }

    updateThrowPower() {
        if (this.throwing && !this.throwReleased && this.throwPower < this.maxThrowPower) {
            this.throwPower += this.throwChargeRate;
            // Update power bar UI
            this.powerBar.style.width = `${this.throwPower}%`;
        }
    }

    endThrow(event) {
        // Only react to left mouse button
        if (event.button === 0 && this.throwing) {
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
            
            // Reset power bar
            this.throwPower = 0;
            this.powerBar.style.width = '0%';
            
            return { direction, power };
        }
        return null;
    }

    update(delta) {
        // Update controls
        this.controls.update(delta);
        
        // Update throw power
        this.updateThrowPower();
    }

    handleResize() {
        this.controls.handleResize();
    }
}

export default Player;
