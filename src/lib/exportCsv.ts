/**
 * Exporta un conjunto de datos a un archivo CSV compatible con Excel.
 * Utiliza el separador punto y coma (;) que es el estándar para Excel en LATAM (Colombia).
 * Añade el BOM UTF-8 para evitar problemas de codificación con las tildes y ñ.
 * 
 * @param filename Nombre del archivo a descargar (ej. 'reporte.csv')
 * @param headers Arreglo con los títulos de las columnas
 * @param data Arreglo de arreglos con los datos fila por fila
 */
export const exportToCSV = (filename: string, headers: string[], data: any[][]) => {
  const BOM = "\uFEFF";
  
  const csvContent = [
    headers.join(';'),
    ...data.map(row => row.map(cell => {
      if (cell === null || cell === undefined) return '';
      const str = String(cell);
      // Escapar comillas dobles, saltos de línea y el propio separador
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(';'))
  ].join('\n');

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
