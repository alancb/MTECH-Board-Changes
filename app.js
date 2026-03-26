// ─── DATA ────────────────────────────────────────────────────────────────────

const YEAR_WIDTH = 88;
const LABEL_W    = 160; // must match .row-label width in CSS
const TIMELINE_START = new Date('2025-01-01');
const TIMELINE_END   = new Date('2041-01-01');
const ROTATION_START = new Date('2029-07-01');

const KEY_EVENTS = [
  {
    date:  new Date('2026-05-06'),
    label: 'SB240 Effective',
    desc:  'Rotation required · 4-seat cap on districts',
    short: "May 6, '26",
    color: '#1d4ed8',
  },
  {
    date:  new Date('2027-07-01'),
    label: 'Alpine District Splits',
    desc:  'Becomes: Aspen Peaks · Lake Mountain · Timpanogos',
    short: "Jul 1, '27",
    color: '#b45309',
  },
  {
    date:  new Date('2029-07-01'),
    label: 'Full Rotation Begins',
    desc:  'All grandfathered terms expire',
    short: "Jul 1, '29",
    color: '#047857',
  },
];

const ALL_DISTRICTS = [
  { id: 'aspen-peaks',   name: 'Aspen Peaks SD',       availableFrom: new Date('2027-07-01') },
  { id: 'lake-mountain', name: 'Lake Mountain SD',      availableFrom: new Date('2027-07-01') },
  { id: 'timpanogos',    name: 'Timpanogos SD',         availableFrom: new Date('2027-07-01') },
  { id: 'nebo',          name: 'Nebo SD',               availableFrom: null },
  { id: 'wasatch',       name: 'Wasatch County SD',     availableFrom: null },
  { id: 'south-summit',  name: 'South Summit SD',       availableFrom: null },
  { id: 'provo',         name: 'Provo SD',              availableFrom: null },
  { id: 'north-summit',  name: 'North Summit SD',       availableFrom: null },
  { id: 'park-city',     name: 'Park City SD',          availableFrom: null },
];

const GRANDFATHERED = [
  { name: 'Julie King',         district: 'alpine',       districtLabel: 'Alpine SD',         termStart: new Date('2025-01-01'), termEnd: new Date('2027-06-30') },
  { name: 'Meredith Reed',      district: 'park-city',    districtLabel: 'Park City SD',      termStart: new Date('2025-01-01'), termEnd: new Date('2027-06-30') },
  { name: 'Rick Ainge',         district: 'nebo',         districtLabel: 'Nebo SD',           termStart: new Date('2025-01-01'), termEnd: new Date('2029-06-30') },
  { name: 'Breanne Dedrickson', district: 'wasatch',      districtLabel: 'Wasatch County SD', termStart: new Date('2025-01-01'), termEnd: new Date('2029-06-30') },
  { name: 'Dan Eckert',         district: 'south-summit', districtLabel: 'South Summit SD',   termStart: new Date('2025-01-01'), termEnd: new Date('2029-06-30') },
  { name: 'Melanie Hall',       district: 'provo',        districtLabel: 'Provo SD',          termStart: new Date('2025-01-01'), termEnd: new Date('2029-06-30') },
  { name: 'Maggie Judi',        district: 'north-summit', districtLabel: 'North Summit SD',   termStart: new Date('2025-01-01'), termEnd: new Date('2029-06-30') },
];

const GOV_MEMBERS = [
  'Marlon Lindsay', 'Scott Barlow', 'Mary Crafts', 'Brian Hulet',
  'Megan Johnson', 'Vanessa Perez', 'Brad Tanner', 'Paul Thompson', 'Eric Weeks',
];

const DISTRICT_COLORS = {
  'alpine':        '#4e79a7',
  'aspen-peaks':   '#59a14f',
  'lake-mountain': '#76b7b2',
  'timpanogos':    '#edc948',
  'nebo':          '#f28e2b',
  'wasatch':       '#e15759',
  'south-summit':  '#b07aa1',
  'provo':         '#ff9da7',
  'north-summit':  '#9c755f',
  'park-city':     '#bab0ac',
};

