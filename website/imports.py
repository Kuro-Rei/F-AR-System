import pandas as pd
from . import db

def import_excel(file, filename, user_id):
    df = pd.read_excel(file, sheet_name="Sales Data")

    df = df[["Date", "Location", "Count", "Size (Kilos)", "Price"]]
    df = df.dropna()

    # Don't wipe the existing data if the new file has nothing usable
    if df.empty:
        raise ValueError("No valid rows found in the 'Sales Data' sheet.")

    df["Date"] = pd.to_datetime(df["Date"]).dt.date

    conn = db.get_connection()
    cur = conn.cursor()

    try:
        # Remove all existing records 
        cur.execute("UPDATE activity_logs SET booking_id = NULL WHERE booking_id IS NOT NULL")
        cur.execute("DELETE FROM salt")
        cur.execute("DELETE FROM price")
        cur.execute("DELETE FROM booking")

        # import new files
        cur.execute(
            "INSERT INTO import_records (user_id, file_name, row_count) VALUES (%s,%s,%s)",
            (user_id, filename, len(df)))
        import_id = cur.lastrowid
        location_ids = {}

        for booking_date, location, count, size, price in df.itertuples(index=False):
            location = str(location).strip()

            # if a location is new, add to the table
            if location not in location_ids:
                cur.execute(
                    "INSERT INTO location (location_name) VALUES (%s) "
                    "ON DUPLICATE KEY UPDATE location_id = LAST_INSERT_ID(location_id)",
                    (location,))
                location_ids[location] = cur.lastrowid

            cur.execute(
                "INSERT INTO booking (import_id, location_id, booking_date, quantity) VALUES (%s, %s, %s, %s)",
                (import_id, location_ids[location], booking_date, int(count)))
            booking_id = cur.lastrowid

            cur.execute("INSERT INTO salt (booking_id, size_kilos) VALUES (%s, %s)", (booking_id, float(size)))
            cur.execute("INSERT INTO price (booking_id, price) VALUES (%s, %s)", (booking_id, float(price)))

        cur.execute(
            "INSERT INTO activity_logs (user_id, action, details) VALUES (%s, 'IMPORT', %s)",
            (user_id, "Replaced all records with " + filename + " (" + str(len(df)) + " rows)"))

        conn.commit()          # remove old records if the new imported records has no error/s
        return {"imported": len(df), "skipped": 0}

    except Exception:
        conn.rollback() # keep old record if the new imported record failed
        raise
    finally:
        cur.close()
        conn.close()