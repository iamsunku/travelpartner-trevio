import type { ProposalSnapshotData } from "./proposal-snapshot.js";

function formatDate(iso?: string | Date | null) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function customerName(snapshot: ProposalSnapshotData): string {
  if (snapshot.customer?.name) return String(snapshot.customer.name);
  if (snapshot.lead?.customerName) return String(snapshot.lead.customerName);
  return "Guest";
}

export function snapshotToPreviewData(snapshot: ProposalSnapshotData, proposalNumber: string, validUntil?: string | Date | null) {
  if (snapshot.builderMode === "day_itinerary") {
    const trip = (snapshot.trip ?? {}) as Record<string, unknown>;
    const branding = snapshot.branding as Record<string, unknown> | null;
    const itineraryDays = (snapshot.days ?? []) as Record<string, unknown>[];
    const cities = Array.isArray(trip.cities)
      ? (trip.cities as { city?: string; nights?: number }[]).map((c) => c.city).filter(Boolean).join(" → ")
      : String(snapshot.destination?.name ?? "");
    const days = itineraryDays.map((d) => {
      const items: { time: string; title: string; description: string }[] = [];
      const hotel = d.hotel as Record<string, unknown> | null | undefined;
      if (hotel?.name) items.push({ time: "", title: `Hotel: ${String(hotel.name)}`, description: "" });
      for (const t of (d.transfers as Record<string, unknown>[] | undefined) ?? []) {
        items.push({ time: "", title: `Transfer: ${String(t.name)}`, description: "" });
      }
      for (const a of (d.activities as Record<string, unknown>[] | undefined) ?? []) {
        items.push({ time: "", title: String(a.name ?? "Activity"), description: "" });
      }
      for (const m of (d.meals as Record<string, unknown>[] | undefined) ?? []) {
        items.push({ time: "", title: `Meal: ${String(m.name)}`, description: "" });
      }
      for (const x of (d.misc as Record<string, unknown>[] | undefined) ?? []) {
        items.push({ time: "", title: String(x.name ?? "Misc"), description: "" });
      }
      return {
        dayNumber: Number(d.dayNumber ?? 1),
        title: `Day ${d.dayNumber} — ${String(d.city ?? "")}`,
        items,
      };
    });
    const agencyName = branding?.footerText ? String(branding.footerText).split("·")[0]?.trim() : "Travel Agency";
    return {
      quoteNumber: proposalNumber,
      quoteDate: formatDate(new Date()),
      validUntil: formatDate(validUntil),
      agency: { name: agencyName, tagline: "Your trusted travel partner", phone: "", email: "", website: "" },
      customer: {
        name: customerName(snapshot),
        email: String(snapshot.customer?.email ?? snapshot.lead?.email ?? ""),
        phone: String(snapshot.customer?.phone ?? snapshot.lead?.phone ?? ""),
        pax: `${trip.adults ?? 1} Adults${Number(trip.children) ? ` + ${trip.children} Children` : ""}`,
      },
      package: {
        name: String(trip.title ?? snapshot.package?.packageName ?? "Travel Proposal"),
        destination: cities,
        duration: `${itineraryDays.length} Days / ${Number(snapshot.package?.durationNights ?? Math.max(0, itineraryDays.length - 1))} Nights`,
        travelDates: trip.startDate ? `${formatDate(String(trip.startDate))} – ${formatDate(String(trip.endDate))}` : "—",
        heroImage: String(snapshot.destination?.heroImage ?? snapshot.destination?.thumbnail ?? "https://images.unsplash.com/photo-1552465011-b21e7e7a2598?w=800"),
      },
      highlights: snapshot.terms.inclusions,
      days,
      hotels: itineraryDays
        .map((d) => d.hotel as Record<string, unknown> | null | undefined)
        .filter(Boolean)
        .map((h) => ({
          name: String(h!.name),
          category: "Standard",
          nights: 1,
          room: "As selected",
          mealPlan: "As selected",
        })),
      activities: [],
      flights: [],
      transfers: [{ name: "As per day itinerary", type: "Private", notes: "" }],
      pricing: {
        hotelCost: snapshot.pricing.hotelCost,
        activityCost: snapshot.pricing.activityCost,
        transferCost: snapshot.pricing.transferCost,
        flightCost: 0,
        markup: snapshot.pricing.markup,
        discount: snapshot.pricing.discount,
        tax: snapshot.pricing.tax,
        total: snapshot.pricing.total,
        currency: snapshot.pricing.currency,
      },
      inclusions: snapshot.terms.inclusions,
      exclusions: snapshot.terms.exclusions,
      visa: { required: snapshot.terms.visaRequired, details: snapshot.terms.visaDetails },
      terms: snapshot.terms.termsText,
      cancellation: snapshot.terms.cancellationText,
      notes: "",
      contact: { executive: "", designation: "Travel Consultant", phone: "", email: "" },
      customHtml: "",
    };
  }

  const pkg = snapshot.package as Record<string, unknown>;
  const req = snapshot.requirement as Record<string, unknown> | null;
  const branding = snapshot.branding as Record<string, unknown> | null;
  const destination = snapshot.destination as Record<string, unknown> | null;
  const days = ((pkg.days as Record<string, unknown>[]) ?? []).map((d) => ({
    dayNumber: Number(d.dayNumber),
    title: String(d.title ?? ""),
    items: ((d.items as Record<string, unknown>[]) ?? []).map((item) => ({
      time: String(item.startTime ?? ""),
      title: String(item.title ?? ""),
      description: String(item.description ?? ""),
    })),
  }));

  const hotels = ((pkg.hotels as Record<string, unknown>[]) ?? []).map((h) => {
    const hp = h.hotelProduct as Record<string, unknown> | undefined;
    return {
      name: String(hp?.name ?? "Hotel"),
      category: snapshot.productSelections.hotelOptionGroup ?? "Standard",
      nights: Number(pkg.durationNights ?? 0),
      room: "As per selection",
      mealPlan: "Breakfast",
    };
  });

  const activities = ((pkg.activities as Record<string, unknown>[]) ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const ap = (row.activityProduct as Record<string, unknown> | undefined) ?? {};
    return {
      name: String(ap.name ?? "Activity"),
      duration: String(ap.duration ?? "—"),
      description: String(ap.description ?? ""),
      location: String(ap.location ?? ap.meetingPoint ?? ""),
    };
  });

  const agencyName = branding?.footerText ? String(branding.footerText).split("·")[0]?.trim() : "Travel Agency";

  return {
    quoteNumber: proposalNumber,
    quoteDate: formatDate(new Date()),
    validUntil: formatDate(validUntil),
    agency: {
      name: agencyName,
      tagline: "Your trusted travel partner",
      phone: "",
      email: "",
      website: "",
    },
    customer: {
      name: customerName(snapshot),
      email: String(snapshot.customer?.email ?? snapshot.lead?.email ?? ""),
      phone: String(snapshot.customer?.phone ?? snapshot.lead?.phone ?? ""),
      pax: req ? `${req.adults ?? 1} Adults${Number(req.children) ? ` + ${req.children} Children` : ""}` : "—",
    },
    package: {
      name: String(pkg.packageName ?? "Travel Package"),
      destination: String(destination?.name ?? ""),
      duration: `${pkg.durationDays ?? 0} Days / ${pkg.durationNights ?? 0} Nights`,
      travelDates: req ? `${formatDate(req.travelStartDate as string)} – ${formatDate(req.travelEndDate as string)}` : "—",
      heroImage: String(pkg.heroImage ?? destination?.heroImage ?? destination?.thumbnail ?? "https://images.unsplash.com/photo-1552465011-b21e7e7a2598?w=800"),
    },
    highlights: Array.isArray(pkg.highlights) ? (pkg.highlights as string[]) : snapshot.terms.inclusions,
    days,
    hotels: hotels.length ? hotels : [{ name: "Hotel TBD", category: snapshot.productSelections.hotelOptionGroup ?? "Standard", nights: Number(pkg.durationNights ?? 0), room: "Standard", mealPlan: "BB" }],
    activities,
    flights: [],
    transfers: [{ name: "Airport Transfers", type: snapshot.productSelections.transferOptionGroup ?? "Private", notes: "As per itinerary" }],
    pricing: {
      hotelCost: snapshot.pricing.hotelCost,
      activityCost: snapshot.pricing.activityCost,
      transferCost: snapshot.pricing.transferCost,
      flightCost: 0,
      markup: snapshot.pricing.markup,
      discount: snapshot.pricing.discount,
      tax: snapshot.pricing.tax,
      total: snapshot.pricing.total,
      currency: snapshot.pricing.currency,
    },
    inclusions: snapshot.terms.inclusions,
    exclusions: snapshot.terms.exclusions,
    visa: { required: snapshot.terms.visaRequired, details: snapshot.terms.visaDetails },
    terms: snapshot.terms.termsText,
    cancellation: snapshot.terms.cancellationText,
    notes: "",
    contact: {
      executive: String(snapshot.customer?.name ? "" : ""),
      designation: "Travel Consultant",
      phone: "",
      email: "",
    },
    customHtml: "",
  };
}

export function compareSnapshots(a: ProposalSnapshotData, b: ProposalSnapshotData) {
  const fields: { field: string; before: unknown; after: unknown }[] = [];

  const compare = (field: string, va: unknown, vb: unknown) => {
    if (JSON.stringify(va) !== JSON.stringify(vb)) fields.push({ field, before: va, after: vb });
  };

  compare("productSelections", a.productSelections, b.productSelections);
  compare("pricing", a.pricing, b.pricing);
  compare("markup", a.pricing.markup, b.pricing.markup);
  compare("discount", a.pricing.discount, b.pricing.discount);
  compare("total", a.pricing.total, b.pricing.total);
  compare("terms", a.terms, b.terms);

  return fields;
}
