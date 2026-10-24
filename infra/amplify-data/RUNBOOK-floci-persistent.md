# Runbook: switch the live Floci from `memory` to `persistent`

Written 2026-10-24. **Nothing here has been run against the live container.** Each tool used below was tested on a scratch
Floci or scratch tables (see "What is tested and what is not").

## Why

The live Floci (`floci-floci-1`, compose project in `C:\Users\mbark\Downloads\floci`) has no `FLOCI_STORAGE_MODE`, so it runs
in `memory` mode (image default). Its `./data` folder holds no DynamoDB, S3, CloudFormation, Secrets Manager, Lambda or API
Gateway state. Any restart, crash or host reboot loses all of it, and the restart policy is `no`.

At stake today:

| Lives only in Floci memory | Recoverable from elsewhere? |
|---|---|
| 36 property photos (S3 `property-files`) | No: the Nhost copies were deleted. Only the backup has them |
| Tables of stack `amplify-erp-main-sandbox-0a9d62828b` (20 tables) | Yes: backup, and `migrate.mjs` from Nhost (until cutover) |
| Secret `erp-functions-config` (Hasura URL + admin secret, SMTP, APP_URL) | Only from your own records |
| Legacy Lambdas `lease-daily`, `send-notification-email`, `send-appointment-email` + REST API `floci-functions` (what prod Hasura triggers call through the tunnel) | Rebuilt by `functions/scripts/deploy-floci.mjs` |
| Bucket CORS, CDK bootstrap, the AppSync API id | Rebuilt / re-captured by the steps below |

Measured on a scratch Floci with the same image: `persistent` survived graceful restart and hard kills (even 1 s after a
write); `hybrid` lost writes made less than ~5 s before a hard kill. Use `persistent`.

## Effect on production while it runs (about 15 to 30 minutes)

- Prod ERP and public site still read Nhost/Hasura: they keep working.
- Property photos (served from Floci S3) are unavailable, and uploads fail, between step C2 and step C9.
- The Hasura email event triggers and the daily lease cron call the legacy Lambdas: they fail between C2 and C11. Hasura
  retries event triggers a limited number of times, so some emails during the window may be lost. Pick a window with no
  appointments being edited, and not near the daily cron (05:00 UTC).
- Rollback is cheap: nothing in Nhost is touched at any point. See "If something goes wrong".

## Before the window (no downtime)

**P1. Take and verify a fresh backup** (from `infra/amplify-data`):

```bash
node scripts/backup.mjs backup 0ab29b9a18674121b62e5ab195
node scripts/backup.mjs drill  "C:\Users\mbark\Backups\floci\<the new folder>"
```

Expect "restore drill passed". Then **copy that folder to a second place** (another drive or cloud). It is your only copy of
the photos, and it contains personal data (contacts, phones, emails): keep it private.

**P2. Save the secret yourself.** The value must never go through chat. Run this in a terminal, from `infra/amplify-data`,
with a path outside the repo:

```bash
node --input-type=module -e "import {SecretsManagerClient,GetSecretValueCommand} from '@aws-sdk/client-secrets-manager';import {writeFileSync} from 'node:fs';const r=await new SecretsManagerClient({region:'us-east-1',endpoint:'http://localhost:4566',credentials:{accessKeyId:'t',secretAccessKey:'t'}}).send(new GetSecretValueCommand({SecretId:'erp-functions-config'}));writeFileSync(process.argv[1],r.SecretString);console.log('saved')" "C:\Users\mbark\Backups\floci-secret.json"
```

