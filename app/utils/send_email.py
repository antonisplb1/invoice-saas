import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

def send_invoice_email(to_email: str, subject: str, content: str):
    message = Mail(
        from_email=os.getenv("SENDER_EMAIL"),
        to_emails=to_email,
        subject=subject,
        html_content=content
    )

    sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
    response = sg.send(message)

    return response.status_code
