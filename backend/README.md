# QFit: Backend

Backend Folder

## Dependencies

* uv
* fastapi
* supabase

```sh
uv run python -m scripts.seed_demo_users
```

The command creates only missing Auth accounts; existing accounts keep their
current passwords, while their profile rows are synchronized. The demo
passwords are development credentials and should not be used in production.

## Commands

> Get uv as a package manager for python: [download here](https://docs.astral.sh/uv/#__tabbed_1_2)

Check if `uv` exists and validate the version

```sh
uv --version
```

Download all dependencies (Go to the backend folder first)

```sh
uv sync
```

Run demo

```sh
uv run fastapi dev
```
