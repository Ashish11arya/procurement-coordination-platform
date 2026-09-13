/**
 * National Procurement Coordination Platform - Frontend Application Logic
 * Implements Sections 27, 28, 29, 30 & 42
 */

// ============================================================================
// 1. Bilingual Localization Dictionary (Section 27)
// ============================================================================
const i18n = {
  en: {
    appTitle: 'Department of Agriculture & Farmers Welfare',
    appSubtitle: 'Government-Grade Real-Time Procurement Coordination System (MSP Operations)',
    connStatus: 'Live Connected',
    navFarmer: 'Farmer Portal (किसान)',
    navCentre: 'Mandi Operations & Yard (मंडी नियंत्रण)',
    navCommand: 'Government Command Centre (राज्य कमान केंद्र)',
    farmerGreeting: 'Namaste, Ramesh Verma',
    farmerMeta: 'Registration: MP-2026-IND-09823 | Mobile: +91-9876543210',
    landMeta: '✓ Verified Landholding: 8.5 Acres (Indore, MP)',
    newBookingBtn: '+ New Booking (नई बुकिंग)',
    activeTokenTitle: "TODAY'S PROCUREMENT TOKEN",
    tokenSub: 'Booking ID: BK-DEMO-001',
    lblCentre: 'Procurement Centre',
    valCentre: 'Sanwer Krishi Upaj Mandi (सांवेर)',
    lblWindow: 'Arrival Window',
    valWindow: 'Today, 10:00 AM - 11:00 AM',
    lblCommodity: 'Commodity & Quantity',
    valCommodity: 'Wheat (गेहूं) - 30.0 Quintals',
    lblStatus: 'Current Status',
    timelineTitle: 'Live 4-Stage Yard Processing Tracker',
    timelineSub: 'Live physical progress of vehicle MP-09-AB-1234 inside Sanwer Mandi',
    stg1Name: 'Gate Check-in',
    stg1Desc: 'Token & Document Verified',
    stg2Name: 'Weighbridge',
    stg2Desc: 'Gross Tare Weight (Scale 1)',
    stg3Name: 'Quality Assay',
    stg3Desc: 'Moisture & Foreign Matter Lab',
    stg4Name: 'Procurement & Payment',
    stg4Desc: 'Payment Advice Dispatched',
    lblLiveEta: 'Current Estimated Finish ETA',
    lblAhead: 'Vehicles Ahead at Weighbridge',
    lblMsp: 'Estimated MSP Payout',
    centreHeader: 'Sanwer Krishi Upaj Mandi (सांवेर कृषि उपज मंडी)',
    centreLocation: 'Khandwa-Ujjain Highway, Sanwer, Indore District, Madhya Pradesh',
  },
  hi: {
    appTitle: 'कृषि एवं किसान कल्याण विभाग',
    appSubtitle: 'सरकारी वास्तविक समय खरीद समन्वय एवं टोकन शेड्यूलिंग प्रणाली (न्यूनतम समर्थन मूल्य)',
    connStatus: 'सक्रिय जुड़ाव (लाइव)',
    navFarmer: 'किसान पोर्टल (Farmer)',
    navCentre: 'मंडी संचालन एवं यार्ड नियंत्रण',
    navCommand: 'राज्य कमान केंद्र (Dashboard)',
    farmerGreeting: 'नमस्ते, रमेश वर्मा जी',
    farmerMeta: 'पंजीकरण: MP-2026-IND-09823 | मोबाइल: +91-9876543210',
    landMeta: '✓ सत्यापित भूमि स्वामित्व: 8.5 एकड़ (सांवेर, इंदौर)',
    newBookingBtn: '+ नई फसल बुकिंग करें',
    activeTokenTitle: 'आज का खरीद टोकन संख्या',
    tokenSub: 'बुकिंग पहचान: BK-DEMO-001',
    lblCentre: 'खरीद केंद्र',
    valCentre: 'सांवेर कृषि उपज मंडी (इंदौर)',
    lblWindow: 'आवंटित आगमन समय',
    valWindow: 'आज, सुबह 10:00 - 11:00 बजे',
    lblCommodity: 'फसल एवं मात्रा',
    valCommodity: 'गेहूं (Wheat) - 30.0 क्विंटल',
    lblStatus: 'वर्तमान स्थिति',
    timelineTitle: 'लाइव 4-चरणीय यार्ड प्रसंस्करण ट्रैकर',
    timelineSub: 'सांवेर मंडी प्रांगण में वाहन MP-09-AB-1234 की भौतिक प्रगति',
    stg1Name: 'गेट प्रवेश व सत्यापन',
    stg1Desc: 'टोकन व दस्तावेज की जांच पूर्ण',
    stg2Name: 'इलेक्ट्रॉनिक धर्मकांटा',
    stg2Desc: 'वाहन वजन प्रक्रिया (कांटा 1)',
    stg3Name: 'गुणवत्ता परीक्षण लैब',
    stg3Desc: 'नमी व अपमिश्रण मानक जांच',
    stg4Name: 'खरीद पावती व भुगतान',
    stg4Desc: 'डीबीटी भुगतान सलाह जारी',
    lblLiveEta: 'अनुमानित कार्य समाप्ति समय',
    lblAhead: 'धर्मकांटे पर आगे खड़े वाहन',
    lblMsp: 'अनुमानित एमएसपी भुगतान राशि',
    centreHeader: 'सांवेर कृषि उपज मंडी (CENTRE-MP-IND-01)',
    centreLocation: 'खंडवा-उज्जैन राष्ट्रीय राजमार्ग, सांवेर, जिला इंदौर, मध्य प्रदेश',
  },
};

