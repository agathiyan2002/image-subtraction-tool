import json
import os
import psycopg2
import logging


class Database:
    def __init__(self, source_db_config, destination_db_config):
        self.source_db_config = source_db_config
        self.destination_db_config = destination_db_config

    def fetch_all_databases_data(self, selected_date):
        try:
            source_connection = psycopg2.connect(**self.source_db_config)
            source_cursor = source_connection.cursor()
            source_cursor.execute(
                "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres', 'main','funner');"
            )
            database_names = [row[0] for row in source_cursor.fetchall()]
            for db_name in database_names:
                print("Fetching data from database:", db_name)
                self.fetch_defect_data(selected_date, db_name)
        except psycopg2.Error as e:
            print("Error fetching data from all databases:", e)
        finally:
            if source_connection:
                source_cursor.close()
                source_connection.close()

    def fetch_defect_data(self, selected_date, db_name):
        try:
            self.source_db_config["database"] = db_name
            source_connection = psycopg2.connect(**self.source_db_config)
            source_cursor = source_connection.cursor()
            source_cursor.execute(
                "SELECT defecttyp_id, timestamp FROM defect_details WHERE DATE(timestamp) = %s",
                (selected_date,),
            )
            defect_data = source_cursor.fetchall()
            source_cursor.execute(
                "SELECT COUNT(rotation) FROM rotation_details WHERE DATE(timestamp) = %s AND rotation IS NOT NULL",
                (selected_date,),
            )
            rotation_data = source_cursor.fetchall()
            source_cursor.execute(
                """SELECT AVG(count) AS mean_count_per_minute
                FROM (
                SELECT DATE_TRUNC('minute', timestamp) AS minute_group, COUNT(*) AS count
                FROM public.rotation_details
                WHERE DATE(timestamp) = %s
                GROUP BY minute_group
                ) AS subquery;""",
                (selected_date,),
            )
            avg_rpm_result = source_cursor.fetchone()
            avg_rpm = avg_rpm_result[0] if avg_rpm_result else None
            source_cursor.execute(
                "SELECT gsm, gg, loop_length, fabric_type, knit_type FROM machine_program_details WHERE DATE(timestamp) = %s",
                (selected_date,),
            )
            machine_program_data = source_cursor.fetchall()
            source_cursor.execute(
                "SELECT COUNT(alarmtyp_id) FROM alarm_status WHERE DATE(timestamp) = %s AND alarmtyp_id IS NOT NULL",
                (selected_date,),
            )
            num_alarm_types = source_cursor.fetchone()[0]

            source_cursor.execute(
                "SELECT defecttyp_id, timestamp FROM defect_details WHERE DATE(timestamp) = %s  AND add_imagepath IS NOT NULL ",
                (selected_date,),
            )
            add_defect_data = source_cursor.fetchall()

            # logging.basicConfig(
            #     filename="log.txt",
            #     level=logging.INFO,
            #     format="%(asctime)s - %(levelname)s - %(message)s",
            # )

            # logging.info("######################################")
            # logging.info("db name: %s", db_name)
            # logging.info("Selected Date: %s", selected_date)
            # logging.info("Defect Data: %s", len(defect_data))
            # logging.info("Rotation Data: %s", rotation_data)
            # logging.info("Average RPM: %s", avg_rpm)
            # logging.info("Machine Program Data: %s", machine_program_data)
            # logging.info("Number of Alarm Types: %s", num_alarm_types)
            # logging.info("Database Name: %s", db_name)
            # logging.info("######################################")
            avg_rpm = avg_rpm if avg_rpm is None else round(avg_rpm)

            self.insert_data(
                selected_date,
                defect_data,
                rotation_data,
                avg_rpm,
                machine_program_data,
                num_alarm_types,
                db_name,
                add_defect_data,
            )
        except psycopg2.Error as e:
            print(f"Error fetching data from database {db_name}:", e)
            return None, None, None, None, None
        finally:
            if source_connection:
                source_cursor.close()
                source_connection.close()

    def map_keys_to_names(counts, subkeyMap):
        mapped_counts = {}
        for key, value in counts.items():
            if str(key) in subkeyMap:
                mapped_key = subkeyMap[str(key)]
                mapped_counts[mapped_key] = value
        return mapped_counts

    def insert_data(
        self,
        selected_date,
        data,
        rotation_data,
        avg_rpm,
        machine_program_data,
        alarm_status,
        db_name,
        add_defect_data,
    ):
        subkeyMap = {
            "1": "lycra",
            "2": "hole",
            "3": "shutoff",
            "4": "needln",
            "5": "oil",
            "6": "twoply",
            "7": "stopline",
            "8": "countmix",
            "9": "two_ply",
        }

        try:
            destination_connection = psycopg2.connect(**self.destination_db_config)
            destination_cursor = destination_connection.cursor()
            defect_counts = {}
            total_revolutions = 0

            # Process data
            if data is not None:
                for defect_id, _ in data:
                    name = subkeyMap.get(str(defect_id))
                    defect_counts.setdefault(name, 0)
                for defect_id, _ in data:
                    name = subkeyMap.get(str(defect_id))
                    defect_counts[name] += 1
            defect_counts_json = json.dumps(defect_counts)

            # Process add_defect_data separately
            add_defect_counts = {}
            if add_defect_data is not None:
                for defect_id, _ in add_defect_data:
                    name = subkeyMap.get(str(defect_id))
                    add_defect_counts.setdefault(name, 0)
                for defect_id, _ in add_defect_data:
                    name = subkeyMap.get(str(defect_id))
                    add_defect_counts[name] += 1
            add_defect_json = json.dumps(add_defect_counts)

            gsm = []
            gg = []
            loop_length = []
            fabric_types = []
            knit_types = []
            if machine_program_data is not None:
                for program_data in machine_program_data:
                    if len(program_data) >= 5:
                        gsm.append(program_data[0])
                        gg.append(program_data[1])
                        loop_length.append(program_data[2])
                        fabric_types.append(program_data[3])
                        knit_types.append(program_data[4])
                    else:
                        gsm.append(None)
                        gg.append(None)
                        loop_length.append(None)
                        fabric_types.append(None)
                        knit_types.append(None)
            gsm_json = json.dumps(gsm)
            gg_json = json.dumps(gg)
            loop_length_json = json.dumps(loop_length)
            fabric_types_json = json.dumps(fabric_types)
            knit_types_json = json.dumps(knit_types)
            try:
                mill_name, machine_name = db_name.split("_")
            except ValueError as ve:
                print("Error splitting db_name:", ve)
                return

            # Check if the record exists
            check_sql_query = """SELECT COUNT(*) FROM mill_details 
                                WHERE date = %s AND mill_name = %s AND machine_name = %s"""
            destination_cursor.execute(check_sql_query, (selected_date, mill_name, machine_name))
            existing_records = destination_cursor.fetchone()[0]
        

            if existing_records == 0:  # If no record exists, insert the data
                sql_query = """INSERT INTO mill_details (
                        date, mill_name, machine_name, mdd_defect_count, no_of_revolutions, avg_rpm, gsm,
                        guage, loop_length, fabric_material, machine_rolling_type, total_alarms, add_defect_count
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )"""
                destination_cursor.execute(
                    sql_query,
                    (
                        selected_date,
                        mill_name,
                        machine_name,
                        defect_counts_json,
                        rotation_data,
                        avg_rpm,
                        gsm_json,
                        gg_json,
                        loop_length_json,
                        fabric_types_json,
                        knit_types_json,
                        alarm_status,
                        add_defect_json,
                    ),
                )
                print("Data inserted successfully.")
            else:
          
                print("Record already exists. Skipping insertion.")

            destination_connection.commit()
        except psycopg2.Error as e:
            print("Error inserting or updating data:", e)
        finally:
            if destination_connection:
                destination_cursor.close()
                destination_connection.close()

    def fetch_records_by_date(self, selected_date):
        try:
            destination_connection = psycopg2.connect(**self.destination_db_config)
            destination_cursor = destination_connection.cursor()
            destination_cursor.execute(
                "SELECT mill_name,machine_name,avg_rpm,guage,gsm,loop_length,uptime,no_of_revolutions,mdd_defect_count,add_defect_count,count_details,comments,machine_brand, machine_dia, model_name, feeder_type, fabric_material, machine_rolling_type, status, internet_status, total_alarms, customer_complaints_requirements, cdc_last_done, latest_action  FROM mill_details WHERE date = %s",
                (selected_date,),
            )
            records = destination_cursor.fetchall()

            return records
        except psycopg2.Error as e:
            print("Error fetching records:", e)
            return None
        finally:
            if destination_connection:
                destination_cursor.close()
                destination_connection.close()

    def update_records(self, updated_record):
        try:
            print(updated_record)
            destination_connection = psycopg2.connect(**self.destination_db_config)
            destination_cursor = destination_connection.cursor()
            date = updated_record.get("date")
            mill_name = updated_record.get("mill_name")
            machine_brand = updated_record.get("machine_brand")
            machineDia = updated_record.get("machineDia")
            modelName = updated_record.get("modelName")
            machineName = updated_record.get("machineName")

            # Handle empty or unexpected values
            avgRpm = updated_record.get("avgRpm")
            if avgRpm == "":
                avgRpm = None  # Convert empty string to NULL

            # Handle gauge, gsm, and loopLength
            gauge = updated_record.get("guage")
            if gauge == "[]":
                gauge = None  # Convert '[]' to NULL

            gsm = updated_record.get("gsm")
            if gsm == "[]":
                gsm = None  # Convert '[]' to NULL

            loopLength = updated_record.get("loopLength")
            if loopLength == "[]":
                loopLength = None  # Convert '[]' to NULL

            # Ensure noOfRevolutions is numeric
            try:
                noOfRevolutions = int(updated_record.get("noOfRevolutions"))
            except (TypeError, ValueError):
                noOfRevolutions = None  # Handle non-numeric values

            feederType = updated_record.get("feederType")
            fabricMaterial = updated_record.get("fabricMaterial")
            machineRollingType = updated_record.get("machineRollingType")
            status = updated_record.get("status")
            internetStatus = updated_record.get("internetStatus")
            uptime = updated_record.get("uptime")
            noOfRevolutions = updated_record.get("noOfRevolutions")
            defectName = updated_record.get("defectName")
            totalAlarms = updated_record.get("totalAlarms")
            truePositive = updated_record.get("truePositive")
            nameMismatch = updated_record.get("nameMismatch")
            falsePositive = updated_record.get("falsePositive")
            fabricParameters = updated_record.get("fabricParameters")
            comments = updated_record.get("comments")
            customerComplaints = updated_record.get("customerComplaintsRequirements")
            cdc = updated_record.get("cdcLastDone")
            latestAction = updated_record.get("latestAction")
            # add_defect_count = updated_record.get("addDefectCount")
            # print("+++++++++++++++")
            # print("cdc", cdc)
            # print("custormer", customerComplaints)
            # print("+++++++++++++++++")
            sql_query = """
                UPDATE mill_details
                SET 
                    machine_brand = %s,
                    machine_dia = %s,
                    model_name = %s,
                    avg_rpm = %s,
                    feeder_type = %s,
                    guage = %s,
                    gsm = %s,
                    loop_length = %s,
                    fabric_material = %s,
                    machine_rolling_type = %s,
                    status = %s,
                    internet_status = %s,
                    uptime = %s,
                    no_of_revolutions = %s,
                    total_alarms = %s,
                    true_positive = %s,
                    name_mismatch = %s,
                    false_positive = %s,
                    fabric_parameters = %s,
                    comments = %s,
                    customer_complaints_requirements = %s,
                    cdc_last_done = %s,
                    latest_action = %s
                WHERE date = %s And mill_name=%s And machine_name=%s
            """

            destination_cursor.execute(
                sql_query,
                (
                    machine_brand,
                    machineDia,
                    modelName,
                    avgRpm,
                    feederType,
                    gauge,
                    gsm,
                    loopLength,
                    fabricMaterial,
                    machineRollingType,
                    status,
                    internetStatus,
                    uptime,
                    noOfRevolutions,
                    totalAlarms,
                    truePositive,
                    nameMismatch,
                    falsePositive,
                    fabricParameters,
                    comments,
                    customerComplaints,
                    cdc,
                    latestAction,
                    date,
                    mill_name,
                    machineName,
                ),
            )
            destination_connection.commit()
            print("Record updated successfully.")
            return True
        except psycopg2.Error as e:
            print("Error updating record:", e)
            return False
        finally:
            if destination_connection:
                destination_cursor.close()
                destination_connection.close()

    def validate_folder(self, selected_date):
        try:
            destination_connection = psycopg2.connect(**self.destination_db_config)
            destination_cursor = destination_connection.cursor()
            destination_cursor.execute(
                "SELECT mill_name, folder_validated FROM mill_details WHERE date = %s",
                (selected_date,),
            )
            folder_data = destination_cursor.fetchall()
            return folder_data
        except psycopg2.Error as e:
            print("Error fetching folder validation data:", e)
            return None
        finally:
            if destination_connection:
                destination_cursor.close()
                destination_connection.close()
