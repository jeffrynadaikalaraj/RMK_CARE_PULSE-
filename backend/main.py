from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import models
import database
import otp_utils
import auth
from pydantic import BaseModel, EmailStr
import os
import json
from google.oauth2 import id_token
from google.auth.transport import requests
from typing import List
import pandas as pd

GOOGLE_CLIENT_ID = "625094222230-d9ihjsrcl49h5qr9ggv18spjllpa6u7i.apps.googleusercontent.com"
EXCEL_FILE = "Patient_Clinical_Data.xlsx"

# Initialize folders
DATA_DIR = "data"
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Initialize database
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="CarePulse++ Professional Auth System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMAS ---
class AuthToken(BaseModel):
    token: str

class OTPRequest(BaseModel):

    email: EmailStr

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserDataStore(BaseModel):
    email: str
    patients: List[dict]
    hospital: dict


# --- HELPERS ---
def get_user_data_path(email: str):
    return os.path.join(DATA_DIR, f"{email.replace('@', '_at_')}.json")

# --- ENDPOINTS ---

@app.post("/api/v1/auth/google")
async def auth_google(auth_req: AuthToken, db: Session = Depends(database.get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(auth_req.token, requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo['email']
        
        # Instead of direct login, trigger OTP
        otp_code = otp_utils.generate_otp()
        otp_hash = otp_utils.hash_otp(otp_code)

        # Cleanup & Store
        db.query(models.OTP).filter(models.OTP.email == email).delete()
        new_otp = models.OTP(email=email, otp_code=otp_hash)
        db.add(new_otp)
        db.commit()

        # Send Email
        email_sent = await otp_utils.send_otp_email(email, otp_code)
        print(f"\n[GOOGLE-AUTH] OTP for {email}: {otp_code} (email sent: {email_sent})\n")

        return {
            "success": True, 
            "otp_sent": True,
            "email": email,
            "message": "Google verified. Please check your email for the verification code."
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/request-otp")
async def request_otp(req: OTPRequest, db: Session = Depends(database.get_db)):
    """
    STEP 5 Implementation: Generate and Send OTP
    Professional touch: Hashing OTP and Cleanup old ones
    """
    otp_code = otp_utils.generate_otp()
    otp_hash = otp_utils.hash_otp(otp_code)

    # Clean up old OTPs for this email
    db.query(models.OTP).filter(models.OTP.email == req.email).delete()
    
    # Store new OTP (hashed for security)
    new_otp = models.OTP(
        email=req.email,
        otp_code=otp_hash
    )
    db.add(new_otp)
    db.commit()

    # Send via FastAPI-Mail (implementation in otp_utils.py)
    email_sent = await otp_utils.send_otp_email(req.email, otp_code)
    
    if not email_sent:
        raise HTTPException(
            status_code=500,
            detail="Failed to send verification email. Check SMTP settings."
        )

    return {"message": "OTP sent successfully", "email": req.email}

@app.post("/verify-otp")
async def verify_otp(req: OTPVerify, db: Session = Depends(database.get_db)):
    """
    STEP 6 Implementation: Verify OTP
    Professional touch: JWT Token return and Expire after 5 mins
    """
    # Fetch most recent OTP
    record = db.query(models.OTP).filter(models.OTP.email == req.email).order_by(models.OTP.id.desc()).first()

    if not record:
        raise HTTPException(status_code=400, detail="No OTP found for this email")

    # Verify code (Professional: use verify_otp_hash)
    if not otp_utils.verify_otp_hash(req.otp, record.otp_code):
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    # Expire OTP after 5 minutes (Professional requirement)
    if datetime.utcnow() - record.created_at > timedelta(minutes=5):
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP has expired")

    # Success: Generate JWT (Professional Architecture)
    access_token = auth.create_access_token(data={"sub": req.email})
    
    # User Creation/Fetch Logic
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        user = models.User(
            email=req.email,
            full_name=req.email.split('@')[0].capitalize(),
            role="Nurse",
            department="Emergency",
            staff_id=f"CP-{req.email.split('@')[0].upper()}-01",
            access_level="Medium",
            status="Online",
            last_login=datetime.utcnow()
        )
        db.add(user)
    else:
        user.last_login = datetime.utcnow()
    
    # Clean up OTP after success (Professional Touch)
    db.delete(record)
    db.commit()
    db.refresh(user)

    # Load clinical data
    user_data = None
    path = get_user_data_path(req.email)
    if os.path.exists(path):
        with open(path, "r") as f:
            user_data = json.load(f)

    return {
        "success": True,
        "message": "OTP verified successfully",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.full_name,
            "role": user.role,
            "department": user.department,
            "staff_id": user.staff_id,
            "access_level": user.access_level,
            "status": user.status,
            "last_login": user.last_login.isoformat() if user.last_login else None
        },
        "stored_data": user_data
    }

@app.post("/login")
async def login(req: LoginRequest, db: Session = Depends(database.get_db)):
    """Professional Architecture: Secure Password Login"""
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or not user.password_hash or not auth.verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user.last_login = datetime.utcnow()
    db.commit()
    
    access_token = auth.create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.full_name,
            "role": user.role,
            "department": user.department,
            "staff_id": user.staff_id,
            "access_level": user.access_level,
            "status": user.status,
            "last_login": user.last_login.isoformat()
        }
    }

@app.post("/api/v1/user/save_data")
async def save_user_data(data: UserDataStore):
    """Original clinical data persistence endpoint"""
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

@app.get("/me")
async def get_me(current_user: models.User = Depends(auth.get_current_user)):
    """Fetch current user from JWT"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.full_name,
        "role": current_user.role,
        "department": current_user.department,
        "staff_id": current_user.staff_id,
        "access_level": current_user.access_level,
        "status": current_user.status,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None
    }

@app.post("/logout")
async def logout(token: str = Depends(auth.oauth2_scheme), db: Session = Depends(database.get_db)):
    """Secure Session Termination via Token Blocklist"""
    db.add(models.TokenBlocklist(token=token))
    db.commit()
    return {"message": "Logged out successfully"}

class ProfileUpdate(BaseModel):
    full_name: str
    department: str
    role: str
    status: str

@app.put("/me/update")
async def update_profile(req: ProfileUpdate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    """Update current user profile"""
    current_user.full_name = req.full_name
    current_user.department = req.department
    current_user.role = req.role
    current_user.status = req.status
    db.commit()
    db.refresh(current_user)
    return {"success": True, "user": current_user}

@app.post("/api/v1/patients/add")
async def add_patient(req: dict, current_user: models.User = Depends(auth.get_current_user)):
    """
    Adds a new patient to global Excel.
    The frontend will then update its local state and call save_data to persist in JSON.
    """
    patient = req.get("patient")
    if not patient:
        raise HTTPException(status_code=400, detail="Missing patient data")

    # 1. Sequential ID Generation
    new_id = 1
    if os.path.exists(EXCEL_FILE):
        try:
            df = pd.read_excel(EXCEL_FILE)
            if not df.empty and 'patient_id' in df.columns:
                # Filter out non-numeric IDs if any, then find max
                numeric_ids = pd.to_numeric(df['patient_id'], errors='coerce')
                if not numeric_ids.isna().all():
                    new_id = int(numeric_ids.max()) + 1
                else:
                    new_id = len(df) + 1
            else:
                new_id = 1
        except Exception as e:
            print(f"ID Gen Error: {e}")
            new_id = random.randint(10000, 99999) # Fallback
    
    patient["patient_id"] = str(new_id)

    # 2. Update Excel
    try:
        if os.path.exists(EXCEL_FILE):
            df = pd.read_excel(EXCEL_FILE)
            new_row_df = pd.DataFrame([patient])
            # Ensure columns match
            for col in df.columns:
                if col not in new_row_df.columns:
                    new_row_df[col] = None
            # Reorder columns to match
            new_row_df = new_row_df[df.columns]
            df = pd.concat([df, new_row_df], ignore_index=True)
            df.to_excel(EXCEL_FILE, index=False)
        else:
             pd.DataFrame([patient]).to_excel(EXCEL_FILE, index=False)
    except Exception as e:
        print(f"Excel Update Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update Excel: {str(e)}")

    return {"success": True, "patient": patient}

# --- RBAC ---
def check_role(roles: List[str]):
    def role_checker(current_user: models.User = Depends(auth.get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Forbidden: Insufficient privileges")
        return current_user
    return role_checker

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
