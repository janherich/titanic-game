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
let animationTime = 0;

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

// Camera/World state
const camera = {
  x: 0, // World X position (ship's world position)
  y: 0  // World Y position (ship's world position)
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
  
  // Apply acceleration to speed
  if (ship.acceleration !== 0) {
    ship.speed += ship.acceleration;
    // Clamp speed to limits
    if (ship.speed > shipConfig.maxSpeed) {
      ship.speed = shipConfig.maxSpeed;
    } else if (ship.speed < -shipConfig.maxReverseSpeed) {
      ship.speed = -shipConfig.maxReverseSpeed;
    }
  }
  
  // Apply friction when no acceleration or when at speed limit
  if (ship.acceleration === 0 || 
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
  camera.x += Math.cos(ship.rotation) * ship.speed;
  camera.y += Math.sin(ship.rotation) * ship.speed;
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

// Check collision between ship and icebergs
function checkCollisions() {
  if (gameOver) return;
  
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
  ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 40);
  
  // Restart button
  const buttonX = canvas.width / 2;
  const buttonY = canvas.height / 2 + 40;
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
  
  // Reset camera
  camera.x = 0;
  camera.y = 0;
  
  // Clear icebergs and regenerate
  icebergs.length = 0;
  loadedIcebergChunks.clear();
  
  // Reset animation
  animationTime = 0;
  lastTime = performance.now();
  
  // Note: Don't call gameLoop() here - it's already running via requestAnimationFrame
}

// Game over button bounds (for click detection)
let gameOverButton = null;

// Handle mouse clicks for restart button
canvas.addEventListener('click', (e) => {
  if (!gameOver || !gameOverButton) return;
  
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
  if (!gameRunning && !gameOver) return;

  // Calculate delta time for consistent physics
  const deltaTime = Math.min((currentTime - lastTime) / 16.67, 2); // Cap at 2x normal speed
  lastTime = currentTime;

  // Update animation time
  animationTime += 0.5;

  // Update ship physics (only if game is running)
  if (!gameOver) {
    updateShip(deltaTime);
    
    // Ensure icebergs are generated for visible area
    ensureIcebergsGenerated();
    
    // Check for collisions
    checkCollisions();
  }

  // Clear canvas (lighter ocean blue)
  ctx.fillStyle = '#2a4a6a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw waves
  drawWaves();

  // Draw icebergs
  drawIcebergs();

  // Draw ship
  drawShip();
  
  // Draw game over overlay if game is over
  drawGameOver();

  // Continue game loop
  requestAnimationFrame(gameLoop);
}

// Start game loop
gameLoop();

