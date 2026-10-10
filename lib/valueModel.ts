/**
 * Our own home-value model, trained on official U.S. Census microdata (ACS PUMS) for the selected area.
 * Pure functions: weighted least squares on log(value), weighted comparables, and a prediction interval.
 */

export const PUMS_YEAR = 2024; // ACS 2020–2024 5-year PUMS; values adjusted to 2024 dollars with ADJHSG

export type PumsRecord = {
  value: number; // VALP, owner's estimate, survey-year dollars
  bedrooms: number; // BDSP
  rooms: number; // RMSP
  yearBuiltCode: number; // YRBLT
  building: string; // BLD: "02" detached, "03" attached
  lot: number; // ACR: 1 <1 acre, 2 1–10 acres, 3 10+ acres
  tenure: number; // TEN: 1 owned w/ mortgage, 2 owned free and clear
  weight: number; // WGTP
  adjustment: number; // ADJHSG (6 implied decimals)
};

export type HomeKind = "detached" | "attached";

export type HomeRow = { value2024: number; bedrooms: number; builtYear: number; attached: 0 | 1; largeLot: 0 | 1; weight: number };

/** YRBLT codes are decade starts (1939 = "1939 or earlier") or single years (2020+). */
export function builtYearFromCode(code: number): number | null {
  if (!Number.isFinite(code) || code <= 1938) return null;
  if (code === 1939) return 1930;
  if (code >= 2020) return code;
  return code + 5; // decade midpoint
}

export function prepareRecords(records: PumsRecord[]): HomeRow[] {
  const rows: HomeRow[] = [];
  for (const r of records) {
    if (r.tenure !== 1 && r.tenure !== 2) continue;
    if (r.building !== "02" && r.building !== "03") continue;
    if (!(r.value > 0) || !(r.weight > 0)) continue;
    const builtYear = builtYearFromCode(r.yearBuiltCode);
    if (builtYear === null || r.bedrooms < 0) continue;
    rows.push({
      value2024: r.value * (r.adjustment / 1e6),
      bedrooms: Math.min(6, Math.max(1, r.bedrooms)),
      builtYear,
      attached: r.building === "03" ? 1 : 0,
      largeLot: r.lot >= 2 ? 1 : 0,
      weight: r.weight,
    });
  }
  return rows;
}

const FEATURES = ["intercept", "bedrooms", "age (decades)", "age² (decades²)", "attached", "lot ≥ 1 acre"] as const;

function featureVector(bedrooms: number, builtYear: number, attached: number, largeLot: number): number[] {
  const ageDecades = Math.max(0, PUMS_YEAR - builtYear) / 10;
  return [1, bedrooms, ageDecades, ageDecades * ageDecades, attached, largeLot];
}

/** Solves A x = b for a small symmetric positive-definite system (Gaussian elimination with partial pivoting). */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    if (Math.abs(M[pivot][c]) < 1e-10) return null;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export type FittedModel = {
  coefficients: { name: string; value: number }[];
  n: number;
  r2: number;
  residualSd: number;
  /** Drops constant columns (e.g. no attached homes in the area) so the system stays solvable. */
  activeFeatures: boolean[];
};

export const MIN_TRAINING_ROWS = 40;

