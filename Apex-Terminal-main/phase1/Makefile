# Makefile for Phase 1 Data Pipeline

.PHONY: help install dev test test-unit test-integration test-parity lint format run docker-build docker-up docker-down clean

help:
	@echo "Available commands:"
	@echo "  install          Install production dependencies"
	@echo "  dev              Install development dependencies"
	@echo "  test             Run all tests"
	@echo "  test-unit        Run unit tests only"
	@echo "  test-integration Run integration tests only"
	@echo "  test-parity      Run parity tests only"
	@echo "  lint             Run linting"
	@echo "  format           Format code"
	@echo "  run              Run the API server"
	@echo "  docker-build     Build Docker images"
	@echo "  docker-up        Start Docker containers"
	@echo "  docker-down      Stop Docker containers"
	@echo "  clean            Clean generated files"

install:
	pip install -r requirements.txt

dev:
	pip install -r requirements.txt
	pip install pytest pytest-asyncio pytest-cov black isort mypy

test:
	pytest tests/ -v

test-unit:
	pytest tests/unit/ -v

test-integration:
	pytest tests/integration/ -v -m integration

test-parity:
	pytest tests/parity/ -v -m parity

lint:
	mypy services/ --ignore-missing-imports
	isort --check-only services/ tests/
	black --check services/ tests/

format:
	isort services/ tests/
	black services/ tests/

run:
	./venv/bin/uvicorn services.api.main:app --reload --host 0.0.0.0 --port 7500

run-mock:
	python scripts/run_mock.py --csv fixtures/aapl_test_ticks.csv --symbols AAPL --timeframes 1m,5m

docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .coverage htmlcov/
