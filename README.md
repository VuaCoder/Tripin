# TRIPRI - TOUR PLATFORM

## Project Overview
TRIPRI is an online tour booking platform. 

## Current Features
- Authentication & Account
- Tour Discovery
- Wishlist
- Booking
- Payment
- E-ticket
- Reviews
- Conversation / Chat
- AI Chat
- Agency Operations
- Tour Guide Operations
- Moderation
- Super Admin
- Promotions
- Earnings
- Reports
- Support

## Technology Stack
Frontend:
- Next.js
- TypeScript
- Tailwind CSS
- Redux Toolkit
- RTK Query
- Socket.IO Client

Backend:
- Express
- TypeScript
- Layered MVC
- Socket.IO

Database:
- PostgreSQL
- Prisma

Authentication:
- JWT
- Access Token + Refresh Token
- Google OAuth
- Email OTP
- 2FA

Payment:
- PayOS

Package Manager:
- pnpm

## Actors
- Guest (unauthenticated)
- Traveler
- Agency
- Tour Guide
- Moderator (no public registration)
- Super Admin (no public registration)
- Email OTP Service
- Google OAuth System
- Payment Gateway
- AI Agent

## Repository Structure
```
TRIPRI/
├── frontend/
├── backend/
├── packages/
├── prisma/
└── docs/
```

## Prerequisites
- Git
- Node.js
- pnpm
- PostgreSQL / PostgreSQL-compatible database

## Clone
```sh
git clone REPOSITORY_URL
cd TRIPRI
```

## Install
```sh
pnpm install
```

## Environment Setup
```sh
cp .env.example .env
```
Ensure you provide `DATABASE_URL` (PostgreSQL) and other corresponding environment variables.

## Run Frontend
```sh
pnpm --filter frontend dev
```
Default expected URL: http://localhost:3000

## Run Backend
```sh
pnpm --filter backend dev
```
The backend API server typically runs on the configured port in the environment setup.

## Database
Uses PostgreSQL + Prisma. Database migrations will be introduced when business schemas are implemented.

## Git Workflow
Use feature branches and standard commit conventions.

## Development Status
Repository foundation only. Business features are implemented incrementally.
