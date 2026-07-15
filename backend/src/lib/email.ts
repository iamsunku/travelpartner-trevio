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

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    // In development: log instead of sending
    if (process.env.NODE_ENV === "development") {
      logger.info(`[EMAIL] To: ${payload.to}, Subject: ${payload.subject}`);
      logger.info(`[EMAIL] Template: ${payload.template}, Data:`, payload.data);
      return true;
    }

    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // For now, just log
    logger.info(`[EMAIL] Sending to ${payload.to}: ${payload.subject}`);
    return true;
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
