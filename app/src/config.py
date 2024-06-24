import json

class ConfigLoader:
    def __init__(self):
 
        self.config = self.load_config()

    def load_config(self):
        try:
            config_file={
            "base_folder": "/home/kniti/projects/",
            "database": "/home/kniti/cloud/Database",
            "validation": "/home/kniti/validation/"
            }

            return config_file
        except FileNotFoundError:
            print("Config file not found")
            return {}
        except json.JSONDecodeError:
            print("Error decoding the config file!")
            return {}
