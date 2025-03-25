import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import Receiver from '../Receiver';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

class Field {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.field = null;
        this.fieldBody = null;
        this.receiver = null;
        this.stadiumModel = null;
        this.simpleFieldElements = []; // Store simple field elements for toggling
        this.showStadium = false; // Default to simple field for testing
        this.init();
    }

    init() {
        // Create field physics (always needed for collision)
        this.fieldBody = new CANNON.Body({
            type: CANNON.Body.STATIC,
            shape: new CANNON.Plane()
        });
        this.fieldBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(this.fieldBody);
        
        // Load the stadium model but don't display it initially
        this.loadStadiumModel();
        
        // Create the simple field for testing
        this.createSimpleField();
        
        // Create receiver
        this.receiver = new Receiver(this.scene, this.world);
    }

    // Toggle between stadium and simple field
    toggleField() {
        this.showStadium = !this.showStadium;
        
        if (this.showStadium) {
            // Hide simple field
            this.simpleFieldElements.forEach(element => {
                this.scene.remove(element);
            });
            
            // Show stadium if loaded
            if (this.stadiumModel) {
                this.scene.add(this.stadiumModel);
            }
        } else {
            // Hide stadium
            if (this.stadiumModel) {
                this.scene.remove(this.stadiumModel);
            }
            
            // Show simple field
            this.simpleFieldElements.forEach(element => {
                this.scene.add(element);
            });
        }
        
        console.log(`Field toggled. Stadium ${this.showStadium ? 'shown' : 'hidden'}`);
        return this.showStadium;
    }

    loadStadiumModel() {
        // Use the GLTFLoader to load the stadium model
        const loader = new GLTFLoader();
        
        loader.load(
            // Resource URL
            '/src/Field/components/acrisure_stadium_pittsburgh_pa (1).glb',
            
            // Called when the resource is loaded
            (gltf) => {
                // Get the model from the loaded GLTF
                this.stadiumModel = gltf.scene;
                
                // Scale the model appropriately - stadiums are typically large structures
                this.stadiumModel.scale.set(1, 1, 1);
                
                // Position the model correctly - center it and adjust height
                this.stadiumModel.position.set(0, 40.5, 0);
                
                // Adjust material properties
                this.stadiumModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Make sure materials are available
                        if (!child.material.emissive) {
                            child.material = new THREE.MeshStandardMaterial({
                                color: child.material.color || 0xFFFFFF,
                                map: child.material.map || null
                            });
                        }
                    }
                });
                
                // Only add to scene if showStadium is true
                if (this.showStadium) {
                    this.scene.add(this.stadiumModel);
                    console.log("Stadium model loaded and displayed");
                } else {
                    console.log("Stadium model loaded but hidden (toggle with 'F' key)");
                }
            },
            
            // Called while loading is progressing
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% stadium loaded');
            },
            
            // Called when loading has errors
            (error) => {
                console.error('An error happened loading the stadium model:', error);
            }
        );
    }
    
    createSimpleField() {
        console.log("Creating simple field for testing");
        // Create field mesh - NCAA field dimensions (120 yards x 53.3 yards)
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
        // Add yard lines every 5 yards (4 inches wide, white)
        for (let i = 0; i <= 100; i += 5) {
            // Only make 5-yard lines visible
            if (i % 5 === 0) {
                const lineGeometry = new THREE.BoxGeometry(0.1, 0.01, 53.3); // 4 inches wide (0.1 yards)
                const lineMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0xFFFFFF,
                    emissive: 0xFFFFFF,
                    emissiveIntensity: 0.2
                });
                const line = new THREE.Mesh(lineGeometry, lineMaterial);
                line.position.set(i - 50, 0.01, 0);
                this.scene.add(line);
                this.simpleFieldElements.push(line);
            }
        }
        
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
            yardNumber.width = 128;
            yardNumber.height = 128;
            const context = yardNumber.getContext('2d');
            context.fillStyle = 'white';
            context.font = 'bold 96px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(marker.text, 64, 64);
            
            const numberTexture = new THREE.CanvasTexture(yardNumber);
            const numberMaterial = new THREE.MeshBasicMaterial({ 
                map: numberTexture,
                transparent: true,
                side: THREE.DoubleSide
            });
            
            // Numbers should be properly sized and positioned
            const numberGeometry = new THREE.PlaneGeometry(3, 3);
            
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
        // Add hash marks every yard - in reference image, there are many small hash marks
        for (let i = 0; i <= 100; i += 1) {
            // Create small hash marks on both sides of each yard line
            const hashGeometry = new THREE.BoxGeometry(0.1, 0.01, 0.5); // Smaller hash marks
            const hashMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
            
            // Top side hash marks (closer to top sideline)
            const topHash = new THREE.Mesh(hashGeometry, hashMaterial);
            topHash.position.set(i - 50, 0.01, -10); // Positioned to match reference
            this.scene.add(topHash);
            this.simpleFieldElements.push(topHash);
            
            // Bottom side hash marks (closer to bottom sideline)
            const bottomHash = new THREE.Mesh(hashGeometry, hashMaterial);
            bottomHash.position.set(i - 50, 0.01, 10); // Positioned to match reference
            this.scene.add(bottomHash);
            this.simpleFieldElements.push(bottomHash);
        }
    }
    
    addEndZones() {
        // Add end zones (10 yards deep at each end of the field)
        const endZoneGeometry = new THREE.PlaneGeometry(10, 53.3);
        
        // Dark end zones (almost black with a hint of color)
        const endZoneMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            roughness: 0.8,
            emissive: 0x111111,
            emissiveIntensity: 0.1
        });
        
        // Left end zone
        const leftEndZone = new THREE.Mesh(endZoneGeometry, endZoneMaterial);
        leftEndZone.rotation.x = -Math.PI / 2;
        leftEndZone.position.set(-55, 0.01, 0);
        this.scene.add(leftEndZone);
        this.simpleFieldElements.push(leftEndZone);
        
        // Right end zone
        const rightEndZone = new THREE.Mesh(endZoneGeometry, endZoneMaterial);
        rightEndZone.rotation.x = -Math.PI / 2;
        rightEndZone.position.set(55, 0.01, 0);
        this.scene.add(rightEndZone);
        this.simpleFieldElements.push(rightEndZone);
        
        // Add "FORZA" text in both end zones (rotated 90 degrees to match image)
        this.addEndZoneText("FORZA", -55, 0xFFFFFF, Math.PI/2);
        this.addEndZoneText("FORZA", 55, 0xFFFFFF, -Math.PI/2);
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
        // Add simple goal posts at each end of the field
        const postMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFFFFF,
            emissive: 0xFFFFFF,
            emissiveIntensity: 0.2
        });
        
        // Create left goal post (simple upright)
        const leftPostGeometry = new THREE.CylinderGeometry(0.1, 0.1, 10, 8);
        const leftPost = new THREE.Mesh(leftPostGeometry, postMaterial);
        leftPost.position.set(-55, 5, 0);
        this.scene.add(leftPost);
        this.simpleFieldElements.push(leftPost);
        
        // Create right goal post (simple upright)
        const rightPostGeometry = new THREE.CylinderGeometry(0.1, 0.1, 10, 8);
        const rightPost = new THREE.Mesh(rightPostGeometry, postMaterial);
        rightPost.position.set(55, 5, 0);
        this.scene.add(rightPost);
        this.simpleFieldElements.push(rightPost);
    }

    checkCatch(footballBody) {
        if (this.receiver && footballBody) {
            return this.receiver.checkCatch(footballBody);
        }
        return false;
    }
    
    update(deltaTime) {
        if (this.receiver) {
            this.receiver.update(deltaTime);
        }
    }
    
    startReceiverRoute(routeName = null) {
        if (this.receiver) {
            return this.receiver.startRoute(routeName);
        }
    }
    
    getReceiverRoutes() {
        if (this.receiver) {
            return this.receiver.getAvailableRoutes();
        }
        return [];
    }
    
    getCurrentReceiverRoute() {
        if (this.receiver) {
            return this.receiver.getCurrentRoute();
        }
        return null;
    }
    
    resetReceiver() {
        if (this.receiver) {
            this.receiver.reset();
        }
    }

    getReceiverCatchCount() {
        if (this.receiver) {
            return this.receiver.getCatchCount();
        }
        return 0;
    }

}

export default Field;
