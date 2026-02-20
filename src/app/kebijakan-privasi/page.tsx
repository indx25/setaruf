import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Info } from "lucide-react"

export default function KebijakanPrivasiPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 p-6">
      <div className="container mx-auto max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-rose-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-rose-500/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            Kebijakan Privasi
          </h1>
        </div>

        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Kami menjaga kerahasiaan data pribadimu. Dokumen ini menjelaskan apa yang kami kumpulkan, bagaimana kami gunakan, dan hak-hakmu.
          </AlertDescription>
        </Alert>

        <Card className="border-0 bg-white/90 backdrop-blur-md shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">Ringkasan Privasi</CardTitle>
            <CardDescription>Kebijakan privasi sederhana dan jelas untuk Setaruf</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section className="space-y-2">
              <h2 className="font-semibold">Data yang Kami Kumpulkan</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Data akun: nama, email, tanggal lahir.</li>
                <li>CV taaruf: foto, pendidikan, pekerjaan, minat, dan informasi relevan.</li>
                <li>Hasil psikotes: Pra-Nikah, DISC, Clinical, dan 16PF.</li>
                <li>Data teknis: aktivitas dasar aplikasi, perangkat, dan log keamanan.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">Cara Kami Menggunakan Data</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Proses matching yang lebih akurat dan aman.</li>
                <li>Pemberitahuan terkait kecocokan dan pembaruan layanan.</li>
                <li>Peningkatan kualitas fitur dan pengalaman pengguna.</li>
                <li>Pencegahan penyalahgunaan, spam, dan pelanggaran ketentuan.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">Berbagi Data</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Kami tidak membagikan data pribadimu kepada pihak ketiga tanpa izin.</li>
                <li>Berbagi data dapat terjadi jika diwajibkan oleh hukum atau untuk keamanan.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">Keamanan & Penyimpanan</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Kami menggunakan praktik keamanan yang sesuai untuk melindungi data.</li>
                <li>Data disimpan selama diperlukan untuk layanan dan ketentuan hukum.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">Hak Pengguna</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Mengakses, memperbarui, atau menghapus data tertentu.</li>
                <li>Menarik persetujuan atau menonaktifkan akun kapan saja.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold">Perubahan Kebijakan</h2>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Kebijakan dapat diperbarui sewaktu-waktu.</li>
                <li>Kami akan memberi tahu melalui aplikasi atau email jika ada perubahan penting.</li>
              </ul>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
