import mysql.connector

def get_connection():
    db = mysql.connector.connect(
        host ="localhost",
        user = "root",
        password = "root",
        database = "ledger_db"
    )

    return db
    
if __name__ == "__main__":
    try:
        db = get_connection()

        if db.is_connected():   
            print("database connected")

    except mysql.connector.Error as err:
        print("Error", err)

    finally:
        if 'db' in locals() and db.is_connected():
            db.close()
            print("closed database")




