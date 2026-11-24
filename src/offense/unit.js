import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LINEMEN, QB_OFFSET, RECEIVER_COLORS, isRun, worldPath } from '../game/plays.js';

const SPEED = 7.3;
const ADJUST = 2.15;

function paintedBox(width, height, depth, x, y, z, color) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const paint = new THREE.Color(color);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < geometry.attributes.position.count; i += 1) {
        colors[i * 3] = paint.r;
        colors[i * 3 + 1] = paint.g;
        colors[i * 3 + 2] = paint.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.translate(x, y, z);
    return geometry;
}

function playerGeometry() {
    const parts = [
        paintedBox(0.2, 0.78, 0.2, -0.12, 0.39, 0, '#3a3f48'),
        paintedBox(0.2, 0.78, 0.2, 0.12, 0.39, 0, '#3a3f48'),
        paintedBox(0.52, 0.58, 0.28, 0, 1.05, 0, '#f4f4f4'),
        paintedBox(0.16, 0.42, 0.16, -0.36, 1.12, 0.08, '#e7b89a'),
        paintedBox(0.16, 0.42, 0.16, 0.36, 1.12, 0.08, '#e7b89a'),
        paintedBox(0.32, 0.28, 0.32, 0, 1.52, 0, '#d9dde4')
    ];
    const geometry = mergeGeometries(parts, false);
    geometry.computeVertexNormals();
    return geometry;
}

