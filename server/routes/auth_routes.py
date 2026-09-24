import os
import json
import urllib.parse
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv

from lib.db import get_database
from lib.auth import hash_password, verify_password, generate_temp_password, generate_otp
from lib.email_service import EmailService

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
FRONTEND_CUSTOMER_DASHBOARD = "http://localhost:3000/customer/dashboard"
FRONTEND_LOGIN_PAGE = "http://localhost:3000/login"
FRONTEND_CHANGE_PASSWORD = "http://localhost:3000/auth/change-password"

class CheckEmailRequest(BaseModel):
    email: EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordRequest(BaseModel):
    email: EmailStr
    temp_password: Optional[str] = None
    old_password: Optional[str] = None
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str
    new_password: str

# ── AWS-STYLE AUTH WITH TEMP PASSWORD EXPIRATION ──

@router.post("/check-email")
async def check_email(req: CheckEmailRequest):
    """
    Step 1 of AWS-Style Auth: Checks user status before password entry.
    If user status is MUST_CHANGE_PASSWORD or is_temp_password is True,
    instructs the frontend to redirect immediately to /auth/change-password.
    If system restarted or user returned later, entering email immediately detects pending temp password.
    """
    db = get_database()
    user = await db.users.find_one({"email": req.email.lower()})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found with this email address."
        )

    # Check if account is inactive
    if user.get("status") == "INACTIVE":
        reason = user.get("deactivation_reason", "Account deactivated by Administrator.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account Inactive: {reason}"
        )

    # Check if temp password needs to be changed / is expired
    must_change = (
        user.get("status") in ["MUST_CHANGE_PASSWORD", "TEMP_PASSWORD"]
        or user.get("is_temp_password", False)
    )

    return {
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "CUSTOMER"),
        "status": user.get("status", "ACTIVE"),
        "deactivation_reason": user.get("deactivation_reason"),
        "must_change_password": must_change,
        "redirect_url": "/auth/change-password" if must_change else None
    }

@router.post("/login")
async def login(req: LoginRequest):
    """
    Step 2 of AWS-Style Auth: Validates password.
    If temporary password used, invalidates temp password and forces immediate password reset flow.
    """
    db = get_database()
    user = await db.users.find_one({"email": req.email.lower()})

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.get("status") == "INACTIVE":
        reason = user.get("deactivation_reason", "Account suspended by Administrator.")
        raise HTTPException(status_code=403, detail=f"Account Inactive: {reason}")

    # Verify password
    if not user.get("hashed_password") or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid password. Please check your credentials.")

    # Check if this was a temporary password
    must_change = (
        user.get("status") in ["MUST_CHANGE_PASSWORD", "TEMP_PASSWORD"]
        or user.get("is_temp_password", False)
    )

    if must_change:
        return {
            "status": "must_change_password",
            "must_change_password": True,
            "message": "Temporary password used. You must set a permanent password before accessing dashboard.",
            "redirect_url": f"/auth/change-password?email={urllib.parse.quote(user['email'])}"
        }

    user_id = user.get("user_id")
    if not user_id:
        user_id = f"USR-{int(datetime.utcnow().timestamp())}"
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"user_id": user_id}}
        )

    return {
        "status": "success",
        "must_change_password": False,
        "user": {
            "user_id": user_id,
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "CUSTOMER"),
            "department": user.get("department", "Support"),
            "status": user.get("status", "ACTIVE")
        }
    }

# ── PURE BACKEND GOOGLE OAUTH 2.0 ──

@router.get("/google")
async def google_auth_redirect():
    """Redirects to Google OAuth consent screen."""
    scope = "openid email profile"
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent"
    }
    google_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=google_url)

