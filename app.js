/* ══════════════════════════════════════════════════════
   RITUAL PREDICT — App Logic
   Swipe engine, card management, results
   ══════════════════════════════════════════════════════ */

// ── Prediction Data ──
const PREDICTIONS = [
  {
    id: 1,
    emoji: '📢',
    category: 'ANNOUNCEMENTS',
    question: 'Ritual team will post an announcement today',
    odds: '72%',
    voters: 341,
  },
  {
    id: 2,
    emoji: '📌',
    category: 'MODS',
    question: 'A message will get pinned by a mod today',
    odds: '65%',
    voters: 278,
  },
  {
    id: 3,
    emoji: '🤡',
    category: 'ROLES',
    question: 'A member will get the Dunce role today',
    odds: '43%',
    voters: 189,
  },
  {
    id: 4,
    emoji: '💬',
    category: 'ACTIVITY',
    question: 'Total messages in community channel will be above 5K+ today',
    odds: '38%',
    voters: 412,
  },
  {
    id: 5,
    emoji: '🚀',
    category: 'ECOSYSTEM',
    question: 'Any new dApp will be added to the list today',
    odds: '29%',
    voters: 156,
  },
  {
    id: 6,
    emoji: '👥',
    category: 'GROWTH',
    question: '5+ new members will join Ritual today',
    odds: '81%',
    voters: 367,
  },
  {
    id: 7,
    emoji: '😎',
    category: 'VIBES',
    question: 'Total emoji used by members today will be 500+',
    odds: '55%',
    voters: 223,
  },
  {
    id: 8,
    emoji: '✍️',
    category: 'CONTRIBUTIONS',
    question: 'Total content posted by members in contribution channel will be 50+',
    odds: '47%',
    voters: 198,
  },
];

const state = {
  currentIndex: 0,
  results: [], // { id, answer: 'yes' | 'no' | 'skip' }
  isDragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  animating: false,
  username: null, // Add username to state
};

// ── DOM References ──
const introScreen = document.getElementById('intro-screen');
const mainApp = document.getElementById('main-app');
const resultsScreen = document.getElementById('results-screen');
const cardStack = document.getElementById('card-stack');
const cardsEmpty = document.getElementById('cards-empty');
const progressFill = document.getElementById('progress-fill');
const progressDots = document.getElementById('progress-dots');
const counterCurrent = document.getElementById('counter-current');
const btnStart = document.getElementById('btn-start');
const btnYes = document.getElementById('btn-yes');
const btnNo = document.getElementById('btn-no');
const btnSkip = document.getElementById('btn-skip');
const btnRestart = document.getElementById('btn-restart');
const confettiContainer = document.getElementById('confetti-container');
const bgCanvas = document.getElementById('bg-canvas');

// New DOM elements for Auth & Leaderboard
const discordUsernameInput = document.getElementById('discord-username');
const authError = document.getElementById('auth-error');
const statTotalUsers = document.getElementById('stat-total-users');
const btnBrowse = document.getElementById('btn-browse');
const navLeaderboard = document.getElementById('nav-leaderboard');
const navHome = document.getElementById('nav-home');
const navBrandLogo = document.getElementById('nav-brand-logo');
const leaderboardModal = document.getElementById('leaderboard-modal');
const btnCloseLeaderboard = document.getElementById('btn-close-leaderboard');
const leaderboardList = document.getElementById('leaderboard-list');

// ── Swipe Config ──
const SWIPE_THRESHOLD = 80;        // px to trigger a swipe
const MAX_ROTATION = 15;           // degrees at full drag
const DRAG_OPACITY_SCALE = 0.015;  // how fast overlay appears

// ══════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════

function init() {
  createFloatingParticles();
  buildProgressDots();
  renderCards();
  bindEvents();
  fetchTotalUsers(); // Load stats on startup
}

async function fetchTotalUsers() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    if (data && Array.isArray(data)) {
      statTotalUsers.textContent = data.length;
    }
  } catch (e) {
    console.error('Failed to load stats', e);
  }
}

