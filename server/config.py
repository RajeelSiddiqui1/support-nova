import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")

class EmailConfig(BaseSettings):
    """
    Application Settings for NovaWear Apparel Email Integration Module.
    Loads configuration directly from server/.env file.
    """
    SUPPORT_EMAIL: str = Field(default="", description="System support email address")
    EMAIL_APP_PASSWORD: str = Field(default="", description="IMAP/SMTP app password")
    
    SMTP_USER: str = Field(default="", description="SMTP user email")
    SMTP_PASS: str = Field(default="", description="SMTP password")
    
    IMAP_SERVER: str = Field(default="imap.gmail.com", description="IMAP server hostname")
    IMAP_PORT: int = Field(default=993, description="IMAP port (SSL/TLS)")
    
    SMTP_SERVER: str = Field(default="smtp.gmail.com", description="SMTP server hostname")
    SMTP_HOST: str = Field(default="smtp.gmail.com", description="SMTP host alias")
    SMTP_PORT: int = Field(default=587, description="SMTP port (TLS)")
    FROM_EMAIL: str = Field(default="support@novawearapparel.com", description="From email header")

    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_email(self) -> str:
        val = self.SUPPORT_EMAIL or self.SMTP_USER or os.getenv("SMTP_USER", "")
        return str(val).strip()

    def get_password(self) -> str:
        val = self.EMAIL_APP_PASSWORD or self.SMTP_PASS or os.getenv("SMTP_PASS", "")
        return str(val).replace(" ", "").strip()

    def get_imap_server(self) -> str:
        return self.IMAP_SERVER or "imap.gmail.com"

    def get_smtp_server(self) -> str:
        return self.SMTP_HOST or self.SMTP_SERVER or "smtp.gmail.com"

email_config = EmailConfig()
