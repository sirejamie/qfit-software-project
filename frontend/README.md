# QFit: Frontend

Frontend Folder

## Implementation

* HTML
* CSS
* JavaScript

## Demonstration

All thats necessary for the presentation would be running this command:

```sh
npm run dev
```

## API connection

The browser app reads and updates gym data through the API instead of storing it
in `localStorage`. The default API base is `/api`; in Vite development requests
are proxied to `http://localhost:8000` with the `/api` prefix removed. Set
`VITE_API_TARGET` to use a different backend server.

API route paths and the polling interval can be overridden before `src/api.js`
loads by setting `window.QFitApiConfig`, or changed in `src/api.js`. The default
route map uses `/gym/status`, `/gym/active`, and `/gym/waitlist` for reads. It
expects these additional routes by default:

* `POST /gym/checkin` and `POST /gym/checkout/{userId}`
* `POST /gym/waitlist/{userId}/promote`, `DELETE /gym/waitlist/{userId}`,
  and `PATCH /gym/waitlist/{userId}`
* `PATCH /gym/active/{userId}/resync`, `PUT /gym/settings`, and `POST /demo/reset`
* `GET` and `DELETE /gym/notices/{userId}` for checkout notices
* `POST /auth/login`, `POST /auth/register`, and `POST /auth/password/reset`

Queue and waitlist responses should be arrays of user objects using either
camelCase or snake_case fields. Status responses should include capacity fields
such as `current_count` and `max_capacity`. Check-in responses must include
`success`, a `status` of `active` or `waitlist`, and a `user` record. Login
and registration responses must include a `user` with an identifier and role;
an optional `access_token` is sent as a bearer token on later requests. Route
overrides can be provided like this before loading `src/api.js`:

```js
window.QFitApiConfig = {
  baseUrl: '/api',
  routes: {
    queue: '/gym/sessions',
    checkIn: '/gym/sessions/check-in'
  }
};
```

The backend currently implements only part of this contract, and its active and
waitlist handlers return placeholder records. Replace those responses and add
the configured write and authentication routes before using those flows.
