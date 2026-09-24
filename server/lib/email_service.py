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

    @staticmethod
    def send_ticket_created_notification(to_email: str, ticket_id: str, title: str, department: str):
        subject = f"📨 Complaint Registered [{ticket_id}] — SupportNova"
        html = f"""
        <div style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 30px; border-radius: 12px; max-width: 540px; color: #0F172A; border: 1px solid #E2E8F0;">
            <h2 style="color: #7C3AED; margin-top: 0;">Complaint Registered Successfully 🎉</h2>
            <p>Dear Customer,</p>
            <p>Your complaint has been successfully registered and assigned to our <strong>{department}</strong> team for AI analysis and resolution.</p>
            
            <div style="background: #FFF; padding: 18px; border-radius: 10px; border: 1px solid #CBD5E1; margin: 20px 0;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: bold; color: #64748B; text-transform: uppercase;">Ticket Reference ID</p>
                <p style="font-family: monospace; font-size: 22px; font-weight: bold; color: #7C3AED; margin: 0 0 12px 0;">{ticket_id}</p>

                <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; color: #64748B; text-transform: uppercase;">Subject / Title</p>
                <p style="font-size: 14px; font-weight: bold; color: #0F172A; margin: 0;">{title}</p>
            </div>

            <p style="font-size: 13px; color: #64748B;">Our AI pipeline has analyzed your complaint against company SLA guidelines. An agent will contact you shortly.</p>
            <p><a href="http://localhost:3000/customer/dashboard" style="background: #7C3AED; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View Ticket Status</a></p>
        </div>
        """
        return EmailService.send_email(to_email, subject, html)

    @staticmethod
    def send_ticket_status_update(to_email: str, ticket_id: str, title: str, status: str, agent_notes: str = ""):
        status_color = "#059669" if status in ["Resolved", "RESOLVED"] else "#2563EB" if status in ["In Progress", "IN_PROGRESS"] else "#64748B"
        subject = f"🔔 Ticket Status Update [{ticket_id}] → {status}"
        html = f"""
        <div style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 30px; border-radius: 12px; max-width: 540px; color: #0F172A; border: 1px solid #E2E8F0;">
            <h2 style="color: {status_color}; margin-top: 0;">Ticket Status Updated to '{status}'</h2>
            <p>Dear Customer,</p>
            <p>The status of your complaint <strong>[{ticket_id}] {title}</strong> has been updated.</p>
            
            <div style="background: #FFF; padding: 18px; border-radius: 10px; border: 1px solid #CBD5E1; margin: 20px 0;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: bold; color: #64748B; text-transform: uppercase;">New Status</p>
                <p style="font-size: 18px; font-weight: bold; color: {status_color}; margin: 0 0 14px 0;">{status}</p>

                {f'<p style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; color: #64748B; text-transform: uppercase;">Agent Resolution Notes</p><p style="font-size: 13px; color: #334155; margin: 0; line-height: 1.5;">{agent_notes}</p>' if agent_notes else ''}
            </div>

            <p style="font-size: 12px; color: #64748B;">Thank you for your patience while we resolve your issue.</p>
            <p><a href="http://localhost:3000/customer/dashboard" style="background: {status_color}; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Check Dashboard</a></p>
        </div>
        """
        return EmailService.send_email(to_email, subject, html)

    @staticmethod
    def send_ticket_reassigned_notification(
        to_email: str,
        previous_agent_name: str,
        new_agent_name: str,
        ticket_id: str,
        title: str,
        reason: str = "Manager reassignment / policy non-compliance",
        manager_name: str = "Department Manager"
    ):
        """Notifies previous agent that their access to the ticket has been revoked and reassigned."""
        subject = f"⚠️ Ticket Access Revoked & Reassigned [{ticket_id}] — By {manager_name}"
        html = f"""
        <div style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 30px; border-radius: 12px; max-width: 540px; color: #0F172A; border: 1px solid #E2E8F0;">
            <div style="background: #FEF2F2; border-left: 4px solid #EF4444; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                <h3 style="color: #DC2626; margin: 0 0 4px 0; font-size: 16px;">Ticket Access Revoked & Transferred</h3>
                <p style="margin: 0; font-size: 12px; color: #991B1B;">You have been removed from this ticket by your Department Manager.</p>
            </div>

            <p>Hello <strong>{previous_agent_name}</strong>,</p>
            <p>Your access to Ticket <strong>[{ticket_id}]</strong> has been revoked by <strong>{manager_name}</strong>, and the ticket has been reassigned to <strong>{new_agent_name}</strong>.</p>
            
            <div style="background: #FFF; padding: 18px; border-radius: 10px; border: 1px solid #CBD5E1; margin: 20px 0;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: bold; color: #64748B; text-transform: uppercase;">Ticket Reference ID</p>
                <p style="font-family: monospace; font-size: 20px; font-weight: bold; color: #7C3AED; margin: 0 0 10px 0;">{ticket_id}</p>

                <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; color: #64748B; text-transform: uppercase;">Ticket Title</p>
                <p style="font-size: 14px; font-weight: bold; color: #0F172A; margin: 0 0 10px 0;">{title}</p>

                <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; color: #DC2626; text-transform: uppercase;">Reason for Revocation / Reassignment</p>
                <div style="font-size: 13px; color: #991B1B; background: #FEF2F2; padding: 10px 14px; border-radius: 8px; border: 1px solid #FCA5A5; font-weight: 600;">
                    {reason}
                </div>
            </div>

            <div style="background: #F1F5F9; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
                    🔒 <strong>Access Notice:</strong> You can no longer update status, take actions, or send customer replies on this ticket. Your previous actions remain logged in the ticket's permanent audit history.
                </p>
            </div>

            <p><a href="http://localhost:3000/agent/workspace" style="background: #64748B; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View Workspace Queue</a></p>
        </div>
        """
        return EmailService.send_email(to_email, subject, html)

    @staticmethod
    def send_ticket_assigned_notification(
        to_email: str,
        new_agent_name: str,
        ticket_id: str,
        title: str,
        description: str,
        priority: str,
        department: str,
        assigned_by_name: str = "Manager"
    ):
        """Notifies newly assigned agent with ticket details and urgency context."""
        prio_color = "#E11D48" if priority == "P0" else "#D97706" if priority == "P1" else "#2563EB"
        subject = f"🚨 New Ticket Assigned to You [{ticket_id}] — Priority: {priority}"
        html = f"""
        <div style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 30px; border-radius: 12px; max-width: 540px; color: #0F172A; border: 1px solid #E2E8F0;">
            <h2 style="color: #7C3AED; margin-top: 0;">New Ticket Assigned to You! 🎯</h2>
            <p>Hello <strong>{new_agent_name}</strong>,</p>
            <p>A ticket has been assigned to your active queue by <strong>{assigned_by_name}</strong> for urgent attention.</p>
            
            <div style="background: #FFF; padding: 18px; border-radius: 10px; border: 1px solid #CBD5E1; margin: 20px 0;">
                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                    <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #7C3AED;">{ticket_id}</span>
                    <span style="font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 6px; background: {prio_color}15; color: {prio_color};">Priority: {priority}</span>
                    <span style="font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 6px; background: #EFF6FF; color: #2563EB;">{department}</span>
                </div>

                <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; color: #64748B; text-transform: uppercase;">Subject / Title</p>
                <p style="font-size: 14px; font-weight: bold; color: #0F172A; margin: 0 0 10px 0;">{title}</p>

                <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; color: #64748B; text-transform: uppercase;">Customer Complaint Description</p>
                <p style="font-size: 13px; color: #334155; margin: 0; line-height: 1.5; background: #F8FAFC; padding: 10px; border-radius: 8px;">{description[:300]}{'...' if len(description) > 300 else ''}</p>
            </div>

            <p style="font-size: 12px; color: #64748B;">Please review this ticket promptly in your Agent Workspace and begin resolution.</p>
            <p><a href="http://localhost:3000/agent/workspace" style="background: #7C3AED; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Open in Agent Workspace</a></p>
        </div>
        """
        return EmailService.send_email(to_email, subject, html)

    @staticmethod
    def send_department_manager_override_notification(
        to_email: str,
        manager_name: str,
        ticket_id: str,
        title: str,
        old_department: str,
        new_department: str,
        changed_by_name: str = "Admin Nova"
    ):
        """Notifies Department Manager when Admin overrides and moves a ticket into their department."""
        subject = f"🏢 Department Routing Update [{ticket_id}] — Moved to {new_department}"
        html = f"""
        <div style="font-family: Arial, sans-serif; background: #F8FAFC; padding: 30px; border-radius: 12px; max-width: 540px; color: #0F172A; border: 1px solid #E2E8F0;">
            <h2 style="color: #7C3AED; margin-top: 0;">Department Routing Alert 🏢</h2>
            <p>Hello Manager <strong>{manager_name}</strong>,</p>
            <p>An administrator (<strong>{changed_by_name}</strong>) has re-routed ticket <strong>[{ticket_id}]</strong> to your department (<strong>{new_department}</strong>).</p>
            
            <div style="background: #FFF; padding: 18px; border-radius: 10px; border: 1px solid #CBD5E1; margin: 20px 0;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: bold; color: #64748B; text-transform: uppercase;">Ticket Reference</p>
                <p style="font-family: monospace; font-size: 20px; font-weight: bold; color: #7C3AED; margin: 0 0 10px 0;">{ticket_id}</p>

                <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: bold; color: #64748B; text-transform: uppercase;">Title</p>
                <p style="font-size: 14px; font-weight: bold; color: #0F172A; margin: 0 0 10px 0;">{title}</p>

                <div style="background: #EFF6FF; padding: 10px; border-radius: 8px; font-size: 12px; color: #1E40AF;">
                    Previous Department: <strong>{old_department}</strong> ➔ New Department: <strong>{new_department}</strong>
                </div>
            </div>

            <p style="font-size: 12px; color: #64748B;">Previous agent assignment has been cleared. The ticket is now available in your department's shared pool for agent claim or manager assignment.</p>
            <p><a href="http://localhost:3000/reviewer/queue" style="background: #7C3AED; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View Department Queue</a></p>
        </div>
        """
        return EmailService.send_email(to_email, subject, html)
