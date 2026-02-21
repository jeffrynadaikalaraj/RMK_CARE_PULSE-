from models import PatientData, PatientAnalysisResult, HospitalData, HospitalAnalysisResult

def bounded_poly_deviation(x: float, n_min: float, n_max: float, c_min: float, c_max: float) -> float:
    if n_min <= x <= n_max:
        return 0.0
    elif x > n_max:
        return min(1.0, ((x - n_max) / (c_max - n_max)) ** 2)
    else:  # x < n_min
        return min(1.0, ((n_min - x) / (n_min - c_min)) ** 2)

def calculate_bp_map(systolic: float, diastolic: float) -> float:
    return (systolic + 2 * diastolic) / 3.0

def calculate_patient_risk(patient: PatientData, is_oxygen_crisis: bool = False) -> PatientAnalysisResult:
    # 1. Component Indexes
    i_hr = bounded_poly_deviation(patient.heart_rate_bpm, 60, 100, 30, 180)
    
    map_bp = calculate_bp_map(patient.systolic_bp_mmHg, patient.diastolic_bp_mmHg)
    i_bp = bounded_poly_deviation(map_bp, 70, 93, 50, 130)
    
    # Asymmetric SpO2
    i_spo2 = 0.0 if patient.oxygen_saturation_percent >= 95 else min(1.0, ((95 - patient.oxygen_saturation_percent) / (95 - 85)) ** 2)
    
    i_fever = bounded_poly_deviation(patient.body_temperature_celsius, 36.5, 37.3, 32.0, 41.0)
    i_respi = bounded_poly_deviation(patient.respiratory_rate_bpm, 12, 18, 6, 40)
    i_sugar = bounded_poly_deviation(patient.blood_sugar_mg_dl, 100, 180, 50, 400)
    
    # Age factor
    i_age = 0.0 if patient.age <= 50 else min(1.0, ((patient.age - 50) / (100 - 50)) ** 2)
    
    i_bmi = bounded_poly_deviation(patient.bmi, 18.5, 24.9, 12.0, 45.0)
    
    if patient.gender.lower() == 'male':
        i_hgb = bounded_poly_deviation(patient.hemoglobin_g_dl, 13.2, 16.6, 7.0, 20.0)
    else:
        i_hgb = bounded_poly_deviation(patient.hemoglobin_g_dl, 11.6, 15.0, 7.0, 20.0)
        
    i_hydr = 0.0 if patient.hydration_level_percent >= 95 else min(1.0, ((95 - patient.hydration_level_percent) / (95 - 50)) ** 2)

    # 2. Base Score Calculation
    weights = [0.1, 0.1, 0.15, 0.1, 0.15, 0.05, 0.1, 0.05, 0.1, 0.1] # Sum = 1.0
    indexes = [i_hr, i_bp, i_spo2, i_fever, i_respi, i_sugar, i_age, i_bmi, i_hgb, i_hydr]
    
    sum_w_i = sum(w * i for w, i in zip(weights, indexes))
    base_score = sum_w_i * 100.0
    
    # 3. Modifiers
    score_1 = base_score * 1.15 if patient.chronic_disease_flag == 1 else base_score
    score_2 = score_1 + 15.0 if patient.emergency_case_flag == 1 else score_1
    score_3 = min(100.0, score_2)
    
    if patient.icu_required_flag == 1:
        final_risk_score = max(score_3, 75.0)
    else:
        final_risk_score = score_3
        
    # 4. Severity Classification
    if final_risk_score < 20:
        severity = "Normal"
    elif final_risk_score < 50:
        severity = "Watch"
    elif final_risk_score < 75:
        severity = "Severe"
    else:
        severity = "Critical"
        
    # --- Oxygen Scarcity Risk Amplifier ---
    if is_oxygen_crisis and (severity == "Critical" or patient.icu_required_flag == 1):
        final_risk_score = min(100.0, final_risk_score * 1.25)
        # Re-evaluate severity in case it jumped from 74->92
        if final_risk_score >= 75:
            severity = "Critical"
        
    # 5. Room Temperature Recommendation
    target_temp = 22.0 # default baseline room temp
    if patient.body_temperature_celsius > 39.0:
        target_temp -= 2.0
        
    # 6. Diet Recommendation Engine
    if patient.blood_sugar_mg_dl > 200:
        diet = "Diabetic strict control, low carb"
    elif map_bp > 110:
        diet = "Low sodium (DASH diet)"
    elif patient.bmi > 30:
        diet = "Caloric restriction"
    else:
        diet = "Standard nutritional diet"

    return PatientAnalysisResult(
        patient_id=patient.patient_id,
        base_score=round(base_score, 2),
        final_risk_score=round(final_risk_score, 2),
        severity_class=severity,
        diet_recommendation=diet,
        target_room_temperature=target_temp
    )

def calculate_hospital_stress(hospital: HospitalData, critical_patients_count: int = 0) -> HospitalAnalysisResult:
    # 1. Ratios
    r_bed = (hospital.total_beds - hospital.occupied_beds) / max(1, hospital.total_beds)
    r_icu = (hospital.icu_beds_total - hospital.icu_beds_occupied) / max(1, hospital.icu_beds_total)
    r_er = hospital.er_occupied / max(1, hospital.er_capacity)
    r_op = hospital.ongoing_operations_count / max(1, hospital.available_doctors)
    # Using icu_beds_occupied as proxy for critical patients needing ventilation
    r_vent = hospital.icu_beds_occupied / max(1, hospital.ventilators_available)
    
    # 2. HSI Formula
    alpha, beta, gamma, delta, epsilon = 0.35, 0.25, 0.20, 0.10, 0.10
    
    hsi = (
        alpha * (1 - r_icu) +
        beta * min(1.0, r_vent) +
        gamma * r_er +
        delta * (1 - r_bed) +
        epsilon * r_op
    )
    
    # 3. Global System Classification & Routing Actions
    if hsi < 0.4:
        sys_class = "Normal Operations"
    elif hsi < 0.7:
        sys_class = "Elevated Stress"
    elif hsi < 0.9:
        sys_class = "Critical Capacity"
    else:
        sys_class = "System Overload"
        
    bed_action = "Standard Admission"
    if r_bed < 0.10:
        bed_action = "Stop New Admissions"
        
    er_action = "Accepting Triage"
    if r_er > 0.90:
        er_action = "Divert Ambulances"
        
    # --- Ventilator Action Logic (Oxygen Scarcity / Top-K) ---
    if hospital.oxygen_supply_level_percent < 40:
        bed_action = "OXYGEN CRISIS ALERT | " + bed_action
        if hospital.ventilators_available < critical_patients_count:
            er_action = "VENTILATOR SHORTAGE - Triage Sort Top-K Only | " + er_action
        
    if hospital.icu_beds_total - hospital.icu_beds_occupied <= 0:
        bed_action += " | Trigger high-priority facility transfer alert"

    return HospitalAnalysisResult(
        hospital_id=hospital.hospital_id,
        bed_availability_ratio=round(r_bed, 3),
        icu_availability_ratio=round(r_icu, 3),
        er_load_ratio=round(r_er, 3),
        operation_load_ratio=round(r_op, 3),
        ventilator_pressure_ratio=round(r_vent, 3),
        hospital_stress_index=round(hsi, 3),
        global_system_classification=sys_class,
        bed_allocation_action=bed_action,
        er_routing_action=er_action
    )
