import * as THREE from 'three';

function plain(material, flat) {
    const color = material.color ? material.color.clone() : new THREE.Color(0xffffff);
    const shared = {
        color,
        map: material.map || null,
        transparent: material.transparent === true,
        opacity: material.opacity === undefined ? 1 : material.opacity,
        emissive: material.emissive ? material.emissive.clone() : new THREE.Color(0x000000)
    };
    if (flat) return new THREE.MeshLambertMaterial(shared);
    return new THREE.MeshStandardMaterial({
        ...shared,
        roughness: material.roughness === undefined ? 0.75 : material.roughness,
        metalness: material.metalness === undefined ? 0.04 : Math.min(material.metalness, 0.2),
        normalMap: null
    });
}

// GLB materials are often MeshPhysical with clearcoat. That extra pass is
// expensive on a phone and invisible at this camera distance, so characters
// render as standard (or Lambert on touch).
export function prepareCharacter(root, { flat = false } = {}) {
    root.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        child.castShadow = false;
        child.receiveShadow = false;
        const list = Array.isArray(child.material) ? child.material : [child.material];
        const next = list.map((material) => plain(material, flat));
        child.material = Array.isArray(child.material) ? next : next[0];
    });
}
