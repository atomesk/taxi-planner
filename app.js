import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { auth, db } from './firebase-config.js';

const UI = {
  views: Array.from(document.querySelectorAll('[data-view]')),
  navButtons: Array.from(document.querySelectorAll('[data-nav]')),
  bottomNav: document.getElementById('bottom-nav'),
  logoutButton: document.getElementById('logout-button'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  collegueForm: document.getElementById('collegue-form'),
  collegueNom: document.getElementById('collegue-nom'),
  collegueTelephone: document.getElementById('collegue-telephone'),
  collegueFeedback: document.getElementById('collegue-feedback'),
  colleguesList: document.getElementById('collegues-list'),
  courseForm: document.getElementById('course-form'),
  courseClient: document.getElementById('course-client'),
  courseDepart: document.getElementById('course-depart'),
  courseArrivee: document.getElementById('course-arrivee'),
  courseDatetime: document.getElementById('course-datetime'),
  courseTypeRadios: Array.from(document.querySelectorAll('input[name="course-type"]')),
  courseFeedback: document.getElementById('course-feedback'),
  courseSubmit: document.getElementById('course-submit'),
  planningList: document.getElementById('planning-list'),
  planningFeedback: document.getElementById('planning-feedback'),
  planningFilterButtons: Array.from(document.querySelectorAll('[data-planning-filter]')),
  planningSort: document.getElementById('planning-sort'),
  editCourseModal: document.getElementById('edit-course-modal'),
  editCourseForm: document.getElementById('edit-course-form'),
  editCourseId: document.getElementById('edit-course-id'),
  editCourseClient: document.getElementById('edit-course-client'),
  editCourseDepart: document.getElementById('edit-course-depart'),
  editCourseArrivee: document.getElementById('edit-course-arrivee'),
  editCourseDatetime: document.getElementById('edit-course-datetime'),
  editCourseTypeRadios: Array.from(document.querySelectorAll('input[name="edit-course-type"]')),
  editCourseFeedback: document.getElementById('edit-course-feedback'),
  editCourseCancel: document.getElementById('edit-course-cancel'),
  editCourseAbort: document.getElementById('edit-course-abort')
};

const APP_STATE = {
  isAuthenticated: false,
  activeView: 'view-login',
  colleguesUnsubscribe: null,
  coursesUnsubscribe: null,
  collegues: [],
  courses: [],
  planningFilter: 'all',
  planningSortBy: 'createdAt',
  selectedCourses: new Set(),
  openCourseMenuId: null
};

function closeCourseMenu() {
  if (!APP_STATE.openCourseMenuId) {
    return;
  }

  APP_STATE.openCourseMenuId = null;
  renderPlanning();
}

function toggleCourseMenu(courseId) {
  const safeCourseId = String(courseId || '').trim();
  if (!safeCourseId) {
    return;
  }

  APP_STATE.openCourseMenuId = APP_STATE.openCourseMenuId === safeCourseId ? null : safeCourseId;
  renderPlanning();
}

function showView(viewId) {
  UI.views.forEach((view) => {
    view.classList.toggle('hidden', view.id !== viewId);
  });

  UI.navButtons.forEach((button) => {
    const isActive = button.dataset.nav === viewId;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  APP_STATE.activeView = viewId;
}

function updateShellForAuth(isAuthenticated) {
  APP_STATE.isAuthenticated = isAuthenticated;

  UI.bottomNav.classList.toggle('hidden', !isAuthenticated);
  UI.logoutButton.classList.toggle('hidden', !isAuthenticated);

  if (!isAuthenticated) {
    showView('view-login');
    return;
  }

  if (APP_STATE.activeView === 'view-login') {
    showView('view-saisie');
  }
}

function setLoginError(message = '') {
  if (!message) {
    UI.loginError.textContent = '';
    UI.loginError.classList.add('hidden');
    return;
  }

  UI.loginError.textContent = message;
  UI.loginError.classList.remove('hidden');
}

function setCollegueFeedback(message = '', isError = false) {
  if (!UI.collegueFeedback) {
    return;
  }

  if (!message) {
    UI.collegueFeedback.textContent = '';
    UI.collegueFeedback.className = 'hidden text-sm';
    return;
  }

  UI.collegueFeedback.textContent = message;
  UI.collegueFeedback.className = `text-sm ${isError ? 'text-red-400' : 'text-emerald-400'}`;
}

function setCourseFeedback(message = '', isError = false) {
  if (!UI.courseFeedback) {
    return;
  }

  if (!message) {
    UI.courseFeedback.textContent = '';
    UI.courseFeedback.className = 'hidden text-sm';
    return;
  }

  UI.courseFeedback.textContent = message;
  UI.courseFeedback.className = `text-sm ${isError ? 'text-red-400' : 'text-emerald-400'}`;
}

function setPlanningFeedback(message = '', isError = false) {
  if (!UI.planningFeedback) {
    return;
  }

  if (!message) {
    UI.planningFeedback.textContent = '';
    UI.planningFeedback.className = 'hidden mb-3 text-sm';
    return;
  }

  UI.planningFeedback.textContent = message;
  UI.planningFeedback.className = `mb-3 text-sm ${isError ? 'text-red-400' : 'text-emerald-400'}`;
}

function setEditCourseFeedback(message = '', isError = false) {
  if (!UI.editCourseFeedback) {
    return;
  }

  if (!message) {
    UI.editCourseFeedback.textContent = '';
    UI.editCourseFeedback.className = 'hidden text-sm';
    return;
  }

  UI.editCourseFeedback.textContent = message;
  UI.editCourseFeedback.className = `text-sm ${isError ? 'text-red-400' : 'text-emerald-400'}`;
}

function normalizeCourseType(typeValue) {
  const normalized = String(typeValue || '').trim().toLowerCase();

  if (normalized === 'a/r') {
    return 'A/R';
  }

  if (normalized === 'retour') {
    return 'Retour';
  }

  // Keep backward compatibility: any legacy/unknown value falls back to Aller.
  return 'Aller';
}

function getCheckedCourseType(radios) {
  const selected = radios.find((radio) => radio.checked);
  return normalizeCourseType(selected?.value);
}

function normalizePhoneNumber(rawPhone) {
  const trimmed = rawPhone.trim();
  const cleaned = trimmed.replace(/[\s().-]/g, '');
  const normalized = cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned;

  if (!/^(\+?\d{8,15})$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCourseDate(datetimeValue) {
  if (!datetimeValue) {
    return 'Date non définie';
  }

  const date = new Date(datetimeValue);
  if (Number.isNaN(date.getTime())) {
    return 'Date invalide';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
}

function getCourseDateAndTime(datetimeValue) {
  if (!datetimeValue) {
    return {
      date: 'Date non définie',
      time: '--:--'
    };
  }

  const date = new Date(datetimeValue);
  if (Number.isNaN(date.getTime())) {
    return {
      date: 'Date invalide',
      time: '--:--'
    };
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(date);

  return {
    date: `${weekday} ${day}/${month}`,
    time: `${hours}:${minutes}`
  };
}

function generateGroupSMS(courses) {
  if (!Array.isArray(courses) || courses.length === 0) {
    return '';
  }

  const sortedCourses = [...courses].sort((a, b) => {
    const dateA = new Date(a.datetime || 0).getTime();
    const dateB = new Date(b.datetime || 0).getTime();

    const safeA = Number.isNaN(dateA) ? 0 : dateA;
    const safeB = Number.isNaN(dateB) ? 0 : dateB;
    return safeA - safeB;
  });

  const lines = [];
  let previousDate = '';

  sortedCourses.forEach((course) => {
    const { date, time } = getCourseDateAndTime(course.datetime);
    const client = course.client || '?';
    const depart = course.depart || '?';
    const arrivee = course.arrivee || '?';
    const courseType = normalizeCourseType(course.type);

    if (date !== previousDate) {
      if (lines.length > 0) {
        lines.push('');
      }
      lines.push('Pour ' + date);
      lines.push('');
      previousDate = date;
    }

    lines.push(`${time} : ${client} - PEC ${depart} - pour ${arrivee} - ${courseType}`);
  });

  const encodedBody = lines.map((line) => encodeURIComponent(line)).join('%0a');
  return encodedBody;
}

function getGroupSMSTargetCollegue(courses) {
  const firstAssignedTo = courses.find((c) => c.status === 'assigne')?.assigned_to;
  if (!firstAssignedTo) {
    return null;
  }

  const sameCollegue = courses.every((c) => c.assigned_to === firstAssignedTo);
  return sameCollegue ? firstAssignedTo : null;
}

function getCollegueById(collegueId) {
  return APP_STATE.collegues.find((c) => c.id === collegueId);
}

function updateGroupSMSButton() {
  const container = UI.planningList?.parentElement;
  if (!container) {
    return;
  }

  const button = container.querySelector('[data-group-sms-send]');
  const clearButton = container.querySelector('[data-group-sms-clear]');

  if (!button || !clearButton) {
    return;
  }

  const selectedIds = Array.from(APP_STATE.selectedCourses);
  const hasSelection = selectedIds.length > 0;

  button.classList.toggle('hidden', !hasSelection);
  clearButton.classList.toggle('hidden', !hasSelection);

  if (hasSelection) {
    button.textContent = `Envoyer sélection (${selectedIds.length})`;
  }
}

function attachGroupSMSControls() {
  if (!UI.planningList) {
    return;
  }

  const container = UI.planningList.parentElement;
  if (!container || container.querySelector('[data-group-sms-send]')) {
    return;
  }

  const controls = document.createElement('div');
  controls.className = 'mb-3 flex gap-2';

  const sendButton = document.createElement('button');
  sendButton.type = 'button';
  sendButton.setAttribute('data-group-sms-send', '1');
  sendButton.className = 'hidden min-h-12 rounded-xl bg-green-500 px-4 text-sm font-bold text-black';
  sendButton.textContent = 'Envoyer sélection (0)';

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.setAttribute('data-group-sms-clear', '1');
  clearButton.className = 'hidden min-h-12 rounded-xl border border-taxi-muted px-4 text-sm font-semibold text-gray-100';
  clearButton.textContent = 'Tout décocher';

  controls.append(sendButton, clearButton);
  UI.planningList.parentElement.insertBefore(controls, UI.planningList);
}

function generateSMSURL(course, collegue) {
  if (!course || !collegue || !collegue.telephone) {
    return '';
  }

  const { date, time } = getCourseDateAndTime(course.datetime);
  const courseType = normalizeCourseType(course.type);
  const lines = [
    `${course.client || ''}`,
    `PEC : ${date} à ${time}`,
    `${course.depart || ''}`,
    `Pour : ${course.arrivee || ''}`,
    `${courseType}`
  ];
  const encodedBody = lines.map((line) => encodeURIComponent(line)).join('%0a');
  return `sms:${collegue.telephone}?&body=${encodedBody}`;
}

async function login(email, password) {
  const safeEmail = email.trim();
  if (!safeEmail || !password) {
    throw new Error('Identifiants manquants');
  }

  return signInWithEmailAndPassword(auth, safeEmail, password);
}

function renderCollegues(collegues) {
  if (!UI.colleguesList) {
    return;
  }

  if (collegues.length === 0) {
    UI.colleguesList.innerHTML = '<p class="rounded-xl border border-dashed border-taxi-muted p-3 text-sm text-gray-400">Aucun collègue enregistré.</p>';
    return;
  }

  UI.colleguesList.innerHTML = collegues
    .map(
      (collegue) => `
      <article class="rounded-xl border border-taxi-muted bg-taxi-dark p-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h4 class="text-base font-semibold text-white">${collegue.nom}</h4>
            <p class="text-sm text-gray-300">${collegue.telephone}</p>
          </div>
          <button
            type="button"
            data-delete-collegue="${collegue.id}"
            class="min-h-12 rounded-xl border border-red-500/60 px-3 text-sm font-semibold text-red-300"
          >
            Supprimer
          </button>
        </div>
      </article>
    `
    )
    .join('');
}

function renderPlanning(courses = APP_STATE.courses) {
  if (!UI.planningList) {
    return;
  }

  // Reset container before every render to avoid visual duplicates.
  UI.planningList.innerHTML = '';

  const filteredCourses = APP_STATE.planningFilter === 'pending'
    ? courses.filter((course) => course.status !== 'assigne')
    : courses;

  if (filteredCourses.length === 0) {
    UI.planningList.innerHTML = '<p class="rounded-xl border border-dashed border-taxi-muted p-3 text-sm text-gray-400">Aucune course à afficher.</p>';
    return;
  }

  const colleguesOptions = APP_STATE.collegues.length === 0
    ? '<option value="">Aucun collègue</option>'
    : ['<option value="">Choisir un collègue</option>']
      .concat(
        APP_STATE.collegues.map(
          (collegue) => `<option value="${collegue.id}">${escapeHtml(collegue.nom)}</option>`
        )
      )
      .join('');

  UI.planningList.innerHTML = filteredCourses
    .map((course) => {
      const status = course.status === 'assigne' ? 'assigne' : 'en_attente';
      const courseType = normalizeCourseType(course.type);
      const borderClass = status === 'assigne' ? 'border-emerald-500/80' : 'border-yellow-400/90';
      const badgeClass = status === 'assigne' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-400/20 text-yellow-300';
      const typeBadgeClass = courseType === 'A/R'
        ? 'bg-blue-500/20 text-blue-200'
        : courseType === 'Retour'
          ? 'bg-orange-500/20 text-orange-200'
          : 'bg-slate-500/20 text-slate-200';
      const isSelected = APP_STATE.selectedCourses.has(course.id);
      const isMenuOpen = APP_STATE.openCourseMenuId === course.id;
      const assignedCollegue = APP_STATE.collegues.find((collegue) => collegue.id === course.assigned_to)
        || (course.assigned_to
          ? {
            id: course.assigned_to,
            nom: course.assigned_to_nom || 'Collègue',
            telephone: course.assigned_to_telephone || ''
          }
          : null);
      const smsURL = status === 'assigne' ? generateSMSURL(course, assignedCollegue) : '';

      return `
        <article class="relative rounded-xl border ${borderClass} bg-taxi-dark p-4 ${isSelected ? 'ring-2 ring-taxi-yellow' : ''}">
          <div class="mb-3 flex items-start justify-between gap-2">
            <div class="flex items-start gap-2">
              ${status === 'assigne' ? `<input type="checkbox" data-select-course="${course.id}" class="mt-1 h-5 w-5 cursor-pointer" ${isSelected ? 'checked' : ''} />` : '<div class="w-5"></div>'}
            </div>
            <div class="flex-1">
              <h3 class="text-base font-bold text-white">${escapeHtml(course.client || 'Client non renseigné')}</h3>
              <p class="text-sm text-gray-300">${escapeHtml(course.depart || '?')} -> ${escapeHtml(course.arrivee || '?')}</p>
              <div class="mt-1 flex items-center gap-2">
                <span class="rounded-full px-2 py-1 text-xs font-semibold ${typeBadgeClass}">${escapeHtml(courseType)}</span>
                <p class="text-sm text-gray-400">${escapeHtml(formatCourseDate(course.datetime))}</p>
              </div>
            </div>
            <div class="flex items-start gap-2">
              <span class="rounded-full px-2 py-1 text-xs font-semibold ${badgeClass}">${status === 'assigne' ? 'Assignée' : 'En attente'}</span>
              <button
                type="button"
                data-toggle-course-menu="${course.id}"
                class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-taxi-muted bg-taxi-panel/80 px-2 text-gray-200"
                aria-label="Ouvrir les options"
                aria-expanded="${isMenuOpen ? 'true' : 'false'}"
              >
                <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.8"></circle>
                  <circle cx="12" cy="12" r="1.8"></circle>
                  <circle cx="12" cy="19" r="1.8"></circle>
                </svg>
              </button>
            </div>
          </div>

          <div class="${isMenuOpen ? '' : 'hidden '}absolute right-3 top-14 z-50 min-w-52 rounded-xl border border-taxi-muted bg-taxi-panel p-2 shadow-xl">
            <button
              type="button"
              data-edit-course="${course.id}"
              class="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-gray-100 hover:bg-taxi-dark"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"></path>
              </svg>
              Modifier
            </button>
            <button
              type="button"
              data-delete-course="${course.id}"
              class="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-300 hover:bg-taxi-dark"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M3 6h18"></path>
                <path d="M8 6V4h8v2"></path>
                <path d="M19 6l-1 14H6L5 6"></path>
              </svg>
              Supprimer
            </button>
            <button
              type="button"
              data-reset-course="${course.id}"
              class="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-yellow-300 hover:bg-taxi-dark"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7"></path>
                <path d="M3 4v5h5"></path>
              </svg>
              Réinitialiser / Annuler
            </button>
          </div>

          ${status === 'en_attente'
            ? `
              <div class="grid gap-2">
                <select
                  data-course-select="${course.id}"
                  class="min-h-12 w-full rounded-xl border border-taxi-muted bg-taxi-panel px-3 text-sm text-white outline-none ring-taxi-yellow focus:ring-2"
                >
                  ${colleguesOptions}
                </select>
                <button
                  type="button"
                  data-assign-course="${course.id}"
                  class="min-h-12 w-full rounded-xl bg-taxi-yellow px-4 text-sm font-bold text-black"
                >
                  Confirmer l'assignation
                </button>
              </div>
            `
            : `
              <p class="mb-3 text-sm text-emerald-300">Assigné à : ${escapeHtml(assignedCollegue?.nom || 'Collègue')}</p>
              <div class="grid gap-2">
                ${smsURL
                  ? `<a href="${smsURL}" class="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-green-500 px-4 text-sm font-bold text-black">Envoyer Message</a>`
                  : `<button type="button" disabled class="min-h-12 w-full rounded-xl bg-green-500/40 px-4 text-sm font-bold text-black/70">SMS indisponible</button>`}
              </div>
            `}
        </article>
      `;
    })
    .join('');

  filteredCourses.forEach((course) => {
    const select = UI.planningList.querySelector(`[data-course-select="${course.id}"]`);
    if (select) {
      select.value = course.assigned_to || '';
    }
  });

  updateGroupSMSButton();
}

function listenCollegues() {
  if (APP_STATE.colleguesUnsubscribe) {
    APP_STATE.colleguesUnsubscribe();
    APP_STATE.colleguesUnsubscribe = null;
  }

  const colleguesQuery = query(collection(db, 'collegues'), orderBy('nom'));
  APP_STATE.colleguesUnsubscribe = onSnapshot(
    colleguesQuery,
    (snapshot) => {
      const collegues = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      APP_STATE.collegues = collegues;
      renderCollegues(collegues);
      renderPlanning();
    },
    (error) => {
      console.error('Erreur écoute collègues:', error);
      setCollegueFeedback('Impossible de charger les collègues.', true);
    }
  );
}

function listenCourses() {
  if (APP_STATE.coursesUnsubscribe) {
    APP_STATE.coursesUnsubscribe();
    APP_STATE.coursesUnsubscribe = null;
  }

  const sortField = APP_STATE.planningSortBy === 'courseDate' ? 'datetime' : 'createdAt';
  const coursesQuery = query(collection(db, 'courses'), orderBy(sortField, 'desc'));
  APP_STATE.coursesUnsubscribe = onSnapshot(
    coursesQuery,
    (snapshot) => {
      APP_STATE.courses = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          ...data,
          type: normalizeCourseType(data.type)
        };
      });
      renderPlanning();
    },
    (error) => {
      console.error('Erreur écoute planning:', error);
      setPlanningFeedback('Impossible de charger le planning.', true);
    }
  );
}

async function addCollegue(nom, telephone) {
  const safeNom = nom.trim();
  const normalizedPhone = normalizePhoneNumber(telephone);

  if (!safeNom) {
    throw new Error('Nom requis');
  }

  if (!normalizedPhone) {
    throw new Error('Téléphone invalide');
  }

  await addDoc(collection(db, 'collegues'), {
    nom: safeNom,
    telephone: normalizedPhone,
    createdAt: serverTimestamp()
  });
}

function getFirstContactValue(value) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }

  return String(value || '').trim();
}

function supportsContactPicker() {
  return Boolean(navigator.contacts && typeof navigator.contacts.select === 'function');
}

function attachContactImportButton() {
  if (!UI.collegueForm || document.getElementById('collegue-import-button')) {
    return;
  }

  const actions = document.createElement('div');
  actions.className = 'grid grid-cols-1 gap-2';

  const importButton = document.createElement('button');
  importButton.type = 'button';
  importButton.id = 'collegue-import-button';
  importButton.className = 'min-h-12 rounded-xl border border-taxi-muted px-4 text-base font-semibold text-gray-100';
  importButton.textContent = 'Importer depuis Contacts';

  const hint = document.createElement('p');
  hint.id = 'collegue-import-hint';
  hint.className = 'hidden text-xs text-gray-400';

  if (!supportsContactPicker()) {
    importButton.disabled = true;
    importButton.classList.add('opacity-60', 'cursor-not-allowed');
    hint.textContent = 'Import des contacts non disponible sur cet appareil.';
    hint.classList.remove('hidden');
  }

  actions.append(importButton, hint);
  UI.collegueForm.append(actions);

  importButton.addEventListener('click', async () => {
    if (!supportsContactPicker()) {
      setCollegueFeedback('Import des contacts non disponible.', false);
      setTimeout(() => {
        setCollegueFeedback('');
      }, 1800);
      return;
    }

    try {
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!Array.isArray(contacts) || contacts.length === 0) {
        return;
      }

      const selected = contacts[0];
      const importedName = getFirstContactValue(selected.name);
      const importedPhone = getFirstContactValue(selected.tel);

      if (importedName) {
        UI.collegueNom.value = importedName;
      }

      if (importedPhone) {
        UI.collegueTelephone.value = importedPhone;
      }

      if (!importedName && !importedPhone) {
        setCollegueFeedback('Contact importé sans données exploitables.', true);
      } else {
        setCollegueFeedback('Contact importé. Vérifie puis ajoute.');
      }

      setTimeout(() => {
        setCollegueFeedback('');
      }, 1800);
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }

      console.error('Erreur import contact:', error);
      setCollegueFeedback('Impossible d’importer ce contact.', true);
    }
  });
}