function createFloatingParticles() {
  const count = 15;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'floating-particle';
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${60 + Math.random() * 40}%`;
    particle.style.animationDelay = `${Math.random() * 8}s`;
    particle.style.animationDuration = `${6 + Math.random() * 6}s`;
    particle.style.width = `${2 + Math.random() * 3}px`;
    particle.style.height = particle.style.width;
    bgCanvas.appendChild(particle);
  }
}

function buildProgressDots() {
  progressDots.innerHTML = '';
  for (let i = 0; i < PREDICTIONS.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'progress-dot' + (i === 0 ? ' active' : '');
    dot.dataset.index = i;
    progressDots.appendChild(dot);
  }
}

function renderCards() {
  cardStack.innerHTML = '';
  // Render up to 3 visible cards (current + 2 behind)
  const start = state.currentIndex;
  const end = Math.min(start + 3, PREDICTIONS.length);
  const count = end - start;

  // Render from back to front (bg cards first, top card last for DOM order)
  for (let i = end - 1; i >= start; i--) {
    const stackIndex = i - start; // 0 = top card, 1 = behind, 2 = furthest
    const card = createCardElement(PREDICTIONS[i], stackIndex);
    card.dataset.stack = stackIndex;
    cardStack.appendChild(card);
  }

  // Attach swipe to top card (last child = stack index 0)
  const topCard = cardStack.lastElementChild;
  if (topCard) {
    attachSwipeListeners(topCard);
  }
}

function createCardElement(prediction, stackIndex) {
  const card = document.createElement('div');
  card.className = 'predict-card';
  card.dataset.id = prediction.id;

  card.innerHTML = `
    <div class="card-inner">
      <!-- Swipe overlays -->
      <div class="swipe-overlay swipe-overlay-yes">
        <div class="swipe-label">YES</div>
      </div>
      <div class="swipe-overlay swipe-overlay-no">
        <div class="swipe-label">NOPE</div>
      </div>

      <!-- Content -->
      <div class="card-category">
        <span class="card-category-tag">${prediction.category}</span>
        <span class="card-category-discord">#discord</span>
      </div>

      <div class="card-emoji">${prediction.emoji}</div>

      <div class="card-question">${prediction.question}</div>

      <div class="card-meta">
        <div class="card-odds">
          <span class="card-odds-label">Community Odds</span>
          <span class="card-odds-value">${prediction.odds}</span>
        </div>
        <div class="card-voters">
          <span class="card-voters-dot"></span>
          <span>${prediction.voters} predictions</span>
        </div>
        <div class="card-hint">← swipe to decide →</div>
      </div>
    </div>
  `;

  return card;
}

// ══════════════════════════════════════════════
// EVENT BINDING
// ══════════════════════════════════════════════

function bindEvents() {
  btnStart.addEventListener('click', startGame);
  btnYes.addEventListener('click', () => handleButtonSwipe('yes'));
  btnNo.addEventListener('click', () => handleButtonSwipe('no'));
  btnSkip.addEventListener('click', () => handleButtonSwipe('skip'));
  btnRestart.addEventListener('click', restartGame);
  
  // New Events
  btnBrowse.addEventListener('click', openLeaderboard);
  navLeaderboard.addEventListener('click', (e) => { e.preventDefault(); openLeaderboard(); });
  navHome.addEventListener('click', goHome);
  navBrandLogo.addEventListener('click', goHome);
  btnCloseLeaderboard.addEventListener('click', () => leaderboardModal.classList.remove('active'));

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (state.animating || mainApp.style.opacity === '0') return;
    if (e.key === 'ArrowRight') handleButtonSwipe('yes');
    else if (e.key === 'ArrowLeft') handleButtonSwipe('no');
    else if (e.key === 'ArrowDown') handleButtonSwipe('skip');
  });
}

function attachSwipeListeners(card) {
  // Touch events
  card.addEventListener('touchstart', onDragStart, { passive: true });
  card.addEventListener('touchmove', onDragMove, { passive: false });
  card.addEventListener('touchend', onDragEnd);
  card.addEventListener('touchcancel', onDragEnd);

  // Mouse events
  card.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

function detachMouseListeners() {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

// ══════════════════════════════════════════════
// SWIPE ENGINE
// ══════════════════════════════════════════════

function getPointerPosition(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function onDragStart(e) {
  if (state.animating) return;
  const pos = getPointerPosition(e);
  state.isDragging = true;
  state.startX = pos.x;
  state.startY = pos.y;
  state.currentX = 0;
  state.currentY = 0;

  const card = getTopCard();
  if (card) {
    card.classList.add('dragging');
  }
}

function onDragMove(e) {
  if (!state.isDragging) return;
  if (e.cancelable) e.preventDefault();

  const pos = getPointerPosition(e);
  state.currentX = pos.x - state.startX;
  state.currentY = pos.y - state.startY;

  const card = getTopCard();
  if (!card) return;

  // Apply transform
  const rotation = (state.currentX / window.innerWidth) * MAX_ROTATION;
  const dampenedY = state.currentY * 0.3;
  card.style.transform = `translateX(${state.currentX}px) translateY(${dampenedY}px) rotate(${rotation}deg)`;

  // Show YES/NO overlay
  const yesOverlay = card.querySelector('.swipe-overlay-yes');
  const noOverlay = card.querySelector('.swipe-overlay-no');

  if (state.currentX > 0) {
    yesOverlay.style.opacity = Math.min(state.currentX * DRAG_OPACITY_SCALE, 1);
    noOverlay.style.opacity = 0;
  } else {
    noOverlay.style.opacity = Math.min(Math.abs(state.currentX) * DRAG_OPACITY_SCALE, 1);
    yesOverlay.style.opacity = 0;
  }
}

function onDragEnd() {
  if (!state.isDragging) return;
  state.isDragging = false;

  const card = getTopCard();
  if (!card) return;
  card.classList.remove('dragging');

  // Determine if swipe was strong enough
  if (Math.abs(state.currentX) >= SWIPE_THRESHOLD) {
    const direction = state.currentX > 0 ? 'yes' : 'no';
    executeSwipe(card, direction);
  } else {
    // Snap back
    snapBack(card);
  }
}

function snapBack(card) {
  card.style.transform = '';
  const yesOverlay = card.querySelector('.swipe-overlay-yes');
  const noOverlay = card.querySelector('.swipe-overlay-no');
  if (yesOverlay) yesOverlay.style.opacity = 0;
  if (noOverlay) noOverlay.style.opacity = 0;
}

function executeSwipe(card, direction) {
  state.animating = true;

  // Apply exit animation class
  card.classList.add(direction === 'yes' ? 'swiped-right' : 'swiped-left');

  // Record result locally
  const currentPrediction = PREDICTIONS[state.currentIndex];
  state.results.push({
    id: currentPrediction.id,
    answer: direction,
  });

  // Save to DB (async, non-blocking)
  if (state.username && (direction === 'yes' || direction === 'no')) {
    fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: state.username,
        question_id: currentPrediction.id,
        answer: direction.toUpperCase()
      })
    }).catch(e => console.error('Failed to save prediction', e));
  }

  // Advance after animation
  setTimeout(() => {
    state.currentIndex++;
    state.animating = false;
    updateUI();

    if (state.currentIndex >= PREDICTIONS.length) {
      showResults();
    } else {
      renderCards();
    }
  }, 400);
}

function handleButtonSwipe(direction) {
  if (state.animating || state.currentIndex >= PREDICTIONS.length) return;

  const card = getTopCard();
  if (!card) return;

  if (direction === 'skip') {
    // Skip animation — float up
    state.animating = true;
    card.style.transform = 'translateY(-120%) scale(0.9)';
    card.style.opacity = '0';
    card.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';

    state.results.push({
      id: PREDICTIONS[state.currentIndex].id,
      answer: 'skip',
    });

    setTimeout(() => {
      state.currentIndex++;
      state.animating = false;
      updateUI();
      if (state.currentIndex >= PREDICTIONS.length) {
        showResults();
      } else {
        renderCards();
      }
    }, 350);
  } else {
    // Show overlay briefly, then execute
    const yesOverlay = card.querySelector('.swipe-overlay-yes');
    const noOverlay = card.querySelector('.swipe-overlay-no');

    if (direction === 'yes') {
      yesOverlay.style.opacity = 1;
    } else {
      noOverlay.style.opacity = 1;
    }

    setTimeout(() => executeSwipe(card, direction), 150);
  }
}

function getTopCard() {
  const cards = cardStack.querySelectorAll('.predict-card');
  return cards.length > 0 ? cards[cards.length - 1] : null;
}

// ══════════════════════════════════════════════
// UI UPDATES
// ══════════════════════════════════════════════

function updateUI() {
  // Counter
  const display = Math.min(state.currentIndex + 1, PREDICTIONS.length);
  counterCurrent.textContent = display;

  // Progress bar
  const pct = (state.currentIndex / PREDICTIONS.length) * 100;
  progressFill.style.width = `${pct}%`;

  // Progress dots
  const dots = progressDots.querySelectorAll('.progress-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('active', 'completed');
    if (i < state.currentIndex) dot.classList.add('completed');
    else if (i === state.currentIndex) dot.classList.add('active');
  });

  // Show empty state if all done
  if (state.currentIndex >= PREDICTIONS.length) {
    cardsEmpty.classList.add('visible');
  }
}

// ══════════════════════════════════════════════
// SCREENS
// ══════════════════════════════════════════════

async function startGame() {
  const username = discordUsernameInput.value.trim();
  
  if (!username) {
    authError.textContent = 'Please enter your Discord username.';
    return;
  }
  
  btnStart.disabled = true;
  authError.textContent = 'Connecting...';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Network response was not ok');
    
    state.username = data.username;
    authError.textContent = '';
    
    introScreen.classList.add('hidden');
    mainApp.style.opacity = '1';
    mainApp.style.pointerEvents = 'auto';
    mainApp.style.transition = 'opacity 0.5s ease';
    
  } catch (e) {
    authError.textContent = e.message || 'Failed to connect. Is the server running?';
    console.error(e);
  } finally {
    btnStart.disabled = false;
  }
}

async function openLeaderboard() {
  leaderboardModal.classList.add('active');
  leaderboardList.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Loading...</div>';
  
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    
    if (data.length === 0) {
      leaderboardList.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No predictions yet. Be the first!</div>';
    } else {
      leaderboardList.innerHTML = data.map((user, index) => `
        <div class="lb-row">
          <div>
            <span style="color: var(--text-muted); margin-right: 12px;">#${index + 1}</span>
            <span class="lb-user">${user.username}</span>
          </div>
          <div>
            <span class="lb-score">${user.score} pts</span>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    leaderboardList.innerHTML = '<div style="text-align: center; color: #ff3366; padding: 20px;">Failed to load leaderboard.</div>';
    console.error(e);
  }
}

