const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');

const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');
const startBtn = document.getElementById('start-btn');
const scoreElement = document.getElementById('score');
const linesElement = document.getElementById('lines');
const levelElement = document.getElementById('level');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 24; // 240 / 10 = 24

const COLORS = [
  null,
  '#00f0f0', // I - Cyan
  '#0000f0', // J - Blue
  '#f0a000', // L - Orange
  '#f0f000', // O - Yellow
  '#00f000', // S - Green
  '#a000f0', // T - Purple
  '#f00000'  // Z - Red
];

const PIECES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  J: [
    [2, 0, 0],
    [2, 2, 2],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 3],
    [3, 3, 3],
    [0, 0, 0]
  ],
  O: [
    [4, 4],
    [4, 4]
  ],
  S: [
    [0, 5, 5],
    [5, 5, 0],
    [0, 0, 0]
  ],
  T: [
    [0, 6, 0],
    [6, 6, 6],
    [0, 0, 0]
  ],
  Z: [
    [7, 7, 0],
    [0, 7, 7],
    [0, 0, 0]
  ]
};

const PIECE_KEYS = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

let grid = createMatrix(COLS, ROWS);
let score = 0;
let lines = 0;
let level = 1;

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = false;
let isGameOver = true;
let animationId = null;

const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
  nextMatrix: null
};

function createMatrix(w, h) {
  const matrix = [];
  while (h--) {
    matrix.push(new Array(w).fill(0));
  }
  return matrix;
}

function getRandomPiece() {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  return PIECES[key].map(row => [...row]);
}

function drawBlock(ctx, x, y, colorIdx, isGhost = false) {
  const px = x * BLOCK_SIZE;
  const py = y * BLOCK_SIZE;
  const color = COLORS[colorIdx];

  ctx.save();
  if (isGhost) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 1.5, py + 1.5, BLOCK_SIZE - 3, BLOCK_SIZE - 3);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

    // Bevel highlights & shadow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(px, py, BLOCK_SIZE, 3);
    ctx.fillRect(px, py, 3, BLOCK_SIZE);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(px, py + BLOCK_SIZE - 3, BLOCK_SIZE, 3);
    ctx.fillRect(px + BLOCK_SIZE - 3, py, 3, BLOCK_SIZE);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
  }
  ctx.restore();
}

function drawGridLines(ctx, width, height) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += BLOCK_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += BLOCK_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawMatrix(ctx, matrix, offset, isGhost = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawBlock(ctx, x + offset.x, y + offset.y, value, isGhost);
      }
    });
  });
}

function getGhostPosition() {
  const ghost = {
    pos: { ...player.pos },
    matrix: player.matrix
  };
  while (!collide(grid, ghost)) {
    ghost.pos.y++;
  }
  ghost.pos.y--;
  return ghost.pos;
}

function draw() {
  context.fillStyle = '#05070a';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawGridLines(context, canvas.width, canvas.height);

  // Draw locked blocks
  drawMatrix(context, grid, { x: 0, y: 0 });

  if (player.matrix && !isGameOver) {
    // Draw ghost piece
    const ghostPos = getGhostPosition();
    drawMatrix(context, player.matrix, ghostPos, true);

    // Draw active player piece
    drawMatrix(context, player.matrix, player.pos);
  }
}

function drawNextPiece() {
  nextContext.fillStyle = '#05070a';
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!player.nextMatrix) return;

  const matrix = player.nextMatrix;
  const offX = Math.floor((nextCanvas.width / BLOCK_SIZE - matrix[0].length) / 2);
  const offY = Math.floor((nextCanvas.height / BLOCK_SIZE - matrix.length) / 2);

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawBlock(nextContext, x + offX, y + offY, value);
      }
    });
  });
}

function collide(arena, p) {
  const m = p.matrix;
  const o = p.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (
        m[y][x] !== 0 &&
        (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0
      ) {
        return true;
      }
    }
  }
  return false;
}

