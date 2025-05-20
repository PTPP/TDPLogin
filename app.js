/* =======================================================================
   app.js  –  front-end logic that talks to the single Code.gs Web App
   ======================================================================= */

/* === ENDPOINT to your deployed Apps Script Web App ==================== */
const API_BASE =
  'https://script.google.com/macros/s/AKfycbz83zykcrg-WxAHkdIx0gz6qv3pz7wWISuLGG6KocIj4tM1rTZg3NvfLSA8Lz7OJxQY/exec';

/* === tiny helpers ===================================================== */
const $  = (q, p = document) => p.querySelector(q);
const $$ = (q, p = document) => [...p.querySelectorAll(q)];
const busy = on => ($('#spinner').style.display = on ? 'flex' : 'none');

/* === global state ===================================================== */
let me      = null;   // profil zalogowanego użytkownika
let curYear = '';     // wybrany rok w zakładce 2

/* =======================================================================
   1. LOGOWANIE
   ===================================================================== */
$('#btn-login').addEventListener('click', async () => {
  const email = $('#login-email').value.trim().toLowerCase();
  const pass  = $('#login-pass').value.trim();

  if (!email || pass.length < 6) {
    $('#login-error').textContent = 'Popraw email i hasło (≥6 znaków)';
    return;
  }
  $('#login-error').textContent = '';
  busy(true);

  const params = new URLSearchParams({ action: 'login', email, password: pass });
  try {
    const res = await fetch(`${API_BASE}?${params}`, { method: 'GET' });
    const json = await res.json();
    busy(false);

    if (!json.success) {
      $('#login-error').textContent = json.error || 'Błędne dane logowania';
      return;
    }
    me = json.user;
    enterPanel();
  } catch (err) {
    busy(false);
    $('#login-error').textContent = err.message;
  }
});

/* =======================================================================
   2. PANEL główny – po udanym logowaniu
   ===================================================================== */
function enterPanel () {
  $('#login-card').style.display = 'none';
  $('#navbar').style.display     = 'block';
  $('#panel').style.display      = 'block';

  fillProfileCard();
  listYears();
}

/* ----------  profil (zakładka 1)  ---------- */
function fillProfileCard () {
  $('#prof-name').textContent    = `${me['Imię']} ${me['Nazwisko']}`;
  $('#prof-spec-no').textContent = me['Numer specjalisty'] ? `Numer ID: ${me['Numer specjalisty']}` : '';
  $('#prof-level').textContent   = me['Poziom specjalisty'] ? `Poziom: ${me['Poziom specjalisty']}` : '';
  $('#prof-specializations').textContent = me['Posiadane specjalizacje'] || '';
  $('#avatar-img').src           = me['Zdjęcie (URL)'] || 'https://via.placeholder.com/120';

  $('#f-phone-private').value    = me['Telefon prywatny']  || '';
  $('#f-phone-reg').value        = me['Telefon (Kontakt)'] || '';
  $('#f-email-login').value      = me['Email']             || '';
  $('#f-email-public').value     = me['Email Publiczny']   || '';
  $('#f-city').value             = me['Miejscowość']       || '';
  $('#f-zip').value              = me['Kod pocztowy']      || '';
  $('#f-street').value           = me['Ulica']             || '';
  $('#f-bio').value              = me['Opis specjalisty']  || '';
  M.updateTextFields();
}

