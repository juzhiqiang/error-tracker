const API_URL = process.env.E2E_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002'
const E2E_EMAIL = process.env.E2E_EMAIL ?? 'e2e-owner@example.com'
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-password-123'
const E2E_NAME = process.env.E2E_NAME ?? 'E2E Owner'

async function main() {
  await waitForApi()

  if (await canSignIn()) {
    console.log(`E2E user is ready: ${E2E_EMAIL}`)
    return
  }

  const signedUp = await signUp()
  if (signedUp || (await canSignIn())) {
    console.log(`E2E user is ready: ${E2E_EMAIL}`)
    return
  }

  await deleteE2eUser()
  if (!(await signUp()) || !(await canSignIn())) {
    throw new Error(`Unable to seed E2E user ${E2E_EMAIL}`)
  }
  console.log(`E2E user was recreated: ${E2E_EMAIL}`)
}

async function waitForApi() {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/health`)
      if (response.ok) return
    } catch {
      // API is still starting.
    }
    await sleep(1_000)
  }
  throw new Error(`API did not become ready at ${API_URL}`)
}

async function signUp() {
  const response = await authRequest('/api/auth/sign-up/email', {
    name: E2E_NAME,
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
  })
  return response.ok
}

async function canSignIn() {
  const response = await authRequest('/api/auth/sign-in/email', {
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
  })
  return response.ok
}

async function authRequest(path: string, body: Record<string, unknown>) {
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: process.env.E2E_WEB_URL ?? 'http://localhost:3003',
    },
    body: JSON.stringify(body),
  })
}

async function deleteE2eUser() {
  const escapedEmail = E2E_EMAIL.replace(/'/g, "''")
  const query = `
    DO $$
    DECLARE e2e_user_id text;
    BEGIN
      SELECT id INTO e2e_user_id FROM "user" WHERE lower(email) = lower('${escapedEmail}') LIMIT 1;
      IF e2e_user_id IS NOT NULL THEN
        DELETE FROM project_members WHERE user_id = e2e_user_id;
        DELETE FROM organization_members WHERE user_id = e2e_user_id;
        UPDATE audit_logs SET actor_user_id = NULL WHERE actor_user_id = e2e_user_id;
        DELETE FROM account WHERE user_id = e2e_user_id;
        DELETE FROM session WHERE user_id = e2e_user_id;
        DELETE FROM "user" WHERE id = e2e_user_id;
      END IF;
    END $$;
  `
  const proc = Bun.spawnSync({
    cmd: ['docker', 'exec', 'error-tracker-pg', 'psql', '-U', 'tracker', '-d', 'error_tracker', '-v', 'ON_ERROR_STOP=1', '-c', query],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (proc.exitCode !== 0) {
    throw new Error(`Unable to delete existing E2E user: ${new TextDecoder().decode(proc.stderr)}`)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
