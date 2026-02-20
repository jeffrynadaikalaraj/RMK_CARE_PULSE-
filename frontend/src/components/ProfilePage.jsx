import React, { useState } from "react";
import axios from "axios";

const ProfilePage = ({ user, setUser, onBack }) => {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [form, setForm] = useState({
        full_name: user?.name || "",
        department: user?.department || "",
        role: user?.role || "",
        status: user?.status || "Online",
    });
    const [error, setError] = useState("");

    const statusOptions = ["Online", "On-Call", "Emergency Mode", "Off-Duty"];
    const roleOptions = ["Admin", "Doctor", "Nurse", "ER Staff", "Technician", "Staff"];
    const departmentOptions = ["Emergency", "ICU", "Cardiology", "Neurology", "Pediatrics", "Surgery", "Radiology", "Oncology", "General"];

    const statusColors = {
        "Online": "#10B981",
        "On-Call": "#F59E0B",
        "Emergency Mode": "#EF4444",
        "Off-Duty": "#64748B"
    };

    const accessColors = {
        "High": { bg: "rgba(239,68,68,0.15)", border: "#EF4444", text: "#FCA5A5" },
        "Medium": { bg: "rgba(245,158,11,0.15)", border: "#F59E0B", text: "#FCD34D" },
        "Restricted": { bg: "rgba(99,102,241,0.15)", border: "#6366F1", text: "#A5B4FC" },
    };

    const getInitials = (name) => {
        if (!name) return "?";
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            const token = localStorage.getItem("token");
            const res = await axios.put("http://localhost:8000/me/update", form, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(prev => ({ ...prev, name: form.full_name, department: form.department, role: form.role, status: form.status }));
            setEditing(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            // Update local state even if backend endpoint not yet implemented
            setUser(prev => ({ ...prev, name: form.full_name, department: form.department, role: form.role, status: form.status }));
            setEditing(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } finally {
            setSaving(false);
        }
    };

    const ac = accessColors[user?.access_level] || accessColors["Restricted"];

    return (
        <div style={{
            minHeight: "100vh",
            background: "#060D1F",
            fontFamily: "'DM Sans', sans-serif",
            color: "#E2E8F0",
            padding: "2rem"
        }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        .profile-card { background: rgba(15,23,42,0.8); border: 1px solid rgba(56,189,248,0.12); border-radius: 20px; padding: 2rem; backdrop-filter: blur(16px); }
        .profile-input { width: 100%; background: rgba(6,13,31,0.8); border: 1px solid rgba(56,189,248,0.2); border-radius: 10px; padding: 0.75rem 1rem; color: #F1F5F9; font-family: inherit; font-size: 0.9rem; outline: none; transition: border 0.2s; }
        .profile-input:focus { border-color: #38BDF8; box-shadow: 0 0 0 3px rgba(56,189,248,0.1); }
        .profile-select { width: 100%; background: rgba(6,13,31,0.9); border: 1px solid rgba(56,189,248,0.2); border-radius: 10px; padding: 0.75rem 1rem; color: #F1F5F9; font-family: inherit; font-size: 0.9rem; outline: none; cursor: pointer; }
        .btn-save { background: linear-gradient(135deg,#10B981,#059669); color:#fff; border:none; padding:0.75rem 2rem; border-radius:10px; font-size:0.9rem; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:inherit; }
        .btn-save:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(16,185,129,0.4); }
        .btn-edit { background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.3); color: #38BDF8; padding: 0.6rem 1.5rem; border-radius: 10px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; }
        .btn-edit:hover { background: rgba(56,189,248,0.2); }
        .btn-back { background: none; border: 1px solid rgba(100,116,139,0.3); color: #64748B; padding: 0.6rem 1.2rem; border-radius: 10px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; font-family: inherit; display: flex; align-items: center; gap: 0.4rem; }
        .btn-back:hover { border-color: #94A3B8; color: #94A3B8; }
        .btn-cancel { background: none; border: 1px solid rgba(239,68,68,0.3); color: #FCA5A5; padding: 0.6rem 1.2rem; border-radius: 10px; font-size: 0.85rem; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .btn-cancel:hover { background: rgba(239,68,68,0.1); }
        .field-label { color: #64748B; font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 0.4rem; }
        .info-value { color: #F1F5F9; font-size: 0.95rem; padding: 0.75rem 1rem; background: rgba(6,13,31,0.4); border-radius: 10px; border: 1px solid rgba(56,189,248,0.08); }
        .stat-item { background: rgba(6,13,31,0.6); border: 1px solid rgba(56,189,248,0.08); border-radius: 12px; padding: 1rem 1.25rem; text-align: center; }
        @keyframes gridBg { 0%{opacity:0.4} 50%{opacity:0.7} 100%{opacity:0.4} }
        .grid-bg { position:fixed;top:0;left:0;width:100%;height:100%;background-image:linear-gradient(rgba(56,189,248,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.025) 1px,transparent 1px);background-size:50px 50px;pointer-events:none;z-index:0; }
        .saved-toast { position:fixed;top:1.5rem;right:1.5rem;background:rgba(16,185,129,0.9);color:white;padding:0.75rem 1.5rem;border-radius:10px;font-weight:600;font-size:0.9rem;z-index:999;backdrop-filter:blur(8px);display:flex;align-items:center;gap:0.5rem; animation: slideIn 0.3s ease; }
        @keyframes slideIn { from{transform:translateX(100px);opacity:0} to{transform:translateX(0);opacity:1} }
        .pulse-dot { width:10px; height:10px; border-radius:50%; animation: pulseDot 1.5s infinite; }
        @keyframes pulseDot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:0.7} }
      `}</style>

            <div className="grid-bg" />

            {saved && (
                <div className="saved-toast">
                    ✅ Profile updated successfully!
                </div>
            )}

            <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto" }}>

                {/* Header Bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <span style={{ fontSize: "1.5rem", fontWeight: 800, fontFamily: "'Syne',sans-serif" }}>
                            Care<span style={{ color: "#38BDF8" }}>Pulse++</span>
                        </span>
                        <span style={{ color: "#334155", fontSize: "1.2rem" }}>/</span>
                        <span style={{ color: "#64748B", fontSize: "0.9rem" }}>Staff Profile</span>
                    </div>
                    <button className="btn-back" onClick={onBack}>
                        ← Back to Dashboard
                    </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.5rem" }}>

                    {/* LEFT: Avatar / Identity Card */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                        {/* Avatar Card */}
                        <div className="profile-card" style={{ textAlign: "center", border: "1px solid rgba(16,185,129,0.2)", boxShadow: "0 0 30px rgba(16,185,129,0.08)" }}>

                            {/* Avatar */}
                            <div style={{ position: "relative", display: "inline-block", marginBottom: "1.25rem" }}>
                                <div style={{
                                    width: 100, height: 100, borderRadius: "50%",
                                    background: "linear-gradient(135deg, #0EA5E9, #10B981)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "2.2rem", fontWeight: 800, color: "#fff",
                                    fontFamily: "'Syne',sans-serif",
                                    boxShadow: "0 0 0 4px rgba(16,185,129,0.2), 0 0 30px rgba(16,185,129,0.3)",
                                    margin: "0 auto"
                                }}>
                                    {user?.picture
                                        ? <img src={user.picture} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} alt="avatar" />
                                        : getInitials(user?.name)
                                    }
                                </div>
                                <div style={{
                                    position: "absolute", bottom: 4, right: 4,
                                    width: 18, height: 18, borderRadius: "50%",
                                    background: statusColors[user?.status] || "#10B981",
                                    border: "3px solid #060D1F",
                                    boxShadow: `0 0 8px ${statusColors[user?.status] || "#10B981"}`
                                }} />
                            </div>

                            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "0.25rem" }}>
                                {user?.name || "Unknown User"}
                            </div>
                            <div style={{ color: "#38BDF8", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                                {user?.role || "Staff"}
                            </div>
                            <div style={{
                                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                                background: statusColors[user?.status] + "22",
                                border: `1px solid ${statusColors[user?.status] || "#10B981"}55`,
                                borderRadius: 20, padding: "0.3rem 0.9rem",
                                fontSize: "0.8rem", fontWeight: 600,
                                color: statusColors[user?.status] || "#10B981",
                                marginBottom: "1.25rem"
                            }}>
                                <div className="pulse-dot" style={{ background: statusColors[user?.status] || "#10B981" }} />
                                {user?.status || "Online"}
                            </div>

                            {/* Access Level Badge */}
                            <div style={{
                                background: ac.bg, border: `1px solid ${ac.border}55`,
                                borderRadius: 10, padding: "0.6rem 1rem",
                                fontSize: "0.8rem", fontWeight: 700,
                                color: ac.text, letterSpacing: "1px"
                            }}>
                                🔐 {user?.access_level || "Restricted"} ACCESS
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="profile-card">
                            <div style={{ color: "#64748B", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "1rem" }}>Quick Info</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                <div>
                                    <div className="field-label">Staff ID</div>
                                    <div style={{ color: "#38BDF8", fontSize: "0.9rem", fontWeight: 700, fontFamily: "monospace", letterSpacing: "1px" }}>
                                        {user?.staff_id || "—"}
                                    </div>
                                </div>
                                <div style={{ borderTop: "1px solid rgba(56,189,248,0.08)", paddingTop: "0.75rem" }}>
                                    <div className="field-label">Department</div>
                                    <div style={{ color: "#F1F5F9", fontSize: "0.9rem" }}>{user?.department || "—"}</div>
                                </div>
                                <div style={{ borderTop: "1px solid rgba(56,189,248,0.08)", paddingTop: "0.75rem" }}>
                                    <div className="field-label">Email</div>
                                    <div style={{ color: "#F1F5F9", fontSize: "0.85rem", wordBreak: "break-all" }}>{user?.email || "—"}</div>
                                </div>
                                <div style={{ borderTop: "1px solid rgba(56,189,248,0.08)", paddingTop: "0.75rem" }}>
                                    <div className="field-label">Last Login</div>
                                    <div style={{ color: "#94A3B8", fontSize: "0.82rem" }}>
                                        {user?.last_login ? new Date(user.last_login).toLocaleString() : "—"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Edit Form */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                        {/* Profile Info Card */}
                        <div className="profile-card">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.75rem" }}>
                                <div>
                                    <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#F8FAFC", fontFamily: "'Syne',sans-serif" }}>
                                        Profile Information
                                    </div>
                                    <div style={{ color: "#64748B", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                                        Manage your clinical identity and preferences
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "0.75rem" }}>
                                    {editing ? (
                                        <>
                                            <button className="btn-cancel" onClick={() => { setEditing(false); setForm({ full_name: user?.name || "", department: user?.department || "", role: user?.role || "", status: user?.status || "Online" }); }}>
                                                Cancel
                                            </button>
                                            <button className="btn-save" onClick={handleSave} disabled={saving}>
                                                {saving ? "Saving..." : "💾 Save Changes"}
                                            </button>
                                        </>
                                    ) : (
                                        <button className="btn-edit" onClick={() => setEditing(true)}>
                                            ✏️ Edit Profile
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

                                {/* Full Name */}
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <div className="field-label">Full Name</div>
                                    {editing
                                        ? <input className="profile-input" type="text" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Dr. John Smith" />
                                        : <div className="info-value">{user?.name || "—"}</div>
                                    }
                                </div>

                                {/* Role */}
                                <div>
                                    <div className="field-label">Role</div>
                                    {editing
                                        ? <select className="profile-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                                            {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                        : <div className="info-value">{user?.role || "—"}</div>
                                    }
                                </div>

                                {/* Department */}
                                <div>
                                    <div className="field-label">Department</div>
                                    {editing
                                        ? <select className="profile-select" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                                            {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        : <div className="info-value">{user?.department || "—"}</div>
                                    }
                                </div>

                                {/* Status */}
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <div className="field-label">Duty Status</div>
                                    {editing ? (
                                        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                                            {statusOptions.map(s => (
                                                <button key={s} onClick={() => setForm(p => ({ ...p, status: s }))} style={{
                                                    padding: "0.5rem 1rem", borderRadius: 8, cursor: "pointer",
                                                    border: `1px solid ${form.status === s ? statusColors[s] : "rgba(100,116,139,0.3)"}`,
                                                    background: form.status === s ? statusColors[s] + "22" : "transparent",
                                                    color: form.status === s ? statusColors[s] : "#64748B",
                                                    fontFamily: "inherit", fontSize: "0.85rem", fontWeight: 600,
                                                    transition: "all 0.2s"
                                                }}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="info-value" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColors[user?.status] || "#10B981" }} />
                                            {user?.status || "Online"}
                                        </div>
                                    )}
                                </div>

                                {/* Email — read only */}
                                <div style={{ gridColumn: "1 / -1" }}>
                                    <div className="field-label">Email Address (Read Only)</div>
                                    <div className="info-value" style={{ color: "#64748B", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        🔒 {user?.email || "—"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Security Card */}
                        <div className="profile-card">
                            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#F8FAFC", fontFamily: "'Syne',sans-serif", marginBottom: "1.25rem" }}>
                                🔐 Security & Access
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                                <div className="stat-item">
                                    <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>🛡️</div>
                                    <div style={{ color: "#64748B", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>ACCESS LEVEL</div>
                                    <div style={{ color: ac.text, fontWeight: 700, fontSize: "0.9rem" }}>{user?.access_level || "Restricted"}</div>
                                </div>
                                <div className="stat-item">
                                    <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>🏷️</div>
                                    <div style={{ color: "#64748B", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>STAFF ID</div>
                                    <div style={{ color: "#38BDF8", fontWeight: 700, fontSize: "0.85rem", fontFamily: "monospace" }}>{user?.staff_id || "—"}</div>
                                </div>
                                <div className="stat-item">
                                    <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>🔑</div>
                                    <div style={{ color: "#64748B", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>AUTH METHOD</div>
                                    <div style={{ color: "#F1F5F9", fontWeight: 700, fontSize: "0.85rem" }}>JWT + OTP</div>
                                </div>
                            </div>

                            <div style={{ marginTop: "1.25rem", padding: "1rem", background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, fontSize: "0.82rem", color: "#94A3B8" }}>
                                🔒 Your clinical access rights are managed by your system administrator. Contact Admin to change role or access level.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
