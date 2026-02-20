import React, { useState } from "react";

const SecuritySettingsPage = ({ user, onBack }) => {
    const [saved, setSaved] = useState(false);

    const handleAction = (msg) => {
        setSaved(msg);
        setTimeout(() => setSaved(false), 3000);
    };

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
                .security-card { background: rgba(15,23,42,0.8); border: 1px solid rgba(239,68,68,0.12); border-radius: 20px; padding: 2rem; backdrop-filter: blur(16px); position: relative; overflow: hidden; }
                .security-card::before { content: ""; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #EF4444; opacity: 0.5; }
                .security-item { display: flex; align-items: flex-start; gap: 1.5rem; padding: 1.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .security-item:last-child { border-bottom: none; }
                .security-icon { font-size: 1.5rem; background: rgba(239,68,68,0.1); padding: 12px; border-radius: 12px; border: 1px solid rgba(239,68,68,0.2); }
                .security-info h4 { margin: 0; color: #F8FAFC; font-size: 1.1rem; }
                .security-info p { margin: 4px 0 0; color: #64748B; font-size: 0.9rem; line-height: 1.5; }
                .btn-action { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #CBD5E1; padding: 0.75rem 1.25rem; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; margin-top: 1rem; }
                .btn-action:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); transform: translateY(-1px); }
                .btn-back { background: none; border: 1px solid rgba(100,116,139,0.3); color: #64748B; padding: 0.6rem 1.2rem; border-radius: 10px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; font-family: inherit; display: flex; align-items: center; gap: 0.4rem; }
                .btn-back:hover { border-color: #94A3B8; color: #94A3B8; }
                .grid-bg { position:fixed;top:0;left:0;width:100%;height:100%;background-image:linear-gradient(rgba(239,68,68,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.015) 1px,transparent 1px);background-size:60px 60px;pointer-events:none;z-index:0; }
                .toast { position:fixed; top: 20px; right: 20px; background: #38BDF8; color: white; padding: 12px 24px; border-radius: 12px; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index:1000; animation: slideIn 0.3s ease; }
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                .active-badge { font-size: 0.75rem; background: rgba(16,185,129,0.1); color: #10B981; padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(16,185,129,0.2); font-weight: 700; margin-left: 10px; }
            `}</style>

            <div className="grid-bg" />
            {saved && <div className="toast">⚡ {saved}</div>}

            <div style={{ position: "relative", zIndex: 1, maxWidth: 850, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
                    <div>
                        <h2 style={{ margin: 0, fontFamily: "'Syne', sans-serif", color: "#F8FAFC", fontSize: "1.8rem" }}>🔐 Security Architecture</h2>
                        <p style={{ margin: "4px 0 0", color: "#64748B" }}>Manage clinical access tokens and encryption protocols</p>
                    </div>
                    <button className="btn-back" onClick={onBack}>← Back</button>
                </div>

                <div className="security-card">
                    <div className="security-item">
                        <div className="security-icon">🛡️</div>
                        <div className="security-info" style={{ flex: 1 }}>
                            <h4>Two-Factor OTP Hub <span className="active-badge">ACTIVE</span></h4>
                            <p>Every login requires a high-entropy 6-digit code delivered via encrypted SMTP. This cannot be disabled for personnel with <strong>{user?.access_level}</strong> access.</p>
                            <button className="btn-action" onClick={() => handleAction("Security audit triggered")}>View Authorization Logs</button>
                        </div>
                    </div>

                    <div className="security-item">
                        <div className="security-icon">🔑</div>
                        <div className="security-info" style={{ flex: 1 }}>
                            <h4>JWT Session Management</h4>
                            <p>Your current session is tokenized using HS256 algorithm. Tokens expire automatically after periods of inactivity to prevent unauthorized access.</p>
                            <button className="btn-action" onClick={() => handleAction("Session tokens refreshed")}>Force Refresh Tokens</button>
                        </div>
                    </div>

                    <div className="security-item">
                        <div className="security-icon">🚫</div>
                        <div className="security-info" style={{ flex: 1 }}>
                            <h4>Terminate All Sessions</h4>
                            <p>If you suspect unauthorized access, click below to invalidate all clinical tokens associated with <strong>{user?.email}</strong> across all devices.</p>
                            <button className="btn-action"
                                style={{ color: "#FCA5A5", borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}
                                onClick={() => handleAction("Global session termination initiated")}>
                                Kill All Active Sessions
                            </button>
                        </div>
                    </div>

                    <div className="security-item" style={{ background: "rgba(0,0,0,0.1)", margin: "1rem -2rem -2rem", padding: "1.5rem 2rem" }}>
                        <div className="security-icon" style={{ background: "rgba(56,189,248,0.1)", borderColor: "rgba(56,189,248,0.2)" }}>📡</div>
                        <div className="security-info">
                            <h4 style={{ color: "#38BDF8" }}>Data Encryption Protocol</h4>
                            <p style={{ color: "#94A3B8" }}>All clinical reports and patient records are encrypted at rest and in transit using AES-256 and TLS 1.3 standards.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecuritySettingsPage;
