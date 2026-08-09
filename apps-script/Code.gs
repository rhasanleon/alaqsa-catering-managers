/**
 * Al-Aqsa Catering Center — Google Sheets backend
 *
 * Recommended use:
 * 1) Create a Google Sheet.
 * 2) Extensions -> Apps Script.
 * 3) Paste this file into Code.gs and save.
 * 4) Run setup() once and authorize.
 * 5) Optional: Project Settings -> Script properties -> add ACCESS_KEY.
 * 6) Deploy -> New deployment -> Web app.
 */

const EVENTS_SHEET = 'Events';
const ITEMS_SHEET = 'EventItems';
const BUDGETS_SHEET = 'MonthlyBudgets';
const INVOICES_SHEET = 'Invoices';
const INVOICE_ITEMS_SHEET = 'InvoiceItems';
const MONTHLY_SUMMARY_SHEET = 'MonthlySummary';
const PAYMENTS_SHEET = 'Payments';

const EVENT_HEADERS = [
  'eventId', 'eventDate', 'partyName', 'address', 'guestCount', 'eventTime',
  'menuJson', 'budget', 'totalCost', 'notes', 'createdAt', 'updatedAt'
];

const ITEM_HEADERS = [
  'eventId', 'itemNo', 'itemName', 'unit', 'quantity', 'unitPrice', 'lineTotal', 'note', 'custom'
];

const BUDGET_HEADERS = ['month', 'budget', 'updatedAt'];

const INVOICE_HEADERS = [
  'invoiceId', 'orderNo', 'clientName', 'eventDate', 'eventVenue',
  'totalRevenue', 'notes', 'createdAt', 'updatedAt',
  'clientEmail', 'dueDate', 'totalReceived', 'dueAmount', 'paymentStatus'
];

const INVOICE_ITEM_HEADERS = [
  'invoiceId', 'menuName', 'price', 'quantity', 'lineRevenue'
];

const PAYMENT_HEADERS = [
  'paymentId', 'invoiceId', 'orderNo', 'clientName', 'clientEmail',
  'receivedAmount', 'receivedDate', 'invoiceTotal', 'totalReceivedAfterPayment',
  'dueAfterPayment', 'dueDate', 'emailSent', 'emailSentAt', 'emailError',
  'createdAt', 'updatedAt'
];

