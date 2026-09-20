import pandas as pd
from pathlib import Path
import json
import re

kth = Path(r"C:\Users\user\Desktop\travelpartner-trevio\KTH RATE SHEET 2026 - TREVIO.xlsx")
df = pd.read_excel(kth, sheet_name="TICKET", header=None)
print("=== TICKETS ===")
tickets = []
for i, row in df.iterrows():
    vals = ["" if pd.isna(v) else str(v).strip() for v in row.tolist()]
    # expect: nan, sno, name, city, adult, child
    if len(vals) < 6:
        continue
    name = vals[2]
    city = vals[3]
    adult = vals[4]
    child = vals[5]
    if not name or "Ticket" in name and "Entrance" not in name and i < 3:
        pass
    if not re.search(r"\d", adult or ""):
        continue
    if name.lower() in ("name", "ticket", ""):
        continue
    def parse_rm(s):
        m = re.search(r"([\d.]+)", s.replace(",", ""))
        return float(m.group(1)) if m else None
    a = parse_rm(adult)
    c = parse_rm(child) if child else None
    if a is None:
        continue
    tickets.append({"name": name, "city": city, "adultMyr": a, "childMyr": c})
    print(f"{len(tickets):3d}. {city:20s} | {name[:60]:60s} | A={a} C={c}")

print("TOTAL TICKETS", len(tickets))
Path(r"C:\Users\user\Desktop\travelpartner-trevio\scripts\malaysia-tickets-parsed.json").write_text(
    json.dumps(tickets, indent=2), encoding="utf-8"
)

# sample transfer rows from KL
df2 = pd.read_excel(kth, sheet_name="KUALA LUMPUR ", header=None)
print("\n=== KL TRANSFER SAMPLE HEADERS ===")
print(df2.iloc[3:6].to_string())
transfers = []
for i, row in df2.iterrows():
    name = row[1]
    if not isinstance(name, str):
        continue
    if not name.strip().lower().startswith("one way") and "transfer" not in name.lower() and "tour" not in name.lower() and "half" not in name.lower() and "full" not in name.lower():
        continue
    car, v10, v18, guide = row[2], row[3], row[4], row[5]
    def num(v):
        return float(v) if isinstance(v, (int, float)) and not pd.isna(v) else None
    if num(car) is None and num(v10) is None:
        continue
    transfers.append({
        "city": "Kuala Lumpur",
        "name": name.strip(),
        "car": num(car),
        "van10": num(v10),
        "van18": num(v18),
        "van18Guide": num(guide),
    })
print("KL transfers", len(transfers))
print(json.dumps(transfers[:5], indent=2))
Path(r"C:\Users\user\Desktop\travelpartner-trevio\scripts\malaysia-kl-transfers-sample.json").write_text(
    json.dumps(transfers, indent=2), encoding="utf-8"
)
