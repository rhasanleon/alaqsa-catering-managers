(() => {
  'use strict';

  const STORAGE = {
    events: 'alaqsa.events.v1',
    invoices: 'alaqsa.invoices.v1',
    budgets: 'alaqsa.budgets.v1',
    catalog: 'alaqsa.catalog.v1',
    settings: 'alaqsa.settings.v1',
    connection: 'alaqsa.connection.v1'
  };

  const DEFAULT_SETTINGS = {
    businessName: 'Al-Aqsa Catering Center',
    businessPhone: '',
    businessAddress: '',
    currency: 'BDT',
    locale: 'en-BD'
  };

  const MENUS = [
    'ডাল (পাতলা)', 'মাছের তরকারি', 'সবজির তরকারি', 'মাংসের তরকারি', 'গোশত',
    'ডিম', 'দুধ/দই', 'সালাদ', 'মিষ্টি', 'পানি (মিনারেল)', 'টিস্যু', 'পেপার/পলিথিন'
  ];

  // Transcribed from the catering register. Catalog names remain editable in the app.
  const DEFAULT_NAMES = [
    'টাইম (টিস্যু)', 'ডিশার মি', 'সরিষার তেল', 'সয়াবিন তেল', 'পেঁয়াজ', 'আদা', 'রসুন',
    'শুকনা মরিচ গুঁড়া', 'হলুদ গুঁড়া', 'ধনিয়া গুঁড়া', 'জিরা আস্ত', 'এলাচি', 'দারুচিনি', 'লবঙ্গ',
    'জয়ফল', 'জয়ত্রী', 'আলু বোখারা', 'কিসমিস', 'মুগ ডাল', 'শাহী জিরা', 'গোলাপ জল', 'কেওড়া জল',
    'জাফরান', 'মসুর ডাল', 'বুটের ডাল', 'পোলাও চাল', 'কটি বাদাম', 'সরিষা (সাদা)',
    'পোলাও মরিচ (সাদা)', 'চিনি', 'বিট লবণ', 'দুধ', 'দুধ (উত্তমা)', 'মোরব্বা', 'টমেটো সস',
    'চিনি বাদাম', 'ময়দা', 'আটা', 'মেওয়ার গুঁড়া', 'টেস্টিং সল্ট', 'সালাদ', 'এনজাইম', 'লেবু (বড়)',
    'সাবান (মিনি)', 'সাবান (বড়)', 'টোস্ট বিস্কুট', 'ন্যাপকিন পেপার', 'মশকটি', 'ময়দার পেপার',
    'পাট ফ্লেক্স', 'মটর গোশত', 'খাসির গোশত', 'দেশী সোয়াবিন', 'আলুর তরকারি', 'চিনি', 'মাছ',
    'মটর', 'মালাই', 'টক দই', 'পনির', 'সুগন্ধি ডিম', 'কনডেন্স/খামালস', 'নারিকেল', 'আলু',
    'জিরা/শাহী', 'টমেটো', 'বিট', 'গাজর', 'পুদিনা পাতা', 'কাঁচা মরিচ', 'মটর ডাল', 'বরবটি',
    'টমেটো', 'চিচিঙ্গা', 'লেবু (বড়)', 'পেঁপে', 'পায়েস', 'মাসালা মসলা', 'তেজপাতা', 'মেওয়া',
    'টুকরা', 'মাস্টার (পোলাও)', 'কেরোসিন', 'বরফ', 'ন্যাপকিন কটি', 'ধনিয়া পাতা', 'কলমা',
    'খাবার টিস্যু', 'তেঁতুল', 'মাটির খোরা', 'পান গোশত'
  ];

  const UNIT_OPTIONS = ['kg', 'g', 'liter', 'ml', 'pcs', 'packet', 'box', 'dozen', 'bag', 'tray', 'other'];

  const state = {
    events: loadJSON(STORAGE.events, []),
    invoices: loadJSON(STORAGE.invoices, []),
    budgets: loadJSON(STORAGE.budgets, {}),
    catalog: loadJSON(STORAGE.catalog, null) || makeDefaultCatalog(),
    settings: { ...DEFAULT_SETTINGS, ...loadJSON(STORAGE.settings, {}) },
    connection: { url: '', key: '', ...loadJSON(STORAGE.connection, {}) },
    eventItems: [],
    customMenus: [],
    invoiceItems: [],
    invoicePayments: [],
    syncBusy: false
  };

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindNavigation();
    bindDashboard();
    bindEventForm();
    bindInvoice();
    bindHistory();
    bindCatalog();
    bindSettings();
    renderMenuChips();
    applySettingsToUI();
    setDefaultMonthAndDate();
    resetEventForm(false);
    resetInvoiceForm(false);
    renderAll();
    updateSyncStatus('offline');
    if (state.connection.url) loadFromSheet({ silent: true });
  }

  function bindNavigation() {
    $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
    $$('[data-go]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.go)));
    $('quickNewEvent').addEventListener('click', () => { resetEventForm(); showView('event'); });
    $('quickInvoice').addEventListener('click', () => { resetInvoiceForm(); showView('invoice'); });
    $('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  }

  function showView(name) {
    const meta = {
      dashboard: ['Dashboard', 'Event costs, budgets, and monthly overview'],
      event: ['Event Entry', 'Enter menu, product quantities, and prices'],
      invoice: ['Invoice Generator', 'Create invoices, record partial payments, and track client dues'],
      history: ['Previous Events', 'Reuse, edit, itemize, or print previous events'],
      catalog: ['Item Catalog', 'Maintain the catering center product list'],
      settings: ['Settings', 'Google Sheets connection, business settings, and backup']
    };
    $$('.view').forEach(v => v.classList.remove('active'));
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $(`view-${name}`).classList.add('active');
    $('pageTitle').textContent = meta[name][0];
    $('pageSubtitle').textContent = meta[name][1];
    $('sidebar').classList.remove('open');
    if (name === 'dashboard') renderDashboard();
    if (name === 'invoice') renderInvoices();
    if (name === 'history') renderHistory();
    if (name === 'catalog') renderCatalog();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindDashboard() {
    $('dashboardMonth').addEventListener('change', renderDashboard);
    $('saveMonthBudget').addEventListener('click', saveMonthlyBudget);
    $('exportMonthCsv').addEventListener('click', exportMonthCsv);
    $('recentEventsBody').addEventListener('click', handleEventActionClick);
    $('recentInvoicesBody').addEventListener('click', handleInvoiceActionClick);
  }

  function bindEventForm() {
    $('eventForm').addEventListener('submit', saveEventFromForm);
    $('eventBudget').addEventListener('input', updateEventSummary);
    $('resetEventBtn').addEventListener('click', () => resetEventForm());
    $('clearMenuBtn').addEventListener('click', clearEventMenu);
    $('addCustomMenuBtn').addEventListener('click', addCustomMenuItems);
    $('customMenuInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomMenuItems();
      }
    });
    $('menuChips').addEventListener('click', onMenuChipsClick);
    $('itemSearch').addEventListener('input', renderEventItems);
    $('itemFilter').addEventListener('change', renderEventItems);
    $('addCustomItem').addEventListener('click', addCustomEventItem);
    $('printCurrentBtn').addEventListener('click', printCurrentForm);
    $('eventItemsBody').addEventListener('input', onItemTableInput);
    $('eventItemsBody').addEventListener('change', onItemTableInput);
    $('eventItemsBody').addEventListener('click', onItemTableClick);
  }

  function bindInvoice() {
    $('invoiceForm').addEventListener('submit', saveInvoiceFromForm);
    $('resetInvoiceBtn').addEventListener('click', () => resetInvoiceForm());
    $('printInvoiceBtn').addEventListener('click', printCurrentInvoice);
    $('addInvoiceMenuRow').addEventListener('click', () => addInvoiceItem());
    $('invoiceItemsBody').addEventListener('input', onInvoiceItemInput);
    $('invoiceItemsBody').addEventListener('click', onInvoiceItemClick);
    $('invoiceEventDate').addEventListener('change', () => {
      if (!$('invoiceId').value) $('invoiceOrderNo').value = nextInvoiceOrderNo($('invoiceEventDate').value);
    });
    $('loadInvoiceEventBtn').addEventListener('click', loadSavedEventIntoInvoice);
    $('invoiceSearch').addEventListener('input', renderInvoiceHistory);
    $('invoiceMonth').addEventListener('change', renderInvoiceHistory);
    $('invoiceHistoryList').addEventListener('click', handleInvoiceActionClick);
    $('exportInvoiceCsv').addEventListener('click', exportInvoiceCsv);
    $('recordPaymentBtn').addEventListener('click', recordPaymentFromForm);
    $('paymentHistoryBody').addEventListener('click', handlePaymentHistoryClick);
    $('invoiceDueDate').addEventListener('change', updatePaymentSummary);
    $('invoiceClientEmail').addEventListener('input', updatePaymentEmailHint);
  }

  function bindHistory() {
    $('historySearch').addEventListener('input', renderHistory);
    $('historyMonth').addEventListener('change', renderHistory);
    $('historyList').addEventListener('click', handleEventActionClick);
  }

  function bindCatalog() {
    $('catalogSearch').addEventListener('input', renderCatalog);
    $('catalogAddBtn').addEventListener('click', () => {
      const next = Math.max(0, ...state.catalog.map(i => Number(i.no) || 0)) + 1;
      state.catalog.push({ id: uid(), no: next, name: `Custom item ${next}`, unit: 'kg', custom: true });
      persistCatalog(); renderCatalog();
    });
    $('catalogResetBtn').addEventListener('click', () => {
      if (!confirm('Reset the item catalog to the original default list?')) return;
      state.catalog = makeDefaultCatalog();
      persistCatalog(); renderCatalog(); toast('Catalog reset.');
    });
    $('catalogBody').addEventListener('input', onCatalogInput);
    $('catalogBody').addEventListener('change', onCatalogInput);
    $('catalogBody').addEventListener('click', onCatalogClick);
  }

  function bindSettings() {
    $('saveConnectionBtn').addEventListener('click', () => saveConnection());
    $('testConnectionBtn').addEventListener('click', testConnection);
    $('syncNowBtn').addEventListener('click', syncNow);
    $('saveBusinessSettings').addEventListener('click', saveBusinessSettings);
    $('exportBackupBtn').addEventListener('click', exportBackup);
    $('importBackupInput').addEventListener('change', importBackup);
  }

  function setDefaultMonthAndDate() {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    $('dashboardMonth').value = month;
    $('historyMonth').value = '';
    $('invoiceMonth').value = month;
    $('eventDate').value = localDateISO(now);
    $('invoiceEventDate').value = localDateISO(now);
  }

  function makeDefaultCatalog() {
    const names = [...DEFAULT_NAMES];
    while (names.length < 100) names.push(`Custom item ${names.length + 1}`);
    return names.map((name, index) => ({ id: `default-${index + 1}`, no: index + 1, name, unit: inferUnit(name), custom: index >= DEFAULT_NAMES.length }));
  }

  function inferUnit(name) {
    const n = String(name || '');
    if (/তেল|জল|দুধ|কেরোসিন/.test(n)) return 'liter';
    if (/টিস্যু|সাবান|বিস্কুট|পেপার|ন্যাপকিন|বরফ/.test(n)) return 'packet';
    if (/ডিম/.test(n)) return 'dozen';
    return 'kg';
  }

  function resetEventForm(showMessage = true) {
    $('eventId').value = '';
    $('partyName').value = '';
    $('eventDate').value = localDateISO(new Date());
    $('guestCount').value = '';
    $('eventTime').value = '';
    $('eventAddress').value = '';
    $('eventBudget').value = '';
    $('eventNotes').value = '';
    $('customMenuInput').value = '';
    state.customMenus = [];
    renderMenuChips([]);
    state.eventItems = state.catalog.map(item => ({
      rowId: uid(), catalogId: item.id, no: item.no, name: item.name, unit: item.unit || 'kg', quantity: '', unitPrice: '', note: '', used: false, custom: item.custom
    }));
    $('itemSearch').value = '';
    $('itemFilter').value = 'all';
    $('eventFormTitle').textContent = 'New Event';
    renderEventItems();
    updateEventSummary();
    if (showMessage) toast('New event form ready.');
  }

  function renderMenuChips(selectedMenus = null) {
    const selected = new Set(selectedMenus ?? $$('#menuChips input:checked').map(i => i.value));
    const defaults = MENUS.map((menu, i) => `
      <label class="menu-chip"><input type="checkbox" value="${escapeAttr(menu)}" id="menu-default-${i}" ${selected.has(menu) ? 'checked' : ''}><span>${escapeHTML(menu)}</span></label>
    `);
    const custom = state.customMenus.map((menu, i) => `
      <div class="menu-chip custom-menu-chip">
        <label><input type="checkbox" value="${escapeAttr(menu)}" id="menu-custom-${i}" ${selected.has(menu) || selectedMenus === null ? 'checked' : ''}><span>${escapeHTML(menu)}</span></label>
        <button type="button" class="remove-menu-item" data-menu="${escapeAttr(menu)}" title="Remove custom menu item" aria-label="Remove ${escapeAttr(menu)}">×</button>
      </div>
    `);
    $('menuChips').innerHTML = [...defaults, ...custom].join('');
  }

  function addCustomMenuItems() {
    const input = $('customMenuInput');
    const parts = input.value.split(/[,\n]+/).map(v => v.trim()).filter(Boolean);
    if (!parts.length) {
      input.focus();
      return;
    }
    const selected = new Set($$('#menuChips input:checked').map(i => i.value));
    const known = new Set([...MENUS, ...state.customMenus].map(m => m.toLocaleLowerCase()));
    let added = 0;
    for (const menu of parts) {
      const key = menu.toLocaleLowerCase();
      if (!known.has(key)) {
        state.customMenus.push(menu);
        known.add(key);
        added++;
      }
      const actual = [...MENUS, ...state.customMenus].find(m => m.toLocaleLowerCase() === key);
      if (actual) selected.add(actual);
    }
    input.value = '';
    renderMenuChips([...selected]);
    if (added) toast(`${added} custom menu item${added === 1 ? '' : 's'} added.`);
    else toast('That menu item is already available.');
  }

  function onMenuChipsClick(e) {
    const btn = e.target.closest('.remove-menu-item');
    if (!btn) return;
    const menu = btn.dataset.menu;
    const selected = $$('#menuChips input:checked').map(i => i.value).filter(v => v !== menu);
    state.customMenus = state.customMenus.filter(m => m !== menu);
    renderMenuChips(selected);
  }

  function clearEventMenu() {
    state.customMenus = [];
    $('customMenuInput').value = '';
    renderMenuChips([]);
  }

  function renderEventItems() {
    const q = $('itemSearch').value.trim().toLowerCase();
    const filter = $('itemFilter').value;
    const rows = state.eventItems.filter(item => {
      const matchText = !q || `${item.no} ${item.name}`.toLowerCase().includes(q);
      const isUsed = itemIsUsed(item);
      const matchFilter = filter === 'all' || (filter === 'used' && isUsed) || (filter === 'unused' && !isUsed);
      return matchText && matchFilter;
    });

    $('eventItemsBody').innerHTML = rows.map(item => `
      <tr data-row-id="${escapeAttr(item.rowId)}" class="${itemIsUsed(item) ? 'used' : ''}">
        <td><input class="use-check" type="checkbox" ${item.used ? 'checked' : ''} aria-label="Use ${escapeAttr(item.name)}"></td>
        <td>${escapeHTML(String(item.no ?? ''))}</td>
        <td><input class="item-name-input" value="${escapeAttr(item.name)}" aria-label="Item name"></td>
        <td><select class="unit-select">${UNIT_OPTIONS.map(u => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
        <td><input class="qty-input" type="number" min="0" step="0.001" value="${escapeAttr(item.quantity)}" placeholder="0"></td>
        <td><input class="price-input" type="number" min="0" step="0.01" value="${escapeAttr(item.unitPrice)}" placeholder="0"></td>
        <td class="line-total">${money(itemTotal(item))}</td>
        <td><input class="note-input" value="${escapeAttr(item.note || '')}" placeholder="Optional"></td>
        <td>${item.custom ? '<button type="button" class="mini-btn danger remove-event-item" title="Remove">×</button>' : ''}</td>
      </tr>
    `).join('') || `<tr><td colspan="9" class="empty-state">No items match this filter.</td></tr>`;
  }

  function onItemTableInput(e) {
    const tr = e.target.closest('tr[data-row-id]');
    if (!tr) return;
    const item = state.eventItems.find(x => x.rowId === tr.dataset.rowId);
    if (!item) return;

    if (e.target.classList.contains('use-check')) item.used = e.target.checked;
    if (e.target.classList.contains('item-name-input')) item.name = e.target.value;
    if (e.target.classList.contains('unit-select')) item.unit = e.target.value;
    if (e.target.classList.contains('qty-input')) item.quantity = e.target.value;
    if (e.target.classList.contains('price-input')) item.unitPrice = e.target.value;
    if (e.target.classList.contains('note-input')) item.note = e.target.value;

    if (e.target.classList.contains('qty-input') || e.target.classList.contains('price-input')) {
      if (num(item.quantity) > 0 || num(item.unitPrice) > 0) item.used = true;
      const checkbox = tr.querySelector('.use-check');
      if (checkbox) checkbox.checked = item.used;
      const totalCell = tr.querySelector('.line-total');
      if (totalCell) totalCell.textContent = money(itemTotal(item));
    }
    tr.classList.toggle('used', itemIsUsed(item));
    updateEventSummary();
  }

  function onItemTableClick(e) {
    const btn = e.target.closest('.remove-event-item');
    if (!btn) return;
    const tr = btn.closest('tr[data-row-id]');
    state.eventItems = state.eventItems.filter(x => x.rowId !== tr.dataset.rowId);
    renderEventItems();
    updateEventSummary();
  }

  function addCustomEventItem() {
    const next = Math.max(0, ...state.eventItems.map(i => Number(i.no) || 0)) + 1;
    const item = { rowId: uid(), catalogId: '', no: next, name: `Custom item ${next}`, unit: 'kg', quantity: '', unitPrice: '', note: '', used: true, custom: true };
    state.eventItems.push(item);
    $('itemFilter').value = 'all';
    $('itemSearch').value = '';
    renderEventItems();
    const input = $(`eventItemsBody`).querySelector(`tr[data-row-id="${CSS.escape(item.rowId)}"] .item-name-input`);
    if (input) { input.focus(); input.select(); }
  }

  function itemIsUsed(item) {
    return Boolean(item.used || num(item.quantity) > 0 || num(item.unitPrice) > 0);
  }

  function itemTotal(item) { return num(item.quantity) * num(item.unitPrice); }

  function collectEventForm({ allowIncomplete = false } = {}) {
    const partyName = $('partyName').value.trim();
    const date = $('eventDate').value;
    if (!allowIncomplete && (!partyName || !date)) return null;
    const items = state.eventItems.filter(itemIsUsed).map(item => ({
      no: item.no,
      name: item.name.trim() || `Item ${item.no}`,
      unit: item.unit,
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      total: itemTotal(item),
      note: (item.note || '').trim(),
      custom: Boolean(item.custom)
    }));
    const totalCost = items.reduce((sum, i) => sum + i.total, 0);
    const existingId = $('eventId').value;
    const existing = state.events.find(e => e.id === existingId);
    const now = new Date().toISOString();
    return {
      id: existingId || uid(),
      partyName: partyName || 'Untitled Event',
      date: date || localDateISO(new Date()),
      guestCount: num($('guestCount').value),
      time: $('eventTime').value,
      address: $('eventAddress').value.trim(),
      budget: num($('eventBudget').value),
      notes: $('eventNotes').value.trim(),
      menu: $$('#menuChips input:checked').map(i => i.value),
      items,
      totalCost,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
  }

  async function saveEventFromForm(e) {
    e.preventDefault();
    const event = collectEventForm();
    if (!event) { toast('Party / event name and date are required.', 'error'); return; }
    if (!event.items.length) {
      if (!confirm('No product quantities/prices are entered. Save this event anyway?')) return;
    }
    upsertLocalEvent(event);
    $('eventId').value = event.id;
    $('eventFormTitle').textContent = `Edit Event — ${event.partyName}`;
    renderAll();
    toast('Event saved on this device.', 'success');
    if (state.connection.url) {
      try {
        await apiPost({ action: 'saveEvent', event });
        updateSyncStatus('online');
        toast('Event saved and synced to Google Sheets.', 'success');
      } catch (err) {
        updateSyncStatus('error', err.message);
        toast(`Saved locally. Sheet sync failed: ${err.message}`, 'error');
      }
    }
  }

  function upsertLocalEvent(event) {
    const idx = state.events.findIndex(e => e.id === event.id);
    if (idx >= 0) state.events[idx] = event; else state.events.push(event);
    state.events.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
    persistEvents();
  }

  function editEvent(id) {
    const event = state.events.find(e => e.id === id);
    if (!event) return;
    $('eventId').value = event.id;
    $('partyName').value = event.partyName || '';
    $('eventDate').value = event.date || '';
    $('guestCount').value = event.guestCount || '';
    $('eventTime').value = event.time || '';
    $('eventAddress').value = event.address || '';
    $('eventBudget').value = event.budget || '';
    $('eventNotes').value = event.notes || '';
    $('customMenuInput').value = '';
    const eventMenus = event.menu || [];
    const defaultMenuKeys = new Set(MENUS.map(m => m.toLocaleLowerCase()));
    state.customMenus = eventMenus.filter(m => !defaultMenuKeys.has(String(m).toLocaleLowerCase()));
    renderMenuChips(eventMenus);

    const byNo = new Map((event.items || []).map(i => [String(i.no), i]));
    state.eventItems = state.catalog.map(cat => {
      const saved = byNo.get(String(cat.no));
      if (saved) byNo.delete(String(cat.no));
      return {
        rowId: uid(), catalogId: cat.id, no: cat.no, name: saved?.name || cat.name, unit: saved?.unit || cat.unit || 'kg',
        quantity: saved ? String(saved.quantity ?? '') : '', unitPrice: saved ? String(saved.unitPrice ?? '') : '',
        note: saved?.note || '', used: Boolean(saved), custom: Boolean(cat.custom)
      };
    });
    for (const saved of byNo.values()) {
      state.eventItems.push({ rowId: uid(), catalogId: '', no: saved.no, name: saved.name, unit: saved.unit || 'kg', quantity: String(saved.quantity ?? ''), unitPrice: String(saved.unitPrice ?? ''), note: saved.note || '', used: true, custom: true });
    }
    $('itemSearch').value = '';
    $('itemFilter').value = 'all';
    $('eventFormTitle').textContent = `Edit Event — ${event.partyName}`;
    renderEventItems(); updateEventSummary(); showView('event');
  }

  function reuseEvent(id) {
    const src = state.events.find(e => e.id === id);
    if (!src) return;
    editEvent(id);
    $('eventId').value = '';
    $('partyName').value = `${src.partyName} — Copy`;
    $('eventDate').value = localDateISO(new Date());
    $('eventFormTitle').textContent = `Reuse Event — ${src.partyName}`;
    toast('Previous event copied. Change the date/name and customize quantities or prices.');
  }

  async function deleteEvent(id) {
    const event = state.events.find(e => e.id === id);
    if (!event) return;
    if (!confirm(`Delete “${event.partyName}”?`)) return;
    state.events = state.events.filter(e => e.id !== id);
    persistEvents(); renderAll();
    if (state.connection.url) {
      try { await apiPost({ action: 'deleteEvent', eventId: id }); updateSyncStatus('online'); }
      catch (err) { updateSyncStatus('error', err.message); }
    }
    toast('Event deleted.');
  }

  function updateEventSummary() {
    const used = state.eventItems.filter(itemIsUsed);
    const total = used.reduce((s, i) => s + itemTotal(i), 0);
    const budget = num($('eventBudget').value);
    const remaining = budget ? budget - total : 0;
    $('summaryItemCount').textContent = String(used.length);
    $('summaryCost').textContent = money(total);
    $('summaryBudget').textContent = money(budget);
    $('summaryRemaining').textContent = money(remaining);
    $('summaryRemaining').classList.toggle('negative', remaining < 0);
  }

  function renderDashboard() {
    const month = $('dashboardMonth').value || currentMonth();
    const events = state.events.filter(e => String(e.date || '').startsWith(month));
    const total = events.reduce((s, e) => s + num(e.totalCost), 0);
    const budget = num(state.budgets[month]);
    const remaining = budget ? budget - total : 0;
    const avg = events.length ? total / events.length : 0;
    const highest = [...events].sort((a, b) => num(b.totalCost) - num(a.totalCost))[0];
    const invoices = state.invoices.filter(i => String(i.eventDate || '').startsWith(month));
    const revenue = invoices.reduce((s, i) => s + num(i.totalRevenue), 0);
    const avgRevenue = invoices.length ? revenue / invoices.length : 0;
    const highestInvoice = [...invoices].sort((a, b) => num(b.totalRevenue) - num(a.totalRevenue))[0];
    const monthReceived = state.invoices.reduce((sum, inv) => sum + (inv.payments || []).filter(p => String(p.receivedDate || '').startsWith(month)).reduce((x, p) => x + num(p.amount), 0), 0);
    const monthDue = invoices.reduce((sum, inv) => sum + invoiceDue(inv), 0);
    const paidInvoices = invoices.filter(inv => num(inv.totalRevenue) > 0 && invoiceDue(inv) <= 0.005).length;
    const today = localDateISO(new Date());
    const overdueInvoices = invoices.filter(inv => invoiceDue(inv) > 0.005 && inv.dueDate && inv.dueDate < today).length;
    const grossDifference = revenue - total;

    $('monthBudget').value = budget || '';
    $('statMonthCost').textContent = money(total);
    $('statMonthEvents').textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;
    $('statBudgetRemaining').textContent = money(remaining);
    $('statBudgetUsage').textContent = budget ? `${Math.round((total / budget) * 100)}% used` : 'No monthly budget';
    $('statAverageCost').textContent = money(avg);
    $('statHighestCost').textContent = money(highest?.totalCost || 0);
    $('statHighestName').textContent = highest?.partyName || '—';
    $('statMonthRevenue').textContent = money(revenue);
    $('statInvoiceEvents').textContent = `${invoices.length} invoiced event${invoices.length === 1 ? '' : 's'}`;
    $('statAverageRevenue').textContent = money(avgRevenue);
    $('statGrossDifference').textContent = money(grossDifference);
    $('statHighestRevenue').textContent = money(highestInvoice?.totalRevenue || 0);
    $('statHighestInvoiceName').textContent = highestInvoice?.clientName || '—';
    $('statMonthReceived').textContent = money(monthReceived);
    $('statMonthDue').textContent = money(monthDue);
    $('statPaidInvoices').textContent = String(paidInvoices);
    $('statOverdueInvoices').textContent = String(overdueInvoices);
    $('pictureInvoiceCount').textContent = String(invoices.length);
    $('pictureEventCount').textContent = String(events.length);
    $('pictureRevenue').textContent = money(revenue);
    $('pictureCosts').textContent = money(total);
    $('budgetSpentLabel').textContent = `Spent: ${money(total)}`;
    $('budgetLimitLabel').textContent = `Budget: ${money(budget)}`;
    $('budgetMeterFill').style.width = budget ? `${Math.min(100, (total / budget) * 100)}%` : '0%';

    renderCostBars(events);
    renderRevenueBars(invoices);
    renderRecentEvents();
    renderRecentInvoices();
  }

  function renderCostBars(events) {
    const container = $('costBars');
    if (!events.length) { container.className = 'cost-bars empty-state'; container.textContent = 'No event data for this month.'; return; }
    container.className = 'cost-bars';
    const max = Math.max(...events.map(e => num(e.totalCost)), 1);
    container.innerHTML = [...events].sort((a, b) => num(b.totalCost) - num(a.totalCost)).slice(0, 8).map(e => `
      <div class="cost-row"><div class="cost-row-name" title="${escapeAttr(e.partyName)}">${escapeHTML(e.partyName)}</div><div class="cost-track"><div class="cost-fill" style="width:${Math.max(3, (num(e.totalCost) / max) * 100)}%"></div></div><strong>${money(e.totalCost)}</strong></div>
    `).join('');
  }

  function renderRecentEvents() {
    const rows = state.events.slice(0, 7);
    $('recentEventsBody').innerHTML = rows.length ? rows.map(e => `
      <tr><td>${formatDate(e.date)}</td><td><strong>${escapeHTML(e.partyName)}</strong></td><td>${e.guestCount || '—'}</td><td>${(e.items || []).length}</td><td>${money(e.budget)}</td><td><strong>${money(e.totalCost)}</strong></td><td><div class="table-actions"><button class="mini-btn" data-action="edit" data-id="${e.id}">Open</button><button class="mini-btn" data-action="print" data-id="${e.id}">Print</button><button class="mini-btn" data-action="reuse" data-id="${e.id}">Reuse</button></div></td></tr>
    `).join('') : `<tr><td colspan="7" class="empty-state">No events saved yet.</td></tr>`;
  }

  function renderRevenueBars(invoices) {
    const container = $('revenueBars');
    if (!invoices.length) { container.className = 'cost-bars empty-state'; container.textContent = 'No invoice data for this month.'; return; }
    container.className = 'cost-bars';
    const max = Math.max(...invoices.map(i => num(i.totalRevenue)), 1);
    container.innerHTML = [...invoices].sort((a, b) => num(b.totalRevenue) - num(a.totalRevenue)).slice(0, 8).map(inv => `
      <div class="cost-row"><div class="cost-row-name" title="${escapeAttr(inv.clientName)}">${escapeHTML(inv.clientName)}</div><div class="cost-track"><div class="cost-fill" style="width:${Math.max(3, (num(inv.totalRevenue) / max) * 100)}%"></div></div><strong>${money(inv.totalRevenue)}</strong></div>
    `).join('');
  }

  function renderRecentInvoices() {
    const rows = state.invoices.slice(0, 7);
    $('recentInvoicesBody').innerHTML = rows.length ? rows.map(inv => `
      <tr><td><strong>${escapeHTML(inv.orderNo || '')}</strong></td><td>${formatDate(inv.eventDate)}</td><td>${escapeHTML(inv.clientName)}</td><td><strong>${money(inv.totalRevenue)}</strong></td><td>${money(invoiceReceived(inv))}</td><td><strong class="${invoiceDue(inv) > 0.005 ? 'due-text' : 'paid-text'}">${money(invoiceDue(inv))}</strong></td><td><div class="table-actions"><button class="mini-btn" data-invoice-action="edit" data-id="${inv.id}">Open</button><button class="mini-btn" data-invoice-action="print" data-id="${inv.id}">Print</button><button class="mini-btn" data-invoice-action="duplicate" data-id="${inv.id}">Duplicate</button></div></td></tr>
    `).join('') : '<tr><td colspan="7" class="empty-state">No invoices saved yet.</td></tr>';
  }

  async function saveMonthlyBudget() {
    const month = $('dashboardMonth').value;
    if (!month) return;
    const amount = num($('monthBudget').value);
    state.budgets[month] = amount;
    persistBudgets(); renderDashboard();
    toast('Monthly budget saved.');
    if (state.connection.url) {
      try { await apiPost({ action: 'setBudget', month, amount }); updateSyncStatus('online'); }
      catch (err) { updateSyncStatus('error', err.message); toast(`Budget saved locally; sheet sync failed: ${err.message}`, 'error'); }
    }
  }

  function resetInvoiceForm(showMessage = true) {
    $('invoiceId').value = '';
    $('invoiceClientName').value = '';
    $('invoiceClientEmail').value = '';
    $('invoiceEventDate').value = localDateISO(new Date());
    $('invoiceEventVenue').value = '';
    $('invoiceDueDate').value = localDateISO(new Date());
    $('invoiceNotes').value = '';
    $('paymentAmount').value = '';
    $('paymentDate').value = localDateISO(new Date());
    $('invoiceSourceEvent').value = '';
    $('invoiceOrderNo').value = nextInvoiceOrderNo($('invoiceEventDate').value);
    $('invoiceFormTitle').textContent = 'New Invoice';
    state.invoiceItems = [];
    state.invoicePayments = [];
    addInvoiceItem('', '', '', false);
    refreshInvoiceEventOptions();
    renderInvoiceMenuSuggestions();
    renderInvoiceItems();
    updateInvoiceSummary();
    renderPaymentHistory();
    updatePaymentSummary();
    if (showMessage) toast('New invoice ready.');
  }

  function nextInvoiceOrderNo(dateIso, excludeId = '') {
    const date = dateIso || localDateISO(new Date());
    const month = String(date).slice(0, 7).replace('-', '') || currentMonth().replace('-', '');
    let max = 0;
    for (const invoice of state.invoices) {
      if (excludeId && invoice.id === excludeId) continue;
      const match = String(invoice.orderNo || '').match(/^AQ-(\d{6})-(\d+)$/i);
      if (match && match[1] === month) max = Math.max(max, Number(match[2]) || 0);
    }
    return `AQ-${month}-${String(max + 1).padStart(3, '0')}`;
  }

  function refreshInvoiceEventOptions(selected = '') {
    const options = ['<option value="">Choose a previous event…</option>'].concat(
      [...state.events]
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .map(e => `<option value="${escapeAttr(e.id)}" ${e.id === selected ? 'selected' : ''}>${escapeHTML(formatDate(e.date))} — ${escapeHTML(e.partyName)}</option>`)
    );
    $('invoiceSourceEvent').innerHTML = options.join('');
  }

  function renderInvoiceMenuSuggestions() {
    const names = new Set(MENUS);
    state.events.forEach(e => (e.menu || []).forEach(m => names.add(String(m))));
    state.invoices.forEach(inv => (inv.items || []).forEach(i => names.add(String(i.name || ''))));
    $('invoiceMenuSuggestions').innerHTML = [...names].filter(Boolean).sort((a, b) => a.localeCompare(b)).map(n => `<option value="${escapeAttr(n)}"></option>`).join('');
  }

  function addInvoiceItem(name = '', price = '', quantity = '', rerender = true) {
    state.invoiceItems.push({ rowId: uid(), name, price: price === '' ? '' : String(price), quantity: quantity === '' ? '' : String(quantity) });
    if (rerender) { renderInvoiceItems(); updateInvoiceSummary(); }
  }

  function invoiceItemTotal(item) { return num(item.price) * num(item.quantity); }

  function renderInvoiceItems() {
    if (!state.invoiceItems.length) state.invoiceItems.push({ rowId: uid(), name: '', price: '', quantity: '' });
    $('invoiceItemsBody').innerHTML = state.invoiceItems.map(item => `
      <tr data-invoice-row-id="${escapeAttr(item.rowId)}">
        <td><input class="invoice-menu-name" list="invoiceMenuSuggestions" value="${escapeAttr(item.name)}" placeholder="e.g. Shahi Kacchi Menu"></td>
        <td><div class="money-input"><span class="currency-symbol">${escapeHTML(currencySymbol())}</span><input class="invoice-price" type="number" min="0" step="0.01" value="${escapeAttr(item.price)}" placeholder="850"></div></td>
        <td><input class="invoice-qty" type="number" min="0" step="1" value="${escapeAttr(item.quantity)}" placeholder="700"></td>
        <td class="invoice-line-total">${money(invoiceItemTotal(item))}</td>
        <td class="tiny"><button type="button" class="mini-btn danger remove-invoice-item" aria-label="Remove menu row">×</button></td>
      </tr>`).join('');
  }

  function onInvoiceItemInput(e) {
    const tr = e.target.closest('tr[data-invoice-row-id]');
    if (!tr) return;
    const item = state.invoiceItems.find(i => i.rowId === tr.dataset.invoiceRowId);
    if (!item) return;
    if (e.target.classList.contains('invoice-menu-name')) item.name = e.target.value;
    if (e.target.classList.contains('invoice-price')) item.price = e.target.value;
    if (e.target.classList.contains('invoice-qty')) item.quantity = e.target.value;
    const total = tr.querySelector('.invoice-line-total');
    if (total) total.textContent = money(invoiceItemTotal(item));
    updateInvoiceSummary();
  }

  function onInvoiceItemClick(e) {
    const btn = e.target.closest('.remove-invoice-item');
    if (!btn) return;
    const tr = btn.closest('tr[data-invoice-row-id]');
    state.invoiceItems = state.invoiceItems.filter(i => i.rowId !== tr.dataset.invoiceRowId);
    if (!state.invoiceItems.length) addInvoiceItem('', '', '', false);
    renderInvoiceItems(); updateInvoiceSummary();
  }

  function updateInvoiceSummary() {
    const meaningful = state.invoiceItems.filter(i => i.name.trim() || num(i.price) || num(i.quantity));
    const totalQuantity = meaningful.reduce((s, i) => s + num(i.quantity), 0);
    const revenue = meaningful.reduce((s, i) => s + invoiceItemTotal(i), 0);
    $('invoiceSummaryLines').textContent = String(meaningful.length);
    $('invoiceSummaryQuantity').textContent = fmtNumber(totalQuantity);
    $('invoiceSummaryRevenue').textContent = money(revenue);
    updatePaymentSummary();
  }

  function collectInvoiceForm({ allowIncomplete = false } = {}) {
    const clientName = $('invoiceClientName').value.trim();
    const eventDate = $('invoiceEventDate').value;
    if (!allowIncomplete && (!clientName || !eventDate)) return null;
    const items = state.invoiceItems
      .filter(i => i.name.trim() || num(i.price) || num(i.quantity))
      .map(i => ({ name: i.name.trim() || 'Custom Menu', price: num(i.price), quantity: num(i.quantity), total: invoiceItemTotal(i) }));
    const existingId = $('invoiceId').value;
    const existing = state.invoices.find(i => i.id === existingId);
    const now = new Date().toISOString();
    return {
      id: existingId || uid(),
      orderNo: $('invoiceOrderNo').value.trim() || nextInvoiceOrderNo(eventDate, existingId),
      clientName: clientName || 'Unnamed Client',
      clientEmail: $('invoiceClientEmail').value.trim(),
      eventDate: eventDate || localDateISO(new Date()),
      eventVenue: $('invoiceEventVenue').value.trim(),
      dueDate: $('invoiceDueDate').value || '',
      notes: $('invoiceNotes').value.trim(),
      items,
      payments: state.invoicePayments.map(p => ({ ...p })),
      totalRevenue: items.reduce((s, i) => s + i.total, 0),
      totalReceived: state.invoicePayments.reduce((sum, p) => sum + num(p.amount), 0),
      dueAmount: Math.max(0, items.reduce((s, i) => s + i.total, 0) - state.invoicePayments.reduce((sum, p) => sum + num(p.amount), 0)),
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
  }

  async function saveInvoiceFromForm(e) {
    e.preventDefault();
    let invoice = collectInvoiceForm();
    if (!invoice) { toast('Client name and event date are required.', 'error'); return; }
    if (!invoice.items.length) { toast('Add at least one menu line to the invoice.', 'error'); return; }
    if (invoice.items.some(i => !i.name.trim())) { toast('Every invoice row needs a menu name.', 'error'); return; }
    upsertLocalInvoice(invoice);
    $('invoiceId').value = invoice.id;
    $('invoiceFormTitle').textContent = `Edit Invoice — ${invoice.orderNo}`;
    renderAll();
    toast('Invoice saved on this device.', 'success');
    if (state.connection.url) {
      try {
        const result = await apiPost({ action: 'saveInvoice', invoice });
        if (result.invoice) {
          invoice = mergeInvoiceRecord(invoice, result.invoice);
          upsertLocalInvoice(invoice);
          state.invoicePayments = (invoice.payments || []).map(p => ({ ...p }));
          $('invoiceOrderNo').value = invoice.orderNo;
          $('invoiceFormTitle').textContent = `Edit Invoice — ${invoice.orderNo}`;
          renderPaymentHistory(); updatePaymentSummary();
        }
        updateSyncStatus('online'); renderAll();
        toast('Invoice saved and revenue synced to Google Sheets.', 'success');
      } catch (err) {
        updateSyncStatus('error', err.message);
        toast(`Invoice saved locally. Sheet sync failed: ${err.message}`, 'error');
      }
    }
  }

  function upsertLocalInvoice(invoice) {
    const idx = state.invoices.findIndex(i => i.id === invoice.id);
    if (idx >= 0) state.invoices[idx] = invoice; else state.invoices.push(invoice);
    state.invoices.sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    persistInvoices();
  }

  function editInvoice(id) {
    const invoice = state.invoices.find(i => i.id === id);
    if (!invoice) return;
    $('invoiceId').value = invoice.id;
    $('invoiceOrderNo').value = invoice.orderNo || nextInvoiceOrderNo(invoice.eventDate, invoice.id);
    $('invoiceClientName').value = invoice.clientName || '';
    $('invoiceClientEmail').value = invoice.clientEmail || '';
    $('invoiceEventDate').value = invoice.eventDate || '';
    $('invoiceEventVenue').value = invoice.eventVenue || '';
    $('invoiceDueDate').value = invoice.dueDate || invoice.eventDate || '';
    $('invoiceNotes').value = invoice.notes || '';
    $('paymentAmount').value = '';
    $('paymentDate').value = localDateISO(new Date());
    $('invoiceSourceEvent').value = '';
    state.invoiceItems = (invoice.items || []).map(i => ({ rowId: uid(), name: i.name || '', price: String(i.price ?? ''), quantity: String(i.quantity ?? '') }));
    state.invoicePayments = (invoice.payments || []).map(p => ({ ...p }));
    if (!state.invoiceItems.length) addInvoiceItem('', '', '', false);
    $('invoiceFormTitle').textContent = `Edit Invoice — ${invoice.orderNo || ''}`;
    renderInvoiceItems(); updateInvoiceSummary(); renderPaymentHistory(); updatePaymentSummary(); refreshInvoiceEventOptions(); renderInvoiceMenuSuggestions(); showView('invoice');
  }

  function duplicateInvoice(id) {
    const invoice = state.invoices.find(i => i.id === id);
    if (!invoice) return;
    editInvoice(id);
    $('invoiceId').value = '';
    $('invoiceOrderNo').value = nextInvoiceOrderNo(localDateISO(new Date()));
    $('invoiceEventDate').value = localDateISO(new Date());
    $('invoiceDueDate').value = localDateISO(new Date());
    state.invoicePayments = [];
    $('paymentAmount').value = '';
    $('paymentDate').value = localDateISO(new Date());
    renderPaymentHistory(); updatePaymentSummary();
    $('invoiceFormTitle').textContent = `Duplicate Invoice — ${invoice.orderNo || invoice.clientName}`;
    toast('Invoice copied. Payments were cleared for the new order. Update details, then save.');
  }

  async function deleteInvoice(id) {
    const invoice = state.invoices.find(i => i.id === id);
    if (!invoice) return;
    if (!confirm(`Delete invoice ${invoice.orderNo} for “${invoice.clientName}”?`)) return;
    state.invoices = state.invoices.filter(i => i.id !== id);
    persistInvoices(); renderAll();
    if (state.connection.url) {
      try { await apiPost({ action: 'deleteInvoice', invoiceId: id }); updateSyncStatus('online'); }
      catch (err) { updateSyncStatus('error', err.message); }
    }
    toast('Invoice deleted.');
  }

  function loadSavedEventIntoInvoice() {
    const event = state.events.find(e => e.id === $('invoiceSourceEvent').value);
    if (!event) { toast('Choose a saved event first.', 'error'); return; }
    $('invoiceClientName').value = event.partyName || '';
    $('invoiceEventDate').value = event.date || localDateISO(new Date());
    $('invoiceEventVenue').value = event.address || '';
    if (!$('invoiceDueDate').value || !$('invoiceId').value) $('invoiceDueDate').value = event.date || localDateISO(new Date());
    if (!$('invoiceId').value) $('invoiceOrderNo').value = nextInvoiceOrderNo($('invoiceEventDate').value);
    state.invoiceItems = (event.menu || []).map(name => ({ rowId: uid(), name, price: '', quantity: event.guestCount ? String(event.guestCount) : '' }));
    if (!state.invoiceItems.length) state.invoiceItems = [{ rowId: uid(), name: '', price: '', quantity: event.guestCount ? String(event.guestCount) : '' }];
    renderInvoiceItems(); updateInvoiceSummary();
    toast('Event details and menu loaded into the invoice. Enter selling prices and adjust quantities.');
  }

  function invoiceReceived(invoice) {
    if (Array.isArray(invoice?.payments)) return invoice.payments.reduce((sum, p) => sum + num(p.amount), 0);
    return num(invoice?.totalReceived);
  }

  function invoiceDue(invoice) {
    return Math.max(0, num(invoice?.totalRevenue) - invoiceReceived(invoice));
  }

  function currentInvoiceRevenue() {
    return state.invoiceItems.filter(i => i.name.trim() || num(i.price) || num(i.quantity)).reduce((sum, i) => sum + invoiceItemTotal(i), 0);
  }

  function currentReceivedTotal() {
    return state.invoicePayments.reduce((sum, p) => sum + num(p.amount), 0);
  }

  function updatePaymentSummary() {
    const revenue = currentInvoiceRevenue();
    const received = currentReceivedTotal();
    const due = Math.max(0, revenue - received);
    $('paymentInvoiceTotal').textContent = money(revenue);
    $('paymentTotalReceived').textContent = money(received);
    $('paymentDueAmount').textContent = money(due);
    $('paymentDueAmount').className = due > 0.005 ? 'due-text' : 'paid-text';
    $('paymentDueDateLabel').textContent = $('invoiceDueDate').value ? formatDate($('invoiceDueDate').value) : '—';
    updatePaymentEmailHint();
  }

  function updatePaymentEmailHint() {
    const email = $('invoiceClientEmail').value.trim();
    if (!state.connection.url) {
      $('paymentEmailHint').textContent = 'Local-only mode: the payment can be saved, but the receipt email will remain pending until Google Sheets is connected and Sync Now is used.';
    } else if (!email) {
      $('paymentEmailHint').textContent = 'Add the client email before recording a payment if you want the automatic receipt email to be sent.';
    } else {
      $('paymentEmailHint').textContent = `A payment receipt will be emailed automatically to ${email} after the payment is recorded in Google Sheets.`;
    }
  }

  function renderPaymentHistory() {
    const payments = [...state.invoicePayments].sort((a, b) => String(b.receivedDate || '').localeCompare(String(a.receivedDate || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    let running = currentInvoiceRevenue();
    const chronological = [...state.invoicePayments].sort((a, b) => String(a.receivedDate || '').localeCompare(String(b.receivedDate || '')) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    const dueAfter = new Map();
    chronological.forEach(p => { running = Math.max(0, running - num(p.amount)); dueAfter.set(p.id, running); });
    $('paymentHistoryBody').innerHTML = payments.length ? payments.map(p => {
      const emailText = p.emailSent ? `Sent${p.emailSentAt ? ` · ${formatDate(String(p.emailSentAt).slice(0,10))}` : ''}` : (p.emailError ? 'Failed' : 'Pending');
      const canRetry = !p.emailSent && state.connection.url;
      return `<tr><td>${formatDate(p.receivedDate)}</td><td><strong>${money(p.amount)}</strong></td><td>${money(dueAfter.get(p.id) ?? 0)}</td><td><span class="payment-email-status ${p.emailSent ? 'sent' : (p.emailError ? 'failed' : 'pending')}">${escapeHTML(emailText)}</span>${p.emailError ? `<small class="payment-error">${escapeHTML(p.emailError)}</small>` : ''}</td><td>${canRetry ? `<button type="button" class="mini-btn" data-payment-action="email" data-payment-id="${escapeAttr(p.id)}">Retry Email</button>` : ''}</td></tr>`;
    }).join('') : '<tr><td colspan="5" class="empty-state">No payments recorded yet.</td></tr>';
  }

  async function recordPaymentFromForm() {
    const amount = num($('paymentAmount').value);
    const receivedDate = $('paymentDate').value;
    const email = $('invoiceClientEmail').value.trim();
    const dueDate = $('invoiceDueDate').value;
    let invoice = collectInvoiceForm();
    if (!invoice) { toast('Client name and event date are required before recording a payment.', 'error'); return; }
    if (!invoice.items.length) { toast('Add at least one invoice menu line before recording payment.', 'error'); return; }
    if (amount <= 0) { toast('Enter the amount of money received.', 'error'); return; }
    if (!receivedDate) { toast('Enter the date the money was received.', 'error'); return; }
    const currentDue = Math.max(0, num(invoice.totalRevenue) - currentReceivedTotal());
    if (amount > currentDue + 0.005) { toast(`Received amount cannot exceed the current due of ${money(currentDue)}.`, 'error'); return; }
    if (state.connection.url && !email) { toast('Add the client email so the payment receipt can be sent.', 'error'); return; }
    if (state.connection.url && email && !/^\S+@\S+\.\S+$/.test(email)) { toast('Enter a valid client email address.', 'error'); return; }
    if (!dueDate && amount < currentDue - 0.005) { toast('Set a due date for the remaining balance.', 'error'); return; }

    const now = new Date().toISOString();
    const payment = { id: uid(), amount, receivedDate, emailSent: false, emailError: '', createdAt: now, updatedAt: now };
    state.invoicePayments.push(payment);
    invoice = collectInvoiceForm();
    upsertLocalInvoice(invoice);
    $('invoiceId').value = invoice.id;
    $('invoiceOrderNo').value = invoice.orderNo;
    $('invoiceFormTitle').textContent = `Edit Invoice — ${invoice.orderNo}`;
    $('paymentAmount').value = '';
    renderPaymentHistory(); updateInvoiceSummary(); renderAll();

    if (!state.connection.url) {
      toast('Payment recorded locally. Receipt email is pending until Google Sheets is connected and synchronized.', 'success');
      return;
    }

    try {
      updateSyncStatus('working');
      const saveResult = await apiPost({ action: 'saveInvoice', invoice });
      if (saveResult.invoice) invoice = mergeInvoiceRecord(invoice, saveResult.invoice);
      const result = await apiPost({ action: 'recordPayment', invoiceId: invoice.id, payment });
      if (result.invoice) invoice = mergeInvoiceRecord(invoice, result.invoice);
      upsertLocalInvoice(invoice);
      state.invoicePayments = (invoice.payments || []).map(p => ({ ...p }));
      renderPaymentHistory(); updateInvoiceSummary(); renderAll(); updateSyncStatus('online');
      if (result.payment?.emailSent) toast(`Payment recorded. Receipt email sent to ${email}.`, 'success');
      else toast(`Payment recorded, but the email was not sent${result.payment?.emailError ? `: ${result.payment.emailError}` : '.'}`, 'error');
    } catch (err) {
      updateSyncStatus('error', err.message);
      toast(`Payment saved locally. Sheet/email sync failed: ${err.message}`, 'error');
    }
  }

  function handlePaymentHistoryClick(e) {
    const btn = e.target.closest('[data-payment-action="email"][data-payment-id]');
    if (!btn) return;
    retryPaymentEmail(btn.dataset.paymentId);
  }

  async function retryPaymentEmail(paymentId) {
    if (!state.connection.url) { toast('Connect Google Sheets first to send the receipt email.', 'error'); return; }
    const invoice = collectInvoiceForm();
    if (!invoice?.clientEmail || !/^\S+@\S+\.\S+$/.test(invoice.clientEmail)) { toast('Enter a valid client email first.', 'error'); return; }
    const payment = state.invoicePayments.find(p => p.id === paymentId);
    if (!payment) return;
    try {
      const saveResult = await apiPost({ action: 'saveInvoice', invoice });
      let merged = saveResult.invoice ? mergeInvoiceRecord(invoice, saveResult.invoice) : invoice;
      const result = await apiPost({ action: 'recordPayment', invoiceId: merged.id, payment });
      if (result.invoice) merged = mergeInvoiceRecord(merged, result.invoice);
      upsertLocalInvoice(merged);
      state.invoicePayments = (merged.payments || []).map(p => ({ ...p }));
      renderPaymentHistory(); updatePaymentSummary(); renderAll();
      if (result.payment?.emailSent) toast('Receipt email sent.', 'success');
      else toast(`Email was not sent${result.payment?.emailError ? `: ${result.payment.emailError}` : '.'}`, 'error');
    } catch (err) { toast(`Could not send receipt email: ${err.message}`, 'error'); }
  }

  function renderInvoices() {
    refreshInvoiceEventOptions($('invoiceSourceEvent').value);
    renderInvoiceMenuSuggestions();
    renderInvoiceItems();
    updateInvoiceSummary();
    renderPaymentHistory();
    updatePaymentSummary();
    renderInvoiceHistory();
  }

  function renderInvoiceHistory() {
    const q = $('invoiceSearch').value.trim().toLowerCase();
    const month = $('invoiceMonth').value;
    const list = state.invoices.filter(inv => {
      const text = `${inv.orderNo || ''} ${inv.clientName || ''} ${inv.clientEmail || ''} ${inv.eventVenue || ''} ${(inv.items || []).map(i => i.name).join(' ')}`.toLowerCase();
      return (!q || text.includes(q)) && (!month || String(inv.eventDate || '').startsWith(month));
    });
    $('invoiceHistoryList').innerHTML = list.length ? list.map(inv => `
      <article class="history-card">
        <div>
          <div class="history-title"><h4><span class="invoice-order-badge">${escapeHTML(inv.orderNo || 'ORDER')}</span>${escapeHTML(inv.clientName)}</h4><time>${formatDate(inv.eventDate)}</time></div>
          <div class="history-meta"><span>${escapeHTML(inv.eventVenue || 'Venue not set')}</span><span>${escapeHTML(inv.clientEmail || 'No client email')}</span><span>${(inv.items || []).length} menu line${(inv.items || []).length === 1 ? '' : 's'}</span><span>Qty ${fmtNumber((inv.items || []).reduce((s, i) => s + num(i.quantity), 0))}</span><span>Due ${inv.dueDate ? formatDate(inv.dueDate) : 'not set'}</span></div>
          <div class="history-menu">${(inv.items || []).slice(0, 8).map(i => `<span class="small-tag">${escapeHTML(i.name)} · ${money(i.price)} × ${fmtNumber(i.quantity)}</span>`).join('')}${(inv.items || []).length > 8 ? `<span class="small-tag">+${inv.items.length - 8} more</span>` : ''}</div>
        </div>
        <div class="history-cost"><span>Total revenue</span><strong>${money(inv.totalRevenue)}</strong><div class="payment-mini-summary"><span>Received ${money(invoiceReceived(inv))}</span><span class="${invoiceDue(inv) > 0.005 ? 'due-text' : 'paid-text'}">Due ${money(invoiceDue(inv))}</span></div><div class="history-actions"><button class="mini-btn" data-invoice-action="edit" data-id="${inv.id}">Edit / Payments</button><button class="mini-btn" data-invoice-action="print" data-id="${inv.id}">Print</button><button class="mini-btn" data-invoice-action="duplicate" data-id="${inv.id}">Duplicate</button><button class="mini-btn danger" data-invoice-action="delete" data-id="${inv.id}">Delete</button></div></div>
      </article>`).join('') : '<div class="empty-state">No matching invoices.</div>';
  }

  function handleInvoiceActionClick(e) {
    const btn = e.target.closest('[data-invoice-action][data-id]');
    if (!btn) return;
    const { invoiceAction, id } = btn.dataset;
    if (invoiceAction === 'edit') editInvoice(id);
    if (invoiceAction === 'print') printSavedInvoice(id);
    if (invoiceAction === 'duplicate') duplicateInvoice(id);
    if (invoiceAction === 'delete') deleteInvoice(id);
  }

  function printSavedInvoice(id) {
    const invoice = state.invoices.find(i => i.id === id);
    if (!invoice) return;
    renderInvoicePrintSheet(invoice);
    setTimeout(() => window.print(), 50);
  }

  function printCurrentInvoice() {
    const invoice = collectInvoiceForm({ allowIncomplete: true });
    renderInvoicePrintSheet(invoice);
    setTimeout(() => window.print(), 50);
  }

  function renderInvoicePrintSheet(invoice) {
    const items = invoice.items || [];
    const businessContact = [state.settings.businessAddress, state.settings.businessPhone].filter(Boolean);
    $('printSheet').innerHTML = `
      <div class="invoice-print-header">
        <div><h1>${escapeHTML(state.settings.businessName)}</h1>${businessContact.map(x => `<p>${escapeHTML(x)}</p>`).join('')}</div>
        <div class="invoice-print-title"><strong>INVOICE</strong><span>${escapeHTML(invoice.orderNo || '')}</span></div>
      </div>
      <div class="invoice-bill-row">
        <div class="invoice-bill-box"><h4>Bill to</h4><strong>${escapeHTML(invoice.clientName || '')}</strong><br>${escapeHTML(invoice.clientEmail || '')}<br>${escapeHTML(invoice.eventVenue || '')}</div>
        <div class="invoice-bill-box"><h4>Event details</h4><strong>Event date:</strong> ${formatDate(invoice.eventDate)}<br><strong>Order number:</strong> ${escapeHTML(invoice.orderNo || '')}<br><strong>Payment due:</strong> ${invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</div>
      </div>
      <table class="print-items"><thead><tr><th>Menu / Package</th><th>Price</th><th>Quantity</th><th>Revenue</th></tr></thead><tbody>${items.map(i => `<tr><td>${escapeHTML(i.name)}</td><td>${money(i.price)}</td><td>${fmtNumber(i.quantity)}</td><td>${money(i.total)}</td></tr>`).join('') || '<tr><td colspan="4">No menu items entered.</td></tr>'}</tbody></table>
      <div class="invoice-payment-print-summary"><div><span>Invoice total</span><strong>${money(invoice.totalRevenue)}</strong></div><div><span>Received</span><strong>${money(invoiceReceived(invoice))}</strong></div><div><span>Due</span><strong>${money(invoiceDue(invoice))}</strong></div></div>
      ${(invoice.payments || []).length ? `<table class="print-items payment-print-table"><thead><tr><th>Payment received date</th><th>Received amount</th><th>Receipt email</th></tr></thead><tbody>${(invoice.payments || []).map(p => `<tr><td>${formatDate(p.receivedDate)}</td><td>${money(p.amount)}</td><td>${p.emailSent ? 'Sent' : 'Pending / not sent'}</td></tr>`).join('')}</tbody></table>` : ''}
      ${invoice.notes ? `<p style="font-size:10px;margin-top:14px"><strong>Notes:</strong> ${escapeHTML(invoice.notes)}</p>` : ''}
      <div class="print-signatures"><span>Client signature: __________________</span><span>Authorized by: __________________</span></div>`;
  }

  function exportInvoiceCsv() {
    const month = $('invoiceMonth').value;
    const invoices = state.invoices.filter(i => !month || String(i.eventDate || '').startsWith(month));
    const rows = [['Order No','Event Date','Client','Client Email','Venue','Due Date','Menu','Price','Quantity','Line Revenue','Invoice Revenue','Total Received','Due Amount']];
    invoices.forEach(inv => {
      if (!(inv.items || []).length) rows.push([inv.orderNo, inv.eventDate, inv.clientName, inv.clientEmail || '', inv.eventVenue, inv.dueDate || '', '', '', '', '', inv.totalRevenue, invoiceReceived(inv), invoiceDue(inv)]);
      (inv.items || []).forEach(i => rows.push([inv.orderNo, inv.eventDate, inv.clientName, inv.clientEmail || '', inv.eventVenue, inv.dueDate || '', i.name, i.price, i.quantity, i.total, inv.totalRevenue, invoiceReceived(inv), invoiceDue(inv)]));
    });
    downloadText(`alaqsa-invoices-${month || 'all'}.csv`, rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }

  function renderHistory() {
    const q = $('historySearch').value.trim().toLowerCase();
    const month = $('historyMonth').value;
    const list = state.events.filter(e => {
      const text = `${e.partyName} ${e.address || ''} ${(e.menu || []).join(' ')}`.toLowerCase();
      return (!q || text.includes(q)) && (!month || String(e.date || '').startsWith(month));
    });

    $('historyList').innerHTML = list.length ? list.map(e => `
      <article class="history-card">
        <div>
          <div class="history-title"><h4>${escapeHTML(e.partyName)}</h4><time>${formatDate(e.date)}</time></div>
          <div class="history-meta"><span>${e.guestCount ? `${e.guestCount} guests` : 'Guest count not set'}</span><span>${(e.items || []).length} items</span><span>Budget ${money(e.budget)}</span>${e.address ? `<span>${escapeHTML(e.address)}</span>` : ''}</div>
          <div class="history-menu">${(e.menu || []).slice(0, 8).map(m => `<span class="small-tag">${escapeHTML(m)}</span>`).join('')}${(e.menu || []).length > 8 ? `<span class="small-tag">+${e.menu.length - 8} more</span>` : ''}</div>
        </div>
        <div class="history-cost"><span>Total expense</span><strong>${money(e.totalCost)}</strong><div class="history-actions"><button class="mini-btn" data-action="edit" data-id="${e.id}">Edit / Itemize</button><button class="mini-btn" data-action="reuse" data-id="${e.id}">Reuse</button><button class="mini-btn" data-action="print" data-id="${e.id}">Print</button><button class="mini-btn danger" data-action="delete" data-id="${e.id}">Delete</button></div></div>
      </article>
    `).join('') : `<div class="empty-state">No matching events.</div>`;
  }

  function handleEventActionClick(e) {
    const btn = e.target.closest('[data-action][data-id]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'edit') editEvent(id);
    if (action === 'reuse') reuseEvent(id);
    if (action === 'print') printSavedEvent(id);
    if (action === 'delete') deleteEvent(id);
  }

  function renderCatalog() {
    const q = $('catalogSearch').value.trim().toLowerCase();
    const rows = state.catalog.filter(i => !q || `${i.no} ${i.name}`.toLowerCase().includes(q));
    $('catalogBody').innerHTML = rows.map(item => `
      <tr data-catalog-id="${escapeAttr(item.id)}"><td>${item.no}</td><td><input class="catalog-name" value="${escapeAttr(item.name)}"></td><td><select class="catalog-unit">${UNIT_OPTIONS.map(u => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></td><td><button class="mini-btn danger catalog-delete">Delete</button></td></tr>
    `).join('');
  }

  function onCatalogInput(e) {
    const tr = e.target.closest('tr[data-catalog-id]');
    if (!tr) return;
    const item = state.catalog.find(i => i.id === tr.dataset.catalogId);
    if (!item) return;
    if (e.target.classList.contains('catalog-name')) item.name = e.target.value;
    if (e.target.classList.contains('catalog-unit')) item.unit = e.target.value;
    persistCatalog();
  }

  function onCatalogClick(e) {
    const btn = e.target.closest('.catalog-delete');
    if (!btn) return;
    const tr = btn.closest('tr[data-catalog-id]');
    const item = state.catalog.find(i => i.id === tr.dataset.catalogId);
    if (!item || !confirm(`Delete “${item.name}” from the catalog? Saved past events will not be changed.`)) return;
    state.catalog = state.catalog.filter(i => i.id !== item.id);
    persistCatalog(); renderCatalog();
  }

  function printSavedEvent(id) {
    const event = state.events.find(e => e.id === id);
    if (!event) return;
    renderPrintSheet(event);
    setTimeout(() => window.print(), 50);
  }

  function printCurrentForm() {
    const event = collectEventForm({ allowIncomplete: true });
    renderPrintSheet(event);
    setTimeout(() => window.print(), 50);
  }

  function renderPrintSheet(event) {
    const items = event.items || [];
    $('printSheet').innerHTML = `
      <div class="print-header"><h1>${escapeHTML(state.settings.businessName)}</h1><p>Event Product & Expense Sheet</p></div>
      <table class="print-meta"><tr><td><strong>Party / Event:</strong> ${escapeHTML(event.partyName || '')}</td><td><strong>Date:</strong> ${formatDate(event.date)}</td></tr><tr><td><strong>Address:</strong> ${escapeHTML(event.address || '')}</td><td><strong>Time:</strong> ${escapeHTML(event.time || '—')}</td></tr><tr><td><strong>Guests:</strong> ${event.guestCount || '—'}</td><td><strong>Event budget:</strong> ${money(event.budget)}</td></tr></table>
      <div class="print-menu"><strong>Menu:</strong> ${(event.menu || []).map(escapeHTML).join(', ') || '—'}</div>
      <table class="print-items"><thead><tr><th>#</th><th>Item</th><th>Unit</th><th>Quantity</th><th>Unit Price</th><th>Total</th><th>Note</th></tr></thead><tbody>${items.map(i => `<tr><td>${escapeHTML(String(i.no ?? ''))}</td><td>${escapeHTML(i.name)}</td><td>${escapeHTML(i.unit)}</td><td>${fmtNumber(i.quantity)}</td><td>${money(i.unitPrice)}</td><td>${money(i.total)}</td><td>${escapeHTML(i.note || '')}</td></tr>`).join('') || '<tr><td colspan="7">No items entered.</td></tr>'}</tbody></table>
      <div class="print-total"><table><tr><td>Items used</td><td>${items.length}</td></tr><tr><td>Budget</td><td>${money(event.budget)}</td></tr><tr><td><strong>Total cost</strong></td><td><strong>${money(event.totalCost)}</strong></td></tr><tr><td>Remaining</td><td>${money(num(event.budget) - num(event.totalCost))}</td></tr></table></div>
      ${event.notes ? `<p style="font-size:10px"><strong>Notes:</strong> ${escapeHTML(event.notes)}</p>` : ''}
      <div class="print-signatures"><span>Manager signature: __________________</span><span>Approved by: __________________</span></div>
    `;
  }

  function exportMonthCsv() {
    const month = $('dashboardMonth').value;
    const events = state.events.filter(e => String(e.date || '').startsWith(month));
    const rows = [['Date','Event','Guests','Menu','Item #','Item','Unit','Quantity','Unit Price','Line Total','Event Budget','Event Total']];
    events.forEach(e => {
      if (!(e.items || []).length) rows.push([e.date,e.partyName,e.guestCount,(e.menu || []).join(' | '),'','','','','','',e.budget,e.totalCost]);
      (e.items || []).forEach(i => rows.push([e.date,e.partyName,e.guestCount,(e.menu || []).join(' | '),i.no,i.name,i.unit,i.quantity,i.unitPrice,i.total,e.budget,e.totalCost]));
    });
    downloadText(`alaqsa-events-${month || 'all'}.csv`, rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }

  function exportBackup() {
    const backup = { version: 3, exportedAt: new Date().toISOString(), events: state.events, invoices: state.invoices, budgets: state.budgets, catalog: state.catalog, settings: state.settings };
    downloadText(`alaqsa-catering-backup-${localDateISO(new Date())}.json`, JSON.stringify(backup, null, 2), 'application/json');
  }

  async function importBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.events) || !Array.isArray(data.catalog)) throw new Error('This does not look like an Al-Aqsa backup file.');
      if (!confirm('Import this backup and replace the data currently stored in this browser?')) return;
      state.events = data.events;
      state.invoices = Array.isArray(data.invoices) ? data.invoices : [];
      state.budgets = data.budgets || {};
      state.catalog = data.catalog;
      state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      persistEvents(); persistInvoices(); persistBudgets(); persistCatalog(); persistSettings();
      applySettingsToUI(); resetEventForm(false); resetInvoiceForm(false); renderAll(); toast('Backup imported successfully.', 'success');
    } catch (err) { toast(err.message, 'error'); }
    finally { e.target.value = ''; }
  }

  function saveBusinessSettings() {
    state.settings.businessName = $('businessName').value.trim() || DEFAULT_SETTINGS.businessName;
    state.settings.businessPhone = $('businessPhone').value.trim();
    state.settings.businessAddress = $('businessAddress').value.trim();
    state.settings.currency = $('currencyCode').value;
    state.settings.locale = $('localeCode').value;
    persistSettings(); applySettingsToUI(); renderAll(); updateEventSummary(); toast('Business settings saved.');
  }

  function applySettingsToUI() {
    $('businessName').value = state.settings.businessName;
    $('businessPhone').value = state.settings.businessPhone || '';
    $('businessAddress').value = state.settings.businessAddress || '';
    $('currencyCode').value = state.settings.currency;
    $('localeCode').value = state.settings.locale;
    $('scriptUrl').value = state.connection.url || '';
    $('accessKey').value = state.connection.key || '';
    const sym = currencySymbol();
    $$('.currency-symbol').forEach(s => s.textContent = sym);
    document.title = `${state.settings.businessName} — Operations Manager`;
  }

  function saveConnection({ quiet = false } = {}) {
    let url = $('scriptUrl').value.trim();
    if (url && !/^https:\/\/script\.google\.com\//i.test(url)) {
      toast('Please enter the deployed script.google.com web-app URL.', 'error'); return false;
    }
    state.connection.url = url.replace(/\/$/, '');
    state.connection.key = $('accessKey').value.trim();
    safeSet(STORAGE.connection, state.connection);
    if (!quiet) toast(url ? 'Google Sheets connection saved.' : 'Connection removed; using local mode.');
    updateSyncStatus(url ? 'offline' : 'offline');
    return true;
  }

  async function testConnection() {
    if (!saveConnection({ quiet: true }) || !state.connection.url) { toast('Add the Apps Script URL first.', 'error'); return; }
    try {
      updateSyncStatus('working');
      const data = await apiGet('ping');
      if (!data.ok) throw new Error(data.error || 'Connection failed');
      updateSyncStatus('online'); toast('Google Sheets connection is working.', 'success');
    } catch (err) { updateSyncStatus('error', err.message); toast(err.message, 'error'); }
  }

  async function loadFromSheet({ silent = false } = {}) {
    if (!state.connection.url || state.syncBusy) return;
    state.syncBusy = true;
    try {
      updateSyncStatus('working');
      const remote = await apiGet('loadAll');
      if (!remote.ok) throw new Error(remote.error || 'Could not load Google Sheets data.');
      state.events = mergeEvents(state.events, remote.events || []);
      state.invoices = mergeInvoices(state.invoices, remote.invoices || []);
      state.budgets = { ...(remote.budgets || {}), ...state.budgets };
      persistEvents(); persistInvoices(); persistBudgets(); renderAll();
      updateSyncStatus('online');
      if (!silent) toast('Google Sheets data loaded.', 'success');
    } catch (err) {
      updateSyncStatus('error', err.message);
      if (!silent) toast(`Sync failed: ${err.message}`, 'error');
    } finally { state.syncBusy = false; }
  }

  async function syncNow() {
    if (!saveConnection({ quiet: true }) || !state.connection.url) { toast('Add the Apps Script URL first.', 'error'); return; }
    if (state.syncBusy) return;
    state.syncBusy = true;
    try {
      updateSyncStatus('working');
      const remote = await apiGet('loadAll');
      if (!remote.ok) throw new Error(remote.error || 'Could not read Google Sheets.');
      state.events = mergeEvents(state.events, remote.events || []);
      state.invoices = mergeInvoices(state.invoices, remote.invoices || []);
      state.budgets = { ...(remote.budgets || {}), ...state.budgets };
      for (const ev of state.events) await apiPost({ action: 'saveEvent', event: ev });
      for (const invoice of [...state.invoices]) {
        const localPayments = (invoice.payments || []).map(p => ({ ...p }));
        const result = await apiPost({ action: 'saveInvoice', invoice });
        let syncedInvoice = result.invoice ? mergeInvoiceRecord(invoice, result.invoice) : invoice;
        for (const payment of localPayments) {
          const payResult = await apiPost({ action: 'recordPayment', invoiceId: syncedInvoice.id, payment });
          if (payResult.invoice) syncedInvoice = mergeInvoiceRecord(syncedInvoice, payResult.invoice);
        }
        upsertLocalInvoice(syncedInvoice);
      }
      for (const [month, amount] of Object.entries(state.budgets)) await apiPost({ action: 'setBudget', month, amount });
      persistEvents(); persistInvoices(); persistBudgets(); renderAll(); updateSyncStatus('online'); toast('Local data and Google Sheets are synchronized.', 'success');
    } catch (err) { updateSyncStatus('error', err.message); toast(`Sync failed: ${err.message}`, 'error'); }
    finally { state.syncBusy = false; }
  }

  function mergeEvents(localEvents, remoteEvents) {
    const map = new Map();
    [...remoteEvents, ...localEvents].forEach(e => {
      if (!e?.id) return;
      const current = map.get(e.id);
      if (!current || String(e.updatedAt || '') >= String(current.updatedAt || '')) map.set(e.id, e);
    });
    return [...map.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  function mergeInvoices(localInvoices, remoteInvoices) {
    const map = new Map();
    [...remoteInvoices, ...localInvoices].forEach(i => {
      if (!i?.id) return;
      const current = map.get(i.id);
      if (!current) map.set(i.id, { ...i, payments: mergePayments([], i.payments || []) });
      else {
        const newer = String(i.updatedAt || '') >= String(current.updatedAt || '') ? i : current;
        const older = newer === i ? current : i;
        map.set(i.id, { ...older, ...newer, payments: mergePayments(current.payments || [], i.payments || []) });
      }
    });
    return [...map.values()].map(normalizeInvoicePaymentTotals).sort((a, b) => String(b.eventDate || '').localeCompare(String(a.eventDate || '')) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  function mergePayments(a, b) {
    const map = new Map();
    [...a, ...b].forEach(p => {
      if (!p?.id) return;
      const current = map.get(p.id);
      if (!current || (p.emailSent && !current.emailSent) || String(p.updatedAt || p.createdAt || '') >= String(current.updatedAt || current.createdAt || '')) map.set(p.id, { ...current, ...p });
    });
    return [...map.values()].sort((x, y) => String(x.receivedDate || '').localeCompare(String(y.receivedDate || '')) || String(x.createdAt || '').localeCompare(String(y.createdAt || '')));
  }

  function mergeInvoiceRecord(localInvoice, remoteInvoice) {
    return normalizeInvoicePaymentTotals({ ...localInvoice, ...remoteInvoice, payments: mergePayments(localInvoice?.payments || [], remoteInvoice?.payments || []) });
  }

  function normalizeInvoicePaymentTotals(invoice) {
    const totalReceived = (invoice.payments || []).reduce((sum, p) => sum + num(p.amount), 0);
    return { ...invoice, totalReceived, dueAmount: Math.max(0, num(invoice.totalRevenue) - totalReceived) };
  }

  async function apiGet(action) {
    const url = new URL(state.connection.url);
    url.searchParams.set('action', action);
    if (state.connection.key) url.searchParams.set('key', state.connection.key);
    url.searchParams.set('_', Date.now());
    const response = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function apiPost(payload) {
    const response = await fetch(state.connection.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, key: state.connection.key || '' }),
      redirect: 'follow'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Google Sheets request failed.');
    return data;
  }

  function updateSyncStatus(mode, detail = '') {
    const dot = $('syncDot');
    dot.className = 'status-dot';
    if (!state.connection.url) {
      dot.classList.add('offline'); $('syncLabel').textContent = 'Local mode'; $('syncHint').textContent = 'Data is saved on this device. Connect Google Sheets in Settings to sync.'; return;
    }
    if (mode === 'online') { dot.classList.add('online'); $('syncLabel').textContent = 'Sheets connected'; $('syncHint').textContent = 'Local data can sync with Google Sheets.'; }
    else if (mode === 'error') { dot.classList.add('error'); $('syncLabel').textContent = 'Sync problem'; $('syncHint').textContent = detail || 'Check the Apps Script URL and access key.'; }
    else if (mode === 'working') { dot.classList.add('offline'); $('syncLabel').textContent = 'Syncing…'; $('syncHint').textContent = 'Communicating with Google Sheets.'; }
    else { dot.classList.add('offline'); $('syncLabel').textContent = 'Sheets configured'; $('syncHint').textContent = 'Connection is configured but not currently verified.'; }
  }

  function renderAll() {
    renderDashboard(); renderHistory(); renderCatalog(); renderInvoiceHistory(); refreshInvoiceEventOptions($('invoiceSourceEvent').value); renderInvoiceMenuSuggestions(); renderPaymentHistory(); updatePaymentSummary();
  }

  function persistEvents() { safeSet(STORAGE.events, state.events); }
  function persistInvoices() { safeSet(STORAGE.invoices, state.invoices); }
  function persistBudgets() { safeSet(STORAGE.budgets, state.budgets); }
  function persistCatalog() { safeSet(STORAGE.catalog, state.catalog); }
  function persistSettings() { safeSet(STORAGE.settings, state.settings); }

  function safeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  function loadJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  }

  function money(value) {
    const amount = num(value);
    try { return new Intl.NumberFormat(state.settings.locale, { style: 'currency', currency: state.settings.currency, maximumFractionDigits: 2 }).format(amount); }
    catch { return `${currencySymbol()}${amount.toFixed(2)}`; }
  }

  function currencySymbol() {
    const symbols = { BDT: '৳', USD: '$', GBP: '£', EUR: '€' };
    return symbols[state.settings.currency] || state.settings.currency;
  }

  function fmtNumber(v) {
    try { return new Intl.NumberFormat(state.settings.locale, { maximumFractionDigits: 3 }).format(num(v)); }
    catch { return String(num(v)); }
  }

  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function uid() { return globalThis.crypto?.randomUUID?.() || `ev-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function currentMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
  function localDateISO(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }

  function formatDate(iso) {
    if (!iso) return '—';
    const [y,m,d] = iso.split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    try { return new Intl.DateTimeFormat(state.settings.locale, { year:'numeric', month:'short', day:'numeric' }).format(date); }
    catch { return iso; }
  }

  function toast(message, type = 'success') {
    const el = $('toast'); el.textContent = message; el.className = `toast show ${type}`;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.className = 'toast', 3200);
  }

  function escapeHTML(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function escapeAttr(value) { return escapeHTML(value); }
  function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
})();
