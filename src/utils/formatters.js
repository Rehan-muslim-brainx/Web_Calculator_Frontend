export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)

export const formatPercent = (value) =>
  `${((value || 0) * 100).toFixed(2)}%`

export const formatNumber = (value) =>
  new Intl.NumberFormat('en-US').format(Math.round(value || 0))
