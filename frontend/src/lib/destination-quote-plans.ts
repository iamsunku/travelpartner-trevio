import type { QuotationPackage } from "@/types";

export type DestinationQuotePlan = {
  id: string;
  label: string;
  /** Suggested hotel nights when only start date is set (end = start + nights). */
  suggestedNights?: number;
  form: {
    destination: string;
    country: string;
    isInternational: boolean;
    adults: number;
    children: number;
    infants: number;
    currency: string;
    specialRequests: string;
    termsAndConditions: string;
    paymentTerms: string;
    cancellationPolicy: string;
    refundPolicy: string;
    coverImage?: string;
  };
  packages: QuotationPackage[];
};

const IMG = {
  cover: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1600&q=80",
  phuket: "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?auto=format&fit=crop&w=1200&q=80",
  phiPhi: "https://images.unsplash.com/photo-1537956965359-7573183d1f57?auto=format&fit=crop&w=1200&q=80",
  hotelPatong: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
  hotelKrabi: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
  fantasea: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
  tiger: "https://images.unsplash.com/photo-1561731216-c3a4d99437d5?auto=format&fit=crop&w=1200&q=80",
  elephant: "https://images.unsplash.com/photo-1564760055775-d63b17a55c44?auto=format&fit=crop&w=1200&q=80",
  islands: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  krabiTown: "https://images.unsplash.com/photo-1528183429752-a97d0bf99b1a?auto=format&fit=crop&w=1200&q=80",
  departure: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80",
};

const THAILAND_INCLUSIONS = [
  "Accommodation with breakfast in standard room category",
  "2 nights stay at Phuket",
  "2 nights stay at Krabi",
  "Breakfast at the hotel",
  "Meals as stated in the itinerary",
  "Sightseeing as stated",
  "NPF ticket for island tours",
  "English speaking local guide and private A/C transfers",
  "SIC transfers for island tours",
  "02 bottles of mineral water per person per day",
];

const THAILAND_EXCLUSIONS = [
  "Airline meals as per airline policy",
  "Early check-in / late check-out",
  "Items of personal nature not stated",
  "Meals and beverages if not stated",
  "Room service in hotel",
];

