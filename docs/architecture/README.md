# Architecture

## Overview
- Monorepo structure separating `frontend/`, `backend/`, and `packages/`.
- Frontend: Next.js + Redux Toolkit + RTK Query for API states + Socket.IO client.
- Backend: Express + TypeScript based on Layered MVC architecture.
- Domain-first backend organization.
- Database: PostgreSQL, accessed via Prisma ORM.
- Real-time: Socket.IO for chat and notifications.
- Authentication: JWT access/refresh architecture.

## Frontend / Backend separation
Frontend and Backend are strictly separated applications.

## Layered MVC
The backend enforces Layered MVC. Requests traverse through: Controller -> Service -> Repository -> Prisma ORM -> PostgreSQL.

## Domain-first Organization
Backend modules are grouped by domains (e.g., Auth, Tours, Wishlist, Bookings), keeping responsibilities isolated.