async function removeCollegue(collegueId) {
  await deleteDoc(doc(db, 'collegues', collegueId));
}

async function addCourse(event) {
  event.preventDefault();
  setCourseFeedback('');

  const client = UI.courseClient.value.trim();
  const depart = UI.courseDepart.value.trim();
  const arrivee = UI.courseArrivee.value.trim();
  const type = getCheckedCourseType(UI.courseTypeRadios);
  const datetime = UI.courseDatetime.value;

  if (!client || !depart || !arrivee || !datetime) {
    setCourseFeedback('Tous les champs sont requis.', true);
    return;
  }

  try {
    await addDoc(collection(db, 'courses'), {
      client,
      depart,
      arrivee,
      type,
      datetime,
      status: 'en_attente',
      createdAt: serverTimestamp(),
      assigned_to: null
    });

    UI.courseForm.reset();
    setCourseFeedback('Course enregistrée.');
    console.log('Course enregistrée avec succès.');

    if (UI.courseSubmit) {
      const originalClass = UI.courseSubmit.className;
      UI.courseSubmit.className = 'min-h-12 rounded-xl bg-emerald-400 px-4 py-4 text-base font-bold text-black';
      setTimeout(() => {
        UI.courseSubmit.className = originalClass;
      }, 900);
    }

    setTimeout(() => {
      setCourseFeedback('');
    }, 1600);
  } catch (error) {
    console.error('Erreur ajout course:', error);
    setCourseFeedback('Échec enregistrement. Réessaie.', true);
  }
}

