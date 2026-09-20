import pandas as pd
from pathlib import Path
import json
import re

# ---- Hotels ----
hotel_path = Path(r"C:\Users\user\Desktop\travelpartner-trevio\Malaysia Contracted rates .xlsx")
df = pd.read_excel(hotel_path, sheet_name="Sheet1", header=None)
print("=== HOTELS FULL ===")
city = None
hotel = None
star = None
hotels = []
for i, row in df.iterrows():
    a = row[0]
    b = row[1]
    c = row[2]
    a_s = "" if pd.isna(a) else str(a).strip()
    b_s = "" if pd.isna(b) else str(b).strip()
    c_s = "" if pd.isna(c) else str(c).strip()
    if not a_s and not b_s:
        continue
    # City headers: all caps short lines without *
    if a_s and a_s.isupper() and "*" not in a_s and "HOTEL" not in a_s.upper() and len(a_s) < 40 and not b_s:
        city = a_s.title() if a_s != "KUALA LUMPUR" else "Kuala Lumpur"
        print(f"\nCITY: {city}")
        hotel = None
        continue
    if "HOTEL RATE" in a_s.upper() or "HOTEL RATE" in b_s.upper():
        continue
    if a_s and ("Room Price" in b_s or b_s == "Room Price"):
        # hotel header
        m = re.search(r"(\d)\s*\*", a_s)
        star = m.group(1) if m else None
        hotel = re.sub(r"\s*\d\s*\*.*", "", a_s).strip()
        hotel = re.sub(r"\s*\(.*Star.*\)", "", hotel, flags=re.I).strip()
        print(f"  HOTEL: {hotel} star={star}")
        hotels.append({"city": city, "name": hotel, "star": star, "rooms": []})
        continue
    if hotel and a_s and b_s:
        try:
            price = float(b_s.replace("RM", "").strip()) if isinstance(b, str) else float(b)
        except Exception:
            continue
        ebed = None
        try:
            ebed = float(c_s.replace("RM", "").strip()) if c_s else None
            if isinstance(c, (int, float)) and not pd.isna(c):
                ebed = float(c)
        except Exception:
            pass
        hotels[-1]["rooms"].append({"roomType": a_s, "usd": price, "extraBedUsd": ebed})
        print(f"    room: {a_s} usd={price} ebed={ebed}")

print(f"\nTOTAL HOTELS: {len(hotels)}")
print("ROOMS:", sum(len(h["rooms"]) for h in hotels))

# dump summary json
out = Path(r"C:\Users\user\Desktop\travelpartner-trevio\scripts\malaysia-hotels-parsed.json")
out.write_text(json.dumps(hotels, indent=2), encoding="utf-8")
print("wrote", out)

# ---- KTH transfers/tickets counts ----
kth = Path(r"C:\Users\user\Desktop\travelpartner-trevio\KTH RATE SHEET 2026 - TREVIO.xlsx")
xl = pd.ExcelFile(kth)
for sh in xl.sheet_names:
    d = pd.read_excel(kth, sheet_name=sh, header=None)
    # count rows with numeric rates
    n = 0
    for i, row in d.iterrows():
        vals = [v for v in row.tolist()[1:] if isinstance(v, (int, float)) and not pd.isna(v)]
        name = row[1] if len(row) > 1 else None
        if name and isinstance(name, str) and vals and "RATE" not in name.upper() and "DESTINATION" not in name.upper():
            n += 1
    print(f"KTH sheet {sh!r}: ~{n} priced rows, shape={d.shape}")
