# Digital Identity Card Generator — Java Backend

A REST API backend built with Java 25 LTS, Spring Boot, Spring Data JPA, and MySQL. Includes session-based admin login, identity-card CRUD, search/filter/pagination, dashboard statistics, validation, and centralized error responses.

## Requirements
- JDK 25 or newer
- Maven 3.9+
- MySQL 8+
- VS Code with Extension Pack for Java, or IntelliJ IDEA

## Database and configuration
The configured database is `digital_id_db` on `localhost:3306`; the default MySQL username is `root`. Override the URL or username with `DB_URL` or `DB_USERNAME` when your local MySQL setup uses different values. The JDBC URL does not create databases automatically, and startup requires `DB_PASSWORD` to be set.

Check whether the database exists in MySQL Workbench before starting the backend:

```sql
SELECT SCHEMA_NAME
FROM INFORMATION_SCHEMA.SCHEMATA
WHERE SCHEMA_NAME = 'digital_id_db';
```

If that query returns no row, create only the missing database; this does not drop or replace existing data:

```sql
CREATE DATABASE IF NOT EXISTS digital_id_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Do not run a `DROP DATABASE` command. The checked-in `schema.sql` uses `CREATE TABLE IF NOT EXISTS`; use it only if the new database needs its tables. For local development Hibernate uses `ddl-auto=update`. Change `ADMIN_PASSWORD` before use. The initial admin is created on first startup if the configured email and username are not already present.

In PowerShell, set the database password for this terminal session without putting it in source control or typing it into the command itself, then start the backend:

```powershell
$env:DB_USERNAME = 'root'
$securePassword = Read-Host 'MySQL password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $env:DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    Remove-Variable securePassword, passwordPointer
}
mvn spring-boot:run
```

Use the MySQL account appropriate for your installation instead of `root` if needed. `DB_PASSWORD` is inherited by Maven/the backend process until that terminal is closed; do not persist it with `setx` or commit it to a file.

Default development login: `admin@institute.edu` or username `admin`; password is `ChangeMe123!` unless `ADMIN_PASSWORD` is configured. Change it before use.

## Run
```bash
mvn clean spring-boot:run
```
Build a jar with `mvn clean package`, then run `java -jar target/digital-id-backend-1.0.0.jar`.
Health check: `GET http://localhost:8080/api/health`.

## Authentication
`POST /api/auth/login` JSON: `{"identifier":"admin@institute.edu","password":"ChangeMe123!"}`. Login returns a server-side session cookie. Clients must retain cookies; browser fetch calls should use `credentials: 'include'`. `GET /api/auth/me` returns the logged-in admin; `POST /api/auth/logout` invalidates the session.

## Identity-card APIs
All `/api/cards/**` endpoints require an admin session.
- `GET /api/cards` — search/filter/paginate with `q`, `status`, `department`, `course`, `year`, `semester`, `page` (zero-based), `size` (max 100), `sortBy` (`createdAt`, `fullName`, `idNumber`, `status`) and `direction` (`asc`/`desc`).
- `GET /api/cards/stats` — total, active, pending, inactive, blocked counts.
- `GET /api/cards/{id}` — retrieve by database ID.
- `GET /api/cards/number/{idNumber}` — retrieve by card number.
- `POST /api/cards` — create card (201).
- `PUT /api/cards/{id}` — update card.
- `PATCH /api/cards/{id}/status` — JSON `{"status":"Active"}`. Valid statuses: Active, Pending, Inactive, Blocked.
- `DELETE /api/cards/{id}` — delete card (204).

### Additional ID card categories
The existing Student ID Card remains the default when `cardType` is omitted. Additional authenticated cards use the same existing card API and dashboard:

- `EMPLOYEE`: required `jobTitle`, `department`, `organization`, `startDate` (ISO `YYYY-MM-DD`).
- `PERSONAL`: optional `birthDate` and `nationality`.
- `MEMBER`: required `organization`, `membershipType`, `memberSince`; `memberUntil` is optional and cannot precede `memberSince`.
- `EVENT`: required `eventName`, `role`, `date`, `venue`.
- `FREELANCER`: required `profession`, `specialty`; optional `portfolioUrl` must be an absolute HTTP(S) URL.

Each create/update request accepts `cardType` and a `categoryDetails` object. Common `fullName` and `idNumber` remain required; `photo`, `email`, and `phone` are optional for these categories. IDs remain unique in the shared table. Category fields are stored in `category_details`; `card_type` defaults to `STUDENT`, so existing rows retain their student-card behavior when Hibernate adds the new column. The checked-in `schema.sql` includes the columns for a new installation. Do not drop or recreate an existing database to add them; the configured development `ddl-auto=update` adds the columns in place.

Only Student cards receive institutional QR tokens. Public `/api/verify/{token}` never returns category-specific data and does not mark any additional category as verified. These cards have no verification QR and are labelled unverified in the dashboard preview/print.

Example request body:
```json
{
  "fullName":"Aarav Patil", "idNumber":"DID-2026-0001", "dob":"2005-04-21",
  "department":"Computer Science", "course":"BSc IT", "year":"2nd Year", "semester":"3",
  "email":"aarav@example.com", "phone":"9876543210", "bloodGroup":"O+",
  "address":"Pune, Maharashtra", "photo":"", "status":"Active"
}
```
The `photo` field accepts a string, including a Base64 data URL if the client already uses one. Large photos increase database size; a production deployment should use file/object storage.

## Public QR verification
New Student ID cards receive a random verification token. `GET /api/verify/{token}` is public and returns only the verification status and, for active cards, the student's name, ID, department, course, academic year/semester, and photo. Personal contacts, date of birth, address, and blood group are excluded. `GET /api/verify/{token}/qr.svg` returns a scannable SVG encoding the configured verification page URL. Changing a Student card to another category invalidates its verification token; changing it back to Student issues a new token.

Set `VERIFICATION_BASE_URL` to the externally reachable URL of `verify.html`, without a token. It has no localhost fallback: if unset, card APIs continue to work but return `verificationUrl: null`, and QR image requests return `503 Service Unavailable` rather than generating a device-local link. `GET /api/verify/{token}` returns `200` for a real active or inactive card (`verified` distinguishes the status) and `404` for invalid/unknown tokens. The page displays `Verified — Active`, `Card Inactive`, `Card Not Found`, or `Verification Temporarily Unavailable` based on the API response. For deployment, configure the HTTPS frontend URL before issuing cards. For phone testing on the same Wi-Fi, use the computer's LAN address for `VERIFICATION_BASE_URL`, add `http://<computer-LAN-IP>:5500` to `CORS_ALLOWED_ORIGINS`, start the frontend listener on `0.0.0.0` as described in the frontend README, and ensure port 8080 is reachable from the phone. Replace the example LAN address with the computer's actual address; loopback/localhost URLs only work on the host device.

On local startup, `ddl-auto=update` adds a nullable verification-token column without deleting existing rows or tables. A token is assigned when an existing card is next read through the authenticated card API, and is retained on later edits. For production, apply reviewed schema migrations rather than relying on Hibernate schema update. Never drop or recreate the existing database to add verification support.

## CORS and production
Default CORS origins include localhost development servers. Set `CORS_ALLOWED_ORIGINS` to the exact origin serving the frontend. Do not use wildcard origins with credentials. The session cookie is HttpOnly, uses `Path=/` and `SameSite=Lax`, and is not Secure for local HTTP development. Set `SESSION_COOKIE_SECURE=true` when serving over HTTPS in production. Change default credentials before production deployment. The backend does not create or modify frontend files.
