import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, Legend, AreaChart, Area
} from "recharts";

/* ═══════════════════════════════════════════════════════════════
   CAREPULSE++ CLINICAL ENGINE  (full deterministic logic in JS)
═══════════════════════════════════════════════════════════════ */
const WEIGHTS = { hr: 0.09, bp: 0.14, spo2: 0.15, fever: 0.10, rr: 0.09, sugar: 0.10, age: 0.08, bmi: 0.07, hgb: 0.10, hydration: 0.08 };
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function hrDev(hr) {
  if (hr < 60) return clamp((60 - hr) / 60);
  if (hr > 100) return clamp((hr - 100) / 100);
  return 0;
}
function bpDev(sys, dia) {
  const sd = sys > 120 ? clamp((sys - 120) / 80) : clamp((90 - sys) / 30, 0);
  const dd = dia > 80 ? clamp((dia - 80) / 40) : clamp((60 - dia) / 20, 0);
  return sd * 0.6 + dd * 0.4;
}
function spo2Dev(s) { return clamp(Math.max(0, 95 - s) / 20); }
function feverIdx(t) { return clamp(Math.max(0, t - 37.5) / 3); }
function rrDev(rr) { return clamp(Math.abs(rr - 16) / 16); }
function sugarRisk(s) {
  if (s > 140) return clamp((s - 140) / 260);
  if (s < 70) return clamp((70 - s) / 30);
  return 0;
}
function ageRisk(a) { return clamp(a / 100); }
function bmiRisk(b) {
  if (b < 18.5) return clamp((18.5 - b) / 10);
  if (b > 24.9) return clamp((b - 24.9) / 20);
  return 0;
}
function hgbRisk(h, gender) {
  const thr = (gender || "").toLowerCase() === "male" ? 13.5 : 12.0;
  return clamp(Math.max(0, thr - h) / thr);
}
function hydDef(h) { return clamp(Math.max(0, 60 - h) / 60); }

function computeRisk(p) {
  const comps = {
    hr: hrDev(p.heart_rate_bpm),
    bp: bpDev(p.systolic_bp_mmHg, p.diastolic_bp_mmHg),
    spo2: spo2Dev(p.oxygen_saturation_percent),
    fever: feverIdx(p.body_temperature_celsius),
    rr: rrDev(p.respiratory_rate_bpm),
    sugar: sugarRisk(p.blood_sugar_mg_dl),
    age: ageRisk(p.age),
    bmi: bmiRisk(p.bmi),
    hgb: hgbRisk(p.hemoglobin_g_dl, p.gender),
    hydration: hydDef(p.hydration_level_percent),
  };
  let score = Object.entries(WEIGHTS).reduce((s, [k, w]) => s + w * comps[k], 0) * 100;
  if (p.chronic_disease_flag === 1) score *= 1.2;
  if (p.emergency_case_flag === 1) score += 10;
  if (p.icu_required_flag === 1) score = Math.max(score, 75);
  score = Math.round(clamp(score, 0, 100) * 100) / 100;
  return { score, comps };
}

function severity(s) {
  if (s >= 70) return "Critical";
  if (s >= 40) return "Moderate";
  return "Stable";
}

function dietRecommendation(p) {
  if (p.blood_sugar_mg_dl > 200) return "Low-Carbohydrate Diet";
  if (p.systolic_bp_mmHg > 150) return "Low-Sodium Diet";
  if (p.body_temperature_celsius > 38.5) return "High-Fluid Diet";
  if (p.hemoglobin_g_dl < 10) return "Iron-Rich Diet";
  if (p.hydration_level_percent < 50) return "Electrolyte-Enriched Diet";
  return "Balanced Diet";
}

function roomTemp(sev, bodyTemp) {
  const base = { Critical: 23, Moderate: 25, Stable: 27 }[sev];
  return bodyTemp > 39 ? base - 2 : base;
}

function computeHospital(hosp, critCount) {
  const { total_beds: tb, occupied_beds: ob, icu_beds_total: icu, icu_beds_occupied: ocu,
    er_capacity: erc, er_occupied: ero, ongoing_operations_count: ops,
    available_doctors: doc, ventilators_available: ven } = hosp;
  const bedRatio = (tb - ob) / tb;
  const icuRatio = (icu - ocu) / icu;
  const erLoad = ero / erc;
  const opLoad = doc > 0 ? ops / doc : 1;
  const ventPres = ven > 0 ? critCount / ven : 1;
  const hsi = Math.round((0.28 * (1 - bedRatio) + 0.28 * (1 - icuRatio) + 0.24 * erLoad + 0.12 * Math.min(1, opLoad) + 0.08 * Math.min(1, ventPres / 2)) * 10000) / 10000;
  const stressStatus = hsi >= 0.9 ? "Emergency Escalation" : hsi >= 0.75 ? "Capacity Warning" : "Normal Operations";
  const erStatus = hsi > 0.9 ? "TEMPORARY ER FREEZE" : erLoad >= 0.85 ? "REDIRECT to Nearby Hospital" : "ER OPEN — Admitting";
  return {
    bedRatio, icuRatio, erLoad, opLoad, ventPres, hsi, stressStatus, erStatus,
    availIcu: icu - ocu, availGen: tb - ob, tb, icu, ven,
    oxygen: hosp.oxygen_supply_level_percent, ambientTemp: hosp.room_temperature_celsius,
    ambulances: hosp.ambulance_available_count, nurses: hosp.available_nurses,
    doctors: hosp.available_doctors
  };
}

function allocateBeds(patients, hm) {
  let icuLeft = hm.availIcu, genLeft = hm.availGen;
  const bedAvailRatio = hm.availGen / hm.tb;
  const sorted = [...patients].sort((a, b) => {
    if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score;
    return b.emergency_case_flag - a.emergency_case_flag;
  });
  const alloc = {};
  for (const p of sorted) {
    const sev = p.severity;
    let bed, alert = "";
    if (sev === "Critical") {
      if (icuLeft > 0) { bed = "ICU"; icuLeft--; } else { bed = "ICU — ESCALATION ALERT"; alert = "ICU FULL"; }
    } else if (sev === "Moderate") {
      if (bedAvailRatio < 0.1) { bed = "HOLD — Stop Admissions"; alert = "BED CRITICAL <10%"; }
      else if (genLeft > 0) { bed = "General Bed"; genLeft--; }
      else { bed = "Overflow"; alert = "NO BEDS"; }
    } else { bed = "Observation Ward"; }
    alloc[p.patient_id] = { bed, alert };
  }
  return alloc;
}

