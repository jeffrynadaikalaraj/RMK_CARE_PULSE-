import pandas as pd
import requests
import json
import time
import os

API_BASE_URL = "http://127.0.0.1:8000/api/v1"

def process_real_data():
    patient_file = '/Users/kesavp/Downloads/Patient_Clinical_Data.xlsx'
    hospital_file = '/Users/kesavp/Downloads/Hospital_Resource_Status.xlsx'
    
    if not os.path.exists(patient_file) or not os.path.exists(hospital_file):
        print("Error: Could not find sample data in ~/Downloads.")
        return

    print("Loading Sample Data...")
    df_p = pd.read_excel(patient_file)
    df_h = pd.read_excel(hospital_file)
    
    # 1. Map and Process Patients in Bulk
    print(f"Preparing {len(df_p)} patient records for analysis...")
    patients_payload = []
    for _, row in df_p.iterrows():
        patients_payload.append({
            "patient_id": str(row['patient_id']),
            "age": int(row['age']),
            "gender": str(row['gender']).lower(),
            "heart_rate_bpm": int(row['heart_rate_bpm']),
            "systolic_bp_mmHg": int(row['systolic_bp_mmHg']),
            "diastolic_bp_mmHg": int(row['diastolic_bp_mmHg']),
            "oxygen_saturation_percent": float(row['oxygen_saturation_percent']),
            "body_temperature_celsius": float(row['body_temperature_celsius']),
            "respiratory_rate_bpm": int(row['respiratory_rate_bpm']),
            "blood_sugar_mg_dl": float(row['blood_sugar_mg_dl']),
            "bmi": float(row['bmi']),
            "chronic_disease_flag": int(row['chronic_disease_flag']),
            "emergency_case_flag": int(row['emergency_case_flag']),
            "icu_required_flag": int(row['icu_required_flag']),
            "admission_type": str(row.get('admission_type', 'Unknown')),
            "diagnosis_category": str(row.get('diagnosis_category', 'Unknown')),
            "hemoglobin_g_dl": float(row.get('hemoglobin_g_dl', 14.0)),
            "hydration_level_percent": float(row.get('hydration_level_percent', 98.0))
        })
        
    start = time.time()
    resp_p = requests.post(f"{API_BASE_URL}/patient/analyze_bulk", json=patients_payload, timeout=60)
    elapsed_p = (time.time() - start) * 1000
    
    if resp_p.status_code == 200:
        results_p = resp_p.json()
        print(f"✅ Successfully processed {len(results_p)} patients in {elapsed_p:.2f} ms")
        df_out_p = pd.DataFrame(results_p)
        df_out_p.to_csv("Output_Patient_Analysis.csv", index=False)
        print("-> Saved to Output_Patient_Analysis.csv")
    else:
        print("Failed to process patients:", resp_p.text)
        
    # 2. Map and Process Hospital Stress
    print(f"\nPreparing {len(df_h)} hospital records for stress analysis...")
    hospital_results = []
    start_h = time.time()
    for _, row in df_h.iterrows():
        hospital_payload = {
            "hospital_id": int(row['hospital_id']),
            "total_beds": int(row['total_beds']),
            "occupied_beds": int(row['occupied_beds']),
            "icu_beds_total": int(row['icu_beds_total']),
            "icu_beds_occupied": int(row['icu_beds_occupied']),
            "er_capacity": int(row['er_capacity']),
            "er_occupied": int(row['er_occupied']),
            "ongoing_operations_count": int(row['ongoing_operations_count']),
            "available_doctors": int(row['available_doctors']),
            "available_nurses": int(row['available_nurses']),
            "ventilators_available": int(row['ventilators_available']),
            "ambulance_available_count": int(row['ambulance_available_count']),
            "room_temperature_celsius": float(row['room_temperature_celsius']),
            "oxygen_supply_level_percent": int(row['oxygen_supply_level_percent']),
            "total_patients_current": int(row['total_patients_current'])
        }
        
        resp_h = requests.post(f"{API_BASE_URL}/hospital/stress", json=hospital_payload, timeout=10)
        if resp_h.status_code == 200:
            hospital_results.append(resp_h.json())
        else:
            print("Failed to process hospital:", resp_h.text)
            
    elapsed_h = (time.time() - start_h) * 1000
    if hospital_results:
        print(f"✅ Successfully processed {len(hospital_results)} hospitals in {elapsed_h:.2f} ms")
        df_out_h = pd.DataFrame(hospital_results)
        df_out_h.to_csv("Output_Hospital_Stress.csv", index=False)
        print("-> Saved to Output_Hospital_Stress.csv")

if __name__ == "__main__":
    process_real_data()
