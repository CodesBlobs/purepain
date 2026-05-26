// ── State ──────────────────────────────────────────────────────────────────
const API = location.hostname === 'localhost' ? 'http://localhost:3001' : '';
let currentUser = null;
let token = localStorage.getItem('token');
let currentPage = null;

let practiceState = {
  difficulty: 'easy',
  question: null,
  answered: false,
  streak: 0,
};

let challengeState = {
  difficulty: 'easy',
  current: 0,
  total: 5,
  score: 0,
  results: [],
  completed: false,
  questions: [],        // all 5 pre-loaded
  selectedAnswers: [],  // null = unanswered
};

let parentData = { students: [], my_questions: [] };
let assigningQuestionId = null;

// ── Utility ────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function showAlert(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = 'block';
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Auth UI ────────────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((el, i) => {
    el.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1));
  });
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
}

function selectAccountType(type) {
  document.getElementById('reg-account-type').value = type;
  document.getElementById('type-student').classList.toggle('selected', type === 'student');
  document.getElementById('type-parent').classList.toggle('selected', type === 'parent');
  document.getElementById('grade-group').style.display = type === 'student' ? 'block' : 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  hideAlert('login-error');
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Signing in…';
  btn.disabled = true;
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value,
      })
    });
    token = data.token;
    localStorage.setItem('token', token);
    currentUser = data.user;
    enterApp();
  } catch (err) {
    showAlert('login-error', err.message);
  } finally {
    btn.textContent = 'Sign In';
    btn.disabled = false;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  hideAlert('register-error');
  const btn = document.getElementById('register-btn');
  btn.textContent = 'Creating account…';
  btn.disabled = true;
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        account_type: document.getElementById('reg-account-type').value,
        grade_level: document.getElementById('reg-grade').value || null,
      })
    });
    token = data.token;
    localStorage.setItem('token', token);
    currentUser = data.user;
    enterApp();
  } catch (err) {
    showAlert('register-error', err.message);
  } finally {
    btn.textContent = 'Create Account';
    btn.disabled = false;
  }
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
}

// ── App Entry ──────────────────────────────────────────────────────────────
function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';

  document.getElementById('sidebar-name').textContent = currentUser.name;
  document.getElementById('sidebar-type').textContent = currentUser.account_type + ' account';

  buildNav();

  // Navigate to whatever page the URL currently points at, falling back to home
  const path = window.location.pathname.slice(1);
  const studentPages = ['practice', 'practice-challenge', 'assignments'];
  const parentPages  = ['my-questions', 'assign'];

  let startPage;
  if (currentUser.account_type === 'student') {
    startPage = studentPages.includes(path) ? path : 'student-home';
  } else {
    startPage = parentPages.includes(path) ? path : 'parent-home';
  }
  navigateTo(startPage);
}

function buildNav() {
  const nav = document.getElementById('sidebar-nav');
  const items = currentUser.account_type === 'student'
    ? [
        { id: 'student-home',       icon: '🏠', label: 'Home' },
        { id: 'practice',           icon: '🧮', label: 'Practice' },
        { id: 'practice-challenge', icon: '🏆', label: 'Challenge' },
        { id: 'assignments',        icon: '📋', label: 'Assignments' },
      ]
    : [
        { id: 'parent-home',   icon: '🏠', label: 'Dashboard' },
        { id: 'my-questions',  icon: '📝', label: 'My Questions' },
        { id: 'assign',        icon: '📤', label: 'Assign Work' },
      ];

  nav.innerHTML = items.map(i => `
    <button class="nav-item" id="nav-${i.id}" onclick="navigateTo('${i.id}')">
      <span class="nav-icon">${i.icon}</span> ${i.label}
    </button>
  `).join('');
}

function navigateTo(page, pushHistory = true) {
  // Completion page is only accessible after finishing the challenge
  if (page === 'practice-complete') {
    if (!challengeState.completed) {
      navigateTo('practice-challenge');
      return;
    }
  }

  // Update the browser URL
  if (pushHistory) {
    const urlPath = (page === 'student-home' || page === 'parent-home') ? '/' : '/' + page;
    history.pushState({ page }, '', urlPath);
  }

  document.querySelector('.app-layout').classList.toggle('challenge-mode', page === 'practice-challenge');

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  currentPage = page;

  if (page === 'student-home')       loadStudentHome();
  if (page === 'practice')           loadPractice();
  if (page === 'practice-challenge') loadPracticeChallenge();
  if (page === 'practice-complete')  renderChallengeComplete();
  if (page === 'assignments')        loadAssignments();
  if (page === 'parent-home')        loadParentHome();
  if (page === 'my-questions')       loadMyQuestions();
  if (page === 'assign')             loadAssignPage();
}

