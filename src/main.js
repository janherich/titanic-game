// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Keyboard input handling
window.addEventListener('keydown', (e) => {
  if (keys.hasOwnProperty(e.key)) {
    keys[e.key] = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.key)) {
    keys[e.key] = false;
    e.preventDefault();
  }
});

// Game state
let gameRunning = true;
let gameOver = false;
let gameWon = false;
let animationTime = 0;
let totalDistance = 0; // Total distance sailed in world units
let lastShipX = 0;
let lastShipY = 0;
let gameStartTime = 0; // Time when game started (for win screen)
let winTime = 0; // Time when goal was reached (stops the timer)

// Coal system
const coalConfig = {
  maxCoal: 100, // Maximum coal (100%)
  depletionRate: 0.01 // Base depletion rate per frame (multiplied by speed)
};

let currentCoal = coalConfig.maxCoal; // Current coal level (0-100)

// Input state
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false
};

// Ship physics configuration
const shipConfig = {
  maxSpeed: 3.5,
  maxReverseSpeed: 0.8,
  accelerationPower: 0.03, // How much acceleration is applied when key is held
  accelerationDecay: 0.08, // How fast acceleration returns to zero when released
  friction: 0.02, // Natural deceleration (friction) when no acceleration
  maxRudderAngle: Math.PI / 6, // 30 degrees
  rudderSpeed: 0.03,
  turnRate: 0.02, // How fast ship turns based on rudder
  pivotPoint: 0.7 // 0.0 = bow, 0.5 = center, 1.0 = stern (0.4 = slightly forward of center)
};

// Icebergs configuration
const icebergsConfig = {
  density: 10, // Icebergs per screen (adjust for more/fewer icebergs)
  minSize: 30,
  maxSize: 80,
  minPoints: 6, // Minimum points for irregular shape
  maxPoints: 12, // Maximum points for irregular shape
  irregularity: 0.4, // How irregular the shape is (0.0 = circle, 1.0 = very irregular)
  color: '#e8f4f8', // Light blue-white color
  strokeColor: '#b8d4e0' // Slightly darker outline
};

// World boundaries
const worldConfig = {
  width: 10000, // World width in pixels
  height: 10000, // World height in pixels
  iceBarrierWidth: 100 // Width of ice barrier at edges
};

// Goal configuration
const goalConfig = {
  radius: 250, // Radius of goal area (bigger island)
  edgeOffset: 300 // Distance from edge to place goal
};

// Goal state
let goal = {
  x: 0,
  y: 0,
  generated: false
};

// Start port state
let startPort = {
  x: 0,
  y: 0,
  generated: false
};

// Camera/World state (initialized near start port)
const camera = {
  x: worldConfig.width / 2, // Will be set near start port
  y: worldConfig.height / 2  // Will be set near start port
};

// Icebergs storage (generated on demand)
const icebergs = [];
const icebergGridSize = 500; // Generate icebergs in chunks
const loadedIcebergChunks = new Set(); // Track which chunks have been generated

// Ship properties (ship is always at screen center)
const ship = {
  // Ship is always drawn at screen center
  screenX: 0, // Will be set to canvas center
  screenY: 0, // Will be set to canvas center
  rotation: -Math.PI / 2, // Rotation in radians (-90 degrees = pointing up)
  speed: 0, // Current speed (positive = forward, negative = reverse)
  acceleration: 0, // Current acceleration (positive = forward, negative = reverse)
  rudderAngle: 0, // Current rudder angle (-maxRudderAngle to +maxRudderAngle)
  length: 200,
  width: 60,
  stackCount: 4,
  stackRadius: 10
};

// Draw ship hull (oval shape from above)
function drawShipHull(x, y, length, width, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  
  // Draw main hull (ellipse)
  ctx.beginPath();
  ctx.ellipse(0, 0, length / 2, width / 2, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Fill hull (wooden deck)
  ctx.fillStyle = '#8B6F47';
  ctx.fill();
  
  ctx.restore();
}

// Draw top structure (white rectangular superstructure)
function drawTopStructure(x, y, length, width, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  
  // Top structure is smaller than the hull to fit within outline
  const structureLength = length * 0.7;
  const structureWidth = width * 0.5;
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(
    -structureLength / 2,
    -structureWidth / 2,
    structureLength,
    structureWidth
  );
  
  // Optional: add a subtle outline
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    -structureLength / 2,
    -structureWidth / 2,
    structureLength,
    structureWidth
  );
  
  ctx.restore();
}

