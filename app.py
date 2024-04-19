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
    error_databases = []  # List to store names of databases where an error occurred
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
            "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres', 'main','funner');"
        )
        db_names = cursor.fetchall()

        for db_name in db_names:
            db_name = db_name[0]
            try:
                db_connection = psycopg2.connect(
                    user="postgres",
                    password="soft",
                    host="localhost",
                    port="5432",
                    database=db_name,
                )
                db_cursor = db_connection.cursor()

                sql_query = """
                    SELECT roll_name, timestamp, roll_id 
                    FROM roll_details 
                    WHERE DATE(timestamp) = %s
                """
                db_cursor.execute(sql_query, (selected_date,))
                roll_details = db_cursor.fetchall()

                sql_query = """
                    SELECT filename, coordinate
                    FROM defect_details
                    WHERE DATE(timestamp) = %s 
                        AND add_imagepath IS NOT NULL 
                        AND roll_id = %s
                """
                if roll_details:
                    for roll_number, date, roll_id in roll_details:
                        db_cursor.execute(sql_query, (selected_date, roll_id))
                        rows = db_cursor.fetchall()
                        file_names = [row[0] for row in rows]
                        coordinates = [row[1] for row in rows]
                        formatted_roll_details = {
                            "roll_number": roll_number,
                            "date": date.strftime("%Y-%m-%d"),
                            "file_names": file_names,
                            "coordinates": coordinates,
                        }
                        if db_name not in all_roll_details:
                            all_roll_details[db_name] = []
                        all_roll_details[db_name].append(formatted_roll_details)

                db_cursor.close()
                db_connection.close()
            except psycopg2.Error as db_error:
                print(
                    f"Error fetching roll details from database {db_name}: {db_error}"
                )
                error_databases.append(db_name)
        # print(all_roll_details)
        return all_roll_details, error_databases
    except psycopg2.Error as global_error:
        print("Global error fetching roll details:", global_error)
        return None, error_databases
    finally:
        if connection:
            cursor.close()
            connection.close()


def filter_images(images, file_names, coordinates):
    filtered_images = []
    for image in images:
        image_filename = image["image_path"].split("/")[-1]
        if image_filename in file_names:
            # Add coordinates to the image data structure
            image["coordinates"] = coordinates[file_names.index(image_filename)]
            filtered_images.append(image)
    return filtered_images


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
            file_names = roll_detail["file_names"]
            coordinate = roll_detail["coordinates"]
            # print("++++++++++++++++++")
            # print("_db name", database_name)
            # print("roll naumber", roll_number)
            # print("file_names", file_names)
            # print("coordinate", coordinate)
            # print("++++++++++++++++++")

            if (
                base_folder is not None
                and database_name is not None
                and machine_name is not None
                and roll_number is not None
                and date is not None
            ):
                # print(database_name, ":", file_names)
                date_folder = os.path.join(
                    base_folder, database_name, machine_name, roll_number, date
                )
                if not os.path.exists(date_folder):
                    missing_date_folders.append(date_folder)
                    continue
                images = decrypt_and_save_images(
                    date_folder,
                    machine_name,
                    database_name,
                    roll_number,
                    date,
                )

                # print("iamges", images)
                filtered_images = filter_images(images, file_names, coordinate)
                # print("Filtered Images:", filtered_images)
                if filtered_images:
                    if database_name not in database_images:
                        database_images[database_name] = {}
                    if roll_number not in database_images[database_name]:
                        database_images[database_name][roll_number] = {}
                    if date not in database_images[database_name][roll_number]:
                        database_images[database_name][roll_number][
                            date
                        ] = filtered_images
            else:
                print("One or more components are None.")
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
                        # Extract coordinates
                        coordinates = json_data.get("coordinates", [])
                        images.append(
                            {
                                "label": json_data["shapes"][0]["label"],
                                "image_path": image_path,
                                "coordinates": coordinates,
                            }
                        )
                        stored_images.add(image_path)
    return images


