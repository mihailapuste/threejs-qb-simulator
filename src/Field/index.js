import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Field {
    constructor(scene, world, options = {}) {
        this.scene = scene;
        this.world = world;
        this.loaderOptions = options;
        this.field = null;
        this.fieldBody = null;
        this.simpleFieldElements = [];
        this.bowl = null;
        this.showStadium = true;
        this.init();
    }

    init() {
        this.fieldBody = new CANNON.Body({
            type: CANNON.Body.STATIC,
            shape: new CANNON.Plane()
        });
        this.fieldBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(this.fieldBody);
        this.createSimpleField();
        this.createStadium();
        this.createSky();
    }

    createSky() {
        const canvas = document.createElement('canvas');
        canvas.width = 4;
        canvas.height = 512;
        const paint = canvas.getContext('2d');
        const gradient = paint.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#2f74d8');
        gradient.addColorStop(0.42, '#7eb4ef');
        gradient.addColorStop(0.74, '#f3d7ae');
        gradient.addColorStop(1, '#e7b184');
        paint.fillStyle = gradient;
        paint.fillRect(0, 0, 4, 512);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        this.scene.background = texture;
        this.scene.fog = new THREE.Fog(0xe8c4a0, 85, 230);
    }

    toggleField() {
        this.showStadium = !this.showStadium;
        if (this.bowl) this.bowl.visible = this.showStadium;
        return this.showStadium;
    }

    createStadium() {
        this.bowl = new THREE.Group();
        const deck = new THREE.MeshStandardMaterial({ color: 0x2c3344, roughness: 0.9 });
        const seat = new THREE.MeshStandardMaterial({ color: 0x3e4c63, roughness: 0.86 });
        const add = (geometry, material, x, y, z) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, y, z);
            mesh.receiveShadow = true;
            this.bowl.add(mesh);
        };
        const longDeck = new THREE.BoxGeometry(150, 6, 8);
        const longSeat = new THREE.BoxGeometry(150, 5, 7);
        add(longDeck, deck, 0, 3, 36);
        add(longSeat, seat, 0, 8, 42);
        add(longDeck, deck, 0, 3, -36);
        add(longSeat, seat, 0, 8, -42);
        const endDeck = new THREE.BoxGeometry(8, 7, 70);
        add(endDeck, deck, 72, 3.5, 0);
        add(endDeck, deck, -72, 3.5, 0);
        const tower = new THREE.BoxGeometry(1.2, 22, 1.2);
        const lamp = new THREE.MeshStandardMaterial({ color: 0xd7dde8, emissive: 0xfff1c9, emissiveIntensity: 0.35 });
        [[-62, 28], [-62, -28], [62, 28], [62, -28]].forEach(([x, z]) => {
            add(tower, deck, x, 11, z);
            const head = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 2.2), lamp);
            head.position.set(x, 22, z);
            this.bowl.add(head);
        });
        this.scene.add(this.bowl);
    }
    
    createSimpleField() {
        // Painted in yards. 120 x 53.3 includes both 10-yard end zones.
        const fieldGeometry = new THREE.PlaneGeometry(120, 53.3);
        const fieldMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2E5A35,  // Darker field green
            roughness: 0.8,
            emissive: 0x112211,
            emissiveIntensity: 0.1
        });
        this.field = new THREE.Mesh(fieldGeometry, fieldMaterial);
        this.field.rotation.x = -Math.PI / 2;
        this.field.receiveShadow = true;
        this.scene.add(this.field);
        this.simpleFieldElements.push(this.field);
        
        // Add all field markings in the correct order
        this.addEndZones();
        this.addYardLines();
        this.addHashMarks();
        this.addGoalPosts();
    }

    addYardLines() {
        const lineCount = 21;
        const lines = new THREE.InstancedMesh(
            new THREE.BoxGeometry(0.1, 0.01, 53.3),
            new THREE.MeshStandardMaterial({
                color: 0xFFFFFF,
                emissive: 0xFFFFFF,
                emissiveIntensity: 0.2
            }),
            lineCount
        );
        const dummy = new THREE.Object3D();
        let index = 0;
        for (let i = 0; i <= 100; i += 5) {
            dummy.position.set(i - 50, 0.01, 0);
            dummy.updateMatrix();
            lines.setMatrixAt(index, dummy.matrix);
            index += 1;
        }
        lines.instanceMatrix.needsUpdate = true;
        this.scene.add(lines);
        this.simpleFieldElements.push(lines);
        
        // Add yard numbers in NFL style (G, 10, 20, 30, 40, 50, 40, 30, 20, 10, G)
        // But upside down on one side to match the reference image
        const yardMarkers = [
            { position: -40, text: "10" }, // 10 yard line
            { position: -30, text: "20" }, // 20 yard line
            { position: -20, text: "30" }, // 30 yard line
            { position: -10, text: "40" }, // 40 yard line
            { position: 0, text: "50" },   // 50 yard line
            { position: 10, text: "40" },  // 40 yard line (other side)
            { position: 20, text: "30" },  // 30 yard line (other side)
            { position: 30, text: "20" },  // 20 yard line (other side)
            { position: 40, text: "10" }   // 10 yard line (other side)
        ];
        
        yardMarkers.forEach(marker => {
            // Create upside-down numbers for the top of the field (as seen in the reference image)
            const yardNumber = document.createElement('canvas');
            yardNumber.width = 256;
            yardNumber.height = 128;
            const context = yardNumber.getContext('2d');
            context.font = '700 92px sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.lineWidth = 10;
            context.strokeStyle = '#16301f';
            context.strokeText(marker.text, 128, 68);
            context.fillStyle = '#f4f7f2';
            context.fillText(marker.text, 128, 68);
            
            const numberTexture = new THREE.CanvasTexture(yardNumber);
            numberTexture.colorSpace = THREE.SRGBColorSpace;
            const numberMaterial = new THREE.MeshBasicMaterial({ 
                map: numberTexture,
                transparent: true,
                side: THREE.DoubleSide
            });
            
            const numberGeometry = new THREE.PlaneGeometry(6.4, 3.2);
            
            // Top row of numbers (upside down in the reference image)
            const topNumberMesh = new THREE.Mesh(numberGeometry, numberMaterial);
            topNumberMesh.rotation.x = -Math.PI / 2;
            topNumberMesh.rotation.z = Math.PI; // Upside down
            topNumberMesh.position.set(marker.position, 0.02, -15);
            this.scene.add(topNumberMesh);
            this.simpleFieldElements.push(topNumberMesh);
            
            // Bottom row of numbers (right side up)
            const bottomNumberMesh = new THREE.Mesh(numberGeometry, numberMaterial);
            bottomNumberMesh.rotation.x = -Math.PI / 2;
            bottomNumberMesh.position.set(marker.position, 0.02, 15);
            this.scene.add(bottomNumberMesh);
            this.simpleFieldElements.push(bottomNumberMesh);
        });
    }
    
    addHashMarks() {
        const hashes = new THREE.InstancedMesh(
            new THREE.BoxGeometry(0.1, 0.01, 0.5),
            new THREE.MeshStandardMaterial({ color: 0xFFFFFF }),
            202
        );
        const dummy = new THREE.Object3D();
        let index = 0;
        for (let i = 0; i <= 100; i += 1) {
            dummy.position.set(i - 50, 0.01, -10);
            dummy.updateMatrix();
            hashes.setMatrixAt(index, dummy.matrix);
            index += 1;
            dummy.position.set(i - 50, 0.01, 10);
            dummy.updateMatrix();
            hashes.setMatrixAt(index, dummy.matrix);
            index += 1;
        }
        hashes.instanceMatrix.needsUpdate = true;
        this.scene.add(hashes);
        this.simpleFieldElements.push(hashes);
    }
    
    addEndZones() {
        // Add end zones (10 yards deep at each end of the field)
        const endZoneGeometry = new THREE.PlaneGeometry(10, 53.3);
        
        // Dark end zones (almost black with a hint of color)
        const leftMaterial = new THREE.MeshStandardMaterial({ color: 0x1d4e89, roughness: 0.86 });
        const rightMaterial = new THREE.MeshStandardMaterial({ color: 0x8c2f39, roughness: 0.86 });
        const leftEndZone = new THREE.Mesh(endZoneGeometry, leftMaterial);
        leftEndZone.rotation.x = -Math.PI / 2;
        leftEndZone.position.set(-55, 0.012, 0);
        leftEndZone.receiveShadow = true;
        this.scene.add(leftEndZone);
        this.simpleFieldElements.push(leftEndZone);
        const rightEndZone = new THREE.Mesh(endZoneGeometry, rightMaterial);
        rightEndZone.rotation.x = -Math.PI / 2;
        rightEndZone.position.set(55, 0.012, 0);
        rightEndZone.receiveShadow = true;
        this.scene.add(rightEndZone);
        this.simpleFieldElements.push(rightEndZone);
        this.addEndZoneText('HOME', -55, 0xf4f7f2, Math.PI / 2);
        this.addEndZoneText('AWAY', 55, 0xf4f7f2, -Math.PI / 2);
    }
    
    addEndZoneText(text, position, color, rotation = 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        context.fillStyle = '#' + color.toString(16).padStart(6, '0');
        context.font = 'bold 96px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 256, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ 
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const geometry = new THREE.PlaneGeometry(20, 5);
        const textMesh = new THREE.Mesh(geometry, material);
        textMesh.rotation.x = -Math.PI / 2;
        textMesh.rotation.z = rotation; // Apply rotation
        textMesh.position.set(position, 0.02, 0);
        this.scene.add(textMesh);
        this.simpleFieldElements.push(textMesh);
    }

    addGoalPosts() {
        const postMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.45, metalness: 0.2 });
        [-60, 60].forEach((x) => {
            const group = new THREE.Group();
            const upright = new THREE.CylinderGeometry(0.08, 0.08, 8, 8);
            [-2.2, 2.2].forEach((z) => {
                const pole = new THREE.Mesh(upright, postMaterial);
                pole.position.set(0, 4, z);
                group.add(pole);
            });
            const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.4, 6), postMaterial);
            crossbar.rotation.x = Math.PI / 2;
            crossbar.position.set(0, 6.2, 0);
            group.add(crossbar);
            const away = Math.sign(x);
            const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), postMaterial);
            neck.rotation.z = Math.PI / 2;
            neck.position.set(away * 1.2, 6.2, 0);
            group.add(neck);
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.2, 6), postMaterial);
            stem.position.set(away * 2.4, 3.1, 0);
            group.add(stem);
            group.position.set(x, 0, 0);
            this.scene.add(group);
            this.simpleFieldElements.push(group);
        });
    }

    bindOffense(offense) {
        this.offense = offense;
    }

    aimMeshes() {
        return this.offense ? this.offense.aimMeshes : [];
    }

    catchTargets() {
        return this.offense ? this.offense.catchTargets() : [];
    }

    noteCatch(index) {
        if (this.offense) this.offense.noteCatch(index);
    }

    update() {}
}

export default Field;