// Draw smokestacks (circles from above)
function drawSmokestacks(x, y, length, stackCount, stackRadius, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#000000';
  ctx.lineWidth = 1.5;
  
  // Calculate spacing between stacks (closer together)
  const stackDiameter = stackRadius * 2;
  const totalStackWidth = stackCount * stackDiameter;
  const spacing = 15; // Fixed spacing between stacks
  const totalGroupWidth = totalStackWidth + (stackCount - 1) * spacing;
  
  // Center the stack group longitudinally
  const startX = -totalGroupWidth / 2 + stackRadius;
  
  // Stacks are centered vertically inside the ship
  const stackY = 0;
  
  for (let i = 0; i < stackCount; i++) {
    const stackX = startX + i * (stackDiameter + spacing);
    
    // Draw stack as circle
    ctx.beginPath();
    ctx.arc(stackX, stackY, stackRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  
  ctx.restore();
}

// Draw waves (top-down perspective - simple curved lines with random breaks)
function drawWaves() {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  
  const waveSpeed = 0.02;
  
  // Pseudo-random function for consistent breaks
  // Use quantized coordinates to ensure stability
  function shouldDraw(worldX, worldY, seed) {
    // Use larger quantization step to prevent flickering when camera moves
    // Align to a fixed grid that's independent of camera position
    const gridSize = 20; // Larger grid for more stability
    const quantizedX = Math.floor(worldX / gridSize) * gridSize;
    const quantizedY = Math.floor(worldY / gridSize) * gridSize;
    const hash = Math.sin(quantizedX * 0.1 + quantizedY * 0.1 + seed) * 10000;
    return (hash - Math.floor(hash)) > 0.3; // 70% chance to draw
  }
  
  // Calculate visible world bounds
  const screenCenterX = canvas.width / 2;
  const screenCenterY = canvas.height / 2;
  
  // Draw multiple flowing curved wave lines (horizontal)
  // Use fixed world spacing for wave lines
  const waveLineSpacing = 150; // World space spacing between wave lines
  const visibleWorldHeight = canvas.height;
  const visibleWorldWidth = canvas.width;
  
  // Find the first wave line that's visible
  const firstVisibleLineY = Math.floor((camera.y - visibleWorldHeight / 2) / waveLineSpacing) * waveLineSpacing;
  const lastVisibleLineY = camera.y + visibleWorldHeight / 2;
  
  for (let worldY = firstVisibleLineY; worldY <= lastVisibleLineY; worldY += waveLineSpacing) {
    const lineIndex = Math.floor(worldY / waveLineSpacing);
    const phase = (lineIndex * Math.PI) / 3;
    let isDrawing = false;
    
    // Sample at fixed world-space intervals for stability
    // Align to grid to ensure consistent sampling regardless of camera position
    const sampleStep = 2; // World space sampling step
    const gridSize = 20;
    const worldStartX = Math.floor((camera.x - screenCenterX) / gridSize) * gridSize;
    const worldEndX = camera.x + screenCenterX;
    
    for (let worldX = worldStartX; worldX <= worldEndX; worldX += sampleStep) {
      // Calculate wave offset in world space (purely based on world coordinates)
      const waveOffset = Math.sin((worldX * 0.01) + (worldY * 0.008) + (animationTime * waveSpeed) + phase) * 25;
      const worldYWithWave = worldY + waveOffset;
      
      // Convert world coordinates to screen coordinates
      const screenX = worldX - camera.x + screenCenterX;
      const screenY = worldYWithWave - camera.y + screenCenterY;
      
      // Only draw if on screen
      if (screenY >= -50 && screenY <= canvas.height + 50 && screenX >= -50 && screenX <= canvas.width + 50) {
        const shouldContinue = shouldDraw(worldX, worldY, lineIndex * 1000);
        
        if (shouldContinue) {
          if (!isDrawing) {
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            isDrawing = true;
          } else {
            ctx.lineTo(screenX, screenY);
          }
        } else {
          if (isDrawing) {
            ctx.stroke();
            isDrawing = false;
          }
        }
      } else {
        // End line if it goes off screen
        if (isDrawing) {
          ctx.stroke();
          isDrawing = false;
        }
      }
    }
    
    if (isDrawing) {
      ctx.stroke();
    }
  }
  
  // Draw vertical flowing waves
  // Use fixed world spacing for wave lines
  const firstVisibleLineX = Math.floor((camera.x - visibleWorldWidth / 2) / waveLineSpacing) * waveLineSpacing;
  const lastVisibleLineX = camera.x + visibleWorldWidth / 2;
  
  for (let worldX = firstVisibleLineX; worldX <= lastVisibleLineX; worldX += waveLineSpacing) {
    const lineIndex = Math.floor(worldX / waveLineSpacing);
    const phase = (lineIndex * Math.PI) / 2.5;
    let isDrawing = false;
    
    // Sample at fixed world-space intervals for stability
    // Align to grid to ensure consistent sampling regardless of camera position
    const sampleStep = 2; // World space sampling step
    const gridSize = 20;
    const worldStartY = Math.floor((camera.y - screenCenterY) / gridSize) * gridSize;
    const worldEndY = camera.y + screenCenterY;
    
    for (let worldY = worldStartY; worldY <= worldEndY; worldY += sampleStep) {
      // Calculate wave offset in world space (purely based on world coordinates)
      const waveOffset = Math.sin((worldY * 0.01) + (worldX * 0.008) + (animationTime * waveSpeed * 0.8) + phase) * 25;
      const worldXWithWave = worldX + waveOffset;
      
      // Convert world coordinates to screen coordinates
      const screenX = worldXWithWave - camera.x + screenCenterX;
      const screenY = worldY - camera.y + screenCenterY;
      
      // Only draw if on screen
      if (screenX >= -50 && screenX <= canvas.width + 50 && screenY >= -50 && screenY <= canvas.height + 50) {
        const shouldContinue = shouldDraw(worldX, worldY, lineIndex * 2000);
        
        if (shouldContinue) {
          if (!isDrawing) {
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            isDrawing = true;
          } else {
            ctx.lineTo(screenX, screenY);
          }
        } else {
          if (isDrawing) {
            ctx.stroke();
            isDrawing = false;
          }
        }
      } else {
        // End line if it goes off screen
        if (isDrawing) {
          ctx.stroke();
          isDrawing = false;
        }
      }
    }
    
    if (isDrawing) {
      ctx.stroke();
    }
  }
  
  ctx.restore();
}

// Update ship physics
function updateShip(deltaTime) {
  // Handle acceleration input (UP/DOWN control acceleration, not speed directly)
  // But only if we have coal (when coal is 0, no acceleration possible)
  if (currentCoal > 0) {
    if (keys.ArrowUp) {
      // Apply forward acceleration
      ship.acceleration = shipConfig.accelerationPower;
    } else if (keys.ArrowDown) {
      // Apply reverse acceleration (deceleration)
      ship.acceleration = -shipConfig.accelerationPower;
    } else {
      // Gradually reduce acceleration when no input
      if (ship.acceleration > 0) {
        ship.acceleration = Math.max(0, ship.acceleration - shipConfig.accelerationDecay);
      } else if (ship.acceleration < 0) {
        ship.acceleration = Math.min(0, ship.acceleration + shipConfig.accelerationDecay);
      }
    }
  } else {
    // No coal - can't accelerate, just coast to stop
    ship.acceleration = 0;
  }
  
  // Apply acceleration to speed (only if we have coal or decelerating)
  if (ship.acceleration !== 0 && (currentCoal > 0 || ship.acceleration < 0)) {
    ship.speed += ship.acceleration;
    // Clamp speed to limits
    if (ship.speed > shipConfig.maxSpeed) {
      ship.speed = shipConfig.maxSpeed;
    } else if (ship.speed < -shipConfig.maxReverseSpeed) {
      ship.speed = -shipConfig.maxReverseSpeed;
    }
  }
  
  // Apply friction when no acceleration or when at speed limit or when out of coal
  if (ship.acceleration === 0 || 
      currentCoal <= 0 ||
      (ship.acceleration > 0 && ship.speed >= shipConfig.maxSpeed) ||
      (ship.acceleration < 0 && ship.speed <= -shipConfig.maxReverseSpeed)) {
    if (ship.speed > 0) {
      ship.speed = Math.max(0, ship.speed - shipConfig.friction);
    } else if (ship.speed < 0) {
      ship.speed = Math.min(0, ship.speed + shipConfig.friction);
    }
  }
  
  // Handle rudder control
  if (keys.ArrowLeft) {
    ship.rudderAngle = Math.max(
      ship.rudderAngle - shipConfig.rudderSpeed,
      -shipConfig.maxRudderAngle
    );
  } else if (keys.ArrowRight) {
    ship.rudderAngle = Math.min(
      ship.rudderAngle + shipConfig.rudderSpeed,
      shipConfig.maxRudderAngle
    );
  } else {
    // Rudder returns to center
    if (ship.rudderAngle > 0) {
      ship.rudderAngle = Math.max(0, ship.rudderAngle - shipConfig.rudderSpeed);
    } else if (ship.rudderAngle < 0) {
      ship.rudderAngle = Math.min(0, ship.rudderAngle + shipConfig.rudderSpeed);
    }
  }
  
  // Apply turning based on rudder and speed
  // Turning is more effective at higher speeds
  const turnEffectiveness = Math.abs(ship.speed) / shipConfig.maxSpeed;
  const rotationDelta = ship.rudderAngle * shipConfig.turnRate * turnEffectiveness;
  
  // Calculate pivot point offset from ship center
  // pivotPoint: 0.0 = bow, 0.5 = center, 1.0 = stern
  const pivotOffset = (shipConfig.pivotPoint - 0.5) * ship.length;
  const pivotWorldX = camera.x + Math.cos(ship.rotation) * pivotOffset;
  const pivotWorldY = camera.y + Math.sin(ship.rotation) * pivotOffset;
  
  // Rotate ship around pivot point
  ship.rotation += rotationDelta;
  
  // Calculate new pivot position after rotation
  const newPivotWorldX = camera.x + Math.cos(ship.rotation) * pivotOffset;
  const newPivotWorldY = camera.y + Math.sin(ship.rotation) * pivotOffset;
  
  // Adjust camera position to keep pivot point in same world position during rotation
  camera.x += pivotWorldX - newPivotWorldX;
  camera.y += pivotWorldY - newPivotWorldY;
  
  // Move camera (world) forward/backward based on current rotation
  const moveX = Math.cos(ship.rotation) * ship.speed;
  const moveY = Math.sin(ship.rotation) * ship.speed;
  
  // Store old position for distance tracking
  const oldCameraX = camera.x;
  const oldCameraY = camera.y;
  
  // Move freely (no boundaries - open world)
  camera.x += moveX;
  camera.y += moveY;
  
  // Track distance sailed
  const actualMoveX = camera.x - oldCameraX;
  const actualMoveY = camera.y - oldCameraY;
  const distanceThisFrame = Math.sqrt(actualMoveX * actualMoveX + actualMoveY * actualMoveY);
  totalDistance += distanceThisFrame;
  
  // Deplete coal only when moving, proportional to speed
  if (Math.abs(ship.speed) > 0) {
    // Coal depletion is directly proportional to speed
    const speedFactor = Math.abs(ship.speed) / shipConfig.maxSpeed; // 0 to 1
    const coalDepletion = coalConfig.depletionRate * speedFactor;
    currentCoal = Math.max(0, currentCoal - coalDepletion);
  }
}

// Generate icebergs for a chunk
function generateIcebergsForChunk(chunkX, chunkY) {
  const chunkKey = `${chunkX},${chunkY}`;
  if (loadedIcebergChunks.has(chunkKey)) {
    return; // Already generated
  }
  
  loadedIcebergChunks.add(chunkKey);
  
  const chunkWorldX = chunkX * icebergGridSize;
  const chunkWorldY = chunkY * icebergGridSize;
  
  // Calculate icebergs based on screen area density
  // Each chunk is icebergGridSize x icebergGridSize, calculate how many screens that is
  const screenArea = canvas.width * canvas.height;
  const chunkArea = icebergGridSize * icebergGridSize;
  const screensPerChunk = chunkArea / screenArea;
  const expectedCount = Math.floor(screensPerChunk * icebergsConfig.density);
  
  // Use seeded random for consistent generation
  const seed = chunkX * 1000 + chunkY;
  
  for (let i = 0; i < expectedCount; i++) {
    // Pseudo-random position within chunk
    const hash1 = Math.sin((seed + i) * 0.1) * 10000;
    const hash2 = Math.cos((seed + i) * 0.1) * 10000;
    const x = chunkWorldX + (Math.abs(hash1 - Math.floor(hash1)) * icebergGridSize);
    const y = chunkWorldY + (Math.abs(hash2 - Math.floor(hash2)) * icebergGridSize);
    
    // Skip icebergs too close to starting position (safe zone)
    const startSafeRadius = 300; // Safe radius around starting position
    const distFromStart = Math.sqrt(x * x + y * y);
    if (distFromStart < startSafeRadius) {
      continue; // Skip this iceberg
    }
    
    // Pseudo-random size
    const sizeHash = Math.sin((seed + i) * 0.15) * 10000;
    const size = icebergsConfig.minSize + 
                 (Math.abs(sizeHash - Math.floor(sizeHash)) * 
                  (icebergsConfig.maxSize - icebergsConfig.minSize));
    
    // Pseudo-random point count
    const pointsHash = Math.sin((seed + i) * 0.2) * 10000;
    const pointCount = Math.floor(icebergsConfig.minPoints + 
                                  (Math.abs(pointsHash - Math.floor(pointsHash)) * 
                                   (icebergsConfig.maxPoints - icebergsConfig.minPoints)));
    
    icebergs.push({
      x: x,
      y: y,
      size: size,
      pointCount: pointCount,
      seed: seed + i
    });
  }
}

// Ensure icebergs are generated for visible area
function ensureIcebergsGenerated() {
  const screenCenterX = canvas.width / 2;
  const screenCenterY = canvas.height / 2;
  const visibleWorldWidth = canvas.width;
  const visibleWorldHeight = canvas.height;
  
  const minChunkX = Math.floor((camera.x - visibleWorldWidth / 2) / icebergGridSize);
  const maxChunkX = Math.ceil((camera.x + visibleWorldWidth / 2) / icebergGridSize);
  const minChunkY = Math.floor((camera.y - visibleWorldHeight / 2) / icebergGridSize);
  const maxChunkY = Math.ceil((camera.y + visibleWorldHeight / 2) / icebergGridSize);
  
  for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
    for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
      generateIcebergsForChunk(chunkX, chunkY);
    }
  }
}

