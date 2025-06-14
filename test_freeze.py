from freezegun import freeze_time
from app.tasks.recurrence import generate_recurring_invoices
from app.models import invoice, customer  # 👈 ensure models are loaded

if __name__ == "__main__":
    with freeze_time("2025-10-01"):
        print("⏳ Freezing time at:", __import__("datetime").date.today())
        generate_recurring_invoices()
        print("✅ Done running recurrence job under frozen date.")
