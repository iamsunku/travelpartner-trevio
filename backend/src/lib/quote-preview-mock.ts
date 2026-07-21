export function getQuotePreviewMockData() {
  return {
    quoteNumber: "QT-2026-0042",
    quoteDate: "21 Jul 2026",
    validUntil: "28 Jul 2026",
    agency: {
      name: "Wanderlust Travels",
      tagline: "Crafting Unforgettable Journeys",
      phone: "+91 22 4000 1234",
      email: "quotes@wanderlusttravels.in",
      website: "www.wanderlusttravels.in",
    },
    customer: {
      name: "Mr. Rajesh & Mrs. Priya Sharma",
      email: "rajesh.sharma@email.com",
      phone: "+91 98765 43210",
      pax: "2 Adults",
    },
    package: {
      name: "Phuket Paradise Escape",
      destination: "Phuket, Thailand",
      duration: "5 Days / 4 Nights",
      travelDates: "15 Aug 2026 – 19 Aug 2026",
      heroImage: "https://images.unsplash.com/photo-1552465011-b21e7e7a2598?w=800",
    },
    highlights: [
      "Phi Phi Islands day tour with lunch",
      "4-star beachfront resort with breakfast",
      "Airport transfers included",
      "James Bond Island excursion",
    ],
    days: [
      {
        dayNumber: 1,
        title: "Arrival & Welcome",
        items: [
          { time: "14:00", title: "Airport Pickup", description: "Private transfer to resort" },
          { time: "16:00", title: "Hotel Check-in", description: "Amari Phuket - Premium Room" },
          { time: "19:00", title: "Welcome Dinner", description: "Leisure at hotel" },
        ],
      },
      {
        dayNumber: 2,
        title: "Phi Phi Island Tour",
        items: [
          { time: "08:00", title: "Breakfast", description: "At hotel" },
          { time: "09:30", title: "Phi Phi Tour", description: "Speedboat with snorkeling" },
          { time: "18:00", title: "Return to Hotel", description: "" },
        ],
      },
      {
        dayNumber: 3,
        title: "Leisure Day",
        items: [
          { time: "10:00", title: "Spa & Beach", description: "Free time at Patong Beach" },
        ],
      },
    ],
    hotels: [
      { name: "Amari Phuket", category: "4-Star Premium", nights: 4, room: "Deluxe Sea View", mealPlan: "Breakfast" },
    ],
    flights: [
      { route: "BOM → HKT", airline: "Thai Airways", flightNo: "TG-316", date: "15 Aug 2026", class: "Economy" },
      { route: "HKT → BOM", airline: "Thai Airways", flightNo: "TG-315", date: "19 Aug 2026", class: "Economy" },
    ],
    transfers: [
      { name: "Airport ↔ Hotel", type: "Private SUV", notes: "Meet & greet included" },
    ],
    pricing: {
      hotelCost: 85000,
      activityCost: 32000,
      transferCost: 8000,
      flightCost: 72000,
      markup: 15000,
      discount: 5000,
      tax: 12160,
      total: 219160,
      currency: "INR",
    },
    inclusions: [
      "4 nights accommodation with daily breakfast",
      "All transfers in private air-conditioned vehicle",
      "Phi Phi Island tour with lunch",
      "All applicable taxes",
    ],
    exclusions: [
      "International flights (quoted separately)",
      "Personal expenses and tips",
      "Travel insurance",
      "Visa fees",
    ],
    visa: {
      required: true,
      details: "Visa on Arrival available for Indian passport holders. Valid passport (6+ months) required.",
    },
    terms: "Quote valid for 7 days. 50% advance required to confirm. Balance due 15 days before departure.",
    cancellation: "30+ days: 25% charge. 15-29 days: 50% charge. Less than 15 days: 100% charge.",
    notes: "Rates subject to availability at time of booking. Peak season surcharge may apply.",
    contact: {
      executive: "Ananya Mehta",
      designation: "Senior Travel Consultant",
      phone: "+91 98765 11111",
      email: "ananya@wanderlusttravels.in",
    },
    customHtml: "<p><strong>Thank you</strong> for choosing Wanderlust Travels. We look forward to planning your dream vacation!</p>",
  };
}
