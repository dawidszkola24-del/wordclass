
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
      : 'Wpisz login ucznia i hasło.';

  $('demoHint').textContent =
    role === 'admin'
      ? 'Bezpieczne logowanie przez Supabase'
      : 'Bezpieczne logowanie przez Supabase';

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


  if (!db) {
    msg('Brak połączenia z Supabase. Sprawdź plik index.html.');
    return;
  }

  if (!email || !password) {
    msg('Wpisz e-mail i hasło administratora.');
    return;
  }

  if (loginRole === 'admin' && !email.includes('@')) {
    msg('Administrator wpisuje e-mail z Supabase.');
    return;
  }

  $('signIn').disabled = true;

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: loginRole === 'student' ? email.toLowerCase() + '@students.wordclass.invalid' : email,
      password
    });

    if (error || !data.user) {
      msg('Nieprawidłowy e-mail lub hasło.');
      return;
    }

    const result = await db
      .from('wordclass_profiles')
      .select('role,login,full_name,class_id')
      .eq('id', data.user.id)
      .single();

    if (result.error || result.data?.role !== loginRole) {
      await db.auth.signOut();
      msg('To konto nie ma uprawnień dla wybranej roli.');
      return;
    }

    user = {
      id: data.user.id,
      admin: loginRole === 'admin',
      login: result.data.login || email,
      full_name: result.data.full_name || '',
      class_id: result.data.class_id
    };

    if (user.admin) {
      show('admin');
      showAdminDashboard();
      await loadClasses();
      await wcLoadStudents();
    } else {
      show('student');
      $('studentTitle').textContent = '🎓 ' + (user.full_name || user.login);
      wcStudentDashboard();
      await wcLoadStudentData();
    }

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
      desc: 'Loginy, uczniowie, klasy i odzyskiwanie dostępu',
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
      enabled: true
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
      enabled: true
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
      openAdminSection(block.id);
      if (block.id === 'adminGrades' || block.id === 'adminAccounts') wcLoadStudents();
      if (block.id === 'adminResets') wcShowResetInfo();
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

  approvals.onclick = () => { openAdminSection('adminGrades'); wcLoadStudents(); }; 
  dashboard.append(approvals);

  const notesTile = document.createElement('button');
  notesTile.type='button';notesTile.className='dashboard-tile';
  notesTile.innerHTML='<span class="tile-icon">📒</span><strong>Notes zdań bez limitu</strong><small>Dodawaj kolejne zdania — bez AI</small><span class="tile-arrow">Otwórz →</span>';
  notesTile.onclick=()=>{openAdminSection('adminSentenceNotes');wcNotesLoad();};
  dashboard.append(notesTile);
  const testTile = document.createElement('button');
  testTile.type = 'button';
  testTile.className = 'dashboard-tile';
  testTile.innerHTML = '<span class="tile-icon">📝</span><strong>Generator testów A–G</strong><small>Testy do wydruku i PDF</small><span class="tile-arrow">Otwórz →</span>';
  testTile.onclick = () => openAdminSection('adminTestGenerator');
  dashboard.append(testTile);
}

function showAdminDashboard() {
  $('adminTiles').classList.remove('hidden');
  $('adminBack').classList.add('hidden');

  [
    'adminClasses',
    'adminAccounts',
    'adminResets',
    'adminGrades',
    'adminTestGenerator',
    'adminSentenceNotes'
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
    'adminGrades',
    'adminTestGenerator',
    'adminSentenceNotes'
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

    button.onclick = () => wcOpenStudentTab(button.dataset.tab);
  });

  const back = document.createElement('button');
  back.id = 'studentBack';
  back.type = 'button';
  back.className = 'secondary dashboard-back hidden';
  back.textContent = '← Wróć do kafelków';

  top.after(back);
  back.onclick = wcStudentDashboard;
}

// Nie zapisujemy kont ani ocen uczniów w localStorage.

// Generator nauczyciela: zapewnij istnienie panelu nawet wtedy,
// gdy index.html na GitHubie jest starsza wersja.
function wcEnsureTeacherGeneratorPanel() {
  const admin = $('admin');
  if (!admin) return;
  let panel = $('adminTestGenerator');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'adminTestGenerator';
    panel.className = 'dashboard-section hidden';
    panel.innerHTML = `
      <h3>📝 Generator testów A–G</h3>
      <p>Wpisz pary słówek, każdą w osobnej linii, np. <b>apple - jabłko</b>.
      Utworzysz siedem wersji testu do wydruku lub zapisania jako PDF.</p>
      <label>Tytuł testu
        <input id="teacherTestTitle" maxlength="80" placeholder="np. Unit 3 — słówka">
      </label>
      <label>Słówka i tłumaczenia
        <textarea id="teacherTestWords" rows="10" placeholder="apple - jabłko&#10;dog - pies&#10;cat - kot"></textarea>
      </label>
      <label>Liczba pytań w każdej grupie
        <input id="teacherTestCount" type="number" min="1" max="50" value="3">
      </label>
      <label>Kierunek tłumaczenia
        <select id="teacherTestDirection">
          <option value="mixed">Mieszany — oba kierunki</option>
          <option value="enpl">Angielski → polski</option>
          <option value="plen">Polski → angielski</option>
        </select>
      </label>
      <button id="teacherMakeTests" type="button">🎲 Generuj grupy A–G</button>
      <button id="teacherPrintTests" type="button" class="secondary" disabled>🖨️ Drukuj / PDF</button>
      <p id="teacherTestStatus" role="status" aria-live="polite"></p>
      <div id="teacherTestPreview"></div>`;
  }
  // Sekcja musi być bezpośrednim dzieckiem #admin, nie innego kafelka.
  admin.append(panel);
  panel.classList.add('hidden');
}

// ------------------------------------------
// START STRONY
// ------------------------------------------

wcEnsureTeacherGeneratorPanel();
buildAdminDashboard();
// Tabela kont jest w HTML obok dziennika ocen. Przenosimy ją do kafelka Konta uczniów.
(function wcPlaceAccountsTable() {
  const table = $('accounts')?.closest('.tableWrap');
  const accountsPanel = $('adminAccounts');
  const printButton = $('printAccounts');
  if (table && accountsPanel) {
    if (printButton && printButton.parentElement === accountsPanel) {
      printButton.after(table);
    } else {
      accountsPanel.append(table);
    }
  }
})();
buildStudentDashboard();

show('home');

// Formularz tworzenia pojedynczego konta — bez zmian w pozostałych modułach.
(function wcSetupNamedStudentForm() {
  const generate = $('generate');
  if (!generate || $('wcStudentFirstName')) return;
  const form = document.createElement('div');
  form.id = 'wcNamedStudentForm';
  form.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:14px 0';
  for (const [id, labelText, placeholder] of [
    ['wcStudentFirstName', 'Imię ucznia', 'np. Jan'],
    ['wcStudentLastName', 'Nazwisko ucznia', 'np. Kowalski']
  ]) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.id = id;
    input.type = 'text';
    input.maxLength = 80;
    input.autocomplete = 'off';
    input.placeholder = placeholder;
    input.required = true;
    input.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin-top:5px';
    label.append(input);
    form.append(label);
  }
  generate.before(form);
  const countInput = $('count');
  if (countInput) {
    const countLabel = countInput.closest('label');
    if (countLabel) countLabel.style.display = 'none';
    else countInput.style.display = 'none';
  }
  generate.textContent = '👤 Generuj konto ucznia';
})();

function wcStudentLoginPart(value) {
  return String(value || '').trim().toLocaleLowerCase('pl')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/[^a-z0-9]/g, '');
}

$('generate').onclick = async () => {
  if (!user?.admin) return notice('Zaloguj się jako administrator.');
  const firstName = $('wcStudentFirstName').value.trim().replace(/\s+/g, ' ');
  const lastName = $('wcStudentLastName').value.trim().replace(/\s+/g, ' ');
  if (!firstName || !lastName) return notice('Wpisz imię i nazwisko ucznia.');
  const login = wcStudentLoginPart(firstName) + '.' + wcStudentLoginPart(lastName);
  if (!/^[a-z0-9]+\.[a-z0-9]+$/.test(login))
    return notice('Podaj imię i nazwisko zawierające litery lub cyfry.');
  const classValue = $('generateClass')?.value;
  const classId = classValue ? Number(classValue) : null;
  const button = $('generate');
  button.disabled = true;
  try {
    const { data: sessionData } = await db.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return notice('Sesja wygasła. Zaloguj się ponownie.');
    // Serwer musi potwierdzić obsługę nazwanych kont i sam wygenerować hasło.
    // Bez tego nie tworzymy omyłkowo kont uczen1, uczen2 itd.
    const response = await fetch(
      'https://mqjnjzuhrmspcspkvjvl.supabase.co/functions/v1/wordclass-create-students',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'sb_publishable_lT_I31LEre8X0h3H5hAWtw_54mud94_',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ mode: 'named-student-v1', firstName, lastName, login, classId })
      }
    );
    const result = await response.json();
    if (!response.ok || result.success !== true) {
      return notice(result.error || 'Nie udało się utworzyć konta. Sprawdź funkcję Supabase.');
    }
    const accounts = result.created || [];
    if (accounts.length !== 1 || !(accounts[0]?.login === login || new RegExp('^' + login.replace('.', '\\.') + '[2-9][0-9]*$').test(accounts[0]?.login || '')) ||
        typeof accounts[0]?.password !== 'string' || accounts[0].password.length !== 6) {
      await wcLoadStudents();
      return notice('Serwer nie potwierdził poprawnego loginu i 6-znakowego hasła. Sprawdź funkcję Supabase przed kolejną próbą.');
    }
    const selectedClass = classes.find(item => item.id === classId);
    const className = selectedClass ? selectedClass.name : 'Bez klasy';
    wcLastPrint = { accounts, name: className };
    pokazTabeleKont(accounts, className);
    $('wcStudentFirstName').value = '';
    $('wcStudentLastName').value = '';
    await wcLoadStudents();
    notice('Utworzono konto: ' + accounts[0].login + '. Zapisz lub wydrukuj hasło.');
  } catch (error) {
    notice('Błąd połączenia: ' + error.message);
  } finally {
    button.disabled = false;
  }
};
$('printAccounts').onclick = () => {
  if (!wcLastPrint) return notice('Hasła są widoczne tylko przy tworzeniu kont. Wygeneruj nowe konta i od razu zapisz tabelkę.');
  pokazTabeleKont(wcLastPrint.accounts, wcLastPrint.name);
};
// Przygotowanie estetycznej tabeli do drukowania kont uczniów.
function pokazTabeleKont(konta, nazwaKlasy) {
  if (!konta || konta.length === 0) return;

  const okno = window.open('', '_blank');

  if (!okno) {
    alert('Przeglądarka zablokowała okno wydruku. Zezwól na wyskakujące okna.');
    return;
  }

  const dokument = okno.document;

  dokument.title = 'WordClass - konta uczniów';

  const styl = dokument.createElement('style');
  styl.textContent = `
    body {
      font-family: Arial, sans-serif;
      margin: 35px;
      color: #253047;
    }
    h1 {
      color: #5645c7;
      margin-bottom: 5px;
    }
    h2 {
      color: #344054;
      font-size: 18px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 25px;
    }
    th {
      background: #5645c7;
      color: white;
      padding: 12px;
      text-align: left;
    }
    td {
      border: 1px solid #d9dce5;
      padding: 12px;
    }
    tr:nth-child(even) {
      background: #f2f0ff;
    }
    button {
      background: #5645c7;
      color: white;
      border: 0;
      border-radius: 8px;
      padding: 12px 20px;
      cursor: pointer;
      margin-top: 20px;
    }
    @media print {
      button { display: none; }
      body { margin: 12mm; }
      th {
        background: #5645c7 !important;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  `;
  dokument.head.append(styl);

  const tytul = dokument.createElement('h1');
  tytul.textContent = '🎓 WordClass';

  const podtytul = dokument.createElement('h2');
  podtytul.textContent = 'Konta uczniów — ' + nazwaKlasy;

  const tabela = dokument.createElement('table');
  const naglowek = dokument.createElement('tr');

  ['Lp.', 'Login ucznia', 'Hasło'].forEach(nazwa => {
    const th = dokument.createElement('th');
    th.textContent = nazwa;
    naglowek.append(th);
  });

  tabela.append(naglowek);

  konta.forEach((konto, indeks) => {
    const wiersz = dokument.createElement('tr');

    [
      String(indeks + 1),
      konto.login,
      konto.password
    ].forEach(wartosc => {
      const td = dokument.createElement('td');
      td.textContent = wartosc || '';
      wiersz.append(td);
    });

    tabela.append(wiersz);
  });

  const drukuj = dokument.createElement('button');
  drukuj.textContent = '🖨️ Drukuj tabelę';
  drukuj.onclick = () => okno.print();

  dokument.body.append(tytul, podtytul, tabela, drukuj);
}


