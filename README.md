# Phantix Platform

Organization onboarding and management portal for `platform.phantix.site`.

This frontend is a Vite + React + TypeScript application for the Phantix customer platform shell, including org setup, identity, company & access management, product modules, billing, support, and audit.

## Key details

- name: `phantix-platform`
- version: `1.0.0`
- tech stack: React, TypeScript, Vite, Tailwind CSS, Framer Motion, React Router
- API prefix: `/api/v1`
- app surface: tenant/org management portal

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Type checking

```bash
npm run typecheck
```

## Vercel deployment

This app is configured for Vercel as a static single-page application.

- build command: `npm run build`
- output directory: `dist`
- SPA routing is handled by `vercel.json`

## Notes

- The app shares brand assets from the repo-level `/public` directory via Vite `publicDir`.
- Use company JWT / org-user JWT auth flows as defined by the implementation docs.