// Draw a single iceberg
function drawIceberg(iceberg) {
  const screenCenterX = canvas.width / 2;
  const screenCenterY = canvas.height / 2;
  
  // Convert world coordinates to screen coordinates
  const screenX = iceberg.x - camera.x + screenCenterX;
  const screenY = iceberg.y - camera.y + screenCenterY;
  
  // Only draw if on screen
  if (screenX < -iceberg.size || screenX > canvas.width + iceberg.size ||
      screenY < -iceberg.size || screenY > canvas.height + iceberg.size) {
    return;
  }
  
  ctx.save();
  ctx.translate(screenX, screenY);
  
  // Generate irregular shape points
  const points = [];
  const angleStep = (Math.PI * 2) / iceberg.pointCount;
  
  for (let i = 0; i < iceberg.pointCount; i++) {
    const angle = i * angleStep;
    // Add irregularity using seeded random
    const irregularityHash = Math.sin(iceberg.seed * 0.1 + angle) * 10000;
    const irregularity = 1 + (Math.abs(irregularityHash - Math.floor(irregularityHash)) - 0.5) * 
                          icebergsConfig.irregularity * 2;
    const radius = iceberg.size * irregularity;
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  }
  
  // Draw iceberg shape
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  
  // Fill and stroke
  ctx.fillStyle = icebergsConfig.color;
  ctx.fill();
  ctx.strokeStyle = icebergsConfig.strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.restore();
}

