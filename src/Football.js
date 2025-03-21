import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Football {
    constructor(scene, world, camera) {
        this.scene = scene;
        this.world = world;
        this.camera = camera;
        this.mesh = null;
        this.body = null;
        this.thrownBalls = [];
        this.init();
    }

    init() {
        // Create a football shape (ellipsoid with pointed ends)
        const radius = 0.1;  // Base radius for circular front profile
        const length = 0.2;  // Length of the football
        
        // Create a custom geometry for the football with pointed ends
        const footballGeometry = new THREE.SphereGeometry(radius, 32, 16);
        
        // Modify the vertices to create more pointed ends
        const positions = footballGeometry.attributes.position;
        
        // Create a color attribute for vertex coloring
        const colors = new THREE.Float32BufferAttribute(positions.count * 3, 3);
        
        // Base color for the football (medium brown)
        const baseColor = new THREE.Color(0x8B4513);
        // Darker color for the tips (darker brown)
        const tipColor = new THREE.Color(0x5D2906);
        
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            // Scale in z direction to create the elongated shape
            const newZ = z * 2.0;
            
            // Apply a non-linear transformation to create more pointed ends
            // This makes the ends of the football more pointed while keeping the middle full
            const pointiness = 0.4; // Higher values make more pointed ends
            const scaleFactor = 1.0 - pointiness * Math.pow(Math.abs(newZ) / length, 2);
            
            // Apply the transformation
            positions.setX(i, x * scaleFactor);
            positions.setY(i, y * scaleFactor);
            positions.setZ(i, newZ);
            
            // Calculate color based on position
            // The closer to the tips, the darker the color
            const tipFactor = Math.pow(Math.abs(newZ) / length, 1.5);
            const color = new THREE.Color().lerpColors(baseColor, tipColor, tipFactor);
            
            // Set the color for this vertex
            colors.setXYZ(i, color.r, color.g, color.b);
        }
        
        // Add the color attribute to the geometry
        footballGeometry.setAttribute('color', colors);
        
        // Update the geometry
        footballGeometry.computeVertexNormals();
        
        // Create football material with vertex colors enabled
        const footballMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1
        });
        
        this.mesh = new THREE.Mesh(footballGeometry, footballMaterial);
        this.mesh.castShadow = true;
        
        // Add laces to the football (like in the image)
        this.addLaces(this.mesh, radius);
        
        // Position the football in hands
        this.positionInHands();
    }

    addLaces(footballMesh, radiusY) {
        // Create a single white lace on the football
        const lacesMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFFFFF,  // Pure white
            roughness: 0.2,
            metalness: 0.1,
            side: THREE.DoubleSide // Make the lace visible from both sides
        });
        
        // Create a single lace - length of the football
        const radiusZ = 0.2; // Length of football (from init method)
        const laceLength = radiusZ * 0.7; // 80% of football length to follow curvature better
        const laceWidth = 0.03; // Narrower lace
        
        // Create a curved path for the lace to follow the football's elliptical shape
        const points = [];
        const segments = 20;
        
        // Create points along an elliptical path
        for (let i = 0; i <= segments; i++) {
            const t = (i / segments) * 2 - 1; // Range from -1 to 1
            const z = t * (laceLength / 2);
            
            // Calculate y based on elliptical equation
            // This creates a curved path that follows the football's elliptical shape
            const y = radiusY * 0.95 + 0.02 * (1 - Math.pow(t, 2));
            
            points.push(new THREE.Vector3(0, y, z));
        }
        
        // Create a curve from the points
        const curve = new THREE.CatmullRomCurve3(points);
        
        // Create a tube geometry that follows the curve
        const tubeGeometry = new THREE.TubeGeometry(curve, segments, laceWidth / 2, 8, false);
        
        // Create the lace mesh
        const lace = new THREE.Mesh(tubeGeometry, lacesMaterial);
        
        // Add the lace to the football
        footballMesh.add(lace);
        
        // Add stitches to make the lace more visible
        const stitchMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const stitchWidth = 0.0015; // Even narrower
        const stitchHeight = 0.0005; // Extremely thin
        const stitchDepth = 0.004; // Very short
        const numStitches = 8;
        
        // Create stitches along the curve
        for (let i = 0; i < numStitches; i++) {
            // Calculate position along the curve (from 0 to 1)
            const t = (i + 1) / (numStitches + 1);
            
            // Get point and tangent at this position on the curve
            const point = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t).normalize();
            
            // Create a small box for the stitch
            const stitchGeometry = new THREE.BoxGeometry(stitchWidth, stitchHeight, stitchDepth);
            const stitch = new THREE.Mesh(stitchGeometry, stitchMaterial);
            
            // Position the stitch at the point on the curve
            // Offset even less to make it barely visible above the surface
            const normal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();
            const offsetPoint = point.clone().add(normal.multiplyScalar(0.0005));
            stitch.position.copy(offsetPoint);
            
            // Orient the stitch to follow the curve
            // Create a quaternion that rotates from the default orientation to align with the tangent
            const quaternion = new THREE.Quaternion();
            const up = new THREE.Vector3(0, 1, 0);
            const axis = new THREE.Vector3().crossVectors(up, tangent).normalize();
            const angle = Math.acos(up.dot(tangent));
            quaternion.setFromAxisAngle(axis, angle);
            
            // Apply the rotation
            stitch.quaternion.copy(quaternion);
            
            // Add the stitch to the football
            footballMesh.add(stitch);
        }
    }

    positionInHands() {
        // Position the football at the bottom of the screen as if being held
        const handPosition = new THREE.Vector3(0.3, -0.4, -0.5);
        
        // Convert to world position
        this.mesh.position.copy(handPosition);
        this.mesh.rotation.set(0, Math.PI / 4, 0); // Rotate the ball to show laces
        
        // Update the mesh position relative to the camera
        this.camera.add(this.mesh);
    }

    update() {
        // Update all thrown footballs
        if (this.thrownBalls.length > 0) {
            this.thrownBalls.forEach(ball => {
                // Update position from physics
                ball.mesh.position.copy(ball.body.position);
                
                // Only update orientation if not caught and still moving
                if (!ball.caught && ball.body.velocity.length() > 0.1) {
                    // Keep the football pointed in the direction of travel
                    // with the pointy end (z-axis) aligned with the throw direction
                    ball.mesh.quaternion.copy(ball.initialQuaternion);
                    
                    // Apply spiral rotation around the forward axis (z-axis)
                    // This creates a clockwise spiral when viewed from behind the ball
                    ball.spiralRotation += ball.spiralSpeed;
                    
                    // Create a rotation quaternion for the spiral
                    const spiralQuaternion = new THREE.Quaternion();
                    spiralQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), ball.spiralRotation);
                    
                    // Apply the spiral rotation
                    ball.mesh.quaternion.multiply(spiralQuaternion);
                }
                
                // Fade out the trajectory line after 2 seconds
                if (ball.trajectoryLine) {
                    const elapsedTime = (Date.now() - ball.timeThrownAt) / 1000; // in seconds
                    if (elapsedTime > 2) {
                        // Fade out over 1 second
                        const fadeOutFactor = Math.max(0, 1 - (elapsedTime - 2));
                        ball.trajectoryLine.material.opacity = 0.7 * fadeOutFactor;
                        
                        // Remove the trajectory line after it's fully faded out
                        if (fadeOutFactor <= 0) {
                            this.scene.remove(ball.trajectoryLine);
                            ball.trajectoryLine = null;
                        }
                    }
                }
            });
        }
        
        // Clean up old footballs
        this.cleanupOldFootballs();
    }

    throw(direction, power) {
        // Create a clone of the football for throwing
        const worldPosition = new THREE.Vector3();
        this.mesh.getWorldPosition(worldPosition);
        
        // Clone the football mesh
        const thrownFootball = this.mesh.clone();
        this.scene.add(thrownFootball);
        
        // Calculate the position offset for a right-handed throw
        // Get camera direction and right vector
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        
        // Get the camera's right vector
        const cameraRight = new THREE.Vector3(1, 0, 0);
        cameraRight.applyQuaternion(this.camera.quaternion);
        
        // Get the camera's up vector
        const cameraUp = new THREE.Vector3(0, 1, 0);
        cameraUp.applyQuaternion(this.camera.quaternion);
        
        // Position the football to the right and slightly above the camera
        const rightOffset = 0.4; // Distance to the right
        const upOffset = 0.4;    // Distance up
        const forwardOffset = 0.8; // Distance forward
        
        // Calculate the new position
        const throwPosition = new THREE.Vector3().copy(this.camera.position)
            .add(cameraRight.multiplyScalar(rightOffset))
            .add(cameraUp.multiplyScalar(upOffset))
            .add(cameraDirection.multiplyScalar(forwardOffset));
        
        // Set the position of the thrown football
        thrownFootball.position.copy(throwPosition);
        
        // Calculate a target point far in the distance at the center of the screen
        // but slightly below to create a downward arc
        const targetDistance = 100; // Far away point
        const downwardAdjustment = new THREE.Vector3(5, -8, 0); // Aim even lower
        
        const targetPoint = new THREE.Vector3()
            .copy(this.camera.position)
            .add(direction.clone().multiplyScalar(targetDistance))
            .add(downwardAdjustment); // Add downward adjustment
        
        // Calculate corrected direction from throw position to target point
        const correctedDirection = new THREE.Vector3()
            .subVectors(targetPoint, throwPosition)
            .normalize();
        
        // Create a quaternion that orients the football along the throw direction
        const initialQuaternion = new THREE.Quaternion();
        initialQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), correctedDirection);
        
        // Apply the orientation
        thrownFootball.quaternion.copy(initialQuaternion);
        
        // Create a new physics body for the thrown football
        const radiusX = 0.1;
        const radiusY = 0.1;
        const radiusZ = 0.2;
        const physicsRadius = (radiusX + radiusY + radiusZ) / 3;
        
        const thrownBody = new CANNON.Body({
            mass: 0.43, // Football mass in kg
            shape: new CANNON.Sphere(physicsRadius),
            material: new CANNON.Material({ restitution: 0.7 }),
            linearDamping: 0.1,
            angularDamping: 0.9 // Increased to reduce wobbling even more
        });
        
        // Set the physics body position to match the visual position
        thrownBody.position.copy(throwPosition);
        this.world.addBody(thrownBody);
        
        // Apply force to throw the football using the corrected direction
        const throwForce = 25 * (power / 100);
        thrownBody.velocity.set(
            correctedDirection.x * throwForce,
            correctedDirection.y * throwForce,
            correctedDirection.z * throwForce
        );
        
        // Calculate spiral speed - tight spiral with consistent rotation
        const spiralSpeed = 0.15 + (power / 100) * 0.1; // Slightly faster spiral
        
        // Create trajectory visualization
        const trajectoryLine = this.createTrajectoryLine(throwPosition, correctedDirection, throwForce);
        
        // Add the thrown football to the list of thrown balls
        this.thrownBalls.push({
            mesh: thrownFootball,
            body: thrownBody,
            timeThrownAt: Date.now(),
            caught: false,
            throwDirection: correctedDirection,
            initialQuaternion: initialQuaternion.clone(),
            spiralRotation: 0,
            spiralSpeed: spiralSpeed,
            trajectoryLine: trajectoryLine
        });
        
        // Add a trail effect for the football
        this.addTrailEffect(thrownFootball);
        
        // Keep only the last 10 thrown footballs to manage memory
        if (this.thrownBalls.length > 10) {
            const oldestBall = this.thrownBalls.shift();
            this.scene.remove(oldestBall.mesh);
            this.world.removeBody(oldestBall.body);
        }
    }
    
    addTrailEffect(footballMesh) {
        // Create a trail effect using small spheres
        const trailGroup = new THREE.Group();
        this.scene.add(trailGroup);
        
        // Store the trail group in the football mesh for later cleanup
        footballMesh.userData.trailGroup = trailGroup;
        
        // Create a function to update the trail
        const updateTrail = () => {
            // Create a new trail point
            const trailPoint = new THREE.Mesh(
                new THREE.SphereGeometry(0.02, 8, 8),
                new THREE.MeshBasicMaterial({ 
                    color: 0xFFFFFF,
                    transparent: true,
                    opacity: 0.7
                })
            );
            
            // Position the trail point at the football's current position
            trailPoint.position.copy(footballMesh.position);
            
            // Add the trail point to the trail group
            trailGroup.add(trailPoint);
            
            // Fade out and remove old trail points
            trailGroup.children.forEach((point, index) => {
                point.material.opacity -= 0.05;
                
                if (point.material.opacity <= 0) {
                    trailGroup.remove(point);
                }
            });
            
            // Limit the number of trail points
            if (trailGroup.children.length > 20) {
                const oldestPoint = trailGroup.children[0];
                trailGroup.remove(oldestPoint);
            }
        };
        
        // Update the trail every few frames
        const trailInterval = setInterval(updateTrail, 50);
        
        // Store the interval ID for cleanup
        footballMesh.userData.trailInterval = trailInterval;
        
        // Clean up the trail after 10 seconds
        setTimeout(() => {
            clearInterval(trailInterval);
            this.scene.remove(trailGroup);
        }, 10000);
    }
    
    createTrajectoryLine(startPosition, direction, throwForce) {
        // Create a line geometry for the trajectory
        const trajectoryGeometry = new THREE.BufferGeometry();
        const positions = [];
        
        // Calculate the trajectory points
        for (let i = 0; i < 100; i++) {
            const t = i / 10;
            const x = startPosition.x + direction.x * throwForce * t;
            const y = startPosition.y + direction.y * throwForce * t - 0.5 * 9.81 * t * t;
            const z = startPosition.z + direction.z * throwForce * t;
            
            positions.push(x, y, z);
            
            // Stop if the ball hits the ground
            if (y <= 0) {
                break;
            }
        }
        
        // Set the positions attribute
        trajectoryGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        // Create a line material
        const trajectoryMaterial = new THREE.LineBasicMaterial({ 
            color: 0xFFFF00,
            opacity: 0.7,
            transparent: true,
            linewidth: 2 // Make the line a bit thicker
        });
        
        // Create the trajectory line
        const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
        
        // Add the trajectory line to the scene
        this.scene.add(trajectoryLine);
        
        return trajectoryLine;
    }
    
    // Check if any thrown football is caught by the receiver
    checkCatch(receiverBody) {
        if (!this.thrownBalls || this.thrownBalls.length === 0) {
            return false;
        }
        
        for (let i = 0; i < this.thrownBalls.length; i++) {
            const ball = this.thrownBalls[i];
            if (!ball.caught) {
                const distance = ball.body.position.distanceTo(receiverBody.position);
                if (distance < 1.5) {
                    ball.caught = true;
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // Clean up old footballs that have been on the ground for a while
    cleanupOldFootballs() {
        const now = Date.now();
        const footballsToRemove = [];
        
        this.thrownBalls.forEach((ball, index) => {
            // Check if the ball has been on the ground for more than 5 seconds
            const velocity = ball.body.velocity.length();
            const isOnGround = velocity < 0.1;
            
            if (isOnGround && now - ball.timeThrownAt > 5000) {
                footballsToRemove.push(index);
            }
        });
        
        // Remove the footballs in reverse order to avoid index issues
        for (let i = footballsToRemove.length - 1; i >= 0; i--) {
            const index = footballsToRemove[i];
            const ball = this.thrownBalls[index];
            
            // Remove the ball from the scene and physics world
            this.scene.remove(ball.mesh);
            this.world.removeBody(ball.body);
            
            // Remove the trajectory line if it exists
            if (ball.trajectoryLine) {
                this.scene.remove(ball.trajectoryLine);
            }
            
            // Remove the ball from the array
            this.thrownBalls.splice(index, 1);
        }
    }
}

export default Football;
