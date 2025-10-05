const { Engine, Render, Runner, Bodies, Composite, Events, Body } = Matter;

const canvas = document.getElementById("gameCanvas");
const width = window.innerWidth;
const height = window.innerHeight;
const levelText = document.getElementById("levelText");
const bulletText = document.getElementById("bulletText");

const engine = Engine.create();
const world = engine.world;

const render = Render.create({
  canvas,
  engine,
  options: { width, height, wireframes: false, background: "#111" }
});
Render.run(render);
Runner.run(Runner.create(), engine);

// World boundaries
const walls = [
  Bodies.rectangle(width / 2, height, width, 40, { isStatic: true }),
  Bodies.rectangle(width / 2, 0, width, 40, { isStatic: true }),
  Bodies.rectangle(0, height / 2, 40, height, { isStatic: true }),
  Bodies.rectangle(width, height / 2, 40, height, { isStatic: true })
];
Composite.add(world, walls);

const player = { x: 150, y: height - 100 };

// Cannon setup
const cannonBase = Bodies.circle(player.x, player.y + 10, 20, {
  isStatic: true,
  render: { fillStyle: "#555" }
});
const cannonBarrel = Bodies.rectangle(player.x + 30, player.y, 60, 20, {
  isStatic: true,
  render: { fillStyle: "#888" },
  label: "cannonBarrel"
});
Composite.add(world, [cannonBase, cannonBarrel]);

function updateCannon(angle) {
  Body.setAngle(cannonBarrel, angle);
  Body.setPosition(cannonBarrel, {
    x: player.x + Math.cos(angle) * 30,
    y: player.y + Math.sin(angle) * 30
  });
}

// Levels and targets
const levels = [
  [{ x: 700, y: height - 120 }],
  [{ x: 700, y: height - 120 }, { x: 900, y: height - 220 }],
  [{ x: 650, y: height - 150 }, { x: 850, y: height - 200 }, { x: 1050, y: height - 120 }],
  [{ x: 650, y: height - 250 }, { x: 900, y: height - 150 }, { x: 1100, y: height - 200 }, { x: 1200, y: height - 120 }],
  [{ x: 600, y: height - 180 }, { x: 800, y: height - 260 }, { x: 1000, y: height - 220 }, { x: 1150, y: height - 120 }, { x: 1300, y: height - 200 }]
];

const bulletsPerLevel = [5, 6, 7, 8, 10]; // bullets per level
let bulletsLeft = bulletsPerLevel[0];

let currentLevel = 0;
let enemies = [];
let hazards = [];
let gameOver = false;

// Charge shot variables
let isCharging = false;
let chargeStartTime = 0;
const maxChargeTime = 2000;
const minSpeed = 10;
const maxSpeed = 50;

// Restart button
const restartButton = document.createElement("button");
restartButton.textContent = "Restart";
restartButton.style.position = "absolute";
restartButton.style.top = "50%";
restartButton.style.left = "50%";
restartButton.style.transform = "translate(-50%, -50%)";
restartButton.style.padding = "20px 40px";
restartButton.style.fontSize = "24px";
restartButton.style.display = "none";
document.body.appendChild(restartButton);

// Restart logic: clear bullets and reset level
restartButton.addEventListener("click", () => {
  gameOver = false;
  restartButton.style.display = "none";
  currentLevel = 0;

  // Remove all bullets
  Composite.allBodies(world).forEach(body => {
    if (body.label === "bullet") Composite.remove(world, body);
  });

  spawnLevel(currentLevel);
});

// Spawn level with enemies and hazards, also remove old bullets
function spawnLevel(levelIndex) {
  // Remove enemies and hazards
  enemies.forEach(e => Composite.remove(world, e));
  hazards.forEach(h => Composite.remove(world, h));
  enemies = [];
  hazards = [];

  // Remove bullets left from previous level
  Composite.allBodies(world).forEach(body => {
    if (body.label === "bullet") Composite.remove(world, body);
  });

  bulletsLeft = bulletsPerLevel[levelIndex];
  bulletText.textContent = `Bullets Left: ${bulletsLeft}`;
  levelText.textContent = `Level ${levelIndex + 1}`;

  // Spawn enemies
  const layout = levels[levelIndex];
  layout.forEach(pos => {
    const target = Bodies.rectangle(pos.x, pos.y, 40, 40, {
      isStatic: true,
      render: { fillStyle: "red" }
    });
    enemies.push(target);
  });

  // Spawn hazard
  const hazard = Bodies.rectangle(800 + levelIndex * 100, height - 200, 40, 40, {
    isStatic: true,
    render: { fillStyle: "blue" },
    label: "hazard"
  });
  hazards.push(hazard);

  Composite.add(world, [...enemies, ...hazards]);
}

// Shoot bullet
function shootBullet(targetX, targetY, chargePercent) {
  if (gameOver || bulletsLeft <= 0) return;

  bulletsLeft--;
  bulletText.textContent = `Bullets Left: ${bulletsLeft}`;

  const speed = minSpeed + (maxSpeed - minSpeed) * chargePercent;
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  const bullet = Bodies.circle(player.x, player.y, 8, {
    restitution: 0.9,
    friction: 0,
    label: "bullet"
  });
  bullet.render.fillStyle = "yellow";
  Body.setVelocity(bullet, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
  Composite.add(world, bullet);

  updateCannon(angle);

  // Fail level if out of bullets and targets remain
  if (bulletsLeft <= 0 && enemies.length > 0) {
    gameOver = true;
    levelText.textContent = "LEVEL FAILED!";
    restartButton.style.display = "block";
  }
}

// Mouse events
canvas.addEventListener("mousedown", e => {
  if (gameOver) return;
  isCharging = true;
  chargeStartTime = Date.now();
});

canvas.addEventListener("mouseup", e => {
  if (!isCharging || gameOver) return;
  isCharging = false;
  const chargePercent = Math.min((Date.now() - chargeStartTime) / maxChargeTime, 1);
  shootBullet(e.clientX, e.clientY, chargePercent);
});

// Continuous cannon tracking
canvas.addEventListener("mousemove", e => {
  if (gameOver) return;
  const angle = Math.atan2(e.clientY - player.y, e.clientX - player.x);
  updateCannon(angle);
});

// Collision detection
Events.on(engine, "collisionStart", event => {
  if (gameOver) return;

  event.pairs.forEach(pair => {
    const { bodyA, bodyB } = pair;
    [bodyA, bodyB].forEach(body => {

      if (enemies.includes(body)) {
        Composite.remove(world, body);
        enemies = enemies.filter(e => e !== body);

        if (enemies.length === 0) {
          currentLevel++;
          if (currentLevel < levels.length) {
            setTimeout(() => spawnLevel(currentLevel), 1000);
          } else {
            levelText.textContent = "YOU WIN!";
            bulletText.textContent = "";
          }
        }
      }

      if (hazards.includes(body)) {
        gameOver = true;
        levelText.textContent = "GAME OVER!";
        restartButton.style.display = "block";
      }

    });
  });
});

// Initialize game
spawnLevel(currentLevel);