// Draw all visible icebergs
function drawIcebergs() {
  const screenCenterX = canvas.width / 2;
  const screenCenterY = canvas.height / 2;
  const visibleWorldWidth = canvas.width;
  const visibleWorldHeight = canvas.height;
  
  const minWorldX = camera.x - visibleWorldWidth / 2;
  const maxWorldX = camera.x + visibleWorldWidth / 2;
  const minWorldY = camera.y - visibleWorldHeight / 2;
  const maxWorldY = camera.y + visibleWorldHeight / 2;
  
  for (const iceberg of icebergs) {
    // Only draw if in visible area
    if (iceberg.x >= minWorldX - iceberg.size &&
        iceberg.x <= maxWorldX + iceberg.size &&
        iceberg.y >= minWorldY - iceberg.size &&
        iceberg.y <= maxWorldY + iceberg.size) {
      drawIceberg(iceberg);
    }
  }
}

// Generate start port on edge of world
function generateStartPort() {
  const offset = goalConfig.edgeOffset;
  
  // Randomly choose which edge (0=top, 1=right, 2=bottom, 3=left)
  const edge = Math.floor(Math.random() * 4);
  
  switch (edge) {
    case 0: // Top edge
      startPort.x = offset + Math.random() * (worldConfig.width - offset * 2);
      startPort.y = offset;
      break;
    case 1: // Right edge
      startPort.x = worldConfig.width - offset;
      startPort.y = offset + Math.random() * (worldConfig.height - offset * 2);
      break;
    case 2: // Bottom edge
      startPort.x = offset + Math.random() * (worldConfig.width - offset * 2);
      startPort.y = worldConfig.height - offset;
      break;
    case 3: // Left edge
      startPort.x = offset;
      startPort.y = offset + Math.random() * (worldConfig.height - offset * 2);
      break;
  }
  
  startPort.generated = true;
  
  // Position ship near start port (slightly away from the port)
  const shipOffset = goalConfig.radius + 50;
  camera.x = startPort.x + (Math.random() - 0.5) * shipOffset * 0.5;
  camera.y = startPort.y + (Math.random() - 0.5) * shipOffset * 0.5;
}

// Generate goal on edge of world (different edge from start port)
function generateGoal() {
  const offset = goalConfig.edgeOffset;
  
  // Get start port edge
  let startPortEdge = -1;
  if (startPort.generated) {
    if (startPort.y <= offset + 10) startPortEdge = 0; // Top
    else if (startPort.x >= worldConfig.width - offset - 10) startPortEdge = 1; // Right
    else if (startPort.y >= worldConfig.height - offset - 10) startPortEdge = 2; // Bottom
    else if (startPort.x <= offset + 10) startPortEdge = 3; // Left
  }
  
  // Choose a different edge for goal
  let edge;
  do {
    edge = Math.floor(Math.random() * 4);
  } while (edge === startPortEdge && startPort.generated);
  
  switch (edge) {
    case 0: // Top edge
      goal.x = offset + Math.random() * (worldConfig.width - offset * 2);
      goal.y = offset;
      break;
    case 1: // Right edge
      goal.x = worldConfig.width - offset;
      goal.y = offset + Math.random() * (worldConfig.height - offset * 2);
      break;
    case 2: // Bottom edge
      goal.x = offset + Math.random() * (worldConfig.width - offset * 2);
      goal.y = worldConfig.height - offset;
      break;
    case 3: // Left edge
      goal.x = offset;
      goal.y = offset + Math.random() * (worldConfig.height - offset * 2);
      break;
  }
  
  goal.generated = true;
}

// Check if ship reached the goal
function checkGoalReached() {
  if (gameOver || gameWon || !goal.generated) return;
  
  // Ship position in world space (camera position)
  const shipWorldX = camera.x;
  const shipWorldY = camera.y;
  
  // Calculate distance to goal center
  const dx = shipWorldX - goal.x;
  const dy = shipWorldY - goal.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Check if ship is within goal radius
  if (distance < goalConfig.radius) {
    gameWon = true;
    gameRunning = false;
    winTime = performance.now(); // Store the win time
  }
}

// Draw start port (island with port)
function drawStartPort() {
  if (!startPort.generated) return;
  
  const screenCenterX = canvas.width / 2;
  const screenCenterY = canvas.height / 2;
  
  // Convert start port world position to screen position
  const portScreenX = startPort.x - camera.x + screenCenterX;
  const portScreenY = startPort.y - camera.y + screenCenterY;
  
  // Only draw if on screen (with some margin)
  const margin = goalConfig.radius + 50;
  if (portScreenX < -margin || portScreenX > canvas.width + margin ||
      portScreenY < -margin || portScreenY > canvas.height + margin) {
    return;
  }
  
  // Draw the same island design as goal (reuse the drawing code)
  drawIsland(portScreenX, portScreenY, '#6B8E23'); // Use olive green color to differentiate
}

