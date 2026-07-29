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
  // Handle ship cycling with 'a' key
  if (e.key === 'a' || e.key === 'A') {
    cycleShipType();
    e.preventDefault();
    return;
  }
  
  // Handle submerged mode toggle with 's' key (submarines only)
  if ((e.key === 's' || e.key === 'S') && ship.category === 'Submarines') {
    ship.isSubmerged = !ship.isSubmerged;
    e.preventDefault();
    return;
  }
  
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

// Ship types configuration - organized by categories
// To add a new ship, add it to the appropriate category with visual and physics properties
const shipTypes = {
  Steamers: {
    '4-Stack Steamer': {
      visual: {
        length: 200,
        width: 60,
        stackCount: 4,
        stackRadius: 10,
        style: {
          hullProfile: 'classic',
          hullColor: '#17222c',
          deckColor: '#b78351',
          accentColor: '#d7b46a',
          funnelColor: '#d39a43',
          superstructureColor: '#f3f0e7',
          superstructureLength: 0.58,
          superstructureWidth: 0.44,
          lifeboatCount: 5
        }
      },
      physics: {
        maxSpeed: 3.5,
        maxReverseSpeed: 0.8,
        accelerationPower: 0.03,
        accelerationDecay: 0.08,
        friction: 0.02,
        maxRudderAngle: Math.PI / 6, // 30 degrees
        rudderSpeed: 0.03,
        turnRate: 0.02,
        pivotPoint: 0.7
      }
    },
    'SS Normandie': {
      visual: {
        length: 280, // 40% longer
        width: 60,
        stackCount: 3, // Different number of stacks
        stackRadius: 12, // Slightly larger stacks
        style: {
          hullProfile: 'streamlined',
          hullColor: '#18232b',
          deckColor: '#c39768',
          accentColor: '#d95247',
          funnelColor: '#c84b42',
          superstructureColor: '#f4f1e9',
          superstructureLength: 0.63,
          superstructureWidth: 0.46,
          lifeboatCount: 7
        }
      },
      physics: {
        maxSpeed: 5.0, // Much faster
        maxReverseSpeed: 1.2,
        accelerationPower: 0.04, // Better acceleration
        accelerationDecay: 0.08,
        friction: 0.018, // Slightly less friction
        maxRudderAngle: Math.PI / 6,
        rudderSpeed: 0.035, // More responsive rudder
        turnRate: 0.025, // Better turning
        pivotPoint: 0.65 // Slightly different pivot
      }
    },
    'SS United States': {
      visual: {
        length: 270, // Long and sleek
        width: 50,   // Narrower for speed
        stackCount: 2, // Only 2 stacks
        stackRadius: 10, // Larger stacks
        style: {
          hullProfile: 'streamlined',
          hullColor: '#162736',
          deckColor: '#a6764e',
          accentColor: '#e14f4a',
          funnelColor: '#d9433f',
          superstructureColor: '#f5f6f3',
          superstructureLength: 0.6,
          superstructureWidth: 0.48,
          lifeboatCount: 6
        }
      },
      physics: {
        maxSpeed: 6.5, // Fastest ship
        maxReverseSpeed: 1.5,
        accelerationPower: 0.05, // Excellent acceleration
        accelerationDecay: 0.08,
        friction: 0.015, // Less friction for speed
        maxRudderAngle: Math.PI / 6,
        rudderSpeed: 0.04, // Very responsive rudder
        turnRate: 0.03, // Excellent turning
        pivotPoint: 0.6 // Forward pivot for agility
      }
    },
    'Costa Concordia': {
      visual: {
        length: 320,
        width: 90,
        stackCount: 1,
        stackRadius: 20,
        style: {
          hullProfile: 'cruise',
          hullColor: '#dfe6e8',
          deckColor: '#bca581',
          accentColor: '#277aa2',
          funnelColor: '#f1c847',
          superstructureColor: '#f8faf9',
          superstructureLength: 0.72,
          superstructureWidth: 0.66,
          lifeboatCount: 8
        }
      },
      physics: {
        maxSpeed: 3.0,
        maxReverseSpeed: 1.5,
        accelerationPower: 0.02,
        accelerationDecay: 0.08,
        friction: 0.025,
        maxRudderAngle: Math.PI / 6,
        rudderSpeed: 0.01,
        turnRate: 0.01,
        pivotPoint: 0.5
      }
    }
  },
  Submarines: {
    'Type VII': {
      visual: {
        length: 220, // Typical Type VII length
        width: 50,  // Narrower than surface ships
        conningTowerSize: 12, // Size of conning tower (rendered as elongated cylinder)
        style: {
          hullColor: '#202b30',
          deckColor: '#354247',
          accentColor: '#849398'
        }
      },
      physics: {
        maxSpeed: 4.5, // Surface speed
        maxReverseSpeed: 1.0,
        maxSubmergedSpeed: 3.0, // Submerged speed (slower)
        maxSubmergedReverseSpeed: 0.8, // Submerged reverse speed
        accelerationPower: 0.035,
        accelerationDecay: 0.08,
        friction: 0.016, // Less friction (streamlined)
        maxRudderAngle: Math.PI / 5, // 36 degrees - more maneuverable
        rudderSpeed: 0.04,
        turnRate: 0.028, // Better turning than most ships
        pivotPoint: 0.55 // Slightly forward pivot
      }
    }
  }
};

