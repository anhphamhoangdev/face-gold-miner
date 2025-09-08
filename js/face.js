// Complete MediaPipe Face Detection for Gold Miner Game
// This file should be saved as js/face.js

(async function initGameFaceDetection() {
    const statusEl = document.getElementById('camStatus');
    const videoEl = document.getElementById('faceCam');
    
    if (!videoEl) {
        console.error('Video element #faceCam not found');
        return;
    }

    function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
        console.log(`Face Detection: ${text}`);
    }

    // Check if MediaPipe libraries are loaded
    if (typeof FaceMesh === 'undefined') {
        setStatus('MediaPipe not loaded. Enabling keyboard/mouse controls.');
        window.dispatchEvent(new CustomEvent('face:fallback'));
        return;
    }

    setStatus('Starting face detection for Gold Miner...');

    // Game-specific gesture state
    let gameGestureState = {
        smileBuffer: [],
        nodBuffer: [],
        smileCooldown: 0,
        nodCooldown: 0,
        lastNoseY: null,
        frameCount: 0,
        faceDetected: false,
        gameStarted: false
    };

    // Initialize MediaPipe Face Mesh
    const faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });

    // Optimized settings for game
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false, // Faster processing
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5
    });

    // MediaPipe Face Mesh landmark indices
    const FACE_LANDMARKS = {
        // Mouth points for smile detection
        MOUTH_LEFT: 61,
        MOUTH_RIGHT: 291,
        MOUTH_TOP: 13,
        MOUTH_BOTTOM: 14,
        MOUTH_LEFT_CORNER: 308,
        MOUTH_RIGHT_CORNER: 78,
        // Nose tip for nod detection  
        NOSE_TIP: 1,
        NOSE_BRIDGE: 6
    };

    // Utility functions
    function distance(p1, p2) {
        if (!p1 || !p2) return 0;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function smoothBuffer(buffer, newValue, maxSize = 5) {
        buffer.push(newValue);
        if (buffer.length > maxSize) buffer.shift();
        return buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
    }

    // Enhanced smile detection for game
    function detectGameSmile(landmarks) {
        try {
            const leftCorner = landmarks[FACE_LANDMARKS.MOUTH_LEFT];
            const rightCorner = landmarks[FACE_LANDMARKS.MOUTH_RIGHT];
            const topLip = landmarks[FACE_LANDMARKS.MOUTH_TOP];
            const bottomLip = landmarks[FACE_LANDMARKS.MOUTH_BOTTOM];

            if (!leftCorner || !rightCorner || !topLip || !bottomLip) {
                return false;
            }

            // Calculate mouth aspect ratio (higher when smiling)
            const mouthWidth = distance(leftCorner, rightCorner);
            const mouthHeight = distance(topLip, bottomLip);
            const aspectRatio = mouthWidth > 0 ? mouthHeight / mouthWidth : 0;

            // Calculate mouth center and corner elevation (smile curves up)
            const mouthCenterY = (topLip.y + bottomLip.y) / 2;
            const avgCornerY = (leftCorner.y + rightCorner.y) / 2;
            const elevation = mouthCenterY - avgCornerY; // Positive when corners are above center

            // Combined smile score
            const smileScore = aspectRatio * 0.6 + Math.max(0, elevation * 100) * 0.4;
            
            // Smooth the smile detection
            const smoothedScore = smoothBuffer(gameGestureState.smileBuffer, smileScore, 4);

            // Detect smile with game-appropriate threshold
            if (gameGestureState.smileCooldown <= 0 && smoothedScore > 0.28) {
                gameGestureState.smileCooldown = 120; // 4 seconds cooldown
                gameGestureState.smileBuffer = []; // Reset buffer
                return true;
            }

            return false;
        } catch (error) {
            console.warn('Smile detection error:', error);
            return false;
        }
    }

    // Enhanced nod detection for game
    function detectGameNod(landmarks) {
        try {
            const noseTip = landmarks[FACE_LANDMARKS.NOSE_TIP];
            if (!noseTip) return false;

            const currentNoseY = noseTip.y;

            if (gameGestureState.lastNoseY !== null) {
                const deltaY = currentNoseY - gameGestureState.lastNoseY;
                
                // Smooth the movement
                const smoothedDelta = smoothBuffer(gameGestureState.nodBuffer, deltaY, 6);

                // Detect significant downward movement (nod)
                if (gameGestureState.nodCooldown <= 0 && smoothedDelta > 0.003) {
                    gameGestureState.nodCooldown = 45; // 1.5 seconds cooldown
                    gameGestureState.nodBuffer = []; // Reset buffer
                    return true;
                }
            }

            gameGestureState.lastNoseY = currentNoseY;
            return false;
        } catch (error) {
            console.warn('Nod detection error:', error);
            return false;
        }
    }

    // Main results processing
    faceMesh.onResults((results) => {
        gameGestureState.frameCount++;

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];

            // Update face detection status
            if (!gameGestureState.faceDetected) {
                gameGestureState.faceDetected = true;
                if (!gameGestureState.gameStarted) {
                    setStatus('😊 SMILE TO START GAME! (Nod to drop hook)');
                } else {
                    setStatus('Face detected - Game controls active');
                }
            }

            // Gesture detection
            if (detectGameSmile(landmarks)) {
                console.log('Game Smile detected!');
                if (!gameGestureState.gameStarted) {
                    gameGestureState.gameStarted = true;
                    setStatus('🎮 Game Started! Nod to drop hook');
                }
                // Dispatch smile event for game
                window.dispatchEvent(new CustomEvent('face:smile'));
            }

            if (detectGameNod(landmarks)) {
                console.log('Game Nod detected!');
                if (gameGestureState.gameStarted) {
                    // Dispatch nod event for game
                    window.dispatchEvent(new CustomEvent('face:nod'));
                }
            }

            // Periodic status update
            if (gameGestureState.frameCount % 150 === 0) {
                const status = gameGestureState.gameStarted ? 
                    'Playing - Nod to drop hook' : 
                    'Smile to start game';
                setStatus(`Face tracking: ${status}`);
            }

        } else {
            // No face detected
            if (gameGestureState.faceDetected) {
                gameGestureState.faceDetected = false;
                setStatus('❌ No face detected - Please look at camera');
            }
        }

        // Update cooldowns
        if (gameGestureState.smileCooldown > 0) gameGestureState.smileCooldown--;
        if (gameGestureState.nodCooldown > 0) gameGestureState.nodCooldown--;
    });

    // Camera initialization
    async function setupGameCamera() {
        try {
            setStatus('Requesting camera permission...');

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: false
            });

            videoEl.srcObject = stream;

            return new Promise((resolve, reject) => {
                videoEl.onloadedmetadata = () => {
                    videoEl.play()
                        .then(() => {
                            setStatus('Camera ready. Loading face detection...');
                            resolve();
                        })
                        .catch(reject);
                };
                videoEl.onerror = reject;
                // Timeout fallback
                setTimeout(() => reject(new Error('Camera setup timeout')), 10000);
            });

        } catch (error) {
            setStatus(`Camera failed: ${error.message}`);
            console.error('Camera setup failed:', error);
            window.dispatchEvent(new CustomEvent('face:fallback'));
            throw error;
        }
    }

    // Frame processing setup
    function startGameFrameProcessing() {
        let isProcessing = false;
        let frameSkipCounter = 0;

        function processGameFrame() {
            // Skip frames for performance (process every 2nd frame)
            frameSkipCounter++;
            if (frameSkipCounter % 2 !== 0) {
                requestAnimationFrame(processGameFrame);
                return;
            }

            if (isProcessing || videoEl.videoWidth === 0 || videoEl.readyState < 2) {
                requestAnimationFrame(processGameFrame);
                return;
            }

            isProcessing = true;

            try {
                // Send current video frame to MediaPipe
                faceMesh.send({ image: videoEl })
                    .catch(error => {
                        console.warn('Frame processing error:', error);
                    })
                    .finally(() => {
                        isProcessing = false;
                        requestAnimationFrame(processGameFrame);
                    });
            } catch (error) {
                console.warn('Frame send error:', error);
                isProcessing = false;
                requestAnimationFrame(processGameFrame);
            }
        }

        requestAnimationFrame(processGameFrame);
        setStatus('Face detection ready for Gold Miner!');
    }

    // Initialize everything for the game
    try {
        await setupGameCamera();
        startGameFrameProcessing();

        // Game-specific cleanup
        window.goldMinerFaceCleanup = () => {
            if (videoEl.srcObject) {
                videoEl.srcObject.getTracks().forEach(track => track.stop());
            }
            if (faceMesh) {
                faceMesh.close();
            }
            setStatus('Face detection stopped');
            console.log('Gold Miner face detection cleaned up');
        };

        // Reset game state when page becomes visible again
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && gameGestureState.gameStarted) {
                setStatus('Game resumed - Face tracking active');
            }
        });

        console.log('Gold Miner face detection initialized successfully');

    } catch (error) {
        console.error('Face detection initialization failed:', error);
        setStatus('Face detection unavailable - Using fallback controls');
        window.dispatchEvent(new CustomEvent('face:fallback'));
    }

})().catch(error => {
    console.error('Gold Miner face detection startup error:', error);
    const statusEl = document.getElementById('camStatus');
    if (statusEl) statusEl.textContent = 'Face detection failed - Using keyboard/mouse';
    window.dispatchEvent(new CustomEvent('face:fallback'));
});

// Ensure video element exists with proper styling
(function ensureVideoElement() {
    if (document.getElementById('faceCam')) return;

    console.log('Creating face camera element for Gold Miner');
    document.body.insertAdjacentHTML('beforeend', `
        <div id="camera-container" style="
            position: fixed; 
            top: 10px; 
            right: 10px; 
            z-index: 1000;
            background: rgba(0,0,0,0.8);
            border-radius: 10px;
            padding: 10px;
            border: 2px solid #FFD700;
        ">
            <video id="faceCam" 
                   width="240" 
                   height="180" 
                   autoplay 
                   muted 
                   playsinline
                   style="
                       border: 1px solid #FFD700; 
                       border-radius: 5px;
                       display: block;
                   ">
            </video>
            <div id="camStatus" style="
                color: #FFD700; 
                text-align: center; 
                font-size: 11px;
                margin-top: 5px;
                font-family: Arial, sans-serif;
            ">
                Loading Gold Miner Face Detection...
            </div>
        </div>
    `);
})();