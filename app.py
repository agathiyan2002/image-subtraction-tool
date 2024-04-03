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
from ImageCounter import ImageCounter

import shutil
import json

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

destination_folder = os.path.join("static", "temp")

try:
    with open("config.json", "r") as config_file:
        config = json.load(config_file)
        base_folder = config.get("base_folder")
        validation_folder = config.get("validation")
        db_folder_path = config.get("database")
except FileNotFoundError:
    print("Config file not found!")
    base_folder = None
    validation = None
    database = None


def fetch_roll_details(selected_date):
    all_roll_details = {}
    try:
        connection = psycopg2.connect(
            user="postgres",
            password="soft",
            host="localhost",
            port="5432",
            database="postgres",
        )
        cursor = connection.cursor()
        cursor.execute(
            "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres', 'main');"
        )
        db_names = cursor.fetchall()

        for db_name in db_names:
            db_name = db_name[0]
            db_connection = psycopg2.connect(
                user="postgres",
                password="soft",
                host="localhost",
                port="5432",
                database=db_name,
            )
            db_cursor = db_connection.cursor()
            sql_query = """SELECT roll_number, timestamp FROM roll_details WHERE DATE(timestamp) = %s"""
            db_cursor.execute(sql_query, (selected_date,))
            roll_details = db_cursor.fetchall()
            if roll_details:
                formatted_roll_details = [
                    {"roll_number": roll_number, "date": date.strftime("%Y-%m-%d")}
                    for roll_number, date in roll_details
                ]
                all_roll_details[db_name] = formatted_roll_details
            db_cursor.close()
            db_connection.close()
        return all_roll_details
    except (Exception, psycopg2.Error) as error:
        print("Error fetching roll details:", error)
        return None
    finally:
        if connection:
            cursor.close()
            connection.close()


def check_roll_details_exist(formatted_roll_details, base_folder):
    all_mill_images = []
    missing_date_folders = []
    for database_name, roll_details in formatted_roll_details.items():
        database_parts = database_name.split("_")
        if len(database_parts) != 2:
            print(f"Invalid database name format: {database_name}")
            continue

        database_name = database_parts[0]
        machine_name = database_parts[1]

        database_images = {}
        for roll_detail in roll_details:
            roll_number = roll_detail["roll_number"]
            date = roll_detail["date"]
            date_folder = os.path.join(
                base_folder, database_name, machine_name, roll_number, date
            )
            if not os.path.exists(date_folder):
                missing_date_folders.append(date_folder)
                continue
            images = decrypt_and_save_images(
                date_folder, machine_name, database_name, roll_number, date
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


def decrypt_and_save_images(
    date_folder, machine_name, database_name, roll_number, date
):
    images = []
    stored_images = set()
    for root, _, files in os.walk(date_folder):
        for file in files:
            if file.endswith(".json"):
                json_file_path = os.path.join(root, file)
                with open(json_file_path, "r") as f:
                    json_data = json.load(f)
                image_data = base64.b64decode(json_data["imageData"])
                label_folder_path = os.path.join(
                    destination_folder,
                    database_name,
                    machine_name,
                    roll_number,
                    date,
                    json_data["shapes"][0]["label"],
                )
                os.makedirs(label_folder_path, exist_ok=True)
                image_path = os.path.join(
                    label_folder_path, os.path.basename(json_data["imagePath"])
                )
                if image_path not in stored_images:
                    if not os.path.exists(image_path):
                        with open(image_path, "wb") as img_file:
                            img_file.write(image_data)
                        images.append(
                            {
                                "label": json_data["shapes"][0]["label"],
                                "image_path": image_path,
                            }
                        )
                        stored_images.add(image_path)
    return images


@app.route("/update-records", methods=["POST"])
def update_records_api():
    if request.method == "POST":
        updated_record = request.get_json()
        success = db_instance.update_records(updated_record)
        if success:
            return jsonify({"message": "Record updated successfully"})
        else:
            return jsonify({"error": "Failed to update record"}), 500


@app.route("/", methods=["GET", "POST"])
def index():
    global validation_folder
    roll_details = []
    alert_message = ""
    all_mill_images = []

    if request.method == "POST":
        clear_temp_folder()
        selected_date = request.form["date"]
        roll_details = fetch_roll_details(selected_date)

        if roll_details == {}:

            alert_message = "false"
            return jsonify({"alert_message": alert_message})

        else:

            alert_message = "true"
            global base_folder
            all_mill_images, missing_date_folders = check_roll_details_exist(
                roll_details, base_folder
            )

            return jsonify(
                {
                    "all_mill_images": all_mill_images,
                    "missing_date_folders": missing_date_folders,
                    "validation_folder": validation_folder,
                    "alert_message": alert_message,
                }
            )

    return render_template("index.html")


def clear_temp_folder():
    temp_folder = os.path.join("static", "temp")
    if os.path.exists(temp_folder):
        shutil.rmtree(temp_folder)
    os.makedirs(temp_folder, exist_ok=True)


@app.route("/move-image", methods=["POST"])
def move_image():
    source = request.form.get("source")
    destination = request.form.get("destination")
    try:
        if not os.path.exists(source):
            return "Source file does not exist.", 500
        os.makedirs(destination, exist_ok=True)
        _, filename = os.path.split(source)
        destination_path = os.path.join(destination, filename)
        if os.path.exists(destination_path):
            return "File already exists in destination.", 500
        shutil.move(source, destination_path)
        if os.path.exists(destination_path):
            global validation_folder
            db_connection_string = (
                "dbname='main' user='postgres' host='localhost' password='soft'"
            )
            image_counter = ImageCounter(validation_folder, db_connection_string)
            results = image_counter.count_fp_tp_images()
            image_counter.insert_into_db(results)
            return "Image moved successfully."
        else:
            return "File does not exist in destination.", 500
    except Exception as e:
        print("Error:", e)
        return str(e), 500


@app.route("/dashboard", methods=["GET", "POST"])
def dashboard():
    if request.method == "POST":
        selected_date = request.form.get("date")
        db_instance.fetch_all_databases_data(selected_date)
        records = db_instance.fetch_records_by_date(selected_date)
        formatted_records = [
            (date.strftime("%Y-%m-%d"), *rest) for date, *rest in records
        ]
        return jsonify(formatted_records)
    else:
        return render_template("dashboard.html")


def restore_databases_daily():
    global db_folder_path
    db_host = "localhost"
    db_port = "5432"
    db_user = "postgres"
    os.environ["PGPASSWORD"] = "soft"
    db_restore_instance = DBRestorer(db_folder_path, db_host, db_port, db_user)
    print("Restoring databases...")
    db_restore_instance.restore_databases()
    print("Databases restored.")


schedule.every().day.at("00:00").do(restore_databases_daily)


def run_scheduler():
    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    scheduler_thread = threading.Thread(target=run_scheduler)
    scheduler_thread.start()
    app.run(debug=True)
