# test.py (place this at the project root, alongside app/)

from app.tasks.recurrence import generate_recurring_invoices

if __name__ == "__main__":
    generate_recurring_invoices()
    print("Recurrence job run complete.")
