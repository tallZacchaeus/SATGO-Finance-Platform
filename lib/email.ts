import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || 'SATGO Finance <noreply@satgo.org>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

interface EmailData {
  to: string;
  requestId: string;
  requesterName: string;
  amount: number;
  purpose: string;
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

export async function sendRequestSubmittedEmail(data: EmailData) {
  await resend.emails.send({
    from: FROM,
    to: data.to,
    subject: 'Financial Request Submitted - SATGO',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1d4ed8;">Financial Request Submitted</h2>
        <p>Dear ${escapeHtml(data.requesterName)},</p>
        <p>Your financial request has been submitted successfully and is pending review.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Amount</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${formatAmount(data.amount)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Purpose</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(data.purpose)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Status</td><td style="padding: 8px; border: 1px solid #e5e7eb;">Pending Review</td></tr>
        </table>
        <a href="${APP_URL}/requester" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View Request</a>
        <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">SATGO Finance Platform</p>
      </div>
    `,
  });
}

export async function sendRequestApprovedEmail(data: EmailData) {
  await resend.emails.send({
    from: FROM,
    to: data.to,
    subject: 'Financial Request Approved - SATGO',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Financial Request Approved</h2>
        <p>Dear ${escapeHtml(data.requesterName)},</p>
        <p>Your financial request has been <strong>approved</strong>. Payment will be processed shortly.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Amount</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${formatAmount(data.amount)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Purpose</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(data.purpose)}</td></tr>
        </table>
        <a href="${APP_URL}/requester" style="background: #16a34a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View Request</a>
        <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">SATGO Finance Platform</p>
      </div>
    `,
  });
}

export async function sendRequestRejectedEmail(data: EmailData & { reason?: string }) {
  await resend.emails.send({
    from: FROM,
    to: data.to,
    subject: 'Financial Request Rejected - SATGO',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Financial Request Rejected</h2>
        <p>Dear ${escapeHtml(data.requesterName)},</p>
        <p>Unfortunately, your financial request has been <strong>rejected</strong>.</p>
        ${data.reason ? `<p><strong>Reason:</strong> ${escapeHtml(data.reason)}</p>` : ''}
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Amount</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${formatAmount(data.amount)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Purpose</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(data.purpose)}</td></tr>
        </table>
        <p>You may submit a new request after addressing the concerns raised.</p>
        <a href="${APP_URL}/requester" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Go to Dashboard</a>
        <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">SATGO Finance Platform</p>
      </div>
    `,
  });
}

export async function sendReceiptUploadedEmail(data: EmailData) {
  await resend.emails.send({
    from: FROM,
    to: data.to,
    subject: 'Receipt Uploaded - Request Completed - SATGO',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Receipt Uploaded - Request Completed</h2>
        <p>Dear ${escapeHtml(data.requesterName)},</p>
        <p>A receipt has been uploaded for your financial request. Your request is now <strong>completed</strong>.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Amount</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${formatAmount(data.amount)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Purpose</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(data.purpose)}</td></tr>
        </table>
        <a href="${APP_URL}/requester" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View Request</a>
        <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">SATGO Finance Platform</p>
      </div>
    `,
  });
}

export async function sendAdminNotificationEmail(to: string, subject: string, body: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${subject} - SATGO`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        ${body}
        <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">SATGO Finance Platform</p>
      </div>
    `,
  });
}
