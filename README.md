# Al-Aqsa Catering Center — Operations & Invoice Manager

A lightweight catering operations and invoice web app designed to be hosted on **GitHub Pages** and synchronized with **Google Sheets** through Google Apps Script.

## What this version does

- Create an event with name, date, venue, guest count, budget, and a fully customizable per-event menu (standard dishes + custom dishes).
- Enter quantity and unit price for catering products/goods.
- Automatically calculate line totals and total event expense.
- Save events locally in the browser even before Google Sheets is connected.
- Sync events and monthly budgets to Google Sheets after the Apps Script backend is configured.
- View previous events and **Edit / Itemize**, **Reuse**, or **Print** them; reused events keep their custom menu and can be changed for the new event.
- Calculate monthly total cost, average event cost, highest-cost event, and budget usage.
- Maintain an editable product catalog based on the original Bengali catering register.
- Export a month to CSV and export/import a JSON backup.
- Print an A4 event expense sheet.
- Generate client invoices with automatic order numbers such as `AQ-202608-001`.
- Record client name, event date, event venue, and unlimited standard/custom invoice menu lines.
- Calculate invoice revenue automatically as **price × quantity** for each menu line.
- Print a professional A4 client invoice.
- Load a saved event into an invoice so its date, venue, guest quantity, and menu can be reused quickly.
- Edit, duplicate, search, filter, print, delete, and export previous invoices.
- Track monthly total invoiced revenue, invoiced event count, average invoice revenue, highest invoice, and **revenue minus recorded product costs** on the dashboard.
- Sync invoice headers and invoice menu lines to dedicated Google Sheets tabs.
- Record **multiple partial payments** for one invoice, including received amount and received date.
- Automatically calculate **total received** and **remaining due** after every payment.
- Store a payment due date on each invoice.
- Send an automatic payment-receipt email to the client when a payment is recorded through the connected Google Apps Script backend.
- Keep a payment ledger in a dedicated `Payments` sheet, including receipt-email delivery status.
- Show monthly cash received, outstanding dues, paid invoices, and overdue invoices on the dashboard and `MonthlySummary` sheet.

## Files

- `index.html` — website entry page
- `styles.css` — responsive interface and A4 print styling
- `app.js` — event, invoice, revenue, budget, history, catalog, sync, and printing logic
- `favicon.svg` — site icon
- `apps-script/Code.gs` — Google Sheets backend for events, invoices, revenue, and budgets
- `.nojekyll` — tells GitHub Pages to serve the files directly

---

## 1. Publish the website on GitHub Pages

### Create the repository

Create a new repository on GitHub named:

```text
alaqsa-catering-manager
```

For the simplest GitHub Free setup, make it **Public**. Do not add secrets or passwords to this repository.

### Upload these website files

Upload the contents of this folder to the repository root. `index.html` must be at the top level.

### Turn on GitHub Pages

In the repository:

1. Open **Settings**.
2. Open **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose branch **main** and folder **/(root)**.
5. Save.

For a project repository, the site normally becomes available at a URL like:

```text
https://YOUR-USERNAME.github.io/alaqsa-catering-manager/
```

---

## 2. Connect it to Google Sheets

The website works without Sheets, but that local data stays in that browser. For shared/persistent event history, configure the Apps Script backend.

### Create the Sheet

1. Create a new Google Sheet, for example **Al-Aqsa Catering Database**.
2. In that Sheet choose **Extensions -> Apps Script**.
3. Replace the default code with the contents of `apps-script/Code.gs`.
4. Save the script.
5. Run the function `setup()` once from the Apps Script editor and approve the requested Google Sheets permissions. **This version also uses MailApp to send payment receipts, so Google will request permission to send email on your behalf.**

`setup()` creates these tabs automatically:

- `Events`
- `EventItems`
- `MonthlyBudgets`
- `Invoices`
- `InvoiceItems`
- `Payments`
- `MonthlySummary`

If you already deployed an earlier version, replace the Apps Script code with this version, save it, run `setup()` again, and **redeploy / update the Web App deployment** so the payment/email endpoints become available. Existing event and invoice data is preserved.

### Recommended: add an access key

In Apps Script open **Project Settings -> Script properties** and add:

```text
Property: ACCESS_KEY
Value: choose-a-long-private-random-value
```

Do not put the real key into this GitHub repository. Enter it only in the website's **Settings** screen on the manager's device.

### Deploy Apps Script as a Web App

1. In Apps Script choose **Deploy -> New deployment**.
2. Select **Web app**.
3. Execute the app as the Sheet owner.
4. Choose an access setting that lets the GitHub Pages frontend call the deployed app. For this simple first version this is normally **Anyone**.
5. Deploy and copy the `/exec` Web App URL.

### Connect the website

Open the published catering website:

1. Open **Settings**.
2. Paste the Apps Script Web App URL.
3. Enter the `ACCESS_KEY` if you configured one.
4. Click **Save Connection**.
5. Click **Test Connection**.
6. Click **Sync Now**.

---

## Data model

### Events
One row per catering event: date, party name, venue, guest count, menu, event budget, total cost, notes, and timestamps.

### EventItems
One row per product used in an event: item number, item name, unit, quantity, unit price, line total, and note.

### MonthlyBudgets
One row per month containing the budget target.

### Invoices
One row per client invoice containing order number, client, client email, event date, venue, payment due date, total revenue, total received, remaining due, payment status, notes, and timestamps.

### InvoiceItems
One row per invoice menu/package containing menu name, price, quantity, and calculated line revenue.

### Payments
One row per received payment. It stores payment ID, invoice/order, client, amount received, received date, due after payment, due date, email status, and timestamps. Payment IDs make receipt sending idempotent so normal synchronization does not intentionally send duplicate emails.

### MonthlySummary
Automatically rebuilt whenever an event, invoice, or monthly budget changes. It shows, month by month: invoiced event count, expense-event count, total revenue, recorded product costs, revenue minus recorded costs, monthly budget, budget remaining, cash received, outstanding due, paid invoices, and overdue invoices.

The dashboard calculates monthly revenue from the `Invoices` data and compares it with recorded event product costs. The **Revenue − recorded costs** figure is an operational comparison, not accounting net profit; salaries, rent, utilities, tax, transport, and other overheads are not included unless separately recorded as event costs.

---

## Security / production note

GitHub Pages is static hosting. Anything committed to a public repository is not a safe place for passwords or secret credentials. The first version therefore stores the optional Apps Script access key in the manager's browser rather than in the source files.

For a later production version with multiple managers, role-based access, and stronger security, use Google Sign-In/Firebase Authentication or another authenticated backend rather than relying only on a shared access key.


## Partial-payment workflow

1. Create or open an invoice.
2. Enter the client's email and payment due date.
3. Enter **Received money** and **Received date** in the Payments & Due card.
4. Click **Record Payment & Email Receipt**.
5. The app recalculates the due amount as `Invoice total - Sum of all payments`.
6. When Sheets is connected, Apps Script writes the payment to the `Payments` sheet and sends the client a receipt showing the payment, total received, remaining due, and due date.

If the app is in local-only mode, the payment is kept in the browser with email status Pending. After Sheets is configured, **Sync Now** pushes pending payment IDs to the backend. The backend checks payment IDs to avoid intentionally duplicating a payment or an already-sent receipt email.

### Email quota note

Payment receipts use Google Apps Script `MailApp`. Google applies daily recipient quotas that depend on the Google account / Workspace edition. If a receipt cannot be sent, the payment remains recorded and the interface shows the email error with a **Retry Email** action.
