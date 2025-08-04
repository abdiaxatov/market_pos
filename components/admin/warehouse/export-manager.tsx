"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, FileSpreadsheet, FileText, Calendar, Loader2 } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import type { DailyEntry } from "@/types/warehouse"

interface ExportManagerProps {
  entries: DailyEntry[]
}

export function ExportManager({ entries }: ExportManagerProps) {
  const [exportFormat, setExportFormat] = useState<"excel" | "csv">("excel")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [includeCharts, setIncludeCharts] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()

  const filteredEntries = entries.filter((entry) => {
    if (!dateFrom && !dateTo) return true

    const entryDate = new Date(entry.sana)
    const startDate = dateFrom ? new Date(dateFrom) : null
    const endDate = dateTo ? new Date(dateTo) : null

    if (startDate && entryDate < startDate) return false
    if (endDate && entryDate > endDate) return false

    return true
  })

  const exportToCSV = (data: DailyEntry[]) => {
    const headers = ["Sana", "Mahsulot Nomi", "Miqdor (kg)", "Narxi (so'm)", "Jami (so'm)", "Tasdiqlangan"]
    const rows = data.flatMap((entry) =>
      entry.mahsulotlar.map((product) => [
        formatDate(entry.sana),
        `"${product.nomi}"`,
        product.kg.toString(),
        product.narxi.toString(),
        product.puli.toString(),
        product.tasdiqlangan ? "Ha" : "Yo'q",
      ]),
    )

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")

    // Add BOM for UTF-8
    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `omborxona-hisobot-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportToExcel = (data: DailyEntry[]) => {
    // Create HTML table for Excel
    const totalExpense = data.reduce((sum, entry) => sum + entry.jami_summa, 0)
    const totalProducts = data.flatMap((entry) => entry.mahsulotlar).length
    const confirmedProducts = data.flatMap((entry) => entry.mahsulotlar).filter((p) => p.tasdiqlangan).length

    let htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <meta name="ProgId" content="Excel.Sheet">
          <meta name="Generator" content="Microsoft Excel 15">
          <style>
            table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .number { text-align: right; }
            .header { background-color: #4472C4; color: white; font-size: 16px; font-weight: bold; text-align: center; }
            .summary { background-color: #E7E6E6; font-weight: bold; }
            .total { background-color: #70AD47; color: white; font-weight: bold; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="6" class="header">OMBORXONA HISOBOTI</td></tr>
            <tr><td colspan="6"></td></tr>
            <tr class="summary">
              <td>Hisobot sanasi:</td>
              <td colspan="5">${formatDate(new Date().toISOString())}</td>
            </tr>
            <tr class="summary">
              <td>Sana oralig'i:</td>
              <td colspan="5">${dateFrom ? formatDate(dateFrom) : "Boshidan"} - ${dateTo ? formatDate(dateTo) : "Oxirigacha"}</td>
            </tr>
            <tr class="summary">
              <td>Jami kirimlar:</td>
              <td colspan="5">${data.length} ta</td>
            </tr>
            <tr class="summary">
              <td>Jami mahsulotlar:</td>
              <td colspan="5">${totalProducts} ta</td>
            </tr>
            <tr class="summary">
              <td>Tasdiqlangan:</td>
              <td colspan="5">${confirmedProducts} ta</td>
            </tr>
            <tr class="total">
              <td>JAMI XARAJAT:</td>
              <td colspan="5">${formatCurrency(totalExpense)}</td>
            </tr>
            <tr><td colspan="6"></td></tr>
            <tr>
              <th>Sana</th>
              <th>Mahsulot Nomi</th>
              <th>Miqdor (kg)</th>
              <th>Narxi (so'm)</th>
              <th>Jami (so'm)</th>
              <th>Tasdiqlangan</th>
            </tr>
    `

    data.forEach((entry) => {
      entry.mahsulotlar.forEach((product) => {
        htmlContent += `
          <tr>
            <td>${formatDate(entry.sana)}</td>
            <td>${product.nomi}</td>
            <td class="number">${product.kg}</td>
            <td class="number">${product.narxi.toLocaleString()}</td>
            <td class="number">${product.puli.toLocaleString()}</td>
            <td>${product.tasdiqlangan ? "Ha" : "Yo'q"}</td>
          </tr>
        `
      })
    })

    htmlContent += `
          </table>
        </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `omborxona-hisobot-${new Date().toISOString().split("T")[0]}.xls`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExport = async () => {
    if (filteredEntries.length === 0) {
      toast({
        title: "Xatolik",
        description: "Eksport qilish uchun ma'lumot yo'q",
        variant: "destructive",
      })
      return
    }

    setIsExporting(true)

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate processing

      if (exportFormat === "csv") {
        exportToCSV(filteredEntries)
      } else {
        exportToExcel(filteredEntries)
      }

      toast({
        title: "Muvaffaqiyat",
        description: `${filteredEntries.length} ta yozuv ${exportFormat.toUpperCase()} formatida yuklab olindi`,
      })
    } catch (error) {
      toast({
        title: "Xatolik",
        description: "Eksport qilishda xatolik yuz berdi",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const stats = {
    totalEntries: filteredEntries.length,
    totalExpense: filteredEntries.reduce((sum, entry) => sum + entry.jami_summa, 0),
    totalProducts: filteredEntries.flatMap((entry) => entry.mahsulotlar).length,
    confirmedProducts: filteredEntries.flatMap((entry) => entry.mahsulotlar).filter((p) => p.tasdiqlangan).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Ma'lumotlarni Eksport Qilish</h2>
        <p className="text-muted-foreground">Omborxona ma'lumotlarini Excel yoki CSV formatida yuklab oling</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Eksport Sozlamalari</CardTitle>
            <CardDescription>Eksport parametrlarini sozlang</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>Sana Oralig'i</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">
                    Dan
                  </Label>
                  <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="dateTo" className="text-xs text-muted-foreground">
                    Gacha
                  </Label>
                  <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Fayl Formati</Label>
              <Select value={exportFormat} onValueChange={(value: "excel" | "csv") => setExportFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Excel (.xls)
                    </div>
                  </SelectItem>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      CSV (.csv)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Additional Options */}
            <div className="space-y-2">
              <Label>Qo'shimcha Sozlamalar</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeCharts"
                  checked={includeCharts}
                  onCheckedChange={(checked) => setIncludeCharts(checked as boolean)}
                />
                <Label htmlFor="includeCharts" className="text-sm">
                  Statistika va jami hisobni qo'shish
                </Label>
              </div>
            </div>

            {/* Export Button */}
            <Button onClick={handleExport} disabled={isExporting || filteredEntries.length === 0} className="w-full">
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eksport qilinmoqda...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {exportFormat === "excel" ? "Excel" : "CSV"} ga Yuklab Olish
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Eksport Ko'rinishi</CardTitle>
            <CardDescription>Tanlangan ma'lumotlar haqida ma'lumot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.totalEntries}</div>
                <div className="text-sm text-muted-foreground">Kunlik Kirimlar</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.totalProducts}</div>
                <div className="text-sm text-muted-foreground">Mahsulotlar</div>
              </div>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalExpense)}</div>
              <div className="text-sm text-muted-foreground">Jami Xarajat</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{stats.confirmedProducts}</div>
                <div className="text-xs text-green-700">Tasdiqlangan</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-lg font-bold text-orange-600">{stats.totalProducts - stats.confirmedProducts}</div>
                <div className="text-xs text-orange-700">Kutilmoqda</div>
              </div>
            </div>

            {/* Date Range Info */}
            {(dateFrom || dateTo) && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Tanlangan Sana Oralig'i</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {dateFrom ? formatDate(dateFrom) : "Boshidan"} - {dateTo ? formatDate(dateTo) : "Oxirigacha"}
                </div>
              </div>
            )}

            {/* Recent Entries Preview */}
            {filteredEntries.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">So'nggi Kirimlar</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {filteredEntries.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex justify-between items-center p-2 border rounded text-sm">
                      <span>{formatDate(entry.sana)}</span>
                      <span className="font-medium">{formatCurrency(entry.jami_summa)}</span>
                    </div>
                  ))}
                  {filteredEntries.length > 5 && (
                    <div className="text-center text-xs text-muted-foreground">
                      va yana {filteredEntries.length - 5} ta kirim...
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
