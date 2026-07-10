/* ================= MOBILE NAV ================= */
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');
hamburger.addEventListener('click', () => mobileNav.classList.toggle('open'));
mobileNav.querySelectorAll('a').forEach(a =>
  a.addEventListener('click', () => mobileNav.classList.remove('open'))
);

/* ================= DOCUMENTS MODAL =================
   Drop your actual files into the /documents folder using
   these exact names, and the buttons will display them:
     documents/moa.pdf         -> Memorandum of Agreement
     documents/loi.pdf         -> Letter of Intent
     documents/loe.pdf         -> Letter of Endorsement
     documents/waiver.pdf      -> Student Waiver
     documents/consent.pdf     -> Consent Form
     documents/agreement.pdf   -> Internship Agreement
======================================================= */
const DOCS = {
  moa:       { title: 'Memorandum of Agreement', file: 'documents/moa.pdf' },
  loi:       { title: 'Letter of Intent',          file: 'documents/loi.pdf' },
  loe:       { title: 'Letter of Endorsement',     file: 'documents/loe.pdf' },
  waiver:    { title: 'Student Waiver',            file: 'documents/waiver.pdf' },
  consent:   { title: 'Consent Form',              file: 'documents/consent.pdf' },
  agreement: { title: 'Internship Agreement',      file: 'documents/agreement.pdf' },
};

const docModal = document.getElementById('docModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');

document.querySelectorAll('.file-tab').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key = btn.dataset.doc;
    const doc = DOCS[key];
    modalTitle.textContent = doc.title;
    modalBody.innerHTML = '<p class="modal-missing">Checking for the file…</p>';
    docModal.classList.add('open');

    let exists = false;
    try {
      const res = await fetch(doc.file, { method: 'HEAD' });
      exists = res.ok;
    } catch (e) {
      exists = false;
    }

    if (exists) {
      modalBody.innerHTML = `<iframe src="${doc.file}" title="${doc.title}"></iframe>`;
    } else {
      modalBody.innerHTML = `
        <div class="modal-missing">
          <p>This file isn't uploaded yet.</p>
          <p>Add your PDF at <code>${doc.file}</code> in the project folder,
          keeping that exact name, and it'll show up here automatically.</p>
        </div>`;
    }
  });
});

modalClose.addEventListener('click', () => docModal.classList.remove('open'));
docModal.addEventListener('click', (e) => {
  if (e.target === docModal) docModal.classList.remove('open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') docModal.classList.remove('open');
});

/* ================= PROGRESS / MUG ================= */
const TOTAL_HOURS = 300;
const HOURS_PER_WEEK = 40; // 300 hrs / 40 hrs per week = 7.5 weeks
const hoursInput = document.getElementById('hoursLogged');
const weeksDoneEl = document.getElementById('weeksDone');
const weeksLeftEl = document.getElementById('weeksLeft');
const percentDoneEl = document.getElementById('percentDone');
const coffeeFill = document.getElementById('coffeeFill');

const MUG_TOP = 40;    // y where liquid can start filling from
const MUG_BOTTOM = 220; // y at the very bottom of the mug interior

function renderProgress() {
  let hours = parseFloat(hoursInput.value) || 0;
  hours = Math.max(0, Math.min(TOTAL_HOURS, hours));

  const percent = hours / TOTAL_HOURS;
  const weeksDone = (hours / HOURS_PER_WEEK);
  const weeksLeft = ((TOTAL_HOURS - hours) / HOURS_PER_WEEK);

  weeksDoneEl.textContent = weeksDone.toFixed(1);
  weeksLeftEl.textContent = Math.max(0, weeksLeft).toFixed(1);
  percentDoneEl.textContent = Math.round(percent * 100) + '%';

  const fillHeight = percent * (MUG_BOTTOM - MUG_TOP);
  coffeeFill.setAttribute('height', fillHeight.toFixed(1));
  coffeeFill.setAttribute('y', (MUG_BOTTOM - fillHeight).toFixed(1));
}

hoursInput.addEventListener('input', () => {
  localStorage.setItem('ojt_hoursLogged', hoursInput.value);
  renderProgress();
});

const savedHours = localStorage.getItem('ojt_hoursLogged');
if (savedHours !== null) hoursInput.value = savedHours;
renderProgress();

/* ================= WEEKLY LOG ================= */
const logForm = document.getElementById('logForm');
const logEntries = document.getElementById('logEntries');
const emptyState = document.getElementById('emptyState');
const photoInput = document.getElementById('photoInput');

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem('ojt_entries') || '[]');
  } catch (e) {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem('ojt_entries', JSON.stringify(entries));
}

function filesToDataURLs(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(files.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

function renderEntries() {
  const entries = loadEntries().sort((a, b) => b.week - a.week);
  logEntries.innerHTML = '';

  if (entries.length === 0) {
    logEntries.appendChild(emptyState);
    return;
  }

  entries.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'log-entry';

    const activitiesList = entry.activities
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => `<li>${escapeHTML(line)}</li>`)
      .join('');

    const photosHTML = (entry.photos || [])
      .map(src => `<div class="polaroid"><img src="${src}" alt="Week ${entry.week} activity photo"></div>`)
      .join('');

    card.innerHTML = `
      <button class="entry-delete" data-id="${entry.id}">delete</button>
      <div class="entry-header">
        <span class="entry-week">Week ${entry.week}</span>
        <span class="entry-dates">${escapeHTML(entry.dateRange)}</span>
      </div>
      <ul class="entry-activities">${activitiesList}</ul>
      <div class="entry-photos">${photosHTML}</div>
    `;
    logEntries.appendChild(card);
  });

  logEntries.querySelectorAll('.entry-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const remaining = loadEntries().filter(e => String(e.id) !== id);
      saveEntries(remaining);
      renderEntries();
    });
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

logForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const week = parseInt(document.getElementById('weekNumber').value, 10);
  const dateRange = document.getElementById('dateRange').value;
  const activities = document.getElementById('activities').value;
  const photos = await filesToDataURLs(photoInput.files);

  const entries = loadEntries();
  entries.push({ id: Date.now(), week, dateRange, activities, photos });
  saveEntries(entries);

  logForm.reset();
  renderEntries();
  document.getElementById(`log`).scrollIntoView({ behavior: 'smooth', block: 'start' });
});

renderEntries();
