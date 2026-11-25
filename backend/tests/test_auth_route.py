from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from constants.demo_users import DEMO_USERS
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def restore_demo_users():
    original_users = deepcopy(DEMO_USERS)
    yield
    DEMO_USERS[:] = original_users


@pytest.mark.parametrize(
    ("identifier", "password", "expected_role"),
    [
        ("STAFF101", "staff123", "staff"),
        ("620123456", "user123", "user"),
        ("620198765", "user123", "user"),
    ],
)
def test_demo_accounts_can_log_in(identifier, password, expected_role):
    response = client.post(
        "/auth/login",
        json={"userIdentifier": identifier, "password": password},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["userIdentifier"] == identifier
    assert body["user"]["role"] == expected_role
    assert "password" not in body["user"]


def test_demo_login_rejects_invalid_credentials():
    response = client.post(
        "/auth/login",
        json={"userIdentifier": "STAFF101", "password": "wrong"},
    )

    assert response.status_code == 401


def test_registered_user_is_added_to_the_in_memory_demo_account_store():
    response = client.post(
        "/auth/register",
        json={
            "userIdentifier": "new-user",
            "fullName": "New User",
            "password": "pass1234",
            "role": "user",
        },
    )

    assert response.status_code == 201
    assert response.json()["user"]["userIdentifier"] == "NEW-USER"
    assert client.post(
        "/auth/login",
        json={"userIdentifier": "new-user", "password": "pass1234"},
    ).status_code == 200


def test_demo_password_reset_updates_the_account():
    response = client.post(
        "/auth/password/reset",
        json={"userIdentifier": "620123456", "newPassword": "changed123"},
    )

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert client.post(
        "/auth/login",
        json={"userIdentifier": "620123456", "password": "changed123"},
    ).status_code == 200
