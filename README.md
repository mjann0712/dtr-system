# DTR System

Daily Time Record system for HR. It imports the biometric time-clock export, works out each
employee's hours worked, late minutes, undertime and absences, keeps employee records, and
produces the DTR in Excel (HR form F-HR-810-010 layout) and PDF.

| Folder | What it is | Stack |
| --- | --- | --- |
| `api/` | REST API, imports, DTR computation, database | Laravel 11, PHP 8.2+, MySQL 8, Sanctum |
| `web/` | The HR web app | Next.js 15 (App Router), React 19, Tailwind CSS 4, TypeScript |

## Features

- **Login** with administrator and staff accounts (token based, Laravel Sanctum).
- **Import** the raw punch log (`AC-No., Name, Time`), the daily summary (`AC-No., Date, Clock In 1 …`),
  a biometric list (`AC#, NAME, DEPT`) or the employee records file (`EMPLOYEE ID, name, POSITION / DEPARTMENT`).
  Bare `.xls` files saved by biometric devices are supported.
- **DTR computation**: punches are paired by time window (morning, lunch, afternoon); repeat taps are ignored;
  late, undertime, half days and absences follow the schedule, grace period, work days and holidays set by HR.
- **Dashboard, attendance summary and DTR sheet** per employee, filtered by period, date range,
  institution, department or employee.
- **Employee records**: add, edit, delete, mark Active/Inactive (one or many), link biometric AC-Nos
  (automatic name matching, with suggestions for HR to confirm).
- **Saved periods**: every imported month is stored and can be reopened or replaced.
- **Reports**: DTR workbook (Excel, one sheet per department), DTR per employee (PDF with signature lines),
  attendance summary (PDF).

Government ID numbers, birthdates, addresses and emergency contacts in the HR file are **not** imported;
the DTR does not need them.

## Requirements

- PHP 8.2 or newer with `pdo_mysql`, `mbstring`, `intl`, `zip`, `gd`, `xml` (XAMPP, Laragon or Herd include these)
- Composer 2
- MySQL 8 (or MariaDB 10.6+)
- Node.js 20 or newer

## Setup

### 1. Database

Create an empty database, for example in phpMyAdmin or the MySQL shell:

```sql
CREATE DATABASE dtr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. API (Laravel)

```bash
cd api
composer install
cp .env.example .env          # Windows: copy .env.example .env
php artisan key:generate
```

Open `api/.env` and check:

```env
DB_DATABASE=dtr
DB_USERNAME=root
DB_PASSWORD=
FRONTEND_URL=http://localhost:3000,http://127.0.0.1:3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeMe123!
```

Then create the tables and the first administrator, and start the API:

```bash
php artisan migrate --seed
php artisan serve             # http://localhost:8000
```

### 3. Web app (Next.js)

```bash
cd web
npm install
cp .env.local.example .env.local   # Windows: copy .env.local.example .env.local
npm run dev                         # http://localhost:3000
```

`web/.env.local` points the app at the API:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Open http://localhost:3000, click **Open the system** and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
Change that password, or add your own administrator under **User accounts** and remove the default one.

### 4. First import

1. **Employee records → Import employee file**: upload the HR employee workbook once.
2. **DTR periods → Upload**: upload a month's biometric export. If you have the older workbook with an
   `Employees` sheet (AC#, NAME, DEPT), upload it once too; it links AC-Nos to records and sets departments.
3. Check **Employee records → Biometric IDs not linked to a record** and link the remaining people.
4. Set holidays and schedules in **Rules & schedules**.

## API overview

All routes are under `/api` and, except `POST /login`, need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/login` · `/logout` · GET `/me` | Sign in / out, current user |
| GET, PUT | `/settings` | Schedules, holidays, rules, form details |
| GET, POST | `/employees` | List (filters `q`, `show`, `department`) / create |
| PUT, DELETE | `/employees/{id}` | Update / delete a record |
| POST | `/employees/status` | `{ids: [...], status: "Active" \| "Inactive"}` |
| GET | `/biometric/unlinked` | AC-Nos without a record, with suggested matches |
| POST | `/biometric/link` | `{links: [{ac_no, employee_id}]}` |
| POST | `/biometric/{acNo}/ignore` | Hide an AC-No. that is not an employee |
| POST | `/import` | `files[]` (xls, xlsx, csv), `replace=1` to overwrite a saved month (409 otherwise) |
| GET | `/periods` · `/periods/{YYYY-MM}/dtr?from=&to=` | Saved months · computed DTR |
| DELETE | `/periods/{YYYY-MM}` | Delete a saved month |
| GET, POST, DELETE | `/users` | User accounts (administrators only) |

The DTR rules live in `api/app/Services/Dtr/DtrCalculator.php`; the readers for each file layout are in the
same folder.

## Production notes

- Set `APP_ENV=production`, `APP_DEBUG=false` and a real `APP_URL` in `api/.env`.
- Build the web app with `npm run build` and run it with `npm start`, or deploy it to Vercel with
  `NEXT_PUBLIC_API_URL` set to the API's public address. Add that web address to `FRONTEND_URL`.
- Serve the API through Apache or Nginx with `api/public` as the web root, over HTTPS.
- Back up the MySQL database regularly; it holds employee records and every imported month.