const GROUP_PALETTE = ['#7c3aed', '#0369a1', '#b45309', '#047857', '#be185d', '#9d174d'];

// ─── STATE ───────────────────────────────────────────────────────────────────

let nextGroupNum = 1;

let state = {
  termLength:    4,
  seats:         4,
  staggered:     false,
  groups:        [],                           // [{id, name, color, termLength:null, districts:[id,…]}]
  districtOrder: ALL_DISTRICTS.map(d => d.id), // canonical ungrouped order
  resignations:  {},                           // { gfIndex: Date }
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const districtById = id => ALL_DISTRICTS.find(d => d.id === id);

function dateToX(date) {
  return Math.round((date - TIMELINE_START) / (365.25 * 24 * 3600 * 1000) * YEAR_WIDTH);
}
const totalWidth = () => dateToX(TIMELINE_END);

function addYears(date, years) {
  const d = new Date(date);
  const whole = Math.floor(years);
  d.setFullYear(d.getFullYear() + whole);
  const rem = years - whole;
  if (rem) d.setDate(d.getDate() + Math.round(rem * 365.25));
  return d;
}

function fmt(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getGroupedIds() {
  return new Set(state.groups.flatMap(g => g.districts));
}

function getUngroupedIds() {
  const grouped = getGroupedIds();
  return state.districtOrder.filter(id => !grouped.has(id));
}

// ─── ROTATION ALGORITHM ───────────────────────────────────────────────────────
//
// Groups each claim one dedicated seat and cycle through their members forever.
// Remaining seats share the ungrouped pool in round-robin order.

function buildGroupSegments(group, seatStart, globalTermLength) {
  if (!group.districts.length) return [];
  const tl = group.termLength ?? globalTermLength; // per-group override or inherit global
  const segs = [];
  let t = new Date(seatStart), idx = 0;
  while (t < TIMELINE_END) {
    const distId = group.districts[idx % group.districts.length];
    const end    = addYears(t, tl);
    segs.push({ districtId: distId, start: new Date(t), end: end < TIMELINE_END ? end : new Date(TIMELINE_END), groupLabel: group.name });
    t = end; idx++;
  }
  return segs;
}

function buildGlobalSegments(ungrouped, seatIdx, totalGlobal, seatStart, termLength) {
  if (!totalGlobal || !ungrouped.length) return [];
  const segs = [];
  let t = new Date(seatStart), termIdx = 0;
  while (t < TIMELINE_END) {
    const available = ungrouped.filter(id => {
      const d = districtById(id);
      return !d || !d.availableFrom || d.availableFrom <= t;
    });
    if (available.length) {
      const idx = (seatIdx + termIdx * totalGlobal) % available.length;
      const end = addYears(t, termLength);
      segs.push({ districtId: available[idx], start: new Date(t), end: end < TIMELINE_END ? end : new Date(TIMELINE_END) });
    }
    t = addYears(t, termLength); termIdx++;
  }
  return segs;
}

function buildAllSeats() {
  const { termLength, staggered, seats, groups } = state;
  const ungrouped    = getUngroupedIds();
  const numGroupSeats = Math.min(groups.length, seats);
  const numGlobal    = seats - numGroupSeats;

  return Array.from({ length: seats }, (_, i) => {
    const offset    = staggered ? i * termLength / seats : 0;
    const seatStart = addYears(ROTATION_START, offset);
    if (i < numGroupSeats) {
      return { type: 'group', group: groups[i], segments: buildGroupSegments(groups[i], seatStart, termLength) };
    }
    return { type: 'global', segments: buildGlobalSegments(ungrouped, i - numGroupSeats, numGlobal, seatStart, termLength) };
  });
}

// ─── BAR FACTORY ─────────────────────────────────────────────────────────────

function makeBar({ left, width, color, label, sublabel, tooltip, hatched = false }) {
  const bar = document.createElement('div');
  bar.className = 'bar' + (hatched ? ' bar-hatched' : '');
  bar.style.left  = left + 'px';
  bar.style.width = Math.max(width - 2, 4) + 'px';
  bar.style.backgroundColor = color || '#ccc';
  if (tooltip) bar.title = tooltip;
  if (label && width > 38) {
    const s = document.createElement('span');
    s.className = 'bar-label'; s.textContent = label;
    bar.appendChild(s);
  }
  if (sublabel && width > 90) {
    const s = document.createElement('span');
    s.className = 'bar-sublabel'; s.textContent = sublabel;
    bar.appendChild(s);
  }
  return bar;
}

// ─── TIMELINE RENDER ─────────────────────────────────────────────────────────

function renderTimeline() {
  const { termLength, seats, staggered, groups } = state;
  const tl = document.getElementById('timeline-canvas');
  tl.innerHTML = '';
  tl.style.minWidth = totalWidth() + 'px';

  const seatData      = buildAllSeats();
  const numGroupSeats = Math.min(groups.length, seats);
  const totalRows     = Math.max(GRANDFATHERED.length, seats);

  // ── Year header (year numbers only) ──────────────────────────────────────
  const yearHdr = document.createElement('div');
  yearHdr.className = 'year-header';
  yearHdr.style.width = totalWidth() + 'px';
  for (let y = TIMELINE_START.getFullYear(); y < TIMELINE_END.getFullYear(); y++) {
    const tick = document.createElement('span');
    tick.className = 'year-tick';
    tick.style.left = (dateToX(new Date(y, 0, 1)) + LABEL_W) + 'px';
    tick.textContent = y;
    yearHdr.appendChild(tick);
  }
  tl.appendChild(yearHdr);

  // ── Milestone row (key events, two staggered rows so nothing overlaps) ───
  // Row 0 (top: 4px) : SB240 (x≈120) and Full Rotation (x≈396) — far apart
  // Row 1 (top: 24px): Alpine Split (x≈220) — between the other two
  const msRow = document.createElement('div');
  msRow.className = 'milestone-row';
  msRow.style.width = totalWidth() + 'px';
  KEY_EVENTS.forEach((ev, i) => {
    const ms = document.createElement('div');
    ms.className = 'milestone';
    ms.style.left = (dateToX(ev.date) + LABEL_W) + 'px';
    ms.style.top  = (i === 1 ? 24 : 4) + 'px';
    ms.style.setProperty('--ec', ev.color);
    ms.title = `${ev.label} — ${fmt(ev.date)}\n${ev.desc}`;
    ms.innerHTML =
      `<span class="ms-dot"></span>` +
      `<span class="ms-text"><b>${ev.label}</b><small>${ev.short}</small></span>`;
    msRow.appendChild(ms);
  });
  tl.appendChild(msRow);

  // ── School District rows ──────────────────────────────────────────────────
  addSectionHeader(tl, `School District Seats (up to ${seats} rotating)`);

  for (let i = 0; i < totalRows; i++) {
    const gf       = GRANDFATHERED[i];
    const seatNum  = i + 1;
    const inRot    = i < seats;
    const rowLabel = inRot && i < numGroupSeats ? groups[i].name : `Seat ${seatNum}`;

    addRow(tl, rowLabel, track => {
      // Grandfathered bar
      if (gf) {
        const resignDate   = state.resignations[i];
        const effectiveEnd = resignDate && resignDate < gf.termEnd ? resignDate : gf.termEnd;
        const resigned     = effectiveEnd !== gf.termEnd;
        const left  = dateToX(gf.termStart);
        const width = dateToX(effectiveEnd) - left;
        const sub   = gf.districtLabel + (gf.district === 'alpine' ? ' (\u2192 splits Jul \u201927)' : '');
        track.appendChild(makeBar({
          left, width,
          color:    DISTRICT_COLORS[gf.district] || '#aaa',
          label:    gf.name,
          sublabel: resigned ? sub + ' \u00b7 Resigned' : sub,
          tooltip:  resigned
            ? `${gf.name}\n${gf.districtLabel}\n${fmt(gf.termStart)} \u2013 ${fmt(effectiveEnd)}\nResigned early (term was through ${fmt(gf.termEnd)})`
            : `${gf.name}\n${gf.districtLabel}\n${fmt(gf.termStart)} \u2013 ${fmt(gf.termEnd)}\nGrandfathered under SB240`,
        }));
        // Vacant gap: from effective end to rotation start for this seat
        if (inRot) {
          const offset    = staggered ? i * termLength / seats : 0;
          const seatStart = addYears(ROTATION_START, offset);
          const gapLeft   = dateToX(effectiveEnd);
          const gapW      = dateToX(seatStart) - gapLeft;
          if (gapW > 2) track.appendChild(makeBar({
            left: gapLeft, width: gapW, color: '#e4e4e4', hatched: true,
            tooltip: resigned ? `Seat vacant \u2014 ${gf.name} resigned ${fmt(effectiveEnd)}` : 'Seat vacant',
          }));
        }
      } else if (inRot) {
        const offset    = staggered ? i * termLength / seats : 0;
        const seatStart = addYears(ROTATION_START, offset);
        const gapW      = dateToX(seatStart);
        if (gapW > 2) track.appendChild(makeBar({ left: 0, width: gapW, color: '#ececec', tooltip: 'Seat not yet active', hatched: true }));
      }

      // Rotation bars
      if (inRot) {
        seatData[i].segments.forEach(seg => {
          const info  = districtById(seg.districtId);
          const left  = dateToX(seg.start);
          const width = dateToX(seg.end) - left;
          const tip   = [
            info ? info.name : seg.districtId,
            seg.groupLabel ? `Part of group: ${seg.groupLabel}` : '',
            `Rotation Seat ${seatNum}`,
            `${fmt(seg.start)} \u2013 ${fmt(seg.end)}`,
          ].filter(Boolean).join('\n');
          track.appendChild(makeBar({
            left, width,
            color:    DISTRICT_COLORS[seg.districtId] || '#999',
            label:    info ? info.name : seg.districtId,
            sublabel: seg.groupLabel ? seg.groupLabel : '',
            tooltip:  tip,
          }));
        });
      }
    });
  }

  // ── Governor Appointments ─────────────────────────────────────────────────
  addSectionHeader(tl, 'Governor Appointments (9 seats)');
  addRow(tl, 'Gov. Appts.', track => {
    track.appendChild(makeBar({
      left: 0, width: totalWidth(),
      color:   '#6baed6',
      label:   '9 Governor Appointments',
      tooltip: GOV_MEMBERS.join('\n'),
    }));
  });

  // ── Higher Education ──────────────────────────────────────────────────────
  addSectionHeader(tl, 'Higher Education (1 seat)');
  addRow(tl, 'UVU', track => {
    track.appendChild(makeBar({
      left: 0, width: totalWidth(),
      color:   '#74c476',
      label:   'Brad Herbert \u2013 Utah Valley University',
      tooltip: 'Brad Herbert\nUtah Valley University\nHigher Education Partner',
    }));
  });

  // ── Marker layer (Today + Events) ─────────────────────────────────────────
  const markerLayer = document.createElement('div');
  markerLayer.className = 'marker-layer';
  markerLayer.style.width = totalWidth() + 'px';
  tl.appendChild(markerLayer);

  requestAnimationFrame(() => {
    markerLayer.style.height = (tl.scrollHeight + 20) + 'px';

    // Today line
    const todayX    = dateToX(new Date()) + LABEL_W;
    const todayLine = document.createElement('div');
    todayLine.className = 'today-marker';
    todayLine.style.left = todayX + 'px';
    todayLine.title = 'Today \u2014 ' + fmt(new Date());
    const todayLbl = document.createElement('span');
    todayLbl.className = 'today-label';
    todayLbl.textContent = 'Today';
    todayLine.appendChild(todayLbl);
    markerLayer.appendChild(todayLine);

  });
}

function addSectionHeader(container, title) {
  const h = document.createElement('div');
  h.className = 'section-header';
  h.textContent = title;
  container.appendChild(h);
}

function addRow(container, label, fill) {
  const row = document.createElement('div');
  row.className = 'timeline-row';
  const lbl = document.createElement('div');
  lbl.className = 'row-label';
  lbl.textContent = label;
  lbl.title = label;
  row.appendChild(lbl);
  const track = document.createElement('div');
  track.className = 'track';
  track.style.width = totalWidth() + 'px';
  fill(track);
  row.appendChild(track);
  container.appendChild(row);
}

// ─── SETTINGS PANEL ──────────────────────────────────────────────────────────

function buildSettingsPanel() {
  buildGroupsSection();
  buildUngroupedList();
  buildResignationsSection();
}

function buildResignationsSection() {
  const area = document.getElementById('resignations-area');
  if (!area) return;
  area.innerHTML = '';

  GRANDFATHERED.forEach((member, i) => {
    const hasResignation = state.resignations[i] instanceof Date;

    const row = document.createElement('div');
    row.className = 'resignation-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id   = `resign-chk-${i}`;
    cb.checked = hasResignation;
    row.appendChild(cb);

    const lbl = document.createElement('label');
    lbl.htmlFor = `resign-chk-${i}`;
    lbl.className = 'resignation-label';
    lbl.innerHTML = `<span class="resignation-name">${member.name}</span>`
                  + `<span class="resignation-dist">${member.districtLabel} &middot; through ${fmt(member.termEnd)}</span>`;
    row.appendChild(lbl);

    const dateInp = document.createElement('input');
    dateInp.type  = 'date';
    dateInp.className = 'resignation-date';
    dateInp.min   = '2025-01-01';
    dateInp.max   = member.termEnd.toISOString().slice(0, 10);
    dateInp.style.display = hasResignation ? '' : 'none';
    if (hasResignation) {
      dateInp.value = state.resignations[i].toISOString().slice(0, 10);
    } else {
      // Default: midpoint between today and term end
      const mid = new Date((Date.now() + member.termEnd.getTime()) / 2);
      dateInp.value = (mid < member.termEnd ? mid : member.termEnd).toISOString().slice(0, 10);
    }

    cb.addEventListener('change', () => {
      if (cb.checked) {
        state.resignations[i] = new Date(dateInp.value);
        dateInp.style.display = '';
      } else {
        delete state.resignations[i];
        dateInp.style.display = 'none';
      }
      renderTimeline();
    });

    dateInp.addEventListener('change', () => {
      if (cb.checked && dateInp.value) {
        state.resignations[i] = new Date(dateInp.value);
        renderTimeline();
      }
    });

    row.appendChild(dateInp);
    area.appendChild(row);
  });
}

function buildGroupsSection() {
  const area = document.getElementById('groups-area');
  area.innerHTML = '';
  const { seats, groups } = state;

  groups.forEach((group, gi) => {
    const hasSeat = gi < seats;

    const block = document.createElement('div');
    block.className = 'group-block';
    block.dataset.groupId = group.id;
    block.style.setProperty('--gc', group.color);

    // Header row
    const hdr = document.createElement('div');
    hdr.className = 'group-header';

    const dot = document.createElement('span');
    dot.className = 'group-dot';
    dot.style.backgroundColor = group.color;
    hdr.appendChild(dot);

    const inp = document.createElement('input');
    inp.className = 'group-name-input';
    inp.value = group.name;
    inp.addEventListener('input',  () => renameGroup(group.id, inp.value));
    inp.addEventListener('click',  e => e.stopPropagation());
    hdr.appendChild(inp);

    // Per-group term length
    const termSel = document.createElement('select');
    termSel.className = 'group-term-select';
    termSel.title = 'Term length for this group (overrides global)';
    [{ v: '', l: `Global (${state.termLength}yr)` }, { v:1,l:'1 yr' }, { v:2,l:'2 yr' },
     { v:3,l:'3 yr' }, { v:4,l:'4 yr' }, { v:5,l:'5 yr' }, { v:6,l:'6 yr' }].forEach(({ v, l }) => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = l;
      if ((group.termLength ?? '') == v) opt.selected = true;
      termSel.appendChild(opt);
    });
    termSel.addEventListener('change', e => {
      const g = state.groups.find(g => g.id === group.id);
      if (g) { g.termLength = e.target.value ? +e.target.value : null; renderTimeline(); }
    });
    termSel.addEventListener('click', e => e.stopPropagation());
    hdr.appendChild(termSel);

    const badge = document.createElement('span');
    badge.className = 'group-seat-badge';
    badge.textContent = hasSeat ? `Seat ${gi + 1}` : 'No seat';
    badge.style.backgroundColor = hasSeat ? group.color : '#aaa';
    hdr.appendChild(badge);

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Delete group — districts return to pool';
    delBtn.addEventListener('click', () => deleteGroup(group.id));
    hdr.appendChild(delBtn);

    block.appendChild(hdr);

    // Members list
    const memberList = document.createElement('div');
    memberList.className = 'group-members';
    memberList.dataset.groupId = group.id;

    if (!group.districts.length) {
      const hint = document.createElement('div');
      hint.className = 'group-empty-hint';
      hint.textContent = 'No districts — use + buttons below';
      memberList.appendChild(hint);
    } else {
      group.districts.forEach(distId => {
        const d    = districtById(distId);
        const item = document.createElement('div');
        item.className = 'district-item';
        item.dataset.id = distId;
        item.draggable = true;

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.textContent = '\u28bf';
        item.appendChild(handle);

        const ddot = document.createElement('span');
        ddot.className = 'district-dot';
        ddot.style.backgroundColor = DISTRICT_COLORS[distId] || '#ccc';
        item.appendChild(ddot);

        const name = document.createElement('span');
        name.className = 'district-name';
        name.textContent = d ? d.name : distId;
        if (d?.availableFrom) {
          const note = document.createElement('span');
          note.className = 'district-note';
          note.textContent = ' (from Jul \u201927)';
          name.appendChild(note);
        }
        item.appendChild(name);

        const rmBtn = document.createElement('button');
        rmBtn.className = 'icon-btn remove-btn';
        rmBtn.textContent = '×';
        rmBtn.title = 'Remove from group';
        rmBtn.addEventListener('click', () => removeFromGroup(distId));
        item.appendChild(rmBtn);

        memberList.appendChild(item);
      });

      // Within-group drag reorder
      setupSortable(memberList, () => {
        const g = state.groups.find(g => g.id === group.id);
        if (g) {
          g.districts = [...memberList.querySelectorAll('.district-item')].map(el => el.dataset.id);
          renderTimeline();
        }
      });
    }

    block.appendChild(memberList);
    area.appendChild(block);
  });
}

function buildUngroupedList() {
  const list      = document.getElementById('district-list');
  const sublabel  = document.getElementById('ungrouped-label');
  const ungrouped = getUngroupedIds();
  const hasGroups = state.groups.length > 0;
  list.innerHTML  = '';
  sublabel.style.display = hasGroups ? '' : 'none';

  ungrouped.forEach(id => {
    const d    = districtById(id);
    const item = document.createElement('div');
    item.className = 'district-item';
    item.dataset.id = id;
    item.draggable  = true;

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '\u28bf';
    item.appendChild(handle);

    const dot = document.createElement('span');
    dot.className = 'district-dot';
    dot.style.backgroundColor = DISTRICT_COLORS[id] || '#ccc';
    item.appendChild(dot);

    const name = document.createElement('span');
    name.className = 'district-name';
    name.textContent = d ? d.name : id;
    if (d?.availableFrom) {
      const note = document.createElement('span');
      note.className = 'district-note';
      note.textContent = ' (from Jul \u201927)';
      name.appendChild(note);
    }
    item.appendChild(name);

    if (hasGroups) {
      const sel = document.createElement('select');
      sel.className = 'group-assign-select';
      sel.title = 'Add to group';
      const dflt = document.createElement('option');
      dflt.value = ''; dflt.textContent = '+ group';
      sel.appendChild(dflt);
      state.groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id; opt.textContent = g.name;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => { if (sel.value) addToGroup(id, sel.value); });
      item.appendChild(sel);
    }

    list.appendChild(item);
  });

  setupSortable(list, () => {
    const grouped = getGroupedIds();
    const newOrder = [...list.querySelectorAll('.district-item')].map(el => el.dataset.id);
    // Keep grouped districts at end of districtOrder (their position doesn't matter for ungrouped)
    state.districtOrder = [
      ...newOrder,
      ...state.districtOrder.filter(id => grouped.has(id)),
    ];
    renderTimeline();
  });
}