/** Client-facing Thailand 4N/5D plan matching the Trevio sample quotation structure. Selling prices are per the brochure (≈ ₹76,000 per pax). Cost is internal-only. */
export const THAILAND_4N_PLAN: DestinationQuotePlan = {
  id: "thailand-4n-phuket-krabi",
  label: "Thailand 4N 5D — Phuket + Krabi",
  suggestedNights: 4,
  form: {
    destination: "Phuket & Krabi",
    country: "Thailand",
    isInternational: true,
    adults: 2,
    children: 0,
    infants: 0,
    currency: "INR",
    coverImage: IMG.cover,
    specialRequests: "Twin/double sharing. Quote is subject to availability and not blocked until confirmed.",
    termsAndConditions:
      "Applicable taxes follow configured Tax Rules on the quotation. Quote is on twin/double sharing basis. TCS can be claimed while filing annual returns. Passport must be valid 6 months after return. PAN is required to confirm booking as per RBI guidelines.",
    paymentTerms:
      "1st instalment: 50% to confirm flight tickets. Final instalment: 50% to confirm the land package. Share payment reference via email/WhatsApp to receive receipt and tickets.",
    cancellationPolicy:
      "INR 5,000 is non-refundable. Remaining charges follow hotel, visa, transport and airline policies. Notify in writing before the minimum-notice date. No refund for unused nights or early check-out except as per hotel policy for medical cases.",
    refundPolicy:
      "Refunds (if any) are processed after supplier confirmation, typically within 15 working days. Flight fares are guaranteed only at ticket issuance.",
  },
  packages: [
    {
      name: "Standard",
      isSelected: true,
      sortOrder: 0,
      description: "Thailand 4N & 5D (Krabi 2N & Phuket 2N)",
      hotels: [
        {
          hotelName: "Sunshine Patong or similar",
          starCategory: "3",
          roomType: "Deluxe",
          mealPlan: "Breakfast",
          checkIn: "",
          checkOut: "",
          rooms: 1,
          nights: 2,
          city: "Phuket",
          address: "Patong 34/81-88 Prachanukroh Rd, Pa Tong, Kathu District, Phuket 83150, Thailand",
          rating: "3.8",
          imageUrl: IMG.hotelPatong,
          costPrice: 14000,
          sellingPrice: 18500,
        },
        {
          hotelName: "Aonang Paradise Resort Krabi or similar",
          starCategory: "3",
          roomType: "Superior",
          mealPlan: "Breakfast",
          checkIn: "",
          checkOut: "",
          rooms: 1,
          nights: 2,
          city: "Krabi",
          address: "25/18 Moo 2, Ao Nang, Muang, Krabi 81180, Thailand",
          rating: "3.9",
          imageUrl: IMG.hotelKrabi,
          costPrice: 12500,
          sellingPrice: 16500,
        },
      ],
      flights: [
        {
          airline: "Akasa Air",
          flightNumber: "BLR-HKT",
          from: "BLR",
          to: "HKT",
          date: "",
          depTime: "09:50",
          arrTime: "15:05",
          cabinClass: "Economy",
          remarks: "Baggage: check-in + 7 kg hand baggage. Fares tentative until issued.",
          costPrice: 12500,
          sellingPrice: 16750,
          fare: 16750,
          qty: 2,
        },
        {
          airline: "Akasa Air",
          flightNumber: "HKT-BLR",
          from: "HKT",
          to: "BLR",
          date: "",
          depTime: "17:00",
          arrTime: "19:20",
          cabinClass: "Economy",
          remarks: "Return sector. Combined flight ≈ ₹33,500 per pax (tentative until issued).",
          costPrice: 12500,
          sellingPrice: 16750,
          fare: 16750,
          qty: 2,
        },
      ],
      transfers: [
        {
          transferType: "Private A/C transfers",
          vehicleType: "Van",
          pickup: "Phuket airport / hotel",
          drop: "Hotels & Krabi",
          costPrice: 4500,
          sellingPrice: 6500,
        },
        {
          transferType: "SIC island tour transfers",
          vehicleType: "Coach",
          pickup: "Hotel",
          drop: "Pier / hotel",
          costPrice: 2000,
          sellingPrice: 3000,
        },
      ],
      activities: [
        {
          activityName: "Fantasea Show with Dinner",
          description: "Evening cultural show in Phuket with dinner on arrival day.",
          ticketType: "Show",
          imageUrl: IMG.fantasea,
          costPrice: 2800,
          sellingPrice: 4000,
          adults: 2,
          children: 0,
        },
        {
          activityName: "Phi Phi Island tour with lunch",
          description:
            "Speedboat from Phuket covering Green Island, Loh Samah Bay and Pileh Lagoon, with snorkeling and Thai buffet lunch. NPF ticket included.",
          ticketType: "Tour",
          imageUrl: IMG.phiPhi,
          costPrice: 5500,
          sellingPrice: 8000,
          adults: 2,
          children: 0,
        },
        {
          activityName: "Tiger Kingdom — Medium tiger",
          description:
            "Interactive wildlife park in Kathu. Photo experience with hand-raised tigers under trainer supervision. Ticket by cat size.",
          ticketType: "Attraction",
          imageUrl: IMG.tiger,
          costPrice: 3500,
          sellingPrice: 5000,
          adults: 2,
          children: 0,
        },
        {
          activityName: "Elephant Sanctuary (feed)",
          description:
            "Ethical hillside sanctuary. Observation and respectful feeding without forced bathing. Small quiet groups.",
          ticketType: "Attraction",
          imageUrl: IMG.elephant,
          costPrice: 3500,
          sellingPrice: 5000,
          adults: 2,
          children: 0,
        },
        {
          activityName: "4 Island long-tail cruise",
          description:
            "Krabi four islands: Poda, Chicken Island and snorkeling in turquoise water. Local lunch (SIC). NPF ticket included.",
          ticketType: "Cruise",
          imageUrl: IMG.islands,
          costPrice: 4200,
          sellingPrice: 6000,
          adults: 2,
          children: 0,
        },
        {
          activityName: "Krabi City Tour",
          description:
            "Temples, river ecosystem and local markets — a slower cultural day en route to Phuket departure.",
          ticketType: "Local Tour",
          imageUrl: IMG.krabiTown,
          costPrice: 1800,
          sellingPrice: 2800,
          adults: 2,
          children: 0,
        },
      ],
      meals: [
        {
          mealType: "Dinner",
          restaurant: "As per itinerary coupons",
          cuisine: "Thai",
          costPrice: 2400,
          sellingPrice: 3600,
          adults: 2,
          children: 0,
          adultRate: 1800,
          childRate: 0,
        },
      ],
      itinerary: [
        {
          day: 1,
          title: "Day 1: Arrival in Phuket & Fantasea Show with Dinner",
          city: "Phuket",
          mealPlan: "Dinner",
          coverImage: IMG.phuket,
          gallery: [IMG.hotelPatong, IMG.fantasea],
          items: [
            { activityName: "Arrival in Phuket", description: "Airport meet & transfer" },
            { activityName: "Hotel check-in", description: "Sunshine Patong or similar" },
            { activityName: "Fantasea Show with Dinner", description: "Evening show" },
          ],
        },
        {
          day: 2,
          title: "Day 2: Phi Phi Paradise",
          city: "Phuket",
          mealPlan: "Breakfast, Lunch & Dinner",
          coverImage: IMG.phiPhi,
          gallery: [IMG.islands, IMG.cover],
          items: [
            { activityName: "Breakfast & checkout at the hotel", description: "" },
            { activityName: "Phi Phi Island tour with lunch", description: "NPF ticket included" },
            { activityName: "Dinner coupon", description: "" },
          ],
        },
        {
          day: 3,
          title: "Day 3: Phuket wildlife wonders",
          city: "Phuket → Krabi",
          mealPlan: "Breakfast, Lunch & Dinner",
          coverImage: IMG.elephant,
          gallery: [IMG.tiger, IMG.hotelKrabi],
          items: [
            { activityName: "Breakfast in the hotel", description: "" },
            { activityName: "Tiger Kingdom with Medium Tiger", description: "" },
            { activityName: "Lunch coupon", description: "" },
            { activityName: "Elephant Sanctuary Phuket (feed)", description: "" },
            { activityName: "Transfers to Krabi", description: "" },
            { activityName: "Dinner coupon", description: "" },
          ],
        },
        {
          day: 4,
          title: "Day 4: The iconic 4-island long-tail cruise",
          city: "Krabi",
          mealPlan: "Breakfast, Lunch & Dinner",
          coverImage: IMG.islands,
          gallery: [IMG.cover, IMG.phiPhi],
          items: [
            { activityName: "Breakfast in the hotel", description: "" },
            { activityName: "4 Island tour by long-tail boat including local lunch (SIC)", description: "NPF ticket included" },
            { activityName: "Dinner", description: "" },
          ],
        },
        {
          day: 5,
          title: "Day 5: Until next time",
          city: "Krabi → Phuket → Bangalore",
          mealPlan: "Breakfast",
          coverImage: IMG.departure,
          gallery: [IMG.krabiTown],
          items: [
            { activityName: "Breakfast & checkout from the hotel", description: "" },
            { activityName: "Enroute Krabi City Tour to Phuket", description: "" },
            { activityName: "Departure to Bangalore", description: "" },
          ],
        },
      ],
      visa: { enabled: true, visaType: "Tourist", entryType: "Single Entry", sellingPrice: 0, costPrice: 0, remarks: "Passenger is responsible for a valid entry/transit visa. Passport validity 6 months after return." },
      insurance: { enabled: false, provider: "", planName: "", sellingPrice: 0, costPrice: 0 },
      addOns: [],
      inclusions: THAILAND_INCLUSIONS,
      exclusions: THAILAND_EXCLUSIONS,
    },
  ],
};

