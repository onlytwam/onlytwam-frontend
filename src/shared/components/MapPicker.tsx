/**
 * MapPicker.tsx — v7 (draggable-marker, Rapido-style)
 *
 * What changed from v6:
 *  ① Pin is a real Leaflet Marker at a lat/lng — NOT a CSS div fixed to screen centre.
 *     Zooming keeps the pin at its exact geographic position (no jumping to new centre).
 *  ② Map pans freely — pin moves visually WITH the map (stays at its geo coord).
 *  ③ Click-and-drag the PIN to relocate it; dragend triggers reverse-geocode.
 *  ④ GPS button: flies map to user location AND moves pin there.
 *  ⑤ No more MapTracker watching moveend/zoomend — only drag & GPS move the pin.
 *
 * Install:  npm install leaflet@1.9.4 react-leaflet@5.0.0
 * CSS:      @import "leaflet/dist/leaflet.css";  in mobile.css
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import { MapContainer, TileLayer, useMap, Marker } from "react-leaflet";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import icon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Fix leaflet default marker asset resolution
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl: icon2xUrl, shadowUrl });

// ── Public result type ─────────────────────────────────────────────────────────
export interface MapPickerResult {
  latitude: number;
  longitude: number;
  building: string; // building / shop / apartment name
  street: string; // house number + road
  area: string; // ward / colony / suburb
  city: string;
  state: string;
  country: string;
  pinCode: string;
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

// ── Custom DivIcon ─────────────────────────────────────────────────────────────
// Two variants: normal and "lifted" (during drag, pin rises + shadow spreads).
const PIN_SVG = `<svg width="32" height="40" viewBox="0 0 46 58" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M23 0C10.297 0 0 10.297 0 23c0 15.225 21 33.5 21.58 34.12a2 2 0 002.84 0C25 56.5 46 38.225 46 23 46 10.297 35.703 0 23 0z" fill="#6b0f2a"/>
  <circle cx="23" cy="23" r="11" fill="white"/>
  <circle cx="23" cy="23" r="5.5" fill="#6b0f2a"/>
</svg>`;

function makePinIcon(lifted: boolean) {
  return L.divIcon({
    html: `<div style="
        display:flex;
        flex-direction:column;
        align-items:center;
        transform:${lifted ? "translateY(-10px)" : "translateY(0)"};
        transition:transform 0.15s cubic-bezier(0.34,1.56,0.64,1);
        cursor:${lifted ? "grabbing" : "grab"};
        user-select:none;
      ">
        <div style="
          filter:${
            lifted
              ? "drop-shadow(0 10px 14px rgba(0,0,0,0.32))"
              : "drop-shadow(0 3px 6px rgba(0,0,0,0.24))"
          };
          transition:filter 0.15s ease;
          line-height:0;
        ">${PIN_SVG}</div>
        <div style="
          width:${lifted ? "18px" : "10px"};
          height:${lifted ? "6px" : "4px"};
          background:rgba(0,0,0,0.18);
          border-radius:50%;
          margin-top:3px;
          transition:all 0.15s ease;
        "></div>
      </div>`,
    className: "",
    iconSize: [32, lifted ? 56 : 46],
    iconAnchor: [16, lifted ? 56 : 46], // bottom-centre anchors on the ground dot
    popupAnchor: [0, -46],
  });
}

const PIN_ICON = makePinIcon(false);
const PIN_LIFTED_ICON = makePinIcon(true);

// ── GPS (Capacitor → browser fallback) ────────────────────────────────────────
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

// ── Reverse geocode (Google → Nominatim fallback) ─────────────────────────────
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

  if (googleKey) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}&language=en&region=IN`,
      );
      const d = await res.json();
      if (d.status !== "OK" || !d.results?.length)
        throw new Error("no results");

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

      const fmtFirst = (best.formatted_address ?? "").split(",")[0].trim();
      const finalBldg =
        building ||
        (fmtFirst && !/^[0-9]/.test(fmtFirst) && fmtFirst !== route
          ? fmtFirst
          : "");
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

  // Nominatim fallback (free, no key required)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&namedetails=1&zoom=18`,
      { headers: { "Accept-Language": "en" } },
    );
    const d = await res.json();
    const a = d?.address ?? {};

    const building =
      a.residential ||
      a.building ||
      a.amenity ||
      a.shop ||
      a.office ||
      a.tourism ||
      a.leisure ||
      a.man_made ||
      a.historic ||
      (!d.name || d.class === "highway" ? "" : d.name) ||
      "";

    const houseNo = a.house_number || "";
    const road = a.road || a.pedestrian || a.footway || a.path || "";
    const street = [houseNo, road].filter(Boolean).join(" ");
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

// ── FlyTo — smoothly pans & zooms map to a coordinate ────────────────────────
function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const prev = useRef("");
  useEffect(() => {
    if (!target) return;
    const k = `${target[0]},${target[1]}`;
    if (k === prev.current) return;
    prev.current = k;
    map.flyTo(target, 17, { duration: 1.1 });
  }, [target, map]);
  return null;
}

// ── Custom zoom buttons ───────────────────────────────────────────────────────
function ZoomCtrl({ bottomOffset }: { bottomOffset: number }) {
  const map = useMap();
  return (
    <div
      style={{
        position: "absolute",
        bottom: bottomOffset,
        right: 14,
        zIndex: 1000,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
      }}
    >
      {(["+", "−"] as const).map((lbl) => (
        <button
          key={lbl}
          onClick={() => (lbl === "+" ? map.zoomIn() : map.zoomOut())}
          style={{
            width: 38,
            height: 38,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            border: "none",
            borderBottom: lbl === "+" ? "1px solid #eee" : "none",
            fontSize: 22,
            fontWeight: 300,
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

// ── DraggablePin — the Leaflet Marker the user grabs to reposition ────────────
interface DraggablePinProps {
  position: [number, number];
  onDragEnd: (lat: number, lng: number) => void;
}

function DraggablePin({ position, onDragEnd }: DraggablePinProps) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const draggingRef = useRef(false);

  // Memoised so react-leaflet never re-attaches handlers mid-drag
  const eventHandlers = useMemo(
    () => ({
      dragstart() {
        draggingRef.current = true;
        map.dragging.disable(); // prevent map pan competing with pin drag
        markerRef.current?.setIcon(PIN_LIFTED_ICON);
      },
      dragend() {
        draggingRef.current = false;
        map.dragging.enable();
        markerRef.current?.setIcon(PIN_ICON);
        const latlng = markerRef.current?.getLatLng();
        if (latlng) onDragEnd(latlng.lat, latlng.lng);
      },
    }),
    [map, onDragEnd],
  );

  return (
    <Marker
      position={position}
      draggable={true}
      icon={PIN_ICON}
      ref={markerRef}
      eventHandlers={eventHandlers}
    />
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
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

// ── Constants ─────────────────────────────────────────────────────────────────
const INDIA: [number, number] = [20.5937, 78.9629];
const BOTTOM_CARD_H = 164; // px height of bottom address card

// ── Main component ────────────────────────────────────────────────────────────
export default function MapPicker({
  open,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
}: Props) {
  const hasInitial = !!(initialLat && initialLng);

  // pinPosition = the geographic coordinate of the draggable marker
  const [pinPosition, setPinPosition] = useState<[number, number]>(
    hasInitial ? [initialLat!, initialLng!] : INDIA,
  );
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [address, setAddress] = useState<MapPickerResult | null>(null);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── On open ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (hasInitial) {
      const p: [number, number] = [initialLat!, initialLng!];
      setPinPosition(p);
      setFlyTarget(p);
    } else {
      locate(); // auto-GPS on first open
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Reverse geocode whenever pin moves ──────────────────────
  useEffect(() => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    setGeocoding(true);
    geoTimer.current = setTimeout(async () => {
      const r = await reverseGeocode(pinPosition[0], pinPosition[1]);
      setAddress(r);
      setGeocoding(false);
    }, 650);
    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
  }, [pinPosition]);

  // ── GPS locate ────────────────────────────────────────────
  const locate = useCallback(async () => {
    setGpsLoading(true);
    try {
      const { lat, lng } = await getGPS();
      const p: [number, number] = [lat, lng];
      setPinPosition(p); // move pin to GPS location
      setFlyTarget(p); // fly map there
    } catch {
      /* user pans manually */
    } finally {
      setGpsLoading(false);
    }
  }, []);

  // ── Pin drag ──────────────────────────────────────────────
  const handleDragEnd = useCallback((lat: number, lng: number) => {
    setPinPosition([lat, lng]); // triggers geocode effect above
  }, []);

  // ── Confirm ───────────────────────────────────────────────
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
        zIndex: 1039, // one below app header (1040) — header floats on top naturally
        background: "#e5e3df",
        fontFamily: '"Trebuchet MS",Arial,sans-serif',
      }}
    >
      {/* ── Full-screen Leaflet map ── */}
      <MapContainer
        center={pinPosition}
        zoom={17}
        style={{ position: "absolute", inset: 0 }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={19}
          subdomains="abcd"
        />

        {/*
         * DraggablePin — a real Leaflet Marker at a lat/lng.
         * • Zooming keeps it at its geographic position (no jump to screen centre).
         * • Panning the map moves it visually — it stays at its geo coord.
         * • Drag the pin itself to relocate it.
         */}
        <DraggablePin position={pinPosition} onDragEnd={handleDragEnd} />

        {/* Fly map to GPS / initial position without moving the pin */}
        <FlyTo target={flyTarget} />

        {/* Custom zoom buttons positioned above the bottom address card */}
        <ZoomCtrl bottomOffset={BOTTOM_CARD_H + 46 + 14} />
      </MapContainer>

      {/* ── Floating back button (below app header) ── */}
      <button
        onClick={onClose}
        aria-label="Close map"
        style={{
          position: "absolute",
          top: "calc(var(--mobile-back-header-height, 36px) + 10px)",
          left: 12,
          zIndex: 1000,
          background: "#fff",
          border: "none",
          borderRadius: 50,
          width: 38,
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 12px rgba(0,0,0,0.22)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M19 12H5M5 12L12 19M5 12L12 5"
            stroke="#111"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* ── Title ── */}
      <div
        style={{
          position: "absolute",
          top: "calc(var(--mobile-back-header-height, 36px) + 14px)",
          left: 60,
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        <p
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: 14,
            color: "#111",
            textShadow:
              "0 0 6px #fff,0 0 12px #fff,0 1px 4px rgba(255,255,255,0.9)",
          }}
        >
          Set Delivery Location
        </p>
      </div>

      {/* ── GPS button — floats above the bottom card ── */}
      <button
        onClick={locate}
        disabled={gpsLoading}
        aria-label="Use my location"
        style={{
          position: "absolute",
          bottom: BOTTOM_CARD_H + 12,
          right: 14,
          zIndex: 1000,
          background: "#fff",
          border: "none",
          borderRadius: "50%",
          width: 46,
          height: 46,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 3px 14px rgba(0,0,0,0.2)",
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

      {/* ── Bottom address card (overlaid on the map) ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#fff",
          borderRadius: "18px 18px 0 0",
          padding: "10px 16px 30px",
          boxShadow: "0 -8px 28px rgba(0,0,0,0.12)",
          zIndex: 1000,
        }}
      >
        {/* drag handle */}
        <div
          style={{
            width: 36,
            height: 4,
            background: "#e0e0e0",
            borderRadius: 2,
            margin: "0 auto 12px",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 12,
            minHeight: 44,
          }}
        >
          {/* pin icon badge */}
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
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {address.fullAddress.split(",")[0].trim()}
                </p>
                <p
                  style={
                    {
                      margin: "3px 0 0",
                      fontSize: 12.5,
                      color: "#555",
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    } as React.CSSProperties
                  }
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
                Drag the pin or tap GPS to set location
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
            background: geocoding || !address ? "#c9949e" : "#6b0f2a",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 700,
            cursor: geocoding || !address ? "not-allowed" : "pointer",
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
