/* ==== helpers ========================================================= */
const $  = (q, p = document) => p.querySelector(q);
const $$ = (q, p = document) => [...p.querySelectorAll(q)];

const spinner = $('#spinner');
const busy = (on = true) =>
  (spinner.style.display = on ? 'flex' : 'none');

/* ==== global state ==================================================== */
let me      = null;   // obiekt profilu zwrócony z GS
let curYear = '';     // wybrany rok

/* ==== LOGOWANIE ======================================================= */
$('#btn-login').addEventListener('click', () => {
  const email = $('#login-email').value.trim().toLowerCase();
  const pass  = $('#login-pass').value.trim();

  if (!email || pass.length < 6) {
    $('#login-error').textContent = 'Popraw email i hasło (≥6 znaków)';
    return;
  }
  $('#login-error').textContent = '';
  busy(true);

  google.script.run
    .withSuccessHandler(user => {
      busy(false);
      me = user;
      if (!user) {
        $('#login-error').textContent = 'Błędne dane logowania';
        return;
      }
      enterPanel();
    })
    .withFailureHandler(err => {
      busy(false);
      $('#login-error').textContent = err.message || err;
    })
    .loginUser(email, pass);   //  ⇦ Code.gs
});

/* ==== PANEL  – po udanym logowaniu ==================================== */
function enterPanel () {
  $('#login-card').style.display = 'none';
  $('#navbar').style.display     = 'block';
  $('#panel').style.display      = 'block';

  fillProfileCard();
  listYears();
}

/* ---- profil (zakładka 1) -------------------------------------------- */
function fillProfileCard () {
  $('#prof-name').textContent    = `${me.firstName} ${me.lastName}`;
  $('#prof-spec-no').textContent = me.specNumber
    ? `Numer ID: ${me.specNumber}` : '';
  $('#prof-level').textContent   = me.level ? `Poziom: ${me.level}` : '';
  $('#prof-specializations').textContent = me.specs || '';
  $('#avatar-img').src           = me.avatar || 'https://via.placeholder.com/120';

  // wypełnij edytowalne pola
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

/* ---- zapisz profil --------------------------------------------------- */
$('#btn-save-profile').addEventListener('click', e => {
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
  busy(true);
  google.script.run
    .withSuccessHandler(msg => {
      busy(false);
      $('#profile-msg').textContent = msg;
      Object.assign(me, upd);              // lokalnie odśwież
    })
    .withFailureHandler(err => {
      busy(false);
      $('#profile-msg').textContent = err.message || err;
    })
    .saveProfile(upd);                     // ⇦ Code.gs
});

/* ---- upload avatar --------------------------------------------------- */
$('#avatar-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    const base64 = ev.target.result.split(',')[1];     // bez nagłówka
    busy(true);
    google.script.run
      .withSuccessHandler(url => {
        busy(false);
        me.avatar = url;
        $('#avatar-img').src = url;
        $('#profile-msg').textContent = 'Avatar zaktualizowany';
      })
      .withFailureHandler(err => {
        busy(false);
        $('#profile-msg').textContent = err.message || err;
      })
      .uploadAvatar(base64, file.name);                // ⇦ Code.gs
  };
  reader.readAsDataURL(file);
});

/* ---- usuń avatar ----------------------------------------------------- */
$('#btn-delete-avatar').addEventListener('click', () => {
  if (!confirm('Usunąć avatar?')) return;
  busy(true);
  google.script.run
    .withSuccessHandler(() => {
      busy(false);
      me.avatar = '';
      $('#avatar-img').src = 'https://via.placeholder.com/120';
      $('#profile-msg').textContent = 'Usunięto avatar';
    })
    .withFailureHandler(err => {
      busy(false);
      $('#profile-msg').textContent = err.message || err;
    })
    .deleteAvatar();                               // ⇦ Code.gs
});

/* ==== ROKI i PODSUMOWANIE (tab 2) ==================================== */
function listYears () {
  google.script.run
    .withSuccessHandler(years => {
      const sel = $('#sel-year');
      sel.innerHTML = '<option value="" disabled selected>– Wybierz rok –</option>';
      years.forEach(y => sel.insertAdjacentHTML('beforeend',
        `<option value="${y}">${y}</option>`));
      M.FormSelect.init(sel);
    })
    .getYears();                                       // ⇦ Code.gs
}