// Draw island (reusable function for both start port and goal)
function drawIsland(screenX, screenY, accentColor = '#4caf50') {
  ctx.save();
  ctx.translate(screenX, screenY);
  
  const islandSize = goalConfig.radius;
  
  // Draw island (irregular oval shape - bigger)
  ctx.fillStyle = '#8B7355'; // Sandy brown
  ctx.beginPath();
  ctx.ellipse(0, 0, islandSize * 0.9, islandSize * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Island outline
  ctx.strokeStyle = '#6B5D45';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Draw beach/sand area
  ctx.fillStyle = '#D2B48C';
  ctx.beginPath();
  ctx.ellipse(0, islandSize * 0.5, islandSize * 0.7, islandSize * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw trees/vegetation on island (more detailed)
  ctx.fillStyle = '#2d5016'; // Dark green for tree trunks
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const dist = islandSize * (0.3 + (i % 3) * 0.15);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    
    // Tree trunk
    ctx.fillRect(x - 3, y, 6, 12);
    
    // Tree foliage
    ctx.fillStyle = '#3a7c42';
    ctx.beginPath();
    ctx.arc(x, y - 5, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d5016'; // Reset for next trunk
  }
  
  // Draw dock/pier (extending from island - more detailed)
  ctx.fillStyle = '#654321'; // Brown wood
  const dockWidth = islandSize * 0.7;
  const dockHeight = islandSize * 0.25;
  ctx.fillRect(-dockWidth / 2, islandSize * 0.45, dockWidth, dockHeight);
  ctx.strokeStyle = '#543210';
  ctx.lineWidth = 2;
  ctx.strokeRect(-dockWidth / 2, islandSize * 0.45, dockWidth, dockHeight);
  
  // Draw dock planks (wooden planks detail)
  ctx.strokeStyle = '#543210';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const x = -dockWidth / 2 + (i * dockWidth / 6);
    ctx.beginPath();
    ctx.moveTo(x, islandSize * 0.45);
    ctx.lineTo(x, islandSize * 0.45 + dockHeight);
    ctx.stroke();
  }
  
  // Draw dock posts (more posts)
  ctx.fillStyle = '#4a3428';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(-dockWidth / 2 + (i + 2) * (dockWidth / 5) - 2, islandSize * 0.45, 4, dockHeight);
  }
  
  // Draw small boats at dock
  // Boat 1
  ctx.fillStyle = '#8B6F47';
  ctx.fillRect(-islandSize * 0.25, islandSize * 0.5, islandSize * 0.15, islandSize * 0.08);
  ctx.strokeStyle = '#654321';
  ctx.lineWidth = 1;
  ctx.strokeRect(-islandSize * 0.25, islandSize * 0.5, islandSize * 0.15, islandSize * 0.08);
  // Boat mast
  ctx.fillStyle = '#654321';
  ctx.fillRect(-islandSize * 0.175, islandSize * 0.5, 2, -islandSize * 0.1);
  
  // Boat 2
  ctx.fillStyle = '#8B6F47';
  ctx.fillRect(islandSize * 0.1, islandSize * 0.52, islandSize * 0.12, islandSize * 0.06);
  ctx.strokeStyle = '#654321';
  ctx.strokeRect(islandSize * 0.1, islandSize * 0.52, islandSize * 0.12, islandSize * 0.06);
  
  // Draw port buildings (more buildings)
  // Building 1 (left - warehouse)
  ctx.fillStyle = '#d4a574'; // Light brown/tan
  ctx.fillRect(-islandSize * 0.6, -islandSize * 0.2, islandSize * 0.3, islandSize * 0.35);
  ctx.strokeStyle = '#8B6F47';
  ctx.lineWidth = 2;
  ctx.strokeRect(-islandSize * 0.6, -islandSize * 0.2, islandSize * 0.3, islandSize * 0.35);
  
  // Building 1 roof
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.moveTo(-islandSize * 0.6, -islandSize * 0.2);
  ctx.lineTo(-islandSize * 0.45, -islandSize * 0.35);
  ctx.lineTo(-islandSize * 0.3, -islandSize * 0.2);
  ctx.closePath();
  ctx.fill();
  
  // Building 1 windows
  ctx.fillStyle = '#4a90e2';
  ctx.fillRect(-islandSize * 0.55, -islandSize * 0.1, 8, 10);
  ctx.fillRect(-islandSize * 0.45, -islandSize * 0.1, 8, 10);
  ctx.fillRect(-islandSize * 0.35, -islandSize * 0.1, 8, 10);
  
  // Building 2 (center - office)
  ctx.fillStyle = '#e8d5b7';
  ctx.fillRect(-islandSize * 0.15, -islandSize * 0.15, islandSize * 0.3, islandSize * 0.3);
  ctx.strokeStyle = '#8B6F47';
  ctx.strokeRect(-islandSize * 0.15, -islandSize * 0.15, islandSize * 0.3, islandSize * 0.3);
  
  // Building 2 roof
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.moveTo(-islandSize * 0.15, -islandSize * 0.15);
  ctx.lineTo(0, -islandSize * 0.3);
  ctx.lineTo(islandSize * 0.15, -islandSize * 0.15);
  ctx.closePath();
  ctx.fill();
  
  // Building 2 door
  ctx.fillStyle = '#654321';
  ctx.fillRect(-islandSize * 0.05, 0, islandSize * 0.1, islandSize * 0.15);
  
  // Building 2 windows
  ctx.fillStyle = '#4a90e2';
  ctx.fillRect(-islandSize * 0.1, -islandSize * 0.05, 8, 8);
  ctx.fillRect(islandSize * 0.02, -islandSize * 0.05, 8, 8);
  
  // Building 3 (right - storage)
  ctx.fillStyle = '#c9a876';
  ctx.fillRect(islandSize * 0.3, -islandSize * 0.25, islandSize * 0.28, islandSize * 0.28);
  ctx.strokeStyle = '#8B6F47';
  ctx.strokeRect(islandSize * 0.3, -islandSize * 0.25, islandSize * 0.28, islandSize * 0.28);
  
  // Building 3 roof
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.moveTo(islandSize * 0.3, -islandSize * 0.25);
  ctx.lineTo(islandSize * 0.44, -islandSize * 0.38);
  ctx.lineTo(islandSize * 0.58, -islandSize * 0.25);
  ctx.closePath();
  ctx.fill();
  
  // Draw lighthouse (taller and more detailed)
  const lighthouseX = 0;
  const lighthouseY = -islandSize * 0.6;
  
  // Lighthouse base
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(lighthouseX - islandSize * 0.12, lighthouseY, islandSize * 0.24, islandSize * 0.4);
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 2;
  ctx.strokeRect(lighthouseX - islandSize * 0.12, lighthouseY, islandSize * 0.24, islandSize * 0.4);
  
  // Lighthouse stripes (red and white)
  ctx.fillStyle = '#d32f2f';
  ctx.fillRect(lighthouseX - islandSize * 0.12, lighthouseY + islandSize * 0.1, islandSize * 0.24, islandSize * 0.08);
  ctx.fillRect(lighthouseX - islandSize * 0.12, lighthouseY + islandSize * 0.25, islandSize * 0.24, islandSize * 0.08);
  
  // Lighthouse top (red dome)
  ctx.fillStyle = '#d32f2f';
  ctx.beginPath();
  ctx.arc(lighthouseX, lighthouseY, islandSize * 0.12, 0, Math.PI * 2);
  ctx.fill();
  
  // Lighthouse light (pulsing)
  const lightPulse = Math.sin(animationTime * 0.2) * 0.4 + 0.6;
  ctx.fillStyle = `rgba(255, 255, 200, ${lightPulse})`;
  ctx.beginPath();
  ctx.arc(lighthouseX, lighthouseY, islandSize * 0.18, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw flag on lighthouse
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(lighthouseX + islandSize * 0.12, lighthouseY - islandSize * 0.05, islandSize * 0.08, islandSize * 0.06);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(lighthouseX + islandSize * 0.12, lighthouseY - islandSize * 0.05, islandSize * 0.08, islandSize * 0.06);
  
  // Draw crane/loading equipment
  ctx.strokeStyle = '#654321';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-islandSize * 0.4, islandSize * 0.2);
  ctx.lineTo(-islandSize * 0.4, islandSize * 0.35);
  ctx.lineTo(-islandSize * 0.2, islandSize * 0.35);
  ctx.stroke();
  
  // Crane hook
  ctx.fillStyle = '#333333';
  ctx.fillRect(-islandSize * 0.22, islandSize * 0.33, 4, 8);
  
  ctx.restore();
}

