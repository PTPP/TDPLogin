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

/* === JSONP wrapper for API calls ====================================== */
function apiCall(params, cbName, cb) {
  const query = new URLSearchParams({ ...params, callback: cbName });
  const script = document.createElement('script');
  script.src = `${API_BASE}?${query}`;
  window[cbName] = function(data) {
    cb(data);
    delete window[cbName];
    document.head.removeChild(script);
  };
  document.head.appendChild(script);
}

/* === global state ===================================================== */
let me      = null;   // profil zalogowanego użytkownika
let curYear = '';     // wybrany rok w zakładce 2

/* =======================================================================
   1. LOGOWANIE
   ===================================================================== */
$('#btn-login').addEventListener('click', () => {
  const email = $('#login-email').value.trim().toLowerCase();
  const pass  = $('#login-pass').value.trim();

  if (!email || pass.length < 6) {
    $('#login-error').textContent = 'Popraw email i hasło (≥6 znaków)';
    return;
  }
  $('#login-error').textContent = '';
  busy(true);
  apiCall(
    { action: 'login', email, password: pass },
    'onLoginResponse',
    function(data) {
      busy(false);
      if (data.error) {
        $('#login-error').textContent = data.error;
        return;
      }
      me = data;
      enterPanel();
    }
  );
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
$('#btn-save-profile').addEventListener('click', e => {
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
  busy(true);
  apiCall(
    { action: 'profileUpd', email: me['Email'], data: JSON.stringify(upd) },
    'onProfileUpdateResponse',
    function(data) {
      busy(false);
      if (data.error) {
        $('#profile-msg').textContent = data.error;
        return;
      }
      $('#profile-msg').textContent = 'Profil zaktualizowany';
      Object.assign(me, upd);
    }
  );
});

/*  ---- upload avatar ---- */
$('#avatar-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    busy(true);
    apiCall(
      { action: 'avatar', email: me['Email'], base64: ev.target.result },
      'onAvatarUploadResponse',
      function(data) {
        busy(false);
        if (data.error) {
          $('#profile-msg').textContent = data.error;
          return;
        }
        me['Zdjęcie (URL)'] = data;
        $('#avatar-img').src = data;
        $('#profile-msg').textContent = 'Avatar zaktualizowany';
      }
    );
  };
  reader.readAsDataURL(file);
});

/*  ---- usuń avatar ---- */
$('#btn-delete-avatar').addEventListener('click', () => {
  if (!confirm('Usunąć avatar?')) return;
  busy(true);
  apiCall(
    { action: 'deleteAvatar', email: me['Email'] },
    'onDeleteAvatarResponse',
    function(data) {
      busy(false);
      if (data.error) {
        $('#profile-msg').textContent = data.error;
        return;
      }
      me['Zdjęcie (URL)'] = '';
      $('#avatar-img').src = 'https://via.placeholder.com/120';
      $('#profile-msg').textContent = 'Usunięto avatar';
    }
  );
});

/* =======================================================================
   3. Lata / podsumowanie / wpisy  (zakładka 2)
   ===================================================================== */
function listYears () {
  apiCall(
    { action: 'getYears' },
    'onYearsResponse',
    function(data) {
      if (data.error) {
        console.error(data.error);
        return;
      }
      const years = data;
      const sel = $('#sel-year');
      sel.innerHTML = '<option value="" disabled selected>– Wybierz rok –</option>';
      years.forEach(y => sel.insertAdjacentHTML('beforeend',
        `<option value="${y}">${y}</option>`));
      M.FormSelect.init(sel);
    }
  );
}

$('#sel-year').addEventListener('change', e => {
  curYear = e.target.value;
  loadAnnualSummary();
  loadEntries();
});

/* ---- podsumowanie roku ---- */
function loadAnnualSummary () {
  if (!curYear) return;
  busy(true);
  apiCall(
    { action: 'annual', year: curYear, email: me['Email'] },
    'onAnnualSummaryResponse',
    function(data) {
      busy(false);
      if (data.error) {
        console.error(data.error);
        return;
      }
      $('#sum-crza').textContent   = data['CRZ-A'] || 0;
      $('#sum-crzb').textContent   = data['CRZ-B'] || 0;
      $('#sum-sup').textContent    = data['Superwizje'] || 0;
      $('#sum-fee').textContent    = data['Opłata za Rok'] || '–';
      $('#sum-pp').textContent     = data['CertPP'] || '–';
      $('#sum-cr').textContent     = data['Niekaralny'] || '–';
      $('#sum-active').textContent = data.active ? 'TAK' : 'NIE';
    }
  );
}

/* ---- lista wpisów ---- */
function loadEntries () {
  if (!curYear) return;
  busy(true);
  apiCall(
    { action: 'getEntries', year: curYear, email: me['Email'] },
    'onEntriesResponse',
    function(data) {
      busy(false);
      if (data.error) {
        console.error(data.error);
        return;
      }
      const entries = data;
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
    }
  );
}

/* ---- kasowanie wpisu ---- */
$('#entry-list').addEventListener('click', e => {
  if (!e.target.closest('.del-entry')) return;
  const li = e.target.closest('li');
  const id = li.dataset.id;
  if (!confirm('Usunąć ten wpis?')) return;
  busy(true);
  apiCall(
    { action: 'deleteEntry', year: curYear, id, email: me['Email'] },
    'onDeleteEntryResponse',
    function(data) {
      busy(false);
      if (data.error) {
        alert(data.error);
        return;
      }
      li.remove();
      loadAnnualSummary();
    }
  );
});

/* ---- dodawanie wpisów ---- */
function addEntry (type) {
  if (!curYear) return M.toast({ text: 'Wybierz rok', classes: 'red' });

  const title = prompt(`Opis ${type}:`);
  if (!title) return;
  const hours = +prompt('Ile godzin? (liczba)');
  if (!hours || hours <= 0) return;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      busy(true);
      apiCall(
        {
          action: 'addEntry',
          year: curYear,
          email: me['Email'],
          kind: type,
          hours,
          desc: title,
          base64: ev.target.result,
          fileName: file.name
        },
        'onAddEntryResponse',
        function(data) {
          busy(false);
          if (data.error) {
            alert(data.error);
            return;
          }
          loadAnnualSummary();
          loadEntries();
        }
      );
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
