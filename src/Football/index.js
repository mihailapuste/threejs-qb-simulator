import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Football {
    constructor(scene, world, camera, field) {
        this.scene = scene;
        this.world = world;
        this.camera = camera;
        this.field = field;
        this.mesh = null;
        this.body = null;
        this.thrownBalls = [];
        this.needNewFootball = true;
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
        const handPosition = new THREE.Vector3(0.2, -0.35, -0.4);
        
        // Convert to world position
        this.mesh.position.copy(handPosition);
        this.mesh.rotation.set(-0.5, Math.PI / 10, 0.2); // Rotate the ball to show laces
        
        // Update the mesh position relative to the camera
        this.camera.add(this.mesh);
    }

    update() {
        // Update all thrown footballs
        if (this.thrownBalls.length > 0) {
            this.thrownBalls.forEach(ball => {
                // Check if the ball is still in the throwing animation
                if (ball.animating) {
                    const now = Date.now();
                    const elapsed = now - ball.startTime;
                    
                    if (elapsed < ball.totalDuration) {
                        // Calculate animation progress (0 to 1)
                        const progress = elapsed / ball.totalDuration;
                        
                        // Calculate the position based on the two-phase animation
                        let position;
                        if (elapsed < ball.loadingDuration) {
                            // Loading phase
                            const loadingProgress = elapsed / ball.loadingDuration;
                            position = new THREE.Vector3().lerpVectors(
                                ball.startPosition,
                                ball.loadingPosition,
                                loadingProgress
                            );
                        } else {
                            // Throwing phase
                            const throwingProgress = (elapsed - ball.loadingDuration) / ball.throwingDuration;
                            position = new THREE.Vector3().lerpVectors(
                                ball.loadingPosition,
                                ball.releasePosition,
                                throwingProgress
                            );
                        }
                        
                        // Set the ball's position
                        ball.mesh.position.copy(position);
                        
                        // Interpolate rotation using quaternions
                        if (ball.startRotation && ball.releaseQuaternion) {
                            const quaternion = new THREE.Quaternion();
                            if (elapsed < ball.loadingDuration) {
                                // Loading phase - keep original rotation with slight adjustment
                                const loadingProgress = elapsed / ball.loadingDuration;
                                const loadingRotation = new THREE.Euler(
                                    ball.startRotation.x - (loadingProgress * 0.2), // Reduced tilt (from 0.3)
                                    ball.startRotation.y + (loadingProgress * 0.1), // Reduced rotation (from 0.2)
                                    ball.startRotation.z,
                                    ball.startRotation.order
                                );
                                quaternion.setFromEuler(loadingRotation);
                            } else {
                                // Throwing phase - rotate to align with throw direction
                                const throwingProgress = (elapsed - ball.loadingDuration) / ball.throwingDuration;
                                THREE.Quaternion.slerp(
                                    new THREE.Quaternion().setFromEuler(new THREE.Euler(
                                        ball.startRotation.x - 0.2, // Reduced tilt (from 0.3)
                                        ball.startRotation.y + 0.1, // Reduced rotation (from 0.2)
                                        ball.startRotation.z,
                                        ball.startRotation.order
                                    )),
                                    ball.releaseQuaternion,
                                    quaternion,
                                    throwingProgress
                                );
                            }
                            ball.mesh.quaternion.copy(quaternion);
                        }
                        
                        // Add a slight spinning effect during the throw
                        if (elapsed >= ball.loadingDuration) {
                            // Only add spin during the throwing phase
                            const throwingProgress = (elapsed - ball.loadingDuration) / ball.throwingDuration;
                            const spinSpeed = 0.3; // Reduced from 0.5 for more natural spin
                            const spinAxis = new THREE.Vector3(0, 0, 1);
                            const spinQuaternion = new THREE.Quaternion().setFromAxisAngle(
                                spinAxis, 
                                throwingProgress * Math.PI * 2 * spinSpeed
                            );
                            ball.mesh.quaternion.multiply(spinQuaternion);
                        }
                    } else {
                        // Animation complete, set final position and start physics
                        ball.mesh.position.copy(ball.releasePosition);
                        ball.mesh.quaternion.copy(ball.releaseQuaternion);
                        
                        // Set the physics body position to match the visual position
                        ball.body.position.copy(ball.releasePosition);
                        this.world.addBody(ball.body);
                        
                        // Apply force to throw the football using the corrected direction
                        const direction = ball.throwDirection;
                        ball.body.velocity.set(
                            direction.x * ball.throwForce,
                            direction.y * ball.throwForce,
                            direction.z * ball.throwForce
                        );
                        
                        // Add a trail effect for the football
                        this.addTrailEffect(ball.mesh);
                        
                        // Mark animation as complete
                        ball.animating = false;
                    }
                } else {
                    // Normal physics update for non-animating balls
                    // Update position from physics
                    ball.mesh.position.copy(ball.body.position);
                    
                    // Check for catch with the receiver if ball is in flight
                    if (!ball.caught && !ball.landed && this.field && this.field.receiver) {
                        console.log("Checking if ball is close to receiver...");
                        const catchResult = this.field.checkCatch(ball.body);
                        if (catchResult) {
                            ball.caught = true;
                            console.log("Catch made in Football.js!");
                            
                            // Stop the ball's physics
                            ball.body.velocity.set(0, 0, 0);
                            ball.body.angularVelocity.set(0, 0, 0);
                            
                            // Create a new football for the player's hands
                            if (this.needNewFootball && this.mesh === null) {
                                this.createNewFootballForHands();
                                this.needNewFootball = false;
                            }
                        }
                    }
                    
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
                    } else if (!ball.landed && ball.body.velocity.length() < 0.1) {
                        // Ball has landed
                        ball.landed = true;
                        
                        // Create a new football for the player's hands if needed
                        if (this.needNewFootball && this.mesh === null) {
                            this.createNewFootballForHands();
                            this.needNewFootball = false;
                        }
                    }
                    
                    // Fade out the trajectory line after 2 seconds
                    if (ball.trajectoryLine) {
                        const elapsedTime = (Date.now() - ball.timeThrownAt) / 1000; // in seconds
                        if (elapsedTime > 2) {
                            // Fade out over 1 second
                            const fadeOutFactor = Math.max(0, 1 - (elapsedTime - 2));
                            ball.trajectoryLine.material.opacity = 0.7 * fadeOutFactor;
                            
                            // Also fade out the landing spot marker if it exists
                            if (ball.trajectoryLine.userData.landingSpot) {
                                // Fade out all children of the landing spot group
                                ball.trajectoryLine.userData.landingSpot.children.forEach(child => {
                                    if (child.material) {
                                        child.material.opacity = child.material.opacity * fadeOutFactor;
                                    }
                                });
                            }
                            
                            // Remove the trajectory line after it's fully faded out
                            if (fadeOutFactor <= 0) {
                                // Remove landing spot marker if it exists
                                if (ball.trajectoryLine.userData.landingSpot) {
                                    this.scene.remove(ball.trajectoryLine.userData.landingSpot);
                                }
                                
                                this.scene.remove(ball.trajectoryLine);
                                ball.trajectoryLine = null;
                            }
                        }
                    }
                }
            });
        }
        
        // Clean up old footballs
        this.cleanupOldFootballs();
        
        // Animate the pulsing ring around the landing spot
        this.scene.children.forEach(child => {
            if (child.userData && child.userData.pulsingRing) {
                const creationTime = child.userData.creationTime;
                const pulsingRing = child.userData.pulsingRing;
                const elapsedTime = (Date.now() - creationTime) / 1000; // in seconds
                
                // Pulse the ring outward with a more dynamic effect
                const pulseFactor = (Math.sin(elapsedTime * 4) + 1) / 2; // Oscillate between 0 and 1, faster
                pulsingRing.scale.set(1 + pulseFactor * 0.5, 1 + pulseFactor * 0.5, 1);
                
                // Also pulse the opacity for added effect
                if (pulsingRing.material) {
                    pulsingRing.material.opacity = 0.3 + pulseFactor * 0.4; // Oscillate between 0.3 and 0.7
                }
            }
        });
    }

    throw(direction, power) {
        // Get the current world position of the football in the player's hand
        const handPosition = new THREE.Vector3();
        this.mesh.getWorldPosition(handPosition);
        
        // Remove the football from the camera (so it's no longer attached to the view)
        this.camera.remove(this.mesh);
        
        // Add the football to the scene directly
        this.scene.add(this.mesh);
        
        // Set the mesh position to the hand position in world space
        this.mesh.position.copy(handPosition);
        
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
        
        // Define the three key positions for the throwing animation
        // 1. Starting position (hand position)
        const startPosition = handPosition.clone();
        
        // 2. Loading position (pulled back, down and to the right)
        const loadingOffset = new THREE.Vector3().copy(cameraRight).multiplyScalar(0.3)  // Right (reduced from 0.4)
            .add(new THREE.Vector3(0, -0.2, 0))                                         // Down (reduced from -0.3)
            .add(cameraDirection.clone().multiplyScalar(-0.15));                        // Back (reduced from -0.2)
        
        const loadingPosition = new THREE.Vector3().copy(startPosition).add(loadingOffset);
        
        // 3. Release position (forward, up and to the right of camera)
        const releaseOffset = new THREE.Vector3().copy(cameraRight).multiplyScalar(0.4)  // Right (reduced from 0.5)
            .add(new THREE.Vector3(0, 0.15, 0))                                         // Up (reduced from 0.2)
            .add(cameraDirection.clone().multiplyScalar(0.8));                          // Forward (reduced from 1.0)
        
        const releasePosition = new THREE.Vector3().copy(this.camera.position).add(releaseOffset);
        
        // Set up animation parameters
        const totalDuration = 250; // Reduced from 400ms to 250ms for faster animation
        const loadingDuration = totalDuration * 0.35; // 35% of time for loading (reduced from 40%)
        const throwingDuration = totalDuration * 0.65; // 65% of time for throwing (increased from 60%)
        const startTime = Date.now();
        
        // Store the starting rotation
        const startRotation = this.mesh.rotation.clone();
        
        // Calculate a target point far in the distance at the center of the screen
        // but slightly below to create a downward arc
        const targetDistance = 100; // Far away point
        const downwardAdjustment = new THREE.Vector3(5, -8, 0); // Aim even lower
        
        const targetPoint = new THREE.Vector3()
            .copy(this.camera.position)
            .add(direction.clone().multiplyScalar(targetDistance))
            .add(downwardAdjustment); // Add downward adjustment
        
        // Calculate corrected direction from release position to target point
        const correctedDirection = new THREE.Vector3()
            .subVectors(targetPoint, releasePosition)
            .normalize();
        
        // Create a quaternion that orients the football along the throw direction
        const releaseQuaternion = new THREE.Quaternion();
        releaseQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), correctedDirection);
        
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
        
        // Calculate spiral speed
        const spiralSpeed = 0.15 + (power / 100) * 0.1; // Slightly faster spiral
        
        // Calculate throw force
        const throwForce = 25 * (power / 100);
        
        // Create trajectory visualization
        const trajectoryLine = this.createTrajectoryLine(releasePosition, correctedDirection, throwForce);
        
        // Add the thrown football to the list of thrown balls with animation data
        this.thrownBalls.push({
            mesh: this.mesh,
            body: thrownBody,
            timeThrownAt: Date.now(),
            throwTime: Date.now(),
            caught: false,
            throwDirection: correctedDirection,
            initialQuaternion: releaseQuaternion.clone(),
            spiralRotation: 0,
            spiralSpeed: spiralSpeed,
            trajectoryLine: trajectoryLine,
            landed: false,
            // Animation properties
            animating: true,
            startTime: startTime,
            totalDuration: totalDuration,
            loadingDuration: loadingDuration,
            throwingDuration: throwingDuration,
            startPosition: startPosition,
            loadingPosition: loadingPosition,
            releasePosition: releasePosition,
            startRotation: startRotation,
            releaseQuaternion: releaseQuaternion,
            throwForce: throwForce
        });
        
        // We'll create a new football in the update method when the thrown one lands
        this.needNewFootball = true;
        this.mesh = null; // Clear the current football reference
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
        let landingPosition = null;
        let lastY = startPosition.y;
        let lastX = startPosition.x;
        let lastZ = startPosition.z;
        
        for (let i = 0; i < 100; i++) {
            const t = i / 10;
            const x = startPosition.x + direction.x * throwForce * t;
            const y = startPosition.y + direction.y * throwForce * t - 0.5 * 9.81 * t * t;
            const z = startPosition.z + direction.z * throwForce * t;
            
            positions.push(x, y, z);
            
            // Store last position above ground
            if (y > 0) {
                lastY = y;
                lastX = x;
                lastZ = z;
            }
            
            // Stop if the ball hits the ground and record landing position
            if (y <= 0) {
                // Calculate exact landing position by interpolating between last point above ground and current point
                const ratio = lastY / (lastY - y);
                const exactX = lastX + ratio * (x - lastX);
                const exactZ = lastZ + ratio * (z - lastZ);
                
                // Set landing position exactly at ground level (y=0)
                landingPosition = new THREE.Vector3(exactX, 0, exactZ);
                
                // Add the exact landing position to make the line connect properly
                positions.push(exactX, 0, exactZ);
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
        
        // Create a landing spot marker if we have a landing position
        if (landingPosition) {
            // Create a group to hold the landing spot elements
            const landingSpotGroup = new THREE.Group();
            
            // Create a bright orange circle to mark the landing spot
            // Make it larger for better visibility
            const circleGeometry = new THREE.CircleGeometry(0.8, 32);
            const circleMaterial = new THREE.MeshBasicMaterial({
                color: 0xFF6600, // Bright orange
                opacity: 0.8,
                transparent: true,
                side: THREE.DoubleSide
            });
            const landingCircle = new THREE.Mesh(circleGeometry, circleMaterial);
            
            // Position the circle at the landing spot slightly above ground level to avoid z-fighting
            landingCircle.position.copy(landingPosition);
            landingCircle.position.y = 0.01; // Slightly above ground
            // Set rotation to lie flat on the ground
            landingCircle.rotation.x = -Math.PI / 2;
            
            // Add the circle to the group
            landingSpotGroup.add(landingCircle);
            
            // Create a smaller inner circle for contrast
            const innerCircleGeometry = new THREE.CircleGeometry(0.3, 32);
            const innerCircleMaterial = new THREE.MeshBasicMaterial({
                color: 0xFFFFFF, // White
                opacity: 0.9,
                transparent: true,
                side: THREE.DoubleSide
            });
            const innerCircle = new THREE.Mesh(innerCircleGeometry, innerCircleMaterial);
            
            // Position the inner circle at the landing spot
            innerCircle.position.copy(landingPosition);
            // Raise it just slightly above the outer circle
            innerCircle.position.y = 0.011;
            innerCircle.rotation.x = -Math.PI / 2;
            
            // Add the inner circle to the group
            landingSpotGroup.add(innerCircle);
            
            // Create a pulsing ring for added visibility
            const ringGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0xFF6600, // Bright orange
                opacity: 0.5,
                transparent: true,
                side: THREE.DoubleSide
            });
            const pulsingRing = new THREE.Mesh(ringGeometry, ringMaterial);
            
            // Position the ring at the landing spot
            pulsingRing.position.copy(landingPosition);
            // Raise it just slightly above the other elements
            pulsingRing.position.y = 0.012;
            pulsingRing.rotation.x = -Math.PI / 2;
            
            // Add the pulsing ring to the group
            landingSpotGroup.add(pulsingRing);
            
            // Store the creation time for animation
            landingSpotGroup.userData.creationTime = Date.now();
            landingSpotGroup.userData.pulsingRing = pulsingRing;
            
            // Add the landing spot group to the scene
            this.scene.add(landingSpotGroup);
            
            // Store the landing spot group with the trajectory line for cleanup
            trajectoryLine.userData.landingSpot = landingSpotGroup;
        }
        
        return trajectoryLine;
    }
    
    createNewFootballForHands() {
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

    forceNewFootball() {
        // If we already have a football in hands, don't create another one
        if (this.mesh !== null) {
            return;
        }
        
        // Create a new football for the player's hands
        this.createNewFootballForHands();
        this.needNewFootball = false;
        
        console.log("New football created by Q key press");
    }

    // Check if any thrown footballs are currently thrown
    isThrown() {
        console.log(`isThrown check: ${this.thrownBalls.length > 0} (${this.thrownBalls.length} balls)`);
        return this.thrownBalls.length > 0;
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
                
                // Remove the landing spot marker if it exists
                if (ball.trajectoryLine.userData.landingSpot) {
                    this.scene.remove(ball.trajectoryLine.userData.landingSpot);
                }
            }
            
            // Remove the ball from the array
            this.thrownBalls.splice(index, 1);
        }
        
        // Keep only the last 10 thrown footballs to manage memory
        if (this.thrownBalls.length > 10) {
            const oldestBall = this.thrownBalls.shift();
            this.scene.remove(oldestBall.mesh);
            this.world.removeBody(oldestBall.body);
            
            // Remove the trajectory line if it exists
            if (oldestBall.trajectoryLine) {
                this.scene.remove(oldestBall.trajectoryLine);
                
                // Remove the landing spot marker if it exists
                if (oldestBall.trajectoryLine.userData.landingSpot) {
                    this.scene.remove(oldestBall.trajectoryLine.userData.landingSpot);
                }
            }
        }
    }
}

export default Football;
