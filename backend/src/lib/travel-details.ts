export type FlightDetail = {
  airline?: string;
  flightNumber?: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
  pnr?: string;
  selfBooked?: boolean;
};

export type HotelDetail = {
  name?: string;
  checkIn?: string;
  checkOut?: string;
  confirmationNo?: string;
  roomCategory?: string;
  mealPlan?: string;
  selfBooked?: boolean;
};

export type TravelDetails = {
  flights?: FlightDetail[];
  hotel?: HotelDetail;
};

export function parseTravelDetails(raw: unknown): TravelDetails {
  if (!raw || typeof raw !== "object") return { flights: [], hotel: {} };
  const o = raw as Record<string, unknown>;
  return {
    flights: Array.isArray(o.flights) ? (o.flights as FlightDetail[]) : [],
    hotel: (o.hotel as HotelDetail) || {},
  };
}

export function travelDetailsComplete(
  travelDetails: unknown,
  services: { serviceType: string; status: string; title?: string; confirmationNo?: string | null }[],
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const td = parseTravelDetails(travelDetails);
  const flights = td.flights || [];

  const flightOk = flights.some(
    (f) => Boolean(String(f.from || "").trim() && String(f.to || "").trim() && String(f.date || "").trim()),
  );
  if (!flightOk) missing.push("flight details (from, to, date)");

  const confirmedHotel = services.find((s) => s.serviceType === "Hotel" && s.status === "Confirmed");
  const hotel = td.hotel || {};
  const hotelName = String(hotel.name || confirmedHotel?.title || "").trim();
  if (!hotelName) missing.push("hotel name");

  return { ok: missing.length === 0, missing };
}

export function seedTravelDetailsFromServices(
  services: {
    serviceType: string;
    title: string;
    confirmationNo?: string | null;
    notes?: string | null;
  }[],
): TravelDetails {
  const flights: FlightDetail[] = [];
  let hotel: HotelDetail = {};

  for (const s of services) {
    if (s.serviceType === "Flight") {
      flights.push({
        airline: s.title.split(" ")[0],
        flightNumber: s.title.split(" ").slice(1).join(" ") || undefined,
        pnr: s.confirmationNo || undefined,
        selfBooked: false,
      });
    }
    if (s.serviceType === "Hotel" && !hotel.name) {
      hotel = {
        name: s.title,
        confirmationNo: s.confirmationNo || undefined,
        selfBooked: false,
      };
    }
  }

  return { flights, hotel };
}