function goHome(e) {
  if (e) e.preventDefault();
  // Hide main app, show intro screen
  mainApp.style.opacity = '0';
  mainApp.style.pointerEvents = 'none';
  
  setTimeout(() => {
    introScreen.classList.remove('hidden');
    // Also close leaderboard if open
    leaderboardModal.classList.remove('active');
  }, 300);
}

function showResults() {
  // Delay slightly for final card animation
  setTimeout(() => {
    // Hide actions and cards immediately to prevent flash
    document.getElementById('actions').style.opacity = '0';
    cardStack.style.opacity = '0';
    
    mainApp.style.opacity = '0';
    mainApp.style.pointerEvents = 'none';
    mainApp.style.transition = 'opacity 0.4s ease';

    setTimeout(() => {
      mainApp.style.display = 'none';
      resultsScreen.classList.remove('hidden');
      populateResults();
      launchConfetti();
    }, 450);
  }, 300);
}

function populateResults() {
  const yesCount = state.results.filter(r => r.answer === 'yes').length;
  const noCount = state.results.filter(r => r.answer === 'no').length;

  document.getElementById('stat-yes').textContent = yesCount;
  document.getElementById('stat-no').textContent = noCount;

  const list = document.getElementById('results-list');
  list.innerHTML = '';

  state.results.forEach((result) => {
    const prediction = PREDICTIONS.find(p => p.id === result.id);
    if (!prediction) return;

    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <span class="result-emoji">${prediction.emoji}</span>
      <span class="result-question">${prediction.question}</span>
      <span class="result-badge ${result.answer}">${result.answer.toUpperCase()}</span>
    `;
    list.appendChild(item);
  });
}

function restartGame() {
  state.currentIndex = 0;
  state.results = [];
  state.animating = false;

  resultsScreen.classList.add('hidden');
  cardsEmpty.classList.remove('visible');

  // Reset progress
  progressFill.style.width = '0%';
  counterCurrent.textContent = '1';
  buildProgressDots();

  // Restore visibility
  document.getElementById('actions').style.opacity = '1';
  cardStack.style.opacity = '1';
  mainApp.style.display = '';

  // Show main app
  setTimeout(() => {
    mainApp.style.opacity = '1';
    mainApp.style.pointerEvents = 'auto';
    renderCards();
  }, 300);
}

// ══════════════════════════════════════════════
// CONFETTI
// ══════════════════════════════════════════════

function launchConfetti() {
  const colors = ['#f97316', '#fb923c', '#22c55e', '#2a8e62', '#fafaf9', '#a78bfa'];
  const count = 60;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 1.5}s`;
    piece.style.animationDuration = `${2 + Math.random() * 2}s`;
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.width = `${5 + Math.random() * 8}px`;
    piece.style.height = `${5 + Math.random() * 8}px`;
    confettiContainer.appendChild(piece);
  }

  // Clean up
  setTimeout(() => {
    confettiContainer.innerHTML = '';
  }, 4500);
}

// ══════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', init);
