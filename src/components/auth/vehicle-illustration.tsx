/** Ilustración de marca, sin datos de siniestros reales. */
export function VehicleIllustration() {
  return (
    <div className="vehicle-scene" aria-hidden="true">
      <div className="vehicle-orbit vehicle-orbit-one" />
      <div className="vehicle-orbit vehicle-orbit-two" />
      <svg viewBox="0 0 640 320" className="vehicle-drawing" fill="none">
        <ellipse cx="324" cy="262" rx="237" ry="22" fill="#020f17" opacity=".6" />
        <path
          d="M84 194 112 160 212 139 263 86Q274 76 292 77L394 83Q409 85 423 101L470 151 540 178Q554 184 555 200L550 230 504 239 137 239 86 224Z"
          fill="#173647"
          stroke="#82b7b7"
          strokeWidth="2"
        />
        <path d="m231 138 45-47 107 6 39 54Z" fill="#091e2c" stroke="#78a2ae" strokeWidth="2" />
        <path
          d="m327 94-6 53M222 146l-6 76m114-69-3 71m116-65 10 65M119 179l87-22m-111 44 111-18m14 0 214 7 94 18"
          stroke="#487787"
          strokeWidth="2"
        />
        <path d="m114 168 66-14-16 22-63 13M511 178l27 10 7 14-40-11" fill="#a8f5db" />
        <path
          d="m86 212 64 10m356 2 43-7M242 167h22m89 7h21"
          stroke="#b4ced4"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="187" cy="231" r="42" fill="#071724" stroke="#497381" strokeWidth="2" />
        <circle cx="187" cy="231" r="26" fill="#254956" stroke="#a0bec4" strokeWidth="3" />
        <circle cx="187" cy="231" r="9" fill="#94bdc2" />
        <path
          d="m187 205v17m-25 17 17-5m23 18-9-14m15-23-14 10m-26-12 13 12"
          stroke="#9fbdc7"
          strokeWidth="3"
        />
        <circle cx="462" cy="231" r="42" fill="#071724" stroke="#497381" strokeWidth="2" />
        <circle cx="462" cy="231" r="26" fill="#254956" stroke="#a0bec4" strokeWidth="3" />
        <circle cx="462" cy="231" r="9" fill="#94bdc2" />
        <path
          d="m462 205v17m-25 17 17-5m23 18-9-14m15-23-14 10m-26-12 13 12"
          stroke="#9fbdc7"
          strokeWidth="3"
        />
        <path
          d="M94 140v-24h24m-24 94v24h24M549 140v-24h-24m24 94v24h-24"
          stroke="#6ee7b7"
          strokeWidth="3"
        />
        <rect
          x="319"
          y="149"
          width="78"
          height="64"
          rx="8"
          stroke="#6ee7b7"
          strokeDasharray="6 5"
        />
        <circle cx="358" cy="181" r="5" fill="#6ee7b7" />
        <path d="m358 181 45-77h91" stroke="#6ee7b7" strokeWidth="1.5" />
      </svg>
      <span className="vehicle-label">
        <span className="h-2 w-2 rounded-full bg-emerald-300" /> Una visión más clara del daño
      </span>
      <span className="vehicle-caption">CAPTURA · ANÁLISIS · SEGUIMIENTO</span>
    </div>
  );
}
