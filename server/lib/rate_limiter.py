import time
from typing import Dict, Tuple, Optional, Any
from fastapi import Request, HTTPException, status

# Configuration Constants
LOCKOUT_DURATION_SECONDS = 300  # 5 minutes lockout
MAX_FAILED_ATTEMPTS = 5         # 5 failed attempts before lockout

class TargetedActorRateLimiter:
    """
    High-Security Targeted Actor Rate Limiter for Login & Credential Intake.
    
    KEY ARCHITECTURAL RULE:
    Blocks ONLY the specific offending actor (client_ip + attempted_email).
    Does NOT block the whole IP, so other legitimate users (Admin, Agent, Manager)
    testing from the same IP / localhost / office NAT can continue logging in seamlessly!
    """

    def __init__(self):
        # Key: (client_ip, normalized_email) -> {"failures": int, "lockout_until": float, "last_attempt": float}
        self._actor_attempts: Dict[Tuple[str, str], Dict[str, float]] = {}
        # Key: client_ip -> {"distinct_bad_emails": set, "ip_lockout_until": float} (DDoS safeguard)
        self._ip_abuse_tracker: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def get_client_ip(request: Request) -> str:
        """
        Extracts real client IP reliably, honoring Vercel, Cloudflare, and Reverse Proxy headers.
        """
        # 1. Vercel / Reverse Proxy headers
        x_forwarded_for = request.headers.get("x-forwarded-for")
        if x_forwarded_for:
            # First IP in comma-separated list is the original client
            client_ip = x_forwarded_for.split(",")[0].strip()
            if client_ip:
                return client_ip

        # 2. Direct headers
        x_real_ip = request.headers.get("x-real-ip")
        if x_real_ip:
            return x_real_ip.strip()

        cf_ip = request.headers.get("cf-connecting-ip")
        if cf_ip:
            return cf_ip.strip()

        # 3. Direct socket connection
        if request.client and request.client.host:
            return request.client.host

        return "127.0.0.1"

    def check_lockout(self, client_ip: str, email: str) -> Tuple[bool, int]:
        """
        Checks if the specific (client_ip, email) actor is currently in a 5-minute lockout.
        Returns: (is_locked: bool, remaining_seconds: int)
        """
        key = (client_ip, email.lower().strip())
        record = self._actor_attempts.get(key)
        if not record:
            return False, 0

        now = time.time()
        lockout_until = record.get("lockout_until", 0)
        if now < lockout_until:
            remaining = int(lockout_until - now)
            return True, remaining

        # Lockout period expired; reset failures count
        if lockout_until > 0 and now >= lockout_until:
            record["failures"] = 0
            record["lockout_until"] = 0

        return False, 0

    def record_failure(self, client_ip: str, email: str) -> Dict[str, Any]:
        """
        Records a failed credential attempt (wrong password or non-existent account).
        If attempts reach MAX_FAILED_ATTEMPTS (5), triggers 5-minute lockout (300s).
        """
        now = time.time()
        key = (client_ip, email.lower().strip())
        
        if key not in self._actor_attempts:
            self._actor_attempts[key] = {
                "failures": 0,
                "lockout_until": 0,
                "first_attempt": now,
                "last_attempt": now
            }

        record = self._actor_attempts[key]
        record["failures"] = int(record.get("failures", 0)) + 1
        record["last_attempt"] = now

        failures = record["failures"]

        if failures >= MAX_FAILED_ATTEMPTS:
            record["lockout_until"] = now + LOCKOUT_DURATION_SECONDS
            remaining = LOCKOUT_DURATION_SECONDS
            return {
                "is_locked": True,
                "failures": failures,
                "remaining_seconds": remaining,
                "remaining_minutes": round(remaining / 60, 1),
                "message": (
                    f"Security Alert: 5 consecutive failed attempts for '{email}'. "
                    f"Login for this email is locked for 5 minutes from this connection. "
                    f"Other users on your IP remain unaffected."
                )
            }

        attempts_left = MAX_FAILED_ATTEMPTS - failures
        return {
            "is_locked": False,
            "failures": failures,
            "attempts_left": attempts_left,
            "remaining_seconds": 0,
            "message": f"Invalid credentials. {attempts_left} attempts remaining before a 5-minute lockout."
        }

    def reset_failures(self, client_ip: str, email: str):
        """
        Resets failed attempts on successful login.
        """
        key = (client_ip, email.lower().strip())
        if key in self._actor_attempts:
            del self._actor_attempts[key]

    def manual_unban(self, email: str, client_ip: Optional[str] = None):
        """
        Developer & Admin testing helper to release a lockout immediately.
        """
        email_clean = email.lower().strip()
        keys_to_remove = []
        for k in self._actor_attempts.keys():
            if k[1] == email_clean:
                if client_ip is None or k[0] == client_ip:
                    keys_to_remove.append(k)

        for k in keys_to_remove:
            del self._actor_attempts[k]

        return len(keys_to_remove)

# Global Singleton Instance
targeted_rate_limiter = TargetedActorRateLimiter()
