
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
      if (block.id === 'adminGrades') wcLoadStudents();
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
  const filter=$('filterClass')?.value||'all';
  wcStudents.filter(s=>filter==='all'||(filter==='none'?!s.class_id:String(s.class_id)===filter)).forEach(s=>{
    const tr=wcEl('tr');
    const cls=classes.find(c=>c.id===s.class_id)?.name||'Bez klasy';
    [s.login||'', '•••••', s.full_name||'—',cls,'Oceny'].forEach(v=>tr.append(wcEl('td',v)));
    const td=wcEl('td');const button=wcEl('button','Oceny');
    button.onclick=()=>wcOpenGrades(s);td.append(button);tr.append(td);tbody.append(tr);
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

// WORDCLASS — generator testów nauczyciela (wersja do druku).
// Nie zapisuje odpowiedzi ani ocen, nie publikuje testów online.
let wcTeacherGenerated = [];
function wcTeacherShuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
$('teacherMakeTests').onclick = () => {
  if (!user?.admin) return notice('Zaloguj się jako administrator.');
  const lines = $('teacherTestWords').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const pairs = [];
  for (const line of lines) {
    const parts = line.split(/\s+-\s+/).map(part => part.trim());
    if (parts.length !== 2 || !parts.every(Boolean)) {
      $('teacherTestStatus').textContent = 'Popraw linię: ' + line + ' (wymagany format: apple - jabłko)';
      return;
    }
    pairs.push(parts);
  }
  const count = Number($('teacherTestCount').value);
  if (!pairs.length || pairs.length > 100) return notice('Wpisz od 1 do 100 par słówek.');
  if (!Number.isInteger(count) || count < 1 || count > 50 || count > pairs.length) {
    return notice('Liczba pytań musi wynosić od 1 do 50 i nie może przekraczać liczby słówek.');
  }
  const direction = $('teacherTestDirection').value;
  const title = $('teacherTestTitle').value.trim() || 'Test ze słówek';
  wcTeacherGenerated = [...'ABCDEFG'].map(group => ({
    group, title,
    questions: wcTeacherShuffle(pairs).slice(0, count).map(pair => {
      const reverse = direction === 'plen' || (direction === 'mixed' && Math.random() < 0.5);
      return { question: reverse ? pair[1] : pair[0], answer: reverse ? pair[0] : pair[1] };
    })
  }));
  const preview = $('teacherTestPreview');
  preview.replaceChildren();
  wcTeacherGenerated.forEach(test => {
    const section = wcEl('section');
    section.style.cssText = 'margin:18px 0;padding:16px;border:1px solid #ddd;border-radius:12px;';
    section.append(wcEl('h3', test.title + ' — Grupa ' + test.group));
    section.append(wcEl('p', 'Imię i nazwisko: __________________________  Klasa: __________'));
    test.questions.forEach((q, i) => {
      const p = wcEl('p', (i + 1) + '. ' + q.question + '   ______________________________');
      p.style.margin = '16px 0';
      section.append(p);
    });
    preview.append(section);
  });
  $('teacherPrintTests').disabled = false;
  $('teacherTestStatus').textContent = 'Gotowe! Utworzono 7 grup (A–G), po ' + count + ' pytań. Możesz wydrukować lub zapisać jako PDF.';
};
$('teacherPrintTests').onclick = () => {
  if (!user?.admin || !wcTeacherGenerated.length) return;
  const popup = window.open('', '_blank');
  if (!popup) return notice('Zezwól na wyskakujące okna, aby wydrukować test.');
  const doc = popup.document;
  doc.title = 'WordClass — testy A–G';
  const style = doc.createElement('style');
  style.textContent = '@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#222}section{break-after:page;page-break-after:always}section:last-child{break-after:auto;page-break-after:auto}h2{color:#5645c7}p{margin:22px 0}button{padding:12px 20px;background:#5645c7;color:white;border:0;border-radius:8px}@media print{button{display:none}}';
  doc.head.append(style);
  const printButton = doc.createElement('button');
  printButton.textContent = '🖨️ Drukuj / zapisz jako PDF';
  printButton.onclick = () => popup.print();
  doc.body.append(printButton);
  wcTeacherGenerated.forEach(test => {
    const section = doc.createElement('section');
    section.append(wcEl('h2', 'WordClass — ' + test.title + ' — Grupa ' + test.group));
    section.append(wcEl('p', 'Imię i nazwisko: __________________________  Klasa: __________'));
    test.questions.forEach((q, i) => section.append(wcEl('p', (i + 1) + '. ' + q.question + '   ______________________________')));
    doc.body.append(section);
  });
};
