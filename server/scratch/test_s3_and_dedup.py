import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.s3_service import s3_service
from email_ingestion import compute_email_fingerprint, extract_message_id

def test_s3_service():
    print("[*] Testing S3 Service...")
    sample_bytes = b"PDF dummy content for policy verification."
    s3_key = "policies/test_policy_001.pdf"

    # Upload test
    res = s3_service.upload_file_bytes(sample_bytes, s3_key, "application/pdf")
    print(f"[+] Upload result: storage={res.get('storage')}, url={res.get('url')}, key={res.get('s3_key')}")
    assert res.get("url") is not None
    assert res.get("s3_key") == s3_key

    # Override test
    res_override = s3_service.upload_file_bytes(b"Overridden content in S3", s3_key, "application/pdf")
    print(f"[+] Override result: storage={res_override.get('storage')}, url={res_override.get('url')}")

    # Delete test
    del_res = s3_service.delete_file(s3_key)
    print(f"[+] Delete result: {del_res}")
    assert del_res is True

def test_dedup_helpers():
    print("[*] Testing Email Fingerprint & Deduplication...")
    f1 = compute_email_fingerprint("user@gmail.com", "Delayed package", "2026-09-26", "Where is my order?")
    f2 = compute_email_fingerprint("USER@GMAIL.COM", "Delayed package", "2026-09-26", "where is my order?")
    print(f"[+] Fingerprint 1: {f1}")
    print(f"[+] Fingerprint 2: {f2}")
    assert f1 == f2, "Fingerprint must be case-insensitive and deterministic"

if __name__ == "__main__":
    test_s3_service()
    test_dedup_helpers()
    print("\n[ALL TESTS PASSED SUCCESSFULLY!]")
