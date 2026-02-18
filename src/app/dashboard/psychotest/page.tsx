'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, Brain, Heart, Activity, Users, ArrowRight, ArrowLeft, RotateCcw, BarChart3 } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Question types
type TestCategory = 'pre_marriage' | 'disc' | 'clinical' | '16pf'

interface Question {
  id: string
  text: string
  options: {
    value: number
    label: string
  }[]
}

const testCategories = {
  pre_marriage: {
    title: 'Psikotes Pra-Nikah',
    icon: Heart,
    description: 'Evaluasi kesiapan Anda menuju pernikahan',
    questions: [
      {
        id: 'pm1',
        text: 'Bagaimana pandangan Anda tentang pernikahan?',
        options: [
          { value: 1, label: 'Sekadar kewajiban sosial' },
          { value: 2, label: 'Ingin mencoba kehidupan berpasangan' },
          { value: 3, label: 'Komitmen jangka panjang untuk membangun keluarga' },
          { value: 4, label: 'Ibadah dan bagian dari agama' },
          { value: 5, label: 'Sakral seumur hidup dan tanggung jawab besar' }
        ]
      },
      {
        id: 'pm2',
        text: 'Bagaimana Anda mengelola konflik dalam hubungan?',
        options: [
          { value: 1, label: 'Menghindari konflik sama sekali' },
          { value: 2, label: 'Menyerah agar tidak bertengkar' },
          { value: 3, label: 'Diskusi santai sampai menemukan jalan tengah' },
          { value: 4, label: 'Diskusi terbuka dengan mencari solusi bersama' },
          { value: 5, label: 'Menyelesaikan dengan dewasa dan kompromi yang saling menguntungkan' }
        ]
      },
      {
        id: 'pm3',
        text: 'Seberapa siap Anda berbagi finansial dengan pasangan?',
        options: [
          { value: 1, label: 'Tidak siap, ingin keuangan terpisah' },
          { value: 2, label: 'Sedikit siap, tapi tetap ingin kontrol penuh' },
          { value: 3, label: 'Cukup siap untuk pengeluaran bersama tertentu' },
          { value: 4, label: 'Siap berbagi dengan transparansi penuh' },
          { value: 5, label: 'Sangat siap, mengelola keuangan sebagai tim' }
        ]
      },
      {
        id: 'pm4',
        text: 'Bagaimana pandangan Anda tentang memiliki anak?',
        options: [
          { value: 1, label: 'Tidak ingin memiliki anak' },
          { value: 2, label: 'Masih ragu dan ingin menunda' },
          { value: 3, label: 'Ingin punya anak jika semua persiapan siap' },
          { value: 4, label: 'Ingin punya anak dalam waktu dekat' },
          { value: 5, label: 'Anak adalah anugerah dan prioritas dalam pernikahan' }
        ]
      },
      {
        id: 'pm5',
        text: 'Bagaimana Anda memandang peran pasangan dalam rumah tangga?',
        options: [
          { value: 1, label: 'Pasangan harus patuh sepenuhnya' },
          { value: 2, label: 'Ada pembagian tugas yang kaku' },
          { value: 3, label: 'Bekerja sama sesuai kemampuan masing-masing' },
          { value: 4, label: 'Partnership yang setara dan saling mendukung' },
          { value: 5, label: 'Tim yang solid, semua tugas dibagi dengan adil' }
        ]
      }
    ]
  },
  disc: {
    title: 'DISC Assessment',
    icon: Activity,
    description: 'Analisis kepribadian dan gaya komunikasi Anda',
    questions: [
      {
        id: 'd1',
        text: 'Dalam situasi baru, Anda cenderung...',
        options: [
          { value: 1, label: 'Mengamati terlebih dahulu sebelum bertindak' },
          { value: 2, label: 'Mencari informasi dan mempertimbangkan opsi' },
          { value: 3, label: 'Beradaptasi secara perlahan' },
          { value: 4, label: 'Langsung terjun dan mengambil inisiatif' },
          { value: 5, label: 'Mengambil kendali dan memimpin situasi' }
        ]
      },
      {
        id: 'd2',
        text: 'Saat mengambil keputusan penting, Anda...',
        options: [
          { value: 1, label: 'Butuh waktu lama untuk mempertimbangkan' },
          { value: 2, label: 'Menganalisis semua faktor secara detail' },
          { value: 3, label: 'Mendengarkan pendapat orang lain' },
          { value: 4, label: 'Cukup cepat berdasarkan insting' },
          { value: 5, label: 'Sangat cepat dan tegas' }
        ]
      },
      {
        id: 'd3',
        text: 'Cara Anda berkomunikasi dengan orang baru...',
        options: [
          { value: 1, label: 'Sangat pendek dan to-the-point' },
          { value: 2, label: 'Fokus pada fakta dan data' },
          { value: 3, label: 'Ramah dan hangat' },
          { value: 4, label: 'Energetik dan persuasif' },
          { value: 5, label: 'Langsung dan dominan' }
        ]
      },
      {
        id: 'd4',
        text: 'Saat menghadapi tekanan, Anda...',
        options: [
          { value: 1, label: 'Menarik diri dan menyendiri' },
          { value: 2, label: 'Menganalisis masalah secara sistematis' },
          { value: 3, label: 'Mencari dukungan dari orang lain' },
          { value: 4, label: 'Bertindak cepat untuk menyelesaikan' },
          { value: 5, label: 'Menghadapi dengan keberanian' }
        ]
      },
      {
        id: 'd5',
        text: 'Gaya kerja Anda lebih cocok dengan...',
        options: [
          { value: 1, label: 'Bekerja sendiri dengan detail tinggi' },
          { value: 2, label: 'Struktur dan prosedur yang jelas' },
          { value: 3, label: 'Kerja tim yang harmonis' },
          { value: 4, label: 'Proyek yang menantang dan dinamis' },
          { value: 5, label: 'Memimpin dan mengatur orang lain' }
        ]
      }
    ]
  },
  clinical: {
    title: 'Clinical Assessment',
    icon: Brain,
    description: 'Evaluasi kesehatan mental dan emosional',
    questions: [
      {
        id: 'c1',
        text: 'Seberapa sering Anda merasa cemas atau khawatir berlebihan?',
        options: [
          { value: 1, label: 'Hampir tidak pernah' },
          { value: 2, label: 'Jarang, hanya dalam situasi tertentu' },
          { value: 3, label: 'Terkadang, tapi masih terkelola' },
          { value: 4, label: 'Sering, kadang mengganggu aktivitas' },
          { value: 5, label: 'Sangat sering, sulit dikontrol' }
        ]
      },
      {
        id: 'c2',
        text: 'Bagaimana kualitas tidur Anda dalam sebulan terakhir?',
        options: [
          { value: 1, label: 'Sangat baik, tidur nyenyak setiap malam' },
          { value: 2, label: 'Baik, kadang ada gangguan ringan' },
          { value: 3, label: 'Cukup, beberapa kali sulit tidur' },
          { value: 4, label: 'Buruk, sering terbangun atau sulit tidur' },
          { value: 5, label: 'Sangat buruk, insomnia kronis' }
        ]
      },
      {
        id: 'c3',
        text: 'Seberapa mampu Anda mengelola emosi negatif?',
        options: [
          { value: 1, label: 'Sangat mampu, tenang dalam segala situasi' },
          { value: 2, label: 'Mampu, bisa mengontrol sebagian besar' },
          { value: 3, label: 'Cukup mampu, kadang masih terbawa emosi' },
          { value: 4, label: 'Kurang mampu, emosi sering memuncak' },
          { value: 5, label: 'Tidak mampu, sulit mengontrol emosi' }
        ]
      },
      {
        id: 'c4',
        text: 'Apakah Anda pernah merasa sedih atau putus asa dalam jangka lama?',
        options: [
          { value: 1, label: 'Tidak pernah' },
          { value: 2, label: 'Pernah, tapi singkat dan bisa diatasi' },
          { value: 3, label: 'Terkadang, tapi masih bisa beraktivitas' },
          { value: 4, label: 'Sering, mengganggu aktivitas sehari-hari' },
          { value: 5, label: 'Hampir setiap hari, sangat mengganggu' }
        ]
      },
      {
        id: 'c5',
        text: 'Bagaimana hubungan Anda dengan keluarga dan teman dekat?',
        options: [
          { value: 1, label: 'Sangat harmonis dan mendukung' },
          { value: 2, label: 'Baik, jarang ada konflik' },
          { value: 3, label: 'Cukup baik, ada konflik wajar' },
          { value: 4, label: 'Kurang baik, sering ada masalah' },
          { value: 5, label: 'Sangat buruk, banyak konflik dan masalah' }
        ]
      }
    ]
  },
  '16pf': {
    title: '16PF Personality Test',
    icon: Users,
    description: '16 Faktor Kepribadian untuk pemahaman diri yang mendalam',
    questions: [
      {
        id: 'p1',
        text: 'Saya cenderung lebih nyaman...',
        options: [
          { value: 1, label: 'Bersama orang banyak dan sosialisasi' },
          { value: 2, label: 'Di lingkungan yang akrab dan nyaman' },
          { value: 3, label: 'Sesekali bersama orang lain' },
          { value: 4, label: 'Lebih banyak sendiri atau kelompok kecil' },
          { value: 5, label: 'Sendiri dan fokus pada diri sendiri' }
        ]
      },
      {
        id: 'p2',
        text: 'Saat menghadapi masalah, saya cenderung...',
        options: [
          { value: 1, label: 'Mencari bantuan orang lain segera' },
          { value: 2, label: 'Mendiskusikan dengan teman/keluarga' },
          { value: 3, label: 'Mikirkan sendiri dulu baru minta pendapat' },
          { value: 4, label: 'Menganalisis dan menyelesaikan sendiri' },
          { value: 5, label: 'Menghadapi sendiri tanpa bantuan' }
        ]
      },
      {
        id: 'p3',
        text: 'Saya lebih memilih kegiatan yang...',
        options: [
          { value: 1, label: 'Sangat terstruktur dan terjadwal' },
          { value: 2, label: 'Memiliki rencana jelas' },
          { value: 3, label: 'Fleksibel tapi ada arah' },
          { value: 4, label: 'Spontan dan mengikuti alur' },
          { value: 5, label: 'Sangat fleksibel dan tidak terikat rencana' }
        ]
      },
      {
        id: 'p4',
        text: 'Cara saya mengambil risiko...',
        options: [
          { value: 1, label: 'Hindari risiko sebisa mungkin' },
          { value: 2, label: 'Ambil risiko yang sudah terhitung' },
          { value: 3, label: 'Ambil risiko jika potensi imbalan tinggi' },
          { value: 4, label: 'Cukup nyaman dengan risiko' },
          { value: 5, label: 'Sangat suka mengambil risiko' }
        ]
      },
      {
        id: 'p5',
        text: 'Saya merasa diri saya adalah orang yang...',
        options: [
          { value: 1, label: 'Sangat percaya diri dan optimis' },
          { value: 2, label: 'Percaya diri dalam kebanyakan situasi' },
          { value: 3, label: 'Cukup percaya diri' },
          { value: 4, label: 'Kadang ragu dan kurang percaya diri' },
          { value: 5, label: 'Sering merasa tidak cukup baik' }
        ]
      }
    ]
  }
}