function ribbonGeometry(points) {
    const geometry = new THREE.BufferGeometry();
    if (!points || points.length < 2) {
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
        geometry.setIndex([0, 1, 2]);
        geometry.setDrawRange(0, 0);
        return geometry;
    }
    const positions = [];
    const indices = [];
    const width = 0.32;
    for (let i = 0; i < points.length; i += 1) {
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
        let dx = next.x - prev.x;
        let dz = next.z - prev.z;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len;
        dz /= len;
        positions.push(points[i].x - dz * width, 0.06, points[i].z + dx * width);
        positions.push(points[i].x + dz * width, 0.06, points[i].z - dx * width);
        if (i < points.length - 1) {
            const base = i * 2;
            indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        }
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
}

export class Offense {
    constructor(scene, { shadows = true } = {}) {
        this.scene = scene;
        this.los = 0;
        this.play = null;
        this.mode = 'pre';
        this.phase = 0;
        this.catchCount = 0;
        this.qbX = 0;
        this.runners = [];
        this.line = LINEMEN.map((man) => ({ ...man, x: 0, z: man.z }));
        this.rb = { x: -5.6, z: -1.7, route: [], step: 0, hop: 0, homeX: -5.6, homeZ: -1.7 };
        this.dummy = new THREE.Object3D();
        this.dummy.rotation.order = 'YXZ';
        this.geometry = playerGeometry();
        this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 });
        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, 11);
        this.mesh.castShadow = shadows;
        this.mesh.receiveShadow = false;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(this.mesh);
        this.mesh.count = 11;

        this.aimMeshes = [];
        for (let i = 0; i < 5; i += 1) {
            const group = new THREE.Group();
            const aim = new THREE.Mesh(
                new THREE.CylinderGeometry(0.55, 0.55, 1.9, 8),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            aim.position.y = 0.95;
            aim.visible = false;
            group.add(aim);
            this.scene.add(group);
            this.aimMeshes.push(aim);
            if (i < 4) {
                const color = new THREE.Color(RECEIVER_COLORS[i]);
                const ribbon = new THREE.Mesh(
                    ribbonGeometry([]),
                    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
                );
                ribbon.frustumCulled = false;
                this.scene.add(ribbon);
                this.runners.push({
                    index: i,
                    group,
                    ribbon,
                    x: 0,
                    z: 0,
                    alignX: 0,
                    alignZ: 0,
                    route: [],
                    step: 0,
                    hop: 0,
                    tint: color
                });
            } else {
                this.rb.group = group;
            }
        }
        this.rbBall = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 10, 8),
            new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 })
        );
        this.rbBall.position.set(0.15, 1.05, 0.2);
        this.rbBall.visible = false;
        this.rb.group.add(this.rbBall);
        this._colors();
    }

    _colors() {
        for (let i = 0; i < 4; i += 1) this.mesh.setColorAt(i, new THREE.Color(RECEIVER_COLORS[i]));
        this.mesh.setColorAt(4, new THREE.Color('#e7c56a'));
        for (let i = 0; i < 6; i += 1) this.mesh.setColorAt(5 + i, new THREE.Color('#2f6fbe'));
        this.mesh.instanceColor.needsUpdate = true;
    }

    setPlay(play) {
        this.play = play;
        this.mode = 'pre';
        this.phase = 0;
        for (let i = 0; i < 4; i += 1) {
            const spec = play.receivers[i];
            this.runners[i].alignX = spec.x;
            this.runners[i].alignZ = spec.z;
            this.runners[i].route = spec.route;
            this.runners[i].step = 0;
            this.runners[i].hop = 0;
            this._setRibbon(this.runners[i]);
        }
        this.rb.homeX = play.rb.x;
        this.rb.homeZ = play.rb.z;
        this.rb.route = play.rb.route;
        this.rb.step = 0;
        this.rb.hop = 0;
        this.layout();
    }

    spot(los) {
        this.los = los;
        this.mode = 'pre';
        this.phase = 0;
        for (let i = 0; i < 4; i += 1) {
            this.runners[i].step = 0;
            this.runners[i].hop = 0;
            this._setRibbon(this.runners[i]);
        }
        this.rb.step = 0;
        this.rb.hop = 0;
        this.rbBall.visible = false;
        this.layout();
    }

    snap() {
        if (!this.play) return 'pass';
        this.mode = this.play.kind;
        this.phase = 0;
        for (let i = 0; i < this.runners.length; i += 1) this.runners[i].step = 0;
        this.rb.step = 0;
        this.rbBall.visible = this.mode === 'handoff';
        return this.mode;
    }

    isRunLive() {
        return this.mode === 'keeper' || this.mode === 'handoff';
    }

    layout() {
        for (let i = 0; i < this.runners.length; i += 1) {
            const runner = this.runners[i];
            runner.x = this.los + runner.alignX;
            runner.z = runner.alignZ;
            this._placeGroup(runner.group, runner.x, 0, runner.z);
        }
        this.rb.x = this.los + this.rb.homeX;
        this.rb.z = this.rb.homeZ;
        this._placeGroup(this.rb.group, this.rb.x, 0, this.rb.z);
        for (let i = 0; i < this.line.length; i += 1) {
            this.line[i].x = this.los;
            this.line[i].z = LINEMEN[i].z;
        }
        this._writeInstances();
    }

    _placeGroup(group, x, y, z) {
        group.position.set(x, y, z);
    }

    _setRibbon(runner) {
        const path = worldPath(this.los, { x: runner.alignX, z: runner.alignZ, route: runner.route });
        const next = ribbonGeometry(path.length > 1 ? path : []);
        runner.ribbon.geometry.dispose();
        runner.ribbon.geometry = next;
        runner.ribbon.visible = path.length > 1;
    }

    _stepToward(person, points, dt, speed) {
        if (!points || person.step >= points.length) return false;
        const target = points[person.step];
        let dx = target.x - person.x;
        let dz = target.z - person.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.4) {
            person.step += 1;
            return person.step < points.length;
        }
        const step = Math.min(dist, speed * dt);
        dx /= dist;
        dz /= dist;
        person.x += dx * step;
        person.z += dz * step;
        person.yaw = Math.atan2(dx, dz);
        return true;
    }

    update(dt, ball) {
        const live = this.mode !== 'pre';
        for (let i = 0; i < this.runners.length; i += 1) {
            const runner = this.runners[i];
            if (live) {
                const path = worldPath(this.los, { x: runner.alignX, z: runner.alignZ, route: runner.route });
                let tx = null;
                let tz = null;
                if (ball) {
                    const horiz = Math.hypot(ball.x - runner.x, ball.z - runner.z);
                    if (horiz < ADJUST && horiz > 0.2) {
                        tx = ball.x;
                        tz = ball.z;
                    }
                    runner.hop = horiz < 1.45 && ball.y > 1.65
                        ? Math.min(1, runner.hop + dt * 5)
                        : Math.max(0, runner.hop - dt * 3);
                } else {
                    runner.hop = Math.max(0, runner.hop - dt * 3);
                }
                if (tx != null) {
                    const dx = tx - runner.x;
                    const dz = tz - runner.z;
                    const dist = Math.hypot(dx, dz) || 1;
                    const step = Math.min(dist, SPEED * dt);
                    runner.x += (dx / dist) * step;
                    runner.z += (dz / dist) * step;
                    runner.yaw = Math.atan2(dx, dz);
                } else {
                    this._stepToward(runner, path.slice(1), dt, SPEED);
                }
            } else {
                runner.hop = 0;
                runner.yaw = Math.PI / 2;
            }
            const hop = Math.sin(Math.min(1, runner.hop) * Math.PI) * 0.65;
            this._placeGroup(runner.group, runner.x, hop, runner.z);
        }

        if (this.mode === 'handoff') {
            this.rb.yaw = this.rb.yaw || Math.PI / 2;
        } else if (live && this.mode === 'pass') {
            const path = worldPath(this.los, { x: this.rb.homeX, z: this.rb.homeZ, route: this.rb.route });
            this._stepToward(this.rb, path.slice(1), dt, SPEED * 0.9);
            this._placeGroup(this.rb.group, this.rb.x, 0, this.rb.z);
        } else if (this.mode !== 'handoff') {
            this.rb.x = this.los + this.rb.homeX;
            this.rb.z = this.rb.homeZ;
            this.rb.yaw = Math.PI / 2;
            this._placeGroup(this.rb.group, this.rb.x, 0, this.rb.z);
        }

        this.phase += dt;
        const blocking = this.mode === 'keeper' || this.mode === 'handoff' ? 'run' : (live ? 'pass' : 'stance');
        for (let i = 0; i < this.line.length; i += 1) {
            const man = this.line[i];
            if (blocking === 'run') man.x = this.los + Math.min(2.6, this.phase * 2.4);
            else if (blocking === 'pass') man.x = this.los - Math.min(0.75, this.phase * 1.6);
            else man.x = this.los;
            man.z = LINEMEN[i].z;
            man.crouch = blocking === 'stance' ? 0.62 : (blocking === 'pass' ? 0.28 : 0.12);
            man.yaw = Math.PI / 2;
        }
        this._writeInstances();
    }

    moveCarrier(dx, dz, dt) {
        const speed = 8.6;
        this.rb.x += dx * speed * dt;
        this.rb.z += dz * speed * dt;
        this.rb.z = Math.max(-SIDELINE_Z(), Math.min(SIDELINE_Z(), this.rb.z));
        if (Math.hypot(dx, dz) > 0.05) this.rb.yaw = Math.atan2(dx, dz);
        this._placeGroup(this.rb.group, this.rb.x, 0, this.rb.z);
        this._writeInstances();
    }

    carrierX() {
        return this.rb.x;
    }

    catchTargets() {
        const targets = [];
        for (let i = 0; i < this.runners.length; i += 1) {
            const runner = this.runners[i];
            targets.push({
                index: i,
                x: runner.x,
                z: runner.z,
                hopping: runner.hop > 0.45,
                group: runner.group
            });
        }
        targets.push({
            index: 4,
            x: this.rb.x,
            z: this.rb.z,
            hopping: false,
            group: this.rb.group
        });
        return targets;
    }

    noteCatch(index) {
        this.catchCount += 1;
        const color = index < 4 ? new THREE.Color('#b6ff9a') : new THREE.Color('#fff1b0');
        this.mesh.setColorAt(index, color);
        this.mesh.instanceColor.needsUpdate = true;
        const restore = index < 4 ? this.runners[index].tint : new THREE.Color('#e7c56a');
        window.setTimeout(() => {
            this.mesh.setColorAt(index, restore);
            this.mesh.instanceColor.needsUpdate = true;
        }, 700);
    }

    _writeInstances() {
        const write = (index, x, y, z, yaw, crouch) => {
            this.dummy.position.set(x, y, z);
            this.dummy.rotation.set(crouch || 0, yaw || Math.PI / 2, 0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(index, this.dummy.matrix);
        };
        for (let i = 0; i < this.runners.length; i += 1) {
            const runner = this.runners[i];
            const hop = Math.sin(Math.min(1, runner.hop) * Math.PI) * 0.65;
            const crouch = this.mode === 'pre' ? 0.18 : 0;
            write(i, runner.x, hop, runner.z, runner.yaw, crouch);
        }
        write(4, this.rb.x, 0, this.rb.z, this.rb.yaw, this.mode === 'pre' ? 0.2 : 0);
        for (let i = 0; i < this.line.length; i += 1) {
            const man = this.line[i];
            write(5 + i, man.x, 0, man.z, man.yaw, man.crouch);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}

function SIDELINE_Z() {
    return 24.5;
}

export function qbSpot(los) {
    return { x: los + QB_OFFSET.x, z: QB_OFFSET.z };
}

export { isRun };
