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

## Docker

Build and start the API:

```sh
docker compose up --build
```

The API is available at `http://localhost:8000`, with a health check at
`http://localhost:8000/health`.

By default, Docker uses the in-memory store. To use Supabase, set the variables
before starting Compose:

```sh
STORE_BACKEND=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
docker compose up --build
```

On PowerShell, set the variables with `$env:STORE_BACKEND = "supabase"` before
running `docker compose up --build`. Keep the service-role key out of source
control and never expose it to a browser or frontend application.
