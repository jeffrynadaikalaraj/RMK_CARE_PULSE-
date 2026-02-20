import requests
import json
import time

API_BASE_URL = "http://127.0.0.1:8000/api/v1"

# Realistic sample data mimicking Patient_Clinical_Data
sample_patient = {
    "patient_id": "P001",
    "age": 65,
    "gender": "male",
    "bmi": 28.5,
    "heart_rate_bpm": 115, # Elevated
    "systolic_bp_mmHg": 145, # Elevated
    "diastolic_bp_mmHg": 95,
    "oxygen_saturation_percent": 92.0, # Low
    "body_temperature_celsius": 39.5, # Fever, pyretic
    "respiratory_rate_bpm": 22,
    "blood_sugar_mg_dl": 210.0, # Diabetic control
    "hemoglobin_g_dl": 13.5,
    "hydration_level_percent": 88.0,
    "chronic_disease_flag": 1, # 1.15 multiplier
    "emergency_case_flag": 1, # +15.0 flat
    "icu_required_flag": 0,
    "admission_type": "ER",
    "diagnosis_category": "Cardiac"
}

# Realistic sample data mimicking Hospital_Resource_Status
sample_hospital = {
    "hospital_id": 101,
    "total_beds": 500,
    "occupied_beds": 480, # 96% utilization
    "icu_beds_total": 50,
    "icu_beds_occupied": 50, # 100% full
    "er_capacity": 100,
    "er_occupied": 95, 
    "ongoing_operations_count": 15,
    "available_doctors": 20,
    "available_nurses": 80,
    "ventilators_available": 30,
    "ambulance_available_count": 5,
    "room_temperature_celsius": 22.0,
    "oxygen_supply_level_percent": 80,
    "total_patients_current": 575
}

def run_tests():
    print("CarePulse++ Real-Time Deterministic Engine Diagnostic...")
    print("=" * 60)
    
    # Analyze Patient
    print(f"\n[1] Submitting Patient payload via POST /analyze_patient")
    print(json.dumps(sample_patient, indent=2))
    
    start_time = time.time()
    try:
        resp_p = requests.post(f"{API_BASE_URL}/patient/analyze", json=sample_patient, timeout=10)
        elapsed_p = (time.time() - start_time) * 1000
        print(f"\nResponse (Latency: {elapsed_p:.2f} ms): O(n) Execution")
        print(json.dumps(resp_p.json(), indent=2))
    except Exception as e:
        print(f"Error querying patient endpoint: {e}")

    # Analyze Hospital
    print(f"\n[2] Submitting Hospital Payload via POST /hospital/stress")
    print(json.dumps(sample_hospital, indent=2))
    
    start_time = time.time()
    try:
        resp_h = requests.post(f"{API_BASE_URL}/hospital/stress", json=sample_hospital, timeout=10)
        elapsed_h = (time.time() - start_time) * 1000
        print(f"\nResponse (Latency: {elapsed_h:.2f} ms): O(1) Execution")
        print(json.dumps(resp_h.json(), indent=2))
    except Exception as e:
        print(f"Error querying hospital endpoint: {e}")

if __name__ == "__main__":
    # Ensure server is running before executing this
    # Wait for server to start if running via a wrapper script
    import sys
    args = sys.argv
    if len(args) > 1 and args[1] == '--wait':
        print("Waiting 3 seconds for FastAPI to init...")
        time.sleep(3)
    run_tests()
