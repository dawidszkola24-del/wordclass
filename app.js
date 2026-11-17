
/*
  WordClass — etap 1: Supabase
  Logowanie administratora i zarządzanie klasami.
  Konta uczniów, oceny i testy zostaną podłączone później.
*/

const $ = id => document.getElementById(id);

const db = window.wordclassSupabase;

let user = null;
let loginRole = 'student';
let classes = [];

function msg(text) {
  const element = $('message');
  if (element) element.textContent = text;
}

function show(id) {
  ['home', 'login', 'setup', 'admin', 'student'].forEach(name => {
    const element = $(name);
    if (element) element.classList.toggle('hidden', name !== id);
  });
  msg('');
}

function notice(text) {
  msg(text);
  alert(text);
}

function unavailable() {
  notice(
    'Ta funkcja będzie dostępna po podłączeniu kont uczniów do Supabase.'
  );
}

// ------------------------------------------
// LOGOWANIE
// ------------------------------------------

function openLogin(role) {
  loginRole = role;

  $('loginHeading').textContent =
    role === 'admin'
      ? '👩‍🏫 Logowanie administratora'
      : '🎓 Logowanie ucznia';

  $('loginIcon').textContent =
    role === 'admin' ? '👩‍🏫' : '🎓';

  $('loginHelp').textContent =
    role === 'admin'
      ? 'Wpisz e-mail i hasło administratora z Supabase.'
      : 'Logowanie uczniów uruchomimy w kolejnym etapie.';

  $('demoHint').textContent =
    role === 'admin'
      ? 'Bezpieczne logowanie przez Supabase'
      : 'Konta uczniów są jeszcze przygotowywane.';

  $('loginName').value = '';
  $('loginPass').value = '';

  if ($('resetLoginArea')) {
    $('resetLoginArea').classList.add('hidden');
  }

  if ($('resetRequestForm')) {
    $('resetRequestForm').classList.add('hidden');
  }

  if ($('resetCodeForm')) {
    $('resetCodeForm').classList.add('hidden');
  }

  show('login');
  $('loginName').focus();
}

async function login() {
  const email = $('loginName').value.trim();
  const password = $('loginPass').value;

  if (loginRole !== 'admin') {
    msg('Logowanie uczniów uruchomimy w kolejnym etapie.');
    return;
  }

  if (!db) {
    msg('Brak połączenia z Supabase. Sprawdź plik index.html.');
    return;
  }

  if (!email || !password) {
    msg('Wpisz e-mail i hasło administratora.');
    return;
  }

  if (!email.includes('@')) {
    msg('Zamiast loginu admin wpisz swój e-mail z Supabase.');
    return;
  }

  $('signIn').disabled = true;

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      msg('Nieprawidłowy e-mail lub hasło.');
      return;
    }

    const result = await db
      .from('wordclass_profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (result.error || result.data?.role !== 'admin') {
      await db.auth.signOut();
      msg('To konto nie ma uprawnień administratora.');
      return;
    }

    user = {
      id: data.user.id,
      admin: true
    };

    show('admin');
    showAdminDashboard();
    await loadClasses();

  } catch (error) {
    msg('Błąd logowania: ' + error.message);
  } finally {
    $('signIn').disabled = false;
  }
}

async function logout() {
  if (db) {
    await db.auth.signOut();
  }

  user = null;
  classes = [];
  $('loginPass').value = '';
  show('home');
}

$('goAdmin').onclick = () => openLogin('admin');
$('goStudent').onclick = () => openLogin('student');
$('backHome').onclick = () => show('home');
$('signIn').onclick = login;

$('loginPass').addEventListener('keydown', event => {
  if (event.key === 'Enter') login();
});

document.querySelectorAll('.logout').forEach(button => {
  button.onclick = logout;
});

// ------------------------------------------
// KLASY — SUPABASE
// ------------------------------------------

async function loadClasses() {
  if (!user?.admin) return;

  const result = await db
    .from('wordclass_classes')
    .select('id,name')
    .order('id', { ascending: true });

  if (result.error) {
    msg('Nie udało się pobrać klas: ' + result.error.message);
    return;
  }

  classes = result.data || [];
  renderClasses();
}