// Draw goal area (island with port)
function drawGoal() {
  if (!goal.generated) return;
  
  const screenCenterX = canvas.width / 2;
  const screenCenterY = canvas.height / 2;
  
  // Convert goal world position to screen position
  const goalScreenX = goal.x - camera.x + screenCenterX;
  const goalScreenY = goal.y - camera.y + screenCenterY;
  
  // Only draw if on screen (with some margin)
  const margin = goalConfig.radius + 50;
  if (goalScreenX < -margin || goalScreenX > canvas.width + margin ||
      goalScreenY < -margin || goalScreenY > canvas.height + margin) {
    return;
  }
  
  // Draw the island using the reusable function
  drawIsland(goalScreenX, goalScreenY, '#4caf50');
}

// Check collision between ship and icebergs
function checkCollisions() {
  if (gameOver || gameWon) return;
  
  // Ship position in world space (camera position)
  const shipWorldX = camera.x;
  const shipWorldY = camera.y;
  
  // Ship collision radius (approximate as circle using ship width/2 for more accurate collision)
  const shipRadius = ship.width / 2;
  
  // Only check icebergs that are nearby (within reasonable distance)
  const maxCheckDistance = ship.length + icebergsConfig.maxSize + 50;
  
  // Check collision with nearby icebergs only
  for (const iceberg of icebergs) {
    // Quick distance check first (avoid expensive sqrt if far away)
    const dx = shipWorldX - iceberg.x;
    const dy = shipWorldY - iceberg.y;
    const distanceSquared = dx * dx + dy * dy;
    
    // Skip if too far away
    if (distanceSquared > maxCheckDistance * maxCheckDistance) {
      continue;
    }
    
    // Calculate actual distance
    const distance = Math.sqrt(distanceSquared);
    
    // Collision if distance is less than sum of radii
    const icebergRadius = iceberg.size;
    if (distance < shipRadius + icebergRadius) {
      gameOver = true;
      gameRunning = false;
      return;
    }
  }
}

// Draw win screen
function drawWinScreen() {
  if (!gameWon) return;
  
  // Calculate elapsed time (use winTime if set, otherwise current time)
  const endTime = winTime > 0 ? winTime : performance.now();
  const elapsedTime = (endTime - gameStartTime) / 1000; // Convert to seconds
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = Math.floor(elapsedTime % 60);
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Win text
  ctx.save();
  ctx.fillStyle = '#4caf50';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YOU WIN!', canvas.width / 2, canvas.height / 2 - 100);
  
  // Time text
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px Arial';
  ctx.fillText(`Time: ${timeString}`, canvas.width / 2, canvas.height / 2 - 50);
  
  // Stats
  const speedInKnots = Math.abs(ship.speed) * 10;
  const distanceInNauticalMiles = totalDistance * 0.01;
  ctx.fillText(`Distance: ${distanceInNauticalMiles.toFixed(2)} nm`, canvas.width / 2, canvas.height / 2 - 20);
  
  // Restart button
  const buttonX = canvas.width / 2;
  const buttonY = canvas.height / 2 + 60;
  const buttonWidth = 200;
  const buttonHeight = 50;
  
  // Button background
  ctx.fillStyle = '#4a90e2';
  ctx.fillRect(buttonX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight);
  
  // Button border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(buttonX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight);
  
  // Button text
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px Arial';
  ctx.fillText('Play Again', buttonX, buttonY);
  
  ctx.restore();
  
  // Store button bounds for click detection
  gameOverButton = {
    x: buttonX - buttonWidth / 2,
    y: buttonY - buttonHeight / 2,
    width: buttonWidth,
    height: buttonHeight
  };
}

