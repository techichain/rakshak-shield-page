# Data fingerprint — Project Rakshak home page

Canonical checksums and a full coordinate manifest for the home page datasets.
Use this to prove a copy of the page carries identical data.

Generated from `src/data/*.json` at commit `41150d9`.

## How to verify a copy

```bash
node scripts/verify-rakshak-data.mjs <path-to-your-copy>
```

Accepts a `.tsx`/`.ts`/`.js` file that inlines the arrays (the standalone
snapshot), a directory of the original `src/data/*.json` files, or a single JSON
file. Exit code `0` = identical, `1` = mismatch. Add
`--against <known-good>` to print the exact differing field paths.

## Checksums

SHA-256, first 32 hex chars, over a canonical serialisation: object keys sorted
recursively and numbers normalised, so formatting, key order and whitespace
cannot change the digest — only real values can. Array order is preserved,
because location order is itself data.

| Dataset | Entries | Digest |
|---|---:|---|
| `LOCATIONS` | 31 | `b9ada03739edd5f1e05b4861b930c880` |
| `STATUS_META` | 7 | `aa49834ee4493a4e367cdc3ac257104b` |
| `RISK_COLORS` | 3 | `159c182bc4d9135e45e1c2c6f8f4f2a3` |
| `RISK_LABELS` | 3 | `ea6f6078d0c2bc030dbc119434c757cf` |
| `PROGRESS_STEPS` | 6 | `71948edf89cb25d927a3e0cd37f323e2` |
| `AUTH_CATEGORIES` | 4 | `2b486317b7c2b5fbf3fae7483429ba17` |
| `STATE_BOUNDS` | 13 | `3b2a4df27d38b567ac8c1782068b869a` |
| `GEO_NAME_MAP` | 2 | `a4d10aea5fe605f9e983772975cdb9cc` |
| `SITE_MAPS` | 28 | `d2fa83022b8f9f84dc5e33242aa34cc6` |
| `UNIVERSITIES` | 20 | `354c102221e508e25af0f115df7a4d8d` |

Coordinates are hashed separately as well, over just the `(id, lat, lng)`
triples, so geographic drift is isolated from edits to any text field:

| Check | Digest |
|---|---|
| `COORDS` — 31 × (id, lat, lng) | `9e2a029e8db2aff49483514ad3ec1d62` |

## Coordinate manifest

The authoritative marker positions. A single transposed digit moves a pin
hundreds of kilometres while still looking plausible in review, so this table
is the thing to check by eye if the script is unavailable.

