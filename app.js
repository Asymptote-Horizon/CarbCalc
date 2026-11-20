(() => {
  'use strict';

  const STORAGE_KEY = 'carbcalc-v1';
  const FACTORS = Object.freeze({ petrol: 2.33, electricity: 0.82, waste: 0.63 });
  const DEMO_INPUTS = Object.freeze({ commuteKm: 12, mileage: 45, passengers: 1, electricityKwh: 120, occupants: 3, wasteKg: 0.25, noPetrol: false });
  const $ = (id) => document.getElementById(id);
  const num = (id, fallback = 0) => {
    const value = Number($(id).value);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  };
  const round = (value, digits = 2) => Number(value.toFixed(digits));
  const kg = (value) => `${round(value).toFixed(2)} kg`;
  const todayISO = () => {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };
  const formatDate = (date) => {
    const parsed = new Date(`${date}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  let saved = loadSaved();
  let currentTotals = null;
  let installPrompt = null;
  let toastTimeout = null;

  function defaultState() {
    return { inputs: { ...DEMO_INPUTS }, missions: {}, fieldNotes: [], history: [], darkMode: false };
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaultState();
      return {
        ...defaultState(),
        ...parsed,
        inputs: { ...DEMO_INPUTS, ...(parsed.inputs || {}) },
        missions: parsed.missions && typeof parsed.missions === 'object' ? parsed.missions : {},
        fieldNotes: Array.isArray(parsed.fieldNotes) ? parsed.fieldNotes : [],
        history: Array.isArray(parsed.history) ? parsed.history : []
      };
    } catch (_) {
      return defaultState();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (_) {
      showToast('This browser could not save locally. Export a backup to keep your records.');
    }
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 2900);
  }

  function readInputs() {
    return {
      commuteKm: Math.min(num('commuteKm'), 500),
      mileage: Math.max(num('mileage', 1), 1),
      passengers: Math.max(1, Math.round(num('passengers', 1))),
      electricityKwh: Math.min(num('electricityKwh'), 100000),
      occupants: Math.max(1, Math.round(num('occupants', 1))),
      wasteKg: Math.min(num('wasteKg'), 100),
      noPetrol: $('noPetrol').checked
    };
  }

  function calculate(input) {
    const transport = input.noPetrol ? 0 : (input.commuteKm / input.mileage / input.passengers) * FACTORS.petrol;
    const electricity = (input.electricityKwh / 30 / input.occupants) * FACTORS.electricity;
    const waste = input.wasteKg * FACTORS.waste;
    return { transport, electricity, waste, total: transport + electricity + waste };
  }

  function statusFor(total) {
    if (total < 6) return { label: 'GREEN ZONE', context: 'Project guide band', kind: 'green' };
    if (total <= 14) return { label: 'INTERMEDIATE', context: 'Project guide band', kind: 'intermediate' };
    return { label: 'DARK ZONE', context: 'Project guide band', kind: 'dark' };
  }

  function updateCalculator() {
    const input = readInputs();
    currentTotals = calculate(input);
    const { transport, electricity, waste, total } = currentTotals;
    const status = statusFor(total);
    $('dailyTotal').textContent = round(total).toFixed(2);
    $('monthlyTotal').innerHTML = `${round(total * 30).toFixed(2)} <small>kg CO₂</small>`;
    $('transportValue').textContent = kg(transport);
    $('electricityValue').textContent = kg(electricity);
    $('wasteValue').textContent = kg(waste);
    $('statusLabel').textContent = status.label;
    $('statusContext').textContent = status.context;
    $('statusDot').className = `status-dot ${status.kind === 'green' ? '' : status.kind}`;

    const max = Math.max(transport, electricity, waste, 0.001);
    $('transportBar').style.width = `${(transport / max) * 100}%`;
    $('electricityBar').style.width = `${(electricity / max) * 100}%`;
    $('wasteBar').style.width = `${(waste / max) * 100}%`;
    updateChoiceLab();
    return currentTotals;
  }

  function updateChoiceLab() {
    if (!currentTotals) return;
    const percent = Number($('reductionSlider').value);
    const savedAmount = currentTotals.transport * percent / 100;
    const after = currentTotals.total - savedAmount;
    $('reductionPercent').innerHTML = `${percent}<span>%</span>`;
    $('simCurrent').innerHTML = `${round(currentTotals.total).toFixed(2)} <small>kg</small>`;
    $('simAfter').innerHTML = `${round(after).toFixed(2)} <small>kg</small>`;
    $('simSaving').textContent = `${round(savedAmount).toFixed(2)} kg CO₂ / day`;
    $('simMonthlySaving').textContent = `${round(savedAmount * 30).toFixed(2)} kg over 30 days`;
    $('reductionSlider').style.background = `linear-gradient(90deg,#7c9a6a ${percent}%,#d5ded1 ${percent}%)`;
  }

  function fillInputs(inputs) {
    const merged = { ...DEMO_INPUTS, ...inputs };
    ['commuteKm', 'mileage', 'passengers', 'electricityKwh', 'occupants', 'wasteKg'].forEach((key) => {
      const element = $(key);
      const value = Number(merged[key]);
      if (Number.isFinite(value) && value >= 0) element.value = value;
    });
    $('noPetrol').checked = Boolean(merged.noPetrol);
    togglePetrolFields();
    saved.inputs = readInputs();
    persist();
    updateCalculator();
  }

  function togglePetrolFields() {
    const disabled = $('noPetrol').checked;
    ['commuteKm', 'mileage', 'passengers'].forEach((id) => { $(id).disabled = disabled; });
  }

  function saveSnapshot() {
    const input = readInputs();
    const totals = calculate(input);
    const record = {
      id: `${todayISO()}-${Date.now()}`,
      date: todayISO(),
      total: round(totals.total, 3),
      transport: round(totals.transport, 3),
      electricity: round(totals.electricity, 3),
      waste: round(totals.waste, 3),
      inputs: input
    };
    const existing = saved.history.findIndex((item) => item.date === record.date);
    if (existing >= 0) {
      record.id = saved.history[existing].id;
      saved.history[existing] = record;
      showToast("Today's snapshot was updated.");
    } else {
      saved.history.unshift(record);
      showToast("Today's snapshot has been saved on this device.");
    }
    saved.history = saved.history.slice(0, 60);
    saved.inputs = input;
    persist();
    renderHistory();
  }

  function renderHistory() {
    const list = $('historyList');
    list.innerHTML = '';
    const history = [...saved.history].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    $('historyCount').textContent = `${history.length} saved snapshot${history.length === 1 ? '' : 's'}`;
    $('historyEmpty').hidden = history.length > 0;
    history.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'history-entry';
      row.innerHTML = `<span>${escapeHtml(formatDate(item.date))}</span><strong>${Number(item.total).toFixed(2)} <small>kg CO₂ / day</small></strong><span>Petrol · ${Number(item.transport).toFixed(2)} kg</span><span>Power · ${Number(item.electricity).toFixed(2)} kg</span><button type="button" data-remove-snapshot="${escapeHtml(item.id)}" aria-label="Delete snapshot">Remove ×</button>`;
      list.appendChild(row);
    });
    list.querySelectorAll('[data-remove-snapshot]').forEach((button) => {
      button.addEventListener('click', () => {
        saved.history = saved.history.filter((item) => item.id !== button.dataset.removeSnapshot);
        persist();
        renderHistory();
        showToast('Snapshot removed.');
      });
    });
  }

  function renderMissions() {
    const boxes = [...document.querySelectorAll('[data-mission]')];
    let done = 0;
    boxes.forEach((box) => {
      const key = box.dataset.mission;
      box.checked = Boolean(saved.missions[key]);
      box.closest('.mission-item').classList.toggle('done', box.checked);
      if (box.checked) done += 1;
    });
    $('missionCount').textContent = done;
    $('missionProgressText').textContent = `${done} of 5 actions completed`;
    $('missionProgressBar').style.width = `${done / 5 * 100}%`;
  }

  function renderFieldNotes() {
    $('fieldNoteCount').textContent = saved.fieldNotes.length;
    const list = $('fieldNotesList');
    list.innerHTML = '';
    if (!saved.fieldNotes.length) {
      list.innerHTML = '<div class="empty-notes">Your saved observations will appear here.</div>';
      return;
    }
    saved.fieldNotes.slice(0, 5).forEach((note) => {
      const entry = document.createElement('div');
      entry.className = 'field-note-entry';
      entry.innerHTML = `<b>${escapeHtml(note.site)} · ${escapeHtml(note.type)}</b><small>${escapeHtml(formatDate(note.date))}${note.measurement ? ` · ${escapeHtml(note.measurement)}` : ''}</small><p>${escapeHtml(note.text)}</p><button type="button" data-remove-note="${escapeHtml(note.id)}" aria-label="Delete field note">Remove ×</button>`;
      list.appendChild(entry);
    });
    list.querySelectorAll('[data-remove-note]').forEach((button) => {
      button.addEventListener('click', () => {
        saved.fieldNotes = saved.fieldNotes.filter((note) => note.id !== button.dataset.removeNote);
        persist();
        renderFieldNotes();
        showToast('Field note removed.');
      });
    });
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportBackup() {
    saved.inputs = readInputs();
    persist();
    const backup = { app: 'CarbCalc', version: 1, exportedAt: new Date().toISOString(), ...saved };
    downloadFile(`carbcalc-backup-${todayISO()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    showToast('Your CarbCalc backup is ready.');
  }


  function csvEscape(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportHistoryCsv() {
    const headers = ['date', 'commute_km', 'mileage_kmpl', 'passengers', 'electricity_kwh_month', 'occupants', 'waste_kg_day', 'petrol_kg', 'electricity_kg', 'waste_kg', 'total_kg'];
    const lines = [headers.join(',')];
    [...saved.history].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((item) => {
      const input = item.inputs || {};
      const values = [item.date, input.commuteKm ?? '', input.mileage ?? '', input.passengers ?? '', input.electricityKwh ?? '', input.occupants ?? '', input.wasteKg ?? '', item.transport ?? '', item.electricity ?? '', item.waste ?? '', item.total ?? ''];
      lines.push(values.map(csvEscape).join(','));
    });
    downloadFile(`carbcalc-history-${todayISO()}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
    showToast('Snapshot history exported as CSV.');
  }

  function downloadCsvTemplate() {
    const header = 'date,commute_km,mileage_kmpl,passengers,electricity_kwh_month,occupants,waste_kg_day\n';
    downloadFile('carbcalc-import-template.csv', header, 'text/csv;charset=utf-8');
    showToast('CSV import template downloaded.');
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(cell); cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[i + 1] === '\n') i += 1;
        row.push(cell);
        if (row.some((value) => value.trim() !== '')) rows.push(row);
        row = []; cell = '';
      } else cell += char;
    }
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    return rows;
  }

  function importCsv(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error('The CSV has no activity rows.');
    const headers = rows[0].map((value) => value.trim().toLowerCase());
    const required = ['commute_km', 'mileage_kmpl', 'passengers', 'electricity_kwh_month', 'occupants', 'waste_kg_day'];
    const missing = required.filter((key) => !headers.includes(key));
    if (missing.length) throw new Error(`CSV template columns missing: ${missing.join(', ')}`);
    const get = (row, key, fallback) => {
      const index = headers.indexOf(key);
      const value = Number(row[index]);
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    };
    const imported = [];
    rows.slice(1).forEach((row, index) => {
      const dateIndex = headers.indexOf('date');
      const date = dateIndex >= 0 && /^\d{4}-\d{2}-\d{2}$/.test((row[dateIndex] || '').trim()) ? row[dateIndex].trim() : todayISO();
      const input = {
        commuteKm: get(row, 'commute_km', 0), mileage: Math.max(1, get(row, 'mileage_kmpl', 1)),
        passengers: Math.max(1, Math.round(get(row, 'passengers', 1))),
        electricityKwh: get(row, 'electricity_kwh_month', 0), occupants: Math.max(1, Math.round(get(row, 'occupants', 1))),
        wasteKg: get(row, 'waste_kg_day', 0), noPetrol: false
      };
      const totals = calculate(input);
      imported.push({ id: `csv-${date}-${Date.now()}-${index}`, date, total: round(totals.total, 3), transport: round(totals.transport, 3), electricity: round(totals.electricity, 3), waste: round(totals.waste, 3), inputs: input });
    });
    if (!imported.length) throw new Error('No usable rows were found in the CSV.');
    const newest = imported[imported.length - 1];
    fillInputs(newest.inputs);
    const byDate = new Map(saved.history.map((item) => [item.date, item]));
    imported.forEach((item) => byDate.set(item.date, item));
    saved.history = [...byDate.values()].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 60);
    persist();
    renderHistory();
    showToast(`${imported.length} CSV row${imported.length === 1 ? '' : 's'} imported.`);
  }

  function importJson(text) {
    const data = JSON.parse(text);
    if (!data || data.app !== 'CarbCalc' || !data.inputs) throw new Error('This does not look like a CarbCalc JSON backup.');
    saved = {
      ...defaultState(),
      ...data,
      inputs: { ...DEMO_INPUTS, ...data.inputs },
      missions: data.missions && typeof data.missions === 'object' ? data.missions : {},
      fieldNotes: Array.isArray(data.fieldNotes) ? data.fieldNotes : [],
      history: Array.isArray(data.history) ? data.history : []
    };
    fillInputs(saved.inputs);
    renderHistory();
    renderMissions();
    renderFieldNotes();
    document.body.classList.toggle('dark-mode', Boolean(saved.darkMode));
    persist();
    showToast('Backup restored on this device.');
  }

  async function handleImport(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const name = file.name.toLowerCase();
      if (name.endsWith('.csv')) importCsv(text);
      else if (name.endsWith('.json')) importJson(text);
      else throw new Error('Please choose a .csv or .json file.');
    } catch (error) {
      showToast(error.message || 'That file could not be imported.');
    }
    $('importFile').value = '';
  }

  async function shareSummary() {
    const totals = currentTotals || updateCalculator();
    const status = statusFor(totals.total).label;
    const message = `My CarbCalc estimate is ${round(totals.total).toFixed(2)} kg CO₂ per day (${status}). Breakdown: petrol ${round(totals.transport).toFixed(2)} kg, electricity ${round(totals.electricity).toFixed(2)} kg, waste ${round(totals.waste).toFixed(2)} kg. CarbCalc is a student project estimate using its stated starter factors.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My CarbCalc eco check-in', text: message });
        showToast('Share sheet opened.');
      } else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(message);
        showToast('Summary copied to clipboard.');
      } else {
        downloadFile('carbcalc-summary.txt', message, 'text/plain');
        showToast('Summary saved as a text file.');
      }
    } catch (error) {
      if (error && error.name !== 'AbortError') showToast('Sharing was not available in this browser.');
    }
  }

  function openFormulaModal() { $('formulaModal').hidden = false; $('formulaClose').focus(); }
  function closeFormulaModal() { $('formulaModal').hidden = true; $('formulaOpen').focus(); }

  function bindEvents() {
    ['commuteKm', 'mileage', 'passengers', 'electricityKwh', 'occupants', 'wasteKg'].forEach((id) => {
      $(id).addEventListener('input', () => {
        saved.inputs = readInputs();
        persist();
        updateCalculator();
      });
    });
    $('noPetrol').addEventListener('change', () => {
      togglePetrolFields();
      saved.inputs = readInputs();
      persist();
      updateCalculator();
    });
    $('resetInputs').addEventListener('click', () => { fillInputs(DEMO_INPUTS); showToast('Demo values restored.'); });
    $('reductionSlider').addEventListener('input', updateChoiceLab);
    $('saveSnapshot').addEventListener('click', saveSnapshot);
    $('formulaOpen').addEventListener('click', openFormulaModal);
    $('formulaClose').addEventListener('click', closeFormulaModal);
    $('formulaModal').addEventListener('click', (event) => { if (event.target === $('formulaModal')) closeFormulaModal(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('formulaModal').hidden) closeFormulaModal(); });
    $('howItWorks').addEventListener('click', () => $('calculator').scrollIntoView({ behavior: 'smooth' }));
    document.querySelectorAll('[data-mission]').forEach((box) => {
      box.addEventListener('change', () => {
        saved.missions[box.dataset.mission] = box.checked;
        persist();
        renderMissions();
      });
    });
    $('fieldForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const note = {
        id: `note-${Date.now()}`,
        site: $('siteName').value.trim(), type: $('observationType').value,
        measurement: $('measurement').value.trim(), date: $('observationDate').value,
        text: $('observationText').value.trim()
      };
      if (!note.site || !note.date || !note.text) return;
      saved.fieldNotes.unshift(note);
      saved.fieldNotes = saved.fieldNotes.slice(0, 100);
      persist();
      renderFieldNotes();
      $('fieldForm').reset();
      $('observationDate').value = todayISO();
      showToast('Field note saved privately on this device.');
    });
    $('importTrigger').addEventListener('click', () => $('importFile').click());
    $('importFile').addEventListener('change', (event) => handleImport(event.target.files[0]));
    $('exportTrigger').addEventListener('click', exportBackup);
    $('exportCsvTrigger').addEventListener('click', exportHistoryCsv);
    $('templateTrigger').addEventListener('click', downloadCsvTemplate);
    $('shareTrigger').addEventListener('click', shareSummary);
    $('themeToggle').addEventListener('click', () => {
      saved.darkMode = !document.body.classList.contains('dark-mode');
      document.body.classList.toggle('dark-mode', saved.darkMode);
      persist();
    });
    $('menuToggle').addEventListener('click', () => {
      const open = $('main-nav').classList.toggle('open');
      $('menuToggle').setAttribute('aria-expanded', String(open));
    });
    document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => {
      $('main-nav').classList.remove('open');
      $('menuToggle').setAttribute('aria-expanded', 'false');
    }));
  }

  function registerPwa() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      installPrompt = event;
      $('installBtn').hidden = false;
    });
    $('installBtn').addEventListener('click', async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      $('installBtn').hidden = true;
    });
  }

  function init() {
    fillInputs(saved.inputs);
    $('observationDate').value = todayISO();
    document.body.classList.toggle('dark-mode', Boolean(saved.darkMode));
    renderMissions();
    renderFieldNotes();
    renderHistory();
    updateCalculator();
    bindEvents();
    registerPwa();
  }

  init();
})();
