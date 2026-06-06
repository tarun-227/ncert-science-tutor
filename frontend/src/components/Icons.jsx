// Icon set — minimal stroked icons, 1.6 stroke
// Ported from design prototype

export default function Icon({ name, size = 18, className, style, ...rest }) {
  const s = size, sw = 1.6;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', className, style, ...rest };
  switch (name) {
    case 'sections':
      return (<svg {...common}><path d="M4 5h16M4 12h10M4 19h13"/><path d="M18 12h2M19 19h1"/></svg>);
    case 'pencil':
      return (<svg {...common}><path d="M4 20h4l10-10-4-4L4 16zM14 6l4 4"/></svg>);
    case 'pencil-line':
      return (<svg {...common}><path d="M14 4l6 6L9 21H3v-6z"/><path d="M13 5l6 6M14 22h7"/></svg>);
    case 'edit-square':
      return (<svg {...common}><path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>);
    case 'edit-note':
      return (<svg {...common}><path d="M3 7a2 2 0 0 1 2-2h10l4 4v8M3 7v12a2 2 0 0 0 2 2h7"/><path d="M14 5v4h4M7 12h5M7 16h3"/><path d="m17.5 17.5 3 3M21 14l-7 7-2 .5.5-2 7-7a1.5 1.5 0 0 1 2 2z"/></svg>);
    case 'sliders':
      return (<svg {...common}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>);
    case 'wand':
      return (<svg {...common}><path d="m4 20 12-12-3-3L1 17z"/><path d="M14 4l3 3M19 3v3M22 5h-3M19 9v3M22 11h-3"/></svg>);
    case 'clock':
      return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
    case 'target':
      return (<svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>);
    case 'trash':
      return (<svg {...common}><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v7M14 11v7"/></svg>);
    case 'leaf':
      return (<svg {...common}><path d="M11 20A7 7 0 0 1 4 13c0-7 9-9 16-9 0 7-2 16-9 16Z"/><path d="M4 20c4-7 9-10 12-11"/></svg>);
    case 'home':
      return (<svg {...common}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>);
    case 'calendar':
      return (<svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>);
    case 'book':
      return (<svg {...common}><path d="M4 5a2 2 0 0 1 2-2h13v16H7a2 2 0 0 0-2 2V5z"/><path d="M19 17H7"/></svg>);
    case 'ask':
      return (<svg {...common}><path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1.5 4.2A8 8 0 0 1 21 12z"/><path d="M8.5 11h7M8.5 14h4.5"/></svg>);
    case 'mic':
      return (<svg {...common}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 19v3M8 22h8"/></svg>);
    case 'quiz':
      return (<svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 9l2 2 4-4M9 16h6"/></svg>);
    case 'diagram':
      return (<svg {...common}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.5 7.5 11 16M16.5 7.5 13 16M8 6h8"/></svg>);
    case 'note':
      return (<svg {...common}><path d="M5 3h11l4 4v14H5z"/><path d="M16 3v4h4M9 12h6M9 16h4"/></svg>);
    case 'sparkles':
      return (<svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>);
    case 'history':
      return (<svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>);
    case 'settings':
      return (<svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>);
    case 'search':
      return (<svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>);
    case 'bell':
      return (<svg {...common}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>);
    case 'chev':
      return (<svg {...common}><path d="m9 6 6 6-6 6"/></svg>);
    case 'chev-down':
      return (<svg {...common}><path d="m6 9 6 6 6-6"/></svg>);
    case 'arrow-right':
      return (<svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>);
    case 'arrow-up':
      return (<svg {...common}><path d="M12 19V5M5 12l7-7 7 7"/></svg>);
    case 'plus':
      return (<svg {...common}><path d="M12 5v14M5 12h14"/></svg>);
    case 'check':
      return (<svg {...common}><path d="m5 12 5 5L20 7"/></svg>);
    case 'x':
      return (<svg {...common}><path d="M6 6l12 12M18 6L6 18"/></svg>);
    case 'check-circle':
      return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>);
    case 'circle':
      return (<svg {...common}><circle cx="12" cy="12" r="8"/></svg>);
    case 'play':
      return (<svg {...common}><path d="M7 5v14l12-7z"/></svg>);
    case 'side-toggle':
      return (<svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/></svg>);
    case 'globe':
      return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg>);
    case 'flame':
      return (<svg {...common}><path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z"/></svg>);
    case 'trophy':
      return (<svg {...common}><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3M9 14h6v6H9z"/></svg>);
    case 'graph':
      return (<svg {...common}><path d="M4 19h16M6 16l4-6 4 4 5-9"/></svg>);
    case 'highlight':
      return (<svg {...common}><path d="m4 20 3-1 11-11-2-2L5 17z"/><path d="M14 6l2 2"/></svg>);
    case 'tag':
      return (<svg {...common}><path d="M3 12V4h8l10 10-8 8z"/><circle cx="8" cy="9" r="1.5"/></svg>);
    case 'pause':
      return (<svg {...common}><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>);
    case 'dot':
      return (<svg {...common}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>);
    case 'menu':
      return (<svg {...common}><path d="M4 7h16M4 12h16M4 17h10"/></svg>);
    case 'flask':
      return (<svg {...common}><path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 19L14 9V3"/><path d="M7 14h10"/></svg>);
    case 'compass':
      return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-4 0 2-6z"/></svg>);
    case 'list':
      return (<svg {...common}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>);
    default: return null;
  }
}
