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
  courseFeedback: document.getElementById('course-feedback'),
  courseSubmit: document.getElementById('course-submit'),
  planningList: document.getElementById('planning-list'),
  planningFeedback: document.getElementById('planning-feedback'),
  planningFilterButtons: Array.from(document.querySelectorAll('[data-planning-filter]'))
};

const APP_STATE = {
  isAuthenticated: false,
  activeView: 'view-login',
  colleguesUnsubscribe: null,
  coursesUnsubscribe: null,
  collegues: [],
  courses: [],
  planningFilter: 'all'
};

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

  const datePart = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  }).format(date);

  const timePart = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  })
    .format(date)
    .replace(':', 'h');

  return `${datePart.charAt(0).toUpperCase()}${datePart.slice(1)} à ${timePart}`;
}

function generateSMSURL(course, collegue) {
  if (!course || !collegue || !collegue.telephone) {
    return '';
  }

  const courseDate = formatCourseDate(course.datetime);
  const message = `Salut ${collegue.nom}, course prévue le ${courseDate}. Trajet : ${course.depart} -> ${course.arrivee}. Confirme-moi si c'est OK !`;
  return `sms:${collegue.telephone}?&body=${encodeURIComponent(message)}`;
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
      const borderClass = status === 'assigne' ? 'border-emerald-500/80' : 'border-yellow-400/90';
      const badgeClass = status === 'assigne' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-400/20 text-yellow-300';
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
        <article class="rounded-xl border ${borderClass} bg-taxi-dark p-4">
          <div class="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 class="text-base font-bold text-white">${escapeHtml(course.client || 'Client non renseigné')}</h3>
              <p class="text-sm text-gray-300">${escapeHtml(course.depart || '?')} -> ${escapeHtml(course.arrivee || '?')}</p>
              <p class="mt-1 text-sm text-gray-400">${escapeHtml(formatCourseDate(course.datetime))}</p>
            </div>
            <span class="rounded-full px-2 py-1 text-xs font-semibold ${badgeClass}">${status === 'assigne' ? 'Assignée' : 'En attente'}</span>
          </div>

          ${status === 'en_attente'
            ? `
              <div class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                <select
                  data-course-select="${course.id}"
                  class="min-h-12 w-full rounded-xl border border-taxi-muted bg-taxi-panel px-3 text-sm text-white outline-none ring-taxi-yellow focus:ring-2"
                >
                  ${colleguesOptions}
                </select>
                <button
                  type="button"
                  data-assign-course="${course.id}"
                  class="min-h-12 rounded-xl bg-taxi-yellow px-4 text-sm font-bold text-black"
                >
                  Confirmer l'assignation
                </button>
              </div>
            `
            : `
              <p class="mb-3 text-sm text-emerald-300">Assigné à : ${escapeHtml(assignedCollegue?.nom || 'Collègue')}</p>
              <div class="grid gap-2 sm:grid-cols-2">
                ${smsURL
                  ? `<a href="${smsURL}" class="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-green-500 px-4 text-sm font-bold text-black">Envoyer SMS</a>`
                  : `<button type="button" disabled class="min-h-12 w-full rounded-xl bg-green-500/40 px-4 text-sm font-bold text-black/70">SMS indisponible</button>`}
                <button
                  type="button"
                  data-reset-course="${course.id}"
                  class="min-h-12 rounded-xl border border-red-500/70 px-4 text-sm font-semibold text-red-300"
                >
                  Annuler
                </button>
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

  const coursesQuery = query(collection(db, 'courses'), orderBy('datetime', 'asc'));
  APP_STATE.coursesUnsubscribe = onSnapshot(
    coursesQuery,
    (snapshot) => {
      APP_STATE.courses = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
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

async function removeCollegue(collegueId) {
  await deleteDoc(doc(db, 'collegues', collegueId));
}

async function addCourse(event) {
  event.preventDefault();
  setCourseFeedback('');

  const client = UI.courseClient.value.trim();
  const depart = UI.courseDepart.value.trim();
  const arrivee = UI.courseArrivee.value.trim();
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
      datetime,
      status: 'en_attente',
      created_at: serverTimestamp(),
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

function bindPlanningActions() {
  if (!UI.planningList) {
    return;
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
    const assignButton = event.target.closest('[data-assign-course]');
    const resetButton = event.target.closest('[data-reset-course]');

    if (assignButton) {
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
  bindPlanningActions();
  initAuthGuard();
}

bootstrap();
