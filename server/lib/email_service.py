import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@supportnova.ai")

class EmailService:
    @staticmethod
    def send_email(to_email: str, subject: str, html_content: str):
        """Sends real SMTP email if SMTP_USER is set, or logs clearly to terminal console."""
        print(f"\n📧 [EMAIL SERVICE INITIATED] -> {to_email}")
        print(f"📌 Subject: {subject}")

        is_placeholder = (
            not SMTP_USER 
            or not SMTP_PASS 
            or "your_email" in SMTP_USER 
            or "your_app_password" in SMTP_PASS
        )

        if is_placeholder:
            print("\n" + "="*65)
            print(f"📧 [EMAIL CONSOLE MODE] Destination: {to_email}")
            print(f"📌 Subject: {subject}")
            print("⚠️ SMTP Credentials not configured in server/.env!")
            print("💡 For REAL inbox delivery, set SMTP_USER & SMTP_PASS (Gmail App Password) in server/.env")
            print("="*65 + "\n")
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = FROM_EMAIL
            msg["To"] = to_email
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(FROM_EMAIL, to_email, msg.as_string())

            print(f"✅ REAL EMAIL SENT TO: {to_email}\n")
            return True
        except Exception as e:
            print(f"❌ SMTP Error sending to {to_email}: {e}\n")
            return False

    @staticmethod
    def send_staff_credentials(to_email: str, name: str, role: str, temp_password: str):
        subject = "🔑 Welcome to SupportNova — Your Account Credentials"
        html = f"""
        <div style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 30px; border-radius: 12px; max-width: 500px; color: #0F172A;">
            <h2 style="color: #7C3AED;">Welcome to SupportNova! 👋</h2>
            <p>Hello <strong>{name}</strong>,</p>
            <p>An administrator has created your staff account on SupportNova with the role of <strong>{role}</strong>.</p>
            <div style="background: #FFF; padding: 20px; border-radius: 10px; border: 1px solid #E2E8F0; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #64748B; font-size: 12px; font-weight: bold; text-transform: uppercase;">Temporary Login Password</p>
                <p style="font-family: monospace; font-size: 22px; font-weight: bold; color: #7C3AED; margin: 0;">{temp_password}</p>
            </div>
            <p style="color: #E11D48; font-size: 13px; font-weight: bold;">⚠️ Security Notice: This temporary password expires upon first login. You will be required to set a new password.</p>
            <p><a href="http://localhost:3000/login" style="background: #7C3AED; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 15px;">Login to Portal</a></p>
        </div>
        """
        return EmailService.send_email(to_email, subject, html)

    @staticmethod
    def send_otp(to_email: str, otp_code: str):
        subject = "🔐 SupportNova Password Reset OTP Code"
        print("\n" + "*"*60)
        print(f"🔑 [FORGOT PASSWORD OTP CODE FOR {to_email}]: {otp_code}")
        print("*"*60 + "\n")
        
        html = f"""
        <div style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 30px; border-radius: 12px; max-width: 500px; color: #0F172A;">
            <h2 style="color: #7C3AED;">Password Reset Code</h2>
            <p>Your 6-digit One-Time Password (OTP) to reset your SupportNova password is:</p>
            <div style="background: #F5F3FF; padding: 20px; text-align: center; border-radius: 10px; border: 1px solid #7C3AED; margin: 20px 0;">
                <span style="font-family: monospace; font-size: 32px; font-weight: bold; color: #7C3AED; letter-spacing: 6px;">{otp_code}</span>
            </div>
            <p style="color: #64748B; font-size: 12px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
        </div>
        """
        return EmailService.send_email(to_email, subject, html)

    @staticmethod
    def send_password_reset_success(to_email: str):
        subject = "✅ SupportNova Password Reset Successful"
        html = f"""
        <div style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 30px; border-radius: 12px; max-width: 500px; color: #0F172A;">
            <h2 style="color: #059669;">Password Changed Successfully</h2>
            <p>Your SupportNova password has been reset successfully. You can now log into your account using your new password.</p>
            <p><a href="http://localhost:3000/login" style="background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 15px;">Login Now</a></p>
        </div>
        """
        return EmailService.send_email(to_email, subject, html)

    @staticmethod
    def send_account_activation(to_email: str, name: str):
        subject = "✅ SupportNova Account Activated"
        html = f"""
        <div style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 30px; border-radius: 12px; max-width: 500px; color: #0F172A;">
            <h2 style="color: #059669;">Account Activated 👋</h2>
            <p>Hello <strong>{name}</strong>,</p>
            <p>Your SupportNova account has been re-activated by an administrator. You can now log back into your portal.</p>
            <p><a href="http://localhost:3000/login" style="background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 15px;">Login Now</a></p>
        </div>
        """
        return EmailService.send_email(to_email, subject, html)
