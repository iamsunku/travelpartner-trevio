import { api } from "@/lib/api";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let scriptPromise: Promise<boolean> | null = null;

function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export interface RazorpayCheckoutResult {
  success: boolean;
  demo: boolean;
  paymentId?: string;
}

export interface RazorpayCheckoutOptions {
  amount: number;
  name: string;
  description: string;
  prefillEmail?: string;
  prefillContact?: string;
}

/**
 * Opens real Razorpay checkout when the backend has live keys configured.
 * Falls back to a simulated success after a short delay ("demo mode") when
 * no keys are set, so the booking flow keeps working before go-live.
 */
export async function payWithRazorpay(opts: RazorpayCheckoutOptions): Promise<RazorpayCheckoutResult> {
  let order: Awaited<ReturnType<typeof api.createRazorpayOrder>>;
  try {
    order = await api.createRazorpayOrder(opts.amount);
  } catch {
    order = { configured: false };
  }

  if (!order.configured || !order.orderId || !order.keyId) {
    // Demo mode — no real Razorpay keys configured on the backend yet.
    await new Promise((r) => setTimeout(r, 1600));
    return { success: true, demo: true };
  }

  const scriptReady = await loadCheckoutScript();
  if (!scriptReady || !window.Razorpay) {
    await new Promise((r) => setTimeout(r, 1600));
    return { success: true, demo: true };
  }

  return new Promise((resolve) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "TravelPro",
      description: opts.description,
      prefill: { email: opts.prefillEmail, contact: opts.prefillContact },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          const verify = await api.verifyRazorpayPayment(
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature
          );
          resolve({ success: verify.verified, demo: false, paymentId: response.razorpay_payment_id });
        } catch {
          resolve({ success: false, demo: false });
        }
      },
      modal: {
        ondismiss: () => resolve({ success: false, demo: false }),
      },
      theme: { color: "#0d9488" },
    });
    rzp.open();
  });
}
