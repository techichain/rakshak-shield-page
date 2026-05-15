export const ROAD_ENV = [
  { v: "restaurant_food_outlet", l: "Outside a restaurant / café / food outlet" },
  { v: "dark_store", l: "Outside a dark store / quick commerce warehouse (Blinkit, Zepto, etc.)" },
  { v: "mall_entrance", l: "Near a mall / shopping complex entrance" },
  { v: "informal_rest_spot", l: "Informal rest spot (chai stall, roadside shade, under flyover, etc.)" },
  { v: "petrol_pump", l: "Near a petrol pump / service lane" },
  { v: "residential_society", l: "Outside a residential society / apartment gate" },
  { v: "highway_service_lane", l: "Near a highway or arterial road service lane" },
  { v: "other", l: "Other" },
] as const;

export const ROAD_HAZARDS = [
  "Potholes or broken road surface",
  "No footpath — pedestrians or workers on road",
  "Heavy encroachment on road (vendors, parked vehicles blocking lane)",
  "Poor or absent street lighting (only mark if evening or night)",
  "Absence of road markings or lane lines",
  "Unmarked speed breakers or sudden road changes",
  "Loose gravel, mud, or waterlogging",
  "None visible",
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

// Optional asks the surveyor must request once (rider can decline)
export const CONSENT_OPTIONAL = [
  "Asked to take photo of helmet",
  "Asked to take photo of vehicle plate number",
  "Asked permission to record one or two answers",
] as const;

// Platforms a rider may have gear for
export const PLATFORMS = [
  "Swiggy", "Zomato", "Zepto", "Blinkit", "Instamart",
  "Dunzo", "BigBasket", "Uber Eats", "Rapido", "Other",
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
