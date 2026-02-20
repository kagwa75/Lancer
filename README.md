# Lancer (FreelanceHub)

Lancer is a cross-platform freelance marketplace built with Expo and React Native. It supports client and freelancer roles, project posting and bidding, in-app chat, notifications, and escrow-style payments using Stripe and M-Pesa.

Last generated: 2026-02-18

## Quick Start

1. Install dependencies

```bash
npm install
```

2. Start the dev server

```bash
npm run start
```

3. Platform targets

```bash
npm run ios
npm run android
npm run web
```

## Scripts

- `npm run start`: Start the Expo dev server
- `npm run ios`: Run on iOS simulator/device
- `npm run android`: Run on Android emulator/device
- `npm run web`: Run the web build in dev mode
- `npm run lint`: Lint the project
- `npm run reset-project`: Reset to a blank Expo project scaffold

## Configuration and Secrets

This repo currently contains hardcoded keys and tokens. Move secrets into environment variables for production.

### Expo config

- `app.json`
  - `expo.extra.stripePublishableKey`
  - Sentry project/org and DSN (via `app/_layout.jsx`)
  - PostHog key (via `app/_layout.jsx`)

### Environment files

- `.env.local` includes `SENTRY_AUTH_TOKEN` for local builds
- `eas.json` includes `SENTRY_AUTH_TOKEN` for EAS build profiles

### Hardcoded values to review

- `lib/Client.js`: Supabase URL and publishable key
- `constants/index.js`: Supabase URL/key and a Stripe secret key
- `lib/api.js`: Stripe backend base URL
- `lib/apiMpesa.js`: M-Pesa backend base URL
- `app/mpesa-payment.jsx`: M-Pesa endpoints embedded directly

## Architecture Overview

- `app/_layout.jsx` wires up global providers
  - Sentry (error + performance)
  - React Query
  - PostHog
  - AuthProvider
  - ThemeProvider
  - StripeProvider (native only; web uses a mock)
- Auth flow lives in `hooks/useAuth.jsx` and Supabase `auth` tables
- Role-based routing sends users to client tabs `(tab)` or freelancer tabs `(ftab)`
- Data layer uses Supabase JS client in `lib/Client.js`

## Routing (Expo Router)

Route groups in parentheses do not appear in the URL. They are included here for clarity.

### Root

- `app/index.jsx`: Redirects to `/(auth)/Welcome`
- `app/_layout.jsx`: Global providers + auth/role routing
- `app/(root)/layout.jsx`: Slot wrapper

### Auth

- `app/(auth)/Welcome.jsx`: Marketing/landing screen
- `app/(auth)/login.jsx`: Sign-in and sign-up (Google + email/password)
- `app/(auth)/signUp.jsx`: Placeholder screen
- `app/(auth)/selectRole.jsx`: Choose client or freelancer role
- `app/(auth)/settings.jsx`: User settings, notifications, and role switching

### Client tabs

- `app/(root)/(tab)/home.jsx`: Client dashboard and analytics
- `app/(root)/(tab)/projects.jsx`: Client project list and status filtering
- `app/(root)/(tab)/conversations.jsx`: Client conversation list
- `app/(root)/(tab)/profile.jsx`: Client company profile and billing details
- `app/(root)/(tab)/_layout.jsx`: Tab bar configuration for client

### Freelancer tabs

- `app/(root)/(ftab)/home.jsx`: Freelancer dashboard and stats
- `app/(root)/(ftab)/jobs.jsx`: Find open projects
- `app/(root)/(ftab)/proposals.jsx`: View proposals and status
- `app/(root)/(ftab)/conversations.jsx`: Freelancer conversation list
- `app/(root)/(ftab)/_layout.jsx`: Tab bar configuration for freelancer

### Other screens

- `app/(Details)/NewProject.jsx`: Create new project
- `app/(Details)/[id].jsx`: Project details with payment and escrow actions
- `app/(description)/[id].jsx`: Project details view (freelancer-facing)
- `app/(Details)/fprofile.jsx`: Freelancer profile/reviews view
- `app/(EditProfile)/[id].jsx`: Edit profile screen
- `app/(chats)/[id].jsx`: Chat thread
- `app/(root)/freelancers.jsx`: Browse freelancers
- `app/(root)/freelancer/[id].jsx`: Freelancer details
- `app/(root)/notifications.jsx`: Notifications feed
- `app/mpesa-payment.jsx`: M-Pesa STK push payment flow

## Data Model (Supabase)

Tables referenced in the app:

- `profiles`: User profile info
- `user_roles`: User role (client or freelancer)
- `user_settings`: Notification and theme preferences
- `client_profiles`: Client company details
- `freelancer_profiles`: Freelancer profile data
- `projects`: Project listings
- `project_categories`: Project category list
- `bids`: Freelancer bids/proposals
- `transactions`: Payment/escrow records
- `notifications`: In-app notifications
- `chats`: Message threads
- `project_reviews`: Ratings and reviews
- `platform_settings`: Platform config (commission rate)
- `user_feedback`: Feedback submissions

## API Integrations

