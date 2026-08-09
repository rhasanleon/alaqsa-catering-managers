# Upgrade notes — Partial payments, dues, and email receipts

This version adds a payment ledger to each invoice.

## New invoice fields

- Client email
- Payment due date
- Received money
- Received date
- Automatically calculated total received
- Automatically calculated remaining due
- Payment history and receipt-email status

## Google Sheets changes

A new `Payments` tab is created. The `Invoices` and `MonthlySummary` tabs receive additional columns.

After replacing `apps-script/Code.gs`:

1. Save the Apps Script project.
2. Run `setup()` once.
3. Approve the additional permission to send email (`MailApp`).
4. Update/redeploy the Web App deployment.
5. Replace the GitHub Pages website files with this version.
6. Open the website and use **Settings -> Test Connection -> Sync Now**.

Existing event and invoice rows are preserved because the new invoice fields are appended after the existing invoice columns.

## Payment email behavior

When Google Sheets is connected, **Record Payment & Email Receipt**:

1. Saves/updates the invoice.
2. Writes the received payment to `Payments`.
3. Recalculates total received and due amount.
4. Updates `Invoices` and `MonthlySummary`.
5. Emails the client a receipt containing the amount received, total received, remaining due, due date, order number, event date, and venue.

Each payment has a unique payment ID. The backend checks that ID to avoid intentionally creating duplicate payment rows or re-sending an already successful receipt during normal synchronization.

If email delivery fails, the payment is still recorded and the interface shows **Retry Email**.
