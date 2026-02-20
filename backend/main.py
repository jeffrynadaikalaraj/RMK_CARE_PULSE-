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

GOOGLE_CLIENT_ID = "625094222230-d9ihjsrcl49h5qr9ggv18spjllpa6u7i.apps.googleusercontent.com"
DATA_DIR = "data"

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Initialize database
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="CarePulse++ Auth System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OTPRequest(BaseModel):
    email: EmailStr

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str

class AuthToken(BaseModel):
    token: str

def get_user_data_path(email: str):
    return os.path.join(DATA_DIR, f"{email.replace('@', '_at_')}.json")

@app.post("/api/v1/auth/google")
async def auth_google(auth_req: AuthToken, db: Session = Depends(database.get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(auth_req.token, requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo['email']
        
        # Instead of direct login, trigger OTP
        otp_code = otp_utils.generate_otp()
        otp_hash = otp_utils.hash_otp(otp_code)
        expires_at = datetime.utcnow() + timedelta(minutes=10)

        # Cleanup & Store
        db.query(models.OTP).filter(models.OTP.email == email).delete()
        new_otp = models.OTP(email=email, otp_hash=otp_hash, expires_at=expires_at, attempts=0)
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
    otp_code = otp_utils.generate_otp()
    otp_hash = otp_utils.hash_otp(otp_code)
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Clean up old OTP if exists
    db.query(models.OTP).filter(models.OTP.email == req.email).delete()
    
    # Store new OTP
    new_otp = models.OTP(
        email=req.email,
        otp_hash=otp_hash,
        expires_at=expires_at,
        attempts=0
    )
    db.add(new_otp)
    db.commit()

    # Send via SMTP
    email_sent = await otp_utils.send_otp_email(req.email, otp_code)
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email"
        )

    return {"message": "OTP sent successfully", "email": req.email}

@app.post("/verify-otp")
async def verify_otp(req: OTPVerify, db: Session = Depends(database.get_db)):
    otp_record = db.query(models.OTP).filter(models.OTP.email == req.email).first()

    if not otp_record:
        raise HTTPException(status_code=404, detail="No OTP requested for this email")

    # Check expiration
    if datetime.utcnow() > otp_record.expires_at:
        db.delete(otp_record)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP has expired")

    # Check attempts
    if otp_record.attempts >= 3:
        db.delete(otp_record)
        db.commit()
        raise HTTPException(status_code=400, detail="Too many failed attempts. Request a new OTP.")

    # Verify code
    if not otp_utils.verify_otp(req.otp, otp_record.otp_hash):
        otp_record.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail=f"Invalid OTP code. {3 - otp_record.attempts} attempts remaining.")

    # Success: Generate JWT
    access_token = auth.create_access_token(data={"sub": req.email})
    
    # Get or create user
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        user = models.User(email=req.email)
        db.add(user)
    
    # Clean up OTP after success
    db.delete(otp_record)
    db.commit()

    # Load clinical data
    user_data = None
    path = get_user_data_path(req.email)
    if os.path.exists(path):
        with open(path, "r") as f:
            user_data = json.load(f)

    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user_email": req.email,
        "user": {
            "id": f"email_{req.email}",
            "email": req.email,
            "name": req.email.split('@')[0].capitalize(),
            "picture": None
        },
        "stored_data": user_data
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
