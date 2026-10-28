#!/usr/bin/env bash
# Local Postgres (Docker) for running db/migrations, db/seeds and db/tests without the cloud console.
# Usage:  bash scripts/db-local.sh up                     rebuild the database: stubs, migrations, seeds
#         bash scripts/db-local.sh test db/tests/X.sql    run a SQL test file (passes when it prints "OK: all")
#         bash scripts/db-local.sh apply db/seeds/X.sql   run any SQL file
#         bash scripts/db-local.sh psql                   interactive psql
#         bash scripts/db-local.sh down                   remove the container
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash must not rewrite /tmp paths passed to docker
export PATH="$PATH:/c/Users/mbark/AppData/Local/Programs/DockerDesktop/resources/bin"
NAME=erp-pg
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

run_sql() { # run_sql <path of a .sql file on this machine>
  # Remove the previous file first: a failed copy must never re-run the last file and report its result.
  docker exec "$NAME" rm -f /tmp/run.sql
  docker cp "$(cygpath -w "$1")" "$NAME:/tmp/run.sql" > /dev/null   # docker.exe wants a Windows path
  docker exec "$NAME" psql -U postgres -d erp -v ON_ERROR_STOP=1 -q -f /tmp/run.sql
}

case "${1:-}" in
  up)
    docker rm -f "$NAME" > /dev/null 2>&1 || true
    docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg postgres:16 > /dev/null
    # The official image starts a temporary server, restarts, then serves: wait for the second "ready".
    until [ "$(docker logs "$NAME" 2>&1 | grep -c 'ready to accept connections')" -ge 2 ]; do sleep 1; done
    docker exec "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -c "create database erp"
    run_sql "$ROOT/db/local/stubs.sql"
    for f in "$ROOT"/db/migrations/*.sql "$ROOT"/db/seeds/*.sql; do
      echo "applying $(basename "$f")"
      run_sql "$f"
    done
    ;;
  test)
    set +e
    out="$(run_sql "$ROOT/$2" 2>&1)"
    set -e
    echo "$out"
    echo "$out" | grep -q "OK: all" || { echo "TESTS FAILED"; exit 1; }
    ;;
  apply) run_sql "$ROOT/$2" ;;
  psql) docker exec -it "$NAME" psql -U postgres -d erp ;;
  down) docker rm -f "$NAME" ;;
  *) echo "usage: bash scripts/db-local.sh up|test <file>|apply <file>|psql|down"; exit 2 ;;
esac
