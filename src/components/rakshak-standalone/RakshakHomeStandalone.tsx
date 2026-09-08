/* ============================================================================
 * PROJECT RAKSHAK — HOME PAGE, STANDALONE SNAPSHOT
 * Crashfree India · route "/" of techichain/rakshak-shield-page
 *
 * WHAT THIS IS
 *   A complete, single-file, dependency-free snapshot of the ORIGINAL home page.
 *   Everything is inlined: all 31 location records, every taxonomy, all CSS, the
 *   CFI logo, the Leaflet map, the sidebar, the detail panel, the footer, and
 *   both modals — including exactly what each button does.
 *
 *   It exists as a BACKUP / REFERENCE ARTEFACT. It is a faithful copy of the old
 *   page, warts included. It is NOT the brand-aligned rebuild, and it is not
 *   meant to be improved — if you change it, it stops being a snapshot.
 *
 * HOW TO USE IT
 *   Drop the file anywhere in a React 18/19 project and render it:
 *
 *       import RakshakHomeStandalone from "./RakshakHomeStandalone";
 *       export default function Page() { return <RakshakHomeStandalone />; }
 *
 *   In THIS repo (TanStack Start), a route would be:
 *
 *       import { createFileRoute } from "@tanstack/react-router";
 *       import RakshakHomeStandalone from "@/components/rakshak-standalone/RakshakHomeStandalone";
 *       export const Route = createFileRoute("/snapshot")({
 *         component: () => <RakshakHomeStandalone />,
 *       });
 *
 * DEPENDENCIES: none but React.
 *   - Leaflet 1.9.4 (JS + CSS) is loaded from unpkg at runtime, inside an effect,
 *     and cached on window. No npm install, no bundler config, no SSR hazard.
 *     Point LEAFLET_JS / LEAFLET_CSS at a local copy to go fully offline.
 *   - Icons are inline SVG. No icon library.
 *   - Fonts (Fraunces, DM Sans, DM Mono, Montserrat) are requested from Google
 *     Fonts by the injected stylesheet. Without them it falls back to system
 *     sans — layout holds, it just looks different.
 *
 * SSR-SAFE
 *   Nothing touches window/document at module scope. Style injection, the font
 *   link and the Leaflet load all happen in effects. Renders fine on the server.
 *
 * WHAT NEEDS SUPPLYING FROM OUTSIDE (2 things, both optional)
 *   1. University logos — 20 binary PNGs, too large to inline. Pass
 *      `uniLogoBase` (e.g. "/assets/universities") and each entry resolves to
 *      `${uniLogoBase}/${file}`. Omit it and you get initials badges, which the
 *      original already had as its fallback.
 *   2. Site-map images — hotlinked from Google Drive thumbnails via the inlined
 *      file IDs. They need public Drive links to remain public.
 *
 * FAITHFULLY PRESERVED QUIRKS — all of these are bugs, kept on purpose
 *   - The KPI strip is hardcoded "31 / 18 / 25 / 30%". Real values are 31
 *     locations, 16 cities, 15 approvals (23 approved-or-beyond). It had drifted.
 *   - Zero media queries. Fixed 230px sidebar + 370px panel, position:fixed,
 *     overflow:hidden. Unusable below ~1100px.
 *   - The petition sends NOTHING. Clipboard / mailto / .txt download only. No
 *     signature is ever counted or stored.
 *   - The report sends NOTHING and DISCARDS the photo (only the filename is kept
 *     in state), then shows a success screen claiming it was "shared with the
 *     Crashfree India team" and that progress will be emailed. Neither is true.
 *   - Email validation is `includes("@")`.
 *   - Nav CTAs with nothing selected default to location id 1 after a 250ms wait.
 *   - The site-map "Full view" affordance has no lightbox behind it.
 *   - Authority and state chips are click-only (not keyboard reachable); modals
 *     have no focus trap and no Escape handler.
 *   - `--text3` (#9C9690) on white is ~2.9:1 — fails WCAG AA at the 9–11px sizes
 *     it is used at.
 *   ONE deliberate deviation: the original nav rendered the WHITE logo with
 *   filter:none on a white bar, so the logo was invisible. This uses the blue
 *   primary logo so the snapshot is actually viewable.
 *
 * Generated from commit 41150d9. Data is a point-in-time copy — the live JSON in
 * src/data/ may have moved on.
 * ========================================================================== */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/* ── TYPES ─────────────────────────────────────────────────────────────────── */

export type Risk = "high" | "medium" | "low";

export type StatusKey =
  | "in_audit"
  | "audit_complete"
  | "submitted"
  | "in_principle_approval"
  | "implementation_ongoing"
  | "implemented"
  | "stalled";

export interface Solution {
  /** Intervention description. */ i: string;
  /** Cost estimate, e.g. "₹8–15 lakh". */ c: string;
}

export interface Authority {
  /** Authority name. */ n: string;
  /** Its responsibility. */ r: string;
  /** True on the single PRIMARY authority. */ p?: boolean;
}

export interface Location {
  id: number;
  /** Location name. */ n: string;
  /** City. */ ci: string;
  /** State. */ st: string;
  lat: number;
  lng: number;
  risk: Risk;
  /** Authority category key — matches AUTH_CATEGORIES. */ auth: string;
  /** Junction/road type, e.g. "Y-Junction on NH 766". */ type: string;
  status: StatusKey;
  /** Why it is crash-prone, with casualty counts. */ crash: string;
  findings: string[];
  sols: Solution[];
  /** Estimated impact of the interventions. */ impact: string;
  auths: Authority[];
  /** Why it is not yet implemented. */ why: string;
  /** Audit team name. */ team: string;
  /** Petition addressee. */ pto: string;
  /** Petition mailto target. */ pmail: string;
}

export interface StatusMeta {
  /** Label. */ l: string;
  /** Foreground colour. */ c: string;
  /** Background colour. */ bg: string;
  /** Legacy icon slot — empty for every status. */ i: string;
  /** Step index in the 6-step pipeline; -1 means off-pipeline (stalled). */ s: number;
}

export interface FiltersState {
  auth: string;
  status: string;
  state: string;
  search: string;
}

/** Minimal structural typing for the CDN-loaded Leaflet global. */
type L = any;

/* ── DATA ─────────────────────────────────────────────────────────────────────
   All values below are inlined verbatim from src/data/*.json at the time of
   export. Nothing here is fetched. Edit in place.                            */

