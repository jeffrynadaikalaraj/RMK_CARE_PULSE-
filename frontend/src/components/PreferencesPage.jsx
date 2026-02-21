import React, { useState } from "react";

const PreferencesPage = ({ user, onBack }) => {
    const [prefs, setPrefs] = useState({
        theme: "Dark",
        notifications: true,
        autoSync: true,
        compactMode: false,
        refreshRate: 30,
        language: "English (US)"
    });

    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "#120516",
            fontFamily: "'DM Sans', sans-serif",
            color: "#E2E8F0",
            padding: "2rem"
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
                * { box-sizing: border-box; }
                .pref-card { background: rgba(28,15,35,0.8); border: 1px solid rgba(232,121,249,0.12); border-radius: 20px; padding: 2rem; backdrop-filter: blur(16px); }
                .pref-row { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .pref-row:last-child { border-bottom: none; }
                .pref-info h4 { margin: 0; color: #F1F5F9; font-size: 1rem; }
                .pref-info p { margin: 4px 0 0; color: #64748B; font-size: 0.85rem; }
                .toggle-switch { position: relative; display: inline-block; width: 44px; height: 22px; }
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(100,116,139,0.3); transition: .4s; border-radius: 34px; }
                .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
                input:checked + .slider { background-color: #10B981; }
                input:checked + .slider:before { transform: translateX(22px); }
                .btn-save { background: linear-gradient(135deg,#D946EF,#8B5CF6); color:#fff; border:none; padding:1rem 2.5rem; border-radius:12px; font-size:1rem; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:inherit; margin-top: 2rem; width: 100%; box-shadow: 0 4px 15px rgba(99,102,241,0.2); }
                .btn-save:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(99,102,241,0.4); }
                .btn-back { background: none; border: 1px solid rgba(100,116,139,0.3); color: #64748B; padding: 0.6rem 1.2rem; border-radius: 10px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; font-family: inherit; display: flex; align-items: center; gap: 0.4rem; }
                .btn-back:hover { border-color: #94A3B8; color: #94A3B8; }
                .grid-bg { position:fixed;top:0;left:0;width:100%;height:100%;background-image:linear-gradient(rgba(232,121,249,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(232,121,249,0.025) 1px,transparent 1px);background-size:50px 50px;pointer-events:none;z-index:0; }
                .toast { position:fixed; top: 20px; right: 20px; background: #10B981; color: white; padding: 12px 24px; border-radius: 12px; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index:1000; animation: slideIn 0.3s ease; }
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                select.pref-input { background: rgba(6,13,31,0.8); border: 1px solid rgba(232,121,249,0.2); border-radius: 8px; padding: 0.5rem; color: #F1F5F9; font-family: inherit; outline: none; }
            `}</style>

            <div className="grid-bg" />
            {saved && <div className="toast">✅ Preferences updated locally!</div>}

            <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
                    <div>
                        <h2 style={{ margin: 0, fontFamily: "'Syne', sans-serif", color: "#F8FAFC", fontSize: "1.8rem" }}>System Preferences</h2>
                        <p style={{ margin: "4px 0 0", color: "#64748B" }}>Customize your clinical dashboard environment</p>
                    </div>
                    <button className="btn-back" onClick={onBack}>← Back</button>
                </div>

                <div className="pref-card">
                    <div className="pref-row">
                        <div className="pref-info">
                            <h4>Dynamic Dark Mode</h4>
                            <p>Adaptive UI based on hospital ambient light sensors</p>
                        </div>
                        <select className="pref-input" value={prefs.theme} onChange={e => setPrefs({ ...prefs, theme: e.target.value })}>
                            <option>Dark (Default)</option>
                            <option>Neo-Clinical</option>
                            <option>Midnight Gray</option>
                        </select>
                    </div>

                    <div className="pref-row">
                        <div className="pref-info">
                            <h4>Real-time Notifications</h4>
                            <p>Alert for critical patient risk score elevations</p>
                        </div>
                        <label className="toggle-switch">
                            <input type="checkbox" checked={prefs.notifications} onChange={e => setPrefs({ ...prefs, notifications: e.target.checked })} />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div className="pref-row">
                        <div className="pref-info">
                            <h4>Automatic Data Sync</h4>
                            <p>Sync local clinical reports to backend every 5 minutes</p>
                        </div>
                        <label className="toggle-switch">
                            <input type="checkbox" checked={prefs.autoSync} onChange={e => setPrefs({ ...prefs, autoSync: e.target.checked })} />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div className="pref-row">
                        <div className="pref-info">
                            <h4>Compact Dashboard Mode</h4>
                            <p>Display more patient records in a tighter grid layout</p>
                        </div>
                        <label className="toggle-switch">
                            <input type="checkbox" checked={prefs.compactMode} onChange={e => setPrefs({ ...prefs, compactMode: e.target.checked })} />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div className="pref-row">
                        <div className="pref-info">
                            <h4>Live Refresh Interval (Seconds)</h4>
                            <p>How often to pull clinical data from monitoring nodes</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <input type="range" min="5" max="120" value={prefs.refreshRate} onChange={e => setPrefs({ ...prefs, refreshRate: parseInt(e.target.value) })} style={{ width: "120px", accentColor: "#D946EF" }} />
                            <span style={{ color: "#E879F9", fontWeight: 700, width: "30px" }}>{prefs.refreshRate}s</span>
                        </div>
                    </div>

                    <div className="pref-row">
                        <div className="pref-info">
                            <h4>Language & Locale</h4>
                            <p>Regional clinical terminology and unit systems</p>
                        </div>
                        <select className="pref-input" value={prefs.language} onChange={e => setPrefs({ ...prefs, language: e.target.value })}>
                            <option>English (US) - Metric</option>
                            <option>English (UK) - Metric</option>
                            <option>Spanish - Metric</option>
                        </select>
                    </div>

                    <button className="btn-save" onClick={handleSave}>Save Preference Profile</button>
                </div>
            </div>
        </div>
    );
};

export default PreferencesPage;