/** Weighted least squares of ln(value) on the features, using the Census housing-unit weights. */
export function fitValueModel(rows: HomeRow[]): FittedModel | null {
  if (rows.length < MIN_TRAINING_ROWS) return null;
  const X = rows.map((r) => featureVector(r.bedrooms, r.builtYear, r.attached, r.largeLot));
  const y = rows.map((r) => Math.log(r.value2024));
  const w = rows.map((r) => r.weight);
  const p = FEATURES.length;
  const active = Array.from({ length: p }, (_, j) => j === 0 || new Set(X.map((x) => x[j])).size > 1);
  const idx = active.map((a, j) => (a ? j : -1)).filter((j) => j >= 0);

  const XtWX = idx.map(() => idx.map(() => 0));
  const XtWy = idx.map(() => 0);
  for (let i = 0; i < rows.length; i++) {
    for (let a = 0; a < idx.length; a++) {
      XtWy[a] += w[i] * X[i][idx[a]] * y[i];
      for (let b = 0; b < idx.length; b++) XtWX[a][b] += w[i] * X[i][idx[a]] * X[i][idx[b]];
    }
  }
  const beta = solve(XtWX, XtWy);
  if (!beta) return null;

  const sumW = w.reduce((s, v) => s + v, 0);
  const meanY = y.reduce((s, v, i) => s + w[i] * v, 0) / sumW;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < rows.length; i++) {
    const pred = idx.reduce((s, j, a) => s + beta[a] * X[i][j], 0);
    ssRes += w[i] * (y[i] - pred) ** 2;
    ssTot += w[i] * (y[i] - meanY) ** 2;
  }
  // Weighted residual SD, rescaled from population weights back to the sample's degrees of freedom.
  const residualSd = Math.sqrt((ssRes / sumW) * (rows.length / Math.max(1, rows.length - idx.length)));
  const full = FEATURES.map((name, j) => ({ name, value: active[j] ? beta[idx.indexOf(j)] : 0 }));
  return { coefficients: full, n: rows.length, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0, residualSd, activeFeatures: active };
}

export type Prediction = { mid: number; low: number; high: number };
const Z80 = 1.2816;

/** Typical (median) value for a home with these traits, with an 80% range from the model's residual spread. */
export function predictValue(model: FittedModel, home: { bedrooms: number; builtYear: number; kind: HomeKind; largeLot?: boolean }): Prediction {
  const x = featureVector(Math.min(6, Math.max(1, home.bedrooms)), home.builtYear, home.kind === "attached" ? 1 : 0, home.largeLot ? 1 : 0);
  const logMid = model.coefficients.reduce((s, c, j) => s + c.value * x[j], 0);
  return { mid: Math.exp(logMid), low: Math.exp(logMid - Z80 * model.residualSd), high: Math.exp(logMid + Z80 * model.residualSd) };
}

/** Survey-weighted quantile. */
export function weightedQuantile(values: number[], weights: number[], q: number): number {
  const order = values.map((v, i) => [v, weights[i]] as const).sort((a, b) => a[0] - b[0]);
  const total = order.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [v, w] of order) {
    acc += w;
    if (acc >= q * total) return v;
  }
  return order.at(-1)?.[0] ?? NaN;
}

export type Comparables = { count: number; median: number; p25: number; p75: number; definition: string };
export const MIN_COMPARABLES = 15;

/** "Homes like this" in the official sample: same kind, same bedroom count, built within a decade — widened step by step if too few. */
export function comparables(rows: HomeRow[], home: { bedrooms: number; builtYear: number; kind: HomeKind }): Comparables | null {
  const kind = home.kind === "attached" ? 1 : 0;
  const beds = Math.min(6, Math.max(1, home.bedrooms));
  const tiers = [
    { beds: 0, years: 10, label: `${beds}-bedroom ${home.kind} homes built within 10 years of ${home.builtYear}` },
    { beds: 1, years: 15, label: `${beds - 1}–${beds + 1}-bedroom ${home.kind} homes built within 15 years of ${home.builtYear}` },
    { beds: 1, years: 1000, label: `${beds - 1}–${beds + 1}-bedroom ${home.kind} homes of any age` },
  ];
  for (const t of tiers) {
    const match = rows.filter((r) => r.attached === kind && Math.abs(r.bedrooms - beds) <= t.beds && Math.abs(r.builtYear - home.builtYear) <= t.years);
    if (match.length >= MIN_COMPARABLES) {
      const v = match.map((r) => r.value2024);
      const w = match.map((r) => r.weight);
      return { count: match.length, median: weightedQuantile(v, w, 0.5), p25: weightedQuantile(v, w, 0.25), p75: weightedQuantile(v, w, 0.75), definition: t.label };
    }
  }
  return null;
}

/** Area defaults when the user skips a question: the weighted median bedrooms and build year of owner-occupied homes. */
export function areaDefaults(rows: HomeRow[]): { bedrooms: number; builtYear: number } {
  const w = rows.map((r) => r.weight);
  return {
    bedrooms: Math.round(weightedQuantile(rows.map((r) => r.bedrooms), w, 0.5)),
    builtYear: weightedQuantile(rows.map((r) => r.builtYear), w, 0.5),
  };
}