async function assignCourseToCollegue(courseId, collegueId) {
  const safeCourseId = String(courseId || '').trim();
  const safeCollegueId = String(collegueId || '').trim();

  if (!safeCourseId || !safeCollegueId) {
    throw new Error('Assignation incomplète');
  }

  const collegue = APP_STATE.collegues.find((item) => item.id === safeCollegueId);
  if (!collegue) {
    throw new Error('Collègue introuvable');
  }

  await updateDoc(doc(db, 'courses', safeCourseId), {
    status: 'assigne',
    assigned_to: collegue.id,
    assigned_to_nom: collegue.nom,
    assigned_to_telephone: collegue.telephone
  });
}

async function resetCourseAssignment(courseId) {
  const safeCourseId = String(courseId || '').trim();
  if (!safeCourseId) {
    throw new Error('Course invalide');
  }

  await updateDoc(doc(db, 'courses', safeCourseId), {
    status: 'en_attente',
    assigned_to: null,
    assigned_to_nom: null,
    assigned_to_telephone: null
  });
}

async function removeCourse(courseId) {
  const safeCourseId = String(courseId || '').trim();
  if (!safeCourseId) {
    throw new Error('Course invalide');
  }

  await deleteDoc(doc(db, 'courses', safeCourseId));
}

async function updateCourseDetails(courseId, payload) {
  const safeCourseId = String(courseId || '').trim();
  if (!safeCourseId) {
    throw new Error('Course invalide');
  }

  await updateDoc(doc(db, 'courses', safeCourseId), payload);
}