// WordClass: funkcje ucznia, dziennik, testy A–G.
// Hasła nie są zapisywane w przeglądarce.
let wcLastPrint = null;
let wcStudents = [];
let wcGradeStudent = null;
let wcWords = [];
let wcVerbs = [];
let wcQuestion = null;
let wcVerbQuestion = null;
let wcTest = [];
let wcTestGroup = null;
const wcGroups = 'ABCDEFG';
const wcNorm = v => String(v || '').trim().toLocaleLowerCase('pl');
const wcShuffle = list => [...list].sort(() => Math.random() - 0.5);
const wcEl = (tag, text) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = String(text); return el; };
function wcStudentDashboard() {
  $('studentTiles')?.classList.remove('hidden');
  $('studentBack')?.classList.add('hidden');
  document.querySelectorAll('#student .tab').forEach(el => el.classList.add('hidden'));
}
function wcOpenStudentTab(name) {
  $('studentTiles')?.classList.add('hidden');
  $('studentBack')?.classList.remove('hidden');
  document.querySelectorAll('#student .tab').forEach(el => el.classList.toggle('hidden', el.id !== name));
  if (name === 'grades') wcLoadOwnGrades();
}
async function wcLoadStudentData() {
  for (const [table, setter, input, count] of [
    ['wordclass_words', v => wcWords = v, 'wordInput', 'wordCount'],
    ['wordclass_verbs', v => wcVerbs = v, 'verbInput', 'verbCount']
  ]) {
    const {data, error} = await db.from(table).select('content').eq('student_id',user.id).maybeSingle();
    if (error) { msg('Brakuje tabeli Supabase ' + table + '. Wgraj dołączony plik SQL.'); continue; }
    const raw = data?.content || '';
    $(input).value = raw;
    setter(wcParse(raw, table === 'wordclass_verbs' ? 4 : 2));
    $(count).textContent = 'Zapisano: ' + (table === 'wordclass_verbs' ? wcVerbs.length : wcWords.length) + '/100';
  }
}
function wcParse(raw, count) {
  return raw.split(/\r?\n/).map(line => line.split(/\s+-\s+/).map(x=>x.trim())).filter(parts => parts.length === count && parts.every(Boolean)).slice(0,100);
}
async function wcSave(table, input, count, kind) {
  if (!user || user.admin) return;
  const raw = $(input).value.trim();
  const rows = wcParse(raw, kind);
  if (raw && !rows.length) return notice('Popraw format: każda linia ma mieć ' + kind + ' części oddzielone znakiem - .');
  const {error} = await db.from(table).upsert({student_id:user.id,content:raw},{onConflict:'student_id'});
  if (error) return notice('Nie zapisano: ' + error.message + '. Sprawdź SQL.');
  if (kind===2) wcWords=rows; else wcVerbs=rows;
  $(count).textContent='Zapisano: '+rows.length+'/100';
  msg('Zapisano w Supabase.');
}
$('saveWords').onclick = () => wcSave('wordclass_words','wordInput','wordCount',2);
$('saveVerbs').onclick = () => wcSave('wordclass_verbs','verbInput','verbCount',4);
function wcNextQuestion() {
  if (!wcWords.length) return notice('Najpierw zapisz słówka w notesie.');
  const pair = wcWords[Math.floor(Math.random()*wcWords.length)];
  const reverse = $('direction').value === 'plen';
  wcQuestion = reverse ? [pair[1],pair[0]] : [pair[0],pair[1]];
  $('question').textContent='Przetłumacz: '+wcQuestion[0];
  const area=$('answers'); area.replaceChildren();
  const input=wcEl('input'); input.placeholder='Twoja odpowiedź';
  const check=wcEl('button','Sprawdź');
  check.onclick=()=> $('feedback').textContent = wcNorm(input.value)===wcNorm(wcQuestion[1]) ? '✅ Dobrze!' : '❌ Poprawnie: '+wcQuestion[1];
  area.append(input,check); $('feedback').textContent='';
}
$('nextQuestion').onclick=wcNextQuestion;
$('newVerbQuestion').onclick=()=>{
  if(!wcVerbs.length)return notice('Najpierw zapisz czasowniki.');
  wcVerbQuestion=wcVerbs[Math.floor(Math.random()*wcVerbs.length)];
  $('verbPrompt').textContent=wcVerbQuestion[0]+' — '+wcVerbQuestion[3];
  $('verbPast').value=''; $('verbParticiple').value=''; $('verbFeedback').textContent='';
};
$('checkVerb').onclick=()=>{
  if(!wcVerbQuestion)return notice('Najpierw kliknij Nowe pytanie.');
  const good=wcNorm($('verbPast').value)===wcNorm(wcVerbQuestion[1]) && wcNorm($('verbParticiple').value)===wcNorm(wcVerbQuestion[2]);
  $('verbFeedback').textContent=good?'✅ Dobrze!':'❌ Poprawnie: '+wcVerbQuestion[1]+' — '+wcVerbQuestion[2];
};
function wcTestStart() {
  if (!wcWords.length) return notice('Najpierw zapisz słówka.');
  wcTestGroup = wcGroups[Math.floor(Math.random()*7)];
  const amount=$('testCount').value==='all'?wcWords.length:Number($('testCount').value);
  const shuffled=wcShuffle(wcWords).slice(0,amount);
  const direction=$('testDirection').value;
  const mode=$('testMode').value;
  wcTest=shuffled.map(pair=>{
    const reverse=direction==='plen'||(direction==='mixed'&&Math.random()<0.5);
    return {question:reverse?pair[1]:pair[0],answer:reverse?pair[0]:pair[1],mode};
  });
  const sheet=$('testSheet'); sheet.replaceChildren();
  sheet.append(wcEl('h3','🎲 Grupa '+wcTestGroup));
  wcTest.forEach((item,i)=>{
    const wrap=wcEl('div'); wrap.style.margin='14px 0';
    wrap.append(wcEl('strong',(i+1)+'. '+item.question));
    if(mode==='open'){
      const inp=wcEl('input'); inp.dataset.question=String(i); inp.placeholder='Wpisz odpowiedź';wrap.append(inp);
    }else{
      const select=wcEl('select');select.dataset.question=String(i);
      select.append(wcEl('option','Wybierz odpowiedź'));
      const choices=wcShuffle([item.answer,...wcShuffle(wcWords.map(p=>p[0]).concat(wcWords.map(p=>p[1])).filter(v=>wcNorm(v)!==wcNorm(item.answer))).slice(0,3)]);
      choices.forEach(choice=>{const option=wcEl('option',choice);option.value=choice;select.append(option);});
      wrap.append(select);
    }
    sheet.append(wrap);
  });
  $('checkTest').disabled=false; $('testResult').textContent='';
}
$('makeTest').onclick=wcTestStart;
$('checkTest').onclick=async()=>{
  if(!wcTest.length)return;
  let points=0;
  wcTest.forEach((q,i)=>{
    const input=$('testSheet').querySelector('[data-question="'+i+'"]');
    if(wcNorm(input?.value)===wcNorm(q.answer))points++;
    input.disabled=true;
  });
  const percent=Math.round(100*points/wcTest.length);
  const grade=percent>=95?6:percent>=85?5:percent>=70?4:percent>=50?3:percent>=30?2:1;
  $('testResult').textContent='Grupa '+wcTestGroup+': '+points+'/'+wcTest.length+' ('+percent+'%), ocena '+grade;
  $('checkTest').disabled=true;
  msg('Wynik testu ćwiczeniowego jest widoczny. Automatyczny zapis oceny wymaga testu utworzonego przez administratora i sprawdzenia na serwerze.');
};
$('printTest').onclick=()=>window.print();
$('makeVerbTest').onclick=()=>{
  const sheet=$('verbTestSheet');sheet.replaceChildren();
  if(!wcVerbs.length)return notice('Najpierw zapisz czasowniki.');
  sheet.append(wcEl('h3','Test czasowników'));
  wcShuffle(wcVerbs).slice(0,20).forEach((v,i)=>sheet.append(wcEl('p',(i+1)+'. '+v[0]+' — __________ — __________')));
};
$('printVerbTest').onclick=()=>window.print();
async function wcLoadStudents(){
  if(!user?.admin)return;
  const {data,error}=await db.from('wordclass_profiles').select('id,login,full_name,class_id').eq('role','student').order('login');
  if(error)return msg('Nie udało się pobrać uczniów: '+error.message);
  wcStudents=data||[];
  $('totalAccounts').textContent='Łącznie uczniów: '+wcStudents.length;
  const tbody=$('accounts');tbody.replaceChildren();
  // Dopasuj nagłówki do sześciu kolumn istniejącej tabeli.
  const table=tbody.closest('table');
  if(table){
    let thead=table.querySelector('thead');
    if(!thead){thead=document.createElement('thead');table.prepend(thead);}
    thead.replaceChildren();
    const header=wcEl('tr');
    ['Login','Hasło','Imię i nazwisko','Klasa','Status','Działania'].forEach(label=>header.append(wcEl('th',label)));
    thead.append(header);
  }
  const filter=$('filterClass')?.value||'all';
  wcStudents.filter(s=>filter==='all'||(filter==='none'?!s.class_id:String(s.class_id)===filter)).forEach(s=>{
    const tr=wcEl('tr');
    const cls=classes.find(c=>String(c.id)===String(s.class_id))?.name||'Bez klasy';
    const cells=[s.login||'', '🔒 Nie można odczytać', s.full_name||'Nie podano', cls, s.class_id?'Przypisany':'⚠️ Bez klasy'];
    cells.forEach(v=>tr.append(wcEl('td',v)));
    const actions=wcEl('td');
    const grades=wcEl('button','📊 Oceny');
    grades.type='button';
    grades.onclick=()=>{openAdminSection('adminGrades');wcOpenGrades(s);};
    const reset=wcEl('button','🔑 Hasło');
    reset.type='button';reset.className='secondary';
    reset.onclick=()=>notice('Hasła ucznia '+(s.login||'')+' nie można odczytać. Bezpieczne ustawienie nowego hasła wymaga uruchomienia funkcji serwerowej Supabase. Nie wpisuj nowego hasła w tabeli ani w SQL.');
    actions.append(grades,document.createTextNode(' '),reset);
    tr.append(actions);tbody.append(tr);
  });
}
$('filterClass').onchange=wcLoadStudents;
async function wcOpenGrades(student){
  wcGradeStudent=student;
  $('gradeEditor').classList.remove('hidden');
  $('gradeStudentHeading').textContent='Oceny: '+(student.full_name||student.login);
  await wcRefreshGrades();
  $('gradeEditor').scrollIntoView({behavior:'smooth',block:'start'});
}
async function wcRefreshGrades(){
  if(!wcGradeStudent)return;
  const {data,error}=await db.from('wordclass_grades').select('*').eq('student_id',wcGradeStudent.id).order('created_at',{ascending:false});
  if(error)return msg('Nie udało się pobrać ocen: '+error.message);
  const list=$('gradeListAdmin');list.replaceChildren();
  const nums=(data||[]).map(g=>Number(g.grade)).filter(n=>Number.isFinite(n) && n>=1 && n<=6);
  $('gradeAverageAdmin').textContent='Średnia: '+(nums.length?(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2):'brak ocen');
  (data||[]).forEach(g=>{
    const row=wcEl('div');row.style.margin='8px 0';
    row.append(wcEl('span',g.grade+' — '+g.category+' '));
    const edit=wcEl('button','Zmień');edit.onclick=async()=>{
      const value=prompt('Nowa ocena (1–6):',g.grade);
      if(value===null)return;
      if(!/^[1-6]$/.test(value))return notice('Podaj ocenę od 1 do 6.');
      const {error}=await db.from('wordclass_grades').update({grade:value,grade_value:Number(value)}).eq('id',g.id);
      if(error)return notice('Nie udało się poprawić: '+error.message);
      wcRefreshGrades();
    };row.append(edit);list.append(row);
  });
}
const gradeSelect=$('gradeValue');
if(gradeSelect&&!gradeSelect.options.length){
  for(let i=1;i<=6;i++){const option=wcEl('option',i);option.value=String(i);gradeSelect.append(option);}
}
$('addGrade').onclick=async()=>{
  if(!wcGradeStudent)return notice('Najpierw wybierz ucznia.');
  const {error}=await db.from('wordclass_grades').insert({student_id:wcGradeStudent.id,grade:$('gradeValue').value,category:$('gradeType').value,grade_value:Number($('gradeValue').value),grade_type:$('gradeType').value,source:'admin'});
  if(error)return notice('Nie udało się dodać oceny: '+error.message);
  wcRefreshGrades();
};
$('closeGrades').onclick=()=>$('gradeEditor').classList.add('hidden');
async function wcLoadOwnGrades(){
  if(!user||user.admin)return;
  const {data,error}=await db.from('wordclass_grades').select('*').eq('student_id',user.id).order('created_at',{ascending:false});
  if(error)return msg('Nie udało się pobrać ocen: '+error.message);
  const list=$('studentGradeList');list.replaceChildren();
  (data||[]).forEach(g=>list.append(wcEl('p',g.grade+' — '+g.category)));
  if(!data?.length)list.textContent='Nie masz jeszcze ocen.';
  $('studentAverage').textContent='Średnia wymaga zatwierdzenia przez administratora.';
}
function wcShowResetInfo(){
  $('resetRequests').textContent='Bezpieczne resetowanie haseł wymaga funkcji serwerowej Supabase. Nie jest jeszcze uruchomione.';
}
$('showResetRequest').onclick=()=>$('resetRequestForm').classList.toggle('hidden');
$('showResetCode').onclick=()=>$('resetCodeForm').classList.toggle('hidden');
$('sendResetRequest').onclick=()=>notice('Reset haseł wymaga dodatkowej funkcji serwerowej Supabase.');
$('redeemResetCode').onclick=()=>notice('Reset haseł wymaga dodatkowej funkcji serwerowej Supabase.');
$('requestAverage').onclick=()=>notice('Akceptacja średniej wymaga dodatkowej tabeli i uprawnień Supabase.');
// Bezpieczne usuwanie kont: Edge Function usuwa jedno konto na wywołanie.
// Nazwa widoczna w panelu Supabase może różnić się od faktycznego sluga URL.
const wcDeleteFunctionUrl = 'https://mqjnjzuhrmspcspkvjvl.supabase.co/functions/v1/super-processor';
$('deleteAllAccounts').onclick = async () => {
  if (!user?.admin) return notice('Zaloguj się jako administrator.');
  const { data: students, error: listError } = await db
    .from('wordclass_profiles')
    .select('id,login')
    .eq('role', 'student');
  if (listError) return notice('Nie udało się sprawdzić uczniów: ' + listError.message);
  if (!students?.length) return notice('Nie ma kont uczniów do usunięcia.');

  const confirmation = prompt(
    'UWAGA! Usuniesz trwale ' + students.length + ' kont uczniów, ich hasła i oceny.\n' +
    'Klasy pozostaną bez zmian.\n\nAby potwierdzić, wpisz dokładnie: USUN'
  );
  if (confirmation !== 'USUN') return;

  const button = $('deleteAllAccounts');
  button.disabled = true;
  const previousText = button.textContent;
  let removed = 0;
  try {
    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (sessionError || !token) throw new Error('Sesja wygasła. Zaloguj się ponownie.');

    for (const student of students) {
      button.textContent = 'Usuwanie uczniów: ' + removed + '/' + students.length;
      const response = await fetch(wcDeleteFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'sb_publishable_lT_I31LEre8X0h3H5hAWtw_54mud94_',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ student_id: student.id })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) {
        throw new Error('Uczeń ' + (student.login || student.id) + ': ' +
          (result.error || 'Błąd serwera HTTP ' + response.status));
      }
      removed++;
    }
    notice('Usunięto ' + removed + ' kont uczniów. Klasy nie zostały usunięte.');
  } catch (error) {
    notice('Usunięto ' + removed + ' z ' + students.length + ' kont. ' +
      'Przerwano usuwanie: ' + error.message + '. Sprawdź dane przed ponowną próbą.');
  } finally {
    button.disabled = false;
    button.textContent = previousText;
    await wcLoadStudents();
  }
};
$('finishSetup').onclick=async()=>{
  if(!user||user.admin)return;
  const name=[$('firstName').value.trim(),$('lastName').value.trim()].filter(Boolean).join(' ');
  const password=$('newPassword').value;
  if(!name||password.length<6||password.length>10)return notice('Podaj imię, nazwisko i hasło od 6 do 10 znaków.');
  const {error}=await db.auth.updateUser({password});
  if(error)return notice('Nie udało się zmienić hasła: '+error.message);
  const result=await db.from('wordclass_profiles').update({full_name:name}).eq('id',user.id);
  if(result.error)return notice('Hasło zmienione, ale nie zapisano nazwiska: '+result.error.message);
  user.full_name=name;show('student');wcStudentDashboard();
};

