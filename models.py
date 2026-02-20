from pydantic import BaseModel, Field
from typing import Optional

class PatientData(BaseModel):
    patient_id: str
    age: int = 50
    gender: str = Field(default="male", description="male or female")
    heart_rate_bpm: int = 80
    systolic_bp_mmHg: int = 120
    diastolic_bp_mmHg: int = 80
    oxygen_saturation_percent: float = 98.0
    body_temperature_celsius: float = 37.0
    respiratory_rate_bpm: int = 16
    blood_sugar_mg_dl: float = 120.0
    bmi: float = 22.0
    chronic_disease_flag: int = 0
    emergency_case_flag: int = 0
    icu_required_flag: int = 0
    admission_type: str = "Unknown"
    diagnosis_category: str = "Unknown"
    hydration_level_percent: float = 98.0
    hemoglobin_g_dl: float = 14.0

class PatientAnalysisResult(BaseModel):
    patient_id: str
    base_score: float
    final_risk_score: float
    severity_class: str
    diet_recommendation: str
    target_room_temperature: float

class HospitalData(BaseModel):
    hospital_id: int
    total_beds: int
    occupied_beds: int
    icu_beds_total: int
    icu_beds_occupied: int
    er_capacity: int
    er_occupied: int
    ongoing_operations_count: int
    available_doctors: int
    available_nurses: int
    ventilators_available: int
    ambulance_available_count: int
    room_temperature_celsius: float
    oxygen_supply_level_percent: int
    total_patients_current: int

class HospitalAnalysisResult(BaseModel):
    hospital_id: int
    bed_availability_ratio: float
    icu_availability_ratio: float
    er_load_ratio: float
    operation_load_ratio: float
    ventilator_pressure_ratio: float
    hospital_stress_index: float
    global_system_classification: str
    bed_allocation_action: str
    er_routing_action: str
