// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const NUM_PARTICLES = 1500;
const NUM_SPHERE = 700;

// Shared state
let currentMode = 1;
let targetMode = 1;
let sharedData = {
    x: 0,
    y: 0,
    z: 0,
    running: true
};

// Colors for each mode
const colors = {
    cosmos: new THREE.Color(0.1, 0.5, 1.0),     // Neon Blue
    saturnSphere: new THREE.Color(1.0, 0.5, 0.0), // Deep Orange
    saturnRing: new THREE.Color(1.0, 0.7, 0.3),   // Golden Yellow
    iloveyou: new THREE.Color(0.0, 0.8, 1.0),   // Electric Cyan
    heart: new THREE.Color(1.0, 0.1, 0.4),      // Vivid Pink/Red
    hbd: new THREE.Color(0.85, 0.15, 0.9)       // Deep Magenta/Purple
};

// Chime Frequencies for Web Audio API
const frequencies = {
    1: 261.63, // C4
    2: 329.63, // E4
    3: 392.00, // G4
    5: 440.00, // A4
    4: 523.25  // C5
};

// Coordinates Arrays
let posSpace = [];
let posSaturn = [];
let colSaturn = [];
let posHeart = [];
let posILoveYou = [];
let posHbdPrincess = [];

// Current particle state for interpolation
let currentPositions = [];
let currentColors = [];

// Target particle state
let targetPositions = [];
let targetColors = [];

// Three.js variables
let scene, camera, renderer, pointsGeometry, pointsMesh, orbitControls;
let rotationAngle = 0;
let handX = 0, handY = 0, handZ = -12;
let targetHandX = 0, targetHandY = 0, targetHandZ = -12;

// MediaPipe variables
let handsTracker;
let cameraHelper;

// Web Audio API context
let audioCtx = null;

// ==========================================
// 1. GENERATE POSITIONS & MATH FORMULAS
// ==========================================
function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function initCoordinates() {
    // Mode 1: Space / Cosmos (Random box)
    posSpace = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
        posSpace.push(new THREE.Vector3(
            randomRange(-4.0, 4.0),
            randomRange(-4.0, 4.0),
            randomRange(-4.0, 4.0)
        ));
    }

    // Mode 2: Saturn (Core Sphere + Ring)
    posSaturn = [];
    colSaturn = [];
    for (let i = 0; i < NUM_SPHERE; i++) {
        const phi = randomRange(0, 2 * Math.PI);
        const costheta = randomRange(-1, 1);
        const theta = Math.acos(costheta);
        const r = 1.3;
        posSaturn.push(new THREE.Vector3(
            r * Math.sin(theta) * Math.cos(phi),
            r * Math.sin(theta) * Math.sin(phi),
            r * Math.cos(theta)
        ));
        colSaturn.push(colors.saturnSphere);
    }
    for (let i = NUM_SPHERE; i < NUM_PARTICLES; i++) {
        const theta = randomRange(0, 2 * Math.PI);
        const r = randomRange(1.8, 3.8);
        posSaturn.push(new THREE.Vector3(
            r * Math.cos(theta),
            randomRange(-0.05, 0.05),
            r * Math.sin(theta)
        ));
        colSaturn.push(colors.saturnRing);
    }

    // Mode 4: Heart Shape
    posHeart = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
        const t = randomRange(-Math.PI, Math.PI);
        const p = randomRange(-Math.PI, Math.PI);
        
        const x = 2.0 * Math.pow(Math.sin(t), 3);
        const y = 2.0 * Math.cos(t) - 0.7 * Math.cos(2*t) - 0.3 * Math.cos(3*t) - 0.1 * Math.cos(4*t);
        const z = Math.sin(p) * 0.4;
        
        posHeart.push(new THREE.Vector3(
            x * 0.85,
            (y * 0.85) + 0.5,
            z
        ));
    }

    // Mode 3 & 5: Text Shapes (Extracted from 2D Canvas)
    generateTextPoints();

    // Initialize current positions and colors
    currentPositions = [];
    currentColors = [];
    for (let i = 0; i < NUM_PARTICLES; i++) {
        currentPositions.push(new THREE.Vector3(posSpace[i].x, posSpace[i].y, posSpace[i].z));
        currentColors.push(new THREE.Color(colors.cosmos.r, colors.cosmos.g, colors.cosmos.b));
        
        targetPositions.push(new THREE.Vector3(posSpace[i].x, posSpace[i].y, posSpace[i].z));
        targetColors.push(new THREE.Color(colors.cosmos.r, colors.cosmos.g, colors.cosmos.b));
    }
}