function erDecision(erLoad, hsi, isEmergency) {
  if (hsi > 0.9) return "FREEZE — ER Closed";
  if (erLoad >= 0.85) return "REDIRECT to Nearby Hospital";
  return isEmergency ? "ADMITTED — Emergency Priority" : "ADMITTED — ER Available";
}

function processData(patientRows, hospRow) {
  const patients = patientRows.map(p => {
    // Normalizing parsed keys strictly to match UI expectations if they omit them
    const norm = {
      patient_id: p.patient_id,
      age: p.age || 50,
      gender: p.gender || "male",
      heart_rate_bpm: p.heart_rate_bpm || p.heart_rate || 80,
      systolic_bp_mmHg: p.systolic_bp_mmHg || p.systolic_bp || 120,
      diastolic_bp_mmHg: p.diastolic_bp_mmHg || p.diastolic_bp || 80,
      oxygen_saturation_percent: p.oxygen_saturation_percent || p.spo2 || 98.0,
      body_temperature_celsius: p.body_temperature_celsius || p.temperature || 37.0,
      respiratory_rate_bpm: p.respiratory_rate_bpm || p.respiratory_rate || 16,
      blood_sugar_mg_dl: p.blood_sugar_mg_dl || p.blood_sugar || 120.0,
      bmi: p.bmi || 22.0,
      hemoglobin_g_dl: p.hemoglobin_g_dl || p.hemoglobin || 14.0,
      hydration_level_percent: p.hydration_level_percent || p.hydration_level || 98.0,
      chronic_disease_flag: p.chronic_disease_flag || 0,
      emergency_case_flag: p.emergency_case_flag || 0,
      icu_required_flag: p.icu_required_flag || 0,
      admission_type: p.admission_type || "Unknown",
      diagnosis_category: p.diagnosis_category || "Unknown"
    };

    const { score, comps } = computeRisk(norm);
    const sev = severity(score);
    return {
      ...norm,
      risk_score: score,
      severity: sev,
      diet: dietRecommendation(norm),
      rec_temp: roomTemp(sev, norm.body_temperature_celsius),
      comps,
    };
  });
  const critCount = patients.filter(p => p.severity === "Critical").length;
  const hm = computeHospital(hospRow, critCount);
  const bedMap = allocateBeds(patients, hm);
  const final = patients.map(p => ({
    ...p,
    bed_allocation: bedMap[p.patient_id]?.bed || "Unknown",
    bed_alert: bedMap[p.patient_id]?.alert || "",
    er_decision: erDecision(hm.erLoad, hm.hsi, p.emergency_case_flag === 1),
  }));
  return { patients: final, hospital: hm };
}

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS & THEME
═══════════════════════════════════════════════════════════════ */
const SEV_COLOR = { Critical: "#E53E3E", Moderate: "#DD6B20", Stable: "#38A169" };
const SEV_BG = { Critical: "#FFF5F5", Moderate: "#FFFAF0", Stable: "#F0FFF4" };
const SEV_DARK = { Critical: "#9B2C2C", Moderate: "#9C4221", Stable: "#276749" };