// ── STUDENT: Home ──────────────────────────────────────────────────────────
async function loadStudentHome() {
  try {
    const data = await api('/api/student/dashboard');
    const { stats, recentAttempts, assignments, parents } = data;

    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

    document.getElementById('student-dashboard-content').innerHTML = `
      <div class="page-header">
        <h2>Welcome back, ${currentUser.name.split(' ')[0]}! 👋</h2>
        <p>${parents.length ? `Linked to: ${parents.map(p => p.name).join(', ')}` : 'No parent linked yet'}</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Attempts</div>
          <div class="stat-value">${stats.total || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Correct</div>
          <div class="stat-value" style="color:var(--success)">${stats.correct || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Accuracy</div>
          <div class="stat-value">${accuracy}%</div>
          <div class="progress-bar-wrap"><div class="progress-bar" style="width:${accuracy}%"></div></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending Tasks</div>
          <div class="stat-value" style="color:var(--warning)">${assignments.length}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="card">
          <div class="card-header"><h3>Quick Actions</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
            <button class="btn btn-primary" onclick="navigateTo('practice-challenge')">🏆 Start Challenge</button>
            <button class="btn btn-outline" onclick="navigateTo('practice')">🧮 Free Practice</button>
            <button class="btn btn-outline" onclick="navigateTo('assignments')">📋 View Assignments (${assignments.length})</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Recent Activity</h3></div>
          <div class="card-body">
            ${recentAttempts.length ? `
              <div class="attempts-list">
                ${recentAttempts.slice(0,5).map(a => `
                  <div class="attempt-row">
                    <div class="attempt-dot ${a.is_correct ? 'correct' : 'wrong'}"></div>
                    <div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.question_text}</div>
                    <div class="attempt-time">${timeAgo(a.attempted_at)}</div>
                  </div>
                `).join('')}
              </div>
            ` : '<div class="empty-state"><div class="empty-icon">📊</div><p>No attempts yet — start practicing!</p></div>'}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('student-dashboard-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

// ── STUDENT: Practice (free mode) ──────────────────────────────────────────
function loadPractice() {
  renderPracticeControls();
  loadNextQuestion();
}

function renderPracticeControls() {
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.toLowerCase() === practiceState.difficulty);
  });
}

function setDifficulty(d) {
  practiceState.difficulty = d;
  renderPracticeControls();
  practiceState.answered = false;
  loadNextQuestion();
}

async function loadNextQuestion() {
  const container = document.getElementById('practice-content');
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400)">Loading question…</div>';
  try {
    const q = await api(`/api/student/practice?difficulty=${practiceState.difficulty}`);
    practiceState.question = q;
    practiceState.answered = false;
    renderPracticeQuestion();
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderPracticeQuestion() {
  const q = practiceState.question;
  const container = document.getElementById('practice-content');

  container.innerHTML = `
    <div class="question-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="q-number">Generated Question</div>
        <div class="streak-display">🔥 ${practiceState.streak} streak</div>
      </div>
      <div class="q-content">${q.question_text}</div>
      <div class="options-grid" id="practice-options">
        ${q.options.map(o => `
          <button class="option-btn" data-value="${o.option_text}" onclick="submitPracticeAnswer(this.dataset.value)" id="opt-${o.option_label}">
            <span class="opt-label">${o.option_label}</span>
            ${o.option_text}
          </button>
        `).join('')}
      </div>
      <div id="practice-result" style="display:none"></div>
    </div>
  `;
}

async function submitPracticeAnswer(chosen) {
  if (practiceState.answered) return;
  practiceState.answered = true;

  const q = practiceState.question;
  const isCorrect = chosen === q.answer;

  q.options.forEach(o => {
    const btn = document.getElementById('opt-' + o.option_label);
    if (!btn) return;
    btn.disabled = true;
    if (o.option_text === q.answer) btn.classList.add('correct');
    else if (o.option_text === chosen) btn.classList.add('wrong');
  });

  const resultEl = document.getElementById('practice-result');
  resultEl.style.display = 'block';
  resultEl.innerHTML = `
    <div class="result-banner ${isCorrect ? 'correct' : 'wrong'}">
      ${isCorrect ? '✅ Correct!' : `❌ Wrong — the answer was <strong>${q.answer}</strong>`}
    </div>
    <button class="btn btn-primary" onclick="loadNextQuestion()">Next Question →</button>
  `;

  if (isCorrect) practiceState.streak++;
  else practiceState.streak = 0;

  api('/api/student/submit', {
    method: 'POST',
    body: JSON.stringify({
      is_generated: true,
      question_text: q.question_text,
      answer: q.answer,
      answer_given: chosen,
      difficulty: q.difficulty,
    })
  }).catch(() => {});
}

// ── STUDENT: Challenge (5-question quiz mode) ──────────────────────────────
function loadPracticeChallenge() {
  challengeState.current = 0;
  challengeState.score = 0;
  challengeState.results = [];
  challengeState.completed = false;
  challengeState.questions = [];
  challengeState.selectedAnswers = [];
  renderChallengeLobby();
}

function renderChallengeLobby() {
  document.getElementById('challenge-content').innerHTML = `
    <div class="page-header">
      <h2>5-Question Challenge</h2>
      <p>Complete all 5 to unlock your results</p>
    </div>
    <div class="challenge-lobby">
      <div class="challenge-info-card">
        <div class="challenge-icon">🏆</div>
        <h3>Ready for a challenge?</h3>
        <p>Answer 5 math questions. You can go back and change answers — your score is revealed only when you submit at the end.</p>
        <div class="diff-selector" style="justify-content:center;margin:24px 0 0">
          <button class="diff-btn ${challengeState.difficulty === 'easy'   ? 'active easy'   : ''}" onclick="setChallengeDifficulty('easy')">Easy</button>
          <button class="diff-btn ${challengeState.difficulty === 'medium' ? 'active medium' : ''}" onclick="setChallengeDifficulty('medium')">Medium</button>
          <button class="diff-btn ${challengeState.difficulty === 'hard'   ? 'active hard'   : ''}" onclick="setChallengeDifficulty('hard')">Hard</button>
        </div>
        <button class="btn btn-primary" style="margin-top:24px;width:auto;padding:14px 48px;font-size:16px" onclick="startChallenge()">
          Start Challenge →
        </button>
      </div>
    </div>
  `;
}

function setChallengeDifficulty(d) {
  challengeState.difficulty = d;
  renderChallengeLobby();
}

async function startChallenge() {
  document.getElementById('challenge-content').innerHTML =
    '<div style="text-align:center;padding:80px;color:var(--gray-400)">Loading questions…</div>';
  try {
    challengeState.questions = await Promise.all(
      Array.from({ length: challengeState.total }, () =>
        api(`/api/student/practice?difficulty=${challengeState.difficulty}`)
      )
    );
    challengeState.selectedAnswers = new Array(challengeState.total).fill(null);
    challengeState.current = 0;
    renderChallengeQuestion();
  } catch (err) {
    document.getElementById('challenge-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function buildChallengeProgress() {
  const answered = challengeState.selectedAnswers.filter(a => a !== null).length;
  const pct = (answered / challengeState.total) * 100;
  const dots = Array.from({ length: challengeState.total }, (_, i) => {
    const cls = i === challengeState.current
      ? 'current'
      : challengeState.selectedAnswers[i] !== null ? 'done' : 'pending';
    return `<div class="challenge-dot ${cls}" onclick="challengeGoTo(${i})" title="Question ${i + 1}"></div>`;
  }).join('');

  return `
    <div class="challenge-progress-bar">
      <div class="challenge-meta">
        <span class="challenge-counter">Question ${challengeState.current + 1} of ${challengeState.total}</span>
        <span class="challenge-score-live">${answered} / ${challengeState.total} answered</span>
      </div>
      <div class="challenge-dots">${dots}</div>
      <div class="progress-bar-wrap" style="margin-top:10px"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>
  `;
}

function renderChallengeQuestion() {
  const q = challengeState.questions[challengeState.current];
  const selected = challengeState.selectedAnswers[challengeState.current];
  const isLast = challengeState.current === challengeState.total - 1;
  const allAnswered = challengeState.selectedAnswers.every(a => a !== null);

  document.getElementById('challenge-content').innerHTML = `
    ${buildChallengeProgress()}
    <div class="question-card" style="margin-top:16px">
      <div class="q-content">${q.question_text}</div>
      <div class="options-grid">
        ${q.options.map(o => `
          <button class="option-btn ${selected === o.option_text ? 'selected' : ''}"
                  data-value="${o.option_text}"
                  onclick="selectChallengeAnswer(this.dataset.value)">
            <span class="opt-label">${o.option_label}</span>${o.option_text}
          </button>
        `).join('')}
      </div>
      <div class="challenge-nav">
        ${challengeState.current > 0
          ? `<button class="btn btn-outline" onclick="challengeGoTo(${challengeState.current - 1})">← Previous</button>`
          : `<div></div>`}
        ${isLast
          ? `<button class="btn btn-primary" style="width:auto" onclick="submitChallenge()" ${allAnswered ? '' : 'disabled title="Answer all questions to submit"'}>
               ${allAnswered ? '🎉 Submit Challenge' : `Submit (${challengeState.selectedAnswers.filter(a=>a!==null).length}/5 answered)`}
             </button>`
          : `<button class="btn btn-primary" style="width:auto" onclick="challengeGoTo(${challengeState.current + 1})">Next →</button>`}
      </div>
    </div>
  `;
}

function selectChallengeAnswer(value) {
  challengeState.selectedAnswers[challengeState.current] = value;
  renderChallengeQuestion();
}

function challengeGoTo(idx) {
  if (idx < 0 || idx >= challengeState.total) return;
  challengeState.current = idx;
  renderChallengeQuestion();
}

function submitChallenge() {
  challengeState.results = challengeState.questions.map((q, i) => {
    const chosen = challengeState.selectedAnswers[i];
    const isCorrect = chosen !== null && chosen === q.answer;
    return { question_text: q.question_text, answer: q.answer, answer_given: chosen, is_correct: isCorrect };
  });
  challengeState.score = challengeState.results.filter(r => r.is_correct).length;

  challengeState.questions.forEach((q, i) => {
    const chosen = challengeState.selectedAnswers[i];
    if (chosen) {
      api('/api/student/submit', {
        method: 'POST',
        body: JSON.stringify({
          is_generated: true,
          question_text: q.question_text,
          answer: q.answer,
          answer_given: chosen,
          difficulty: challengeState.difficulty,
        })
      }).catch(() => {});
    }
  });

  challengeState.completed = true;
  navigateTo('practice-complete');
}

function renderChallengeComplete() {
  const { score, total, results, difficulty } = challengeState;
  const pct = Math.round((score / total) * 100);
  const starsFilled = Math.round((score / total) * 5);
  const stars = '⭐'.repeat(starsFilled) + '☆'.repeat(5 - starsFilled);

  let grade, gradeColor;
  if (pct === 100) { grade = 'Perfect!'; gradeColor = 'var(--success)'; }
  else if (pct >= 80) { grade = 'Great job!'; gradeColor = 'var(--primary)'; }
  else if (pct >= 60) { grade = 'Not bad!'; gradeColor = 'var(--warning)'; }
  else { grade = 'Keep practising!'; gradeColor = 'var(--danger)'; }

  document.getElementById('complete-content').innerHTML = `
    <div class="complete-screen">
      <div class="complete-card">
        <div class="complete-badge">🔒 Challenge Complete</div>
        <div class="complete-icon">🎉</div>
        <h2>${grade}</h2>
        <p class="complete-subtitle">${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} difficulty</p>
        <div class="score-display" style="color:${gradeColor}">${pct}%</div>
        <div class="score-fraction">${score} / ${total} correct</div>
        <div class="stars">${stars}</div>

        <div class="result-breakdown">
          ${results.map((r, i) => `
            <div class="result-row ${r.is_correct ? 'correct' : 'wrong'}">
              <span class="result-num">Q${i + 1}</span>
              <span class="result-icon">${r.is_correct ? '✅' : '❌'}</span>
              <span class="result-q">${r.question_text}</span>
              <span class="result-ans">${r.is_correct ? r.answer_given : `<s>${r.answer_given}</s> → ${r.answer}`}</span>
            </div>
          `).join('')}
        </div>

        <div style="display:flex;gap:12px;justify-content:center;margin-top:32px;flex-wrap:wrap">
          <button class="btn btn-outline" onclick="restartChallenge()">Try Again</button>
          <button class="btn btn-primary" style="width:auto" onclick="navigateTo('student-home')">Back to Home</button>
        </div>
      </div>
    </div>
  `;
}

function restartChallenge() {
  challengeState.completed = false;
  navigateTo('practice-challenge');
}

// ── STUDENT: Assignments ───────────────────────────────────────────────────
async function loadAssignments() {
  const container = document.getElementById('assignments-content');
  container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray-400)">Loading…</div>';
  try {
    const data = await api('/api/student/dashboard');
    const assignments = data.assignments;

    if (!assignments.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No pending assignments. You\'re all caught up!</p></div>`;
      return;
    }

    container.innerHTML = assignments.map((a, i) => `
      <div class="question-card" id="assign-${a.id}" style="margin-bottom:16px">
        <div class="assigned-tag">📤 Assigned by ${a.parent_name}${a.due_date ? ` · Due ${a.due_date}` : ''}</div>
        <div style="margin-bottom:8px">
          <span class="q-badge ${a.type}">${a.type.replace('_', ' ')}</span>
          <span class="diff-badge ${a.difficulty}" style="margin-left:6px">${a.difficulty}</span>
        </div>
        <div class="q-content">${a.question_text}</div>
        ${a.type === 'multiple_choice' && a.options?.length ? `
          <div class="options-grid" id="aopts-${a.id}">
            ${a.options.map(o => `
              <button class="option-btn" data-value="${o.option_text}" onclick="submitAssignment(${a.id}, ${a.question_id}, this.dataset.value)" id="aopt-${a.id}-${o.option_label}">
                <span class="opt-label">${o.option_label}</span> ${o.option_text}
              </button>
            `).join('')}
          </div>
        ` : `
          <div class="word-answer-area">
            <input type="text" id="ans-${a.id}" placeholder="Type your answer…" style="margin-bottom:10px">
            <button class="btn btn-primary" style="width:auto" onclick="submitAssignmentWord(${a.id}, ${i}, ${a.question_id})">Submit Answer</button>
          </div>
        `}
        <div id="aresult-${a.id}" style="display:none"></div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function submitAssignment(assignmentId, questionId, chosen) {
  const card = document.getElementById('assign-' + assignmentId);
  if (card.dataset.answered) return;
  card.dataset.answered = 'true';

  // Disable all option buttons for this assignment
  const opts = card.querySelectorAll('.option-btn');
  opts.forEach(b => b.disabled = true);

  try {
    const result = await api('/api/student/submit', {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, assignment_id: assignmentId, answer_given: chosen })
    });

    const isCorrect = result.is_correct;
    const resultEl = document.getElementById('aresult-' + assignmentId);
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div class="result-banner ${isCorrect ? 'correct' : 'wrong'}">
        ${isCorrect ? '✅ Correct! Assignment complete.' : `❌ Wrong — the answer was <strong>${result.correct_answer}</strong>`}
      </div>
    `;
  } catch (err) {
    card.dataset.answered = '';
    opts.forEach(b => b.disabled = false);
  }
}

