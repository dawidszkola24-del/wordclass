
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
    'adminTestGenerator'
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
    'adminTestGenerator'
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
    const wybranaKlasa = classes.find(
  item => item.id === classId
);

const nazwaKlasy = wybranaKlasa
  ? wybranaKlasa.name
  : 'Bez klasy';

pokazTabeleKont(accounts, nazwaKlasy);

   
    wcLastPrint = {accounts, name: nazwaKlasy};
    await wcLoadStudents();
    notice('Utworzono ' + accounts.length + ' kont uczniów.');

   
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
    if(alternatives.length<3)return {type:'open',question,answer};
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
    <p>Używa słówek i tytułu wpisanych wyżej. Uczeń dostaje losową grupę A–G. Ocena trafia do dziennika.</p>
    <label>Rodzaj <select id="wcOnlineKind"><option>Test</option><option>Egzamin</option></select></label>
    <label>Klasa <select id="wcOnlineClass"></select></label>
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
async function wcOnlinePublish() {
  if (!user?.admin) return;
  const button=$('wcOnlinePublish'); button.disabled=true;
  try {
    const pairs=wcOnlineParsePairs();
    const start=$('wcOnlineFrom').value, end=$('wcOnlineTo').value;
    if (!start || !end) throw new Error('Ustaw datę i godzinę rozpoczęcia oraz zakończenia.');
    const count=Number($('teacherTestCount').value);
    const id=await wcOnlineRpc('wc_online_create',{
      p_title:$('teacherTestTitle').value.trim()||'Test ze słówek',
      p_kind:$('wcOnlineKind').value,
      p_class_id:Number($('wcOnlineClass').value),
      p_start:new Date(start).toISOString(),p_end:new Date(end).toISOString(),
      p_minutes:Number($('wcOnlineMinutes').value),p_pairs:pairs,
      p_count:count,p_direction:$('teacherTestDirection').value
    });
    $('wcOnlineAdminStatus').textContent='✅ Opublikowano sprawdzian nr '+id+' dla wybranej klasy.';
    await wcOnlineAdminList();
  } catch(e) { $('wcOnlineAdminStatus').textContent='❌ '+e.message; }
  finally { button.disabled=false; }
}
async function wcOnlineAdminList() {
  if (!user?.admin) return;
  const select=$('wcOnlineClass'), previous=select.value;
  select.replaceChildren();
  classes.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;select.append(o);});
  if (previous) select.value=previous;
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
      const label=wcEl('label',(i+1)+'. '+q.question);
      const input=wcEl('input');input.placeholder='Wpisz tłumaczenie';input.value=q.answer||'';
      wcOnlineAnswers[String(i)]=input.value;
      input.oninput=()=>{wcOnlineAnswers[String(i)]=input.value;wcOnlineQueueSave();};
      label.append(input);area.append(label);
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