// WORDCLASS — kolorowy generator różnych typów zadań do druku.
// Publikacja online nadal używa dotychczasowego, zgodnego z Supabase formatu.
let wcTeacherGenerated = [];
const wcTaskTypes = [
  {id:'closed',name:'Zamknięte ABCD',icon:'🔵',color:'#3159d8',bg:'#eaf0ff',desc:'Wybierz poprawną odpowiedź'},
  {id:'open',name:'Otwarte',icon:'🟣',color:'#8545ce',bg:'#f2eaff',desc:'Wpisz tłumaczenie'},
  {id:'matching',name:'Łączenie w pary',icon:'🟢',color:'#087e72',bg:'#e2f7f1',desc:'Dopasuj wyrazy'},
  {id:'numbers',name:'Liczby i literki',icon:'🟠',color:'#b9660e',bg:'#fff0dc',desc:'Połącz 1–C, 2–A'},
  {id:'gaps',name:'Uzupełnij luki',icon:'🌸',color:'#b93570',bg:'#ffeaf2',desc:'Wpisz brakujące słowo'},
  {id:'truefalse',name:'Prawda / Fałsz',icon:'🟩',color:'#327d35',bg:'#e7f6e7',desc:'Oceń poprawność pary'}
];
const wcChosenTasks = new Set(['closed','open','matching','numbers']);
const wcCounts={closed:1,open:1,matching:1,numbers:1};
const wcSequence=()=>wcTaskTypes.flatMap(t=>Array(wcCounts[t.id]||0).fill(t.id));
let wcGenerateGroups;
function wcTeacherShuffle(items) {
  const result = [...items];
  for (let i=result.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
function wcBuildTaskTiles(){
  const target=$('teacherMakeTests');
  if(!target || $('wcTaskTiles'))return;
  const wrap=wcEl('div');wrap.id='wcTaskTiles';
  wrap.style.cssText='margin:20px 0;padding:20px;border:1px solid #e5e7ef;border-radius:20px;background:#fafaff;box-shadow:0 8px 28px rgba(45,39,95,.07)';
  const title=wcEl('h3','🎨 Wybierz rodzaje zadań');title.style.margin='0 0 5px';wrap.append(title);
  const intro=wcEl('p','Kliknij kolorowe kafelki. Możesz zaznaczyć kilka typów do jednego testu A–G.');intro.style.margin='0 0 16px';wrap.append(intro);
  const grid=wcEl('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px';
  wcTaskTypes.forEach(t=>{
    const tile=wcEl('button');tile.type='button';tile.dataset.type=t.id;
    tile.style.cssText='display:flex;flex-direction:column;gap:7px;align-items:flex-start;text-align:left;min-height:120px;padding:16px;border-radius:16px;cursor:pointer;transition:transform .15s,box-shadow .15s;white-space:normal';
    const heading=wcEl('strong',t.icon+' '+t.name);heading.style.fontSize='16px';
    const desc=wcEl('span',t.desc);desc.style.cssText='font-size:13px;opacity:.83';
    const mark=wcEl('span');mark.style.cssText='font-size:13px;font-weight:700';
    tile.append(heading,desc,mark);
    const paint=()=>{const on=wcChosenTasks.has(t.id);tile.style.background=t.bg;tile.style.color=t.color;tile.style.border=on?'3px solid '+t.color:'2px solid #dfe2eb';tile.style.boxShadow=on?'0 5px 16px rgba(30,30,60,.12)':'none';tile.setAttribute('aria-pressed',String(on));mark.textContent=on?'✓ ZAZNACZONE':'○ Wybierz';};
    tile.onclick=()=>{wcChosenTasks.has(t.id)?wcChosenTasks.delete(t.id):wcChosenTasks.add(t.id);paint();counter.textContent='Wybrano: '+wcChosenTasks.size+' z 6';};
    paint();grid.append(tile);
  });
  wrap.append(grid);
  const counter=wcEl('p','Wybrano: '+wcChosenTasks.size+' z 6');counter.style.cssText='font-weight:700;margin:14px 0 4px';wrap.append(counter);
  const note=wcEl('p','🖨️ Wybrane typy działają w wydruku/PDF. 💻 Publikowanie online na razie korzysta z dotychczasowego formatu — nowe typy wymagają osobnej aktualizacji Supabase.');note.style.cssText='font-size:13px;color:#57566b;margin:6px 0 0';wrap.append(note);
  target.before(wrap);
}
wcBuildTaskTiles();
function wcMakeTask(type,pair,pairs,direction){
  const reverse=direction==='plen'||(direction==='mixed'&&Math.random()<.5);
  const question=reverse?pair[1]:pair[0],answer=reverse?pair[0]:pair[1];
  if(type==='closed'){
    const alternatives=[...new Set(pairs.map(p=>reverse?p[0]:p[1]).filter(v=>v!==answer))];
    if(alternatives.length<3)throw Error('ABCD wymaga co najmniej 4 różnych tłumaczeń.');
    return {type,question,answer,choices:wcTeacherShuffle([answer,...wcTeacherShuffle(alternatives).slice(0,3)])};
  }
  if(type==='truefalse'){
    const others=pairs.map(p=>reverse?p[0]:p[1]).filter(v=>v!==answer);
    const correct=Math.random()<.5||!others.length;
    return {type,question,shown:correct?answer:wcTeacherShuffle(others)[0],answer:correct?'Prawda':'Fałsz'};
  }
  if(type==='gaps')return {type,question,answer};
  return {type,question,answer};
}
function wcMakeMatching(type,pairs,direction){
  const reverse=direction==='plen'||(direction==='mixed'&&Math.random()<.5);
  const picked=wcTeacherShuffle(pairs).slice(0,Math.min(4,pairs.length));
  const left=picked.map(p=>reverse?p[1]:p[0]);
  const right=wcTeacherShuffle(picked.map(p=>reverse?p[0]:p[1]));
  return {type,left,right,answers:left.map(x=>right.indexOf((picked.find(p=>(reverse?p[1]:p[0])===x)||[])[reverse?0:1])+1)};
}
function wcTeacherParse(){
  const lines=$('teacherTestWords').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const pairs=lines.map(line=>line.split(/\s+-\s+/).map(x=>x.trim()));
  if(!pairs.length||pairs.length>100||pairs.some(p=>p.length!==2||!p.every(Boolean)))throw Error('Wpisz 1–100 par, np. apple - jabłko.');
  return pairs;
}
// Papierowe arkusze: edytowalne polecenia i punkty, układ dopasowań w dwóch kolumnach.
const wcPaperKinds = ['Kartkówka','Sprawdzian','Test','Egzamin'];
const wcDefaultInstructions = {
  closed:'Wybierz poprawne tłumaczenie.',open:'Przetłumacz podane słowo.',
  matching:'Połącz w pary.',numbers:'Dopasuj liczby do liter.',
  gaps:'Uzupełnij brakujące tłumaczenie.',truefalse:'Zaznacz Prawda lub Fałsz.'
};
function wcSetupPaperOptions(){
  const target=$('wcTaskTiles');
  if(!target || $('wcPaperKind'))return;
  const row=wcEl('div');row.style.cssText='margin:14px 0;padding:16px;border:1px solid #e0dff0;border-radius:14px;background:#f7f6ff';
  const label=wcEl('label','📄 Rodzaj pracy do druku');label.style.cssText='display:block;font-weight:700;margin-bottom:7px';
  const select=wcEl('select');select.id='wcPaperKind';
  wcPaperKinds.forEach(name=>{const option=wcEl('option',name);option.value=name;select.append(option);});
  row.append(label,select,wcEl('p','Po wygenerowaniu możesz edytować polecenia i punktację każdego zadania osobno. Domyślnie 1 punkt za poprawną odpowiedź.'));
  target.before(row);
}
wcSetupPaperOptions();
function wcPaperPoints(q){return (q.type==='matching'||q.type==='numbers')?q.left.length:1;}
function wcPaperTotal(test){return test.questions.reduce((sum,q)=>sum+Number(q.points||0),0);}
function wcTaskAnswer(q){
  if(q.type==='matching'||q.type==='numbers')return q.answers.map((x,i)=>(i+1)+'–'+String.fromCharCode(64+x)).join(', ');
  if(q.type==='closed')return String.fromCharCode(65+q.choices.indexOf(q.answer))+') '+q.answer;
  return q.answer;
}
function wcPaperTask(q,index){
  const wrap=wcEl('div');wrap.className='wc-paper-task';
  wrap.style.cssText='margin:17px 0 22px;break-inside:avoid;page-break-inside:avoid;';
  const heading=wcEl('div');heading.style.cssText='display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:9px';
  const title=wcEl('strong','Zadanie '+(index+1)+'. '+(q.instruction||wcDefaultInstructions[q.type]));
  title.style.cssText='font-size:14px;white-space:pre-wrap';
  const points=wcEl('strong',q.points+'p/');points.style.cssText='font-size:14px;white-space:nowrap';
  heading.append(title,points);wrap.append(heading);
  if(q.type==='matching'||q.type==='numbers'){
    const grid=wcEl('div');grid.className='wc-paper-matching';
    grid.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:24px;max-width:580px';
    const left=wcEl('div'),right=wcEl('div');
    q.left.forEach((x,i)=>{const line=wcEl('div',(i+1)+'. '+x+'   ______');line.style.cssText='margin:0 0 9px;overflow-wrap:anywhere';left.append(line);});
    q.right.forEach((x,i)=>{const line=wcEl('div',String.fromCharCode(65+i)+'. '+x);line.style.cssText='margin:0 0 9px;overflow-wrap:anywhere';right.append(line);});
    grid.append(left,right);wrap.append(grid);
  }else if(q.type==='closed'){
    wrap.append(wcEl('div',q.question));
    const choices=wcEl('div');choices.style.cssText='display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:8px';
    q.choices.forEach((x,i)=>choices.append(wcEl('span',String.fromCharCode(65+i)+') '+x)));
    wrap.append(choices);
  }else if(q.type==='truefalse'){
    wrap.append(wcEl('div',q.question+' — '+q.shown+'     ☐ Prawda     ☐ Fałsz'));
  }else{
    wrap.append(wcEl('div',q.question+'   ______________________________'));
  }
  return wrap;
}
function wcPaperSheet(test,printMode){
  const section=wcEl('section');section.className='wc-paper-sheet';
  section.style.cssText=printMode?'break-after:page;page-break-after:always':'margin:18px 0;padding:20px;border:1px solid #dcddea;border-radius:12px;background:white;color:#202537';
  const heading=wcEl('h2',test.kind+' — '+test.title+' — Grupa '+test.group);
  heading.style.cssText='font-size:18px;margin:0 0 12px;color:#27233c';
  section.append(heading,wcEl('p','Imię i nazwisko: ______________________________    Klasa: __________'));
  const total=wcEl('p','Maksymalna liczba punktów: '+wcPaperTotal(test)+'p/     Uzyskane: ______p/');
  total.style.cssText='font-weight:700;margin:12px 0 20px';section.append(total);
  test.questions.forEach((q,i)=>section.append(wcPaperTask(q,i)));
  return section;
}
function wcRenderPaperPreview(){
  const preview=$('teacherTestPreview');preview.replaceChildren();
  wcTeacherGenerated.forEach(test=>{
    const section=wcPaperSheet(test,false);
    const editor=wcEl('div');editor.style.cssText='border-top:1px solid #e0dff0;margin-top:16px;padding-top:14px';
    const heading=wcEl('strong','✏️ Edytuj polecenia i punktację — grupa '+test.group);
    editor.append(heading);
    test.questions.forEach((q,i)=>{
      const row=wcEl('div');row.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) 100px;gap:10px;align-items:end;margin:10px 0';
      const textLabel=wcEl('label','Zadanie '+(i+1)+' — polecenie');
      const input=wcEl('textarea');input.rows=2;input.value=q.instruction;input.style.cssText='width:100%;box-sizing:border-box';
      input.oninput=()=>{q.instruction=input.value;wcRefreshPaperSheet(section,test);};
      textLabel.append(input);
      const pointLabel=wcEl('label','Punkty');
      const number=wcEl('input');number.type='number';number.min='0';number.max='100';number.step='1';number.value=q.points;
      number.style.cssText='width:100%;box-sizing:border-box';
      number.onchange=()=>{const value=Number(number.value);q.points=Number.isInteger(value)&&value>=0&&value<=100?value:wcPaperPoints(q);number.value=q.points;wcRefreshPaperSheet(section,test);};
      pointLabel.append(number);row.append(textLabel,pointLabel);editor.append(row);
    });
    section.append(editor);preview.append(section);
  });
}
function wcRefreshPaperSheet(section,test){
  const fresh=wcPaperSheet(test,false);
  const editor=section.lastElementChild;
  section.replaceChildren(...Array.from(fresh.children),editor);
}
$('teacherMakeTests').onclick=()=>{
  if(!user?.admin)return notice('Zaloguj się jako administrator.');
  try{
    const pairs=wcTeacherParse();
    const count=Number($('teacherTestCount').value);
    if(!Number.isInteger(count)||count<1||count>50||count>pairs.length)throw Error('Liczba zadań musi wynosić 1–50 i nie może przekraczać liczby słówek.');
    if(!wcChosenTasks.size)throw Error('Zaznacz przynajmniej jeden kolorowy kafelek.');
    const types=[...wcChosenTasks],direction=$('teacherTestDirection').value;
    const title=$('teacherTestTitle').value.trim()||'Test ze słówek';
    const kind=$('wcPaperKind')?.value||'Test';
    wcTeacherGenerated=[...'ABCDEFG'].map(group=>{
      const selected=wcTeacherShuffle(pairs).slice(0,count);
      const sequence=wcTeacherShuffle(Array.from({length:count},(_,i)=>types[i%types.length]));
      const questions=selected.map((pair,i)=>{
        const q=['matching','numbers'].includes(sequence[i])?wcMakeMatching(sequence[i],pairs,direction):wcMakeTask(sequence[i],pair,pairs,direction);
        q.instruction=wcDefaultInstructions[q.type];q.points=wcPaperPoints(q);return q;
      });
      return {group,title,kind,questions};
    });
    wcRenderPaperPreview();
    $('teacherPrintTests').disabled=false;
    $('teacherTestStatus').textContent='✅ Gotowe: 7 grup A–G. Edytuj polecenia i punkty, a potem kliknij Drukuj / PDF.';
  }catch(e){$('teacherTestStatus').textContent='❌ '+e.message;}
};
$('teacherPrintTests').onclick=()=>{
  if(!user?.admin||!wcTeacherGenerated.length)return;
  const popup=window.open('','_blank');if(!popup)return notice('Zezwól na wyskakujące okna.');
  const doc=popup.document;doc.title='WordClass — arkusze A–G';
  const style=doc.createElement('style');
  style.textContent='@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;color:#202537;font-size:12px}section.wc-paper-sheet{break-after:page;page-break-after:always}section.wc-paper-sheet:last-of-type{break-after:page}h2{font-size:18px}p{margin:12px 0}button{padding:12px 20px;background:#5645c7;color:white;border:0;border-radius:8px;margin-bottom:18px}.wc-paper-task{break-inside:avoid;page-break-inside:avoid}@media print{button{display:none}}';
  doc.head.append(style);
  const button=wcEl('button','🖨️ Drukuj / zapisz jako PDF');button.onclick=()=>popup.print();doc.body.append(button);
  wcTeacherGenerated.forEach(test=>doc.body.append(wcPaperSheet(test,true)));
  const key=wcEl('section');key.append(wcEl('h2','Klucz odpowiedzi — tylko dla nauczyciela'));
  wcTeacherGenerated.forEach(test=>{
    key.append(wcEl('h3','Grupa '+test.group+' — razem '+wcPaperTotal(test)+'p/'));
    test.questions.forEach((q,i)=>key.append(wcEl('p','Zadanie '+(i+1)+' ('+q.points+'p/): '+wcTaskAnswer(q))));
  });
  doc.body.append(key);
};

// ===== WordClass: drukowanie / usuwanie podglądu =====
(function wcAddDeletePreview() {
  const print = $('teacherPrintTests');
  if (!print || $('teacherClearTests')) return;
  const button = document.createElement('button');
  button.id = 'teacherClearTests'; button.type = 'button'; button.className = 'danger';
  button.textContent = '🗑️ Usuń testy';
  print.after(button);
  button.onclick = () => {
    if (!user?.admin || !confirm('Usunąć wygenerowane grupy A–G z podglądu?')) return;
    wcTeacherGenerated = [];
    $('teacherTestPreview').replaceChildren();
    $('teacherPrintTests').disabled = true;
    $('teacherTestStatus').textContent = 'Usunięto testy z podglądu. Słówka pozostały.';
  };
})();

// Bezplatne definicje A1-A2. Wszystko dziala lokalnie, bez API i bez karty.
const wcFreeGuessDictionary = {
  "apple": "It is a fruit. It can be red or green.",
  "banana": "It is a long yellow fruit.",
  "orange": "It is a round fruit and also a colour.",
  "pear": "It is a sweet fruit with a wide bottom and a narrow top.",
  "lemon": "It is a yellow fruit with a sour taste.",
  "strawberry": "It is a small red fruit with tiny seeds on the outside.",
  "grape": "It is a small round fruit that grows in groups.",
  "watermelon": "It is a large green fruit with red flesh inside.",
  "fruit": "It is something sweet that grows on a tree or plant and you can eat it.",
  "vegetable": "It is a plant or part of a plant that people eat, often with a meal.",
  "potato": "It is a vegetable that grows under the ground. People make chips from it.",
  "tomato": "It is a red fruit often used in salads and sauces.",
  "carrot": "It is a long orange vegetable that grows under the ground.",
  "onion": "It is a vegetable that can make your eyes water when you cut it.",
  "bread": "It is food made from flour. You can make sandwiches with it.",
  "cheese": "It is food made from milk. You can put it on pizza.",
  "milk": "It is a white drink that comes from cows.",
  "water": "It is a clear drink that people need every day.",
  "juice": "It is a drink made from fruit or vegetables.",
  "tea": "It is a hot drink made with leaves and water.",
  "coffee": "It is a dark drink that many adults have in the morning.",
  "egg": "It has a shell and comes from a chicken. You can cook it for breakfast.",
  "rice": "It is a food made of small white grains.",
  "pasta": "It is an Italian food made from flour and water, such as spaghetti.",
  "pizza": "It is a round Italian food with cheese and tomato sauce.",
  "soup": "It is a liquid food that you eat with a spoon.",
  "cake": "It is a sweet food that people often eat on birthdays.",
  "chocolate": "It is a sweet brown food made from cocoa.",
  "sugar": "It is sweet and people put it in tea or cakes.",
  "salt": "It is white and makes food taste less plain.",
  "breakfast": "It is the first meal of the day.",
  "lunch": "It is a meal people eat in the middle of the day.",
  "dinner": "It is a meal people often eat in the evening.",
  "dog": "It is an animal that can bark and is often a pet.",
  "cat": "It is a pet that says meow and likes to sleep.",
  "bird": "It is an animal with feathers and wings.",
  "fish": "It is an animal that lives in water and has fins.",
  "horse": "It is a large animal that people can ride.",
  "cow": "It is a farm animal that gives milk.",
  "pig": "It is a farm animal with a pink body and a short nose.",
  "sheep": "It is a farm animal with thick wool.",
  "chicken": "It is a farm bird that lays eggs.",
  "duck": "It is a bird that swims and says quack.",
  "rabbit": "It is a small animal with long ears.",
  "mouse": "It is a small animal with a long tail. Cats often chase it.",
  "lion": "It is a large wild cat with a loud roar.",
  "tiger": "It is a large wild cat with orange fur and black stripes.",
  "elephant": "It is a very large animal with a long trunk.",
  "monkey": "It is an animal that can climb trees and has a long tail.",
  "bear": "It is a large wild animal with thick fur.",
  "snake": "It is a long animal with no legs.",
  "frog": "It is a small animal that jumps and lives near water.",
  "butterfly": "It is an insect with large colourful wings.",
  "bee": "It is a small flying insect that makes honey.",
  "spider": "It is a small animal with eight legs.",
  "animal": "It is a living thing such as a dog, cat or bird.",
  "pen": "You use it to write with ink on paper.",
  "pencil": "You use it to write or draw, and you can erase its marks.",
  "book": "It has pages and you read it.",
  "notebook": "It is a book with empty pages for writing notes.",
  "ruler": "You use it to measure length and draw straight lines.",
  "eraser": "You use it to remove pencil marks.",
  "bag": "You put things inside it and carry it.",
  "backpack": "It is a bag that you carry on your back.",
  "desk": "It is a piece of furniture where you can write or study.",
  "chair": "It is furniture that one person sits on.",
  "table": "It has a flat top and legs. You can eat or work at it.",
  "board": "A teacher writes on it in a classroom.",
  "school": "It is a place where children go to learn.",
  "classroom": "It is a room where students have lessons.",
  "teacher": "This person helps students learn at school.",
  "student": "This person learns at school or university.",
  "pupil": "This is a child who goes to school.",
  "lesson": "It is a period of time when a teacher teaches students.",
  "homework": "It is schoolwork that students do at home.",
  "exam": "It is an important test of what you know.",
  "test": "It is a set of questions to check what you know.",
  "question": "It is something you ask when you want an answer.",
  "answer": "It is what you say or write in reply to a question.",
  "computer": "It is an electronic machine you use to work, study or play games.",
  "laptop": "It is a small computer that you can carry.",
  "phone": "You use it to call or send messages to people.",
  "television": "You watch programmes and films on it.",
  "radio": "You listen to music or news on it.",
  "keyboard": "It has keys that you press to type on a computer.",
  "screen": "It is the part of a computer or phone where you see pictures and words.",
  "window": "It is made of glass and lets light into a room.",
  "door": "You open it to enter or leave a room.",
  "wall": "It is a vertical part of a building that separates rooms.",
  "floor": "It is the part of a room that you walk on.",
  "roof": "It is the top part of a house that keeps rain out.",
  "house": "It is a building where people live.",
  "home": "It is the place where you live.",
  "room": "It is a part of a building with walls and a door.",
  "kitchen": "It is the room where people cook food.",
  "bathroom": "It is the room where people wash or take a shower.",
  "bedroom": "It is the room where you sleep.",
  "living room": "It is the room where a family relaxes and watches TV.",
  "bed": "It is furniture that you sleep in.",
  "sofa": "It is a long comfortable seat for two or more people.",
  "lamp": "It gives light when a room is dark.",
  "clock": "It tells you the time.",
  "watch": "It means to look at something for a period of time.",
  "mirror": "You look into it to see your face.",
  "fridge": "It is a machine that keeps food cold.",
  "oven": "It is a machine that cooks food using heat.",
  "spoon": "You use it to eat soup.",
  "fork": "You use it to pick up food when eating.",
  "knife": "You use it to cut food.",
  "plate": "You put food on it when you eat.",
  "cup": "It is a small container for drinking tea or coffee.",
  "glass": "It is a container you drink water or juice from.",
  "bottle": "It is a container for liquids with a narrow top.",
  "shirt": "It is clothing you wear on the upper part of your body.",
  "t-shirt": "It is a casual top with short sleeves.",
  "trousers": "You wear them on your legs. They have two long parts.",
  "jeans": "They are trousers usually made from blue denim.",
  "dress": "It is a piece of clothing that covers the body and hangs down over the legs.",
  "skirt": "It is clothing that hangs from the waist and does not cover each leg separately.",
  "shoes": "You wear them on your feet when you go outside.",
  "socks": "You wear them on your feet inside shoes.",
  "jacket": "It is clothing you wear over your top when it is cool outside.",
  "coat": "It is warm clothing you wear over other clothes in cold weather.",
  "hat": "You wear it on your head.",
  "gloves": "You wear them on your hands to keep them warm.",
  "scarf": "You wear it around your neck when it is cold.",
  "red": "It is the colour of many tomatoes.",
  "blue": "It is the colour of a clear sky.",
  "green": "It is the colour of grass.",
  "yellow": "It is the colour of a banana.",
  "black": "It is the darkest colour.",
  "white": "It is the colour of fresh snow.",
  "pink": "It is a light red colour.",
  "purple": "It is a colour made by mixing red and blue.",
  "brown": "It is the colour of chocolate.",
  "grey": "It is a colour between black and white.",
  "big": "It means large in size.",
  "small": "It means little in size.",
  "tall": "It means having a great height.",
  "short": "It means not tall or not long.",
  "long": "It means having a lot of length.",
  "fast": "It means moving quickly.",
  "slow": "It means not moving quickly.",
  "happy": "It is how you feel when something good happens.",
  "sad": "It is how you feel when you are unhappy.",
  "angry": "It is how you feel when you are very upset about something.",
  "tired": "It is how you feel when you need to rest or sleep.",
  "hungry": "It is how you feel when you want to eat.",
  "thirsty": "It is how you feel when you want to drink.",
  "cold": "It means having a low temperature.",
  "hot": "It means having a high temperature.",
  "sunny": "It describes weather when the sun is shining.",
  "rainy": "It describes weather with a lot of rain.",
  "windy": "It describes weather when the wind is strong.",
  "snowy": "It describes weather with snow.",
  "cloudy": "It describes weather when many clouds cover the sky.",
  "sun": "It is the bright star that gives Earth light and heat.",
  "moon": "You can often see it in the sky at night.",
  "star": "It is a small bright point of light in the night sky.",
  "sky": "It is the space above the Earth that you see when you look up.",
  "river": "It is a long natural flow of water.",
  "lake": "It is a large area of water surrounded by land.",
  "sea": "It is a very large area of salt water.",
  "beach": "It is a sandy place next to the sea.",
  "mountain": "It is a very high area of land.",
  "forest": "It is a large area with many trees.",
  "tree": "It is a tall plant with a trunk and branches.",
  "flower": "It is the colourful part of a plant.",
  "grass": "It is a short green plant that covers the ground.",
  "park": "It is a public green place where people walk or play.",
  "city": "It is a large place where many people live and work.",
  "town": "It is a place with houses and shops, smaller than a city.",
  "village": "It is a small place where people live in the countryside.",
  "street": "It is a road in a town or city with buildings along it.",
  "road": "Cars and buses travel along it.",
  "car": "It is a vehicle with four wheels that people drive.",
  "bus": "It is a large road vehicle that carries many passengers.",
  "train": "It is a vehicle that travels on railway tracks.",
  "plane": "It is a vehicle that flies and carries passengers.",
  "bicycle": "It is a vehicle with two wheels that you ride by pedalling.",
  "bike": "It is a vehicle with two wheels that you ride by pedalling.",
  "boat": "It is a small vehicle that travels on water.",
  "ship": "It is a large vehicle that travels on water.",
  "airport": "It is a place where planes take off and land.",
  "station": "It is a place where trains or buses stop for passengers.",
  "hospital": "It is a place where doctors and nurses care for sick people.",
  "doctor": "This person helps people when they are ill.",
  "nurse": "This person cares for people who are sick or hurt.",
  "police officer": "This person helps keep people safe and follows the law.",
  "firefighter": "This person puts out fires and rescues people.",
  "shop": "It is a place where you buy things.",
  "supermarket": "It is a large shop where you buy food and everyday things.",
  "restaurant": "It is a place where you pay to eat a meal.",
  "cinema": "It is a place where you watch films on a big screen.",
  "library": "It is a place where you can borrow or read books.",
  "museum": "It is a place where you see old or interesting objects.",
  "football": "It is a sport where players kick a ball to score goals.",
  "basketball": "It is a sport where players throw a ball into a high basket.",
  "tennis": "It is a sport where players hit a ball over a net with rackets.",
  "swimming": "It is the activity of moving through water using your body.",
  "running": "It is the activity of moving quickly on foot.",
  "dancing": "It is moving your body to music.",
  "singing": "It is making music with your voice.",
  "reading": "It is looking at written words and understanding them.",
  "writing": "It is making letters or words on paper or a screen.",
  "drawing": "It is making pictures with a pencil or pen.",
  "music": "It is sound made by instruments or voices that people enjoy.",
  "song": "It is a piece of music with words that people sing.",
  "film": "It is a story shown as moving pictures on a screen.",
  "movie": "It is a story shown as moving pictures on a screen.",
  "game": "It is an activity you play for fun, often with rules.",
  "friend": "It is a person you like and enjoy spending time with.",
  "family": "It is a group of people related to each other.",
  "mother": "She is a female parent.",
  "father": "He is a male parent.",
  "sister": "She is a female sibling.",
  "brother": "He is a male sibling.",
  "grandmother": "She is the mother of one of your parents.",
  "grandfather": "He is the father of one of your parents.",
  "child": "It is a young person who is not an adult.",
  "baby": "It is a very young child.",
  "people": "It is the plural word for person.",
  "morning": "It is the early part of the day, before midday.",
  "afternoon": "It is the part of the day after midday and before evening.",
  "evening": "It is the part of the day after afternoon and before night.",
  "night": "It is the dark part of the day when most people sleep.",
  "today": "It means this day.",
  "tomorrow": "It means the day after today.",
  "yesterday": "It means the day before today.",
  "week": "It is a period of seven days.",
  "month": "It is one of the twelve parts of a year.",
  "year": "It is a period of twelve months.",
  "monday": "It is the first day of the working week.",
  "tuesday": "It is the day after Monday.",
  "wednesday": "It is the day between Tuesday and Thursday.",
  "thursday": "It is the day before Friday.",
  "friday": "It is the day before Saturday.",
  "saturday": "It is the day after Friday.",
  "sunday": "It is the day before Monday.",
  "run": "It means to move quickly using your legs.",
  "walk": "It means to move on foot without running.",
  "jump": "It means to push yourself off the ground into the air.",
  "swim": "It means to move through water using your arms and legs.",
  "eat": "It means to put food into your mouth and swallow it.",
  "drink": "It means to take liquid into your mouth and swallow it.",
  "sleep": "It means to rest with your eyes closed, usually at night.",
  "read": "It means to look at words and understand them.",
  "write": "It means to make words using a pen, pencil or keyboard.",
  "listen": "It means to pay attention to sounds.",
  "speak": "It means to say words with your voice.",
  "talk": "It means to speak to someone.",
  "play": "It means to do something for fun or take part in a game.",
  "work": "It means to do a job or task.",
  "study": "It means to spend time learning something.",
  "learn": "It means to get knowledge or a new skill.",
  "teach": "It means to help someone learn something.",
  "help": "It means to make something easier for another person.",
  "buy": "It means to get something by paying money.",
  "sell": "It means to give something to someone in exchange for money.",
  "open": "It means to move a door or container so you can go in or see inside.",
  "close": "It means to shut something.",
  "start": "It means to begin doing something.",
  "finish": "It means to complete something.",
  "like": "It means to enjoy something or think it is good.",
  "love": "It means to feel very strong affection for someone or something.",
  "hate": "It means to dislike something very much.",
  "need": "It means to have to have something.",
  "want": "It means to wish to have or do something.",
  "know": "It means to have information in your mind.",
  "think": "It means to use your mind to form ideas.",
  "see": "It means to notice something with your eyes.",
  "look": "It means to turn your eyes towards something.",
  "hear": "It means to notice a sound with your ears.",
  "find": "It means to discover where something is.",
  "lose": "It means to stop having something because you cannot find it.",
  "give": "It means to let someone have something.",
  "take": "It means to move something into your hand or carry it away.",
  "make": "It means to create or produce something.",
  "do": "It means to perform an action or activity.",
  "go": "It means to move from one place to another.",
  "come": "It means to move towards the person who is speaking.",
  "get": "It means to receive or obtain something.",
  "have": "It means to own or possess something.",
  "be": "It means to exist or have a particular state.",
  "can": "It means to be able to do something."
};
async function wcGuessDefinitions(words){
  // Definicje tworzy Gemini przez bezpieczną funkcję Supabase.
  // Nigdy nie prosimy nauczyciela o ręczne wpisywanie definicji.
  const {data, error: sessionError}=await db.auth.getSession();
  const token=data?.session?.access_token;
  if(sessionError || !token)throw Error('Zaloguj się ponownie jako administrator.');
  const response=await fetch('https://mqjnjzuhrmspcspkvjvl.supabase.co/functions/v1/wordclass-ai-definitions',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':'Bearer '+token,
      'apikey':'sb_publishable_lT_I31LEre8X0h3H5hAWtw_54mud94_'
    },
    body:JSON.stringify({words})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok || result.success!==true){
    throw Error(result.error || 'Gemini nie odpowiedziało (HTTP '+response.status+').');
  }
  if(!result.definitions || typeof result.definitions!=='object' || Array.isArray(result.definitions)){
    throw Error('Gemini nie zwróciło poprawnych definicji.');
  }
  const definitions={};
  for(const word of words){
    const key=String(word).trim().toLowerCase();
    const definition=result.definitions[key];
    if(typeof definition!=='string' || !definition.trim()){
      throw Error('Gemini nie przygotowało definicji dla: '+word+'. Spróbuj ponownie.');
    }
    definitions[key]=definition.trim();
  }
  return definitions;
}

// Gemini: automatyczne zdania z lukami (ten sam bezpieczny endpoint Supabase).
async function wcGeminiSentences(items){
  const {data,error}=await db.auth.getSession();
  const token=data?.session?.access_token;
  if(error||!token)throw Error('Zaloguj się ponownie jako administrator.');
  const all=[];
  for(let start=0;start<items.length;start+=12){
    const batch=items.slice(start,start+12);
    const response=await fetch('https://mqjnjzuhrmspcspkvjvl.supabase.co/functions/v1/wordclass-ai-definitions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':'sb_publishable_lT_I31LEre8X0h3H5hAWtw_54mud94_'},
      body:JSON.stringify({mode:'sentences',items:batch})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.success!==true)throw Error(result.error||'Nie udało się wygenerować zdań (HTTP '+response.status+').');
    if(!Array.isArray(result.sentences))throw Error('Zaktualizuj funkcję wordclass-ai-definitions w Supabase: brakuje obsługi zdań.');
    for(const requested of batch){
      const entry=result.sentences.find(x=>x.id===requested.id);
      if(!entry||!Array.isArray(entry.lines)||entry.lines.length!==3)throw Error('Gemini nie przygotowało 3 zdań dla: '+requested.word);
      const lines=entry.lines.map(line=>({sentence:String(line.sentence||'').trim(),hint:String(line.hint||'').trim(),answer:String(line.answer||'').trim()}));
      if(lines.some(l=>!l.sentence.includes('____')||!l.hint||!l.answer))throw Error('Gemini zwróciło niepełne zdania dla: '+requested.word);
      all.push({id:requested.id,lines});
    }
  }
  return all;
}

