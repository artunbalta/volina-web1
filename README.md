# Volina AI - Voice Agent SaaS Platform

<div align="center">
  <h3>🤖 Production-Grade AI Voice Agent Platform</h3>
  <p>Intelligent appointment scheduling, call management, and CRM powered by voice AI</p>
</div>

---

## 🎯 Overview

Volina is a modern SaaS platform that enables businesses across all industries to automate customer interactions through an AI-powered voice agent. The platform handles appointment scheduling, inquiries, and call logging with real-time updates and beautiful analytics.

### Key Features

- **🗣️ Voice AI Integration** - Powered by Vapi.ai for natural conversations
- **📅 Real-time Calendar CRM** - Live appointment updates with Supabase subscriptions
- **📊 Analytics Dashboard** - KPIs, charts, and call insights
- **🔊 Call Transcripts** - Full transcription and audio playback
- **🔐 Real Authentication** - Secure login with Supabase Auth
- **👥 Multi-user Support** - Each user has their own data

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14+ (App Router, TypeScript) |
| Styling | Tailwind CSS, Shadcn/UI, Lucide Icons |
| Database | Supabase (PostgreSQL, Auth, Realtime) |
| Voice AI | Vapi.ai (Web SDK + API) |
| Charts | Recharts |
| Hosting | Vercel (Serverless/Edge) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm, yarn, or pnpm
- Supabase account
- Vapi.ai account (for voice features)

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/volina-web.git
cd volina-web

# Install dependencies
npm install
```

### 2. Supabase Setup

1. Go to [Supabase](https://supabase.com) and create a new project
2. Navigate to **SQL Editor**
3. Run `schema.sql` to create the database tables
4. Go to **Authentication > Users** and create two users:
   - `artunbalta1@gmail.com` (password: `Ardu0307`) - Real user for live data
   - `admin@volina.online` (password: `Volina1313.`) - Demo user with mock data
5. Run `seed.sql` to populate mock data for the admin user

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# ===========================================
# VOLINA AI - Environment Variables
# ===========================================

# Supabase Configuration
# Get these from: Supabase Dashboard > Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Vapi.ai Configuration (optional - for voice calls)
# Get these from: Vapi Dashboard > Settings > API Keys
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your-vapi-public-key
NEXT_PUBLIC_VAPI_ASSISTANT_ID=your-vapi-assistant-id
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Login

Use these credentials:

**Real User (for live VAPI data):**
- Email: `artunbalta1@gmail.com`
- Password: `Ardu0307`

**Demo User (with mock data):**
- Email: `admin@volina.online`
- Password: `Volina1313.`

---

## 📡 Vapi Webhook Setup

To receive call data from your Vapi assistant:

### 1. Set Webhook URL in Vapi

Go to your Vapi assistant settings and set the webhook URL:
```
https://your-domain.com/api/vapi
```

### 2. Link User to Vapi Organization

In Supabase SQL Editor, run:
```sql
UPDATE profiles 
SET vapi_org_id = 'your-vapi-org-id' 
WHERE email = 'artunbalta1@gmail.com';
```

### 3. Configure Vapi Tools

Add these server URLs for your assistant tools:

| Tool | Server URL |
|------|------------|
| check-availability | `https://your-domain.com/api/vapi/tools/check-availability` |
| book-appointment | `https://your-domain.com/api/vapi/tools/book-appointment` |
| cancel-appointment | `https://your-domain.com/api/vapi/tools/cancel-appointment` |

---

## 📁 Project Structure

```
volina-web/
├── app/
│   ├── login/
│   │   └── page.tsx          # Login page
│   ├── (dashboard)/
│   │   └── dashboard/
│   │       ├── layout.tsx
│   │       ├── page.tsx      # Dashboard overview
│   │       ├── calls/
│   │       │   └── page.tsx  # Call logs
│   │       ├── calendar/
│   │       │   └── page.tsx  # Calendar CRM
│   │       └── settings/
│   │           └── page.tsx  # Settings & team management
│   ├── api/
│   │   ├── vapi/
│   │   │   ├── route.ts      # Vapi webhook handler
│   │   │   └── tools/
│   │   │       ├── book-appointment/
│   │   │       ├── cancel-appointment/
│   │   │       └── check-availability/
│   │   └── calls/
│   │       └── route.ts
│   ├── layout.tsx
│   ├── page.tsx              # Landing page
│   └── globals.css
├── components/
│   ├── dashboard/
│   │   ├── Sidebar.tsx
│   │   ├── Calendar.tsx
│   │   ├── CallsTable.tsx
│   │   └── ...
│   ├── providers/
│   │   ├── SupabaseProvider.tsx
│   │   └── ThemeProvider.tsx
│   └── ui/                   # Shadcn/UI components
├── lib/
│   ├── supabase.ts           # Supabase client & queries
│   ├── vapi.ts               # Vapi client
│   ├── types.ts              # TypeScript types
│   └── utils.ts
├── schema.sql                # Database schema
├── seed.sql                  # Demo data for admin user
└── env.example               # Environment variables template
```

---

## 🔒 User Data Isolation

Each user's data is completely isolated:

- **Calls** - Users only see their own call logs
- **Appointments** - Users only see their own appointments
- **Team Members** - Each user manages their own team (doctors/agents)

This is enforced via Row Level Security (RLS) policies in Supabase.

---

## 📦 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel Dashboard
3. Add environment variables (from `.env.local`)
4. Deploy!

### Environment Variables in Vercel

Add all variables to your Vercel project:
- Settings > Environment Variables
- Add each variable for Production, Preview, and Development

---

## 🧪 Development Commands

```bash
# Development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Production build
npm run build

# Start production server
npm run start
```

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Built with ❤️ by the Volina Team</p>
</div>
