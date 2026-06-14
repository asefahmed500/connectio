# 📋 ClientConnect Portal: Complete PRD + System Design

**Tech Stack:** Next.js (API Routes) | Prisma ORM | PostgreSQL | TypeScript | Tailwind CSS  
**Status:** Production Ready  
**Last Updated:** June 2026

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [User Roles & RBAC](#user-roles--rbac)
3. [System Architecture](#system-architecture)
4. [Database Schema](#database-schema)
5. [API Routes Design](#api-routes-design)
6. [Authentication & Security](#authentication--security)
7. [Project Structure](#project-structure)
8. [Setup & Installation](#setup--installation)
9. [Deployment Guide](#deployment-guide)
10. [Development Roadmap](#development-roadmap)

---

## Product Overview

**ClientConnect Portal** is a secure, multi-tenant web application designed to streamline post-meeting client communication and requirement gathering. After a meeting, the Admin generates a unique, personalized invite link for the client. The client uses this link to:

- Create a secure account
- Access a personalized dashboard
- Submit detailed project requirements
- Upload content/attachments
- View direct feedback and comments from the Admin/Team

### Key Features

✅ **Unique Invite Links** - One-time registration links with slug-based URLs  
✅ **Role-Based Access Control** - Super Admin, Team Member, Client roles  
✅ **Dynamic Requirement Forms** - Flexible form builder for different project types  
✅ **Real-Time Comments** - Threaded feedback system with internal/external comments  
✅ **Document Upload** - Secure file handling with S3/local storage  
✅ **Analytics Dashboard** - Visual data on submissions, status, team performance  
✅ **Email Notifications** - Invite links, form submissions, comment replies  

---

## User Roles & RBAC

### 1. **Super Admin (You)**

**Permissions:**
- Generate unique client invite links
- View all clients and their data
- Access global analytics dashboard
- Manage team members and their assignments
- Post internal and external comments
- Export client data
- Configure system settings

**Access Routes:**
```
/admin/dashboard
/admin/clients
/admin/clients/[id]
/admin/team
/admin/settings
/api/admin/*
```

---

### 2. **Team Member**

**Permissions:**
- View assigned clients only
- Submit forms on behalf of clients
- Post internal and external comments
- View client submissions and documents
- Cannot generate invite links
- Cannot access global analytics

**Access Routes:**
```
/team/dashboard
/team/clients
/team/clients/[id]
/api/team/*
```

---

### 3. **Client (Visitor)**

**Permissions:**
- Access dashboard via unique invite link only
- Fill out requirement forms
- Upload documents
- View comments from Admin/Team
- Cannot see other clients' data
- Cannot access admin features

**Access Routes:**
```
/dashboard/visitor/[slug]
/dashboard/visitor/[slug]/forms
/dashboard/visitor/[slug]/submissions
/api/client/*
```

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐   ┌──────────────────┐  ┌──────────────┐ │
│  │  Admin Panel     │   │  Client Portal   │  │ Team Portal  │ │
│  │  (React/Next)    │   │  (React/Next)    │  │ (React/Next) │ │
│  └──────────────────┘   └──────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ⬇️
┌─────────────────────────────────────────────────────────────────┐
│              NEXT.JS SERVER (API ROUTES + SSR)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Routes: /pages/api/                                │  │
│  │  ├── auth/                 (login, register, logout)    │  │
│  │  ├── admin/                (clients, analytics)         │  │
│  │  ├── team/                 (assignments, forms)         │  │
│  │  ├── client/               (submissions, comments)      │  │
│  │  ├── comments/             (CRUD operations)            │  │
│  │  └── uploads/              (file handling)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Middleware & Utilities                                 │  │
│  │  ├── auth.ts               (JWT verification)           │  │
│  │  ├── rbac.ts               (role checking)              │  │
│  │  ├── errors.ts             (error handling)             │  │
│  │  └── validators.ts         (input validation)           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Prisma Client (ORM Layer)                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ⬇️
┌─────────────────────────────────────────────────────────────────┐
│              DATABASE LAYER (POSTGRESQL)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Users      │  │   Clients    │  │ Submissions  │          │
│  │   (auth)     │  │   (meta)     │  │  (forms)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Comments    │  │    Forms     │  │   Files      │          │
│  │  (feedback)  │  │  (templates) │  │  (storage)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │ TeamMembers  │  │Submissions   │                            │
│  │ (assignments)│  │ (tracking)   │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                              ⬇️
┌─────────────────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Email Service│  │ S3 / Storage │  │  Analytics   │          │
│  │ (Nodemailer) │  │  (optional)  │  │  (optional)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architecture Decisions

| Decision | Reason |
|----------|--------|
| **Next.js API Routes** | Built-in, no separate backend needed; supports middleware; great for small-medium projects |
| **Prisma ORM** | Type-safe, excellent DX, auto-migrations, great for PostgreSQL |
| **PostgreSQL** | ACID-compliant, excellent for relational data (users, roles, submissions) |
| **JWT + HttpOnly Cookies** | Stateless auth, secure against XSS attacks |
| **Middleware-based RBAC** | Centralized permission checking before reaching route handlers |

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────┐         ┌────────────────┐
│   Users     │         │   Clients    │         │  TeamMembers   │
├─────────────┤         ├──────────────┤         ├────────────────┤
│ id (PK)     │◄────────│ user_id (FK) │         │ user_id (FK)   │
│ email       │         │ id (PK)      │         │ id (PK)        │
│ password    │         │ company_name │         │ role           │
│ role        │         │ unique_slug  │         │ created_at     │
│ created_at  │         │ contact_name │         │                │
└─────────────┘         │ created_at   │         └────────────────┘
                        └──────────────┘
                               │
                               │ 1:N
                               ⬇️
                        ┌──────────────┐
                        │ Submissions  │
                        ├──────────────┤
                        │ id (PK)      │
                        │ client_id(FK)│
                        │ form_id (FK) │
                        │ form_data    │
                        │ status       │
                        │ created_at   │
                        │ updated_at   │
                        └──────────────┘
                               │
                               │ 1:N
                               ⬇️
                        ┌──────────────┐
                        │   Files      │
                        ├──────────────┤
                        │ id (PK)      │
                        │ submit_id(FK)│
                        │ file_name    │
                        │ file_path    │
                        │ file_type    │
                        │ file_size    │
                        │ uploaded_at  │
                        └──────────────┘

        ┌──────────────────────────────┐
        │       Forms                  │
        ├──────────────────────────────┤
        │ id (PK)                      │
        │ title                        │
        │ description                  │
        │ form_schema (JSONB)          │
        │ is_active                    │
        │ created_at                   │
        └──────────────────────────────┘

        ┌──────────────────────────────┐
        │       Comments               │
        ├──────────────────────────────┤
        │ id (PK)                      │
        │ client_id (FK)               │
        │ author_id (FK to Users)      │
        │ submission_id (FK, optional) │
        │ message                      │
        │ is_internal                  │
        │ parent_id (FK, for replies)  │
        │ created_at                   │
        └──────────────────────────────┘
```

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER & AUTHENTICATION
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  role          UserRole
  
  // Relations
  client        Client?
  teamMember    TeamMember?
  commentsAuthor Comment[] @relation("author")
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([email])
  @@index([role])
}

enum UserRole {
  SUPER_ADMIN
  TEAM_MEMBER
  CLIENT
}

// ============================================
// CLIENTS
// ============================================

model Client {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  companyName     String
  contactName     String
  uniqueSlug      String    @unique
  
  // Business Info
  projectBrief    String?
  budget          String?
  timeline        String?
  
  // Relations
  submissions     Submission[]
  comments        Comment[]
  teamAssignments TeamMember[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([uniqueSlug])
  @@index([userId])
}

// ============================================
// TEAM MEMBERS
// ============================================

model TeamMember {
  id          String    @id @default(cuid())
  userId      String    @unique
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  department  String?
  assignedClients Client[]
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

// ============================================
// FORMS & SUBMISSIONS
// ============================================

model Form {
  id            String      @id @default(cuid())
  title         String
  description   String?
  
  // JSON schema for dynamic form fields
  // Example: { fields: [{ name: "projectName", type: "text", required: true }, ...] }
  formSchema    Json
  
  isActive      Boolean     @default(true)
  submissions   Submission[]
  
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([isActive])
}

enum SubmissionStatus {
  DRAFT
  SUBMITTED
  IN_REVIEW
  APPROVED
  REJECTED
}

model Submission {
  id          String            @id @default(cuid())
  clientId    String
  client      Client            @relation(fields: [clientId], references: [id], onDelete: Cascade)
  
  formId      String
  form        Form              @relation(fields: [formId], references: [id])
  
  formData    Json              // Stores filled form data
  status      SubmissionStatus  @default(DRAFT)
  
  files       File[]
  comments    Comment[]
  
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@unique([clientId, formId])
  @@index([clientId])
  @@index([status])
}

// ============================================
// FILES & ATTACHMENTS
// ============================================

model File {
  id            String      @id @default(cuid())
  submissionId  String
  submission    Submission  @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  
  fileName      String
  originalName  String
  filePath      String      // S3 key or local path
  fileType      String
  fileSize      Int         // In bytes
  
  uploadedAt    DateTime    @default(now())

  @@index([submissionId])
}

// ============================================
// COMMENTS & FEEDBACK
// ============================================

model Comment {
  id            String      @id @default(cuid())
  clientId      String
  client        Client      @relation(fields: [clientId], references: [id], onDelete: Cascade)
  
  authorId      String
  author        User        @relation("author", fields: [authorId], references: [id])
  
  submissionId  String?
  submission    Submission? @relation(fields: [submissionId], references: [id], onDelete: SetNull)
  
  message       String
  
  // For threaded replies
  parentId      String?
  parent        Comment?    @relation("replies", fields: [parentId], references: [id], onDelete: Cascade)
  replies       Comment[]   @relation("replies")
  
  // Visibility control
  isInternal    Boolean     @default(false) // If true, hidden from client
  
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([clientId])
  @@index([authorId])
  @@index([submissionId])
}

// ============================================
// AUDIT LOG (Optional but Recommended)
// ============================================

model AuditLog {
  id        String    @id @default(cuid())
  userId    String
  action    String    // "VIEWED", "CREATED", "UPDATED", "DELETED", etc.
  resource  String    // "Client", "Submission", "Comment", etc.
  resourceId String
  changes   Json?     // Store what was changed
  
  createdAt DateTime  @default(now())

  @@index([userId])
  @@index([resource])
  @@index([createdAt])
}
```

---

## API Routes Design

### File Structure

```
pages/
├── api/
│   ├── auth/
│   │   ├── login.ts
│   │   ├── register.ts
│   │   ├── logout.ts
│   │   ├── refresh.ts
│   │   └── verify.ts
│   │
│   ├── admin/
│   │   ├── dashboard.ts          // GET analytics & stats
│   │   ├── clients/
│   │   │   ├── index.ts          // GET all clients, POST create
│   │   │   ├── [id].ts           // GET, PUT, DELETE single client
│   │   │   └── [id]/submissions.ts // GET client submissions
│   │   ├── invite.ts             // POST generate invite link
│   │   ├── team/
│   │   │   ├── index.ts
│   │   │   └── [id].ts
│   │   └── settings.ts
│   │
│   ├── team/
│   │   ├── dashboard.ts
│   │   ├── clients.ts
│   │   └── assignments.ts
│   │
│   ├── client/
│   │   ├── profile.ts
│   │   ├── submissions.ts
│   │   ├── forms.ts
│   │   └── files/
│   │       ├── upload.ts         // POST file upload
│   │       └── [id].ts           // GET, DELETE file
│   │
│   ├── comments/
│   │   ├── index.ts              // POST new comment
│   │   ├── [id].ts               // GET, PUT, DELETE
│   │   └── [id]/replies.ts       // GET replies, POST reply
│   │
│   └── health.ts                  // GET health check
│
├── middleware/
│   ├── auth.ts                   // JWT verification
│   ├── rbac.ts                   // Role-based access
│   └── errorHandler.ts           // Error handling
│
└── lib/
    ├── prisma.ts                 // Prisma client singleton
    ├── jwt.ts                    // JWT utilities
    ├── validators.ts             // Input validation
    ├── mailer.ts                 // Email service
    └── upload.ts                 // File upload handler
```

### Core API Endpoints

#### **Authentication Endpoints**

```typescript
// POST /api/auth/login
Request:
{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response:
{
  "success": true,
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "role": "SUPER_ADMIN"
  }
}
// Sets HttpOnly cookie: Authorization=<jwt_token>
```

```typescript
// POST /api/auth/register
Request (via invite link):
{
  "slug": "asefahmed",
  "email": "asef@example.com",
  "password": "securePassword123"
}

Response:
{
  "success": true,
  "message": "Registration successful"
}
```

---

#### **Admin Endpoints**

```typescript
// GET /api/admin/dashboard
Headers: Authorization: Bearer <jwt_token>

Response:
{
  "stats": {
    "totalClients": 45,
    "totalSubmissions": 120,
    "pendingReview": 8,
    "clientsThisMonth": 12
  },
  "submissionsByStatus": {
    "DRAFT": 10,
    "SUBMITTED": 5,
    "APPROVED": 8
  },
  "recentActivity": [...]
}
```

```typescript
// GET /api/admin/clients?page=1&limit=20
Response:
{
  "success": true,
  "data": [
    {
      "id": "client123",
      "companyName": "Acme Corp",
      "contactName": "John Doe",
      "uniqueSlug": "johndoe",
      "submissions": 5,
      "lastSubmission": "2026-06-10T14:23:00Z",
      "status": "ACTIVE"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

```typescript
// GET /api/admin/clients/[id]
Response:
{
  "client": {
    "id": "client123",
    "companyName": "Acme Corp",
    "contactName": "John Doe",
    "uniqueSlug": "johndoe",
    "projectBrief": "...",
    "budget": "$50k",
    "timeline": "3 months",
    "submissions": [...],
    "comments": [...],
    "files": [...]
  }
}
```

```typescript
// POST /api/admin/invite
Request:
{
  "email": "client@example.com",
  "companyName": "Client Corp",
  "contactName": "Jane Smith"
}

Response:
{
  "success": true,
  "inviteLink": "https://clientconnect.com/invite/janesmith",
  "slug": "janesmith"
}
// Email sent to client@example.com with invite link
```

---

#### **Client Endpoints**

```typescript
// GET /api/client/profile
Headers: Authorization: Bearer <jwt_token> (Client token only)

Response:
{
  "client": {
    "id": "client123",
    "slug": "johndoe",
    "companyName": "Acme Corp",
    "submissions": [...]
  }
}
```

```typescript
// GET /api/client/forms
Response:
{
  "forms": [
    {
      "id": "form1",
      "title": "Project Requirements",
      "description": "Initial project brief",
      "formSchema": {...}
    },
    {
      "id": "form2",
      "title": "Design Preferences",
      ...
    }
  ]
}
```

```typescript
// POST /api/client/submissions
Request:
{
  "formId": "form1",
  "formData": {
    "projectName": "Website Redesign",
    "budget": "$25k",
    "timeline": "2 months",
    "targetAudience": "US-based e-commerce buyers"
  }
}

Response:
{
  "success": true,
  "submission": {
    "id": "submission123",
    "status": "SUBMITTED",
    "createdAt": "2026-06-14T10:30:00Z"
  }
}
```

```typescript
// POST /api/client/files/upload
Request: FormData with file
- field: "file"
- field: "submissionId"

Response:
{
  "success": true,
  "file": {
    "id": "file123",
    "fileName": "screenshot.png",
    "fileType": "image/png",
    "fileSize": 2048576,
    "uploadedAt": "2026-06-14T10:35:00Z"
  }
}
```

---

#### **Comments Endpoints**

```typescript
// GET /api/comments?clientId=client123
Response:
{
  "comments": [
    {
      "id": "comment1",
      "author": {
        "id": "user456",
        "email": "admin@example.com"
      },
      "message": "Great submission! A few questions...",
      "isInternal": false,
      "createdAt": "2026-06-14T09:00:00Z",
      "replies": [
        {
          "id": "comment2",
          "author": {...},
          "message": "Reply to the comment",
          "createdAt": "2026-06-14T09:15:00Z"
        }
      ]
    }
  ]
}
```

```typescript
// POST /api/comments
Request:
{
  "clientId": "client123",
  "submissionId": "submission123",
  "message": "Excellent work! Please revise the color scheme.",
  "isInternal": false
}

Response:
{
  "success": true,
  "comment": {
    "id": "comment123",
    "createdAt": "2026-06-14T10:00:00Z"
  }
}
// Email notification sent to client if isInternal = false
```

---

### Implementation Example: Auth Middleware

```typescript
// lib/middleware/auth.ts

import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;
    email: string;
    role: 'SUPER_ADMIN' | 'TEAM_MEMBER' | 'CLIENT';
  };
}

export function withAuth(handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    try {
      const token = req.cookies.Authorization;
      
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        id: string;
        email: string;
        role: string;
      };

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role as any,
      };

      return handler(req, res);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

export function withRole(...roles: string[]) {
  return (handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) => {
    return withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return handler(req, res);
    });
  };
}
```

---

### Implementation Example: Admin Dashboard API

```typescript
// pages/api/admin/dashboard.ts

import { NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { withRole } from '@/lib/middleware/auth';
import { AuthenticatedRequest } from '@/lib/middleware/auth';

const handler = withRole('SUPER_ADMIN')(
  async (req: AuthenticatedRequest, res: NextApiResponse) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const [
        totalClients,
        totalSubmissions,
        submissionsByStatus,
        recentActivity,
        clientsThisMonth,
      ] = await Promise.all([
        prisma.client.count(),
        
        prisma.submission.count(),
        
        prisma.submission.groupBy({
          by: ['status'],
          _count: true,
        }),
        
        prisma.submission.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            client: { select: { companyName: true } },
          },
        }),
        
        prisma.client.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            },
          },
        }),
      ]);

      const statusCounts = submissionsByStatus.reduce(
        (acc, item) => ({
          ...acc,
          [item.status]: item._count,
        }),
        {}
      );

      return res.status(200).json({
        success: true,
        stats: {
          totalClients,
          totalSubmissions,
          pendingReview: statusCounts.IN_REVIEW || 0,
          clientsThisMonth,
        },
        submissionsByStatus: statusCounts,
        recentActivity: recentActivity.map((submission) => ({
          id: submission.id,
          client: submission.client.companyName,
          status: submission.status,
          submittedAt: submission.createdAt,
        })),
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default handler;
```

---

## Authentication & Security

### JWT Token Structure

```typescript
// Payload
{
  "id": "user123",
  "email": "user@example.com",
  "role": "SUPER_ADMIN",
  "iat": 1686052800,
  "exp": 1686139200  // 24 hours
}

// Headers: HttpOnly, Secure, SameSite=Strict
// Expiry: 24 hours (refresh token: 7 days)
```

### Login Flow

```
1. User submits email + password
   ↓
2. Backend queries User by email
   ↓
3. Compare password hash with bcrypt
   ↓
4. If valid:
   - Generate JWT token (24h expiry)
   - Set HttpOnly cookie: Authorization=<token>
   - Generate refresh token (7d expiry)
   - Set HttpOnly cookie: refresh_token=<token>
   ↓
5. Return user data (without password)
```

### Password Hashing

```typescript
// lib/auth.ts

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(
  payload: { id: string; email: string; role: string },
  expiresIn = '24h'
): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: '7d',
  });
}
```

### Data Isolation (Critical Security)

```typescript
// pages/api/client/profile.ts

import { NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { withRole, AuthenticatedRequest } from '@/lib/middleware/auth';

const handler = withRole('CLIENT')(
  async (req: AuthenticatedRequest, res: NextApiResponse) => {
    try {
      // 1. Fetch the user to get their slug
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: { client: true },
      });

      if (!user?.client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // 2. Only return this client's data - NO OTHER CLIENT CAN ACCESS THIS
      const client = await prisma.client.findUnique({
        where: { id: user.client.id },
        include: {
          submissions: {
            include: { files: true, comments: true },
          },
          comments: true,
        },
      });

      return res.status(200).json({ success: true, client });
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default handler;
```

---

## Project Structure

```
clientconnect/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── pages/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.ts
│   │   │   ├── register.ts
│   │   │   └── logout.ts
│   │   ├── admin/
│   │   │   ├── dashboard.ts
│   │   │   ├── clients/
│   │   │   │   ├── index.ts
│   │   │   │   ├── [id].ts
│   │   │   │   └── [id]/submissions.ts
│   │   │   ├── invite.ts
│   │   │   └── team/
│   │   ├── team/
│   │   │   ├── dashboard.ts
│   │   │   └── clients.ts
│   │   ├── client/
│   │   │   ├── profile.ts
│   │   │   ├── submissions.ts
│   │   │   ├── forms.ts
│   │   │   └── files/
│   │   ├── comments/
│   │   │   ├── index.ts
│   │   │   └── [id].ts
│   │   └── health.ts
│   │
│   ├── admin/
│   │   ├── dashboard.tsx
│   │   ├── clients/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx
│   │   └── team.tsx
│   │
│   ├── team/
│   │   ├── dashboard.tsx
│   │   └── clients.tsx
│   │
│   ├── dashboard/
│   │   └── visitor/
│   │       └── [slug].tsx
│   │
│   ├── invite/
│   │   └── [slug].tsx
│   │
│   ├── login.tsx
│   ├── _app.tsx
│   ├── _document.tsx
│   └── index.tsx
│
├── components/
│   ├── Admin/
│   │   ├── Dashboard.tsx
│   │   ├── ClientList.tsx
│   │   └── ClientDetail.tsx
│   ├── Team/
│   │   └── Dashboard.tsx
│   ├── Client/
│   │   ├── Dashboard.tsx
│   │   ├── FormBuilder.tsx
│   │   └── SubmissionForm.tsx
│   ├── Shared/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Layout.tsx
│   │   ├── ProtectedRoute.tsx
│   │   └── Comments.tsx
│   └── Charts/
│       ├── SubmissionStatus.tsx
│       └── ClientGrowth.tsx
│
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   ├── jwt.ts
│   ├── validators.ts
│   ├── mailer.ts
│   ├── upload.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── rbac.ts
│   └── types.ts
│
├── styles/
│   ├── globals.css
│   └── variables.css
│
├── .env.example
├── .env.local (not in git)
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## Setup & Installation

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### Step 1: Clone & Install Dependencies

```bash
git clone https://github.com/yourusername/clientconnect.git
cd clientconnect

npm install
# or
yarn install
```

### Step 2: Environment Setup

```bash
# Copy example env
cp .env.example .env.local

# Edit .env.local with your values
```

**.env.local:**

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/clientconnect"

# JWT
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-key-min-32-chars"

# Email (Nodemailer)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@clientconnect.com"

# File Upload (Optional - for S3)
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
AWS_S3_BUCKET="your-bucket-name"
AWS_S3_REGION="us-east-1"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### Step 3: Database Setup

```bash
# Create PostgreSQL database
createdb clientconnect

# Run Prisma migrations
npx prisma migrate dev --name init

# Optional: Seed database with sample data
npx prisma db seed
```

### Step 4: Generate Prisma Client

```bash
npx prisma generate
```

### Step 5: Run Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment Guide

### Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

**Configure Environment Variables in Vercel Dashboard:**
- Go to Settings → Environment Variables
- Add all variables from .env.local

**Database on Vercel:**
Use [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com) for managed PostgreSQL:

```env
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/dbname?sslmode=require"
```

### Docker Deployment

**Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: clientconnect
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: clientconnect
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    environment:
      DATABASE_URL: "postgresql://clientconnect:secure_password@postgres:5432/clientconnect"
      JWT_SECRET: "your-secret"
      JWT_REFRESH_SECRET: "your-refresh-secret"
    ports:
      - "3000:3000"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

**Deploy:**

```bash
docker-compose up -d
```

### Railway / Render / Fly.io

These platforms provide one-click PostgreSQL + Next.js deployment:

1. Push code to GitHub
2. Connect repository
3. Set environment variables
4. Deploy

---

## Development Roadmap

### Phase 1: MVP (Weeks 1-4)
- [x] Database schema & Prisma setup
- [x] Auth system (login, register, JWT)
- [x] Admin dashboard
- [ ] Client dashboard
- [ ] Invite link generation
- [ ] Basic form submissions
- [ ] Comments system

### Phase 2: Enhancement (Weeks 5-8)
- [ ] File upload (S3 or local)
- [ ] Email notifications
- [ ] Advanced form builder
- [ ] Analytics charts
- [ ] Team member management
- [ ] Audit logging

### Phase 3: Scale (Weeks 9+)
- [ ] Real-time updates (WebSocket)
- [ ] Advanced search & filtering
- [ ] Data export (CSV, PDF)
- [ ] Mobile app (React Native)
- [ ] AI-powered form suggestions
- [ ] Integrations (Slack, Zapier, etc.)

---

## Testing

### Unit Tests

```bash
npm run test
```

### E2E Tests

```bash
npm run test:e2e
```

### Database Tests

```bash
# Reset test database
npm run test:db:reset

# Run tests
npm run test:db
```

---

## Troubleshooting

### Common Issues

**Issue:** `ENOENT: no such file or directory, open '.prisma/client'`

**Solution:**
```bash
npx prisma generate
```

**Issue:** Database connection refused

**Solution:**
```bash
# Check PostgreSQL is running
sudo service postgresql start

# Verify connection string in .env.local
psql -U user -d clientconnect -h localhost
```

**Issue:** JWT token invalid

**Solution:**
```bash
# Clear cookies in browser
# OR reset JWT_SECRET in .env.local and restart server
```

---

## Support & Contributing

- 📧 Email: support@clientconnect.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/clientconnect/issues)
- 📚 Docs: [Full Documentation](https://docs.clientconnect.com)

---

## License

MIT License - See LICENSE.md

---

**Last Updated:** June 14, 2026  
**Version:** 1.0.0  
**Maintained By:** Asef Ahmed