function renderClasses() {
  $('classLimit').textContent = classes.length + ' / 10';

  const list = $('classList');
  list.replaceChildren();

  classes.forEach(item => {
    const box = document.createElement('div');
    box.className = 'class-item';

    const title = document.createElement('strong');
    title.textContent = '🏫 ' + item.name;

    const button = document.createElement('button');
    button.className = 'danger';
    button.textContent = 'Usuń klasę';

    button.onclick = async () => {
      if (!user?.admin) return;

      const confirmed = confirm(
        'Czy na pewno usunąć klasę ' + item.name + '?'
      );

      if (!confirmed) return;

      button.disabled = true;

      const result = await db
        .from('wordclass_classes')
        .delete()
        .eq('id', item.id);

      if (result.error) {
        msg('Nie udało się usunąć klasy: ' + result.error.message);
        button.disabled = false;
        return;
      }

      await loadClasses();
      msg('Usunięto klasę z Supabase.');
    };

    box.append(title, button);
    list.append(box);
  });

  const generateClass = $('generateClass');
  const filterClass = $('filterClass');

  if (generateClass) {
    generateClass.replaceChildren();

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Bez klasy';
    generateClass.append(empty);
  }

  if (filterClass) {
    filterClass.replaceChildren();

    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = 'Wszystkie klasy';
    filterClass.append(all);

    const none = document.createElement('option');
    none.value = 'none';
    none.textContent = 'Bez klasy';
    filterClass.append(none);
  }

  classes.forEach(item => {
    for (const select of [generateClass, filterClass]) {
      if (!select) continue;

      const option = document.createElement('option');
      option.value = String(item.id);
      option.textContent = item.name;
      select.append(option);
    }
  });
}

$('addClass').onclick = async () => {
  if (!user?.admin) return;

  const name = $('className').value.trim();

  if (!name) {
    msg('Wpisz nazwę klasy.');
    return;
  }

  if (classes.length >= 10) {
    msg('Można mieć maksymalnie 10 klas.');
    return;
  }

  if (
    classes.some(
      item => item.name.toLowerCase() === name.toLowerCase()
    )
  ) {
    msg('Klasa o tej nazwie już istnieje.');
    return;
  }

  $('addClass').disabled = true;

  try {
    const result = await db
      .from('wordclass_classes')
      .insert({ name });

    if (result.error) {
      msg('Nie udało się dodać klasy: ' + result.error.message);
      return;
    }

    $('className').value = '';

    await loadClasses();

    msg('Dodano klasę ' + name + ' do Supabase.');

  } finally {
    $('addClass').disabled = false;
  }
};

// ------------------------------------------
// KOLOROWE KAFELKI ADMINISTRATORA
// ------------------------------------------

function buildAdminDashboard() {
  const admin = $('admin');
  const top = admin.querySelector('.top');

  const dashboard = document.createElement('div');
  dashboard.id = 'adminTiles';
  dashboard.className = 'dashboard-tiles';

  const back = document.createElement('button');
  back.id = 'adminBack';
  back.type = 'button';
  back.className = 'secondary dashboard-back hidden';
  back.textContent = '← Wróć do kafelków';
  back.onclick = showAdminDashboard;

  top.after(dashboard, back);

  const blocks = [
    {
      id: 'adminClasses',
      icon: '🏫',
      title: 'Moje klasy',
      desc: 'Twórz i usuwaj klasy',
      start: admin.querySelector('.class-manager'),
      end: admin.querySelector('.class-manager'),
      enabled: true
    },
    {
      id: 'adminAccounts',
      icon: '👥',
      title: 'Konta uczniów',
      desc: 'Wkrótce: konta i hasła',
      start: [...admin.children].find(
        element =>
          element.tagName === 'H3' &&
          element.textContent.includes('Konta uczniów')
      ),
      end: admin.querySelector('#printAccounts'),
      enabled: true
    },
    {
      id: 'adminResets',
      icon: '🔑',
      title: 'Reset haseł',
      desc: 'Wkrótce: bezpieczne kody',
      start: admin.querySelector('.reset-admin'),
      end: admin.querySelector('.reset-admin'),
      enabled: false
    },
    {
      id: 'adminGrades',
      icon: '📊',
      title: 'Oceny uczniów',
      desc: 'Wkrótce: dziennik online',
      start: [...admin.children].find(
        element =>
          element.tagName === 'H3' &&
          element.textContent.includes('Dziennik ocen')
      ),
      end: admin.querySelector('#gradeEditor'),
      enabled: false
    }
  ];

  blocks.forEach(block => {
    if (!block.start || !block.end) return;

    const panel = document.createElement('div');
    panel.id = block.id;
    panel.className = 'dashboard-section hidden';

    let node = block.start;

    while (node) {
      const next = node.nextElementSibling;
      panel.append(node);

      if (node === block.end) break;

      node = next;
    }

    admin.append(panel);

    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'dashboard-tile';

    const icon = document.createElement('span');
    icon.className = 'tile-icon';
    icon.textContent = block.icon;

    const title = document.createElement('strong');
    title.textContent = block.title;

    const description = document.createElement('small');
    description.textContent = block.desc;

    const arrow = document.createElement('span');
    arrow.className = 'tile-arrow';
    arrow.textContent = 'Otwórz →';

    tile.append(icon, title, description, arrow);

    tile.onclick = () => {
      if (block.enabled) {
        openAdminSection(block.id);
      } else {
        unavailable();
      }
    };

    dashboard.append(tile);
  });

  const approvals = document.createElement('button');
  approvals.type = 'button';
  approvals.className = 'dashboard-tile';

  approvals.innerHTML =
    '<span class="tile-icon">📨</span>' +
    '<strong>Akceptacja średniej</strong>' +
    '<small>Wkrótce: prośby uczniów</small>' +
    '<span class="tile-arrow">Otwórz →</span>';

  approvals.onclick = unavailable;
  dashboard.append(approvals);
}

