declare module "@sendgrid/mail" {
  interface MailData {
    to: string;
    from: string;
    subject: string;
    html: string;
  }

  interface MailService {
    setApiKey(key: string): void;
    send(data: MailData): Promise<unknown>;
  }

  const sgMail: MailService;
  export default sgMail;
}
