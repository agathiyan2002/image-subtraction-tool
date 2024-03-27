from db import Database
import os
import base64
import json
from flask import Flask, jsonify, render_template, request
import psycopg2
import shutil
import json
from datetime import datetime
from restore_db_files import DBRestorer
import schedule
import threading
import time
from ImageCounter import (
    ImageCounter,
)

import shutil

app = Flask(__name__)


db_instance = Database(
    source_db_config={
        "user": "postgres",
        "password": "soft",
        "host": "localhost",
        "port": "5432",
        "database": "postgres",
    },
    destination_db_config={
        "user": "postgres",
        "password": "soft",
        "host": "localhost",
        "port": "5432",
        "database": "main",
    },
)


# Define the destination folder for saving images
destination_folder = os.path.join("static", "temp")


def fetch_roll_details(selected_date):
    all_roll_details = {}

    try:
        # Connect to the PostgreSQL database
        connection = psycopg2.connect(
            user="postgres",
            password="soft",
            host="localhost",
            port="5432",
            database="postgres",  # Connect to the default 'postgres' database
        )

        # Create a cursor object
        cursor = connection.cursor()

        # Query to fetch all database names except system databases
        cursor.execute(
            "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres', 'main');"
        )
        db_names = cursor.fetchall()

        for db_name in db_names:
            db_name = db_name[0]  # Extract database name from the result tuple

            # Connect to the current database
            db_connection = psycopg2.connect(
                user="postgres",
                password="soft",
                host="localhost",
                port="5432",
                database=db_name,  # Connect to the current database
            )

            # Create a cursor object for the current database
            db_cursor = db_connection.cursor()

            # SQL query to fetch roll_number and timestamp based on selected_date
            sql_query = """SELECT roll_number, timestamp FROM roll_details WHERE DATE(timestamp) = %s"""

            # Execute the SQL query
            db_cursor.execute(sql_query, (selected_date,))

            # Fetch all rows
            roll_details = db_cursor.fetchall()

            if roll_details:  # If data found for the selected date
                formatted_roll_details = [
                    {"roll_number": roll_number, "date": date.strftime("%Y-%m-%d")}
                    for roll_number, date in roll_details
                ]
                all_roll_details[db_name] = formatted_roll_details

            # Close the cursor and connection for the current database
            db_cursor.close()
            db_connection.close()

        return all_roll_details

    except (Exception, psycopg2.Error) as error:
        print("Error fetching roll details:", error)
        return None

    finally:
        # Close the cursor and connection for the default database
        if connection:
            cursor.close()
            connection.close()


# Function to check if roll details exist in the folder structure
def check_roll_details_exist(formatted_roll_details, base_folder):
    all_mill_images = []
    missing_date_folders = []

    # add list vairavle here this for Date folder {date_folder} does not exist.
    for database_name, roll_details in formatted_roll_details.items():
        database_images = {}
        for roll_detail in roll_details:
            roll_number = roll_detail["roll_number"]
            date = roll_detail["date"]
            date_folder = os.path.join(base_folder, database_name, roll_number, date)
            if not os.path.exists(date_folder):
                print(f"Date folder {date_folder} does not exist.")
                missing_date_folders.append(date_folder)

                continue

            print(f"Roll details found for {roll_number} on {date} in {database_name}.")
            # Decrypt JSON files and save images
            images = decrypt_and_save_images(
                date_folder, database_name, roll_number, date
            )
            if images:
                if database_name not in database_images:
                    database_images[database_name] = {}
                if roll_number not in database_images[database_name]:
                    database_images[database_name][roll_number] = {}
                if date not in database_images[database_name][roll_number]:
                    database_images[database_name][roll_number][date] = images

        all_mill_images.append(database_images)

    return all_mill_images, missing_date_folders


def decrypt_and_save_images(date_folder, database_name, roll_number, date):
    images = []
    stored_images = set()  # Set to keep track of stored images

    # Iterate through files in the source folder
    for root, _, files in os.walk(date_folder):
        for file in files:
            if file.endswith(".json"):
                json_file_path = os.path.join(root, file)
                with open(json_file_path, "r") as f:
                    json_data = json.load(f)

                # Decrypt JSON data
                image_data = base64.b64decode(json_data["imageData"])

                # Create label folders dynamically
                label_folder_path = os.path.join(
                    destination_folder,
                    database_name,
                    roll_number,
                    date,
                    json_data["shapes"][0]["label"],
                )
                os.makedirs(label_folder_path, exist_ok=True)

                # Save image to the label folder if not already stored
                image_path = os.path.join(
                    label_folder_path, os.path.basename(json_data["imagePath"])
                )
                if image_path not in stored_images:
                    if not os.path.exists(image_path):  # Check if image already exists
                        with open(image_path, "wb") as img_file:
                            img_file.write(image_data)

                        # Add image path to the list
                        images.append(
                            {
                                "label": json_data["shapes"][0]["label"],
                                "image_path": image_path,
                            }
                        )

                        # Add the stored image path to the set
                        stored_images.add(image_path)

    print("Storing images completed successfully.")
    return images


