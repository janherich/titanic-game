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
    'Poseidon': {
      visual: {
        length: 350,
        width: 78,
        stackCount: 1,
        stackRadius: 18,
        style: {
          hullProfile: 'modern',
          hullColor: '#111a22',
          deckColor: '#bd9362',
          accentColor: '#b9363d',
          funnelColor: '#b9363d',
          funnelOffset: -0.13,
          funnelBand: true,
          superstructureColor: '#f4f6f5',
          superstructureLength: 0.7,
          superstructureWidth: 0.58,
          lifeboatCount: 9,
          poolDeck: true,
          radarDomes: true
        }
      },
      physics: {
        maxSpeed: 4.4,
        maxReverseSpeed: 1.1,
        accelerationPower: 0.03,
        accelerationDecay: 0.08,
        friction: 0.02,
        maxRudderAngle: Math.PI / 6,
        rudderSpeed: 0.025,
        turnRate: 0.017,
        pivotPoint: 0.62
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
  irregularity: 0.28, // How irregular the floe edge is
  color: '#edf7f7',
  strokeColor: '#c4e4e9'
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
// Shipwrecks persist for the lifetime of the page and are intentionally not
// cleared by restartGame(). A full reload resets this in-memory history.
const shipwrecks = [];
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
  const isModernLiner = profile === 'modern';
  const bowShoulder = isStreamlined
    ? 0.22
    : (isModernLiner ? 0.18 : (isCruiseShip ? 0.3 : 0.26));
  const sternX = isStreamlined ? -0.49 : (isModernLiner ? -0.48 : -0.47);
  const sternWidth = isCruiseShip
    ? 0.78
    : (isModernLiner ? 0.7 : (isStreamlined ? 0.52 : 0.64));

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
  const structureCenterX = hullProfile === 'cruise'
    ? -length * 0.035
    : (hullProfile === 'modern' ? -length * 0.025 : -length * 0.055);

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

  const upperLength = structureLength * (
    hullProfile === 'cruise' || hullProfile === 'modern' ? 0.78 : 0.66
  );
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

  if (style.poolDeck) {
    const poolLength = upperLength * 0.19;
    const poolWidth = upperWidth * 0.38;
    const poolX = upperCenterX + upperLength * 0.2;
    traceRoundedRect(
      poolX - poolLength / 2,
      -poolWidth / 2,
      poolLength,
      poolWidth,
      poolWidth * 0.3
    );
    ctx.fillStyle = '#4fa9c2';
    ctx.fill();
    ctx.strokeStyle = '#d9f3f6';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(poolX - poolLength * 0.32, -poolWidth * 0.12);
    ctx.quadraticCurveTo(poolX, poolWidth * 0.18, poolX + poolLength * 0.32, -poolWidth * 0.12);
    ctx.stroke();
  }

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
    const baseFunnelX = stackCount === 1
      ? structureCenterX
      : structureCenterX - funnelSpan / 2 + i * (funnelSpan / (stackCount - 1));
    const funnelX = baseFunnelX + length * (style.funnelOffset || 0);
    const funnelLength = stackRadius * (hullProfile === 'cruise' ? 1.05 : 1.3);
    const funnelWidth = stackRadius * (hullProfile === 'cruise' ? 0.72 : 0.82);

    ctx.beginPath();
    ctx.ellipse(funnelX, 0, funnelLength, funnelWidth, 0, 0, Math.PI * 2);
    ctx.fillStyle = style.funnelColor || '#d39a43';
    ctx.fill();
    ctx.strokeStyle = '#f4e4bd';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (style.funnelBand) {
      ctx.beginPath();
      ctx.ellipse(
        funnelX,
        0,
        funnelLength * 0.74,
        funnelWidth * 0.72,
        0,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, stackRadius * 0.2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.ellipse(funnelX, 0, funnelLength * 0.53, funnelWidth * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#182026';
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (style.radarDomes) {
    for (const domeX of [
      upperCenterX - upperLength * 0.32,
      upperCenterX + upperLength * 0.35
    ]) {
      ctx.beginPath();
      ctx.arc(domeX, 0, Math.max(3, width * 0.055), 0, Math.PI * 2);
      ctx.fillStyle = '#f9fbfa';
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
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

function hash01(a, b = 0, c = 0) {
  const value = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

// Layered ocean color stays tied to world coordinates so sailing feels like
// moving through water instead of sliding a flat backdrop beneath the ship.
function drawOcean() {
  const baseGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  baseGradient.addColorStop(0, '#183b55');
  baseGradient.addColorStop(0.48, '#214f68');
  baseGradient.addColorStop(1, '#163950');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const patchSize = 360;
  const screenCenterX = canvas.width / 2;
  const screenCenterY = canvas.height / 2;
  const minPatchX = Math.floor((camera.x - screenCenterX) / patchSize) - 1;
  const maxPatchX = Math.ceil((camera.x + screenCenterX) / patchSize) + 1;
  const minPatchY = Math.floor((camera.y - screenCenterY) / patchSize) - 1;
  const maxPatchY = Math.ceil((camera.y + screenCenterY) / patchSize) + 1;

  ctx.save();
  for (let patchX = minPatchX; patchX <= maxPatchX; patchX++) {
    for (let patchY = minPatchY; patchY <= maxPatchY; patchY++) {
      const tone = hash01(patchX, patchY, 3);
      const worldX = patchX * patchSize + hash01(patchX, patchY, 7) * patchSize;
      const worldY = patchY * patchSize + hash01(patchX, patchY, 11) * patchSize;
      const screenX = worldX - camera.x + screenCenterX;
      const screenY = worldY - camera.y + screenCenterY;
      const radius = 150 + hash01(patchX, patchY, 17) * 120;
      const patchGradient = ctx.createRadialGradient(
        screenX,
        screenY,
        0,
        screenX,
        screenY,
        radius
      );
      const patchColor = tone > 0.5
        ? 'rgba(67, 132, 151, 0.09)'
        : 'rgba(5, 34, 53, 0.11)';
      patchGradient.addColorStop(0, patchColor);
      patchGradient.addColorStop(1, 'rgba(14, 51, 70, 0)');
      ctx.fillStyle = patchGradient;
      ctx.fillRect(screenX - radius, screenY - radius, radius * 2, radius * 2);
    }
  }
  ctx.restore();
}

// Short, broken crests replace the old screen-spanning grid of sine waves.
function drawWaves() {
  const screenCenterX = canvas.width / 2;
  const screenCenterY = canvas.height / 2;
  const spacingX = 145;
  const spacingY = 92;
  const minColumn = Math.floor((camera.x - screenCenterX) / spacingX) - 1;
  const maxColumn = Math.ceil((camera.x + screenCenterX) / spacingX) + 1;
  const minRow = Math.floor((camera.y - screenCenterY) / spacingY) - 1;
  const maxRow = Math.ceil((camera.y + screenCenterY) / spacingY) + 1;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let column = minColumn; column <= maxColumn; column++) {
    for (let row = minRow; row <= maxRow; row++) {
      const visibility = hash01(column, row, 21);
      if (visibility < 0.2) continue;

      const jitterX = (hash01(column, row, 22) - 0.5) * spacingX * 0.65;
      const jitterY = (hash01(column, row, 23) - 0.5) * spacingY * 0.55;
      const worldX = column * spacingX + jitterX;
      const worldY = row * spacingY + jitterY;
      const screenX = worldX - camera.x + screenCenterX;
      const screenY = worldY - camera.y + screenCenterY;
      const crestLength = 28 + hash01(column, row, 24) * 78;
      const crestHeight = 3 + hash01(column, row, 25) * 7;
      const rotation = -0.13 + (hash01(column, row, 26) - 0.5) * 0.16;
      const pulse = Math.sin(animationTime * 0.018 + hash01(column, row, 27) * Math.PI * 2);

      ctx.save();
      ctx.translate(screenX, screenY + pulse * 1.8);
      ctx.rotate(rotation);

      ctx.strokeStyle = `rgba(174, 216, 226, ${0.16 + visibility * 0.13})`;
      ctx.lineWidth = 1.1 + visibility * 0.65;
      ctx.beginPath();
      ctx.moveTo(-crestLength / 2, crestHeight * 0.25);
      ctx.bezierCurveTo(
        -crestLength * 0.2, -crestHeight,
        crestLength * 0.18, -crestHeight,
        crestLength / 2, crestHeight * 0.2
      );
      ctx.stroke();

      if (visibility > 0.62) {
        const highlightLength = crestLength * (0.35 + visibility * 0.22);
        ctx.strokeStyle = `rgba(226, 242, 244, ${0.2 + visibility * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-highlightLength / 2, -crestHeight * 0.25);
        ctx.quadraticCurveTo(0, -crestHeight * 0.9, highlightLength / 2, -crestHeight * 0.18);
        ctx.stroke();
      }

      if (visibility > 0.84) {
        ctx.fillStyle = 'rgba(222, 241, 244, 0.28)';
        for (let fleck = 0; fleck < 3; fleck++) {
          const fleckX = (hash01(column, row, 30 + fleck) - 0.5) * crestLength * 0.8;
          const fleckY = crestHeight * (0.4 + hash01(column, row, 40 + fleck) * 0.7);
          ctx.beginPath();
          ctx.arc(fleckX, fleckY, 0.8 + fleck * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  ctx.restore();
}

function drawShipWake() {
  if (Math.abs(ship.speed) < 0.15 || (ship.category === 'Submarines' && ship.isSubmerged)) {
    return;
  }

  const wakeSpeedLimit = ship.speed >= 0
    ? shipConfig.maxSpeed
    : shipConfig.maxReverseSpeed;
  const speedRatio = Math.min(1, Math.abs(ship.speed) / wakeSpeedLimit);
  const wakeLength = ship.length * (0.5 + speedRatio * 0.65);
  const sternX = -ship.length * 0.43;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(ship.rotation);
  ctx.scale(ship.speed >= 0 ? 1 : -1, 1);
  ctx.lineCap = 'round';
  ctx.setLineDash([9, 7]);
  ctx.lineDashOffset = -animationTime * 0.45;

  for (const side of [-1, 1]) {
    ctx.strokeStyle = `rgba(221, 241, 244, ${0.12 + speedRatio * 0.3})`;
    ctx.lineWidth = 1.4 + speedRatio;
    ctx.beginPath();
    ctx.moveTo(sternX, side * ship.width * 0.3);
    ctx.bezierCurveTo(
      sternX - wakeLength * 0.28,
      side * ship.width * 0.45,
      sternX - wakeLength * 0.7,
      side * ship.width * (0.75 + speedRatio * 0.35),
      sternX - wakeLength,
      side * ship.width * (0.95 + speedRatio * 0.55)
    );
    ctx.stroke();
  }

  ctx.setLineDash([4, 9]);
  ctx.strokeStyle = `rgba(199, 228, 234, ${0.1 + speedRatio * 0.2})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(sternX, 0);
  ctx.quadraticCurveTo(sternX - wakeLength * 0.4, ship.width * 0.08, sternX - wakeLength * 0.75, 0);
  ctx.stroke();
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
    
    // Keep navigable water around the departure harbor and destination island.
    // The previous check measured from world origin instead of the actual port.
    const distanceFromStartPort = startPort.generated
      ? Math.hypot(x - startPort.x, y - startPort.y)
      : Infinity;
    const distanceFromGoal = goal.generated
      ? Math.hypot(x - goal.x, y - goal.y)
      : Infinity;
    if (
      distanceFromStartPort < goalConfig.radius * 2.5 ||
      distanceFromGoal < goalConfig.radius * 1.65
    ) {
      continue;
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

function getIceFloePoints(iceberg) {
  const points = [];
  const angleStep = (Math.PI * 2) / iceberg.pointCount;
  const squash = 0.78 + hash01(iceberg.seed, 4) * 0.2;

  for (let i = 0; i < iceberg.pointCount; i++) {
    const angleJitter = (hash01(iceberg.seed, i, 5) - 0.5) * angleStep * 0.34;
    const angle = i * angleStep + angleJitter;
    const radiusVariation = 0.76 + hash01(iceberg.seed, i, 6) * 0.24;
    const radius = iceberg.size * radiusVariation;
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * squash
    });
  }

  return points;
}

function tracePolygon(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

// Draw a floating ice floe with a submerged shelf, visible thickness, and
// restrained surface facets. Collision geometry remains unchanged.
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
  ctx.rotate((hash01(iceberg.seed, 8) - 0.5) * 0.8);

  const points = getIceFloePoints(iceberg);

  // Pale turquoise below the edge suggests the larger submerged ice shelf.
  ctx.save();
  ctx.scale(1.1, 1.1);
  tracePolygon(points);
  ctx.fillStyle = 'rgba(104, 176, 194, 0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(143, 205, 216, 0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // The lower edge is offset toward the viewer to give the floe thickness.
  ctx.save();
  ctx.translate(0, Math.max(3, iceberg.size * 0.075));
  tracePolygon(points);
  ctx.fillStyle = '#9fc6d1';
  ctx.fill();
  ctx.strokeStyle = '#83b4c1';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  tracePolygon(points);
  const iceGradient = ctx.createLinearGradient(
    -iceberg.size * 0.55,
    -iceberg.size * 0.65,
    iceberg.size * 0.5,
    iceberg.size * 0.65
  );
  iceGradient.addColorStop(0, '#fbffff');
  iceGradient.addColorStop(0.48, icebergsConfig.color);
  iceGradient.addColorStop(1, '#d4eaed');
  ctx.fillStyle = iceGradient;
  ctx.shadowColor = 'rgba(4, 35, 49, 0.22)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Broad triangular facets keep the surface dimensional without making it rocky.
  ctx.save();
  tracePolygon(points);
  ctx.clip();
  const facetCenter = {
    x: (hash01(iceberg.seed, 12) - 0.5) * iceberg.size * 0.22,
    y: (hash01(iceberg.seed, 13) - 0.5) * iceberg.size * 0.18
  };
  const facetColors = [
    'rgba(159, 208, 217, 0.2)',
    'rgba(255, 255, 255, 0.34)',
    'rgba(121, 184, 199, 0.13)'
  ];

  for (let i = 0; i < points.length; i += 2) {
    const nextIndex = (i + 2) % points.length;
    ctx.beginPath();
    ctx.moveTo(facetCenter.x, facetCenter.y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.lineTo(points[(i + 1) % points.length].x, points[(i + 1) % points.length].y);
    ctx.lineTo(points[nextIndex].x, points[nextIndex].y);
    ctx.closePath();
    ctx.fillStyle = facetColors[(i / 2) % facetColors.length];
    ctx.fill();
  }
  ctx.restore();

  tracePolygon(points);
  ctx.strokeStyle = icebergsConfig.strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // A few fine stress lines make larger floes feel naturally fractured.
  if (iceberg.size > 44) {
    ctx.strokeStyle = 'rgba(103, 162, 178, 0.35)';
    ctx.lineWidth = 1;
    for (let crack = 0; crack < Math.min(3, Math.floor(iceberg.size / 24)); crack++) {
      const target = points[(crack * 3 + 1) % points.length];
      const startX = facetCenter.x + (hash01(iceberg.seed, crack, 18) - 0.5) * iceberg.size * 0.12;
      const startY = facetCenter.y + (hash01(iceberg.seed, crack, 19) - 0.5) * iceberg.size * 0.12;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(target.x * 0.42, target.y * 0.42);
      ctx.lineTo(target.x * 0.67, target.y * 0.65);
      ctx.stroke();
    }
  }
  
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

function drawShipwreck(shipwreck) {
  const screenCenterX = canvas.width / 2;
  const screenCenterY = canvas.height / 2;
  const screenX = shipwreck.x - camera.x + screenCenterX;
  const screenY = shipwreck.y - camera.y + screenCenterY;
  const wreckLength = shipwreck.size * 2.15;
  const wreckWidth = shipwreck.size * 0.62;

  if (screenX < -wreckLength || screenX > canvas.width + wreckLength ||
      screenY < -wreckLength || screenY > canvas.height + wreckLength) {
    return;
  }

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.rotate(shipwreck.rotation);

  // A low, broken hull and a faint wake make the wreck legible against the
  // water while still feeling like a settled obstacle rather than a new ship.
  ctx.fillStyle = 'rgba(5, 28, 38, 0.25)';
  ctx.beginPath();
  ctx.ellipse(5, 7, wreckLength * 0.52, wreckWidth * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(174, 221, 223, 0.32)';
  ctx.lineWidth = 1.5;
  for (let ripple = 0; ripple < 2; ripple++) {
    ctx.beginPath();
    ctx.ellipse(
      -wreckLength * 0.08,
      3,
      wreckLength * (0.62 + ripple * 0.08),
      wreckWidth * (0.72 + ripple * 0.08),
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  traceSurfaceHull(wreckLength, wreckWidth, 'classic');
  ctx.fillStyle = '#27343a';
  ctx.fill();
  ctx.strokeStyle = '#c2784b';
  ctx.lineWidth = 2;
  ctx.stroke();

  // The split deck and exposed red-brown plating communicate that this is a
  // wreck, not a selectable vessel.
  ctx.save();
  ctx.translate(-wreckLength * 0.05, 0);
  traceSurfaceHull(wreckLength * 0.84, wreckWidth * 0.68, 'classic');
  ctx.fillStyle = '#76533e';
  ctx.fill();
  ctx.strokeStyle = '#c89567';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#3a2522';
  ctx.fillRect(-wreckLength * 0.1, -wreckWidth * 0.24, wreckLength * 0.27, wreckWidth * 0.16);
  ctx.fillStyle = '#b76b45';
  ctx.fillRect(wreckLength * 0.18, -wreckWidth * 0.2, wreckLength * 0.16, wreckWidth * 0.13);

  ctx.strokeStyle = '#1e2b30';
  ctx.lineWidth = Math.max(2, shipwreck.size * 0.035);
  ctx.beginPath();
  ctx.moveTo(-wreckLength * 0.06, 0);
  ctx.lineTo(wreckLength * 0.2, -wreckWidth * 0.72);
  ctx.moveTo(wreckLength * 0.08, wreckWidth * 0.04);
  ctx.lineTo(-wreckLength * 0.23, wreckWidth * 0.64);
  ctx.stroke();

  ctx.fillStyle = '#d3874b';
  for (let debris = 0; debris < 4; debris++) {
    const debrisX = (hash01(shipwreck.seed, debris, 21) - 0.5) * wreckLength * 1.3;
    const debrisY = (hash01(shipwreck.seed, debris, 22) - 0.5) * wreckWidth * 2.2;
    ctx.beginPath();
    ctx.arc(debrisX, debrisY, 2 + hash01(shipwreck.seed, debris, 23) * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawShipwrecks() {
  for (const shipwreck of shipwrecks) {
    drawShipwreck(shipwreck);
  }
}

function drawShipwreckMarker(x, y, radius, expanded) {
  const markerRadius = Math.max(expanded ? 5 : 3, radius);

  ctx.save();
  ctx.fillStyle = 'rgba(16, 25, 31, 0.75)';
  ctx.beginPath();
  ctx.arc(x, y, markerRadius + 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#e08b4d';
  ctx.lineWidth = expanded ? 2 : 1.2;
  ctx.beginPath();
  ctx.moveTo(x - markerRadius, y - markerRadius);
  ctx.lineTo(x + markerRadius, y + markerRadius);
  ctx.moveTo(x + markerRadius, y - markerRadius);
  ctx.lineTo(x - markerRadius, y + markerRadius);
  ctx.stroke();
  ctx.restore();
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
  const portRotation = getIslandPortRotation(startPort.x, startPort.y);
  const approachAngle = Math.PI / 2 + portRotation;

  camera.x = startPort.x + Math.cos(approachAngle) * distance;
  camera.y = startPort.y + Math.sin(approachAngle) * distance;
  ship.rotation = approachAngle + Math.PI;
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
  drawIsland(portScreenX, portScreenY, '#6B8E23', startPort.x, startPort.y, 1.0, false, 'DEPARTURE');
}

// Draw island (reusable function for both start port and goal, and minimap)
// worldX, worldY: world coordinates for seed generation (for consistent shape)
// scale: scaling factor (1.0 for normal, smaller for minimap)
// isMinimap: if true, draws simplified version
function traceSmoothLoop(points) {
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  ctx.beginPath();
  ctx.moveTo(
    (lastPoint.x + firstPoint.x) / 2,
    (lastPoint.y + firstPoint.y) / 2
  );

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const nextPoint = points[(i + 1) % points.length];
    ctx.quadraticCurveTo(
      point.x,
      point.y,
      (point.x + nextPoint.x) / 2,
      (point.y + nextPoint.y) / 2
    );
  }
  ctx.closePath();
}

function scaleLoopPoints(points, scaleX, scaleY = scaleX, offsetY = 0) {
  return points.map(point => ({
    x: point.x * scaleX,
    y: point.y * scaleY + offsetY
  }));
}

function createIslandShore(seed, islandSize, pointCount) {
  const points = [];
  const angleStep = (Math.PI * 2) / pointCount;
  for (let i = 0; i < pointCount; i++) {
    const angle = i * angleStep + (hash01(seed, i, 51) - 0.5) * angleStep * 0.38;
    const radius = 0.84 + hash01(seed, i, 52) * 0.18;
    points.push({
      x: Math.cos(angle) * islandSize * 0.92 * radius,
      y: Math.sin(angle) * islandSize * 0.72 * radius
    });
  }
  return points;
}

function drawTopDownTree(x, y, radius, seed) {
  ctx.fillStyle = 'rgba(19, 44, 30, 0.24)';
  ctx.beginPath();
  ctx.ellipse(x + radius * 0.35, y + radius * 0.45, radius * 0.9, radius * 0.62, 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#274f39';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3f7150';
  ctx.beginPath();
  ctx.arc(x - radius * 0.28, y - radius * 0.2, radius * 0.66, 0, Math.PI * 2);
  ctx.arc(x + radius * 0.34, y - radius * 0.12, radius * 0.58, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5f8758';
  ctx.beginPath();
  ctx.arc(
    x - radius * 0.18,
    y - radius * 0.35,
    radius * (0.26 + hash01(seed, 1) * 0.12),
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = '#6b4c2e';
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.4, radius * 0.12), 0, Math.PI * 2);
  ctx.fill();
}

function drawRoofedBuilding(x, y, width, height, rotation, colors) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.fillStyle = 'rgba(26, 38, 33, 0.24)';
  ctx.fillRect(-width / 2 + 5, -height / 2 + 6, width, height);

  ctx.fillStyle = colors.wall;
  ctx.strokeStyle = '#674c38';
  ctx.lineWidth = 1.5;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.strokeRect(-width / 2, -height / 2, width, height);

  ctx.beginPath();
  ctx.moveTo(-width / 2, -height / 2);
  ctx.lineTo(width / 2, -height / 2);
  ctx.lineTo(width / 2, 0);
  ctx.lineTo(-width / 2, 0);
  ctx.closePath();
  ctx.fillStyle = colors.lightRoof;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-width / 2, 0);
  ctx.lineTo(width / 2, 0);
  ctx.lineTo(width / 2, height / 2);
  ctx.lineTo(-width / 2, height / 2);
  ctx.closePath();
  ctx.fillStyle = colors.darkRoof;
  ctx.fill();

  ctx.strokeStyle = '#6d4935';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-width / 2, 0);
  ctx.lineTo(width / 2, 0);
  ctx.stroke();

  ctx.fillStyle = '#8fc2cf';
  const windowCount = Math.max(2, Math.floor(width / 22));
  for (let i = 0; i < windowCount; i++) {
    const windowX = -width * 0.34 + i * (width * 0.68 / Math.max(1, windowCount - 1));
    ctx.fillRect(windowX - 2.5, -height * 0.32, 5, 4);
  }

  ctx.restore();
}

function drawMooredBoat(x, y, length, width, color, side = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(side * 0.04);
  ctx.fillStyle = 'rgba(6, 34, 48, 0.28)';
  ctx.beginPath();
  ctx.ellipse(3, 5, width * 0.7, length * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -length / 2);
  ctx.quadraticCurveTo(width / 2, -length * 0.25, width / 2, length * 0.28);
  ctx.quadraticCurveTo(0, length * 0.5, -width / 2, length * 0.28);
  ctx.quadraticCurveTo(-width / 2, -length * 0.25, 0, -length / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#e8efe9';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#dbc59f';
  ctx.fillRect(-width * 0.28, -length * 0.05, width * 0.56, length * 0.18);
  ctx.restore();
}

// Turn each harbor toward open water, away from the nearest world edge. This
// keeps the approach looking intentional regardless of where islands spawn.
function getIslandPortRotation(worldX, worldY) {
  const distances = [
    { distance: worldY, rotation: 0 },
    { distance: worldConfig.width - worldX, rotation: Math.PI / 2 },
    { distance: worldConfig.height - worldY, rotation: Math.PI },
    { distance: worldX, rotation: -Math.PI / 2 }
  ];

  return distances.reduce((nearest, current) => (
    current.distance < nearest.distance ? current : nearest
  )).rotation;
}

function drawHarborSign(x, y, label, accentColor) {
  const signWidth = 116;
  const signHeight = 24;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(22, 31, 31, 0.28)';
  ctx.fillRect(-signWidth / 2 + 4, -signHeight / 2 + 5, signWidth, signHeight);

  ctx.fillStyle = '#f1ead5';
  ctx.strokeStyle = '#624931';
  ctx.lineWidth = 2;
  ctx.fillRect(-signWidth / 2, -signHeight / 2, signWidth, signHeight);
  ctx.strokeRect(-signWidth / 2, -signHeight / 2, signWidth, signHeight);

  ctx.fillStyle = accentColor;
  ctx.fillRect(-signWidth / 2 + 4, -signHeight / 2 + 4, 5, signHeight - 8);
  ctx.fillRect(signWidth / 2 - 9, -signHeight / 2 + 4, 5, signHeight - 8);

  ctx.fillStyle = '#273b3d';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

function drawHarborBeacon(x, y, accentColor) {
  const pulse = 0.5 + Math.sin(animationTime * 0.08) * 0.15;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 18);
  glow.addColorStop(0, `rgba(255, 241, 157, ${0.35 + pulse * 0.2})`);
  glow.addColorStop(1, 'rgba(255, 241, 157, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e8dfc2';
  ctx.strokeStyle = '#4d4233';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(x, y, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawIsland(screenX, screenY, accentColor = '#4caf50', worldX = 0, worldY = 0, scale = 1.0, isMinimap = false, portLabel = 'PORT') {
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.scale(scale, scale);
  ctx.rotate(getIslandPortRotation(worldX, worldY));
  
  const islandSize = goalConfig.radius;
  const seed = worldX * 0.071 + worldY * 0.113;
  const pointCount = isMinimap ? 14 : 22;
  const shorePoints = createIslandShore(seed, islandSize, pointCount);
  const shelfPoints = scaleLoopPoints(shorePoints, 1.14, 1.13, 4);
  const beachPoints = scaleLoopPoints(shorePoints, 1.03, 1.02, 1);
  const landPoints = scaleLoopPoints(shorePoints, 0.9, 0.88, -4);
  const minimapLineWidth = 1 / Math.max(scale, 0.001);

  // A translucent reef shelf and a narrow sand rim soften the transition to water.
  traceSmoothLoop(shelfPoints);
  ctx.fillStyle = 'rgba(73, 158, 166, 0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(140, 211, 207, 0.3)';
  ctx.lineWidth = isMinimap ? minimapLineWidth * 0.6 : 2;
  ctx.stroke();

  traceSmoothLoop(beachPoints);
  ctx.fillStyle = '#d8c58f';
  ctx.shadowColor = 'rgba(6, 35, 43, 0.2)';
  ctx.shadowBlur = isMinimap ? 0 : 9;
  ctx.shadowOffsetY = isMinimap ? 0 : 5;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#b7aa78';
  ctx.lineWidth = isMinimap ? minimapLineWidth * 0.75 : 1.6;
  ctx.stroke();

  traceSmoothLoop(landPoints);
  const landGradient = ctx.createRadialGradient(
    -islandSize * 0.18,
    -islandSize * 0.22,
    islandSize * 0.05,
    0,
    0,
    islandSize
  );
  landGradient.addColorStop(0, '#78945a');
  landGradient.addColorStop(0.55, '#547a4b');
  landGradient.addColorStop(1, '#345f42');
  ctx.fillStyle = landGradient;
  ctx.fill();
  ctx.strokeStyle = '#31553a';
  ctx.lineWidth = isMinimap ? minimapLineWidth * 0.8 : 2;
  ctx.stroke();

  if (isMinimap) {
    ctx.fillStyle = '#725038';
    ctx.fillRect(-islandSize * 0.1, islandSize * 0.42, islandSize * 0.2, islandSize * 0.42);
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(0, -islandSize * 0.48, minimapLineWidth * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Soft terrain patches and a footpath break up the broad green interior.
  ctx.save();
  traceSmoothLoop(landPoints);
  ctx.clip();
  for (let patch = 0; patch < 7; patch++) {
    const patchX = (hash01(seed, patch, 61) - 0.5) * islandSize * 1.2;
    const patchY = (hash01(seed, patch, 62) - 0.5) * islandSize * 0.75;
    const patchRadiusX = 24 + hash01(seed, patch, 63) * 55;
    const patchRadiusY = 14 + hash01(seed, patch, 64) * 32;
    ctx.fillStyle = patch % 2 === 0
      ? 'rgba(36, 92, 54, 0.14)'
      : 'rgba(164, 173, 94, 0.1)';
    ctx.beginPath();
    ctx.ellipse(patchX, patchY, patchRadiusX, patchRadiusY, hash01(seed, patch, 65), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(207, 192, 139, 0.42)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(0, islandSize * 0.48);
  ctx.bezierCurveTo(
    -islandSize * 0.08,
    islandSize * 0.18,
    islandSize * 0.12,
    -islandSize * 0.02,
    0,
    -islandSize * 0.43
  );
  ctx.stroke();
  ctx.restore();

  // Varied clustered canopies replace the evenly spaced circular trees.
  for (let i = 0; i < 17; i++) {
    const angle = hash01(seed, i, 71) * Math.PI * 2;
    const distance = islandSize * (0.28 + hash01(seed, i, 72) * 0.38);
    const treeX = Math.cos(angle) * distance;
    const treeY = Math.sin(angle) * distance * 0.66 - islandSize * 0.02;
    if (treeY > islandSize * 0.28 && Math.abs(treeX) < islandSize * 0.34) continue;
    drawTopDownTree(
      treeX,
      treeY,
      10 + hash01(seed, i, 73) * 8,
      seed + i
    );
  }
  
  // A narrow finger pier now projects naturally out from the southern shore.
  const pierX = -islandSize * 0.08;
  const pierY = islandSize * 0.34;
  const pierWidth = islandSize * 0.18;
  const pierLength = islandSize * 0.52;
  const pierHeadWidth = islandSize * 0.5;
  const pierHeadHeight = islandSize * 0.1;

  // A protected turning basin makes the end of the pier read as a real harbor
  // instead of a wooden path laid over the island.
  ctx.fillStyle = 'rgba(8, 54, 67, 0.3)';
  ctx.beginPath();
  ctx.ellipse(
    pierX,
    pierY + pierLength + islandSize * 0.035,
    pierHeadWidth * 0.82,
    islandSize * 0.115,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.fillStyle = 'rgba(78, 166, 177, 0.24)';
  ctx.beginPath();
  ctx.ellipse(
    pierX,
    pierY + pierLength + islandSize * 0.03,
    pierHeadWidth * 0.58,
    islandSize * 0.065,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.strokeStyle = 'rgba(182, 235, 230, 0.34)';
  ctx.lineWidth = 1.2;
  for (let ripple = 0; ripple < 3; ripple++) {
    ctx.beginPath();
    ctx.ellipse(
      pierX,
      pierY + pierLength + islandSize * (0.005 + ripple * 0.035),
      pierHeadWidth * (0.3 + ripple * 0.12),
      islandSize * (0.018 + ripple * 0.006),
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(7, 32, 42, 0.25)';
  ctx.fillRect(pierX - pierWidth / 2 + 6, pierY + 7, pierWidth, pierLength);
  ctx.fillRect(
    pierX - pierHeadWidth / 2 + 6,
    pierY + pierLength - pierHeadHeight + 7,
    pierHeadWidth,
    pierHeadHeight
  );

  ctx.fillStyle = '#765334';
  ctx.strokeStyle = '#493724';
  ctx.lineWidth = 1.5;
  ctx.fillRect(pierX - pierWidth / 2, pierY, pierWidth, pierLength);
  ctx.strokeRect(pierX - pierWidth / 2, pierY, pierWidth, pierLength);
  ctx.fillRect(
    pierX - pierHeadWidth / 2,
    pierY + pierLength - pierHeadHeight,
    pierHeadWidth,
    pierHeadHeight
  );
  ctx.strokeRect(
    pierX - pierHeadWidth / 2,
    pierY + pierLength - pierHeadHeight,
    pierHeadWidth,
    pierHeadHeight
  );

  ctx.strokeStyle = 'rgba(55, 38, 24, 0.65)';
  ctx.lineWidth = 0.8;
  for (let plankY = pierY + 9; plankY < pierY + pierLength; plankY += 10) {
    ctx.beginPath();
    ctx.moveTo(pierX - pierWidth / 2, plankY);
    ctx.lineTo(pierX + pierWidth / 2, plankY);
    ctx.stroke();
  }

  ctx.fillStyle = '#352c23';
  for (const postX of [pierX - pierWidth * 0.42, pierX + pierWidth * 0.42]) {
    for (let postY = pierY + 12; postY < pierY + pierLength; postY += 32) {
      ctx.beginPath();
      ctx.arc(postX, postY, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawMooredBoat(
    pierX - pierWidth * 0.95,
    pierY + pierLength * 0.5,
    48,
    18,
    '#b94b42',
    -1
  );
  drawMooredBoat(
    pierX + pierWidth * 1.05,
    pierY + pierLength * 0.72,
    39,
    15,
    '#d5a544',
    1
  );

  // Compact loading crane and colored harbor bollards.
  ctx.strokeStyle = '#c29a43';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(pierX, pierY + pierLength * 0.26);
  ctx.lineTo(pierX, pierY + pierLength * 0.1);
  ctx.lineTo(pierX + pierWidth * 0.7, pierY + pierLength * 0.16);
  ctx.stroke();
  ctx.strokeStyle = '#51432f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pierX + pierWidth * 0.7, pierY + pierLength * 0.16);
  ctx.lineTo(pierX + pierWidth * 0.7, pierY + pierLength * 0.28);
  ctx.stroke();

  ctx.fillStyle = accentColor;
  for (const bollardX of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      pierX + bollardX * pierHeadWidth * 0.42,
      pierY + pierLength - pierHeadHeight * 0.5,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Amber harbor lights and tall mooring posts give the player a readable
  // visual destination at both ends of the route.
  for (const postX of [
    pierX - pierHeadWidth * 0.42,
    pierX + pierHeadWidth * 0.42
  ]) {
    ctx.fillStyle = '#40372a';
    ctx.fillRect(postX - 2, pierY + pierLength - pierHeadHeight - 9, 4, 17);
    drawHarborBeacon(postX, pierY + pierLength - pierHeadHeight - 12, accentColor);
  }
  
  // Top-down pitched roofs sit naturally in the scene and cast soft shadows.
  drawRoofedBuilding(
    -islandSize * 0.34,
    -islandSize * 0.02,
    islandSize * 0.34,
    islandSize * 0.2,
    -0.08,
    {
      wall: '#c49a6c',
      lightRoof: '#a85d3c',
      darkRoof: '#7c432f'
    }
  );
  drawRoofedBuilding(
    islandSize * 0.03,
    -islandSize * 0.12,
    islandSize * 0.23,
    islandSize * 0.19,
    0.06,
    {
      wall: '#ddc69b',
      lightRoof: '#b56a43',
      darkRoof: '#854b34'
    }
  );
  drawRoofedBuilding(
    islandSize * 0.35,
    -islandSize * 0.03,
    islandSize * 0.27,
    islandSize * 0.17,
    -0.04,
    {
      wall: '#bca57e',
      lightRoof: '#8d5941',
      darkRoof: '#684130'
    }
  );

  // Cargo and nets cluster near the shore end of the pier.
  for (let crate = 0; crate < 5; crate++) {
    const crateX = pierX - islandSize * 0.16 + (crate % 3) * 16;
    const crateY = pierY - 15 - Math.floor(crate / 3) * 15;
    ctx.fillStyle = crate % 2 === 0 ? '#9b6b3c' : '#bb8650';
    ctx.fillRect(crateX, crateY, 12, 11);
    ctx.strokeStyle = '#68482f';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(crateX, crateY, 12, 11);
  }

  drawHarborSign(
    pierX - islandSize * 0.26,
    pierY - islandSize * 0.035,
    portLabel,
    accentColor
  );

  // The lighthouse is viewed from above: concentric tower rings and a sweeping beam.
  const lighthouseX = islandSize * 0.08;
  const lighthouseY = -islandSize * 0.54;
  const beamRotation = animationTime * 0.012;
  const lightPulse = 0.5 + Math.sin(animationTime * 0.08) * 0.15;

  ctx.save();
  ctx.translate(lighthouseX, lighthouseY);
  ctx.rotate(beamRotation);
  const beamGradient = ctx.createLinearGradient(0, 0, islandSize * 0.48, 0);
  beamGradient.addColorStop(0, `rgba(255, 244, 184, ${0.24 + lightPulse * 0.18})`);
  beamGradient.addColorStop(1, 'rgba(255, 244, 184, 0)');
  ctx.fillStyle = beamGradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(islandSize * 0.52, -islandSize * 0.1);
  ctx.lineTo(islandSize * 0.52, islandSize * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const beaconGlow = ctx.createRadialGradient(
    lighthouseX,
    lighthouseY,
    0,
    lighthouseX,
    lighthouseY,
    islandSize * 0.12
  );
  beaconGlow.addColorStop(0, `rgba(255, 244, 190, ${0.35 + lightPulse * 0.25})`);
  beaconGlow.addColorStop(1, 'rgba(255, 244, 190, 0)');
  ctx.fillStyle = beaconGlow;
  ctx.beginPath();
  ctx.arc(lighthouseX, lighthouseY, islandSize * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(31, 42, 39, 0.25)';
  ctx.beginPath();
  ctx.arc(lighthouseX + 5, lighthouseY + 6, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4f1df';
  ctx.strokeStyle = '#b7b6aa';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(lighthouseX, lighthouseY, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(lighthouseX, lighthouseY, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff4b8';
  ctx.beginPath();
  ctx.arc(lighthouseX, lighthouseY, 4.5, 0, Math.PI * 2);
  ctx.fill();
  
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
  drawIsland(goalScreenX, goalScreenY, '#4caf50', goal.x, goal.y, 1.0, false, 'ARRIVAL');
}

function recordShipwreck(x, y) {
  const wreckSize = Math.max(42, Math.min(78, ship.width * 0.9));
  shipwrecks.push({
    x,
    y,
    size: wreckSize,
    rotation: ship.rotation,
    seed: shipwrecks.length * 977 + x * 0.031 + y * 0.017
  });
}

// Check collision between ship, icebergs, and remembered shipwrecks.
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
      recordShipwreck(shipWorldX, shipWorldY);
      gameOver = true;
      gameRunning = false;
      return;
    }
  }

  for (const shipwreck of shipwrecks) {
    const dx = shipWorldX - shipwreck.x;
    const dy = shipWorldY - shipwreck.y;
    const distanceSquared = dx * dx + dy * dy;
    const maxWreckCheckDistance = ship.length + shipwreck.size + 50;

    if (distanceSquared > maxWreckCheckDistance * maxWreckCheckDistance) {
      continue;
    }

    const distance = Math.sqrt(distanceSquared);
    if (distance < shipRadius + shipwreck.size) {
      recordShipwreck(shipWorldX, shipWorldY);
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
  const panelWidth = 230;
  const panelHeight = 138;
  
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
  
  // Ship and speed display
  ctx.fillText(`Ship: ${ship.name}`, panelX + 10, panelY + 14);
  ctx.fillText(`Speed: ${speedInKnots.toFixed(1)} knots`, panelX + 10, panelY + 40);
  
  // Distance display
  ctx.fillText(`Distance: ${distanceInNauticalMiles.toFixed(2)} nm`, panelX + 10, panelY + 66);
  
  // Coal indicator
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Coal:', panelX + 10, panelY + 94);
  
  // Coal bar background
  const barX = panelX + 10;
  const barY = panelY + 116;
  const barWidth = 210;
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

  // Wrecks remain visible in the route history after restarting the game.
  for (const shipwreck of shipwrecks) {
    const wreckMapX = mapOffsetX + shipwreck.x * scale;
    const wreckMapY = mapOffsetY + shipwreck.y * scale;
    drawShipwreckMarker(
      wreckMapX,
      wreckMapY,
      shipwreck.size * scale * (minimapExpanded ? 0.32 : 0.22),
      minimapExpanded
    );
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

  // Draw layered ocean color and animated surface detail.
  drawOcean();

  // Draw waves
  drawWaves();

  // Draw the ship wake below world obstacles and the vessel itself.
  drawShipWake();

  // Draw icebergs
  drawIcebergs();

  // Draw remembered wrecks as persistent world obstacles.
  drawShipwrecks();

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
