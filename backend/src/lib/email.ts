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

// Initialize SendGrid client if API key is provided
let sgMail: any = null;
if (process.env.SENDGRID_API_KEY) {
  try {
    const sgMailModule = await import("@sendgrid/mail");
    sgMail = sgMailModule.default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  } catch (error) {
    logger.warn("SendGrid not installed. Email notifications will be logged only.");
  }
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    const html = payload.template === "approval"
      ? generateApprovalEmail(payload)
      : generateRejectionEmail(payload);

    // Development mode: log instead of sending
    if (process.env.NODE_ENV === "development") {
      logger.info(`[EMAIL-DEV] To: ${payload.to}, Subject: ${payload.subject}`);
      logger.info(`[EMAIL-DEV] Template: ${payload.template}`);
      return true;
    }

    // Production: use SendGrid if available
    if (sgMail) {
      const msg = {
        to: payload.to,
        from: process.env.SENDGRID_FROM_EMAIL || "noreply@travelpartner.com",
        subject: payload.subject,
        html: html,
      };
      await sgMail.send(msg);
      logger.info(`[EMAIL-SENT] To: ${payload.to}, Subject: ${payload.subject}`);
      return true;
    }

    // Fallback: log if SendGrid is not configured
    logger.warn(`[EMAIL-FALLBACK] SendGrid not configured. To: ${payload.to}, Subject: ${payload.subject}`);
    return false;
  } catch (error) {
    logger.error("Email send failed:", error);
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
