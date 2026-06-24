// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const YEAR_WIDTH     = 88;
const TIMELINE_START = new Date('2025-01-01');
const ROTATION_START = new Date('2029-07-01');

// ─── SEAT DEFINITIONS ────────────────────────────────────────────────────────

const SEATS = [
  {
    id: 'north', label: 'North Seat',
    districts: [
      { id: 'park-city',    name: 'Park City SD',     color: '#1d4ed8' },
      { id: 'north-summit', name: 'North Summit SD',  color: '#3b82f6' },
      { id: 'south-summit', name: 'South Summit SD',  color: '#93c5fd' },
    ],
  },
  {
    id: 'central', label: 'Central Seat',
    districts: [
      { id: 'timpanogos', name: 'Timpanogos SD',     color: '#b45309' },
      { id: 'wasatch',    name: 'Wasatch County SD', color: '#f59e0b' },
    ],
  },
  {
    id: 'west', label: 'West Seat',
    districts: [
      { id: 'aspen-peaks',   name: 'Aspen Peaks SD',   color: '#4ade80' },
      { id: 'lake-mountain', name: 'Lake Mountain SD', color: '#15803d' },
    ],
  },
  {
    id: 'south', label: 'South Seat',
    districts: [
      { id: 'nebo',  name: 'Nebo SD',  color: '#b91c1c' },
      { id: 'provo', name: 'Provo SD', color: '#f87171' },
    ],
  },
];

const GRANDFATHERED = [
  { name: 'Julie King',         district: 'Alpine SD',         color: '#6366f1', termEnd: new Date('2027-06-30'), note: '→ splits Jul ’27' },
  { name: 'Meredith Reed',      district: 'Park City SD',      color: '#1d4ed8', termEnd: new Date('2027-06-30') },
  { name: 'Rick Ainge',         district: 'Nebo SD',           color: '#b91c1c', termEnd: new Date('2029-06-30') },
  { name: 'Breanne Dedrickson', district: 'Wasatch County SD', color: '#b45309', termEnd: new Date('2029-06-30') },
  { name: 'Dan Eckert',         district: 'South Summit SD',   color: '#93c5fd', termEnd: new Date('2029-06-30') },
  { name: 'Melanie Hall',       district: 'Provo SD',          color: '#f87171', termEnd: new Date('2029-06-30') },
  { name: 'Maggie Judi',        district: 'North Summit SD',   color: '#3b82f6', termEnd: new Date('2029-06-30') },
];

const KEY_EVENTS = [
  { date: new Date('2026-05-06'), label: 'SB240 Effective',       sub: "May 6, '26",  color: '#1d4ed8' },
  { date: new Date('2027-07-01'), label: 'Alpine District Splits', sub: "Jul 1, '27", color: '#b45309' },
  { date: new Date('2029-07-01'), label: 'Full Rotation Begins',   sub: "Jul 1, '29", color: '#15803d' },
];

const GOV_MEMBERS = [
  'Marlon Lindsay', 'Scott Barlow', 'Mary Crafts', 'Brian Hulet',
  'Megan Johnson', 'Vanessa Perez', 'Brad Tanner', 'Paul Thompson', 'Eric Weeks',
];

// ─── STATE ───────────────────────────────────────────────────────────────────

let termLength = 4;

// ─── TIME HELPERS ─────────────────────────────────────────────────────────────

function timelineEnd() {
  return termLength === 4 ? new Date('2053-01-01') : new Date('2073-01-01');
}

function dateToX(date) {
  return Math.round((date - TIMELINE_START) / (365.25 * 24 * 3600 * 1000) * YEAR_WIDTH);
}

function totalWidth() {
  return dateToX(timelineEnd());
}

function addYears(date, yrs) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + Math.floor(yrs));
  const rem = yrs - Math.floor(yrs);
  if (rem) d.setDate(d.getDate() + Math.round(rem * 365.25));
  return d;
}

