/**
 * MapPicker.tsx — v5 (clean)
 * Install:  npm install leaflet@1.9.4 react-leaflet@5.0.0
 * CSS:      add  @import "leaflet/dist/leaflet.css";  in mobile.css
 */

import { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import { MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import icon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl: icon2xUrl, shadowUrl });

// ── Public result type ────────────────────────────────────────
export interface MapPickerResult {
  latitude: number;
  longitude: number;
  building: string; // building / shop / apartment name  → houseNo field
  street: string; // house number + road               → addressLine field
  area: string; // ward / colony / suburb            → locality field
  city: string;
  state: string;
  country: string;
  pinCode: string;
  // compat aliases
  addressLine: string; // building + street
  locality: string; // same as area
  fullAddress: string; // complete display string
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (r: MapPickerResult) => void;
  initialLat?: number;
  initialLng?: number;
}

// ── GPS ───────────────────────────────────────────────────────
async function getGPS(): Promise<{ lat: number; lng: number }> {
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const p = await Geolocation.requestPermissions();
    if (p.location !== "granted") throw new Error("denied");
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error("unsupported"));
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => rej(new Error("denied")),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }
}

// ── Reverse geocode ───────────────────────────────────────────
async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<MapPickerResult> {
  const empty: MapPickerResult = {
    latitude: lat,
    longitude: lng,
    building: "",
    street: "",
    area: "",
    city: "",
    state: "",
    country: "India",
    pinCode: "",
    addressLine: "",
    locality: "",
    fullAddress: "",
  };

  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

  // ── Google Geocoding (most accurate) ─────────────────────────
  if (googleKey) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}&language=en&region=IN`,
      );
      const d = await res.json();
      if (d.status !== "OK" || !d.results?.length)
        throw new Error("no results");

      // Pick most specific result
      const order = [
        "rooftop",
        "range_interpolated",
        "premise",
        "street_address",
        "establishment",
      ];
      const best = [...d.results].sort((a: any, b: any) => {
        const ai = order.indexOf(a.geometry?.location_type ?? "");
        const bi = order.indexOf(b.geometry?.location_type ?? "");
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      })[0];

      const comps = best.address_components ?? [];
      const get = (...types: string[]) =>
        comps.find((c: any) => types.some((t: string) => c.types.includes(t)))
          ?.long_name ?? "";

      // Extract each component in order
      const building = get(
        "premise",
        "subpremise",
        "establishment",
        "point_of_interest",
        "natural_feature",
        "park",
      );
      const streetNum = get("street_number");
      const route = get("route");
      const subL2 = get("sublocality_level_2");
      const subL1 = get("sublocality_level_1", "sublocality");
      const city = get("locality") || get("administrative_area_level_2");
      const state = get("administrative_area_level_1");
      const country = get("country") || "India";
      const pinCode = get("postal_code");

      // Building: prefer component, else first formatted_address segment if not a number/road
      const fmtFirst = (best.formatted_address ?? "").split(",")[0].trim();
      const finalBldg =
        building ||
        (fmtFirst && !/^[0-9]/.test(fmtFirst) && fmtFirst !== route
          ? fmtFirst
          : "");

      // Street: streetNum + route, but exclude building name if it leaked into route
      const cleanRoute =
        route &&
        finalBldg &&
        route.toLowerCase().includes(finalBldg.toLowerCase())
          ? ""
          : route;
      const street = [streetNum, cleanRoute].filter(Boolean).join(" ");
      const area = [subL2, subL1].filter(Boolean).join(", ");
      const fullAddress = [
        finalBldg,
        street,
        area,
        city,
        state,
        country,
        pinCode,
      ]
        .filter(Boolean)
        .join(", ");

      return {
        latitude: lat,
        longitude: lng,
        building: finalBldg,
        street,
        area,
        city,
        state,
        country,
        pinCode,
        addressLine: [finalBldg, street].filter(Boolean).join(", "),
        locality: area,
        fullAddress,
      };
    } catch {
      /* fall through to Nominatim */
    }
  }

  // ── Nominatim fallback (free, no key) ────────────────────────
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&namedetails=1&zoom=18`,
      { headers: { "Accept-Language": "en" } },
    );
    const d = await res.json();
    const a = d?.address ?? {};

    // Building: top-level name → namedetails → typed address fields
    // d.class tells us what kind of feature the pin landed on:
    //   "highway"  → pin is on a road  → d.name is the road name
    //   anything else → pin is on a place/building → d.name is the building name
    // "residential" in Nominatim India = apartment complex / colony name (NOT a road)
    // "road" = actual named street/road
    // Never mix them — a.residential goes to building, a.road goes to street

    const building =
      a.residential || // ← complex/colony name (India)
      a.building ||
      a.amenity ||
      a.shop ||
      a.office ||
      a.tourism ||
      a.leisure ||
      a.man_made ||
      a.historic ||
      (!d.name || d.class === "highway" ? "" : d.name) || // d.name only if NOT a highway
      "";

    const houseNo = a.house_number || "";
    const road = a.road || a.pedestrian || a.footway || a.path || ""; // never a.residential here
    const street = [houseNo, road].filter(Boolean).join(" ");

    // Area: ward + suburb
    const area =
      [a.quarter, a.suburb, a.neighbourhood, a.hamlet]
        .filter(Boolean)
        .join(", ") ||
      a.city_district ||
      "";

    const city = a.city || a.town || a.village || a.county || a.district || "";
    const state = a.state || "";
    const country = a.country || "India";
    const pinCode = a.postcode || "";

    // fullAddress from display_name — already ordered by Nominatim
    const dnParts = (d.display_name ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (dnParts.at(-1)?.toLowerCase() === "india") dnParts.pop();
    const fullAddress = dnParts.join(", ");

    return {
      latitude: lat,
      longitude: lng,
      building,
      street,
      area,
      city,
      state,
      country,
      pinCode,
      addressLine: [building, street].filter(Boolean).join(", "),
      locality: area,
      fullAddress,
    };
  } catch {
    return empty;
  }
}

