import json

def write_to_json_file(data, file_path):
    """
    Writes the given data to a JSON file.

    Args:
        data (dict or list): The data to write. It must be serializable to JSON.
        file_path (str): The file path where the JSON data will be stored.
    """
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"Data successfully written to {file_path}")
    except Exception as e:
        print(f"Error writing data to {file_path}: {e}")

def read_from_json(file_path):
    with open(file_path, "r") as f:
        data = json.load(f)
    return data