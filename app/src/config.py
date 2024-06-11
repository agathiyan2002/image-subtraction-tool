import json


class ConfigLoader:
    def __init__(self):
        self.config_path = "config/config.json"
        self.config = self.load_config()

    def load_config(self):
        try:
            with open(self.config_path, "r") as config_file:
                return json.load(config_file)
        except FileNotFoundError:
            print("Config file not found!")
            return {}
        except json.JSONDecodeError:
            print("Error decoding the config file!")
            return {}
