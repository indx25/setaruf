import crypto from 'crypto'

export type BankType = 'BCA' | 'MANDIRI' | 'BRI' | 'BNI' | 'OCBC' | 'SINARMAS' | 'UNKNOWN'

export interface FraudResult {
  bankDetected: BankType
  extractedAccount: string | null
  extractedAmount: number | null
  imageHash: string
  fraudScore: number
  fraudLevel: 'SAFE' | 'MEDIUM' | 'HIGH'
  decision: 'AUTO_APPROVE' | 'REVIEW' | 'HOLD'
}

function detectBank(text: string): BankType {
  const t = text.toLowerCase()
  if (t.includes('m-transfer') || t.includes('bca mobile') || t.includes('bca')) return 'BCA'
  if (t.includes('livin') || t.includes('mandiri')) return 'MANDIRI'
  if (t.includes('brimo') || t.includes('bank bri') || t.includes('bri')) return 'BRI'
  if (t.includes('wondr') || t.includes('bni mobile') || t.includes('bni')) return 'BNI'
  if (t.includes('ocbc') || t.includes('nisp')) return 'OCBC'
  if (t.includes('simobiplus') || t.includes('sinarmas')) return 'SINARMAS'
  return 'UNKNOWN'
}

function parseByBank(_bank: BankType, text: string) {
  const accountMatch = text.match(/\b\d{8,16}\b/)
  const amountMatch = text.match(/rp\s?([\d.,]+)/i) || text.match(/idr\s?([\d.,]+)/i)
  return {
    account: accountMatch?.[0] ?? null,
    amount: amountMatch ? parseFloat(amountMatch[1].replace(/[.,]/g, '')) : null
  }
}

export async function runEnterpriseFraudCheck({
  proofUrl,
  expectedAmount,
  expectedBank,
  userId,
  paymentId,
  db
}: any): Promise<FraudResult> {
  let fraudScore = 0
  const res = await fetch(proofUrl)
  const buf = Buffer.from(await res.arrayBuffer())
  const imageHash = crypto.createHash('sha256').update(buf).digest('hex')

  const duplicateImage = await db.payment.count({
    where: { imageHash, NOT: { id: paymentId } }
  })
  if (duplicateImage > 0) fraudScore += 50

  const textSeed = `${proofUrl}`.toLowerCase()
  const bankDetected = detectBank(textSeed)
  if (bankDetected === 'UNKNOWN') fraudScore += 30
  if (expectedBank && bankDetected !== String(expectedBank).toUpperCase()) fraudScore += 20

  const parsed = parseByBank(bankDetected, textSeed)
  if (!parsed.amount) fraudScore += 25
  if (!parsed.account) fraudScore += 20

  if (parsed.amount && Math.abs(parsed.amount - expectedAmount) > 1000) fraudScore += 40

  if (parsed.account) {
    const validAccount = await db.bankAccount.findFirst({
      where: { userId, accountNo: parsed.account }
    })
    if (!validAccount) fraudScore += 50
    const reused = await db.bankAccount.count({
      where: { accountNo: parsed.account, NOT: { userId } }
    })
    if (reused > 0) fraudScore += 40
  }

  let fraudLevel: 'SAFE' | 'MEDIUM' | 'HIGH'
  let decision: 'AUTO_APPROVE' | 'REVIEW' | 'HOLD'
  if (fraudScore >= 80) {
    fraudLevel = 'HIGH'
    decision = 'HOLD'
  } else if (fraudScore >= 40) {
    fraudLevel = 'MEDIUM'
    decision = 'REVIEW'
  } else {
    fraudLevel = 'SAFE'
    decision = 'AUTO_APPROVE'
  }

  return {
    bankDetected,
    extractedAccount: parsed.account,
    extractedAmount: parsed.amount,
    imageHash,
    fraudScore,
    fraudLevel,
    decision
  }
}

