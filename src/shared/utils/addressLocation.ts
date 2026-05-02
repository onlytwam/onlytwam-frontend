export interface PincodeData {
  city: string;
  state: string;
  country: string;
}

export interface GeoData {
  road: string;
  suburb: string;
  city: string;
  state: string;
  country: string;
  postcode: string;
}

export async function lookupPincode(pin: string): Promise<PincodeData | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();
    if (!Array.isArray(data) || data[0]?.Status !== 'Success') return null;
    const po = data[0]?.PostOffice?.[0];
    if (!po) return null;
    return {
      city: po.Block || po.Taluk || po.District || '',
      state: po.State || '',
      country: po.Country || 'India',
    };
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeoData | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    const a = data?.address ?? {};
    return {
      road: a.road || a.pedestrian || a.footway || '',
      suburb: a.suburb || a.neighbourhood || a.village || a.town || '',
      city: a.city || a.town || a.village || a.county || '',
      state: a.state || '',
      country: a.country || 'India',
      postcode: a.postcode || '',
    };
  } catch {
    return null;
  }
}

type StateLike = {
  stateId?: number | string | null;
  id?: number | string | null;
  stateName?: string | null;
  name?: string | null;
  state?: string | null;
};

type StateMatch = {
  stateId: number;
  stateName: string;
  score: number;
};

type StoredAddressState = {
  state?: string;
  stateId?: number | null;
  updatedAt: string;
};

const ADDRESS_STATE_CACHE_KEY = "twam.address-state-cache";

const STATE_ALIASES: Record<string, string> = {
  ap: 'andhrapradesh',
  ar: 'arunachalpradesh',
  as: 'assam',
  br: 'bihar',
  cg: 'chhattisgarh',
  ga: 'goa',
  gj: 'gujarat',
  gujrath: 'gujarat',
  hr: 'haryana',
  hp: 'himachalpradesh',
  himachalpardesh: 'himachalpradesh',
  jh: 'jharkhand',
  ka: 'karnataka',
  kl: 'kerala',
  la: 'ladakh',
  mh: 'maharashtra',
  maharastra: 'maharashtra',
  ml: 'meghalaya',
  mn: 'manipur',
  mp: 'madhyapradesh',
  mz: 'mizoram',
  nl: 'nagaland',
  od: 'odisha',
  orissa: 'odisha',
  pb: 'punjab',
  py: 'puducherry',
  pondicherry: 'puducherry',
  rj: 'rajasthan',
  sk: 'sikkim',
  tn: 'tamilnadu',
  tg: 'telangana',
  ts: 'telangana',
  telengana: 'telangana',
  tr: 'tripura',
  up: 'uttarpradesh',
  uk: 'uttarakhand',
  uttaranchal: 'uttarakhand',
  wb: 'westbengal',
  dl: 'delhi',
  delhinct: 'delhi',
  nctdelhi: 'delhi',
  nctofdelhi: 'delhi',
  an: 'andamanandnicobarislands',
  jk: 'jammukashmir',
  jkandl: 'jammukashmir',
  dd: 'damananddiu',
  dn: 'dadranagarhaveli',
};

function normalizeStateText(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function canonicalStateText(value: string): string {
  const normalized = normalizeStateText(value);
  return STATE_ALIASES[normalized] ?? normalized;
}

function getStateLabel(state: StateLike): string {
  return String(state?.stateName ?? state?.name ?? state?.state ?? '').trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

export function resolveStateMatch(states: StateLike[], stateName?: string): StateMatch | null {
  if (!stateName) return null;

  const rawTarget = String(stateName).trim();
  const target = canonicalStateText(rawTarget);
  if (!target) return null;

  let best: StateMatch | null = null;

  for (const state of states || []) {
    const label = getStateLabel(state);
    if (!label) continue;

    const candidate = canonicalStateText(label);
    if (!candidate) continue;

    const stateIdValue = state?.stateId ?? state?.id ?? null;
    const numericId = Number(stateIdValue);
    if (!Number.isFinite(numericId)) continue;

    if (candidate === target) {
      return { stateId: numericId, stateName: label, score: 1 };
    }

    let score = 0;
    if (candidate.includes(target) || target.includes(candidate)) {
      const denom = Math.max(candidate.length, target.length, 1);
      score = 0.9 + (Math.min(candidate.length, target.length) / denom) * 0.08;
    } else {
      const distance = levenshtein(target, candidate);
      const denom = Math.max(candidate.length, target.length, 1);
      score = 1 - distance / denom;
    }

    if (!best || score > best.score) {
      best = { stateId: numericId, stateName: label, score };
    }
  }

  return best && best.score >= 0.6 ? best : null;
}

export function resolveStateId(states: StateLike[], stateName?: string) {
  return resolveStateMatch(states, stateName)?.stateId ?? null;
}

function readAddressStateCache(): Record<string, StoredAddressState> {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(ADDRESS_STATE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredAddressState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAddressStateCache(cache: Record<string, StoredAddressState>) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(ADDRESS_STATE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

export function rememberAddressState(
  addressId: string | number | null | undefined,
  state: { state?: string; stateId?: number | null; pinCode?: string | null },
) {
  const nextState = String(state.state ?? "").trim();
  const nextStateId =
    state.stateId == null || Number.isNaN(Number(state.stateId))
      ? null
      : Number(state.stateId);

  const cache = readAddressStateCache();
  const writeEntry = (key: string) => {
    if (!nextState && nextStateId == null) {
      delete cache[key];
      return;
    }

    cache[key] = {
      state: nextState || undefined,
      stateId: nextStateId,
      updatedAt: new Date().toISOString(),
    };
  };

  if (addressId != null) {
    writeEntry(String(addressId));
  }

  const pinKey = String(state.pinCode ?? "").replace(/\D/g, "");
  if (pinKey) {
    writeEntry(`pin:${pinKey}`);
  }

  writeAddressStateCache(cache);
}

export function getRememberedAddressState(
  addressId: string | number | null | undefined,
  pinCode?: string | null,
): StoredAddressState | null {
  const cache = readAddressStateCache();
  if (addressId != null) {
    const byId = cache[String(addressId)];
    if (byId) return byId;
  }

  const pinKey = String(pinCode ?? "").replace(/\D/g, "");
  if (pinKey) {
    return cache[`pin:${pinKey}`] ?? null;
  }

  return null;
}
