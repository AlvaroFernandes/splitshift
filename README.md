This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values — each one has a comment saying where to find it in the Supabase dashboard.

### Installing the CLI

```bash
brew install supabase/tap/supabase
supabase --version
```

If Homebrew refuses to install it because of untrusted taps, download `supabase_darwin_arm64.tar.gz` from the [latest CLI release](https://github.com/supabase/cli/releases/latest), check it against the release's checksums file, and move the `supabase` binary into a folder on your `PATH` (e.g. `~/.local/bin`).

### Linking the project (once per machine)

```bash
supabase login
supabase link --project-ref jeljseyiigcenazjdzcy
```

`supabase/config.toml` is committed; the link itself is stored in `supabase/.temp/`, which is git-ignored, so every clone needs to run `supabase link` once.

### Migrations

Migrations live in `supabase/migrations/` and are numbered sequentially (`001_…`, `002_…`). To add one, create the next numbered file, then:

```bash
supabase migration list       # compare local vs. remote
supabase db push --dry-run    # preview what will run
supabase db push              # apply to the linked database
```

If you ever run a migration by hand in the SQL editor, record it so `db push` doesn't try to run it again:

```bash
supabase migration repair --status applied <number>
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
