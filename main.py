from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from models import PatientData, PatientAnalysisResult, HospitalData, HospitalAnalysisResult
from engine import calculate_patient_risk, calculate_hospital_stress
from google.oauth2 import id_token
from google.auth.transport import requests
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Float, Integer
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.sql import exists
from dotenv import load_dotenv
import os
import json
import random
import time
import aiosmtplib

load_dotenv()

app = FastAPI(title="CarePulse++ Deterministic Healthcare Intelligence Engine")

# --- DATABASE SETUP (for OTP persistence) ---
DATABASE_URL = "sqlite:///./auth.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class OTPRecord(Base):
    __tablename__ = "otp_records"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    otp = Column(String)
    expiry = Column(Float)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- SMTP CONFIG (from .env) ---
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("EMAIL")
SMTP_PASSWORD = os.getenv("PASSWORD")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_CLIENT_ID = "625094222230-d9ihjsrcl49h5qr9ggv18spjllpa6u7i.apps.googleusercontent.com"
DATA_DIR = "data"

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

class AuthToken(BaseModel):
    token: str

class OTPRequest(BaseModel):
    email: str

class OTPVerify(BaseModel):
    email: str
    otp: str

class UserDataStore(BaseModel):
    email: str
    patients: List[dict]
    hospital: dict

def get_user_data_path(email: str):
    return os.path.join(DATA_DIR, f"{email.replace('@', '_at_')}.json")

async def send_email_otp_async(target_email: str, otp: str):
    """Sends the OTP code to the user's email asynchronously."""
    message = MIMEMultipart()
    message["From"] = SMTP_USERNAME
    message["To"] = target_email
    message["Subject"] = f"CarePulse++ Verification Code: {otp}"

    body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f7f6; padding: 20px;">
            <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; padding: 40px; border: 1px solid #e1e8e5;">
                <h2 style="color: #0ea5e9; text-align: center;">CarePulse++ Authentication</h2>
                <p style="font-size: 16px; color: #374151;">Hello,</p>
                <p style="font-size: 16px; color: #374151;">Your verification code for CarePulse++ is:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 32px; font-weight: bold; color: #0ea5e9; letter-spacing: 5px; padding: 10px 20px; background: #f0f9ff; border-radius: 5px;">{otp}</span>
                </div>
                <p style="font-size: 14px; color: #6b7280; text-align: center;">This code will expire in 5 minutes.</p>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                <p style="font-size: 12px; color: #9ca3af; text-align: center;">Deterministic Healthcare Intelligence Engine</p>
            </div>
        </body>
    </html>
    """
    message.attach(MIMEText(body, "html"))

    try:
        await aiosmtplib.send(
            message,
            hostname=SMTP_SERVER,
            port=SMTP_PORT,
            start_tls=True,
            username=SMTP_USERNAME,
            password=SMTP_PASSWORD,
        )
        return True
    except Exception as e:
        print(f"[ERROR] aiosmtplib failed: {e}")
        return False

@app.post("/api/v1/auth/google")
async def auth_google(auth: AuthToken):
    try:
        idinfo = id_token.verify_oauth2_token(auth.token, requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo['email']
        
        user_data = None
        path = get_user_data_path(email)
        if os.path.exists(path):
            with open(path, "r") as f:
                user_data = json.load(f)
        
        return {
            "success": True, 
            "user": {
                "id": idinfo['sub'],
                "email": email,
                "name": idinfo.get('name'),
                "picture": idinfo.get('picture')
            },
            "stored_data": user_data
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/v1/auth/otp/send")
async def send_otp(req: OTPRequest, db: Session = Depends(get_db)):
    otp = str(random.randint(100000, 999999))
    expiry = time.time() + 300 # 5 min

    # Upsert OTP record
    existing = db.query(OTPRecord).filter(OTPRecord.email == req.email).first()
    if existing:
        existing.otp = otp
        existing.expiry = expiry
    else:
        db.add(OTPRecord(email=req.email, otp=otp, expiry=expiry))
    db.commit()
    
    # Send email
    email_sent = await send_email_otp_async(req.email, otp)
    print(f"\n[AUTH] OTP for {req.email}: {otp} (email sent: {email_sent})\n")
    
    if not email_sent:
         return {"success": False, "error": "Failed to send email. Ensure SMTP credentials in .env are correct."}

    return {"success": True, "message": "OTP sent to your email"}

@app.post("/api/v1/auth/otp/verify")
async def verify_otp(req: OTPVerify, db: Session = Depends(get_db)):
    record = db.query(OTPRecord).filter(OTPRecord.email == req.email).first()
    if not record:
        return {"success": False, "error": "No OTP found for this email"}
    
    if time.time() > record.expiry:
        db.delete(record)
        db.commit()
        return {"success": False, "error": "OTP has expired"}
    
    if req.otp != record.otp:
        return {"success": False, "error": "Invalid OTP code"}
    
    # Success: Delete the OTP record and load user data
    db.delete(record)
    db.commit()
    
    user_data = None
    path = get_user_data_path(req.email)
    if os.path.exists(path):
        with open(path, "r") as f:
            user_data = json.load(f)
            
    return {
        "success": True,
        "user": {
            "id": f"email_{req.email}",
            "email": req.email,
            "name": req.email.split('@')[0].capitalize(),
            "picture": None
        },
        "stored_data": user_data
    }

@app.post("/api/v1/user/save_data")
async def save_user_data(data: UserDataStore):
    try:
        path = get_user_data_path(data.email)
        with open(path, "w") as f:
            json.dump({
                "patients": data.patients,
                "hospital": data.hospital
            }, f)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

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