function showAdminDashboard() {
  $('adminTiles').classList.remove('hidden');
  $('adminBack').classList.add('hidden');

  [
    'adminClasses',
    'adminAccounts',
    'adminResets',
    'adminGrades'
  ].forEach(id => {
    if ($(id)) $(id).classList.add('hidden');
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openAdminSection(id) {
  $('adminTiles').classList.add('hidden');
  $('adminBack').classList.remove('hidden');

  [
    'adminClasses',
    'adminAccounts',
    'adminResets',
    'adminGrades'
  ].forEach(name => {
    if ($(name)) {
      $(name).classList.toggle('hidden', name !== id);
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ------------------------------------------
// FUNKCJE UCZNIÓW — KOLEJNY ETAP
// ------------------------------------------

function buildStudentDashboard() {
  const student = $('student');
  const top = student.querySelector('.top');
  const tiles = student.querySelector('nav');

  if (!tiles) return;

  tiles.id = 'studentTiles';
  tiles.classList.add('dashboard-tiles');

  const names = {
    notes: ['📒', 'Mój notes', 'Zapisuj słówka'],
    practice: ['🎯', 'Ćwiczenia', 'Trenuj tłumaczenia'],
    test: ['📝', 'Testy i PDF', 'Sprawdź wiedzę'],
    verbs: ['🔤', '3 formy czasowników', 'Ćwicz czasowniki'],
    grades: ['📊', 'Moje oceny', 'Zobacz oceny']
  };

  tiles.querySelectorAll('[data-tab]').forEach(button => {
    const info = names[button.dataset.tab];
    if (!info) return;

    button.className = 'dashboard-tile';
    button.innerHTML =
      '<span class="tile-icon">' + info[0] + '</span>' +
      '<strong>' + info[1] + '</strong>' +
      '<small>' + info[2] + '</small>' +
      '<span class="tile-arrow">Otwórz →</span>';

    button.onclick = unavailable;
  });

  const back = document.createElement('button');
  back.id = 'studentBack';
  back.type = 'button';
  back.className = 'secondary dashboard-back hidden';
  back.textContent = '← Wróć do kafelków';

  top.after(back);
}

// Nie zapisujemy kont ani ocen uczniów w localStorage.

[
  'finishSetup',
  'deleteAllAccounts',
  'printAccounts',
  'addGrade',
  'requestAverage',
  'sendResetRequest',
  'redeemResetCode',
  'saveWords',
  'saveVerbs',
  'makeTest',
  'checkTest',
  'nextQuestion',
  'newVerbQuestion',
  'checkVerb',
  'makeVerbTest',
  'printVerbTest',
  'printTest',
  'showResetRequest',
  'showResetCode'
].forEach(id => {
  if ($(id)) $(id).onclick = unavailable;
});

// ------------------------------------------
// START STRONY
// ------------------------------------------

buildAdminDashboard();
buildStudentDashboard();

show('home');

$('generate').onclick = async () => {
  if (!user?.admin) {
    notice('Zaloguj się jako administrator.');
    return;
  }

  const count = Number($('count').value);
  const classValue = $('generateClass')?.value;
  const classId = classValue ? Number(classValue) : null;

  if (!Number.isInteger(count) || count < 1 || count > 50) {
    notice('Podaj liczbę uczniów od 1 do 50.');
    return;
  }

  const button = $('generate');
  button.disabled = true;

  try {
    const { data: sessionData } = await db.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      notice('Sesja wygasła. Zaloguj się ponownie.');
      return;
    }

    const response = await fetch(
      'https://mqjnjzuhrmspcspkvjvl.supabase.co/functions/v1/wordclass-create-students',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'sb_publishable_lT_I31LEre8X0h3H5hAWtw_54mud94_',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ count, classId })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      notice(result.error || 'Nie udało się utworzyć kont.');
      return;
    }

    const accounts = result.created || [];

    const output = accounts.map(
      item => item.login + ' — ' + item.password
    ).join('\n');

    notice('Utworzono ' + accounts.length + ' kont uczniów.');

    if (output) {
      const windowRef = window.open('', '_blank');

      if (windowRef) {
        const pre = windowRef.document.createElement('pre');
        pre.textContent = output;
        windowRef.document.body.append(pre);
      } else {
        alert(output);
      }
    }
  } catch (error) {
    notice('Błąd połączenia: ' + error.message);
  } finally {
    button.disabled = false;
  }
};