function destinationPackage(opts: {
  name: string;
  selected?: boolean;
  sortOrder: number;
  description: string;
  hotelName: string;
  star: string;
  roomType: string;
  city: string;
  nights: number;
  hotelCost: number;
  hotelSell: number;
  imageUrl?: string;
  dayTitles: string[];
  inclusions: string[];
  exclusions: string[];
  visa?: boolean;
}): QuotationPackage {
  const days = opts.dayTitles.length;
  return {
    name: opts.name,
    isSelected: Boolean(opts.selected),
    sortOrder: opts.sortOrder,
    description: opts.description,
    hotels: [
      {
        hotelName: opts.hotelName,
        starCategory: opts.star,
        roomType: opts.roomType,
        mealPlan: "Breakfast",
        checkIn: "",
        checkOut: "",
        rooms: 1,
        nights: opts.nights,
        city: opts.city,
        address: "",
        rating: opts.star,
        imageUrl: opts.imageUrl || "",
        costPrice: opts.hotelCost,
        sellingPrice: opts.hotelSell,
      },
    ],
    flights: [
      {
        airline: "To be confirmed",
        flightNumber: "TBA",
        from: "BLR",
        to: opts.city.slice(0, 3).toUpperCase(),
        date: "",
        depTime: "",
        arrTime: "",
        cabinClass: opts.name === "Economy" ? "Economy" : opts.name === "Luxury" ? "Business" : "Economy",
        costPrice: opts.name === "Luxury" ? 45000 : 28000,
        sellingPrice: opts.name === "Luxury" ? 52000 : 34000,
        fare: opts.name === "Luxury" ? 52000 : 34000,
        qty: 2,
      },
    ],
    transfers: [
      {
        transferType: "Airport Pickup",
        vehicleType: opts.name === "Economy" ? "Sedan" : "SUV",
        pickup: "Airport",
        drop: "Hotel",
        date: "",
        costPrice: 1500,
        sellingPrice: 2500,
        source: "MANUAL",
      },
    ],
    activities: [],
    meals: [],
    itinerary: opts.dayTitles.map((title, i) => ({
      day: i + 1,
      title,
      city: opts.city,
      mealPlan: i === 0 ? "Dinner" : i === days - 1 ? "Breakfast" : "Breakfast",
      coverImage: opts.imageUrl || "",
      gallery: [],
      items: [
        {
          activityName: i === 0 ? "Arrival & hotel check-in" : i === days - 1 ? "Checkout & departure" : "Sightseeing / leisure",
          description: "",
          pickupTime: "",
          duration: "",
          vehicle: "",
          guide: "",
          voucher: "",
          remarks: "",
        },
      ],
    })),
    visa: {
      enabled: opts.visa !== false,
      visaType: "Tourist",
      entryType: "Single Entry",
      sellingPrice: 0,
      costPrice: 0,
      remarks: "Confirm visa eligibility before ticketing.",
    },
    insurance: { enabled: false, provider: "", planName: "", sellingPrice: 0, costPrice: 0 },
    addOns: [],
    inclusions: opts.inclusions,
    exclusions: opts.exclusions,
  };
}