function openEditCourseModal(courseId) {
  if (!UI.editCourseModal || !UI.editCourseForm) {
    return;
  }

  const course = APP_STATE.courses.find((item) => item.id === courseId);
  if (!course) {
    setPlanningFeedback('Course introuvable.', true);
    return;
  }

  UI.editCourseId.value = course.id;
  UI.editCourseClient.value = course.client || '';
  UI.editCourseDepart.value = course.depart || '';
  UI.editCourseArrivee.value = course.arrivee || '';
  UI.editCourseDatetime.value = course.datetime || '';

  const targetType = normalizeCourseType(course.type);
  UI.editCourseTypeRadios.forEach((radio) => {
    radio.checked = radio.value === targetType;
  });

  setEditCourseFeedback('');
  UI.editCourseModal.classList.remove('hidden');
  UI.editCourseModal.classList.add('flex');
}

function closeEditCourseModal() {
  if (!UI.editCourseModal || !UI.editCourseForm) {
    return;
  }

  UI.editCourseModal.classList.remove('flex');
  UI.editCourseModal.classList.add('hidden');
  UI.editCourseForm.reset();
  setEditCourseFeedback('');
}

function bindNavigation() {
  UI.navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (!APP_STATE.isAuthenticated) {
        return;
      }

      showView(button.dataset.nav);
    });
  });
}

