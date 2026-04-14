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

export function resolveStateId(states: any[], stateName?: string) {
  if (!stateName) return null;
  const target = stateName.trim().toLowerCase();
  const match = states.find((state) => {
    const candidate = String(state?.stateName ?? state?.name ?? state?.state ?? '').trim().toLowerCase();
    return candidate === target || candidate.includes(target) || target.includes(candidate);
  });
  const value = match?.stateId ?? match?.id ?? null;
  return value == null ? null : Number(value);
}
