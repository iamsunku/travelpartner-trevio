import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { buildQuotationPdfModel, renderQuotationPdf } from "../dist/lib/quotation-pdf/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const quote = {
  quoteNo: "TG-QT-2026-PDF-SAMPLE",
  customerName: "Dillip Traveller",
  destination: "Bali",
  country: "Indonesia",
  travelStartDate: "2026-10-01",
  travelEndDate: "2026-10-05",
  nights: 4,
  days: 5,
  adults: 2,
  children: 1,
  infants: 0,
  currency: "INR",
  total: 12650,
  amount: 12650,
  gst: 0,
  taxRate: 0,
  validTill: "2026-09-20",
  paymentTerms: "50% advance to confirm booking. Balance due 15 days before travel.",
  cancellationPolicy: "Cancellations follow supplier and hotel policies as stated at booking.",
  refundPolicy: "Refunds are processed after supplier confirmation.",
  termsAndConditions: "Rates are subject to availability at the time of confirmation.",
  hotelTerms: "Check-in after 14:00. Early check-in subject to availability.",
  flightTerms: "Flight timings are tentative and subject to airline schedule changes.",
  visaNote: "Travellers are responsible for valid passport and visa requirements.",
  insuranceNote: "Travel insurance is recommended for the full trip duration.",
  forceMajeure: "Trevio Global is not liable for delays caused by force majeure events.",
  travelDisclaimer: "Itinerary sequence may change based on weather and operational feasibility.",
  packages: [
    {
      name: "Deluxe",
      sortOrder: 0,
      isSelected: true,
      pricing: {
        customerPrice: 12650,
        taxAmount: 0,
        taxRate: 0,
        finalPrice: 12650,
        perAdultPrice: 5000,
        perChildPrice: 2650,
      },
      hotels: [{
        hotelName: "Ubud Garden Resort",
        city: "Ubud",
        starCategory: "4",
        roomType: "Deluxe Garden View",
        mealPlan: "Breakfast",
        nights: 4,
        checkIn: "2026-10-01",
        checkOut: "2026-10-05",
        address: "Jl. Raya Ubud, Bali",
        cancellationPolicy: "Free cancellation until 7 days before check-in.",
      }],
      flights: [{
        airline: "Garuda Indonesia",
        flightNo: "GA 851",
        from: "BLR",
        to: "DPS",
        date: "2026-10-01",
        depTime: "08:00",
        arrTime: "16:00",
        cabin: "Economy",
        baggage: "20kg",
        duration: "6h",
      }],
      transfers: [{
        transferType: "Airport transfer",
        route: "DPS to Ubud",
        vehicleType: "Innova",
        pickup: "Arrival hall",
        date: "2026-10-01",
        description: "Private meet and greet",
      }],
      activities: [{ activityName: "Temple visit", description: "Morning temple circuit with local guide" }],
      meals: [{ mealType: "Dinner", restaurant: "Ubud Kitchen", date: "Day 2", description: "Welcome dinner" }],
      itinerary: [
        { day: 1, title: "Arrival in Bali", city: "Ubud", date: "2026-10-01", items: [{ activityName: "Airport pickup", description: "Transfer to hotel and check-in" }], mealPlan: "Dinner" },
        { day: 2, title: "Ubud temples", city: "Ubud", date: "2026-10-02", items: [{ activityName: "Temple visit", description: "Tirta Empul and surrounding villages" }], mealPlan: "Breakfast" },
        { day: 3, title: "Leisure day", city: "Ubud", date: "2026-10-03", items: [{ description: "Free time for spa or shopping" }], mealPlan: "Breakfast" },
        { day: 4, title: "Rice terraces", city: "Tegalalang", date: "2026-10-04", items: [{ activityName: "Tegalalang", description: "Guided walk through rice terraces" }], mealPlan: "Breakfast" },
        { day: 5, title: "Departure", city: "Denpasar", date: "2026-10-05", items: [{ description: "Checkout and airport transfer" }], mealPlan: "Breakfast" },
      ],
      inclusions: ["Accommodation", "Daily breakfast", "Airport transfers", "Temple visit"],
      exclusions: ["International flights optional surcharge", "Personal expenses", "Travel insurance"],
    },
    {
      name: "Premium",
      sortOrder: 1,
      pricing: { customerPrice: 18000, taxAmount: 0, finalPrice: 18000, perAdultPrice: 7000, perChildPrice: 4000 },
      hotels: [{ hotelName: "Seminyak Suites", city: "Seminyak", starCategory: "5", roomType: "Ocean Suite", mealPlan: "Breakfast", nights: 4 }],
      flights: [{ airline: "Singapore Airlines", from: "BLR", to: "DPS", date: "2026-10-01", cabin: "Premium Economy" }],
      transfers: [{ transferType: "Private transfer", vehicleType: "Mercedes", route: "DPS to Seminyak" }],
      activities: [{ activityName: "Sunset cruise", description: "Private evening cruise" }],
      meals: [],
      itinerary: [{ day: 1, title: "Arrival Premium", city: "Seminyak", items: [{ description: "Private transfer and butler check-in" }] }],
      inclusions: ["Accommodation", "Breakfast", "Private transfers"],
      exclusions: ["Personal expenses"],
    },
  ],
};

const model = buildQuotationPdfModel({
  quote,
  branding: {
    agencyName: "Trevio Global",
    phone: "+91 89516 63471",
    email: "hello@trevioglobal.com",
    address: "Bengaluru, India",
    footerText: "Trevio Global • Travel with clarity",
  },
  mode: "customer",
  audience: "customer",
});
const rendered = await renderQuotationPdf(model);
const outDir = path.resolve(__dirname, "../../phase5-artifacts");
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "sample-customer-quotation.pdf");
await writeFile(outPath, rendered.buffer);
console.log(JSON.stringify({
  outPath,
  pageCount: rendered.pageCount,
  sizeBytes: rendered.buffer.length,
  packageCount: model.packages.length,
  quoteNo: model.quoteNo,
}, null, 2));