export default function PsychotestPage() {
  const router = useRouter()
  const [currentCategory, setCurrentCategory] = useState<TestCategory | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [testResults, setTestResults] = useState<Record<TestCategory, { score: number; result: string } | null>>({
    pre_marriage: null,
    disc: null,
    clinical: null,
    '16pf': null
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    loadExistingResults()
  }, [])

  const loadExistingResults = async () => {
    try {
      const response = await fetch('/api/psychotest')
      const data = await response.json()

      if (response.ok && data.tests) {
        const newResults = { ...testResults }
        data.tests.forEach((test: any) => {
          newResults[test.testType as TestCategory] = {
            score: test.score || 0,
            result: test.result || ''
          }
        })
        setTestResults(newResults)
      }
    } catch (error) {
      console.error('Error loading results:', error)
    }
  }

  const startTest = (category: TestCategory) => {
    setCurrentCategory(category)
    setCurrentQuestionIndex(0)
    setShowResults(false)
  }

  const handleAnswer = (value: string) => {
    if (!currentCategory) return

    const category = testCategories[currentCategory]
    const currentQuestion = category.questions[currentQuestionIndex]

    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: parseInt(value)
    }))

    // Auto-advance to next question (or submit if last)
    setTimeout(() => {
      if (!currentCategory) return
      const cat = testCategories[currentCategory]
      const isLast = currentQuestionIndex >= cat.questions.length - 1
      if (isLast) {
        if (!isSubmitting) {
          submitTest()
        }
      } else {
        setCurrentQuestionIndex(prev => prev + 1)
      }
    }, 50)
  }

  const handleNext = () => {
    if (!currentCategory) return

    const category = testCategories[currentCategory]

    if (currentQuestionIndex < category.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else {
      // Submit test
      submitTest()
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const submitTest = async () => {
    if (!currentCategory) return

    setIsSubmitting(true)

    try {
      const category = testCategories[currentCategory]
      const totalScore = category.questions.reduce((sum, q) => {
        return sum + (answers[q.id] || 0)
      }, 0)

      const maxScore = category.questions.length * 5
      const percentage = (totalScore / maxScore) * 100

      // Determine result based on score
      let result = ''
      if (percentage >= 80) result = 'Sangat Baik'
      else if (percentage >= 60) result = 'Baik'
      else if (percentage >= 40) result = 'Cukup'
      else if (percentage >= 20) result = 'Kurang'
      else result = 'Sangat Kurang'

      const response = await fetch('/api/psychotest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testType: currentCategory,
          score: percentage,
          result,
          answers
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setTestResults(prev => ({
          ...prev,
          [currentCategory]: { score: percentage, result }
        }))

        // Check if all tests completed
        const allCompleted = Object.values({ ...testResults, [currentCategory]: { score: percentage, result } })
          .every(r => r !== null)

        if (allCompleted) {
          // Redirect to dashboard after all tests
          setTimeout(() => {
            router.push('/dashboard')
          }, 2000)
        } else {
          setCurrentCategory(null)
          setShowResults(true)
        }
      }
    } catch (error) {
      console.error('Error submitting test:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getProgress = () => {
    if (!currentCategory) return 0
    const category = testCategories[currentCategory]
    return ((currentQuestionIndex + 1) / category.questions.length) * 100
  }

  const currentTest = currentCategory ? testCategories[currentCategory] : null
  const currentQuestion = currentTest?.questions[currentQuestionIndex]
  const allTestsCompleted = Object.values(testResults).every(r => r !== null)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Psikotes</h1>
          <p className="text-gray-600">Lengkapi semua psikotes untuk hasil pencocokan yang lebih akurat</p>
        </div>

        {/* Test Selection */}
        {!currentCategory && !showResults && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(Object.keys(testCategories) as TestCategory[]).map((category) => {
              const test = testCategories[category]
              const Icon = test.icon
              const result = testResults[category]
              const isCompleted = result !== null

              return (
                <Card
                  key={category}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    isCompleted ? 'border-green-500 bg-green-50' : ''
                  }`}
                  onClick={() => startTest(category)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${isCompleted ? 'bg-green-500' : 'bg-rose-500'}`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{test.title}</CardTitle>
                        <CardDescription className="text-sm">{test.description}</CardDescription>
                      </div>
                      {isCompleted && (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      )}
                    </div>
                  </CardHeader>
                  {isCompleted && (
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Skor:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-green-600">{result?.score.toFixed(0)}%</span>
                          <span className="text-sm text-gray-500">({result?.result})</span>
                        </div>
                      </div>
                      <Progress value={result?.score || 0} className="mt-2" />
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* Test Questions */}
        {currentCategory && currentQuestion && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = currentTest?.icon
                    return Icon ? <Icon className="w-6 h-6 text-rose-500" /> : null
                  })()}
                  <div>
                    <CardTitle>{currentTest?.title}</CardTitle>
                    <CardDescription>
                      Pertanyaan {currentQuestionIndex + 1} dari {currentTest?.questions.length}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentCategory(null)}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
              </div>
              <Progress value={getProgress()} />
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-4">{currentQuestion.text}</h3>
                  <RadioGroup
                    value={answers[currentQuestion.id]?.toString()}
                    onValueChange={handleAnswer}
                  >
                    {currentQuestion.options.map((option) => (
                        <div key={option.value} className="flex items-start space-x-2 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <RadioGroupItem value={option.value.toString()} id={`${currentQuestion.id}-${option.value}`} className="mt-1" />
                        <Label htmlFor={`${currentQuestion.id}-${option.value}`} className="flex-1 cursor-pointer">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0 || isSubmitting}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Sebelumnya
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!answers[currentQuestion.id] || isSubmitting}
                    className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
                  >
                    {currentQuestionIndex === (currentTest?.questions.length || 0) - 1 ? 'Selesai' : 'Selanjutnya'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Summary */}
        {showResults && !allTestsCompleted && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-800 mb-2">Psikotes Selesai!</h3>
                <p className="text-green-700 mb-6">
                  Silakan lanjutkan ke psikotes berikutnya atau kembali ke dashboard nanti.
                </p>
                <Button
                  onClick={() => setShowResults(false)}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Lanjut Psikotes Lain
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Tests Completed */}
        {allTestsCompleted && !currentCategory && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <BarChart3 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-green-800 mb-2">Semua Psikotes Selesai!</h3>
                <p className="text-green-700 mb-6">
                  Anda sekarang akan diarahkan ke dashboard untuk melihat rekomendasi pasangan.
                </p>
                <div className="inline-flex items-center text-sm text-green-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500 mr-2"></div>
                  Mengarahkan ke dashboard...
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warning */}
        {!allTestsCompleted && !currentCategory && !showResults && (
          <Alert className="mt-6 bg-amber-50 border-amber-200">
            <AlertDescription className="text-amber-800">
              <strong>Catatan:</strong> Hasil psikotes akan digunakan untuk sistem pencocokan pasangan berbasis AI.
              Jawablah dengan jujur dan sesuai kondisi sebenarnya.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}