It holds exactly these keys: `HASURA_GRAPHQL_URL, HASURA_ADMIN_SECRET, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM,
APP_URL`. Keep the file private, and move it into a password manager afterwards. You also need `NHOST_WEBHOOK_SECRET`
(the value set in Nhost's environment variables; it is a plain env var on the legacy Lambdas, not part of the secret).

**P3. Build the legacy Lambda zips:** `cd functions && node scripts/build-lambda.mjs` (writes `functions/dist/*.zip`).

**P4. Facts to keep for the rebuild** (read from the live Floci on 2026-10-24):

- REST API `floci-functions`, stage `prod`, three `POST` resources `/lease-daily`, `/send-notification-email`,
  `/send-appointment-email`, `AWS_PROXY` to the Lambda of the same name (all recreated by `deploy-floci.mjs`).
- Legacy Lambdas: nodejs20.x, handler `index.handler`, role `lambda-role`, defaults 3 s / 128 MB, env
  `NHOST_WEBHOOK_SECRET, SECRET_NAME=erp-functions-config, AWS_ENDPOINT_URL=http://floci:4566, AWS_REGION=us-east-1`.
- Buckets `property-files` and `lease-files`, CORS `GET` from `http://localhost:3000` (captured in the new backups).
- The cloudflared tunnel process keeps running through the recreate: it points at `localhost:4566`. Do not stop it.
- Current prod functions URL in Nhost (`NHOST_FUNCTIONS_URL`): note it down; it contains the REST API id, which changes.

**P5. Check:** Docker Desktop is up, `docker compose version` works, 2 GB free disk, and nobody is editing in the ERP.

## Cutover

All commands from `C:\Users\mbark\Downloads\floci` unless noted. **C2 wipes the live state: do not start it before P1 to P3
are done and the backup is copied.**

**C1. Edit `docker-compose.yml`.** Under `services.floci` add `restart` and one environment line:

```yaml
services:
  floci:
    restart: unless-stopped            # new
    environment:
      FLOCI_STORAGE_MODE: persistent   # new
      # ...the existing environment lines stay as they are
```

Optional but recommended: replace `./data:/app/data` by a folder that is not in Downloads (for example
`C:/floci-data:/app/data`, create it first). In `persistent` mode that folder holds all state.

**C2. Recreate Floci** (this is the wipe):

```bash
docker rm -f $(docker ps -aq --filter "name=floci-aws-")      # old Lambda / AppSync sidecar containers
docker compose up -d --force-recreate floci
```

Wait until `curl http://localhost:4566/` answers. Restart-survival itself is proven in C12.

**C3. Bootstrap CDK on the fresh Floci** (from `infra/amplify-data`). *Not tested:* the `CDKToolkit` stack on the old Floci was
created by a command that is not recorded in the repo.

```bash
AWS_ENDPOINT_URL=http://localhost:4566 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1 \
  npx cdk bootstrap aws://000000000000/us-east-1
```

If it fails, stop and tell me: do not improvise (the deploy needs the bootstrap bucket `cdk-hnb659fds-assets-...`).

**C4. Deploy the main stack** (from `infra/amplify-data`): `npm run deploy main -- --yes`. Note the new `awsAppsyncApiId` in
the output (it is **not** `0ab29b9a18674121b62e5ab195` any more). Call it `NEWAPI` below.

**C5. Restore the data. Do this before creating the SMTP secret** (the Mailer Lambda reads the DynamoDB streams, and
`restore` refuses rows it would mail while the secret exists):

```bash
node scripts/backup.mjs restore "C:\Users\mbark\Backups\floci\<folder>" NEWAPI          # dry run, read the plan
node scripts/backup.mjs restore "C:\Users\mbark\Backups\floci\<folder>" NEWAPI --yes
```

It creates the buckets with their CORS, writes the 20 tables and the 36 photos, then reads everything back
(sha256 for files, canonical compare for rows). It refuses non-empty tables unless `--merge`.

**C6. Re-create the secret** from the file saved in P2:

```bash
node --input-type=module -e "import {SecretsManagerClient,CreateSecretCommand} from '@aws-sdk/client-secrets-manager';import {readFileSync} from 'node:fs';await new SecretsManagerClient({region:'us-east-1',endpoint:'http://localhost:4566',credentials:{accessKeyId:'t',secretAccessKey:'t'}}).send(new CreateSecretCommand({Name:'erp-functions-config',SecretString:readFileSync(process.argv[1],'utf8')}));console.log('secret created')" "C:\Users\mbark\Backups\floci-secret.json"
```

**C7. Point the web at the new API.** In `web/.env.local` change `APPSYNC_URL` to
`http://localhost:4566/v1/apis/NEWAPI/graphql`.

**C8. Validate the data layer** (from `infra/amplify-data`):

```bash
node scripts/validate-access.mjs NEWAPI                       # all checks pass
ERP_API_ID=NEWAPI HASURA_ADMIN_SECRET=<from web/.env.local> node scripts/parity.mjs     # 32 identical, 0 different
```

**C9. Photos back:** open an ERP property page with photos (served from S3 through the app) and check one loads.

**C10. Legacy functions** (from `functions`, with the webhook secret in your shell, not in a file):

```bash
NHOST_WEBHOOK_SECRET=<value from Nhost env> node scripts/deploy-floci.mjs
```

It prints a new base URL containing a new REST API id. Update the Nhost environment variable `NHOST_FUNCTIONS_URL` to
`<your tunnel host>/restapis/<new id>/prod/_user_request_` (no trailing slash). No Hasura metadata change is needed: the
triggers read that variable.

**C11. Check the legacy path:**

```bash
curl -s -X POST -H "x-nhost-webhook-secret: wrong" -d "{}" -w " HTTP %{http_code}\n" "<local base URL>/lease-daily"
```

Expect `{"error":"unauthorized"} HTTP 401` (the function answers through API Gateway). Do **not** call it with the real
secret: that would run the real daily job. Then wait for the next real appointment or notification and confirm its mail.

**C12. Prove persistence for real.** In a quiet moment, run `docker restart floci-floci-1`, wait for port 4566, then repeat
C8 and C9 and the 401 check of C11. All must pass without re-deploying anything. This also exercises what the scratch
test could not: AppSync, the API Gateway, and the Lambdas after a restart. Keep Docker Desktop on "start at login" and the
compose `restart: unless-stopped` (C1) so a host reboot brings it back.

**C13. Take a first post-cutover backup** (`node scripts/backup.mjs backup NEWAPI`) and schedule one (daily is enough;
the photos change only on uploads).

## If something goes wrong

- Nothing in Nhost (Postgres, Hasura, storage settings) is modified by any step. Prod ERP stays on Hasura.
- A failed C3 or C4: the state is empty, so just repair and retry; no data is at risk (the backup folder is the data).
- A failed C5: re-run it (it refuses non-empty tables, so use `--merge` after a partial run), or delete the stack's tables
  and redeploy. The verification step tells you exactly which table or file differs.
- Anything unexplained after C2: stop. The state of record is the backup folder plus the copy from P1. Do not delete either.
- To go back to `memory` mode (not recommended): remove the line in C1 and repeat C2 to C11.

## What is tested and what is not

Tested (2026-10-24):

- `scripts/backup.mjs backup`, `drill` and `restore` on the live data (restore into scratch tables and a scratch bucket
  prefix; 20 tables and 36 objects verified, scratch deleted) and `scripts/backup.int.test.mjs` (4 tests covering dry run,
  non-empty refusal, `--merge`, missing table with `--create-tables`, the mail guard, a tampered file, and CORS).
- `persistent` and `hybrid` storage on a scratch Floci with the live image: graceful restart, hard kills, DynamoDB with
  index, S3, Secrets Manager, CloudFormation, Lambda definition and invocation.
- `functions/scripts/deploy-floci.mjs` on a scratch Floci: creates and re-runs idempotently, the API answers 401 for a wrong
  webhook secret through API Gateway.
- `scripts/validate-access.mjs` and `scripts/parity.mjs` on the current `main` stack.

Not tested (the reason C12 exists):

- `cdk bootstrap` against a fresh Floci (C3).
- A full redeploy of the main stack on a Floci that is in `persistent` mode, and AppSync, API Gateway and Lambda
  persistence across a restart. A scratch run of the full stack was avoided because AppSync starts a sidecar container
  with a fixed name (`floci-aws-graphql`) that would clash with the live one.
- The exact value to set for Nhost's `NHOST_FUNCTIONS_URL` after the change (it depends on your tunnel host).
