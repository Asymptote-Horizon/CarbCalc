# CarbCalc — Student Eco Ledger

A responsive, client-only website built with HTML, CSS and vanilla JavaScript. No backend, account, analytics, or third-party JavaScript libraries are required.

## Run it

1. Unzip the project folder.
2. Open `index.html` in a modern browser. The calculator, field journal, local saving, and file import/export work without a server.
3. For the installable/offline app experience, serve the folder from `localhost` or a static HTTPS host. For example, from this folder run:

   ```bash
   python -m http.server 8000
   ```

   Then visit `http://localhost:8000`.

The service worker/PWA install prompt requires `localhost` or HTTPS. An ordinary static host such as GitHub Pages can serve the site; there is no backend to configure.

## Included features

- **Footprint calculator:** petrol commute, shared electricity, and unsegregated waste, with the calculation breakdown and formulas visible.
- **Choice Lab:** a live what-if scenario for reducing petrol commuting.
- **Eco intentions:** five student-scale actions, saved locally.
- **Environmental field journal:** notes for site visits and observations such as solid waste, air, water, soil, noise, and biodiversity.
- **Pocket data tools:** import a CarbCalc JSON backup or CSV activity log; export a JSON backup; share a text summary using the device's native share sheet where supported.
- **Local-first persistence:** entries are stored in the browser's `localStorage`; nothing is sent to a server.
- **Progressive Web App shell:** installable and offline-capable when served from `localhost` or HTTPS.

## Importing a CSV from a phone

Use the included `sample-activity.csv` as the column template. A CSV must contain these headers:

```csv
date,commute_km,mileage_kmpl,passengers,electricity_kwh_month,occupants,waste_kg_day
```

You can create/export this file from a spreadsheet app on your phone, then select it with **Import a file**. The last CSV row fills the calculator, and all rows are added to the local snapshot history. For a full transfer between devices, export the CarbCalc JSON backup on one device and import that JSON on the other.

## Calculation model and source caveat

The starter factors below are transcribed from the supplied CarbCalc presentation script:

- Petrol: **2.33 kg CO₂ per litre**
- Electricity: **0.82 kg CO₂ per kWh**
- Unsegregated waste: **0.63 kg CO₂ per kg**

The app calculates:

- Petrol = (daily round-trip km ÷ vehicle km/L ÷ occupants) × 2.33
- Electricity = (monthly shared kWh ÷ 30 ÷ occupants) × 0.82
- Waste = daily unsegregated waste kg × 0.63
- Daily total = petrol + electricity + waste

The supplied script's project display bands are used: Green below 6 kg/day, Intermediate from 6 through 14 kg/day, and Dark above 14 kg/day. These are labelled as **project guide bands**, not official ratings or health thresholds. The factors are treated as project starter assumptions, not independently verified regional emission factors. Update and cite them from an appropriate authoritative source before making formal claims.

The current calculation covers only the three categories included in the supplied script. It does not calculate food, flights, public transport lifecycle emissions, purchases, or a complete personal carbon footprint. Field notes are kept separate from CO₂ totals because measurements such as water pH, electrical conductivity, soil properties, and noise are not themselves carbon emissions.

## Phone permissions and privacy

A standard website cannot silently access private data from other apps, such as Google Maps Timeline, phone step counts, utility apps, or background GPS history. CarbCalc does not attempt to do so. It only reads files the user explicitly selects, and uses the browser's share capability only after the user taps **Share my summary**. Keep an exported backup if you clear browser data or change devices; local browser storage is not cloud sync.
