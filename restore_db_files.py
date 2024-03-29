import os
import psycopg2


class DBRestorer:
    def __init__(self, db_folder_path, db_host, db_port, db_user):
        self.db_folder_path = db_folder_path
        self.db_host = db_host
        self.db_port = db_port
        self.db_user = db_user

    def restore_databases(self):
        # Connect to PostgreSQL and query the db_details table
        try:
            conn = psycopg2.connect(
                host=self.db_host,
                port=self.db_port,
                user=self.db_user,
                dbname="main",
            )
            conn.autocommit = True
            cur = conn.cursor()

            # Query db_details table for available files
            cur.execute("SELECT file_name FROM db_details")
            available_files = [row[0] for row in cur.fetchall()]

            # Iterate over the available files and check if they exist in the folder
            for file_name in available_files:
                if f"{file_name}.sql" in os.listdir(self.db_folder_path):
                    self.restore_db(f"{file_name}.sql")
                else:
                    print(f"The file '{file_name}.sql' is not available in the folder.")

            cur.close()
            conn.close()
        except psycopg2.Error as e:
            print(f"Error: Unable to connect to PostgreSQL - {e}")

    def restore_db(self, file_name):
        # Connect to PostgreSQL and restore the database
        try:
            db_name = os.path.splitext(file_name)[0]
            conn = psycopg2.connect(
                host=self.db_host,
                port=self.db_port,
                user=self.db_user,
                dbname="postgres",
            )
            conn.autocommit = True
            cur = conn.cursor()

            # Check if the database already exists
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
            exists = cur.fetchone()

            if not exists:
                # Create the database with proper quoting for the name
                cur.execute(f'CREATE DATABASE "{db_name}"')

            # Restore the database from the file
            db_file_path = os.path.join(self.db_folder_path, file_name)
            os.system(
                f'psql -h {self.db_host} -p {self.db_port} -U {self.db_user} -d "{db_name}" -f "{db_file_path}"'
            )

            print(f"The database '{db_name}' has been successfully restored.")

            cur.close()
            conn.close()
        except psycopg2.Error as e:
            print(f"Error: Unable to connect to PostgreSQL - {e}")
