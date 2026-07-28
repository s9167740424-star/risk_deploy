def register(client):
    response = client.post("/api/auth/register", json={
        "full_name":"Ирина Иванова",
        "email":"ira@example.com",
        "password":"secret123",
    })
    assert response.status_code == 201

def test_survey_schema_from_db(client):
    response = client.get("/api/questionnaire/schema")
    assert response.status_code == 200
    steps = response.get_json()["schema"]["steps"]
    assert len(steps) >= 1
    assert steps[0]["questions"]

def test_questionnaire_personalizes_documents(client):
    register(client)
    response = client.put("/api/questionnaire", json={
        "owners_count":"multiple",
        "maternity_capital":True,
        "property_type":"apartment",
        "redevelopment":"unauthorized",
        "sale_urgency":"three_months",
        "current_step":3,
        "completed":True,
        "answers": {"maternityCapital": "yes"},
    })
    assert response.status_code == 200
    payload = client.get("/api/documents").get_json()
    codes = {x["code"] for x in payload["items"]}
    assert "maternity_capital_documents" in codes
    assert "passport_rf" in codes
    assert payload["personalized"] is True
    assert len(payload.get("sources") or []) >= 1

def test_map_context_and_place_categories(client):
    items = client.get("/api/properties?q=Садовая").get_json()["items"]
    assert items
    pid = items[0]["id"]
    ctx = client.get(f"/api/map/property/{pid}").get_json()
    assert ctx["markers"]
    assert ctx["surroundings"]
    assert ctx["place_categories"]
    assert all("title" in c and "subtitle" in c and "places" in c for c in ctx["place_categories"])
    places = client.get("/api/map/document-points").get_json()
    assert places["categories"]

def test_property_risk_analysis(client):
    items = client.get("/api/properties?q=Садовая").get_json()["items"]
    assert items
    response = client.get(f'/api/risks/property/{items[0]["id"]}')
    assert response.status_code == 200
    analysis = response.get_json()["analysis"]
    assert analysis["risks"]
    assert analysis["positive_factors"]
    assert analysis["overall_risk"] in {"low","medium","high"}
