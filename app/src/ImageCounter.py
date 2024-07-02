import os, psycopg2, json
from collections import defaultdict


class ImageCounter:
    def __init__(self, db_connection_string):
        self.db_connection_string = db_connection_string

    def insert_into_db(
        self,
        mill_name,
        machine_name,
        date,
        count_details,
        comment,
        validateionMachineFolders,
    ):

        try:
            conn = psycopg2.connect(self.db_connection_string)
            cursor = conn.cursor()

            # Convert count_details dictionary to JSON string
            count_details_json = json.dumps(count_details)

            cursor.execute(
                "SELECT * FROM mill_details WHERE date = %s AND mill_name = %s AND machine_name=%s",
                (date, mill_name, machine_name),
            )
            existing_record = cursor.fetchone()

            if existing_record:

                cursor.execute(
                    "UPDATE mill_details SET count_details=%s, comments=%s,folder_validated=%s WHERE date = %s AND mill_name = %s AND machine_name = %s ",
                    (
                        count_details_json,  # Store count_details as JSON string
                        comment,
                        validateionMachineFolders,
                        date,
                        mill_name,
                        machine_name,
                    ),
                )
            else:

                cursor.execute(
                    "INSERT INTO mill_details (mill_name, machine_name, date, count_details, comments, folder_validated) VALUES (%s, %s, %s, %s, %s, %s)",
                    (
                        mill_name,
                        machine_name,
                        date,
                        count_details_json,  # Store count_details as JSON string
                        comment,
                        validateionMachineFolders,
                    ),
                )

            conn.commit()
            print("Data inserted successfully into the database.")

        except psycopg2.Error as e:
            print("Error inserting data into the database:", e)

        finally:
            if conn:
                cursor.close()
                conn.close()

    def insert_multiple_machines_into_db(
        self, current_mill_name, all_machine_names, formatted_date
    ):
        try:
            conn = psycopg2.connect(self.db_connection_string)
            cursor = conn.cursor()

            for machine_name in all_machine_names:
                cursor.execute(
                    "INSERT INTO mill_details (mill_name, machine_name, date) VALUES (%s, %s, %s)",
                    (
                        current_mill_name,
                        machine_name,
                        formatted_date,
                    ),
                )

            conn.commit()
            print("Data inserted successfully into the database.")

        except psycopg2.Error as e:
            print("Error inserting data into the database:", e)

        finally:
            if conn:
                cursor.close()
                conn.close()
