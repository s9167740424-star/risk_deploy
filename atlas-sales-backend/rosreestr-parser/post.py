import requests
import json
response = requests.post(
    "http://localhost:8000/parse",
    json={
        "latitude": 55.989557,
        "longitude": 37.822837
    }
)
if response.status_code == 200:
    data = response.json()
    print(json.dumps(data, indent=2, ensure_ascii=False))