// Current ship type (format: { category: 'Steamers', name: '4-Stack Steamer' })
let currentShipType = { category: 'Steamers', name: '4-Stack Steamer' };

// Ship physics configuration (will be set from shipTypes)
const shipConfig = {
  maxSpeed: 3.5,
  maxReverseSpeed: 0.8,
  maxSubmergedSpeed: 0, // For submarines when submerged
  maxSubmergedReverseSpeed: 0, // For submarines when submerged
  accelerationPower: 0.03,
  accelerationDecay: 0.08,
  friction: 0.02,
  maxRudderAngle: Math.PI / 6,
  rudderSpeed: 0.03,
  turnRate: 0.02,
  pivotPoint: 0.7
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
  // Visual properties (will be set from shipTypes)
  length: 200,
  width: 60,
  stackCount: 4,
  stackRadius: 10,
  conningTowerSize: 0, // For submarines only
  category: 'Steamers', // Current ship category
  name: '4-Stack Steamer',
  visualStyle: {},
  isSubmerged: false // For submarines: true when submerged, false when on surface
};

// Function to apply a ship type to the ship and shipConfig
function applyShipType(shipTypeInfo) {
  // Handle both old string format (for backwards compatibility) and new object format
  let category, name;
  if (typeof shipTypeInfo === 'string') {
    // Legacy format - search all categories
    for (const cat of Object.keys(shipTypes)) {
      if (shipTypes[cat][shipTypeInfo]) {
        category = cat;
        name = shipTypeInfo;
        break;
      }
    }
  } else {
    category = shipTypeInfo.category;
    name = shipTypeInfo.name;
  }
  
  if (!category || !shipTypes[category] || !shipTypes[category][name]) {
    console.warn(`Ship type "${name}" in category "${category}" not found, using default`);
    return;
  }
  
  const shipType = shipTypes[category][name];
  
  // Store category for rendering decisions
  ship.category = category;
  ship.name = name;
  ship.visualStyle = shipType.visual.style || {};
  
  // Apply visual properties to ship
  ship.length = shipType.visual.length;
  ship.width = shipType.visual.width;
  
  // Apply category-specific visual properties
  if (category === 'Submarines') {
    // Submarines use conningTowerSize
    ship.conningTowerSize = shipType.visual.conningTowerSize || 0;
    ship.stackCount = 0; // No stacks for submarines
    ship.stackRadius = 0;
  } else {
    // Surface ships use stackCount and stackRadius
    ship.stackCount = shipType.visual.stackCount || 0;
    ship.stackRadius = shipType.visual.stackRadius || 0;
    ship.conningTowerSize = 0;
  }
  
  // Apply physics properties to shipConfig
  shipConfig.maxSpeed = shipType.physics.maxSpeed;
  shipConfig.maxReverseSpeed = shipType.physics.maxReverseSpeed;
  // Submerged speeds (if available, for submarines)
  shipConfig.maxSubmergedSpeed = shipType.physics.maxSubmergedSpeed || 0;
  shipConfig.maxSubmergedReverseSpeed = shipType.physics.maxSubmergedReverseSpeed || 0;
  shipConfig.accelerationPower = shipType.physics.accelerationPower;
  shipConfig.accelerationDecay = shipType.physics.accelerationDecay;
  shipConfig.friction = shipType.physics.friction;
  shipConfig.maxRudderAngle = shipType.physics.maxRudderAngle;
  shipConfig.rudderSpeed = shipType.physics.rudderSpeed;
  shipConfig.turnRate = shipType.physics.turnRate;
  shipConfig.pivotPoint = shipType.physics.pivotPoint;
  
  // Reset submerged state when switching ships
  ship.isSubmerged = false;
}

// Cycle through available ship types (across all categories)
function cycleShipType() {
  // Build a flat list of all ships with their categories
  const allShips = [];
  for (const category of Object.keys(shipTypes)) {
    for (const shipName of Object.keys(shipTypes[category])) {
      allShips.push({ category, name: shipName });
    }
  }
  
  if (allShips.length === 0) return;
  
  // Find current index
  const currentIndex = allShips.findIndex(
    s => s.category === currentShipType.category && s.name === currentShipType.name
  );
  
  // Move to next ship (wrap around)
  const nextIndex = (currentIndex + 1) % allShips.length;
  currentShipType = allShips[nextIndex];
  
  // Apply the new ship type
  applyShipType(currentShipType);
  
  // Reset ship state when switching (optional - prevents weird behavior)
  ship.speed = 0;
  ship.acceleration = 0;
  ship.rudderAngle = 0;
}

