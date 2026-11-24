import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { chargePower } from '../game/throwMath.js';
import { stepVelocity } from '../game/movement.js';
import { prepareCharacter } from '../render/materials.js';

class Player {
    constructor(camera, renderer, world, options = {}) {
        this.camera = camera;
        this.renderer = renderer;
        this.world = world;
        this.loader = options.loader || null;
        this.modelUrl = options.modelUrl || '';
        this.onLoadProgress = options.onLoadProgress || null;
        this.flatMaterials = options.flat === true;
        this.inputEnabled = false;
        this.controls = null;
        this.touchMode = options.touch === true;
        this.touchRight = 0;
        this.touchForward = 0;
        this.touchMoveActive = false;
        this.chargeTime = 0;
        this.throwing = false;
        this.throwReleased = false;
        this.fullChargePlayed = false;
        this._lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
        this._bodyQuat = new CANNON.Quaternion();

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.velocity = { right: 0, forward: 0 };

        this.bodyGroup = null;
        this.playerModel = null;
        this.body = null;
        this.requestNewFootball = false;
        this.attackEnabled = true;
        this.allowLook = true;
        this.suspended = false;
        this.cruise = 5.4;

        this.init();
    }

    init() {
        this.bodyGroup = new THREE.Group();
        const scene = this.camera.parent;
        if (!scene) {
            console.error('Camera is not added to a scene yet');
            return;
        }
        scene.add(this.bodyGroup);

        this.camera.rotation.order = 'YXZ';
        this.placePocket(-5, 0.35);

        this.loadPlayerModel();
        this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
        this.controls.minPolarAngle = 0.28;
        this.controls.maxPolarAngle = Math.PI - 0.22;
        if (this.touchMode) this.controls.pointerSpeed = 1.15;

        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));

        const canvas = this.renderer.domElement;
        if (!this.touchMode) {
            canvas.addEventListener('click', () => {
                if (!this.inputEnabled || !this.allowLook) return;
                this.controls.lock();
            });
            canvas.addEventListener('mousedown', (event) => {
                if (!this.inputEnabled || !this.attackEnabled || event.button !== 0) return;
                if (!this.controls.isLocked) return;
                event.preventDefault();
                this.startThrow();
            });
        }
        window.addEventListener('mouseup', (event) => {
            if (event.button !== 0) return;
            if (this.throwing && !this.touchMode) this.endThrow();
        });
        canvas.addEventListener('contextmenu', (event) => event.preventDefault());

        this.createPhysicsBody();
    }

    setInputEnabled(enabled) {
        this.inputEnabled = enabled === true;
    }

    loadPlayerModel() {
        if (!this.loader || !this.modelUrl) return;

        this.loader.load(
            this.modelUrl,
            (gltf) => {
                this.playerModel = gltf.scene;
                this.playerModel.scale.set(1.7, 1.7, 1.7);
                // The body sits behind the camera. Skip its shadow; it is most of the vertex cost.
                prepareCharacter(this.playerModel, { shadows: false, flat: this.flatMaterials });
                // First person: the body sits inside the camera and only costs vertices.
                this.playerModel.visible = false;
                this.bodyGroup.add(this.playerModel);
                this.playerModel.position.y = 0;
                this.updateBodyPosition();
            },
            (xhr) => {
                if (this.onLoadProgress) this.onLoadProgress(xhr);
            },
            (error) => {
                console.error('An error happened loading the player model:', error);
            }
        );
    }

    onKeyDown(event) {
        if (!this.inputEnabled) return;
        if (event.code === 'Space') event.preventDefault();
        if (event.repeat && event.code === 'Space') return;
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
                if (!this.throwing && this._controlActive()) this.startThrow();
                break;
            case 'KeyQ':
                this.requestNewFootball = true;
                break;
            default:
                break;
        }
    }

    onKeyUp(event) {
        if (!this.inputEnabled) return;
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
                if (this.throwing) this.endThrow();
                break;
            default:
                break;
        }
    }

    _controlActive() {
        return this.touchMode || (this.controls && this.controls.isLocked);
    }

    lookBy(deltaX, deltaY) {
        if (!this.allowLook || !this.touchMode || !this.camera || !this.controls) return;
        const euler = this._lookEuler;
        euler.setFromQuaternion(this.camera.quaternion);
        const speed = 0.0062 * this.controls.pointerSpeed;
        euler.y -= deltaX * speed;
        euler.x -= deltaY * speed;
        const minPitch = Math.PI / 2 - this.controls.maxPolarAngle;
        const maxPitch = Math.PI / 2 - this.controls.minPolarAngle;
        euler.x = Math.max(minPitch, Math.min(maxPitch, euler.x));
        this.camera.quaternion.setFromEuler(euler);
    }

    setTouchMove(right, forward) {
        this.touchMoveActive = true;
        this.touchRight = right;
        this.touchForward = forward;
    }

    clearTouchMove() {
        this.touchMoveActive = false;
        this.touchRight = 0;
        this.touchForward = 0;
    }

    requestNewBall() {
        this.requestNewFootball = true;
    }

    startThrow() {
        if (!this.attackEnabled || !this._controlActive() || this.throwing) return;
        this.throwing = true;
        this.chargeTime = 0;
        this.throwReleased = false;
        this.fullChargePlayed = false;
    }

    endThrow() {
        if (this.throwing) this.throwReleased = true;
    }

    cancelThrow() {
        this.throwing = false;
        this.throwReleased = false;
        this.chargeTime = 0;
        this.fullChargePlayed = false;
    }

    consumeFullChargeTick() {
        if (!this.throwing || this.fullChargePlayed) return false;
        if (chargePower(this.chargeTime) < 0.98) return false;
        this.fullChargePlayed = true;
        return true;
    }

    getThrowData() {
        if (!this.throwReleased) return null;
        this.throwing = false;
        this.throwReleased = false;
        const power = chargePower(this.chargeTime);
        this.chargeTime = 0;
        this.fullChargePlayed = false;
        return { power };
    }

    isChargingThrow() {
        return this.throwing && !this.throwReleased;
    }

    getThrowPower() {
        return chargePower(this.chargeTime);
    }

    getWish() {
        if (this.touchMode && this.touchMoveActive) {
            return { right: this.touchRight, forward: this.touchForward };
        }
        return {
            right: Number(this.moveRight) - Number(this.moveLeft),
            forward: Number(this.moveForward) - Number(this.moveBackward)
        };
    }

    setRunControl({ attack = true, look = true, suspended = false, cruise = 5.4 } = {}) {
        this.attackEnabled = attack;
        this.allowLook = look;
        this.suspended = suspended;
        this.cruise = cruise;
        if (!attack) this.cancelThrow();
    }

    placePocket(x, z) {
        this.camera.position.set(x, 1.7, z);
        this.camera.rotation.order = 'YXZ';
        this.camera.lookAt(x + 22, 1.25, z + 4);
        this.updateBodyPosition();
    }

    getNewFootballRequest() {
        if (!this.requestNewFootball) return false;
        this.requestNewFootball = false;
        return true;
    }

    update(deltaTime) {
        if (this.suspended || !this.inputEnabled || !this._controlActive()) return;

        if (this.throwing && !this.throwReleased) this.chargeTime += deltaTime;

        let wishRight = 0;
        let wishForward = 0;
        if (this.touchMode && this.touchMoveActive) {
            wishRight = this.touchRight;
            wishForward = this.touchForward;
        } else if (!this.touchMode) {
            wishRight = Number(this.moveRight) - Number(this.moveLeft);
            wishForward = Number(this.moveForward) - Number(this.moveBackward);
        }
        this.velocity = stepVelocity({
            velocity: this.velocity,
            wishRight,
            wishForward,
            dt: deltaTime,
            maxSpeed: this.cruise,
            accel: this.cruise * 8
        });
        this.controls.moveRight(this.velocity.right * deltaTime);
        this.controls.moveForward(this.velocity.forward * deltaTime);

        this.updateBodyPosition();
        if (this.body) {
            this.body.position.x = this.bodyGroup.position.x;
            this.body.position.y = this.bodyGroup.position.y + 0.9;
            this.body.position.z = this.bodyGroup.position.z;
            this._bodyQuat.setFromEuler(0, this.bodyGroup.rotation.y, 0);
            this.body.quaternion.copy(this._bodyQuat);
        }
    }

    updateBodyPosition() {
        if (!this.bodyGroup || !this.camera) return;
        const cameraPosition = this.camera.position;
        const forwardX = -Math.sin(this._yaw());
        const forwardZ = -Math.cos(this._yaw());
        this.bodyGroup.position.x = cameraPosition.x - forwardX * 0.85;
        this.bodyGroup.position.z = cameraPosition.z - forwardZ * 0.85;
        this.bodyGroup.rotation.y = Math.atan2(forwardX, forwardZ);
    }

    _yaw() {
        this._lookEuler.setFromQuaternion(this.camera.quaternion);
        return this._lookEuler.y;
    }

    createPhysicsBody() {
        const shape = new CANNON.Cylinder(0.3, 0.3, 1.8, 8);
        this.body = new CANNON.Body({
            mass: 80,
            position: new CANNON.Vec3(-7, 0.9, 0),
            shape
        });
        this.body.linearDamping = 0.9;
        this.world.addBody(this.body);
    }

    handleResize() {}
}

export default Player;
