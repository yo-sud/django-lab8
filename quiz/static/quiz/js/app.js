(() => {
  'use strict';

  const API = '/api/';
  const TOKEN_KEY = 'aula-nexo-token';
  const HISTORY_KEY = 'aula-nexo-results';
  const $ = (id) => document.getElementById(id);
  const state = { exams: [], filter: 'all', search: '', activeExam: null, questions: [], token: localStorage.getItem(TOKEN_KEY) || '' };

  function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    if (state.token) headers.set('Authorization', `Token ${state.token}`);
    return fetch(path, { ...options, headers });
  }
  async function jsonResponse(response) {
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('Tu token no tiene acceso. Comprueba que sea válido y pertenezca a una cuenta de estudiante.');
      throw new Error(`La API respondió con estado ${response.status}.`);
    }
    return response.json();
  }
  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('is-visible');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('is-visible'), 3200);
  }
  function setConnected(connected) {
    const name = connected ? 'Estudiante' : 'Invitado';
    $('accountName').textContent = name; $('topProfileName').textContent = name;
    $('accountStatus').textContent = connected ? 'Conectado a tu espacio' : 'Conecta tu cuenta';
    $('accountAvatar').textContent = connected ? 'E' : 'A';
    document.querySelector('.avatar-small').textContent = connected ? 'E' : 'A';
    $('profileDialogInitial').textContent = connected ? 'E' : 'A';
    $('profileDialogName').textContent = name;
    $('profileDialogStatus').textContent = connected ? 'Tu cuenta de estudiante está conectada a Aula Nexo.' : 'Conecta una cuenta para consultar tus exámenes.';
    $('profileSessionText').textContent = connected ? 'Sesión activa en este navegador.' : 'No hay una sesión activa.';
    $('profileStatusDot').hidden = !connected;
    $('profileConnectButton').classList.toggle('hidden', connected);
    $('profileDisconnectButton').classList.toggle('hidden', !connected);
    $('connectButtonText').textContent = connected ? 'Desconectar' : 'Conectar cuenta';
    $('accountButton').title = connected ? 'Abrir perfil' : 'Conectar cuenta';
    $('greetingName').textContent = connected ? 'estudiante' : 'estudiante';
  }
  function getResults() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  }
  function updateProgress() {
    const results = getResults();
    const best = results.reduce((max, item) => Math.max(max, item.percent || 0), 0);
    $('bestScore').textContent = results.length ? `${best}%` : '—';
    $('bestScoreCaption').textContent = results.length ? `${results.length} práctica${results.length === 1 ? '' : 's'} completada${results.length === 1 ? '' : 's'}` : 'Tu progreso empieza hoy';
    $('chartSummary').textContent = results.length ? `Tu mejor resultado: ${best}% ✦` : 'Tu camino comienza hoy ✦';
  }
  function dateGreeting() {
    const now = new Date();
    $('todayLabel').textContent = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).format(now).toUpperCase();
  }
  function showEmpty(title, message, action = 'Conectar cuenta') {
    $('emptyTitle').textContent = title; $('emptyMessage').textContent = message; $('emptyAction').textContent = action;
    $('emptyState').classList.remove('hidden'); $('examGrid').classList.add('hidden');
  }
  function renderExams() {
    const grid = $('examGrid'); grid.replaceChildren();
    const filtered = state.exams.filter((exam) => {
      const title = String(exam.title || exam.name || 'Examen');
      return (state.filter !== 'available' || Number(exam.question_count || 0) > 0) && title.toLocaleLowerCase('es').includes(state.search.toLocaleLowerCase('es'));
    });
    $('emptyState').classList.toggle('hidden', filtered.length > 0);
    grid.classList.toggle('hidden', filtered.length === 0);
    if (!filtered.length) {
      showEmpty(state.exams.length ? 'No encontramos coincidencias' : 'Aún no hay exámenes', state.exams.length ? 'Prueba con otro término de búsqueda.' : 'Tu cuenta está conectada, pero todavía no hay material publicado.', state.exams.length ? 'Limpiar búsqueda' : 'Actualizar lista');
      return;
    }
    filtered.forEach((exam, index) => {
      const card = document.createElement('article'); card.className = `exam-card exam-tone-${index % 4}`;
      const badge = document.createElement('div'); badge.className = 'exam-art'; badge.setAttribute('aria-hidden', 'true'); badge.textContent = ['✦', '▤', '◉', '⌁'][index % 4];
      const body = document.createElement('div'); body.className = 'exam-card-body';
      const tag = document.createElement('span'); tag.className = 'exam-tag'; tag.textContent = exam.subject || exam.category || 'EVALUACIÓN';
      const title = document.createElement('h3'); title.textContent = exam.title || exam.name || `Examen ${exam.id}`;
      const desc = document.createElement('p'); desc.className = 'exam-description'; desc.textContent = exam.description || 'Practica los conceptos y consolida lo que has aprendido.';
      const meta = document.createElement('div'); meta.className = 'exam-meta';
      const count = document.createElement('span'); count.textContent = `${Number(exam.question_count || 0)} preguntas`;
      const duration = document.createElement('span'); duration.textContent = 'A tu ritmo'; meta.append(count, duration);
      const button = document.createElement('button'); button.className = 'button button-primary exam-start'; button.type = 'button'; button.textContent = 'Empezar práctica →'; button.addEventListener('click', () => startExam(exam));
      body.append(tag, title, desc, meta, button); card.append(badge, body); grid.append(card);
    });
  }
  async function collectPages(url) {
    const all = []; let next = url;
    while (next) {
      const data = await jsonResponse(await apiFetch(next));
      if (Array.isArray(data)) { all.push(...data); break; }
      all.push(...(data.results || [])); next = data.next;
    }
    return all;
  }
  async function loadDashboard() {
    if (!state.token) {
      setConnected(false); state.exams = [];
      $('examStat').textContent = '—'; $('questionStat').textContent = '—'; $('navExamCount').textContent = '0'; $('allExamCount').textContent = '0';
      showEmpty('Conecta tu cuenta para comenzar', 'Usa un token de acceso para consultar los exámenes de tu espacio.'); return;
    }
    $('examGrid').classList.remove('hidden'); $('emptyState').classList.add('hidden');
    $('examGrid').innerHTML = '<div class="loading-card"><span class="spinner"></span><span>Cargando tus exámenes...</span></div>';
    try {
      const [exams, questionsResponse] = await Promise.all([
        collectPages(`${API}exams/`), apiFetch(`${API}questions/`).then(jsonResponse)
      ]);
      state.exams = exams;
      const questionCount = Array.isArray(questionsResponse) ? questionsResponse.length : (questionsResponse.count ?? (questionsResponse.results || []).length);
      $('examStat').textContent = String(exams.length); $('questionStat').textContent = String(questionCount);
      $('navExamCount').textContent = String(exams.length); $('allExamCount').textContent = String(exams.length);
      setConnected(true); renderExams();
    } catch (error) {
      state.exams = []; setConnected(false); state.token = ''; localStorage.removeItem(TOKEN_KEY);
      showEmpty('No pudimos cargar tus exámenes', error.message, 'Conectar cuenta');
      $('tokenError').textContent = error.message;
    }
  }
  function openTokenDialog() {
    $('tokenError').classList.add('hidden'); $('tokenError').textContent = '';
    $('tokenInput').value = state.token;
    $('tokenDialog').showModal();
  }
  function disconnectAccount() {
    state.token = '';
    localStorage.removeItem(TOKEN_KEY);
    if ($('profileDialog').open) $('profileDialog').close();
    setConnected(false);
    loadDashboard();
    toast('Sesión desconectada');
  }
  async function connectToken(token) {
    $('tokenSubmit').disabled = true; $('tokenSubmit').textContent = 'Verificando acceso…';
    try {
      const response = await fetch(`${API}exams/`, { headers: { Authorization: `Token ${token}`, Accept: 'application/json' } });
      await jsonResponse(response);
      state.token = token; localStorage.setItem(TOKEN_KEY, token); $('tokenDialog').close();
      await loadDashboard(); toast('Cuenta conectada. ¡A practicar!');
    } catch (error) {
      $('tokenError').textContent = error.message; $('tokenError').classList.remove('hidden');
    } finally { $('tokenSubmit').disabled = false; $('tokenSubmit').innerHTML = 'Conectar de forma segura <span>→</span>'; }
  }
  async function startExam(exam) {
    if (!state.token) { openTokenDialog(); return; }
    $('quizTitle').textContent = exam.title || exam.name || 'Tu práctica';
    $('quizSubtitle').textContent = exam.description || 'Lee con calma y elige la respuesta que consideres correcta.';
    $('questionDeck').innerHTML = '<div class="loading-card"><span class="spinner"></span><span>Preparando preguntas...</span></div>';
    $('resultCard').classList.add('hidden'); $('submitQuizButton').disabled = false; $('submitQuizButton').innerHTML = 'Revisar mis respuestas <span>→</span>';
    $('quizScreen').classList.remove('hidden'); document.body.classList.add('quiz-open'); window.scrollTo(0, 0);
    try {
      const questions = await collectPages(`${API}questions/?exam=${encodeURIComponent(exam.id)}`);
      if (!questions.length) throw new Error('Este examen todavía no tiene preguntas disponibles.');
      state.activeExam = exam; state.questions = questions; renderQuestions();
    } catch (error) {
      $('questionDeck').textContent = error.message;
    }
  }
  function renderQuestions() {
    const deck = $('questionDeck'); deck.replaceChildren();
    $('quizCount').textContent = `${state.questions.length} preguntas`;
    state.questions.forEach((question, index) => {
      const section = document.createElement('section'); section.className = 'question-card';
      const top = document.createElement('div'); top.className = 'question-heading';
      const number = document.createElement('span'); number.className = 'question-number'; number.textContent = `PREGUNTA ${String(index + 1).padStart(2, '0')}`;
      const prompt = document.createElement('h2'); prompt.textContent = question.text || question.question_text || question.prompt || `Pregunta ${index + 1}`;
      top.append(number); section.append(top, prompt);
      const choices = question.choices || question.options || [];
      if (!choices.length) { const note = document.createElement('p'); note.textContent = 'Esta pregunta no tiene alternativas configuradas.'; section.append(note); }
      const list = document.createElement('div'); list.className = 'answer-options';
      choices.forEach((choice, choiceIndex) => {
        const label = document.createElement('label'); label.className = 'answer-option';
        const input = document.createElement('input'); input.type = 'radio'; input.name = `question-${question.id ?? index}`; input.value = String(choice.id ?? choiceIndex); input.dataset.correct = choice.is_correct ? 'true' : 'false';
        input.addEventListener('change', updateAnswerCount);
        const letter = document.createElement('span'); letter.className = 'answer-letter'; letter.textContent = String.fromCharCode(65 + choiceIndex);
        const text = document.createElement('span'); text.className = 'answer-text'; text.textContent = choice.text || choice.label || choice.name || `Alternativa ${choiceIndex + 1}`;
        label.append(input, letter, text); list.append(label);
      });
      section.append(list); deck.append(section);
    });
    updateAnswerCount();
  }
  function updateAnswerCount() {
    const selected = document.querySelectorAll('#questionDeck input[type="radio"]:checked').length;
    $('answeredCount').textContent = `${selected} de ${state.questions.length} respuestas seleccionadas`;
    $('quizProgressFill').style.width = `${state.questions.length ? selected / state.questions.length * 100 : 0}%`;
  }
  function submitQuiz() {
    const questions = [...document.querySelectorAll('.question-card')];
    if (questions.some((el) => !el.querySelector('input:checked'))) { toast('Responde todas las preguntas antes de revisar.'); return; }
    let correct = 0;
    questions.forEach((question) => {
      const inputs = [...question.querySelectorAll('input')];
      inputs.forEach((input) => { input.disabled = true; if (input.dataset.correct === 'true') input.closest('.answer-option').classList.add('is-correct'); });
      const chosen = question.querySelector('input:checked');
      if (chosen?.dataset.correct === 'true') correct++; else chosen?.closest('.answer-option').classList.add('is-incorrect');
    });
    const percent = Math.round(correct / questions.length * 100);
    const results = getResults(); results.unshift({ exam: state.activeExam.title || state.activeExam.name || 'Práctica', percent, date: new Date().toISOString() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(results.slice(0, 30))); updateProgress();
    const result = $('resultCard'); result.replaceChildren(); result.classList.remove('hidden');
    const title = document.createElement('h2'); title.textContent = percent >= 80 ? '¡Excelente trabajo!' : percent >= 50 ? '¡Buen avance!' : 'Cada intento te enseña algo';
    const detail = document.createElement('p'); detail.textContent = `Obtuviste ${correct} de ${questions.length} respuestas correctas (${percent}%).`;
    result.append(title, detail); $('submitQuizButton').disabled = true; $('submitQuizButton').textContent = 'Práctica completada';
    result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function exitQuiz() { $('quizScreen').classList.add('hidden'); document.body.classList.remove('quiz-open'); window.scrollTo(0, 0); }

  $('connectButton').addEventListener('click', () => state.token ? disconnectAccount() : openTokenDialog());
  $('accountButton').addEventListener('click', () => $('profileDialog').showModal());
  $('profileButton').addEventListener('click', () => $('profileDialog').showModal());
  $('profileConnectButton').addEventListener('click', () => { $('profileDialog').close(); openTokenDialog(); });
  $('profileDisconnectButton').addEventListener('click', disconnectAccount);
  $('emptyAction').addEventListener('click', () => state.exams.length ? (state.search = '', $('searchInput').value = '', renderExams()) : openTokenDialog());
  $('refreshLink').addEventListener('click', (event) => { event.preventDefault(); loadDashboard(); });
  $('searchInput').addEventListener('input', (event) => { state.search = event.target.value.trim(); renderExams(); });
  document.querySelectorAll('.filter-tab').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach((item) => item.classList.remove('is-selected')); button.classList.add('is-selected'); state.filter = button.dataset.filter; renderExams();
  }));
  $('tokenForm').addEventListener('submit', (event) => { event.preventDefault(); connectToken($('tokenInput').value.trim()); });
  $('showToken').addEventListener('change', (event) => { $('tokenInput').type = event.target.checked ? 'text' : 'password'; });
  $('tokenHelp').addEventListener('click', () => { $('tokenError').textContent = 'En la carpeta del proyecto, ejecuta: python manage.py seed_quiz. Luego sigue las instrucciones para crear o consultar el token de tu usuario.'; $('tokenError').classList.remove('hidden'); });
  $('submitQuizButton').addEventListener('click', submitQuiz); $('exitQuizButton').addEventListener('click', exitQuiz);
  $('viewHistoryButton').addEventListener('click', () => { const results = getResults(); toast(results.length ? `Última práctica: ${results[0].exam}, ${results[0].percent}%.` : 'Completa tu primera práctica y aquí aparecerán tus resultados.'); });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('searchInput').focus(); }
    if (event.key === 'Escape' && !$('tokenDialog').open && !$('quizScreen').classList.contains('hidden')) exitQuiz();
  });
  dateGreeting(); updateProgress(); setConnected(Boolean(state.token)); loadDashboard();
})();