/* ═══════════════════════════════════════════════════════════════
   UPLOAD SCREEN
═══════════════════════════════════════════════════════════════ */
function UploadScreen({ onLoad }) {
  const [patFile, setPatFile] = useState(null);
  const [hosFile, setHosFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const parseXlsx = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        res(XLSX.utils.sheet_to_json(ws));
      } catch (err) { rej(err); }
    };
    reader.readAsArrayBuffer(file);
  });

  const handleProcess = async () => {
    if (!patFile || !hosFile) { setError("Please upload both files."); return; }
    setLoading(true); setError("");
    try {
      const [patRows, hosRows] = await Promise.all([parseXlsx(patFile), parseXlsx(hosFile)]);
      const result = processData(patRows, hosRows[0]);
      onLoad(result);
    } catch (e) { setError("Error parsing files: " + e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060D1F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: "2rem" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .upload-zone { border: 2px dashed rgba(56,189,248,0.3); border-radius:16px; padding:2rem; text-align:center; cursor:pointer; transition:all 0.2s; background:rgba(56,189,248,0.03); }
        .upload-zone:hover { border-color:rgba(56,189,248,0.7); background:rgba(56,189,248,0.07); }
        .upload-zone.has-file { border-color:#38BDF8; background:rgba(56,189,248,0.1); }
        .btn-primary { background:linear-gradient(135deg,#0EA5E9,#6366F1); color:#fff; border:none; padding:1rem 2.5rem; border-radius:12px; font-size:1rem; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:inherit; }
        .btn-primary:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 24px rgba(99,102,241,0.4); }
        .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .grid-bg { position:fixed;top:0;left:0;width:100%;height:100%;background-image:linear-gradient(rgba(56,189,248,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.04) 1px,transparent 1px);background-size:50px 50px;pointer-events:none; }
        input[type=file] { display:none; }
      `}</style>
      <div className="grid-bg" />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 600, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div style={{ width: 48, height: 48, background: "linear-gradient(135deg,#0EA5E9,#6366F1)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>⚕</div>
            <span style={{ fontSize: "1.8rem", fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "#F8FAFC", letterSpacing: "-0.5px" }}>CarePulse++</span>
          </div>
          <p style={{ color: "#94A3B8", fontSize: "1rem", margin: 0, lineHeight: 1.6 }}>Smart Patient Monitoring &amp; Hospital Resource Optimization<br /><span style={{ color: "#38BDF8", fontSize: "0.85rem" }}>Fully Deterministic · Rule-Based · O(n) Complexity</span></p>
        </div>

        <div style={{ background: "rgba(15,23,42,0.8)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: 20, padding: "2.5rem", backdropFilter: "blur(10px)" }}>
          <h3 style={{ color: "#F1F5F9", margin: "0 0 1.5rem", fontFamily: "'Syne',sans-serif", fontSize: "1.1rem" }}>Upload Data Files</h3>

          {[{ label: "Patient Clinical Data", key: "pat", file: patFile, set: setPatFile }, { label: "Hospital Resource Status", key: "hos", file: hosFile, set: setHosFile }].map(({ label, file, set }) => (
            <label key={label} style={{ display: "block", marginBottom: "1rem", cursor: "pointer" }}>
              <input type="file" accept=".xlsx,.xls" onChange={e => set(e.target.files[0])} />
              <div className={`upload-zone ${file ? "has-file" : ""}`}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{file ? "✅" : "📂"}</div>
                <div style={{ color: file ? "#38BDF8" : "#64748B", fontWeight: 600, fontSize: "0.9rem" }}>{file ? file.name : label}</div>
                <div style={{ color: "#475569", fontSize: "0.8rem", marginTop: "0.25rem" }}>{file ? "Click to change" : "Click to upload .xlsx"}</div>
              </div>
            </label>
          ))}

          {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "0.75rem 1rem", color: "#FCA5A5", fontSize: "0.85rem", marginBottom: "1rem" }}>{error}</div>}

          <button className="btn-primary" onClick={handleProcess} disabled={loading || !patFile || !hosFile} style={{ width: "100%", marginTop: "0.5rem" }}>
            {loading ? <span className="pulse">Processing Clinical Data...</span> : "Launch CarePulse++ System →"}
          </button>
        </div>

        <p style={{ textAlign: "center", color: "#334155", fontSize: "0.8rem", marginTop: "1.5rem" }}>All processing happens locally in your browser. No data is uploaded to any server.</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINI COMPONENTS
═══════════════════════════════════════════════════════════════ */
const SevBadge = ({ sev }) => (
  <span style={{ background: SEV_COLOR[sev], color: "#fff", padding: "2px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{sev}</span>
);

const RiskBar = ({ score }) => {
  const color = score >= 70 ? "#E53E3E" : score >= 40 ? "#DD6B20" : "#38A169";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3 }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
      <span style={{ color, fontWeight: 700, fontSize: "0.85rem", width: 36, textAlign: "right" }}>{score}</span>
    </div>
  );
};

const KpiCard = ({ icon, label, value, sub, color = "#38BDF8", glow }) => (
  <div style={{ background: "rgba(15,23,42,0.7)", border: `1px solid ${color}30`, borderRadius: 16, padding: "1.25rem 1.5rem", backdropFilter: "blur(8px)", boxShadow: glow ? `0 0 20px ${color}25` : undefined, flex: 1 }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div>
        <div style={{ color: "#64748B", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.5rem" }}>{label}</div>
        <div style={{ color, fontSize: "1.8rem", fontWeight: 800, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ color: "#475569", fontSize: "0.75rem", marginTop: "0.4rem" }}>{sub}</div>}
      </div>
      <span style={{ fontSize: "1.5rem", opacity: 0.8 }}>{icon}</span>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("All");
  const [sortCol, setSortCol] = useState("risk_score");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedPatient, setSelectedPatient] = useState(null);



  const patients = data?.patients || [];
  const hm = data?.hospital || {
    hsi: 0,
    erLoad: 0,
    bedRatio: 1,
    icuRatio: 1,
    ventPres: 0,
    opLoad: 0,
    stressStatus: "Pending",
    erStatus: "Pending",
    availIcu: 0,
    availGen: 0,
    tb: 0,
    icu: 0,
    ven: 0,
    oxygen: 100,
    ambientTemp: 22,
    ambulances: 0,
    nurses: 0,
    doctors: 0
  };

  const critCount = useMemo(() => patients.filter(p => p.severity === "Critical").length, [patients]);
  const modCount = useMemo(() => patients.filter(p => p.severity === "Moderate").length, [patients]);
  const stabCount = useMemo(() => patients.filter(p => p.severity === "Stable").length, [patients]);
  const avgRisk = useMemo(() => patients.length ? Math.round(patients.reduce((s, p) => s + p.risk_score, 0) / patients.length * 10) / 10 : 0, [patients]);

  const filtered = useMemo(() => {
    let r = [...patients];
    if (sevFilter !== "All") r = r.filter(p => p.severity === sevFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(p => String(p.patient_id).includes(q) || String(p.age).includes(q) || (p.gender || "").toLowerCase().includes(q) || (p.diagnosis_category || "").toLowerCase().includes(q) || (p.severity || "").toLowerCase().includes(q));
    }
    r.sort((a, b) => {
      const av = a[sortCol] ?? a.risk_score, bv = b[sortCol] ?? b.risk_score;
      if (typeof av === "number") return sortDir === "desc" ? bv - av : av - bv;
      return sortDir === "desc" ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
    return r;
  }, [patients, sevFilter, search, sortCol, sortDir]);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "patients", label: "Patients", icon: "🩺" },
    { id: "risk", label: "Risk Analysis", icon: "⚠️" },
    { id: "hospital", label: "Hospital", icon: "🏥" },
    { id: "er", label: "ER Tracker", icon: "🚨" },
  ];

  const DIET_COLORS = ["#0EA5E9", "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
  const dietDist = useMemo(() => Object.entries(patients.reduce((acc, p) => { acc[p.diet] = (acc[p.diet] || 0) + 1; return acc; }, {})).map(([n, v], i) => ({ name: n.replace(" Diet", ""), value: v, color: DIET_COLORS[i % DIET_COLORS.length] })), [patients]);

  const sevDist = useMemo(() => [
    { name: "Critical", value: critCount, color: "#E53E3E" },
    { name: "Moderate", value: modCount, color: "#DD6B20" },
    { name: "Stable", value: stabCount, color: "#38A169" }
  ], [critCount, modCount, stabCount]);

  const riskDist = useMemo(() => {
    const buckets = [{ range: "0–20", count: 0 }, { range: "20–40", count: 0 }, { range: "40–60", count: 0 }, { range: "60–80", count: 0 }, { range: "80–100", count: 0 }];
    patients.forEach(p => {
      const i = Math.min(4, Math.floor(p.risk_score / 20));
      buckets[i].count++;
    });
    return buckets;
  }, [patients]);

  const hsiColor = hm.hsi >= 0.9 ? "#E53E3E" : hm.hsi >= 0.75 ? "#DD6B20" : "#38A169";
  const erColor = hm.erLoad >= 0.85 ? "#E53E3E" : hm.erLoad >= 0.6 ? "#DD6B20" : "#38A169";

  if (!data) return <UploadScreen onLoad={setData} />;

  return (
    <div style={{ minHeight: "100vh", background: "#060D1F", fontFamily: "'DM Sans',sans-serif", color: "#E2E8F0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing:border-box; }
        body { margin:0; }
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:#0F172A}
        ::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
        .tab-btn { background:none;border:none;cursor:pointer;padding:0.6rem 1.1rem;border-radius:10px;font-family:inherit;font-size:0.85rem;font-weight:600;transition:all 0.2s;color:#64748B;display:flex;align-items:center;gap:0.4rem;white-space:nowrap; }
        .tab-btn.active { background:rgba(14,165,233,0.15);color:#38BDF8;box-shadow:0 0 12px rgba(56,189,248,0.15); }
        .tab-btn:hover:not(.active){color:#94A3B8;background:rgba(255,255,255,0.04)}
        .table-row { transition:background 0.15s;cursor:pointer; }
        .table-row:hover { background:rgba(14,165,233,0.07)!important; }
        .th-btn { background:none;border:none;cursor:pointer;color:inherit;font:inherit;padding:0;display:flex;align-items:center;gap:4px;white-space:nowrap; }
        .search-input { background:rgba(15,23,42,0.8);border:1px solid rgba(56,189,248,0.2);border-radius:10px;padding:0.6rem 1rem;color:#F1F5F9;font-family:inherit;font-size:0.875rem;outline:none;transition:border 0.2s; }
        .search-input:focus{border-color:#38BDF8}
        .filter-btn{background:rgba(15,23,42,0.6);border:1px solid rgba(100,116,139,0.3);border-radius:8px;padding:0.5rem 1rem;color:#94A3B8;font-family:inherit;font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.2s}
        .filter-btn.active{background:rgba(14,165,233,0.15);border-color:#38BDF8;color:#38BDF8}
        .filter-btn:hover:not(.active){border-color:#475569;color:#CBD5E1}
        .card{background:rgba(15,23,42,0.7);border:1px solid rgba(56,189,248,0.1);border-radius:16px;padding:1.5rem;backdropFilter:blur(8px)}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px)}
        .modal{background:#0F172A;border:1px solid rgba(56,189,248,0.2);border-radius:20px;padding:2rem;max-width:720px;width:100%;max-height:90vh;overflow-y:auto}
        .metric-pill{display:inline-flex;flex-direction:column;align-items:center;background:rgba(15,23,42,0.8);border:1px solid rgba(56,189,248,0.12);border-radius:10px;padding:0.6rem 0.9rem}
        .grid-bg{position:fixed;top:0;left:0;width:100%;height:100%;background-image:linear-gradient(rgba(56,189,248,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.025) 1px,transparent 1px);background-size:50px 50px;pointer-events:none;z-index:0}
        .reset-btn{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:0.5rem 1rem;color:#FCA5A5;font-family:inherit;font-size:0.8rem;cursor:pointer;transition:all 0.2s}
        .reset-btn:hover{background:rgba(239,68,68,0.2)}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn 0.3s ease}
      `}</style>
      <div className="grid-bg" />

      {/* ── HEADER ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(6,13,31,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(56,189,248,0.1)" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#0EA5E9,#6366F1)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>⚕</div>
            <span style={{ fontSize: "1.1rem", fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "#F8FAFC", letterSpacing: "-0.3px" }}>CarePulse<span style={{ color: "#38BDF8" }}>++</span></span>
          </div>
          <nav style={{ display: "flex", gap: "0.25rem", overflowX: "auto" }}>
            {tabs.map(t => (
              <button key={t.id} className={`tab-btn${activeTab === t.id ? " active" : ""}`} onClick={() => setActiveTab(t.id)}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
          <button className="reset-btn" onClick={() => setData(null)}>↩ New Data</button>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "1.5rem", position: "relative", zIndex: 1 }}>

        {/* ══════════════ DASHBOARD TAB ══════════════ */}
        {activeTab === "dashboard" && (
          <div className="fade-in">
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: "1.4rem", color: "#F8FAFC" }}>Hospital Intelligence Overview</h2>
              <p style={{ margin: "0.25rem 0 0", color: "#475569", fontSize: "0.85rem" }}>Real-time deterministic analysis · {patients.length} patients processed</p>
            </div>

            {/* KPIs row 1 */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <KpiCard icon="👥" label="Total Patients" value={patients.length} sub="All admissions" color="#38BDF8" glow />
              <KpiCard icon="🔴" label="Critical" value={critCount} sub={`${Math.round(critCount / patients.length * 100)}% of patients`} color="#E53E3E" glow />
              <KpiCard icon="🟠" label="Moderate" value={modCount} sub={`${Math.round(modCount / patients.length * 100)}% of patients`} color="#DD6B20" />
              <KpiCard icon="🟢" label="Stable" value={stabCount} sub={`${Math.round(stabCount / patients.length * 100)}% of patients`} color="#38A169" />
              <KpiCard icon="📈" label="Avg Risk Score" value={avgRisk} sub="System-wide average" color="#A78BFA" />
            </div>

            {/* KPIs row 2 */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <KpiCard icon="🏥" label="Hospital Stress Index" value={`${(hm.hsi * 100).toFixed(1)}%`} sub={hm.stressStatus} color={hsiColor} glow={hm.hsi >= 0.75} />
              <KpiCard icon="🚑" label="ER Load" value={`${(hm.erLoad * 100).toFixed(0)}%`} sub={hm.erStatus} color={erColor} />
              <KpiCard icon="🛏" label="ICU Available" value={hm.availIcu} sub={`of ${hm.icu} total ICU beds`} color={hm.availIcu < 5 ? "#E53E3E" : "#38BDF8"} />
              <KpiCard icon="🫀" label="General Beds" value={hm.availGen} sub={`of ${hm.tb} total beds (${(hm.bedRatio * 100).toFixed(0)}% free)`} color={hm.bedRatio < 0.15 ? "#E53E3E" : hm.bedRatio < 0.25 ? "#DD6B20" : "#38A169"} />
              <KpiCard icon="💨" label="Ventilators" value={hm.ven} sub={`Pressure index: ${hm.ventPres.toFixed(2)}x`} color={hm.ventPres > 1 ? "#E53E3E" : "#10B981"} />
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              {/* Severity Pie */}
              <div className="card">
                <h4 style={{ margin: "0 0 1rem", color: "#94A3B8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>Severity Distribution</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sevDist} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {sevDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, color: "#F1F5F9" }} />
                    <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Distribution Bar */}
              <div className="card">
                <h4 style={{ margin: "0 0 1rem", color: "#94A3B8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>Risk Score Distribution</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={riskDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="range" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, color: "#F1F5F9" }} />
                    <Bar dataKey="count" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Diet Pie */}
              <div className="card">
                <h4 style={{ margin: "0 0 1rem", color: "#94A3B8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>Diet Recommendations</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={dietDist} cx="50%" cy="50%" outerRadius={80} paddingAngle={2} dataKey="value">
                      {dietDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, color: "#F1F5F9" }} />
                    <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Hospital Resource Gauges */}
            <div className="card">
              <h4 style={{ margin: "0 0 1.25rem", color: "#94A3B8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>Hospital Resource Utilization</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "1rem" }}>
                {[
                  { label: "Bed Utilization", val: 1 - hm.bedRatio, avail: `${hm.availGen} free` },
                  { label: "ICU Utilization", val: 1 - hm.icuRatio, avail: `${hm.availIcu} free` },
                  { label: "ER Load", val: hm.erLoad, avail: `${(hm.erLoad * 100).toFixed(0)}% occupied` },
                  { label: "Op Load", val: Math.min(1, hm.opLoad), avail: `${hm.opLoad.toFixed(2)}x` },
                  { label: "Oxygen Supply", val: hm.oxygen / 100, avail: `${hm.oxygen}%`, invert: true },
                ].map(({ label, val, avail, invert }) => {
                  const pct = Math.round(val * 100);
                  const color = invert ? (pct > 85 ? "#38A169" : pct > 60 ? "#DD6B20" : "#E53E3E") : (pct > 85 ? "#E53E3E" : pct > 65 ? "#DD6B20" : "#38A169");
                  return (
                    <div key={label} style={{ background: "rgba(15,23,42,0.5)", borderRadius: 12, padding: "1rem", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ fontSize: "0.75rem", color: "#64748B", marginBottom: "0.5rem", fontWeight: 600 }}>{label}</div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, marginBottom: "0.4rem" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color, fontWeight: 700, fontSize: "0.9rem" }}>{pct}%</span>
                        <span style={{ color: "#475569", fontSize: "0.75rem" }}>{avail}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ PATIENTS TAB ══════════════ */}
        {activeTab === "patients" && (
          <div className="fade-in">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <h2 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: "1.4rem", color: "#F8FAFC" }}>Patient Clinical Report</h2>
                <p style={{ margin: "0.25rem 0 0", color: "#475569", fontSize: "0.85rem" }}>{filtered.length} of {patients.length} patients shown</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <input className="search-input" placeholder="Search ID, age, diagnosis..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 240 }} />
                {["All", "Critical", "Moderate", "Stable"].map(f => (
                  <button key={f} className={`filter-btn${sevFilter === f ? " active" : ""}`} onClick={() => setSevFilter(f)}>{f}</button>
                ))}
              </div>
            </div>

            <div style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(56,189,248,0.1)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(14,165,233,0.1)" }}>
                      {[
                        { col: "patient_id", label: "ID" },
                        { col: "age", label: "Age" },
                        { col: "gender", label: "Gender" },
                        { col: "diagnosis_category", label: "Diagnosis" },
                        { col: "risk_score", label: "Risk Score" },
                        { col: "severity", label: "Severity" },
                        { col: "diet", label: "Diet" },
                        { col: "rec_temp", label: "Temp Rec" },
                        { col: "bed_allocation", label: "Bed" },
                        { col: "er_decision", label: "ER Decision" },
                      ].map(({ col, label }) => (
                        <th key={col} style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#64748B", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>
                          <button className="th-btn" onClick={() => { if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc"); else { setSortCol(col); setSortDir("desc") } }}>
                            {label} {sortCol === col ? (sortDir === "desc" ? "↓" : "↑") : ""}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => {
                      const isAlert = p.bed_alert || p.bed_allocation.includes("ESCALATION");
                      return (
                        <tr key={p.patient_id} className="table-row" onClick={() => setSelectedPatient(p)}
                          style={{ background: i % 2 === 0 ? "rgba(15,23,42,0.4)" : "rgba(15,23,42,0.2)", borderLeft: isAlert ? "3px solid #E53E3E" : "3px solid transparent" }}>
                          <td style={{ padding: "0.65rem 1rem", color: "#38BDF8", fontWeight: 700 }}>{p.patient_id}</td>
                          <td style={{ padding: "0.65rem 1rem", color: "#94A3B8" }}>{p.age}</td>
                          <td style={{ padding: "0.65rem 1rem", color: "#94A3B8" }}>{p.gender}</td>
                          <td style={{ padding: "0.65rem 1rem", color: "#CBD5E1", whiteSpace: "nowrap" }}>{p.diagnosis_category}</td>
                          <td style={{ padding: "0.65rem 1rem", minWidth: 120 }}><RiskBar score={p.risk_score} /></td>
                          <td style={{ padding: "0.65rem 1rem" }}><SevBadge sev={p.severity} /></td>
                          <td style={{ padding: "0.65rem 1rem", color: "#94A3B8", whiteSpace: "nowrap", fontSize: "0.8rem" }}>{p.diet}</td>
                          <td style={{ padding: "0.65rem 1rem", color: "#A78BFA", fontWeight: 600 }}>{p.rec_temp}°C</td>
                          <td style={{ padding: "0.65rem 1rem" }}>
                            <span style={{
                              background: p.bed_allocation.includes("ESCALATION") ? "rgba(239,68,68,0.15)" : p.bed_allocation.includes("ICU") ? "rgba(239,68,68,0.08)" : p.bed_allocation.includes("General") ? "rgba(14,165,233,0.1)" : "rgba(56,189,248,0.05)",
                              color: p.bed_allocation.includes("ESCALATION") ? "#FCA5A5" : p.bed_allocation.includes("ICU") ? "#F87171" : p.bed_allocation.includes("General") ? "#38BDF8" : "#64748B",
                              padding: "2px 8px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap"
                            }}>{p.bed_allocation}</span>
                          </td>
                          <td style={{ padding: "0.65rem 1rem" }}>
                            <span style={{
                              color: p.er_decision.includes("ADMITTED") ? "#34D399" : p.er_decision.includes("REDIRECT") ? "#FBBF24" : "#F87171",
                              fontSize: "0.78rem", fontWeight: 600
                            }}>{p.er_decision}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ RISK ANALYSIS TAB ══════════════ */}
        {activeTab === "risk" && (
          <div className="fade-in">
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: "1.4rem", color: "#F8FAFC" }}>Risk Score Analysis</h2>
              <p style={{ margin: "0.25rem 0 0", color: "#475569", fontSize: "0.85rem" }}>Deviation component breakdown for all {patients.length} patients</p>
            </div>

            {/* Weight reference */}
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h4 style={{ margin: "0 0 1rem", color: "#94A3B8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>Risk Score Weight Distribution</h4>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {Object.entries(WEIGHTS).map(([k, w]) => (
                  <div key={k} style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)", borderRadius: 8, padding: "0.4rem 0.75rem", textAlign: "center" }}>
                    <div style={{ color: "#38BDF8", fontWeight: 700, fontSize: "0.9rem" }}>{(w * 100).toFixed(0)}%</div>
                    <div style={{ color: "#64748B", fontSize: "0.7rem", textTransform: "uppercase" }}>{k.toUpperCase()}</div>
                  </div>
                ))}
                <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, padding: "0.4rem 0.75rem", textAlign: "center" }}>
                  <div style={{ color: "#818CF8", fontWeight: 700, fontSize: "0.9rem" }}>×1.2</div>
                  <div style={{ color: "#64748B", fontSize: "0.7rem", textTransform: "uppercase" }}>CHRONIC</div>
                </div>
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "0.4rem 0.75rem", textAlign: "center" }}>
                  <div style={{ color: "#F87171", fontWeight: 700, fontSize: "0.9rem" }}>+10</div>
                  <div style={{ color: "#64748B", fontSize: "0.7rem", textTransform: "uppercase" }}>EMERGENCY</div>
                </div>
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "0.4rem 0.75rem", textAlign: "center" }}>
                  <div style={{ color: "#F87171", fontWeight: 700, fontSize: "0.9rem" }}>≥75</div>
                  <div style={{ color: "#64748B", fontSize: "0.7rem", textTransform: "uppercase" }}>ICU OVERRIDE</div>
                </div>
              </div>
            </div>

            {/* Deviation breakdown table */}
            <div style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(56,189,248,0.1)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(14,165,233,0.1)" }}>
                      {["ID", "Severity", "Risk Score", "HR Dev", "BP Dev", "SpO2 Dev", "Fever", "RR Dev", "Sugar", "Age", "BMI", "Hgb", "Hydration"].map(h => (
                        <th key={h} style={{ padding: "0.75rem 0.75rem", textAlign: "center", color: "#64748B", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.slice().sort((a, b) => b.risk_score - a.risk_score).map((p, i) => {
                      const devCell = (v) => {
                        const pct = Math.round(v * 100);
                        const bg = pct >= 70 ? "rgba(239,68,68,0.25)" : pct >= 40 ? "rgba(221,107,32,0.2)" : pct >= 15 ? "rgba(251,191,36,0.1)" : "rgba(56,189,248,0.05)";
                        const col = pct >= 70 ? "#F87171" : pct >= 40 ? "#FBBF24" : pct >= 15 ? "#FDE68A" : "#475569";
                        return { bg, col, pct };
                      };
                      return (
                        <tr key={p.patient_id} className="table-row" onClick={() => setSelectedPatient(p)} style={{ background: i % 2 === 0 ? "rgba(15,23,42,0.4)" : "rgba(15,23,42,0.2)" }}>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#38BDF8", fontWeight: 700 }}>{p.patient_id}</td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}><SevBadge sev={p.severity} /></td>
                          <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700, color: p.risk_score >= 70 ? "#F87171" : p.risk_score >= 40 ? "#FBBF24" : "#34D399" }}>{p.risk_score}</td>
                          {["hr", "bp", "spo2", "fever", "rr", "sugar", "age", "bmi", "hgb", "hydration"].map(k => {
                            const v = p.comps[k] || 0;
                            const { bg, col, pct } = devCell(v);
                            return (
                              <td key={k} style={{ padding: "0.5rem 0.75rem", textAlign: "center", background: bg }}>
                                <span style={{ color: col, fontWeight: pct >= 40 ? 700 : 400 }}>{v.toFixed(3)}</span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ HOSPITAL TAB ══════════════ */}
        {activeTab === "hospital" && (
          <div className="fade-in">
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: "1.4rem", color: "#F8FAFC" }}>Hospital Resource Dashboard</h2>
              <p style={{ margin: "0.25rem 0 0", color: "#475569", fontSize: "0.85rem" }}>Real-time resource utilization and stress analysis</p>
            </div>

            {/* HSI Spotlight */}
            <div style={{ background: `linear-gradient(135deg, ${hsiColor}18, rgba(15,23,42,0.9))`, border: `1px solid ${hsiColor}40`, borderRadius: 20, padding: "2rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ color: "#94A3B8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.5rem" }}>Hospital Stress Index</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
                  <span style={{ fontSize: "3.5rem", fontWeight: 800, fontFamily: "'Syne',sans-serif", color: hsiColor, lineHeight: 1 }}>{(hm.hsi * 100).toFixed(1)}<span style={{ fontSize: "1.5rem" }}>%</span></span>
                  <span style={{ background: `${hsiColor}20`, color: hsiColor, padding: "4px 12px", borderRadius: 20, fontWeight: 700, fontSize: "0.85rem" }}>{hm.stressStatus}</span>
                </div>
                <div style={{ marginTop: "0.75rem", color: "#64748B", fontSize: "0.85rem" }}>
                  Formula: 0.28×BedStress + 0.28×ICUStress + 0.24×ERLoad + 0.12×OpLoad + 0.08×VentStress
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#E53E3E", fontSize: "0.85rem", fontWeight: 600 }}>🔴 ≥ 90% → Emergency Escalation</div>
                <div style={{ color: "#DD6B20", fontSize: "0.85rem", fontWeight: 600, marginTop: "0.25rem" }}>🟠 ≥ 75% → Capacity Warning</div>
                <div style={{ color: "#38A169", fontSize: "0.85rem", fontWeight: 600, marginTop: "0.25rem" }}>🟢 &lt; 75% → Normal Operations</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              {/* Ratios */}
              <div className="card">
                <h4 style={{ margin: "0 0 1.25rem", color: "#94A3B8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>Utilization Ratios</h4>
                {[
                  { label: "Bed Availability", val: hm.bedRatio, used: 1 - hm.bedRatio, note: `${hm.availGen}/${hm.tb} free`, invert: true },
                  { label: "ICU Availability", val: hm.icuRatio, used: 1 - hm.icuRatio, note: `${hm.availIcu}/${hm.icu} free`, invert: true },
                  { label: "ER Load", val: hm.erLoad, used: hm.erLoad, note: `${(hm.erLoad * 100).toFixed(0)}% occupied`, invert: false },
                  { label: "Operation Load", val: Math.min(1, hm.opLoad), used: Math.min(1, hm.opLoad), note: `${hm.opLoad.toFixed(2)}x ratio`, invert: false },
                  { label: "Ventilator Pressure", val: Math.min(1, hm.ventPres / 2), used: Math.min(1, hm.ventPres / 2), note: `${hm.ventPres.toFixed(1)}x index`, invert: false },
                ].map(({ label, used, note, invert }) => {
                  const pct = Math.round(used * 100);
                  const color = invert ? (pct > 75 ? "#38A169" : pct > 40 ? "#DD6B20" : "#E53E3E") : (pct > 85 ? "#E53E3E" : pct > 65 ? "#DD6B20" : "#38A169");
                  return (
                    <div key={label} style={{ marginBottom: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                        <span style={{ color: "#94A3B8", fontSize: "0.85rem", fontWeight: 600 }}>{label}</span>
                        <span style={{ color, fontWeight: 700, fontSize: "0.85rem" }}>{note}</span>
                      </div>
                      <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 4 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resource Counts */}
              <div className="card">
                <h4 style={{ margin: "0 0 1.25rem", color: "#94A3B8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>Physical Resources</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  {[
                    { icon: "🛏", label: "Total Beds", val: hm.tb, color: "#38BDF8" },
                    { icon: "🛏", label: "Gen Available", val: hm.availGen, color: hm.availGen < 20 ? "#E53E3E" : "#38A169" },
                    { icon: "❤️‍🩹", label: "ICU Total", val: hm.icu, color: "#A78BFA" },
                    { icon: "❤️‍🩹", label: "ICU Available", val: hm.availIcu, color: hm.availIcu < 5 ? "#E53E3E" : "#A78BFA" },
                    { icon: "💨", label: "Ventilators", val: hm.ven, color: hm.ventPres > 1 ? "#E53E3E" : "#10B981" },
                    { icon: "🧑‍⚕️", label: "Doctors", val: hm.doctors, color: "#38BDF8" },
                    { icon: "👩‍⚕️", label: "Nurses", val: hm.nurses, color: "#818CF8" },
                    { icon: "🚑", label: "Ambulances", val: hm.ambulances, color: hm.ambulances < 3 ? "#E53E3E" : "#F59E0B" },
                    { icon: "🫁", label: "Oxygen Supply", val: `${hm.oxygen}%`, color: hm.oxygen < 85 ? "#E53E3E" : "#10B981" },
                    { icon: "🌡️", label: "Ambient Temp", val: `${hm.ambientTemp}°C`, color: "#94A3B8" },
                  ].map(({ icon, label, val, color }) => (
                    <div key={label} style={{ background: "rgba(15,23,42,0.5)", borderRadius: 10, padding: "0.75rem", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ fontSize: "1.2rem", marginBottom: "0.25rem" }}>{icon}</div>
                      <div style={{ color, fontWeight: 800, fontSize: "1.1rem", fontFamily: "'Syne',sans-serif" }}>{val}</div>
                      <div style={{ color: "#475569", fontSize: "0.72rem", marginTop: "0.1rem" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ER + Bed Allocation Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="card">
                <h4 style={{ margin: "0 0 1rem", color: "#94A3B8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>ER Admission Status</h4>
                <div style={{ background: hm.erStatus.includes("FREEZE") ? "rgba(239,68,68,0.1)" : hm.erStatus.includes("REDIRECT") ? "rgba(251,191,36,0.1)" : "rgba(52,211,153,0.08)", border: `1px solid ${hm.erStatus.includes("FREEZE") ? "rgba(239,68,68,0.4)" : hm.erStatus.includes("REDIRECT") ? "rgba(251,191,36,0.4)" : "rgba(52,211,153,0.3)"}`, borderRadius: 12, padding: "1.25rem" }}>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{hm.erStatus.includes("FREEZE") ? "🚫" : hm.erStatus.includes("REDIRECT") ? "⚠️" : "✅"}</div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: hm.erStatus.includes("FREEZE") ? "#F87171" : hm.erStatus.includes("REDIRECT") ? "#FBBF24" : "#34D399" }}>{hm.erStatus}</div>
                  <div style={{ color: "#475569", fontSize: "0.8rem", marginTop: "0.5rem" }}>ER Load: {(hm.erLoad * 100).toFixed(0)}% · Threshold: 85%</div>
                </div>
              </div>
              <div className="card">
                <h4 style={{ margin: "0 0 1rem", color: "#94A3B8", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>Bed Allocation Summary</h4>
                {Object.entries(patients.reduce((acc, p) => { acc[p.bed_allocation] = (acc[p.bed_allocation] || 0) + 1; return acc; }, {})).map(([bed, cnt]) => (
                  <div key={bed} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color: bed.includes("ESCALATION") ? "#F87171" : bed.includes("ICU") ? "#FDA4AF" : bed.includes("General") ? "#38BDF8" : bed.includes("Observation") ? "#A78BFA" : "#FBBF24", fontSize: "0.82rem", fontWeight: 600 }}>{bed}</span>
                    <span style={{ background: "rgba(255,255,255,0.05)", color: "#94A3B8", padding: "2px 10px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 700 }}>{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ ER TRACKER TAB ══════════════ */}
        {activeTab === "er" && (
          <div className="fade-in">
            <div style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h2 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: "1.4rem", color: "#F8FAFC" }}>ER & Emergency Tracker</h2>
                <p style={{ margin: "0.25rem 0 0", color: "#475569", fontSize: "0.85rem" }}>{patients.filter(p => p.emergency_case_flag === 1).length} emergency cases sorted by risk priority</p>
              </div>
              <div style={{ background: `${hm.erStatus.includes("OPEN") ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)"}`, border: `1px solid ${hm.erStatus.includes("OPEN") ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 10, padding: "0.6rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.2rem" }}>{hm.erStatus.includes("OPEN") ? "✅" : "🚨"}</span>
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: hm.erStatus.includes("OPEN") ? "#34D399" : "#F87171" }}>{hm.erStatus}</span>
              </div>
            </div>

            <div style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(239,68,68,0.08)" }}>
                      {["Priority", "Patient ID", "Age", "Gender", "Diagnosis", "Severity", "Risk Score", "ICU Required", "ER Decision", "Bed Allocation"].map(h => (
                        <th key={h} style={{ padding: "0.75rem 0.9rem", textAlign: "left", color: "#94A3B8", fontWeight: 700, fontSize: "0.73rem", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid rgba(239,68,68,0.15)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.filter(p => p.emergency_case_flag === 1).sort((a, b) => b.risk_score - a.risk_score).map((p, i) => (
                      <tr key={p.patient_id} className="table-row" onClick={() => setSelectedPatient(p)}
                        style={{ background: i % 2 === 0 ? "rgba(15,23,42,0.5)" : "rgba(15,23,42,0.3)", borderLeft: `3px solid ${SEV_COLOR[p.severity]}` }}>
                        <td style={{ padding: "0.65rem 0.9rem" }}>
                          <span style={{ background: "rgba(239,68,68,0.15)", color: "#F87171", fontWeight: 700, padding: "2px 8px", borderRadius: 6, fontSize: "0.8rem" }}>#{i + 1}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.9rem", color: "#38BDF8", fontWeight: 700 }}>{p.patient_id}</td>
                        <td style={{ padding: "0.65rem 0.9rem", color: "#94A3B8" }}>{p.age}</td>
                        <td style={{ padding: "0.65rem 0.9rem", color: "#94A3B8" }}>{p.gender}</td>
                        <td style={{ padding: "0.65rem 0.9rem", color: "#CBD5E1" }}>{p.diagnosis_category}</td>
                        <td style={{ padding: "0.65rem 0.9rem" }}><SevBadge sev={p.severity} /></td>
                        <td style={{ padding: "0.65rem 0.9rem", minWidth: 120 }}><RiskBar score={p.risk_score} /></td>
                        <td style={{ padding: "0.65rem 0.9rem" }}>
                          <span style={{ color: p.icu_required_flag === 1 ? "#F87171" : "#475569", fontWeight: 700 }}>{p.icu_required_flag === 1 ? "YES" : "NO"}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.9rem" }}>
                          <span style={{ color: p.er_decision.includes("ADMITTED") ? "#34D399" : p.er_decision.includes("REDIRECT") ? "#FBBF24" : "#F87171", fontWeight: 600, fontSize: "0.8rem" }}>{p.er_decision}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.9rem" }}>
                          <span style={{ color: p.bed_allocation.includes("ESCALATION") ? "#F87171" : p.bed_allocation.includes("ICU") ? "#FDA4AF" : "#64748B", fontSize: "0.8rem", fontWeight: 600 }}>{p.bed_allocation}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════ PATIENT DETAIL MODAL ══════════════ */}
      {selectedPatient && (
        <div className="modal-overlay" onClick={() => setSelectedPatient(null)}>
          <div className="modal fade-in" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
                  <h3 style={{ margin: 0, fontFamily: "'Syne',sans-serif", color: "#F8FAFC", fontSize: "1.3rem" }}>Patient #{selectedPatient.patient_id}</h3>
                  <SevBadge sev={selectedPatient.severity} />
                </div>
                <p style={{ margin: 0, color: "#64748B", fontSize: "0.85rem" }}>{selectedPatient.age}y {selectedPatient.gender} · {selectedPatient.diagnosis_category} · {selectedPatient.admission_type}</p>
              </div>
              <button onClick={() => setSelectedPatient(null)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#94A3B8", cursor: "pointer", fontSize: "1.2rem", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {/* Risk score hero */}
            <div style={{ background: `linear-gradient(135deg, ${SEV_COLOR[selectedPatient.severity]}20, rgba(15,23,42,0.9))`, border: `1px solid ${SEV_COLOR[selectedPatient.severity]}40`, borderRadius: 14, padding: "1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#64748B", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.3rem" }}>Risk Score</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 800, fontFamily: "'Syne',sans-serif", color: SEV_COLOR[selectedPatient.severity], lineHeight: 1 }}>{selectedPatient.risk_score}</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  {[
                    { l: "Diet", v: selectedPatient.diet }, { l: "Room Temp", v: `${selectedPatient.rec_temp}°C` },
                    { l: "Bed", v: selectedPatient.bed_allocation }, { l: "ER", v: selectedPatient.er_decision },
                  ].map(({ l, v }) => (
                    <div key={l} style={{ background: "rgba(15,23,42,0.5)", borderRadius: 8, padding: "0.4rem 0.6rem" }}>
                      <div style={{ color: "#475569", fontSize: "0.7rem", textTransform: "uppercase" }}>{l}</div>
                      <div style={{ color: "#CBD5E1", fontWeight: 600, fontSize: "0.8rem" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Vitals */}
            <h5 style={{ color: "#64748B", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 0.75rem" }}>Clinical Vitals</h5>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {[
                { l: "Heart Rate", v: `${selectedPatient.heart_rate_bpm} bpm`, d: selectedPatient.comps.hr },
                { l: "Systolic BP", v: `${selectedPatient.systolic_bp_mmHg} mmHg`, d: selectedPatient.comps.bp },
                { l: "SpO2", v: `${selectedPatient.oxygen_saturation_percent}%`, d: selectedPatient.comps.spo2 },
                { l: "Body Temp", v: `${selectedPatient.body_temperature_celsius}°C`, d: selectedPatient.comps.fever },
                { l: "Resp Rate", v: `${selectedPatient.respiratory_rate_bpm} bpm`, d: selectedPatient.comps.rr },
                { l: "Blood Sugar", v: `${selectedPatient.blood_sugar_mg_dl} mg/dL`, d: selectedPatient.comps.sugar },
                { l: "BMI", v: `${selectedPatient.bmi}`, d: selectedPatient.comps.bmi },
                { l: "Hemoglobin", v: `${selectedPatient.hemoglobin_g_dl} g/dL`, d: selectedPatient.comps.hgb },
                { l: "Hydration", v: `${selectedPatient.hydration_level_percent}%`, d: selectedPatient.comps.hydration },
              ].map(({ l, v, d }) => {
                const pct = Math.round((d || 0) * 100);
                const c = pct >= 70 ? "#F87171" : pct >= 40 ? "#FBBF24" : pct >= 15 ? "#86EFAC" : "#38A169";
                return (
                  <div key={l} style={{ background: "rgba(15,23,42,0.5)", borderRadius: 10, padding: "0.75rem", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ color: "#475569", fontSize: "0.72rem", marginBottom: "0.2rem" }}>{l}</div>
                    <div style={{ color: "#E2E8F0", fontWeight: 700, fontSize: "0.9rem" }}>{v}</div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginTop: "0.4rem" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 2 }} />
                    </div>
                    <div style={{ color: c, fontSize: "0.7rem", marginTop: "0.15rem" }}>Dev: {(d || 0).toFixed(3)}</div>
                  </div>
                );
              })}
            </div>

            {/* Flags */}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {[
                { l: "Chronic Disease", v: selectedPatient.chronic_disease_flag === 1 },
                { l: "Emergency", v: selectedPatient.emergency_case_flag === 1 },
                { l: "ICU Required", v: selectedPatient.icu_required_flag === 1 },
              ].map(({ l, v }) => (
                <span key={l} style={{ background: v ? "rgba(239,68,68,0.15)" : "rgba(52,211,153,0.08)", border: `1px solid ${v ? "rgba(239,68,68,0.4)" : "rgba(52,211,153,0.2)"}`, borderRadius: 8, padding: "4px 12px", color: v ? "#F87171" : "#6EE7B7", fontSize: "0.8rem", fontWeight: 600 }}>{v ? "✓" : "○"} {l}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
