import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const NUMBERS = ['11', '18', '19', '87', '28', '71', '63', '55', '66', '72', '84'];

function paintedBox(width, height, depth, x, y, z, color) {
    const geometry = new THREE.BoxGeometry(width, height, depth, 1, 1, 1);
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

function merge(parts) {
    const geometry = mergeGeometries(parts, false);
    geometry.computeVertexNormals();
    return geometry;
}

function numberTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 128, 64);
    context.fillStyle = '#f7f7f2';
    context.font = '700 46px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 34);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function instanced(geometry, material, count, shadows) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = shadows;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    return mesh;
}

/**
 * Eleven football players sharing a handful of body-part meshes.
 * Each part is posed from the hip or shoulder so a stance, run, block, and catch read without a skeleton.
 */
export function createAthletes(scene, count, shadows) {
    const jersey = new THREE.MeshLambertMaterial({ vertexColors: true });
    const gear = new THREE.MeshLambertMaterial({ vertexColors: true });
    const skin = new THREE.MeshLambertMaterial({ vertexColors: true });
    const torso = merge([
        paintedBox(0.46, 0.5, 0.26, 0, 0.28, 0, '#ffffff'),
        paintedBox(0.34, 0.16, 0.3, 0, 0.08, 0, '#ffffff'),
        paintedBox(0.28, 0.1, 0.32, -0.24, 0.42, 0, '#d7dbe3'),
        paintedBox(0.28, 0.1, 0.32, 0.24, 0.42, 0, '#d7dbe3')
    ]);
    const shell = new THREE.SphereGeometry(0.16, 8, 6);
    shell.scale(1, 0.92, 1.05);
    shell.translate(0, 0.18, 0.01);
    const shellColors = new Float32Array(shell.attributes.position.count * 3);
    const white = new THREE.Color('#f2f4f7');
    for (let i = 0; i < shell.attributes.position.count; i += 1) {
        shellColors[i * 3] = white.r;
        shellColors[i * 3 + 1] = white.g;
        shellColors[i * 3 + 2] = white.b;
    }
    shell.setAttribute('color', new THREE.BufferAttribute(shellColors, 3));
    const helmetGeo = merge([
        shell,
        paintedBox(0.2, 0.035, 0.02, 0, 0.12, 0.16, '#1c1c1c'),
        paintedBox(0.2, 0.035, 0.02, 0, 0.2, 0.15, '#1c1c1c'),
        paintedBox(0.02, 0.16, 0.02, -0.08, 0.16, 0.15, '#1c1c1c'),
        paintedBox(0.02, 0.16, 0.02, 0.08, 0.16, 0.15, '#1c1c1c')
    ]);
    const armGeo = paintedBox(0.11, 0.46, 0.12, 0, -0.24, 0, '#e2b394');
    const legGeo = merge([
        paintedBox(0.16, 0.4, 0.16, 0, -0.2, 0, '#f4f4f4'),
        paintedBox(0.14, 0.36, 0.15, 0, -0.56, 0.02, '#f4f4f4'),
        paintedBox(0.16, 0.08, 0.24, 0, -0.76, 0.06, '#222')
    ]);
    const parts = {
        torso: instanced(torso, jersey, count, shadows),
        helmet: instanced(helmetGeo, gear, count, false),
        armL: instanced(armGeo, skin, count, false),
        armR: instanced(armGeo, skin, count, false),
        legL: instanced(legGeo, jersey, count, false),
        legR: instanced(legGeo, jersey, count, false)
    };
    const whitePaint = new THREE.Color('#ffffff');
    for (let i = 0; i < count; i += 1) {
        parts.helmet.setColorAt(i, whitePaint);
        parts.armL.setColorAt(i, whitePaint);
        parts.armR.setColorAt(i, whitePaint);
    }
    parts.helmet.instanceColor.needsUpdate = true;
    parts.armL.instanceColor.needsUpdate = true;
    parts.armR.instanceColor.needsUpdate = true;
    Object.values(parts).forEach((mesh) => scene.add(mesh));

    const numbers = NUMBERS.map((label) => {
        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(0.46, 0.22),
            new THREE.MeshBasicMaterial({ map: numberTexture(label), transparent: true, depthWrite: false })
        );
        mesh.frustumCulled = false;
        scene.add(mesh);
        return mesh;
    });

    const body = new THREE.Object3D();
    body.rotation.order = 'YXZ';
    const local = new THREE.Object3D();
    local.rotation.order = 'XYZ';
    const one = new THREE.Vector3(1, 1, 1);
    const colors = [];

    function place(mesh, index, px, py, pz, rx) {
        local.position.set(px, py, pz);
        local.rotation.set(rx || 0, 0, 0);
        local.scale.copy(one);
        local.updateMatrix();
        local.matrix.premultiply(body.matrix);
        mesh.setMatrixAt(index, local.matrix);
    }

    return {
        parts,
        setColor(index, color) {
            colors[index] = color;
            parts.torso.setColorAt(index, color);
            parts.legL.setColorAt(index, color);
            parts.legR.setColorAt(index, color);
            parts.torso.instanceColor.needsUpdate = true;
            parts.legL.instanceColor.needsUpdate = true;
            parts.legR.instanceColor.needsUpdate = true;
        },
        write(index, pose) {
            const lift = (pose.y || 0) + (pose.bounce || 0) - Math.max(0, pose.torso || 0) * 0.1;
            body.position.set(pose.x, lift - 0.12, pose.z);
            body.rotation.set(pose.torso || 0, pose.yaw || 0, 0);
            body.scale.set(1.32, 1.32, 1.32);
            body.updateMatrix();
            place(parts.torso, index, 0, 0.9, 0, 0);
            place(parts.helmet, index, 0, 1.28, 0, pose.torso ? 0 : 0);
            place(parts.armL, index, -0.32, 1.32, 0.02, pose.armL || 0);
            place(parts.armR, index, 0.32, 1.32, 0.02, pose.armR || 0);
            place(parts.legL, index, -0.12, 0.9, 0, pose.legL || 0);
            place(parts.legR, index, 0.12, 0.9, 0, pose.legR || 0);
            const number = numbers[index];
            local.position.set(0, 1.2, -0.16);
            local.rotation.set(0, Math.PI, 0);
            local.updateMatrix();
            local.matrix.premultiply(body.matrix);
            number.matrix.copy(local.matrix);
            number.matrixAutoUpdate = false;
            number.matrixWorldNeedsUpdate = true;
        },
        commit() {
            Object.values(parts).forEach((mesh) => {
                mesh.instanceMatrix.needsUpdate = true;
            });
        },
        colorOf(index) {
            return colors[index];
        }
    };
}

