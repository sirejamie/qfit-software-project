from typing import Any

from constants.demo_users import DEMO_USERS
from lib.supabase_client import get_supabase_client
from supabase import Client

PAGE_SIZE = 1000


def _existing_users(client: Client, emails: set[str]) -> dict[str, Any]:
    existing = {}
    page = 1
    while len(existing) < len(emails):
        users = client.auth.admin.list_users(page=page, per_page=PAGE_SIZE)
        for user in users:
            if user.email and user.email.lower() in emails:
                existing[user.email.lower()] = user
        if len(users) < PAGE_SIZE:
            break
        page += 1
    return existing


def seed_demo_users(client: Client | None = None) -> int:
    client = client if client is not None else get_supabase_client()
    emails = {user["email"].lower() for user in DEMO_USERS}
    existing = _existing_users(client, emails)
    created = 0

    for demo_user in DEMO_USERS:
        email = demo_user["email"].lower()
        auth_user = existing.get(email)
        if auth_user is None:
            response = client.auth.admin.create_user(
                {
                    "email": email,
                    "password": demo_user["password"],
                    "email_confirm": True,
                    "user_metadata": {
                        "full_name": demo_user["fullName"],
                        "user_identifier": demo_user["userIdentifier"],
                    },
                }
            )
            auth_user = response.user
            created += 1

        role = demo_user["role"]
        if role not in {"user", "staff"}:
            raise ValueError(f"Unsupported demo role: {role!r}")

        client.table("users").upsert(
            {
                "id": auth_user.id,
                "user_identifier": demo_user["userIdentifier"],
                "full_name": demo_user["fullName"],
                "email": email,
                "role": role,
            },
            on_conflict="id",
        ).execute()

    return created


def main() -> None:
    created = seed_demo_users()
    print(f"Demo profiles synchronized; created {created} Supabase Auth account(s).")


if __name__ == "__main__":
    main()
