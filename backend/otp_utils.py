import random
import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from dotenv import load_dotenv
import hashlib

load_dotenv()

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS=os.getenv("MAIL_STARTTLS", "True") == "True",
    MAIL_SSL_TLS=os.getenv("MAIL_SSL_TLS", "False") == "True",
    USE_CREDENTIALS=True
)

def generate_otp():
    return str(random.randint(100000, 999999))

def hash_otp(otp: str):
    return hashlib.sha256(otp.encode()).hexdigest()

def verify_otp_hash(otp: str, hashed_otp: str):
    return hashlib.sha256(otp.encode()).hexdigest() == hashed_otp

async def send_otp_email(email: str, otp: str):
    message = MessageSchema(
        subject="CarePulse++ OTP Verification",
        recipients=[email],
        body=f"""
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
        """,
        subtype="html"
    )

    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
