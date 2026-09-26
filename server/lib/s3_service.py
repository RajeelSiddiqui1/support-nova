import os
import io
import mimetypes
import logging
from typing import Optional, Dict, Any
from botocore.exceptions import ClientError
import boto3

logger = logging.getLogger("NovaWear.S3Service")

class S3Service:
    """
    AWS S3 Cloud Storage Service for NovaWear Apparel.
    Handles upload, override, retrieval, and deletion of Policy PDFs and Web Form Complaint Attachments.
    Complies with serverless / Vercel cloud deployments where ephemeral local disk storage is unavailable.
    """

    def __init__(self):
        self.access_key = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
        self.secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
        self.region = os.getenv("AWS_REGION", "us-east-1").strip()
        self.bucket_name = (
            os.getenv("AWS_S3_BUCKET_NAME") or
            os.getenv("S3_BUCKET_NAME") or
            os.getenv("AWS_BUCKET_NAME") or
            "supportnova-storage"
        ).strip()
        self.endpoint_url = os.getenv("AWS_S3_ENDPOINT_URL", "").strip() or None

        self._s3_client = None

    def is_configured(self) -> bool:
        """Checks if valid AWS S3 credentials are configured."""
        return bool(self.access_key and self.secret_key and self.bucket_name)

    def _get_client(self):
        if self._s3_client is None:
            if not self.is_configured():
                logger.warning("AWS S3 credentials not fully configured in environment. Using fallback mode.")
                return None
            try:
                session = boto3.session.Session()
                client_kwargs = {
                    "aws_access_key_id": self.access_key,
                    "aws_secret_access_key": self.secret_key,
                    "region_name": self.region
                }
                if self.endpoint_url:
                    client_kwargs["endpoint_url"] = self.endpoint_url

                self._s3_client = session.client("s3", **client_kwargs)
            except Exception as e:
                logger.error(f"Failed to initialize S3 client: {e}")
                self._s3_client = None

        return self._s3_client

    def upload_file_bytes(
        self,
        file_bytes: bytes,
        s3_key: str,
        content_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Uploads or OVERRIDES a file in AWS S3 bucket.
        Returns dict with s3_url, s3_key, bucket, and size.
        """
        s3_key = s3_key.lstrip("/")

        if not content_type:
            content_type, _ = mimetypes.guess_type(s3_key)
            if not content_type:
                content_type = "application/octet-stream"

        client = self._get_client()

        if client is not None:
            try:
                logger.info(f"Uploading {len(file_bytes)} bytes to s3://{self.bucket_name}/{s3_key} (Content-Type: {content_type})...")
                client.put_object(
                    Bucket=self.bucket_name,
                    Key=s3_key,
                    Body=file_bytes,
                    ContentType=content_type
                )

                if self.endpoint_url:
                    s3_url = f"{self.endpoint_url.rstrip('/')}/{self.bucket_name}/{s3_key}"
                else:
                    if self.region == "us-east-1":
                        s3_url = f"https://{self.bucket_name}.s3.amazonaws.com/{s3_key}"
                    else:
                        s3_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{s3_key}"

                return {
                    "storage": "S3",
                    "url": s3_url,
                    "s3_key": s3_key,
                    "bucket": self.bucket_name,
                    "file_size_kb": round(len(file_bytes) / 1024, 2)
                }

            except Exception as e:
                logger.error(f"S3 put_object failed ({e}). Falling back to local storage.", exc_info=True)

        # Fallback for local development when AWS credentials not yet provided
        import tempfile
        if os.getenv("VERCEL") or os.getenv("VERCEL_ENV"):
            local_base = os.path.join(tempfile.gettempdir(), "uploads")
        else:
            local_base = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
            
        local_target = os.path.join(local_base, s3_key.replace("/", os.sep))
        try:
            os.makedirs(os.path.dirname(local_target), exist_ok=True)
        except Exception as me:
            logger.warning(f"Local upload directory creation failed: {me}")

        try:
            with open(local_target, "wb") as f:
                f.write(file_bytes)
        except Exception as fe:
            logger.warning(f"Local file write skipped on read-only filesystem: {fe}")

        fallback_url = f"/uploads/{s3_key}"
        return {
            "storage": "LOCAL_FALLBACK",
            "url": fallback_url,
            "s3_key": s3_key,
            "bucket": "local",
            "file_size_kb": round(len(file_bytes) / 1024, 2)
        }

    def delete_file(self, s3_key: str) -> bool:
        """
        Deletes a file from the AWS S3 bucket.
        """
        if not s3_key:
            return False

        s3_key = s3_key.lstrip("/")
        client = self._get_client()

        if client is not None:
            try:
                logger.info(f"Deleting s3://{self.bucket_name}/{s3_key} from S3 bucket...")
                client.delete_object(Bucket=self.bucket_name, Key=s3_key)
                return True
            except Exception as e:
                logger.error(f"Failed to delete S3 object {s3_key}: {e}")

        # Also remove from local fallback if exists
        try:
            local_target = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", s3_key.replace("/", os.sep))
            if os.path.exists(local_target):
                os.remove(local_target)
        except Exception:
            pass

        return True

    def get_file_bytes(self, s3_key: str) -> Optional[bytes]:
        """
        Downloads / retrieves file bytes from S3.
        """
        s3_key = s3_key.lstrip("/")
        client = self._get_client()

        if client is not None:
            try:
                response = client.get_object(Bucket=self.bucket_name, Key=s3_key)
                return response["Body"].read()
            except Exception as e:
                logger.error(f"Failed to fetch S3 object {s3_key}: {e}")

        # Fallback: check local
        local_target = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", s3_key.replace("/", os.sep))
        if os.path.exists(local_target):
            with open(local_target, "rb") as f:
                return f.read()

        return None

# Singleton instance
s3_service = S3Service()
