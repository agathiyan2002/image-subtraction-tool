from src.db import Database
from src.restore_db_files import DBRestorer
from src.ImageCounter import ImageCounter
from src.imageproces import ImageProcessor
from flask import Flask, jsonify, render_template, request
import time, os, json, shutil, base64, schedule, psycopg2, threading, datetime

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
    with open("config/config.json", "r") as config_file:
        config = json.load(config_file)
        base_folder = config.get("base_folder")
        validation_folder = config.get("validation")
        db_folder_path = config.get("database")
except FileNotFoundError:
    print("Config file not found!")
    base_folder = None
    validation = None
    database = None


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
    alert_message = ""
    global base_folder
    if request.method == "POST":
        image_processor = ImageProcessor(base_folder, destination_folder)
        image_processor.clear_temp_folder()
        selected_date = request.form["date"]
        formatted_selected_date = datetime.datetime.strptime(
            selected_date, "%Y-%m-%d"
        ).strftime("%Y-%m-%d")
        print("Selected date from form:", formatted_selected_date)  # Debug statement
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
        print("Validated folder:", validated_folder)  # Debug statement

        all_images = image_processor.decrypt_and_save_images_from_base_folder(formatted_selected_date)

        print("All images:", all_images)  # Debug statement

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


@app.route("/filter_option", methods=["POST"])
def filter_option():
    data = request.json
    # Save the data to a JSON file
    with open("filtered_images.json", "w") as f:
        json.dump(data, f)
    return jsonify({"message": "Data received and saved successfully!"})


def get_image_for_option(option):
    with open("filtered_images.json") as f:
        data = json.load(f)
        return data.get(option, "Option not found")


@app.route("/return_option_value", methods=["POST"])
def return_option_value():
    try:
        data = request.get_json()
        option_value = data["option"]
        print(option_value)

        if option_value == "false_positive":
            image = get_image_for_option("fpImages")
            return jsonify({"false_positive_image": image}), 200
        elif option_value == "true_positive":
            image = get_image_for_option("tpImages")
            return jsonify({"true_positive_image": image}), 200
        elif option_value == "name_mismatch":
            image = get_image_for_option("nmmImages")
            return jsonify({"name_mismatch_image": image}), 200
        elif option_value == "all_images":
            image = get_image_for_option("allImages")
            return jsonify({"all_images": image}), 200
        else:
            return jsonify({"error": "Invalid option"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


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
    if request.method == "POST":
        selected_date = request.form.get("date")
        db_instance.fetch_all_databases_data(selected_date)
        records = db_instance.fetch_records_by_date(selected_date)
        # print(records)
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
    app.run(debug=True, host="0.0.0.0", port=5000)
