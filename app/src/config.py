import json


class ConfigLoader:
    def __init__(self):
 
        self.config = self.load_config()

    def load_config(self):
        try:
            with open("app/config/config.json", "r") as config_file:
                return json.load(config_file)
        except FileNotFoundError:
            print("Config file not found!")
            return {}
        except json.JSONDecodeError:
            print("Error decoding the config file!")
            return {}
