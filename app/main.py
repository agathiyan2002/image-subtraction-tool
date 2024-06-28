from src.db import Database
from src.db import Database
from src.config import ConfigLoader
import os, json, shutil, datetime, logging
from src.ImageCounter import ImageCounter
from src.imageproces import ImageProcessor
from flask import Flask, jsonify, render_template, request
from src.update_status_in_json_file import ImageStatusProcessor

app = Flask(__name__)
# log = logging.getLogger('werkzeug')
# log.setLevel(logging.ERROR)


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


@app.route("/", methods=["GET", "POST"])
def index():
    config_loader = ConfigLoader()
    config = config_loader.config
    destination_folder = os.path.join("app/static/", "temp")
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

        validate_folder_result = db_instance.validate_folder(formatted_selected_date)
        validated_folder = {}

        # Iterate over validate_folder_result to populate validated_folder
        for mill_name, folder_validated, machine_name in validate_folder_result:
            if mill_name not in validated_folder:
                validated_folder[mill_name] = {}
            validated_folder[mill_name][machine_name] = (
                "validated" if folder_validated == "validated" else "notvalidated"
            )

      

        all_images = image_processor.decrypt_and_save_images_from_base_folder(
            formatted_selected_date
        )

        if all_images == {}:
            alert_message = "false"
            return jsonify({"alert_message": alert_message})
        else:
            alert_message = "true"
        print("++++++++++")
        print(validated_folder)
        print("++++++++++++++")
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

        source = base_folder + "knit-i" + source.replace("/static", "")
        update_key_path = "/".join(
            source.replace("/temp", "").split("/")[:-2]
            + source.replace("/temp", "").split("/")[-1:]
        )

        status = destination.split("/")[-1]  # Get the last part of the path
        image_status_processor = ImageStatusProcessor()

        image_status_processor.process_image_status(update_key_path, status)
        try:

            db_connection_string = (
                "dbname='main' user='postgres' host='localhost' password='55555'"
            )

            db_instance.fetch_all_databases_data(date)
            image_counter = ImageCounter(validation_folder, db_connection_string)
            image_counter.insert_into_db(
                mill_name,
                machine_name,
                date,
                count_details,
                comment,
                validated,
            )
            return "Image move request processed successfully."

        except Exception as e:
            print("Error  :", e)
            return str(e), 500

    except Exception as e:
        print("Error:", e)
        return str(e), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