// Trace the top-down outline used by both the main view and the minimap.
// The pointed bow faces positive X before the ship rotation is applied.
function traceSurfaceHull(length, width, profile = 'classic') {
  const halfWidth = width / 2;
  const isCruiseShip = profile === 'cruise';
  const isStreamlined = profile === 'streamlined';
  const bowShoulder = isStreamlined ? 0.22 : (isCruiseShip ? 0.3 : 0.26);
  const sternX = isStreamlined ? -0.49 : -0.47;
  const sternWidth = isCruiseShip ? 0.78 : (isStreamlined ? 0.52 : 0.64);

  ctx.beginPath();
  ctx.moveTo(length * 0.5, 0);
  ctx.bezierCurveTo(
    length * 0.43, -halfWidth * bowShoulder,
    length * 0.34, -halfWidth * 0.82,
    length * 0.14, -halfWidth
  );
  ctx.bezierCurveTo(
    -length * 0.14, -halfWidth,
    -length * 0.35, -halfWidth * 0.9,
    length * sternX, -halfWidth * sternWidth
  );
  ctx.quadraticCurveTo(-length * 0.515, 0, length * sternX, halfWidth * sternWidth);
  ctx.bezierCurveTo(
    -length * 0.35, halfWidth * 0.9,
    -length * 0.14, halfWidth,
    length * 0.14, halfWidth
  );
  ctx.bezierCurveTo(
    length * 0.34, halfWidth * 0.82,
    length * 0.43, halfWidth * bowShoulder,
    length * 0.5, 0
  );
  ctx.closePath();
}

function traceRoundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawShipMast(mastX, width, accentColor) {
  ctx.strokeStyle = 'rgba(31, 40, 44, 0.75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(mastX, -width * 0.22);
  ctx.lineTo(mastX, width * 0.22);
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.strokeStyle = '#283237';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mastX, 0, Math.max(2, width * 0.045), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawLifeboats(length, width, count, structureLength, structureWidth) {
  const boatLength = Math.min(13, Math.max(7, length * 0.045));
  const boatWidth = Math.min(5, Math.max(3, width * 0.07));
  const spacing = structureLength / Math.max(count, 1);
  const startX = -structureLength / 2 + spacing / 2 - length * 0.04;
  const boatY = Math.min(width * 0.37, structureWidth / 2 + boatWidth * 0.75);

  ctx.fillStyle = '#d9a451';
  ctx.strokeStyle = '#6f522c';
  ctx.lineWidth = 0.8;

  for (let i = 0; i < count; i++) {
    const boatX = startX + i * spacing;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(boatX, side * boatY, boatLength / 2, boatWidth / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawSurfaceShip(x, y, length, width, stackCount, stackRadius, rotation, style) {
  const hullProfile = style.hullProfile || 'classic';
  const hullColor = style.hullColor || '#17222c';
  const deckColor = style.deckColor || '#b78351';
  const accentColor = style.accentColor || '#d7b46a';
  const superstructureColor = style.superstructureColor || '#f3f0e7';
  const structureLength = length * (style.superstructureLength || 0.6);
  const structureWidth = width * (style.superstructureWidth || 0.46);
  const structureCenterX = hullProfile === 'cruise' ? -length * 0.035 : -length * 0.055;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Rudder and twin screws peek out behind the hull and improve the stern silhouette.
  ctx.fillStyle = '#27333a';
  ctx.strokeStyle = '#d7e1e2';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-length * 0.46, -width * 0.07);
  ctx.lineTo(-length * 0.56, 0);
  ctx.lineTo(-length * 0.46, width * 0.07);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(-length * 0.48, side * width * 0.2, Math.max(2.5, width * 0.055), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Main hull, now with a real bow and a tapered transom instead of an ellipse.
  const hullGradient = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
  hullGradient.addColorStop(0, hullColor);
  hullGradient.addColorStop(0.48, hullColor);
  hullGradient.addColorStop(1, '#0f171d');
  traceSurfaceHull(length, width, hullProfile);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = hullGradient;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#e9f0ef';
  ctx.lineWidth = 2;
  ctx.stroke();

  // An inset deck leaves a visible dark hull rail all the way around.
  ctx.save();
  ctx.translate(length * 0.008, 0);
  traceSurfaceHull(length * 0.91, width * 0.72, hullProfile);
  ctx.fillStyle = deckColor;
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // Foredeck and stern plating give the long hull readable sections.
  ctx.strokeStyle = 'rgba(52, 42, 31, 0.45)';
  ctx.lineWidth = 1;
  for (const deckX of [length * 0.31, -length * 0.36]) {
    ctx.beginPath();
    ctx.moveTo(deckX, -width * 0.25);
    ctx.quadraticCurveTo(deckX - length * 0.015, 0, deckX, width * 0.25);
    ctx.stroke();
  }

  // Main and upper superstructure decks are stepped rather than one flat rectangle.
  traceRoundedRect(
    structureCenterX - structureLength / 2,
    -structureWidth / 2,
    structureLength,
    structureWidth,
    width * 0.09
  );
  ctx.fillStyle = superstructureColor;
  ctx.fill();
  ctx.strokeStyle = '#aeb8b7';
  ctx.lineWidth = 1.1;
  ctx.stroke();

  const upperLength = structureLength * (hullProfile === 'cruise' ? 0.78 : 0.66);
  const upperWidth = structureWidth * 0.62;
  const upperCenterX = structureCenterX + length * 0.035;
  traceRoundedRect(
    upperCenterX - upperLength / 2,
    -upperWidth / 2,
    upperLength,
    upperWidth,
    width * 0.07
  );
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#cad1cf';
  ctx.stroke();

  // Dark promenade strips and individual windows keep detail legible at game scale.
  ctx.strokeStyle = '#314953';
  ctx.lineWidth = Math.max(1.2, width * 0.035);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(structureCenterX - structureLength * 0.41, side * structureWidth * 0.39);
    ctx.lineTo(structureCenterX + structureLength * 0.39, side * structureWidth * 0.39);
    ctx.stroke();
  }

  const windowCount = Math.max(6, Math.floor(structureLength / 20));
  const windowSpacing = upperLength * 0.8 / (windowCount - 1);
  ctx.fillStyle = '#263d48';
  for (let i = 0; i < windowCount; i++) {
    const windowX = upperCenterX - upperLength * 0.4 + i * windowSpacing;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(windowX, side * upperWidth * 0.33, Math.max(1, width * 0.018), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawLifeboats(
    length,
    width,
    style.lifeboatCount || 5,
    structureLength,
    structureWidth
  );

  // A broad forward bridge with a dark glazed face.
  const bridgeX = structureCenterX + structureLength * 0.38;
  const bridgeWidth = Math.min(width * 0.48, structureWidth * 0.9);
  traceRoundedRect(
    bridgeX - length * 0.035,
    -bridgeWidth / 2,
    length * 0.07,
    bridgeWidth,
    width * 0.04
  );
  ctx.fillStyle = '#eef2ef';
  ctx.fill();
  ctx.strokeStyle = '#9ba8a8';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = '#29444f';
  ctx.lineWidth = Math.max(1.5, width * 0.035);
  ctx.beginPath();
  ctx.moveTo(bridgeX + length * 0.02, -bridgeWidth * 0.38);
  ctx.lineTo(bridgeX + length * 0.025, bridgeWidth * 0.38);
  ctx.stroke();

  // Funnels are elliptical from above, with colored casings and dark exhaust openings.
  const funnelSpan = Math.min(length * 0.36, structureLength * 0.62);
  for (let i = 0; i < stackCount; i++) {
    const funnelX = stackCount === 1
      ? structureCenterX
      : structureCenterX - funnelSpan / 2 + i * (funnelSpan / (stackCount - 1));
    const funnelLength = stackRadius * (hullProfile === 'cruise' ? 1.05 : 1.3);
    const funnelWidth = stackRadius * (hullProfile === 'cruise' ? 0.72 : 0.82);

    ctx.beginPath();
    ctx.ellipse(funnelX, 0, funnelLength, funnelWidth, 0, 0, Math.PI * 2);
    ctx.fillStyle = style.funnelColor || '#d39a43';
    ctx.fill();
    ctx.strokeStyle = '#f4e4bd';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(funnelX, 0, funnelLength * 0.53, funnelWidth * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#182026';
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawShipMast(length * 0.34, width, accentColor);
  drawShipMast(-length * 0.35, width, accentColor);

  ctx.restore();
}

function traceSubmarineHull(length, width) {
  const halfWidth = width / 2;
  ctx.beginPath();
  ctx.moveTo(length * 0.5, 0);
  ctx.bezierCurveTo(
    length * 0.42, -halfWidth * 0.58,
    length * 0.27, -halfWidth,
    0, -halfWidth
  );
  ctx.bezierCurveTo(
    -length * 0.27, -halfWidth,
    -length * 0.43, -halfWidth * 0.58,
    -length * 0.49, 0
  );
  ctx.bezierCurveTo(
    -length * 0.43, halfWidth * 0.58,
    -length * 0.27, halfWidth,
    0, halfWidth
  );
  ctx.bezierCurveTo(
    length * 0.27, halfWidth,
    length * 0.42, halfWidth * 0.58,
    length * 0.5, 0
  );
  ctx.closePath();
}

function drawSubmarine(x, y, length, width, conningTowerSize, rotation, isSubmerged, style) {
  const hullColor = style.hullColor || '#202b30';
  const deckColor = style.deckColor || '#354247';
  const accentColor = style.accentColor || '#849398';

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = isSubmerged ? 0.36 : 1;

  // Stern planes, bow dive planes, and rudder create the recognizable U-boat outline.
  ctx.fillStyle = hullColor;
  ctx.strokeStyle = isSubmerged ? '#b8d8de' : '#dce5e4';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(-length * 0.3, -width * 0.36);
  ctx.lineTo(-length * 0.47, -width * 0.86);
  ctx.lineTo(-length * 0.51, -width * 0.82);
  ctx.lineTo(-length * 0.44, -width * 0.18);
  ctx.lineTo(-length * 0.44, width * 0.18);
  ctx.lineTo(-length * 0.51, width * 0.82);
  ctx.lineTo(-length * 0.47, width * 0.86);
  ctx.lineTo(-length * 0.3, width * 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(length * 0.21, side * width * 0.28);
    ctx.lineTo(length * 0.12, side * width * 0.69);
    ctx.lineTo(length * 0.27, side * width * 0.57);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(-length * 0.43, -width * 0.08);
  ctx.lineTo(-length * 0.57, 0);
  ctx.lineTo(-length * 0.43, width * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const hullGradient = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
  hullGradient.addColorStop(0, deckColor);
  hullGradient.addColorStop(0.45, hullColor);
  hullGradient.addColorStop(1, '#11191d');
  traceSubmarineHull(length, width);
  ctx.fillStyle = hullGradient;
  ctx.fill();
  ctx.strokeStyle = isSubmerged ? '#c9e1e4' : '#eef3f1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Narrow casing deck, hull seams, and hatches.
  traceRoundedRect(-length * 0.31, -width * 0.12, length * 0.65, width * 0.24, width * 0.1);
  ctx.fillStyle = deckColor;
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(199, 213, 214, 0.5)';
  ctx.beginPath();
  ctx.moveTo(-length * 0.42, 0);
  ctx.lineTo(length * 0.4, 0);
  ctx.stroke();

  for (const hatchX of [-length * 0.2, length * 0.3]) {
    ctx.beginPath();
    ctx.arc(hatchX, 0, Math.max(2, width * 0.06), 0, Math.PI * 2);
    ctx.fillStyle = '#151d20';
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.stroke();
  }

  if (!isSubmerged) {
    const towerLength = length * 0.22;
    const towerWidth = conningTowerSize;
    const towerX = length * 0.08;

    ctx.beginPath();
    ctx.ellipse(towerX, 0, towerLength / 2, towerWidth / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#182125';
    ctx.fill();
    ctx.strokeStyle = '#dce5e4';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Periscope and lookout rails.
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(towerX - towerLength * 0.2, -towerWidth * 0.55);
    ctx.lineTo(towerX + towerLength * 0.2, -towerWidth * 0.55);
    ctx.moveTo(towerX - towerLength * 0.2, towerWidth * 0.55);
    ctx.lineTo(towerX + towerLength * 0.2, towerWidth * 0.55);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(towerX, 0, Math.max(2, towerWidth * 0.24), 0, Math.PI * 2);
    ctx.fillStyle = '#080d0f';
    ctx.fill();
    ctx.strokeStyle = '#e5ecea';
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
  
  // Determine active speed limits (use submerged speeds if submerged)
  const activeMaxSpeed = (ship.category === 'Submarines' && ship.isSubmerged && shipConfig.maxSubmergedSpeed > 0) 
    ? shipConfig.maxSubmergedSpeed 
    : shipConfig.maxSpeed;
  const activeMaxReverseSpeed = (ship.category === 'Submarines' && ship.isSubmerged && shipConfig.maxSubmergedReverseSpeed > 0) 
    ? shipConfig.maxSubmergedReverseSpeed 
    : shipConfig.maxReverseSpeed;
  
  // Apply acceleration to speed (only if we have coal or decelerating)
  if (ship.acceleration !== 0 && (currentCoal > 0 || ship.acceleration < 0)) {
    ship.speed += ship.acceleration;
    // Clamp speed to limits
    if (ship.speed > activeMaxSpeed) {
      ship.speed = activeMaxSpeed;
    } else if (ship.speed < -activeMaxReverseSpeed) {
      ship.speed = -activeMaxReverseSpeed;
    }
  }
  
  // Apply friction when no acceleration or when at speed limit or when out of coal
  if (ship.acceleration === 0 || 
      currentCoal <= 0 ||
      (ship.acceleration > 0 && ship.speed >= activeMaxSpeed) ||
      (ship.acceleration < 0 && ship.speed <= -activeMaxReverseSpeed)) {
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
  const turnEffectiveness = Math.abs(ship.speed) / activeMaxSpeed;
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
    const speedFactor = Math.abs(ship.speed) / activeMaxSpeed; // 0 to 1
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
  
  // Position ship near start port (outside the island, but close to it)
  // Place ship at a distance of 1.5x to 2x the island radius away from the center
  const minDistance = goalConfig.radius * 1.5; // Outside the island
  const maxDistance = goalConfig.radius * 2.2; // Not too far
  const distance = minDistance + Math.random() * (maxDistance - minDistance);
  const angle = Math.random() * Math.PI * 2; // Random direction
  
  camera.x = startPort.x + Math.cos(angle) * distance;
  camera.y = startPort.y + Math.sin(angle) * distance;
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
  drawIsland(portScreenX, portScreenY, '#6B8E23', startPort.x, startPort.y, 1.0, false);
}

// Draw island (reusable function for both start port and goal, and minimap)
// worldX, worldY: world coordinates for seed generation (for consistent shape)
// scale: scaling factor (1.0 for normal, smaller for minimap)
// isMinimap: if true, draws simplified version
function drawIsland(screenX, screenY, accentColor = '#4caf50', worldX = 0, worldY = 0, scale = 1.0, isMinimap = false) {
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.scale(scale, scale);
  
  const islandSize = goalConfig.radius;
  
  // Generate irregular/jagged island shape (similar to icebergs)
  // Use island position as seed for consistent shape
  const seed = (worldX * 1000 + worldY) * 0.1;
  const pointCount = isMinimap ? 12 : 16;
  const points = [];
  const angleStep = (Math.PI * 2) / pointCount;
  const baseRadiusX = islandSize * 0.9;
  const baseRadiusY = islandSize * 0.7;
  
  for (let i = 0; i < pointCount; i++) {
    const angle = i * angleStep;
    // Add irregularity using seeded random (similar to icebergs)
    const irregularityHash = Math.sin(seed + angle) * 10000;
    const irregularity = 1 + (Math.abs(irregularityHash - Math.floor(irregularityHash)) - 0.5) * 0.4;
    
    // Create elliptical base with irregularity
    const radiusX = baseRadiusX * irregularity;
    const radiusY = baseRadiusY * irregularity;
    
    points.push({
      x: Math.cos(angle) * radiusX,
      y: Math.sin(angle) * radiusY
    });
  }
  
  // Draw jagged island shape
  ctx.fillStyle = '#4a7c42'; // Green
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
  
  // Island outline
  ctx.strokeStyle = '#3a6b32';
  ctx.lineWidth = isMinimap ? (scale > 0.1 ? 1.5 : 0.5) : 3;
  ctx.stroke();
  
  // Draw beach/sand area (only if not minimap or if minimap is expanded)
  if (!isMinimap || scale > 0.1) {
    ctx.fillStyle = '#D2B48C';
    ctx.beginPath();
    ctx.ellipse(0, islandSize * 0.5, islandSize * 0.7, islandSize * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw trees/vegetation on island (more detailed, skip for small minimap)
  if (!isMinimap) {
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
  } else if (scale > 0.1) {
    // Simplified trees for expanded minimap
    ctx.fillStyle = '#3a7c42';
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI * 2) / 4;
      const dist = islandSize * 0.4;
      const treeX = Math.cos(angle) * dist;
      const treeY = Math.sin(angle) * dist;
      ctx.beginPath();
      ctx.arc(treeX, treeY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // Draw dock/pier (extending from island - more detailed, skip for small minimap)
  if (!isMinimap || scale > 0.1) {
    ctx.fillStyle = '#654321'; // Brown wood
    const dockWidth = islandSize * 0.7;
    const dockHeight = islandSize * 0.25;
    ctx.fillRect(-dockWidth / 2, islandSize * 0.45, dockWidth, dockHeight);
    ctx.strokeStyle = '#543210';
    ctx.lineWidth = 2;
    ctx.strokeRect(-dockWidth / 2, islandSize * 0.45, dockWidth, dockHeight);
    
    // Draw dock planks (wooden planks detail) - only for full detail
    if (!isMinimap) {
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
    }
  } else {
    // Simplified dock for small minimap
    ctx.fillStyle = '#654321';
    const dockWidth = islandSize * 0.6;
    const dockHeight = islandSize * 0.15;
    ctx.fillRect(-dockWidth / 2, islandSize * 0.4, dockWidth, dockHeight);
  }
  
  // Draw small boats at dock (only for full detail)
  if (!isMinimap) {
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
  }
  
  // Draw port buildings (more buildings, only for full detail)
  if (!isMinimap) {
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
  }
  
  // Draw lighthouse (taller and more detailed)
  const lighthouseX = 0;
  const lighthouseY = -islandSize * 0.6;
  
  if (!isMinimap) {
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
  } else {
    // Simplified lighthouse for minimap
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.arc(lighthouseX, lighthouseY, scale > 0.1 ? 2 : 1, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw crane/loading equipment (only for full detail)
  if (!isMinimap) {
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
  }
  
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
  drawIsland(goalScreenX, goalScreenY, '#4caf50', goal.x, goal.y, 1.0, false);
}

// Check collision between ship and icebergs
function checkCollisions() {
  if (gameOver || gameWon) return;
  
  // Submarines don't collide when submerged
  if (ship.category === 'Submarines' && ship.isSubmerged) {
    return;
  }
  
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
  
  // Apply current ship type (ensures ship properties are correct)
  applyShipType(currentShipType);
  
  // Reset ship state
  ship.rotation = -Math.PI / 2;
  ship.speed = 0;
  ship.acceleration = 0;
  ship.rudderAngle = 0;
  ship.isSubmerged = false; // Reset submerged state
  
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
let minimapExpanded = false;
let minimapBounds = null;

// Handle mouse clicks for restart button
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Check if click is on minimap
  if (minimapBounds && !gameOver && !gameWon) {
    if (x >= minimapBounds.x &&
        x <= minimapBounds.x + minimapBounds.width &&
        y >= minimapBounds.y &&
        y <= minimapBounds.y + minimapBounds.height) {
      minimapExpanded = !minimapExpanded;
      return;
    }
  }
  
  // Check if click is on game over/win button
  if ((!gameOver && !gameWon) || !gameOverButton) return;
  
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

// Draw minimap in upper right corner (or full screen if expanded)
function drawMinimap() {
  if (gameOver) return;
  
  ctx.save();
  
  let minimapSize, minimapX, minimapY, padding, mapSize;
  
  if (minimapExpanded) {
    // Full screen minimap
    minimapSize = Math.min(canvas.width, canvas.height);
    minimapX = (canvas.width - minimapSize) / 2;
    minimapY = (canvas.height - minimapSize) / 2;
    padding = 40;
    mapSize = minimapSize - padding * 2;
  } else {
    // Small minimap in corner
    minimapSize = 200;
    minimapX = canvas.width - minimapSize - 20;
    minimapY = 20;
    padding = 10;
    mapSize = minimapSize - padding * 2;
  }
  
  // Minimap background - blue water
  ctx.fillStyle = minimapExpanded ? '#1a3a5a' : '#2a4a6a';
  ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
  
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = minimapExpanded ? 4 : 2;
  ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);
  
  // Calculate world to minimap scale
  const scaleX = mapSize / worldConfig.width;
  const scaleY = mapSize / worldConfig.height;
  const scale = Math.min(scaleX, scaleY); // Use smaller scale to fit both dimensions
  
  const mapOffsetX = minimapX + padding;
  const mapOffsetY = minimapY + padding;
  
  // Draw world boundaries
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = minimapExpanded ? 2 : 1;
  ctx.strokeRect(mapOffsetX, mapOffsetY, worldConfig.width * scale, worldConfig.height * scale);
  
  // Draw start port on minimap (reuse drawIsland with scaling)
  if (startPort.generated) {
    const startPortMapX = mapOffsetX + startPort.x * scale;
    const startPortMapY = mapOffsetY + startPort.y * scale;
    // Scale factor: world-to-minimap scale (island will be drawn at goalConfig.radius * scale pixels)
    drawIsland(startPortMapX, startPortMapY, '#6B8E23', startPort.x, startPort.y, scale, true);
    
    // Color indicator circle around island
    const indicatorRadius = goalConfig.radius * scale * 1.1;
    ctx.strokeStyle = '#6B8E23';
    ctx.lineWidth = minimapExpanded ? 2 : 1;
    ctx.beginPath();
    ctx.arc(startPortMapX, startPortMapY, indicatorRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Draw goal on minimap (reuse drawIsland with scaling)
  if (goal.generated) {
    const goalMapX = mapOffsetX + goal.x * scale;
    const goalMapY = mapOffsetY + goal.y * scale;
    // Scale factor: world-to-minimap scale (island will be drawn at goalConfig.radius * scale pixels)
    drawIsland(goalMapX, goalMapY, '#4caf50', goal.x, goal.y, scale, true);
    
    // Color indicator circle around island
    const indicatorRadius = goalConfig.radius * scale * 1.1;
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = minimapExpanded ? 2 : 1;
    ctx.beginPath();
    ctx.arc(goalMapX, goalMapY, indicatorRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Draw ship position as miniature ship outline
  const shipMapX = mapOffsetX + camera.x * scale;
  const shipMapY = mapOffsetY + camera.y * scale;
  
  ctx.save();
  ctx.translate(shipMapX, shipMapY);
  ctx.rotate(ship.rotation);
  
  // Scale for minimap (ship is much smaller on minimap)
  const minimapShipScale = minimapExpanded ? 0.15 : 0.08;
  const minimapLength = ship.length * minimapShipScale;
  const minimapWidth = ship.width * minimapShipScale;
  
  // Check category and render accordingly
  if (ship.category === 'Submarines') {
    traceSubmarineHull(minimapLength, minimapWidth);
    if (ship.isSubmerged) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)'; // Semi-transparent red
      ctx.lineWidth = minimapExpanded ? 2 : 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = ship.visualStyle.hullColor || '#202b30';
      ctx.fill();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = minimapExpanded ? 2 : 1;
      ctx.stroke();

      // Draw simplified conning tower (elongated cylinder/ellipse forward)
      const towerLength = minimapLength * 0.25;
      const towerWidth = ship.conningTowerSize * minimapShipScale;
      const towerX = minimapLength * 0.15;
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.ellipse(towerX, 0, towerLength / 2, towerWidth / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = minimapExpanded ? 1 : 0.5;
      ctx.stroke();
    }
  } else {
    traceSurfaceHull(
      minimapLength,
      minimapWidth,
      ship.visualStyle.hullProfile || 'classic'
    );
    ctx.fillStyle = ship.visualStyle.hullColor || '#17222c';
    ctx.fill();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = minimapExpanded ? 2 : 1;
    ctx.stroke();
    
    // Draw simplified superstructure.
    const structureLength = minimapLength * (ship.visualStyle.superstructureLength || 0.6);
    const structureWidth = minimapWidth * (ship.visualStyle.superstructureWidth || 0.46);
    traceRoundedRect(
      -structureLength / 2,
      -structureWidth / 2,
      structureLength,
      structureWidth,
      Math.max(0.5, structureWidth * 0.15)
    );
    ctx.fillStyle = ship.visualStyle.superstructureColor || '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = minimapExpanded ? 1.5 : 0.5;
    ctx.stroke();
    
    // Draw simplified smokestacks (small circles)
    const stackRadius = minimapExpanded ? 1.5 : 0.8;
    const stackSpan = Math.min(minimapLength * 0.36, structureLength * 0.62);
    
    ctx.fillStyle = ship.visualStyle.funnelColor || '#d39a43';
    for (let i = 0; i < ship.stackCount; i++) {
      const stackX = ship.stackCount === 1
        ? 0
        : -stackSpan / 2 + i * (stackSpan / (ship.stackCount - 1));
      ctx.beginPath();
      ctx.arc(stackX, 0, stackRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
  
  // Minimap label and instructions
  ctx.fillStyle = '#ffffff';
  ctx.font = minimapExpanded ? 'bold 24px Arial' : 'bold 12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Map', minimapX + (minimapExpanded ? 20 : 10), minimapY + (minimapExpanded ? 30 : 10));
  
  if (minimapExpanded) {
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Click to close', canvas.width / 2, minimapY + minimapSize - 20);
  } else {
    ctx.font = '10px Arial';
    ctx.fillText('Click to expand', minimapX + 10, minimapY + minimapSize - 10);
  }
  
  // Store minimap bounds for click detection
  minimapBounds = {
    x: minimapX,
    y: minimapY,
    width: minimapSize,
    height: minimapSize
  };
  
  ctx.restore();
}

// Draw ship (always at screen center)
function drawShip() {
  // Ship is always at screen center
  ship.screenX = canvas.width / 2;
  ship.screenY = canvas.height / 2;
  
  // Check category and render accordingly
  if (ship.category === 'Submarines') {
    drawSubmarine(
      ship.screenX,
      ship.screenY,
      ship.length,
      ship.width,
      ship.conningTowerSize,
      ship.rotation,
      ship.isSubmerged,
      ship.visualStyle
    );
  } else {
    drawSurfaceShip(
      ship.screenX,
      ship.screenY,
      ship.length,
      ship.width,
      ship.stackCount,
      ship.stackRadius,
      ship.rotation,
      ship.visualStyle
    );
  }
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

  // Update ship physics (only if game is running and minimap is not expanded)
  if (!gameOver && !gameWon && !minimapExpanded) {
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

// Initialize ship type
applyShipType(currentShipType);

// Initialize start port and goal on first game start
generateStartPort();
generateGoal();
gameStartTime = performance.now();

// Start game loop
gameLoop();
