# Practical Sprint 1 container build: builds the whole workspace (pnpm/turbo
# don't make it easy to build a single package's dependency subtree in
# isolation without `pnpm deploy`, whose default file-inclusion rules are
# gitignore-driven and would silently drop the gitignored `dist/` output),
# then runs this app's compiled entrypoint out of the full workspace tree.
# Larger image than a pruned multi-stage build, but correct and simple —
# revisit with `pnpm deploy`-based pruning if image size becomes a concern.
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
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
