import sqlite3
import os

db_path = "backend/auth.db"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check existing columns in users table
    cursor.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor.fetchall()]
    
    new_columns = [
        ("full_name", "TEXT"),
        ("role", "TEXT DEFAULT 'Staff'"),
        ("department", "TEXT"),
        ("staff_id", "TEXT"),
        ("access_level", "TEXT DEFAULT 'Restricted'"),
        ("status", "TEXT DEFAULT 'Online'"),
        ("password_hash", "TEXT"),
        ("last_login", "DATETIME")
    ]
    
    for col_name, col_type in new_columns:
        if col_name not in columns:
            print(f"Adding column {col_name} to users table...")
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
    
    conn.commit()
    conn.close()
    print("Database schema updated successfully.")
else:
    print("Database file not found. It will be created on next run.")