// 2D Canvas Text Extractor
function getTextPoints(text, fontStr, scaleX = 1/70, scaleY = 1/70) {
    const canvas2d = document.createElement('canvas');
    const ctx2d = canvas2d.getContext('2d');
    canvas2d.width = 800;
    canvas2d.height = 200;

    ctx2d.clearRect(0, 0, canvas2d.width, canvas2d.height);
    ctx2d.fillStyle = 'white';
    ctx2d.font = fontStr;
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillText(text, canvas2d.width / 2, canvas2d.height / 2);

    const imgData = ctx2d.getImageData(0, 0, canvas2d.width, canvas2d.height);
    const points = [];
    const step = 2; // pixel sampling step
    
    for (let y = 0; y < canvas2d.height; y += step) {
        for (let x = 0; x < canvas2d.width; x += step) {
            const index = (y * canvas2d.width + x) * 4;
            const r = imgData.data[index];
            if (r > 128) {
                const px = (x - canvas2d.width / 2) * scaleX;
                const py = -(y - canvas2d.height / 2) * scaleY;
                const pz = (Math.random() - 0.5) * 0.15;
                points.push(new THREE.Vector3(px, py, pz));
            }
        }
    }

    const finalPoints = [];
    if (points.length === 0) {
        // Fallback
        for (let i = 0; i < NUM_PARTICLES; i++) {
            finalPoints.push(new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 2, 0));
        }
    } else {
        for (let i = 0; i < NUM_PARTICLES; i++) {
            const pt = points[Math.floor(Math.random() * points.length)];
            finalPoints.push(new THREE.Vector3(
                pt.x + (Math.random() - 0.5) * 0.05,
                pt.y + (Math.random() - 0.5) * 0.05,
                pt.z + (Math.random() - 0.5) * 0.05
            ));
        }
    }
    return finalPoints;
}

function generateTextPoints() {
    posILoveYou = getTextPoints("I LOVE YOU", "bold 85px Outfit, Inter, sans-serif", 1/70, 1/70);
    posHbdPrincess = getTextPoints("HBD PRINCESS", "bold 75px Outfit, Inter, sans-serif", 1/75, 1/75);
}