export function poseFor(person, mode, time) {
    const catching = person.hop > 0.25;
    const running = person.moving && !catching;
    const line = person.line === true;
    const stance = mode === 'pre' && line;
    const blocking = line && mode !== 'pre';
    let torso = 0.08;
    let legL = 0.12;
    let legR = 0.12;
    let armL = 0.35;
    let armR = 0.35;
    let bounce = 0;
    if (catching) {
        torso = -0.15;
        armL = -2.4;
        armR = -2.4;
        legL = 0.3;
        legR = -0.05;
        bounce = Math.sin(Math.min(1, person.hop) * Math.PI) * 0.28;
    } else if (running) {
        const swing = Math.sin(time * 12 + (person.phase || 0));
        torso = 0.12;
        legL = swing * 0.7;
        legR = -swing * 0.7;
        armL = -swing * 0.65;
        armR = swing * 0.65;
        bounce = Math.abs(swing) * 0.04;
    } else if (blocking && mode !== 'keeper' && mode !== 'handoff') {
        const shove = Math.sin(time * 5 + (person.phase || 0)) * 0.08;
        torso = 0.22;
        armL = -1.05 + shove;
        armR = -0.95 - shove;
        legL = 0.28;
        legR = 0.12;
    } else if (blocking) {
        const shove = Math.sin(time * 6) * 0.08;
        torso = 0.28 + shove;
        armL = -0.75;
        armR = -0.55;
        legL = 0.4;
        legR = 0.18;
    } else if (stance) {
        torso = 0.34;
        armL = 0.7;
        armR = 0.2;
        legL = 0.48;
        legR = 0.18;
    }
    return { torso, legL, legR, armL, armR, bounce };
}
