import os, time, schedule
from src.config import ConfigLoader
from src.restore_db_files import DBRestorer


class DatabaseScheduler:
    def __init__(self):
        config_loader = ConfigLoader()
        self.config_loader = config_loader
        self.db_folder_path = self.config_loader.config.get("database")
        self.db_host = "localhost"
        self.db_port = "5432"
        self.db_user = "postgres"
        os.environ["PGPASSWORD"] = "soft"
        self.db_restorer = DBRestorer(
            self.db_folder_path, self.db_host, self.db_port, self.db_user
        )

    def restore_databases_daily(self):
        config = self.config_loader.config
        db_folder_path = config.get("database")
        self.db_restorer.restore_databases()  # Adjust this line to match the correct method signature
        print("Databases restored.")

    def schedule_daily_task(self):
        schedule.every().day.at("09:00").do(self.restore_databases_daily)
        # schedule.every(1).minutes.do(self.restore_databases_daily)

    def run_scheduler(self):
        self.schedule_daily_task()
        while True:
            schedule.run_pending()
            time.sleep(60)
