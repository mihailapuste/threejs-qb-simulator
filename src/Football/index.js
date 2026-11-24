import * as THREE from 'three';
import { BALL_RADIUS } from '../game/constants.js';
import { scoreThrow, sweptCatch } from '../game/scoring.js';
import {
    planThrow,
    positionAt,
    sampleArc,
    selectAimPoint,
    timeToHeight,
    velocityAt
} from '../game/throwMath.js';

const REACH_COLOR = 0xDCF763;
const SHORT_COLOR = 0xFF5A36;
const TRAIL_POINTS = 18;

class Football {
    constructor(scene, world, camera, field, hooks = {}) {
        this.scene = scene;
        this.world = world;
        this.camera = camera;
        this.field = field;
        this.hooks = hooks;
        this.handMesh = null;
        this.balls = [];
        this.chargingPower = null;
        this.respawnAt = 0;
        this.previewHoldUntil = 0;
        this.readout = null;
        this._raycaster = new THREE.Raycaster();
        this._ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this._groundHit = new THREE.Vector3();
        this._forward = new THREE.Vector3();
        this._zAxis = new THREE.Vector3(0, 0, 1);
        this._quat = new THREE.Quaternion();
        this._spin = new THREE.Quaternion();
        this._right = new THREE.Vector3();
        this._up = new THREE.Vector3();
        this._look = new THREE.Vector3();
        this._handWorld = new THREE.Vector3();
        this.prototype = this.createFootballMesh();
        this.arc = this.createArc();
        this.aimDot = this.createAimDot();
        this.landRing = this.createLandRing();
        this.putBallInHand();
    }