@app.route("/update-records", methods=["POST"])
def update_records_api():
    if request.method == "POST":
        updated_record = request.get_json()
        print("++++++++++++++++++++")
        print(updated_record)
        print("++++++++++++++++++++++++ ")
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
        roll_details, error_databases = fetch_roll_details(selected_date)
        validated_folder = (
            {
                mill_name: folder_validated
                for mill_name, folder_validated in db_instance.validate_folder(
                    selected_date
                )
            }
            if db_instance.validate_folder(selected_date) is not None
            else {}
        )
        print("validate", validation_folder)

        # call validate_folder fuinc store the variavel return value
        # print("++++++++++++++")
        # print("roll_details", roll_details)
        # print("++++++++++++++")
        # print("eror db file", error_databases)
        if roll_details == {}:

            alert_message = "false"
            return jsonify({"alert_message": alert_message})

        else:

            alert_message = "true"
            global base_folder
            all_mill_images, missing_date_folders = check_roll_details_exist(
                roll_details, base_folder
            )
            # print("************************")
            # print(all_mill_images)
            # print("************************")

            return jsonify(
                {
                    "all_mill_images": all_mill_images,
                    "missing_date_folders": missing_date_folders,
                    "validation_folder": validation_folder,
                    "alert_message": alert_message,
                    "error_databases": error_databases,
                    "validated_folder": validated_folder,
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
    try:

        data = request.json
        source = data["source"]
        destination = data["destination"]
        mill_name = data["mill_name"]
        machine_name = data["machine_name"]
        date = data["date"]
        count_details = data["count_details"]  # Extract count_details data
        comment = data["comment"]  # Extract comment data
        validated = data["validated"]

        print("Source:", source)
        print("Destination:", destination)
        # print("Mill Name:", mill_name)
        # print("Date:", date)
        # print("Count Details:", count_details)  # Print count_details
        # print("Comment:", comment)  # Print comment
        # print("validated",validated)

        # print("Comment:", comment)

        # # Handle count_details separately if it's sent as a JSON string
        # count_details_json = request.form.get("count_details")
        # if count_details_json:
        #     count_details = json.loads(count_details_json)
        #     print("Count Details:", count_details)

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
                image_counter.insert_into_db(
                    mill_name, machine_name, date, count_details, comment, validated
                )
                return "Image moved successfully."
            else:
                return "File does not exist in destination.", 500
        except Exception as e:
            print("Error move:", e)
            return str(e), 500

    except Exception as e:
        print("Error:", e)
        return str(e), 500


@app.route("/dashboard", methods=["GET", "POST"])
def dashboard():
    if request.method == "POST":
        selected_date = request.form.get("date")
        db_instance.fetch_all_databases_data(selected_date)
        records = db_instance.fetch_records_by_date(selected_date)

        modified_records = [
            (
                (record[:7] + (record[7].strip("{}"),) + record[8:])
                if record[7]
                else record
            )
            for record in records
        ]

        merged_data = []
        for record in modified_records:
            defect_counts_mdd = json.loads(record[8])
            defect_counts_add = json.loads(record[9])

            subtable = []
            for defect_name in defect_counts_mdd:
                mdd_count = defect_counts_mdd.get(defect_name, 0)
                add_count = defect_counts_add.get(defect_name, 0)
                subtable.append([defect_name, 0, 0, 0, mdd_count, add_count])

            total_mdd_count = sum(defect_counts_mdd.values())
            total_add_count = sum(defect_counts_add.values())

            count_details = record[10]
            count_details_dict = {}
            if count_details:
                count_details_dict = json.loads(count_details)
                for detail in count_details_dict:
                    label = detail.get("label", "")
                    if label:
                        tp = detail.get("tp", 0)
                        fp = detail.get("fp", 0)
                        nmm = detail.get("nmm", 0)
                        mdd_count = defect_counts_mdd.get(label, 0)
                        add_count = defect_counts_add.get(label, 0)
                        subtable.append([label, tp, fp, nmm, mdd_count, add_count])

            if subtable:
                total_tp_count = sum(
                    detail.get("tp", 0) for detail in count_details_dict
                )
                total_fp_count = sum(
                    detail.get("fp", 0) for detail in count_details_dict
                )
                total_nmm_count = sum(
                    detail.get("nmm", 0) for detail in count_details_dict
                )
                subtable.append(
                    [
                        "total",
                        total_tp_count,
                        total_fp_count,
                        total_nmm_count,
                        total_mdd_count,
                        total_add_count,
                    ]
                )

            merged_data.append(subtable)

        for i, record in enumerate(modified_records):
            modified_records[i] = record[:8] + (merged_data[i],) + record[11:]

        return jsonify(modified_records)
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


schedule.every().day.at("09:00").do(restore_databases_daily)


def run_scheduler():
    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":

    # # restore_databases_daily()
    # scheduler_thread = threading.Thread(target=run_scheduler)
    # scheduler_thread.start()
    app.run(debug=True)