function bindAuthActions() {
  UI.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setLoginError('');

    const email = UI.loginEmail.value.trim();
    const password = UI.loginPassword.value;

    if (!email || !password) {
      setLoginError('Renseigne email et mot de passe.');
      return;
    }

    try {
      await login(email, password);
      UI.loginForm.reset();
    } catch (error) {
      console.error('Erreur de connexion Firebase:', error);
      setLoginError('Connexion refusée. Vérifie tes identifiants admin.');
    }
  });

  UI.logoutButton.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur de déconnexion Firebase:', error);
    }
  });
}

function bindColleguesActions() {
  if (!UI.collegueForm || !UI.colleguesList) {
    return;
  }

  attachContactImportButton();

  UI.collegueForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setCollegueFeedback('');

    try {
      await addCollegue(UI.collegueNom.value, UI.collegueTelephone.value);
      UI.collegueForm.reset();
      setCollegueFeedback('Collègue ajouté avec succès.');
      console.log('Collègue ajouté avec succès.');
    } catch (error) {
      console.error('Erreur ajout collègue:', error);
      const message = error.message === 'Téléphone invalide'
        ? 'Numéro invalide. Exemple: +33612345678 ou 0612345678'
        : 'Impossible d’ajouter ce collègue.';
      setCollegueFeedback(message, true);
    }
  });

  UI.colleguesList.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('[data-delete-collegue]');
    if (!deleteButton) {
      return;
    }

    const collegueId = deleteButton.dataset.deleteCollegue;
    if (!collegueId) {
      return;
    }

    try {
      await removeCollegue(collegueId);
      setCollegueFeedback('Collègue supprimé.');
    } catch (error) {
      console.error('Erreur suppression collègue:', error);
      setCollegueFeedback('Suppression impossible.', true);
    }
  });
}

