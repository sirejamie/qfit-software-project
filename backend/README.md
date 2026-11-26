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

## Queue management

Start the backend, then use the queue-management script from the `backend`
directory. It connects to the running API, so changes apply to the active
backend store:

```sh
uv run python -m scripts.manage_queue list
uv run python -m scripts.manage_queue add active 620123456 --full-name "Jamie Doe"
uv run python -m scripts.manage_queue add waitlist 620123456 --full-name "Jamie Doe"
uv run python -m scripts.manage_queue remove active 620123456
uv run python -m scripts.manage_queue remove waitlist 620123456
```

For several changes, put one action per line in a UTF-8 text file and apply it:

```text
# Queue defaults to active; a missing name defaults to the user ID.
add 620198765
add waitlist 620234567 Jamie Doe
remove active 620345678
remove waitlist 620456789
```

Quoted names are also supported. Blank lines and lines beginning with `#` are
ignored. Processing stops at the first invalid action or API error; earlier
actions are not rolled back. Add actions for users already in either queue are
skipped, and processing continues.

```sh
uv run python -m scripts.manage_queue apply queue_changes.txt
```

For a different API URL, set `QFIT_API_URL` or pass `--base-url` before the
command. With Supabase enabled, the user ID must match an existing user profile.
Adding to the active queue fails if the gym is at capacity.

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