// ==========================================
// 2. THREE.JS INITIALIZATION
// ==========================================
function initThree() {
    const canvas = document.getElementById('webgl-canvas');
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030308, 0.015);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(0, 0, 12);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Controls for manual rotation
    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.enableZoom = true;
    orbitControls.maxDistance = 20;
    orbitControls.minDistance = 5;

    // Build Particles Geometry & Mesh
    pointsGeometry = new THREE.BufferGeometry();
    const positionsArray = new Float32Array(NUM_PARTICLES * 3);
    const colorsArray = new Float32Array(NUM_PARTICLES * 3);

    for (let i = 0; i < NUM_PARTICLES; i++) {
        positionsArray[i * 3] = currentPositions[i].x;
        positionsArray[i * 3 + 1] = currentPositions[i].y;
        positionsArray[i * 3 + 2] = currentPositions[i].z;

        colorsArray[i * 3] = currentColors[i].r;
        colorsArray[i * 3 + 1] = currentColors[i].g;
        colorsArray[i * 3 + 2] = currentColors[i].b;
    }

    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
    pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));

    // Particle Shader / Material
    // Create a beautiful round soft particle texture dynamically
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 16;
    pCanvas.height = 16;
    const pCtx = pCanvas.getContext('2d');
    const grad = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 16, 16);
    
    const texture = new THREE.CanvasTexture(pCanvas);

    const pointsMaterial = new THREE.PointsMaterial({
        size: 0.15,
        map: texture,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });

    pointsMesh = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(pointsMesh);

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==========================================
// 3. CORE RENDERING LOOP & PHYSICS
// ==========================================
function updateParticles() {
    const positionsAttr = pointsGeometry.attributes.position.array;
    const colorsAttr = pointsGeometry.attributes.color.array;

    // Select Target positions based on active mode
    let targetPosSrc = posSpace;
    if (targetMode === 1) targetPosSrc = posSpace;
    else if (targetMode === 2) targetPosSrc = posSaturn;
    else if (targetMode === 3) targetPosSrc = posILoveYou;
    else if (targetMode === 4) targetPosSrc = posHeart;
    else if (targetMode === 5) targetPosSrc = posHbdPrincess;

    // Apply colors and positions
    for (let i = 0; i < NUM_PARTICLES; i++) {
        // Position interpolation
        currentPositions[i].x += (targetPosSrc[i].x - currentPositions[i].x) * 0.12;
        currentPositions[i].y += (targetPosSrc[i].y - currentPositions[i].y) * 0.12;
        currentPositions[i].z += (targetPosSrc[i].z - currentPositions[i].z) * 0.12;

        positionsAttr[i * 3] = currentPositions[i].x;
        positionsAttr[i * 3 + 1] = currentPositions[i].y;
        positionsAttr[i * 3 + 2] = currentPositions[i].z;

        // Color interpolation
        let tCol = colors.cosmos;
        if (targetMode === 1) {
            tCol = colors.cosmos;
        } else if (targetMode === 2) {
            tCol = colSaturn[i];
        } else if (targetMode === 3) {
            tCol = colors.iloveyou;
        } else if (targetMode === 4) {
            tCol = colors.heart;
        } else if (targetMode === 5) {
            tCol = colors.hbd;
        }

        currentColors[i].r += (tCol.r - currentColors[i].r) * 0.12;
        currentColors[i].g += (tCol.g - currentColors[i].g) * 0.12;
        currentColors[i].b += (tCol.b - currentColors[i].b) * 0.12;

        colorsAttr[i * 3] = currentColors[i].r;
        colorsAttr[i * 3 + 1] = currentColors[i].g;
        colorsAttr[i * 3 + 2] = currentColors[i].b;
    }

    pointsGeometry.attributes.position.needsUpdate = true;
    pointsGeometry.attributes.color.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);

    // Update particles positions/colors
    updateParticles();

    // Lerp hand movement values
    handX += (targetHandX - handX) * 0.15;
    handY += (targetHandY - handY) * 0.15;
    handZ += (targetHandZ - handZ) * 0.15;

    // Apply rotation based on current mode (matching Python logic)
    if (targetMode === 1) {
        rotationAngle += 0.005; 
        pointsMesh.position.set(0, 0, 0);
    } else if (targetMode === 2) {
        rotationAngle += 0.02;
        pointsMesh.position.set(handX, handY, handZ + 12); // floating
        pointsMesh.rotation.z = 0.4; // Saturn Tilt
    } else if (targetMode === 3) {
        rotationAngle = 0; // Static text facing camera
        pointsMesh.position.set(handX, handY, handZ + 12);
        pointsMesh.rotation.z = 0;
    } else if (targetMode === 4) {
        rotationAngle += 0.015;
        pointsMesh.position.set(handX, handY, handZ + 12);
        pointsMesh.rotation.z = 0;
    } else if (targetMode === 5) {
        rotationAngle = 0; // Static text
        pointsMesh.position.set(handX, handY, handZ + 12);
        pointsMesh.rotation.z = 0;
    }

    // Apply main rotation y-axis
    pointsMesh.rotation.y = rotationAngle;

    orbitControls.update();
    renderer.render(scene, camera);
}

// ==========================================
// 4. MODE HANDLER & AUDIO SYNTHESIZER
// ==========================================
function playChime(frequency, type = 'triangle', duration = 0.6) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const delay = audioCtx.createDelay();
        const feedback = audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, audioCtx.currentTime + duration);
        
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        
        // Add echo delay for dreamy spatial sound
        delay.delayTime.setValueAtTime(0.2, audioCtx.currentTime);
        feedback.gain.setValueAtTime(0.3, audioCtx.currentTime);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        // Connect echo path
        gain.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + duration + 0.5);
    } catch (err) {
        console.warn('AudioContext chimes blocked or not supported:', err);
    }
}

function setMode(modeNum) {
    if (targetMode === modeNum) return;
    targetMode = modeNum;
    
    // Play chime sound effect
    if (frequencies[modeNum]) {
        playChime(frequencies[modeNum], modeNum === 4 ? 'sine' : 'triangle');
    }

    // Update UI highlights
    document.querySelectorAll('.guide-item').forEach(el => el.classList.remove('active'));
    
    const targetEl = document.getElementById(`guide-mode-${modeNum}`);
    if (targetEl) targetEl.classList.add('active');
}

// Fallback Keyboard controls
window.addEventListener('keydown', (e) => {
    if (e.key === '1') setMode(1);
    if (e.key === '2') setMode(2);
    if (e.key === '3') setMode(3);
    if (e.key === '4') setMode(4);
    if (e.key === '5') setMode(5);
});

// Manual UI buttons callback
window.changeModeManual = function(modeNum) {
    setMode(modeNum);
};

