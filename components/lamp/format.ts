export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--"
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

// The ESP32 PoC may publish either a 0-100 percentage or the raw 12-bit ADC reading (0-4095).
export function luminosityScale(values: (number | null)[]) {
  return values.some((v) => v !== null && v > 100) ? 4095 : 100
}

export function luminosityPercent(value: number | null, scale = luminosityScale([value])) {
  if (value === null) return 0
  return Math.max(0, Math.min(100, (value / scale) * 100))
}

export function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function average(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v !== null)
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}
