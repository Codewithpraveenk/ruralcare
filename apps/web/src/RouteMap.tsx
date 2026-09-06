import {
  ExternalLink,
  MapPin,
  Minus,
  Navigation,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  serviceCapacity,
  travelMinutes,
  type Facility,
  type Service,
} from "@ruralcare/shared";

type Props = {
  facilities: Facility[];
  selectedId?: string;
  service: Service;
  origin: { latitude: number; longitude: number; label: string };
  onSelect: (facility: Facility) => void;
};
const statusColor = {
  AVAILABLE: "#148879",
  LIMITED: "#d08a08",
  UNAVAILABLE: "#c6563d",
};
const mapsUrl = (facility: Facility, origin:Props["origin"]) =>
  `https://www.google.com/maps/dir/?api=1&origin=${origin.latitude},${origin.longitude}&destination=${facility.latitude},${facility.longitude}&travelmode=driving`;

export function RouteMap({ facilities, selectedId, service, origin, onSelect }: Props) {
  const [zoom, setZoom] = useState(1);
  const nearby = useMemo(
    () => facilities.filter((facility) => facility.distanceKm <= 60),
    [facilities],
  );
  const regionalCount = facilities.length - nearby.length;
  const visibleFacilities = nearby.length ? nearby : facilities.slice(0, 1);
  const current =
    visibleFacilities.find((item) => item.id === selectedId) ||
    visibleFacilities[0];
  const points = [origin, ...visibleFacilities];
  const minLat = Math.min(...points.map((point) => point.latitude));
  const maxLat = Math.max(...points.map((point) => point.latitude));
  const minLng = Math.min(...points.map((point) => point.longitude));
  const maxLng = Math.max(...points.map((point) => point.longitude));
  const spreadLat = Math.max(0.015, maxLat - minLat);
  const spreadLng = Math.max(0.015, maxLng - minLng);
  const pos = (point: { latitude: number; longitude: number }) => ({
    x: 10 + ((point.longitude - minLng) / spreadLng) * 80,
    y: 88 - ((point.latitude - minLat) / spreadLat) * 76,
  });
  const start = pos(origin);
  return (
    <section className="route-map-card">
      <div className="route-map-head">
        <div>
          <p className="eyebrow">CARE ROUTE MAP</p>
          <h2>Nearby public-care route</h2>
          <p>
            Offline preview for nearby facilities. Use Google Maps for live
            navigation when online.
          </p>
        </div>
        <div className="map-tools">
          <button
            className="map-reset"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.8, value - 0.2))}
          >
            <Minus size={15} />
          </button>
          <button
            className="map-reset"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(1.6, value + 0.2))}
          >
            <Plus size={15} />
          </button>
          <button
            className="map-reset"
            onClick={() => {
              setZoom(1);
              current && onSelect(current);
            }}
          >
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>
      <div className="route-map-canvas">
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="Offline route preview showing the demo village and nearby public facilities"
        >
          <defs>
            <pattern
              id="grid"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 12 0 L 0 0 0 12"
                fill="none"
                stroke="#dcece7"
                strokeWidth=".35"
              />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
          <g transform={`translate(50 50) scale(${zoom}) translate(-50 -50)`}>
            {visibleFacilities.map((facility) => {
              const end = pos(facility);
              const capacity = serviceCapacity(facility, service);
              return (
                <line
                  key={facility.id}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={
                    facility.id === current?.id
                      ? statusColor[capacity.status]
                      : "#bcd9d1"
                  }
                  strokeWidth={facility.id === current?.id ? 1.8 : 0.55}
                  strokeDasharray={
                    capacity.status === "UNAVAILABLE" ? "2 1.5" : undefined
                  }
                />
              );
            })}
            <circle
              cx={start.x}
              cy={start.y}
              r="3.4"
              fill="#123f3b"
              stroke="#fff"
              strokeWidth="1.2"
            />
            <text
              x={start.x + 3.7}
              y={start.y + 1}
              fontSize="3.1"
              fill="#174b45"
              fontWeight="700"
            >
              You
            </text>
            {visibleFacilities.map((facility) => {
              const end = pos(facility);
              const capacity = serviceCapacity(facility, service);
              const selected = facility.id === current?.id;
              return (
                <g
                  key={facility.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Select ${facility.name}`}
                  onClick={() => onSelect(facility)}
                >
                  <circle
                    cx={end.x}
                    cy={end.y}
                    r={selected ? "4.4" : "3.25"}
                    fill={statusColor[capacity.status]}
                    stroke="#fff"
                    strokeWidth={selected ? "1.35" : ".9"}
                  />
                  <text
                    x={end.x + 4}
                    y={end.y + 1}
                    fontSize="2.8"
                    fill="#254f49"
                  >
                    {facility.name.length > 20
                      ? `${facility.name.slice(0, 18)}…`
                      : facility.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="map-legend">
          <span>
            <i className="legend-origin" />
            Demo village
          </span>
          <span>
            <i className="legend-available" />
            Available
          </span>
          <span>
            <i className="legend-limited" />
            Limited
          </span>
          <span>
            <i className="legend-unavailable" />
            Unavailable
          </span>
        </div>
      </div>
      {regionalCount > 0 && (
        <p className="regional-note">
          {regionalCount} regional referral option{regionalCount > 1 ? "s" : ""}{" "}
          shown in the comparison below; they are excluded from this nearby
          route preview.
        </p>
      )}
      {current && (
        <div className="route-summary">
          <span className="route-icon">
            <Navigation size={19} />
          </span>
          <div>
            <small>SELECTED ROUTE</small>
            <b>
              {origin.label} → {current.name}
            </b>
            <span>
              {current.distanceKm} km · about {travelMinutes(current)} min ·{" "}
              {serviceCapacity(current, service).estimatedWaitMinutes} min
              estimated wait
            </span>
          </div>
          <a
            className="gmaps-link"
            href={mapsUrl(current,origin)}
            target="_blank"
            rel="noreferrer"
          >
            <MapPin size={16} /> Google Maps <ExternalLink size={13} />
          </a>
        </div>
      )}
    </section>
  );
}
