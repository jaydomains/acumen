// figure.jsx — image placeholder + caption components.
// Slots are optional; gracefully absent when no src is provided.

const FigureIconPool = [
  // diagram: cross-section of a coating system
  (<g key="1">
    <rect x="20" y="60" width="120" height="6" fill="currentColor" opacity=".25"/>
    <rect x="20" y="52" width="120" height="6" fill="currentColor" opacity=".4"/>
    <rect x="20" y="44" width="120" height="6" fill="currentColor" opacity=".55"/>
    <rect x="20" y="36" width="120" height="6" fill="currentColor" opacity=".7"/>
    <rect x="20" y="68" width="120" height="14" fill="currentColor" opacity=".15"/>
    <path d="M 6 30 L 14 30 M 6 40 L 14 40 M 6 50 L 14 50 M 6 60 L 14 60 M 6 70 L 14 70" stroke="currentColor" strokeWidth="0.8" opacity=".5"/>
    <text x="0" y="33" fontSize="5" fontFamily="monospace" fill="currentColor" opacity=".6">µm</text>
  </g>),
  // diagram: surveyor's marks / target
  (<g key="2">
    <circle cx="80" cy="50" r="28" stroke="currentColor" strokeWidth="1" fill="none" opacity=".45"/>
    <circle cx="80" cy="50" r="18" stroke="currentColor" strokeWidth="1" fill="none" opacity=".55"/>
    <circle cx="80" cy="50" r="8" stroke="currentColor" strokeWidth="1" fill="none" opacity=".7"/>
    <path d="M 80 14 L 80 86 M 44 50 L 116 50" stroke="currentColor" strokeWidth="0.7" opacity=".5"/>
    <circle cx="80" cy="50" r="2" fill="currentColor"/>
  </g>),
  // diagram: structural detail / corner flashing
  (<g key="3">
    <path d="M 20 80 L 20 30 L 90 30 L 90 22 L 140 22" stroke="currentColor" strokeWidth="1.4" fill="none" opacity=".6"/>
    <path d="M 24 80 L 24 34 L 90 34" stroke="currentColor" strokeWidth="0.8" fill="none" opacity=".4" strokeDasharray="2 2"/>
    <circle cx="90" cy="26" r="3" stroke="currentColor" strokeWidth="0.8" fill="none" opacity=".6"/>
    <text x="96" y="29" fontSize="5" fontFamily="monospace" fill="currentColor" opacity=".55">A</text>
  </g>),
  // diagram: hull / waterline
  (<g key="4">
    <path d="M 16 70 Q 80 76 144 70 L 144 84 L 16 84 Z" fill="currentColor" opacity=".18"/>
    <path d="M 16 70 Q 80 76 144 70" stroke="currentColor" strokeWidth="1" fill="none" opacity=".7"/>
    <path d="M 30 56 L 130 56" stroke="currentColor" strokeWidth="0.7" fill="none" opacity=".4" strokeDasharray="3 2"/>
    <path d="M 60 40 L 100 40 L 110 56 L 50 56 Z" stroke="currentColor" strokeWidth="1" fill="none" opacity=".7"/>
  </g>),
  // diagram: blueprint plan view
  (<g key="5">
    <rect x="20" y="20" width="120" height="60" stroke="currentColor" strokeWidth="1" fill="none" opacity=".6"/>
    <rect x="20" y="20" width="40" height="32" stroke="currentColor" strokeWidth="0.8" fill="none" opacity=".5"/>
    <rect x="60" y="52" width="50" height="28" stroke="currentColor" strokeWidth="0.8" fill="none" opacity=".5"/>
    <path d="M 28 28 L 36 28 M 28 32 L 36 32" stroke="currentColor" strokeWidth="0.5" opacity=".4"/>
    <circle cx="120" cy="40" r="3" stroke="currentColor" strokeWidth="0.7" fill="none" opacity=".55"/>
  </g>),
];

function pickFigureIcon(seed) {
  if (seed == null) return FigureIconPool[0];
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return FigureIconPool[h % FigureIconPool.length];
}

// Figure — main wrapper. Optionally renders a caption underneath.
// Props:
//   src       — image src; if absent, placeholder is shown
//   alt       — alt text
//   caption   — short caption text (string or JSX)
//   captionLabel — eyebrow override ("FIG. 01" default if number provided)
//   number    — figure number, surfaces in placeholder + caption
//   ratio     — '16x9' | '4x3' | '1x1' (default '16x9')
//   variant   — 'reference' | 'inline' | 'choice' (controls margin/sizing)
//   placeholder — description text in placeholder slot
function Figure({ src, alt = '', caption, captionLabel, number, ratio = '16x9', variant = 'reference', placeholder, seed }) {
  const klass = variant === 'choice' ? 'figure figure-choice'
              : variant === 'inline' ? 'figure figure-inline'
              : 'figure figure-reference';
  const label = captionLabel || (number != null ? `FIG. ${String(number).padStart(2,'0')}` : null);
  return (
    <figure className={klass}>
      <div className="figure-frame" data-ratio={ratio}>
        <span className="corner tl"/><span className="corner tr"/>
        <span className="corner bl"/><span className="corner br"/>
        {src ? (
          <img src={src} alt={alt}/>
        ) : (
          <div className="ph-content">
            <svg viewBox="0 0 160 100" width="60%" height="60%" fill="none" preserveAspectRatio="xMidYMid meet">
              {pickFigureIcon(seed || placeholder || number)}
            </svg>
            <div className="ph-label">Image placeholder</div>
            {placeholder && <div className="ph-desc">{placeholder}</div>}
          </div>
        )}
        {label && <span className="fig-tag">{label}</span>}
      </div>
      {caption && (
        <figcaption className="figure-caption">
          {label && variant !== 'choice' && <span className="label">{label}</span>}
          <span>{caption}</span>
        </figcaption>
      )}
    </figure>
  );
}

// InlineFigure — convenience wrapper for in-prompt diagrams. Smaller default.
function InlineFigure(props) { return <Figure variant="inline" {...props}/>; }
function ChoiceFigure(props) { return <Figure variant="choice" ratio="4x3" {...props}/>; }

Object.assign(window, { Figure, InlineFigure, ChoiceFigure });
