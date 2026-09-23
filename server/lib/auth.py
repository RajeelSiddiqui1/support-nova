import os
import random
import string
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "supportnova_jwt_secret_key_2026")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

def hash_password(password: str) -> str:
    """Hashes password using PBKDF2 SHA-256 algorithm"""
    salt = os.urandom(16).hex()
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return f"{salt}:{pwd_hash}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plain password against stored PBKDF2 hash"""
    try:
        salt, stored_hash = hashed_password.split(":")
        pwd_hash = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()
        return hmac.compare_digest(stored_hash, pwd_hash)
    except Exception:
        return False

def generate_temp_password(length: int = 10) -> str:
    """Generates secure temporary password e.g. Nova#8492!"""
    upper = random.choice(string.ascii_uppercase)
    lower = random.choice(string.ascii_lowercase)
    digits = ''.join(random.choices(string.digits, k=4))
    special = random.choice("@#$!")
    chars = ''.join(random.choices(string.ascii_letters + string.digits, k=length - 7))
    temp_pwd = f"Nova{upper}{lower}{digits}{special}{chars}"
    return temp_pwd

def generate_otp(length: int = 6) -> str:
    """Generates 6-digit numeric OTP"""
    return ''.join(random.choices(string.digits, k=length))