// Draw game over overlay
function drawGameOver() {
  if (!gameOver) return;
  
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Game Over text
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 100);
  
  // Calculate final stats
  const speedInKnots = Math.abs(ship.speed) * 10;
  const distanceInNauticalMiles = totalDistance * 0.01;
  
  // Stats text
  ctx.font = '20px Arial';
  ctx.fillText(`Final Speed: ${speedInKnots.toFixed(1)} knots`, canvas.width / 2, canvas.height / 2 - 50);
  ctx.fillText(`Distance Traveled: ${distanceInNauticalMiles.toFixed(2)} nm`, canvas.width / 2, canvas.height / 2 - 20);
  
  // Restart button
  const buttonX = canvas.width / 2;
  const buttonY = canvas.height / 2 + 60;
  const buttonWidth = 200;
  const buttonHeight = 50;
  
  // Button background
  ctx.fillStyle = '#4a90e2';
  ctx.fillRect(buttonX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight);
  
  // Button border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(buttonX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight);
  
  // Button text
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px Arial';
  ctx.fillText('Play Again', buttonX, buttonY);
  
  ctx.restore();
  
  // Store button bounds for click detection
  gameOverButton = {
    x: buttonX - buttonWidth / 2,
    y: buttonY - buttonHeight / 2,
    width: buttonWidth,
    height: buttonHeight
  };
}

// Restart game
function restartGame() {
  gameOver = false;
  gameWon = false;
  gameRunning = true;
  
  // Clear all pressed keys to prevent stuck keys from affecting restart
  keys.ArrowUp = false;
  keys.ArrowDown = false;
  keys.ArrowLeft = false;
  keys.ArrowRight = false;
  
  // Reset ship state
  ship.rotation = -Math.PI / 2;
  ship.speed = 0;
  ship.acceleration = 0;
  ship.rudderAngle = 0;
  
  // Reset start port and goal
  startPort.generated = false;
  goal.generated = false;
  
  // Clear icebergs and regenerate
  icebergs.length = 0;
  loadedIcebergChunks.clear();
  
  // Generate start port (this will also position the camera near the start port) and goal
  generateStartPort();
  generateGoal();
  
  // Reset animation and timing
  animationTime = 0;
  totalDistance = 0;
  currentCoal = coalConfig.maxCoal;
  gameStartTime = performance.now();
  winTime = 0; // Reset win time
  lastTime = performance.now();
  
  // Note: Don't call gameLoop() here - it's already running via requestAnimationFrame
}

// Game over button bounds (for click detection)
let gameOverButton = null;

// Handle mouse clicks for restart button
canvas.addEventListener('click', (e) => {
  if ((!gameOver && !gameWon) || !gameOverButton) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  if (x >= gameOverButton.x &&
      x <= gameOverButton.x + gameOverButton.width &&
      y >= gameOverButton.y &&
      y <= gameOverButton.y + gameOverButton.height) {
    restartGame();
  }
});

