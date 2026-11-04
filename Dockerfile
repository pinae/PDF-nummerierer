# syntax=docker/dockerfile:1
# PDF-Nummerierer: one image with the Django backend serving the built frontend.
# Build: docker build -t pdf-nummerierer .   (see README, "Deployment")

ARG NODE_VERSION=26
ARG PYTHON_VERSION=3.14

# ---- 1. Frontend: build the single-page app ------------------------------------
FROM node:${NODE_VERSION}-slim AS frontend
# Optional: fetch yarn through the npm registry instead of repo.yarnpkg.com.
ARG COREPACK_NPM_REGISTRY
WORKDIR /src
RUN npm install --global corepack@latest && corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY frontend/package.json frontend/
COPY e2e/package.json e2e/
RUN yarn workspaces focus frontend
COPY frontend/ frontend/
RUN yarn workspace frontend build

# ---- 2. Backend: install the locked Python dependencies -----------------------
FROM python:${PYTHON_VERSION}-slim AS backend
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv
RUN pip install --no-cache-dir uv==0.13.7
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --locked --no-dev --no-install-project

# ---- 3. Runtime ------------------------------------------------------------------
FROM python:${PYTHON_VERSION}-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/venv/bin:$PATH \
    PDFNUM_DATA_DIR=/data \
    PDFNUM_FRONTEND_DIR=/app/frontend
RUN useradd --system --uid 1000 --create-home pdfnum \
    && install -d -o pdfnum -g pdfnum /data
WORKDIR /app/backend
COPY --from=backend /opt/venv /opt/venv
COPY backend/ ./
COPY --from=frontend /src/frontend/dist /app/frontend
COPY docker/entrypoint.sh /usr/local/bin/pdfnum-entrypoint
COPY docker/healthcheck.py /usr/local/bin/pdfnum-healthcheck
USER pdfnum
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "/usr/local/bin/pdfnum-healthcheck"]
ENTRYPOINT ["pdfnum-entrypoint"]
CMD ["web"]