// ─── DRAG-SORT ────────────────────────────────────────────────────────────────

function setupSortable(listEl, onDone) {
  let dragging = null;
  listEl.querySelectorAll('.district-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragging = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      dragging = null;
      onDone();
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragging || dragging === item || dragging.parentElement !== listEl) return;
      const { top, height } = item.getBoundingClientRect();
      listEl.insertBefore(dragging, e.clientY < top + height / 2 ? item : item.nextSibling);
    });
  });
}

// ─── GROUP ACTIONS ────────────────────────────────────────────────────────────

function createGroup() {
  const id    = 'group-' + Date.now();
  const color = GROUP_PALETTE[state.groups.length % GROUP_PALETTE.length];
  state.groups.push({ id, name: `Group ${nextGroupNum++}`, color, districts: [] });
  buildSettingsPanel();
  renderTimeline();
}

function deleteGroup(groupId) {
  state.groups = state.groups.filter(g => g.id !== groupId);
  buildSettingsPanel();
  renderTimeline();
}

function addToGroup(districtId, groupId) {
  state.groups.forEach(g => g.districts = g.districts.filter(d => d !== districtId));
  const g = state.groups.find(g => g.id === groupId);
  if (g) g.districts.push(districtId);
  buildSettingsPanel();
  renderTimeline();
}