// Draw UI overlay with ship info
function drawUI() {
  if (gameOver || gameWon) return;
  
  ctx.save();
  
  // Speed conversion: 1 unit of speed ≈ 10 knots (adjust as needed)
  const speedInKnots = Math.abs(ship.speed) * 10;
  
  // Format distance (convert to nautical miles, 1 unit ≈ 0.01 nautical miles)
  const distanceInNauticalMiles = totalDistance * 0.01;
  
  // UI panel background
  const panelX = 20;
  const panelY = 20;
  const panelWidth = 200;
  const panelHeight = 110;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
  
  // Text styling
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  // Speed display
  ctx.fillText(`Speed: ${speedInKnots.toFixed(1)} knots`, panelX + 10, panelY + 15);
  
  // Distance display
  ctx.fillText(`Distance: ${distanceInNauticalMiles.toFixed(2)} nm`, panelX + 10, panelY + 40);
  
  // Coal indicator
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Coal:', panelX + 10, panelY + 70);
  
  // Coal bar background
  const barX = panelX + 10;
  const barY = panelY + 90;
  const barWidth = 180;
  const barHeight = 12;
  
  ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
  ctx.fillRect(barX, barY, barWidth, barHeight);
  
  // Coal bar fill (color based on percentage)
  const coalPercentage = (currentCoal / coalConfig.maxCoal) * 100;
  const fillWidth = (coalPercentage / 100) * barWidth;
  
  // Color coding: green (100-70%), yellow (70-20%), red (<20%)
  if (coalPercentage >= 70) {
    ctx.fillStyle = '#4caf50'; // Green
  } else if (coalPercentage >= 20) {
    ctx.fillStyle = '#ffeb3b'; // Yellow
  } else {
    ctx.fillStyle = '#f44336'; // Red
  }
  
  ctx.fillRect(barX, barY, fillWidth, barHeight);
  
  // Bar border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
  
  // Coal percentage text
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${coalPercentage.toFixed(0)}%`, barX + barWidth / 2, barY + barHeight / 2 + 4);
  
  ctx.restore();
}

// Draw ice barriers at world edges
function drawIceBarriers() {
  const screenCenterX = canvas.width / 2;
  const screenCenterY = canvas.height / 2;
  
  ctx.save();
  ctx.fillStyle = '#b0d4e8'; // Light blue-white ice color
  ctx.strokeStyle = '#8bb8d0';
  ctx.lineWidth = 2;
  
  const barrierWidth = worldConfig.iceBarrierWidth;
  
  // Top barrier (world Y from 0 to barrierWidth)
  const topBarrierWorldStart = 0;
  const topBarrierWorldEnd = barrierWidth;
  const topBarrierScreenStart = topBarrierWorldStart - camera.y + screenCenterY;
  const topBarrierScreenEnd = topBarrierWorldEnd - camera.y + screenCenterY;
  
  if (topBarrierScreenEnd > 0 && topBarrierScreenStart < canvas.height) {
    const drawStart = Math.max(0, topBarrierScreenStart);
    const drawEnd = Math.min(canvas.height, topBarrierScreenEnd);
    const drawHeight = drawEnd - drawStart;
    if (drawHeight > 0) {
      ctx.fillRect(0, drawStart, canvas.width, drawHeight);
      ctx.strokeRect(0, drawStart, canvas.width, drawHeight);
    }
  }
  
  // Bottom barrier (world Y from height-barrierWidth to height)
  const bottomBarrierWorldStart = worldConfig.height - barrierWidth;
  const bottomBarrierWorldEnd = worldConfig.height;
  const bottomBarrierScreenStart = bottomBarrierWorldStart - camera.y + screenCenterY;
  const bottomBarrierScreenEnd = bottomBarrierWorldEnd - camera.y + screenCenterY;
  
  if (bottomBarrierScreenEnd > 0 && bottomBarrierScreenStart < canvas.height) {
    const drawStart = Math.max(0, bottomBarrierScreenStart);
    const drawEnd = Math.min(canvas.height, bottomBarrierScreenEnd);
    const drawHeight = drawEnd - drawStart;
    if (drawHeight > 0) {
      ctx.fillRect(0, drawStart, canvas.width, drawHeight);
      ctx.strokeRect(0, drawStart, canvas.width, drawHeight);
    }
  }
  
  // Left barrier (world X from 0 to barrierWidth)
  const leftBarrierWorldStart = 0;
  const leftBarrierWorldEnd = barrierWidth;
  const leftBarrierScreenStart = leftBarrierWorldStart - camera.x + screenCenterX;
  const leftBarrierScreenEnd = leftBarrierWorldEnd - camera.x + screenCenterX;
  
  if (leftBarrierScreenEnd > 0 && leftBarrierScreenStart < canvas.width) {
    const drawStart = Math.max(0, leftBarrierScreenStart);
    const drawEnd = Math.min(canvas.width, leftBarrierScreenEnd);
    const drawWidth = drawEnd - drawStart;
    if (drawWidth > 0) {
      ctx.fillRect(drawStart, 0, drawWidth, canvas.height);
      ctx.strokeRect(drawStart, 0, drawWidth, canvas.height);
    }
  }
  
  // Right barrier (world X from width-barrierWidth to width)
  const rightBarrierWorldStart = worldConfig.width - barrierWidth;
  const rightBarrierWorldEnd = worldConfig.width;
  const rightBarrierScreenStart = rightBarrierWorldStart - camera.x + screenCenterX;
  const rightBarrierScreenEnd = rightBarrierWorldEnd - camera.x + screenCenterX;
  
  if (rightBarrierScreenEnd > 0 && rightBarrierScreenStart < canvas.width) {
    const drawStart = Math.max(0, rightBarrierScreenStart);
    const drawEnd = Math.min(canvas.width, rightBarrierScreenEnd);
    const drawWidth = drawEnd - drawStart;
    if (drawWidth > 0) {
      ctx.fillRect(drawStart, 0, drawWidth, canvas.height);
      ctx.strokeRect(drawStart, 0, drawWidth, canvas.height);
    }
  }
  
  ctx.restore();
}

// Draw minimap in upper right corner
function drawMinimap() {
  if (gameOver) return;
  
  ctx.save();
  
  const minimapSize = 200;
  const minimapX = canvas.width - minimapSize - 20;
  const minimapY = 20;
  const padding = 10;
  const mapSize = minimapSize - padding * 2;
  
  // Minimap background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
  
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);
  
  // Calculate world to minimap scale
  const scaleX = mapSize / worldConfig.width;
  const scaleY = mapSize / worldConfig.height;
  const scale = Math.min(scaleX, scaleY); // Use smaller scale to fit both dimensions
  
  const mapOffsetX = minimapX + padding;
  const mapOffsetY = minimapY + padding;
  
  // Draw world boundaries (optional - can be removed for truly infinite world)
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 1;
  ctx.strokeRect(mapOffsetX, mapOffsetY, worldConfig.width * scale, worldConfig.height * scale);
  
  // Draw start port on minimap
  if (startPort.generated) {
    const startPortMapX = mapOffsetX + startPort.x * scale;
    const startPortMapY = mapOffsetY + startPort.y * scale;
    
    ctx.fillStyle = '#6B8E23'; // Olive green for start port
    ctx.beginPath();
    ctx.arc(startPortMapX, startPortMapY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Start port radius indicator
    ctx.strokeStyle = '#6B8E23';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(startPortMapX, startPortMapY, goalConfig.radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Draw goal on minimap
  if (goal.generated) {
    const goalMapX = mapOffsetX + goal.x * scale;
    const goalMapY = mapOffsetY + goal.y * scale;
    
    ctx.fillStyle = '#4caf50'; // Green for goal
    ctx.beginPath();
    ctx.arc(goalMapX, goalMapY, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Goal radius indicator
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(goalMapX, goalMapY, goalConfig.radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Draw ship position
  const shipMapX = mapOffsetX + camera.x * scale;
  const shipMapY = mapOffsetY + camera.y * scale;
  
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(shipMapX, shipMapY, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw ship direction indicator
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(shipMapX, shipMapY);
  const indicatorLength = 8;
  ctx.lineTo(
    shipMapX + Math.cos(ship.rotation) * indicatorLength,
    shipMapY + Math.sin(ship.rotation) * indicatorLength
  );
  ctx.stroke();
  
  // Minimap label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Map', minimapX + 10, minimapY + 10);
  
  ctx.restore();
}

// Draw ship (always at screen center)
function drawShip() {
  // Ship is always at screen center
  ship.screenX = canvas.width / 2;
  ship.screenY = canvas.height / 2;
  
  // Draw hull
  drawShipHull(ship.screenX, ship.screenY, ship.length, ship.width, ship.rotation);
  
  // Draw top structure (white superstructure)
  drawTopStructure(ship.screenX, ship.screenY, ship.length, ship.width, ship.rotation);
  
  // Draw smokestacks
  drawSmokestacks(
    ship.screenX,
    ship.screenY,
    ship.length,
    ship.stackCount,
    ship.stackRadius,
    ship.rotation
  );
}

// Game loop
let lastTime = performance.now();

function gameLoop(currentTime) {
  if (!gameRunning && !gameOver && !gameWon) return;

  // Calculate delta time for consistent physics
  const deltaTime = Math.min((currentTime - lastTime) / 16.67, 2); // Cap at 2x normal speed
  lastTime = currentTime;

  // Update animation time
  animationTime += 0.5;

  // Update ship physics (only if game is running)
  if (!gameOver && !gameWon) {
    updateShip(deltaTime);
    
    // Ensure icebergs are generated for visible area
    ensureIcebergsGenerated();
    
    // Check for collisions
    checkCollisions();
    
    // Check if goal reached
    checkGoalReached();
  }

  // Clear canvas (lighter ocean blue)
  ctx.fillStyle = '#2a4a6a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw waves
  drawWaves();

  // Draw icebergs
  drawIcebergs();

  // Draw start port
  drawStartPort();

  // Draw goal
  drawGoal();

  // Draw ship
  drawShip();
  
  // Draw UI overlay
  drawUI();
  
  // Draw minimap
  drawMinimap();
  
  // Draw win screen if won
  drawWinScreen();
  
  // Draw game over overlay if game is over
  drawGameOver();

  // Continue game loop
  requestAnimationFrame(gameLoop);
}

// Initialize start port and goal on first game start
generateStartPort();
generateGoal();
gameStartTime = performance.now();

// Start game loop
gameLoop();

