from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from models import PatientData, PatientAnalysisResult, HospitalData, HospitalAnalysisResult
from engine import calculate_patient_risk, calculate_hospital_stress

app = FastAPI(title="CarePulse++ Deterministic Healthcare Intelligence Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/v1/patient/analyze", response_model=PatientAnalysisResult)
async def analyze_patient(patient: PatientData):
    """
    Computes mathematical risk score and classifications for a single patient in O(1) time.
    """
    return calculate_patient_risk(patient)

@app.post("/api/v1/patient/analyze_bulk", response_model=List[PatientAnalysisResult])
async def analyze_patient_bulk(patients: List[PatientData]):
    """
    Computes mathematical risk scores for a list of patients in O(n) time.
    """
    return [calculate_patient_risk(p) for p in patients]

@app.post("/api/v1/hospital/stress", response_model=HospitalAnalysisResult)
async def check_hospital_stress(hospital: HospitalData):
    """
    Computes Hospital Stress Index (HSI) and bed routing actions mathematically.
    """
    return calculate_hospital_stress(hospital)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
