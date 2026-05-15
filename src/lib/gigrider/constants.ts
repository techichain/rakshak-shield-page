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
  "Branded T-shirt",
  "Reflective vest",
  "ID card visible",
  "Other",
] as const;

export const HELMET_STATUS = [
  { v: "wearing_full_face", l: "Full-face helmet" },
  { v: "wearing_half_open_face", l: "Half / open-face helmet" },
  { v: "wearing_no_visor", l: "Helmet without visor" },
  { v: "not_wearing_not_carrying", l: "Not wearing, not carrying" },
  { v: "cannot_observe", l: "Cannot observe" },
] as const;

export const ENGAGEMENT = [
  { v: "genuinely_engaged", l: "Genuinely engaged — volunteered information, asked questions" },
  { v: "cooperative", l: "Cooperative — answering willingly, reasonably attentive" },
  { v: "passive", l: "Passive — going along with it, not particularly invested" },
  { v: "visibly_rushed", l: "Visibly rushed — checking phone, eager to finish" },
  { v: "zoned_out_distracted", l: "Distracted or zoned out — slow to respond, seemed elsewhere" },
  { v: "uncomfortable_guarded", l: "Uncomfortable or guarded — hesitant, short closed answers" },
  { v: "resistant", l: "Resistant — agreed to interview but unwilling throughout" },
] as const;

export const RESPONSE_CONSISTENCY = [
  { v: "yes_nothing_off", l: "Yes, nothing seemed off" },
  { v: "minor_doubts", l: "Minor doubts" },
  { v: "strong_doubts", l: "Strong doubts" },
] as const;

