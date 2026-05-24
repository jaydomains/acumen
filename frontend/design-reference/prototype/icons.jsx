// icons.jsx — minimal stroke-based icon set, single export object on window.

const Icon = ({ name, size = 16, stroke = 1.5, ...rest }) => {
  const sw = stroke;
  const common = {
    width: size, height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: sw,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...rest,
  };
  switch (name) {
    case 'dashboard': return (<svg {...common}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>);
    case 'compass':   return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5z"/></svg>);
    case 'attempt':   return (<svg {...common}><path d="M4 6h12M4 12h8M4 18h14"/><circle cx="19" cy="6" r="1.2" fill="currentColor"/></svg>);
    case 'graph':     return (<svg {...common}><path d="M4 19V5M4 19h16"/><path d="m7 15 3-3 3 2 4-6"/></svg>);
    case 'constellation': return (<svg {...common}><circle cx="6" cy="7" r="1.2" fill="currentColor"/><circle cx="14" cy="5" r="1.6" fill="currentColor"/><circle cx="10" cy="13" r="2.2" fill="currentColor"/><circle cx="18" cy="14" r="1.2" fill="currentColor"/><circle cx="8" cy="19" r="1" fill="currentColor"/><path d="M6 7l4 6M14 5l-4 8M10 13l8 1M10 13l-2 6" strokeWidth=".8" opacity=".5"/></svg>);
    case 'history':   return (<svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v5l3 2"/></svg>);
    case 'users':     return (<svg {...common}><circle cx="9" cy="9" r="3.5"/><path d="M2.5 19c.7-3.4 3.4-5 6.5-5s5.8 1.6 6.5 5"/><circle cx="17" cy="7" r="2.5"/><path d="M16 13.5c2.7.3 4.7 1.8 5.5 4.5"/></svg>);
    case 'catalogue': return (<svg {...common}><path d="M4 5a1 1 0 0 1 1-1h13.5a1.5 1.5 0 0 1 1.5 1.5V20H6.5A2.5 2.5 0 0 1 4 17.5V5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/><path d="M8 8h7"/></svg>);
    case 'review':    return (<svg {...common}><path d="M4 4h16v12H7l-3 4V4z"/><path d="M8.5 10h7M8.5 7.5h4"/></svg>);
    case 'cost':      return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 6v12M9 8.5c0-1.2 1.3-2 3-2s3 .9 3 2c0 2.5-6 1.5-6 4 0 1.2 1.3 2 3 2s3-.8 3-2"/></svg>);
    case 'loop':      return (<svg {...common}><path d="M3 12a9 9 0 0 1 15-6.7M21 12a9 9 0 0 1-15 6.7"/><path d="M18 2v4h-4M6 22v-4h4"/></svg>);
    case 'shield':    return (<svg {...common}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>);
    case 'flag':      return (<svg {...common}><path d="M5 3v18"/><path d="M5 4h11l-2 3.5 2 3.5H5"/></svg>);
    case 'sparkles':  return (<svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.5 5.5l2.8 2.8M15.7 15.7l2.8 2.8M5.5 18.5l2.8-2.8M15.7 8.3l2.8-2.8"/></svg>);
    case 'lock':      return (<svg {...common}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>);
    case 'eye':       return (<svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>);
    case 'eyeOff':    return (<svg {...common}><path d="m3 3 18 18M10.6 10.6a3 3 0 0 0 4.2 4.2"/><path d="M6.4 6.4C3.7 8 2 12 2 12s3.5 7 10 7c2 0 3.7-.6 5.1-1.4M9 4.5A10 10 0 0 1 12 4c6.5 0 10 7 10 7-.5.9-1.3 2.2-2.4 3.4"/></svg>);
    case 'arrowRight':return (<svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
    case 'arrowUp':   return (<svg {...common}><path d="M12 19V5M6 11l6-6 6 6"/></svg>);
    case 'arrowDown': return (<svg {...common}><path d="M12 5v14M6 13l6 6 6-6"/></svg>);
    case 'check':     return (<svg {...common}><path d="m5 12 4 4 10-10"/></svg>);
    case 'x':         return (<svg {...common}><path d="M6 6l12 12M18 6 6 18"/></svg>);
    case 'plus':      return (<svg {...common}><path d="M12 5v14M5 12h14"/></svg>);
    case 'search':    return (<svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/></svg>);
    case 'menu':      return (<svg {...common}><path d="M4 6h16M4 12h16M4 18h16"/></svg>);
    case 'sliders':   return (<svg {...common}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h14M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/></svg>);
    case 'pause':     return (<svg {...common}><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg>);
    case 'clock':     return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>);
    case 'book':      return (<svg {...common}><path d="M4 5a1 1 0 0 1 1-1h6v16H5.5A1.5 1.5 0 0 1 4 18.5V5z"/><path d="M11 4h6a1 1 0 0 1 1 1v13.5a1.5 1.5 0 0 1-1.5 1.5H11"/></svg>);
    case 'external':  return (<svg {...common}><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></svg>);
    case 'spark':     return (<svg {...common}><path d="M12 3v4M12 17v4M5 12H3M21 12h-2M6 6l1.5 1.5M16.5 16.5 18 18M6 18l1.5-1.5M16.5 7.5 18 6"/></svg>);
    case 'link':      return (<svg {...common}><path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6L11 7"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6L13 17"/></svg>);
    case 'logout':    return (<svg {...common}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8 6 12l4 4"/><path d="M6 12h12"/></svg>);
    case 'settings':  return (<svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
    case 'inbox':     return (<svg {...common}><path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6l2-8z"/></svg>);
    case 'wave':      return (<svg {...common}><path d="M3 12c2 0 2-4 4-4s2 8 4 8 2-8 4-8 2 4 4 4 2-2 2-2"/></svg>);
    default: return null;
  }
};

window.Icon = Icon;