function bindCourseActions() {
  if (!UI.courseForm) {
    return;
  }

  UI.courseForm.addEventListener('submit', addCourse);
  UI.courseForm.addEventListener('reset', () => {
    setCourseFeedback('Formulaire réinitialisé.');
    setTimeout(() => {
      setCourseFeedback('');
    }, 1000);
  });
}

function bindEditCourseActions() {
  if (!UI.editCourseModal || !UI.editCourseForm) {
    return;
  }

  UI.editCourseForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setEditCourseFeedback('');

    const courseId = UI.editCourseId.value;
    const client = UI.editCourseClient.value.trim();
    const depart = UI.editCourseDepart.value.trim();
    const arrivee = UI.editCourseArrivee.value.trim();
    const datetime = UI.editCourseDatetime.value;
    const type = getCheckedCourseType(UI.editCourseTypeRadios);

    if (!courseId || !client || !depart || !arrivee || !datetime) {
      setEditCourseFeedback('Tous les champs sont requis.', true);
      return;
    }

    try {
      await updateCourseDetails(courseId, { client, depart, arrivee, datetime, type });
      closeEditCourseModal();
      setPlanningFeedback('Course modifiée.');
      setTimeout(() => {
        setPlanningFeedback('');
      }, 1400);
    } catch (error) {
      console.error('Erreur modification course:', error);
      setEditCourseFeedback('Impossible de modifier cette course.', true);
    }
  });

  const closeModal = () => {
    closeEditCourseModal();
  };

  UI.editCourseCancel?.addEventListener('click', closeModal);
  UI.editCourseAbort?.addEventListener('click', closeModal);

  UI.editCourseModal.addEventListener('click', (event) => {
    if (event.target === UI.editCourseModal) {
      closeEditCourseModal();
    }
  });
}

