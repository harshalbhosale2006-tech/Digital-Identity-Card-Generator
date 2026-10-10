# Digital Identity Card Generator — Frontend

The frontend is static HTML, CSS, and JavaScript. It authenticates against the Spring Boot backend using an HttpOnly server session cookie; the browser must not open these pages directly with `file://`.

## Run locally on Windows

Start the backend in one PowerShell terminal (MySQL must be running and configured):

```powershell
Set-Location .\backend
mvn spring-boot:run
```

Start the static frontend server in a second terminal:

```powershell
Set-Location .\Frontend
node .\dev-server.js
```

Open `http://127.0.0.1:5500/login.html`. The frontend sends API requests to `http://127.0.0.1:8080/api` with credentials included. The backend's default CORS configuration allows this local origin.

For a different backend URL, define `window.API_BASE_URL` before `script.js` loads, including the `/api` suffix. A trailing slash is accepted. Keep the frontend and backend on the same site when using the development `SameSite=Lax` session cookie, and use HTTPS with secure cookies in production.

## Additional ID card categories
Use **Create New ID Card** on the dashboard to open the separate category chooser. Student ID Card links directly to the original `create-card.html` flow; Employee, Personal, Organization/Member, Event, and Freelancer cards use their own category-specific fields and preview. The new categories share authenticated card persistence and dashboard management, but are explicitly labelled unverified and do not receive institutional QR codes. Optional photo, email, phone, Personal date of birth/nationality, Member end date, and Freelancer portfolio URL may be left blank.

## QR verification
Saved Student cards receive a QR code that opens `verify.html?token=...`. Until a token and configured verification URL are available, the card preview and dashboard verification badge show `Pending`. QR generation errors remain `Pending`; an unknown token shows `Card Not Found`. A generated QR is labelled `Verified — Active` only after the QR SVG is fetched and rendered and `GET /api/verify/{token}` confirms the active database record. Inactive and unreachable verification-backend outcomes show `Card Inactive` and `Verification Temporarily Unavailable`. Active public results show only approved student identity fields; private contact and personal details are not returned. Additional card categories do not receive institutional verification QR codes.

Configure the backend's `VERIFICATION_BASE_URL` to the address that scanners should open. It must be reachable by the scanner; there is intentionally no localhost fallback. For same-Wi-Fi phone testing, set it to `http://<computer-LAN-IP>:5500/verify.html`, add `http://<computer-LAN-IP>:5500` to `CORS_ALLOWED_ORIGINS`, and in a PowerShell terminal in `Frontend`, start the server with:

```powershell
$env:FRONTEND_HOST = '0.0.0.0'
node .\dev-server.js
```

Use your computer's actual LAN IP instead of the angle-bracketed value, allow the required ports through Windows Firewall if prompted, and open the generated URL on a phone connected to the same network. Keep production verification URLs on HTTPS.

## Authentication
`POST /api/auth/login` and `GET /api/auth/me` return the user fields directly in the JSON response. The backend creates and validates an HttpOnly `JSESSIONID` session cookie. The dashboard checks `/api/auth/me` on each load; cached browser storage is not used as proof of authentication. Invalid credentials remain rejected by the backend.

See [the backend README](../backend/README.md) for database configuration, the initial admin account, and API details.