### Stripe backend (Railway)

Base URL: `https://lancerstripe-production.up.railway.app`

Endpoints used:

- `POST /stripe/Intent`: Create payment intent
- `POST /stripe/release-funds`: Release escrowed funds
- `POST /stripe/connect-account`: Connect a freelancer Stripe account
- `POST /stripe/disconnect-account`: Disconnect a Stripe account
- `GET /stripe/account-status/:stripeAccountId`: Check account status
- `GET /stripe/refresh`: Refresh connect onboarding
- `GET /stripe/success`: Connect success callback

### M-Pesa backend (Railway)

Base URL: `https://lancermpesabackend-production.up.railway.app`

Endpoints used:

- `POST /mpesa/b2c-payment`: Payout flow (from project details)
- `POST /mpesa/stk-push`: Initiate STK push
- `POST /mpesa/query-stk`: Poll STK push status

### Supabase Edge Functions

Functions are in `supabase/functions` and are called by `lib/paymentService.js`:

- `confirm-escrow-payment`: Verify Stripe payment and update `transactions`
- `release-escrow`: Transfer funds to freelancer and update `transactions`
- `refund-escrow`: Refund a payment and update `transactions`

## Core Modules

### `lib/`

- `Client.js`: Supabase client setup and app state handling
- `supabase.js`: Data access helpers
  - `getAllUsers`, `getUser`, `ClientDetails`, `getFreelancerProfile`
  - `getProjects`, `FetchOpenProjects`, `FetchCategories`
  - `getChatConversations`, `getChatsBetweenUsers`, `PostChats`
  - `PostNotifications`, `markAllMessagesAsRead`
  - `InsertTransaction`, `ClientTranscations`, `progressProjects`
  - `FreeLancerBids`, `getAllBids`, `Commission`, `getFreelancerStripeAccount`
- `api.js`: Stripe backend HTTP client
- `apiMpesa.js`: M-Pesa backend HTTP client
- `paymentService.js`: Escrow calculations and Supabase function calls
- `NotificationService.js`: Expo push notifications + DB sync
- `stripe.js`: Reads publishable key from Expo config
- `stripe-client.native.js` and `stripe-client.web.js`: Stripe web/native abstraction
- `stripe-mock.js`: No-op Stripe hook for web
- `networkTest.js`: Connectivity checks
- `utils.ts`: `cn` helper for className merging

### `services/`

- `stripeApiClient.js`: Fetch-based Stripe client
- `stripeApi.js`: Stripe API helper (connect, disconnect, status)
- `useStripeMutation.js`: React Query hooks for Stripe mutations

### `hooks/`

- `useAuth.jsx`: Supabase auth, role management, Google OAuth
- `ThemeContext.jsx`: Light/dark theme with persistence
- `useStripeConnection.js`: Stripe connect/disconnect flow
- `use-toast.ts`: Toast state and helpers
- `useColorScheme.ts`, `useColorScheme.web.ts`: Platform color scheme
- `useThemeColor.ts`: Theme color helper

### `components/`

- `PaymentMethodModal.jsx`: Select Stripe or M-Pesa
- `NotificationsScreen.jsx`: Notification feed
- `FeedBackForm.jsx`: Custom feedback form with Sentry
- `SentryFeedback.jsx`: Buttons to trigger Sentry feedback
- `avatar.jsx`: Avatar or initials renderer
- `ftabProfile.jsx`: Freelancer profile screen
- `dashboard/worker/FreelanceDashboard.jsx`: Freelancer dashboard view
- `dashboard/worker/freeLancerEditProfile.jsx`: Freelancer profile editor
- `dashboard/client/clientEditDetails.jsx`: Placeholder client editor
- `ui/toast.tsx`: Web toast components (Radix UI)

### `helpers/`

- `common.js`: `hp` and `wp` helpers for responsive sizing
- `Connect.js`: Stripe connect/disconnect helpers
- `sentryPerformance.js`: Sentry performance hooks

### `constants/`

- `imageService.js`: Supabase storage upload helper
- `index.js`: Supabase and Stripe constants

### `supabase/`

- `functions/confirm-escrow-payment`: Confirm and escrow payment
- `functions/release-escrow`: Release funds to freelancer
- `functions/refund-escrow`: Refund client

## Payments and Escrow Flow

1. Client selects payment method in `PaymentMethodModal`
2. Stripe flow uses `lib/api.js` and `lib/paymentService.js`
3. M-Pesa flow uses `app/mpesa-payment.jsx` or `lib/apiMpesa.js`
4. Supabase Edge Functions finalize escrow status in `transactions`

## Notifications

- Push notifications via `expo-notifications`
- Tokens stored in `user_settings`
- In-app notifications stored in `notifications` and shown via `NotificationsScreen`

## Analytics and Monitoring

- Sentry: error tracking, performance, replay
- PostHog: usage analytics and session replay

## Notes

- Some screens are placeholders (`app/(auth)/signUp.jsx`, `components/dashboard/client/clientEditDetails.jsx`).
- Consider moving hardcoded secrets into environment variables.