// ===== WordClass: indywidualne arkusze i nowe typy zadań (tylko wydruk) =====
(function wcIndividualPaperUpgrade(){
  const extraTypes=[
    {id:'context',name:'Polskie słowo → luka EN',icon:'🟡',color:'#936100',bg:'#fff5c9',desc:'Zdanie angielskie i polska podpowiedź'},
    {id:'grammar',name:'Forma gramatyczna',icon:'🔴',color:'#a52b42',bg:'#ffe5e9',desc:'Uzupełnij poprawną formę słowa'},
    {id:'guess',name:'Zgadnij słówko 📒',icon:'🧩',color:'#176d8a',bg:'#dff6ff',desc:'Losowe zdanie z notesu — bez AI i opłat'}
  ];
  const taskGrid=Array.from($('wcTaskTiles')?.children || []).find(el => el.tagName === 'DIV' && el.style.display === 'grid');
  if(taskGrid){
    extraTypes.forEach(t=>{
      wcTaskTypes.push(t);
      const tile=wcEl('button');tile.type='button';tile.style.cssText='display:flex;flex-direction:column;align-items:flex-start;gap:7px;min-height:120px;padding:16px;border-radius:16px;white-space:normal;cursor:pointer';
      const head=wcEl('strong',t.icon+' '+t.name),sub=wcEl('small',t.desc),mark=wcEl('small');tile.append(head,sub,mark);
      const paint=()=>{const active=wcChosenTasks.has(t.id);tile.style.background=t.bg;tile.style.color=t.color;tile.style.border=(active?'3px solid '+t.color:'2px solid #dfe2eb');mark.textContent=active?'✓ ZAZNACZONE':'○ Wybierz';};
      tile.onclick=()=>{wcChosenTasks.has(t.id)?wcChosenTasks.delete(t.id):wcChosenTasks.add(t.id);paint();const counter=$('wcTaskTiles').querySelector('p[style*="font-weight"]');if(counter)counter.textContent='Wybrano: '+wcChosenTasks.size+' z '+wcTaskTypes.length;};
      paint();taskGrid.append(tile);
    });
  }
  wcDefaultInstructions.context='Wpisz angielskie słowo z polskiej podpowiedzi w poprawnej formie.';
  wcDefaultInstructions.grammar='Wpisz poprawną formę gramatyczną słowa z nawiasu.';
  wcDefaultInstructions.guess='Przeczytaj zdanie i odgadnij brakujące słowo.';
  const paperKind=$('wcPaperKind');
  const options=wcEl('section');options.id='wcIndividualOptions';options.style.cssText='margin:16px 0;padding:18px;border:1px solid #ddd;border-radius:14px;background:#f8f9ff';
  options.innerHTML='<h3>🖨️ Wybierz grupy do druku / PDF</h3><p>Nie wybierasz uczniów. Zaznacz tylko grupy, które chcesz wygenerować.</p><div id="wcPaperGroups" style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0"></div><label>Drukowanie <select id="wcPaperPrintMode"><option value="paired">Każda grupa: arkusz, potem klucz</option><option value="separate">Najpierw arkusze, potem klucze</option></select></label><p style="font-size:13px">Gemini automatycznie tworzy zdania z lukami. Możesz je poprawić w edytorze przed wydrukiem.</p>';
  paperKind?.parentElement?.after(options);
  const selectedGroups=new Set(['A']);
  const groupArea=$('wcPaperGroups');
  'ABCDEFG'.split('').forEach(g=>{
    const label=wcEl('label');label.style.cssText='display:inline-flex;align-items:center;gap:7px;padding:10px 14px;background:#fff;border:1px solid #dcddea;border-radius:10px;cursor:pointer';
    const check=wcEl('input');check.type='checkbox';check.checked=selectedGroups.has(g);
    check.onchange=()=>{if(check.checked)selectedGroups.add(g);else selectedGroups.delete(g);};
    label.append(check,wcEl('strong','Grupa '+g));groupArea.append(label);
  });
  function escapeHTML(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function createQuestion(type,pair,pairs,direction){
    let q;
    if(type==='guess'){
      q={type,question:'',answer:pair[0],instruction:wcDefaultInstructions.guess,points:1};
    }else if(type==='context'||type==='grammar'){
      q={type,question:'',answer:'',hint:type==='context'?pair[1]:pair[0],instruction:wcDefaultInstructions[type],points:3,
        lines:Array.from({length:3},(_,i)=>({sentence:'',hint:i===0?(type==='context'?pair[1]:pair[0]):'',answer:''}))};
    }else{
      q=['matching','numbers'].includes(type)?wcMakeMatching(type,pairs,direction):wcMakeTask(type,pair,pairs,direction);
      q.instruction=wcDefaultInstructions[q.type];q.points=wcPaperPoints(q);
    }
    if(q.type==='truefalse'){
      const sample=wcTeacherShuffle(pairs).slice(0,Math.min(3,pairs.length));
      q.lines=sample.map((p,i)=>{const correct=i%2===0;const other=pairs.find(x=>x[1]!==p[1]);return {sentence:p[0]+' — '+(correct||!other?p[1]:other[1]),answer:correct||!other?'Prawda':'Fałsz'};});
      q.points=q.lines.length;
    }
    return q;
  }
  function taskContent(q){
    const box=wcEl('div');
    if(q.type==='guess'){
      const sentence=String(q.question||'[Brak zdania w notesie]');
      const line=wcEl('div');line.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:5px;line-height:2;margin:12px 0';
      const blank=/(?:_\s*){2,}/.exec(sentence);
      const before=blank?sentence.slice(0,blank.index):sentence;
      const after=blank?sentence.slice(blank.index+blank[0].length):'';
      if(before)line.append(wcEl('span',before));
      const cells=wcEl('span');cells.style.cssText='display:inline-flex;flex-wrap:wrap;gap:4px;vertical-align:middle';
      const inputs=[];
      Array.from(String(q.answer||'')).forEach((ch,i)=>{
        if(ch===' '){const gap=wcEl('span');gap.style.width='12px';cells.append(gap);return;}
        const input=wcEl('input');input.type='text';input.maxLength=1;input.autocomplete='off';input.setAttribute('aria-label','Litera '+(i+1));
        input.style.cssText='width:29px;height:36px;min-width:29px;box-sizing:border-box;border:2px solid #334155;border-radius:3px;text-align:center;font-size:20px;font-weight:bold;padding:0;background:white;color:#111827';
        input.oninput=()=>{input.value=input.value.slice(-1).toUpperCase();if(input.value){const next=inputs[inputs.indexOf(input)+1];if(next)next.focus();}};
        input.onkeydown=e=>{if(e.key==='Backspace'&&!input.value){const prev=inputs[inputs.indexOf(input)-1];if(prev)prev.focus();}};
        inputs.push(input);cells.append(input);
      });
      line.append(cells);if(after)line.append(wcEl('span',after));box.append(line);
      if(inputs.length){
        const feedback=wcEl('span');feedback.style.cssText='margin-left:8px;font-weight:bold';
        const check=wcEl('button','✓ Sprawdź');check.type='button';check.className='wc-guess-check';
        check.style.cssText='font-size:12px;padding:5px 10px;margin:5px 8px 5px 0';
        check.onclick=()=>{const typed=inputs.map(el=>el.value).join('').toLocaleLowerCase('en');const correct=String(q.answer).replace(/\s/g,'').toLocaleLowerCase('en');feedback.textContent=typed===correct?'✅ Dobrze!':'❌ Spróbuj ponownie';};
        const actions=wcEl('div');actions.className='wc-guess-actions';actions.append(check,feedback);box.append(actions);
      }
    }else if(q.type==='context'||q.type==='grammar'){
      q.lines.forEach((line,i)=>{const p=wcEl('p',(i+1)+'. '+(line.sentence||'____________________________')+'  ('+(line.hint||'podpowiedź')+')');p.style.margin='9px 0';box.append(p);});
    }else if(q.type==='truefalse'&&q.lines){
      q.lines.forEach((line,i)=>{const p=wcEl('p',(i+1)+'. '+line.sentence+'      ☐ P     ☐ F');p.style.margin='9px 0';box.append(p);});
    }else if(q.type==='matching'||q.type==='numbers'){
      const grid=wcEl('div');grid.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:18px';const left=wcEl('div'),right=wcEl('div');
      q.left.forEach((x,i)=>left.append(wcEl('p',(i+1)+'. '+x+'  _____')));
      q.right.forEach((x,i)=>right.append(wcEl('p',String.fromCharCode(65+i)+'. '+x)));
      grid.append(left,right);box.append(grid);
    }else if(q.type==='closed'){
      box.append(wcEl('p',q.question));q.choices.forEach((c,i)=>box.append(wcEl('span',String.fromCharCode(65+i)+') '+c+'     ')));
    }else box.append(wcEl('p',q.question+'   __________________________'));
    return box;
  }
  function sheet(test,asKey){
    const section=wcEl('section');section.className='wc-individual-sheet';
    const h=wcEl('h2',(asKey?'KLUCZ ODPOWIEDZI — ':'')+test.kind+' — '+test.title+' — Grupa '+test.group);section.append(h);
    section.append(wcEl('p','Imię i nazwisko: __________________________    Klasa: __________'));
    section.append(wcEl('p','Razem: '+wcPaperTotal(test)+' pkt'+(asKey?'':'   |   Uzyskane: ______ pkt')));
    if(test.gradeThresholds){section.append(wcEl('p','Progi ocen: '+wcGradeText(test.gradeThresholds)));if(!asKey)section.append(wcEl('p','Wynik: ______ %   |   Ocena: ______'));}
    test.questions.forEach((q,i)=>{
      const item=wcEl('div');item.className='wc-print-task';
      const heading=wcEl('div');heading.style.cssText='display:flex;justify-content:space-between;gap:12px';
      heading.style.borderBottom='2px solid #334155';heading.style.paddingBottom='7px';heading.style.marginBottom='12px';
      heading.append(wcEl('strong','TASK '+(i+1)+' — '+q.instruction),wcEl('strong',q.points+' pt'));item.append(heading);
      if(asKey){
        if(q.lines)item.append(wcEl('p',q.lines.map((l,j)=>(j+1)+'. '+(l.answer||'[nie wpisano odpowiedzi]')).join(' | ')));
        else item.append(wcEl('p',wcTaskAnswer(q)));
      }else item.append(taskContent(q));
      section.append(item);
    });
    if(!asKey){
      const results=wcEl('div');results.style.cssText='margin-top:24px;border:2px solid #334155;border-radius:9px;padding:13px;break-inside:avoid';
      results.append(wcEl('strong','TEST RESULTS'));
      results.append(wcEl('p','Total score: ______ / '+wcPaperTotal(test)+' points     Percentage: ______ %'));
      results.append(wcEl('p','Final grade:  ◯ 1   ◯ 2   ◯ 3   ◯ 4   ◯ 5   ◯ 6'));
      section.append(results);
    }
    return section;
  }
  function renderPreview(){
    const preview=$('teacherTestPreview');preview.replaceChildren();
    wcTeacherGenerated.forEach((test,ti)=>{
      const panel=wcEl('div');panel.style.cssText='padding:18px;margin:18px 0;border:1px solid #ddd;border-radius:12px';
      panel.append(sheet(test,false));
      const editor=wcEl('div');editor.style.cssText='padding-top:12px;border-top:1px solid #ddd';editor.append(wcEl('h4','✏️ Edytuj zadania, polecenia i punkty'));
      test.questions.forEach((q,i)=>{
        const wrap=wcEl('div');wrap.style.cssText='margin:12px 0;padding:10px;background:#f7f7ff;border-radius:8px';
        wrap.append(wcEl('strong','Zadanie '+(i+1)));
        const instruction=wcEl('textarea');instruction.rows=2;instruction.value=q.instruction;instruction.style.width='100%';instruction.oninput=()=>{q.instruction=instruction.value;refresh();};
        wrap.append(wcEl('label','Polecenie'),instruction);
        if(q.type==='guess'){
          const definition=wcEl('textarea');definition.rows=2;definition.value=q.question;
          definition.style.width='100%';definition.oninput=()=>{q.question=definition.value;refresh();};
          wrap.append(wcEl('label','Zdanie z luką (możesz poprawić)'),definition);
        }

        const points=wcEl('input');points.type='number';points.min=0;points.max=100;points.value=q.points;points.onchange=()=>{q.points=Math.max(0,Math.min(100,Number(points.value)||0));refresh();};
        wrap.append(wcEl('label','Punkty '),points);
        if(q.lines&&(q.type==='context'||q.type==='grammar')){
          wrap.append(wcEl('p','Gemini przygotowało zdania i odpowiedzi. Możesz je poprawić przed wydrukiem.'));
          q.lines.forEach((line,j)=>{
            const p=wcEl('p','Zdanie '+(j+1));wrap.append(p);
            [['sentence','Zdanie angielskie z luką'],['hint','Polskie słowo w nawiasie'],['answer','Poprawna odpowiedź EN']].forEach(([key,placeholder])=>{
              const input=wcEl('input');input.placeholder=placeholder;input.value=line[key];input.style.cssText='display:block;width:100%;box-sizing:border-box;margin:5px 0';
              input.oninput=()=>{line[key]=input.value;refresh();};wrap.append(input);
            });
          });
        }
        editor.append(wrap);
      });
      function refresh(){const old=panel.firstElementChild;panel.replaceChild(sheet(test,false),old);}
      panel.append(editor);preview.append(panel);
    });
  }
  wcGenerateGroups=async(requestedGroups)=>{
      const groups=requestedGroups;if(!groups.length)throw Error('Zaznacz co najmniej jedną grupę do druku.');
      const pairs=wcTeacherParse(),count=wcSequence().length;
      if(!Number.isInteger(count)||count<1||count>50||count>pairs.length)throw Error('Liczba zadań musi wynosić 1–50 i nie może przekraczać liczby słówek.');
      if(!wcChosenTasks.size)throw Error('Wybierz przynajmniej jeden kafelek zadania.');
      const types=[...wcChosenTasks],direction=$('teacherTestDirection').value;
      const byGroup=new Map(),pickedPairsByGroup=new Map();
      const generatedTests=groups.map(group=>{
        if(!byGroup.has(group)){
          const sequence=wcTeacherShuffle(wcSequence());
          const picked=wcTeacherShuffle(pairs).slice(0,count);
          pickedPairsByGroup.set(group,picked);
          byGroup.set(group,picked.map((pair,i)=>createQuestion(sequence[i],pair,pairs,direction)));
        }
        return {group,kind:$('wcPaperKind').value,title:$('teacherTestTitle').value.trim()||'Test ze słówek',gradeThresholds:wcGradeThresholds(),questions:byGroup.get(group).map(q=>JSON.parse(JSON.stringify(q))),_sourcePairs:byGroup.get(group).map((q,i)=>pickedPairsByGroup.get(group)[i])};
      });
      if(types.includes('context')||types.includes('grammar')){
        $('teacherTestStatus').textContent='✨ Gemini tworzy zdania angielskie z lukami…';
        const requests=[];
        generatedTests.forEach((test,ti)=>test.questions.forEach((q,qi)=>{
          if(q.type!=='context'&&q.type!=='grammar')return;
          const source=q.type==='context'?q.hint:q.hint;
          // Każda pozycja zawiera angielskie słowo i polskie tłumaczenie z listy nauczyciela.
          const pair=generatedTests[ti]._sourcePairs?.[qi];
          requests.push({id:ti+'-'+qi,type:q.type,word:pair?.[0]||q.hint,translation:pair?.[1]||q.hint});
        }));
        const generated=await wcGeminiSentences(requests);
        generatedTests.forEach((test,ti)=>test.questions.forEach((q,qi)=>{
          if(q.type!=='context'&&q.type!=='grammar')return;
          const found=generated.find(x=>x.id===ti+'-'+qi);
          if(!found)throw Error('Brak zdań dla zadania '+(qi+1));
          q.lines=found.lines;
          q.points=3;
        }));
      }
      if(types.includes('guess')){
        $('teacherTestStatus').textContent='📒 Losuję zdania z notesu…';
        const notes=await wcNotesFetch();
        const byWord=new Map();
        notes.forEach(n=>{const key=wcNotesKey(n.word);if(!byWord.has(key))byWord.set(key,[]);byWord.get(key).push(n.sentence);});
        const missing=new Set();
        generatedTests.forEach(t=>t.questions.filter(q=>q.type==='guess').forEach(q=>{
          const options=byWord.get(wcNotesKey(q.answer))||[];
          if(!options.length){missing.add(q.answer);return;}
          const sentence=options[Math.floor(Math.random()*options.length)];
          q.question=wcNotesCloze(sentence,q.answer);
        }));
        if(missing.size)throw Error('Brak zdań w Notesie zdań dla: '+[...missing].join(', ')+'. Dodaj je w notesie albo odznacz kafelek Zgadnij słówko.');
      }
      return generatedTests;
  };
  $('teacherMakeTests').onclick=async()=>{
    if(!user?.admin)return notice('Zaloguj się jako administrator.');
    const generateButton=$('teacherMakeTests');generateButton.disabled=true;
    try{const groups=[...selectedGroups].sort();wcTeacherGenerated=await wcGenerateGroups(groups);
      renderPreview();$('teacherPrintTests').disabled=false;
      $('teacherTestStatus').textContent='✅ Przygotowano grupy: '+groups.join(', ')+'. Zdania z notesu są losowane bez AI. Możesz je edytować przed drukiem.';
    }catch(e){wcTeacherGenerated=[];$('teacherPrintTests').disabled=true;$('teacherTestStatus').textContent='❌ '+e.message;}
    finally{generateButton.disabled=false;}
  };
  $('teacherPrintTests').onclick=()=>{
    if(!user?.admin||!wcTeacherGenerated.length)return;
    const unfinished=wcTeacherGenerated.some(t=>t.questions.some(q=>(q.type==='context'||q.type==='grammar')&&q.lines.some(l=>!l.sentence.trim()||!l.hint.trim()||!l.answer.trim())));
    if(unfinished)return notice('Najpierw uzupełnij wszystkie zdania, podpowiedzi i prawidłowe odpowiedzi w zadaniach kontekstowych i gramatycznych.');
    const popup=window.open('','_blank');if(!popup)return notice('Zezwól na wyskakujące okna.');
    const doc=popup.document;doc.title='WordClass — wybrane grupy';
    const style=doc.createElement('style');style.textContent='@page{size:A4;margin:13mm}body{font-family:Arial,sans-serif;color:#202537;font-size:12px}h2{font-size:17px;margin:0 0 10px}p{line-height:1.45}.wc-individual-sheet{break-after:page;page-break-after:always}.wc-individual-sheet:last-child{break-after:auto;page-break-after:auto}.wc-print-task{margin:14px 0 18px;break-inside:avoid;page-break-inside:avoid}button{padding:10px;background:#5545c7;color:white;border:0;border-radius:6px;margin-bottom:15px}@media print{button{display:none}}';doc.head.append(style);
    const btn=wcEl('button','🖨️ Drukuj / zapisz PDF');btn.onclick=()=>popup.print();doc.body.append(btn);
    const mode=$('wcPaperPrintMode').value;
    if(mode==='paired')wcTeacherGenerated.forEach(t=>{doc.body.append(sheet(t,false),sheet(t,true));});
    else{wcTeacherGenerated.forEach(t=>doc.body.append(sheet(t,false)));wcTeacherGenerated.forEach(t=>doc.body.append(sheet(t,true)));}
  };
  // Wybór uczniów i przydział grup ONLINE wymaga osobnej aktualizacji uprawnień Supabase.
})();

// ===== WordClass: progi procentowe dla wydruku i testów online =====
const wcGradeDefaults=[30,50,70,85,95]; // progi ocen 2,3,4,5,6
function wcGradeThresholds(){
  const vals=[2,3,4,5,6].map(g=>Number($('wcGrade'+g)?.value));
  if(vals.some(v=>!Number.isInteger(v)||v<0||v>100)||vals.some((v,i)=>i&&v<=vals[i-1]))throw Error('Progi ocen muszą rosnąć i mieścić się w zakresie 0–100%.');
  return vals;
}
function wcGradeText(t){return '1: 0–'+(t[0]-1)+'%  |  '+[2,3,4,5,6].map((g,i)=>g+': '+t[i]+'–'+(i<4?t[i+1]-1:100)+'%').join('  |  ');}
(function wcBuildGradeTile(){
  const anchor=$('wcTaskTiles');if(!anchor)return;
  const tile=wcEl('section');tile.id='wcGradeTile';tile.style.cssText='margin:16px 0;padding:18px;border:2px solid #55a4d9;border-radius:16px;background:#eaf7ff;color:#1d3650';
  tile.append(wcEl('h3','📊 Procenty i oceny — online i do druku'));
  tile.append(wcEl('p','Ustal minimalny procent wymagany do otrzymania oceny. Ocena 1 obowiązuje poniżej progu na 2.'));
  const grid=wcEl('div');grid.style.cssText='display:flex;flex-wrap:wrap;gap:12px';
  [2,3,4,5,6].forEach((g,i)=>{const label=wcEl('label','Ocena '+g+' od (%)');label.style.cssText='display:flex;flex-direction:column;min-width:100px;flex:1';const input=wcEl('input');input.id='wcGrade'+g;input.type='number';input.min=0;input.max=100;input.step=1;input.value=wcGradeDefaults[i];label.append(input);grid.append(label);});
  tile.append(grid);tile.append(wcEl('p','Wydruk: progi i miejsce na ocenę. Online: ocena zapisywana przez Supabase po oddaniu testu.'));
  anchor.after(tile);
})();

// ===== WordClass: testy online (funkcje serwerowe Supabase) =====
let wcOnlineActive = null;
let wcOnlineTimer = null;
let wcOnlineAnswers = {};
let wcOnlineSaving = Promise.resolve();
const wcOnlineRpc = async (name, params = {}) => {
  const {data, error} = await db.rpc(name, params);
  if (error) throw new Error(error.message + ' — sprawdź, czy uruchomiono 02_SUPABASE_SQL.sql');
  return data;
};
function wcOnlineStopTimer() { if (wcOnlineTimer) clearInterval(wcOnlineTimer); wcOnlineTimer = null; }
function wcOnlineParsePairs() {
  const lines = $('teacherTestWords').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const pairs = lines.map(line => line.split(/\s+-\s+/).map(x=>x.trim()));
  if (!pairs.length || pairs.length>100 || pairs.some(x=>x.length!==2||!x.every(Boolean))) throw new Error('Wpisz 1–100 par w formacie: apple - jabłko');
  return pairs;
}
function wcOnlineBuildUI() {
  const panel = $('adminTestGenerator');
  const section = document.createElement('section');
  section.style.cssText = 'margin-top:28px;padding:18px;border:1px solid #ddd;border-radius:14px;';
  section.innerHTML = `
    <h3>💻 Publikuj test / egzamin online</h3>
    <p>Zaznacz uczniów i przypisz im grupy A–G. Tylko zaznaczeni otrzymają test. Progi ocen ustaw w niebieskim kafelku powyżej.</p><p><strong>Uwaga:</strong> „Poprawa” oznacza osobny opublikowany test. Jeden opublikowany test można oddać tylko raz.</p>
    <label>Rodzaj <select id="wcOnlineKind"><option>Test</option><option>Egzamin</option></select></label>
    <label>Klasa <select id="wcOnlineClass"></select></label><div id="wcOnlineRecipients" style="margin:12px 0;padding:12px;border:1px solid #dce3f4;border-radius:12px"></div>
    <label>Od kiedy <input id="wcOnlineFrom" type="datetime-local"></label>
    <label>Do kiedy <input id="wcOnlineTo" type="datetime-local"></label>
    <label>Minuty na rozwiązanie <input id="wcOnlineMinutes" type="number" min="1" max="180" value="15"></label>
    <button type="button" id="wcOnlinePublish">📤 Wyślij test uczniom</button>
    <p id="wcOnlineAdminStatus" role="status"></p>
    <h3>🗂️ Zarządzaj opublikowanymi testami</h3>
    <button type="button" id="wcOnlineRefresh" class="secondary">🔄 Odśwież listę</button> <button type="button" id="wcOnlineClearEnded" class="danger">🧹 Usuń zakończone</button>
    <div id="wcOnlineAdminList"></div>`;
  panel.append(section);
  $('wcOnlinePublish').onclick = wcOnlinePublish;
  $('wcOnlineClass').onchange=wcOnlineRenderRecipients;
  $('wcOnlineRefresh').onclick = wcOnlineAdminList;
  $('wcOnlineClearEnded').onclick = wcOnlineClearEnded;
  const origOpen = openAdminSection;
  openAdminSection = function(id) {
    origOpen(id);
    if (id==='adminTestGenerator') wcOnlineAdminList();
  };
  const tab = document.createElement('div');
  tab.id = 'onlineTests'; tab.className = 'tab hidden';
  tab.innerHTML = '<h3>💻 Moje sprawdziany online</h3><button type="button" id="wcOnlineStudentRefresh" class="secondary">🔄 Odśwież</button><div id="wcOnlineStudentList"></div><div id="wcOnlineExamArea"></div>';
  $('student').append(tab);
  const nav = $('studentTiles');
  const tile = document.createElement('button');
  tile.type='button';tile.className='dashboard-tile';
  tile.innerHTML='<span class="tile-icon">⏱️</span><strong>Sprawdziany online</strong><small>Testy od nauczyciela</small><span class="tile-arrow">Otwórz →</span>';
  tile.onclick = () => wcOpenStudentTab('onlineTests');
  nav.append(tile);
  $('wcOnlineStudentRefresh').onclick = wcOnlineStudentList;
  const origTab = wcOpenStudentTab;
  wcOpenStudentTab = function(name) { origTab(name); if (name==='onlineTests') wcOnlineStudentList(); else wcOnlineStopTimer(); };
  const origStudentDashboard = wcStudentDashboard;
  wcStudentDashboard = function() { wcOnlineStopTimer(); origStudentDashboard(); };
  const origLogout = logout;
  logout = async function() { wcOnlineStopTimer(); wcOnlineActive=null; await origLogout(); };
}
const wcOnlineChosen=new Map();
function wcOnlineRenderRecipients(){
  const area=$('wcOnlineRecipients');if(!area)return;area.replaceChildren();
  const list=wcStudents.filter(s=>String(s.class_id)===String($('wcOnlineClass').value));
  area.append(wcEl('strong','☑️ Zaznacz uczniów, którzy mają otrzymać test'));
  if(!list.length){area.append(wcEl('p','Brak uczniów w wybranej klasie.'));return;}
  list.forEach(s=>{
    if(!wcOnlineChosen.has(s.id))wcOnlineChosen.set(s.id,{checked:false,group:'A',term:'Pierwszy termin'});
    const item=wcOnlineChosen.get(s.id),row=wcEl('div');row.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #e3e7f2';
    const check=wcEl('input');check.type='checkbox';check.checked=item.checked;check.setAttribute('aria-label','Wybierz '+(s.full_name||s.login));
    const name=wcEl('span',s.full_name||s.login);name.style.cssText='flex:1;min-width:130px';
    const group=wcEl('select');'ABCDEFG'.split('').forEach(g=>{const op=wcEl('option','Grupa '+g);op.value=g;group.append(op);});group.value=item.group;
    const term=wcEl('select');['Pierwszy termin','Poprawa'].forEach(v=>{const op=wcEl('option',v);op.value=v;term.append(op);});term.value=item.term;
    const sync=()=>{group.disabled=!item.checked;term.disabled=!item.checked;};
    check.onchange=()=>{item.checked=check.checked;sync();};group.onchange=()=>item.group=group.value;term.onchange=()=>item.term=term.value;sync();
    row.append(check,name,group,term);area.append(row);
  });
}
async function wcOnlinePublish() {
  if (!user?.admin) return;
  const button=$('wcOnlinePublish'); button.disabled=true;
  try {

    const pairs=wcOnlineParsePairs();
    const start=$('wcOnlineFrom').value, end=$('wcOnlineTo').value;
    if (!start || !end) throw new Error('Ustaw datę i godzinę rozpoczęcia oraz zakończenia.');
    const count=Number($('teacherTestCount').value);
    const chosen=wcStudents.filter(s=>String(s.class_id)===String($('wcOnlineClass').value)&&wcOnlineChosen.get(s.id)?.checked).map(s=>({student_id:s.id,group:wcOnlineChosen.get(s.id).group,term:wcOnlineChosen.get(s.id).term}));
    if(!chosen.length)throw Error('Zaznacz przynajmniej jednego ucznia.');
    const grades=wcGradeThresholds();
    const tests=await wcGenerateGroups([... 'ABCDEFG']);
    const questions=Object.fromEntries(tests.map(t=>[t.group,t.questions.map(wcOnlinePack)]));
    const id=await wcOnlineRpc('wc_online_create_counted',{
      p_title:$('teacherTestTitle').value.trim()||'Test ze słówek',
      p_kind:$('wcOnlineKind').value,
      p_class_id:Number($('wcOnlineClass').value),
      p_start:new Date(start).toISOString(),p_end:new Date(end).toISOString(),
      p_minutes:Number($('wcOnlineMinutes').value),p_pairs:pairs,
      p_count:count,p_direction:$('teacherTestDirection').value,
      p_recipients:chosen,p_grade_thresholds:grades,p_questions:questions
    });
    $('wcOnlineAdminStatus').textContent='✅ Opublikowano test nr '+id+' dla '+chosen.length+' zaznaczonych uczniów.';
    await wcOnlineAdminList();
  } catch(e) { $('wcOnlineAdminStatus').textContent='❌ '+e.message; }
  finally { button.disabled=false; }
}
async function wcOnlineAdminList() {
  if (!user?.admin) return;
  const select=$('wcOnlineClass'), previous=select.value;
  select.replaceChildren();
  classes.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;select.append(o);});
  if (previous && classes.some(c=>String(c.id)===String(previous))) select.value=previous;
  wcOnlineRenderRecipients();
  const area=$('wcOnlineAdminList');area.textContent='Ładowanie…';
  try {
    const items=await wcOnlineRpc('wc_online_admin_list');area.replaceChildren();
    if (!items.length) area.textContent='Nie ma jeszcze testów online.';
    for (const item of items) {
      const row=wcEl('div');row.style.cssText='padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:10px;';
      const className=classes.find(c=>String(c.id)===String(item.class_id))?.name||'Klasa';
      row.append(wcEl('strong',item.kind+' — '+item.title+' ('+className+')'));
      row.append(wcEl('p','Od '+new Date(item.starts_at).toLocaleString('pl-PL')+' do '+new Date(item.ends_at).toLocaleString('pl-PL')+' • '+item.duration_minutes+' min • rozpoczęto '+item.attempts+', oddano '+item.submitted+(item.closed?' • ZAMKNIĘTY':'')));
      const results=wcEl('button','📊 Wyniki');results.type='button';
      results.onclick=async()=>{
        try { const data=await wcOnlineRpc('wc_online_admin_results',{p_exam_id:item.id});
          const display=wcEl('div');display.style.whiteSpace='pre-wrap';
          display.textContent=data.length?data.map(a=>(a.student||a.login||'Uczeń')+' • grupa '+a.group+' • '+(a.grade?'ocena '+a.grade+' ('+a.points+'/'+a.total+')':'jeszcze nie oddano')).join('\n'):'Brak prób.';
          row.querySelector('.wcResults')?.remove();display.className='wcResults';row.append(display);
        } catch(e){notice(e.message);} };
      const close=wcEl('button','🔒 Zamknij');close.type='button';close.className='secondary';close.disabled=item.closed;
      close.onclick=async()=>{if(!confirm('Zamknąć test dla nowych prób? Rozpoczęte próby nadal mają swój licznik.'))return;try{await wcOnlineRpc('wc_online_manage',{p_id:item.id,p_action:'close'});wcOnlineAdminList();}catch(e){notice(e.message);}};
      const del=wcEl('button','🗑️ Usuń');del.type='button';del.className='danger';
      del.onclick=async()=>{if(!confirm('Trwale usunąć test '+item.title+' i próby? Oceny w dzienniku pozostaną.'))return;try{await wcOnlineRpc('wc_online_manage',{p_id:item.id,p_action:'delete'});wcOnlineAdminList();}catch(e){notice(e.message);}};
      row.append(results,close,del);area.append(row);
    }
  } catch(e){area.textContent='❌ '+e.message;}
}
async function wcOnlineStudentList() {
  if (!user || user.admin) return;
  const area=$('wcOnlineStudentList');area.textContent='Ładowanie…';
  try {
    const items=await wcOnlineRpc('wc_online_student_list');area.replaceChildren();
    if (!items.length) area.textContent='Nauczyciel nie opublikował jeszcze testów dla Twojej klasy.';
    for (const item of items) {
      const row=wcEl('div');row.style.cssText='padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:10px;';
      row.append(wcEl('strong',item.kind+' — '+item.title));
      row.append(wcEl('p',new Date(item.starts_at).toLocaleString('pl-PL')+' – '+new Date(item.ends_at).toLocaleString('pl-PL')+' • '+item.duration_minutes+' min'));
      const button=wcEl('button',item.submitted_at?'✅ Oddano • ocena '+item.grade:item.started_at?'▶️ Kontynuuj':'▶️ Rozpocznij');
      const now=Date.now();
      button.disabled=!!item.submitted_at || (!item.started_at && (item.closed || now<Date.parse(item.starts_at) || now>=Date.parse(item.ends_at)));
      button.onclick=()=>wcOnlineStart(item.id);
      row.append(button);area.append(row);
    }
  }catch(e){area.textContent='❌ '+e.message;}
}
async function wcOnlineStart(id) {
  try {
    const data=await wcOnlineRpc('wc_online_start',{p_exam_id:id});
    wcOnlineStopTimer();wcOnlineActive=data;wcOnlineAnswers={};wcOnlineSaving=Promise.resolve();
    const area=$('wcOnlineExamArea');area.replaceChildren();
    area.append(wcEl('h3',data.title+' — Grupa '+data.group));
    const timer=wcEl('h2');timer.id='wcOnlineClock';area.append(timer);
    data.questions.forEach((q,i)=>{
      wcOnlineRenderCounted(q,i,area);
    });
    const status=wcEl('p');status.id='wcOnlineStatus';area.append(status);
    const finish=wcEl('button','✅ Oddaj sprawdzian');finish.type='button';finish.onclick=()=>wcOnlineFinish(false);area.append(finish);
    const update=()=>{
      if (!wcOnlineActive) return;
      const remaining=Math.max(0,Math.ceil((Date.parse(data.deadline)-Date.now())/1000));
      timer.textContent='⏱️ '+String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');
      if(remaining===0){wcOnlineStopTimer();wcOnlineFinish(true);}
    };
    update();wcOnlineTimer=setInterval(update,1000);
    area.scrollIntoView({behavior:'smooth',block:'start'});
  } catch(e){notice(e.message);await wcOnlineStudentList();}
}
function wcOnlineQueueSave() {
  if (!wcOnlineActive) return;
  const id=wcOnlineActive.id, snapshot={...wcOnlineAnswers};
  wcOnlineSaving=wcOnlineSaving.catch(()=>{}).then(()=>wcOnlineRpc('wc_online_save',{p_exam_id:id,p_answers:snapshot}));
  wcOnlineSaving.catch(e=>{if($('wcOnlineStatus'))$('wcOnlineStatus').textContent='⚠️ Błąd zapisu: '+e.message;});
}
async function wcOnlineFinish(auto) {
  if(!wcOnlineActive)return;
  if(!auto && !confirm('Oddać test? Po oddaniu nie można zmienić odpowiedzi.'))return;
  wcOnlineStopTimer();const id=wcOnlineActive.id;
  const status=$('wcOnlineStatus');if(status)status.textContent='Zapisywanie i ocenianie…';
  try {
    await wcOnlineSaving.catch(()=>{});
    // Best effort final save; server rejects late writes, then grades last saved answers.
    if(!auto) await wcOnlineRpc('wc_online_save',{p_exam_id:id,p_answers:{...wcOnlineAnswers}});
    const result=await wcOnlineRpc('wc_online_finish',{p_exam_id:id});
    wcOnlineActive=null;
    $('wcOnlineExamArea').replaceChildren(wcEl('h3','✅ Oddano! Wynik: '+result.points+'/'+result.total+' • Ocena '+result.grade));
    await wcOnlineStudentList();
  }catch(e){if(status)status.textContent='⚠️ '+e.message+' — odśwież listę, aby sprawdzić wynik.';}
}
wcOnlineBuildUI();

