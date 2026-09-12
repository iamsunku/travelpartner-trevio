"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type CustomerQuote = {
  quoteNo?: string;
  customerName?: string;
  destination?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  travelDates?: string;
  nights?: number;
  adults?: number;
  children?: number;
  infants?: number;
  currency?: string;
  total?: number;
  gst?: number;
  validTill?: string;
  status?: string;
  versionNumber?: number;
  currentVersion?: number;
  canRespond?: boolean;
  responseBlockedReason?: string | null;
  termsAndConditions?: string;
  paymentTerms?: string;
  cancellationPolicy?: string;
  specialRequests?: string;
  packages?: Array<{
    id?: string;
    name?: string;
    description?: string;
    total?: number;
    inclusions?: string[];
    exclusions?: string[];
    hotels?: Array<{ hotelName?: string; city?: string; roomType?: string; mealPlan?: string }>;
    flights?: Array<{ airline?: string; flightNo?: string; from?: string; to?: string; date?: string }>;
    itinerary?: Array<{ day?: number | string; title?: string; city?: string }>;
  }>;
};

function money(n: number | undefined, currency = "INR") {
  return `${currency} ${Number(n || 0).toLocaleString("en-IN")}`;
}

export default function CustomerQuotationPage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [quote, setQuote] = useState<CustomerQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState<string | undefined>();
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!token) {
      setError("Missing access link.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getCustomerQuotationByToken(token);
        if (cancelled) return;
        const q = res.quotation as CustomerQuote;
        setQuote(q);
        const selected = q.packages?.find((p) => (p as { isSelected?: boolean }).isSelected) || q.packages?.[0];
        setSelectedPackageId(selected?.id);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Unable to open this quotation link.");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  function respond(kind: "accept" | "reject" | "revision") {
    if (!token || pending) return;
    startTransition(async () => {
      try {
        if (kind === "accept") {
          const res = await api.acceptCustomerQuotation(token, {
            selectedPackageId,
            personName: quote?.customerName,
          });
          setQuote(res.quotation as CustomerQuote);
          setDone(res.idempotent ? "Already accepted — thank you." : "Thank you. Your acceptance has been recorded.");
        } else if (kind === "reject") {
          const res = await api.rejectCustomerQuotation(token, {
            reason: comment || "Declined by customer",
            personName: quote?.customerName,
          });
          setQuote(res.quotation as CustomerQuote);
          setDone("Your decision has been recorded. Thank you for letting us know.");
        } else {
          if (!comment.trim()) {
            setError("Please describe the changes you need.");
            return;
          }
          const res = await api.requestCustomerQuotationRevision(token, {
            comments: comment,
            personName: quote?.customerName,
          });
          setQuote(res.quotation as CustomerQuote);
          setDone("Revision request sent. Your advisor will follow up with an updated quotation.");
        }
        setError(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not submit your response.");
      }
    });
  }

  return (
    <ThemeProvider>
      <main className="min-h-dvh bg-gradient-to-b from-sky-50 to-white text-slate-900">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
          <p className="text-sm font-semibold tracking-wide text-sky-800">Trevio Global</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Your travel quotation</h1>

          {error && !quote && (
            <div className="mt-8 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              {error}
            </div>
          )}

          {quote && (
            <div className="mt-6 space-y-6">
              <section className="rounded-xl border bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Quotation</p>
                    <p className="text-lg font-semibold">{quote.quoteNo}</p>
                    <p className="text-sm text-slate-600">Version {quote.versionNumber}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-slate-500">Valid until</p>
                    <p className="font-medium">{quote.validTill || "—"}</p>
                    <p className="mt-1 text-xs text-slate-500">{quote.status}</p>
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-500">Guest</dt><dd className="font-medium">{quote.customerName}</dd></div>
                  <div><dt className="text-slate-500">Destination</dt><dd className="font-medium">{quote.destination || "—"}</dd></div>
                  <div>
                    <dt className="text-slate-500">Travel dates</dt>
                    <dd className="font-medium">
                      {quote.travelStartDate && quote.travelEndDate
                        ? `${quote.travelStartDate} → ${quote.travelEndDate}`
                        : quote.travelDates || "—"}
                      {quote.nights != null ? ` · ${quote.nights} nights` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Travellers</dt>
                    <dd className="font-medium">
                      {quote.adults ?? 0} adults
                      {(quote.children ?? 0) > 0 ? `, ${quote.children} children` : ""}
                      {(quote.infants ?? 0) > 0 ? `, ${quote.infants} infants` : ""}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Total</dt>
                    <dd className="text-xl font-semibold text-sky-900">{money(quote.total, quote.currency)}</dd>
                  </div>
                </dl>
              </section>

              {(quote.packages || []).map((pkg) => (
                <section key={pkg.id || pkg.name} className="rounded-xl border bg-white/90 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold">{pkg.name}</h2>
                    {quote.canRespond && (quote.packages?.length || 0) > 1 && (
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          name="pkg"
                          checked={selectedPackageId === pkg.id}
                          onChange={() => setSelectedPackageId(pkg.id)}
                        />
                        Select
                      </label>
                    )}
                  </div>
                  {pkg.description && <p className="mt-1 text-sm text-slate-600">{pkg.description}</p>}
                  <p className="mt-2 text-sm font-medium">{money(pkg.total, quote.currency)}</p>
                  {(pkg.hotels?.length || 0) > 0 && (
                    <div className="mt-3 text-sm">
                      <p className="text-xs font-semibold uppercase text-slate-500">Hotels</p>
                      <ul className="mt-1 space-y-1">
                        {pkg.hotels!.map((h, i) => (
                          <li key={i}>{h.hotelName}{h.city ? ` · ${h.city}` : ""}{h.roomType ? ` · ${h.roomType}` : ""}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(pkg.flights?.length || 0) > 0 && (
                    <div className="mt-3 text-sm">
                      <p className="text-xs font-semibold uppercase text-slate-500">Flights</p>
                      <ul className="mt-1 space-y-1">
                        {pkg.flights!.map((f, i) => (
                          <li key={i}>{f.airline} {f.flightNo} · {f.from} → {f.to}{f.date ? ` · ${f.date}` : ""}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(pkg.itinerary?.length || 0) > 0 && (
                    <div className="mt-3 text-sm">
                      <p className="text-xs font-semibold uppercase text-slate-500">Itinerary</p>
                      <ul className="mt-1 space-y-1">
                        {pkg.itinerary!.map((d, i) => (
                          <li key={i}>Day {d.day}: {d.title}{d.city ? ` (${d.city})` : ""}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(pkg.inclusions?.length || 0) > 0 && (
                    <p className="mt-3 text-xs text-slate-600">Includes: {pkg.inclusions!.slice(0, 8).join(", ")}</p>
                  )}
                </section>
              ))}

              {(quote.termsAndConditions || quote.paymentTerms || quote.cancellationPolicy) && (
                <section className="rounded-xl border bg-white/90 p-5 text-sm shadow-sm space-y-2">
                  <h2 className="font-semibold">Terms</h2>
                  {quote.paymentTerms && <p><span className="text-slate-500">Payment:</span> {quote.paymentTerms}</p>}
                  {quote.cancellationPolicy && <p><span className="text-slate-500">Cancellation:</span> {quote.cancellationPolicy}</p>}
                  {quote.termsAndConditions && <p className="whitespace-pre-wrap text-slate-700">{quote.termsAndConditions}</p>}
                </section>
              )}

              {done && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{done}</div>
              )}

              {quote.responseBlockedReason && !done && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  {quote.responseBlockedReason}
                </div>
              )}

              {error && quote && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div>
              )}

              {quote.canRespond && !done && (
                <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
                  <div>
                    <Label htmlFor="comment">Comment / reason (optional for accept; required for revision)</Label>
                    <Textarea
                      id="comment"
                      className="mt-1"
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share any notes for your travel advisor"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={pending} className="bg-teal-700 hover:bg-teal-800" onClick={() => respond("accept")}>
                      Accept
                    </Button>
                    <Button disabled={pending} variant="outline" onClick={() => respond("reject")}>
                      Reject
                    </Button>
                    <Button disabled={pending} variant="secondary" onClick={() => respond("revision")}>
                      Request revision
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">Submitting once is enough — duplicate clicks will not create conflicting decisions.</p>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </ThemeProvider>
  );
}
