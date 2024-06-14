from src.db import Database
from src.db import Database
from src.config import ConfigLoader
import os, json, shutil, datetime
from src.ImageCounter import ImageCounter
from src.imageproces import ImageProcessor

# from src.databasescheduler import DatabaseScheduler
from flask import Flask, jsonify, render_template, request, send_file

app = Flask(__name__)


@app.route("/update-records", methods=["POST"])
def update_records_api():
    db_instance = Database()
    if request.method == "POST":
        updated_record = request.get_json()

        success = db_instance.update_records(updated_record)
        if success:
            return jsonify({"message": "Record updated successfully"})
        else:
            return jsonify({"error": "Failed to update record"}), 500


@app.route("/", methods=["GET", "POST"])
def index():
    config_loader = ConfigLoader()
    config = config_loader.config
    destination_folder = os.path.join("static/", "temp")
    base_folder = config.get("base_folder")
    validation_folder = config.get("validation")
    db_instance = Database()
    alert_message = ""
    if request.method == "POST":
        image_processor = ImageProcessor(base_folder, destination_folder)
        # image_processor.clear_temp_folder()
        selected_date = request.form["date"]
        formatted_selected_date = datetime.datetime.strptime(
            selected_date, "%Y-%m-%d"
        ).strftime("%Y-%m-%d")

        validated_folder = (
            {
                mill_name: folder_validated
                for mill_name, folder_validated in db_instance.validate_folder(
                    formatted_selected_date
                )
            }
            if db_instance.validate_folder(formatted_selected_date) is not None
            else {}
        )

        all_images = image_processor.decrypt_and_save_images_from_base_folder(
            formatted_selected_date
        )

        if all_images == {}:
            alert_message = "false"
            return jsonify({"alert_message": alert_message})
        else:
            alert_message = "true"

        return jsonify(
            {
                "all_mill_images": all_images,
                "validation_folder": validation_folder,
                "alert_message": alert_message,
                "validated_folder": validated_folder,
            }
        )

    return render_template("index.html")


@app.route("/move-image", methods=["POST"])
def move_image():
    db_instance = Database()
    config_loader = ConfigLoader()
    config = config_loader.config
    validation_folder = config.get("validation")
    base_folder = config.get("base_folder")

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

        source = base_folder + "/knit-i" + source.replace("/static", "")

        try:
            if not os.path.exists(source):
                return "Source file does not exist.", 500
            os.makedirs(destination, exist_ok=True)
            _, filename = os.path.split(source)
            destination_path = os.path.join(destination, filename)

            if os.path.exists(destination_path):
                os.remove(destination_path)  # Overwrite by removing the existing file

            shutil.move(source, destination_path)

            if os.path.exists(destination_path):
                db_connection_string = (
                    "dbname='main' user='postgres' host='localhost' password='soft'"
                )
 
                db_instance.fetch_all_databases_data(date)
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
    db_instance = Database()
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

            defect_counts_mdd = json.loads(record[8]) if record[8] else {}
            defect_counts_add = json.loads(record[9]) if record[9] else {}

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


if __name__ == "__main__":
    # database_scheduler = DatabaseScheduler()
    # database_scheduler.run_scheduler()
    app.run(debug=True, host="0.0.0.0", port=5000)