/*  ---- zapisz profil ---- */
$('#btn-save-profile').addEventListener('click', async e => {
  e.preventDefault();
  const upd = {
    'Telefon prywatny' : $('#f-phone-private').value.trim(),
    'Telefon (Kontakt)' : $('#f-phone-reg').value.trim(),
    'Email' : $('#f-email-login').value.trim().toLowerCase(),
    'Email Publiczny' : $('#f-email-public').value.trim(),
    'Miejscowość' : $('#f-city').value.trim(),
    'Kod pocztowy' : $('#f-zip').value.trim(),
    'Ulica' : $('#f-street').value.trim(),
    'Opis specjalisty' : $('#f-bio').value.trim()
  };
  const params = new URLSearchParams({ action: 'profileUpd', email: me['Email'], data: JSON.stringify(upd) });
  busy(true);
  try {
    const res = await fetch(`${API_BASE}?${params}`, { method: 'GET' });
    const json = await res.json();
    busy(false);
    if (!json.success) {
      $('#profile-msg').textContent = json.error || 'Błąd aktualizacji profilu';
      return;
    }
    $('#profile-msg').textContent = json.message || 'Profil zaktualizowany';
    Object.assign(me, upd);
  } catch (err) {
    busy(false);
    $('#profile-msg').textContent = err.message;
  }
});

/*  ---- upload avatar ---- */
$('#avatar-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const params = new URLSearchParams({
      action: 'avatar',
      email: me['Email'],
      base64: ev.target.result
    });
    busy(true);
    try {
      const res = await fetch(`${API_BASE}?${params}`, { method: 'GET' });
      const json = await res.json();
      busy(false);
      if (!json.success) {
        $('#profile-msg').textContent = json.error || 'Błąd przesyłania avatara';
        return;
      }
      me['Zdjęcie (URL)'] = json.url;
      $('#avatar-img').src = json.url;
      $('#profile-msg').textContent = 'Avatar zaktualizowany';
    } catch (err) {
      busy(false);
      $('#profile-msg').textContent = err.message;
    }
  };
  reader.readAsDataURL(file);
});

/*  ---- usuń avatar ---- */
$('#btn-delete-avatar').addEventListener('click', async () => {
  if (!confirm('Usunąć avatar?')) return;
  const params = new URLSearchParams({ action: 'deleteAvatar', email: me['Email'] });
  busy(true);
  try {
    const res = await fetch(`${API_BASE}?${params}`, { method: 'GET' });
    const json = await res.json();
    busy(false);
    if (!json.success) {
      $('#profile-msg').textContent = json.error || 'Błąd usuwania avatara';
      return;
    }
    me['Zdjęcie (URL)'] = '';
    $('#avatar-img').src = 'https://via.placeholder.com/120';
    $('#profile-msg').textContent = 'Usunięto avatar';
  } catch (err) {
    busy(false);
    $('#profile-msg').textContent = err.message;
  }
});

/* =======================================================================
   3. Lata / podsumowanie / wpisy  (zakładka 2)
   ===================================================================== */
async function listYears () {
  const params = new URLSearchParams({ action: 'getYears' });
  try {
    const res = await fetch(`${API_BASE}?${params}`, { method: 'GET' });
    const json = await res.json();
    if (!json.success) {
      console.error(json.error || 'Błąd pobierania lat');
      return;
    }
    const years = json.data;
    const sel = $('#sel-year');
    sel.innerHTML = '<option value="" disabled selected>– Wybierz rok –</option>';
    years.forEach(y => sel.insertAdjacentHTML('beforeend',
      `<option value="${y}">${y}</option>`));
    M.FormSelect.init(sel);
  } catch (e) {
    console.error(e);
  }
}

$('#sel-year').addEventListener('change', e => {
  curYear = e.target.value;
  loadAnnualSummary();
  loadEntries();
});

/* ---- podsumowanie roku ---- */
async function loadAnnualSummary () {
  if (!curYear) return;
  const params = new URLSearchParams({ action: 'annual', year: curYear, email: me['Email'] });
  busy(true);
  try {
    const res = await fetch(`${API_BASE}?${params}`, { method: 'GET' });
    const json = await res.json();
    busy(false);
    if (!json.success) {
      console.error(json.error || 'Błąd pobierania podsumowania');
      return;
    }
    const data = json.data;
    $('#sum-crza').textContent   = data['CRZ-A'] || 0;
    $('#sum-crzb').textContent   = data['CRZ-B'] || 0;
    $('#sum-sup').textContent    = data['Superwizje'] || 0;
    $('#sum-fee').textContent    = data['Opłata za Rok'] || '–';
    $('#sum-pp').textContent     = data['CertPP'] || '–';
    $('#sum-cr').textContent     = data['Niekaralny'] || '–';
    $('#sum-active').textContent = data.active ? 'TAK' : 'NIE';
  } catch (e) {
    busy(false);
    console.error(e);
  }
}