function bindPlanningActions() {
  if (!UI.planningList) {
    return;
  }

  if (UI.planningSort) {
    UI.planningSort.value = APP_STATE.planningSortBy;
    UI.planningSort.addEventListener('change', () => {
      APP_STATE.planningSortBy = UI.planningSort.value === 'courseDate' ? 'courseDate' : 'createdAt';
      listenCourses();
    });
  }

  UI.planningFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      APP_STATE.planningFilter = button.dataset.planningFilter === 'pending' ? 'pending' : 'all';

      UI.planningFilterButtons.forEach((item) => {
        const active = item.dataset.planningFilter === APP_STATE.planningFilter;
        item.classList.toggle('bg-taxi-yellow', active);
        item.classList.toggle('text-black', active);
      });

      renderPlanning();
    });
  });

  UI.planningList.addEventListener('click', async (event) => {
    const toggleMenuButton = event.target.closest('[data-toggle-course-menu]');
    const editButton = event.target.closest('[data-edit-course]');
    const deleteButton = event.target.closest('[data-delete-course]');
    const assignButton = event.target.closest('[data-assign-course]');
    const resetButton = event.target.closest('[data-reset-course]');

    if (toggleMenuButton) {
      toggleCourseMenu(toggleMenuButton.dataset.toggleCourseMenu);
      return;
    }

    if (editButton) {
      closeCourseMenu();
      openEditCourseModal(editButton.dataset.editCourse);
      return;
    }

    if (deleteButton) {
      closeCourseMenu();
      const courseId = deleteButton.dataset.deleteCourse;
      const course = APP_STATE.courses.find((item) => item.id === courseId);
      const label = course?.client ? ` pour ${course.client}` : '';
      const confirmed = window.confirm(`Supprimer la course${label} ?`);

      if (!confirmed) {
        return;
      }

      try {
        await removeCourse(courseId);
        setPlanningFeedback('Course supprimée.');
        setTimeout(() => {
          setPlanningFeedback('');
        }, 1400);
      } catch (error) {
        console.error('Erreur suppression course:', error);
        setPlanningFeedback('Impossible de supprimer cette course.', true);
      }
      return;
    }

    if (assignButton) {
      closeCourseMenu();
      const courseId = assignButton.dataset.assignCourse;
      const select = UI.planningList.querySelector(`[data-course-select="${courseId}"]`);
      const collegueId = select?.value || '';

      if (!collegueId) {
        setPlanningFeedback('Sélectionne un collègue avant de confirmer.', true);
        return;
      }

      try {
        await assignCourseToCollegue(courseId, collegueId);
        setPlanningFeedback('Assignation enregistrée.');
        setTimeout(() => {
          setPlanningFeedback('');
        }, 1400);
      } catch (error) {
        console.error('Erreur assignation course:', error);
        setPlanningFeedback('Échec de l’assignation.', true);
      }
      return;
    }

    if (resetButton) {
      closeCourseMenu();
      const courseId = resetButton.dataset.resetCourse;
      try {
        await resetCourseAssignment(courseId);
        setPlanningFeedback('Course remise en attente.');
        setTimeout(() => {
          setPlanningFeedback('');
        }, 1400);
      } catch (error) {
        console.error('Erreur reset assignation:', error);
        setPlanningFeedback('Impossible de réinitialiser.', true);
      }
    }

    const selectCheckbox = event.target.closest('[data-select-course]');
    if (selectCheckbox) {
      const courseId = selectCheckbox.dataset.selectCourse;
      if (selectCheckbox.checked) {
        APP_STATE.selectedCourses.add(courseId);
      } else {
        APP_STATE.selectedCourses.delete(courseId);
      }
      updateGroupSMSButton();
      return;
    }
  });

  const container = UI.planningList?.parentElement;
  if (container) {
    container.addEventListener('click', async (event) => {
      const sendButton = event.target.closest('[data-group-sms-send]');
      const clearButton = event.target.closest('[data-group-sms-clear]');

      if (sendButton) {
        const selectedIds = Array.from(APP_STATE.selectedCourses);
        const selectedCourses = selectedIds
          .map((id) => APP_STATE.courses.find((c) => c.id === id))
          .filter(Boolean);

        if (selectedCourses.length === 0) {
          setPlanningFeedback('Aucune course sélectionnée.', true);
          return;
        }

        const targetCollegueId = getGroupSMSTargetCollegue(selectedCourses);
        if (!targetCollegueId) {
          setPlanningFeedback('Veuillez sélectionner des courses pour un seul et même collègue.', true);
          return;
        }

        const collegue = getCollegueById(targetCollegueId);
        if (!collegue) {
          setPlanningFeedback('Collègue introuvable.', true);
          return;
        }

        const groupSmsBody = generateGroupSMS(selectedCourses);

        if (!groupSmsBody) {
          setPlanningFeedback('Impossible de générer le SMS.', true);
          return;
        }

        const smsURL = `sms:${collegue.telephone}?&body=${groupSmsBody}`;
        window.location.href = smsURL;
        return;
      }

      if (clearButton) {
        APP_STATE.selectedCourses.clear();
        renderPlanning();
        updateGroupSMSButton();
      }
    });
  }

  attachGroupSMSControls();
  updateGroupSMSButton();

  document.addEventListener('click', (event) => {
    if (!APP_STATE.openCourseMenuId) {
      return;
    }

    if (event.target.closest('[data-toggle-course-menu]') || event.target.closest('[data-edit-course]') || event.target.closest('[data-delete-course]') || event.target.closest('[data-reset-course]')) {
      return;
    }

    if (!event.target.closest('#planning-list')) {
      closeCourseMenu();
      return;
    }

    if (!event.target.closest('.shadow-xl')) {
      closeCourseMenu();
    }
  });

  const defaultFilterButton = UI.planningFilterButtons.find((item) => item.dataset.planningFilter === 'all');
  if (defaultFilterButton) {
    defaultFilterButton.classList.add('bg-taxi-yellow', 'text-black');
  }
}

function initAuthGuard() {
  onAuthStateChanged(auth, (user) => {
    const isAuthenticated = Boolean(user);
    updateShellForAuth(isAuthenticated);

    if (isAuthenticated) {
      listenCollegues();
      listenCourses();
      return;
    }

    if (APP_STATE.colleguesUnsubscribe) {
      APP_STATE.colleguesUnsubscribe();
      APP_STATE.colleguesUnsubscribe = null;
    }

    if (APP_STATE.coursesUnsubscribe) {
      APP_STATE.coursesUnsubscribe();
      APP_STATE.coursesUnsubscribe = null;
    }

    APP_STATE.collegues = [];
    APP_STATE.courses = [];

    renderCollegues([]);
    renderPlanning([]);
  });
}

function bootstrap() {
  bindNavigation();
  bindAuthActions();
  bindColleguesActions();
  bindCourseActions();
  bindEditCourseActions();
  bindPlanningActions();
  initAuthGuard();
}

bootstrap();