function merge(arena, p) {
  p.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + p.pos.y][x + p.pos.x] = value;
      }
    });
  });
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) {
    matrix.forEach(row => row.reverse());
  } else {
    matrix.reverse();
  }
}

function playerRotate(dir) {
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(grid, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(grid, player)) {
    player.pos.x -= dir;
  }
}

function playerDrop() {
  player.pos.y++;
  if (collide(grid, player)) {
    player.pos.y--;
    merge(grid, player);
    playerReset();
    arenaSweep();
    updateScore();
  }
  dropCounter = 0;
}

function playerHardDrop() {
  while (!collide(grid, player)) {
    player.pos.y++;
    score += 2; // Bonus points for hard drop
  }
  player.pos.y--;
  merge(grid, player);
  playerReset();
  arenaSweep();
  updateScore();
  dropCounter = 0;
}

function playerReset() {
  if (!player.nextMatrix) {
    player.nextMatrix = getRandomPiece();
  }
  player.matrix = player.nextMatrix;
  player.nextMatrix = getRandomPiece();
  player.pos.y = 0;
  player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);

  drawNextPiece();

  if (collide(grid, player)) {
    gameOver();
  }
}

function arenaSweep() {
  let rowCount = 0;
  outer: for (let y = grid.length - 1; y >= 0; --y) {
    for (let x = 0; x < grid[y].length; ++x) {
      if (grid[y][x] === 0) {
        continue outer;
      }
    }

    const row = grid.splice(y, 1)[0].fill(0);
    grid.unshift(row);
    ++y;
    rowCount++;
  }

  if (rowCount > 0) {
    // Scoring system: 1 line = 100, 2 lines = 300, 3 lines = 500, 4 lines = 800
    const lineScores = [0, 100, 300, 500, 800];
    score += (lineScores[rowCount] || rowCount * 200) * level;
    lines += rowCount;
    level = Math.floor(lines / 10) + 1;
    // Speed up drop interval with higher level
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  }
}

function updateScore() {
  scoreElement.innerText = score;
  linesElement.innerText = lines;
  levelElement.innerText = level;
}

function gameOver() {
  isGameOver = true;
  cancelAnimationFrame(animationId);
  overlayMsg.innerText = '게임 오버!';
  startBtn.innerText = '다시 시작 (Enter)';
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (isGameOver) return;
  isPaused = !isPaused;
  if (isPaused) {
    overlayMsg.innerText = '일시 정지됨';
    startBtn.innerText = '계속하기 (P)';
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    update();
  }
}

function startGame() {
  grid = createMatrix(COLS, ROWS);
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 1000;
  isGameOver = false;
  isPaused = false;
  player.nextMatrix = null;

  updateScore();
  playerReset();
  overlay.classList.add('hidden');

  lastTime = performance.now();
  if (animationId) cancelAnimationFrame(animationId);
  update();
}

function update(time = 0) {
  if (isGameOver || isPaused) return;

  const deltaTime = time - lastTime;
  lastTime = time;

  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    playerDrop();
  }

  draw();
  animationId = requestAnimationFrame(update);
}

document.addEventListener('keydown', event => {
  if (isGameOver) {
    if (event.key === 'Enter') {
      startGame();
    }
    return;
  }

  if (event.key === 'p' || event.key === 'P' || event.key === 'ㅔ') {
    togglePause();
    return;
  }

  if (isPaused) return;

  switch (event.keyCode) {
    case 37: // Left Arrow
      playerMove(-1);
      break;
    case 39: // Right Arrow
      playerMove(1);
      break;
    case 40: // Down Arrow
      playerDrop();
      score += 1;
      updateScore();
      break;
    case 38: // Up Arrow
      playerRotate(1);
      break;
    case 32: // Space
      event.preventDefault(); // Prevent page scroll
      playerHardDrop();
      break;
  }
});

startBtn.addEventListener('click', () => {
  if (isGameOver) {
    startGame();
  } else if (isPaused) {
    togglePause();
  }
});

// Initial draw
draw();
drawNextPiece();
