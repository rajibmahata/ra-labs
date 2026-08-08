#!/usr/bin/env bash
# RALabs smoke.sh — verify core endpoints across roles.
# Requires the API running (e.g. dotnet run --project RALabs.Api).
set -euo pipefail
BASE="${1:-http://localhost:5000}"

say() { printf "\n== %s ==\n" "$*"; }
check() { # check <label> <expected_code> <curl...>
  local label="$1" expected="$2"; shift 2
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$@" || true)
  if [ "$code" = "$expected" ]; then echo "  ok   [$code] $label";
  else echo "  FAIL [$code != $expected] $label"; exit 1; fi
}

say "Health"
check "health" 200 "$BASE/health"

say "Public"
check "projects list" 200 "$BASE/api/v1/projects"
check "project by slug" 200 "$BASE/api/v1/projects/lexvault"
check "missing project -> 404" 404 "$BASE/api/v1/projects/nope"
check "team list" 200 "$BASE/api/v1/team"
check "team by slug" 200 "$BASE/api/v1/team/rajib-mahata"
check "content en" 200 "$BASE/api/v1/content?locale=en"
check "content bad locale -> 400" 400 "$BASE/api/v1/content?locale=xx"
check "locales" 200 "$BASE/api/v1/locales"

say "Auth"
check "login ok" 200 -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"rajib@ralabs.dev","password":"Admin@1234"}'
check "login bad pw -> 401" 401 -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"rajib@ralabs.dev","password":"wrong"}'
check "admin no token -> 401" 401 "$BASE/api/v1/admin/projects"

say "Leads"
check "lead valid -> 201" 201 -X POST "$BASE/api/v1/leads" -H "Content-Type: application/json" -d '{"name":"Smoke","contactInfo":"smoke@example.com","message":"test","source":"form"}'
check "lead invalid -> 400" 400 -X POST "$BASE/api/v1/leads" -H "Content-Type: application/json" -d '{"name":"","contactInfo":"bad","message":"","source":"form"}'

say "MCP"
check "mcp tools" 200 "$BASE/mcp/tools"
check "mcp public call" 200 -X POST "$BASE/mcp/call" -H "Content-Type: application/json" -d '{"tool":"list_projects","arguments":{}}'
check "mcp admin blocked -> 403" 403 -X POST "$BASE/mcp/call" -H "Content-Type: application/json" -d '{"tool":"list_unpublished_leads","arguments":{}}'

say "All smoke checks passed."
