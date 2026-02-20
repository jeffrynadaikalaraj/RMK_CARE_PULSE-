import { useState } from 'react';
import axios from 'axios';
import { Activity, Beaker, Heart, Thermometer, Droplets, ArrowRight, AlertTriangle } from 'lucide-react';

export default function PatientAnalyzer() {
    const [formData, setFormData] = useState({
        patient_id: "P-" + Math.floor(Math.random() * 1000),
        age: 50,
        gender: "male",
        bmi: 24.0,
        heart_rate_bpm: 85,
        systolic_bp_mmHg: 120,
        diastolic_bp_mmHg: 80,
        oxygen_saturation_percent: 98.0,
        body_temperature_celsius: 37.0,
        respiratory_rate_bpm: 15,
        blood_sugar_mg_dl: 110.0,
        hemoglobin_g_dl: 14.0,
        hydration_level_percent: 98.0,
        chronic_disease_flag: 0,
        emergency_case_flag: 0,
        icu_required_flag: 0,
        admission_type: "Unknown",
        diagnosis_category: "Unknown"
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (checked ? 1 : 0) :
                type === 'number' ? Number(value) : value
        }));
    };

    const handleAnalyze = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const resp = await axios.post('http://127.0.0.1:8000/api/v1/patient/analyze', formData);
            setResult(resp.data);
        } catch (err) {
            console.error(err);
            alert('Failed to connect to backend engine.');
        } finally {
            setLoading(false);
        }
    };

    const severityColor =
        result?.severity_class === 'Critical' ? 'var(--critical)' :
            result?.severity_class === 'Severe' ? 'var(--warning)' :
                result?.severity_class === 'Watch' ? '#fde047' :
                    'var(--success)';

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Patient Clinical Analyzer</h1>
                <p style={{ color: 'var(--text-muted)' }}>O(1) Deterministic Risk Computation Engine</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '2rem', alignItems: 'start' }}>
                <form onSubmit={handleAnalyze} className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity className="gradient-text" /> Vitals Input Parameters
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                        {/* Row 1 */}
                        <div className="input-group">
                            <label className="input-label">Heart Rate (BPM)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Heart size={16} color="var(--primary)" />
                                <input type="number" name="heart_rate_bpm" className="glass-input" style={{ width: '100%' }} value={formData.heart_rate_bpm} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Systolic BP</label>
                            <input type="number" name="systolic_bp_mmHg" className="glass-input" value={formData.systolic_bp_mmHg} onChange={handleChange} />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Diastolic BP</label>
                            <input type="number" name="diastolic_bp_mmHg" className="glass-input" value={formData.diastolic_bp_mmHg} onChange={handleChange} />
                        </div>

                        {/* Row 2 */}
                        <div className="input-group">
                            <label className="input-label">SpO2 (%)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Activity size={16} color="var(--secondary)" />
                                <input type="number" step="0.1" name="oxygen_saturation_percent" className="glass-input" style={{ width: '100%' }} value={formData.oxygen_saturation_percent} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Temperature (°C)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Thermometer size={16} color="var(--warning)" />
                                <input type="number" step="0.1" name="body_temperature_celsius" className="glass-input" style={{ width: '100%' }} value={formData.body_temperature_celsius} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Blood Sugar</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Droplets size={16} color="var(--critical)" />
                                <input type="number" step="0.1" name="blood_sugar_mg_dl" className="glass-input" style={{ width: '100%' }} value={formData.blood_sugar_mg_dl} onChange={handleChange} />
                            </div>
                        </div>

                        {/* Row 3 */}
                        <div className="input-group">
                            <label className="input-label">Age</label>
                            <input type="number" name="age" className="glass-input" value={formData.age} onChange={handleChange} />
                        </div>
                        <div className="input-group">
                            <label className="input-label">BMI</label>
                            <input type="number" step="0.1" name="bmi" className="glass-input" value={formData.bmi} onChange={handleChange} />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Hemoglobin</label>
                            <input type="number" step="0.1" name="hemoglobin_g_dl" className="glass-input" value={formData.hemoglobin_g_dl} onChange={handleChange} />
                        </div>
                    </div>

                    <hr style={{ borderColor: 'var(--border-glass)', margin: '2rem 0' }} />

                    <h3 style={{ marginBottom: '1.5rem' }}>Clinical Flags (Multipliers)</h3>
                    <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="checkbox" name="chronic_disease_flag" checked={formData.chronic_disease_flag === 1} onChange={handleChange} style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
                            Chronic Disease (1.15x)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="checkbox" name="emergency_case_flag" checked={formData.emergency_case_flag === 1} onChange={handleChange} style={{ width: '18px', height: '18px', accentColor: 'var(--critical)' }} />
                            Emergency Esc. (+15)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="checkbox" name="icu_required_flag" checked={formData.icu_required_flag === 1} onChange={handleChange} style={{ width: '18px', height: '18px', accentColor: 'var(--warning)' }} />
                            ICU Override (Min 75)
                        </label>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }} disabled={loading}>
                        {loading ? 'Computing...' : (
                            <>
                                Execute Polynomial Deviation Analysis <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                {/* Results Visualizer Sidebar */}
                <div className="glass-panel" style={{ padding: '2rem', position: 'sticky', top: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                        Computation Results
                    </h3>

                    {!result ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>
                            <Beaker size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                            <p>Awaiting payload submission...</p>
                        </div>
                    ) : (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                            <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: `1px solid ${severityColor}40` }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Risk Score
                                </div>
                                <div style={{ fontSize: '4rem', fontWeight: '700', color: severityColor, lineHeight: '1' }}>
                                    {result.final_risk_score.toFixed(1)}<span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>/100</span>
                                </div>
                                <div style={{
                                    display: 'inline-block',
                                    marginTop: '1rem',
                                    padding: '0.25rem 1rem',
                                    borderRadius: '20px',
                                    background: `${severityColor}20`,
                                    color: severityColor,
                                    fontWeight: '600',
                                    letterSpacing: '1px',
                                    textTransform: 'uppercase'
                                }}>
                                    Class: {result.severity_class}
                                </div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--info)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>BASE SCORE DEVIATION</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: '500' }}>{result.base_score.toFixed(2)} pts</div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--secondary)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>DIET RECOMMENDATION ENGINE</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '500' }}>{result.diet_recommendation}</div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--warning)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>TARGET ROOM TEMP</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{result.target_room_temperature.toFixed(1)}°C</div>
                                {result.target_room_temperature < 22 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--info)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                        <AlertTriangle size={14} /> Pyretic override triggered
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
