import os, json


class ImageStatusProcessor:
    def process_image_status(self, update_key_path, status):
        try:
            _, filename = os.path.split(update_key_path)
            json_filename = os.path.splitext(filename)[0] + ".json"
            json_path = os.path.join(os.path.dirname(update_key_path), json_filename)

            if os.path.exists(json_path):
                try:
                    with open(json_path, "r") as f:
                        data = json.load(f)
                except json.JSONDecodeError as e:
                    print(f"Error reading JSON file {json_path}: {e}")
                    return

                data["status"] = status

                try:
                    with open(json_path, "w") as f:
                        json.dump(data, f, indent=4)
                except IOError as e:
                    print(f"Error writing to JSON file {json_path}: {e}")
            else:
                print(f"JSON file does not exist: {json_path}")

        except Exception as e:
            print(f"Unexpected error: {e}")
