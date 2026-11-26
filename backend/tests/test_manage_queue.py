import pytest

from scripts import manage_queue


def test_apply_file_runs_queue_actions_in_order(tmp_path, monkeypatch, capsys):
    changes = tmp_path / "queue.txt"
    changes.write_text(
        '# Add a member\nadd 620198765\nadd waitlist 620234567 "Jamie Doe"\n'
        "remove active 620345678\nremove waitlist 620456789\n",
        encoding="utf-8",
    )
    requests = []

    def fake_request(base_url, method, path, payload=None):
        requests.append((base_url, method, path, payload))
        if method == "GET":
            return []
        if path in {"/gym/active", "/gym/waitlist"}:
            return {"user": payload}
        return None

    monkeypatch.setattr(manage_queue, "_request", fake_request)

    manage_queue.main(["--base-url", "http://localhost:9000", "apply", str(changes)])

    assert requests == [
        (
            "http://localhost:9000",
            "GET",
            "/gym/active",
            None,
        ),
        (
            "http://localhost:9000",
            "GET",
            "/gym/waitlist",
            None,
        ),
        (
            "http://localhost:9000",
            "POST",
            "/gym/active",
            {
                "userId": "620198765",
                "fullName": "620198765",
                "durationMinutes": 60,
            },
        ),
        (
            "http://localhost:9000",
            "POST",
            "/gym/waitlist",
            {
                "userId": "620234567",
                "fullName": "Jamie Doe",
                "durationMinutes": 60,
            },
        ),
        (
            "http://localhost:9000",
            "POST",
            "/gym/checkout/620345678",
            {"removedBy": "staff"},
        ),
        (
            "http://localhost:9000",
            "DELETE",
            "/gym/waitlist/620456789",
            None,
        ),
    ]
    assert "line" in capsys.readouterr().out


def test_apply_file_skips_users_already_in_either_queue_and_continues(
    tmp_path, monkeypatch, capsys
):
    changes = tmp_path / "queue.txt"
    changes.write_text(
        "add 620198765\nadd 620234567\n",
        encoding="utf-8",
    )
    requests = []

    def fake_request(_base_url, method, path, payload=None):
        requests.append((method, path))
        if method == "GET" and path == "/gym/active":
            return [{"userId": "620198765"}]
        if method == "GET":
            return []
        return {"user": payload}

    monkeypatch.setattr(manage_queue, "_request", fake_request)

    manage_queue.main(["apply", str(changes)])

    assert requests == [
        ("GET", "/gym/active"),
        ("GET", "/gym/waitlist"),
        ("POST", "/gym/active"),
    ]
    output = capsys.readouterr().out
    assert '"skipped": true' in output
    assert '"userId": "620234567"' in output


def test_apply_file_stops_on_first_failed_action(tmp_path, monkeypatch, capsys):
    changes = tmp_path / "queue.txt"
    changes.write_text("add 620198765\nremove waitlist 620234567\n", encoding="utf-8")
    requests = []

    def fake_request(_base_url, method, path, _payload=None):
        requests.append((method, path))
        if method == "GET":
            return []
        raise RuntimeError("API returned HTTP 409: queue is full")

    monkeypatch.setattr(manage_queue, "_request", fake_request)

    with pytest.raises(SystemExit, match="1"):
        manage_queue.main(["apply", str(changes)])

    assert requests == [
        ("GET", "/gym/active"),
        ("GET", "/gym/waitlist"),
        ("POST", "/gym/active"),
    ]
    assert f"{changes}:1" in capsys.readouterr().err