const MONTHLY_SUMMARY_HEADERS = [
  'month', 'invoicedEvents', 'expenseEvents', 'totalRevenue', 'recordedCosts',
  'revenueMinusRecordedCosts', 'monthlyBudget', 'budgetRemaining', 'updatedAt',
  'cashReceived', 'outstandingDue', 'paidInvoices', 'overdueInvoices'
];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this Apps Script project from the target Google Sheet, then run setup() again.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  ensureSheet_(ss, EVENTS_SHEET, EVENT_HEADERS);
  ensureSheet_(ss, ITEMS_SHEET, ITEM_HEADERS);
  ensureSheet_(ss, BUDGETS_SHEET, BUDGET_HEADERS);
  ensureSheet_(ss, INVOICES_SHEET, INVOICE_HEADERS);
  ensureSheet_(ss, INVOICE_ITEMS_SHEET, INVOICE_ITEM_HEADERS);
  ensureSheet_(ss, PAYMENTS_SHEET, PAYMENT_HEADERS);
  ensureSheet_(ss, MONTHLY_SUMMARY_SHEET, MONTHLY_SUMMARY_HEADERS);
  rebuildMonthlySummary_(ss);
  return 'Setup complete';
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    requireKey_(params.key || '');
    const action = params.action || 'ping';

    if (action === 'ping') {
      return json_({ ok: true, service: 'Al-Aqsa Catering Sheets API', timestamp: new Date().toISOString() });
    }

    if (action === 'loadAll') {
      setupIfNeeded_();
      const ss = getSpreadsheet_();
      return json_({ ok: true, events: loadEvents_(ss), invoices: loadInvoices_(ss), budgets: loadBudgets_(ss) });
    }

    return json_({ ok: false, error: 'Unknown GET action.' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    requireKey_(payload.key || '');
    const action = payload.action;
    setupIfNeeded_();
    const ss = getSpreadsheet_();

    if (action === 'saveEvent') {
      saveEvent_(ss, payload.event || {});
      return json_({ ok: true });
    }

    if (action === 'deleteEvent') {
      deleteEvent_(ss, String(payload.eventId || ''));
      return json_({ ok: true });
    }

    if (action === 'saveInvoice') {
      const invoice = saveInvoice_(ss, payload.invoice || {});
      return json_({ ok: true, invoice: invoice });
    }

    if (action === 'deleteInvoice') {
      deleteInvoice_(ss, String(payload.invoiceId || ''));
      return json_({ ok: true });
    }

    if (action === 'recordPayment') {
      const result = recordPayment_(ss, String(payload.invoiceId || ''), payload.payment || {});
      return json_({ ok: true, invoice: result.invoice, payment: result.payment });
    }

    if (action === 'setBudget') {
      setBudget_(ss, String(payload.month || ''), number_(payload.amount));
      return json_({ ok: true });
    }

    return json_({ ok: false, error: 'Unknown POST action.' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}


function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Spreadsheet is not configured. Run setup() once from the bound Google Sheet.');
  props.setProperty('SPREADSHEET_ID', active.getId());
  return active;
}

function setupIfNeeded_() {
  const ss = getSpreadsheet_();
  ensureSheet_(ss, EVENTS_SHEET, EVENT_HEADERS);
  ensureSheet_(ss, ITEMS_SHEET, ITEM_HEADERS);
  ensureSheet_(ss, BUDGETS_SHEET, BUDGET_HEADERS);
  ensureSheet_(ss, INVOICES_SHEET, INVOICE_HEADERS);
  ensureSheet_(ss, INVOICE_ITEMS_SHEET, INVOICE_ITEM_HEADERS);
  ensureSheet_(ss, PAYMENTS_SHEET, PAYMENT_HEADERS);
  ensureSheet_(ss, MONTHLY_SUMMARY_SHEET, MONTHLY_SUMMARY_HEADERS);
}

function saveEvent_(ss, event) {
  if (!event.id) throw new Error('Missing event id.');
  if (!event.date) throw new Error('Missing event date.');

  const eventSheet = ss.getSheetByName(EVENTS_SHEET);
  const row = [
    String(event.id), String(event.date || ''), text_(event.partyName), text_(event.address),
    number_(event.guestCount), String(event.time || ''), JSON.stringify(event.menu || []),
    number_(event.budget), number_(event.totalCost), text_(event.notes),
    String(event.createdAt || new Date().toISOString()), String(event.updatedAt || new Date().toISOString())
  ];

  const data = eventSheet.getDataRange().getValues();
  let rowNumber = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(event.id)) { rowNumber = i + 1; break; }
  }
  if (rowNumber > 0) eventSheet.getRange(rowNumber, 1, 1, EVENT_HEADERS.length).setValues([row]);
  else eventSheet.appendRow(row);

  replaceEventItems_(ss.getSheetByName(ITEMS_SHEET), String(event.id), event.items || []);
  rebuildMonthlySummary_(ss);
}

function replaceEventItems_(sheet, eventId, items) {
  const data = sheet.getDataRange().getValues();
  const kept = [ITEM_HEADERS];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== eventId) kept.push(data[i].slice(0, ITEM_HEADERS.length));
  }

  (items || []).forEach(item => kept.push([
    eventId, number_(item.no), text_(item.name), text_(item.unit), number_(item.quantity),
    number_(item.unitPrice), number_(item.total), text_(item.note), Boolean(item.custom)
  ]));

  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, ITEM_HEADERS.length).setValues(kept);
  formatHeader_(sheet, ITEM_HEADERS.length);
}

function deleteEvent_(ss, eventId) {
  if (!eventId) throw new Error('Missing event id.');
  removeRowsByFirstColumn_(ss.getSheetByName(EVENTS_SHEET), EVENT_HEADERS, eventId);
  removeRowsByFirstColumn_(ss.getSheetByName(ITEMS_SHEET), ITEM_HEADERS, eventId);
  rebuildMonthlySummary_(ss);
}

function removeRowsByFirstColumn_(sheet, headers, value) {
  const data = sheet.getDataRange().getValues();
  const kept = [headers];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(value)) kept.push(data[i].slice(0, headers.length));
  }
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, headers.length).setValues(kept);
  formatHeader_(sheet, headers.length);
}