let currentLang = 'en';

// ============================================================================
// 2. Initial State & Realistic Mandi Datasets (Section 42)
// ============================================================================
const initialCounters = [
  { id: 'CTR-CHK-01', name: 'Gate 1 Entry & Token Scanner', stage: 'CHECKIN', cap: 50, queue: 1, status: 'ACTIVE' },
  { id: 'CTR-WEIGH-01', name: 'Weighbridge 1 (Heavy Vehicle Scale)', stage: 'WEIGHING', cap: 30, queue: 1, status: 'ACTIVE' },
  { id: 'CTR-WEIGH-02', name: 'Weighbridge 2 (Tractor Trolley Scale)', stage: 'WEIGHING', cap: 25, queue: 0, status: 'ACTIVE' },
  { id: 'CTR-QUAL-01', name: 'Quality Testing & Moisture Lab', stage: 'QUALITY', cap: 40, queue: 0, status: 'ACTIVE' },
  { id: 'CTR-PROC-01', name: 'Procurement Slip & Payment Desk', stage: 'PROCUREMENT', cap: 50, queue: 0, status: 'ACTIVE' },
];

let counters = JSON.parse(JSON.stringify(initialCounters));

let roster = [
  { token: 'T-001', name: 'Ramesh Verma', qty: '30.0 Q (Wheat)', window: '10:00 - 11:00 AM', status: 'IN_YARD', stage: 'Weighbridge 1 (Gross Weight)' },
  { token: 'T-002', name: 'Suresh Patel', qty: '25.0 Q (Wheat)', window: '10:00 - 11:00 AM', status: 'CHECKED_IN', stage: 'Arrived Late (+35m) - In Buffer Queue' },
  { token: 'T-003', name: 'Anil Choudhary', qty: '40.0 Q (Wheat)', window: '09:00 - 10:00 AM', status: 'COMPLETED', stage: 'Quality Grade A (11.4% Moisture) - Paid' },
  { token: 'T-004', name: 'Vikram Singh', qty: '40.0 Q (Wheat)', window: '10:00 - 11:00 AM', status: 'CONFIRMED', stage: 'En Route to Mandi' },
  { token: 'T-005', name: 'Mukesh Sharma', qty: '20.0 Q (Wheat)', window: '10:00 - 11:00 AM', status: 'CONFIRMED', stage: 'En Route to Mandi' },
  { token: 'T-010', name: 'Gopal Dangi', qty: '25.0 Q (Wheat)', window: '12:00 - 01:00 PM', status: 'BOOKED', stage: 'Scheduled Slot 3' },
  { token: 'T-011', name: 'Kailash Meena', qty: '50.0 Q (Wheat)', window: '12:00 - 01:00 PM', status: 'BOOKED', stage: 'Scheduled Slot 3' },
];

let isCounter2Broken = false;
let isCancelled = false;