function removeFromGroup(districtId) {
  state.groups.forEach(g => g.districts = g.districts.filter(d => d !== districtId));
  buildSettingsPanel();
  renderTimeline();
}

function renameGroup(groupId, newName) {
  const g = state.groups.find(g => g.id === groupId);
  if (g) { g.name = newName; renderTimeline(); } // don't rebuild settings panel — that kills the input focus
}

// ─── INIT ────────────────────────────────────────────────────────────────────

function init() {
  const termSel     = document.getElementById('term-length');
  const seatSlider  = document.getElementById('seat-count');
  const seatDisplay = document.getElementById('seat-display');

  termSel.value = state.termLength;
  termSel.addEventListener('change', () => { state.termLength = +termSel.value; renderTimeline(); });

  seatSlider.value = state.seats;
  seatDisplay.textContent = state.seats;
  seatSlider.addEventListener('input', () => {
    state.seats = +seatSlider.value;
    seatDisplay.textContent = state.seats;
    buildGroupsSection(); // update seat badges
    renderTimeline();
  });

  document.querySelectorAll('input[name="turnover"]').forEach(r => {
    r.addEventListener('change', () => {
      state.staggered = document.querySelector('input[name="turnover"]:checked').value === 'staggered';
      renderTimeline();
    });
  });

  document.getElementById('add-group-btn').addEventListener('click', createGroup);

  buildSettingsPanel();
  renderTimeline();

  // Scroll to near current date
  const wrapper = document.getElementById('timeline-wrapper');
  wrapper.scrollLeft = Math.max(0, dateToX(new Date()) + LABEL_W - 200);
}

document.addEventListener('DOMContentLoaded', init);