function saveInvoice_(ss, invoice) {
  if (!invoice.id) throw new Error('Missing invoice id.');
  if (!invoice.eventDate) throw new Error('Missing invoice event date.');
  if (!invoice.clientName) throw new Error('Missing invoice client name.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const invoiceSheet = ss.getSheetByName(INVOICES_SHEET);
    const items = (invoice.items || []).map(item => ({
      name: text_(item.name || 'Custom Menu'),
      price: number_(item.price),
      quantity: number_(item.quantity),
      total: number_(item.price) * number_(item.quantity)
    }));
    const totalRevenue = items.reduce((sum, item) => sum + item.total, 0);
    let orderNo = String(invoice.orderNo || '').trim();
    if (!orderNo || orderNumberUsedByOtherInvoice_(invoiceSheet, orderNo, String(invoice.id))) {
      orderNo = nextOrderNo_(invoiceSheet, String(invoice.eventDate));
    }

    const payments = loadPaymentsForInvoice_(ss, String(invoice.id));
    const totalReceived = payments.reduce((sum, p) => sum + number_(p.amount), 0);
    const dueAmount = Math.max(0, totalRevenue - totalReceived);
    const paymentStatus = dueAmount <= 0.005 && totalRevenue > 0 ? 'PAID' : (totalReceived > 0 ? 'PARTIAL' : 'UNPAID');

    const normalized = {
      id: String(invoice.id),
      orderNo: orderNo,
      clientName: String(invoice.clientName || ''),
      clientEmail: String(invoice.clientEmail || ''),
      eventDate: String(invoice.eventDate || ''),
      eventVenue: String(invoice.eventVenue || ''),
      dueDate: String(invoice.dueDate || ''),
      totalRevenue: totalRevenue,
      totalReceived: totalReceived,
      dueAmount: dueAmount,
      paymentStatus: paymentStatus,
      notes: String(invoice.notes || ''),
      createdAt: String(invoice.createdAt || new Date().toISOString()),
      updatedAt: String(invoice.updatedAt || new Date().toISOString()),
      items: items,
      payments: payments
    };

    const row = [
      normalized.id, normalized.orderNo, text_(normalized.clientName), normalized.eventDate,
      text_(normalized.eventVenue), normalized.totalRevenue, text_(normalized.notes),
      normalized.createdAt, normalized.updatedAt, text_(normalized.clientEmail), normalized.dueDate,
      normalized.totalReceived, normalized.dueAmount, normalized.paymentStatus
    ];

    const data = invoiceSheet.getDataRange().getValues();
    let rowNumber = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === normalized.id) { rowNumber = i + 1; break; }
    }
    if (rowNumber > 0) invoiceSheet.getRange(rowNumber, 1, 1, INVOICE_HEADERS.length).setValues([row]);
    else invoiceSheet.appendRow(row);

    replaceInvoiceItems_(ss.getSheetByName(INVOICE_ITEMS_SHEET), normalized.id, normalized.items);
    rebuildMonthlySummary_(ss);
    return normalized;
  } finally {
    lock.releaseLock();
  }
}

function orderNumberUsedByOtherInvoice_(sheet, orderNo, invoiceId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(orderNo) && String(data[i][0]) !== String(invoiceId)) return true;
  }
  return false;
}

function nextOrderNo_(sheet, eventDate) {
  const month = String(eventDate || '').slice(0, 7).replace('-', '') || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMM');
  const data = sheet.getDataRange().getValues();
  let max = 0;
  const re = new RegExp('^AQ-' + month + '-(\\d+)$', 'i');
  for (let i = 1; i < data.length; i++) {
    const match = String(data[i][1] || '').match(re);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  }
  return 'AQ-' + month + '-' + String(max + 1).padStart(3, '0');
}

function replaceInvoiceItems_(sheet, invoiceId, items) {
  const data = sheet.getDataRange().getValues();
  const kept = [INVOICE_ITEM_HEADERS];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(invoiceId)) kept.push(data[i].slice(0, INVOICE_ITEM_HEADERS.length));
  }
  (items || []).forEach(item => kept.push([
    invoiceId, text_(item.name), number_(item.price), number_(item.quantity), number_(item.total)
  ]));
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, INVOICE_ITEM_HEADERS.length).setValues(kept);
  formatHeader_(sheet, INVOICE_ITEM_HEADERS.length);
}

