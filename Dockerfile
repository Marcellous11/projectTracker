# syntax=docker/dockerfile:1

# bookworm-slim (glibc) so better-sqlite3 grabs its linux-x64 prebuilt
# instead of compiling from source — saves ~60s and ~150MB vs Alpine.

# --- deps: install node_modules from the lockfile ---
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build: compile the Next.js standalone server ---
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- run: minimal runtime image ---
FROM node:20-bookworm-slim AS run
WORKDIR /app
# git is needed at runtime for the detail view's "recent commits" activity feed.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
# The dashboard scans this path; docker-compose mounts the projects folder here.
ENV PROJECTS_ROOT=/projects
# Next standalone server honors PORT; we keep it on 3000 inside the container
# and map it to 4317 on the host in docker-compose.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
