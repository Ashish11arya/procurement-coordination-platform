import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Scale, FileText, CheckCircle, AlertTriangle, Lock, Download } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="main-container" style={{ maxWidth: '880px', padding: '2rem 1.5rem', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link
          to="/register"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.9rem',
            color: 'var(--gov-navy)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} /> Back to Registration
        </Link>
        <button
          onClick={handlePrint}
          className="btn btn-outline"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
        >
          <Download size={14} /> Print / Save Legal Copy
        </button>
      </div>

      <div className="card" style={{ boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-color)', padding: '2.5rem' }}>
        {/* Header Banner */}
        <div style={{ borderBottom: '2px solid var(--gov-navy)', paddingBottom: '1.25rem', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gov-navy)', marginBottom: '8px' }}>
            <Scale size={28} />
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Statutory Privacy Notice • Government of India DPI Framework
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', color: 'var(--gov-navy)', margin: '0 0 8px 0', lineHeight: 1.25 }}>
            National Minimum Support Price (MSP) Procurement Platform: Privacy Policy
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <strong>Legal Reference:</strong> Digital Personal Data Protection (DPDP) Act, 2023 (Act No. 22 of 2023) • General Financial Rules (GFR 2017) Rule 290
            <br />
            <strong>Document Version:</strong> 1.0 (Statutory Release) • <strong>Effective Date:</strong> April 1, 2026
          </p>
        </div>

        {/* Executive Summary */}
        <div style={{ background: 'var(--bg-subtle)', borderLeft: '4px solid var(--gov-green)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: 'var(--gov-navy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} color="var(--gov-green)" />
            Notice to Data Principals (Farmers & Stakeholders)
          </h3>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            This platform operates as a Digital Public Infrastructure (DPI) to schedule, coordinate, and disburse Minimum Support Price (MSP) payments for agricultural produce. As a registered Data Principal under Section 2(j) of the DPDP Act 2023, your personal data is collected and processed exclusively on lawful grounds, with guaranteed rights of data access, portability, rectification, and erasure.
          </p>
        </div>

        {/* Section 1: Data Fiduciary */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--gov-navy)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
            1. Identity of Data Fiduciary & Significant Data Fiduciaries
          </h2>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            The primary <strong>Data Fiduciary</strong> determining the purpose and means of personal data processing under Section 2(i) of the DPDP Act 2023 is:
          </p>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.88rem', lineHeight: 1.6 }}>
            <strong>Department of Agriculture & Farmers Welfare</strong><br />
            Ministry of Agriculture & Farmers Welfare, Krishi Bhawan, New Delhi – 110001<br />
            Coordinated with: Food Corporation of India (FCI) & State Civil Supplies Corporations.
          </div>
        </section>

        {/* Section 2: Lawful Grounds */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--gov-navy)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
            2. Lawful Grounds for Data Processing
          </h2>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Personal data is processed solely under the following statutory provisions of the DPDP Act 2023:
          </p>
          <ul style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)', paddingLeft: '1.5rem' }}>
            <li>
              <strong>Section 6 (Explicit Consent):</strong> Informed, unambiguous, and revocable consent provided by you at the time of self-registration.
            </li>
            <li>
              <strong>Section 7(b) (Certain Legitimate Uses - State Subsidy & Welfare Benefits):</strong> Processing necessary for the provision of MSP subsidies, Direct Benefit Transfers (DBT), and agricultural price support schemes established by the Parliament of India.
            </li>
          </ul>
        </section>

        {/* Section 3: Data Minimisation Table */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--gov-navy)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
            3. Personal Data Collected & Principle of Data Minimisation
          </h2>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            Pursuant to the Data Minimisation principle under Section 6(1), the platform strictly limits data collection to what is necessary for scheduling and grain procurement:
          </p>
          <table className="table" style={{ width: '100%', fontSize: '0.85rem', marginTop: '12px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', border: '1px solid var(--border-color)' }}>Data Field</th>
                <th style={{ padding: '10px 12px', border: '1px solid var(--border-color)' }}>Statutory Purpose</th>
                <th style={{ padding: '10px 12px', border: '1px solid var(--border-color)' }}>Minimisation Safeguard</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '8px 12px', border: '1px solid var(--border-color)', fontWeight: 600 }}>Mobile Number</td>
                <td style={{ padding: '8px 12px', border: '1px solid var(--border-color)' }}>OTP Authentication & SMS Queue Tokens</td>
                <td style={{ padding: '8px 12px', border: '1px solid var(--border-color)' }}>Masked in audit & processing logs (e.g. 98****3210)</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 12px', border: '1px solid var(--border-color)', fontWeight: 600 }}>Farmer Name & Location</td>
                <td style={{ padding: '8px 12px', border: '1px solid var(--border-color)' }}>Landholding validation & centre allocation</td>
                <td style={{ padding: '8px 12px', border: '1px solid var(--border-color)' }}>Cross-referenced read-only against Land Records API</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 12px', border: '1px solid var(--border-color)', fontWeight: 600 }}>Aadhaar / Bank Credentials</td>
                <td style={{ padding: '8px 12px', border: '1px solid var(--border-color)' }}>DBT MSP Disbursement</td>
                <td style={{ padding: '8px 12px', border: '1px solid var(--border-color)' }}>
                  <strong>NOT STORED.</strong> Only NPCI boolean validation flag (<code>bankAccountVerified</code>) is retained
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Section 4: 3-Tier Data Retention Schedule */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--gov-navy)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
            4. 3-Tier Data Retention Policy (Section 38 & Legal Holds)
          </h2>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            To prevent indefinite data hoarding while adhering to public finance accountability, data retention is managed strictly across three tiers:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '12px' }}>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '14px', background: '#fafafa' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gov-navy)', textTransform: 'uppercase' }}>Tier 1: Operational</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gov-navy)', margin: '4px 0' }}>90 Days</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Arrival time slots, gate queue tokens, and daily operator logs are permanently purged 90 days after season close.
              </p>
            </div>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '14px', background: '#fafafa' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>Tier 2: Analytics</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0284c7', margin: '4px 0' }}>180 Days</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Regional throughput and queue wait-time metrics are permanently pseudonymized/anonymized after 180 days.
              </p>
            </div>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '14px', background: '#fef3c7' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>Tier 3: Statutory Financial Hold</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#92400e', margin: '4px 0' }}>7 Years</div>
              <p style={{ fontSize: '0.82rem', color: '#78350f', margin: 0 }}>
                <strong>Mandatory Statutory Hold:</strong> Weighbridge slips, MSP disbursements, and audit logs must be retained for 7 years per GFR 2017 Rule 290 and CAG audit mandates.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Data Subject Rights */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--gov-navy)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '12px' }}>
            5. Your Rights as a Data Principal (DPDP Act Chapter III)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: 'var(--gov-navy)' }}>
                Right to Access & Portability (Sec 11)
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Download a machine-readable JSON data dump of all your personal records, active consents, and procurement history at any time from your Farmer Profile.
              </p>
            </div>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: 'var(--gov-navy)' }}>
                Right to Erasure (Sec 12)
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Request deletion and anonymization of your profile. Personal identifiers are pseudonymized, subject only to mandatory 7-year GFR statutory financial records.
              </p>
            </div>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: 'var(--gov-navy)' }}>
                Right to Withdraw Consent (Sec 6(4))
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Consent may be revoked with the same ease with which it was given. Revocation immediately ceases scheduling services.
              </p>
            </div>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: 'var(--gov-navy)' }}>
                Right of Grievance Redressal (Sec 13)
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Directly lodge a grievance with our designated Data Protection Officer (DPO) or appeal to the Data Protection Board of India.
              </p>
            </div>
          </div>
        </section>

        {/* Section 6: Grievance Redressal Contact */}
        <section style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: 'var(--gov-navy)' }}>
            6. Designated Data Protection Officer (DPO) & Redressal Contact
          </h3>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            For queries, data subject rights requests, or complaints regarding data processing:
          </p>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong>Officer:</strong> Grievance Redressal Officer & DPO, MSP National Procurement Portal<br />
            <strong>Email:</strong> <code>dpo-agriculture@gov.in</code> | <code>privacy-msp@nic.in</code><br />
            <strong>Address:</strong> Room 142, Krishi Bhawan, Dr. Rajendra Prasad Road, New Delhi – 110001<br />
            <strong>Statutory Turnaround:</strong> Responses provided within 72 business hours per DPDP guidelines.
          </div>
        </section>
      </div>
    </div>
  );
};
