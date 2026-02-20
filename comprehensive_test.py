import requests
import time
import json

API_BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_extreme_patient():
    print("\n--- Testing Extreme Patient Case ---")
    data = {
        "patient_id": "P_EXTREME",
        "age": 90,
        "gender": "female",
        "bmi": 40.0,
        "heart_rate_bpm": 190,
        "systolic_bp_mmHg": 40,
        "diastolic_bp_mmHg": 30,
        "oxygen_saturation_percent": 80.0,
        "body_temperature_celsius": 42.0,
        "respiratory_rate_bpm": 50,
        "blood_sugar_mg_dl": 450.0,
        "hemoglobin_g_dl": 5.0,
        "hydration_level_percent": 40.0,
        "chronic_disease_flag": 1,
        "emergency_case_flag": 1,
        "icu_required_flag": 1,
        "admission_type": "ER",
        "diagnosis_category": "Respiratory"
    }
    resp = requests.post(f"{API_BASE_URL}/patient/analyze", json=data, timeout=10)
    result = resp.json()
    print(json.dumps(result, indent=2))
    assert result["final_risk_score"] <= 100.0, "Score exceeded mathematical bounds!"
    assert result["severity_class"] == "Critical", "Severity classification failed!"
    print("Extreme Patient Test: PASSED")

def test_normal_patient():
    print("\n--- Testing Normal Patient Case ---")
    data = {
        "patient_id": "P_NORMAL",
        "age": 30,
        "gender": "male",
        "bmi": 22.0,
        "heart_rate_bpm": 75,
        "systolic_bp_mmHg": 120,
        "diastolic_bp_mmHg": 80,
        "oxygen_saturation_percent": 99.0,
        "body_temperature_celsius": 36.8,
        "respiratory_rate_bpm": 15,
        "blood_sugar_mg_dl": 120.0,
        "hemoglobin_g_dl": 15.0,
        "hydration_level_percent": 98.0,
        "chronic_disease_flag": 0,
        "emergency_case_flag": 0,
        "icu_required_flag": 0,
        "admission_type": "General",
        "diagnosis_category": "Checkup"
    }
    resp = requests.post(f"{API_BASE_URL}/patient/analyze", json=data, timeout=10)
    result = resp.json()
    print(json.dumps(result, indent=2))
    assert result["final_risk_score"] == 0.0, "Normal patient should have 0.0 score!"
    assert result["severity_class"] == "Normal", "Severity classification failed!"
    print("Normal Patient Test: PASSED")

def test_bulk_processing_o_n():
    print("\n--- Testing Bulk Processing O(n) ---")
    patients = [
        {"patient_id": f"P_BULK_{i}", "age": 50, "gender": "male", "bmi": 24, "heart_rate_bpm": 80, 
         "systolic_bp_mmHg": 120, "diastolic_bp_mmHg": 80, "oxygen_saturation_percent": 98, "body_temperature_celsius": 37, 
         "respiratory_rate_bpm": 16, "blood_sugar_mg_dl": 120, "hemoglobin_g_dl": 14, "hydration_level_percent": 98, 
         "chronic_disease_flag": 0, "emergency_case_flag": 0, "icu_required_flag": 0, "admission_type": "General", "diagnosis_category": "Unknown"}
        for i in range(1000)
    ]
    start = time.time()
    resp = requests.post(f"{API_BASE_URL}/patient/analyze_bulk", json=patients, timeout=30)
    elapsed = (time.time() - start) * 1000
    print(f"Processed 1000 patients in {elapsed:.2f} ms")
    assert resp.status_code == 200, "Bulk endpoint failed!"
    assert len(resp.json()) == 1000, "Not all patients processed!"
    print("Bulk Processing Test: PASSED")

def test_hospital_extreme_stress():
    print("\n--- Testing Hospital Extreme Stress ---")
    data = {
        "hospital_id": 999,
        "total_beds": 100,
        "occupied_beds": 100,
        "icu_beds_total": 20,
        "icu_beds_occupied": 20,
        "er_capacity": 50,
        "er_occupied": 60,
        "ongoing_operations_count": 10,
        "available_doctors": 5,
        "available_nurses": 20,
        "ventilators_available": 10,
        "ambulance_available_count": 0,
        "room_temperature_celsius": 22.0,
        "oxygen_supply_level_percent": 10,
        "total_patients_current": 180
    }
    resp = requests.post(f"{API_BASE_URL}/hospital/stress", json=data, timeout=10)
    result = resp.json()
    print(json.dumps(result, indent=2))
    assert result["hospital_stress_index"] > 0.9, "HSI should be very high!"
    assert result["global_system_classification"] == "System Overload", "Classification failed!"
    print("Hospital Extreme Stress Test: PASSED")

if __name__ == "__main__":
    try:
        test_normal_patient()
        test_extreme_patient()
        test_bulk_processing_o_n()
        test_hospital_extreme_stress()
        print("\nALL TESTS PASSED SUCCESSFULLY.")
    except Exception as e:
        print(f"\nTEST SUITE FAILED: {e}")