function multiTierPlan(opts: {
  id: string;
  label: string;
  destination: string;
  country: string;
  nights: number;
  coverImage: string;
  city: string;
  dayTitles: string[];
  tiers: Array<{
    name: string;
    hotelName: string;
    star: string;
    roomType: string;
    hotelCost: number;
    hotelSell: number;
  }>;
  specialRequests?: string;
}): DestinationQuotePlan {
  const days = opts.nights + 1;
  const baseIncl = [
    "Accommodation with breakfast",
    `${opts.nights} nights stay`,
    "Airport transfers (arrival & departure)",
    "Sightseeing as stated in the itinerary",
  ];
  const baseExcl = [
    "Flights unless listed as confirmed",
    "Early check-in / late check-out",
    "Personal expenses & tips",
    "Travel insurance unless opted",
  ];
  return {
    id: opts.id,
    label: opts.label,
    suggestedNights: opts.nights,
    form: {
      destination: opts.destination,
      country: opts.country,
      isInternational: true,
      adults: 2,
      children: 0,
      infants: 0,
      currency: "INR",
      coverImage: opts.coverImage,
      specialRequests: opts.specialRequests || "Twin/double sharing. Subject to availability until confirmed.",
      termsAndConditions:
        `Applicable taxes follow configured Tax Rules. ${opts.destination} quote on twin/double sharing. Passport must be valid 6 months after return.`,
      paymentTerms: "50% advance to confirm. Balance before travel as per supplier policy.",
      cancellationPolicy: "Cancellation charges follow hotel, airline and ground-supplier policies. Notify in writing.",
      refundPolicy: "Refunds (if any) after supplier confirmation, typically within 15 working days.",
    },
    packages: opts.tiers.map((tier, i) =>
      destinationPackage({
        name: tier.name,
        selected: i === 0,
        sortOrder: i,
        description: `${opts.destination} ${opts.nights}N / ${days}D — ${tier.name}`,
        hotelName: tier.hotelName,
        star: tier.star,
        roomType: tier.roomType,
        city: opts.city,
        nights: opts.nights,
        hotelCost: tier.hotelCost,
        hotelSell: tier.hotelSell,
        imageUrl: opts.coverImage,
        dayTitles: opts.dayTitles,
        inclusions: baseIncl,
        exclusions: baseExcl,
        visa: true,
      }),
    ),
  };
}