function deleteInvoice_(ss, invoiceId) {
  if (!invoiceId) throw new Error('Missing invoice id.');
  removeRowsByFirstColumn_(ss.getSheetByName(INVOICES_SHEET), INVOICE_HEADERS, invoiceId);
  removeRowsByFirstColumn_(ss.getSheetByName(INVOICE_ITEMS_SHEET), INVOICE_ITEM_HEADERS, invoiceId);
  removeRowsByColumn_(ss.getSheetByName(PAYMENTS_SHEET), PAYMENT_HEADERS, 1, invoiceId);
  rebuildMonthlySummary_(ss);
}

function recordPayment_(ss, invoiceId, payment) {
  if (!invoiceId) throw new Error('Missing invoice id.');
  if (!payment.id) throw new Error('Missing payment id.');
  const amount = number_(payment.amount);
  if (amount <= 0) throw new Error('Payment amount must be greater than zero.');
  const receivedDate = String(payment.receivedDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) throw new Error('A valid received date is required.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const invoiceSheet = ss.getSheetByName(INVOICES_SHEET);
    const paymentSheet = ss.getSheetByName(PAYMENTS_SHEET);
    const invoiceRowInfo = findRowByFirstColumn_(invoiceSheet, invoiceId);
    if (!invoiceRowInfo) throw new Error('Save the invoice before recording a payment.');

    let invoiceObj = invoiceFromRow_(invoiceRowInfo.values);
    let existingPayment = findRowByFirstColumn_(paymentSheet, String(payment.id));
    let paymentObj;

    if (existingPayment) {
      paymentObj = paymentFromRow_(existingPayment.values);
    } else {
      const currentPayments = loadPaymentsForInvoice_(ss, invoiceId);
      const alreadyReceived = currentPayments.reduce((sum, p) => sum + number_(p.amount), 0);
      const currentDue = Math.max(0, number_(invoiceObj.totalRevenue) - alreadyReceived);
      if (amount > currentDue + 0.005) throw new Error('Payment exceeds the current due amount.');

      const now = new Date().toISOString();
      const totalReceivedAfter = alreadyReceived + amount;
      const dueAfter = Math.max(0, number_(invoiceObj.totalRevenue) - totalReceivedAfter);
      paymentObj = {
        id: String(payment.id), invoiceId: invoiceId, orderNo: invoiceObj.orderNo,
        clientName: invoiceObj.clientName, clientEmail: invoiceObj.clientEmail,
        amount: amount, receivedDate: receivedDate, invoiceTotal: number_(invoiceObj.totalRevenue),
        totalReceivedAfterPayment: totalReceivedAfter, dueAfterPayment: dueAfter,
        dueDate: invoiceObj.dueDate || '', emailSent: false, emailSentAt: '', emailError: '',
        createdAt: String(payment.createdAt || now), updatedAt: now
      };
      paymentSheet.appendRow(paymentToRow_(paymentObj));
      existingPayment = findRowByFirstColumn_(paymentSheet, paymentObj.id);
      updateInvoicePaymentTotals_(ss, invoiceId);
      invoiceRowInfo.values = invoiceSheet.getRange(invoiceRowInfo.rowNumber, 1, 1, INVOICE_HEADERS.length).getValues()[0];
      invoiceObj = invoiceFromRow_(invoiceRowInfo.values);
    }

    // If already sent, the payment ID makes this endpoint idempotent and prevents duplicate receipts.
    if (!paymentObj.emailSent) {
      try {
        if (!invoiceObj.clientEmail) throw new Error('Client email is missing.');
        sendPaymentReceiptEmail_(invoiceObj, paymentObj);
        paymentObj.emailSent = true;
        paymentObj.emailSentAt = new Date().toISOString();
        paymentObj.emailError = '';
      } catch (emailErr) {
        paymentObj.emailSent = false;
        paymentObj.emailError = String(emailErr && emailErr.message ? emailErr.message : emailErr);
      }
      paymentObj.clientEmail = invoiceObj.clientEmail || paymentObj.clientEmail || '';
      paymentObj.dueDate = invoiceObj.dueDate || paymentObj.dueDate || '';
      paymentObj.updatedAt = new Date().toISOString();
      if (existingPayment) paymentSheet.getRange(existingPayment.rowNumber, 1, 1, PAYMENT_HEADERS.length).setValues([paymentToRow_(paymentObj)]);
    }

    updateInvoicePaymentTotals_(ss, invoiceId);
    rebuildMonthlySummary_(ss);
    const loadedInvoice = loadInvoices_(ss).find(i => String(i.id) === String(invoiceId));
    const loadedPayment = (loadedInvoice && loadedInvoice.payments || []).find(p => String(p.id) === String(paymentObj.id)) || paymentObj;
    return { invoice: loadedInvoice, payment: loadedPayment };
  } finally {
    lock.releaseLock();
  }
}

