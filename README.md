# SmoothSend Status Dashboard

A blazing fast, Next.js powered status dashboard for the SmoothSend infrastructure. It tracks and aggregates the historical 90-day uptime of the core Worker Gateway API alongside the Aptos, EVM, and Stellar core Relayers.

## Architecture & Data Storage

This application is designed to be hosted natively on **Vercel** and utilizes **Vercel KV (Serverless Redis)** for database persistence.

1. **Frontend & UI**: Built with Next.js 14, TailwindCSS, and Lucide React. Based largely on standard atlassian statuspage layouts with rich dark-mode theming.
2. **Cron Job (`/api/cron`)**: Vercel routinely pings this endpoint every 10 minutes. This endpoint probes the live production endpoints of the 4 SmoothSend services, evaluates their responsiveness, and logs their status (Operational, Degraded, or Outage) securely into the Vercel KV Redis database.
3. **Status API (`/api/status`)**: When a user loads the status page, this endpoint retrieves the past 90 days of daily aggregates from the KV database, merges it with a live real-time ping for the current day, and serves it to the frontend.
4. **Resiliency**: If the KV database is not configured or offline, the API automatically falls back to gracefully returning purely live stateless ping results to keep the dashboard visually unbroken.

## Standard Vercel Deployment Runbook

1. **Push to GitHub**: Ensure the `status-page` directory is pushed to your GitHub repository.
2. **Import to Vercel**: Inside Vercel, click "Add New... -> Project" and import the repository.
   - *Note: If your repository is a monorepo, set the "Root Directory" to `status-page/`.*
3. **Provision Database**: Once the project is created, click on the **Storage** tab in your Vercel Dashboard.
   - Create a new **KV database** and associate it with this project.
   - Vercel will automatically inject the required `KV_URL` and `KV_REST_API` environment variables into your project.
4. **Secure the Cron**: In your Vercel Project Settings -> Environment Variables, add a strong secret token:
   - `CRON_SECRET=your_secure_randomly_generated_string`
   - Vercel automatically sends this secret via an authorization header when hitting `/api/cron` to ensure external actors cannot spam database write requests.
5. **Deploy**: Trigger a new deployment so Vercel can ingest the updated environment variables.
6. **Verify Data Flow**: The local `vercel.json` ensures the cron job begins firing immediately every 10 minutes. Give it 20 minutes and the UI will begin securely painting historical data blocks!

## Local Development Requirements
To run locally, copy `.env.example` to `.env.local` and substitute your Vercel KV REST URL variables:
```bash
npm install
npm run dev
```
# status-page