$('#sel-year').addEventListener('change', e => {
  curYear = e.target.value;
  loadAnnualSummary();
  loadEntries();
});

/* -- podsumowanie roku ------------------------------------------------- */
function loadAnnualSummary () {
  if (!curYear) return;
  busy(true);
  google.script.run
    .withSuccessHandler(sum => {
      busy(false);
      $('#sum-crza').textContent     = sum.crza   || 0;
      $('#sum-crzb').textContent     = sum.crzb   || 0;
      $('#sum-sup').textContent      = sum.sup    || 0;
      $('#sum-fee').textContent      = sum.fee    || '–';
      $('#sum-pp').textContent       = sum.pp     || '–';
      $('#sum-cr').textContent       = sum.cr     || '–';
      $('#sum-active').textContent   = sum.active ? 'TAK' : 'NIE';
    })
    .withFailureHandler(err => { busy(false); console.error(err); })
    .getAnnualSummary(curYear);                        // ⇦ Code.gs
}

/* -- lista wpisów ------------------------------------------------------ */
function loadEntries () {
  if (!curYear) return;
  busy(true);
  google.script.run
    .withSuccessHandler(entries => {
      busy(false);
      const ul = $('#entry-list'); ul.innerHTML = '';
      if (!entries.length) {
        ul.innerHTML = '<li class="collection-item grey-text">Brak wpisów</li>';
        return;
      }
      entries.forEach(en => {
        ul.insertAdjacentHTML('beforeend', `
          <li class="collection-item" data-id="${en.id}">
            <span>${en.type} — ${en.title}</span>
            <span class="secondary-content">
              ${en.points || en.hours}
              <a href="${en.file}" target="_blank"><i class="fas fa-file-pdf"></i></a>
              <a href="#!" class="del-entry"><i class="fas fa-trash red-text"></i></a>
            </span>
          </li>`);
      });
    })
    .withFailureHandler(err => { busy(false); console.error(err); })
    .getEntries(curYear);                              // ⇦ Code.gs
}

/* -- kasowanie wpisu --------------------------------------------------- */
$('#entry-list').addEventListener('click', e => {
  if (!e.target.closest('.del-entry')) return;
  const li = e.target.closest('li');
  const id = li.dataset.id;
  if (!confirm('Usunąć ten wpis?')) return;
  busy(true);
  google.script.run
    .withSuccessHandler(() => { busy(false); li.remove(); loadAnnualSummary(); })
    .withFailureHandler(err => { busy(false); alert(err.message || err); })
    .deleteEntry(curYear, id);                         // ⇦ Code.gs
});

/* -- dodawanie wpisów (prosty prompt) ---------------------------------- */
function addEntry(type) {
  if (!curYear) return M.toast({text:'Wybierz rok', classes:'red'});
  const title = prompt(`Opis ${type}:`);
  if (!title) return;
  const hours = +prompt('Ile godzin? (liczba)');
  if (!hours || hours <= 0) return;

  const fileInput = document.createElement('input');
  fileInput.type = 'file'; fileInput.accept = 'application/pdf';
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      busy(true);
      google.script.run
        .withSuccessHandler(() => { busy(false); loadSummaryAndList(); })
        .withFailureHandler(err => { busy(false); alert(err.message || err); })
        .addEntry(curYear, type, title, hours, ev.target.result.split(',')[1], file.name);
    };
    reader.readAsDataURL(file);
  };
  fileInput.click();
}

const loadSummaryAndList = () => { loadAnnualSummary(); loadEntries(); };

$('#btn-add-crza').onclick = () => addEntry('CRZ-A');
$('#btn-add-crzb').onclick = () => addEntry('CRZ-B');
$('#btn-add-sup').onclick  = () => addEntry('SUP');

/* ==== INIT (Materialize zakładki) ===================================== */
document.addEventListener('DOMContentLoaded',
  () => M.Tabs.init(document.querySelectorAll('.tabs')));
