import os
import json
import base64

def decrypt_and_save_images_from_base_folder(base_folder, destination_folder, date=None):
    images_dict = {}

    for root, dirs, files in os.walk(base_folder):
        # Filter out 'confign' directories
        dirs[:] = [d for d in dirs if d != 'confign']

        for file in files:
            if file.endswith(".json"):
                json_file_path = os.path.join(root, file)
                try:
                    with open(json_file_path, "r") as f:
                        json_data = json.load(f)
                    
                    # Decode image data from the JSON file
                    image_data = base64.b64decode(json_data["imageData"])

                    # Construct the destination path for the image
                    relative_path = os.path.relpath(root, base_folder)
                    
                    # Remove 'knit-i' from the relative path if it exists
                    if 'knit-i' in relative_path:
                        relative_path_parts = relative_path.split(os.sep)
                        if 'knit-i' in relative_path_parts:
                            relative_path_parts.remove('knit-i')
                        relative_path = os.path.join(*relative_path_parts)
                    
                    # Extracting mill name, roll number, and date from the path
                    parts = relative_path.split(os.sep)
                    if len(parts) < 3:
                        print(f"Skipping file with insufficient path information: {json_file_path}")
                        continue
                    
                    mill_name = parts[0]
                    roll_number = parts[4]
                    file_date = parts[5]

                    # Check if the folder's date matches the given date
                    if date is not None and file_date != date:
                        continue

                    label_folder_path = os.path.join(destination_folder, relative_path, json_data["shapes"][0]["label"])
                    os.makedirs(label_folder_path, exist_ok=True)
                    image_path = os.path.join(label_folder_path, os.path.basename(json_data["imagePath"]))

                    # Save the image if it has not been saved already
                    if not os.path.exists(image_path):
                        with open(image_path, "wb") as img_file:
                            img_file.write(image_data)
                        
                        coordinates = json_data["shapes"][0].get("points", [])

                        # Store image data in the nested dictionary
                        if mill_name not in images_dict:
                            images_dict[mill_name] = {}
                        if roll_number not in images_dict[mill_name]:
                            images_dict[mill_name][roll_number] = {}
                        if file_date not in images_dict[mill_name][roll_number]:
                            images_dict[mill_name][roll_number][file_date] = []

                        images_dict[mill_name][roll_number][file_date].append({
                            "label": json_data["shapes"][0]["label"],
                            "image_path": image_path,
                            "coordinates": coordinates
                        })
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON file {json_file_path}: {e}")
                except Exception as e:
                    print(f"Unexpected error processing file {json_file_path}: {e}")
    
    return images_dict

 
# Load the configuration
try:
    with open("config.json", "r") as config_file:
        config = json.load(config_file)
        base_folder = config.get("base_folder")
        destination_folder = os.path.join("static", "temp")  # Set your destination folder
        log_file_path = "log.txt"  # Define your log file path
except FileNotFoundError:
    print("Config file not found!")
    base_folder = None
    destination_folder = None
    log_file_path = None
    date = None

 
    # Call the function to decrypt and save images
    date="2024-05-28"
    all_images = decrypt_and_save_images_from_base_folder(base_folder, destination_folder, date)
    print("Decrypted and saved images:", all_images)

    # Write image details to log file
    write_log_file(all_images, log_file_path)
    print(f"Image details written to {log_file_path}")
