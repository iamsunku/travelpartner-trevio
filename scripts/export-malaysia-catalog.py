"""Export Malaysia hotels + KTH transfers/tickets/guides to one JSON catalog."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(r"C:\Users\user\Desktop\travelpartner-trevio")
HOTEL_XLSX = ROOT / "Malaysia Contracted rates .xlsx"
KTH_XLSX = ROOT / "KTH RATE SHEET 2026 - TREVIO.xlsx"
OUT = ROOT / "scripts" / "malaysia-catalog.json"

USD_TO_INR = 84.0
MYR_TO_INR = 19.0
VALID_FROM = "2026-01-01"
VALID_TO = "2026-12-31"


def money(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"([\d.]+)", str(v).replace(",", ""))
    return float(m.group(1)) if m else None


def parse_hotels():
    df = pd.read_excel(HOTEL_XLSX, sheet_name="Sheet1", header=None)
    city = "Kuala Lumpur"
    hotel = None
    star = 3
    hotels = []
    for _, row in df.iterrows():
        a = "" if pd.isna(row[0]) else str(row[0]).strip()
        b = "" if pd.isna(row[1]) else str(row[1]).strip()
        c = row[2]
        if not a and not b:
            continue
        if a and not b and a.isupper() and "*" not in a and "HOTEL" not in a.upper() and len(a) < 40:
            city_map = {
                "KUALA LUMPUR": "Kuala Lumpur",
                "GENTING": "Genting Highlands",
                "LANGKAWI": "Langkawi",
                "PENANG": "Penang",
            }
            city = city_map.get(a, a.title())
            hotel = None
            continue
        if "HOTEL RATE" in a.upper() or "HOTEL RATE" in b.upper():
            continue
        if a and ("Room Price" in b or b == "Room Price"):
            m = re.search(r"(\d)\s*\*", a)
            star = int(m.group(1)) if m else (3 if "3 Star" in a else (4 if "4 Star" in a else (5 if "5 Star" in a else 3)))
            name = re.sub(r"\s*\d\s*\*.*", "", a).strip()
            name = re.sub(r"\s*\([^)]*Star[^)]*\)", "", name, flags=re.I).strip()
            hotel = {"name": name, "city": city, "country": "Malaysia", "starCategory": star, "rooms": []}
            hotels.append(hotel)
            continue
        if hotel and a and b:
            usd = money(row[1])
            ebed = money(c)
            if usd is None:
                continue
            inr = round(usd * USD_TO_INR)
            ebed_inr = round(ebed * USD_TO_INR) if ebed is not None else None
            hotel["rooms"].append(
                {
                    "name": a,
                    "usd": round(usd, 2),
                    "extraBedUsd": round(ebed, 2) if ebed is not None else None,
                    "inr": inr,
                    "extraBedInr": ebed_inr,
                }
            )
    # dedupe hotels by name+city keeping merged rooms
    by_key = {}
    for h in hotels:
        key = (h["city"], h["name"].lower())
        if key not in by_key:
            by_key[key] = h
        else:
            by_key[key]["rooms"].extend(h["rooms"])
    return list(by_key.values())


def parse_transfer_sheet(sheet: str, city: str):
    df = pd.read_excel(KTH_XLSX, sheet_name=sheet, header=None)
    # Find header row with CAR
    start = 0
    for i, row in df.iterrows():
        vals = [str(v).upper() if not pd.isna(v) else "" for v in row.tolist()]
        if any("CAR" == v.strip() or v.strip().startswith("CAR") for v in vals):
            start = i + 2  # skip pax row
            break
    out = []
    for i, row in df.iloc[start:].iterrows():
        name = row[1]
        if not isinstance(name, str) or not name.strip():
            continue
        name = name.strip()
        if name.upper().startswith("DESTINATION") or "RATE SHEET" in name.upper():
            continue
        # columns vary: KL has name at 1, car 2,10seat 3,18 4,guide 5
        # Langkawi/Penang may have empty col 2
        nums = []
        for v in row.tolist()[2:]:
            n = money(v)
            if n is not None:
                nums.append(n)
        if not nums:
            continue
        # skip section headers without rates in car-like first col if name is short section title
        if len(name) < 12 and "transfer" not in name.lower() and "tour" not in name.lower():
            continue
        car = nums[0] if len(nums) > 0 else None
        van10 = nums[1] if len(nums) > 1 else None
        van18 = nums[2] if len(nums) > 2 else None
        guide = nums[3] if len(nums) > 3 else None
        if car is None:
            continue
        out.append(
            {
                "name": name,
                "city": city,
                "country": "Malaysia",
                "myr": {
                    "car": car,
                    "van10": van10,
                    "van18": van18,
                    "van18Guide": guide,
                },
                "inr": {
                    "car": round(car * MYR_TO_INR),
                    "van10": round(van10 * MYR_TO_INR) if van10 is not None else None,
                    "van18": round(van18 * MYR_TO_INR) if van18 is not None else None,
                    "van18Guide": round(guide * MYR_TO_INR) if guide is not None else None,
                },
            }
        )
    return out


def parse_tickets():
    df = pd.read_excel(KTH_XLSX, sheet_name="TICKET", header=None)
    tickets = []
    for _, row in df.iterrows():
        vals = ["" if pd.isna(v) else str(v).strip() for v in row.tolist()]
        if len(vals) < 6:
            continue
        name, city, adult, child = vals[2], vals[3], vals[4], vals[5]
        a = money(adult)
        if a is None or not name or name.lower() in ("name",):
            continue
        if "RATE SHEET" in name.upper() or city.upper() == "CITY":
            continue
        c = money(child)
        tickets.append(
            {
                "name": name,
                "city": city or "Kuala Lumpur",
                "country": "Malaysia",
                "adultMyr": a,
                "childMyr": c,
                "adultInr": round(a * MYR_TO_INR),
                "childInr": round(c * MYR_TO_INR) if c is not None else None,
            }
        )
    return tickets


def parse_guides():
    df = pd.read_excel(KTH_XLSX, sheet_name="GUIDE", header=None)
    guides = []
    region = "Kuala Lumpur"
    for _, row in df.iterrows():
        name = row[1]
        rate = money(row[2])
        if not isinstance(name, str) or not name.strip():
            continue
        name = name.strip()
        if "Guide Service at" in name:
            region = name.replace("Guide Service at", "").strip()
            continue
        if name.lower() == "name" or rate is None:
            continue
        if "RATE SHEET" in name.upper():
            continue
        guides.append(
            {
                "name": name,
                "city": region,
                "country": "Malaysia",
                "myr": rate,
                "inr": round(rate * MYR_TO_INR),
            }
        )
    return guides


def main():
    hotels = parse_hotels()
    transfers = []
    transfers += parse_transfer_sheet("KUALA LUMPUR ", "Kuala Lumpur")
    transfers += parse_transfer_sheet("LANGKAWI", "Langkawi")
    transfers += parse_transfer_sheet("PENANG", "Penang")
    tickets = parse_tickets()
    guides = parse_guides()

    catalog = {
        "source": {
            "hotels": HOTEL_XLSX.name,
            "kth": KTH_XLSX.name,
            "validFrom": VALID_FROM,
            "validTo": VALID_TO,
            "fx": {"USD_TO_INR": USD_TO_INR, "MYR_TO_INR": MYR_TO_INR},
        },
        "hotels": hotels,
        "transfers": transfers,
        "tickets": tickets,
        "guides": guides,
    }
    OUT.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    print(
        f"Wrote {OUT}\n"
        f"  hotels={len(hotels)} rooms={sum(len(h['rooms']) for h in hotels)}\n"
        f"  transfers={len(transfers)}\n"
        f"  tickets={len(tickets)}\n"
        f"  guides={len(guides)}"
    )


if __name__ == "__main__":
    main()