function sendPaymentReceiptEmail_(invoice, payment) {
  const subject = 'Payment received — ' + String(invoice.orderNo || 'Al-Aqsa Catering Center');
  const due = Math.max(0, number_(invoice.totalRevenue) - (number_(invoice.totalReceived) || number_(payment.totalReceivedAfterPayment)));
  const body = [
    'Dear ' + String(invoice.clientName || 'Client') + ',',
    '',
    'Al-Aqsa Catering Center confirms that we received ' + formatBdt_(payment.amount) + ' on ' + String(payment.receivedDate || '') + '.',
    'Order number: ' + String(invoice.orderNo || ''),
    'Invoice total: ' + formatBdt_(invoice.totalRevenue),
    'Total received: ' + formatBdt_(invoice.totalReceived || payment.totalReceivedAfterPayment),
    'Remaining due: ' + formatBdt_(due),
    'Due date: ' + String(invoice.dueDate || 'Not specified'),
    'Event date: ' + String(invoice.eventDate || ''),
    'Event venue: ' + String(invoice.eventVenue || ''),
    '',
    'Thank you,',
    'Al-Aqsa Catering Center'
  ].join('\n');

  const html = '<div style="font-family:Arial,sans-serif;max-width:620px;color:#1e2c24">' +
    '<h2 style="color:#0f5a3a">Al-Aqsa Catering Center</h2>' +
    '<p>Dear <strong>' + htmlEscape_(invoice.clientName || 'Client') + '</strong>,</p>' +
    '<p>We confirm that we received <strong>' + htmlEscape_(formatBdt_(payment.amount)) + '</strong> on <strong>' + htmlEscape_(payment.receivedDate || '') + '</strong>.</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:520px">' +
      emailRow_('Order number', invoice.orderNo || '') +
      emailRow_('Invoice total', formatBdt_(invoice.totalRevenue)) +
      emailRow_('Total received', formatBdt_(invoice.totalReceived || payment.totalReceivedAfterPayment)) +
      emailRow_('Remaining due', formatBdt_(due)) +
      emailRow_('Due date', invoice.dueDate || 'Not specified') +
      emailRow_('Event date', invoice.eventDate || '') +
      emailRow_('Event venue', invoice.eventVenue || '') +
    '</table>' +
    (due > 0.005 ? '<p style="margin-top:18px">Please pay the remaining balance by the due date shown above.</p>' : '<p style="margin-top:18px"><strong>This invoice is fully paid. Thank you.</strong></p>') +
    '<p>Thank you,<br><strong>Al-Aqsa Catering Center</strong></p></div>';

  MailApp.sendEmail({ to: String(invoice.clientEmail), subject: subject, body: body, htmlBody: html, name: 'Al-Aqsa Catering Center' });
}

function emailRow_(label, value) {
  return '<tr><td style="border:1px solid #d8e1dc;padding:8px;font-weight:bold;background:#f6faf7">' + htmlEscape_(label) + '</td><td style="border:1px solid #d8e1dc;padding:8px">' + htmlEscape_(String(value || '')) + '</td></tr>';
}

