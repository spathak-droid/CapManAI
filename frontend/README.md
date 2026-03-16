# CapMan AI -- Frontend

Next.js application for the CapMan AI gamified trading education platform.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Animations**: GSAP
- **Auth**: Firebase Authentication
- **Real-time**: WebSocket
- **Testing**: Vitest

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/               # Login and registration
│   ├── badges/             # Badge showcase
│   ├── challenges/         # Real-time challenge matchmaking
│   ├── dashboard/          # Educator dashboard (students, MTSS, messages, content)
│   ├── leaderboard/        # XP leaderboard
│   ├── lessons/            # Interactive lessons with micro-quizzes
│   ├── messages/           # Student messaging
│   ├── peer-review/        # Peer review submissions and reviews
│   ├── scenario/           # AI trading scenario simulations
│   └── about/              # About page
├── components/             # Shared React components
│   ├── skeletons/          # Loading skeleton components
│   └── ui/                 # Base UI primitives
├── contexts/               # React contexts
│   ├── AuthContext.tsx      # Firebase auth state
│   ├── RealtimeContext.tsx  # WebSocket connection
│   └── StudentAnalysisContext.tsx
└── lib/                    # Utilities and services
    ├── api.ts              # API client (fetch wrapper with auth)
    ├── constants.ts        # Shared constants (skills, labels)
    ├── format.ts           # Shared formatting utilities
    ├── hooks.ts            # SWR data-fetching hooks
    ├── types.ts            # TypeScript type definitions
    ├── firebase.ts         # Firebase initialization
    ├── gsap.ts             # GSAP animation hooks
    ├── websocket.ts        # WebSocket client
    └── useRealtimeEvent.ts # Real-time event hook
```

## Setup

```bash
pnpm install
cp .env.example .env.local  # Configure environment variables
pnpm dev
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm tsc --noEmit` | Type check |
| `pnpm test` | Run tests |

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