// ============================================================================
// 3. View Switcher & Navigation
// ============================================================================
function switchView(viewId) {
  document.querySelectorAll('.view-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));

  const targetPanel = document.getElementById(`view-${viewId}`);
  const targetTab = document.getElementById(`nav-${viewId}`);

  if (targetPanel) targetPanel.classList.add('active');
  if (targetTab) targetTab.classList.add('active');
}

// ============================================================================
// 4. Bilingual Language Switcher
// ============================================================================
function switchLanguage(lang) {
  currentLang = lang;
  document.getElementById('btn-lang-en').classList.toggle('active', lang === 'en');
  document.getElementById('btn-lang-hi').classList.toggle('active', lang === 'hi');

  const t = i18n[lang];
  document.getElementById('txt-app-title').textContent = t.appTitle;
  document.getElementById('txt-app-subtitle').textContent = t.appSubtitle;
  document.getElementById('txt-conn-status').textContent = t.connStatus;
  document.getElementById('txt-nav-farmer').textContent = t.navFarmer;
  document.getElementById('txt-nav-centre').textContent = t.navCentre;
  document.getElementById('txt-nav-command').textContent = t.navCommand;

  document.getElementById('txt-farmer-greeting').textContent = t.farmerGreeting;
  document.getElementById('txt-farmer-meta').textContent = t.farmerMeta;
  document.getElementById('txt-land-meta').textContent = t.landMeta;
  document.getElementById('btn-new-booking').textContent = t.newBookingBtn;

  document.getElementById('txt-active-token-title').textContent = t.activeTokenTitle;
  document.getElementById('txt-token-sub').textContent = t.tokenSub;
  document.getElementById('lbl-centre').textContent = t.lblCentre;
  document.getElementById('val-centre').textContent = t.valCentre;
  document.getElementById('lbl-window').textContent = t.lblWindow;
  document.getElementById('val-window').textContent = t.valWindow;
  document.getElementById('lbl-commodity').textContent = t.lblCommodity;
  document.getElementById('val-commodity').textContent = t.valCommodity;
  document.getElementById('lbl-status').textContent = t.lblStatus;

  document.getElementById('txt-timeline-title').textContent = t.timelineTitle;
  document.getElementById('txt-timeline-sub').textContent = t.timelineSub;
  document.getElementById('stg-1-name').textContent = t.stg1Name;
  document.getElementById('stg-1-desc').textContent = t.stg1Desc;
  document.getElementById('stg-2-name').textContent = t.stg2Name;
  document.getElementById('stg-2-desc').textContent = t.stg2Desc;
  document.getElementById('stg-3-name').textContent = t.stg3Name;
  document.getElementById('stg-3-desc').textContent = t.stg3Desc;
  document.getElementById('stg-4-name').textContent = t.stg4Name;
  document.getElementById('stg-4-desc').textContent = t.stg4Desc;

  document.getElementById('lbl-live-eta').textContent = t.lblLiveEta;
  document.getElementById('lbl-ahead').textContent = t.lblAhead;
  document.getElementById('lbl-msp').textContent = t.lblMsp;

  document.getElementById('txt-centre-header').textContent = t.centreHeader;
  document.getElementById('txt-centre-location').textContent = t.centreLocation;
}

// ============================================================================
// 5. Render Tables (Counters & Vehicle Roster)
// ============================================================================
function renderCounters() {
  const tbody = document.getElementById('counters-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  let activeCount = 0;
  counters.forEach((c) => {
    if (c.status === 'ACTIVE') activeCount++;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.id}</strong></td>
      <td>${c.name}</td>
      <td><span class="badge badge-primary">${c.stage}</span></td>
      <td>${c.cap} Q/hr</td>
      <td>${c.queue} Vehicles</td>
      <td>
        <span class="status-pill ${c.status === 'ACTIVE' ? 'status-active' : 'status-maintenance'}">
          ${c.status}
        </span>
      </td>
      <td>
        <button class="btn btn-sm ${c.status === 'ACTIVE' ? 'btn-danger' : 'btn-primary'}" onclick="toggleSingleCounter('${c.id}')">
          ${c.status === 'ACTIVE' ? 'Mark Fault' : 'Restore'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const countBadge = document.getElementById('badge-counter-count');
  if (countBadge) countBadge.textContent = `${activeCount} Counters Active`;
}

function renderRoster() {
  const tbody = document.getElementById('roster-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  roster.forEach((r) => {
    const tr = document.createElement('tr');
    let pillClass = 'status-waiting';
    if (r.status === 'IN_YARD' || r.status === 'CHECKED_IN') pillClass = 'status-active';
    if (r.status === 'COMPLETED') pillClass = 'status-completed';
    if (r.status === 'CANCELLED' || r.status === 'NO_SHOW') pillClass = 'status-maintenance';

    tr.innerHTML = `
      <td><strong style="font-size: 1.05rem; color: var(--gov-navy);">${r.token}</strong></td>
      <td><strong>${r.name}</strong></td>
      <td>${r.qty}</td>
      <td>${r.window}</td>
      <td><span class="status-pill ${pillClass}">${r.status}</span></td>
      <td><small style="color: var(--text-secondary);">${r.stage}</small></td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================================================
// 6. Real-World Mandi Simulation Interactions (Section 42)
// ============================================================================
function toggleCounterBreakdown() {
  isCounter2Broken = !isCounter2Broken;
  const c2 = counters.find((c) => c.id === 'CTR-WEIGH-02');
  const alertBanner = document.getElementById('capacity-alert-banner');
  const btn = document.getElementById('btn-toggle-counter');

  if (isCounter2Broken) {
    if (c2) c2.status = 'MAINTENANCE';
    alertBanner.style.display = 'flex';
    btn.textContent = '✓ Restore Counter 2 (Bring Weighbridge 2 Online)';
    btn.className = 'btn btn-primary';

    // Update yard metrics
    document.getElementById('val-throughput').textContent = '30 Q / hr';
    document.getElementById('bar-throughput').style.width = '45%';
    document.getElementById('val-bottleneck-status').textContent = '⚠️ Throughput Derated';
    document.getElementById('val-bottleneck-status').className = 'text-amber';

    // Update farmer live ETA
    document.getElementById('val-live-eta').textContent = '10:52 AM (+17m delay)';
    document.getElementById('sub-eta-normal').textContent = '⚠️ Weighbridge bottleneck active';
    document.getElementById('sub-eta-normal').style.color = 'var(--gov-amber)';

    // Update Command Centre
    document.getElementById('cmd-warning-count').textContent = '1 Mandi';
    document.getElementById('cmd-warning-sub').textContent = 'Sanwer Mandi: Weighbridge 2 Down';
    document.getElementById('cmd-sanwer-counters').textContent = '4 / 5 Operational';
    document.getElementById('cmd-sanwer-status').textContent = 'BOTTLENECK';
    document.getElementById('cmd-sanwer-status').className = 'status-pill status-maintenance';
  } else {
    if (c2) c2.status = 'ACTIVE';
    alertBanner.style.display = 'none';
    btn.textContent = '⚠️ Simulate Counter 2 Breakdown (Weighbridge 2 Offline)';
    btn.className = 'btn btn-danger';

    document.getElementById('val-throughput').textContent = '55 Q / hr';
    document.getElementById('bar-throughput').style.width = '85%';
    document.getElementById('val-bottleneck-status').textContent = 'Optimal Flow';
    document.getElementById('val-bottleneck-status').className = 'text-success';

    document.getElementById('val-live-eta').textContent = '10:35 AM';
    document.getElementById('sub-eta-normal').textContent = 'On track (No active mandi delays)';
    document.getElementById('sub-eta-normal').style.color = 'var(--text-secondary)';

    document.getElementById('cmd-warning-count').textContent = '0 Mandis';
    document.getElementById('cmd-warning-sub').textContent = 'Zero Bottleneck Alerts';
    document.getElementById('cmd-sanwer-counters').textContent = '5 / 5 Operational';
    document.getElementById('cmd-sanwer-status').textContent = 'NORMAL';
    document.getElementById('cmd-sanwer-status').className = 'status-pill status-active';
  }

  renderCounters();
}

function triggerFarmerCancellation() {
  if (isCancelled) return;
  isCancelled = true;

  // 1. Mark T-004 as Cancelled (freeing 40Q in Slot 1)
  const f4 = roster.find((r) => r.token === 'T-004');
  if (f4) {
    f4.status = 'CANCELLED';
    f4.stage = 'Cancelled by Farmer (40Q Freed in Slot 1)';
  }

  // 2. Dynamic Adaptation: Candidate A (T-010, 25Q) moves forward to Slot 1
  const candA = roster.find((r) => r.token === 'T-010');
  if (candA) {
    candA.status = 'CONFIRMED';
    candA.window = '10:00 - 11:00 AM (Moved Forward from Slot 3)';
    candA.stage = 'Dynamic Adaptation: Pulled forward (25Q fits 40Q freed slot, 60m notice valid)';
  }

  // 3. Candidate B (T-011, 50Q) exceeds remaining 15Q -> stays unaltered!
  const candB = roster.find((r) => r.token === 'T-011');
  if (candB) {
    candB.stage = 'Unaltered in Slot 3: Quantity (50Q) exceeds remaining slot capacity (15Q)';
  }

  // Update button state
  const btn = document.getElementById('btn-trigger-cancel');
  btn.textContent = '✓ Cancellation & Dynamic Adaptation Completed';
  btn.disabled = true;

  renderRoster();
}

function resetDemoState() {
  isCounter2Broken = false;
  isCancelled = false;
  counters = JSON.parse(JSON.stringify(initialCounters));

  roster = [
    { token: 'T-001', name: 'Ramesh Verma', qty: '30.0 Q (Wheat)', window: '10:00 - 11:00 AM', status: 'IN_YARD', stage: 'Weighbridge 1 (Gross Weight)' },
    { token: 'T-002', name: 'Suresh Patel', qty: '25.0 Q (Wheat)', window: '10:00 - 11:00 AM', status: 'CHECKED_IN', stage: 'Arrived Late (+35m) - In Buffer Queue' },
    { token: 'T-003', name: 'Anil Choudhary', qty: '40.0 Q (Wheat)', window: '09:00 - 10:00 AM', status: 'COMPLETED', stage: 'Quality Grade A (11.4% Moisture) - Paid' },
    { token: 'T-004', name: 'Vikram Singh', qty: '40.0 Q (Wheat)', window: '10:00 - 11:00 AM', status: 'CONFIRMED', stage: 'En Route to Mandi' },
    { token: 'T-005', name: 'Mukesh Sharma', qty: '20.0 Q (Wheat)', window: '10:00 - 11:00 AM', status: 'CONFIRMED', stage: 'En Route to Mandi' },
    { token: 'T-010', name: 'Gopal Dangi', qty: '25.0 Q (Wheat)', window: '12:00 - 01:00 PM', status: 'BOOKED', stage: 'Scheduled Slot 3' },
    { token: 'T-011', name: 'Kailash Meena', qty: '50.0 Q (Wheat)', window: '12:00 - 01:00 PM', status: 'BOOKED', stage: 'Scheduled Slot 3' },
  ];

  document.getElementById('capacity-alert-banner').style.display = 'none';

  const btnC = document.getElementById('btn-toggle-counter');
  btnC.textContent = '⚠️ Simulate Counter 2 Breakdown (Weighbridge 2 Offline)';
  btnC.className = 'btn btn-danger';

  const btnCancel = document.getElementById('btn-trigger-cancel');
  btnCancel.textContent = '🔄 Simulate Cancellation (Free 40Q Slot 1)';
  btnCancel.disabled = false;

  document.getElementById('val-throughput').textContent = '55 Q / hr';
  document.getElementById('bar-throughput').style.width = '85%';
  document.getElementById('val-bottleneck-status').textContent = 'Optimal Flow';
  document.getElementById('val-bottleneck-status').className = 'text-success';

  document.getElementById('val-live-eta').textContent = '10:35 AM';
  document.getElementById('sub-eta-normal').textContent = 'On track (No active mandi delays)';
  document.getElementById('sub-eta-normal').style.color = 'var(--text-secondary)';

  renderCounters();
  renderRoster();
}

function toggleSingleCounter(counterId) {
  const c = counters.find((x) => x.id === counterId);
  if (!c) return;
  c.status = c.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE';
  renderCounters();
}

// ============================================================================
// 7. Modal & New Booking Creation (Section 28)
// ============================================================================
function openBookingModal() {
  document.getElementById('booking-modal').style.display = 'flex';
}

function closeBookingModal() {
  document.getElementById('booking-modal').style.display = 'none';
}

function handleCreateBooking(event) {
  event.preventDefault();
  const crop = document.getElementById('modal-commodity').value;
  const qty = document.getElementById('modal-qty').value;
  const slotIndex = document.getElementById('modal-slot').value;

  const slotTimes = {
    '1': '10:00 - 11:00 AM',
    '2': '11:00 AM - 12:00 PM',
    '3': '12:00 - 01:00 PM',
    '4': '02:00 - 03:00 PM',
  };

  const newToken = `T-0${roster.length + 1}`;
  roster.push({
    token: newToken,
    name: 'Ramesh Verma (Self)',
    qty: `${qty}.0 Q (${crop})`,
    window: slotTimes[slotIndex] || '10:00 - 11:00 AM',
    status: 'BOOKED',
    stage: 'Arrival Confirmed - Gate QR Generated',
  });

  renderRoster();
  closeBookingModal();
  alert(`Booking Confirmed! Token: ${newToken} allocated for ${qty}Q ${crop}. Arrival Window: ${slotTimes[slotIndex]}.`);
}

// ============================================================================
// 8. Backend Telemetry Polling (Keeps Heartbeat Alive)
// ============================================================================
async function pingBackendHealth() {
  try {
    const res = await fetch('/health');
    if (res.ok) {
      document.getElementById('txt-conn-status').textContent = 'Live Connected (Backend OK)';
    }
  } catch (e) {
    // If running from static file or offline, maintain UI simulation
  }
}

// Initialization on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  renderCounters();
  renderRoster();
  pingBackendHealth();
  setInterval(pingBackendHealth, 10000);
});
