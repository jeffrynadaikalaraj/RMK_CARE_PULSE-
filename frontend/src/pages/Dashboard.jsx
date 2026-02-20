import { useState, useEffect } from 'react';
import axios from 'axios';
import { LayoutDashboard, Users, Activity, AlertOctagon, ArrowRight, Zap } from 'lucide-react';

export default function Dashboard() {
    const [formData, setFormData] = useState({
        hospital_id: 101,
        total_beds: 500,
        occupied_beds: 480,
        icu_beds_total: 50,
        icu_beds_occupied: 49,
        er_capacity: 100,
        er_occupied: 95,
        ongoing_operations_count: 15,
        available_doctors: 20,
        available_nurses: 80,
        ventilators_available: 30,
        ambulance_available_count: 5,
        room_temperature_celsius: 22.0,
        oxygen_supply_level_percent: 80,
        total_patients_current: 575
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: Number(value) }));
    };

    const handleAnalyze = async (e) => {
        e?.preventDefault();
        setLoading(true);
        try {
            const resp = await axios.post('http://127.0.0.1:8000/api/v1/hospital/stress', formData);
            setResult(resp.data);
        } catch (err) {
            console.error(err);
            alert('Failed to connect to backend. Is the FastAPI server running?');
        } finally {
            setLoading(false);
        }
    };

    // Run initial analysis on mount
    useEffect(() => {
        handleAnalyze();
    }, []);

    const getSystemColor = (status) => {
        if (status?.includes('Overload')) return 'var(--critical)';
        if (status?.includes('Critical')) return 'var(--warning)';
        if (status?.includes('Elevated')) return '#fde047';
        return 'var(--success)';
    };

    const sysColor = getSystemColor(result?.global_system_classification);

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Hospital Stress Diagnostics</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Real-time resource allocation and capacity intelligence</p>
                </div>

                {result && (
                    <div className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: `4px solid ${sysColor}` }}>
                        <Activity color={sysColor} size={32} />
                        <div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Global System Status</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '600', color: sysColor }}>{result.global_system_classification}</div>
                        </div>
                    </div>
                )}
            </header>

            {/* Top Banner Alerts */}
            {result && result.hospital_stress_index >= 0.7 && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--critical)',
                    padding: '1rem 1.5rem',
                    borderRadius: '12px',
                    marginBottom: '2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    animation: 'pulse 2s infinite'
                }}>
                    <AlertOctagon color="var(--critical)" size={24} />
                    <div>
                        <h4 style={{ color: 'var(--critical)', marginBottom: '0.25rem' }}>CRITICAL ACTIONS REQUIRED</h4>
                        <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-main)', fontSize: '0.875rem' }}>
                            <span><strong>Bed Logic:</strong> {result.bed_allocation_action}</span>
                            <span><strong>ER Routing:</strong> {result.er_routing_action}</span>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '2rem', alignItems: 'start' }}>

                {/* Main Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* Key Metrics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                        <MetricCard title="Hospital Stress Index" value={result?.hospital_stress_index?.toFixed(2) || "0.00"} subtitle="Weighted polynomial aggregate" color={sysColor} />
                        <MetricCard title="Bed Availability" value={`${((result?.bed_availability_ratio || 0) * 100).toFixed(1)}%`} subtitle={`${formData.total_beds - formData.occupied_beds} beds free`} color="var(--primary)" />
                        <MetricCard title="ER Load Pressure" value={`${((result?.er_load_ratio || 0) * 100).toFixed(1)}%`} subtitle={`${formData.er_occupied} / ${formData.er_capacity} patients`} color="var(--warning)" />
                    </div>

                    <div className="glass-panel" style={{ padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Zap className="gradient-text" /> Live Resource Controls
                        </h3>

                        <form onSubmit={handleAnalyze} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div className="input-group">
                                <label className="input-label">Occupied Ward Beds (Total: {formData.total_beds})</label>
                                <input type="number" name="occupied_beds" className="glass-input" value={formData.occupied_beds} onChange={handleChange} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Occupied ICU Beds (Total: {formData.icu_beds_total})</label>
                                <input type="number" name="icu_beds_occupied" className="glass-input" value={formData.icu_beds_occupied} onChange={handleChange} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">ER Current Census (Cap: {formData.er_capacity})</label>
                                <input type="number" name="er_occupied" className="glass-input" value={formData.er_occupied} onChange={handleChange} />
                            </div>

                            <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem' }} disabled={loading}>
                                    {loading ? 'Recalculating Stress...' : 'Recalculate System Load'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Sidebar Analytics */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ marginBottom: '2rem' }}>Deep Analytics</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <ProgressBar label="ICU Vacancy Rate" ratio={result?.icu_availability_ratio || 0} color="var(--primary)" />
                        <ProgressBar label="ER Saturation" ratio={result?.er_load_ratio || 0} color="var(--critical)" />
                        <ProgressBar label="Ventilator Pressure" ratio={result?.ventilator_pressure_ratio || 0} color="var(--warning)" />
                        <ProgressBar label="Surgical Load (Ops/Doc)" ratio={result?.operation_load_ratio || 0} color="var(--info)" />
                    </div>

                    <hr style={{ borderColor: 'var(--border-glass)', margin: '2rem 0' }} />

                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>RECOMMENDED ALLOCATION</div>
                        <p style={{ fontSize: '1.1rem', fontWeight: '500', color: 'var(--text-main)', margin: 0 }}>
                            {result?.bed_allocation_action || 'Awaiting computation...'}
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}

// Reusable Components
function MetricCard({ title, value, subtitle, color }) {
    return (
        <div className="glass-panel" style={{ padding: '1.5rem', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{title}</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: 'white', lineHeight: '1.2' }}>{value}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{subtitle}</div>
        </div>
    );
}

function ProgressBar({ label, ratio, color }) {
    // Cap at 100% for visual sanity safely
    const percent = Math.min(Math.max((ratio * 100), 0), 100);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontWeight: '600' }}>{ratio.toFixed(2)}x</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                    height: '100%',
                    width: `${percent}%`,
                    background: color,
                    boxShadow: `0 0 10px ${color}`,
                    transition: 'width 0.5s ease'
                }}></div>
            </div>
        </div>
    );
}
