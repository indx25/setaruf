import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, CheckCircle, Info } from "lucide-react"

export default function SyaratKetentuanPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 p-6">
      <div className="container mx-auto max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-rose-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-rose-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            Syarat & Ketentuan
          </h1>
        </div>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Hai! 👋 Sebelum pakai Setaruf, yuk baca ketentuan singkat ini supaya pengalaman taarufmu aman dan nyaman.
          </AlertDescription>
        </Alert>

        <Card className="border-0 bg-white/90 backdrop-blur-md shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Ketentuan Umum</CardTitle>
            <CardDescription>Ringkasan poin penting penggunaan Setaruf</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section className="space-y-2">
              <h2 className="font-semibold">1️⃣ Umur & Akun</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Kamu harus berusia 18+ dan punya kapasitas hukum.</li>
                <li>Jaga kerahasiaan akun & password ya!</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">2️⃣ CV Taaruf & Info Pribadi</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Isi data dengan jujur: foto, pendidikan, pekerjaan, minat, dll.</li>
                <li>Data ini dipakai untuk proses matching.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">3️⃣ Psikotes</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Ada 4 psikotes: Pra-Nikah, DISC, Clinical, & 16PF.</li>
                <li>Hasilnya rahasia dan membantu sistem mencocokkanmu dengan yang cocok.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">4️⃣ Matching</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Sistem akan kasih notifikasi kalau ada yang sama-sama tertarik.</li>
                <li>Kamu cuma bisa aktif dengan satu calon pada satu waktu.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">5️⃣ Hak & Kewajiban</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Bisa berhenti kapan saja.</li>
                <li>Jangan spam, pelecehan, atau perilaku merugikan ya.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">6️⃣ Privasi & Keamanan</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Data pribadi kamu aman dan nggak dibagi ke pihak ketiga tanpa izin.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">7️⃣ Tanggung Jawab</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Setaruf hanya memfasilitasi pertemuan & proses taaruf awal. Hasilnya tergantung kamu & pasangan.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">8️⃣ Perubahan Ketentuan</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Bisa berubah sewaktu-waktu, info akan dikirim via aplikasi/email.</li>
              </ul>
            </section>

            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
              <p className="text-sm font-medium">Dengan memakai Setaruf, kamu menyetujui seluruh ketentuan di atas.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