| id | Location | City | State | Latitude | Longitude | Risk | Authority | Status |
|---:|---|---|---|---:|---:|---|---|---|
| 1 | Kunnamangalam Junction | Kozhikode | Kerala | `11.3068` | `75.8795` | high | state_pwd | implementation_ongoing |
| 2 | Teen Imli Square | Indore | Madhya Pradesh | `22.7196` | `75.8577` | high | municipal | in_principle_approval |
| 3 | NH-27 Boragaon (Post-Flyover) | Guwahati | Assam | `26.1212` | `91.6912` | high | nhai | implementation_ongoing |
| 4 | Tejaji Nagar Junction | Indore | Madhya Pradesh | `22.7052` | `75.8674` | high | municipal | implemented |
| 5 | Kamta Chauraha | Lucknow | Uttar Pradesh | `26.873938` | `81.014813` | high | municipal | submitted |
| 6 | IIT Delhi Outer Ring Road | New Delhi | Delhi | `28.5458` | `77.1956` | high | state_pwd | in_principle_approval |
| 7 | AEC Road Turn, Jalukbari | Guwahati | Assam | `26.155` | `91.6762` | high | nhai | in_principle_approval |
| 8 | Roorkee-Manglaur Bypass | Roorkee | Uttarakhand | `29.8114` | `77.8783` | medium | nhai | submitted |
| 9 | Akurli Road Underpass, Kandivali | Mumbai | Maharashtra | `19.2175` | `72.851` | medium | municipal | implementation_ongoing |
| 10 | Chevayur Junction | Kozhikode | Kerala | `11.2696` | `75.8256` | medium | state_pwd | submitted |
| 11 | Gilat Bazar, Shivpur | Varanasi | Uttar Pradesh | `25.3478` | `82.9702` | medium | municipal | in_principle_approval |
| 12 | Eranjipalam Junction | Kozhikode | Kerala | `11.2623` | `75.8167` | medium | municipal | in_principle_approval |
| 13 | IT Park Chowk | Dehradun | Uttarakhand | `30.3135` | `78.0322` | medium | municipal | implementation_ongoing |
| 14 | Calicut Medical College Junction | Kozhikode | Kerala | `11.2378` | `75.8333` | medium | state_pwd | implementation_ongoing |
| 15 | NH-65 Rythu Bazar, Krishnalanka | Vijayawada | Andhra Pradesh | `16.5193` | `80.6205` | medium | nhai | in_principle_approval |
| 16 | RK Mission Junction, Ganga Market | Itanagar | Arunachal Pradesh | `27.1025` | `93.6325` | medium | state_pwd | submitted |
| 17 | Britannia Chowk | New Delhi | Delhi | `28.6748` | `77.1231` | medium | state_pwd | in_principle_approval |
| 18 | Gurubagh Bhelupur | Varanasi | Uttar Pradesh | `25.312` | `82.9875` | medium | municipal | in_principle_approval |
| 19 | Chuttugunta Circle Roundabout | Guntur | Andhra Pradesh | `16.2912` | `80.4254` | medium | municipal | in_principle_approval |
| 20 | IIT BHU Gate Rotary (Ranjit Chowk) | Varanasi | Uttar Pradesh | `25.2636` | `82.9924` | medium | municipal | in_principle_approval |
| 21 | TIDEL Park U-Bridge Junction, OMR | Chennai | Tamil Nadu | `12.988` | `80.2515` | medium | state_pwd | implementation_ongoing |
| 22 | Rau Gol Square | Indore | Madhya Pradesh | `22.6946` | `75.8875` | medium | municipal | in_principle_approval |
| 23 | Gandhi More, NH-19 Overbridge | Durgapur | West Bengal | `23.5399` | `87.2892` | low | nhai | implementation_ongoing |
| 24 | Bhagwanpur Mod Near Trauma Centre | Varanasi | Uttar Pradesh | `25.42` | `82.965` | low | nhai | in_principle_approval |
| 25 | Bhagat Singh Marg, Hatora C-Zone | Durgapur | West Bengal | `23.5561` | `87.313` | low | dev_auth | submitted |
| 26 | Sardar Patel Road, IIT Madras | Chennai | Tamil Nadu | `13.0107` | `80.235` | low | state_pwd | in_principle_approval |
| 27 | Y-Bifurcation near Milk Bar | Roorkee | Uttarakhand | `29.865` | `77.8933` | low | municipal | submitted |
| 28 | Taramani Gate, IIT Madras | Chennai | Tamil Nadu | `12.9933` | `80.2355` | low | state_pwd | in_principle_approval |
| 29 | Majura Gate | Surat | Gujarat | `21.2155` | `72.8456` | low | municipal | audit_complete |
| 30 | Surjit Chowk, near Surjit Hospital | Rupnagar | Punjab | `30.9667` | `76.5358` | low | state_pwd | stalled |
| 31 | NH-205 Bhatta Sahib + Sukhrampur | Rupnagar | Punjab | `30.9621` | `76.525` | low | nhai | in_principle_approval |

## Shape expectations

A truncated copy can still look reasonable, so counts are asserted too:

```
LOCATIONS       31 records, ids 1..31 contiguous
cities          16 distinct
states          13 distinct
risk            high 7  · medium 15 · low 9
authority       municipal 13 · state_pwd 10 · nhai 7 · dev_auth 1
status          in_principle_approval 15 · implementation_ongoing 7 · submitted 6
                implemented 1 · audit_complete 1 · stalled 1 · in_audit 0
SITE_MAPS       28 of 31 — ids 12, 29 and 31 have no site map (expected)
STATE_BOUNDS    13 — one per state
UNIVERSITIES    20
bounding box    every location within lat 6..38, lng 67..98
```

## What this does NOT cover

- **Rendering.** Identical data can still be displayed wrongly. Verify the copy
  shows 31 markers and 31 list rows, and spot-check one dossier.
- **External assets.** Site-map images are hotlinked Google Drive thumbnails and
  university logos are separate PNG files; neither is covered by these digests.
- **Non-JSON reformatting.** If a copy rewrote the data block with trailing
  commas, comments, single quotes or computed values, the checker cannot parse
  it and will say so rather than guess.
