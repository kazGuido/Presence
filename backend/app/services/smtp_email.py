import smtplib
from email.message import EmailMessage

from app.core.config import get_settings


def smtp_configured() -> bool:
    s = get_settings()
    return bool(s.smtp_host and s.smtp_from_email)


def send_plain_email(to_addr: str, subject: str, body: str) -> None:
    s = get_settings()
    if not smtp_configured():
        raise ValueError("SMTP is not configured")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{s.smtp_from_name} <{s.smtp_from_email}>" if s.smtp_from_name else s.smtp_from_email
    msg["To"] = to_addr
    msg.set_content(body)
    if s.smtp_use_tls:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=30) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=30) as smtp:
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