@app.route("/update-records", methods=["POST"])
def update_records_api():
    if request.method == "POST":
        # Extract updated record data from the request
        updated_record = request.get_json()

        # Call the update_records function with the updated_record data
        success = db_instance.update_records(updated_record)

        if success:
            return jsonify({"message": "Record updated successfully"})
        else:
            return jsonify({"error": "Failed to update record"}), 500


@app.route("/", methods=["GET", "POST"])
def index():
    roll_details = []  # Initialize roll details list
    alert_message = None  # Initialize alert message
    all_mill_images = []  # Initialize all mill images list

    if request.method == "POST":
        clear_temp_folder()
        selected_date = request.form["date"]
        print("Received date:", selected_date)

        # Fetch roll details based on the date
        roll_details = fetch_roll_details(selected_date)

        if roll_details == {}:  # If no data found for the selected date
            # print("No data available for the selected date.")
            alert_message = "No data available for the selected date."

        else:
            # Define the base folder where the data folders are located
            base_folder = r"/home/alan/data/"
            all_mill_images, missing_date_folders = check_roll_details_exist(
                roll_details, base_folder
            )

            # Return JSON response
            return jsonify(
                {
                    "all_mill_images": all_mill_images,
                    "missing_date_folders": missing_date_folders,
                }
            )

    return render_template("index.html")


def clear_temp_folder():
    # Clear the temporary folder
    temp_folder = os.path.join("static", "temp")
    if os.path.exists(temp_folder):
        shutil.rmtree(temp_folder)
    os.makedirs(temp_folder, exist_ok=True)



@app.route("/move-image", methods=["POST"])
def move_image():
    source = request.form.get("source")
    destination = request.form.get("destination")
    print("+++++++++++++++")
    print("Source:", source)
    print("Destination:", destination)
    print("+++++++++++++++")

    try:
        # Check if the source file exists
        if not os.path.exists(source):
            return "Source file does not exist.", 500
        
        # Create destination folder if it doesn't exist
        os.makedirs(destination, exist_ok=True)

        # Move the image file
        _, filename = os.path.split(source)
        destination_path = os.path.join(destination, filename)
        print("Destination path:", destination_path)
        
        if os.path.exists(destination_path):
            print("File already exists in destination.")
            return "File already exists in destination.", 500

        shutil.move(source, destination_path)
        print("File moved to:", destination_path)  # Print the destination path
        
        if os.path.exists(destination_path):
            print("File exists in destination.")

            validation_folder = r"/home/alan/validation/"
            db_connection_string = (
                "dbname='main' user='postgres' host='localhost' password='soft'"
            )
            image_counter = ImageCounter(validation_folder, db_connection_string)
            results = image_counter.count_fp_tp_images()
            print("Results:", results)
            image_counter.insert_into_db(results)

            return "Image moved successfully."
        else:
            return "File does not exist in destination.", 500
        
    except Exception as e:
        print("Error:", e)  # Print the error
        return str(e), 500


@app.route("/dashboard", methods=["GET", "POST"])
def dashboard():
    if request.method == "POST":
        selected_date = request.form.get("date")
        print("Selected Date:", selected_date)

        db_instance.fetch_all_databases_data(selected_date)

        records = db_instance.fetch_records_by_date(selected_date)
        formatted_records = [
            (date.strftime("%Y-%m-%d"), *rest) for date, *rest in records
        ]

        # print(records)
        return jsonify(formatted_records)

    else:
        return render_template("dashboard.html")


def restore_databases_daily():
    db_folder_path = "/home/alan/db/"
    db_host = "localhost"
    db_port = "5432"
    db_user = "postgres"
    os.environ["PGPASSWORD"] = "soft"  # Replace with your actual password
    db_restore_instance = DBRestorer(db_folder_path, db_host, db_port, db_user)
    print("Restoring databases...")
    db_restore_instance.restore_databases()
    print("Databases restored.")


schedule.every().day.at("00:00").do(restore_databases_daily)
# schedule.every(1).minutes.do(restore_databases_daily)


def run_scheduler():
    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    scheduler_thread = threading.Thread(target=run_scheduler)
    scheduler_thread.start()
    # app.run(debug=True, host="0.0.0.0", port="5000")
    app.run(debug=True)
