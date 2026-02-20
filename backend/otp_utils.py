import random
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import hashlib

def generate_otp():
    return "".join([str(random.randint(0, 9)) for _ in range(6)])

def hash_otp(otp: str):
    return hashlib.sha256(otp.encode()).hexdigest()

def verify_otp(otp: str, hashed_otp: str):
    return hashlib.sha256(otp.encode()).hexdigest() == hashed_otp

async def send_otp_email(to_email: str, otp: str):
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("EMAIL")
    smtp_pass = os.getenv("PASSWORD")

    if not smtp_user or not smtp_pass:
        print(f"\n[AUTH DEBUG] No SMTP credentials found. OTP for {to_email}: {otp}\n")
        return True

    message = MIMEMultipart()
    message["From"] = smtp_user
    message["To"] = to_email
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
                <p style="font-size: 14px; color: #6b7280; text-align: center;">This code will expire in 10 minutes.</p>
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
            hostname=smtp_server,
            port=smtp_port,
            start_tls=True,
            username=smtp_user,
            password=smtp_pass,
        )
        return True
    except Exception as e:
        print(f"\n[SMTP ERROR] CRITICAL FAILURE: {e}")
        return False