    createFootballMesh() {
        const radius = 0.11;
        const length = 0.22;
        const geometry = new THREE.SphereGeometry(radius, 24, 16);
        const positions = geometry.attributes.position;
        const colors = new THREE.Float32BufferAttribute(positions.count * 3, 3);
        const baseColor = new THREE.Color(0x8B4513);
        const tipColor = new THREE.Color(0x5D2906);

        for (let i = 0; i < positions.count; i += 1) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            const newZ = z * 2.05;
            const pointiness = 0.42;
            const scaleFactor = 1 - pointiness * (Math.abs(newZ) / length) ** 2;
            positions.setX(i, x * scaleFactor);
            positions.setY(i, y * scaleFactor);
            positions.setZ(i, newZ);
            const tipFactor = (Math.abs(newZ) / length) ** 1.5;
            const color = new THREE.Color().lerpColors(baseColor, tipColor, tipFactor);
            colors.setXYZ(i, color.r, color.g, color.b);
        }
        geometry.setAttribute('color', colors);
        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.72,
            metalness: 0.04
        }));
        mesh.castShadow = true;
        this.addLaces(mesh, radius);
        return mesh;
    }

    addLaces(footballMesh, radiusY) {
        const lacesMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            roughness: 0.35,
            metalness: 0.02
        });
        const laceLength = 0.16;
        const points = [];
        const segments = 12;
        for (let i = 0; i <= segments; i += 1) {
            const t = (i / segments) * 2 - 1;
            const z = t * (laceLength / 2);
            const y = radiusY * 0.92 + 0.02 * (1 - t * t);
            points.push(new THREE.Vector3(0, y, z));
        }
        const curve = new THREE.CatmullRomCurve3(points);
        const lace = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, 0.012, 6, false), lacesMaterial);
        footballMesh.add(lace);

        const stitchMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
        for (let i = 0; i < 6; i += 1) {
            const t = (i + 1) / 7;
            const point = curve.getPointAt(t);
            const stitch = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, 0.014), stitchMaterial);
            stitch.position.copy(point);
            footballMesh.add(stitch);
        }
    }

    createArc() {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(32 * 3), 3));
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
            color: REACH_COLOR,
            transparent: true,
            opacity: 0.9
        }));
        line.frustumCulled = false;
        line.visible = false;
        this.scene.add(line);
        return line;
    }

    createAimDot() {
        const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 10, 8),
            new THREE.MeshBasicMaterial({ color: REACH_COLOR })
        );
        dot.visible = false;
        this.scene.add(dot);
        return dot;
    }

    createLandRing() {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.45, 0.7, 28),
            new THREE.MeshBasicMaterial({ color: REACH_COLOR, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.visible = false;
        this.scene.add(ring);
        return ring;
    }

    putBallInHand() {
        if (this.handMesh) return;
        const mesh = this.prototype.clone();
        mesh.rotation.set(-0.45, 0.35, 0.2);
        this.camera.add(mesh);
        this.handMesh = mesh;
        this.layoutHand();
    }

    layoutHand() {
        if (!this.handMesh) return;
        // Portrait puts the throw button in the bottom-right corner, so the
        // ball sits lower-center instead of covering it.
        if (this.camera.aspect < 0.9) this.handMesh.position.set(0, -0.62, -0.78);
        else this.handMesh.position.set(0.24, -0.28, -0.46);
    }

    handOrigin() {
        this.layoutHand();
        this.camera.updateMatrixWorld(true);
        this.handMesh.getWorldPosition(this._handWorld);
        return { x: this._handWorld.x, y: this._handWorld.y, z: this._handWorld.z };
    }

    basis() {
        this.camera.updateMatrixWorld();
        this.camera.getWorldDirection(this._look);
        this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
        this._up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
        return {
            camera: {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            },
            right: { x: this._right.x, y: this._right.y, z: this._right.z },
            up: { x: this._up.x, y: this._up.y, z: this._up.z },
            forward: { x: this._look.x, y: this._look.y, z: this._look.z }
        };
    }

    aimHits() {
        this._raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const hits = [];
        const aimMesh = this.field && this.field.receiver && this.field.receiver.aimMesh;
        if (aimMesh) {
            aimMesh.updateWorldMatrix(true, false);
            const found = this._raycaster.intersectObject(aimMesh, false);
            if (found.length > 0) {
                const hit = found[0];
                hits.push({
                    x: hit.point.x,
                    y: hit.point.y,
                    z: hit.point.z,
                    distance: hit.distance,
                    kind: 'receiver'
                });
            }
        }
        const direction = this._raycaster.ray.direction;
        if (direction.y < -0.001 && this._raycaster.ray.intersectPlane(this._ground, this._groundHit)) {
            const dx = this._groundHit.x - this.camera.position.x;
            const dy = this._groundHit.y - this.camera.position.y;
            const dz = this._groundHit.z - this.camera.position.z;
            const distance = Math.hypot(dx, dy, dz);
            if (dx * direction.x + dy * direction.y + dz * direction.z > 0) {
                hits.push({
                    x: this._groundHit.x,
                    y: this._groundHit.y,
                    z: this._groundHit.z,
                    distance,
                    kind: 'ground'
                });
            }
        }
        return hits;
    }

    previewPlan(power) {
        const frame = this.basis();
        const aim = selectAimPoint({
            camera: frame.camera,
            look: frame.forward,
            hits: this.aimHits(),
            power
        });
        const plan = planThrow({
            camera: frame.camera,
            basis: { right: frame.right, up: frame.up, forward: frame.forward },
            aim,
            power,
            origin: this.handOrigin()
        });
        this.readout = { reachable: plan.reachable, time: plan.time, kind: aim.kind };
        return plan;
    }

    showPreview(plan) {
        const arc = sampleArc(plan.origin, plan.velocity, { steps: 28 });
        const positions = this.arc.geometry.attributes.position;
        const count = Math.min(arc.points.length, positions.count);
        for (let i = 0; i < count; i += 1) {
            const point = arc.points[Math.floor((i / (count - 1)) * (arc.points.length - 1))];
            positions.setXYZ(i, point.x, point.y, point.z);
        }
        this.arc.geometry.setDrawRange(0, count);
        positions.needsUpdate = true;
        this.arc.geometry.computeBoundingSphere();
        const color = plan.reachable ? REACH_COLOR : SHORT_COLOR;
        this.arc.material.color.setHex(color);
        this.arc.visible = true;

        this.aimDot.position.set(plan.aim.x, plan.aim.y, plan.aim.z);
        this.aimDot.material.color.setHex(color);
        this.aimDot.visible = plan.aim.kind !== 'ground';

        if (arc.landing) {
            this.landRing.position.set(arc.landing.x, 0.04, arc.landing.z);
            this.landRing.material.color.setHex(color);
            this.landRing.visible = true;
        } else {
            this.landRing.visible = false;
        }
    }

    hidePreview() {
        this.arc.visible = false;
        this.aimDot.visible = false;
        this.landRing.visible = false;
    }

    setCharging(power) {
        this.chargingPower = power;
    }

    getReadout() {
        return this.readout;
    }

    throw(power) {
        if (!this.handMesh) return null;
        const plan = this.previewPlan(power);
        const mesh = this.handMesh;
        this.camera.remove(mesh);
        mesh.position.set(plan.origin.x, plan.origin.y, plan.origin.z);
        mesh.rotation.set(0, 0, 0);
        this.scene.add(mesh);
        this.handMesh = null;

        const trailGeometry = new THREE.BufferGeometry();
        trailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
        const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({
            color: 0xFFF4D6,
            transparent: true,
            opacity: 0.7
        }));
        trail.frustumCulled = false;
        trail.visible = false;
        this.scene.add(trail);

        const now = performance.now();
        this.balls.push({
            mesh,
            trail,
            trailCount: 0,
            origin: plan.origin,
            velocity: plan.velocity,
            speed: plan.speed,
            born: now,
            bounced: false,
            bounces: 0,
            caught: false,
            frozen: false,
            resolved: false,
            removeAt: 0,
            last: { ...plan.origin }
        });
        this.respawnAt = now + 260;
        this.previewHoldUntil = now + 650;
        this.showPreview(plan);
        return plan;
    }

    orient(mesh, velocity, time, rate) {
        const vel = velocityAt(velocity, time);
        const speed = Math.hypot(vel.x, vel.y, vel.z);
        if (speed < 0.05) return;
        this._forward.set(vel.x / speed, vel.y / speed, vel.z / speed);
        if (this._forward.dot(this._zAxis) < -0.999) this._forward.x += 0.01;
        this._quat.setFromUnitVectors(this._zAxis, this._forward);
        this._spin.setFromAxisAngle(this._zAxis, time * rate);
        mesh.quaternion.copy(this._quat).multiply(this._spin);
    }

    pushTrail(ball, point) {
        const positions = ball.trail.geometry.attributes.position;
        const last = Math.max(0, ball.trailCount - 1);
        if (ball.trailCount > 0) {
            const px = positions.getX(Math.min(last, TRAIL_POINTS - 1));
            const py = positions.getY(Math.min(last, TRAIL_POINTS - 1));
            const pz = positions.getZ(Math.min(last, TRAIL_POINTS - 1));
            if (Math.hypot(point.x - px, point.y - py, point.z - pz) < 0.25) return;
        }
        if (ball.trailCount < TRAIL_POINTS) {
            positions.setXYZ(ball.trailCount, point.x, point.y, point.z);
            ball.trailCount += 1;
        } else {
            for (let i = 0; i < TRAIL_POINTS - 1; i += 1) {
                positions.setXYZ(i, positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1));
            }
            positions.setXYZ(TRAIL_POINTS - 1, point.x, point.y, point.z);
        }
        ball.trail.geometry.setDrawRange(0, Math.max(2, ball.trailCount));
        positions.needsUpdate = true;
        ball.trail.visible = ball.trailCount > 1;
    }

    secureCatch(ball, spot, airDistance) {
        ball.caught = true;
        ball.frozen = true;
        ball.resolved = true;
        ball.mesh.position.set(spot.x, spot.y, spot.z);
        const receiver = this.field && this.field.receiver;
        if (receiver) receiver.mesh.attach(ball.mesh);
        ball.removeAt = performance.now() + 1600;
        const scored = scoreThrow({
            caught: true,
            horizontal: spot.horizontal,
            airDistance,
            receiverX: spot.receiverX
        });
        if (this.hooks.onResult) this.hooks.onResult(scored);
    }

    resolveMiss(ball) {
        if (ball.resolved) return;
        ball.resolved = true;
        const scored = scoreThrow({ caught: false });
        if (this.hooks.onResult) this.hooks.onResult(scored);
    }

    advanceFlight(ball, now) {
        const elapsed = (now - ball.born) / 1000;
        const landingTime = timeToHeight(ball.origin.y, ball.velocity.y, BALL_RADIUS);
        const landed = landingTime != null && elapsed >= landingTime;
        const flightTime = landed ? landingTime : elapsed;
        const pos = positionAt(ball.origin, ball.velocity, flightTime);
        if (landed) pos.y = BALL_RADIUS;

        const receiver = this.field && this.field.receiver;
        if (receiver && !ball.caught) {
            const attempt = sweptCatch({
                from: ball.last,
                to: pos,
                receiver: { x: receiver.mesh.position.x, z: receiver.mesh.position.z }
            });
            if (attempt.caught) {
                const airDistance = Math.hypot(pos.x - ball.origin.x, pos.z - ball.origin.z);
                receiver.noteCatch();
                this.secureCatch(ball, {
                    x: pos.x,
                    y: Math.max(pos.y, 1.1),
                    z: pos.z,
                    horizontal: attempt.horizontal,
                    receiverX: receiver.mesh.position.x
                }, airDistance);
                return;
            }
        }

        if (landed) {
            const incoming = velocityAt(ball.velocity, landingTime);
            ball.bounced = true;
            ball.bounces = 1;
            ball.origin = { x: pos.x, y: BALL_RADIUS, z: pos.z };
            ball.velocity = {
                x: incoming.x * 0.62,
                y: Math.abs(incoming.y) * 0.34,
                z: incoming.z * 0.62
            };
            ball.born = now;
            ball.mesh.position.set(pos.x, BALL_RADIUS, pos.z);
            this.resolveMiss(ball);
            return;
        }

        ball.last = pos;
        ball.mesh.position.set(pos.x, pos.y, pos.z);
        this.orient(ball.mesh, ball.velocity, elapsed, 13 + ball.speed * 0.25);
        this.pushTrail(ball, pos);
    }

    advanceBounce(ball, now) {
        const elapsed = (now - ball.born) / 1000;
        const landingTime = timeToHeight(ball.origin.y, ball.velocity.y, BALL_RADIUS);
        const speed = Math.hypot(ball.velocity.x, ball.velocity.y, ball.velocity.z);
        if (landingTime != null && elapsed >= landingTime) {
            const spot = positionAt(ball.origin, ball.velocity, landingTime);
            const incoming = velocityAt(ball.velocity, landingTime);
            ball.bounces += 1;
            if (ball.bounces > 3 || (Math.abs(incoming.y) < 1.4 && speed < 4)) {
                ball.frozen = true;
                ball.mesh.position.set(spot.x, BALL_RADIUS, spot.z);
                ball.removeAt = now + 3500;
                return;
            }
            ball.origin = { x: spot.x, y: BALL_RADIUS, z: spot.z };
            ball.velocity = {
                x: incoming.x * 0.62,
                y: Math.abs(incoming.y) * 0.34,
                z: incoming.z * 0.62
            };
            ball.born = now;
            ball.mesh.position.set(spot.x, BALL_RADIUS, spot.z);
            return;
        }
        const pos = positionAt(ball.origin, ball.velocity, elapsed);
        ball.mesh.position.set(pos.x, Math.max(BALL_RADIUS, pos.y), pos.z);
        this.orient(ball.mesh, ball.velocity, elapsed, 8);
    }

    retireBalls(now) {
        for (let i = this.balls.length - 1; i >= 0; i -= 1) {
            const ball = this.balls[i];
            if (!ball.removeAt || now < ball.removeAt) continue;
            if (ball.mesh.parent) ball.mesh.parent.remove(ball.mesh);
            this.scene.remove(ball.trail);
            ball.trail.geometry.dispose();
            ball.trail.material.dispose();
            this.balls.splice(i, 1);
        }
    }

    update() {
        const now = performance.now();
        this.layoutHand();
        if (this.chargingPower != null && this.handMesh) {
            this.showPreview(this.previewPlan(this.chargingPower));
        } else if (now >= this.previewHoldUntil) {
            this.hidePreview();
            this.readout = null;
        }

        for (let i = 0; i < this.balls.length; i += 1) {
            const ball = this.balls[i];
            if (ball.frozen) continue;
            if (ball.bounced) this.advanceBounce(ball, now);
            else this.advanceFlight(ball, now);
        }
        this.retireBalls(now);

        if (!this.handMesh && now >= this.respawnAt) this.putBallInHand();
    }
}

export default Football;
