import json
import os
import psycopg2


class Database:
    def __init__(self, source_db_config, destination_db_config):
        self.source_db_config = source_db_config
        self.destination_db_config = destination_db_config

    def fetch_defect_data(self, selected_date):
        try:
            # Connect to the source database (kpr-2)
            source_connection = psycopg2.connect(**self.source_db_config)
            source_cursor = source_connection.cursor()

            # Fetch defect data from the defect_details table for the selected date
            source_cursor.execute(
                "SELECT defecttyp_id, timestamp FROM defect_details WHERE DATE(timestamp) = %s",
                (selected_date,),
            )
            defect_data = source_cursor.fetchall()

            # Fetch the count of rows in rotation_details for the selected date
            source_cursor.execute(
                "SELECT COUNT(rotation) FROM rotation_details WHERE DATE(timestamp) = %s AND rotation IS NOT NULL",
                (selected_date,),
            )

            rotation_data = source_cursor.fetchall()

            # Fetch average RPM from rotation_details for the selected date
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

            # Fetch data from machine_program_details table for selected date
            source_cursor.execute(
                "SELECT gsm, gg, loop_length, fabric_type, knit_type FROM machine_program_details WHERE DATE(timestamp) = %s",
                (selected_date,),
            )
            machine_program_data = source_cursor.fetchall()

            # Fetch the count of distinct alarmtyp_id values for selected date
            source_cursor.execute(
                "SELECT COUNT(alarmtyp_id) FROM alarm_status WHERE DATE(timestamp) = %s AND alarmtyp_id IS NOT NULL",
                (selected_date,),
            )

            num_alarm_types = source_cursor.fetchone()[0]

            return (
                defect_data,
                rotation_data,
                avg_rpm,
                machine_program_data,
                num_alarm_types,
            )

        except psycopg2.Error as e:
            print("Error fetching defect data:", e)
            return None, None, None, None, None

        finally:
            if source_connection:
                source_cursor.close()
                source_connection.close()

    def insert_data(
        self,
        selected_date,
        data,
        rotation_data,
        avg_rpm,
        machine_program_data,
        alarm_status,
    ):
        try:
            # Connect to the destination database (main)
            destination_connection = psycopg2.connect(**self.destination_db_config)
            destination_cursor = destination_connection.cursor()

            # Group defect types by their counts
            defect_counts = {}
            total_revolutions = 0

            # Initialize defect_counts for each defect_id
            if data is not None:
                for defect_id, _ in data:
                    defect_counts.setdefault(defect_id, 0)

                # Increment counts for each defect_id
                for defect_id, _ in data:
                    defect_counts[defect_id] += 1

            # Serialize the defect_counts dictionary to a JSON string
            defect_counts_json = json.dumps(defect_counts)

            # Initialize lists for machine program data attributes
            gsm = []
            gg = []
            loop_length = []
            fabric_types = []
            knit_types = []

            # Iterate over each tuple in machine_program_data
            if machine_program_data is not None:
                for program_data in machine_program_data:
                    # Check if the tuple contains enough elements
                    if len(program_data) >= 5:
                        gsm.append(program_data[0])
                        gg.append(program_data[1])
                        loop_length.append(program_data[2])
                        fabric_types.append(program_data[3])
                        knit_types.append(program_data[4])
                    else:
                        # Append None if the tuple does not contain enough elements
                        gsm.append(None)
                        gg.append(None)
                        loop_length.append(None)
                        fabric_types.append(None)
                        knit_types.append(None)

            # Convert lists to JSON strings
            gsm_json = json.dumps(gsm)
            gg_json = json.dumps(gg)
            loop_length_json = json.dumps(loop_length)
            fabric_types_json = json.dumps(fabric_types)
            knit_types_json = json.dumps(knit_types)

            # Construct the UPSERT SQL query
            sql_query = """
                INSERT INTO kpr2 (
                    date, defect_name, no_of_revolutions, avg_rpm, gsm,
                    guage, loop_length, fabric_material, machine_rolling_type, total_alarms
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) ON CONFLICT (date) DO UPDATE SET
                    defect_name = excluded.defect_name,
                    no_of_revolutions = excluded.no_of_revolutions,
                    avg_rpm = excluded.avg_rpm,
                    gsm = excluded.gsm,
                    guage = excluded.guage,
                    loop_length = excluded.loop_length,
                    fabric_material = excluded.fabric_material,
                    machine_rolling_type = excluded.machine_rolling_type,
                    total_alarms = excluded.total_alarms;
            """

            # Execute the UPSERT SQL query
            destination_cursor.execute(
                sql_query,
                (
                    selected_date,
                    defect_counts_json,
                    rotation_data,
                    avg_rpm,
                    gsm_json,
                    gg_json,
                    loop_length_json,
                    fabric_types_json,
                    knit_types_json,
                    alarm_status,
                ),
            )

            # Commit the transaction
            destination_connection.commit()

            print("Data inserted or updated successfully.")

        except psycopg2.Error as e:
            print("Error inserting or updating data:", e)

        finally:
            if destination_connection:
                destination_cursor.close()
                destination_connection.close()

    def fetch_records_by_date(self, selected_date):
        try:
            # Connect to the destination database (main)
            destination_connection = psycopg2.connect(**self.destination_db_config)
            destination_cursor = destination_connection.cursor()

            # Fetch records from the kpr2 table for the selected date
            destination_cursor.execute(
                "SELECT * FROM kpr2 WHERE date = %s", (selected_date,)
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
            # Connect to the destination database (main)
            destination_connection = psycopg2.connect(**self.destination_db_config)
            destination_cursor = destination_connection.cursor()

            date = updated_record.get("date")
            mill_name = updated_record.get("mill_name")
            machine_brand = updated_record.get("machine_brand")
            machineDia = updated_record.get("machineDia")
            modelName = updated_record.get("modelName")
            machineName = updated_record.get("machineName")
            avgRpm = updated_record.get("avgRpm")
            feederType = updated_record.get("feederType")
            gauge = updated_record.get("gauge")
            gsm = updated_record.get("gsm")
            loopLength = updated_record.get("loopLength")
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
            customerComplaints = updated_record.get("customerComplaints")
            cdc = updated_record.get("cdc")
            latestAction = updated_record.get("latestAction")

            sql_query = """
                UPDATE kpr2
                SET mill_name = %s, 
                    machine_brand = %s,
                    machine_dia = %s,
                    model_name = %s,
                    machine_name = %s,
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
                    defect_name = %s,
                    total_alarms = %s,
                    true_positive = %s,
                    name_mismatch = %s,
                    false_positive = %s,
                    fabric_parameters = %s,
                    comments = %s,
                    customer_complaints_requirements = %s,
                    cdc_last_done = %s,
                    latest_action = %s
                WHERE date = %s
            """

            # Execute the SQL query with the updated data
            destination_cursor.execute(
                sql_query,
                (
                    mill_name,
                    machine_brand,
                    machineDia,
                    modelName,
                    machineName,
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
                    defectName,
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
                ),
            )

            # Commit the transaction
            destination_connection.commit()

            print("Record updated successfully.")

            return True  # Return True to indicate success

        except psycopg2.Error as e:
            print("Error updating record:", e)
            return False  # Return False to indicate failure

        finally:
            if destination_connection:
                destination_cursor.close()
                destination_connection.close()
