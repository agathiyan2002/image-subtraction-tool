import datetime


class LogParser:
    def __init__(self, log_file="app/static/system_stats.log"):
        self.log_file = log_file

    def parse_log(self, start_date, end_date):
        data = []
        with open(self.log_file, "r") as file:
            for line in file:
                line = line.strip().replace(
                    "\x00", ""
                )  # Remove non-printable characters
                parts = line.split(",")
                try:
                    timestamp = datetime.datetime.strptime(
                        parts[0].strip(), "%Y-%m-%d %H:%M:%S.%f"
                    )
                    if start_date <= timestamp < end_date:
                        cpu = float(parts[1].split(": ")[1].replace("%", ""))
                        ram = int(parts[2].split(": ")[1].replace(" bytes", ""))
                        gpu = float(parts[4].split(": ")[1].replace("%", ""))
                        memory = float(parts[5].split(": ")[1].replace("%", ""))
                        temperature = int(parts[6].split(": ")[1])
                        data.append(
                            {
                                "timestamp": timestamp,
                                "cpu": cpu,
                                "ram": ram,
                                "gpu": gpu,
                                "memory": memory,
                                "temperature": temperature,
                            }
                        )
                except ValueError as e:
                    print(f"Error parsing line: {line}. Error: {e}")
        return data

    def fetch_timestamps_with_status(self, start_date, end_date):
        # Generate a list of all timestamps within the given range at minute intervals
        interval = datetime.timedelta(minutes=1)
        all_timestamps = []
        current_time = start_date
        while current_time < end_date:
            all_timestamps.append(
                current_time.replace(second=0, microsecond=0)
            )  # Remove seconds and microseconds
            current_time += interval

        # Initialize a dictionary to store timestamps and their statuses
        timestamp_status = {
            ts.strftime("%Y-%m-%d %H:%M"): 0 for ts in all_timestamps
        }  # Default value set to 0

        with open(self.log_file, "r") as file:
            for line in file:
                line = line.strip().replace(
                    "\x00", ""
                )  # Remove non-printable characters
                parts = line.split(",")
                try:
                    timestamp = datetime.datetime.strptime(
                        parts[0].strip(), "%Y-%m-%d %H:%M:%S.%f"
                    )
                    # Align timestamp to the nearest minute
                    aligned_timestamp = timestamp.replace(
                        second=0, microsecond=0
                    ).strftime("%Y-%m-%d %H:%M")
                    if (
                        start_date <= timestamp < end_date
                        and aligned_timestamp in timestamp_status
                    ):
                        timestamp_status[aligned_timestamp] = 1
                except ValueError as e:
                    print(f"Error parsing line: {line}. Error: {e}")

        # Convert the dictionary to a list of dictionaries
        timestamp_status_list = [
            {"timestamp": ts, "status": status}
            for ts, status in timestamp_status.items()
        ]

        return timestamp_status_list