/* ---- lista wpisów ---- */
async function loadEntries () {
  if (!curYear) return;
  const params = new URLSearchParams({ action: 'getEntries', year: curYear, email: me['Email'] });
  busy(true);
  try {
    const res = await fetch(`${API_BASE}?${params}`, { method: 'GET' });
    const json = await res.json();
    busy(false);
    if (!json.success) {
      console.error(json.error || 'Błąd pobierania wpisów');
      return;
    }
    const entries = json.data;
    const ul = $('#entry-list'); ul.innerHTML = '';
    if (!entries.length) {
      ul.innerHTML = '<li class="collection-item grey-text">Brak wpisów</li>';
    } else {
      entries.forEach(en => {
        ul.insertAdjacentHTML('beforeend', `
          <li class="collection-item" data-id="${en.id}">
            <span>${en.type} — ${en.title}</span>
            <span class="secondary-content">
              ${en.points ?? en.hours}
              <a href="${en.file}" target="_blank"><i class="fas fa-file-pdf"></i></a>
              <a href="#!" class="del-entry"><i class="fas fa-trash red-text"></i></a>
            </span>
          </li>`);
      });
    }
  } catch (e) {
    busy(false);
    console.error(e);
  }
}

/* ---- kasowanie wpisu ---- */
$('#entry-list').addEventListener('click', async e => {
  if (!e.target.closest('.del-entry')) return;
  const li = e.target.closest('li');
  const id = li.dataset.id;
  if (!confirm('Usunąć ten wpis?')) return;
  const params = new URLSearchParams({ action: 'deleteEntry', year: curYear, id, email: me['Email'] });
  busy(true);
  try {
    const res = await fetch(`${API_BASE}?${params}`, { method: 'GET' });
    const json = await res.json();
    busy(false);
    if (!json.success) {
      alert(json.error || 'Błąd usuwania wpisu');
      return;
    }
    li.remove();
    loadAnnualSummary();
  } catch (err) {
    busy(false);
    alert(err.message);
  }
});

/* ---- dodawanie wpisów ---- */
async function addEntry (type) {
  if (!curYear) return M.toast({ text: 'Wybierz rok', classes: 'red' });

  const title = prompt(`Opis ${type}:`);
  if (!title) return;
  const hours = +prompt('Ile godzin? (liczba)');
  if (!hours || hours <= 0) return;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const params = new URLSearchParams({
        action: 'addEntry',
        year: curYear,
        email: me['Email'],
        kind: type,
        hours,
        desc: title,
        base64: ev.target.result,
        fileName: file.name
      });
      busy(true);
      try {
        const res = await fetch(`${API_BASE}?${params}`, { method: 'GET' });
        const json = await res.json();
        busy(false);
        if (!json.success) {
          alert(json.error || 'Błąd dodawania wpisu');
          return;
        }
        loadAnnualSummary();
        loadEntries();
      } catch (err) {
        busy(false);
        alert(err.message);
      }
    };
    reader.readAsDataURL(file);
  };
  fileInput.click();
}

$('#btn-add-crza').onclick = () => addEntry('CRZ-A');
$('#btn-add-crzb').onclick = () => addEntry('CRZ-B');
$('#btn-add-sup').onclick  = () => addEntry('Superwizje');

/* =======================================================================
   4. INIT – Materialize zakładki
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () =>
  M.Tabs.init(document.querySelectorAll('.tabs')));
