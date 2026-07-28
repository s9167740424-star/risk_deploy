def test_register_login_logout(client):
    register = client.post("/api/auth/register", json={
        "full_name":"Ирина Иванова",
        "email":"ira@example.com",
        "password":"secret123",
    })
    assert register.status_code == 201
    assert client.get("/api/auth/me").get_json()["authenticated"] is True
    assert client.post("/api/auth/logout").status_code == 200
    login = client.post("/api/auth/login", json={
        "email":"ira@example.com","password":"secret123"
    })
    assert login.status_code == 200
