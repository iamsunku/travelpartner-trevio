import { logger } from "./logger.js";

export interface EmailPayload {
  to: string;
  subject: string;
  template: "approval" | "rejection";
  data: {
    agentName: string;
    productName: string;
    productType: "activity" | "transfer" | "hotel";
    reason?: string;
    approverName?: string;
  };
}

type SendGridMail = {
  setApiKey: (key: string) => void;
  send: (msg: { to: string; from: string; subject: string; html: string }) => Promise<unknown>;
};

let sgMailPromise: Promise<SendGridMail | null> | null = null;

function loadSendGrid(): Promise<SendGridMail | null> {
  if (!process.env.SENDGRID_API_KEY) return Promise.resolve(null);
  if (!sgMailPromise) {
    sgMailPromise = import("@sendgrid/mail")
      .then((mod) => {
        const client = mod.default as SendGridMail;
        client.setApiKey(process.env.SENDGRID_API_KEY!);
        return client;
      })
      .catch(() => {
        logger.warn("SendGrid not installed. Email notifications will be logged only.");
        return null;
      });
  }
  return sgMailPromise;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    const html = payload.template === "approval"
      ? generateApprovalEmail(payload)
      : generateRejectionEmail(payload);

    const sgMail = await loadSendGrid();
    if (sgMail) {
      await sgMail.send({
        to: payload.to,
        from: process.env.SENDGRID_FROM_EMAIL || "noreply@travelpartner.pro",
        subject: payload.subject,
        html,
      });
      logger.info(`[EMAIL-SENT] To: ${payload.to}, Subject: ${payload.subject}`);
      return true;
    }

    logger.warn(`[EMAIL-FALLBACK] SendGrid not configured. To: ${payload.to}, Subject: ${payload.subject}`);
    return false;
  } catch (error) {
    logger.error(`Email send failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export function generateApprovalEmail(payload: EmailPayload): string {
  const { agentName, productName, productType, approverName } = payload.data;
  return `
    <h2>Rate Approval Notification</h2>
    <p>Hi ${agentName},</p>
    <p>Your ${productType} "<strong>${productName}</strong>" has been <strong style="color: green;">APPROVED</strong> and is now live!</p>
    <p>Agents can now see and book this product at the approved rates.</p>
    <p>Approved by: <strong>${approverName || "Admin"}</strong></p>
    <p>Best regards,<br/>TravelPartner Pro Team</p>
  `;
}

export function generateRejectionEmail(payload: EmailPayload): string {
  const { agentName, productName, productType, reason, approverName } = payload.data;
  return `
    <h2>Rate Rejection Notification</h2>
    <p>Hi ${agentName},</p>
    <p>Your ${productType} "<strong>${productName}</strong>" has been <strong style="color: red;">REJECTED</strong> and returned to Draft status.</p>
    <p><strong>Reason for rejection:</strong></p>
    <p style="background: #f3f4f6; padding: 10px; border-left: 3px solid #ef4444;">${reason || "No reason provided"}</p>
    <p>Please review and edit the rates, then resubmit for approval.</p>
    <p>Rejected by: <strong>${approverName || "Admin"}</strong></p>
    <p>Best regards,<br/>TravelPartner Pro Team</p>
  `;
}