function fmt(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ─── RENDERING PRIMITIVES ────────────────────────────────────────────────────

function makeBar({ left, width, color, label, tooltip, hatched = false }) {
  const el = document.createElement('div');
  el.className = 'bar' + (hatched ? ' bar-hatched' : '');
  el.style.left  = left + 'px';
  el.style.width = Math.max(width - 2, 4) + 'px';
  el.style.backgroundColor = color || '#ccc';
  if (tooltip) el.title = tooltip;
  if (label && width > 36) {
    const s = document.createElement('span');
    s.className   = 'bar-label';
    s.textContent = label;
    el.appendChild(s);
  }
  return el;
}

// A label-column entry
function makeLabel(html, extraClass = '') {
  const el = document.createElement('div');
  el.className = 'row-label' + (extraClass ? ' ' + extraClass : '');
  el.innerHTML = html;
  return el;
}

// A track-area row
function makeTrackRow(trackFn) {
  const row = document.createElement('div');
  row.className = 'track-row';
  const track = document.createElement('div');
  track.className = 'track';
  track.style.width = totalWidth() + 'px';
  trackFn(track);
  row.appendChild(track);
  return row;
}

// Matching spacer/header in label col
function makeLabelHeader(text, extraClass = '') {
  const el = document.createElement('div');
  el.className = 'section-header' + (extraClass ? ' ' + extraClass : '');
  el.textContent = text;
  return el;
}

// Matching section header in track canvas
function makeTrackHeader(text) {
  const el = document.createElement('div');
  el.className = 'section-header';
  el.textContent = text;
  return el;
}

// ─── ROTATION SEGMENTS ───────────────────────────────────────────────────────

function buildSeatSegments(seat) {
  const segments = [];
  let t = new Date(ROTATION_START);
  let i = 0;
  while (t < timelineEnd()) {
    const dist = seat.districts[i % seat.districts.length];
    const end  = addYears(t, termLength);
    segments.push({
      name:  dist.name,
      color: dist.color,
      start: new Date(t),
      end:   end < timelineEnd() ? end : new Date(timelineEnd()),
    });
    t = end;
    i++;
  }
  return segments;
}

// ─── MAIN RENDERER ───────────────────────────────────────────────────────────

function renderTimeline() {
  const canvas   = document.getElementById('timeline-canvas');
  const labelCol = document.getElementById('label-col');
  const wrapper  = document.getElementById('timeline-wrapper');

  canvas.innerHTML   = '';
  labelCol.innerHTML = '';
  canvas.style.width = totalWidth() + 'px';

  // ── Year header ────────────────────────────────────────────────────────────
  const yearHdr = document.createElement('div');
  yearHdr.className = 'year-header';
  yearHdr.style.width = totalWidth() + 'px';
  for (let y = TIMELINE_START.getFullYear(); y < timelineEnd().getFullYear(); y += 2) {
    const tick = document.createElement('span');
    tick.className = 'year-tick';
    tick.style.left = dateToX(new Date(y, 0, 1)) + 'px';
    tick.textContent = y;
    yearHdr.appendChild(tick);
  }
  canvas.appendChild(yearHdr);

  // Spacer in label col to match year header height
  const lblYearSpacer = document.createElement('div');
  lblYearSpacer.className = 'year-header label-spacer';
  labelCol.appendChild(lblYearSpacer);

  // ── Milestone row ──────────────────────────────────────────────────────────
  const msRow = document.createElement('div');
  msRow.className = 'milestone-row';
  msRow.style.width = totalWidth() + 'px';
  KEY_EVENTS.forEach((ev, i) => {
    const ms = document.createElement('div');
    ms.className = 'milestone ' + (i % 2 === 0 ? 'ms-top' : 'ms-bottom');
    ms.style.left = dateToX(ev.date) + 'px';
    ms.title = ev.label + ' — ' + fmt(ev.date);
    ms.innerHTML = `<span class="ms-dot" style="background:${ev.color}"></span>`
      + `<span class="ms-label" style="color:${ev.color}">${ev.label}<small>${ev.sub}</small></span>`;
    msRow.appendChild(ms);
  });
  canvas.appendChild(msRow);

  const lblMsSpacer = document.createElement('div');
  lblMsSpacer.className = 'milestone-row label-spacer';
  labelCol.appendChild(lblMsSpacer);

  // ── Grandfathered members ──────────────────────────────────────────────────
  labelCol.appendChild(makeLabelHeader('Current Members'));
  canvas.appendChild(makeTrackHeader('Serving Grandfathered Terms'));

  GRANDFATHERED.forEach(gf => {
    const distText = gf.district + (gf.note ? ' ' + gf.note : '');
    labelCol.appendChild(makeLabel(
      `<span class="member-name">${gf.name}</span><span class="member-dist">${distText}</span>`
    ));

    canvas.appendChild(makeTrackRow(track => {
      const left  = 0;
      const width = dateToX(gf.termEnd);
      track.appendChild(makeBar({
        left, width,
        color:   gf.color,
        label:   gf.name,
        tooltip: `${gf.name}\n${gf.district}\nThrough ${fmt(gf.termEnd)}\nGrandfathered under SB240`,
      }));
    }));
  });

  // ── Rotating seats ─────────────────────────────────────────────────────────
  labelCol.appendChild(makeLabelHeader('Rotating Seats'));
  canvas.appendChild(makeTrackHeader(`${termLength}-Year Terms, Beginning July 2029`));

  SEATS.forEach(seat => {
    const segments = buildSeatSegments(seat);
    const vacWidth = dateToX(ROTATION_START);

    labelCol.appendChild(makeLabel(`<span class="seat-label">${seat.label}</span>`));

    canvas.appendChild(makeTrackRow(track => {
      track.appendChild(makeBar({
        left: 0, width: vacWidth,
        color: '#e5e7eb', hatched: true,
        tooltip: 'Seat fills July 2029 when grandfathered terms expire',
      }));
      segments.forEach(seg => {
        const left  = dateToX(seg.start);
        const width = dateToX(seg.end) - left;
        track.appendChild(makeBar({
          left, width,
          color:   seg.color,
          label:   seg.name,
          tooltip: `${seg.name}\n${seat.label}\n${fmt(seg.start)} – ${fmt(seg.end)}`,
        }));
      });
    }));
  });

  // ── Governor appointments ──────────────────────────────────────────────────
  labelCol.appendChild(makeLabelHeader('Governor Appts.'));
  canvas.appendChild(makeTrackHeader('Governor Appointments — 9 Seats'));

  labelCol.appendChild(makeLabel('Gov. Appts. (9)'));
  canvas.appendChild(makeTrackRow(track => {
    track.appendChild(makeBar({
      left: 0, width: totalWidth(),
      color: '#6baed6',
      label: '9 Governor Appointments',
      tooltip: GOV_MEMBERS.join('\n'),
    }));
  }));

  // ── Higher Education ───────────────────────────────────────────────────────
  labelCol.appendChild(makeLabelHeader('Higher Education'));
  canvas.appendChild(makeTrackHeader('Higher Education — 1 Seat'));

  labelCol.appendChild(makeLabel('UVU'));
  canvas.appendChild(makeTrackRow(track => {
    track.appendChild(makeBar({
      left: 0, width: totalWidth(),
      color: '#74c476',
      label: 'Brad Herbert – Utah Valley University',
      tooltip: 'Brad Herbert\nUtah Valley University\nHigher Education Partner',
    }));
  }));

  // ── Today marker ───────────────────────────────────────────────────────────
  const markerLayer = document.createElement('div');
  markerLayer.className = 'marker-layer';
  markerLayer.style.width = totalWidth() + 'px';
  canvas.appendChild(markerLayer);

  requestAnimationFrame(() => {
    markerLayer.style.height = canvas.scrollHeight + 'px';
    const todayX = dateToX(new Date());
    const line   = document.createElement('div');
    line.className = 'today-marker';
    line.style.left = todayX + 'px';
    line.title = 'Today — ' + fmt(new Date());
    const todayLbl = document.createElement('span');
    todayLbl.className = 'today-label';
    todayLbl.textContent = 'Today';
    line.appendChild(todayLbl);
    markerLayer.appendChild(line);
  });

  // Scroll to show today; sync vertical scroll from wrapper → label col
  wrapper.scrollLeft = Math.max(0, dateToX(new Date()) - 220);
  wrapper.onscroll = () => { labelCol.scrollTop = wrapper.scrollTop; };
}

// ─── INIT ────────────────────────────────────────────────────────────────────

function init() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      termLength = parseInt(btn.dataset.term);
      renderTimeline();
    });
  });

  renderTimeline();
}

document.addEventListener('DOMContentLoaded', init);
