import json
import psycopg2


class Database:
    def __init__(self, source_db_config, destination_db_config):
        self.source_db_config = source_db_config
        self.destination_db_config = destination_db_config

    def fetch_defect_data(self, selected_date):
        try:
            # Connect to the source database (kpr-2)
            source_connection = psycopg2.connect(**self.source_db_config)
            source_cursor = source_connection.cursor()

            # Fetch defect data from the defect_details table for the selected date
            source_cursor.execute(
                "SELECT defecttyp_id, revolution, timestamp FROM defect_details WHERE DATE(timestamp) = %s",
                (selected_date,),
            )
            defect_data = source_cursor.fetchall()
            print(len(defect_data))
            return defect_data

        except psycopg2.Error as e:
            print("Error fetching defect data:", e)
            return None

        finally:
            if source_connection:
                source_cursor.close()
                source_connection.close()

    def insert_data(self, selected_date, data):
        try:
            # Connect to the destination database (main)
            destination_connection = psycopg2.connect(**self.destination_db_config)
            destination_cursor = destination_connection.cursor()

            # Group defect types by their counts
            defect_counts = {}
            total_revolutions = 0
            for defect_id, revolution, _ in data:
                if defect_id in defect_counts:
                    defect_counts[defect_id] += 1
                else:
                    defect_counts[defect_id] = 1
                total_revolutions += int(revolution)  # Convert to integer

            # Serialize the defect_counts dictionary to a JSON string
            defect_counts_json = json.dumps(defect_counts)

            # Insert data into the kpr2 table in the main database
            destination_cursor.execute(
                "INSERT INTO kpr2 (date, defect_name,no_of_revolutions) VALUES (%s, %s, %s)",
                (selected_date, defect_counts_json, total_revolutions),
            )

            # Commit the transaction
            destination_connection.commit()

            print("Data inserted successfully.")

        except psycopg2.Error as e:
            print("Error inserting data:", e)

        finally:
            if destination_connection:
                destination_cursor.close()
                destination_connection.close()
