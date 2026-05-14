export const ROAD_ENV = [
  { v: "intersection_signal", l: "Intersection w/ signal" },
  { v: "mid_road_no_signal", l: "Mid-road, no signal" },
  { v: "commercial_market", l: "Commercial / market" },
  { v: "residential_lane", l: "Residential lane" },
  { v: "highway_arterial", l: "Highway / arterial" },
  { v: "other", l: "Other" },
] as const;

export const ROAD_HAZARDS = [
  "Potholes",
  "Construction / debris",
  "Animals on road",
  "Waterlogging",
  "Poor lighting",
  "Heavy congestion",
  "No footpath",
  "Encroachment",
] as const;

export const VEHICLE_TYPE = [
  { v: "petrol_ice", l: "Petrol / ICE" },
  { v: "ev_low_speed", l: "EV — low speed" },
  { v: "ev_high_speed_green_plate", l: "EV — green plate" },
  { v: "cng", l: "CNG" },
  { v: "not_visible", l: "Not visible" },
] as const;

export const CONSENT = [
  { v: "yes", l: "Yes" },
  { v: "no", l: "No" },
  { v: "unclear", l: "Unclear" },
] as const;

export const CONSENT_OPTIONAL = [
  "Asked permission for photo",
  "Explained survey purpose",
  "Mentioned data use",
  "Offered to skip questions",
  "Provided contact info",
] as const;

export const RUSHED = [
  { v: "yes", l: "Yes" },
  { v: "no", l: "No" },
  { v: "somewhat", l: "Somewhat" },
] as const;

export const LED = [
  { v: "yes", l: "Yes" },
  { v: "no", l: "No" },
  { v: "unsure", l: "Unsure" },
] as const;

export const RATING = [
  { v: "satisfactory", l: "Satisfactory" },
  { v: "needs_improvement", l: "Needs improvement" },
  { v: "unacceptable", l: "Unacceptable" },
] as const;

export const PLATFORM_GEAR = [
  "Branded jacket",
  "Branded helmet",
  "Branded delivery bag",
  "ID card visible",
  "Reflective vest",
  "Other",
] as const;

export const HELMET_STATUS = [
  { v: "wearing_full_face", l: "Wearing — full face" },
  { v: "wearing_half_open_face", l: "Wearing — half / open face" },
  { v: "wearing_no_visor", l: "Wearing — no visor" },
  { v: "carrying", l: "Carrying (not on head)" },
  { v: "not_wearing_not_carrying", l: "Not wearing, not carrying" },
  { v: "cannot_observe", l: "Cannot observe" },
] as const;

export const ENGAGEMENT = [
  { v: "actively_engaged", l: "Actively engaged" },
  { v: "adequately_engaged", l: "Adequately engaged" },
  { v: "rushing_for_incentive", l: "Rushing for incentive" },
  { v: "zoned_out_distracted", l: "Zoned out / distracted" },
  { v: "uncomfortable_resistant", l: "Uncomfortable / resistant" },
  { v: "going_through_motions", l: "Going through motions" },
] as const;
