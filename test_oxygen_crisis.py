import requests
import json

API_BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_oxygen_multiplier():
    # Base Critical Patient
    data = {
        "patient_id": "P_O2_TEST",
        "age": 60, "gender": "male", "bmi": 28.0, "heart_rate_bpm": 130, 
        "systolic_bp_mmHg": 150, "diastolic_bp_mmHg": 95, "oxygen_saturation_percent": 88.0, 
        "body_temperature_celsius": 38.0, "respiratory_rate_bpm": 24, "blood_sugar_mg_dl": 140.0, 
        "hemoglobin_g_dl": 12.0, "hydration_level_percent": 90.0, "chronic_disease_flag": 1, 
        "emergency_case_flag": 1, "icu_required_flag": 1, "admission_type": "ER", "diagnosis_category": "Respiratory"
    }

    # Test 1: Normal processing (is_oxygen_crisis=False)
    resp_base = requests.post(f"{API_BASE_URL}/patient/analyze?is_oxygen_crisis=false", json=data).json()
    base_score = resp_base.get("final_risk_score", 0)

    # Test 2: Crisis processing (is_oxygen_crisis=True)
    resp_crisis = requests.post(f"{API_BASE_URL}/patient/analyze?is_oxygen_crisis=true", json=data).json()
    crisis_score = resp_crisis.get("final_risk_score", 0)

    print(f"Base Score: {base_score} | Crisis Score: {crisis_score}")
    
    if crisis_score == min(100.0, base_score * 1.25):
        print("✅ Risk Multiplier (1.25x) Applied Correctly to Critical Patient!")
    else:
        print("❌ Risk Multiplier FAILED.")

def test_hospital_vent_triage():
    data = {"hospital_id": 1, "total_beds": 100, "occupied_beds": 90, "icu_beds_total": 20, "icu_beds_occupied": 20, "er_capacity": 50, "er_occupied": 48, "ongoing_operations_count": 5, "available_doctors": 10, "available_nurses": 30, "ventilators_available": 5, "ambulance_available_count": 2, "room_temperature_celsius": 22.0, "oxygen_supply_level_percent": 35, "total_patients_current": 110}
    
    # 10 critical patients, but only 5 ventilators (triggers triage logic because oxygen < 40)
    resp = requests.post(f"{API_BASE_URL}/hospital/stress?critical_patients_count=10", json=data).json()
    
    print("\n--- Hospital Triage Response ---")
    print(json.dumps(resp, indent=2))
    
    action = resp.get("er_routing_action", "")
    if "VENTILATOR SHORTAGE" in action:
        print("✅ Ventilator Triage Logic Triggered!")
    else:
        print("❌ Ventilator Triage Logic FAILED.")

if __name__ == "__main__":
    test_oxygen_multiplier()
    test_hospital_vent_triage()
