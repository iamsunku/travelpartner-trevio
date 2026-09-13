import { api } from "@/lib/api";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (resp: { error?: { description?: string } }) => void) => void;
    };
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
 * Never reports success unless Razorpay actually charged (or verified) a payment.
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
    return {
      success: false,
      demo: Boolean(order.demoAllowed),
      error: "Razorpay is not configured. Set a valid rzp_test_ or rzp_live_ Key ID and secret. No payment was taken.",
    };
  }

  const scriptReady = await loadCheckoutScript();
  if (!scriptReady || !window.Razorpay) {
    return {
      success: false,
      demo: false,
      error: "Razorpay checkout failed to load. Check your network and try again.",
    };
  }

  return new Promise((resolve) => {
    try {
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
              error: verify.verified ? undefined : "Payment verification failed",
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
      rzp.on("payment.failed", (resp) => {
        resolve({
          success: false,
          demo: false,
          error: resp?.error?.description || "Payment failed",
        });
      });
      rzp.open();
    } catch {
      resolve({
        success: false,
        demo: false,
        error: "Razorpay checkout could not start. Check that Key ID is a real rzp_test_ or rzp_live_ key.",
      });
    }
  });
}