export const DESTINATION_QUOTE_PLANS: DestinationQuotePlan[] = [
  THAILAND_4N_PLAN,
  multiTierPlan({
    id: "singapore-3n",
    label: "Singapore 3N 4D",
    destination: "Singapore",
    country: "Singapore",
    nights: 3,
    city: "Singapore",
    coverImage: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1600&q=80",
    dayTitles: [
      "Day 1: Arrival & Marina Bay",
      "Day 2: Sentosa & Universal Studios",
      "Day 3: Gardens by the Bay & city tour",
      "Day 4: Departure",
    ],
    tiers: [
      { name: "Economy", hotelName: "Hotel Boss or similar", star: "3", roomType: "Superior", hotelCost: 18000, hotelSell: 24000 },
      { name: "Deluxe", hotelName: "Parkroyal Collection Marina Bay or similar", star: "4", roomType: "Deluxe", hotelCost: 32000, hotelSell: 42000 },
      { name: "Premium", hotelName: "Marina Bay Sands or similar", star: "5", roomType: "Deluxe Room", hotelCost: 55000, hotelSell: 72000 },
    ],
  }),
  multiTierPlan({
    id: "malaysia-4n",
    label: "Malaysia 4N 5D — Kuala Lumpur",
    destination: "Kuala Lumpur",
    country: "Malaysia",
    nights: 4,
    city: "Kuala Lumpur",
    coverImage: "https://images.unsplash.com/photo-1596422846543-75c6fc7107f2?auto=format&fit=crop&w=1600&q=80",
    dayTitles: [
      "Day 1: Arrival & Petronas Twin Towers",
      "Day 2: Batu Caves & city highlights",
      "Day 3: Genting Highlands day trip",
      "Day 4: Shopping & leisure",
      "Day 5: Departure",
    ],
    tiers: [
      { name: "Economy", hotelName: "Hotel Sentral Pudu or similar", star: "3", roomType: "Standard", hotelCost: 12000, hotelSell: 16000 },
      { name: "Deluxe", hotelName: "Pavilion Hotel Kuala Lumpur or similar", star: "4", roomType: "Deluxe", hotelCost: 22000, hotelSell: 30000 },
      { name: "Premium", hotelName: "Mandarin Oriental KL or similar", star: "5", roomType: "Deluxe", hotelCost: 40000, hotelSell: 52000 },
    ],
  }),
  multiTierPlan({
    id: "bali-5n",
    label: "Bali 5N 6D",
    destination: "Bali",
    country: "Indonesia",
    nights: 5,
    city: "Bali",
    coverImage: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1600&q=80",
    dayTitles: [
      "Day 1: Arrival Ubud / Seminyak",
      "Day 2: Ubud temples & rice terraces",
      "Day 3: Uluwatu & Kecak dance",
      "Day 4: Nusa Penida or leisure beach",
      "Day 5: Spa & shopping",
      "Day 6: Departure",
    ],
    tiers: [
      { name: "Economy", hotelName: "Harris Hotel Seminyak or similar", star: "3", roomType: "Superior", hotelCost: 16000, hotelSell: 22000 },
      { name: "Deluxe", hotelName: "Padma Resort Legian or similar", star: "4", roomType: "Deluxe", hotelCost: 30000, hotelSell: 40000 },
      { name: "Luxury", hotelName: "Four Seasons Jimbaran or similar", star: "5", roomType: "Garden Villa", hotelCost: 70000, hotelSell: 95000 },
    ],
  }),
  multiTierPlan({
    id: "vietnam-5n",
    label: "Vietnam 5N 6D — Da Nang / Hoi An",
    destination: "Da Nang",
    country: "Vietnam",
    nights: 5,
    city: "Da Nang",
    coverImage: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1600&q=80",
    dayTitles: [
      "Day 1: Arrival Da Nang",
      "Day 2: Ba Na Hills & Golden Bridge",
      "Day 3: Hoi An ancient town",
      "Day 4: Marble Mountains & My Khe beach",
      "Day 5: Leisure / optional Hue",
      "Day 6: Departure",
    ],
    tiers: [
      { name: "Economy", hotelName: "Cicilia Hotels & Resort Da Nang or similar", star: "3", roomType: "Superior", hotelCost: 14000, hotelSell: 19000 },
      { name: "Deluxe", hotelName: "Vinpearl Resort & Spa Da Nang or similar", star: "4", roomType: "Deluxe Ocean", hotelCost: 28000, hotelSell: 38000 },
      { name: "Premium", hotelName: "InterContinental Da Nang or similar", star: "5", roomType: "Lantern Suite", hotelCost: 55000, hotelSell: 72000 },
    ],
  }),
  multiTierPlan({
    id: "dubai-4n",
    label: "Dubai 4N 5D",
    destination: "Dubai",
    country: "UAE",
    nights: 4,
    city: "Dubai",
    coverImage: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80",
    dayTitles: [
      "Day 1: Arrival & Dubai Marina",
      "Day 2: Desert safari & BBQ dinner",
      "Day 3: Burj Khalifa & Dubai Mall",
      "Day 4: Abu Dhabi day trip or leisure",
      "Day 5: Departure",
    ],
    tiers: [
      { name: "Economy", hotelName: "Citymax Hotel Bur Dubai or similar", star: "3", roomType: "Standard", hotelCost: 20000, hotelSell: 27000 },
      { name: "Deluxe", hotelName: "Pullman Dubai Downtown or similar", star: "4", roomType: "Deluxe", hotelCost: 38000, hotelSell: 50000 },
      { name: "Luxury", hotelName: "Atlantis The Palm or similar", star: "5", roomType: "Ocean Room", hotelCost: 75000, hotelSell: 98000 },
    ],
  }),
  multiTierPlan({
    id: "europe-7n",
    label: "Europe 7N 8D — Paris starter",
    destination: "Paris",
    country: "France",
    nights: 7,
    city: "Paris",
    coverImage: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=80",
    dayTitles: [
      "Day 1: Arrival Paris",
      "Day 2: Louvre & Seine cruise",
      "Day 3: Eiffel Tower & Champ de Mars",
      "Day 4: Versailles day trip",
      "Day 5: Montmartre & shopping",
      "Day 6: Disneyland Paris (optional)",
      "Day 7: Leisure / museums",
      "Day 8: Departure",
    ],
    specialRequests: "Schengen visa required. Twin sharing. Euro rail / city passes optional add-ons.",
    tiers: [
      { name: "Economy", hotelName: "Ibis Styles Paris or similar", star: "3", roomType: "Standard", hotelCost: 45000, hotelSell: 58000 },
      { name: "Deluxe", hotelName: "Mercure Paris Centre or similar", star: "4", roomType: "Superior", hotelCost: 70000, hotelSell: 90000 },
      { name: "Premium", hotelName: "Hotel Plaza Athénée or similar", star: "5", roomType: "Deluxe", hotelCost: 140000, hotelSell: 180000 },
    ],
  }),
];

export function getDestinationQuotePlan(id: string) {
  return DESTINATION_QUOTE_PLANS.find((p) => p.id === id) || null;
}
