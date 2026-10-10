/** The 50 states plus Washington, D.C. — the app's supported geography. */
export const US_STATES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
  "Washington, D.C.": "DC", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY",
  Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
  Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE",
  Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX",
  Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

const CODES = new Set(Object.values(US_STATES));
const BY_LOWER_NAME = new Map(Object.entries(US_STATES).map(([name, code]) => [name.toLowerCase(), code]));

export function stateCodeFor(nameOrCode: string | null | undefined): string | null {
  if (!nameOrCode) return null;
  const s = nameOrCode.trim().replace(/\.$/, "");
  const upper = s.toUpperCase().replace(/\./g, "");
  if (upper.length === 2 && CODES.has(upper)) return upper;
  return BY_LOWER_NAME.get(s.toLowerCase()) ?? null;
}