async function wcOnlineClearEnded() {
  if (!user?.admin) return;
  try {
    const items=await wcOnlineRpc('wc_online_admin_list');
    const ended=items.filter(x=>x.closed || Date.parse(x.ends_at)<=Date.now());
    if (!ended.length) return notice('Brak zakończonych testów do usunięcia.');
    if (!confirm('Usunąć '+ended.length+' zakończonych testów/egzaminów i ich próby? Oceny w dzienniku pozostaną.')) return;
    let count=0;
    for (const item of ended) { await wcOnlineRpc('wc_online_manage',{p_id:item.id,p_action:'delete'});count++; }
    notice('Usunięto '+count+' zakończonych testów. Oceny pozostały.');
    await wcOnlineAdminList();
  } catch(e) {notice('Przerwano usuwanie: '+e.message);await wcOnlineAdminList();}
}


// ===== NOTES ZDAŃ — przechowywanie w Supabase, bez Gemini =====
const wcNotesKey = word => String(word||'').trim().toLocaleLowerCase('en');
const wcNotesWordPattern = /[A-Za-z]+(?:[ '-][A-Za-z]+)*/;
function wcNotesCloze(sentence,word){
  const clean=String(sentence||'').trim();
  const target=String(word||'').trim();
  if(!target)return clean;
  // Autor może użyć {word} lub ____ jako znacznika luki.
  if(/\{word\}/i.test(clean))return clean.replace(/\{word\}/gi,'_ '.repeat(target.replace(/\s/g,'').length).trim());
  if(/_{3,}/.test(clean))return clean.replace(/_{3,}/g,'_ '.repeat(target.replace(/\s/g,'').length).trim());
  const escaped=target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp('(^|[^A-Za-z])('+escaped+')(?=$|[^A-Za-z])','i');
  return clean.replace(re,(_,prefix)=>prefix+'_ '.repeat(target.replace(/\s/g,'').length).trim());
}
async function wcNotesFetch(){
  if(!user?.admin)throw Error('Zaloguj się jako administrator.');
  const all=[];
  for(let start=0;;start+=1000){
    const {data,error}=await db.from('wordclass_sentence_notes').select('id,word,sentence').order('id',{ascending:true}).range(start,start+999);
    if(error)throw Error('Notes wymaga utworzenia tabeli w Supabase (plik SQL z ZIP). '+error.message);
    all.push(...(data||[]));
    if(!data||data.length<1000)break;
  }
  return all;
}
(function wcNotesSetup(){
  const admin=$('admin');if(!admin||$('adminSentenceNotes'))return;
  const section=wcEl('section');section.id='adminSentenceNotes';section.className='dashboard-section hidden';
  section.innerHTML=`<h3>📒 Notes zdań bez limitu</h3>
  <p>Wklej zdania po angielsku. Dodawaj dowolną liczbę zdań, także wiele zdań dla jednego słówka (w granicach pojemności Supabase). Zapis w Supabase — dostępny z innych urządzeń. Nie używa AI.</p>
  <p><b>Format:</b> słówko - całe zdanie po angielsku. W zdaniu musi występować dokładnie to słówko albo znacznik <code>{word}</code> / <code>____</code>.</p>
  <textarea id="wcNotesPaste" rows="8" style="width:100%;box-sizing:border-box" placeholder="apple - I eat an apple every day.&#10;apple - She bought a red apple.&#10;towel - I need a clean towel after a shower."></textarea>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0"><button type="button" id="wcNotesSave">💾 Zapisz zdania</button><button type="button" id="wcNotesRefresh" class="secondary">🔄 Odśwież</button></div>
  <p id="wcNotesStatus" role="status" aria-live="polite"></p>
  <label>Szukaj słówka <input id="wcNotesSearch" placeholder="np. apple" autocomplete="off"></label>
  <div id="wcNotesList"></div>`;
  admin.append(section);
  $('wcNotesSave').onclick=wcNotesSave;
  $('wcNotesRefresh').onclick=wcNotesLoad;
  $('wcNotesSearch').oninput=wcNotesRender;
})();
let wcNotesCache=[];
async function wcNotesLoad(){
  const status=$('wcNotesStatus');if(!status)return;
  status.textContent='Ładuję notes…';
  try{wcNotesCache=await wcNotesFetch();wcNotesRender();status.textContent='📚 Zapisano '+wcNotesCache.length+' zdań.';}
  catch(e){status.textContent='❌ '+e.message;}
}
function wcNotesRender(){
  const list=$('wcNotesList');if(!list)return;
  list.replaceChildren();
  const search=wcNotesKey($('wcNotesSearch')?.value);
  const filtered=wcNotesCache.filter(n=>wcNotesKey(n.word).includes(search));
  list.append(wcEl('p','Wyświetlono '+filtered.length+' z '+wcNotesCache.length+' zdań.'));
  filtered.forEach(n=>{
    const row=wcEl('div');row.style.cssText='padding:10px 0;border-bottom:1px solid #dce0ed;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
    const label=wcEl('span',n.word+' — '+n.sentence);label.style.cssText='flex:1;min-width:190px;overflow-wrap:anywhere';
    const edit=wcEl('button','✏️ Edytuj');edit.className='secondary';edit.type='button';
    edit.onclick=async()=>{
      const value=prompt('Zmień zdanie dla słowa '+n.word+':',n.sentence);
      if(value===null)return;
      const sentence=value.trim();
      if(!wcNotesValidSentence(n.word,sentence))return notice('Zdanie musi zawierać słówko, {word} albo ____.');
      const {error}=await db.from('wordclass_sentence_notes').update({sentence}).eq('id',n.id);
      if(error)return notice('Nie zapisano: '+error.message);
      await wcNotesLoad();
    };
    const del=wcEl('button','🗑️ Usuń');del.className='danger';del.type='button';
    del.onclick=async()=>{
      if(!confirm('Usunąć to zdanie?'))return;
      const {error}=await db.from('wordclass_sentence_notes').delete().eq('id',n.id);
      if(error)return notice('Nie usunięto: '+error.message);
      await wcNotesLoad();
    };
    row.append(label,edit,del);list.append(row);
  });
}
function wcNotesValidSentence(word,sentence){
  if(!sentence||sentence.length>500)return false;
  if(/\{word\}|_{3,}/i.test(sentence))return true;
  const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(^|[^A-Za-z])'+escaped+'(?=$|[^A-Za-z])','i').test(sentence);
}
async function wcNotesSave(){
  const status=$('wcNotesStatus'),button=$('wcNotesSave');
  button.disabled=true;
  try{
    const lines=$('wcNotesPaste').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length)throw Error('Wklej przynajmniej jedno zdanie.');
    const existing=await wcNotesFetch();
    const entries=[];
    const duplicates=new Set(existing.map(n=>wcNotesKey(n.word)+'\u0000'+n.sentence.toLocaleLowerCase('en')));
    for(let i=0;i<lines.length;i++){
      const match=lines[i].match(/^(.+?)\s+-\s+(.+)$/);
      if(!match)throw Error('Linia '+(i+1)+': użyj formatu słówko - zdanie.');
      const word=match[1].trim(),sentence=match[2].trim(),key=wcNotesKey(word);
      if(word.length>80||!wcNotesWordPattern.test(word)||!wcNotesValidSentence(word,sentence))throw Error('Linia '+(i+1)+': zdanie musi zawierać słówko, {word} albo ____.');
      const unique=key+'\u0000'+sentence.toLocaleLowerCase('en');
      if(duplicates.has(unique))continue;
      duplicates.add(unique);
      entries.push({word,sentence});
    }
    if(!entries.length)throw Error('Wszystkie wklejone zdania już są w notesie.');
    for(let i=0;i<entries.length;i+=100){
      const {error}=await db.from('wordclass_sentence_notes').insert(entries.slice(i,i+100));
      if(error)throw Error('Nie zapisano wszystkich zdań: '+error.message);
    }
    $('wcNotesPaste').value='';
    await wcNotesLoad();
    status.textContent='✅ Dodano '+entries.length+' zdań. Razem: '+wcNotesCache.length+'.';
  }catch(e){status.textContent='❌ '+e.message;}
  finally{button.disabled=false;}
}

(function wcGuessPrintStyle(){const s=document.createElement('style');s.textContent='@media print {.wc-guess-actions{display:none!important}.wc-print-task input[aria-label^=\"Litera \"]{border:2px solid #111!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}';document.head.append(s);})();

// Liczniki wspólne dla druku i publikacji.
(function(){
 const wrap=$('wcTaskTiles'),grid=[...wrap.children].find(x=>x.style.display==='grid');
 grid.replaceChildren(); const total=wcEl('p');total.style.fontWeight='bold';
 [...wrap.children].filter(x=>x.tagName==='P').forEach(x=>x.remove());
 wrap.prepend(wcEl('p','Ustaw liczbę zadań każdego rodzaju. 0 = pomiń.'));
 wrap.append(total);
 const old=$('teacherTestCount');old.readOnly=true;old.closest('label')?.style.setProperty('display','none');
 function sync(){old.value=wcSequence().length;total.textContent='Razem: '+old.value+' zadań w każdej grupie (maks. 50).';}
 wcTaskTypes.forEach(t=>{const card=wcEl('div');card.style.cssText='padding:12px;border-radius:14px;background:'+t.bg+';color:'+t.color;
 card.append(wcEl('strong',t.icon+' '+t.name),wcEl('p',t.desc));const row=wcEl('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:8px';
 const minus=wcEl('button','−'),plus=wcEl('button','+'),num=wcEl('strong');minus.type=plus.type='button';minus.setAttribute('aria-label','Zmniejsz '+t.name);plus.setAttribute('aria-label','Zwiększ '+t.name);
 function paint(){num.textContent=wcCounts[t.id]||0;card.style.border=(wcCounts[t.id]?'3px solid '+t.color:'2px solid #ddd');sync();}
 function change(delta){if(delta>0&&wcSequence().length>=50)return;wcCounts[t.id]=Math.max(0,(wcCounts[t.id]||0)+delta);if(wcCounts[t.id])wcChosenTasks.add(t.id);else wcChosenTasks.delete(t.id);paint();}
 minus.onclick=()=>change(-1);plus.onclick=()=>change(1);row.append(minus,num,plus);card.append(row);grid.append(card);paint();});sync();
})();
function wcOnlinePack(q){
 const out={type:q.type,question:q.question||'',instruction:q.instruction,answer:q.answer||''};
 if(q.choices)out.choices=q.choices;
 if(q.left){out.left=q.left;out.right=q.right;out.answer=JSON.stringify(q.answers.map(String));}
 if(q.lines){out.lines=q.lines.map(l=>({sentence:l.sentence,hint:l.hint||''}));out.answer=JSON.stringify(q.lines.map(l=>wcNorm(l.answer)));}
 if(q.type==='guess'){out.length=Array.from(q.answer.replace(/\s/g,'')).length;out.answer=q.answer.replace(/\s/g,'');}
 return out;
}
function wcOnlineRenderCounted(q,i,area){
 const box=wcEl('div');box.style.cssText='padding:12px;margin:10px 0;border:1px solid #ddd;border-radius:10px';box.append(wcEl('strong',(i+1)+'. '+(q.instruction||q.question)));if(q.instruction&&q.question)box.append(wcEl('p',q.question));
 let values=[];try{values=JSON.parse(q.answer||'[]');if(!Array.isArray(values))values=[];}catch(e){}
 const composite=!!(q.left||q.lines);const inputs=[];
 function save(){wcOnlineAnswers[String(i)]=composite?JSON.stringify(inputs.map(x=>wcNorm(x.value))):q.type==='guess'?inputs.map(x=>x.value).join(''):inputs[0].value;wcOnlineQueueSave();}
 function field(label,choices,value){const l=wcEl('label',label);const input=wcEl(choices?'select':'input');if(choices){const blank=wcEl('option','Wybierz');blank.value='';input.append(blank);choices.forEach(([v,t])=>{const o=wcEl('option',t);o.value=v;input.append(o);});}input.value=value||'';input.oninput=save;inputs.push(input);l.append(input);box.append(l);return input;}
 if(q.left){box.append(wcEl('p',q.right.map((v,j)=>String.fromCharCode(65+j)+') '+v).join(' | ')));q.left.forEach((v,j)=>field(v,q.right.map((x,k)=>[String(k+1),String.fromCharCode(65+k)]),values[j]));}
 else if(q.lines)q.lines.forEach((l,j)=>field(l.sentence+(l.hint?' ('+l.hint+')':''),q.type==='truefalse'?[['prawda','Prawda'],['fałsz','Fałsz']]:null,values[j]));
 else if(q.type==='guess'){for(let j=0;j<q.length;j++){const x=field('',null,Array.from(q.answer||'')[j]);x.maxLength=1;x.style.cssText='width:32px;text-align:center';x.parentElement.style.display='inline-block';x.setAttribute('aria-label','Litera '+(j+1));}}
 else field('',q.choices?.map(x=>[x,x]),q.answer);
 wcOnlineAnswers[String(i)]=q.answer||'';area.append(box);
}
