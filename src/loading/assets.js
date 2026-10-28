import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const base = import.meta.env.BASE_URL;

export const modelUrls = {
    quarterback: `${base}models/quarterback.glb`,
    receiver: `${base}models/american_football_player.glb`
};

// Shared loader for the two player GLBs. Draco's wasm/js decoder is copied
// into public/draco from three/examples (no CDN) and is tracked on its own
// manager so it does not dilute model byte progress.
export function createPlayerModelLoader() {
    const manager = new THREE.LoadingManager();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(`${base}draco/`);
    dracoLoader.preload();

    const loader = new GLTFLoader(manager);
    loader.setDRACOLoader(dracoLoader);

    const files = new Map();
    const state = { itemsLoaded: 0, itemsTotal: 0 };

    function record(url, event) {
        if (!event) return;
        const loaded = Number(event.loaded) || 0;
        const previous = files.get(url);
        const total = event.lengthComputable && event.total
            ? Number(event.total)
            : (previous ? previous.total : 0);
        files.set(url, { loaded, total });
    }

    function getProgress() {
        let loaded = 0;
        let total = 0;
        files.forEach((file) => {
            loaded += file.loaded;
            total += file.total;
        });

        let percent = 0;
        if (total > 0) {
            percent = Math.min(100, Math.round((loaded / total) * 100));
        } else if (state.itemsTotal > 0) {
            percent = Math.min(100, Math.round((state.itemsLoaded / state.itemsTotal) * 100));
        }

        return { loaded, total, percent };
    }

    function noteItems(itemsLoaded, itemsTotal) {
        state.itemsLoaded = itemsLoaded;
        state.itemsTotal = itemsTotal;
    }

    return { manager, loader, record, noteItems, getProgress, dracoLoader };
}
