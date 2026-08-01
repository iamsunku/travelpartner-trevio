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
  orderId?: string;
  signature?: string;
  error?: string;
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
 * Demo mode only when backend returns demoAllowed (non-production by default).
 * Production without keys fails closed — no fake "paid" success.
 */
export async function payWithRazorpay(opts: RazorpayCheckoutOptions): Promise<RazorpayCheckoutResult> {
  let order: Awaited<ReturnType<typeof api.createRazorpayOrder>>;
  try {
    order = await api.createRazorpayOrder(opts.amount);
  } catch (e) {
    return {
      success: false,
      demo: false,
      error: e instanceof Error ? e.message : "Unable to start payment",
    };
  }

  if (!order.configured || !order.orderId || !order.keyId) {
    if (order.demoAllowed) {
      await new Promise((r) => setTimeout(r, 800));
      return { success: true, demo: true, paymentId: `demo_pay_${Date.now()}` };
    }
    return {
      success: false,
      demo: false,
      error: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server.",
    };
  }

  const scriptReady = await loadCheckoutScript();
  if (!scriptReady || !window.Razorpay) {
    if (order.demoAllowed) {
      await new Promise((r) => setTimeout(r, 800));
      return { success: true, demo: true, paymentId: `demo_pay_${Date.now()}` };
    }
    return {
      success: false,
      demo: false,
      error: "Razorpay checkout failed to load. Check your network and try again.",
    };
  }

  return new Promise((resolve) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "Trevio Global",
      description: opts.description,
      prefill: { email: opts.prefillEmail, contact: opts.prefillContact },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          const verify = await api.verifyRazorpayPayment(
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature
          );
          resolve({
            success: verify.verified,
            demo: false,
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
          });
        } catch {
          resolve({ success: false, demo: false, error: "Payment verification failed" });
        }
      },
      modal: {
        ondismiss: () => resolve({ success: false, demo: false, error: "Payment cancelled" }),
      },
      theme: { color: "#2A7BBD" },
    });
    rzp.open();
  });
}