function htmlEscape_(value) {
  return String(value == null ? '' : value).replace(/[&<>\"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'})[c]; });
}

function formatBdt_(value) {
  const fixed = number_(value).toFixed(2);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return 'BDT ' + parts.join('.');
}

function paymentToRow_(p) {
  return [
    String(p.id), String(p.invoiceId), String(p.orderNo || ''), text_(p.clientName), text_(p.clientEmail),
    number_(p.amount), String(p.receivedDate || ''), number_(p.invoiceTotal), number_(p.totalReceivedAfterPayment),
    number_(p.dueAfterPayment), String(p.dueDate || ''), Boolean(p.emailSent), String(p.emailSentAt || ''),
    text_(p.emailError || ''), String(p.createdAt || ''), String(p.updatedAt || '')
  ];
}

function paymentFromRow_(r) {
  return {
    id: String(r[0] || ''), invoiceId: String(r[1] || ''), orderNo: String(r[2] || ''),
    clientName: String(r[3] || ''), clientEmail: String(r[4] || ''), amount: number_(r[5]),
    receivedDate: dateString_(r[6]), invoiceTotal: number_(r[7]), totalReceivedAfterPayment: number_(r[8]),
    dueAfterPayment: number_(r[9]), dueDate: dateString_(r[10]), emailSent: Boolean(r[11]),
    emailSentAt: dateTimeString_(r[12]), emailError: String(r[13] || ''), createdAt: dateTimeString_(r[14]), updatedAt: dateTimeString_(r[15])
  };
}

function loadPaymentsForInvoice_(ss, invoiceId) {
  const rows = ss.getSheetByName(PAYMENTS_SHEET).getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1] || '') === String(invoiceId)) result.push(paymentFromRow_(rows[i]));
  }
  result.sort((a, b) => String(a.receivedDate).localeCompare(String(b.receivedDate)) || String(a.createdAt).localeCompare(String(b.createdAt)));
  return result;
}

function findRowByFirstColumn_(sheet, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][0]) === String(value)) return { rowNumber: i + 1, values: data[i] };
  return null;
}

function invoiceFromRow_(r) {
  return {
    id: String(r[0] || ''), orderNo: String(r[1] || ''), clientName: String(r[2] || ''),
    eventDate: dateString_(r[3]), eventVenue: String(r[4] || ''), totalRevenue: number_(r[5]),
    notes: String(r[6] || ''), createdAt: dateTimeString_(r[7]), updatedAt: dateTimeString_(r[8]),
    clientEmail: String(r[9] || ''), dueDate: dateString_(r[10]), totalReceived: number_(r[11]),
    dueAmount: number_(r[12]), paymentStatus: String(r[13] || '')
  };
}

function updateInvoicePaymentTotals_(ss, invoiceId) {
  const invoiceSheet = ss.getSheetByName(INVOICES_SHEET);
  const info = findRowByFirstColumn_(invoiceSheet, invoiceId);
  if (!info) return;
  const inv = invoiceFromRow_(info.values);
  const payments = loadPaymentsForInvoice_(ss, invoiceId);
  const totalReceived = payments.reduce((sum, p) => sum + number_(p.amount), 0);
  const dueAmount = Math.max(0, number_(inv.totalRevenue) - totalReceived);
  const status = dueAmount <= 0.005 && number_(inv.totalRevenue) > 0 ? 'PAID' : (totalReceived > 0 ? 'PARTIAL' : 'UNPAID');
  invoiceSheet.getRange(info.rowNumber, 12, 1, 3).setValues([[totalReceived, dueAmount, status]]);
}

function removeRowsByColumn_(sheet, headers, columnIndexZeroBased, value) {
  const data = sheet.getDataRange().getValues();
  const kept = [headers];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][columnIndexZeroBased] || '') !== String(value)) kept.push(data[i].slice(0, headers.length));
  }
  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, headers.length).setValues(kept);
  formatHeader_(sheet, headers.length);
}

function setBudget_(ss, month, amount) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Invalid month. Expected YYYY-MM.');
  const sheet = ss.getSheetByName(BUDGETS_SHEET);
  const data = sheet.getDataRange().getValues();
  const now = new Date().toISOString();
  let updated = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === month) {
      sheet.getRange(i + 1, 1, 1, BUDGET_HEADERS.length).setValues([[month, amount, now]]);
      updated = true;
      break;
    }
  }
  if (!updated) sheet.appendRow([month, amount, now]);
  rebuildMonthlySummary_(ss);
}

