import { db } from '../src/lib/db.ts'

async function main() {
  const email = process.env.ADMIN_EMAIL || 'neonuser_login@example.com'
  const user = await db.user.update({
    where: { email },
    data: { isAdmin: true }
  })
  console.log(JSON.stringify({ promoted: true, email: user.email, isAdmin: user.isAdmin }))
  process.exit(0)
}

main()
