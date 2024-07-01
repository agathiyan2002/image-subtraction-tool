import psycopg2
from psycopg2 import sql
from datetime import datetime


class DateRange:
    def __init__(self, start_date, end_date, db_config=None):
        self.start_date = start_date
        self.end_date = end_date
        if db_config is None:
            self.db_config = {
                "database": "d1",
                "user": "postgres",
                "password": "55555",
                "host": "localhost",
                "port": "5432",
            }
        else:
            self.db_config = db_config

    def fetch_uptime_status(self):
        try:
            with psycopg2.connect(**self.db_config) as conn:
                with conn.cursor() as cur:
                    query = """
                        SELECT software_status, machine_status, controller_status, ml_status, redis_status, report_status, ui_status, monitor_status, alarm_status, timestamp
                        FROM uptime_status
                        WHERE timestamp BETWEEN %s AND %s
                        AND CAST(software_status AS INTEGER) = 0
                        AND CAST(machine_status AS INTEGER) = 0
                        AND CAST(controller_status AS INTEGER) = 0
                        AND CAST(ml_status AS INTEGER) = 0
                        AND CAST(redis_status AS INTEGER) = 0
                        AND CAST(report_status AS INTEGER) = 0
                        AND CAST(ui_status AS INTEGER) = 0
                        AND CAST(monitor_status AS INTEGER) = 0
                        AND CAST(alarm_status AS INTEGER) = 0
                        ORDER BY timestamp;
                    """
                    cur.execute(query, (self.start_date, self.end_date))
                    results = cur.fetchall()

                    formatted_results = []
                    for row in results:
                        (
                            software_status,
                            machine_status,
                            controller_status,
                            ml_status,
                            redis_status,
                            report_status,
                            ui_status,
                            monitor_status,
                            alarm_status,
                            timestamp,
                        ) = row
                        timestamp_formatted = timestamp.strftime("%Y-%m-%d %H:%M:%S")
                        result_dict = {
                            "Software Status": software_status,
                            "Kniting Machine Status": machine_status,
                            "Controller Status": controller_status,
                            "ML Status": ml_status,
                            "Redis Status": redis_status,
                            "Report Status": report_status,
                            "UI Status": ui_status,
                            "Monitor Status": monitor_status,
                            "Alarm Status": alarm_status,
                            "Timestamp": timestamp_formatted,
                        }
                        formatted_results.append(result_dict)

                    return formatted_results
        except (Exception, psycopg2.Error) as error:
            # Better logging can be added here
            print("Error fetching uptime status:", error)
            return []

    def fetch_camera_status(self):
        camsts_id = "1"
        try:
            with psycopg2.connect(**self.db_config) as conn:
                with conn.cursor() as cur:
                    query = """
                        SELECT cam_name
                        FROM cam_details
                        WHERE camsts_id = %s;
                    """
                    cur.execute(query, (camsts_id,))
                    cam_names = cur.fetchall()
                    # print(cam_names)
                    # Construct the query to fetch the status of all cameras within the timestamp range
                    status_query = "SELECT timestamp"

                    # Sanitize and add column names to the query
                    for cam_name in cam_names:
                        sanitized_cam_name = "".join(
                            char if char.isalnum() or char == "-" else "_"
                            for char in cam_name[0]
                        )
                        status_query += f', "{sanitized_cam_name}_status"'

                    status_query += (
                        " FROM uptime_status WHERE timestamp BETWEEN %s AND %s"
                    )

                    cur.execute(status_query, (self.start_date, self.end_date))
                    status_results = cur.fetchall()

                    formatted_results = []
                    for row in status_results:
                        timestamp, *statuses = row
                        formatted_timestamp = timestamp.strftime("%Y-%m-%d %H:%M:%S")
                        formatted_result = {
                            "timestamp": formatted_timestamp,
                        }
                        for i, cam_name in enumerate(cam_names):
                            status = statuses[i]
                            if status is not None and status == "2":
                                formatted_result[f"{cam_name[0]}_status"] = status
                            else:
                                formatted_result[f"{cam_name[0]}_status"] = (
                                    "0"  # Default value if status is None or not 2
                                )
                        formatted_results.append(formatted_result)

                    return formatted_results

        except (Exception, psycopg2.Error) as error:
            # Better logging can be added here
            print("Error fetching camera status:", error)
            return None
