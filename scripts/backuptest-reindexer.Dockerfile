# Nur für scripts/test-backup-restore.sh: schlanker Stellvertreter des
# App-Containers für den Suchindex-Neuaufbau. Gleiche Basis (node:20-alpine),
# gleiche Prisma-Version und dasselbe Bundle dist-worker/reindex-suche.mjs wie das
# Produktions-Image – ohne den mehrere GB schweren Next.js-Build.
# Build-Kontext: ein Ordner mit prisma/ und dist-worker/reindex-suche.mjs
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ARG PRISMA_VERSION
# package.json ohne "type" – wie im Produktions-Image
RUN echo '{"name":"reindexer","private":true}' > package.json \
 && npm install --no-audit --no-fund --loglevel=error "prisma@${PRISMA_VERSION}" "@prisma/client@${PRISMA_VERSION}"
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
COPY dist-worker/reindex-suche.mjs ./dist-worker/reindex-suche.mjs
CMD ["sleep", "infinity"]
