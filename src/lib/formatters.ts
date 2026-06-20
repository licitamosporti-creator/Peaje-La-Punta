export const formatCOP = (val: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(val);
};

export const formatShortDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

export const formatChartDate = (dateStr: string, mode: 'diario' | 'mensual' | 'anual') => {
  if (mode === 'anual') return dateStr;
  if (mode === 'mensual') {
    const parts = dateStr.split('-');
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    return `${monthNames[monthIdx]} ${parts[0]}`;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
};

export const formatHeaderDate = (dateStr: string, mode: 'diario' | 'mensual' | 'anual') => {
  if (mode === 'anual') return dateStr;
  if (mode === 'mensual') {
    const parts = dateStr.split('-');
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthIdx = parseInt(parts[1], 10) - 1;
    return `${monthNames[monthIdx]} ${parts[0]}`;
  }
  return dateStr;
};
