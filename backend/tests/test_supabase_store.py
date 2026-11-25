from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from constants.demo_users import DEMO_USERS
from lib import supabase_client
from scripts.seed_demo_users import seed_demo_users
from stores import store_factory
from stores.session_store import InMemorySessionStore
from stores.supabase_store import SupabaseStore


class FakeTable:
    def __init__(self, data):
        self.data = data
        self.inserted = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def insert(self, record):
        self.inserted = record
        return self

    def execute(self):
        if self.inserted is not None:
            return SimpleNamespace(data=[{"id": "session-uuid", **self.inserted}])
        return SimpleNamespace(data=self.data)


class FakeSupabase:
    def __init__(self, profile):
        self.profile = profile
        self.tables = {
            "users": FakeTable([profile]),
            "gym_sessions": FakeTable([]),
        }

    def table(self, name):
        return self.tables[name]


class FakeSeedAdmin:
    def __init__(self, users=None):
        self.users = users or []
        self.created = []

    def list_users(self, **_kwargs):
        return self.users

    def create_user(self, attributes):
        self.created.append(attributes)
        return SimpleNamespace(user=SimpleNamespace(id=f"id-{attributes['email']}"))


class FakeSeedProfiles:
    def __init__(self):
        self.profiles = []

    def upsert(self, profile, **_kwargs):
        self.profiles.append(profile)
        return self

    def execute(self):
        return SimpleNamespace(data=self.profiles)


class FakeSeedClient:
    def __init__(self, users=None):
        self.admin = FakeSeedAdmin(users)
        self.profile_table = FakeSeedProfiles()
        self.auth = SimpleNamespace(admin=self.admin)

    def table(self, _name):
        return self.profile_table


def test_add_persists_session_using_schema_columns_and_user_foreign_key():
    profile = {
        "id": "user-uuid",
        "user_identifier": "620123456",
        "full_name": "Alaena Sang",
    }
    client = FakeSupabase(profile)
    store = SupabaseStore(client)
    start = datetime.now(UTC).replace(microsecond=0)

    record = store.add(
        "620123456",
        {
            "joinedAt": start.isoformat(),
            "durationMinutes": 45,
            "syncFailed": True,
        },
    )

    saved = client.tables["gym_sessions"].inserted
    assert saved["user_id"] == profile["id"]
    assert saved["start_time"] == start.isoformat()
    assert saved["expires_at"] == (start + timedelta(minutes=45)).isoformat()
    assert saved["status"] == "active"
    assert saved["timer_sync_status"] == "unsynced"
    assert record["userId"] == profile["user_identifier"]
    assert record["fullName"] == profile["full_name"]
    assert record["durationMinutes"] == 45
    assert record["syncFailed"] is True


def test_store_backend_defaults_to_memory(monkeypatch):
    monkeypatch.delenv("STORE_BACKEND", raising=False)

    assert isinstance(store_factory.create_session_store(), InMemorySessionStore)


def test_store_backend_can_select_supabase(monkeypatch):
    monkeypatch.setenv("STORE_BACKEND", "supabase")
    monkeypatch.setattr(store_factory, "SupabaseStore", lambda: "supabase store")

    assert store_factory.create_session_store() == "supabase store"


def test_seed_demo_users_creates_auth_accounts_and_valid_profiles():
    client = FakeSeedClient()

    created = seed_demo_users(client)

    assert created == 3
    assert len(client.profile_table.profiles) == 3
    assert {profile["role"] for profile in client.profile_table.profiles} == {
        "user",
        "staff",
    }
    assert all(
        profile["id"].startswith("id-") and profile["user_identifier"]
        for profile in client.profile_table.profiles
    )


def test_seed_demo_users_reuses_existing_auth_accounts():
    existing_user = SimpleNamespace(
        id="existing-auth-id",
        email=DEMO_USERS[0]["email"],
    )
    client = FakeSeedClient([existing_user])

    created = seed_demo_users(client)

    assert created == 2
    assert client.profile_table.profiles[0]["id"] == "existing-auth-id"


def test_supabase_client_prefers_service_role_key(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "legacy-key")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    monkeypatch.setattr(
        supabase_client,
        "create_client",
        lambda url, key: (url, key),
    )

    assert supabase_client.get_supabase_client() == (
        "https://example.supabase.co",
        "service-role-key",
    )