// ==========================================
// 5. MEDIAPIPE HAND TRACKING INTEGRATION
// ==========================================
function parseGesture(landmarks) {
    const tips = [8, 12, 16, 20];
    const pips = [6, 10, 14, 18];
    
    const standingFingers = tips.map((t, idx) => {
        return landmarks[t].y < landmarks[pips[idx]].y;
    });

    const sumStanding = standingFingers.filter(Boolean).length;

    // Gesture Logic matching Python
    if (sumStanding === 0) {
        return 4; // Fist -> Heart
    }
    if (standingFingers[0] && !standingFingers[1] && !standingFingers[2] && !standingFingers[3]) {
        return 2; // Index Finger Up -> Saturn
    }
    if (standingFingers[0] && standingFingers[1] && !standingFingers[2] && !standingFingers[3]) {
        return 3; // Peace -> I LOVE YOU
    }
    if (standingFingers[0] && standingFingers[1] && standingFingers[2] && !standingFingers[3]) {
        return 5; // 3 fingers -> HBD Princess
    }
    
    return 1; // Open hand / Default -> Cosmos
}

function initMediaPipe() {
    const videoElement = document.getElementById('webcam-video');
    const overlayCanvas = document.getElementById('camera-overlay-canvas');
    const overlayCtx = overlayCanvas.getContext('2d');
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    const cameraLoading = document.getElementById('camera-loading');

    handsTracker = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    handsTracker.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
    });

    handsTracker.onResults((results) => {
        // Clear canvas
        overlayCanvas.width = videoElement.videoWidth;
        overlayCanvas.height = videoElement.videoHeight;
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            // Draw landmarks on camera preview
            drawLandmarks(overlayCtx, landmarks);
            
            // Determine active mode based on gesture
            const gestureMode = parseGesture(landmarks);
            setMode(gestureMode);

            // Compute Wrist coordinates for interactive floating translation
            const wrist = landmarks[0];
            
            // Map 0..1 coordinates to -3..3 3D screen space coordinates
            targetHandX = (wrist.x - 0.5) * 8.0;
            targetHandY = -(wrist.y - 0.5) * 6.0;
            
            // Calculate distance between wrist and pinky MCP to approximate Z depth
            const pinkyMcp = landmarks[17];
            const distance = Math.sqrt(
                Math.pow(wrist.x - pinkyMcp.x, 2) + 
                Math.pow(wrist.y - pinkyMcp.y, 2)
            );
            targetHandZ = -12.0 - (1.0 / (distance + 0.01)) * 0.15;
            
            statusText.innerText = "Tangan Terdeteksi: Pelacakan Aktif";
            statusDot.className = "status-dot connected";
        } else {
            // Hand not detected, slowly reset target mesh position
            targetHandX = 0;
            targetHandY = 0;
            targetHandZ = -12.0;

            statusText.innerText = "Kamera Aktif. Hadapkan telapak tangan ke kamera.";
            statusDot.className = "status-dot connected";
        }
    });

    // Start webcam stream using navigator.mediaDevices
    navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: 'user' }
    })
    .then((stream) => {
        videoElement.srcObject = stream;
        cameraLoading.style.display = 'none';
        
        // Start processing loops
        cameraHelper = new Camera(videoElement, {
            onFrame: async () => {
                await handsTracker.send({ image: videoElement });
            },
            width: 480,
            height: 360
        });
        cameraHelper.start();

        statusText.innerText = "Model & Kamera Aktif! Menunggu deteksi tangan...";
        statusDot.className = "status-dot connected";
    })
    .catch((err) => {
        console.error("Camera access failed:", err);
        cameraLoading.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #ff3b30"></i><p style="padding: 10px; text-align: center;">Webcam tidak diizinkan atau tidak ditemukan. Menggunakan tombol manual.</p>`;
        
        statusText.innerText = "Webcam tidak terdeteksi. Gunakan tombol/keyboard.";
        statusDot.className = "status-dot error";
    });
}