async function submitAssignmentWord(assignmentId, idx, questionId) {
  const input = document.getElementById('ans-' + assignmentId);
  const answer = input.value.trim();
  if (!answer) return;

  const card = document.getElementById('assign-' + assignmentId);
  if (card.dataset.answered) return;

  try {
    const result = await api('/api/student/submit', {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, assignment_id: assignmentId, answer_given: answer })
    });

    card.dataset.answered = 'true';
    input.disabled = true;

    const resultEl = document.getElementById('aresult-' + assignmentId);
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div class="result-banner ${result.is_correct ? 'correct' : 'wrong'}">
        ${result.is_correct ? '✅ Correct! Assignment complete.' : `❌ Wrong — the answer was <strong>${result.correct_answer}</strong>`}
      </div>
    `;
  } catch (err) {}
}

// ── PARENT: Dashboard ──────────────────────────────────────────────────────
async function loadParentHome() {
  try {
    const data = await api('/api/parent/dashboard');
    parentData = data;

    const container = document.getElementById('parent-dashboard-content');
    container.innerHTML = `
      <div class="page-header">
        <h2>Dashboard 👋</h2>
        <p>Welcome back, ${currentUser.name.split(' ')[0]}</p>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 style="font-size:16px;font-weight:600;color:var(--gray-800)">Your Students</h3>
        ${data.students.length < 2 ? `<button class="btn btn-outline btn-sm" onclick="openLinkStudent()">+ Link Student</button>` : ''}
      </div>

      <div class="students-grid">
        ${data.students.map(s => renderStudentCard(s)).join('')}
        ${data.students.length < 2 ? `
          <div class="add-student-card" onclick="openLinkStudent()">
            <div class="add-icon">➕</div>
            <p>Link a student account</p>
          </div>
        ` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px">
        <div class="card">
          <div class="card-header"><h3>Quick Actions</h3></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
            <button class="btn btn-primary" onclick="navigateTo('my-questions')">📝 Create a Question</button>
            <button class="btn btn-outline" onclick="navigateTo('assign')">📤 Assign Work</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>My Questions</h3></div>
          <div class="card-body">
            <div style="font-size:28px;font-weight:700;color:var(--gray-900)">${data.my_questions.length}</div>
            <div style="font-size:13px;color:var(--gray-400);margin-top:2px">questions created</div>
            ${data.my_questions.length ? `<button class="btn btn-outline btn-sm" style="margin-top:12px" onclick="navigateTo('my-questions')">View all →</button>` : ''}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('parent-dashboard-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

function renderStudentCard(s) {
  const accuracy = s.total_attempts > 0 ? Math.round((s.correct_count / s.total_attempts) * 100) : 0;
  return `
    <div class="student-card">
      <div class="student-card-header">
        <div class="student-avatar">${initials(s.name)}</div>
        <div class="student-card-info">
          <div class="student-name">${s.name}</div>
          <div class="student-email">${s.email}</div>
        </div>
      </div>
      <div class="student-stats">
        <div class="student-stat">
          <div class="s-val" style="color:var(--warning)">${s.pending_count}</div>
          <div class="s-lbl">Pending</div>
        </div>
        <div class="student-stat">
          <div class="s-val" style="color:var(--success)">${s.completed_count}</div>
          <div class="s-lbl">Completed</div>
        </div>
        <div class="student-stat">
          <div class="s-val">${s.total_attempts}</div>
          <div class="s-lbl">Total</div>
        </div>
        <div class="student-stat">
          <div class="s-val">${accuracy}%</div>
          <div class="s-lbl">Accuracy</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline btn-sm" style="flex:1" onclick="viewStudentProgress(${s.id},'${s.name}')">View Progress</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="unlinkStudent(${s.id})" title="Unlink">✕</button>
      </div>
    </div>
  `;
}

// ── PARENT: My Questions ───────────────────────────────────────────────────
async function loadMyQuestions() {
  try {
    const questions = await api('/api/parent/questions');
    parentData.my_questions = questions;
    renderQuestionsList();
  } catch (err) {}
}

function renderQuestionsList() {
  const container = document.getElementById('my-questions-content');
  const qs = parentData.my_questions;

  if (!qs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>No questions yet — create your first one!</p></div>`;
    return;
  }

  container.innerHTML = `<div class="questions-list">
    ${qs.map(q => `
      <div class="question-item">
        <span class="q-badge ${q.type}">${q.type.replace('_', ' ')}</span>
        <div style="flex:1">
          <div class="q-text">${q.question_text}</div>
          <div class="q-meta">
            <span class="diff-badge ${q.difficulty}">${q.difficulty}</span>
            <span style="margin-left:8px">Answer: <strong>${q.answer}</strong></span>
          </div>
        </div>
        <div class="q-actions">
          <button class="btn btn-outline btn-sm" onclick="openAssignModal(${q.id}, \`${q.question_text.replace(/`/g,'\\`')}\`)">Assign</button>
          <button class="btn btn-danger btn-sm" onclick="deleteQuestion(${q.id})">Delete</button>
        </div>
      </div>
    `).join('')}
  </div>`;
}

function openCreateQuestion() {
  document.getElementById('modal-create-question').style.display = 'flex';
  hideAlert('create-q-error');
  document.getElementById('q-text').value = '';
  document.getElementById('q-answer').value = '';
  document.getElementById('opt-a').value = '';
  document.getElementById('opt-b').value = '';
  document.getElementById('opt-c').value = '';
  document.getElementById('opt-d').value = '';
  document.querySelector('input[name="q-type"][value="multiple_choice"]').checked = true;
  document.getElementById('mc-options-section').style.display = 'block';
}

function onQTypeChange() {
  const val = document.querySelector('input[name="q-type"]:checked').value;
  document.getElementById('mc-options-section').style.display = val === 'multiple_choice' ? 'block' : 'none';
}

async function submitCreateQuestion() {
  hideAlert('create-q-error');
  const type = document.querySelector('input[name="q-type"]:checked').value;
  const difficulty = document.getElementById('q-difficulty').value;
  const question_text = document.getElementById('q-text').value.trim();
  const answer = document.getElementById('q-answer').value.trim();

  if (!question_text || !answer) {
    showAlert('create-q-error', 'Question and answer are required');
    return;
  }

  let options = [];
  if (type === 'multiple_choice') {
    const labels = ['a', 'b', 'c', 'd'];
    const Labels = ['A', 'B', 'C', 'D'];
    options = labels.map((l, i) => ({
      label: Labels[i],
      text: document.getElementById('opt-' + l).value.trim(),
      is_correct: document.getElementById('opt-' + l).value.trim().toLowerCase() === answer.toLowerCase()
    })).filter(o => o.text);

    if (options.length < 2) {
      showAlert('create-q-error', 'Add at least 2 answer options');
      return;
    }
  }

  try {
    const q = await api('/api/parent/questions', {
      method: 'POST',
      body: JSON.stringify({ type, difficulty, question_text, answer, options })
    });
    parentData.my_questions.unshift(q);
    closeModalById('modal-create-question');
    renderQuestionsList();
  } catch (err) {
    showAlert('create-q-error', err.message);
  }
}

async function deleteQuestion(id) {
  if (!confirm('Delete this question?')) return;
  try {
    await api('/api/parent/questions/' + id, { method: 'DELETE' });
    parentData.my_questions = parentData.my_questions.filter(q => q.id !== id);
    renderQuestionsList();
  } catch (err) {}
}

// ── PARENT: Assign ─────────────────────────────────────────────────────────
async function loadAssignPage() {
  try {
    const data = await api('/api/parent/dashboard');
    parentData = data;

    const container = document.getElementById('assign-content');

    if (!data.students.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><p>Link a student first to assign questions.</p><button class="btn btn-primary" style="width:auto;margin-top:16px" onclick="openLinkStudent()">Link a Student</button></div>`;
      return;
    }

    if (!data.my_questions.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>Create some questions first before assigning them.</p><button class="btn btn-primary" style="width:auto;margin-top:16px" onclick="navigateTo('my-questions')">Create Questions</button></div>`;
      return;
    }

    container.innerHTML = `
      <div class="form-group" style="max-width:300px">
        <label>Assign to student</label>
        <select id="bulk-assign-student">
          ${data.students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="questions-list">
        ${data.my_questions.map(q => `
          <div class="question-item">
            <span class="q-badge ${q.type}">${q.type.replace('_', ' ')}</span>
            <div style="flex:1">
              <div class="q-text">${q.question_text}</div>
              <div class="q-meta"><span class="diff-badge ${q.difficulty}">${q.difficulty}</span></div>
            </div>
            <button class="btn btn-success btn-sm" onclick="quickAssign(${q.id})">Assign →</button>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    document.getElementById('assign-content').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function quickAssign(questionId) {
  const studentId = document.getElementById('bulk-assign-student').value;
  try {
    await api('/api/parent/assign', {
      method: 'POST',
      body: JSON.stringify({ student_id: parseInt(studentId), question_id: questionId })
    });
    const btn = event.target;
    btn.textContent = '✅ Assigned!';
    btn.classList.remove('btn-success');
    btn.classList.add('btn-secondary');
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = 'Assign →';
      btn.classList.add('btn-success');
      btn.classList.remove('btn-secondary');
      btn.disabled = false;
    }, 2000);
  } catch (err) {
    alert(err.message);
  }
}

function openAssignModal(questionId, questionText) {
  assigningQuestionId = questionId;
  document.getElementById('assign-question-preview').innerHTML = `
    <div style="background:var(--gray-50);border-radius:8px;padding:12px;font-size:14px;color:var(--gray-700)">${questionText}</div>
  `;
  const sel = document.getElementById('assign-student-select');
  sel.innerHTML = parentData.students.length
    ? parentData.students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
    : '<option value="">No students linked</option>';
  hideAlert('assign-error');
  document.getElementById('modal-assign').style.display = 'flex';
}

async function submitAssign() {
  const studentId = document.getElementById('assign-student-select').value;
  const dueDate = document.getElementById('assign-due-date').value;
  if (!studentId) return showAlert('assign-error', 'Select a student');
  try {
    await api('/api/parent/assign', {
      method: 'POST',
      body: JSON.stringify({ student_id: parseInt(studentId), question_id: assigningQuestionId, due_date: dueDate || null })
    });
    closeModalById('modal-assign');
  } catch (err) {
    showAlert('assign-error', err.message);
  }
}

// ── PARENT: Link Student ───────────────────────────────────────────────────
function openLinkStudent() {
  document.getElementById('link-email').value = '';
  hideAlert('link-error');
  document.getElementById('modal-link-student').style.display = 'flex';
}

async function linkStudent() {
  const email = document.getElementById('link-email').value.trim();
  if (!email) return showAlert('link-error', 'Enter the student\'s email');
  try {
    await api('/api/parent/link-student', { method: 'POST', body: JSON.stringify({ email }) });
    closeModalById('modal-link-student');
    loadParentHome();
  } catch (err) {
    showAlert('link-error', err.message);
  }
}

async function unlinkStudent(studentId) {
  if (!confirm('Unlink this student?')) return;
  try {
    await api('/api/parent/link-student/' + studentId, { method: 'DELETE' });
    loadParentHome();
  } catch (err) {}
}

// ── PARENT: Student Progress ───────────────────────────────────────────────
async function viewStudentProgress(studentId, name) {
  document.getElementById('progress-modal-title').textContent = name + '\'s Progress';
  document.getElementById('progress-modal-body').innerHTML = 'Loading…';
  document.getElementById('modal-student-progress').style.display = 'flex';

  try {
    const data = await api('/api/parent/student/' + studentId + '/progress');
    const { attempts, stats } = data;
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

    document.getElementById('progress-modal-body').innerHTML = `
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card">
          <div class="stat-label">Total</div>
          <div class="stat-value">${stats.total}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Correct</div>
          <div class="stat-value" style="color:var(--success)">${stats.correct || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Accuracy</div>
          <div class="stat-value">${accuracy}%</div>
        </div>
      </div>
      ${attempts.length ? `
        <div class="attempts-list">
          ${attempts.map(a => `
            <div class="attempt-row">
              <div class="attempt-dot ${a.is_correct ? 'correct' : 'wrong'}"></div>
              <div style="flex:1">
                <div>${a.question_text}</div>
                <div style="font-size:11px;color:var(--gray-400);margin-top:2px">
                  <span class="diff-badge ${a.difficulty}">${a.difficulty}</span>
                  · Answered: ${a.answer_given}
                  ${!a.is_correct ? `· Correct: ${a.answer}` : ''}
                </div>
              </div>
              <div class="attempt-time">${timeAgo(a.attempted_at)}</div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="empty-state"><div class="empty-icon">📊</div><p>No attempts yet</p></div>'}
    `;
  } catch (err) {
    document.getElementById('progress-modal-body').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

// ── Modal helpers ──────────────────────────────────────────────────────────
function closeModal(id, e) {
  if (e.target === e.currentTarget) closeModalById(id);
}

function closeModalById(id) {
  document.getElementById(id).style.display = 'none';
}

// ── Browser back / forward ─────────────────────────────────────────────────
window.addEventListener('popstate', e => {
  if (!currentUser) return;
  const page = e.state?.page
    ?? (currentUser.account_type === 'student' ? 'student-home' : 'parent-home');
  navigateTo(page, false); // URL already updated by the browser
});

// ── Boot ───────────────────────────────────────────────────────────────────
(async function init() {
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) throw new Error('expired');
    currentUser = { id: payload.id, name: payload.name, email: payload.email, account_type: payload.account_type };
    enterApp();
  } catch {
    localStorage.removeItem('token');
    token = null;
  }
})();