function loadEvents_(ss) {
  const eventsSheet = ss.getSheetByName(EVENTS_SHEET);
  const itemsSheet = ss.getSheetByName(ITEMS_SHEET);
  const eventRows = eventsSheet.getDataRange().getValues();
  const itemRows = itemsSheet.getDataRange().getValues();

  const itemsByEvent = {};
  for (let i = 1; i < itemRows.length; i++) {
    const r = itemRows[i];
    const eventId = String(r[0] || '');
    if (!eventId) continue;
    if (!itemsByEvent[eventId]) itemsByEvent[eventId] = [];
    itemsByEvent[eventId].push({
      no: number_(r[1]), name: String(r[2] || ''), unit: String(r[3] || ''),
      quantity: number_(r[4]), unitPrice: number_(r[5]), total: number_(r[6]),
      note: String(r[7] || ''), custom: Boolean(r[8])
    });
  }

  const events = [];
  for (let i = 1; i < eventRows.length; i++) {
    const r = eventRows[i];
    const id = String(r[0] || '');
    if (!id) continue;
    events.push({
      id: id,
      date: dateString_(r[1]),
      partyName: String(r[2] || ''),
      address: String(r[3] || ''),
      guestCount: number_(r[4]),
      time: String(r[5] || ''),
      menu: parseJsonArray_(r[6]),
      budget: number_(r[7]),
      totalCost: number_(r[8]),
      notes: String(r[9] || ''),
      createdAt: dateTimeString_(r[10]),
      updatedAt: dateTimeString_(r[11]),
      items: itemsByEvent[id] || []
    });
  }
  events.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return events;
}

function loadInvoices_(ss) {
  const invoiceSheet = ss.getSheetByName(INVOICES_SHEET);
  const itemSheet = ss.getSheetByName(INVOICE_ITEMS_SHEET);
  const paymentSheet = ss.getSheetByName(PAYMENTS_SHEET);
  const invoiceRows = invoiceSheet.getDataRange().getValues();
  const itemRows = itemSheet.getDataRange().getValues();
  const paymentRows = paymentSheet.getDataRange().getValues();

  const itemsByInvoice = {};
  for (let i = 1; i < itemRows.length; i++) {
    const r = itemRows[i];
    const invoiceId = String(r[0] || '');
    if (!invoiceId) continue;
    if (!itemsByInvoice[invoiceId]) itemsByInvoice[invoiceId] = [];
    itemsByInvoice[invoiceId].push({
      name: String(r[1] || ''), price: number_(r[2]), quantity: number_(r[3]), total: number_(r[4])
    });
  }

  const paymentsByInvoice = {};
  for (let i = 1; i < paymentRows.length; i++) {
    const p = paymentFromRow_(paymentRows[i]);
    if (!p.invoiceId) continue;
    if (!paymentsByInvoice[p.invoiceId]) paymentsByInvoice[p.invoiceId] = [];
    paymentsByInvoice[p.invoiceId].push(p);
  }

  const invoices = [];
  for (let i = 1; i < invoiceRows.length; i++) {
    const r = invoiceRows[i];
    const id = String(r[0] || '');
    if (!id) continue;
    const payments = paymentsByInvoice[id] || [];
    payments.sort((a, b) => String(a.receivedDate).localeCompare(String(b.receivedDate)) || String(a.createdAt).localeCompare(String(b.createdAt)));
    const totalReceived = payments.reduce((sum, p) => sum + number_(p.amount), 0);
    const totalRevenue = number_(r[5]);
    invoices.push({
      id: id,
      orderNo: String(r[1] || ''),
      clientName: String(r[2] || ''),
      clientEmail: String(r[9] || ''),
      eventDate: dateString_(r[3]),
      eventVenue: String(r[4] || ''),
      dueDate: dateString_(r[10]),
      totalRevenue: totalRevenue,
      totalReceived: totalReceived,
      dueAmount: Math.max(0, totalRevenue - totalReceived),
      paymentStatus: Math.max(0, totalRevenue - totalReceived) <= 0.005 && totalRevenue > 0 ? 'PAID' : (totalReceived > 0 ? 'PARTIAL' : 'UNPAID'),
      notes: String(r[6] || ''),
      createdAt: dateTimeString_(r[7]),
      updatedAt: dateTimeString_(r[8]),
      items: itemsByInvoice[id] || [],
      payments: payments
    });
  }
  invoices.sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return invoices;
}

function loadBudgets_(ss) {
  const sheet = ss.getSheetByName(BUDGETS_SHEET);
  const rows = sheet.getDataRange().getValues();
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const month = String(rows[i][0] || '');
    if (month) result[month] = number_(rows[i][1]);
  }
  return result;
}