// Helper to draw MediaPipe hand overlay on camera container
function drawLandmarks(ctx, landmarks) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
    ctx.fillStyle = '#ff1a60';

    // Draw connection lines
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],       // Index
        [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
        [9, 13], [13, 14], [14, 15], [15, 16],// Ring
        [13, 17], [17, 18], [18, 19], [19, 20],// Pinky
        [0, 17]                               // Palm base
    ];

    ctx.beginPath();
    connections.forEach(([start, end]) => {
        ctx.moveTo(landmarks[start].x * ctx.canvas.width, landmarks[start].y * ctx.canvas.height);
        ctx.lineTo(landmarks[end].x * ctx.canvas.width, landmarks[end].y * ctx.canvas.height);
    });
    ctx.stroke();

    // Draw dots at joints
    for (let i = 0; i < landmarks.length; i++) {
        const x = landmarks[i].x * ctx.canvas.width;
        const y = landmarks[i].y * ctx.canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// ==========================================
// 6. GENERAL EVENT LISTENERS & INITS
// ==========================================

// Draggable Camera Container Logic
function setupDraggableCamera() {
    const cameraBox = document.getElementById('camera-box');
    const dragHandle = cameraBox.querySelector('.camera-header');

    let isDragging = false;
    let startX, startY;
    let initialX, initialY;

    // Mouse drag
    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = cameraBox.offsetLeft;
        initialY = cameraBox.offsetTop;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });

    // Touch drag (Mobile support)
    dragHandle.addEventListener('touchstart', (e) => {
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        initialX = cameraBox.offsetLeft;
        initialY = cameraBox.offsetTop;
        document.addEventListener('touchmove', onTouchMove);
        document.addEventListener('touchend', onMouseUp);
    }, { passive: false });

    function onMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        cameraBox.style.left = `${initialX + dx}px`;
        cameraBox.style.top = `${initialY + dy}px`;
        cameraBox.style.bottom = 'auto';
        cameraBox.style.right = 'auto';
    }

    function onTouchMove(e) {
        if (!isDragging) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        
        cameraBox.style.left = `${initialX + dx}px`;
        cameraBox.style.top = `${initialY + dy}px`;
        cameraBox.style.bottom = 'auto';
        cameraBox.style.right = 'auto';
        e.preventDefault();
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onMouseUp);
    }
}

// Minimize/Maximize Camera Feed
function setupCameraWindowControls() {
    const cameraBox = document.getElementById('camera-box');
    const minimizeBtn = document.getElementById('minimize-camera');
    const restoreBtn = document.getElementById('restore-camera');

    minimizeBtn.addEventListener('click', () => {
        cameraBox.style.display = 'none';
        restoreBtn.style.display = 'flex';
    });

    restoreBtn.addEventListener('click', () => {
        cameraBox.style.display = 'block';
        restoreBtn.style.display = 'none';
    });
}

// BGM Audio player toggling
function setupBGMControls() {
    const musicBtn = document.getElementById('music-toggle');
    const bgMusic = document.getElementById('bg-music');
    const soundIndicator = document.getElementById('sound-indicator');

    musicBtn.addEventListener('click', () => {
        // Resume Audio Context on interaction
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        toggleBGM(bgMusic, musicBtn, soundIndicator);
    });
}

function toggleBGM(bgMusic, musicBtn, soundIndicator) {
    if (bgMusic.paused) {
        bgMusic.play()
            .then(() => {
                musicBtn.classList.add('playing');
                musicBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> Hentikan Musik`;
                soundIndicator.classList.add('active');
            })
            .catch(err => {
                console.error("Audio playback error:", err);
            });
    } else {
        bgMusic.pause();
        musicBtn.classList.remove('playing');
        musicBtn.innerHTML = `<i class="fa-solid fa-music"></i> Putar Musik Romantis`;
        soundIndicator.classList.remove('active');
    }
}

// Setup Intro Screen trigger button
function setupIntroButton() {
    const startBtn = document.getElementById('start-btn');
    const introScreen = document.getElementById('intro-screen');
    const bgMusic = document.getElementById('bg-music');
    const musicBtn = document.getElementById('music-toggle');
    const soundIndicator = document.getElementById('sound-indicator');

    startBtn.addEventListener('click', () => {
        // Initialize Web Audio API
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        // Play E4 chime sound effect on click
        playChime(329.63, 'sine', 0.8);

        // Try to autoplay BGM
        bgMusic.play()
            .then(() => {
                musicBtn.classList.add('playing');
                musicBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> Hentikan Musik`;
                soundIndicator.classList.add('active');
            })
            .catch(err => {
                console.warn("Autoplay audio was blocked even with click event:", err);
            });

        // Fade out screen
        introScreen.classList.add('fade-out');

        // Start hand tracker after transition
        setTimeout(() => {
            introScreen.style.display = 'none';
            initMediaPipe();
        }, 1200);
    });
}

// Wait for fonts to load to draw the text shapes perfectly
document.fonts.ready.then(() => {
    generateTextPoints();
});

// App Startup
window.addEventListener('load', () => {
    initCoordinates();
    initThree();
    setupDraggableCamera();
    setupCameraWindowControls();
    setupBGMControls();
    setupIntroButton();
    animate();
});
