# Single entry point for development tasks. Run `make help` for an overview.
# YARN can be overridden, e.g. `make test YARN="corepack yarn"` if the yarn
# shim is not enabled via `corepack enable`.

YARN ?= yarn
UV ?= uv
BACKEND := backend
DEV_ENV := PDFNUM_DEBUG=1

.DEFAULT_GOAL := help
.PHONY: help install install-backend install-frontend e2e-browsers e2e-deps \
        dev dev-backend dev-frontend \
        test test-backend test-frontend e2e check \
        lint lint-backend lint-frontend format build clean

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: install-backend install-frontend e2e-browsers ## Install all dependencies incl. the e2e browser
install-backend:
	cd $(BACKEND) && $(UV) sync
install-frontend:
	$(YARN) install
	@touch $(NODE_DEPS)

# Frontend/e2e dependencies are (re)installed automatically by every target that
# needs them whenever a manifest or the lockfile is newer than the last install,
# e.g. after a git pull that added a package. (The backend needs no equivalent:
# `uv run` syncs the environment by itself.)
NODE_DEPS := node_modules/.yarn-state.yml
NODE_MANIFESTS := package.json yarn.lock .yarnrc.yml frontend/package.json e2e/package.json

$(NODE_DEPS): $(NODE_MANIFESTS)
	$(YARN) install
	@touch $@

# Downloads the Chromium build matching the installed Playwright version.
# Idempotent and quick when the browser is already present. Skipped when
# PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH points at an existing browser.
e2e-browsers: $(NODE_DEPS) ## Download Playwright's Chromium (automatic in install and e2e)
ifeq ($(strip $(PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)),)
	$(YARN) workspace e2e playwright install chromium
else
	@echo "Using Chromium at $(PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)"
endif

e2e-deps: $(NODE_DEPS) ## Install system libraries Chromium needs (Debian/Ubuntu, uses sudo)
	$(YARN) workspace e2e playwright install-deps chromium

dev: ## Run backend (:8000) and frontend (:5173) together
	$(MAKE) -j2 dev-backend dev-frontend
dev-backend:
	cd $(BACKEND) && $(DEV_ENV) $(UV) run python manage.py migrate --noinput
	cd $(BACKEND) && $(DEV_ENV) $(UV) run python manage.py runserver 127.0.0.1:8000
dev-frontend: $(NODE_DEPS)
	$(YARN) workspace frontend dev

test: test-backend test-frontend ## Run backend and frontend unit/integration tests
test-backend: ## Run backend tests (pytest)
	cd $(BACKEND) && $(UV) run pytest
test-frontend: $(NODE_DEPS) ## Run frontend tests (Vitest)
	$(YARN) workspace frontend test

e2e: e2e-browsers ## Run Playwright end-to-end tests against the real stack
	$(YARN) workspace e2e test

check: lint test e2e ## Everything CI runs

lint: lint-backend lint-frontend ## Run all linters and type checks
lint-backend:
	cd $(BACKEND) && $(UV) run ruff check . && $(UV) run ruff format --check .
lint-frontend: $(NODE_DEPS)
	$(YARN) prettier --check .
	$(YARN) workspace frontend lint
	$(YARN) workspace frontend typecheck
	$(YARN) workspace e2e typecheck

format: $(NODE_DEPS) ## Auto-format all code (ruff for Python, Prettier for TS/JSON/YAML)
	cd $(BACKEND) && $(UV) run ruff format . && $(UV) run ruff check --fix .
	$(YARN) prettier --write .

build: $(NODE_DEPS) ## Build the production frontend bundle
	$(YARN) workspace frontend build

clean: ## Remove build output, caches and e2e data
	rm -rf frontend/dist frontend/coverage e2e/.data e2e/test-results e2e/playwright-report
	find $(BACKEND) -name __pycache__ -type d -prune -exec rm -rf {} +