function rebuildMonthlySummary_(ss) {
  const summarySheet = ss.getSheetByName(MONTHLY_SUMMARY_SHEET) || ensureSheet_(ss, MONTHLY_SUMMARY_SHEET, MONTHLY_SUMMARY_HEADERS);
  const eventRows = ss.getSheetByName(EVENTS_SHEET).getDataRange().getValues();
  const invoiceRows = ss.getSheetByName(INVOICES_SHEET).getDataRange().getValues();
  const paymentRows = ss.getSheetByName(PAYMENTS_SHEET).getDataRange().getValues();
  const budgetRows = ss.getSheetByName(BUDGETS_SHEET).getDataRange().getValues();
  const months = {};
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  function bucket_(month) {
    if (!months[month]) months[month] = { invoicedEvents: 0, expenseEvents: 0, totalRevenue: 0, recordedCosts: 0, monthlyBudget: 0, cashReceived: 0, outstandingDue: 0, paidInvoices: 0, overdueInvoices: 0 };
    return months[month];
  }

  for (let i = 1; i < eventRows.length; i++) {
    const month = String(dateString_(eventRows[i][1]) || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const b = bucket_(month);
    b.expenseEvents += 1;
    b.recordedCosts += number_(eventRows[i][8]);
  }

  for (let i = 1; i < invoiceRows.length; i++) {
    const month = String(dateString_(invoiceRows[i][3]) || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const b = bucket_(month);
    const revenue = number_(invoiceRows[i][5]);
    const received = number_(invoiceRows[i][11]);
    const due = Math.max(0, revenue - received);
    const dueDate = dateString_(invoiceRows[i][10]);
    b.invoicedEvents += 1;
    b.totalRevenue += revenue;
    b.outstandingDue += due;
    if (revenue > 0 && due <= 0.005) b.paidInvoices += 1;
    if (due > 0.005 && dueDate && dueDate < today) b.overdueInvoices += 1;
  }

  for (let i = 1; i < paymentRows.length; i++) {
    const month = String(dateString_(paymentRows[i][6]) || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    bucket_(month).cashReceived += number_(paymentRows[i][5]);
  }

  for (let i = 1; i < budgetRows.length; i++) {
    const month = String(budgetRows[i][0] || '');
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    bucket_(month).monthlyBudget = number_(budgetRows[i][1]);
  }

  const now = new Date().toISOString();
  const rows = [MONTHLY_SUMMARY_HEADERS];
  Object.keys(months).sort().reverse().forEach(month => {
    const b = months[month];
    rows.push([
      month, b.invoicedEvents, b.expenseEvents, b.totalRevenue, b.recordedCosts,
      b.totalRevenue - b.recordedCosts, b.monthlyBudget,
      b.monthlyBudget ? b.monthlyBudget - b.recordedCosts : 0, now,
      b.cashReceived, b.outstandingDue, b.paidInvoices, b.overdueInvoices
    ]);
  });

  summarySheet.clearContents();
  summarySheet.getRange(1, 1, rows.length, MONTHLY_SUMMARY_HEADERS.length).setValues(rows);
  formatHeader_(summarySheet, MONTHLY_SUMMARY_HEADERS.length);
  if (rows.length > 1) {
    summarySheet.getRange(2, 4, rows.length - 1, 5).setNumberFormat('#,##0.00');
    summarySheet.getRange(2, 10, rows.length - 1, 2).setNumberFormat('#,##0.00');
  }
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeaders = headers.some((h, i) => String(current[i] || '') !== h);
  if (needsHeaders) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeader_(sheet, headers.length);
  return sheet;
}

function formatHeader_(sheet, width) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#0f5a3a').setFontColor('#ffffff');
}

function requireKey_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');
  if (expected && String(provided || '') !== String(expected)) throw new Error('Invalid access key.');
}

function parseJsonArray_(value) {
  try { const x = JSON.parse(String(value || '[]')); return Array.isArray(x) ? x : []; }
  catch (err) { return []; }
}

function dateString_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(value || '');
}

function dateTimeString_(value) {
  if (value instanceof Date) return value.toISOString();
  return String(value || '');
}

function number_(value) {
  const n = Number(value);
  return isFinite(n) ? n : 0;
}

function text_(value) {
  const s = String(value == null ? '' : value);
  // Keep spreadsheet cells as text and reduce formula-injection risk.
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