/** 31 audited locations — the full editorial dataset. */
export const LOCATIONS: Location[] = [
  {
    "id": 1,
    "n": "Kunnamangalam Junction",
    "ci": "Kozhikode",
    "st": "Kerala",
    "lat": 11.3068,
    "lng": 75.8795,
    "risk": "high",
    "auth": "state_pwd",
    "type": "Y-Junction on NH 766",
    "status": "implementation_ongoing",
    "crash": "High-conflict Y-junction on NH 766. 3 fatalities and 14 injury accidents (2022–24). Peak risk during evening hours and weekly market days when pedestrian volume spikes dramatically.",
    "findings": [
      "Y-junction geometry creates severe sight-line restrictions on all 3 arms",
      "No pedestrian crossing infrastructure or refuge islands at any approach",
      "Absent traffic signals — uncontrolled merge point",
      "Street lighting inadequate for evening pedestrian movement",
      "High vehicle speeds on NH incompatible with Y-junction design"
    ],
    "sols": [
      {
        "i": "Mini-roundabout / channelized Y-junction redesign",
        "c": "₹8–15 lakh"
      },
      {
        "i": "Pedestrian refuge islands + marked crossings (3 arms)",
        "c": "₹3–5 lakh"
      },
      {
        "i": "Traffic signals on all approach arms",
        "c": "₹5–10 lakh"
      },
      {
        "i": "Rumble strips on NH 766 approach",
        "c": "₹1–2 lakh"
      },
      {
        "i": "LED street lighting upgrade",
        "c": "₹2–4 lakh"
      }
    ],
    "impact": "Estimated 35–40% crash reduction. 50%+ reduction in pedestrian fatality risk.",
    "auths": [
      {
        "n": "PWD NH Division, Kozhikode (EE Sujeesh K V)",
        "r": "PRIMARY — Geometric redesign, markings, signals on NH 766",
        "p": true
      },
      {
        "n": "Kozhikode Traffic Police",
        "r": "Signal installation, timing, enforcement"
      },
      {
        "n": "Kozhikode City Corporation",
        "r": "Footpaths, pedestrian refuge islands, drainage"
      },
      {
        "n": "KRSA",
        "r": "State-level blackspot coordination"
      },
      {
        "n": "DC Kozhikode / DRSC",
        "r": "Multi-agency coordination (MV Act 2019 S.215B)"
      }
    ],
    "why": "Multi-agency jurisdiction requires DRSC coordination. In-principle approval from PWD NH Division obtained.",
    "team": "CrashZero",
    "pto": "Executive Engineer, PWD NH Division, Kozhikode",
    "pmail": "dc.kozhikode@kerala.gov.in"
  },
  {
    "id": 2,
    "n": "Teen Imli Square",
    "ci": "Indore",
    "st": "Madhya Pradesh",
    "lat": 22.7196,
    "lng": 75.8577,
    "risk": "high",
    "auth": "municipal",
    "type": "Urban Signalized Intersection",
    "status": "in_principle_approval",
    "crash": "One of Indore's most accident-prone junctions. 6 accidents including 2 fatalities in 2023–24.",
    "findings": [
      "No pedestrian crossings on 2 of 4 arms",
      "Signal cycle poorly timed — red-light running routine",
      "No pedestrian phase or countdown signal",
      "Footpaths broken and encroached by vendors",
      "Mixed heavy vehicle + two-wheeler + pedestrian conflict"
    ],
    "sols": [
      {
        "i": "Junction reconfiguration with dedicated pedestrian phases",
        "c": "₹10–20 lakh"
      },
      {
        "i": "Pedestrian crossings on all 4 arms with tactile strips",
        "c": "₹3–6 lakh"
      },
      {
        "i": "Footpath reconstruction on all approaches",
        "c": "₹5–10 lakh"
      },
      {
        "i": "Countdown pedestrian signals",
        "c": "₹4–8 lakh"
      }
    ],
    "impact": "30–35% crash reduction. Pedestrian fatality risk reduced ~55%.",
    "auths": [
      {
        "n": "Indore Municipal Corporation (IMC)",
        "r": "PRIMARY — City road, junction geometry, footpaths, drainage",
        "p": true
      },
      {
        "n": "Indore Traffic Police",
        "r": "Signal installation, timing, enforcement"
      },
      {
        "n": "Additional Collector, Indore / DRSC",
        "r": "Coordination and budget approvals"
      }
    ],
    "why": "IMC implementing. Budget allocation confirmed. Signal retiming committed.",
    "team": "Team Nationpath",
    "pto": "Commissioner, Indore Municipal Corporation",
    "pmail": "mc.indore@mp.gov.in"
  },
  {
    "id": 3,
    "n": "NH-27 Boragaon (Post-Flyover)",
    "ci": "Guwahati",
    "st": "Assam",
    "lat": 26.1212,
    "lng": 91.6912,
    "risk": "high",
    "auth": "nhai",
    "type": "Post-Flyover Highway Corridor",
    "status": "implementation_ongoing",
    "crash": "Dangerous speed transition zone post-flyover on NH-27. Vehicles exit at 70+ km/h. 4 serious accidents in 2023–24.",
    "findings": [
      "No speed calming downstream of flyover — vehicles exit at 70+ km/h",
      "Pedestrian desire lines at NH exits with zero formal crossing",
      "Road delineation absent — lane markings completely faded",
      "Missing crash barriers on vulnerable embankment segments",
      "Illegal roadside activity pulling pedestrians onto NH"
    ],
    "sols": [
      {
        "i": "Speed calming sequence: rumble strips + road narrowing post-flyover",
        "c": "₹3–8 lakh"
      },
      {
        "i": "Pedestrian crossings with refuge islands on NH",
        "c": "₹5–12 lakh"
      },
      {
        "i": "Full road marking renewal",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Crash barriers on embankment-side lane",
        "c": "₹4–10 lakh"
      }
    ],
    "impact": "40–45% crash reduction. Speed reduction of 20–30 km/h at critical transition zone.",
    "auths": [
      {
        "n": "NHAI PIU, Guwahati (NEDFi House, G.S. Road, Dispur)",
        "r": "PRIMARY — All structural and geometric works on NH-27",
        "p": true
      },
      {
        "n": "PWD Assam",
        "r": "State PWD coordination for NH alignment works"
      },
      {
        "n": "GMDA",
        "r": "Development zone approval, ROW coordination"
      },
      {
        "n": "GMC",
        "r": "Local approach roads, footpaths adjacent to NH"
      },
      {
        "n": "DC Kamrup Metropolitan / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "NHAI PIU implementation underway. Safety improvement budget allocated.",
    "team": "Bihari Genda",
    "pto": "Project Director, NHAI PIU Guwahati",
    "pmail": "ro.northeast@nhai.org"
  },
  {
    "id": 4,
    "n": "Tejaji Nagar Junction",
    "ci": "Indore",
    "st": "Madhya Pradesh",
    "lat": 22.7052,
    "lng": 75.8674,
    "risk": "high",
    "auth": "municipal",
    "type": "Urban T-Intersection",
    "status": "implemented",
    "crash": "High-conflict T-intersection. 5 accidents in 2023 including 1 fatality.",
    "findings": [
      "Poor junction geometry — approach sight distance severely restricted",
      "No traffic control device",
      "Footpaths absent on 2 of 3 approaches",
      "Poor road surface causing sudden braking",
      "Night lighting insufficient"
    ],
    "sols": [
      {
        "i": "Junction geometry improvement + visibility clearance",
        "c": "₹5–12 lakh"
      },
      {
        "i": "Traffic signal installation",
        "c": "₹5–10 lakh"
      },
      {
        "i": "Footpath construction on minor road approach",
        "c": "₹3–6 lakh"
      },
      {
        "i": "Street lighting restoration",
        "c": "₹1–3 lakh"
      }
    ],
    "impact": "30–35% crash reduction. Near-miss incidents reduce 50%+ with signal.",
    "auths": [
      {
        "n": "Indore Municipal Corporation (IMC)",
        "r": "PRIMARY — City road junction, geometry, footpaths",
        "p": true
      },
      {
        "n": "Indore Traffic Police",
        "r": "Signal installation and management"
      },
      {
        "n": "Additional Collector, Indore / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "In-principle approval from Additional Collector obtained. Detailed design submitted.",
    "team": "Visioneers",
    "pto": "Commissioner, Indore Municipal Corporation",
    "pmail": "mc.indore@mp.gov.in"
  },
  {
    "id": 5,
    "n": "Kamta Chauraha",
    "ci": "Lucknow",
    "st": "Uttar Pradesh",
    "lat": 26.873938,
    "lng": 81.014813,
    "risk": "high",
    "auth": "municipal",
    "type": "Urban Commercial Intersection",
    "status": "submitted",
    "crash": "Major commercial chauraha (4-way junction) in Kamta area. Multiple two-wheeler and pedestrian injury accidents annually.",
    "findings": [
      "Uncontrolled 4-way junction with no signals or give-way rules",
      "Pedestrian crossing completely absent",
      "Heavy encroachment by vendors and parked vehicles",
      "Road markings entirely absent",
      "Drainage failure causing waterlogging pushing pedestrians onto road"
    ],
    "sols": [
      {
        "i": "Traffic signal with pedestrian phase",
        "c": "₹6–12 lakh"
      },
      {
        "i": "Pedestrian crossings on all 4 arms",
        "c": "₹3–6 lakh"
      },
      {
        "i": "Road marking renewal",
        "c": "₹1–3 lakh"
      },
      {
        "i": "Drainage repair to eliminate waterlogging",
        "c": "₹2–5 lakh"
      }
    ],
    "impact": "25–30% crash reduction. Pedestrian safety improves 45%+ with signals.",
    "auths": [
      {
        "n": "Lucknow Municipal Corporation (LMC)",
        "r": "PRIMARY — City road, junction geometry, pedestrian infrastructure",
        "p": true
      },
      {
        "n": "Lucknow Traffic Police",
        "r": "Signal installation, enforcement"
      },
      {
        "n": "DM Lucknow / DRSC",
        "r": "Coordination under MV Act 2019"
      }
    ],
    "why": "Report submitted to LMC and DM office. Pending annual plan inclusion.",
    "team": "PATHRAKSHAK",
    "pto": "Municipal Commissioner, LMC & DM Lucknow",
    "pmail": "dmknw@nic.in"
  },
  {
    "id": 6,
    "n": "IIT Delhi Outer Ring Road",
    "ci": "New Delhi",
    "st": "Delhi",
    "lat": 28.5458,
    "lng": 77.1956,
    "risk": "high",
    "auth": "state_pwd",
    "type": "High-Speed Urban Arterial",
    "status": "in_principle_approval",
    "crash": "RTI FIR records (2020–2025) confirm multiple fatal crashes near IIT gates. Pedestrians and two-wheelers are 98% of casualties.",
    "findings": [
      "Discontinuous broken footpaths forcing pedestrians onto high-speed carriageway",
      "Chronic waterlogging after light rain — pushes pedestrians into traffic",
      "Two-wheeler encroachment on footpaths during peak hours",
      "Parked vehicles occupying walkway widths near IIT gates",
      "No speed calming on long straight segments enabling 70+ km/h"
    ],
    "sols": [
      {
        "i": "Continuous Accessible Pedestrian Corridor (CAPC) — 1.8m min width",
        "c": "₹15–25 lakh"
      },
      {
        "i": "Drainage upgrade — gully pots, trench drains at ponding sites",
        "c": "₹5–10 lakh"
      },
      {
        "i": "Bollards to prevent two-wheeler footpath encroachment",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Speed feedback LED boards + camera enforcement",
        "c": "₹5–12 lakh"
      }
    ],
    "impact": "30–40% pedestrian crash reduction. 60–70% reduction in waterlogging incidents.",
    "auths": [
      {
        "n": "PWD Delhi (Roads)",
        "r": "PRIMARY — ORR is Delhi PWD arterial; footpaths, drainage, markings",
        "p": true
      },
      {
        "n": "Delhi Traffic Police",
        "r": "Signal management, speed cameras, enforcement"
      },
      {
        "n": "MCD",
        "r": "Local connecting roads, drainage"
      },
      {
        "n": "Delhi Jal Board",
        "r": "Stormwater drains — chronic waterlogging"
      },
      {
        "n": "DM South Delhi / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "PWD Delhi report submitted. Multi-agency gap (PWD + MCD + DJB) preventing single nodal ownership. DRSC escalation recommended.",
    "team": "ZeroCollision",
    "pto": "Engineer-in-Chief, PWD Delhi & DCP Traffic South Delhi",
    "pmail": "pwddelhi@nic.in"
  },
  {
    "id": 7,
    "n": "AEC Road Turn, Jalukbari",
    "ci": "Guwahati",
    "st": "Assam",
    "lat": 26.155,
    "lng": 91.6762,
    "risk": "high",
    "auth": "nhai",
    "type": "NH Junction, Campus Proximity",
    "status": "in_principle_approval",
    "crash": "Fatal crashes involving students documented at this NH-27 junction near Assam Engineering College.",
    "findings": [
      "Vehicles turning at high speed from NH — no speed calming",
      "Student pedestrian flows crossing NH without formal crossing",
      "Poor sight distance due to roadside encroachment",
      "Night-time visibility critically low"
    ],
    "sols": [
      {
        "i": "Junction redesign — dedicated turn lane with deceleration taper",
        "c": "₹8–15 lakh"
      },
      {
        "i": "Pedestrian crossing with refuge island on NH",
        "c": "₹4–8 lakh"
      },
      {
        "i": "Speed calming: rumble strips 100m before junction",
        "c": "₹2–4 lakh"
      },
      {
        "i": "LED lighting on approach and junction",
        "c": "₹2–4 lakh"
      }
    ],
    "impact": "35–40% crash reduction. Student pedestrian fatality risk reduced 50%+.",
    "auths": [
      {
        "n": "NHAI PIU, Guwahati",
        "r": "PRIMARY if on NH-27 corridor",
        "p": true
      },
      {
        "n": "Assam PWD",
        "r": "Primary if state-managed — mixed jurisdiction"
      },
      {
        "n": "DC Kamrup Metropolitan / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "In-principle approval from GMDA. NHAI PIU Guwahati acknowledged. Jurisdiction confirmation pending.",
    "team": "Tratah",
    "pto": "Project Director, NHAI PIU Guwahati",
    "pmail": "ro.northeast@nhai.org"
  },
  {
    "id": 8,
    "n": "Roorkee-Manglaur Bypass",
    "ci": "Roorkee",
    "st": "Uttarakhand",
    "lat": 29.8114,
    "lng": 77.8783,
    "risk": "medium",
    "auth": "nhai",
    "type": "NH Bypass Corridor",
    "status": "submitted",
    "crash": "Bypass road through BT Ganj settlement on NH-344. 3 accidents in 2023–24.",
    "findings": [
      "No pedestrian crossings at settlement access points on NH",
      "Road markings completely absent",
      "No road edge delineation — night driving risk elevated",
      "No lighting on bypass through BT Ganj"
    ],
    "sols": [
      {
        "i": "Pedestrian crossings at 3 settlement access points",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Full road marking renewal",
        "c": "₹1–3 lakh"
      },
      {
        "i": "Retroreflective delineators on bypass edge",
        "c": "₹0.5–1 lakh"
      },
      {
        "i": "Solar LED lighting at pedestrian crossings",
        "c": "₹2–4 lakh"
      }
    ],
    "impact": "25–30% crash reduction. Night-time pedestrian risk reduced 40%+.",
    "auths": [
      {
        "n": "NHAI / UK PWD NH Division",
        "r": "PRIMARY — NH-344 geometric works, markings",
        "p": true
      },
      {
        "n": "Roorkee Nagar Palika Parishad",
        "r": "Local pedestrian facilities"
      },
      {
        "n": "DM Haridwar / DRSC",
        "r": "Coordination (Roorkee in Haridwar district)"
      }
    ],
    "why": "Submitted to UK PWD NH Division. Pending nodal officer assignment.",
    "team": "AP",
    "pto": "Executive Engineer, NH Division UK PWD",
    "pmail": "pwduk.nh@uk.gov.in"
  },
  {
    "id": 9,
    "n": "Akurli Road Underpass, Kandivali",
    "ci": "Mumbai",
    "st": "Maharashtra",
    "lat": 19.2175,
    "lng": 72.851,
    "risk": "medium",
    "auth": "municipal",
    "type": "Urban Underpass",
    "status": "implementation_ongoing",
    "crash": "Underpass with chronically poor lighting. 2 serious accidents in 2023.",
    "findings": [
      "Underpass lighting inadequate — dangerous low-visibility at night",
      "Drainage failure causes seasonal flooding",
      "No pedestrian walkway delineation within underpass",
      "Poor visibility at underpass exit"
    ],
    "sols": [
      {
        "i": "LED lighting retrofit throughout underpass",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Drainage improvement — pump system or regrade",
        "c": "₹3–6 lakh"
      },
      {
        "i": "Pedestrian walkway delineation + barriers",
        "c": "₹1–3 lakh"
      },
      {
        "i": "CCTV installation",
        "c": "₹2–3 lakh"
      }
    ],
    "impact": "30–35% reduction in underpass-related accidents.",
    "auths": [
      {
        "n": "BMC (Brihanmumbai Municipal Corporation)",
        "r": "PRIMARY — Akurli Road and underpass maintenance",
        "p": true
      },
      {
        "n": "Mumbai Traffic Police",
        "r": "Signal management, enforcement"
      },
      {
        "n": "MSEDCL",
        "r": "Underpass lighting"
      }
    ],
    "why": "BMC under review. Underpass lighting in maintenance backlog — petition needed to escalate.",
    "team": "Black Widow",
    "pto": "Additional Municipal Commissioner (Works), BMC",
    "pmail": "additionalmc.w@mcgm.gov.in"
  },
  {
    "id": 10,
    "n": "Chevayur Junction",
    "ci": "Kozhikode",
    "st": "Kerala",
    "lat": 11.2696,
    "lng": 75.8256,
    "risk": "medium",
    "auth": "state_pwd",
    "type": "Urban T-Junction",
    "status": "submitted",
    "crash": "Urban junction with significant pedestrian-vehicle conflict. 3 accidents in 2023–24.",
    "findings": [
      "No pedestrian crossing on minor road approach",
      "Signal timing excludes pedestrian phase",
      "Footpaths broken on 2 of 3 approaches",
      "Auto-rickshaw encroachment at junction corners"
    ],
    "sols": [
      {
        "i": "Pedestrian crossings with countdown signals",
        "c": "₹4–8 lakh"
      },
      {
        "i": "Signal phase retiming with pedestrian phase",
        "c": "₹1–2 lakh"
      },
      {
        "i": "Footpath repair on approaches",
        "c": "₹2–4 lakh"
      }
    ],
    "impact": "25–30% crash reduction. Pedestrian fatality risk reduced ~40%.",
    "auths": [
      {
        "n": "Kerala PWD (R&B Division, Kozhikode)",
        "r": "PRIMARY if on state road",
        "p": true
      },
      {
        "n": "Kozhikode City Corporation",
        "r": "Footpaths, drainage"
      },
      {
        "n": "Kozhikode Traffic Police",
        "r": "Signal timing, enforcement"
      },
      {
        "n": "DC Kozhikode / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "Submission made to Kerala PWD and Kozhikode Corporation. Awaiting acknowledgement.",
    "team": "Civillians AKA",
    "pto": "EE PWD R&B Kozhikode",
    "pmail": "dc.kozhikode@kerala.gov.in"
  },
  {
    "id": 11,
    "n": "Gilat Bazar, Shivpur",
    "ci": "Varanasi",
    "st": "Uttar Pradesh",
    "lat": 25.3478,
    "lng": 82.9702,
    "risk": "medium",
    "auth": "municipal",
    "type": "Urban Commercial Corridor",
    "status": "in_principle_approval",
    "crash": "Dense commercial bazar with high pedestrian-vehicle conflict.",
    "findings": [
      "No speed management — vehicles at 40–50 km/h in busy market",
      "Pedestrian crossings absent",
      "Footpaths fully encroached by vendors",
      "Road markings absent"
    ],
    "sols": [
      {
        "i": "Speed management: rumble strips at bazar entry/exit",
        "c": "₹1–3 lakh"
      },
      {
        "i": "Pedestrian crossings at 3 key points",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Vendor management: demarcated hawker spaces",
        "c": "₹1–2 lakh"
      }
    ],
    "impact": "20–25% crash reduction. Near-miss incidents fall 40%+.",
    "auths": [
      {
        "n": "VNN (Varanasi Nagar Nigam)",
        "r": "PRIMARY — City road, footpaths, drainage",
        "p": true
      },
      {
        "n": "Varanasi Traffic Police",
        "r": "Speed enforcement"
      },
      {
        "n": "DM Varanasi / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "Submitted to VNN and DM office. Pending allocation in urban roads fund.",
    "team": "FTW",
    "pto": "Municipal Commissioner, VNN",
    "pmail": "dm-varanasi@nic.in"
  },
  {
    "id": 12,
    "n": "Eranjipalam Junction",
    "ci": "Kozhikode",
    "st": "Kerala",
    "lat": 11.2623,
    "lng": 75.8167,
    "risk": "medium",
    "auth": "municipal",
    "type": "Urban Intersection",
    "status": "in_principle_approval",
    "crash": "Busy urban intersection with 2 fatalities in 2022–24.",
    "findings": [
      "High-speed approach from northern arm",
      "Pedestrian crossings only on one of four arms",
      "Poor visibility due to vegetation and encroachment",
      "Signal cycle too long — pedestrians cross on red routinely"
    ],
    "sols": [
      {
        "i": "Junction geometry improvement + visibility clearance",
        "c": "₹6–12 lakh"
      },
      {
        "i": "Pedestrian crossings on all 4 arms",
        "c": "₹3–5 lakh"
      },
      {
        "i": "Signal cycle optimization with pedestrian countdown",
        "c": "₹2–4 lakh"
      }
    ],
    "impact": "30–35% crash reduction. Pedestrian fatality risk reduced ~45%.",
    "auths": [
      {
        "n": "Kozhikode City Corporation",
        "r": "PRIMARY — City road, junction geometry, pedestrian infrastructure",
        "p": true
      },
      {
        "n": "Kozhikode Traffic Police",
        "r": "Signal management"
      },
      {
        "n": "DC Kozhikode / DRSC",
        "r": "PRIMARY coordination"
      }
    ],
    "why": "In-principle approval from District Collector. Kozhikode Corporation included in works schedule.",
    "team": "Team Eldians",
    "pto": "Mayor, Kozhikode City Corporation",
    "pmail": "dc.kozhikode@kerala.gov.in"
  },
  {
    "id": 13,
    "n": "IT Park Chowk",
    "ci": "Dehradun",
    "st": "Uttarakhand",
    "lat": 30.3135,
    "lng": 78.0322,
    "risk": "medium",
    "auth": "municipal",
    "type": "Urban IT Corridor Intersection",
    "status": "implementation_ongoing",
    "crash": "Intersection serving high IT worker pedestrian traffic. 3 accidents in 2023.",
    "findings": [
      "No pedestrian crossing at this high-volume crossing point",
      "Signal timing optimised for vehicles — pedestrians unaccounted",
      "Footpath ends abruptly 50m before junction",
      "Parking encroachment reduces visibility"
    ],
    "sols": [
      {
        "i": "Pedestrian crossing with dedicated signal phase",
        "c": "₹4–8 lakh"
      },
      {
        "i": "Footpath extension to junction on all approaches",
        "c": "₹3–6 lakh"
      },
      {
        "i": "Signal timing redesign with pedestrian count",
        "c": "₹1–2 lakh"
      }
    ],
    "impact": "30% crash reduction. IT worker pedestrian safety significantly improved.",
    "auths": [
      {
        "n": "Dehradun Municipal Corporation (Nagar Nigam)",
        "r": "PRIMARY — City road, pedestrian infrastructure",
        "p": true
      },
      {
        "n": "Uttarakhand Road Safety Council",
        "r": "PRIMARY state coordination — already Lead Agency"
      },
      {
        "n": "DM Dehradun / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "UK Road Safety Council approved. Dehradun MC executing phased works.",
    "team": "Plannerloki",
    "pto": "Commissioner, Dehradun MC",
    "pmail": "dmcdehra@gmail.com"
  },
  {
    "id": 14,
    "n": "Calicut Medical College Junction",
    "ci": "Kozhikode",
    "st": "Kerala",
    "lat": 11.2378,
    "lng": 75.8333,
    "risk": "medium",
    "auth": "state_pwd",
    "type": "Hospital Zone Junction",
    "status": "implementation_ongoing",
    "crash": "Hospital zone junction. MoRTH 30 km/h mandate not implemented. Ambulance-general traffic conflicts.",
    "findings": [
      "Hospital zone 30 km/h (MoRTH statutory) not implemented — vehicles at 50–60 km/h",
      "No pedestrian refuge island for patients crossing",
      "Ambulance bay conflicts with regular traffic",
      "Hospital zone not adequately marked"
    ],
    "sols": [
      {
        "i": "30 km/h zone: speed humps + marking within 200m",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Pedestrian refuge island at main hospital crossing",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Hospital zone signage on all approaches (statutory)",
        "c": "₹0.5–1 lakh"
      },
      {
        "i": "Pedestrian signal with longer phase at entrance",
        "c": "₹3–5 lakh"
      }
    ],
    "impact": "30–35% crash reduction. Statutory MoRTH 30 km/h zone provides strong legal basis.",
    "auths": [
      {
        "n": "Kerala PWD (R&B, Kozhikode Division)",
        "r": "PRIMARY — State road, geometric works, signal installation",
        "p": true
      },
      {
        "n": "Kozhikode Traffic Police",
        "r": "Speed enforcement — statutory hospital zone obligation"
      },
      {
        "n": "KRSA",
        "r": "Hospital zone designation"
      },
      {
        "n": "DC Kozhikode / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "Implementation underway. KRSA designated hospital zone. Kerala PWD executing works.",
    "team": "Safe Grid",
    "pto": "EE PWD R&B Kozhikode & KRSA",
    "pmail": "dc.kozhikode@kerala.gov.in"
  },
  {
    "id": 15,
    "n": "NH-65 Rythu Bazar, Krishnalanka",
    "ci": "Vijayawada",
    "st": "Andhra Pradesh",
    "lat": 16.5193,
    "lng": 80.6205,
    "risk": "medium",
    "auth": "nhai",
    "type": "NH Junction at Market Zone",
    "status": "in_principle_approval",
    "crash": "Market zone on NH-65. 3 accidents including 1 fatality in 2023.",
    "findings": [
      "NH speed not reduced approaching market zone",
      "No pedestrian crossings on NH at Rythu Bazar access",
      "Market vehicles parked on NH shoulder blocking sight distance",
      "Road markings absent"
    ],
    "sols": [
      {
        "i": "Speed calming: warning signage + rumble strips",
        "c": "₹2–5 lakh"
      },
      {
        "i": "Pedestrian crossings with road studs on NH",
        "c": "₹3–6 lakh"
      },
      {
        "i": "No-parking enforcement on NH shoulder",
        "c": "₹1–2 lakh"
      },
      {
        "i": "LED lighting at market zone crossing",
        "c": "₹2–4 lakh"
      }
    ],
    "impact": "25–30% crash reduction. Pedestrian fatality risk reduced ~40%.",
    "auths": [
      {
        "n": "NHAI (PIU, Vijayawada)",
        "r": "PRIMARY — NH-65 structural and geometric works",
        "p": true
      },
      {
        "n": "AP R&B Department",
        "r": "Technical coordination with NHAI"
      },
      {
        "n": "VMC",
        "r": "Local approach roads"
      },
      {
        "n": "DC Krishna / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "In-principle approval from AP R&B NH Division. Coordination with NHAI PIU in progress.",
    "team": "Shaunak's Team",
    "pto": "Project Director, NHAI PIU Vijayawada",
    "pmail": "nhai.vijayawada@nhai.org"
  },
  {
    "id": 16,
    "n": "RK Mission Junction, Ganga Market",
    "ci": "Itanagar",
    "st": "Arunachal Pradesh",
    "lat": 27.1025,
    "lng": 93.6325,
    "risk": "medium",
    "auth": "state_pwd",
    "type": "Capital City Urban Junction",
    "status": "submitted",
    "crash": "Junction in Itanagar's commercial area. High pedestrian and light vehicle traffic.",
    "findings": [
      "No traffic control — uncontrolled movement",
      "Pedestrian crossings absent",
      "Road markings completely worn",
      "Footpaths absent on 2 of 4 approaches"
    ],
    "sols": [
      {
        "i": "Traffic signal installation",
        "c": "₹5–15 lakh"
      },
      {
        "i": "Pedestrian crossings on all arms",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Road marking renewal",
        "c": "₹0.5–1.5 lakh"
      },
      {
        "i": "Basic footpath on main approaches",
        "c": "₹3–6 lakh"
      }
    ],
    "impact": "30–35% crash reduction with signalized junction.",
    "auths": [
      {
        "n": "Arunachal Pradesh PWD (Chief Engineer, Roads)",
        "r": "PRIMARY — All roads in AP under AP PWD",
        "p": true
      },
      {
        "n": "Itanagar Capital Complex (ICA)",
        "r": "Urban governance, pedestrian facilities"
      },
      {
        "n": "DC Papum Pare / DRSC",
        "r": "PRIMARY coordination"
      }
    ],
    "why": "Submitted to AP PWD and DC Papum Pare. Capital city budget constraints.",
    "team": "Raksha Vahini",
    "pto": "Chief Engineer, AP PWD",
    "pmail": "ce.pwd@arunachal.gov.in"
  },
  {
    "id": 17,
    "n": "Britannia Chowk",
    "ci": "New Delhi",
    "st": "Delhi",
    "lat": 28.6748,
    "lng": 77.1231,
    "risk": "medium",
    "auth": "state_pwd",
    "type": "Urban Arterial Intersection",
    "status": "in_principle_approval",
    "crash": "Busy arterial intersection in NW Delhi with documented pedestrian and two-wheeler conflicts.",
    "findings": [
      "Signal phase excludes pedestrians",
      "Footpaths broken on 2 of 4 approaches",
      "Encroachment reduces carriageway width",
      "Road markings faded — stop lines invisible"
    ],
    "sols": [
      {
        "i": "Pedestrian phases added to existing signal cycle",
        "c": "₹1–3 lakh"
      },
      {
        "i": "Pedestrian crossings on all 4 arms",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Footpath repair on 2 approaches",
        "c": "₹3–6 lakh"
      }
    ],
    "impact": "25–30% crash reduction. Pedestrian safety improved ~40%.",
    "auths": [
      {
        "n": "PWD Delhi",
        "r": "PRIMARY if on classified arterial",
        "p": true
      },
      {
        "n": "MCD",
        "r": "If on local ward road — footpaths, drainage"
      },
      {
        "n": "Delhi Traffic Police",
        "r": "Signal phase programming, enforcement"
      },
      {
        "n": "DM NW Delhi / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "In-principle approval from PWD Delhi. Signal modification committed by Traffic Police.",
    "team": "Warriors",
    "pto": "Engineer-in-Chief, PWD Delhi",
    "pmail": "pwddelhi@nic.in"
  },
  {
    "id": 18,
    "n": "Gurubagh Bhelupur",
    "ci": "Varanasi",
    "st": "Uttar Pradesh",
    "lat": 25.312,
    "lng": 82.9875,
    "risk": "medium",
    "auth": "municipal",
    "type": "Dense Urban Area",
    "status": "in_principle_approval",
    "crash": "Dense mixed-use area with chronic pedestrian-vehicle conflict.",
    "findings": [
      "Road entirely without markings",
      "Footpaths non-existent or fully encroached",
      "Drainage failure causes flooding pushing pedestrians onto road",
      "High speed of two-wheelers incompatible with dense pedestrian movement"
    ],
    "sols": [
      {
        "i": "Road marking installation",
        "c": "₹1–2.5 lakh"
      },
      {
        "i": "Speed humps at entry points",
        "c": "₹0.5–1.5 lakh"
      },
      {
        "i": "Drainage repair at chronic flooding points",
        "c": "₹2–5 lakh"
      }
    ],
    "impact": "20–25% crash reduction. Near-miss reduction of 40%+.",
    "auths": [
      {
        "n": "VNN (Varanasi Nagar Nigam)",
        "r": "PRIMARY — City road, footpaths, drainage",
        "p": true
      },
      {
        "n": "Varanasi Traffic Police",
        "r": "Speed enforcement"
      },
      {
        "n": "DM Varanasi / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "Submitted to VNN. Pending urban roads maintenance fund allocation.",
    "team": "Work Wizards",
    "pto": "Municipal Commissioner, VNN",
    "pmail": "mc.varanasi@up.gov.in"
  },
  {
    "id": 19,
    "n": "Chuttugunta Circle Roundabout",
    "ci": "Guntur",
    "st": "Andhra Pradesh",
    "lat": 16.2912,
    "lng": 80.4254,
    "risk": "medium",
    "auth": "municipal",
    "type": "Urban Roundabout",
    "status": "in_principle_approval",
    "crash": "Roundabout with poor geometry. 2 accidents in 2023–24.",
    "findings": [
      "Entry geometry doesn't enforce yield",
      "No pedestrian crossings on any approach arm",
      "Central island blocks sight lines",
      "Road markings absent on all arms"
    ],
    "sols": [
      {
        "i": "Roundabout geometry correction",
        "c": "₹6–12 lakh"
      },
      {
        "i": "Pedestrian crossings on all 4 approach arms",
        "c": "₹3–5 lakh"
      },
      {
        "i": "Road marking renewal",
        "c": "₹1–2 lakh"
      }
    ],
    "impact": "25–30% crash reduction. Entry conflict reduced ~50%.",
    "auths": [
      {
        "n": "Guntur Municipal Corporation",
        "r": "PRIMARY — City road roundabout",
        "p": true
      },
      {
        "n": "AP R&B Department",
        "r": "If on state highway or MDR"
      },
      {
        "n": "DC Guntur / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "Submitted to Guntur MC and AP R&B. Pending acknowledgement.",
    "team": "Team Vignan",
    "pto": "Commissioner, Guntur Municipal Corporation",
    "pmail": "mc.guntur@ap.gov.in"
  },
  {
    "id": 20,
    "n": "IIT BHU Gate Rotary (Ranjit Chowk)",
    "ci": "Varanasi",
    "st": "Uttar Pradesh",
    "lat": 25.2636,
    "lng": 82.9924,
    "risk": "medium",
    "auth": "municipal",
    "type": "Campus Gate Rotary",
    "status": "in_principle_approval",
    "crash": "Rotary junction at IIT BHU gate with high student pedestrian movement. 2 accidents in 2023.",
    "findings": [
      "Rotary lane discipline absent",
      "No formal pedestrian crossing at any rotary arm",
      "Insufficient lighting",
      "Two-wheelers short-cutting across rotary island"
    ],
    "sols": [
      {
        "i": "Rotary lane marking + directional guidance",
        "c": "₹1–2 lakh"
      },
      {
        "i": "Pedestrian crossings with raised table at 2 key arms",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Bollards around rotary island",
        "c": "₹0.5–1.5 lakh"
      }
    ],
    "impact": "20–25% crash reduction. Student safety significantly improved.",
    "auths": [
      {
        "n": "VNN / UP PWD",
        "r": "PRIMARY — City or state road at BHU gate",
        "p": true
      },
      {
        "n": "Varanasi Traffic Police",
        "r": "Enforcement"
      },
      {
        "n": "DM Varanasi / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "In-principle approval from DM Varanasi. UP PWD committed to road marking works.",
    "team": "Crashcrackers",
    "pto": "EE PWD Varanasi & Municipal Commissioner, VNN",
    "pmail": "dm-varanasi@nic.in"
  },
  {
    "id": 21,
    "n": "TIDEL Park U-Bridge Junction, OMR",
    "ci": "Chennai",
    "st": "Tamil Nadu",
    "lat": 12.988,
    "lng": 80.2515,
    "risk": "medium",
    "auth": "state_pwd",
    "type": "IT Corridor U-Bridge Conflict Zone",
    "status": "implementation_ongoing",
    "crash": "U-bridge junction on OMR creating dangerous vehicle-pedestrian conflicts. IT workers crossing between tech parks.",
    "findings": [
      "U-bridge turn creates blind spot",
      "IT workers crossing OMR with no formal crossing",
      "High speed on OMR (60+ km/h) incompatible with pedestrian crossing",
      "No deceleration zone before U-bridge"
    ],
    "sols": [
      {
        "i": "Pedestrian crossing with signal phase at U-bridge",
        "c": "₹4–8 lakh"
      },
      {
        "i": "Speed reduction zone on OMR approach",
        "c": "₹1–3 lakh"
      },
      {
        "i": "Deceleration lane for U-turning vehicles",
        "c": "₹5–10 lakh"
      }
    ],
    "impact": "30% crash reduction. IT worker pedestrian safety dramatically improved.",
    "auths": [
      {
        "n": "Tamil Nadu PWD (Highways Division, Chennai)",
        "r": "PRIMARY — OMR under TN PWD",
        "p": true
      },
      {
        "n": "GCC",
        "r": "Footpaths, adjacent city infrastructure"
      },
      {
        "n": "Chennai Traffic Police",
        "r": "Signal management, enforcement"
      }
    ],
    "why": "TN PWD implementing. Signal installation complete; crossing marking in progress.",
    "team": "Team Saviour",
    "pto": "Chief Engineer (Highways), TN PWD",
    "pmail": "cehwy@tn.gov.in"
  },
  {
    "id": 22,
    "n": "Rau Gol Square",
    "ci": "Indore",
    "st": "Madhya Pradesh",
    "lat": 22.6946,
    "lng": 75.8875,
    "risk": "medium",
    "auth": "municipal",
    "type": "Urban Roundabout",
    "status": "in_principle_approval",
    "crash": "Roundabout with vehicle conflicts and pedestrian danger from adjoining market.",
    "findings": [
      "Roundabout entries lack proper channelization",
      "No pedestrian crossing at approaches",
      "Road markings absent",
      "Vendor encroachment reducing visibility"
    ],
    "sols": [
      {
        "i": "Entry channelization with proper yield geometry",
        "c": "₹5–10 lakh"
      },
      {
        "i": "Pedestrian crossings on all approach arms",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Road marking renewal",
        "c": "₹1–2 lakh"
      }
    ],
    "impact": "20–25% crash reduction.",
    "auths": [
      {
        "n": "Indore Municipal Corporation (IMC)",
        "r": "PRIMARY — City roundabout",
        "p": true
      },
      {
        "n": "Indore Traffic Police",
        "r": "Enforcement"
      },
      {
        "n": "Additional Collector / DRSC Indore",
        "r": "Coordination"
      }
    ],
    "why": "In-principle approval from IMC. Works in IMC road improvement schedule.",
    "team": "No Crash Zone (NCZ)",
    "pto": "Commissioner, Indore Municipal Corporation",
    "pmail": "mc.indore@mp.gov.in"
  },
  {
    "id": 23,
    "n": "Gandhi More, NH-19 Overbridge",
    "ci": "Durgapur",
    "st": "West Bengal",
    "lat": 23.5399,
    "lng": 87.2892,
    "risk": "low",
    "auth": "nhai",
    "type": "NH Junction, Hospital Proximity",
    "status": "implementation_ongoing",
    "crash": "NH-19 junction near Healthworld Hospital overbridge. Hospital zone creates significant pedestrian demand.",
    "findings": [
      "Hospital zone speed limit not implemented",
      "Pedestrian crossing absent on NH at hospital zone",
      "Road markings faded"
    ],
    "sols": [
      {
        "i": "Hospital zone: speed humps + 30 km/h signing",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Pedestrian crossing on NH with lighting",
        "c": "₹3–5 lakh"
      },
      {
        "i": "Road marking renewal",
        "c": "₹1–2 lakh"
      }
    ],
    "impact": "20–25% crash reduction. Hospital zone is a statutory requirement.",
    "auths": [
      {
        "n": "NHAI (PIU, Durgapur area)",
        "r": "PRIMARY — NH-19 under NHAI",
        "p": true
      },
      {
        "n": "ADDA",
        "r": "Development authority"
      },
      {
        "n": "DM Paschim Bardhaman / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "In-principle approval from ADDA. NHAI engagement in progress.",
    "team": "SURAKSHA",
    "pto": "Project Director, NHAI PIU",
    "pmail": "dm-paschimbarddhaman@wb.gov.in"
  },
  {
    "id": 24,
    "n": "Bhagwanpur Mod Near Trauma Centre",
    "ci": "Varanasi",
    "st": "Uttar Pradesh",
    "lat": 25.42,
    "lng": 82.965,
    "risk": "low",
    "auth": "nhai",
    "type": "Highway Junction, Trauma Zone",
    "status": "in_principle_approval",
    "crash": "Junction near Trauma Centre on highway approach. Hospital zone pedestrian demand unmet.",
    "findings": [
      "Trauma Centre zone 30 km/h mandate unimplemented",
      "No pedestrian crossing near trauma centre entrance",
      "Road markings faded"
    ],
    "sols": [
      {
        "i": "Trauma Centre zone: 30 km/h signing + speed humps",
        "c": "₹1–3 lakh"
      },
      {
        "i": "Pedestrian crossing at trauma centre entrance",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Road marking renewal",
        "c": "₹0.5–1.5 lakh"
      }
    ],
    "impact": "Hospital zone compliance reduces pedestrian risk by 30%+.",
    "auths": [
      {
        "n": "NHAI PIU Varanasi / UP PWD NH Division",
        "r": "PRIMARY — NH or state road at Bhagwanpur",
        "p": true
      },
      {
        "n": "DM Varanasi / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "Audit complete. Report to be submitted to NHAI/PWD and DM Varanasi.",
    "team": "Pavement Pioneers",
    "pto": "EE NH Division, UP PWD",
    "pmail": "dm-varanasi@nic.in"
  },
  {
    "id": 25,
    "n": "Bhagat Singh Marg, Hatora C-Zone",
    "ci": "Durgapur",
    "st": "West Bengal",
    "lat": 23.5561,
    "lng": 87.313,
    "risk": "low",
    "auth": "dev_auth",
    "type": "Industrial Zone City Road",
    "status": "submitted",
    "crash": "City road in Durgapur's industrial C-Zone. Shift worker crossing demand at shift change times.",
    "findings": [
      "No pedestrian crossings on industrial corridor",
      "Road markings absent",
      "Shift worker crossings uncontrolled",
      "Street lighting poor"
    ],
    "sols": [
      {
        "i": "Pedestrian crossings at 3 shift worker crossing points",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Road marking renewal",
        "c": "₹1–2 lakh"
      },
      {
        "i": "Street lighting on industrial road",
        "c": "₹2–4 lakh"
      }
    ],
    "impact": "20% crash reduction. Shift worker safety significantly improved.",
    "auths": [
      {
        "n": "ADDA (Asansol Durgapur Development Authority)",
        "r": "PRIMARY — ADDA roads in Durgapur industrial zones",
        "p": true
      },
      {
        "n": "DMC",
        "r": "Footpaths, local drainage"
      },
      {
        "n": "DM Paschim Bardhaman / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "Audit complete. ADDA to be formally engaged.",
    "team": "VisionSafe",
    "pto": "CEO, ADDA",
    "pmail": "dm-paschimbarddhaman@wb.gov.in"
  },
  {
    "id": 26,
    "n": "Sardar Patel Road, IIT Madras",
    "ci": "Chennai",
    "st": "Tamil Nadu",
    "lat": 13.0107,
    "lng": 80.235,
    "risk": "low",
    "auth": "state_pwd",
    "type": "Institutional Corridor Road",
    "status": "in_principle_approval",
    "crash": "Major arterial road with IIT Madras frontage. Student and faculty pedestrian demand crossing high-speed arterial.",
    "findings": [
      "Pedestrian crossing near IIT main gate lacks signal phase",
      "Footpaths discontinuous approaching IIT gate",
      "High vehicle speeds despite institutional frontage"
    ],
    "sols": [
      {
        "i": "Pedestrian signal phase at IIT main gate",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Pedestrian refuge island at gate crossing",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Footpath continuity improvement",
        "c": "₹2–4 lakh"
      }
    ],
    "impact": "20–25% reduction in pedestrian conflicts near IIT gate.",
    "auths": [
      {
        "n": "Tamil Nadu PWD (Highways, Chennai Division)",
        "r": "PRIMARY — Sardar Patel Road is TN PWD maintained",
        "p": true
      },
      {
        "n": "GCC",
        "r": "Footpaths, local drainage"
      },
      {
        "n": "Chennai Traffic Police",
        "r": "Signal management, enforcement"
      }
    ],
    "why": "TN PWD and DRSC Chennai implementing. Signal works in progress.",
    "team": "Zodiac",
    "pto": "Chief Engineer (Highways), TN PWD",
    "pmail": "cehwy@tn.gov.in"
  },
  {
    "id": 27,
    "n": "Y-Bifurcation near Milk Bar",
    "ci": "Roorkee",
    "st": "Uttarakhand",
    "lat": 29.865,
    "lng": 77.8933,
    "risk": "low",
    "auth": "municipal",
    "type": "Y-Junction, Residential Area",
    "status": "submitted",
    "crash": "Y-bifurcation in Civil Lines residential area. Documented near-miss incidents.",
    "findings": [
      "Y-junction without traffic control",
      "Road markings absent",
      "Footpaths missing on minor road arm",
      "Night visibility poor"
    ],
    "sols": [
      {
        "i": "Y-junction channelization with give-way markings",
        "c": "₹1–3 lakh"
      },
      {
        "i": "Pedestrian crossing on main road arm",
        "c": "₹1–2 lakh"
      },
      {
        "i": "Solar lighting at junction",
        "c": "₹1–2 lakh"
      }
    ],
    "impact": "15–20% crash reduction.",
    "auths": [
      {
        "n": "Roorkee Nagar Palika Parishad",
        "r": "PRIMARY — City road in Civil Lines area",
        "p": true
      },
      {
        "n": "UK PWD (Roorkee Division)",
        "r": "If classified state road"
      },
      {
        "n": "DM Haridwar / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "Audit complete. Submission to Roorkee Nagar Palika in preparation.",
    "team": "U-Turners",
    "pto": "Executive Officer, Roorkee Nagar Palika Parishad",
    "pmail": "nagar.roorkee@uk.gov.in"
  },
  {
    "id": 28,
    "n": "Taramani Gate, IIT Madras",
    "ci": "Chennai",
    "st": "Tamil Nadu",
    "lat": 12.9933,
    "lng": 80.2355,
    "risk": "low",
    "auth": "state_pwd",
    "type": "Secondary Campus Gate Intersection",
    "status": "in_principle_approval",
    "crash": "Secondary gate of IIT Madras with pedestrian-vehicle conflicts from research scholars and staff.",
    "findings": [
      "No pedestrian crossing at Taramani gate",
      "Footpath ends before junction",
      "High vehicle speeds on approach"
    ],
    "sols": [
      {
        "i": "Pedestrian crossing with road markings",
        "c": "₹1–3 lakh"
      },
      {
        "i": "Footpath extension to junction",
        "c": "₹1–2 lakh"
      },
      {
        "i": "Speed calming on approach",
        "c": "₹1–2 lakh"
      }
    ],
    "impact": "15–20% crash reduction.",
    "auths": [
      {
        "n": "Tamil Nadu PWD (Highways, Chennai Division)",
        "r": "PRIMARY if on OMR connector",
        "p": true
      },
      {
        "n": "GCC",
        "r": "If on local GCC road"
      },
      {
        "n": "Chennai Traffic Police",
        "r": "Enforcement"
      }
    ],
    "why": "Submitted to GCC and Chennai Traffic Police. Under review.",
    "team": "Team Sentinels",
    "pto": "Commissioner, GCC",
    "pmail": "commissioner@chennaicorporation.gov.in"
  },
  {
    "id": 29,
    "n": "Majura Gate",
    "ci": "Surat",
    "st": "Gujarat",
    "lat": 21.2155,
    "lng": 72.8456,
    "risk": "low",
    "auth": "municipal",
    "type": "Urban Intersection",
    "status": "audit_complete",
    "crash": "Urban intersection in Surat near Majura Gate with moderate conflict frequency.",
    "findings": [
      "Pedestrian crossing infrastructure inadequate",
      "Road markings faded",
      "Footpath condition poor on 2 approaches"
    ],
    "sols": [
      {
        "i": "Pedestrian crossings on all arms",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Road marking renewal",
        "c": "₹0.5–1.5 lakh"
      },
      {
        "i": "Signal retiming with pedestrian phase",
        "c": "₹1–2 lakh"
      }
    ],
    "impact": "15–20% crash reduction.",
    "auths": [
      {
        "n": "Surat Municipal Corporation (SMC)",
        "r": "PRIMARY — Major city road authority",
        "p": true
      },
      {
        "n": "Surat Traffic Police",
        "r": "Signal management"
      },
      {
        "n": "DC Surat / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "Audit complete. SMC to be formally engaged.",
    "team": "Team SVNIT",
    "pto": "Municipal Commissioner, Surat Municipal Corporation",
    "pmail": "mc.surat@smc.gov.in"
  },
  {
    "id": 30,
    "n": "Surjit Chowk, near Surjit Hospital",
    "ci": "Rupnagar",
    "st": "Punjab",
    "lat": 30.9667,
    "lng": 76.5358,
    "risk": "low",
    "auth": "state_pwd",
    "type": "Hospital Zone Intersection",
    "status": "stalled",
    "crash": "Intersection near Surjit Hospital. NO RESPONSE from authorities after initial submission.",
    "findings": [
      "Hospital zone 30 km/h mandate not implemented",
      "No pedestrian crossings near hospital entrance",
      "Road markings absent",
      "NO RESPONSE from authorities after submission"
    ],
    "sols": [
      {
        "i": "Hospital zone: 30 km/h signs + speed humps",
        "c": "₹1–3 lakh"
      },
      {
        "i": "Pedestrian crossing at hospital entrance",
        "c": "₹1–3 lakh"
      },
      {
        "i": "Road marking renewal",
        "c": "₹0.5–1 lakh"
      }
    ],
    "impact": "20–25% crash reduction. Statutory hospital zone obligation — strong legal basis.",
    "auths": [
      {
        "n": "Punjab PWD (B&R, Rupnagar Division)",
        "r": "PRIMARY if on state highway/MDR",
        "p": true
      },
      {
        "n": "Rupnagar Municipal Council",
        "r": "City road maintenance"
      },
      {
        "n": "DC Rupnagar / DRSC",
        "r": "Coordination — NO RESPONSE received yet"
      }
    ],
    "why": "NO RESPONSE from authorities after initial submission. Escalation to DRSC urgently needed.",
    "team": "Team Tangerine",
    "pto": "DC Rupnagar (DRSC Chair) & EE Punjab PWD",
    "pmail": "dc.rupnagar@punjab.gov.in"
  },
  {
    "id": 31,
    "n": "NH-205 Bhatta Sahib + Sukhrampur",
    "ci": "Rupnagar",
    "st": "Punjab",
    "lat": 30.9621,
    "lng": 76.525,
    "risk": "low",
    "auth": "nhai",
    "type": "National Highway Corridor",
    "status": "in_principle_approval",
    "crash": "Two locations on NH-205 (Chandigarh–Nangal road) with settlement pedestrian safety deficiencies.",
    "findings": [
      "Settlement access points on NH without pedestrian crossings",
      "Road markings absent",
      "Speed unreduced despite settlement proximity",
      "Road edge delineation missing"
    ],
    "sols": [
      {
        "i": "Pedestrian crossings at settlement access points",
        "c": "₹2–4 lakh"
      },
      {
        "i": "Road marking renewal on NH",
        "c": "₹1–2 lakh"
      },
      {
        "i": "Solar lighting at crossings",
        "c": "₹1–3 lakh"
      }
    ],
    "impact": "20–25% crash reduction across both sites.",
    "auths": [
      {
        "n": "NHAI PIU (Chandigarh / Punjab region)",
        "r": "PRIMARY if NH-205 under NHAI",
        "p": true
      },
      {
        "n": "Punjab PWD (NH Division, Rupnagar)",
        "r": "Primary if state-managed"
      },
      {
        "n": "DC Rupnagar / DRSC",
        "r": "Coordination"
      }
    ],
    "why": "Submitted to Punjab PWD and DC Rupnagar. Awaiting authority engagement.",
    "team": "Dheeraj Thalour",
    "pto": "Project Director, NHAI PIU Chandigarh",
    "pmail": "nhai.chandigarh@nhai.org"
  }
];

/** Status taxonomy. l=label, c=colour, bg=background, s=step index (-1 = off-pipeline). */
export const STATUS_META: Record<StatusKey, StatusMeta> = {
  "in_audit": {
    "l": "In Audit",
    "c": "#9333EA",
    "bg": "#F5F3FF",
    "i": "",
    "s": 1
  },
  "audit_complete": {
    "l": "Audited",
    "c": "#6B7280",
    "bg": "#F3F4F6",
    "i": "",
    "s": 2
  },
  "submitted": {
    "l": "Report Submitted",
    "c": "#2563EB",
    "bg": "#EFF6FF",
    "i": "",
    "s": 3
  },
  "in_principle_approval": {
    "l": "Approved",
    "c": "#7C3AED",
    "bg": "#F5F3FF",
    "i": "",
    "s": 4
  },
  "implementation_ongoing": {
    "l": "In Progress",
    "c": "#D97706",
    "bg": "#FFFBEB",
    "i": "",
    "s": 5
  },
  "implemented": {
    "l": "Implemented",
    "c": "#059669",
    "bg": "#ECFDF5",
    "i": "",
    "s": 6
  },
  "stalled": {
    "l": "Stalled",
    "c": "#DC2626",
    "bg": "#FEF2F2",
    "i": "",
    "s": -1
  }
};

/** Plain-language status descriptions (tooltips + aria labels). */
export const STATUS_DESCRIPTIONS: Record<StatusKey, string> = {
  "in_audit": "Team is currently auditing this site and collecting evidence.",
  "audit_complete": "Audit is finished; report is being prepared.",
  "submitted": "Report submitted to the responsible authority for review.",
  "in_principle_approval": "Authority has approved the proposed intervention.",
  "implementation_ongoing": "Civil work or remediation is actively in progress.",
  "implemented": "Fix is completed and verified on the ground.",
  "stalled": "No response from authority — escalation required."
};

export const RISK_COLORS: Record<Risk, string> = {
  "high": "#C8201A",
  "medium": "#C45D0A",
  "low": "#1A6E3A"
};
export const RISK_LABELS: Record<Risk, string> = {
  "high": "High Risk",
  "medium": "Medium Risk",
  "low": "Lower Risk"
};

/** The 6 on-pipeline steps, in order. "stalled" is deliberately excluded. */
export const PROGRESS_STEPS: { k: StatusKey; l: string }[] = [
  {
    "k": "in_audit",
    "l": "In Audit"
  },
  {
    "k": "audit_complete",
    "l": "Audited"
  },
  {
    "k": "submitted",
    "l": "Submitted"
  },
  {
    "k": "in_principle_approval",
    "l": "Approved"
  },
  {
    "k": "implementation_ongoing",
    "l": "In Progress"
  },
  {
    "k": "implemented",
    "l": "Implemented"
  }
];

export const AUTH_CATEGORIES: { k: string; l: string; d: string }[] = [
  {
    "k": "nhai",
    "l": "NHAI",
    "d": "National Highway Authority"
  },
  {
    "k": "state_pwd",
    "l": "State PWD",
    "d": "Public Works Dept"
  },
  {
    "k": "municipal",
    "l": "Municipal Corp",
    "d": "Urban Local Body"
  },
  {
    "k": "dev_auth",
    "l": "Dev. Authority",
    "d": "Special Authority"
  }
];

/** Fallback bounding boxes, used when a state is missing from the GeoJSON. */
export const STATE_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  "Kerala": [
    [
      8.07,
      74.85
    ],
    [
      12.78,
      77.42
    ]
  ],
  "Madhya Pradesh": [
    [
      21.08,
      74.03
    ],
    [
      26.87,
      82.82
    ]
  ],
  "Assam": [
    [
      24.11,
      89.72
    ],
    [
      27.98,
      96.02
    ]
  ],
  "Uttar Pradesh": [
    [
      23.87,
      77.08
    ],
    [
      30.42,
      84.64
    ]
  ],
  "Delhi": [
    [
      28.4,
      76.84
    ],
    [
      28.88,
      77.35
    ]
  ],
  "Uttarakhand": [
    [
      28.44,
      77.57
    ],
    [
      31.45,
      81.03
    ]
  ],
  "Maharashtra": [
    [
      15.61,
      72.66
    ],
    [
      22.03,
      80.9
    ]
  ],
  "Andhra Pradesh": [
    [
      12.62,
      76.76
    ],
    [
      19.9,
      84.76
    ]
  ],
  "Arunachal Pradesh": [
    [
      26.65,
      91.5
    ],
    [
      29.45,
      97.41
    ]
  ],
  "Tamil Nadu": [
    [
      8.07,
      76.23
    ],
    [
      13.57,
      80.36
    ]
  ],
  "West Bengal": [
    [
      21.44,
      85.82
    ],
    [
      27.22,
      89.89
    ]
  ],
  "Gujarat": [
    [
      20.11,
      68.1
    ],
    [
      24.71,
      74.46
    ]
  ],
  "Punjab": [
    [
      29.54,
      73.88
    ],
    [
      32.5,
      76.91
    ]
  ]
};

/** GeoJSON state-name aliases → our canonical names. */
export const GEO_NAME_MAP: Record<string, string> = {
  "NCT of Delhi": "Delhi",
  "Uttaranchal": "Uttarakhand"
};

/** Google Drive file IDs for site-map images, keyed by location id.
 *  NOTE: locations 12, 29 and 31 have no site map. */
export const SITE_MAPS: Record<string, string> = {
  "1": "1l67woSTAn-AQ4-ZVTWACs2sif86EZB1F",
  "2": "1zQXcI3BvjOAwl4ohFFyHaeZcVDpGST5w",
  "3": "1ISOZTr1g-Ha8GbNbeEjsXgH9zCQkxK5U",
  "4": "1zBof39iEFds30FsBx-8aAgNbGhzHJhk3",
  "5": "15KxW3s04xWZ-n2vBAqxVn8TExNEBOugA",
  "6": "1MmfQwfCPePXJewszUbhSgNUgsZr5ythY",
  "7": "1646wBOoiaqULNnm86-99tOFiR6-owjMc",
  "8": "16swRFjslli_11XD0SN4bDwvEOdFO0ItL",
  "9": "1aM7gW7mJuFkxDcLOKQlxF5DN2ocxCHfA",
  "10": "1gijbcRAp5WQMJMpRmwdCPyYqp9U15LjI",
  "11": "139VjX2qGF3f-MUwuPT-thDQGUod8nVLm",
  "13": "1134qI7PeFLlfNDkKlTDiC9gzM0BrAPig",
  "14": "16leY6j_mUpluXfUZY-KX5nP0Zi6zLFMg",
  "15": "1d9hDRCFZ6S1SIPwDB2NhP6bugclQdmzJ",
  "16": "1HJHaA_fQCFPbBM-rZOG4wBzvyU0Xth1O",
  "17": "1U-b-26_3K9kqWF0o0ciRgqShS-y6v2ZT",
  "18": "1cGNKW3fOP-fengy_Dp0Vu4gqTU_o_C0A",
  "19": "1VpZFLcxyDY6DJspYERo6OvPUf1vMtiFk",
  "20": "17LXLFTCiijRj17IwANSNmmaDRTAn2iIg",
  "21": "1LjQuAzYtGJxhHYcUmob1OSxspGA2jdYD",
  "22": "1-nIsGE6TWDkUS3pAKjMhr-4n2EA-hEzl",
  "23": "14s9o4B5vt-S5DjlS7E-tIn0i2zS_5fZZ",
  "24": "1SBVots7tUkjH9ag9XkJfUwzWNcKTMLFu",
  "25": "1U4HJEpeLwIjjYGpBSlOqe9dxP6DWg0eN",
  "26": "1-vAvmEFS-U0wG8OrMwy9uV2p1qNW31gJ",
  "27": "1S6x4mtRqnJZ40ue9HWUmXQoZWw1kNGda",
  "28": "1MBRNseXLvjXNT3dVvSvB7IbIXONz96oc",
  "30": "10y8AGEfmf-_mi-fJY7MpMZjS9fwAa0LL"
};

/** 20 academic partners. `file` is the original PNG filename — see uniLogoBase prop. */
export const UNIVERSITIES: { name: string; file?: string }[] = [
  {
    "name": "IIT Delhi",
    "file": "01_iit_delhi.png"
  },
  {
    "name": "IIT Bombay",
    "file": "02_iit_bombay.png"
  },
  {
    "name": "IIT Varanasi",
    "file": "03_iit_varanasi.png"
  },
  {
    "name": "IIT Roorkee",
    "file": "04_iit_roorkee.png"
  },
  {
    "name": "IIT Madras",
    "file": "05_iit_madras.png"
  },
  {
    "name": "NIT Calicut",
    "file": "06_nit_calicut.png"
  },
  {
    "name": "DTU",
    "file": "07_dtu.png"
  },
  {
    "name": "SPA Delhi",
    "file": "08_spa_delhi.png"
  },
  {
    "name": "IIT Guwahati",
    "file": "09_iit_guwahati.png"
  },
  {
    "name": "NIT Delhi",
    "file": "10_nit_delhi.png"
  },
  {
    "name": "NIT Durgapur",
    "file": "11_nit_durgapur.png"
  },
  {
    "name": "SPA Vijayawada",
    "file": "12_spa_vijayawada.png"
  },
  {
    "name": "IIT Indore",
    "file": "13_iit_indore.png"
  },
  {
    "name": "Xavier's, Mumbai",
    "file": "14_xavier_s_mumbai.png"
  },
  {
    "name": "NIT Arunachal",
    "file": "15_nit_arunachal.png"
  },
  {
    "name": "IIT Ropar",
    "file": "16_iit_ropar.png"
  },
  {
    "name": "Vignan's Univ",
    "file": "17_vignan_s_univ.png"
  },
  {
    "name": "BBAU Lucknow",
    "file": "18_bbau_lucknow.png"
  },
  {
    "name": "SVNIT Surat",
    "file": "19_svnit_surat.png"
  },
  {
    "name": "IIT Kharagpur",
    "file": "20_iit_kharagpur.png"
  }
];

/** India state-boundary GeoJSON sources, tried in order. */
export const GEO_URLS = [
  "https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/e388c4cae20aa53cb5090210a42ebb9b765c0a36/india_states.geojson",
  "https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson",
  "https://raw.githubusercontent.com/datameet/maps/master/States/India_State_Boundary.geojson"
];

/** Crashfree India primary logo, inlined. Rendered via a utf8 data URI. */
const CFI_LOGO_SVG = "<svg width=\"1894\" height=\"262\" viewBox=\"0 0 1894 262\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"> <g clip-path=\"url(#clip0_4575_342)\"> <path d=\"M511.29 150.398H542.134C542.435 150.398 542.757 150.549 543.08 150.871C543.381 151.194 543.553 151.58 543.553 152.032V152.505C540.286 164.498 534.676 175.245 526.723 184.746C518.77 194.246 509.119 201.726 497.749 207.185C486.379 212.645 474.299 215.374 461.533 215.374C448.765 215.374 435.911 212.537 424.369 206.841C412.827 201.167 403.068 193.322 395.03 183.348C387.012 173.375 381.51 162.155 378.544 149.689C377.147 143.305 376.438 136.836 376.438 130.301C376.438 123.767 377.297 116.352 379.017 109.044C382.133 96.8999 387.7 85.9809 395.717 76.3302C403.735 66.6794 413.471 59.0706 424.928 53.5467C436.384 48.0227 448.571 45.25 461.51 45.25C474.451 45.25 486.314 47.9367 497.62 53.3102C508.904 58.6837 518.535 66.1206 526.488 75.6209C534.44 85.1212 540.049 95.8037 543.316 107.647C543.617 108.12 543.617 108.593 543.316 109.044C542.994 109.517 542.542 109.753 541.919 109.753H511.076C510.452 109.753 509.979 109.366 509.678 108.593C505.465 98.3185 499.039 90.0219 490.398 83.7026C481.758 77.3834 472.129 74.2453 461.533 74.2453C452.033 74.2453 443.262 76.7386 435.245 81.7252C427.228 86.7118 420.865 93.5254 416.201 102.166C411.537 110.806 409.194 120.199 409.194 130.323C409.194 140.447 411.537 149.839 416.201 158.48C420.865 167.121 427.228 173.934 435.245 178.921C443.262 183.907 452.033 186.401 461.533 186.401C472.28 186.401 482.016 183.176 490.742 176.707C499.469 170.237 505.852 161.79 509.915 151.344C510.216 150.721 510.689 150.398 511.312 150.398H511.29Z\" fill=\"#4736FE\"/> <path d=\"M553.878 95.484L578.188 95.2476C578.962 95.2476 579.585 95.527 580.058 96.0644C580.531 96.6017 580.767 97.268 580.767 98.0418V108.552C580.767 109.477 581.24 109.95 582.164 109.95C582.787 109.95 583.174 109.713 583.325 109.24C588.462 97.7194 598.671 91.9375 613.932 91.9375C614.856 91.9375 615.652 92.174 616.275 92.6468C616.898 93.1197 617.221 93.8075 617.221 94.7532V118.354C617.221 119.127 616.941 119.751 616.404 120.224C615.867 120.696 615.2 120.933 614.426 120.933H613.029C604.002 120.933 596.522 123.77 590.59 129.466C584.657 135.162 581.713 142.835 581.713 152.486V209.273C581.713 209.896 581.476 210.477 581.003 211.035C580.531 211.573 579.907 211.852 579.133 211.852L553.9 212.089C553.126 212.089 552.502 211.831 552.03 211.272C551.557 210.734 551.32 210.068 551.32 209.294V98.0633C551.32 97.2895 551.6 96.6662 552.137 96.1933C552.674 95.7204 553.255 95.484 553.9 95.484H553.878Z\" fill=\"#4736FE\"/> <path d=\"M621.861 122.352C626.697 112.851 633.274 105.328 641.614 99.8044C649.953 94.2805 659.024 91.5078 668.846 91.5078C676.326 91.5078 683.462 93.1843 690.233 96.5374C697.003 99.8904 702.807 104.447 707.643 110.207V97.5906C707.643 96.9672 707.922 96.4299 708.46 95.957C708.997 95.4841 709.663 95.2477 710.437 95.2477H736.617C737.24 95.2477 737.777 95.4841 738.25 95.957C738.723 96.4299 738.96 96.9672 738.96 97.5906V209.531C738.96 210.154 738.723 210.735 738.25 211.293C737.777 211.831 737.24 212.11 736.617 212.11H710.437C709.663 212.11 708.997 211.874 708.46 211.401C707.922 210.928 707.643 210.305 707.643 209.531V197.15C702.807 202.911 697.003 207.468 690.233 210.821C683.462 214.174 676.326 215.85 668.846 215.85C659.024 215.85 649.953 213.077 641.614 207.554C633.274 202.03 626.697 194.464 621.861 184.877C617.024 175.291 614.617 164.824 614.617 153.453C614.617 142.083 617.024 131.873 621.861 122.373V122.352ZM697.111 179.139C703.344 173.056 706.848 165.662 707.621 156.935C707.772 155.99 707.858 154.829 707.858 153.432C707.858 152.185 707.772 151.175 707.621 150.401C706.848 141.675 703.366 134.281 697.218 128.198C691.071 122.115 683.699 119.084 675.144 119.084C669.384 119.084 664.01 120.654 659.024 123.749C654.037 126.865 650.061 131.035 647.116 136.258C644.15 141.481 642.667 147.199 642.667 153.432C642.667 159.665 644.15 165.662 647.116 170.949C650.082 176.237 654.037 180.45 659.024 183.566C664.01 186.683 669.384 188.23 675.144 188.23C683.548 188.23 690.878 185.2 697.111 179.117V179.139Z\" fill=\"#4736FE\"/> <path d=\"M797.144 215.825C787.945 215.825 779.841 214.492 772.834 211.848C766.601 209.054 761.614 205.701 757.875 201.811C753.662 196.824 750.932 192.848 749.685 189.903L748.977 188.033C748.504 186.786 748.01 185.346 747.451 183.713C746.914 182.079 746.312 180.252 745.688 178.232C745.688 177.608 745.924 176.985 746.397 176.362C746.87 175.739 747.321 175.438 747.794 175.438H773.029C773.502 175.438 773.93 175.588 774.317 175.91C774.704 176.233 774.898 176.62 774.898 177.071C775.671 179.715 776.854 181.972 778.401 183.842C780.271 186.335 782.765 188.291 785.881 189.688C788.525 191.408 792.738 192.267 798.498 192.267C804.731 192.267 809.096 190.87 811.589 188.055C814.555 185.26 816.037 182.208 816.037 178.941C816.037 175.674 814.941 173.331 812.77 171.461C810.277 169.441 806.623 167.958 801.787 167.012L785.43 163.509C780.142 162.584 773.973 160.628 766.966 157.662C760.583 154.395 755.983 150.741 753.189 146.679C749.298 141.843 747.343 135.846 747.343 128.688C747.343 118.264 751.469 109.365 759.723 102.057C767.977 95.0504 778.96 91.5469 792.673 91.5469C801.249 91.5469 808.643 92.7076 814.876 95.0504C820.787 97.5437 825.538 100.574 829.128 104.164C832.244 107.753 834.823 111.407 836.843 115.147C837.939 117.34 839.014 120.22 840.11 123.788L840.82 125.658C840.82 126.431 840.627 127.098 840.24 127.635C839.853 128.172 839.337 128.452 838.714 128.452H814.641C814.018 128.452 813.393 128.151 812.77 127.528L812.534 127.291C811.609 124.647 810.665 122.692 809.74 121.445C808.171 119.725 806.085 118.178 803.42 116.781C801.077 115.384 797.424 114.674 792.438 114.674C786.204 114.674 781.926 115.921 779.583 118.414C776.94 121.208 775.607 124.024 775.607 126.818C775.607 130.085 777.004 132.514 779.82 134.062C782.936 135.631 786.59 136.856 790.803 137.802L806.236 141.069C816.983 143.412 826.096 147.302 833.576 152.762C840.734 158.522 844.323 166.625 844.323 177.071C844.323 184.551 842.367 191.171 838.477 196.932C835.038 202.541 829.75 207.055 822.593 210.494C815.435 214.084 806.945 215.868 797.122 215.868L797.144 215.825Z\" fill=\"#4736FE\"/> <path d=\"M852.594 210.687V49.9127C852.594 48.9669 853.067 48.5156 853.991 48.5156H882.492C883.437 48.5156 883.889 48.9884 883.889 49.9127V114.179C888.102 109.666 892.529 106.549 897.215 104.83C901.879 103.11 907.661 102.25 914.518 102.25C920.278 102.25 926.812 103.647 934.142 106.463C942.245 110.354 948.736 116.135 953.658 123.766C958.559 131.396 961.009 139.736 961.009 148.763V210.687C961.009 211.16 960.859 211.504 960.536 211.74C960.214 211.977 959.913 212.084 959.59 212.084H931.09C930.144 212.084 929.692 211.611 929.692 210.687V154.137C929.692 147.903 928.102 142.422 924.899 137.651C921.697 132.901 917.376 130.064 911.938 129.118C909.746 128.817 908.048 128.645 906.801 128.645C901.664 128.645 897.409 129.978 894.055 132.621C890.702 135.265 888.102 138.704 886.232 142.895C884.663 146.485 883.889 152.009 883.889 159.489V210.666C883.889 211.611 883.416 212.063 882.492 212.063H853.991C853.045 212.063 852.594 211.59 852.594 210.666V210.687Z\" fill=\"#4736FE\"/> <path d=\"M986.693 209.531V125.167C986.693 124.544 986.412 124.006 985.875 123.533C985.338 123.06 984.737 122.824 984.114 122.824H964.017C963.393 122.824 962.813 122.545 962.254 122.007C961.717 121.47 961.438 120.89 961.438 120.245V97.8052C961.438 97.0314 961.717 96.4081 962.254 95.9353C962.792 95.4624 963.372 95.2259 964.017 95.2259H986.693V94.9895C986.693 86.1125 987.66 78.869 989.616 73.2591C991.572 67.6492 994.796 62.6626 999.31 58.2994C1002.73 54.8818 1007.22 52.3885 1012.74 50.8195C1018.27 49.2719 1024.22 48.4766 1030.63 48.4766C1036.54 48.4766 1042.47 49.5729 1048.38 51.7438L1050.01 52.453C1050.96 52.9259 1051.41 53.6997 1051.41 54.7959V55.2687L1047.2 77.2355C1047.05 77.8588 1046.73 78.3317 1046.27 78.6326C1045.8 78.955 1045.26 79.1055 1044.64 79.1055C1044.17 79.1055 1043.87 79.0195 1043.69 78.8691C1039.48 76.8487 1035.59 75.8384 1032 75.8384C1022.5 75.8384 1017.75 81.9857 1017.75 94.3017V95.2474H1040.43C1041.2 95.2474 1041.82 95.4838 1042.3 95.9567C1042.77 96.4296 1043.01 97.0529 1043.01 97.8267V120.266C1043.01 120.89 1042.77 121.47 1042.3 122.029C1041.82 122.566 1041.2 122.846 1040.43 122.846H1020.33C1019.71 122.846 1019.13 123.082 1018.57 123.555C1018.03 124.028 1017.75 124.565 1017.75 125.188V209.552C1017.75 210.326 1017.52 210.949 1017.04 211.422C1016.57 211.895 1016.03 212.131 1015.41 212.131H988.992C988.368 212.131 987.832 211.873 987.359 211.315C986.886 210.777 986.65 210.175 986.65 209.552L986.693 209.531Z\" fill=\"#4736FE\"/> <path d=\"M1055.39 95.484L1079.7 95.2476C1080.48 95.2476 1081.1 95.527 1081.57 96.0644C1082.05 96.6017 1082.28 97.268 1082.28 98.0418V108.552C1082.28 109.477 1082.76 109.95 1083.68 109.95C1084.3 109.95 1084.69 109.713 1084.84 109.24C1089.98 97.7194 1100.19 91.9375 1115.45 91.9375C1116.37 91.9375 1117.17 92.174 1117.79 92.6468C1118.41 93.1197 1118.74 93.8075 1118.74 94.7532V118.354C1118.74 119.127 1118.46 119.751 1117.92 120.224C1117.38 120.696 1116.72 120.933 1115.94 120.933H1114.55C1105.52 120.933 1098.04 123.77 1092.11 129.466C1086.17 135.162 1083.23 142.835 1083.23 152.486V209.273C1083.23 209.896 1082.99 210.477 1082.52 211.035C1082.05 211.573 1081.42 211.852 1080.65 211.852L1055.42 212.089C1054.64 212.089 1054.02 211.831 1053.55 211.272C1053.07 210.734 1052.84 210.068 1052.84 209.294V98.0633C1052.84 97.2895 1053.12 96.6662 1053.65 96.1933C1054.19 95.7204 1054.77 95.484 1055.42 95.484H1055.39Z\" fill=\"#4736FE\"/> <path d=\"M1126.43 123.061C1131.96 113.711 1139.44 106.274 1148.87 100.75C1158.29 95.2259 1168.54 92.4531 1179.61 92.4531C1189.11 92.4531 1198.07 94.5166 1206.48 98.6434C1214.88 102.77 1221.97 108.488 1227.73 115.817C1233.49 123.147 1237.39 131.314 1239.43 140.363C1239.73 141.76 1240.05 143.716 1240.37 146.209C1240.67 148.23 1240.85 150.723 1240.85 153.689C1240.85 156.183 1240.76 158.053 1240.61 159.299C1240.61 159.923 1240.37 160.438 1239.9 160.825C1239.43 161.212 1238.89 161.406 1238.27 161.406H1149C1150.72 169.186 1154.42 175.656 1160.09 180.793C1165.77 185.93 1172.28 188.509 1179.61 188.509C1181.78 188.509 1184.3 188.123 1187.09 187.349C1193 185.629 1197.99 182.448 1202.05 177.763C1202.82 176.989 1203.6 176.602 1204.39 176.602H1232.89C1233.84 176.602 1234.48 176.946 1234.87 177.655C1235.26 178.364 1235.3 179.095 1234.98 179.869C1232.33 185.801 1228.59 191.239 1223.76 196.226C1218 202.137 1211.33 206.779 1203.79 210.132C1196.22 213.485 1188.16 215.162 1179.61 215.162C1168.54 215.162 1158.31 212.389 1148.87 206.865C1139.44 201.341 1131.96 193.861 1126.43 184.426C1120.91 175.011 1118.14 164.759 1118.14 153.689C1118.14 142.62 1120.91 132.432 1126.43 123.082V123.061ZM1161.96 124.93C1156.74 128.821 1152.96 133.958 1150.64 140.363H1208.35C1206 133.979 1202.22 128.842 1197.02 124.93C1191.8 121.04 1185.99 119.084 1179.61 119.084C1173.23 119.084 1167.19 121.04 1161.96 124.93Z\" fill=\"#4736FE\"/> <path d=\"M1255.05 123.061C1260.57 113.711 1268.05 106.274 1277.49 100.75C1286.9 95.2259 1297.16 92.4531 1308.23 92.4531C1317.73 92.4531 1326.69 94.5166 1335.09 98.6434C1343.5 102.77 1350.59 108.488 1356.35 115.817C1362.11 123.147 1366 131.314 1368.04 140.363C1368.35 141.76 1368.67 143.716 1368.99 146.209C1369.29 148.23 1369.46 150.723 1369.46 153.689C1369.46 156.183 1369.38 158.053 1369.23 159.299C1369.23 159.923 1368.99 160.438 1368.52 160.825C1368.04 161.212 1367.51 161.406 1366.88 161.406H1277.62C1279.34 169.186 1283.04 175.656 1288.73 180.793C1294.41 185.93 1300.92 188.509 1308.25 188.509C1310.42 188.509 1312.91 188.123 1315.73 187.349C1321.64 185.629 1326.63 182.448 1330.69 177.763C1331.46 176.989 1332.24 176.602 1333.03 176.602H1361.53C1362.46 176.602 1363.12 176.946 1363.51 177.655C1363.9 178.364 1363.94 179.095 1363.62 179.869C1360.97 185.801 1357.23 191.239 1352.4 196.226C1346.64 202.137 1339.97 206.779 1332.41 210.132C1324.84 213.485 1316.78 215.162 1308.23 215.162C1297.16 215.162 1286.93 212.389 1277.49 206.865C1268.05 201.341 1260.57 193.861 1255.05 184.426C1249.53 175.011 1246.75 164.759 1246.75 153.689C1246.75 142.62 1249.53 132.432 1255.05 123.082V123.061ZM1290.58 124.93C1285.36 128.821 1281.57 133.958 1279.25 140.363H1336.96C1334.62 133.979 1330.84 128.842 1325.64 124.93C1320.41 121.04 1314.61 119.084 1308.23 119.084C1301.84 119.084 1295.8 121.04 1290.58 124.93Z\" fill=\"#4736FE\"/> <path d=\"M1502.75 103.884C1506.79 100.467 1510.14 98.0809 1512.79 96.7483C1515.43 95.4371 1518.16 94.298 1520.97 93.3523L1521.68 93.1159C1525.42 92.1701 1528.93 91.7188 1532.19 91.7188C1539.82 91.7188 1546.98 93.3522 1553.69 96.6193C1562.57 100.832 1569.66 107.108 1574.95 115.427C1580.23 123.766 1582.9 132.837 1582.9 142.659V209.033C1582.9 209.806 1582.58 210.516 1581.97 211.139C1581.35 211.762 1580.64 212.063 1579.87 212.063H1554.4C1553.62 212.063 1552.91 211.762 1552.29 211.139C1551.67 210.516 1551.37 209.806 1551.37 209.033V144.529C1551.37 135.953 1549.26 129.032 1545.05 123.723C1540.83 118.436 1534.77 115.77 1526.82 115.77C1520.29 115.77 1514.74 117.597 1510.23 121.273C1505.71 124.927 1502.51 130.042 1500.64 136.577V136.813C1500.02 138.833 1499.7 141.176 1499.7 143.82V208.796C1499.7 209.57 1499.37 210.279 1498.77 210.903C1498.17 211.526 1497.44 211.827 1496.66 211.827H1471.43C1469.41 211.827 1468.4 210.731 1468.4 208.56V97.78C1468.4 97.1567 1468.59 96.6623 1468.98 96.254C1469.37 95.8671 1469.8 95.6736 1470.27 95.6736H1493.87C1494.97 95.6736 1495.5 96.2109 1495.5 97.3071V108.291V107.818C1495.65 108.291 1495.98 108.591 1496.45 108.742C1496.92 108.892 1497.46 108.656 1498.08 108.033L1502.75 103.82V103.884Z\" fill=\"#4736FE\"/> <path d=\"M1597.25 122.353C1602.09 112.853 1608.67 105.33 1617.01 99.806C1625.35 94.2821 1634.42 91.5094 1644.24 91.5094C1651.72 91.5094 1658.83 93.1859 1665.63 96.5389C1672.4 99.892 1678.2 104.449 1683.04 110.209V51.0792C1683.04 50.3054 1683.31 49.6821 1683.85 49.2093C1684.39 48.7364 1685.06 48.5 1685.83 48.5H1712.01C1712.63 48.5 1713.17 48.7794 1713.64 49.3168C1714.12 49.8541 1714.35 50.4559 1714.35 51.0792V209.533C1714.35 210.156 1714.12 210.736 1713.64 211.295C1713.17 211.832 1712.63 212.112 1712.01 212.112H1685.83C1685.06 212.112 1684.39 211.875 1683.85 211.403C1683.31 210.93 1683.04 210.306 1683.04 209.533V197.152C1678.2 202.912 1672.4 207.469 1665.63 210.822C1658.85 214.175 1651.72 215.852 1644.24 215.852C1634.42 215.852 1625.35 213.079 1617.01 207.555C1608.67 202.031 1602.09 194.465 1597.25 184.879C1592.42 175.293 1590.01 164.825 1590.01 153.455C1590.01 142.085 1592.42 131.875 1597.25 122.375V122.353ZM1672.5 179.14C1678.74 173.057 1682.24 165.663 1683.01 156.937C1683.16 155.991 1683.25 154.831 1683.25 153.433C1683.25 152.187 1683.16 151.177 1683.01 150.403C1682.24 141.676 1678.76 134.282 1672.61 128.2C1666.46 122.117 1659.09 119.086 1650.54 119.086C1644.78 119.086 1639.4 120.655 1634.42 123.75C1629.43 126.867 1625.45 131.037 1622.51 136.26C1619.54 141.483 1618.06 147.2 1618.06 153.433C1618.06 159.667 1619.54 165.664 1622.51 170.951C1625.47 176.239 1629.43 180.451 1634.42 183.568C1639.4 186.685 1644.78 188.232 1650.54 188.232C1658.94 188.232 1666.27 185.201 1672.5 179.119V179.14Z\" fill=\"#4736FE\"/> <path d=\"M1729.83 77.4898V58.3172C1729.83 56.5977 1730.45 55.1576 1731.7 53.9969C1732.94 52.8362 1734.34 52.2344 1735.91 52.2344L1755.08 52.4709C1756.8 52.4709 1758.24 53.0512 1759.4 54.2333C1760.56 55.4155 1761.16 56.8341 1761.16 58.5536V77.7262C1761.16 79.4457 1760.58 80.8858 1759.4 82.0465C1758.24 83.2071 1756.8 83.809 1755.08 83.809L1735.91 83.5726C1734.19 83.5726 1732.75 82.9922 1731.59 81.8101C1730.43 80.6494 1729.83 79.2093 1729.83 77.4898ZM1729.83 209.763V97.823C1729.83 97.1997 1730.06 96.6624 1730.54 96.1895C1731.01 95.7166 1731.63 95.4802 1732.41 95.4802L1758.59 95.2438C1759.36 95.2438 1759.98 95.4802 1760.46 95.953C1760.93 96.4259 1761.16 97.0492 1761.16 97.823V209.527C1761.16 210.15 1760.93 210.731 1760.46 211.289C1759.98 211.827 1759.36 212.106 1758.59 212.106L1732.41 212.343C1731.78 212.343 1731.2 212.063 1730.64 211.526C1730.11 210.989 1729.83 210.387 1729.83 209.763Z\" fill=\"#4736FE\"/> <path d=\"M1422.87 77.4898V58.3172C1422.87 56.5977 1423.49 55.1576 1424.74 53.9969C1425.99 52.8362 1427.38 52.2344 1428.95 52.2344L1448.13 52.4709C1449.85 52.4709 1451.29 53.0512 1452.45 54.2333C1453.61 55.4155 1454.21 56.8341 1454.21 58.5536V77.7262C1454.21 79.4457 1453.63 80.8858 1452.45 82.0465C1451.29 83.2071 1449.85 83.809 1448.13 83.809L1428.95 83.5726C1427.23 83.5726 1425.79 82.9922 1424.63 81.8101C1423.47 80.6494 1422.87 79.2093 1422.87 77.4898ZM1422.87 209.763V97.823C1422.87 97.1997 1423.11 96.6624 1423.58 96.1895C1424.05 95.7166 1424.68 95.4802 1425.45 95.4802L1451.63 95.2438C1452.4 95.2438 1453.03 95.4802 1453.5 95.953C1453.97 96.4259 1454.21 97.0492 1454.21 97.823V209.527C1454.21 210.15 1453.97 210.731 1453.5 211.289C1453.03 211.827 1452.4 212.106 1451.63 212.106L1425.45 212.343C1424.83 212.343 1424.25 212.063 1423.69 211.526C1423.15 210.989 1422.87 210.387 1422.87 209.763Z\" fill=\"#4736FE\"/> <path d=\"M1776.9 122.352C1781.74 112.851 1788.31 105.328 1796.65 99.8044C1804.99 94.2805 1814.06 91.5078 1823.89 91.5078C1831.37 91.5078 1838.48 93.1843 1845.27 96.5374C1852.04 99.8904 1857.85 104.447 1862.68 110.207V97.5906C1862.68 96.9672 1862.96 96.4299 1863.5 95.957C1864.04 95.4841 1864.7 95.2477 1865.48 95.2477H1891.66C1892.28 95.2477 1892.82 95.4841 1893.29 95.957C1893.76 96.4299 1894 96.9672 1894 97.5906V209.531C1894 210.154 1893.76 210.735 1893.29 211.293C1892.82 211.831 1892.28 212.11 1891.66 212.11H1865.48C1864.7 212.11 1864.04 211.874 1863.5 211.401C1862.96 210.928 1862.68 210.305 1862.68 209.531V197.15C1857.85 202.911 1852.04 207.468 1845.27 210.821C1838.5 214.174 1831.37 215.85 1823.89 215.85C1814.06 215.85 1804.99 213.077 1796.65 207.554C1788.31 202.03 1781.74 194.464 1776.9 184.877C1772.07 175.291 1769.66 164.824 1769.66 153.453C1769.66 142.083 1772.07 131.873 1776.9 122.373V122.352ZM1852.15 179.139C1858.39 173.056 1861.89 165.662 1862.66 156.935C1862.81 155.99 1862.9 154.829 1862.9 153.432C1862.9 152.185 1862.81 151.175 1862.66 150.401C1861.89 141.675 1858.41 134.281 1852.26 128.198C1846.11 122.115 1838.74 119.084 1830.19 119.084C1824.42 119.084 1819.05 120.654 1814.06 123.749C1809.08 126.865 1805.1 131.035 1802.16 136.258C1799.19 141.481 1797.71 147.199 1797.71 153.432C1797.71 159.665 1799.19 165.662 1802.16 170.949C1805.12 176.237 1809.08 180.45 1814.06 183.566C1819.05 186.683 1824.42 188.23 1830.19 188.23C1838.59 188.23 1845.92 185.2 1852.15 179.117V179.139Z\" fill=\"#4736FE\"/> <path d=\"M108.473 59.2828C107.654 63.7948 111.12 67.9472 115.706 67.9472H175.307C179.893 67.9472 183.359 63.7948 182.54 59.2828L173.32 8.48548C172.403 3.43475 176.821 -0.96249 181.791 0.321531C244.408 16.4988 290.663 73.3656 290.663 141.038C290.663 190.186 266.264 233.633 228.92 259.935C224.718 262.894 219.029 260.33 218.111 255.273L194.712 126.351C194.077 122.855 191.032 120.313 187.478 120.313H103.535C99.9811 120.313 96.9362 122.855 96.3015 126.351L72.8613 255.491C71.9448 260.54 66.2699 263.107 62.0662 260.163C24.5394 233.885 0 190.328 0 141.038C2.53041e-05 73.2269 46.4435 16.264 109.257 0.220684C114.222 -1.04767 118.626 3.34693 117.71 8.38983L108.473 59.2828Z\" fill=\"#4736FE\"/> </g> <defs> <clipPath id=\"clip0_4575_342\"> <rect width=\"1894\" height=\"262\" fill=\"white\"/> </clipPath> </defs> </svg>";
export const CFI_LOGO_DATA_URI =
  "data:image/svg+xml;utf8," + encodeURIComponent(CFI_LOGO_SVG);

/* ── STYLES ───────────────────────────────────────────────────────────────────
   Injected once into <head> as a <style> tag, keyed by STYLE_ID so repeated
   mounts do not duplicate it. Ported verbatim from src/styles.css.

   The design TOKENS are scoped to .rk-app (the original put them on :root), so
   they cannot leak into a host page. The RULE SELECTORS, however, are the
   original unprefixed ones — .nav, .stat, .chip, .sidebar, .detail, .modal,
   .overlay, .footer, .legend, .search, .btn-p, .f-inp and friends. If the host
   app already uses any of those class names, they will collide. Prefix them
   before dropping this into a large existing stylesheet.

   ⚠️ There are deliberately NO media queries here — this is a faithful copy of
      the original, which was desktop-only. See the header note.             */

const STYLE_ID = "rk-standalone-styles";

const CSS = String.raw`
.rk-app, .rk-app *{box-sizing:border-box;margin:0;padding:0}
.rk-app{
  --bg:#F7F5F0;--surface:#FFFFFF;--surface2:#FAFAF7;
  --rk-border:#E8E3DA;--rk-border2:#D4CEBF;
  --text:#1A1714;--text2:#5C5650;--text3:#9C9690;
  --high:#C8201A;--high-bg:#FEF0EF;--high-bdr:#FBCECA;
  --med:#C45D0A;--med-bg:#FFF5EC;--med-bdr:#FDD9B0;
  --low:#1A6E3A;--low-bg:#EEF9F2;--low-bdr:#AADDC0;
  --navy:#0F1B30;--rk-radius:10px;
  --sh:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);
  --sh-md:0 4px 12px rgba(0,0,0,.08),0 2px 4px rgba(0,0,0,.04);
  --sh-lg:0 12px 32px rgba(0,0,0,.10),0 4px 8px rgba(0,0,0,.05);
  --detail-w:370px;
}
html:has(.rk-app), body:has(.rk-app){height:100%;overflow:hidden;overscroll-behavior:none}
.rk-app{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);font-size:14px;display:flex;flex-direction:column;height:100dvh;width:100vw;overflow:hidden;position:fixed;inset:0;isolation:isolate}


/* ============ NAV — 3 column grid ============ */
.nav{flex-shrink:0;background:#fff;border-bottom:1px solid var(--rk-border);padding:0 20px;height:62px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;z-index:1000;box-shadow:var(--sh)}
.nav-left{display:flex;align-items:center;gap:0}
.nav-logo-img{height:36px;width:auto;max-width:180px;object-fit:contain;filter:invert(1);cursor:pointer}
.nav-center{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.nav-title{font-family:'Fraunces',serif;font-size:18px;font-weight:700;color:var(--navy);letter-spacing:-.3px;line-height:1}
.nav-tagline{font-size:10px;color:var(--text3);margin-top:3px;font-weight:400;letter-spacing:.2px;font-style:italic}
.nav-right{display:flex;align-items:center;gap:7px;justify-content:flex-end}
.nav-btn{border:none;padding:8px 14px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;white-space:nowrap;display:flex;align-items:center;gap:5px}
.nav-btn-primary{background:var(--navy);color:#fff}
.nav-btn-primary:hover{opacity:.87}
.nav-btn-outline{background:#fff;color:var(--high);border:1px solid var(--high-bdr);background:var(--high-bg)}
.nav-btn-outline:hover{background:#FBDBD9}

/* ============ STATS BAR ============ */
.stats-bar{flex-shrink:0;background:#fff;border-bottom:1px solid var(--rk-border);padding:0 20px;display:flex;align-items:stretch;height:52px;overflow:hidden}
.stat{display:flex;flex-direction:column;justify-content:center;padding:0 16px;border-right:1px solid var(--rk-border);min-width:0;white-space:nowrap}
.stat:first-child{padding-left:0}
.stat-val{font-family:'Fraunces',serif;font-size:18px;font-weight:600;color:var(--navy);line-height:1}
.stat-lbl{font-size:9px;color:var(--text3);margin-top:2px;font-weight:500;text-transform:uppercase;letter-spacing:.4px}
/* Contextual block — same width as detail sidebar */
.stat-ctx{display:none;align-items:center;margin-left:auto;padding-left:0;min-width:var(--detail-w);border-left:1px solid var(--rk-border);flex-shrink:0}
.stat-ctx.show{display:flex}
.ctx-sep{width:1px;background:var(--rk-border);height:28px;margin:0 14px}
.ctx-block{flex:1;display:flex;flex-direction:column;justify-content:center;min-width:0;padding-left:14px}
.ctx-loc{font-size:14px;font-weight:700;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px}
.ctx-loc-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.ctx-auth{font-size:10px;color:var(--text2);font-weight:500;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ctx-x{margin-right:8px;width:22px;height:22px;border:1px solid var(--rk-border);border-radius:50%;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:12px;flex-shrink:0}
.ctx-x:hover{background:var(--bg)}

/* ============ MAIN ============ */
.main{flex:1;display:flex;min-height:0;overflow:hidden}

/* ============ SIDEBAR ============ */
.sidebar{width:230px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--rk-border);display:flex;flex-direction:column;overflow:hidden;min-height:0}
.sb-head{padding:11px 13px;border-bottom:1px solid var(--rk-border);flex-shrink:0}
.sb-title{font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:7px}
.search{width:100%;border:1px solid var(--rk-border);border-radius:7px;padding:6px 9px;font-family:'DM Sans',sans-serif;font-size:12px;color:var(--text);background:var(--surface2);outline:none;transition:border-color .15s}
.search:focus{border-color:var(--navy)}
.search::placeholder{color:var(--text3)}

/* Selected location card */
.sb-selected{display:none;padding:10px 13px;border-bottom:2px solid var(--navy);background:linear-gradient(135deg,#F0F4FF,#E8EEFF);flex-shrink:0}
.sb-selected.show{display:block}
.sb-sel-label{font-size:9px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;opacity:.7}
.sb-sel-name{font-size:12px;font-weight:700;color:var(--navy);line-height:1.3;margin-bottom:5px}
.sb-sel-auth{font-size:11px;font-weight:600;color:var(--navy);margin-bottom:5px;display:flex;align-items:center;gap:5px}
.sb-sel-auth-label{font-size:9px;font-weight:500;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:2px}
.sb-sel-status{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:100px;font-size:10px;font-weight:600;margin-top:2px}
.sb-sel-clear{margin-top:7px;font-size:10px;color:var(--navy);cursor:pointer;text-decoration:underline;display:inline-block;opacity:.6}
.sb-sel-clear:hover{opacity:1}

.sb-section{padding:8px 13px;border-bottom:1px solid var(--rk-border);flex-shrink:0}
.f-label{font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:5px}
.chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:100px;border:1px solid var(--rk-border);cursor:pointer;margin:2px 2px 2px 0;font-size:11px;font-weight:500;color:var(--text2);background:#fff;transition:all .15s;user-select:none}
.chip:hover{border-color:var(--navy);color:var(--navy)}
.chip.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.chip-count{border-radius:100px;padding:0 4px;font-size:10px;font-weight:600}
.chip:not(.on) .chip-count{background:var(--bg);color:var(--text3)}
.chip.on .chip-count{background:rgba(255,255,255,.2);color:#fff}
.cdot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.chip.on .cdot{background:#fff}
.loc-scroll{flex:1;overflow-y:auto;overscroll-behavior:contain}
/* State chips scrollable container */
.state-chips-wrap{max-height:130px;overflow-y:auto;overflow-x:hidden;padding-right:2px;padding-bottom:2px}
.state-chips-wrap::-webkit-scrollbar{width:4px}
.state-chips-wrap::-webkit-scrollbar-track{background:var(--bg);border-radius:2px}
.state-chips-wrap::-webkit-scrollbar-thumb{background:var(--rk-border2);border-radius:2px}
.state-chips-wrap::-webkit-scrollbar-thumb:hover{background:var(--text3)}
.sb-section.states-section{padding-bottom:10px}
/* Filter area above location list — scrollable as a block */
.sb-filters{flex-shrink:0;overflow-y:auto;overscroll-behavior:contain;max-height:52%;border-bottom:1px solid var(--rk-border)}
.sb-filters::-webkit-scrollbar{width:3px}
.sb-filters::-webkit-scrollbar-thumb{background:var(--rk-border2);border-radius:2px}
.loc-row{display:flex;align-items:center;gap:8px;padding:7px 13px;cursor:pointer;border-bottom:1px solid var(--rk-border);transition:background .12s}
.loc-row:hover{background:var(--surface2)}
.loc-row.active{background:#EFF4FF;border-left:3px solid var(--navy)}
.loc-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.loc-name{font-size:11px;font-weight:500;color:var(--text);line-height:1.3;flex:1}
.loc-city{font-size:10px;color:var(--text3);margin-top:1px}
.loc-spill{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.empty-sb{padding:28px 13px;text-align:center;color:var(--text3);font-size:11px}

/* ============ MAP ============ */
.map-wrap{flex:1;position:relative;min-width:0;min-height:0;isolation:isolate;z-index:0;overflow:hidden;contain:strict}
#map{position:absolute;top:0;left:0;right:0;bottom:0;background:#DDD8CC}
.map-loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:400;background:#fff;padding:11px 18px;border-radius:10px;border:1px solid var(--rk-border);font-size:12px;color:var(--text3);box-shadow:var(--sh-md);display:flex;align-items:center;gap:8px;transition:opacity .5s}
.map-loading.hide{opacity:0;pointer-events:none}
/* Reset India button */
.map-reset{position:absolute;top:14px;right:14px;z-index:400;background:#fff;border:1px solid var(--rk-border);border-radius:8px;padding:7px 12px;font-size:11px;font-weight:600;color:var(--navy);cursor:pointer;box-shadow:var(--sh-md);display:flex;align-items:center;gap:5px;transition:all .15s}
.map-reset:hover{background:var(--bg);border-color:var(--rk-border2)}
/* Legend */
.legend{position:absolute;bottom:16px;left:14px;z-index:400;background:#fff;border:1px solid var(--rk-border);border-radius:var(--rk-radius);padding:9px 13px;box-shadow:var(--sh-md);pointer-events:none}
.l-title{font-size:9px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.l-row{display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:10px;color:var(--text2);font-weight:500}
.l-dot{width:9px;height:9px;border-radius:50%}

/* ============ DETAIL PANEL — no sticky header ============ */
.detail{width:0;flex-shrink:0;background:#fff;border-left:1px solid var(--rk-border);display:flex;flex-direction:column;overflow:hidden;transition:width .25s ease}
.detail.open{width:var(--detail-w)}
.d-scroll{flex:1;overflow-y:auto}
/* Hero — with close btn inside */
.d-hero{padding:14px 16px 10px;position:relative;border-bottom:1px solid var(--rk-border)}
.d-close-btn{position:absolute;top:12px;right:12px;width:24px;height:24px;border:1px solid var(--rk-border);border-radius:50%;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text2);font-size:14px;flex-shrink:0}
.d-close-btn:hover{background:var(--bg)}
.risk-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:100px;font-size:10px;font-weight:600;margin-bottom:6px}
.risk-badge.high{background:var(--high-bg);color:var(--high);border:1px solid var(--high-bdr)}
.risk-badge.medium{background:var(--med-bg);color:var(--med);border:1px solid var(--med-bdr)}
.risk-badge.low{background:var(--low-bg);color:var(--low);border:1px solid var(--low-bdr)}
/* City/State — more prominent */
.d-city-state{font-size:15px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:7px;margin-bottom:4px}
.d-city-state .risk-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.d-name{font-family:'Fraunces',serif;font-size:14px;font-weight:500;color:var(--text2);line-height:1.3;margin-bottom:4px}
.d-type{font-size:10px;color:var(--text3);padding:3px 7px;background:var(--bg);border-radius:5px;display:inline-block}

/* Status Progress */
.prog-wrap{padding:12px 16px;border-bottom:1px solid var(--rk-border)}
.prog-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.prog-ttl{font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.6px}
.prog-curr{font-size:11px;font-weight:700}
.prog-steps{display:flex;align-items:flex-start;width:100%;position:relative}
.prog-step{flex:1;display:flex;flex-direction:column;align-items:center;position:relative}
.prog-step:not(:last-child)::after{content:'';position:absolute;top:7px;left:50%;width:100%;height:2px;background:var(--rk-border);z-index:0}
.prog-step.done:not(:last-child)::after{background:var(--navy)}
.prog-circ{width:15px;height:15px;border-radius:50%;border:2px solid var(--rk-border);background:#fff;z-index:1;position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.prog-step.done .prog-circ{background:var(--navy);border-color:var(--navy)}
.prog-step.current .prog-circ{background:var(--navy);border-color:var(--navy);box-shadow:0 0 0 3px rgba(15,27,48,.12)}
.prog-lbl{font-size:8px;color:var(--text3);margin-top:4px;text-align:center;font-weight:500;line-height:1.2}
.prog-step.done .prog-lbl,.prog-step.current .prog-lbl{color:var(--navy);font-weight:700}
.prog-team{font-size:10px;color:var(--text3);margin-top:7px}
.prog-stall{display:flex;align-items:center;gap:7px;padding:8px 10px;background:#FEF2F2;border:1px solid #FBCECA;border-radius:7px;font-size:11px;color:var(--high);font-weight:700}

/* Sections */
.d-sec{padding:11px 16px;border-top:1px solid var(--rk-border)}
.d-sec-h{font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:7px}
.crash-box{background:var(--bg);border-radius:var(--rk-radius);padding:9px 11px;font-size:12px;color:var(--text);line-height:1.6}
.finding{display:flex;gap:7px;align-items:flex-start;margin-bottom:6px;font-size:12px;color:var(--text);line-height:1.5}
.fdot{width:5px;height:5px;border-radius:50%;background:var(--text3);margin-top:5px;flex-shrink:0}
.sol{background:var(--surface2);border:1px solid var(--rk-border);border-radius:var(--rk-radius);padding:8px 10px;margin-bottom:5px}
.sol-t{font-size:11px;font-weight:600;color:var(--text);margin-bottom:2px}
.sol-c{font-family:'DM Mono',monospace;font-size:10px;color:var(--med);font-weight:500}
.impact-box{background:linear-gradient(135deg,var(--low-bg),#F0FDF4);border:1px solid var(--low-bdr);border-radius:var(--rk-radius);padding:10px 12px;font-size:12px;color:var(--low);font-weight:500;line-height:1.5}
.auth{display:flex;flex-direction:column;padding:8px 10px;border:1px solid var(--rk-border);border-radius:var(--rk-radius);margin-bottom:5px}
.auth.primary{border-left:3px solid var(--navy);background:#FAFBFF}
.auth-n{font-size:11px;font-weight:600;color:var(--navy);margin-bottom:2px}
.auth-r{font-size:10px;color:var(--text3);line-height:1.4}
.prim-tag{font-size:9px;background:#E8EDFF;color:#3B3FAF;padding:1px 5px;border-radius:3px;margin-left:4px;font-weight:700}
.stall-box{background:#FFF8F0;border:1px solid #FDD9B0;border-radius:var(--rk-radius);padding:10px 11px;font-size:11px;color:#92400E;line-height:1.5}

/* CTAs */
.cta-row{display:flex;gap:8px;padding:12px 16px 16px}
.petition-btn,.report-btn{flex:1;border:none;border-radius:var(--rk-radius);padding:10px 6px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:opacity .15s;text-align:center;line-height:1.3}
.petition-btn{background:var(--navy);color:#fff}
.petition-btn:hover{opacity:.87}
.report-btn{background:var(--high-bg);color:var(--high);border:1px solid var(--high-bdr)}
.report-btn:hover{background:#FBDBD9}

/* ============ FOOTER ============ */
.footer{flex-shrink:0;background:#fff;border-top:1px solid var(--rk-border)}
.footer-top{padding:8px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--rk-border)}
.footer-copy{font-size:10px;color:var(--text3)}
.footer-partners-label{font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.7px;white-space:nowrap;padding-right:12px;border-right:1px solid var(--rk-border);margin-right:12px}
.footer-logos{display:flex;align-items:center;gap:12px;overflow-x:auto;flex:1;padding:4px 0}
.footer-logos::-webkit-scrollbar{display:none}
.uni-item{display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0;cursor:default}
.uni-logo{height:42px;width:42px;object-fit:contain;border-radius:6px;background:#fff;padding:3px;mix-blend-mode:multiply}
.uni-badge{height:26px;width:26px;border-radius:4px;background:var(--navy);display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#fff;text-align:center;line-height:1.2;padding:2px}
.uni-name{font-size:8px;color:var(--text3);text-align:center;max-width:50px;line-height:1.2;display:none}

/* ============ MODALS ============ */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2000;display:none;align-items:center;justify-content:center;padding:20px}
.overlay.open{display:flex}
.modal{background:#fff;border-radius:14px;width:100%;max-width:680px;max-height:88vh;display:flex;flex-direction:column;box-shadow:var(--sh-lg)}
.m-head{padding:16px 20px;border-bottom:1px solid var(--rk-border);display:flex;align-items:center;justify-content:space-between}
.m-title{font-family:'Fraunces',serif;font-size:16px;font-weight:600;color:var(--navy)}
.m-x{width:26px;height:26px;border:1px solid var(--rk-border);border-radius:50%;background:#fff;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;color:var(--text2)}
.m-body{padding:16px 20px;overflow-y:auto;overscroll-behavior:contain;flex:1}
.m-to{font-size:11px;color:var(--text3);margin-bottom:3px}
.m-to strong{color:var(--text)}
.letter{background:var(--surface2);border:1px solid var(--rk-border);border-radius:var(--rk-radius);padding:14px 16px;font-size:11px;line-height:1.75;color:var(--text);white-space:pre-wrap;margin-top:10px;max-height:360px;overflow-y:auto;font-family:'Montserrat',sans-serif}
.m-foot{padding:12px 20px;border-top:1px solid var(--rk-border);display:flex;gap:8px;align-items:center}
.btn-p{background:var(--navy);color:#fff;border:none;padding:8px 16px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:opacity .15s}
.btn-p:hover{opacity:.85}
.btn-o{background:#fff;color:var(--navy);border:1px solid var(--rk-border);padding:8px 16px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif}
.btn-o:hover{border-color:var(--navy)}
.copied{font-size:11px;color:var(--low);opacity:0;transition:opacity .3s}
.copied.show{opacity:1}

/* Report modal */
.report-modal{max-width:500px}
.report-loc{background:var(--bg);border-radius:var(--rk-radius);padding:9px 11px;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.rl-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.rl-name{font-size:12px;font-weight:600;color:var(--navy)}
.rl-city{font-size:10px;color:var(--text3)}
.f-field{margin-bottom:10px}
.f-lbl{font-size:11px;font-weight:600;color:var(--text);margin-bottom:4px;display:flex;align-items:center;gap:4px}
.f-req{color:var(--high);font-size:10px}
.f-inp,.f-ta{width:100%;border:1px solid var(--rk-border);border-radius:7px;padding:7px 10px;font-family:'DM Sans',sans-serif;font-size:12px;color:var(--text);background:var(--surface2);outline:none;transition:border-color .15s}
.f-inp:focus,.f-ta:focus{border-color:var(--navy)}
.f-inp.err{border-color:var(--high)}
.f-ta{resize:vertical;min-height:70px;max-height:130px}
.f-file-wrap{border:1px dashed var(--rk-border2);border-radius:7px;padding:9px;text-align:center;cursor:pointer;background:var(--surface2)}
.f-file-wrap:hover{border-color:var(--navy)}
.f-file-lbl{font-size:11px;color:var(--text3);margin-bottom:2px}
.f-file-sub{font-size:10px;color:var(--text3)}
.f-file-inp{display:none}
.check-row{display:flex;align-items:flex-start;gap:8px;background:var(--low-bg);border:1px solid var(--low-bdr);border-radius:7px;padding:9px 11px}
.c-inp{width:13px;height:13px;margin-top:1px;accent-color:var(--navy);cursor:pointer;flex-shrink:0}
.c-lbl{font-size:11px;color:var(--low);font-weight:500;line-height:1.4;cursor:pointer}
.success-state{text-align:center;padding:28px 20px}
.s-icon{font-size:36px;margin-bottom:10px}
.s-title{font-family:'Fraunces',serif;font-size:17px;font-weight:600;color:var(--navy);margin-bottom:6px}
.s-sub{font-size:12px;color:var(--text2);line-height:1.5}

/* Leaflet popup */
.leaflet-popup-content-wrapper{border-radius:10px!important;box-shadow:var(--sh-md)!important;border:1px solid var(--rk-border)!important;padding:0!important}
.leaflet-popup-content{margin:0!important}
.leaflet-popup-tip-container{display:none}
.map-tip{padding:10px 12px;min-width:155px;cursor:pointer}
.mt-name{font-size:12px;font-weight:600;color:var(--navy);margin-bottom:2px}
.mt-city{font-size:10px;color:var(--text3)}
.mt-risk{font-size:10px;font-weight:600;margin-top:5px;padding:2px 7px;border-radius:100px;display:inline-block}
.mt-status{font-size:10px;margin-top:4px;font-weight:500}
.mt-cta{font-size:10px;color:var(--text3);margin-top:5px}
.leaflet-container{cursor:default}

/* Risk-level dot markers (override leaflet div-icon defaults) */
.leaflet-marker-icon.rk-marker{background:transparent!important;border:none!important;width:20px!important;height:20px!important;display:block!important}
.rk-marker .rk-marker-dot{display:block;width:20px;height:20px;border-radius:50%;border:2.5px solid rgba(255,255,255,.95);box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer;box-sizing:border-box}
.leaflet-marker-pane{z-index:600}

/* Site Map section */
.sitemap-wrap{padding:0;border-top:1px solid var(--rk-border)}
.sitemap-hdr{padding:11px 16px 8px;font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.7px}
.sitemap-img-wrap{position:relative;width:100%;background:var(--bg);overflow:hidden;padding:8px 12px 10px;border-top:1px solid var(--rk-border);border-bottom:1px solid var(--rk-border)}
.sitemap-img{width:100%;height:204px;object-fit:cover;object-position:center;display:block;cursor:pointer;transition:opacity .2s;border-radius:6px;border:2px solid var(--rk-border2);box-shadow:0 2px 8px rgba(0,0,0,.10),0 0 0 1px rgba(0,0,0,.04)}
.sitemap-img:hover{opacity:.92}
.sitemap-expand{position:absolute;bottom:18px;right:20px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;pointer-events:none;letter-spacing:.3px}

/* ============ STATUS LEGEND (was Tailwind utilities in the original) ============ */
.rk-app .sl-box{border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:12px}
.rk-app .sl-hdr{display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6B7280}
.rk-app .sl-list{list-style:none;margin:0;padding:0}
.rk-app .sl-list.compact{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.rk-app .sl-list.full > li + li{margin-top:6px}
.rk-app .sl-item{display:flex;align-items:flex-start;gap:8px;font-size:11.5px}
.rk-app .sl-swatch{margin-top:2px;display:inline-flex;height:16px;width:16px;flex-shrink:0;align-items:center;justify-content:center;border-radius:50%}
.rk-app .sl-label{line-height:1.35}
.rk-app .sl-name{font-weight:500}
.rk-app .sl-desc{display:block;color:#6B7280}
.rk-app .sl-mt{margin-top:12px}

`;

/* ── RUNTIME DEPENDENCIES (CDN, loaded in an effect — never at module scope) ── */

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,600;9..144,700" +
  "&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500" +
  "&family=Montserrat:wght@400;500;600;700&display=swap";

/** Appends <link>/<style> once per document, keyed by id. No-op on the server. */
function ensureHeadTag(
  id: string,
  build: () => HTMLElement,
): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const el = build();
  el.id = id;
  document.head.appendChild(el);
}

/** Injects the component's CSS + the Google Fonts and Leaflet stylesheets. */
function useInjectedStyles(): void {
  useEffect(() => {
    ensureHeadTag(STYLE_ID, () => {
      const style = document.createElement("style");
      style.textContent = CSS;
      return style;
    });
    ensureHeadTag("rk-standalone-fonts", () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONTS_HREF;
      return link;
    });
    ensureHeadTag("rk-standalone-leaflet-css", () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      return link;
    });
  }, []);
}

let leafletPromise: Promise<L> | null = null;

/** Clears the memoised loader so a failed CDN fetch can be retried. */
function resetLeafletLoader(): void {
  leafletPromise = null;
  if (typeof document !== "undefined") {
    document.getElementById("rk-standalone-leaflet-js")?.remove();
  }
}

/** Loads Leaflet from the CDN exactly once per page and resolves the global. */
function loadLeaflet(): Promise<L> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<L>((resolve, reject) => {
    const existing = document.getElementById(
      "rk-standalone-leaflet-js",
    ) as HTMLScriptElement | null;
    const onLoad = () => (w.L ? resolve(w.L) : reject(new Error("Leaflet did not register")));
    if (existing) {
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", () => reject(new Error("Leaflet failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.id = "rk-standalone-leaflet-js";
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = onLoad;
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(script);
  });
  // Never cache a rejection — otherwise Retry can never succeed.
  leafletPromise.catch(() => resetLeafletLoader());
  return leafletPromise;
}

/* ── ICONS (inline SVG — no icon library) ──────────────────────────────────── */

interface IconProps {
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

function Svg({ size = 14, strokeWidth = 2.25, color, style, children }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

const IcoChart = (p: IconProps) => (
  <Svg {...p}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="4" width="3" height="14" /></Svg>
);
const IcoWarn = (p: IconProps) => (
  <Svg {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></Svg>
);
const IcoPen = (p: IconProps) => (
  <Svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>
);
const IcoLogin = (p: IconProps) => (
  <Svg {...p}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></Svg>
);
const IcoX = (p: IconProps) => (
  <Svg {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>
);
const IcoCheck = (p: IconProps) => (
  <Svg {...p}><polyline points="20 6 9 17 4 12" /></Svg>
);
const IcoInfo = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></Svg>
);
const IcoMonitorCheck = (p: IconProps) => (
  <Svg {...p}><path d="m9 10 2 2 4-4" /><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M12 17v4" /><path d="M8 21h8" /></Svg>
);
const IcoExpand = (p: IconProps) => (
  <Svg {...p}><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></Svg>
);
const IcoReset = (p: IconProps) => (
  <Svg {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></Svg>
);
const IcoShield = (p: IconProps) => (
  <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></Svg>
);
const IcoFileSearch = (p: IconProps) => (
  <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><circle cx="11.5" cy="14.5" r="2.5" /><path d="M13.3 16.3 15 18" /></Svg>
);
const IcoClipboard = (p: IconProps) => (
  <Svg {...p}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></Svg>
);
const IcoSend = (p: IconProps) => (
  <Svg {...p}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Svg>
);
const IcoHammer = (p: IconProps) => (
  <Svg {...p}><path d="m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9" /><path d="M17.64 15 22 10.64" /><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l1.24 1.24" /></Svg>
);
const IcoCircleCheck = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></Svg>
);
const IcoAlertOctagon = (p: IconProps) => (
  <Svg {...p}><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86" /><path d="M12 8v4" /><path d="M12 16h.01" /></Svg>
);
const IcoSuccessBig = (p: IconProps) => (
  <Svg {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></Svg>
);

const STATUS_ICONS: Record<StatusKey, (p: IconProps) => ReactNode> = {
  in_audit: IcoFileSearch,
  audit_complete: IcoClipboard,
  submitted: IcoSend,
  in_principle_approval: IcoShield,
  implementation_ongoing: IcoHammer,
  implemented: IcoCircleCheck,
  stalled: IcoAlertOctagon,
};

/* ── HELPERS ───────────────────────────────────────────────────────────────── */

/** Shortens an authority name for button labels: "NHAI", the (ACRONYM), or 24 chars. */
export function getAuthShort(authStr: string | undefined): string {
  if (!authStr) return "Authority";
  if (authStr.includes("NHAI")) return "NHAI";
  const m = authStr.match(/\(([A-Z]{2,6})\)/);
  if (m) return m[1];
  const s = authStr.split(",")[0].split("(")[0].trim();
  return s.length > 24 ? s.substring(0, 24) + "…" : s;
}

/** Google Drive thumbnail URL for a location's site map, or null if none exists. */
export function getSiteMapUrl(id: number): string | null {
  const fid = SITE_MAPS[String(id)];
  return fid ? `https://drive.google.com/thumbnail?id=${fid}&sz=w800` : null;
}

/**
 * Builds the formal petition letter for a location.
 * Pure string assembly — nothing is transmitted. The [Your Name] / [Your Address]
 * placeholders are left for the sender to fill in by hand, as in the original.
 */
export function buildPetitionLetter(loc: Location): string {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const drscEmail = loc.pmail || "[drsc-email@nic.in]";
  const ccParts = loc.auths.filter((a) => !a.p).map((a) => a.n);

  return `Date: ${today}

To,
${loc.pto}

Subject: Road Safety Petition — ${loc.n}, ${loc.ci}

Respected Sir/Madam,

This is a formal petition regarding a critical road safety concern at ${loc.n}, ${loc.ci}, ${loc.st}, identified under Project Rakshak, a large-scale youth-led road safety infrastructure audit by Crashfree India with academic oversight from IIT Delhi and IIT Kharagpur.

KEY PROBLEMS IDENTIFIED:
${loc.findings.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}

RECOMMENDED INTERVENTIONS:
${loc.sols.map((s, i) => `  ${i + 1}. ${s.i}`).join("\n")}

ESTIMATED IMPACT: ${loc.impact}

We respectfully request your office to:
  1. Acknowledge this petition and assign a nodal officer
  2. Commission a site inspection within 30 days
  3. Include recommended interventions in the next budget cycle
  4. Provide a written response with a proposed implementation timeline

Under the Motor Vehicles (Amendment) Act 2019, Section 215B, the District Road Safety Committee is mandated to act on identified crash-prone locations.

Yours faithfully,
[Your Name]
[Your Address & Contact]

cc: District Road Safety Committee (DRSC), ${loc.ci} — ${drscEmail}
${ccParts.map((c) => `    ${c}`).join("\n")}
    Crashfree India | info@crashfreeindia.org`;
}

/* ── NAV ───────────────────────────────────────────────────────────────────────
   Three-column grid: logo | title+tagline | actions.
   Impact and Portal Sign In are plain <a> full-page navigations in the original
   (not router links), so they stay plain <a> here.                            */

const NAV_ICON: CSSProperties = { marginRight: 6, verticalAlign: -2 };

function Nav({
  onReport,
  onPetition,
  impactHref,
  portalHref,
}: {
  onReport: () => void;
  onPetition: () => void;
  impactHref: string;
  portalHref: string;
}) {
  return (
    <nav className="nav">
      <div className="nav-left">
        {/* Original loaded the WHITE logo with filter:none on a white bar, i.e.
            invisible. Snapshot uses the blue primary so it can actually be seen. */}
        <img
          className="nav-logo-img"
          style={{ filter: "none" }}
          src={CFI_LOGO_DATA_URI}
          alt="Crashfree India"
          title="Crashfree India — A Cars24 Commitment"
        />
      </div>

      <div className="nav-center">
        <div className="nav-title">Project Rakshak</div>
        <div className="nav-tagline">
          Documenting risks · Demanding accountability · Saving lives
        </div>
      </div>

      <div className="nav-right">
        <a
          className="nav-btn nav-btn-outline"
          href={impactHref}
          aria-label="View Project Rakshak impact dashboard"
          title="View impact metrics"
        >
          <IcoChart style={NAV_ICON} />
          Impact
        </a>
        <button
          type="button"
          className="nav-btn nav-btn-outline"
          onClick={onReport}
          aria-label="Report a road hazard"
          title="Report a road hazard"
        >
          <IcoWarn style={NAV_ICON} />
          Report a Road Hazard
        </button>
        <button
          type="button"
          className="nav-btn nav-btn-primary"
          onClick={onPetition}
          aria-label="Sign a petition"
          title="Sign a petition"
        >
          <IcoPen style={NAV_ICON} />
          Sign a Petition
        </button>
        <a
          className="nav-btn nav-btn-primary"
          href={portalHref}
          aria-label="Sign in to the Rakshak portal"
          title="Portal sign in"
          style={{ background: "#4A35FF", color: "#fff" }}
        >
          <IcoLogin style={NAV_ICON} />
          Portal Sign In
        </a>
      </div>
    </nav>
  );
}

/* ── STATS BAR ─────────────────────────────────────────────────────────────────
   ⚠️ The four KPIs are HARDCODED, exactly as in the original, and two of them are
   wrong. Real values: 31 locations, 16 distinct cities, 15 in_principle_approval
   (23 approved-or-beyond). "18 Cities" and "25 Approvals" are drift. Reproduced
   verbatim because this file is a snapshot; derive them in any rebuild.        */

const HARDCODED_KPIS: { val: string; lbl: string }[] = [
  { val: "31", lbl: "Audited Sites" },
  { val: "18", lbl: "Cities" },
  { val: "25", lbl: "Approvals" },
  { val: "30%", lbl: "Crash Reduction Est." },
];

function StatsBar({ active, onClose }: { active: Location | null; onClose: () => void }) {
  const primary = active?.auths.find((a) => a.p);

  return (
    <div className="stats-bar">
      {HARDCODED_KPIS.map((k, i) => (
        <div
          className="stat"
          key={k.lbl}
          style={i === HARDCODED_KPIS.length - 1 ? { borderRight: "none" } : undefined}
        >
          <span className="stat-val">{k.val}</span>
          <span className="stat-lbl">{k.lbl}</span>
        </div>
      ))}

      {/* Contextual block — width matched to the detail panel (var(--detail-w)). */}
      <div className={"stat-ctx" + (active ? " show" : "")}>
        <div className="ctx-block">
          <div className="ctx-loc">
            <span
              className="ctx-loc-dot"
              style={{ background: active ? RISK_COLORS[active.risk] : "transparent" }}
            />
            <span>{active ? `${active.ci} (${active.st})` : "—"}</span>
          </div>
          <div className="ctx-auth">
            {active ? `Primary: ${getAuthShort(primary?.n)}` : "Primary Authority"}
          </div>
        </div>
        <button
          type="button"
          className="ctx-x"
          onClick={onClose}
          title="Close selection"
          aria-label="Close selected location"
        >
          <IcoX size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── STATUS LEGEND ─────────────────────────────────────────────────────────── */

function StatusLegend({ compact = false }: { compact?: boolean }) {
  const keys = Object.keys(STATUS_META) as StatusKey[];

  return (
    <div className="sl-box" role="region" aria-label="Status legend">
      <div className="sl-hdr">
        <IcoInfo size={12} strokeWidth={2} /> Status legend
      </div>
      <ul className={"sl-list " + (compact ? "compact" : "full")}>
        {keys.map((k) => {
          const s = STATUS_META[k];
          const Icon = STATUS_ICONS[k] ?? IcoInfo;
          return (
            <li key={k} className="sl-item" title={STATUS_DESCRIPTIONS[k]}>
              <span
                className="sl-swatch"
                style={{ background: s.bg, color: s.c, border: `1px solid ${s.c}40` }}
              >
                <Icon size={10} strokeWidth={2.25} />
              </span>
              <span className="sl-label">
                <span className="sl-name" style={{ color: s.c }}>{s.l}</span>
                {!compact && <span className="sl-desc">{STATUS_DESCRIPTIONS[k]}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── SIDEBAR ───────────────────────────────────────────────────────────────────
   Search · selected-location card · 3 filter groups · legend · location list.

   ⚠️ Faithfully preserved a11y bug: the authority and state chips are <span
   onClick> — not focusable, no role, no aria-pressed. Only the status chips are
   real buttons. Fix in any rebuild; kept here to match the original.          */

function Sidebar({
  filters,
  setFilters,
  visible,
  active,
  onSelect,
  onClearSelection,
  onStateFilter,
}: {
  filters: FiltersState;
  setFilters: (next: FiltersState) => void;
  visible: Location[];
  active: Location | null;
  onSelect: (id: number) => void;
  onClearSelection: () => void;
  onStateFilter: (state: string) => void;
}) {
  const states = useMemo(
    () => Array.from(new Set(LOCATIONS.map((l) => l.st))).sort(),
    [],
  );

  function setF<K extends keyof FiltersState>(k: K, v: FiltersState[K]) {
    setFilters({ ...filters, [k]: v });
    // Changing the state filter also flies the map to that state.
    if (k === "state") onStateFilter(v as string);
  }

  const primary = active?.auths.find((a) => a.p);
  const status = active ? STATUS_META[active.status] : null;

  const STATUS_FILTERS = [
    { v: "all", l: "All", d: "Show every status" },
    { v: "implementation_ongoing", l: "In Progress", d: STATUS_DESCRIPTIONS.implementation_ongoing },
    { v: "in_principle_approval", l: "Approved", d: STATUS_DESCRIPTIONS.in_principle_approval },
    { v: "submitted", l: "Submitted", d: STATUS_DESCRIPTIONS.submitted },
    { v: "audit_complete", l: "Audited", d: STATUS_DESCRIPTIONS.audit_complete },
    { v: "stalled", l: "Stalled", d: STATUS_DESCRIPTIONS.stalled },
    // Note: in_audit and implemented exist in the taxonomy but are NOT filterable.
  ];

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <div className="sb-title">Search Locations</div>
        <input
          className="search"
          type="text"
          placeholder="Search city or location…"
          value={filters.search}
          onChange={(e) => setF("search", e.target.value)}
        />
      </div>

      <div className={"sb-selected" + (active ? " show" : "")}>
        <div className="sb-sel-label">Selected Location</div>
        <div className="sb-sel-name">{active?.n ?? "—"}</div>
        <div style={{ marginBottom: 4 }}>
          <span className="sb-sel-auth-label">Primary Authority</span>
          <div className="sb-sel-auth">
            {status && (
              <IcoMonitorCheck size={12} strokeWidth={2} color={status.c} style={{ flexShrink: 0 }} />
            )}
            <span style={{ color: "var(--navy)" }}>
              {primary ? primary.n.split("(")[0].trim() : "—"}
            </span>
          </div>
        </div>
        <div>
          <span className="sb-sel-auth-label">Status</span>
          <span
            className="sb-sel-status"
            title={active ? STATUS_DESCRIPTIONS[active.status] : undefined}
            aria-label={
              active && status ? `Status: ${status.l}. ${STATUS_DESCRIPTIONS[active.status]}` : undefined
            }
            style={
              status
                ? { background: status.bg, color: status.c, border: `1px solid ${status.c}30` }
                : undefined
            }
          >
            {status ? status.l : "—"}
          </span>
        </div>
        <button
          type="button"
          className="sb-sel-clear"
          onClick={onClearSelection}
          aria-label="Clear selected location"
        >
          Clear selection <IcoX size={11} style={{ verticalAlign: -1 }} />
        </button>
      </div>

      <div className="sb-filters">
        {/* Responsible Authority — chips carry live counts. */}
        <div className="sb-section">
          <div className="f-label">Responsible Authority</div>
          <span
            className={"chip" + (filters.auth === "all" ? " on" : "")}
            onClick={() => setF("auth", "all")}
          >
            All <span className="chip-count">{LOCATIONS.length}</span>
          </span>
          {AUTH_CATEGORIES.map((c) => {
            const cnt = LOCATIONS.filter((l) => l.auth === c.k).length;
            return (
              <span
                key={c.k}
                className={"chip" + (filters.auth === c.k ? " on" : "")}
                onClick={() => setF("auth", c.k)}
                title={c.d}
              >
                {c.l} <span className="chip-count">{cnt}</span>
              </span>
            );
          })}
        </div>

        {/* Status — the only chips that are real buttons. */}
        <div className="sb-section">
          <div className="f-label">Status</div>
          {STATUS_FILTERS.map((s) => (
            <button
              type="button"
              key={s.v}
              className={"chip" + (filters.status === s.v ? " on" : "")}
              onClick={() => setF("status", s.v)}
              title={s.d}
              aria-label={`Filter by status: ${s.l}`}
              aria-pressed={filters.status === s.v}
            >
              {s.l}
            </button>
          ))}
          <div className="sl-mt">
            <StatusLegend compact />
          </div>
        </div>

        {/* State — selecting one also zooms the map. */}
        <div className="sb-section states-section">
          <div className="f-label">State</div>
          <div className="state-chips-wrap">
            <span
              className={"chip" + (filters.state === "all" ? " on" : "")}
              onClick={() => setF("state", "all")}
            >
              All
            </span>
            {states.map((s) => (
              <span
                key={s}
                className={"chip" + (filters.state === s ? " on" : "")}
                onClick={() => setF("state", s)}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="loc-scroll">
        {visible.length === 0 ? (
          <div className="empty-sb">No locations match your filters</div>
        ) : (
          visible.map((loc) => (
            <div
              key={loc.id}
              className={"loc-row" + (active?.id === loc.id ? " active" : "")}
              onClick={() => onSelect(loc.id)}
            >
              <span className="loc-dot" style={{ background: RISK_COLORS[loc.risk] }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="loc-name">{loc.n}</div>
                <div className="loc-city">{loc.ci}</div>
              </div>
              <span
                className="loc-spill"
                style={{ background: STATUS_META[loc.status].c }}
                title={`${STATUS_META[loc.status].l} — ${STATUS_DESCRIPTIONS[loc.status]}`}
                aria-label={`Status: ${STATUS_META[loc.status].l}`}
                role="img"
              />
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

/* ── MAP VIEW ──────────────────────────────────────────────────────────────────
   Leaflet, loaded from the CDN inside the effect (never at module scope, so this
   stays SSR-safe). There is NO tile layer: the basemap is the India state
   GeoJSON polygon fill, fetched at runtime from a 3-URL fallback chain.

   31 divIcon markers coloured by risk. Hover opens a popup; click selects the
   location and flies to its state.

   ⚠️ Faithfully preserved bug: the original exported an `invalidateMapSize`
   helper and never called it, so Leaflet never re-measures when the 370px detail
   panel opens or closes. Kept as-is. In a rebuild, call map.invalidateSize()
   whenever the panel toggles.                                                 */

interface MapApi {
  zoomToState: (s: string) => void;
  resetIndia: () => void;
}

const INDIA_FALLBACK_BOUNDS: [[number, number], [number, number]] = [[6.5, 68], [37, 97.5]];

function MapView({
  visibleIds,
  onSelect,
  registerApi,
}: {
  visibleIds: Set<number>;
  onSelect: (id: number) => void;
  registerApi: (api: MapApi) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<number, { m: any; vis: boolean }>>({});
  const indiaGeoRef = useRef<any>(null);
  const stateLayerMapRef = useRef<Record<string, any[]>>({});
  const loadGeoRef = useRef<((signal?: AbortSignal) => Promise<void>) | null>(null);

  // Kept in a ref so the init effect never has to re-run when the parent
  // re-renders with a new callback identity.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  /**
   * booting    → waiting on the Leaflet CDN script
   * loading    → Leaflet is up, fetching the India state outline
   * loaded     → outline rendered
   * lib-failed → Leaflet itself never loaded; there is no map at all
   * geo-failed → Leaflet is up but every GeoJSON source failed; markers work
   */
  type MapStatus = "booting" | "loading" | "loaded" | "lib-failed" | "geo-failed";
  const [status, setStatus] = useState<MapStatus>("booting");
  const [error, setError] = useState<string | null>(null);
  /** Bumped by Retry to re-run the whole init effect after a library failure. */
  const [libAttempt, setLibAttempt] = useState(0);

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let disposed = false;
    const geoCtl = new AbortController();

    (async () => {
      let L: L;
      try {
        L = await loadLeaflet();
      } catch (e) {
        console.warn("[rakshak-snapshot] Leaflet failed to load:", e);
        if (!disposed) {
          setError((e as Error).message);
          setStatus("lib-failed");
        }
        return;
      }
      if (disposed || !mapEl.current || mapRef.current) return;

      const map = L.map(mapEl.current, {
        zoomControl: true,
        minZoom: 4,
        maxZoom: 14,
        attributionControl: false,
      }).setView([22.5, 80.5], 5);
      map.setMaxBounds([[2, 60], [40, 102]]);
      mapRef.current = map;

      /* ---- markers ---- */
      LOCATIONS.forEach((loc) => {
        const icon = L.divIcon({
          className: "rk-marker",
          html: `<span class="rk-marker-dot" style="background:${RISK_COLORS[loc.risk]}"></span>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          popupAnchor: [0, -13],
        });

        const m = L.marker([loc.lat, loc.lng], { icon, riseOnHover: true }).addTo(map);
        const s = STATUS_META[loc.status];
        const riskBg =
          loc.risk === "high"
            ? "var(--high-bg)"
            : loc.risk === "medium"
              ? "var(--med-bg)"
              : "var(--low-bg)";

        m.bindPopup(
          `<div class="map-tip" data-loc-id="${loc.id}">
            <div class="mt-name">${loc.n}</div>
            <div class="mt-city">${loc.ci}, ${loc.st}</div>
            <div class="mt-risk" style="background:${riskBg};color:${RISK_COLORS[loc.risk]}">${RISK_LABELS[loc.risk]}</div>
            <div class="mt-status" style="color:${s.c}">${s.i ? s.i + " " : ""}${s.l}</div>
            <div class="mt-cta">Click to view full audit →</div>
          </div>`,
          { closeButton: false, maxWidth: 200 },
        );

        m.on("click", () => {
          map.closePopup();
          onSelectRef.current(loc.id);
          zoomToState(loc.st);
        });
        m.on("popupopen", (e: any) => {
          const node = (e.popup.getElement() as HTMLElement | null)?.querySelector(".map-tip");
          if (node) {
            (node as HTMLElement).style.cursor = "pointer";
            node.addEventListener("click", () => {
              onSelectRef.current(loc.id);
              map.closePopup();
            });
          }
        });
        m.on("mouseover", () => m.openPopup());
        m.on("mouseout", () => m.closePopup());

        markersRef.current[loc.id] = { m, vis: true };
      });

      /* ---- India GeoJSON, with multi-URL fallback + retry ---- */
      function renderIndia(data: any) {
        if (!mapRef.current) return;
        const sample = data.features[0].properties;
        const prop = sample.ST_NM ? "ST_NM" : sample.NAME_1 ? "NAME_1" : "name";

        const geo = L.geoJSON(data, {
          style: {
            fillColor: "#EDE8DE",
            fillOpacity: 1,
            color: "#BEB8AE",
            weight: 1.2,
            opacity: 1,
          },
          onEachFeature: (f: any, layer: any) => {
            const raw = f.properties[prop] || "";
            const name = GEO_NAME_MAP[raw] || raw;
            if (!stateLayerMapRef.current[name]) stateLayerMapRef.current[name] = [];
            stateLayerMapRef.current[name].push(layer);
            layer.on("mouseover", () => layer.setStyle({ fillColor: "#DDD7C8", fillOpacity: 1 }));
            layer.on("mouseout", () => layer.setStyle({ fillColor: "#EDE8DE", fillOpacity: 1 }));
          },
        });

        indiaGeoRef.current = geo;
        geo.addTo(mapRef.current);
        // Re-add markers so they sit above the polygons.
        Object.values(markersRef.current).forEach((mk) => mk.m.addTo(mapRef.current));
        mapRef.current.flyToBounds(geo.getBounds().pad(0.02), { duration: 0.8, easeLinearity: 0.5 });
      }

      const loadGeo = async (signal?: AbortSignal) => {
        setStatus("loading");
        setError(null);
        const errs: string[] = [];

        for (const url of GEO_URLS) {
          try {
            const r = await fetch(url, { signal });
            if (!r.ok) {
              errs.push(`${url} → HTTP ${r.status}`);
              continue;
            }
            const data = await r.json();
            if (!data?.features?.length) {
              errs.push(`${url} → empty features`);
              continue;
            }
            if (signal?.aborted) return;
            renderIndia(data);
            setStatus("loaded");
            return;
          } catch (e) {
            if ((e as any)?.name === "AbortError") return;
            errs.push(`${url} → ${(e as Error).message}`);
          }
        }

        const detail = errs.join(" | ");
        // Detail goes to the console, not onto the page (the original gated this
        // behind import.meta.env.DEV, which does not exist in a standalone file).
        console.warn("[rakshak-snapshot] India GeoJSON failed:", detail);
        setError(detail);
        setStatus("geo-failed");
      };

      loadGeoRef.current = loadGeo;
      void loadGeo(geoCtl.signal);

      /* ---- imperative camera API ---- */
      function resetIndia() {
        const opts = { duration: 0.9, easeLinearity: 0.5 };
        if (indiaGeoRef.current) {
          mapRef.current.flyToBounds(indiaGeoRef.current.getBounds().pad(0.02), opts);
        } else {
          mapRef.current.flyToBounds(INDIA_FALLBACK_BOUNDS, opts);
        }
      }

      function zoomToState(name: string) {
        const opts = { duration: 0.85, easeLinearity: 0.5 };
        if (!name || name === "all") return resetIndia();

        const layers = stateLayerMapRef.current[name];
        if (layers?.length) {
          mapRef.current.flyToBounds(L.featureGroup(layers).getBounds().pad(0.12), opts);
        } else if (STATE_BOUNDS[name]) {
          mapRef.current.flyToBounds(L.latLngBounds(STATE_BOUNDS[name]).pad(0.1), opts);
        } else {
          const pts = LOCATIONS.filter((l) => l.st === name).map(
            (l) => [l.lat, l.lng] as [number, number],
          );
          if (pts.length) mapRef.current.flyToBounds(L.latLngBounds(pts).pad(0.35), opts);
        }
      }

      registerApi({ zoomToState, resetIndia });
    })();

    return () => {
      disposed = true;
      geoCtl.abort();
      loadGeoRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = {};
      indiaGeoRef.current = null;
      stateLayerMapRef.current = {};
    };
  }, [registerApi, libAttempt]);

  /* ---- toggle marker visibility as filters change ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    LOCATIONS.forEach((loc) => {
      const mk = markersRef.current[loc.id];
      if (!mk) return;
      const shouldShow = visibleIds.has(loc.id);
      if (shouldShow && !mk.vis) {
        mk.m.addTo(map);
        mk.vis = true;
      } else if (!shouldShow && mk.vis) {
        map.removeLayer(mk.m);
        mk.vis = false;
      }
    });
  }, [visibleIds]);

  function resetView() {
    const map = mapRef.current;
    if (!map) return;
    const opts = { duration: 0.9, easeLinearity: 0.5 };
    if (indiaGeoRef.current) map.flyToBounds(indiaGeoRef.current.getBounds().pad(0.02), opts);
    else map.flyToBounds(INDIA_FALLBACK_BOUNDS, opts);
  }

  return (
    <div className="map-wrap">
      <div id="map" ref={mapEl} />

      {(status === "booting" || status === "loading") && (
        <div className="map-loading">Loading India map…</div>
      )}

      {(status === "lib-failed" || status === "geo-failed") && (
        <div
          className="map-loading"
          role="alert"
          style={{ textAlign: "center", maxWidth: 320, lineHeight: 1.4 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {status === "lib-failed"
              ? "Couldn't load the map library"
              : "Couldn't load the India map outline"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
            {status === "lib-failed"
              ? "Leaflet could not be fetched, so there is no map. Everything else on the page still works."
              : "Markers are still usable. Check your connection and retry."}
          </div>
          <button
            type="button"
            onClick={() => {
              if (status === "lib-failed") {
                resetLeafletLoader();
                setStatus("booting");
                setLibAttempt((n) => n + 1);
              } else {
                void loadGeoRef.current?.();
              }
            }}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid currentColor",
              background: "transparent",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      <button className="map-reset" onClick={resetView} title="Reset to India view">
        <IcoReset size={12} strokeWidth={2.5} />
        India View
      </button>

      <div className="legend">
        <div className="l-title">Risk Level</div>
        {(["high", "medium", "low"] as Risk[]).map((r) => (
          <div className="l-row" key={r}>
            <span className="l-dot" style={{ background: RISK_COLORS[r] }} />
            {RISK_LABELS[r]}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── DETAIL PANEL ──────────────────────────────────────────────────────────────
   Slides from 0 → 370px. Ten sections in a fixed order:
   hero · site map · progress · crash cause · findings · solutions+costs ·
   impact · authorities · why-not-implemented · CTA row.                       */

function ProgressBar({ status }: { status: StatusKey }) {
  if (status === "stalled") {
    return (
      <div className="prog-stall">
        Stalled — No response from responsible authorities. Escalation needed.
      </div>
    );
  }

  const cur = STATUS_META[status]?.s || 1;

  return (
    <div className="prog-steps">
      {PROGRESS_STEPS.map((step) => {
        const meta = STATUS_META[step.k];
        const done = meta?.s <= cur;
        const isCurrent = step.k === status;
        return (
          <div
            key={step.k}
            className={"prog-step" + (done ? " done" : "") + (isCurrent ? " current" : "")}
          >
            <div className="prog-circ">
              {done && <IcoCheck size={9} strokeWidth={3} color="#fff" />}
            </div>
            <div className="prog-lbl">{step.l}</div>
          </div>
        );
      })}
    </div>
  );
}

function DetailPanel({
  loc,
  onClose,
  onPetition,
  onReport,
}: {
  loc: Location | null;
  onClose: () => void;
  onPetition: (id: number) => void;
  onReport: (id: number) => void;
}) {
  return (
    <div className={"detail" + (loc ? " open" : "")}>
      <div className="d-scroll">
        {loc && (
          <DetailContent loc={loc} onClose={onClose} onPetition={onPetition} onReport={onReport} />
        )}
      </div>
    </div>
  );
}

function DetailContent({
  loc,
  onClose,
  onPetition,
  onReport,
}: {
  loc: Location;
  onClose: () => void;
  onPetition: (id: number) => void;
  onReport: (id: number) => void;
}) {
  const primary = loc.auths.find((a) => a.p);
  const authShort = primary ? getAuthShort(primary.n) : "Authority";
  const s = STATUS_META[loc.status];
  const siteMapUrl = getSiteMapUrl(loc.id);

  return (
    <>
      <div className="d-hero">
        <button
          type="button"
          className="d-close-btn"
          onClick={onClose}
          title="Close location details"
          aria-label="Close location details"
        >
          <IcoX size={16} />
        </button>

        <div className={"risk-badge " + loc.risk}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: RISK_COLORS[loc.risk],
              display: "inline-block",
            }}
          />
          {RISK_LABELS[loc.risk]}
        </div>

        <div className="d-city-state">
          <span className="risk-dot" style={{ background: RISK_COLORS[loc.risk] }} />
          {loc.ci} ({loc.st})
        </div>
        <div className="d-name">{loc.n}</div>
        <div className="d-type">{loc.type}</div>
      </div>

      {/* Site map — Google Drive thumbnail. ⚠️ The "Full view" chip and the
          cursor:pointer are decorative: the original had no lightbox. */}
      {siteMapUrl && (
        <div className="sitemap-wrap">
          <div className="sitemap-hdr">Site Map</div>
          <div className="sitemap-img-wrap">
            <img
              className="sitemap-img"
              src={siteMapUrl}
              alt={`Site map of ${loc.n}`}
              loading="lazy"
            />
            <span className="sitemap-expand">
              <IcoExpand size={11} style={{ verticalAlign: -1, marginRight: 3 }} /> Full view
            </span>
          </div>
        </div>
      )}

      <div className="prog-wrap">
        <div className="prog-hdr">
          <span className="prog-ttl">Implementation Progress</span>
          <span
            className="prog-curr"
            style={{ color: s.c }}
            title={STATUS_DESCRIPTIONS[loc.status]}
            aria-label={`Current status: ${s.l}. ${STATUS_DESCRIPTIONS[loc.status]}`}
          >
            {s.l}
          </span>
        </div>
        <ProgressBar status={loc.status} />
        <div className="prog-team">Audit Team: {loc.team}</div>
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Why This Location is Crash-Prone</div>
        <div className="crash-box">{loc.crash}</div>
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Audit Findings</div>
        {loc.findings.map((f, i) => (
          <div key={i} className="finding">
            <span className="fdot" />
            {f}
          </div>
        ))}
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Recommended Solutions &amp; Costs</div>
        {loc.sols.map((sol, i) => (
          <div key={i} className="sol">
            <div className="sol-t">{sol.i}</div>
            <div className="sol-c">{sol.c}</div>
          </div>
        ))}
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Estimated Impact</div>
        <div className="impact-box">{loc.impact}</div>
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Responsible Authorities</div>
        {loc.auths.map((a, i) => (
          <div key={i} className={"auth" + (a.p ? " primary" : "")}>
            <div className="auth-n">
              {a.n}
              {a.p && <span className="prim-tag">PRIMARY</span>}
            </div>
            <div className="auth-r">{a.r}</div>
          </div>
        ))}
      </div>

      <div className="d-sec">
        <div className="d-sec-h">Why Not Yet Implemented</div>
        <div className="stall-box">{loc.why}</div>
      </div>

      <div className="cta-row">
        <button className="petition-btn" onClick={() => onPetition(loc.id)}>
          <IcoShield size={12} strokeWidth={2.5} />
          Write to {authShort}
        </button>
        <button className="report-btn" onClick={() => onReport(loc.id)}>
          <IcoWarn size={12} strokeWidth={2.5} />
          Report an Issue
        </button>
      </div>
    </>
  );
}

/* ── FOOTER ────────────────────────────────────────────────────────────────────
   Copyright + the 20 academic partners. Logos are binary PNGs and therefore not
   inlined: pass `uniLogoBase` to resolve them, otherwise every partner renders
   as an initials badge (which is the original's own fallback).                */

function Footer({ uniLogoBase }: { uniLogoBase?: string }) {
  return (
    <div className="footer">
      <div className="footer-top">
        <div className="footer-copy">
          © 2025 Crashfree India · Vision Zero Trust · info@crashfreeindia.org
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            justifyContent: "flex-end",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <span className="footer-partners-label">Academic Partners</span>
          <div className="footer-logos">
            {UNIVERSITIES.map((u) => {
              const url = uniLogoBase && u.file ? `${uniLogoBase}/${u.file}` : undefined;
              return (
                <div key={u.name} className="uni-item" title={u.name}>
                  {url ? (
                    <img className="uni-logo" src={url} alt={u.name} />
                  ) : (
                    <div className="uni-badge">
                      {u.name.split(" ").map((w) => w[0]).join("").slice(0, 4)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── PETITION MODAL ────────────────────────────────────────────────────────────
   ⚠️ SENDS NOTHING. Three client-side actions and that is the whole capability:

     "Copy Letter"      → navigator.clipboard.writeText (no .catch in the
                          original either — silently dead on insecure origins)
     "Send via Email ↗" → window.open("mailto:" + loc.pmail + "?subject&body"),
                          i.e. hands off to the OS mail client. We never learn
                          whether anything was actually sent. A ~2KB URL-encoded
                          body is also truncated by some clients, and users on
                          webmail usually have no mailto handler at all.
     "Download .txt"    → Blob + synthetic <a download>

   No signature is counted, no record is stored, nothing reaches a server. There
   is no petition table in the database and no API route behind this.          */

function PetitionModal({ loc, onClose }: { loc: Location; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const letter = useMemo(() => buildPetitionLetter(loc), [loc]);

  const primary = loc.auths.find((a) => a.p);
  const authShort = primary ? getAuthShort(primary.n) : "Authority";

  function copy() {
    navigator.clipboard.writeText(letter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  function download() {
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Petition_${loc.n.replace(/[^a-zA-Z0-9]/g, "_")}_${loc.ci}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function email() {
    const sub = encodeURIComponent(`Road Safety Petition — ${loc.n}, ${loc.ci}`);
    const body = encodeURIComponent(letter);
    window.open(`mailto:${loc.pmail}?subject=${sub}&body=${body}`, "_blank");
  }

  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="m-head">
          <div className="m-title">Write to {authShort}</div>
          <button type="button" className="m-x" onClick={onClose} aria-label="Close dialog" title="Close">
            <IcoX size={16} />
          </button>
        </div>

        <div className="m-body">
          <div className="m-to">
            Addressed to: <strong>{loc.pto}</strong>
          </div>
          <div className="m-to" style={{ marginTop: 3 }}>
            Re:{" "}
            <strong>
              Road Safety Petition — {loc.n}, {loc.ci}
            </strong>
          </div>
          <div className="letter">{letter}</div>
        </div>

        <div className="m-foot">
          <button className="btn-p" onClick={copy}>Copy Letter</button>
          <button className="btn-o" onClick={email}>Send via Email ↗</button>
          <button className="btn-o" onClick={download}>Download .txt</button>
          <span className={"copied" + (copied ? " show" : "")}>
            <IcoCheck size={12} strokeWidth={3} style={{ display: "inline", verticalAlign: -1, marginRight: 3 }} />
            Copied
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── REPORT MODAL ──────────────────────────────────────────────────────────────
   ⚠️ SENDS NOTHING, and it is worse than the petition:

     - The photo is NEVER uploaded. Only file.name is put into state; the File
       object is never read or transmitted. The advertised "JPG or PNG · max 5MB"
       is not enforced in any way.
     - Email validation is `trimmed.includes("@")`. That is the entire check.
     - Submit calls window.open("mailto:info@crashfreeindia.org?…") and then
       unconditionally shows a success screen claiming the report was "shared
       with the Crashfree India team" and that progress will be emailed. Neither
       is true — the mail client may never have opened, the user may have closed
       the draft, and the address was never stored anywhere.
     - The petition checkbox becomes one line of text in an email body. No
       petition record is created.

   All reproduced verbatim. This is the single most misleading thing on the old
   page and the first thing to fix if these flows are ever rebuilt.            */

function ReportModal({ loc, onClose }: { loc: Location; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState(false);
  const [desc, setDesc] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [petition, setPetition] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  function close() {
    setEmail("");
    setEmailErr(false);
    setDesc("");
    setPhotoName(null);
    setPetition(true);
    setSubmitted(false);
    onClose();
  }

  function submit() {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setEmailErr(true);
      return;
    }

    const today = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const sub = encodeURIComponent(`[Project Rakshak] Community Report — ${loc.n}, ${loc.ci}`);
    const body = encodeURIComponent(
      `Community Issue Report — Project Rakshak Platform\n\n` +
        `Date: ${today}\nReporter: ${trimmed}\n` +
        `Location: ${loc.n}, ${loc.ci}, ${loc.st}\nRisk Level: ${RISK_LABELS[loc.risk]}\n\n` +
        `Experience / Incident:\n${desc.trim() || "(No description provided)"}\n\n` +
        `Sign Petition: ${petition ? "YES" : "No"}\n\n` +
        `---\nCrashfree India | info@crashfreeindia.org`,
    );

    // The photo is deliberately absent from this payload — mailto cannot carry
    // an attachment, and the original never uploaded it anywhere either.
    window.open(`mailto:info@crashfreeindia.org?subject=${sub}&body=${body}`, "_blank");
    setSubmitted(true);
  }

  return (
    <div className="overlay open" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal report-modal">
        <div className="m-head">
          <div className="m-title">Report a Road Hazard</div>
          <button type="button" className="m-x" onClick={close} aria-label="Close dialog" title="Close">
            <IcoX size={16} />
          </button>
        </div>

        <div className="m-body">
          {submitted ? (
            <div className="success-state">
              <div className="s-icon">
                <IcoSuccessBig size={32} strokeWidth={1.5} />
              </div>
              <div className="s-title">Thank you for reporting!</div>
              <div className="s-sub">
                Your experience has been shared with the Crashfree India team.
                {petition && (
                  <>
                    <br />
                    <br />
                    You've signed the community petition for <strong>{loc.n}</strong>. We'll notify
                    progress at <strong>{email.trim()}</strong>.
                  </>
                )}
                <br />
                <br />
                Together we can make India's roads safer.
              </div>
            </div>
          ) : (
            <>
              <div className="report-loc">
                <span className="rl-dot" style={{ background: RISK_COLORS[loc.risk] }} />
                <div>
                  <div className="rl-name">{loc.n}</div>
                  <div className="rl-city">
                    {loc.ci}, {loc.st} · {RISK_LABELS[loc.risk]}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 11, color: "var(--text2)", marginBottom: 11, lineHeight: 1.5 }}>
                Have you witnessed or been affected by a road safety issue here? Report it and
                optionally sign the community petition demanding action.
              </p>

              <div className="f-field">
                <label className="f-lbl">
                  Your Email <span className="f-req">*</span>
                </label>
                <input
                  className={"f-inp" + (emailErr ? " err" : "")}
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailErr) setEmailErr(false);
                  }}
                />
              </div>

              <div className="f-field">
                <label className="f-lbl">
                  What did you experience?{" "}
                  <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400 }}>
                    (optional)
                  </span>
                </label>
                <textarea
                  className="f-ta"
                  placeholder="Describe the incident or road safety issue you witnessed at this location…"
                  maxLength={400}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
                <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 3, textAlign: "right" }}>
                  {desc.length}/400
                </div>
              </div>

              <div className="f-field">
                <label className="f-lbl">
                  Add a photo{" "}
                  <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 400 }}>
                    (optional)
                  </span>
                </label>
                <label className="f-file-wrap" htmlFor="rPhoto">
                  <div className="f-file-lbl">Tap to upload photo</div>
                  <div className="f-file-sub">
                    {photoName ? (
                      <>
                        <IcoCheck
                          size={10}
                          strokeWidth={3}
                          style={{ display: "inline", verticalAlign: -1, marginRight: 4 }}
                        />
                        {photoName}
                      </>
                    ) : (
                      "JPG or PNG · max 5MB"
                    )}
                  </div>
                </label>
                <input
                  className="f-file-inp"
                  type="file"
                  id="rPhoto"
                  accept="image/*"
                  // Only the NAME is captured. The file itself is discarded.
                  onChange={(e) => e.target.files?.[0] && setPhotoName(e.target.files[0].name)}
                />
              </div>

              <div className="check-row">
                <input
                  className="c-inp"
                  type="checkbox"
                  id="rPetition"
                  checked={petition}
                  onChange={(e) => setPetition(e.target.checked)}
                />
                <label className="c-lbl" htmlFor="rPetition">
                  I also want to sign the community petition for this location — demanding action
                  from responsible authorities
                </label>
              </div>
            </>
          )}
        </div>

        <div className="m-foot">
          {submitted ? (
            <button className="btn-p" onClick={close}>Close</button>
          ) : (
            <>
              <button className="btn-p" onClick={submit}>Submit Report</button>
              <button className="btn-o" onClick={close}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── ROOT ──────────────────────────────────────────────────────────────────────
   Owns all page state. Four pieces, no context, no store, no URL state:
   filters, activeId, petitionId, reportId.                                    */

export interface RakshakHomeStandaloneProps {
  /**
   * Base URL for the 20 academic-partner logos, e.g. "/assets/universities".
   * Each entry resolves to `${uniLogoBase}/${file}`. Omit for initials badges.
   */
  uniLogoBase?: string;
  /** Target of the nav "Impact" link. */
  impactHref?: string;
  /** Target of the nav "Portal Sign In" link. */
  portalHref?: string;
}

export default function RakshakHomeStandalone({
  uniLogoBase,
  impactHref = "/rakshak-platform/impact",
  portalHref = "/rakshak-platform/auth",
}: RakshakHomeStandaloneProps = {}) {
  useInjectedStyles();

  const [filters, setFilters] = useState<FiltersState>({
    auth: "all",
    status: "all",
    state: "all",
    search: "",
  });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [petitionId, setPetitionId] = useState<number | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);

  // Imperative bridge to the map camera — the one non-declarative seam.
  const mapApi = useRef<MapApi | null>(null);
  const registerApi = useCallback((api: MapApi) => {
    mapApi.current = api;
  }, []);

  const visible = useMemo(() => {
    const q = filters.search.toLowerCase();
    return LOCATIONS.filter((loc) => {
      if (filters.auth !== "all" && loc.auth !== filters.auth) return false;
      if (filters.status !== "all" && loc.status !== filters.status) return false;
      if (filters.state !== "all" && loc.st !== filters.state) return false;
      if (q && !`${loc.n} ${loc.ci} ${loc.st}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filters]);

  const visibleIds = useMemo(() => new Set(visible.map((l) => l.id)), [visible]);

  const active = activeId == null ? null : LOCATIONS.find((l) => l.id === activeId) ?? null;
  const petitionLoc = petitionId == null ? null : LOCATIONS.find((l) => l.id === petitionId) ?? null;
  const reportLoc = reportId == null ? null : LOCATIONS.find((l) => l.id === reportId) ?? null;

  const selectLoc = useCallback((id: number) => setActiveId(id), []);
  const closeDetail = useCallback(() => setActiveId(null), []);

  /**
   * Nav CTAs with nothing selected. ⚠️ Preserved quirk: falls back to location
   * id 1 and waits out the 250ms panel animation with a setTimeout.
   */
  function openPetitionGlobal() {
    const id = activeId ?? 1;
    if (activeId == null) setActiveId(1);
    setTimeout(() => setPetitionId(id), activeId == null ? 250 : 0);
  }
  function openReportGlobal() {
    const id = activeId ?? 1;
    if (activeId == null) setActiveId(1);
    setTimeout(() => setReportId(id), activeId == null ? 250 : 0);
  }

  return (
    <div className="rk-app">
      <Nav
        onReport={openReportGlobal}
        onPetition={openPetitionGlobal}
        impactHref={impactHref}
        portalHref={portalHref}
      />

      <StatsBar active={active} onClose={closeDetail} />

      <div className="main">
        <Sidebar
          filters={filters}
          setFilters={setFilters}
          visible={visible}
          active={active}
          onSelect={selectLoc}
          onClearSelection={closeDetail}
          onStateFilter={(s) => mapApi.current?.zoomToState(s)}
        />
        <MapView visibleIds={visibleIds} onSelect={selectLoc} registerApi={registerApi} />
        <DetailPanel
          loc={active}
          onClose={closeDetail}
          onPetition={setPetitionId}
          onReport={setReportId}
        />
      </div>

      <Footer uniLogoBase={uniLogoBase} />

      {petitionLoc && <PetitionModal loc={petitionLoc} onClose={() => setPetitionId(null)} />}
      {reportLoc && <ReportModal loc={reportLoc} onClose={() => setReportId(null)} />}
    </div>
  );
}
