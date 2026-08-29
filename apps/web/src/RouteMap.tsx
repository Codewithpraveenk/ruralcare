import { MapPin, Navigation, RotateCcw } from "lucide-react";
import { serviceCapacity, travelMinutes, type Facility, type Service } from "@ruralcare/shared";

type Props = { facilities: Facility[]; selectedId?: string; service: Service; onSelect: (facility: Facility) => void };
const origin = { latitude: 13.041, longitude: 80.224, name: "Current village · demo location" };
const statusColor = { AVAILABLE: "#148879", LIMITED: "#d08a08", UNAVAILABLE: "#c6563d" };

export function RouteMap({ facilities, selectedId, service, onSelect }: Props) {
  const points = [origin, ...facilities];
  const minLat = Math.min(...points.map((point) => point.latitude)); const maxLat = Math.max(...points.map((point) => point.latitude));
  const minLng = Math.min(...points.map((point) => point.longitude)); const maxLng = Math.max(...points.map((point) => point.longitude));
  const spreadLat = Math.max(.02, maxLat - minLat); const spreadLng = Math.max(.02, maxLng - minLng);
  const pos = (point: { latitude: number; longitude: number }) => ({ x: 10 + ((point.longitude - minLng) / spreadLng) * 80, y: 88 - ((point.latitude - minLat) / spreadLat) * 76 });
  const current = facilities.find((item) => item.id === selectedId) || facilities[0];
  const currentPosition = current && pos(current); const start = pos(origin);
  return <section className="route-map-card">
    <div className="route-map-head"><div><p className="eyebrow">OFFLINE CARE ROUTE</p><h2>From village to public care</h2><p>Bundled demo map. Travel and capacity are synthetic estimates.</p></div><button className="map-reset" onClick={() => current && onSelect(current)}><RotateCcw size={15}/> Reset route</button></div>
    <div className="route-map-canvas">
      <svg viewBox="0 0 100 100" role="img" aria-label="Offline route map showing demo village and public facilities">
        <defs><pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#dcece7" strokeWidth=".35"/></pattern></defs>
        <rect width="100" height="100" fill="url(#grid)"/>
        {facilities.map((facility) => { const end = pos(facility); const capacity = serviceCapacity(facility, service); return <line key={facility.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={facility.id === current?.id ? statusColor[capacity.status] : "#bcd9d1"} strokeWidth={facility.id === current?.id ? 1.8 : .55} strokeDasharray={capacity.status === "UNAVAILABLE" ? "2 1.5" : undefined}/>; })}
        <circle cx={start.x} cy={start.y} r="3.4" fill="#123f3b" stroke="#fff" strokeWidth="1.2"/>
        <text x={start.x + 3.7} y={start.y + 1} fontSize="3.1" fill="#174b45" fontWeight="700">You</text>
        {facilities.map((facility) => { const end = pos(facility); const capacity = serviceCapacity(facility, service); const selected = facility.id === current?.id; return <g key={facility.id} tabIndex={0} role="button" onClick={() => onSelect(facility)}><circle cx={end.x} cy={end.y} r={selected ? "4.4" : "3.25"} fill={statusColor[capacity.status]} stroke="#fff" strokeWidth={selected ? "1.35" : ".9"}/><text x={end.x + 4} y={end.y + 1} fontSize="2.8" fill="#254f49">{facility.name.length > 20 ? `${facility.name.slice(0, 18)}…` : facility.name}</text></g>; })}
      </svg>
      <div className="map-legend"><span><i className="legend-origin"/>Demo village</span><span><i className="legend-available"/>Available</span><span><i className="legend-limited"/>Limited</span><span><i className="legend-unavailable"/>Unavailable</span></div>
    </div>
    {current && <div className="route-summary"><span className="route-icon"><Navigation size={19}/></span><div><small>SELECTED ROUTE</small><b>{origin.name} → {current.name}</b><span>{current.distanceKm} km · about {travelMinutes(current)} min · {serviceCapacity(current, service).estimatedWaitMinutes} min estimated wait</span></div><MapPin size={20}/></div>}
  </section>;
}
