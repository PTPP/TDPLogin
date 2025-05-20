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

/* === simple wrapper around fetch() ==================================== */
async function api (action, params = {}, body = null) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const opts = body
    ? { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) }
    : { method: 'GET' };

  const res  = await fetch(url, opts);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Błąd API');
  return json.data;
}

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
  try {
    busy(true);
    me = await api('loginUser', { email, pass });
    enterPanel();
  } catch (e) {
    $('#login-error').textContent = e.message;
  } finally { busy(false); }
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
  $('#prof-name').textContent    = `${me.firstName} ${me.lastName}`;
  $('#prof-spec-no').textContent = me.specNumber ? `Numer ID: ${me.specNumber}` : '';
  $('#prof-level').textContent   = me.level ? `Poziom: ${me.level}` : '';
  $('#prof-specializations').textContent = me.specs || '';
  $('#avatar-img').src           = me.avatar || 'https://via.placeholder.com/120';

  $('#f-phone-private').value    = me.phonePrivate  || '';
  $('#f-phone-reg').value        = me.phoneReg      || '';
  $('#f-email-login').value      = me.email         || '';
  $('#f-email-public').value     = me.emailPublic   || '';
  $('#f-city').value             = me.city          || '';
  $('#f-zip').value              = me.zip           || '';
  $('#f-street').value           = me.street        || '';
  $('#f-bio').value              = me.bio           || '';
  M.updateTextFields();
}

/*  ---- zapisz profil ---- */
$('#btn-save-profile').addEventListener('click', async e => {
  e.preventDefault();
  const upd = {
    phonePrivate : $('#f-phone-private').value.trim(),
    phoneReg     : $('#f-phone-reg').value.trim(),
    email        : $('#f-email-login').value.trim().toLowerCase(),
    emailPublic  : $('#f-email-public').value.trim(),
    city         : $('#f-city').value.trim(),
    zip          : $('#f-zip').value.trim(),
    street       : $('#f-street').value.trim(),
    bio          : $('#f-bio').value.trim()
  };
  try {
    busy(true);
    const msg = await api('saveProfile', {}, upd);
    $('#profile-msg').textContent = msg;
    Object.assign(me, upd);
  } catch (e) {
    $('#profile-msg').textContent = e.message;
  } finally { busy(false); }
});

/*  ---- upload avatar ---- */
$('#avatar-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      busy(true);
      const url = await api(
        'uploadAvatar',
        { fileName: file.name },
        { base64: ev.target.result.split(',')[1] }
      );
      me.avatar = url;
      $('#avatar-img').src = url;
      $('#profile-msg').textContent = 'Avatar zaktualizowany';
    } catch (err) {
      $('#profile-msg').textContent = err.message;
    } finally { busy(false); }
  };
  reader.readAsDataURL(file);
});

/*  ---- usuń avatar ---- */
$('#btn-delete-avatar').addEventListener('click', async () => {
  if (!confirm('Usunąć avatar?')) return;
  try {
    busy(true);
    await api('deleteAvatar');
    me.avatar = '';
    $('#avatar-img').src = 'https://via.placeholder.com/120';
    $('#profile-msg').textContent = 'Usunięto avatar';
  } catch (e) {
    $('#profile-msg').textContent = e.message;
  } finally { busy(false); }
});

/* =======================================================================
   3. Lata / podsumowanie / wpisy  (zakładka 2)
   ===================================================================== */
async function listYears () {
  try {
    const years = await api('getYears');
    const sel = $('#sel-year');
    sel.innerHTML = '<option value="" disabled selected>– Wybierz rok –</option>';
    years.forEach(y => sel.insertAdjacentHTML('beforeend',
      `<option value="${y}">${y}</option>`));
    M.FormSelect.init(sel);
  } catch (e) { console.error(e); }
}

$('#sel-year').addEventListener('change', e => {
  curYear = e.target.value;
  loadAnnualSummary();
  loadEntries();
});

/* ---- podsumowanie roku ---- */
async function loadAnnualSummary () {
  if (!curYear) return;
  try {
    busy(true);
    const sum = await api('getAnnualSummary', { year: curYear });
    $('#sum-crza').textContent   = sum.crza   || 0;
    $('#sum-crzb').textContent   = sum.crzb   || 0;
    $('#sum-sup').textContent    = sum.sup    || 0;
    $('#sum-fee').textContent    = sum.fee    || '–';
    $('#sum-pp').textContent     = sum.pp     || '–';
    $('#sum-cr').textContent     = sum.cr     || '–';
    $('#sum-active').textContent = sum.active ? 'TAK' : 'NIE';
  } catch (e) { console.error(e); }
  finally { busy(false); }
}

/* ---- lista wpisów ---- */
async function loadEntries () {
  if (!curYear) return;
  try {
    busy(true);
    const entries = await api('getEntries', { year: curYear });
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
  } catch (e) { console.error(e); }
  finally { busy(false); }
}

/* ---- kasowanie wpisu ---- */
$('#entry-list').addEventListener('click', async e => {
  if (!e.target.closest('.del-entry')) return;
  const li = e.target.closest('li');
  const id = li.dataset.id;
  if (!confirm('Usunąć ten wpis?')) return;
  try {
    busy(true);
    await api('deleteEntry', { year: curYear, id });
    li.remove();
    loadAnnualSummary();
  } catch (err) {
    alert(err.message);
  } finally { busy(false); }
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
      try {
        busy(true);
        await api(
          'addEntry',
          { year: curYear },
          {
            type, title, hours,
            base64: ev.target.result.split(',')[1],
            fileName: file.name
          }
        );
        loadAnnualSummary();
        loadEntries();
      } catch (err) {
        alert(err.message);
      } finally { busy(false); }
    };
    reader.readAsDataURL(file);
  };
  fileInput.click();
}

$('#btn-add-crza').onclick = () => addEntry('CRZ-A');
$('#btn-add-crzb').onclick = () => addEntry('CRZ-B');
$('#btn-add-sup').onclick  = () => addEntry('SUP');

/* =======================================================================
   4. INIT – Materialize zakładki
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () =>
  M.Tabs.init(document.querySelectorAll('.tabs')));
