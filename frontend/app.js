/**
 * National Procurement Coordination Platform - Main Application Controller
 * Fully integrated multi-persona client wired to NestJS REST APIs and Socket.IO WebSockets.
 */

// ============================================================================
// 1. Bilingual Localization Dictionary (Section 27)
// ============================================================================
const i18n = {
  en: {
    appTitle: 'Department of Agriculture & Farmers Welfare',
    appSubtitle: 'Government-Grade Real-Time Procurement Coordination System (MSP Operations)',
    connStatus: 'Connecting...',
    navFarmer: 'Farmer Portal (किसान)',
    navCentre: 'Mandi Operations & Yard (मंडी नियंत्रण)',
    navCommand: 'Government Command Centre (राज्य कमान केंद्र)',
    farmerGreeting: 'Namaste, Ramesh Verma',
    farmerMeta: 'Registration: REG-2026-MP-00192 | Mobile: +91-9876543210',
    landMeta: '✓ Verified Landholding: 5.5 Acres (Sanwer, Indore, MP)',
    newBookingBtn: '+ New Booking (नई बुकिंग)',
    activeTokenTitle: "TODAY'S PROCUREMENT TOKEN",
    tokenSub: 'Booking ID: BK-DEMO-001',
    lblCentre: 'Procurement Centre',
    valCentre: 'Sanwer Krishi Upaj Mandi (सांवेर)',
    lblWindow: 'Arrival Window',
    valWindow: 'Today, 10:00 AM - 11:00 AM (Slot 1)',
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
    connStatus: 'जुड़ रहा है...',
    navFarmer: 'किसान पोर्टल (Farmer)',
    navCentre: 'मंडी संचालन एवं यार्ड नियंत्रण',
    navCommand: 'राज्य कमान केंद्र (Dashboard)',
    farmerGreeting: 'नमस्ते, रमेश वर्मा जी',
    farmerMeta: 'पंजीकरण: REG-2026-MP-00192 | मोबाइल: +91-9876543210',
    landMeta: '✓ सत्यापित भूमि स्वामित्व: 5.5 एकड़ (सांवेर, इंदौर, मध्य प्रदेश)',
    newBookingBtn: '+ नई फसल बुकिंग करें',
    activeTokenTitle: 'आज का खरीद टोकन संख्या',
    tokenSub: 'बुकिंग पहचान: BK-DEMO-001',
    lblCentre: 'खरीद केंद्र',
    valCentre: 'सांवेर कृषि उपज मंडी (इंदौर)',
    lblWindow: 'आवंटित आगमन समय',
    valWindow: 'आज, सुबह 10:00 - 11:00 बजे (स्लॉट 1)',
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
let activeFarmerBooking = null;
let liveCounters = [];
let liveRoster = [];

// ============================================================================
// 2. Navigation & Multi-Persona Identity Sync
// ============================================================================
function updatePersonaBadge(roleKey) {
  const badge = document.getElementById('txt-active-persona');
  if (!badge) return;

  if (roleKey === 'farmer') {
    badge.textContent = 'Farmer: Ramesh Verma (+91-9876543210)';
  } else if (roleKey === 'operator') {
    badge.textContent = 'Mandi Operator: Sanwer In-Charge (CENTRE_ADMIN)';
  } else if (roleKey === 'admin') {
    badge.textContent = 'State Admin: Central Control Officer (GOV_ADMIN)';
  }
}

async function switchView(viewId) {
  document.querySelectorAll('.view-panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));

  const targetPanel = document.getElementById(`view-${viewId}`);
  const targetTab = document.getElementById(`nav-${viewId}`);

  if (targetPanel) targetPanel.classList.add('active');
  if (targetTab) targetTab.classList.add('active');

  // Multi-Persona Role Switch
  if (viewId === 'farmer') {
    window.api.setActivePersona('farmer');
    updatePersonaBadge('farmer');
    await loadFarmerPortalData();
  } else if (viewId === 'centre') {
    window.api.setActivePersona('operator');
    updatePersonaBadge('operator');
    await loadCentreOperationsData();
  } else if (viewId === 'command') {
    window.api.setActivePersona('admin');
    updatePersonaBadge('admin');
    await loadCommandCentreData();
  }
}

function switchLanguage(lang) {
  currentLang = lang;
  document.getElementById('btn-lang-en').classList.toggle('active', lang === 'en');
  document.getElementById('btn-lang-hi').classList.toggle('active', lang === 'hi');

  const t = i18n[lang];
  document.getElementById('txt-app-title').textContent = t.appTitle;
  document.getElementById('txt-app-subtitle').textContent = t.appSubtitle;
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
// 3. Farmer Portal Management (Section 28)
// ============================================================================
async function loadFarmerPortalData() {
  try {
    const res = await window.api.getFarmerBookings();
    if (res && res.success && res.bookings && res.bookings.length > 0) {
      activeFarmerBooking = res.bookings[0];
      renderFarmerBooking(activeFarmerBooking);
    }
  } catch (err) {
    console.warn('[FarmerPortal] Could not fetch farmer bookings:', err.message);
  }
}

function renderFarmerBooking(bk) {
  if (!bk) return;

  const tokenEl = document.getElementById('farmer-token-num');
  const subEl = document.getElementById('txt-token-sub');
  const statusEl = document.getElementById('val-status');
  const windowEl = document.getElementById('val-window');
  const commodityEl = document.getElementById('val-commodity');
  const mspEl = document.getElementById('val-msp');
  const cancelBtn = document.getElementById('btn-farmer-cancel');

  if (tokenEl) tokenEl.textContent = bk.tokenNumber || 'T-001';
  if (subEl) subEl.textContent = `Booking ID: ${bk.bookingId}`;
  if (windowEl && bk.arrivalWindow) {
    windowEl.textContent = `Today, ${bk.arrivalWindow.startTime} - ${bk.arrivalWindow.endTime} (Slot ${bk.arrivalWindow.slotIndex || 1})`;
  }
  if (commodityEl) {
    commodityEl.textContent = `${bk.commodityCode || 'WHEAT'} - ${bk.quantityQuintals} Quintals`;
  }
  if (mspEl) {
    const rate = bk.commodityCode === 'WHEAT' ? 2275 : 5400;
    const est = (bk.quantityQuintals * rate).toLocaleString('en-IN');
    mspEl.textContent = `₹${est}`;
  }

  // Update Status Pill
  if (statusEl) {
    statusEl.textContent = bk.status;
    let pillClass = 'status-active';
    if (bk.status === 'COMPLETED') pillClass = 'status-completed';
    if (bk.status === 'CANCELLED' || bk.status === 'NO_SHOW') pillClass = 'status-maintenance';
    statusEl.className = `status-pill ${pillClass}`;
  }

  // Disable Cancel Button if already completed or cancelled
  if (cancelBtn) {
    if (bk.status === 'CANCELLED' || bk.status === 'COMPLETED') {
      cancelBtn.disabled = true;
      cancelBtn.style.opacity = '0.5';
    } else {
      cancelBtn.disabled = false;
      cancelBtn.style.opacity = '1';
    }
  }

  // Update 4-Stage Tracker based on Booking & Queue State
  if (bk.status === 'CONFIRMED' || bk.status === 'BOOKED') {
    updateFarmerTrackerStage(1, 'Awaiting Mandi Gate Arrival');
  } else if (bk.status === 'CHECKED_IN') {
    updateFarmerTrackerStage(2, 'Vehicle Admitted to Yard; In Queue for Weighbridge');
  } else if (bk.status === 'IN_PROGRESS') {
    updateFarmerTrackerStage(3, 'Weighment Complete; Quality Assay In Progress');
  } else if (bk.status === 'COMPLETED') {
    updateFarmerTrackerStage(4, 'Procurement Complete; Payment Advice Dispatched to DBT');
  } else if (bk.status === 'CANCELLED') {
    updateFarmerTrackerStage(1, 'Booking Cancelled');
  }
}

function updateFarmerTrackerStage(stageNum, desc) {
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`step-${i}`);
    if (!stepEl) continue;
    stepEl.classList.remove('completed', 'in-progress');

    if (i < stageNum) {
      stepEl.classList.add('completed');
    } else if (i === stageNum) {
      stepEl.classList.add('in-progress');
      if (desc) {
        const descEl = document.getElementById(`stg-${i}-desc`);
        if (descEl) descEl.textContent = desc;
      }
    }
  }
}

async function handleFarmerCancelActiveBooking() {
  const bookingId = activeFarmerBooking?.bookingId || 'BK-DEMO-001';
  const confirmed = confirm(`Are you sure you want to cancel booking ${bookingId}? Dynamic Adaptation Engine willDerate and pull waiting farmers forward.`);
  if (!confirmed) return;

  try {
    const res = await window.api.cancelBooking(bookingId, 'Farmer requested cancellation via Farmer Portal');
    alert(`Booking ${bookingId} successfully cancelled.\n${res.message || ''}`);
    await loadFarmerPortalData();
    await loadCentreOperationsData();
  } catch (err) {
    alert(`Cancellation failed: ${err.message}`);
  }
}

async function handleRefreshFarmerBooking() {
  await loadFarmerPortalData();
  alert('Farmer booking status refreshed from backend database.');
}

// ============================================================================
// 4. Mandi Operations & Ground Operator Actions (Section 29)
// ============================================================================
async function loadCentreOperationsData() {
  try {
    const data = await window.api.getLiveDemoRoster();
    if (data && data.success) {
      liveCounters = data.counters || [];
      liveRoster = data.roster || [];
      renderCountersTable(liveCounters);
      renderRosterTable(liveRoster);
    }

    const dash = await window.api.getCentreDashboard('CENTRE-MP-IND-01');
    if (dash) {
      renderMandiGauges(dash);
    }
  } catch (err) {
    console.warn('[Operations] Could not load live centre data:', err.message);
  }
}

function renderMandiGauges(dash) {
  if (!dash) return;

  const bookedPct = dash.capacityUtilizationPercentage || 0;
  const barDaily = document.getElementById('bar-daily');
  const valDaily = document.getElementById('val-daily-pct');
  if (barDaily) barDaily.style.width = `${Math.min(bookedPct, 100)}%`;
  if (valDaily) valDaily.textContent = `${bookedPct}% Booked`;

  const throughputVal = document.getElementById('val-throughput');
  const bottleneckVal = document.getElementById('val-bottleneck');
  const bottleneckStatus = document.getElementById('val-bottleneck-status');
  const alertBanner = document.getElementById('capacity-alert-banner');

  if (dash.bottlenecks?.hasBottleneck) {
    if (throughputVal) throughputVal.textContent = '30 Q / hr';
    if (bottleneckVal) bottleneckVal.textContent = dash.bottlenecks.bottleneckStage;
    if (bottleneckStatus) {
      bottleneckStatus.textContent = '⚠️ Bottleneck Throttled';
      bottleneckStatus.className = 'text-amber';
    }
    if (alertBanner) alertBanner.style.display = 'flex';
  } else {
    if (throughputVal) throughputVal.textContent = '55 Q / hr';
    if (bottleneckVal) bottleneckVal.textContent = 'WEIGHING';
    if (bottleneckStatus) {
      bottleneckStatus.textContent = 'Optimal Flow';
      bottleneckStatus.className = 'text-success';
    }
  }
}

function renderCountersTable(counters) {
  const tbody = document.getElementById('counters-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  let activeCount = 0;
  counters.forEach((c) => {
    if (c.status === 'ACTIVE') activeCount++;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${c.counterId || c.id}</strong></td>
      <td>${c.name || `Counter ${c.counterNumber || 1}`}</td>
      <td><span class="badge badge-primary">${c.stage}</span></td>
      <td>${c.capacityPerHourQuintals || 30} Q/hr</td>
      <td>${c.currentQueueLength || 0} Vehicles</td>
      <td>
        <span class="status-pill ${c.status === 'ACTIVE' ? 'status-active' : 'status-maintenance'}">
          ${c.status}
        </span>
      </td>
      <td>
        <button class="btn btn-xs ${c.status === 'ACTIVE' ? 'btn-danger' : 'btn-primary'}" onclick="handleSingleCounterToggle('${c.counterId || c.id}')">
          ${c.status === 'ACTIVE' ? 'Mark Fault' : 'Restore'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const countBadge = document.getElementById('badge-counter-count');
  if (countBadge) countBadge.textContent = `${activeCount} / ${counters.length} Counters Active`;
}

function renderRosterTable(roster) {
  const tbody = document.getElementById('roster-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  roster.forEach((r) => {
    const tr = document.createElement('tr');
    const st = r.status || '';
    let pillClass = 'status-waiting';
    if (st === 'IN_YARD' || st === 'CHECKED_IN' || st === 'IN_PROGRESS' || st === 'PROCESSING') pillClass = 'status-active';
    if (st === 'COMPLETED') pillClass = 'status-completed';
    if (st === 'CANCELLED' || st === 'NO_SHOW' || st === 'REJECTED') pillClass = 'status-maintenance';

    // Contextual Ground Action Buttons per Stage
    let actionButtons = '';
    if (st === 'CONFIRMED' || st === 'BOOKED') {
      actionButtons = `
        <button class="btn btn-xs btn-primary" onclick="handleGroundCheckIn('${r.bookingId}', '${r.token}', 'MP-09-AB-1234')">
          📥 Gate Check-In
        </button>
      `;
    } else if (st === 'CHECKED_IN' || st === 'ARRIVED') {
      actionButtons = `
        <button class="btn btn-xs btn-primary" onclick="handleGroundWeigh('${r.bookingId}', 'MP-09-AB-1234', 42.5, 12.5)">
          ⚖️ Weigh Vehicle
        </button>
      `;
    } else if (st === 'IN_PROGRESS' || st === 'WEIGHING_COMPLETED') {
      actionButtons = `
        <button class="btn btn-xs btn-success" onclick="handleGroundQuality('${r.bookingId}', 'GRADE_A', 11.2)">
          🔬 Quality Assay
        </button>
      `;
    } else if (st === 'QUALITY_COMPLETED') {
      actionButtons = `
        <button class="btn btn-xs btn-warning" onclick="handleGroundProcurement('${r.bookingId}', 30.0, 2275)">
          💰 Procure & DBT
        </button>
      `;
    } else if (st === 'COMPLETED') {
      actionButtons = `<span class="badge badge-success">✓ Procured & DBT</span>`;
    } else {
      actionButtons = `<small class="text-muted">Closed (${st})</small>`;
    }

    if (st !== 'COMPLETED' && st !== 'CANCELLED' && st !== 'NO_SHOW') {
      actionButtons += `
        <button class="btn btn-xs btn-ghost-action" style="color: var(--gov-red);" onclick="handleGroundCancel('${r.bookingId}')" title="Cancel Booking">
          ❌
        </button>
      `;
    }

    tr.innerHTML = `
      <td><strong style="font-size: 1.05rem; color: var(--gov-navy);">${r.token}</strong></td>
      <td><strong>${r.farmerName || r.farmerId || 'Farmer'}</strong></td>
      <td>${r.qty}</td>
      <td>${r.window}</td>
      <td><span class="status-pill ${pillClass}">${r.status}</span></td>
      <td><small style="color: var(--text-secondary);">${r.stage || r.status}</small></td>
      <td>
        <div class="btn-group-cell">${actionButtons}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------------------------------------------------------------------
// Ground Action Button Handlers (Real Backend Operations Endpoints)
// ----------------------------------------------------------------------------
async function handleGroundCheckIn(bookingId, tokenNumber, vehicleNumber) {
  try {
    const res = await window.api.checkInVehicle({
      bookingId,
      tokenNumber,
      vehicleNumber,
      notes: 'Admitted via Gate 1 Automated Boom Barrier',
    });
    alert(`Gate Check-in Success! Booking: ${bookingId}, Queue: ${res.queueState}`);
    await loadCentreOperationsData();
    await loadFarmerPortalData();
  } catch (err) {
    alert(`Check-in failed: ${err.message}`);
  }
}

async function handleGroundWeigh(bookingId, vehicleNumber, gross, tare) {
  try {
    const res = await window.api.executeFullWeighment(bookingId, vehicleNumber, gross, tare);
    alert(`Weighment Recorded! Net Weight: ${res.netWeightQuintals} Q. Weigh Slip: ${res.weighmentSlipNumber}`);
    await loadCentreOperationsData();
    await loadFarmerPortalData();
  } catch (err) {
    alert(`Weighment failed: ${err.message}`);
  }
}

async function handleGroundQuality(bookingId, grade, moisture) {
  try {
    const res = await window.api.executeQualityAssay(bookingId, grade, moisture);
    alert(`Quality Verified! Grade: ${res.assignedGrade}, Moisture: ${moisture}%, Verdict: ${res.verdict}`);
    await loadCentreOperationsData();
    await loadFarmerPortalData();
  } catch (err) {
    alert(`Quality assay failed: ${err.message}`);
  }
}

async function handleGroundProcurement(bookingId, finalQty, mspRate) {
  try {
    const res = await window.api.executeProcurementHandoff(bookingId, finalQty, mspRate);
    alert(`Procurement Finalized! Advice Dispatched. Total Payout: ₹${res.record?.totalPayoutAmountInr || (finalQty * mspRate).toLocaleString('en-IN')}`);
    await loadCentreOperationsData();
    await loadFarmerPortalData();
  } catch (err) {
    alert(`Procurement handoff failed: ${err.message}`);
  }
}

async function handleGroundCancel(bookingId) {
  const reason = prompt(`Enter cancellation reason for ${bookingId}:`, 'Mandi administrative derating');
  if (!reason) return;
  try {
    const res = await window.api.cancelBooking(bookingId, reason);
    alert(`Booking ${bookingId} cancelled. Dynamic adaptation executed.`);
    await loadCentreOperationsData();
    await loadFarmerPortalData();
  } catch (err) {
    alert(`Cancel failed: ${err.message}`);
  }
}

async function handleSingleCounterToggle(counterId) {
  try {
    const res = await window.api.triggerCounterBreakdown('CENTRE-MP-IND-01', counterId, '2026-04-15');
    alert(`Counter Updated: ${res.message}`);
    await loadCentreOperationsData();
  } catch (err) {
    alert(`Counter update failed: ${err.message}`);
  }
}

// ============================================================================
// 5. Section 42 Real Engine Demonstration Runner
// ============================================================================
async function handleResetDemo() {
  try {
    const res = await window.api.resetAndSeedDemo();
    alert(`Backend Reset: ${res.message} (${res.bookingsCount} demo bookings seeded in MongoDB)`);
    await loadCentreOperationsData();
    await loadFarmerPortalData();
    updateFarmerTrackerStage(1, 'Awaiting Mandi Gate Arrival');
    const banner = document.getElementById('capacity-alert-banner');
    if (banner) banner.style.display = 'none';
  } catch (err) {
    alert(`Reset Failed: ${err.message}`);
  }
}

async function handleDemoStep(stepNumber) {
  try {
    const res = await window.api.executeDemoStep(stepNumber);
    console.log(`[Step ${stepNumber} Result]`, res);

    await loadCentreOperationsData();
    await loadFarmerPortalData();

    if (stepNumber === '1') {
      updateFarmerTrackerStage(1, 'Token T-001 Verified at Gate 1');
      const statusEl = document.getElementById('val-status');
      if (statusEl) statusEl.textContent = 'CHECKED IN';
    } else if (stepNumber === '2') {
      const etaEl = document.getElementById('val-live-eta');
      if (etaEl) etaEl.textContent = '10:45 AM (+10m buffer)';
    } else if (stepNumber === '3') {
      updateFarmerTrackerStage(4, 'Grade A Wheat (11.4% Moisture) - ₹91,000 Payment Advice Generated');
    } else if (stepNumber === '4') {
      alert(`Section 42 Dynamic Adaptation Executed:\n${res.movedCandidate}\n${res.unalteredCandidate}`);
    } else if (stepNumber === '6') {
      const banner = document.getElementById('capacity-alert-banner');
      if (banner) banner.style.display = 'flex';
      const cmdSanwerStatus = document.getElementById('cmd-sanwer-status');
      if (cmdSanwerStatus) {
        cmdSanwerStatus.textContent = 'BOTTLENECK';
        cmdSanwerStatus.className = 'status-pill status-maintenance';
      }
      const cmdWarningCount = document.getElementById('cmd-warning-count');
      if (cmdWarningCount) cmdWarningCount.textContent = '1 Mandi';
    }
  } catch (err) {
    alert(`Step ${stepNumber} Failed: ${err.message}`);
  }
}

async function handleRunFullDemoScenario() {
  try {
    const res = await window.api.runFullDemoScenario();
    alert(`Full Section 42 Demo Scenario Completed! Executed ${res.steps.length} sequential ground events.`);
    await loadCentreOperationsData();
    await loadFarmerPortalData();
    const banner = document.getElementById('capacity-alert-banner');
    if (banner) banner.style.display = 'flex';
  } catch (err) {
    alert(`Demo Scenario Failed: ${err.message}`);
  }
}

// ============================================================================
// 6. Government Command Centre Management (Section 30)
// ============================================================================
async function loadCommandCentreData() {
  try {
    const res = await window.api.getCentresSummary();
    if (res && res.centres) {
      renderCommandCentresTable(res.centres);
    }
  } catch (err) {
    console.warn('[CommandCentre] Could not fetch command centre summary:', err.message);
  }
}

function renderCommandCentresTable(centres) {
  const tbody = document.getElementById('cmd-mandis-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  centres.forEach((c) => {
    const tr = document.createElement('tr');
    const utilPct = c.capacityUtilizationPercentage || 0;
    let barColor = 'bg-green';
    if (utilPct > 75) barColor = 'bg-blue';
    if (utilPct > 90) barColor = 'bg-amber';

    const hasBottleneck = c.countersSummary?.active < c.countersSummary?.total;
    const statusPill = hasBottleneck
      ? '<span class="status-pill status-maintenance">BOTTLENECK</span>'
      : '<span class="status-pill status-active">NORMAL</span>';

    tr.innerHTML = `
      <td><strong>${c.name}</strong></td>
      <td>${c.district} / ${c.name.split(' ')[0]}</td>
      <td>${c.sanctionedCapacityQuintals} Q</td>
      <td>${c.bookedQuantityQuintals} Q</td>
      <td>
        <div class="mini-progress">
          <div class="mini-bar ${barColor}" style="width: ${Math.min(utilPct, 100)}%"></div>
          <span>${utilPct}%</span>
        </div>
      </td>
      <td>${c.countersSummary ? `${c.countersSummary.active} / ${c.countersSummary.total} Operational` : '5 / 5 Operational'}</td>
      <td>${statusPill}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================================================
// 7. Booking Modal (Real POST /api/v1/bookings)
// ============================================================================
function openBookingModal() {
  document.getElementById('booking-modal').style.display = 'flex';
}

function closeBookingModal() {
  document.getElementById('booking-modal').style.display = 'none';
}

async function handleCreateBooking(event) {
  event.preventDefault();
  const commodity = document.getElementById('modal-commodity').value;
  const qty = parseFloat(document.getElementById('modal-qty').value);
  const slotIdx = parseInt(document.getElementById('modal-slot').value, 10);

  const payload = {
    centreId: 'CENTRE-MP-IND-01',
    commodityCode: commodity,
    quantityQuintals: qty,
    bookingDate: '2026-04-15',
    preferredSlotIndex: slotIdx,
    vehicles: [
      {
        vehicleNumber: 'MP-09-XY-9999',
        vehicleType: 'TRACTOR_TROLLEY',
        allocatedQuantityQuintals: qty,
      },
    ],
  };

  try {
    const res = await window.api.createBooking(payload);
    alert(`Booking Confirmed! Token: ${res.booking.tokenNumber} (Booking ID: ${res.booking.bookingId}). Slot: ${res.booking.arrivalWindow.startTime} - ${res.booking.arrivalWindow.endTime}.`);
    closeBookingModal();
    await loadFarmerPortalData();
    await loadCentreOperationsData();
  } catch (err) {
    alert(`Booking Failed: ${err.message}`);
  }
}

// ============================================================================
// 8. Telemetry Logger (Inspect Real REST & WebSocket Traffic)
// ============================================================================
window.onApiCallLogged = function (call) {
  const consoleEl = document.getElementById('telemetry-console-body');
  if (!consoleEl) return;

  const item = document.createElement('div');
  item.className = 'log-entry';
  const badgeClass = call.success ? 'badge-success' : 'badge-danger';
  item.innerHTML = `
    <span class="log-time">${new Date().toLocaleTimeString()}</span>
    <span class="badge ${badgeClass}">${call.method}</span>
    <span class="log-url">${call.endpoint}</span>
    <span class="log-status">${call.status} (${call.durationMs}ms)</span>
  `;
  consoleEl.insertBefore(item, consoleEl.firstChild);
  if (consoleEl.children.length > 25) consoleEl.removeChild(consoleEl.lastChild);
};

window.onWebSocketEventLogged = function (ev) {
  const consoleEl = document.getElementById('telemetry-console-body');
  if (!consoleEl) return;

  const item = document.createElement('div');
  item.className = 'log-entry ws-entry';
  item.innerHTML = `
    <span class="log-time">${ev.timestamp}</span>
    <span class="badge badge-primary">WS: ${ev.type}</span>
    <span class="log-url">[Channel: ${ev.channel}]</span>
    <span class="log-status">${JSON.stringify(ev.data).substring(0, 50)}...</span>
  `;
  consoleEl.insertBefore(item, consoleEl.firstChild);
  if (consoleEl.children.length > 25) consoleEl.removeChild(consoleEl.lastChild);
};

// ============================================================================
// 9. Bootstrapping & Realtime Event Wiring
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initializing Government Procurement Platform Frontend...');

  // 1. Authenticate all three personas on boot
  await window.api.initSessions();

  // 2. Connect WebSocket gateway using active token
  const wsToken = window.api.sessions.operator?.token || window.api.sessions.farmer?.token;
  window.realtime.connect(wsToken);

  // 3. Register Section 14 domain event listeners
  window.realtime.on('TOKEN_ASSIGNED', (data) => {
    console.log('[UI Event] Token Assigned:', data);
    updateFarmerTrackerStage(1, `Token ${data.tokenNumber} Verified at Gate`);
    loadCentreOperationsData();
    loadFarmerPortalData();
  });

  window.realtime.on('WEIGHMENT_COMPLETED', (data) => {
    console.log('[UI Event] Weighment Completed:', data);
    updateFarmerTrackerStage(2, `Gross Weight: ${data.grossWeightQuintals}Q recorded`);
    loadCentreOperationsData();
    loadFarmerPortalData();
  });

  window.realtime.on('QUALITY_COMPLETED', (data) => {
    console.log('[UI Event] Quality Completed:', data);
    updateFarmerTrackerStage(3, `Grade: ${data.grade} (${data.moisturePercentage}% Moisture)`);
    loadCentreOperationsData();
    loadFarmerPortalData();
  });

  window.realtime.on('PROCUREMENT_COMPLETED', (data) => {
    console.log('[UI Event] Procurement Completed:', data);
    updateFarmerTrackerStage(4, `₹${data.amountInr} Advice Dispatched`);
    loadCentreOperationsData();
    loadFarmerPortalData();
  });

  window.realtime.on('SCHEDULING_UPDATED', (data) => {
    console.log('[UI Event] Scheduling Updated:', data);
    loadCentreOperationsData();
    loadFarmerPortalData();
  });

  window.realtime.on('ETA_UPDATED', (data) => {
    console.log('[UI Event] ETA Updated:', data);
    const etaEl = document.getElementById('val-live-eta');
    if (etaEl && data.newEta) etaEl.textContent = data.newEta;
  });

  window.realtime.on('CENTRE_CAPACITY_CHANGED', (data) => {
    console.log('[UI Event] Capacity Changed:', data);
    loadCentreOperationsData();
    if (data.status === 'MAINTENANCE') {
      const banner = document.getElementById('capacity-alert-banner');
      if (banner) banner.style.display = 'flex';
    }
  });

  // 4. Initial load of Farmer Portal View
  updatePersonaBadge('farmer');
  await loadFarmerPortalData();
  await loadCentreOperationsData();
});
