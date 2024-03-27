import os
import psycopg2


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
                roll_numbers = os.listdir(mill_path)

                for roll_number in roll_numbers:
                    roll_path = os.path.join(mill_path, roll_number)
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
                                        tp_folder = os.path.join(label_path, "tp")
                                        fp_folder = os.path.join(label_path, "fp")

                                        if os.path.exists(tp_folder):
                                            tp_count += len(os.listdir(tp_folder))
                                        if os.path.exists(fp_folder):
                                            fp_count += len(os.listdir(fp_folder))

                                results.append(
                                    {
                                        "mill_name": mill_name,
                                        "date": date,
                                        "total_tp_count": tp_count,
                                        "total_fp_count": fp_count,
                                    }
                                )

        return results

    def insert_into_db(self, results):
        try:
            conn = psycopg2.connect(self.db_connection_string)
            cursor = conn.cursor()

            for result in results:
                mill_name = result["mill_name"]
                date = result["date"]
                tp_count = result["total_tp_count"]
                fp_count = result["total_fp_count"]

                # Check if record already exists
                cursor.execute(
                    "SELECT * FROM mill_details WHERE date = %s AND mill_name = %s",
                    (date, mill_name),
                )
                existing_record = cursor.fetchone()

                if existing_record:
                    # If record exists, update it
                    cursor.execute(
                        "UPDATE mill_details SET true_positive = %s, false_positive = %s WHERE date = %s AND mill_name = %s",
                        (tp_count, fp_count, date, mill_name),
                    )
                else:
                    # If record doesn't exist, insert it
                    cursor.execute(
                        "INSERT INTO mill_details (mill_name, date, true_positive, false_positive) VALUES (%s, %s, %s, %s)",
                        (mill_name, date, tp_count, fp_count),
                    )

            conn.commit()
            print("Data inserted successfully into the database.")

        except psycopg2.Error as e:
            print("Error inserting data into the database:", e)

        finally:
            if conn:
                cursor.close()
                conn.close()