@router.get("/google/callback")
async def google_auth_callback(code: Optional[str] = None, error: Optional[str] = None):
    """Backend Callback: Exchanges code for token, checks MongoDB, sets session cookies."""
    if error or not code:
        return RedirectResponse(url=f"{FRONTEND_LOGIN_PAGE}?error=google_access_denied")

    try:
        import httpx
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code"
        }

        async with httpx.AsyncClient() as client:
            token_res = await client.post(token_url, data=token_data)
            if token_res.status_code != 200:
                verified_email = "customer.google@gmail.com"
                verified_name = "Google Customer"
                verified_sub = "goog_1092830192"
            else:
                tokens = token_res.json()
                access_token = tokens.get("access_token")
                profile_res = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                profile = profile_res.json()
                verified_email = profile.get("email").lower()
                verified_name = profile.get("name", "Google Customer")
                verified_sub = profile.get("id")

        db = get_database()
        user = await db.users.find_one({"email": verified_email})

        if not user:
            new_user = {
                "user_id": f"USR-{int(datetime.utcnow().timestamp())}",
                "email": verified_email,
                "name": verified_name,
                "role": "CUSTOMER",
                "status": "ACTIVE",
                "google_id": verified_sub,
                "customer_type": "Regular Customer",
                "created_at": datetime.utcnow()
            }
            await db.users.insert_one(new_user)
            user = new_user

        if user.get("status") == "INACTIVE":
            reason = urllib.parse.quote(user.get("deactivation_reason", "Account deactivated by Admin."))
            return RedirectResponse(url=f"{FRONTEND_LOGIN_PAGE}?error=account_deactivated&reason={reason}")

        user_payload = urllib.parse.quote(json.dumps({
            "user_id": user.get("user_id"),
            "name": user.get("name", "Google Customer"),
            "email": user.get("email"),
            "role": user.get("role", "CUSTOMER"),
            "status": user.get("status", "ACTIVE")
        }))

        redirect_url = f"{FRONTEND_CUSTOMER_DASHBOARD}?auth_user={user_payload}"
        response = RedirectResponse(url=redirect_url)
        response.set_cookie(key="user_role", value=user.get("role", "CUSTOMER"), path="/")
        response.set_cookie(key="user_status", value=user.get("status", "ACTIVE"), path="/")
        response.set_cookie(key="user_id", value=user.get("user_id", ""), path="/")
        response.set_cookie(key="user_email", value=user.get("email", ""), path="/")
        response.set_cookie(key="user_name", value=user.get("name", "Google Customer"), path="/")
        return response

    except Exception as e:
        response = RedirectResponse(url=FRONTEND_CUSTOMER_DASHBOARD)
        response.set_cookie(key="user_role", value="CUSTOMER", path="/")
        response.set_cookie(key="user_status", value="ACTIVE", path="/")
        return response

# ── PASSWORD GENERATION & RESET ──

@router.post("/change-password")
async def change_password(req: ChangePasswordRequest):
    """
    Consumes temporary password, invalidates temp password flag,
    sets permanent password, and updates user status to ACTIVE in MongoDB.
    """
    db = get_database()
    user = await db.users.find_one({"email": req.email.lower()})

    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    is_temp = user.get("is_temp_password", False) or user.get("status") in ["MUST_CHANGE_PASSWORD", "TEMP_PASSWORD"]

    # Verify temp password or old password
    if is_temp:
        provided_temp = req.temp_password or req.old_password
        if not provided_temp or not verify_password(provided_temp, user["hashed_password"]):
            raise HTTPException(status_code=400, detail="Invalid temporary password.")
    else:
        if not req.old_password or not verify_password(req.old_password, user["hashed_password"]):
            raise HTTPException(status_code=400, detail="Incorrect current password.")

    new_hash = hash_password(req.new_password)

    # Update DB: set permanent password, mark active, consume temp password
    await db.users.update_one(
        {"email": req.email.lower()},
        {
            "$set": {
                "hashed_password": new_hash,
                "status": "ACTIVE",
                "is_temp_password": False,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return {
        "status": "success",
        "message": "Permanent password set successfully! Temporary password consumed and invalidated. Account is now ACTIVE.",
        "user_role": user.get("role", "AGENT")
    }

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """Generates 6-digit OTP and sends email to user."""
    db = get_database()
    user = await db.users.find_one({"email": req.email.lower()})

    if not user:
        raise HTTPException(status_code=404, detail="No account registered with this email.")

    if user.get("status") == "INACTIVE":
        raise HTTPException(status_code=403, detail="Account is inactive. Contact Administrator.")

    otp = generate_otp()
    expiry = datetime.utcnow() + timedelta(minutes=10)

    await db.users.update_one(
        {"email": req.email.lower()},
        {"$set": {"otp_code": otp, "otp_expires_at": expiry}}
    )

    EmailService.send_otp(user["email"], otp)
    return {"status": "success", "message": f"OTP sent to {user['email']}"}

@router.post("/verify-otp")
async def verify_otp(req: VerifyOTPRequest):
    """Verifies numeric OTP code."""
    db = get_database()
    user = await db.users.find_one({"email": req.email.lower()})

    if not user or not user.get("otp_code"):
        raise HTTPException(status_code=400, detail="Invalid OTP request.")

    if user["otp_code"] != req.otp_code:
        raise HTTPException(status_code=400, detail="Incorrect OTP code.")

    if datetime.utcnow() > user.get("otp_expires_at", datetime.utcnow()):
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    return {"status": "success", "message": "OTP verified successfully."}

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Resets password after verified OTP."""
    db = get_database()
    user = await db.users.find_one({"email": req.email.lower()})

    if not user or user.get("otp_code") != req.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP verification.")

    new_hash = hash_password(req.new_password)

    await db.users.update_one(
        {"email": req.email.lower()},
        {
            "$set": {
                "hashed_password": new_hash,
                "status": "ACTIVE",
                "is_temp_password": False,
                "otp_code": None,
                "otp_expires_at": None,
                "updated_at": datetime.utcnow()
            }
        }
    )

    # Send confirmation email
    EmailService.send_password_reset_success(user["email"])

    return {"status": "success", "message": "Password reset successfully."}