// ── Map internals ─────────────────────────────────────────────
function MapTracker({
  onDragStart,
  onSettle,
}: {
  onDragStart: () => void;
  onSettle: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    dragstart: () => onDragStart(),
    moveend: () => {
      const c = map.getCenter();
      onSettle(c.lat, c.lng);
    },
    zoomend: () => {
      const c = map.getCenter();
      onSettle(c.lat, c.lng);
    },
  });
  return null;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const prev = useRef("");
  useEffect(() => {
    if (!target) return;
    const k = `${target[0]},${target[1]}`;
    if (k === prev.current) return;
    prev.current = k;
    map.flyTo(target, 17, { duration: 1.1 });
  }, [target]);
  return null;
}

function ZoomCtrl() {
  const map = useMap();
  return (
    <div
      style={{
        position: "absolute",
        bottom: 72,
        right: 14,
        zIndex: 1000,
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      {(["+", "−"] as const).map((lbl) => (
        <button
          key={lbl}
          onClick={() => (lbl === "+" ? map.zoomIn() : map.zoomOut())}
          style={{
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            border: "none",
            borderBottom: lbl === "+" ? "1px solid #eee" : "none",
            fontSize: 20,
            cursor: "pointer",
            color: "#333",
          }}
        >
          {lbl}
        </button>
      ))}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────
const Spin = ({ s = 16 }: { s?: number }) => (
  <div
    style={{
      width: s,
      height: s,
      flexShrink: 0,
      border: "2px solid #6b0f2a",
      borderTopColor: "transparent",
      borderRadius: "50%",
      animation: "mp-spin .7s linear infinite",
    }}
  />
);

// ─────────────────────────────────────────────────────────────
const INDIA: [number, number] = [20.5937, 78.9629];

export default function MapPicker({
  open,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
}: Props) {
  const [center, setCenter] = useState<[number, number]>(
    initialLat && initialLng ? [initialLat, initialLng] : INDIA,
  );
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [lifted, setLifted] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [address, setAddress] = useState<MapPickerResult | null>(null);
  const [hintVisible, setHintVisible] = useState(true);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setHintVisible(true);
    hintTimer.current = setTimeout(() => setHintVisible(false), 3000);
    if (initialLat && initialLng) {
      const p: [number, number] = [initialLat, initialLng];
      setCenter(p);
      setFlyTarget(p);
    } else {
      locate();
    }
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, [open]);

  useEffect(() => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    setGeocoding(true);
    geoTimer.current = setTimeout(async () => {
      const r = await reverseGeocode(center[0], center[1]);
      setAddress(r);
      setGeocoding(false);
    }, 650);
    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
  }, [center]);

  const onDragStart = useCallback(() => {
    setLifted(true);
    setHintVisible(false);
  }, []);
  const onSettle = useCallback((lat: number, lng: number) => {
    setLifted(false);
    setCenter([lat, lng]);
  }, []);

  const locate = async () => {
    setGpsLoading(true);
    try {
      const { lat, lng } = await getGPS();
      const p: [number, number] = [lat, lng];
      setCenter(p);
      setFlyTarget(p);
    } catch {
      /* user pans manually */
    } finally {
      setGpsLoading(false);
    }
  };

  const confirm = () => {
    if (!address) return;
    onConfirm(address);
    onClose();
  };

  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        fontFamily: '"Trebuchet MS",Arial,sans-serif',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 16px",
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            padding: "4px 6px 4px 0",
            cursor: "pointer",
            display: "flex",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke="#111"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div>
          <p
            style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#111" }}
          >
            Set Delivery Location
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#999" }}>
            Drag map to move pin to your exact door
          </p>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <MapContainer
          center={center}
          zoom={17}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            maxZoom={19}
            subdomains="abcd"
          />
          <MapTracker onDragStart={onDragStart} onSettle={onSettle} />
          <FlyTo target={flyTarget} />
          <ZoomCtrl />
        </MapContainer>

        {/* Fixed center pin */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: lifted
              ? "translate(-50%, calc(-100% - 10px))"
              : "translate(-50%, -100%)",
            transition: "transform 0.16s cubic-bezier(0.34,1.56,0.64,1)",
            zIndex: 1000,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <svg
            width="30"
            height="38"
            viewBox="0 0 46 58"
            fill="none"
            style={{
              filter: lifted
                ? "drop-shadow(0 10px 14px rgba(0,0,0,0.32))"
                : "drop-shadow(0 3px 6px rgba(0,0,0,0.24))",
              transition: "filter 0.16s ease",
            }}
          >
            <path
              d="M23 0C10.297 0 0 10.297 0 23c0 15.225 21 33.5 21.58 34.12a2 2 0 002.84 0C25 56.5 46 38.225 46 23 46 10.297 35.703 0 23 0z"
              fill="#6b0f2a"
            />
            <circle cx="23" cy="23" r="11" fill="white" />
            <circle cx="23" cy="23" r="5.5" fill="#6b0f2a" />
          </svg>
          <div
            style={{
              width: 2,
              height: lifted ? 10 : 0,
              background: "rgba(107,15,42,0.45)",
              borderRadius: 2,
              transition: "height 0.16s ease",
              marginTop: -1,
            }}
          />
        </div>

        {/* Ground shadow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-4px)",
            zIndex: 999,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: lifted ? 18 : 10,
              height: lifted ? 6 : 4,
              background: "rgba(0,0,0,0.2)",
              borderRadius: "50%",
              transition: "all 0.16s ease",
            }}
          />
        </div>

        {/* Drag hint */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            pointerEvents: "none",
            background: "rgba(0,0,0,0.62)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            padding: "6px 14px",
            borderRadius: 20,
            whiteSpace: "nowrap",
            opacity: hintVisible ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        >
          ✦ Drag map to adjust pin
        </div>

        {/* GPS button */}
        <button
          onClick={locate}
          disabled={gpsLoading}
          style={{
            position: "absolute",
            bottom: 18,
            right: 14,
            zIndex: 1000,
            background: "#fff",
            border: "none",
            borderRadius: "50%",
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
          }}
        >
          {gpsLoading ? (
            <Spin s={20} />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3.5" fill="#6b0f2a" />
              <path
                d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"
                stroke="#6b0f2a"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="12"
                cy="12"
                r="7.5"
                stroke="#6b0f2a"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Bottom address card */}
      <div
        style={{
          background: "#fff",
          borderTop: "1px solid #f0f0f0",
          padding: "14px 16px 26px",
          flexShrink: 0,
          boxShadow: "0 -6px 24px rgba(0,0,0,0.07)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 14,
            minHeight: 48,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "#fff0f3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#6b0f2a">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {geocoding ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingTop: 9,
                }}
              >
                <Spin s={14} />
                <span style={{ color: "#999", fontSize: 13 }}>
                  Finding address…
                </span>
              </div>
            ) : address?.fullAddress ? (
              <>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#111",
                  }}
                >
                  {address.fullAddress.split(",")[0].trim()}
                </p>
                <p
                  style={{
                    margin: "3px 0 0",
                    fontSize: 12.5,
                    color: "#555",
                    lineHeight: 1.5,
                  }}
                >
                  {address.fullAddress.split(",").slice(1).join(",").trim()}
                </p>
              </>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#bbb",
                  paddingTop: 9,
                }}
              >
                Move the map to set location
              </p>
            )}
          </div>
        </div>

        <button
          onClick={confirm}
          disabled={geocoding || !address}
          style={{
            width: "100%",
            padding: "14px 0",
            background: geocoding ? "#c9949e" : "#6b0f2a",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 700,
            cursor: geocoding ? "not-allowed" : "pointer",
            letterSpacing: 0.3,
          }}
        >
          {geocoding ? "Locating…" : "Confirm Location"}
        </button>
      </div>

      <style>{`@keyframes mp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body,
  );
}
