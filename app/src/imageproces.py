import os, base64, json, shutil


class ImageProcessor:
    def __init__(self, base_folder, destination_folder):
        self.base_folder = base_folder
        self.destination_folder = destination_folder

    def clear_temp_folder(self):
        temp_folder = os.path.join("static/", "temp")
        if os.path.exists(temp_folder):
            try:
                shutil.rmtree(temp_folder)
            except PermissionError as e:
                print(f"PermissionError: {e}. Retrying with elevated permissions.")
                for root, dirs, files in os.walk(temp_folder, topdown=False):
                    for name in files:
                        try:
                            os.remove(os.path.join(root, name))
                        except PermissionError as e:
                            print(f"Failed to remove file {name}: {e}")
                    for name in dirs:
                        try:
                            os.rmdir(os.path.join(root, name))
                        except PermissionError as e:
                            print(f"Failed to remove directory {name}: {e}")
                try:
                    os.rmdir(temp_folder)
                except PermissionError as e:
                    print(f"Failed to remove directory {temp_folder}: {e}")

        os.makedirs(temp_folder, exist_ok=True)

    def decrypt_and_save_images_from_base_folder(self, date):
        images_dict = {}

        for root, dirs, files in os.walk(self.base_folder):
            # Filter out 'confign' directories
            dirs[:] = [d for d in dirs if d != "confign"]

            for file in files:
                if file.endswith(".json"):
                    json_file_path = os.path.join(root, file)
                    try:
                        with open(json_file_path, "r") as f:
                            json_data = json.load(f)

                        # Decode image data from the JSON file
                        image_data = base64.b64decode(json_data["imageData"])

                        # Construct the destination path for the image
                        relative_path = os.path.relpath(root, self.base_folder)

                        # Remove 'knit-i' from the relative path if it exists
                        if "knit-i" in relative_path:
                            relative_path_parts = relative_path.split(os.sep)
                            if "knit-i" in relative_path_parts:
                                relative_path_parts.remove("knit-i")
                            relative_path = os.path.join(*relative_path_parts)

                        # Extracting mill name, roll number, and date from the path
                        parts = relative_path.split(os.sep)
                        if len(parts) < 3:
                            print(
                                f"Skipping file with insufficient path information: {json_file_path}"
                            )
                            continue

                        mill_name = parts[0]
                        roll_number = parts[4]
                        file_date = parts[5]

                        # Check if the folder's date matches the given date
                        if date is not None and file_date != date:
                            continue

                        label_folder_path = os.path.join(
                            self.destination_folder,
                            relative_path,
                            json_data["shapes"][0]["label"],
                        )
                        os.makedirs(label_folder_path, exist_ok=True)
                        image_path = os.path.join(
                            label_folder_path, os.path.basename(json_data["imagePath"])
                        )

                        # Save the image if it has not been saved already
                        if not os.path.exists(image_path):
                            with open(image_path, "wb") as img_file:
                                img_file.write(image_data)
                            if os.path.exists(image_path):
                                print(
                                    f"Image stored successfully in destination folder: {image_path}"
                                )
                                print(
                                    f"Full path of the image: {os.path.abspath(image_path)}"
                                )
                            else:
                                print("Failed to store the image.")
                        else:
                            print(
                                f"Image already exists in destination folder: {image_path}"
                            )

                        # Additional condition if no image is available
                        if not os.path.exists(image_path):
                            print("No image available.")

                        coordinates = json_data["shapes"][0].get("points", [])

                        # Store image data in the nested dictionary
                        if mill_name not in images_dict:
                            images_dict[mill_name] = {}
                        if roll_number not in images_dict[mill_name]:
                            images_dict[mill_name][roll_number] = {}
                        if file_date not in images_dict[mill_name][roll_number]:
                            images_dict[mill_name][roll_number][file_date] = []

                        images_dict[mill_name][roll_number][file_date].append(
                            {
                                "label": json_data["shapes"][0]["label"],
                                "image_path": image_path,
                                "coordinates": coordinates,
                            }
                        )
                    except json.JSONDecodeError as e:
                        print(f"JSON decode error for file {json_file_path}: {e}")
                    except Exception as e:
                        print(f"Error processing file {json_file_path}: {e}")
        return images_dict
