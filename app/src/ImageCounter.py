import os, psycopg2, json
from collections import defaultdict


class ImageCounter:
    def __init__(self, validation_folder, db_connection_string):
        self.validation_folder = validation_folder
        self.db_connection_string = db_connection_string

    def count_fp_tp_images(self):
        results = []

        mill_folders = os.listdir(self.validation_folder)
        for mill_name in mill_folders:
            mill_path = os.path.join(self.validation_folder, mill_name)
            if os.path.isdir(mill_path):
                machine_folders = os.listdir(mill_path)
                for machine_name in machine_folders:
                    machine_path = os.path.join(mill_path, machine_name)
                    if os.path.isdir(machine_path):
                        roll_numbers = os.listdir(machine_path)
                        for roll_number in roll_numbers:
                            roll_path = os.path.join(machine_path, roll_number)
                            if os.path.isdir(roll_path):
                                dates = os.listdir(roll_path)
                                for date in dates:
                                    date_path = os.path.join(roll_path, date)
                                    if os.path.isdir(date_path):
                                        label_folders = os.listdir(date_path)
                                        tp_count = 0
                                        fp_count = 0

                                        for label in label_folders:
                                            label_path = os.path.join(date_path, label)
                                            if os.path.isdir(label_path):
                                                tp_folder = os.path.join(
                                                    label_path, "tp"
                                                )
                                                fp_folder = os.path.join(
                                                    label_path, "fp"
                                                )

                                                if os.path.exists(tp_folder):
                                                    tp_count += len(
                                                        os.listdir(tp_folder)
                                                    )
                                                if os.path.exists(fp_folder):
                                                    fp_count += len(
                                                        os.listdir(fp_folder)
                                                    )

                                        results.append(
                                            {
                                                "mill_name": mill_name,
                                                "machine_name": machine_name,
                                                "date": date,
                                                "total_tp_count": tp_count,
                                                "total_fp_count": fp_count,
                                            }
                                        )

        # Aggregate results based on mill name, machine name, and date
        aggregated_results = defaultdict(lambda: defaultdict(int))
        for result in results:
            mill_name = result["mill_name"]
            machine_name = result["machine_name"]
            date = result["date"]
            total_tp_count = result["total_tp_count"]
            total_fp_count = result["total_fp_count"]
            key = (mill_name, machine_name, date)
            aggregated_results[key]["total_tp_count"] += total_tp_count
            aggregated_results[key]["total_fp_count"] += total_fp_count

        # Convert aggregated results to the desired output format
        final_results = []
        for key, counts in aggregated_results.items():
            mill_name, machine_name, date = key
            final_results.append(
                {
                    "mill_name": mill_name,
                    "machine_name": machine_name,
                    "date": date,
                    "total_tp_count": counts["total_tp_count"],
                    "total_fp_count": counts["total_fp_count"],
                }
            )
        print("+++++++++++++++++++++++++++++++++++++++++")
        print(final_results)
        print("+++++++++++++++++++++++++++++++++++++++++++++")

        return final_results

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
