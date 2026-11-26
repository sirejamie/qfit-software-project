import argparse
import json
import os
import shlex
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


def _request(
    base_url: str, method: str, path: str, payload: dict | None = None
) -> dict | list | None:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        f"{base_url.rstrip('/')}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with urlopen(request, timeout=10) as response:
            body = response.read()
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(detail).get("detail", detail)
        except (json.JSONDecodeError, AttributeError):
            pass
        raise RuntimeError(f"API returned HTTP {error.code}: {detail}") from error
    except URLError as error:
        raise RuntimeError(
            f"Could not connect to the QFit API at {base_url}: {error.reason}"
        ) from error

    return json.loads(body) if body else None


def _execute_action(
    base_url: str,
    action: str,
    queue: str,
    user_id: str,
    full_name: str | None = None,
    duration_minutes: int = 60,
) -> dict | None:
    if queue not in {"active", "waitlist"}:
        raise ValueError(f"Unsupported queue: {queue!r}.")
    if not user_id.strip():
        raise ValueError("user_id must not be blank.")
    encoded_user_id = quote(user_id.strip(), safe="")

    if action == "add":
        name = (full_name or user_id).strip()
        if not name:
            raise ValueError("full_name must not be blank.")
        if duration_minutes <= 0:
            raise ValueError("duration-minutes must be greater than zero.")
        return _request(
            base_url,
            "POST",
            f"/gym/{queue}",
            {
                "userId": user_id.strip(),
                "fullName": name,
                "durationMinutes": duration_minutes,
            },
        )

    if action == "remove":
        if queue == "active":
            _request(
                base_url,
                "POST",
                f"/gym/checkout/{encoded_user_id}",
                {"removedBy": "staff"},
            )
        else:
            _request(base_url, "DELETE", f"/gym/waitlist/{encoded_user_id}")
        return {"removed": True, "queue": queue, "userId": user_id.strip()}

    raise ValueError(f"Unsupported action: {action!r}.")


def _parse_file_action(tokens: list[str]) -> tuple[str, str, str, str | None]:
    if not tokens:
        raise ValueError("Expected an add or remove action.")

    action = tokens[0].lower()
    arguments = tokens[1:]
    if action not in {"add", "remove"}:
        raise ValueError(f"Unsupported action {tokens[0]!r}; use add or remove.")

    queue = "active"
    if arguments and arguments[0].lower() in {"active", "waitlist"}:
        queue = arguments.pop(0).lower()

    if not arguments:
        raise ValueError(f"{action} requires a user ID.")
    user_id = arguments.pop(0)
    if not user_id.strip():
        raise ValueError("user_id must not be blank.")

    if action == "remove" and arguments:
        raise ValueError("remove accepts only an optional queue and a user ID.")

    full_name = " ".join(arguments).strip() or user_id if action == "add" else None
    return action, queue, user_id, full_name


def _current_queue_ids(base_url: str) -> set[str]:
    user_ids = set()
    for path in ("/gym/active", "/gym/waitlist"):
        users = _request(base_url, "GET", path)
        if not isinstance(users, list):
            raise TypeError(f"API returned an invalid queue for {path}.")
        for user in users:
            if not isinstance(user, dict) or not isinstance(user.get("userId"), str):
                raise TypeError(f"API returned an invalid user in {path}.")
            user_ids.add(user["userId"])
    return user_ids


def _apply_file(base_url: str, file_path: Path) -> None:
    try:
        lines = file_path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as error:
        raise RuntimeError(f"Could not read {file_path}: {error}") from error

    try:
        queued_user_ids = _current_queue_ids(base_url)
    except TypeError as error:
        raise RuntimeError(str(error)) from error
    actions_found = 0
    for line_number, line in enumerate(lines, start=1):
        try:
            tokens = shlex.split(line, comments=True)
            if not tokens:
                continue
            action, queue, user_id, full_name = _parse_file_action(tokens)
            actions_found += 1
            normalized_user_id = user_id.strip()
            if action == "add" and normalized_user_id in queued_user_ids:
                print(
                    json.dumps(
                        {
                            "line": line_number,
                            "skipped": True,
                            "reason": "already_in_a_queue",
                            "userId": normalized_user_id,
                        },
                        indent=2,
                    )
                )
                continue
            result = _execute_action(
                base_url, action, queue, user_id, full_name
            )
        except (ValueError, RuntimeError) as error:
            raise RuntimeError(f"{file_path}:{line_number}: {error}") from error
        print(json.dumps({"line": line_number, "result": result}, indent=2))
        if action == "add":
            queued_user_ids.add(normalized_user_id)
        else:
            queued_user_ids.discard(normalized_user_id)

    if not actions_found:
        print(f"No actions found in {file_path}.")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Manage users in the active and waitlist queues."
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("QFIT_API_URL", "http://127.0.0.1:8000"),
        help="QFit API URL (default: QFIT_API_URL or http://127.0.0.1:8000)",
    )
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="Show both queues")
    apply_file = commands.add_parser("apply", help="Apply queue actions from a text file")
    apply_file.add_argument("file", type=Path)

    add = commands.add_parser("add", help="Add a user to a queue")
    add.add_argument("queue", choices=("active", "waitlist"))
    add.add_argument("user_id")
    add.add_argument("--full-name", required=True)
    add.add_argument("--duration-minutes", type=int, default=60)

    remove = commands.add_parser("remove", help="Remove a user from a queue")
    remove.add_argument("queue", choices=("active", "waitlist"))
    remove.add_argument("user_id")
    return parser


def main(argv: list[str] | None = None) -> None:
    parser = _parser()
    args = parser.parse_args(argv)
    if args.command in {"add", "remove"}:
        args.user_id = args.user_id.strip()
        if not args.user_id:
            parser.error("user_id must not be blank.")

    try:
        if args.command == "list":
            result = {
                "active": _request(args.base_url, "GET", "/gym/active"),
                "waitlist": _request(args.base_url, "GET", "/gym/waitlist"),
            }
        elif args.command == "apply":
            _apply_file(args.base_url, args.file)
            return
        elif args.command == "add":
            if args.duration_minutes <= 0:
                parser.error("--duration-minutes must be greater than zero.")
            result = _execute_action(
                args.base_url,
                "add",
                args.queue,
                args.user_id,
                args.full_name,
                args.duration_minutes,
            )
        else:
            result = _execute_action(
                args.base_url, "remove", args.queue, args.user_id
            )
    except RuntimeError as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1) from error

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
