# See apps/api/Dockerfile for the rationale behind this build shape.
FROM node:22.22.2-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22.22.2-slim AS runtime
RUN corepack enable
WORKDIR /repo
COPY --from=build /repo .
ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/main.js"]
